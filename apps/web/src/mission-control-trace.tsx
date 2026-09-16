/** Typed component contract for the lossless run lane and per-step trace columns. */
import type { Event } from '@quorum/shared';
import type { ReactNode } from 'react';

/** Inputs already accepted by the run connection. */
export interface MissionControlTraceProps {
  readonly events: readonly Event[];
}

/** Render the run-activity lane and exact-step-id columns without parsing event prose. */
export function MissionControlTrace(_props: MissionControlTraceProps): ReactNode {
  throw new Error('not implemented');
}
