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
import { describe, expect, test } from 'vitest';

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

/** Root `turbo.json`, which declares every task and is the only place `env` is decided. */
const rootTurbo = (): { tasks: Record<string, { outputs?: string[]; dependsOn?: string[]; env?: string[] }> } =>
  JSON.parse(read(WORKSPACE, 'turbo.json')) as { tasks: Record<string, { outputs?: string[]; dependsOn?: string[]; env?: string[] }> };

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
 * Directory names the write-set audit does not descend into, and the whole of what it excludes.
 *
 * Each is a named claim rather than a convenience, because everything not on this list is audited:
 *
 *   - `node_modules` is an install, not a package artifact — and pruning it during the walk is also
 *     what keeps the audit affordable.
 *   - `.turbo` is turbo's own cache metadata and per-task log. AC-8's own wording excuses it:
 *     *"Turbo's own cache metadata and logs are not treated as package artifacts."*
 *   - `.git` is git's object store.
 *   - `.harness` and `.quorum` are the harness's worktrees and its run history. Both are gitignored,
 *     both are absent in a fresh clone and in a linked worktree and present in a working checkout —
 *     the pair Q-0072's closing finding names — and both are **written by any concurrent harness
 *     run**, so a verdict that read them would be a verdict about the machine rather than about the
 *     commit (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
 *     2026-08-30).
 *
 * The accepted limit, stated rather than left to be found: a build that wrote **into** one of these
 * five would be invisible here. Nothing does — each emitting package's build script is
 * `rm -rf dist && tsc -p tsconfig.build.json` — and the alternative, auditing an installed
 * dependency tree and a live run's worktrees, buys a flake rather than a guard.
 */
const UNAUDITED = ['node_modules', '.git', '.turbo', '.harness', '.quorum'];

/** Every file below `root`, relative to it with `/` separators, with {@link UNAUDITED} pruned. */
function filesUnder(root: string, prune: readonly string[] = UNAUDITED): string[] {
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
 * A fingerprint of every file below `root`: its size, its modification time and a hash of its bytes.
 *
 * **This is what makes AC-8 an enumeration of what the build WROTE rather than of what it ADDED.** A
 * snapshot of path *names* answers only *did this path exist before*, so a build that **overwrote**
 * an existing file — a tracked source, another package's manifest, a configuration at the repository
 * root — is subtracted away by the very comparison meant to find it. Content and timestamp together
 * make an overwrite as visible as a creation; walking from the **workspace** rather than from each
 * emitting package is what puts a write outside any package root in scope at all. Both halves are
 * demonstrated to have a subject below rather than argued for here.
 *
 * The one write this cannot see is a rewrite identical in bytes *and* in timestamp, which no
 * compiler produces and which nothing short of instrumenting the process would observe.
 */
function inventory(root: string, prune: readonly string[] = UNAUDITED): Map<string, string> {
  return new Map(filesUnder(root, prune).map((relative) => {
    const full = path.join(root, relative);
    const stat = fs.statSync(full);
    return [relative, `${stat.size}:${stat.mtimeMs}:${createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`];
  }));
}

/** Every path whose fingerprint `after` does not share with `before` — created or overwritten. */
const writtenBetween = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...after].filter(([relative, mark]) => before.get(relative) !== mark).map(([relative]) => relative).sort();

