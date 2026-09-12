/**
 * The process: a Node server over {@link createApp}, bound to loopback and nothing else.
 *
 * This is the file that makes `packages/server` a daemon rather than a library. Everything below
 * `createApp` opens no socket; this opens one, and closing it is what a caller does to stop.
 *
 * Why: deliberate addition, not preservation — Q-0118.
 */
import { serve as serveNode } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';

import type { Project } from '@quorum/core';

import { createApp } from './http.js';
import { createRunHost, type RunHost } from './host.js';
import { mountRead } from './read.js';
import { bundleRefusal } from './static.js';
import { eventMessage, missedMessage } from './http.js';

/**
 * The only address this server binds.
 *
 * **Not configurable, and that is the decision rather than an omission.** There is no
 * authentication of any kind, and the process starts agent runs and writes to a git repository — so
 * a non-loopback bind puts that on a network. `04-architecture.md` has said *"single-user,
 * localhost-only by default"* since 2026-08-22; this removes the *by default*, because a flag whose
 * only use is to make the product unsafe is not a feature. Q-0013 OQ-2.
 */
export const BIND_HOSTNAME = '127.0.0.1';

/**
 * How many events a run retains for a subscriber that arrives after it started.
 *
 * **This child chooses it, because this child is what creates a late joiner** (Q-0013 OQ-1): a
 * browser opened after a run began, or reopened after a refresh. Q-0013 left the number to whoever
 * built the thing that produces one.
 *
 * 500 is a bound rather than a guess about typical traces: an unbounded buffer is a leak
 * proportional to trace verbosity, and a buffer small enough to be routinely exceeded makes the
 * `missed` message the common case rather than the exception. What matters more than the number is
 * that exceeding it is **said** — a late subscriber is told the count it missed and never handed a
 * silently truncated stream.
 */
export const DEFAULT_RETENTION = 500;

/**
 * The largest number of bytes a subscriber may leave unsent before its socket is closed.
 *
 * A browser that stops reading does not stop the run: the host's fan-out keeps producing and this
 * socket's buffer grows without limit, so one paused tab becomes the daemon's memory. The bound is
 * per subscriber, measurable (`bufferedAmount`), and its outcome is explicit — 1013 *"try again
 * later"*, which is the protocol's own way of saying *you, not the run*.
 */
export const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/**
 * Whether a subscriber that has left `buffered` bytes unsent should be dropped.
 *
 * A function rather than an inline comparison so the bound has a subject a test can reach: the
 * inline form could only be exercised by manufacturing a slow socket, which review round 3
 * correctly reported as untested. The handler is then one call, and reverting the ceiling turns
 * this red rather than turning nothing red.
 */
export function overBuffered(buffered: number): boolean {
  return buffered > MAX_BUFFERED_BYTES;
}

/** A listening server, and the way to stop it. */
export interface Listening {
  readonly port: number;
  close(): Promise<void>;
}

/** What {@link serve} needs. */
export interface ServeOptions {
  readonly host: RunHost;
  /** `0` asks the operating system for a free one, which is what a test wants. */
  readonly port?: number;
  /**
   * The directory holding the built web app, or nothing to serve none (Q-0122).
   *
   * A supplied directory that holds no build **refuses before anything binds** — see {@link serve}.
   */
  readonly bundle?: string;
}

/**
 * Serve one host on loopback.
 *
 * The WebSocket route sends one message per event and **tells a late subscriber what it missed**
 * before its first event rather than handing it a silently truncated stream — the answer Q-0013
 * OQ-1 left here. `missed` is a message kind and not an `Event`, so nothing that is not an event
 * ever reaches the event channel.
 *
 * **A `bundle` that holds no build refuses here, before anything binds** (Q-0122). Checked ahead of
 * the listener rather than answered per request, because the alternative is a daemon that starts,
 * prints a port, and then answers 404 at `/` to somebody who has already opened a browser — a
 * misconfiguration reported as a missing page. Rejected rather than returned as a value: there is
 * no request to answer, and `serve` already rejects on a bind that fails.
 *
 * @param options the host, the port to ask for, and the bundle to serve.
 * @returns the port actually bound, and a close that resolves when the socket is shut.
 */
