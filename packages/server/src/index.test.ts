/**
 * Q-0013 AC-1 — what `@quorum/server` publishes, as an identity rather than a count.
 *
 * It asserted `name === '@quorum/server'` over a one-line placeholder export until this ticket. That
 * check's subject is gone — the placeholder was what a scaffolded package exported instead of an
 * API — so it is replaced rather than kept: *"A check outlives its subject only if it can still
 * fail"* (2026-09-05).
 *
 * A register of names and not a length, because a count passes while a name is swapped for another
 * (Q-0073). Adding an export is then a visible act, which is the rule `@quorum/core`'s own barrel
 * states: what a consumer may reach is decided here rather than by whoever types an import first.
 */
import { describe, expect, test } from 'vitest';

import * as server from './index.js';

/** Every runtime name this package publishes, and what each is for. */
const SURFACE: Record<string, string> = {
  assertRetention: 'the one predicate that refuses a retention capacity, shared by the two sites that take one',
  createBroadcast: 'one run\'s event fan-out, bounded by a retention capacity its caller chooses',
  createGateRegistry: 'the pending-gate registry a host hands `runFlow` as its `answerGate`',
  createRunHost: 'the registry a transport speaks to — start, watch, answer, stop, shut down',
  DEFAULT_STOP_REASON: 'the non-empty string a stopped run records when the caller named none',
  NO_PROJECT_REMEDY: 'the one remedy this surface composes, for a project that is not there',
  openProject: 'the one site where a `core` failure to open a project becomes a refusal',
  refusalFor: 'the one site that decides whether this surface has a remedy to add',
};

describe('the public surface', () => {
  test('is exactly the register, in both directions', () => {
    expect(Object.keys(server).sort()).toStrictEqual(Object.keys(SURFACE).sort());
  });

  test('and every name resolves to something usable', () => {
    const values = server as unknown as Record<string, unknown>;
    for (const name of Object.keys(SURFACE)) {
      const kind = typeof values[name];
      expect(['function', 'string'], `${name} is a ${kind}`).toContain(kind);
    }
    expect(server.DEFAULT_STOP_REASON.trim(), 'the default stop reason is blank').not.toBe('');
    expect(server.NO_PROJECT_REMEDY.trim(), 'the remedy is blank').not.toBe('');
  });
});
