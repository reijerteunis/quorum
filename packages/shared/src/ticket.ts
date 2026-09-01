// `ticket.md` frontmatter — the ten fields the backlog writes, as they are written.
//
// What is required and what is optional follows one rule: THE SCHEMA REQUIRES WHAT
// `Backlog.create()` ALWAYS WRITES (spike/src/backlog.js:60-68), EXCEPT WHERE A READER SUPPLIES
// ITS OWN FALLBACK. So `iterations` and `history` are optional, because the engine reads them as
// `?? {}` and `?? []` (spike/src/engine.js:44, :634, :661, :745) and a ticket without them is a
// ticket the engine already runs; everything else is required, because the only writer writes it
// unconditionally and every one of the 27 tickets in this repository carries it.
//
// Nothing here carries a default. `parseFrontmatter` itself requires no field and invents none
// (spike/src/backlog.js:11-15); a zod default would hand thirteen later tickets a value the file
// did not contain, and no test would fail.
import { z } from 'zod';

import { stageSchema } from './stages.js';

/**
 * One entry in a ticket's run history. `outcome()` (spike/src/engine.js:655-657) writes EIGHT
 * fields, and docs/02-sdlc-pipeline-spec.md showed four until this change corrected it.
 *
 * The three that are optional are optional because SHORTER ENTRIES EXIST ON DISK: five of the 59
 * entries in this repository predate `status`, `stage_before` and `stage_after`. Rejecting them
 * would be a migration, not a port — and `contracts/Q-0006/ticket-review-state.schema.json`
 * already models the older shape as a separate branch of its own union.
 *
 * `stage` duplicates `stage_after` in every entry the current writer produces. That is a known
 * redundancy, reported rather than fixed: the port preserves behaviour.
 */
export const ticketHistoryEntrySchema = z.looseObject({
  stage: stageSchema,
  /** The run number, allocated from `runs.log` — spike/src/engine.js:744-751. */
  run: z.number(),
  /** The flow's `name`, not a stage. Hand-written entries name one-off flows too. */
  flow: z.string(),
  /** completed | regressed | aborted | failed | interrupted | undecided | exhausted. Typed open: the
   * run status vocabulary belongs to whichever package needs it twice (spike/bin/harness.js:131),
   * and Q-0049 and Q-0050 own that decision. `undecided` is Q-0040's: a run that reached a gate no
   * answer was available for, which moves no stage. */
  status: z.string().optional(),
  stage_before: stageSchema.optional(),
  stage_after: stageSchema.optional(),
  /** An ISO 8601 instant, as `new Date().toISOString()` writes it. */
  at: z.string(),
  /**
   * Billed cost in USD, or null. Null is "the vendor reported no price", which is not zero — it is
   * rendered `n/a` beside a token count and never `$0.000` ("Codex cost is reported as tokens,
   * never priced locally", docs/DECISIONS.md 2026-08-22).
   */
  cost: z.number().nullable(),
});

export const ticketSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  /** The ticket's position in the state machine, and only that. Where the code IS is derived from
   * git on every `board` invocation and stored nowhere. */
  stage: stageSchema,
  /** The human who owns the CURRENT stage. */
  owner: z.string(),
  /** Only meaningful in the central backlog layout. Written and never read. */
  repos: z.array(z.string()),
  /** The ticket's integration branch — `harness/<id>/integration` (spike/src/backlog.js:64). */
  branch: z.string(),
  /** Written and never read (spike/src/backlog.js:64). */
  priority: z.string(),
  /**
   * A date STRING, not a date value: `create()` writes `…toISOString().slice(0, 10)`
   * (spike/src/backlog.js:65) and the YAML core schema has no timestamp type, so it round-trips as
   * `YYYY-MM-DD` text. The shape is not enforced, because nothing enforces it today.
   */
  created: z.string(),
  /**
   * Loop counters, by name. BOTH key forms occur on disk and both are legal:
   *
   *   - the dotted `<flow>.<step>` the engine computes when a step declares no counter —
   *     `qa-red.scenario-review`, `chore.review` (spike/src/engine.js:541);
   *   - a bare, unprefixed key from a step's explicit `on_fail.counter` — `review`, which
   *     harness/flows/review.yaml:41 declares and lint requires to be unprefixed
   *     (spike/src/lint.js:71-74).
   *
   * NOT the two fixed keys (`review`, `qa`) that docs/02-sdlc-pipeline-spec.md showed until this
   * change corrected it.
   */
  iterations: z.record(z.string(), z.number()).optional(),
  history: z.array(ticketHistoryEntrySchema).optional(),
});

export type TicketHistoryEntry = z.infer<typeof ticketHistoryEntrySchema>;
export type Ticket = z.infer<typeof ticketSchema>;
