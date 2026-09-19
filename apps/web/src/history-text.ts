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
  `${/^[aeiou]/i.test(kind) ? 'An' : 'A'} ${kind} step, which no vendor ran.`;

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

/**
 * The four statuses an occurrence can be GIVEN, measured from what assigns one rather than from
 * what this machine happens to hold.
 *
 * `terminalOccurrence` is called with the literals `completed` and `failed` at nine sites across
 * `packages/core/src/engine/composite.ts` and `steps.ts`; `finaliseActiveOccurrences` is typed
 * `'failed' | 'interrupted'`; and allocation writes `running`. The other four members of the union
 * — `aborted`, `regressed`, `exhausted`, `undecided` — are dispositions a RUN ends as, and no code
 * path gives one to a step.
 *
 * **Derived from the call sites and not from `.quorum/runs`**, which is why `interrupted` is here:
 * it has never been written to an occurrence in this repository's history, and it is reachable.
 */
export const OCCURRENCE_STATUSES = ['running', 'completed', 'failed', 'interrupted'] as const;

/** One of {@link OCCURRENCE_STATUSES}. */
export type OccurrenceStatusName = (typeof OCCURRENCE_STATUSES)[number];

/**
 * What each says about a STEP — which is a different subject from {@link STATUS_TEXT}'s run, and
 * the distinction this table exists for.
 *
 * Until Q-0018's gate the expansion rendered {@link runStatusText} against an occurrence's status,
 * so a step that finished said *"The run reached the end of its flow and moved the ticket on"* — a
 * claim about the run, repeated once per occurrence and carrying nothing. `failed` was worse than
 * redundant: seven occurrences in this repository's own history carry a status their run does not,
 * and `Q-0015-4` is a **completed** development run holding four **failed** integrate occurrences,
 * so that row rendered the run as having finished and, six lines below, as having stopped on an
 * error. Found by rendering the screen; missed by both cross-vendor review rounds, because the
 * guard AC-10 asks for is satisfied — `runStatusText` IS total over the run union. It was total
 * over the wrong subject.
 *
 * None of these sentences names the run, which is what the test asserts rather than the wording.
 */
const OCCURRENCE_TEXT: Readonly<Record<OccurrenceStatusName, string>> = {
  running: 'Still under way when the manifest was last written.',
  completed: 'This step finished and the run carried on past it.',
  failed: 'This step stopped on an error, which is not the same as the run stopping.',
  interrupted: 'This step was still open when the run was interrupted, and was closed with it.',
};

/**
 * A status a step was never given: named as the run disposition it is, rather than described as
 * something the step did.
 *
 * Inventing a sentence would be asserting a meaning nothing writes, and falling through to the run
 * vocabulary is the defect above. So it says what it found and where that word belongs.
 */
const runDispositionText = (status: string): string =>
  `The manifest records ${JSON.stringify(status)} for this step, which is a status a run ends as rather than one a step is given.`;

/**
 * The sentence for one occurrence's recorded status, whatever it is.
 *
 * Total over {@link OCCURRENCE_STATUSES}, over the four run-only dispositions, and over every other
 * string — an occurrence's `status` is a plain string on the wire for {@link runStatusText}'s
 * reason, and this is the one place it becomes a sentence about a step.
 */
export function occurrenceStatusText(status: string): string {
  if ((OCCURRENCE_STATUSES as readonly string[]).includes(status)) {
    return OCCURRENCE_TEXT[status as OccurrenceStatusName];
  }
  return (RUN_STATUSES as readonly string[]).includes(status)
    ? runDispositionText(status)
    : unknownStatusText(status);
}

/**
 * The three kinds of thing an occurrence can be, and the order `core` declares them in.
 *
 * `OccurrenceKind` is `packages/core`'s and this package may not import it, so the union is
 * transcribed here once — {@link RUN_STATUSES}'s arrangement, with its blind spot stated the same
 * way: a fourth member added to `core`'s union is not seen here, and what it renders is
 * {@link unknownKindText}, which NAMES it rather than falling through to a sentence written about
 * something else.
 *
 * **`script` has never occurred in this repository's history** — 856 `adapter` and 85 `integrate`
 * against 0 — and it is here because it is in the union, which is the distinction: a register
 * derived from `.quorum/runs` would be a register of what this machine happens to hold.
 */
export const OCCURRENCE_KINDS = ['adapter', 'script', 'integrate'] as const;

/** One of {@link OCCURRENCE_KINDS}. */
export type OccurrenceKindName = (typeof OCCURRENCE_KINDS)[number];

