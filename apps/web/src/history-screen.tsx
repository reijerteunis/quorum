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
 * every card one to a ticket page. A history row has nowhere to go that this app can address.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireRunHistory, WireRunHistoryList, WireRunHistoryOccurrence, WireVendorRollup } from '@quorum/shared';

import {
  browserFetch, fetchRunHistory, fetchRunHistoryList, isoClock, runHistoryInFlight,
  runHistoryListInFlight, type Clock, type FetchLike,
} from './daemon-client.js';
import {
  COLLAPSE_LABEL, EXPAND_LABEL, EMPTY_HISTORY_TEXT, HISTORY_COST_LABEL, HISTORY_DISCLOSURES,
  HISTORY_HEADING, HISTORY_REFRESH_LABEL, HISTORY_RETRY_LABEL, INCOMPLETE_TEXT, LISTING_UNPRICED_TEXT,
  LIVE_RUN_TEXT, NO_DURATION_TEXT, NO_OCCURRENCES_TEXT, OCCURRENCES_LABEL, OCCURRENCE_NO_DURATION_TEXT,
  OCCURRENCE_RUNNING_TEXT, UNREADABLE_HEADING, notAnAdapterCallText, runStatusText, unreadableRunText,
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
 * One occurrence, in the order `seq` gives rather than the order the array happens to be in.
 *
 * **A running occurrence says it is running rather than showing no duration**, which are two
 * different facts: `duration_ms` is `null` both for a step still going and for one that ended
 * without recording a figure, and only the first of them is going to change.
 *
 * **What it retained is not named and not claimed.** An occurrence's `prompt.txt` and `output.txt`
 * are a successor's subject; what this says instead is the manifest's own `kind`, and where no
 * vendor ran it, that it was not an adapter call — which is a fact the `adapter` field establishes
 * rather than an inference about what is on disk.
 */
function Occurrence({ step }: { step: WireRunHistoryOccurrence }): ReactNode {
  const running = step.status === 'running';
  return (
    <li className="flex flex-wrap items-baseline gap-3 border-t border-border py-1" data-occurrence={step.step_id}>
      <span className="font-mono text-xs text-muted">{step.seq}</span>
      <span className="font-mono text-sm text-text">{step.step_id}</span>
      <span className="font-mono text-xs text-muted">{step.kind}</span>
      <span className="text-xs text-muted">{runStatusText(step.status)}</span>
      {step.adapter === null
        ? <span className="text-xs text-muted">{notAnAdapterCallText(step.kind)}</span>
        : <span className="font-mono text-xs text-text">{step.adapter}</span>}
      {step.duration_ms !== null
        ? <span className="font-mono text-xs text-text">{formatElapsed(step.duration_ms)}</span>
        : <span className="text-xs text-muted">{running ? OCCURRENCE_RUNNING_TEXT : OCCURRENCE_NO_DURATION_TEXT}</span>}
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
function OpenedRun({ history }: { history: WireRunHistory }): ReactNode {
  // A copy before sorting: the response's array is read-only by contract and `sort` mutates.
  const ordered = [...history.steps].sort((a, b) => a.seq - b.seq);
  const vendors = vendorCostRows(history);
  return (
    <div className="mt-2 flex flex-col gap-3 border-l-2 border-border pl-3" data-opened-run>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">{OCCURRENCES_LABEL}</span>
        {ordered.length === 0
          ? <p className="text-xs text-muted">{NO_OCCURRENCES_TEXT}</p>
          : (
            // Keyed by position rather than by `seq`: `occurrenceSeq` answers `MAX_SAFE_INTEGER`
            // for a directory name it cannot read, so two unreadable ones would share a key.
            <ul className="flex flex-col">
              {ordered.map((step, index) => <Occurrence key={index} step={step} />)}
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

/** Which run is open, and what its detail read has come to. `null` when none is. */
interface Opened {
  readonly id: string;
  readonly state: RequestState<WireRunHistory>;
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

  // One counter for every load this screen starts, whoever starts it — the mount, Refresh, or a row
  // being opened. A superseded request's answer is dropped rather than landing on top of a newer
  // one, and an unmount bumps the same counter so a late answer never reaches a screen that is gone.
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = (generation.current += 1);
    setListing(runHistoryListInFlight());
    // The open row is closed with the listing it was opened from: a refresh may report that run
    // differently, and a detail rendered under a row that has moved would be one run's occurrences
    // shown beside another run's figures.
    setOpened(null);
    void (async () => {
      const result = await fetchRunHistoryList(request, clock);
      if (generation.current === mine) setListing(result);
    })();
  }, [request, clock]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  const toggle = useCallback((id: string) => {
    if (opened?.id === id) { setOpened(null); return; }
    const mine = (generation.current += 1);
    setOpened({ id, state: runHistoryInFlight(id) });
    void (async () => {
      const result = await fetchRunHistory(request, id, clock);
      // Keyed on the generation AND on the id: a reader who opened a second row while the first was
      // out must not have the first one's answer land under the second one's heading.
      if (generation.current === mine) setOpened({ id, state: result });
    })();
  }, [opened, request, clock]);

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
        <p className="mt-4 max-w-2xl text-sm text-muted" data-history-empty>{EMPTY_HISTORY_TEXT}</p>
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
                ? <OpenedRun history={opened.state.value} />
                : <div className="mt-2"><RequestRegion state={opened.state} onRetry={() => toggle(run.id)} /></div>}
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
