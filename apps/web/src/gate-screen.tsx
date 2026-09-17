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
 * **It renders the decision that reached the gate, and nothing it worked out for itself.** Since
 * Q-0129 the question carries `reached` — the deciding step's id and the three values that step
 * returned — so the screen reads a value rather than a sentence. It is rendered as **text**, whole,
 * with no cap and nothing behind a control: the largest such record in this repository's history is
 * 13 KB, so there is no size to manage and nothing to disclose.
 *
 * **And since Q-0134 it renders what that decision was made ON**, which is a second read rather than
 * a second field: the patch is bounded by `repo.max_diff_bytes` at 200,000 bytes against a 214 B
 * mean event, so it may not ride on the question the way the decision does, and it is fetched from
 * a read-only route keyed on the same opaque `gateId` an answer echoes. Those are the two halves of
 * one screen taking opposite answers for a reason that is size and replay rather than kind. The
 * bytes are the reviewer's own — captured where the diff was produced and never re-taken here,
 * because refs move and a second `git diff` at the moment this screen opens could show a reader a
 * change the reviewer never saw.
 *
 * **Findings are grouped only by the vocabulary `@quorum/shared` declares, and one matching none is
 * shown whole.** The register is imported rather than re-spelled, so dropping a member from it stops
 * this file compiling. Measured over this repository's own 1,080 findings, **one in seven carries no
 * recognised prefix** — most of them from steps whose instructions declare no taxonomy at all — so a
 * screen with nowhere to put one would drop a seventh of what a reader is owed, or file it under a
 * severity it does not claim.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  FINDING_SEVERITIES, gateAnswerSchema, OBSERVATION_TAG,
  type DiffEvidence, type GateAnswer, type GateQuestionEvent, type GateReached, type WireRun,
} from '@quorum/shared';

