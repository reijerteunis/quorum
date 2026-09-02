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
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configDefaults } from 'vitest/config';
import { afterAll, describe, expect, test } from 'vitest';

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
 * The one write it cannot see is a rewrite identical in bytes *and* in timestamp, which no compiler
 * produces and which nothing short of instrumenting the process would observe.
 */
function fingerprint(full: string, stat: fs.Stats): string {
  if (stat.isSymbolicLink()) return `link:${fs.readlinkSync(full)}`;
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
 * is enumerated and a build that hid an artifact beside a log would still be reported.
 */
const isTurboMetadata = (relative: string): boolean => relative.split('/').includes('.turbo');

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
