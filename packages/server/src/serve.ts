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

import { createApp } from './http.js';
import type { RunHost } from './host.js';
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
}

/**
 * Serve one host on loopback.
 *
 * The WebSocket route sends one message per event and **tells a late subscriber what it missed**
 * before its first event rather than handing it a silently truncated stream — the answer Q-0013
 * OQ-1 left here. `missed` is a message kind and not an `Event`, so nothing that is not an event
 * ever reaches the event channel.
 *
 * @param options the host, and the port to ask for.
 * @returns the port actually bound, and a close that resolves when the socket is shut.
 */
export async function serve({ host, port = 0 }: ServeOptions): Promise<Listening> {
  const app = createApp({ host });
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
        const missed = missedMessage(subscription.missed);
        if (missed) ws.send(missed);
        // Detached deliberately — `onOpen` may not block — but never unhandled. A `send` on a
        // socket the client closed under us throws, and an unhandled rejection in a daemon is a
        // process-level crash for one disconnected browser.
        void (async () => {
          try {
            for await (const event of subscription.events) ws.send(eventMessage(event));
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
