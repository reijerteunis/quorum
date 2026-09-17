/**
 * The runs landing: every run the daemon is driving, in the order it reports them.
 *
 * **One read, on mount, and never a timer.** `GET /runs` is the daemon's own listing — what a
 * client can join, not what happened to a handle it already holds — and an interval here would
 * make listing runs a polling surface where every other screen in this app loads once and waits
 * for an explicit ask. Refresh is that ask, and it is the only thing that repeats the read.
 *
 * **Every row is one link, on the registered `/runs/:handle` pattern**, so a reader reaches mission
 * control from a handle they never had to type. Rows keep the daemon's own order: this screen sorts
 * nothing, because the daemon's ordering may itself be a fact (newest first) this page has no
 * business re-deriving.
 *
 * **A run naming no ticket is said so, never guessed or left blank.** `WireRun.ticketId` is `null`
 * when a start never resolved one, and {@link NO_TICKET_ID_TEXT} is the one sentence this app uses
 * for that, imported rather than restated so the ticket page's and this screen's wording cannot
 * drift apart.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireRun, WireRunList } from '@quorum/shared';

import { browserFetch, fetchRuns, isoClock, runsInFlight, type Clock, type FetchLike } from './daemon-client.js';
import { DAEMON_ENDPOINTS } from './daemon-endpoints.js';
import { EMPTY_RUNS_TEXT, NO_TICKET_ID_TEXT } from './mission-control-text.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import { runPath } from './routes.js';

/** The heading, so a test and the view cannot disagree about what this screen is. */
export const RUNS_HEADING = 'Runs';

/** The action that loads the listing again — the only thing that ever repeats the read. */
export const REFRESH_LABEL = 'Refresh';

/** The Retry action offered wherever the request failed. */
export const RETRY_LABEL = 'Retry';

/**
 * The listing's own in-flight state.
 *
 * `daemon-client.ts` holds one of these per existing read, keyed to that read's own path; this
 * screen is the first to read a listing rather than one ticket or one run, so there is no shared
 * helper for it there yet. Built the same way those are — the same path the fetch itself uses,
 * from {@link DAEMON_ENDPOINTS} and nowhere else — rather than a literal of its own.
 */

/** Injectable inputs: the browser supplies none of them, and every test supplies all of them. */
export interface RunsScreenProps {
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/**
 * One run's row: the whole of it is one link, on {@link runPath}'s registered pattern.
 *
 * Modelled on the board's own card: a plain `<a>` so a reader can open it in a new tab or middle-
 * click it, with the SPA navigation happening only on a plain left click.
 */
function Row({ run, onNavigate }: { run: WireRun; onNavigate: (to: string) => void }): ReactNode {
  const to = runPath(run.handle);
  return (
    <li>
      <a
        href={to}
        className="block rounded border border-border bg-surface p-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate(to);
        }}
      >
        <span className="block font-mono text-sm text-accent">{run.handle}</span>
        <span className="mt-1 block text-text">{run.flow}</span>
        <span className="mt-1 block font-mono text-xs text-muted">{run.state}</span>
        <span className="mt-1 block font-mono text-xs text-muted">
          {run.pendingGates} pending gate{run.pendingGates === 1 ? '' : 's'}
        </span>
        <span className="mt-1 block font-mono text-xs text-muted">
          {run.ticketId === null ? NO_TICKET_ID_TEXT : run.ticketId}
        </span>
      </a>
    </li>
  );
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
          {RETRY_LABEL}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The runs landing, at whatever the daemon last answered.
 *
 * One request, issued on mount and again only on an explicit Refresh — the board's own mechanism,
 * narrowed to a single read because this screen makes only one.
 */
export function RunsScreen({ fetcher, now, onNavigate }: RunsScreenProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [runs, setRuns] = useState<RequestState<WireRunList>>(runsInFlight());

  // One counter for every load this screen starts, whoever starts it — the mount or Refresh. A
  // superseded request's answer is dropped rather than landing on top of a newer one, and an
  // unmount bumps the same counter so a late answer never reaches a screen that is gone.
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = (generation.current += 1);
    setRuns(runsInFlight());
    void (async () => {
      const result = await fetchRuns(request, clock);
      if (generation.current === mine) setRuns(result);
    })();
  }, [request, clock]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  if (runs.kind !== 'loaded') {
    return (
      <section className="max-w-3xl">
        <h1 className="text-lg text-text">{RUNS_HEADING}</h1>
        <div className="mt-4">
          <RequestRegion state={runs} onRetry={load} />
        </div>
      </section>
    );
  }

  const rows = runs.value.runs;

  return (
    <section>
      <div className="flex items-baseline gap-4">
        <h1 className="text-lg text-text">{RUNS_HEADING}</h1>
        <RequestRegion state={runs} onRetry={load} />
        <button
          type="button"
          onClick={load}
          className="rounded border border-border px-2 py-1 text-sm text-text hover:text-accent"
        >
          {REFRESH_LABEL}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 max-w-2xl text-sm text-muted">{EMPTY_RUNS_TEXT}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((run) => <Row key={run.handle} run={run} onNavigate={onNavigate} />)}
        </ul>
      )}
    </section>
  );
}
