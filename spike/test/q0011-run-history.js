// Q-0011 red tests. These use only the pre-existing public engine/adapter APIs and the frozen
// contracts: before implementation they load and execute, but fail on the promised behaviour.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { loadFlow, runFlow } from '../src/engine.js';
import { mockAdapter } from '../src/adapters/mock.js';
import { withRetry } from '../src/adapters/index.js';
import { validate } from '../src/contracts.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const schemaFile = path.join(repo, 'contracts/Q-0011/run-manifest.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaFile));
let failed = 0;
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
}
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const withEnv = async (values, fn) => {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  Object.entries(values).forEach(([k, v]) => v == null ? delete process.env[k] : process.env[k] = String(v));
  try { return await fn(); } finally { Object.entries(old).forEach(([k, v]) => v == null ? delete process.env[k] : process.env[k] = v); }
};
function fixture(flowText, { linked = false } = {}) {
  const primary = fs.mkdtempSync(path.join(os.tmpdir(), 'q0011-'));
  git(primary, 'init', '-q', '-b', 'main');
  git(primary, '-c', 'user.name=qa', '-c', 'user.email=q@a', 'commit', '-q', '--allow-empty', '-m', 'base');
  const root = linked ? `${primary}-linked` : primary;
  if (linked) git(primary, 'worktree', 'add', '-q', '-b', 'history-test', root, 'main');
  const harnessDir = path.join(root, 'harness');
  write(path.join(harnessDir, 'harness.yaml'), 'backlog: {path: backlog}\nadapters: {}\nrepo: {base_branch: main}\n');
  write(path.join(harnessDir, 'roles/qa.md'), '---\nadapter: mock\nmodel: test-model\n---\nExact role prompt.\n');
  write(path.join(harnessDir, 'flows/history.yaml'), flowText);
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'History fixture', intent: 'Q-0011' });
  const messages = [];
  const ui = { info: m => messages.push(m), warn: m => messages.push(m), step() {}, done() {}, trace() {}, gate: async () => 'advance' };
  return { root, harnessDir, backlog, ticket, ui, messages, config: { adapterOverride: 'mock', adapters: {}, repo: { base_branch: 'main' } }, flow: loadFlow(path.join(harnessDir, 'flows/history.yaml')) };
}
const simple = `name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: alpha\n    role: qa\n  - id: shell:one\n    type: script\n    run: "printf script-output"\n  - id: approval\n    gate: auto\n  - id: beta/two\n    role: qa\n`;
const run = async (f, extra = {}) => runFlow({ flow: f.flow, ticket: f.ticket, backlog: f.backlog, harnessDir: f.harnessDir, repoDir: f.root, config: f.config, ui: f.ui, auto: true, ...extra });
const runsRoot = f => path.join(f.root, '.quorum/runs');
const manifests = f => fs.existsSync(runsRoot(f)) ? fs.readdirSync(runsRoot(f)).map(d => path.join(runsRoot(f), d, 'manifest.json')) : [];
const manifestFile = f => { const found = manifests(f); assert.equal(found.length, 1, 'expected exactly one persisted run manifest'); return found[0]; };
const readManifest = f => JSON.parse(fs.readFileSync(manifestFile(f), 'utf8'));
const waitFor = async (predicate, message, timeout = 3000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = predicate(); if (value) return value; await new Promise(r => setTimeout(r, 10)); }
  assert.fail(message);
};

await scenario('AC-1', 'initialises exclusively before work and dry-run writes nothing', async () => {
  const dry = fixture(simple); await run(dry, { dry: true });
  assert.equal(fs.existsSync(runsRoot(dry)), false, 'dry run created history');
  const f = fixture(simple); await run(f);
  assert.equal(manifests(f).length, 1, 'non-dry run did not create exactly one manifest');
  const p = manifestFile(f), bytes = fs.readFileSync(p); await assert.rejects(() => runFlow({ flow: f.flow, ticket: { ...f.ticket, meta: { ...f.ticket.meta, stage: 'draft' } }, backlog: f.backlog, harnessDir: f.harnessDir, repoDir: f.root, config: f.config, ui: f.ui, auto: true }), /exist|run directory/i);
  assert.deepEqual(fs.readFileSync(p), bytes, 'existing history was overwritten');
});

