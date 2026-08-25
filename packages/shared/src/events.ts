// The one trace and event format. Adapters map onto it; nothing above the adapter layer branches
// on which vendor produced an event.
//
// ---------------------------------------------------------------------------------------------
// DERIVED FROM WHAT THE PRODUCT EMITS, NOT FROM A DOCUMENT LINE
// ---------------------------------------------------------------------------------------------
//
// Two documents disagreed about this union and neither described the code.
// docs/04-architecture.md:28 named six kinds — spawn, tool, text, verdict, usage, done — of which
// only `spawn` had a producer. docs/03-adapter-contract.md:32 named two. The code emits three, and
// prints six more things through a `ui` object the CLI supplies. Both documents are corrected in
// the change that adds this file; what follows is the evidence they were corrected against.
//
//   what exists                                          where                       here
//   ---------------------------------------------------  --------------------------  --------------
//   { type: 'spawn',  vendor, cmd }                       claude.js:31, codex.js:52   member
//   { type: 'stdout', line }                              claude.js:32, codex.js:60,  member
//                                                         mock.js:66
//   { type: 'retry',  vendor, attempt, of, delayMs,       adapters/index.js:109       member
//                     reason, message }                   (the contract layer, not a vendor)
//   ui.step(id, m) / ui.done(id, m)                       bin/harness.js:66-67        members
//   ui.info(m)     / ui.warn(m)                           bin/harness.js:64-65        members
//   ui.gate({kind, reason, ticketDir, retry}) — ASKS      bin/harness.js:74-127       the QUESTION
//                                                                                     is a member
//   tool, text                                            emitted by nothing          NOT ADDED
//
// `tool` and `text` are not invented here. Producing them requires an adapter to parse vendor
// JSONL into normalised events, which changes what `--verbose` prints (bin/harness.js:69) and
// enlarges Q-0047; no ticket authorises it, and "The port preserves behaviour" (docs/DECISIONS.md,
// 2026-08-25) makes that a stop-and-report rather than a design opportunity. Widening a
// discriminated union later is additive and every non-exhaustive consumer fails at `tsc`, so the
// cost of adding them once a producer exists is a type error at build time. The cost of inventing
// their payloads now, thirteen tickets deep, is not.
//
// How a gate's ANSWER travels back is not decided here. Q-0050 owns the channel, along with
// ordering, terminal semantics and error representation. This file defines payload shapes only,
// and nothing in this package emits, persists, replays or transports an event.
//
// ---------------------------------------------------------------------------------------------
// VENDOR IDENTITY: ONE NEUTRAL, OPEN LABEL — AND HOW REGISTER ROW 22 IS TO BE READ
// ---------------------------------------------------------------------------------------------
//
// harness/port-charter.md's register row 22 says "nothing downstream learns which vendor produced
// an event". That wording cannot be applied literally, and a child's reviewer should not spend a
// round rediscovering why:
//
//   - `spawn` and `retry` carry a vendor field today (claude.js:31, codex.js:52,
//     adapters/index.js:109), so removing it is a behaviour change, which the port does not
//     authorise.
//   - "Codex cost is reported as tokens, never priced locally" (docs/DECISIONS.md, 2026-08-22)
//     requires per-vendor roll-ups and forbids a blended number, so downstream must be able to
//     group by vendor.
//   - contracts/Q-0011/run-manifest.schema.json REQUIRES `vendor` in both `$defs.usage` and
//     `$defs.vendor_rollup`, and it is frozen.
//
// The operative reading is therefore: NO VENDOR-SPECIFIC FIELD AND NO VENDOR BRANCHING OUTSIDE AN
// ADAPTER; a neutral `vendor` label is permitted and required. No field below could be populated
// by one vendor and not another, and the label is an open string — closing it would mean a
// contributor's new adapter cannot emit an event without editing this package, and an unknown
// adapter name is already refused with a good message by `getAdapter`
// (spike/src/adapters/index.js:29), so nothing is lost.
import { z } from 'zod';

/**
 * Which vendor a call was billed to. Open on purpose; see the note above. The names that ship
 * today are the three adapter names in the spike's registry (spike/src/adapters/index.js:25).
 */
const vendorLabel = z.string();

/** The id of the step an event belongs to. Supplied by the engine, never by an adapter. */
const stepId = z.string();

// ---------- what an adapter emits ----------
//
// An adapter is handed `onEvent` and knows nothing about the run around it — no step id, no run
// id, no flow. These three shapes are the adapter contract's `onEvent`
// (docs/03-adapter-contract.md) and their fields are verbatim from the lines cited above.

