/**
 * What the run-history screen says, and the closed vocabulary it says one of it from.
 *
 * A pure module with no DOM and no `fetch`, which is `mission-control-text.ts`'s and
 * `mission-control-measures.ts`'s arrangement for their reason: every rule below is asserted by
 * value rather than by rendering, so a verdict about it is a property of the commit rather than of
 * the machine the suite runs on.
 *
 * **It declares no measure and formats no figure.** A cost, a token total and a duration are
 * `mission-control-measures.ts`'s, imported by the screen rather than restated here — the rules
 * governing them are the product's rather than one screen's, and a second copy of *an unpriced
 * vendor renders `n/a` and never `$0.00`* would be a second place to be wrong about a sentence this
 * repository has already paid to learn.
 */

/**
 * Every status a run manifest can record, and the order `core` declares them in.
 *
 * **The authority is `packages/core`'s `RunStatus`**, which `apps/web` may not import — principle 4
 * of `docs/04-architecture.md` forbids this package naming `@quorum/core` at all — and which the
 * wire deliberately does not narrow either: `WireRunHistoryRow.status` is a plain string, because
 * refusing a status this vocabulary does not know would refuse a document this product itself
 * wrote. So the union is transcribed here, once, and {@link runStatusText} is total over it.
 *
 * **Its blind spot is stated rather than left to be found**: a ninth member added to `core`'s union
 * is not seen here, and what it renders is {@link unknownStatusText} — which NAMES it rather than
 * dropping the row, so the failure mode of the transcription is a sentence a reader can act on
 * rather than a silence. That is why the fall-through exists at all, and it is what makes a
 * transcribed list safe where a transcribed *count* would not be.
 *
 * **Two of the eight have never occurred in this repository's history** — `exhausted` and
 * `undecided`, against 141 `completed`, 16 `failed`, 9 `regressed`, 3 `aborted`, 1 `interrupted`
 * and 1 `running` across 171 runs. They are here because they are in the union, which is the whole
 * distinction: a register derived from `.quorum/runs` would have been a register of what this
 * machine happens to hold.
 */
export const RUN_STATUSES = [
  'running', 'completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted', 'undecided',
] as const;

/** One of {@link RUN_STATUSES}. */
export type RunStatusName = (typeof RUN_STATUSES)[number];

/**
 * What each status says, in sentences that describe what the MANIFEST RECORDS rather than what is
 * true now.
 *
 * The distinction is load-bearing for the first one: a run killed outright leaves `running` on disk
 * for ever, so *this run is under way* would be a claim the file cannot support. What the row says
 * beside it is the incomplete indication, which is the honest half.
 */
const STATUS_TEXT: Readonly<Record<RunStatusName, string>> = {
  running: 'The manifest records this run as still under way.',
  completed: 'The run reached the end of its flow and moved the ticket on.',
  failed: 'The run stopped on an error.',
  aborted: 'A gate was answered abort, and the run ended there.',
  regressed: 'A backward edge sent the ticket to an earlier stage, and the run ended there.',
  exhausted: 'A bounded loop spent its iterations, and the run ended there.',
  interrupted: 'The run was interrupted before it reached the end of its flow.',
  undecided: 'The run stopped at a gate for which no answer was available.',
};

/** A status this page's vocabulary does not hold — named, never dropped and never re-filed. */
export const unknownStatusText = (status: string): string =>
  `The manifest records the status ${JSON.stringify(status)}, which this page has no sentence for.`;

/**
 * The sentence for one recorded status, whatever it is.
 *
 * Total over {@link RUN_STATUSES} and over every other string, which is the property AC-10 asks
 * for: a status is a plain string on the wire and this is the one place that string becomes a
 * sentence.
 */
export function runStatusText(status: string): string {
  return (RUN_STATUSES as readonly string[]).includes(status)
    ? STATUS_TEXT[status as RunStatusName]
    : unknownStatusText(status);
}

/** The heading, so a test and the view cannot disagree about what this screen is. */
export const HISTORY_HEADING = 'Run history';

/** The action that loads the listing again — the only thing that ever repeats the read. */
export const HISTORY_REFRESH_LABEL = 'Refresh';

/** The Retry action offered wherever the request failed. */
export const HISTORY_RETRY_LABEL = 'Retry';

/** What the control on a row says, in each of its two positions. */
export const EXPAND_LABEL = 'Show what ran';
export const COLLAPSE_LABEL = 'Hide what ran';

/**
 * A store that answered and holds nothing — a sixth thing beside the five request states, and not
 * one of them.
 *
 * **It is the only state an adopter's first clone can produce.** `.quorum/` is gitignored, so a
 * fresh checkout has no runs at all and this is the first thing anybody ever sees on this screen;
 * `docs/04-architecture.md` forbids it being a blank panel, a spinner or a skeleton, so it says
 * what is there and what would put something there.
 */
export const EMPTY_HISTORY_TEXT =
  'The daemon found no runs under this project. Run history is written when a flow runs — start one from a ticket page, or run quorum run at a command line, and this table fills up.';

