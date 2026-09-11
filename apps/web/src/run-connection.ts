import type { Event } from '@quorum/shared';

import type { ConnectionState } from './connection-state.js';

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
export function createRunConnection(_factory: SocketFactory): RunConnection {
  throw new Error('not implemented');
}
