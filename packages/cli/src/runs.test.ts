/**
 * Q-0092 AC-5 to AC-12 for `quorum runs`.
 *
 * **The translated binary half of four spike files**, which is the shape of a command child rather
 * than of a file port: `q0011-runs-cli.js:29–81` (all five `runs` scenarios),
 * `q0034-review-fixes.js` B2 (`:95–119`, the roll-up/per-step split) and B4 (`:141–155`, the five
 * confinement tokens), `q0011-run-history.js:121–124` (a billed failure's usage surviving into a
 * reader that holds no run state), and `q0080-allocation.js:206–207` (a ticket filter with zero
 * matches exits 0). `spike-parity.test.ts` records the transfer on each of those rows.
 *
 * **One of those four is carried across two files, and the split is deliberate.**
 * `q0011-run-history.js:121–124` claims two things — that the failed occurrence's usage is rendered,
 * and that a *separate process* is what renders it. The first is here; the second is a spawn of the
 * built binary and lives in `build.test.ts`, the file Q-0098 AC-15(c) rules may spawn
 * `packages/cli/dist`, because that file removes the emit twice and Vitest parallelises across
 * files.
 *
 * **B2's two halves are two blocks here, because they are two views.** Q-0037 re-aimed the
 * `tokens=1100` double-count guard at the **list**, where `vendorTokenTotal` runs — it had been
 * asserted on the detail view, which renders no roll-up at all, so it was matching the per-step
 * usage line. The per-step assertions are their own block over the detail view. Reading them as one
 * criterion restores exactly the defect that ticket repaired.
 *
 * Every fixture builds its own project under `os.tmpdir()` and reads nothing in this repository.
 * Nothing here spawns the binary — the mock end-to-end suite through the binary is Q-0095's, and the
 * one spawn Q-0092 owes is in `build.test.ts` for the reason above — so the exit codes are claimed
 * through {@link invoke}, which reports what a shell would have seen.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Occurrence, OccurrenceUsage, RunManifest, VendorRollup } from '@quorum/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { invoke, plain } from '../test/invoke.js';

let dir = '';
let cwd = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-runs-'));
  fs.mkdirSync(path.join(dir, 'harness'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness', 'harness.yaml'), 'backlog: {path: backlog}\n', 'utf8');
  cwd = process.cwd();
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** The runs root of the fixture the current test is standing in. */
const runsRoot = (): string => path.join(dir, '.quorum', 'runs');

/** Write `document` as `<runsRoot>/<runId>/manifest.json`, whatever shape it is. */
function put(runId: string, document: unknown): void {
  const into = path.join(runsRoot(), runId);
  fs.mkdirSync(into, { recursive: true });
  fs.writeFileSync(
    path.join(into, 'manifest.json'),
    typeof document === 'string' ? document : JSON.stringify(document, null, 2),
    'utf8',
  );
}

/** One occurrence's usage, as `q0011-runs-cli.js:19` builds one. */
const usage = (vendor: string, cost: number | null): OccurrenceUsage => ({
  vendor, input_tokens: 100, output_tokens: 20,
  cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: cost,
});

/** One occurrence, as `q0011-runs-cli.js:20` builds one. */
const step = (n: number, vendor = 'claude', cost: number | null = 1): Occurrence => ({
  step_id: `step:${String(n)}`,
  occurrence_dir: `steps/${String(n).padStart(3, '0')}-step-${String(n)}`,
  kind: 'adapter', role: 'qa', adapter: 'mock', model: null, branch: null, worktree: null,
  started_at: '2026-08-23T10:00:00.000Z', duration_ms: 5, attempts: 1, status: 'completed',
  verdict: null, error: null, usage: usage(vendor, cost),
});

/** A roll-up row with every measure explicit. */
const row = (fields: Partial<VendorRollup> & { vendor: string }): VendorRollup => ({
  step_count: 1, unpriced_steps: 0, input_tokens: null, output_tokens: null,
  cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null, ...fields,
});

