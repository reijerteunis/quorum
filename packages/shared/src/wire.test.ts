import { describe, expect, test } from 'vitest';

import { repoFile } from '../test/corpus.js';
import {
  WIRE_RUN_STATES, wireMessageSchema, wireRefusalSchema, wireRunListSchema, wireRunSchema,
  wireRunStateSchema,
} from './wire.js';
import * as shared from './index.js';

/** One run row that every clause below starts from, so a refusal is the one field it changed. */
const RUN = {
  handle: 'run-7', flow: 'probe', ticketId: 'T-0001', runId: null, state: 'running', pendingGates: 1,
} as const;

/** The issue codes one refusal carried, which is what "distinguishably" is asserted over. */
const codesOf = (result: { error?: { issues: { code: string }[] } }): string[] =>
  (result.error?.issues ?? []).map((issue) => issue.code);

describe('AC-12/14 — browser-safe wire envelope', () => {
  test('accepts only the two envelope shapes and finite non-negative integer counts', () => {
    expect(wireMessageSchema.safeParse({ type: 'event', event: { anything: true } }).success).toBe(true);
    expect(wireMessageSchema.safeParse({ type: 'missed', count: 0 }).success).toBe(true);
    for (const count of ['7', -1, 1.5, Infinity]) expect(wireMessageSchema.safeParse({ type: 'missed', count }).success).toBe(false);
    expect(wireMessageSchema.safeParse({ type: 'heartbeat' }).success).toBe(false);
  });

  test('the web importer declares shared in the lockfile', () => {
    const lock = repoFile('pnpm-lock.yaml');
    const importer = lock.slice(lock.indexOf('  apps/web:'), lock.indexOf('\n  packages/', lock.indexOf('  apps/web:')));
    const scope = `@${'quorum'}/shared`;
    expect(importer).toContain(`'${scope}':`);
    expect(importer).toContain('workspace:*');
  });
});

describe('Q-0121 AC-10 — the run and refusal shapes are here, each with a schema', () => {
  test('the barrel publishes both names and all four schemas', () => {
    // The **names** are types and add no runtime key, so what a runtime check can see is the
    // schemas — which is the half that matters: a moved type with no schema recreates exactly the
    // half-measure Q-0120 had to repair, and the type is proven to be exported by this file
    // compiling against it below.
    const published = shared as unknown as Record<string, unknown>;
    for (const name of ['wireRefusalSchema', 'wireRunSchema', 'wireRunListSchema', 'wireRunStateSchema']) {
      expect(typeof published[name], `${name} is not on the barrel`).toBe('object');
    }
    expect(published.WIRE_RUN_STATES, 'the closed state set is not on the barrel').toStrictEqual(WIRE_RUN_STATES);
  });

  test('the state vocabulary is the closed three, as an identity rather than a count', () => {
    // A register, because a count passes while a member is swapped for another (Q-0073). The
    // direction the compiler owns is the other one — a fourth `RunState` is not assignable where
    // `wireRunOf` builds this field — and `http.test.ts` proves all three are states the host
    // actually produces, so neither union can gain a member alone without something failing.
    expect([...WIRE_RUN_STATES]).toStrictEqual(['refused', 'running', 'ended']);
    for (const state of WIRE_RUN_STATES) expect(wireRunStateSchema.safeParse(state).success).toBe(true);
    expect(wireRunStateSchema.safeParse('paused').success, 'a state the host cannot produce was accepted').toBe(false);
  });

  test('a run row is accepted, and its three refusal classes are told apart', () => {
    expect(wireRunSchema.safeParse(RUN).success).toBe(true);
    expect(wireRunSchema.safeParse({ ...RUN, ticketId: null, runId: 3, state: 'ended', pendingGates: 0 }).success).toBe(true);
    // One message per class: an unknown key, a missing required field and a state outside the
    // closed three each report a DIFFERENT code, so a client — and a reviewer reading a failure —
    // can tell which contract was broken rather than only that one was.
    const unknownKey = codesOf(wireRunSchema.safeParse({ ...RUN, watchers: 2 }));
    const missing = codesOf(wireRunSchema.safeParse({ handle: 'run-7', flow: 'probe' }));
    const badState = codesOf(wireRunSchema.safeParse({ ...RUN, state: 'paused' }));
    expect(unknownKey).toStrictEqual(['unrecognized_keys']);
    expect(missing, 'a row missing three required fields reported no missing field').toContain('invalid_type');
    expect(badState).toStrictEqual(['invalid_value']);
    expect(new Set([unknownKey[0], missing[0], badState[0]]).size, 'two of the three classes report one code').toBe(3);
  });

  test('a refusal is the three fields and nothing else', () => {
    expect(wireRefusalSchema.safeParse({ code: 'no-such-run', condition: 'x', remedy: null }).success).toBe(true);
    expect(wireRefusalSchema.safeParse({ code: 'no-such-run', condition: 'x', remedy: 'do y' }).success).toBe(true);
    expect(codesOf(wireRefusalSchema.safeParse({ code: 'c', condition: 'x', remedy: null, hint: 'z' })))
      .toStrictEqual(['unrecognized_keys']);
    expect(codesOf(wireRefusalSchema.safeParse({ code: 'c', condition: 'x' }))).toStrictEqual(['invalid_type']);
    // `remedy` is nullable and not optional: absent and `null` are different answers, and only one
    // of them says "this surface has nothing to add to the condition".
    expect(wireRefusalSchema.safeParse({ code: 'c', condition: 'x', remedy: undefined }).success).toBe(false);
  });

  test('a listing is an envelope, and an unknown envelope key is refused too', () => {
    expect(wireRunListSchema.safeParse({ runs: [] }).success, 'an empty listing is not a malformed one').toBe(true);
    expect(wireRunListSchema.safeParse({ runs: [RUN] }).success).toBe(true);
    expect(codesOf(wireRunListSchema.safeParse({ runs: [RUN], total: 1 }))).toStrictEqual(['unrecognized_keys']);
    expect(wireRunListSchema.safeParse([RUN]).success, 'a bare array satisfied the envelope').toBe(false);
    // And the rows are checked rather than the container, which is the distinction Q-0119's review
    // round 2 found the other way round: `Array.isArray` alone moves a throw rather than removing it.
    expect(wireRunListSchema.safeParse({ runs: [{ ...RUN, state: 'paused' }] }).success).toBe(false);
  });
});
