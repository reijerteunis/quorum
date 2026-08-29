/**
 * Closed context and capability types for the run loop: the public {@link RunFlowOptions} entry
 * point, the {@link RunContext} every step-level module reads and writes, its two specialised
 * views ({@link RoutingContext}, {@link LifecycleContext}), and the outcome and gate-answer shapes
 * that cross the run/caller boundary. No behaviour is declared here — `channel.ts`, `loaders.ts`,
 * `routing.ts`, `lifecycle.ts` and `engine.ts` each own the function that closes over these types.
 */
import type { Event, Flow, GateAnswerEnvelope, GateQuestionEvent, ProjectConfig } from '@quorum/shared';

import type { Backlog, TicketRecord } from '../backlog/backlog.js';
import type { Project } from '../backlog/project.js';
import type { Occurrence } from '../run-history/manifest.js';

/** Re-exported so every engine file shares one `FlowError` identity with `core/lint`. */
export { FlowError } from '../lint/lint.js';

/**
 * A run's five closed terminal statuses. `exhausted` is not among them — it is a history-only
 * status a bounded loop records at its own limit, before the gate it then asks decides whether the
 * run continues; see {@link RunPersistence.recordOccurrenceEvent}.
 */
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';

/**
 * What a routing decision resolves to, for `engine.ts` alone to act on: an intra- or cross-flow
 * `goto` naming the counter it charged and the bound it hit, an unconditional abort, or `null` when
 * the step needs no cursor move. `routing.ts` returns this value and never moves the step cursor
 * itself.
 */
export type StepResult = { goto: string; counter: string; limit: number } | { abort: true } | null;

/** Answers one pending gate, out of band and possibly long after the question was emitted. */
export type AnswerGate = (question: GateQuestionEvent) => Promise<GateAnswerEnvelope>;

/**
 * What a caller supplies to run one flow. The project and backlog are already loaded: the run
 * never reloads configuration from disk, so a caller-selected `project.config.adapterOverride`
 * survives even when nothing on disk carries it.
 */
export interface RunFlowOptions {
  ticket: TicketRecord;
  flow: Flow;
  project: Project;
  backlog: Backlog;
  /** Preview only. Every persistent writer on {@link RunPersistence} and on {@link Backlog} is disabled. */
  dry?: boolean;
  /** Authorises the first gates the run meets without a human answer, exhaustion gates included. */
  auto?: boolean;
  /** Required to answer any gate that is neither `dry` nor auto-eligible; its absence fails the run at that gate. */
  answerGate?: AnswerGate;
  /** Caller-owned cancellation. The engine installs no process signal handler of its own. */
  signal?: AbortSignal;
}

/** Enqueues one event on the run's lossless stream. */
export type EmitEvent = (event: Event) => void;

/** Awaited by the channel before it releases an abandoning `for await` consumer. */
export type FinaliseAbandonment = () => Promise<void>;

/** Reads a branch's current commit. `null` covers both an absent branch and a failed read. */
export type BranchHeadReader = (repoDir: string, branch: string) => string | null;

/** Resets a branch to a prior revision, as the rollback path on a non-dry failed run does. */
export type BranchResetter = (repoDir: string, branch: string, revision: string) => void;

/**
 * The concrete writes a run performs, behind one seam, so `routing.ts` and `lifecycle.ts` depend on
 * capabilities rather than reaching into `Backlog` and run history directly. A dry run supplies a
 * no-op implementation; a real run adapts Q-0049's writer.
 */
