/**
 * The Hono app over a {@link RunHost}: five routes and a WebSocket, and nothing else.
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
 * **Q-0121 added the two reads, and that document moved with them** rather than after them: a route
 * a landed document does not list is a document edit, which is the narrower half of the precedent
 * above. `GET /runs` answers *what can I join?* and `GET /runs/:id` answers *what do you know about
 * this handle?* — two different questions, which is why they select differently and why only one of
 * them is entitled to a 404.
 *
 * **Q-0134 added the third read, and it is the first route here whose answer is bytes a RUN
 * produced.** `GET /runs/:id/gates/:gateId/diff` answers *what was the decision at this gate made
 * ON?*, from a snapshot the run handed the host out of band while the diff was being materialised —
 * never re-derived, because refs move and a second measurement could show a diff the reviewer never
 * saw. It owes no decision entry and the ruling is recorded at the route rather than in a document;
 * the reasoning is there.
 *
 * Why: deliberate addition, not preservation — Q-0118.
 */
import { Hono } from 'hono';

import { WIRE_START_FIELDS } from '@quorum/shared';

import type { RunHost, RunState, StartRequest } from './host.js';
import { mountStatic } from './static.js';
import {
  ANSWER_REFUSAL_STATUS, badRequest, GATE_DIFF_REFUSAL_STATUS, START_REFUSAL_STATUS,
  STOP_REFUSAL_STATUS,
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
  /**
   * The directory holding the built web app, or nothing to serve none.
   *
   * **Supplied, never discovered** (Q-0122): this package cannot compute it, the bundle's location
   * being package-relative while the daemon's working directory is the operator's project. Absence
   * is a state rather than a failure — with no bundle every route below behaves exactly as it did
   * before this option existed and no HTML is ever emitted, which is what every test in this
   * package that drives the app directly relies on.
   */
  readonly bundle?: string;
}

/**
 * The body `POST /runs` accepts, before it is known to be one.
 *
 * Built from `@quorum/shared`'s own tuple since Q-0130 rather than from a literal here: a browser
 * needs an executable builder for the same five names, and two lists are two authorities free to
 * drift the moment either end gains a field. The **iteration order** below is that tuple's, which
 * is why it is a tuple — the `unknown-field` remedy spells the set out for a human to read.
 *
 * Nothing else about this predicate moved. It is not routed through the schema: its four refusal
 * codes and the sentences it composes are what a client switches on, and `safeParse`'s message is
 * not one of them.
 */
const START_FIELDS = new Set<string>(WIRE_START_FIELDS);

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
  // Measured rather than guessed: `loadFlowByName` composes no sentence and lets Node's own ENOENT
  // through — `ENOENT: no such file or directory, open '<harness>/flows/<name>.yaml'`.
  //
  // **Both halves are required**, which review round 3 found: a path alone matches an EACCES on a
  // flow file, or a YAML parse error naming one, and answering `no-such-flow` to either would tell
  // a client the flow is missing when it is there and broken. A condition that names a flow file
  // for any other reason falls through to `refused`, which is the honest answer.
  if (/ENOENT/.test(condition) && /flows[/\\][^/\\]+\.ya?ml/.test(condition)) return 'no-such-flow';
  if (condition.includes('ticket')) return 'no-such-ticket';
  return 'refused';
}

/**
 * Whether a listing carries a run in this state, as a table over the host's own union.
 *
 * **A table rather than `state !== 'refused'`**, so a fourth `RunState` has to be classified here
 * instead of silently inheriting *listed*: `Record<RunState, boolean>` is total, and `satisfies`
 * refuses a key the host cannot produce.
 *
 * A **refused** start is the one the host cannot back, and the reason is measured rather than
 * stylistic: `begin` returns before `record.broadcast` is assigned, so `host.subscribe` answers
 * `null` and the socket route closes 1008 — and no client was ever told the handle, a refusal
 * answering a {@link WireRefusal} that carries none. Listing it would surface a row nobody asked for
 * and none can open. An **ended** run stays listed: its retained buffer is replayable after close,
 * which is the whole thing this listing makes reachable.
 */
