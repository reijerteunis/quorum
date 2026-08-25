// Test support: reading this repository's own files the way the spike reads them.
//
// It lives OUTSIDE `src/` deliberately. `src/` is declarations only and must stay safe to bundle
// for a browser, so the one module here that touches the filesystem sits beside it rather than in
// it. Nothing in this directory is exported from the package.
//
// The schemas in `src/` are written from one repository's corpus — six flow files, twenty-seven
// tickets, eleven roles, all Quorum's own — and that corpus is the only witness available to the
// package everything else imports. So every reader below FAILS LOUDLY when its subject is missing
// or empty rather than reporting a pass over nothing: a green tick over an empty directory is
// exactly how a bottom-of-the-graph package ships a schema nobody checked ("a check that skips its
// subject must not report success", docs/DECISIONS.md 2026-08-25).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

/** The repository root: `packages/shared/test/` → three levels up. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Byte-identical to `parseFrontmatter`'s regular expression in spike/src/backlog.js:12. Copied
 * rather than imported because the spike is plain JavaScript outside this workspace, and copied
 * rather than reimplemented because a corpus test that parses frontmatter differently from the
 * product is testing the wrong thing. `frontmatterRegexMatchesSpike()` below proves the copy is
 * still current. Q-0043 ports the real function; this is not it.
 */
export const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * The spike's `parseFrontmatter`, transcribed (spike/src/backlog.js:11-15) — including its early
 * return, which is what a file whose frontmatter block is empty actually takes.
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

export const read = (file: string): string => fs.readFileSync(file, 'utf8');

export const parseYaml = (file: string): unknown => YAML.parse(read(file));

/**
 * A file under `spike/`, read as text. The spike is frozen for the port and is its only
 * independent witness (harness/port-charter.md §3), so the constants tests compare against it
 * rather than against a transcription of it. Reading is all that happens here; the freeze forbids
 * writing, and CI enforces that on the branch name.
 */
export function spikeSource(relative: string): string {
  return repoFile(path.join('spike', relative));
}

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

/** True when the spike's frontmatter regex still reads exactly as the copy above. */
export function frontmatterRegexMatchesSpike(): boolean {
  return spikeSource('src/backlog.js').includes(FRONTMATTER.source);
}