await scenario('AC-2/EDGE-7', 'excludes history, leaks no environment, and persists relative paths', async () => {
  const f = fixture(simple); await withEnv({ Q0011_SECRET_NAME: 'q0011-secret-value' }, () => run(f));
  const dir = path.dirname(manifestFile(f)); const all = fs.readdirSync(dir, { recursive: true }).filter(x => fs.statSync(path.join(dir, x)).isFile()).map(x => fs.readFileSync(path.join(dir, x), 'utf8')).join('\n');
  assert.doesNotMatch(all, /Q0011_SECRET_NAME|q0011-secret-value/);
  assert.match(fs.readFileSync(path.join(f.root, '.git/info/exclude'), 'utf8'), /^\.quorum\/$/m);
  const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  for (const p of [m.ticket_path, m.flow_file, ...m.steps.map(s => s.worktree).filter(Boolean)]) assert.equal(path.isAbsolute(p), false, p);
  assert.doesNotMatch(all, /"argv"\s*:|"command"\s*:|process\.env/);
  assert.equal(Object.hasOwn(schema.$defs.step.properties, 'argv'), false);

  // Exercise the repository shape Harness itself uses: in a linked worktree `.git` is a file,
  // and the exclude file lives in the primary repository's real git directory.
  const linked = fixture(simple, { linked: true });
  assert.equal(fs.statSync(path.join(linked.root, '.git')).isFile(), true, 'fixture is not a linked worktree');
  const before = git(linked.root, 'status', '--porcelain');
  await run(linked);
  const exclude = git(linked.root, 'rev-parse', '--git-path', 'info/exclude');
  const excludeFile = path.isAbsolute(exclude) ? exclude : path.join(linked.root, exclude);
  assert.match(fs.readFileSync(excludeFile, 'utf8'), /^\.quorum\/$/m);
  assert.equal(git(linked.root, 'status', '--porcelain'), before, 'run history dirtied the linked worktree');
});

await scenario('AC-1', 'fatal initialisation failure happens before adapter billing', async () => {
  const f = fixture(simple); write(path.join(f.root, '.quorum/runs'), 'not a directory');
  await assert.rejects(() => run(f), /run|directory|ENOTDIR|EEXIST/i);
  assert.doesNotMatch(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), /\bstep=|\bvendor=/, 'fatal initialisation billed an adapter');
  assert.equal(fs.readFileSync(path.join(f.root, '.quorum/runs'), 'utf8'), 'not a directory');
});

