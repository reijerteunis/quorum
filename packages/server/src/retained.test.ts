/**
 * Q-0137 AC-4, AC-5, AC-6, AC-7 and AC-13 — the two routes that answer for what a RUN retained.
 *
 * Driven through `app.request` over a real project, like `read.test.ts`: real routing, real `core`
 * reads, no socket. Every fixture is written by hand under the temporary project, because the three
 * conditions these routes exist to refuse occur nowhere in this repository's own run history — all
 * 940 `occurrence_dir` values on this machine are well-formed, nothing under a run directory is
 * anything but a regular file, and no retained file fails a UTF-8 decode.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  PROMPT_FILE, RUN_HISTORY_ROOT, wireRunHistoryListSchema, wireRunHistoryRetainedSchema,
  wireRunHistoryRetainedTextSchema, wireRunHistorySchema,
  type WireRefusal, type WireRunHistoryRetained, type WireRunHistoryRetainedText,
} from '@quorum/shared';
import { afterAll, describe, expect, test, vi } from 'vitest';

import { createRunHost } from './host.js';
import { createApp } from './http.js';
import { mountRead } from './read.js';
import { serve } from './serve.js';
import { fixture, removeTempDirs, TICKET_ID, write } from '../test/fixture.js';

afterAll(removeTempDirs);

/**
 * The workspace root, reached from this file rather than by climbing to a repository.
 *
 * `static.test.ts`'s idiom, and here for its reason: the Q-0138 block below reads `apps/web`'s
 * history screen as tracked source, because the value it compares that screen against is one only a
 * run in THIS package can produce.
 *
 * **The read is NOT declared in `packages/server/turbo.json`, and that is measured rather than
 * assumed.** `@quorum/core#test` declares `../../apps/**\/*.tsx` — verified in turbo's own `inputs`
 * report, where `apps/web/src/history-screen.tsx` appears under that task — and `@quorum/server`
 * depends on `@quorum/core`, so the root `test` task's `^test` edge puts that task's hash inside this
 * one. Declaring it here would be the same claim written twice, free to drift, which is exactly the
 * reasoning that file already gives for not re-declaring `docs/04-architecture.md`. What it declares
 * instead are the two reads NOTHING covers, `apps/web/src/routes.ts` and `apps/web/vite.config.ts`;
 * a `.tsx` under `apps/web/src` is not one of them.
 */
const WORKSPACE = path.resolve(import.meta.dirname, '..', '..', '..');

/** The run every fixture here builds, named as the store names it. */
const RUN = `${TICKET_ID}-1`;

/** A project, a host, and an app carrying both the run routes and the read-only ones. */
function served() {
  const project = fixture({});
  const host = createRunHost({ project: project.project, retain: 100 });
  return { project, host, app: mountRead(createApp({ host }), project.project) };
}

/** One occurrence as a manifest records it, with only the fields a case is about supplied. */
const occurrence = (over: { step_id: string; occurrence_dir: string; kind?: string; status?: string }) => ({
  kind: 'adapter', role: null, adapter: 'mock', model: null, branch: null, worktree: null,
  started_at: '2026-09-19T01:00:00.000Z', duration_ms: 1000, attempts: 1, status: 'completed',
  verdict: null, error: null, usage: null, ...over,
});

/** A manifest recording these occurrences, with every field the reader needs. */
const manifestOf = (steps: unknown[]): Record<string, unknown> => ({
  schema_version: 1, run_id: RUN, ticket_id: TICKET_ID, ticket_path: `backlog/${TICKET_ID}`,
  flow: 'chore', flow_file: 'chore.yaml', stage: { before: 'requirements', after: 'reviewed' },
  started_at: '2026-09-19T01:00:00.000Z', ended_at: '2026-09-19T01:05:00.000Z', duration_ms: 300_000,
  status: 'completed', steps, rollup: [],
});

/** The run directory this suite's fixtures live in. */
const runDir = (repoDir: string): string => path.join(repoDir, RUN_HISTORY_ROOT, RUN);

/** Write one run's manifest, and whatever its occurrence directories hold. */
function writeRun(repoDir: string, document: unknown, files: Record<string, Record<string, string>> = {}): void {
  const dir = runDir(repoDir);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'manifest.json'), typeof document === 'string' ? document : `${JSON.stringify(document, null, 2)}\n`);
  for (const [held, names] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, held), { recursive: true });
    for (const [name, text] of Object.entries(names)) write(path.join(dir, held, name), text);
  }
}

/** The retained-file listing path for one run. */
const retainedAt = (id: string): string => `/history/${encodeURIComponent(id)}/retained`;

/** The retained-file path for one occurrence of one run, with both query values encoded. */
const fileAt = (id: string, occurrenceValue: string, name: string): string =>
  `/history/${encodeURIComponent(id)}/file?occurrence=${encodeURIComponent(occurrenceValue)}&name=${encodeURIComponent(name)}`;

/** The refusal code a response carries, so a clause asserts the code and never only the status. */
const codeOf = async (response: Response): Promise<string> => (await response.json() as WireRefusal).code;

/**
 * Whether this process can enumerate `dir` — the premise the mode-0 fixture rests on.
 *
 * A capability of the environment rather than of the commit: a mode of 0 stops nothing when the
 * process is root, so the case that needs it probes and skips rather than asserting over an
 * unstaged subject. The shape `backlog.test.ts`'s mode-0 case already uses.
 */
