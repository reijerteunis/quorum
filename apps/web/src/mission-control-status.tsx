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
import type { WireRun } from '@quorum/shared';
import type { ReactNode } from 'react';

import { canRetry, connectionStateText } from './connection-state.js';
import { MISSION_CONTROL_DISCLOSURES, browserDiscardedText, daemonMissedText } from './mission-control-text.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import { gatePath } from './routes.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs whose independent states the status regions must preserve. */
export interface MissionControlStatusProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly metadata: RequestState<WireRun>;
  readonly onRetryConnection: () => void;
  readonly onRetryMetadata: () => void;
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
  handle, snapshot, metadata, onRetryConnection, onRetryMetadata, onNavigate,
}: MissionControlStatusProps): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Header handle={handle} metadata={metadata} onNavigate={onNavigate} />
      <ConnectionRegion snapshot={snapshot} onRetry={onRetryConnection} />
      <MetadataRegion metadata={metadata} onRetry={onRetryMetadata} />
      <LossRegion snapshot={snapshot} />
      <ul className="flex flex-col gap-1 text-xs text-muted" data-mission-control-disclosures>
        {/* The first disclosure explains that the run has no number here yet and that the handle
            stands in for it. Where the metadata read supplies one, `data-run-identity` renders the
            number — so leaving the sentence would show the number and explain that there is none, on
            the screen whose whole discipline is saying only what it has. Retired conditionally
            rather than deleted, because the state it describes still happens: a read in flight, and
            one that failed. Review round 2, major 2; re-aimed at the metadata read by Q-0131. */}
        {MISSION_CONTROL_DISCLOSURES
          .filter((disclosure) => disclosure !== MISSION_CONTROL_DISCLOSURES[0] || loadedRunId(metadata) === null)
          .map((disclosure) => <li key={disclosure}>{disclosure}</li>)}
      </ul>
    </div>
  );
}
