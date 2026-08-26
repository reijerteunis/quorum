// Q-0045 AC-5, AC-6, AC-8 defects 4 and 6, and AC-10's first bullet: the `run-manifest-v1`
// semantic pass, and the roll-up it recomputes.
//
// Every fixture below is STRUCTURALLY VALID against the real frozen contract, and the suite asserts
// that before asserting anything else. That is the whole claim: JSON Schema cannot tell a genuinely
// reported zero from an unpriced vendor's `null` mutated to `0`, and a fixture that failed the
// schema would prove the pass catches something the schema already catches.
//
// The `$id` budget of this file is ONE — `contracts/Q-0011/run-manifest.schema.json` is parsed once
// and the same object is handed to every `validate` call (AC-8 defect 1).
import { describe, expect, test } from 'vitest';

import { checkRunManifestSemantics, validate } from './contracts.js';
import { repoFile } from '../../test/corpus.js';

/** The frozen contract the semantic pass extends. Read from the repository, not copied. */
const manifestSchema: unknown = JSON.parse(repoFile('contracts/Q-0011/run-manifest.schema.json'));

const STARTED = '2026-08-26T10:00:00.000Z';
const ENDED = '2026-08-26T10:00:01.000Z';

type Json = Record<string, unknown>;

/** A vendor's usage for one occurrence; every measure is present, `null` meaning "not reported". */
const usage = (vendor: string, measures: Json = {}): Json => ({
  vendor,
  input_tokens: null,
  output_tokens: null,
  cached_input_tokens: null,
  cache_write_input_tokens: null,
  cost_usd: null,
  ...measures,
});

/** One roll-up row, with the same defaults, so a fixture states only the field it is about. */
const row = (vendor: string, fields: Json = {}): Json => ({
  vendor,
  step_count: 1,
  unpriced_steps: 0,
  input_tokens: null,
  output_tokens: null,
  cached_input_tokens: null,
  cache_write_input_tokens: null,
  cost_usd: null,
  ...fields,
});

/** One occurrence. The defaults are a completed adapter call that reported no usage. */
const step = (step_id: string, fields: Json = {}): Json => ({
  step_id,
  occurrence_dir: `steps/00${step_id.length}-${step_id}`,
  kind: 'adapter',
  role: null,
  adapter: 'mock',
  model: null,
  branch: null,
  worktree: null,
  started_at: STARTED,
  duration_ms: 5,
  attempts: 1,
  status: 'completed',
  verdict: null,
  error: null,
  usage: null,
  ...fields,
});

/** A clean, completed run with one occurrence and no usage anywhere. */
const manifest = (fields: Json = {}): Json => ({
  schema_version: 1,
  run_id: 'Q-0045-1',
  ticket_id: 'Q-0045',
  ticket_path: 'backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
  flow: 'chore',
  flow_file: 'harness/flows/chore.yaml',
  stage: { before: 'requirements', after: 'reviewed' },
  started_at: STARTED,
  ended_at: ENDED,
  duration_ms: 1000,
  status: 'completed',
  steps: [step('one')],
  rollup: [],
  ...fields,
});

/**
 * The semantic problems in `data`, after proving the fixture is structurally valid — so a fixture
 * that drifted out of the contract fails here rather than silently testing the wrong document.
 */
const semanticsOf = (data: Json): string[] => {
  expect(validate(manifestSchema, data), `fixture violates the frozen contract: ${JSON.stringify(data)}`)
    .toStrictEqual({ ok: true, errors: [] });
  return checkRunManifestSemantics(data);
};

