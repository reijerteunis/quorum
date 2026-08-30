/**
 * The two step kinds that do work with something outside the engine: an agent step, which invokes
 * an adapter, and a script step, which runs the project's own command.
 *
 * This is the only file in this folder that invokes an adapter — `adapter.run(` appears here and
 * nowhere else — which is what keeps `prompt.ts` a composer and `routing.ts` a dispatcher. The two
 * orderings that cost this project money are in `runAgentStep` and are pinned rather than merely
 * written: the prompt is persisted before the vendor is invoked, and billed usage is stamped onto
 * the occurrence the moment the vendor returns, above everything that can still throw.
 *
 * Why: behaviour preserved from spike/src/engine.js (charter §2, Q-0052).
 */
import path from 'node:path';

import { OUTPUT_FILE, PROMPT_FILE, TICKET_ARTIFACT_DIR, ticketBranch } from '@quorum/shared';

import { checkAgainstSchema, getAdapter } from '../adapters/adapters.js';
import type { AdapterError, RetriedAdapterResult } from '../adapters/adapters.js';
import type { Frontmatter } from '../backlog/backlog.js';
import { runCommand } from '../fanout/command.js';
import { branchExists, commitAll, mergeInto } from '../fanout/fanout.js';
import type { MergeResult } from '../fanout/fanout.js';
import { ensureWorktree } from '../git/git.js';
import { countUsage, errorOf, normaliseUsage } from '../run-history/manifest.js';
import { interpolate, loadRole, writesOf } from './loaders.js';
import { buildPrompt, schemaFor } from './prompt.js';
import type { PromptContext } from './prompt.js';
import { handleFail } from './routing.js';
import { FlowError, type RoutingContext, type RunContext, type StepResult } from './types.js';

/**
 * What a fan-out supplies on top of the step's own declaration.
 *
 * Ported ahead of its only producer, which is Q-0053's: leaving it out would make that ticket
 * change this one's exported signature and every test written against it.
 */
export interface AgentStepExtra {
  /** Per-task interpolation values, overlaid on the run's for the duration of one call. */
  vars?: Readonly<Record<string, unknown>>;
  /** Sync the step's base into its branch even when the branch was created by this call. */
  syncBase?: boolean;
  /** Appended to the built prompt, given the working directory the step resolved. */
  promptSuffix?: (cwd: string) => string;
}

/** A step's `output:` block, as far as the agent step reads it. */
interface StepOutput {
  verdict?: unknown;
  verdict_file?: unknown;
  write?: unknown;
}

/** An agent's answer after `checkAgainstSchema` has accepted it against the generated schema. */
interface AgentOutput {
  summary?: string;
  document?: string;
  verdict?: string;
  findings?: string[];
}

/** What a failing adapter call may carry beyond an `Error`, over and above {@link AdapterError}. */
interface ThrownAdapterCall extends AdapterError {
  /** The vendor's unstructured answer, saved beside the occurrence and never dropped. */
  raw?: string;
}

/** Whatever `value` is, as the shape it is read as — or `undefined` when it is not an object. */
const block = <T>(value: unknown): T | undefined =>
  typeof value === 'object' && value !== null ? value as T : undefined;

/** What `commands.timeout_ms` says, or fifteen minutes. A project's command can hang as a suite can. */
const commandTimeout = (context: RunContext): number => context.config.commands?.timeout_ms ?? 15 * 60_000;

/** Adds one call's billed usage to the run's running totals. */
function bill(context: RunContext, usage: RetriedAdapterResult['usage'] | AdapterError['usage']): void {
  const counted = countUsage(usage);
  context.stats.cost += counted.cost;
  context.stats.tokens += counted.tokens;
  context.stats.unpriced += counted.unpriced;
}

/**
 * Why a merge did not land, in words a reader can act on.
 *
 * A merge can fail without conflicting — a missing ref, a dirty tree, a git that simply refuses —
 * and reporting only the conflicts printed a sentence with nothing after its colon.
 *
 * @param merge what {@link mergeInto} answered.
 * @returns the conflicting paths, else git's own first non-empty line, else that there was neither.
 */