await scenario('AC-3/AC-4/AC-5/AC-8', 'atomic manifest records every real occurrence and exact artifacts', async () => {
  const f = fixture(simple); await run(f); const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  assert.equal(m.status, 'completed'); assert.equal(m.ended_at !== null && m.duration_ms >= 0, true);
  assert.deepEqual(m.steps.map(s => s.step_id), ['alpha', 'shell:one', 'beta/two']);
  assert.deepEqual(m.steps.map(s => s.occurrence_dir), ['steps/001-alpha', 'steps/002-shell-one', 'steps/003-beta-two']);
  assert.deepEqual(m.steps.map(s => s.attempts), [1, 0, 1]);
  for (const s of m.steps) {
    const d = path.join(path.dirname(manifestFile(f)), s.occurrence_dir);
    assert.equal(fs.existsSync(path.join(d, 'output.txt')), true, s.step_id);
    assert.equal(fs.existsSync(path.join(d, 'prompt.txt')), s.kind === 'adapter', s.step_id);
  }
  assert.equal(validate(schema, m).ok, true);
  assert.doesNotMatch(fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8'), /Exact role prompt/);
});

await scenario('AC-9/AC-10/EDGE-4', 'mock preserves per-call usage and billed failure detail', async () => {
  const direct = await withEnv({ MOCK_VENDOR: 'claude', MOCK_CACHED_INPUT_TOKENS: '7', MOCK_CACHE_WRITE_INPUT_TOKENS: '3' }, () => mockAdapter({ delayMs: 0 }).run({ prompt: '# Role: qa', schema: { properties: { summary: { type: 'string' } } }, cwd: os.tmpdir() }));
  assert.equal(direct.vendor, 'claude'); assert.equal(direct.usage.vendor, 'claude');
  assert.equal(direct.usage.cached_input_tokens, 7); assert.equal(direct.usage.cache_write_input_tokens, 3);
  const f = fixture(simple); await assert.rejects(() => withEnv({ MOCK_FAIL_WRITE: 'Exact role prompt', MOCK_VENDOR: 'codex' }, () => run(f)));
  const m = JSON.parse(fs.readFileSync(manifestFile(f))); const bad = m.steps.find(s => s.status === 'failed');
  assert.equal(bad.usage.vendor, 'codex'); assert.match(bad.error.message, /simulated/);
  assert.equal(bad.error.category, 'adapter');
  assert.equal(bad.attempts, 1, 'failing-path attempts must equal actual invocations');
  const detail = spawnSync(process.execPath, [path.join(spike, 'bin/harness.js'), 'runs', m.run_id, '--project', f.root], { encoding: 'utf8' });
  assert.equal(detail.status, 0, detail.stderr); assert.match(detail.stdout, /simulated/); assert.match(detail.stdout, /codex/);
  assert.match(detail.stdout, /input_tokens|tokens/i, 'separate reader process omitted billed failure usage');
});

await scenario('AC-3', 'parallel terminal updates retain both step records', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - parallel:\n      - {id: left, role: qa}\n      - {id: right, role: qa}\n`);
  await run(f); const m = readManifest(f);
  assert.equal(m.steps.length, 2);
  assert.deepEqual(new Set(m.steps.map(s => s.step_id)), new Set(['left', 'right']));
  assert.equal(m.steps.every(s => s.status === 'completed'), true);
});

await scenario('AC-9/EDGE-19', 'unknown measures remain null and malformed mock switches fail explicitly', async () => {
  const invoke = () => mockAdapter({ delayMs: 0 }).run({ prompt: '# Role: qa', schema: { properties: { summary: { type: 'string' } } }, cwd: os.tmpdir() });
  const normal = await withEnv({ MOCK_CACHED_INPUT_TOKENS: null, MOCK_CACHE_WRITE_INPUT_TOKENS: null }, invoke);
  assert.equal(normal.usage.cached_input_tokens, null); assert.equal(normal.usage.cache_write_input_tokens, null);
  for (const values of [{ MOCK_CACHED_INPUT_TOKENS: '-1' }, { MOCK_CACHE_WRITE_INPUT_TOKENS: 'nope' }, { MOCK_RUN_HISTORY_PROFILES: '{bad' }, { MOCK_RUN_HISTORY_PROFILES: '[]' }]) await assert.rejects(() => withEnv(values, invoke), /MOCK_|profile|cache|invalid/i);
});

await scenario('AC-8/AC-10', 'retry wrapper exposes exact attempts and preserves billed usage on success and failure', async () => {
  let calls = 0;
  const usage = { vendor: 'claude', input_tokens: 10, output_tokens: 2, cached_input_tokens: 3, cache_write_input_tokens: 1, cost_usd: 0.5 };
  const flaky = withRetry({ vendor: 'claude', async run() { calls++; if (calls < 3) { const e = new Error('socket hang up'); e.usage = usage; e.vendor = 'claude'; throw e; } return { vendor: 'claude', output: {}, raw: '', usage, ms: 1 }; } }, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 });
  const success = await flaky.run({});
  assert.equal(success.attempts, 3); assert.equal(success.usage.cached_input_tokens, 9); assert.equal(success.usage.cache_write_input_tokens, 3);
  calls = 0;
  const exhausted = withRetry({ vendor: 'claude', async run() { calls++; const e = new Error('socket hang up'); e.usage = usage; e.vendor = 'claude'; throw e; } }, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 });
  await assert.rejects(() => exhausted.run({}), e => {
    assert.equal(e.attempts, 3); assert.equal(e.vendor, 'claude');
    assert.equal(e.usage.cached_input_tokens, 9); assert.equal(e.usage.cache_write_input_tokens, 3);
    return true;
  });
});

await scenario('AC-11', 'roll-up groups reported usage without inventing cross-vendor money', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - {id: priced, role: priced}\n  - {id: token-only, role: token}\n  - {id: no-usage, role: broken}\n`);
  for (const role of ['priced', 'token', 'broken']) write(path.join(f.harnessDir, `roles/${role}.md`), `---\nadapter: mock\n---\n${role}\n`);
  await assert.rejects(() => withEnv({ MOCK_RUN_HISTORY_PROFILES: JSON.stringify({ priced: { vendor: 'claude' }, token: { vendor: 'codex', token_only: true }, broken: { vendor: 'ghost', cached_input_tokens: -1 } }) }, () => run(f)), /profile|cache|invalid/i);
  const m = readManifest(f);
  assert.deepEqual(m.rollup.map(x => x.vendor).sort(), ['claude', 'codex']);
  const codex = m.rollup.find(x => x.vendor === 'codex');
  assert.equal(codex.cost_usd, null); assert.equal(codex.unpriced_steps, 1);
  assert.equal(m.steps.find(x => x.step_id === 'no-usage').usage, null);
  assert.equal(m.rollup.some(x => x.vendor === 'ghost'), false, 'usage-null failure created a vendor row');
  const recomputed = new Map();
  for (const { usage } of m.steps) if (usage) {
    const x = recomputed.get(usage.vendor) ?? { step_count: 0, unpriced_steps: 0, input_tokens: 0, output_tokens: 0, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 0 };
    x.step_count++; x.unpriced_steps += usage.cost_usd == null ? 1 : 0;
    for (const k of ['input_tokens', 'output_tokens']) x[k] += usage[k];
    for (const k of ['cached_input_tokens', 'cache_write_input_tokens']) if (usage[k] != null) x[k] = (x[k] ?? 0) + usage[k];
    if (usage.cost_usd == null) x.cost_usd = null; else if (x.cost_usd != null) x.cost_usd += usage.cost_usd;
    recomputed.set(usage.vendor, x);
  }
  assert.deepEqual(Object.fromEntries(m.rollup.map(({ vendor, ...x }) => [vendor, x])), Object.fromEntries(recomputed));

  // A vendor-reported zero is a known price, unlike null. Keep this assertion separate from the
  // mock profile (whose frozen switch surface intentionally has no arbitrary cost override).
  const reportedZero = { ...m.steps.find(x => x.usage)?.usage, vendor: 'zero-priced', cost_usd: 0 };
  const zero = { step_count: 0, unpriced_steps: 0, cost_usd: 0 };
  zero.step_count++; zero.unpriced_steps += reportedZero.cost_usd == null ? 1 : 0; zero.cost_usd += reportedZero.cost_usd;
  assert.deepEqual(zero, { step_count: 1, unpriced_steps: 0, cost_usd: 0 });
});

