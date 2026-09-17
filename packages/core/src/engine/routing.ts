/** Gate policy, step dispatch, and bounded backward-edge decisions for one running flow. */
import { gateAnswerEnvelopeSchema, type GateQuestionEvent, type GateReached } from '@quorum/shared';

import { runFanOut, runIntegrate } from './composite.js';
import { runAgentStep, runScript } from './steps.js';
import { FlowError, GateUnansweredError, type RoutingContext, type StepResult } from './types.js';

function interruptedGate(request: GateQuestionEvent): FlowError {
  return new FlowError(`gate ${request.kind} (${request.reason}) interrupted`);
}

/**
 * A decision as the fragment a gate question spreads — `{}` where there is nothing to carry.
 *
 * Spread rather than assigned so that *no step before this gate declared a verdict* renders as the
 * field being **absent**, which is what a reader is owed: an object of empty members would say a
 * step decided nothing, and nothing decided at all is a different sentence. Both sites that compose
 * a question read {@link RoutingContext.reached} and hand what they read to this one builder, and it is
 * derived from nowhere else — no message is parsed, no `gateId` is taken apart and no artifact is
 * re-read. What differs is which reading each site is entitled to, which is where the two kinds of
 * gate differ: see {@link handleFail}. See *"A gate question carries the decision that reached it"*
 * (2026-09-17).
 *
 * **A decision is carried to the first gate that PRESENTS it and no further**, so a later gate
 * reached with nothing decided since carries nothing rather than re-presenting a decision the reader
 * has already answered on — which is AC-6's *neither layer substitutes a previous gate's value* in
 * the direction the identity test in {@link handleFail} does not reach. Neither site that composes a
 * question spends one: {@link askGate} does, at the emit, because composing a question is not the
 * same act as asking it and only the second one has a reader. See Q-0129 erratum E-7(a).
 */
const reachedBy = (reached: GateReached | undefined): { reached?: GateReached } =>
  reached === undefined ? {} : { reached };

/**
 * Publishes one correlated question and validates the caller's out-of-band answer.
 *
 * **The engine spends the decision it presents, and this is where it presents one.** Emitting the
 * question is the act that means a reader was shown anything, and the three returns above that line
 * — an `auto` gate, a non-locked gate under `--auto`, a `--dry` walk — are gates nobody was shown.
 * So a decision cleared where a question is *built* would be spent on one that was never asked, and
 * the next reader would be handed nothing. See {@link reachedBy} and Q-0129 erratum E-7(a).
 */
export async function askGate(request: GateQuestionEvent, context: RoutingContext): Promise<'advance' | 'retry' | 'abort'> {
  if (request.kind === 'auto' || (context.auto && request.kind !== 'human-locked')) {
    context.emit({ type: 'info', message: `gate: auto-advanced (${request.kind})` });
    return 'advance';
  }
  if (context.dry) {
    context.emit({ type: 'info', message: `gate (${request.kind}): would pause here` });
    return 'advance';
  }
  if (context.signal?.aborted) throw interruptedGate(request);

  context.emit(request);
  // Presented, so the decision it carried is spent — and only where the slot still holds the very
  // object this question took: a `parallel:` sibling may have replaced it while an exhaustion gate
  // awaited its record below, and a sibling's decision is not this gate's to spend.
  if (request.reached !== undefined && context.reached === request.reached) context.reached = undefined;
  // Typed rather than plain since Q-0040: a caller that supplied no channel is nobody being there,
  // which the run classifies `undecided`. The wording is unchanged.
  if (!context.answerGate) {
    throw new GateUnansweredError(`gate ${request.kind} (${request.reason}) has no answer channel`,
      { kind: request.kind, reason: request.reason, condition: 'no-answer-channel' });
  }

  let removeAbort = (): void => {};
  try {
    const interrupted = new Promise<never>((_resolve, reject) => {
      const abort = (): void => reject(interruptedGate(request));
      context.signal?.addEventListener('abort', abort, { once: true });
      removeAbort = (): void => context.signal?.removeEventListener('abort', abort);
      if (context.signal?.aborted) abort();
    });
    const raw = await Promise.race([context.answerGate(request), interrupted]);
    const parsed = gateAnswerEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new FlowError(`gate ${request.gateId} (${request.kind}: ${request.reason}) received an invalid answer`);
    }
    if (parsed.data.gateId !== request.gateId) {
      throw new FlowError(`gate ${request.gateId} received stale answer for ${parsed.data.gateId}`);
    }
    context.persistence.appendLog(context.ticket, `run=${context.runId} gate=${request.kind} answer=${parsed.data.answer}`);
    return parsed.data.answer;
  } finally {
    removeAbort();
  }
}

