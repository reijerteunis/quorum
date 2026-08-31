/**
 * Q-0054 — what the workspace suite carries of the spike suite, file by file.
 *
 * **This file is deleted at the cutover by Q-0009, together with `spike/test/**`, and a `cli`
 * verdict is a claim about Q-0010 rather than about this ticket.**
 *
 * Thirteen port children each wrote fresh Vitest tests against their own ported module rather than
 * transcribing a spike file, and none of them cites one: no test in `packages/**` names a spike
 * suite file or any of its scenario ids. So the gap this ticket closes is not coverage — it is that
 * **no artifact states the relationship between the two suites**. Each child checked its own module;
 * nobody has checked the union. At the cutover Q-0009 deletes the port's only independent witness,
 * and until now there was no record of which of its scenarios were carried, which transfer at
 * Q-0010, and which were carried by nobody.
 *
 * **The half that can be computed is computed.** {@link factsOf} decides, from each spike file's own
 * text, whether it reaches `bin/harness.js` and whether it imports from the spike's `src`; the
 * verdict is then required to agree ({@link admissible}). Only the *counterpart naming* is a human
 * reading of two suites, which is what a reviewer reads instead of re-deriving it. A file the
 * recomputation cannot classify fails the guard rather than falling to a default class — at
 * `258e1ba` the eight entangled files spell the path two ways, four each, so a scan anchored on one
 * literal would silently mis-file half of them.
 *
 * **Reaching the binary is decided twice, by oracles that share no evidence.** {@link binarySpellings}
 * reads the file's quoted values, and {@link launchSites} ignores them and reads what each
 * `node:child_process` call actually starts. Two rather than one because a scan for the contiguous
 * text `harness.js` is exactly what a name assembled from more than one value walks past — the
 * defect this file carried into its first review round, where `` path.join(spike, 'bin',
 * `harness${'.js'}`) `` produced neither a reference nor a problem. {@link binaryAssemblies} now
 * refuses a spelling that could be completed across an interpolation or a concatenation, and a
 * launch target that resolves to nothing fails the file. The two agree across the corpus as it
 * stands and a test asserts it, so a disagreement is a finding rather than something the disjunction
 * in {@link Facts.reachesBinary} quietly absorbs.
 *
 * **A second oracle is only as wide as the calls it can see, which is the second round's finding.**
 * The launch oracle read `import { … } from 'node:child_process'` and nothing else, so a namespace
 * import, a default import and an aliased named import each reached the same launchers with the
 * scan inspecting no call at all — and a file starting an unresolvable path through one produced no
 * problem and could be accepted as `ported`. {@link childProcessBindings} now reads the module's
 * bindings rather than one clause shape: the forms that bind it are followed, and the forms that
 * bind it in a way this scan cannot follow are reported. Both halves of the same rule as the first
 * round's — what cannot be resolved fails the file rather than falling to a default class.
 *
 * **The keys come from the tree.** A hand-written list is what Q-0051 found failing open in
 * `q0050.source.test.ts`, where a seventh engine file went unscanned while the suite reported green;
 * a register keyed by hand would go stale the first time a spike suite lands and would report green
 * over the omission. Every entry of `spike/test/` is therefore in {@link REGISTER} or in
 * {@link NOT_A_SUITE}, and a new one of either kind fails until somebody classifies it.
 *
 * **What this ticket does not do**, so a reviewer does not look for it: it translates no library-only
 * file into Vitest. Charter §1 gave each child its module's unit-level tests and §5 defers the
 * CLI-driven files to Q-0010, which leaves this ticket's translation set empty by construction. A
 * transcription would produce two descriptions of each behaviour that can drift apart silently.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoFile, repoRoot } from '../test/corpus.js';
import { collects, includePatterns } from '../test/vitest-include.js';

/**
 * What a spike test file's behaviour is, relative to this port.
 *
 * - `cli` — it spawns the harness binary and imports nothing from the spike's `src`, so it transfers
 *   at Q-0010 and this ticket carries no counterpart for it;
 * - `ported` — its behaviour is carried by named `packages/**` test files;
 * - `split` — its library half is carried by named counterparts and its binary half transfers at
 *   Q-0010; both halves are named;
 * - `uncovered` — nothing carries it, with a reason and, where one is owed, a successor ticket.
 */
type Verdict = 'cli' | 'ported' | 'split' | 'uncovered';

/** One spike test file's verdict, and the evidence for it a reviewer checks. */
interface Entry {
  /** Which of the four this file is. */
  readonly verdict: Verdict;
  /**
   * Repository-relative `packages/**` test files carrying this file's library behaviour.
   *
   * Required and non-empty for `ported` and `split`, empty for `cli` and `uncovered`. Every one is
   * asserted to exist **and** to be collected by the configured include, because a counterpart that
   * has been renamed out of collection excuses nothing while still reading as coverage.
   */
  readonly carriedBy: readonly string[];
  /** One line: what the counterparts carry, or — for `cli` and `uncovered` — why nothing does. */
  readonly note: string;
  /** The binary behaviour Q-0010 inherits. Required for `cli` and `split`, absent otherwise. */
  readonly binaryHalf?: string;
  /** The successor for an `uncovered` row, where one is owed. */
  readonly ticket?: string;
  /**
   * Literals naming the harness binary that are **not** a reference to it, each with why.
   *
   * The register that keeps {@link factsOf} fail-closed: any other unresolvable spelling is a
   * failure naming the file and the text, rather than a file quietly classified as library-only.
   */
  readonly mentions?: Record<string, string>;
}

/**
 * Every file in `spike/test/`, keyed as `readdir` reports it.
 *
 * Counterpart naming is a hand audit of two suites and is the half a review round is expected to
 * move; the classification beside it is not, and disagreement between the two is a failure.
 */
