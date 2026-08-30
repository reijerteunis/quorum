/**
 * Composes `runFlow`: the stage precondition, context construction over the caller's project and
 * backlog, the step loop, cursor movement for every {@link StepResult}, the run banner, per-step
 * `stepId` enrichment, and failure propagation through `lifecycle.ts` into the lazy stream
 * `channel.ts` provides. The only file in this folder that resolves a `goto` into the next step
 * index — `routing.ts` returns a decision and never touches the cursor.
 *
 * Why: behaviour preserved from spike/src/engine.js:37-174 (charter §2, Q-0050).
 */
import { DEFAULT_BASE_BRANCH } from '@quorum/shared';
import type { Event, Flow } from '@quorum/shared';

import type { Backlog } from '../backlog/backlog.js';
import { branchHead, resetBranchTo } from '../fanout/fanout.js';
import type { ErrorCategory, Occurrence } from '../run-history/manifest.js';
import { initialiseRunHistory, nextRunId } from '../run-history/writer.js';
import type { RunHistory } from '../run-history/writer.js';
import { createEventChannel } from './channel.js';
import type { EventSink } from './channel.js';
import { preflightDiffs } from './diff.js';
import { loadFlowByName, reviewRound } from './loaders.js';
import { finish, recordEvent } from './lifecycle.js';
import { runStep } from './routing.js';
import {
  FlowError,
  type EmitEvent, type LifecycleContext, type RegressionFields, type RoutingContext,
  type RunFlowOptions, type RunOutcome, type RunPersistence, type RunStats, type RunStatus, type StepResult,
} from './types.js';

/** One context satisfying both step-level seams; the object this module builds and hands around. */
type EngineContext = RoutingContext & LifecycleContext;

/**
 * A dry run's backlog: every reader is inherited, every writer is stubbed.
 *
 * Why: preserved design, see Q-0034 — guarding each write call site individually leaves every
 * future writer to remember; making the database itself read-only cannot be forgotten.
 */
function readOnlyBacklog(backlog: Backlog): Backlog {
  const view = Object.create(backlog) as Backlog;
  view.write = () => { /* dry: no write */ };
  view.writeFile = () => '';
  view.log = () => { /* dry: no write */ };
  return view;
}

/**
 * How an occurrence's failure is classified: by the run's own status when it was interrupted, and
 * by the occurrence's kind otherwise.
 *
 * Two entry points in the spike, merged into one catch here and kept distinguishable by `status`.
 * The run catch derives from the kind (`spike/src/engine.js:165`); the signal handler writes
 * `interrupted` flat (`:58-61`), and it is the only producer of that {@link ErrorCategory} member.
 * Deriving on both paths reported a cancelled adapter call as `unknown`, and left `interrupted`
 * with no producer at all.
 */
function categoryOf(occurrence: Occurrence, status: 'failed' | 'interrupted'): ErrorCategory {
  if (status === 'interrupted') return 'interrupted';
  if (occurrence.kind === 'integrate') return 'integrate';
  if (occurrence.kind === 'script') return 'script';
  return 'unknown';
}

/**
 * Stamps the running step's id onto an adapter-shaped event; everything else passes through.
 *
 * `currentStepId` is read at emit time rather than bound per step, because binding it meant handing
 * each step a spread COPY of the run context — and a copy discards whatever a step assigns. The
 * spike's later steps read `ctx.fanned`, `ctx.failingTasks` and `ctx.lastIntegration`, all written
 * by an earlier one (`spike/src/engine.js:940`, `:1074`, `:1071`), so Q-0053 would have found a
 * failed integrate re-running every task and a wildcard `into` resolving to nothing, silently.
 */
function withStepId(emit: EmitEvent, currentStepId: () => string | null): EmitEvent {
  return (event) => {
    const stepId = currentStepId();
    switch (event.type) {
      case 'spawn':
      case 'stdout':
      case 'retry':
        // An id the emitter already carries WINS. The loop knows the top-level step; it does not
        // know which member of a `parallel:` group or which wave of a fan-out is speaking, and
        // both run concurrently against this one slot. Spreading `stepId` last overwrote a member's
        // own id, which typed Q-0052 into supplying one and having it discarded.
        emit(event.stepId !== undefined || stepId === null ? event : { ...event, stepId });
        break;
      default:
        emit(event);
    }
  };
}

/** The first line of whatever was thrown, truncated — spike/src/engine.js:79. */
function failureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.split('\n')[0]!.slice(0, 200);
}

/** The failure in full, as an occurrence's `error.message` carries it — spike/src/engine.js:165. */
function occurrenceMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * What an interrupted run records as its note.
 *
 * AC-5 preserves the spike's `received SIGINT`, which `core` cannot produce unaided: signal
 * handling belongs to the CLI (charter §7) and this folder installs none. So the caller supplies
 * it through `AbortSignal.reason` — the platform's own mechanism for saying *why* — and the run
 * records whatever it was given. Falls back to the thrown message when the caller aborted without
 * a reason, which is what the stream's own abandonment does.
 */