import {
  answerGate, browserFetch, fetchGateDiff, fetchRun, gateAnswerInFlight, gateDiffInFlight, isoClock,
  NO_DIFF_CODE, runInFlight,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { DiffRegion } from './diff-view.js';
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

/**
 * How the screen introduces the decision the question carries.
 *
 * It names the **deciding** step rather than the preceding one, because those are not the same step
 * and AC-3(a) is explicit that they need not be: the engine carries the nearest verdict-declaring
 * step's decision across intervening steps that declare none. `chore.yaml` is exactly that shape —
 * `integrate` runs between `review` and the owner gate — so a heading claiming adjacency would
 * misname the step at the most common gate in this repository's history. The wording is *"A gate
 * question carries the decision that reached it"* (2026-09-17)'s own, rather than a synonym for it.
 */
export const REACHED_HEADING = 'The decision that reached this gate';

/** How it names the step, so `runs.log`, the manifest and this screen all say one thing. */
export const REACHED_STEP = 'Step:';

/**
 * What it says where the question carries no decision at all.
 *
 * **It names the condition and composes no likely reason.** A gate a flow file declares can follow
 * any step — a script, an integrate, or the first step of a run — and *nothing was reported* is not
 * *nothing was wrong*. Saying the second would be this screen answering a question the engine did
 * not, which `docs/04-architecture.md`'s placeholder rule refuses in as many words.
 */
export const NO_REACHED =
  'This gate follows a step that declared no verdict, so the run reported no decision to show here. That is not a claim that nothing was wrong: it is that nothing was asked of that step.';

/** What it says where a step decided something and reported nothing beside it. */
export const NO_FINDINGS = 'That step reported nothing beside its verdict.';

/**
 * What it says where the step whose decision reached this gate was given no diff.
 *
 * **It names the condition and claims nothing about the change.** Four of the six flows this product
 * ships declare no `input.diff` at all and a gate a flow file declares can follow any step, so this
 * is the ordinary case rather than a gap — and the daemon answers it as its own coded refusal
 * precisely so a screen can say which of the two it met instead of rendering an empty patch. *There
 * is nothing to show* is not *nothing changed*, and saying the second would be this screen answering
 * a question the run did not.
 */
export const NO_DIFF =
  'The step whose decision reached this gate was given no diff, so there is nothing to show here. That is not a claim that nothing changed: most of the flows this product ships review no diff at all, and a gate declared by a flow can follow any step.';

/** What it says where a step returned an empty summary, which is a value rather than a silence. */
export const NO_SUMMARY = 'That step returned no summary.';

/**
 * How it heads the entries carrying no prefix this product declares.
 *
 * Neither dropped nor re-filed: **150 of this repository's 1,080 findings are in that state**, most
 * of them written by steps whose instructions declare no taxonomy, so they are ordinary rather than
 * malformed — and counting one into a severity it does not claim would be a number that is wrong
 * without saying so.
 */
export const UNCATEGORISED_HEADING = 'Reported without a severity';

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
 * The register a reported entry is grouped under, or `null` where it carries none of them.
 *
 * **Imported and never re-spelled**, which is the property AC-9 is about: `FINDING_SEVERITIES` is
 * `@quorum/shared`'s and so is the observation tag, so a member dropped from either stops this file
 * compiling rather than leaving a group nothing can ever fall into. The prefix test is the one
 * `checkAgainstSchema` applies at the other end — the tag, a colon and a space — so the two ends
 * cannot disagree about what an entry claims to be.
 */
export const REPORT_GROUPS = [...FINDING_SEVERITIES, OBSERVATION_TAG] as const;

/** One of {@link REPORT_GROUPS}. */
export type ReportGroup = (typeof REPORT_GROUPS)[number];

/** What one step reported, sorted into the declared register and the entries outside it. */
export interface ReportedEntries {
  /** One entry per group that has any, in the register's own order. */
  readonly grouped: readonly { readonly group: ReportGroup; readonly entries: readonly string[] }[];
  /** Everything matching no group, whole and in the order it was reported. */
  readonly rest: readonly string[];
}

/**
 * Sorts what a step reported into the declared register, keeping everything.
 *
 * Every entry lands in exactly one place and nothing is dropped, which is asserted rather than
 * intended: the two halves sum to the input, and an entry outside the register keeps its own text
 * untouched rather than being re-filed or trimmed to look like one that is inside it.
 */
export function groupReported(entries: readonly string[]): ReportedEntries {
  const of = (entry: string): ReportGroup | null =>
    REPORT_GROUPS.find((group) => entry.startsWith(`${group}: `)) ?? null;
  return {
    grouped: REPORT_GROUPS
      .map((group) => ({ group, entries: entries.filter((entry) => of(entry) === group) }))
      .filter((each) => each.entries.length > 0),
    rest: entries.filter((entry) => of(entry) === null),
  };
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

/**
 * The decision that reached this gate, whole — or the sentence saying nothing decided.
 *
 * The deciding step is not necessarily the preceding one: see {@link REACHED_HEADING}.
 *
 * Everything here is rendered as **text**. A summary and a reported entry are written by an agent,
 * so they are the one thing on this screen a stranger's words reach directly; React escapes what it
 * interpolates, and this file carries no way round that.
 */
function ReachedRegion({ reached }: { reached: GateReached | undefined }): ReactNode {
  if (reached === undefined) {
    return <p className="text-sm text-muted" data-reached="none">{NO_REACHED}</p>;
  }
  const reported = groupReported(reached.findings);
  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface p-3" data-reached="stated">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-sm text-text">{REACHED_HEADING}</h2>
        {/* The word the engine sent, as it was sent. A step's vocabulary is its own flow file's —
            `approve`, `ready`, `proceed`, `changes-requested` — so a noun coined from one here
            would be this screen naming a decision it cannot classify.

            The attribute is `data-decided` and not the field's own name, which is not fastidiousness:
            Q-0015 AC-6 forbids the literal that field spells followed by `=` anywhere under `src`,
            because that is the token a parser of the `done` message would key on, and its emptiness
            is measured. A JSX attribute of that name would write the token while parsing nothing —
            and a needle weakened to allow it stops forbidding the thing it was measured for. */}
        <p className="font-mono text-xs text-accent" data-decided={reached.verdict}>{reached.verdict}</p>
      </div>
      <p className="font-mono text-xs text-muted">{REACHED_STEP} <span className="text-text">{reached.stepId}</span></p>
      {reached.summary === ''
        ? <p className="text-sm text-muted" data-summary="empty">{NO_SUMMARY}</p>
        : <p className="text-text" data-summary="stated">{reached.summary}</p>}
      {reported.grouped.length === 0 && reported.rest.length === 0
        ? <p className="text-sm text-muted" data-findings="none">{NO_FINDINGS}</p>
        : (
          <div className="flex flex-col gap-2">
            {reported.grouped.map(({ group, entries }) => (
              <div key={group} className="flex flex-col gap-1">
                <p className="font-mono text-xs uppercase text-muted" data-group={group}>{group}</p>
                {entries.map((entry, at) => (
                  <p key={`${group}-${String(at)}`} className="text-sm text-text" data-finding={group}>{entry}</p>
                ))}
              </div>
            ))}
            {reported.rest.length === 0 ? null : (
              <div className="flex flex-col gap-1">
                {/* Its own place, named. An entry the register does not recognise is reported by a
                    step whose instructions declare no taxonomy, which is most of them — so it is
                    ordinary, and putting it under a heading of its own is what stops it being read
                    as something it never claimed to be. */}
                <p className="font-mono text-xs uppercase text-muted" data-group="uncategorised">{UNCATEGORISED_HEADING}</p>
                {reported.rest.map((entry, at) => (
                  <p key={`rest-${String(at)}`} className="text-sm text-text" data-finding="uncategorised">{entry}</p>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

/**
 * The diff read for one gate, whatever it has come to — and no member of it is silence.
 *
 * Five outcomes, and the interesting one is the middle: `no-diff` is a **refusal** on the wire and
 * an **answer** on the screen, so it is recognised by its code and rendered as a sentence rather
 * than as a failure with a retry beside it. There is nothing to retry — the step read no diff and
 * asking again cannot change that — and offering the action anyway would teach a reader that this
 * region is broken when it is complete. {@link GATE_GONE_CODE} gets the same treatment one region
 * down, for the same reason and by the same mechanism.
 *
 * **Its failures never touch the answer.** This region draws no control, clears no answer state and
 * releases no in-flight guard: a diff that could not be read is a diff that could not be read, and
 * a gate is still answerable without it — which is the honest arrangement, since the gate is
 * answerable from a terminal with no diff at all.
 */
function GateDiffRegion({ state, onRetry }: {
  state: RequestState<DiffEvidence>;
  onRetry: () => void;
}): ReactNode {
  if (state.kind === 'loaded') return <DiffRegion evidence={state.value} />;
  if (state.kind === 'refused' && state.refusal.code === NO_DIFF_CODE) {
    return <p className="text-sm text-muted" data-diff="none">{NO_DIFF}</p>;
  }
  // Wrapped and named, so *the diff's own state* is addressable: the run's read draws the same
  // region at the top of this screen, and a reader — or a test — that could not tell the two apart
  // could not tell which read an action repeats.
  return (
    <div data-diff-request={state.kind}>
      <RequestRegion state={state} onRetry={onRetry} label={RETRY_LABEL} />
    </div>
  );
}

/**
 * A diff this screen read, and which gate of which run it is about.
 *
 * Both keys, for {@link AnsweredGate}'s reason and one more: a gate id is unique within a run and
 * not across runs — `nextGateId` spells `<run number>:<n>`, so two tickets on their first run both
 * ask `1:1` — so the handle is what makes the pair an identity. Without it, moving between two runs
 * parked at their own first gate would paint one run's patch under the other's question.
 */
interface GateDiff {
  readonly handle: string;
  readonly gateId: string;
  readonly state: RequestState<DiffEvidence>;
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
  const [diff, setDiff] = useState<GateDiff | null>(null);

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

  // The same counter for the diff read, separate because the two reads supersede independently: a
  // Refresh repeats the run and not the evidence — a gate's diff is a snapshot and does not change
  // while that gate waits — and a failed evidence read is repeated by the action beside it and by
  // nothing else. Sharing one counter would make each read able to drop the other's answer.
  const diffGeneration = useRef(0);

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

  /**
   * Read the diff one waiting gate's decision was made on.
   *
   * Keyed by handle AND gate id so a response for either an earlier run or an earlier gate cannot
   * land on the screen a reader is looking at — the run read's own generation guard, applied to the
   * pair that identifies this value. It touches nothing the gate answer depends on.
   */
  const readDiff = useCallback((gateId: string) => {
    const mine = (diffGeneration.current += 1);
    setDiff({ handle, gateId, state: gateDiffInFlight<DiffEvidence>(handle, gateId) });
    void (async () => {
      const answered = await fetchGateDiff(request, handle, gateId, clock);
      if (diffGeneration.current === mine) setDiff({ handle, gateId, state: answered });
    })();
  }, [request, clock, handle]);

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

  // The gate this screen is parked at, if it is parked at one, and whether the run behind that
  // answer is loaded at all. Both derived here rather than inside the loaded branch, because the
  // effect below is a hook and a hook may not sit after a return — and they are two values rather
  // than one because *no gate* and *no answer yet* are two different states, which is the whole of
  // what the effect turns on.
  const parkedGateId = shown.kind === 'loaded' && shown.value.state === 'running'
    ? shown.value.gates[0]?.gateId ?? null
    : null;
  const runLoaded = shown.kind === 'loaded';

  useEffect(() => {
    // **One read per gate, and the guard is what makes that true rather than the dependency list.**
    // The evidence for one gate is a snapshot — taken when the diff was materialised, and unable to
    // change while that gate waits — so a repeat read costs a bounded body and establishes nothing.
    // Keying the effect on *which gate* alone does not deliver it: the run's own read passes through
    // *in flight* on its way back, so a Refresh makes the gate disappear and return, and the region
    // would blink out and be fetched again for a value that had not moved. Asking whether this pair
    // is already the one in hand is what closes it, and it is the same question a stale response is
    // rejected by two lines down.
    if (parkedGateId === null) {
      // Forgotten only once a LOADED run says there is no gate to be at. A read in flight is not an
      // answer, and clearing on one is the blink above.
      if (runLoaded && diff !== null) setDiff(null);
      return;
    }
    if (diff !== null && diff.handle === handle && diff.gateId === parkedGateId) return;
    readDiff(parkedGateId);
  }, [parkedGateId, runLoaded, diff, handle, readDiff]);

  // Bumped when this screen goes away and at no other time, so a read still outstanding settles
  // nothing on a component that is gone. Every SUPERSEDING bump is `readDiff`'s own, which is what
  // makes an older read's answer unable to land on a newer one's.
  useEffect(() => () => { diffGeneration.current += 1; }, []);

  /**
   * This handle's and this gate's own diff read, or the in-flight state naming what is being asked.
   *
   * The fallback is {@link shown}'s arrangement for its reason: a prop is committed before the
   * effect reacting to it runs, so the first render at a new gate would otherwise have either
   * nothing to draw or the previous gate's patch under the new gate's question.
   */
  const diffFor = (gateId: string): RequestState<DiffEvidence> =>
    diff !== null && diff.handle === handle && diff.gateId === gateId
      ? diff.state
      : gateDiffInFlight<DiffEvidence>(handle, gateId);

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
      {/* Above the controls, because it is what a reader is answering FROM. Drawn for every parked
          gate rather than only where there is something to show: a question that carries no
          decision says so, which is what stops the region being an absence a reader reads as
          reassurance. */}
      {subject.kind === 'parked' ? <ReachedRegion reached={subject.question.reached} /> : null}
      {/* Between the decision and the controls, because it is what that decision was made ON: a
          reader answering from the verdict is answering from the change under it, and a patch drawn
          below the buttons would be evidence a reader meets after the act it is evidence for. */}
      {subject.kind === 'parked'
        ? (
          <GateDiffRegion
            state={diffFor(subject.question.gateId)}
            onRetry={() => { readDiff(subject.question.gateId); }}
          />
        )
        : null}
      {subject.kind === 'parked' ? <Question question={subject.question} busy={busy} onAnswer={(chosen) => send(subject.question, chosen)} /> : null}
      {sent === null ? null : <AnswerRegion state={sent} onLookAgain={load} />}
    </section>
  );
}
