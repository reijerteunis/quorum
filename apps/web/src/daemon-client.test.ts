/**
 * Q-0017 AC-3 — every request this app makes goes through one module, and every body is parsed.
 *
 * Driven through an injected fetch rather than a real one: the claim is about what this module does
 * with an answer, and a test that opened a socket would be exercising the platform. It also keeps
 * the suite from making an outbound connection, which is the defect Q-0120's review round 1 found
 * in the file next door.
 */
import { describe, expect, test } from 'vitest';

import { WIRE_START_FIELDS } from '@quorum/shared';

import { DAEMON_ENDPOINTS, runDetailPath, runGatePath, runStopPath, ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import {
  answerGate, BROWSER_STOP_REASON, fetchFlows, fetchRun, fetchRuns, fetchTicket, fetchTicketFile,
  fetchTickets, flowsInFlight, gateAnswerInFlight, requestJson, runInFlight, runStopInFlight,
  startRun, startRunInFlight, stopRun, ticketFileInFlight, ticketInFlight, ticketsInFlight,
  type DaemonRequest, type DaemonResponse, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, type RequestState } from './request-state.js';
import { START_REFUSAL_TEXT, STOP_REFUSAL_TEXT, refusalSentence } from './run-lifecycle.js';

/** A clock a test owns, so a fetched-at instant is a value rather than a property of the machine. */
const CLOCK = (): string => '2026-09-16T09:00:00.000Z';

/** A well-formed listing, which every clause below starts from and changes one thing in. */
const LISTING = {
  tickets: [{
    id: 'Q-0017', folder: 'Q-0017-backlog-board-and-ticket-page', title: 'Backlog board',
    stage: 'requirements', owner: 'ruud',
    branch: 'harness/Q-0017/integration', containment: { state: 'contained' },
    iterations: {}, billedCostUsd: null,
  }],
  pushLag: null,
  baseBranch: 'main',
};

describe('Q-0015 AC-1 — fetchRuns is the one validated runs-list read', () => {
  const body = { runs: [{ handle: 'run-b', flow: 'development', ticketId: null, runId: null, state: 'running', pendingGates: 0, gates: [], refusal: null }] };

  test('loads the registered endpoint exactly once and preserves the clock value', async () => {
    const server = answering(body);
    await expect(fetchRuns(server.fetch, CLOCK)).resolves.toStrictEqual({ kind: 'loaded', value: body, fetchedAt: CLOCK() });
    expect(server.asked).toStrictEqual([DAEMON_ENDPOINTS.runs]);
  });

  test('uses the existing failure vocabulary for rejection, refusal, and invalid shape', async () => {
    await expect(fetchRuns(() => Promise.reject(new Error('down')), CLOCK)).resolves.toMatchObject({ kind: 'unreachable' });
    await expect(fetchRuns(answering({ code: 'no-project', condition: 'missing', remedy: null }, 404).fetch, CLOCK))
      .resolves.toMatchObject({ kind: 'refused', refusal: { code: 'no-project' } });
    await expect(fetchRuns(answering({ runs: [{ handle: 'missing fields' }] }).fetch, CLOCK))
      .resolves.toMatchObject({ kind: 'unparseable' });
  });
});

/** A fetch that answers `body` with `status`, recording every path it was asked for. */
const answering = (body: unknown, status = 200): { fetch: (path: string) => Promise<DaemonResponse>; asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    fetch: (path: string) => {
      asked.push(path);
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
    },
  };
};

describe('AC-3 — the paths come from the endpoint register and from nowhere else', () => {
  test('each reader asks for exactly its own registered path', async () => {
    const tickets = answering(LISTING);
    await fetchTickets(tickets.fetch, CLOCK);
    expect(tickets.asked).toStrictEqual([DAEMON_ENDPOINTS.tickets]);

    const flows = answering({ flows: [] });
    await fetchFlows(flows.fetch, CLOCK);
    expect(flows.asked).toStrictEqual([DAEMON_ENDPOINTS.flows]);
  });

  test('and the in-flight state names the same path the request will ask for', () => {
    // A screen says what it is waiting for, and what it says has to be what is actually being
    // fetched — a sentence assembled beside the request could name something else entirely.
    expect(ticketsInFlight()).toStrictEqual({ kind: 'in-flight', path: DAEMON_ENDPOINTS.tickets });
    expect(flowsInFlight()).toStrictEqual({ kind: 'in-flight', path: DAEMON_ENDPOINTS.flows });
  });

  test('every path is page-relative, so nothing here names a host or a scheme', () => {
    for (const path of Object.values(DAEMON_ENDPOINTS)) {
      expect(path.startsWith('/'), `${path} is not page-relative`).toBe(true);
      expect(path.includes(':'), `${path} carries a scheme`).toBe(false);
    }
  });
});

