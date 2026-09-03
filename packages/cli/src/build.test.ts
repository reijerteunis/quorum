/**
 * Q-0097 — the workspace emits JavaScript, and what a cache hit on that emit gives back.
 *
 * AC-7 (the task exists and declares real `outputs`), AC-8 (the declaration covers exactly what the
 * build writes), AC-9 (a replayed build restores a *usable* artifact, which is also AC-22's
 * integration proof), AC-12's awareness table, and AC-23 (nothing emitted is collected by Vitest).
 *
 * **Why the new failure class needs its own guard.** `lint`, `typecheck` and `test` all declare
 * `"outputs": []`, so a hit on any of them replays a **verdict** — the failure Q-0065, Q-0071 and
 * Q-0072 each closed one layer of. A hit on `build` replays an **artifact**, and an artifact
 * something downstream executes fails differently: the stale tick lies about the past, the stale
 * artifact lies about the present. See *"The emit serves the binary, and no test verdict moves
 * behind it"* (2026-09-02).
 *
 * **Why this file is in `packages/cli`** (merged requirement OQ-1). A test that builds package *P*
 * takes its verdict from *P*'s sources, so the owning task must already hash them (Q-0072).
 * `@quorum/cli` depends on both `@quorum/core` and `@quorum/shared`, so `@quorum/cli#test` hashes
 * both through its `^test` edges; `@quorum/core#test` has an edge to `shared` but not to `cli`, so
 * owning these there would mean declaring `packages/cli/src/**` by hand. It is also where AC-12
 * already sits, and where `turbo-inputs.test.ts` deliberately does not audit — this package's
 * out-of-package reads are registered in `package.test.ts`'s own `OUTSIDE`/`DECLARED` pair instead.
 *
 * **Where AC-8 is observed, and why it is two places rather than one.** The exact write-set audit
 * runs against an isolated copy ({@link isolate}), because that is the only place the question *what
 * did this build write* has an exact answer: in the real checkout `.git`, `.harness` and `.quorum`
 * are entered by a concurrent harness run, so auditing them there reads the machine, and excusing
 * them by name — which this file did until run 3 — leaves a build free to write into any of the
 * three while the criterion reports exact agreement. The real-workspace build is kept beside it
 * because R-4 and OQ-1 make it load-bearing, and there it is observed by git outside the emitting
 * packages and by the walk inside them, so no hand-written list of directory names excuses anything.
 *
 * **Every test below leaves the workspace built.** The emit is gitignored and this file is the only
 * thing in the suite that writes it, which `harness/rules.md` permits — *"a repository it built
 * itself"*. It is not a side effect on the tree the suite is judging: no verdict anywhere in this
 * workspace reads `dist/`, which is clause (b) of the entry above and what AC-23's
 * present-and-absent assertion re-checks rather than assumes.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configDefaults } from 'vitest/config';
import { afterAll, describe, expect, test } from 'vitest';

import { HELP } from './commands.js';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The workspace root, which is this package's grandparent. */
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

/**
 * The emit directory, named once.
 *
 * Tied to the declaration rather than trusted beside it: AC-7 asserts that every pattern in the
 * `build` task's `outputs` sits under this name, so the constant and `turbo.json` cannot drift into
 * a state where this file deletes one directory and turbo restores another.
 */
const EMIT = 'dist';

/** Turbo's marker for a package that declares no script for the task — the silent skip AC-13 is about. */
const NO_SCRIPT = '<NONEXISTENT>';

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');

/**
 * Parses a turbo configuration, which is JSONC.
 *
 * Root `turbo.json` carries no comment — a guard older than this ticket parses it with a plain
 * `JSON.parse` (`packages/core/src/test-command.test.ts`), so adding one would turn that file red —
 * but every package-level configuration does, and each comment is the sentence saying why a read is
 * declared. The one form they use is a whole-line `//`, and anything else **stops the guard**:
 * a reader that quietly resolved an unfamiliar shape to a default would put a value nobody wrote
 * behind every clause below.
 */
function parseTurboConfig(text: string, name: string): { tasks: Record<string, Record<string, unknown>> } {
  const stripped = text.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  try {
    return JSON.parse(stripped) as { tasks: Record<string, Record<string, unknown>> };
  } catch (cause) {
    throw new Error(`${name} is not JSON once whole-line comments are removed — this reader understands no other comment form`, { cause });
  }
}

/** One task's declaration, as root `turbo.json` writes it. */
interface TaskDeclaration {
  readonly outputs?: string[];
  readonly dependsOn?: string[];
  readonly env?: string[];
}

/** Root `turbo.json`, which declares every task and is the only place `env` is decided. */
const rootTurbo = (): { globalDependencies?: string[]; tasks: Record<string, TaskDeclaration> } =>
  JSON.parse(read(WORKSPACE, 'turbo.json')) as { globalDependencies?: string[]; tasks: Record<string, TaskDeclaration> };

/**
 * The real `turbo` this workspace installs. Absent is a failure, never a skip: a build proof that
 * quietly does not run is the shape of defect this whole ticket is about.
 */
const turboBin = (): string => {
  const bin = path.join(WORKSPACE, 'node_modules/.bin/turbo');
  if (!fs.existsSync(bin)) throw new Error(`corpus missing: ${bin} — install the workspace before asserting what turbo builds`);
  return bin;
};

/**
 * The environment the nested turbo runs get, with `TURBO_FORCE` removed.
 *
 * The outer invocation of this suite is `pnpm turbo run test --force` in CI and at `integrate`, and
 * a leaked force would turn AC-9's expected cache **hit** into a miss — a verdict taken from how the
 * run that contains it was invoked rather than from the commit (*"A test's verdict is a property of
 * the commit, not of the checkout or the account"*, 2026-08-30). Removed rather than set to a
 * falsy string, because turbo reads the variable's presence as well as its value; where a force is
 * wanted below it is passed as a flag, which outranks the environment either way.
 */
const turboEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.TURBO_FORCE;
  return env;
};

/** One task in turbo's own report of a run — real or dry. */
interface TurboTask {
  readonly taskId: string;
  readonly package: string;
  readonly directory: string;
  readonly command: string;
  readonly cache?: { status?: string };
  readonly resolvedTaskDefinition: { outputs?: string[]; dependsOn?: string[]; env?: string[] };
}

/**
 * What turbo says it would do, as opposed to what `turbo.json` appears to say.
 *
 * `--dry=json` executes nothing, so this cannot spawn the run it is running inside, and it reports
 * **every** package in scope — including the four that declare no `build` script, which come back
 * with `command: "<NONEXISTENT>"`. That marker is turbo's own admission of the silent skip AC-13
 * exists to close, which makes it a better oracle than reading seven manifests.
 */
const dry = (task: string): { packages: string[]; tasks: TurboTask[] } =>
  JSON.parse(execFileSync(turboBin(), ['run', task, '--dry=json'], {
    cwd: WORKSPACE, encoding: 'utf8', env: turboEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  })) as { packages: string[]; tasks: TurboTask[] };

/** The packages turbo will actually run `build` in — the emitting set decision 078(c) names. */
const emitting = (): TurboTask[] => dry('build').tasks.filter((task) => task.command !== NO_SCRIPT);

/**
 * Runs the real `build` and hands back turbo's machine-readable summary of what it did.
 *
 * `--summarize` rather than the output text, because AC-9's oracle is explicitly not the log: a
 * human-readable `FULL TURBO` line is a rendering, and `cache.status` is the fact. The summary file
 * turbo writes is read and then removed — it is a file this test caused to exist, and leaving one
 * per invocation would grow `.turbo/runs/` for every developer who runs the suite.
 */
function runBuild(...flags: string[]): TurboTask[] {
  const output = execFileSync(turboBin(), ['run', 'build', '--summarize', ...flags], {
    cwd: WORKSPACE, encoding: 'utf8', env: turboEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const summaryPath = /^\s*Summary:\s*(\S+)\s*$/m.exec(output)?.[1];
  if (summaryPath === undefined) throw new Error(`turbo wrote no run summary — the oracle is missing, not the build:\n${output}`);
  try {
    return (JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as { tasks: TurboTask[] }).tasks;
  } finally {
    fs.rmSync(summaryPath, { force: true });
  }
}

/**
 * Links the workspace's bin shims, which is an **install-time** artifact and not a build-time one.
 *
 * Why this exists, measured rather than reasoned — chore run 2 aborted at `integrate` with the two
 * AC-18 tests red, and this is what it turned out to be. `pnpm` links `node_modules/.bin/<name>`
 * during install **and only where the bin target already exists**. Decision *"The emit serves the
 * binary, and no test verdict moves behind it"* (2026-09-02) clause (b) deliberately gives `test` no
 * `^build` edge, so from a clean checkout the order is **install → test** and `dist/quorum.js` is
 * *guaranteed* absent when install runs. {@link runBuild} then creates the artifact but cannot make
 * a finished install link anything, so the shim never appears and AC-18 fails for a reason that has
 * nothing to do with the commit.
 *
 * Verified both directions in the integrate worktree: with the artifact absent the install links no
 * shim; re-running the identical command once it exists creates one, *"Already up to date"* in
 * 182 ms. See `requirements/errata.md` E-2, which rules this the fixture's job.
 *
 * **The side effect is registered rather than hidden.** This writes to the developer's
 * `node_modules/.bin`, which Q-0073 objects to in the general case. Accepted here because the write
 * is exactly the one a correct install performs, it is self-correcting on the next install, and the
 * alternative is no coverage of AC-18's documented mechanism at all. It adds no task-graph edge, so
 * no other verdict in the workspace moves behind a build.
 */
function linkBins(): void {
  execFileSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Removes every emitting package's emit directory, so a build writes into a clean tree. */
const removeEmit = (): void => {
  for (const task of emitting()) fs.rmSync(path.join(WORKSPACE, task.directory, EMIT), { recursive: true, force: true });
};

/**
 * The one directory name the **real-workspace** walks below do not descend into.
 *
 * It is a bound on where the build is observed rather than an exemption AC-8 grants, and the
 * difference is the whole of why it is one name and not five. `node_modules` is what an install
 * writes rather than what a build writes, and — measured — the `.vite` and `.vite-temp` directories
 * inside each package's own `node_modules` are written by the **Vitest process running this very
 * test**, which is not a hypothetical concurrent writer but the one running now, so a walk that
 * descended would take its verdict from the runner's own cache churn rather than from the build.
 *
 * What keeps it from being a blind spot is that the isolated audit prunes nothing at all and does
 * descend into it: a copy's `node_modules` is a directory of symlinks, each a leaf whose fingerprint
 * is its target, so a file a build creates under one is a new entry there and is reported. See
 * {@link isolate}.
 *
 * Why: the five this replaced are `requirements/errata.md` E-1's register, which **E-2 withdraws**.
 * Read E-1 alone and this line contradicts a ruling; E-2 is the one that stands.
 */
const INSTALLED = ['node_modules'];

/**
 * Every path below `root`, relative to it with `/` separators.
 *
 * A symlink is a **leaf**: `readdir` does not follow one, so what churns behind it is out of scope
 * while the link itself stays in scope. That is what lets the isolated audit walk a copy's
 * `node_modules` without walking an installed dependency tree.
 */
function filesUnder(root: string, prune: readonly string[] = []): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!prune.includes(entry.name)) walk(full);
      } else {
        found.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * One path's fingerprint: its size, its modification time and a hash of its bytes — or, for a
 * symlink, its target.
 *
 * **This is what makes the audit an enumeration of what the build WROTE rather than of what it
 * ADDED.** A snapshot of path *names* answers only *did this path exist before*, so a build that
 * **overwrote** a file already there is subtracted away by the very comparison meant to find it.
 *
 * Two writes it cannot see, both stated rather than left to be found:
 *
 *   - a rewrite identical in bytes *and* in timestamp, which no compiler produces and which nothing
 *     short of instrumenting the process would observe; and
 *   - a write **through** a symlink. A link's fingerprint is its target, so re-pointing one is
 *     reported and creating an entry beside one is reported, but a build that opened
 *     `node_modules/typescript/lib/x.js` for writing would change a file *outside* the audited root
 *     and nothing here would differ. Closing it means auditing the whole dependency tree on every
 *     run, which is why the bound is registered instead. Found by review round 4 of chore run 3,
 *     which was right that `requirements/errata.md` E-2 overclaimed in saying the isolated audit
 *     descends into `node_modules` with no blind spot — E-3 corrects that sentence. No shipped build
 *     script can reach it: all three are `rm -rf dist && tsc -p tsconfig.build.json`, and `tsc`
 *     writes only under its `outDir`.
 */
function fingerprint(full: string, stat: fs.Stats): string {
  // `realpath` and not `readlink`, so a link re-pointed at the same relative spelling from a
  // different directory is still a change. The target's CONTENTS are deliberately not read — see
  // the second bound above.
  if (stat.isSymbolicLink()) return `link:${fs.realpathSync.native(path.resolve(path.dirname(full), fs.readlinkSync(full)))}`;
  if (!stat.isFile()) return `special:${stat.mode}`;
  return `${stat.size}:${stat.mtimeMs}:${createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`;
}

/** {@link fingerprint} for every path below `root`. */
const inventory = (root: string, prune: readonly string[] = []): Map<string, string> =>
  new Map(filesUnder(root, prune).map((relative) => {
    const full = path.join(root, relative);
    return [relative, fingerprint(full, fs.lstatSync(full))];
  }));

/**
 * {@link fingerprint} for every path in `cwd` **git can see** — tracked, plus untracked and
 * unignored.
 *
 * This is how the real-workspace audit reaches outside the emitting packages, and the oracle is
 * chosen rather than inherited: *"Membership is a git question, not a filesystem one"*
 * (2026-08-28). It is what separates a build's write from a concurrent harness run's, because
 * `.git`, `.harness`, `.quorum`, `node_modules` and the emit itself are all things git does not
 * list — so no hand-written list of directory names has to excuse them, and none does. What it
 * cannot see is a write to a gitignored path outside an emitting package, which is exactly the
 * region {@link isolate} covers whole and with nothing pruned.
 */
function gitVisible(cwd: string): Map<string, string> {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  const found = new Map<string, string>();
  for (const relative of listed) {
    const full = path.join(cwd, relative);
    // Absence is refused rather than classified (Q-0073): a tracked path git lists and the working
    // tree does not hold is skipped in *both* snapshots, so a build that deletes one is still
    // reported as a removal by the comparison rather than being quietly excused here.
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (stat !== undefined) found.set(relative, fingerprint(full, stat));
  }
  return found;
}

/** Every path whose fingerprint `after` does not share with `before` — created or overwritten. */
const writtenBetween = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...after].filter(([relative, mark]) => before.get(relative) !== mark).map(([relative]) => relative).sort();

/** Every path `before` held that `after` does not. */
const removedBetween = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...before.keys()].filter((relative) => !after.has(relative)).sort();

