// Flow engine: stage-chained flows, parallel groups, structured outputs written to the
// backlog, bounded backward edges (on_fail.goto), human gates.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './backlog.js';
import { getAdapter, checkAgainstSchema, authError, transientError } from './adapters/index.js';
import { ensureWorktree, ensureExcluded, shortSha, emptyRangeEvidence } from './git.js';
import { loadTasks, waves, taskVars, taskPromptSection, commitAll, mergeInto, runCommand, ticketWorktree, branchExists, branchHead, resetBranchTo, IntegrationError , scopeToFailing} from './fanout.js';
import { FlowError, lintFlow, flattenSteps } from './lint.js';

export { FlowError, lintFlow, lintFlowDirectory, validateFlowDirectory } from './lint.js';

export function loadFlow(file) {
  const flow = YAML.parse(fs.readFileSync(file, 'utf8'));
  flow.file = file;
  lintFlow(flow);
  return flow;
}

// A dry run previews a flow; it must not change anything a real run would change. Every step
// already guarded ctx.dry, but the run's own bookkeeping did not, so --dry logged a start line,
// advanced the ticket's stage and appended a "completed" history entry having invoked no agent and
// written no artifact — the preview left the ticket looking like the flow had run, which then
// refused the real run because the stage it had consumed was gone. Guarding the individual call
// sites would leave every future writer to remember; making the database itself read-only cannot
// be forgotten. See Q-0034.
function readOnlyBacklog(backlog) {
  const view = Object.create(backlog);   // inherits every reader; only the writers are stubbed
  view.write = () => {};
  view.writeFile = () => {};
  view.log = () => {};
  return view;
}

