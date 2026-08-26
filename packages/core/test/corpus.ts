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

/** How a tree is read for {@link coreSourceFiles}: one `[path below the root, text]` per source. */
export type SourceCollector = (root: string) => [string, string][];

/** A non-test `.ts` **file**. A directory so named is not source, and never stands in for one. */
const isSourceFile = (entry: fs.Dirent): boolean =>
  entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts');

/** Whether `dir` directly holds a source file, which is what obliges the corpus to cover it. */
const holdsSource = (dir: string): boolean => fs.readdirSync(dir, { withFileTypes: true }).some(isSourceFile);

/** The reader used unless a caller supplies another: every source under `root`, at any depth. */
const collect: SourceCollector = (root) => {
  const descend = (dir: string, prefix: string): [string, string][] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return descend(path.join(dir, entry.name), key);
      return isSourceFile(entry) ? [[key, fs.readFileSync(path.join(dir, entry.name), 'utf8')] as [string, string]] : [];
    });
  return descend(root, '');
};

/**
 * Every non-test file under `packages/core/src`, at any depth, as `[relative path, text]` sorted by
 * path — `git/git.ts`, never a bare filename and never an absolute one.
 *
 * Three guards, and the third is why this file was rewritten: a subdirectory that directly holds a
 * source file, and that the corpus covers with nothing, is reported rather than passed over. A
 * non-recursive read is exactly that shape, and it would otherwise leave four house-rule suites
 * asserting over a one-file corpus while reporting green. See Q-0064.
 *
 * @param root the tree to read; this package's `src` unless a test points it at a fixture.
 * @param collectSources how that tree is read. The seam exists so the third guard's failure path
 *   can be exercised over genuine source files, by handing it a narrowed reader — a guard that
 *   cannot fire is the defect this ticket exists to prevent.
 * @throws {Error} when `root` does not exist, holds no source at all, or leaves a subdirectory
 *   uncovered — naming the directory in the last case.
 */
export function coreSourceFiles(root: string = CORE_SRC, collectSources: SourceCollector = collect): [string, string][] {
  const label = path.relative(repoRoot, root) || root;
  if (!fs.existsSync(root)) throw new Error(`corpus missing: ${label} does not exist`);
  const files = [...collectSources(root)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!files.length) throw new Error(`corpus empty: ${label} has no non-test source file`);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !holdsSource(path.join(root, entry.name))) continue;
    if (!files.some(([key]) => key.startsWith(`${entry.name}/`))) {
      throw new Error(`corpus incomplete: ${label}/${entry.name} holds source the corpus does not cover`);
    }
  }
  return files;
}
