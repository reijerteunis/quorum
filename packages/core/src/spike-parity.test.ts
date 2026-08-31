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
  /** Whether it constructs a path naming the harness binary. */
  readonly reachesBinary: boolean;
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
      quoted.push({ value: text.slice(i + 1, j), start: i, end: j + 1 });
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

/**
 * What `text` does, and everything about it this scan refuses to guess.
 *
 * Two questions, both anchored on something closed rather than on a pattern assumed exhaustive.
 *
 * **Which modules it takes.** Every static import and every dynamic one must name a specifier
 * {@link ALLOWED_SPECIFIER} admits — a Node builtin, `yaml`, or the spike's `src`. Anything else is
 * reported, which is what closes *reaches the binary through a helper*: a file cannot borrow another
 * file's spawn without importing it, and no import this scan cannot read passes silently.
 *
 * **Whether it names the binary.** Every quoted value holding {@link BINARY} outside a comment is
 * one of three things. A value with no whitespace ending in `bin/harness.js` is a reference, and so
 * is a bare `harness.js` immediately preceded by a `bin` literal in the same argument list — the two
 * spellings this corpus uses, four files each. A value carrying whitespace is prose, and must be
 * registered in its entry's {@link Entry.mentions} to say so. Anything else is reported.
 *
 * @param text the file's own source.
 * @param mentions the non-reference spellings this file's register entry accounts for.
 */
function factsOf(text: string, mentions: Record<string, string> = {}): Facts {
  const { code, quoted } = scan(text);
  const problems: string[] = [];

  const specifiers: string[] = [];
  for (const match of code.matchAll(/^[ \t]*(?:import|export)\b[^\n;]*?\bfrom\s*(['"])([^'"\n]*)\1/gm)) specifiers.push(match[2]);
  for (const match of code.matchAll(/^[ \t]*import\s*(['"])([^'"\n]*)\1/gm)) specifiers.push(match[2]);
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

  let reachesBinary = false;
  for (const [index, value] of quoted.entries()) {
    if (!value.value.includes(BINARY)) continue;
    if (/\s/.test(value.value)) {
      if (!(value.value in mentions)) problems.push(`it names the binary in '${value.value}', which its entry does not account for`);
      continue;
    }
    if (value.value.endsWith(`bin/${BINARY}`)) { reachesBinary = true; continue; }
    const before = quoted[index - 1];
    const adjacent = before !== undefined && before.value === 'bin' && text.slice(before.end, value.start).trim() === ',';
    if (value.value === BINARY && adjacent) { reachesBinary = true; continue; }
    problems.push(`it names the binary as '${value.value}', a spelling this scan cannot resolve`);
  }

  return {
    reachesBinary,
    importsSource: specifiers.some((specifier) => specifier.startsWith('../src/')),
    lines: [...text].filter((character) => character === '\n').length,
    problems,
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
      'q0063-stdin-epipe.js', 'q0070-capture.js',
    ]);
  });

  test('and so are its line totals, so the entangled share stops being re-derived by hand', () => {
    const entangled = [...named('binary-only'), ...named('both')];
    const total = linesOf(Object.keys(FACTS));
    expect(linesOf(named('binary-only'))).toBe(336);
    expect(linesOf(named('both'))).toBe(2001);
    expect(linesOf(named('library-only'))).toBe(2059);
    expect(total).toBe(4396);
    // 53% of the suite transfers at Q-0010, which is the fact the routing decision turns on.
    expect(Math.round((linesOf(entangled) / total) * 100)).toBe(53);
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
    expect(new Set(all).size, 'distinct counterparts named').toBe(27);
    expect(all.length, 'counterpart namings in total').toBe(47);
  });
});

describe('Q-0054 AC-4 — the register is identities with pinned arithmetic, and each clause fires', () => {
  test('the register describes this tree with nothing left over', () => {
    expect(audit(REGISTER, FILES)).toEqual([]);
    expect(Object.keys(REGISTER).length, 'files with a verdict').toBe(17);
    expect(Object.keys(NOT_A_SUITE).length, 'entries that are not test files').toBe(2);
    expect(Object.keys(FILES).length, 'entries in spike/test').toBe(19);
    const verdicts = Object.values(REGISTER).map((entry) => entry.verdict);
    expect(verdicts.filter((verdict) => verdict === 'cli').length).toBe(2);
    expect(verdicts.filter((verdict) => verdict === 'split').length).toBe(6);
    expect(verdicts.filter((verdict) => verdict === 'ported').length).toBe(9);
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
