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
 * - **C, name → route.** Clause B can only see a path written down as a repository-relative
 *   literal, so C closes every other way a file could name a location outside its own package. It
 *   has three parts, each failing closed against a register a reviewer approves rather than
 *   recognising a list of bad shapes:
 *   **C1**, every call of a route hands over a quoted literal or is entered in
 *   {@link INDIRECT_ROUTES} — and a route is identified through the calling file's own import
 *   bindings, so `import { repoFile as read }` is watched under `read`;
 *   **C2**, no repository root is derived outside the two route modules, per
 *   {@link ROOT_DERIVATIONS};
 *   **C3**, no string literal names a location outside its own package, per
 *   {@link ESCAPING_LITERALS}.
 *
 * **Why C's three parts are exhaustive** — stated so the argument can be attacked rather than the
 * code. To read a file, something must name it, and a name is either a literal or an expression.
 * A repository-relative literal is collected by clause B and must be declared. An absolute or
 * `..`-escaping literal is refused by C3, which is what lets clause B go on ignoring both forms.
 * An expression must be rooted somewhere: at a route, which C1 watches under whatever local name
 * it was imported as, or at a root the file derived for itself, which C2 refuses. What remains is
 * a base produced by a primitive C2's list does not name — the residual hole, and the reason C2 is
 * a register rather than a filter: a new primitive costs somebody an entry and a reason.
 *
 * No clause is a TypeScript parser. Clause B collects quoted string literals that resolve to a real
 * path outside the package naming them, which over-collects rather than under-collects: a path
 * named in an assertion but never opened is refused until it is entered in {@link NOT_READ} with a
 * reason, and entering one is a visible act a reviewer can weigh. C1 does not interpret an
 * expression at all — it decides only whether the path is a quoted literal, and refuses everything
 * else until a human writes down why. Failing closed is what lets all of this be this small.
 *
 * Two limits, stated rather than left to be discovered. Clause C exempts the two `test/corpus.ts`
 * modules, because they are where the routes are *defined* and taking a computed path is their
 * whole purpose — so a new reader in those two files is a reviewed act, which is the same standing
 * they already had. And C2's list deliberately omits `os.tmpdir`: a temporary directory is outside
 * the repository by construction, so reaching repository corpus from one needs a second derivation
 * that C2 does name, and registering the seven sandbox sites would fill the register with entries
 * carrying no information.
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

/** A module that defines routes, and is therefore itself exempt from clause C. */
interface RouteModule {
  /** Exports that take or yield a filesystem path. Every call of one is a clause C1 site. */
  readonly routes: readonly string[];
  /** Every other export, with why reaching it cannot reach a file a declaration must cover. */
  readonly inert: Record<string, string>;
}

/**
 * The two `test/corpus.ts` modules, with every export classified.
 *
 * Classification is the half that makes C1 fail closed rather than watch a list of names somebody
 * remembered to update: an export in neither column is a failure that names it, so a helper added
 * to a corpus module is a decision about whether it is a route, taken by whoever adds it. A test
 * below reads the exports back out of both modules and requires the two columns to cover them.
 *
 * `sharedSourceFiles`, `sharedAllFiles` and `frontmatterRegexMatchesSpike` are inert because their
 * subject is fixed in the corpus module itself, so no call site can point one at a new file.
 */
const ROUTE_MODULES: Record<string, RouteModule> = {
  'packages/core/test/corpus.ts': {
    routes: ['repoRoot', 'repoFile', 'coreSourceFiles'],
    inert: { SourceCollector: 'a type: it names no path and opens nothing' },
  },
  'packages/shared/test/corpus.ts': {
    routes: ['repoRoot', 'repoFile', 'spikeSource', 'corpusFiles', 'ticketFiles', 'flowFiles', 'roleFiles', 'read', 'parseYaml'],
    inert: {
      FRONTMATTER: 'a regular expression',
      parseFrontmatter: 'parses text a caller has already read',
      sharedSourceFiles: 'reads packages/shared/src, which is inside the only package that can import it, and takes no argument',
      sharedAllFiles: 'the same directory, likewise fixed',
      codeLines: 'filters text',
      importSpecifiers: 'parses text',
      frontmatterRegexMatchesSpike: 'reads spike/src/backlog.js through spikeSource — a fixed path the spike/src walk covers',
      spikeLintFlow: 'imports spike/src/lint.js — a fixed path the same walk covers',
      lintAccepts: 'calls a function the caller already holds',
    },
  },
};

