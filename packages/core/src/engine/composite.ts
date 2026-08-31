/**
 * The two composite step kinds: a fan-out, which expands a solution's tasks into one agent step per
 * task, and an integrate, which merges branches onto a target in a worktree and decides whether the
 * suite that ran there proves anything.
 *
 * Four invariants make a red phase trustworthy and all four are here: dependencies are installed in
 * the worktree before the test command runs, a suite that could not start is rejected rather than
 * counted as red, the ticket branch is caught up with the base before task worktrees are cut from
 * it, and every terminal outcome reaches `runs.log` with its counters. Each of them was once a
 * defect that made `expect: fail` accept something that was not a red phase, and each is invisible
 * to a happy-path test — a port that drops the install still reports `tests=ok` on a green run and
 * lies only on the ticket that mattered. See harness/port-charter.md §6, register row 7.
 *
 * Why: behaviour preserved from spike/src/engine.js — harness/port-charter.md §2, Q-0053.
 *
 * Why: preserved defect, see Q-0053 AC-14(3) — the five branch-existence reads in this file cannot
 * tell an absent branch from a git that failed, and filter identically either way. Q-0074 owns it.
 *
 * Why: preserved defect, see Q-0053 AC-14(4) — a merge that failed with nothing to say is reported
 * as `git reported no reason` rather than as an error this file could act on.
 */
import { OUTPUT_FILE } from '@quorum/shared';

import { runCommand } from '../fanout/command.js';
import {
  branchExists, branchHead, loadTasks, mergeInto, scopeToFailing, taskPromptSection, taskVars,
  ticketWorktree, waves,
} from '../fanout/fanout.js';
import type { Task } from '../fanout/fanout.js';
import { mergeBase } from '../git/git.js';
import { interpolate, loadRole, writesOf } from './loaders.js';
import { handleFail } from './routing.js';
import { commandTimeout, mergeFailure, runAgentStep } from './steps.js';
import { environmentFailure, testReport } from './suite-output.js';
import { FlowError, type FannedTask, type RoutingContext, type StepResult } from './types.js';

/** What {@link syncBaseIntoTicketBranch} did, as four outcomes a caller can tell apart. */
export type BaseSyncResult =
  /** The merge landed, and an `info` said so. */
  | { ok: true }
  /** Nothing was attempted, and this is why — none of the three reasons is a failure. */
  | { skipped: string };

/** `harness.yaml`'s `commands` block under a prefix, which is how a string `run_tests` reads it. */
function flatten(values: Readonly<Record<string, unknown>>, prefix: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`${prefix}.${key}`, value]));
}

/** One `info` or one `warn`, chosen by whether what is being reported went well. */
function report(context: RoutingContext, ok: boolean, message: string): void {
  context.emit(ok ? { type: 'info', message } : { type: 'warn', message });
}

/** A role file's frontmatter as a fan-out template reads it: an adapter, a model, or neither. */
function roleDefaults(meta: unknown): { adapter?: string; model?: string } {
  return typeof meta === 'object' && meta !== null ? meta as { adapter?: string; model?: string } : {};
}

/**
 * Catch the ticket branch up with the repository's base **before** task worktrees are cut from it.
 *
 * The worktrees sync to the ticket branch and `integrate` syncs the ticket branch to the base, so
 * with the sync only at the end every agent works against a base that moves underneath it, and
 * anything landing on the base mid-run surfaces as a conflict nobody in the loop can repair —
 * Q-0006's run 11 lost its runtime task exactly that way.
 *
 * @param step the fan-out step; its `step.base` template names the branch to catch up.
 * @param context the run.
 * @returns `{ ok: true }` after a merge, or the reason nothing was attempted. A ticket on its first
 *   pass is skipped rather than failed: only `integrate` creates the integration branch.
 * @throws {FlowError} on a genuine conflict, naming the work a human has to do. Re-running the
 *   developers cannot fix it — their worktrees branch from the ticket branch, where nothing is
 *   wrong — so the run stops instead of spending its iteration budget rediscovering that.
 */
