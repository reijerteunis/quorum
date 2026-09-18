/**
 * Mission control's connection and metadata regions: state, identity, losses, disclosures and the
 * pending-gate link.
 *
 * **Two independent requests, two independent failure accounts.** The socket and the `GET
 * /runs/:handle` metadata read can fail on their own — a live socket beside an unreachable
 * metadata read, or the reverse — so each is rendered from its own state with its own retry, rather
 * than being folded into one region whose single failure sentence could name only one of them.
 *
 * **The run number is read from the loaded metadata, beside the flow and ticket already read
 * there.** It was read from the terminal event in the socket snapshot until Q-0131, and the reason
 * was never that metadata is the wrong home for a run's identity: it was that a running run's
 * `runId` there was `null` until the run ended, so reading it would have shown nothing a live run
 * could show. `core` now reports its number at run start, which removes that premise — and taking
 * the number from the same request that supplies `flow` and `ticketId` is what keeps the header's
 * identity one read rather than two. `04-architecture.md`'s rule is unchanged and is what the
 * handle still serves: a request that has not resolved, or one that failed, renders the handle
 * rather than a fabricated number.
 *
 * **Nothing here reads the socket for identity at all**, which is the property rather than a
 * consequence: a browser holding a `loaded` snapshot from before a run ended and a stream carrying
 * a terminal event are two accounts of one number, and a screen that preferred one would be
 * choosing between them.
 *
 * **Five disclosures render verbatim from `mission-control-text.ts` and nothing here approximates
 * one.** A parsed sentence is not a contract (ground rule 2): none of them is composed from
 * `done.message` or any other event's free text.
 */
import type { WireRun, WireRunHistory } from '@quorum/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { canRetry, connectionStateText } from './connection-state.js';
import type { Clock } from './daemon-client.js';
import {
  ELAPSED_TICK_MS, connectionReportsEnded, elapsedView, measuredView, vendorCostRows,
  type MeasuredAbsence,
} from './mission-control-measures.js';
import {
  COST_IN_FLIGHT_TEXT, COST_LABEL, ELAPSED_BROWSER_CLOCK_TEXT, ELAPSED_ENDED_UNMEASURED_TEXT,
  ELAPSED_ENGINE_TEXT, ELAPSED_LABEL, ELAPSED_UNREADABLE_START_TEXT, MEASURED_DRY_TEXT,
  MEASURED_NO_RUN_NUMBER_TEXT, MEASURED_NO_TICKET_TEXT, MISSION_CONTROL_DISCLOSURES,
  NO_ROLLUP_ROWS_TEXT, browserDiscardedText, daemonMissedText, unpricedStepsText, unpricedVendorText,
} from './mission-control-text.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import { gatePath } from './routes.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs whose independent states the status regions must preserve. */
export interface MissionControlStatusProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly metadata: RequestState<WireRun>;
  /**
   * The run the daemon last REPORTED, which is what the measured region is drawn from.
   *
   * Not `metadata`, and the difference is the one Q-0130's review loop priced four times: a refresh
   * replaces the request state the instant it starts, so a region reading it would announce that the
   * run's number is not known every time a reader asked for a fresher answer about it.
   */
  readonly reported: WireRun | null;
  /**
   * That run's history read, or `null` where no read was attempted at all.
   *
   * `null` is not a failure and is never rendered as one: it is what one of the three gates in
   * {@link measuredView} answers, each of which names its own reason.
   */
  readonly history: RequestState<WireRunHistory> | null;
  /** The clock a live elapsed figure is measured against — injected, never read ambiently. */
  readonly now: Clock;
  readonly onRetryConnection: () => void;
  readonly onRetryMetadata: () => void;
  readonly onRetryHistory: () => void;
  readonly onNavigate: (to: string) => void;
}

/**
 * The run's number, from the loaded metadata — the only place one may come from.
 *
 * `null` for every state that is not `loaded`, so a request in flight and one that failed both
 * fall back to the handle rather than to a number this screen does not have.
 */
function loadedRunId(metadata: RequestState<WireRun>): number | null {
  return metadata.kind === 'loaded' ? metadata.value.runId : null;
}