function enumerable(dir: string): boolean {
  try {
    fs.readdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spellings of *the occurrence's directory* a client might send, which is the one value AC-6 keeps
 * out of a client's hands.
 *
 * A sample rather than a register the route consults: what refuses them is the declared
 * `['occurrence', 'name']`, so the clauses below add keys nobody has a spelling for and assert the
 * same answer — a list that had to be kept complete would be the defect this shape avoids.
 */
const FORBIDDEN_KEYS = ['occurrence_dir', 'occurrenceDir', 'dir', 'path'] as const;

/** A sound run: one adapter occurrence with both artifacts, one integrate occurrence with output. */
function soundRun() {
  const served_ = served();
  writeRun(
    served_.project.repoDir,
    manifestOf([
      occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
      occurrence({ step_id: 'integrate', occurrence_dir: 'steps/002-integrate', kind: 'integrate' }),
    ]),
    {
      'steps/001-implement': { 'prompt.txt': 'ask', 'output.txt': 'answered' },
      'steps/002-integrate': { 'output.txt': 'merged and green' },
    },
  );
  return served_;
}

describe('Q-0137 AC-4 — the listing answers one run, and one it can partly read is partly answered', () => {
  test('a sound run lists every occurrence, through the schema the response is declared against', async () => {
    const { app } = soundRun();
    const response = await app.request(retainedAt(RUN));
    expect(response.status).toBe(200);
    const parsed = wireRunHistoryRetainedSchema.safeParse(await response.json());
    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.warnings).toStrictEqual([]);
    expect(parsed.data.occurrences).toStrictEqual([
      { seq: 1, step_id: 'implement', files: [{ name: 'output.txt', bytes: 8 }, { name: 'prompt.txt', bytes: 3 }] },
      { seq: 2, step_id: 'integrate', files: [{ name: 'output.txt', bytes: 16 }] },
    ]);
  });

  test('a run whose third occurrence is refused answers 200 with the others, named by CONTENT', async () => {
    // **A single refused occurrence never takes the run's listing with it.** `failSoftly`'s
    // distinction one level in from where the store listing already applies it: a run a reader
    // could partly read is not an error, and answering 422 for the whole run would cost them the
    // other two. Asserted on what the warning NAMES rather than on how many there are — a length
    // is satisfied by a warning about the wrong occurrence.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'review', occurrence_dir: 'steps/002-review' }),
        occurrence({ step_id: 'refused', occurrence_dir: 'steps/003-escaped/../../../escape' }),
      ]),
      { 'steps/001-implement': { 'prompt.txt': 'ask' }, 'steps/002-review': { 'prompt.txt': 'judge' } },
    );
    const body = await (await app.request(retainedAt(RUN))).json() as WireRunHistoryRetained;
    expect(body.occurrences.map((entry) => entry.step_id), 'the readable occurrences were lost')
      .toStrictEqual(['implement', 'review']);
    expect(body.warnings.map((warning) => warning.step_id), 'the refused occurrence was not named')
      .toStrictEqual(['refused']);
    expect(JSON.stringify(body), 'the refused path was quoted back').not.toContain('escape');
  });

  test('a token naming no run is 404 and a manifest that will not parse is 422, never one code', async () => {
    // Answering 404 to both would report a run that IS there as absent — *"A probe that could not
    // answer is not a negative"* (2026-09-10) at this route, exactly as `GET /history/:id` has it.
    const { project, app } = soundRun();
    const missing = await app.request(retainedAt(`${TICKET_ID}-404`));
    expect(missing.status).toBe(404);
    expect(await codeOf(missing)).toBe('no-such-run');

    const damaged = served();
    writeRun(damaged.project.repoDir, '{ not json');
    const refused = await damaged.app.request(retainedAt(RUN));
    expect(refused.status).toBe(422);
    expect(await codeOf(refused)).toBe('malformed-manifest');
    // …and the same store still answers the detail route as it did, so the two are independent.
    expect((await app.request(`/history/${RUN}`)).status).toBe(200);
  });

  test('GET /history/:id answers exactly what it answered before, over a damaged store', async () => {
    // The other half of "a refused occurrence changes nothing else": the detail route reports the
    // manifest as it stands, traversing `occurrence_dir` included, and this ticket did not touch it.
    const { project, app } = served();
    writeRun(project.repoDir, manifestOf([occurrence({ step_id: 'refused', occurrence_dir: '../escape' })]));
    const detail = await app.request(`/history/${RUN}`);
    expect(detail.status).toBe(200);
    const body = await detail.json() as { steps: { occurrence_dir: string }[] };
    expect(body.steps[0].occurrence_dir, 'the detail route repaired or hid a traversing directory')
      .toBe('../escape');
  });

  test('both new routes are GETs, and neither accepts a POST', async () => {
    const { app } = soundRun();
    for (const route of [retainedAt(RUN), fileAt(RUN, '1', 'prompt.txt')]) {
      expect((await app.request(route)).status, `${route} does not answer a GET`).toBe(200);
      expect((await app.request(route, { method: 'POST' })).status, `${route} accepted a POST`).toBe(404);
      expect((await app.request(route, { method: 'DELETE' })).status, `${route} accepted a DELETE`).toBe(404);
    }
  });
});