/**
 * Turbo's own cache metadata and per-task log, which is the one thing AC-8's wording excuses:
 * *"Turbo's own cache metadata and logs are not treated as package artifacts."*
 *
 * Applied by **naming** the paths rather than by declining to walk the directory, so what is excused
 * is enumerated and a build that hid an artifact beside a log is still reported.
 *
 * Why: that last clause was false until this predicate was narrowed. It tested
 * `segments.includes('.turbo')`, which excuses **every** path with a `.turbo` segment — so
 * `.turbo/stray.js` was discarded by the audit while the sentence above promised the opposite,
 * one line apart. Review round 4 of chore run 3 found it; the mutation below is what establishes
 * the sentence rather than restating it (*"A check is not established by reading it"*, 2026-08-29).
 *
 * **Two shapes, and both are measured rather than guessed** — the first narrowing of this predicate
 * named only the second and turned the audit's own clauses red, because it had been derived from
 * the per-package `.turbo` directories alone:
 *
 *   - `.turbo/cache/<hash>-manifest.json`, `-meta.json` and `.tar.zst` at the **workspace root**,
 *     which is the *cache metadata* half of AC-8's wording; and
 *   - `<package>/.turbo/turbo-<task>.log`, which is the *logs* half.
 *
 * Anything else under a `.turbo` directory is an artifact and is reported.
 */
const isTurboMetadata = (relative: string): boolean => {
  const segments = relative.split('/');
  const name = segments.at(-1) ?? '';
  if (segments.at(-2) === '.turbo') return /^turbo-[A-Za-z0-9_-]+\.log$/.test(name);
  return segments.at(-3) === '.turbo' && segments.at(-2) === 'cache'
    && /^[0-9a-f]+(-manifest\.json|-meta\.json|\.tar\.zst)$/.test(name);
};

/**
 * The four files that make a directory a pnpm-and-turbo workspace. Root `globalDependencies` are
 * copied beside them, read out of `turbo.json` rather than listed here, so a fifth arrives in the
 * isolated copy without anyone remembering.
 */
const WORKSPACE_FILES = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'turbo.json'];

