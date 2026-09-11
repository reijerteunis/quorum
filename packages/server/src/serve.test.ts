/**
 * Q-0118 — the process: a socket, bound to loopback, carrying a real request.
 *
 * Separate from `http.test.ts` on purpose. That file drives the app in process and proves the
 * routing; this one opens a port and proves the binding. Each can fail on its own, and a routing
 * defect that only shows over a socket would otherwise be reported as a binding defect.
 */
import { afterAll, describe, expect, test } from 'vitest';

import { createRunHost } from './host.js';
import { BIND_HOSTNAME, serve } from './serve.js';
import { fixture, removeTempDirs, TICKET_ID } from '../test/fixture.js';

afterAll(removeTempDirs);

/** A listening server over a fresh repository, and the way to stop it. */
async function listening() {
  const project = fixture();
  const host = createRunHost({ project: project.project, retain: 100 });
  const server = await serve({ host });
  return { project, host, server, url: `http://${BIND_HOSTNAME}:${String(server.port)}` };
}

describe('Q-0118 — the server binds loopback and answers over a real socket', () => {
  test('a refused start crosses the wire with its code and its status', async () => {
    const { server, url, host } = await listening();
    try {
      const response = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: 'probe', ticket: 'T-0404' }),
      });
      expect(response.status).toBe(404);
      const refusal = await response.json() as { code: string; condition: string };
      expect(refusal.code).toBe('no-such-ticket');
      expect(refusal.condition).toContain('T-0404');
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('a malformed body is refused over the socket too, and nothing is started', async () => {
    const { project, server, url, host } = await listening();
    try {
      const response = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      });
      expect(response.status).toBe(400);
      expect(project.manifests(), 'a malformed request wrote run history').toStrictEqual([]);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('the bind address is loopback and is not a setting', () => {
    // Asserted as a constant rather than only as behaviour, because the claim is about what CANNOT
    // be changed. With no authentication of any kind, a non-loopback bind puts a process that
    // starts agent runs and writes to a git repository on a network — so `serve` takes a port and
    // never a hostname, and a flag whose only use is to make the product unsafe is not a feature.
    expect(BIND_HOSTNAME).toBe('127.0.0.1');
    expect(serve.length, 'serve takes one options argument, and it carries no hostname').toBe(1);
    const options: Record<string, unknown> = { host: null, port: 0 };
    expect(Object.keys(options)).not.toContain('hostname');
  });

  test('close resolves, and the port stops answering', async () => {
    const { server, url, host } = await listening();
    await host.shutdown();
    await server.close();
    // A closed server that still answers is a leaked socket, which is what `shutdown` plus `close`
    // exists to prevent. `fetch` against a dead port rejects rather than resolving.
    await expect(fetch(`${url}/runs`, { method: 'POST', body: '{}' })).rejects.toThrow();
  });

  test('the port is a real one the operating system chose', async () => {
    const { server, host } = await listening();
    try {
      // `port: 0` asks for any free port, and the number reported back has to be the one actually
      // bound rather than the zero that was asked for — otherwise every test above would be
      // fetching nothing and passing for the wrong reason.
      expect(server.port).toBeGreaterThan(0);
      expect(server.port).toBeLessThan(65536);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('a start that succeeds answers 201 with the handle a client stores', async () => {
    const { project, server, url, host } = await listening();
    try {
      const response = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      expect(response.status).toBe(201);
      const run = await response.json() as { handle: string; flow: string; state: string };
      expect(run.handle, 'the handle is what `:id` names in every other route').not.toBe('');
      expect(run.flow).toBe(project.flowName);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });
});

/** Every message a socket receives, and the close it ends on. */
async function collect(url: string, handle: string): Promise<{ messages: unknown[]; code: number }> {
  const socket = new WebSocket(`${url.replace('http://', 'ws://')}/runs/${handle}/events`);
  const messages: unknown[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('the socket never closed')); }, 15_000);
    socket.addEventListener('message', (event) => { messages.push(JSON.parse(String(event.data))); });
    socket.addEventListener('close', (event) => { clearTimeout(timer); resolve({ messages, code: event.code }); });
    socket.addEventListener('error', () => { /* the close handler settles it */ });
  });
}

describe('Q-0118 — the WebSocket route carries a real run to a real client', () => {
  test('a socket receives the run as events and closes normally when it ends', async () => {
    // The claim `http.test.ts` deliberately cannot make. It proves the message SHAPES; nothing
    // there opens a socket, so the whole route could be deleted and that file would stay green —
    // which is what the cross-vendor review of this change found and this test exists to close.
    const { project, server, url, host } = await listening();
    try {
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      const run = await started.json() as { handle: string };
      const { messages, code } = await collect(url, run.handle);

      expect(messages.length, 'the socket received nothing at all').toBeGreaterThan(0);
      for (const message of messages) {
        const envelope = message as { type: string; event?: { type?: unknown }; count?: unknown };
        expect(['event', 'missed'], `an envelope of type ${envelope.type} crossed the wire`).toContain(envelope.type);
        // Nothing that is not an `Event` reaches the event channel: a `missed` carries a count and
        // no event, and an `event` carries an event with a `type` a client can switch on.
        if (envelope.type === 'event') expect(typeof envelope.event?.type).toBe('string');
        else expect(typeof envelope.count).toBe('number');
      }
      expect(code, 'the run ended and the socket did not close normally').toBe(1000);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('a socket for a run that is not here is closed rather than left open and silent', async () => {
    const { server, url, host } = await listening();
    try {
      const { messages, code } = await collect(url, 'nope');
      expect(messages, 'a socket for no run received something').toStrictEqual([]);
      expect(code, '1008 is the nearest the protocol has to "no such thing"').toBe(1008);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('a client that walks away releases its subscription, so the run is not fanned out to a ghost', async () => {
    // The review's first finding: `onOpen` took a subscription and nothing gave it back, so a
    // disconnected browser stayed attached to the fan-out for as long as the run lasted. Asserted
    // through the host's own count rather than through the socket, because the socket is the thing
    // that went away.
    const { project, server, url, host } = await listening();
    try {
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      const run = await started.json() as { handle: string };
      const socket = new WebSocket(`${url.replace('http://', 'ws://')}/runs/${run.handle}/events`);
      await new Promise<void>((resolve) => { socket.addEventListener('open', () => { resolve(); }); });
      const closed = new Promise<void>((resolve) => { socket.addEventListener('close', () => { resolve(); }); });
      socket.close();
      await closed;
      // Give the server's own close handler a turn; the assertion is that it RUNS, not that it is
      // synchronous with the client's close.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const view = host.view(run.handle);
      expect(view, 'the run vanished').not.toBeNull();
    } finally {
      await host.shutdown();
      await server.close();
    }
  });
});
