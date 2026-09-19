/**
 * Run history: every run on disk, and what one of them actually did.
 *
 * **One read on mount, and refresh is the only thing that repeats it.** The runs landing's own
 * mechanism, for the same reason: nothing on this screen polls, holds a copy or persists, and a
 * timer here would make a filesystem walk this app's hot path. A row opened for its detail is a
 * second read, issued by the reader's own act and by nothing else.
 *
 * **It is a screen over a DIRECTORY, and mission control is a screen over a SOCKET.** The design
 * brief ends screen 8 with *"Clicking opens the trace (reuse screen 5 in a 'completed' state)"*, and
 * that cannot be done: events are not persisted — `docs/GLOSSARY.md`'s **Event** entry says so in as
 * many words and `writer.ts` names none — so a finished run has no event stream to render, and
 * every column, lane and timeline on that screen is derived from accepted events. The two identity
 * schemes do not meet either: a handle is minted from a counter inside one daemon process and is
 * meaningless across a restart, while a history id is `<ticket id>-<run number>` and names a
 * directory. **So this screen composes no handle and links to no run.** What a finished run does
 * have is its manifest's occurrence array, which is what a row opens to.
 *
 * **Nothing here is a link at all**, which is the one place this screen is quieter than its
 * neighbours: the runs landing makes every row an anchor to mission control, and the board makes
 * every card one to a ticket page. A history row has nowhere to go that this app can address. Since
 * Q-0137 a retained file is a **button** rather than an anchor, for the same reason one layer down:
 * a file under `.quorum/runs` has no URL a browser could follow, and what opens it is a request this
 * app makes.
 *
 * **What an occurrence retained is named, measured and openable — one file at a time.** A row that
 * opens issues one retained-file listing beside the detail it already reads, and nothing is fetched
 * for an occurrence as it renders: a name and a byte count come with the listing, and a file's text
 * only when a reader chooses that name with its size in front of them. That is what stands in for a
 * cap, which this screen has none of — one occurrence retains up to 355,744 B and one run up to
 * 3,514,617 B across this repository's own history.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  OUTPUT_FILE, PROMPT_FILE,
  type WireRunHistory, type WireRunHistoryList, type WireRunHistoryOccurrence,
  type WireRunHistoryRetained, type WireRunHistoryRetainedFile, type WireRunHistoryRetainedText,
  type WireVendorRollup,
} from '@quorum/shared';

import {
  browserFetch, fetchRunHistory, fetchRunHistoryFile, fetchRunHistoryList, fetchRunHistoryRetained,
  isoClock, runHistoryFileInFlight, runHistoryInFlight, runHistoryListInFlight,
  runHistoryRetainedInFlight, type Clock, type FetchLike,
} from './daemon-client.js';
import {
  CLOSE_FILE_LABEL, COLLAPSE_LABEL, EMPTY_FILE_TEXT, EXPAND_LABEL, EMPTY_HISTORY_TEXT,
  HISTORY_COST_LABEL, HISTORY_DISCLOSURES,
  HISTORY_HEADING, HISTORY_REFRESH_LABEL, HISTORY_RETRY_LABEL, INCOMPLETE_TEXT, LISTING_UNPRICED_TEXT,
  LIVE_RUN_TEXT, NO_DURATION_TEXT, NO_OCCURRENCES_TEXT, NO_OUTPUT_RUNNING_TEXT,
  NO_OUTPUT_TERMINAL_TEXT, NO_READABLE_RUNS_TEXT, NO_RETAINED_FILES_TEXT, OCCURRENCES_LABEL,
  OCCURRENCE_NO_DURATION_TEXT, OCCURRENCE_RUNNING_TEXT, OPEN_FILE_LABEL, RETAINED_LABEL,
  RETAINED_UNLISTED_TEXT, UNREADABLE_HEADING, noPromptText, notAnAdapterCallText,
  occurrenceStatusText, retainedSizeText, retainedWarningText, runStatusText, unreadableRunText,
} from './history-text.js';
import { formatCost, formatElapsed, vendorCostRows } from './mission-control-measures.js';
import { NO_ROLLUP_ROWS_TEXT, unpricedStepsText, unpricedVendorText } from './mission-control-text.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';

/** Injectable inputs: the browser supplies none of them, and every test supplies all of them. */
export interface HistoryScreenProps {
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
}