/** A complete manifest, as `q0011-runs-cli.js:21–24` builds one: two steps, two vendors. */
const manifest = (runId: string, ticketId: string, started = '2026-08-23T10:00:00.000Z'): RunManifest => ({
  schema_version: 1,
  run_id: runId,
  ticket_id: ticketId,
  ticket_path: `backlog/${ticketId}-x/ticket.md`,
  flow: 'development',
  flow_file: 'harness/flows/development.yaml',
  stage: { before: 'red', after: 'green' },
  started_at: started,
  ended_at: '2026-08-23T10:00:01.000Z',
  duration_ms: 1000,
  status: 'completed',
  steps: [step(2, 'codex', null), step(1)],
  rollup: [
    row({ vendor: 'claude', unpriced_steps: 0, input_tokens: 100, output_tokens: 20, cost_usd: 1 }),
    row({ vendor: 'codex', unpriced_steps: 1, input_tokens: 100, output_tokens: 20, cost_usd: null }),
  ],
});

/** The three-run, one-damaged-sibling store `q0011-runs-cli.js:30–31` builds. */
function corruptStore(): void {
  put('Q-0011-2', manifest('Q-0011-2', 'Q-0011'));
  put('Q-0011-10', manifest('Q-0011-10', 'Q-0011'));
  put('Q-0012-1', manifest('Q-0012-1', 'Q-0012', '2026-08-23T11:00:00.000Z'));
  put('bad', '{broken');
}

describe('AC-5 — selection, ordering and the empty state follow the frozen contract', () => {
  test('every run is listed, in started_at descending then run_id ascending as a plain string', async () => {
    corruptStore();
    const { stdout, exitCode } = await invoke(['runs']);
    const text = plain(stdout);
    for (const id of ['Q-0011-2', 'Q-0011-10', 'Q-0012-1']) expect(text, id).toContain(id);
    // `Q-0011-10` before `Q-0011-2` at equal timestamps: a plain string sort, deliberately, and
    // `sortRuns` is what decides it — the CLI does not re-sort.
    expect(text.indexOf('Q-0012-1')).toBeLessThan(text.indexOf('Q-0011-10'));
    expect(text.indexOf('Q-0011-10')).toBeLessThan(text.indexOf('Q-0011-2'));
    expect(exitCode, 'a damaged sibling forces a non-zero exit').toBe(ERROR);
    expect(text, 'the damaged sibling is named').toContain('bad');
  });

  test('a ticket id filters the listing to that ticket alone, and backlog/ is never consulted', async () => {
    corruptStore();
    // No backlog directory exists in this fixture at all, which is what makes "never consulted"
    // structural here rather than asserted: a command that read one would fail rather than filter.
    expect(fs.existsSync(path.join(dir, 'backlog'))).toBe(false);
    const { stdout } = await invoke(['runs', 'Q-0011']);
    expect(plain(stdout)).not.toContain('Q-0012-1');
    expect(plain(stdout)).toContain('Q-0011-10');
  });

  test('zero matches over a clean store exits 0, and over a corrupt one does not — E-4 both ways', async () => {
    // Erratum E-4 (`backlog/Q-0011-…/solution/errata.md`, 2026-08-24) split rather than deleted:
    // the contract states both "zero matches … exit zero" and "a malformed sibling is named … and
    // the final exit is non-zero", and the corrupt store satisfies both. Store health wins.
    put('Q-0011-1', manifest('Q-0011-1', 'Q-0011'));
    expect((await invoke(['runs', 'Q-9999'])).exitCode, 'zero matches on a clean store').toBe(SUCCESS);
    put('bad', '{broken');
    expect((await invoke(['runs', 'Q-9999'])).exitCode, 'zero matches beside a named malformed sibling').toBe(ERROR);
  });

  test('a ticket that has never run and one that does not exist are the same answer', async () => {
    // `q0080-allocation.js:206–207`: `runs <ticket>` over a store with no run for it exits 0. The
    // command answers from `.quorum/runs/` alone, so "never ran" and "not a ticket here" are one
    // outcome and neither is an error.
    put('Q-0006-1', manifest('Q-0006-1', 'Q-0006'));
    const { exitCode, stdout } = await invoke(['runs', 'Q-0006']);
    expect(exitCode).toBe(SUCCESS);
    expect(plain(stdout)).toContain('Q-0006-1');
    expect((await invoke(['runs', 'Q-4242'])).exitCode).toBe(SUCCESS);
  });

  test('the ticket-id grammar is anchored and case-sensitive, so q-0011 and Q-11 are refused', async () => {
    corruptStore();
    for (const token of ['q-0011', 'Q-11']) {
      const { exitCode, stderr } = await invoke(['runs', token]);
      expect(exitCode, token).toBe(ERROR);
      expect(plain(stderr), token).toContain(`unknown run or ticket: ${token}`);
    }
  });

  test('a missing runs root prints the empty state and exits 0', async () => {
    expect(fs.existsSync(runsRoot()), 'the fixture already has a runs root').toBe(false);
    const { stdout, exitCode, hard } = await invoke(['runs']);
    expect(exitCode).toBe(SUCCESS);
    expect(hard).toBe(false);
    expect(plain(stdout).trim(), 'an explicit empty state, not silence').toBe('· no runs found');
  });

  test('the empty state is printed before the warnings, and warnings still fail the command', async () => {
    // The one arrangement where both halves are visible at once: nothing readable, one damaged
    // sibling. A command that returned early on the empty listing would lose the warning.
    put('bad', '{broken');
    const { stdout, exitCode } = await invoke(['runs']);
    const text = plain(stdout);
    expect(text).toContain('· no runs found');
    expect(text).toContain('bad');
    expect(text.indexOf('no runs found')).toBeLessThan(text.indexOf('bad'));
    expect(exitCode).toBe(ERROR);
  });

  test('an empty positional is no token at all, and lists exactly what no positional lists', async () => {
    // `spike/bin/harness.js:471` selects on truthiness, and `parseArgv` keeps an empty positional
    // (`argv.ts:62`), so `quorum runs ""` reaches this command with `rest[0] === ''`. Under a strict
    // `token !== undefined` it fell through the run-id and ticket-id readings to `unknown run or
    // ticket: ` and a non-zero exit, which is a divergence rather than a rendering difference — the
    // only assertion that discriminates the two spellings, and it fails against the strict one.
    corruptStore();
    const empty = await invoke(['runs', '']);
    const absent = await invoke(['runs']);
    expect(plain(empty.stdout)).toBe(plain(absent.stdout));
    expect(plain(empty.stderr), 'the spike prints no failure sentence for it').toBe('');
    expect(plain(empty.stdout)).toContain('Q-0012-1');
    // Non-zero here is the damaged sibling of `corruptStore`, not the token: E-4's rule, and it is
    // the same code the tokenless listing exits with above.
    expect(empty.exitCode).toBe(absent.exitCode);
    expect(empty.hard).toBe(false);
  });

  test('a run id wins over a ticket-id reading of the same token', async () => {
    // A directory whose name also parses as a ticket id: the detail view is what must answer, or a
    // store could hide one of its own runs behind the filter.
    put('Q-0011', manifest('Q-0011', 'Q-0011'));
    const { stdout, exitCode } = await invoke(['runs', 'Q-0011']);
    expect(exitCode).toBe(SUCCESS);
    expect(plain(stdout), 'the detail view renders occurrences; the listing does not').toContain('steps/001-step-1');
  });
});