/** The connection region: state prose and its own retry, independent of the metadata read. */
function ConnectionRegion({ snapshot, onRetry }: {
  snapshot: RunConnectionSnapshot;
  onRetry: () => void;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-mission-control-state={snapshot.state.kind}>
        {connectionStateText(snapshot.state)}
      </span>
      {canRetry(snapshot.state) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** The metadata region: the `GET /runs/:handle` request state and its own retry. */
function MetadataRegion({ metadata, onRetry }: {
  metadata: RequestState<WireRun>;
  onRetry: () => void;
}): ReactNode {
  const remedy = requestStateRemedy(metadata);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-request-state={metadata.kind}>{requestStateText(metadata)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {canRetryRequest(metadata) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          Retry
        </button>
      ) : metadata.kind === 'loaded' ? (
        // A loaded read is not a final answer. `pendingGates` is a fact about the moment it was read
        // and this screen holds no socket for metadata (erratum E-2/GO-4), so a gate opened while it
        // is watching surfaces only when the reader asks again — and with no control here the only
        // exit was a page reload. Review round 1, M2.
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          Check again
        </button>
      ) : null}
    </div>
  );
}

/** The two loss counters, each rendered only where it is non-zero, from its own sentence. */
function LossRegion({ snapshot }: { snapshot: RunConnectionSnapshot }): ReactNode {
  const { missedCount, browserDiscardedCount } = snapshot;
  const daemonLoss = missedCount !== null && missedCount > 0 ? daemonMissedText(missedCount) : null;
  const browserLoss =
    browserDiscardedCount !== null && browserDiscardedCount > 0 ? browserDiscardedText(browserDiscardedCount) : null;
  if (daemonLoss === null && browserLoss === null) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      {daemonLoss === null ? null : <p>{daemonLoss}</p>}
      {browserLoss === null ? null : <p>{browserLoss}</p>}
    </div>
  );
}

/** The sentence each no-read reason renders, so a reader is told which of them applies. */
const ABSENCE_TEXT: Record<Exclude<MeasuredAbsence['kind'], 'not-read'>, string> = {
  dry: MEASURED_DRY_TEXT,
  'no-run-number': MEASURED_NO_RUN_NUMBER_TEXT,
  'no-ticket-id': MEASURED_NO_TICKET_TEXT,
};

/**
 * Why there are no measured values, in a sentence naming which of the four reasons it is.
 *
 * A read that did not come back with a history is rendered through the existing five-member request
 * vocabulary with its existing retry, so a 404 and a 422 are two sentences rather than one. The
 * other three are not failures at all and offer nothing to retry: no read was made, and asking again
 * would not change that.
 */
function MeasuredAbsenceRegion({ absence, onRetry }: {
  absence: MeasuredAbsence;
  onRetry: () => void;
}): ReactNode {
  if (absence.kind !== 'not-read') {
    return <p className="text-xs text-muted" data-measured-absence={absence.kind}>{ABSENCE_TEXT[absence.kind]}</p>;
  }
  const remedy = requestStateRemedy(absence.state);
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" data-measured-absence="not-read">
      <span className="text-muted" data-request-state={absence.state.kind}>{requestStateText(absence.state)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {canRetryRequest(absence.state) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * How long the run has been going — the one figure on this screen that moves on its own.
 *
 * **It advances from a value this browser is already holding and performs no read**, which is why
 * the frozen contract's *"Refresh is the only repeat read; no timer performs one"* is untouched by
 * it. The tick reads the injected clock and sets local state; nothing it reaches makes a request,
 * which is the property `apps/web/test/source.test.ts`'s narrowed timer clause holds.
 *
 * **The timer runs only while the figure is live, so it is gone the moment the run ends** — the
 * effect's dependency is that predicate, and its cleanup covers both the terminal transition and an
 * unmount. The clock is held in a ref so a caller passing an inline function cannot make the
 * interval tear down and rebuild on every render.
 */
function ElapsedRegion({ history, endedOnStream, now }: {
  history: WireRunHistory;
  endedOnStream: boolean;
  now: Clock;
}): ReactNode {
  const [at, setAt] = useState<string>(() => now());
  const clock = useRef(now);
  clock.current = now;
  const view = elapsedView(history, endedOnStream, at);
  const live = view.kind === 'running';

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => { setAt(clock.current()); }, ELAPSED_TICK_MS);
    return () => { clearInterval(timer); };
  }, [live]);

  const whose = view.kind === 'running' ? ELAPSED_BROWSER_CLOCK_TEXT : ELAPSED_ENGINE_TEXT;
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-xs" data-elapsed={view.kind}>
      <span className="text-muted">{ELAPSED_LABEL}</span>
      {view.kind === 'ended-unmeasured' ? <span className="text-muted">{ELAPSED_ENDED_UNMEASURED_TEXT}</span> : null}
      {view.kind === 'unreadable-start' ? <span className="text-muted">{ELAPSED_UNREADABLE_START_TEXT}</span> : null}
      {view.kind === 'running' || view.kind === 'ended' ? (
        <>
          <span className="font-mono text-text" data-elapsed-figure>{view.text}</span>
          <span className="text-muted">{whose}</span>
        </>
      ) : null}
    </div>
  );
}

