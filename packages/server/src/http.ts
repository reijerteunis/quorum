/**
 * The Hono app over a {@link RunHost}: three routes and a WebSocket, and nothing else.
 *
 * **It owns no run state.** Every route reads or moves the host, and the host is what Q-0013 proved
 * — the registry, the identity, the single-consumer fan-out, the gate registry and the shutdown
 * path. This file's whole job is turning a request into one of those calls and turning what comes
 * back into a status, which is why a refusal maps through {@link wire.ts}'s tables rather than being
 * decided here per route.
 *
 * **The routes are `docs/04-architecture.md`'s, not an implementer's**, and have been since
 * 2026-08-22: `POST /runs`, `POST /runs/:id/gate`, `POST /runs/:id/stop`. `:id` is Q-0013 AC-3's
 * handle. Hono is that document's choice too, which is why three dependencies arrive here with no
 * decision entry: executing a landed document is not changing the architecture (Q-0013 OQ-3).
 *
 * Why: deliberate addition, not preservation — Q-0118.
 */
import { Hono } from 'hono';

import type { RunHost, StartRequest } from './host.js';
import {
  ANSWER_REFUSAL_STATUS, badRequest, START_REFUSAL_STATUS, STOP_REFUSAL_STATUS,
  type StartRefusalCode, type WireMessage, type WireRefusal, wireRefusalOf, wireRunOf,
} from './wire.js';

/** What {@link createApp} needs: the host, and a way to make a socket pair for the event stream. */
export interface AppOptions {
  readonly host: RunHost;
  /**
   * Attaches a WebSocket handler to a route, supplied by the adapter rather than imported.
   *
   * Injected because `@hono/node-ws` binds to a live Node server and this app is built in tests
   * that never listen. A missing upgrader is not an error: the three POST routes are the whole of
   * what a client needs to drive a run, and the stream is how it watches one.
   */
  readonly upgrade?: (app: Hono, path: string, host: RunHost) => void;
}

/** The body `POST /runs` accepts, before it is known to be one. */
const START_FIELDS = new Set(['flow', 'ticket', 'dry', 'auto', 'base']);

/**
 * `body` as a {@link StartRequest}, or the refusal that says why it is not one.
 *
 * **Unknown fields are refused rather than ignored**, which is `.strict()`'s reasoning one layer
 * out: *"an answer with a key nobody asked for is an answer that did not follow the contract"*. A
 * client that misspells `ticket` gets told so instead of getting a run it did not ask for.
 *
 * Every refusal here **starts nothing** — the host is not reached until the body is known good.
 */
export function startRequestOf(body: unknown): { request: StartRequest } | { refusal: WireRefusal } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { refusal: badRequest('not-an-object', 'the request body is not a JSON object', 'send {"flow": "…", "ticket": "…"}') };
  }
  const record = body as Record<string, unknown>;
  const unknown = Object.keys(record).filter((key) => !START_FIELDS.has(key));
  if (unknown.length) {
    return { refusal: badRequest('unknown-field', `the request body carries ${unknown.map((k) => JSON.stringify(k)).join(', ')}, which this route does not accept`, `remove it; this route accepts ${[...START_FIELDS].join(', ')}`) };
  }
  for (const key of ['flow', 'ticket'] as const) {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim()) {
      return { refusal: badRequest('missing-field', `"${key}" must be a non-empty string`, null) };
    }
  }
  for (const key of ['dry', 'auto'] as const) {
    if (key in record && typeof record[key] !== 'boolean') {
      return { refusal: badRequest('wrong-type', `"${key}" must be true or false`, null) };
    }
  }
  if ('base' in record && typeof record.base !== 'string') {
    return { refusal: badRequest('wrong-type', '"base" must be a string', null) };
  }
  return { request: record as unknown as StartRequest };
}

/**
 * The code a start refusal carries, read from the host's own condition.
 *
 * **An unrecognised condition is `refused`, never `no-such-ticket`.** Classifying by prose is what
 * is available — `core` reports a condition and no code — so the classifier can only recognise what
 * it has been taught, and a fall-through that guessed the most common answer would tell a client
 * *that ticket is not there* about a failure nobody diagnosed. That is reporting an unanswerable
 * question as an answerable one, which *"A probe that could not answer is not a negative"*
 * (2026-09-10) forbids one layer down. `refused` carries the condition unaltered, so a human reads
 * what actually happened and a client knows it has met something this transport does not model.
 */
