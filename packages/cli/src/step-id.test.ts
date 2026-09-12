/**
 * Q-0055 AC-11 — the two CLI surfaces report a step with no id, and nothing begins.
 *
 * **Through the built binary, as separate operating-system processes.** The nine sibling suites
 * drive their command in process through `test/invoke.ts`, and this one cannot make the claim that
 * matters that way: AC-11 is that `quorum run` stops *before an adapter is reached*, with **no run
 * directory under `.quorum/runs/` and no branch whose last segment is the word an absent id
 * renders as**, and both of those are facts about what a real invocation left on a real disk. An
 * in-process spy on `process.exit` would assert the status and say nothing about either.
 *
 * **It spawns a copy it built itself, never `packages/cli/dist`.** That is the first of the two safe
 * shapes Q-0098 AC-15(c) names: `build.test.ts` removes the real emit twice, `vitest.shared.js` sets
 * no `fileParallelism: false`, and a second file spawning that path would intermittently meet a
 * directory that had just gone — a flake that reads as a code defect. The copier is
 * `../test/workspace.ts`, shared with `build.test.ts` and `end-to-end.test.ts` rather than written a
 * third time.
 *
 * **The clean pair is not decoration.** "No run directory and no branch" is a claim about an
 * absence, and an absence proves nothing unless the same fixture is shown producing the presence:
 * the broken flow is linted and run first, then removed, and the identical run command is issued
 * again on the same ticket in the same repository. Without the second half this file would report
 * success over a run that could never have created anything — *"a check that skips its subject must
 * not report success"* (2026-08-25).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { buildIn, disposeIsolated, isolate, PACKAGE, read } from '../test/workspace.js';

/** How long one spawned invocation may take before it is killed. */
const SPAWN_TIMEOUT_MS = 60_000;

/**
 * How long the whole fixture may take to build and walk — the isolated build is all of it.
 *
 * Re-measured at Q-0122, which made the emitting set four and so gave this fixture a `vite build`
 * it did not have: 3.3 s for the whole file over two runs, against a budget 55 times that. It was
 * *"the isolated `tsc`"* until then, and it is no longer only `tsc`. The budget does not move — the
 * measurement is what says so, rather than the margin being assumed to absorb it.
 */
const FIXTURE_TIMEOUT_MS = 180_000;

/** The ticket the fixture allocates, and the owner it supplies rather than inheriting (Q-0112). */
const TICKET = 'T-0001';
const OWNER = 'q0055-fixture';

/** The id the second half of the fixture supplies, and therefore the branch its run cuts. */
const PROBE_STEP = 'probe-step';

/** ANSI stripped, as every assertion below reads the output. */
const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

/** One spawned invocation, reduced to what an assertion here reads. */
interface Invocation {
  status: number | null;
  stdout: string;
  stderr: string;
}

const output = (invocation: Invocation): string => `${invocation.stdout}${invocation.stderr}`;

/**
 * The flow the fixture runs twice, with and without an id on its one step.
 *
 * **`worktree: true` is the load-bearing key**, and it is why the two invocations discriminate: a
 * worktree step's branch defaults to `harness/<ticket>/<step id>`, so with an id this flow cuts
 * `harness/T-0001/probe` and without one it cut `harness/T-0001/undefined` — the exact string this
 * ticket exists to make unreachable. Everything else is identical between the two runs, so the
 * difference in what is left on disk is attributable to the id and to nothing else.
 *
 * `role:` and `adapter:` are here because they are what make it look finished: the step is complete
 * in every way but the one the engine names three things after, which is exactly the flow an
 * adopter writes first and exactly the one that used to lint clean.
 */
const probeFlow = (id: string | null): string => [
  'name: probe', 'consumes: draft', 'produces: requirements', 'steps:',
  ...(id === null
    ? ['  - role: product-manager']
    : [`  - id: ${id}`, '    role: product-manager']),
  '    adapter: mock',
  '    worktree: true',
].join('\n') + '\n';

/** Every temporary directory this file made. */
const temporaries: string[] = [];

