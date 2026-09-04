/**
 * Building this workspace, and building a throwaway copy of it, for the two suites that need one.
 *
 * **Why it is a helper rather than a second copy.** `src/build.test.ts` grew {@link isolate} and
 * {@link buildIn} for Q-0097 AC-8, and Q-0095's end-to-end suite needs the same copy for a different
 * reason — Q-0098 AC-15(c) names *assert inside an isolated copy* as one of its two safe shapes, and
 * a suite that spawns the binary must not meet `packages/cli/dist` mid-`removeEmit()`. Two
 * implementations of a workspace copier is the drift this repository keeps finding, so the copier
 * moved here and both suites import it. That is Q-0095's merged requirement OQ-3, whose R-2 rules
 * `build.test.ts`'s *"nothing was extracted from it"* sentence a description of what Q-0098 did
 * rather than a prohibition; that sentence is corrected in place rather than left standing false.
 *
 * **Not collected by any include**: it is `test/workspace.ts` rather than `*.test.ts`, the same
 * arrangement `test/invoke.ts` already has. It registers no hook of its own — {@link disposeIsolated}
 * is exported and each suite registers its own `afterAll`, so a helper cannot quietly own a
 * lifecycle its importer did not ask for.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
export const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The workspace root, which is this package's grandparent. */
export const WORKSPACE = path.resolve(PACKAGE, '..', '..');

export const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');

/** Turbo's marker for a package that declares no script for the task — the silent skip AC-13 is about. */
export const NO_SCRIPT = '<NONEXISTENT>';

/** One task's declaration, as root `turbo.json` writes it. */
export interface TaskDeclaration {
  readonly outputs?: string[];
  readonly dependsOn?: string[];
  readonly env?: string[];
}

/** Root `turbo.json`, which declares every task and is the only place `env` is decided. */
export const rootTurbo = (): { globalDependencies?: string[]; tasks: Record<string, TaskDeclaration> } =>
  JSON.parse(read(WORKSPACE, 'turbo.json')) as { globalDependencies?: string[]; tasks: Record<string, TaskDeclaration> };

/**
 * The real `turbo` this workspace installs. Absent is a failure, never a skip: a build proof that
 * quietly does not run is the shape of defect Q-0097 is about.
 */
export const turboBin = (): string => {
  const bin = path.join(WORKSPACE, 'node_modules/.bin/turbo');
  if (!fs.existsSync(bin)) throw new Error(`corpus missing: ${bin} — install the workspace before asserting what turbo builds`);
  return bin;
};

/**
 * The environment the nested turbo runs get, with `TURBO_FORCE` removed.
 *
 * The outer invocation of these suites is `pnpm turbo run test --force` in CI and at `integrate`, and
 * a leaked force would turn Q-0097 AC-9's expected cache **hit** into a miss — a verdict taken from
 * how the run that contains it was invoked rather than from the commit (*"A test's verdict is a
 * property of the commit, not of the checkout or the account"*, 2026-08-30). Removed rather than set
 * to a falsy string, because turbo reads the variable's presence as well as its value; where a force
 * is wanted it is passed as a flag, which outranks the environment either way.
 */
export const turboEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.TURBO_FORCE;
  return env;
};

/** One task in turbo's own report of a run — real or dry. */
export interface TurboTask {
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
 * with `command: "<NONEXISTENT>"`. That marker is turbo's own admission of the silent skip Q-0097
 * AC-13 exists to close, which makes it a better oracle than reading seven manifests.
 */
export const dry = (task: string): { packages: string[]; tasks: TurboTask[] } =>
  JSON.parse(execFileSync(turboBin(), ['run', task, '--dry=json'], {
    cwd: WORKSPACE, encoding: 'utf8', env: turboEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  })) as { packages: string[]; tasks: TurboTask[] };

/** The packages turbo will actually run `build` in — the emitting set decision 078(c) names. */
export const emitting = (): TurboTask[] => dry('build').tasks.filter((task) => task.command !== NO_SCRIPT);

/**
 * The four files that make a directory a pnpm-and-turbo workspace. Root `globalDependencies` are
 * copied beside them, read out of `turbo.json` rather than listed here, so a fifth arrives in the
 * isolated copy without anyone remembering.
 */
export const WORKSPACE_FILES = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'turbo.json'];

