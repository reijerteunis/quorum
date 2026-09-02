/**
 * Q-0090 AC-8 (no command is implemented and no domain helper is copied), AC-4(d) (no signal
 * handler) and AC-12 (BYOS), as properties of this package's source rather than of one file
 * somebody remembered to list.
 *
 * **No file list is written down here**, and there are two of them because the criteria have two
 * subjects. AC-8 is about *modules*, so it derives recursively from `src`. AC-12 and AC-4(d) say
 * `packages/cli`, so they derive from what the package carries in any extension — see
 * {@link packageFiles}. A hand-written list is the failure Q-0051 found in
 * `q0050.source.test.ts`'s third list: it mapped over six names, a seventh file went unscanned, and
 * the suite reported green.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** The directory the module scans walk — this package's `src`, reached package-relatively. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** This package's root, the subject AC-12 and AC-4(d) name. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/**
 * This file, excluded from the scans below because it quotes every string they look for.
 *
 * Spelled twice because the two inventories speak two vocabularies, and derived rather than typed
 * so that renaming this file cannot leave an exclusion excusing a file that is no longer here.
 */
const GUARD = path.relative(SRC, fileURLToPath(import.meta.url));
const GUARD_IN_PACKAGE = path.relative(PACKAGE, fileURLToPath(import.meta.url));

/** Every TypeScript file below `src`, as `[path relative to src, text]`, derived from the tree. */
const files = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')];
  });

/** The production half: everything that is not a test, and the subject AC-8 names. */
const production = (): [string, string][] => files().filter(([name]) => !name.endsWith('.test.ts'));

/**
 * Directory names the walk prunes, and the whole of what {@link inventory} excludes.
 *
 * Enumerated rather than delegated to `.gitignore`, because the two guards that ask for an
 * inventory ask two different questions. `packages/core/src/turbo-inputs.test.ts` asks *what does
 * turbo hash*, and answers it with `git ls-files --exclude-standard` — see *"Membership is a git
 * question, not a filesystem one"* (2026-08-28), whose argument is about a build tool's inputs.
 * AC-12 asks whether a credential is **present in this package's tree**, and a credential in an
 * ignored file is still on disk, still readable by any agent given `input.repo: true`, and still
 * one `git add -f` from being published — so the question is what exists, and existence is a
 * filesystem question. Two questions, two inventories, and neither decision needs amending. Ruled
 * in `requirements/errata.md` E-1, which exists to pre-empt the reading that would restore
 * `--exclude-standard` here.
 *
 * Every entry is installed or generated, nothing under any of them is authored, and each is
 * demonstrated below to excuse a real file rather than to sit in the list unexercised.
 *
 * **`dist` is the emitted output, and it is here because Q-0097 built it.** This said *"emitted
 * output is deliberately not among them"* while the workspace emitted nothing and the layout was
 * Q-0096's to choose — correct then, and false the moment a `build` task wrote `packages/cli/dist`.
 * `tsconfig.build.json` excludes every test file under `src`, so what lands there today is
 * production modules; the exclusion is what makes that a *choice* rather than something the scan
 * happens not to trip over, because an emitted copy of THIS file would carry every pattern below and
 * turn the scan red — and only in a checkout that had run a build, which is the
 * verdict-from-the-checkout defect Q-0096's round 2 caught in the assertion next door. Demonstrated
 * below in both directions.
 *
 * **There is no binary exclusion either**, and that direction is deliberate: text is decoded as
 * UTF-8 unconditionally, and a lossy decode can only make a scan report *more* than it should,
 * where an exclusion is the only thing that can make it report less.
 */
const GENERATED = ['node_modules', '.turbo', 'dist'];

