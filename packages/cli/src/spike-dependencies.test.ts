/**
 * Q-0107 AC-29 and AC-30 — what the workspace still reads out of `spike/`, and what it decided
 * about every read it used to make.
 *
 * Two registers, in one file because they answer halves of one question. **AC-30** is the standing
 * guard: after this ticket no file under `packages/**` READS anything under `spike/`, asserted over
 * the tree rather than reviewed, so Q-0103 is a deletion rather than an investigation. **AC-29** is
 * what makes that guard's exclusion list honest and what makes AC-10's dispositions falsifiable:
 * the membership of both is derived from a scan, so a site nobody thought of is a red test rather
 * than a silence.
 *
 * **Its subject is read positions, not text occurrences**, and that distinction is the criterion
 * rather than an implementation choice. Fifty-four production source files cite a path under that
 * tree in JSDoc as the evidence for a ported behaviour; those citations stay true after the
 * deletion — the behaviour did come from it — and AC-19 permits this ticket to touch three files,
 * so a text-level guard could not pass here at all. A JSDoc citation of a deleted file is stale
 * prose and is **Q-0108's** mechanical sweep; a *read* of a deleted file is what breaks, and
 * bounding that is what makes the cutover mechanical.
 *
 * **The registers are executable and live here rather than in an implement report.** A report is
 * round-scoped (Q-0086), read by nobody after the gate, and cannot make a missing verdict red —
 * and *"a register that silently loses a row has destroyed the only evidence that anyone chose"*
 * (*"A check outlives its subject only if it can still fail"*, 2026-09-05, class (c)). The
 * red-before-green transcripts AC-11 requires stay in the report, which is the right home for a
 * transcript.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's own root, reached package-relatively, and the workspace above it. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

/** This file, excluded from its own scan for the reason stated where the exclusion is asserted. */
const SELF = 'packages/cli/src/spike-dependencies.test.ts';

/**
 * The tree that is going away, spelled so this file does not trip its own guard.
 *
 * Assembled rather than written, the device `end-to-end.test.ts:517` and `index.test.ts:11` both
 * use: a guard whose own source is its subject is one refactor away from being deleted rather than
 * fixed.
 */
const TREE = `${'spi'}ke`;

// ---------------------------------------------------------------------------------------------
// AC-30 — the scan
// ---------------------------------------------------------------------------------------------

/** One place a file reaches for the tree, and which of the three shapes said so. */
interface Site {
  /** The file, relative to the workspace root. */
  readonly file: string;
  /** What was found — an import specifier, a whole-path literal, or a bare quoted segment. */
  readonly shape: 'specifier' | 'path' | 'segment';
  /** The literal itself, which is what the register is keyed by: a line number churns, this does not. */
  readonly literal: string;
}

/** How a site is named in the register, and in a failure message. */
const key = (site: Site): string => `${site.file}: ${site.shape} ${site.literal}`;

/**
 * Whether a line is wholly a comment, and therefore prose rather than code.
 *
 * Deliberately crude and deliberately generous, in the direction that costs nothing: a citation
 * sitting at the end of a line of code is still scanned, and a line that is only a comment is not.
 * The alternative — a real parse — buys precision this guard has no use for, because the shapes
 * below are all quoted literals and a quoted literal inside a `//` comment is prose by definition.
 */
const wholly = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#');
};

/**
 * Every read position in `text` that names the tree, in three shapes.
 *
 * 1. an **import or export specifier** naming a path under it — the shape a module dependency takes;
 * 2. a **whole-path literal**, a quoted string whose entire body is a path reaching the tree —
 *    the shape `fs.readFileSync`, `repoFile` and a `turbo.json` input take. A leading run of `./`
 *    or `../` counts, because a declared input and a relative read both carry one, and a scan
 *    anchored on the bare name would have walked straight past `../../spike/test/**`. Whole-path
 *    rather than substring, because a `why:` sentence in a register that happens to contain a path
 *    is documentation and not a read, and a guard that could not tell them apart would have to
 *    exclude every register in the workspace;
 * 3. a **bare quoted segment** — `'spike'` handed to `path.join`, which shape 2 cannot see because
 *    the separator is supplied by the call rather than by the literal.
 */
