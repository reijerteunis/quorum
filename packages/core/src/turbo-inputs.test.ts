/**
 * Q-0072 — what a cache hit on this workspace is entitled to claim.
 *
 * A hit must mean *no file this task reads, and no same-kind task in a package it depends on, has
 * changed since the cached result*. Turbo's default input set is package-scoped, so that claim
 * holds only while the out-of-package reads both real suites perform are declared in
 * each affected package's own `turbo.json`. Nothing enforced a declaration against a read, and
 * the failure was silent: the same shape Q-0071 closed one layer up, where a required check
 * reported green having executed nothing.
 *
 * Three clauses, because three things decay independently, and each is demonstrated firing on its
 * own below — demonstrating that a guard has a subject proves the guard fires, not that each of its
 * clauses does (Q-0071).
 *
 * - **A, declaration → hash.** Every audited read is in the task's hashed input set, as turbo
 *   itself reports it. This is what fails when a `../`-escaping glob stops resolving — a turbo
 *   upgrade, a moved directory — while every declaration still reads correctly in the file.
 * - **B, read → declaration.** Every repository path either suite names is covered: by its own
 *   task's inputs, by the workspace dependency edge, or by {@link NOT_READ}. This is what fails
 *   the first time somebody adds a `repoFile('…')` call no declaration covers.
 * - **C, route → literal.** Clause B can only see a path that is *written down*, so C requires that
 *   every route out of a package hands its path over as a quoted literal, or is entered in
 *   {@link INDIRECT_ROUTES} with the reason its values are literals in the same file. This is what
 *   fails on a helper handed a template literal, and on a raw `path.join(repoRoot, computed)` —
 *   reads that clause B is structurally unable to notice.
 *
 * No clause is a TypeScript parser. Clause B collects quoted string literals that resolve to a real
 * path outside the package naming them, which over-collects rather than under-collects: a path
 * named in an assertion but never opened is refused until it is entered in {@link NOT_READ} with a
 * reason, and entering one is a visible act a reviewer can weigh. Clause C does not interpret an
 * expression at all — it decides only whether the path is a quoted literal, and refuses everything
 * else until a human writes down why. Failing closed is what lets it be this small.
 *
 * The limit, stated rather than left to be discovered: clause C exempts the two `test/corpus.ts`
 * modules, because they are where the routes are *defined* and taking a computed path is their
 * whole purpose. A read added there is checked by clause B if it names a literal, and by nothing if
 * it does not — so a new reader in those two files is a reviewed act, which is the same standing
 * they already had.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoFile, repoRoot } from '../test/corpus.js';

/** This file, which the clause B scan skips and a test of its own audits instead. */
const GUARD = 'packages/core/src/turbo-inputs.test.ts';

/** The two packages whose suites read outside themselves. The other five read nothing outside. */
const SUITES = [
  { taskId: '@quorum/shared#test', directory: 'packages/shared' },
  { taskId: '@quorum/core#test', directory: 'packages/core' },
] as const;

/**
 * Named out-of-package file reads, per task, with the call site that performs each.
 *
 * Audited by hand, which is the point: this list is what a reviewer reads instead of re-deriving
 * the suites. It holds only reads that must appear as *declared inputs* — `core`'s reads of
 * `packages/shared` are deliberately absent, because AC-4 covers those with the dependency edge
 * and clause B checks them there.
 */
