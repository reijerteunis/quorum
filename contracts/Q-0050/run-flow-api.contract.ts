/**
 * Compile-time contract for Q-0050's public engine boundary.
 *
 * This file is a contract artifact, not production source. Development implements the same
 * declarations under `packages/core/src/engine/` and imports the event types from
 * `@quorum/shared`; QA may compile against this stub before that implementation exists.
 */
import type { Event } from '@quorum/shared';

/** Contract-local gate question until Q-0050 widens the shared event union. */
export interface ContractGateQuestionEvent {
  type: 'gate';
  gateId: string;
  kind: string;
  reason: string;
  ticketDir: string;
  retry?: string;
}

/** Contract-local answer envelope until Q-0050 adds the shared runtime schema. */
export interface ContractGateAnswerEnvelope {
  gateId: string;
  answer: 'advance' | 'retry' | 'abort';
}

/** The five terminal states persisted by the run lifecycle. */
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';

/** The minimum ticket shape the run loop consumes; the concrete backlog type is assignable. */
export interface RunTicket {
  /** Absolute ticket directory. */
  dir: string;
  /** Mutable frontmatter state; dry runs deliberately retain the spike's in-memory mutations. */
  meta: {
    /** Ticket identifier used in messages, history, and run identity. */
    id: string;
    stage: string;
    iterations?: Record<string, number>;
    history?: readonly unknown[];
  };
}

/** A validated flow sufficient for orchestration; the shared Flow type replaces this stub. */
export interface RunFlowDefinition {
  name: string;
  consumes: string;
  produces: string;
  file: string;
  steps: readonly unknown[];
}

/** Resolve one gate question outside the iterator's pull stack. */
export type AnswerGate = (
  question: ContractGateQuestionEvent,
) => Promise<ContractGateAnswerEnvelope>;

/** Inputs owned by the run-loop boundary. Sibling modules may structurally extend this object. */
export interface RunFlowOptions {
  /** The already-loaded ticket to run. */
  ticket: RunTicket;
  /** The parsed and linted flow to execute. */
  flow: RunFlowDefinition;
  /** Absolute repository root. */
  repoDir: string;
  /** Absolute harness configuration directory. */
  harnessDir: string;
  /** Preview through the real routing path while replacing every persistent writer. */
  dry?: boolean;
  /** Opt in to gates whose flow declaration permits automatic advance. */
  auto?: boolean;
  /** Out-of-band gate responder; absence is an explicit failure when a gate asks. */
  answerGate?: AnswerGate;
  /** Caller-owned cancellation; core installs no process signal listener. */
  signal?: AbortSignal;
}

/**
 * Start lazily on the first pull and return a single-consumer event stream.
 *
 * The implementation owns an internal, lossless FIFO so synchronous adapter callbacks can enqueue
 * bursts while the consumer is slow. `return()` cancels work, awaits lifecycle finalisation, and
 * never permits the abandoned run to continue in the background.
 */
export declare function runFlow(options: RunFlowOptions): AsyncIterable<Event>;

/** A flow failure whose non-empty message names its cause. */
export declare class FlowError extends Error {}
