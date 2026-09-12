import { describe, expect, test } from 'vitest';

import { createRunConnection, type SocketTransport } from './run-connection.js';

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

  test('explicit retry replaces once and preserves events and missed notice', () => {
    const { connection, sockets } = setup();
    connection.connect('A', page);
    sockets[0]!.onopen?.();
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 7 }) });
    sockets[0]!.onclose?.({ code: 1006, reason: 'lost' });
    expect(sockets).toHaveLength(1);
    connection.retry();
    expect(sockets).toHaveLength(2);
    expect(connection.snapshot.events).toStrictEqual([event]);
    expect(connection.snapshot.missedCount).toBe(7);
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