function interruptionNote(signal: AbortSignal, error: unknown): string {
  const reason: unknown = signal.reason;
  if (typeof reason === 'string' && reason.trim() !== '') return reason.split('\n')[0]!.slice(0, 200);
  return failureMessage(error);
}

/** Whatever was thrown, as an `Error` — a channel never completes with a non-Error value. */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Runs one flow to its terminal state, emitting every event through `emit`. */
async function run(options: RunFlowOptions, signal: AbortSignal, emit: EmitEvent): Promise<void> {
  const { ticket, flow, project, backlog, dry = false, auto = false, answerGate, base } = options;

  if (ticket.meta.stage !== flow.consumes) {
    throw new FlowError(`ticket ${ticket.meta.id} is at stage "${ticket.meta.stage}", flow "${flow.name}" consumes "${flow.consumes}"`);
  }

  const { repoDir, harnessDir, config } = project;
  const backlogView = dry ? readOnlyBacklog(backlog) : backlog;

  const runId = nextRunId(ticket);
  // Why: preserved defect, see Q-0050 AC-10. (counters alias the frontmatter object)
  const counters = ticket.meta.iterations ?? {};
  const vars: Record<string, unknown> = {
    id: ticket.meta.id, iter: 1, base: base ?? config.repo?.base_branch ?? DEFAULT_BASE_BRANCH, round: reviewRound(ticket.dir),
  };
  const stats: RunStats = { cost: 0, tokens: 0, unpriced: 0 };

  let history: RunHistory | undefined;
  const active = new Set<Occurrence>();
  // Run-scoped, so a gate id is unique across every step and every re-entry through a backward
  // edge — not per-context, which is what B-2 found. See RoutingContext.nextGateId.
  let gateSequence = 0;
  // The step the loop is inside, or null between steps. Read by the emitter rather than captured,
  // so that the context a step receives is the run's own object — see withStepId.
  let stepId: string | null = null;
  const stepEmit: EmitEvent = withStepId(emit, () => stepId);

  // Assigned once, below; `persistence.recordOccurrenceEvent` and `finishRun` close over this
  // binding and only read it once the step loop is running, well after the assignment.
  let context: EngineContext;

  const persistence: RunPersistence = {
    writeTicket: (t) => backlogView.write(t),
    appendLog: (t, line) => backlogView.log(t, line),
    // Delegates rather than repeating the mutation: `lifecycle.ts` owns the history entry, the
    // ticket write and the log line for an occurrence event, and owning it in both places wrote
    // each of them twice whenever the exported helper was called with a real context.
    recordOccurrenceEvent: (_ticket, stage, event, cost) => recordEvent(context, stage, event, cost),
    registerOccurrence: (occurrence) => { active.add(occurrence); },
    finaliseManifest: (status, stageAfter) => { history?.finalise(status, stageAfter); },
    finaliseActiveOccurrences: (status, cause) => {
      if (!history) return;
      for (const occurrence of active) {
        history.terminal(occurrence, status, { error: { category: categoryOf(occurrence, status), message: cause } });
      }
      active.clear();
    },
  };

  // Why: preserved defect, see Q-0050 AC-12. — branchHead cannot tell "no such branch" from "git
  // failed", and this read cannot distinguish them either; see the lifecycle-routing contract's
  // preserved-diagnostics table.
  const branchHeadAtStart = branchHead(repoDir, ticket.meta.branch);

  /**
   * The step loop's one cancellation point.
   *
   * Without it the only observer is a suspended `askGate`, so a run cancelled between steps — or
   * one handed an already-aborted signal — walks to the end and reaches the `completed` finish,
   * moving the ticket's stage. It throws rather than returning so that the terminal record, the
   * rollback and the rethrow are the ones the catch already performs.
   */
  function throwIfInterrupted(): void {
    if (signal.aborted) throw new FlowError(`run #${runId} (${flow.name}) interrupted`);
  }

  async function finishRun(stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome> {
    return finish(context, stage, status, note, fields);
  }

  context = {
    ticket, flow, repoDir, harnessDir, config, backlog: backlogView,
    runId, counters, vars, stats, dry, auto, signal, answerGate,
    // The two maps the diff preflight fills and the steps that read them share, and whether `--base`
    // was typed at all — which `vars.base` above cannot answer, because it is set either way.
    diffInputs: new Map(), deferredDiffs: new Map(), baseOverride: base ?? null,
    emit: stepEmit,
    persistence,
    nextGateId: () => `${runId}:${(gateSequence += 1)}`,
    loadNamedFlow: (name, dir) => loadFlowByName(name, dir),
    finishRun,
    branchHeadAtStart,
    readBranchHead: branchHead,
    resetBranch: resetBranchTo,
  };

  try {
    emit({ type: 'info', message: `run #${runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}` });
    context.persistence.appendLog(ticket, `run=${runId} flow=${flow.name} start stage=${ticket.meta.stage}`);
    if (!dry) {
      history = initialiseRunHistory(
        // `flow.name` and `flow.file` are optional on the schema and present on every flow that
        // reaches a run: `loadFlow` sets `file` and `lintFlow` rejects a flow without a `name`.
        // Neither is defaulted here — a fabricated path would name a file the flow was never at.
        { repoDir, ticket, run: runId, flow: flow.name!, flowFile: flow.file! },
        { warn: (message) => emit({ type: 'warn', message }) },
      );
    }

    // Inside the run try and before the step loop, so a failed preflight receives the same terminal
    // record as any other error: active occurrences are finalised, the run is recorded failed,
    // rollback applies and the original error is rethrown. It adds no second run path, and it is the
    // earlier of this function's two reads of `flow.steps`.
    preflightDiffs(context);

    // Why: preserved behaviour — `flow.steps` is read directly, uncoalesced, so a flow with no
    // `steps` key throws a raw TypeError here rather than running zero steps; see flow.ts's own
    // note on this and "The port preserves behaviour" (docs/DECISIONS.md, 2026-08-25).
    const steps = flow.steps as unknown as ReadonlyArray<Record<string, unknown>>;
    let i = 0;
    while (i < steps.length) {
      throwIfInterrupted();
      const step = steps[i];
      // Why: preserved defect, see Q-0050 AC-12d — an out-of-range index (an unknown goto target)
      // dereferences `undefined` here and throws a raw TypeError, not a FlowError.
      // `undefined` for a container, not the literal string "undefined". A `parallel:` group carries
      // no id — correctly, it is not a step — and both flows this ticket runs under are one.
      stepId = step.id === undefined || step.id === null ? null : String(step.id);
      let result: StepResult;
      try {
        result = await runStep(step, context);
      } finally {
        stepId = null;
      }

      if (result && 'goto' in result) {
        const target = result.goto;
        if (target.startsWith('flow:')) {
          const targetFlow: Flow = context.loadNamedFlow(target.slice('flow:'.length), harnessDir);
          const stageBefore = ticket.meta.stage;
          emit({ type: 'warn', message: `backward edge → ${target}: ticket regresses to stage "${targetFlow.consumes}"` });
          await finishRun(targetFlow.consumes, 'regressed', null, {
            targetFlow: targetFlow.name ?? target.slice('flow:'.length),
            stageBefore, stageAfter: targetFlow.consumes,
            counter: result.counter, count: context.counters[result.counter],
            limit: result.limit, remaining: Math.max(0, (result.limit ?? 0) - (context.counters[result.counter] ?? 0)),
          });
          return;
        }
        i = steps.findIndex((s) => s.id === target
          || (Array.isArray(s.parallel) && (s.parallel as ReadonlyArray<Record<string, unknown>>).some((p) => p.id === target)));
        context.vars.iter = Number(context.vars.iter) + 1;
        continue;
      }
      if (result && 'abort' in result) {
        await finishRun(ticket.meta.stage, 'aborted', null);
        return;
      }
      i += 1;
    }
    throwIfInterrupted();
  } catch (error) {
    const status: 'failed' | 'interrupted' = signal.aborted ? 'interrupted' : 'failed';
    const note = status === 'interrupted' ? interruptionNote(signal, error) : failureMessage(error);
    // Before the terminal record and in that order — spike/src/engine.js:161-168, and the
    // lifecycle-routing contract's "first finalise active occurrences, then persist".
    await persistence.finaliseActiveOccurrences(status, status === 'interrupted' ? note : occurrenceMessage(error));
    await finishRun(ticket.meta.stage, status, note);
    throw error;
  }

  // Outside the try, as spike/src/engine.js:174 is. Inside it, anything `finish` or the manifest
  // replace can throw on the success path re-enters the catch and finishes the run a second time —
  // a second history entry, a second terminal log line and a second terminal event.
  await finishRun(flow.produces, 'completed', null);
}

/**
 * The lazy, single-consumer `AsyncIterable<Event>` this run's caller iterates.
 *
 * Nothing runs until the first `next()` pull. Cancellation is layered: the caller's own
 * {@link RunFlowOptions.signal} and the stream's own abandonment (an early `return()`/`throw()`)
 * both resolve to the same combined signal, so a gate awaiting `answerGate` observes either.
 */
export function runFlow(options: RunFlowOptions): AsyncIterable<Event> {
  let sink: EventSink;
  let settle: Promise<void> | undefined;
  const abandonment = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, abandonment.signal]) : abandonment.signal;

  function start(): void {
    settle = run(options, signal, (event) => sink.emit(event)).then(
      () => sink.complete(),
      (error: unknown) => sink.complete(toError(error)),
    );
  }

  async function finaliseAbandonment(): Promise<void> {
    abandonment.abort();
    if (settle) await settle;
  }

  const channel = createEventChannel(start, finaliseAbandonment);
  sink = channel.sink;
  return channel.stream;
}
