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
 *
 * **Since Q-0130 it can stop the run it is showing, and what decides whether it offers to is the
 * DAEMON's answer rather than this browser's socket.** The control is drawn from the metadata read's
 * own `state`: present while the daemon last reported the run `running`, absent for a refused start
 * and for a run that is over. `docs/GLOSSARY.md` says connection state *"is not run state"* in as
 * many words — a transport can drop, end or be interrupted without the run changing — so a screen
 * that hid the control when its socket failed would be withholding the one act a reader wants
 * precisely when they can no longer watch what is happening.
 *
 * **A stop is not a gate answer.** It cancels the run through the `AbortSignal` it was started with
 * and is none of the three words a gate takes, so nothing here is worded with one.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireRun } from '@quorum/shared';

import {
  browserFetch, fetchRun, isoClock, runInFlight, runStopInFlight, stopRun,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { buildStepTimeline } from './mission-control-model.js';
import { MissionControlStatus } from './mission-control-status.js';
import { STEP_DISPOSITION_TEXT } from './mission-control-text.js';
import { MissionControlTrace } from './mission-control-trace.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import type { RunConnectionSnapshot } from './run-connection.js';
import {
  CONFIRM_STOP_LABEL, LOOK_AGAIN_LABEL, STOP_DELIVERED, STOP_LABEL, STOP_REFUSAL_TEXT,
  WITHDRAW_LABEL, refusalSentence, stopConfirmation, useRunMutation, type RunMutation,
} from './run-lifecycle.js';

/** Inputs supplied by the application shell and its one run connection. */
export interface MissionControlScreenProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly onRetryConnection: () => void;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** What became of a stop this screen sent, in a sentence that claims only what was observed. */
function StopOutcome({ state, onLookAgain }: {
  state: RequestState<string>;
  onLookAgain: () => void;
}): ReactNode {
  if (state.kind === 'loaded') {
    // Delivered, which is the whole of what a 204 establishes. Not *the run has ended*: the daemon
    // aborts the signal and answers, and work already under way unwinds before a run closes.
    return <p className="text-sm text-muted" data-stop-outcome="loaded">{STOP_DELIVERED}</p>;
  }
  const said = state.kind === 'refused' ? refusalSentence(STOP_REFUSAL_TEXT, state.refusal.code) : null;
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex flex-col gap-1" data-stop-outcome={state.kind}>
      {said === null ? null : <p className="text-sm text-text">{said}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted" data-request-state={state.kind}>{requestStateText(state)}</span>
        {remedy === null ? null : <span className="text-muted">{remedy}</span>}
        {canRetryRequest(state) ? (
          // It reads the run again and re-sends nothing: `canRetryRequest` answers `true` for a
          // refusal, so a bare Retry beside a write would issue a second stop.
          <button type="button" onClick={onLookAgain} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
            {LOOK_AGAIN_LABEL}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The stop control, its confirmation, and what the daemon said about the last one.
 *
 * **Offered from `metadata` alone.** The snapshot this screen also holds is the browser's account of
 * a socket, and a socket that dropped says nothing about the run — so it is not a parameter here at
 * all, which makes *connection state does not decide this* a property of the signature rather than
 * of a branch nobody re-reads.
 */
function StopControl({ metadata, mutation, onAsk, onLookAgain }: {
  metadata: RequestState<WireRun>;
  mutation: RunMutation<string>;
  onAsk: () => void;
  onLookAgain: () => void;
}): ReactNode {
  const running = metadata.kind === 'loaded' && metadata.value.state === 'running';
  return (
    <div className="flex flex-col gap-2" data-stop-region={running ? 'running' : 'not-running'}>
      {running ? (
        <div>
          <button
            type="button"
            data-stop
            disabled={mutation.busy}
            onClick={onAsk}
            className="rounded border border-border px-3 py-1 text-sm text-text hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {STOP_LABEL}
          </button>
        </div>
      ) : null}
      {mutation.confirming === null ? null : (
        <div className="flex flex-col gap-2 rounded border border-accent p-2" data-confirm="stop">
          <p className="text-sm text-text">{mutation.confirming}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-confirm-stop
              onClick={mutation.confirm}
              className="rounded border border-accent px-3 py-1 text-sm text-accent hover:underline"
            >
              {CONFIRM_STOP_LABEL}
            </button>
            <button
              type="button"
              data-withdraw
              onClick={mutation.cancel}
              className="rounded border border-border px-3 py-1 text-sm text-muted hover:text-text"
            >
              {WITHDRAW_LABEL}
            </button>
          </div>
        </div>
      )}
      {/* Drawn whatever the run's state now says, because what the daemon did with a stop stays true
          while a later read moves on — and a run that ended between the request and the answer is
          exactly when a reader most needs the sentence. The mutation is keyed by the handle, so one
          run's outcome is never rendered under another's. */}
      {mutation.outcome === null ? null : <StopOutcome state={mutation.outcome} onLookAgain={onLookAgain} />}
    </div>
  );
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

  // The one act this screen performs on a run, under the guard `run-lifecycle.ts` owns. Its subject
  // is the handle, so a stop that resolves after a reader has moved to another run settles nothing
  // here — and `readMetadata` cannot release that guard, which is the whole of the correction
  // Q-0016's review round produced for the gate screen and the reason it is written once.
  const stop = useRunMutation<string>(handle);
  const { ask: askStop } = stop;

  const onAskStop = useCallback(() => {
    askStop({
      sentence: stopConfirmation(handle),
      inFlight: runStopInFlight<string>(handle),
      send: () => stopRun(request, handle, clock),
    });
  }, [askStop, request, clock, handle]);

  const timeline = buildStepTimeline(snapshot.events);

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      {/* MissionControlStatus's own Header already renders the "Mission control" title under
          data-mission-control-header — the frozen contract's "complete header region" — so this
          composition adds no second one. */}
      <MissionControlStatus
        handle={handle}
        snapshot={snapshot}
        metadata={metadata}
        onRetryConnection={onRetryConnection}
        onRetryMetadata={readMetadata}
        onNavigate={onNavigate}
      />
      <StopControl
        metadata={metadata}
        mutation={stop}
        onAsk={onAskStop}
        onLookAgain={readMetadata}
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
