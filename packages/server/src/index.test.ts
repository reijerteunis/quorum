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
  HOST_CLOSED_CONDITION: 'the condition a start meets once shutdown has begun — this surface\'s own, never `core`\'s',
  NO_PROJECT_REMEDY: 'the one remedy this surface composes, for a project that is not there',
  openProject: 'the one site where a `core` failure to open a project becomes a refusal',
  refusalFor: 'the one site that decides whether this surface has a remedy to add',

  // Q-0118's transport. The routing is deliberately NOT here: `createApp` is the whole of what a
  // caller composes, and a consumer reaching a route handler directly would be coding against an
  // arrangement rather than a contract. What Q-0014 codes against is the three wire shapes and the
  // status tables, which is why those are exported and the Hono app's internals are not.
  ANSWER_REFUSAL_STATUS: 'the status each gate-answer refusal answers with, as a table rather than a scattering',
  badRequest: 'a refusal this transport raised before the host was reached at all',
  BIND_HOSTNAME: 'the only address the server binds, and not configurable — Q-0013 OQ-2',
  createApp: 'the Hono app over a host: three routes and a WebSocket, owning no run state',
  eventMessage: 'one event as one WebSocket message, JSON, with nothing rendered',
  missedMessage: 'what a late subscriber is told it missed, which is a message kind and never an `Event`',
  serve: 'the process: a Node server over the app, bound to loopback',
  START_REFUSAL_STATUS: 'the status each start refusal answers with — a lock refusal is not a bad request',
  startRefusalCode: 'the code a start refusal carries, read from the host\'s own condition',
  startRequestOf: 'the one place a request body becomes a `StartRequest`, or the refusal saying why not',
  STOP_REFUSAL_STATUS: 'the status each stop refusal answers with',
  wireRefusalOf: 'a host refusal carried over the wire under a code a client can switch on',
  wireRunOf: 'a started run, narrowed to what crosses the wire',
};

describe('the public surface', () => {
  test('is exactly the register, in both directions', () => {
    expect(Object.keys(server).sort()).toStrictEqual(Object.keys(SURFACE).sort());
  });

  test('and every name resolves to something usable', () => {
    const values = server as unknown as Record<string, unknown>;
    for (const name of Object.keys(SURFACE)) {
      const kind = typeof values[name];
      // `object` joined the three on 2026-09-11 with Q-0118's status tables, which are frozen
      // lookups rather than functions. Widened with the reason rather than replaced by a
      // `!== 'undefined'`, which would pass over a name exported as `undefined` — the shape this
      // clause exists to refuse.
      expect(['function', 'string', 'object'], `${name} is a ${kind}`).toContain(kind);
      expect(values[name], `${name} is exported as undefined`).toBeDefined();
    }
    expect(server.DEFAULT_STOP_REASON.trim(), 'the default stop reason is blank').not.toBe('');
    expect(server.NO_PROJECT_REMEDY.trim(), 'the remedy is blank').not.toBe('');
    expect(server.HOST_CLOSED_CONDITION.trim(), 'the closed-host condition is blank').not.toBe('');
  });
});
