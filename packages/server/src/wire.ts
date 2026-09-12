/**
 * The shapes that cross the wire, and the one place a refusal becomes a status.
 *
 * Kept apart from `http.ts` so a status mapping is a table rather than a scattering of
 * `c.json(..., 4xx)` calls.
 *
 * **Every shape that crosses the wire is defined in `@quorum/shared` and re-exported here, not
 * declared here.** This header used to say the contract *"Q-0014 codes against"* could be read in
 * this file, and that sentence is what Q-0120's own ticket body names as the CAUSE of the drift it
 * was opened on: an implementer follows it, finds `@quorum/server` unimportable from a browser, and
 * copies the interfaces into the app — the drift arrived at by obeying the sentence forbidding it.
 * Q-0120 moved the frame union; **Q-0121 moved the last two, `WireRefusal` and `WireRun`**, which
 * this header named as its own obligation *"the same way rather than copying them"* — the way being
 * with a schema, because a browser needs a runtime parser and not a type. What stays here is the
 * three **constructors** and the status tables: a shape says what a value is, and building one out
 * of a run this host is driving is something `@quorum/shared` may not know how to do.
 *
 * **Nothing here renders.** `04-architecture.md` states the rule this is the other half of — *"a
 * lint record reaching a terminal, a browser and a WebSocket carries an escape byte in exactly one
 * of the three"* — so no ANSI, no colour and no vendor branching crosses this boundary. The browser
 * decides how an event looks; this decides only what it is.
 */
import type { AnswerRefusal, RunView, StopRefusal } from './host.js';
import type { Refusal } from './refusal.js';
import type { WireMessage, WireRefusal, WireRun } from '@quorum/shared';

export type { WireMessage, WireRefusal, WireRun };

/** A refusal this transport raised before the host was reached at all. */
export function badRequest(code: string, condition: string, remedy: string | null = null): WireRefusal {
  return { code, condition, remedy };
}

/** A {@link Refusal} the host produced, carried over the wire under a code the client can switch on. */
export function wireRefusalOf(code: string, refusal: Refusal): WireRefusal {
  return { code, condition: refusal.condition, remedy: refusal.remedy };
}

/**
 * The status a start refusal answers with, and why each is what it is.
 *
 * A lock refusal is **409** rather than 400 or 500: the request was well formed and the server is
 * healthy, and the thing that refused it is another run holding the same ticket — a conflict, and
 * one that resolves itself when that run ends. A closed host is **503**, because it is the process
 * rather than the request that cannot serve. Everything else the host refuses is **404**: a ticket
 * or a flow it cannot find.
 *
 * Distinguishable is the requirement, not any particular number: a client that cannot tell a lock
 * refusal from a missing ticket cannot tell "try again in a minute" from "you asked for something
 * that is not there".
 */
export const START_REFUSAL_STATUS = {
  'lock-held': 409,
  'host-closed': 503,
  'no-such-ticket': 404,
  'no-such-flow': 404,
  'not-runnable': 409,
  // The condition this transport does not model. **500**, and the reasoning changed under review.
  //
  // It was 422 on the ground that "the request was well formed and the server is healthy" — and the
  // second half of that is a claim nobody checked. What reaches this row is a start failure whose
  // condition matched no pattern, which is by definition one the server did not anticipate; it may
  // be a broken flow file, an unreadable harness or a defect here. Telling a client its request was
  // *unprocessable* asserts the fault is theirs. 500 asserts only that something went wrong on this
  // side, which is the one thing that is certainly true, and the condition travels with it so a
  // human reads what actually happened. Review round 3.
  refused: 500,
} as const;

export type StartRefusalCode = keyof typeof START_REFUSAL_STATUS;

/** The status each {@link AnswerRefusal} answers with. */
export const ANSWER_REFUSAL_STATUS = {
  'no-such-run': 404,
  'no-such-gate': 404,
  // The gate exists and is waiting — on a different run. A conflict rather than a not-found,
  // because the client asked a real question of the wrong run.
  'not-this-run': 409,
  'not-an-answer': 400,
  // `as const` with `satisfies` rather than an annotation: the annotation widened every value to
  // `number`, which Hono's `c.json` refuses, while dropping it would stop the table being checked
  // for completeness. This keeps both, and keeps this module free of any Hono type.
} as const satisfies Record<AnswerRefusal, number>;

/** The status each {@link StopRefusal} answers with. */
export const STOP_REFUSAL_STATUS = {
  'no-such-run': 404,
  'not-running': 409,
  'not-a-reason': 400,
} as const satisfies Record<StopRefusal, number>;

/**
 * One {@link RunView}, narrowed to what crosses the wire — the **one** projection every route that
 * answers with a run goes through.
 *
 * **Widened rather than joined by a second one** (Q-0121 AC-8). It took a `StartOutcome` until this
 * ticket, so a listing would have needed its own projection and `POST /runs`, `GET /runs` and
 * `GET /runs/:id` could have answered three shapes for one run. A `RunView` is what all three hold,
 * so taking that is what makes one shape structural rather than remembered.
 *
 * `state` is the narrowing this ticket is about: the field was declared `string` and is now the
 * host's closed three, and **the assignment below is the check** — a fourth `RunState` is not a
 * `WireRunState` and fails to compile here rather than silently widening the wire back to `string`.
 *
 * `String()` on the id for the reason `read.ts` gives at its own ticket row: `Backlog.read` asserts
 * rather than parses, so `meta.id` is a string by type and not by proof, and reporting what is
 * actually on disk is preferred to trusting the declaration.
 */
export function wireRunOf(view: RunView): WireRun {
  return {
    handle: view.handle,
    flow: view.flow,
    ticketId: view.ticket === null ? null : String(view.ticket.meta.id),
    runId: view.runId,
    state: view.state,
    pendingGates: view.gates.length,
  };
}