function sitesIn(file: string, text: string): Site[] {
  const found: Site[] = [];
  const specifier = new RegExp(`\\b(?:from|import|require)\\s*\\(?\\s*['"\`]([^'"\`\\n]*\\b${TREE}/[^'"\`\\n]*)['"\`]`, 'g');
  const wholePath = new RegExp(`['"\`]((?:\\.{1,2}/)*${TREE}(?:/[^'"\`\\n\\s]*)?)['"\`]`, 'g');
  const segment = new RegExp(`['"\`](${TREE})['"\`]`, 'g');
  for (const line of text.split('\n')) {
    if (wholly(line)) continue;
    for (const [, literal] of line.matchAll(specifier)) found.push({ file, shape: 'specifier', literal });
    for (const [, literal] of line.matchAll(wholePath)) {
      if (literal === TREE) found.push({ file, shape: 'segment', literal });
      else found.push({ file, shape: 'path', literal });
    }
  }
  // `segment` is declared above and used through `wholePath`'s own bare-name branch, so the two
  // shapes cannot drift apart; it is exercised directly by the discrimination test below.
  void segment;
  return found;
}

/**
 * Every tracked file under `packages/` this guard scans, as `[path, text]`.
 *
 * Membership is a **git question, not a filesystem one** (2026-08-28): the inventory is
 * `git ls-files`, so an untracked scratch file is not a dependency and a checkout that has built or
 * run something does not change the verdict. That is the same instrument
 * `packages/core/src/turbo-inputs.test.ts` uses, and for the same reason.
 */
function corpus(): [string, string][] {
  const listing = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'packages'], {
    cwd: WORKSPACE, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const files = listing.split('\n').filter((entry) => /\.(?:ts|tsx|js|mjs|cjs|json)$/.test(entry)).sort();
  if (files.length < 100) {
    throw new Error(`the packages inventory is ${String(files.length)} files — this guard proves nothing over that`);
  }
  return files.map((file) => [file, fs.readFileSync(path.join(WORKSPACE, file), 'utf8')]);
}

/**
 * The sites that remain, and why each is not a dependency this ticket was able to remove.
 *
 * Keyed by {@link key}, so the count is derived rather than fixed and a NEW literal in an already
 * excluded file still fails. Every entry names what removes it, because an exclusion whose end
 * nobody can state is an exemption.
 */
const EXCLUSIONS: Record<string, string> = {
  // The one suite whose subject IS the relationship between the two trees. It reads every file in
  // `spike/test/`, and Q-0103 AC-21 deletes it together with them, which is why AC-17 kept the
  // declared input that feeds it rather than removing all seven.
  'packages/core/src/spike-parity.test.ts: path spike/test': 'the directory this register is keyed by; Q-0103 deletes the file and the directory together',
  'packages/core/src/spike-parity.test.ts: path spike/test/run.js': 'the discovering runner, read so that excluding it by name is grounded rather than assumed',
  // The declared input that feeds it, and the two register rows in the input guard that justify it.
  // AC-17 keeps exactly one of the seven spike inputs for exactly this reader.
  'packages/core/turbo.json: path ../../spike/test/**': 'the input the reader above needs, kept by AC-17 with a comment naming that reader as its only one',
  'packages/core/src/turbo-inputs.test.ts: path spike/test': 'the walk row and the route reason that justify the input above',
  'packages/core/src/turbo-inputs.test.ts: path spike/src/fanout.js': 'a NOT_READ key: fanout.test.ts uses the path as task-fixture data and opens nothing at it',
  'packages/core/src/fanout/fanout.test.ts: path spike/src/fanout.js': 'the fixture data itself — a plausible-looking value in a tasks.yaml, never opened',
  'packages/core/src/fanout/fanout.test.ts: path spike/test/q0011.js': 'the same, in a second task fixture: a file path a task claims to own, asserted about and never opened',
  // CI still declares a `spike` job until Q-0103, and `test-command.test.ts` is the register that
  // says so. AC-16 kept both deliberately: removing the row is how the cutover becomes a decision
  // rather than a silence (079(c)).
  'packages/core/src/test-command.test.ts: segment spike': 'the CI job name, read out of the workflow that still declares the job, plus the WITHOUT_SPIKE fixture that exhibits the assertion this register replaced',
};