const REGISTER: Record<string, Entry> = {
  'q0006-engine.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/adapters/mock.test.ts',
      'packages/core/src/adapters/structured-output.test.ts',
      'packages/core/src/contracts/contracts.test.ts',
      'packages/core/src/engine/composite.test.ts',
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/engine/lifecycle-routing.test.ts',
      'packages/core/src/engine/prompt.test.ts',
      'packages/core/src/run-history/reader.test.ts',
    ],
    note: 'Q-0006\'s review engine: the mock\'s verdict switches, the frozen verdict clauses, buildPrompt and its three-dot materialisation, the panel and its asymmetric failure, the backward edge with retry/advance/abort, and legacy history staying readable',
  },
  'q0011-run-history.js': {
    verdict: 'split',
    carriedBy: [
      'packages/core/src/adapters/adapters.test.ts',
      'packages/core/src/contracts/run-manifest.test.ts',
      'packages/core/src/engine/agent-run.test.ts',
      'packages/core/src/run-history/manifest.test.ts',
      'packages/core/src/run-history/reader.test.ts',
      'packages/core/src/run-history/writer.test.ts',
    ],
    note: 'the manifest a run writes, its occurrences and roll-ups, the retry that bills a killed call, and the semantic pass over run-manifest-v1',
    binaryHalf: '`harness runs` reading that history back at the command line — Q-0010',
  },
  'q0011-runs-cli.js': {
    verdict: 'cli',
    carriedBy: [],
    note: 'it spawns the binary and imports nothing from the spike\'s src, so there is no library half to carry',
    binaryHalf: '`harness runs` listing and detail, including its exit codes — Q-0010',
  },
  'q0033-surface.js': {
    verdict: 'split',
    carriedBy: [
      'packages/core/src/lint/lint.source.test.ts',
      'packages/core/src/lint/lint.test.ts',
    ],
    note: 'its one library import is lintFlow; the ported lint carries the sixteen messages, the cross-vendor rules, the directory walk and every shipped flow linting clean',
    binaryHalf: '`harness lint` and `harness init`, the shipped review assets on disk, and the gate answers a terminal supplies — Q-0010',
  },
  'q0034-chore-preflight.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/lint/lint.test.ts',
    ],
    note: 'the chore flow surviving the range guard and the run-level preflight, and the diff-range grammar at every site a flow can hold one',
  },
  'q0034-dry-run.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/engine/engine.test.ts',
      'packages/core/src/engine/run-composition.test.ts',
    ],
    note: 'a dry run mutates nothing — the ticket read back unchanged, the run\'s own bookkeeping included, and the directories it must not create',
  },
  'q0034-probe-schema.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/adapters/probe.test.ts',
      'packages/core/src/engine/prompt.test.ts',
    ],
    note: 'the strict-schema rule as something executable, over PROBE_SCHEMA and over all four shapes schemaFor emits',
  },
  'q0034-review-fixes.js': {
    verdict: 'split',
    carriedBy: [
      'packages/core/src/contracts/validate-artifact.test.ts',
      'packages/core/src/engine/lifecycle-routing.test.ts',
      'packages/core/src/run-history/reader.test.ts',
    ],
    note: 'the four blockers the Q-0011 panel raised: validateFile\'s per-call schema read, the routing a FlowError takes, and the reader surviving a damaged sibling',
    binaryHalf: 'the exit codes and messages the binary routes a FlowError to — Q-0010',
  },
  'q0035-empty-range.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/git/git.test.ts',
      'packages/core/src/lint/lint.test.ts',
    ],
    note: 'the empty-range diagnostic quoting evidence and claiming no event, over ancestry, shallowState, emptyRangeEvidence and shortSha — and the directory walk that aggregates',
  },
  'q0036-board-containment.js': {
    verdict: 'cli',
    carriedBy: [],
    note: 'it spawns the binary and imports nothing from the spike\'s src; the containment computation itself is git.test.ts\'s subject and is reached from q0035-empty-range.js\'s row',
    binaryHalf: '`harness board` rendering the containment token beside a ticket — Q-0010',
  },
  'q0038-endpoint-preflight.js': {
    verdict: 'ported',
    carriedBy: ['packages/core/src/engine/diff.test.ts'],
    note: 'the preflight classifying each endpoint on its own, the deferred range\'s remedy, and the walk running once in flow order before the step loop',
  },
  'q0057-run-scoped-reviews.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/engine/engine.test.ts',
      'packages/core/src/engine/run-composition.test.ts',
    ],
    note: 'vars.run is the id this run was allocated and does not move when vars.iter does, and a run-scoped write path lands under it',
  },
  'q0062-worktree-lifecycle.js': {
    verdict: 'ported',
    carriedBy: [
      'packages/core/src/engine/q0062.source.test.ts',
      'packages/core/src/engine/worktree-lifecycle.test.ts',
    ],
    note: 'a finished run gives back the worktrees it obtained and a stopped one keeps them, registration rather than enumeration, a dirty or unremovable worktree kept with its reason, and no ref deleted by any source file in either tree',
  },
  'q0063-stdin-epipe.js': {
    verdict: 'ported',
    carriedBy: ['packages/core/src/adapters/exec.test.ts'],
    note: 'a CLI that exits before reading its prompt fails its step rather than killing the run, and lines arrive complete and in order',
  },
  'q0070-capture.js': {
    verdict: 'ported',
    carriedBy: ['packages/core/src/fanout/command.test.ts'],
    note: 'the capture matrix: no write shape, exit route or kill changes the result, and a capture failure can never look like a test result',
  },
  'q0077-base-flag.js': {
    verdict: 'split',
    carriedBy: ['packages/core/src/engine/diff.test.ts'],
    note: 'its one library subject is materialiseDiff under a base override, which moves the diff anchor and nothing else',
    binaryHalf: '`harness run … --base <ref>` parsing the flag and attributing an unresolvable override to it — Q-0010',
  },
  'q0080-allocation.js': {
    verdict: 'split',
    carriedBy: ['packages/core/src/backlog/backlog.test.ts'],
    note: 'one backlog, one prefix, and an allocator that refuses rather than guessing — asserted from q0080-allocation.json, the one table both trees read',
    binaryHalf: '`harness ticket new` and the refusal text it prints for a hostile --id — Q-0010',
    mentions: {
      'spike/bin/harness.js must not spell the grammar again': 'an assertion message naming the file it read, not a path handed to a spawn; the reference is the path.join above it',
    },
  },
  'smoke.js': {
    verdict: 'split',
    carriedBy: [
      'packages/core/src/adapters/adapters.test.ts',
      'packages/core/src/adapters/claude.test.ts',
      'packages/core/src/adapters/mock.test.ts',
      'packages/core/src/adapters/probe.test.ts',
      'packages/core/src/contracts/contracts.test.ts',
      'packages/core/src/engine/composite.test.ts',
      'packages/core/src/engine/diff.test.ts',
      'packages/core/src/engine/steps.test.ts',
      'packages/core/src/engine/suite-output.test.ts',
      'packages/core/src/fanout/fanout.test.ts',
      'packages/core/src/lint/lint.test.ts',
    ],
    note: 'split rather than cli: it spawns the binary AND imports from the spike\'s src at fifteen sites, every one of them an `await import()` that a scan for a static `from` cannot see — which is why every earlier account of this file called it binary-only. Those sites destructure authError, probeAdapter, withRetry, transientError, mockAdapter, claudeAdapter, lintFlow, FlowError, mergeFailure, testReport, environmentFailure, formatCost, resolveModel, materialiseDiff, syncBaseIntoTicketBranch, commitAll, waves, scopeToFailing and validate, and the counterparts above are where each of them now lives',
    binaryHalf: 'the mock end-to-end through `bin/harness.js` — every command, its exit codes and its printed bytes — which is M2\'s "30-check smoke test" and is Q-0010\'s to carry',
  },
};

/**
 * Entries in `spike/test/` that are not test files, each with why.
 *
 * `run.js` is excluded **by name**, and the exclusion is grounded rather than assumed: a test below
 * reads it and requires it to be the discovering runner it claims to be. The four verdicts describe
 * a test file, so the second entry — a shared data fixture — is classified here for the same reason
 * and by the same mechanism, rather than by inventing a fifth verdict for it.
 */
const NOT_A_SUITE: Record<string, string> = {
  'run.js': 'the runner itself: it reads this directory and executes every *.js it finds, and is not one of them',
  'q0080-allocation.json': 'the allocation table both trees assert over, read by q0080-allocation.js and by backlog/backlog.test.ts; it is a .json precisely so run.js, which discovers *.js, does not execute it',
};

/** What the recomputation decides about one spike test file, from its own text. */
interface Facts {
  /**
   * Whether it reaches the harness binary — the disjunction of the two oracles below.
   *
   * A disjunction rather than either one alone, because the two answer different halves and each
   * is the safe direction on its own: a file may name the binary and hand it to a helper that
   * starts it, and a file may start it through a name whose spelling is nowhere in its own text.
   * A test below asserts the two agree across the corpus as it stands, so a disagreement is a
   * finding rather than something the disjunction quietly absorbs.
   */
  readonly reachesBinary: boolean;
  /** Whether a quoted value in it spells the binary as a path — {@link binarySpellings}. */
  readonly spelledBinary: boolean;
  /** Whether a `node:child_process` call in it starts the binary — {@link launchSites}. */
  readonly launchesBinary: boolean;
  /** Whether it imports from the spike's `src`, statically or dynamically. */
  readonly importsSource: boolean;
  /** Its length, as `wc -l` counts it. */
  readonly lines: number;
  /** Everything the recomputation could not resolve — each of which fails the guard. */
  readonly problems: readonly string[];
}

/** A quoted value in a source file, with where it sits, so adjacency can be asked about. */
interface Quoted {
  readonly value: string;
  readonly start: number;
  readonly end: number;
  /** Which of the three quote characters opened it, so a template can be told from a string. */
  readonly quote: "'" | '"' | '`';
}

/**
 * `text` with comment bodies and regular-expression bodies blanked, and every string literal it
 * holds outside those.
 *
 * String bodies are **kept**, because the module specifiers and the binary spellings are exactly
 * what the two questions below read. Regular expressions are blanked because a quote inside one
 * would otherwise open a string that swallows the code after it — `q0080-allocation.js` contains
 * exactly such a pattern, an import statement quoted inside a regex, and reading it as an import
 * would report a specifier the file never takes.
 *
 * A template literal contributes its whole inner text as one value. That is coarse and deliberately
 * so: it cannot hide a binary spelling, which is the only thing asked of it.
 */
function scan(text: string): { code: string; quoted: Quoted[] } {
  const out = text.split('');
  const quoted: Quoted[] = [];
  const blank = (from: number, to: number): void => {
    for (let k = Math.max(from, 0); k < Math.min(to, out.length); k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // A `/` opens a regular expression only where a value may begin; after a name, a number or a
  // closing bracket it is division. The standard test, and exact for this corpus.
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
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === '\\') { j += 2; continue; }
        if (c !== '`' && text[j] === '\n') break;
        j++;
      }
      quoted.push({ value: text.slice(i + 1, j), start: i, end: j + 1, quote: c });
      previous = c;
      i = j + 1;
      continue;
    }
    if (c.trim()) previous = c;
    i++;
  }
  return { code: out.join(''), quoted };
}

/** The module specifiers a spike test file may take without this scan having to resolve anything. */
const ALLOWED_SPECIFIER = /^(?:node:[a-z_/]+|yaml|\.\.\/src\/[\w./-]+)$/;

/** The last path segment of the harness binary, which is what a reference must end in. */
const BINARY = 'harness.js';

