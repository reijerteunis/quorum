/**
 * The shapes that cross the wire, and the one place a refusal becomes a status.
 *
 * Kept apart from `http.ts` so the contract Q-0014 codes against can be read without reading the
 * routing, and so a status mapping is a table rather than a scattering of `c.json(..., 4xx)` calls.
 *
 * **Nothing here renders.** `04-architecture.md` states the rule this is the other half of — *"a
 * lint record reaching a terminal, a browser and a WebSocket carries an escape byte in exactly one
 * of the three"* — so no ANSI, no colour and no vendor branching crosses this boundary. The browser
 * decides how an event looks; this decides only what it is.
 */
import type { AnswerRefusal, StartOutcome, StopRefusal } from './host.js';
import type { Refusal } from './refusal.js';
import type { WireMessage } from '@quorum/shared';

export type { WireMessage };

/**
 * What a refused request answers with: a machine-readable code, the condition in `core`'s own
 * words, and a remedy where the surface has one.
 *
 * The three fields are separate because they have different audiences and different authorities. A
 * client switches on `code`; a human reads `condition`, which is `core`'s sentence unaltered under
 * *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07); and
 * `remedy` is this surface's, which is why it is `null` far more often than not.
 */
export interface WireRefusal {
  readonly code: string;
  readonly condition: string;
  readonly remedy: string | null;
}

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
 * A started run, as the wire reports it.
 *
 * `handle` is Q-0013 AC-3's, **inherited rather than re-decided**: it is what `:id` names in every
 * route below and what a client stores. `runId` is `core`'s own number and is `null` until the
 * terminal event carries it, which is a fact about the engine rather than about this transport.
 */
export interface WireRun {
  readonly handle: string;
  readonly flow: string;
  readonly runId: number | null;
  readonly state: string;
}

/** {@link StartOutcome}'s run, narrowed to what crosses the wire. */
export function wireRunOf(outcome: StartOutcome): WireRun {
  const { handle, flow, runId, state } = outcome.run;
  return { handle, flow, runId, state };
}
