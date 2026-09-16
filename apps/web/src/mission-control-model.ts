/**
 * Typed contract for the projections mission control renders from the accepted event tail.
 *
 * This module deliberately owns no React or transport state. Its implementation replaces the
 * throwing bodies below; red tests can import the final names before that implementation exists.
 */
import type { Event } from '@quorum/shared';

/** The browser keeps the same number of events as the daemon can replay. */
export const RUN_EVENT_RETENTION = 500;

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

/** Partition events without parsing their human-readable fields. */
export function partitionTrace(_events: readonly Event[]): TracePartition {
  throw new Error('not implemented');
}

/** Derive only observed timeline facts; a terminal event changes how an unmatched start is named. */
export function buildStepTimeline(_events: readonly Event[]): readonly StepTimelineItem[] {
  throw new Error('not implemented');
}
