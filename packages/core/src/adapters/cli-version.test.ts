/**
 * Q-0067 AC-1, AC-4, AC-5 and AC-6: the vocabulary, the comparison, and the door held shut.
 *
 * The guards are longer than the five lines they guard, because what this ticket is worth is not
 * that two numbers can be compared — it is that the answer stays a report. Why: see *"An adapter
 * records the version it was verified against, and never a version it supports"* (2026-09-08),
 * whose clause (c) is what AC-6 makes executable.
 */
import path from 'node:path';

import { CLI_VERSION_STATES } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import { cliVersion } from './adapters.js';
import { CLAUDE_CAPABILITIES } from './claude-capabilities.js';
import { CODEX_CAPABILITIES } from './codex-capabilities.js';
import { coreSourceFiles, repoFile, repoRoot } from '../../test/corpus.js';

/**
 * Both production corpora as `[repository path, text]`, which is what AC-1 and AC-6 are about.
 *
 * The two-root shape is `backlog.source.test.ts`'s, for the same reason: the rule spans the package
 * that produces the fact and the package that renders it, so a scan over either half alone would
 * report success while the other half held the violation. `packages/cli/src/**` is a declared input
 * of this task, so a cached pass cannot stand over an edit there.
 */
const productionSources = (): [string, string][] => [
  ...coreSourceFiles().map(([name, text]) => [`packages/core/src/${name}`, text] as [string, string]),
  ...coreSourceFiles(path.join(repoRoot, 'packages/cli/src')).map(([name, text]) => [`packages/cli/src/${name}`, text] as [string, string]),
];

/**
 * The two production files that may name a version state, and what each one is.
 *
 * A register of identities rather than a count (Q-0073): a THIRD spelling fails by name, which is
 * what makes the next one deliberate. These are the two sites AC-6 names — one producer, one
 * renderer — and there is no third role for a state to be in.
 */
const STATE_SITES: Record<string, string> = {
  'packages/core/src/adapters/adapters.ts':
    'the derivation: `cliVersion` is the one place a state is produced, from two strings and nothing else',
  'packages/cli/src/adapters.ts':
    'the rendering: `VERSION_CLAUSE` is the one place a state becomes a sentence, and it renders under --probe alone',
};

/**
 * The three JavaScript string syntaxes, so the scan is a scan for a *state* rather than for one way
 * of writing one.
 *
 * A guard that saw `'ahead'` alone would be satisfied by `"ahead"` or by a template literal, which
 * is a bypass costing one keystroke. Comments are deliberately NOT blanked first: a lexer that got
 * it wrong would fail OPEN, and a prose mention of a quoted state failing this guard is the safe
 * direction — the shape `turbo-inputs.test.ts` already takes, where a quoted path in a comment is
 * collected as one.
 */
const QUOTES = ["'", '"', '`'];

/** Each spelling of `state` this scan treats as one and the same. */
const quotedForms = (state: string): string[] => QUOTES.map((quote) => `${quote}${state}${quote}`);

/**
 * The three states only this vocabulary spells, in every quoting.
 *
 * `indeterminate` is excluded HERE and covered by clause C instead, which is the structural half of
 * the same claim. Containment and push lag both spell that string, so it is not this fact's —
 * exactly as `missing ref`, `shallow clone` and `git failed` sit in two reason sets at once, where
 * `git.source.test.ts` already records that **a shared string is not a shared question**. A flat
 * scan including it would report `git.ts`, `diff.ts` and `board.ts` as readers of a vocabulary they
 * have never heard of.
 */
const OWN_STATE_LITERALS = CLI_VERSION_STATES.filter((state) => state !== 'indeterminate').flatMap(quotedForms);

/** All four, which is admissible only over files already known to name this vocabulary (clause C). */
const ALL_STATE_LITERALS = CLI_VERSION_STATES.flatMap(quotedForms);

/**
 * Every name a file has to write down to obtain a version state, whatever literal it then spells.
 *
 * The two snake_case entries are the `--json` report's own keys, and they are the reason this list
 * is not four names: a reader of `entry.version_state` has a state in hand while naming no exported
 * identifier at all, so a vocabulary that stopped at the exports would call that file a stranger.
 */
