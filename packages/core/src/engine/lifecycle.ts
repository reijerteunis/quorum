/**
 * Terminal persistence, ticket history, and what a run leaves behind: the branch rollback and the
 * worktree cleanup, which are the two halves of {@link finished} and never disagree.
 */
import type { Event, TicketHistoryEntry } from '@quorum/shared';

import { FlowError, type LifecycleContext, type RegressionFields, type RunOutcome, type RunStatus } from './types.js';

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Whether the run did what it set out to do.
 *
 * The one predicate the stage rule, the branch rollback and the worktree cleanup all read. A run
 * that finished advances its stage, keeps its branch where the run left it, and gives back the
 * worktrees it obtained; a run that did not finish does none of the three, because the directory it
 * stopped in is the thing somebody is about to open. One condition and three consequences, so the
 * inspection story and the cleanup story cannot drift apart.
 */
const finished = (status: RunStatus): boolean => status === 'completed' || status === 'regressed';

/** The first four of `paths`, marked when there are more — the shape a discarded-edit warning uses. */
const sample = (paths: readonly string[]): string =>
  `${paths.slice(0, 4).join(', ')}${paths.length > 4 ? ', …' : ''}`;

/** git's own first line of stderr, or the thrown message when it carried none, truncated. */
function gitReason(error: unknown): string {
  const property = (key: 'stderr' | 'message'): string =>
    typeof error === 'object' && error !== null && key in error
      ? String((error as Record<string, unknown>)[key] ?? '')
      : '';
  const line = [property('stderr'), property('message')]
    .flatMap((text) => text.split('\n')).map((text) => text.trim()).find(Boolean);
  return line === undefined ? 'git reported no reason' : line.slice(0, 200);
}

/**
 * Give back the worktrees this run obtained, and say what was given back and what was not.
 *
 * A worktree holding anything uncommitted is kept and its paths are named: removal runs
 * `git worktree remove --force`, which discards untracked and modified content, and a delete that
 * takes a decision on somebody's behalf must at least say it took one.
 *
 * Each worktree is guarded on its own, so a directory that cannot be read or removed costs one
 * `warn` and nothing more. A run that has otherwise completed keeps the status, the stage
 * transition, the manifest, the history entry, the terminal event and the exit code it had already
 * earned — a throw from here would corrupt the terminal record of a run that succeeded.
 *
 * See Q-0062, and *"A run removes the worktrees it made, and never the refs"* (2026-08-31).
 */
function returnObtainedWorktrees(context: LifecycleContext): void {
  const obtained = context.worktrees === undefined ? [] : [...context.worktrees];
  if (obtained.length === 0) return;
  let removed = 0;
  let kept = 0;
  for (const [branch, dir] of obtained) {
    let changes: string[];
    try {
      changes = context.readWorktreeChanges(dir);
    } catch (error) {
      // Not established is not clean. Two catches rather than one, so each warning says which of
      // the two questions git declined to answer.
      kept += 1;
      context.emit({ type: 'warn', message: `${branch}: worktree kept — could not read ${dir}: ${gitReason(error)}` });
      continue;
    }
    if (changes.length > 0) {
      kept += 1;
      context.emit({ type: 'warn', message: `${branch}: worktree kept — ${dir} holds uncommitted content: ${sample(changes)}` });
      continue;
    }
    try {
      context.removeWorktree(context.repoDir, branch);
      removed += 1;
      context.emit({ type: 'info', message: `${branch}: worktree removed — ${dir}` });
    } catch (error) {
      kept += 1;
      context.emit({ type: 'warn', message: `${branch}: worktree kept — could not remove ${dir}: ${gitReason(error)}` });
    }
  }
  // The run's own number, which its `start` line already carries, so the maximum `nextRunId` reads
  // out of runs.log is where it was. A line carrying any other number moves the next run's id.
  context.persistence.appendLog(context.ticket, `run=${context.runId} removed-worktrees=${removed} kept=${kept}`);
}

