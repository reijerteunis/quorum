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
 * **{@link WireTicketDetail} and {@link WireTicketFile} joined them at Q-0127**, under the rule the
 * paragraph below states rather than as an exception to it: a browser executes both, one to render
 * a ticket page's tabs and one to render a file it opened, and neither `packages/server` nor
 * `apps/web` declares either shape of its own.
 *
 * **{@link WireStartRequest} joined them at Q-0130, and it is the first shape here a browser
 * BUILDS rather than reads.** The rule is the same in both directions — one declaration, executable
 * in a browser — and the field set had lived only inside `packages/server`, so a browser composing a
 * start body would have written the five names a third time.
 *
 * **{@link WireRefusal} and {@link WireRun} joined it at Q-0121, and each arrives WITH a schema.**
 * The server's own `wire.ts` carried both as bare interfaces and its header named this ticket as one
 * of the two that would move them — *"the same way rather than copying them"*, the way being this
 * file, because a moved type with no schema recreates exactly the half-measure Q-0120 had to repair.
 * The constructors stay in the server: this file declares what a value IS and never how one is built
 * from a run the server is driving, which is what keeps the dependency direction one-way.
 */
import { z } from 'zod';

import { CONTAINMENT_REASONS, type ContainmentResult } from './containment.js';
import { gateQuestionEventSchema, type GateQuestionEvent } from './events.js';
import { PUSH_LAG_REASONS, type PushLagResult } from './push-lag.js';

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
 * takes one. `runId` is `core`'s own number, reported out of band at run start and `null` only
 * before a run is under way — a fact about the engine rather than about the transport, and one
 * this shape did not change to carry: the field has been `number | null` since Q-0121. Q-0131
 * replaced a sentence here that dated the number's arrival to the end of the run, which was true of
 * the engine at the time and is a claim the wire was never the right place to make.
 *
 * **`ticketId` is deliberately not named after the field it narrows** (Q-0121 GO-3). The daemon's
 * own view of a run carries a whole ticket record; a wire field that narrows one to an id may not
 * keep that field's name, because the name would then promise what the wire does not carry.
 *
 * **`gates` may keep its name, and the reason is that rule rather than an exception to it** — it
 * narrows nothing. `RunView.gates` is an array of {@link GateQuestionEvent} and so is this: the
 * same values, by the same element schema, reused rather than re-declared. `pendingGates` stayed a
 * count when it was the only thing carried, and it stays beside the array now: a listing of many
 * runs wants a number, the two are structurally unable to disagree because the projection computes
 * one from the other, and removing a shipped field from a `.strict()` shape for a redundancy that
 * costs nothing would be a breaking change bought with nothing.
 *
 * `pendingGates` is what makes a row actionable: a run waiting on a human that nobody can find is
 * the case this shape exists to remove. `gates` is what makes it ANSWERABLE, which is Q-0016's:
 * `gateId` is the correlation token an answer has to echo — a browser that had only the count could
 * say a gate was waiting and could not say what it asked or offer an answer to it.
 *
 * **And what it carries is what a question carries, which is not a list this sentence may keep.**
 * It said `kind`, `reason` and `retry` were *"the whole of what a gate screen can honestly render"*
 * until Q-0129, and that was a count of the question's own fields written down a second time: the
 * question gained `reached`, the decision that reached the gate, and this shape gained
 * it with no edit here because the element IS {@link GateQuestionEvent}. The pass-through is the
 * property; an enumeration beside it is a register free to go stale in silence, which is what that
 * clause did the day the union widened. See *"A gate question carries the decision that reached
 * it"* (2026-09-17).
 *
 * **`refusal` narrows nothing either, and it is NOT a {@link WireRefusal}.** A `refused` row said
 * only that the start never happened until Q-0016, so a screen reporting one could name no reason
 * and had to say it carried none — which is a surface admitting a gap where the daemon's own words
 * were one field away. What crosses is the host's `refusal` whole: the condition in the failing
 * library's own words and the remedy this transport composed for a caller that may have no shell.
 * The `code` a {@link WireRefusal} carries is deliberately absent — that is a classification the
 * transport makes to pick a **status** for a request it is refusing, and a run row is answered
 * `200`, so carrying one would attach a status nobody sent to a refusal nobody asked for.
 */
export interface WireRun {
  readonly handle: string;
  readonly flow: string;
  /** The ticket's id, or `null` where the start never resolved one. */
  readonly ticketId: string | null;
  readonly runId: number | null;
  /**
   * Whether this run is a walk that invokes no adapter and writes nothing.
   *
   * **Required rather than optional, and never inferred.** The word already crosses in the other
   * direction — {@link WIRE_START_FIELDS} carries `dry` and {@link WireStartRequest} declares it —
   * and until Q-0135 nothing carried it back, so a reader holding a run row could not tell a walk
   * from a run. That is a wrong answer rather than a missing one: a dry walk is allocated a run
   * number like any other run and writes no run history, `nextRunId` reserves nothing, and the next
   * real run of that ticket therefore receives the identical number — so `<ticketId>-<runId>` names
   * a directory belonging to a different run, and a surface composing it would render that run's
   * start time and cost as this walk's.
   *
   * It narrows no {@link RunView} field, so Q-0121 GO-3's naming rule permits the name.
   */
  readonly dry: boolean;
  readonly state: WireRunState;
  /** How many of this run's gates are waiting on an answer. Always `gates.length`. */
  readonly pendingGates: number;
  /** Those gates' questions, whole and in the order they were asked. Empty for every other run. */
  readonly gates: readonly GateQuestionEvent[];
  /**
   * Why this run never started, or `null` where it did — and `null` on a `refused` row too, for the
   * window before a start has resolved, which is the honest answer rather than a gap.
   */
  readonly refusal: { readonly condition: string; readonly remedy: string | null } | null;
}

