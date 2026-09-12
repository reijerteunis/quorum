/**
 * Q-0118 — the transport: three routes, one WebSocket, and a refusal a client can act on.
 *
 * Driven through `app.request`, which is Hono's own in-process entry: it runs the real routing, the
 * real handlers and the real host, and opens no socket. `serve.test.ts` is where a socket is opened,
 * because binding is a different claim from routing and each should be able to fail on its own.
 */
import { afterAll, describe, expect, test } from 'vitest';

import { WIRE_RUN_STATES, wireRunListSchema, wireRunSchema } from '@quorum/shared';
import type { GateQuestionEvent, WireRun } from '@quorum/shared';

import { createRunHost } from './host.js';
import type { RunHost } from './host.js';
import { createApp, eventMessage, missedMessage, startRefusalCode, startRequestOf } from './http.js';
import { ANSWER_REFUSAL_STATUS, START_REFUSAL_STATUS, STOP_REFUSAL_STATUS } from './wire.js';
import { fixture, GATED_FLOW, removeTempDirs, TICKET_ID } from '../test/fixture.js';

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

/**
 * `GET /runs`, parsed through the schema a browser would parse it with.
 *
 * The validation is the point rather than convenience: `wireRunListSchema` is what a client
 * executes, so running the route's own bytes through it is what stops that schema being a
 * declaration with no subject — and an added field, a widened state or a missing one fails here
 * rather than at whichever screen reads it first.
 */
async function listRuns(app: ReturnType<typeof createApp>): Promise<readonly WireRun[]> {
  const response = await app.request('/runs');
  expect(response.status, 'a listing is not a not-found').toBe(200);
  const parsed = wireRunListSchema.safeParse(await response.json());
  expect(parsed.error?.issues, 'the listing does not satisfy the schema a browser parses it with').toBeUndefined();
  if (!parsed.success) throw new Error('unreachable');
  return parsed.data.runs;
}

/** Start one run, failing with the refusal's own sentence when it did not start. */
async function startedRun(host: RunHost, request: { flow: string; ticket: string; dry?: boolean; auto?: boolean }): Promise<string> {
  const outcome = await host.start(request);
  if (!outcome.started) throw new Error(`the run did not start: ${outcome.refusal.condition}`);
  return outcome.run.handle;
}

/** Drain one run's fan-out to its end, so a test can act on a run that is over. */
async function drainRun(host: RunHost, handle: string): Promise<void> {
  const subscription = host.subscribe(handle);
  if (!subscription) throw new Error(`no subscription for ${handle}`);
  for await (const _event of subscription.events) { /* to the end */ }
}

/** Wait until `predicate` holds, or say what never happened rather than hanging. */
async function until(predicate: () => boolean, what: string): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 10_000) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => { setTimeout(resolve, 5); });
  }
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
    // The condition the loader ACTUALLY produces, measured rather than invented: `loadFlowByName`
    // composes no sentence and lets Node's ENOENT through. The phrase this row used to carry — "no
    // flow named probe" — is written nowhere, so the branch it covered was unreachable.
    expect(startRefusalCode("ENOENT: no such file or directory, open '/r/harness/flows/probe.yaml'")).toBe('no-such-flow');
    expect(startRefusalCode('no ticket T-0404')).toBe('no-such-ticket');
    // And a condition this transport does not model is `refused`, never the most common guess: a
    // fall-through that answered `no-such-ticket` would report an undiagnosed failure as a fact.
    expect(startRefusalCode('the disk caught fire')).toBe('refused');
    // 500 rather than 422, changed under review round 3: 422 said "the request was unprocessable",
    // which asserts the fault is the client's about a failure nobody diagnosed. 500 asserts only
    // that something went wrong on this side, which is the one thing certainly true — and the
    // condition travels with it, so a human reads what actually happened.
    expect(START_REFUSAL_STATUS.refused, 'an unmodelled refusal blamed the client').toBe(500);
    // And a flow file that exists but cannot be read is NOT reported as a missing flow.
    expect(startRefusalCode("EACCES: permission denied, open '/r/harness/flows/probe.yaml'")).toBe('refused');
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

