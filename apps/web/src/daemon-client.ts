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
 *
 * **Since Q-0130 exactly three requests here are not GETs**, and they are the whole of what this
 * app does to a run: it starts one, it answers a pending gate, and it cancels one. Nothing else
 * moves — no stage is moved by this app, no run lock is taken by it, no file under a ticket folder
 * is written by it — and `apps/web/test/source.test.ts` holds that boundary by name rather than by
 * absence, exempting this module for the method, the endpoint module for the two path segments, and
 * registering the three functions below by name so that a fourth writer is a visible act.
 */
import {
  diffEvidenceSchema, gateAnswerEnvelopeSchema,
  wireFlowListSchema, wireRefusalSchema, wireRunListSchema, wireRunSchema, wireStartRequestSchema,
  wireTicketDetailSchema, wireTicketFileSchema, wireTicketListSchema,
  type DiffEvidence, type GateAnswer, type WireFlowList, type WireRun, type WireRunList,
  type WireStartRequest, type WireTicketDetail, type WireTicketFile, type WireTicketList,
} from '@quorum/shared';

import {
  DAEMON_ENDPOINTS, gateDiffPath, runDetailPath, runGatePath, runStopPath, ticketDetailPath,
  ticketFilePath,
} from './daemon-endpoints.js';
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

/**
 * What a request that is not a GET carries — the one shape this module ever sends.
 *
 * `method` is the literal and not a string, so the set of things this app can do to the daemon is
 * closed by the compiler rather than by a scan alone: a `DELETE` does not typecheck here.
 */
export interface DaemonRequest {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * How a request is actually made. Injected everywhere except in the browser.
 *
 * The second parameter is optional, so every reader in this module goes on calling it with a path
 * alone and a GET stays what a call with no second argument means.
 */
export type FetchLike = (path: string, request?: DaemonRequest) => Promise<DaemonResponse>;

/** What the clock is, so a fetched-at instant is a value a test supplies rather than reads. */
export type Clock = () => string;

/**
 * The browser's own `fetch`, narrowed.
 *
 * The path is page-relative, which is what makes this same-origin without naming an origin.
 */
export const browserFetch: FetchLike = (path, request) => fetch(path, request);

/** The wall clock, as an ISO 8601 instant — a value that does not vary with a machine's locale. */
export const isoClock: Clock = () => new Date().toISOString();

/** A schema this module can execute over a parsed body, without naming zod's own types here. */
interface BodySchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { message: string } };
}

/**
 * A non-2xx answer as a refusal, carrying the daemon's own words where the body holds them.
 *
 * One function rather than one per caller, because the fallback is the interesting half: a body
 * that is not a {@link WireRefusal} is still reported as the daemon having ANSWERED, under a code
 * naming the status, since reporting a request that was answered as one that was not would send a
 * reader to restart a process that is running.
 */