// ---------------------------------------------------------------------------------------------
// AC-10 — the dispositions
// ---------------------------------------------------------------------------------------------

/**
 * The five verdicts *"A check outlives its subject only if it can still fail"* (2026-09-05) allows.
 *
 * Five rather than four: 079 has three classes and the inherited criterion offered `retired`,
 * `re-aimed`, `transcribed` and `moved`, none of which can record class (b) — still falsifiable,
 * kept as a resurrection tripwire. `kept` is that verdict.
 */
type Verdict = 'retired' | 're-aimed' | 'kept' | 'transcribed' | 'moved';

/** One dependency, what was decided about it, and what makes the decision checkable. */
interface Disposition {
  /** The site as it stood before this ticket, so a reader can find it in the diff. */
  readonly site: string;
  readonly verdict: Verdict;
  /** One sentence: the property, and where it lives now. */
  readonly sentence: string;
  /**
   * The file the sentence commits to, and a marker it must contain.
   *
   * This is what stops a `retired` verdict being a claim nobody checked: R-1's failure mode is a
   * sibling that does not assert the same property, and a sibling that does not exist at all is
   * the cheap end of it. The marker is a distinctive fragment of the assertion or the subject.
   */
  readonly evidence: { readonly file: string; readonly contains: string };
}

const DISPOSITIONS: readonly Disposition[] = [
  {
    site: 'packages/shared/src/stages.test.ts — the exported tuple deep-equals the spike declaration',
    verdict: 'retired',
    sentence: 'The ten stage names in order are asserted against what the state machine documents, in the test immediately below the retired one, which was already green beside it.',
    evidence: { file: 'packages/shared/src/stages.test.ts', contains: 'the ten members are the ones the state machine documents' },
  },
  {
    site: 'packages/shared/src/constants.test.ts — six tests\' spike halves, thirteen spikeSource calls',
    verdict: 'retired',
    sentence: 'Each constant\'s value assertion sat in the same test() block as the spike bytes it was compared against and is what every consumer reads; the folders are separately forbidden to spell any of these names themselves.',
    evidence: { file: 'packages/core/src/backlog/backlog.source.test.ts', contains: 'the branch shape belongs to shared' },
  },
  {
    site: 'packages/shared/src/constants.test.ts — the spike\'s default verdict path',
    verdict: 'retired',
    sentence: 'The ported twin asserts the same three properties over steps.ts and was written for exactly this moment.',
    evidence: { file: 'packages/core/src/engine/q0050.source.test.ts', contains: 'Q-0089: the default verdict path is scoped by run and by iteration' },
  },
  {
    site: 'packages/shared/src/constants.test.ts — the five base_branch fallback sites in spike/src/engine.js',
    verdict: 're-aimed',
    sentence: 'How many literals the spike had is evidence about a deleted tree; what survives is that this folder has none but two the port left, pinned in both directions so closing them is a deliberate act.',
    evidence: { file: 'packages/core/src/engine/q0050.source.test.ts', contains: 'the base-branch default is reached through shared' },
  },
  {
    site: 'packages/shared/src/events.test.ts — the emitting lines in four spike adapters',
    verdict: 're-aimed',
    sentence: 'The event union is derived from what the product emits, and the product is packages/core now, so the samples are checked against its three adapters and its contract layer.',
    evidence: { file: 'packages/shared/src/events.test.ts', contains: 'those three shapes are still what the product emits' },
  },
  {
    site: 'packages/shared/src/events.test.ts — spike/src/engine.js\'s onEvent: (e) => ui.trace(step.id, e)',
    verdict: 'retired',
    sentence: 'That an adapter event acquires its step id on the way out is asserted by EXECUTING a run and reading the stepId off a stdout event, including the parallel case a text match could never see.',
    evidence: { file: 'packages/core/src/engine/engine.test.ts', contains: 'stamped[0]?.stepId' },
  },
  {
    site: 'packages/shared/src/events.test.ts — the six ui methods in spike/bin/harness.js',
    verdict: 'retired',
    sentence: 'The spike\'s ui object was not ported and has no counterpart; that every member of the union is rendered is proved by an exhaustiveness check that fails to compile when a member is added, which is strictly stronger than six method names.',
    evidence: { file: 'packages/cli/src/trace.test.ts', contains: 'the switch is exhaustive over the shipped union' },
  },
  {
    site: 'packages/shared/src/project.test.ts — spike/templates/harness/harness.yaml, four sites',
    verdict: 're-aimed',
    sentence: 'The shipped template config is the one an adopter\'s first quorum init copies, and the two files are byte-identical today, so the swap is the same bytes at the address that survives.',
    evidence: { file: 'packages/shared/src/project.test.ts', contains: 'packages/cli/templates/harness/harness.yaml' },
  },
  {
    site: 'packages/shared/src/project.test.ts — withRetry\'s defaults oracled against both trees',
    verdict: 're-aimed',
    sentence: 'The cross-tree agreement was the port\'s drift check; what the criterion is about — the commented example is what the code would have defaulted to anyway — is a property of the code that runs.',
    evidence: { file: 'packages/shared/src/project.test.ts', contains: 'the code destructures three defaults' },
  },
  {
    site: 'packages/shared/test/corpus.ts — frontmatterRegexMatchesSpike, and ticket.test.ts:10',
    verdict: 're-aimed',
    sentence: 'The copied regular expression is now required to match the function Q-0043 ported rather than the one it was ported from.',
    evidence: { file: 'packages/shared/test/corpus.ts', contains: 'frontmatterRegexMatchesProduct' },
  },
  {
    site: 'packages/shared/src/flow.test.ts — seven tests running spike/src/lint.js, and corpus.ts\'s spikeLintFlow and lintAccepts',
    verdict: 'moved',
    sentence: 'The property needs the real linter executed, and packages/shared may not import packages/core, so the tests went to the package where both lintFlow and flowSchema are importable — unchanged except for which lintFlow they run.',
    evidence: { file: 'packages/core/src/lint/lint.test.ts', contains: 'lint succeeding implies no absent key is required' },
  },
  {
    site: 'packages/shared/src/role.test.ts — nothing in the spike reads a role\'s paths',
    verdict: 're-aimed',
    sentence: 'No sibling existed, so it was written: the claim is about the engine that runs, asserted over the whole of packages/core/src rather than over the four modules the spike happened to have.',
    evidence: { file: 'packages/core/src/engine/q0052.source.test.ts', contains: '`paths` is advisory, and nothing here reads it' },
  },
  {
    site: 'packages/shared/src/docs.test.ts — TERMINAL_STATUSES read out of spike/src/contracts.js',
    verdict: 're-aimed',
    sentence: 'The documented status vocabulary is compared against the product\'s own declaration, read as text because it is module-private in a package this one may not import.',
    evidence: { file: 'packages/shared/src/docs.test.ts', contains: 'packages/core/src/contracts/run-manifest.ts' },
  },
  {
    site: 'packages/shared/src/step-output.ts:12,14,16,19 and step-output.test.ts:61-63 — the FOUR-VALIDATIONS block',
    verdict: 're-aimed',
    sentence: 'All four citations move together to the packages/** locations of the same four validators, and each is required to exist and to be the declaration it names rather than merely to be spelled.',
    evidence: { file: 'packages/shared/src/step-output.ts', contains: 'packages/core/src/adapters/adapters.ts:548' },
  },
  {
    site: 'packages/core/src/{adapters,contracts,fanout,lint,run-history}/*.source.test.ts — five line scans for the substring',
    verdict: 'retired',
    sentence: 'Each folder\'s positive import allow-list sits in the same test body and is stronger once it can see the same shapes, naming what is permitted rather than one thing that is not; importsOf gained the CommonJS and side-effect forms in the same change, which are the two things the retired scan saw and the allow-list did not.',
    evidence: { file: 'packages/core/src/lint/lint.source.test.ts', contains: 'a side-effect import' },
  },
  {
    site: 'packages/core/src/backlog/backlog.source.test.ts:60 — parsed specifiers over all of coreSourceFiles()',
    verdict: 'retired',
    sentence: 'The sibling is this file\'s own guard, which reaches every tracked file under packages/** rather than one package, in three shapes rather than one, over an exclusion register that must carry a reason.',
    evidence: { file: SELF, contains: 'no file under `packages/**` READS anything under' },
  },
  {
    site: 'packages/core/src/contracts/contracts.source.test.ts:185 — the resolved ajv path must not contain the word',
    verdict: 'retired',
    sentence: 'Its reason is not the cutover: once that npm tree cannot exist the clause can only fail if the checkout sits under a directory whose own name contains the word, which is a verdict that is a property of the machine — so leaving it alone would have made it violate a different rule.',
    evidence: { file: 'packages/core/src/contracts/contracts.source.test.ts', contains: 'a property of the machine rather than of the commit' },
  },
  {
    site: 'packages/core/src/engine/q0050.source.test.ts:109 — the engine folder imports no spike specifier',
    verdict: 'retired',
    sentence: 'After the cutover such an import fails tsc --noEmit before it reaches any assertion, so the clause could only report what the compiler had already refused; the sibling is this file\'s guard, which also covers two shapes that regex never saw.',
    evidence: { file: SELF, contains: 'a bare quoted segment' },
  },
  {
    site: 'packages/core/src/lint/lint.test.ts:871 — SHIPPED\'s second directory',
    verdict: 're-aimed',
    sentence: 'The three-link parity chain becomes one direct link: the shipped flows are compared against the copy quorum init ships rather than against the spike\'s copy of it.',
    evidence: { file: 'packages/core/src/lint/lint.test.ts', contains: 'packages/cli/templates/harness/flows' },
  },
  {
    site: 'packages/cli/src/templates.test.ts:50 — SPIKE_TEMPLATES and the whole-tree comparison',
    verdict: 're-aimed',
    sentence: 'The comparison is of the byte-shared SET rather than of two trees, because only the flows and code-reviewer.md have a counterpart here — the rest of an adopter\'s template tree describes their project and must not acquire this repository\'s paths.',
    evidence: { file: 'packages/cli/src/templates.test.ts', contains: 'BYTE_SHARED' },
  },
  {
    site: 'packages/cli/src/templates.test.ts — link 2 of the chain holds today',
    verdict: 'retired',
    sentence: 'There is no middle link now, so the byte comparison at the head of that describe IS the pair this test read; keeping it would have been a second description of the assertion above it.',
    evidence: { file: 'packages/cli/src/templates.test.ts', contains: 'the byte-shared set is byte-identical' },
  },
  {
    site: 'packages/cli/src/package.test.ts:161 and :187 — the OUTSIDE row and the declared-input copy',
    verdict: 're-aimed',
    sentence: 'The read that is hashed by nothing else is the other half of the byte comparison, and it moved with it.',
    evidence: { file: 'packages/cli/src/package.test.ts', contains: 'harness/roles/code-reviewer.md' },
  },
  {
    site: 'packages/core/src/git-identity.test.ts:28 — the spike/test corpus row',
    verdict: 'retired',
    sentence: 'The rule is about a test\'s verdict and after Q-0103 there are no tests in that tree to have one, so the row would name a directory nobody could scan.',
    evidence: { file: 'packages/core/src/git-identity.test.ts', contains: 'there are no tests in that tree to have one' },
  },
  {
    site: 'packages/core/src/git-identity.test.ts:217 — spike/test must be in the corpus',
    verdict: 're-aimed',
    sentence: 'A tripwire must not lose its subject in the change that shrinks it, so the clause names every top-level directory the corpus does reach, derived from the listing rather than from the register above it.',
    evidence: { file: 'packages/core/src/git-identity.test.ts', contains: 'every top-level directory the corpus reaches, named' },
  },
  {
    site: 'packages/core/src/git-identity.test.ts:249 — the exempt fixture naming a spike test file',
    verdict: 're-aimed',
    sentence: 'exempt is a pure predicate and would have gone on refusing that path forever, asserting about a file nobody could point at; a second real corpus file makes the same claim about a path that exists.',
    evidence: { file: 'packages/core/src/git-identity.test.ts', contains: 'nor in another package' },
  },
  {
    site: 'packages/core/src/git-identity.test.ts:33 — CORPUS_FLOOR\'s stated derivation',
    verdict: 're-aimed',
    sentence: 'The number does not move and its composition does, which is a comment promising what the number beneath it no longer means — the class this whole ticket is about.',
    evidence: { file: 'packages/core/src/git-identity.test.ts', contains: 're-derived 2026-09-05 by\n * Q-0107 AC-15' },
  },
  {
    site: 'packages/core/src/test-command.test.ts:52-57, :87, :93 — spikeSources() and its two consumers',
    verdict: 'retired',
    sentence: 'Since Q-0106 the spike is not the engine that runs integrate, so the property — no engine names a test runner in code — is asserted over coreSourceFiles() alone, which is the engine that does.',
    evidence: { file: 'packages/core/src/test-command.test.ts', contains: 'parses no runner' },
  },
  {
    site: 'packages/core/src/test-command.test.ts:467 — the five-phase literal, matched to the sweep script',
    verdict: 're-aimed',
    sentence: 'A hand-written list iterated with toContain fails when a phase is removed and says nothing when one is added, so the list is derived from the script and compared against a register that records AC-16 dropping the spike phase.',
    evidence: { file: 'packages/core/src/test-command.test.ts', contains: 'every phase the script names is a registered one' },
  },
  {
    site: '.github/scripts/git-identity-sweep.sh:117 and :119-121 — the spike install and suite phases',
    verdict: 'retired',
    sentence: 'What the sweep is for is the workspace\'s verdict under a hostile git configuration, and no workspace test reads that tree; CI\'s own spike job still runs the suite until Q-0103.',
    evidence: { file: '.github/scripts/git-identity-sweep.sh', contains: 'the workspace suite executed and green' },
  },
  {
    site: 'packages/{shared,core,cli}/turbo.json — six of the seven declared spike inputs',
    verdict: 'retired',
    sentence: 'Each lost its last reader in this change, and a declared input naming a path nothing opens is a hash contribution nobody can explain.',
    evidence: { file: 'packages/shared/turbo.json', contains: 'are gone with the last\n        // reader in this package' },
  },
  {
    site: 'packages/core/turbo.json:46 — ../../spike/test/**',
    verdict: 'kept',
    sentence: 'The seventh input stays because spike-parity.test.ts still reads that directory, and removing it here would create the undeclared read Q-0072\'s guard exists to refuse; its comment names that sole reader and names Q-0103 as what removes both.',
    evidence: { file: 'packages/core/turbo.json', contains: 'SOLE remaining reader in this package' },
  },
  {
    site: 'packages/core/src/test-command.test.ts:511 and the WITHOUT_SPIKE fixture — CI_JOBS\' spike row',
    verdict: 'kept',
    sentence: 'The workflow still declares the job until Q-0103, and that file states in its own prose that removing the row is how the cutover becomes a decision instead of a silence — which is 079(c) working as designed.',
    evidence: { file: 'packages/core/src/test-command.test.ts', contains: 'updating one line here is how that becomes a decision' },
  },
  {
    site: 'spike/test/q0080-allocation.json — the allocation table both trees read',
    verdict: 'moved',
    sentence: 'It sits beside the suite that owns it now, and the spike\'s reader reaches across the boundary until Q-0103 — the direction that survives the cutover.',
    evidence: { file: 'packages/core/src/backlog/q0080-allocation.json', contains: 'Q-0107 AC-8 moved it here from the spike' },
  },
  {
    site: 'packages/cli/src/ticket.ts:8 and packages/shared/src/role.ts:30 — two production citations of a moved or replaced subject',
    verdict: 're-aimed',
    sentence: 'Both name something this ticket moved, so they are two of the three production files AC-19 admits; the other fifty-one citations name behaviour that did come from the spike and are Q-0108\'s.',
    evidence: { file: 'packages/cli/src/ticket.ts', contains: 'packages/core/src/backlog/q0080-allocation.json' },
  },
  {
    site: 'harness/architecture.md:51 and :78 — the role-table checker and the template-sharing chain',
    verdict: 're-aimed',
    sentence: 'Both sentences named machinery this ticket replaced, in a document every chore implement step is fed at run time, so a false claim there is one every future run inherits.',
    evidence: { file: 'harness/architecture.md', contains: '`packages/shared/src/role.test.ts` parses each cell' },
  },
];

