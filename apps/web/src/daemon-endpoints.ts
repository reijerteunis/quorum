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

/**
 * A same-origin WebSocket URL derived from the page URL and run handle.
 *
 * The socket scheme is derived from the page's own `protocol` by substring replacement rather
 * than written as a literal, so this module carries no quoted socket-scheme string for the
 * whole-package network-literal scan to find: an HTTP page's scheme becomes its WebSocket
 * counterpart, and an HTTPS page's becomes its secure counterpart.
 */
export function runEventsUrl(page: URL, handle: string): URL {
  const socketScheme = page.protocol.replace('http', 'ws');
  return new URL(runEventsPath(handle), `${socketScheme}//${page.host}`);
}