describe('AC-6 — confinement holds through the command, and discloses nothing', () => {
  /**
   * A manifest-shaped document outside the runs root, carrying a marker no output may contain.
   *
   * The directory is `elsewhere` where `q0034-review-fixes.js` B4 gives it a name
   * `frame.source.test.ts`'s package-wide BYOS scan looks for — that scan answers for every file in
   * this package and a test naming one of its spellings would be an offender rather than a subject.
   * What B4 drives is the token's *shape*: a relative escape, a nested path, an absolute path, `..`
   * and `.`, and every one of those is unchanged.
   */
  function outsideTheRoot(): string {
    fs.mkdirSync(runsRoot(), { recursive: true });
    const target = path.join(dir, '.quorum', 'elsewhere');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({
      run_id: 'X-1', ticket_id: 'X', steps: [], rollup: [], marker: 'LEAKED',
    }), 'utf8');
    return target;
  }

  test('B4 — the five tokens are refused in both modes, and no document is disclosed', async () => {
    const target = outsideTheRoot();
    for (const token of ['../elsewhere', '.quorum/elsewhere', target, '..', '.']) {
      for (const args of [['runs', token], ['runs', token, '--json']]) {
        const { stdout, stderr, exitCode } = await invoke(args);
        expect(exitCode, `${token} was accepted (${args.join(' ')})`).toBe(ERROR);
        expect(plain(stdout) + plain(stderr), token).not.toContain('LEAKED');
      }
    }
  });

  test('and that fixture discriminates — the planted document is readable and says LEAKED', () => {
    // Without this the assertions above could pass over a directory that held nothing, which would
    // make "discloses nothing" a claim about nothing.
    const target = outsideTheRoot();
    expect(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')).toContain('LEAKED');
  });

  test('a single-segment symlink pointing OUT of the runs root is refused too', async () => {
    // It passes every lexical test — one path segment, not `.`, `..` or empty, lexically inside the
    // runs root — so only resolving both sides for real sees through it. The guard is `core`'s and
    // is not reimplemented here; this is the assertion that the command goes through it.
    const target = outsideTheRoot();
    fs.symlinkSync(target, path.join(runsRoot(), 'Q-0011-9'));
    expect(fs.statSync(path.join(runsRoot(), 'Q-0011-9')).isDirectory(), 'statSync follows the link').toBe(true);

    const { stdout, stderr, exitCode } = await invoke(['runs', 'Q-0011-9', '--json']);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout) + plain(stderr)).not.toContain('LEAKED');
    expect(plain(stderr) + plain(stdout)).toContain('unknown run or ticket: Q-0011-9');
  });
});

