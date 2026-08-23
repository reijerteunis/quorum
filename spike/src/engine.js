// Flow engine: stage-chained flows, parallel groups, structured outputs written to the
// backlog, bounded backward edges (on_fail.goto), human gates.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './backlog.js';
import { getAdapter, checkAgainstSchema } from './adapters/index.js';
import { ensureWorktree } from './git.js';
import { loadTasks, waves, taskVars, taskPromptSection, commitAll, mergeInto, runCommand, ticketWorktree, branchExists, IntegrationError } from './fanout.js';

export class FlowError extends Error {}

export function loadFlow(file) {
  const flow = YAML.parse(fs.readFileSync(file, 'utf8'));
  flow.file = file;
  lintFlow(flow);
  return flow;
}

// Static lint: ids unique, goto targets exist, every backward edge bounded, cross-vendor rule.
export function lintFlow(flow) {
  const problems = [];
  const steps = flattenSteps(flow.steps);
  const ids = steps.filter((s) => s.id).map((s) => s.id);
  ids.forEach((id, i) => { if (ids.indexOf(id) !== i) problems.push(`duplicate step id "${id}"`); });
  for (const s of steps) {
    if (s.on_fail) {
      if (!s.on_fail.goto) problems.push(`${s.id}: on_fail without goto`);
      else if (!String(s.on_fail.goto).startsWith('flow:') && !ids.includes(s.on_fail.goto)) problems.push(`${s.id}: goto target "${s.on_fail.goto}" not found`);
      if (!Number.isInteger(s.on_fail.max_iterations)) problems.push(`${s.id}: on_fail needs integer max_iterations`);
      if (s.on_fail.on_exhausted !== 'gate') problems.push(`${s.id}: on_exhausted must be "gate"`);
    }
    if (s.output?.verdict && !s.on_fail && !s.route) problems.push(`${s.id}: has a verdict but no on_fail/route — verdicts must go somewhere`);
    if (s.fan_out && !s.step) problems.push(`${s.id}: fan_out needs a step template`);
    if (s.type === 'integrate' && !s.branches) problems.push(`${s.id}: integrate needs branches`);
  }
  if (flow.cross_vendor === 'required') {
    // producer map: backlog path -> adapter that writes it
    const producer = {};
    for (const s of steps) for (const w of writesOf(s)) producer[w] = s.adapter;
    // Rule: a reviewing/judging step must see at least one input written by another vendor.
    // Single-writer review → writer ≠ reviewer. Judge over N candidates → fine if candidates span vendors.
    for (const s of steps) {
      if (!s.output?.verdict) continue;
      const reviewed = (s.input?.backlog ?? []).flatMap((inp) => Object.keys(producer).filter((p) => globMatch(inp, p)));
      if (reviewed.length && reviewed.every((p) => producer[p] === s.adapter)) {
        problems.push(`${s.id}: every input it judges (${reviewed.join(', ')}) was written by its own vendor (${s.adapter}) — cross_vendor: required`);
      }
    }
  }
  // A bounded loop that never shows its verdict to the step it returns to cannot converge: that
  // step regenerates its output from the same inputs, and the reviewer objects to the same things.
  // qa-red shipped exactly this way and spent $4.45 re-reviewing a file nothing had changed —
  // write-tests committed nothing because it had no idea what was wrong. See Q-0011.
  for (const s of steps) {
    const target = s.on_fail?.goto;
    if (!target || String(target).startsWith('flow:')) continue;   // cross-flow edges regress a stage
    const written = writesOf(s);
    if (!written.length) continue;
    const dest = steps.find((t) => t.id === target);
    if (!dest || dest.fan_out) continue;   // fan_out receives the integration result from the engine
    const receives = dest.input?.backlog ?? [];
    if (!written.some((w) => receives.some((inp) => globMatch(inp, w)))) {
      problems.push(`${s.id}: loops back to "${target}", which never receives ${written.join(', ')} — the loop cannot converge`);
    }
  }
  if (!flow.consumes || !flow.produces) problems.push('flow needs consumes/produces');
  const gates = steps.filter((s) => s.gate);
  if (flow.produces === 'deployed' && !gates.some((g) => g.gate === 'human-locked')) problems.push('deploy flow must contain a human-locked gate');
  if (problems.length) throw new FlowError(`flow ${flow.name ?? flow.file} invalid:\n  - ${problems.join('\n  - ')}`);
  return true;
}

