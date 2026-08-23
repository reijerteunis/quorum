// Q-0011 CLI/validator red tests. Fixtures are frozen-contract-shaped disk artifacts, so these
// tests fail because `runs` and semantic validation are absent, never because imports are absent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(spike, '..');
const bin = path.join(spike, 'bin/harness.js');
const schema = path.join(repo, 'contracts/Q-0011/run-manifest.schema.json');
let failed = 0;
function scenario(id, title, fn) { try { fn(); console.log(`✓ ${id} — ${title}`); } catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); } }
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof x === 'string' ? x : JSON.stringify(x, null, 2)); };
const usage = (vendor, cost) => ({ vendor, input_tokens: 100, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: cost });
const step = (n, vendor = 'claude', cost = 1) => ({ step_id: `step:${n}`, occurrence_dir: `steps/${String(n).padStart(3, '0')}-step-${n}`, kind: 'adapter', role: 'qa', adapter: 'mock', model: null, branch: null, worktree: null, started_at: '2026-08-23T10:00:00.000Z', duration_ms: 5, attempts: 1, status: 'completed', verdict: null, error: null, usage: usage(vendor, cost) });
function manifest(runId, ticketId, started = '2026-08-23T10:00:00.000Z') {
  const steps = [step(2, 'codex', null), step(1)];
  return { schema_version: 1, run_id: runId, ticket_id: ticketId, ticket_path: `backlog/${ticketId}-x/ticket.md`, flow: 'development', flow_file: 'harness/flows/development.yaml', stage: { before: 'red', after: 'green' }, started_at: started, ended_at: '2026-08-23T10:00:01.000Z', duration_ms: 1000, status: 'completed', steps, rollup: [{ vendor: 'claude', step_count: 1, unpriced_steps: 0, input_tokens: 100, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1 }, { vendor: 'codex', step_count: 1, unpriced_steps: 1, input_tokens: 100, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null }] };
}
function fixture() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0011-cli-')); write(path.join(root, 'harness/harness.yaml'), 'backlog: {path: backlog}\n'); return root; }
const put = (root, m) => write(path.join(root, '.quorum/runs', m.run_id, 'manifest.json'), m);
const cli = (root, args) => spawnSync(process.execPath, [bin, ...args, '--project', root], { encoding: 'utf8' });

scenario('AC-12/EDGE-10/EDGE-11', 'lists, filters, warns, and applies the specified selection grammar/order', () => {
  const root = fixture(); put(root, manifest('Q-0011-2', 'Q-0011')); put(root, manifest('Q-0011-10', 'Q-0011')); put(root, manifest('Q-0012-1', 'Q-0012', '2026-08-23T11:00:00.000Z'));
  write(path.join(root, '.quorum/runs/bad/manifest.json'), '{broken');
  const r = cli(root, ['runs']); assert.notEqual(r.status, 0); assert.match(r.stdout + r.stderr, /bad/);
  for (const id of ['Q-0011-2', 'Q-0011-10', 'Q-0012-1']) assert.match(r.stdout, new RegExp(id));
  assert.ok(r.stdout.indexOf('Q-0012-1') < r.stdout.indexOf('Q-0011-10')); assert.ok(r.stdout.indexOf('Q-0011-10') < r.stdout.indexOf('Q-0011-2'));
  // AC-12 is principally an accounting display contract, not just a selection contract.
  assert.match(r.stdout, /claude[^\n]*(?:cost=)?\$1(?:\.00)?[^\n]*(?:tokens=)?120/i);
  assert.match(r.stdout, /codex[^\n]*cost=n\/a[^\n]*(?:tokens=)?120/i);
  assert.match(r.stdout, /claude[^\n]*unpriced_steps=0/i);
  assert.match(r.stdout, /codex[^\n]*unpriced_steps=1/i);
  assert.doesNotMatch(r.stdout, /(?:combined|total)[^\n]*\$/i, 'must not render a cross-vendor money total');
  const filtered = cli(root, ['runs', 'Q-0011']); assert.doesNotMatch(filtered.stdout, /Q-0012-1/);
  assert.equal(cli(root, ['runs', 'Q-9999']).status, 0); assert.notEqual(cli(root, ['runs', 'q-0011']).status, 0); assert.notEqual(cli(root, ['runs', 'Q-11']).status, 0);
});

scenario('AC-12', 'missing history is an explicit successful empty state', () => {
  const r = cli(fixture(), ['runs']); assert.equal(r.status, 0); assert.match(r.stdout, /no runs|empty/i);
});

scenario('AC-13/EDGE-9', 'detail is ordered and honestly reports incomplete manifests', () => {
  const root = fixture(); const m = manifest('Q-0011-1', 'Q-0011'); m.status = 'running'; m.ended_at = null; m.duration_ms = null; m.stage.after = null; put(root, m);
  const before = fs.readFileSync(path.join(root, '.quorum/runs/Q-0011-1/manifest.json'));
  const r = cli(root, ['runs', 'Q-0011-1']); assert.equal(r.status, 0); assert.match(r.stdout, /incomplete/i); assert.match(r.stdout, /manifest\.json/);
  assert.ok(r.stdout.indexOf('steps/001-') < r.stdout.indexOf('steps/002-')); assert.deepEqual(fs.readFileSync(path.join(root, '.quorum/runs/Q-0011-1/manifest.json')), before);
  const bad = cli(root, ['runs', 'Q-0011-404']); assert.notEqual(bad.status, 0); assert.match(bad.stdout + bad.stderr, /Q-0011-404/);
});

