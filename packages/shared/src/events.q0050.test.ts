import { describe, expect, test } from 'vitest';

import {
  eventSchema, gateAnswerEnvelopeSchema, gateAnswerSchema, runTerminalEventSchema,
} from './events.js';

const base = {
  type: 'terminal', runId: 7, stageBefore: 'qa-red', stageAfter: 'development',
  cost: 1.25, tokens: 42,
} as const;

describe('Q-0050 AC-2e/AC-3c/AC-3d — strict run-event schemas', () => {
  test('all eight event kinds accept only their declared keys', () => {
    const events = [
      { type: 'spawn', stepId: 's', vendor: 'mock', cmd: 'mock' },
      { type: 'stdout', stepId: 's', line: 'one' },
      { type: 'retry', stepId: 's', vendor: 'mock', attempt: 1, of: 2, delayMs: 0, reason: 'busy', message: 'retrying' },
      { type: 'step', stepId: 's', message: 'start' },
      { type: 'done', stepId: 's', message: 'done' },
      { type: 'info', message: 'info' },
      { type: 'warn', message: 'warn' },
      { type: 'gate', gateId: 'g1', kind: 'human', reason: 'decide', ticketDir: '/ticket' },
      { ...base, status: 'completed' },
    ];
    for (const event of events) {
      expect(eventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
      expect(eventSchema.safeParse({ ...event, timestamp: 1 }).success).toBe(false);
    }
  });

  test('regression fields form one mandatory group and are forbidden otherwise', () => {
    const regression = {
      ...base, status: 'regressed', targetFlow: 'qa-red', counter: 'f.s', count: 2,
      limit: 2, remaining: 0,
    } as const;
    expect(runTerminalEventSchema.parse(regression)).toStrictEqual(regression);
    expect(runTerminalEventSchema.safeParse({ ...regression, remaining: undefined }).success).toBe(false);
    expect(runTerminalEventSchema.safeParse({ ...base, status: 'completed', counter: 'f.s' }).success).toBe(false);
    expect(runTerminalEventSchema.safeParse({ ...base, status: 'completed', surprise: true }).success).toBe(false);
  });
});

describe('Q-0050 AC-4c/AC-4d — correlated closed gate answers', () => {
  test('the answer union is closed and every answer has a correlation id', () => {
    for (const answer of ['advance', 'retry', 'abort']) expect(gateAnswerSchema.parse(answer)).toBe(answer);
    expect(gateAnswerSchema.safeParse('undecided').success).toBe(false);
    expect(gateAnswerEnvelopeSchema.parse({ gateId: 'g1', answer: 'advance' }))
      .toStrictEqual({ gateId: 'g1', answer: 'advance' });
    expect(gateAnswerEnvelopeSchema.safeParse({ answer: 'advance' }).success).toBe(false);
    expect(gateAnswerEnvelopeSchema.safeParse({ gateId: 'g1', answer: 'advance', extra: 1 }).success).toBe(false);
  });
});