describe('AC-5 — the fourteen messages, verbatim', () => {
  test('a clean manifest reports nothing', () => {
    expect(semanticsOf(manifest())).toStrictEqual([]);
  });

  test('1 — duplicate occurrence_dir', () => {
    const steps = [step('a', { kind: 'script', adapter: null }), step('b', { kind: 'script', adapter: null, occurrence_dir: 'steps/001-a' })];
    expect(semanticsOf(manifest({ steps }))).toStrictEqual(['steps: duplicate occurrence_dir "steps/001-a"']);
  });

  test('2 — duplicate roll-up vendor', () => {
    const steps = [step('one', { usage: usage('claude', { cost_usd: 1.5 }) })];
    const claude = row('claude', { cost_usd: 1.5 });
    expect(semanticsOf(manifest({ steps, rollup: [claude, { ...claude }] })))
      .toStrictEqual(['rollup: duplicate vendor "claude"']);
  });

  test('3 — a terminal run must carry an end and a duration', () => {
    expect(semanticsOf(manifest({ status: 'aborted', ended_at: null, duration_ms: null, steps: [] })))
      .toStrictEqual(['run: terminal status "aborted" requires non-null ended_at and duration_ms']);
  });

  test('4 — a running run must carry neither', () => {
    expect(semanticsOf(manifest({ status: 'running', steps: [] })))
      .toStrictEqual(['run: status "running" requires null ended_at and duration_ms']);
  });

  test('5 — duration_ms must be the interval it claims', () => {
    expect(semanticsOf(manifest({ duration_ms: 999, steps: [] })))
      .toStrictEqual(['run: duration_ms 999 does not match ended_at - started_at (1000)']);
  });

  test('6 — an adapter occurrence names its adapter', () => {
    expect(semanticsOf(manifest({ steps: [step('one', { adapter: null })] })))
      .toStrictEqual(['steps[one]: kind "adapter" requires non-null adapter']);
  });

  test('7 and 9 — a script occurrence carrying an adapter and usage emits both', () => {
    // The case AC-5 names: one occurrence, several messages, and the roll-up still balances.
    const steps = [step('one', { kind: 'script', usage: usage('claude', { cost_usd: 2 }) })];
    expect(semanticsOf(manifest({ steps, rollup: [row('claude', { cost_usd: 2 })] }))).toStrictEqual([
      'steps[one]: kind "script" requires null adapter, got "mock"',
      'steps[one]: kind "script" requires null usage',
    ]);
  });

  test('8 — a non-adapter occurrence carries no model', () => {
    expect(semanticsOf(manifest({ steps: [step('one', { kind: 'integrate', adapter: null, model: 'opus' })] })))
      .toStrictEqual(['steps[one]: kind "integrate" requires null model']);
  });

  test('10 — a terminal occurrence carries a duration', () => {
    expect(semanticsOf(manifest({ steps: [step('one', { status: 'failed', duration_ms: null })] })))
      .toStrictEqual(['steps[one]: terminal status "failed" requires non-null duration_ms']);
  });

  test('11 — a running occurrence carries none', () => {
    expect(semanticsOf(manifest({ steps: [step('one', { status: 'running' })] })))
      .toStrictEqual(['steps[one]: status "running" requires null duration_ms']);
  });

  test('12 — usage with no row', () => {
    expect(semanticsOf(manifest({ steps: [step('one', { usage: usage('codex') })] })))
      .toStrictEqual(['rollup: missing row for vendor "codex" (occurrences report usage but rollup has no entry)']);
  });

  test('13 — a row that disagrees with the occurrences it claims to sum', () => {
    const steps = [step('one', { usage: usage('claude', { cost_usd: 1.5 }) })];
    expect(semanticsOf(manifest({ steps, rollup: [row('claude', { cost_usd: 2 })] }))).toStrictEqual([
      'rollup: vendor "claude" field "cost_usd" is 2, recomputed from occurrence usage is 1.5',
    ]);
  });

  test('14 — a row no occurrence supports', () => {
    expect(semanticsOf(manifest({ rollup: [row('codex')] })))
      .toStrictEqual(['rollup: vendor "codex" has a row but no occurrence reported its usage']);
  });
});

describe('AC-5 — the order is the order the pass pushes, not the order a reader expects', () => {
  test('twelve problems in one manifest, as one ordered array', () => {
    const steps = [
      step('a', { kind: 'script', model: 'opus', status: 'running', usage: usage('codex') }),
      step('b', { occurrence_dir: 'steps/001-a', adapter: null, duration_ms: null }),
    ];
    const claude = row('claude');
    expect(semanticsOf(manifest({
      status: 'running', duration_ms: 999, steps, rollup: [claude, { ...claude }],
    }))).toStrictEqual([
      'steps: duplicate occurrence_dir "steps/001-a"',
      'rollup: duplicate vendor "claude"',
      'run: status "running" requires null ended_at and duration_ms',
      'run: duration_ms 999 does not match ended_at - started_at (1000)',
      'steps[a]: kind "script" requires null adapter, got "mock"',
      'steps[a]: kind "script" requires null model',
      'steps[a]: kind "script" requires null usage',
      'steps[a]: status "running" requires null duration_ms',
      'steps[b]: kind "adapter" requires non-null adapter',
      'steps[b]: terminal status "completed" requires non-null duration_ms',
      'rollup: missing row for vendor "codex" (occurrences report usage but rollup has no entry)',
      'rollup: vendor "claude" has a row but no occurrence reported its usage',
    ]);
  });

  test('an occurrence is named by its step_id, never by its position', () => {
    const steps = [step('first'), step('second', { adapter: null })];
    expect(semanticsOf(manifest({ steps }))).toStrictEqual(['steps[second]: kind "adapter" requires non-null adapter']);
  });
});