describe('Q-0121 AC-2 — the transport keeps no index of its own', () => {
  test('a run started through the host object, never through POST /runs, is in the listing', async () => {
    // **This is the clause that discriminates the two designs.** A transport-side index records
    // what it SAW — the starts that came through its own route — where a host enumeration reports
    // what EXISTS. Driving the host directly is the one request that tells them apart, and it is
    // not a contrivance: `createDaemon` hands a caller the host, and Q-0019's resume will start
    // runs that no client asked for.
    const { host, app } = served();
    const handle = await startedRun(host, { flow: 'probe', ticket: TICKET_ID, dry: true });
    await drainRun(host, handle);

    const runs = await listRuns(app);
    expect(runs.map((run) => run.handle), 'the listing is an index of what the route saw').toStrictEqual([handle]);
  });
});

describe('Q-0121 AC-3 — GET /runs answers an envelope, newest first, stably', () => {
  test('a host with nothing to list answers 200 with an empty array and never a 404', async () => {
    // Nothing is missing; there is nothing to list. Those are different sentences, and answering
    // 404 to the second would tell a client its request was wrong about a daemon that is fine.
    const { app } = served();
    const response = await app.request('/runs');
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ runs: [] });
  });

  test('three runs come back in the reverse of the host\'s mint order, and repeating the request does not move them', async () => {
    // Order is specified because it is the only recency the wire carries: the handle is opaque, so
    // a client may not read age out of `run-<n>`, and the row a maintainer most often wants is the
    // last run started. Three dry walks, which take no lock, so all three run against one ticket.
    const { host, app } = served();
    const handles: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const handle = await startedRun(host, { flow: 'probe', ticket: TICKET_ID, dry: true });
      await drainRun(host, handle);
      handles.push(handle);
    }

    const first = await listRuns(app);
    expect(first.map((run) => run.handle)).toStrictEqual([...host.runs()].map((view) => view.handle).reverse());
    expect(first.map((run) => run.handle), 'the newest run is not first').toStrictEqual([...handles].reverse());
    // Stable: nothing was started in between, so the same request answers the same array. A
    // listing whose order moved under a reader would make every row a client held ambiguous.
    expect((await listRuns(app)).map((run) => run.handle)).toStrictEqual(first.map((run) => run.handle));
  });
});

describe('Q-0121 AC-4 — the listing carries the runs this host can back, and derives them per request', () => {
  test('a running run and an ended one are listed, a refused start is not, and the state moves with the run', async () => {
    const project = fixture({ flow: GATED_FLOW });
    project.addTicket({ id: 'T-0002', folder: 'T-0002-second' });
    const host = createRunHost({ project: project.project, retain: 100 });
    const app = createApp({ host });

    const refused = await host.start({ flow: 'probe', ticket: 'T-0404' });
    const live = await startedRun(host, { flow: 'probe', ticket: TICKET_ID });
    const ended = await startedRun(host, { flow: 'probe', ticket: 'T-0002', auto: true });
    await drainRun(host, ended);
    await until(() => (host.view(live)?.gates.length ?? 0) > 0, 'the gated run to reach its gate');

    const listed = await listRuns(app);
    // An ENDED run stays listed: its retained buffer is replayable after close, which is exactly
    // what this listing makes reachable (AC-11). A REFUSED start is excluded — it has no stream,
    // its socket closes 1008, and its handle was disclosed to no client — and it is asserted absent
    // BY VALUE rather than by a count, because a count is satisfied by a substitution.
    expect(listed.map((run) => run.state).sort()).toStrictEqual(['ended', 'running']);
    expect(listed.map((run) => run.handle), 'a refused start was listed')
      .not.toContain(refused.run.handle);
    expect(listed.map((run) => run.handle).sort()).toStrictEqual([live, ended].sort());
    // …and the exclusion is a SELECTION rather than a silent drop: the lookup route still knows
    // the handle the listing left out, which is what AC-5 is about.
    expect((await app.request(`/runs/${refused.run.handle}`)).status, 'the run the listing excluded was reported absent by the lookup').toBe(200);

    // Nothing is cached: the same handle is `ended` once the run finishes, with the three identity
    // fields unchanged and `runId` moving from null to core's number.
    const before = listed.find((run) => run.handle === live);
    expect(before?.runId, 'a running run claimed a run number').toBeNull();
    const gate = host.view(live)?.gates[0] as GateQuestionEvent;
    expect(host.answer(live, { gateId: gate.gateId, answer: 'advance' })).toBeNull();
    await until(() => host.view(live)?.state === 'ended', 'the gated run to end');

    const after = (await listRuns(app)).find((run) => run.handle === live);
    expect(after?.state, 'the listing answered from a cache').toBe('ended');
    expect(after?.handle).toBe(before?.handle);
    expect(after?.flow).toBe(before?.flow);
    expect(after?.ticketId).toBe(before?.ticketId);
    expect(after?.runId, "core's run number did not arrive with the terminal event").toBe(1);
  });
});