await scenario('EDGE-21', 'structured-output and script failures map to their exact categories', async () => {
  const scripts = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: broken-script\n    type: script\n    run: "printf script-broke >&2; exit 9"\n`);
  await run(scripts);
  const scriptOccurrence = readManifest(scripts).steps.find(x => x.step_id === 'broken-script');
  assert.equal(scriptOccurrence.status, 'failed');
  assert.equal(scriptOccurrence.error.category, 'script');

  // A tiny executable stands in for Codex's already-installed CLI boundary. It exits cleanly but
  // writes `{}`, which violates the engine-generated schema's required `summary` property.
  const structured = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: malformed-tail\n    role: qa\n`);
  const fake = path.join(structured.root, 'fake-codex');
  write(fake, `#!/bin/sh\nout=''\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = '-o' ]; then shift; out="$1"; fi\n  shift\ndone\nprintf '{}' > "$out"\nexit 0\n`);
  fs.chmodSync(fake, 0o755);
  structured.config.adapterOverride = 'codex';
  structured.config.adapters = { codex: { bin: fake, retry: { attempts: 1 } } };
  await assert.rejects(() => run(structured), /structured output invalid/i);
  const malformed = readManifest(structured).steps.find(x => x.step_id === 'malformed-tail');
  assert.equal(malformed.status, 'failed');
  assert.equal(malformed.error.category, 'structured_output');
});

