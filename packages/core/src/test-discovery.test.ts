/**
 * Q-0054 — a test file that lands anywhere is collected, and a package that has one runs it.
 *
 * The chain from *a new failing file appears* to *`pnpm test` fails* has four links, and until this
 * ticket nobody held the first two. `spike/test/run.js` reads its directory and executes every
 * `*.js` it finds, and its header says why: qa-red proves a red phase by writing NEW test files and
 * asserting the suite fails, so a runner blind to them reports green while `integrate --expect fail`
 * loops to a gate having proved nothing. The workspace's configured include stopped at `src`, so
 * three of the places a red phase would put a file — {@link NEWLY_COLLECTED} — were collected by
 * nothing at all. Measured, not assumed: the ticket body called it *"worth an explicit check rather
 * than an assumption"*, and the assumption was wrong.
 *
 * Four links, each with the clause that holds it:
 *
 * - **the include collects it** — {@link collects} over every `*.test.ts` in every workspace
 *   package, and over the three paths that used to be invisible (AC-5, AC-6);
 * - **the package runs it** — every package the workspace globs match declares a `test` script, so
 *   turbo has something to invoke rather than a package it skips in silence (AC-7);
 * - **`$TURBO_DEFAULT$` puts it in that package's `test` hash**, so a cached pass cannot stand over
 *   it — asserted in `turbo-inputs.test.ts`, which is where that claim already lives;
 * - **CI forces regardless** — asserted in `test-command.test.ts`, likewise.
 *
 * **This guard writes nothing.** The negative half of every clause is a synthetic path handed to
 * {@link collects}, never a file created beside the reader: a fixture on disk makes the answer
 * depend on what the checkout contains and gives a test a side effect on the tree it is judging,
 * which Q-0073 rejected by name. Proving discovery through the real package graph means writing into
 * `packages/core/src/`, so that proof is gate evidence (AC-12) rather than a suite member, and it is
 * said here so its absence is not read as an oversight.
 *
 * **Where the include comes from.** `packages/core/test/vitest-include.ts` takes Vitest's own
 * defaults, and AC-6's first test closes the loop from `vitest.shared.js`'s text: the configuration
 * must import `configDefaults` from the same module and declare exactly those. That indirection is
 * `allowJs` being off — importing the configuration would change how every package compiles — and it
 * is the one place this file could drift from its subject.
 *
 * **One deliberate reading of the checkout.** {@link workspacePackages} decides membership the way
 * pnpm decides it, from a `package.json` on disk. That is existence used to *classify*, which
 * Q-0073 ruled against in general, and it is correct here for the reason the general rule is: the
 * question *is* a working-tree question, because it is the one pnpm and turbo themselves answer
 * that way. The residual is stated rather than left to be found — an untracked `packages/scratch/`
 * carrying a `package.json` fails this guard on the machine that has it, and it would equally be a
 * package turbo tried to run tasks in.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { repoFile, repoRoot } from '../test/corpus.js';
import { collects, includePatterns } from '../test/vitest-include.js';

/** As much of a package manifest as these assertions read. */
interface Manifest {
  scripts?: Record<string, string>;
}

/** The three tasks the root `turbo.json` declares, and therefore the three every package owes. */
const TASKS = ['lint', 'typecheck', 'test'] as const;

/** The include as it stood before this ticket — the fixture that makes the widening demonstrable. */
const BEFORE_Q0054 = ['src/**/*.test.ts'] as const;

/**
 * The three locations a red phase may write to that the narrow include collected with nothing.
 *
 * Measured at `3cbebf5` and re-derived here rather than trusted: each is asserted false under
 * {@link BEFORE_Q0054} and true under the configured include, so the defect is exhibited before it
 * is closed rather than asserted over the fixed configuration alone.
 */
const NEWLY_COLLECTED = ['test/x.test.ts', 'x.test.ts', 'src/x.test.js'] as const;

/** Every entry directly below `relative`, which is a path from the repository root. */
const entriesIn = (relative: string): fs.Dirent[] =>
  fs.readdirSync(path.join(repoRoot, relative), { withFileTypes: true });

/** One file inside a workspace package, read through the corpus so a missing one fails loudly. */
const packageFile = (pkg: string, name: string): string => repoFile(`${pkg}/${name}`);

