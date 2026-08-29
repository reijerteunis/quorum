/** Gate policy, step dispatch, and bounded backward-edge decisions for one running flow. */
import { gateAnswerEnvelopeSchema, type GateQuestionEvent } from '@quorum/shared';

import { FlowError, type RoutingContext, type StepResult } from './types.js';

function interruptedGate(request: GateQuestionEvent): FlowError {
  return new FlowError(`gate ${request.kind} (${request.reason}) interrupted`);
}

/** Publishes one correlated question and validates the caller's out-of-band answer. */
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
  if (!context.answerGate) throw new FlowError(`gate ${request.kind} (${request.reason}) has no answer channel`);

  const signalWindow = setTimeout(() => {}, 1000); // Why: preserved defect, see Q-0050 AC-4.
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
    clearTimeout(signalWindow);
  }
}

function unavailableStep(step: Readonly<Record<string, unknown>>, owner: string): Promise<StepResult> {
  return Promise.reject(new FlowError(`${String(step.id ?? 'step')}: execution belongs to ${owner}`));
}

async function runAgentStep(step: Readonly<Record<string, unknown>>): Promise<StepResult> {
  return unavailableStep(step, 'Q-0052');
}

/** Dispatches a step in spike order without taking ownership of the engine's cursor. */
export async function runStep(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
  if (step.parallel) {
    const members = step.parallel as ReadonlyArray<Readonly<Record<string, unknown>>>;
    // Why: preserved defect, see Q-0050 AC-12.
    const settled = await Promise.allSettled(members.map((member) => runAgentStep(member)));
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
    const request: GateQuestionEvent = {
      type: 'gate', gateId: context.nextGateId(), kind: String(step.gate),
      reason: String(step.reason ?? step.prompt ?? `${context.flow.name}: approve to advance ticket to "${context.flow.produces}"`),
      ticketDir: context.ticket.dir, ...(retry === undefined ? {} : { retry }),
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
  if (step.type === 'script') return unavailableStep(step, 'Q-0052');
  if (step.type === 'integrate') return unavailableStep(step, 'Q-0053');
  if (step.fan_out) return unavailableStep(step, 'Q-0053');
  return runAgentStep(step);
}

/** Charges one failed traversal and returns its bounded routing decision or exhaustion answer. */
export async function handleFail(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult> {
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

  context.emit({ type: 'warn', message: `${String(step.id)}: loop exhausted (${limit}) → human gate` });
  await context.persistence.recordOccurrenceEvent(context.ticket, context.ticket.meta.stage, 'exhausted', 0);
  /** Why: preserved behavior; `on_fail.on_exhausted` remains unread under Q-0050. */
  const request: GateQuestionEvent = {
    type: 'gate', gateId: context.nextGateId(), kind: 'human-locked',
    reason: `loop exhausted at ${String(step.id)} (${counter} = ${count}, limit ${limit}); choose: advance (accept as is), retry (exactly one more ${target}), abort`,
    ticketDir: context.ticket.dir, retry: target,
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
