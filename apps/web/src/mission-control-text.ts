/** Typed contract for mission-control copy shared by rendering and assertions. */

/** Honest explanation for a successfully loaded empty run listing. */
export const EMPTY_RUNS_TEXT =
  'The daemon is driving no runs. This app cannot start one, and quorum run uses a different process that this daemon cannot see.';

/** Honest explanation when the daemon supplied no ticket identity for a run. */
export const NO_TICKET_ID_TEXT = 'The daemon supplied no ticket id for this run.';

/** Exact labels for the three timeline facts the event stream can establish. */
export const STEP_DISPOSITION_TEXT = {
  started: 'Started; no end has been reported yet.',
  ended: 'Ended.',
  'started-with-no-end-reported': 'The run ended without reporting an end for this step.',
} as const;

/** Exact disclosures for values and structures absent from the live contract. */
export const MISSION_CONTROL_DISCLOSURES = [
  "The run's number is not on the wire until the run ends; its handle identifies it meanwhile.",
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
