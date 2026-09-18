/**
 * Q-0119 — the read-only surface: project, tickets, flows and run history.
 *
 * Driven through `app.request` over a real project, like `http.test.ts`: real routing, real `core`
 * reads, no socket. Every route below is a GET, and the suite asserts that — a write reaching this
 * surface is the boundary this ticket exists to hold.
 */
import { afterAll, describe, expect, test, vi } from 'vitest';

import { createRunHost } from './host.js';
import { createApp } from './http.js';
import { mountRead } from './read.js';
import { isOneName, readTicketFileBytes } from '@quorum/core';
import {
  RUN_HISTORY_ROOT, wireFlowListSchema, wireRunHistoryListSchema, wireRunHistorySchema,
  wireTicketDetailSchema,
  wireTicketFileSchema, wireTicketListSchema,
  type WireRefusal, type WireRunHistory, type WireTicket, type WireTicketDetail, type WireTicketFile,
  type WireTicketList,
} from '@quorum/shared';
import { fixture, removeTempDirs, TICKET_ID, write } from '../test/fixture.js';
import fs from 'node:fs';
import path from 'node:path';

afterAll(removeTempDirs);

/** A project, a host, and an app carrying both the run routes and the read-only ones. */
function served(options: Parameters<typeof fixture>[0] = {}) {
  const project = fixture(options);
  const host = createRunHost({ project: project.project, retain: 100 });
  return { project, host, app: mountRead(createApp({ host }), project.project) };
}