describe('Q-0137 AC-5 — one file\'s bytes as text, and every refusal under its own code', () => {
  test('a retained file is served with the size of what was READ and its text', async () => {
    const { app } = soundRun();
    const response = await app.request(fileAt(RUN, '1', 'prompt.txt'));
    expect(response.status).toBe(200);
    const parsed = wireRunHistoryRetainedTextSchema.safeParse(await response.json());
    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toStrictEqual({ name: 'prompt.txt', bytes: 3, text: 'ask' });
  });

  test('an empty retained file succeeds, carrying bytes 0 rather than being refused', async () => {
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })]),
      { 'steps/001-implement': { 'output.txt': '' } },
    );
    const body = await (await app.request(fileAt(RUN, '1', 'output.txt'))).json() as WireRunHistoryRetainedText;
    expect(body).toStrictEqual({ name: 'output.txt', bytes: 0, text: '' });
  });

  test('every refusal answers its own status AND its own code', async () => {
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'refused', occurrence_dir: 'steps/002-escaped/../../../escape' }),
      ]),
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    const cases: [string, number, string][] = [
      [fileAt(`${TICKET_ID}-404`, '1', 'prompt.txt'), 404, 'no-such-run'],
      [fileAt(RUN, '', 'prompt.txt'), 400, 'not-a-file-name'],
      [fileAt(RUN, '1', ''), 400, 'not-a-file-name'],
      [fileAt(RUN, '9', 'prompt.txt'), 404, 'no-such-occurrence'],
      [fileAt(RUN, '2', 'prompt.txt'), 422, 'unsafe-occurrence-directory'],
      [fileAt(RUN, '1', 'nope.txt'), 400, 'not-an-occurrence-file'],
    ];
    // The tenth row — a directory the operating system refuses — is the clause below rather than an
    // entry here, and the reason is what a skip costs: it is the one row whose fixture needs a
    // capability this process may not have, and `ctx.skip` inside this loop would take the other
    // nine with it on a machine running as root.
    for (const [route, status, code] of cases) {
      const response = await app.request(route);
      expect(response.status, route).toBe(status);
      expect(await codeOf(response), route).toBe(code);
    }
    // A manifest that will not parse is its own refusal, on the same store shape.
    const damaged = served();
    writeRun(damaged.project.repoDir, '{ not json');
    const refused = await damaged.app.request(fileAt(RUN, '1', 'prompt.txt'));
    expect(refused.status).toBe(422);
    expect(await codeOf(refused)).toBe('malformed-manifest');
  });

  test('AC-5\'s tenth row: a directory this process cannot enumerate is 422 under its own code', async (ctx) => {
    // **Review round 3's major, ruled by `requirements/errata.md` E-5.** It was answered
    // `not-an-occurrence-file`, whose stated meaning is *the name was never this occurrence's* —
    // a negative nothing established, because no listing could be derived. Its own row now, at
    // `unsafe-occurrence-directory`'s status and shape: both say the store is in a state that
    // prevents an answer and neither blames the client.
    //
    // **Staged rather than mocked**, as E-5 asks. The premise is a capability of the environment
    // rather than of the commit, so it is probed and skipped where the probe fails — running as
    // root, where a mode of 0 stops nothing — on *"A test's verdict is a property of the commit,
    // not of the checkout or the account"* (2026-08-30). `core`'s hooked entry-level case covers
    // the same outcome with no capability, so the skip is a lost fixture rather than a hole.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'refused', occurrence_dir: 'steps/001-refused' }),
        occurrence({ step_id: 'gone', occurrence_dir: 'steps/002-gone' }),
      ]),
      { 'steps/001-refused': { 'prompt.txt': 'ask' } },
    );
    const refused = path.join(runDir(project.repoDir), 'steps/001-refused');
    fs.chmodSync(refused, 0o000);
    try {
      ctx.skip(enumerable(refused),
        'this process enumerates a directory whose mode is 0 — running as root, most likely — so a '
        + 'directory that can be named and not read cannot be staged here');

      const response = await app.request(fileAt(RUN, '1', 'prompt.txt'));
      expect(response.status, 'a directory nobody could enumerate was not 422').toBe(422);
      const body = await response.json() as WireRefusal;
      expect(body.code, 'the condition was answered under a code that asserts an absence')
        .toBe('unreadable-occurrence-directory');
      expect(body.condition, 'the refusal does not name the condition').toMatch(/could not be read/);
      expect(body.remedy, 'a reader is told to re-ask a run whose directory cannot be read').toBeNull();
      expect(JSON.stringify(body), 'the refusal quoted the repository path').not.toContain(project.repoDir);

      // Asserted APART rather than alone: the absence beside it keeps its own row, so this is a
      // distinction the two routes make and not a rename of one of them.
      const absent = await app.request(fileAt(RUN, '2', 'prompt.txt'));
      expect(absent.status, 'an absent directory stopped answering as an absence').toBe(400);
      expect(await codeOf(absent)).toBe('not-an-occurrence-file');

      // And the listing still answers 200 over both, which is what E-5 leaves untouched.
      const listed = await app.request(retainedAt(RUN));
      expect(listed.status, 'one refused occurrence took the run listing with it').toBe(200);
      const listing = await listed.json() as WireRunHistoryRetained;
      expect(listing.warnings.map((warning) => warning.step_id)).toStrictEqual(['refused', 'gone']);
    } finally {
      fs.chmodSync(refused, 0o755);
    }
  });

  test('the two routes answer ONE code for a condition they share', async () => {
    // **Found by this suite rather than reasoned about**, and it is the reason the status table
    // declares a `code` instead of taking the outcome's own name: `core` calls a token naming no run
    // `not-a-run`, this transport calls it `no-such-run`, and deriving one from the other made the
    // file route answer a code the listing route beside it — and `GET /history/:id` since Q-0119 —
    // never answers. A client switching on the code would have had to know which route it asked.
    const { app } = soundRun();
    for (const route of [retainedAt(`${TICKET_ID}-404`), fileAt(`${TICKET_ID}-404`, '1', 'prompt.txt'), `/history/${TICKET_ID}-404`]) {
      const response = await app.request(route);
      expect(response.status, route).toBe(404);
      expect(await codeOf(response), `${route} answers a code of its own for a shared condition`)
        .toBe('no-such-run');
    }
    // …and the manifest condition too, which is the other one all three share.
    const damaged = served();
    writeRun(damaged.project.repoDir, '{ not json');
    for (const route of [retainedAt(RUN), fileAt(RUN, '1', 'prompt.txt'), `/history/${RUN}`]) {
      expect(await codeOf(await damaged.app.request(route)), route).toBe('malformed-manifest');
    }
  });

  test('an occurrence value that is not a plain non-negative integer is refused before any read', async () => {
    // `Number` accepts a sign, a fractional part, an exponent, a hexadecimal prefix, whitespace and
    // the empty string, and every one of those would address an occurrence the client did not name.
    const { app } = soundRun();
    for (const value of ['+1', '-1', '1.0', '1e0', '0x1', ' 1', '1 ', 'one', '', 'Infinity', '99999999999999999999']) {
      const response = await app.request(fileAt(RUN, value, 'prompt.txt'));
      expect(response.status, JSON.stringify(value)).toBe(400);
      expect(await codeOf(response), JSON.stringify(value)).toBe('not-a-file-name');
    }
    // …and the plain form still answers, so the clause discriminates rather than refusing everything.
    expect((await app.request(fileAt(RUN, '1', 'prompt.txt'))).status).toBe(200);
  });

  test('a name that is a path rather than a leaf is refused before any directory is enumerated', async () => {
    const { app } = soundRun();
    for (const name of ['', '.', '..', 'a/b', '../prompt.txt', 'sub\\prompt.txt', '/etc/passwd']) {
      const response = await app.request(fileAt(RUN, '1', name));
      expect(response.status, JSON.stringify(name)).toBe(400);
      expect(await codeOf(response), JSON.stringify(name)).toBe('not-a-file-name');
    }
  });

  test('not-an-occurrence-file and no-such-file are never collapsed, and the second is STAGED', async () => {
    // The first says the name was never this occurrence's; the second that it was named by this
    // request's own listing and has stopped being a regular file since. Staged rather than reasoned
    // about (Q-0127's round-4 precedent): the file is removed between the listing that named it and
    // the read, which is a race this store runs in ordinary operation rather than only in a fixture.
    const { project, app } = soundRun();
    const listed = await (await app.request(retainedAt(RUN))).json() as WireRunHistoryRetained;
    expect(listed.occurrences[0].files.map((file) => file.name), 'the listing did not name the file')
      .toContain('prompt.txt');

    expect(await codeOf(await app.request(fileAt(RUN, '1', 'never.txt')))).toBe('not-an-occurrence-file');

    fs.rmSync(path.join(runDir(project.repoDir), 'steps/001-implement', 'prompt.txt'));
    const gone = await app.request(fileAt(RUN, '1', 'prompt.txt'));
    // It is refused as *not this occurrence's* rather than throwing, because membership is derived
    // for THIS request — the listing a client fetched a moment ago grants nothing.
    expect(gone.status, 'a file that vanished after being listed threw or was served').toBe(400);
    expect(await codeOf(gone)).toBe('not-an-occurrence-file');
  });

  test('a remedy is offered only where there is something a reader can do', async () => {
    // *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) read
    // the way round it is usually needed: a surface with nothing useful to say says nothing.
    // Telling a reader to ask this run for its retained files is advice where the name or the
    // number was wrong, and nonsense where the run is not there at all.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'refused', occurrence_dir: 'steps/002-refused/../../../escape' }),
      ]),
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    const remedyOf = async (route: string): Promise<string | null> =>
      (await (await app.request(route)).json() as WireRefusal).remedy;
    // The sentence itself is `read.ts`'s and is not spelled again here — a second copy would be a
    // second place to be wrong about it. What is asserted is that the four rows offering one all
    // offer the SAME one, and that it names the listing a reader would go to.
    const offered = await Promise.all(
      [fileAt(RUN, '1', 'nope.txt'), fileAt(RUN, '9', 'prompt.txt'), fileAt(RUN, 'x', 'prompt.txt')].map(remedyOf),
    );
    expect(new Set(offered).size, 'the rows that offer a remedy offer different ones').toBe(1);
    expect(offered[0], 'no remedy is offered where one exists').toMatch(/retained/);
    for (const route of [fileAt(`${TICKET_ID}-404`, '1', 'prompt.txt'), fileAt(RUN, '2', 'prompt.txt')]) {
      expect(await remedyOf(route), `${route} tells a reader to ask a run that cannot answer`).toBeNull();
    }
  });

  test('no refusal exposes an absolute path on the daemon\'s machine', async () => {
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([occurrence({ step_id: 'refused', occurrence_dir: '../../../escape' })]),
    );
    for (const route of [retainedAt(RUN), fileAt(RUN, String(Number.MAX_SAFE_INTEGER), 'prompt.txt')]) {
      const text = await (await app.request(route)).text();
      expect(text, `${route} quoted the repository path`).not.toContain(project.repoDir);
      expect(text, `${route} quoted the refused value`).not.toContain('escape');
    }
  });
});