await scenario('EDGE-2/EDGE-3', 'integrate phases allocate one occurrence including empty command configuration', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: merge\n    type: integrate\n    branches: []\n`); await run(f);
  const m = JSON.parse(fs.readFileSync(manifestFile(f))); assert.equal(m.steps.length, 1); assert.equal(m.steps[0].kind, 'integrate');
  assert.equal(fs.readFileSync(path.join(path.dirname(manifestFile(f)), m.steps[0].occurrence_dir, 'output.txt'), 'utf8'), '');
  const bad = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: merge\n    type: integrate\n    branches: []\n    run_tests: true\n`);
  bad.config.commands = { install: 'printf install-failed >&2; exit 7', test: 'true' };
  await assert.rejects(() => run(bad), /install failed/i);
  const occurrence = readManifest(bad).steps[0];
  assert.equal(readManifest(bad).steps.length, 1); assert.equal(occurrence.error.category, 'integrate');
});

await scenario('AC-4/AC-5', 'gates allocate nothing and script output is captured without a prompt', async () => {
  const f = fixture(simple); await run(f); const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  assert.equal(m.steps.some(s => s.step_id === 'approval'), false);
  const script = m.steps.find(s => s.kind === 'script'); const dir = path.join(path.dirname(manifestFile(f)), script.occurrence_dir);
  assert.equal(fs.existsSync(path.join(dir, 'prompt.txt')), false); assert.equal(fs.readFileSync(path.join(dir, 'output.txt'), 'utf8'), 'script-output');
});