function refused<T>(path: string, status: number, body: unknown): RequestState<T> {
  const refusal = wireRefusalSchema.safeParse(body);
  return refusal.success
    ? { kind: 'refused', path, refusal: refusal.data }
    : {
      kind: 'refused',
      path,
      refusal: {
        code: `http-${String(status)}`,
        condition: `the daemon answered ${String(status)} and no refusal this page could read`,
        remedy: null,
      },
    };
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

  if (!response.ok) return refused(path, response.status, body);

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
 * One run, as the daemon reports it now — including the questions its gates are asking.
 *
 * Read on mount and when a reader asks again, like everything else here. There is no subscription:
 * a run's event stream is mission control's subject, and what a gate screen needs from a run is one
 * answer to *what is it waiting on right now*, which this is.
 */
export const fetchRun = (fetcher: FetchLike, handle: string, now: Clock): Promise<RequestState<WireRun>> =>
  requestJson(fetcher, runDetailPath(handle), wireRunSchema, now);

/** Read the daemon's ordered run listing once; callers decide when an explicit refresh repeats it. */
export const fetchRuns = (fetcher: FetchLike, now: Clock): Promise<RequestState<WireRunList>> =>
  requestJson(fetcher, DAEMON_ENDPOINTS.runs, wireRunListSchema, now);

/**
 * The diff the step whose decision reached one waiting gate was given.
 *
 * **A separate request from {@link fetchRun} and not a field on it**, which is {@link fetchTicketFile}'s
 * arrangement for its reason one register over: a patch is bounded by `repo.max_diff_bytes` — 200,000
 * by default — where a run row is a few hundred bytes, and every screen that reads a run would
 * otherwise carry one. It is asked for only where a gate is waiting and a reader is looking at it.
 *
 * **Its `no-diff` refusal is an ANSWER**, and a caller is expected to say so rather than to retry: a
 * gate whose deciding step read no diff is the ordinary case in four of the six flows this product
 * ships, and the daemon reports it as a coded refusal rather than as an empty patch precisely so the
 * two can be told apart. {@link NO_DIFF_CODE} is the code, and the screen renders its own sentence.
 */
export const fetchGateDiff = (
  fetcher: FetchLike,
  handle: string,
  gateId: string,
  now: Clock,
): Promise<RequestState<DiffEvidence>> =>
  requestJson(fetcher, gateDiffPath(handle, gateId), diffEvidenceSchema, now);

/**
 * The refusal code that means the gate is waiting and nothing was reviewed for it.
 *
 * Declared beside the request that meets it, as {@link BROWSER_STOP_REASON} is: it is a value of
 * this exchange rather than of a screen, and a second spelling on the screen would be a second place
 * to be wrong about a word the daemon chooses.
 */
export const NO_DIFF_CODE = 'no-diff';

/**
 * The status the gate and stop routes answer a request they took with. No body, and none is read.
 *
 * One constant for both, because it is one fact about this transport rather than two that agree:
 * both routes `return c.body(null, 204)`, and a second literal would be a second place to be wrong
 * about a status neither of them sends a body with.
 */
const ACCEPTED = 204;

/**
 * The status the start route answers a run it has begun with — `201`, and it carries a body.
 *
 * **It is the one write on this transport whose success is not {@link ACCEPTED}**, and the
 * difference is load-bearing rather than cosmetic: the handle a run is named by is minted inside
 * the daemon and reaches a client in that body and nowhere else. A `startRun` written to the gate
 * answer's shape would discard the only thing the exchange establishes, and then report every
 * successful start as a disagreement about what starting a run looks like.
 */
const STARTED = 201;

/**
 * Answer one pending gate, and say what the daemon did about it.
 *
 * **The success is a status and not a body.** `POST /runs/:id/gate` answers `204` with nothing at
 * all, so this recognises it before anything reads a body — routed through {@link requestJson} it
 * would be reported as *the response body was not JSON*, which is a successful answer rendered as a
 * failure. The `loaded` value is therefore the answer that was ACCEPTED, which is the only thing
 * this exchange establishes: what the run does next is a read, not an inference from a 204.
 *
 * **Two of its refusals share a status, and the code is what tells them apart.** `no-such-run` and
 * `no-such-gate` are both `404` — *that handle names no run* against *that gate is no longer
 * waiting*, which say opposite things to a reader — so the body's `code` crosses through unaltered
 * and nothing here branches on the status alone.
 *
 * The envelope is built through `@quorum/shared`'s own schema, so the two fields and their names
 * come from the contract rather than from a literal here; `gates.ts` is what validates it, and a
 * second copy of the answer vocabulary in this app would be the drift that contract exists to stop.
 */
export async function answerGate(
  fetcher: FetchLike,
  handle: string,
  gateId: string,
  answer: GateAnswer,
  now: Clock,
): Promise<RequestState<GateAnswer>> {
  const path = runGatePath(handle);
  let response: DaemonResponse;
  try {
    response = await fetcher(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gateAnswerEnvelopeSchema.parse({ gateId, answer })),
    });
  } catch {
    return { kind: 'unreachable', path };
  }
  // Before any body is read, which is the property AC-4 asks for rather than an optimisation.
  if (response.status === ACCEPTED) return { kind: 'loaded', value: answer, fetchedAt: now() };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unparseable', path, problem: 'the response body was not JSON' };
  }
  if (!response.ok) return refused(path, response.status, body);
  // A 2xx that is not the one this route answers with. Reported rather than taken for a success:
  // this page and the daemon disagree about what answering a gate looks like, which is a thing to
  // say and not a thing to assume went well.
  return {
    kind: 'unparseable',
    path,
    problem: `the daemon answered ${String(response.status)} where answering a gate is ${String(ACCEPTED)} and no body`,
  };
}

