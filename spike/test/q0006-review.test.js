import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { Backlog, parseFrontmatter } from '../src/backlog.js';
import { buildPrompt, lintFlow, loadFlow, runFlow, schemaFor } from '../src/engine.js';
import { checkAgainstSchema } from '../src/adapters/index.js';
import { mockAdapter } from '../src/adapters/mock.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const bin = path.join(spike, 'bin', 'harness.js');
const contracts = path.join(repo, 'contracts', 'Q-0006');
const shipped = path.join(repo, 'harness');
const templates = path.join(spike, 'templates', 'harness');
const ticketRoot = path.join(repo, 'backlog', 'Q-0006-review-flow-and-cross-flow-backward-edge');

const read = (p) => { assert.ok(fs.existsSync(p), `required test subject is missing: ${p}`); return fs.readFileSync(p, 'utf8'); };
const exists = (p) => fs.existsSync(p);
const cp = (from, to) => fs.cpSync(from, to, { recursive: true });
const sh = (cwd, args, env = {}, input) => spawnSync('node', [bin, ...args], {
  cwd, encoding: 'utf8', input, env: { ...process.env, ...env }, timeout: 15_000,
});
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const json = (name) => JSON.parse(read(path.join(contracts, name)));
const flowValue = (p) => { const v = YAML.parse(read(p)); delete v.file; return v; };