await scenario('AC-3/AC-10/EDGE-9', 'signal finalisation records interruption while hard-kill state remains honestly running', async () => {
  // The gate promise owns its own libuv handle, which is what keeps the child alive long enough to
  // receive the SIGTERM below. It used to own none, and `runGate` carried a one-second setTimeout
  // that held the loop open on its behalf — a test fixture's prop living in production code, where
  // it made a race look like a guarantee. The prop is gone (Q-0037 AC-1); the handle belongs here.
  //
  // The ceiling is what stops this becoming worse than the defect: spike/test/run.js has no
  // per-scenario timeout, so an unbounded handle would turn a broken engine from a failing suite
  // into a hanging one. Ten seconds is far beyond the milliseconds the SIGTERM actually takes, and
  // if it is ever reached the rejection ends the run and the child exits non-zero, so the assertions
  // below fail rather than never arriving.
  const source = `import { runFlow, loadFlow } from ${JSON.stringify(path.join(spike, 'src/engine.js'))};\nimport { Backlog } from ${JSON.stringify(path.join(spike, 'src/backlog.js'))};\nconst root=process.argv[1], h=root+'/harness', b=new Backlog(root+'/backlog'), t=b.list()[0];\nconst ui={info(){},warn(){},step(){},done(){},trace(){},gate:()=>new Promise((_,reject)=>{setTimeout(()=>reject(new Error('gate ceiling reached')),10000);})};\nawait runFlow({flow:loadFlow(h+'/flows/history.yaml'),ticket:t,backlog:b,harnessDir:h,repoDir:root,config:{adapterOverride:'mock',adapters:{},repo:{base_branch:'main'}},ui,auto:false});`;
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - {id: waiting, gate: human}\n`);
  const child = spawn(process.execPath, ['--input-type=module', '-e', source, f.root], { stdio: 'ignore' });
  await waitFor(() => manifests(f).length === 1, 'harness process never initialised its manifest'); child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve)); const m = readManifest(f);
  assert.equal(m.status, 'interrupted'); assert.equal(m.steps.length, 0, 'gate interruption must allocate no occurrence');
});

await scenario('EDGE-6', 'post-initialisation persistence failures warn without discarding the run', async () => {
  const f = fixture(simple); const warnings = []; f.ui.warn = m => warnings.push(String(m));
  let sabotaged;
  f.ui.step = id => {
    if (!sabotaged && id === 'alpha') {
      sabotaged = path.join(path.dirname(manifestFile(f)), 'steps/001-alpha/output.txt');
      fs.mkdirSync(sabotaged, { recursive: true });
    }
  };
  await run(f); const m = readManifest(f);
  assert.equal(m.steps.length, 3, 'history fault discarded already-paid steps');
  assert.ok(warnings.some(w => w.includes(sabotaged)), 'warning must name the failed persistence path');
});

await scenario('AC-4/EDGE-8', 'backward edge revisits one id without overwriting either occurrence', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: author\n    role: qa\n  - id: between\n    type: script\n    run: "true"\n  - id: review\n    role: qa\n    output: {verdict: "approve|revise"}\n    on_fail: {goto: author, max_iterations: 1, counter: review, on_exhausted: gate}\n`);
  await withEnv({ MOCK_ALWAYS_PASS: null, MOCK_ALWAYS_FAIL: null }, () => run(f)); const m = readManifest(f);
  const authors = m.steps.filter(s => s.step_id === 'author'); assert.equal(authors.length, 2);
  assert.equal(new Set(authors.map(s => s.occurrence_dir)).size, 2);
  for (const x of authors) assert.ok(fs.readFileSync(path.join(path.dirname(manifestFile(f)), x.occurrence_dir, 'output.txt'), 'utf8').length);
});

await scenario('EDGE-21', 'error category vocabulary is frozen and exhaustive', () => {
  assert.deepEqual(schema.$defs.error.properties.category.enum, ['auth', 'transient', 'structured_output', 'adapter', 'script', 'integrate', 'interrupted', 'unknown']);
});

await scenario('EDGE-5/EDGE-8/EDGE-14', 'allocator does not collide, truncate, or emit exhausted', async () => {
  const steps = Array.from({ length: 1000 }, (_, i) => `  - {id: s${i + 1}, type: script, run: "true"}`).join('\n');
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n${steps}\n`); await run(f);
  const m = JSON.parse(fs.readFileSync(manifestFile(f))); assert.match(m.steps[999].occurrence_dir, /^steps\/1000-/);
  assert.equal(m.steps.some(s => s.status === 'exhausted') || m.status === 'exhausted', false);
  assert.equal(new Set(m.steps.map(s => s.occurrence_dir)).size, 1000);
});

await scenario('EDGE-1', 'task ownership remains two-vendor and disjoint', () => {
  const tasks = fs.readFileSync(path.join(repo, 'backlog/Q-0011-run-history-on-disk/solution/tasks.yaml'), 'utf8');
  assert.match(tasks, /role: backend/); assert.match(tasks, /role: tooling/);
  assert.match(tasks, /Own spike\/src\/\*\*/); assert.match(tasks, /Own spike\/bin\/harness\.js/);
});

if (failed) { console.error(`\n✗ ${failed} Q-0011 writer scenario group(s) failed`); process.exit(1); }
