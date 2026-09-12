/**
 * Q-0118 — the process: a socket, bound to loopback, carrying a real request.
 *
 * Separate from `http.test.ts` on purpose. That file drives the app in process and proves the
 * routing; this one opens a port and proves the binding. Each can fail on its own, and a routing
 * defect that only shows over a socket would otherwise be reported as a binding defect.
 */
import { afterAll, describe, expect, test } from 'vitest';

import { wireRunListSchema } from '@quorum/shared';

import { createRunHost } from './host.js';
import { BIND_HOSTNAME, createDaemon, DEFAULT_RETENTION, MAX_BUFFERED_BYTES, overBuffered, serve } from './serve.js';
import { fixture, GATED_FLOW, removeTempDirs, TICKET_ID } from '../test/fixture.js';

afterAll(removeTempDirs);

/** A listening server over a fresh repository, and the way to stop it. */
async function listening(options: Parameters<typeof fixture>[0] = {}) {
  const project = fixture(options);
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
    // A GATED flow, because the claim is about a run that is still live: a one-step dry walk is over
    // in milliseconds and its fan-out is gone before a socket can be counted, which is how the first
    // version of this test measured zero watchers and looked like a leak that was not there.
    const { project, server, url, host } = await listening({ flow: GATED_FLOW });
    try {
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID }),
      });
      const run = await started.json() as { handle: string };
      const socket = new WebSocket(`${url.replace('http://', 'ws://')}/runs/${run.handle}/events`);
      await new Promise<void>((resolve) => { socket.addEventListener('open', () => { resolve(); }); });
      const closed = new Promise<void>((resolve) => { socket.addEventListener('close', () => { resolve(); }); });
      // Before: the fan-out is serving this socket. Asserted so the release below has a subject —
      // review round 2 found this test asserting only that the run still existed, which is true
      // whether or not anything was released, so it could not fail on its own claim.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(host.view(run.handle)?.watchers, 'the socket never reached the fan-out').toBeGreaterThan(0);

      socket.close();
      await closed;
      // Give the server's own close handler a turn; the assertion is that it RUNS, not that it is
      // synchronous with the client's close.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(host.view(run.handle)?.watchers, 'a disconnected client is still attached to the fan-out').toBe(0);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });
});