/**
 * Ask the daemon to start one run, and say what it did about it.
 *
 * **Its success is a body and not a status**, which is the one place this differs from
 * {@link answerGate} and the reason the two are not one shape written twice. `POST /runs` answers
 * {@link STARTED} carrying the run it began, and the handle in that body is the only name the run
 * has: handles are minted inside the daemon from a counter, and recovering one afterwards from the
 * listing would mean matching the newest row for a flow and a ticket, which is inference rather than
 * identity and is wrong outright for two starts in the same second. So the `loaded` value is that
 * run, parsed before anything reads it.
 *
 * A `2xx` that is not {@link STARTED} is reported rather than taken for a success: this page and the
 * daemon disagreeing about what starting a run looks like is a thing to say and not a thing to
 * assume went well — and that check is made **before the success body is read**, as
 * {@link answerGate}'s status check is, because a 2xx this route does not answer with may carry no
 * body at all and reading first would report the disagreement as a body that failed to parse. Its
 * refusals cross through {@link refused} unaltered, and two pairs of them
 * share a status — `no-such-ticket` against `no-such-flow`, and `lock-held` against `not-runnable` —
 * so the body's `code` is what tells them apart and nothing here branches on the status alone.
 *
 * The body is built through `@quorum/shared`'s own schema, which is {@link answerGate}'s arrangement
 * for {@link answerGate}'s reason: the field names come from the contract rather than from a literal
 * here, and a second copy of them in this app would be the drift that contract exists to stop.
 */
export async function startRun(
  fetcher: FetchLike,
  request: WireStartRequest,
  now: Clock,
): Promise<RequestState<WireRun>> {
  const path = DAEMON_ENDPOINTS.runs;
  let response: DaemonResponse;
  try {
    response = await fetcher(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(wireStartRequestSchema.parse(request)),
    });
  } catch {
    return { kind: 'unreachable', path };
  }

  // A refusal's body is where the daemon's own words are, so it is read on this path and on this
  // path alone.
  if (!response.ok) {
    let refusalBody: unknown;
    try {
      refusalBody = await response.json();
    } catch {
      return { kind: 'unparseable', path, problem: 'the response body was not JSON' };
    }
    return refused(path, response.status, refusalBody);
  }

  // **Before the success body is read rather than after it**, which is the property and not an
  // ordering preference: a 2xx this route does not answer with need carry no body at all — a `204`
  // carries none by definition — so reading first reports the disagreement as *the response body
  // was not JSON*, a true sentence about the wrong thing that sends a reader looking for a parser
  // defect. Checking here also keeps the case the shape cannot see: a `200` carrying a perfectly
  // good run is still reported, because the disagreement is about the exchange rather than about
  // the body, and a schema that accepts it is blind to that.
  if (response.status !== STARTED) {
    return {
      kind: 'unparseable',
      path,
      problem: `the daemon answered ${String(response.status)} where starting a run is ${String(STARTED)} and the run it started`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unparseable', path, problem: 'the response body was not JSON' };
  }
  const parsed = wireRunSchema.safeParse(body);
  if (!parsed.success) return { kind: 'unparseable', path, problem: parsed.error.message };
  return { kind: 'loaded', value: parsed.data, fetchedAt: now() };
}

/**
 * The note a stop this app sent records, so run history says WHERE the cancellation came from.
 *
 * The daemon's own `DEFAULT_STOP_REASON` records only that the host did it, which is true of a
 * shutdown, of a signal and of this — so a run stopped from a browser and a run released by a
 * daemon closing would read the same afterwards. One constant rather than a field a reader fills
 * in: what is wanted is provenance, and a free-text box would be this page asking for a sentence
 * nobody needs and then having to refuse the blank one the daemon refuses anyway.
 */
export const BROWSER_STOP_REASON = 'stopped by a reader in the Quorum web app';

