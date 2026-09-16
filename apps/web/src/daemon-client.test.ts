/**
 * Q-0017 AC-3 — every request this app makes goes through one module, and every body is parsed.
 *
 * Driven through an injected fetch rather than a real one: the claim is about what this module does
 * with an answer, and a test that opened a socket would be exercising the platform. It also keeps
 * the suite from making an outbound connection, which is the defect Q-0120's review round 1 found
 * in the file next door.
 */
import { describe, expect, test } from 'vitest';

import { DAEMON_ENDPOINTS } from './daemon-endpoints.js';
import {
  fetchFlows, fetchTickets, flowsInFlight, requestJson, ticketsInFlight, type DaemonResponse,
} from './daemon-client.js';

/** A clock a test owns, so a fetched-at instant is a value rather than a property of the machine. */
const CLOCK = (): string => '2026-09-16T09:00:00.000Z';

/** A well-formed listing, which every clause below starts from and changes one thing in. */
const LISTING = {
  tickets: [{
    id: 'Q-0017', title: 'Backlog board', stage: 'requirements', owner: 'ruud',
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
