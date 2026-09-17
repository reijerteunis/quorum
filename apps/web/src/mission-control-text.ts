/** Typed contract for mission-control copy shared by rendering and assertions. */

/**
 * Honest explanation for a successfully loaded empty run listing.
 *
 * **One of its two clauses went false at Q-0130 and the other did not.** *"This app cannot start
 * one"* was true until a ticket page could, so it is replaced by where a reader starts one. The
 * second clause stands unaltered: `quorum run` imports `runFlow` from `@quorum/core` and runs it in
 * its own process, so a run started at a command line is one this daemon's registry has never heard
 * of and no ticket here changes that.
 */
export const EMPTY_RUNS_TEXT =
  'The daemon is driving no runs. A ticket page is where one is started, and quorum run uses a different process that this daemon cannot see.';

/** Honest explanation when the daemon supplied no ticket identity for a run. */
export const NO_TICKET_ID_TEXT = 'The daemon supplied no ticket id for this run.';

/** Exact labels for the three timeline facts the event stream can establish. */
export const STEP_DISPOSITION_TEXT = {
  started: 'Started; no end has been reported yet.',
  ended: 'Ended.',
  'started-with-no-end-reported': 'The run ended without reporting an end for this step.',
} as const;

/**
 * Exact disclosures for values and structures absent from the live contract.
 *
 * **The first one changed subject at Q-0131 rather than retiring.** It said *"The run's number is
 * not on the wire until the run ends"*, which stopped being true the day `core` began reporting the
 * number at run start — but the state it describes did not stop happening, because a metadata read
 * that is still in flight or that failed supplies no number either. So it names the read rather
 * than the run's age, and `mission-control-status.tsx` renders it only where no number was loaded.
 */
export const MISSION_CONTROL_DISCLOSURES = [
  "The run's number has not been read from the daemon; its handle identifies it meanwhile.",
  'Elapsed time is unavailable because no event has a timestamp and the run has no start time on the wire.',
  'Per-vendor cost and token totals are unavailable as structured values; they occur only inside a human-readable message.',
  "What comes next is unavailable because the run metadata carries no flow step list.",
  "Structured tool calls and assistant reasoning are unavailable because neither event kind has a producer; columns show the vendor's stdout.",
] as const;

/** Explain a replay prefix omitted by the daemon. */
export const daemonMissedText = (count: number): string =>
  `The daemon omitted ${String(count)} earlier events from this replay.`;

/** Explain live events accepted and later evicted by this browser. */
export const browserDiscardedText = (count: number): string =>
  `This browser discarded ${String(count)} earlier live events to keep the view bounded.`;