/** Dispatches a step in spike order without taking ownership of the engine's cursor. */
export async function runStep(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  if (step.parallel) {
    const members = step.parallel as ReadonlyArray<Readonly<Record<string, unknown>>>;
    // What each member decided, by its position in the flow file rather than by when it answered.
    const decided = new Map<number, GateReached>();
    // Why: preserved defect, see Q-0050 AC-12.
    const settled = await Promise.allSettled(members.map((member, index) => runAgentStep(member, context, {
      collectReached: (reached) => { decided.set(index, reached); },
    })));
    // Declaration order decides which of a group's decisions the next gate carries. The members
    // assigned the run's slot as they finished, which is the order the vendors answered in, so
    // re-applying them here in the order the flow file writes them is what stops a reader being
    // shown a value chosen by scheduling. Re-applied rather than picked, so the last member that
    // decided wins and one that decided nothing displaces nobody.
    //
    // Why: preserved defect, see Q-0129 E-7(b) — a member that presented its own exhaustion gate has
    // already spent its decision, and this loop restores it, so a later gate could carry one the
    // reader has answered. Registered rather than closed: per-member evidence contradicts the slot's
    // landed note and no criterion asks for one, which is a ticket rather than a line in a revise
    // round. Latent while no `parallel:` member of a shipped flow declares a verdict at all, which
    // `packages/shared/src/flow.test.ts` asserts by flow and member name.
    for (let index = 0; index < members.length; index += 1) {
      const reached = decided.get(index);
      if (reached !== undefined) context.reached = reached;
    }
    const failed = settled
      .map((result, index) => ({ result, step: members[index] }))
      .filter((entry): entry is { result: PromiseRejectedResult; step: Readonly<Record<string, unknown>> } => entry.result.status === 'rejected');
    if (failed.length > 0) {
      const survivors = members.filter((_member, index) => settled[index]?.status === 'fulfilled').map((member) => String(member.id));
      const detail = failed.map(({ result, step: member }) => {
        const reason = result.reason as { message?: unknown } | null | undefined;
        return `${String(member.id)}: ${String(reason?.message ?? result.reason)}`;
      }).join('\n  - ');
      throw new FlowError(
        `${failed.length} of ${settled.length} parallel step(s) failed:\n  - ${detail}`
        + (survivors.length > 0 ? `\n  kept: ${survivors.join(', ')} (already written to the ticket; a re-run will overwrite them)` : ''),
      );
    }
    return settled.map((result) => result.status === 'fulfilled' ? result.value : null).find((result) => result !== null) ?? null;
  }

  if (step.gate) {
    const retry = typeof step.retryTarget === 'string' ? step.retryTarget : undefined;
    // Read and not taken: an author-declared gate carries the last decision the run recorded, and
    // what SPENDS it is `askGate` emitting the question — this gate may auto-advance without one.
    const request: GateQuestionEvent = {
      type: 'gate', gateId: context.nextGateId(), kind: String(step.gate),
      reason: String(step.reason ?? step.prompt ?? `${context.flow.name}: approve to advance ticket to "${context.flow.produces}"`),
      ticketDir: context.ticket.dir, ...(retry === undefined ? {} : { retry }), ...reachedBy(context.reached),
    };
    const answer = await askGate(request, context);
    if (answer === 'advance') return null;
    if (answer === 'retry' && retry !== undefined) {
      const counter = String(step.retryCounter);
      const limit = Number(step.retryMax);
      // Guarded as spike/src/engine.js:586 guards it. A step carrying `retryTarget` and no
      // `retryCounter` would otherwise set counters['undefined'] = NaN, which `finish` persists
      // into the ticket's frontmatter for good.
      if (step.retryCounter != null) context.counters[counter] = limit;
      // `step.retryMax` raw, as spike/src/engine.js:587 interpolates it: absent, the spike's line
      // reads `set=undefined` and `Number(undefined)` would make this one read `set=NaN`.
      context.persistence.appendLog(context.ticket, `run=${context.runId} gate=retry counter=${counter} set=${String(step.retryMax)} (one further traversal authorised)`);
      return { goto: retry, counter, limit };
    }
    return { abort: true };
  }
  if (step.type === 'script') return runScript(step, context);
  if (step.type === 'integrate') return runIntegrate(step, context);
  if (step.fan_out) return runFanOut(step, context);
  return runAgentStep(step, context);
}