/** A run-history directory holding one manifest, written by hand so the reader has a subject. */
function writeRun(repoDir: string, id: string, manifest: unknown): void {
  const dir = path.join(repoDir, RUN_HISTORY_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** A manifest with the fields the reader needs, and the status a caller asks for. */
function manifestOf(id: string, status: string, ended: string | null): Record<string, unknown> {
  return {
    schema_version: 1, run_id: id, ticket_id: TICKET_ID, ticket_path: `backlog/${TICKET_ID}`,
    flow: 'probe', flow_file: 'probe.yaml', stage: { before: 'draft', after: 'requirements' },
    started_at: '2026-09-11T00:00:00.000Z', ended_at: ended, duration_ms: ended === null ? null : 10,
    status, steps: [], rollup: [],
  };
}

describe('Q-0119 — the surface answers what is there, and writes nothing', () => {
  test('every read-only route is a GET, and a POST to one is not routed', async () => {
    // The boundary rather than a formatter: no ticket is created, no stage moves, no flow is
    // edited. "The UI edits files and never holds the truth" — an editing surface is a later
    // ticket, and one arriving here by accident is what this refuses.
    const { app } = served();
    for (const route of ['/project', '/tickets', '/flows', '/history']) {
      expect((await app.request(route)).status, `${route} does not answer a GET`).toBe(200);
      expect((await app.request(route, { method: 'POST' })).status, `${route} accepted a POST`).toBe(404);
      expect((await app.request(route, { method: 'DELETE' })).status, `${route} accepted a DELETE`).toBe(404);
    }
  });

  test('/project names where the project is, and its base branch', async () => {
    const { project, app } = served();
    const body = await (await app.request('/project')).json() as { repoDir: string; baseBranch: string };
    expect(body.repoDir).toBe(project.repoDir);
    expect(body.baseBranch, 'the base branch is read from config rather than assumed').not.toBe('');
  });

  test('/tickets lists the backlog, and derives containment per request rather than storing it', async () => {
    const { project, app } = served();
    project.addTicket({ id: 'T-0002', folder: 'T-0002-second' });
    const body = await (await app.request('/tickets')).json() as { tickets: { id: string; containment: unknown }[] };
    expect(body.tickets.map((t) => t.id).sort()).toStrictEqual([TICKET_ID, 'T-0002']);
    // `containment` is a key on every row — `null` where git was asked nothing, which is NOT the
    // same as an indeterminate answer and is carried through rather than flattened.
    for (const ticket of body.tickets) expect('containment' in ticket).toBe(true);
  });

  test('/flows names a flow the linter refuses rather than hiding it', async () => {
    // Q-0055 AC-16, and the classifier is `problems.length` rather than `flow !== undefined`:
    // `lintFlowDirectory` RETAINS `flow` when it appends cross-flow problems, so a broken flow
    // would otherwise read as runnable. That exact mistake is what Q-0055's review round 1 found.
    const { project, app } = served();
    // A flow that PARSES and is then refused by a cross-flow check, which is the only shape that
    // discriminates the two classifiers: `lintFlowDirectory` retains `flow` while appending the
    // problem, so `flow !== undefined` calls this runnable and `problems.length === 0` does not.
    // A file that fails to parse proves nothing here — both classifiers agree on it, which is why
    // the first version of this test passed with the wrong one.
    write(path.join(project.harnessDir, 'flows', 'broken.yaml'),
      'name: broken\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: work\n    on_fail: { goto: "flow:absent", max_iterations: 1, on_exhausted: gate }\n');
    const body = await (await app.request('/flows')).json() as { flows: { name: string; runnable: boolean; problems: string[] }[] };
    const names = body.flows.map((f) => f.name);
    expect(names, 'a refused flow vanished from the list').toContain('broken');
    const broken = body.flows.find((f) => f.name === 'broken');
    expect(broken?.runnable, 'a flow the linter refuses was reported runnable').toBe(false);
    expect(broken?.problems.length, 'a refused flow carries no reason').toBeGreaterThan(0);
    // …and the good one is still runnable, so the clause discriminates rather than failing everything.
    expect(body.flows.find((f) => f.name === project.flowName)?.runnable).toBe(true);
  });
});

describe('Q-0017 AC-1/AC-2 — a ticket row carries what a card renders, and nothing it cannot support', () => {
  /** A ticket written by hand, so the frontmatter under test is exactly what this asserts over. */
  const writeTicket = (repoDir: string, folder: string, id: string, extra: string): void => {
    write(path.join(repoDir, 'backlog', folder, 'ticket.md'), [
      '---', `id: ${id}`, 'title: cost probe', 'stage: draft', 'owner: qa', 'repos: []',
      `branch: harness/${id}/integration`, 'priority: p1', 'created: 2026-09-16', extra, '---', 'body', '',
    ].join('\n'));
  };

  /** Every row the listing answers with, by id. */
  const rowsOf = async (app: ReturnType<typeof served>['app']): Promise<Record<string, WireTicket>> => {
    const body = await (await app.request('/tickets')).json() as WireTicketList;
    return Object.fromEntries(body.tickets.map((ticket) => [ticket.id, ticket]));
  };

  test('the listing parses against the shared schema — a browser executes this one, not a cast', async () => {
    // The whole point of the shapes moving to `@quorum/shared` at this ticket: a browser needs a
    // runtime PARSER and not a type, and a `JSON.parse` result assigned to an interface is the
    // silent default the rules forbid. Asserted over a REAL response rather than over a fixture,
    // because what could drift is this projection and not the schema.
    const { app } = served();
    const body = await (await app.request('/tickets')).json();
    const parsed = wireTicketListSchema.safeParse(body);
    expect(parsed.success ? '' : JSON.stringify(parsed.error.issues), 'the live listing does not satisfy its own schema').toBe('');
    const flows = wireFlowListSchema.safeParse(await (await app.request('/flows')).json());
    expect(flows.success ? '' : JSON.stringify(flows.error.issues), 'the live flow listing does not satisfy its own schema').toBe('');
  });

  test('nothing has run is null, every price is zero is zero, and two priced entries are their sum', async () => {
    // Three fixtures because three answers are possible and only one of them is arithmetic.
    // `null` is the one that matters: nothing has run is NOT the claim that it cost nothing, which
    // is the `n/a`-never-`0` rule every other measure on this transport is under. `quorum board`
    // prints `$0.00` for the first two alike, and that divergence is registered in `board.ts`
    // rather than repaired here — no printed byte of that command moves on this ticket.
    const { project, app } = served();
    writeTicket(project.repoDir, 'T-0100-none', 'T-0100', 'iterations: {}');
    writeTicket(project.repoDir, 'T-0101-empty', 'T-0101', 'history: []');
    writeTicket(project.repoDir, 'T-0102-zero', 'T-0102',
      'history:\n  - {stage: draft, run: 1, flow: probe, at: x, cost: 0}\n  - {stage: draft, run: 2, flow: probe, at: y, cost: 0}');
    writeTicket(project.repoDir, 'T-0103-priced', 'T-0103',
      'history:\n  - {stage: draft, run: 1, flow: probe, at: x, cost: 1.5}\n  - {stage: draft, run: 2, flow: probe, at: y, cost: 2.25}');

    const rows = await rowsOf(app);
    expect(rows['T-0100'].billedCostUsd, 'a ticket with no history key was priced').toBeNull();
    expect(rows['T-0101'].billedCostUsd, 'a ticket whose history is empty was priced').toBeNull();
    expect(rows['T-0102'].billedCostUsd, 'a run that really cost nothing was reported as never having run').toBe(0);
    expect(rows['T-0103'].billedCostUsd).toBe(3.75);
  });

  test('a null entry cost is summed as zero, exactly as the board sums it', async () => {
    // The vendor reported no price, so it contributes nothing — and the legend beside the figure is
    // the only thing that says so. Pinned because a schema-level nullable invites the opposite
    // treatment, and `quorum board`'s `?? 0` is the behaviour this is a projection of.
    const { project, app } = served();
    writeTicket(project.repoDir, 'T-0104-unpriced', 'T-0104',
      'history:\n  - {stage: draft, run: 1, flow: probe, at: x, cost: null}\n  - {stage: draft, run: 2, flow: probe, at: y, cost: 4}');
    expect((await rowsOf(app))['T-0104'].billedCostUsd).toBe(4);
  });

  test('Q-0127 AC-14(b) — a history that is ENTIRELY unpriced sums to zero, which is ratified', async () => {
    // Carried to this ticket's gate as a defect and re-measured there: the behaviour matches
    // `billedCostOf`'s own JSDoc, which cites *"Codex cost is reported as tokens, never priced
    // locally"* (2026-08-22), and **zero tickets in this backlog have an entirely unpriced
    // history**, so it is latent rather than live. It is pinned rather than changed because
    // answering `null` would contradict `WireTicket`'s documented contract — `null` means *nothing
    // has run*, and for a ticket every run of which was codex, nothing *was billed* — and because
    // the mixed case one test up is the same shape at a higher frequency, which nothing proposes
    // changing. A later ticket that wants a different answer is changing a wire contract.
    const { project, app } = served();
    writeTicket(project.repoDir, 'T-0109-all-unpriced', 'T-0109',
      'history:\n  - {stage: draft, run: 1, flow: probe, at: x, cost: null}\n  - {stage: draft, run: 2, flow: probe, at: y, cost: null}');
    const rows = await rowsOf(app);
    expect(rows['T-0109'].billedCostUsd, 'an entirely unpriced history stopped summing to zero').toBe(0);
    // …and it is still told apart from a ticket nothing has run, which is the distinction the
    // ratification rests on: those two are different facts and answer differently.
    writeTicket(project.repoDir, 'T-0110-nothing-ran', 'T-0110', 'iterations: {}');
    expect((await rowsOf(app))['T-0110'].billedCostUsd, 'nothing-has-run collapsed into all-unpriced').toBeNull();
  });

  test('iterations travel verbatim, and a stage the vocabulary cannot place still travels', async () => {
    // Two claims the wire schema's own looseness is FOR. The counters are copied rather than
    // computed — there is no denominator anywhere on this transport — and a damaged `ticket.md`
    // yields the literal "undefined" for its STAGE, which must reach a client that can name it
    // rather than being refused into a listing nobody can render. Q-0060 is open and this repairs
    // none of it.
    const { project, app } = served();
    writeTicket(project.repoDir, 'T-0105-iters', 'T-0105', "iterations: {review: 2, 'chore.review': 1}");
    write(path.join(project.repoDir, 'backlog', 'T-0106-damaged', 'ticket.md'), 'no frontmatter at all\n');

    const rows = await rowsOf(app);
    expect(rows['T-0105'].iterations).toStrictEqual({ review: 2, 'chore.review': 1 });
    const damaged = Object.values(rows).find((row) => row.folder === 'T-0106-damaged');
    expect(damaged, 'the damaged ticket was dropped from the listing').toBeDefined();
    expect(damaged?.stage, 'the damaged ticket was given a stage nobody wrote').toBe('undefined');
  });

  test('two tickets whose files supplied no id are two rows, each named by its own folder', async () => {
    // The review's finding: `String(ticket.meta.id)` answered the literal "undefined", so every
    // damaged ticket carried the same fabricated id — indistinguishable from each other, from a
    // ticket whose id really is that word, and duplicate keys in the renderer. The folder is read
    // from the backlog directory rather than from the file that failed to parse, so it is the one
    // identity that survives exactly this case, and it is unique under one root by construction.
    const { project, app } = served();
    write(path.join(project.repoDir, 'backlog', 'T-0107-first-damaged', 'ticket.md'), 'no frontmatter\n');
    write(path.join(project.repoDir, 'backlog', 'T-0108-second-damaged', 'ticket.md'), 'none here either\n');

    const body = await (await app.request('/tickets')).json() as WireTicketList;
    const nameless = body.tickets.filter((row) => row.id === '');
    expect(nameless.map((row) => row.folder).sort(), 'two damaged tickets did not arrive as two rows')
      .toStrictEqual(['T-0107-first-damaged', 'T-0108-second-damaged']);
    // …and not one of them carries an id nobody wrote.
    expect(body.tickets.filter((row) => row.id === 'undefined'), 'an id was fabricated from an absent one')
      .toStrictEqual([]);
    // Every row's folder is distinct, which is what makes it usable as an identity at all.
    const folders = body.tickets.map((row) => row.folder);
    expect(new Set(folders).size, 'two rows share a folder').toBe(folders.length);
    // The whole listing still parses, one damaged row and all — the looseness above, exercised.
    expect(wireTicketListSchema.safeParse(body).success, 'a damaged ticket made the listing unparseable').toBe(true);
  });

  test('the base branch travels with the two git facts it was computed against', async () => {
    // A containment answer is spelled `<base>:contained` and a push-lag sentence names the base, so
    // a client holding the states without the ref can render neither — and deriving it from a second
    // route would be a client guessing which base THESE answers used.
    const { app } = served();
    const body = await (await app.request('/tickets')).json() as WireTicketList;
    expect(body.baseBranch, 'the listing does not say which base it answered about').toBe('main');
  });
});

describe('Q-0119 — run history is reported, never repaired', () => {
  test('/history lists runs newest first and marks an incomplete one without touching it', async () => {
    const { project, app } = served();
    // Different start times, because `sortRuns` orders by `started_at` DESCENDING and falls back
    // to `run_id` ASCENDING only as a tiebreak — identical timestamps made the first version of
    // this test assert the tiebreak's order and call it the sort's.
    writeRun(project.repoDir, `${TICKET_ID}-1`, { ...manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-11T00:00:10.000Z'), started_at: '2026-09-11T00:00:00.000Z' });
    writeRun(project.repoDir, `${TICKET_ID}-2`, { ...manifestOf(`${TICKET_ID}-2`, 'running', null), started_at: '2026-09-11T01:00:00.000Z' });
    const before = fs.readFileSync(path.join(project.repoDir, RUN_HISTORY_ROOT, `${TICKET_ID}-2`, 'manifest.json'), 'utf8');

    const body = await (await app.request('/history')).json() as { runs: { id: string; incomplete: boolean }[]; warnings: unknown[] };
    expect(body.runs.map((r) => r.id)).toStrictEqual([`${TICKET_ID}-2`, `${TICKET_ID}-1`]);
    expect(body.runs.find((r) => r.id === `${TICKET_ID}-2`)?.incomplete, 'a running manifest was not reported incomplete').toBe(true);
    expect(body.runs.find((r) => r.id === `${TICKET_ID}-1`)?.incomplete).toBe(false);
    // Reported, never repaired: `04-architecture.md` is explicit that a server must not tidy a
    // `running` manifest it meets on read. Asserted by bytes, because "did not repair" is exactly
    // the claim a status check cannot make.
    expect(fs.readFileSync(path.join(project.repoDir, RUN_HISTORY_ROOT, `${TICKET_ID}-2`, 'manifest.json'), 'utf8'),
      'the server tidied a manifest it was only asked to read').toBe(before);
  });

  test('a store it could only partly read returns the listing WITH its warnings, not an error', async () => {
    // `failSoftly`'s distinction, over HTTP. A run whose manifest is broken must not take the ones
    // that are fine with it — answering 500 would hide every readable run because of one that is not.
    const { project, app } = served();
    writeRun(project.repoDir, `${TICKET_ID}-1`, manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-11T00:00:10.000Z'));
    const broken = path.join(project.repoDir, RUN_HISTORY_ROOT, `${TICKET_ID}-2`);
    fs.mkdirSync(broken, { recursive: true });
    write(path.join(broken, 'manifest.json'), '{ not json\n');

    const response = await app.request('/history');
    expect(response.status, 'one damaged run took the whole listing with it').toBe(200);
    const body = await response.json() as { runs: { id: string }[]; warnings: unknown[] };
    expect(body.runs.map((r) => r.id), 'the readable run was lost').toStrictEqual([`${TICKET_ID}-1`]);
    expect(body.warnings.length, 'the damage was swallowed rather than reported').toBeGreaterThan(0);
  });

  test('/history/:id tells a missing run from a damaged one', async () => {
    // Two failures, told apart rather than collapsed. Answering 404 to a run that IS there and
    // cannot be parsed would report a probe failure as proven absence — "A probe that could not
    // answer is not a negative" (2026-09-10) at this surface.
    const { project, app } = served();
    const damaged = path.join(project.repoDir, RUN_HISTORY_ROOT, `${TICKET_ID}-9`);
    fs.mkdirSync(damaged, { recursive: true });
    write(path.join(damaged, 'manifest.json'), '{ not json\n');

    expect((await app.request(`/history/${TICKET_ID}-404`)).status, 'an absent run was not 404').toBe(404);
    expect((await app.request(`/history/${TICKET_ID}-9`)).status, 'a damaged run was reported absent').toBe(422);
  });

  test('/history/:id reports tokens per vendor and never one blended number', async () => {
    // "Codex cost is reported as tokens, never priced locally" (2026-08-22). The manifest's roll-up
    // is one row per vendor; summing across rows would put a priced vendor and a token-only one in
    // one figure, which is the claim that entry refuses.
    const { project, app } = served();
    const manifest = manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-11T00:00:10.000Z');
    manifest.rollup = [
      { vendor: 'claude', step_count: 1, unpriced_steps: 0, cost_usd: 1.5, input_tokens: 10, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null },
      { vendor: 'codex', step_count: 1, unpriced_steps: 1, cost_usd: null, input_tokens: 5, output_tokens: 7, cached_input_tokens: null, cache_write_input_tokens: null },
    ];
    writeRun(project.repoDir, `${TICKET_ID}-1`, manifest);

    const body = await (await app.request(`/history/${TICKET_ID}-1`)).json() as { tokensByVendor: Record<string, number | null> };
    expect(Object.keys(body.tokensByVendor).sort(), 'the vendors were merged').toStrictEqual(['claude', 'codex']);
    expect(body.tokensByVendor.claude).toBe(30);
    expect(body.tokensByVendor.codex).toBe(12);
  });
});

describe('Q-0018 AC-1/AC-2/AC-3/AC-4 — the listing answers the shape a browser parses it with', () => {
  /** One manifest occurrence, so an occurrence count is over real entries rather than a number. */
  const occurrence = (seq: number, stepId: string): Record<string, unknown> => ({
    step_id: stepId, occurrence_dir: `steps/${String(seq).padStart(3, '0')}-${stepId}`, kind: 'agent',
    role: null, adapter: 'zeta', model: null, branch: null, worktree: null,
    started_at: '2026-09-18T01:00:01.000Z', duration_ms: 1200, attempts: 1, status: 'completed',
    verdict: null, error: null, usage: null,
  });

  /** The listing, parsed with the schema a browser parses it with rather than read as JSON. */
  const listing = async (app: ReturnType<typeof served>['app']) => {
    const response = await app.request('/history');
    expect(response.status, 'the listing did not answer 200').toBe(200);
    const parsed = wireRunHistoryListSchema.safeParse(await response.json());
    expect(parsed.error?.issues, 'the listing does not satisfy the schema a browser parses it with')
      .toBeUndefined();
    if (!parsed.success) throw new Error('unreachable');
    return parsed.data;
  };

  test('a row carries the manifest\'s own measures, an occurrence count, and a NARROWED roll-up', async () => {
    const { project, app } = served();
    const finished = manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-18T01:10:00.000Z');
    finished.steps = [occurrence(1, 'implement'), occurrence(2, 'review'), occurrence(3, 'integrate')];
    finished.rollup = [
      { vendor: 'zeta', step_count: 2, unpriced_steps: 0, cost_usd: 1.5, input_tokens: 10, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null },
      { vendor: 'omega', step_count: 1, unpriced_steps: 1, cost_usd: null, input_tokens: 5, output_tokens: 7, cached_input_tokens: null, cache_write_input_tokens: null },
    ];
    writeRun(project.repoDir, `${TICKET_ID}-1`, finished);

    const [row] = (await listing(app)).runs;
    expect(row?.occurrenceCount, 'the occurrence count is not the manifest\'s own array length').toBe(3);
    expect(row?.duration_ms, "the engine's duration did not cross").toBe(10);
    expect(row?.started_at, 'the recorded start did not cross').toBe('2026-09-11T00:00:00.000Z');
    // **Exactly the four a surface renders**, and never the manifest's rows as they sit on disk:
    // asserted by key identity, because a narrowing that let one token measure through would render
    // as a listing that works and a payload 57% larger than the one this projection was measured at.
    expect(row?.rollup.map((entry) => Object.keys(entry).sort()))
      .toStrictEqual([
        ['cost_usd', 'step_count', 'unpriced_steps', 'vendor'],
        ['cost_usd', 'step_count', 'unpriced_steps', 'vendor'],
      ]);
    // …and an unpriced vendor stays `null` rather than becoming a zero, which is what separates
    // *nobody reported a price* from *it cost nothing*.
    expect(row?.rollup.map((entry) => [entry.vendor, entry.cost_usd]))
      .toStrictEqual([['zeta', 1.5], ['omega', null]]);
  });

  test('a run in flight carries no end and no duration, and the server manufactures neither', async () => {
    const { project, app } = served();
    writeRun(project.repoDir, `${TICKET_ID}-2`, manifestOf(`${TICKET_ID}-2`, 'running', null));
    const [row] = (await listing(app)).runs;
    expect(row?.incomplete, 'a running manifest was not reported incomplete').toBe(true);
    expect(row?.ended_at, 'a running manifest was given an end').toBeNull();
    expect(row?.duration_ms, 'a running manifest was given a duration').toBeNull();
  });

  test('every run is listed, however many there are: no cap, no page, no truncation', async () => {
    // **More runs than a table shows at once**, which is the discrimination: a clause over three
    // rows cannot tell a listing that returns everything from one that returns the first page, and
    // visual containment on a screen is not server truncation.
    const { project, app } = served();
    const ids = Array.from({ length: 60 }, (_, index) => `${TICKET_ID}-${String(index + 1)}`);
    for (const id of ids) writeRun(project.repoDir, id, manifestOf(id, 'completed', '2026-09-18T01:10:00.000Z'));
    const answered = (await listing(app)).runs.map((row) => row.id);
    expect(answered.length, 'the listing capped or paged what it returned').toBe(ids.length);
    expect([...answered].sort(), 'a run was dropped from the listing').toStrictEqual([...ids].sort());
  });

  test('a run the route cannot compose a row for is NAMED, and never takes the listing with it', async () => {
    // `readRunsDir` proves five things about a manifest and this route answers with more than five,
    // so it parses each candidate against the shape it declares. A failure is a warning carrying the
    // parser's own words — `failSoftly`'s distinction one level in from where that reader applies
    // it, the difference from the detail route being blast radius rather than principle.
    const { project, app } = served();
    writeRun(project.repoDir, `${TICKET_ID}-1`, manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-18T01:10:00.000Z'));
    // Passes `manifestShapeError` — `run_id`, `ticket_id` and `status` are strings and both arrays
    // are arrays — and cannot produce a row: `started_at` is not a string.
    const damaged = manifestOf(`${TICKET_ID}-2`, 'completed', '2026-09-18T01:10:00.000Z');
    damaged.started_at = 42;
    writeRun(project.repoDir, `${TICKET_ID}-2`, damaged);
    // And the case `readRunsDir` itself catches, so both channels are shown to reach one envelope.
    const unreadable = path.join(project.repoDir, RUN_HISTORY_ROOT, `${TICKET_ID}-3`);
    fs.mkdirSync(unreadable, { recursive: true });
    write(path.join(unreadable, 'manifest.json'), '{ not json\n');

    const body = await listing(app);
    expect(body.runs.map((row) => row.id), 'a readable run was lost to a damaged sibling')
      .toStrictEqual([`${TICKET_ID}-1`]);
    expect(body.warnings.map((warning) => warning.runId).sort(), 'a run that could not be reported was dropped')
      .toStrictEqual([`${TICKET_ID}-2`, `${TICKET_ID}-3`]);
    for (const warning of body.warnings) {
      expect(warning.message.length, `${warning.runId} was named with no reason`).toBeGreaterThan(0);
    }
  });

  test("AC-13 — a runs root nothing has written to answers an EMPTY listing, not an error", async () => {
    // **The only state an adopter's first clone can produce**, `.quorum/` being gitignored: a store
    // that answered and holds nothing is not a failure, and a 404 or a 500 here would send a reader
    // looking for a daemon that is running and answering. The fixture writes no run at all, so the
    // root does not exist rather than existing and being empty.
    const { project, app } = served();
    expect(fs.existsSync(path.join(project.repoDir, RUN_HISTORY_ROOT)),
      'the fixture created a runs root, so this clause is not about one that was never written to')
      .toBe(false);
    const body = await listing(app);
    expect(body.runs, 'a store with no runs invented one').toStrictEqual([]);
    expect(body.warnings, 'a store never written to was reported as damaged').toStrictEqual([]);
  });

  test('AC-4 — producing either response repairs nothing, including a manifest still being written', async () => {
    // Asserted by BYTES, because "did not repair" is exactly the claim a status check cannot make.
    // The `running` manifest is the live case rather than a hypothetical one: `docs/04-architecture.md`
    // is explicit that a server must not tidy one it meets on read.
    const { project, app } = served();
    const live = manifestOf(`${TICKET_ID}-1`, 'running', null);
    live.steps = [occurrence(1, 'implement')];
    writeRun(project.repoDir, `${TICKET_ID}-1`, live);
    writeRun(project.repoDir, `${TICKET_ID}-2`, manifestOf(`${TICKET_ID}-2`, 'completed', '2026-09-18T01:10:00.000Z'));
    const root = path.join(project.repoDir, RUN_HISTORY_ROOT);
    const bytes = (): Record<string, string> => Object.fromEntries(
      fs.readdirSync(root).map((id) => [id, fs.readFileSync(path.join(root, id, 'manifest.json'), 'utf8')]),
    );

    const before = bytes();
    await app.request('/history');
    await app.request(`/history/${TICKET_ID}-1`);
    await app.request(`/history/${TICKET_ID}-2`);
    expect(bytes(), 'the server rewrote a manifest it was only asked to read').toStrictEqual(before);
    // The directory listing too, so "repaired" cannot be satisfied by a file created beside one.
    expect(fs.readdirSync(root).sort(), 'the server created or removed a run directory')
      .toStrictEqual(Object.keys(before).sort());
  });
});

describe('Q-0135 AC-9 — the route answers the shape a browser parses it with', () => {
  test("a real run directory's own bytes satisfy wireRunHistorySchema, running and finished", async () => {
    // **The route's OWN bytes rather than a fixture of them**, which is `http.test.ts`'s `listRuns`
    // arrangement for its reason: a schema nothing executes over real output is a declaration with
    // no subject, and this is the first validation `started_at`, `ended_at`, `duration_ms` and
    // `status` have had anywhere in this chain. The directory is one this suite builds, so nothing
    // here depends on `.quorum/runs` existing in the checkout.
    const { project, app } = served();
    const running = manifestOf(`${TICKET_ID}-1`, 'running', null);
    running.rollup = [
      { vendor: 'claude', step_count: 2, unpriced_steps: 0, cost_usd: 1.5, input_tokens: 10, output_tokens: 20, cached_input_tokens: null, cache_write_input_tokens: null },
      { vendor: 'codex', step_count: 1, unpriced_steps: 1, cost_usd: null, input_tokens: 5, output_tokens: 7, cached_input_tokens: null, cache_write_input_tokens: null },
    ];
    writeRun(project.repoDir, `${TICKET_ID}-1`, running);
    writeRun(project.repoDir, `${TICKET_ID}-2`, manifestOf(`${TICKET_ID}-2`, 'completed', '2026-09-11T00:00:10.000Z'));

    const read = async (id: string): Promise<WireRunHistory> => {
      const parsed = wireRunHistorySchema.safeParse(await (await app.request(`/history/${id}`)).json());
      expect(parsed.error?.issues, `${id} does not satisfy the schema a browser parses it with`).toBeUndefined();
      if (!parsed.success) throw new Error('unreachable');
      return parsed.data;
    };

    const live = await read(`${TICKET_ID}-1`);
    expect(live.incomplete, 'a running manifest was not reported incomplete').toBe(true);
    expect(live.manifest.ended_at, 'a running manifest carried an end').toBeNull();
    expect(live.manifest.duration_ms, 'a running manifest carried a duration').toBeNull();
    // The order is the roll-up's own and the price of an unpriced vendor stays `null`, which is what
    // separates *nobody reported one* from *it cost nothing*.
    expect(live.manifest.rollup.map((row) => [row.vendor, row.cost_usd]))
      .toStrictEqual([['claude', 1.5], ['codex', null]]);

    const done = await read(`${TICKET_ID}-2`);
    expect(done.incomplete, 'a finished manifest was reported incomplete').toBe(false);
    // The engine's own figure, which is what a screen freezes rather than subtracting two instants.
    expect(done.manifest.duration_ms, "the engine's duration did not cross").toBe(10);
    expect(done.manifest.rollup, 'a run with no billed step invented a row').toStrictEqual([]);
  });
});

describe('Q-0119 — a manifest is a cast and not a check, and this surface survives one', () => {
  test('a rollup that is not an array reports no vendors rather than throwing a stack', async () => {
    // `readRun`'s own JSDoc calls the parsed document "a cast, never a check", so a hand-edited
    // manifest can carry anything of the right JSON type. Before the guard, `.map()` on it threw
    // where nothing caught and one damaged file became a 500 with a Node stack — which is the
    // failure a reader can do least with.
    const { project, app } = served();
    const manifest = manifestOf(`${TICKET_ID}-1`, 'completed', '2026-09-11T00:00:10.000Z');
    manifest.rollup = 'not an array';
    manifest.steps = 42;
    writeRun(project.repoDir, `${TICKET_ID}-1`, manifest);

    const response = await app.request(`/history/${TICKET_ID}-1`);
    expect(response.status, 'a damaged rollup took the whole request with it').toBe(200);
    const body = await response.json() as { tokensByVendor: Record<string, unknown>; steps: unknown[]; manifest: { rollup: unknown } };
    expect(body.tokensByVendor, 'an unusable rollup invented vendors').toStrictEqual({});
    expect(body.steps, 'an unusable step list invented steps').toStrictEqual([]);
    // …and the manifest travels whole beside it, so a reader still sees what is actually on disk
    // rather than a tidied version of it.
    expect(body.manifest.rollup, 'the surface rewrote what it read').toBe('not an array');
  });

  test('an ARRAY of things that are not rows is refused element by element', async () => {
    // Review round 2: `Array.isArray` alone moved the throw from the `.map` to inside it. A number
    // has no `vendor`, so the guard has to read the elements rather than the container.
    const { project, app } = served();
    const manifest = manifestOf(`${TICKET_ID}-2`, 'completed', '2026-09-11T00:00:10.000Z');
    manifest.rollup = [1, 2, null, 'three', { vendor: 7 }, { vendor: 'claude', input_tokens: 4, output_tokens: 6 }];
    manifest.steps = [1, null, 'two'];
    writeRun(project.repoDir, `${TICKET_ID}-2`, manifest);

    const response = await app.request(`/history/${TICKET_ID}-2`);
    expect(response.status, 'an array of non-rows took the request with it').toBe(200);
    const body = await response.json() as { tokensByVendor: Record<string, unknown>; steps: unknown[] };
    // The one usable row survives and the five unusable ones are dropped, which is the
    // discrimination: refusing all of them would be as wrong as accepting all of them.
    expect(Object.keys(body.tokensByVendor)).toStrictEqual(['claude']);
    expect(body.tokensByVendor.claude).toBe(10);
    expect(body.steps).toStrictEqual([]);
  });
});

describe('Q-0127 AC-1/AC-4 — one ticket answers its frontmatter and the names of its files', () => {
  /** A ticket folder with a nested artifact, a run log and a large file nobody asked for. */
  function withFolder(): ReturnType<typeof served> {
    const serving = served();
    const { ticketDir } = serving.project;
    // Written so the directory's own order is NOT the answer's order: `runs.log` and `ticket.md`
    // sort after `dev/…`, and `review/` is created before `dev/`.
    write(path.join(ticketDir, 'review', 'chore', 'run-2', 'chore-iter-1.md'), 'review\n');
    write(path.join(ticketDir, 'dev', 'chore', 'run-2', 'implement-iter-1.md'), 'implement\n');
    write(path.join(ticketDir, 'runs.log'), 'a line\n');
    write(path.join(ticketDir, 'adapter-probe.md'), 'probe\n');
    return serving;
  }

  test('the body names every file with its size, sorted, and carries no file text at all', async () => {
    const { project, app } = withFolder();
    const artifact = 'THE-TEXT-OF-A-FILE-NOBODY-ASKED-FOR\n'.repeat(4);
    write(path.join(project.ticketDir, 'review', 'hand-review.txt'), artifact);

    const response = await app.request(`/tickets/${TICKET_ID}`);
    expect(response.status).toBe(200);
    const body = await response.json() as WireTicketDetail;
    expect(body.files.map((file) => file.rel)).toStrictEqual([
      'adapter-probe.md',
      'dev/chore/run-2/implement-iter-1.md',
      'review/chore/run-2/chore-iter-1.md',
      'review/hand-review.txt',
      'runs.log',
      'ticket.md',
    ]);
    expect(body.files.find((file) => file.rel === 'review/hand-review.txt')?.bytes).toBe(artifact.length);
    // No property anywhere in the body carries that file's text — over the SERIALISED body, so a
    // field added later cannot smuggle it back in under a name this assertion does not know.
    expect(JSON.stringify(body), 'a file\'s text crossed the wire on a route that only names files')
      .not.toContain('THE-TEXT-OF-A-FILE-NOBODY-ASKED-FOR');
    expect(wireTicketDetailSchema.safeParse(body).success, 'the live detail does not satisfy its own schema').toBe(true);
  });

  test('the ticket half is the row the listing answers with, field for field', async () => {
    // One projection, so a board card and a page header cannot report one ticket two ways — which
    // is the failure a board exists to prevent, arriving one screen along.
    const { app } = withFolder();
    const listing = await (await app.request('/tickets')).json() as WireTicketList;
    const detail = await (await app.request(`/tickets/${TICKET_ID}`)).json() as WireTicketDetail;
    const row = listing.tickets.find((ticket) => ticket.id === TICKET_ID);
    expect(row, 'the listing does not hold the ticket the detail answered for').toBeDefined();
    expect(detail.ticket).toStrictEqual(row);
  });

  test('it carries no push lag and no base branch, which belong to the listing that renders them', async () => {
    const { app } = withFolder();
    const body = await (await app.request(`/tickets/${TICKET_ID}`)).json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toStrictEqual(['excluded', 'files', 'ticket']);
  });

  test('a path whose first segment begins with a dot is counted and never named', async () => {
    // The rule is the leading dot and NOT the name `.harness`, which is what the second directory
    // below is for: under a rule keyed on that name, `.scratch/notes.md` is named in `files` and
    // the count is 1 rather than 2, so both assertions go red on exactly that mutation.
    const { project, app } = withFolder();
    write(path.join(project.ticketDir, '.harness', 'run-3', 'verdict.json'), '{"verdict":"approve"}\n');
    write(path.join(project.ticketDir, '.scratch', 'notes.md'), 'scratch\n');

    const body = await (await app.request(`/tickets/${TICKET_ID}`)).json() as WireTicketDetail;
    const serialised = JSON.stringify(body);
    expect(serialised, 'the engine\'s own run state was named on a backlog route').not.toContain('.harness');
    expect(serialised, 'a second hidden directory leaked, so the rule is the name rather than the dot')
      .not.toContain('.scratch');
    expect(body.excluded.count, 'the disclosure does not say how much was not named').toBe(2);
    expect(body.excluded.bytes).toBe('{"verdict":"approve"}\n'.length + 'scratch\n'.length);
  });

  test('and neither hidden path can be read either', async () => {
    const { project, app } = withFolder();
    write(path.join(project.ticketDir, '.harness', 'run-3', 'verdict.json'), '{"verdict":"approve"}\n');
    const response = await app.request(`/tickets/${TICKET_ID}/file?path=${encodeURIComponent('.harness/run-3/verdict.json')}`);
    expect(response.status, 'engine run state was readable through a backlog route').toBe(400);
    expect((await response.json() as WireRefusal).code).toBe('not-a-file-path');
  });
});

describe('Q-0127 AC-3 — three refusals, decided by a predicate rather than by an error\'s prose', () => {
  /** Both routes, because a token refusal belongs to each of them and not to one. */
  const bothRoutes = (token: string): string[] =>
    [`/tickets/${token}`, `/tickets/${token}/file?path=ticket.md`];

  test('a token that is not one name is 400 on both routes, before anything is opened', async () => {
    const { app } = served();
    // The shapes that actually REACH a route: a token carrying a separator, however it was spelled.
    for (const token of ['..%2Fetc', 'a%2Fb', '%2Fetc%2Fpasswd']) {
      for (const route of bothRoutes(token)) {
        const response = await app.request(route);
        expect(response.status, `${route} did not refuse a token that is not one name`).toBe(400);
        expect((await response.json() as WireRefusal).code).toBe('not-a-ticket-token');
      }
    }
  });

  test('and the three that never reach a route are gone before it, rather than answered', async () => {
    // `.`, `..` and the empty token are single- and double-dot path segments, which URL parsing
    // resolves away — `%2E` and `%2E%2E` included, the spec treating those as the same segments —
    // so what arrives is `/tickets` or a path no route matches. Asserted rather than assumed,
    // because *not refused here* and *not reachable at all* are different claims and only one of
    // them is true of these three.
    const { app } = served();
    for (const token of ['.', '..', '%2E', '%2E%2E', '']) {
      for (const route of bothRoutes(token)) {
        const response = await app.request(route);
        expect([200, 404], `${route} reached a route and answered ${String(response.status)}`)
          .toContain(response.status);
        if (response.status === 200) {
          // The one that resolves to something real is `/tickets` itself, which is the listing.
          expect(Object.keys(await response.json() as Record<string, unknown>).sort())
            .toStrictEqual(['baseBranch', 'pushLag', 'tickets']);
        }
      }
    }
    // …and the predicate the route asks is still the one that refuses them, which is what makes the
    // paragraph above a statement about the transport rather than a hole in this route.
    for (const token of ['.', '..', '', 'a/b', '../etc']) {
      expect(isOneName(token), `${JSON.stringify(token)} is one name`).toBe(false);
    }
    expect(isOneName(TICKET_ID), 'the predicate refuses everything, so it discriminates nothing').toBe(true);
  });

  test('a well-formed token naming no folder is 404 on both routes', async () => {
    const { app } = served();
    for (const route of bothRoutes('T-9999')) {
      const response = await app.request(route);
      expect(response.status, `${route} did not report an absent ticket as absent`).toBe(404);
      expect((await response.json() as WireRefusal).code).toBe('no-such-ticket');
    }
  });

  test('a ticket whose file did not yield the four fields is 422, naming the file and the field', async () => {
    const { project, app } = served();
    write(path.join(project.repoDir, 'backlog', 'T-0200-damaged', 'ticket.md'), 'no frontmatter at all\n');
    write(path.join(project.repoDir, 'backlog', 'T-0201-partial', 'ticket.md'),
      ['---', 'id: T-0201', 'title: partial', 'stage: draft', '---', 'body', ''].join('\n'));

    for (const route of bothRoutes('T-0200')) {
      const response = await app.request(route);
      expect(response.status, `${route} answered for a ticket whose file yielded nothing`).toBe(422);
      const refusal = await response.json() as WireRefusal;
      expect(refusal.code).toBe('malformed-ticket');
      expect(refusal.condition, 'the refusal does not name the file that did not parse').toContain('ticket.md');
    }
    const partial = await app.request('/tickets/T-0201');
    expect(partial.status).toBe(422);
    expect((await partial.json() as WireRefusal).condition, 'the refusal does not name the field that is missing')
      .toContain('owner');
  });

  test('and a ticket whose file claims another id is 422 rather than answered under this one', async () => {
    const { project, app } = served();
    write(path.join(project.repoDir, 'backlog', 'T-0202-mismatched', 'ticket.md'), [
      '---', 'id: T-9001', 'title: mismatched', 'stage: draft', 'owner: qa', 'repos: []',
      'branch: harness/T-9001/integration', 'priority: p2', 'created: 2026-09-16', '---', 'body', '',
    ].join('\n'));
    const response = await app.request('/tickets/T-0202');
    expect(response.status, 'one ticket was answered under another ticket\'s id').toBe(422);
    expect((await response.json() as WireRefusal).condition).toContain('T-9001');
    // And the listing still renders it, which is the deliberate asymmetry: the board says the
    // ticket is there and the page says its file does not read as one.
    const listing = await (await app.request('/tickets')).json() as WireTicketList;
    expect(listing.tickets.map((ticket) => ticket.folder), 'the listing hid a ticket the page refuses')
      .toContain('T-0202-mismatched');
  });

  test('no status here is chosen by matching a message core wrote', async () => {
    // The structural half. `Backlog.dirOf` raises a plain `Error` for *not one name* and another
    // for *no such ticket*, so a route that told them apart by their prose would be coupled to
    // `core`'s wording — and a reworded sentence would silently turn a 400 into a 404.
    const module = fs.readFileSync(new URL('./read.ts', import.meta.url), 'utf8');
    const CORE_SENTENCES = ['not a ticket token', 'ticket not found', 'not a path inside the ticket folder'];
    for (const sentence of CORE_SENTENCES) {
      expect(module.includes(`'${sentence}`), `read.ts matches core's own sentence: ${sentence}`).toBe(false);
      expect(module.includes(`"${sentence}`), `read.ts matches core's own sentence: ${sentence}`).toBe(false);
      expect(module.includes(`/${sentence}`), `read.ts matches core's own sentence: ${sentence}`).toBe(false);
    }
    expect(module, 'read.ts reads a message off a caught error to decide a status').not.toMatch(/catch\s*\(\s*\w+\s*\)\s*\{[^}]*\.message/);
    // …and the clause fires, over the shape it forbids rather than over an empty corpus.
    const hostile = "} catch (error) { return error.message.includes('ticket not found') ? c.json(x, 404) : c.json(y, 400); }";
    expect(CORE_SENTENCES.some((sentence) => hostile.includes(`'${sentence}`))).toBe(true);
    expect(/catch\s*\(\s*\w+\s*\)\s*\{[^}]*\.message/.test(hostile)).toBe(true);
  });
});

describe('Q-0127 AC-5/AC-6 — one file, only one this request named, and only if it is text', () => {
  /** A ticket folder holding a nested artifact and one file whose NAME carries a wildcard. */
  function withFiles(): ReturnType<typeof served> {
    const serving = served();
    write(path.join(serving.project.ticketDir, 'dev', 'chore', 'run-2', 'implement-iter-1.md'), 'implement\n');
    write(path.join(serving.project.ticketDir, 'review', 'star*name.md'), 'starred\n');
    return serving;
  }

  const fileAt = (token: string, rel: string): string =>
    `/tickets/${token}/file?path=${encodeURIComponent(rel)}`;

  test('a listed file is answered with its text and the size of what was read', async () => {
    const { app } = withFiles();
    const response = await app.request(fileAt(TICKET_ID, 'dev/chore/run-2/implement-iter-1.md'));
    expect(response.status).toBe(200);
    const body = await response.json() as WireTicketFile;
    expect(body).toStrictEqual({ rel: 'dev/chore/run-2/implement-iter-1.md', bytes: 10, text: 'implement\n' });
    expect(wireTicketFileSchema.safeParse(body).success, 'the live file does not satisfy its own schema').toBe(true);
  });

  test('a pattern, a directory, an absolute path, a traversal and an unlisted path are all refused', async () => {
    const { app } = withFiles();
    for (const rel of ['*.md', 'dev/', '/etc/passwd', '../ticket.md', 'dev/nothing.md', '']) {
      const response = await app.request(fileAt(TICKET_ID, rel));
      expect(response.status, `${JSON.stringify(rel)} was not refused`).toBe(400);
      expect((await response.json() as WireRefusal).code).toBe('not-a-file-path');
    }
    // A percent-encoded traversal is the same refusal, arriving through the query decoder rather
    // than as written.
    const encoded = await app.request(`/tickets/${TICKET_ID}/file?path=%2E%2E%2Fticket.md`);
    expect(encoded.status, 'a percent-encoded traversal was not refused').toBe(400);
  });

  test('a file whose own NAME carries a wildcard is listed and is still refused', async () => {
    // The case membership alone does not close: the path IS one this ticket holds, so a route that
    // only asked "is it in the listing?" would glob-shaped-name its way to an answer. This route
    // reads one file, and a client that expected a pattern would take one answer for a whole match.
    const { app } = withFiles();
    const detail = await (await app.request(`/tickets/${TICKET_ID}`)).json() as WireTicketDetail;
    expect(detail.files.map((file) => file.rel), 'the starred file is not in the listing, so this proves nothing')
      .toContain('review/star*name.md');
    const response = await app.request(fileAt(TICKET_ID, 'review/star*name.md'));
    expect(response.status).toBe(400);
    expect((await response.json() as WireRefusal).code).toBe('not-a-file-path');
  });

  test('a file removed BEFORE the request is refused at membership, and never reaches the read', async () => {
    // The pre-request case, which is not the 404 arm and is kept apart from it so the two are not
    // read as one answer: a file that has gone has left this request's own listing too, so
    // membership stops it and the byte read is never asked. Proven by the same path answering 200
    // while the file is there.
    const { project, app } = withFiles();
    const rel = 'review/removed-first.md';
    write(path.join(project.ticketDir, rel), 'here\n');
    expect((await app.request(fileAt(TICKET_ID, rel))).status).toBe(200);
    fs.rmSync(path.join(project.ticketDir, rel));
    const response = await app.request(fileAt(TICKET_ID, rel));
    expect(response.status, 'a file that vanished before the request was not refused at membership').toBe(400);
    expect((await response.json() as WireRefusal).code).toBe('not-a-file-path');
  });

  test('a file that stops being one between the listing and the read is 404, not 400', async () => {
    // AC-5's narrow arm, STAGED rather than described. The window is one request wide — membership
    // is derived from the listing this same request computed — so the only way a listed path
    // reaches the read and finds nothing is for the file to leave between the two.
    //
    // The seam is the listing's own measurement. `listTicketFiles` stats each name it enumerates,
    // and the file is removed at the instant that stat returns, so the listing names it with the
    // real size it has just read. Everything after that is unmocked production code: the membership
    // test passes on a listing that is true of the moment it was taken, `readTicketFileBytes` opens
    // a name with nothing at it and answers `null` for a real `ENOENT`, and the route maps that to
    // 404. The seam reaches the listing and nothing else on this path — `pathInside` resolves
    // through `realpathSync` and `lstatSync`, and the only other `statSync` in the request is
    // `isFolderIn`'s, on the ticket DIRECTORY.
    //
    // `core` covers both reasons the read answers `null` — an absent file and a directory — over
    // its own boundary; what only this seam can reach is the route's mapping of that `null` onto a
    // status, which is the line the criterion is about.
    const { project, app } = withFiles();
    const rel = 'review/vanishes.md';
    const abs = path.join(project.ticketDir, rel);
    write(abs, 'here\n');
    // The fixture is sound first, so a 404 below is the interleaving rather than a path this ticket
    // never held.
    expect((await app.request(fileAt(TICKET_ID, rel))).status).toBe(200);

    const realStatSync = fs.statSync;
    // An object rather than a `let`, so the assertion below reads its declared type: a `let` that
    // is only ever assigned inside a callback is narrowed to its initialiser at every later read.
    const staged = { listedBytes: -1 };
    // The arguments are forwarded whole rather than re-declared, so the delegation is transparent
    // for every caller and every overload — and so this names neither options type, one of which
    // `@typescript-eslint/no-deprecated` refuses.
    const stat = vi.spyOn(fs, 'statSync').mockImplementation(
      (...args: Parameters<typeof fs.statSync>) => {
        const answer = realStatSync(...args);
        // Once, and only for the file this test is about: every other name — including the second
        // look this path gets if anything asks again — is measured and left alone.
        if (staged.listedBytes < 0 && String(args[0]) === abs) {
          staged.listedBytes = Number(answer?.size ?? -1);
          fs.rmSync(abs);
        }
        return answer;
      });
    try {
      const response = await app.request(fileAt(TICKET_ID, rel));
      // The staging happened, and it happened where this test says it does. A listing that never
      // measured the file would leave it on disk and answer 200, so this cannot pass vacuously —
      // and the size is the real one, which is what says the listing NAMED the file rather than
      // skipping it.
      expect(staged.listedBytes, 'the listing never measured the file, so nothing was staged').toBe(5);
      expect(response.status, 'a file that survived the listing and not the read was not answered 404').toBe(404);
      // 400 here would mean it had left the listing as well, which is the test above. This status
      // is reachable only through membership passing and the byte read then answering nothing.
      expect((await response.json() as WireRefusal).code).toBe('no-such-file');
    } finally {
      stat.mockRestore();
    }
  });

  test('confinement still fires underneath, which membership does not replace', async () => {
    // Reached directly rather than through the route, because the route refuses a traversing path at
    // membership first — so the only way to show `core`'s clause is still load-bearing is to hand it
    // one. A link planted at a listed name is refused there and not here.
    const { project } = withFiles();
    const ticket = project.project.backlog.read(TICKET_ID);
    for (const rel of ['../ticket.md', 'dev/../../escape.md']) {
      expect(() => readTicketFileBytes(project.project.backlog.root, ticket, rel), `${rel} reached core unrefused`)
        .toThrow(/not a path inside the ticket folder/);
    }
  });

  test('a file whose bytes are not well-formed UTF-8 is refused under its own code', async () => {
    const { project, app } = withFiles();
    fs.writeFileSync(path.join(project.ticketDir, 'review', 'store.bin'), Buffer.from([0x00, 0x01, 0xff, 0xfe]));
    const response = await app.request(fileAt(TICKET_ID, 'review/store.bin'));
    expect(response.status).toBe(422);
    const refusal = await response.json() as WireRefusal;
    expect(refusal.code, 'a binary file is refused under a code of its own').toBe('unsupported-file-encoding');
    // Distinct from every other refusal this pair of routes can produce, which is what makes the
    // set switchable by a client.
    expect(['not-a-ticket-token', 'no-such-ticket', 'malformed-ticket', 'not-a-file-path', 'no-such-file'])
      .not.toContain(refusal.code);
    // And nothing substituted crossed the wire: the point of refusing is that the alternative is
    // serving a file with U+FFFD in place of bytes nobody can recover.
    expect(JSON.stringify(refusal)).not.toContain('�');
  });

  test('and it discriminates: the three real files that legitimately hold U+FFFD are served', async () => {
    // **The half that matters.** The obvious instrument — does the decoded text contain a
    // replacement character — would report three hand-written markdown files under this
    // repository's own backlog as binary on the day it shipped. Those three names are staged here
    // with content carrying that character as valid UTF-8, and each is asked for BY NAME.
    //
    // The content is this file's rather than the repository's, deliberately: reading
    // `backlog/Q-0006/…` from this package's suite would put a `backlog/**` turbo input on this
    // task and make the verdict depend on files no criterion may pin. What is under test is the
    // instrument, and a legitimate U+FFFD is a legitimate U+FFFD wherever it was typed.
    const { project, app } = withFiles();
    const REAL_NAMES = ['qa/scenario-review.md', 'requirements/merged.md', 'requirements/run-1/merged-iter-1.md'];
    for (const rel of REAL_NAMES) {
      write(path.join(project.ticketDir, rel), `a replacement character, �, written by hand\n`);
    }
    for (const rel of REAL_NAMES) {
      const response = await app.request(fileAt(TICKET_ID, rel));
      expect(response.status, `${rel} was refused, so the instrument fires on valid UTF-8`).toBe(200);
      expect((await response.json() as WireTicketFile).text).toContain('�');
    }
  });

  test('a multi-byte character across a chunk boundary is served, and a truncated one is refused', async () => {
    // The decode is whole-file and fatal, so neither case depends on a buffer size — which is the
    // property, and which a prefix decode would fail in both directions: it would report a valid
    // file as binary and could not see a truncation past its own window.
    const { project, app } = withFiles();
    const pad = 'a'.repeat(4095);
    fs.writeFileSync(path.join(project.ticketDir, 'review', 'straddles.md'),
      Buffer.concat([Buffer.from(pad, 'utf8'), Buffer.from('é', 'utf8'), Buffer.from('\n', 'utf8')]));
    // A lead byte with no continuation, at the same offset.
    fs.writeFileSync(path.join(project.ticketDir, 'review', 'truncated.md'),
      Buffer.concat([Buffer.from(pad, 'utf8'), Buffer.from([0xc3]), Buffer.from('\n', 'utf8')]));

    const served200 = await app.request(fileAt(TICKET_ID, 'review/straddles.md'));
    expect(served200.status, 'a valid character straddling 4096 bytes was refused').toBe(200);
    expect((await served200.json() as WireTicketFile).text).toContain('é');
    const refused = await app.request(fileAt(TICKET_ID, 'review/truncated.md'));
    expect(refused.status, 'a truncated sequence past a 4096-byte prefix was served').toBe(422);
    expect((await refused.json() as WireRefusal).code).toBe('unsupported-file-encoding');
  });
});