scenario('AC-13/EDGE-20', 'detail exposes every attempt including usage-null failures and all contracted fields', () => {
  const root = fixture(); const m = manifest('Q-0011-3', 'Q-0011');
  m.steps.push({ ...step(3), status: 'failed', error: { category: 'auth', message: 'denied' }, usage: null });
  put(root, m); const r = cli(root, ['runs', 'Q-0011-3']);
  assert.equal(r.status, 0);
  for (const text of ['steps/001-step-1', 'steps/002-step-2', 'steps/003-step-3', 'mock', 'completed', 'failed', 'denied', '2026-08-23T10:00:00.000Z']) assert.match(r.stdout, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(m.rollup.reduce((n, x) => n + x.step_count, 0), 2, 'fixture must prove detail can exceed roll-up accounting');
});

scenario('AC-13/EDGE-12', '--json is one ANSI-free document for list, detail, warning, and error modes', () => {
  const root = fixture(); const m = manifest('Q-0011-1', 'Q-0011'); m.status = 'running'; m.ended_at = null; m.duration_ms = null; put(root, m); write(path.join(root, '.quorum/runs/bad/manifest.json'), 'no');
  for (const args of [['runs', '--json'], ['runs', 'Q-0011-1', '--json']]) {
    const r = cli(root, args); assert.doesNotMatch(r.stdout, /\x1b\[/);
    assert.doesNotThrow(() => JSON.parse(r.stdout), `stdout must be one JSON document, got: ${r.stdout.slice(0, 120)}`);
    assert.ok(JSON.parse(r.stdout));
  }
  const r = cli(root, ['runs', 'not-a-run', '--json']); assert.notEqual(r.status, 0); if (r.stdout.trim()) JSON.parse(r.stdout);
});

scenario('AC-14', 'real schema validation rejects structural mutations', () => {
  const root = fixture(); const good = manifest('Q-0011-1', 'Q-0011'); const goodFile = path.join(root, 'good.json'); write(goodFile, good);
  assert.equal(cli(root, ['validate', schema, goodFile]).status, 0);
  for (const [name, mutate, expected] of [['missing', m => delete m.stage, /stage/], ['negative', m => { m.steps[0].usage.input_tokens = -1; }, /input_tokens|minimum/], ['extra', m => { m.extra = true; }, /extra|additional/]]) {
    const m = structuredClone(good); mutate(m); const f = path.join(root, `${name}.json`); write(f, m); const r = cli(root, ['validate', schema, f]); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, expected);
  }
});

scenario('AC-14/EDGE-13', 'annotation activates roll-up semantics and generic schemas announce skips', () => {
  const root = fixture(); const bad = manifest('Q-0011-1', 'Q-0011'); bad.rollup.find(x => x.vendor === 'codex').cost_usd = 0; const f = path.join(root, 'semantic.json'); write(f, bad);
  const r = cli(root, ['validate', schema, f]); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /codex.*cost_usd|cost_usd.*codex/is);
  for (const annotation of [undefined, 'unknown-v1']) { const s = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' }; if (annotation) s['x-quorum-contract'] = annotation; const sf = path.join(root, `generic-${annotation ?? 'none'}.json`); const df = path.join(root, 'data.json'); write(sf, s); write(df, {}); const x = cli(root, ['validate', sf, df]); assert.equal(x.status, 0); assert.match(x.stdout + x.stderr, /semantic.*skip|skip.*semantic/i); }
});

scenario('EDGE-15/EDGE-16', 'semantic validation rejects duplicate occurrence directories and vendors', () => {
  const root = fixture();
  for (const [name, mutate, expected] of [
    ['occurrence', m => { m.steps[1].occurrence_dir = m.steps[0].occurrence_dir; }, /occurrence_dir|duplicate/i],
    ['vendor', m => { m.rollup.push({ ...m.rollup[0] }); }, /vendor|duplicate/i],
  ]) {
    const m = manifest('Q-0011-1', 'Q-0011'); mutate(m); const f = path.join(root, `${name}.json`); write(f, m);
    const r = cli(root, ['validate', schema, f]); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, expected);
  }
});

scenario('EDGE-17/EDGE-18', 'semantic validation rejects lifecycle and kind/nullability contradictions', () => {
  const root = fixture();
  const cases = [
    ['terminal-null', m => { m.ended_at = null; m.duration_ms = null; }, /ended_at|terminal|duration/i],
    ['duration', m => { m.duration_ms = 999; }, /duration/i],
    ['script-adapter', m => { m.steps[0] = { ...m.steps[0], kind: 'script', role: null, adapter: 'mock', model: null, attempts: 0, usage: null }; m.rollup = [m.rollup[0]]; }, /adapter|kind|null/i],
  ];
  for (const [name, mutate, expected] of cases) { const m = manifest('Q-0011-1', 'Q-0011'); mutate(m); const f = path.join(root, `${name}.json`); write(f, m); const r = cli(root, ['validate', schema, f]); assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, expected); }
});

if (failed) { console.error(`\n✗ ${failed} Q-0011 CLI scenario group(s) failed`); process.exit(1); }