describe('Q-0121 AC-5 — GET /runs/:id answers for any handle this host minted', () => {
  test('a running run, a refused start, and a handle nobody minted', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 100 });
    const app = createApp({ host });
    const live = await startedRun(host, { flow: 'probe', ticket: TICKET_ID });
    const refused = await host.start({ flow: 'probe', ticket: 'T-0404' });

    const running = await app.request(`/runs/${live}`);
    expect(running.status).toBe(200);
    expect(wireRunSchema.parse(await running.json()).state).toBe('running');

    // The refused start is reported `refused` rather than reported ABSENT. A 404 here would print
    // "no run is registered under that handle" about a handle the host's own records hold, which is
    // a failed probe read as a proven negative — the class Q-0074 and Q-0115 exist to remove.
    const known = await app.request(`/runs/${refused.run.handle}`);
    expect(known.status, 'a handle the host minted was reported absent').toBe(200);
    const row = wireRunSchema.parse(await known.json());
    expect(row.state).toBe('refused');
    expect(row.ticketId, 'a start that never resolved a ticket claimed one').toBeNull();

    // 404 only where the host minted no such handle, which is what makes the condition TRUE of the
    // case it answers — and the body is `badRequest`'s three fields, no more and no fewer.
    const absent = await app.request('/runs/run-nobody-minted');
    expect(absent.status).toBe(404);
    const refusal = await absent.json() as Record<string, unknown>;
    expect(Object.keys(refusal).sort()).toStrictEqual(['code', 'condition', 'remedy']);
    expect(refusal.code).toBe('no-such-run');
    expect(refusal.condition).toBe('no run is registered under that handle');
    expect(refusal.remedy).toBeNull();

    await host.shutdown();
  });
});

describe('Q-0121 AC-6 — both reads are GETs, and reading moves nothing', () => {
  test('a DELETE or PUT to either is not routed, nor a POST to the lookup', async () => {
    // `read.test.ts:45`'s method loop, applied to the two paths this ticket adds — with one
    // DIVERGENCE stated rather than smoothed over. That loop asserts GET 200, POST 404 and
    // DELETE 404; its POST row **cannot** hold for `/runs`, because `POST /runs` is Q-0118's start
    // route and §4.8 keeps it. So the POST row is asserted for the lookup path, where it is true,
    // and asserted the OTHER way for the collection, so the divergence is pinned rather than
    // silent. See this round's report: AC-6's literal reading contradicts non-goal 8 of its own
    // document, and this is the reading that leaves the product's start route alone.
    const { host, app } = served();
    const handle = await startedRun(host, { flow: 'probe', ticket: TICKET_ID, dry: true });
    await drainRun(host, handle);

    for (const route of ['/runs', `/runs/${handle}`]) {
      expect((await app.request(route)).status, `${route} does not answer a GET`).toBe(200);
      expect((await app.request(route, { method: 'DELETE' })).status, `${route} accepted a DELETE`).toBe(404);
      expect((await app.request(route, { method: 'PUT' })).status, `${route} accepted a PUT`).toBe(404);
    }
    expect((await app.request(`/runs/${handle}`, { method: 'POST' })).status, 'the lookup path accepted a POST').toBe(404);
    // And the collection's POST is still the start route: a refusal carrying a code, which is what
    // an unrouted method could not produce.
    const start = await post(app, '/runs', { flow: 'probe', ticket: 'T-0404' });
    expect(start.status, 'POST /runs stopped being the start route').toBe(404);
    expect((await start.json() as { code: string }).code).toBe('no-such-ticket');
  });

  test('listing a run parked at a gate leaves the gate waiting, the watchers alone, and the disk untouched', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 100 });
    const app = createApp({ host });
    const handle = await startedRun(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    // A real watcher first, so `watchers` is NON-ZERO before the reads. Asserting it stays at zero
    // would be satisfied by a counter that never moves at all; asserting it stays at one is the
    // claim — a read neither takes a subscription nor drops somebody else's.
    const subscription = host.subscribe(handle);
    if (!subscription) throw new Error('no subscription');
    expect(host.view(handle)?.watchers, 'the count this clause rests on did not move for a real watcher').toBe(1);

    const gatesBefore = host.view(handle)?.gates;
    const logBefore = project.runsLog();
    await listRuns(app);
    await listRuns(app);
    await app.request(`/runs/${handle}`);

    expect(host.view(handle)?.gates, 'a read answered or dropped a gate').toStrictEqual(gatesBefore);
    expect(host.view(handle)?.gates, 'the gate this clause rests on is not there').toHaveLength(1);
    expect(host.view(handle)?.watchers, 'a read took or dropped a subscription').toBe(1);
    expect(host.view(handle)?.state, 'a read stopped or resumed the run').toBe('running');
    expect(project.runsLog(), 'a read wrote to the ticket').toBe(logBefore);

    subscription.close();
    await host.shutdown();
  });
});

