/** Typed component contract for mission-control state, identity, losses and disclosures. */
import type { WireRun } from '@quorum/shared';
import type { ReactNode } from 'react';

import type { RequestState } from './request-state.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs whose independent states the status regions must preserve. */
export interface MissionControlStatusProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly metadata: RequestState<WireRun>;
  readonly onRetryConnection: () => void;
  readonly onRetryMetadata: () => void;
  readonly onNavigate: (to: string) => void;
}

/** Render only values carried by the socket snapshot or loaded metadata. */
export function MissionControlStatus(_props: MissionControlStatusProps): ReactNode {
  throw new Error('not implemented');
}