export async function runFlow({ flow, ticket, backlog, harnessDir, repoDir, config, ui, auto = false, dry = false }) {
  if (ticket.meta.stage !== flow.consumes) {
    throw new FlowError(`ticket ${ticket.meta.id} is at stage "${ticket.meta.stage}", flow "${flow.name}" consumes "${flow.consumes}"`);
  }
  const ctx = {
    flow, ticket, backlog, harnessDir, repoDir, config, ui, auto, dry,
    counters: ticket.meta.iterations ?? {}, stats: { cost: 0, tokens: 0, unpriced: 0 }, runId: nextRunId(ticket),
    vars: { id: ticket.meta.id, iter: 1, base: config.repo?.base_branch ?? 'main', round: reviewRound(ticket) },
  };
  ui.info(`run #${ctx.runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}`);
  backlog.log(ticket, `run=${ctx.runId} flow=${flow.name} start stage=${ticket.meta.stage}`);

  // Ctrl-C at a gate used to leave no terminal line in runs.log and no persisted counters, so an
  // interrupted run silently handed its iteration budget back — an undocumented way to buy
  // unlimited retries, which defeats the bound the design rests on. See Q-0004.
  const onSignal = (sig) => {
    try { finish(ctx, ticket.meta.stage, 'interrupted', `received ${sig}`); } catch { /* nothing left to save */ }
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  const steps = flow.steps;
  let i = 0;
  try {
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
          count: ctx.counters.review, limit: res.limit, remaining: Math.max(0, (res.limit ?? 0) - (ctx.counters.review ?? 0)),
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

  ui.step(step.id, `${adapterName}${model ? '/' + model : ''} role=${step.role ?? '-'}`);
  if (ctx.dry) { ui.info(`${step.id}: dry run — prompt ${prompt.length} chars, schema ${Object.keys(schema.properties).join(',')}`); return null; }

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
    backlog.log(ticket, `run=${ctx.runId} step=${step.id} vendor=${adapterName} model=${model ?? '-'} FAILED cost=${e.usage?.cost_usd ?? '?'} error=${JSON.stringify(String(e.message).split('\n')[0].slice(0, 200))}`);
    throw e;
  }
  countUsage(ctx, res.usage);

  const problems = checkAgainstSchema(res.output, schema);
  if (problems.length) {
    const dump = backlog.writeFile(ticket, `.harness/${step.id}-${Date.now()}.raw.txt`, res.raw ?? '');
    throw new FlowError(`${step.id}: structured output invalid (${problems.join('; ')}). Raw saved to ${dump}`);
  }

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

// commands.timeout_ms in harness.yaml; fifteen minutes suits a spike's own suite.
function cmdTimeout(ctx) { return ctx.config.commands?.timeout_ms ?? 15 * 60_000; }

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
    return { goto: f.goto, limit: f.max_iterations };
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
  const answer = await ctx.ui.gate({ kind, reason: step.reason ?? step.prompt ?? `${ctx.flow.name}: approve to advance ticket to "${ctx.flow.produces}"`, ticketDir: ctx.ticket.dir, retry: step.retryTarget });
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
    return { goto: step.retryTarget, limit: step.retryMax };
  }
  return { abort: true };
}

