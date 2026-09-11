/** Same-origin daemon prefixes forwarded by the development server. */
export const DAEMON_ENDPOINTS = {
  runs: '/runs',
  project: '/project',
  tickets: '/tickets',
  flows: '/flows',
  history: '/history',
} as const;

/** The page-relative run-events path, with the handle confined to one segment. */
export function runEventsPath(_handle: string): string {
  throw new Error('not implemented');
}

/** A same-origin WebSocket URL derived from the page URL and run handle. */
export function runEventsUrl(_page: URL, _handle: string): URL {
  throw new Error('not implemented');
}
