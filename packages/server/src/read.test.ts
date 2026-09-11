/**
 * Q-0119 — the read-only surface: project, tickets, flows and run history.
 *
 * Driven through `app.request` over a real project, like `http.test.ts`: real routing, real `core`
 * reads, no socket. Every route below is a GET, and the suite asserts that — a write reaching this
 * surface is the boundary this ticket exists to hold.
 */
import { afterAll, describe, expect, test } from 'vitest';

import { createRunHost } from './host.js';
import { createApp } from './http.js';
import { mountRead } from './read.js';
import { RUN_HISTORY_ROOT } from '@quorum/shared';
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