describe('Q-0121 AC-8 — one projection, and a row says which ticket and how many gates are waiting', () => {
  test('a run at a gate reports pendingGates 1, and POST /runs answers the same key set as a listing row', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 100 });
    const app = createApp({ host });

    const start = await post(app, '/runs', { flow: 'probe', ticket: TICKET_ID });
    expect(start.status).toBe(201);
    const created = await start.json() as Record<string, unknown>;
    const handle = String(created.handle);
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    const [row] = await listRuns(app);
    expect(row?.pendingGates, 'a run waiting on a human is indistinguishable from one that is not').toBe(1);
    expect(row?.ticketId, 'the row does not say which ticket the run is against').toBe(TICKET_ID);
    // ONE projection, asserted as a KEY SET rather than field by field: a second projection for the
    // listing is exactly how `POST /runs`, `GET /runs` and `GET /runs/:id` come to answer three
    // shapes for one run, and a field-by-field check over the fields that exist cannot see it.
    expect(Object.keys(created).sort()).toStrictEqual(Object.keys(row ?? {}).sort());
    const looked = await (await app.request(`/runs/${handle}`)).json() as Record<string, unknown>;
    expect(Object.keys(looked).sort()).toStrictEqual(Object.keys(created).sort());
    expect(Object.keys(created).sort())
      .toStrictEqual(['flow', 'handle', 'pendingGates', 'runId', 'state', 'ticketId']);
    // `state` is the host's closed three rather than the string it was declared as until this ticket.
    expect([...WIRE_RUN_STATES], 'the wire state vocabulary widened').toContain(String(created.state));

    await host.shutdown();
  });
});

describe('Q-0121 AC-9 — no ticket record, event or gate question crosses the wire', () => {
  test('a marker in the ticket body and the gate\'s own reason appear in neither response', async () => {
    // Asserted over SERIALISED BYTES rather than over the type, because the type is what gets got
    // right and the bytes are what ships: a field added to the projection later, or a `RunView`
    // handed to `c.json` by mistake, is caught here and by nothing a compiler does.
    const marker = `${'MARKER'}-ticket-prose-must-not-cross-the-wire`;
    const project = fixture({ flow: GATED_FLOW, body: marker });
    const host = createRunHost({ project: project.project, retain: 100 });
    const app = createApp({ host });
    const handle = await startedRun(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    // The fixture put the marker where a TicketRecord would carry it, and the gate's reason is what
    // a GateQuestionEvent carries — so both needles are known to exist on the host's own view.
    expect(host.view(handle)?.ticket?.body, 'the marker is not in the ticket, so this proves nothing').toContain(marker);
    expect(host.view(handle)?.gates[0]?.reason, 'the gate carries no reason, so this proves nothing').toContain('approve to advance');

    for (const route of ['/runs', `/runs/${handle}`]) {
      const body = await (await app.request(route)).text();
      expect(body, `${route} carried the ticket's prose`).not.toContain(marker);
      expect(body, `${route} carried the gate's question`).not.toContain('approve to advance');
      expect(body, `${route} carried the ticket's folder`).not.toContain('the-server-runs-a-flow');
      expect(body, `${route} said nothing at all`).toContain(handle);
    }
    // …and the narrowings are present rather than the fields merely being absent.
    expect((await listRuns(app))[0]?.pendingGates).toBe(1);
    expect((await listRuns(app))[0]?.ticketId).toBe(TICKET_ID);

    await host.shutdown();
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
