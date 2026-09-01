// Q-0049 AC-7 and AC-8: the roll-up's arithmetic, and the two classifiers beside it.
//
// Every case here is a plain object handed to a pure function, which is deliberate: the roll-up's
// three defects — a failed step dropped, a null cost accumulated from zero, a measure invented —
// are all reachable without a filesystem, and a fixture that needed a run to reproduce one would be
// a fixture nobody writes.
import { describe, expect, test } from 'vitest';

import { USAGE_MEASURES } from '@quorum/shared';

import { countUsage, errorOf, normaliseUsage, rollup } from './manifest.js';
import type { ErrorCategory, Occurrence, OccurrenceUsage, RunStatus } from './manifest.js';
import { repoFile } from '../../test/corpus.js';

/** The frozen contract, read as the authority on which vocabularies the types must admit. */
const schema = (): Record<string, unknown> =>
  JSON.parse(repoFile('contracts/Q-0011/run-manifest.schema.json')) as Record<string, unknown>;

/** One `$defs` entry's own `properties` block. */
const definition = (name: string): Record<string, { enum?: string[]; minLength?: number }> => {
  const defs = schema().$defs as Record<string, { properties: Record<string, { enum?: string[]; minLength?: number }> }>;
  return defs[name].properties;
};

/** An occurrence with everything defaulted, so a case states only what it is about. */
const occurrence = (fields: Partial<Occurrence> = {}): Occurrence => ({
  step_id: 'step',
  occurrence_dir: 'steps/001-step',
  kind: 'adapter',
  role: null,
  adapter: 'mock',
  model: null,
  branch: null,
  worktree: null,
  started_at: '2026-08-28T10:00:00.000Z',
  duration_ms: 1,
  attempts: 1,
  status: 'completed',
  verdict: null,
  error: null,
  usage: null,
  ...fields,
});

/** A usage report with every measure explicit, so a case states only the ones it cares about. */
const usage = (fields: Partial<OccurrenceUsage> & { vendor: string }): OccurrenceUsage => ({
  input_tokens: null,
  output_tokens: null,
  cached_input_tokens: null,
  cache_write_input_tokens: null,
  cost_usd: null,
  ...fields,
});

describe('AC-7 — the roll-up is per vendor, includes what failed, and invents no money', () => {
  /**
   * One run of each shape the criterion names, in one list so the rows can be asserted field by
   * field against each other: a priced vendor, a vendor that reports only tokens, an occurrence
   * that failed after it was billed, and two that reported nothing at all.
   */
  const RUN: Occurrence[] = [
    occurrence({ usage: usage({ vendor: 'priced', input_tokens: 100, output_tokens: 20, cost_usd: 0.25 }) }),
    occurrence({ usage: usage({ vendor: 'tokens-only', input_tokens: 7000, output_tokens: 300 }) }),
    occurrence({ kind: 'script', adapter: null, usage: null }),
    occurrence({ kind: 'integrate', adapter: null, usage: null }),
    occurrence({ status: 'failed', usage: usage({ vendor: 'priced', input_tokens: 40, output_tokens: 5, cost_usd: 4.54 }) }),
    occurrence({ usage: null }),
    occurrence({ usage: usage({ vendor: 'tokens-only', input_tokens: 1000, output_tokens: 100 }) }),
  ];

  test('one row per vendor, in first-appearance order, summed over reported values only', () => {
    expect(rollup(RUN)).toStrictEqual([
      {
        vendor: 'priced', step_count: 2, unpriced_steps: 0,
        input_tokens: 140, output_tokens: 25,
        cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 4.79,
      },
      {
        vendor: 'tokens-only', step_count: 2, unpriced_steps: 2,
        input_tokens: 8000, output_tokens: 400,
        cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
      },
    ]);
  });

  test('a failed occurrence that was billed is in the roll-up — status is never consulted', () => {
    // The M0 defect, in the shape it had: a filter on status looks obviously right, and one crashed
    // review hid $4.54 of a $10.25 run. Asserted by removing the failure and watching the total
    // move, so the claim is about this occurrence rather than about the total happening to be right.
    const withoutFailure = RUN.filter((step) => step.status !== 'failed');
    expect(rollup(withoutFailure)[0].cost_usd).toBe(0.25);
    expect(rollup(RUN)[0].cost_usd).toBe(4.79);
    expect(rollup(RUN)[0].step_count).toBe(2);
  });

  test('a wholly token-only vendor has cost_usd null and every step unpriced', () => {
    const row = rollup(RUN)[1];
    expect(row.cost_usd).toBeNull();
    expect(row.unpriced_steps).toBe(row.step_count);
    // And no cross-vendor total exists anywhere in the answer: two rows, and nothing above them.
    expect(rollup(RUN)).toHaveLength(2);
  });

  test('an occurrence with no usage creates no row, whatever its kind', () => {
    expect(rollup([occurrence({ kind: 'script', adapter: null }), occurrence({ kind: 'integrate', adapter: null })])).toStrictEqual([]);
    expect(rollup([])).toStrictEqual([]);
  });

  test('a reported 0 is not a null, and a null is not a 0', () => {
    // The one distinction the whole subsystem turns on. A vendor that genuinely billed nothing is
    // priced at zero and is not unpriced; a vendor that reported no price is neither.
    const rows = rollup([
      occurrence({ usage: usage({ vendor: 'zero', input_tokens: 0, output_tokens: 0, cost_usd: 0 }) }),
      occurrence({ usage: usage({ vendor: 'silent' }) }),
    ]);
    expect(rows[0]).toMatchObject({ vendor: 'zero', cost_usd: 0, input_tokens: 0, unpriced_steps: 0 });
    expect(rows[1]).toMatchObject({ vendor: 'silent', cost_usd: null, input_tokens: null, unpriced_steps: 1 });
  });

  test('the grouping key is the exact vendor string, never trimmed, cased or mapped', () => {
    const rows = rollup([
      occurrence({ usage: usage({ vendor: 'Mock', cost_usd: 1 }) }),
      occurrence({ usage: usage({ vendor: 'mock', cost_usd: 2 }) }),
      occurrence({ usage: usage({ vendor: 'mock ', cost_usd: 4 }) }),
    ]);
    expect(rows.map((row) => row.vendor)).toStrictEqual(['Mock', 'mock', 'mock ']);
  });
});

