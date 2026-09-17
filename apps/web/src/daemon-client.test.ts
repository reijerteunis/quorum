/**
 * Q-0017 AC-3 — every request this app makes goes through one module, and every body is parsed.
 *
 * Driven through an injected fetch rather than a real one: the claim is about what this module does
 * with an answer, and a test that opened a socket would be exercising the platform. It also keeps
 * the suite from making an outbound connection, which is the defect Q-0120's review round 1 found
 * in the file next door.
 */
import { describe, expect, test } from 'vitest';

import { DAEMON_ENDPOINTS, runDetailPath, runGatePath, ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import {
  answerGate, fetchFlows, fetchRun, fetchRuns, fetchTicket, fetchTicketFile, fetchTickets, flowsInFlight,
  gateAnswerInFlight, requestJson, runInFlight, ticketFileInFlight, ticketInFlight, ticketsInFlight,
  type DaemonRequest, type DaemonResponse, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, type RequestState } from './request-state.js';

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
