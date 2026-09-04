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
 *   has four parts, each failing closed against a register a reviewer approves rather than
 *   recognising a list of bad shapes:
 *   **C1**, every call of a route hands over a quoted literal or is entered in
 *   {@link INDIRECT_ROUTES} — and a route is identified through the calling file's own import
 *   bindings, so `import { repoFile as read }` is watched under `read`;
 *   **C2**, no repository root is derived outside the two route modules, per
 *   {@link ROOT_DERIVATIONS};
 *   **C3**, no string literal names a location outside its own package, per
 *   {@link ESCAPING_LITERALS};
 *   **C4**, every filesystem read is rooted at a base somebody has accounted for, per
 *   {@link READ_APIS} and {@link READ_BASES} — and a reader, like a route, is identified through
 *   the calling file's own import bindings, so `import { readFileSync as slurp }` is watched under
 *   `slurp`.
 *
 * **Why the four parts are exhaustive** — stated so the argument can be attacked rather than the
 * code. To read a file, something must name it, and a name is either a literal or an expression.
 * A repository-relative literal is collected by clause B and must be declared. An absolute or
 * `..`-escaping literal is refused by C3, which is what lets clause B go on ignoring both forms.
 * An expression must be rooted somewhere: at a route, which C1 watches under whatever local name
 * it was imported as; at a root the file derived for itself, which C2 refuses; or at a base
 * obtained some other way — which is where C1 to C3 stopped, and where iteration 3's review walked
 * through. `path.dirname(path.dirname(fs.realpathSync('.')))` names no route, appears in no
 * derivation list, and holds no escaping literal.
 *
 * **And the read itself must be named**, which is the half iteration 4 walked through: the same
 * expression handed to `slurp` rather than to `readFileSync` named no API either, because C4 was
 * written two iterations *after* the lesson that taught C1 to resolve bindings and still matched
 * raw names. Both clauses now ask {@link readClause} the same question about an import, so the
 * lesson cannot be learnt in one and missed in the other. Where they differ is deliberate and is
 * recorded there: C1 refuses a namespace or default binding, C4 accepts both, because a route
 * reached through a member access is invisible to it while a read reached that way is still called
 * under an API name.
 *
 * **C4 anchors on the read rather than on the derivation, and that is the whole of the remedy**
 * (`requirements/errata.md` E-1). Extending C2's list was refused as the fix, because extending it
 * is the move that produced iterations 2 and 3: the ways to *compute a string* are not enumerable.
 * The ways to *read a file* are — {@link READ_APIS} is that list, and is itself part of the
 * register — and a read is the last point every bypass must pass through, so anchoring there turns
 * an open-ended hunt for bad primitives into a closed question over a stable API surface.
 * {@link READ_BASES} is keyed by the **base** a path is rooted at rather than by the read, because
 * the base is the entire question: `dir` reaches whatever `dir` is, and every read joined onto it
 * inherits that answer.
 *
 * **Membership is a git question, not a filesystem one** (Q-0073). Which quoted literals are
 * repository paths at all, and which of those are directories, are both decided from
 * {@link INVENTORY} — what `git ls-files --cached --others --exclude-standard` reports, which is
 * the set turbo can hash. Deciding it from `fs.existsSync` made the verdict a function of what the
 * checkout happened to contain: `.harness/worktrees` and `.quorum/runs` are directories the product
 * creates and `.gitignore` excludes, so the guard was red on a machine that had run a flow and
 * green in a fresh worktree — which is why implement and integrate both reported green over a
 * `main` that was red for every developer. **CI is named here as a checkout shape and not as an
 * observation:** no CI run executed the revision that carried the defect, and a fresh clone, which
 * holds neither directory, is the measured proxy for what CI would have seen. Existence used to
 * **classify** is that defect. Existence used to **refuse to run over a missing subject** is the
 * rule, and the four refusals that do it are named in the audit on {@link INVENTORY}, which is also
 * where every remaining working-tree read is accounted for.
 *
 * No clause is a TypeScript parser. Clause B collects quoted string literals that name a path the
 * inventory holds, outside the package naming them, which over-collects rather than under-collects:
 * a path named in an assertion but never opened is refused until it is entered in {@link NOT_READ}
 * with a reason, and entering one is a visible act a reviewer can weigh. C1 does not interpret an
 * expression at all — it decides only whether the path is a quoted literal, and refuses everything
 * else until a human writes down why. C4 unwraps `path.join` and its siblings to find the base and
 * then stops, refusing every base that is not a literal clause B collects or a route C1 governs;
 * the names it matches at come from the file's own imports, and every import form and every
 * value-use it cannot follow is reported rather than skipped. Failing closed is what lets all of
 * this be this small.
 *
 * **Residual limits, stated rather than left to be discovered** — E-1 item 3, which is the whole
 * distinction this ticket is about: a gap that is registered and stated is acceptable, and the same
 * gap unmentioned is the defect.
 *
 * 1. **A subprocess that reads a file on a suite's behalf is not covered.** `execFileSync('cat',
 *    [somewhere])` reaches bytes without touching {@link READ_APIS}, because the path travels in
 *    argv. Following it is the dataflow analysis E-1 declined to buy — it needs a real syntax tree,
 *    and `typescript` as a dependency rewrites `pnpm-lock.yaml`, which CI installs frozen and which
 *    is a declared input of the task this ticket changes.
 * 2. **A base is registered by name, per file.** Rebinding a registered name to something else in
 *    the same file inherits its entry. What the name can be rebound *to* is still constrained: a
 *    route (C1), a derivation (C2), an escaping literal (C3) or another read (C4) all still report.
 * 3. **The two `test/corpus.ts` modules are exempt from clause C**, because they are where the
 *    routes are *defined* and taking a computed path is their whole purpose — so a new reader in
 *    those two files is a reviewed act, which is the standing they already had.
 * 4. **C2's list omits `os.tmpdir`**: a temporary directory is outside the repository by
 *    construction, so reaching corpus from one needs a second derivation C2 does name, and
 *    registering the sandbox sites there would fill that register with entries carrying no
 *    information. C4 registers the sandbox *bases* instead, where the entry does carry one — it is
 *    the sentence distinguishing a directory the test created from a root it climbed to.
 * 5. **{@link READ_APIS} is a list, and a reader `fs` gains that nobody adds to it is not seen.**
 *    The same shape as limit 1 and deliberate for the same reason: the list is the claim, so
 *    widening it is a visible act rather than a filter drifting. What the binding resolution
 *    changes is that the list is consulted under the names a file bound as well as under Node's
 *    own — not how long the list is.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { repoFile, repoRoot } from '../test/corpus.js';
import { commitAll, git, removeTempDirs, tempDir, write } from '../test/repo.js';

/** This file, which the clause B scan skips and a test of its own audits instead. */
const GUARD = 'packages/core/src/turbo-inputs.test.ts';

/**
 * The two packages whose suites read outside themselves *and are audited here*.
 *
 * It was "the other five read nothing outside" until Q-0090, and that stopped being true: the CLI
 * frame's suite reads outside itself and declares what it reads in `packages/cli/turbo.json`, so
 * its hash is correct. It is **not** a third member, because the three floors below are calibrated
 * for these two — clause A wants more than 24 hashed inputs and a {@link MANIFEST} of more than
 * five named reads, and when Q-0090 measured it `@quorum/cli` had 21 and 2. Widening them is
 * re-deriving somebody else's guard rather than moving a register.
 *
 * **That parenthetical is a measurement of a package that has grown three times since**, and it is
 * left as the dated figure it was rather than refreshed on every ticket that adds a declaration:
 * Q-0097 and Q-0098 added five inputs between them for `build.test.ts`, and Q-0091 two more for the
 * first two commands' suites. What it is evidence for — that the floors were chosen around `shared`
 * and `core` and would have to be re-derived to admit a third member — is unchanged, and the ticket
 * that admits one is whichever ticket re-derives them.
 *
 * So the four remaining packages read nothing outside, `@quorum/cli` reads outside and declares it,
 * and its declaration is checked by its own suite rather than by this file. Stated rather than left
 * to be discovered, because a register that quietly stops covering something is the defect this
 * file exists to close.
 */
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
    'turbo.json': 'docs.test.ts — Q-0097 AC-24, 04-architecture.md\'s description of the emit is compared against the shipped build task rather than against a literal',
    'docs/02-sdlc-pipeline-spec.md': 'docs.test.ts — the status line and the §5.8 chore section',
    'docs/03-adapter-contract.md': 'docs.test.ts — the three adapter event kinds',
    'docs/04-architecture.md': 'docs.test.ts — the event union the document names',
    'docs/DECISIONS.md': 'docs.test.ts — both entries exist in the required shape',
    'docs/GLOSSARY.md': 'docs.test.ts — the Event term',
    'harness/harness.yaml': 'project.test.ts — the config corpus, and the Q-0065 --force guard',
    'spike/bin/harness.js': 'events.test.ts, constants.test.ts — the six ui methods',
    'spike/templates/harness/harness.yaml': 'project.test.ts — the shipped template config',
    'packages/core/package.json': 'index.test.ts — core declares shared as a workspace dependency',
    'packages/core/src/adapters/adapters.ts': 'project.test.ts — Q-0058 AC-2, withRetry\'s defaults are the oracle for the shipped example, so a change to one must move this task\'s hash',
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
    'contracts/Q-0011/run-manifest.schema.json': 'run-manifest.test.ts, schema-cache.test.ts, validate-artifact.test.ts, run-history/manifest.test.ts, run-history/writer.test.ts',
    'pnpm-workspace.yaml': 'test-discovery.test.ts — the globs the workspace package list is expanded from, so a package added or removed moves this task\'s hash',
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
    taskId: '@quorum/core#test',
    dir: 'spike/test',
    collects: (below) => below.endsWith('.js') && !below.includes('/'),
    why: 'corpusFiles() — git-identity.test.ts, which scans the spike test tree for commit-creating git calls',
  },
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
    dir: 'docs/decisions',
    collects: (below) => below.endsWith('.md') && !below.includes('/'),
    why: 'decisionFiles() — docs.test.ts, which checks the index against the folder',
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
  {
    taskId: '@quorum/core#test',
    dir: 'spike/test',
    collects: () => true,
    why: 'readdirSync — spike-parity.test.ts, whose register is keyed by every entry in the directory rather than only by the .js files, so the fixture beside them is hashed too',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'packages',
    collects: (below) => !below.split('/').includes('node_modules')
      && (/^[^/]+\/(?:package\.json|vitest\.config\.js)$/.test(below) || below.endsWith('.test.ts')),
    why: 'test-discovery.test.ts — each workspace package\'s manifest and Vitest configuration, and every test file the include must collect. node_modules is excluded because the walk skips it, as Vitest does',
  },
  {
    taskId: '@quorum/core#test',
    dir: 'apps',
    collects: (below) => !below.split('/').includes('node_modules')
      && (/^[^/]+\/(?:package\.json|vitest\.config\.js)$/.test(below) || below.endsWith('.test.ts')),
    why: 'the same walk, over the second glob pnpm-workspace.yaml declares',
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
  'spike/src/fanout.js': 'fanout.test.ts uses the path as task-fixture data; the file itself is read only through the spike/src walk',
  'packages/core': 'role.test.ts uses it as a value in a role\'s `paths` list, and test-discovery.test.ts as a member of the emitting-set register — both data, neither a read',
  'packages/cli': 'test-discovery.test.ts names it in the emitting-set register Q-0097 AC-13 asks for, which is an identity assertion over values derived from the manifests (Q-0073, "a count is not an identity"). Nothing opens the directory: the manifests behind that derivation are read through the `packages` walk WALKS already declares',
  'packages/shared': 'the same register, same reasoning — and the package\'s own files reach this task through the workspace dependency edge rather than through any literal',
  'docs/05-design-prompt.md': 'named nowhere but this file, as clause A\'s and clause B\'s own fixture below',
};

/**
 * What git will hand turbo: every tracked file, plus every untracked file git does not ignore.
 *
 * The one place membership is decided, and what replaced `fs.existsSync` (Q-0073). The question the
 * guard asks of a literal is whether the path it names is *hashable*; hashability is a git property
 * and the working tree is not it. `.gitignore` holds `.harness/`, `.quorum/` and `node_modules/`,
 * so nothing under them can ever be hashed, no declaration could cover one, and none of them should
 * ever have been a candidate.
 *
 * `--others` enumerates the working tree deliberately, and the tracked set alone would be wrong:
 * turbo hashes untracked-unignored files too — measured on this workspace, an untracked
 * `packages/shared/src/zz-probe.txt` moves `@quorum/shared#test`'s hash and a gitignored
 * `zz-probe.log` does not — so tracked-only would drop a path turbo genuinely hashes, which is a
 * real read going invisible: the failure this guard exists to prevent, reintroduced by its own fix.
 * `requirements/errata.md` E-1.
 */
