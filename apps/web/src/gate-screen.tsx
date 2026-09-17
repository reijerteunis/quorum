/**
 * The gate screen: what a run is waiting to be told, and the one answer this app sends.
 *
 * **It settles a promise `core` is already parked on, and nothing beyond that.** It moves no stage,
 * starts no run and stops none — starting and stopping are the ticket page's and mission control's
 * since Q-0130, under the same guard and the same confirm-then-send discipline this screen's own
 * review round produced. `apps/web/test/source.test.ts` holds that boundary by naming the two
 * modules that may carry the method and the path, rather than by the absence that held it before,
 * and by registering the three functions that issue a non-GET by name.
 *
 * **The question comes from `GET /runs/:id` and not from the event stream.** The daemon already
 * holds the pending questions whole and derives them per request, so a browser opened at this URL
 * with no history behind it has everything it needs in one answer: a screen reading a replayed
 * buffer instead would have two states in which it cannot do its one job — a run reported as
 * waiting whose question the replay did not supply, and a replay it must disclose as incomplete and
 * cannot repair. Widening the wire removes those rather than mitigating them.
 *
 * **It holds no socket, and neither does the route it is drawn at.** `app.tsx` opens a live
 * connection for a run route and this one is excluded there by name, because a shell streaming a run
 * behind a screen that is deliberately not live is the same socket by another door. The cost is
 * stated rather than smoothed over: a gate asked while this screen is open is not shown until the
 * reader asks again, and what the run does next is shown by reading again rather than live.
 * Rendering a run's event stream is mission control's subject (Q-0015), and coupling this screen to
 * that controller before that ticket has decided how it is held is a design no ticket has done.
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
// Declared in `run-lifecycle.ts` since Q-0130 and re-exported here: the ticket page and mission
// control offer the same action beside a failed write, for the same reason this screen does, and two
// declarations of one label would be free to drift into two words for one act. Re-exported rather
// than moved, so every consumer that already names it here goes on doing so.
import { LOOK_AGAIN_LABEL } from './run-lifecycle.js';

export { LOOK_AGAIN_LABEL };

/** The heading, in one place so a test and the view cannot disagree about what this screen is. */
export const GATE_HEADING = 'Gate';

/** The action that reads the run again — the only thing on this screen that reloads it. */
export const REFRESH_LABEL = 'Refresh';

/** The action offered wherever a read failed, which repeats that read and nothing else. */
export const RETRY_LABEL = 'Retry';

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
  | { readonly kind: 'refused'; readonly refusal: WireRun['refusal'] };

/**
 * A sentence for every subject, and no member of the set is silence.
 *
 * Total over {@link GateSubjectKind}, so a fifth subject cannot be added without one being written
 * for it — which is what stops a later state rendering an empty region.
 *
 * The `refused` sentence is what this screen can say about every refused start; the daemon's own
 * reason for one is rendered beside it, from the row's own `refusal` field, and never composed here.
 */
export const GATE_SUBJECT_TEXT: Record<GateSubjectKind, string> = {
  parked: 'This run is waiting to be told what to do next.',
  'no-gate': 'This run is under way and is not waiting on anybody: no gate has been asked yet, or the last one has been answered.',
  ended: 'This run is over, so there is nothing here to answer.',
  refused: 'The daemon refused this start, so no run happened and there is nothing to answer.',
};

/** How the screen introduces the daemon's own words for a refusal, which it renders unaltered. */
export const REFUSAL_PREFIX = 'The daemon gave this reason:';

/**
 * What the screen says where a refused row carries no reason at all.
 *
 * Not the ordinary case and not a gap either: a run is minted `refused` and stays so until its start
 * resolves, so a row read inside that window is a refusal the daemon has not written yet. Saying
 * that is the honest answer, and inventing a likely condition would be this screen answering a
 * question the daemon has not.
 */
export const REFUSAL_UNSTATED =
  'This row carries no reason for it, which means the start had not finished resolving when the run was read. Reading again is what would answer it.';

/**
 * What one run means for this screen.
 *
 * A `switch` over the wire's closed three rather than a chain of conditions: a fourth run state
 * would fail to compile here rather than falling through to whichever branch is last.
 */