const MANIFEST: Record<string, Record<string, string>> = {
  '@quorum/shared#test': {
    'docs/02-sdlc-pipeline-spec.md': 'docs.test.ts — the status line and the §5.8 chore section',
    'docs/03-adapter-contract.md': 'docs.test.ts — the three adapter event kinds',
    'docs/04-architecture.md': 'docs.test.ts — the event union the document names',
    'docs/DECISIONS.md': 'docs.test.ts — both entries exist in the required shape',
    'docs/GLOSSARY.md': 'docs.test.ts — the Event term',
    'harness/harness.yaml': 'project.test.ts — the config corpus, and the Q-0065 --force guard',
    'spike/bin/harness.js': 'events.test.ts, constants.test.ts — the six ui methods',
    'spike/templates/harness/harness.yaml': 'project.test.ts — the shipped template config',
    'packages/core/package.json': 'index.test.ts — core declares shared as a workspace dependency',
    'packages/core/src/index.ts': 'index.test.ts — the entry point is byte-pinned',
    'packages/core/src/backlog/project.ts': 'project.test.ts — loadProject runs no schema',
  },
  '@quorum/core#test': {
    '.github/workflows/ci.yml': 'test-command.test.ts — Q-0071 AC-4, CI executes rather than replays',
    'turbo.json': 'test-command.test.ts — Q-0065 AC-6, the switch is declared as env',
    'pnpm-lock.yaml': 'contracts.source.test.ts — ajv and ajv-formats are locked',
    'docs/03-adapter-contract.md': 'capabilities.source.test.ts — the per-vendor flag table',
    'docs/04-architecture.md': 'capabilities.source.test.ts — the adapters/* layout',
    'contracts/Q-0006/review-artifacts.schema.json': 'structured-output.test.ts — the frozen verdict contract',
    'contracts/Q-0006/ticket-review-state.schema.json': 'contracts.test.ts — the frozen ticket contract',
    'contracts/Q-0011/run-manifest.schema.json': 'run-manifest.test.ts, schema-cache.test.ts, validate-artifact.test.ts',
  },
};

/** A directory a suite walks, and the rule by which it selects files from it. */
interface Walk {
  /** The task whose suite performs the walk. */
  readonly taskId: string;
  /** The directory, relative to the repository root, exactly as the suite names it. */
  readonly dir: string;
  /** Whether a path below {@link dir} is one the walk collects. */
  readonly collects: (below: string) => boolean;
  /** The call site, for a reader who wants to check the rule against the code. */
  readonly why: string;
}

/**
 * The tree reads, recomputed from disk rather than represented by one named file.
 *
 * A representative would pass while the other forty-four files went unhashed, which is the defect
 * this ticket is about wearing a guard's clothes. Each entry's file set is enumerated here and every
 * member is required to be a hashed input.
 */
const WALKS: readonly Walk[] = [
  {
    taskId: '@quorum/shared#test',
    dir: 'harness/flows',
    collects: (below) => below.endsWith('.yaml') && !below.includes('/'),
    why: 'flowFiles() — flow.test.ts',
  },
  {
    taskId: '@quorum/shared#test',
    dir: 'harness/roles',
    collects: (below) => below.endsWith('.md') && !below.includes('/'),
    why: 'roleFiles() — role.test.ts',
  },
  {
    taskId: '@quorum/shared#test',
    dir: 'backlog',
    collects: (below) => /^[^/]+\/ticket\.md$/.test(below),
    why: 'ticketFiles() — ticket.test.ts',
  },
  {
    taskId: '@quorum/shared#test',
    dir: 'spike/src',
    collects: (below) => below.endsWith('.js'),
    why: 'spikeSource(), and spikeLintFlow() which imports and executes spike/src/lint.js',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'backlog',
    collects: (below) => /^[^/]+\/ticket\.md$/.test(below),
    why: 'corpusTickets() — backlog.test.ts',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'spike/src',
    collects: (below) => below.endsWith('.js'),
    why: 'spikeSources() — test-command.test.ts',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'harness/flows',
    collects: (below) => below.endsWith('.yaml') && !below.includes('/'),
    why: 'lintFlowDirectory over SHIPPED — lint.test.ts',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'spike/templates/harness/flows',
    collects: (below) => below.endsWith('.yaml') && !below.includes('/'),
    why: 'lintFlowDirectory over SHIPPED — lint.test.ts',
  },
];

/**
 * Repository paths the suites name without reading, each with why it is not a read.
 *
 * Entering a path here is how clause B is answered when the answer is "nothing opens this". It is
 * deliberately a list a reviewer must approve rather than a pattern that quietly excuses a class.
 */
const NOT_READ: Record<string, string> = {
  'harness/architecture.md': 'role.test.ts asserts this string appears in role.ts\'s own doc comment; no suite opens the file',
  'harness/port-charter.md': 'named in doc comments in both packages, opened by neither',
  'node_modules/.bin/turbo': 'the installed toolchain, untracked and unhashable; its absence already fails loudly',
  'spike/src/fanout.js': 'fanout.test.ts uses the path as task-fixture data; the file itself is read only through the spike/src walk',
  'packages/core': 'role.test.ts uses it as a value in a role\'s `paths` list, which is data and not a read',
  'docs/05-design-prompt.md': 'named nowhere but this file, as clause B\'s own fixture below',
  'docs/01-product-definition.md': 'named nowhere but this file, as clause A\'s own fixture below',
};

