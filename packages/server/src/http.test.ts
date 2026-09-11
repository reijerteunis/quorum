/**
 * Q-0118 — the transport: three routes, one WebSocket, and a refusal a client can act on.
 *
 * Driven through `app.request`, which is Hono's own in-process entry: it runs the real routing, the
 * real handlers and the real host, and opens no socket. `serve.test.ts` is where a socket is opened,
 * because binding is a different claim from routing and each should be able to fail on its own.
 */
import { afterAll, describe, expect, test } from 'vitest';

import { createRunHost } from './host.js';
import { createApp, eventMessage, missedMessage, startRefusalCode, startRequestOf } from './http.js';
import { ANSWER_REFUSAL_STATUS, START_REFUSAL_STATUS, STOP_REFUSAL_STATUS } from './wire.js';
import { fixture, removeTempDirs, TICKET_ID } from '../test/fixture.js';

afterAll(removeTempDirs);

/** One escape byte, built rather than typed, so this file holds no control character. */
const ESC = String.fromCharCode(27);

/** A host over a fresh repository, and the app in front of it. */
function served() {
  const project = fixture();
  const host = createRunHost({ project: project.project, retain: 100 });
  return { project, host, app: createApp({ host }) };
}

/** `POST` with a JSON body, or with raw bytes where the test is about malformed input. */
async function post(app: ReturnType<typeof createApp>, url: string, body?: unknown, raw?: string): Promise<Response> {
  return app.request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

describe('Q-0118 — POST /runs validates before the host is reached, and starts nothing when it refuses', () => {
  // Every row must leave the backlog untouched. A request that was refused and still moved a ticket
  // is what this clause exists to forbid, and it is invisible to a status check alone.
  const REFUSALS: [string, unknown, string | undefined, string][] = [
    ['malformed JSON', undefined, '{ not json', 'malformed-json'],
    ['a JSON array', [], undefined, 'not-an-object'],
    ['a JSON string', 'probe', undefined, 'not-an-object'],
    ['null', null, undefined, 'not-an-object'],
    ['an unknown field', { flow: 'probe', ticket: TICKET_ID, tickett: 'x' }, undefined, 'unknown-field'],
    ['a missing flow', { ticket: TICKET_ID }, undefined, 'missing-field'],
    ['a missing ticket', { flow: 'probe' }, undefined, 'missing-field'],
    ['an empty ticket', { flow: 'probe', ticket: '   ' }, undefined, 'missing-field'],
    ['a numeric flow', { flow: 7, ticket: TICKET_ID }, undefined, 'missing-field'],
    ['a string dry', { flow: 'probe', ticket: TICKET_ID, dry: 'yes' }, undefined, 'wrong-type'],
    ['a numeric base', { flow: 'probe', ticket: TICKET_ID, base: 3 }, undefined, 'wrong-type'],
  ];

  test.each(REFUSALS)('%s is refused 400 with a code, and the backlog is untouched', async (_label, body, raw, code) => {
    const { project, app } = served();
    const response = await post(app, '/runs', body, raw);
    expect(response.status).toBe(400);
    const refusal = await response.json() as { code: string; condition: string; remedy: string | null };
    expect(refusal.code).toBe(code);
    expect(refusal.condition, 'a refusal with no condition tells a human nothing').not.toBe('');
    expect(project.manifests(), 'a refused request wrote run history').toStrictEqual([]);
    expect(project.runsLog(), 'a refused request reached the ticket').toBe('');
  });

  test('the unknown-field refusal names the field and the accepted set', async () => {
    // "your body is wrong" is not actionable. The offender is quoted, which is the rule
    // `checkAgainstSchema` already follows one layer down.
    const { app } = served();
    const refusal = await (await post(app, '/runs', { flow: 'probe', ticket: TICKET_ID, tickett: 'x' })).json() as { condition: string; remedy: string | null };
    expect(refusal.condition).toContain('"tickett"');
    expect(refusal.remedy).toContain('ticket');
  });

  test('startRequestOf is the one place that decides, read directly as well as through a route', () => {
    // The rows above prove it is WIRED; this proves the predicate. A later route that forgot to
    // call it fails those rather than this one, which is the point of asserting both.
    expect(startRequestOf({ flow: 'probe', ticket: 'T-0001' })).toStrictEqual({ request: { flow: 'probe', ticket: 'T-0001' } });
    expect(startRequestOf({ flow: 'probe', ticket: 'T-0001', dry: true, auto: false, base: 'main' }))
      .toStrictEqual({ request: { flow: 'probe', ticket: 'T-0001', dry: true, auto: false, base: 'main' } });
    expect('refusal' in startRequestOf({ flow: 'probe' })).toBe(true);
  });
});

describe('Q-0118 — a start refusal is distinguishable from a bad request and from each other', () => {
  test('a run that cannot start carries the host condition and a status that is not 400', async () => {
    const { project, app } = served();
    const response = await post(app, '/runs', { flow: 'probe', ticket: 'T-0404' });
    // Not 400: the request was well formed. A client that cannot tell these apart cannot tell
    // "fix your request" from "fix your backlog".
    expect(response.status).not.toBe(400);
    expect(response.status).toBe(404);
    const refusal = await response.json() as { code: string; condition: string };
    expect(refusal.condition, "the condition is core's own sentence").toContain('T-0404');
    expect(project.manifests()).toStrictEqual([]);
  });

  test('the status table is total, and a lock refusal is a conflict rather than an error', () => {
    // 409 is the row that matters: another run holds the ticket, the server is healthy, and the
    // condition clears itself when that run ends. 500 would tell a client to report a bug and 400
    // would tell it to change its request; both are wrong.
    expect(START_REFUSAL_STATUS['lock-held']).toBe(409);
    expect(START_REFUSAL_STATUS['host-closed']).toBe(503);
    expect(START_REFUSAL_STATUS['no-such-ticket']).toBe(404);
    expect(new Set(Object.values(START_REFUSAL_STATUS)).size, 'every start refusal shares one status, so none is distinguishable').toBeGreaterThan(1);
  });

  test("startRefusalCode reads the host's own words, and every branch is reachable", () => {
    expect(startRefusalCode('run lock refused: ticket T-0001 is held by run #7')).toBe('lock-held');
    expect(startRefusalCode('the run host is closed and starts no further run')).toBe('host-closed');
    expect(startRefusalCode('ticket T-0001 is at stage "draft", flow "chore" consumes "requirements"')).toBe('not-runnable');
    expect(startRefusalCode('no flow named probe')).toBe('no-such-flow');
    expect(startRefusalCode('no ticket T-0404')).toBe('no-such-ticket');
  });
});

describe('Q-0118 — the gate and stop routes move the host and report its refusals', () => {
  test('a gate answer for a run that is not here is 404, and an unparseable body is 400', async () => {
    const { app } = served();
    expect((await post(app, '/runs/nope/gate', { gateId: '1:1', answer: 'advance' })).status).toBe(404);
    expect((await post(app, '/runs/nope/gate', undefined, '{ not json')).status).toBe(400);
  });

  test('stop refuses an unknown run, a non-object body and a non-string reason', async () => {
    const { app } = served();
    expect((await post(app, '/runs/nope/stop')).status).toBe(404);
    expect((await post(app, '/runs/nope/stop', [])).status).toBe(400);
    expect((await post(app, '/runs/nope/stop', { reason: 7 })).status).toBe(400);
  });

  test('stop accepts an empty body, because a reason is optional', async () => {
    // The route reads the body as text first for exactly this: `c.req.json()` on an empty body
    // throws, and a stop with no reason is the ordinary case rather than a malformed request.
    const { app } = served();
    expect((await post(app, '/runs/nope/stop', undefined, '')).status).toBe(404);
    expect((await post(app, '/runs/nope/stop', {})).status).toBe(404);
  });

  test('both refusal tables are total over their unions, and neither is all one status', () => {
    expect(Object.keys(ANSWER_REFUSAL_STATUS).sort()).toStrictEqual(['no-such-gate', 'no-such-run', 'not-an-answer', 'not-this-run']);
    expect(Object.keys(STOP_REFUSAL_STATUS).sort()).toStrictEqual(['no-such-run', 'not-a-reason', 'not-running']);
    expect(new Set(Object.values(ANSWER_REFUSAL_STATUS)).size).toBeGreaterThan(1);
    expect(new Set(Object.values(STOP_REFUSAL_STATUS)).size).toBeGreaterThan(1);
  });

  test('the gate route does not judge the envelope, so there is one authority for it', async () => {
    // A second copy of `advance|retry|abort` in the route would be the drifting one: the schema is
    // in `@quorum/shared` and `gates.ts` is what answers `not-an-answer`. A nonsense envelope still
    // reaches the host to be refused THERE, which is why this is a no-such-run rather than a 400.
    const { app } = served();
    const response = await post(app, '/runs/nope/gate', { gateId: '1:1', answer: 'nonsense' });
    expect(response.status, 'the route judged the envelope itself').toBe(ANSWER_REFUSAL_STATUS['no-such-run']);
  });
});

describe('Q-0118 — the WebSocket envelope carries events and nothing rendered', () => {
  test('one event per message, JSON, under a type the client switches on', () => {
    const message = JSON.parse(eventMessage({ type: 'info', message: 'x' })) as { type: string; event: { type: string } };
    expect(message.type).toBe('event');
    expect(message.event.type).toBe('info');
  });

  test('a missed count is a message kind and never an Event', () => {
    // Nothing that is not an `Event` reaches the event channel, so a client parsing with
    // `eventSchema` never meets a value it cannot classify.
    expect(missedMessage(0), 'a subscriber that missed nothing was told it missed nothing').toBeNull();
    const message = JSON.parse(missedMessage(3) ?? '') as { type: string; count: number };
    expect(message.type).toBe('missed');
    expect(message.count).toBe(3);
    expect('event' in message, 'a missed count travelled on the event channel').toBe(false);
  });

  test('the transport alters no bytes, which is the other half of the escape rule', () => {
    // `04-architecture.md`: a lint record reaching a terminal, a browser and a WebSocket carries an
    // escape byte in exactly one of the three. The transport's job is to carry what it was given;
    // deciding how it LOOKS is the browser's.
    const ansi = `${ESC}[31mred${ESC}[0m`;
    const rendered = eventMessage({ type: 'warn', message: ansi });
    expect(JSON.parse(rendered), 'the transport altered the bytes it was handed')
      .toStrictEqual({ type: 'event', event: { type: 'warn', message: ansi } });
    expect(rendered.includes(ESC), 'a raw control byte was written into the JSON text').toBe(false);
  });
});
