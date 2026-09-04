/**
 * Q-0095 — one ticket walked from `quorum init` to `stage: green` through the built binary.
 *
 * **The translated chain half of `smoke.js`**: `init`, `lint`, `ticket new`, the wrong-stage refusal,
 * `requirements`, `solutioning`, `qa-red`, `development`, and the four commands that ride along —
 * `lint`, `board`, `adapters`, `validate`. The failure, gate and rollback half is **Q-0101**'s;
 * `packages/core/src/spike-parity.test.ts` records both on the one row.
 *
 * **Every invocation is a separate operating-system process, and that is the point rather than a
 * preference.** The nine sibling suites drive their command in process through `test/invoke.ts`.
 * This one cannot: `packages/core/src/adapters/mock.ts:16–20` states that its call counter is
 * module-scoped with no reset export — keyed `role:task` or `role:kind` at `:94`, so scoped to
 * neither the ticket nor the run nor the project — and that adding a reset would be a charter §2
 * behaviour change. The three convergent behaviours below (AC-5) all depend on that counter starting
 * at zero for their key and advancing exactly once, which the forcing switches destroy and a second
 * in-process scenario would consume. A fresh process per invocation is what the spike gets for free
 * and what this suite has to arrange.
 *
 * **It spawns a copy it built itself, never `packages/cli/dist`.** That is the first of the two safe
 * shapes Q-0098 AC-15(c) names — `build.test.ts` removes the real emit twice, and a second file
 * spawning that path would intermittently meet a directory that had just gone. The copier is
 * `../test/workspace.ts`, shared with that file rather than written twice.
 *
 * **It runs after the spike is deleted**, which is the property the cutover turns on: nothing here
 * reads, imports or spawns anything under that tree, and AC-3 below asserts it over this file's own
 * source rather than leaving it to be discovered on the day.
 *
 * **Nothing the shell sets reaches a spawned process.** Each invocation gets this process's
 * environment minus {@link STEERING} — every variable the product's own code reads, derived from the
 * four files that read one — plus whatever that call declares for itself. An inherited
 * `MOCK_ALWAYS_PASS` forces the verdict the three convergent behaviours below exist to observe, so
 * the suite would report a chain that never converged as one that had; AC-9 asks that the verdict be
 * a property of the commit, and an inherited switch is a property of the shell.
 *
 * **POSIX only, and it refuses rather than skipping.** The fixture rewrites `commands.install` and
 * `commands.test` to `sh` chains exactly as the spike does, so on a platform without `sh` this suite
 * has no subject — and *"a check that skips its subject must not report success"* (2026-08-25). The
 * refusal is at module scope, so the file fails to collect and says why, instead of reporting a
 * green run of nothing. Q-0098 registered the same class for its own `chmod +x`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { buildIn, disposeIsolated, isolate, PACKAGE, read, WORKSPACE } from '../test/workspace.js';

if (process.platform === 'win32') {
  // A refusal and not a skip: the file fails to collect and names the reason, where a skipped block
  // would report a green run of a chain nothing walked.
  throw new Error(
    `the mock end-to-end fixture drives sh-based commands.install/commands.test, which ${process.platform} `
    + 'does not provide — this suite refuses rather than reporting a pass over a chain it never ran',
  );
}

/** This file's own text, which three of the criteria below are assertions about. */
const SOURCE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');

/**
 * How long one spawned invocation may take before it is killed.
 *
 * Measured rather than chosen by analogy (AC-11): the slowest invocation of the chain is
 * `development`, at 0.7 s on this machine — two fan-out waves, a scoped retry, three worktrees and
 * two integrations. Sixty seconds is roughly eighty times that, which is headroom for a loaded CI
 * runner and still short enough that a hung run fails the suite rather than the job's own limit.
 */
const SPAWN_TIMEOUT_MS = 60_000;

/**
 * How long the whole fixture may take to build and walk.
 *
 * Measured: 0.1 s to copy the workspace, 2.1 s for the forced build of the three emitting packages,
 * and 2.2 s for the twelve invocations — 4.4 s in total, and 4.8 s to 5.9 s as Vitest measures the
 * whole file. Ninety seconds is fifteen times the upper figure, and what it has to absorb is a cold
 * `tsc` on a loaded runner, which is the only part of this that is not milliseconds.
 */
const FIXTURE_TIMEOUT_MS = 90_000;

/** The ticket the fixture walks, and the owner it supplies rather than inheriting (AC-9). */
const TICKET = 'T-0001';
const OWNER = 'quorum-fixture';
const TITLE = 'Subscription downgrade mid-cycle';

/** The branch the fixture's repository is created on, set explicitly so no git default decides it. */
const BASE_BRANCH = 'main';

/** ANSI stripped, as every assertion below reads the output. */
const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

/** Everything one spawned invocation of the binary produced. */
interface Invocation {
  readonly argv: readonly string[];
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /**
   * Which of {@link STEERING} the spawned process actually carried, and with what value.
   *
   * Recorded rather than trusted: the sanitiser is a line of code, and AC-9 is a claim about what
   * each of the twelve invocations was handed. This is what lets a test assert the claim over the
   * environments the run really used.
   */
  readonly steering: Readonly<Record<string, string>>;
}

