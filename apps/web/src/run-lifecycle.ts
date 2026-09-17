/**
 * The two acts this app performs on a run, and the one discipline both are under.
 *
 * **Two screens, one rule, one module — because the rule is what went wrong last time.** Q-0016's
 * review blocker was a gate screen whose read released the one-answer-in-flight guard, so a Refresh
 * re-enabled the controls and a second answer could race the first. This ticket puts two more
 * irreversible controls on two more screens, one of which is also receiving live socket events, so
 * the guard is written once here rather than twice beside them. A second copy is a second place for
 * that defect to come back.
 *
 * **Both acts are confirmed first, and a confirmation names what is about to happen rather than what
 * it will produce.** A stop names the handle it is about. A start names the ticket, the flow and
 * whether it is a dry walk, and it cannot name a handle: handles are minted inside the daemon when a
 * start is accepted, so before one is sent there is no name for the run to be confirmed by.
 *
 * **Nothing here infers an outcome from a mutation.** The daemon answers what it did, and what the
 * run does next is a read. A delivered cancellation is not a run that ended, a refused one is not a
 * run that completed, and neither of those sentences may be composed from a status.
 *
 * **It is not a gate.** A start and a stop are not gate answers, they are not `advance`, `retry` or
 * `abort`, and no text here is worded with one — `gateAnswerSchema`'s closed three belong to a gate
 * and widening them needs a decision entry this ticket did not take.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RequestState } from './request-state.js';

/**
 * The action offered beside a mutation that failed: it reads the subject again and re-sends nothing.
 *
 * **Declared here rather than beside either screen**, and `gate-screen.tsx` re-exports it for the
 * consumers that already named it there. `canRetryRequest` answers `true` for a refusal, so a bare
 * Retry beside a write would re-issue the write — which is a second start, or a second stop, from a
 * control whose one job is to say *look at what actually happened*.
 */
export const LOOK_AGAIN_LABEL = 'Look again';

/** How a reader withdraws a confirmation. It issues nothing at all, which is the whole of it. */
export const WITHDRAW_LABEL = 'Cancel';

/** How the region offering to start a flow on this ticket opens. */
export const START_HEADING = 'Run a flow';

/** The control that walks a flow without invoking an adapter, and what choosing it means. */
export const DRY_LABEL = 'Dry walk — no agent is invoked, nothing is written and no lock is taken';

/** What a flow the linter refused is said to be, beside its name, so it is named and not hidden. */
export const REFUSED_FLOW_NOTE = 'the flow lint refused this file, so it is not offered';

/** How the control that starts one flow is labelled. */
export const startLabel = (flow: string): string => `Run ${flow}`;

/** How the control that stops the run this screen is showing is labelled. */
export const STOP_LABEL = 'Stop this run';

/** How a reader confirms the start they asked for. */
export const CONFIRM_START_LABEL = 'Start it';

/** How a reader confirms the stop they asked for. */
export const CONFIRM_STOP_LABEL = 'Stop it';

/**
 * What a start's confirmation asks, naming the ticket, the flow and whether it is a dry walk.
 *
 * **Two sentences rather than one with a clause bolted on**, because the two acts are not the same
 * size: a dry walk invokes no adapter, writes nothing and takes no run lock, and a real run spends a
 * subscription and writes to the repository. A reader about to do the second is owed the second
 * sentence.
 */
export const startConfirmation = (ticketId: string, flow: string, dry: boolean): string => (dry
  ? `Walk ${flow} on ${ticketId} as a dry run? Nothing is invoked, nothing is written and no lock is taken.`
  : `Run ${flow} on ${ticketId}? This is a real run: it invokes agents against your subscriptions and writes to this repository.`);

/** What a stop's confirmation asks, naming the handle — the one name the run has on this screen. */
export const stopConfirmation = (handle: string): string =>
  `Stop run ${handle}? The daemon stops it through the signal it was started with, and nothing here undoes that.`;

/** How the screen reports a start the daemon accepted, before it knows anything that followed. */
export const STARTED_PREFIX = 'The daemon started this run:';

/** What it says next, which is where the reader is being taken rather than what the run has done. */
export const STARTED_SUFFIX = 'Opening mission control for it.';

/**
 * What a `204` from a stop establishes, and the half it does not.
 *
 * The daemon aborts the run's own signal and answers; the run is still running until the work
 * already in flight unwinds. Reporting *the run has ended* from this status would be claiming the
 * half the exchange did not carry.
 */
export const STOP_DELIVERED =
  'The daemon took the request to stop this run. Whether it has ended is a read rather than something this page can infer: work already under way unwinds before a run closes.';

