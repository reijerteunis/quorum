/**
 * Q-0090 AC-8 (no command is implemented and no domain helper is copied), AC-4(d) (no signal
 * handler) and AC-12 (BYOS), as properties of this package's source rather than of one file
 * somebody remembered to list.
 *
 * **The file list is derived from the directory**, and recursively. A hand-written list is the
 * failure Q-0051 found in `q0050.source.test.ts`'s third list: it mapped over six names, a seventh
 * file went unscanned, and the suite reported green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This file, excluded from the scans below because it quotes every string they look for. */
const GUARD = 'frame.source.test.ts';

/** The directory every scan here walks — this package's `src`, reached package-relatively. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Every TypeScript file below `src`, as `[path relative to src, text]`, derived from the tree. */
const files = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')];
  });

/** The production half: everything that is not a test. */
const production = (): [string, string][] => files().filter(([name]) => !name.endsWith('.test.ts'));

/** Everything the scans below read, minus this file. */
const scanned = (): [string, string][] => files().filter(([name]) => name !== GUARD);

/** Modules a frame that reads, writes, spawns or prompts would have to import. */
const IO_MODULE = /from '(node:fs[^']*|node:child_process|node:readline[^']*|node:os|node:path|node:url)'/;

describe('the scan has a subject', () => {
  test('it finds this package\'s modules, both halves are non-empty, and the paths are distinct', () => {
    const names = files().map(([name]) => name);
    expect(names, 'src holds no TypeScript — every scan below proves nothing').toContain('main.ts');
    expect(production().length).toBeGreaterThan(4);
    expect(scanned().length).toBeGreaterThan(production().length);
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
    const offenders = scanned()
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
  test('nothing in source, test, fixture or help text matches any credential spelling', () => {
    const offenders = CREDENTIAL.flatMap((pattern) => scanned()
      .filter(([, text]) => pattern.test(text))
      .map(([name]) => `${name}: ${pattern.source}`));
    expect(offenders, 'adapters run on the vendor CLI\'s own login; there is no key path').toStrictEqual([]);
  });

  test('the self-exclusion is load-bearing, and it is the only one', () => {
    // This file quotes every pattern above, so scanning it would report itself — and it is the
    // *only* file the exclusion excuses, which is the half that stops the exclusion from growing
    // into a filter. Demonstrated rather than assumed.
    const matching = files()
      .filter(([, text]) => CREDENTIAL.some((pattern) => pattern.test(text)))
      .map(([name]) => name);
    expect(matching).toStrictEqual([GUARD]);
  });
});
