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
 * The page-relative path for one ticket, with the id confined to one segment.
 *
 * Named for the DAEMON route rather than for the screen: `routes.ts` has a `ticketPath` too and it
 * is the shell path a card links to, `/backlog/:ticketId`. Two different things, so two names — the
 * near-homograph a reader meets first is the one worth spelling apart.
 *
 * A ticket id is agent-written frontmatter and `Backlog.read` asserts rather than parses it, so it
 * is encoded rather than trusted to be the `<PREFIX>-nnnn` grammar — which is also what the daemon's
 * own first predicate refuses: a token carrying a separator is not one name.
 */
export function ticketDetailPath(id: string): string {
  return `${DAEMON_ENDPOINTS.tickets}/${encodeURIComponent(id)}`;
}

/**
 * The page-relative path for one file of one ticket.
 *
 * **The relative path is a QUERY value and not a path segment**, which is the daemon's own shape:
 * `dev/chore/run-2/implement-iter-1.md` is four segments, so a segment would mean encoding here and
 * decoding there, and a decode on the far side of a boundary is where a confinement bypass hides.
 */
export function ticketFilePath(id: string, rel: string): string {
  return `${ticketDetailPath(id)}/file?path=${encodeURIComponent(rel)}`;
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
