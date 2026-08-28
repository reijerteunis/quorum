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
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/**
 * Every decision entry, sorted by file name, which is also index order — the number prefix exists
 * for that. Read from disk rather than from the index so the two can be compared against each
 * other; an index checked against itself would report success over a folder it never opened.
 */
export const decisionFiles = (): string[] => corpusFiles('docs/decisions', (name) => name.endsWith('.md'));

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

/**
 * The real `lintFlow`, executed rather than transcribed.
 *
 * `requirements/errata.md` E-1 requires the flow property to be asserted against the product's own
 * linter, and the reason is the whole history of this criterion: three review rounds argued about
 * what `lintFlow` accepts, from reading it. It accepts `adapter: 42`. A transcription of a linter
 * is a second linter, and a property proved against a copy proves nothing about the original.
 *
 * Two things make this safe to do from here. Reading `spike/**` is what the corpus tests already
 * do and is explicitly permitted; the port freeze forbids WRITING it (harness/port-charter.md §3),
 * and CI enforces that on the branch name. And the specifier is a file URL rather than a package
 * import, because `spike/` is outside the pnpm workspace and has no entry in it — `@vite-ignore`
 * keeps Vite from trying to analyse it at build time. Verified to resolve with `spike/node_modules`
 * absent, which is the state CI's `workspace` job runs in: it installs with pnpm and never runs
 * `npm ci` in `spike/`, so `lint.js`'s own `yaml` import resolves through this package's declared
 * `yaml` devDependency instead.
 *
 * `lintFlow` returns `true` or throws `FlowError`; `lintAccepts` below is the boolean form.
 */
export async function spikeLintFlow(): Promise<(flow: unknown) => boolean> {
  const file = path.join(repoRoot, 'spike/src/lint.js');
  if (!fs.existsSync(file)) {
    throw new Error(`corpus missing: ${file} does not exist — the flow property proves nothing without the real linter`);
  }
  const module = await import(/* @vite-ignore */ pathToFileURL(file).href) as {
    lintFlow?: (flow: unknown) => boolean;
  };
  if (typeof module.lintFlow !== 'function') {
    throw new Error('corpus changed: spike/src/lint.js no longer exports a lintFlow function — the flow property cannot be asserted against it');
  }
  return module.lintFlow;
}

/**
 * Whether the real `lintFlow` accepts a flow object. A `FlowError` is a refusal and is the answer;
 * anything else thrown is not, and is re-raised rather than counted as one — a linter that crashed
 * has not accepted or rejected anything, and reading a crash as "rejected" is the conflation the
 * containment decision of 2026-08-24 forbids in its own domain.
 */
export function lintAccepts(lintFlow: (flow: unknown) => boolean, flow: unknown): boolean {
  try {
    return lintFlow(flow) === true;
  } catch (error) {
    if (error instanceof Error && error.constructor.name === 'FlowError') return false;
    throw error;
  }
}