/**
 * The workspace packages, expanded from `pnpm-workspace.yaml` rather than written down.
 *
 * A glob shape this expansion does not understand is a failure that names it, never a package
 * quietly left out: a hand-written list is what Q-0051 found failing open in
 * `q0050.source.test.ts`, where a seventh engine file went unscanned while the suite reported green.
 * Only `<dir>/*` is understood, which is every glob this workspace declares; a `!` exclusion or a
 * `**` changes what turbo runs and is refused until somebody teaches this the new shape.
 *
 * @throws {Error} when the file declares no globs, when one is not `<dir>/*`, or when a glob
 *   matches no package at all — each of which would otherwise narrow every clause below in silence.
 */
function workspacePackages(): string[] {
  const globs = (parseYaml(repoFile('pnpm-workspace.yaml')) as { packages?: string[] }).packages ?? [];
  if (!globs.length) throw new Error('pnpm-workspace.yaml declares no packages — this guard has no subject');
  const found = globs.flatMap((glob) => {
    const parent = /^([A-Za-z0-9._-]+)\/\*$/.exec(glob);
    if (!parent) throw new Error(`pnpm-workspace.yaml declares '${glob}', a shape this guard does not expand`);
    const matched = entriesIn(parent[1])
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => `${parent[1]}/${entry.name}`)
      .filter((pkg) => fs.existsSync(path.join(repoRoot, pkg, 'package.json')));
    if (!matched.length) throw new Error(`pnpm-workspace.yaml's '${glob}' matches no package`);
    return matched;
  });
  return found.sort();
}

/**
 * Every `*.test.ts` below `pkg`, at any depth, as paths relative to the package root.
 *
 * `node_modules` is skipped by name because Vitest excludes it by default and a dependency's own
 * test files are not this workspace's to collect.
 */
function testFilesIn(pkg: string): string[] {
  const walk = (relative: string, below: string): string[] =>
    entriesIn(relative).flatMap((entry) => {
      if (entry.name === 'node_modules') return [];
      const next = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return walk(`${relative}/${entry.name}`, next);
      return entry.name.endsWith('.test.ts') ? [next] : [];
    });
  return walk(pkg, '').sort();
}

const PACKAGES = workspacePackages();

describe('Q-0054 AC-5 — no test file in this workspace is collected by nothing', () => {
  test('the walk finds packages and files at all — otherwise everything below passes over nothing', () => {
    // The positive control, and the reason it is first: every failure mode of the expansion and of
    // the walk hides files rather than inventing them, so a guard that had lost its subject would
    // report success. That is the defect this whole file exists to close, one level in.
    expect(PACKAGES.length, 'the workspace globs expand to no package').toBeGreaterThan(1);
    const all = PACKAGES.flatMap(testFilesIn);
    expect(all.length, 'the walk finds no test file — this guard proves nothing').toBeGreaterThan(40);
    expect(all, 'the walk does not find the file it is running in').toContain('src/test-discovery.test.ts');
  });

  test.each(PACKAGES)('%s resolves the one shared configuration', (pkg) => {
    // What makes "the include its package resolves to" one question rather than seven: a package
    // that stopped re-exporting the shared file could narrow its own collection silently.
    expect(packageFile(pkg, 'vitest.config.js').trim())
      .toBe(`export { default } from '../../vitest.shared.js';`);
  });

  test.each(PACKAGES)('%s has every one of its test files collected', (pkg) => {
    const uncollected = testFilesIn(pkg).filter((relative) => !collects(relative));
    expect(uncollected, `${pkg} holds test files the include collects with nothing`).toEqual([]);
  });

  test('and the matcher discriminates, so "collected" is not a constant', () => {
    // Both directions over real paths in this package: a file Vitest is running right now is
    // collected, and two files beside it are not. A matcher answering true for everything would
    // satisfy every clause above while proving nothing.
    expect(collects('src/test-discovery.test.ts')).toBe(true);
    expect(collects('test/vitest-include.ts')).toBe(false);
    expect(collects('src/index.ts')).toBe(false);
  });
});

