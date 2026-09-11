/** Same-origin daemon prefixes forwarded by the development server. */
export const DAEMON_ENDPOINTS = {
  runs: '/runs',
  project: '/project',
  tickets: '/tickets',
  flows: '/flows',
  history: '/history',
} as const;

/** The page-relative run-events path, with the handle confined to one segment. */
export function runEventsPath(handle: string): string {
  return `${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}/events`;
}

/** A same-origin WebSocket URL derived from the page URL and run handle. */
export function runEventsUrl(page: URL, handle: string): URL {
  const url = new URL(runEventsPath(handle), page);
  url.protocol = page.protocol.replace('http', 'ws');
  return url;
}
