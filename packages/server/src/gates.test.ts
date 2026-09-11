/**
 * Q-0013 AC-9 and AC-10 — the registry's own properties, over questions this file asks.
 *
 * The engine half is `host.test.ts`'s: that a real gate is reached, that `advance` lets the run
 * carry on, and that a refused answer leaves it waiting. What is here is the arithmetic under it —
 * exactly one settlement per gate, the four refusals, and the fact that two runs can hold the same
 * correlation id without either being able to answer the other's.
 */
import { describe, expect, test } from 'vitest';

import type { GateQuestionEvent } from '@quorum/shared';

import { createGateRegistry } from './gates.js';

/** One gate question, as `routing.ts` composes it. `gateId` is opaque and is never parsed. */
const question = (gateId: string): GateQuestionEvent => ({
  type: 'gate', gateId, kind: 'human', reason: 'approve to advance', ticketDir: '/nowhere/T-0001',
});

describe('AC-9 — exactly one answer per pending gate, and everything else refused here', () => {
  test('a valid answer settles the waiting promise in the envelope core validates', async () => {
    const registry = createGateRegistry();
    const waiting = registry.channelFor('run-1')(question('1:1'));

    expect(registry.answer('run-1', { gateId: '1:1', answer: 'advance' })).toBeNull();

    expect(await waiting).toStrictEqual({ gateId: '1:1', answer: 'advance' });
  });

  test('a second answer for one gate is refused, and the first is the one that settled', async () => {
    const registry = createGateRegistry();
    const waiting = registry.channelFor('run-1')(question('1:1'));

    expect(registry.answer('run-1', { gateId: '1:1', answer: 'retry' })).toBeNull();
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'abort' })).toBe('no-such-gate');

    expect(await waiting).toStrictEqual({ gateId: '1:1', answer: 'retry' });
  });

  test('two answers issued in one turn produce exactly one settlement', async () => {
    // No await between the delete and the settle, which is what makes this a property rather than
    // a hope: the second call cannot interleave into the window, because there is no window.
    const registry = createGateRegistry();
    const waiting = registry.channelFor('run-1')(question('1:1'));

    const outcomes = [
      registry.answer('run-1', { gateId: '1:1', answer: 'advance' }),
      registry.answer('run-1', { gateId: '1:1', answer: 'abort' }),
    ];

    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    expect(await waiting).toStrictEqual({ gateId: '1:1', answer: 'advance' });
  });

  test('an unknown gate, a malformed envelope and a word outside the three are each refused', () => {
    const registry = createGateRegistry();
    registry.channelFor('run-1')(question('1:1')).catch(() => { /* never settled here */ });

    expect(registry.answer('run-1', { gateId: '9:9', answer: 'advance' })).toBe('no-such-gate');
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'yes' })).toBe('not-an-answer');
    expect(registry.answer('run-1', { gateId: '1:1' })).toBe('not-an-answer');
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'advance', reason: 'because' })).toBe('not-an-answer');
    expect(registry.answer('run-1', 'advance')).toBe('not-an-answer');
    expect(registry.answer('run-1', null)).toBe('not-an-answer');
    // And every refusal left the gate exactly where it was.
    expect(registry.pending('run-1').map((gate) => gate.gateId)).toStrictEqual(['1:1']);
  });

  test('a gate belonging to another run is named as that, and neither run is disturbed', async () => {
    // A correlation id is unique within a run and not across runs — `nextGateId` spells
    // `<run number>:<n>`, so two tickets each on their first run both ask `1:1`. Keyed by run and
    // then by gate, so answering one run with another's id settles nothing.
    const registry = createGateRegistry();
    const one = registry.channelFor('run-1')(question('1:1'));
    const two = registry.channelFor('run-2')(question('2:1'));

    expect(registry.answer('run-1', { gateId: '2:1', answer: 'advance' })).toBe('not-this-run');
    expect(registry.answer('run-2', { gateId: '1:1', answer: 'advance' })).toBe('not-this-run');

    expect(registry.pending('run-1')).toHaveLength(1);
    expect(registry.pending('run-2')).toHaveLength(1);
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'advance' })).toBeNull();
    expect(registry.answer('run-2', { gateId: '2:1', answer: 'abort' })).toBeNull();
    expect(await one).toStrictEqual({ gateId: '1:1', answer: 'advance' });
    expect(await two).toStrictEqual({ gateId: '2:1', answer: 'abort' });
  });

  test('two runs may hold the same correlation id, and each answers only its own', async () => {
    const registry = createGateRegistry();
    const one = registry.channelFor('run-1')(question('1:1'));
    const two = registry.channelFor('run-2')(question('1:1'));

    expect(registry.answer('run-2', { gateId: '1:1', answer: 'abort' })).toBeNull();

    expect(await two).toStrictEqual({ gateId: '1:1', answer: 'abort' });
    expect(registry.pending('run-1')).toHaveLength(1);
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'advance' })).toBeNull();
    expect(await one).toStrictEqual({ gateId: '1:1', answer: 'advance' });
  });

  test('a released run answers nothing further, and settles nothing on the way out', () => {
    // Releasing does not settle: `askGate` raced each pending promise against the run's own
    // cancellation and the race is over by the time a run ends, so resolving one now would record
    // an answer nobody gave.
    const registry = createGateRegistry();
    let settled = false;
    void registry.channelFor('run-1')(question('1:1')).then(() => { settled = true; });

    registry.release('run-1');

    expect(registry.pending('run-1')).toStrictEqual([]);
    expect(registry.answer('run-1', { gateId: '1:1', answer: 'advance' })).toBe('no-such-gate');
    expect(settled).toBe(false);
  });

  test('pending reports the questions in the order they were asked', () => {
    const registry = createGateRegistry();
    const channel = registry.channelFor('run-1');
    void channel(question('1:1'));
    void channel(question('1:2'));

    expect(registry.pending('run-1').map((gate) => gate.gateId)).toStrictEqual(['1:1', '1:2']);
    expect(registry.pending('run-9')).toStrictEqual([]);
  });
});

describe('AC-10 — a run this registry serves always has an answer channel', () => {
  test('the channel is a function per run, so no run is started with no way to ask', () => {
    // `GateUnansweredCondition`'s `no-answer-channel` is what a caller that supplied no
    // `answerGate` reaches. A host that hands `channelFor(handle)` to every run it starts cannot,
    // and a subscriber going away is not nobody having been there.
    const registry = createGateRegistry();
    expect(typeof registry.channelFor('run-1')).toBe('function');
    expect(typeof registry.channelFor('run-2')).toBe('function');
  });
});
