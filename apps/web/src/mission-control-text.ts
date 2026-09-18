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
 *
 * **The second and third changed subject at Q-0135 rather than retiring, for the first one's
 * reason.** They said elapsed time was unavailable *because no event has a timestamp* and that cost
 * occurred *only inside a human-readable message* — both true of the wire when they were written,
 * and both describing the only sources that existed then. Neither reasoning is contradicted: the
 * figures are read from `GET /history/:id`, a route this app had never called, whose manifest `core`
 * has been writing live all along. So each now names the READ that has not supplied its value, and
 * `mission-control-status.tsx` renders it only until one has — which is the one thing a retired
 * disclosure must not become, a sentence dropped beside a value that is not there.
 */
export const MISSION_CONTROL_DISCLOSURES = [
  "The run's number has not been read from the daemon; its handle identifies it meanwhile.",
  "Elapsed time is unavailable because the run's history, which records when it started, has not been read.",
  "Per-vendor cost and token totals are unavailable because the run's history, which records them, has not been read.",
  "What comes next is unavailable because the run metadata carries no flow step list.",
  "Structured tool calls and assistant reasoning are unavailable because neither event kind has a producer; columns show the vendor's stdout.",
] as const;

/** What the measured region calls the two values, so a reader and a test read one word for each. */
export const ELAPSED_LABEL = 'Elapsed';
export const COST_LABEL = 'Cost per vendor';

/**
 * Whose clock produced a figure that is still advancing.
 *
 * Named because the two figures have two authorities: a live one is this browser's clock measured
 * against an instant the daemon recorded, and a frozen one is the engine's own single measurement.
 * A reader comparing the two across machines is owed the difference.
 */
export const ELAPSED_BROWSER_CLOCK_TEXT = "measured by this browser's clock against the start the run recorded";

/** Whose measurement the frozen figure is — one clock reading, taken where the run finished. */
export const ELAPSED_ENGINE_TEXT = 'measured by the engine when the run finished';

/**
 * A walk that wrote no run history, which is a reason of its own and not a failed read.
 *
 * It says what is absent and why, and it says the second half — that nothing was spent — because
 * *no figures* beside a run a reader has just started looks like a defect rather than the point of
 * a dry walk.
 */
export const MEASURED_DRY_TEXT =
  'This run is a dry walk: it invoked no adapter and wrote no run history, so there is nothing recorded to measure. Nothing was spent either.';

/** No run number yet, so there is no history id to ask for — a state, not a failure. */
export const MEASURED_NO_RUN_NUMBER_TEXT =
  "The run's number has not been read from the daemon, and its history is addressed by that number, so none was asked for.";

/** No ticket id, which is the other half of the same address and a different thing to say. */
export const MEASURED_NO_TICKET_TEXT =
  'The daemon resolved no ticket for this run, and its history is addressed by ticket and number together, so none was asked for.';

/** The run has ended and the last read recorded no duration — the engine's figure, not one to invent. */
export const ELAPSED_ENDED_UNMEASURED_TEXT =
  'This run has ended and the last read of its history recorded no duration for it. Check again for the figure the engine wrote.';

/** A start instant that is not one, named rather than rendered as a difference nobody can take. */
export const ELAPSED_UNREADABLE_START_TEXT =
  "The run's history records a start time this page cannot read as an instant, so no elapsed time is shown.";

/**
 * An empty roll-up, which is not the same claim as *free* and not the same claim as *unpriced*.
 *
 * A roll-up row exists only for a vendor that has finished a billed occurrence, so a vendor that has
 * run and finished none is ABSENT rather than present at zero. Saying nothing here would let a
 * reader take an empty region for a run that cost nothing.
 */
export const NO_ROLLUP_ROWS_TEXT =
  'No vendor has finished a billed step on this run, so its roll-up names none. A vendor that has run without finishing one is absent from it rather than free.';

/**
 * That the figures are behind, and by what.
 *
 * **It names the step rather than only the read**, because *as of that read* alone is a claim these
 * figures cannot support: the roll-up is recomputed when an occurrence TERMINATES, and an occurrence
 * in this repository's history has run for an hour and a half, so a refresh pressed a moment ago can
 * return a total that is twenty minutes behind at the ninetieth percentile.
 */
export const COST_IN_FLIGHT_TEXT =
  'This run is still in flight: these figures are as of the last read and omit whatever the step now running has not been billed for.';

/** What a vendor that reported no price at all is owed, which is never a zero. */
export const unpricedVendorText = (tokens: number | null): string =>
  tokens === null
    ? 'reported no price and no token total: n/a, which is not zero.'
    : `reported no price: ${String(tokens)} tokens, which is unpriced rather than free.`;

/** How much of its own total a partly-priced vendor cannot see. */
export const unpricedStepsText = (count: number): string =>
  `${String(count)} of its counted steps reported no price, so this figure is short by whatever they cost.`;

/** Explain a replay prefix omitted by the daemon. */
export const daemonMissedText = (count: number): string =>
  `The daemon omitted ${String(count)} earlier events from this replay.`;

/** Explain live events accepted and later evicted by this browser. */
export const browserDiscardedText = (count: number): string =>
  `This browser discarded ${String(count)} earlier live events to keep the view bounded.`;