export function startRefusalCode(condition: string): StartRefusalCode {
  if (condition.includes('run lock refused')) return 'lock-held';
  if (condition.includes('closed and starts no further run')) return 'host-closed';
  if (condition.includes('consumes')) return 'not-runnable';
  // Measured rather than guessed: `loadFlowByName` does not compose a sentence, it lets Node's own
  // ENOENT through — `no such file or directory, open '<harness>/flows/<name>.yaml'`. Matching on a
  // phrase nobody writes made this branch unreachable, which review round 2 found.
  if (/flows[/\\][^/\\]+\.ya?ml/.test(condition)) return 'no-such-flow';
  if (condition.includes('ticket')) return 'no-such-ticket';
  return 'refused';
}

/** One WebSocket message for an event, ready to send. */
export function eventMessage(event: unknown): string {
  return JSON.stringify({ type: 'event', event } satisfies WireMessage);
}

/** The message a late subscriber is sent before its first event, or nothing when it missed none. */
export function missedMessage(count: number): string | null {
  return count > 0 ? JSON.stringify({ type: 'missed', count } satisfies WireMessage) : null;
}

/**
 * The app.
 *
 * @param options the host to drive, and optionally the adapter's WebSocket upgrader.
 * @returns a Hono app, ready to serve or to be called directly by a test.
 */
export function createApp({ host, upgrade }: AppOptions): Hono {
  const app = new Hono();

  app.post('/runs', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      // Malformed JSON never reaches the host, and says which half failed: a client that sent
      // nothing at all and one that sent a broken object get different sentences.
      return c.json(badRequest('malformed-json', 'the request body is not valid JSON', null), 400);
    }
    const parsed = startRequestOf(body);
    if ('refusal' in parsed) return c.json(parsed.refusal, 400);
    const outcome = await host.start(parsed.request);
    if (!outcome.started) {
      const code = startRefusalCode(outcome.refusal.condition);
      return c.json(wireRefusalOf(code, outcome.refusal), START_REFUSAL_STATUS[code]);
    }
    return c.json(wireRunOf(outcome), 201);
  });

  app.post('/runs/:id/gate', async (c) => {
    let envelope: unknown;
    try {
      envelope = await c.req.json();
    } catch {
      return c.json(badRequest('malformed-json', 'the request body is not valid JSON', null), 400);
    }
    // The envelope is NOT validated here. `gates.ts` owns that vocabulary and answers
    // `not-an-answer`, so a second copy of `advance|retry|abort` in this file would be a second
    // authority for it — and the one that drifts, since the schema lives in `@quorum/shared`.
    const refusal = host.answer(c.req.param('id'), envelope);
    if (refusal === null) return c.body(null, 204);
    return c.json(badRequest(refusal, refusalCondition(refusal), null), ANSWER_REFUSAL_STATUS[refusal]);
  });

  app.post('/runs/:id/stop', async (c) => {
    let reason: string | undefined;
    const raw = await c.req.text();
    if (raw.trim()) {
      try {
        const body: unknown = JSON.parse(raw);
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          return c.json(badRequest('not-an-object', 'the request body is not a JSON object', 'send {} or {"reason": "…"}'), 400);
        }
        const record = body as Record<string, unknown>;
        // Unknown fields are refused here for the same reason `POST /runs` refuses them, and the
        // two routes disagreeing was the defect: a client that misspells `reason` on one route is
        // told, and on the other is silently given a stop it did not describe.
        const unknown = Object.keys(record).filter((key) => key !== 'reason');
        if (unknown.length) {
          return c.json(badRequest('unknown-field', `the request body carries ${unknown.map((k) => JSON.stringify(k)).join(', ')}, which this route does not accept`, 'remove it; this route accepts reason'), 400);
        }
        const value = record.reason;
        if (value !== undefined && typeof value !== 'string') {
          return c.json(badRequest('wrong-type', '"reason" must be a string', null), 400);
        }
        reason = value;
      } catch {
        return c.json(badRequest('malformed-json', 'the request body is not valid JSON', null), 400);
      }
    }
    const refusal = host.stop(c.req.param('id'), reason);
    if (refusal === null) return c.body(null, 204);
    return c.json(badRequest(refusal, refusalCondition(refusal), null), STOP_REFUSAL_STATUS[refusal]);
  });

  if (upgrade) upgrade(app, '/runs/:id/events', host);
  return app;
}

/** A one-line condition for each refusal the host names by code rather than by sentence. */
function refusalCondition(code: string): string {
  switch (code) {
    case 'no-such-run': return 'no run is registered under that handle';
    case 'no-such-gate': return 'that run has no gate waiting under that id';
    case 'not-this-run': return 'that gate is waiting on a different run';
    case 'not-an-answer': return 'the envelope is not {gateId, answer} over advance, retry or abort';
    case 'not-running': return 'that run is not running';
    case 'not-a-reason': return 'the stop reason must be a non-empty string';
    default: return code;
  }
}