/** Runtime validation for one run row. */
export const wireRunSchema: z.ZodType<WireRun> = z.object({
  handle: z.string(),
  flow: z.string(),
  ticketId: z.string().nullable(),
  runId: z.number().int().nullable(),
  // Required and not `.optional()`, which is the half a default would take away: an optional field
  // lets a projection drop it and a reader read the omission as `false`, and `false` is the answer
  // that composes a history id. A row that omits it is refused here instead.
  dry: z.boolean(),
  state: wireRunStateSchema,
  pendingGates: z.number().int().nonnegative(),
  // The event union's own schema as the element, never a second declaration of its fields: the
  // question a browser echoes back has to be the question `askGate` emitted, and two declarations
  // of one shape are free to drift the moment either end gains a field — which Q-0129 is the first
  // ticket to do, and it needed no line here.
  gates: z.array(gateQuestionEventSchema),
  // Nullable rather than optional, which is `remedy`'s own rule one level down: absent and `null`
  // are different answers, and only one of them says "this run has no refusal to report".
  refusal: z.object({ condition: z.string(), remedy: z.string().nullable() }).strict().nullable(),
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

/**
 * One vendor's row of a run's roll-up, as `GET /history/:id` reports it.
 *
 * The four fields are the ones a surface renders and not the whole row — `core`'s own `VendorRollup`
 * carries five token measures beside them — which is why every level of {@link wireRunHistorySchema}
 * is loose rather than `.strict()`.
 *
 * **`cost_usd` is `null` where the vendor reported no price, and `0` where it reported zero**, which
 * are different claims and only one of them is *free*: *"Codex cost is reported as tokens, never
 * priced locally"* (2026-08-22). **`step_count` is never zero** — `rollup()` emits a row only for a
 * vendor that finished a billed occurrence, so a vendor that has run and finished none is ABSENT
 * here rather than present at zero, which is a third thing again and is not *unpriced*.
 */
export interface WireVendorRollup {
  /** The grouping key: the exact `usage.vendor` string, never normalised or mapped. */
  readonly vendor: string;
  /** What that vendor billed, or `null` where it reported no price at all. */
  readonly cost_usd: number | null;
  /** How many of its counted occurrences reported no price, so a row can say what it cannot see. */
  readonly unpriced_steps: number;
  /** How many occurrences carrying usage were counted. Never zero — a row without one is absent. */
  readonly step_count: number;
}

/**
 * Runtime validation for one roll-up row.
 *
 * **Named at Q-0018 rather than written twice**, because two routes now answer one: the detail
 * carries the manifest's rows whole and the listing carries the four fields above and nothing else,
 * and a second inline copy of this shape would be free to drift from the first the moment either
 * route widened.
 *
 * **Loose, and it stays loose on both routes for one reason and not two.** *"Unknown keys are
 * refused where Quorum owns the key set, and preserved where it does not"* (2026-08-25): a row is
 * `core`'s `VendorRollup`, which carries five token measures beside these four and may gain a
 * sixth. That the listing's projection happens to emit exactly four is a fact about that route
 * rather than about this shape, and asserting it here would refuse a document this product wrote
 * the day the manifest widened. What holds the listing to four is an assertion over its response.
 *
 * The ELEMENTS and not just the array, which is the guard `read.ts` needed two review rounds to get
 * right: `readRun` casts rather than checks, so a hand-edited manifest can carry a `rollup` whose
 * members are numbers, and `Array.isArray` alone lets those through.
 */
export const wireVendorRollupSchema: z.ZodType<WireVendorRollup> = z.looseObject({
  vendor: z.string(),
  cost_usd: z.number().nonnegative().nullable(),
  unpriced_steps: z.number().int().nonnegative(),
  step_count: z.number().int().nonnegative(),
});

/**
 * The part of a run manifest {@link WireRunHistory} carries: when it ran, how it stands, and its
 * roll-up.
 *
 * `duration_ms` is the engine's own figure — `finalise` computes it from the same `Date` reading
 * that produced `ended_at`, so it is one measurement rather than a subtraction of two, and a reader
 * that recomputed it would be taking a second reading of a value it was handed.
 *
 * **`status` is a plain string and not an enum**, on {@link WireTicket}'s rule: refusing a status
 * this vocabulary does not know would refuse a document this product itself wrote, and naming an
 * unplaceable value is a screen's job rather than a parser's.
 */
export interface WireRunHistoryManifest {
  /** When the run started, as an ISO 8601 instant in UTC. Never empty. */
  readonly started_at: string;
  /** When it ended, or `null` while it is running or if it was killed outright. */
  readonly ended_at: string | null;
  /** `ended_at - started_at` exactly, from one clock reading, or `null`. */
  readonly duration_ms: number | null;
  readonly status: string;
  /** One row per vendor that finished a billed occurrence, in first-appearance order. */
  readonly rollup: readonly WireVendorRollup[];
}

/**
 * One occurrence of a run, as `GET /history/:id` reports it — what executed, how it went, and where
 * it sits in the order.
 *
 * **The glossary's word for this is *occurrence*, and the field that carries them keeps the
 * manifest's own name `steps`.** Two vocabularies meet here and neither is renamed into the other:
 * the manifest `core` writes calls the array `steps`, and one entry of it is an **occurrence** —
 * *"an adapter call, a script, or an integrate step, carrying its own usage, errors and retained
 * files"*.
 *
 * **`seq` is the only field here that is not on disk.** The route derives it with `occurrenceSeq`,
 * which reads the occurrence DIRECTORY'S NAME and opens nothing, and it is what orders these for a
 * reader — the array's own index is the order a manifest happens to have been appended in. It is
 * also why this is the copy a surface reads: the route sends the occurrence array twice, once
 * inside `manifest` exactly as `core` wrote it and once at the top level with `seq` added, and only
 * the second carries an ordering key.
 *
 * **Seven fields named out of an occurrence's fifteen, and loose for the rest**, which is
 * {@link wireVendorRollupSchema}'s rule at a second subject: a projection of a document `core`
 * writes and may widen. `role`, `model`, `branch`, `worktree`, `attempts`, `verdict`, `error` and
 * `usage` cross untyped rather than being refused.
 *
 * **What a required field costs is stated rather than left to be found.** A manifest whose
 * occurrence objects lack one of these makes the WHOLE detail response unparseable to a browser,
 * which reads as a request that could not be understood rather than as a run with no occurrences.
 * That is this schema's existing arrangement rather than a new hazard — `manifest.started_at` and
 * `manifest.status` have been required here since Q-0135 and fail the same way — and the honest
 * alternative, optional fields, would let a screen render a timeline whose rows say nothing.
 */
export interface WireRunHistoryOccurrence {
  /** The step's id, as the flow file declares it. */
  readonly step_id: string;
  /** What kind of thing ran — `core`'s `OccurrenceKind`, carried as a plain string. */
  readonly kind: string;
  /** How it went, on {@link WireRunHistoryManifest.status}'s rule: a plain string, never an enum. */
  readonly status: string;
  /** When it started, as an ISO 8601 instant in UTC. */
  readonly started_at: string;
  /** How long it took, or `null` while it is running or where none was recorded. */
  readonly duration_ms: number | null;
  /** Which adapter ran it, or `null` for an occurrence that is not an adapter call. */
  readonly adapter: string | null;
  /** The sequence number in its directory's name — derived by the route, never read off disk. */
  readonly seq: number;
}

/** Runtime validation for one occurrence, loose for the eight fields above it does not name. */
export const wireRunHistoryOccurrenceSchema: z.ZodType<WireRunHistoryOccurrence> = z.looseObject({
  step_id: z.string(),
  kind: z.string(),
  status: z.string(),
  started_at: z.string(),
  duration_ms: z.number().nonnegative().nullable(),
  adapter: z.string().nullable(),
  seq: z.number().int().nonnegative(),
});

/**
 * What `GET /history/:id` answers with, narrowed to what a surface reads.
 *
 * **It is the first validation of `started_at`, `ended_at`, `duration_ms` and `status` anywhere in
 * the chain**: `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a check"*, and the
 * route guards `rollup` and `steps` alone.
 *
 * **It said it closed *the last route on this transport that declared no shape* until Q-0018, and
 * that was wrong when it was written.** Two answered an inline object literal nothing declares, and
 * the other is `GET /project`, which still does after this ticket: a different route with a
 * different subject, named here so the corrected sentence is not read as coverage for it. What this
 * ticket closed is `GET /history`, whose shape is {@link WireRunHistoryList} below.
 *
 * **Loose at all three levels, deliberately.** *"Unknown keys are refused where Quorum owns the key
 * set, and preserved where it does not"* (2026-08-25): this is a projection of a document `core`
 * writes and may widen, so a `.strict()` shape here would turn a manifest this product produced into
 * a response a browser refuses. Every field named below is still required and still typed.
 *
 * **`steps` was deliberately absent until Q-0018, and what changed is its own stated reason.** That
 * sentence rested on the array being *"read by nothing that reads this shape"* — a claim with an
 * expiry date, which a caller reading it is what spent. It is declared now, as
 * {@link WireRunHistoryOccurrence} rather than over an occurrence's fifteen keys, which is the other
 * half of the objection that sentence raised and the half that still binds.
 */
export interface WireRunHistory {
  readonly manifest: WireRunHistoryManifest;
  /** Whether the run is still in flight, as the route reports it — never repaired, only reported. */
  readonly incomplete: boolean;
  /**
   * Each vendor's token total, already reduced over its own roll-up row and never across rows.
   *
   * `null` where that vendor reported neither input nor output tokens, which is the `n/a`-never-`0`
   * rule: nobody reported a measure is not the claim that the measure was zero.
   */
  readonly tokensByVendor: Readonly<Record<string, number | null>>;
  /**
   * What actually executed, in the route's `seq`-enriched copy and never `manifest.steps`.
   *
   * The two copies are different documents and only this one can be ordered; see
   * {@link WireRunHistoryOccurrence}. The duplication is measured and left alone — it is 42.7% of
   * this route's payload and a shipped screen reads it on every load, so removing the other copy is
   * a behaviour change rather than a tidy-up.
   */
  readonly steps: readonly WireRunHistoryOccurrence[];
}

/** Runtime validation for one run's history detail. */
export const wireRunHistorySchema: z.ZodType<WireRunHistory> = z.looseObject({
  manifest: z.looseObject({
    started_at: z.string().min(1),
    ended_at: z.string().nullable(),
    duration_ms: z.number().nonnegative().nullable(),
    status: z.string(),
    // The element schema and never a second copy of its four fields, which is what the listing
    // reads too — see `wireVendorRollupSchema`, whose own JSDoc carries the reasoning this comment
    // used to.
    rollup: z.array(wireVendorRollupSchema),
  }),
  incomplete: z.boolean(),
  tokensByVendor: z.record(z.string(), z.number().int().nonnegative().nullable()),
  steps: z.array(wireRunHistoryOccurrenceSchema),
});

/**
 * One finished — or unfinished — run, as `GET /history` lists it.
 *
 * **A row is a projection this transport composes**, not a `core` document carried through, which is
 * why it is `.strict()` where {@link WireRunHistory} is loose: Quorum owns every key below except
 * the roll-up's, and *"Unknown keys are refused where Quorum owns the key set"* (2026-08-25) is the
 * rule that decides which way each level goes. The roll-up's elements stay loose for their own
 * reason, stated on {@link wireVendorRollupSchema}.
 *
 * **Two naming conventions meet here and the difference is load-bearing rather than untidy.** A
 * field carrying a manifest value unaltered keeps the manifest's own snake_case name —
 * `started_at`, `ended_at`, `duration_ms` — so one run's start reads the same in the listing and in
 * the detail; a field this transport DERIVED is camelCase, which is `occurrenceCount` alone. A
 * reader can therefore tell what came off disk from what was computed for them without reading the
 * route. `id`, `ticket`, `flow`, `status` and `incomplete` predate the rule and are left: they are
 * the shipped names of the five fields this route has answered with since Q-0119, and renaming them
 * to satisfy a convention would be a breaking change bought with nothing.
 *
 * **Nothing here is nullable that the manifest does not make nullable, and the route manufactures
 * nothing.** A run in flight carries `ended_at: null` and `duration_ms: null` rather than a
 * computed value; an unpriced vendor carries `cost_usd: null` rather than `0`. Those are two
 * different claims, and only one of them is *free*.
 *
 * **There is no cap, no page and no truncation.** Measured over this repository's own 171 runs, the
 * whole listing is **63,115 B — 369 B a row** under the narrowed roll-up, against 16,145 B for the
 * five fields it carried before and 99,426 B had it carried the manifest's roll-up rows as they sit
 * on disk. The widening costs no extra read: `readRunsDir` already parses every manifest. A cap a
 * reader is not told about is worse than the bytes, which is Q-0127's answer to the same question
 * at a folder 50 times this size — and a later widening past it is a visible act rather than one
 * this sentence has excused in advance.
 */
export interface WireRunHistoryRow {
  /** The run directory's name, `<ticket id>-<run number>` — the token `GET /history/:id` takes. */
  readonly id: string;
  /** The ticket the run was against, as the manifest recorded it. */
  readonly ticket: string;
  /** The flow it ran, as `harness/flows/<name>.yaml` carries it. */
  readonly flow: string;
  /** How it stands, on {@link WireRunHistoryManifest.status}'s rule: a plain string, never an enum. */
  readonly status: string;
  /** Whether it never reached a terminal state — reported as it stands, never repaired. */
  readonly incomplete: boolean;
  /** When it started, as an ISO 8601 instant in UTC. Never empty, as the detail's own is not. */
  readonly started_at: string;
  /** When it ended, or `null` while it is running or if it was killed outright. */
  readonly ended_at: string | null;
  /** `ended_at - started_at` exactly, from one clock reading, or `null`. */
  readonly duration_ms: number | null;
  /** How many occurrences the manifest records. Derived by the route; not a manifest field. */
  readonly occurrenceCount: number;
  /** One row per vendor that finished a billed occurrence, in first-appearance order. */
  readonly rollup: readonly WireVendorRollup[];
}

/** Runtime validation for one history row. */
export const wireRunHistoryRowSchema: z.ZodType<WireRunHistoryRow> = z.object({
  id: z.string(),
  ticket: z.string(),
  flow: z.string(),
  status: z.string(),
  incomplete: z.boolean(),
  // `.min(1)` because {@link WireRunHistoryManifest.started_at} carries it: one value, two routes,
  // one rule. An empty recorded start is as unreadable as a missing one, and a row permitting it
  // where the detail does not would teach a reader that the two disagree about the same field.
  started_at: z.string().min(1),
  ended_at: z.string().nullable(),
  duration_ms: z.number().nonnegative().nullable(),
  occurrenceCount: z.number().int().nonnegative(),
  rollup: z.array(wireVendorRollupSchema),
}).strict();

/**
 * One run the listing could not read, and why — `core`'s own `RunWarning`, carried whole.
 *
 * **Both field names are kept, and Q-0121's GO-3 rule is what permits that rather than an exception
 * to it**: that rule forbids a wire field NARROWING a richer one from keeping its name, and this
 * narrows nothing. `runId` here is the run directory's name, which is what `core` puts in it.
 *
 * **Named inside the `WireRunHistory` family rather than `WireRunWarning`**, which would be a
 * near-homograph for something about {@link WireRun} — a live run the daemon is driving, an
 * unrelated subject reached by an unrelated id.
 */
export interface WireRunHistoryWarning {
  /** The run directory's name. The manifest could not be read, so this is all there is to name it by. */
  readonly runId: string;
  /** One sentence: a shape error, a missing manifest, or a parse failure in the parser's own words. */
  readonly message: string;
}

/** Runtime validation for one unreadable run. */
export const wireRunHistoryWarningSchema: z.ZodType<WireRunHistoryWarning> = z.object({
  runId: z.string(),
  message: z.string(),
}).strict();

/**
 * What a listing of run history answers with: the runs it could read, and every reason for the rest.
 *
 * **The warnings travel WITH the rows rather than instead of them**, which is `failSoftly`'s
 * distinction over HTTP: a store a reader could partly read is not an error, and answering 500 would
 * hide every run it could read because of one it could not. A surface rendering this owes the
 * unreadable runs a place of their own — dropping them would make the listing read as the whole
 * store.
 *
 * An envelope rather than a bare array, on {@link WireRunList}'s terms: a later field is additive
 * rather than a change of the response's own type.
 */
export interface WireRunHistoryList {
  readonly runs: readonly WireRunHistoryRow[];
  readonly warnings: readonly WireRunHistoryWarning[];
}

/** Runtime validation for a run-history listing. */
export const wireRunHistoryListSchema: z.ZodType<WireRunHistoryList> = z.object({
  runs: z.array(wireRunHistoryRowSchema),
  warnings: z.array(wireRunHistoryWarningSchema),
}).strict();

/**
 * One file an occurrence retained, as the retained listing names it: what to ask for, and how large.
 *
 * **No text**, which is {@link WireTicketFileEntry}'s arrangement for its reason at a store fifty
 * times the size: one run's retained text reaches 3,514,617 B and one occurrence's 355,744 B, so a
 * response carrying contents would hand a browser megabytes for a file nobody opened. `name` is what
 * a reader asks for afterwards, one file at a time, and `bytes` is what tells them what they are
 * about to ask for — which is what stands in for a cap here rather than a cap nobody is told about.
 *
 * **One leaf name and never a path.** `persist` takes an artifact's name as a plain `string`
 * parameter and every shipped caller passes one of two constants, so what a directory holds is not
 * what those constants say: the listing is the directory's own contents, and a name is joined onto a
 * directory the client never sees.
 */
export interface WireRunHistoryRetainedFile {
  /** The leaf name: non-empty, neither `.` nor `..`, and holding no path separator. */
  readonly name: string;
  readonly bytes: number;
}

/** Runtime validation for one named retained file. */
export const wireRunHistoryRetainedFileSchema: z.ZodType<WireRunHistoryRetainedFile> = z.object({
  name: z.string(),
  bytes: z.number().int().nonnegative(),
}).strict();

/**
 * One occurrence's retained files, under the number a client addresses that occurrence by.
 *
 * **`seq` is the identity and `occurrence_dir` is never one.** That field crosses to a browser today
 * only because `GET /history/:id` spreads the whole manifest occurrence through a `looseObject`, and
 * it is absent even from {@link WireRunHistoryOccurrence}'s own enumeration of what crosses loose —
 * so accepting it back would ratify an accident as a contract. Nothing here carries it, and neither
 * route accepts it under any spelling.
 *
 * `step_id` carries the manifest's value unaltered and therefore keeps the manifest's own name,
 * which is {@link WireRunHistoryRow}'s stated convention; it is here so that a collision names both
 * occurrences rather than one number twice.
 */
export interface WireRunHistoryRetainedOccurrence {
  /** The sequence number in the occurrence's directory name, as `GET /history/:id` also reports it. */
  readonly seq: number;
  /** The step's id, or `""` where the manifest carried none — a cast, never a check. */
  readonly step_id: string;
  /** Its retained files, sorted by name. Empty where the directory is there and holds none. */
  readonly files: readonly WireRunHistoryRetainedFile[];
}

/** Runtime validation for one occurrence's retained files. */
export const wireRunHistoryRetainedOccurrenceSchema: z.ZodType<WireRunHistoryRetainedOccurrence> = z.object({
  seq: z.number().int().nonnegative(),
  step_id: z.string(),
  files: z.array(wireRunHistoryRetainedFileSchema),
}).strict();

/**
 * One occurrence a retained listing could not name files for, and why.
 *
 * {@link WireRunHistoryWarning}'s arrangement one level in: the answer travels **with** the
 * occurrences it could name rather than instead of them, so one occurrence whose recorded directory
 * is gone or is refused never costs a reader the other fifty-four.
 *
 * **The message names a condition and never a path.** The value that made it necessary is the
 * manifest's own `occurrence_dir`, which nothing on the read path validates, so quoting a refused
 * one back would put a path nobody asked for into an answer.
 */
export interface WireRunHistoryRetainedWarning {
  /** The sequence number a reader would have addressed this occurrence by. */
  readonly seq: number;
  /** Its step id, so a shared sequence number names both occurrences rather than one twice. */
  readonly step_id: string;
  /** One sentence in the daemon's own words. */
  readonly message: string;
}

/** Runtime validation for one unnameable occurrence. */
export const wireRunHistoryRetainedWarningSchema: z.ZodType<WireRunHistoryRetainedWarning> = z.object({
  seq: z.number().int().nonnegative(),
  step_id: z.string(),
  message: z.string(),
}).strict();

/**
 * What one run's retained-file listing answers with: the occurrences it could name, and every reason
 * for the rest.
 *
 * **`.strict()` at all three levels, where {@link WireRunHistory} is loose**, and the rule that
 * decides each is *"Unknown keys are refused where Quorum owns the key set, and preserved where it
 * does not"* (2026-08-25). That shape is a projection of a document `core` writes and may widen;
 * this is composed by the transport out of a directory listing, so Quorum owns every key in it.
 *
 * **A separate route from `GET /history/:id` rather than a field on it**, which is measured rather
 * than preferred: that route is mission control's, read on every load of a screen that will never
 * fetch a retained file, and widening it would put a `readdir` and two `lstat`s per occurrence — up
 * to 55 of them on this repository's largest run — behind a header. It would also retire that
 * route's own documented property, *"It reads exactly one file."*
 */
export interface WireRunHistoryRetained {
  readonly occurrences: readonly WireRunHistoryRetainedOccurrence[];
  readonly warnings: readonly WireRunHistoryRetainedWarning[];
}

/** Runtime validation for one run's retained-file listing. */
export const wireRunHistoryRetainedSchema: z.ZodType<WireRunHistoryRetained> = z.object({
  occurrences: z.array(wireRunHistoryRetainedOccurrenceSchema),
  warnings: z.array(wireRunHistoryRetainedWarningSchema),
}).strict();

/**
 * One retained file, with its text.
 *
 * {@link WireTicketFile}'s contract at a second store, and the two clauses that make it honest are
 * the same. `bytes` is the size of the bytes **actually read** and never the size the listing
 * reported: this store moves under a reader in ordinary operation — it grew by six files while this
 * ticket's own requirement was being measured — so a listing is what a reader chooses by and never a
 * guarantee about what arrives. `text` is that file decoded as UTF-8, which is a claim the route has
 * to be able to make: a file whose bytes are not well-formed UTF-8 is refused under its own code
 * rather than served with substitutions in it. An empty file succeeds, carrying `bytes: 0`.
 */
export interface WireRunHistoryRetainedText {
  /** The leaf name that was read, echoed so a reader can tell which file answered. */
  readonly name: string;
  readonly bytes: number;
  readonly text: string;
}

/** Runtime validation for one retained file's contents. */
export const wireRunHistoryRetainedTextSchema: z.ZodType<WireRunHistoryRetainedText> = z.object({
  name: z.string(),
  bytes: z.number().int().nonnegative(),
  text: z.string(),
}).strict();

/**
 * The field names `POST /runs` accepts, in that route's own order.
 *
 * **The order is part of the value**, which is why this is a tuple and not a set: the route's
 * `unknown-field` refusal spells the accepted set out for a human — *"remove it; this route accepts
 * flow, ticket, dry, auto, base"* — so a reordering here changes a sentence somebody reads.
 *
 * It describes **what the route accepts**, never what any one client sends. Narrowing it to the
 * three a browser uses would make this package a second and weaker authority for a route another
 * client may also call; which fields a given surface is willing to send is that surface's own
 * property, checked where that surface is.
 */
export const WIRE_START_FIELDS = ['flow', 'ticket', 'dry', 'auto', 'base'] as const;

/**
 * What a caller asks the daemon to start.
 *
 * It lives here for {@link WireRefusal}'s and {@link WireRun}'s reason, arriving at Q-0130 in the
 * other direction: those two are what a **response** carries and this is what a **request** does,
 * and a browser needs an executable builder for it rather than a type. Until this ticket the field
 * set existed only inside `packages/server` — once as a `Set` in the route and once as the host's
 * own interface — so a browser composing a start body had to write the names a third time, which is
 * verbatim the drift Q-0120 was opened on and Q-0121 closed for the two response shapes.
 *
 * `gateAnswerEnvelopeSchema` is the precedent rather than the exception: a request shape has lived
 * in this package since Q-0013, and this is the second.
 *
 * **The three optional fields are optional here because the route treats them so**, and a client
 * that omits one is not asking for its default — it is saying nothing about it, which is what lets
 * the daemon own what silence means.
 */
export interface WireStartRequest {
  /** The flow's name, as `harness/flows/<name>.yaml` carries it. */
  readonly flow: string;
  /** The ticket token, resolved inside the backlog root by the daemon and never here. */
  readonly ticket: string;
  /** Walk the flow without invoking an adapter or writing anything. */
  readonly dry?: boolean;
  /** Advance author-declared gates without a human. */
  readonly auto?: boolean;
  /** The diff anchor `{base}` resolves to — a review's comparison point and nothing else. */
  readonly base?: string;
}

/**
 * Runtime validation for a start request.
 *
 * `.strict()` for the reason the route already gives: an unknown key is refused rather than
 * ignored, so a client that misspells `ticket` is told so instead of being given a run it did not
 * ask for. The two required fields are required here and non-emptiness is **not** checked — that is
 * the route's own predicate, which composes a `missing-field` refusal a caller can read, and a
 * second rule for it here would be a weaker copy answering in a different vocabulary.
 */
export const wireStartRequestSchema: z.ZodType<WireStartRequest> = z.object({
  flow: z.string(),
  ticket: z.string(),
  dry: z.boolean().optional(),
  auto: z.boolean().optional(),
  base: z.string().optional(),
}).strict();

/**
 * Runtime validation for one containment answer.
 *
 * The state strings are written as literals here and nowhere else in this file, and the annotation
 * is what checks them: a typo makes the inferred union unassignable to {@link ContainmentResult} and
 * fails at this line rather than at a renderer with no token for it. The reasons come from the
 * tuple, because that one is open-ended enough to be worth deriving.
 *
 * A proven state carries no reason and a contained result carries no ahead count, which `.strict()`
 * is what enforces on the wire: an answer carrying both would be a shape git cannot produce.
 *
 * **`ahead` is `.nonnegative()` since Q-0127**, as `count` and `pendingGates` already were in this
 * file. It is `rev-list --count`'s answer and a count of commits cannot be negative, so a schema
 * permitting one teaches a reader the wrong rule about which counts here are constrained — and this
 * schema is the only thing between a misread probe and a rendered figure.
 */
export const containmentResultSchema: z.ZodType<ContainmentResult> = z.discriminatedUnion('state', [
  z.object({ state: z.literal('contained') }).strict(),
  z.object({ state: z.literal('not-contained'), ahead: z.number().int().nonnegative() }).strict(),
  z.object({ state: z.literal('indeterminate'), reason: z.enum(CONTAINMENT_REASONS) }).strict(),
]);

/** Runtime validation for push lag, on the same terms as {@link containmentResultSchema}. */
export const pushLagResultSchema: z.ZodType<PushLagResult> = z.discriminatedUnion('state', [
  z.object({ state: z.literal('pushed') }).strict(),
  z.object({ state: z.literal('unpushed'), ahead: z.number().int().nonnegative(), upstream: z.string() }).strict(),
  z.object({ state: z.literal('indeterminate'), reason: z.enum(PUSH_LAG_REASONS) }).strict(),
]);

/**
 * One ticket, as the read-only surface reports it — frontmatter, one git fact, and one figure.
 *
 * **No field here is stricter than `ticketSchema`, and that is the load-bearing property rather than
 * an omission.** `stage` is a plain string and not `stageSchema`, because the daemon sends
 * `String(ticket.meta.stage)` and a `ticket.md` `parseFrontmatter` fell open on yields the literal
 * `"undefined"`; `iterations` is the same bare number record the disk schema declares, which permits
 * a float and a negative. A wire schema that refused either would turn a ticket this product accepts
 * into a board that does not render, which is the opposite of what a board is for — naming a stage
 * the vocabulary cannot place is the *screen's* job, not the parser's. See Q-0060, which this does
 * not fix and must not hide.
 *
 * `containment` was declared `unknown` until Q-0017 and is the closed union now, so a browser can
 * switch on it; `null` means git was asked nothing about this branch, which is not an indeterminate
 * answer and is carried through rather than flattened.
 *
 * **`id` is what the file said and `folder` is where the file is, which is why both are here.** A
 * `ticket.md` `parseFrontmatter` fell open on supplies no id, and `id` is then the empty string —
 * the same answer `title`, `owner` and `branch` already give for a value nobody wrote, rather than
 * the literal `"undefined"`, which is a fabricated id a reader cannot tell from a real one.
 * `folder` is the ticket directory's basename: it comes from `readdir` rather than from the damaged
 * file, it is unique under one backlog root by construction, and it is therefore the identity that
 * survives exactly the case where the other one does not. Two damaged tickets are two rows here and
 * not one.
 *
 * **`billedCostUsd` is `null` where nothing has run, and never `0`.** Nothing has run is not the
 * claim that it cost nothing, which is the `n/a`-never-`0` rule every other measure here is under.
 * It carries no vendor breakdown and no count of unpriced runs: a ticket file records one figure and
 * cannot see its own incompleteness, so what names that is `COST_LEGEND` in `board.ts` beside it.
 */
export interface WireTicket {
  /** The id the ticket's own frontmatter carries, or `''` where it carries none. Never invented. */
  readonly id: string;
  /** The ticket directory's basename — read from the backlog root, so a damaged file cannot lose it. */
  readonly folder: string;
  readonly title: string;
  readonly stage: string;
  readonly owner: string;
  readonly branch: string;
  /** Never stored: derived from git on this request, or `null` where git was asked nothing. */
  readonly containment: ContainmentResult | null;
  /** Loop counters by name, exactly as the ticket holds them — no denominator, which nothing has. */
  readonly iterations: Record<string, number>;
  /** The sum of the ticket's own history costs, or `null` where it has no history at all. */
  readonly billedCostUsd: number | null;
}

/** Runtime validation for one ticket row. */
export const wireTicketSchema: z.ZodType<WireTicket> = z.object({
  id: z.string(),
  folder: z.string(),
  title: z.string(),
  stage: z.string(),
  owner: z.string(),
  branch: z.string(),
  containment: containmentResultSchema.nullable(),
  iterations: z.record(z.string(), z.number()),
  billedCostUsd: z.number().nullable(),
}).strict();

/**
 * What a listing of the backlog answers with: the rows, the one repository-level git fact, and the
 * ref both git facts are *relative to*.
 *
 * `pushLag` sits on the envelope rather than on a row because it is a property of the repository and
 * not of any ticket — containment's sibling under the same rules, and `null` where git was not asked
 * at all.
 *
 * **`baseBranch` is on the envelope for the same reason, and it is what makes the other two
 * renderable.** A containment answer is spelled `<base>:contained` and a push-lag sentence names the
 * base in as many words, so a surface holding the states without the ref they were computed against
 * can render neither. `packages/cli` reads it out of the configuration it has already loaded; a
 * browser has no configuration, and a second request for one field would be a third round trip for a
 * value the answer it already has was computed with.
 */
export interface WireTicketList {
  readonly tickets: readonly WireTicket[];
  readonly pushLag: PushLagResult | null;
  /** The configured base branch these containment and push-lag answers were computed against. */
  readonly baseBranch: string;
}

/** Runtime validation for a backlog listing. */
export const wireTicketListSchema: z.ZodType<WireTicketList> = z.object({
  tickets: z.array(wireTicketSchema),
  pushLag: pushLagResultSchema.nullable(),
  baseBranch: z.string(),
}).strict();

/**
 * One file of a ticket folder, as a detail response names it: where it is, and how large.
 *
 * **No text.** A ticket folder is 3.1 MB at this backlog's largest and holds a single 1.46 MB file,
 * so a response carrying every file's contents would hand a browser a megabyte for a tab nobody
 * opened. `rel` is what a reader asks for afterwards, one file at a time, and `bytes` is what tells
 * them what they are about to ask for — which is what stands in for a cap here rather than a cap
 * nobody is told about.
 */
export interface WireTicketFileEntry {
  /** Path relative to the ticket folder, separated by `/`. Never absolute, never traversing. */
  readonly rel: string;
  readonly bytes: number;
}

/** Runtime validation for one listed file. */
export const wireTicketFileEntrySchema: z.ZodType<WireTicketFileEntry> = z.object({
  rel: z.string(),
  bytes: z.number().int().nonnegative(),
}).strict();

/**
 * What a detail response says it did not name: how many files, and how many bytes.
 *
 * **A count and a total, and no paths.** The subject is the engine's own run state — every path
 * under a ticket folder whose first segment begins with a dot — which is gitignored and therefore
 * not in the database this product keeps. Saying nothing would be a listing that reads as the whole
 * folder; naming the paths would make a backlog route a second run-history surface, which is
 * Q-0018's. So it says the listing is not everything and stops there.
 */
export interface WireExcludedFiles {
  readonly count: number;
  readonly bytes: number;
}

/** Runtime validation for the exclusion disclosure. */
export const wireExcludedFilesSchema: z.ZodType<WireExcludedFiles> = z.object({
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
}).strict();

/**
 * One ticket in full: the row a listing carries, and the names of the files beside it.
 *
 * `ticket` is the same {@link WireTicket} `GET /tickets` answers with for this ticket and is built
 * by the same projection, so the board and the page cannot disagree about one ticket.
 *
 * **It carries no push lag and no base branch.** Push lag is a repository-level fact and belongs on
 * the listing that renders it; a second claim of it here would be a second place to be wrong. The
 * base branch travels with the answers it was computed against, which is the listing's envelope —
 * so a page holding this shape renders no containment token, having no ref to spell one against.
 */
export interface WireTicketDetail {
  readonly ticket: WireTicket;
  readonly files: readonly WireTicketFileEntry[];
  readonly excluded: WireExcludedFiles;
}

/** Runtime validation for one ticket's detail. */
export const wireTicketDetailSchema: z.ZodType<WireTicketDetail> = z.object({
  ticket: wireTicketSchema,
  files: z.array(wireTicketFileEntrySchema),
  excluded: wireExcludedFilesSchema,
}).strict();

/**
 * One file of a ticket folder, with its text.
 *
 * `bytes` is the size of the bytes that were **actually read**, not the size the listing reported:
 * a file can change between the moment it was named and the moment it was asked for, so the listing
 * is what a reader chooses by and never a guarantee about what arrives. `text` is that file decoded
 * as UTF-8, which is a claim the route has to be able to make — a file whose bytes are not
 * well-formed UTF-8 is refused under its own code rather than served with substitutions in it.
 */
export interface WireTicketFile {
  readonly rel: string;
  readonly bytes: number;
  readonly text: string;
}

/** Runtime validation for one file's contents. */
export const wireTicketFileSchema: z.ZodType<WireTicketFile> = z.object({
  rel: z.string(),
  bytes: z.number().int().nonnegative(),
  text: z.string(),
}).strict();

/**
 * One flow file, as the read-only surface reports it.
 *
 * **A flow the linter refuses is named rather than hidden** (Q-0055 AC-16), which is why `runnable`
 * and `problems` are both here and why `consumes` and `produces` are nullable: a refused record may
 * never have parsed at all. `consumes` is a plain string for {@link WireTicket}'s reason — a flow
 * naming a stage this product does not know is a flow to report, not one to drop.
 */
export interface WireFlow {
  readonly name: string;
  readonly runnable: boolean;
  readonly consumes: string | null;
  readonly produces: string | null;
  readonly problems: readonly string[];
}

/** Runtime validation for one flow row. */
export const wireFlowSchema: z.ZodType<WireFlow> = z.object({
  name: z.string(),
  runnable: z.boolean(),
  consumes: z.string().nullable(),
  produces: z.string().nullable(),
  problems: z.array(z.string()),
}).strict();

/** What a listing of the flow directory answers with. */
export interface WireFlowList {
  readonly flows: readonly WireFlow[];
}

/** Runtime validation for a flow listing. */
export const wireFlowListSchema: z.ZodType<WireFlowList> = z.object({
  flows: z.array(wireFlowSchema),
}).strict();
