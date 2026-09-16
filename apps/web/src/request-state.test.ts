/**
 * Q-0017 AC-5, AC-6 — the closed set of answers one request can have.
 *
 * A pure module, so every member and every claim about it is asserted by VALUE rather than by
 * rendering — which is why AC-5 is shaped this way at all: `connection-state.ts` earned that shape
 * at Q-0120 and the same reasoning holds one transport over.
 *
 * It lives under `src/` beside its subject because it reaches for nothing a browser does not have.
 */
import { describe, expect, test } from 'vitest';

import { DAEMON_ENDPOINTS } from './daemon-endpoints.js';
import {
  canRetryRequest, REQUEST_STATE_KINDS, requestStateRemedy, requestStateText, type RequestState,
} from './request-state.js';

/** One member per kind, which is what makes "every member" a check rather than a sample. */
const EVERY_STATE: RequestState<{ x: number }>[] = [
  { kind: 'in-flight', path: '/tickets' },
  { kind: 'loaded', value: { x: 1 }, fetchedAt: '2026-09-16T09:00:00.000Z' },
  { kind: 'unreachable', path: '/tickets' },
  { kind: 'refused', path: '/tickets', refusal: { code: 'no-project', condition: 'no harness/harness.yaml found', remedy: null } },
  { kind: 'unparseable', path: '/tickets', problem: 'stage: expected string' },
];

describe('AC-5 — no member of the set is silence, and none of them is a spinner', () => {
  test('the corpus covers every kind the union declares', () => {
    // The positive control. Without it a member added to the type and not to the list would leave
    // every assertion below passing over four of five.
    expect(EVERY_STATE.map((state) => state.kind).sort()).toStrictEqual([...REQUEST_STATE_KINDS].sort());
    expect(REQUEST_STATE_KINDS.length, 'the kind register is empty').toBe(5);
  });

  test('every member renders a sentence a reader can act on', () => {
    for (const state of EVERY_STATE) {
      const text = requestStateText(state);
      expect(text.length, `${state.kind} renders nothing`).toBeGreaterThan(10);
      expect(text.trim(), `${state.kind} renders whitespace`).not.toBe('');
    }
  });

  test('and no member reaches a state with neither text nor an action', () => {
    for (const state of EVERY_STATE) {
      const hasText = requestStateText(state).trim() !== '';
      const hasAction = canRetryRequest(state) || requestStateRemedy(state) !== null;
      expect(hasText || hasAction, `${state.kind} offers a reader nothing at all`).toBe(true);
    }
  });

  test('the two that are not failures offer no retry, and the three failures do', () => {
    expect(EVERY_STATE.filter((state) => canRetryRequest(state)).map((state) => state.kind))
      .toStrictEqual(['unreachable', 'refused', 'unparseable']);
  });

  test('the loaded member says when, because the git facts under it were true then', () => {
    // Containment and push lag are derived per request and stored nowhere, so a board loaded ten
    // minutes ago is showing an ancestry from ten minutes ago. An instant is carried rather than
    // rendered from the wall clock at paint time, which would be a claim about now.
    const loaded = EVERY_STATE.find((state) => state.kind === 'loaded');
    expect(loaded).toBeDefined();
    expect(requestStateText(loaded as RequestState<unknown>)).toContain('2026-09-16T09:00:00.000Z');
  });
});

describe('AC-6 — a daemon that is not there and a daemon that refuses are two sentences', () => {
  test('neither collapses into the other, and each names what was asked for', () => {
    const unreachable = requestStateText({ kind: 'unreachable', path: '/tickets' });
    const refused = requestStateText({
      kind: 'refused', path: '/tickets',
      refusal: { code: 'no-project', condition: 'no harness/harness.yaml found', remedy: null },
    });
    expect(unreachable, 'the two failures render one sentence').not.toBe(refused);
    expect(unreachable, 'the unreachable sentence does not name the path asked for').toContain('/tickets');
    expect(refused, 'the refusal does not name the path asked for').toContain('/tickets');
  });

  test('unreachable says starting the daemon is the action', () => {
    const state: RequestState<never> = { kind: 'unreachable', path: '/flows' };
    expect(requestStateRemedy(state)).toContain('Start the daemon');
    expect(canRetryRequest(state), 'nothing could be retried after nothing answered').toBe(true);
  });

  test('a refusal renders the daemon\'s own condition unaltered', () => {
    // *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07). The
    // condition is carried through byte for byte — paraphrasing it here would make this surface the
    // author of a sentence it did not write and cannot keep current.
    const condition = 'no run history under "T-0001-9"';
    expect(requestStateText({ kind: 'refused', path: DAEMON_ENDPOINTS.history, refusal: { code: 'no-such-run', condition, remedy: null } }))
      .toContain(condition);
  });

  test('and where the daemon supplied a remedy, that one is shown rather than a generic one', () => {
    const supplied = 'run `quorum init` in your repo';
    expect(requestStateRemedy({
      kind: 'refused', path: '/tickets',
      refusal: { code: 'no-project', condition: 'no harness/harness.yaml found', remedy: supplied },
    })).toBe(supplied);
    // …and where it supplied none, this surface composes one rather than leaving a reader with a
    // condition and no next step.
    expect(requestStateRemedy({
      kind: 'refused', path: '/tickets',
      refusal: { code: 'no-project', condition: 'x', remedy: null },
    })).not.toBeNull();
  });
});
