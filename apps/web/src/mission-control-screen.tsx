/**
 * Mission control: a run in flight, composed from what the socket and one metadata read carry.
 *
 * **It performs exactly one read of its own**, on mount and on an explicit retry: `GET /runs/:handle`,
 * the same route the gate screen reads, on the same terms — one call on mount, repeated only when a
 * reader asks again, nothing polls. The socket snapshot is supplied by the caller and is never read
 * twice: this screen composes {@link MissionControlStatus} and {@link MissionControlTrace} over it and
 * derives the observed-only step timeline from the same accepted events, so there is exactly one
 * account of what has happened on this run rather than two that could disagree.
 *
 * **A `no-such-run` connection state renders no trace columns**, per the frozen contract: that state
 * means the daemon has no run with this handle, so there is no run activity to partition and showing
 * columns built from whatever the socket happened to carry before closing would be presenting a
 * history for a run this daemon does not have.
 *
 * **The timeline renders only what {@link buildStepTimeline} could establish from the accepted
 * events.** No row is invented for a step nobody has heard from, and the label rendered under
 * `data-step-disposition` is the contracted sentence from `mission-control-text.ts` and nothing else,
 * so a reader and a test read the identical words.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireRun } from '@quorum/shared';

import {
  browserFetch, fetchRun, isoClock, runInFlight, type Clock, type FetchLike,
} from './daemon-client.js';
import { buildStepTimeline } from './mission-control-model.js';
import { MissionControlStatus } from './mission-control-status.js';
import { STEP_DISPOSITION_TEXT } from './mission-control-text.js';
import { MissionControlTrace } from './mission-control-trace.js';
import type { RequestState } from './request-state.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs supplied by the application shell and its one run connection. */
export interface MissionControlScreenProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly onRetryConnection: () => void;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** Compose the trace and status regions and render the observed-only step timeline. */
export function MissionControlScreen({
  handle, snapshot, onRetryConnection, fetcher, now, onNavigate,
}: MissionControlScreenProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [metadata, setMetadata] = useState<RequestState<WireRun>>(runInFlight<WireRun>(handle));

  // Guards a superseded read exactly as the gate screen's `generation` does: a handle change starts
  // a new read before the previous one may have resolved, and only the newest one may commit state.
  const generation = useRef(0);

  const readMetadata = useCallback(() => {
    const mine = (generation.current += 1);
    setMetadata(runInFlight<WireRun>(handle));
    void (async () => {
      const result = await fetchRun(request, handle, clock);
      if (generation.current === mine) setMetadata(result);
    })();
  }, [request, clock, handle]);

  useEffect(() => {
    readMetadata();
    return () => {
      generation.current += 1;
    };
  }, [readMetadata]);

  const timeline = buildStepTimeline(snapshot.events);

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg text-text">Mission control</h1>
      <MissionControlStatus
        handle={handle}
        snapshot={snapshot}
        metadata={metadata}
        onRetryConnection={onRetryConnection}
        onRetryMetadata={readMetadata}
        onNavigate={onNavigate}
      />
      {/* A no-such-run connection carries no run for a trace to belong to, per the frozen contract's
          Retention-and-disclosure section: "A no-such-run state creates no columns." */}
      {snapshot.state.kind === 'no-such-run' ? null : <MissionControlTrace events={snapshot.events} />}
      <ol className="flex flex-col gap-1 text-sm">
        {timeline.map((item) => (
          <li key={item.stepId} className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xs text-muted">{item.stepId}</span>
            <span className="text-text" data-step-disposition={item.disposition}>
              {STEP_DISPOSITION_TEXT[item.disposition]}
            </span>
            {item.doneMessage === null ? null : <span className="text-muted">{item.doneMessage}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