export function gateSubjectOf(run: WireRun): GateSubject {
  switch (run.state) {
    case 'refused':
      return { kind: 'refused', refusal: run.refusal };
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

/**
 * An answer this screen sent, and the run it was about.
 *
 * The handle travels with it because the region that renders it is drawn outside the branch that
 * holds one run: what the daemon did with an answer is true whatever a later read is doing, so the
 * region cannot be guarded by the run's state — and without the handle beside it, a screen moved from
 * one run to another would paint the previous run's answer under the new one's heading for as long as
 * it takes an effect to flush. {@link GateScreen}'s `loadedFor` is the same rule for the run region.
 */
interface AnsweredGate {
  readonly handle: string;
  readonly state: RequestState<GateAnswer>;
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

/** Why a refused start never happened, in the daemon's own words — or that the row carries none. */
function RefusalRegion({ refusal }: { refusal: WireRun['refusal'] }): ReactNode {
  if (refusal === null) return <p className="text-sm text-muted" data-refusal="unstated">{REFUSAL_UNSTATED}</p>;
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-surface p-3 text-sm" data-refusal="stated">
      {/* The condition is the failing library's own sentence and the remedy is the daemon's, both
          rendered unaltered: *"A `core` error names the condition; the remedy belongs to the
          surface"* (2026-09-07) is what wrote them, and paraphrasing either here would be a third
          surface describing one failure a third way. */}
      <p className="text-text">{REFUSAL_PREFIX} {refusal.condition}</p>
      {refusal.remedy === null ? null : <p className="text-muted">{refusal.remedy}</p>}
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
  const [answer, setAnswer] = useState<AnsweredGate | null>(null);

  // Which handle {@link run} is an answer about — the run and nothing else, {@link answer} carrying
  // its own. Compared in the render body rather than cleared in an effect: a prop is committed
  // BEFORE the effect reacting to it runs, so navigating from one run to another would paint the
  // previous run's question under the new handle for as long as it takes React to flush a passive
  // effect. The ticket page's own mechanism, for its reason — and it matters more here, where what
  // would be painted is an answerable control.
  const [loadedFor, setLoadedFor] = useState(handle);

  // One counter for every READ this screen starts, whoever starts it, so a superseded read is
  // dropped rather than landing on top of a newer one, and an unmount bumps it so a late one reaches
  // no screen at all. **It governs reads and nothing else**, which is the correction the run-2
  // review forced: an answer was governed by it too, and a Refresh bumps it — so a settled answer
  // arriving after one was dropped, leaving the region that draws the controls inert stuck at *on
  // its way* with nothing on its way. {@link alive} is what an answer is guarded by instead.
  const generation = useRef(0);

  // And the one that makes "at most one answer in flight" a property rather than a hope. State
  // cannot do it: two activations in one turn both read the state as it was before either of them,
  // so the guard has to be a value that changes when it is set.
  //
  // **It is released by the answer's own resolution and by nothing else.** That is what makes the
  // release in `send` unconditional AND correct — no second answer can begin while this holds, so
  // the request that clears it is always the request that set it. A READ used to clear it too, and
  // that was the defect the run-2 review found: a fresh look re-enabled the controls while an answer
  // was still on its way, so a reader could send a second that is not the first, and an `abort` sent
  // after an `advance` can arrive before it. *Exactly one answer wins* is the daemon's property, and it is
  // not a licence to send two — which of them wins would be a race rather than a choice.
  const sending = useRef(false);

  // Cleared once, when this screen goes away, so a late answer settles nothing and starts no read on
  // a component that is gone. Set on mount as well, because React's development double-invoke runs
  // the cleanup between two mounts of one component.
  const alive = useRef(true);

  // The handle this screen is showing NOW, readable by a continuation that captured another one: a
  // closure holds the handle its request was about, which is the right one for the request and the
  // wrong one for deciding what to do to the screen afterwards. `loadedFor` is the same guard for
  // the run region, and this is the half an async callback can reach.
  const showing = useRef(handle);
  showing.current = handle;

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
   * Read the run again — a fresh look, which forgets a settled answer and withdraws no live one.
   *
   * **It neither releases {@link sending} nor clears an answer that is still on its way**, and the
   * two halves are one rule: the controls are drawn inert from the answer state, so clearing that
   * state would show a reader live controls the guard then swallowed, and releasing the guard as
   * well would be worse — a second answer racing the one already sent. A read is not a withdrawal.
   * What a reader gets instead is the run read again with the outstanding answer's own sentence
   * still beside it, naming the request it is waiting for.
   */
  const load = useCallback(() => {
    if (!sending.current) setAnswer(null);
    read();
  }, [read]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const send = useCallback((question: GateQuestionEvent, chosen: GateAnswer) => {
    if (sending.current) return;
    sending.current = true;
    setAnswer({ handle, state: gateAnswerInFlight<GateAnswer>(handle) });
    void (async () => {
      // The correlation token is echoed and never read: it is opaque by contract, and the daemon's
      // own host refuses to take a run's identity out of one.
      const outcome = await answerGate(request, handle, question.gateId, chosen, clock);
      sending.current = false;
      if (!alive.current) return;
      // An answer about a run this screen has moved off settles nothing and is cleared instead: its
      // outcome is a sentence about another run, and leaving the in-flight region standing would
      // hold the controls inert on a gate that has nothing outstanding.
      if (showing.current !== handle) { setAnswer(null); return; }
      setAnswer({ handle, state: outcome });
      // Accepted, or aimed at a gate that is not waiting: either way what is true now is a question
      // for the daemon rather than something to infer from a status. Nothing is re-sent.
      if (outcome.kind === 'loaded' || (outcome.kind === 'refused' && outcome.refusal.code === GATE_GONE_CODE)) {
        read();
      }
    })();
  }, [request, clock, handle, read]);

  // The run this handle's reads have answered with, and the answer this handle's reader sent. They
  // are guarded separately because they are answers to two unlike questions: a question and the
  // controls beside it may only be drawn from a run this handle was read for, while what the daemon
  // did with an answer is established by that exchange alone and stays true whatever a later read is
  // doing. Both are compared in the render body rather than cleared in an effect, a prop being
  // committed before the effect reacting to it runs.
  const shown = loadedFor === handle ? run : runInFlight<WireRun>(handle);
  const sent = answer !== null && answer.handle === handle ? answer.state : null;

  // Inert while ANY answer is outstanding, which is what {@link sending} is: the two halves of
  // *inert* have to agree, and a control drawn live from this handle's own answer while the guard
  // still held somebody else's would be one a reader can press that silently does nothing.
  const busy = answer?.state.kind === 'in-flight';

  if (shown.kind !== 'loaded') {
    // The run is not loaded — so there is no question, no subject and nothing to answer. **The
    // answer region is still drawn here**, and that is what the run-2 review stopped on rather than a
    // convenience: an accepted answer sends the screen straight back into this branch, because
    // reading again is what it does next. Drawn only inside the loaded branch, the sentence naming
    // the answer a reader had just sent — and the one saying a gate is no longer waiting, which is
    // the only thing standing between them and answering a third time — were hidden by the read that
    // followed them, and hidden for good if it never arrived.
    return (
      <section className="max-w-3xl">
        <h1 className="text-lg text-text">{GATE_HEADING}</h1>
        <p className="mt-1 font-mono text-xs text-muted">{handle}</p>
        <div className="mt-4 flex flex-col gap-3">
          <RequestRegion state={shown} onRetry={load} label={RETRY_LABEL} />
          {sent === null ? null : <AnswerRegion state={sent} onLookAgain={load} />}
        </div>
      </section>
    );
  }

  const subject = gateSubjectOf(shown.value);

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
      {subject.kind === 'refused' ? <RefusalRegion refusal={subject.refusal} /> : null}
      {subject.kind === 'parked' ? <Question question={subject.question} busy={busy} onAnswer={(chosen) => send(subject.question, chosen)} /> : null}
      {sent === null ? null : <AnswerRegion state={sent} onLookAgain={load} />}
    </section>
  );
}
