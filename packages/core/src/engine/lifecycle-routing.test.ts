import { describe, expect, test, vi } from 'vitest';

import type { Event, Flow, GateQuestionEvent } from '@quorum/shared';

import { askGate, handleFail, runStep } from './routing.js';
import type { RoutingContext } from './types.js';

function context(overrides: Partial<RoutingContext> = {}): RoutingContext {
  const events: Event[] = [];
  const flow = { name: 'f', consumes: 'qa-red', produces: 'development', steps: [] } as unknown as Flow;
  return {
    ticket: { meta: { id: 'Q-X', stage: 'qa-red', iterations: {}, history: [] }, dir: '/ticket', folder: 'Q-X', body: '' },
    flow, repoDir: '/repo', harnessDir: '/harness', config: {}, backlog: {}, runId: 3,
    counters: {}, vars: {}, stats: { cost: 0, tokens: 0, unpriced: 0 }, dry: false, auto: false,
    emit: (event: Event) => events.push(event),
    persistence: { writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(), finaliseActiveOccurrences: vi.fn() },
    loadNamedFlow: vi.fn(() => flow), finishRun: vi.fn(),
    ...overrides,
  } as unknown as RoutingContext;
}

const gate = (extra: Partial<GateQuestionEvent> = {}): GateQuestionEvent => ({
  type: 'gate', gateId: 'g1', kind: 'human', reason: 'decide', ticketDir: '/ticket', ...extra,
});

describe('Q-0050 AC-4 — gate behavior', () => {
  test('queues the correlated question before invoking the answer channel', async () => {
    const observed: Event[] = [];
    const answerGate = vi.fn(async (question: GateQuestionEvent) => {
      expect(observed).toContainEqual(question);
      return { gateId: question.gateId, answer: 'advance' as const };
    });
    const ctx = context({ emit: (event) => observed.push(event), answerGate });
    await expect(askGate(gate(), ctx)).resolves.toBe('advance');
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      type: 'gate', gateId: 'g1', kind: 'human', reason: 'decide', ticketDir: '/ticket',
    });
  });

  test('a later out-of-band answer is awaited and logged before it acts', async () => {
    const answerGate = vi.fn(() => new Promise<{ gateId: string; answer: 'advance' }>((resolve) => {
      setTimeout(() => resolve({ gateId: 'g1', answer: 'advance' }), 20);
    }));
    const ctx = context({ answerGate });
    await expect(askGate(gate(), ctx)).resolves.toBe('advance');
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, expect.stringContaining('answer=advance'));
  });

  test('no channel, stale correlation and invalid runtime answers fail by name', async () => {
    await expect(askGate(gate(), context())).rejects.toThrow(/human|decide/);
    await expect(askGate(gate(), context({ answerGate: async () => ({ gateId: 'stale', answer: 'advance' }) })))
      .rejects.toThrow(/g1|stale/);
    const invalid = async () => ({ gateId: 'g1', answer: 'undecided' });
    await expect(askGate(gate(), context({ answerGate: invalid as unknown as RoutingContext['answerGate'] })))
      .rejects.toThrow(/g1/);
  });

  test('dry and auto do not consume answers; human-locked still does', async () => {
    const answerGate = vi.fn(async () => ({ gateId: 'g1', answer: 'advance' as const }));
    await expect(askGate(gate(), context({ dry: true, answerGate }))).resolves.toBe('advance');
    await expect(askGate(gate({ kind: 'auto' }), context({ answerGate }))).resolves.toBe('advance');
    expect(answerGate).not.toHaveBeenCalled();
    await askGate(gate({ kind: 'human-locked' }), context({ auto: true, answerGate }));
    expect(answerGate).toHaveBeenCalledTimes(1);
  });

  test('a pending gate is interrupted and a late answer is not applied', async () => {
    const abort = new AbortController();
    let answer!: (value: { gateId: string; answer: 'advance' }) => void;
    const answerGate = vi.fn(() => new Promise<{ gateId: string; answer: 'advance' }>((resolve) => { answer = resolve; }));
    const pending = expect(askGate(gate(), context({ answerGate, signal: abort.signal }))).rejects.toThrow(/interrupt|abort/i);
    abort.abort();
    await pending;
    answer({ gateId: 'g1', answer: 'advance' });
    expect(answerGate).toHaveBeenCalledTimes(1);
  });
});

describe('Q-0050 AC-6/AC-7/AC-8 — failure routing', () => {
  test('bounded loop increments only its counter and exhausts at its limit', async () => {
    const ctx = context({ counters: { sibling: 9 } });
    const step = { id: 'review', on_fail: { goto: 'implement', max_iterations: 2 } };
    await expect(handleFail(step, ctx)).resolves.toStrictEqual({ goto: 'implement', counter: 'f.review', limit: 2 });
    expect(ctx.counters).toStrictEqual({ sibling: 9, 'f.review': 1 });
  });

  test('exhaustion records the spend, asks a locked gate, and advance changes no counter', async () => {
    const events: Event[] = [];
    const answerGate = vi.fn(async (question: GateQuestionEvent) => ({ gateId: question.gateId, answer: 'advance' as const }));
    const ctx = context({ counters: { sibling: 9, 'f.review': 2 }, emit: (event) => events.push(event), answerGate });
    await expect(handleFail({ id: 'review', on_fail: { goto: 'implement', max_iterations: 2 } }, ctx)).resolves.toBeNull();
    expect(ctx.counters).toStrictEqual({ sibling: 9, 'f.review': 3 });
    expect(ctx.persistence.recordOccurrenceEvent).toHaveBeenCalledWith(ctx.ticket, 'qa-red', 'exhausted', 0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'gate', kind: 'human-locked', retry: 'implement' }));
  });

  test('retry sets only the exhausted counter to the limit and logs the one-traversal grant', async () => {
    const answerGate = vi.fn(async (question: GateQuestionEvent) => ({ gateId: question.gateId, answer: 'retry' as const }));
    const ctx = context({ counters: { sibling: 9, 'f.review': 2 }, answerGate });
    await expect(handleFail({ id: 'review', on_fail: { goto: 'implement', max_iterations: 2 } }, ctx))
      .resolves.toStrictEqual({ goto: 'implement', counter: 'f.review', limit: 2 });
    expect(ctx.counters).toStrictEqual({ sibling: 9, 'f.review': 2 });
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, 'run=3 gate=retry counter=f.review set=2 (one further traversal authorised)');
  });

  test('retry at an author gate without a target aborts', async () => {
    const answerGate = vi.fn(async (question: GateQuestionEvent) => ({ gateId: question.gateId, answer: 'retry' as const }));
    await expect(runStep({ id: 'approval', gate: 'human', reason: 'approve' }, context({ answerGate })))
      .resolves.toStrictEqual({ abort: true });
  });

  test('cross-flow returns a routing decision without running the target flow', async () => {
    const target = { name: 'other', consumes: 'requirements', produces: 'qa-red', steps: [{ id: 'never' }] } as unknown as Flow;
    const ctx = context({ loadNamedFlow: vi.fn(() => target) });
    await expect(handleFail({ id: 'x', on_fail: { goto: 'flow:other' } }, ctx))
      .resolves.toMatchObject({ goto: 'flow:other' });
    expect(ctx.finishRun).not.toHaveBeenCalled();
  });
});