export function syncBaseIntoTicketBranch(
  step: Readonly<Record<string, unknown>>,
  context: RoutingContext,
): BaseSyncResult {
  const stepId = String(step.id);
  const template = step.step as { base?: unknown } | undefined;
  const into = interpolate(String(template?.base ?? context.ticket.meta.branch), context.vars);
  const base = interpolate(context.config.repo?.base_branch ?? 'main', context.vars);
  if (!base || base === into) return { skipped: 'base is the ticket branch' };
  if (!branchExists(context.repoDir, into)) return { skipped: `${into} does not exist yet` };
  if (!branchExists(context.repoDir, base)) return { skipped: `${base} does not exist` };
  const merged = mergeInto(ticketWorktree(context.repoDir, into), base);
  if (merged.ok) {
    context.emit({ type: 'info', message: `${stepId}: ${into} synced to ${base} before fan-out` });
    return { ok: true };
  }
  throw new FlowError(
    `${stepId}: cannot sync ${into} to ${base} before fan-out — ${mergeFailure(merged)}.`
    + ` Resolve it in a worktree on ${into}, commit, and re-run;`
    + ' no agent in this loop can repair a base conflict.',
  );
}

/**
 * Expand the fan-out's child template for one task and run it as an ordinary agent step.
 *
 * @param step the fan-out step, whose `step` block is the template.
 * @param context the run.
 * @param task the task, as `tasks.yaml` wrote it.
 * @param fanned the run's record of what was fanned out, which this appends to before the step runs
 *   so that a failing `integrate` can map a branch back to the task that produced it.
 */
function runTask(
  step: Readonly<Record<string, unknown>>,
  context: RoutingContext,
  task: Task,
  fanned: FannedTask[],
): Promise<StepResult> {
  // Why: preserved behaviour, see Q-0053 AC-6 — a JSON round trip and not `structuredClone`, which
  // keeps `undefined`-valued keys and would change which template fields fall through to the role.
  const template = JSON.parse(JSON.stringify(step.step)) as Record<string, unknown>;
  const vars = taskVars(task);
  template.id = interpolate(String(template.id ?? `${String(step.id)}:{task.id}`), { ...context.vars, ...vars });
  template.role = interpolate(String(template.role ?? 'developer-{role}'), vars);
  for (const key of ['adapter', 'model'] as const) {
    if (template[key]) template[key] = interpolate(String(template[key]), vars);
  }
  template.worktree = true;
  const defaults = roleDefaults(loadRole(String(template.role), context.harnessDir).meta);
  if (template.adapter === '{role.adapter}' || !template.adapter) template.adapter = defaults.adapter ?? 'claude';
  if (template.model === '{role.model}' || !template.model) template.model = defaults.model;
  // Why: preserved defect, see Q-0053 AC-14 — this branch is RECORDED and never written onto the
  // template, so the agent step derives its own from `branch` or from the child's id. They agree
  // only because every shipped fan-out spells `branch:`; a template omitting it records one name
  // and cuts a worktree under another, whose default carries a `:` git refuses as a refname.
  const branch = interpolate(String(template.branch ?? 'harness/{id}/{task.id}'), { ...context.vars, ...vars });
  fanned.push({ task: task.id, branch, role: task.role });
  return runAgentStep(template, context, {
    vars,
    syncBase: true,
    promptSuffix: (cwd) => taskPromptSection(task, cwd)
      + (context.lastIntegration ? `\n\n## Previous integration result\n\n${context.lastIntegration.slice(0, 4000)}` : ''),
  });
}

/**
 * Run one fan-out step: select the tasks, plan their waves, and run each wave concurrently.
 *
 * Tasks inside a wave run under `Promise.all`, so a rejected task rejects the wave; waves run in
 * order, and a wave that produced a routing decision short-circuits the ones after it.
 *
 * @param step the step, as the flow file wrote it.
 * @param context the run. {@link RoutingContext.fanned} is appended to, one entry per task.
 * @returns the first routing decision a member returned, or `null`.
 * @throws {FlowError} when selection left no task to run at all.
 */
