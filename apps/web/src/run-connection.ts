/**
 * One socket at a time against one run, and the snapshot a view reads.
 *
 * The controller owns the socket's lifetime so a component does not: `connect`, `retry` and
 * `dispose` each supersede whatever is current, and a socket that closes on its own is invalidated
 * where it closes. AC-17's invariant is that once a socket is superseded, closed or disposed, none
 * of its callbacks may change connection state, accepted events or the missed notice — held by two
 * mechanisms, an identity guard and detachment, because a transport that ignores one still meets
 * the other.
 *
 * **It never reconnects by itself.** Without a resume cursor an automatic reconnection either
 * duplicates events or hides a missed prefix, and the daemon's `missed` envelope exists precisely
 * so a gap is reported rather than smoothed over. Retry is the user's act.
 */
import type { Event } from '@quorum/shared';

import { reduceConnection, type ConnectionAction, type ConnectionMachine, type ConnectionState } from './connection-state.js';
import { runEventsUrl } from './daemon-endpoints.js';
import { parseFrame } from './frame-parser.js';

/** The browser socket subset used by the run connection. */
export interface SocketTransport {
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null;
  close(): void;
}

/** Injectable constructor for browser and fake socket transports. */
export type SocketFactory = (url: URL) => SocketTransport;

/** In-memory data exposed to the route and top bar. */
export interface RunConnectionSnapshot {
  readonly state: ConnectionState;
  readonly events: readonly Event[];
  readonly missedCount: number | null;
}

/** One owned connection with explicit replacement, retry and disposal. */
export interface RunConnection {
  readonly snapshot: RunConnectionSnapshot;
  connect(handle: string, page: URL): void;
  retry(): void;
  dispose(): void;
  subscribe(listener: (snapshot: RunConnectionSnapshot) => void): () => void;
}

/** Create an idle connection controller; construction itself opens no socket. */
export function createRunConnection(factory: SocketFactory): RunConnection {
  let machine: ConnectionMachine = { state: { kind: 'idle' }, opened: false, terminalSeen: false };
  let events: readonly Event[] = [];
  let missedCount: number | null = null;
  let socket: SocketTransport | null = null;
  let handle: string | null = null;
  let page: URL | null = null;
  let disposed = false;
  const listeners = new Set<(snapshot: RunConnectionSnapshot) => void>();

  const snapshotOf = (): RunConnectionSnapshot => ({ state: machine.state, events, missedCount });

  const notify = (): void => {
    const snapshot = snapshotOf();
    for (const listener of listeners) listener(snapshot);
  };

  const dispatch = (action: ConnectionAction): void => {
    machine = reduceConnection(machine, action);
  };

  /** Drop every handler, so a callback already in flight becomes a no-op. */
  const detach = (target: SocketTransport): void => {
    target.onopen = null;
    target.onmessage = null;
    target.onerror = null;
    target.onclose = null;
  };

  /** Detach every handler before closing, so a callback already in flight becomes a no-op. */
  const detachAndClose = (target: SocketTransport): void => {
    detach(target);
    target.close();
  };

  const closeCurrentSocket = (): void => {
    const current = socket;
    if (current === null) return;
    socket = null;
    detachAndClose(current);
  };

  /** Dispatch the connect action and wire a fresh socket's handlers to this controller's state. */
  const open = (url: URL): void => {
    dispatch({ type: 'connect', requestedUrl: url.toString() });
    let next: SocketTransport;
    try {
      next = factory(url);
    } catch {
      // A constructor that throws would otherwise escape `connect()` and the React effect and leave
      // the controller in `connecting` with no socket and no Retry — which AC-15 calls silence. The
      // path is very nearly unreachable (`defaultSocketFactory` builds its URL from the page's own
      // origin, so there is no malformed URL and no mixed-content case) and the failure AC-15 is
      // actually about — a daemon that is not listening — fires `error` then `close` rather than
      // throwing. Guarded anyway, because the cost is four lines and the alternative is a state the
      // user cannot leave. Q-0120 review round 2, N-9.
      dispatch({ type: 'error-before-open' });
      dispatch({ type: 'close', code: 1006, reason: 'the socket could not be created' });
      notify();
      return;
    }
    socket = next;

    next.onopen = () => {
      if (socket !== next) return;
      dispatch({ type: 'open' });
      notify();
    };

    next.onmessage = (message) => {
      if (socket !== next) return;
      const result = parseFrame(message.data);
      if (!result.ok) {
        dispatch({ type: 'protocol-error', refusal: result.refusal.kind });
        notify();
        return;
      }
      if (result.frame.type === 'missed') {
        missedCount = result.frame.count;
        notify();
        return;
      }
      // COPIED, deliberately, and this is the note round 2's N-2 asked for rather than an
      // oversight. `[...events, event]` is O(n) per event and so quadratic over a long stream, which
      // is real. What it buys is that a snapshot's `events` never changes after it is handed out:
      // `snapshotOf` returns the array by reference, so pushing in place would make every snapshot
      // a live view that grows under its holder — and Q-0015 renders mission control from this same
      // snapshot while Q-0121 will hold several controllers at once. Trading an immutability every
      // consumer can rely on for a constant factor is not a nit's worth of risk; the cap question
      // AC-19 deliberately leaves open is where this belongs, with a measurement behind it.
      events = [...events, result.frame.event];
      dispatch({ type: 'event', event: result.frame.event });
      notify();
    };

    next.onerror = () => {
      if (socket !== next) return;
      if (machine.opened) return;
      dispatch({ type: 'error-before-open' });
      notify();
    };

    next.onclose = (closeEvent) => {
      if (socket !== next) return;
      dispatch({ type: 'close', code: closeEvent.code, reason: closeEvent.reason });
      // A socket that closed ON ITS OWN is invalidated here, which is the third of the three cases
      // AC-17 names — *"superseded, closed or disposed"*. The other two were covered twice over:
      // `connect()`, `retry()` and `dispose()` all call `closeCurrentSocket()`, which nulls `socket`
      // AND detaches. A natural close was covered by neither, so `socket === next` still held and a
      // later `message` could append an event or replace the missed notice after the connection had
      // ended. The frozen contract's Lifetime paragraph says only "Disposed or superseded"; the
      // criterion is the wider of the two and governs. Q-0120 review round 2, M-2.
      socket = null;
      detach(next);
      notify();
    };

    notify();
  };

  return {
    get snapshot(): RunConnectionSnapshot {
      return snapshotOf();
    },

    connect(nextHandle: string, nextPage: URL): void {
      if (disposed) return;
      closeCurrentSocket();
      handle = nextHandle;
      page = nextPage;
      events = [];
      missedCount = null;
      open(runEventsUrl(nextPage, nextHandle));
    },

    retry(): void {
      if (disposed) return;
      if (handle === null || page === null) return;
      closeCurrentSocket();
      open(runEventsUrl(page, handle));
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      closeCurrentSocket();
      dispatch({ type: 'leave' });
      notify();
    },

    subscribe(listener: (snapshot: RunConnectionSnapshot) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