describe('Q-0054 AC-6 — a red test lands where a red phase would put it, and is collected', () => {
  test('the include is Vitest\'s own default, and the configuration names it rather than narrowing it', () => {
    const shared = repoFile('vitest.shared.js');
    expect(shared, 'the widest documented pattern is the one a red phase can be written against')
      .toMatch(/include:\s*\[\.\.\.configDefaults\.include\]/);
    expect(shared, 'the include is taken by reference, never transcribed')
      .toContain(`import { configDefaults, defineConfig } from 'vitest/config';`);
    expect(includePatterns.length, 'vitest declares no default include').toBeGreaterThan(0);
  });

  test.each(NEWLY_COLLECTED)('%s was collected by nothing before this ticket, and is collected now', (relative) => {
    expect(collects(relative, BEFORE_Q0054), 'the narrow include collected this — the fixture is wrong').toBe(false);
    expect(collects(relative), 'this ticket did not widen far enough to reach it').toBe(true);
  });

  test('and the fixture is not simply broken — the narrow include still collected what it always did', () => {
    // Isolating the widening: the pre-change pattern is a real one that really collected the whole
    // suite, so the three rows above fail it for the reason the criterion names rather than because
    // the fixture collects nothing at all.
    expect(collects('src/engine/diff.test.ts', BEFORE_Q0054)).toBe(true);
    expect(collects('src/index.test.ts', BEFORE_Q0054)).toBe(true);
  });

  test('AC-6(a) — the test-support modules stay non-suites, by name and not by directory', () => {
    // Three of their headers used to say `test/` was safe because the include stopped at `src`. It
    // does not any more, so the reason is now their names, and each is asserted rather than read.
    const helpers = [
      'packages/core/test/cli-stub.ts', 'packages/core/test/corpus.ts', 'packages/core/test/env.ts',
      'packages/core/test/repo.ts', 'packages/core/test/run-fixture.ts',
      'packages/core/test/strict-schema.ts', 'packages/core/test/vitest-include.ts',
      'packages/shared/test/corpus.ts',
    ];
    for (const helper of helpers) {
      const relative = helper.replace(/^packages\/[a-z]+\//, '');
      expect(collects(relative), `${helper} would now be run as a suite`).toBe(false);
      expect(repoFile(helper), `${helper} still cites the narrow include as the reason it is safe`)
        .not.toContain('src/**/*.test.ts');
    }
  });

  test('AC-6(b) — the live-CLI probe still selects itself out without the switch', () => {
    // A BYOS-adjacent path is not left to inspection: widening the include must not turn a paid
    // probe into an ordinary suite member.
    expect(repoFile('packages/core/src/adapters/real-cli.probe.test.ts'))
      .toContain('describe.skipIf(!process.env.QUORUM_REAL_CLI)');
  });
});

describe('Q-0054 AC-7 — turbo run reaches every workspace package', () => {
  test.each(PACKAGES)('%s declares lint, typecheck and test', (pkg) => {
    // A package with no `test` script is skipped by turbo in silence, which is AC-6's failure one
    // layer up. All seven satisfy this today, so this is drift protection and not a fix — and it is
    // derived from the globs, so a package added later is covered without anyone remembering.
    const scripts = (JSON.parse(packageFile(pkg, 'package.json')) as Manifest).scripts ?? {};
    for (const task of TASKS) {
      expect(scripts[task] ?? '', `${pkg} declares no ${task} script`).not.toBe('');
    }
  });
});

/**
 * Every `node:fs` API that creates, changes or removes something.
 *
 * Matched with a following `(`, so the list does not report itself: a call is a name applied to
 * arguments, and the entries here are quoted values. Q-0079's first review round found a guard that
 * could be talked out of firing by text it does not execute, in this exact shape.
 */
const WRITE_APIS = [
  'writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir',
  'mkdtempSync', 'mkdtemp', 'rmSync', 'rm', 'rmdirSync', 'rmdir', 'unlinkSync', 'unlink',
  'renameSync', 'rename', 'openSync', 'open', 'createWriteStream', 'copyFileSync', 'copyFile',
  'cpSync', 'cp', 'symlinkSync', 'symlink', 'truncateSync', 'truncate', 'chmodSync', 'chmod',
];

/** The write APIs `text` calls, as opposed to the ones it merely names. */
const writesIn = (text: string): string[] =>
  WRITE_APIS.filter((api) => new RegExp(`\\b${api}\\s*\\(`).test(text));

describe('Q-0054 AC-5 — neither new guard writes to the reader\'s tree', () => {
  test.each(['packages/core/src/test-discovery.test.ts', 'packages/core/src/spike-parity.test.ts'])(
    '%s calls no filesystem write', (guard) => {
      expect(writesIn(repoFile(guard)), `${guard} writes to the tree it is judging`).toEqual([]);
    });

  test('and the scan has a subject — the same list finds the writes in a module that performs them', () => {
    // An empty answer above is an absence rather than a pattern that never matches anything.
    expect(writesIn(repoFile('packages/core/test/repo.ts'))).not.toEqual([]);
  });
});