/** Every module specifier `code` takes, and what it could not read about them. */
function specifiersOf(code: string): { specifiers: string[]; problems: string[] } {
  const specifiers: string[] = [];
  const problems: string[] = [];
  const fromClauses = [...code.matchAll(/^[ \t]*(?:import|export)\b[^\n;]*?\bfrom\s*(['"])([^'"\n]*)\1/gm)];
  for (const match of fromClauses) specifiers.push(match[2]);
  const bare = [...code.matchAll(/^[ \t]*import\s*(['"])([^'"\n]*)\1/gm)];
  for (const match of bare) specifiers.push(match[2]);
  // Fail closed on an import statement the two clauses above could not read. Both are bounded by
  // `[^\n…]`, so a clause wrapped across lines matches neither and is omitted in SILENCE — which is
  // the one failure direction the rest of this scan does not have, and it makes `importsSource`
  // false for a file that does import the library. Counting is sound rather than approximate: by
  // the grammar every `import` statement carries a module specifier, so a statement with no match
  // was missed and never one that had nothing to say. The technique is the dynamic-import count
  // four lines below, which had it right. Round 3, major 1.
  const readable = fromClauses.filter((match) => match[0].trimStart().startsWith('import')).length + bare.length;
  const statements = [...code.matchAll(/^[ \t]*import\b(?!\s*\()/gm)].length;
  if (statements > readable) {
    problems.push(`${statements - readable} import statement(s) name a specifier this scan cannot read`);
  }
  const dynamic = [...code.matchAll(/\bimport\s*\(\s*(['"])([^'"\n]*)\1\s*\)/g)];
  for (const match of dynamic) specifiers.push(match[2]);
  const dynamicCalls = [...code.matchAll(/\bimport\s*\(/g)].length;
  if (dynamicCalls !== dynamic.length) {
    problems.push(`${dynamicCalls - dynamic.length} dynamic import(s) name a specifier this scan cannot read`);
  }
  if (/\brequire\s*\(/.test(code)) problems.push('it reaches require(), which no import clause declares');
  for (const specifier of specifiers) {
    if (!ALLOWED_SPECIFIER.test(specifier)) problems.push(`it imports '${specifier}', which this scan cannot classify`);
  }
  return { specifiers, problems };
}

/**
 * Whether the binary's name could survive being extended on its right by text this scan cannot read.
 *
 * `harness` can — something appended to it makes `harness.js`. `q0080-` cannot, and neither can a
 * chunk whose last path segment is empty, because a `/` ends the segment the basename is taken from.
 */
const opensBinary = (text: string): boolean => {
  const tail = text.slice(text.lastIndexOf('/') + 1);
  return tail !== '' && BINARY.startsWith(tail);
};

/** The mirror of {@link opensBinary}: `.js` could be completed on its left, `.json` could not. */
const closesBinary = (text: string): boolean => {
  const cut = text.indexOf('/');
  const head = cut === -1 ? text : text.slice(0, cut);
  return head !== '' && BINARY.endsWith(head);
};

/** A template body's literal chunks, each saying which of its sides abuts an interpolation. */
function templateChunks(body: string): { text: string; before: boolean; after: boolean }[] {
  const parts: { text: string; before: boolean; after: boolean }[] = [];
  let current = '';
  let preceded = false;
  let i = 0;
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < body.length && depth > 0) {
        if (body[j] === '{') depth++;
        else if (body[j] === '}') depth--;
        j++;
      }
      parts.push({ text: current, before: preceded, after: true });
      current = '';
      preceded = true;
      i = j;
      continue;
    }
    current += body[i];
    i++;
  }
  parts.push({ text: current, before: preceded, after: false });
  return parts;
}

/**
 * Spellings of the binary assembled across something this scan cannot read, one sentence each.
 *
 * The hole this closes is the one a scan for the contiguous text `harness.js` cannot see: an
 * interpolation or a concatenation splits the name, so no single quoted value holds it and the file
 * reads as library-only. Rather than resolve the unreadable part — which is a general dataflow
 * question — this asks whether the *readable* part could still be completed into the binary by
 * whatever sits next to it, and refuses where it could. `` `harness${x}` `` is refused and
 * `` `${name}.json` `` is not, because no value ending `.json` has `harness.js` for a basename.
 */
function binaryAssemblies(code: string, quoted: readonly Quoted[]): string[] {
  const problems: string[] = [];
  for (const value of quoted) {
    if (value.quote === '`' && value.value.includes('${')) {
      for (const chunk of templateChunks(value.value)) {
        if ((chunk.after && opensBinary(chunk.text)) || (chunk.before && closesBinary(chunk.text))) {
          problems.push(`it could complete '${BINARY}' around an interpolation, in \`${value.value}\``);
          break;
        }
      }
    }
    const abutsAfter = /^\s*\+/.test(code.slice(value.end, value.end + 4));
    const abutsBefore = /\+\s*$/.test(code.slice(Math.max(0, value.start - 4), value.start));
    if ((abutsAfter && opensBinary(value.value)) || (abutsBefore && closesBinary(value.value))) {
      problems.push(`it could complete '${BINARY}' across a concatenation, at '${value.value}'`);
    }
  }
  return problems;
}

/** What an expression at a launch site turned out to be, or `null` where the scan cannot say. */
type Launched = { readonly kind: 'node' } | { readonly kind: 'file'; readonly value: string } | null;

/** The `node:child_process` calls whose first argument is a file rather than a shell command line. */
const FILE_LAUNCHERS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']);

/** A string literal with nothing interpolated into it, captured per quote so `'a' + 'b'` is not one. */
const LITERAL = /^(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)$/s;

/** The module every binding below comes from, and the only one this scan reads clauses for. */
const CHILD_PROCESS = 'node:child_process';

/** A name that may be bound, which is what tells a clause this scan can read from one it cannot. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * How a file binds {@link CHILD_PROCESS}, and every binding of it this scan will not follow.
 *
 * Round 2's major. Reading only `import { … } from 'node:child_process'` left three routes to the
 * same launchers invisible: `import * as cp` and a default `import cp` bind the module whole and
 * call through a member, and `{ spawnSync as run }` binds a launcher under a name the launcher set
 * does not contain. A file taking any of them could start an unresolvable path while
 * {@link launchSites} inspected nothing, which is a silent library-only classification — the class
 * this file exists to stop.
 */
interface ChildProcess {
  /** Local name → the export it names, for every launcher bound directly. Aliases are why it maps. */
  readonly functions: ReadonlyMap<string, string>;
  /** Local names bound to the module as a whole: `import * as cp`, and a default import. */
  readonly namespaces: ReadonlySet<string>;
  /** `code` with those import statements blanked, so a clause is never read as a use of its own name. */
  readonly rest: string;
  /** Bindings this scan cannot follow, each of which fails the file. */
  readonly problems: readonly string[];
}

/**
 * What an import clause binds, or `null` where this scan cannot read it.
 *
 * The four forms a module can be bound by, and nothing else: a named list with optional aliases, a
 * namespace, a default, and a default beside either. A clause outside them — a string import name,
 * anything this does not parse — returns `null` and is reported by its caller rather than read as
 * binding nothing, because binding nothing is what makes a launch site invisible.
 *
 * A **default** import counts as a namespace: Node's builtins expose the whole module object as
 * their default, so `import cp from 'node:child_process'` reaches `cp.spawnSync` exactly as
 * `import * as cp` does.
 */
function parseImportClause(clause: string): { functions: Map<string, string>; namespaces: Set<string> } | null {
  const functions = new Map<string, string>();
  const namespaces = new Set<string>();
  let rest = clause.trim();
  const withDefault = /^([A-Za-z_$][\w$]*)\s*,\s*([\s\S]+)$/.exec(rest);
  if (withDefault !== null) {
    namespaces.add(withDefault[1]);
    rest = withDefault[2].trim();
  }
  if (IDENTIFIER.test(rest)) {
    namespaces.add(rest);
    return { functions, namespaces };
  }
  const star = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(rest);
  if (star !== null) {
    namespaces.add(star[1]);
    return { functions, namespaces };
  }
  const braced = /^\{([^{}]*)\}$/.exec(rest);
  if (braced === null) return null;
  for (const part of braced[1].split(',')) {
    const text = part.trim();
    if (text === '') continue;
    const aliased = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(text);
    if (aliased !== null) {
      functions.set(aliased[2], aliased[1]);
      continue;
    }
    if (!IDENTIFIER.test(text)) return null;
    functions.set(text, text);
  }
  return { functions, namespaces };
}

/**
 * A static import of {@link CHILD_PROCESS}, capturing its clause.
 *
 * Two alternatives rather than one, and the braced one is first: a named list is what a formatter
 * wraps over several lines, and it is bounded by its own braces, so it may span them. Everything
 * else — a namespace, a default — is bounded to its line instead, because an unbounded clause would
 * run from an earlier `import` on another line straight through to this specifier and capture both.
 */
const CHILD_PROCESS_IMPORT = new RegExp(
  String.raw`^[ \t]*import\s+((?:[A-Za-z_$][\w$]*\s*,\s*)?\{[^{}]*\}|[^\n;{}]*?)\s*from\s*(['"])${CHILD_PROCESS}\2`,
  'gm');

/**
 * Every binding of {@link CHILD_PROCESS} in `code`, with the clauses that made them blanked out.
 *
 * A **dynamic** import of it is refused rather than followed. Its binding is an expression — the
 * awaited value, a destructuring of it, a member of it inline — so following one is the general
 * dataflow question this file declines everywhere else; refusing is the same fail-closed direction
 * as an unresolvable launch target, and no file in the corpus takes it that way.
 */
function childProcessBindings(code: string): ChildProcess {
  const functions = new Map<string, string>();
  const namespaces = new Set<string>();
  const problems: string[] = [];
  const out = code.split('');
  for (const match of code.matchAll(CHILD_PROCESS_IMPORT)) {
    for (let k = match.index; k < match.index + match[0].length; k++) if (out[k] !== '\n') out[k] = ' ';
    const parsed = parseImportClause(match[1]);
    if (parsed === null) {
      problems.push(`it binds ${CHILD_PROCESS} as '${match[1].trim()}', a clause this scan cannot read`);
      continue;
    }
    for (const [local, exported] of parsed.functions) functions.set(local, exported);
    for (const name of parsed.namespaces) namespaces.add(name);
  }
  const dynamic = new RegExp(String.raw`\bimport\s*\(\s*['"]${CHILD_PROCESS}['"]\s*\)`);
  if (dynamic.test(code)) {
    problems.push(`it takes ${CHILD_PROCESS} through a dynamic import, whose binding this scan cannot follow`);
  }
  return { functions, namespaces, rest: out.join(''), problems };
}

/** `text` with each quoted body spaced out, length preserved, so prose is not read as code. */
function blankQuoted(text: string, quoted: readonly Quoted[]): string {
  const out = text.split('');
  for (const value of quoted) {
    for (let k = value.start + 1; k < Math.min(value.end - 1, out.length); k++) if (out[k] !== '\n') out[k] = ' ';
  }
  return out.join('');
}

/** The top-level argument texts of the bracket opened at `open`, so a call can be taken apart. */
function argumentsAt(code: string, open: number): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 1;
  let inString: string | null = null;
  for (let i = open + 1; i < code.length; i++) {
    const c = code[i];
    if (inString !== null) {
      if (c === '\\') { current += c + code[i + 1]; i++; continue; }
      if (c === inString) inString = null;
      current += c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inString = c; current += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; current += c; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(current); break; }
      current += c;
      continue;
    }
    if (c === ',' && depth === 1) { args.push(current); current = ''; continue; }
    current += c;
  }
  return args.map((argument) => argument.trim()).filter((argument) => argument !== '');
}

/** Module-scope `const`/`let` initialisers that are unique in the file, so a name resolves at all. */
function uniqueBindings(code: string): Map<string, string> {
  const seen = new Map<string, number>();
  const initialisers = new Map<string, string>();
  for (const match of code.matchAll(/(?:^|\n)[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n]*?);?[ \t]*(?=\n)/g)) {
    seen.set(match[1], (seen.get(match[1]) ?? 0) + 1);
    initialisers.set(match[1], match[2].trim());
  }
  const bindings = new Map<string, string>();
  for (const [name, initialiser] of initialisers) if (seen.get(name) === 1) bindings.set(name, initialiser);
  return bindings;
}

/**
 * What `expression` starts, resolved through the four shapes this corpus uses and nothing else.
 *
 * A string literal is itself; `process.execPath` is node; a `path.join`/`path.resolve` is its **last**
 * argument, which is what decides the basename however unreadable the directories above it are; and a
 * name is its unique module-scope initialiser. Everything else — a call, a member, an interpolated
 * template, a concatenation, a name bound more than once — is `null`, and a `null` at a launch site
 * is a failure rather than a file quietly classified as starting nothing.
 */
function resolveLaunched(expression: string, bindings: Map<string, string>, seen: Set<string> = new Set()): Launched {
  const text = expression.trim();
  if (text === 'process.execPath') return { kind: 'node' };
  const literal = LITERAL.exec(text);
  if (literal !== null) {
    const value = literal[1] ?? literal[2] ?? literal[3];
    return value.includes('${') ? null : { kind: 'file', value };
  }
  if (/^path\.(?:join|resolve)\s*\(/.test(text)) {
    const args = argumentsAt(text, text.indexOf('('));
    const last = args[args.length - 1];
    return last === undefined ? null : resolveLaunched(last, bindings, seen);
  }
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    if (seen.has(text)) return null;
    const initialiser = bindings.get(text);
    return initialiser === undefined ? null : resolveLaunched(initialiser, bindings, new Set([...seen, text]));
  }
  return null;
}

/**
 * Whether `code` starts the harness binary, decided from what each launch site actually launches.
 *
 * The second oracle, and the one that does not read the binary's name out of the file's text at all.
 * Every call to a name imported from `node:child_process` is taken apart: its first argument is the
 * file it starts, and where that is node, the first element of its argv array is the script node
 * runs. Each is resolved by {@link resolveLaunched} or reported.
 *
 * **Three bounds, stated rather than left to be discovered.** `exec` and `execSync` take a shell
 * command line rather than a file, and are deliberately not resolved here: the whole command is one
 * quoted value, so {@link binarySpellings} reads it entire and {@link binaryAssemblies} covers a
 * name split across an interpolation inside it. A process started by a helper the file imports
 * from the spike's own `src` is the subject under test rather than a launch site — the path handed
 * to it is still a value both of those two read. And a namespace binding is followed only through a
 * direct member call: handed anywhere else — to a helper, through a computed member, into a
 * destructuring — it is reported, because what it is then called as is unreadable from here.
 *
 * @param quoted the file's string literals, whose bodies are spaced out before the namespace
 *   bindings are looked for. A binding's name occurring inside prose is not a use of it, and the
 *   corpus has such prose: `q0063-stdin-epipe.js` carries the word `spawn` inside an assertion
 *   message.
 */
function launchSites(code: string, quoted: readonly Quoted[]): { launchesBinary: boolean; problems: string[] } {
  const bindings = uniqueBindings(code);
  const imported = childProcessBindings(code);
  const problems = [...imported.problems];
  let launchesBinary = false;
  const starts = (launched: Launched): boolean =>
    launched !== null && launched.kind === 'file' && path.basename(launched.value) === BINARY;

  /** Resolve what one call starts, `open` being the index in `code` of its opening bracket. */
  const inspect = (label: string, open: number): void => {
    const args = argumentsAt(code, open);
    const first = resolveLaunched(args[0] ?? '', bindings);
    if (first === null) {
      problems.push(`${label}() starts a file this scan cannot resolve, from '${args[0] ?? ''}'`);
      return;
    }
    if (first.kind === 'file' && path.basename(first.value) !== 'node') {
      if (starts(first)) launchesBinary = true;
      return;
    }
    const argv = args[1];
    if (argv === undefined || !argv.startsWith('[')) {
      problems.push(`${label}() runs node with an argv this scan cannot read, from '${argv ?? ''}'`);
      return;
    }
    const script = argumentsAt(argv, 0)[0];
    const resolved = script === undefined ? null : resolveLaunched(script, bindings);
    if (resolved === null) {
      problems.push(`${label}() runs a script this scan cannot resolve, from '${script ?? ''}'`);
      return;
    }
    if (starts(resolved)) launchesBinary = true;
  };

  // A launcher bound directly is called by its local name, which an alias makes different from the
  // export it names — so membership of FILE_LAUNCHERS is asked of the export and the call site is
  // found under the local name.
  const uses = blankQuoted(imported.rest, quoted);
  for (const [local, exported] of imported.functions) {
    if (!FILE_LAUNCHERS.has(exported)) continue;
    // Every use, not only the calls. `const run = spawnSync` binds the launcher to a name this loop
    // never searches for, so `run(process.execPath, [candidate])` is inspected by nothing and the
    // file passes with its target unresolved. The namespace branch below has always refused a
    // non-call use; this is the same rule, owed to the direct binding and missing from it.
    // Round 3, major 2.
    for (const match of uses.matchAll(new RegExp(String.raw`\b${local}\b`, 'g'))) {
      const after = uses.slice(match.index + local.length);
      const call = /^\s*\(/.exec(after);
      if (call === null) {
        const excerpt = code.slice(match.index, match.index + 28).split('\n')[0].trim();
        problems.push(`'${local}' is bound to ${exported} and is used other than as a direct call, at '${excerpt}'`);
        continue;
      }
      inspect(local, match.index + local.length + call[0].length - 1);
    }
  }

  for (const namespace of imported.namespaces) {
    for (const match of uses.matchAll(new RegExp(String.raw`\b${namespace}\b`, 'g'))) {
      const after = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(uses.slice(match.index + namespace.length));
      if (after === null) {
        const excerpt = code.slice(match.index, match.index + 28).split('\n')[0].trim();
        problems.push(`'${namespace}' holds ${CHILD_PROCESS} and is used other than as a direct call, at '${excerpt}'`);
        continue;
      }
      if (!FILE_LAUNCHERS.has(after[1])) continue;
      inspect(`${namespace}.${after[1]}`, match.index + namespace.length + after[0].length - 1);
    }
  }
  return { launchesBinary, problems };
}

/**
 * Whether a quoted value spells the binary as a path, and every spelling that is neither that nor
 * registered prose.
 *
 * A value with no whitespace ending in `bin/harness.js` is a reference, and so is a bare
 * `harness.js` immediately preceded by a `bin` literal in the same argument list — the two spellings
 * this corpus uses, four files each. A value carrying whitespace is prose, and must be registered in
 * its entry's {@link Entry.mentions} to say so. Anything else is reported.
 */
function binarySpellings(
  text: string,
  quoted: readonly Quoted[],
  mentions: Record<string, string>,
): { spelledBinary: boolean; problems: string[] } {
  const problems: string[] = [];
  let spelledBinary = false;
  for (const [index, value] of quoted.entries()) {
    if (!value.value.includes(BINARY)) continue;
    if (/\s/.test(value.value)) {
      if (!(value.value in mentions)) problems.push(`it names the binary in '${value.value}', which its entry does not account for`);
      continue;
    }
    if (value.value.endsWith(`bin/${BINARY}`)) { spelledBinary = true; continue; }
    const before = quoted[index - 1];
    const adjacent = before !== undefined && before.value === 'bin' && text.slice(before.end, value.start).trim() === ',';
    if (value.value === BINARY && adjacent) { spelledBinary = true; continue; }
    problems.push(`it names the binary as '${value.value}', a spelling this scan cannot resolve`);
  }
  return { spelledBinary, problems };
}

/**
 * What `text` does, and everything about it this scan refuses to guess.
 *
 * Three questions, each anchored on something closed rather than on a pattern assumed exhaustive.
 *
 * **Which modules it takes** — {@link specifiersOf}. Every static import and every dynamic one must
 * name a specifier {@link ALLOWED_SPECIFIER} admits: a Node builtin, `yaml`, or the spike's `src`.
 * Anything else is reported, which is what stops a file borrowing a spawn it does not declare.
 *
 * **Whether it names the binary** — {@link binarySpellings}, over the quoted values, and
 * {@link binaryAssemblies}, over the joins between them, so a name split across an interpolation or
 * a concatenation fails rather than passing for library-only.
 *
 * **Whether it starts the binary** — {@link launchSites}, which reads the argument of each
 * `node:child_process` call rather than the file's text, reports every target it cannot resolve,
 * and — through {@link childProcessBindings} — every binding of that module it cannot follow to a
 * call in the first place.
 *
 * @param text the file's own source.
 * @param mentions the non-reference spellings this file's register entry accounts for.
 */
function factsOf(text: string, mentions: Record<string, string> = {}): Facts {
  const { code, quoted } = scan(text);
  const modules = specifiersOf(code);
  const spelled = binarySpellings(text, quoted, mentions);
  const assemblies = binaryAssemblies(code, quoted);
  const launched = launchSites(code, quoted);

  return {
    reachesBinary: spelled.spelledBinary || launched.launchesBinary,
    spelledBinary: spelled.spelledBinary,
    launchesBinary: launched.launchesBinary,
    importsSource: modules.specifiers.some((specifier) => specifier.startsWith('../src/')),
    lines: [...text].filter((character) => character === '\n').length,
    problems: [...modules.problems, ...spelled.problems, ...assemblies, ...launched.problems],
  };
}

/**
 * The verdicts the recomputation admits for a file with these two properties.
 *
 * A file that imports nothing from the spike's `src` has no library behaviour to port, so it may
 * carry neither `ported` nor `split` — nor `uncovered`, whose subject is a library half nothing
 * carries. One that does import and never reaches the binary has no binary half, so it may not carry
 * `cli`. And a file that does neither admits nothing at all, which fails rather than defaulting.
 */
const admissible = (facts: Facts): Verdict[] =>
  facts.importsSource
    ? (facts.reachesBinary ? ['split', 'uncovered'] : ['ported', 'uncovered'])
    : (facts.reachesBinary ? ['cli'] : []);

/** The package a repository-relative path is in, and the path below it, or null for neither. */
function inPackage(file: string): { pkg: string; relative: string } | null {
  const match = /^((?:packages|apps)\/[^/]+)\/(.+)$/.exec(file);
  return match === null ? null : { pkg: match[1], relative: match[2] };
}

/**
 * Everything wrong with `register` as a description of `files`, one sentence each.
 *
 * A function over its inputs, rather than assertions over the two constants, so each clause can be
 * shown firing on a mutated copy — demonstrating that a guard has a subject proves the guard fires,
 * not that each of its clauses does (Q-0071).
 *
 * @param patterns the include a counterpart must be collected by. A parameter for one reason: after
 *   this ticket every `*.test.ts` anywhere in a package is collected, so no real file could
 *   demonstrate the collection clause failing, and a clause that cannot be shown firing is the
 *   defect this file exists to record.
 */
function audit(
  register: Record<string, Entry>,
  files: Record<string, string>,
  patterns: readonly string[] = includePatterns,
): string[] {
  const problems: string[] = [];
  const say = (message: string): number => problems.push(message);

  for (const name of Object.keys(files)) {
    if (!(name in register) && !(name in NOT_A_SUITE)) say(`${name} is in spike/test and has no verdict`);
  }
  for (const name of Object.keys(register)) {
    if (!(name in files)) say(`${name} has a verdict and is not in spike/test`);
  }
  for (const name of Object.keys(NOT_A_SUITE)) {
    if (!(name in files)) say(`${name} is excluded and is not in spike/test`);
    if (name in register) say(`${name} is both excluded and given a verdict`);
  }

  for (const [name, entry] of Object.entries(register)) {
    const text = files[name];
    if (text === undefined) continue;
    const facts = factsOf(text, entry.mentions);
    for (const problem of facts.problems) say(`${name}: ${problem}`);
    for (const value of Object.keys(entry.mentions ?? {})) {
      if (!text.includes(value)) say(`${name}: its entry accounts for '${value}', which the file no longer holds`);
    }

    const allowed = admissible(facts);
    if (!allowed.includes(entry.verdict)) {
      say(`${name}: it is ${facts.reachesBinary ? '' : 'not '}a binary spawner and does ${facts.importsSource ? '' : 'not '}import the spike's source, so '${entry.verdict}' is not one of [${allowed.join(', ') || 'nothing'}]`);
    }

    const wantsCounterparts = entry.verdict === 'ported' || entry.verdict === 'split';
    if (wantsCounterparts && entry.carriedBy.length === 0) say(`${name}: '${entry.verdict}' names no counterpart`);
    if (!wantsCounterparts && entry.carriedBy.length > 0) say(`${name}: '${entry.verdict}' names counterparts it may not have`);
    const wantsBinaryHalf = entry.verdict === 'cli' || entry.verdict === 'split';
    if (wantsBinaryHalf && entry.binaryHalf === undefined) say(`${name}: '${entry.verdict}' does not name its binary half`);
    if (!wantsBinaryHalf && entry.binaryHalf !== undefined) say(`${name}: '${entry.verdict}' names a binary half it does not have`);
    if (entry.note.trim() === '') say(`${name}: its verdict carries no reason`);

    for (const counterpart of entry.carriedBy) {
      const where = inPackage(counterpart);
      if (where === null) {
        say(`${name}: '${counterpart}' is not inside a workspace package`);
        continue;
      }
      // Existence and collection are two failures, not one: a counterpart moved out of collection
      // is still on disk, and a register naming it would read as coverage while excusing nothing.
      // node_modules/.bin/turbo went dead in Q-0073's NOT_READ on day one, in exactly that way.
      try {
        repoFile(counterpart);
      } catch {
        say(`${name}: '${counterpart}' does not exist`);
        continue;
      }
      if (!collects(where.relative, patterns)) say(`${name}: '${counterpart}' exists and no include collects it`);
    }
  }
  return problems;
}

/** The directory the register describes, and the one this file reads. */
const SPIKE_TESTS = 'spike/test';

/**
 * Every file in `spike/test/`, as `[name, text]`, read once.
 *
 * The keys are `readdir`'s and nothing else's — the whole of AC-1(a). A directory that has gone, or
 * that holds nothing, fails loudly through {@link repoFile} and through the positive control below
 * rather than leaving the register describing an empty tree.
 */
const FILES: Record<string, string> = Object.fromEntries(
  fs.readdirSync(path.join(repoRoot, SPIKE_TESTS), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => [entry.name, repoFile(`${SPIKE_TESTS}/${entry.name}`)]));

const SUITES = Object.fromEntries(Object.entries(FILES).filter(([name]) => !(name in NOT_A_SUITE)));
const FACTS = Object.fromEntries(
  Object.entries(SUITES).map(([name, text]) => [name, factsOf(text, REGISTER[name]?.mentions)]));

/** The three classes AC-2 pins, as file sets rather than as counts. */
const classOf = (facts: Facts): 'binary-only' | 'both' | 'library-only' =>
  facts.reachesBinary ? (facts.importsSource ? 'both' : 'binary-only') : 'library-only';

const named = (klass: string): string[] =>
  Object.entries(FACTS).filter(([, facts]) => classOf(facts) === klass).map(([name]) => name).sort();

const linesOf = (names: readonly string[]): number =>
  names.reduce((total, name) => total + FACTS[name].lines, 0);

describe('Q-0054 AC-1 — every file in spike/test has a verdict, and the keys come from the tree', () => {
  test('the reader finds the directory at all', () => {
    // First, for the reason every positive control in this repository is first: a reader that had
    // lost its subject would leave the register describing nothing and every clause below green.
    expect(Object.keys(FILES).length, 'spike/test is empty — this register describes nothing').toBeGreaterThan(10);
    expect(Object.keys(FILES)).toContain('smoke.js');
  });

  test('every entry of spike/test is classified, and every key is on disk', () => {
    expect(audit(REGISTER, FILES).filter((problem) => /has no verdict|is not in spike\/test|both excluded/.test(problem)))
      .toEqual([]);
  });

  test('run.js is excluded by name, and the exclusion is grounded rather than assumed', () => {
    expect('run.js' in NOT_A_SUITE, 'the runner must be excluded by name').toBe(true);
    expect('run.js' in REGISTER, 'the runner must not also carry a verdict').toBe(false);
    // Grounding it: the file really is the discovering runner, so excluding it is a statement about
    // what it is rather than a name somebody typed. Its discovery is the property this ticket's
    // whole subject rests on, and `test-discovery.test.ts` is the workspace half of the same claim.
    const runner = repoFile('spike/test/run.js');
    expect(runner, 'it selects *.js').toContain(".endsWith('.js')");
    expect(runner, 'it excludes itself').toContain('f !== self');
    expect(runner, 'it reads the directory rather than a list').toContain('readdirSync(dir)');
  });

  test('the header states when the register dies and what a cli verdict claims', () => {
    // AC-1(c). A pointer rather than a transcription, per harness/rules.md: the argument lives in
    // the ticket and in the charter, and a copy here would go stale silently.
    const self = repoFile('packages/core/src/spike-parity.test.ts');
    expect(self, 'the retirement is not stated').toContain('deleted at the cutover by Q-0009');
    expect(self, 'what a cli verdict claims is not stated')
      .toContain('is a claim about Q-0010 rather than about this ticket');
  });
});

describe('Q-0054 AC-2 — the verdict is checked against the file, and an unclassifiable file stops', () => {
  test('nothing in spike/test resists classification', () => {
    const unresolvable = Object.entries(FACTS).flatMap(([name, facts]) => facts.problems.map((problem) => `${name}: ${problem}`));
    expect(unresolvable, 'these files name the binary or take a module this scan cannot resolve').toEqual([]);
  });

  test('every verdict is one the recomputation admits', () => {
    expect(audit(REGISTER, FILES).filter((problem) => problem.includes('is not one of'))).toEqual([]);
  });

  test('the three-way classification is an identity, not a count', () => {
    expect(named('binary-only')).toStrictEqual(['q0011-runs-cli.js', 'q0036-board-containment.js']);
    expect(named('both')).toStrictEqual([
      'q0011-run-history.js', 'q0033-surface.js', 'q0034-review-fixes.js',
      'q0077-base-flag.js', 'q0080-allocation.js', 'smoke.js',
    ]);
    expect(named('library-only')).toStrictEqual([
      'q0006-engine.js', 'q0034-chore-preflight.js', 'q0034-dry-run.js', 'q0034-probe-schema.js',
      'q0035-empty-range.js', 'q0038-endpoint-preflight.js', 'q0057-run-scoped-reviews.js',
      'q0062-worktree-lifecycle.js', 'q0063-stdin-epipe.js', 'q0070-capture.js',
    ]);
  });

  test('and so are its line totals, so the entangled share stops being re-derived by hand', () => {
    // Re-measured 2026-08-31 for Q-0062, which is this register doing exactly what it is for: it
    // added `q0062-worktree-lifecycle.js` (library-only, now 345 lines) and moved two existing
    // files — `smoke.js` +25 and `q0006-engine.js` +3, both re-aiming assertions that had read a
    // worktree the run now gives back. Was 336 / 2001 / 2059 / 4396 and 53%. The share is what
    // moved and it moved for a reason worth stating: a library-only file is one Q-0010 does not
    // inherit, so every such file makes the transfer smaller. Re-measured again in that ticket's
    // third revision round, which took `q0062-worktree-lifecycle.js` 276 → 345 covering the two
    // terminal statuses the review found untested, and again in its fifth, 345 → 401, widening the
    // AC-4 scan to every spelling of a ref deletion — the same file both times, so only its own
    // column moves, and the rounded share crossed from 50% to 49% on the second of them.
    const entangled = [...named('binary-only'), ...named('both')];
    const total = linesOf(Object.keys(FACTS));
    expect(linesOf(named('binary-only'))).toBe(336);
    expect(linesOf(named('both'))).toBe(2026);
    expect(linesOf(named('library-only'))).toBe(2463);
    expect(total).toBe(4825);
    // 49% of the suite transfers at Q-0010, which is the fact the routing decision turns on.
    expect(Math.round((linesOf(entangled) / total) * 100)).toBe(49);
  });

  test('the two spellings are both resolved, and neither carries the other', () => {
    // The measured hazard, as a property rather than as a sentence: four files write the binary as
    // one literal and four as two adjacent segments, so a scan anchored on either alone mis-files
    // the other four as library-only.
    const single = Object.entries(SUITES).filter(([, text]) => text.includes(`'bin/${BINARY}'`)).map(([name]) => name);
    const segments = Object.entries(SUITES)
      .filter(([, text]) => /'bin'\s*,\s*'harness\.js'/.test(text)).map(([name]) => name);
    expect(single.length, 'the one-literal spelling').toBe(4);
    expect(segments.length, 'the two-segment spelling').toBe(4);
    expect(single.filter((name) => segments.includes(name)), 'no file uses both').toEqual([]);
    expect([...single, ...segments].sort()).toStrictEqual([...named('binary-only'), ...named('both')].sort());
  });

  test('a comment naming the binary is not a reference, and a message is one its entry accounts for', () => {
    // Both directions of the scan's own discrimination, over the two real occurrences in the corpus.
    expect(factsOf("// bin/harness.js routes on it\nimport x from '../src/engine.js';").reachesBinary).toBe(false);
    expect(factsOf("const bin = path.join(spike, 'bin/harness.js');").reachesBinary).toBe(true);
    expect(factsOf("const bin = path.join(spike, 'bin', 'harness.js');").reachesBinary).toBe(true);
    expect(factsOf("const bin = path.join(spike, dir, 'harness.js');").problems)
      .toEqual(["it names the binary as 'harness.js', a spelling this scan cannot resolve"]);
    expect(factsOf("assert(x, 'spike/bin/harness.js must not spell the grammar again');").problems.length).toBe(1);
    expect(factsOf("assert(x, 'spike/bin/harness.js must not spell the grammar again');",
      { 'spike/bin/harness.js must not spell the grammar again': 'an assertion message' }).problems).toEqual([]);
  });

  test('a binary name assembled from more than one value stops the file rather than defaulting it', () => {
    // Round 1's major, as executable cases. Each of these classified library-only in silence: the
    // scan read only quoted values already holding the contiguous text `harness.js`, so splitting
    // the name across an interpolation or a `+` hid it from both the reference test and the
    // problem list. `reachesBinary` staying false is the point — what must not happen is a *quiet*
    // false, so every case below is asserted to carry a problem naming the text it could not read.
    const spawns = (expression: string): string =>
      `import { spawnSync } from 'node:child_process';\nconst r = spawnSync(process.execPath, [${expression}, 'runs']);\n`;

    const interpolated = spawns("path.join(spike, 'bin', `harness${'.js'}`)");
    expect(factsOf(interpolated).problems).toStrictEqual([
      "it could complete 'harness.js' around an interpolation, in `harness${'.js'}`",
      "spawnSync() runs a script this scan cannot resolve, from 'path.join(spike, 'bin', `harness${'.js'}`)'",
    ]);

    // The same assembly given a name first, so the launch site sees only an identifier.
    const bound = "import { spawnSync } from 'node:child_process';\n"
      + "const bin = path.join(spike, 'bin', `harness${'.js'}`);\n"
      + "const r = spawnSync(process.execPath, [bin, 'runs']);\n";
    expect(factsOf(bound).problems).toStrictEqual([
      "it could complete 'harness.js' around an interpolation, in `harness${'.js'}`",
      "spawnSync() runs a script this scan cannot resolve, from 'bin'",
    ]);

    // Concatenation rather than interpolation, and from both sides of the join.
    expect(factsOf(spawns("path.join(spike, 'bin', 'harness' + '.js')")).problems).toStrictEqual([
      "it could complete 'harness.js' across a concatenation, at 'harness'",
      "it could complete 'harness.js' across a concatenation, at '.js'",
      "spawnSync() runs a script this scan cannot resolve, from 'path.join(spike, 'bin', 'harness' + '.js')'",
    ]);

    // And the discrimination that keeps it usable: a value that cannot be completed into the binary
    // is silent, or every `${name}.json` in the corpus would be a problem. `.json` is not a tail of
    // `harness.js`; `.js` is.
    expect(factsOf('const p = path.join(d, `${name}.json`);').problems).toEqual([]);
    expect(factsOf('const p = path.join(d, `generic-${a}.json`);').problems).toEqual([]);
    expect(factsOf('const p = path.join(d, `${name}.js`);').problems)
      .toStrictEqual(["it could complete 'harness.js' around an interpolation, in `${name}.js`"]);
  });

  test('AC-2: a static import wrapped across lines is read, not skipped', () => {
    // Round 3, major 1. `specifiersOf`'s static clause is `[^\n;]*?`, which cannot cross a newline,
    // and — unlike the dynamic-import clause four lines below it — nothing counts what it missed. So
    // a formatter-wrapped source import is invisible rather than refused, `importsSource` is false,
    // and a binary-spawning mixed file is admitted as `cli`. Fails open, where every other unreadable
    // shape in this scan fails closed.
    const wrapped = "import {\n  runFlow,\n} from '../src/engine.js';\n";
    expect(factsOf(wrapped).problems).toStrictEqual([
      '1 import statement(s) name a specifier this scan cannot read',
    ]);

    // Closed rather than complete, and the difference is deliberate: the clause is still not read,
    // so `importsSource` stays false — but the file now carries a problem, and a file with problems
    // takes no verdict. Silence was the defect; refusing is the fix.
    expect(factsOf(wrapped).importsSource).toBe(false);

    // And the discrimination that keeps it usable: the single-line form was never in doubt, and a
    // failure here would mean the oracle had been broken rather than closed.
    expect(factsOf("import { runFlow } from '../src/engine.js';\n").importsSource).toBe(true);
    expect(factsOf("import { runFlow } from '../src/engine.js';\n").problems).toStrictEqual([]);
  });

  test('AC-2: a launcher reached through an alias is inspected, not ignored', () => {
    // Round 3, major 2. A directly bound launcher is inspected only where the imported identifier is
    // itself the callee, so binding it to another name walks past both oracles and the file can be
    // accepted as `ported` with its binary target unresolved.
    const aliased = "import { spawnSync } from 'node:child_process';\n"
      + 'const run = spawnSync;\n'
      + "run(process.execPath, [candidate, 'runs']);\n";
    expect(factsOf(aliased).problems, 'an aliased launcher must stop the file').not.toStrictEqual([]);
  });

  test('a launch site whose target the scan cannot resolve stops the file', () => {
    // The other half of the same major: the binary need not be spelled anywhere for a file to start
    // it, so what each node:child_process call launches is resolved rather than inferred from text.
    // Both launchers are bound, because a call to a name the file never imported is not inspected
    // at all — so a fixture importing only `spawnSync` would assert nothing about the `execFileSync`
    // line below, which is what it read until round 3.
    const header = "import { execFileSync, spawnSync } from 'node:child_process';\n";
    expect(factsOf(`${header}spawnSync(process.execPath, [whatever(), 'runs']);\n`).problems)
      .toStrictEqual(["spawnSync() runs a script this scan cannot resolve, from 'whatever()'"]);
    expect(factsOf(`${header}spawnSync(process.execPath, [path.join(spike, 'bin', name)]);\n`).problems)
      .toStrictEqual(["spawnSync() runs a script this scan cannot resolve, from 'path.join(spike, 'bin', name)'"]);
    expect(factsOf(`${header}spawnSync(process.execPath, argv);\n`).problems)
      .toStrictEqual(["spawnSync() runs node with an argv this scan cannot read, from 'argv'"]);
    expect(factsOf(`${header}spawnSync(whichever, ['x']);\n`).problems)
      .toStrictEqual(["spawnSync() starts a file this scan cannot resolve, from 'whichever'"]);

    // Resolvable, and each resolving to something that is not the binary: a bare program name, a
    // node argv whose first element is a flag, and a sibling script.
    expect(factsOf(`${header}execFileSync('git', args, { cwd });\n`).problems).toEqual([]);
    expect(factsOf(`${header}spawnSync(process.execPath, ['-e', source]);\n`).launchesBinary).toBe(false);
    expect(factsOf(`${header}spawnSync(process.execPath, [path.join(rdir, 'run.js')]);\n`).launchesBinary).toBe(false);

    // Resolvable, through a binding, to the binary — both spellings the corpus uses.
    const through = (init: string): boolean =>
      factsOf(`${header}const bin = ${init};\nspawnSync('node', [bin, 'runs']);\n`).launchesBinary;
    expect(through("path.join(spike, 'bin/harness.js')")).toBe(true);
    expect(through("path.join(spike, 'bin', 'harness.js')")).toBe(true);
  });

  test('a launcher reached through an import form other than a plain named one is read, not missed', () => {
    // Round 2's major, and the two forms it names. A namespace import and a default import both
    // bind the module whole, so the launcher is reached through a member call that the old scan —
    // which read `import { … }` and nothing else — never looked at: the launch site was invisible,
    // an unresolvable path produced no problem, and the file could be accepted as `ported`.
    const launches = (header: string, call: string, target: string): Facts =>
      factsOf(`${header}\nconst r = ${call}(process.execPath, [${target}, 'runs']);\n`);

    // Fails closed: the target does not resolve, and the file now says so instead of nothing.
    for (const header of ["import * as cp from 'node:child_process';", "import cp from 'node:child_process';"]) {
      expect(launches(header, 'cp.spawnSync', 'candidate').problems)
        .toStrictEqual(["cp.spawnSync() runs a script this scan cannot resolve, from 'candidate'"]);
    }
    // And resolves when it can: the member call is a launch site like any other, both spellings.
    const found = (init: string): boolean =>
      factsOf("import * as cp from 'node:child_process';\n"
        + `const bin = ${init};\ncp.execFileSync(bin, ['runs']);\n`).launchesBinary;
    expect(found("path.join(spike, 'bin/harness.js')")).toBe(true);
    expect(found("path.join(spike, 'bin', 'harness.js')")).toBe(true);
    expect(factsOf("import * as cp from 'node:child_process';\n"
      + "cp.execFileSync('git', ['status']);\n").launchesBinary).toBe(false);

    // The third route the same clause-shaped read missed: an alias binds a launcher under a name
    // the launcher set does not contain, so `run` was neither recognised nor reported.
    expect(factsOf("import { spawnSync as run } from 'node:child_process';\n"
      + "run(process.execPath, [candidate]);\n").problems)
      .toStrictEqual(["run() runs a script this scan cannot resolve, from 'candidate'"]);
  });

  test('and a binding of node:child_process this scan cannot follow stops the file', () => {
    // The other half of "support them or reject them". Each of these binds the module in a way the
    // scan will not follow to a call site, and each is a problem rather than a quiet library-only.
    expect(factsOf("import * as cp from 'node:child_process';\nconst r = cp['spawnSync'](bin, []);\n").problems)
      .toStrictEqual(["'cp' holds node:child_process and is used other than as a direct call, at 'cp['spawnSync'](bin, []);'"]);
    expect(factsOf("import * as cp from 'node:child_process';\nlaunch(cp, bin);\n").problems)
      .toStrictEqual(["'cp' holds node:child_process and is used other than as a direct call, at 'cp, bin);'"]);
    expect(factsOf("import * as cp from 'node:child_process';\nconst { spawnSync } = cp;\nspawnSync(bin, []);\n").problems)
      .toStrictEqual(["'cp' holds node:child_process and is used other than as a direct call, at 'cp;'"]);
    expect(factsOf("const cp = await import('node:child_process');\ncp.spawnSync(bin, []);\n").problems)
      .toStrictEqual(['it takes node:child_process through a dynamic import, whose binding this scan cannot follow']);
    expect(factsOf("import { 'spawnSync' as run } from 'node:child_process';\nrun(bin, []);\n").problems)
      .toStrictEqual(["it binds node:child_process as '{ 'spawnSync' as run }', a clause this scan cannot read"]);

    // And the discriminations that keep it usable, or the corpus itself would fail: a member call
    // that is not a launcher is not a use to report, prose holding the binding's name is not a use
    // at all, and a named import — what all fifteen corpus files take — is unchanged.
    expect(factsOf("import * as cp from 'node:child_process';\ncp.exec('ls', () => {});\n").problems).toEqual([]);
    expect(factsOf("import * as cp from 'node:child_process';\n"
      + "cp.execFileSync('git', ['x']);\nassert(y, 'cp is what copies it');\n").problems).toEqual([]);
    expect(factsOf("import { execFileSync } from 'node:child_process';\nexecFileSync('git', ['x']);\n").problems)
      .toEqual([]);

    // A wrapped named list is still one clause. Reading it line by line would bind nothing and put
    // the launch site back out of sight — the same fail-open under a formatter rather than under an
    // import form, which is why the clause is bounded by its own braces and not by its line.
    //
    // This fixture also carries round 3's first finding, which is how that defect survived: the
    // binding clause is read here, and `specifiersOf` — four hundred lines away, written in the same
    // run by the same hand that wrote the sentence above — kept a line-bounded regex and omitted the
    // very same statement in silence. One hazard, reasoned about in one place and not the other. The
    // import-statement problem below is that refusal, and it belongs to a fixture that was already
    // proving the point before anyone noticed.
    expect(factsOf('import {\n  execFileSync,\n  spawnSync,\n} from \'node:child_process\';\n'
      + "spawnSync(process.execPath, [candidate]);\n").problems)
      .toStrictEqual([
        '1 import statement(s) name a specifier this scan cannot read',
        "spawnSync() runs a script this scan cannot resolve, from 'candidate'",
      ]);
    // And the bound that keeps that from over-reaching: an earlier import on another line is not
    // swallowed into this clause, whether or not the file terminates its statements.
    for (const first of ["import fs from 'node:fs';\n", "import fs from 'node:fs'\n"]) {
      expect(factsOf(`${first}import { spawnSync } from 'node:child_process';\n`
        + 'spawnSync(process.execPath, [candidate]);\n').problems)
        .toStrictEqual(["spawnSync() runs a script this scan cannot resolve, from 'candidate'"]);
    }
  });

  test('the two oracles agree across the corpus, so neither is carrying the other', () => {
    // reachesBinary is a disjunction, which is the safe direction and also the one that could hide a
    // half that had stopped working. Asserting the agreement is what keeps both live: if the text
    // oracle were deleted tomorrow, or the launch oracle stopped resolving `bin`, this fails.
    const disagreeing = Object.entries(FACTS)
      .filter(([, facts]) => facts.spelledBinary !== facts.launchesBinary)
      .map(([name]) => name);
    expect(disagreeing, 'one oracle sees a binary the other does not').toEqual([]);
    const byLaunch = Object.entries(FACTS).filter(([, facts]) => facts.launchesBinary).map(([name]) => name).sort();
    expect(byLaunch, 'the launch oracle alone reproduces the entangled set')
      .toStrictEqual([...named('binary-only'), ...named('both')].sort());
  });

  test('and a module this scan cannot classify stops the file rather than defaulting it', () => {
    // The helper case AC-2 names: a spike test that borrowed another file's spawn would import it,
    // and an import this scan cannot place is reported instead of read as "names no binary".
    expect(factsOf("import { cli } from './helper.js';").problems)
      .toEqual(["it imports './helper.js', which this scan cannot classify"]);
    expect(factsOf('const m = await import(specifier);').problems)
      .toEqual(['1 dynamic import(s) name a specifier this scan cannot read']);
    expect(factsOf("import x from '../src/engine.js';").problems).toEqual([]);
  });
});

describe('Q-0054 AC-3 — a ported or split entry names counterparts that exist and are collected', () => {
  test('every counterpart exists, is inside a package, and the include collects it', () => {
    expect(audit(REGISTER, FILES).filter((problem) => /does not exist|no include collects it|not inside a workspace/.test(problem)))
      .toEqual([]);
  });

  test('and the naming is a real audit rather than one file repeated', () => {
    // A register whose counterpart column had collapsed to a single popular file would satisfy every
    // clause above while saying nothing about the union it exists to describe.
    const all = Object.values(REGISTER).flatMap((entry) => entry.carriedBy);
    expect(new Set(all).size, 'distinct counterparts named').toBe(29);
    expect(all.length, 'counterpart namings in total').toBe(49);
  });
});

describe('Q-0054 AC-4 — the register is identities with pinned arithmetic, and each clause fires', () => {
  test('the register describes this tree with nothing left over', () => {
    expect(audit(REGISTER, FILES)).toEqual([]);
    expect(Object.keys(REGISTER).length, 'files with a verdict').toBe(18);
    expect(Object.keys(NOT_A_SUITE).length, 'entries that are not test files').toBe(2);
    expect(Object.keys(FILES).length, 'entries in spike/test').toBe(20);
    const verdicts = Object.values(REGISTER).map((entry) => entry.verdict);
    expect(verdicts.filter((verdict) => verdict === 'cli').length).toBe(2);
    expect(verdicts.filter((verdict) => verdict === 'split').length).toBe(6);
    expect(verdicts.filter((verdict) => verdict === 'ported').length).toBe(10);
    expect(verdicts.filter((verdict) => verdict === 'uncovered').length).toBe(0);
  });

  /** `REGISTER` with `name`'s entry replaced by `change`, or removed where `change` is null. */
  const mutated = (name: string, change: Partial<Entry> | null): Record<string, Entry> => {
    const copy = { ...REGISTER };
    if (change === null) delete copy[name];
    else copy[name] = { ...copy[name], ...change };
    return copy;
  };

  test('(a) a deleted row fails, because the keys come from the tree', () => {
    expect(audit(mutated('q0070-capture.js', null), FILES))
      .toContain('q0070-capture.js is in spike/test and has no verdict');
  });

  test('(b) a verdict the recomputation contradicts fails', () => {
    // q0070-capture.js imports runCommand and spawns nothing, so `cli` is a claim its own text
    // refutes. The message names both properties, so a reader is told why rather than that.
    const problems = audit(mutated('q0070-capture.js', { verdict: 'cli', carriedBy: [], binaryHalf: 'none' }), FILES);
    expect(problems.some((problem) => problem.startsWith('q0070-capture.js') && problem.includes("'cli' is not one of [ported, uncovered]"))).toBe(true);
  });

  test('(c) a counterpart that does not exist fails', () => {
    expect(audit(mutated('q0070-capture.js', { carriedBy: ['packages/core/src/fanout/no-such.test.ts'] }), FILES))
      .toContain("q0070-capture.js: 'packages/core/src/fanout/no-such.test.ts' does not exist");
  });

  test('(d) a counterpart that exists and is collected by nothing fails', () => {
    // Two shapes, because after this ticket every `*.test.ts` in a package is collected and no real
    // file could exhibit the second on its own. First a real file that is really not collected under
    // the configured include; then the whole register, unchanged, under an include narrow enough to
    // miss a counterpart that exists — which is how a register decays into a list of paths that
    // excuses nothing while still reading as coverage.
    expect(audit(mutated('q0070-capture.js', { carriedBy: ['packages/core/test/repo.ts'] }), FILES))
      .toContain("q0070-capture.js: 'packages/core/test/repo.ts' exists and no include collects it");
    expect(audit(REGISTER, FILES, ['src/engine/**/*.test.ts']))
      .toContain("q0070-capture.js: 'packages/core/src/fanout/command.test.ts' exists and no include collects it");
  });

  test('(e) an entry that names no counterpart, or names one it may not have, fails', () => {
    expect(audit(mutated('q0070-capture.js', { carriedBy: [] }), FILES))
      .toContain("q0070-capture.js: 'ported' names no counterpart");
    expect(audit(mutated('q0011-runs-cli.js', { carriedBy: ['packages/core/src/index.test.ts'] }), FILES))
      .toContain("q0011-runs-cli.js: 'cli' names counterparts it may not have");
  });
});
