/**
 * The connection's closed set of states, the reducer that moves between them, and the sentence each
 * one renders.
 *
 * A pure reducer with no DOM and no socket, which is what lets AC-15 be asserted by value over every
 * transition rather than by rendering. The state is derived per moment and never stored — see
 * **Connection state** in `docs/GLOSSARY.md`, which also carries the rule this module exists to
 * keep: **no member of the set is silence**. Every one renders something a reader can act on, which
 * is why `no-daemon` and `no-such-run` are separate members — they are "start the daemon" and "that
 * handle is wrong" — rather than one.
 */
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

/** The `requestedUrl` a state carries, if any — what `no-daemon` names and `open` inherits. */
function requestedUrlOf(state: ConnectionState): string | undefined {
  switch (state.kind) {
    case 'connecting':
    case 'live':
    case 'no-daemon':
      return state.requestedUrl;
    default:
      return undefined;
  }
}

/** Apply one connection action using the contract's close-code precedence. */
export function reduceConnection(machine: ConnectionMachine, action: ConnectionAction): ConnectionMachine {
  switch (action.type) {
    case 'connect':
      return {
        state: { kind: 'connecting', requestedUrl: action.requestedUrl },
        opened: false,
        terminalSeen: false,
      };

    case 'open':
      return {
        ...machine,
        state: { kind: 'live', requestedUrl: requestedUrlOf(machine.state) ?? '' },
        opened: true,
      };

    case 'event':
      return action.event.type === 'terminal' ? { ...machine, terminalSeen: true } : machine;

    case 'protocol-error':
      return { ...machine, state: { kind: 'protocol-error', refusal: action.refusal } };

    case 'error-before-open':
      return { ...machine, state: { kind: 'no-daemon', requestedUrl: requestedUrlOf(machine.state) ?? '' } };

    case 'close':
      // Precedence: 1008 and 1013 are named regardless of what came before; a terminal event
      // already accepted turns any later close into `ended` rather than `interrupted`, which is
      // the whole reason `terminalSeen` is tracked rather than inspecting the close code alone.
      if (action.code === 1008) return { ...machine, state: { kind: 'no-such-run' } };
      if (action.code === 1013) return { ...machine, state: { kind: 'dropped' } };
      if (machine.terminalSeen) return { ...machine, state: { kind: 'ended' } };
      if (machine.opened) return { ...machine, state: { kind: 'interrupted', code: action.code, reason: action.reason } };
      return { ...machine, state: { kind: 'no-daemon', requestedUrl: requestedUrlOf(machine.state) ?? '' } };

    case 'leave':
      return { state: { kind: 'idle' }, opened: false, terminalSeen: false };
  }
}

/** Plain-language text for every connection state. */
export function connectionStateText(state: ConnectionState): string {
  switch (state.kind) {
    case 'idle':
      return 'Not connected.';
    case 'connecting':
      return `Connecting to ${state.requestedUrl}…`;
    case 'live':
      return `Connected to ${state.requestedUrl}.`;
    case 'no-daemon':
      return `Could not reach the daemon at ${state.requestedUrl}. Is it running?`;
    case 'no-such-run':
      return 'The daemon has no run with this handle.';
    case 'ended':
      return 'The run has finished.';
    case 'interrupted':
      return `Connection interrupted (code ${state.code}${state.reason ? `: ${state.reason}` : ''}).`;
    case 'dropped':
      return "Fell behind the daemon's replay buffer and was disconnected.";
    case 'protocol-error':
      return `Protocol error: ${state.refusal}.`;
  }
}

/** Whether the state offers an explicit retry action — the failure states, and only those. */
export function canRetry(state: ConnectionState): boolean {
  switch (state.kind) {
    case 'no-daemon':
    case 'no-such-run':
    case 'interrupted':
    case 'dropped':
    case 'protocol-error':
      return true;
    case 'idle':
    case 'connecting':
    case 'live':
    case 'ended':
      return false;
  }
}