/** The route exports under their own names — how a fixture that declares no import is scanned. */
const IDENTITY: Binding[] = [...new Set(Object.values(ROUTE_MODULES).flatMap((module) => module.routes))]
  .map((name) => ({ local: name, exported: name }));

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
    'read → file': 'the loops iterate roleFiles(), the audited walk of harness/roles',
  },
  'packages/shared/src/index.test.ts': {
    'repoRoot → relative': 'readJson\'s parameter; its three call sites in this file all pass a literal',
  },
  'packages/shared/src/flow.test.ts': {
    'parseYaml → file': 'the loop iterates flowFiles(), the audited walk of harness/flows',
  },
  'packages/shared/src/ticket.test.ts': {
    'read → file': 'the loops iterate ticketFiles(), the audited walk of backlog/*/ticket.md',
  },
  'packages/shared/src/project.test.ts': {
    'parseYaml → path.join(repoRoot, \'harness/harness.yaml\')': 'the path is a literal inside the argument, which clause B collects and the manifest names',
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
  'packages/core/src/corpus.test.ts': {
    'coreSourceFiles → missing': 'a path under a temporary directory the test created, asserted to throw',
    'coreSourceFiles → empty': 'likewise, a temporary directory this test populated',
    'coreSourceFiles → fixture()': 'a temporary tree the helper above builds and writes two files into',
    'coreSourceFiles → root': 'likewise, a temporary directory from tempDir',
    'coreSourceFiles → CORE_SRC': 'the constant is path.join(repoRoot, \'packages/core/src\'), a literal in this file and inside this package',
  },
  'packages/core/src/adapters/adapters.source.test.ts': {
    'coreSourceFiles → root': 'a temporary tree the test builds to prove the corpus reader covers a new adapter folder',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    'repoRoot → dir': 'typescriptFiles and filesBelow walk a directory from SUITES or WALKS, both audited above',
    'repoFile → key': 'a .ts path typescriptFiles found inside a package it was pointed at, never outside one',
    'repoFile → GUARD': 'the literal naming this file, and its own reads are audited by the three lists above',
    'repoFile → file': 'a key of ROUTE_MODULES, which is a literal list of the two corpus modules',
    'repoRoot → (bare)': 'the working directory the turbo subprocess is spawned in; nothing is read through it',
    'repoRoot → value': 'existence of a literal clause B already collected, to decide whether it is a path',
    'repoRoot → read': 'existence of a MANIFEST key, so a manifested file that has gone fails loudly',
    'repoRoot → literal': 'clause B asking whether a literal it collected is a directory',
  },
};

/** What one pass over a source file yields: its code with everything quoted taken out, and those. */
interface Scanned {
  /** `text` with every comment, string body and regular expression body blanked to spaces. */
  readonly code: string;
  /**
   * Every string body the pass blanked, module specifiers excepted, in source order. A template
   * literal contributes one entry per chunk, because a `..` appended after a hole escapes as
   * surely as one written at the front.
   */
  readonly strings: string[];
}