export function mergeFailure(merge: Partial<MergeResult> | null | undefined): string {
  if (merge?.conflicts?.length) return `conflicts: ${merge.conflicts.join(', ')}`;
  const line = String(merge?.error ?? '').split('\n').map((l) => l.trim()).filter(Boolean)[0];
  return line ? `git: ${line}` : 'git reported no reason';
}

/**
 * One call's cost as a human reads it: money where the vendor reported it, tokens where it did not.
 *
 * A vendor that reports no price is **unpriced, not free** — `$0.000` would state a price Quorum
 * does not know. It lives beside the step that prints it rather than in `run-history/`, on that
 * subsystem's own boundary rule: run history computes, and does not narrate (Q-0049 NG-2).
 *
 * @param usage what the call reported, if anything.
 * @returns `cost=$0.123`, or `cost=n/a (<tokens> tokens, vendor reports no price)`.
 */
export function formatCost(
  usage: { cost_usd?: number | null; input_tokens?: number | null; output_tokens?: number | null } | null | undefined,
): string {
  if (usage?.cost_usd != null) return `cost=$${usage.cost_usd.toFixed(3)}`;
  const tokens = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);
  return `cost=n/a (${tokens} tokens, vendor reports no price)`;
}

/**
 * Which model, if any, is named to the adapter.
 *
 * The step's own always wins. A role's default is suppressed when the role names a **different**
 * adapter than the one that resolved, so `opus` does not reach a codex step (Q-0001). A role naming
 * **no** adapter is not suppressed, and lends its model to whichever adapter resolved.
 *
 * That last clause is narrower than register row 2's third clause reads, and the divergence is
 * deliberate rather than overlooked — see the authority line in the body.
 *
 * @param step the step, as the flow file wrote it.
 * @param role the role file's frontmatter.
 * @param adapterName the adapter the step actually resolved to.
 * @returns the model to pass, or `undefined` to pass none.
 */
export function resolveModel(
  step: Readonly<Record<string, unknown>>,
  role: Frontmatter,
  adapterName: string,
): string | undefined {
  if (step.model) return step.model as string;
  const meta = block<{ adapter?: string; model?: string }>(role.meta);
  const roleAdapter = meta?.adapter;
  // Why: preserved defect, see Q-0052 errata E-1 — the spike suppresses on inequality, never on
  // absence, so a role naming a model but no adapter lends it to any vendor. Restoring the strict
  // form is a behaviour change this route may not make; Q-0081 owns it for both trees.
  if (roleAdapter && roleAdapter !== adapterName) return undefined;
  return meta?.model;
}

/**
 * Which adapter the step runs on: the run's override, then the step's, then the role's, then
 * `claude`.
 *
 * The override is **narrowed rather than coerced**, and that is not a style choice.
 * `projectConfigSchema` is a `z.looseObject` that declares no `adapterOverride`, so the value
 * arrives typed `unknown` — and `String(undefined)` is the string `"undefined"`, which would send
 * every run of every project whose `harness.yaml` omits the key to an adapter of that name.
 */
function resolveAdapterName(step: Readonly<Record<string, unknown>>, role: Frontmatter, config: RunContext['config']): string {
  const override: unknown = config.adapterOverride;
  if (typeof override === 'string' && override !== '') return override;
  const meta = block<{ adapter?: string }>(role.meta);
  return (step.adapter as string | undefined) ?? meta?.adapter ?? 'claude';
}