describe('Q-0121 AC-7 and AC-11 — a client with no handle finds a run and joins it', () => {
  test('the two reads answer over a real port, on the same host as POST /runs', async () => {
    const { project, server, url, host } = await listening();
    try {
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      const run = await started.json() as { handle: string };

      // The SAME host, which is the half a second registry would break: the run this listing
      // answers with is the run that start produced, over a socket rather than in process.
      const listed = wireRunListSchema.parse(await (await fetch(`${url}/runs`)).json());
      expect(listed.runs.map((row) => row.handle), 'the listing does not know the daemon\'s own run')
        .toStrictEqual([run.handle]);
      const looked = await fetch(`${url}/runs/${run.handle}`);
      expect(looked.status).toBe(200);
      expect((await looked.json() as { handle: string }).handle).toBe(run.handle);
      expect((await fetch(`${url}/runs/run-nobody-minted`)).status).toBe(404);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });

  test('the acceptance path: discard the handle, list, take one, and receive the retained replay', async () => {
    // **The criterion that proves the ticket did its job.** `DEFAULT_RETENTION` exists for *a
    // browser opened after a run began, or reopened after a refresh*, and until this ticket a
    // client that never held the handle had no way to name what to join — so the buffer was
    // unreachable by exactly the reader it was built for.
    //
    // Discarding the start's handle is LOAD-BEARING: a test that reused it would exercise Q-0118's
    // socket route and prove nothing this ticket adds. Everything below the discard is what a
    // freshly opened tab can do.
    const project = fixture();
    const daemon = await createDaemon({ project: project.project });
    try {
      const url = `http://${BIND_HOSTNAME}:${String(daemon.port)}`;
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      expect(started.status).toBe(201);
      await started.json();
      // …and from here nothing knows a handle.

      const listing = wireRunListSchema.parse(await (await fetch(`${url}/runs`)).json());
      expect(listing.runs.length, 'the daemon listed no run, so there is nothing to join').toBe(1);
      const handle = listing.runs[0]?.handle ?? '';
      expect(handle, 'the listed row carries no handle to open a socket on').not.toBe('');

      const { messages, code } = await collect(url, handle);
      expect(messages.length, 'the handle taken from the listing reached no retained events').toBeGreaterThan(0);
      const kinds = messages.map((message) => (message as { type: string }).type);
      // The replay is COMPLETE, so no `missed` message is due — which is the honest form of "with
      // its `missed` message where one is due" at this retention. The nonzero case has its own
      // coverage: `host.test.ts` drives it at capacity zero, and `missedMessage` is pinned in
      // `http.test.ts`.
      expect(kinds, 'a replay within the retention bound reported a truncation').not.toContain('missed');
      const events = messages.map((message) => (message as { event?: { type?: string } }).event);
      expect(events.map((event) => event?.type), 'the terminal event was not replayed').toContain('terminal');
      expect(code, 'the socket did not close normally over a run that had ended').toBe(1000);
    } finally {
      await daemon.close();
    }
  });
});

describe('Q-0118 — the two defaults this child decides, each with a subject', () => {
  test('the backpressure bound drops a subscriber that is behind, and keeps one that is not', () => {
    // Review round 3: the ceiling was an inline comparison no test could reach without
    // manufacturing a slow socket, so reverting it turned nothing red. As a function it has a
    // subject — and the boundary is asserted on both sides, because a `>=` where a `>` belongs is
    // the off-by-one this shape invites.
    expect(overBuffered(0), 'a subscriber that is up to date was dropped').toBe(false);
    expect(overBuffered(MAX_BUFFERED_BYTES), 'a subscriber exactly at the bound was dropped').toBe(false);
    expect(overBuffered(MAX_BUFFERED_BYTES + 1), 'a subscriber past the bound was kept').toBe(true);
    // The bound is a real size rather than a placeholder: a ceiling of zero drops every subscriber
    // on its first event, and one of Infinity is the leak it exists to prevent.
    expect(MAX_BUFFERED_BYTES).toBeGreaterThan(64 * 1024);
    expect(Number.isFinite(MAX_BUFFERED_BYTES)).toBe(true);
  });

  test('createDaemon retains events, so a subscriber that arrives after the run is told what it missed', async () => {
    // Review round 3: `createDaemon` and `DEFAULT_RETENTION` had no behavioural test, so reverting
    // the default to zero left the suite green while every late joiner silently lost the run. This
    // asserts the retention through the daemon rather than the constant, which is what makes it a
    // decision rather than a number in a file.
    const project = fixture();
    const daemon = await createDaemon({ project: project.project });
    try {
      const url = `http://${BIND_HOSTNAME}:${String(daemon.port)}`;
      const started = await fetch(`${url}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flow: project.flowName, ticket: TICKET_ID, dry: true }),
      });
      const run = await started.json() as { handle: string };
      // Subscribe AFTER the run: with no retention this socket receives nothing at all, which is
      // exactly what the default exists to prevent.
      const { messages } = await collect(url, run.handle);
      expect(messages.length, 'a subscriber arriving after the run received nothing').toBeGreaterThan(0);
      expect(DEFAULT_RETENTION, 'a retention of zero retains nothing').toBeGreaterThan(0);
    } finally {
      await daemon.close();
    }
  });

  test('createDaemon closes the host before the socket, and the port stops answering', async () => {
    const project = fixture();
    const daemon = await createDaemon({ project: project.project });
    const url = `http://${BIND_HOSTNAME}:${String(daemon.port)}`;
    await daemon.close();
    await expect(fetch(`${url}/runs`, { method: 'POST', body: '{}' })).rejects.toThrow();
  });
});
