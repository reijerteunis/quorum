/**
 * What crosses the daemon's wire, and the schemas that prove it: the run-events envelope, a
 * refusal, and one run.
 *
 * It lives in the shared package rather than beside the transport in `packages/server`, because
 * AC-14 needs a runtime PARSER and not a type: a `JSON.parse` result assigned to `WireMessage` is a
 * silent default, which this repository's rules forbid. A browser must therefore be able to execute
 * the schema, and this is the only package here with an `exports` map, a browser-safety guard and a
 * header that names `apps/web` as its reason. The server re-exports the name so its own barrel is
 * unchanged; the definition is here and is not written twice.
 *
 * (This header spells no package specifier: `index.test.ts` asserts that literal appears in no file
 * under `src`, tests included, which is why the file that checks it assembles its own needle.)
 *
 * `event` is deliberately `unknown`: the envelope says a frame IS an event frame, and what that
 * event is belongs to this package's own event union, checked in a second pass. Folding the two
 * into one schema would make a malformed event indistinguishable from a malformed envelope, and
 * AC-14 requires each refusal to be distinguishable.
 *
 * **{@link WireRefusal} and {@link WireRun} joined it at Q-0121, and each arrives WITH a schema.**
 * The server's own `wire.ts` carried both as bare interfaces and its header named this ticket as one
 * of the two that would move them — *"the same way rather than copying them"*, the way being this
 * file, because a moved type with no schema recreates exactly the half-measure Q-0120 had to repair.
 * The constructors stay in the server: this file declares what a value IS and never how one is built
 * from a run the server is driving, which is what keeps the dependency direction one-way.
 */
import { z } from 'zod';

/** The transport envelope; event payloads require a second pass through `eventSchema`. */
export type WireMessage =
  | { readonly type: 'event'; readonly event: unknown }
  | { readonly type: 'missed'; readonly count: number };

/**
 * Runtime validation for the outer run-events envelope.
 *
 * The event branch deliberately retains an unknown payload. The browser parser validates that
 * payload with `eventSchema` after this schema has accepted the envelope.
 */
export const wireMessageSchema: z.ZodType<WireMessage> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    event: z.unknown(),
  }).strict(),
  z.object({
    type: z.literal('missed'),
    count: z.number().int().nonnegative(),
  }).strict(),
]);

/**
 * What a refused request answers with: a machine-readable code, the condition in the failing
 * library's own words, and a remedy where the surface has one.
 *
 * The three fields are separate because they have different audiences and different authorities. A
 * client switches on `code`; a human reads `condition`, which is `core`'s sentence unaltered under
 * *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07); and
 * `remedy` is the surface's, which is why it is `null` far more often than not.
 */
export interface WireRefusal {
  readonly code: string;
  readonly condition: string;
  readonly remedy: string | null;
}

/** Runtime validation for a refusal body. */
export const wireRefusalSchema: z.ZodType<WireRefusal> = z.object({
  code: z.string(),
  condition: z.string(),
  remedy: z.string().nullable(),
}).strict();

/**
 * How a run the daemon minted stands: it never began, it is under way, or it is over.
 *
 * **A closed three rather than a string**, which is what it was until Q-0121. The daemon's own
 * `RunState` is the authority for the set — the wire narrows it rather than defining it — and the
 * narrowing is what makes a client able to switch on the field at all. A value the daemon cannot
 * produce is refused here, and a fourth state the daemon gained would fail to compile where the
 * projection assigns it, which is the direction that matters.
 */
export const WIRE_RUN_STATES = ['refused', 'running', 'ended'] as const;

/** One of {@link WIRE_RUN_STATES}. */
export type WireRunState = (typeof WIRE_RUN_STATES)[number];

/** Runtime validation for a run's state. */
export const wireRunStateSchema: z.ZodType<WireRunState> = z.enum(WIRE_RUN_STATES);

/**
 * One run, as the wire reports it — the shape a start, a listing and a lookup all answer with.
 *
 * `handle` is the daemon's own name for the run: opaque, and what `:id` names in every route that
 * takes one. `runId` is `core`'s own number and is `null` until the terminal event carries it,
 * which is a fact about the engine rather than about the transport.
 *
 * **Two fields are deliberately not named after the fields they narrow** (Q-0121 GO-3). The
 * daemon's own view of a run carries a whole ticket record and an array of gate questions; a wire
 * field that narrows one of those to an id or to a count may not keep that field's name, because
 * the name would then promise what the wire does not carry. Hence `ticketId` and `pendingGates`.
 *
 * `pendingGates` is a count and is what makes a row actionable: a run waiting on a human that
 * nobody can find is the case this shape exists to remove.
 */
export interface WireRun {
  readonly handle: string;
  readonly flow: string;
  /** The ticket's id, or `null` where the start never resolved one. */
  readonly ticketId: string | null;
  readonly runId: number | null;
  readonly state: WireRunState;
  /** How many of this run's gates are waiting on an answer. */
  readonly pendingGates: number;
}

/** Runtime validation for one run row. */
export const wireRunSchema: z.ZodType<WireRun> = z.object({
  handle: z.string(),
  flow: z.string(),
  ticketId: z.string().nullable(),
  runId: z.number().int().nullable(),
  state: wireRunStateSchema,
  pendingGates: z.number().int().nonnegative(),
}).strict();

/**
 * What a listing of the daemon's runs answers with.
 *
 * An envelope rather than a bare array, so a later field is additive rather than a change of the
 * response's own type — the shape every other read route on this transport already answers with.
 */
export interface WireRunList {
  readonly runs: readonly WireRun[];
}

/** Runtime validation for a run listing. */
export const wireRunListSchema: z.ZodType<WireRunList> = z.object({
  runs: z.array(wireRunSchema),
}).strict();
