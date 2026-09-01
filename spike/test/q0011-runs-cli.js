// Q-0011 CLI/validator red tests. Fixtures are frozen-contract-shaped disk artifacts, so these
// tests fail because `runs` and semantic validation are absent, never because imports are absent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateArtifact, validateFile, readData } from '../src/contracts.js';

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
  // Erratum E-4 (solution/errata.md, 2026-08-24). The contract states both "zero matches ... exit
  // zero" (:12) and "a malformed sibling is named ... and the final exit is non-zero" (:18-19), and
  // `root` satisfies both — it carries a deliberately malformed `bad` sibling. Store health wins.
  // Split rather than deleted, so both clauses keep coverage: zero matches on a CLEAN store still
  // exits zero, and the same query over a corrupt store does not.
  assert.equal(cli(fixture(), ['runs', 'Q-9999']).status, 0, 'zero matches on a clean store exits zero');
  assert.notEqual(cli(root, ['runs', 'Q-9999']).status, 0, 'a named malformed sibling forces a non-zero exit even with zero matches');
  assert.notEqual(cli(root, ['runs', 'q-0011']).status, 0); assert.notEqual(cli(root, ['runs', 'Q-11']).status, 0);
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

// The notice's five clauses, as literal assertions rather than as one loose regex. The scenario
// above pins that a notice appears at all; this pins what it says, which is the part that was
// wrong: opening with "run-manifest semantic checks skipped" over somebody else's contract reads
// as a check that was owed and missed. See Q-0037 AC-10.
//
// Both shapes of the one outcome are driven through it, because `unrecognised-annotation` is
// returned for an absent annotation and for a present-but-unsupported value alike, and a notice
// asserted over only the first can claim absence of something the schema is carrying. Q-0037
// review round 1.
scenario('AC-14/EDGE-13', 'the skipped-check notice leads with inapplicability and still names what did not run', () => {
  const root = fixture();
  for (const annotation of [undefined, 'unknown-v1']) {
    const label = annotation ?? 'absent';
    const s = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' };
    if (annotation) s['x-quorum-contract'] = annotation;
    const sf = path.join(root, `other-${label}.schema.json`); const df = path.join(root, `artifact-${label}.json`);
    write(sf, s); write(df, {});
    const out = cli(root, ['validate', sf, df]).stdout;
    const notice = out.split('\n').find(l => l.includes(df) && !l.includes('matches'));
    assert.ok(notice, `no notice line for ${df} (annotation ${label}); got: ${out}`);

    // (1) it names the file.
    assert.ok(notice.includes(df), `the notice must name the file it is about (annotation ${label})`);
    // (3) it leads with inapplicability: the text before the first dash names the annotation that
    //     selects a pass, and does not open with "run-manifest".
    const lead = notice.slice(0, notice.indexOf('—'));
    assert.ok(lead.includes('x-quorum-contract'), `the lead must name the annotation (annotation ${label}); got: ${lead}`);
    assert.doesNotMatch(lead.replace(df, '').replace(/^[^\w]*/, ''), /^run-manifest/, `the notice must not open with run-manifest (annotation ${label})`);
    // (4) it still states explicitly that no run-manifest semantic checks ran, and names the one
    //     contract that is defined — which is what keeps the frozen runs-cli contract satisfied.
    assert.match(notice, /no run-manifest semantic checks ran/);
    assert.match(notice, /run-manifest-v1 is the only contract defined/);
    // (2) and never that any passed.
    assert.doesNotMatch(notice, /pass(ed|es)?\b/i, `a skip is not a pass (annotation ${label})`);
    // (5) and it is not the phrasing that reads as a missing check.
    assert.ok(!notice.includes('run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)'),
      `the superseded wording is still being printed (annotation ${label})`);
    // (6) and it does not claim the annotation is absent, because for `unknown-v1` it is present
    //     and merely unsupported. This is the clause that discriminates the two shapes: it is the
    //     only assertion here that fails against the wording this scenario shipped with.
    assert.ok(!notice.includes('no x-quorum-contract annotation'),
      `the notice claims the annotation is missing, which is false when it is present and unrecognised (annotation ${label}); got: ${notice}`);
  }

  // The run-manifest path is untouched: a clean manifest earns its green tick and no notice.
  const good = path.join(root, 'clean.json'); write(good, manifest('Q-0011-1', 'Q-0011'));
  const ok = cli(root, ['validate', schema, good]);
  assert.equal(ok.status, 0); assert.match(ok.stdout, /✓/);
  assert.doesNotMatch(ok.stdout, /x-quorum-contract|checks ran/, 'a recognised contract prints no skip notice');
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

// validateArtifact is the single-read entry point the CLI now calls; validateFile is kept, unchanged
// and still called by q0034-review-fixes.js. Their structural halves must not drift apart, which is
// the whole risk of having two of them. See Q-0037 AC-9.
scenario('Q-0037 AC-9', 'an artifact is read once per validate, and the two functions agree structurally', () => {
  const root = fixture();
  const generic = path.join(root, 'generic.schema.json');
  write(generic, { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['a'] });
  const clean = path.join(root, 'clean.json'); write(clean, manifest('Q-0011-1', 'Q-0011'));
  const valid = path.join(root, 'valid.json'); write(valid, { a: 1 });
  const invalid = path.join(root, 'invalid.json'); write(invalid, { b: 1 });
  const notAManifest = path.join(root, 'not-a-manifest.json'); write(notAManifest, { run_id: 5 });
  // The real contract, minus its `$id`. The one ajv instance caches every compiled schema by `$id`
  // for the life of the process — a preserved defect (Q-0045 AC-8 defect 1), which is why the CLI
  // spawns per invocation and why compiling the committed file more than once in THIS process
  // throws "already exists". Dropping the key is enough: every `$ref` in it is an internal
  // `#/$defs/…` pointer resolved against the document, and `x-quorum-contract` is what selects the
  // pass. The committed file itself is still exercised once below, so the annotation that matters
  // is read from the real thing rather than only from a copy.
  const { $id: _unused, ...annotated } = readData(schema);
  const rmSchema = path.join(root, 'run-manifest-noid.schema.json'); write(rmSchema, annotated);

  // The CLI used to call validateFile and then readData(dataFile) again a line later, so every
  // artifact was opened and parsed twice and the two reads could disagree if the file moved between
  // them. Counted here rather than reasoned about, because "reads once" is invisible in the output.
  const real = fs.readFileSync;
  const reads = [];
  fs.readFileSync = (p, ...rest) => { reads.push(String(p)); return real(p, ...rest); };
  try { validateArtifact(schema, clean); } finally { fs.readFileSync = real; }
  assert.equal(reads.filter((p) => p === clean).length, 1, `the artifact must be read exactly once; got ${reads.filter((p) => p === clean).length}`);
  assert.equal(reads.filter((p) => p === schema).length, 1, `the schema must be read exactly once; got ${reads.filter((p) => p === schema).length}`);

  // Every combination in which the semantic pass does not run or finds nothing — which is every
  // combination in which the two functions are comparable at all. A divergence here means the
  // convergence went wrong.
  for (const [schemaFile, dataFile, note] of [
    [generic, valid, 'generic schema, valid data — no pass selected'],
    [generic, invalid, 'generic schema, invalid data — no pass selected'],
    [rmSchema, notAManifest, 'run-manifest schema, structurally invalid — pass skipped'],
    [rmSchema, clean, 'run-manifest schema, clean — pass runs and finds nothing'],
  ]) {
    const a = validateArtifact(schemaFile, dataFile);
    const v = validateFile(schemaFile, dataFile);
    assert.deepEqual({ ok: a.ok, errors: a.errors, schema: a.schema, data: a.data }, v, `${note}: structural halves must agree`);
  }

  // And the three-state outcome is the thing a caller reads, never `ok`: a skip is not a pass.
  assert.deepEqual(validateArtifact(generic, valid).semantic, { contract: null, ran: false, reason: 'unrecognised-annotation' });
  assert.deepEqual(validateArtifact(rmSchema, notAManifest).semantic, { contract: 'run-manifest-v1', ran: false, reason: 'structurally-invalid' });
  assert.deepEqual(validateArtifact(rmSchema, clean).semantic, { contract: 'run-manifest-v1', ran: true });
});

if (failed) { console.error(`\n✗ ${failed} Q-0011 CLI scenario group(s) failed`); process.exit(1); }