const VOCABULARY = [
  'cliVersion', 'CliVersionResult', 'CliVersionState', 'CLI_VERSION_STATES', 'version_state', 'verified_version',
];

/** The files a scan finds naming any of `needles`. */
const namedIn = (sources: readonly [string, string][], needles: readonly string[]): string[] =>
  sources.filter(([, text]) => needles.some((needle) => text.includes(needle))).map(([name]) => name).sort();

/** The two producing-or-rendering sites, plus the barrel, which re-exports and reads nothing. */
const ALLOWED_NAMERS = [...Object.keys(STATE_SITES), 'packages/core/src/index.ts'].sort();

/** The subset of `sources` that names this vocabulary at all — clause C's subject. */
const vocabularyNamers = (sources: readonly [string, string][]): [string, string][] =>
  sources.filter(([, text]) => VOCABULARY.some((name) => text.includes(name)));

/**
 * The genuine corpus with one file's text replaced, or one file added.
 *
 * A bypass is planted over real source rather than over a contrivance, and it REPLACES rather than
 * appends, so a mutation aimed at an already-allowed file — which is how clause C is shown red
 * without its neighbours firing — leaves exactly one entry under that name.
 */
const withPlanted = (name: string, text: string): [string, string][] =>
  [...productionSources().filter(([key]) => key !== name), [name, text] as [string, string]];

