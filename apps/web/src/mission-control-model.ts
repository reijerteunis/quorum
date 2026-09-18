/**
 * Typed contract for the projections mission control renders from the accepted event tail.
 *
 * This module deliberately owns no React or transport state. Its implementation replaces the
 * throwing bodies below; red tests can import the final names before that implementation exists.
 */
import type { Event } from '@quorum/shared';

/** One step-scoped trace column, in first-appearance order. */
export interface TraceColumn {
  readonly stepId: string;
  readonly vendor: string | null;
  readonly events: readonly Event[];
}

/** The lossless partition of accepted events used by the trace view. */
export interface TracePartition {
  readonly columns: readonly TraceColumn[];
  readonly runActivity: readonly Event[];
}

/** The three observations the wire permits for one step. */
export type StepDisposition = 'started' | 'ended' | 'started-with-no-end-reported';

/** One timeline row, in the order its step id was first observed. */
export interface StepTimelineItem {
  readonly stepId: string;
  readonly disposition: StepDisposition;
  readonly doneMessage: string | null;
  readonly runEnded: boolean;
}

/** The step id an event carries, or `null` for run-level narration with no step of its own. */
function stepIdOf(event: Event): string | null {
  return 'stepId' in event ? event.stepId : null;
}

/**
 * The vendor an event names, or `null` — only `spawn` and `retry` carry one.
 *
 * Exported since Q-0135 because the measured region asks the same question of the same two events,
 * and a second copy of *which events carry a vendor label* would be free to drift from this one the
 * day a third does.
 */
export function vendorOf(event: Event): string | null {
  return event.type === 'spawn' || event.type === 'retry' ? event.vendor : null;
}

/** Partition events without parsing their human-readable fields. */
export function partitionTrace(events: readonly Event[]): TracePartition {
  const runActivity: Event[] = [];
  const columnEvents = new Map<string, Event[]>();
  const columnVendor = new Map<string, string | null>();

  for (const event of events) {
    const stepId = stepIdOf(event);
    if (stepId === null) {
      runActivity.push(event);
      continue;
    }
    let bucket = columnEvents.get(stepId);
    if (!bucket) {
      bucket = [];
      columnEvents.set(stepId, bucket);
      columnVendor.set(stepId, null);
    }
    bucket.push(event);
    const vendor = vendorOf(event);
    if (vendor !== null) {
      columnVendor.set(stepId, vendor);
    }
  }

  const columns: TraceColumn[] = Array.from(columnEvents, ([stepId, columnEventList]) => ({
    stepId,
    vendor: columnVendor.get(stepId) ?? null,
    events: columnEventList,
  }));

  return { columns, runActivity };
}

/** Derive only observed timeline facts; a terminal event changes how an unmatched start is named. */
export function buildStepTimeline(events: readonly Event[]): readonly StepTimelineItem[] {
  const runEnded = events.some((event) => event.type === 'terminal');
  const rows = new Map<string, { started: boolean; doneMessage: string | null }>();

  for (const event of events) {
    if (event.type !== 'step' && event.type !== 'done') continue;
    const row = rows.get(event.stepId) ?? { started: false, doneMessage: null };
    if (event.type === 'step') {
      row.started = true;
    } else {
      row.doneMessage = event.message;
    }
    rows.set(event.stepId, row);
  }

  return Array.from(rows, ([stepId, row]) => {
    const disposition: StepDisposition = row.doneMessage !== null
      ? 'ended'
      : row.started && runEnded
        ? 'started-with-no-end-reported'
        : 'started';
    return { stepId, disposition, doneMessage: row.doneMessage, runEnded };
  });
}