describe('AC-3 — a body is parsed before anything reads it, and a bad one is a failure state', () => {
  test('a well-formed listing loads, carrying the instant it was fetched', async () => {
    const state = await fetchTickets(answering(LISTING).fetch, CLOCK);
    expect(state.kind).toBe('loaded');
    if (state.kind !== 'loaded') return;
    expect(state.value.tickets[0].id).toBe('Q-0017');
    expect(state.fetchedAt).toBe(CLOCK());
  });

  test('a body with `stage` removed answers a failure state rather than a ticket list', async () => {
    // The criterion's own fixture. A `JSON.parse` result assigned to an interface is the silent
    // default the rules forbid — this is what makes the refusal visible instead.
    const { tickets: [row], ...rest } = LISTING;
    const { stage: _dropped, ...withoutStage } = row;
    const state = await fetchTickets(answering({ ...rest, tickets: [withoutStage] }).fetch, CLOCK);
    expect(state.kind, 'a listing missing a required field was reported as loaded').toBe('unparseable');
    if (state.kind !== 'unparseable') return;
    expect(state.problem.length, 'the failure says nothing about what was wrong').toBeGreaterThan(0);
  });

  test('nothing answering at all is unreachable, and is not a refusal', async () => {
    const state = await fetchTickets(() => Promise.reject(new Error('connection refused')), CLOCK);
    expect(state.kind).toBe('unreachable');
  });

  test('a body that is not JSON is told apart from one that is the wrong shape', async () => {
    const state = await requestJson(
      () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('Unexpected token')) }),
      DAEMON_ENDPOINTS.tickets,
      { safeParse: () => ({ success: true, data: null }) },
      CLOCK,
    );
    expect(state.kind).toBe('unparseable');
    if (state.kind !== 'unparseable') return;
    expect(state.problem).toContain('not JSON');
  });

  test('a refusal body crosses through unaltered, and a non-refusal 4xx is still a refusal', async () => {
    const refusal = { code: 'no-project', condition: 'no harness/harness.yaml found', remedy: 'run quorum init' };
    const refused = await fetchTickets(answering(refusal, 404).fetch, CLOCK);
    expect(refused.kind).toBe('refused');
    if (refused.kind === 'refused') expect(refused.refusal).toStrictEqual(refusal);

    // A 500 with an HTML error page, or any body this page cannot read: still reported as the
    // daemon having answered, because reporting it as unreachable would send a reader to restart a
    // process that is running.
    const garbage = await fetchTickets(answering({ oops: true }, 500).fetch, CLOCK);
    expect(garbage.kind).toBe('refused');
    if (garbage.kind === 'refused') {
      expect(garbage.refusal.code).toContain('500');
      expect(garbage.refusal.condition).toContain('500');
    }
  });

  test('a 200 whose body is a refusal is still parsed as the listing it claims to be', async () => {
    // The discriminating direction: the status decides which branch is taken, not the body's shape.
    // Without it a listing that happened to carry `code`/`condition`/`remedy` keys would be read as
    // a refusal, and a refusal answered with 200 would be rendered as a board.
    const state = await fetchTickets(answering({ code: 'c', condition: 'x', remedy: null }).fetch, CLOCK);
    expect(state.kind).toBe('unparseable');
  });
});

/**
 * Q-0127 AC-8 — the two readers this ticket adds, each over every answer its route can give.
 *
 * The clauses above cover `fetchTickets` and `fetchFlows` and cover neither of these, which is what
 * chore run 2's second review found: the component suite drives the detail request through the
 * page's broad states and one file refusal, and a screen test cannot say whether a body was
 * **validated** — a client that assigned `JSON.parse`'s result to an interface renders identically
 * until the day the daemon's shape moves. So both are driven here, at the layer where the schema is
 * executed, over the same five answers and against their own generated paths.
 *
 * **Five answers rather than three states**, because three of the five share a kind: two refusals
 * and two unparseable bodies. What tells each from its sibling is the code or the problem, so the
 * table asserts the pair and the block below asserts that the five pairs really are five.
 */