/** Every `.ts` below `dir`, at any depth, as `[repository-relative path, text]`. */
function typescriptFiles(dir: string): [string, string][] {
  const absolute = path.join(repoRoot, dir);
  if (!fs.existsSync(absolute)) throw new Error(`corpus missing: ${dir} does not exist — the scan proves nothing without it`);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry): [string, string][] => {
    const key = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return typescriptFiles(key);
    return entry.name.endsWith('.ts') ? [[key, repoFile(key)]] : [];
  });
}

/** Every path below `dir` — files only, at any depth, relative to `dir`. */
function filesBelow(dir: string): string[] {
  const absolute = path.join(repoRoot, dir);
  if (!fs.existsSync(absolute)) throw new Error(`corpus missing: ${dir} does not exist — the walk proves nothing without it`);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesBelow(`${dir}/${entry.name}`).map((below) => `${entry.name}/${below}`) : [entry.name]);
}

/** What turbo says about one task, as opposed to what `turbo.json` appears to say. */
interface Reported {
  /** Hashed inputs, as repository-relative paths. */
  readonly inputs: Set<string>;
  /** The task ids this one waits for, which is where a workspace dependency becomes a hash edge. */
  readonly dependencies: string[];
  /** The resolved environment allow-list, after the package configuration is merged into the root. */
  readonly env: string[];
  /** The resolved `dependsOn`, likewise merged. */
  readonly dependsOn: string[];
}

/**
 * What turbo says it will hash, per task.
 *
 * Read from the real `turbo` this workspace installs, because the criterion is about what turbo
 * does and not about what `turbo.json` appears to say. A `--dry` run executes no task, so this
 * cannot spawn the run it is running inside. Absent turbo is a failure and never a skip.
 */
function reported(): Record<string, Reported> {
  const bin = path.join(repoRoot, 'node_modules/.bin/turbo');
  if (!fs.existsSync(bin)) {
    throw new Error(`corpus missing: ${bin} — install the workspace before asserting what turbo hashes`);
  }
  const raw = execFileSync(bin, ['run', 'test', '--dry=json'], {
    cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw) as {
    tasks: {
      taskId: string;
      directory: string;
      inputs?: Record<string, string>;
      dependencies?: string[];
      resolvedTaskDefinition: { env?: string[]; dependsOn?: string[] };
    }[];
  };
  const out: Record<string, Reported> = {};
  for (const task of parsed.tasks) {
    const inputs = Object.keys(task.inputs ?? {}).map((key) => path.posix.normalize(path.posix.join(task.directory, key)));
    out[task.taskId] = {
      inputs: new Set(inputs),
      dependencies: task.dependencies ?? [],
      env: task.resolvedTaskDefinition.env ?? [],
      dependsOn: task.resolvedTaskDefinition.dependsOn ?? [],
    };
  }
  return out;
}

/** Clause A: the audited reads that are missing from `inputs`. Empty is the passing answer. */
const uncovered = (reads: readonly string[], inputs: Set<string>): string[] => reads.filter((read) => !inputs.has(read));

/**
 * Clause B: whether `read` is hashed for the task in `directory`.
 *
 * Three ways, and the second is why removing a `dependsOn` fails this rather than passing quietly:
 * a read inside a package is covered when that package's same-kind task is a declared dependency
 * of this one, which is a fact taken from turbo's report rather than from `turbo.json`'s text.
 */
function covered(read: string, task: Reported, directory: string): boolean {
  if (read.startsWith(`${directory}/`)) return true;
  if (task.inputs.has(read)) return true;
  return task.dependencies.some((dependency) => {
    const owner = SUITES.find((suite) => suite.taskId === dependency);
    return owner !== undefined && read.startsWith(`${owner.directory}/`);
  });
}

/**
 * Every quoted string literal in `text` that names an existing repository path.
 *
 * A separator is required, so a bare word that happens to match a directory name — `main`, `test`,
 * `spike` — is not mistaken for a path. Values that are relative (`../..`), absolute, or a bare
 * prefix ending in a separator (`backlog/`, `.harness/`) are dropped as well: those are fragments
 * used in string arithmetic rather than paths handed to a reader.
 */
function pathLiterals(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/'([^'\n\\]+)'|"([^"\n\\]+)"/g)) {
    const value = match[1] ?? match[2];
    if (!value.includes('/') || value.endsWith('/')) continue;
    if (value.startsWith('/') || value.startsWith('..')) continue;
    if (!fs.existsSync(path.join(repoRoot, value))) continue;
    found.add(path.posix.normalize(value));
  }
  return [...found];
}