describe('Q-0137 AC-6 — seq is the identity, and occurrence_dir is never an input', () => {
  test('a sequence number two occurrences share is 409 and neither is served', async () => {
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'first', occurrence_dir: 'steps/unreadable-a' }),
        occurrence({ step_id: 'second', occurrence_dir: 'steps/unreadable-b' }),
      ]),
      { 'steps/unreadable-a': { 'prompt.txt': 'ONE' }, 'steps/unreadable-b': { 'prompt.txt': 'TWO' } },
    );
    const listing = await (await app.request(retainedAt(RUN))).json() as WireRunHistoryRetained;
    expect(listing.occurrences, 'a colliding sequence number was offered as addressable').toStrictEqual([]);
    expect(listing.warnings.map((warning) => warning.step_id).sort(), 'both occurrences were not named')
      .toStrictEqual(['first', 'second']);

    const response = await app.request(fileAt(RUN, String(Number.MAX_SAFE_INTEGER), 'prompt.txt'));
    expect(response.status).toBe(409);
    // One read of the body, because a `Response` can only be consumed once.
    const refusal = await response.json() as WireRefusal;
    expect(refusal.code).toBe('ambiguous-occurrence');
    const text = JSON.stringify(refusal);
    for (const served_ of ['ONE', 'TWO']) expect(text, `${served_} was served anyway`).not.toContain(served_);
  });

  test('a directory key IN PLACE OF the sequence number is refused, and nothing is served', async () => {
    // `occurrence_dir` crosses to a browser today only because `GET /history/:id` spreads the whole
    // manifest occurrence through a loose schema — it is absent even from that schema's own
    // enumeration of what crosses — so accepting it back would ratify an accident as a contract.
    //
    // **This clause refuses a request that names no occurrence**, and review round 1 was right that
    // it cannot tell WHY on its own: it would pass over a route that ignored the key entirely. The
    // clause below is the one that discriminates, and this one stays because a client substituting
    // the directory for the sequence number is the substitution itself.
    const { app } = soundRun();
    for (const key of FORBIDDEN_KEYS) {
      const route = `/history/${RUN}/file?${key}=${encodeURIComponent('steps/001-implement')}&name=prompt.txt`;
      const response = await app.request(route);
      expect(response.status, `${key} was accepted as an occurrence`).toBe(400);
      expect(await codeOf(response), key).toBe('unknown-field');
    }
  });

  test('a directory key BESIDE both valid values is refused, rather than ignored while the rest is served', async () => {
    // Review round 1's second major. The request is otherwise complete and is served 200 on the
    // line above, so what refuses it below is the KEY and not a missing value — which is the
    // discrimination the substitution clause cannot make. A selector nobody honours reads as one
    // that was: without this, `occurrence=1&occurrence_dir=steps/002-integrate` answered occurrence
    // 1's file and told the client nothing about the half of its request that was dropped.
    const { app } = soundRun();
    const sound = `/history/${RUN}/file?occurrence=1&name=prompt.txt`;
    expect((await app.request(sound)).status, 'the fixture does not serve, so this clause has no subject')
      .toBe(200);
    for (const key of [...FORBIDDEN_KEYS, 'Occurrence', 'Name', 'anything-nobody-thought-of']) {
      const response = await app.request(`${sound}&${key}=${encodeURIComponent('steps/002-integrate')}`);
      expect(response.status, `${key} was ignored rather than refused`).toBe(400);
      expect(await codeOf(response), key).toBe('unknown-field');
      const refusal = await (await app.request(`${sound}&${key}=x`)).json() as WireRefusal;
      expect(refusal.condition, `${key} is not named in the refusal`).toContain(key);
      expect(refusal.condition, 'the refusal quotes what the key selected').not.toContain('steps/');
      expect(refusal.remedy, 'the refusal does not name what this route does accept')
        .toBe('remove it; this route accepts occurrence, name');
    }
  });

  test('the listing refuses a key it does not accept, rather than answering 200 over it', async () => {
    // **Review round 2's major.** This route was left answering 200 on the reasoning that its
    // answer is a function of the run token alone, so a key nobody reads misleads nobody. AC-6 says
    // both routes reject the directory under every spelling, and *ignored* is not *rejected*: a
    // client that sent one and was answered 200 has been told its request was understood.
    //
    // Its accepted set is EMPTY rather than absent, so what refuses these four is the same
    // mechanism that refuses them next door — one condition, one code, on both routes.
    const { app } = soundRun();
    const plain = await app.request(retainedAt(RUN));
    expect(plain.status, 'the plain listing does not answer, so this clause has no subject').toBe(200);
    expect((await plain.json() as WireRunHistoryRetained).occurrences.length,
      'the fixture lists nothing, so this clause has no subject').toBeGreaterThan(0);

    for (const key of [...FORBIDDEN_KEYS, 'occurrence', 'name', 'anything-nobody-thought-of']) {
      const response = await app.request(`${retainedAt(RUN)}?${key}=${encodeURIComponent('steps/002-integrate')}`);
      expect(response.status, `${key} was ignored rather than refused`).toBe(400);
      const refusal = await response.json() as WireRefusal;
      expect(refusal.code, key).toBe('unknown-field');
      expect(refusal.condition, `${key} is not named in the refusal`).toContain(key);
      expect(refusal.condition, 'the refusal quotes what the key selected').not.toContain('steps/');
      expect(refusal.remedy, 'the refusal does not say this route accepts none')
        .toBe('remove it; this route accepts no query value');
    }
    // `occurrence` and `name` are in that loop on purpose: they are the file route's and this route
    // accepts neither, so a shared constant would have made this listing answer over a selection it
    // cannot honour.
  });

  test('the handler reads no query key naming the occurrence directory, under any spelling', async () => {
    // The structural half, beside the behavioural one: the two keys this route looks up by name are
    // its own, and the directory is not one of them under any spelling.
    const source = fs.readFileSync(path.join(import.meta.dirname, 'read.ts'), 'utf8');
    const queried = [...source.matchAll(/c\.req\.query\('([^']+)'\)/g)].map((match) => match[1]);
    expect([...new Set(queried)].sort(), 'this route reads a query key nobody registered')
      .toStrictEqual(['name', 'occurrence', 'path']);
    // `path` is `GET /tickets/:id/file`'s, which is a different route with a different subject —
    // named here so the identity above is not read as permitting one on this route, and excluded
    // from the loop below for that reason rather than overlooked. What keeps it off THIS route is
    // the identity above plus the behavioural clauses, which refuse it with both values valid.
    for (const key of FORBIDDEN_KEYS.filter((spelling) => spelling !== 'path')) {
      expect(source.includes(`c.req.query('${key}')`), `a handler reads ${key} from a client`).toBe(false);
    }
    // The argument-less `c.req.query()` the key check performs reads every key a request carries
    // and is what REFUSES them, so the identity above bounds what this route looks up by name
    // rather than what it inspects — stated here because the two are not the same claim.
    //
    // **Two call sites and not one**, which is review round 2's major made structural: the listing
    // route performs the same check against its own accepted set, so a fix that reached only the
    // route that selects fails here as well as behaviourally.
    expect((source.match(/unexpectedQuery\(c\.req\.query\(\), RETAINED_[A-Z_]+_QUERY\)/g) ?? []).length,
      'a retained route does not check the keys it was given').toBe(2);
  });
});