/**
 * What this surface says about each refusal `POST /runs` can give a well-formed request.
 *
 * **The code is what tells them apart and never the status**: two pairs here share one —
 * `no-such-ticket` and `no-such-flow` are both `404`, `lock-held` and `not-runnable` both `409` —
 * and each pair says opposite things to a reader. The daemon's own condition renders beside
 * whichever sentence this register supplies, unaltered, under *"A `core` error names the condition;
 * the remedy belongs to the surface"* (2026-09-07): this is the surface's half.
 */
export const START_REFUSAL_TEXT = {
  'lock-held': 'Another run already holds this ticket. The daemon serialises runs per ticket, and the run holding it is named below.',
  'not-runnable': 'That flow does not consume the stage this ticket is at, so there is nothing for it to do here.',
  'no-such-ticket': 'The daemon could not find that ticket in the backlog it is serving.',
  'no-such-flow': 'The daemon could not find that flow file in the harness it is serving.',
  'host-closed': 'The daemon is shutting down and is starting no further run.',
  refused: 'The daemon could not start the run and did not recognise why, so what follows is the condition it was given rather than a diagnosis of it.',
} as const;

/** What this surface says about each refusal `POST /runs/:id/stop` can give a well-formed request. */
export const STOP_REFUSAL_TEXT = {
  'no-such-run': 'The daemon has no run under this handle, so there was nothing to stop.',
  'not-running': 'The daemon says this run is not running. It may have finished on its own between the last read and this request — which is a read rather than something this page can infer, and it is not a claim that the run completed.',
  'not-a-reason': 'The daemon refused the note this page sends with a stop, which is a disagreement between this page and the daemon rather than anything about the run itself.',
} as const;

/**
 * What this surface says about one refusal code, or `null` where it has met one it does not model.
 *
 * `null` is an answer rather than a gap: the daemon's own condition is rendered for every refusal
 * whatever this register holds, so an unmodelled code loses the sentence this surface would have
 * added and loses nothing the daemon said. Composing a likely one instead would be this page
 * answering a question it was not told the answer to.
 */
export function refusalSentence(register: Readonly<Record<string, string>>, code: string): string | null {
  return Object.prototype.hasOwnProperty.call(register, code) ? register[code] : null;
}

/** One act a reader may confirm: what they are confirming, and the request that happens if they do. */
export interface RunAct<T> {
  /** The sentence naming exactly what is about to happen, composed before anything is sent. */
  readonly sentence: string;
  /** What the screen shows while the request is out, naming the path it will ask for. */
  readonly inFlight: RequestState<T>;
  /** The request itself. Made once, when a reader confirms it, and never before. */
  send(): Promise<RequestState<T>>;
  /**
   * What follows an act the daemon ACCEPTED, where anything does.
   *
   * It runs after the outcome has been recorded and only where the screen is still showing the
   * subject the act was about, so what a screen does next cannot happen for a run it has navigated
   * away from — and it never runs for a refusal, which is what keeps *nothing navigates on a
   * refusal* a property of this module rather than of a component's branch.
   */
  onAccepted?(value: T): void;
}

/**
 * One act awaiting confirmation, and the subject it was asked about — captured together.
 *
 * **The pairing is the point.** An act's `send` is composed by the screen for one ticket or one
 * handle, so the subject a request is ABOUT is settled when it is asked rather than when it is
 * confirmed; reading the screen's current subject at confirmation time is reading a second, later
 * answer to a question the closure has already answered, and the two can differ.
 */
interface Pending<T> {
  readonly subject: string;
  readonly act: RunAct<T>;
}

/** One screen's lifecycle-mutation state: what is being confirmed, what came back, and whether to wait. */
export interface RunMutation<T> {
  /** The sentence awaiting confirmation, or `null` where nothing is. */
  readonly confirming: string | null;
  /** What the daemon said about the last act sent ABOUT THIS SUBJECT, or `null` where there is none. */
  readonly outcome: RequestState<T> | null;
  /** Whether any act is outstanding — what every control that could start or stop a run is drawn inert from. */
  readonly busy: boolean;
  /** Ask for confirmation of one act. Ignored while one is outstanding. */
  readonly ask: (act: RunAct<T>) => void;
  /** Withdraw the confirmation. Issues nothing. */
  readonly cancel: () => void;
  /** Send the act that was confirmed. At most one is ever in flight. */
  readonly confirm: () => void;
}

