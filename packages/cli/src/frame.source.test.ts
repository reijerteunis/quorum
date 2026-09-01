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
 * What git reports for the checkout at `root`, as paths relative to it.
 *
 * `-z` because a path holding a quote or a newline comes back quoted and escaped otherwise, and a
 * listing that silently renames its own entries is the wrong foundation for a membership test.
 * Failure is loud rather than an empty inventory, which would report a pass over nothing.
 *
 * @param root the directory to ask about — this package, unless a test hands it a sandbox.
 */
function inventory(root: string): string[] {
  let raw: string;
  try {
    raw = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (cause) {
    throw new Error(
      `inventory unavailable: git ls-files failed in ${root} — this guard answers for everything the package carries, so it cannot answer without git`,
      { cause },
    );
  }
  return raw.split('\0').filter((entry) => entry !== '');
}

/**
 * Every file this package carries, as `[package-relative path, text]`, whatever its extension.
 *
 * AC-12 names `packages/cli/**` rather than `packages/cli/src/**`, so the manifest, the three
 * configuration files and any fixture or documentation a later ticket adds are all in scope — a
 * credential in `package.json` is a credential.
 *
 * **Membership is git's question, not the filesystem's.** A `readdirSync` walk of the package root
 * also collects `node_modules/` and `.turbo/`, which would then need a hand-written exclusion list —
 * and a list is the wrong instrument twice over: it rots as generated directories appear, and this
 * repository has already found one excusing nothing while reading as coverage (Q-0073).
 * `git ls-files --cached --others --exclude-standard` is the same question turbo asks and gives the
 * same answer: tracked and untracked-unignored in, ignored out. See *"Membership is a git question,
 * not a filesystem one"* (2026-08-28). It is also why no verdict here depends on whether this
 * checkout happens to have run a build: `.turbo/` exists after a test run and not before, and the
 * rule is that a gitignored directory *use* creates may not move an answer.
 *
 * Text is decoded as UTF-8 unconditionally and nothing is excluded as binary. That direction is
 * deliberate: a lossy decode can only make a scan report more than it should, where an exclusion is
 * the only thing that could make it report less.
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

  test('generated content is excluded by git and not by a list, demonstrated over a repository this test builds', () => {
    // The exclusion nobody wrote down is the one worth proving: `node_modules/` and `.turbo/` leave
    // the scan because git ignores them, and asserting that against *this* checkout would make the
    // verdict depend on whether a build has run here — the defect Q-0073 closed. So the mechanism
    // is exercised over a repository built for the purpose, where both sides are values this test
    // set itself.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-inventory-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
      fs.writeFileSync(path.join(sandbox, '.gitignore'), 'generated/\n');
      fs.writeFileSync(path.join(sandbox, 'kept.json'), '{}\n');
      fs.mkdirSync(path.join(sandbox, 'generated'));
      fs.writeFileSync(path.join(sandbox, 'generated', 'log.txt'), 'ANTHROPIC_API_KEY=x\n');

      expect(inventory(sandbox).sort()).toStrictEqual(['.gitignore', 'kept.json']);
      // And the exclusion excuses something: a walk of the same directory does collect the file git
      // drops, so this is a member being removed rather than a rule with no subject.
      const walked = fs.readdirSync(sandbox, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(sandbox, path.join(entry.parentPath, entry.name)));
      expect(walked).toContain(path.join('generated', 'log.txt'));
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