describe('Q-0137 AC-7 — bytes that are not well-formed UTF-8 are refused under their own code', () => {
  test('a lone continuation byte is 422, and U+FFFD written as valid UTF-8 is SERVED', async () => {
    // **Not a test for the replacement character.** Sixteen of the 1,797 files this repository's
    // run history retains carry one legitimately, and zero fail the decode — so the naive clause
    // would report sixteen real prompts as binary on the day it shipped, and this corpus can teach
    // the criterion nothing. Both fixtures are constructed.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })]),
      { 'steps/001-implement': { 'valid.txt': 'a replacement character, �, written by hand\n' } },
    );
    fs.writeFileSync(path.join(runDir(project.repoDir), 'steps/001-implement', 'binary.txt'), Buffer.from([0x80]));

    const refused = await app.request(fileAt(RUN, '1', 'binary.txt'));
    expect(refused.status).toBe(422);
    expect(await codeOf(refused)).toBe('unsupported-file-encoding');

    const served200 = await app.request(fileAt(RUN, '1', 'valid.txt'));
    expect(served200.status, 'a file holding U+FFFD legitimately was refused as binary').toBe(200);
    expect((await served200.json() as WireRunHistoryRetainedText).text).toContain('�');
  });

  test('a multi-byte character across a chunk boundary is served, and a truncated one is refused', async () => {
    // The decode is whole-file and fatal, so neither case depends on a buffer size — the property a
    // prefix decode fails in both directions.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })]),
      { 'steps/001-implement': { 'placeholder.txt': 'x' } },
    );
    const pad = Buffer.from('a'.repeat(4095), 'utf8');
    const dir = path.join(runDir(project.repoDir), 'steps/001-implement');
    fs.writeFileSync(path.join(dir, 'straddles.txt'), Buffer.concat([pad, Buffer.from('é', 'utf8')]));
    fs.writeFileSync(path.join(dir, 'truncated.txt'), Buffer.concat([pad, Buffer.from([0xc3])]));

    const served200 = await app.request(fileAt(RUN, '1', 'straddles.txt'));
    expect(served200.status, 'a valid character straddling 4096 bytes was refused').toBe(200);
    expect((await served200.json() as WireRunHistoryRetainedText).text).toContain('é');
    const refused = await app.request(fileAt(RUN, '1', 'truncated.txt'));
    expect(refused.status, 'a truncated sequence past a 4096-byte prefix was served').toBe(422);
    expect(await codeOf(refused)).toBe('unsupported-file-encoding');
  });
});