/**
 * Why an occurrence retained no prompt, said from its KIND and never from its step id.
 *
 * **A prompt exists exactly where the kind is `adapter`.** Measured over every manifest here, no
 * `prompt.txt` corresponds to `kind === 'integrate'` 85 times out of 85 — but those 85 carry
 * **three** different step ids, `integrate` 73, `prove-red` 9 and `merge-contracts` 3, so a sentence
 * keyed on the step id is wrong about 12 of them. That is this repository's most-recorded defect
 * class — a check keyed on a name rather than on the behaviour it is about — and the rule is stated
 * over the kind because `runScript` persists an output and no prompt, which no corpus here can
 * teach: `script` has zero instances.
 *
 * The `adapter` row is not an explanation but an admission: a vendor WAS asked, so a missing prompt
 * there is a gap rather than a step that was sent none.
 */
const NO_PROMPT_TEXT: Readonly<Record<OccurrenceKindName, string>> = {
  adapter: 'No prompt was retained for this adapter call, which is a gap rather than a step no vendor was asked for.',
  script: 'No prompt: a script step runs a command, so no vendor was asked.',
  integrate: 'No prompt: an integrate step merges and runs the suite, so no vendor was asked.',
};

/** A kind this page's vocabulary does not hold — named, never dropped and never re-filed. */
export const unknownKindText = (kind: string): string =>
  `No prompt was retained. The manifest records the kind ${JSON.stringify(kind)}, which this page has no sentence for.`;

/** The sentence for an occurrence that retained no prompt, whatever kind it records. */
export function noPromptText(kind: string): string {
  return (OCCURRENCE_KINDS as readonly string[]).includes(kind)
    ? NO_PROMPT_TEXT[kind as OccurrenceKindName]
    : unknownKindText(kind);
}

/**
 * An occurrence that retained no output because it has not finished — which is not a damaged record.
 *
 * `terminal()` writes an `output.txt` for every occurrence it closes, so a step still running is the
 * ordinary reason there is none, and it is going to change.
 */
export const NO_OUTPUT_RUNNING_TEXT =
  'No output yet: this step has not finished, so nothing has been written for it.';

/**
 * An occurrence that is over and retained no output — a different sentence, and a real state.
 *
 * The writer's guarantee sits behind an `fs.existsSync` that answers **true for a directory**, a
 * preserved defect pinned by its own suite, so a terminal occurrence with no readable output is
 * reachable rather than hypothetical. Collapsing it into {@link NO_OUTPUT_RUNNING_TEXT} would tell a
 * reader to wait for something that is never coming.
 */
export const NO_OUTPUT_TERMINAL_TEXT =
  'No output file was retained for this step, which is over.';

/** What the region naming an occurrence's retained files is called. */
export const RETAINED_LABEL = 'Retained';

/**
 * One retained file's size, beside its name — which is what stands in for a cap on this screen.
 *
 * Nothing is fetched until a reader chooses a name with this figure in front of them, so the
 * largest thing they can ask for is a number they have already seen. Bytes and never a rounded
 * unit: one occurrence's largest file here is 353,626 B, and a reader choosing between two files
 * is choosing on the difference rather than on the magnitude.
 */
export const retainedSizeText = (bytes: number): string => `${String(bytes)} byte${bytes === 1 ? '' : 's'}`;

/**
 * An occurrence whose directory is there and holds nothing.
 *
 * Distinguished from a warning, which is the daemon saying it could not look: this is the daemon
 * having looked. A run interrupted between allocating an occurrence and persisting its first
 * artifact leaves exactly this.
 */
export const NO_RETAINED_FILES_TEXT = 'This step retained no files.';

/**
 * An occurrence the retained listing named in neither half.
 *
 * Reachable because the two reads a row issues are two moments: the detail names the occurrences the
 * manifest held then, and the listing names the ones it held when it was read. A store that grows
 * under a reader is this store's ordinary condition rather than a staged race — it gained six files
 * while this ticket's own requirement was being measured — so the disagreement is a state rather
 * than an impossibility, and saying nothing here would render a real occurrence as one that retained
 * nothing.
 */
export const RETAINED_UNLISTED_TEXT =
  'The retained-file listing did not name this occurrence. Two reads of one manifest a moment apart can disagree; asking again is what resolves it.';

/** One occurrence the daemon could not name files for, in its own words. */
export const retainedWarningText = (message: string): string => message;

/** What the control on a retained file says, in each of its two positions. */
export const OPEN_FILE_LABEL = 'Open';
export const CLOSE_FILE_LABEL = 'Close';

/**
 * A retained file that is there and holds nothing — the daemon having read it, rather than a read
 * still out.
 *
 * Eight of the 1,797 files this repository's run history holds are empty and every one is an
 * `output.txt`, so it is the ordinary shape of a step that answered nothing rather than an edge
 * case. Rendering an empty region for it would be indistinguishable from a request still out.
 */
export const EMPTY_FILE_TEXT = 'This file is empty.';
