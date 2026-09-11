import type { Event } from '@quorum/shared';

/** The closed set rendered by the top bar's connection region. */
export type ConnectionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting'; readonly requestedUrl: string }
  | { readonly kind: 'live'; readonly requestedUrl: string }
  | { readonly kind: 'no-daemon'; readonly requestedUrl: string }
  | { readonly kind: 'no-such-run' }
  | { readonly kind: 'ended' }
  | { readonly kind: 'interrupted'; readonly code: number; readonly reason: string }
  | { readonly kind: 'dropped' }
  | { readonly kind: 'protocol-error'; readonly refusal: string };

/** Inputs to the pure connection-state reducer. */
export type ConnectionAction =
  | { readonly type: 'connect'; readonly requestedUrl: string }
  | { readonly type: 'open' }
  | { readonly type: 'event'; readonly event: Event }
  | { readonly type: 'protocol-error'; readonly refusal: string }
  | { readonly type: 'error-before-open' }
  | { readonly type: 'close'; readonly code: number; readonly reason: string }
  | { readonly type: 'leave' };

/** Reducer memory needed to distinguish a terminal stream from a merely closed socket. */
export interface ConnectionMachine {
  readonly state: ConnectionState;
  readonly opened: boolean;
  readonly terminalSeen: boolean;
}

/** Apply one connection action using the contract's close-code precedence. */
export function reduceConnection(_machine: ConnectionMachine, _action: ConnectionAction): ConnectionMachine {
  throw new Error('not implemented');
}

/** Plain-language text for every connection state. */
export function connectionStateText(_state: ConnectionState): string {
  throw new Error('not implemented');
}

/** Whether the state offers an explicit retry action. */
export function canRetry(_state: ConnectionState): boolean {
  throw new Error('not implemented');
}