describe('Q-0137 AC-13 — an unknown retained name opens, and nothing anywhere is written', () => {
  test('a third retained name is listed and served with no code change of any kind', async () => {
    // The positive half of *list the directory*: `persist` takes an artifact's name as a plain
    // `string` parameter, so a register of the two constants this product writes would claim what
    // the writer's callers write rather than what a directory holds.
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })]),
      { 'steps/001-implement': { 'transcript.jsonl': '{"a":1}\n' } },
    );
    const listing = await (await app.request(retainedAt(RUN))).json() as WireRunHistoryRetained;
    expect(listing.occurrences[0].files).toStrictEqual([{ name: 'transcript.jsonl', bytes: 8 }]);
    const body = await (await app.request(fileAt(RUN, '1', 'transcript.jsonl'))).json() as WireRunHistoryRetainedText;
    expect(body.text).toBe('{"a":1}\n');
  });

  test('the whole run store is byte-identical after every answer these two routes give', async () => {
    const { project, app } = served();
    writeRun(
      project.repoDir,
      manifestOf([
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'refused', occurrence_dir: 'steps/002-escaped/../../../escape' }),
        occurrence({ step_id: 'gone', occurrence_dir: 'steps/003-gone' }),
      ]),
      { 'steps/001-implement': { 'prompt.txt': 'ask', 'notes.md': 'a third name' } },
    );
    const store = path.join(project.repoDir, RUN_HISTORY_ROOT);
    const snapshot = (): [string, string][] => fs.readdirSync(store, { recursive: true, encoding: 'utf8' })
      .filter((entry) => fs.statSync(path.join(store, entry)).isFile())
      .sort()
      .map((entry) => [entry, fs.readFileSync(path.join(store, entry)).toString('base64')] as [string, string]);
    const before = snapshot();
    expect(before.length, 'the fixture is empty, so this clause has no subject').toBeGreaterThan(2);

    const routes = [
      retainedAt(RUN), retainedAt(`${TICKET_ID}-404`),
      fileAt(RUN, '1', 'prompt.txt'), fileAt(RUN, '1', 'notes.md'), fileAt(RUN, '1', 'nope.txt'),
      fileAt(RUN, '2', 'prompt.txt'), fileAt(RUN, '3', 'prompt.txt'), fileAt(RUN, '9', 'prompt.txt'),
      fileAt(RUN, 'not-a-number', 'prompt.txt'), fileAt(RUN, '1', '../escape'),
    ];
    for (const route of routes) await app.request(route);

    expect(snapshot(), 'answering a retained-file request changed something under .quorum/runs')
      .toStrictEqual(before);
  });
});