describe('AC-8 — fetchTicket and fetchTicketFile, over every answer their routes give', () => {
  const TICKET = 'Q-0127';
  const REL = 'dev/chore/run-2/implement-iter-1.md';

  /** One ticket row, in the shape `wireTicketSchema` accepts. */
  const ROW = {
    id: TICKET, folder: `${TICKET}-the-ticket-page`, title: 'The ticket page', stage: 'requirements',
    owner: 'ruud', branch: `harness/${TICKET}/integration`,
    containment: { state: 'not-contained', ahead: 3 }, iterations: { implement: 2 }, billedCostUsd: 12.5,
  };

  /** A detail body, and a file body — each what its route answers on the happy path. */
  const DETAIL = { ticket: ROW, files: [{ rel: REL, bytes: 4096 }], excluded: { count: 6, bytes: 8192 } };
  const FILE = { rel: REL, bytes: 11, text: 'a report\nx\n' };

  /** What one answer came to, reduced to the pair a reader acts on. */
  const signature = (state: RequestState<unknown>): string => {
    switch (state.kind) {
      case 'refused':
        return `refused:${state.refusal.code}`;
      case 'unparseable':
        return `unparseable:${state.problem.slice(0, 40)}`;
      default:
        return state.kind;
    }
  };

  /** A fetch answering `body` with `status`, or one whose body cannot be parsed at all. */
  const gives = (body: unknown, status = 200): FetchLike => (path: string) => {
    asked.push(path);
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  };
  const givesNotJson = (): FetchLike => (path: string) => {
    asked.push(path);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('Unexpected token <')) });
  };

  let asked: string[] = [];

  /**
   * The two readers, each with its path, the body its schema accepts, a body that is well formed
   * JSON and the wrong shape, and the two refusals its own route raises.
   *
   * The refusal codes are the daemon's, not invented here: `read.ts` answers `no-such-ticket` and
   * `malformed-ticket` for one route and `no-such-file` and `unsupported-file-encoding` for the
   * other, which is what makes the 404 and the 422 two answers rather than one status apart.
   */
  const READERS = [
    {
      named: 'fetchTicket',
      path: ticketDetailPath(TICKET),
      read: (fetcher: FetchLike): Promise<RequestState<unknown>> => fetchTicket(fetcher, TICKET, CLOCK),
      good: DETAIL,
      // Well-formed JSON, and not the shape: a listed file with no `bytes`, which is the one field
      // that tells a reader what a file costs before asking for it.
      wrongShape: { ...DETAIL, files: [{ rel: REL }] },
      notFound: 'no-such-ticket',
      unprocessable: 'malformed-ticket',
    },
    {
      named: 'fetchTicketFile',
      path: ticketFilePath(TICKET, REL),
      read: (fetcher: FetchLike): Promise<RequestState<unknown>> => fetchTicketFile(fetcher, TICKET, REL, CLOCK),
      good: FILE,
      // The file's own text missing, which is the whole of what this route exists to carry.
      wrongShape: { rel: REL, bytes: 11 },
      notFound: 'no-such-file',
      unprocessable: 'unsupported-file-encoding',
    },
  ] as const;

  for (const reader of READERS) {
    describe(reader.named, () => {
      /** The five answers, each named for what the daemon did rather than for what it returned. */
      const cases = (): { named: string; fetcher: FetchLike; kind: string; signature: string }[] => [
        {
          named: 'a body its schema accepts',
          fetcher: gives(reader.good),
          kind: 'loaded',
          signature: 'loaded',
        },
        {
          named: 'a 404 refusal',
          fetcher: gives({ code: reader.notFound, condition: 'not there', remedy: null }, 404),
          kind: 'refused',
          signature: `refused:${reader.notFound}`,
        },
        {
          named: 'a 422 refusal',
          fetcher: gives({ code: reader.unprocessable, condition: 'unreadable', remedy: null }, 422),
          kind: 'refused',
          signature: `refused:${reader.unprocessable}`,
        },
        {
          named: 'an answer that is not JSON',
          fetcher: givesNotJson(),
          kind: 'unparseable',
          signature: 'unparseable:the response body was not JSON',
        },
        {
          named: 'a well-formed body of the wrong shape',
          fetcher: gives(reader.wrongShape),
          kind: 'unparseable',
          signature: '',
        },
      ];

      test('asks for its own generated path and no other', async () => {
        asked = [];
        await reader.read(gives(reader.good));
        expect(asked, 'the reader asked for a path the endpoint register did not build')
          .toStrictEqual([reader.path]);
      });

      test('and its in-flight state names that same path', async () => {
        // A screen says what it is waiting for, and what it says has to be what is being fetched.
        const inFlight = reader.named === 'fetchTicket'
          ? ticketInFlight(TICKET)
          : ticketFileInFlight(TICKET, REL);
        expect(inFlight).toStrictEqual({ kind: 'in-flight', path: reader.path });
      });

      for (const each of cases()) {
        test(`${each.named} answers ${each.kind}, and offers what can be done about it`, async () => {
          asked = [];
          const state = await reader.read(each.fetcher);
          expect(state.kind, `${each.named} did not answer ${each.kind}`).toBe(each.kind);
          if (each.signature !== '') {
            expect(signature(state), `${each.named} did not answer with its own code or problem`)
              .toBe(each.signature);
          }
          // Every failure offers the one action that could help; a settled success does not.
          expect(canRetryRequest(state), `${each.named} offers the wrong retry`).toBe(each.kind !== 'loaded');
        });
      }

      test('a validated body is the parsed value, and not whatever JSON carried', async () => {
        // The half a screen test cannot make: the loaded value came through the schema, so a field
        // the wire does not declare is not on it. `.strict()` is what refuses one, which is the
        // clause below; this is that the accepted body survives unchanged.
        const state = await reader.read(gives(reader.good));
        expect(state.kind).toBe('loaded');
        if (state.kind !== 'loaded') return;
        expect(state.value, 'the reader changed the body it was given').toStrictEqual(reader.good);
        expect(state.fetchedAt).toBe(CLOCK());
      });

      test('a body carrying a field the wire does not declare is refused rather than passed on', async () => {
        // `.strict()`, from the browser's side. A field this page has never heard of means the
        // daemon and this bundle are different versions, which is a thing to report and not a thing
        // to drop silently on the way through.
        const state = await reader.read(gives({ ...reader.good, surprise: true }));
        expect(state.kind, 'an undeclared field was accepted').toBe('unparseable');
      });

      test('the five answers are five outcomes, and no two of them collapse', async () => {
        const seen: string[] = [];
        for (const each of cases()) seen.push(signature(await reader.read(each.fetcher)));
        expect(new Set(seen).size, `two of ${JSON.stringify(seen)} render as one`).toBe(5);
      });
    });
  }

  test('and the two readers do not answer each other\'s paths', async () => {
    // The near-homograph worth pinning: one path is a prefix of the other, so a reader that built
    // the wrong one would still be answered by a daemon and would still parse.
    expect(ticketFilePath(TICKET, REL).startsWith(ticketDetailPath(TICKET))).toBe(true);
    asked = [];
    await fetchTicket(gives(DETAIL), TICKET, CLOCK);
    await fetchTicketFile(gives(FILE), TICKET, REL, CLOCK);
    expect(asked[0], 'the detail reader asked for a file').not.toContain('file?path=');
    expect(asked[1], 'the file reader did not name the file it was asked for')
      .toContain(encodeURIComponent(REL));
  });
});

