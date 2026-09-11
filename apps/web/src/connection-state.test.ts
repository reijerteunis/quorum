import { describe, expect, test } from 'vitest';

import { canRetry, connectionStateText, reduceConnection, type ConnectionMachine, type ConnectionState } from './connection-state.js';

const idle: ConnectionMachine = { state: { kind: 'idle' }, opened: false, terminalSeen: false };
const url = `${'w' + 's' + ':'}${'/' + '/'}page.test/runs/one/events`;
const step = { type: 'step', stepId: 'implement', message: 'go' } as const;
const terminal = { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' } as const;

describe('AC-15 — closed connection state machine', () => {
  test('moves idle to connecting to live', () => {
    const connecting = reduceConnection(idle, { type: 'connect', requestedUrl: url });
    expect(connecting.state).toStrictEqual({ kind: 'connecting', requestedUrl: url });
    expect(reduceConnection(connecting, { type: 'open' }).state).toStrictEqual({ kind: 'live', requestedUrl: url });
  });

  test.each([[1008, 'no-such-run'], [1013, 'dropped']] as const)('gives close %s precedence', (code, kind) => {
    const live: ConnectionMachine = { state: { kind: 'live', requestedUrl: url }, opened: true, terminalSeen: false };
    expect(reduceConnection(live, { type: 'close', code, reason: 'browser reason' }).state.kind).toBe(kind);
  });

  test('only a normal close after a terminal event is ended', () => {
    const live: ConnectionMachine = { state: { kind: 'live', requestedUrl: url }, opened: true, terminalSeen: false };
    const seen = reduceConnection(reduceConnection(live, { type: 'event', event: step }), { type: 'event', event: terminal });
    expect(reduceConnection(seen, { type: 'close', code: 1000, reason: '' }).state).toStrictEqual({ kind: 'ended' });
    expect(reduceConnection(live, { type: 'close', code: 1000, reason: 'clean' }).state).toStrictEqual({ kind: 'interrupted', code: 1000, reason: 'clean' });
  });

  test('failure before open names no-daemon and protocol refusal is explicit', () => {
    const connecting = reduceConnection(idle, { type: 'connect', requestedUrl: url });
    expect(reduceConnection(connecting, { type: 'error-before-open' }).state).toStrictEqual({ kind: 'no-daemon', requestedUrl: url });
    expect(reduceConnection({ ...connecting, opened: true }, { type: 'protocol-error', refusal: 'invalid-json' }).state)
      .toStrictEqual({ kind: 'protocol-error', refusal: 'invalid-json' });
  });

  test('no-daemon and no-such-run render differently and every failure is retryable', () => {
    const absent: ConnectionState = { kind: 'no-daemon', requestedUrl: url };
    const wrong: ConnectionState = { kind: 'no-such-run' };
    expect(connectionStateText(absent)).toContain(url);
    expect(connectionStateText(absent)).not.toBe(connectionStateText(wrong));
    for (const state of [absent, wrong, { kind: 'interrupted', code: 1006, reason: 'lost' }, { kind: 'dropped' }, { kind: 'protocol-error', refusal: 'bad' }] as ConnectionState[]) expect(canRetry(state)).toBe(true);
  });
});