/**
 * The corpus helpers — the audited routes out of a package — and `repoRoot`, which is the raw one
 * every helper is built on. A read that reaches outside its package goes through one of these.
 */
const ROUTES = ['repoFile', 'spikeSource', 'corpusFiles', 'ticketFiles', 'flowFiles', 'roleFiles', 'repoRoot'] as const;

/** The modules that define the routes, and are therefore not subject to clause C. */
const ROUTE_MODULES = ['packages/shared/test/corpus.ts', 'packages/core/test/corpus.ts'];

/**
 * Route sites whose path is not a quoted literal, and why the values reaching each one are.
 *
 * Keyed by file, then by the site exactly as {@link routeSites} renders it — `route → argument`.
 * Every entry is a hole clause B cannot see through, held open deliberately: the reason must say
 * where the literals are, because "the literals are in the same file" is what makes clause B's
 * scan of that file sufficient. An unregistered site fails, which is the point.
 *
 * `repoRoot → (bare)` is the root used other than as `path.join(repoRoot, …)` — handed to a
 * subprocess as a working directory, say — which reads nothing by itself.
 */
const INDIRECT_ROUTES: Record<string, Record<string, string>> = {
  'packages/shared/src/docs.test.ts': {
    'repoFile → file': 'the loop iterates a literal array of the three documents, in the same test',
  },
  'packages/shared/src/events.test.ts': {
    'spikeSource → file': 'the loop iterates a literal array of the four adapter sources, in the same test',
  },
  'packages/shared/src/role.test.ts': {
    'spikeSource → file': 'the loop iterates a literal array of the four spike modules, in the same test',
  },
  'packages/shared/src/index.test.ts': {
    'repoRoot → relative': 'readJson\'s parameter; its three call sites in this file all pass a literal',
  },
  'packages/core/src/contracts/validate-artifact.test.ts': {
    'repoFile → relative': 'committedSchema\'s parameter; both call sites in this file pass a literal',
  },
  'packages/core/src/lint/lint.test.ts': {
    'repoRoot → relative': 'the loop iterates SHIPPED, a literal array of the two flow directories',
  },
  'packages/core/src/backlog/backlog.test.ts': {
    'repoRoot → file': 'path.relative, which builds a name for a failure message and opens nothing',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    'repoRoot → dir': 'typescriptFiles and filesBelow walk a directory from SUITES or WALKS, both audited above',
    'repoFile → key': 'a .ts path typescriptFiles found inside a package it was pointed at, never outside one',
    'repoFile → GUARD': 'the literal naming this file, and its own reads are audited by the three lists above',
    'repoRoot → (bare)': 'the working directory the turbo subprocess is spawned in; nothing is read through it',
    'repoRoot → value': 'existence of a literal clause B already collected, to decide whether it is a path',
    'repoRoot → read': 'existence of a MANIFEST key, so a manifested file that has gone fails loudly',
    'repoRoot → literal': 'clause B asking whether a literal it collected is a directory',
  },
};

/**
 * `text` with every comment body and every string body blanked to spaces, offsets and newlines
 * preserved, so a route named in prose or quoted as an example is not read as a call.
 *
 * Interpolations inside a template literal are left as code, because a call can legitimately live
 * in one. Regular expressions are blanked too: a quote inside one would otherwise open a string
 * that swallows the code after it, and this file contains exactly such a pattern.
 */