/**
 * Charges one failed traversal and returns its bounded routing decision or exhaustion answer.
 *
 * The gate it may present carries what **this** step decided and nothing else, which is the half of
 * the slot's rule that differs from an author-declared gate's: that one carries the last decision
 * the run recorded, and this one describes the refusal that reached it. What the two share is that
 * **presenting** a decision spends it, which {@link askGate} does and neither of them does — so a
 * traversal, which asks nothing, leaves the slot exactly as it found it.
 */
export async function handleFail(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  // Read before this function's first await, and carried only where it NAMES the step that is
  // failing. Three call sites reach here and only the agent step's carries a verdict, so without
  // the identity test a script or an integrate failure would present the last verdict-declaring
  // step's decision — one an earlier gate may already have been answered on — as its own. And a
  // `parallel:` sibling finishing while this member waits on the record below would otherwise
  // overwrite the slot between `steps.ts`'s assignment and the question built at the end of this
  // function; nothing between that assignment and this line awaits, and the identity test is what
  // keeps that ordering off the critical path, since an await introduced there makes the question
  // carry nothing rather than a sibling's decision. See Q-0129 AC-5 and AC-6.
  const reached = context.reached?.stepId === String(step.id) ? context.reached : undefined;
  const failure = step.on_fail as Readonly<Record<string, unknown>>;
  const counter = typeof failure.counter === 'string' ? failure.counter : `${String(context.flow.name)}.${String(step.id)}`;
  const limit = Number(failure.max_iterations);
  const target = String(failure.goto);
  const count = (context.counters[counter] ?? 0) + 1;
  context.counters[counter] = count;

  if (count <= limit) {
    context.emit({ type: 'warn', message: `${String(step.id)}: iteration ${count}/${limit} → goto ${target}` });
    return { goto: target, counter, limit };
  }

  // A bound of zero authorises no unattended traversal, so the first failure arrives here and
  // "exhausted" would be a false account of it — nothing looped. The two are the same gate with the
  // same three answers; only the sentence differs, because a reader answering it is owed what
  // actually happened. See Q-0083.
  // The persisted status is `exhausted` for both, deliberately: it is the existing name for *the run
  // stopped at an engine-presented gate having spent its bound*, and a bound of zero is spent by the
  // first failure. What distinguishes them is the SENTENCE below, because a reader answering a gate
  // is owed what actually happened. See Q-0083 erratum E-2.
  const exhausted = limit > 0;
  context.emit({
    type: 'warn',
    message: exhausted
      ? `${String(step.id)}: loop exhausted (${limit}) → human gate`
      : `${String(step.id)}: stopped on its first failure, which is what a bound of zero asks for → human gate`,
  });
  await context.persistence.recordOccurrenceEvent(context.ticket, context.ticket.meta.stage, 'exhausted', 0);
  /** Why: preserved behavior; `on_fail.on_exhausted` remains unread under Q-0050. */
  const request: GateQuestionEvent = {
    type: 'gate', gateId: context.nextGateId(), kind: 'human-locked',
    reason: exhausted
      ? `loop exhausted at ${String(step.id)} (${counter} = ${count}, limit ${limit}); choose: advance (accept as is), retry (exactly one more ${target}), abort`
      : `${String(step.id)} stopped rather than looping (${counter} = ${count}, limit ${limit}); choose: advance (accept its answer and carry on), retry (exactly one more ${target}, for once you have changed what it reads), abort`,
    ticketDir: context.ticket.dir, retry: target, ...reachedBy(reached),
  };
  const answer = await askGate(request, context);
  if (answer === 'advance') return null;
  if (answer === 'retry') {
    context.counters[counter] = limit;
    context.persistence.appendLog(context.ticket, `run=${context.runId} gate=retry counter=${counter} set=${limit} (one further traversal authorised)`);
    return { goto: target, counter, limit };
  }
  return { abort: true };
}