/** Both streams together, which is where several of the spike's assertions look. */
const output = (invocation: Invocation): string => invocation.stdout + invocation.stderr;

/** What an absent recording reads as, so a missing label fails on its content rather than on a type. */
const EMPTY: Invocation = { argv: [], status: null, stdout: '', stderr: '', steering: {} };

/** What the fixture recorded on its way from `init` to `green`. */
interface Chain {
  /** The isolated workspace copy the binary was built in. */
  readonly root: string;
  /** The artifact this suite spawns — inside {@link Chain.root}, never this package's own emit. */
  readonly bin: string;
  /** The fixture repository every invocation runs in. */
  readonly repo: string;
  /** The ticket's folder under `backlog/`, as the binary named it. */
  readonly folder: string;
  /** Each invocation, by the label this file gives it. */
  readonly ran: Record<string, Invocation>;
  /** `stage:` as read back from `ticket.md` after each command that could move it. */
  readonly stages: readonly string[];
  /** What git said about the contracts worktree the moment the solutioning run finished. */
  readonly afterSolutioning: {
    readonly branch: string;
    readonly worktreeDirectory: boolean;
    readonly worktreeList: string;
  };
  /**
   * `git status --porcelain` at the two moments AC-6's working-tree claim is about.
   *
   * **Two readings and not one.** The solutioning-time reading is where the spike takes its
   * (`smoke.js:79`), and on its own it is silent about `qa-red` and `development` — the two flows
   * that run after it, which between them cut further worktrees, integrate, and write both
   * developers' source. AC-6 says *end to end*, so the reading is repeated once the chain has
   * reached green and both are asserted, which additionally catches pollution one flow introduces
   * and a later one clears.
   */
  readonly porcelain: {
    readonly afterSolutioning: string;
    readonly atGreen: string;
  };
}

let chain: Chain;

/** Fixture repositories this file created, removed with the workspace copies. */
const repositories: string[] = [];

afterAll(() => {
  for (const directory of repositories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  disposeIsolated();
});

/**
 * `git` in the fixture repository.
 *
 * Named `git` and called with its options as literals so that
 * `packages/core/src/git-identity.test.ts` can see it: that guard is anchored on a call to a helper
 * of this name and reads the literals at the **call site**, so an identity injected in here would be
 * invisible to it and the one commit below would read as a bare commit-creating call.
 */
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * The two variables each vendor adapter refuses, read out of the adapter that refuses them.
 *
 * **Derived rather than written down, and not only for the usual reason.**
 * `frame.source.test.ts`'s AC-12 asserts that exactly one file in this package matches any of its
 * BYOS spellings, and that the self-exclusion is the only one — so a suite that typed the names
 * would turn the guard proving this package has no key path at all red, or would have to grow the
 * exclusion into a filter. Reading the `check()` guards keeps both properties, and is stronger than
 * a literal: a renamed variable moves this assertion with it.
 *
 * The count is asserted by the caller rather than assumed, so a third read added to either adapter
 * is a red test somebody looks at rather than a silently different fixture.
 */
const refusedBy = (vendor: string): string[] =>
  [...read(WORKSPACE, 'packages', 'core', 'src', 'adapters', `${vendor}.ts`)
    .matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1] ?? '');

/**
 * Every environment variable the product's own code reads — the whole of what a shell could use to
 * steer a run of it.
 *
 * **Derived, for the reason {@link refusedBy} is derived.** A typed list goes on excusing a name
 * nothing reads and misses the one added next week, and this list's job is to be complete: the mock
 * has nine switches, two of which force a verdict outright, and `Backlog.create` defaults an owner
 * from the account. Reading the four files that read one moves this list when they move.
 *
 * **Two clauses, because the mock reaches two of its switches through a variable.**
 * `numericSwitch` (`packages/core/src/adapters/mock.ts:156`) takes the name as an argument, so the
 * `process.env.X` clause cannot see `MOCK_CACHED_INPUT_TOKENS` or `MOCK_CACHE_WRITE_INPUT_TOKENS`;
 * every switch is nevertheless spelled at its call site, which is what the second clause anchors on.
 * Both are pinned below, so a tenth switch is a red test somebody reads rather than a quietly
 * smaller sanitiser.
 */
const STEERING: readonly string[] = (() => {
  const core = (...relative: string[]): string => read(WORKSPACE, 'packages', 'core', 'src', ...relative);
  const mock = core('adapters', 'mock.ts');
  const named = [...mock.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1] ?? '');
  const owner = [...core('backlog', 'backlog.ts').matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1] ?? '');
  return [...new Set([
    ...refusedBy('claude'), ...refusedBy('codex'), ...named, ...owner, ...(mock.match(/\bMOCK_[A-Z0-9_]+\b/g) ?? []),
  ])].sort();
})();