/**
 * Q-0138 AC-8, AC-9 and AC-10's producer half — the three read routes over a step that has not
 * finished, in a run this daemon really started.
 *
 * **Driven through the product's own producer, not a manifest written here**, which is what run 2
 * iteration 1 got wrong: a hand-built document is a *claim* about what `RunHistory.allocate` leaves,
 * and establishing that claim is what AC-9 asks for — so a fixture stays green if the writer stops
 * producing a server-readable manifest or drifts from the shape invented beside it.
 * `initialiseRunHistory` is deliberately absent from `@quorum/core`'s barrel, so this package cannot
 * call the writer directly and must not: a surface presenting run history may not create a run
 * directory. It does not have to. `host.start` is the one production caller of `runFlow`, and the
 * chain a start drives is `steps.ts` → `allocateOccurrence` → `allocate` → `manifest.json` on disk →
 * these routes. That is a **longer** join than AC-7's arrangement and the one the daemon performs.
 *
 * **The barrier is a timer that cannot fire, and the release is explicit.** The mock adapter's only
 * pause is `setTimeout(cfg.delayMs)`, so a real delay would make the state a window and every
 * assertion a race against it — which AC-9 forbids in as many words. Under `vi.useFakeTimers` that
 * timer never fires: the run allocates the occurrence, persists the prompt it is about to send, and
 * stops inside `adapter.run` until {@link whileHeld} advances the clock. Nothing below waits for a
 * duration, and **nothing terminates to make the occurrence visible** — the flow has ONE step, so
 * there is no sibling that could, which is stronger than a second occurrence that merely did not.
 *
 * **Over a socket rather than through `app.request`**, unlike every case above: these are the three
 * routes a browser actually issues for a run in flight, and the listing is one of them.
 */
