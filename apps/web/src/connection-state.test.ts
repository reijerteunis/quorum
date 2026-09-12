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

  test('gives a 1008 refusal precedence even after a terminal event', () => {
    const live: ConnectionMachine = { state: { kind: 'live', requestedUrl: url }, opened: true, terminalSeen: false };
    const terminalSeen = reduceConnection(live, { type: 'event', event: terminal });
    expect(reduceConnection(terminalSeen, { type: 'close', code: 1008, reason: 'unknown run' }).state)
      .toStrictEqual({ kind: 'no-such-run' });
  });

  // Named for what it checks. It was called "only a normal close after a terminal event is ended"
  // and asserted neither half of that "only" — a name claiming a property the test does not check is
  // this repository's most-recorded class. The reducer's actual rule is ANY close after a terminal
  // event, and that is deliberate rather than a gap: a terminal event means the stream completed, so
  // a 1006 after it lost nothing and "The run has finished." is true, while `interrupted` would
  // imply an incomplete trace. 1008 and 1013 still win, being about the connection rather than the
  // run. Q-0120 review round 2, N-1; round 1 adjudicated the same line as N-2.
  test('any close after a terminal event is ended, and 1008 and 1013 still take precedence', () => {
    const live: ConnectionMachine = { state: { kind: 'live', requestedUrl: url }, opened: true, terminalSeen: false };
    const seen = reduceConnection(reduceConnection(live, { type: 'event', event: step }), { type: 'event', event: terminal });
    expect(reduceConnection(seen, { type: 'close', code: 1000, reason: '' }).state).toStrictEqual({ kind: 'ended' });
    // The half the old name claimed and did not check, in the direction the reducer actually takes.
    expect(reduceConnection(seen, { type: 'close', code: 1006, reason: 'lost' }).state).toStrictEqual({ kind: 'ended' });
    // And the two codes that outrank a terminal event, because they describe the connection rather
    // than the run: a wrong handle and a subscriber that fell behind.
    expect(reduceConnection(seen, { type: 'close', code: 1008, reason: '' }).state).toStrictEqual({ kind: 'no-such-run' });
    expect(reduceConnection(seen, { type: 'close', code: 1013, reason: '' }).state).toStrictEqual({ kind: 'dropped' });
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
    // And the other direction, which nothing asserted: `canRetry = () => true` passed this file and
    // the whole suite, because a Retry control only adds the word to the header and no assertion
    // forbade it. The consequence is not theoretical — a Retry offered while `live` tears down a
    // healthy socket and re-accumulates the replayed prefix. Q-0120 review round 2, N-5.
    for (const state of [{ kind: 'idle' }, { kind: 'connecting', requestedUrl: url }, { kind: 'live', requestedUrl: url }, { kind: 'ended' }] as ConnectionState[]) {
      expect(canRetry(state), `${state.kind} must not offer retry`).toBe(false);
    }
  });
});