function codeOnly(text: string): string {
  const out = text.split('');
  const blank = (from: number, to: number): void => {
    for (let k = Math.max(from, 0); k < Math.min(to, out.length); k++) if (out[k] !== '\n') out[k] = ' ';
  };

  /** Index just past the `'` or `"` string opening at `open`. */
  const quoted = (open: number): number => {
    let i = open + 1;
    while (i < text.length && text[i] !== text[open] && text[i] !== '\n') { i += text[i] === '\\' ? 2 : 1; }
    blank(open + 1, i);
    return i + 1;
  };

  /** Index just past the `}` closing the interpolation whose `${` ended at `start`. */
  const interpolation = (start: number): number => {
    let i = start;
    let depth = 1;
    while (i < text.length) {
      const c = text[i];
      if (c === "'" || c === '"') { i = quoted(i); continue; }
      // Mutually recursive with `template` below, which is how a nested template is handled.
      if (c === '`') { i = template(i); continue; }
      if (c === '{') depth++;
      if (c === '}' && --depth === 0) return i + 1;
      i++;
    }
    return i;
  };

  /** Index just past the template literal opening at `open`, its literal chunks blanked. */
  const template = (open: number): number => {
    let i = open + 1;
    let chunk = i;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '`') break;
      if (text[i] === '$' && text[i + 1] === '{') {
        blank(chunk, i);
        i = interpolation(i + 2);
        chunk = i;
        continue;
      }
      i++;
    }
    blank(chunk, i);
    return i + 1;
  };

  // A `/` opens a regular expression only where a value may begin; after a name, a number or a
  // closing bracket it is division. This is the standard test and it is exact for this corpus.
  const opensRegex = /[(,=:[!&|?{};+\-*%^~<>]$/;
  let previous = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      let j = i;
      while (j < text.length && text[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const j = end === -1 ? text.length : end + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && opensRegex.test(previous)) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== '\n') {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '[') inClass = true;
        else if (text[j] === ']') inClass = false;
        else if (text[j] === '/' && !inClass) break;
        j++;
      }
      blank(i + 1, j);
      previous = '/';
      i = j + 1;
      continue;
    }
    if (c === "'" || c === '"') { previous = c; i = quoted(i); continue; }
    if (c === '`') { previous = c; i = template(i); continue; }
    if (c.trim()) previous = c;
    i++;
  }
  return out.join('');
}

/**
 * `code` with module specifiers blanked, so `repoRoot` named in an import is not read as a use.
 *
 * The span is capped because a non-greedy match would otherwise run from a dynamic `import(` to
 * whatever `from` came next; requiring whitespace after the keyword already excludes that call
 * form, and the cap makes the failure bounded rather than silent if it ever does not.
 */
const withoutImports = (code: string): string =>
  code.replace(/\b(?:import|export)\s+(?!\()[\s\S]{0,300}?\bfrom\s*'[^'\n]*'/g, (span) => ' '.repeat(span.length));

/**
 * The index just past the argument beginning at `start`, or -1 if the call never closes.
 *
 * The end is the first top-level `,` or the `)` that closes the call, so a scan cannot run on into
 * the rest of the file when a name appears somewhere no argument list follows.
 */
function argumentEnd(code: string, start: number): number {
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return i;
      depth--;
    } else if (c === ',' && depth === 0) return i;
  }
  return -1;
}

/** One place a file reaches out of its package, and the path expression it reaches with. */
interface RouteSite {
  /** The route taken: a corpus helper, or `repoRoot` for the raw one. */
  readonly route: string;
  /** The path expression handed to it, as written, or `(bare)` where no path is joined to it. */
  readonly argument: string;
}

/** How a site is written in {@link INDIRECT_ROUTES}, and in the message when one is unregistered. */
const siteKey = (site: RouteSite): string => `${site.route} → ${site.argument}`;

/** A single-quoted or double-quoted string, which is a path clause B can see. Nothing else is. */
const isLiteral = (argument: string): boolean => /^'[^'\n]*'$|^"[^"\n]*"$/.test(argument);