export interface RunPersistence {
  /** Persist the ticket's current in-memory `meta`/`body` — the one write `finish` performs. */
  writeTicket(ticket: TicketRecord): void;
  /** Append one line to the ticket's run log. */
  appendLog(ticket: TicketRecord, line: string): void;
  /** Record one occurrence-level event — a gate exhaustion, for instance — at its own cost. */
  recordOccurrenceEvent(ticket: TicketRecord, stage: string, event: string, cost: number): void | Promise<void>;
  /**
   * Adds a freshly allocated occurrence to the set {@link finaliseActiveOccurrences} closes.
   *
   * Q-0050 allocates none — gates and fan-out parents allocate no occurrence — so this seam has no
   * caller inside this ticket. It exists because the finaliser without it is a permanent no-op, and
   * a later ticket discovering that would have to widen the capability and add registration in the
   * same round; see Q-0050 review round 1, M-3.
   */
  registerOccurrence(occurrence: Occurrence): void;
  /**
   * Finalise the run manifest — status, `ended_at`, duration, stage and roll-up — and replace it.
   *
   * Called from inside `finish`, at spike/src/engine.js:625-632's position: after the stage
   * assignment and before the ticket write, the terminal log line and the terminal event. A failed
   * manifest write warns through the run-history host, and that warning must reach the stream ahead
   * of the terminal event AC-3 requires to be last. A no-op under `dry`, which has no manifest.
   */
  finaliseManifest(status: RunStatus, stageAfter: string): void;
  /**
   * Close out every occurrence a run left active when it stopped short of its own terminal state.
   *
   * `cause` is the failure in full, not the truncated terminal note: an occurrence's `error.message`
   * is what a reader of the manifest has, and the 200-character first line belongs to `runs.log`.
   */
  finaliseActiveOccurrences(status: 'failed' | 'interrupted', cause: string): void | Promise<void>;
}

/** Running totals for one run. `unpriced` counts occurrences billed with no reported price. */
export interface RunStats {
  cost: number;
  tokens: number;
  unpriced: number;
}

/** Everything a step-level module needs to advance one run: identity, state, and every injected capability. */
export interface RunContext {
  ticket: TicketRecord;
  flow: Flow;
  repoDir: string;
  harnessDir: string;
  /** The caller's already-loaded project configuration; never re-read from disk mid-run. */
  config: ProjectConfig;
  /** The real backlog, or its no-op-writer view under `dry`. */
  backlog: Backlog;
  runId: number;
  /** Loop counters, the same object as `ticket.meta.iterations` — an alias, not a copy. */
  counters: Record<string, number>;
  /** Interpolation values available to steps, `base` and `iter` among them. */
  vars: Record<string, unknown>;
  stats: RunStats;
  dry: boolean;
  auto: boolean;
  emit: EmitEvent;
  answerGate?: AnswerGate;
  signal?: AbortSignal;
  persistence: RunPersistence;
}

/** The seven fields a regressed run's terminal event and history entry both carry, as one closed group. */
export interface RegressionFields {
  targetFlow: string;
  stageBefore: string;
  stageAfter: string;
  counter: string;
  count: number;
  limit: number;
  remaining: number;
}

/** A terminal outcome that does not move the ticket into a different flow's stage. */
export interface NonRegressionRunOutcome {
  status: 'completed' | 'aborted' | 'failed' | 'interrupted';
  stage: string;
  cost: number;
  runId: number;
}

/**
 * A regressed outcome. `stage` duplicates {@link RegressionFields.stageAfter} — the same
 * redundancy `TicketHistoryEntry`'s `stage`/`stage_after` carry on disk, preserved here rather than
 * collapsed.
 */
export interface RegressionRunOutcome extends RegressionFields {
  status: 'regressed';
  stage: string;
  cost: number;
  runId: number;
}

/** What finishing a run resolves to. Closed so a regression's seven fields cannot go missing. */
export type RunOutcome = NonRegressionRunOutcome | RegressionRunOutcome;

/** The context `routing.ts` reads and writes: {@link RunContext} plus the lifecycle seams it calls out to without owning them. */
export interface RoutingContext extends RunContext {
  /**
   * Allocates the next gate id, unique across the whole run.
   *
   * A capability rather than a module-level counter because `engine.ts` spreads a fresh context per
   * step: anything keyed on context identity restarts at 1 for every step and for every re-entry
   * through a backward edge, which is exactly the collision the stale-answer refusal exists to
   * catch. Q-0050 review round 1, B-2.
   */
  nextGateId(): string;
  /** Loads and lints `<harnessDir>/flows/<name>.yaml`, for a cross-flow `goto`'s target. */
  loadNamedFlow(name: string, harnessDir: string): Flow;
  /** Persists a terminal outcome and returns it; `engine.ts` supplies the implementation, over `lifecycle.ts`'s `finish`. */
  finishRun(stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome>;
}

/** The context `lifecycle.ts` reads and writes: {@link RunContext} plus the branch-head/reset seam its rollback rule needs. */
export interface LifecycleContext extends RunContext {
  /** The ticket branch's head when the run started, or `null` when it could not be read. */
  branchHeadAtStart: string | null;
  readBranchHead: BranchHeadReader;
  resetBranch: BranchResetter;
}