/** Where a quote that opens a module specifier sits: after `from`, `import` or `import(`. */
const SPECIFIER = /\b(?:from|import)\s*\(?\s*$/;

/**
 * `text` with every comment body and every string body blanked to spaces, offsets and newlines
 * preserved, so a route named in prose or quoted as an example is not read as a call — and the
 * string bodies themselves, which clause C3 asks whether any of them escapes its package.
 *
 * Interpolations inside a template literal are left as code, because a call can legitimately live
 * in one. Regular expressions are blanked too: a quote inside one would otherwise open a string
 * that swallows the code after it, and this file contains exactly such a pattern.
 *
 * A string nested inside another is not collected separately, because it is not a literal — it is
 * characters of the outer one. That is why {@link escapes} refuses anything carrying whitespace or
 * punctuation: an outer string quoting a line of code is not a path, whatever it contains.
 */
function scanSource(text: string): Scanned {
  const out = text.split('');
  const strings: string[] = [];
  const blank = (from: number, to: number): void => {
    for (let k = Math.max(from, 0); k < Math.min(to, out.length); k++) if (out[k] !== '\n') out[k] = ' ';
  };

  /** Index just past the `'` or `"` string opening at `open`. */
  const quoted = (open: number): number => {
    let i = open + 1;
    while (i < text.length && text[i] !== text[open] && text[i] !== '\n') { i += text[i] === '\\' ? 2 : 1; }
    if (!SPECIFIER.test(text.slice(Math.max(0, open - 16), open))) strings.push(text.slice(open + 1, i));
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
    /** A template's own characters, which are a literal even though its holes are code. */
    const chunkOf = (to: number): void => {
      strings.push(text.slice(chunk, to));
      blank(chunk, to);
    };
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '`') break;
      if (text[i] === '$' && text[i + 1] === '{') {
        chunkOf(i);
        i = interpolation(i + 2);
        chunk = i;
        continue;
      }
      i++;
    }
    chunkOf(i);
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
  return { code: out.join(''), strings };
}

/** {@link scanSource}'s code half, which is what every clause but C3 asks for. */
const codeOnly = (text: string): string => scanSource(text).code;

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

/** A route a file imported, under the name that file calls it by. */
interface Binding {
  /** The local name — `read`, where the import reads `repoFile as read`. */
  readonly local: string;
  /** The export it names, which is what decides whether `repoRoot`'s special handling applies. */
  readonly exported: string;
}

/** A module specifier resolved against the importing file, as a repository-relative `.ts` path. */
function resolveModule(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  return joined.endsWith('.js') ? `${joined.slice(0, -3)}.ts` : joined;
}

/**
 * The routes `file` imports, under its own names for them, and every import of a route module this
 * scan will not read.
 *
 * Resolving bindings rather than matching a fixed list of names is what closes two holes at once,
 * and each was a real one in this repository. `import { repoFile as read }` used to be invisible,
 * which is the review finding of iteration 2. And `import { parse as parseYaml } from 'yaml'` in
 * `test-command.test.ts` is *not* a route however much it looks like one — a global name list would
 * have reported its call sites and taught the next reader that the register is noise.
 *
 * Every form this scan cannot read is a problem rather than a silence: a namespace import, a
 * default binding, a re-export, a dynamic import, or a member naming an export
 * {@link ROUTE_MODULES} does not classify. Each is a way to obtain a route under a name the scan
 * would not follow, so refusing them is the whole of C1's fail-closed property.
 */
