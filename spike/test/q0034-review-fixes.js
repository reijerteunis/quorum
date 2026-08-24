// The four defects the Q-0011 review panel raised as blockers, 2026-08-24 (run #12).
//
// Deliberately a NEW file rather than edits to spike/test/q0011-*.js. Those are qa-red's artifacts
// and AC-4 of Q-0034 requires them to pass unmodified; a developer who can edit the tests judging
// the work can make anything green. Each scenario below fails against the pre-fix branch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { FlowError, loadFlow, runFlow } from '../src/engine.js';
import { validateFile } from '../src/contracts.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(spike, '..');
const bin = path.join(spike, 'bin/harness.js');
const manifestSchema = path.join(repoRoot, 'contracts/Q-0011/run-manifest.schema.json');

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof x === 'string' ? x : JSON.stringify(x, null, 2)); };
const cli = (root, args) => spawnSync(process.execPath, [bin, ...args, '--project', root], { encoding: 'utf8' });

// A repo with a two-step parallel flow on the mock adapter. Parallelism is the point: the leak
// only appears while one occurrence is still running and a sibling's terminal write serialises the
// whole steps array.
function runRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0034-fixes-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  write(path.join(harnessDir, 'roles', 'pm.md'), '---\nadapter: mock\n---\nPM.\n');
  write(path.join(harnessDir, 'flows', 'pair.yaml'), [
    'name: pair', 'consumes: draft', 'produces: requirements', 'steps:',
    '  - parallel:',
    '    - id: a', '      role: pm', '      adapter: mock',
    '      input: { backlog: [ticket.md] }', '      output: { write: requirements/a.md }',
    '    - id: b', '      role: pm', '      adapter: mock',
    '      input: { backlog: [ticket.md] }', '      output: { write: requirements/b.md }',
  ].join('\n') + '\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Review fixes', intent: 'Fixture.', owner: 'qa' });
  return { root, harnessDir, backlog, ticket, flow: loadFlow(path.join(harnessDir, 'flows', 'pair.yaml')) };
}

console.log('q0034 review fixes');

await scenario('B1', 'no bookkeeping field reaches a persisted manifest, mid-run included', async () => {
  const { root, harnessDir, backlog, ticket, flow } = runRepo();
  const manifestPath = () => path.join(root, '.quorum', 'runs', `${ticket.meta.id}-1`, 'manifest.json');
  const snapshots = [];
  // Every ui call is a moment the engine considers itself consistent, and in a parallel group at
  // least one lands while a sibling occurrence is still `running`.
  const snapshot = () => { if (fs.existsSync(manifestPath())) snapshots.push(fs.readFileSync(manifestPath(), 'utf8')); };
  const ui = new Proxy({}, { get: (_, name) => (name === 'gate' ? async () => 'advance' : () => snapshot()) });

  await runFlow({ flow, ticket, backlog, harnessDir, repoDir: root, config: {}, ui, auto: true });

  snapshot();
  assert.ok(snapshots.length >= 2, `expected several manifest snapshots, got ${snapshots.length}`);
  const leaked = snapshots.filter((s) => s.includes('_started'));
  assert.equal(leaked.length, 0, `${leaked.length}/${snapshots.length} persisted manifests contain "_started"`);

  // At least one snapshot must have caught a still-running occurrence, or this proves nothing.
  const sawRunning = snapshots.some((s) => (JSON.parse(s).steps ?? []).some((o) => o.status === 'running'));
  assert.ok(sawRunning, 'no snapshot captured a running occurrence — the window this guards was never entered');

  const r = validateFile(manifestSchema, manifestPath());
  assert.ok(r.ok, `final manifest violates the contract: ${(r.errors ?? []).join('; ')}`);
});