/**
 * Q-0016 AC-4 — the one request this app makes that is not a GET, over every answer its route gives.
 *
 * Driven here rather than through the screen for the reason Q-0127's block above gives: a component
 * test cannot say whether a success was recognised from its STATUS or fell through a body parser,
 * and both render identically until the day the daemon answers a gate differently.
 *
 * **Six answers and a shape, because the route's success carries no body.**
 * `POST /runs/:id/gate` answers `204` with nothing at all, and two of its four refusals share a
 * status — `no-such-run` and `no-such-gate` are both `404`, saying opposite things to a reader — so
 * what tells one answer from another is the code and never the status alone.
 */
describe('AC-4 — answerGate, and what it does with each answer the daemon gives', () => {
  const HANDLE = 'run-7';
  const GATE = '3:1';

  /** Everything one request carried, so *what was sent* is asserted rather than assumed. */
  interface Sent {
    readonly path: string;
    readonly request?: DaemonRequest;
    /** Whether the body was read at all — the half a status-only success has to be checked on. */
    read: boolean;
  }

  /** A daemon answering one status, recording the request and whether anything read its body. */
  const daemon = (status: number, body: unknown = null): { fetch: FetchLike; sent: Sent[] } => {
    const sent: Sent[] = [];
    return {
      sent,
      fetch: (path: string, request?: DaemonRequest) => {
        const record: Sent = { path, request, read: false };
        sent.push(record);
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => { record.read = true; return Promise.resolve(body); },
        });
      },
    };
  };

  test('a 204 is accepted from its status, with no body read at all', async () => {
    const { fetch, sent } = daemon(204);
    const state = await answerGate(fetch, HANDLE, GATE, 'advance', CLOCK);
    expect(state.kind, 'a settled gate was not reported as accepted').toBe('loaded');
    if (state.kind !== 'loaded') return;
    // The value is the answer that was ACCEPTED and nothing beyond it: what the run does next is a
    // read rather than an inference from a status.
    expect(state.value).toBe('advance');
    expect(state.fetchedAt).toBe(CLOCK());
    expect(sent[0]?.read, 'the success path read a body the route does not send').toBe(false);
    expect(canRetryRequest(state), 'an accepted answer offered a retry').toBe(false);
  });

  test('and it sends one POST, to its own path, carrying the envelope the contract declares', async () => {
    const { fetch, sent } = daemon(204);
    await answerGate(fetch, HANDLE, GATE, 'abort', CLOCK);
    expect(sent.map((each) => each.path), 'the answer went somewhere other than the gate route')
      .toStrictEqual([runGatePath(HANDLE)]);
    expect(sent[0]?.request?.method).toBe('POST');
    expect(JSON.parse(sent[0]?.request?.body ?? '{}'), 'the envelope is not the two fields the schema declares')
      .toStrictEqual({ gateId: GATE, answer: 'abort' });
    // And the in-flight state names the same path the request will ask for, which is what lets a
    // screen say what it is waiting for without composing a path of its own.
    expect(gateAnswerInFlight(HANDLE)).toStrictEqual({ kind: 'in-flight', path: runGatePath(HANDLE) });
  });

  test('the two 404s are told apart by code rather than by status', async () => {
    // The trap this clause exists for: a client branching on the status alone reports *that handle
    // names no run* for a gate that was simply already answered, which is a wrong sentence rather
    // than a crash — the kind that survives a review.
    const outcomes: string[] = [];
    for (const code of ['no-such-run', 'no-such-gate']) {
      const state = await answerGate(daemon(404, { code, condition: `${code} happened`, remedy: null }).fetch,
        HANDLE, GATE, 'advance', CLOCK);
      expect(state.kind).toBe('refused');
      if (state.kind === 'refused') outcomes.push(state.refusal.code);
    }
    expect(outcomes, 'two refusals sharing a status collapsed into one').toStrictEqual(['no-such-run', 'no-such-gate']);
  });

  test.each([
    ['no-such-gate', 404],
    ['not-this-run', 409],
    ['not-an-answer', 400],
    ['no-such-run', 404],
    ['malformed-json', 400],
  ] as const)('%s reaches the caller with the daemon\'s own words', async (code, status) => {
    const refusal = { code, condition: `the daemon says ${code}`, remedy: null };
    const state = await answerGate(daemon(status, refusal).fetch, HANDLE, GATE, 'retry', CLOCK);
    expect(state.kind).toBe('refused');
    if (state.kind !== 'refused') return;
    expect(state.refusal, 'the refusal was rewritten on the way through').toStrictEqual(refusal);
    expect(state.path).toBe(runGatePath(HANDLE));
    expect(canRetryRequest(state), 'a refusal offered no action at all').toBe(true);
  });

  test('a fetcher that throws is unreachable, and is not a refusal', async () => {
    const state = await answerGate(() => Promise.reject(new Error('connection refused')), HANDLE, GATE, 'advance', CLOCK);
    expect(state.kind).toBe('unreachable');
    if (state.kind === 'unreachable') expect(state.path).toBe(runGatePath(HANDLE));
  });

  test('a 2xx that is not the one this route answers with is reported, not taken for a success', async () => {
    // This page and the daemon disagreeing about what answering a gate looks like is a thing to
    // say. Two shapes: a 200 carrying something, and a 200 carrying nothing readable.
    const carrying = await answerGate(daemon(200, { ok: true }).fetch, HANDLE, GATE, 'advance', CLOCK);
    expect(carrying.kind).toBe('unparseable');
    if (carrying.kind === 'unparseable') expect(carrying.problem, 'the problem says nothing about the status').toContain('204');

    const broken = await answerGate(
      () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('Unexpected token <')) }),
      HANDLE, GATE, 'advance', CLOCK,
    );
    expect(broken.kind).toBe('unparseable');
    if (broken.kind === 'unparseable') expect(broken.problem).toContain('not JSON');
  });

  test('a non-2xx whose body is not a refusal is still reported as the daemon having answered', async () => {
    // Reporting a request that WAS answered as one that was not would send a reader to restart a
    // process that is running — the same reasoning `requestJson` gives, through the one function
    // both now share.
    const state = await answerGate(daemon(500, '<html>').fetch, HANDLE, GATE, 'advance', CLOCK);
    expect(state.kind).toBe('refused');
    if (state.kind === 'refused') expect(state.refusal.code).toContain('500');
  });

  test('and the six answers are six outcomes, no two of which collapse', async () => {
    const seenOf = (state: RequestState<unknown>): string => {
      switch (state.kind) {
        case 'refused': return `refused:${state.refusal.code}`;
        case 'unparseable': return `unparseable:${state.problem.slice(0, 20)}`;
        default: return state.kind;
      }
    };
    const seen = [
      await answerGate(daemon(204).fetch, HANDLE, GATE, 'advance', CLOCK),
      await answerGate(daemon(404, { code: 'no-such-gate', condition: 'x', remedy: null }).fetch, HANDLE, GATE, 'advance', CLOCK),
      await answerGate(daemon(409, { code: 'not-this-run', condition: 'x', remedy: null }).fetch, HANDLE, GATE, 'advance', CLOCK),
      await answerGate(daemon(400, { code: 'not-an-answer', condition: 'x', remedy: null }).fetch, HANDLE, GATE, 'advance', CLOCK),
      await answerGate(daemon(200, { ok: true }).fetch, HANDLE, GATE, 'advance', CLOCK),
      await answerGate(() => Promise.reject(new Error('down')), HANDLE, GATE, 'advance', CLOCK),
    ].map(seenOf);
    expect(new Set(seen).size, `two of ${JSON.stringify(seen)} render as one`).toBe(6);
  });
});

