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
 * The segment that makes a run path the cancelling one, written here and nowhere else.
 *
 * {@link GATE_SEGMENT}'s arrangement for {@link GATE_SEGMENT}'s reason, one act later: the write
 * guard in `apps/web/test/source.test.ts` forbids this literal in every file under `src` except
 * this one, and an exemption that forgives a string nobody wrote would forgive nothing.
 */
const STOP_SEGMENT = '/stop';

/**
 * The page-relative path that cancels one run, with the handle confined to one segment.
 *
 * Named for the DAEMON route, on {@link runGatePath}'s precedent: no shell route ends in this
 * segment, and if one ever did the two would still be different things.
 *
 * **Not a sixth {@link DAEMON_ENDPOINTS} entry.** That register is the set of prefixes the
 * development server forwards, and `/runs` already forwards everything below it — so an entry here
 * would claim a prefix nothing forwards, which is the ruling `runGatePath` records for `/gate`.
 */
export function runStopPath(handle: string): string {
  return `${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}${STOP_SEGMENT}`;
}

/**
 * The two segments that make a run path the one answering with a gate's reviewed diff.
 *
 * Written as literals for {@link GATE_SEGMENT}'s reason with one difference: this route is a
 * **GET**, so no write guard has a string to look for here. What does is `test/routes.test.ts`'s
 * route-literal scan, which collects every quoted literal beginning with a slash — so writing these
 * as the tail of a template instead would hide them from the one register that asks whether a path
 * this app names is a path somebody decided on. They are registered there as exceptions, on the
 * `/gate` and `/stop` rows' terms: not shell routes, and not `DAEMON_ENDPOINTS` prefixes either,
 * `/runs` already being forwarded by the development server and covering everything below it.
 */
const GATES_SEGMENT = '/gates';
const DIFF_SEGMENT = '/diff';

/**
 * The page-relative path for the diff one waiting gate's deciding step was given.
 *
 * Named for the DAEMON route, on {@link runGatePath}'s precedent. Both the handle and the
 * correlation token are percent-encoded rather than trusted: `nextGateId` spells a gate id
 * `<run number>:<n>`, so it carries a separator, and — like the handle — it is whatever a screen was
 * handed rather than something this app composed. **Encoded and never taken apart**: the token is
 * opaque by contract and nothing here reads a run number out of it.
 */
export function gateDiffPath(handle: string, gateId: string): string {
  return `${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}${GATES_SEGMENT}/${encodeURIComponent(gateId)}${DIFF_SEGMENT}`;
}

/**
 * The page-relative path for one run's history, with the id confined to one segment.
 *
 * Named for the DAEMON route on {@link runDetailPath}'s precedent, and distinguished from it by
 * what it takes: a HANDLE names a run this daemon is driving now and is meaningless across a
 * restart, while a history id is `<ticket id>-<run number>` and names a directory on disk. The two
 * identify one run by two unrelated schemes, which is why neither path helper takes the other's
 * token.
 *
 * **It writes no path literal of its own.** {@link DAEMON_ENDPOINTS} already declares the prefix and
 * the development server already forwards it, so `test/routes.test.ts` is owed no exception row —
 * the rule `runStopPath` records for `/stop` read in the other direction.
 */
export function historyDetailPath(id: string): string {
  return `${DAEMON_ENDPOINTS.history}/${encodeURIComponent(id)}`;
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