await scenario('B2', 'vendor token totals do not add cache components a second time', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0034-tokens-'));
  write(path.join(root, 'harness/harness.yaml'), 'backlog: {path: backlog}\n');
  // Non-null cache fields are the whole point: Q-0011's own CLI fixture leaves them null, which is
  // why a 35% overstatement passed its suite. input_tokens already contains both cache components.
  const usage = { vendor: 'claude', input_tokens: 1000, output_tokens: 100, cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1 };
  write(path.join(root, '.quorum/runs/Q-0011-1/manifest.json'), {
    schema_version: 1, run_id: 'Q-0011-1', ticket_id: 'Q-0011', ticket_path: 'backlog/Q-0011-x/ticket.md',
    flow: 'development', flow_file: 'harness/flows/development.yaml',
    stage: { before: 'red', after: 'green' }, started_at: '2026-08-23T10:00:00.000Z',
    ended_at: '2026-08-23T10:00:01.000Z', duration_ms: 1000, status: 'completed',
    steps: [{ step_id: 'step:1', occurrence_dir: 'steps/001-step-1', kind: 'adapter', role: 'qa', adapter: 'mock', model: null, branch: null, worktree: null, started_at: '2026-08-23T10:00:00.000Z', duration_ms: 5, attempts: 1, status: 'completed', verdict: null, error: null, usage }],
    rollup: [{ vendor: 'claude', step_count: 1, unpriced_steps: 0, input_tokens: 1000, output_tokens: 100, cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1 }],
  });

  const out = cli(root, ['runs', 'Q-0011-1']).stdout;
  assert.match(out, /tokens=1100\b/, `expected input+output=1100; got: ${out.match(/tokens=\d+/g)}`);
  assert.doesNotMatch(out, /tokens=1350\b/, 'cache_write_input_tokens was added to a total that already contains it');
});

await scenario('B3', 'an existing run directory is refused by name, not by raw EEXIST', async () => {
  const { root, harnessDir, backlog, ticket, flow } = runRepo();
  // Occupy the directory this run will allocate. nextRunId never collides on its own, which is why
  // the pre-fix suite exercised the stage guard instead and left this path untested.
  fs.mkdirSync(path.join(root, '.quorum', 'runs', `${ticket.meta.id}-1`), { recursive: true });

  const ui = new Proxy({}, { get: (_, name) => (name === 'gate' ? async () => 'advance' : () => {}) });
  const err = await runFlow({ flow, ticket, backlog, harnessDir, repoDir: root, config: {}, ui, auto: true })
    .then(() => null, (e) => e);

  assert.ok(err, 'a colliding run directory must stop the run');
  // instanceof, not err.name: FlowError does not override name, and bin/harness.js routes on
  // `e instanceof FlowError` to print one sentence instead of a stack. That routing is the
  // difference between a refusal and a raw EEXIST trace.
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err.constructor?.name}: ${err.message}`);
  assert.doesNotMatch(err.message, /EEXIST|mkdir/i, `the errno leaked into the message: ${err.message}`);
  assert.match(err.message, /already exists/i);
  assert.match(err.message, new RegExp(`${ticket.meta.id}-1`), 'the message must name the directory it refused');
});

await scenario('B4', 'a run token cannot select a directory outside .quorum/runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0034-confine-'));
  write(path.join(root, 'harness/harness.yaml'), 'backlog: {path: backlog}\n');
  fs.mkdirSync(path.join(root, '.quorum/runs'), { recursive: true });
  // A manifest-shaped file outside the runs root. Before the fix, "../secret" reached it and
  // --json echoed the parsed document to stdout.
  write(path.join(root, '.quorum/secret/manifest.json'), { run_id: 'X-1', ticket_id: 'X', steps: [], rollup: [], secret_marker: 'LEAKED' });

  for (const token of ['../secret', '.quorum/secret', path.join(root, '.quorum/secret'), '..', '.']) {
    const r = cli(root, ['runs', token, '--json']);
    assert.notEqual(r.status, 0, `token ${JSON.stringify(token)} was accepted`);
    assert.doesNotMatch(r.stdout, /LEAKED/, `token ${JSON.stringify(token)} disclosed a document outside the runs root`);
  }
});

if (failed) { console.error(`\n✗ ${failed} scenario(s) failed`); process.exit(1); }
console.log('\n✓ 4 scenarios passed');
