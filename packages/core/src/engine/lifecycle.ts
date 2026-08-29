/** Terminal persistence, ticket history, and rollback policy for one flow run. */
import type { Event, TicketHistoryEntry } from '@quorum/shared';

import { FlowError, type LifecycleContext, type RegressionFields, type RunOutcome, type RunStatus } from './types.js';

const round = (value: number): number => Math.round(value * 1000) / 1000;

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

  ticket.meta.iterations = context.counters;
  // `stage` is a plain string on the contracted signature, which is the spike's own shape:
  // callers pass `flow.produces` or a target flow's `consumes`, both unvalidated strings.
  if (status === 'completed' || status === 'regressed') ticket.meta.stage = stage as typeof ticket.meta.stage;
  const after = ticket.meta.stage;
  const roundedCost = round(context.stats.cost);
  ticket.meta.history = [...(ticket.meta.history ?? []), outcome(context, before, after, status, roundedCost)];

  if (!context.dry && status !== 'completed' && status !== 'regressed' && context.branchHeadAtStart) {
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