/**
 * Every path under `directory` that **git can see** — tracked, plus untracked and unignored.
 *
 * The property the copy needs is that no *gitignored* path arrives: `dist/`, `.turbo/`, `.harness/`
 * and `.quorum/` are what would let a stale artifact satisfy an assertion about a build that had
 * not run. `--exclude-standard` is what buys that, and it is the same oracle `build.test.ts`'s
 * `gitVisible` uses — *"Membership is a git question, not a filesystem one"* (2026-08-28).
 *
 * **`--others` is here because the index is not the subject.** This read `git ls-files` alone until
 * Q-0093, and paired with a `copyFileSync` of the WORKING TREE that never described the commit: it
 * described *paths in the index, with current contents*. The difference shows the moment a change
 * adds a source file — a modified `index.ts` arrives and the new module it imports does not, so the
 * isolated build fails to compile a tree that exists nowhere, for a reason that is a property of
 * whether anyone has run `git add` rather than of the change. That is this repository's most
 * recorded defect class (Q-0072, Q-0073, Q-0079) arriving through the index instead of the
 * filesystem. Every guarantee the isolated audit rests on is unchanged: what it must not receive is
 * a build output, and a build output is ignored.
 */
export const trackedUnder = (directory: string): string[] =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', directory], {
    cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(Boolean);

/** Every copy {@link isolate} has made and not yet removed. */
const isolated: string[] = [];

/**
 * Remove every copy {@link isolate} made in this file's worker.
 *
 * Exported rather than registered here, so a suite that imports the copier says in its own body when
 * the copies go: a helper that called `afterAll` at import time would attach a hook to whichever
 * file happened to import it, which is a lifecycle nobody wrote down.
 */
export const disposeIsolated = (): void => {
  for (const directory of isolated.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
};

/**
 * A copy of this workspace's build — the emitting packages' tracked files and the root configuration
 * turbo needs to plan one — in a temporary directory nothing else writes to.
 *
 * **Why a copy at all.** Q-0097 AC-8 asks what the build writes, and in the real checkout that
 * question has an exact answer only where nothing else is writing. `.git`, `.harness` and `.quorum`
 * are entered by a concurrent harness run, so auditing them *there* would be reading the machine
 * rather than the commit (*"A test's verdict is a property of the commit, not of the checkout or the
 * account"*, 2026-08-30) — and excusing them by name leaves a build free to write into any of the
 * three while the criterion reports exact agreement. Here nothing else runs, so the audit prunes
 * **nothing** and excuses only what AC-8 excuses in its own words. The real-workspace proof R-4 and
 * OQ-1 make load-bearing is kept separately beside it in `build.test.ts`.
 *
 * Why: `Q-0097 requirements/errata.md` E-1 **rejected** this split and **E-2 withdraws E-1**, ruling
 * that the concurrency argument moves the observation rather than narrowing the criterion. Cited
 * because a reader meeting E-1 first would read this as contradicting a ruling — which a review
 * round did.
 *
 * **It is also the emit a suite may spawn.** Q-0098 AC-15(c) names two safe shapes for driving the
 * binary, and this is the first of them: a copy is not `packages/cli/dist`, so nothing here can meet
 * that directory mid-removal. Q-0095's end-to-end suite is the second importer for that reason.
 *
 * **Only what git can see**, so `dist/`, `.turbo/`, `.harness/` and `.quorum/` are all gitignored
 * and none of them arrives to be mistaken for something this build wrote — see {@link trackedUnder},
 * which carries why that is the tracked-and-unignored set rather than the index alone.
 * `node_modules` is mirrored as a real directory of symlinks rather than as one link, so a write
 * *under* it is a new entry rather than an invisible change behind a leaf; the `@quorum` scope is
 * re-pointed at the copy's own packages, which is what makes the copy build itself rather than the
 * tree it was taken from.
 */
export function isolate(): string {
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
export const buildIn = (cwd: string, ...flags: string[]): string =>
  execFileSync(turboBin(), ['run', 'build', ...flags], {
    cwd, encoding: 'utf8', env: turboEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
