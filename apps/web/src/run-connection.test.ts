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
    first.onmessage?.({ data: JSON.stringify({ type: 'event', event }) });
    first.onerror?.();
    expect(connection.snapshot).toStrictEqual(before);
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