describe('AC-8 — usage normalisation invents no measure and drops none', () => {
  test('a falsy report stays null rather than becoming a row of zeros', () => {
    expect(normaliseUsage(null, 'mock')).toBeNull();
    expect(normaliseUsage(undefined, 'mock')).toBeNull();
  });

  test('a report without a vendor takes the fallback, and one with a vendor keeps it', () => {
    expect(normaliseUsage({ input_tokens: 3 }, 'fallback')).toStrictEqual({
      vendor: 'fallback', input_tokens: 3, output_tokens: null,
      cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
    });
    expect(normaliseUsage({ vendor: 'declared' }, 'fallback')?.vendor).toBe('declared');
  });

  test('every measure survives, and an absent one becomes an explicit null', () => {
    const full = normaliseUsage({
      vendor: 'mock', input_tokens: 1, output_tokens: 2,
      cached_input_tokens: 3, cache_write_input_tokens: 4, cost_usd: 5,
    }, 'unused');
    expect(Object.keys(full ?? {}).sort()).toStrictEqual(['vendor', ...USAGE_MEASURES].sort());
    expect(full).toMatchObject({ cached_input_tokens: 3, cache_write_input_tokens: 4 });
    // A genuinely reported zero is not an absent measure, on the way in as well as on the way out.
    expect(normaliseUsage({ vendor: 'mock', cost_usd: 0 }, 'unused')?.cost_usd).toBe(0);
  });

  test('the schema is why the fallback cannot be optional', () => {
    // `vendor` is required with minLength 1, so an absent fallback would leave the key undefined,
    // which JSON.stringify drops — a manifest silently losing a required field.
    const vendor = definition('usage').vendor;
    expect(vendor.minLength).toBe(1);
  });
});