/** Every tracked path under `directory`, which is the copy's source and therefore the commit's. */
const trackedUnder = (directory: string): string[] =>
  execFileSync('git', ['ls-files', '-z', '--', directory], {
    cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(Boolean);

const isolated: string[] = [];
afterAll(() => {
  for (const directory of isolated.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

/**
 * A copy of this workspace's build — the emitting packages' tracked files and the root configuration
 * turbo needs to plan one — in a temporary directory nothing else writes to.
 *
 * **Why a copy at all.** AC-8 asks what the build writes, and in the real checkout that question has
 * an exact answer only where nothing else is writing. `.git`, `.harness` and `.quorum` are entered
 * by a concurrent harness run, so auditing them *there* would be reading the machine rather than the
 * commit (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
 * 2026-08-30) — and excusing them by name, which is what this file did until this round, leaves a
 * build free to write into any of the three while the criterion reports exact agreement. Here
 * nothing else runs, so the audit prunes **nothing** and excuses only what AC-8 excuses in its own
 * words. The real-workspace proof R-4 and OQ-1 make load-bearing is kept separately beside it.
 *
 * Why: `requirements/errata.md` E-1 **rejected** this split and **E-2 withdraws E-1**, ruling that
 * the concurrency argument moves the observation rather than narrowing the criterion. Cited because
 * a reader meeting E-1 first would read this as contradicting a ruling — which a review round did.
 *
 * **Tracked files only**, so the copy is the commit rather than the checkout, and `dist/`, `.turbo/`,
 * `.harness/` and `.quorum/` are all gitignored and therefore none of them arrives to be mistaken
 * for something this build wrote. `node_modules` is mirrored as a real directory of symlinks rather
 * than as one link, so a write *under* it is a new entry rather than an invisible change behind a
 * leaf; the `@quorum` scope is re-pointed at the copy's own packages, which is what makes the copy
 * build itself rather than the tree it was taken from.
 */
function isolate(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-isolated-'));
  isolated.push(root);
  const copy = (relative: string): void => {
    const source = path.join(WORKSPACE, relative);
    // Refusing a missing corpus rather than building a workspace that is quietly short of a file:
    // turbo would report a plan nobody wrote and every clause below would be about it.
    if (!fs.existsSync(source)) throw new Error(`corpus missing: ${relative} — the isolated workspace cannot be built without it`);
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  };

  const tasks = emitting();
  for (const relative of [...WORKSPACE_FILES, ...(rootTurbo().globalDependencies ?? [])]) copy(relative);
  for (const task of tasks) {
    const tracked = trackedUnder(task.directory);
    if (tracked.length === 0) throw new Error(`git tracks nothing under ${task.directory} — the copy would hold no source to build`);
    for (const relative of tracked) copy(relative);
  }

  const directoryOf = new Map(tasks.map((task) => [task.package, task.directory]));
  for (const level of ['', ...tasks.map((task) => task.directory)]) {
    const source = path.join(WORKSPACE, level, 'node_modules');
    if (!fs.existsSync(source)) continue;
    const destination = path.join(root, level, 'node_modules');
    fs.mkdirSync(destination, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      if (name !== '@quorum') {
        fs.symlinkSync(path.join(source, name), path.join(destination, name));
        continue;
      }
      fs.mkdirSync(path.join(destination, name));
      for (const linked of fs.readdirSync(path.join(source, name))) {
        const directory = directoryOf.get(`@quorum/${linked}`);
        fs.symlinkSync(
          directory === undefined ? path.join(source, name, linked) : path.join(root, directory),
          path.join(destination, name, linked),
        );
      }
    }
  }
  return root;
}

/** Runs the real `build` in `cwd`, which is an isolated copy rather than this workspace. */
const buildIn = (cwd: string, ...flags: string[]): string =>
  execFileSync(turboBin(), ['run', 'build', ...flags], {
    cwd, encoding: 'utf8', env: turboEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });

describe('AC-7 — a build task exists, declares real outputs, and orders itself by dependency', () => {
  test('the root declares it beside the other three, with a non-empty outputs and a ^build edge', () => {
    const tasks = rootTurbo().tasks;
    expect(Object.keys(tasks).sort(), 'the root declares no build task').toContain('build');
    expect(Array.isArray(tasks.build.outputs)).toBe(true);
    expect(tasks.build.outputs?.length, 'an empty outputs replays a verdict, which is the thing build is not').toBeGreaterThan(0);
    // Asked as two questions, because `toContain` over an absent key reports an argument-type
    // complaint rather than the missing edge — measured by removing it, which is the only way to
    // find out what a guard says when it fires.
    expect(Array.isArray(tasks.build.dependsOn), 'the build task declares no dependsOn at all').toBe(true);
    expect(tasks.build.dependsOn, 'one root invocation must produce prerequisites before consumers').toContain('^build');
    // The constant this file deletes by, tied to the declaration so the two cannot name different
    // directories — under-declaring is the stale-artifact hazard and over-declaring the package
    // directory is refused (078(e)).
    for (const pattern of tasks.build.outputs ?? []) {
      expect(pattern.startsWith(`${EMIT}/`), `${pattern} is declared outside ${EMIT}/`).toBe(true);
    }
  });

  test('and no existing verdict moves behind it — the other three keep [] and gain no ^build', () => {
    // Clause (b) of decision 078, asserted rather than assumed: this is the property that keeps all
    // 1,520 existing tests proving TypeScript source.
    const tasks = rootTurbo().tasks;
    for (const name of ['lint', 'typecheck', 'test']) {
      expect(tasks[name].outputs, `${name} declares outputs — it replays an artifact now`).toStrictEqual([]);
      expect(tasks[name].dependsOn, `${name} gained a ^build edge`).not.toContain('^build');
    }
    // Q-0065: the one variable the workspace suite needs, still decided in the one place `env` is.
    expect(tasks.test.env).toStrictEqual(['QUORUM_REAL_CLI']);
  });

  test('and turbo resolves it that way too, which is where a package configuration could have added one', () => {
    // The clause above reads the root file, and the root file is not the only input to a resolved
    // definition: turbo merges each package's configuration over it. That merge is the one place a
    // `^build` edge could appear without the root ever mentioning one — so the ticket's central
    // safety property is asked of turbo rather than of the file it was written in.
    for (const task of dry('test').tasks) {
      expect(task.resolvedTaskDefinition.dependsOn, `${task.taskId} waits for a build`).not.toContain('^build');
      expect(task.resolvedTaskDefinition.outputs ?? [], `${task.taskId} replays an artifact`).toStrictEqual([]);
    }
  });

  test('turbo resolves the same definition for every emitting package', () => {
    // Read back through turbo rather than from the file, because a package configuration that
    // declared `outputs` would merge over the root's and no assertion on `turbo.json` would see it.
    const tasks = emitting();
    expect(tasks.length, 'no package builds — every assertion below would pass over nothing').toBeGreaterThan(0);
    // Sorted on both sides: turbo returns the resolved `outputs` in its own order, which is not the
    // order the file declares them in. Measured — a two-pattern declaration came back reordered —
    // so an order-sensitive comparison here would fail for a reason that is not the criterion's.
    const declared = [...(rootTurbo().tasks.build.outputs ?? [])].sort();
    for (const task of tasks) {
      expect([...(task.resolvedTaskDefinition.outputs ?? [])].sort(), `${task.taskId}`).toStrictEqual(declared);
      expect(task.resolvedTaskDefinition.dependsOn, `${task.taskId}`).toStrictEqual(['^build']);
    }
  });

  test('every package-level configuration declares inputs and no other key', () => {
    // Why: root `turbo.json` stays the one place `env` is decided, so the merge keeps
    // `QUORUM_REAL_CLI` (Q-0065) and no package can quietly give itself an `outputs`. Derived from
    // turbo's own package list — which names all seven, not only the three that emit — so a package
    // that adds a configuration later is covered without anyone remembering. The existence test is a
    // question about a tracked file and answers the same in every checkout of this commit, which is
    // the half of Q-0073's rule that stayed legal: what it must never depend on is a gitignored
    // directory that use creates.
    const configured = dry('build').tasks
      .map((task) => task.directory)
      .filter((directory) => fs.existsSync(path.join(WORKSPACE, directory, 'turbo.json')));
    expect(configured.length, 'no package declares a turbo.json — this test proves nothing').toBeGreaterThan(0);
    for (const directory of configured) {
      const config = parseTurboConfig(read(WORKSPACE, directory, 'turbo.json'), `${directory}/turbo.json`);
      for (const [name, definition] of Object.entries(config.tasks)) {
        expect(Object.keys(definition), `${directory}/turbo.json declares more than inputs on ${name}`).toStrictEqual(['inputs']);
      }
    }
  });

  test('and package.test.ts\'s guard on that still fires, which is why it is left untouched', () => {
    // Gate evidence rather than a guard edit (merged requirement R-7): decision 078(c) rules that
    // package configurations go on declaring `inputs` and nothing else, so
    // `package.test.ts:133-134`'s `not.toContain` pair is already the contract and replacing it
    // would invite a reviewer to read a correct guard as a moved one. Shown here to have a subject
    // by running its own expressions over a configuration that declares both.
    const offending = JSON.stringify({ tasks: { test: { inputs: ['$TURBO_DEFAULT$'], env: ['X'], outputs: ['dist/**'] } } }, null, 2);
    expect(offending).toContain('"env"');
    expect(offending).toContain('"outputs"');
    const shipped = read(PACKAGE, 'turbo.json');
    expect(shipped).not.toContain('"env"');
    expect(shipped).not.toContain('"outputs"');
  });
});

describe('AC-14 — the four places that could have grown a build phase did not, and why', () => {
  /** Every spelling of "run the build" that could appear in a script, a workflow or a command. */
  const INVOKES_BUILD = [/\bturbo\s+run\s+build\b/, /\bpnpm\s+build\b/, /\bnpm\s+run\s+build\b/, /\bpnpm\s+run\s+build\b/];

  test('the root package.json gains no build script, which is a ruling and not an oversight', () => {
    // `packages/core/src/test-command.test.ts:406` asserts that CI's `workspace` job runs exactly
    // the tasks the root scripts name, and its `WORKSPACE_TASKS` register is scoped by its own doc
    // comment to *"the workspace tasks CI's required check claims to have EXECUTED rather than
    // replayed"*. `build` is the first task in this workspace whose replay is **legitimate** — that
    // is the whole content of decision 078 — so it may not join a register whose stated meaning is
    // the opposite. A one-word edit here turns that guard red with a bare array comparison that does
    // not say why; this is the sentence saying why, in the ticket that would have caused it.
    const scripts = (JSON.parse(read(WORKSPACE, 'package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts.build, 'the root gained a build script — see test-command.test.ts:406 before adding one').toBeUndefined();
    expect(Object.keys(scripts).length, 'the root declares no scripts, so this proves nothing').toBeGreaterThan(3);
  });

  test('and neither CI, the harness commands nor the identity sweep runs one', () => {
    // The maintainer's "one command" is `pnpm turbo run build`, which needs no root script to work.
    // Nothing else needs to build at all, because no suite moves behind the artifact (078(b)) — so
    // `harness.yaml`'s `commands.install` and `commands.test`, CI's `workspace` job and the sweep's
    // five phases are all unchanged. Asserted rather than left unmentioned, so a later reader knows
    // the question was asked; under the rejected Shape B every one of them would have grown a phase.
    for (const [label, file] of [
      ['CI', '.github/workflows/ci.yml'],
      ['the harness commands', 'harness/harness.yaml'],
      ['the git-identity sweep', '.github/scripts/git-identity-sweep.sh'],
    ] as const) {
      const text = read(WORKSPACE, ...file.split('/'));
      for (const pattern of INVOKES_BUILD) {
        expect(pattern.test(text), `${label} grew a build phase (${pattern.source})`).toBe(false);
      }
    }
  });

  test('and that scan has a subject — it recognises a build invocation where one exists', () => {
    // Three of the four assertions above are negatives over files this ticket does not touch, so
    // without this they would be satisfied by a pattern set that matches nothing at all.
    expect(INVOKES_BUILD.some((pattern) => pattern.test('      - run: pnpm turbo run build --force\n'))).toBe(true);
    expect(INVOKES_BUILD.some((pattern) => pattern.test('  test: pnpm build && pnpm turbo run test --force'))).toBe(true);
    expect(INVOKES_BUILD.some((pattern) => pattern.test('# a comment about how the emit is built'))).toBe(false);
  });
});

describe('AC-8 — the declared outputs cover exactly what the build writes', () => {
  /**
   * Both directions of the criterion, over one package's package-relative write set.
   *
   * Direction 1: nothing the build wrote falls outside the declaration — an undeclared emit is the
   * stale-artifact hazard in its exact form, since turbo neither caches nor restores it, so a cache
   * hit yields a package missing a file something downstream executes. Direction 2: no declared
   * pattern matches nothing, which direction 1 cannot catch and which is a declaration nobody
   * re-read.
   */
  const agreesWithTheDeclaration = (label: string, mine: string[]): void => {
    const declared = rootTurbo().tasks.build.outputs ?? [];
    expect(mine.length, `${label} wrote nothing — its half of the enumeration has no subject`).toBeGreaterThan(0);
    expect(
      mine.filter((relative) => !declared.some((pattern) => path.matchesGlob(relative, pattern))),
      `${label} wrote paths no outputs pattern covers`,
    ).toStrictEqual([]);
    for (const pattern of declared) {
      expect(
        mine.some((relative) => path.matchesGlob(relative, pattern)),
        `${label}: the outputs pattern ${pattern} matches nothing the build wrote`,
      ).toBe(true);
    }
  };

  test('audited whole in an isolated copy, the build writes its emit and turbo\'s metadata and nothing else', () => {
    // Verified by building and enumerating, never by reading the declaration — "A check is not
    // established by reading it" (2026-08-29).
    //
    // **Nothing is pruned.** The walk descends into every directory the copy holds — `node_modules`
    // among them, and any `.git`, `.harness` or `.quorum` a build decides to create — and the one
    // exemption AC-8 grants is applied by NAMING turbo's metadata paths rather than by declining to
    // look at the directory holding them. Until this round those three names were on a prune list
    // instead, which is an exemption the criterion never granted: a build writing into any of them
    // was invisible while this test reported exact agreement. {@link isolate} carries why the
    // observation had to move rather than the prune list merely getting shorter, and the clause
    // after this one runs the case rather than describing it.
    const root = isolate();
    const before = inventory(root);
    expect(before.size, 'the isolated copy holds nothing — every clause below would be vacuous').toBeGreaterThan(0);
    // Paths *below* a `node_modules` segment rather than paths *containing* one: a mirror made as a
    // single symlink records the name itself as a leaf, which satisfies the weaker question while
    // descending into nothing. Measured — the weaker form passed the mutation that replaced the
    // directory of links with one link, which is this ticket's own defect class inside its own guard.
    const descended = [...before.keys()].filter((relative) => {
      const segments = relative.split('/');
      const at = segments.indexOf('node_modules');
      return at !== -1 && at < segments.length - 1;
    });
    expect(descended.length, 'the audit did not descend into the copy\'s node_modules, so it is pruning something after all').toBeGreaterThan(0);

    buildIn(root, '--force');
    // One `after`, read once and shared: two reads could disagree, and a comparison whose two halves
    // are taken against different states of the tree is one whose verdict has no single subject.
    const after = inventory(root);
    const written = writtenBetween(before, after);

    expect(written.length, 'the build wrote nothing anywhere — the enumeration has no subject').toBeGreaterThan(0);
    // A comparison of what CHANGED cannot see what stopped existing, so removal is asked separately
    // — and here it is asked of the whole copy rather than of a region.
    expect(removedBetween(before, after), 'the build removed a path from the workspace').toStrictEqual([]);

    const metadata = written.filter(isTurboMetadata);
    expect(metadata.length, 'turbo wrote no cache metadata, so the one exemption excuses nothing real').toBeGreaterThan(0);

    const tasks = emitting();
    const prefixes = tasks.map((task) => `${task.directory}/${EMIT}/`);
    expect(
      written.filter((relative) => !isTurboMetadata(relative) && !prefixes.some((prefix) => relative.startsWith(prefix))),
      `the build wrote outside every emitting package's ${EMIT}/`,
    ).toStrictEqual([]);

    for (const task of tasks) {
      // Package-relative, because `outputs` patterns are resolved against the package directory.
      agreesWithTheDeclaration(task.package, written
        .filter((relative) => relative.startsWith(`${task.directory}/${EMIT}/`))
        .map((relative) => relative.slice(task.directory.length + 1)));
    }
  }, 300_000);

  test('and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file', () => {
    // **The clause that makes the one above a check rather than a claim, and the reason the exact
    // audit is performed on a copy at all.** Those three names were excused by a prune list until
    // this round, on the ground that a concurrent harness run writes two of them — true, and an
    // argument for moving the observation, not for narrowing the criterion. Here the build script is
    // given exactly the behaviour the exclusion used to hide, and the audit is asked what it saw.
    //
    // The mutation is the emitting package's OWN build script, read out of the copy and appended to,
    // so what is exercised is a real build task writing where no criterion allows rather than a
    // fixture shaped to be caught.
    const root = isolate();
    const target = emitting()[0];
    const up = '../'.repeat(target.directory.split('/').length);
    // A file the copy holds and the build does not read, so removing it mid-build changes nothing
    // but the audit's answer. Asserted present rather than assumed: it arrives as a root
    // `globalDependencies` entry, and if that list stops naming it this clause must fail loudly
    // rather than prove nothing.
    const victim = 'eslint.config.js';
    expect(fs.existsSync(path.join(root, victim)), `${victim} is not in the copy — the removal clause would have no subject`).toBe(true);

    const manifestPath = path.join(root, target.directory, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { scripts: Record<string, string> };
    manifest.scripts.build += ` && mkdir -p ${up}.harness ${up}.quorum ${up}.git`
      + ` && echo stray > ${up}.harness/written && echo stray > ${up}.quorum/written && echo stray > ${up}.git/written`
      + ` && rm -f ${up}${victim}`;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const before = inventory(root);
    buildIn(root, '--force');
    const after = inventory(root);
    const prefixes = emitting().map((task) => `${task.directory}/${EMIT}/`);

    expect(
      writtenBetween(before, after)
        .filter((relative) => !isTurboMetadata(relative) && !prefixes.some((prefix) => relative.startsWith(prefix))),
      'the audit is blind to a build that writes into the three directories the pruned shape excused',
    ).toStrictEqual(['.git/written', '.harness/written', '.quorum/written']);
    expect(removedBetween(before, after), 'the audit is blind to a build that deletes a file').toStrictEqual([victim]);
  }, 300_000);

  test('and it reports an artifact hidden beside a turbo log, which the exemption used to swallow', () => {
    // The mutation review round 4 of chore run 3 asked for, and the one that establishes
    // `isTurboMetadata`'s doc comment instead of leaving it a promise. The predicate tested
    // `segments.includes('.turbo')`, so a build writing `.turbo/stray.js` was excused by a clause
    // whose stated purpose is to excuse turbo's logs and nothing else.
    //
    // Same shape as the sibling above: the emitting package's own build script is what writes the
    // file, so a real build task is doing something no criterion allows. The log beside it is
    // asserted to be excused in the same breath, because a predicate that reported BOTH would pass
    // this clause while breaking AC-8's one real exemption.
    const root = isolate();
    const target = emitting()[0];

    const manifestPath = path.join(root, target.directory, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { scripts: Record<string, string> };
    manifest.scripts.build += ' && mkdir -p .turbo && echo stray > .turbo/stray.js';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const before = inventory(root);
    buildIn(root, '--force');
    const written = writtenBetween(before, inventory(root));

    const prefixes = emitting().map((task) => `${task.directory}/${EMIT}/`);
    expect(
      written.filter((relative) => !isTurboMetadata(relative) && !prefixes.some((prefix) => relative.startsWith(prefix))),
      'an artifact hidden beside a turbo log is excused by the exemption instead of reported',
    ).toStrictEqual([`${target.directory}/.turbo/stray.js`]);
    expect(
      written.filter(isTurboMetadata).some((relative) => /\/\.turbo\/turbo-[A-Za-z0-9_-]+\.log$/.test(relative)),
      'the exemption stopped excusing turbo\'s own log, which is the one thing AC-8 allows it',
    ).toBe(true);
  }, 300_000);

  test('the real workspace builds, and its emit and the declaration agree in both directions', () => {
    // **Retained and load-bearing** (merged requirement R-4, OQ-1): with no build step in CI, the
    // forced workspace suite is the only thing that builds this repository's own packages on every
    // push, so an isolated-only AC-8 would leave the real emit unbuilt until Q-0098. What the copy
    // adds is exactness; what this adds is that the artifact everything downstream imports is the
    // one that was audited.
    //
    // Two regions, and between them no hand-written list of directory names to excuse. **Outside**
    // the emitting packages the observer is git, which lists neither `.git` nor `.harness` nor
    // `.quorum` nor `node_modules` — so a concurrent harness run cannot enter this audit rather than
    // having to be pruned out of it, which is the same oracle and the same reason as *"Membership is
    // a git question, not a filesystem one"* (2026-08-28). **Inside** them it is the walk, with
    // `node_modules` bounded by INSTALLED and turbo's metadata named rather than skipped. The region
    // neither reaches — a gitignored path outside an emitting package — is the one the isolated
    // audit above covers whole.
    //
    // Snapshotted AFTER the emit is removed, so `written` is what this build produced rather than
    // what this build produced *and an earlier one had not already left behind*. Taking it first
    // makes the difference empty in any checkout that has ever built, which is a test whose subject
    // depends on the checkout — the class this ticket keeps meeting.
    const tasks = emitting();
    const insideEach = (): Map<string, string>[] =>
      tasks.map((task) => inventory(path.join(WORKSPACE, task.directory), INSTALLED));

    removeEmit();
    const before = gitVisible(WORKSPACE);
    const beforeInside = insideEach();
    runBuild('--force');
    const after = gitVisible(WORKSPACE);
    const afterInside = insideEach();

    expect(before.size, 'git listed nothing — the outside half of this audit has no subject').toBeGreaterThan(0);
    // The emit is gitignored, so every path git can see is one the build has no business touching:
    // a file at the repository root, in `docs/`, in `spike/`, in a package that emits nothing, or in
    // another package's `src/`. The two untracked `tsc` outputs this ticket opened on —
    // `packages/shared/test/corpus.js` and `corpus.d.ts`, emitted beside their source because
    // nothing configured an `outDir` — are untracked and unignored, so they are exactly what git
    // reports here and what `.gitignore` did not save anyone from.
    expect(writtenBetween(before, after), 'the build wrote a file git can see, which its emit is not').toStrictEqual([]);
    expect(removedBetween(before, after), 'the build removed a file git can see').toStrictEqual([]);

    for (const [index, task] of tasks.entries()) {
      const written = writtenBetween(beforeInside[index], afterInside[index]);
      expect(removedBetween(beforeInside[index], afterInside[index]), `${task.package}: the build removed one of its own files`).toStrictEqual([]);
      expect(
        written.filter((relative) => !isTurboMetadata(relative) && !relative.startsWith(`${EMIT}/`)),
        `${task.package} wrote inside itself and outside ${EMIT}/`,
      ).toStrictEqual([]);
      agreesWithTheDeclaration(task.package, written.filter((relative) => relative.startsWith(`${EMIT}/`)));
    }
  }, 300_000);

  test('and the outside observer has a subject, and is blind to exactly what the copy covers', () => {
    // Three claims the real-workspace audit rests on, demonstrated rather than described, over a
    // repository this test builds itself — which `harness/rules.md` permits and which needs no
    // commit, so no identity is resolved and nothing about the machine can decide the verdict
    // (Q-0079).
    //
    //   1. git reports an overwrite of a file it tracks, and a new unignored file — the outside
    //      half's oracle, exercised through the shipped {@link gitVisible} rather than a copy of it;
    //   2. git is blind to a gitignored path, which is *why* no prune list has to name `.harness` or
    //      `.quorum` and why a run happening beside this test cannot decide its verdict;
    //   3. the same path IS visible to the unpruned walk, which is what the isolated audit uses, so
    //      the region git cannot see is covered there rather than excused anywhere.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-observer-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
      fs.writeFileSync(path.join(sandbox, '.gitignore'), '.harness/\n');
      fs.writeFileSync(path.join(sandbox, 'tracked.txt'), 'before\n');
      execFileSync('git', ['add', '.'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });

      const before = gitVisible(sandbox);
      expect([...before.keys()].sort(), 'the fixture is not staged, so the comparison below starts empty')
        .toStrictEqual(['.gitignore', 'tracked.txt']);

      fs.writeFileSync(path.join(sandbox, 'tracked.txt'), 'after\n');
      fs.writeFileSync(path.join(sandbox, 'untracked.txt'), 'new and unignored\n');
      fs.mkdirSync(path.join(sandbox, '.harness', 'worktrees'), { recursive: true });
      fs.writeFileSync(path.join(sandbox, '.harness', 'worktrees', 'concurrent'), 'a run happening beside the build\n');

      expect(writtenBetween(before, gitVisible(sandbox)), 'git no longer reports a write it can see')
        .toStrictEqual(['tracked.txt', 'untracked.txt']);
      expect(filesUnder(sandbox), 'the unpruned walk cannot see the path git is blind to either')
        .toContain('.harness/worktrees/concurrent');
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  }, 120_000);

  test('and the write set is one a name-only, per-package snapshot could not have produced', () => {
    // **The subject of the clause above, exhibited rather than asserted.** Three writes in a sandbox
    // shaped like the workspace, of which a comparison of path names taken per emitting package sees
    // exactly one:
    //
    //   1. a new file under the package's emit — visible to both shapes;
    //   2. an OVERWRITE of a tracked source that was already there — invisible to a name-only
    //      snapshot, because the path is in `before` and the difference subtracts it;
    //   3. a file written OUTSIDE the package root — invisible to a per-package walk, because the
    //      walk is never pointed at it.
    //
    // Both oracles are run over the same event, so this fails if the fingerprint stops covering
    // content or the walk stops starting above the package, and it fails the other way — as a false
    // claim about the old shape — if the old shape would in fact have caught 2 or 3. It is what the
    // isolated audit's whole-copy walk rests on, and what the real workspace's outside half asks git
    // instead.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-write-set-'));
    try {
      const pkg = path.join(sandbox, 'packages', 'emitter');
      fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
      fs.mkdirSync(path.join(pkg, EMIT), { recursive: true });
      fs.writeFileSync(path.join(pkg, 'src', 'a.ts'), 'export const a = 1;\n');
      fs.writeFileSync(path.join(sandbox, 'README.md'), 'before\n');

      const before = inventory(sandbox);
      const namesBefore = new Set(filesUnder(pkg));

      fs.writeFileSync(path.join(pkg, EMIT, 'a.js'), 'export const a = 1;\n');
      fs.writeFileSync(path.join(pkg, 'src', 'a.ts'), 'export const a = 2;\n');
      fs.writeFileSync(path.join(sandbox, 'stray.txt'), 'written by the build\n');

      expect(writtenBetween(before, inventory(sandbox)), 'the fingerprint no longer sees all three writes').toStrictEqual([
        `packages/emitter/${EMIT}/a.js`,
        'packages/emitter/src/a.ts',
        'stray.txt',
      ]);

      // What the shape this replaced would have reported, run rather than described: the same event,
      // through a per-package walk comparing names alone.
      expect(
        filesUnder(pkg).filter((relative) => !namesBefore.has(relative)),
        'a name-only per-package snapshot now sees more than the one write it can see, so this comparison proves nothing',
      ).toStrictEqual([`${EMIT}/a.js`]);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('and the four names that left the exclusion list are back in scope, while the one that stayed is not', () => {
    // **What the change of observation bought, priced rather than asserted.** The audit's reach used
    // to be everything except `node_modules`, `.git`, `.turbo`, `.harness` and `.quorum`; four of
    // those five are exemptions AC-8 never granted, and a build writing into one of them was
    // invisible while the criterion reported exact agreement.
    //
    // Only `node_modules` is still pruned, and only where the walk is pointed at the real checkout
    // (INSTALLED), for the measured reason in its own doc comment. So the four are shown to be
    // audited now, and the one is shown to be pruned there and audited in the copy — which is the
    // difference between a bound and a blind spot, run rather than described. A fixture per name,
    // derived from the list rather than written out, so a name that rejoins arrives with a subject
    // or fails (Q-0073, "a count is not an identity"; Q-0071, showing a guard fires proves the guard
    // fires and not that each clause does).
    const RESTORED = ['.git', '.turbo', '.harness', '.quorum'];
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-reach-'));
    try {
      fs.writeFileSync(path.join(sandbox, 'kept.txt'), 'before\n');
      const before = inventory(sandbox);
      for (const name of [...RESTORED, ...INSTALLED]) {
        fs.mkdirSync(path.join(sandbox, name, 'nested'), { recursive: true });
        fs.writeFileSync(path.join(sandbox, name, 'nested', 'written.txt'), 'during\n');
      }
      fs.writeFileSync(path.join(sandbox, 'kept.txt'), 'after\n');

      expect(INSTALLED, 'the real-workspace walk prunes more than the install').toStrictEqual(['node_modules']);
      expect(RESTORED, 'the four names the observation moved for are no longer the four this prices')
        .toStrictEqual(['.git', '.turbo', '.harness', '.quorum']);

      // The unpruned audit — the one {@link isolate} uses — reports every one of the five.
      const unpruned = writtenBetween(before, inventory(sandbox));
      for (const name of [...RESTORED, ...INSTALLED]) {
        expect(unpruned, `${name} is excused by the audit that claims to prune nothing`).toContain(`${name}/nested/written.txt`);
      }

      // The real-workspace walk reports the four and not the install, which is the whole of what
      // still costs anything.
      const pruned = writtenBetween(before, inventory(sandbox, INSTALLED));
      expect(pruned, 'the real-workspace walk no longer sees the four names it stopped excusing').toStrictEqual([
        ...RESTORED.map((name) => `${name}/nested/written.txt`).sort(),
        'kept.txt',
      ].sort());
      for (const name of INSTALLED) {
        expect(pruned, `${name} prunes nothing there — dropping it from the list would change no answer`)
          .not.toContain(`${name}/nested/written.txt`);
      }
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('the emit carries the declarations the export maps promise', () => {
    // `packages/cli/src/package.test.ts:193-194` already pins `@quorum/core`'s `default` as
    // `./dist/index.js` and its `types` as `./dist/index.d.ts`, and Q-0097 AC-22 gives
    // `@quorum/shared` the same pair. A manifest promising a `.d.ts` the build does not write is an
    // export map that typechecks nothing outside this workspace.
    for (const task of emitting()) {
      const entry = ((JSON.parse(read(WORKSPACE, task.directory, 'package.json')) as {
        exports?: Record<string, Record<string, unknown>>;
      }).exports ?? {})['.'];
      if (entry === undefined) continue;
      for (const key of ['types', 'default']) {
        const promised = entry[key];
        if (typeof promised !== 'string') continue;
        expect(
          fs.existsSync(path.join(WORKSPACE, task.directory, promised)),
          `${task.package} promises ${key} at ${promised} and the build does not write it`,
        ).toBe(true);
      }
    }
  });

  test('and no *.tsbuildinfo is produced, because a gitignored output the declaration omits is under-declaration', () => {
    // `.gitignore:9` ignores `*.tsbuildinfo`, so an `incremental` or `composite` build would emit a
    // file the `outputs` declaration does not name and nothing would report it. Refused in the three
    // `tsconfig.build.json` files by leaving both options off, and asserted rather than trusted.
    for (const task of emitting()) {
      const stale = filesUnder(path.join(WORKSPACE, task.directory), INSTALLED).filter((relative) => relative.endsWith('.tsbuildinfo'));
      expect(stale, `${task.package} emits build metadata the declaration does not cover`).toStrictEqual([]);
    }
  });
});

/**
 * The public API, read out of the two registers that already hold it rather than retyped.
 *
 * `frame.source.test.ts`'s `DOMAIN` is the list of helpers the frame is forbidden to reimplement,
 * and `package.test.ts`'s `ERRORS` is the three classes a caller catches. `package.test.ts` already
 * asserts the barrel exports exactly their union when Vitest resolves the **source**; AC-9 asks the
 * same question of the **emitted** artifact, in a plain `node` process that knows no workspace
 * condition. Deriving keeps one source of truth: two hand-written copies of one list is the
 * transcription defect this repository keeps paying for.
 */
function publicApi(): string[] {
  const names = (text: string, register: string): string[] => {
    // Both registers are matched with their indentation open, because one is at module scope and the
    // other sits inside a `describe` block — an anchor that assumed either would silently yield an
    // empty list, which the throw below is what catches.
    const block = new RegExp(`\\n\\s*const ${register} = \\[([\\s\\S]*?)\\];`).exec(text)?.[1] ?? '';
    return [...block.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)].map((match) => match[1]);
  };
  const domain = names(read(PACKAGE, 'src', 'frame.source.test.ts'), 'DOMAIN');
  const errors = names(read(PACKAGE, 'src', 'package.test.ts'), 'ERRORS');
  if (domain.length === 0 || errors.length === 0) {
    throw new Error(`the public-API registers yielded ${domain.length} domain and ${errors.length} error names — a regex that matched nothing would make AC-9 vacuous`);
  }
  return [...domain, ...errors].sort();
}

/** Evaluates `source` in a plain `node` process rooted at `cwd`, and reports what happened. */
const inPlainNode = (cwd: string, source: string): { code: string; message: string; value: string } => {
  const script = `try { const v = ${source}; console.log(JSON.stringify({ code: 'RESOLVED', message: '', value: typeof v === 'string' ? v : '' })) }`
    + ' catch (e) { console.log(JSON.stringify({ code: e.code ?? "", message: e.message, value: "" })) }';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd, encoding: 'utf8' });
  return JSON.parse(out) as { code: string; message: string; value: string };
};

describe('AC-9 — a replayed build is executable, and AC-22\'s chain runs end to end', () => {
  test('a cache hit restores an artifact a plain node process can import and use', () => {
    // The property no task in this workspace has ever needed: all three existing tasks declare
    // `"outputs": []` and replay a verdict, so nothing has ever had to give bytes back.
    runBuild('--force');
    removeEmit();
    for (const task of emitting()) {
      expect(fs.existsSync(path.join(WORKSPACE, task.directory, EMIT)), `${task.package} still has its emit — the replay proves nothing`).toBe(false);
    }

    const replayed = runBuild();
    for (const task of emitting()) {
      const summary = replayed.find((entry) => entry.taskId === task.taskId);
      // Turbo's machine-readable summary is the oracle. Output text is not, and neither is timing:
      // a `FULL TURBO` line is a rendering of this field and a fast run is not evidence of anything.
      expect(summary?.cache?.status, `${task.taskId} was not a cache hit, so nothing was restored`).toBe('HIT');
      expect(fs.existsSync(path.join(WORKSPACE, task.directory, EMIT)), `${task.package}: the hit restored no artifact`).toBe(true);
    }

    // Spawned from `packages/cli` because that is where the `@quorum/core` link lives: measured from
    // the workspace root the failure is "package not found", which is a different fact.
    //
    // This is AC-22's integration proof as well as AC-9's. `packages/cli/dist/index.js` has no
    // runtime workspace dependency today (078(g)), so importing it would pass while
    // `@quorum/shared`'s manifest still resolved Node to TypeScript source; importing `@quorum/core`
    // exercises the whole chain — `core/dist/index.js` → `@quorum/shared` → `shared/dist/index.js`.
    //
    // A `RESOLVED`-only assertion would not be enough: `import.meta.resolve` answers from the
    // manifest without the target existing, which is exactly why Q-0096 used it and exactly why this
    // ticket may not.
    const result = inPlainNode(PACKAGE, "Object.keys(await import('@quorum/core')).sort().join(',')");
    expect(result.code, `importing the emitted artifact failed: ${result.message}`).toBe('RESOLVED');
    expect(result.value.split(','), 'the restored artifact does not export the public API').toStrictEqual(publicApi());
  }, 300_000);

  test('and the emitted artifact loads without a TypeScript loader or the workspace condition', () => {
    // The two things the emit exists to be free of. `--conditions` is not passed and no loader is
    // registered, so what runs is the `default` branch of both export maps and plain JavaScript.
    const resolved = inPlainNode(PACKAGE, "import.meta.resolve('@quorum/core')");
    expect(resolved.code, resolved.message).toBe('RESOLVED');
    expect(resolved.value.endsWith(`/${EMIT}/index.js`), `resolved to ${resolved.value}`).toBe(true);
    const shared = inPlainNode(path.join(WORKSPACE, 'packages', 'core'), "(await import('@quorum/shared')).STAGES.length");
    expect(shared.code, `AC-22: the emitted core cannot reach shared: ${shared.message}`).toBe('RESOLVED');
  }, 120_000);
});

describe('AC-12 — the artifact is invisible to every source scan', () => {
  test('git ignores the emit, and attributes it to the rule that does so', () => {
    // Three of the four `dist`-awareness sites already held before this ticket and are asserted with
    // their reasoning, so a later reader knows the question was asked rather than missed. The fourth
    // — `frame.source.test.ts`'s `GENERATED` register — failed closed and is fixed in that file.
    runBuild();
    const emitted = path.join(EMIT, 'index.js');
    const attribution = execFileSync('git', ['check-ignore', '-v', `packages/cli/${emitted}`], {
      cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(attribution, 'the emit is ignored by some other rule than the one .gitignore declares for it')
      .toMatch(/^\.gitignore:\d+:dist\/\s/);
  }, 300_000);

  test('eslint ignores it, so emitted JavaScript is never linted', () => {
    expect(read(WORKSPACE, 'eslint.config.js'), 'the emit would be linted, and the type-aware rule has no project for it')
      .toContain(`'**/${EMIT}/**'`);
  });

  test('and the git-identity walk prunes it by name, so a scan cannot read an emitted copy of itself', () => {
    // `packages/core/src/git-identity.test.ts` scans for commit-creating git calls in test sources.
    // An emitted copy of a test file would be scanned twice and reported twice; the walk skipping
    // the directory is what makes that impossible, and it is asserted here because that file's own
    // suite has no reason to assert why the name is in its walk.
    expect(read(WORKSPACE, 'packages', 'core', 'src', 'git-identity.test.ts'))
      .toMatch(new RegExp(`entry\\.name === '${EMIT}'`));
  });
});

/**
 * What Vitest collects, as **both** halves of the question rather than the include alone.
 *
 * A set built by matching the include is not the collected set: `vitest.shared.js` declares an
 * `exclude` as well, and it is the exclude that decides an emitted test file under `dist/`. A
 * comparison that filtered candidates by extension, or by the include alone, could never place an
 * emitted `.js` on either side of itself — so it would go on passing with the `dist` exclusion
 * removed, which is the state it exists to refuse.
 *
 * **Read out of `vitest.shared.js` rather than retyped or taken from Vitest's defaults**, for the
 * reason `packages/core/test/vitest-include.ts` gives about the include: taking the defaults
 * directly would leave every clause below green over a configuration whose exclusion had been
 * deleted. That module asks the include half for the two guards in `core` and cannot be imported
 * here — `@quorum/core` publishes `"."` and no subpath (Q-0096 AC-5) — so the shape of its reader is
 * mirrored instead, refusal included: a declaration this reader cannot resolve **stops the guard**
 * rather than resolving to a default nobody wrote.
 *
 * The remaining option, spawning Vitest and asking it what it collects, is refused for the reason
 * `packages/core/src/test-command.test.ts:129-158` gives for its own fixture — *"running this
 * repository's own suite instead would make the check spawn the run it is running inside"* — and
 * because it could not be asked the counterfactual at all: the clauses below turn on what the
 * collection would be with the exclusion removed.
 */
function collection(): { include: readonly string[]; exclude: readonly string[] } {
  const text = read(WORKSPACE, 'vitest.shared.js');
  if (!/import\s*\{[^}]*\bconfigDefaults\b[^}]*\}\s*from\s*'vitest\/config'/.test(text)) {
    throw new Error("vitest.shared.js does not import configDefaults from 'vitest/config' — the patterns below would be ones nobody wrote");
  }
  if (!/include:\s*\[\s*\.\.\.configDefaults\.include\s*,?\s*\]/.test(text)) {
    throw new Error('vitest.shared.js declares an include this reader cannot resolve — a narrowing must stop this guard, not pass it');
  }
  const declared = /exclude:\s*\[\s*\.\.\.configDefaults\.exclude\s*((?:,\s*'[^'\n]+')*)\s*,?\s*\]/.exec(text);
  if (declared === null) {
    throw new Error('vitest.shared.js declares an exclude this reader cannot resolve — the emit exclusion is what AC-23 turns on');
  }
  const include = [...(configDefaults.include ?? [])];
  const exclude = [...(configDefaults.exclude ?? []), ...[...declared[1].matchAll(/'([^'\n]+)'/g)].map((match) => match[1])];
  if (include.length === 0 || exclude.length === 0) {
    throw new Error(`vitest declares ${include.length} include and ${exclude.length} exclude patterns — the criterion would be vacuous`);
  }
  return { include, exclude };
}

/**
 * Whether Vitest collects `relative`, which is a path below a **package** root — each package's
 * Vitest run is rooted at its own directory, so a repository-relative path answers a different
 * question. Included and not excluded, which is the rule Vitest itself applies.
 */
const collects = (relative: string, { include, exclude }: { include: readonly string[]; exclude: readonly string[] }): boolean =>
  include.some((pattern) => path.matchesGlob(relative, pattern))
  && !exclude.some((pattern) => path.matchesGlob(relative, pattern));

describe('AC-23 — the emit contains nothing Vitest collects', () => {
  test('the configuration is the one every package resolves, and the reader refuses a shape it cannot resolve', () => {
    const shared = read(WORKSPACE, 'vitest.shared.js');
    expect(shared).toContain(`import { configDefaults, defineConfig } from 'vitest/config';`);
    // Defence in depth, and deliberately NOT a narrowing of the include: that file's header states
    // the include is taken by reference and "deliberately not narrowed", and
    // `packages/core/src/test-discovery.test.ts` reads that declaration and refuses a narrowing.
    // Widening the EXCLUDE leaves every discovery guarantee intact — a red phase writes TypeScript
    // under `src/` or `test/`, never under a gitignored emit directory.
    expect(collection().exclude, 'the emit exclusion is gone from the one shared configuration').toContain(`**/${EMIT}/**`);
    expect(configDefaults.exclude ?? [], 'Vitest\'s own defaults already excluded the emit, so the criterion has no subject')
      .not.toContain(`**/${EMIT}/**`);
  });

  test('an emitted test file is collected without the exclusion and not with it — the fifth dist site, both ways', () => {
    // **Shown red first, over real files.** `configDefaults.include` matches `.js` as well as `.ts`
    // and Vitest's own `exclude` is `node_modules` and `.git` only, so before this ticket an emitted
    // `dist/**/*.test.js` was COLLECTED AND EXECUTED — from a directory at a different depth from its
    // source, which makes every path such a test derives from its own location wrong. It fails worse
    // than AC-12's site: the file does not merely get scanned, it runs.
    //
    // Both directions over one sandbox, so neither can be satisfied by a walk that collects nothing,
    // and the emitted files are real rather than strings handed to a matcher — a candidate set built
    // by extension or by the include alone could not put one on either side of a comparison.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-collect-'));
    try {
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.mkdirSync(path.join(sandbox, EMIT, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(sandbox, 'src', 'a.test.ts'), 'export const a = 1;\n');
      fs.writeFileSync(path.join(sandbox, EMIT, 'x.test.js'), 'export const x = 1;\n');
      fs.writeFileSync(path.join(sandbox, EMIT, 'nested', 'y.test.js'), 'export const y = 1;\n');
      fs.writeFileSync(path.join(sandbox, EMIT, 'index.js'), 'export const i = 1;\n');

      const configured = collection();
      const withoutTheExclusion = { ...configured, exclude: configured.exclude.filter((pattern) => pattern !== `**/${EMIT}/**`) };
      const collectedUnder = (patterns: typeof configured): string[] =>
        filesUnder(sandbox).filter((relative) => collects(relative, patterns)).sort();

      expect(collectedUnder(withoutTheExclusion), 'an emitted test file is not collected even without the exclusion — this proves nothing')
        .toStrictEqual([`${EMIT}/nested/y.test.js`, `${EMIT}/x.test.js`, 'src/a.test.ts']);
      expect(collectedUnder(configured), 'the exclusion does not reach an emitted test file')
        .toStrictEqual(['src/a.test.ts']);
      expect(withoutTheExclusion.exclude.length, 'the counterfactual removed nothing, so both sides are the same configuration')
        .toBe(configured.exclude.length - 1);

      // **And the shape this replaced, run rather than described.** The present/absent clause below
      // filtered candidates by the `.test.ts` suffix until this round, which no emitted file can
      // carry — `tsc` writes `.js` — so an emitted test file could not reach either side of that
      // comparison and it went on passing with the exclusion deleted. Shown here to answer the same
      // sandbox with the same list under both configurations, which is what makes it blind rather
      // than merely narrower.
      const bySuffix = filesUnder(sandbox).filter((relative) => relative.endsWith('.test.ts')).sort();
      expect(bySuffix, 'the suffix filter sees an emitted test file, so it was not the defect it is replaced for')
        .toStrictEqual(['src/a.test.ts']);
      expect(collectedUnder(withoutTheExclusion), 'the configured collection is blind to the emit too — the fix changed nothing')
        .not.toStrictEqual(bySuffix);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('and the build emits no file the include matches — the primary mechanism, which is that none exists', () => {
    // The include ALONE here, deliberately: the criterion's first clause is that nothing Vitest
    // would want to collect is emitted at all, which each emitting package's `tsconfig.build.json`
    // secures by excluding `src/**/*.test.ts`. Applying the exclude too would make this vacuous —
    // `**/dist/**` would answer for every path under the emit.
    runBuild();
    const { include } = collection();
    for (const task of emitting()) {
      const matched = filesUnder(path.join(WORKSPACE, task.directory, EMIT))
        .filter((relative) => include.some((pattern) => path.matchesGlob(relative, pattern)));
      expect(matched, `${task.package} emits files Vitest would collect and run`).toStrictEqual([]);
    }
  }, 300_000);

  test('the collected set is identical with the artifact present and absent, and the emit is on both sides of the question', () => {
    // The same present-and-absent shape AC-12 uses, which is what makes both of them checks rather
    // than assertions of intent: whether this checkout has run a build may not move any verdict
    // (078(b)). Over the REAL package, and over EVERY file it carries — the walk does not prune the
    // emit, so an emitted `.js` is a candidate, and the include and the exclude are both applied to
    // it. A comparison of `.test.ts` names could not have been moved by the emit whatever the
    // configuration said, so it would have passed with the exclusion deleted.
    //
    // A `dist/x.test.js` is planted for the duration, because the real emit carries no file the
    // include matches — so without one the equality would hold for the trivial reason and the
    // clauses below would have nothing to discriminate. It is written inside the gitignored emit,
    // which is a directory this file legitimately writes, and the next build's `rm -rf dist` clears
    // it even if this test dies before its `finally`.
    const configured = collection();
    // `INSTALLED` because this package's own `node_modules` holds Vitest's cache, which the process
    // running this test writes: a walk that descended would report a difference between the two
    // states that is the runner's rather than the emit's.
    const candidates = (): string[] => filesUnder(PACKAGE, INSTALLED);
    const collected = (patterns = configured): string[] => candidates().filter((relative) => collects(relative, patterns)).sort();

    runBuild();
    const planted = path.join(PACKAGE, EMIT, 'x.test.js');
    const withPlanted = <T>(ask: () => T): T => {
      fs.writeFileSync(planted, 'export const planted = 1;\n');
      try {
        return ask();
      } finally {
        fs.rmSync(planted, { force: true });
      }
    };

    const { built, builtCandidates } = withPlanted(() => {
      // The counterfactual, on the real tree: with the exclusion removed the planted file IS
      // collected, so it genuinely reaches both sides of the comparison below.
      expect(
        collected({ ...configured, exclude: configured.exclude.filter((pattern) => pattern !== `**/${EMIT}/**`) }),
        'the planted emitted test is collected by nothing even without the exclusion — the comparison below is vacuous',
      ).toContain(`${EMIT}/x.test.js`);
      return { built: collected(), builtCandidates: candidates() };
    });

    removeEmit();
    const unbuiltCandidates = candidates();
    const unbuilt = collected();
    runBuild();

    expect(built, 'the emit changes what Vitest collects in this package').toStrictEqual(unbuilt);
    // And the equality is not the walk failing to see the emit: the candidate sets DO differ, every
    // path by which they differ is under the emit, and the planted test file is among them.
    const extra = builtCandidates.filter((relative) => !unbuiltCandidates.includes(relative));
    expect(extra.length, 'the walk sees no emitted file at all, so the equality above says nothing').toBeGreaterThan(0);
    expect(extra.filter((relative) => !relative.startsWith(`${EMIT}/`)), 'the two states differ outside the emit').toStrictEqual([]);
    expect(extra, 'the planted emitted test never entered the candidate set').toContain(`${EMIT}/x.test.js`);
  }, 300_000);
});

/* ---------------------------------------------------------------------------------------------
 * Q-0098 — `quorum` is a runnable binary.
 *
 * **Why these live in this file rather than in one of their own.** Every assertion below spawns or
 * packs the REAL `packages/cli/dist`, and this file deletes that directory twice — AC-9's replay and
 * AC-23's present-and-absent comparison both call {@link removeEmit}. `vitest.shared.js` sets no
 * `fileParallelism: false`, so Vitest runs test *files* in parallel workers and `test.sequential`
 * does not serialise across them: a separate file spawning the same path would intermittently meet
 * an emit that had just been removed, and the flake would read as a code defect rather than as a
 * fixture defect. Q-0098's merged requirement measures this (§3 M-12) and names exactly two safe
 * shapes in AC-15(c) — assert inside an isolated copy, or put the real-workspace assertions here.
 * Both are used below, and no third "run the build" mechanism is introduced: {@link isolate},
 * {@link buildIn}, {@link runBuild} and {@link removeEmit} are the ones this file already owns, and
 * nothing was extracted from it.
 *
 * Tests within one file run sequentially, but each block that needs the artifact calls
 * {@link runBuild} for itself rather than inheriting one — a cache hit costs milliseconds, and a
 * verdict that depended on which test ran first would be a property of the ordering.
 * ------------------------------------------------------------------------------------------- */

/** This package's own manifest, which is where the `bin` target is resolved from and never inlined. */
const ownManifest = (): { bin?: Record<string, string>; files?: string[] } =>
  JSON.parse(read(PACKAGE, 'package.json')) as { bin?: Record<string, string>; files?: string[] };

/**
 * The absolute path of the file `bin.quorum` names.
 *
 * Resolved from the manifest on every call rather than written down, because AC-26 leaves the choice
 * between an emitted and a tracked target local to this package: a suffix or a location pinned in a
 * test would make that choice unreviewable, which is the reasoning `package.test.ts:63`'s own block
 * already carries.
 */
const binTarget = (): string => {
  const declared = ownManifest().bin?.quorum;
  if (declared === undefined || declared === '') throw new Error('package.json declares no bin.quorum — every assertion below would be about nothing');
  return path.resolve(PACKAGE, declared);
};

/** The command names {@link HELP} lists, derived from the help text rather than transcribed. */
const helpNames = (text: string): string[] => [...text.matchAll(/^ {2}quorum (\S+)/gm)].map((match) => match[1]);

/**
 * Whether this platform carries POSIX permission bits, and therefore whether `mode & 0o111` is a
 * question that can be asked at all.
 *
 * It decides whether a check **runs** and never what one answers: a machine property may shape a
 * fixture or refuse a check and may never be the oracle (`harness/rules.md`; *"A test's verdict is a
 * property of the commit, not of the checkout or the account"*, 2026-08-30).
 */
const POSIX_MODES = process.platform !== 'win32';

/**
 * The words the runner shows where a mode-bit check could not run.
 *
 * Carried by Vitest's own reporting rather than by an assertion message, which is shown only when an
 * assertion fails: `ctx.skip(condition, note)` where a whole test loses its subject, so the report
 * says **skipped** and names the unavailable check, and `ctx.annotate(note)` where only part of one
 * does. That is AC-16's *"skipped and says so … never a silent pass"*. An early `return`, or an
 * `expect` restating the condition it is already inside, reports **passed** over a subject nothing
 * examined — *"a check that skips its subject must not report success"* (2026-08-25).
 */
const NO_POSIX_MODES = `POSIX mode bits are unavailable on ${process.platform}, so the executable bit cannot be asserted`;

describe('Q-0098 AC-26 — the target sits one directory below the package root', () => {
  test('so path.join(here, \'..\') resolves to the package root, which is where the templates go', () => {
    // The ruled constraint, made arithmetic. `spike/bin/harness.js:321` resolves the shipped
    // templates as `path.join(here, '..', 'templates', 'harness')` — relative to the binary's own
    // file — so Q-0093's `init` reads them from whatever `path.join(here, '..')` is. This is
    // "The emit serves the binary, and no test verdict moves behind it" (2026-09-02) clause (e),
    // which fixes the depth so Q-0093 inherits it rather than discovering it.
    //
    // The property asserted is the resolution itself and not a segment count. Q-0098's AC-26 words
    // it as "`path.relative(PACKAGE, target)` has exactly one path segment"; measured, that is
    // `dist/quorum.js`, which splits into two — so the literal wording is satisfied only by a target
    // at the package root and contradicts the criterion's own admissibility table, which lists
    // `dist/quorum.js` as admissible. What both readings agree on, and what Q-0093 actually depends
    // on, is the line below. An erratum ruling the wording is owed and is reported at the gate: an
    // implement step may not write `backlog/`.
    const target = binTarget();
    expect(path.resolve(path.dirname(target), '..')).toBe(path.resolve(PACKAGE));
    expect(fs.existsSync(target), `${target} is not a file — bin.quorum names something that is not there`).toBe(true);
  });

  test('and that arithmetic refuses the shape decision 078(e) rules out', () => {
    // Shown to discriminate rather than asserted. `dist/bin/quorum.js` is the refused candidate: it
    // would put the shipped templates at `packages/cli/dist/templates/`, inside the directory this
    // package's own build script deletes with `rm -rf dist` on every run.
    const parentOf = (relative: string): string => path.resolve(path.dirname(path.resolve(PACKAGE, relative)), '..');
    expect(parentOf('./dist/quorum.js'), 'an emitted target one level down is admissible').toBe(path.resolve(PACKAGE));
    expect(parentOf('./bin/quorum.js'), 'a tracked launcher one level down is admissible').toBe(path.resolve(PACKAGE));
    expect(parentOf('./dist/bin/quorum.js'), 'two levels down must not satisfy the constraint').not.toBe(path.resolve(PACKAGE));
  });

  test('the recorded choice is the emitted target, and its source carries the reason Q-0093 reads', () => {
    // AC-26 requires the number and its consequence to be written where Q-0093 will look — in the
    // target's own JSDoc — citing the entry by title and date. Asserted over the SOURCE, because the
    // emitted file is what a reader of the package never edits.
    const source = read(PACKAGE, 'src', 'quorum.ts');
    expect(source).toContain('The emit serves the binary, and no test verdict moves behind it');
    expect(source).toContain('2026-09-02');
    expect(source).toContain("path.join(here, '..')");
  });
});

describe('Q-0098 AC-15 — the target runs under plain node and exits 0', () => {
  test('spawned from the manifest\'s own target, it prints the help and exits 0', () => {
    // The spawn is `process.execPath` with no `--conditions`, no loader and no `quorum-source`: what
    // runs is the `default` branch of every export map and plain JavaScript, which is 078(b) applied
    // to the binary. The command list is DERIVED from `HELP` rather than transcribed, so a command
    // added by Q-0091 to Q-0094 is covered without anyone remembering.
    runBuild();
    const target = binTarget();
    const stdout = execFileSync(process.execPath, [target, 'help'], { cwd: PACKAGE, encoding: 'utf8' });
    const names = helpNames(HELP);
    expect(names.length, 'the help lists no command — the loop below would be vacuous').toBeGreaterThan(0);
    for (const name of names) expect(stdout, `the binary's help does not list ${name}`).toContain(name);
    expect(stdout).toContain('usage: quorum <command> [options]');
  }, 300_000);

  test('and a non-zero status is what a caller would see if it failed, so the 0 above is a fact', () => {
    // Without this the assertion above could not distinguish "exited 0" from "execFileSync did not
    // report a status at all". `execFileSync` throws on a non-zero exit, so the discriminator is a
    // spawn that is known to fail.
    expect(() => execFileSync(process.execPath, [path.join(PACKAGE, 'no-such-target.js')], {
      cwd: PACKAGE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })).toThrow();
  });

  test('the same chain runs in an isolated copy — tracked files, install, build, execute', () => {
    // AC-15's "from a clean clone", and the primary proof. {@link isolate} copies TRACKED files only
    // — the commit rather than the checkout — so nothing here can be satisfied by an artifact this
    // working tree happens to carry, which is R-1's failure mode and the one Q-0096's E-1 retired an
    // assertion for. The copy is then built with the real turbo and the target spawned inside it.
    const root = isolate();
    const target = path.join(root, 'packages', 'cli', ownManifest().bin?.quorum ?? '');
    expect(fs.existsSync(target), 'the copy carries the target before it is built — then the build proves nothing').toBe(false);

    buildIn(root, '--force');
    expect(fs.existsSync(target), 'the isolated build wrote no bin target').toBe(true);
    const stdout = execFileSync(process.execPath, [target, 'help'], {
      cwd: path.join(root, 'packages', 'cli'), encoding: 'utf8',
    });
    for (const name of helpNames(HELP)) expect(stdout).toContain(name);
    expect(path.resolve(target).startsWith(path.resolve(root)), 'the copy executed the real workspace\'s binary').toBe(true);
  }, 300_000);
});

describe('Q-0098 AC-16 — the artifact carries a shebang and is executable', () => {
  test('the first bytes are the shebang, read out of the emitted file rather than cited', () => {
    // TypeScript's shebang preservation is a mechanism rather than a promise, so it is PROVEN by
    // reading what `tsc` wrote. A banner emitted before it would not work, which is why this is the
    // first line and not merely a line.
    runBuild();
    const text = fs.readFileSync(binTarget(), 'utf8');
    // The exact bytes `spike/bin/harness.js:1` carries, asserted as a literal rather than derived
    // from that file: reading it would make `@quorum/cli#test`'s verdict depend on `spike/`, which
    // this package's turbo inputs do not declare and which would have to be added for the read to be
    // honest (Q-0072). A shebang is a fixed string, so the derivation buys nothing for that cost.
    expect(text.split('\n')[0]).toBe('#!/usr/bin/env node');
  }, 300_000);

  test('the build is what sets the mode, because tsc sets none', () => {
    // Its own test because it holds on every platform, and a mode-bit skip below must not take it
    // with it: `ctx.skip` ends the test it is called in, so a platform-independent assertion sharing
    // that test would be reported skipped on win32 while nothing about it was unavailable.
    //
    // Why the build script carries a `chmod`: `tsc` emits mode 644 and `.gitignore` ignores the emit,
    // so git records no mode for it either. Measured — an emitted target without this is `rw-r--r--`
    // and fails under `./<file>` and under an installed shim while passing under `node <file>`.
    expect(JSON.parse(read(PACKAGE, 'package.json')).scripts.build).toContain('chmod +x');
  });

  test('and the emitted target carries the bit that build set', (ctx) => {
    // The skip is the RUNNER's, so a platform without POSIX modes reports this test as skipped and
    // carries {@link NO_POSIX_MODES} into the report. Called before {@link runBuild} because a build
    // paid for on the way to a check that cannot run is a cost with no verdict behind it.
    ctx.skip(!POSIX_MODES, NO_POSIX_MODES);
    runBuild();
    const target = binTarget();
    expect(fs.statSync(target).mode & 0o111, `${target} is not executable`).not.toBe(0);
  }, 300_000);

  test('and it runs when executed directly, which is the difference the mode bit makes', (ctx) => {
    // `node <file>` works whatever the mode is, so the assertion above needs a behavioural
    // counterpart: this is the invocation an installed `bin` shim performs. It is the one that cannot
    // even be attempted without POSIX modes, so it is skipped by the same mechanism and for the same
    // stated reason rather than by an early return, which would report a pass over nothing.
    ctx.skip(!POSIX_MODES, NO_POSIX_MODES);
    runBuild();
    expect(execFileSync(binTarget(), ['help'], { cwd: PACKAGE, encoding: 'utf8' })).toContain('usage: quorum');
  }, 300_000);
});

describe('Q-0098 AC-17 — a non-zero status crosses the process boundary through the emitted artifact', () => {
  /** Runs `source` in a plain node process rooted at `cwd` and reports status, stdout and stderr. */
  const spawnStatus = (cwd: string, args: string[]): { status: number; stdout: string; stderr: string } => {
    try {
      const stdout = execFileSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stdout, stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      return { status: failure.status ?? -1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
    }
  };

  /** The emitted `fail.js`, whose two exports are the mechanisms this criterion is about. */
  const emittedFail = (): string => path.join(PACKAGE, EMIT, 'fail.js');

  test('failSoftly sets the status and the output written after it still arrives', () => {
    // The subject is the SOFT path and the EMITTED module. Both halves are asserted together,
    // because either alone is satisfiable by the other mechanism: a `die` would give the 1 and lose
    // the output, and a plain return would give the output and lose the 1. That pairing is the whole
    // reason `fail.ts` keeps the two apart, and four spike sites depend on it
    // (`spike/bin/harness.js:499`, `:517`, `:523`, `:531`).
    //
    // No test-only command, environment variable, package export or production branch is added to
    // manufacture a status — the module is imported by absolute path from a plain node process,
    // which is possible precisely because the emit is self-contained JavaScript.
    runBuild();
    const script = `const { failSoftly } = await import(${JSON.stringify(emittedFail())});`
      + " failSoftly(); process.stdout.write('AFTER-THE-CALL');";
    const result = spawnStatus(PACKAGE, ['--input-type=module', '-e', script]);
    expect(result.status, 'the emit swallowed process.exitCode').toBe(1);
    expect(result.stdout, 'the soft path truncated the output it exists to preserve').toContain('AFTER-THE-CALL');
  }, 300_000);

  test('die stops the process with the same code and puts its message on stderr', () => {
    runBuild();
    const script = `const { die } = await import(${JSON.stringify(emittedFail())}); die('a message');`;
    const result = spawnStatus(PACKAGE, ['--input-type=module', '-e', script]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('a message');
    expect(result.stdout, 'die wrote its message to stdout').not.toContain('a message');
  }, 300_000);

  test('and the preserved unknown-command zero survives the boundary rather than being quietly fixed', () => {
    // Why: preserved, see Q-0090 AC-6 — `spike/bin/harness.js:560–562` prints usage and returns, so
    // the process exits 0 and a shell script cannot tell "did the thing" from "did not understand
    // you". Successor Q-0090 GA-4. Returning 1 here would be a behaviour change wearing a bug fix's
    // clothes, which ground rule 3 forbids; pinning it across the process boundary is what makes a
    // later fix a deliberate act.
    runBuild();
    const result = spawnStatus(PACKAGE, [binTarget(), 'no-such-command']);
    expect(result.status, 'the unknown-command zero was changed — that is Q-0090 GA-4 and not this ticket').toBe(0);
    expect(result.stdout).toContain('usage: quorum');
  }, 300_000);
});

/**
 * An environment in which nothing can be fetched, so a command that succeeds under it was satisfied
 * locally.
 *
 * This is the other half of AC-20. The first half is asserted **positively** — the resolved path
 * lies inside the workspace package or inside the temporary installation — and this half makes a
 * lookup the fixture *controls* fail: a closed port on loopback, a cache directory the caller owns
 * so no warm cache can serve a real package, and zero retries so the failure is immediate rather
 * than a timeout. A negative assertion about the machine's own network would pass on a laptop in a
 * tunnel, for reasons that have nothing to do with this commit.
 *
 * One definition rather than one per fixture, so the two supported paths cannot drift into claiming
 * different guarantees under the same word.
 */
const offline = (cache: string): NodeJS.ProcessEnv => ({
  ...process.env,
  npm_config_registry: 'http://127.0.0.1:1/',
  npm_config_cache: cache,
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_fetch_retries: '0',
});

describe('Q-0098 AC-18 and AC-20 — the workspace path works, and resolves locally', () => {
  /**
   * Runs a command **at the repository root** — which is where AC-18's mechanism is typed — and
   * reports its streams instead of throwing, so a failure can be read rather than merely counted.
   */
  const attempt = (command: string, args: string[], env: NodeJS.ProcessEnv): { status: number; stdout: string; stderr: string } => {
    try {
      const stdout = execFileSync(command, args, { cwd: WORKSPACE, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stdout, stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      return { status: failure.status ?? -1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
    }
  };

  test('pnpm links a shim from the root devDependency, and it resolves inside this package', () => {
    // **Mechanism A, selected by measurement rather than by taste** (AC-18, R-4). Before this ticket
    // `node_modules/.bin` held six entries and no `quorum`, and `packages/cli/node_modules/.bin` did
    // not exist at all — so `pnpm --filter @quorum/cli exec quorum` could not work, which is what
    // `package.test.ts:69`'s own comment predicted. Measured after declaring `@quorum/cli` as a root
    // devDependency: `pnpm install` links `node_modules/.bin/quorum`. The alternative — asserting
    // over the resolved target directly — was cheaper and would have collapsed this criterion into
    // AC-15, which is choosing by accident in the other direction.
    runBuild();
    // The shim is linked by INSTALL, not by build, and 078(b) guarantees no build has run by
    // install time — so it must be linked after the artifact exists. See linkBins() and E-2.
    linkBins();
    const shim = path.join(WORKSPACE, 'node_modules', '.bin', 'quorum');
    expect(fs.existsSync(shim), 'pnpm linked no quorum shim — the root devDependency is missing or the bin field moved').toBe(true);

    // AC-20, asserted POSITIVELY: the file the shim executes lies inside this workspace package. A
    // negative assertion that some registry lookup failed would pass on a machine with no network,
    // for reasons that have nothing to do with this commit.
    //
    // The shim is a generated `sh` script rather than a symlink, so `realpathSync` on it answers
    // about the script and not about its target — measured, and the reason the chain below goes
    // through the package link instead: `node_modules/@quorum/cli` IS a symlink, and the shim execs
    // `$basedir/../@quorum/cli/<bin.quorum>`, so resolving the link and appending the manifest's own
    // target is the same file the shell would run.
    const link = path.join(WORKSPACE, 'node_modules', '@quorum', 'cli');
    expect(fs.realpathSync(link), '@quorum/cli does not resolve to this workspace package').toBe(fs.realpathSync(PACKAGE));
    const executed = fs.realpathSync(path.join(link, ownManifest().bin?.quorum ?? ''));
    expect(executed.startsWith(fs.realpathSync(PACKAGE)), `the shim would execute ${executed}, outside this package`).toBe(true);
    expect(executed).toBe(fs.realpathSync(binTarget()));
    // And the shim really does name that path, so the chain above is the shell's and not the test's.
    expect(fs.readFileSync(shim, 'utf8')).toContain(`@quorum/cli/${path.relative(PACKAGE, binTarget())}`);
    // Executing the shim file directly is AC-16's "and under an installed shim" half: it proves the
    // link is runnable. It is NOT AC-18's mechanism, which is the command below — see that test.
    expect(execFileSync(shim, ['help'], { cwd: WORKSPACE, encoding: 'utf8' })).toContain('usage: quorum');
  }, 300_000);

  test('and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to', () => {
    // **The documented command, through pnpm's own resolution.** Executing the generated shim by
    // absolute path proves the shim; it bypasses the step a contributor actually depends on, so it
    // cannot establish that `pnpm exec quorum help` works or that no package runner could have
    // satisfied it. Both facts are wanted and they are different, which is why this test sits beside
    // the one above rather than replacing it.
    //
    // Run under `offline()` (AC-20): the registry is a closed port and the cache is empty, so a
    // success here was served from `node_modules/.bin` and could not have come from a public package
    // named `quorum`. The test below shows that guarantee discriminates.
    runBuild();
    // Same ordering as the test above: `pnpm exec` resolves through `node_modules/.bin`, which
    // install populates and only where the target already exists. See linkBins() and E-2.
    linkBins();
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-exec-'));
    isolated.push(cache);
    const result = attempt('pnpm', ['exec', 'quorum', 'help'], offline(cache));
    expect(result.status, `pnpm exec quorum help failed: ${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('usage: quorum');
    // Derived from HELP rather than transcribed, as AC-15 requires of the plain-node spawn.
    expect(helpNames(result.stdout), 'the command list is not the frame\'s').toStrictEqual(helpNames(HELP));
  }, 300_000);

  test('and pnpm exec fails rather than falling back — it resolves locally or not at all', () => {
    // The guarantee the test above rests on, **shown to discriminate rather than assumed**. `pnpm
    // exec` is not `npx` and not `pnpm dlx`: it runs a binary already linked into `node_modules/.bin`
    // and installs nothing. Without this, "it ran under a dead registry" would be decoration — a
    // command that never consults a registry proves nothing by not reaching one.
    //
    // Asserted on the MESSAGE and not merely on the non-zero status, because a fetch against the
    // closed port would also fail: "it failed" would then pass for a reason that has nothing to do
    // with this commit. pnpm declining to resolve a name locally and pnpm failing to reach a registry
    // are different sentences, and only the first is evidence here.
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-nofallback-'));
    isolated.push(cache);
    const absent = 'quorum-absent-probe-q0098';
    const result = attempt('pnpm', ['exec', absent, '--version'], offline(cache));
    expect(result.status, 'pnpm exec resolved a command that is linked nowhere — it fell back').not.toBe(0);
    const said = `${result.stdout}${result.stderr}`;
    expect(said, 'pnpm exec did not decline to resolve the name; it failed for some other reason').toContain('not found');
    expect(said).toContain(absent);
  }, 300_000);

  test('and the root manifest and the lockfile moved together, which is what keeps the install frozen', () => {
    // R-4: `commands.install` runs `pnpm install --frozen-lockfile`, so a manifest edit without a
    // regenerated lockfile fails the install AFTER the implement step has been paid for (Q-0090 R-4).
    const root = JSON.parse(read(WORKSPACE, 'package.json')) as { devDependencies?: Record<string, string> };
    expect(root.devDependencies?.['@quorum/cli'], 'the root does not depend on the CLI, so pnpm links no shim').toBe('workspace:*');
    const lock = read(WORKSPACE, 'pnpm-lock.yaml');
    expect(lock, 'the lockfile does not record the root devDependency — a frozen install would fail').toContain('link:packages/cli');
  });
});

describe('Q-0098 AC-19 and AC-20 — the local distribution set is a declared contract', () => {
  /** The three packages decision 078(c) names as emitting, which is the local distribution set (R-2). */
  const DISTRIBUTION = ['cli', 'core', 'shared'];

  /** A path npm must never ship: a test file, anything under `src/`, and anything under `.turbo/`. */
  const REJECTED = [
    { why: 'a test file', matches: (relative: string): boolean => /\.test\.[cm]?[jt]s$/.test(relative) },
    { why: 'source rather than the emit', matches: (relative: string): boolean => relative.startsWith('src/') },
    { why: 'a turbo build log or cache entry', matches: (relative: string): boolean => relative.startsWith('.turbo/') },
  ];

  /** Packs `directory` with `packer` and returns the tarball's absolute path. */
  const packWith = (packer: 'pnpm' | 'npm', directory: string, destination: string): string => {
    const args = packer === 'npm'
      ? ['pack', '--pack-destination', destination, '--silent']
      : ['pack', '--pack-destination', destination];
    const out = execFileSync(packer, args, { cwd: directory, encoding: 'utf8' });
    // pnpm prints an absolute path and npm prints a bare filename; `resolve` accepts either.
    return path.resolve(destination, out.trim().split('\n').at(-1)?.trim() ?? '');
  };

  /** The files a tarball carries, named relative to the package root. */
  const pathsIn = (tarball: string): string[] =>
    execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
      .split('\n').filter(Boolean)
      .map((entry) => entry.replace(/^package\//, ''))
      .filter((entry) => entry !== '' && !entry.endsWith('/'))
      .sort();

  /** The manifest a tarball carries, which is **not** always the manifest on disk — see the last test. */
  const manifestIn = (tarball: string): { dependencies?: Record<string, string> } =>
    JSON.parse(execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' })) as
      { dependencies?: Record<string, string> };

  /** One of the three packages, read from disk. */
  const manifestOf = (name: string): { version: string; dependencies?: Record<string, string> } =>
    JSON.parse(read(WORKSPACE, 'packages', name, 'package.json')) as { version: string; dependencies?: Record<string, string> };

  /** The version a `workspace:` range resolves to, which is the sibling package's own. */
  const versionOf = (packageName: string): string => manifestOf(packageName.replace('@quorum/', '')).version;

  /** The names `name` depends on through the `workspace:` protocol, which is what a packer rewrites. */
  const workspaceDepsOf = (name: string): string[] =>
    Object.entries(manifestOf(name).dependencies ?? {})
      .filter(([, range]) => range.startsWith('workspace:'))
      .map(([dependency]) => dependency);

  /** Packs `directory` with pnpm and returns its paths — the packer AC-19(b)'s install requires. */
  const packedPaths = (directory: string, destination: string): string[] =>
    pathsIn(packWith('pnpm', directory, destination));

  test('each of the three declares files, and the pack result carries the emit and nothing repository-only', () => {
    // **The assertion is over the allow-list and the entry point, never over a count, a byte size or
    // the absence of build output** — `requirements/errata.md` E-1. `packages/*` carry no
    // `.npmignore` and no package-level `.gitignore`, and npm reads ignore files in the package
    // directory only, so gitignored `dist/` and `.turbo/` ship and every pack COUNT depends on
    // whether the checkout has run a build. A count assertion is green in a fresh clone, red in any
    // checkout that has built, and red everywhere including CI once a build runs before `test` —
    // which is precisely the assertion Q-0096's E-1 retired one ticket ago for the same reason.
    //
    // The rejection is DERIVED rather than hand-written, so an eleventh test file is covered without
    // anyone remembering — the fail-open shape Q-0051 found in `q0050.source.test.ts` and Q-0097
    // found again in `test-discovery.test.ts`.
    runBuild();
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-packed-'));
    isolated.push(destination);
    for (const name of DISTRIBUTION) {
      const directory = path.join(WORKSPACE, 'packages', name);
      const declared = (JSON.parse(read(directory, 'package.json')) as { files?: string[] }).files;
      expect(declared, `@quorum/${name} declares no files field, so the checkout decides the tarball`).toStrictEqual([EMIT]);

      const paths = packedPaths(directory, destination);
      expect(paths, `@quorum/${name} ships no manifest`).toContain('package.json');
      expect(paths.some((entry) => entry.startsWith(`${EMIT}/`)), `@quorum/${name} ships no emit`).toBe(true);
      for (const rule of REJECTED) {
        expect(paths.filter((entry) => rule.matches(entry)), `@quorum/${name} ships ${rule.why}`).toStrictEqual([]);
      }
    }
    // The CLI additionally ships the file `bin.quorum` names, which is the whole point of the set.
    const cliPaths = packedPaths(path.join(WORKSPACE, 'packages', 'cli'), destination);
    expect(cliPaths).toContain(path.relative(PACKAGE, binTarget()));
  }, 300_000);

  test('and the rejection rules have subjects — each one matches something this repository really has', () => {
    // Without this the three could all be regexes that match nothing, and the loop above would
    // report success over an empty question. Shown against real paths rather than invented ones.
    expect(REJECTED[0].matches('src/build.test.ts')).toBe(true);
    expect(REJECTED[0].matches('dist/build.test.js')).toBe(true);
    expect(REJECTED[1].matches('src/main.ts')).toBe(true);
    expect(REJECTED[2].matches('.turbo/turbo-build.log')).toBe(true);
    // And they do not reject the distribution itself.
    for (const rule of REJECTED) {
      expect(rule.matches('dist/quorum.js'), `${rule.why} rejects the binary`).toBe(false);
      expect(rule.matches('package.json'), `${rule.why} rejects the manifest`).toBe(false);
    }
  });

  test('the packed set installs outside the workspace with the registry dead, and runs', () => {
    // AC-19(b) and AC-20's packed half. The project is created under `os.tmpdir()`, outside the
    // repository, with no workspace symlinks; `npm_config_registry` points at a closed local port,
    // retries are zero and the npm cache is inside the sandbox, so no warm cache can serve a real
    // package. A public package named `quorum`, `@quorum/core` or `@quorum/shared` can neither
    // satisfy nor change the result.
    //
    // **`pnpm pack` and not `npm pack`, and the difference is a measurement rather than a
    // preference.** Only pnpm rewrites `workspace:*` to the sibling's resolvable version; `npm pack`
    // leaves the literal protocol in the packed manifest and npm then refuses it with
    // EUNSUPPORTEDPROTOCOL. The merged requirement's M-8 poses these as two possible branches of
    // what pnpm writes; both are real, one per packer. **Guarded by the last test in this block**
    // rather than asserted here, because the choice of packer rests on it.
    //
    // The three tarballs are installed TOGETHER, which is what lets npm satisfy `@quorum/core@0.0.0`
    // and `@quorum/shared@0.0.0` from siblings rather than from a registry that does not have them.
    runBuild();
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-consumer-'));
    isolated.push(sandbox);
    const tarballs = path.join(sandbox, 'tarballs');
    const project = path.join(sandbox, 'project');
    const cache = path.join(sandbox, 'npm-cache');
    for (const directory of [tarballs, project, cache]) fs.mkdirSync(directory);

    const packed = DISTRIBUTION.map((name) => packWith('pnpm', path.join(WORKSPACE, 'packages', name), tarballs));

    // The distribution set's third-party dependencies, supplied as tarballs packed from this
    // workspace's own installed tree. They are genuine public packages this ticket did not
    // introduce, and a dead registry cannot serve them — so they come from a local mirror, which is
    // AC-20's "equally explicit offline guarantee". Nothing under `@quorum` comes from here.
    const closure = new Map<string, string>();
    const collect = (name: string, from: string): void => {
      if (closure.has(name) || name.startsWith('@quorum/')) return;
      const resolved = createRequire(path.join(from, 'noop.js')).resolve(`${name}/package.json`);
      closure.set(name, path.dirname(resolved));
      const nested = JSON.parse(fs.readFileSync(resolved, 'utf8')) as { dependencies?: Record<string, string> };
      for (const dependency of Object.keys(nested.dependencies ?? {})) collect(dependency, path.dirname(resolved));
    };
    for (const name of DISTRIBUTION) {
      const directory = path.join(WORKSPACE, 'packages', name);
      const own = JSON.parse(read(directory, 'package.json')) as { dependencies?: Record<string, string> };
      for (const dependency of Object.keys(own.dependencies ?? {})) collect(dependency, directory);
    }
    expect(closure.size, 'the third-party closure is empty — the install below would prove less than it appears to').toBeGreaterThan(0);
    const mirrored = [...closure.values()].map((directory) => packWith('npm', directory, tarballs));

    fs.writeFileSync(path.join(project, 'package.json'),
      JSON.stringify({ name: 'quorum-consumer-fixture', version: '1.0.0', private: true }, null, 2));
    const env = offline(cache);
    execFileSync('npm', ['install', '--no-package-lock', '--no-audit', '--no-fund', ...packed, ...mirrored], {
      cwd: project, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'],
    });

    const shim = path.join(project, 'node_modules', '.bin', 'quorum');
    expect(fs.existsSync(shim), 'the packed install linked no quorum shim').toBe(true);
    // AC-20, positively: the executed file lies inside the temporary installation and not inside the
    // repository. Both directions, because the first alone would hold for a shim that resolved to a
    // workspace path that happened to sit under `os.tmpdir()`.
    const executed = fs.realpathSync(shim);
    expect(executed.startsWith(fs.realpathSync(project)), `the packed shim resolves to ${executed}`).toBe(true);
    expect(executed.startsWith(fs.realpathSync(WORKSPACE)), 'the packed shim reaches back into the repository').toBe(false);
    expect(execFileSync(shim, ['help'], { cwd: project, encoding: 'utf8', env })).toContain('usage: quorum');
  }, 300_000);

  test('and the registry really is unreachable in that environment, so the install proved something', () => {
    // The guarantee AC-20 rests on, demonstrated rather than assumed: if the closed port were
    // answering, every assertion above would be satisfiable by a public package. Asserted as a
    // failure of a lookup the fixture CONTROLS — a closed port on loopback — rather than as a
    // property of the machine's network.
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-registry-'));
    isolated.push(cache);
    // The SAME `offline()` the fixtures run under, not a second spelling of it — otherwise this
    // proves a neighbouring environment dead and the fixtures keep whatever they were given.
    expect(() => execFileSync('npm', ['view', 'quorum', 'version'], {
      cwd: cache, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: offline(cache),
    })).toThrow();
  }, 300_000);

  test('pnpm pack and npm pack agree on the file list, for every package in the distribution set', () => {
    // OQ-3, confirmed after `files` landed rather than assumed.
    //
    // **Every package, not only the CLI.** AC-19 defines a three-package distribution set (R-2), and
    // checking one of the three is the fail-open shape this repository keeps finding — Q-0051 in
    // `q0050.source.test.ts`, Q-0097 in `test-discovery.test.ts`: a guard that reports agreement
    // while two thirds of its subject went unexamined. `@quorum/core` and `@quorum/shared` are packed
    // by AC-19(b) and installed into the consumer, so a divergence in either ships a different
    // tarball from the one this suite checked.
    runBuild();
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-packers-'));
    isolated.push(destination);
    for (const name of DISTRIBUTION) {
      const directory = path.join(WORKSPACE, 'packages', name);
      const byPnpm = pathsIn(packWith('pnpm', directory, destination));
      const byNpm = pathsIn(packWith('npm', directory, destination));
      expect(byPnpm.length, `@quorum/${name} packed nothing — the comparison is vacuous`).toBeGreaterThan(1);
      expect(byNpm, `pnpm pack and npm pack disagree on which files @quorum/${name} ships`).toStrictEqual(byPnpm);
    }
  }, 300_000);

  test('and they disagree on the packed manifest, which is why the fixture above packs with pnpm', () => {
    // **The divergence guarded rather than described.** Until this round it was a claim in a comment:
    // that pnpm rewrites `workspace:*` to a concrete version while npm leaves the protocol literal.
    // Nothing executed it, so it was a sentence about a tool's behaviour with no subject — and it is
    // load-bearing, because it is the whole reason AC-19(b) packs with pnpm. If pnpm stopped
    // rewriting, that install would fail at dependency resolution against a closed registry, and the
    // error would name a network rather than a protocol.
    //
    // The merged requirement's M-8 poses the two as alternative branches of "what pnpm writes";
    // measured, both are real and each belongs to one packer. Resolving the divergence is out of
    // scope (non-goal 7 keeps bundling with Q-0091); hiding it is what is refused.
    runBuild();
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-manifests-'));
    isolated.push(destination);

    // A register rather than a count, per Q-0073: a subject that quietly emptied would leave the
    // loop below reporting success over nothing. `@quorum/shared` depends on no workspace sibling,
    // so it has nothing to rewrite and is deliberately absent.
    const dependents = DISTRIBUTION.filter((name) => workspaceDepsOf(name).length > 0);
    expect(dependents, 'the set of packages declaring a workspace dependency moved').toStrictEqual(['cli', 'core']);

    for (const name of dependents) {
      const directory = path.join(WORKSPACE, 'packages', name);
      const byPnpm = manifestIn(packWith('pnpm', directory, destination)).dependencies ?? {};
      const byNpm = manifestIn(packWith('npm', directory, destination)).dependencies ?? {};
      for (const dependency of workspaceDepsOf(name)) {
        // Derived from the sibling's own manifest rather than written down, so the assertion is
        // about the substitution and not about the number `0.0.0` happening to be current.
        const substituted = versionOf(dependency);
        expect(byPnpm[dependency], `pnpm no longer rewrites ${dependency} for @quorum/${name} — AC-19(b) would resolve it from a registry`).toBe(substituted);
        expect(byNpm[dependency], `npm now rewrites ${dependency} for @quorum/${name}; the reason this fixture packs with pnpm has gone`)
          .toBe(manifestOf(name).dependencies?.[dependency]);
        expect(byNpm[dependency]?.startsWith('workspace:'), `npm's packed manifest no longer carries the literal protocol for ${dependency}`).toBe(true);
      }
    }
  }, 300_000);
});

describe('Q-0098 AC-25 — the target survives a cache replay of build', () => {
  test('a hit restores the file with its shebang, its mode bit and its behaviour intact', async (ctx) => {
    // 078's *Why* is that a `build` task with real `outputs` introduces a replayed ARTIFACT, and an
    // artifact something downstream EXECUTES "lies about the present". The `bin` target is the first
    // artifact anything executes, so every property AC-15 and AC-16 assert must hold after a cache
    // hit and not only after a fresh build. Nobody had measured whether a mode bit survives turbo's
    // cache; this is that measurement, and it does.
    //
    // The oracle is turbo's machine-readable summary, not its output text — the shape AC-9 already
    // establishes.
    runBuild('--force');
    removeEmit();
    expect(fs.existsSync(binTarget()), 'the emit is still there, so the replay below proves nothing').toBe(false);

    const replayed = runBuild();
    const own = replayed.find((entry) => entry.taskId === '@quorum/cli#build');
    expect(own?.cache?.status, 'the build was not a cache hit, so nothing was restored').toBe('HIT');

    const target = binTarget();
    expect(fs.existsSync(target), 'the hit restored no bin target').toBe(true);
    expect(fs.readFileSync(target, 'utf8').split('\n')[0], 'the restored artifact lost its shebang').toBe('#!/usr/bin/env node');
    if (POSIX_MODES) {
      expect(fs.statSync(target).mode & 0o111, 'the restored artifact lost its executable bit').not.toBe(0);
      expect(execFileSync(target, ['help'], { cwd: PACKAGE, encoding: 'utf8' })).toContain('usage: quorum');
    } else {
      // Annotated rather than skipped, because the two mechanisms answer different questions and
      // this test is not wholly unavailable: the restore, the shebang and the plain-node spawn below
      // are AC-25's subject and hold on every platform, so `ctx.skip` would report a pass that did
      // hold as a test that never ran. What is unavailable is two assertions, and the report says so
      // — which is the same rule as AC-16's skip, applied where only part of a test loses its
      // subject.
      await ctx.annotate(NO_POSIX_MODES);
    }
    expect(execFileSync(process.execPath, [target, 'help'], { cwd: PACKAGE, encoding: 'utf8' })).toContain('usage: quorum');
  }, 300_000);
});

/* ---------------------------------------------------------------------------------------------
 * Q-0092 AC-9 — a billed failure's usage reaches a reader that holds none of the run's state.
 *
 * `spike/test/q0011-run-history.js:121–124` runs a flow that fails after its adapter has been
 * billed, then **spawns the binary** at the manifest that run left behind and asserts the failed
 * occurrence's vendor, its message and its usage all arrive. The claim is process separation: a
 * reader sharing nothing with the run prints what the file carries, so the number came off disk
 * rather than out of the run's memory. `runs.test.ts` renders the same occurrence and cannot make
 * that claim — `invoke` calls the handler in this process.
 *
 * **Why it is here and not there.** This file removes `packages/cli/dist` — `removeEmit()` at four
 * sites, in AC-8, AC-9, AC-23 and Q-0098 AC-25, counted rather than taken from the Q-0098 banner
 * above, which says twice and names two of them — and `vitest.shared.js` sets no
 * `fileParallelism: false`, so a second file spawning that path would intermittently meet an emit
 * that had just been deleted. Q-0098 AC-15(c) names the two safe shapes; the real-workspace spawn is
 * this one, and the reason is that hazard rather than anything about the build.
 *
 * The producing half — a real run that bills and then fails — is the engine's and is carried by
 * `packages/core/src/run-history/writer.test.ts` and its neighbours. What transfers to a command
 * child is the reader.
 * ------------------------------------------------------------------------------------------- */

/**
 * The manifest such a run leaves behind: one occurrence, billed, then failed.
 *
 * Written out rather than produced, because producing one means running a flow, which is neither
 * this package's job nor this file's subject. What AC-9 is about is what a separate process makes of
 * the file, and the file is the same either way.
 */
const BILLED_FAILURE = {
  schema_version: 1,
  run_id: 'Q-0011-1',
  ticket_id: 'Q-0011',
  ticket_path: 'backlog/Q-0011-x/ticket.md',
  flow: 'development',
  flow_file: 'harness/flows/development.yaml',
  stage: { before: 'red', after: 'green' },
  started_at: '2026-08-23T10:00:00.000Z',
  ended_at: '2026-08-23T10:00:01.000Z',
  duration_ms: 1000,
  status: 'failed',
  steps: [{
    step_id: 'step:1',
    occurrence_dir: 'steps/001-step-1',
    kind: 'adapter',
    role: 'qa',
    adapter: 'mock',
    model: null,
    branch: null,
    worktree: null,
    started_at: '2026-08-23T10:00:00.000Z',
    duration_ms: 5,
    attempts: 1,
    status: 'failed',
    verdict: null,
    error: { category: 'adapter', message: 'simulated failure' },
    usage: {
      vendor: 'codex',
      input_tokens: 100,
      output_tokens: 20,
      cached_input_tokens: null,
      cache_write_input_tokens: null,
      cost_usd: null,
    },
  }],
  rollup: [],
};

describe('Q-0092 AC-9 — the detail view reads the file, not a run\'s memory', () => {
  /** A project whose run history holds {@link BILLED_FAILURE} and nothing else. */
  function projectWithABilledFailure(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-reader-'));
    isolated.push(root);
    fs.mkdirSync(path.join(root, 'harness'), { recursive: true });
    fs.writeFileSync(path.join(root, 'harness', 'harness.yaml'), 'backlog: {path: backlog}\n');
    const directory = path.join(root, '.quorum', 'runs', BILLED_FAILURE.run_id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(BILLED_FAILURE, null, 2));
    return root;
  }

  test('a separate process renders the failed occurrence\'s vendor, message and usage', () => {
    runBuild();
    const root = projectWithABilledFailure();
    // `--project` rather than a working directory inside the fixture, so the reader is TOLD which
    // project to open: `cwd` stays this package, whose own repository carries a runs root of its
    // own, and an answer that came from the wrong store would name a run this fixture never wrote.
    const detail = spawnSync(process.execPath, [binTarget(), 'runs', BILLED_FAILURE.run_id, '--project', root], {
      cwd: PACKAGE, encoding: 'utf8',
    });
    expect(detail.status, detail.stderr).toBe(0);
    expect(detail.stdout).toMatch(/simulated/);
    expect(detail.stdout).toMatch(/codex/);
    expect(detail.stdout, 'a separate reader process omitted the billed failure\'s usage')
      .toMatch(/input_tokens=100\b/);
    // The four measures separately and no roll-up field, across the boundary as well as inside it —
    // the Q-0037 ruling is what the per-step line is FOR, and a process that re-collapsed them would
    // satisfy every assertion above. See Q-0037 OQ-2 (2026-09-01).
    expect(detail.stdout).toMatch(/output_tokens=20\b/);
    expect(detail.stdout, 'a roll-up field was synthesised onto a single occurrence').not.toMatch(/unpriced_steps/);
  }, 300_000);

  test('and the same spawn over a store that does not hold it fails, so the pass above is a fact', () => {
    // Without this the assertion above cannot distinguish "the binary read the fixture" from "the
    // binary answered from somewhere else and happened to print those words". Same spawn, same
    // binary, a project whose runs root is empty: the run is unknown and the status is non-zero.
    runBuild();
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-reader-empty-'));
    isolated.push(empty);
    fs.mkdirSync(path.join(empty, 'harness'), { recursive: true });
    fs.writeFileSync(path.join(empty, 'harness', 'harness.yaml'), 'backlog: {path: backlog}\n');

    const detail = spawnSync(process.execPath, [binTarget(), 'runs', BILLED_FAILURE.run_id, '--project', empty], {
      cwd: PACKAGE, encoding: 'utf8',
    });
    expect(detail.status, 'a run nothing on disk holds was reported as found').not.toBe(0);
    expect(detail.stdout, 'the usage came from somewhere other than the manifest').not.toMatch(/input_tokens=100\b/);
  }, 300_000);
});