/**
 * The environment one spawned invocation gets: `base`, minus every name in {@link STEERING}, plus
 * what the call itself declares.
 *
 * A deny-list rather than an allow-list, deliberately: `GIT_CONFIG_GLOBAL` and its siblings must
 * reach the child, because `pnpm sweep:git-identity` sets them to prove both suites pass with no
 * resolvable identity, and a child that could not see them would be exempt from the one check AC-9
 * names as its own.
 *
 * `base` is a parameter rather than `process.env` read in here, so the removal can be demonstrated
 * over an environment a test composed — showing the clause fires, rather than showing that this
 * machine happens to set none of them (*"A check is not established by reading it"*, 2026-08-29).
 */
const sanitised = (base: NodeJS.ProcessEnv, overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const name of STEERING) delete env[name];
  return { ...env, ...overrides };
};

/**
 * The value the fixture gives a variable it sets for itself.
 *
 * One constant rather than a literal at each end, so the invocation and the assertion about what it
 * was handed cannot drift into agreeing about a variable neither of them set.
 */
const SET_BY_THE_FIXTURE = 'set-by-the-fixture';

beforeAll(() => {
  const root = isolate();
  buildIn(root, '--force');
  const declared = (JSON.parse(read(PACKAGE, 'package.json')) as { bin: Record<string, string> }).bin.quorum;
  const bin = path.join(root, 'packages', 'cli', declared);
  if (!fs.existsSync(bin)) throw new Error(`the isolated build wrote no ${declared} — there is nothing to spawn`);

  // Realpathed: on macOS `os.tmpdir()` is a symlink and `loadProject` resolves what it is given, so
  // an unresolved fixture path would make a path assertion fail for a reason that is a property of
  // the machine rather than of the commit.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-e2e-')));
  repositories.push(repo);

  const ran: Record<string, Invocation> = {};
  const invoke = (label: string, argv: readonly string[], overrides: NodeJS.ProcessEnv = {}): Invocation => {
    const env = sanitised(process.env, overrides);
    const result = spawnSync(process.execPath, [bin, ...argv], {
      cwd: repo, encoding: 'utf8', env, timeout: SPAWN_TIMEOUT_MS,
    });
    const invocation: Invocation = {
      argv, status: result.status, stdout: plain(result.stdout ?? ''), stderr: plain(result.stderr ?? ''),
      steering: Object.fromEntries(STEERING.flatMap((name) => (env[name] === undefined ? [] : [[name, env[name]]]))),
    };
    ran[label] = invocation;
    return invocation;
  };
  /**
   * As {@link invoke}, but for the steps the next one genuinely depends on: a non-zero status stops
   * the fixture and names the step and what it said.
   *
   * **This is where "exits 0" is asserted for those steps, and it is asserted once.** A test
   * restating it would be an assertion that could not fail — the fixture would have thrown first —
   * which is the Q-0050 class this repository keeps finding. The tests below therefore claim what
   * each step *produced*; the status is claimed here. A step whose failure does not stop the chain
   * — `lint`, `board`, `adapters`, `validate`, and the wrong-stage refusal — goes through
   * {@link invoke} instead, so its status stays a claim a test can make and can lose.
   *
   * When it throws, Vitest reports the file as **FAIL** and renders the tests it never reached as
   * skipped. Nothing reports success: the file's verdict is a failure and the process exits 1.
   */
  const mustPass = (label: string, argv: readonly string[], overrides: NodeJS.ProcessEnv = {}): Invocation => {
    const invocation = invoke(label, argv, overrides);
    if (invocation.status !== 0) {
      throw new Error(`${label} exited ${String(invocation.status)}; the chain cannot continue:\n${output(invocation)}`);
    }
    return invocation;
  };

  git(repo, 'init', '-q', '-b', BASE_BRANCH);
  git(repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '--allow-empty', '-m', 'init');

  mustPass('init', ['init']);

  // The fixture repository is not a node project, so both commands are pointed at something it can
  // run. The install command records the directory it ran in, which is what lets AC-6 prove it ran
  // in the integration worktree — and the marker is written OUTSIDE that worktree, two levels up,
  // because a file written inside leaves it permanently dirty, the run then keeps it (Q-0062), and
  // the suite would never exercise removal on the one worktree every code-writing flow makes.
  const config = path.join(repo, 'harness', 'harness.yaml');
  fs.writeFileSync(config, read(config)
    .replace(/install: npm install.*/, 'install: sh -c "pwd > ../../install-cwd"')
    .replace(/test: npm test.*/, 'test: sh tests/check.sh'));

  invoke('lint', ['lint']);
  mustPass('ticket', ['ticket', 'new', TITLE, '--intent', 'Clinics can downgrade mid-cycle. Define proration.', '--owner', OWNER]);

  const folder = fs.readdirSync(path.join(repo, 'backlog'))[0] ?? '';
  const ticketFile = (): string => read(repo, 'backlog', folder, 'ticket.md');
  const stages: string[] = [];
  const stage = (): string => {
    const found = /^stage: (\S+)$/m.exec(ticketFile())?.[1] ?? 'unreadable';
    stages.push(found);
    return found;
  };

  stage();
  // A flow whose `consumes` does not match the ticket's stage is refused, and the refusal is
  // recorded rather than thrown: its non-zero status is what AC-4 claims.
  invoke('wrong-stage', ['run', 'solutioning', TICKET, '--adapter', 'mock', '--auto']);

  mustPass('requirements', ['run', 'requirements', TICKET, '--adapter', 'mock', '--auto']);
  stage();

  mustPass('solutioning', ['run', 'solutioning', TICKET, '--adapter', 'mock', '--auto']);
  stage();
  const afterSolutioning = {
    branch: git(repo, 'branch', '--list', `harness/${TICKET}/contracts`).trim(),
    worktreeDirectory: fs.existsSync(path.join(repo, '.harness', 'worktrees', `harness__${TICKET}__contracts`)),
    worktreeList: git(repo, 'worktree', 'list'),
  };
  const solutioningPorcelain = git(repo, 'status', '--porcelain');

  mustPass('qa-red', ['run', 'qa-red', TICKET, '--adapter', 'mock', '--auto']);
  stage();

  mustPass('development', ['run', 'development', TICKET, '--adapter', 'mock', '--auto'], { MOCK_DEV_FLAKY: '1' });
  stage();
  // The second reading, and the one AC-6 calls end to end. Taken here rather than at the end of the
  // fixture: the `validate` block below writes a schema and two artifacts into the repository root,
  // and those are the test's files rather than the product's — a reading after them would have to
  // excuse three paths by name, which is how a working-tree check stops having a subject. What that
  // leaves outside it is `board`, `adapters` and `validate`, none of which runs a flow; AC-6's claim
  // is about what a run writes, and the last run has finished by this line.
  const greenPorcelain = git(repo, 'status', '--porcelain');

  invoke('board', ['board']);
  // The two vendors are refused before either CLI is probed, so this run's verdict does not depend
  // on which vendor CLIs the machine has (AC-9).
  const guarded = [...refusedBy('claude'), ...refusedBy('codex')];
  invoke('adapters', ['adapters'], Object.fromEntries(guarded.map((name) => [name, SET_BY_THE_FIXTURE])));

  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: { stage: { type: 'string', enum: ['draft', 'requirements'] } },
    required: ['stage'],
    additionalProperties: false,
  };
  fs.writeFileSync(path.join(repo, 'contract.schema.json'), JSON.stringify(schema));
  fs.writeFileSync(path.join(repo, 'conforming.json'), JSON.stringify({ stage: 'draft' }));
  fs.writeFileSync(path.join(repo, 'violating.json'), JSON.stringify({ stage: 'nonsense' }));
  invoke('validate-ok', ['validate', 'contract.schema.json', 'conforming.json']);
  invoke('validate-bad', ['validate', 'contract.schema.json', 'violating.json']);

  chain = {
    root, bin, repo, folder, ran, stages, afterSolutioning,
    porcelain: { afterSolutioning: solutioningPorcelain, atGreen: greenPorcelain },
  };
}, FIXTURE_TIMEOUT_MS);