/**
 * The confirm-then-send discipline, with at most one act in flight, for one subject.
 *
 * **The guard is a ref rather than state, and that is the whole reason it works.** Two activations
 * in one turn both read state as it was before either of them, so a flag in state cannot make *at
 * most one* a property — it has to be a value that changes when it is set.
 *
 * **It is released by the act's own resolution and by nothing else.** A read, a live event arriving
 * on the socket, a retry of some other request, a re-render: none of them touches it. That is the
 * defect Q-0016's review found on the gate screen, where a fresh look re-enabled the controls while
 * an answer was still on its way — after which a reader could send a second act that is not the
 * first, and the later one can arrive before it. *The daemon serialises them* is not a licence to
 * send two: which of them wins would be a race rather than a choice.
 *
 * **A confirmation and a request in flight are treated differently by a change of subject, because
 * they are different things.** A request has been MADE about the subject it was composed for, so it
 * completes and is neither withdrawn, reinterpreted nor attributed to the replacement. A
 * confirmation has been made about nothing yet: it is an offer to act on the subject a reader was
 * looking at, and a reader now looking at another one is not being offered it, so it is dropped.
 *
 * @param subject what the outcome is ABOUT — a ticket id for a start, a handle for a stop. This
 *   screen's subject NOW, which is not necessarily the subject of an act already asked about or
 *   already sent; those carry their own, which is what {@link Pending} exists for.
 */
export function useRunMutation<T>(subject: string): RunMutation<T> {
  const [asked, setAsked] = useState<Pending<T> | null>(null);
  const [answered, setAnswered] = useState<{ subject: string; state: RequestState<T> } | null>(null);

  const sending = useRef(false);

  // Cleared once, when the screen goes away, so a late answer settles nothing on a component that is
  // gone. Set on mount as well, because React's development double-invoke runs the cleanup between
  // two mounts of one component — the gate screen's own arrangement, for its reason.
  const alive = useRef(true);

  // The subject this screen is showing NOW, readable by a continuation that captured another one: a
  // closure holds the subject its request was about, which is the right one for the request and the
  // wrong one for deciding what to do to the screen afterwards.
  const showing = useRef(subject);

  // **A confirmation does not survive the change of subject, and it is dropped in the render that
  // changes it rather than in an effect.** A prop is committed BEFORE the effect reacting to it
  // runs, so a confirmation cleared in an effect is one commit late: the previous subject's question
  // renders under the new subject's name, and confirming it there sends the request the old subject
  // composed. The ticket page is that case exactly — `app.tsx` keys mission control by handle so a
  // handle change remounts it, and keys the ticket page by nothing, so one instance survives a
  // navigation from one ticket to another. `ticket-page.tsx`'s own `loadedFor` gate is the same
  // mechanism for the same reason.
  if (showing.current !== subject) {
    showing.current = subject;
    if (asked !== null) setAsked(null);
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const ask = useCallback((act: RunAct<T>) => {
    if (sending.current) return;
    setAsked({ subject, act });
  }, [subject]);

  const cancel = useCallback(() => { setAsked(null); }, []);

  const confirm = useCallback(() => {
    if (sending.current || asked === null) return;
    sending.current = true;
    // The subject the act was ASKED about, so the request and the name its answer is filed under are
    // one capture rather than two reads a re-render apart. `send` was composed for that subject;
    // recording what came back under whatever the screen is showing now would be this screen's
    // second answer to a question the closure had already settled, and the two can differ.
    const { subject: mine, act } = asked;
    setAsked(null);
    setAnswered({ subject: mine, state: act.inFlight });
    void (async () => {
      const outcome = await act.send();
      sending.current = false;
      if (!alive.current) return;
      // An answer about a subject this screen has moved off settles nothing and is cleared instead:
      // its outcome is a sentence about another ticket or another run, and leaving the in-flight
      // state standing would hold this subject's controls inert with nothing outstanding.
      if (showing.current !== mine) { setAnswered(null); return; }
      setAnswered({ subject: mine, state: outcome });
      if (outcome.kind === 'loaded') act.onAccepted?.(outcome.value);
    })();
  }, [asked]);

  return {
    confirming: asked?.act.sentence ?? null,
    // What the daemon did about THIS subject. An answer about another one is held rather than
    // rendered, which is what stops one ticket's start being reported under another ticket's name.
    outcome: answered !== null && answered.subject === subject ? answered.state : null,
    // Inert while ANY act is outstanding, whatever subject it is about: the two halves of *inert*
    // have to agree, and a control drawn live from this subject's own state while the guard still
    // held another's would be one a reader can press that silently does nothing.
    busy: answered?.state.kind === 'in-flight',
    ask,
    cancel,
    confirm,
  };
}