// ---------------------------------------------------------------------------------------------

describe('Q-0107 AC-30 — no file under packages/** reads anything under the spike tree', () => {
  test('the scan has a corpus, and it is the tracked one', () => {
    // First, for the reason every positive control in this repository is first: a scan that had
    // lost its subject would report no sites and every clause below would be green over nothing.
    const files = corpus();
    expect(files.length, 'the packages inventory').toBeGreaterThan(150);
    expect(files.map(([file]) => file), 'this file is scanned like any other').toContain(SELF);
  });

  test('every site the scan reaches is a registered exclusion carrying its reason', () => {
    const unregistered = corpus()
      .flatMap(([file, text]) => sitesIn(file, text))
      .map(key)
      .filter((entry) => !(entry in EXCLUSIONS));
    expect([...new Set(unregistered)], 'an unregistered read of the tree that is going away').toStrictEqual([]);
  });

  test('and the register holds no entry for a site that has gone', () => {
    // The other direction, which is what stops the register drifting into an exemption list nobody
    // can retire: Q-0073's finding that `node_modules/.bin/turbo` became uncollectable on day one
    // and went on reading as coverage.
    const live = new Set(corpus().flatMap(([file, text]) => sitesIn(file, text)).map(key));
    expect(Object.keys(EXCLUSIONS).filter((entry) => !live.has(entry))).toStrictEqual([]);
  });

  test('this file is scanned like any other, and needs no exclusion of its own', () => {
    // The scan above includes this file — it is a tracked `.ts` under `packages/` — and it reports
    // nothing here. That is the reason `TREE` is assembled and the register's keys carry a `file:
    // shape ` prefix: neither is a whole-path literal, so the guard has no exemption for itself and
    // a real read added below would fail it like any other. Q-0079's `SELF` marker is the
    // alternative, and it needs a second guard to keep it honest; not needing one is better.
    const here = sitesIn(SELF, fs.readFileSync(path.join(WORKSPACE, SELF), 'utf8'));
    expect(here.map(key), 'this guard must not be its own subject').toStrictEqual([]);
    expect(Object.keys(EXCLUSIONS).filter((entry) => entry.startsWith(SELF)), 'nor excuse itself').toStrictEqual([]);
    // And the absence is a property of the text rather than of a filter: the same file with one
    // real read appended does report it.
    const withARead = `${fs.readFileSync(path.join(WORKSPACE, SELF), 'utf8')}\nconst leak = read('${TREE}/src/lint.js');\n`;
    expect(sitesIn(SELF, withARead).map((site) => site.literal)).toStrictEqual([`${TREE}/src/lint.js`]);
  });

  test('each of the three shapes discriminates, over text this file assembles', () => {
    // Assembled so this guard's own source does not carry what it detects — the device
    // `end-to-end.test.ts:517-531` uses, generalised. Each shape is shown to fire AND to be the
    // shape it claims: Q-0071's point that showing a guard has a subject proves it fires, not that
    // each of its clauses does.
    const at = (source: string): Site[] => sitesIn('fixture.ts', source);
    const specifier = at(`import { lintFlow } from '../../${TREE}/src/lint.js';`);
    expect(specifier.map((site) => site.shape), 'an import specifier').toStrictEqual(['specifier', 'path']);
    const read = at(`const engine = repoFile('${TREE}/src/engine.js');`);
    expect(read.map((site) => site.shape), 'a whole-path literal').toStrictEqual(['path']);
    const joined = at(`const dir = path.join(root, '${TREE}', 'test');`);
    expect(joined.map((site) => site.shape), 'a bare quoted segment').toStrictEqual(['segment']);
  });

  test('and prose is not a read, which is what makes the exclusion list finite', () => {
    // The narrowing §3.2(h) forced. Fifty-four production files cite a path under that tree in
    // JSDoc; a text-level guard would have to excuse every one of them, and AC-19 forbids editing
    // fifty-one. A sentence that merely contains a path is not a read either, or every `why:` row
    // in `turbo-inputs.test.ts` would need excusing.
    expect(at(`// Why: behaviour preserved from ${TREE}/src/engine.js:679.`), 'a line comment').toStrictEqual([]);
    expect(at(` * Ported from ${TREE}/src/backlog.js:12, which is the copy this matches.`), 'a JSDoc line').toStrictEqual([]);
    expect(at(`  why: 'read by ${TREE}/src/lint.js, which imports it',`), 'a sentence containing a path').toStrictEqual([]);
    // And the same three shapes still fire on the same line when they are code rather than prose.
    expect(at(`const text = read('${TREE}/src/lint.js'); // as ${TREE}/src/lint.js does`).map((s) => s.shape))
      .toStrictEqual(['path']);
  });

  function at(source: string): Site[] {
    return sitesIn('fixture.ts', source);
  }
});