/**
 * A store that answered, holds runs, and could report **none** of them — which is not an empty one.
 *
 * The two answers arrive as the same `runs: []` and mean opposite things, and {@link
 * EMPTY_HISTORY_TEXT} said over this one would tell a reader that nothing has ever run here while
 * the region below names the runs that did. That is *"A probe that could not answer is not a
 * negative"* (2026-09-10) on a screen: the daemon found runs and could not read them, and reporting
 * that as absence sends somebody looking for a flow to start rather than at the reasons underneath.
 *
 * It does not say what to do, because the reasons do: each is one sentence in the daemon's own
 * words, and a remedy composed here would be this screen guessing which of them it was.
 */
export const NO_READABLE_RUNS_TEXT =
  'The daemon found runs under this project and could not report any of them. Every one is named below, with the reason it could not be read.';

/** What the region naming the runs the daemon could not read is called. */
export const UNREADABLE_HEADING = 'Runs the daemon could not read';

/**
 * One run the listing could not report, named rather than dropped.
 *
 * `failSoftly`'s distinction rendered: the daemon answered with the runs it could read and the
 * reasons for the rest, and a screen that showed only the first half would present a partial
 * listing as the whole store.
 */
export const unreadableRunText = (runId: string, message: string): string => `${runId}: ${message}`;

/**
 * A run whose manifest never reached a terminal state, said beside its recorded status.
 *
 * Not a relabelling of that status and not a reordering of the row: `isIncomplete` is `running` OR
 * no `ended_at`, so the two facts can disagree — a run killed outright records a terminal-looking
 * status and no end — and collapsing them would throw away the half that says so.
 */
export const INCOMPLETE_TEXT = 'This run never recorded an end, so what is here is as far as it got.';

/**
 * Where a run that is still going is actually watched, said as a sentence and never as a link.
 *
 * **There is no link to compose.** Mission control is addressed by a handle the daemon mints in
 * memory and a run directory is addressed by `<ticket id>-<run number>`; the two schemes do not
 * meet, and matching a row to a live run would mean a second request on every load and a join that
 * is wrong outright for a dry walk — which is allocated a run number, writes no history, and
 * reserves nothing, so the next real run of that ticket takes the same number.
 */
export const LIVE_RUN_TEXT =
  'A run the daemon is driving is watched in mission control, which is reached from the Runs listing rather than from here: the two address a run by unrelated names.';

/**
 * What this table does not carry, and where it is instead.
 *
 * **One entry rather than a register of everything the design brief asks for**, because it is the
 * one column of the brief's eight this screen genuinely cannot render: a listing row carries a
 * vendor's cost and how many of its steps were unpriced, and a token total lives on the run's own
 * detail. Carrying it in the listing would mean the manifest's roll-up rows as they sit on disk,
 * which measured 581 B a row against 369 B for this projection — so the honest arrangement is that
 * the figure appears when a reader opens the row that has it.
 */
export const HISTORY_DISCLOSURES = [
  "Per-vendor token totals are not in this table: they are read with the run's own detail, and appear when a row is opened.",
] as const;

/** What the opened region is called, and what the two halves of it are. */
export const OCCURRENCES_LABEL = 'What ran';
export const HISTORY_COST_LABEL = 'Cost per vendor';

/**
 * A run whose manifest records no occurrences at all.
 *
 * Distinguished from a read that is still out, which is a request state with a sentence of its own:
 * this is the answer having arrived and holding nothing.
 */
export const NO_OCCURRENCES_TEXT =
  'This run recorded no occurrences: nothing it did was an adapter call, a script or an integrate step.';

/**
 * An occurrence that was not an adapter call, said from the one field that establishes it.
 *
 * `adapter` is `null` for exactly the occurrences no vendor ran, and in this repository's own
 * history all 84 of them are `integrate` steps — this product has never produced a `script`
 * occurrence — so what is said is the KIND the manifest recorded rather than a guess at what it
 * would have retained. What it retained is a different ticket's subject and is not claimed here.
 */
export const notAnAdapterCallText = (kind: string): string =>
  `A ${kind} step, which no vendor ran.`;

/** An occurrence still going, which is not one that took no time. */
export const OCCURRENCE_RUNNING_TEXT = 'Still running; no duration has been recorded for it yet.';

/** An occurrence that is over and recorded no duration — an absence, never a zero. */
export const OCCURRENCE_NO_DURATION_TEXT = 'No duration was recorded for this step.';

/** A run whose manifest recorded no duration — the engine's figure, and never one invented here. */
export const NO_DURATION_TEXT = 'No duration was recorded.';

/**
 * A vendor that reported no price, said from a LISTING row — which is a weaker claim than the
 * detail's, and the difference is the whole reason this sentence exists.
 *
 * `mission-control-text.ts`'s `unpricedVendorText` renders a token total beside the absent price,
 * or says there was no token total either. A listing row carries neither: the token measures live
 * on the manifest's own roll-up rows and this projection narrows them away, at 369 B a row against
 * 581 B. So a table using that sentence would answer *n/a, which is not zero* about a measure it
 * had simply not asked for — a claim about the vendor made out of a gap in the response.
 */
export const LISTING_UNPRICED_TEXT =
  'reported no price for this run, which is unpriced rather than free; its token total is read with the run itself.';