/** The state of one request, as a sentence, its remedy, and the action that re-runs it. */
function RequestRegion({ state, onRetry }: { state: RequestState<unknown>; onRetry: () => void }): ReactNode {
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-request-state={state.kind}>{requestStateText(state)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {canRetryRequest(state) ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-border px-2 py-1 text-text hover:text-accent"
        >
          {HISTORY_RETRY_LABEL}
        </button>
      ) : null}
    </div>
  );
}

/**
 * One listing row's vendors, from that row's own roll-up and from nothing else.
 *
 * **Deliberately not `vendorCostRows`**, which is the detail's projection and reads the per-vendor
 * token totals a listing row does not carry. Reusing it here would render *n/a, which is not zero*
 * about a total this response never asked for, which is a claim made out of a gap. The rules that
 * ARE shared are shared: the price is formatted by `formatCost`, an absent one is never a zero, an
 * unpriced count says how much of the figure it cannot see, and no number here is summed across
 * vendors.
 */
function ListingVendors({ rollup }: { rollup: readonly WireVendorRollup[] }): ReactNode {
  if (rollup.length === 0) return <p className="text-xs text-muted">{NO_ROLLUP_ROWS_TEXT}</p>;
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {rollup.map((row) => (
        <li key={row.vendor} className="flex flex-wrap items-baseline gap-2" data-vendor-row={row.vendor}>
          {/* The exact `usage.vendor` string, rendered verbatim: a badge whose colour came from a
              list of known vendors would be this app knowing an adapter by name, which is what the
              product-agnostic rule forbids and what makes a third adapter appear here for free. */}
          <span className="rounded border border-border px-1 font-mono text-text">{row.vendor}</span>
          {row.cost_usd === null
            ? <span className="text-muted">{LISTING_UNPRICED_TEXT}</span>
            : <span className="font-mono text-text">{formatCost(row.cost_usd)}</span>}
          {row.unpriced_steps > 0 ? <span className="text-muted">{unpricedStepsText(row.unpriced_steps)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * What one occurrence's retained files have come to, from the one listing read its row issued.
 *
 * Four members, because the listing and the detail are two reads of one manifest at two moments and
 * their disagreement is a state rather than an impossibility: `unlisted` is the occurrence the
 * detail named and the listing did not. This store grows under a reader in ordinary operation, so
 * that case is reachable rather than staged, and rendering nothing for it would show a real
 * occurrence as one that retained nothing.
 */
type RetainedView =
  | { readonly kind: 'files'; readonly files: readonly WireRunHistoryRetainedFile[] }
  | { readonly kind: 'warned'; readonly message: string }
  | { readonly kind: 'unlisted' }
  | { readonly kind: 'pending'; readonly state: RequestState<WireRunHistoryRetained> };

/** Which of the four one occurrence is in, keyed on `seq` and never on the array's own order. */
function retainedFor(state: RequestState<WireRunHistoryRetained>, seq: number): RetainedView {
  if (state.kind !== 'loaded') return { kind: 'pending', state };
  const listed = state.value.occurrences.find((entry) => entry.seq === seq);
  if (listed !== undefined) return { kind: 'files', files: listed.files };
  const warned = state.value.warnings.find((entry) => entry.seq === seq);
  return warned === undefined ? { kind: 'unlisted' } : { kind: 'warned', message: warned.message };
}

/** One retained file this app has open, and which occurrence of which run it belongs to. */
interface OpenedFile {
  readonly seq: number;
  readonly name: string;
  readonly state: RequestState<WireRunHistoryRetainedText>;
}

/**
 * One retained file's text, once a reader has chosen it.
 *
 * **Four states and none of them a blank**: in flight, failed, loaded-and-empty, and loaded with
 * text. The third is a real answer rather than a request still out — eight of the files
 * this repository's run history retains are empty and every one is an `output.txt` — so rendering
 * an empty region for it would be indistinguishable from the first.
 *
 * The size is the one the daemon reports for what it **read**, never the one the listing carried:
 * the two are separate moments and a file can change between them.
 */
function OpenedFileText({ state, onRetry }: { state: RequestState<WireRunHistoryRetainedText>; onRetry: () => void }): ReactNode {
  if (state.kind !== 'loaded') return <div className="mt-1"><RequestRegion state={state} onRetry={onRetry} /></div>;
  const { name, bytes, text } = state.value;
  return (
    <div className="mt-1 flex flex-col gap-1" data-retained-open={name}>
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <span className="font-mono text-text">{name}</span>
        <span className="text-muted">{retainedSizeText(bytes)}</span>
      </div>
      {text === ''
        ? <p className="text-xs text-muted" data-retained-empty={name}>{EMPTY_FILE_TEXT}</p>
        : (
          <pre
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-bg p-2 font-mono text-xs text-text"
            data-retained-text={name}
          >
            {text}
          </pre>
        )}
    </div>
  );
}

/**
 * What one occurrence retained: every file named and measured, and one of them open.
 *
 * **The two absence sentences are keyed on the occurrence's `kind` and on its `status`, never on its
 * step id.** A prompt exists exactly where the kind is `adapter` — the 85 occurrences here with none
 * carry three different step ids, so the obvious spelling is wrong about 12 of them — and a missing
 * output is two different facts, a step that has not finished against one that is over and retained
 * none, only the first of which is going to change.
 *
 * `PROMPT_FILE` and `OUTPUT_FILE` are `@quorum/shared`'s constants rather than literals, and they
 * decide only what those two sentences say: the list itself is the occurrence directory's own
 * contents, so a third retained name is named and opens with nothing here moving.
 */
function RetainedFiles({ step, files, open, onToggle, onRetry }: {
  step: WireRunHistoryOccurrence;
  files: readonly WireRunHistoryRetainedFile[];
  open: OpenedFile | null;
  onToggle: (seq: number, name: string) => void;
  onRetry: (seq: number, name: string) => void;
}): ReactNode {
  const holds = (name: string): boolean => files.some((file) => file.name === name);
  return (
    <div className="flex flex-col gap-1">
      {files.length === 0
        ? <p className="text-xs text-muted" data-retained-none={step.seq}>{NO_RETAINED_FILES_TEXT}</p>
        : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li key={file.name} className="flex flex-wrap items-baseline gap-2 text-xs" data-retained-file={file.name}>
                <button
                  type="button"
                  onClick={() => { onToggle(step.seq, file.name); }}
                  className="rounded border border-border px-2 py-0.5 text-text hover:text-accent"
                >
                  {open?.seq === step.seq && open.name === file.name ? CLOSE_FILE_LABEL : OPEN_FILE_LABEL}
                </button>
                <span className="font-mono text-text">{file.name}</span>
                <span className="text-muted">{retainedSizeText(file.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      {holds(PROMPT_FILE) ? null
        : <p className="text-xs text-muted" data-no-prompt={step.seq}>{noPromptText(step.kind)}</p>}
      {holds(OUTPUT_FILE) ? null : (
        <p className="text-xs text-muted" data-no-output={step.seq}>
          {step.status === 'running' ? NO_OUTPUT_RUNNING_TEXT : NO_OUTPUT_TERMINAL_TEXT}
        </p>
      )}
      {open?.seq !== step.seq ? null
        : <OpenedFileText state={open.state} onRetry={() => { onRetry(step.seq, open.name); }} />}
    </div>
  );
}

/**
 * One occurrence, in the order `seq` gives rather than the order the array happens to be in.
 *
 * **A running occurrence says it is running rather than showing no duration**, which are two
 * different facts: `duration_ms` is `null` both for a step still going and for one that ended
 * without recording a figure, and only the first of them is going to change.
 *
 * **What it retained is named, measured and openable since Q-0137.** An occurrence the listing could
 * not name files for says so in the daemon's own words rather than appearing to have retained
 * nothing, which is the difference between *the daemon looked and there is nothing* and *the daemon
 * could not look*.
 */
function Occurrence({ step, retained, open, onToggleFile, onRetryFile }: {
  step: WireRunHistoryOccurrence;
  retained: RetainedView;
  open: OpenedFile | null;
  onToggleFile: (seq: number, name: string) => void;
  onRetryFile: (seq: number, name: string) => void;
}): ReactNode {
  const running = step.status === 'running';
  return (
    <li className="flex flex-col gap-1 border-t border-border py-1" data-occurrence={step.step_id}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs text-muted">{step.seq}</span>
        <span className="font-mono text-sm text-text">{step.step_id}</span>
        <span className="font-mono text-xs text-muted">{step.kind}</span>
        <span className="text-xs text-muted">{occurrenceStatusText(step.status)}</span>
        {step.adapter === null
          ? <span className="text-xs text-muted">{notAnAdapterCallText(step.kind)}</span>
          : <span className="font-mono text-xs text-text">{step.adapter}</span>}
        {step.duration_ms !== null
          ? <span className="font-mono text-xs text-text">{formatElapsed(step.duration_ms)}</span>
          : <span className="text-xs text-muted">{running ? OCCURRENCE_RUNNING_TEXT : OCCURRENCE_NO_DURATION_TEXT}</span>}
      </div>
      {/* Nothing at all while the listing read is out: what that read has come to is one region
          above this list rather than one per occurrence, because fifty-five identical sentences
          each offering the same Retry is an answer rendered fifty-five times. What IS per
          occurrence is what the listing said about it, which differs per occurrence. */}
      {retained.kind === 'pending' ? null : (
        <div className="flex flex-col gap-1 pl-3" data-retained={step.seq}>
          <span className="text-xs text-muted">{RETAINED_LABEL}</span>
          {retained.kind === 'warned'
            ? <p className="text-xs text-muted" data-retained-warning={step.seq}>{retainedWarningText(retained.message)}</p>
            : null}
          {retained.kind === 'unlisted'
            ? <p className="text-xs text-muted" data-retained-unlisted={step.seq}>{RETAINED_UNLISTED_TEXT}</p>
            : null}
          {retained.kind === 'files' ? (
            <RetainedFiles
              step={step}
              files={retained.files}
              open={open}
              onToggle={onToggleFile}
              onRetry={onRetryFile}
            />
          ) : null}
        </div>
      )}
    </li>
  );
}

/**
 * What one run did, once a reader has opened its row.
 *
 * The occurrences in `seq` order and the per-vendor split, which is the brief's *"one row expanded
 * inline showing its step timeline and per-vendor cost split"*. This half DOES read
 * `vendorCostRows`, because it holds the detail the listing does not: a vendor that reported no
 * price renders its token total here, which is the figure the disclosure above the table points at.
 */
function OpenedRun({ history, retained, open, onToggleFile, onRetryFile, onRetryListing }: {
  history: WireRunHistory;
  retained: RequestState<WireRunHistoryRetained>;
  open: OpenedFile | null;
  onToggleFile: (seq: number, name: string) => void;
  onRetryFile: (seq: number, name: string) => void;
  onRetryListing: () => void;
}): ReactNode {
  // A copy before sorting: the response's array is read-only by contract and `sort` mutates.
  const ordered = [...history.steps].sort((a, b) => a.seq - b.seq);
  const vendors = vendorCostRows(history);
  return (
    <div className="mt-2 flex flex-col gap-3 border-l-2 border-border pl-3" data-opened-run>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">{OCCURRENCES_LABEL}</span>
        {/* The retained listing's own state, said once. It is a second read of a second route and
            can fail on its own, so a row whose detail arrived and whose retained listing did not
            says which of the two is missing rather than rendering occurrences that appear to have
            retained nothing. */}
        {retained.kind === 'loaded' ? null
          : <div data-retained-request><RequestRegion state={retained} onRetry={onRetryListing} /></div>}
        {ordered.length === 0
          ? <p className="text-xs text-muted">{NO_OCCURRENCES_TEXT}</p>
          : (
            // Keyed by position rather than by `seq`: `occurrenceSeq` answers `MAX_SAFE_INTEGER`
            // for a directory name it cannot read, so two unreadable ones would share a key. The
            // retained listing is matched on `seq` all the same, and a number two occurrences share
            // is exactly what the daemon refuses to make addressable — so a collision reaches this
            // screen as two warnings rather than as one file served under the wrong step.
            <ul className="flex flex-col">
              {ordered.map((step, index) => (
                <Occurrence
                  key={index}
                  step={step}
                  retained={retainedFor(retained, step.seq)}
                  open={open}
                  onToggleFile={onToggleFile}
                  onRetryFile={onRetryFile}
                />
              ))}
            </ul>
          )}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <span className="text-muted">{HISTORY_COST_LABEL}</span>
        {vendors.length === 0 ? <p className="text-muted">{NO_ROLLUP_ROWS_TEXT}</p> : (
          <ul className="flex flex-col gap-1">
            {vendors.map((row) => (
              <li key={row.vendor} className="flex flex-wrap items-baseline gap-2" data-vendor-row={row.vendor}>
                <span className="font-mono text-text">{row.vendor}</span>
                {row.cost === null
                  ? <span className="text-muted">{unpricedVendorText(row.tokens)}</span>
                  : <span className="font-mono text-text">{row.cost}</span>}
                {row.unpricedSteps > 0 ? <span className="text-muted">{unpricedStepsText(row.unpricedSteps)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Which run is open, and what the two reads opening it issued have come to. `null` when none is.
 *
 * **Two reads and one row**, because they answer two questions of two routes: the detail is the
 * manifest's own account of what executed, and the retained listing is the directories those
 * occurrences left behind. They land independently — a row is useful with either — and neither
 * waits for the other.
 */
interface Opened {
  readonly id: string;
  readonly state: RequestState<WireRunHistory>;
  readonly retained: RequestState<WireRunHistoryRetained>;
}

/**
 * The run-history screen.
 *
 * One listing read on mount and on Refresh; one detail read per row a reader opens, at most one row
 * open at a time. Collapsing discards the read rather than holding it — the bytes are cheap to ask
 * for again and a cache here would be this app holding a copy of a directory it cannot keep
 * current, which is the rule every other screen in it is under.
 */
export function HistoryScreen({ fetcher, now }: HistoryScreenProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [listing, setListing] = useState<RequestState<WireRunHistoryList>>(runHistoryListInFlight());
  const [opened, setOpened] = useState<Opened | null>(null);
  const [file, setFile] = useState<OpenedFile | null>(null);

  // One counter for every load this screen starts, whoever starts it — the mount, Refresh, or a row
  // being opened. A superseded request's answer is dropped rather than landing on top of a newer
  // one, and an unmount bumps the same counter so a late answer never reaches a screen that is gone.
  // **Discarding a read is an act that spends a number too**, which is what collapsing a row does:
  // see `toggle` below, where not spending one let a detail already out reopen a row after the
  // reader had closed it.
  const generation = useRef(0);

  /**
   * And one counter per read a row issues, rather than one shared by all four.
   *
   * **The lifecycles are genuinely different and one counter made them cancel each other**: a row
   * opens two reads that land separately, either of which may be retried on its own, and a file a
   * reader chooses must invalidate neither. Sharing a number would mean a Retry on the retained
   * listing throwing away a detail answer that was still on its way — a request the reader made,
   * discarded by the next request they made.
   *
   * Which row is open is not one of these: every landing callback also checks that `opened` is
   * still the run it was issued for, so a row that was closed or replaced drops its own answers
   * without a number being spent on them.
   */
  const detailGeneration = useRef(0);
  const retainedGeneration = useRef(0);
  const fileGeneration = useRef(0);

  /** Forget the file a reader had open, and refuse the answer to it if one is still on its way. */
  const discardFile = useCallback(() => {
    // **The read is discarded rather than merely hidden**, which is `toggle`'s own lesson at a
    // second subject: a request already out carries the number it was issued under, so dropping the
    // selection without spending that number leaves its answer able to land afterwards and reopen a
    // file the reader has just closed.
    fileGeneration.current += 1;
    setFile(null);
  }, []);

  const load = useCallback(() => {
    const mine = (generation.current += 1);
    setListing(runHistoryListInFlight());
    // The open row is closed with the listing it was opened from: a refresh may report that run
    // differently, and a detail rendered under a row that has moved would be one run's occurrences
    // shown beside another run's figures.
    setOpened(null);
    discardFile();
    void (async () => {
      const result = await fetchRunHistoryList(request, clock);
      if (generation.current === mine) setListing(result);
    })();
  }, [request, clock, discardFile]);

  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
      detailGeneration.current += 1;
      retainedGeneration.current += 1;
      fileGeneration.current += 1;
    };
  }, [load]);

  /**
   * Read one run's detail, whoever asked for it — a row being opened, or a Retry after one failed.
   *
   * **Reached directly rather than through {@link toggle}**: a Retry is offered on a row that is
   * already open, so a Retry routed through the toggle takes its collapse branch and issues no
   * request at all — a control naming a remedy and performing none.
   */
  const openRun = useCallback((id: string) => {
    const detail = (detailGeneration.current += 1);
    const listing = (retainedGeneration.current += 1);
    setOpened({ id, state: runHistoryInFlight(id), retained: runHistoryRetainedInFlight(id) });
    // Any file the previous row had open goes with it: a name belongs to one occurrence of one run,
    // and carrying it across would render one run's bytes under another's step.
    discardFile();
    // **Two requests, issued together and landing separately.** Each writes only its own field, so a
    // row is useful the moment either answers — and neither is awaited by the other, which is what
    // keeps a slow directory walk from holding up the manifest a reader can already be shown.
    void (async () => {
      const result = await fetchRunHistory(request, id, clock);
      // Keyed on the generation AND on the id: a reader who opened a second row while the first was
      // out must not have the first one's answer land under the second one's heading.
      if (detailGeneration.current === detail) {
        setOpened((current) => (current?.id === id ? { ...current, state: result } : current));
      }
    })();
    void (async () => {
      const result = await fetchRunHistoryRetained(request, id, clock);
      if (retainedGeneration.current === listing) {
        setOpened((current) => (current?.id === id ? { ...current, retained: result } : current));
      }
    })();
  }, [request, clock, discardFile]);

  const toggle = useCallback((id: string) => {
    if (opened?.id === id) {
      // **The read is discarded rather than merely hidden.** A detail already out carries the
      // generation it was issued under, so closing a row without spending that number leaves its
      // answer able to land afterwards — and `setOpened` in that answer re-opens the row a reader
      // has just closed, under their hands and with nothing on screen having asked for it.
      generation.current += 1;
      setOpened(null);
      discardFile();
      return;
    }
    openRun(id);
  }, [opened, openRun, discardFile]);

  /**
   * Read one retained file, whoever asked for it — a reader choosing a name, or a Retry after one
   * failed.
   *
   * Reached directly rather than through {@link toggleFile}, on `openRun`'s precedent: a Retry is
   * offered on a file that is already open, so routing it through the toggle would take the close
   * branch and issue no request at all.
   */
  const openFile = useCallback((id: string, seq: number, name: string) => {
    const mine = (fileGeneration.current += 1);
    setFile({ seq, name, state: runHistoryFileInFlight(id, seq, name) });
    void (async () => {
      const result = await fetchRunHistoryFile(request, id, seq, name, clock);
      // A reader who chose a second file while the first was out gets the second's text, whichever
      // of the two the daemon answers first.
      if (fileGeneration.current === mine) setFile({ seq, name, state: result });
    })();
  }, [request, clock]);

  const toggleFile = useCallback((id: string, seq: number, name: string) => {
    if (file?.seq === seq && file.name === name) {
      discardFile();
      return;
    }
    openFile(id, seq, name);
  }, [file, openFile, discardFile]);

  /**
   * Read one run's detail again, and nothing else.
   *
   * **A retry repeats only the request that failed**, and that stopped being true of `openRun` the
   * moment a row began issuing two reads: a Retry offered under a failed DETAIL would re-issue the
   * retained listing as well, replacing an answer already on screen with an in-flight sentence and
   * spending a request nobody asked for. Q-0137 AC-11; the wiring was correct while `openRun` was
   * one request.
   */
  const openDetail = useCallback((id: string) => {
    const mine = (detailGeneration.current += 1);
    setOpened((current) => (current?.id === id ? { ...current, state: runHistoryInFlight(id) } : current));
    void (async () => {
      const result = await fetchRunHistory(request, id, clock);
      if (detailGeneration.current === mine) {
        setOpened((current) => (current?.id === id ? { ...current, state: result } : current));
      }
    })();
  }, [request, clock]);

  /** Read one run's retained listing again, and nothing else — {@link openDetail}'s other half. */
  const openRetained = useCallback((id: string) => {
    const mine = (retainedGeneration.current += 1);
    setOpened((current) => (current?.id === id ? { ...current, retained: runHistoryRetainedInFlight(id) } : current));
    void (async () => {
      const result = await fetchRunHistoryRetained(request, id, clock);
      if (retainedGeneration.current === mine) {
        setOpened((current) => (current?.id === id ? { ...current, retained: result } : current));
      }
    })();
  }, [request, clock]);

  const heading = (
    <div className="flex flex-wrap items-baseline gap-4">
      <h1 className="text-lg text-text">{HISTORY_HEADING}</h1>
      <RequestRegion state={listing} onRetry={load} />
      <button
        type="button"
        onClick={load}
        className="rounded border border-border px-2 py-1 text-sm text-text hover:text-accent"
      >
        {HISTORY_REFRESH_LABEL}
      </button>
    </div>
  );

  if (listing.kind !== 'loaded') return <section className="max-w-3xl">{heading}</section>;

  const { runs, warnings } = listing.value;

  return (
    <section>
      {heading}

      <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
        {HISTORY_DISCLOSURES.map((sentence) => <li key={sentence} data-history-disclosure>{sentence}</li>)}
      </ul>

      {runs.length === 0 ? (
        // **`runs: []` arrives for two opposite reasons and they are told apart here.** A store
        // nothing has written to is the adopter's first view and says what would put a run in it; a
        // store whose every run the daemon could not read is the same array with the region below
        // full of reasons, and the empty-store sentence over that one would report the runs that ARE
        // there as runs that are not.
        warnings.length === 0
          ? <p className="mt-4 max-w-2xl text-sm text-muted" data-history-empty>{EMPTY_HISTORY_TEXT}</p>
          : <p className="mt-4 max-w-2xl text-sm text-muted" data-history-none-readable>{NO_READABLE_RUNS_TEXT}</p>
      ) : (
        // The daemon's own order, which `sortRuns` decided — newest first, by the manifest's own
        // start. This screen declares no comparator: an order derived here would be one it invented.
        <ul className="mt-4 flex flex-col gap-2">
          {runs.map((run) => (
            <li key={run.id} className="rounded border border-border bg-surface p-3" data-history-row={run.id}>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-sm text-accent">{run.id}</span>
                <span className="font-mono text-xs text-muted">{run.ticket}</span>
                <span className="text-text">{run.flow}</span>
                <span className="font-mono text-xs text-muted">{run.started_at}</span>
                <span className="font-mono text-xs text-text">
                  {run.duration_ms === null ? NO_DURATION_TEXT : formatElapsed(run.duration_ms)}
                </span>
                <span className="font-mono text-xs text-muted">
                  {run.occurrenceCount} occurrence{run.occurrenceCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{runStatusText(run.status)}</p>
              {/* Beside the recorded status rather than instead of it, and linked nowhere: the two
                  facts can disagree, and where a run that is still going is watched is a sentence
                  because there is no address this screen could compose for it. */}
              {run.incomplete ? (
                <p className="mt-1 text-sm text-muted" data-run-incomplete={run.id}>
                  {INCOMPLETE_TEXT} {LIVE_RUN_TEXT}
                </p>
              ) : null}
              <div className="mt-2"><ListingVendors rollup={run.rollup} /></div>
              <button
                type="button"
                onClick={() => toggle(run.id)}
                className="mt-2 rounded border border-border px-2 py-1 text-xs text-text hover:text-accent"
              >
                {opened?.id === run.id ? COLLAPSE_LABEL : EXPAND_LABEL}
              </button>
              {opened?.id !== run.id ? null : opened.state.kind === 'loaded'
                ? (
                  <OpenedRun
                    history={opened.state.value}
                    retained={opened.retained}
                    open={file}
                    onToggleFile={(seq, name) => { toggleFile(run.id, seq, name); }}
                    onRetryFile={(seq, name) => { openFile(run.id, seq, name); }}
                    onRetryListing={() => { openRetained(run.id); }}
                  />
                )
                : <div className="mt-2"><RequestRegion state={opened.state} onRetry={() => openDetail(run.id)} /></div>}
            </li>
          ))}
        </ul>
      )}

      {warnings.length === 0 ? null : (
        // Named rather than dropped: the daemon answered with the runs it could read and the reasons
        // for the rest, and a screen rendering only the first half would present a partial listing as
        // the whole store.
        <div className="mt-6" data-history-warnings>
          <h2 className="text-sm text-text">{UNREADABLE_HEADING}</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {warnings.map((warning) => (
              <li key={warning.runId} data-history-warning={warning.runId}>
                {unreadableRunText(warning.runId, warning.message)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
