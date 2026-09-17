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
 * takes one. `runId` is `core`'s own number and is `null` until the terminal event carries it,
 * which is a fact about the engine rather than about the transport.
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
 * `gateId` is the correlation token an answer has to echo, and `kind`, `reason` and `retry` are the
 * whole of what a gate screen can honestly render — a browser that had only the count could say a
 * gate was waiting and could not say what it asked or offer an answer to it.
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
  state: wireRunStateSchema,
  pendingGates: z.number().int().nonnegative(),
  // The event union's own schema as the element, never a second declaration of those six fields:
  // the question a browser echoes back has to be the question `askGate` emitted, and two
  // declarations of one shape are free to drift the moment either end gains a field.
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