describe('Q-0138 AC-8/AC-9/AC-10 — a real run, held mid-step, is counted, listed and readable', () => {
  /**
   * What the mock adapter is told its call takes.
   *
   * Never waited for, and large deliberately: the timer it creates is a faked one, so this is the
   * amount of fake clock {@link whileHeld} advances to release the run rather than a duration
   * anything sleeps for. Large enough that a real timer of this length would be an obvious defect,
   * which is the point — if the fake clock is ever not installed, the test hangs its own budget out
   * rather than quietly racing.
   */
  const HELD_MS = 600_000;

  /** A project whose adapter is the mock and whose mock pauses until a clock is advanced. */
  const HELD_CONFIG = `adapterOverride: mock
adapters:
  mock:
    delayMs: ${String(HELD_MS)}
repo:
  base_branch: main
`;

  /** `apps/web`'s history screen, read as tracked source. Why it may be, and what hashes it: {@link WORKSPACE}. */
  const SCREEN = 'apps/web/src/history-screen.tsx';

  /** One occurrence of the manifest, narrowed to the four fields these clauses read. */
  interface WrittenOccurrence {
    readonly step_id: string;
    readonly status: string;
    readonly duration_ms: number | null;
    readonly occurrence_dir: string;
  }

  /** What one held run offers a case: the daemon's socket, and the document the writer left. */
  interface Held {
    /** One GET against the listening daemon. */
    get(route: string): Promise<Response>;
    /** The manifest `RunHistory` has written, read off disk rather than from any cache. */
    manifest(): { readonly steps: readonly WrittenOccurrence[] };
  }

  /** `apps/web`'s history screen as text, read once per call so a case cannot cache a stale copy. */
  const SCREEN_SOURCE = (): string => fs.readFileSync(path.join(WORKSPACE, SCREEN), 'utf8');

  /**
   * Start one real run, hold it between allocation and completion, and run `body` against it.
   *
   * A callback rather than a returned handle so the clock and the socket are restored on every exit:
   * a failed assertion inside `body` must not leave fake timers installed for the rest of the file.
   */
  async function whileHeld(body: (held: Held) => Promise<void>): Promise<void> {
    const project = fixture({ config: HELD_CONFIG });
    const host = createRunHost({ project: project.project, retain: 100 });
    const server = await serve({ host });
    // Installed before the run starts, so the timer the mock creates is the faked one. `toFake` is
    // the two timer functions and nothing else: the clock the writer stamps `started_at` from stays
    // real, because a manifest is what these routes answer from.
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
    try {
      const outcome = await host.start({ flow: 'probe', ticket: TICKET_ID });
      if (!outcome.started) throw new Error(`the run did not start: ${outcome.refusal.condition}`);
      const subscription = host.subscribe(outcome.run.handle);
      if (!subscription) throw new Error('the started run has no subscription');
      try {
        // `runAgentStep` emits its `step` event AFTER allocating the occurrence and persisting the
        // prompt and BEFORE awaiting the adapter, so receiving that event IS the proof that the
        // barrier has been reached. Awaited on the event stream rather than polled, so nothing here
        // needs a timer either — which matters, because the only one available is faked.
        let reached = false;
        for await (const event of subscription.events) {
          if (event.type === 'step') { reached = true; break; }
        }
        if (!reached) throw new Error('the run ended without reaching a step, so nothing was held');
        await body({
          get: async (route) => fetch(`http://127.0.0.1:${String(server.port)}${route}`),
          manifest: () => JSON.parse(
            fs.readFileSync(path.join(runDir(project.repoDir), 'manifest.json'), 'utf8'),
          ) as { readonly steps: readonly WrittenOccurrence[] },
        });
      } finally {
        subscription.close();
      }
    } finally {
      // Advanced on EVERY exit, a failed assertion included: the promise the run is suspended on is
      // waiting for a FAKE timer, so restoring the real clock without firing it would leave that
      // promise pending for ever and `shutdown()` — which waits for the run to finish persisting —
      // would never resolve. A failing assertion would then present as a hung file.
      await vi.advanceTimersByTimeAsync(HELD_MS);
      vi.useRealTimers();
      await host.shutdown();
      await server.close();
    }
  }

  test('the writer names it, the listing counts it, the detail says running, and its prompt is readable', async () => {
    await whileHeld(async ({ get, manifest }) => {
      // The document the REAL writer left, read off disk: the state AC-1 pins in `packages/core`,
      // here as the premise every clause below answers about. Without the allocate-time replacement
      // this array is empty and every clause in this case fails.
      const steps = manifest().steps;
      expect(steps.map((step) => [step.step_id, step.status, step.duration_ms]),
        'the manifest does not name the step this run is inside').toStrictEqual([['work', 'running', null]]);
      expect(steps[0].occurrence_dir).toBe('steps/001-work');

      // AC-8 — one allocated unfinished step is one occurrence, and the row says so.
      const list = wireRunHistoryListSchema.parse(await (await get('/history')).json());
      const row = list.runs.find((entry) => entry.id === RUN);
      expect(row?.occurrenceCount, 'a run whose only step is still going was counted as empty').toBe(1);
      expect(row?.incomplete, 'a run with no end was reported as finished').toBe(true);

      // AC-9 — the detail carries the occurrence with the status the writer recorded.
      const detailResponse = await get(`/history/${encodeURIComponent(RUN)}`);
      expect(detailResponse.status).toBe(200);
      const detail = wireRunHistorySchema.parse(await detailResponse.json());
      expect(detail.steps.map((step) => [step.seq, step.step_id, step.status, step.duration_ms]))
        .toStrictEqual([[1, 'work', 'running', null]]);

      // …and the retained listing answers for the same occurrence, under the same seq and step id.
      const retainedResponse = await get(retainedAt(RUN));
      expect(retainedResponse.status).toBe(200);
      const retained = wireRunHistoryRetainedSchema.parse(await retainedResponse.json());
      expect(retained.warnings, 'a running occurrence was named as one the listing could not read')
        .toStrictEqual([]);
      expect(retained.occurrences.map((entry) => [entry.seq, entry.step_id, entry.files.map((file) => file.name)]),
        'the listing does not name this run\'s prompt, or names an output it cannot have yet')
        .toStrictEqual([[1, 'work', [PROMPT_FILE]]]);

      // The byte count is the prompt this run built rather than a number written here, so the file
      // served and the file measured are one file.
      const bytes = retained.occurrences[0].files[0].bytes;
      const file = await get(fileAt(RUN, '1', PROMPT_FILE));
      expect(file.status).toBe(200);
      const served = wireRunHistoryRetainedTextSchema.parse(await file.json());
      expect(Buffer.byteLength(served.text), 'the text served is not the file the listing measured').toBe(bytes);
      expect(served.text, 'what was served is not the prompt this run composed').toContain(`# Ticket ${TICKET_ID}`);
    });
  });

  test('AC-10 — the status a real allocation produces is the one the screen branches on', async () => {
    await whileHeld(async ({ get }) => {
      const detail = wireRunHistorySchema.parse(
        await (await get(`/history/${encodeURIComponent(RUN)}`)).json(),
      );
      const produced = detail.steps[0]?.status;
      expect(produced, 'this run produced no occurrence to read a status from').toBe('running');

      // The join AC-10 asks for, with the half that has to be EXECUTED rather than read: the value
      // above came off the wire from a real allocation, and the screen's no-output branch is required
      // to name it. It is compared here rather than in `apps/web` because that package depends on
      // `@quorum/shared` alone and may reach neither the engine nor this one — giving the browser app
      // a dependency on the daemon to make a test convenient is an architecture change, not a test.
      // Reading `apps/web`'s tracked source from this package is `static.test.ts`'s arrangement for
      // the same reason — derive the register, never transcribe it — and what hashes the read is
      // measured rather than declared twice; see {@link WORKSPACE}.
      expect(SCREEN_SOURCE(), `${SCREEN} does not branch on the status a real allocation produces`)
        .toContain(`step.status === '${String(produced)}'`);
      // …and the comparison has a subject: a screen that branched on something else fails above
      // rather than passing over a needle that matches nothing.
      expect(SCREEN_SOURCE().includes("step.status === 'in-progress'"),
        'the needle matches a status no allocation produces').toBe(false);
    });
  });

  test('and an empty `steps` array still counts zero, so the clauses above are not satisfied by any manifest', async () => {
    // Hand-built deliberately, and the one case here that must be: a manifest recording no
    // occurrence at all is what a run leaves in its first instants, and no run this test can drive
    // stands still there long enough to be read.
    const project = fixture({});
    writeRun(project.repoDir, { ...manifestOf([]), ended_at: null, duration_ms: null, status: 'running' });
    const host = createRunHost({ project: project.project, retain: 10 });
    const server = await serve({ host });
    const get = async (route: string): Promise<Response> =>
      fetch(`http://127.0.0.1:${String(server.port)}${route}`);
    try {
      const list = wireRunHistoryListSchema.parse(await (await get('/history')).json());
      expect(list.runs.find((entry) => entry.id === RUN)?.occurrenceCount).toBe(0);
      const retained = wireRunHistoryRetainedSchema.parse(await (await get(retainedAt(RUN))).json());
      expect(retained.occurrences).toStrictEqual([]);
    } finally {
      await host.shutdown();
      await server.close();
    }
  });
});
