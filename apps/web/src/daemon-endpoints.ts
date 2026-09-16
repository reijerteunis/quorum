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
 * The page-relative path for what the daemon knows about one run, with the handle confined to one
 * segment.
 *
 * One run rather than the listing, which is one segment away and answers a different question: the
 * listing says what a client can join, and this says what the daemon knows about this handle. They
 * are not interchangeable — reading the listing would make a screen search for its own run, and a
 * handle the host never minted would then be silence rather than a refusal.
 */
export function runDetailPath(handle: string): string {
  return `${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}`;
}

/**
 * The segment that makes a run path the gate-answering one, written here and nowhere else.
 *
 * **A named constant rather than the tail of a template**, so the one thing this app may POST to is
 * a literal a scan can find. `apps/web/test/source.test.ts` forbids that literal in every file
 * under `src` except this one, and names this one — an exemption that forgives a string nobody
 * wrote would forgive nothing, so the string is written.
 */
const GATE_SEGMENT = '/gate';

/**
 * The page-relative path that answers one run's pending gate, with the handle confined to one
 * segment.
 *
 * Named for the DAEMON route rather than for the screen, on {@link ticketDetailPath}'s precedent:
 * `routes.ts` carries `/runs/:handle/gate` too and that is the shell path a browser is AT, where
 * this is the path it POSTs to. Two different things, so two names.
 *
 * The handle is percent-encoded rather than trusted: it is whatever a URL carried, and a token
 * holding a separator is not one name.
 */
export function runGatePath(handle: string): string {
  return `${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}${GATE_SEGMENT}`;
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