function project({ branch = 'main', gitRepo = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q0006-'));
  if (gitRepo) {
    git(dir, ['init', '-q', '-b', branch]);
    git(dir, ['-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base']);
  }
  const r = sh(dir, ['init']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return dir;
}

function ticketAt(dir, stage = 'green', id = 'T-0001') {
  const backlog = new Backlog(path.join(dir, 'backlog'));
  const t = backlog.create({ title: 'Review me', intent: 'Review the integrated change.' });
  t.meta.id = id;
  t.meta.stage = stage;
  t.meta.branch = `harness/${id}/integration`;
  backlog.write(t);
  fs.mkdirSync(path.join(t.dir, 'requirements'), { recursive: true });
  fs.mkdirSync(path.join(t.dir, 'solution'), { recursive: true });
  fs.writeFileSync(path.join(t.dir, 'requirements/merged.md'), '# Requirements\n');
  fs.writeFileSync(path.join(t.dir, 'solution/solution.md'), '# Solution\n');
  return { backlog, ticket: t };
}

function addIntegration(dir, id = 'T-0001', bytes = 32) {
  fs.writeFileSync(path.join(dir, 'change.txt'), 'x'.repeat(bytes));
  git(dir, ['add', 'change.txt']);
  git(dir, ['-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'change']);
  git(dir, ['branch', `harness/${id}/integration`]);
  git(dir, ['reset', '--hard', 'HEAD~1']);
}

function setConfig(dir, mutate) {
  const p = path.join(dir, 'harness/harness.yaml');
  const cfg = YAML.parse(read(p)); mutate(cfg);
  fs.writeFileSync(p, YAML.stringify(cfg));
}

function reviewRun({ env = {}, answers = [], configure, before, maxBytes } = {}) {
  const dir = project();
  const { ticket } = ticketAt(dir);
  addIntegration(dir, ticket.meta.id, maxBytes ?? 64);
  if (configure) setConfig(dir, configure);
  before?.(dir, ticket);
  const args = ['run', 'review', ticket.meta.id, '--adapter', 'mock', '--auto'];
  for (const answer of answers) args.push('--gate-answer', answer);
  const result = sh(dir, args, env);
  return { dir, ticket, result, state: parseFrontmatter(read(path.join(ticket.dir, 'ticket.md'))).meta };
}

function validate(schema, value) {
  const errors = [];
  const walk = (s, v, at = '$') => {
    if (s.not && validate(s.not, v).length === 0) errors.push(`${at}: not`);
    if ('const' in s && v !== s.const) errors.push(`${at}: const`);
    if (s.oneOf) { const ok = s.oneOf.filter((x) => validate(x, v).length === 0); if (ok.length !== 1) errors.push(`${at}: oneOf`); return; }
    if (s.type === 'object') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${at}: object`); return; }
      for (const k of s.required ?? []) if (!(k in v)) errors.push(`${at}.${k}: required`);
      if (s.additionalProperties === false) for (const k of Object.keys(v)) if (!(k in (s.properties ?? {}))) errors.push(`${at}.${k}: additional`);
      if (s.additionalProperties && typeof s.additionalProperties === 'object') for (const k of Object.keys(v)) if (!(k in (s.properties ?? {}))) walk(s.additionalProperties, v[k], `${at}.${k}`);
      for (const [k, x] of Object.entries(s.properties ?? {})) if (k in v) walk(x, v[k], `${at}.${k}`);
    }
    if (s.type === 'array') { if (!Array.isArray(v)) errors.push(`${at}: array`); else { if (s.minItems != null && v.length < s.minItems) errors.push(`${at}: minItems`); if (s.maxItems != null && v.length > s.maxItems) errors.push(`${at}: maxItems`); v.forEach((x, i) => walk(s.items ?? {}, x, `${at}[${i}]`)); } }
    if (s.type === 'string' && typeof v !== 'string') errors.push(`${at}: string`);
    if (s.type === 'integer' && !Number.isInteger(v)) errors.push(`${at}: integer`);
    if (s.type === 'number' && typeof v !== 'number') errors.push(`${at}: number`);
    if (s.minimum != null && v < s.minimum) errors.push(`${at}: minimum`);
    if (s.minLength != null && v.length < s.minLength) errors.push(`${at}: minLength`);
    if (s.enum && !s.enum.includes(v)) errors.push(`${at}: enum`);
    if (s.pattern && typeof v === 'string' && !(new RegExp(s.pattern).test(v))) errors.push(`${at}: pattern`);
    for (const x of s.allOf ?? []) walk(x, v, at);
    if (s.if?.properties?.verdict?.const) walk(v.verdict === s.if.properties.verdict.const ? s.then : s.else, v, at);
  }; walk(schema, value); return errors;
}

test('SC-01 AC1 review flow exists, lints, matches its frozen contract and template', () => {
  const real = path.join(shipped, 'flows/review.yaml');
  assert.ok(exists(real), 'harness/flows/review.yaml must exist');
  assert.deepEqual(flowValue(real), flowValue(path.join(contracts, 'review-flow.contract.yaml')));
  assert.equal(read(real), read(path.join(templates, 'flows/review.yaml')));
  assert.equal(sh(repo, ['lint']).status, 0);
});

test('SC-02 AC2 code-reviewer role is byte-shared, read-only, classified and unpinned', () => {
  const p = path.join(shipped, 'roles/code-reviewer.md');
  assert.ok(exists(p), 'code-reviewer role must exist');
  const body = read(p);
  assert.equal(body, read(path.join(templates, 'roles/code-reviewer.md')));
  assert.match(body, /blocker/i); assert.match(body, /major/i); assert.match(body, /nit/i);
  assert.match(body, /file:line/i); assert.match(body, /(?:do not|never).*(?:edit|rewrite)/is);
  assert.doesNotMatch(body, /^model:/m);
});

test('SC-03 AC3 review uses only supported fields and no invented judge/with/findings input', () => {
  const text = read(path.join(shipped, 'flows/review.yaml'));
  assert.doesNotMatch(text, /type:\s*judge|on_fail:[\s\S]*?\bwith:|input:\s*\{\s*findings|output:\s*\{[^}]*tasks:/);
  assert.doesNotThrow(() => loadFlow(path.join(shipped, 'flows/review.yaml')));
});

test('SC-04/05 AC4-5 panel is two-vendor, named, read-only, and creates no worktree', () => {
  const f = flowValue(path.join(shipped, 'flows/review.yaml')); const panel = f.steps[0].parallel;
  assert.deepEqual(panel.map((x) => [x.id, x.role, x.adapter]), [['review-claude', 'code-reviewer', 'claude'], ['review-codex', 'code-reviewer', 'codex']]);
  assert.deepEqual(panel.map((x) => x.output.writes[0]), ['review/round-{round}/claude.md', 'review/round-{round}/codex.md']);
  assert.ok(panel.every((x) => !('worktree' in x)));
});

test('SC-06/07 AC6-7 verdict reads exact named inputs and codifies severity threshold', () => {
  const verdict = flowValue(path.join(shipped, 'flows/review.yaml')).steps[1];
  assert.deepEqual(verdict.input.backlog, ['review/round-{round}/claude.md', 'review/round-{round}/codex.md', 'requirements/merged.md', 'solution/solution.md']);
  assert.ok(!verdict.input.diff); assert.equal(verdict.output.verdict, 'approve|changes-requested');
  assert.match(verdict.instructions, /nits alone approve/i); assert.match(verdict.instructions, /blocker or major[\s\S]*changes-requested/i);
});

test('SC-08/09 AC8-9 round allocation preserves audit rounds and overwrites stable verdict', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_PASS: '1' }, before: (_d, t) => {
    fs.mkdirSync(path.join(t.dir, 'review/round-1'), { recursive: true });
    fs.writeFileSync(path.join(t.dir, 'review/round-1/verdict.md'), 'old\n');
  }});
  assert.equal(x.result.status, 0, x.result.stderr + x.result.stdout);
  assert.equal(read(path.join(x.ticket.dir, 'review/round-1/verdict.md')), 'old\n');
  assert.ok(exists(path.join(x.ticket.dir, 'review/round-2/verdict.md')));
  assert.equal(read(path.join(x.ticket.dir, 'review/verdict.md')), read(path.join(x.ticket.dir, 'review/round-2/verdict.md')));
});

test('SC-10/11/12 AC10-12 diff is base-first three-dot, truncated with stat and preflight', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_PASS: '1' }, maxBytes: 1000, configure: (c) => { c.repo = { base_branch: 'main', max_diff_bytes: 20 }; } });
  assert.equal(x.result.status, 0, x.result.stderr + x.result.stdout);
  const log = read(path.join(x.ticket.dir, 'runs.log'));
  assert.match(log, /truncat/i); assert.match(log, /main\.\.\.harness\/T-0001\/integration/);
});

test('SC-12b missing configured base fails before adapter or ticket write', () => {
  const x = reviewRun({ configure: (c) => { c.repo = { base_branch: 'missing-ref', max_diff_bytes: 200000 }; } });
  assert.notEqual(x.result.status, 0); assert.match(x.result.stderr + x.result.stdout, /repo\.base_branch[\s\S]*harness\.yaml[\s\S]*missing-ref/i);
  assert.ok(!exists(path.join(x.ticket.dir, 'runs.log')));
});

test('SC-13/14 AC13-14 cross-flow rejection derives stage, stops, and reports traversal', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' } });
  assert.equal(x.result.status, 0, x.result.stderr + x.result.stdout); assert.equal(x.state.stage, 'solutioned');
  assert.match(x.result.stdout, /development[\s\S]*green[\s\S]*solutioned[\s\S]*(?:remaining|2)/i);
  assert.ok(!/flow=development start/.test(read(path.join(x.ticket.dir, 'runs.log'))));
});

test('SC-15 AC15 counter persists, board displays it, prefixed spelling lints out', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' } });
  assert.equal(x.state.iterations.review, 1);
  assert.match(sh(x.dir, ['board']).stdout, /iter=.*review[^\n]*1/);
  const f = flowValue(path.join(contracts, 'review-flow.contract.yaml')); f.steps[1].on_fail.counter = 'iterations.review';
  assert.throws(() => lintFlow(f), /verdict[\s\S]*iterations\.review[\s\S]*review/i);
});

test('SC-16 AC16 exactly three regressions; missing/string/zero/negative bounds all lint-fail', () => {
  const f = flowValue(path.join(contracts, 'review-flow.contract.yaml'));
  for (const value of [undefined, 'three', 0, -1]) {
    const c = structuredClone(f); if (value === undefined) delete c.steps[1].on_fail.max_iterations; else c.steps[1].on_fail.max_iterations = value;
    assert.throws(() => lintFlow(c), /verdict[\s\S]*max_iterations/i);
  }
});

test('SC-17/18/19 AC17-19 exhaustion gate ignores auto and honors advance/retry/abort without defaults', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' }, before: (_d, t) => { const b = new Backlog(path.dirname(t.dir)); t.meta.iterations.review = 3; b.write(t); } });
  assert.notEqual(x.result.status, 0); assert.match(x.result.stdout + x.result.stderr, /review[\s\S]*4[\s\S]*3[\s\S]*advance[\s\S]*retry[\s\S]*abort/i);
});

test('SC-20/21 AC20-21 development syncs integration and optionally includes stable verdict', () => {
  const d = flowValue(path.join(shipped, 'flows/development.yaml')); const text = read(path.join(shipped, 'flows/development.yaml'));
  assert.match(text, /review\/verdict\.md/); assert.match(text, /harness\/\{id\}\/integration/);
  assert.ok(d.steps.some((s) => s.fan_out), 'development fan-out remains present');
});

test('SC-22 AC22 all terminal outcomes carry reconstructable audit fields', () => {
  const schema = json('ticket-review-state.schema.json');
  const required = schema.properties.history.items.oneOf[1].required;
  assert.deepEqual(required, ['stage', 'run', 'flow', 'status', 'stage_before', 'stage_after', 'at', 'cost']);
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' } });
  const h = x.state.history.at(-1); for (const k of required) assert.ok(k in h, `history missing ${k}`);
  assert.equal(h.status, 'regressed');
});

test('SC-23/24 AC23-24 invalid/asymmetric output saves raw, decides nothing, preserves survivor', async () => {
  const d = project(); const { backlog, ticket } = ticketAt(d); addIntegration(d);
  const flow = flowValue(path.join(contracts, 'review-flow.contract.yaml')); flow.file = path.join(d, 'harness/flows/review.yaml');
  const before = structuredClone(ticket.meta); process.env.MOCK_INVALID_REVIEW = '1';
  try { await assert.rejects(runFlow({ flow, ticket, backlog, harnessDir: path.join(d, 'harness'), repoDir: d, config: { adapterOverride: 'mock' }, ui: quietUi(), auto: true }), /structured output invalid/); }
  finally { delete process.env.MOCK_INVALID_REVIEW; }
  const after = backlog.read(ticket.meta.id).meta; assert.equal(after.stage, before.stage); assert.deepEqual(after.iterations, before.iterations);
  const rawDir = path.join(ticket.dir, '.harness'); assert.ok(exists(rawDir), 'invalid output must create the raw-response directory');
  assert.ok(fs.readdirSync(rawDir).some((x) => x.endsWith('.raw.txt')));
});

test('SC-25/26 AC25-26 lint resolves return chains and rejects a same-vendor panel', () => {
  const f = flowValue(path.join(contracts, 'review-flow.contract.yaml')); f.steps[0].parallel[1].adapter = 'claude';
  assert.throws(() => lintFlow(f), /review-claude[\s\S]*review-codex[\s\S]*claude/i);
  f.steps[1].on_fail.goto = 'flow:not-there';
  assert.throws(() => lintFlow(f), /review[\s\S]*not-there/i);
});

test('SC-27/28 AC27-28 deterministic switches drive full review loop independent of call order', async () => {
  const schema = schemaFor(flowValue(path.join(contracts, 'review-flow.contract.yaml')).steps[1]);
  process.env.MOCK_ALWAYS_PASS = '1'; const pass = await mockAdapter().run({ prompt: 'x', schema, cwd: repo, allowWrite: false }); delete process.env.MOCK_ALWAYS_PASS;
  process.env.MOCK_ALWAYS_FAIL = '1'; const fail = await mockAdapter().run({ prompt: 'x', schema, cwd: repo, allowWrite: false }); delete process.env.MOCK_ALWAYS_FAIL;
  assert.equal(pass.output.verdict, 'approve'); assert.equal(fail.output.verdict, 'changes-requested');
  assert.equal(validate(json('review-artifacts.schema.json'), fail.output).length, 0);
});

test('SC-29 AC29 no dependency and legacy smoke coverage remain wired into npm test', () => {
  const pkg = JSON.parse(read(path.join(spike, 'package.json'))); assert.deepEqual(pkg.dependencies, { yaml: '^2.5.0' });
  assert.match(pkg.scripts.test, /smoke\.js/); assert.match(read(path.join(spike, 'test/smoke.js')), /API key|adapters --probe|no shipped template pins/i);
});

test('SC-30 AC30 documentation agrees with review contract', () => {
  const docs = ['README.md', 'docs/02-sdlc-pipeline-spec.md', 'docs/06-development-plan.md', 'docs/DECISIONS.md', 'docs/GLOSSARY.md'].map((p) => read(path.join(repo, p))).join('\n');
  for (const x of ['harness run review', '...harness/', '{round}', 'counter: review', 'exhaust']) assert.match(docs, new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(docs, /Gate[\s\S]*exhaust/i); assert.match(docs, /derived[\s\S]*consumes/i);
});

test('EC-01 acceptance requires retry to persist exact limit 3 (frozen runtime prose currently contradicts this as 2)', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' }, answers: ['retry'], before: (_d, t) => { const b = new Backlog(path.dirname(t.dir)); t.meta.iterations.review = 3; b.write(t); } });
  assert.equal(x.state.iterations.review, 3); assert.equal(x.state.stage, 'solutioned');
});

test('EC-02/03/04 exhausted count survives advance and repeated gate answers are consumed once', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' }, answers: ['advance', 'abort'], before: (_d, t) => { const b = new Backlog(path.dirname(t.dir)); t.meta.iterations.review = 3; b.write(t); } });
  assert.equal(x.state.iterations.review, 4); assert.equal(x.state.stage, 'green'); assert.equal(x.result.status, 2);
});

test('EC-05 exhaustion presentation costs zero and terminal run cost appears once', () => {
  const x = reviewRun({ env: { MOCK_ALWAYS_FAIL: '1' }, answers: ['abort'], before: (_d, t) => { const b = new Backlog(path.dirname(t.dir)); t.meta.iterations.review = 3; b.write(t); } });
  const events = x.state.history.filter((h) => h.run === x.state.history.at(-1)?.run);
  const exhausted = events.find((h) => h.status === 'exhausted'); assert.equal(exhausted.cost, 0); assert.equal(exhausted.stage_before, exhausted.stage_after);
  assert.equal(events.filter((h) => h.cost > 0).length, 1);
});

test('EC-06/07/08/09 return-chain lint detects dead ends/cycles but ignores unreachable ambiguity', () => {
  const dir = project(); const flows = path.join(dir, 'harness/flows'); const shippedBefore = fs.readdirSync(path.join(shipped, 'flows')).map((f) => [f, read(path.join(shipped, 'flows', f))]);
  const source = flowValue(path.join(contracts, 'review-flow.contract.yaml')); source.steps[1].on_fail.goto = 'flow:x'; fs.writeFileSync(path.join(flows, 'review.yaml'), YAML.stringify(source));
  fs.writeFileSync(path.join(flows, 'x.yaml'), YAML.stringify({ name: 'x', consumes: 'solutioned', produces: 'nowhere', steps: [] }));
  const r = sh(dir, ['lint']); assert.notEqual(r.status, 0); assert.match(r.stdout + r.stderr, /review[\s\S]*x[\s\S]*nowhere/i);
  for (const [f, body] of shippedBefore) assert.equal(read(path.join(shipped, 'flows', f)), body);
});

test('EC-10 run preflight validates pristine flows before mock adapter override', () => {
  const x = reviewRun({ before: (d) => { const p = path.join(d, 'harness/flows/review.yaml'); const f = YAML.parse(read(p)); f.steps[0].parallel[1].adapter = 'claude'; fs.writeFileSync(p, YAML.stringify(f)); } });
  assert.notEqual(x.result.status, 0); assert.match(x.result.stdout + x.result.stderr, /review-claude[\s\S]*review-codex[\s\S]*claude/i);
});

test('EC-11 init discovers normal branch but defaults main outside git and on unborn HEAD', () => {
  const normal = project({ branch: 'develop' }); assert.equal(YAML.parse(read(path.join(normal, 'harness/harness.yaml'))).repo.base_branch, 'develop');
  const plain = project({ gitRepo: false }); assert.equal(YAML.parse(read(path.join(plain, 'harness/harness.yaml'))).repo.base_branch, 'main');
  const unborn = fs.mkdtempSync(path.join(os.tmpdir(), 'q0006-unborn-')); git(unborn, ['init', '-q']); assert.equal(sh(unborn, ['init']).status, 0); assert.equal(YAML.parse(read(path.join(unborn, 'harness/harness.yaml'))).repo.base_branch, 'main');
});

test('EC-12/14 mock switches conflict and direct output satisfies every artifact clause', async () => {
  const schema = schemaFor(flowValue(path.join(contracts, 'review-flow.contract.yaml')).steps[1]);
  process.env.MOCK_ALWAYS_PASS = '1'; process.env.MOCK_ALWAYS_FAIL = '1';
  try { await assert.rejects(mockAdapter().run({ prompt: 'x', schema, cwd: repo, allowWrite: false }), /ALWAYS_PASS[\s\S]*ALWAYS_FAIL|mutually exclusive/i); }
  finally { delete process.env.MOCK_ALWAYS_PASS; delete process.env.MOCK_ALWAYS_FAIL; }
  process.env.MOCK_ALWAYS_FAIL = '1'; const out = await mockAdapter().run({ prompt: 'x', schema, cwd: repo, allowWrite: false }); delete process.env.MOCK_ALWAYS_FAIL;
  assert.deepEqual(validate(json('review-artifacts.schema.json'), out.output), []);
  assert.notDeepEqual(validate(json('review-artifacts.schema.json'), { ...out.output, surprise: true }), []);
});

test('EC-13 verdict input uses named current-round files and never glob/stable verdict', () => {
  const v = flowValue(path.join(contracts, 'review-flow.contract.yaml')).steps[1];
  assert.ok(v.input.backlog.every((p) => !p.includes('*') && p !== 'review/verdict.md'));
});

test('EC-15 real-vendor-shaped invalid verdicts fail the same schema path', () => {
  const schema = schemaFor(flowValue(path.join(contracts, 'review-flow.contract.yaml')).steps[1]);
  assert.notDeepEqual(checkAgainstSchema({ summary: 'x', document: 'x', verdict: 'approve', findings: ['major: x.js:1 bad'] }, schema), []);
  assert.notDeepEqual(checkAgainstSchema({ summary: 'x', document: 'x', verdict: 'changes-requested', findings: ['major: x.js missing line'] }, schema), []);
});

test('EC-16 ticket schemas parse and accept legacy/new clauses while rejecting bad counters/exhaustion cost', () => {
  const artifact = json('review-artifacts.schema.json'); const state = json('ticket-review-state.schema.json'); assert.ok(artifact.oneOf && state.properties.history);
  const good = { stage: 'green', iterations: { review: 1 }, history: [{ stage: 'green', run: 1, flow: 'development', at: new Date().toISOString(), cost: 1 }, { stage: 'green', run: 2, flow: 'review', status: 'exhausted', stage_before: 'green', stage_after: 'green', at: new Date().toISOString(), cost: 0 }] };
  assert.deepEqual(validate(state, good), []); assert.notDeepEqual(validate(state, { ...good, iterations: { review: -1 } }), []);
});

test('EC-17 frozen Q-0006 contracts remain unmodified from branch base', () => {
  const diff = execSync('git diff -- contracts/Q-0006', { cwd: repo, encoding: 'utf8' }); assert.equal(diff, '');
});

test('EC-18 final diff contains no whitespace errors', () => {
  assert.doesNotThrow(() => execSync('git diff --check', { cwd: repo, stdio: 'pipe' }));
});

test('EC-19 role owns reviewer guidance and verdict step owns dedupe/threshold guidance', () => {
  const f = flowValue(path.join(shipped, 'flows/review.yaml')); assert.ok(f.steps[0].parallel.every((s) => !s.instructions));
  const role = read(path.join(shipped, 'roles/code-reviewer.md')); assert.match(role, /read.?only|do not edit/i); assert.match(role, /blocker[\s\S]*major[\s\S]*nit/i); assert.match(role, /file:line/i);
  assert.match(f.steps[1].instructions, /deduplicate/i); assert.match(f.steps[1].instructions, /blocker or major[\s\S]*changes-requested/i);
});

test('EC-20 every shipped exhaustible flow proves --auto cannot bypass exhaustion', () => {
  const files = fs.readdirSync(path.join(shipped, 'flows')).filter((f) => f.endsWith('.yaml'));
  const exhaustible = files.map((f) => flowValue(path.join(shipped, 'flows', f))).filter((f) => JSON.stringify(f).includes('max_iterations'));
  assert.ok(exhaustible.length >= 4, 'all four+ shipped exhaustible flows must be covered');
  assert.doesNotMatch(read(path.join(spike, 'test/smoke.js')), /--auto advances it/);
});

function quietUi() {
  return { info() {}, warn() {}, step() {}, done() {}, trace() {}, async gate() { throw new Error('gate must not be reached'); } };
}
