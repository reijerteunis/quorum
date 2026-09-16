/**
 * Q-0017 AC-3 — every request this app makes goes through one module, and every body is parsed.
 *
 * Driven through an injected fetch rather than a real one: the claim is about what this module does
 * with an answer, and a test that opened a socket would be exercising the platform. It also keeps
 * the suite from making an outbound connection, which is the defect Q-0120's review round 1 found
 * in the file next door.
 */
import { describe, expect, test } from 'vitest';

import { DAEMON_ENDPOINTS, ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import {
  fetchFlows, fetchTicket, fetchTicketFile, fetchTickets, flowsInFlight, requestJson,
  ticketFileInFlight, ticketInFlight, ticketsInFlight,
  type DaemonResponse, type FetchLike,
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