/**
 * A sample assembled from pieces, so this file does not contain the text its own scans forbid.
 *
 * The alternative is a self-exclusion, which is what `frame.source.test.ts` had to grow and keeps
 * bounded by asserting it is the only one — here it would excuse a real import added later, which is
 * the whole of what AC-1 and AC-3 are about.
 */
const assembled = (...parts: string[]): string => parts.join('');

describe('AC-1 — every invocation is a separate process, and the reason is pinned where a change meets it', () => {
  test('the suite reaches the binary through neither the in-process helper nor a handler call', () => {
    expect(SOURCE, 'the in-process driver is imported, so the counter is shared').not.toMatch(/invoke\.js/);
    // Wider than the criterion's own words on purpose: a direct handler call needs no helper, and
    // this package's modules are all reached with a relative specifier, so forbidding the whole
    // shape is one clause where "no import of main, run, gate, …" would be a list to maintain.
    expect([...SOURCE.matchAll(/^import .* from '(\.[^']*)';$/gm)].map((match) => match[1]),
      'the suite imports a module of the product it is supposed to be spawning')
      .toStrictEqual(['../test/workspace.js']);
  });

  test('and the scan discriminates, rather than passing because the text happens to be absent', () => {
    const importing = assembled("import { invoke } from '../test/", "invoke", ".js';");
    expect(/invoke\.js/.test(importing), 'the clause cannot see an import of the in-process driver').toBe(true);
    const handler = assembled("import { run } from './", "run", ".js';");
    expect([...handler.matchAll(/^import .* from '(\.[^']*)';$/gm)].map((match) => match[1]))
      .toStrictEqual(['./run.js']);
  });

  test('the header states the measured cause and cites it rather than transcribing it', () => {
    // The engineering rules forbid copying a ticket body or a decision into a source file, so what
    // is required here is the pointer and the fact, not the argument.
    const header = SOURCE.slice(0, SOURCE.indexOf(' */'));
    // The range is the measured one. The merged requirement cites `:16–:22`, which reaches two
    // lines past the paragraph it is about — `:20` is its last line and `:22` belongs to the module's
    // own preservation note. Re-derived rather than transcribed.
    expect(header).toContain('packages/core/src/adapters/mock.ts:16–20');
    expect(header, 'the key spelling is what makes the counter shared across scenarios').toMatch(/role:task/);
    expect(header, 'a reset export is the thing that may not be added').toContain('charter §2');
  });
});

describe('AC-2 — the artifact is one the suite built, in a copy, and never this package\'s own emit', () => {
  test('the spawned target is under the temporary directory and is not the real emit', () => {
    expect(fs.realpathSync(chain.bin).startsWith(fs.realpathSync(os.tmpdir())),
      `${chain.bin} is not inside a temporary directory`).toBe(true);
    const declared = (JSON.parse(read(PACKAGE, 'package.json')) as { bin: Record<string, string> }).bin.quorum;
    expect(chain.bin, 'the suite spawns this package\'s own emit, which build.test.ts removes twice')
      .not.toBe(path.resolve(PACKAGE, declared));
    // Structural rather than observed: everything this suite executes and everything it writes is
    // outside this package, so there is no path by which removing the real emit could reach it.
    // The complementary proof — a full run with that directory deleted — is a mutation, recorded in
    // the implement report rather than asserted from inside the run it would be describing.
    for (const [what, target] of [
      ['artifact', chain.bin], ['workspace copy', chain.root], ['fixture', chain.repo],
    ] as const) {
      expect(path.relative(PACKAGE, target).startsWith('..'), `the ${what} is inside this package`).toBe(true);
    }
  });
});

describe('AC-3 — the suite runs after the spike is deleted, which is what the cutover turns on', () => {
  test('no path literal and no specifier names that tree', () => {
    // Two shapes, because a read can be written either way: a path with a separator in it, and a
    // bare segment handed to `path.join`. The register is named with a hyphen and is therefore not
    // a directory reference, which is why the first clause anchors on the separator.
    expect(SOURCE.match(/spike\//g) ?? [], 'a path under the spike tree is named').toStrictEqual([]);
    expect(SOURCE.match(/['"`]spike['"`]/g) ?? [], 'a bare path segment naming the spike tree').toStrictEqual([]);
  });

  test('and both clauses discriminate', () => {
    const asPath = assembled('const engine = read(root, ', "'", 'spi', "ke/src/engine.js'", ');');
    expect(/spike\//.test(asPath), 'a path under that tree passes the first clause').toBe(true);
    const asSegment = assembled('path.join(root, ', "'", 'spi', "ke'", ", 'test');");
    expect(/['"`]spike['"`]/.test(asSegment), 'a bare segment passes the second clause').toBe(true);
  });
});

describe('AC-4 — one ticket walks the chain, and each stage is read back from the file the binary wrote', () => {
  test('the five stage readings are the documented sequence, taken after each command in turn', () => {
    expect(chain.stages).toStrictEqual(['draft', 'requirements', 'solutioned', 'red', 'green']);
  });

  test('init scaffolds the two directories and says where, and ticket new names the folder it made', () => {
    // What each produced rather than the status each exited with: the status of a step the chain
    // depends on is asserted once, in `mustPass`, and a second copy here could not fail.
    expect(chain.ran.init?.stdout).toContain('harness/ and backlog/ created in');
    for (const directory of ['harness', 'backlog']) {
      expect(fs.existsSync(path.join(chain.repo, directory)), `${directory}/ was not scaffolded`).toBe(true);
    }
    expect(chain.ran.ticket?.stdout).toContain(`${TICKET} created at backlog/${chain.folder}`);
    expect(chain.ran.ticket?.stdout).toContain('(stage: draft)');
  });

  test('a flow whose consumes does not match the ticket\'s stage is refused', () => {
    const refusal = chain.ran['wrong-stage'];
    expect(refusal?.status, 'a flow ran against the wrong stage').not.toBe(0);
    expect(output(refusal ?? EMPTY))
      .toContain(`ticket ${TICKET} is at stage "draft", flow "solutioning" consumes "requirements"`);
  });

  test('the requirements run writes both candidates run-scoped, and the merged document beside them', () => {
    // The run-scoped paths rather than a glob: Q-0088 moved these files, and a glob would go on
    // passing if the scoping were reverted.
    const at = (relative: string): string => path.join(chain.repo, 'backlog', chain.folder, relative);
    expect(fs.existsSync(at('requirements/run-1/candidate-claude.md'))).toBe(true);
    expect(fs.existsSync(at('requirements/run-1/candidate-codex.md'))).toBe(true);
    expect(fs.existsSync(at('requirements/merged.md'))).toBe(true);
  });

  test('the solutioning run emits its solution and its tasks, and merges the contracts', () => {
    const at = (relative: string): string => path.join(chain.repo, 'backlog', chain.folder, relative);
    expect(fs.existsSync(at('solution/solution.md'))).toBe(true);
    expect(fs.existsSync(at('solution/tasks.yaml'))).toBe(true);
    expect(git(chain.repo, 'log', '--oneline', `harness/${TICKET}/integration`, '--', 'contracts').length)
      .toBeGreaterThan(0);
  });

  test('the qa-red run proves the suite red on the ticket branch', () => {
    expect(chain.ran['qa-red']?.stdout).toContain('red as expected');
  });

  test('and the integration branch ends holding contracts, tests and both implementations', () => {
    const tree = git(chain.repo, 'ls-tree', '-r', '--name-only', `harness/${TICKET}/integration`);
    for (const file of [`src/${TICKET}.1.ts`, `src/${TICKET}.2.ts`, 'tests/check.sh', 'contracts/ProrationService.ts']) {
      expect(tree, `${file} is not on the ticket branch`).toContain(file);
    }
  });
});

describe('AC-5 — the three convergent behaviours, which are what AC-1 exists for', () => {
  test('(a) the requirements backward edge runs head-of-product twice and persists its counter', () => {
    // The mock's first call per key returns the failing verdict and later calls the passing one, so
    // this is exactly the behaviour a shared counter or a forcing switch destroys.
    const stdout = chain.ran.requirements?.stdout ?? '';
    expect(stdout.match(/▸ head-of-product/g) ?? [], 'the loop did not turn exactly once').toHaveLength(2);
    expect(stdout).toContain('iteration 1/1 → goto head-of-product');
    expect(read(chain.repo, 'backlog', chain.folder, 'ticket.md')).toMatch(/head-of-product: 1/);
  });

  test('(b) the solutioning review loop bounces back to the architect exactly once', () => {
    expect((chain.ran.solutioning?.stdout ?? '').match(/iteration 1\/2 → goto architect/g) ?? [])
      .toHaveLength(1);
  });

  test('(c) a flaky developer fails the integration once and the fan-out re-runs scoped to it', () => {
    const stdout = chain.ran.development?.stdout ?? '';
    expect(stdout).toContain('2 task(s) in 2 wave(s)');
    expect(stdout).toContain('tests exit 1, expected pass');
    expect(stdout).toContain('scoped to failing tasks');
    expect(stdout).toContain('tests green');
  });
});

describe('AC-6 — worktrees, branches and the user\'s working tree, end to end', () => {
  test('the architect ran in its own worktree on its own branch, and the finished run gave it back', () => {
    expect(chain.ran.solutioning?.stdout ?? '',
      'the step did not say which worktree it cut, or on which branch')
      .toMatch(new RegExp(`architect: worktree .*\\(harness/${TICKET}/contracts\\)`));
    expect(chain.afterSolutioning.branch, 'the run did not keep the branch it proved').not.toBe('');
    expect(chain.afterSolutioning.worktreeDirectory, 'the worktree directory outlived the run').toBe(false);
    expect(chain.afterSolutioning.worktreeList, 'the registration outlived the directory')
      .not.toContain(`harness__${TICKET}__contracts`);
  });

  test('nothing outside backlog/ and harness/ appears in the user\'s working tree, at green as well as before it', () => {
    // Both readings, named rather than iterated over the object, so losing one is a failure instead
    // of a quietly shorter loop. The solutioning-time reading alone was silent about `qa-red` and
    // `development` — the two flows that run after it — while this test presented it as the
    // end-to-end result, which is the criterion's own word.
    const readings = [
      ['after solutioning', chain.porcelain.afterSolutioning],
      ['at green', chain.porcelain.atGreen],
    ] as const;
    for (const [when, porcelain] of readings) {
      // Each reading is asserted non-empty before it is filtered. An empty one gives the filter
      // nothing to remove, so the clause below would pass over a `git status` that had reported
      // nothing at all — and both readings are taken over a repository holding at least the
      // scaffold and the ticket folder, so empty is a failure rather than a clean tree.
      expect(porcelain.trim(), `the reading ${when} is empty, so it discriminates nothing`).not.toBe('');
      const dirty = porcelain.split('\n')
        .filter((line) => line.trim() !== '' && !line.includes('backlog') && !line.includes('harness/'));
      expect(dirty, `the run wrote into the user's working tree, ${when}`).toStrictEqual([]);
    }
    expect(fs.existsSync(path.join(chain.repo, 'src')),
      'the developers\' source landed in the working tree instead of on their branches').toBe(false);
  });

  test('and commands.install ran in the integration worktree before the tests', () => {
    // The evidence is the directory the install command reported as its own cwd, written outside
    // the worktree so that it survives the removal a finished run performs (Q-0062).
    const marker = read(chain.repo, '.harness', 'install-cwd').trim();
    expect(path.basename(marker)).toBe(`harness__${TICKET}__integration`);
  });
});

describe('AC-7 — the four commands that ride the chain rather than being its subject', () => {
  test('lint exits 0 over the shipped flow directory the fixture was scaffolded with', () => {
    // Not a second copy of Q-0091's claim: that suite proves the command, this proves it over the
    // directory `quorum init` actually wrote, at the point in the sequence a first-time adopter
    // reaches it.
    //
    // **The report is the falsifiable half and the status is not**, which is worth saying rather
    // than leaving for a reader to find. `run.ts` lints the whole directory before it loads a flow,
    // so a scaffold that did not lint would stop the chain at the first `run` and no test here would
    // be reached — the status below can only ever be 0 by the time it is read. What a green `lint`
    // could still get wrong is *what it examined*, so the flow list is derived from the directory
    // the scaffold wrote and every entry is required to appear with its tick.
    expect(chain.ran.lint?.status).toBe(0);
    const scaffolded = fs.readdirSync(path.join(chain.repo, 'harness', 'flows')).sort();
    expect(scaffolded.length, 'the scaffold wrote no flow, so the loop below is vacuous').toBeGreaterThan(0);
    for (const flow of scaffolded) {
      expect(chain.ran.lint?.stdout, `lint reported nothing for ${flow}`).toContain(`✓ ${flow}`);
    }
  });

  test('board lists the ticket, with the owner the fixture supplied', () => {
    expect(chain.ran.board?.stdout).toContain(TICKET);
    expect(chain.ran.board?.stdout).toContain(TITLE);
    expect(chain.ran.board?.stdout).toContain(`owner=${OWNER}`);
  });

  test('adapters refuses both vendors before either CLI is probed', () => {
    const claude = refusedBy('claude');
    const codex = refusedBy('codex');
    // Asserted rather than assumed, so a third read added to either adapter is a red test somebody
    // looks at rather than a fixture that quietly sets a different set of variables.
    expect(claude, 'the claude adapter no longer guards exactly one variable').toHaveLength(1);
    expect(codex, 'the codex adapter no longer guards exactly two').toHaveLength(2);

    const lines = (chain.ran.adapters?.stdout ?? '').split('\n');
    for (const [vendor, guarded] of [['claude', claude], ['codex', codex]] as const) {
      const line = lines.find((candidate) => candidate.includes(`${vendor}:`)) ?? '';
      expect(line, `${vendor} was not refused`).toBe(`✗ ${vendor}: ${guarded.join('/')} is set — unset it; Harness runs on subscription OAuth only`);
    }
    // The refusal came before the probe, which is what makes this deterministic: with the variables
    // set, neither vendor is reported present whatever this machine has installed. Q-0068's wording
    // above is preserved and not repaired here (ground rule 3).
    expect(lines.filter((line) => line.startsWith('✓')), 'a vendor CLI was probed anyway').toStrictEqual([]);
  });

  test('validate exits 0 on a conforming artifact and 1 on one that violates its schema', () => {
    expect(chain.ran['validate-ok']?.status, 'a conforming artifact did not exit 0').toBe(0);
    expect(chain.ran['validate-bad']?.status, 'a qa-red script step could not fail on this').toBe(1);
    expect(chain.ran['validate-bad']?.stdout).toContain('must be equal to one of the allowed values');
  });
});

describe('AC-8 — the suite is honest about what it could not run', () => {
  test('no block can skip and still report success', () => {
    for (const shape of [/\b(?:test|describe|it)\.(?:skip|todo|skipIf|runIf|only|failing)\b/g,
      /\bctx\.(?:skip|annotate)\(/g, /if \(fs\.existsSync\(/g]) {
      expect(SOURCE.match(shape) ?? [], `${shape.source} lets a block report success over a subject it did not examine`)
        .toStrictEqual([]);
    }
  });

  test('and the one thing this platform could withhold is refused rather than skipped', () => {
    // `fs.existsSync` guarding an assertion block is the shape `smoke.js:459` still has and the one
    // this file may not translate; the shape to copy is `:418`'s, where the subject is asserted.
    // Where the platform genuinely cannot run the fixture, the file throws at module scope, so it
    // fails to collect and names the reason.
    expect(SOURCE).toContain('this suite refuses rather than reporting a pass over a chain it never ran');
    const skipping = assembled('if (fs.', 'existsSync', '(arch)) { assert(rows.length >= 2); }');
    expect(/if \(fs\.existsSync\(/.test(skipping), 'the clause cannot see the shape it forbids').toBe(true);
  });
});

describe('AC-9 — the verdict is a property of the commit', () => {
  test('the register of what could steer a run is derived from the product, and is the size it should be', () => {
    // An identity over the mock's half, which this file may spell, and a derivation over the other:
    // the two the adapters refuse cannot be written here — `frame.source.test.ts`'s AC-12 admits
    // exactly one file in this package that names one — so they are asserted against the same guards
    // AC-7 pins the shape of, at one and two.
    expect(STEERING.filter((name) => name.startsWith('MOCK_')), 'the mock gained or renamed a switch')
      .toStrictEqual([
        'MOCK_ALWAYS_FAIL', 'MOCK_ALWAYS_PASS', 'MOCK_CACHED_INPUT_TOKENS', 'MOCK_CACHE_WRITE_INPUT_TOKENS',
        'MOCK_DEV_FLAKY', 'MOCK_FAIL_WRITE', 'MOCK_RUN_HISTORY_PROFILES', 'MOCK_TOKEN_ONLY', 'MOCK_VENDOR',
      ]);
    expect(STEERING.filter((name) => !name.startsWith('MOCK_')),
      'the product reads an environment variable this suite does not remove')
      .toStrictEqual([...new Set([...refusedBy('claude'), ...refusedBy('codex'), 'USER'])].sort());
    // The two the first clause cannot see, because `numericSwitch` takes its name as an argument:
    // without the second clause of the derivation both would be missing and this would be red.
    expect([...read(WORKSPACE, 'packages', 'core', 'src', 'adapters', 'mock.ts')
      .matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]),
    'the mock now reads both numeric switches directly, so the second clause has no subject')
      .not.toContain('MOCK_CACHED_INPUT_TOKENS');
  });

  test('and no invocation inherited one: each carried only what its own call declared', () => {
    const set = Object.fromEntries([...refusedBy('claude'), ...refusedBy('codex')]
      .map((name) => [name, SET_BY_THE_FIXTURE]));
    // The twelve labels written out rather than mapped from `chain.ran`, so a thirteenth invocation
    // has to be classified here instead of arriving with an empty expectation of its own.
    expect(Object.fromEntries(Object.entries(chain.ran).map(([label, i]) => [label, i.steering])))
      .toStrictEqual({
        init: {}, lint: {}, ticket: {}, 'wrong-stage': {}, requirements: {}, solutioning: {},
        'qa-red': {}, development: { MOCK_DEV_FLAKY: '1' }, board: {}, adapters: set,
        'validate-ok': {}, 'validate-bad': {},
      });
  });

  test('and the sanitiser discriminates: an ambient switch does not reach the spawned process', () => {
    // Over an environment composed here rather than over this machine's, which sets none of them and
    // would therefore prove nothing. The three clauses are the three ways this could be wrong: a
    // switch survives, the declared override is lost, or the sanitiser takes something it was not
    // asked to take.
    const ambient = Object.fromEntries(STEERING.map((name) => [name, 'ambient']));
    const env = sanitised({ ...ambient, PATH: 'kept' }, { MOCK_DEV_FLAKY: '1' });
    expect(STEERING.filter((name) => env[name] !== undefined), 'an ambient switch survived the sanitiser')
      .toStrictEqual(['MOCK_DEV_FLAKY']);
    expect(env.MOCK_DEV_FLAKY, 'the call\'s own override was removed with the rest').toBe('1');
    expect(env.PATH, 'the sanitiser removed something no criterion asked it to').toBe('kept');
    expect(Object.keys(ambient).length, 'the fixture environment carries nothing, so it discriminates nothing')
      .toBe(STEERING.length);
  });

  test('every run selects the mock, so nothing here reaches a vendor or the network', () => {
    const runs = Object.values(chain.ran).filter((invocation) => invocation.argv[0] === 'run');
    // An identity rather than a floor: a count would pass whether or not the five flows this chain
    // walks were still the ones being run.
    expect(runs.map((invocation) => invocation.argv[1]))
      .toStrictEqual(['solutioning', 'requirements', 'solutioning', 'qa-red', 'development']);
    for (const invocation of runs) {
      expect(invocation.argv.join(' '), `${invocation.argv.join(' ')} does not select the mock`)
        .toContain('--adapter mock');
    }
  });

  test('the owner asserted on the board is one the fixture supplied, not the account it runs as', () => {
    // `Backlog.create` defaults owner to `process.env.USER` — the preserved defect at
    // `backlog.ts:190`, which ground rule 3 keeps. A fixture asserting `owner=` without passing one
    // would take its verdict from the account (Q-0099's finding).
    expect(chain.ran.ticket?.argv, 'the ticket was created without an explicit owner').toContain('--owner');
    expect(chain.ran.ticket?.argv).toContain(OWNER);
  });

  test('and the one commit this file creates carries both identity fields', () => {
    // The repository-wide guard is `packages/core/src/git-identity.test.ts`, which sees literals
    // only. This is the same claim scoped to this file, so the criterion has a subject here rather
    // than only in another package's suite.
    const commits = [...SOURCE.matchAll(/^ {2}git\(repo, (.*'commit'.*)\);$/gm)].map((match) => match[1] ?? '');
    expect(commits, 'this file creates no commit, or creates one the scan cannot see').toHaveLength(1);
    for (const call of commits) {
      expect(call, 'a commit-creating call with no explicit address').toContain("'-c', 'user.email=");
      expect(call, 'a commit-creating call with no explicit name').toContain("'-c', 'user.name=");
    }
  });

  test('and the fixture repository names its own branch, so no git default decides the base', () => {
    expect(SOURCE).toContain("git(repo, 'init', '-q', '-b', BASE_BRANCH)");
    expect(read(chain.repo, 'harness', 'harness.yaml')).toContain(`base_branch: ${BASE_BRANCH}`);
  });
});