/** Every path `before` held that `after` does not. */
const removedBetween = (before: Map<string, string>, after: Map<string, string>): string[] =>
  [...before.keys()].filter((relative) => !after.has(relative)).sort();

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
  test('built into a clean tree, the emit and the declaration agree in both directions', () => {
    // Verified by building and enumerating, never by reading the declaration — "A check is not
    // established by reading it" (2026-08-29). It runs against the REAL workspace and that siting is
    // load-bearing (R-4): with no build step in CI, the forced workspace suite is the only thing
    // that builds this repository's own packages on every push, so a fixture-only AC-8 would leave
    // the real emit unbuilt until Q-0098.
    //
    // **The comparison is over the whole workspace and over file CONTENT**, which is two corrections
    // to the shape this started as. A per-package snapshot of path names answers only *did this path
    // exist before*, so it subtracts away an overwrite of a file that was already there and never
    // looks at anything outside an emitting package at all — the two ways a build can write
    // something nobody declared. {@link inventory} and {@link UNAUDITED} carry the reasoning; the
    // clause after this one shows the two cases the old shape missed.
    //
    // Snapshotted AFTER the emit is removed, so `written` is what this build produced rather than
    // what this build produced *and an earlier one had not already left behind*. Taking it first
    // makes the difference empty in any checkout that has ever built, which is a test whose subject
    // depends on the checkout — the class this ticket keeps meeting.
    const tasks = emitting();
    removeEmit();
    const before = inventory(WORKSPACE);
    runBuild('--force');
    // One `after`, read once and shared: two reads could disagree, and a comparison whose two halves
    // are taken against different states of the tree is one whose verdict has no single subject.
    const after = inventory(WORKSPACE);
    const written = writtenBetween(before, after);

    expect(written.length, 'the build wrote nothing anywhere — the enumeration has no subject').toBeGreaterThan(0);

    // Nothing in the audited region was deleted. `removeEmit()` ran before the snapshot, so no
    // emitted path is in `before` and this clause is entirely about what lives outside the emit: a
    // build that removed a source file, a manifest or a configuration would be reported here and by
    // nothing else, since a comparison of what CHANGED cannot see what stopped existing.
    expect(removedBetween(before, after), 'the build removed files outside its own emit').toStrictEqual([]);

    // Every written path belongs to some emitting package's emit directory. This is the clause that
    // covers writes **outside a package root** — a file at the repository root, in `docs/`, in
    // `spike/`, in a package that emits nothing, or in another package's `src/` — none of which a
    // per-package walk could have been asked about. The two untracked `tsc` outputs this ticket
    // opened on, `packages/shared/test/corpus.js` and `corpus.d.ts`, emitted beside their source
    // because nothing configured an `outDir`, are what one looks like; `.gitignore` matched neither,
    // so "it is gitignored anyway" was not available as a defence.
    const emitRoots = tasks.map((task) => ({ task, prefix: `${task.directory}/${EMIT}/` }));
    const strays = written.filter((relative) => !emitRoots.some(({ prefix }) => relative.startsWith(prefix)));
    expect(strays, `the build wrote outside every emitting package's ${EMIT}/`).toStrictEqual([]);

    const declared = rootTurbo().tasks.build.outputs ?? [];
    for (const { task, prefix } of emitRoots) {
      // Package-relative, because `outputs` patterns are resolved against the package directory.
      const mine = written.filter((relative) => relative.startsWith(prefix))
        .map((relative) => relative.slice(task.directory.length + 1));
      expect(mine.length, `${task.package} wrote nothing — its half of the enumeration has no subject`).toBeGreaterThan(0);

      // Direction 1: nothing the build wrote falls outside the declaration. An undeclared emit is
      // the stale-artifact hazard in its exact form — turbo neither caches nor restores it, so a
      // cache hit yields a package that is missing a file something downstream executes.
      const undeclared = mine.filter((relative) => !declared.some((pattern) => path.matchesGlob(relative, pattern)));
      expect(undeclared, `${task.package} wrote paths no outputs pattern covers`).toStrictEqual([]);

      // Direction 2: no declared pattern matches nothing. Over-declaring cannot be caught by
      // direction 1, and a pattern that has stopped matching is a declaration nobody re-read.
      for (const pattern of declared) {
        expect(
          mine.some((relative) => path.matchesGlob(relative, pattern)),
          `${task.package}: the outputs pattern ${pattern} matches nothing the build wrote`,
        ).toBe(true);
      }
    }
  }, 300_000);

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
    // content or the walk stops starting at the workspace, and it fails the other way — as a false
    // claim about the old shape — if the old shape would in fact have caught 2 or 3.
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

  test('and each name the audit prunes excuses a real file, so a sixth arrives with a subject', () => {
    // The exclusion list is what decides the audit's reach, so every entry is a claim and each is
    // shown to do work — a fixture per entry, derived from the list rather than written out, which
    // is the shape `frame.source.test.ts` already uses for its own. Showing that the pruning fires
    // proves the pruning fires and not that each entry does (Q-0071), which is why this loops.
    //
    // `.harness` and `.quorum` are the two that matter most and the two hardest to reach any other
    // way: they hold a concurrent run's worktrees and its run history, so without them a run
    // happening while this test is between its two inventories reports a stray that no build wrote
    // — a verdict about the machine, which is what the pruning buys and what this clause prices.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-unaudited-'));
    try {
      fs.writeFileSync(path.join(sandbox, 'kept.txt'), 'before\n');
      const before = inventory(sandbox);
      for (const name of UNAUDITED) {
        fs.mkdirSync(path.join(sandbox, name, 'nested'), { recursive: true });
        fs.writeFileSync(path.join(sandbox, name, 'nested', 'written.txt'), 'during\n');
      }
      fs.writeFileSync(path.join(sandbox, 'kept.txt'), 'after\n');

      // An identity and not a count, because the fixtures are derived from the list: removing an
      // entry would otherwise remove its own subject and leave the behavioural assertion green over
      // a shorter rule (Q-0073, "a count is not an identity").
      expect(UNAUDITED, 'the audit\'s reach moved — each entry is a named claim').toStrictEqual([
        'node_modules', '.git', '.turbo', '.harness', '.quorum',
      ]);
      expect(writtenBetween(before, inventory(sandbox)), 'the audit descended into a name it claims to prune')
        .toStrictEqual(['kept.txt']);
      for (const name of UNAUDITED) {
        expect(fs.existsSync(path.join(sandbox, name, 'nested', 'written.txt')), `${name} excuses nothing — its fixture is not there`).toBe(true);
        expect(
          writtenBetween(before, inventory(sandbox, UNAUDITED.filter((other) => other !== name))),
          `${name} prunes nothing — dropping it from the list changes no answer`,
        ).toContain(`${name}/nested/written.txt`);
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
      const stale = filesUnder(path.join(WORKSPACE, task.directory)).filter((relative) => relative.endsWith('.tsbuildinfo'));
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
    const candidates = (): string[] => filesUnder(PACKAGE);
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
