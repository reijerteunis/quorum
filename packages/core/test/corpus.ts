// Reading this package's own source, for the criteria that are properties of the code rather than
// of its behaviour — "ancestry is read in exactly one file" is not observable at run time, and it
// is the property a later module would break silently.
//
// Every reader fails loudly when its subject is missing rather than reporting a pass over nothing
// ("a check that skips its subject must not report success", docs/DECISIONS.md 2026-08-25).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root: `packages/core/test/` → three levels up. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Any file in this repository, by path from the root. Throws when it is not there. */
export function repoFile(relative: string): string {
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) throw new Error(`corpus missing: ${relative} does not exist under ${repoRoot}`);
  return fs.readFileSync(file, 'utf8');
}

/** The directory {@link coreSourceFiles} reads when it is given no other. */
const CORE_SRC = path.join(repoRoot, 'packages/core/src');

const isSource = (name: string): boolean => name.endsWith('.ts') && !name.endsWith('.test.ts');

/** Every non-test source under `dir`, keyed by its path below `root` with `/` separators. */
function collect(dir: string, prefix: string): [string, string][] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return collect(path.join(dir, entry.name), key);
    return entry.isFile() && isSource(entry.name) ? [[key, fs.readFileSync(path.join(dir, entry.name), 'utf8')] as [string, string]] : [];
  });
}

/**
 * Every non-test file under `packages/core/src`, at any depth, as `[relative path, text]` sorted by
 * path — `git/git.ts`, never a bare filename and never an absolute one. `root` is the tree to read
 * and defaults to this package's `src`.
 *
 * Three guards, and the third is why this file was rewritten: a subdirectory the tree says holds
 * source, and the corpus covers with nothing, is reported rather than passed over. A non-recursive
 * read is exactly that shape, and it would otherwise leave four house-rule suites asserting over a
 * one-file corpus while reporting green. See Q-0064.
 *
 * That guard reads the tree by NAME and measures coverage over the files actually collected, so a
 * directory the collector cannot take a file from still counts as source the corpus owes an entry
 * for — which is what lets a fixture prove the guard fires.
 *
 * @throws {Error} when `root` does not exist, holds no source at all, or leaves a subdirectory
 *   uncovered — naming the directory in the last case.
 */
export function coreSourceFiles(root: string = CORE_SRC): [string, string][] {
  const label = path.relative(repoRoot, root) || root;
  if (!fs.existsSync(root)) throw new Error(`corpus missing: ${label} does not exist`);
  const files = collect(root, '').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!files.length) throw new Error(`corpus empty: ${label} has no non-test source file`);
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    if (!fs.readdirSync(path.join(root, dir.name)).some(isSource)) continue;
    if (!files.some(([key]) => key.startsWith(`${dir.name}/`))) {
      throw new Error(`corpus incomplete: ${label}/${dir.name} holds source the corpus does not cover`);
    }
  }
  return files;
}
