import { describe, expect, test } from 'vitest';

import { createRunConnection, RUN_EVENT_RETENTION, type SocketTransport } from './run-connection.js';

class FakeSocket implements SocketTransport {
  onopen: (() => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;
  closes = 0;
  close(): void { this.closes += 1; }
}

const setup = () => {
  const sockets: FakeSocket[] = [];
  const urls: URL[] = [];
  const connection = createRunConnection((url) => { urls.push(url); const socket = new FakeSocket(); sockets.push(socket); return socket; });
  return { connection, sockets, urls };
};
const page = new URL(`https:${'/' + '/'}page.test/app`);
const event = { type: 'step', stepId: 'implement', message: 'go' };
const terminalEvent = { type: 'terminal', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0, status: 'completed' };

describe('AC-16 to AC-18 — owned socket lifecycle', () => {
  test('a fresh controller starts empty even after an earlier controller was disposed', () => {
    const first = setup();
    first.connection.connect('A', page);
    first.sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    first.sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 7 }) });
    first.connection.dispose();

    const second = setup();
    second.connection.connect('A', page);
    expect(second.connection.snapshot.events).toStrictEqual([]);
    expect(second.connection.snapshot.missedCount).toBeNull();
  });

  test('connect opens one socket; replacement closes it and invalidates late callbacks', () => {
    const { connection, sockets, urls } = setup();
    connection.connect('A', page);
    expect(sockets).toHaveLength(1);
    const first = sockets[0]!;
    connection.connect('B', page);
    expect(first.closes).toBe(1);
    expect(sockets).toHaveLength(2);
    expect(urls[1]!.pathname).toContain('/B/events');
    const before = connection.snapshot;
    first.onopen?.();
    first.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    first.onerror?.();
    first.onclose?.({ code: 1013, reason: 'late close' });
    expect(connection.snapshot).toStrictEqual(before);
  });

  // AC-17 names three cases — superseded, closed or disposed — and only this one, a socket that
  // closed ON ITS OWN, was reachable by no test: the case above drives late callbacks after a
  // REPLACEMENT, and `dispose()` has its own. A natural close left `socket === next` true, so a
  // later message appended an event and a later close overwrote the rendered state. The fake
  // transport is the only place this is reachable at all — a real WebSocket delivers nothing after
  // close — which is why the invariant could be unmet without the browser ever showing it.
  // Q-0120 review round 2, M-2.
  test('a socket that closed on its own is inert, and its late callbacks change nothing', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    const only = sockets[0]!;
    only.onopen?.();
    only.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    only.onclose?.({ code: 1000, reason: '' });
    const afterClose = connection.snapshot;
    expect(afterClose.state.kind, 'a normal close after a terminal-less run').toBe('interrupted');

    only.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    only.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 9 }) });
    only.onerror?.();
    only.onclose?.({ code: 1013, reason: 'later still' });
    expect(connection.snapshot).toStrictEqual(afterClose);
    // And it is inert by detachment rather than only by the identity guard, so a transport that
    // ignores the null assignment cannot reach this controller either.
    expect(only.onmessage, 'the handlers are still attached to a closed socket').toBeNull();
    // No second close was issued: invalidating is not closing again.
    expect(only.closes, 'the controller closed a socket that had already closed').toBe(0);
  });

  // M-4: a refused frame must end the socket, or the refusal is erased by whatever happens next.
  test('a protocol error closes its socket, and nothing after it can erase the refusal', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    const only = sockets[0]!;
    only.onopen?.();
    only.onmessage?.({ data: 'not json at all {' });
    expect(connection.snapshot.state.kind).toBe('protocol-error');
    expect(only.closes, 'a refused frame left its socket open').toBe(1);
    // The case that made it matter: a terminal event then a normal close used to take the
    // `terminalSeen` branch and report the run as simply finished.
    only.onmessage?.({ data: JSON.stringify({ type: 'event', event: terminalEvent }) });
    only.onclose?.({ code: 1000, reason: '' });
    expect(connection.snapshot.state.kind, 'a later close erased the protocol error').toBe('protocol-error');
    expect(connection.snapshot.events, 'a frame was accepted after the refusal').toHaveLength(0);
  });

  test('missed counts are retained as notices, replace one another, and are never events', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 0 }) });
    expect(connection.snapshot.missedCount).toBe(0);
    expect(connection.snapshot.events).toHaveLength(0);
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 7 }) });
    expect(connection.snapshot.missedCount).toBe(7);
    expect(connection.snapshot.events).toHaveLength(0);
  });

  test('parse refusal reaches protocol-error and never reconnects automatically', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    sockets[0]!.onopen?.();
    sockets[0]!.onmessage?.({ data: 'not json {' });
    expect(connection.snapshot.state.kind).toBe('protocol-error');
    expect(sockets).toHaveLength(1);
  });

  // **Inverted at Q-0015 rather than deleted, and the reason is recorded where the pin is.** Q-0120
  // chose to preserve the accepted tail across a retry — the browser genuinely observed those events
  // and the daemon retains only 500, so clearing loses a head it can no longer replay. Q-0015 is the
  // first ticket to RENDER that tail, and rendering is what made the other half visible: the daemon
  // replays its retained buffer to every new subscription, so preserving means every retained event
  // appears twice. The events carry no identity to dedupe on, the union having no timestamp and no
  // sequence number by decision (2026-08-28), so the choice is a doubled trace or a shorter true one.
  // A doubled trace asserts events that did not happen, which is the one thing this app may never do;
  // the loss is charged to `browserDiscardedCount`, whose sentence already renders, so it is
  // disclosed rather than silent. See `requirements/errata.md` E-11. Review round 3, M-1.
  test('explicit retry replaces once, and clears the tail the daemon will replay', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    sockets[0]!.onopen?.();
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 7 }) });
    sockets[0]!.onclose?.({ code: 1006, reason: 'lost' });
    expect(sockets).toHaveLength(1);
    connection.retry();
    expect(sockets).toHaveLength(2);
    expect(connection.snapshot.events, 'the retained tail survived a retry the daemon will replay').toStrictEqual([]);
    expect(connection.snapshot.missedCount, "the daemon's missed count outlived the subscription it described").toBeNull();
    expect(connection.snapshot.browserDiscardedCount, 'what the retry dropped was not disclosed').toBe(1);
  });

  test('rapid repeated retry leaves only its newest socket current', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    sockets[0]!.onopen?.();
    sockets[0]!.onclose?.({ code: 1006, reason: 'lost' });
    connection.retry();
    connection.retry();
    expect(sockets).toHaveLength(3);
    expect(sockets[1]!.closes).toBe(1);
    const before = connection.snapshot;
    sockets[1]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    expect(connection.snapshot).toStrictEqual(before);
  });

  test('dispose is idempotent and opens nothing afterward', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    connection.dispose();
    connection.dispose();
    expect(sockets[0]!.closes).toBe(1);
    expect(sockets).toHaveLength(1);
  });
});

describe('Q-0015 AC-9/10 — bounded immutable event retention', () => {
  test('retains exactly the newest 500 and counts every browser eviction', () => {
    const { connection, sockets } = setup(); connection.connect('A', page);
    for (let i = 0; i < 700; i += 1) sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event: { type: 'step', stepId: String(i), message: String(i) } }) });
    expect(connection.snapshot.events).toHaveLength(RUN_EVENT_RETENTION);
    expect(connection.snapshot.events[0]).toMatchObject({ stepId: '200' });
    expect(connection.snapshot.browserDiscardedCount).toBe(200);
  });

  test('does not mutate an earlier snapshot and resets both counters on retarget', () => {
    const { connection, sockets } = setup(); connection.connect('A', page);
    for (let i = 0; i < RUN_EVENT_RETENTION; i += 1) sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    const before = connection.snapshot; const copy = [...before.events];
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 7 }) });
    expect(before.events).toStrictEqual(copy);
    expect(connection.snapshot).toMatchObject({ missedCount: 7, browserDiscardedCount: 1 });
    connection.connect('B', page);
    expect(connection.snapshot).toMatchObject({ missedCount: null, browserDiscardedCount: null });
  });
});