afterAll(() => {
  for (const directory of temporaries.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  disposeIsolated();
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** What the fixture recorded, filled once in `beforeAll` and read by every test below. */
interface Fixture {
  repo: string;
  lintRefused: Invocation;
  runRefused: Invocation;
  lintClean: Invocation;
  runClean: Invocation;
  /** What was on disk immediately after the refused run — the two absences AC-11 is about. */
  afterRefusal: { runsRoot: boolean; branches: string[] };
  /** And after the identical command over a directory that lints, which is what makes them facts. */
  afterClean: { runsRoot: boolean; branches: string[] };
}

let fixture: Fixture;

beforeAll(() => {
  const root = isolate();
  buildIn(root, '--force');
  const declared = (JSON.parse(read(PACKAGE, 'package.json')) as { bin: Record<string, string> }).bin.quorum;
  const bin = path.join(root, 'packages', 'cli', declared);
  if (!fs.existsSync(bin)) throw new Error(`the isolated build wrote no ${declared} — there is nothing to spawn`);

  // Realpathed: on macOS `os.tmpdir()` is a symlink and `loadProject` resolves what it is given, so
  // an unresolved fixture path would make a path assertion answer for two different directories.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-q0055-')));
  temporaries.push(repo);

  const invoke = (...argv: string[]): Invocation => {
    const result = spawnSync(process.execPath, [bin, ...argv], {
      cwd: repo, encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS,
    });
    return { status: result.status, stdout: plain(result.stdout ?? ''), stderr: plain(result.stderr ?? '') };
  };
  const mustPass = (label: string, ...argv: string[]): Invocation => {
    const invocation = invoke(...argv);
    if (invocation.status !== 0) {
      throw new Error(`${label} exited ${String(invocation.status)}; the fixture cannot continue:\n${output(invocation)}`);
    }
    return invocation;
  };

  git(repo, 'init', '-q', '-b', 'main');
  git(repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '--allow-empty', '-m', 'init');
  mustPass('init', 'init');
  mustPass('ticket', 'ticket', 'new', 'A step with no id', '--intent', 'Probe the id rule', '--owner', OWNER);

  const probe = path.join(repo, 'harness', 'flows', 'probe.yaml');
  /** Every `harness/…` ref in the fixture repository, which is where a worktree step leaves one. */
  const branches = (): string[] => git(repo, 'branch', '--list', 'harness/*')
    .split('\n').map((line) => line.replace(/^[* ]+/, '').trim()).filter(Boolean).sort();
  const runsRoot = (): boolean => fs.existsSync(path.join(repo, '.quorum', 'runs'));

  fs.writeFileSync(probe, probeFlow(null), 'utf8');
  const lintRefused = invoke('lint');
  const runRefused = invoke('run', 'probe', TICKET, '--adapter', 'mock', '--auto');
  const afterRefusal = { runsRoot: runsRoot(), branches: branches() };

  // The same command, over the same ticket, in the same repository. One key differs.
  fs.writeFileSync(probe, probeFlow(PROBE_STEP), 'utf8');
  const lintClean = invoke('lint');
  const runClean = invoke('run', 'probe', TICKET, '--adapter', 'mock', '--auto');
  const afterClean = { runsRoot: runsRoot(), branches: branches() };

  fixture = { repo, lintRefused, runRefused, lintClean, runClean, afterRefusal, afterClean };
}, FIXTURE_TIMEOUT_MS);

describe('Q-0055 AC-11 — `quorum lint` reports it, under the right filename', () => {
  test('exit 1, and the message indented beneath the file it belongs to', () => {
    expect(fixture.lintRefused.status, output(fixture.lintRefused)).toBe(1);
    const lines = output(fixture.lintRefused).split('\n');
    const marked = lines.findIndex((line) => /^✗ probe\.yaml$/.test(line.trim()));
    expect(marked, 'no ✗ line names probe.yaml').toBeGreaterThanOrEqual(0);
    // The problem is the NEXT line and indented by the two spaces `renderFlowReport` adds, which is
    // what makes it belong to that file rather than to the report as a whole.
    expect(lines[marked + 1]).toBe('  - step 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it');
  });

  test('and the six flows `quorum init` scaffolds still tick, so the rule refuses nothing shipped', () => {
    // The cold-clone half of the same claim: a stranger's first `quorum lint` after `quorum init`
    // must still print six green ticks, or this rule would have made the first thirty minutes worse
    // rather than better.
    const ticked = output(fixture.lintRefused).split('\n').filter((line) => line.trim().startsWith('✓'));
    expect(ticked.map((line) => line.trim())).toStrictEqual([
      '✓ chore.yaml', '✓ development.yaml', '✓ qa-red.yaml',
      '✓ requirements.yaml', '✓ review.yaml', '✓ solutioning.yaml',
    ]);
  });

  test('with the one key supplied the whole directory ticks and the command exits 0', () => {
    expect(fixture.lintClean.status, output(fixture.lintClean)).toBe(0);
    expect(output(fixture.lintClean), 'a refusal survived the id being supplied').not.toContain('✗');
    expect(output(fixture.lintClean), 'and the repaired file is the seventh tick').toContain('✓ probe.yaml');
  });
});

describe('Q-0055 AC-11 — `quorum run` stops on it, and nothing begins', () => {
  test('exit 1, with the same diagnostic the lint command printed', () => {
    expect(fixture.runRefused.status, output(fixture.runRefused)).toBe(1);
    expect(output(fixture.runRefused)).toContain('✗ probe.yaml');
    expect(output(fixture.runRefused)).toContain('step 1: id is required');
  });

  test('no run directory was allocated, and no branch was cut — which is the whole ticket', () => {
    // The preflight lints the WHOLE directory before the named flow is loaded and before any
    // project state is read, so the refusal lands ahead of everything a run would otherwise leave.
    expect(fixture.afterRefusal.runsRoot, 'a refused run allocated a run directory').toBe(false);
    expect(fixture.afterRefusal.branches, 'a refused run cut a branch').toStrictEqual([]);
  });

  test('and the same flow with an id on the same step creates both', () => {
    // The discriminator, and it is exact: one key differs between the two invocations. Without it
    // the two absences above would be satisfied by a fixture in which no run could ever have
    // created anything, which is an assertion that cannot fail.
    expect(fixture.runClean.status, output(fixture.runClean)).toBe(0);
    expect(fixture.afterClean.runsRoot, 'the clean run allocated no run directory either — the absences prove nothing').toBe(true);
    expect(fixture.afterClean.branches, 'the branch the step is named after').toStrictEqual([`harness/${TICKET}/${PROBE_STEP}`]);
  });

  test('and the branch the refused run would have cut is the one this ticket exists for', () => {
    // Named rather than implied: without the rule, `harness/T-0001/undefined` is what the run
    // above would have left, because the branch defaults to `harness/<ticket>/<step id>` and the
    // absent id interpolates as that word. Asserted over both readings, so a branch created by
    // either run is covered.
    const wouldHaveBeen = `harness/${TICKET}/undefined`;
    for (const [what, snapshot] of [['the refused run', fixture.afterRefusal], ['the clean run', fixture.afterClean]] as const) {
      expect(snapshot.branches, `${what} left ${wouldHaveBeen}`).not.toContain(wouldHaveBeen);
      for (const branch of snapshot.branches) {
        expect(branch.endsWith('/undefined'), `${what} left ${branch}`).toBe(false);
      }
    }
  });
});