describe('AC-6 — the roll-up is recomputed, and null is not zero', () => {
  test('a vendor with one priced and one unpriced occurrence balances against step_count 2', () => {
    const steps = [
      step('a', { usage: usage('claude', { input_tokens: 100, output_tokens: 10, cost_usd: 1.5 }) }),
      step('b', { usage: usage('claude', { input_tokens: 50, output_tokens: 5 }) }),
    ];
    const rollup = [row('claude', { step_count: 2, unpriced_steps: 1, input_tokens: 150, output_tokens: 15, cost_usd: 1.5 })];
    expect(semanticsOf(manifest({ steps, rollup }))).toStrictEqual([]);
  });

  test('a vendor nobody priced recomputes to null, and a row saying 0 is refused by vendor and field', () => {
    // The case the pass was written for: `null` means the vendor reported no price, and rounding it
    // to $0.000 is the fabrication "Codex cost is reported as tokens" forbids.
    const steps = [step('one', { usage: usage('codex', { input_tokens: 900, output_tokens: 90 }) })];
    const rollup = [row('codex', { unpriced_steps: 1, input_tokens: 900, output_tokens: 90, cost_usd: 0 })];
    expect(semanticsOf(manifest({ steps, rollup }))).toStrictEqual([
      'rollup: vendor "codex" field "cost_usd" is 0, recomputed from occurrence usage is null',
    ]);
  });

  test('a genuinely reported zero stays zero', () => {
    const steps = [step('one', { usage: usage('claude', { cost_usd: 0 }) })];
    expect(semanticsOf(manifest({ steps, rollup: [row('claude', { cost_usd: 0 })] }))).toStrictEqual([]);
  });

  test('a null recomputation against a persisted null is not a disagreement', () => {
    const steps = [step('one', { usage: usage('claude', { input_tokens: 10 }) })];
    const rollup = [row('claude', { unpriced_steps: 1, input_tokens: 10 })];
    expect(semanticsOf(manifest({ steps, rollup }))).toStrictEqual([]);
  });

  test('a token total that re-adds a cache component it already contains is caught', () => {
    // spike/test/q0034-review-fixes.js scenario B2: input_tokens already contains both cache
    // components, and a 35% overstatement passed Q-0011's own fixture because it left them null.
    const measures = { input_tokens: 1000, output_tokens: 100, cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1 };
    const steps = [step('one', { usage: usage('claude', measures) })];
    const rollup = [row('claude', { ...measures, input_tokens: 1950 })];
    expect(semanticsOf(manifest({ steps, rollup }))).toStrictEqual([
      'rollup: vendor "claude" field "input_tokens" is 1950, recomputed from occurrence usage is 1000',
    ]);
  });

  test('occurrences that report no usage are skipped, so a gate allocates no row', () => {
    const steps = [step('gate', { kind: 'script', adapter: null }), step('call', { usage: usage('claude', { cost_usd: 3 }) })];
    expect(semanticsOf(manifest({ steps, rollup: [row('claude', { cost_usd: 3 })] }))).toStrictEqual([]);
  });

  test('every field is compared, in the order the seven are listed', () => {
    const steps = [step('one', { usage: usage('claude', { input_tokens: 1, output_tokens: 2, cached_input_tokens: 3, cache_write_input_tokens: 4, cost_usd: 5 }) })];
    const rollup = [row('claude', { step_count: 9, unpriced_steps: 9, input_tokens: 9, output_tokens: 9, cached_input_tokens: 9, cache_write_input_tokens: 9, cost_usd: 9 })];
    expect(semanticsOf(manifest({ steps, rollup }))).toStrictEqual([
      'rollup: vendor "claude" field "step_count" is 9, recomputed from occurrence usage is 1',
      'rollup: vendor "claude" field "unpriced_steps" is 9, recomputed from occurrence usage is 0',
      'rollup: vendor "claude" field "input_tokens" is 9, recomputed from occurrence usage is 1',
      'rollup: vendor "claude" field "output_tokens" is 9, recomputed from occurrence usage is 2',
      'rollup: vendor "claude" field "cached_input_tokens" is 9, recomputed from occurrence usage is 3',
      'rollup: vendor "claude" field "cache_write_input_tokens" is 9, recomputed from occurrence usage is 4',
      'rollup: vendor "claude" field "cost_usd" is 9, recomputed from occurrence usage is 5',
    ]);
  });
});

describe('AC-8 — preserved defects 4 and 6', () => {
  test('defect 4: the pass guards nothing, because AC-7 orders the two passes for it', () => {
    expect(() => checkRunManifestSemantics(null)).toThrow(TypeError);
    // An empty object is not a manifest and is reported as clean, which is exactly why nothing may
    // call this without a structural verdict in hand.
    expect(checkRunManifestSemantics({})).toStrictEqual([]);
  });

  test('defect 6: usage with no vendor groups under the key `undefined` and is named that way', () => {
    const broken = manifest({ steps: [step('one', { usage: { input_tokens: null, output_tokens: null, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null } })] });
    // Structurally invalid — `vendor` is required — so this one deliberately skips `semanticsOf`.
    expect(validate(manifestSchema, broken).ok).toBe(false);
    expect(checkRunManifestSemantics(broken)).toStrictEqual([
      'rollup: missing row for vendor "undefined" (occurrences report usage but rollup has no entry)',
    ]);
  });
});