/**
 * What the run has cost, one entry per vendor and never a figure across them.
 *
 * The rows are the roll-up's own, in its own order and filtered by nothing: `rollup()` emits them in
 * first-appearance order and includes a failed occurrence that was billed, failure being when the
 * number matters most. Nothing here branches on a vendor's name, so a third adapter's row appears
 * because the roll-up carries it.
 *
 * **A row is marked `data-vendor-row` and not `data-vendor-cost`**, because the second ends in the
 * money field followed by an equals sign — one of the six parse needles
 * `apps/web/test/source.test.ts` forbids anywhere under `src`. An attribute is not a parse, and a
 * needle that had to tell the two apart is a needle with exceptions, which is what that scan
 * refused everywhere except the one measured accessibility collision. Renaming is the cheaper half.
 */
function CostRegion({ history }: { history: WireRunHistory }): ReactNode {
  const rows = vendorCostRows(history);
  return (
    <div className="flex flex-col gap-1 text-xs" data-vendor-costs>
      <span className="text-muted">{COST_LABEL}</span>
      {rows.length === 0 ? <p className="text-muted">{NO_ROLLUP_ROWS_TEXT}</p> : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
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
      {/* Rendered beside the figures rather than instead of them: a run in flight has real numbers
          and they are behind, which is a different claim from having none. The two loss disclosures
          stay in their own region and are not folded into this one — they are about the event
          stream, and this is about what has been billed. */}
      {history.incomplete ? <p className="text-muted" data-cost-incomplete>{COST_IN_FLIGHT_TEXT}</p> : null}
    </div>
  );
}

/**
 * The measured values, in a region of their own beside the header rather than inside it.
 *
 * **That siting is load-bearing rather than a layout choice.** `mission-control-status.test.ts`
 * asserts that `[data-mission-control-header]` renders no `—`, `$`, `0:00` or `n/a`, which is what
 * proves the identity line fabricates nothing — and a cost figure, an `n/a` and a clamped `00:00`
 * all trip it. The design brief's word *header* names the top area of the screen;
 * `data-mission-control-header` names one region within it, and the two are not the same thing, so
 * a sixth sibling region is what every other class of fact on this screen already is.
 */
function MeasuredRegion({ reported, history, snapshot, now, onRetry }: {
  reported: WireRun | null;
  history: RequestState<WireRunHistory> | null;
  snapshot: RunConnectionSnapshot;
  now: Clock;
  onRetry: () => void;
}): ReactNode {
  const measured = measuredView(reported, history);
  return (
    <div className="flex flex-col gap-2" data-mission-control-measures>
      {measured.kind === 'absent'
        ? <MeasuredAbsenceRegion absence={measured.absence} onRetry={onRetry} />
        : (
          <>
            <ElapsedRegion
              history={measured.history}
              endedOnStream={connectionReportsEnded(snapshot)}
              now={now}
            />
            <CostRegion history={measured.history} />
          </>
        )}
    </div>
  );
}

/**
 * The header: title, run identity, the loaded run's flow and ticket, and the pending-gate link.
 *
 * The gate link derives from `metadata`'s own `pendingGates` count and never from a streamed gate
 * event, so it is present exactly when the loaded run reports one — including a late joiner whose
 * socket replay carries no `gate` event at all.
 *
 * **It takes no snapshot, and that is the property rather than a tidy-up.** Every value it renders
 * comes from the one metadata read; a parameter carrying the event stream is what a later change
 * would reach for to recover a number from a terminal event, which is the second authority Q-0131
 * removed.
 */
function Header({ handle, metadata, onNavigate }: {
  handle: string;
  metadata: RequestState<WireRun>;
  onNavigate: (to: string) => void;
}): ReactNode {
  const runId = loadedRunId(metadata);
  const to = gatePath(handle);
  const showGateLink = metadata.kind === 'loaded' && metadata.value.pendingGates > 0;

  return (
    <div className="flex flex-wrap items-baseline gap-4" data-mission-control-header>
      <h1 className="text-lg text-text">Mission control</h1>
      <p className="font-mono text-xs text-muted" data-run-identity>
        {runId === null ? `Run ${handle}` : `Run ${String(runId)}`}
      </p>
      {metadata.kind === 'loaded' ? (
        <p className="font-mono text-xs text-muted">
          {metadata.value.flow}
          {metadata.value.ticketId === null ? null : <> · {metadata.value.ticketId}</>}
          {/* The daemon's own account of the run, which this screen read and then dropped. It is not
              the connection state — that describes this browser's transport and can change without
              changing the run — and `refusal` is the field Q-0016 added precisely so a surface would
              stop admitting a gap with the daemon's words one field away. Review round 2, major 3. */}
          <> · {metadata.value.state}</>
          {metadata.value.refusal === null ? null : <> · {metadata.value.refusal.condition}</>}
        </p>
      ) : null}
      {showGateLink ? (
        <a
          href={to}
          className="rounded border border-border px-2 py-1 text-sm text-accent hover:underline"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(to);
          }}
        >
          Answer the pending gate
        </a>
      ) : null}
    </div>
  );
}