/** Persist one terminal state, applying its stage rule and restoring the branch when required. */
export async function finish(
  context: LifecycleContext,
  stage: string,
  status: RunStatus,
  note: string | null,
  fields?: RegressionFields,
): Promise<RunOutcome> {
  const { ticket, persistence } = context;
  const before = ticket.meta.stage;

  // Why: preserved defect, see Q-0050 AC-10. (the in-memory ticket advances even under dry)
  ticket.meta.iterations = context.counters;
  // `stage` is a plain string on the contracted signature, which is the spike's own shape:
  // callers pass `flow.produces` or a target flow's `consumes`, both unvalidated strings.
  if (finished(status)) ticket.meta.stage = stage as typeof ticket.meta.stage;
  const after = ticket.meta.stage;
  persistence.finaliseManifest(status, after);
  // Here, not after `finish` returns — spike/src/engine.js:625-632. Everything below emits or
  // writes, and `replaceManifest`'s failure warns through the stream, so finalising later puts that
  // warning behind the terminal event and leaves a window in which a consumer acting on `completed`
  // reads a manifest still saying `running`.
  const roundedCost = round(context.stats.cost);
  ticket.meta.history = [...(ticket.meta.history ?? []), outcome(context, before, after, status, roundedCost)];

  if (!context.dry) {
    if (finished(status)) {
      returnObtainedWorktrees(context);
    } else if (context.branchHeadAtStart) {
      // Why: preserved defect, see Q-0050 AC-12.
      const current = context.readBranchHead(context.repoDir, ticket.meta.branch);
      if (current && current !== context.branchHeadAtStart) {
        context.resetBranch(context.repoDir, ticket.meta.branch, context.branchHeadAtStart);
        context.emit({
          type: 'warn',
          message: `${ticket.meta.branch}: rolled back to ${context.branchHeadAtStart.slice(0, 7)} — a run that did not complete leaves the ticket branch as it found it`,
        });
        persistence.appendLog(ticket, `run=${context.runId} rolled-back branch=${ticket.meta.branch} from=${current.slice(0, 7)} to=${context.branchHeadAtStart.slice(0, 7)}`);
      }
    }
  }

  persistence.writeTicket(ticket);
  persistence.appendLog(ticket, `run=${context.runId} ${status} stage=${before}→${after} cost=${roundedCost} tokens=${context.stats.tokens}${note ? ` error=${JSON.stringify(note)}` : ''}`);
  const unpricedSuffix = context.stats.unpriced
    ? `  (+${context.stats.unpriced} unpriced step${context.stats.unpriced > 1 ? 's' : ''} — vendor reports no price)`
    : '';
  context.emit({ type: 'info', message: `run #${context.runId} ${status}: ${before} → ${after}   cost $${roundedCost}  tokens ${context.stats.tokens}${unpricedSuffix}` });

  const common = {
    type: 'terminal' as const, runId: context.runId, stageBefore: before, stageAfter: after,
    cost: roundedCost, tokens: context.stats.tokens, ...(note ? { error: note } : {}),
  };
  const terminal: Event = status === 'regressed'
    ? { ...common, status, ...requiredRegressionFields(fields) }
    : { ...common, status };
  context.emit(terminal);

  if (status === 'regressed') {
    return { status, stage: after, cost: context.stats.cost, runId: context.runId, ...requiredRegressionFields(fields) };
  }
  return { status, stage: after, cost: context.stats.cost, runId: context.runId };
}

/** Construct the byte-compatible eight-field ticket history entry for a run or run event. */
export function outcome(context: LifecycleContext, before: string, after: string, status: string, cost: number | null): TicketHistoryEntry {
  return {
    // Flow.name is optional in the schema and required in a history entry; lintFlow rejects a
    // flow without one, so every flow reaching a run has it. Preserved: the spike writes it raw.
    stage: after as TicketHistoryEntry['stage'], run: context.runId, flow: context.flow.name as string, status,
    stage_before: before as TicketHistoryEntry['stage_before'],
    stage_after: after as TicketHistoryEntry['stage_after'], at: new Date().toISOString(), cost,
  };
}

/**
 * Persist a non-terminal occurrence event without moving the ticket's stage.
 *
 * The sole owner of this mutation. `RunPersistence.recordOccurrenceEvent` is the seam `routing.ts`
 * reaches it through and delegates straight back here; implementing the same four writes on both
 * sides appended two history entries and two log lines for one exhaustion.
 */
export async function recordEvent(context: LifecycleContext, stage: string, status: string, cost: number | null): Promise<void> {
  context.ticket.meta.iterations = context.counters;
  context.ticket.meta.history = [...(context.ticket.meta.history ?? []), outcome(context, stage, stage, status, cost)];
  context.persistence.writeTicket(context.ticket);
  context.persistence.appendLog(context.ticket, `run=${context.runId} ${status} stage=${stage}→${stage} cost=${cost}`);
  return Promise.resolve();
}

/**
 * Narrow the optional argument at the sole status branch where the contract requires it.
 *
 * Why: deliberate addition, not preservation — the spike spreads `...fields` and cannot throw. A
 * runtime backstop is kept because AC-3's closed union crosses a process boundary in M3, and it
 * throws the workspace's `FlowError` so a consumer reads a sentence like every other engine failure.
 */
function requiredRegressionFields(fields: RegressionFields | undefined): RegressionFields {
  if (!fields) throw new FlowError('regressed run requires complete regression fields');
  return fields;
}
