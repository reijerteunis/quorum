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

  /** Detach every handler before closing, so a callback already in flight becomes a no-op. */
  const detachAndClose = (target: SocketTransport): void => {
    target.onopen = null;
    target.onmessage = null;
    target.onerror = null;
    target.onclose = null;
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
    const next = factory(url);
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