function routeImports(file: string, text: string): { bindings: Binding[]; problems: string[] } {
  const code = codeOnly(text);
  const bindings: Binding[] = [];
  const problems: string[] = [];
  const say = (message: string): number => problems.push(`${file}: ${message}`);

  for (const match of code.matchAll(/\b(import|export)\b(?!\s*\()([^;]{0,400}?)\bfrom\s*(['"])/g)) {
    const quote = match.index + match[0].length - 1;
    const close = code.indexOf(match[3], quote + 1);
    if (close === -1) continue;
    const specifier = text.slice(quote + 1, close);
    const resolved = resolveModule(file, specifier);
    if (resolved === null || !(resolved in ROUTE_MODULES)) continue;
    if (match[1] === 'export') { say(`re-exports ${specifier}, which would create a route under another module's name`); continue; }

    const clause = match[2].trim().replace(/^type\s+/, '');
    if (clause.startsWith('*')) { say(`imports ${specifier} as a namespace, so every route reaches it through a member access`); continue; }
    const open = clause.indexOf('{');
    const end = clause.lastIndexOf('}');
    if (open === -1 && /^[A-Za-z_$][\w$]*$/.test(clause)) { say(`takes a default binding from ${specifier}`); continue; }
    if (open === -1 || end === -1) { say(`imports ${specifier} with a clause this scan cannot read: ${clause}`); continue; }
    if (clause.slice(0, open).replace(/,\s*$/, '').trim() !== '') { say(`takes a default binding from ${specifier}`); continue; }
    if (clause.slice(end + 1).trim() !== '') { say(`imports ${specifier} with a trailing binding this scan cannot read: ${clause}`); continue; }

    const module = ROUTE_MODULES[resolved];
    for (const member of clause.slice(open + 1, end).split(',')) {
      const [head, tail] = member.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      if (!head) continue;
      const exported = head.trim();
      const local = (tail ?? head).trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(exported) || !/^[A-Za-z_$][\w$]*$/.test(local)) {
        say(`imports a member of ${specifier} this scan cannot read: ${member.trim()}`);
      } else if (module.routes.includes(exported)) bindings.push({ local, exported });
      else if (!(exported in module.inert)) {
        say(`imports ${exported} from ${resolved}, which is classified as neither a route nor inert`);
      }
    }
  }

  for (const match of code.matchAll(/\bimport\s*\(\s*(['"])/g)) {
    const close = code.indexOf(match[1], match.index + match[0].length);
    const specifier = close === -1 ? '(computed)' : text.slice(match.index + match[0].length, close);
    say(`imports ${specifier} dynamically, which no static scan follows`);
  }
  return { bindings, problems };
}

/**
 * Every way a file can obtain a filesystem base of its own, rather than through a route.
 *
 * A closed list checked against {@link ROOT_DERIVATIONS}, not a filter: an occurrence is refused
 * until somebody writes down why it reaches nothing a declaration must cover. Recognising only
 * `fileURLToPath` — which is what this was before — left `process.cwd()` as a way to the repository
 * root that neither clause B nor clause C could see, since under Vitest the working directory is
 * the package root and `..` from there is the workspace.
 */
const DERIVATIONS = [
  'fileURLToPath', 'pathToFileURL', 'import.meta', '__dirname', '__filename',
  'process.cwd', 'process.chdir', 'process.argv', 'process.env.INIT_CWD', 'process.env.PWD',
  'homedir', 'createRequire',
] as const;

/** The derivations {@link DERIVATIONS} finds in `text`, in the order the list names them. */
const derivationSites = (text: string): string[] => {
  const code = codeOnly(text);
  return DERIVATIONS.filter((token) => new RegExp(`\\b${token.replace(/\./g, '\\.')}\\b`).test(code));
};

/**
 * Root derivations outside the route modules, and why each reaches no repository file.
 *
 * Keyed by file, then by the token exactly as {@link DERIVATIONS} spells it. Four of these are
 * product source rather than a suite: `findProject` and the two version probes derive a working
 * directory because that is the CLI's own behaviour, which is a different thing from a test
 * reaching for a corpus file.
 */
const ROOT_DERIVATIONS: Record<string, Record<string, string>> = {
  'packages/core/src/backlog/project.ts': {
    'process.cwd': 'findProject\'s default start directory — it walks upward looking for a marker, and reads no file the corpus covers',
  },
  'packages/core/src/backlog/project.test.ts': {
    'process.cwd': 'path.relative, naming a temporary directory the test itself created, for an argument it then passes',
  },
  'packages/core/src/adapters/claude.ts': {
    'process.cwd': 'the working directory the version probe subprocess is spawned in; nothing is read through it',
  },
  'packages/core/src/adapters/codex.ts': {
    'process.cwd': 'the same probe, on the other adapter',
  },
  'packages/core/src/git/git.test.ts': {
    'process.cwd': 'asserting that a hostile git argument created no file beside the runner — an existence check, not a read',
  },
  'packages/core/src/contracts/contracts.source.test.ts': {
    'import.meta': 'createRequire resolving ajv\'s package.json inside node_modules, which is not repository corpus and is hashed through pnpm-lock.yaml',
    'createRequire': 'the same call',
  },
};

/**
 * Whether a quoted value is written as a path and climbs out of the directory it is resolved from.
 *
 * Punctuation and whitespace disqualify it, which is what keeps a quoted line of code — this file
 * is full of them — from being read as a path because it happens to contain `../`. A leading `/`
 * is stripped rather than treated as absolute, for two reasons: after a template's hole it is the
 * separator in `${dir}/ticket.md`, and an absolute literal cannot portably name *this* repository
 * anyway — one would be machine-specific and fail loudly on the next checkout, so the thirteen
 * fabricated `/tmp/…` paths in the adapter suites are noise this clause has nothing to say about.
 */
function escapes(value: string): boolean {
  if (!value || /[\s{}();,'"`<>|*?=]/.test(value)) return false;
  const relative = value.replace(/^\/+/, '');
  if (!relative) return false;
  const normalised = path.posix.normalize(relative);
  return normalised === '..' || normalised.startsWith('../');
}

/** The escaping literals `text` holds, deduplicated, module specifiers already excluded. */
const escapingLiterals = (text: string): string[] => [...new Set(scanSource(text).strings.filter(escapes))];

/**
 * Escaping or absolute string literals, and why each is data rather than a path handed to a reader.
 *
 * This is the clause that lets {@link pathLiterals} go on dropping every value beginning `..` or
 * `/`. Dropping them was safe only while nothing could read through one, and nothing checked that;
 * a `fs.readFileSync('../../docs/GLOSSARY.md')` took no route, derived no root, and named a path
 * clause B discards.
 */
const ESCAPING_LITERALS: Record<string, Record<string, string>> = {
  'packages/core/src/contracts/contracts.source.test.ts': {
    '../': 'a prefix an import specifier is tested against; nothing is opened',
  },
  'packages/core/src/adapters/adapters.source.test.ts': {
    '../': 'the same assertion, on the adapters folder',
  },
  'packages/core/src/fanout/fanout.source.test.ts': {
    '../git/git.js': 'an entry in the allow-list of specifiers fanout.ts may import, compared as text',
  },
  'packages/core/src/git/git.test.ts': {
    '../../../etc/passwd': 'hostile input handed to the git argument validator, asserted to be refused',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    '..': 'the value `escapes` compares a normalised path against',
    '../': 'the prefix it compares against, and the key of two entries above',
    '../git/git.js': 'the key of the fanout entry above',
    '../../../etc/passwd': 'the key of the git entry above',
    '../../docs/GLOSSARY.md': 'the expected value of clause C3\'s own fixture below',
    '/../../docs': 'the expected value of the template-chunk fixture below',
    '../a/b': 'likewise, for the fixture showing a real assertion site is still reported',
  },
};

/** One place a file reaches out of its package, and the path expression it reaches with. */
interface RouteSite {
  /** The route taken, under the local name the file imported it as. */
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
 *
 * @param bindings the routes this file imported, under its own names for them. A file that
 *   imported none has no route sites, which is why `backlog.ts`'s `read` method is not one.
 */
function routeSites(text: string, bindings: readonly Binding[]): RouteSite[] {
  if (!bindings.length) return [];
  const names = new Map(bindings.map((binding) => [binding.local, binding.exported]));
  const code = withoutImports(codeOnly(text));
  /** The argument running from `start`, rendered from the source rather than from the blanks. */
  const render = (start: number): string => {
    const end = argumentEnd(code, start);
    // A call that never closes is reported rather than read as "no argument", so it must be
    // registered: an argument nothing can delimit is exactly the shape worth looking at.
    return end === -1 ? '(unparsed)' : text.slice(start, end).trim();
  };
  const sites: RouteSite[] = [];
  const pattern = new RegExp(`\\b(${[...names.keys()].join('|')})\\b`, 'g');
  for (const match of code.matchAll(pattern)) {
    const route = match[1];
    const after = match.index + route.length;
    if (names.get(route) === 'repoRoot') {
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

/** Both suites' sources and test support, minus the two modules that define the routes. */
const scanned = (): [string, string][] =>
  SUITES.flatMap(({ directory }) => [...typescriptFiles(`${directory}/src`), ...typescriptFiles(`${directory}/test`)])
    .filter(([file]) => !(file in ROUTE_MODULES));

/** The sites clause C1 must answer for: a path is handed over, and it is not a literal. */
const indirect = (text: string, bindings: readonly Binding[] = IDENTITY): RouteSite[] =>
  routeSites(text, bindings).filter((site) => site.argument !== '' && !isLiteral(site.argument));

/** A real file's indirect sites, resolved through its own imports rather than a fixed name list. */
const sitesIn = (file: string, text: string): RouteSite[] => indirect(text, routeImports(file, text).bindings);

/** Every name a route module exports, as its own source declares them. */
const exportsOf = (text: string): string[] =>
  [...text.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1]);

describe('AC-7 clause C1 — every route hands over a literal path, under whatever name it was imported as', () => {
  test('the scan still finds the routes it is looking at', () => {
    // The positive control, and the reason it is first: every failure mode of the blanking above
    // hides sites rather than inventing them, so a clause that had stopped seeing its subject would
    // report success — which is the defect this whole file exists to close, one level in.
    const literals = scanned()
      .flatMap(([file, text]) => routeSites(text, routeImports(file, text).bindings))
      .filter((site) => isLiteral(site.argument));
    expect(literals.length, 'the scan sees almost no literal route — the blanking has eaten its subject').toBeGreaterThan(40);
  });

  test('every import of a route module is one this scan can follow', () => {
    // The fail-closed half. A namespace import, a default binding, a re-export, a dynamic import or
    // an unclassified member each yields a route under a name the scan below would not look for,
    // so each is reported here rather than passing as an absence of sites.
    expect(scanned().flatMap(([file, text]) => routeImports(file, text).problems)).toEqual([]);
  });

  test('and every export of a route module is classified as a route or as inert', () => {
    // What makes the classification a decision rather than a list somebody remembered to update:
    // a helper added to a corpus module is named here until someone says which column it is in.
    const unclassified = Object.entries(ROUTE_MODULES).flatMap(([file, module]) =>
      exportsOf(repoFile(file))
        .filter((name) => !module.routes.includes(name) && !(name in module.inert))
        .map((name) => `${file}: ${name}`));
    expect(unclassified).toEqual([]);
    for (const [file, module] of Object.entries(ROUTE_MODULES)) {
      const declared = new Set(exportsOf(repoFile(file)));
      expect([...module.routes, ...Object.keys(module.inert)].filter((name) => !declared.has(name)),
        `${file} classifies an export it no longer has`).toEqual([]);
    }
  });

  test('every indirect route is registered with the reason its paths are literals', () => {
    const unregistered = scanned().flatMap(([file, text]) =>
      sitesIn(file, text).filter((site) => INDIRECT_ROUTES[file]?.[siteKey(site)] === undefined)
        .map((site) => `${file}: ${siteKey(site)}`));
    expect(unregistered).toEqual([]);
  });

  test('and the register holds no entry for a site that has gone', () => {
    // A register that outlives its sites decays into a list nobody rereads, and the next reader
    // cannot tell which entries are still load-bearing.
    const live = new Set(scanned().flatMap(([file, text]) => sitesIn(file, text).map((site) => `${file}: ${siteKey(site)}`)));
    const stale = Object.entries(INDIRECT_ROUTES).flatMap(([file, sites]) =>
      Object.keys(sites).filter((key) => !live.has(`${file}: ${key}`)).map((key) => `${file}: ${key}`));
    expect(stale).toEqual([]);
  });

  test('the clause has a subject — a helper handed a template literal is reported', () => {
    // Isolated: this fixture takes no raw root and derives no root, so it can fail C1 alone. It is
    // the review finding of iteration 1, verbatim — the read a quoted-literal scan cannot see.
    const fixture = 'const text = repoFile(`docs/${slug}.md`);';
    expect(indirect(fixture).map(siteKey)).toEqual(['repoFile → `docs/${slug}.md`']);
    expect(routeSites(fixture, IDENTITY).some((site) => site.route === 'repoRoot')).toBe(false);
  });

  test('the clause has a subject — a route imported under an alias is reported', () => {
    // The review finding of iteration 2, verbatim, and the reason bindings are resolved per file:
    // under a fixed list of names `readDoc` is not a route, so this read went out of the package
    // with nothing to say about it. Isolated — the fixture derives no root and its only escaping
    // literal is the module specifier, which is not a read.
    const file = 'packages/core/src/aliased.test.ts';
    const fixture = 'import { repoFile as readDoc } from \'../test/corpus.js\';\nconst text = readDoc(`docs/${slug}.md`);\n';
    const { bindings, problems } = routeImports(file, fixture);
    expect(problems).toEqual([]);
    expect(bindings).toEqual([{ local: 'readDoc', exported: 'repoFile' }]);
    expect(indirect(fixture, bindings).map(siteKey)).toEqual(['readDoc → `docs/${slug}.md`']);
    expect(indirect(fixture, IDENTITY), 'a fixed list of names is exactly what this bypass evades').toEqual([]);
    expect(derivationSites(fixture)).toEqual([]);
    expect(escapingLiterals(fixture)).toEqual([]);
  });

  test('and an alias of the same name from another module is not a route', () => {
    // The over-collection the per-file resolution avoids, taken from real code: `test-command.
    // test.ts` imports yaml's parser as `parseYaml`, which is the corpus module's route name.
    const file = 'packages/core/src/test-command.test.ts';
    const { bindings } = routeImports(file, repoFile(file));
    expect(bindings.some((binding) => binding.local === 'parseYaml')).toBe(false);
    expect(bindings.map((binding) => binding.exported).sort()).toEqual(['coreSourceFiles', 'repoFile', 'repoRoot']);
  });

  test('and every unfollowable import form is reported rather than passed over', () => {
    // Each fixture evades the scan a different way, and each is checked on its own — a demonstration
    // that the clause fires proves the clause fires, not that each of its cases does (Q-0071).
    const file = 'packages/core/src/aliased.test.ts';
    const problems = (fixture: string): string[] => routeImports(file, fixture).problems;
    expect(problems('import * as corpus from \'../test/corpus.js\';\n')[0]).toContain('as a namespace');
    expect(problems('import corpus from \'../test/corpus.js\';\n')[0]).toContain('default binding');
    expect(problems('export { repoFile } from \'../test/corpus.js\';\n')[0]).toContain('re-exports');
    expect(problems('const c = await import(\'../test/corpus.js\');\n')[0]).toContain('dynamically');
    expect(problems('import { readAnything } from \'../test/corpus.js\';\n')[0]).toContain('neither a route nor inert');
    expect(problems('import { repoFile } from \'../test/corpus.js\';\n'), 'a form it can follow').toEqual([]);
    expect(problems('import { parse } from \'yaml\';\n'), 'a module that is not a route module').toEqual([]);
  });

  test('and a route named in prose or quoted as an example is not read as a call', () => {
    // The over-collection that would make the register a chore and the reasons meaningless.
    expect(routeSites('// somebody adds repoFile(`docs/${x}.md`) one day\n', IDENTITY)).toEqual([]);
    expect(routeSites('/** Prose about repoFile(x) and repoRoot. */\n', IDENTITY)).toEqual([]);
    expect(routeSites('const example = "repoFile(computed)";\n', IDENTITY)).toEqual([]);
    expect(routeSites("const pattern = /'repoFile\\(x\\)'/;\nconst after = repoFile('docs/GLOSSARY.md');\n", IDENTITY).map(siteKey))
      .toEqual(["repoFile → 'docs/GLOSSARY.md'"]);
  });
});

describe('AC-7 clause C2 — the repository root is derived in the route modules and nowhere else', () => {
  test('every derivation outside them is registered with the reason it reaches no corpus file', () => {
    const unregistered = scanned().flatMap(([file, text]) =>
      derivationSites(text).filter((token) => ROOT_DERIVATIONS[file]?.[token] === undefined)
        .map((token) => `${file}: ${token}`));
    expect(unregistered).toEqual([]);
  });

  test('and the register holds no entry for a derivation that has gone', () => {
    const live = new Set(scanned().flatMap(([file, text]) => derivationSites(text).map((token) => `${file}: ${token}`)));
    const stale = Object.entries(ROOT_DERIVATIONS).flatMap(([file, tokens]) =>
      Object.keys(tokens).filter((token) => !live.has(`${file}: ${token}`)).map((token) => `${file}: ${token}`));
    expect(stale).toEqual([]);
  });

  test('the clause has a subject — a root taken from the working directory is reported', () => {
    // The second half of iteration 2's finding. Under Vitest the working directory is the package
    // root, so `..` from it is the workspace; recognising only `fileURLToPath` left this open.
    // Isolated: no route is named, and the only literal is an encoding.
    const fixture = 'const root = process.cwd();\nconst text = fs.readFileSync(path.join(root, computed), \'utf8\');\n';
    expect(derivationSites(fixture)).toEqual(['process.cwd']);
    expect(routeImports('packages/core/src/rogue.test.ts', fixture).bindings).toEqual([]);
    expect(routeSites(fixture, IDENTITY)).toEqual([]);
    expect(escapingLiterals(fixture)).toEqual([]);
  });

  test('and a root computed from the module URL is reported', () => {
    // The one shape this clause already refused, kept as a case rather than as the whole list.
    const fixture = 'const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");';
    expect(derivationSites(fixture)).toEqual(['fileURLToPath', 'import.meta']);
    expect(routeSites(fixture, IDENTITY)).toEqual([]);
  });

  test('and a derivation named in prose is not read as one', () => {
    expect(derivationSites('// a later reader might reach for process.cwd() here\n')).toEqual([]);
    expect(derivationSites('const example = "process.cwd()";\n')).toEqual([]);
  });
});

describe('AC-7 clause C3 — no string literal names a location outside its own package', () => {
  test('every escaping literal is registered with the reason it is data rather than a path', () => {
    const unregistered = scanned().flatMap(([file, text]) =>
      escapingLiterals(text).filter((value) => ESCAPING_LITERALS[file]?.[value] === undefined)
        .map((value) => `${file}: ${value}`));
    expect(unregistered).toEqual([]);
  });

  test('and the register holds no entry for a literal that has gone', () => {
    const live = new Set(scanned().flatMap(([file, text]) => escapingLiterals(text).map((value) => `${file}: ${value}`)));
    const stale = Object.entries(ESCAPING_LITERALS).flatMap(([file, values]) =>
      Object.keys(values).filter((value) => !live.has(`${file}: ${value}`)).map((value) => `${file}: ${value}`));
    expect(stale).toEqual([]);
  });

  test('the clause has a subject — a package-relative escape is reported, and clause B cannot see it', () => {
    // The third way out, and the one that makes dropping `..` in `pathLiterals` safe rather than
    // convenient. Isolated: no route is named and no root is derived, so only C3 can fail on it.
    const fixture = 'const text = fs.readFileSync(\'../../docs/GLOSSARY.md\', \'utf8\');\n';
    expect(escapingLiterals(fixture)).toEqual(['../../docs/GLOSSARY.md']);
    expect(pathLiterals(fixture), 'clause B discards every value beginning `..`').toEqual([]);
    expect(derivationSites(fixture)).toEqual([]);
    expect(routeSites(fixture, IDENTITY)).toEqual([]);
  });

  test('and a separator after a template hole is not read as an escape', () => {
    // The over-collection that would bury the clause: `/` between two holes is punctuation, so a
    // clause that read it as an absolute path would collect thirteen fabricated /tmp paths from
    // the adapter suites and teach the next reader that the register is noise.
    expect(escapingLiterals('const key = `${dir}/${entry.name}`;\n')).toEqual([]);
    expect(escapingLiterals('const file = `${dir}/ticket.md`;\n')).toEqual([]);
    expect(escapingLiterals('const out = `${dir}/../../docs`;\n'), 'a `..` after a hole still escapes')
      .toEqual(['/../../docs']);
    expect(escapingLiterals('import { repoFile } from \'../test/corpus.js\';\n'), 'a module specifier is not a read').toEqual([]);
    expect(escapingLiterals('expect(spec.startsWith(\'../a/b\')).toBe(false);\n')).toEqual(['../a/b']);
  });
});
