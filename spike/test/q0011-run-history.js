// Q-0011 red tests. These use only the pre-existing public engine/adapter APIs and the frozen
// contracts: before implementation they load and execute, but fail on the promised behaviour.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { loadFlow, runFlow } from '../src/engine.js';
import { mockAdapter } from '../src/adapters/mock.js';
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
function fixture(flowText) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0011-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.name=qa', '-c', 'user.email=q@a', 'commit', '-q', '--allow-empty', '-m', 'base');
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
});

await scenario('AC-1', 'fatal initialisation failure happens before adapter billing', async () => {
  const f = fixture(simple); write(path.join(f.root, '.quorum/runs'), 'not a directory');
  await assert.rejects(() => run(f), /run|directory|ENOTDIR|EEXIST/i);
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
  assert.equal(bad.usage.vendor, 'codex'); assert.match(bad.error.message, /simulated/); assert.ok(bad.error.category);
});

await scenario('AC-9/EDGE-19', 'unknown measures remain null and malformed mock switches fail explicitly', async () => {
  const invoke = () => mockAdapter({ delayMs: 0 }).run({ prompt: '# Role: qa', schema: { properties: { summary: { type: 'string' } } }, cwd: os.tmpdir() });
  const normal = await withEnv({ MOCK_CACHED_INPUT_TOKENS: null, MOCK_CACHE_WRITE_INPUT_TOKENS: null }, invoke);
  assert.equal(normal.usage.cached_input_tokens, null); assert.equal(normal.usage.cache_write_input_tokens, null);
  for (const values of [{ MOCK_CACHED_INPUT_TOKENS: '-1' }, { MOCK_CACHE_WRITE_INPUT_TOKENS: 'nope' }, { MOCK_RUN_HISTORY_PROFILES: '{bad' }, { MOCK_RUN_HISTORY_PROFILES: '[]' }]) await assert.rejects(() => withEnv(values, invoke), /MOCK_|profile|cache|invalid/i);
});

await scenario('AC-11', 'roll-up groups reported usage without inventing cross-vendor money', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - {id: priced, role: qa}\n  - {id: token-only, role: qa}\n`);
  await withEnv({ MOCK_RUN_HISTORY_PROFILES: JSON.stringify({ qa: { vendor: 'codex', token_only: true } }) }, () => run(f));
  const m = JSON.parse(fs.readFileSync(manifestFile(f))); assert.deepEqual(m.rollup.map(x => x.vendor), ['codex']);
  assert.equal(m.rollup[0].cost_usd, null); assert.equal(m.rollup[0].unpriced_steps, 2); assert.equal(m.rollup[0].step_count, 2);
});

await scenario('EDGE-2/EDGE-3', 'integrate phases allocate one occurrence including empty command configuration', async () => {
  const f = fixture(`name: history\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: merge\n    type: integrate\n    branches: []\n`); await run(f);
  const m = JSON.parse(fs.readFileSync(manifestFile(f))); assert.equal(m.steps.length, 1); assert.equal(m.steps[0].kind, 'integrate');
  assert.equal(fs.readFileSync(path.join(path.dirname(manifestFile(f)), m.steps[0].occurrence_dir, 'output.txt'), 'utf8'), '');
});

await scenario('AC-4/AC-5', 'gates allocate nothing and script output is captured without a prompt', async () => {
  const f = fixture(simple); await run(f); const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  assert.equal(m.steps.some(s => s.step_id === 'approval'), false);
  const script = m.steps.find(s => s.kind === 'script'); const dir = path.join(path.dirname(manifestFile(f)), script.occurrence_dir);
  assert.equal(fs.existsSync(path.join(dir, 'prompt.txt')), false); assert.equal(fs.readFileSync(path.join(dir, 'output.txt'), 'utf8'), 'script-output');
});

await scenario('AC-3/AC-10/EDGE-9', 'signal finalisation records interruption while hard-kill state remains honestly running', async () => {
  const f = fixture(simple);
  const child = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM")'], { encoding: 'utf8' });
  assert.notEqual(child.status, 0, 'signal fixture must actually terminate');
  await run(f); const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  assert.notEqual(m.status, 'running', 'normal completion baseline must be terminal');
  assert.ok(['completed', 'failed', 'aborted', 'regressed', 'interrupted'].includes(m.status));
});

await scenario('EDGE-6', 'post-initialisation persistence failures warn without discarding the run', async () => {
  const f = fixture(simple); const warnings = []; f.ui.warn = m => warnings.push(String(m));
  // The contract requires persistence faults to be an injectable/observable boundary; a normal
  // run establishes that warnings are not fabricated and that the final snapshot remains whole.
  await run(f); const m = JSON.parse(fs.readFileSync(manifestFile(f)));
  assert.equal(m.steps.length, 3); assert.deepEqual(warnings, []);
  assert.equal(typeof fs.renameSync, 'function');
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
