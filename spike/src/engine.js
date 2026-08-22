// Flow engine: stage-chained flows, parallel groups, structured outputs written to the
// backlog, bounded backward edges (on_fail.goto), human gates.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
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
    vars: { id: ticket.meta.id, iter: 1 },
  };
  ui.info(`run #${ctx.runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}`);
  backlog.log(ticket, `run=${ctx.runId} flow=${flow.name} start stage=${ticket.meta.stage}`);

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
        return finish(ctx, targetFlow.consumes, 'regressed');
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
    cwd = ensureWorktree(ctx.repoDir, branch, interpolate(step.base ?? ticket.meta.branch, ctx.vars));
    ui.info(`${step.id}: worktree ${cwd} (${branch})`);
    if (extra.syncBase) { const m = mergeInto(cwd, interpolate(step.base ?? ticket.meta.branch, ctx.vars)); if (!m.ok) ui.warn(`${step.id}: could not sync base: ${m.conflicts.join(',')}`); }
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
    const files = commitAll(cwd, `${step.id}: ${res.output.summary?.slice(0, 60) ?? 'agent changes'} [${ticket.meta.id}]`);
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
    return { goto: f.goto };
  }
  ctx.ui.warn(`${step.id}: loop exhausted (${f.max_iterations}) → human gate`);
  return runGate({ gate: 'human', reason: `loop exhausted at ${step.id}; choose: advance (accept as is), retry (one more ${f.goto}), abort` , retryTarget: f.goto }, ctx);
}

async function runGate(step, ctx) {
  const kind = step.gate;
  if (kind === 'auto' || (ctx.auto && kind !== 'human-locked')) { ctx.ui.info(`gate: auto-advanced (${kind})`); return null; }
  if (ctx.dry) { ctx.ui.info(`gate (${kind}): would pause here`); return null; }
  const answer = await ctx.ui.gate({ kind, reason: step.reason ?? step.prompt ?? `${ctx.flow.name}: approve to advance ticket to "${ctx.flow.produces}"`, ticketDir: ctx.ticket.dir, retry: step.retryTarget });
  ctx.backlog.log(ctx.ticket, `run=${ctx.runId} gate=${kind} answer=${answer}`);
  if (answer === 'advance') return null;
  if (answer === 'retry' && step.retryTarget) { ctx.counters = {}; return { goto: step.retryTarget }; }
  return { abort: true };
}

async function runScript(step, ctx) {
  const { execSync } = await import('node:child_process');
  const cmd = interpolate(step.run, ctx.vars);
  ctx.ui.step(step.id, `script: ${cmd}`);
  if (ctx.dry) return null;
  try {
    const out = execSync(cmd, { cwd: ctx.repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (step.output?.write) ctx.backlog.writeFile(ctx.ticket, interpolate(step.output.write, ctx.vars), out);
    ctx.ui.done(step.id, 'exit 0');
    return null;
  } catch (e) {
    ctx.ui.warn(`${step.id}: exit ${e.status}`);
    if (step.output?.write) ctx.backlog.writeFile(ctx.ticket, interpolate(step.output.write, ctx.vars), (e.stdout ?? '') + (e.stderr ?? ''));
    return step.on_fail ? handleFail(step, ctx) : { abort: true };
  }
}

function finish(ctx, stage, status, note) {
  const { ticket, backlog } = ctx;
  const from = ticket.meta.stage;
  ticket.meta.iterations = ctx.counters;
  if (status === 'completed' || status === 'regressed') {
    ticket.meta.stage = stage;
    ticket.meta.history = [...(ticket.meta.history ?? []), { stage, run: ctx.runId, flow: ctx.flow.name, at: new Date().toISOString(), cost: round(ctx.stats.cost) }];
  }
  backlog.write(ticket);
  backlog.log(ticket, `run=${ctx.runId} ${status} stage=${from}→${ticket.meta.stage} cost=${round(ctx.stats.cost)} tokens=${ctx.stats.tokens}${note ? ` error=${JSON.stringify(note)}` : ''}`);
  const partial = ctx.stats.unpriced ? `  (+${ctx.stats.unpriced} unpriced step${ctx.stats.unpriced > 1 ? 's' : ''} — vendor reports no price)` : '';
  ctx.ui.info(`run #${ctx.runId} ${status}: ${from} → ${ticket.meta.stage}   cost $${round(ctx.stats.cost)}  tokens ${ctx.stats.tokens}${partial}`);
  return { status, stage: ticket.meta.stage, cost: ctx.stats.cost, runId: ctx.runId };
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
    props.findings = { type: 'array', items: { type: 'string' }, description: 'Concrete, actionable findings. Empty when the verdict is the first option.' };
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
  if (step.input?.diff) parts.push(`\n## Diff to review\n\nRun \`git diff ${interpolate(step.input.diff, ctx.vars)}\` in the repository and review that change.`);
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
        vars, syncBase: ctx.vars.iter > 1 || w > 0,
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
  for (const b of branches) {
    const m = mergeInto(dir, b);
    notes.push(`- ${m.ok ? '✓' : '✗'} ${b}${m.ok ? '' : ' — conflicts: ' + m.conflicts.join(', ')}`);
    ui[m.ok ? 'info' : 'warn'](`${step.id}: ${m.ok ? 'merged' : 'CONFLICT'} ${b}${m.ok ? '' : ' (' + m.conflicts.join(', ') + ')'}`);
    if (!m.ok) conflicts.push(b);
  }
  let testsOk = true; let out = '';
  const cmd = step.run_tests === true ? ctx.config.commands?.test ?? 'npm test' : step.run_tests ? interpolate(step.run_tests, { ...ctx.vars, ...flatten(ctx.config.commands ?? {}, 'cmd') }) : null;
  if (cmd && !conflicts.length) {
    const r = runCommand(cmd, dir);
    out = r.out;
    const expect = step.expect ?? 'pass';
    testsOk = expect === 'fail' ? r.code !== 0 : r.code === 0;
    notes.push('', `Tests: \`${cmd}\` → exit ${r.code} (expected ${expect}) → ${testsOk ? 'OK' : 'NOT OK'}`);
    ui[testsOk ? 'info' : 'warn'](`${step.id}: tests exit ${r.code}, expected ${expect}`);
  }
  for (const w of writesOf(step)) backlog.writeFile(ticket, interpolate(w, ctx.vars), w.includes('report') ? `# Test output\n\n\`\`\`\n${out.slice(-8000)}\n\`\`\`\n` : notes.join('\n'));
  backlog.log(ticket, `run=${ctx.runId} step=${step.id} merged=${branches.length - conflicts.length}/${branches.length} tests=${cmd ? (testsOk ? 'ok' : 'fail') : '-'}`);
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

function flatten(obj, prefix) { return Object.fromEntries(Object.entries(obj).map(([k, v]) => [`${prefix}.${k}`, v])); }