describe('Q-0107 AC-10/AC-29 — every dependency is dispositioned, and each verdict names its evidence', () => {
  test('every verdict is one of the five, and every site is distinct', () => {
    const allowed: Verdict[] = ['retired', 're-aimed', 'kept', 'transcribed', 'moved'];
    for (const row of DISPOSITIONS) {
      expect(allowed, `${row.site}: ${row.verdict} is not a permitted verdict`).toContain(row.verdict);
    }
    expect(new Set(DISPOSITIONS.map((row) => row.site)).size, 'a site is dispositioned once')
      .toBe(DISPOSITIONS.length);
  });

  test('every disposition\'s evidence exists and says what the sentence commits it to', () => {
    // What stops a `retired` verdict being a claim nobody checked. R-1's failure mode is a sibling
    // that does not assert the same property; a sibling that is not there at all is the cheap end
    // of it, and this closes that end for every row at once.
    const missing = DISPOSITIONS.filter((row) => {
      const file = path.join(WORKSPACE, row.evidence.file);
      if (!fs.existsSync(file)) return true;
      return !fs.readFileSync(file, 'utf8').includes(row.evidence.contains);
    }).map((row) => `${row.site} → ${row.evidence.file}`);
    expect(missing, 'a verdict whose named evidence is not there').toStrictEqual([]);
  });

  test('the evidence check has teeth, over a row this file builds', () => {
    const bogus = {
      site: 'a site', verdict: 'retired' as Verdict, sentence: 'a sentence',
      evidence: { file: 'packages/core/src/no-such-file.ts', contains: 'anything' },
    };
    expect(fs.existsSync(path.join(WORKSPACE, bogus.evidence.file)), 'the fixture names nothing real').toBe(false);
    const present = { ...bogus, evidence: { file: SELF, contains: `not in this file ${String(Math.PI)}` } };
    expect(fs.readFileSync(path.join(WORKSPACE, present.evidence.file), 'utf8').includes(present.evidence.contains))
      .toBe(false);
  });

  test('every sentence says something, and no verdict is left to the reader', () => {
    for (const row of DISPOSITIONS) {
      expect(row.sentence.length, `${row.site}: the sentence is a placeholder`).toBeGreaterThan(60);
      expect(row.sentence.trimEnd().endsWith('.'), `${row.site}: the sentence is not a sentence`).toBe(true);
    }
  });

  test('the class counts are what this ticket did, stated rather than left to be counted', () => {
    // A register that reports only "everything is classified" cannot tell a reader whether the
    // change deleted coverage or moved it, which is R-1's question. The shape of the answer is the
    // point: most retirements had a sibling already green in the same test body, two things moved
    // rather than being rewritten, and exactly two sites are kept as tripwires for Q-0103 — the
    // declared input that feeds `spike-parity.test.ts`, and `CI_JOBS`' row for the job the workflow
    // still declares.
    const count = (verdict: Verdict): number => DISPOSITIONS.filter((row) => row.verdict === verdict).length;
    expect({
      retired: count('retired'),
      're-aimed': count('re-aimed'),
      kept: count('kept'),
      transcribed: count('transcribed'),
      moved: count('moved'),
    }).toStrictEqual({ retired: 14, 're-aimed': 17, kept: 2, transcribed: 0, moved: 2 });
    // Nothing was transcribed, and that is a finding rather than an omission: 079 permits it only
    // where the value is this workspace's own contract, and every literal in question was evidence
    // ABOUT the deleted tree — which is the case it forbids.
    expect(count('transcribed'), 'no literal was frozen out of the tree that is going').toBe(0);
  });
});