export async function runFlow({ flow, ticket, backlog, harnessDir, repoDir, config, ui, auto = false, dry = false, base = null }) {
  if (ticket.meta.stage !== flow.consumes) {
    throw new FlowError(`ticket ${ticket.meta.id} is at stage "${ticket.meta.stage}", flow "${flow.name}" consumes "${flow.consumes}"`);
  }
  if (dry) backlog = readOnlyBacklog(backlog);
  // Hoisted out of the ctx literal below so that `vars.run` can reference it: a property of an
  // object literal cannot read a sibling property of the same literal. See Q-0057.
  const runId = nextRunId(ticket);
  const ctx = {
    flow, ticket, backlog, harnessDir, repoDir, config, ui, auto, dry,
    counters: ticket.meta.iterations ?? {}, stats: { cost: 0, tokens: 0, unpriced: 0 }, runId,
    // `base` overrides the DIFF ANCHOR only — ctx.vars.base, which `{base}` interpolates and the
    // range guard treats as related. The three sites that MERGE a base into the ticket's branch
    // (rework sync, integrate's sync, the evidence note) read config.repo.base_branch directly and
    // are deliberately not moved: aiming a review at an old revision must not write that revision
    // into the branch. See Q-0077.
    //
    // `run` is this run's id — the number runs.log carries as `run=N` and `.quorum/runs/<id>-N/` is
    // named after. It lets a flow name a ticket-scoped path after the run that wrote it, which
    // `iter` cannot: `iter` restarts at 1 on every run. See Q-0057.
    vars: { id: ticket.meta.id, iter: 1, run: runId, base: base ?? config.repo?.base_branch ?? 'main', round: reviewRound(ticket) },
    // Whether the maintainer typed --base, which vars.base cannot answer: it is set either way,
    // and an override may legitimately name the configured value. Only a diagnostic reads it, so
    // that an unresolvable revision is blamed on the flag rather than on a file that never
    // supplied it. See Q-0038.
    baseOverride: base ?? null,
    diffInputs: new Map(), deferredDiffs: new Map(),
  };
  // What the ticket branch looked like before this run touched it, so a run that does not
  // complete can put it back. See Q-0033.
  ctx.branchHeadAtStart = branchHead(repoDir, ticket.meta.branch);
  // The run's own `start` line and its runs.log entry are emitted inside the try below, not here:
  // Q-0011 moved them so that a failure during initialiseRunHistory still receives a terminal
  // record. Merging main's copies back in at this point would print and log every run twice.
  // Ctrl-C at a gate used to leave no terminal line in runs.log and no persisted counters, so an
  // interrupted run silently handed its iteration budget back — an undocumented way to buy
  // unlimited retries, which defeats the bound the design rests on. See Q-0004.
  const onSignal = (sig) => {
    try {
      for (const occurrence of ctx.activeOccurrences ?? []) terminalOccurrence(ctx, occurrence, 'interrupted', { error: { category: 'interrupted', message: `received ${sig}` } });
      finish(ctx, ticket.meta.stage, 'interrupted', `received ${sig}`);
    } catch { /* nothing left to save */ }
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    ui.info(`run #${ctx.runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}`);
    backlog.log(ticket, `run=${ctx.runId} flow=${flow.name} start stage=${ticket.meta.stage}`);
    if (!dry) initialiseRunHistory(ctx);
  } catch (e) {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    // The `start` line is already in runs.log by the time anything here can throw, so this needs a
    // terminal line too — otherwise the log shows a run that started and then simply stopped
    // existing, which is the exact gap Q-0004 closed for interrupts and which the AC-1 collision
    // refusal re-opened the moment it started throwing from here. finish() reads no run-history
    // state, so it is safe even when initialiseRunHistory is what failed.
    // See Q-0034; found by Q-0011 review round 2.
    finish(ctx, ticket.meta.stage, 'failed', String(e.message ?? e).split('\n')[0].slice(0, 200));
    throw e;
  }

  const steps = flow.steps;
  let i = 0;
  try {
  // Diff-bearing flows have a run-level safety preflight. Preparing every distinct range here
  // means a preceding agent can never be billed before a bad ref (or empty review range) is
  // discovered, and every panel member receives the exact same bytes. It remains inside the run
  // try block so a failed preflight receives the same terminal audit record as every other error.
  //
  // The unit judged is the ENDPOINT, not the range, because a ref is what can be absent. An
  // endpoint an EARLIER step of this same flow creates cannot be evidence yet — the chore flow
  // reviews integration...implement, and implement exists only after the implement step runs — so
  // a range holding one is materialised at step time via buildPrompt's fallback instead. Its other
  // endpoint is still resolved here, where it costs nothing: asking one question of the whole
  // range is what let a missing integration branch bill an implementer first and fail afterwards.
  // See Q-0038, and Q-0034 for the deferral itself, found the day the Q-0006 preflight met the
  // chore flow it was written before.
  //
  // The rule is order-aware on purpose: a ref created only by a LATER step (integrate's target,
  // after the review that reads it) can never exist when the diff step runs, so deferring it would
  // just move the failure past a billed step — exactly what the preflight exists to prevent.
  //
  // State the limit rather than implying it is not there: emptiness cannot be discovered before a
  // producer has run, so a deferred range's own emptiness still costs the producing adapter. What
  // that class gets instead is earliest-possible: every ref that is due is proven before anything
  // is billed, the producing adapter may then run and the consuming one may not, and a range that
  // is malformed or out of class is caught with no run at all by the input.diff rule in lintFlow.
  // See Q-0035 (OQ-1).
  {
    // ref → the id of the earliest step that creates it. A Set answered "is this deferred?"; the
    // map also answers "deferred waiting on whom?", which is what lets a deferred range that turns
    // out empty at step time tell the reader the implementer committed nothing rather than that a
    // branch is missing. See Q-0035.
    const createdSoFar = new Map();
    const remember = (ref, stepId) => { if (!createdSoFar.has(ref)) createdSoFar.set(ref, stepId); };
    for (const group of flow.steps) {
      const members = group.parallel ?? [group];
      // Judge every diff in the group against branches created strictly before the group: a
      // parallel sibling's branch is concurrent, not earlier.
      for (const { site, perTask } of members.flatMap(diffSitesOf)) {
        const written = String(site.input.diff);
        const range = interpolate(written, ctx.vars);
        const endpoints = classifyEndpoints(range, createdSoFar, perTask);
        if (endpoints.every((endpoint) => endpoint.class === 'pre-existing')) {
          if (!ctx.diffInputs.has(range)) ctx.diffInputs.set(range, materialiseDiff(site, ctx));
          continue;
        }
        const producers = endpoints.filter((endpoint) => endpoint.class === 'step-created');
        // A half-interpolated key can never be looked up at step time, so recording one would be a
        // record nothing reads. `ref` and `step` mirror the first producer left to right, because
        // an empty deferred range names one owed branch and always did; `producers` is what lets a
        // failure name every step that owed an endpoint. See Q-0035, Q-0038.
        if (producers.length && !endpoints.some((endpoint) => endpoint.class === 'template')) {
          ctx.deferredDiffs.set(range, { ref: producers[0].ref, step: producers[0].step, producers });
        }
        // Every endpoint that is due is proven now, where it costs nothing — one endpoint being
        // owed by a later step says nothing about the other. See Q-0038.
        for (const endpoint of endpoints) {
          if (endpoint.class !== 'pre-existing' || shortSha(ctx.repoDir, endpoint.ref) != null) continue;
          throw missingEndpointFailure(site, ctx, {
            side: endpoint.side, ref: endpoint.ref, range, written, base: ctx.vars.base,
            clauses: [notDueClause(endpoints.find((other) => other !== endpoint), site)],
          });
        }
      }
      for (const s of members) {
        if (s.worktree) remember(interpolate(s.branch ?? `harness/${ctx.ticket.meta.id}/${s.id}`, ctx.vars), s.id);
        if (s.type === 'integrate' && s.into) remember(interpolate(s.into, ctx.vars), s.id);
      }
    }
  }
  while (i < steps.length) {
    const step = steps[i];
    const res = await runStep(step, ctx);
    if (res?.goto) {
      const target = res.goto;
      if (target.startsWith('flow:')) {
        // Cross-flow backward edge: regress the ticket's stage; the target flow picks it up next.
        const targetFlow = loadFlowByName(target.slice(5), harnessDir);
        ui.warn(`backward edge → ${target}: ticket regresses to stage "${targetFlow.consumes}"`);
        return finish(ctx, targetFlow.consumes, 'regressed', null, {
          targetFlow: targetFlow.name, stageBefore: ticket.meta.stage, stageAfter: targetFlow.consumes,
          counter: res.counter,
          count: ctx.counters[res.counter], limit: res.limit,
          remaining: Math.max(0, (res.limit ?? 0) - (ctx.counters[res.counter] ?? 0)),
        });
      }
      i = steps.findIndex((s) => s.id === target || (s.parallel && s.parallel.some((p) => p.id === target)));
      ctx.vars.iter += 1;
      continue;
    }
    if (res?.abort) return finish(ctx, ticket.meta.stage, 'aborted');
    i += 1;
  }
  } catch (e) {
    // A failed run is part of the ticket's history: record it before it propagates, so runs.log
    // never shows a run that started and then simply stopped existing. See Q-0001.
    for (const occurrence of ctx.activeOccurrences ?? []) {
      terminalOccurrence(ctx, occurrence, 'failed', { error: { category: occurrence.kind === 'integrate' ? 'integrate' : occurrence.kind === 'script' ? 'script' : 'unknown', message: String(e.message ?? e) } });
    }
    finish(ctx, ticket.meta.stage, 'failed', String(e.message ?? e).split('\n')[0].slice(0, 200));
    throw e;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
  return finish(ctx, flow.produces, 'completed');
}

async function runStep(step, ctx) {
  if (step.parallel) {
    // allSettled, not all: a sibling that fails must not discard work the others already paid
    // for. Each runAgentStep persists its own output, so waiting lets the survivors land and a
    // retry only re-runs what actually failed. See Q-0001.
    const settled = await Promise.allSettled(step.parallel.map((s) => runAgentStep(s, ctx)));
    const failed = settled.map((r, i) => [r, step.parallel[i]]).filter(([r]) => r.status === 'rejected');
    if (failed.length) {
      const survivors = step.parallel.filter((_, i) => settled[i].status === 'fulfilled').map((s) => s.id);
      const detail = failed.map(([r, s]) => `${s.id}: ${r.reason?.message ?? r.reason}`).join('\n  - ');
      throw new FlowError(
        `${failed.length} of ${settled.length} parallel step(s) failed:\n  - ${detail}` +
        (survivors.length ? `\n  kept: ${survivors.join(', ')} (already written to the ticket; a re-run will overwrite them)` : ''),
      );
    }
    return settled.map((r) => r.value).find((r) => r?.goto || r?.abort) ?? null;
  }
  if (step.gate) return runGate(step, ctx);
  if (step.type === 'script') return runScript(step, ctx);
  if (step.type === 'integrate') return runIntegrate(step, ctx);
  if (step.fan_out) return runFanOut(step, ctx);
  return runAgentStep(step, ctx);
}

async function runAgentStep(step, ctx, extra = {}) {
  const { ui, ticket, backlog } = ctx;
  ctx = { ...ctx, vars: { ...ctx.vars, ...(extra.vars ?? {}) } };
  const role = loadRole(step.role, ctx.harnessDir);
  const adapterName = ctx.config.adapterOverride ?? step.adapter ?? role.meta.adapter ?? 'claude';
  const model = resolveModel(step, role, adapterName);
  const adapter = getAdapter(adapterName, ctx.config.adapters);
  const schema = schemaFor(step);
  let cwd = ctx.repoDir;
  let branch = null;
  if (step.worktree && !ctx.dry) {
    branch = interpolate(step.branch ?? `harness/${ticket.meta.id}/${step.id}`, ctx.vars);
    const stepBase = interpolate(step.base ?? ticket.meta.branch, ctx.vars);
    const existed = branchExists(ctx.repoDir, branch);
    cwd = ensureWorktree(ctx.repoDir, branch, stepBase);
    ui.info(`${step.id}: worktree ${cwd} (${branch})`);
    // A branch created on an earlier round is stale: its base has moved on since. Sync whenever
    // it already existed, not only on fan-out retries, or the agent works against yesterday's
    // tree and appears to revert whatever landed since. See Q-0004.
    if (existed || extra.syncBase) {
      if (!branchExists(ctx.repoDir, stepBase)) {
        // Normal on a ticket's first pass: the integration branch is created by the first
        // integrate step, so before that there is nothing to sync to. Not a failure, and not a
        // warning — it used to print one with an empty reason after the colon.
        ui.info(`${step.id}: base ${stepBase} does not exist yet — nothing to sync`);
      } else {
        const m = mergeInto(cwd, stepBase);
        if (m.ok) ui.info(`${step.id}: synced to ${stepBase}`);
        else ui.warn(`${step.id}: could not sync to ${stepBase} — ${mergeFailure(m)}`);
      }
    }
  }
  const prompt = buildPrompt(step, role, ctx) + (extra.promptSuffix?.(cwd) ?? '');

  if (ctx.dry) { ui.step(step.id, `${adapterName}${model ? '/' + model : ''} role=${step.role ?? '-'}`); ui.info(`${step.id}: dry run — prompt ${prompt.length} chars, schema ${Object.keys(schema.properties).join(',')}`); return null; }

  const occurrence = allocateOccurrence(ctx, step, 'adapter', { role: step.role ?? null, adapter: adapterName, model: model ?? null, branch, worktree: cwd === ctx.repoDir ? null : relative(ctx.repoDir, cwd) });
  persistArtifact(ctx, occurrence, 'prompt.txt', prompt);
  ui.step(step.id, `${adapterName}${model ? '/' + model : ''} role=${step.role ?? '-'}`);

  let res;
  try {
    res = await adapter.run({
      prompt, schema, model, cwd,
      extraDirs: [ticket.dir, ctx.harnessDir],
      allowWrite: Boolean(step.worktree),
      maxTurns: step.max_turns ?? 40,
      onEvent: (e) => ui.trace(step.id, e),
    });
  } catch (e) {
    // A step that fails after the vendor has already billed it still cost money. Dropping it makes
    // the roll-up understate exactly where accuracy matters most — one failed review step hid
    // $4.54 of a $10.25 run. Bill it, log it, then let it propagate. See Q-0002.
    countUsage(ctx, e.usage);
    // Always write output.txt, empty when the vendor produced no text. AC-5 and the writer contract
    // require the file to exist for every occurrence; behind `if (e.raw != null)` the most useful
    // case — a failure with nothing to show — was the one that left an empty directory, so a reader
    // could not tell "no output" from "history not written". See Q-0034.
    persistArtifact(ctx, occurrence, 'output.txt', e.raw ?? '');
    terminalOccurrence(ctx, occurrence, 'failed', { attempts: e.attempts ?? 1, usage: normaliseUsage(e.usage, e.vendor ?? adapter.vendor), error: errorOf(e, adapterName) });
    backlog.log(ticket, `run=${ctx.runId} step=${step.id} vendor=${adapterName} model=${model ?? '-'} FAILED cost=${e.usage?.cost_usd ?? '?'} error=${JSON.stringify(String(e.message).split('\n')[0].slice(0, 200))}`);
    throw e;
  }
  countUsage(ctx, res.usage);
  // Stamp billed usage onto the occurrence the moment the vendor returns. Everything below can
  // still throw — the schema check, the artifact writes, the verdict file, an unguarded commitAll —
  // and until this line only terminalOccurrence recorded usage, so a failure anywhere in that
  // stretch filed a call the vendor had already charged as `usage: null` and dropped it from the
  // roll-up. That is the same class as the failed-step billing defect M0 fixed, one layer up.
  // See Q-0034; found by Q-0011 review round 2.
  occurrence.attempts = res.attempts ?? 1;
  occurrence.usage = normaliseUsage(res.usage, res.vendor ?? adapter.vendor);

  const problems = checkAgainstSchema(res.output, schema);
  if (problems.length) {
    persistArtifact(ctx, occurrence, 'output.txt', res.raw ?? '');
    const dump = backlog.writeFile(ticket, `.harness/${step.id}-${Date.now()}.raw.txt`, res.raw ?? '');
    terminalOccurrence(ctx, occurrence, 'failed', { attempts: res.attempts ?? 1, usage: normaliseUsage(res.usage, res.vendor ?? adapter.vendor), error: { category: 'structured_output', message: `${step.id}: structured output invalid (${problems.join('; ')})` } });
    throw new FlowError(`${step.id}: structured output invalid (${problems.join('; ')}). Raw saved to ${dump}`);
  }
  persistArtifact(ctx, occurrence, 'output.txt', res.raw ?? '');

  // Persist outputs declaratively.
  for (const rel of writesOf(step)) {
    const abs = backlog.writeFile(ticket, interpolate(rel, ctx.vars), res.output.document ?? res.raw);
    ui.info(`${step.id}: wrote ${path.relative(ticket.dir, abs)}`);
  }
  if (step.output?.verdict) {
    const vPath = interpolate(step.output.verdict_file ?? `.harness/${step.id}-verdict.json`, ctx.vars);
    backlog.writeFile(ticket, vPath, JSON.stringify({ verdict: res.output.verdict, findings: res.output.findings ?? [], summary: res.output.summary }, null, 2));
  }
  if (branch) {
    const files = commitAll(
      cwd,
      `${step.id}: ${res.output.summary?.slice(0, 60) ?? 'agent changes'} [${ticket.meta.id}]`,
      (dropped) => ui.warn(`${step.id}: discarded ${dropped.length} edit(s) under backlog/ — the engine owns ticket state, not the agent: ${dropped.slice(0, 4).join(', ')}${dropped.length > 4 ? ', …' : ''}`),
    );
    ui.info(`${step.id}: ${files ? files.length + ' file(s) committed on ' + branch : 'no file changes on ' + branch}`);
  }
  backlog.log(ticket, `run=${ctx.runId} step=${step.id} vendor=${res.vendor} model=${model ?? '-'} verdict=${res.output.verdict ?? '-'} cost=${res.usage.cost_usd ?? '?'} ms=${res.ms}`);
  // A vendor that reports no cost is unpriced, not free. Rounding null to $0.000 states a price
  // Quorum does not know — see the tokens-only decision, 2026-08-22.
  ui.done(step.id, `${res.output.verdict ? 'verdict=' + res.output.verdict + ' ' : ''}${formatCost(res.usage)} ${res.ms}ms`);
  terminalOccurrence(ctx, occurrence, 'completed', { attempts: res.attempts ?? 1, verdict: res.output.verdict ?? null, usage: normaliseUsage(res.usage, res.vendor ?? adapter.vendor) });

  // Verdict routing: first enum value = pass; anything else = fail → on_fail.
  if (step.output?.verdict) {
    const passValue = schema.properties.verdict.enum[0];
    if (res.output.verdict !== passValue) {
      ui.warn(`${step.id}: ${res.output.verdict}${res.output.findings?.length ? ' — ' + res.output.findings.join(' | ') : ''}`);
      return handleFail(step, ctx);
    }
  }
  return null;
}

// A merge can fail without conflicting — a missing ref, a dirty tree, a git that simply refuses.
// Reporting only `conflicts` printed "could not sync base:" with nothing after the colon, which
// says a failure happened and withholds the one thing the reader needs. See Q-0011.
export function mergeFailure(m) {
  if (m?.conflicts?.length) return `conflicts: ${m.conflicts.join(', ')}`;
  const line = String(m?.error ?? '').split('\n').map((l) => l.trim()).filter(Boolean)[0];
  return line ? `git: ${line}` : 'git reported no reason';
}

function initialiseRunHistory(ctx) {
  const started = new Date();
  const runId = `${ctx.ticket.meta.id}-${ctx.runId}`;
  const runDir = path.join(ctx.repoDir, '.quorum', 'runs', runId);
  const historyRoot = path.dirname(runDir);
  // Guard one: a stale in-memory ticket snapshot must not fork a second timeline once this writer
  // has persisted history. Compare with the ticket file rather than old outcome entries, because
  // backward edges legitimately make a current stage differ from the preceding outcome's
  // stage_after. This is NOT the run-directory collision refusal below — it is a narrower,
  // separate check that happens to fire first, and conflating the two is what let AC-1 look
  // implemented when it was not. See Q-0034.
  const persistedStage = fs.existsSync(historyRoot)
    ? parseFrontmatter(fs.readFileSync(path.join(ctx.ticket.dir, 'ticket.md'), 'utf8')).meta.stage
    : null;
  if (persistedStage && persistedStage !== ctx.ticket.meta.stage) {
    throw new FlowError(`run directory allocation refused: ticket stage conflicts with persisted run history (${persistedStage} != ${ctx.ticket.meta.stage})`);
  }
  fs.mkdirSync(historyRoot, { recursive: true });
  // Guard two, and the one AC-1 actually asks for: the run directory must not already exist.
  // `recursive: false` was already doing the detection; nothing translated the errno, so a genuine
  // collision surfaced as a raw EEXIST stack trace from bin/harness.js instead of a refusal a
  // reader can act on. Two runs holding one ticket is a real state — M1 saw it twice — and it must
  // stop the run by name. See Q-0034.
  try {
    fs.mkdirSync(runDir, { recursive: false });
  } catch (e) {
    if (e.code === 'EEXIST') {
      // State only what is provable. An earlier draft of this message said "another run may be in
      // flight", which the round-2 review showed is not how ids are allocated: nextRunId reads the
      // `start` line, written before this directory is created, so a genuinely concurrent run takes
      // the next id rather than colliding. What is left is a directory outliving its log line, or a
      // sub-second race — and this guard does not make the engine safe for concurrent runs, which
      // remains an open M1 item. See Q-0034.
      throw new FlowError(`run directory allocation refused: ${relative(ctx.repoDir, runDir)} already exists. Run ids are allocated from runs.log, so a directory without a matching log line usually means an interrupted run whose runs.log was truncated or restored from an older copy — or a second run started within the same second. Move or delete that directory to re-use the id.`);
    }
    throw new FlowError(`run directory allocation refused: could not create ${relative(ctx.repoDir, runDir)} (${e.message})`);
  }
  fs.mkdirSync(path.join(runDir, 'steps'));
  ctx.history = {
    dir: runDir, started: started.getTime(), sequence: 0,
    manifest: {
      schema_version: 1, run_id: runId, ticket_id: ctx.ticket.meta.id,
      ticket_path: relative(ctx.repoDir, path.join(ctx.ticket.dir, 'ticket.md')),
      flow: ctx.flow.name, flow_file: relative(ctx.repoDir, ctx.flow.file),
      stage: { before: ctx.ticket.meta.stage, after: null }, started_at: started.toISOString(),
      ended_at: null, duration_ms: null, status: 'running', steps: [], rollup: [],
    },
  };
  ctx.activeOccurrences = new Set();
  ensureExcluded(ctx.repoDir, '.quorum/');
  replaceManifest(ctx, { fatal: true });
}

// Monotonic start time per occurrence, deliberately NOT a field on the occurrence itself. Every
// occurrence lives in ctx.history.manifest.steps, and replaceManifest() serialises that whole array
// on each terminal occurrence — so a bookkeeping field stamped on a *still-running* occurrence is
// written into manifest.json and violates run-manifest.schema.json's additionalProperties: false.
// It hid because terminalOccurrence deleted the field just before its own write; any other step's
// write (a parallel sibling finishing first) or a kill in that window persisted it, the latter
// permanently. A side table cannot leak into JSON.stringify at all. See Q-0034.
const occurrenceStart = new WeakMap();

function allocateOccurrence(ctx, step, kind, fields = {}) {
  const seq = ++ctx.history.sequence;
  const safeId = String(step.id).replace(/[/:]/g, '-');
  const occurrenceDir = `steps/${String(seq).padStart(3, '0')}-${safeId}`;
  fs.mkdirSync(path.join(ctx.history.dir, occurrenceDir));
  const occurrence = {
    step_id: String(step.id), occurrence_dir: occurrenceDir, kind,
    role: fields.role ?? null, adapter: fields.adapter ?? null, model: fields.model ?? null,
    branch: fields.branch ?? null, worktree: fields.worktree ?? null,
    started_at: new Date().toISOString(), duration_ms: null, attempts: 0, status: 'running',
    verdict: null, error: null, usage: null,
  };
  occurrenceStart.set(occurrence, Date.now());
  ctx.history.manifest.steps.push(occurrence);
  ctx.activeOccurrences.add(occurrence);
  return occurrence;
}

function terminalOccurrence(ctx, occurrence, status, fields = {}) {
  if (!ctx.activeOccurrences.has(occurrence)) return;
  const started = occurrenceStart.get(occurrence);
  Object.assign(occurrence, fields, {
    status,
    duration_ms: started == null ? 0 : Math.max(0, Date.now() - started),
  });
  ctx.activeOccurrences.delete(occurrence);
  // AC-5 and the writer contract require output.txt for every occurrence, empty if there was no
  // text. Every writer of it sat behind something that could throw first — the adapter path behind
  // `if (e.raw != null)`, and the integrate path at the very end, with the base-sync throw in
  // between, which is the most common integrate failure. terminalOccurrence is the one funnel every
  // outcome passes through, including runFlow's catch and the signal handler, so guaranteeing it
  // here needs no future step type to remember. Guarded like persistArtifact: a broken history
  // directory warns and never discards a step the vendor already billed. See Q-0034.
  const outputPath = path.join(ctx.history.dir, occurrence.occurrence_dir, 'output.txt');
  if (!fs.existsSync(outputPath)) {
    try { fs.writeFileSync(outputPath, ''); }
    catch (e) { ctx.ui.warn(`could not persist run history at ${outputPath}: ${e.message}`); }
  }
  ctx.history.manifest.rollup = rollup(ctx.history.manifest.steps);
  replaceManifest(ctx);
}

function persistArtifact(ctx, occurrence, name, text) {
  const target = path.join(ctx.history.dir, occurrence.occurrence_dir, name);
  try { fs.writeFileSync(target, String(text)); }
  catch (e) { ctx.ui.warn(`could not persist run history at ${target}: ${e.message}`); }
}

function replaceManifest(ctx, { fatal = false } = {}) {
  const target = path.join(ctx.history.dir, 'manifest.json');
  const temporary = `${target}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'w');
    fs.writeFileSync(fd, `${JSON.stringify(ctx.history.manifest, null, 2)}\n`);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, target);
  } catch (e) {
    if (fd != null) try { fs.closeSync(fd); } catch { /* best effort */ }
    if (fatal) throw new FlowError(`could not initialise run history at ${target}: ${e.message}`);
    ctx.ui.warn(`could not persist run history at ${target}: ${e.message}`);
  }
}

function normaliseUsage(usage, fallbackVendor) {
  if (!usage) return null;
  return {
    vendor: usage.vendor ?? fallbackVendor,
    input_tokens: usage.input_tokens ?? null, output_tokens: usage.output_tokens ?? null,
    cached_input_tokens: usage.cached_input_tokens ?? null,
    cache_write_input_tokens: usage.cache_write_input_tokens ?? null,
    cost_usd: usage.cost_usd ?? null,
  };
}

function rollup(steps) {
  const rows = new Map();
  const measures = ['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd'];
  for (const { usage } of steps) {
    if (!usage) continue;
    const row = rows.get(usage.vendor) ?? { vendor: usage.vendor, step_count: 0, unpriced_steps: 0, ...Object.fromEntries(measures.map((k) => [k, null])) };
    row.step_count += 1;
    if (usage.cost_usd == null) row.unpriced_steps += 1;
    for (const key of measures) if (usage[key] != null) row[key] = (row[key] ?? 0) + usage[key];
    rows.set(usage.vendor, row);
  }
  return [...rows.values()];
}

// authError() has already rewritten a vendor's auth noise into one actionable sentence by the time
// a failure reaches here, and its own output does not match the raw vendor patterns it was built
// from. Recognise both: the vendor's original wording via the contract layer, and the rewritten
// forms via this pattern.
const AUTH_REWRITTEN = /login expired or missing|is not available on a .+ subscription|API_KEY is set/i;

// Classification lives in the adapter contract layer (authError/transientError in adapters/index.js),
// where vendor error shapes are already normalised and where a contributor's adapter inherits it for
// free. Re-implementing it here had already drifted three ways: the ChatGPT "model is not supported"
// sentence was filed as `adapter` when authError recognises it; ENOTFOUND, EAI_AGAIN, EPIPE, "fetch
// failed" and "stream interrupted" were absent; and `\b5\d\d\b` called any message containing a
// three-digit number transient — a token count was enough. See Q-0034; found by review round 2.
function errorOf(error, adapterName) {
  const message = String(error.message ?? error);
  const isAuth = AUTH_REWRITTEN.test(message) || authError(adapterName, message) != null;
  const category = isAuth ? 'auth' : transientError(message) != null ? 'transient' : 'adapter';
  return { category, message: message || 'adapter failed' };
}
function relative(root, target) { return path.relative(root, target).split(path.sep).join('/'); }
// commands.timeout_ms in harness.yaml; fifteen minutes suits a spike's own suite.
function cmdTimeout(ctx) { return ctx.config.commands?.timeout_ms ?? 15 * 60_000; }

// The report used to be the last 8000 characters of output, which cuts off the head: on a large
// suite seven of nineteen failing groups had no line at all, and the reviewer judging the red
// phase never saw them. Keep every result line — they are what the report is for — and truncate
// only the payload in the middle, saying so where the cut is. See Q-0033.
const RESULT_LINE = /^\s*(?:\x1b\[[0-9;]*m)*\s*(?:[✓✗×√]|(?:not )?ok\s|#\s|\d+\)\s|(?:PASS|FAIL|SKIP)\b)/;

export function testReport(cmd, out, { maxBytes = 24000 } = {}) {
  const lines = String(out ?? '').split('\n');
  const results = lines.filter((l) => RESULT_LINE.test(l));
  const body = String(out ?? '');
  const kept = body.length <= maxBytes
    ? body
    : `${body.slice(0, maxBytes / 2)}\n\n… ${body.length - maxBytes} characters of output omitted from the middle …\n\n${body.slice(-maxBytes / 2)}`;
  const roster = results.length
    ? `\n## Every result line\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`
    : '\n_No lines in the output looked like test results._\n';
  return `# Test output\n\n\`${cmd}\`\n${roster}\n## Output\n\n\`\`\`\n${kept}\n\`\`\`\n`;
}

function safeMergeBase(repo, a, b) {
  try { return execFileSync('git', ['merge-base', a, b], { cwd: repo, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function countUsage(ctx, usage) {
  if (!usage) return;
  // Tokens are comparable across vendors; money is not. Count an unpriced step so the run can
  // say how much of its total it could not see. See the tokens-only decision, 2026-08-22.
  if (usage.cost_usd == null) ctx.stats.unpriced += 1;
  ctx.stats.cost += usage.cost_usd ?? 0;
  ctx.stats.tokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
}

// Money where the vendor reports it, tokens where it does not. Never both, never a guess.
export function formatCost(usage) {
  if (usage?.cost_usd != null) return `cost=$${usage.cost_usd.toFixed(3)}`;
  const t = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);
  return `cost=n/a (${t} tokens, vendor reports no price)`;
}

function handleFail(step, ctx) {
  const f = step.on_fail;
  const counter = f.counter ?? `${ctx.flow.name}.${step.id}`;
  const n = (ctx.counters[counter] ?? 0) + 1;
  ctx.counters[counter] = n;
  if (n <= f.max_iterations) {
    ctx.ui.warn(`${step.id}: iteration ${n}/${f.max_iterations} → goto ${f.goto}`);
    return { goto: f.goto, counter, limit: f.max_iterations };
  }
  ctx.ui.warn(`${step.id}: loop exhausted (${f.max_iterations}) → human gate`);
  recordEvent(ctx, ctx.ticket.meta.stage, 'exhausted', 0);
  return runGate({
    gate: 'human-locked',
    reason: `loop exhausted at ${step.id} (${counter} = ${n}, limit ${f.max_iterations}); choose: advance (accept as is), retry (exactly one more ${f.goto}), abort`,
    retryTarget: f.goto, retryCounter: counter, retryMax: f.max_iterations,
  }, ctx);
}

async function runGate(step, ctx) {
  const kind = step.gate;
  if (kind === 'auto' || (ctx.auto && kind !== 'human-locked')) { ctx.ui.info(`gate: auto-advanced (${kind})`); return null; }
  if (ctx.dry) { ctx.ui.info(`gate (${kind}): would pause here`); return null; }
  // A custom UI can represent a gate with a promise that owns no libuv handle. Give a signal a
  // short window to reach the synchronous finaliser, while still allowing an EOF-backed CLI gate
  // to terminate naturally instead of keeping a non-interactive process alive forever.
  //
  // Known limitation, kept deliberately rather than silently (Q-0011 review round 2). Neither
  // shipped gate path needs this: a TTY gate owns a readline handle, and a non-interactive gate
  // throws before awaiting. So in practice it keeps only a test fixture alive, and after the second
  // elapses the loop can drain and the process exit 0 with the manifest still reading "running".
  // Removing it belongs with giving that fixture a promise owning its own handle, which means
  // editing spike/test/** — qa-red's artifact, frozen by AC-4. Tracked, not resolved.
  const signalWindow = setTimeout(() => {}, 1000);
  let answer;
  try {
    answer = await ctx.ui.gate({ kind, reason: step.reason ?? step.prompt ?? `${ctx.flow.name}: approve to advance ticket to "${ctx.flow.produces}"`, ticketDir: ctx.ticket.dir, retry: step.retryTarget });
  } finally {
    clearTimeout(signalWindow);
  }
  ctx.backlog.log(ctx.ticket, `run=${ctx.runId} gate=${kind} answer=${answer}`);
  if (answer === 'advance') return null;
  if (answer === 'retry' && step.retryTarget) {
    // Exactly one more traversal, and only for this loop. Setting the counter to max_iterations
    // makes the retry's own goto the grace traversal: the next failure increments past the limit
    // and re-presents this gate. Clearing every counter (the old behaviour) refunded unrelated
    // loops a ticket had already spent — a qa budget restored by a review retry — and granted
    // max_iterations+1 further traversals rather than one. See Q-0004 / DECISIONS 2026-08-22.
    if (step.retryCounter != null) ctx.counters[step.retryCounter] = step.retryMax;
    ctx.backlog.log(ctx.ticket, `run=${ctx.runId} gate=retry counter=${step.retryCounter} set=${step.retryMax} (one further traversal authorised)`);
    return { goto: step.retryTarget, counter: step.retryCounter, limit: step.retryMax };
  }
  return { abort: true };
}

async function runScript(step, ctx) {
  const cmd = interpolate(step.run, ctx.vars);
  ctx.ui.step(step.id, `script: ${cmd}`);
  if (ctx.dry) return null;
  // Both sides of this merge were needed: the ticket records the occurrence, main enforces the
  // timeout. A script step runs a project's own command and can hang exactly as a suite can.
  const occurrence = allocateOccurrence(ctx, step, 'script');
  const r = runCommand(cmd, ctx.repoDir, { timeoutMs: cmdTimeout(ctx) });
  persistArtifact(ctx, occurrence, 'output.txt', r.out);
  if (step.output?.write) ctx.backlog.writeFile(ctx.ticket, interpolate(step.output.write, ctx.vars), r.out);
  if (r.code === 0) {
    terminalOccurrence(ctx, occurrence, 'completed');
    ctx.ui.done(step.id, 'exit 0');
    return null;
  }
  if (r.timedOut) {
    // Looping back cannot fix a command that never finishes, and its non-zero exit is not a result.
    terminalOccurrence(ctx, occurrence, 'failed', { error: { category: 'script', message: `${step.id}: script timed out` } });
    throw new FlowError(`${step.id}: script did not finish within ${Math.round((r.timeoutMs ?? 0) / 60000)} minutes and was killed — that is not a result, fix the command or raise commands.timeout_ms`);
  }
  terminalOccurrence(ctx, occurrence, 'failed', { error: { category: 'script', message: `${step.id}: script exited ${r.code}` } });
  ctx.ui.warn(`${step.id}: exit ${r.code}`);
  return step.on_fail ? handleFail(step, ctx) : { abort: true };
}

function finish(ctx, stage, status, note, fields = {}) {
  const { ticket, backlog } = ctx;
  const from = ticket.meta.stage;
  ticket.meta.iterations = ctx.counters;
  if (status === 'completed' || status === 'regressed') {
    ticket.meta.stage = stage;
  }
  if (ctx.history) {
    const ended = new Date();
    Object.assign(ctx.history.manifest, {
      status, ended_at: ended.toISOString(), duration_ms: Math.max(0, ended.getTime() - ctx.history.started),
      stage: { before: ctx.history.manifest.stage.before, after: ticket.meta.stage },
      rollup: rollup(ctx.history.manifest.steps),
    });
    replaceManifest(ctx);
  }
  ticket.meta.history = [...(ticket.meta.history ?? []), outcome(ctx, from, ticket.meta.stage, status, round(ctx.stats.cost))];
  // A run that did not complete leaves the ticket branch as it found it. integrate merges task
  // branches before anyone knows the outcome, and an exhausted or aborted run used to leave those
  // merges behind for good — so the next qa-red measured its red phase against a tree that already
  // contained the implementation, and reported 21 green and nothing red. Nothing is lost: each
  // task's work stays on its own branch. See Q-0033.
  if (!ctx.dry && !['completed', 'regressed'].includes(status) && ctx.branchHeadAtStart) {
    const now = branchHead(ctx.repoDir, ticket.meta.branch);
    if (now && now !== ctx.branchHeadAtStart) {
      resetBranchTo(ctx.repoDir, ticket.meta.branch, ctx.branchHeadAtStart);
      ctx.ui.warn(`${ticket.meta.branch}: rolled back to ${ctx.branchHeadAtStart.slice(0, 7)} — a run that did not complete leaves the ticket branch as it found it`);
      backlog.log(ticket, `run=${ctx.runId} rolled-back branch=${ticket.meta.branch} from=${now.slice(0, 7)} to=${ctx.branchHeadAtStart.slice(0, 7)}`);
    }
  }
  backlog.write(ticket);
  backlog.log(ticket, `run=${ctx.runId} ${status} stage=${from}→${ticket.meta.stage} cost=${round(ctx.stats.cost)} tokens=${ctx.stats.tokens}${note ? ` error=${JSON.stringify(note)}` : ''}`);
  const partial = ctx.stats.unpriced ? `  (+${ctx.stats.unpriced} unpriced step${ctx.stats.unpriced > 1 ? 's' : ''} — vendor reports no price)` : '';
  ctx.ui.info(`run #${ctx.runId} ${status}: ${from} → ${ticket.meta.stage}   cost $${round(ctx.stats.cost)}  tokens ${ctx.stats.tokens}${partial}`);
  return { status, stage: ticket.meta.stage, cost: ctx.stats.cost, runId: ctx.runId, ...fields };
}

function outcome(ctx, before, after, status, cost) {
  return { stage: after, run: ctx.runId, flow: ctx.flow.name, status, stage_before: before, stage_after: after, at: new Date().toISOString(), cost };
}

function recordEvent(ctx, stage, status, cost) {
  ctx.ticket.meta.iterations = ctx.counters;
  ctx.ticket.meta.history = [...(ctx.ticket.meta.history ?? []), outcome(ctx, stage, stage, status, cost)];
  ctx.backlog.write(ctx.ticket);
  ctx.backlog.log(ctx.ticket, `run=${ctx.runId} ${status} stage=${stage}→${stage} cost=${cost}`);
}

// A role's default model belongs to the role's own vendor. Inheriting it across adapters sends
// e.g. "opus" to codex, which fails or silently degrades. The step always wins; a role default is
// inherited only when the vendor matches; otherwise let the CLI pick a model its login supports.
// See Q-0001.
export function resolveModel(step, role, adapterName) {
  if (step.model) return step.model;
  const roleAdapter = role.meta?.adapter;
  if (roleAdapter && roleAdapter !== adapterName) return undefined;
  return role.meta?.model;
}

// ---------- prompt + schema ----------

export function schemaFor(step) {
  const props = { summary: { type: 'string', description: 'One paragraph: what you did and why.' } };
  const required = ['summary'];
  if (writesOf(step).length) { props.document = { type: 'string', description: 'The full markdown document to be written to the backlog.' }; required.push('document'); }
  if (step.output?.verdict) {
    props.verdict = { type: 'string', enum: String(step.output.verdict).split('|') };
    const items = props.verdict.enum.includes('changes-requested')
      ? { type: 'string', pattern: '^(blocker|major|nit): .+:[1-9][0-9]* .+' }
      : { type: 'string' };
    props.findings = { type: 'array', items, description: 'Concrete, actionable findings. With the first verdict, only findings prefixed "nit: " are permitted.' };
    required.push('verdict', 'findings');
  }
  return { type: 'object', properties: props, required, additionalProperties: false };
}

export function buildPrompt(step, role, ctx) {
  const { ticket, backlog, harnessDir } = ctx;
  const parts = [];
  parts.push(`# Role: ${step.role ?? 'agent'}`);
  parts.push(role.body.trim() || '(no role description)');
  parts.push(`\n# Ticket ${ticket.meta.id}: ${ticket.meta.title}\nStage: ${ticket.meta.stage}. Iteration: ${ctx.vars.iter}.\n\n${ticket.body.trim()}`);
  for (const h of step.input?.harness ?? []) {
    const f = path.join(harnessDir, h);
    if (fs.existsSync(f)) parts.push(`\n## Input: harness/${h}\n\n${fs.readFileSync(f, 'utf8').trim()}`);
  }
  for (const b of step.input?.backlog ?? []) {
    for (const { rel, text } of backlog.readFiles(ticket, interpolate(b, ctx.vars))) parts.push(`\n## Input: backlog/${ticket.folder}/${rel}\n\n${text.trim()}`);
  }
  if (step.input?.repo) parts.push(`\n## Repository\n\nYou are running inside the repository at your working directory. Inspect it as needed.${step.worktree ? ' You MAY write files; this is an isolated worktree on its own branch.' : ' Do NOT modify files.'}`);
  if (step.input?.diff) {
    const range = interpolate(step.input.diff, ctx.vars);
    // Absent from diffInputs means the preflight deferred this range: an endpoint is created by an
    // earlier step of this flow. In a real run that step has run by now and the branch exists; in
    // a dry run worktree steps create nothing, so the range is honestly unmaterialisable and gets
    // a placeholder rather than a missing-ref failure — a preview must not demand branches only a
    // paid run produces. See Q-0034.
    parts.push(ctx.diffInputs?.get(range) ?? (ctx.dry
      ? `\n## Diff to review\n\n(dry run: \`${range}\` is produced by an earlier step of this flow and is materialised when that step has run)`
      : materialiseDiff(step, ctx)));
  }
  if (step.instructions) parts.push(`\n# Task\n\n${step.instructions.trim()}`);
  const outs = writesOf(step).map((w) => interpolate(w, ctx.vars));
  parts.push(`\n# Output contract\n\nRespond ONLY with a JSON object matching the provided schema.${outs.length ? ` Put the complete markdown document in "document" (it will be saved as ${outs.join(', ')}).` : ''}${step.output?.verdict ? ` Set "verdict" to one of: ${step.output.verdict}. The first option means pass.` : ''}`);
  return parts.join('\n');
}

// ---------- helpers ----------

export function loadRole(name, harnessDir) {
  if (!name) return { meta: {}, body: '' };
  const f = path.join(harnessDir, 'roles', `${name}.md`);
  if (!fs.existsSync(f)) throw new FlowError(`role "${name}" not found at ${f}`);
  return parseFrontmatter(fs.readFileSync(f, 'utf8'));
}

export function loadFlowByName(name, harnessDir) {
  return loadFlow(path.join(harnessDir, 'flows', `${name}.yaml`));
}

export { flattenSteps } from './lint.js';
export function writesOf(step) { const o = step.output ?? {}; return [...(o.write ? [o.write] : []), ...(o.writes ?? [])]; }
export function interpolate(s, vars) { return String(s).replace(/\{([\w.]+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)); }
// History only gains an entry when a run completes or regresses, so deriving the id from it alone
// hands a failed run's number to the next one and the audit trail cannot tell them apart.
// runs.log is the append-only record of every attempt, successful or not. See Q-0001.
function nextRunId(ticket) {
  const fromHistory = (ticket.meta.history ?? []).reduce((m, h) => Math.max(m, h.run ?? 0), 0);
  let fromLog = 0;
  const logPath = path.join(ticket.dir, 'runs.log');
  if (fs.existsSync(logPath)) {
    for (const m of fs.readFileSync(logPath, 'utf8').matchAll(/\brun=(\d+)\b/g)) fromLog = Math.max(fromLog, Number(m[1]));
  }
  return Math.max(fromHistory, fromLog) + 1;
}
function reviewRound(ticket) {
  const dir = path.join(ticket.dir, 'review');
  if (!fs.existsSync(dir)) return 1;
  const completed = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => d.name.match(/^round-(\d+)$/)?.[1]).filter(Boolean).map(Number)
    .filter((n) => fs.existsSync(path.join(dir, `round-${n}`, 'verdict.md')));
  return (completed.length ? Math.max(...completed) : 0) + 1;
}

// A range is named twice wherever it appears — interpolated, so it can be pasted into a terminal,
// and as the flow file writes it, so it can be found in the file that has to change.
const named = (range, written) => `\`${range}\` (flow file: \`${written}\`)`;

// Every place one step of a flow can carry an input.diff. The step itself, and — for a fan_out
// step — its `step:` template, which runFanOut copies into a real step and buildPrompt then reads
// like any other input.diff. Left out of the preflight, a template range escapes it twice over: a
// bad one fails only once the fan-out's own adapters have been billed, and a good one is
// re-materialised by every expanded task, so one range costs n git spawns and the members of a
// wave read evidence resolved at different moments — which is what AC-11's once-per-distinct-range
// rule exists to prevent. lintFlow's diffSites reaches the same site for the same reason, and
// flattenSteps deliberately still does not: the template's id, role and adapter are placeholders
// the duplicate-id, goto and cross_vendor rules must not see. The synthetic id matches the label
// lint uses, so one flow file reads the same in both failures. See Q-0035.
function diffSitesOf(step) {
  return [
    ...(step.input?.diff ? [{ site: step, perTask: false }] : []),
    ...(step.fan_out && step.step?.input?.diff
      ? [{ site: { id: `${step.id}.step`, input: { diff: step.step.input.diff } }, perTask: true }]
      : []),
  ];
}

// What the run-level preflight may ask of each endpoint of an interpolated range, left to right.
// A ref is what can be absent, so a range is judged one endpoint at a time:
//
//   step-created  an earlier group of this flow creates it, so it is not due yet and the range is
//                 deferred to step time. True even when the ref already exists at run start —
//                 bytes captured before its producer ran are that step's PREVIOUS output.
//   template      a fan_out step's `step:` template naming a per-task variable, which has no value
//                 until tasks.yaml is expanded. Only a template can be in this state; an outer
//                 step's unresolved `{…}` is pre-existing and fails like any other ref that does
//                 not resolve.
//   pre-existing  everything else, including a ref only a LATER step creates.
//
// A range that is not exactly two endpoints is malformed, and materialiseDiff's shape guard owns
// that failure: classifying its parts would answer a different question, so none are returned and
// the caller sends it to that guard unchanged. See Q-0038.
function classifyEndpoints(range, createdSoFar, perTask) {
  const refs = range.split('...');
  if (refs.length !== 2) return [];
  return refs.map((ref, index) => ({
    side: index === 0 ? 'left' : 'right',
    ref,
    step: createdSoFar.get(ref) ?? null,
    class: createdSoFar.has(ref) ? 'step-created'
      : perTask && /\{[\w.]+\}/.test(ref) ? 'template'
        : 'pre-existing',
  }));
}

// What the preflight may say about the endpoint that is NOT due, when the other one fails. It is
// not supposed to resolve — its producer has not run — so reporting it as one that does not
// resolve either would be the same category error the diagnosis half exists to remove. Reached
// only for an endpoint whose class is not `pre-existing`, since that is the class that failed.
// See Q-0038.
const notDueClause = (endpoint, site) => endpoint.class === 'step-created'
  ? `the ${endpoint.side} endpoint ${endpoint.ref} is not created until step "${endpoint.step}" runs`
  : `the ${endpoint.side} endpoint ${endpoint.ref} is a per-task template with no value until "${site.id}" expands its tasks`;

// The failure for an endpoint that does not resolve, raised by the run-level preflight and by
// materialiseDiff alike — so which layer noticed does not change what a maintainer reads. The
// three identifying phrases are chosen by the failing endpoint's own class and are matched by
// substring in existing fixtures; `clauses` are the evidence added around them, and are the only
// part the two callers word differently. `base` is the run's effective diff anchor, passed in
// rather than resolved here so that this file keeps one place where that fallback is written down.
// See Q-0035 for the phrases, Q-0038 for the second caller.
function missingEndpointFailure(step, ctx, { side, ref, range, written, clauses, base }) {
  const integration = `harness/${ctx.ticket.meta.id}/integration`;
  const tail = [`it is the ${side} endpoint of ${named(range, written)}`, ...clauses]
    .filter(Boolean).join('; ') + '. Neither the diff nor the containment check was run.';
  if (ref === base) {
    // Keyed on whether a run was GIVEN --base, never on whether its value differs from
    // repo.base_branch: an override may legitimately name the configured value and the maintainer
    // still typed it. An absent field is no override, so a hand-built context keeps the configured
    // wording. Why: supersedes the Q-0006 review-runtime contract for the override path only, per
    // Q-0038 errata E-1.
    return new FlowError(ctx.baseOverride != null
      ? `--base names missing ref "${ref}" — ${tail}`
      : `repo.base_branch in harness/harness.yaml names missing ref "${base}" — ${tail}`);
  }
  if (ref === integration) return new FlowError(`ticket ${ctx.ticket.meta.id}: expected ${integration}; review requires an integrated branch — ${tail}`);
  return new FlowError(`${step.id}: input.diff names missing ref "${ref}" — ${tail}`);
}

export function materialiseDiff(step, ctx) {
  const written = String(step.input.diff);
  const range = interpolate(written, ctx.vars);
  const base = ctx.vars.base ?? ctx.config.repo?.base_branch ?? 'main';
  // The guard forbids a flow file aiming input.diff at refs unrelated to this ticket — a merge
  // commit, another ticket's branch, an arbitrary SHA. It used to demand exactly
  // `{base}...{integration}`, which was the review flow's shape and only that: chore.yaml reviews
  // integration...implement, shipped after this guard was written on Q-0006's branch, and the
  // stale guard rejected the newer flow the day it landed. Both endpoints must be the configured
  // base or one of this ticket's own branches; the guard still composes with a future --base flag,
  // since `base` is ctx.vars.base. See Q-0034.
  const ticketPrefix = `harness/${ctx.ticket.meta.id}/`;
  const [left, right, ...extra] = range.split('...');
  const related = (ref) => ref === base || ref.startsWith(ticketPrefix);
  if (!left || !right || extra.length || !related(left) || !related(right)) {
    throw new FlowError(`${step.id}: input.diff must relate the configured base or this ticket's own branches ("${base}", "${ticketPrefix}…") with "...", got ${range}`);
  }
  // Which endpoint an earlier step of THIS flow was supposed to create, when the preflight deferred
  // this range. Naming that step is the difference between telling the reader a branch is missing
  // and telling them the implementer committed nothing. See Q-0035.
  const deferred = ctx.deferredDiffs?.get(range) ?? null;
  // One spawn per endpoint answers both "does it resolve?" and "to what?" — and the SHA is what
  // makes the failure re-checkable tomorrow, after the branch tips have moved.
  const sha = { left: shortSha(ctx.repoDir, left), right: shortSha(ctx.repoDir, right) };
  for (const side of ['left', 'right']) {
    const ref = side === 'left' ? left : right;
    if (sha[side] != null) continue;
    const other = side === 'left' ? 'right' : 'left';
    const otherRef = other === 'left' ? left : right;
    throw missingEndpointFailure(step, ctx, {
      side, ref, range, written, base,
      clauses: [
        sha[other] != null
          ? `the ${other} endpoint ${otherRef} resolves to ${sha[other]}`
          : `the ${other} endpoint ${otherRef} does not resolve either`,
        // Which step owed which ref, whichever endpoint went bad. The failing endpoint's own
        // producer is named as the step that was expected to create it; a producer of the OTHER
        // endpoint explains why the range was deferred and is never phrased as owing the ref that
        // failed, because no step owed that one. Both are kept when both endpoints were deferred,
        // so a reversal of endpoint order cannot hide either. See Q-0038.
        ...(deferred?.producers ?? []).map((producer) => producer.ref === ref
          ? `step "${producer.step}" was expected to create ${producer.ref}`
          : `the range was deferred waiting for step "${producer.step}" to create ${producer.ref}`),
      ],
    });
  }
  const stat = execFileSync('git', ['diff', '--stat', range], { cwd: ctx.repoDir, encoding: 'utf8' });
  if (!stat.trim()) throw new FlowError(emptyRangeFailure({ step, written, range, left, right, sha, deferred, ctx }));
  const full = execFileSync('git', ['diff', range], { cwd: ctx.repoDir });
  const limit = ctx.config.repo?.max_diff_bytes ?? 200000;
  let bytes = full; let truncated = bytes.length > limit;
  if (truncated) {
    bytes = bytes.subarray(0, limit);
    bytes = trimIncompleteUtf8Suffix(bytes);
    ctx.backlog.log(ctx.ticket, `run=${ctx.runId} diff truncated range=${range} limit=${limit} kept=${bytes.length}`);
  }
  const notice = truncated ? `\n\n## Truncation notice\n\nPatch truncated to ${bytes.length} UTF-8 bytes (configured limit ${limit}).` : '';
  return `\n## Diff to review\n\n### git diff --stat ${range}\n\n${stat.trim()}\n\n## Patch (${range})\n\n${bytes.toString('utf8')}${notice}`;
}

// An empty range is never a reviewable state, and it must not be one silently: Q-0006's review run
// 10 paid two vendors $5.023 to read zero bytes and returned a verdict the engine acted on. That
// the run stops is settled. What it stops WITH is Q-0035's subject.
//
// The message this replaced reported a historical event — that the right endpoint was "already
// merged into" the left — from an ancestry check, which establishes a relationship between two
// commits and says nothing about the route by which it arose. It named no SHA, so it could not be
// re-checked once the branch tips moved, which is exactly when someone wants to. And it recommended
// pointing input.diff at the merge commit, which the guard forty lines above refuses.
//
// So: name the range as written and as interpolated, both endpoints with the short SHA each
// resolved to, the check verbatim, and its outcome — then assert nothing git did not return. Four
// outcomes, each tied to an exit code and to nothing else; every further branch would be a new
// claim that can be wrong in the way this function exists to stop being wrong.
//
// Vocabulary is the board's, settled on 2026-08-24 and recorded under Containment in the glossary:
// "contained", never "merged", "landed" or "shipped". `merge-base` survives because it is the name
// of the command being quoted and of the commit a three-dot range is defined against.
function emptyRangeFailure({ step, written, range, left, right, sha, deferred, ctx }) {
  const { check, sameTree } = emptyRangeEvidence(ctx.repoDir, left, right);
  const outcome = check.state === 'contained' ? 'contained'
    : check.state === 'not-contained' ? 'not contained'
    : `indeterminate (${check.reason}${check.detail ? `: ${check.detail}` : ''})`;
  const committed = deferred
    ? `check that step "${deferred.step}" committed its work to ${deferred.ref}`
    : `check that the ticket's work was committed to ${right}`;
  const [diagnosis, remedy] = check.state === 'contained'
    ? [`${right} is contained in ${left}, so the range spans no commits. That is a relationship between the two commits above, not a record of how it came about.`,
       // "Review it before it becomes contained" is the right next move only when the endpoint
       // pre-dates the run. For a range this run deferred, the endpoint was created moments ago by
       // a step of this very flow, so it never *became* contained — it started that way, because
       // that step committed nothing. Sending the reader to review earlier would be advice about a
       // state that never arose, which is the misdirection AC-9 exists to prevent. See Q-0035.
       deferred ? committed : `review ${right} before it becomes contained in ${left}`]
    : check.state === 'indeterminate'
      ? [`git could not answer whether ${right} is contained in ${left}, so this failure reports the emptiness and claims nothing further.`,
         `re-run the check above and fix whatever stopped git answering`]
      : [`${right} is not contained in ${left}, and the range is still empty.`
         + (sameTree === true ? ` ${left} and ${right} are different commits holding identical trees.`
           : sameTree === false ? ` ${right} adds nothing since its merge base with ${left}.`
             : ''),
         committed];
  return [
    `${step.id}: ${named(range, written)} is empty — git diff --stat printed nothing.`,
    `  left endpoint   ${left} = ${sha.left}`,
    `  right endpoint  ${right} = ${sha.right}`,
    deferred ? `  produced by     step "${deferred.step}", which was expected to create ${deferred.ref}` : null,
    `  containment     \`${check.command}\` → ${outcome}`,
    `  ${diagnosis}`,
    `  Remedy: ${remedy}.`,
  ].filter(Boolean).join('\n');
}

function trimIncompleteUtf8Suffix(bytes) {
  if (!bytes.length) return bytes;
  let lead = bytes.length - 1;
  while (lead >= 0 && (bytes[lead] & 0xc0) === 0x80) lead -= 1;
  if (lead < 0) return bytes;
  const first = bytes[lead];
  const width = first < 0x80 ? 1 : first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 1;
  return bytes.length - lead < width ? bytes.subarray(0, lead) : bytes;
}
const round = (n) => Math.round(n * 1000) / 1000;

// ---------- fan_out + integrate ----------

// Catch the ticket branch up with the repository's base BEFORE cutting task worktrees from it.
// The worktrees sync to the ticket branch, and integrate syncs the ticket branch to base — so
// with the sync only at the end, every agent works against a base that moves underneath it and
// anything landing on base mid-run surfaces as a conflict nobody in the loop can repair. Q-0006's
// run 11 lost its runtime task that way: engine.js changed on main between fan-out and integrate.
export function syncBaseIntoTicketBranch(step, ctx) {
  const { ui } = ctx;
  const into = interpolate(step.step?.base ?? ctx.ticket.meta.branch, ctx.vars);
  const base = interpolate(ctx.config.repo?.base_branch ?? 'main', ctx.vars);
  if (!base || base === into) return { skipped: 'base is the ticket branch' };
  // Normal on a ticket's first pass: the integration branch is created by the first integrate.
  if (!branchExists(ctx.repoDir, into)) return { skipped: `${into} does not exist yet` };
  if (!branchExists(ctx.repoDir, base)) return { skipped: `${base} does not exist` };
  const m = mergeInto(ticketWorktree(ctx.repoDir, into), base);
  if (m.ok) { ui?.info?.(`${step.id}: ${into} synced to ${base} before fan-out`); return { ok: true }; }
  // Same reasoning as integrate's base conflict: the agents sync to the ticket branch, where
  // nothing is wrong, so they correctly change nothing and the conflict returns unchanged. Stop
  // and name the work rather than spending the iteration budget rediscovering it.
  throw new FlowError(`${step.id}: cannot sync ${into} to ${base} before fan-out — ${mergeFailure(m)}. Resolve it in a worktree on ${into}, commit, and re-run; no agent in this loop can repair a base conflict.`);
}

async function runFanOut(step, ctx) {
  const { ui, ticket } = ctx;
  let tasks = loadTasks(ticket);
  if (step.fan_out.scope === 'failing-tasks-only' && ctx.failingTasks?.size) {
    tasks = scopeToFailing(tasks, ctx.failingTasks);
    ui.warn(`${step.id}: scoped to failing tasks: ${tasks.map((t) => t.id).join(', ')}`);
  }
  if (!tasks.length) throw new FlowError(`${step.id}: no tasks to fan out`);
  if (!ctx.dry) syncBaseIntoTicketBranch(step, ctx);
  const plan = step.fan_out.respect === 'depends_on' ? waves(tasks) : [tasks];
  ui.info(`${step.id}: ${tasks.length} task(s) in ${plan.length} wave(s)`);
  ctx.fanned = ctx.fanned ?? [];
  for (const [w, wave] of plan.entries()) {
    ui.info(`${step.id}: wave ${w + 1}: ${wave.map((t) => `${t.id}(${t.role})`).join(' ')}`);
    const results = await Promise.all(wave.map((task) => {
      const tpl = JSON.parse(JSON.stringify(step.step));
      const vars = taskVars(task);
      tpl.id = interpolate(tpl.id ?? `${step.id}:{task.id}`, { ...ctx.vars, ...vars });
      tpl.role = interpolate(tpl.role ?? 'developer-{role}', vars);
      for (const k of ['adapter', 'model']) if (tpl[k]) tpl[k] = interpolate(tpl[k], vars);
      tpl.worktree = true;
      const roleMeta = loadRole(tpl.role, ctx.harnessDir).meta;
      if (tpl.adapter === '{role.adapter}' || !tpl.adapter) tpl.adapter = roleMeta.adapter ?? 'claude';
      if (tpl.model === '{role.model}' || !tpl.model) tpl.model = roleMeta.model;
      const branch = interpolate(tpl.branch ?? 'harness/{id}/{task.id}', { ...ctx.vars, ...vars });
      ctx.fanned.push({ task: task.id, branch, role: task.role });
      return runAgentStep(tpl, ctx, {
        vars, syncBase: true,
        promptSuffix: (cwd) => taskPromptSection(task, cwd) + (ctx.lastIntegration ? `\n\n## Previous integration result\n\n${ctx.lastIntegration.slice(0, 4000)}` : ''),
      });
    }));
    const bad = results.find((r) => r?.goto || r?.abort);
    if (bad) return bad;
    // Later waves build on earlier ones: merge this wave into the ticket branch now.
    if (plan.length > 1 && w < plan.length - 1) {
      const tw = ticketWorktree(ctx.repoDir, ticket.meta.branch);
      for (const t of wave) { const m = mergeInto(tw, `harness/${ticket.meta.id}/${t.id}`); if (!m.ok) ui.warn(`${step.id}: wave merge conflict on ${t.id}: ${m.conflicts.join(',')}`); }
    }
  }
  return null;
}

async function runIntegrate(step, ctx) {
  const { ui, ticket, backlog } = ctx;
  const into = interpolate(step.into ?? ticket.meta.branch, ctx.vars);
  ui.step(step.id, `integrate → ${into}`);
  if (ctx.dry) return null;
  const occurrence = allocateOccurrence(ctx, step, 'integrate');
  const dir = ticketWorktree(ctx.repoDir, into);
  // Branch list: explicit, or a glob resolved against fan-out results / existing branches.
  const pattern = interpolate(step.branches, ctx.vars);
  let branches;
  if (Array.isArray(step.branches)) branches = step.branches.map((b) => interpolate(b, ctx.vars));
  else if (pattern.includes('*')) branches = (ctx.fanned ?? []).map((f) => f.branch).filter((b, i, a) => a.indexOf(b) === i);
  else branches = [pattern];
  branches = branches.filter((b) => branchExists(ctx.repoDir, b));
  const notes = [`# Integration — run ${ctx.runId}, iteration ${ctx.vars.iter}`, '', `Target: \`${into}\``, ''];
  // Evidence about this run, recorded once so a scenario never has to assert it. A fact true only
  // during the red phase is not an acceptance test: QA smuggled branch-cleanliness into an
  // assertion because there was nowhere else to put it, and that test could never go green.
  // See the "a red test is a permanent acceptance test" decision, 2026-08-23.
  {
    const base = interpolate(ctx.config.repo?.base_branch ?? 'main', ctx.vars);
    const head = branchHead(ctx.repoDir, into);
    notes.push(`Evidence: \`${into}\` at ${head ? head.slice(0, 7) : '(new)'}, base \`${base}\`.`);
    for (const b of (Array.isArray(step.branches) ? step.branches.map((x) => interpolate(x, ctx.vars)) : [])) {
      const mb = safeMergeBase(ctx.repoDir, into, b);
      if (mb) notes.push(`Evidence: \`${b}\` diverges from \`${into}\` at ${mb.slice(0, 7)}.`);
    }
    notes.push('');
  }
  const conflicts = [];
  // Catch the ticket branch up with the repository's base branch first. A ticket open for more
  // than a day otherwise integrates against the base it was cut from, and work landed on the base
  // in the meantime looks like the ticket reverting it. See Q-0004.
  const base = interpolate(ctx.config.repo?.base_branch ?? 'main', ctx.vars);
  if (base && base !== into && branchExists(ctx.repoDir, base)) {
    const m = mergeInto(dir, base);
    notes.push(`- ${m.ok ? '✓' : '✗'} base \`${base}\`${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    ui[m.ok ? 'info' : 'warn'](`${step.id}: ${m.ok ? 'synced base' : 'could not sync base'} ${base}${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    if (!m.ok) {
      // A base conflict is between the ticket branch and the base — not between the task branches,
      // and not something another developer round can repair: the task worktrees sync to the
      // ticket branch, where nothing is wrong, so the agents correctly change nothing and the
      // conflict returns unchanged. Q-0011 spent its whole budget and $8.63 discovering that three
      // times. Stop and name the work a human has to do. See Q-0011.
      for (const w of writesOf(step)) backlog.writeFile(ticket, interpolate(w, ctx.vars), notes.join('\n'));
      backlog.log(ticket, `run=${ctx.runId} step=${step.id} base-conflict base=${base} files=${m.conflicts.join(',') || '?'}`);
      throw new FlowError(
        `${step.id}: cannot sync ${into} with ${base} — ${mergeFailure(m)}.\n` +
        `  This is a conflict between the ticket branch and ${base}, so re-running the developers cannot fix it:\n` +
        `  their worktrees branch from ${into}, where nothing is wrong. Merge ${base} into ${into} yourself, then re-run.`,
      );
    }
  }
  for (const b of branches) {
    const m = mergeInto(dir, b);
    notes.push(`- ${m.ok ? '✓' : '✗'} ${b}${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    ui[m.ok ? 'info' : 'warn'](`${step.id}: ${m.ok ? 'merged' : 'FAILED'} ${b}${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    if (!m.ok) conflicts.push(b);
  }
  let testsOk = true; let out = ''; let envError = null;
  const cmd = step.run_tests === true ? ctx.config.commands?.test ?? 'npm test' : step.run_tests ? interpolate(step.run_tests, { ...ctx.vars, ...flatten(ctx.config.commands ?? {}, 'cmd') }) : null;
  // A worktree is a fresh checkout with no node_modules. Without this the test command dies on a
  // missing dependency, which `expect: fail` happily reads as proof of red. See Q-0004.
  const install = cmd ? ctx.config.commands?.install : null;
  if (install && !conflicts.length) {
    const r = runCommand(install, dir, { timeoutMs: cmdTimeout(ctx) });
    notes.push('', `Install: \`${install}\` → exit ${r.code}`);
    ui[r.code === 0 ? 'info' : 'warn'](`${step.id}: install exit ${r.code}`);
    if (r.code !== 0) { envError = `install failed (\`${install}\` exited ${r.code})`; out = r.out; }
  }
  if (cmd && !conflicts.length && !envError) {
    const r = runCommand(cmd, dir, { timeoutMs: cmdTimeout(ctx) });
    out = r.out;
    const expect = step.expect ?? 'pass';
    // A command killed for running too long proves nothing — least of all a red phase.
    const broken = r.timedOut
      ? `the test command did not finish within ${Math.round((r.timeoutMs ?? 0) / 60000)} minutes and was killed`
      : environmentFailure(out);
    if (broken) {
      // Non-zero because the suite could not start is not a red phase. Accepting it would let a
      // missing dependency satisfy `expect: fail` on every ticket, forever.
      envError = `the suite never ran — ${broken}`;
      testsOk = false;
    } else {
      testsOk = expect === 'fail' ? r.code !== 0 : r.code === 0;
    }
    notes.push('', `Tests: \`${cmd}\` → exit ${r.code} (expected ${expect}) → ${envError ? 'INVALID' : testsOk ? 'OK' : 'NOT OK'}`);
    ui[testsOk ? 'info' : 'warn'](`${step.id}: tests exit ${r.code}, expected ${expect}${envError ? ' — ' + envError : ''}`);
  }
  for (const w of writesOf(step)) backlog.writeFile(ticket, interpolate(w, ctx.vars), w.includes('report') ? testReport(cmd, out) : notes.join('\n'));
  persistArtifact(ctx, occurrence, 'output.txt', out);
  backlog.log(ticket, `run=${ctx.runId} step=${step.id} merged=${branches.length - conflicts.length}/${branches.length} tests=${cmd ? (envError ? 'invalid' : testsOk ? 'ok' : 'fail') : '-'}`);
  // Looping back to the author cannot fix a broken environment, so stop with the reason rather
  // than burning the step's iteration budget on it.
  if (envError) {
    terminalOccurrence(ctx, occurrence, 'failed', { error: { category: 'integrate', message: `${step.id}: ${envError}` } });
    throw new FlowError(`${step.id}: ${envError}. The report is on disk, but it is not evidence of anything — fix the environment (commands.install in harness.yaml) and re-run.`);
  }
  if (conflicts.length || !testsOk) {
    terminalOccurrence(ctx, occurrence, 'failed', { error: { category: 'integrate', message: conflicts.length ? `${step.id}: integration conflicts: ${conflicts.join(', ')}` : `${step.id}: tests did not meet expectation` } });
    ctx.lastIntegration = notes.join('\n') + '\n\n' + out.slice(-3000);
    // Failing set: conflicted tasks; if tests failed without conflicts, every fanned task (the agents get the test output).
    const byBranch = new Map((ctx.fanned ?? []).map((f) => [f.branch, f.task]));
    ctx.failingTasks = new Set(conflicts.length ? conflicts.map((b) => byBranch.get(b)).filter(Boolean) : (ctx.fanned ?? []).map((f) => f.task));
    if (!step.on_fail) return { abort: true };
    return handleFail(step, ctx);
  }
  ui.done(step.id, `${branches.length} branch(es) on ${into}${cmd ? ', tests ' + (step.expect === 'fail' ? 'red as expected' : 'green') : ''}`);
  terminalOccurrence(ctx, occurrence, 'completed');
  ctx.failingTasks = null;
  return null;
}

// Signatures of a suite that could not start, as opposed to one that ran and failed. Deliberately
// narrow: `npm ERR!` is excluded because npm prints it for every ordinary test failure, and a
// false positive here would reject a legitimate red phase. See Q-0004.
const ENV_FAILURES = [
  [/Cannot find package '([^']+)'/, (m) => `missing dependency "${m[1]}"`],
  [/Cannot find module '([^']+)'/, (m) => `missing module "${m[1]}"`],
  [/ERR_MODULE_NOT_FOUND/, () => 'a module could not be resolved'],
  [/\bSyntaxError:\s*(.+)/, (m) => `the test file does not parse (${m[1].trim().slice(0, 80)})`],
  [/: command not found/, () => 'the test command is not installed'],
  [/ERR_REQUIRE_ESM/, () => 'a module was loaded with the wrong module system'],
];

export function environmentFailure(out = '') {
  // Only unhandled output counts. A suite is entitled to *print* these signatures — a test that
  // asserts "a broken environment is not a red phase" names one in its own pass message, and
  // matching that rejected a perfectly good red phase (Q-0004, run 6). A line that reports a test
  // result is proof the suite ran, so it cannot also be proof it never started.
  const text = String(out)
    .split('\n')
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''))          // colour codes hide the leading marker
    .filter((l) => !/^\s*(?:[✓✗×√]|(?:not )?ok\s|#|\d+\)\s)/.test(l))
    .join('\n');
  for (const [re, describe] of ENV_FAILURES) {
    const m = text.match(re);
    if (m) return describe(m);
  }
  return null;
}

function flatten(obj, prefix) { return Object.fromEntries(Object.entries(obj).map(([k, v]) => [`${prefix}.${k}`, v])); }