/**
 * Cancel one run, and say what the daemon did about it.
 *
 * **The success is a status and not a body**, exactly as {@link answerGate}'s is and for the same
 * reason: `POST /runs/:id/stop` answers {@link ACCEPTED} with nothing at all, so this recognises it
 * before anything reads a body — routed through {@link requestJson} it would be reported as *the
 * response body was not JSON*, which is a delivered cancellation rendered as a failure.
 *
 * **What the `loaded` state establishes is that the cancellation was DELIVERED, and nothing else.**
 * The daemon aborts the run's `AbortSignal` and answers; the run stays running until the work
 * already in flight unwinds, so a screen inferring *the run has ended* from this status would be
 * claiming the half the exchange did not carry. The same holds in the other direction: a
 * `not-running` refusal does not prove the run completed either.
 *
 * The note is {@link BROWSER_STOP_REASON} and is never blank — `host.stop` refuses a whitespace-only
 * one under `not-a-reason`, and sending one would be this page asking for a refusal it could have
 * avoided.
 */
export async function stopRun(
  fetcher: FetchLike,
  handle: string,
  now: Clock,
): Promise<RequestState<string>> {
  const path = runStopPath(handle);
  let response: DaemonResponse;
  try {
    response = await fetcher(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: BROWSER_STOP_REASON }),
    });
  } catch {
    return { kind: 'unreachable', path };
  }
  // Before any body is read, which is the property AC-4 asks for rather than an optimisation.
  if (response.status === ACCEPTED) return { kind: 'loaded', value: BROWSER_STOP_REASON, fetchedAt: now() };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unparseable', path, problem: 'the response body was not JSON' };
  }
  if (!response.ok) return refused(path, response.status, body);
  return {
    kind: 'unparseable',
    path,
    problem: `the daemon answered ${String(response.status)} where cancelling a run is ${String(ACCEPTED)} and no body`,
  };
}

/**
 * The in-flight state for each request, so a screen can say what it is waiting for without
 * naming a path of its own.
 *
 * A caller that built its own would be the second place a daemon path is written down, which is the
 * arrangement this module exists to prevent — and its in-flight sentence would then be able to name
 * something the request does not ask for.
 */
export const ticketsInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.tickets });
/** The runs listing's, beside its siblings rather than inside the screen. Review round 3, N-6. */
export const runsInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.runs });

/** The flow listing's in-flight state, on {@link ticketsInFlight}'s terms. */
export const flowsInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.flows });

/** One ticket's in-flight state, naming the ticket rather than the backlog. */
export const ticketInFlight = <T>(id: string): RequestState<T> => ({ kind: 'in-flight', path: ticketDetailPath(id) });

/** One file's in-flight state, naming the file a reader asked for. */
export const ticketFileInFlight = <T>(id: string, rel: string): RequestState<T> =>
  ({ kind: 'in-flight', path: ticketFilePath(id, rel) });

/** One run's in-flight state, naming the run rather than the listing. */
export const runInFlight = <T>(handle: string): RequestState<T> =>
  ({ kind: 'in-flight', path: runDetailPath(handle) });

/** One gate's diff read, in flight — naming that gate rather than the run it belongs to. */
export const gateDiffInFlight = <T>(handle: string, gateId: string): RequestState<T> =>
  ({ kind: 'in-flight', path: gateDiffPath(handle, gateId) });

/**
 * The in-flight state of an answer on its way to a gate.
 *
 * It exists for the same reason the others do and for one more: it is what a screen holds while an
 * answer is outstanding, so *one answer in flight* is a state rather than a flag beside one.
 */
export const gateAnswerInFlight = <T>(handle: string): RequestState<T> =>
  ({ kind: 'in-flight', path: runGatePath(handle) });

/**
 * The in-flight state of a start on its way to the daemon.
 *
 * It names the listing's own path, because that is the path a start is POSTed to — one route
 * answering two questions by method, which is why this is declared beside {@link runsInFlight}
 * rather than folded into it: the two are the same string and different sentences.
 */
export const startRunInFlight = <T>(): RequestState<T> => ({ kind: 'in-flight', path: DAEMON_ENDPOINTS.runs });

/** The in-flight state of a cancellation on its way to one run. */
export const runStopInFlight = <T>(handle: string): RequestState<T> =>
  ({ kind: 'in-flight', path: runStopPath(handle) });
