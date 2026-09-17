import { describe, expect, test } from 'vitest';
import type { Event } from '@quorum/shared';
import { buildStepTimeline, partitionTrace } from './mission-control-model.js';

const step = (stepId: string): Event => ({ type: 'step', stepId, message: `start ${stepId}` });
const done = (stepId: string): Event => ({ type: 'done', stepId, message: `done ${stepId}` });
const terminal: Event = { type: 'terminal', runId: 42, stageBefore: 'a', stageAfter: 'b', cost: 1, tokens: 2, status: 'completed' };

describe('Q-0015 AC-4/5/6 — lossless trace projection', () => {
  test('groups alternating exact ids in first-appearance and arrival order', () => {
    const events: Event[] = [step('b'), step('a'), done('b'), done('a')];
    const result = partitionTrace(events);
    expect(result.columns.map((c) => c.stepId)).toStrictEqual(['b', 'a']);
    expect(result.columns.map((c) => c.events.map((e) => e.type))).toStrictEqual([['step', 'done'], ['step', 'done']]);
  });

  test('does not reinterpret an exact literal undefined id', () => {
    expect(partitionTrace([step('undefined'), done('undefined')]).columns).toHaveLength(1);
  });

  test('keeps id-less events and prefixed prose in run activity without loss', () => {
    const events: Event[] = [
      { type: 'info', message: 'dev:T-0001.1: hello' }, { type: 'warn', message: 'warn' },
      { type: 'gate', gateId: 'g', kind: 'human', reason: 'why', ticketDir: ['', 'tmp', 't'].join('/') }, terminal, step('x'),
    ];
    const result = partitionTrace(events);
    expect(result.runActivity.map((e) => e.type)).toStrictEqual(['info', 'warn', 'gate', 'terminal']);
    expect(result.runActivity.length + result.columns.reduce((n, c) => n + c.events.length, 0)).toBe(events.length);
  });

  test('uses the latest spawn or retry vendor', () => {
    const events: Event[] = [
      { type: 'spawn', stepId: 'x', vendor: 'codex', cmd: 'go' },
      { type: 'retry', stepId: 'x', vendor: 'claude', attempt: 2, of: 3, delayMs: 1, reason: 'drop', message: 'retry' },
    ];
    expect(partitionTrace(events).columns[0]?.vendor).toBe('claude');
  });
});

describe('Q-0015 AC-7 — observed-only timeline', () => {
  test('distinguishes starts, ends, terminal-unmatched starts, and evicted starts', () => {
    expect(buildStepTimeline([step('a')])[0]).toMatchObject({ disposition: 'started', runEnded: false });
    expect(buildStepTimeline([step('a'), done('a')])[0]).toMatchObject({ disposition: 'ended', doneMessage: 'done a' });
    expect(buildStepTimeline([step('a'), terminal])[0]).toMatchObject({ disposition: 'started-with-no-end-reported', runEnded: true });
    expect(buildStepTimeline([done('a')])[0]).toMatchObject({ disposition: 'ended' });
  });

  test('does not invent a row for run-level fan-out narration', () => {
    expect(buildStepTimeline([{ type: 'info', message: 'fan out' }, { type: 'warn', message: 'parent' }])).toStrictEqual([]);
  });
});
