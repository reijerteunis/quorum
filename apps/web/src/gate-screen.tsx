/**
 * The gate screen: what a run is waiting to be told, and the one answer this app sends.
 *
 * **It is the whole of what this app writes.** Every other screen reads; this one settles a promise
 * `core` is already parked on, and nothing else — no run is started, no run is stopped, no stage is
 * moved, no run lock is taken. `apps/web/test/source.test.ts` holds that boundary by naming the two
 * modules that may carry the method and the path, rather than by the absence that held it before.
 *
 * **The question comes from `GET /runs/:id` and not from the event stream.** The daemon already
 * holds the pending questions whole and derives them per request, so a browser opened at this URL
 * with no history behind it has everything it needs in one answer: a screen reading a replayed
 * buffer instead would have two states in which it cannot do its one job — a run reported as
 * waiting whose question the replay did not supply, and a replay it must disclose as incomplete and
 * cannot repair. Widening the wire removes those rather than mitigating them.
 *
 * **It holds no socket, and the cost of that is stated rather than smoothed over.** A gate asked
 * while this screen is open is not shown until the reader asks again, and what the run does next is
 * shown by reading again rather than live. Rendering a run's event stream is mission control's
 * subject (Q-0015), and coupling this screen to that controller before that ticket has decided how
 * it is held is a design no ticket has done.
 *
 * **Three answers at most, and fewer where the gate offers fewer.** `gateAnswerSchema` is the
 * closed three and the envelope is `.strict()` over it, so there is no fourth control and no reason
 * field. The third is offered only where the question carries a `retry` target: measured over this
 * repository's own history, 148 of 220 engine-recorded answers were at gates that carry none, and
 * at one of those a `retry` does not repeat anything — `routing.ts:97` returns `{ abort: true }`, so
 * a control reading *send it back* would end the run.
 *
 * **It renders the question and nothing about what the step decided.** What a step concluded, and
 * what it changed, are Q-0129's: they are not on this wire, the artifact holding them is excluded
 * from the backlog routes by a ruling of its own, and inferring either from a run's prose would be
 * reading a sentence composed for a human as though it were a contract.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { gateAnswerSchema, type GateAnswer, type GateQuestionEvent, type WireRun } from '@quorum/shared';

import {
  answerGate, browserFetch, fetchRun, gateAnswerInFlight, isoClock, runInFlight,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';

/** The heading, in one place so a test and the view cannot disagree about what this screen is. */
export const GATE_HEADING = 'Gate';

/** The action that reads the run again — the only thing on this screen that reloads it. */
export const REFRESH_LABEL = 'Refresh';

/** The action offered wherever a read failed, which repeats that read and nothing else. */
export const RETRY_LABEL = 'Retry';

/** The action offered beside a failed answer: it reads the run again and re-sends nothing. */
export const LOOK_AGAIN_LABEL = 'Look again';

/**
 * What each answer is called on a control.
 *
 * A total {@link Record} over the imported union, so a fourth answer would fail to compile here
 * rather than render as a button with no label — and so this file cannot quietly hold three names
 * the schema has stopped agreeing with.
 */
export const ANSWER_LABEL: Record<GateAnswer, string> = {
  advance: 'Advance',
  retry: 'Send it back',
  abort: 'Abort the run',
};

/** What the screen says where the gate names no step to go back to. */
export const NO_RETRY_TARGET =
  'This gate offers no target to go back to, so sending it back is not one of the answers it takes: at a gate declared by a flow, that answer ends the run rather than repeating a step.';

/** How the screen names the step a send-back returns to, where the question carries one. */
export const RETURNS_TO = 'Sending it back runs this step once more:';

/** The refusal code that means the gate this answer named is not waiting any more. */
export const GATE_GONE_CODE = 'no-such-gate';

/**
 * What the screen says about a gate that is no longer waiting.
 *
 * **It claims neither that the answer arrived nor that it failed**, because the daemon cannot tell
 * those apart: the registry deletes a gate before it settles it, so a lost `204`, an answer given
 * at the command line or in another window, and a run that stopped while this page was open all
 * reach the same refusal. Saying either would be inventing the half the exchange did not carry.
 */