interface Inventory {
  /** Whether it holds `value` as a file, or holds anything below it — the "is this a path" test. */
  readonly holds: (value: string) => boolean;
  /** Whether it holds something below `value`, which is the whole of "is this a directory". */
  readonly isDirectory: (value: string) => boolean;
}

/** An inventory over `entries`, each a repository-relative path as git reported it. */
function inventoryOf(entries: readonly string[]): Inventory {
  const files = new Set(entries);
  const directories = new Set<string>();
  for (const entry of entries) {
    const segments = entry.split('/');
    for (let i = 1; i < segments.length; i++) directories.add(segments.slice(0, i).join('/'));
  }
  return {
    holds: (value) => files.has(value) || directories.has(value),
    isDirectory: (value) => directories.has(value),
  };
}

/**
 * What git reports for the checkout at `root`, as repository-relative paths.
 *
 * `-z` because a path holding a quote or a newline comes back quoted and escaped otherwise, and a
 * listing that silently renames its own entries is the wrong foundation for a membership test.
 * Failure is named and loud rather than an empty inventory, which would classify every literal as
 * data and report a pass over nothing: git is already a hard requirement of running this suite,
 * spawned by `packages/core/test/repo.ts` for every sandbox repository it builds.
 *
 * @param root the checkout to ask about — the repository, unless a test hands it a sandbox.
 */
function listing(root: string = repoRoot): string[] {
  let raw: string;
  try {
    raw = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
  } catch (cause) {
    throw new Error(`inventory unavailable: git ls-files failed in ${root} — this guard reads what git will hand turbo, so it cannot answer without git`, { cause });
  }
  return raw.split('\0').filter((entry) => entry !== '');
}

/**
 * The repository's own inventory, obtained once — and the audit of what could still move a verdict.
 *
 * Existence used to **classify** is the defect this constant removes; existence used to **refuse to
 * run over a missing subject** is the rule, and four such refusals survive unchanged: the two
 * corpus walks (`typescriptFiles`, `filesBelow`), the installed `turbo` (`reported`), and a
 * manifested file that has gone (clause A's second test). Each throws where it is reached, which is
 * the opposite failure — loud, everywhere, over a subject it can name.
 *
 * Every remaining place the verdict reads the working tree, and why it does not vary with untracked
 * state:
 *
 * - **`filesBelow`'s five walks** — `backlog`, `spike/src`, `harness/flows`, `harness/roles`,
 *   `spike/templates/harness/flows`. An untracked-unignored addition moves clause A's two sides
 *   together rather than one of them: turbo hashes such a file, measured here — an untracked
 *   `backlog/<id>/ticket.md` appears in both packages' reported inputs, through the backlog glob
 *   each package configuration declares. **The residual is the other half:** a file git *ignores* that
 *   a walk's selector matched would be required to be a hashed input and could never be one. None
 *   is reachable today — `.gitignore`'s directory entries name no directory these walks descend
 *   into, and `*.log`, `.env*` and `*.tsbuildinfo` match no selector — and it is stated rather than
 *   left to be found, because it is this ticket's own class seen from the walk side.
 * - **`typescriptFiles`'s two walks** of each package's `src` and `test`. The same first half, and
 *   no second half: an untracked-unignored `.ts` there is a file turbo hashes and Vitest runs, so
 *   scanning it is right, and every ignored entry (`dist/`, `coverage/`, `*.tsbuildinfo`) either
 *   sits outside both directories or is not a `.ts` file.
 * - **`reported()`** — turbo's own enumeration, which is the other side of clause A rather than an
 *   independent reader, and which counts untracked-unignored files exactly as the walks do.
 * - **Clause A's and clause B's subject demonstrations**, which assert that
 *   `docs/05-design-prompt.md` really is in the repository before showing that no declaration covers
 *   it — a demonstration over a path that had gone would prove nothing. The file is tracked, so it
 *   is in every checkout of this commit, and the assertion classifies nothing either way. Both
 *   clauses use the one path since Q-0098; clause A's was `docs/01-product-definition.md` until that
 *   ticket gave it a real reader.
 * - **This inventory's own failures** — git absent or failing is a named error; a listing that came
 *   back implausibly small is a named error; and a sparse checkout, which can track a path that is
 *   absent from disk, *collects* that literal, which asks more of the declaration rather than less.
 *
 * @throws {Error} when git cannot answer, or answers with a listing too small to be this repository.
 */
function repositoryInventory(): Inventory {
  const entries = listing();
  // Nearly-empty is not a small repository: it is a wrong working directory, or a git that
  // answered without failing, and every literal below would then be classified as data. A sparse
  // checkout is deliberately NOT in that list — `--cached` reports what the index holds whether or
  // not the worktree materialised it, measured on git 2.55 as two cached entries over one file on
  // disk — which is why the audit above has it collecting rather than dropping. The two statements
  // contradicted each other until the Q-0073 chore review's nit named it.
  // The same floor `reported()` puts under turbo's input set, for the same reason.
  if (entries.length < 200) {
    throw new Error(`inventory implausibly small: git reported ${entries.length} paths — the scan proves nothing over that`);
  }
  return inventoryOf(entries);
}

const INVENTORY = repositoryInventory();

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
 * Every quoted string literal in `text` that names a repository path the inventory holds.
 *
 * A separator is required, so a bare word that happens to match a directory name — `main`, `test`,
 * `spike` — is not mistaken for a path. Values that are relative (`../..`), absolute, or a bare
 * prefix ending in a separator (`backlog/`, `.harness/`) are dropped as well: those are fragments
 * used in string arithmetic rather than paths handed to a reader.
 *
 * What is left is decided by {@link Inventory} and by nothing else — 270 of the 307 distinct
 * literals that reach that decision are lint messages, import specifiers, shell fragments, argv
 * fixtures and prose, and it is membership that tells them from a path.
 *
 * @param inventory the set membership is taken from. A parameter because a classification nothing
 *   can vary is a property nobody has checked, which is how the working tree came to decide this
 *   one (Q-0073 AC-3).
 */
