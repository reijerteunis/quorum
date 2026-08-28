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
 * Two clauses, because two things decay independently, and each is demonstrated firing on its own
 * below — demonstrating that a guard has a subject proves the guard fires, not that each of its
 * clauses does (Q-0071).
 *
 * - **A, declaration → hash.** Every audited read is in the task's hashed input set, as turbo
 *   itself reports it. This is what fails when a `../`-escaping glob stops resolving — a turbo
 *   upgrade, a moved directory — while every declaration still reads correctly in the file.
 * - **B, read → declaration.** Every repository path either suite names is covered: by its own
 *   task's inputs, by the workspace dependency edge, or by {@link NOT_READ}. This is what fails
 *   the first time somebody adds a `repoFile('…')` call no declaration covers.
 *
 * Neither clause is a TypeScript parser. Clause B collects quoted string literals that resolve to a
 * real path outside the package naming them, which over-collects rather than under-collects: a path
 * named in an assertion but never opened is refused until it is entered in {@link NOT_READ} with a
 * reason, and entering one is a visible act a reviewer can weigh.
 *
 * The limit, stated rather than left to be discovered: clause B reads single- and double-quoted
 * literals, so a path assembled in a template literal is invisible to it. What compensates is that
 * a directory literal must be an audited {@link WALKS} entry, and {@link WALKS} recomputes each
 * walk's file set from disk rather than trusting a representative — so the tree reads, which are
 * where a dynamic path would come from, are checked in full.
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
