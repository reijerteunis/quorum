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
export { createRunHost, DEFAULT_STOP_REASON } from './host.js';
export type {
  AnswerRefusal, RunHost, RunHostOptions, RunState, RunView, StartOutcome, StartRequest, StopRefusal,
} from './host.js';
export { NO_PROJECT_REMEDY, openProject, refusalFor } from './refusal.js';
export type { ProjectOutcome, Refusal } from './refusal.js';