describe('AC-1 — the vocabulary is declarations only, and lives in one place', () => {
  test('the shared module exports the tuple and nothing that runs', () => {
    // Asserted over the module's own text rather than over its namespace, because `@quorum/shared`
    // publishes `"."` alone and no subpath (Q-0096 AC-5) — there is no way to import one module of
    // it, and the barrel's keys would answer for ten files rather than for this one. A derivation or
    // a rendering table added to it shows up here as a second runtime export.
    const exported = repoFile('packages/shared/src/cli-version.ts').split('\n').filter((line) => line.startsWith('export'));
    const runtime = exported.filter((line) => !line.startsWith('export type'));
    expect(runtime, 'the module has a runtime export other than the state tuple').toHaveLength(1);
    expect(runtime[0]).toContain('export const CLI_VERSION_STATES');
    expect(exported.filter((line) => line.startsWith('export type')), 'the state type and the result shape').toHaveLength(2);
    // And it is reachable by the name the rest of the workspace uses, which the import above proves.
    expect(CLI_VERSION_STATES).toStrictEqual(['as-verified', 'ahead', 'behind', 'indeterminate']);
  });

  test('and it holds no derivation, no rendering table and no import', () => {
    // The shape `containment.ts` and `push-lag.ts` already set: `core` answers, and the surface
    // decides whether the answer is worth printing. `shared` is bundled for a browser, so a module
    // that reached for anything would be a second defect on top of this one.
    const text = repoFile('packages/shared/src/cli-version.ts');
    for (const forbidden of ['=>', 'function ', 'if (', 'import ', 'require(', 'process.', 'node:']) {
      expect(text.includes(forbidden), `cli-version.ts must not contain ${JSON.stringify(forbidden)}`).toBe(false);
    }
    expect(repoFile('packages/shared/src/index.ts')).toContain("export * from './cli-version.js';");
  });

  test('clause A — exactly two production files spell one of its own states, in any quoting', () => {
    const sources = productionSources();
    // A scan over an empty corpus reports success over nothing, and both halves must contribute.
    expect(sources.some(([name]) => name.startsWith('packages/core/src/')), 'the core half is missing').toBe(true);
    expect(sources.some(([name]) => name.startsWith('packages/cli/src/')), 'the cli half is missing').toBe(true);
    expect(namedIn(sources, OWN_STATE_LITERALS)).toStrictEqual(Object.keys(STATE_SITES).sort());
  });

  test.each(QUOTES)('and clause A has a subject in every quoting — a third file spelling %sbehind%s is found', (quote) => {
    // Demonstrated over the genuine corpus with one entry planted, rather than over a contrivance:
    // the predicate is the same expression the assertion above runs. Three cases and not one,
    // because the bypass this replaces was a scan that saw a single quote and nothing else — the
    // double-quoted reader is a real language, not a hypothetical.
    const planted = withPlanted('packages/core/src/engine/routing.ts', `const worst = state === ${quote}behind${quote};\n`);
    expect(namedIn(planted, OWN_STATE_LITERALS)).toContain('packages/core/src/engine/routing.ts');
    expect(namedIn(planted, OWN_STATE_LITERALS)).not.toStrictEqual(Object.keys(STATE_SITES).sort());
  });

  test('clause B — and no third file names the vocabulary, its serialized keys included', () => {
    // `indeterminate` is spelled by three vocabularies (see OWN_STATE_LITERALS), so clause A cannot
    // see a reader that spells only that one. To OBTAIN a state a file has to call the derivation,
    // type its answer, or read the key the report serializes it under — so this clause closes the
    // gap from the other side. The barrel is the one addition: it re-exports and reads nothing.
    expect(namedIn(productionSources(), VOCABULARY)).toStrictEqual(ALLOWED_NAMERS);
  });

  test('and clause B has a subject — a reader of the --json key alone is found', () => {
    // The bypass clause A cannot close by construction: a file that branches on the serialized
    // state names no exported identifier and, if it compares against a variable, no literal either.
    const planted = withPlanted('packages/cli/src/version-badge.ts', 'const stale = entry.version_state !== best;\n');
    expect(namedIn(planted, OWN_STATE_LITERALS), 'clause A sees this one too, so it proves nothing about clause B')
      .toStrictEqual(Object.keys(STATE_SITES).sort());
    expect(namedIn(planted, VOCABULARY)).toContain('packages/cli/src/version-badge.ts');
  });

  test('clause C — and a file that names the vocabulary spells no state but the two sites', () => {
    // The structural half of clause A's exclusion: `indeterminate` is only THIS fact's where the
    // file has this fact in hand, which is exactly the set clause B pins. Between the two, every
    // production file either cannot obtain a state or is one of three known ones — and a second
    // derivation of its own is clause A's, since anything answering more than `indeterminate` has
    // to spell one of the three.
    //
    // So `board.ts` is not exempted, it is unambiguous: its `indeterminate` is containment's for
    // exactly as long as it has no way to hold one of ours. Measured by mutation — the moment that
    // file names `version_state`, this clause reports its literal too.
    expect(namedIn(vocabularyNamers(productionSources()), ALL_STATE_LITERALS))
      .toStrictEqual(Object.keys(STATE_SITES).sort());
  });

  test('and clause C has a subject, with neither neighbour firing on it', () => {
    // Aimed at the barrel, which clause B already allows and clause A cannot see: so what goes red
    // is clause C alone. A guard shown red by its neighbour has not been established (Q-0107).
    const planted = withPlanted(
      'packages/core/src/index.ts',
      "export type { CliVersionResult } from '@quorum/shared';\nconst unread = 'indeterminate';\n",
    );
    expect(namedIn(planted, OWN_STATE_LITERALS), 'clause A fired, so this does not isolate clause C')
      .toStrictEqual(Object.keys(STATE_SITES).sort());
    expect(namedIn(planted, VOCABULARY), 'clause B fired, so this does not isolate clause C')
      .toStrictEqual(ALLOWED_NAMERS);
    expect(namedIn(vocabularyNamers(planted), ALL_STATE_LITERALS)).toContain('packages/core/src/index.ts');
  });
});

