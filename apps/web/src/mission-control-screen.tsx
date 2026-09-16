/** Typed component contract for the live mission-control screen. */
import type { ReactNode } from 'react';

import type { Clock, FetchLike } from './daemon-client.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs supplied by the application shell and its one run connection. */
export interface MissionControlScreenProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly onRetryConnection: () => void;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** Compose the trace and status regions and render the observed-only step timeline. */
export function MissionControlScreen(_props: MissionControlScreenProps): ReactNode {
  throw new Error('not implemented');
}