function pathLiterals(text: string, inventory: Inventory = INVENTORY): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/'([^'\n\\]+)'|"([^"\n\\]+)"/g)) {
    const value = match[1] ?? match[2];
    if (!value.includes('/') || value.endsWith('/')) continue;
    if (value.startsWith('/') || value.startsWith('..')) continue;
    const normalised = path.posix.normalize(value);
    if (!inventory.holds(normalised)) continue;
    found.add(normalised);
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
    routes: ['repoRoot', 'repoFile', 'spikeSource', 'corpusFiles', 'ticketFiles', 'flowFiles', 'roleFiles', 'decisionFiles', 'read', 'parseYaml'],
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
    'read → file': 'the map is built from decisionFiles(), the audited walk of docs/decisions',
    'repoFile → `harness/flows/${flow}.yaml`': 'the loop iterates SHIPPED, a literal map of five flow names declared in the same test, and clause B collects the harness/flows prefix from it',
  },
  'packages/shared/src/plan-backlog.test.ts': {
    'repoFile → PLAN': 'the constant is \'docs/06-development-plan.md\', a literal at the top of that file, which clause B collects',
    'read → file': 'the value comes from ticketFiles(), the audited walk of backlog/*/ticket.md, exactly as in ticket.test.ts',
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
    'read → chore!': 'the value is flowFiles().find(basename === \'chore.yaml\'), so it comes from the same audited walk of harness/flows as the line above',
  },
  'packages/shared/src/ticket.test.ts': {
    'read → file': 'the loops iterate ticketFiles(), the audited walk of backlog/*/ticket.md',
  },
  'packages/shared/src/project.test.ts': {
    'parseYaml → path.join(repoRoot, \'harness/harness.yaml\')': 'the path is a literal inside the argument, which clause B collects and the manifest names',
  },
  'packages/core/src/contracts/contracts.test.ts': {
    'repoFile → file': 'frontmatterOf\'s parameter; both call sites in this file pass a literal ticket path, and clause B collects each',
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
  'packages/core/src/git-identity.test.ts': {
    'repoRoot → dir': 'CORPUS, a literal array of the two directories this guard walks, in the same file',
    'repoRoot → f': 'a path walk() found beneath one of those two literal directories',
    'repoRoot → rel': 'a member of corpusFiles(), which is the audited spike/test walk plus the packages walk within this package',
    'repoRoot → SELF': 'the literal naming this file, excluded from its own corpus so its fixtures are not read as violations',
  },
  'packages/core/src/spike-parity.test.ts': {
    'repoFile → counterpart': 'a member of an entry\'s carriedBy list, every one of which is a literal in the register at the top of that file',
    'repoRoot → SPIKE_TESTS': "the constant is 'spike/test', a literal in the same file, and the walk WALKS declares above",
    'repoFile → `${SPIKE_TESTS}/${entry.name}`': 'that same literal joined to a name readdir returned from it — the walk, again',
  },
  'packages/core/src/test-discovery.test.ts': {
    'repoRoot → relative': "entriesIn's parameter: a workspace glob's parent, a package below it, or a directory found beneath one — all inside the two walks WALKS declares above",
    'repoFile → `${pkg}/${name}`': "a package from that expansion joined to 'package.json' or 'vitest.config.js', both literals in the same file",
    'repoRoot → pkg': 'the existence check that decides workspace membership, over a directory from that same expansion',
    'repoFile → helper': 'a member of the literal list of test-support modules in the test that reads them',
    'repoFile → guard': 'a member of the literal two-name list naming this ticket\'s own guards, in the test.each above the call',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    'repoRoot → dir': 'typescriptFiles and filesBelow walk a directory from SUITES or WALKS, both audited above',
    'repoFile → key': 'a .ts path typescriptFiles found inside a package it was pointed at, never outside one',
    'repoFile → GUARD': 'the literal naming this file, and its own reads are audited by the three lists above',
    'repoFile → file': 'a key of ROUTE_MODULES, which is a literal list of the two corpus modules',
    'repoRoot → (bare)': 'the working directory the turbo and git subprocesses are spawned in, and listing\'s default root; nothing is read through it',
    'repoRoot → read': 'existence of a MANIFEST key, so a manifested file that has gone fails loudly',
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

/** One `a as b` member of an import clause. */
interface Member {
  /** The name the module exports. */
  readonly exported: string;
  /** The name the importing file calls it by, which is the same where the clause has no `as`. */
  readonly local: string;
}

/** A static `… from '…'` statement, decomposed only as far as this scan reads one. */
interface Statement {
  /** `import` or `export`, which is what separates a use from a re-export. */
  readonly keyword: string;
  /** The module specifier, exactly as written. */
  readonly specifier: string;
  /** Everything between the keyword and `from`, trimmed, a leading `type` removed. */
  readonly clause: string;
}

/**
 * Every static import or re-export in `text`, and the specifier of every dynamic import.
 *
 * Comments and strings are blanked first, so a statement quoted as an example is not read as one.
 * The specifier is rendered from the source because the blanking has emptied it in the code.
 */
function statements(text: string): { statics: Statement[]; dynamic: string[] } {
  const code = codeOnly(text);
  const statics: Statement[] = [];
  const dynamic: string[] = [];
  for (const match of code.matchAll(/\b(import|export)\b(?!\s*\()([^;]{0,400}?)\bfrom\s*(['"])/g)) {
    const quote = match.index + match[0].length - 1;
    const close = code.indexOf(match[3], quote + 1);
    if (close === -1) continue;
    statics.push({
      keyword: match[1],
      specifier: text.slice(quote + 1, close),
      clause: match[2].trim().replace(/^type\s+/, ''),
    });
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*(['"])/g)) {
    const close = code.indexOf(match[1], match.index + match[0].length);
    dynamic.push(close === -1 ? '(computed)' : text.slice(match.index + match[0].length, close));
  }
  return { statics, dynamic };
}

/** The three ways an import clause can bind a name, and the forms this scan will not read. */
interface Clause {
  /** The `* as x` binding, or null where the clause has none. */
  readonly namespace: string | null;
  /** The default binding, or null. */
  readonly defaultBinding: string | null;
  /** The `{ a, b as c }` members, in order. */
  readonly members: readonly Member[];
  /** Forms this scan could not read, each phrased for a caller to wrap in its own sentence. */
  readonly unreadable: readonly string[];
}

/**
 * `clause` decomposed into its bindings.
 *
 * Shared by C1 and C4 rather than written twice, because both ask the same question of a clause —
 * *which local names did this file bind, and is there a form I cannot follow?* — and differ only in
 * what they do with the answer. C1 refuses a namespace or a default binding, since a route reached
 * through a member access is a route under a name it does not watch; C4 accepts both, since a
 * filesystem read reached that way is a member call {@link READ_APIS} already names. Answering the
 * syntax question in one place is what stops the two drifting, which is how iteration 4's alias
 * survived a clause written after the lesson that produced C1's resolution.
 */
function readClause(clause: string): Clause {
  const unreadable: string[] = [];
  if (clause.startsWith('*')) {
    const namespace = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(clause);
    if (namespace) return { namespace: namespace[1], defaultBinding: null, members: [], unreadable };
    return { namespace: null, defaultBinding: null, members: [], unreadable: [`a clause this scan cannot read: ${clause}`] };
  }
  const open = clause.indexOf('{');
  const end = clause.lastIndexOf('}');
  if (open === -1 && /^[A-Za-z_$][\w$]*$/.test(clause)) {
    return { namespace: null, defaultBinding: clause, members: [], unreadable };
  }
  if (open === -1 || end === -1) {
    return { namespace: null, defaultBinding: null, members: [], unreadable: [`a clause this scan cannot read: ${clause}`] };
  }
  if (clause.slice(end + 1).trim() !== '') unreadable.push(`a trailing binding this scan cannot read: ${clause}`);
  const head = clause.slice(0, open).replace(/,\s*$/, '').trim();
  const members: Member[] = [];
  for (const member of clause.slice(open + 1, end).split(',')) {
    const [name, alias] = member.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
    if (!name) continue;
    const exported = name.trim();
    const local = (alias ?? name).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(exported) || !/^[A-Za-z_$][\w$]*$/.test(local)) {
      unreadable.push(`a member this scan cannot read: ${member.trim()}`);
    } else members.push({ exported, local });
  }
  return { namespace: null, defaultBinding: head === '' ? null : head, members, unreadable };
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
  const bindings: Binding[] = [];
  const problems: string[] = [];
  const say = (message: string): number => problems.push(`${file}: ${message}`);
  const { statics, dynamic } = statements(text);

  for (const statement of statics) {
    const resolved = resolveModule(file, statement.specifier);
    if (resolved === null || !(resolved in ROUTE_MODULES)) continue;
    if (statement.keyword === 'export') { say(`re-exports ${statement.specifier}, which would create a route under another module's name`); continue; }

    const clause = readClause(statement.clause);
    for (const detail of clause.unreadable) say(`imports ${statement.specifier} with ${detail}`);
    if (clause.namespace !== null) { say(`imports ${statement.specifier} as a namespace, so every route reaches it through a member access`); continue; }
    if (clause.defaultBinding !== null) { say(`takes a default binding from ${statement.specifier}`); continue; }

    const module = ROUTE_MODULES[resolved];
    for (const member of clause.members) {
      if (module.routes.includes(member.exported)) bindings.push({ local: member.local, exported: member.exported });
      else if (!(member.exported in module.inert)) {
        say(`imports ${member.exported} from ${resolved}, which is classified as neither a route nor inert`);
      }
    }
  }

  for (const specifier of dynamic) say(`imports ${specifier} dynamically, which no static scan follows`);
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
  'packages/core/src/backlog/scaffold.test.ts': {
    // Quoted for the reason `createRequire` above is: an unquoted key is code, and this file is
    // inside its own scan, so writing the token bare would register a derivation in the register.
    'pathToFileURL': 'turning a temporary directory this test created into the file: URL spelling packages/cli hands initProject, so both argument shapes are exercised over the same tree; it names nothing outside os.tmpdir',
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
  'packages/core/src/run-history/reader.ts': {
    '..': 'one of the three tokens the confinement guard refuses outright; it names no file, it is compared against one',
  },
  'packages/core/src/spike-parity.test.ts': {
    '../src/': 'the prefix a spike test file\'s own import specifiers are compared against, to decide whether it imports the spike\'s source; nothing is opened through it',
  },
  'packages/core/src/run-history/reader.test.ts': {
    '..': 'the same token, handed to the guard and asserted refused',
    '../secret': 'a hostile run id, asserted refused; its target is built under os.tmpdir by the test itself',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    '..': 'the value `escapes` compares a normalised path against, and the key of two entries above',
    '../': 'the prefix it compares against, and the key of two entries above',
    '../git/git.js': 'the key of the fanout entry above',
    '../src/': 'the key of the spike-parity entry above',
    '../secret': 'the key of the run-history reader entry above',
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

/**
 * Node's filesystem read APIs — the anchor's subject, and itself part of the register.
 *
 * Listed rather than detected, and stated here rather than argued in prose, because the list is the
 * claim: these are the calls through which a file's contents can enter a suite. Extending C2's list
 * of root derivations was refused as the remedy for iteration 3 (`requirements/errata.md` E-1) and
 * this is why — the ways to *compute a string* are not enumerable, while the ways to *read a file*
 * are, and a read is the last point every bypass must pass through. A name missing from this list
 * is the one way past clause C4, which is why adding one is a visible act rather than a filter
 * quietly widening.
 *
 * Both spellings of each are here — `readFileSync` and `readFile`, `statSync` and `stat` — because
 * `fs/promises` and the callback API reach the same bytes as the synchronous one.
 */
const READ_APIS = [
  'readFileSync', 'readFile', 'readdirSync', 'readdir', 'existsSync',
  'statSync', 'stat', 'lstatSync', 'lstat', 'realpathSync', 'realpath',
  'opendirSync', 'opendir', 'openSync', 'open', 'createReadStream',
  'readlinkSync', 'readlink', 'accessSync', 'access', 'globSync', 'glob',
  'copyFileSync', 'copyFile', 'cpSync', 'cp',
] as const;

/** Every spelling Node accepts for the two modules {@link READ_APIS} are exported from. */
const READ_MODULES = ['node:fs', 'fs', 'node:fs/promises', 'fs/promises'];

/** A local name in one file that reaches a filesystem read. */
interface ReadBinding {
  /** The name as this file writes it — `slurp` for an alias, `fs` for a whole-module binding. */
  readonly local: string;
  /**
   * The API it reaches, as {@link READ_APIS} spells it, or null for a whole-module binding, whose
   * reads are member calls on {@link local} and are therefore already matched by the API's own name.
   */
  readonly api: string | null;
}

/**
 * The filesystem readers `file` imports, under its own names for them, and every import of a read
 * module this scan will not read.
 *
 * The parity half of C4, and the reason it exists: {@link readSites} matches an API under its own
 * name, so `import { readFileSync as slurp }` reached out of the package with nothing to say about
 * it — C1 had learnt to resolve bindings two iterations earlier and C4, written after that lesson,
 * matched raw names. It resolves through {@link readClause} rather than through a second scanner,
 * so an alias is followed under whatever local name the file bound it to.
 *
 * A member that is not in {@link READ_APIS} yields no binding and no problem, because that list is
 * the standing claim about what can read a file; `promises` and `default` yield a whole-module
 * binding instead, since both are objects whose members are those same APIs.
 *
 * Every form this scan cannot follow is reported rather than passing as an absence of read sites: a
 * re-export, a dynamic import, a `require`, a clause it cannot parse, and a read taken as a value
 * rather than called — the last because a name this scan resolved and then saw handed somewhere
 * else is a read under a name it will not see called. The `require` case is the direct spelling of
 * a refusal C2 already makes indirectly: this workspace is ESM, so reaching `require` at all needs
 * `createRequire`, which {@link ROOT_DERIVATIONS} makes somebody answer for.
 */
function readImports(file: string, text: string): { bindings: ReadBinding[]; problems: string[] } {
  const bindings: ReadBinding[] = [];
  const problems: string[] = [];
  const say = (message: string): number => problems.push(`${file}: ${message}`);
  const { statics, dynamic } = statements(text);

  for (const statement of statics) {
    if (!READ_MODULES.includes(statement.specifier)) continue;
    if (statement.keyword === 'export') { say(`re-exports ${statement.specifier}, which would create a reader under another module's name`); continue; }

    const clause = readClause(statement.clause);
    for (const detail of clause.unreadable) say(`imports ${statement.specifier} with ${detail}`);
    for (const local of [clause.namespace, clause.defaultBinding]) {
      if (local !== null) bindings.push({ local, api: null });
    }
    for (const member of clause.members) {
      if (READ_APIS.includes(member.exported as (typeof READ_APIS)[number])) bindings.push({ local: member.local, api: member.exported });
      else if (member.exported === 'promises' || member.exported === 'default') bindings.push({ local: member.local, api: null });
    }
  }

  for (const specifier of dynamic) {
    if (READ_MODULES.includes(specifier)) say(`imports ${specifier} dynamically, which no static scan follows`);
  }
  const blanked = codeOnly(text);
  for (const match of blanked.matchAll(/\brequire\s*\(\s*(['"])/g)) {
    const close = blanked.indexOf(match[1], match.index + match[0].length);
    const specifier = close === -1 ? '(computed)' : text.slice(match.index + match[0].length, close);
    if (READ_MODULES.includes(specifier)) say(`requires ${specifier}, which is a binding no import clause declares`);
  }

  const code = withoutImports(blanked);
  for (const binding of bindings) {
    const value = binding.api === null
      ? new RegExp(`\\b${binding.local}\\s*\\.\\s*(?:${READ_APIS.join('|')})\\b(?!\\s*\\()`, 'g')
      : new RegExp(`\\b${binding.local}\\b(?!\\s*\\()`, 'g');
    for (const match of code.matchAll(value)) say(`takes ${match[0].trim()} as a value rather than calling it`);
  }
  return { bindings, problems };
}

/**
 * The span of a path expression's **base** — what the joining is rooted at.
 *
 * `path.join`, `resolve`, `relative` and `normalize` are unwrapped to their first argument, so
 * `path.join(dir, 'ticket.md')` bases at `dir` and `path.join(repoRoot, relative)` at `repoRoot`.
 * The base is the register's unit rather than the whole site, because it is the whole of the
 * security question: `dir` reaches what `dir` is, and every read rooted at it inherits that answer.
 * Keying by site instead would have produced a hundred and thirteen entries, thirty-one of them
 * saying "the path this function was handed", which is the register-full-of-noise this file already
 * refuses for `os.tmpdir` above.
 *
 * Offsets are found in the blanked code and the value is rendered from the source, so a comma
 * inside a string cannot end an argument early.
 */
function baseSpan(code: string, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  for (;;) {
    const head = /^\s*path\.(?:join|resolve|relative|normalize)\s*\(/.exec(code.slice(from, to));
    if (!head) return [from, to];
    const inner = from + head[0].length;
    const stop = argumentEnd(code, inner);
    if (stop === -1 || stop > to) return [from, to];
    from = inner;
    to = stop;
  }
}

/** One filesystem read whose base needs an answer, and the base as written. */
interface ReadSite {
  /** The API called, as {@link READ_APIS} spells it — for the reader who has to find the line. */
  readonly api: string;
  /** The base the path is rooted at, which is what {@link READ_BASES} is keyed by. */
  readonly base: string;
}

/**
 * Every filesystem read in `text` rooted at a base no other clause has already accounted for.
 *
 * Three exemptions, each a hand-off to the clause that owns that shape rather than a hole:
 *
 * - a base that is a quoted literal **clause B collects** — one naming a real repository path, so
 *   clause B has already required it declared. A literal clause B drops is *not* exempt, which is
 *   what stops `realpathSync('.')` buying a root for nothing: `'.'` carries no separator, so clause
 *   B never sees it and this clause demands an answer for it.
 * - a base naming a **route**, under whatever local name this file imported it as, because the
 *   route call is a clause C1 site and C1 has already required its path to be a literal or
 *   registered.
 * - a base **inside a `path.*` call this scan could not delimit**, which is reported rather than
 *   skipped, as `(unparsed)`.
 *
 * What is left is a path computed from a base the file obtained some other way — the shape
 * iteration 3 found no clause could see, and the one this register exists to make a person answer.
 *
 * A read is reached by a name, and there are three ways a name can reach one. The API's own name is
 * matched directly, which covers `fs.readFileSync(` and a bare `readFileSync(` from any module. A
 * local alias is matched under the name `reads` says this file bound it to, which is iteration 4's
 * finding. The third — the API taken as a value and called later — is refused by
 * {@link readImports} rather than matched, because a name this scan cannot follow is not a site it
 * can render.
 *
 * @param routes the routes this file imported, whose calls belong to C1 rather than here.
 * @param reads the readers this file imported, from {@link readImports}. A fixture that declares no
 *   import still has its API-named calls matched, so this list only ever adds sites.
 */
function readSites(text: string, routes: readonly Binding[], reads: readonly ReadBinding[] = []): ReadSite[] {
  const code = withoutImports(codeOnly(text));
  const names = routes.map((binding) => binding.local);
  const found = new Map<number, ReadSite>();
  const patterns: [string | null, RegExp][] = [[null, new RegExp(`\\b(${READ_APIS.join('|')})\\b\\s*\\(`, 'g')]];
  for (const read of reads) {
    if (read.api !== null) patterns.push([read.api, new RegExp(`\\b${read.local}\\b\\s*\\(`, 'g')]);
  }
  for (const [api, pattern] of patterns) {
    for (const match of code.matchAll(pattern)) {
      const start = match.index + match[0].length;
      const called = api ?? match[1];
      const end = argumentEnd(code, start);
      if (end === -1) { found.set(start, { api: called, base: '(unparsed)' }); continue; }
      const [from, to] = baseSpan(code, start, end);
      const base = text.slice(from, to).trim();
      if (isLiteral(base) && pathLiterals(base).length > 0) continue;
      if (names.some((route) => new RegExp(`\\b${route}\\b`).test(code.slice(from, to)))) continue;
      found.set(start, { api: called, base });
    }
  }
  return [...found].sort(([a], [b]) => a - b).map(([, site]) => site);
}

/**
 * Where every computed read's base comes from, per file.
 *
 * This is the register `requirements/errata.md` E-1 requires, and each entry answers the one
 * question the clause exists to ask: *can this base name a file outside its own package?* A
 * directory the test itself created under `os.tmpdir` cannot. A root climbed to from the working
 * directory can — which is the difference between an entry that is noise and the entry that would
 * have caught iteration 3's bypass, and why `process.cwd()` appears below as a base in its own
 * right rather than only as a C2 derivation.
 *
 * The product modules are here too, and their answer is the same in every case: they read the path
 * their caller hands them. That is not a weaker answer than a test's — it is a statement that the
 * anchoring happens at the call site, and every call site is in the scanned set above.
 */
const READ_BASES: Record<string, Record<string, string>> = {
  'packages/core/src/git-identity.test.ts': {
    dir: "walk()'s parameter — path.join(repoRoot, d) for each d in CORPUS, a literal array of the two directories in the same file, and the directory entries recursed into beneath them",
  },
  'packages/core/src/engine/loaders.ts': {
    file: "path.join(harnessDir, 'roles', `${name}.md`) and the flow file loadFlow is handed — both under the CALLER'S project, not this repository",
    dir: "path.join(ticketDir, 'review') — the ticket folder reviewRound counts rounds in, again in the caller's project",
  },
  'packages/core/src/engine/prompt.ts': {
    file: "path.join(harnessDir, name) for each input.harness entry a step declares — under the CALLER'S project, and the harnessDir is the one loadProject resolved for it",
  },
  'packages/core/test/run-fixture.ts': {
    'runDir(repoDir, run)': "path.join(repoDir, RUN_HISTORY_ROOT, runIdOf(…)) inside the temp repository repo() created for the test; every fixture in this file is under os.tmpdir",
  },
  'packages/core/src/engine/agent-run.test.ts': {
    file: "occurrenceFile(fixture.repoDir, …) — inside the run history of the temp repository runFixture() built, read from inside the adapter call to prove the prompt was persisted first",
    "occurrenceFile(fixture.repoDir, 1, 'implement', OUTPUT_FILE)": 'the same occurrence artifact, read back after the run',
    'fixture.ticketDir': "the ticket folder inside that temp repository, for the runs.log line the step appended",
    'dump!': "the path the FlowError itself named — inside the ticket folder's .harness/, which is under the same temp repository",
    occurrenceDir: 'path.dirname of one of those occurrence artifacts, listed to show what the run wrote beside it',
  },
  'packages/core/src/engine/agent-step.test.ts': {
    repoDir: 'repo() — a git repository created under os.tmpdir for this test',
    "worktreeOf(repoDir, 'harness/Q-0052/implement')": 'a worktree inside that repository, where the step ran',
    worktree: 'the same worktree, bound once where the test reads it twice',
    ticketDir: 'the ticket folder inside that repository',
  },
  'packages/core/src/engine/composite.test.ts': {
    'f.repoDir': 'repo() — a git repository created under os.tmpdir for one test, and the root every other base here is joined from',
    'f.ticketDir': 'the ticket folder inside that repository, for the artifacts an integrate step declared it writes',
    'f.worktree(INTEGRATION)': "path.join(f.repoDir, '.harness', 'worktrees', worktreeDirName(…)) — the integration worktree inside that same repository, where the merges and the test command happened",
  },
  'packages/core/src/engine/run-composition.test.ts': {
    'fixture.ticketDir': 'the ticket folder inside the temp repository runFixture() built',
    'fixture.repoDir': 'that temp repository itself, for the directories a dry run must not create',
    'gate.ticketDir': "the ticket folder the gate event named, asserted to be the one the fixture built — the check is that the path a human is sent to exists",
  },
  'packages/core/src/engine/steps.test.ts': {
    ticketDir: "the ticket folder inside tempDir('script-'), where the script step's declared output landed",
  },
  'packages/core/src/engine/undecided.test.ts': {
    'fixture.ticketDir': 'the ticket folder inside the temp repository runFixture() built, for the runs.log lines an undecided run appended',
    'fixture.repoDir': 'that temp repository itself, which is where the run history an undecided run finalised is read back from',
    'worktreeOf(fixture.repoDir, branch)': "path.join(fixture.repoDir, '.harness', 'worktrees', worktreeDirName(branch)) — a worktree inside that same temp repository, asked whether an undecided run left it standing",
  },
  'packages/core/src/engine/worktree-lifecycle.test.ts': {
    'fixture.ticketDir': "the ticket folder inside the temp repository runFixture() built, for the runs.log line a finished run's cleanup appended",
    'worktreeOf(fixture.repoDir, branch)': "path.join(fixture.repoDir, '.harness', 'worktrees', worktreeDirName(branch)) — a worktree inside that same temp repository, asked whether it is still there",
    'worktreeOf(fixture.repoDir, IMPLEMENT)': 'the step branch\'s worktree in that repository, named directly where the loop above is not the shape wanted',
    'worktreeOf(fixture.repoDir, INTEGRATION)': 'the integration branch\'s worktree in the same repository',
    reused: 'worktreeOf(…) again, bound once because the test cuts that worktree by hand before the run and then reads it back',
    bystander: 'likewise, for the worktree on an unrelated branch that no run may remove',
    kept: 'likewise, for the worktree an install command dirtied and the run therefore kept',
    byHand: 'likewise, for the worktree a dry run must leave exactly where it found it',
  },
  'packages/core/src/engine/engine.test.ts': {
    'opts.project.repoDir': "the temp repository repo() created for this test; nothing under it is in the repository",
    'opts.ticket.dir': "the ticket folder inside that temp repository, built from opts.project.repoDir",
    ticketFile: "path.join(opts.ticket.dir, 'ticket.md') — the sentinel AC-10a writes and reads back, inside the temp repository",
  },
  'packages/core/src/engine/diff.test.ts': {
    'opts.project.repoDir': 'the throwaway repository repoWith() built for this test; nothing under it is in the repository',
    ticketFile: "path.join(opts.ticket.dir, 'ticket.md') — the ticket P6 reads back to show a dry run mutated nothing, inside that repository",
    runsLog: "path.join(opts.ticket.dir, 'runs.log') — the truncation notices AC-9.5 counts materialisations from, likewise",
  },
  'packages/core/src/adapters/codex.test.ts': {
    seen: 'path.join(tempDir(\'codex-schema-\'), \'schema-seen.json\') — a file the stub copies into a sandbox',
    'tempDirOf(ok.argv())': 'path.dirname of the --output-schema path off the argv the stub recorded, so it is the adapter\'s own temp directory',
    'tempDirOf(failed.argv())': 'the same, on the run that exited non-zero',
    'os.tmpdir()': 'the system temporary directory, listed to count what a spawn failure left behind',
  },
  'packages/core/src/adapters/codex.ts': {
    lastPath: 'path.join(tmp, \'last.txt\') — the temp directory this run created and removes again',
  },
  'packages/core/src/adapters/mock.test.ts': {
    cwd: 'tempDir(…) — the sandbox each mock run is given as its working directory',
  },
  'packages/core/src/adapters/probe.test.ts': {
    supplied: 'tempDir(\'probe-supplied-…\') — the sandbox the probe is handed',
    'adapter.seen[0].cwd': 'the working directory the probe passed the fake adapter, asserted removed afterwards',
    'adapter.seen[1].cwd': 'the same, on the second call',
  },
  'packages/core/src/backlog/backlog.test.ts': {
    root: 'path.join(repoRoot, \'backlog\') in corpusTickets — the backlog walk WALKS declares above',
    file: 'a ticket.md corpusTickets collected, from that same walk',
    'ticket.dir': 'a ticket folder inside the sandbox backlog these tests build',
    abs: 'the absolute path backlog.writeFile returned, inside that sandbox',
    'backlog.writeFile(ticket, \'dev/two.md\', \'has one\\n\')': 'the same, read back inline',
    'backlog.writeFile(ticket, \'dev/three.md\', \'trailing\\n\\n\')': 'likewise',
  },
  'packages/core/src/backlog/backlog.ts': {
    'this.root': 'the backlog root the caller constructed this Backlog with',
    dir: 'a ticket folder under this.root',
    f: 'a file inside a ticket folder, joined from the caller\'s root',
  },
  'packages/core/src/backlog/project.test.ts': {
    'loaded.backlog.root': 'the backlog path loadProject resolved from a sandbox project the test wrote',
  },
  'packages/core/src/backlog/project.ts': {
    d: 'findProject\'s walk upward from its start directory, looking for a marker and reading nothing',
    harnessDir: 'path.join(repoDir, \'harness\') — the project root the caller named or findProject located',
  },
  'packages/core/src/backlog/scaffold.ts': {
    dst: 'path.join(dir, \'harness\') — under the directory initProject\'s caller named, which is the adopter\'s repository and never this one',
    templates: 'initProject\'s parameter — the template tree the caller hands it, which packages/cli resolves relative to its own module and packages/cli/turbo.json declares',
    configFile: 'path.join(dst, \'harness.yaml\') — the config just copied into that same caller-named directory',
  },
  'packages/core/src/backlog/scaffold.test.ts': {
    dir: 'a directory this test created under os.tmpdir — either a bare one or a git repository it initialised itself',
    byPath: 'the same, for the copy made from a filesystem path',
    byUrl: 'the same, for the copy made from a file: URL, which is the spelling packages/cli hands core',
  },
  'packages/core/src/contracts/contracts.source.test.ts': {
    resolved: 'createRequire(...).resolve(\'ajv/package.json\') — inside node_modules, which pnpm-lock.yaml hashes',
  },
  'packages/core/src/contracts/contracts.ts': {
    file: 'readData\'s parameter — the artifact path the caller named',
  },
  'packages/core/src/fanout/command.ts': {
    file: 'readCapture\'s parameter, rooted by both callers at the temp directory this invocation created and removes again',
    outFile: 'path.join(dir, \'stdout\') — inside that same directory, never a path in the repository',
    errFile: 'path.join(dir, \'stderr\') — likewise',
  },
  'packages/core/src/corpus.test.ts': {
    dir: 'listing\'s parameter, which its two callers root at CORE_SRC or at a temporary tree',
    CORE_SRC: 'path.join(repoRoot, \'packages/core/src\'), a literal in this file and inside this package',
    root: 'tempDir(\'corpus-\') — a tree this test builds to prove the reader walks it',
  },
  'packages/core/src/fanout/fanout.test.ts': {
    'tasksFile(ticket)': 'path.join(ticket.dir, \'solution\', \'tasks.yaml\') under the sandbox ticket at the top of this file',
    dir: 'repo() or withBranch() — a git repository created under os.tmpdir',
    wt: 'a worktree under one of those repositories, or tempDir(\'wt-\')',
    integration: 'the integration worktree of one of those repositories',
    'spikeWorktreeDir(dir, \'harness/T-3/contracts\')': 'the path a worktree WOULD have, under the sandbox repository, asserted absent',
    '\'/tmp/quorum-q0048-pwned\'': 'the file a shell-injection fixture would create if the argument were interpolated; asserted absent, and outside the repository by construction',
  },
  'packages/core/src/fanout/fanout.ts': {
    f: 'path.join(ticket.dir, …) or path.join(worktreeDir, contract) — both the caller\'s',
    doc: 'path.join(ticket.dir, \'solution\', \'solution.md\') — likewise',
    dir: 'the worktree path built from the repository the caller named',
  },
  'packages/core/src/git/git.test.ts': {
    dir: 'repo(), forked(), withTicketBranch(), divergedContent() or notARepo() — all under os.tmpdir',
    worktree: 'ensureWorktree\'s answer, inside one of those repositories',
    'worktreeOf(dir)': 'path.join(dir, \'.harness\', \'worktrees\', …) — the expected path, derived independently of the function under test',
    'excludeFile(dir)': 'git rev-parse --git-path info/exclude, resolved against the sandbox repository',
    'excludeFile(noNewline)': 'the same, on another sandbox repository',
    'excludeFile(empty)': 'likewise',
    'excludeFile(worktree)': 'likewise, from inside a worktree',
    'process.cwd()': 'asserting a hostile git argument created no file beside the runner — an existence check on a name, and the one base here that COULD reach the repository, which is why it is written down rather than left to the C2 entry for the same file',
  },
  'packages/core/src/git/git.ts': {
    dir: 'the worktree path built from the repoDir the caller named',
    f: 'the exclude file git resolved, relative to that same repoDir',
  },
  'packages/core/src/lint/lint.ts': {
    directory: 'lintFlowDirectory\'s parameter — the flows directory the caller named',
    file: 'path.join(directory, filename) inside it',
  },
  'packages/core/src/run-history/reader.ts': {
    runsRoot: 'readRunsDir\'s and resolveRunDirectory\'s parameter — the runs root the caller named',
    manifestPath: 'path.join(runsRoot, runId, MANIFEST_FILE) inside it',
    target: 'realPath\'s parameter, rooted by both of its callers at that same runs root',
    realDir: 'the realpath of a single-segment child of it, refused unless its real parent IS the real root',
  },
  'packages/core/src/run-history/writer.ts': {
    runsRoot: 'path.join(repoDir, RUN_HISTORY_ROOT) — inside the repository the caller named',
    'ticket.dir': 'the ticket folder the backlog loaded, re-read for the persisted-stage guard',
    logPath: 'path.join(ticket.dir, RUNS_LOG_FILE) — inside that same ticket folder',
    outputPath: 'path.join(runDir, occurrence.occurrence_dir, OUTPUT_FILE) — inside the run directory this call created',
    temporary: '`${target}.tmp` beside the manifest, in that same run directory',
  },
  'packages/core/src/run-history/reader.test.ts': {
    root: 'a runs root under tempDir(\'runs-\'), built by this file two levels down so a fixture outside it is still inside what removeTempDirs deletes',
  },
  'packages/core/src/run-history/writer.test.ts': {
    'history.dir': 'the run directory initialiseRunHistory created, under the sandbox repository',
    'first.dir': 'the same, on the run that owns the directory a second one collides with',
    repoDir: 'repo() — a git repository created under os.tmpdir',
    worktree: 'a linked worktree of one of those repositories',
    file: 'git rev-parse --git-path info/exclude, resolved against the sandbox repository',
    target: 'path.join(runDirOf(start), \'manifest.json\') — inside a run directory under the same sandbox',
    'runDirOf(start)': 'the run directory a `start` would allocate, derived from the sandbox repoDir it names',
    stray: 'path.join(history.dir, \'manifest.json.tmp\') — likewise',
  },
  'packages/core/src/test-command.test.ts': {
    dir: 'spikeSources\' parameter, defaulting to path.join(repoRoot, \'spike/src\') — the walk WALKS declares above',
    bin: 'path.join(repoRoot, \'node_modules/.bin/turbo\') — the installed toolchain, which git ignores and turbo therefore cannot hash, so no declaration could cover it and its absence fails loudly instead',
  },
  'packages/core/src/turbo-inputs.test.ts': {
    absolute: 'path.join(repoRoot, dir) in typescriptFiles and filesBelow, whose directories come from SUITES and WALKS',
    bin: 'path.join(repoRoot, \'node_modules/.bin/turbo\') — the installed toolchain, as in test-command.test.ts above',
  },
  'packages/core/test/cli-stub.ts': {
    argvLog: 'a file inside tempDir(\'cli-stub-\'), where the stub records what it was called with',
    stdinFile: 'the same sandbox, where it records what it was sent',
  },
  'packages/core/test/repo.ts': {
    dir: 'fs.mkdtempSync(path.join(os.tmpdir(), …)) — this module is where the sandboxes come from',
    log: 'path.join(dir, \'calls\') inside one of them',
  },
};

const turbo = reported();

/** Each suite's own sources and test support, minus this file, which its own lists audit instead. */
const scanFiles = (directory: string): [string, string][] =>
  [...typescriptFiles(`${directory}/src`), ...typescriptFiles(`${directory}/test`)]
    .filter(([file]) => file !== GUARD);

/**
 * Clause B over one suite: every repository path it names that nothing hashes, as `file: literal`.
 *
 * @param inventory what membership and directory-ness are decided from. It is a parameter so the
 *   occurrence list can be compared across two inventories rather than across two checkouts —
 *   the property Q-0073 exists to establish, checkable in an environment where neither directory
 *   the defect turned on is present.
 */
function undeclaredPaths(taskId: string, directory: string, inventory: Inventory = INVENTORY): string[] {
  const missing: string[] = [];
  for (const [file, text] of scanFiles(directory)) {
    for (const literal of pathLiterals(text, inventory)) {
      if (literal in NOT_READ) continue;
      if (literal === directory || literal.startsWith(`${directory}/`)) continue;
      if (inventory.isDirectory(literal)) {
        if (!WALKS.some((walk) => walk.taskId === taskId && walk.dir === literal)) {
          missing.push(`${file}: ${literal} (a directory, and no audited walk covers it)`);
        }
        continue;
      }
      if (!covered(literal, turbo[taskId], directory)) missing.push(`${file}: ${literal}`);
    }
  }
  return missing;
}

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
    //
    // Why this path moved (Q-0098): the fixture was `docs/01-product-definition.md`, which stopped
    // being a path nothing reads the moment `packages/shared/src/docs.test.ts` began scanning it for
    // an unqualified registry claim (AC-21). Its NOT_READ entry would then have been excusing a real
    // read — and because `undeclaredPaths` skips a NOT_READ key for EVERY task, clause B would have
    // gone blind to whether `@quorum/shared#test` declared it. Removing the entry is what restores
    // the check; the fixture is served just as well by `docs/05-design-prompt.md`, which clause B
    // below already demonstrates is in the repository and covered by no declaration.
    expect(uncovered(['docs/05-design-prompt.md'], turbo['@quorum/core#test'].inputs))
      .toEqual(['docs/05-design-prompt.md']);
  });
});

describe('AC-7 clause B — every path either suite names is covered by a declaration', () => {
  test.each(SUITES)('$taskId names no repository path that nothing hashes', ({ taskId, directory }) => {
    expect(scanFiles(directory).length, `${directory} holds no TypeScript — the scan proves nothing`).toBeGreaterThan(5);
    expect(undeclaredPaths(taskId, directory)).toEqual([]);
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
    // Was `packages/core/src/index.ts` until Q-0096 AC-3 retired the byte pin that read it, which
    // took the declared input with it. `packages/core/package.json` is the same shape of witness —
    // a path outside `packages/shared` that this task covers by declaring it and not by an edge.
    expect(covered('packages/core/package.json', shared, 'packages/shared')).toBe(true);
    expect(shared.inputs.has('packages/core/package.json'), 'shared declares this as an input, never as an edge').toBe(true);
  });
});

/** What a checkout that has run a flow holds under the two roots `.gitignore` excludes. */
const AFTER_A_FLOW = ['.harness/worktrees/w/package.json', '.quorum/runs/1/manifest.json'];

/**
 * Every `file: literal` the classifier collects from the two audited suites — AC-5's baseline,
 * pinned as a set of identities rather than as a count.
 *
 * A count is the wrong instrument here, which is what iteration 1's review found: a floor lets an
 * unrelated addition pay for a removal, so a literal could stop being collected — the classifier
 * quietly losing its subject, the failure this whole file exists to close — while the totals still
 * read green. Membership is checked in one direction only, because the two directions are not the
 * same claim: every entry here must still be collected, while an occurrence this list does not hold
 * is an *addition*, which clause B above already judges on its merits and which no criterion
 * forbids.
 *
 * Sixty of the sixty-one are the measured baseline — 67 per-file-distinct occurrences over 37
 * distinct literals, less the three literals the census names and the seven occurrences they
 * carried. The sixty-first, `packages/shared/test/corpus.ts: docs/decisions`, arrived while this
 * ticket was in flight, with the split of `docs/DECISIONS.md` into a file per entry; it is an
 * addition of exactly the shape this list permits, and the walk that covers it is in {@link WALKS}.
 *
 * Nine more arrived with Q-0049's `run-history/` suites — four of them naming literals the register
 * did not hold before: the two ticket folders whose `ticket.md` the fixtures quote as a
 * `ticket_path`, `harness/flows/development.yaml`, and `packages/core/src/contracts/run-manifest.ts`,
 * which the source suite reads to assert that neither implementation of the roll-up imports the
 * other. Seventy over thirty-nine.
 *
 * One more arrived with Q-0058, on a literal the register did not hold before:
 * `packages/core/src/adapters/adapters.ts`, which `project.test.ts` reads so that `withRetry`'s
 * destructured defaults are the oracle for the commented example in both shipped `harness.yaml`
 * files rather than three numbers retyped into a test. Seventy-one over forty.
 *
 * One more arrived with Q-0040, and it names no new literal: `contracts.test.ts` now reads
 * `backlog/Q-0011-run-history-on-disk/ticket.md`, which the register already held from
 * `reader.test.ts`, because that ticket's committed history carries the `interrupted` the frozen
 * Q-0006 schema omitted. **Seventy-three over forty** — an occurrence, not a literal.
 *
 * The jump from "seventy-one" to seventy-three is two because the prose above was one behind the
 * register before this change: the assertion below read 72 while the last paragraph said 71. The
 * count is re-derived from the array here rather than continued from the sentence, which is the
 * same reason this file pins identities and not totals.
 *
 * **Q-0096 removed eight and added one, which is the first contraction this register has taken.**
 * Eight tests read `packages/core/src/index.ts` to pin the barrel byte for byte — one in
 * `packages/shared/src/index.test.ts`, named by that ticket's AC-3, and seven more inside
 * `packages/core` that no criterion named, each asserting that its own port child *"adds no public
 * re-export"*. Q-0096 is the ticket that gives the package a public surface, so all eight lost
 * their subject at once and none could survive; the seven core-side ones are now assertions about
 * which of their folder's exports the barrel carries, which needs no file read. The one addition
 * is `index.test.ts`, which reads the file to say it is no longer the stub. **Seventy-three minus
 * eight, plus one: sixty-six over forty** — counted from the array below rather than continued
 * from the sentence above it, for the reason the previous paragraph gives, and the first draft of
 * this sentence said sixty-seven because it forgot that the eighth removal was the one AC-3 names.
 * The literal count does not move: `packages/core/src/index.ts` is still collected, from the one
 * test that still reads it.
 *
 * A contraction is the one direction this register exists to catch, so it is recorded here rather
 * than absorbed: what makes these eight legitimate is that the read stopped happening, not that an
 * assertion was weakened.
 */
const COLLECTED_BASELINE = [
  'packages/core/src/adapters/adapters.source.test.ts: packages/core/package.json',
  'packages/core/src/adapters/capabilities.source.test.ts: docs/03-adapter-contract.md',
  'packages/core/src/adapters/capabilities.source.test.ts: docs/04-architecture.md',
  'packages/core/src/adapters/structured-output.test.ts: contracts/Q-0006/review-artifacts.schema.json',
  'packages/core/src/backlog/backlog.source.test.ts: packages/core/package.json',
  'packages/core/src/backlog/backlog.source.test.ts: packages/shared/package.json',
  'packages/core/src/backlog/backlog.source.test.ts: packages/shared/src/index.ts',
  'packages/core/src/backlog/backlog.source.test.ts: packages/shared/src/project.ts',
  'packages/core/src/contracts/contracts.source.test.ts: packages/core/package.json',
  'packages/core/src/contracts/contracts.test.ts: backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md',
  'packages/core/src/contracts/contracts.test.ts: backlog/Q-0011-run-history-on-disk/ticket.md',
  'packages/core/src/contracts/contracts.test.ts: contracts/Q-0006/ticket-review-state.schema.json',
  'packages/core/src/contracts/run-manifest.test.ts: backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
  'packages/core/src/contracts/run-manifest.test.ts: contracts/Q-0011/run-manifest.schema.json',
  'packages/core/src/contracts/run-manifest.test.ts: harness/flows/chore.yaml',
  'packages/core/src/contracts/schema-cache.test.ts: backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
  'packages/core/src/contracts/schema-cache.test.ts: contracts/Q-0011/run-manifest.schema.json',
  'packages/core/src/contracts/schema-cache.test.ts: harness/flows/chore.yaml',
  'packages/core/src/contracts/validate-artifact.test.ts: backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md',
  'packages/core/src/contracts/validate-artifact.test.ts: backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
  'packages/core/src/contracts/validate-artifact.test.ts: contracts/Q-0006/ticket-review-state.schema.json',
  'packages/core/src/contracts/validate-artifact.test.ts: contracts/Q-0011/run-manifest.schema.json',
  'packages/core/src/contracts/validate-artifact.test.ts: harness/flows/chore.yaml',
  'packages/core/src/corpus.test.ts: packages/core/src',
  'packages/core/src/engine/engine.test.ts: harness/harness.yaml',
  'packages/core/src/fanout/fanout.source.test.ts: packages/core/package.json',
  'packages/core/src/fanout/fanout.test.ts: spike/src/fanout.js',
  'packages/core/src/git/git.source.test.ts: packages/shared/package.json',
  'packages/core/src/git/git.source.test.ts: packages/shared/src/containment.ts',
  'packages/core/src/git/git.source.test.ts: packages/shared/src/index.ts',
  'packages/core/src/index.test.ts: packages/core/src/index.ts',
  'packages/core/src/lint/lint.test.ts: harness/flows',
  'packages/core/src/lint/lint.test.ts: spike/templates/harness/flows',
  'packages/core/src/run-history/manifest.test.ts: contracts/Q-0011/run-manifest.schema.json',
  'packages/core/src/run-history/reader.test.ts: backlog/Q-0011-run-history-on-disk/ticket.md',
  'packages/core/src/run-history/reader.test.ts: harness/flows/development.yaml',
  'packages/core/src/run-history/run-history.source.test.ts: packages/core/package.json',
  'packages/core/src/run-history/run-history.source.test.ts: packages/core/src/contracts/run-manifest.ts',
  'packages/core/src/run-history/writer.test.ts: backlog/Q-0049-core-run-history/ticket.md',
  'packages/core/src/run-history/writer.test.ts: contracts/Q-0011/run-manifest.schema.json',
  'packages/core/src/run-history/writer.test.ts: harness/flows/chore.yaml',
  'packages/core/src/test-command.test.ts: .github/workflows/ci.yml',
  'packages/core/src/test-command.test.ts: packages/core/src/adapters/real-cli.probe.test.ts',
  'packages/core/src/test-command.test.ts: spike/src',
  'packages/core/test/corpus.ts: packages/core/src',
  'packages/shared/src/docs.test.ts: docs/02-sdlc-pipeline-spec.md',
  'packages/shared/src/docs.test.ts: docs/03-adapter-contract.md',
  'packages/shared/src/docs.test.ts: docs/04-architecture.md',
  'packages/shared/src/docs.test.ts: docs/DECISIONS.md',
  'packages/shared/src/docs.test.ts: docs/GLOSSARY.md',
  'packages/shared/src/index.test.ts: packages/core/package.json',
  'packages/shared/src/index.test.ts: packages/shared/package.json',
  'packages/shared/src/project.test.ts: harness/harness.yaml',
  'packages/shared/src/project.test.ts: packages/core/src/adapters/adapters.ts',
  'packages/shared/src/project.test.ts: packages/core/src/backlog/project.ts',
  'packages/shared/src/project.test.ts: packages/shared/src/index.ts',
  'packages/shared/src/project.test.ts: spike/templates/harness/harness.yaml',
  'packages/shared/src/role.test.ts: harness/architecture.md',
  'packages/shared/src/role.test.ts: packages/core',
  'packages/shared/src/role.test.ts: packages/shared',
  'packages/shared/src/step-output.test.ts: spike/src/contracts.js',
  'packages/shared/test/corpus.ts: docs/decisions',
  'packages/shared/test/corpus.ts: harness/flows',
  'packages/shared/test/corpus.ts: harness/roles',
  'packages/shared/test/corpus.ts: packages/shared/src',
  'packages/shared/test/corpus.ts: spike/src/lint.js',
];

describe('Q-0073 — membership is decided from git, so the verdict does not move with the checkout', () => {
  afterAll(removeTempDirs);

  test('git\'s answer does not move when a working tree gains the directories the product creates', () => {
    // The two checkout states, built where nothing of the reader's own is touched: a repository
    // that has never run a flow, and the same one afterwards. `listing` is the function the guard
    // itself uses, pointed at a sandbox rather than reimplemented, so what passes here is what runs
    // above — and the sandbox is not a straw man, because the assertion below is over the real
    // repository's inventory, which holds nothing under either root whatever this checkout has done.
    const dir = tempDir('q0073-');
    git(dir, 'init', '-q', '-b', 'main');
    write(path.join(dir, '.gitignore'), '.harness/\n.quorum/\nnode_modules/\n');
    write(path.join(dir, 'src/constants.ts'), 'export const ROOT = \'.harness/worktrees\';\n');
    commitAll(dir, 'init');
    const clean = listing(dir);
    expect(clean, 'the sandbox tracks nothing — this test proves nothing over it').toContain('src/constants.ts');

    for (const entry of [...AFTER_A_FLOW, 'node_modules/.bin/turbo']) write(path.join(dir, entry), '{}\n');
    expect(listing(dir), 'git reports the same set in both states, which is what makes the verdict stable').toEqual(clean);

    for (const root of ['.harness/worktrees', '.quorum/runs', 'node_modules/.bin/turbo']) {
      expect(INVENTORY.holds(root), `${root} is in this repository's inventory`).toBe(false);
    }
  });

  test('the same sources classify identically under two inventories, occurrence for occurrence', () => {
    // Clause B over both suites' real sources, run once per inventory and compared as lists rather
    // than as a pass or a fail: two runs could otherwise agree by having skipped the same subject.
    // The stray pair is what an untracked working tree can add to the inventory — a file git does
    // not ignore, which turbo would hash and which nothing names.
    const clean = inventoryOf(listing());
    const withStrays = inventoryOf([...listing(), 'docs/zz-scratch.md', 'packages/core/src/zz-scratch.ts']);
    for (const { taskId, directory } of SUITES) {
      expect(undeclaredPaths(taskId, directory, withStrays)).toEqual(undeclaredPaths(taskId, directory, clean));
      expect(undeclaredPaths(taskId, directory, clean)).toEqual([]);
    }
  });

  test('the clause has a subject — a working-tree inventory reports what a developer\'s machine did', () => {
    // The difference the fix removes, modelled rather than staged, so it is the same here, in an
    // integrate worktree and on CI — the two checkout shapes that were structurally blind to it. An
    // inventory carrying what the working tree holds under the two ignored roots reports six
    // occurrences in four files, which is the list that stood on `main` while implement and
    // integrate both reported green (Q-0072); CI never ran that revision.
    const asWorkingTree = inventoryOf([...listing(), ...AFTER_A_FLOW]);
    const asDirectory = (literal: string): string => `${literal} (a directory, and no audited walk covers it)`;
    expect(undeclaredPaths('@quorum/shared#test', 'packages/shared', asWorkingTree).sort()).toEqual([
      `packages/shared/src/constants.test.ts: ${asDirectory('.harness/worktrees')}`,
      `packages/shared/src/constants.test.ts: ${asDirectory('.quorum/runs')}`,
      `packages/shared/src/constants.ts: ${asDirectory('.harness/worktrees')}`,
      `packages/shared/src/constants.ts: ${asDirectory('.quorum/runs')}`,
    ]);
    expect(undeclaredPaths('@quorum/core#test', 'packages/core', asWorkingTree).sort()).toEqual([
      `packages/core/src/fanout/fanout.source.test.ts: ${asDirectory('.harness/worktrees')}`,
      `packages/core/src/git/git.source.test.ts: ${asDirectory('.harness/worktrees')}`,
    ]);
  });

  test('and nothing is decided by the working tree in either direction', () => {
    // Both halves of the same statement, and between them they fail the moment anything here
    // consults the filesystem again. A sparse checkout can track a file it has not materialised
    // (OQ-2): that literal is still collected, which asks more of the declaration rather than less.
    const sparse = inventoryOf(['docs/zz-tracked-but-absent.md']);
    expect(pathLiterals('const f = \'docs/zz-tracked-but-absent.md\';', sparse)).toEqual(['docs/zz-tracked-but-absent.md']);
    // The other direction is the defect itself: on a machine that has run a flow both of these
    // name a real directory, and neither is a repository path.
    expect(pathLiterals('const a = \'.harness/worktrees\'; const b = \'.quorum/runs\';')).toEqual([]);
    expect(INVENTORY.isDirectory('.harness/worktrees')).toBe(false);
    expect(INVENTORY.isDirectory('.quorum/runs')).toBe(false);
  });

  test('every category the filter excludes today is still excluded, each on its own', () => {
    // A rule that had started promoting every string with a separator in it fails here, and each
    // category is asserted separately: a demonstration that the filter fires proves the filter
    // fires, not that each of its cases does (Q-0071). All five are shapes the corpus really holds
    // — 270 of the 307 distinct literals reaching this decision are one of them.
    expect(pathLiterals('import { parse } from \'./adapters.js\';'), 'an import specifier').toEqual([]);
    expect(pathLiterals('errors.push(\'- flow needs consumes/produces\');'), 'a lint message').toEqual([]);
    expect(pathLiterals('const head = \'#!/bin/sh\';'), 'a shell fragment').toEqual([]);
    expect(pathLiterals('const argv = \'--add-dir /tmp/a dir\';'), 'an argument carrying a temporary path').toEqual([]);
    expect(pathLiterals('const note = \'the writer/reviewer rule\';'), 'prose').toEqual([]);
  });

  test('and a tracked file and a tracked directory are still collected, and told apart', () => {
    // The other direction of the same criterion: a rule that had stopped consulting the inventory
    // at all would collect nothing and pass every clause quietly, which is the failure this whole
    // file exists to close.
    expect(pathLiterals('const doc = \'docs/GLOSSARY.md\';')).toEqual(['docs/GLOSSARY.md']);
    expect(INVENTORY.isDirectory('docs/GLOSSARY.md'), 'a tracked file is not a directory').toBe(false);
    expect(pathLiterals('const dir = \'harness/flows\';')).toEqual(['harness/flows']);
    expect(INVENTORY.isDirectory('harness/flows'), 'a directory git tracks below is one').toBe(true);
  });

  test('the collected set has not contracted, occurrence by occurrence', () => {
    // Every occurrence in the baseline is still collected. Identities and not totals, because a
    // count compares the wrong thing: 60 >= 60 holds just as well when one literal has been dropped
    // and another added, and a literal that stops being collected is the classifier losing its
    // subject — the failure this file exists to close. Additions are allowed by construction, since
    // membership is only checked one way.
    const collected = new Set(SUITES.flatMap(({ directory }) =>
      scanFiles(directory).flatMap(([file, text]) => pathLiterals(text).map((literal) => `${file}: ${literal}`))));
    expect(COLLECTED_BASELINE.filter((entry) => !collected.has(entry)),
      'these baseline occurrences are no longer collected').toEqual([]);
    // And the baseline itself has not been trimmed to make that pass — the arithmetic AC-5 states,
    // asserted over the register rather than over the scan.
    expect(COLLECTED_BASELINE.length, 'per-file-distinct occurrences in the baseline').toBe(66);
    expect(new Set(COLLECTED_BASELINE.map((entry) => entry.split(': ')[1])).size,
      'distinct literals in the baseline').toBe(40);
    // And the nine the classifier calls directories, which is the class the defect lived in: a
    // checkout that had run a flow made it eleven.
    for (const directory of ['docs/decisions', 'harness/flows', 'harness/roles', 'packages/core',
      'packages/core/src', 'packages/shared', 'packages/shared/src', 'spike/src',
      'spike/templates/harness/flows']) {
      expect(INVENTORY.isDirectory(directory), `${directory} is no longer classified as a directory`).toBe(true);
    }
  });

  test('the two product path constants are closed by the mechanism, not by the register', () => {
    // They were entered in NOT_READ by hand after Q-0072's gate, which closed those two and left
    // the class open. That register is for a path deliberately named and never opened; it was never
    // the instrument for deciding whether a literal is a path at all.
    expect('.harness/worktrees' in NOT_READ).toBe(false);
    expect('.quorum/runs' in NOT_READ).toBe(false);
    const named = scanFiles('packages/shared').filter(([file]) => file.endsWith('/constants.ts'));
    expect(named.length, 'the constants module is not in the scan — this test proves nothing').toBe(1);
    expect(named[0][1], 'the constant no longer names the directory').toContain('.harness/worktrees');
    expect(pathLiterals(named[0][1])).not.toContain('.harness/worktrees');
    expect(pathLiterals(named[0][1])).not.toContain('.quorum/runs');
  });

  test('no register entry can go dead unnoticed', () => {
    // A key the classifier can no longer see excuses nothing, and it goes quiet rather than loud —
    // a check that has stopped having a subject. node_modules/.bin/turbo was exactly that under
    // this rule, which is why it is not in the register any more.
    const dead = Object.keys(NOT_READ).filter((key) => pathLiterals(`'${key}'`).length === 0);
    expect(dead, 'these NOT_READ keys are no longer paths the scan would collect').toEqual([]);
  });

  test('and the installed toolchain needs no entry, because git ignores it', () => {
    // Its treatment, asserted rather than left implicit in an absence: the binary is real, it is
    // read, and it is unhashable, so no declaration could cover it and no register entry should
    // imply one is owed. What stands in for both is reported()'s refusal to run without it, which
    // is loud, is unchanged, and is where its absence has always been caught.
    expect('node_modules/.bin/turbo' in NOT_READ).toBe(false);
    expect(INVENTORY.holds('node_modules/.bin/turbo'), 'git ignores node_modules').toBe(false);
    expect(pathLiterals(repoFile('packages/core/src/test-command.test.ts'))).not.toContain('node_modules/.bin/turbo');
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

/** A real file's computed reads, with both its route and its reader imports resolved per file. */
const readsIn = (file: string, text: string): ReadSite[] =>
  readSites(text, routeImports(file, text).bindings, readImports(file, text).bindings);

describe('AC-7 clause C4 — every computed read names where its base came from', () => {
  test('every base a read is rooted at is registered with where it comes from', () => {
    const unregistered = [...new Set(scanned().flatMap(([file, text]) =>
      readsIn(file, text).filter((site) => READ_BASES[file]?.[site.base] === undefined)
        .map((site) => `${file}: ${site.base}`)))];
    expect(unregistered).toEqual([]);
  });

  test('and the register holds no entry for a base that has gone', () => {
    const live = new Set(scanned().flatMap(([file, text]) => readsIn(file, text).map((site) => `${file}: ${site.base}`)));
    const stale = Object.entries(READ_BASES).flatMap(([file, bases]) =>
      Object.keys(bases).filter((base) => !live.has(`${file}: ${base}`)).map((base) => `${file}: ${base}`));
    expect(stale).toEqual([]);
  });

  test('the scan still finds the reads it is looking at', () => {
    // The positive control, first for the same reason as C1's: every failure mode of the blanking
    // hides sites rather than inventing them, so a clause that had stopped seeing its subject would
    // report success. `shared` contributing nothing is a fact rather than an omission — its suite
    // reaches the filesystem only through the corpus routes, so C1 governs all of it.
    const sites = scanned().flatMap(([file, text]) => readsIn(file, text));
    expect(sites.length, 'the scan sees almost no computed read — the blanking has eaten its subject').toBeGreaterThan(90);
    // Coarse on purpose: the failure it guards against is the alternation collapsing to one name,
    // not the corpus happening to use three APIs rather than four.
    expect(new Set(sites.map((site) => site.api)).size, 'one API is doing all the work — the alternation is broken')
      .toBeGreaterThan(1);
  });

  test('every import of a read module is one this scan can follow', () => {
    // The fail-closed half, and C1's own test one clause over. A re-export, a dynamic import, a
    // `require` or a clause this scan cannot parse each yields a reader under a name the scan below
    // would not look for, so each is reported here rather than passing as an absence of sites.
    expect(scanned().flatMap(([file, text]) => readImports(file, text).problems)).toEqual([]);
  });

  test('the clause has a subject — a read API imported under an alias is reported', () => {
    // The review finding of iteration 4, verbatim, and the reason reader bindings are resolved per
    // file: C1 had learnt this two iterations earlier and C4, written afterwards, matched raw API
    // names, so an aliased read walked out of the package with nothing to say about it. Isolated —
    // the fixture takes no route, derives no root, and its only escaping literal would be a module
    // specifier, which is not a read.
    const file = 'packages/core/src/rogue.test.ts';
    const fixture = 'import { realpathSync as canonical, readFileSync as slurp } from \'node:fs\';\n'
      + 'const root = path.dirname(path.dirname(canonical(\'.\')));\n'
      + 'const text = slurp(path.join(root, \'docs\', \'GLOSSARY.md\'), \'utf8\');\n';
    const { bindings, problems } = readImports(file, fixture);
    expect(problems).toEqual([]);
    expect(bindings).toEqual([{ local: 'canonical', api: 'realpathSync' }, { local: 'slurp', api: 'readFileSync' }]);
    expect(readSites(fixture, IDENTITY, bindings).map((site) => `${site.api} → ${site.base}`))
      .toEqual(['realpathSync → \'.\'', 'readFileSync → root']);
    expect(readSites(fixture, IDENTITY), 'matching the API\'s own name is exactly what this bypass evades').toEqual([]);
    expect(derivationSites(fixture), 'C2 names neither realpathSync nor path.dirname').toEqual([]);
    expect(routeImports(file, fixture).bindings).toEqual([]);
    expect(routeSites(fixture, IDENTITY)).toEqual([]);
    expect(escapingLiterals(fixture)).toEqual([]);
    expect(pathLiterals(fixture), 'the path is assembled from pieces clause B never sees whole').toEqual([]);
  });

  test('and every unfollowable read-module import form is reported rather than passed over', () => {
    // Each fixture evades the resolution a different way, and each is checked on its own — a
    // demonstration that the clause fires proves the clause fires, not that each of its cases does
    // (Q-0071). The two accepted forms are here for the same reason: a check that refused every
    // import would report the whole corpus and teach the next reader to widen it.
    const file = 'packages/core/src/rogue.test.ts';
    const problems = (fixture: string): string[] => readImports(file, fixture).problems;
    expect(problems('export { readFileSync } from \'node:fs\';\n')[0]).toContain('re-exports');
    expect(problems('const fs = await import(\'node:fs\');\n')[0]).toContain('dynamically');
    expect(problems('const fs = require(\'node:fs\');\n')[0]).toContain('requires');
    expect(problems('import fs, from \'node:fs\';\n')[0]).toContain('cannot read');
    expect(problems('import { readFileSync } from \'node:fs\';\nconst alias = readFileSync;\n')[0]).toContain('as a value');
    expect(problems('import fs from \'node:fs\';\nconst alias = fs.readFileSync;\n')[0]).toContain('as a value');
    expect(problems('import fs from \'node:fs\';\nfs.readFileSync(name);\n'), 'a default binding is followable here').toEqual([]);
    expect(problems('import * as fs from \'node:fs\';\nfs.readFileSync(name);\n'), 'and so is a namespace').toEqual([]);
    expect(problems('import { parse } from \'yaml\';\n'), 'a module that is not a read module').toEqual([]);
  });

  test('and a whole-module binding is followed under whatever name it was bound to', () => {
    // The half a raw-name match already covered, asserted rather than assumed, because it is what
    // lets `readImports` accept the two forms C1 refuses: a read reached through a member access is
    // reached under an API name, so nothing is resolved away by accepting the object it hangs off.
    const file = 'packages/core/src/rogue.test.ts';
    const fixture = 'import * as node from \'node:fs\';\nconst text = node.readFileSync(path.join(root, wanted));\n';
    expect(readImports(file, fixture).bindings).toEqual([{ local: 'node', api: null }]);
    expect(readsIn(file, fixture).map((site) => `${site.api} → ${site.base}`)).toEqual(['readFileSync → root']);
  });

  test('the clause has a subject — iteration 3\'s bypass is reported, and no earlier clause sees it', () => {
    // `requirements/errata.md` E-1, item 4: the exact shape review round 3 named. It takes no
    // route, so C1 is silent; `realpathSync` is in no root-derivation list, so C2 is silent; every
    // literal in it is package-relative, so C3 is silent and clause B collects nothing outside the
    // package. Only the read-API anchor has anything to say, which is the whole point of adding it
    // rather than extending C2's list of primitives for a fourth time.
    const file = 'packages/core/src/rogue.test.ts';
    const fixture = 'const root = path.dirname(path.dirname(fs.realpathSync(\'.\')));\n'
      + 'const text = fs.readFileSync(path.join(root, wanted), \'utf8\');\n';
    expect(readSites(fixture, IDENTITY).map((site) => `${site.api} → ${site.base}`))
      .toEqual(['realpathSync → \'.\'', 'readFileSync → root']);
    expect(derivationSites(fixture), 'C2 does not name realpathSync, and adding it was refused as the remedy').toEqual([]);
    expect(routeImports(file, fixture).bindings).toEqual([]);
    expect(routeSites(fixture, IDENTITY)).toEqual([]);
    expect(escapingLiterals(fixture)).toEqual([]);
    expect(pathLiterals(fixture)).toEqual([]);
  });

  test('and a base that is a literal clause B DROPS is still reported', () => {
    // Why the literal exemption is "a literal clause B collects" rather than "a literal". A bare
    // `'.'` carries no separator, so clause B never sees it; exempting it would have handed the
    // fixture above a root for nothing, one call before the read that uses it.
    expect(readSites('fs.realpathSync(\'.\');\n', IDENTITY).map((site) => site.base)).toEqual(['\'.\'']);
    expect(readSites('fs.readFileSync(\'/etc/passwd\');\n', IDENTITY).map((site) => site.base)).toEqual(['\'/etc/passwd\'']);
    expect(readSites('fs.readFileSync(\'docs/GLOSSARY.md\');\n', IDENTITY), 'this one clause B does collect').toEqual([]);
  });

  test('and a read rooted at a route is left to clause C1', () => {
    // The hand-off, asserted rather than assumed: C1 already requires this path to be a literal or
    // registered, so reporting it here too would duplicate an entry instead of adding a check.
    expect(readSites('fs.readFileSync(path.join(repoRoot, relative), \'utf8\');\n', IDENTITY)).toEqual([]);
    expect(routeSites('fs.readFileSync(path.join(repoRoot, relative), \'utf8\');\n', IDENTITY).map(siteKey))
      .toEqual(['repoRoot → relative']);
    // ...and only under a name the file actually imported, which is the iteration-2 lesson applied
    // to this clause: with no binding, the same line is a computed read this register must answer.
    expect(readSites('fs.readFileSync(path.join(repoRoot, relative), \'utf8\');\n', []).map((site) => site.base))
      .toEqual(['repoRoot']);
  });

  test('and a read named in prose or quoted as an example is not read as one', () => {
    expect(readSites('// somebody adds fs.readFileSync(path.join(root, x)) one day\n', IDENTITY)).toEqual([]);
    expect(readSites('/** Prose about readFileSync(root) and existsSync(dir). */\n', IDENTITY)).toEqual([]);
    expect(readSites('const example = "fs.readFileSync(computed)";\n', IDENTITY)).toEqual([]);
  });
});