describe('AC-4 — fetchRun reads one run, over the route that answers for one handle', () => {
  const HANDLE = 'run-7';

  /** One run row in the shape `wireRunSchema` accepts, with one gate waiting. */
  const RUN = {
    handle: HANDLE, flow: 'chore', ticketId: 'Q-0016', runId: null, state: 'running', pendingGates: 1,
    gates: [{ type: 'gate', gateId: '3:1', kind: 'human', reason: 'approve to advance', ticketDir: '/repo/backlog/Q-0016-a' }],
    refusal: null,
  };

  test('a well-formed run loads, with its question carried whole', async () => {
    const seen: string[] = [];
    const state = await fetchRun((path: string) => {
      seen.push(path);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(RUN) });
    }, HANDLE, CLOCK);
    expect(seen, 'the reader asked for a path the endpoint register did not build').toStrictEqual([runDetailPath(HANDLE)]);
    expect(state.kind).toBe('loaded');
    if (state.kind !== 'loaded') return;
    expect(state.value.gates[0]?.gateId, 'the correlation token did not survive the parse').toBe('3:1');
    expect(runInFlight(HANDLE)).toStrictEqual({ kind: 'in-flight', path: runDetailPath(HANDLE) });
  });

  test('and a body carrying a field the wire does not declare is refused rather than passed on', async () => {
    const state = await fetchRun(answering({ ...RUN, surprise: true }).fetch, HANDLE, CLOCK);
    expect(state.kind, 'an undeclared field was accepted').toBe('unparseable');
  });

  test('a handle the host never minted is the route\'s own refusal, carried through', async () => {
    const refusal = { code: 'no-such-run', condition: 'no run is registered under that handle', remedy: null };
    const state = await fetchRun(answering(refusal, 404).fetch, HANDLE, CLOCK);
    expect(state.kind).toBe('refused');
    if (state.kind === 'refused') expect(state.refusal).toStrictEqual(refusal);
  });
});