describe('AC-8 — classification is delegated, and every category the schema admits is representable', () => {
  test('auth, through the contract layer\'s own rewritten wording', () => {
    // The pattern exists because authError has already turned a vendor's auth noise into one
    // actionable sentence by the time a failure reaches here, and its own output no longer matches
    // the raw patterns it was built from. This message is recognised by AUTH_REWRITTEN alone.
    expect(errorOf(new Error('mock login expired or missing — run: mock login'), 'mock'))
      .toStrictEqual({ category: 'auth', message: 'mock login expired or missing — run: mock login' });
  });

  test('auth, through the raw vendor wording only the contract layer recognises', () => {
    expect(errorOf(new Error('401 Unauthorized'), 'mock').category).toBe('auth');
  });

  test('transient, and the drift that made re-implementing it a rule rather than a preference', () => {
    expect(errorOf(new Error('socket hang up'), 'mock').category).toBe('transient');
    // `\b5\d\d\b` once called any message carrying a three-digit number transient — a token count
    // sufficed. The imported classifier does not, which is the assertion, not the anecdote.
    expect(errorOf(new Error('the step used 512 tokens and produced nothing'), 'mock').category).toBe('adapter');
  });

  test('everything else is adapter, and a message is never empty', () => {
    expect(errorOf(new Error('the tool wrote nowhere'), 'mock').category).toBe('adapter');
    expect(errorOf(new Error(''), 'mock')).toStrictEqual({ category: 'adapter', message: 'adapter failed' });
    expect(errorOf('thrown as a string', 'mock').message).toBe('thrown as a string');
    expect(errorOf({ nothing: true }, 'mock').message).toBe('[object Object]');
  });

  test('the type admits all eight categories the schema does, and the function produces three', () => {
    // The other five are written by callers this module does not own — a script failure, an
    // integrate failure, invalid structured output, a signal, and the fallback — so each must be
    // constructible without a widening cast at the call site.
    const every: ErrorCategory[] = [
      'auth', 'transient', 'structured_output', 'adapter', 'script', 'integrate', 'interrupted', 'unknown',
    ];
    expect(definition('error').category.enum).toStrictEqual(every);
    const carried = every.map((category): Occurrence => occurrence({ error: { category, message: 'x' } }));
    expect(carried.map((step) => step.error?.category)).toStrictEqual(every);
    // @ts-expect-error the set is closed: a ninth category is not one (AC-8)
    const outOfSet: ErrorCategory = 'billing';
    expect(outOfSet).toBe('billing');
  });

  test('and RunStatus admits exactly the statuses the schema does', () => {
    // The list is a `Record<RunStatus, true>` rather than a `RunStatus[]` because the array form
    // could not fail in the direction that mattered: a hand-written array is merely *assignable* to
    // `RunStatus[]`, so widening the type left this green while its own title stopped being true.
    // A record is exhaustive in both directions — a new member is a missing key and a removed one
    // is an excess key, each a compile error — so the schema list below is derived from the type
    // instead of being a second copy of it. Q-0040's `undecided` is what made the old hole visible,
    // by widening `RunStatus` without turning anything red.
    const every = {
      running: true, completed: true, failed: true, aborted: true,
      regressed: true, exhausted: true, interrupted: true, undecided: true,
    } satisfies Record<RunStatus, true>;
    const status = (schema().properties as Record<string, { enum?: string[] }>).status;
    expect(status.enum).toStrictEqual(Object.keys(every));
    // @ts-expect-error the set is closed: `cancelled` is not a run status (AC-9)
    const outOfSet: RunStatus = 'cancelled';
    expect(outOfSet).toBe('cancelled');
  });
});

describe('AC-7 — an unpriced call is counted, never zeroed, and tokens exclude the cache breakdown', () => {
  test('a priced call contributes its cost and nothing to the unpriced count', () => {
    expect(countUsage(usage({ vendor: 'mock', input_tokens: 10, output_tokens: 5, cost_usd: 1.5 })))
      .toStrictEqual({ cost: 1.5, tokens: 15, unpriced: 0 });
  });

  test('an unpriced call contributes tokens and one unpriced step', () => {
    expect(countUsage(usage({ vendor: 'mock', input_tokens: 10, output_tokens: 5 })))
      .toStrictEqual({ cost: 0, tokens: 15, unpriced: 1 });
  });

  test('the cache measures are already inside input_tokens and are not added again', () => {
    expect(countUsage(usage({
      vendor: 'mock', input_tokens: 1000, output_tokens: 100,
      cached_input_tokens: 900, cache_write_input_tokens: 50, cost_usd: 2,
    }))).toStrictEqual({ cost: 2, tokens: 1100, unpriced: 0 });
  });

  test('nothing reported contributes nothing', () => {
    expect(countUsage(null)).toStrictEqual({ cost: 0, tokens: 0, unpriced: 0 });
    expect(countUsage(undefined)).toStrictEqual({ cost: 0, tokens: 0, unpriced: 0 });
  });
});