/** Render only values carried by the socket snapshot or loaded metadata. */
export function MissionControlStatus({
  handle, snapshot, metadata, reported, history, now,
  onRetryConnection, onRetryMetadata, onRetryHistory, onNavigate,
}: MissionControlStatusProps): ReactNode {
  const measured = measuredView(reported, history);
  /**
   * Whether each disclosure's value is present, in the array's own order.
   *
   * **A register rather than a filter condition**, which is what Q-0131's one-off `!== [0]` could
   * not carry once two more sentences became conditional: a retirement is now a row, the two that
   * are still unconditional say so with their reason, and a disclosure that left the array would
   * shift this list rather than quietly keeping a sentence beside its own value. The array's length
   * is asserted at five, so a retirement is never a deletion.
   */
  const supplied: readonly boolean[] = [
    // [0] The run number, from the metadata read. A read in flight and one that failed supply none.
    loadedRunId(metadata) !== null,
    // [1] Elapsed time, which a loaded history supplies: `started_at` is required by the schema.
    measured.kind === 'measured',
    // [2] Per-vendor cost, which the same read supplies — INCLUDING an empty roll-up, that being an
    //     answer about what has been billed rather than a failure to answer.
    measured.kind === 'measured',
    // [3] What comes next: no route on this transport carries a flow step list.
    false,
    // [4] Structured tool calls and reasoning: neither event kind has a producer.
    false,
  ];
  return (
    <div className="flex flex-col gap-4">
      <Header handle={handle} metadata={metadata} onNavigate={onNavigate} />
      <ConnectionRegion snapshot={snapshot} onRetry={onRetryConnection} />
      <MetadataRegion metadata={metadata} onRetry={onRetryMetadata} />
      <MeasuredRegion
        reported={reported}
        history={history}
        snapshot={snapshot}
        now={now}
        onRetry={onRetryHistory}
      />
      <LossRegion snapshot={snapshot} />
      <ul className="flex flex-col gap-1 text-xs text-muted" data-mission-control-disclosures>
        {/* A disclosure stands until its own value is present, and is retired rather than deleted,
            because the state each describes still happens — a read in flight, and one that failed.
            Showing the value and the sentence saying there is none, on the screen whose whole
            discipline is saying only what it has, is what the register above prevents. Review round
            2, major 2; re-aimed at the metadata read by Q-0131 and widened to three by Q-0135. */}
        {MISSION_CONTROL_DISCLOSURES
          .filter((_, at) => supplied[at] !== true)
          .map((disclosure) => <li key={disclosure}>{disclosure}</li>)}
      </ul>
    </div>
  );
}