describe('Q-0130 AC-3 — startRun, whose success is a body and not a status', () => {
  /** One run row in the shape `wireRunSchema` accepts — what a `201` carries. */
  const STARTED = {
    handle: 'run-9', flow: 'chore', ticketId: 'Q-0130', runId: null, state: 'running',
    pendingGates: 0, gates: [], refusal: null,
  };

  /** Everything one request carried, so *what was sent* is asserted rather than assumed. */
  interface Sent {
    readonly path: string;
    readonly request?: DaemonRequest;
  }

  /** A daemon answering one status with one body, recording the request. */
  const daemon = (status: number, body: unknown): { fetch: FetchLike; sent: Sent[] } => {
    const sent: Sent[] = [];
    return {
      sent,
      fetch: (path: string, request?: DaemonRequest) => {
        sent.push({ path, request });
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        });
      },
    };
  };

  const ASK = { flow: 'chore', ticket: 'Q-0130' } as const;

  test('a 201 loads the run it carries, which is where the handle comes from', async () => {
    const { fetch, sent } = daemon(201, STARTED);
    const state = await startRun(fetch, ASK, CLOCK);
    expect(state.kind, 'a started run was not reported as started').toBe('loaded');
    if (state.kind !== 'loaded') return;
    // The handle, and it is the point: it is minted inside the daemon and reaches a client here and
    // nowhere else, so a `startRun` written to `answerGate`'s status-only shape would discard the
    // only thing the exchange establishes.
    expect(state.value.handle).toBe('run-9');
    expect(state.fetchedAt).toBe(CLOCK());
    expect(sent.map((each) => each.path), 'the start went somewhere other than the runs route')
      .toStrictEqual([DAEMON_ENDPOINTS.runs]);
    expect(sent[0]?.request?.method).toBe('POST');
    expect(canRetryRequest(state), 'a started run offered a retry').toBe(false);
    // And the in-flight state names the same path the request will ask for.
    expect(startRunInFlight()).toStrictEqual({ kind: 'in-flight', path: DAEMON_ENDPOINTS.runs });
  });

  test('the body is built through the shared schema, so the field names come from the contract', async () => {
    const { fetch, sent } = daemon(201, STARTED);
    await startRun(fetch, { flow: 'chore', ticket: 'Q-0130', dry: true }, CLOCK);
    expect(JSON.parse(sent[0]?.request?.body ?? '{}'), 'the body is not what the caller asked for')
      .toStrictEqual({ flow: 'chore', ticket: 'Q-0130', dry: true });
    // Every key it sends is one the route declares, taken from the tuple rather than transcribed.
    const keys = Object.keys(JSON.parse(sent[0]?.request?.body ?? '{}') as Record<string, unknown>);
    expect(keys.filter((key) => !(WIRE_START_FIELDS as readonly string[]).includes(key)),
      'the body carries a key the route does not accept').toStrictEqual([]);
  });

  test('a 200 carrying a PERFECTLY GOOD run is reported rather than taken for a success', async () => {
    // The clause the ordering exists for: a schema that accepts the body cannot see this, because
    // the disagreement is about the exchange and not about the shape. This page and the daemon
    // disagreeing about what starting a run looks like is a thing to say.
    const state = await startRun(daemon(200, STARTED).fetch, ASK, CLOCK);
    expect(state.kind, 'a 200 carrying a valid run was accepted as a start').toBe('unparseable');
    if (state.kind === 'unparseable') expect(state.problem, 'the problem says nothing about the status').toContain('201');
  });

  test('a 2xx carrying NO body is the status disagreement, not a body that failed to parse', async () => {
    // Review round 1: the status was checked after the success body was read, so a bodyless 2xx —
    // a `204` carries none by definition, and it is what the OTHER two writes on this transport
    // answer with — was reported as *the response body was not JSON*. True of the read and wrong
    // about the exchange: it sends a reader looking for a parser defect where what happened is that
    // this page and the daemon disagree about what starting a run looks like.
    const bodyless = await startRun(
      () => Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error('Unexpected end of JSON input')) }),
      ASK, CLOCK,
    );
    expect(bodyless.kind).toBe('unparseable');
    if (bodyless.kind !== 'unparseable') return;
    expect(bodyless.problem, 'a bodyless 2xx was reported as a body that failed to parse')
      .not.toContain('not JSON');
    expect(bodyless.problem, 'the problem does not say what the exchange should have been').toContain('201');
    expect(bodyless.problem, 'the problem does not say what the daemon actually answered').toContain('204');
    // …and the refusal path still reads its body, which is the half the reordering must not lose:
    // a non-2xx is where the daemon's own words are, and they reach the page unaltered.
    const said = await startRun(daemon(409, { code: 'lock-held', condition: 'held by run #7', remedy: null }).fetch, ASK, CLOCK);
    expect(said.kind).toBe('refused');
    if (said.kind === 'refused') expect(said.refusal.condition).toBe('held by run #7');
  });

  test('a 201 whose body is not a run is unparseable, and a fetcher that throws is unreachable', async () => {
    const wrong = await startRun(daemon(201, { ...STARTED, surprise: true }).fetch, ASK, CLOCK);
    expect(wrong.kind, 'an undeclared field was accepted').toBe('unparseable');
    const broken = await startRun(
      () => Promise.resolve({ ok: true, status: 201, json: () => Promise.reject(new Error('Unexpected token <')) }),
      ASK, CLOCK,
    );
    expect(broken.kind).toBe('unparseable');
    if (broken.kind === 'unparseable') expect(broken.problem).toContain('not JSON');
    const down = await startRun(() => Promise.reject(new Error('connection refused')), ASK, CLOCK);
    expect(down.kind).toBe('unreachable');
    if (down.kind === 'unreachable') expect(down.path).toBe(DAEMON_ENDPOINTS.runs);
  });

  test('Q-0130 AC-5 — every refusal a well-formed start can provoke keeps its own code', async () => {
    // Two PAIRS share a status here, which is why nothing branches on one: `no-such-ticket` against
    // `no-such-flow` is *that ticket is not there* against *that flow file is not there*, and
    // `lock-held` against `not-runnable` is *wait* against *you asked for the wrong flow*.
    const answered: string[] = [];
    for (const [code, status] of [
      ['lock-held', 409], ['not-runnable', 409], ['no-such-ticket', 404],
      ['no-such-flow', 404], ['host-closed', 503], ['refused', 500],
    ] as const) {
      const refusal = { code, condition: `the daemon says ${code}`, remedy: null };
      const state = await startRun(daemon(status, refusal).fetch, ASK, CLOCK);
      expect(state.kind).toBe('refused');
      if (state.kind !== 'refused') continue;
      expect(state.refusal, 'the refusal was rewritten on the way through').toStrictEqual(refusal);
      expect(canRetryRequest(state), 'a refusal offered no action at all').toBe(true);
      answered.push(state.refusal.code);
    }
    expect(answered, 'two refusals sharing a status collapsed into one')
      .toStrictEqual(['lock-held', 'not-runnable', 'no-such-ticket', 'no-such-flow', 'host-closed', 'refused']);
    // …and a non-2xx whose body is not a refusal is still the daemon having ANSWERED, rather than a
    // request nobody answered, which would send a reader to restart a process that is running.
    const html = await startRun(daemon(502, '<html>').fetch, ASK, CLOCK);
    expect(html.kind).toBe('refused');
    if (html.kind === 'refused') expect(html.refusal.code).toContain('502');
  });
});

