/**
 * Q-0090 AC-4 — one exit-status table, with its key set derived from `@quorum/shared` rather than
 * transcribed from it.
 *
 * **The derivation reads the discriminator index and not the member shapes**, which is the whole
 * point of doing it this way. `runTerminalEventSchema` is a `z.discriminatedUnion` whose first
 * member carries `status: z.literal('regressed')` and whose second carries
 * `status: z.enum([…five])`. A derivation that walked the members looking for literals would see
 * one status, compare it against a one-key map and pass while examining a sixth of its subject —
 * "a check that skips its subject must not report success" (2026-08-25), waiting inside this
 * ticket's own guard. Asking the schema to reject an impossible status instead makes zod report the
 * index it built from *both* members, so no member shape is privileged, and a member that changed
 * from a literal to an enum or the reverse would still be read. See Q-0090 R-6.
 *
 * **Nothing here imports zod.** `packages/cli` declares no third-party dependency (AC-1), so the
 * two one-sided derivations below are written against the shipped schema rather than against
 * fixture unions built with a zod this package does not have. That is the stronger fixture in any
 * case: each is the mistake R-6 names, run over the real subject.
 */
import { runTerminalEventSchema, type RunTerminalEvent } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import {
  ABORTED, ERROR, EXIT_CODE_FOR_STATUS, SIGNAL, SUCCESS, UNDECIDED, type ExitCode,
} from './exit.js';

/** A status no union may legitimately carry, so the parse below always misses every member. */
const IMPOSSIBLE = '__no_such_status__';

/**
 * Every value the shipped schema's discriminator accepts, read out of the issue zod raises when
 * none matches.
 *
 * Throws rather than returning an empty list wherever the schema declines to answer: a derivation
 * that quietly yielded nothing would make every comparison below vacuous, which is the failure this
 * whole file is arranged against.
 */
function discriminatorValues(): string[] {
  const parsed = runTerminalEventSchema.safeParse({ type: 'terminal', status: IMPOSSIBLE });
  if (parsed.success) throw new Error(`${IMPOSSIBLE} was accepted, so no discriminator was checked`);
  const issue = parsed.error.issues.find((candidate) => candidate.code === 'invalid_union');
  if (issue === undefined) throw new Error('no invalid_union issue — the schema is not a discriminated union');
  if (!('options' in issue) || issue.options === undefined) throw new Error('the issue named no discriminator options');
  const values = issue.options.filter((option): option is string => typeof option === 'string');
  if (values.length !== issue.options.length) throw new Error('a discriminator value is not a string');
  return [...values].sort();
}

/** What a derivation that read only the union's `z.literal` members would have seen. */
const literalMembersOnly = (): string[] => runTerminalEventSchema.options
  .flatMap((member) => ('values' in member.shape.status ? [...member.shape.status.values] : []))
  .filter((value) => typeof value === 'string')
  .sort();

/** What a derivation that read only the union's `z.enum` members would have seen. */
const enumMembersOnly = (): string[] => runTerminalEventSchema.options
  .flatMap((member) => ('options' in member.shape.status ? member.shape.status.options : []))
  .filter((value) => typeof value === 'string')
  .sort();

/** The six the shipped schema carries, as an identity rather than as a count. */
const SHIPPED = ['aborted', 'completed', 'failed', 'interrupted', 'regressed', 'undecided'];

/** The table's key set, spelled once because every comparison below is against it. */
const tableKeys = (): string[] => Object.keys(EXIT_CODE_FOR_STATUS).sort();

describe('AC-4(a) — the table', () => {
  test('the five codes are the numbers the spike exits with', () => {
    expect({ SUCCESS, ERROR, ABORTED, UNDECIDED, SIGNAL })
      .toStrictEqual({ SUCCESS: 0, ERROR: 1, ABORTED: 2, UNDECIDED: 3, SIGNAL: 130 });
  });

  test('every status maps to the code spike/bin/harness.js reaches for it today', () => {
    expect(EXIT_CODE_FOR_STATUS).toStrictEqual({
      completed: SUCCESS,
      regressed: SUCCESS,
      aborted: ABORTED,
      undecided: UNDECIDED,
      failed: ERROR,
      interrupted: SIGNAL,
    });
  });

  test('and no status maps to a code outside the five', () => {
    const codes = new Set<number>([SUCCESS, ERROR, ABORTED, UNDECIDED, SIGNAL]);
    for (const [status, code] of Object.entries(EXIT_CODE_FOR_STATUS)) {
      expect(codes.has(code), `${status} exits ${String(code)}, which is not one of the five`).toBe(true);
    }
  });

  test('a table missing a status fails to compile, which is the half no assertion can reach', () => {
    // @ts-expect-error the compile-time half of AC-4(a), demonstrated rather than described: this
    // literal omits `interrupted`, and the Record over the schema's status union refuses it. A
    // seventh status added to `@quorum/shared` breaks the build here instead of falling through to
    // SUCCESS, which is how `regressed` came to share `completed`'s code in the first place.
    const incomplete: Readonly<Record<RunTerminalEvent['status'], ExitCode>> = {
      completed: SUCCESS, regressed: SUCCESS, aborted: ABORTED, undecided: UNDECIDED, failed: ERROR,
    };
    expect(Object.keys(incomplete)).toHaveLength(5);
  });
});

describe('AC-4(b) — the key set is derived from the exported schema', () => {
  test('the derivation reads all six, and the table\'s keys are exactly those', () => {
    expect(discriminatorValues()).toStrictEqual(SHIPPED);
    expect(tableKeys()).toStrictEqual(discriminatorValues());
  });

  test('and the comparison has a subject — one more name and it is red', () => {
    expect(tableKeys()).not.toStrictEqual([...discriminatorValues(), 'quarantined'].sort());
    expect(tableKeys()).not.toStrictEqual(discriminatorValues().filter((s) => s !== 'failed'));
  });
});

describe('AC-4(b) — and each union member is shown to be load-bearing on its own', () => {
  test('reading only the literal member sees one status of six', () => {
    expect(literalMembersOnly()).toStrictEqual(['regressed']);
    expect(tableKeys(), 'a literals-only derivation would pass over five sixths of its subject')
      .not.toStrictEqual(literalMembersOnly());
  });

  test('reading only the enum member sees five statuses of six, and never regressed', () => {
    expect(enumMembersOnly()).toStrictEqual(['aborted', 'completed', 'failed', 'interrupted', 'undecided']);
    expect(enumMembersOnly()).not.toContain('regressed');
    expect(tableKeys()).not.toStrictEqual(enumMembersOnly());
  });

  test('and the shipped derivation is exactly the two together, so nothing is dropped or invented', () => {
    expect(discriminatorValues()).toStrictEqual([...literalMembersOnly(), ...enumMembersOnly()].sort());
  });
});

describe('AC-4(c) — regressed shares completed\'s code, preserved and registered', () => {
  test('both report success, which is what the spike does today', () => {
    // Why: preserved defect, see Q-0090 AC-4(c). `spike/bin/harness.js:557` is
    // `r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0`, which names `regressed`
    // nowhere, so a run a backward edge sent back reports the same code as one that finished.
    // Routed to Q-0090's GA-4 successor together with AC-6's unknown-command zero.
    expect(EXIT_CODE_FOR_STATUS.regressed).toBe(SUCCESS);
    expect(EXIT_CODE_FOR_STATUS.completed).toBe(SUCCESS);
  });
});
