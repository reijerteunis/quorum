/** Typed component contract for the live mission-control screen. */
import type { ReactNode } from 'react';

import type { Clock, FetchLike } from './daemon-client.js';
import type { RunConnectionSnapshot } from './run-connection.js';

/** Inputs supplied by the application shell and its one run connection. */
export interface MissionControlScreenProps {
  readonly handle: string;
  readonly snapshot: RunConnectionSnapshot;
  readonly connectionText: string;
  readonly retryable: boolean;
  readonly onRetryConnection: () => void;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** The live trace, timeline, disclosures and metadata for one handle. */
export function MissionControlScreen(_props: MissionControlScreenProps): ReactNode {
  throw new Error('not implemented');
}