describe('Q-0130 AC-4 — stopRun, whose success is a status and not a body', () => {
  const HANDLE = 'run-9';

  interface Sent {
    readonly path: string;
    readonly request?: DaemonRequest;
    /** Whether the body was read at all — the half a status-only success has to be checked on. */
    read: boolean;
  }

  const daemon = (status: number, body: unknown = null): { fetch: FetchLike; sent: Sent[] } => {
    const sent: Sent[] = [];
    return {
      sent,
      fetch: (path: string, request?: DaemonRequest) => {
        const record: Sent = { path, request, read: false };
        sent.push(record);
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => { record.read = true; return Promise.resolve(body); },
        });
      },
    };
  };

  test('a 204 is accepted from its status, with no body read at all', async () => {
    const { fetch, sent } = daemon(204);
    const state = await stopRun(fetch, HANDLE, CLOCK);
    expect(state.kind, 'a delivered cancellation was not reported as delivered').toBe('loaded');
    if (state.kind !== 'loaded') return;
    expect(state.value).toBe(BROWSER_STOP_REASON);
    expect(sent[0]?.read, 'the success path read a body the route does not send').toBe(false);
    expect(sent.map((each) => each.path), 'the stop went somewhere other than the stop route')
      .toStrictEqual([runStopPath(HANDLE)]);
    expect(runStopInFlight(HANDLE)).toStrictEqual({ kind: 'in-flight', path: runStopPath(HANDLE) });
  });

  test('the status is read before the body, which is the property rather than an optimisation', async () => {
    // A fetcher whose `json()` throws still yields `loaded`: routed through `requestJson` this would
    // be reported as *the response body was not JSON*, which is a delivered cancellation rendered as
    // a failure. `answerGate` has the identical clause, and this is why it is not one shape twice.
    const state = await stopRun(
      () => Promise.resolve({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) }),
      HANDLE, CLOCK,
    );
    expect(state.kind, 'the body was read on the success path').toBe('loaded');
  });

  test('it sends a reason, and never a blank one', async () => {
    // `host.stop` refuses a whitespace-only note under `not-a-reason`, so sending one would be this
    // page asking for a refusal it could have avoided — and the daemon's own default records only
    // that the host did it, which is true of a shutdown too.
    const { fetch, sent } = daemon(204);
    await stopRun(fetch, HANDLE, CLOCK);
    const body = JSON.parse(sent[0]?.request?.body ?? '{}') as { reason?: unknown };
    expect(typeof body.reason).toBe('string');
    expect(String(body.reason).trim(), 'a blank note is exactly what the route refuses').not.toBe('');
    expect(Object.keys(body), 'the stop body carries a field the route does not accept').toStrictEqual(['reason']);
  });

  test('Q-0130 AC-5 — its three refusals keep their own codes, and a 2xx that is not 204 is reported', async () => {
    const answered: string[] = [];
    for (const [code, status] of [['no-such-run', 404], ['not-running', 409], ['not-a-reason', 400]] as const) {
      const refusal = { code, condition: `the daemon says ${code}`, remedy: null };
      const state = await stopRun(daemon(status, refusal).fetch, HANDLE, CLOCK);
      expect(state.kind).toBe('refused');
      if (state.kind === 'refused') answered.push(state.refusal.code);
    }
    expect(answered).toStrictEqual(['no-such-run', 'not-running', 'not-a-reason']);
    const odd = await stopRun(daemon(200, { ok: true }).fetch, HANDLE, CLOCK);
    expect(odd.kind, 'a 200 was taken for a delivered cancellation').toBe('unparseable');
    if (odd.kind === 'unparseable') expect(odd.problem).toContain('204');
    const down = await stopRun(() => Promise.reject(new Error('down')), HANDLE, CLOCK);
    expect(down.kind).toBe('unreachable');
    if (down.kind === 'unreachable') expect(down.path).toBe(runStopPath(HANDLE));
  });
});