export async function runFanOut(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  const stepId = String(step.id);
  const { ticket } = context;
  const fanOut = (step.fan_out ?? {}) as { respect?: unknown; scope?: unknown };

  let tasks = loadTasks(ticket);
  if (fanOut.scope === 'failing-tasks-only' && context.failingTasks?.size) {
    tasks = scopeToFailing(tasks, context.failingTasks);
    context.emit({ type: 'warn', message: `${stepId}: scoped to failing tasks: ${tasks.map((t) => t.id).join(', ')}` });
  }
  if (!tasks.length) throw new FlowError(`${stepId}: no tasks to fan out`);
  if (!context.dry) syncBaseIntoTicketBranch(step, context);

  const plan = fanOut.respect === 'depends_on' ? waves(tasks) : [tasks];
  context.emit({ type: 'info', message: `${stepId}: ${tasks.length} task(s) in ${plan.length} wave(s)` });
  context.fanned ??= [];
  const fanned = context.fanned;

  for (const [index, wave] of plan.entries()) {
    context.emit({ type: 'info', message: `${stepId}: wave ${index + 1}: ${wave.map((t) => `${t.id}(${t.role})`).join(' ')}` });
    const results = await Promise.all(wave.map((task) => runTask(step, context, task, fanned)));
    const decided = results.find((result) => result !== null && ('goto' in result ? Boolean(result.goto) : result.abort));
    if (decided) return decided;
    // Later waves build on earlier ones, so this wave lands on the ticket branch before the next.
    if (plan.length > 1 && index < plan.length - 1) {
      const worktree = ticketWorktree(context.repoDir, ticket.meta.branch);
      for (const task of wave) {
        // Why: preserved defect, see Q-0053 AC-14(1) — the branch name is re-derived here rather
        // than taken from `fanned`, and the target is the ticket branch rather than the template's
        // declared base. A flow spelling either differently merges a ref that may not exist.
        const merged = mergeInto(worktree, `harness/${ticket.meta.id}/${task.id}`);
        // Why: preserved defect, see Q-0053 AC-14(2) — a wave merge that failed warns and the run
        // continues, so the next wave can build on a tree missing its predecessor's work.
        if (!merged.ok) {
          context.emit({ type: 'warn', message: `${stepId}: wave merge conflict on ${task.id}: ${merged.conflicts.join(',')}` });
        }
      }
    }
  }
  return null;
}

/**
 * Run one integrate step: merge the listed branches onto a target branch in its worktree, install
 * and run the project's test command there, and decide whether the result meets `expect`.
 *
 * Three outcomes never reach a backward edge, and that is the point of them. A base conflict, a
 * killed command and a suite that could not start are all conditions no further agent round can
 * repair, so each stops the run with the work a human has to do — after the artifacts, the log line
 * and the occurrence are all on disk.
 *
 * @param step the step, as the flow file wrote it.
 * @param context the run. On failure it gains {@link RoutingContext.failingTasks} and
 *   {@link RoutingContext.lastIntegration} for the next fan-out to read.
 * @returns `null` on success, {@link handleFail}'s decision when a failing step declares `on_fail`,
 *   and an abort otherwise.
 * @throws {FlowError} on a base conflict or on an invalid suite, never on an unmet expectation.
 */