/**
 * Runs one agent step: prompt, schema, adapter and model resolution, the vendor call, its answer's
 * validation, the ticket artifacts it declares, and the commit on its own branch.
 *
 * @param step the step, as the flow file wrote it.
 * @param context the run. It is passed on unchanged — only `buildPrompt` sees the narrowed view
 *   carrying `extra.vars`.
 * @param extra what a fan-out supplies for one task; empty for every caller in this ticket.
 * @returns `null` when the step passed or declared no verdict, and {@link handleFail}'s decision
 *   when a declared verdict was not the vocabulary's first option.
 * @throws {FlowError} when the structured output does not match the schema Quorum generated, naming
 *   the problems and the file the raw answer was saved to. An adapter's own failure is rethrown
 *   unchanged, after it has been billed, logged and recorded.
 */
export async function runAgentStep(
  step: Readonly<Record<string, unknown>>,
  context: RoutingContext,
  extra: AgentStepExtra = {},
): Promise<StepResult> {
  const { ticket } = context;
  const stepId = String(step.id);
  const vars: Record<string, unknown> = { ...context.vars, ...(extra.vars ?? {}) };
  const declared = block<StepOutput>(step.output);

  const role = loadRole(step.role as string | null | undefined, context.harnessDir);
  const adapterName = resolveAdapterName(step, role, context.config);
  const model = resolveModel(step, role, adapterName);
  const adapter = getAdapter(adapterName, context.config.adapters);
  const schema = schemaFor(step);

  let cwd = context.repoDir;
  let branch: string | null = null;
  if (step.worktree && !context.dry) {
    branch = interpolate(String(step.branch ?? ticketBranch(ticket.meta.id, stepId)), vars);
    const stepBase = interpolate(String(step.base ?? ticket.meta.branch), vars);
    const existed = branchExists(context.repoDir, branch);
    cwd = ensureWorktree(context.repoDir, branch, stepBase);
    context.emit({ type: 'info', message: `${stepId}: worktree ${cwd} (${branch})` });
    // A branch created on an earlier round is stale: its base has moved on since. Syncing only on a
    // fan-out retry left the agent working against yesterday's tree, appearing to revert whatever
    // landed in between. See Q-0004.
    if (existed || extra.syncBase) {
      if (!branchExists(context.repoDir, stepBase)) {
        // Normal on a ticket's first pass — the integration branch is created by the first integrate
        // step. Not a failure, and an `info` rather than a warning with nothing after its colon.
        context.emit({ type: 'info', message: `${stepId}: base ${stepBase} does not exist yet — nothing to sync` });
      } else {
        const merged = mergeInto(cwd, stepBase);
        if (merged.ok) context.emit({ type: 'info', message: `${stepId}: synced to ${stepBase}` });
        else context.emit({ type: 'warn', message: `${stepId}: could not sync to ${stepBase} — ${mergeFailure(merged)}` });
      }
    }
  }

  const promptContext: PromptContext = {
    repoDir: context.repoDir, config: context.config, vars, ticket, runId: context.runId,
    baseOverride: context.baseOverride, deferredDiffs: context.deferredDiffs, diffInputs: context.diffInputs,
    persistence: context.persistence, backlog: context.backlog, harnessDir: context.harnessDir, dry: context.dry,
  };
  const prompt = buildPrompt(step, role, promptContext) + (extra.promptSuffix?.(cwd) ?? '');
  const started = `${adapterName}${model ? '/' + model : ''} role=${String(step.role ?? '-')}`;

  if (context.dry) {
    context.emit({ type: 'step', stepId, message: started });
    context.emit({ type: 'info', message: `${stepId}: dry run — prompt ${prompt.length} chars, schema ${Object.keys(schema.properties).join(',')}` });
    return null;
  }

  const occurrence = context.persistence.allocateOccurrence({ id: stepId }, 'adapter', {
    role: (step.role as string | undefined) ?? null,
    adapter: adapterName,
    model: model ?? null,
    branch,
    worktree: cwd,
  });
  // The dry case, which returned above, is the only one that allocates nothing — the seam answers
  // `null` where a run has no history rather than crashing on an absent one.
  if (occurrence === null) return null;
  // Before the vendor is invoked, so that a crash still leaves on disk what was sent.
  context.persistence.persistArtifact(occurrence, PROMPT_FILE, prompt);
  context.emit({ type: 'step', stepId, message: started });

  let result: RetriedAdapterResult;
  try {
    result = await adapter.run({
      prompt, schema, model, cwd,
      extraDirs: [ticket.dir, context.harnessDir],
      allowWrite: Boolean(step.worktree),
      maxTurns: (step.max_turns as number | undefined) ?? 40,
      // Stamped per call rather than taken from the run loop's single slot: the loop knows the
      // top-level step and a `parallel:` group carries no id, so a member supplies its own. See
      // Q-0050 round 6, Major 1.
      onEvent: (event) => { context.emit({ ...event, stepId }); },
    });
  } catch (error) {
    const failed = error as ThrownAdapterCall;
    // A step that fails after the vendor has already billed it still cost money; dropping it makes
    // the roll-up understate exactly where accuracy matters most. See Q-0002.
    bill(context, failed.usage);
    // Always, empty included: behind a null check the most useful case — a failure with nothing to
    // show — was the one that left an empty directory, so a reader could not tell "no output" from
    // "history not written". See Q-0034.
    context.persistence.persistArtifact(occurrence, OUTPUT_FILE, failed.raw ?? '');
    context.persistence.terminalOccurrence(occurrence, 'failed', {
      attempts: failed.attempts ?? 1,
      usage: normaliseUsage(failed.usage, failed.vendor ?? adapter.vendor),
      error: errorOf(failed, adapterName),
    });
    context.persistence.appendLog(ticket, `run=${context.runId} step=${stepId} vendor=${adapterName} model=${model ?? '-'} FAILED cost=${failed.usage?.cost_usd ?? '?'} error=${JSON.stringify(String(failed.message).split('\n')[0]!.slice(0, 200))}`);
    throw error;
  }
  bill(context, result.usage);
  // The moment the vendor returns, and above everything that can still throw — the schema check,
  // the artifact writes, the verdict file, an unguarded commitAll. Until this line only the
  // terminal write recorded usage, so a failure anywhere in that stretch filed a call the vendor
  // had already charged as `usage: null` and dropped it from the roll-up. See Q-0034.
  occurrence.attempts = result.attempts ?? 1;
  occurrence.usage = normaliseUsage(result.usage, result.vendor ?? adapter.vendor);

  const problems = checkAgainstSchema(result.output, schema);
  if (problems.length) {
    context.persistence.persistArtifact(occurrence, OUTPUT_FILE, result.raw ?? '');
    const dump = context.backlog.writeFile(ticket, `${TICKET_ARTIFACT_DIR}/${stepId}-${Date.now()}.raw.txt`, result.raw ?? '');
    context.persistence.terminalOccurrence(occurrence, 'failed', {
      attempts: result.attempts ?? 1,
      usage: normaliseUsage(result.usage, result.vendor ?? adapter.vendor),
      error: { category: 'structured_output', message: `${stepId}: structured output invalid (${problems.join('; ')})` },
    });
    throw new FlowError(`${stepId}: structured output invalid (${problems.join('; ')}). Raw saved to ${dump}`);
  }
  context.persistence.persistArtifact(occurrence, OUTPUT_FILE, result.raw ?? '');

  const output = result.output as AgentOutput;
  for (const rel of writesOf(step)) {
    const abs = context.backlog.writeFile(ticket, interpolate(rel, vars), output.document ?? result.raw);
    context.emit({ type: 'info', message: `${stepId}: wrote ${path.relative(ticket.dir, abs)}` });
  }
  if (declared?.verdict) {
    const verdictPath = interpolate(String(declared.verdict_file ?? `${TICKET_ARTIFACT_DIR}/${stepId}-verdict.json`), vars);
    context.backlog.writeFile(ticket, verdictPath, JSON.stringify({ verdict: output.verdict, findings: output.findings ?? [], summary: output.summary }, null, 2));
  }
  if (branch) {
    const files = commitAll(
      cwd,
      `${stepId}: ${output.summary?.slice(0, 60) ?? 'agent changes'} [${ticket.meta.id}]`,
      (dropped) => { context.emit({ type: 'warn', message: `${stepId}: discarded ${dropped.length} edit(s) under backlog/ — the engine owns ticket state, not the agent: ${dropped.slice(0, 4).join(', ')}${dropped.length > 4 ? ', …' : ''}` }); },
    );
    context.emit({ type: 'info', message: `${stepId}: ${files ? files.length + ' file(s) committed on ' + branch : 'no file changes on ' + branch}` });
  }
  // Why: preserved defect, see Q-0052 — `usage` is dereferenced unguarded here and optionally two
  // lines above, while `withRetry` answers `null` for a call that reported no measure at all.
  context.persistence.appendLog(ticket, `run=${context.runId} step=${stepId} vendor=${result.vendor} model=${model ?? '-'} verdict=${output.verdict ?? '-'} cost=${result.usage!.cost_usd ?? '?'} ms=${result.ms}`);
  context.emit({ type: 'done', stepId, message: `${output.verdict ? 'verdict=' + output.verdict + ' ' : ''}${formatCost(result.usage)} ${result.ms}ms` });
  context.persistence.terminalOccurrence(occurrence, 'completed', {
    attempts: result.attempts ?? 1,
    verdict: output.verdict ?? null,
    usage: normaliseUsage(result.usage, result.vendor ?? adapter.vendor),
  });

  if (declared?.verdict) {
    // The vocabulary's first option means pass; anything else routes through the step's own bound.
    const passValue = schema.properties.verdict?.enum?.[0];
    if (output.verdict !== passValue) {
      context.emit({ type: 'warn', message: `${stepId}: ${String(output.verdict)}${output.findings?.length ? ' — ' + output.findings.join(' | ') : ''}` });
      return handleFail(step, context);
    }
  }
  return null;
}