/**
 * Every file below `root`, as paths relative to it, with {@link GENERATED} pruned.
 *
 * Pruned during the walk rather than filtered after it, so an installed dependency tree is never
 * read — the exclusion is what keeps this affordable as well as what keeps it narrow.
 *
 * An entry that is neither a file nor a directory **stops the guard** rather than being dropped
 * silently: a third case nobody enumerated is an exclusion nobody wrote down, which is exactly what
 * E-1 rules against. This package has none today and the refusal is demonstrated over a sandbox
 * below, so the clause is known to fire rather than assumed to.
 *
 * @param root the directory to walk — this package, unless a test hands it a sandbox.
 * @param prune the directory names to skip. A parameter so a fixture can ask the same question of
 *   the list as it stood **before** Q-0097 added the emit, which is what makes that entry
 *   demonstrable rather than asserted — the shape `collects(relative, patterns)` already uses in
 *   `packages/core/test/vitest-include.ts` for the same reason.
 */
function inventory(root: string, prune: readonly string[] = GENERATED): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!prune.includes(entry.name)) walk(full);
      } else if (entry.isFile()) {
        found.push(path.relative(root, full));
      } else {
        throw new Error(
          `inventory: ${path.relative(root, full)} is neither a file nor a directory — this guard `
          + 'answers for everything the package carries, so it refuses to drop an entry it cannot classify',
        );
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Every file this package carries, as `[package-relative path, text]`, whatever its extension.
 *
 * AC-12 names `packages/cli/**` rather than `packages/cli/src/**`, so the manifest, the three
 * configuration files and any fixture or documentation a later ticket adds are all in scope — a
 * credential in `package.json` is a credential.
 *
 * **Membership is the filesystem's question here**, for the reason {@link GENERATED} gives: an
 * ignored file is still a file, and a guard enforcing a product boundary answers for what is on
 * disk. The exclusions are the two names in that list plus this file, all three enumerated and each
 * asserted to excuse something.
 *
 * **No verdict below depends on whether this checkout has run a build**, which since Q-0097 is a
 * property the {@link GENERATED} entry for `dist` *restores* rather than one the workspace supplies:
 * the emit exists after `turbo run build` and not before, and it is pruned, so the answer is the
 * same either way. Asserted rather than claimed — a test below runs both scans over this package
 * with the artifact present and absent and requires identical verdicts. The same reasoning covers
 * `node_modules/` and `.turbo/`, which exist after an install and a test run and not before, so what
 * they contain is asserted over a directory this file builds rather than over this package — a
 * gitignored directory that *use* creates may not move an answer (Q-0073).
 */
const packageFiles = (): [string, string][] => inventory(PACKAGE)
  .map((name) => [name, fs.readFileSync(path.join(PACKAGE, name), 'utf8')]);

/** Modules a frame that reads, writes, spawns or prompts would have to import. */
const IO_MODULE = /from '(node:fs[^']*|node:child_process|node:readline[^']*|node:os|node:path|node:url)'/;

describe('the module scan has a subject', () => {
  test('it finds this package\'s modules, both halves are non-empty, and the paths are distinct', () => {
    const names = files().map(([name]) => name);
    expect(names, 'src holds no TypeScript — every scan below proves nothing').toContain('main.ts');
    expect(names, 'this file is outside its own scan — the exclusions below excuse nothing').toContain(GUARD);
    expect(production().length).toBeGreaterThan(4);
    expect(files().length).toBeGreaterThan(production().length);
    expect(names.sort()).toStrictEqual([...new Set(names)].sort());
  });
});

/**
 * Symbols that execute a run, write the backlog or open a project on disk.
 *
 * Every one lives in `@quorum/core` and belongs to a sibling ticket. The frame is a presentation
 * layer over an API that already exists; a helper that appears to be missing from `core` is
 * reported rather than reimplemented here (Q-0090 ground rule 4).
 */
const DOMAIN = [
  'runFlow', 'loadFlow', 'loadFlowByName', 'lintFlowDirectory', 'lintDirectory',
  'Backlog', 'loadProject', 'findProject', 'getAdapter', 'probeAdapter',
  'validateArtifact', 'containment', 'overrideAdapters',
];

describe('AC-8 — no command is implemented and no domain helper is copied', () => {
  test('no production module names a run-executing or backlog-writing symbol', () => {
    const offenders = DOMAIN.flatMap((symbol) => production()
      .filter(([, text]) => new RegExp(`\\b${symbol}\\b`).test(text))
      .map(([name]) => `${name}: ${symbol}`));
    expect(offenders, 'these belong to @quorum/core and to a sibling command ticket').toStrictEqual([]);
    expect(DOMAIN.length, 'the symbol list is empty — this test proves nothing').toBeGreaterThan(10);
  });

  test('and that scan has a subject — the symbol names are found where they are written down', () => {
    // Demonstrated over this file, which names all thirteen: the regexes match real text rather
    // than never matching anything.
    const here = files().find(([name]) => name === GUARD);
    expect(here).toBeDefined();
    expect(DOMAIN.filter((symbol) => new RegExp(`\\b${symbol}\\b`).test(here?.[1] ?? ''))).toStrictEqual(DOMAIN);
  });

  test('no production module imports a filesystem, process-spawning or terminal module', () => {
    // The frame reads nothing, writes nothing, spawns nothing and prompts for nothing. The gate
    // reader that owns `node:readline` is Q-0094's; the commands that open a project are Q-0091's
    // to Q-0093's.
    expect(production().filter(([, text]) => IO_MODULE.test(text)).map(([name]) => name)).toStrictEqual([]);
  });

  test('and that clause has a subject — this package\'s tests do import them', () => {
    expect(files().filter(([, text]) => IO_MODULE.test(text)).length).toBeGreaterThan(2);
  });
});

describe('AC-4(d) — 130 is a row of the table and nothing installs a handler for it', () => {
  test('no file in this package registers a signal handler', () => {
    // `core` installs none either (Q-0050 AC-5), so the handler is this package's to place — and it
    // is Q-0094's, with `run`. The spike's engine registers both SIGINT and SIGTERM through one
    // `process.once` handler at `spike/src/engine.js:113–114` and exits 130 at `:111`.
    //
    // Over the package rather than over `src/**/*.ts`, because the criterion's subject is
    // `packages/cli` and `vitest.config.js` is executable too. Same reasoning as AC-12's scan, and
    // widened in the same change so the claim and the subject do not disagree here either.
    const offenders = packageFiles()
      .filter(([name]) => name !== GUARD_IN_PACKAGE)
      .filter(([, text]) => /process\.(on|once|addListener)\s*\(\s*['"]SIG/.test(text))
      .map(([name]) => name);
    expect(offenders).toStrictEqual([]);
  });

  test('and loading the frame adds none at runtime', async () => {
    // Counted before and after rather than asserted to be zero: whatever the test runner installs
    // for itself is not this package's, and a verdict that depended on it would be a property of
    // the runner rather than of the commit.
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    await import('./index.js');
    expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') })
      .toStrictEqual(before);
  });
});

/** Every spelling that would mean a key, a token or a credential had a path through the CLI. */
const CREDENTIAL = [
  /API_KEY/i, /\bapiKey\b/i, /ANTHROPIC_/, /OPENAI_/, /CODEX_/,
  /\bbearer\b/i, /\bcredential/i, /\bsecret\b/i, /\bauth[- ]?token\b/i,
];

describe('AC-12 — BYOS: no API-key path exists anywhere in this package', () => {
  test('nothing in source, test, fixture, configuration or help text matches any credential spelling', () => {
    const offenders = CREDENTIAL.flatMap((pattern) => packageFiles()
      .filter(([name]) => name !== GUARD_IN_PACKAGE)
      .filter(([, text]) => pattern.test(text))
      .map(([name]) => `${name}: ${pattern.source}`));
    expect(offenders, 'adapters run on the vendor CLI\'s own login; there is no key path').toStrictEqual([]);
  });

  test('and the scan reaches past src and past TypeScript, which is the whole of what AC-12 asks', () => {
    // Without this, the criterion's claim is `packages/cli/**` and its subject is `src/**/*.ts`: a
    // credential in the manifest, in a JSON fixture or in a package-level document passes unnoticed
    // while the suite reports green. Each of the four is named, so losing one is a failure rather
    // than a quietly smaller scan.
    const names = packageFiles().map(([name]) => name);
    for (const outside of ['package.json', 'turbo.json', 'tsconfig.json', 'vitest.config.js']) {
      expect(names, `${outside} is not scanned — a credential in it would pass unnoticed`).toContain(outside);
    }
    expect(names, 'the scan no longer reaches the modules').toContain(path.join('src', 'main.ts'));
    expect(names.filter((name) => !name.endsWith('.ts')).length).toBeGreaterThan(3);
    expect(names.sort()).toStrictEqual([...new Set(names)].sort());
  });

  test('the self-exclusion is load-bearing, and it is the only one', () => {
    // This file quotes every pattern above, so scanning it would report itself — and it is the
    // *only* file the exclusion excuses, which is the half that stops the exclusion from growing
    // into a filter. Demonstrated rather than assumed.
    const matching = packageFiles()
      .filter(([, text]) => CREDENTIAL.some((pattern) => pattern.test(text)))
      .map(([name]) => name);
    expect(matching).toStrictEqual([GUARD_IN_PACKAGE]);
  });

  test('an ignored file is scanned, which is the whole of what E-1 ruled', () => {
    // The finding this replaces: `git ls-files --exclude-standard` drops every ignored file, so a
    // gitignored fixture, documentation example, shell script or local config carrying a credential
    // passed a guard whose criterion covers all of `packages/cli/**`. Pinned over a repository this
    // test builds, where both sides are values it set itself.
    //
    // Both halves are asserted, because the first alone could pass over a `.gitignore` that never
    // ignored anything: git is *shown* to drop the file, and the inventory is shown to carry it.
    // Restoring `--exclude-standard` turns the second assertion red.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-inventory-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
      fs.writeFileSync(path.join(sandbox, '.gitignore'), 'ignored/\n');
      fs.mkdirSync(path.join(sandbox, 'ignored'));
      fs.writeFileSync(path.join(sandbox, 'ignored', 'notes.txt'), 'ANTHROPIC_API_KEY=x\n');
      const credential = path.join('ignored', 'notes.txt');

      const tracked = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).split('\0').filter((entry) => entry !== '');
      expect(tracked, 'the fixture is not ignored, so it discriminates nothing').not.toContain(credential);
      expect(inventory(sandbox), 'an ignored credential is invisible again — E-1').toContain(credential);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('each enumerated exclusion excuses a real file, and nothing else is dropped', () => {
    // A fixture per entry, derived from the list rather than written out, so a third exclusion added
    // later arrives with a subject or fails here. Showing that the pruning fires proves the pruning
    // fires and not that each entry does (Q-0071), which is why this loops.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-generated-'));
    try {
      fs.writeFileSync(path.join(sandbox, 'kept.json'), '{}\n');
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'kept.ts'), 'export const kept = 1;\n');
      for (const name of GENERATED) {
        fs.mkdirSync(path.join(sandbox, name, 'nested'), { recursive: true });
        fs.writeFileSync(path.join(sandbox, name, 'nested', 'output.txt'), 'ANTHROPIC_API_KEY=x\n');
      }

      // An identity and not a count, because the fixtures are derived from the list: removing an
      // entry would otherwise remove its own subject, and the behavioural assertion below would
      // stay green over a shorter rule. A count of two would too. So the list is written out once
      // more, and that is what makes a removal visible (Q-0073, "a count is not an identity").
      expect(GENERATED, 'the exclusion list moved — each entry is a named claim').toStrictEqual([
        'node_modules', '.turbo', 'dist',
      ]);
      expect(inventory(sandbox).sort()).toStrictEqual(['kept.json', path.join('src', 'kept.ts')]);
      for (const name of GENERATED) {
        expect(
          fs.existsSync(path.join(sandbox, name, 'nested', 'output.txt')),
          `${name} excuses nothing — the fixture it prunes is not there`,
        ).toBe(true);
      }
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('Q-0097 AC-12 — an emitted copy of a test file turns this scan red without the emit exclusion', () => {
    // **The two-directional demonstration**, which is what proves the `dist` entry has a subject
    // rather than being a precaution. The fixture is an emitted copy of a test file — the exact
    // thing `tsc` would write from `src/` if `tsconfig.build.json` did not exclude `src/**/*.test.ts`
    // — and it carries a pattern this scan looks for, so:
    //
    //   - under the list as it stood BEFORE this ticket, the scan finds it and goes red;
    //   - under the list as it stands now, the scan does not see it at all.
    //
    // Both directions in one fixture, so neither can be satisfied by a walk that collects nothing.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-emit-'));
    try {
      const BEFORE_Q0097 = ['node_modules', '.turbo'];
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'frame.source.test.ts'), 'const CREDENTIAL = [/API_KEY/i];\n');
      fs.mkdirSync(path.join(sandbox, 'dist'));
      fs.writeFileSync(path.join(sandbox, 'dist', 'frame.source.test.js'), 'const CREDENTIAL = [/API_KEY/i];\n');
      const emitted = path.join('dist', 'frame.source.test.js');

      const matching = (prune: readonly string[]): string[] => inventory(sandbox, prune)
        .filter((name) => CREDENTIAL.some((pattern) => pattern.test(fs.readFileSync(path.join(sandbox, name), 'utf8'))));

      expect(matching(BEFORE_Q0097), 'the emitted copy was invisible before the exclusion — the fixture proves nothing')
        .toContain(emitted);
      expect(matching(GENERATED), 'the emit exclusion does not reach an emitted test file').not.toContain(emitted);
      expect(matching(GENERATED), 'the exclusion swallowed the source file too, which is not what it is for')
        .toStrictEqual([path.join('src', 'frame.source.test.ts')]);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('Q-0097 AC-12 — both scans return identical verdicts with the artifact present and absent', () => {
    // Decision 078(b)'s guarantee applied to this file: whether a checkout has run a build may not
    // move an answer. Asked of BOTH scans this file performs — the one above and AC-4(d)'s
    // signal-handler sweep — because the exclusion is shared and a regression would hit both.
    //
    // Over a sandbox rather than over the live package, for two reasons stated rather than left to
    // be found. A test that built and deleted `packages/cli/dist` would be mutating the tree it is
    // judging (Q-0073), and `src/build.test.ts` — which legitimately does mutate it — runs in a
    // parallel Vitest worker, so the two would race and the flake would look like a code defect.
    // What that file asserts on the live package is the same claim for the collected test set
    // (AC-23); what this asserts is that the walk itself cannot tell the two states apart.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-present-absent-'));
    try {
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'main.ts'), 'export const main = 1;\n');
      const absent = inventory(sandbox);

      fs.mkdirSync(path.join(sandbox, 'dist'));
      fs.writeFileSync(path.join(sandbox, 'dist', 'main.js'), 'export const main = 1;\n');
      fs.writeFileSync(path.join(sandbox, 'dist', 'main.d.ts'), 'export declare const main = 1;\n');
      fs.writeFileSync(path.join(sandbox, 'dist', 'leaked.test.js'), 'const t = "ANTHROPIC_API_KEY";\n');
      const present = inventory(sandbox);

      expect(present, 'the emit is visible to the walk, so every verdict below moves with the checkout')
        .toStrictEqual(absent);
      expect(absent, 'the sandbox holds nothing — both sides are empty and the comparison is vacuous')
        .toStrictEqual([path.join('src', 'main.ts')]);
      expect(fs.existsSync(path.join(sandbox, 'dist', 'leaked.test.js')), 'the fixture emit is not there').toBe(true);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('an entry it cannot classify stops the walk instead of leaving the scan', () => {
    // The exclusion that would otherwise be written nowhere. A symlink is neither `isFile` nor
    // `isDirectory`, so a walk that tested only those two would drop it in silence — an unenumerated
    // exclusion, which is the shape E-1 forbids.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-unclassified-'));
    try {
      fs.symlinkSync(path.join(sandbox, 'nowhere'), path.join(sandbox, 'link'));
      expect(() => inventory(sandbox)).toThrow(/neither a file nor a directory/);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