const LISTED_BY_STATE = {
  refused: false,
  running: true,
  ended: true,
} as const satisfies Record<RunState, boolean>;

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
export function createApp({ host, upgrade, bundle }: AppOptions): Hono {
  const app = new Hono();

  // FIRST, and the order is the whole of why the static route works: four of the shell's twelve
  // paths are also `GET` routes below, and a handler that returns a response ends the chain — so a
  // fallback registered last is never reached for them and a reload 404s while in-app navigation
  // hides it. `static.ts` carries the argument; what it does here is discriminate on the request
  // and `next()` for everything that is not a file or a navigation, which leaves every route below
  // answering exactly what it answered before.
  mountStatic(app, bundle);

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
    return c.json(wireRunOf(outcome.run), 201);
  });

  // The runs a client can join, newest first. **Order is specified because it is the only recency
  // the wire carries**: the handle is opaque, so a client may not read age out of it, and the row a
  // maintainer most often wants is the last run started. Derived per request with no cache, which is
  // the discipline `read.ts` already applies to containment and push lag — a run listed as `running`
  // is listed as `ended` after it finishes, under the same handle.
  //
  // An empty host answers `200 {"runs": []}` and never a 404: nothing is missing, there is nothing
  // to list, and those are different sentences.
  app.get('/runs', (c) => c.json({
    runs: [...host.runs()]
      .filter((view) => LISTED_BY_STATE[view.state])
      .reverse()
      .map((view) => wireRunOf(view)),
  }));

  // And what the host knows about ONE handle, which is a different question from the listing's.
  // A refused start is reported `refused` rather than reported absent: 404 is reserved for a handle
  // this host never minted, which is what makes its condition — "no run is registered under that
  // handle" — true of the case it answers. Answering it for a handle the host's own records hold
  // would be a failed probe read as a proven negative, the class Q-0074 and Q-0115 exist to remove.
  app.get('/runs/:id', (c) => {
    const view = host.view(c.req.param('id'));
    if (!view) return c.json(badRequest('no-such-run', refusalCondition('no-such-run'), null), 404);
    return c.json(wireRunOf(view));
  });

  // The diff the step whose decision reached one waiting gate was given — a **read**, so it adds no
  // write to this transport and takes no git range, ref or path from the caller: the only two
  // things it accepts are the handle this host minted and the opaque `gateId` the question carried,
  // and what it answers with is bytes the run itself produced and handed over out of band.
  //
  // **No decision entry is owed, and the ruling lives here rather than in a document** (Q-0134 E-1,
  // Q-0108's precedent). Each limb has one from the last week: a read-only route on this transport
  // is Q-0119's and Q-0121's, which ruled *"no decision entry is owed and the document edit is"*;
  // bounded in-flight daemon memory is Q-0123's, measured and ruled; and an out-of-band
  // `RunFlowOptions` callback is Q-0131's, ruled to owe none because a callback is not an event.
  // The test this repository applies is *does any landed sentence go false?* — and none does, at
  // the five sites that could: the glossary's **Event** term, `events.ts`'s *"one optional field
  // and not the beginning of a family"*, *"A gate question carries the decision that reached it"*
  // (2026-09-17), and the glossary's **Occurrence** and **Run history**. Nothing is added to the
  // event union and nothing new is persisted.
  app.get('/runs/:id/gates/:gateId/diff', (c) => {
    const found = host.gateDiff(c.req.param('id'), c.req.param('gateId'));
    if ('refusal' in found) {
      return c.json(badRequest(found.refusal, refusalCondition(found.refusal), gateDiffRemedy(found.refusal)),
        GATE_DIFF_REFUSAL_STATUS[found.refusal]);
    }
    return c.json(found.evidence);
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
    // **Not a claim that nothing changed**, which is the one thing this sentence must not be read
    // as. Four of the six shipped flows declare no `input.diff` at all and a gate a flow file
    // declares can follow any step, so a step that was given no diff is ordinary. What is said is
    // what happened.
    case 'no-diff': return 'the step whose decision reached that gate was given no diff to review';
    default: return code;
  }
}

/**
 * What a reader can do about a gate-diff refusal, or `null` where the surface has nothing to add.
 *
 * `no-diff` is the one with a remedy worth composing, and it is a statement rather than an
 * instruction: there is nothing to fetch and nothing to retry, so a surface repeating the request
 * would be asking again for a thing that is not there.
 */
function gateDiffRemedy(code: string): string | null {
  return code === 'no-diff'
    ? 'Nothing was reviewed for this gate, so there is nothing to fetch; the decision beside it is what it was reached on.'
    : null;
}
