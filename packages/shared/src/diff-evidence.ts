/**
 * The diff one step was given, captured where it was produced and served to a gate screen.
 *
 * **Declared once, here, and not twice.** `packages/core` fills it inside `materialiseDiff`,
 * `packages/server` holds one per pending gate and answers a read-only route with it, and a browser
 * parses it — three consumers, one shape. That is the rule `WireRun.gates` records for itself:
 * a value that narrows nothing keeps one declaration, because two declarations of one shape are
 * free to drift the moment either end gains a field, which is the drift Q-0120 was opened on. It
 * carries no `Wire` prefix for the same reason {@link ContainmentResult} and {@link PushLagResult}
 * carry none — the producer is `core`, and the wire is one of the places it goes rather than what
 * it is.
 *
 * **Nothing here is a second measurement.** Every field is a value `materialiseDiff` already holds
 * at the one site it holds them: the interpolated range, the `--stat` it ran, the bytes it kept,
 * the limit it read, the byte counts it compared and the file list it derived. So a browser
 * rendering this renders the reviewer's own measurement rather than re-deriving one after the refs
 * may have moved — identity rather than inference, which is the shape *"A gate question carries the
 * decision that reached it"* (2026-09-17) settled for a different field one day earlier.
 *
 * **And it deliberately does NOT travel on the event union**, which is the half that entry answered
 * the other way. `contracts/Q-0050/run-events.contract.md` carries the reason and it is size and
 * replay rather than kind: a patch is capped at `repo.max_diff_bytes` — 200,000 by default —
 * against a 214 B mean event, and an event enters a broadcast buffer replayed to every late
 * subscriber, where `reached`'s own snapshot was measured at 13 KB.
 */
import { z } from 'zod';

/**
 * One step's diff, whole or truncated, with the truncation stated rather than inferred.
 *
 * **`truncated`, `kept` and `total` cannot disagree**, and the redundancy is safe for
 * `pendingGates`' reason: all three are computed at one site from the same two buffers, so
 * `truncated` is `kept < total` and is carried rather than derived because what a reader is owed is
 * the producer's own answer, not a comparison a consumer made.
 */
export interface DiffEvidence {
  /** The step whose prompt these bytes went into, as the engine interpolated its id. */
  readonly stepId: string;
  /** The interpolated three-dot range, exactly as the diff was taken — never the flow file's template. */
  readonly range: string;
  /** `git diff --stat <range>`, trimmed. It names every file in the range, the omitted ones included. */
  readonly stat: string;
  /** The patch text the step was given, byte for byte. Empty only where git produced nothing, which throws. */
  readonly patch: string;
  /** Whether git produced more patch than was kept. */
  readonly truncated: boolean;
  /** `repo.max_diff_bytes` as this run read it. */
  readonly limit: number;
  /** How many UTF-8 bytes of patch were kept. Never above {@link DiffEvidence.limit}. */
  readonly kept: number;
  /** How many UTF-8 bytes git produced. Equal to {@link DiffEvidence.kept} where nothing was cut. */
  readonly total: number;
  /**
   * The files the kept patch carries no hunk for at all, in `git diff`'s own path order.
   *
   * **Empty is a real answer and not an absence**: where a patch was truncated and this is empty,
   * every file has some patch and the last one is cut short — which is a different and lesser
   * problem than having none, and is the distinction `diff.ts` already draws in the notice it
   * composes for the step.
   */
  readonly omitted: readonly string[];
}

/** Runtime validation for one step's diff evidence. */
export const diffEvidenceSchema: z.ZodType<DiffEvidence> = z.object({
  stepId: z.string(),
  range: z.string(),
  stat: z.string(),
  patch: z.string(),
  truncated: z.boolean(),
  // `.nonnegative()` on all three, as `ahead`, `count` and `pendingGates` are in `wire.ts`: these
  // are byte counts and a byte count cannot be negative, so a schema permitting one teaches the
  // wrong rule about which numbers here are constrained.
  limit: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  omitted: z.array(z.string()),
}).strict().superRefine((value, ctx) => {
  // **The invariant the docblock above states, enforced rather than described.** That comment says
  // the three cannot disagree and that `truncated` IS `kept < total`, and until this clause it was
  // a claim about the PRODUCER — true of `materialiseDiff`, which computes all three at one site —
  // sitting on a schema whose whole job is the opposite: validating a value that has crossed a
  // boundary and did NOT necessarily come from that site. So `{ truncated: false, kept: 10,
  // total: 20 }` parsed cleanly while contradicting the sentence four lines above it.
  //
  // Found by a cross-vendor hand pass over the files this ticket's three reviews were never handed
  // a patch for — the review diff was truncated on all three rounds and this file was omitted every
  // time — and repaired after the gate on Q-0073's and Q-0080's precedent.
  if (value.kept > value.total) {
    ctx.addIssue({ code: 'custom', path: ['kept'], message: 'kept exceeds total: a truncation cannot keep more bytes than it measured' });
  }
  if (value.truncated !== value.kept < value.total) {
    ctx.addIssue({
      code: 'custom', path: ['truncated'],
      message: `truncated is ${String(value.truncated)} while kept ${value.kept} and total ${value.total} say ${String(value.kept < value.total)}`,
    });
  }
}) as unknown as z.ZodType<DiffEvidence>;
