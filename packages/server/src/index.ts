/**
 * The public API of `@quorum/server`: the run host M3's daemon is built on, and nothing else.
 *
 * There is no process here and no transport. What this package exports is a library — open a
 * project, build a host over it, start runs, watch them, answer their gates, stop them, shut down —
 * and the HTTP app, the WebSocket envelope and the bind are Q-0118's. That split is the milestone's
 * own ordering rule: the risk is in the lazy start, the single-consumer fan-out and the out-of-band
 * answer, and those are retired here with no new external dependency, so the dependency decision
 * does not ride on the risky half.
 *
 * Named exports only, one at a time, for the reason `@quorum/core`'s barrel gives: what a consumer
 * may reach is a decision taken here rather than by whoever types an import first.
 */
export { assertRetention, createBroadcast } from './broadcast.js';
export type { Broadcast, Subscription } from './broadcast.js';
export { createGateRegistry } from './gates.js';
export type { GateRefusal, GateRegistry } from './gates.js';
export { openProject, refusalFor } from './failures.js';
export type { ProjectOutcome } from './failures.js';
export { createRunHost, DEFAULT_STOP_REASON, HOST_CLOSED_CONDITION } from './host.js';
export type {
  AnswerRefusal, RunHost, RunHostOptions, RunState, RunView, StartOutcome, StartRequest, StopRefusal,
} from './host.js';
export { NO_PROJECT_REMEDY } from './refusal.js';
export type { Refusal } from './refusal.js';

/**
 * The transport, added by Q-0118: the Hono app over a host, and the process that serves it.
 *
 * Exported beside the host rather than instead of it — `createApp` is what a test drives without a
 * socket, and `serve` is what opens one. Q-0014 codes against {@link WireRefusal}, {@link WireRun}
 * and {@link WireMessage}, which is why the wire shapes are on this surface and the routing is not.
 */
export { createApp, startRequestOf, startRefusalCode, eventMessage, missedMessage } from './http.js';
export type { AppOptions } from './http.js';
export { serve, createDaemon, overBuffered, BIND_HOSTNAME, DEFAULT_RETENTION, MAX_BUFFERED_BYTES } from './serve.js';
export type { Listening, ServeOptions } from './serve.js';
export {
  ANSWER_REFUSAL_STATUS, badRequest, START_REFUSAL_STATUS, STOP_REFUSAL_STATUS, wireRefusalOf, wireRunOf,
} from './wire.js';
export type { StartRefusalCode, WireMessage, WireRefusal, WireRun } from './wire.js';

/** Q-0119's read-only surface: project, tickets, flows and run history, mounted on an app. */
export { mountRead } from './read.js';
export type { WireTicket } from './read.js';