describe('AC-7 — the four failure paths are soft, and a warning always fails the command', () => {
  test('a malformed manifest on a detail request names the parser and does not stop the process', async () => {
    put('Q-0011-1', '{broken');
    const { stderr, exitCode, hard } = await invoke(['runs', 'Q-0011-1']);
    expect(exitCode).toBe(ERROR);
    expect(hard, 'this path must not call die').toBe(false);
    expect(plain(stderr)).toContain('run "Q-0011-1": malformed manifest.json (');
  });

  test('a filtered listing with store warnings prints the listing first, then fails', async () => {
    corruptStore();
    const { stdout, exitCode, hard } = await invoke(['runs', 'Q-0011']);
    expect(exitCode).toBe(ERROR);
    expect(hard).toBe(false);
    // The whole point of the soft path: the output that was already written is still there.
    expect(plain(stdout)).toContain('Q-0011-10');
    expect(plain(stdout)).toContain('bad');
  });

  test('an unknown token names the token, and a full listing with warnings still prints', async () => {
    corruptStore();
    const unknown = await invoke(['runs', 'not-a-run']);
    expect(unknown.exitCode).toBe(ERROR);
    expect(unknown.hard).toBe(false);
    expect(plain(unknown.stderr)).toContain('unknown run or ticket: not-a-run');

    const full = await invoke(['runs']);
    expect(full.exitCode).toBe(ERROR);
    expect(full.hard).toBe(false);
    expect(plain(full.stdout)).toContain('Q-0012-1');
  });

  test('the warning line names the run directory it could not read', async () => {
    corruptStore();
    const line = plain((await invoke(['runs'])).stdout).split('\n').find((text) => text.startsWith('!'));
    expect(line, 'no warning line was printed').toBeDefined();
    expect(line).toContain('bad: ');
  });

  test('a missing project is the one hard exit, and it prints core\'s own sentence', async () => {
    // `loadProject` throws where the spike's own version called `die` — a library may not stop its
    // host — so the sentence reaches a terminal only because this command catches it. Uncaught it
    // would reach `dieOnUnexpected` and print a Node stack where the spike prints one line.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-runs-noproject-'));
    process.chdir(empty);
    try {
      const { stderr, exitCode, hard } = await invoke(['runs']);
      expect(hard, 'a missing project stops the process').toBe(true);
      expect(exitCode).toBe(ERROR);
      expect(plain(stderr)).toContain('no harness/harness.yaml found');
    } finally {
      process.chdir(dir);
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('AC-8 — the human listing renders the roll-up, and never a cross-vendor total', () => {
  test('B2 (list) — the token total is input+output, never the cache breakdown added back', async () => {
    // The malformed row is the ruled case, not a fixture accident: both totals null while the cache
    // fields are populated. No adapter can produce it, and `n/a` is the honest rendering of absent
    // summands. Summing 700+250 would print a number that is not a token total. Q-0037 AC-7.
    const document = manifest('Q-0011-1', 'Q-0011');
    document.steps = [{
      ...step(1),
      usage: {
        vendor: 'claude', input_tokens: 1000, output_tokens: 100,
        cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1,
      },
    }];
    document.rollup = [
      row({ vendor: 'claude', input_tokens: 1000, output_tokens: 100, cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1 }),
      row({ vendor: 'codex', unpriced_steps: 1, cached_input_tokens: 700, cache_write_input_tokens: 250 }),
    ];
    put('Q-0011-1', document);

    const list = plain((await invoke(['runs'])).stdout);
    expect(list, 'expected input+output=1100').toMatch(/claude:[^\n]*tokens=1100\b/);
    expect(list, 'cache_write_input_tokens was added to a total that already contains it')
      .not.toMatch(/tokens=1350\b/);
    expect(list, 'a row whose totals are both null reports n/a, never the sum of its cache breakdown')
      .toMatch(/codex:[^\n]*tokens=n\/a/);
  });

  test('money, unpriced_steps and duration render exactly, and no combined total appears', async () => {
    const document = manifest('Q-0011-1', 'Q-0011');
    put('Q-0011-1', document);
    const list = plain((await invoke(['runs'])).stdout);
    // Three decimals, so a real $0.004 step cannot render as $0.00 and read as a reported zero.
    expect(list).toMatch(/claude: cost=\$1\.000 tokens=120 unpriced_steps=0/);
    expect(list).toMatch(/codex: cost=n\/a tokens=120 unpriced_steps=1/);
    expect(list, 'no cross-vendor money total').not.toMatch(/(?:combined|total)[^\n]*\$/i);
    expect(list, 'one decimal place and an s').toMatch(/duration=1\.0s/);
    expect(list, 'the stage endpoints, and the status').toMatch(/red -> green completed/);
  });

  test('a null duration reads n/a, an absent stage endpoint reads ?, and incomplete is labelled', async () => {
    const document = manifest('Q-0011-1', 'Q-0011');
    document.status = 'running';
    document.ended_at = null;
    document.duration_ms = null;
    document.stage = { before: 'red', after: null };
    put('Q-0011-1', document);
    const list = plain((await invoke(['runs'])).stdout);
    expect(list).toContain('duration=n/a');
    expect(list).toContain('red -> ?');
    expect(list).toContain('(incomplete)');
  });
});

describe('AC-9 — the detail view renders an occurrence\'s own usage, and no roll-up field', () => {
  test('B2 (per-step) — the four measures at their own values, and no roll-up field anywhere', async () => {
    const document = manifest('Q-0011-1', 'Q-0011');
    document.steps = [{
      ...step(1),
      usage: {
        vendor: 'claude', input_tokens: 1000, output_tokens: 100,
        cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1,
      },
    }];
    document.rollup = [row({ vendor: 'claude', input_tokens: 1000, output_tokens: 100, cached_input_tokens: 700, cache_write_input_tokens: 250, cost_usd: 1 })];
    put('Q-0011-1', document);

    const detail = plain((await invoke(['runs', 'Q-0011-1'])).stdout);
    for (const [field, value] of [
      ['input_tokens', 1000], ['output_tokens', 100],
      ['cached_input_tokens', 700], ['cache_write_input_tokens', 250],
    ] as const) {
      expect(detail, `the per-step usage line must name ${field} at its own value`)
        .toMatch(new RegExp(`${field}=${String(value)}\\b`));
    }
    expect(detail, 'cache_write_input_tokens was added to a total that already contains it').not.toMatch(/1350/);
    expect(detail, 'a roll-up field must not be synthesised onto a single occurrence').not.toMatch(/unpriced_steps/);
    // And no roll-up at all — which is why B2's `tokens=1100` guard belongs on the list.
    expect(detail, 'the detail view renders no roll-up').not.toMatch(/tokens=1100/);
  });

  test('every occurrence is rendered, ordered by sequence, with an unparseable prefix last', async () => {
    const document = manifest('Q-0011-3', 'Q-0011');
    document.steps = [
      { ...step(1) },
      { ...step(2, 'codex', null) },
      { ...step(10) },
      { ...step(4), step_id: 'step:x', occurrence_dir: 'steps/unnumbered-step-x' },
    ];
    put('Q-0011-3', document);

    const detail = plain((await invoke(['runs', 'Q-0011-3'])).stdout);
    const at = (text: string): number => detail.indexOf(text);
    expect(at('steps/001-step-1')).toBeLessThan(at('steps/002-step-2'));
    expect(at('steps/002-step-2')).toBeLessThan(at('steps/010-step-10'));
    expect(at('steps/010-step-10'), 'an unparseable prefix sorts last, never first')
      .toBeLessThan(at('steps/unnumbered-step-x'));
    // The path is project-relative and in forward slashes, whatever the platform's separator is.
    expect(detail).toContain('.quorum/runs/Q-0011-3/steps/001-step-1');
  });

  test('a failed occurrence with no usage still exposes its category, message and fields', async () => {
    const document = manifest('Q-0011-3', 'Q-0011');
    document.steps = [...document.steps, {
      ...step(3), status: 'failed', error: { category: 'auth', message: 'denied' }, usage: null,
    }];
    put('Q-0011-3', document);

    const { stdout, exitCode } = await invoke(['runs', 'Q-0011-3']);
    const detail = plain(stdout);
    expect(exitCode).toBe(SUCCESS);
    for (const text of ['steps/003-step-3', 'mock', 'completed', 'failed', 'denied', '2026-08-23T10:00:00.000Z']) {
      expect(detail, text).toContain(text);
    }
    expect(detail, 'an occurrence with no usage says so rather than printing zeros').toContain('usage: n/a');
    expect(detail).toContain('error: auth: denied');
    // The fixture proves the detail view can exceed roll-up accounting: three steps, two rows.
    expect(document.rollup.reduce((n, entry) => n + entry.step_count, 0)).toBe(2);
  });

  test('a billed failure\'s usage is rendered from the file, not from a run\'s memory', async () => {
    // The rendering half of `q0011-run-history.js:121–124`. Its other half is process separation,
    // which `invoke` cannot claim because it calls the handler here — that is asserted by spawning
    // the built binary at the same shape, in `build.test.ts`'s Q-0092 AC-9 block, which is where a
    // real-workspace spawn belongs (Q-0098 AC-15(c), and the banner above it). Both are named on
    // `spike-parity.test.ts`'s row for that file; neither is deferred.
    const document = manifest('Q-0011-1', 'Q-0011');
    document.steps = [{
      ...step(1), status: 'failed', usage: usage('codex', null),
      error: { category: 'adapter', message: 'simulated failure' },
    }];
    put('Q-0011-1', document);

    const detail = plain((await invoke(['runs', 'Q-0011-1'])).stdout);
    expect(detail).toContain('simulated');
    expect(detail).toContain('codex');
    expect(detail, 'a billed failure\'s usage was omitted').toMatch(/input_tokens=100\b/);
  });

  test('the incomplete label names the manifest, project-relative, and nothing is repaired', async () => {
    const document = manifest('Q-0011-1', 'Q-0011');
    document.status = 'running';
    document.ended_at = null;
    document.duration_ms = null;
    put('Q-0011-1', document);
    const file = path.join(runsRoot(), 'Q-0011-1', 'manifest.json');
    const before = fs.readFileSync(file);

    const { stdout, exitCode } = await invoke(['runs', 'Q-0011-1']);
    expect(exitCode).toBe(SUCCESS);
    expect(plain(stdout)).toMatch(/incomplete/i);
    expect(plain(stdout)).toContain(path.join('.quorum', 'runs', 'Q-0011-1', 'manifest.json'));
    expect(fs.readFileSync(file), 'a reader repairs nothing').toStrictEqual(before);
  });

  test('a run id that is not there is an error naming the token', async () => {
    put('Q-0011-1', manifest('Q-0011-1', 'Q-0011'));
    const { stdout, stderr, exitCode } = await invoke(['runs', 'Q-0011-404']);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout) + plain(stderr)).toContain('Q-0011-404');
  });
});

describe('AC-10 — --json is one ANSI-free document in every mode', () => {
  /** The one document `--json` printed, parsed, with the escape-free claim asserted first. */
  const oneDocument = (stdout: string): Record<string, unknown> => {
    expect(stdout, 'an escape byte reached a --json document').not.toMatch(/\x1b\[/);
    return JSON.parse(stdout) as Record<string, unknown>;
  };

  test('list mode is one document, and each run object carries exactly the ten keys', async () => {
    const written = manifest('Q-0011-1', 'Q-0011');
    written.status = 'running';
    written.ended_at = null;
    written.duration_ms = null;
    put('Q-0011-1', written);
    put('bad', 'no');

    const { stdout, exitCode } = await invoke(['runs', '--json']);
    const parsed = oneDocument(stdout);
    expect(parsed.mode).toBe('list');
    expect(exitCode, 'a damaged sibling still fails the command in --json mode').toBe(ERROR);
    const runs = parsed.runs as Record<string, unknown>[];
    // An identity, so a key added by accident fails rather than passing unnoticed.
    expect(Object.keys(runs[0]).sort()).toStrictEqual([
      'duration_ms', 'ended_at', 'flow', 'incomplete', 'rollup', 'run_id', 'stage', 'started_at',
      'status', 'ticket_id',
    ]);
    expect(runs[0].incomplete, 'incomplete is derived, not read').toBe(true);
    // Each warning is one string, `<runId>: <message>` — not the object the reader answers with.
    const warnings = parsed.warnings as unknown[];
    expect(warnings).toHaveLength(1);
    expect(typeof warnings[0], 'a warning object reached the document instead of its rendering').toBe('string');
    expect(warnings[0] as string).toMatch(/^bad: malformed manifest\.json \(/);
  });

  test('detail mode carries the manifest deep-equal to the file, never reshaped', async () => {
    const written = manifest('Q-0011-1', 'Q-0011');
    put('Q-0011-1', written);
    put('bad', 'no');

    const { stdout, exitCode } = await invoke(['runs', 'Q-0011-1', '--json']);
    const parsed = oneDocument(stdout);
    expect(exitCode, 'a damaged sibling affects neither the detail output nor its status').toBe(SUCCESS);
    expect(parsed.mode).toBe('detail');
    // The assertion that catches a reader reshaping what it read, or bolting a roll-up onto it.
    expect(parsed.run).toStrictEqual(JSON.parse(fs.readFileSync(path.join(runsRoot(), 'Q-0011-1', 'manifest.json'), 'utf8')));
    expect(parsed.incomplete).toBe(false);
    expect(parsed.manifest_path).toBe(path.join('.quorum', 'runs', 'Q-0011-1', 'manifest.json'));
    expect(parsed.warnings, 'a detail request collects none by construction').toStrictEqual([]);
    expect(stdout).not.toContain('bad');
  });

  test('both errors are one document on stdout, with a non-zero exit', async () => {
    put('Q-0011-1', '{broken');
    const malformed = await invoke(['runs', 'Q-0011-1', '--json']);
    expect(malformed.exitCode).toBe(ERROR);
    expect(oneDocument(malformed.stdout).error).toMatch(/^run "Q-0011-1": malformed manifest\.json \(/);
    expect(malformed.stderr, 'in --json mode the sentence goes to stdout').toBe('');

    const unknown = await invoke(['runs', 'not-a-run', '--json']);
    expect(unknown.exitCode).toBe(ERROR);
    expect(oneDocument(unknown.stdout).error).toBe('unknown run or ticket: not-a-run');
    expect(unknown.stderr).toBe('');
  });

  test('the ordering and the filter are the same in --json as in human mode', async () => {
    corruptStore();
    const parsed = oneDocument((await invoke(['runs', '--json'])).stdout);
    expect((parsed.runs as { run_id: string }[]).map((entry) => entry.run_id))
      .toStrictEqual(['Q-0012-1', 'Q-0011-10', 'Q-0011-2']);
    const filtered = oneDocument((await invoke(['runs', 'Q-0011', '--json'])).stdout);
    expect((filtered.runs as { run_id: string }[]).map((entry) => entry.run_id))
      .toStrictEqual(['Q-0011-10', 'Q-0011-2']);
  });

  test('and the escape-free claim has a subject — human mode does carry escapes', async () => {
    // Without this the assertion above could pass over a renderer that had simply stopped colouring
    // anything, which would make it a claim about nothing.
    put('Q-0011-1', manifest('Q-0011-1', 'Q-0011'));
    expect((await invoke(['runs'])).stdout, 'human output is coloured').toMatch(/\x1b\[/);
    expect((await invoke(['runs', 'Q-0011-1'])).stdout).toMatch(/\x1b\[/);
  });
});

describe('AC-11 — a detail request reads only the run it was asked for', () => {
  test('the healthy run renders, exits 0, and never names its damaged sibling', async () => {
    corruptStore();
    const { stdout, stderr, exitCode } = await invoke(['runs', 'Q-0011-2']);
    expect(exitCode, 'a sibling\'s damage must not reach a detail request\'s status').toBe(SUCCESS);
    expect(plain(stdout)).toContain('steps/001-step-1');
    expect(plain(stdout) + plain(stderr), 'the damaged sibling was named').not.toContain('bad');
    // The same store, listed, does both — which is what makes the assertion above discriminating.
    const listed = await invoke(['runs']);
    expect(listed.exitCode).toBe(ERROR);
    expect(plain(listed.stdout)).toContain('bad');
  });

  test('and the sibling\'s manifest is read zero times, counted rather than reasoned about', async () => {
    // Invisible in the output, which is why `spike/bin/harness.js:467–470` carries a comment saying
    // so and why `listRuns` is a closure rather than a value. Counted as
    // `q0011-runs-cli.js:194–204` counts reads for `validateArtifact`.
    corruptStore();
    const reads: string[] = [];
    const real = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((target: Parameters<typeof fs.readFileSync>[0], ...rest: unknown[]) => {
      reads.push(String(target));
      return (real as (...args: unknown[]) => unknown)(target, ...rest);
    }) as typeof fs.readFileSync);

    await invoke(['runs', 'Q-0011-2']);
    const manifests = reads.filter((target) => target.endsWith('manifest.json'));
    expect(manifests.filter((target) => target.includes('bad')), 'the damaged sibling was read').toStrictEqual([]);
    expect(manifests.filter((target) => target.includes('Q-0012-1')), 'a healthy sibling was read').toStrictEqual([]);
    expect(manifests, 'exactly one manifest, and it is the one that was asked for').toHaveLength(1);
    expect(manifests[0]).toContain('Q-0011-2');
  });

  test('and that count has a subject — a listing over the same store reads every one of them', async () => {
    corruptStore();
    const reads: string[] = [];
    const real = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((target: Parameters<typeof fs.readFileSync>[0], ...rest: unknown[]) => {
      reads.push(String(target));
      return (real as (...args: unknown[]) => unknown)(target, ...rest);
    }) as typeof fs.readFileSync);

    await invoke(['runs']);
    expect(reads.filter((target) => target.endsWith('manifest.json'))).toHaveLength(4);
  });
});

describe('AC-12 — the preserved defects are pinned, so a later fix is a deliberate act', () => {
  test('the listing and the detail disagree about a symlinked run directory', async () => {
    // `readdirSync` with `withFileTypes` has lstat semantics, so the alias is absent from the
    // listing; `resolveRunDirectory` accepts it, so the detail view opens it. Two answers to one
    // question, inherited from `reader.ts:111–114` and reported rather than reconciled here.
    put('Q-0011-2', manifest('Q-0011-2', 'Q-0011'));
    fs.symlinkSync(path.join(runsRoot(), 'Q-0011-2'), path.join(runsRoot(), 'Q-0011-alias'));

    const listed = plain((await invoke(['runs'])).stdout);
    expect(listed, 'the listing skips the alias').not.toContain('Q-0011-alias');
    const detail = await invoke(['runs', 'Q-0011-alias']);
    expect(detail.exitCode, 'the detail view opens it').toBe(SUCCESS);
    expect(plain(detail.stdout)).toContain('steps/001-step-1');
  });

  test('a roll-up row with both totals null reads n/a while its cache fields are populated', async () => {
    // Ruled rather than fixed (Q-0037 AC-7): no adapter can produce that row, and `n/a` is the
    // honest rendering of absent summands. Pinned here so summing them would be a visible change.
    const document = manifest('Q-0011-1', 'Q-0011');
    document.rollup = [row({ vendor: 'codex', unpriced_steps: 1, cached_input_tokens: 700, cache_write_input_tokens: 250 })];
    put('Q-0011-1', document);
    const list = plain((await invoke(['runs'])).stdout);
    expect(list).toMatch(/codex: cost=n\/a tokens=n\/a unpriced_steps=1/);
    expect(list).not.toMatch(/tokens=950\b/);
  });

  test('a detail read validates no schema — a manifest that only parses still renders', async () => {
    // `manifestShapeError` proves five things and casts, and a detail read does not even ask it:
    // `quorum validate` against the frozen contract is the job that proves more. Deliberate —
    // refusing here would make a store's damage decide whether its healthy runs can be read.
    put('Q-0011-1', { run_id: 'Q-0011-1', ticket_id: 'Q-0011', status: 'completed', steps: [], rollup: [] });
    const { stdout, exitCode } = await invoke(['runs', 'Q-0011-1']);
    expect(exitCode).toBe(SUCCESS);
    // No `stage`, no `flow`, no `duration_ms`: rendered as it stands rather than refused or defaulted.
    expect(plain(stdout)).toContain('? -> ?');
    expect(plain(stdout)).toContain('duration=n/a');
  });
});