export async function serve({ host, port = 0, bundle }: ServeOptions): Promise<Listening> {
  if (bundle !== undefined) {
    const refusal = bundleRefusal(bundle);
    if (refusal) throw new Error(`${refusal.condition} — ${refusal.remedy ?? ''}`);
  }
  // The read-only routes are mounted here rather than inside `createApp`, so a test that wants the
  // run routes alone still gets them alone — and so the project a read answers about is the one the
  // host is driving, which is the only project this process has. The static route is NOT mounted
  // here: it has to sit ahead of the run routes rather than behind the read ones, so `createApp`
  // registers it first and this option is passed through.
  const app = mountRead(createApp({ host, bundle }), host.project);
  let server: ReturnType<typeof serveNode>;
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get('/runs/:id/events', upgradeWebSocket((c) => {
    // `?? ''` rather than a non-null assertion: the route pattern guarantees the parameter, but a
    // guarantee the compiler cannot see is one a later route edit can remove silently. An empty
    // handle matches no run and is refused below, which is the same answer.
    const handle = c.req.param('id') ?? '';
    // Held per socket so `onClose` and `onError` can release what `onOpen` took. Without this a
    // client that walks away leaves a subscription attached to the run's fan-out for as long as the
    // run lasts, and the host has no way to know the socket is gone.
    let release: (() => void) | null = null;
    const releaseOnce = (): void => { const r = release; release = null; r?.(); };
    return {
      onOpen(_event, ws) {
        const subscription = host.subscribe(handle);
        if (!subscription) {
          // A socket for a run that is not here is closed rather than left open and silent: 1008
          // is "policy violation", which is the nearest thing the protocol has to "no such thing".
          ws.close(1008, 'no run is registered under that handle');
          return;
        }
        release = () => { subscription.close(); };
        // Detached deliberately — `onOpen` may not block — but never unhandled. A `send` on a
        // socket the client closed under us throws, and an unhandled rejection in a daemon is a
        // process-level crash for one disconnected browser.
        //
        // The `missed` send is INSIDE this try, not above it: a peer that disconnected between the
        // upgrade and the first write made it throw where nothing was catching, and the release in
        // `finally` never ran. Review round 2.
        void (async () => {
          try {
            const missed = missedMessage(subscription.missed);
            if (missed) ws.send(missed);
            for await (const event of subscription.events) {
              ws.send(eventMessage(event));
              const buffered = (ws.raw as { bufferedAmount?: number } | undefined)?.bufferedAmount ?? 0;
              if (overBuffered(buffered)) {
                ws.close(1013, `this subscriber is ${String(buffered)} bytes behind and is being dropped`);
                return;
              }
            }
            // The stream ended, so the run did. Normal closure, and the terminal event has already
            // been sent — a client learns the outcome from the event, never from the close code.
            ws.close(1000, 'the run ended');
          } catch {
            // Nothing to report to: the socket this would have reported through is the one that
            // failed. The subscription is released either way.
            try { ws.close(1011, 'the event stream ended unexpectedly'); } catch { /* already gone */ }
          } finally {
            releaseOnce();
          }
        })();
      },
      onClose() { releaseOnce(); },
      onError() { releaseOnce(); },
    };
  }));

  // Awaited, not assumed. `serveNode` binds asynchronously, so `address()` is `null` on the line
  // after the call and the port would read back as the `0` that was asked for — which is a URL
  // nothing answers. Measured the hard way: every socket test failed with EADDRNOTAVAIL against
  // `127.0.0.1:0` before this was a promise.
  const bound = await new Promise<number>((resolve, reject) => {
    const started = serveNode({ fetch: app.fetch, hostname: BIND_HOSTNAME, port }, (info) => {
      injectWebSocket(started);
      resolve(info.port);
    });
    // Without this an `EADDRINUSE` never settles the promise and `serve()` hangs for ever — the
    // worst shape a failure can take, because it looks like a slow start rather than a refusal.
    started.once('error', reject);
    server = started;
  });
  return {
    port: bound,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => { if (error) reject(error); else resolve(); });
    }),
  };
}

/**
 * The daemon: a project in, a listening server out.
 *
 * The one place that chooses a retention capacity, which is what makes {@link DEFAULT_RETENTION} a
 * decision rather than an unused constant. `serve` still takes a host, because a caller that wants
 * to drive one directly — every test in this package — should not have to go through a socket.
 *
 * @param options the project to run against, the retention capacity, the port to ask for, and the
 *   directory holding the built web app — supplied by whoever knows where it is, never discovered
 *   here, and omitted by a caller that wants the JSON surface alone.
 * @returns the listening server, and the host it is serving.
 */
export async function createDaemon(
  { project, port = 0, retain = DEFAULT_RETENTION, bundle }: {
    project: Project; port?: number; retain?: number; bundle?: string;
  },
): Promise<Listening & { readonly host: RunHost }> {
  const host = createRunHost({ project, retain });
  const server = await serve({ host, port, bundle });
  return {
    port: server.port,
    host,
    // Both, in this order: the host releases every live run through the abandonment path, and only
    // then does the socket stop answering. Closing the socket first would leave a run finalising
    // with nowhere to report, which is the shape Q-0013's shutdown exists to avoid.
    close: async () => { await host.shutdown(); await server.close(); },
  };
}
