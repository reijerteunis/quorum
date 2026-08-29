/**
 * Composes `runFlow`: the stage precondition, context construction over the caller's project and
 * backlog, the step loop, cursor movement for every {@link StepResult}, the run banner, per-step
 * `stepId` enrichment, and failure propagation through `lifecycle.ts` into the lazy stream
 * `channel.ts` provides. The only file in this folder that resolves a `goto` into the next step
 * index — `routing.ts` returns a decision and never touches the cursor.
 *
 * Why: behaviour preserved from spike/src/engine.js:37-174 (charter §2, Q-0050).
 */
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_BASE_BRANCH } from '@quorum/shared';
import type { Event, Flow } from '@quorum/shared';

import type { Backlog } from '../backlog/backlog.js';
import { branchHead, resetBranchTo } from '../fanout/fanout.js';
import type { Occurrence } from '../run-history/manifest.js';
import { initialiseRunHistory, nextRunId } from '../run-history/writer.js';
import type { RunHistory } from '../run-history/writer.js';
import { createEventChannel } from './channel.js';
import type { EventSink } from './channel.js';
import { loadFlowByName, reviewRound } from './loaders.js';
import { finish, outcome } from './lifecycle.js';
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

/** Stamps the current step's id onto an adapter-shaped event; everything else passes through. */
function withStepId(emit: EmitEvent, stepId: string): EmitEvent {
  return (event) => {
    switch (event.type) {
      case 'spawn':
      case 'stdout':
      case 'retry':
        emit({ ...event, stepId });
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

/** Whatever was thrown, as an `Error` — a channel never completes with a non-Error value. */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Runs one flow to its terminal state, emitting every event through `emit`. */
async function run(options: RunFlowOptions, signal: AbortSignal, emit: EmitEvent): Promise<void> {
  const { ticket, flow, project, backlog, dry = false, auto = false, answerGate } = options;

  if (ticket.meta.stage !== flow.consumes) {
    throw new FlowError(`ticket ${ticket.meta.id} is at stage "${ticket.meta.stage}", flow "${flow.name}" consumes "${flow.consumes}"`);
  }

  const { repoDir, harnessDir, config } = project;
  const backlogView = dry ? readOnlyBacklog(backlog) : backlog;
  // A ticket created through Backlog.create() already has its folder; a run built directly over a
  // ticket record (the daemon's shape) does not. Idempotent, and skipped under dry so a preview
  // creates nothing on disk.
  if (!dry) fs.mkdirSync(ticket.dir, { recursive: true });

  const runId = nextRunId(ticket);
  const counters = ticket.meta.iterations ?? {};
  const vars: Record<string, unknown> = {
    id: ticket.meta.id, iter: 1, base: config.repo?.base_branch ?? DEFAULT_BASE_BRANCH, round: reviewRound(ticket.dir),
  };
  const stats: RunStats = { cost: 0, tokens: 0, unpriced: 0 };

  let history: RunHistory | undefined;
  const active = new Set<Occurrence>();

  // Assigned once, below; `persistence.recordOccurrenceEvent` and `finishRun` close over this
  // binding and only read it once the step loop is running, well after the assignment.
  let context: EngineContext;

  const persistence: RunPersistence = {
    writeTicket: (t) => backlogView.write(t),
    appendLog: (t, line) => backlogView.log(t, line),
    recordOccurrenceEvent: (t, stage, event, cost) => {
      t.meta.iterations = context.counters;
      t.meta.history = [...(t.meta.history ?? []), outcome(context, stage, stage, event, cost)];
      backlogView.write(t);
      backlogView.log(t, `run=${runId} ${event} stage=${stage}→${stage} cost=${cost}`);
    },
    finaliseActiveOccurrences: (status, cause) => {
      if (!history) return;
      for (const occurrence of active) history.terminal(occurrence, status, { error: { category: 'interrupted', message: cause } });
      active.clear();
    },
  };

  // Why: preserved defect, see Q-0050 AC-12. — branchHead cannot tell "no such branch" from "git
  // failed", and this read cannot distinguish them either; see the lifecycle-routing contract's
  // preserved-diagnostics table.
  const branchHeadAtStart = branchHead(repoDir, ticket.meta.branch);

  async function finishRun(stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome> {
    const result = await finish(context, stage, status, note, fields);
    if (history) history.finalise(status, result.stage);
    return result;
  }

  context = {
    ticket, flow, repoDir, harnessDir, config, backlog: backlogView,
    runId, counters, vars, stats, dry, auto, signal, answerGate,
    emit,
    persistence,
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
        { repoDir, ticket, run: runId, flow: flow.name!, flowFile: flow.file ?? path.join(harnessDir, 'flows', `${flow.name}.yaml`) },
        { warn: (message) => emit({ type: 'warn', message }) },
      );
    }

    // Why: preserved behaviour — `flow.steps` is read directly, uncoalesced, so a flow with no
    // `steps` key throws a raw TypeError here rather than running zero steps; see flow.ts's own
    // note on this and "The port preserves behaviour" (docs/DECISIONS.md, 2026-08-25).
    const steps = flow.steps as unknown as ReadonlyArray<Record<string, unknown>>;
    let i = 0;
    while (i < steps.length) {
      const step = steps[i];
      // Why: preserved defect, see Q-0050 AC-12d — an out-of-range index (an unknown goto target)
      // dereferences `undefined` here and throws a raw TypeError, not a FlowError.
      const stepId = String(step.id);
      const stepContext: EngineContext = { ...context, emit: withStepId(emit, stepId) };
      const result: StepResult = await runStep(step, stepContext);

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
    await finishRun(flow.produces, 'completed', null);
  } catch (error) {
    const status: RunStatus = signal.aborted ? 'interrupted' : 'failed';
    await finishRun(ticket.meta.stage, status, failureMessage(error));
    throw error;
  }
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
