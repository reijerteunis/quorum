// Q-0064: the corpus reader itself, because four house-rule suites are only as wide as it is.
//
// `backlog.source.test.ts` and `git.source.test.ts` assert properties of EVERY core source by
// iterating `coreSourceFiles()`. A reader that quietly stops covering the tree narrows all four to
// whatever it still returns and reports green — which is what a non-recursive read did the moment
// `src` gained its first folder. So the listing below is written here, in the test, rather than
// borrowed from the helper: two independent walks that must agree.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { coreSourceFiles, repoRoot } from '../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../test/repo.js';

afterAll(removeTempDirs);

const CORE_SRC = path.join(repoRoot, 'packages/core/src');

/** This file's own recursive listing, sharing no code with the reader under test. */
function listing(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listing(path.join(dir, entry.name), key);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [key] : [];
  });
}

const keys = (): string[] => coreSourceFiles().map(([key]) => key);

describe('AC-4/AC-6 — the reader covers the whole tree, keyed by path below src', () => {
  test('it returns exactly what an independent recursive listing finds', () => {
    expect(keys()).toStrictEqual(listing(CORE_SRC).sort());
  });

  test('and that set holds every module folder this package has today', () => {
    expect(keys()).toEqual(expect.arrayContaining([
      'backlog/backlog.ts', 'backlog/project.ts', 'git/git.ts', 'index.ts',
    ]));
  });

  test('a key is a relative path with / separators — never a bare filename, never absolute', () => {
    for (const key of keys()) {
      expect(key.includes('\\'), `${key} must use / separators`).toBe(false);
      expect(path.isAbsolute(key), `${key} must be relative to src`).toBe(false);
      expect(key.startsWith('.'), `${key} must not be written from the reader's own directory`).toBe(false);
    }
    // The narrowing this ticket exists to prevent: a folder's source keyed by its basename alone.
    expect(keys()).not.toContain('git.ts');
    expect(keys()).not.toContain('backlog.ts');
  });

  test('each entry carries the file\'s own text', () => {
    for (const [key, text] of coreSourceFiles()) {
      expect(text, key).toBe(fs.readFileSync(path.join(CORE_SRC, key), 'utf8'));
    }
  });

  test('no test file is in the corpus', () => {
    for (const key of keys()) expect(key.endsWith('.test.ts'), key).toBe(false);
  });
});

describe('AC-5 — every guard can fire, and says what it could not cover', () => {
  test('a root that does not exist is named, not passed over', () => {
    const missing = path.join(tempDir('corpus-'), 'no-such-src');
    expect(() => coreSourceFiles(missing)).toThrow(/corpus missing/);
  });

  test('a root holding no source at all is named, not passed over', () => {
    const empty = tempDir('corpus-');
    write(path.join(empty, 'notes.md'), '# not source\n');
    write(path.join(empty, 'index.test.ts'), 'test file, not source\n');
    expect(() => coreSourceFiles(empty)).toThrow(/corpus empty/);
  });

  test('a subdirectory holding source the corpus does not cover throws, naming the directory', () => {
    // The tree says `engine/` holds source; the reader can collect no file from it, so the corpus
    // would silently be one file wide. That is the shape a non-recursive read has.
    const root = tempDir('corpus-');
    write(path.join(root, 'index.ts'), "export const name = 'fixture';\n");
    fs.mkdirSync(path.join(root, 'engine', 'engine.ts'), { recursive: true });
    expect(() => coreSourceFiles(root)).toThrow(/corpus incomplete: .*engine/);
  });

  test('the same fixture passes once that directory is covered', () => {
    const root = tempDir('corpus-');
    write(path.join(root, 'index.ts'), "export const name = 'fixture';\n");
    write(path.join(root, 'engine', 'engine.ts'), 'export const run = (): void => undefined;\n');
    expect(coreSourceFiles(root).map(([key]) => key)).toStrictEqual(['engine/engine.ts', 'index.ts']);
  });
});