export const GATE_GONE =
  'That gate is not waiting any more. It may have been answered here, at the command line or in another window, or the run may have stopped — this page cannot tell which, so it is reading the run again rather than guessing.';

/** How the screen reports an answer the daemon accepted, before it knows what followed. */
export const ANSWERED_PREFIX = 'The daemon accepted this answer:';

/** What it says next, which is that it is asking rather than that anything has happened yet. */
export const ANSWERED_SUFFIX = 'Reading the run again to see where it is now.';

/** The subjects this screen can have, as a closed list, so a set-wide assertion is possible. */
export const GATE_SUBJECTS = ['parked', 'no-gate', 'ended', 'refused'] as const;

/** One of {@link GATE_SUBJECTS}. */
export type GateSubjectKind = (typeof GATE_SUBJECTS)[number];

/** What one run, as the daemon reports it, means for this screen. */
export type GateSubject =
  | { readonly kind: 'parked'; readonly question: GateQuestionEvent }
  | { readonly kind: 'no-gate' }
  | { readonly kind: 'ended' }
  | { readonly kind: 'refused' };

/**
 * A sentence for every subject, and no member of the set is silence.
 *
 * Total over {@link GateSubjectKind}, so a fifth subject cannot be added without one being written
 * for it — which is what stops a later state rendering an empty region.
 *
 * The `refused` sentence says what it cannot say. A refused start's own condition is not a field of
 * a run row, so this route does not carry it, and composing a likely reason here would be a screen
 * inventing the answer the wire withheld.
 */
export const GATE_SUBJECT_TEXT: Record<GateSubjectKind, string> = {
  parked: 'This run is waiting to be told what to do next.',
  'no-gate': 'This run is under way and is not waiting on anybody: no gate has been asked yet, or the last one has been answered.',
  ended: 'This run is over, so there is nothing here to answer.',
  refused: 'The daemon refused this start, so no run happened and there is nothing to answer. This route carries no reason for the refusal; the terminal that asked for the run was told one.',
};

/**
 * What one run means for this screen.
 *
 * A `switch` over the wire's closed three rather than a chain of conditions: a fourth run state
 * would fail to compile here rather than falling through to whichever branch is last.
 */
export function gateSubjectOf(run: WireRun): GateSubject {
  switch (run.state) {
    case 'refused':
      return { kind: 'refused' };
    case 'ended':
      return { kind: 'ended' };
    case 'running': {
      // The first pending question, which is every question a run has: `runStep`'s parallel branch
      // dispatches agent steps alone, so no flow in this product parks one run on two at once. A second
      // would be reported by the count beside it rather than silently dropped.
      const [question] = run.gates;
      return question === undefined ? { kind: 'no-gate' } : { kind: 'parked', question };
    }
  }
}

/**
 * The answers this gate will actually honour, in the vocabulary's own order.
 *
 * Derived from `@quorum/shared`'s schema rather than written here, and filtered by the one field
 * that decides it. `retry` is optional on a question and present only where the gate offers a
 * target: an engine-presented gate always carries one, a gate a flow file declares does not, and
 * answering `retry` at one that does not ends the run.
 */
export function answersOffered(question: GateQuestionEvent): readonly GateAnswer[] {
  const offersTarget = question.retry !== undefined;
  return gateAnswerSchema.options.filter((answer) => offersTarget || answer !== 'retry');
}

/** Injectable inputs: the browser supplies none of them, and every test supplies all of them. */
export interface GateScreenProps {
  /** The handle the URL supplied, decoded. Never trusted to be one this daemon minted. */
  readonly handle: string;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
}