/**
 * Runs one script step: the project's own command, under the project's own timeout.
 *
 * @param step the step, as the flow file wrote it.
 * @param context the run.
 * @returns `null` on exit 0, {@link handleFail}'s decision on a non-zero exit under `on_fail`, and
 *   an abort otherwise.
 * @throws {FlowError} when the command was killed for running too long. A timeout is never a
 *   backward edge: looping cannot fix a command that never finishes.
 */
export async function runScript(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  const stepId = String(step.id);
  const command = interpolate(String(step.run), context.vars);
  context.emit({ type: 'step', stepId, message: `script: ${command}` });
  if (context.dry) return null;
  const occurrence = context.persistence.allocateOccurrence({ id: stepId }, 'script');
  if (occurrence === null) return null;
  const result = runCommand(command, context.repoDir, { timeoutMs: commandTimeout(context) });
  context.persistence.persistArtifact(occurrence, OUTPUT_FILE, result.out);
  const write = block<StepOutput>(step.output)?.write;
  if (write) context.backlog.writeFile(context.ticket, interpolate(String(write), context.vars), result.out);
  if (result.code === 0) {
    context.persistence.terminalOccurrence(occurrence, 'completed');
    context.emit({ type: 'done', stepId, message: 'exit 0' });
    return null;
  }
  if (result.timedOut) {
    context.persistence.terminalOccurrence(occurrence, 'failed', { error: { category: 'script', message: `${stepId}: script timed out` } });
    throw new FlowError(`${stepId}: script did not finish within ${Math.round((result.timeoutMs ?? 0) / 60000)} minutes and was killed — that is not a result, fix the command or raise commands.timeout_ms`);
  }
  context.persistence.terminalOccurrence(occurrence, 'failed', { error: { category: 'script', message: `${stepId}: script exited ${result.code}` } });
  context.emit({ type: 'warn', message: `${stepId}: exit ${result.code}` });
  return step.on_fail ? handleFail(step, context) : { abort: true };
}
