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

/** Every non-test file under `packages/core/src`, as `[relative path, text]`. */
export function coreSourceFiles(): [string, string][] {
  const dir = path.join(repoRoot, 'packages/core/src');
  if (!fs.existsSync(dir)) throw new Error('corpus missing: packages/core/src does not exist');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();
  if (!files.length) throw new Error('corpus empty: packages/core/src has no non-test source file');
  return files.map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}
