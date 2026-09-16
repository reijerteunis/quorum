/**
 * The lossless run lane and per-step trace columns mission control renders from the accepted tail.
 *
 * `partitionTrace` (`mission-control-model.ts`) has already decided membership and order — one
 * column per exact `stepId`, in first-appearance order, and every event with no `stepId` in the
 * run-activity lane. This file draws that partition and interpolates nothing of its own: no
 * grouping, no sorting, no reading a `stepId` or a vendor out of a message. Every event field is
 * rendered as React text, so markup inside a vendor's stdout is escaped rather than executed.
 */
import type { Event } from '@quorum/shared';
import type { ReactNode } from 'react';

import { partitionTrace, type TraceColumn } from './mission-control-model.js';

/** Inputs already accepted by the run connection. */
export interface MissionControlTraceProps {
  readonly events: readonly Event[];
}

/**
 * The one field each event kind carries that is meant to be read, verbatim — never composed,
 * parsed or reformatted. Exhaustive over the event union, so a widened union fails to compile
 * here rather than rendering a kind silently as nothing.
 */
function eventLine(event: Event): string {
  switch (event.type) {
    case 'spawn': return event.cmd;
    case 'stdout': return event.line;
    case 'retry': return event.message;
    case 'step': return event.message;
    case 'done': return event.message;
    case 'info': return event.message;
    case 'warn': return event.message;
    case 'gate': return event.reason;
    case 'terminal': return `${event.stageBefore} → ${event.stageAfter}`;
  }
}

/** One step's column: its exact id, its latest observed vendor, and its events in arrival order. */
function TraceColumnView({ column }: { readonly column: TraceColumn }): ReactNode {
  return (
    <div
      data-trace-step-id={column.stepId}
      className="flex w-64 shrink-0 flex-col gap-2 rounded border border-border bg-surface p-3"
    >
      <p className="font-mono text-xs text-muted">
        {column.stepId}
        {column.vendor === null ? null : <> · {column.vendor}</>}
      </p>
      <ol className="flex flex-col gap-1 text-xs text-text">
        {column.events.map((event, index) => (
          <li key={index} className="whitespace-pre-wrap break-words font-mono">
            {eventLine(event)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The run-activity lane and one column per exact `stepId`.
 *
 * The lane is always drawn, even with nothing in it: a run made of nothing but step-scoped events
 * still has a lane, and its absence would read as a rendering gap rather than as an empty run.
 */
export function MissionControlTrace({ events }: MissionControlTraceProps): ReactNode {
  const { columns, runActivity } = partitionTrace(events);
  return (
    <div className="flex gap-3 overflow-x-auto">
      <div
        data-run-activity
        className="flex w-64 shrink-0 flex-col gap-2 rounded border border-border bg-surface p-3"
      >
        <p className="font-mono text-xs text-muted">Run activity</p>
        <ol className="flex flex-col gap-1 text-xs text-text">
          {runActivity.map((event, index) => (
            <li key={index} className="whitespace-pre-wrap break-words font-mono">
              {eventLine(event)}
            </li>
          ))}
        </ol>
      </div>
      {columns.map((column) => (
        <TraceColumnView key={column.stepId} column={column} />
      ))}
    </div>
  );
}