/** Whether the root at `index` is the first argument of a `path.join`, `resolve` or `relative`. */
const joinsPath = (code: string, index: number): boolean =>
  /\bpath\.(?:join|resolve|relative)\(\s*$/.test(code.slice(Math.max(0, index - 40), index));

/**
 * Every route out of a package that `text` takes, with the path expression each is handed.
 *
 * Comments, strings and module specifiers are blanked first, so this reports calls and never prose.
 * Blanking preserves offsets, so boundaries are found in the blanked code while the argument is
 * rendered from the source — which is what keeps a register entry readable and greppable.
 *
 * A helper is read at its call site; `repoRoot` is read at the `path.*` call that joins a path to
 * it, and reported as `(bare)` anywhere else, since a root nothing is joined to opens no file.
 */
function routeSites(text: string): RouteSite[] {
  const code = withoutImports(codeOnly(text));
  /** The argument running from `start`, rendered from the source rather than from the blanks. */
  const render = (start: number): string => {
    const end = argumentEnd(code, start);
    // A call that never closes is reported rather than read as "no argument", so it must be
    // registered: an argument nothing can delimit is exactly the shape worth looking at.
    return end === -1 ? '(unparsed)' : text.slice(start, end).trim();
  };
  const sites: RouteSite[] = [];
  for (const match of code.matchAll(new RegExp(`\\b(${ROUTES.join('|')})\\b`, 'g'))) {
    const route = match[1];
    const after = match.index + route.length;
    if (route === 'repoRoot') {
      const rest = code.slice(after);
      // Composed rather than joined: `repoRoot + '/docs/…'`, or `${repoRoot}/docs/…` inside a
      // template, both of which build a path out of pieces clause B never sees whole.
      const composed = /^\s*[+`}]/.exec(rest);
      if (composed) { sites.push({ route, argument: '(composed)' }); continue; }
      const comma = /^\s*,/.exec(rest);
      if (!comma || !joinsPath(code, match.index)) { sites.push({ route, argument: '(bare)' }); continue; }
      sites.push({ route, argument: render(after + comma[0].length) });
      continue;
    }
    const open = /^\s*\(/.exec(code.slice(after));
    if (!open) continue;
    sites.push({ route, argument: render(after + open[0].length) });
  }
  return sites;
}

const turbo = reported();

describe('AC-7 clause A — every audited read is a hashed input', () => {
  test.each(SUITES)('$taskId reports a hashed input set at all', ({ taskId }) => {
    // A task turbo does not report cannot be checked, and an empty input set is not a small one.
    expect(turbo[taskId], `${taskId} is absent from turbo's report`).toBeDefined();
    expect(turbo[taskId].inputs.size).toBeGreaterThan(24);
  });

  test.each(SUITES)('$taskId hashes every named file the manifest lists', ({ taskId }) => {
    const reads = Object.keys(MANIFEST[taskId]);
    expect(reads.length, `${taskId} has an empty manifest — this test proves nothing`).toBeGreaterThan(5);
    for (const read of reads) {
      expect(fs.existsSync(path.join(repoRoot, read)), `${read} is manifested but absent from disk`).toBe(true);
    }
    expect(uncovered(reads, turbo[taskId].inputs)).toEqual([]);
  });

  test.each(WALKS)('$taskId hashes every file its walk of $dir collects', ({ taskId, dir, collects }) => {
    const collected = filesBelow(dir).filter(collects).map((below) => `${dir}/${below}`);
    expect(collected.length, `the walk of ${dir} collects nothing — this test proves nothing`).toBeGreaterThan(0);
    expect(uncovered(collected, turbo[taskId].inputs)).toEqual([]);
  });

  test.each(SUITES)('$taskId inherits the root task definition rather than replacing it', ({ taskId }) => {
    // A package's turbo.json declares `inputs` and nothing else, because turbo merges a package
    // configuration into the root definition per key. That merge is what keeps root `turbo.json`
    // the one place `env` is decided, which is what Q-0065's guard reads. A turbo that replaced
    // instead of merged would drop QUORUM_REAL_CLI for exactly the two packages that have a
    // package configuration — silently, and only for the probes it selects.
    expect(turbo[taskId].env).toStrictEqual(['QUORUM_REAL_CLI']);
    expect(turbo[taskId].dependsOn).toStrictEqual(['^test']);
  });

  test('the clause has a subject — a read that is not declared is reported missing', () => {
    // The failure this clause exists to catch, over a real reported input set: an escaping glob
    // that stopped resolving leaves its files out of `inputs` while turbo.json still names them.
    expect(uncovered(['docs/01-product-definition.md'], turbo['@quorum/core#test'].inputs))
      .toEqual(['docs/01-product-definition.md']);
  });
});

describe('AC-7 clause B — every path either suite names is covered by a declaration', () => {
  /** Each suite's own sources and test support, which is where every read is written. */
  const sources = (directory: string): [string, string][] =>
    [...typescriptFiles(`${directory}/src`), ...typescriptFiles(`${directory}/test`)];

  test.each(SUITES)('$taskId names no repository path that nothing hashes', ({ taskId, directory }) => {
    const files = sources(directory).filter(([file]) => file !== GUARD);
    expect(files.length, `${directory} holds no TypeScript — the scan proves nothing`).toBeGreaterThan(5);
    const missing: string[] = [];
    for (const [file, text] of files) {
      for (const literal of pathLiterals(text)) {
        if (literal in NOT_READ) continue;
        if (literal === directory || literal.startsWith(`${directory}/`)) continue;
        if (fs.statSync(path.join(repoRoot, literal)).isDirectory()) {
          if (!WALKS.some((walk) => walk.taskId === taskId && walk.dir === literal)) {
            missing.push(`${file}: ${literal} (a directory, and no audited walk covers it)`);
          }
          continue;
        }
        if (!covered(literal, turbo[taskId], directory)) missing.push(`${file}: ${literal}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('this file is audited by its own lists rather than exempt from them', () => {
    // It is skipped by the scan above because it names every other package's reads, so attributing
    // them to `core` would be wrong. Skipping without this would let a read added *here* hide, so
    // every path it names must instead appear in one of the three audited lists — which is the same
    // obligation stated where the audit lives.
    const manifested = new Set(Object.values(MANIFEST).flatMap((reads) => Object.keys(reads)));
    const walked = new Set(WALKS.map((walk) => walk.dir));
    const unaccounted = pathLiterals(repoFile(GUARD))
      .filter((literal) => !literal.startsWith('packages/'))
      .filter((literal) => !manifested.has(literal) && !walked.has(literal) && !(literal in NOT_READ));
    expect(unaccounted).toEqual([]);
  });

  test('core\'s reads of shared are covered by the dependency edge, not by an input', () => {
    // AC-4's half, asserted from turbo's report: the edge is what hashes them, and this is the
    // assertion that fails if `dependsOn` is dropped while every input still reads correctly.
    const core = turbo['@quorum/core#test'];
    expect(core.dependencies).toContain('@quorum/shared#test');
    expect(core.inputs.has('packages/shared/src/project.ts')).toBe(false);
    expect(covered('packages/shared/src/project.ts', core, 'packages/core')).toBe(true);
  });

  test('the clause has a subject — a named path that no declaration covers is reported', () => {
    // Isolated from clause A: this calls the same predicate the scan calls, over a path that is
    // really in the repository, really outside `packages/core`, and really undeclared.
    const core = turbo['@quorum/core#test'];
    expect(fs.existsSync(path.join(repoRoot, 'docs/05-design-prompt.md'))).toBe(true);
    expect(covered('docs/05-design-prompt.md', core, 'packages/core')).toBe(false);
  });

  test('and the dependency edge excuses only the package it points at', () => {
    // Without this, clause B would read any edge as covering any path — the shape of hole that let
    // `restoresTaskCache`'s key clause go unexercised behind its path clause (Q-0071).
    const shared = turbo['@quorum/shared#test'];
    expect(shared.dependencies).toEqual([]);
    expect(covered('packages/core/src/index.ts', shared, 'packages/shared')).toBe(true);
    expect(shared.inputs.has('packages/core/src/index.ts'), 'shared declares this as an input, never as an edge').toBe(true);
  });
});

describe('AC-7 clause C — every route out of a package hands over a literal path', () => {
  /** Both suites' sources and test support, minus the two modules that define the routes. */
  const scanned = (): [string, string][] =>
    SUITES.flatMap(({ directory }) => [...typescriptFiles(`${directory}/src`), ...typescriptFiles(`${directory}/test`)])
      .filter(([file]) => !ROUTE_MODULES.includes(file));

  /** The sites clause C must answer for: a path is handed over, and it is not a literal. */
  const indirect = (text: string): RouteSite[] =>
    routeSites(text).filter((site) => site.argument !== '' && !isLiteral(site.argument));

  test('the scan still finds the routes it is looking at', () => {
    // The positive control, and the reason it is first: every failure mode of the blanking above
    // hides sites rather than inventing them, so a clause that had stopped seeing its subject would
    // report success — which is the defect this whole file exists to close, one level in.
    const literals = scanned().flatMap(([, text]) => routeSites(text)).filter((site) => isLiteral(site.argument));
    expect(literals.length, 'the scan sees almost no literal route — the blanking has eaten its subject').toBeGreaterThan(40);
  });

  test('every indirect route is registered with the reason its paths are literals', () => {
    const unregistered = scanned().flatMap(([file, text]) =>
      indirect(text).filter((site) => INDIRECT_ROUTES[file]?.[siteKey(site)] === undefined)
        .map((site) => `${file}: ${siteKey(site)}`));
    expect(unregistered).toEqual([]);
  });

  test('and the register holds no entry for a site that has gone', () => {
    // A register that outlives its sites decays into a list nobody rereads, and the next reader
    // cannot tell which entries are still load-bearing.
    const live = new Set(scanned().flatMap(([file, text]) => indirect(text).map((site) => `${file}: ${siteKey(site)}`)));
    const stale = Object.entries(INDIRECT_ROUTES).flatMap(([file, sites]) =>
      Object.keys(sites).filter((key) => !live.has(`${file}: ${key}`)).map((key) => `${file}: ${key}`));
    expect(stale).toEqual([]);
  });

  test('the repository root is derived in the route modules and nowhere else', () => {
    // Clauses C1 and C2 both watch `repoRoot`. A file that computes its own root from
    // `import.meta.url` would take neither route and be seen by neither, so the derivation is
    // confined to the two modules whose reads are audited as a whole.
    const rogue = scanned().filter(([, text]) => codeOnly(text).includes('fileURLToPath')).map(([file]) => file);
    expect(rogue).toEqual([]);
  });

  test('the clause has a subject — a helper handed a template literal is reported', () => {
    // Isolated: this fixture takes no raw root and derives no root, so it can fail C1 alone. It is
    // the review finding of iteration 1, verbatim — the read a quoted-literal scan cannot see.
    const fixture = 'const text = repoFile(`docs/${slug}.md`);';
    expect(indirect(fixture).map(siteKey)).toEqual(['repoFile → `docs/${slug}.md`']);
    expect(routeSites(fixture).some((site) => site.route === 'repoRoot')).toBe(false);
  });

  test('the clause has a subject — a raw root joined to a computed path is reported', () => {
    // Isolated the other way: no corpus helper appears, so only C2 can fail on it.
    const fixture = 'const text = fs.readFileSync(path.join(repoRoot, computed), "utf8");';
    expect(indirect(fixture).map(siteKey)).toEqual(['repoRoot → computed']);
    expect(routeSites(fixture).every((site) => site.route === 'repoRoot')).toBe(true);
  });

  test('and a root a path is built out of rather than joined to is reported too', () => {
    // The two other ways to reach a file from the root. Both would otherwise render as `(bare)`,
    // which this file registers for the working directory the turbo subprocess runs in.
    expect(indirect("const text = read(repoRoot + '/docs/GLOSSARY.md');").map(siteKey)).toEqual(['repoRoot → (composed)']);
    expect(indirect('const text = read(`${repoRoot}/docs/GLOSSARY.md`);').map(siteKey)).toEqual(['repoRoot → (composed)']);
    expect(indirect('const cwd = { cwd: repoRoot, shell: false };').map(siteKey)).toEqual(['repoRoot → (bare)']);
  });

  test('the clause has a subject — a root derived outside the route modules is reported', () => {
    // Isolated again: no helper, no `repoRoot`, so this can only fail the derivation clause.
    const fixture = 'const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");';
    expect(codeOnly(fixture).includes('fileURLToPath')).toBe(true);
    expect(routeSites(fixture)).toEqual([]);
  });

  test('and a route named in prose or quoted as an example is not read as a call', () => {
    // The over-collection that would make the register a chore and the reasons meaningless.
    expect(routeSites('// somebody adds repoFile(`docs/${x}.md`) one day\n')).toEqual([]);
    expect(routeSites('/** Prose about repoFile(x) and repoRoot. */\n')).toEqual([]);
    expect(routeSites('const example = "repoFile(computed)";\n')).toEqual([]);
    expect(routeSites("const pattern = /'repoFile\\(x\\)'/;\nconst after = repoFile('docs/GLOSSARY.md');\n").map(siteKey))
      .toEqual(["repoFile → 'docs/GLOSSARY.md'"]);
  });
});