export const spawnEventSchema = z.object({
  type: z.literal('spawn'),
  vendor: vendorLabel,
  /** The command line, quoted for a human to read — spike/src/adapters/claude.js:31. */
  cmd: z.string(),
}).passthrough();

export const stdoutEventSchema = z.object({
  type: z.literal('stdout'),
  /** One line of the CLI's stdout, newline stripped — spike/src/adapters/claude.js:76-80. */
  line: z.string(),
}).passthrough();

/**
 * Emitted by the contract layer's retry wrapper, not by any vendor — a dropped connection is not a
 * verdict (spike/src/adapters/index.js:63-115). Always shown, verbose or not: a run that goes
 * quiet for thirty seconds should say why (spike/bin/harness.js:72).
 */
export const retryEventSchema = z.object({
  type: z.literal('retry'),
  vendor: vendorLabel,
  attempt: z.number(),
  of: z.number(),
  delayMs: z.number(),
  /** Why it is worth retrying, in words — spike/src/adapters/index.js:37-50. */
  reason: z.string(),
  message: z.string(),
}).passthrough();

export const adapterEventSchema = z.discriminatedUnion('type', [
  spawnEventSchema,
  stdoutEventSchema,
  retryEventSchema,
]);

// ---------- what a run emits ----------
//
// The engine knows which step is speaking and supplies it: `ui.trace(step.id, e)`
// (spike/src/engine.js:247) already carries the id alongside every adapter event, while adapters
// emit no identity at all. That is the whole envelope — a step id and nothing more. Ordering,
// timestamps, run ids and terminal events belong to Q-0050.

/** A step has started. Payload: `ui.step(step.id, "<adapter>/<model> role=<role>")`. */
export const stepStartedEventSchema = z.object({
  type: z.literal('step'),
  stepId,
  message: z.string(),
}).passthrough();

/** A step finished. Payload: `ui.done(step.id, "verdict=… cost=… 1234ms")`, `"exit 0"`, … */
export const stepDoneEventSchema = z.object({
  type: z.literal('done'),
  stepId,
  message: z.string(),
}).passthrough();

/** Run-level narration with no step of its own — `ui.info(m)`, spike/bin/harness.js:64. */
export const infoEventSchema = z.object({
  type: z.literal('info'),
  message: z.string(),
}).passthrough();

/** Run-level warning — `ui.warn(m)`, spike/bin/harness.js:65. */
export const warnEventSchema = z.object({
  type: z.literal('warn'),
  message: z.string(),
}).passthrough();

/**
 * The gate QUESTION — the only event that expects an answer. Payload verbatim from the one call
 * site, spike/src/engine.js:574, as consumed at spike/bin/harness.js:74.
 *
 * `kind` is open for the reason gate steps are open in flow.ts: anything that is neither `auto`
 * nor overridden is treated as human-gated (spike/src/engine.js:559). `retry` is present only when
 * the gate offers a retry — an exhaustion gate does, an author-declared gate does not.
 */
export const gateQuestionEventSchema = z.object({
  type: z.literal('gate'),
  kind: z.string(),
  reason: z.string(),
  /** Absolute path of the ticket folder, so a human can go and look. */
  ticketDir: z.string(),
  /** The step id a `retry` answer would jump back to — spike/src/engine.js:553, :580. */
  retry: z.string().optional(),
}).passthrough();

export const eventSchema = z.discriminatedUnion('type', [
  spawnEventSchema.extend({ stepId }),
  stdoutEventSchema.extend({ stepId }),
  retryEventSchema.extend({ stepId }),
  stepStartedEventSchema,
  stepDoneEventSchema,
  infoEventSchema,
  warnEventSchema,
  gateQuestionEventSchema,
]);

export type SpawnEvent = z.infer<typeof spawnEventSchema>;
export type StdoutEvent = z.infer<typeof stdoutEventSchema>;
export type RetryEvent = z.infer<typeof retryEventSchema>;
export type AdapterEvent = z.infer<typeof adapterEventSchema>;
export type StepStartedEvent = z.infer<typeof stepStartedEventSchema>;
export type StepDoneEvent = z.infer<typeof stepDoneEventSchema>;
export type InfoEvent = z.infer<typeof infoEventSchema>;
export type WarnEvent = z.infer<typeof warnEventSchema>;
export type GateQuestionEvent = z.infer<typeof gateQuestionEventSchema>;
export type Event = z.infer<typeof eventSchema>;