/** The state of one request, as a sentence, its remedy, and the action that repeats it. */
function RequestRegion({ state, onRetry, label }: {
  state: RequestState<unknown>;
  onRetry: () => void;
  label: string;
}): ReactNode {
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-request-state={state.kind}>{requestStateText(state)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {/* Which states offer an action is `request-state.ts`'s to say, not this file's: it is the
          one register of that vocabulary, and a predicate re-derived here would be a second
          authority free to disagree with the board's and the ticket page's. */}
      {canRetryRequest(state) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          {label}
        </button>
      ) : null}
    </div>
  );
}

/** The question, exactly as the engine asked it, and the answers this gate will take. */
function Question({ question, busy, onAnswer }: {
  question: GateQuestionEvent;
  busy: boolean;
  onAnswer: (answer: GateAnswer) => void;
}): ReactNode {
  const offered = answersOffered(question);
  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface p-3">
      {/* The word the engine sent, rendered as it was sent. This screen does not name a gate's
          KIND in words of its own: the engine composes the same one for every gate it presents
          itself, an author-declared step may carry it too, and the field is an open string. */}
      <p className="font-mono text-xs text-muted" data-gate-kind={question.kind}>{question.kind}</p>
      {/* The sentence the engine composed, whole. It is not shortened, rewritten or read for a
          value: a flow file's own text, the sentence spelling a spent bound, and the one saying a
          step stopped rather than looping all arrive here, and each is what a human is owed. */}
      <p className="text-text">{question.reason}</p>
      <p className="font-mono text-xs text-muted">{question.ticketDir}</p>
      {question.retry === undefined
        ? <p className="text-xs text-muted">{NO_RETRY_TARGET}</p>
        : <p className="text-xs text-muted">{RETURNS_TO} <span className="font-mono text-text">{question.retry}</span></p>}
      <div className="flex flex-wrap gap-2">
        {offered.map((answer) => (
          <button
            key={answer}
            type="button"
            disabled={busy}
            data-answer={answer}
            onClick={() => onAnswer(answer)}
            className="rounded border border-border px-3 py-1 text-sm text-text hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {ANSWER_LABEL[answer]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** What became of an answer this screen sent, in a sentence that claims only what was observed. */
function AnswerRegion({ state, onLookAgain }: {
  state: RequestState<GateAnswer>;
  onLookAgain: () => void;
}): ReactNode {
  if (state.kind === 'loaded') {
    return (
      <p className="text-sm text-muted" data-answer-state={state.kind}>
        {ANSWERED_PREFIX} <span className="font-mono text-text">{ANSWER_LABEL[state.value]}</span>. {ANSWERED_SUFFIX}
      </p>
    );
  }
  if (state.kind === 'refused' && state.refusal.code === GATE_GONE_CODE) {
    return <p className="text-sm text-muted" data-answer-state={GATE_GONE_CODE}>{GATE_GONE}</p>;
  }
  return <RequestRegion state={state} onRetry={onLookAgain} label={LOOK_AGAIN_LABEL} />;
}

/**
 * The gate screen, at whatever the daemon last answered.
 *
 * One read on mount and on an explicit Refresh; one write, when a reader answers. Nothing polls,
 * nothing is kept and nothing is persisted — a gate is settled the moment somebody answers it, so a
 * remembered question is a question that may already be gone.
 */
export function GateScreen({ handle, fetcher, now }: GateScreenProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [run, setRun] = useState<RequestState<WireRun>>(runInFlight<WireRun>(handle));
  const [answer, setAnswer] = useState<RequestState<GateAnswer> | null>(null);

  // Which handle everything above is an answer about, compared in the render body rather than
  // cleared in an effect: a prop is committed BEFORE the effect reacting to it runs, so navigating
  // from one run to another would paint the previous run's question under the new handle for as
  // long as it takes React to flush a passive effect. The ticket page's own mechanism, for its
  // reason — and it matters more here, where what would be painted is an answerable control.
  const [loadedFor, setLoadedFor] = useState(handle);

  // One counter for every read this screen starts, whoever starts it, so a superseded answer is
  // dropped rather than landing on top of a newer one — and an unmount bumps it, so a late answer
  // never reaches a screen that is gone.
  const generation = useRef(0);

  // And the one that makes "at most one answer in flight" a property rather than a hope. State
  // cannot do it: two activations in one turn both read the state as it was before either of them,
  // so the guard has to be a value that changes when it is set.
  const sending = useRef(false);

  const read = useCallback(() => {
    const mine = (generation.current += 1);
    setLoadedFor(handle);
    setRun(runInFlight<WireRun>(handle));
    void (async () => {
      const answered = await fetchRun(request, handle, clock);
      if (generation.current === mine) setRun(answered);
    })();
  }, [request, clock, handle]);

  /**
   * Read the run again and forget what was said about the last answer — a fresh look at the run.
   *
   * It releases {@link sending} as well, and the reason is that the two would otherwise disagree:
   * the controls are drawn inert from the answer STATE, which this clears, so a reader who asked
   * for a fresh look while an answer was outstanding would be shown live controls that the ref
   * silently swallowed. Releasing it keeps what is drawn and what is guarded in step. The answer
   * still out is dropped when it returns, its generation having moved — and *exactly one answer
   * wins* is the daemon's property rather than this screen's: the registry deletes a gate before it
   * settles it, so a second answer to one gate is refused rather than taken twice.
   */
  const load = useCallback(() => {
    sending.current = false;
    setAnswer(null);
    read();
  }, [read]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  const send = useCallback((question: GateQuestionEvent, chosen: GateAnswer) => {
    if (sending.current) return;
    sending.current = true;
    const mine = generation.current;
    setAnswer(gateAnswerInFlight<GateAnswer>(handle));
    void (async () => {
      // The correlation token is echoed and never read: it is opaque by contract, and the daemon's
      // own host refuses to take a run's identity out of one.
      const outcome = await answerGate(request, handle, question.gateId, chosen, clock);
      sending.current = false;
      // Dropped where the screen has moved on, for the reason a superseded read is dropped: what
      // it would otherwise settle is a region about a run this screen is no longer showing.
      if (generation.current !== mine) return;
      setAnswer(outcome);
      // Accepted, or aimed at a gate that is not waiting: either way what is true now is a question
      // for the daemon rather than something to infer from a status. Nothing is re-sent.
      if (outcome.kind === 'loaded' || (outcome.kind === 'refused' && outcome.refusal.code === GATE_GONE_CODE)) {
        read();
      }
    })();
  }, [request, clock, handle, read]);

  // The gate, and it is one comparison because everything below is rendered inside the branch under
  // it: a state that did not come from this handle never reaches a question or a control.
  const shown = loadedFor === handle ? run : runInFlight<WireRun>(handle);

  if (shown.kind !== 'loaded') {
    return (
      <section className="max-w-3xl">
        <h1 className="text-lg text-text">{GATE_HEADING}</h1>
        <p className="mt-1 font-mono text-xs text-muted">{handle}</p>
        <div className="mt-4">
          <RequestRegion state={shown} onRetry={load} label={RETRY_LABEL} />
        </div>
      </section>
    );
  }

  const subject = gateSubjectOf(shown.value);
  const busy = answer?.kind === 'in-flight';

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-lg text-text">{GATE_HEADING}</h1>
        <p className="font-mono text-xs text-muted">
          {handle} · {shown.value.flow}
          {shown.value.ticketId === null ? null : <> · {shown.value.ticketId}</>}
        </p>
        <button type="button" onClick={load} className="rounded border border-border px-2 py-1 text-sm text-text hover:text-accent">
          {REFRESH_LABEL}
        </button>
      </div>
      <RequestRegion state={shown} onRetry={load} label={RETRY_LABEL} />
      <p className="text-text" data-gate-subject={subject.kind}>{GATE_SUBJECT_TEXT[subject.kind]}</p>
      {subject.kind === 'parked' ? <Question question={subject.question} busy={busy} onAnswer={(chosen) => send(subject.question, chosen)} /> : null}
      {answer === null ? null : <AnswerRegion state={answer} onLookAgain={load} />}
    </section>
  );
}
