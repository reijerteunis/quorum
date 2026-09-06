// Test support: reading this repository's own files.
//
// It lives OUTSIDE `src/` deliberately. `src/` is declarations only and must stay safe to bundle
// for a browser, so the one module here that touches the filesystem sits beside it rather than in
// it. Nothing in this directory is exported from the package.
//
// The schemas in `src/` are written from one repository's corpus — six flow files, sixty-odd
// tickets, eleven roles, all Quorum's own — and that corpus is what a bottom-of-the-graph package
// has instead of a caller to check itself against. So every reader below FAILS LOUDLY when its
// subject is missing or empty rather than reporting a pass over nothing: a green tick over an empty
// directory is exactly how such a package ships a schema nobody checked ("a check that skips its
// subject must not report success", docs/DECISIONS.md 2026-08-25).
//
// **Until Q-0107 the corpus had a second half, and its removal is what that ticket is about.**
// `spikeSource`, `spikeLintFlow` and `frontmatterRegexMatchesSpike` read and executed `spike/**`,
// on the reasoning — written here, and true while it lasted — that the spike was *"the only witness
// available to the package everything else imports"*. Q-0103 deletes that witness. What replaced
// each of them is recorded per site rather than here: the constants and stage assertions retired to
// the siblings that already carried them, the event derivation and the frontmatter copy were
// re-aimed at `packages/core` read as TEXT, and the seven flow-property tests moved to
// `packages/core/src/lint/lint.test.ts`, where the linter they run is importable. See
// *"A check outlives its subject only if it can still fail"* (2026-09-05), and
// `packages/cli/src/spike-dependencies.test.ts`, which is the register that says so.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

/** The repository root: `packages/shared/test/` → three levels up. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Byte-identical to `parseFrontmatter`'s regular expression in
 * `packages/core/src/backlog/backlog.ts:69`. Copied rather than imported because nothing in this
 * package may depend on `packages/core` (04-architecture.md), and copied rather than reimplemented
 * because a corpus test that parses frontmatter differently from the product is testing the wrong
 * thing. {@link frontmatterRegexMatchesProduct} proves the copy is still current.
 *
 * Q-0107 AC-9/AC-10 — `re-aimed`. It cited `spike/src/backlog.js:12` and was checked against that
 * file, which is the copy Q-0043 ported FROM; the product's own function is what a copy must now
 * agree with, and it is the one that survives Q-0103.
 */
export const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * The product's `parseFrontmatter`, transcribed (`packages/core/src/backlog/backlog.ts:68-71`) —
 * including its early return, which is what a file whose frontmatter block is empty actually takes.
 */
export function parseFrontmatter(text: string): { meta: unknown; body: string } {
  const m = text.match(FRONTMATTER);
  if (!m) return { meta: {}, body: text };
  return { meta: YAML.parse(m[1]) ?? {}, body: m[2] };
}

function requireDir(relative: string): string {
  const dir = path.join(repoRoot, relative);
  if (!fs.existsSync(dir)) {
    throw new Error(`corpus missing: ${relative} does not exist under ${repoRoot} — this test proves nothing without it`);
  }
  return dir;
}

/** Absolute paths of every file in `relative` matching `filter`. Throws if there are none. */
export function corpusFiles(relative: string, filter: (name: string) => boolean): string[] {
  const dir = requireDir(relative);
  const files = fs.readdirSync(dir).filter(filter).sort().map((name) => path.join(dir, name));
  if (!files.length) throw new Error(`corpus empty: ${relative} contains no matching file — this test proves nothing without one`);
  return files;
}

/** Every ticket.md in a `backlog/` subdirectory. Throws if the backlog is missing or empty. */
export function ticketFiles(): string[] {
  const dir = requireDir('backlog');
  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, 'ticket.md'))
    .filter((file) => fs.existsSync(file))
    .sort();
  if (!files.length) throw new Error('corpus empty: backlog/ contains no ticket.md — this test proves nothing without one');
  return files;
}

export const flowFiles = (): string[] => corpusFiles('harness/flows', (name) => name.endsWith('.yaml'));
export const roleFiles = (): string[] => corpusFiles('harness/roles', (name) => name.endsWith('.md'));

/**
 * Every decision entry, sorted by file name, which is also index order — the number prefix exists
 * for that. Read from disk rather than from the index so the two can be compared against each
 * other; an index checked against itself would report success over a folder it never opened.
 */
export const decisionFiles = (): string[] => corpusFiles('docs/decisions', (name) => name.endsWith('.md'));

export const read = (file: string): string => fs.readFileSync(file, 'utf8');

export const parseYaml = (file: string): unknown => YAML.parse(read(file));

/** Any file in this repository, by path from the root. Throws when it is not there. */
export function repoFile(relative: string): string {
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) throw new Error(`corpus missing: ${relative} does not exist under ${repoRoot}`);
  return fs.readFileSync(file, 'utf8');
}

/** Every non-test file under `packages/shared/src`, as `[relative path, text]`. */
export function sharedSourceFiles(): [string, string][] {
  const dir = requireDir('packages/shared/src');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();
  if (!files.length) throw new Error('corpus empty: packages/shared/src has no non-test source file');
  return files.map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}

/** Every file under `packages/shared/src`, tests included. */
export function sharedAllFiles(): [string, string][] {
  const dir = requireDir('packages/shared/src');
  return fs.readdirSync(dir).filter((name) => name.endsWith('.ts')).sort()
    .map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}

/**
 * The lines of `text` that are NOT inside a comment. Written for the checks that say "this token
 * may appear in prose but never in code" — a doc-comment naming a vendor is documentation; a
 * comparison against one is the vendor knowledge that belongs in an adapter.
 */
export function codeLines(text: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of text.split('\n')) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = line.indexOf('/*');
      if (start === -1) break;
      const end = line.indexOf('*/', start + 2);
      if (end === -1) { line = line.slice(0, start); inBlock = true; break; }
      line = line.slice(0, start) + line.slice(end + 2);
    }
    const lineComment = line.indexOf('//');
    if (lineComment !== -1) line = line.slice(0, lineComment);
    if (line.trim()) out.push(line);
  }
  return out;
}

/**
 * Every module specifier this file imports or re-exports. The whitespace between the keyword and
 * the quote is required, not optional: without it a prose string ending in the word "import" and
 * its own closing quote reads as an import statement, which is how this function first reported
 * that a test file imported `, () => {`.
 */
export function importSpecifiers(text: string): string[] {
  return [...codeLines(text).join('\n').matchAll(/\b(?:from|import)\s+['"]([^'"\n]+)['"]/g)].map((m) => m[1]);
}

/**
 * True when the product's frontmatter regex still reads exactly as the copy above.
 *
 * Read as TEXT rather than imported: `packages/core` depends on this package and never the other
 * way round, so its source is evidence here and never a module. `packages/core/src/backlog/backlog.ts`
 * is a declared input of this package's `test` task, registered in
 * `packages/core/src/turbo-inputs.test.ts`, so a cache hit still names the file this opens.
 */
export function frontmatterRegexMatchesProduct(): boolean {
  return repoFile('packages/core/src/backlog/backlog.ts').includes(FRONTMATTER.source);
}