describe('AC-4 — one function at the contract layer, and a vendor with no record', () => {
  test('the recorded string is looked up inside core, from the capabilities modules', () => {
    // The caller supplies a vendor label and the string `check()` returned, and never the record: a
    // third argument would force either a second barrel export of vendor data or a transcription of
    // the two numbers into `packages/cli`, which is the copy R-3 is about.
    expect(cliVersion.length).toBe(2);
    expect(cliVersion('claude', CLAUDE_CAPABILITIES.verifiedVersion).verified).toBe(CLAUDE_CAPABILITIES.verifiedVersion);
    expect(cliVersion('codex', CODEX_CAPABILITIES.verifiedVersion).verified).toBe(CODEX_CAPABILITIES.verifiedVersion);
  });

  test('a vendor with no recorded version answers indeterminate and never throws', () => {
    // `mock` is an adapter a flow may select, and a contributor's adapter records nothing until its
    // own capabilities module does. Absence is an answer here, not a gap — and it is the one shape
    // in which the RECORD is unreadable, the two-argument signature putting every other one out of
    // reach: both records are literals in the tree, pinned by `capabilities.source.test.ts`.
    for (const vendor of ['mock', 'gemini', '']) {
      expect(cliVersion(vendor, '1.2.3')).toStrictEqual({ state: 'indeterminate', installed: '1.2.3', verified: null });
    }
  });
});

describe('AC-5 — the extraction rule, against the strings the real CLIs print', () => {
  /**
   * Every input is a literal in this file, so no verdict here is a property of the installed CLI,
   * the login or the account (*"A test's verdict is a property of the commit"*, 2026-08-30). The two
   * rows marked *measured* were read off this machine on 2026-09-08 and are the reason the ticket
   * exists: the record has said 2.1.220 / 0.149.0 since 2026-08-22 and nothing noticed either gap.
   */
  const ROWS: [string, string, string, string][] = [
    ['claude', '2.1.236 (Claude Code)', 'ahead', 'measured 2026-09-08; the version leads the string'],
    ['codex', 'codex-cli 0.150.1', 'ahead', 'measured 2026-09-08; the version trails a name carrying no digit'],
    ['claude', '2.1.220', 'as-verified', 'equality, which is the only thing this state claims'],
    ['codex', '0.149.0', 'as-verified', 'equality for the second vendor too'],
    ['claude', '2.1.219', 'behind', 'one patch below the record'],
    ['claude', '2.1.9', 'behind', 'numeric and not lexical: as strings "2.1.9" sorts ABOVE "2.1.220"'],
    ['claude', '9.9.9', 'ahead', 'a version named nowhere in this repository, compared like any other'],
    ['claude', '3.0.0-beta.1', 'ahead', 'a prerelease reads as its triple; pinned so R-2 is deliberate'],
    ['claude', '', 'indeterminate', 'nothing to read'],
    ['claude', 'claude beta', 'indeterminate', 'a version string with no version in it'],
    ['claude', '2.1', 'indeterminate', 'two components are not a triple, and are never rounded up to one'],
    ['codex', 'codex-cli', 'indeterminate', 'the name without the number'],
  ];

  test.each(ROWS)('%s %s → %s (%s)', (vendor, installed, state) => {
    expect(cliVersion(vendor, installed).state).toBe(state);
  });

  test('the table exercises every state, so no arm of the comparison is unread', () => {
    const covered = new Set(ROWS.map(([, , state]) => state));
    expect([...covered].sort()).toStrictEqual([...CLI_VERSION_STATES].sort());
  });

  test('both strings come back unparsed, because they are what a reader is shown', () => {
    expect(cliVersion('claude', '2.1.236 (Claude Code)')).toStrictEqual({
      state: 'ahead', installed: '2.1.236 (Claude Code)', verified: '2.1.220',
    });
    // An unreadable installed string still carries the record: `indeterminate` says the two could
    // not be compared, never that the record is missing.
    expect(cliVersion('codex', 'codex-cli')).toStrictEqual({
      state: 'indeterminate', installed: 'codex-cli', verified: '0.149.0',
    });
  });

  test('and the lexical comparison this rule replaces would answer differently', () => {
    // The row above is only worth its line if the two rules disagree on it, which is asserted rather
    // than described: a string compare calls 2.1.9 the newer version.
    expect('2.1.9' > '2.1.220', 'the discriminating row no longer discriminates').toBe(true);
    expect(cliVersion('claude', '2.1.9').state).toBe('behind');
  });
});