async function runScript(step, ctx) {
  const cmd = interpolate(step.run, ctx.vars);
  ctx.ui.step(step.id, `script: ${cmd}`);
  if (ctx.dry) return null;
  // Through runCommand for the timeout: a script step runs a project's own command and can hang
  // exactly as a test suite can. See Q-0011.
  const r = runCommand(cmd, ctx.repoDir, { timeoutMs: cmdTimeout(ctx) });
  if (step.output?.write) ctx.backlog.writeFile(ctx.ticket, interpolate(step.output.write, ctx.vars), r.out);
  if (r.code === 0) { ctx.ui.done(step.id, 'exit 0'); return null; }
  if (r.timedOut) {
    // Looping back cannot fix a command that never finishes, and its non-zero exit is not a result.
    throw new FlowError(`${step.id}: script did not finish within ${Math.round((r.timeoutMs ?? 0) / 60000)} minutes and was killed — that is not a result, fix the command or raise commands.timeout_ms`);
  }
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
  ticket.meta.history = [...(ticket.meta.history ?? []), outcome(ctx, from, ticket.meta.stage, status, round(ctx.stats.cost))];
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
    props.findings = { type: 'array', items: { type: 'string', pattern: '^(blocker|major|nit): .+:[1-9][0-9]* .+' }, description: 'Concrete, actionable findings. Empty when the verdict is the first option.' };
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
  if (step.input?.diff) parts.push(materialiseDiff(step, ctx));
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

export function flattenSteps(steps) { return steps.flatMap((s) => (s.parallel ? s.parallel : [s])); }
export function writesOf(step) { const o = step.output ?? {}; return [...(o.write ? [o.write] : []), ...(o.writes ?? [])]; }
export function interpolate(s, vars) { return String(s).replace(/\{([\w.]+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)); }
function globMatch(pattern, p) { return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$').test(p) || (pattern.endsWith('/') && p.startsWith(pattern)); }
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

function materialiseDiff(step, ctx) {
  const range = interpolate(step.input.diff, ctx.vars);
  const base = ctx.vars.base ?? ctx.config.repo?.base_branch ?? 'main';
  const integration = `harness/${ctx.ticket.meta.id}/integration`;
  const hasRef = (ref) => { try { execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: ctx.repoDir, stdio: 'ignore' }); return true; } catch { return false; } };
  if (!hasRef(base)) throw new FlowError(`repo.base_branch in harness/harness.yaml names missing ref "${base}"`);
  if (!hasRef(integration)) throw new FlowError(`ticket ${ctx.ticket.meta.id}: expected ${integration}; review requires an integrated branch`);
  const stat = execFileSync('git', ['diff', '--stat', range], { cwd: ctx.repoDir, encoding: 'utf8' });
  const full = execFileSync('git', ['diff', range], { cwd: ctx.repoDir });
  const limit = ctx.config.repo?.max_diff_bytes ?? 200000;
  let bytes = full; let truncated = bytes.length > limit;
  if (truncated) {
    bytes = bytes.subarray(0, limit);
    while (bytes.length && Buffer.from(bytes.toString('utf8')).compare(bytes) !== 0) bytes = bytes.subarray(0, -1);
    ctx.backlog.log(ctx.ticket, `run=${ctx.runId} diff truncated range=${range} limit=${limit}`);
  }
  const notice = truncated ? `\n\n## Truncation notice\n\nPatch truncated to ${limit} UTF-8 bytes.` : '';
  return `\n## Diff to review\n\n### git diff --stat ${range}\n\n${stat.trim()}\n\n## Patch (${range})\n\n${bytes.toString('utf8')}${notice}`;
}
const round = (n) => Math.round(n * 1000) / 1000;

// ---------- fan_out + integrate ----------

async function runFanOut(step, ctx) {
  const { ui, ticket } = ctx;
  let tasks = loadTasks(ticket);
  if (step.fan_out.scope === 'failing-tasks-only' && ctx.failingTasks?.size) {
    tasks = tasks.filter((t) => ctx.failingTasks.has(t.id));
    ui.warn(`${step.id}: scoped to failing tasks: ${tasks.map((t) => t.id).join(', ')}`);
  }
  if (!tasks.length) throw new FlowError(`${step.id}: no tasks to fan out`);
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
  const dir = ticketWorktree(ctx.repoDir, into);
  // Branch list: explicit, or a glob resolved against fan-out results / existing branches.
  const pattern = interpolate(step.branches, ctx.vars);
  let branches;
  if (Array.isArray(step.branches)) branches = step.branches.map((b) => interpolate(b, ctx.vars));
  else if (pattern.includes('*')) branches = (ctx.fanned ?? []).map((f) => f.branch).filter((b, i, a) => a.indexOf(b) === i);
  else branches = [pattern];
  branches = branches.filter((b) => branchExists(ctx.repoDir, b));
  const notes = [`# Integration — run ${ctx.runId}, iteration ${ctx.vars.iter}`, '', `Target: \`${into}\``, ''];
  const conflicts = [];
  // Catch the ticket branch up with the repository's base branch first. A ticket open for more
  // than a day otherwise integrates against the base it was cut from, and work landed on the base
  // in the meantime looks like the ticket reverting it. See Q-0004.
  const base = interpolate(ctx.config.repo?.base_branch ?? 'main', ctx.vars);
  if (base && base !== into && branchExists(ctx.repoDir, base)) {
    const m = mergeInto(dir, base);
    notes.push(`- ${m.ok ? '✓' : '✗'} base \`${base}\`${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    ui[m.ok ? 'info' : 'warn'](`${step.id}: ${m.ok ? 'synced base' : 'could not sync base'} ${base}${m.ok ? '' : ' — ' + mergeFailure(m)}`);
    if (!m.ok) conflicts.push(base);
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
  for (const w of writesOf(step)) backlog.writeFile(ticket, interpolate(w, ctx.vars), w.includes('report') ? `# Test output\n\n\`\`\`\n${out.slice(-8000)}\n\`\`\`\n` : notes.join('\n'));
  backlog.log(ticket, `run=${ctx.runId} step=${step.id} merged=${branches.length - conflicts.length}/${branches.length} tests=${cmd ? (envError ? 'invalid' : testsOk ? 'ok' : 'fail') : '-'}`);
  // Looping back to the author cannot fix a broken environment, so stop with the reason rather
  // than burning the step's iteration budget on it.
  if (envError) {
    throw new FlowError(`${step.id}: ${envError}. The report is on disk, but it is not evidence of anything — fix the environment (commands.install in harness.yaml) and re-run.`);
  }
  if (conflicts.length || !testsOk) {
    ctx.lastIntegration = notes.join('\n') + '\n\n' + out.slice(-3000);
    // Failing set: conflicted tasks; if tests failed without conflicts, every fanned task (the agents get the test output).
    const byBranch = new Map((ctx.fanned ?? []).map((f) => [f.branch, f.task]));
    ctx.failingTasks = new Set(conflicts.length ? conflicts.map((b) => byBranch.get(b)).filter(Boolean) : (ctx.fanned ?? []).map((f) => f.task));
    if (!step.on_fail) return { abort: true };
    return handleFail(step, ctx);
  }
  ui.done(step.id, `${branches.length} branch(es) on ${into}${cmd ? ', tests ' + (step.expect === 'fail' ? 'red as expected' : 'green') : ''}`);
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
