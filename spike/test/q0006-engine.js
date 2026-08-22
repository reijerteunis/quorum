// Q-0006 engine red tests.  The fixtures use only the frozen contracts and the
// public engine/adapter interfaces, so failures describe missing behaviour (not
// missing imports or the surface assets which moved to Q-0033).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Backlog } from '../src/backlog.js';
import { buildPrompt, loadFlow, runFlow, schemaFor } from '../src/engine.js';
import { checkAgainstSchema } from '../src/adapters/index.js';
import { mockAdapter } from '../src/adapters/mock.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const contracts = path.join(repo, 'contracts', 'Q-0006');
let failed = 0;
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const env = async (values, fn) => {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) v == null ? delete process.env[k] : process.env[k] = v;
  try { return await fn(); } finally { for (const [k, v] of Object.entries(old)) v == null ? delete process.env[k] : process.env[k] = v; }
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0006-engine-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  const backlog = new Backlog(path.join(root, 'backlog'));
  write(path.join(harnessDir, 'roles', 'code-reviewer.md'), '---\nadapter: claude\n---\nRead-only reviewer.\n');
  write(path.join(harnessDir, 'roles', 'developer-backend.md'), '---\nadapter: mock\n---\nDeveloper.\n');
  write(path.join(harnessDir, 'flows', 'review.yaml'), fs.readFileSync(path.join(contracts, 'review-flow.contract.yaml'), 'utf8'));
  write(path.join(harnessDir, 'flows', 'development.yaml'), 'name: development\nconsumes: red\nproduces: green\nsteps: []\n');
  const ticket = backlog.create({ title: 'Review fixture', intent: 'Exercise Q-0006.' });
  ticket.meta.stage = 'green'; backlog.write(ticket);
  write(path.join(ticket.dir, 'requirements', 'merged.md'), '# Requirement\n');
  write(path.join(ticket.dir, 'solution', 'solution.md'), '# Solution\n');
  git(root, 'checkout', '-q', '-b', ticket.meta.branch);
  write(path.join(root, 'unicode.txt'), 'first review — 🧪\n');
  git(root, 'add', 'unicode.txt'); git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'ticket');
  git(root, 'checkout', '-q', 'main');
  const messages = [];
  const ui = {
    info: (m) => messages.push(`info ${m}`), warn: (m) => messages.push(`warn ${m}`),
    step: (a, b) => messages.push(`step ${a} ${b}`), done: (a, b) => messages.push(`done ${a} ${b}`), trace() {},
    gate: async () => 'abort',
  };
  const config = { adapterOverride: 'mock', adapters: {}, repo: { base_branch: 'main', max_diff_bytes: 32 } };
  return { root, harnessDir, backlog, ticket, ui, messages, config };
}

const reread = (f) => f.backlog.read(f.ticket.meta.id);

const verdictSchema = schemaFor({ output: { writes: ['review.md'], verdict: 'approve|changes-requested' } });
const invokeMock = (values, schema = verdictSchema) => env(values, () => mockAdapter({ delayMs: 0 }).run({
  prompt: '# Role: code-reviewer', schema, cwd: os.tmpdir(), allowWrite: false,
}));

await scenario('AC-7/AC-28/EDGE-3', 'mock verdict switches are valid, deterministic, scoped, and exclusive', async () => {
  const pass = await invokeMock({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null });
  assert.equal(pass.output.verdict, 'approve'); assert.deepEqual(pass.output.findings, []);
  const reject = await invokeMock({ MOCK_ALWAYS_PASS: null, MOCK_ALWAYS_FAIL: '1' });
  assert.equal(reject.output.verdict, 'changes-requested');
  assert.match(reject.output.findings[0], /^(blocker|major|nit): .+:[1-9][0-9]* .+/);
  await assert.rejects(() => invokeMock({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: '1' }), /MOCK_ALWAYS_PASS.*MOCK_ALWAYS_FAIL|mutually exclusive/i);
  const plain = await invokeMock({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, schemaFor({ output: { writes: ['x.md'] } }));
  assert.equal(Object.hasOwn(plain.output, 'verdict'), false);
});

await scenario('EDGE-2/AC-23', 'every frozen verdict-schema clause is enforced without a validator dependency', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(contracts, 'review-artifacts.schema.json'), 'utf8'));
  const branch = schema.oneOf.find((x) => x.title === 'Verdict output');
  const runtime = { ...verdictSchema, properties: { ...verdictSchema.properties, findings: branch.properties.findings } };
  const bad = [
    { summary: 'x', document: 'x', verdict: 'approve', findings: ['nit: a.js:1 no'] },
    { summary: 'x', document: 'x', verdict: 'changes-requested', findings: [] },
    { summary: 'x', document: 'x', verdict: 'changes-requested', findings: ['major: no-line'] },
  ];
  for (const value of bad) assert.notEqual(checkAgainstSchema(value, runtime).length, 0, JSON.stringify(value));
  assert.deepEqual(checkAgainstSchema({ summary: 'x', document: 'x', verdict: 'approve', findings: [] }, runtime), []);
});