describe('Q-0130 AC-5 — each refusal code has a sentence of its own, asserted by value', () => {
  test('the two registers name exactly the codes their routes can answer with', () => {
    // Identities rather than counts, and the registers are what a screen reads: a code renders this
    // surface's sentence and the daemon's condition, and one the register does not hold renders the
    // condition alone rather than a composed guess.
    expect(Object.keys(START_REFUSAL_TEXT).sort())
      .toStrictEqual(['host-closed', 'lock-held', 'no-such-flow', 'no-such-ticket', 'not-runnable', 'refused']);
    expect(Object.keys(STOP_REFUSAL_TEXT).sort())
      .toStrictEqual(['no-such-run', 'not-a-reason', 'not-running']);
  });

  test('no two sentences are one, across both registers together', () => {
    // The property, by VALUE over the whole set rather than by rendering each one: two codes that
    // rendered the same words would be a screen telling a reader the wrong thing about which of
    // them happened, and the two pairs sharing a status are exactly where that would land.
    const sentences = [...Object.values(START_REFUSAL_TEXT), ...Object.values(STOP_REFUSAL_TEXT)];
    expect(new Set(sentences).size, `two of ${String(sentences.length)} refusals render as one sentence`)
      .toBe(sentences.length);
    for (const said of sentences) expect(said.trim().length, 'a refusal renders an empty sentence').toBeGreaterThan(30);
  });

  test('a code neither register models loses the sentence and keeps the condition', () => {
    expect(refusalSentence(START_REFUSAL_TEXT, 'lock-held')).toBe(START_REFUSAL_TEXT['lock-held']);
    expect(refusalSentence(STOP_REFUSAL_TEXT, 'not-running')).toBe(STOP_REFUSAL_TEXT['not-running']);
    // `null` is an answer rather than a gap: the daemon's own condition renders either way.
    expect(refusalSentence(START_REFUSAL_TEXT, 'http-502'), 'a code this app does not model was answered for').toBeNull();
    // …and a start code is not a stop code, so the two registers are not one lookup by accident.
    expect(refusalSentence(STOP_REFUSAL_TEXT, 'lock-held')).toBeNull();
    // Nothing inherited from Object.prototype answers either.
    expect(refusalSentence(START_REFUSAL_TEXT, 'toString')).toBeNull();
  });

  test('and no sentence this ticket adds is worded with one of the three gate answers', () => {
    // A stop cancels a run through its `AbortSignal` and is not one of the three words a gate takes;
    // widening that set needs a decision entry this ticket did not take, so a control or a sentence
    // spelling one would be this app offering an answer the engine would refuse.
    const GATE_ANSWERS = ['advance', 'retry', 'abort'];
    for (const said of [...Object.values(START_REFUSAL_TEXT), ...Object.values(STOP_REFUSAL_TEXT)]) {
      for (const answer of GATE_ANSWERS) {
        expect(new RegExp(`\\b${answer}`, 'i').test(said), `a refusal sentence is worded with ${answer}`).toBe(false);
      }
    }
    // The needle discriminates, over a sentence that is worded with one.
    expect(GATE_ANSWERS.filter((answer) => new RegExp(`\\b${answer}`, 'i').test('Abort the run')))
      .toStrictEqual(['abort']);
  });
});