export async function runIntegrate(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  const stepId = String(step.id);
  const { ticket } = context;
  const into = interpolate(String(step.into ?? ticket.meta.branch), context.vars);
  context.emit({ type: 'step', stepId, message: `integrate → ${into}` });
  if (context.dry) return null;
  const occurrence = context.persistence.allocateOccurrence({ id: stepId }, 'integrate');
  // The dry case, which returned above, is the only one that allocates nothing — the seam answers
  // `null` where a run has no history rather than crashing on an absent one.
  if (occurrence === null) return null;
  const dir = ticketWorktree(context.repoDir, into);

  // Evaluated whatever `branches` is, as the spike evaluates it: for an array `String(['a','b'])` is
  // `'a,b'`, and the value is discarded by the first branch below.
  const pattern = interpolate(String(step.branches), context.vars);
  const declared = Array.isArray(step.branches)
    ? (step.branches as unknown[]).map((branch) => interpolate(String(branch), context.vars))
    : null;
  let branches: string[];
  if (declared) branches = declared;
  else if (pattern.includes('*')) branches = [...new Set((context.fanned ?? []).map((entry) => entry.branch))];
  else branches = [pattern];
  branches = branches.filter((branch) => branchExists(context.repoDir, branch));

  const base = interpolate(context.config.repo?.base_branch ?? 'main', context.vars);
  const notes = [`# Integration — run ${context.runId}, iteration ${String(context.vars.iter)}`, '', `Target: \`${into}\``, ''];
  // Evidence about this run, recorded once so no scenario ever has to assert it: a fact true only
  // during the red phase is not an acceptance test, and QA smuggled branch cleanliness into one
  // because there was nowhere else to put it.
  const head = branchHead(context.repoDir, into);
  notes.push(`Evidence: \`${into}\` at ${head ? head.slice(0, 7) : '(new)'}, base \`${base}\`.`);
  // Why: preserved defect, see Q-0053 AC-14(5) — the evidence loop reads the DECLARED list, so a
  // branch the filter above dropped as absent is asked about anyway.
  for (const branch of declared ?? []) {
    const forked = mergeBase(context.repoDir, into, branch);
    if (forked) notes.push(`Evidence: \`${branch}\` diverges from \`${into}\` at ${forked.slice(0, 7)}.`);
  }
  notes.push('');

  const conflicts: string[] = [];
  // The base first. A ticket open for more than a day otherwise integrates against the base it was
  // cut from, and work landed on the base meanwhile looks like the ticket reverting it. See Q-0004.
  if (base && base !== into && branchExists(context.repoDir, base)) {
    const merged = mergeInto(dir, base);
    notes.push(`- ${merged.ok ? '✓' : '✗'} base \`${base}\`${merged.ok ? '' : ' — ' + mergeFailure(merged)}`);
    report(context, merged.ok, `${stepId}: ${merged.ok ? 'synced base' : 'could not sync base'} ${base}${merged.ok ? '' : ' — ' + mergeFailure(merged)}`);
    if (!merged.ok) {
      for (const target of writesOf(step)) {
        context.backlog.writeFile(ticket, interpolate(String(target), context.vars), notes.join('\n'));
      }
      context.persistence.appendLog(ticket, `run=${context.runId} step=${stepId} base-conflict base=${base} files=${merged.conflicts.join(',') || '?'}`);
      // Why: preserved defect, see Q-0053 AC-8 — this exit closes neither the occurrence allocated
      // above nor its `output.txt`, so the finalised manifest keeps an integrate step at `running`
      // with no artifact beside it. Reported at the gate rather than repaired here.
      throw new FlowError(
        `${stepId}: cannot sync ${into} with ${base} — ${mergeFailure(merged)}.\n`
        + `  This is a conflict between the ticket branch and ${base}, so re-running the developers cannot fix it:\n`
        + `  their worktrees branch from ${into}, where nothing is wrong. Merge ${base} into ${into} yourself, then re-run.`,
      );
    }
  }

  for (const branch of branches) {
    const merged = mergeInto(dir, branch);
    notes.push(`- ${merged.ok ? '✓' : '✗'} ${branch}${merged.ok ? '' : ' — ' + mergeFailure(merged)}`);
    report(context, merged.ok, `${stepId}: ${merged.ok ? 'merged' : 'FAILED'} ${branch}${merged.ok ? '' : ' — ' + mergeFailure(merged)}`);
    if (!merged.ok) conflicts.push(branch);
  }

  let testsOk = true;
  let out = '';
  let envError: string | null = null;
  const cmd = step.run_tests === true
    ? context.config.commands?.test ?? 'npm test'
    : step.run_tests
      ? interpolate(String(step.run_tests), { ...context.vars, ...flatten(context.config.commands ?? {}, 'cmd') })
      : null;
  // A worktree is a fresh checkout with no node_modules. Without this the test command dies on a
  // missing dependency, which `expect: fail` happily reads as proof of red. See Q-0004.
  const install = cmd ? context.config.commands?.install : null;
  if (install && !conflicts.length) {
    const installed = runCommand(install, dir, { timeoutMs: commandTimeout(context) });
    notes.push('', `Install: \`${install}\` → exit ${installed.code}`);
    report(context, installed.code === 0, `${stepId}: install exit ${installed.code}`);
    if (installed.code !== 0) {
      envError = `install failed (\`${install}\` exited ${installed.code})`;
      out = installed.out;
    }
  }
  if (cmd && !conflicts.length && !envError) {
    const ran = runCommand(cmd, dir, { timeoutMs: commandTimeout(context) });
    out = ran.out;
    const expected = String(step.expect ?? 'pass');
    // A command killed for running too long proves nothing — least of all a red phase.
    const broken = ran.timedOut
      ? `the test command did not finish within ${Math.round((ran.timeoutMs ?? 0) / 60000)} minutes and was killed`
      : environmentFailure(out);
    if (broken) {
      // Non-zero because the suite could not start is not a red phase. Accepting it would let a
      // missing dependency satisfy `expect: fail` on every ticket, forever.
      envError = `the suite never ran — ${broken}`;
      testsOk = false;
    } else {
      testsOk = expected === 'fail' ? ran.code !== 0 : ran.code === 0;
    }
    notes.push('', `Tests: \`${cmd}\` → exit ${ran.code} (expected ${expected}) → ${envError ? 'INVALID' : testsOk ? 'OK' : 'NOT OK'}`);
    report(context, testsOk, `${stepId}: tests exit ${ran.code}, expected ${expected}${envError ? ' — ' + envError : ''}`);
  }

  for (const target of writesOf(step)) {
    // One coercion serves both uses of the entry: a path is routed by the same string it is
    // written to, so a flow-authored non-string cannot be interpolated and then fail the routing.
    const writePath = String(target);
    context.backlog.writeFile(
      ticket,
      interpolate(writePath, context.vars),
      writePath.includes('report') ? testReport(cmd, out) : notes.join('\n'),
    );
  }
  context.persistence.persistArtifact(occurrence, OUTPUT_FILE, out);
  // Why: preserved defect, see Q-0053 AC-14 — `testsOk` starts true and only the test block clears
  // it, so a conflicted integrate that never ran a command still logs `tests=ok` beside its merge
  // counts. Found while porting and reported rather than fixed.
  context.persistence.appendLog(ticket, `run=${context.runId} step=${stepId} merged=${branches.length - conflicts.length}/${branches.length} tests=${cmd ? (envError ? 'invalid' : testsOk ? 'ok' : 'fail') : '-'}`);

  // Looping back to the author cannot fix a broken environment, so stop with the reason rather than
  // burning the step's iteration budget on it.
  if (envError) {
    context.persistence.terminalOccurrence(occurrence, 'failed', { error: { category: 'integrate', message: `${stepId}: ${envError}` } });
    throw new FlowError(`${stepId}: ${envError}. The report is on disk, but it is not evidence of anything — fix the environment (commands.install in harness.yaml) and re-run.`);
  }
  if (conflicts.length || !testsOk) {
    context.persistence.terminalOccurrence(occurrence, 'failed', {
      error: {
        category: 'integrate',
        message: conflicts.length ? `${stepId}: integration conflicts: ${conflicts.join(', ')}` : `${stepId}: tests did not meet expectation`,
      },
    });
    context.lastIntegration = notes.join('\n') + '\n\n' + out.slice(-3000);
    // Conflicted tasks where there were conflicts; every fanned task where the tests failed without
    // one, because then the agents need the test output. A branch `fanned` does not know is dropped
    // rather than becoming an undefined task id.
    const byBranch = new Map((context.fanned ?? []).map((entry) => [entry.branch, entry.task]));
    context.failingTasks = new Set(conflicts.length
      ? conflicts.map((branch) => byBranch.get(branch)).filter((task): task is string => Boolean(task))
      : (context.fanned ?? []).map((entry) => entry.task));
    if (!step.on_fail) return { abort: true };
    return handleFail(step, context);
  }
  context.emit({
    type: 'done',
    stepId,
    message: `${branches.length} branch(es) on ${into}${cmd ? ', tests ' + (step.expect === 'fail' ? 'red as expected' : 'green') : ''}`,
  });
  context.persistence.terminalOccurrence(occurrence, 'completed');
  context.failingTasks = null;
  return null;
}
