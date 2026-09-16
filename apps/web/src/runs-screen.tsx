/** Typed component contract for the runs landing. */
import type { ReactNode } from 'react';

import type { Clock, FetchLike } from './daemon-client.js';

/** Inputs supplied by the application shell. */
export interface RunsScreenProps {
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** The read-only landing at the registered runs path. */
export function RunsScreen(_props: RunsScreenProps): ReactNode {
  throw new Error('not implemented');
}