await scenario('AC-5/AC-10/AC-11/EDGE-4/EDGE-5', 'buildPrompt materialises the configured three-dot diff safely', () => {
  const f = fixture();
  const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  const step = flow.steps[0].parallel[0];
  const prompt = buildPrompt(step, { meta: {}, body: 'review' }, {
    ticket: f.ticket, backlog: f.backlog, harnessDir: f.harnessDir, repoDir: f.root, config: f.config,
    vars: { id: f.ticket.meta.id, base: 'main', round: 1, iter: 1 }, runId: 1,
  });
  assert.match(prompt, /git diff --stat main\.\.\.harness\/T-0001\/integration/);
  assert.match(prompt, /unicode\.txt/);
  assert.doesNotMatch(prompt, /Run `git diff/);
  assert.match(prompt, /truncat/i);
  const patch = prompt.match(/## Patch[^\n]*\n+([\s\S]*?)(?:\n+## |$)/i)?.[1] ?? '';
  assert.ok(Buffer.byteLength(patch) <= f.config.repo.max_diff_bytes, 'truncated patch respects the byte limit');
  assert.equal(patch.includes('\uFFFD'), false, 'truncation introduced no replacement character');
  assert.match(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), /truncat/i);
});

await scenario('AC-12/EDGE-5', 'a missing configured base ref fails before any adapter call', async () => {
  const f = fixture(); const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  f.config.repo.base_branch = 'missing-base';
  await assert.rejects(
    () => env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true })),
    (e) => /repo\.base_branch/i.test(e.message) && /harness[\/]harness\.yaml/.test(e.message) && /missing-base/.test(e.message),
  );
  assert.doesNotMatch(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), / step=/, 'adapter was spawned');
});

await scenario('EDGE-17', 'a missing integration ref has its own pre-adapter diagnostic', async () => {
  const f = fixture(); const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  git(f.root, 'branch', '-D', f.ticket.meta.branch);
  await assert.rejects(
    () => env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true })),
    (e) => new RegExp(`${f.ticket.meta.id}.*${f.ticket.meta.branch}.*integrated branch`, 'is').test(e.message) && !/repo\.base_branch/.test(e.message),
  );
  assert.doesNotMatch(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), / step=/, 'adapter was spawned');
});

await scenario('AC-4/AC-6/AC-8/AC-9', 'a real review run writes numbered panel/verdict artifacts and stable latest verdict', async () => {
  const f = fixture();
  const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  const verdict = flow.steps.find((s) => s.id === 'verdict');
  assert.equal(Object.hasOwn(verdict.input, 'diff'), false, 'verdict must judge artifacts, not receive the diff');
  assert.equal(flow.steps[0].parallel.every((s) => !s.worktree && !s.instructions), true, 'panel must be read-only and role-guided');
  assert.deepEqual(flow.steps[0].parallel.map((s) => s.adapter).sort(), ['claude', 'codex']);
  const beforeBranches = git(f.root, 'branch', '--format=%(refname:short)').split('\n').sort();
  await env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true }));
  assert.equal(reread(f).meta.stage, 'reviewed');
  assert.deepEqual(git(f.root, 'branch', '--format=%(refname:short)').split('\n').sort(), beforeBranches, 'review created a branch');
  for (const rel of ['review/round-1/claude.md', 'review/round-1/codex.md', 'review/round-1/verdict.md', 'review/verdict.md'])
    assert.equal(fs.existsSync(path.join(f.ticket.dir, rel)), true, rel);
  const first = fs.readFileSync(path.join(f.ticket.dir, 'review/round-1/verdict.md'), 'utf8');
  assert.equal(fs.readFileSync(path.join(f.ticket.dir, 'review/verdict.md'), 'utf8'), first);
  f.ticket.meta.stage = 'green'; f.backlog.write(f.ticket);
  await env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true }));
  assert.equal(fs.readFileSync(path.join(f.ticket.dir, 'review/round-1/verdict.md'), 'utf8'), first);
  assert.equal(fs.existsSync(path.join(f.ticket.dir, 'review/round-2/verdict.md')), true);
});

await scenario('AC-13/AC-14/AC-15/AC-16', 'three separate rejection rounds regress to the target consumes stage and persist exact counts', async () => {
  const f = fixture(); const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  for (let n = 1; n <= 3; n++) {
    f.ticket.meta.stage = 'green'; f.backlog.write(f.ticket);
    const result = await env({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: false }));
    assert.equal(result.status, 'regressed'); assert.equal(result.stage, 'red');
    assert.equal(reread(f).meta.iterations.review, n, 'counter must survive a disk round-trip');
  }
  assert.equal(f.messages.some((m) => /development.*red/.test(m)), true);
  assert.equal(f.messages.some((m) => /Review verdict is approve/.test(m)), false, 'closing gate ran after regression');
  assert.equal(f.messages.some((m) => /flow=development.*start/.test(m)), false, 'target flow started automatically');
});

await scenario('AC-17/AC-18/EDGE-1/EDGE-12', 'fourth rejection exhausts; retry persists max and grants one traversal only', async () => {
  const f = fixture(); const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  f.ticket.meta.iterations.review = 3; f.backlog.write(f.ticket); f.ui.gate = async ({ reason }) => { assert.match(reason, /review.*4.*3.*advance.*retry.*abort/i); return 'retry'; };
  const result = await env({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true }));
  assert.equal(result.status, 'regressed'); assert.equal(reread(f).meta.iterations.review, 3);
  const history = reread(f).meta.history;
  const exhausted = history.filter((h) => h.status === 'exhausted');
  assert.equal(exhausted.length, 1); assert.equal(exhausted[0].cost, 0);
  assert.equal(history.filter((h) => h.run === result.runId && h.status !== 'exhausted' && h.cost > 0).length, 1, 'terminal cost is recorded exactly once');
  assert.match(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), /gate=retry.*set=3/);
});

await scenario('AC-17/AC-18/EDGE-10', 'advance and abort are distinct and advance keeps exhaustion loaded', async () => {
  const advanced = fixture(); const flow = loadFlow(path.join(advanced.harnessDir, 'flows', 'review.yaml'));
  advanced.ticket.meta.iterations.review = 3; advanced.backlog.write(advanced.ticket);
  advanced.ui.gate = async () => 'advance';
  await env({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, () => runFlow({ flow, ...advanced, repoDir: advanced.root, auto: true }));
  assert.equal(reread(advanced).meta.iterations.review, 4);
  advanced.ticket = reread(advanced); advanced.ticket.meta.stage = 'green'; advanced.backlog.write(advanced.ticket);
  let gates = 0; advanced.ui.gate = async () => { gates++; return 'abort'; };
  const next = await env({ MOCK_ALWAYS_FAIL: '1', MOCK_ALWAYS_PASS: null }, () => runFlow({ flow, ...advanced, repoDir: advanced.root, auto: true }));
  assert.equal(gates, 1); assert.equal(next.status, 'aborted'); assert.equal(reread(advanced).meta.stage, 'green');
});

await scenario('AC-22/AC-24', 'asymmetric panel failure retains its sibling and records failed without deciding', async () => {
  const f = fixture(); const flow = loadFlow(path.join(f.harnessDir, 'flows', 'review.yaml'));
  await assert.rejects(() => env({ MOCK_FAIL_WRITE: 'claude.md', MOCK_ALWAYS_PASS: '1' }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true })));
  assert.equal(fs.existsSync(path.join(f.ticket.dir, 'review/round-1/codex.md')), true);
  assert.equal(fs.existsSync(path.join(f.ticket.dir, 'review/round-1/verdict.md')), false);
  assert.equal(f.ticket.meta.stage, 'green'); assert.equal(f.ticket.meta.iterations.review, undefined);
  assert.match(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), / failed /);
  assert.equal(f.ticket.meta.history.at(-1)?.status, 'failed');
  await env({ MOCK_FAIL_WRITE: null, MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () => runFlow({ flow, ...f, repoDir: f.root, auto: true }));
  assert.equal(fs.existsSync(path.join(f.ticket.dir, 'review/round-1/verdict.md')), true, 'retry skipped the incomplete round');
  assert.equal(fs.existsSync(path.join(f.ticket.dir, 'review/round-2/verdict.md')), false, 'retry advanced the round');
});

await scenario('AC-20/AC-21/AC-27', 'rework task starts from integration and receives an optional latest verdict', async () => {
  const f = fixture();
  write(path.join(f.ticket.dir, 'review', 'verdict.md'), '# Changes requested\nmajor: unicode.txt:1 fix it\n');
  write(path.join(f.ticket.dir, 'solution', 'tasks.yaml'), 'tasks:\n  - id: task-a\n    role: backend\n    title: Fix\n    depends_on: []\n');
  write(path.join(f.harnessDir, 'flows', 'development.yaml'), `name: development\nconsumes: red\nproduces: green\nsteps:\n  - id: develop\n    fan_out: {respect: depends_on}\n    step:\n      id: "develop:{task.id}"\n      role: "developer-{role}"\n      branch: "harness/{id}/{task.id}"\n      base: "harness/{id}/integration"\n      input:\n        backlog: [review/verdict.md]\n        repo: true\n`);
  git(f.root, 'branch', 'harness/T-0001/task-a', 'main');
  const existing = path.join(f.root, '.harness', 'worktrees', 'harness__T-0001__task-a');
  git(f.root, 'worktree', 'add', existing, 'harness/T-0001/task-a');
  write(path.join(existing, 'old-task.txt'), 'pre-existing worktree\n');
  git(existing, 'add', 'old-task.txt'); git(existing, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'old task state');
  f.ticket.meta.stage = 'red'; f.backlog.write(f.ticket);
  const prompt = buildPrompt(
    loadFlow(path.join(f.harnessDir, 'flows', 'development.yaml')).steps[0].step,
    { meta: { adapter: 'mock' }, body: 'Developer.' },
    { ticket: f.ticket, backlog: f.backlog, harnessDir: f.harnessDir, repoDir: f.root, config: f.config, vars: { id: f.ticket.meta.id, iter: 1, 'task.id': 'task-a', role: 'backend' } },
  );
  assert.match(prompt, /major: unicode\.txt:1 fix it/, 'latest verdict did not reach the developer prompt');
  await runFlow({ flow: loadFlow(path.join(f.harnessDir, 'flows', 'development.yaml')), ...f, repoDir: f.root, auto: true });
  const wt = path.join(f.root, '.harness', 'worktrees', 'harness__T-0001__task-a');
  assert.equal(fs.existsSync(path.join(wt, 'unicode.txt')), true, 'integration content was merged before the agent');
  const taskCommit = git(wt, 'show', '-s', '--format=%B', 'HEAD');
  assert.match(taskCommit, /develop:task-a/);
  const taskDoc = git(wt, 'show', 'HEAD:src/task-a.ts');
  assert.match(taskDoc, /ok/);
  assert.match(f.messages.join('\n'), /synced to harness\/T-0001\/integration/);
  assert.match(f.messages.join('\n'), /develop:task-a/);
  assert.match(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), /step=develop:task-a/);
});

await scenario('EDGE-11', 'legacy ticket history remains readable and unchanged', () => {
  const f = fixture();
  const legacy = { stage: 'green', run: 1, flow: 'development', at: '2026-08-22T00:00:00.000Z', cost: 1 };
  f.ticket.meta.history = [legacy]; f.backlog.write(f.ticket);
  assert.deepEqual(f.backlog.read(f.ticket.meta.id).meta.history, [legacy]);
});

await scenario('AC-29/EDGE-13', 'suite discovery and frozen contracts remain intact with no new dependency', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(spike, 'package.json'))).scripts.test, 'node test/run.js');
  for (const name of ['review-artifacts.schema.json', 'ticket-review-state.schema.json']) JSON.parse(fs.readFileSync(path.join(contracts, name), 'utf8'));
  const contractsBase = git(repo, 'log', '-1', '--format=%H', '--', 'contracts/Q-0006');
  assert.match(contractsBase, /^[0-9a-f]{40}$/);
  assert.equal(git(repo, 'diff', `${contractsBase}..HEAD`, '--', 'contracts/Q-0006'), '');
  const mainPackage = JSON.parse(git(repo, 'show', 'main:spike/package.json'));
  const branchPackage = JSON.parse(fs.readFileSync(path.join(spike, 'package.json')));
  assert.deepEqual(branchPackage.dependencies ?? {}, mainPackage.dependencies ?? {}, 'Q-0006 added a runtime dependency');
});

if (failed) { console.error(`\n✗ ${failed} Q-0006 engine scenario group(s) failed`); process.exit(1); }