describe('AC-12 — the contract and the number of spawns are exactly what they were', () => {
  test('check() keeps its signature, so no contributor adapter has to change', () => {
    // The whole ticket sits above this interface: a version is compared with a string `check()`
    // already returns. Widening it would make every third-party adapter this file exists for a
    // compile error, for a fact the contract layer can derive without asking anybody.
    const text = coreSourceFiles().find(([name]) => name === 'adapters/adapters.ts')?.[1] ?? '';
    expect(text).toContain('check(): Promise<string>;');
  });

  test('each adapter spawns the version argv exactly once, and no second probe was added', () => {
    // M-1: the probe already ran, and what was missing was the comparison. A `--version` spawn added
    // here would put latency and a failure mode on every `quorum adapters` invocation for a fact the
    // command already had in hand.
    for (const vendor of ['claude', 'codex']) {
      const text = coreSourceFiles().find(([name]) => name === `adapters/${vendor}.ts`)?.[1] ?? '';
      expect(text, `adapters/${vendor}.ts is not in the corpus`).not.toBe('');
      expect(text.split('versionArgs').length - 1, `adapters/${vendor}.ts reads versionArgs more than once`).toBe(1);
    }
  });
});

describe('AC-6 — nothing branches on a version', () => {
  test('no vendor file names the record, the comparison or a state', () => {
    // The claim where it could actually be broken: argv, JSONL field names and schemas are chosen in
    // the vendor files and in `exec.ts`, and none of them may see a version. A compatibility shim is
    // a decision with its own case (Non-goal 1), never something a probe acquires by drift.
    const folder = coreSourceFiles().filter(([name]) => name.startsWith('adapters/') && name !== 'adapters/adapters.ts');
    expect(folder.length, 'the adapters folder scan found nothing').toBeGreaterThan(4);
    for (const [name, text] of folder) {
      const declaresIt = name.endsWith('-capabilities.ts');
      expect(text.includes('verifiedVersion'), `${name} ${declaresIt ? 'must' : 'must not'} name the record`)
        .toBe(declaresIt);
      // All four here, where clause A can only take three: no other vocabulary in this workspace
      // spells `indeterminate` inside the adapters folder, so the folder itself is the structural
      // distinction that `git.ts` and `board.ts` deny the corpus-wide scan.
      for (const needle of [...VOCABULARY, ...ALL_STATE_LITERALS]) {
        expect(text.includes(needle), `${name} reads a version state (${needle})`).toBe(false);
      }
    }
  });

  test('the derivation selects nothing from what it compares', () => {
    // It reads two strings and answers a state. It never reaches the flags, the values, the envelope
    // or the JSONL names — so there is no expression in the product that a version could steer.
    const text = coreSourceFiles().find(([name]) => name === 'adapters/adapters.ts')?.[1] ?? '';
    expect(text, 'the derivation is not in the corpus').not.toBe('');
    for (const selector of ['CAPABILITIES.flags', 'CAPABILITIES.values', 'CAPABILITIES.envelope', 'CAPABILITIES.jsonl', 'CAPABILITIES.usage']) {
      expect(text.includes(selector), `adapters.ts selects ${selector}`).toBe(false);
    }
    expect(text, 'the two capabilities modules are read for one key each').toContain('CLAUDE_CAPABILITIES.verifiedVersion');
    expect(text, 'the two capabilities modules are read for one key each').toContain('CODEX_CAPABILITIES.verifiedVersion');
  });

  test('and the state reaches no exit code, no failure and no run', () => {
    // The rendering site's other half of the same rule: `packages/cli/src/adapters.ts` may print a
    // state and may not act on one. Its exit rule is the login's and stays exactly what Q-0110 left.
    const cli = repoFile('packages/cli/src/adapters.ts');
    expect(cli, 'the exit rule stopped being the login\'s alone')
      .toContain("report.some((entry) => entry.login !== 'verified')");
    for (const state of CLI_VERSION_STATES) {
      expect(new RegExp(`(die|failSoftly)\\([^)]*${state}`).test(cli), `a ${state} state reaches an exit`).toBe(false);
    }
  });
});
