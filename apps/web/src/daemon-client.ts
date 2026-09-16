/**
 * Every request this app makes, in one module — and the first one it has ever made.
 *
 * Until Q-0017 `apps/web` held a WebSocket and no `fetch` at all, so this file is simultaneously the
 * app's first request, its first response parser, its first request-failure vocabulary and its first
 * not-yet-loaded moment. Keeping all four here is what stops the next screen inventing a fifth.
 *
 * **It names no host and no scheme.** Every path comes from {@link DAEMON_ENDPOINTS} and nowhere
 * else, so every request is same-origin and page-relative: the page was served by the daemon, so the
 * daemon is wherever the page came from, and a literal would be a second answer to a question the
 * browser has already answered. `apps/web/test/source.test.ts` refuses an absolute URL anywhere in
 * this package and `test/routes.test.ts` refuses a path literal the route register does not hold.
 *
 * **Every body is parsed before anything reads it.** A `JSON.parse` result assigned to an interface
 * is the silent default `.claude/rules/engineering.md` forbids, and `@quorum/shared` exports the
 * schemas for exactly this reason — the one place a wire shape is declared, executable in a browser.
 * A body that fails validation answers a failure state and never a half-rendered board.
 *
 * **Nothing here polls, keeps a copy, or persists.** One request per explicit act: a mount, or the
 * reader asking for it again. `GET /tickets` walks the backlog and probes git per ticket —
 * `containment`'s
 * own budget is up to 2n + 10 spawns, which at this repository's 105 tickets is a third of a second
 * — so a timer here would make the most expensive route on the transport this app's hot path, and
 * a cached copy would be the UI holding a git fact it cannot keep current.
 */
import {
  wireFlowListSchema, wireRefusalSchema, wireTicketDetailSchema, wireTicketFileSchema,
  wireTicketListSchema,
  type WireFlowList, type WireTicketDetail, type WireTicketFile, type WireTicketList,
} from '@quorum/shared';

import { DAEMON_ENDPOINTS, ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import type { RequestState } from './request-state.js';

/**
 * The part of a `Response` this module uses.
 *
 * Narrower than the real thing on purpose: it is the seam a test drives, and a test that had to
 * build a whole `Response` would be exercising the platform rather than this module.
 */
export interface DaemonResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/** How a request is actually made. Injected everywhere except in the browser. */
export type FetchLike = (path: string) => Promise<DaemonResponse>;

/** What the clock is, so a fetched-at instant is a value a test supplies rather than reads. */
export type Clock = () => string;

/**
 * The browser's own `fetch`, narrowed.
 *
 * The path is page-relative, which is what makes this same-origin without naming an origin.
 */
export const browserFetch: FetchLike = (path) => fetch(path);

/** The wall clock, as an ISO 8601 instant — a value that does not vary with a machine's locale. */
export const isoClock: Clock = () => new Date().toISOString();

/** A schema this module can execute over a parsed body, without naming zod's own types here. */
interface BodySchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}

/**
 * One GET against the daemon, turned into one {@link RequestState}.
 *
 * The four failure paths are told apart rather than collapsed, in the order they can occur: the
 * request never completed, the body was not JSON, the daemon refused, the body was not the shape it
 * claims. A client that could not tell them apart could not tell "start the daemon" from "this page
 * is the wrong version".
 *
 * A non-2xx whose body IS a refusal carries the daemon's own `code`, `condition` and `remedy`
 * through unaltered; one whose body is anything else is still reported as a refusal, under a code
 * naming the status, because the alternative is reporting a request that was answered as one that
 * was not.
 */
export async function requestJson<T>(
  fetcher: FetchLike,
  path: string,
  schema: BodySchema<T>,
  now: Clock,
): Promise<RequestState<T>> {
  let response: DaemonResponse;
  try {
    response = await fetcher(path);
  } catch {
    return { kind: 'unreachable', path };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unparseable', path, problem: 'the response body was not JSON' };
  }

  if (!response.ok) {
    const refusal = wireRefusalSchema.safeParse(body);
    return refusal.success
      ? { kind: 'refused', path, refusal: refusal.data }
      : {
        kind: 'refused',
        path,
        refusal: {
          code: `http-${String(response.status)}`,
          condition: `the daemon answered ${String(response.status)} and no refusal this page could read`,
          remedy: null,
        },
      };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return { kind: 'unparseable', path, problem: parsed.error.message };
  return { kind: 'loaded', value: parsed.data, fetchedAt: now() };
}

/** The backlog, as the daemon reports it — rows plus the repository's one push-lag fact. */
export const fetchTickets = (fetcher: FetchLike, now: Clock): Promise<RequestState<WireTicketList>> =>
  requestJson(fetcher, DAEMON_ENDPOINTS.tickets, wireTicketListSchema, now);

/** The flow directory, refused files included — a flow the linter rejects is named, never hidden. */
export const fetchFlows = (fetcher: FetchLike, now: Clock): Promise<RequestState<WireFlowList>> =>
  requestJson(fetcher, DAEMON_ENDPOINTS.flows, wireFlowListSchema, now);

/** One ticket: the row a board card carries, plus the names and sizes of the files beside it. */
export const fetchTicket = (fetcher: FetchLike, id: string, now: Clock): Promise<RequestState<WireTicketDetail>> =>
  requestJson(fetcher, ticketDetailPath(id), wireTicketDetailSchema, now);

/**
 * One file of one ticket, with its text.
 *
 * Separate from {@link fetchTicket} because that is what keeps this app from loading a folder to
 * render a tab: the largest ticket folder in this repository's backlog is 3.1 MB and its largest
 * single file 1.46 MB, so nothing large is asked for until a reader names that file with its size in
 * front of them.
 */
export const fetchTicketFile = (
  fetcher: FetchLike,
  id: string,
  rel: string,
  now: Clock,
): Promise<RequestState<WireTicketFile>> =>
  requestJson(fetcher, ticketFilePath(id, rel), wireTicketFileSchema, now);

/**
 * The in-flight state for each request, so a screen can say what it is waiting for without
 * naming a path of its own.
 *
 * A caller that built its own would be the second place a daemon path is written down, which is the
 * arrangement this module exists to prevent — and its in-flight sentence would then be able to name
 * something the request does not ask for.
 */
export const ticketsInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.tickets });

/** The flow listing's in-flight state, on {@link ticketsInFlight}'s terms. */
export const flowsInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.flows });

/** One ticket's in-flight state, naming the ticket rather than the backlog. */
export const ticketInFlight = <T>(id: string): RequestState<T> => ({ kind: 'in-flight', path: ticketDetailPath(id) });

/** One file's in-flight state, naming the file a reader asked for. */
export const ticketFileInFlight = <T>(id: string, rel: string): RequestState<T> =>
  ({ kind: 'in-flight', path: ticketFilePath(id, rel) });
