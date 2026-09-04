/**
 * Q-0101 — the failure, gate and rollback half of `smoke.js`, through the built binary.
 *
 * **What Q-0095 left.** That ticket walked one ticket from `quorum init` to `stage: green`; these
 * are the scenarios that fire when something goes *wrong* — a bounded loop that exhausts onto a
 * gate `--auto` may not walk through, a gate nobody answered, a `retry` that must grant exactly one
 * traversal and not a budget, a parallel branch that fails while its sibling's work survives, a
 * merge abandoned and rolled back, and a base conflict that no amount of re-running developers can
 * fix. `packages/cli/src/end-to-end.test.ts` carries the chain; `packages/core/src/spike-parity.test.ts`
 * records both halves on the one `smoke.js` row, and names which file carries which.
 *
 * **Three of these behaviours are already checked in process, and this file says which rather than
 * describing them a second time** (AC-13). `packages/cli/src/run.test.ts` carries:
 *
 *   - **S10.6** — `--auto` at an exhaustion gate: the `human-locked` / `loop exhausted` wording, the
 *     absence of `auto-advanced (human-locked)`, and `UNDECIDED` as `test/invoke.ts` composes it.
 *     New here: the status **the operating system reports**, and `stdin closed without one` and
 *     `nothing was rolled back` at the *exhaustion* gate, which is a different gate reached by a
 *     different route from the flow's declared one.
 *   - **AC-6** (`run.test.ts:202`) — the unanswered non-TTY gate: the exit code, both output
 *     sentences and the unmoved stage. New here: every `runs.log` claim — the run classified
 *     `undecided` and not `failed`, with nothing rolled back — and the iteration counter as a value.
 *   - **S10.7** — `retry`: the `gate=retry counter=… set=1` line alone. New here: the arithmetic —
 *     three traversals, the counter ending one past its limit, an unrelated counter untouched, and
 *     the second gate returning.
 *
 * Where a carried clause is restated below it is because it is free once the spawned run exists
 * **and because it is what identifies the gate**: a process that exited 3 from an early crash would
 * satisfy the exit-code claim on its own, so the wording clauses are what make that 3 a measurement
 * of this gate rather than of any 3 at all.
 *
 * **Nothing in this workspace watched a real process exit 3 before this file.** `test/invoke.ts`
 * composes `exitCode` from the argument `die` handed `process.exit`, from `process.exitCode`, or
 * from `SUCCESS` — a claim about an argument, which cannot see a code masked by a wrapper or an
 * `exitCode` overwritten during teardown. `smoke.js:118` is the only assertion over a spawned status
 * of 3 anywhere, and the cutover deletes it, so AC-1(a) is the product's `undecided` contract at the
 * one boundary an operator meets it.
 *
 * **One operating-system process per invocation, and one fixture repository per scenario.**
 * `packages/core/src/adapters/mock.ts:16–20` states that its call counter is module-scoped with no
 * reset export and that adding one would be a charter §2 behaviour change; the unanswered-gate route
 * below needs a step to fail its **first** call for a key and pass afterwards, which only a fresh
 * process gives. A repository per scenario is the other half: the spike shares one `tmp` across
 * every block and deletes its ad-hoc flow files afterwards, so a scenario that left a `base_branch`
 * edit behind would make its neighbour's verdict depend on ordering — which *"A test's verdict is a
 * property of the commit, not of the checkout or the account"* (2026-08-30) forbids.
 *
 * **It spawns a copy it built itself, never `packages/cli/dist`** — the first of the two safe shapes
 * Q-0098 AC-15(c) names, since `build.test.ts` removes the real emit twice. The copier is
 * `../test/workspace.ts`, shared with that file and with the chain suite rather than written again.
 *
 * **It runs after the spike is deleted**, which is the property the cutover turns on: nothing here
 * reads, imports or spawns anything under that tree, asserted over this file's own source rather
 * than discovered on the day (§3 R-4).
 *
 * **It needs `sh`, and it refuses rather than skipping.** Two of the fixtures below write flows whose
 * `run_tests` is an `sh -c` chain, and every fixture points `commands.install` at one — so where `sh`
 * cannot run this suite has no subject, and *"a check that skips its subject must not report
 * success"* (2026-08-25). The refusal is at module scope, so the file fails to collect and says why
 * (§3 R-6), and **it is decided by running `sh` rather than by reading the platform's name**: a
 * `process.platform` test is a proxy that is wrong in both directions, admitting a Unix-like machine
 * with no usable `sh` — which then fails somewhere below with a command error that reads like a
 * product defect — and refusing a Windows one that has a working shell.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { buildIn, disposeIsolated, isolate, PACKAGE, read, WORKSPACE } from '../test/workspace.js';

/** The shell every fixture below needs, named once so the probe and the fixtures cannot disagree. */
const SHELL = 'sh';

/**
 * A status no shell returns by accident, so the probe proves `-c` was *interpreted*.
 *
 * A binary that starts, ignores its argument and exits 0 would satisfy a probe that asked for zero —
 * and it is exactly what a machine with a stub `sh` on its `PATH` has. Asking for an arbitrary
 * status is what makes the answer a measurement of the shell rather than of the file's existence.
 */
const SHELL_PROBE_STATUS = 7;

/** How long the probe waits, so a wedged shell refuses collection instead of hanging it. */
const SHELL_PROBE_TIMEOUT_MS = 10_000;

/**
 * Why this machine cannot run these fixtures, or `null` where it can.
 *
 * Takes the command as a parameter rather than closing over {@link SHELL} so the refusal can be
 * demonstrated firing over a shell composed by a test — showing the clause has a subject, rather
 * than showing that this machine happens to have `sh` (*"A check is not established by reading it"*,
 * 2026-08-29). The four returns are the four ways the answer can be no, and each names which.
 */
const shellRefusal = (shell: string): string | null => {
  let probe: ReturnType<typeof spawnSync>;
  try {
    probe = spawnSync(shell, ['-c', `exit ${String(SHELL_PROBE_STATUS)}`],
      { stdio: 'ignore', timeout: SHELL_PROBE_TIMEOUT_MS });
  } catch (cause) {
    return `\`${shell} -c\` could not be spawned at all (${String(cause)})`;
  }
  if (probe.error !== undefined) return `\`${shell} -c\` could not be executed (${probe.error.message})`;
  if (probe.signal !== null) return `\`${shell} -c\` was killed by ${probe.signal} rather than running`;
  if (probe.status !== SHELL_PROBE_STATUS) {
    return `\`${shell} -c 'exit ${String(SHELL_PROBE_STATUS)}'\` returned ${String(probe.status)}, `
      + 'so it is not a shell that interprets -c';
  }
  return null;
};

const SHELL_REFUSAL = shellRefusal(SHELL);
if (SHELL_REFUSAL !== null) {
  // A refusal and not a skip: the file fails to collect and names the reason, where a skipped block
  // would report a green run over failure paths nothing walked.
  throw new Error(
    'the failure-path fixtures drive sh-based commands.install and sh -c run_tests chains, and on '
    + `${process.platform} ${SHELL_REFUSAL} — `
    + 'this suite refuses rather than reporting a pass over rollbacks it never ran',
  );
}

/** This file's own text, which two of the claims below are assertions about. */
const SOURCE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');

/**
 * How long one spawned invocation may take before it is killed.
 *
 * Measured rather than chosen by analogy, though as a bound rather than per invocation: the whole
 * file — the workspace copy, a forced build of the three emitting packages, and **nineteen** spawned
 * invocations across six scenarios — takes 5.0 s to 5.8 s as Vitest measures it, over three runs on
 * this machine. So no single invocation approaches a second, and sixty seconds is two orders of
 * magnitude of headroom for a loaded CI runner while still being short enough that a hung run fails
 * the suite rather than the job's own limit.
 *
 * Before Q-0011 the failure mode of an unanswered gate was a 24-minute hang rather than a red test,
 * which is why every spawn below carries a timeout and why a killed process is refused rather than
 * having its status read: a null status read as "not 3" would turn that hang into an ordinary
 * assertion failure about an exit code.
 */
const SPAWN_TIMEOUT_MS = 60_000;

/**
 * How long the whole fixture may take to build and walk.
 *
 * Measured over three runs: 5.0 s, 5.8 s and 5.7 s as Vitest measures the whole file, copy and
 * forced build included. Ninety seconds is roughly fifteen times the upper figure, and what it has
 * to absorb is a cold `tsc` on a loaded runner, which is the only part of this that is not
 * milliseconds. The chain suite chose the same ceiling from the same shape of measurement.
 */
const FIXTURE_TIMEOUT_MS = 90_000;

/** The ticket every fixture allocates, and the owner it supplies rather than inheriting. */
const TICKET = 'T-0001';
const OWNER = 'quorum-fixture';

/** The branch each fixture repository is created on, set explicitly so no git default decides it. */
const BASE_BRANCH = 'main';

/** The integration branch the two rollback fixtures build by hand, as the ticket's frontmatter names it. */
const INTEGRATION = `harness/${TICKET}/integration`;

/** A string as a regular-expression literal, so a branch name carrying a metacharacter still pins itself. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The base-conflict diagnostic naming the ticket branch and the base, **each in its own position**.
 *
 * `into` and `base` are two arguments of one template, so the way a wrong attribution actually looks
 * is a swap — which is why the two names are pinned in order rather than merely required to be
 * present, and why the clause is shown refusing the reversed sentence beside the run it reads.
 * Built from the two constants above so that renaming a fixture branch cannot leave this green.
 */
const NAMES_BOTH = new RegExp(`cannot sync ${literal(INTEGRATION)} with ${literal(BASE_BRANCH)}\\b`);

/** ANSI stripped, as every assertion below reads the output. */
const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

/** Everything one spawned invocation of the binary produced. */
interface Invocation {
  readonly argv: readonly string[];
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Which of {@link STEERING} the spawned process actually carried, and with what value. */
  readonly steering: Readonly<Record<string, string>>;
}

/** Both streams together, which is where several of these assertions look. */
const output = (invocation: Invocation): string => invocation.stdout + invocation.stderr;

/** What an absent recording reads as, so a missing label fails on its content rather than on a type. */
const EMPTY: Invocation = { argv: [], status: null, stdout: '', stderr: '', steering: {} };

/**
 * `git` in a fixture repository.
 *
 * Named `git` and called with its options as literals so that
 * `packages/core/src/git-identity.test.ts` can see it: that guard is anchored on a call to a helper
 * of this name and reads the literals at the **call site**, so an identity injected in here would be
 * invisible to it and the four commits below would read as bare commit-creating calls.
 */
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * The variables each vendor adapter refuses, read out of the adapter that refuses them.
 *
 * **Derived rather than written down**, for the reason `end-to-end.test.ts` gives at its own copy:
 * `frame.source.test.ts`'s AC-12 asserts that exactly one file in this package matches any of its
 * BYOS spellings and that the self-exclusion is the only one, so a suite that typed the names would
 * turn red the guard proving this package has no key path at all.
 */
const refusedBy = (vendor: string): string[] =>
  [...read(WORKSPACE, 'packages', 'core', 'src', 'adapters', `${vendor}.ts`)
    .matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1] ?? '');

/**
 * Every environment variable the product's own code reads — the whole of what a shell could use to
 * steer a run of it.
 *
 * **The same derivation `end-to-end.test.ts` performs, over the same four files, and deliberately a
 * second instance rather than a shared export** (§3 R-2 and R-5): that file's own structural
 * assertions pin its import list to the copier alone, and moving this into `test/workspace.ts` would
 * edit a landed suite past the one addition this ticket authorises there. Neither copy can drift
 * from the *product*, because both read it; each carries its own discrimination test below and in
 * that file, so a copy that stopped firing fails on its own.
 *
 * **Two clauses, because the mock reaches two of its switches through a variable.** `numericSwitch`
 * takes the name as an argument, so the `process.env.X` clause cannot see `MOCK_CACHED_INPUT_TOKENS`
 * or `MOCK_CACHE_WRITE_INPUT_TOKENS`; every switch is nevertheless spelled at its call site, which
 * is what the second clause anchors on.
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
 * resolvable identity, and a child that could not see them would be exempt from the one check this
 * suite must not be exempt from.
 *
 * The stakes here are higher than in the chain suite: an inherited `MOCK_ALWAYS_PASS` would make the
 * unanswered-gate route below reach its gate without ever turning its loop, and an inherited
 * `MOCK_ALWAYS_FAIL` would stop the parallel-failure run at a verdict rather than at the write.
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

/** Where the isolated workspace copy put the artifact every scenario spawns. */
let bin = '';

/** Every temporary directory this file created — one repository per scenario. */
const temporaries: string[] = [];

afterAll(() => {
  for (const directory of temporaries.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  disposeIsolated();
});

/** One scenario's repository, its ticket folder, and the way to drive the binary inside it. */
interface Fixture {
  readonly repo: string;
  readonly folder: string;
  readonly ran: Record<string, Invocation>;
  /** An absolute path inside the ticket's own folder. */
  readonly at: (relative: string) => string;
  /** A file inside the ticket's folder, or a sentinel when it is not there. */
  readonly read: (relative: string) => string;
  readonly run: (label: string, argv: readonly string[], overrides?: NodeJS.ProcessEnv) => Invocation;
}

/**
 * A scaffolded project with one `draft` ticket, in a repository this scenario owns.
 *
 * **`commands.install` and `commands.test` are pointed at something the fixture can run**, as the
 * spike does at `smoke.js:34–36`. Measured rather than copied: with the scaffolded `npm install`
 * left in place the abandoned-merge run below fails at *install* with exit 254 and rolls the branch
 * back for a reason that has nothing to do with its subject — satisfying "the run aborts non-zero"
 * and "the branch is where it started" while proving neither. That is the shape AC-5 exists to
 * refuse, arriving through the environment instead of through an assertion.
 */
const scenario = (label: string): Fixture => {
  // Realpathed: on macOS `os.tmpdir()` is a symlink and `loadProject` resolves what it is given, so
  // an unresolved fixture path would make a path assertion fail for a reason that is a property of
  // the machine rather than of the commit.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `quorum-cli-fail-${label}-`)));
  temporaries.push(repo);

  const ran: Record<string, Invocation> = {};
  const run = (name: string, argv: readonly string[], overrides: NodeJS.ProcessEnv = {}): Invocation => {
    const env = sanitised(process.env, overrides);
    const result = spawnSync(process.execPath, [bin, ...argv], {
      cwd: repo, encoding: 'utf8', env, timeout: SPAWN_TIMEOUT_MS,
    });
    // A killed process must fail loudly rather than being absorbed as a status: `spawnSync` reports
    // a timeout as `signal` with a null status, and a null status read as "not 3" would turn a hung
    // gate into an ordinary assertion failure about an exit code. The hang is the failure mode this
    // whole file is about, so it names itself.
    if (result.signal !== null || result.error !== undefined) {
      throw new Error(`${label}/${name} did not finish: signal=${String(result.signal)} `
        + `after ${String(SPAWN_TIMEOUT_MS)} ms — ${String(result.error?.message ?? 'no error reported')}`);
    }
    const invocation: Invocation = {
      argv, status: result.status, stdout: plain(result.stdout ?? ''), stderr: plain(result.stderr ?? ''),
      steering: Object.fromEntries(STEERING.flatMap((name_) => (env[name_] === undefined ? [] : [[name_, env[name_]]]))),
    };
    ran[name] = invocation;
    return invocation;
  };
  const mustPass = (name: string, argv: readonly string[]): Invocation => {
    const invocation = run(name, argv);
    if (invocation.status !== 0) {
      throw new Error(`${label}/${name} exited ${String(invocation.status)}; the scenario cannot be set up:\n${output(invocation)}`);
    }
    return invocation;
  };

  git(repo, 'init', '-q', '-b', BASE_BRANCH);
  git(repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '--allow-empty', '-m', 'init');
  mustPass('init', ['init']);

  const config = path.join(repo, 'harness', 'harness.yaml');
  fs.writeFileSync(config, read(config)
    .replace(/install: npm install.*/, 'install: sh -c "exit 0"')
    .replace(/test: npm test.*/, 'test: sh -c "exit 0"'));

  // The owner is supplied rather than inherited: `Backlog.create` defaults it from the account
  // (`backlog.ts:190`, the preserved defect ground rule 3 keeps), and this suite strips that variable
  // with the rest of {@link STEERING} — so a fixture that passed none would record whatever the
  // absence produced (Q-0099's finding).
  mustPass('ticket', ['ticket', 'new', label, '--owner', OWNER]);

  const folder = fs.readdirSync(path.join(repo, 'backlog'))[0] ?? '';
  const at = (relative: string): string => path.join(repo, 'backlog', folder, relative);
  return {
    repo,
    folder,
    ran,
    at,
    run,
    // A sentinel rather than a throw, so an assertion about a file that is not there fails on the
    // claim it was making instead of on a stack from the reader.
    read: (relative) => (fs.existsSync(at(relative)) ? fs.readFileSync(at(relative), 'utf8') : '<absent>'),
  };
};

/** One extra flow file in a fixture's own flow directory — never a shipped asset. */
const writeFlow = (fixture: Fixture, name: string, body: string): void =>
  fs.writeFileSync(path.join(fixture.repo, 'harness', 'flows', `${name}.yaml`), body);

/**
 * Whether `name` exists anywhere below `directory`.
 *
 * **A search rather than a path test, which is AC-4(c) and AC-5's whole subject.** Q-0088 moved the
 * candidate files under `requirements/run-<run>/`, and the spike's single-path form of the negative
 * assertion went green the moment it moved — nothing was at the old address, so it proved the writer
 * had failed only by accident. A search cannot pass that way.
 */
const found = (directory: string, name: string): boolean =>
  fs.existsSync(directory) && fs.readdirSync(directory, { withFileTypes: true })
    .some((entry) => (entry.isDirectory() ? found(path.join(directory, entry.name), name) : entry.name === name));

/**
 * One iteration counter's value in a `ticket.md`, or `null` where the key is absent.
 *
 * **`null` rather than a zero default, and that distinction is the criterion** (AC-2(e)). The spike
 * reads the same counter with `?? '0'` and compares `Number(after) >= Number(before)` against a
 * ticket `ticket new` had just written — whose frontmatter is `iterations: {}`, so `before` takes
 * the fallback and the assertion reads `n >= 0`, true for every possible value including a refund to
 * zero. A reader that cannot tell "absent" from "zero" cannot express the claim, so this one does,
 * and the assertion below is an equality on the value the run reached.
 */
const counter = (ticket: string, key: string): number | null => {
  const match = new RegExp(`^\\s*${key.replace('.', '\\.')}: (\\d+)$`, 'm').exec(ticket);
  return match?.[1] === undefined ? null : Number(match[1]);
};

/** The `run=<n>` ids in a `runs.log`, in the order they were written. */
const runIds = (log: string): string[] => [...log.matchAll(/\brun=(\d+) flow=/g)].map((match) => match[1] ?? '');

/** What the exhaustion-gate scenario recorded (AC-1). */
let exhausted: Invocation;
/** What the unanswered non-TTY gate scenario recorded (AC-2). */
let unanswered: { invocation: Invocation; runsLog: string; ticket: string };
/** What the retry scenario recorded (AC-3). */
let retried: { invocation: Invocation; runsLog: string; ticket: string };
/** What the parallel-failure scenario recorded (AC-4). */
let parallel: {
  first: Invocation;
  second: Invocation;
  /** Read after the FAILED run and before the second attempt, which is what makes the stage claim true. */
  afterFirst: { runsLog: string; ticket: string; siblingKept: boolean; failedFound: boolean };
  idsAfterSecond: string[];
};
/** What the abandoned-merge scenario recorded (AC-6). */
let abandoned: {
  invocation: Invocation;
  before: string;
  after: string;
  ticketTree: string;
  sideTree: string;
  runsLog: string;
};
/** What the base-conflict scenario recorded (AC-7(b1)). */
let clashed: { invocation: Invocation; runsLog: string };

beforeAll(() => {
  const root = isolate();
  buildIn(root, '--force');
  const declared = (JSON.parse(read(PACKAGE, 'package.json')) as { bin: Record<string, string> }).bin.quorum;
  bin = path.join(root, 'packages', 'cli', declared);
  if (!fs.existsSync(bin)) throw new Error(`the isolated build wrote no ${declared} — there is nothing to spawn`);

  // AC-1 — an exhausted loop lands on a human-locked gate that `--auto` may not walk through.
  exhausted = scenario('exhaustion')
    .run('exhaustion', ['run', 'requirements', TICKET, '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' });

  // AC-2 — a gate nobody answered, with stdin not a terminal and no scripted answer. No switch is
  // set: the route needs the mock's first call per key to fail and the second to pass, so the loop
  // turns once, the flow reaches its declared human gate, and nothing is there to answer it.
  {
    const fixture = scenario('unanswered');
    const invocation = fixture.run('unanswered', ['run', 'requirements', TICKET, '--adapter', 'mock']);
    unanswered = { invocation, runsLog: fixture.read('runs.log'), ticket: fixture.read('ticket.md') };
  }

  // AC-3 — `retry` at the exhaustion gate, with no second answer, over a pre-seeded unrelated counter.
  {
    const fixture = scenario('retry');
    const file = fixture.at('ticket.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
      .replace('iterations: {}', 'iterations:\n  qa-final.unrelated: 2'));
    const invocation = fixture.run('retry',
      ['run', 'requirements', TICKET, '--adapter', 'mock', '--gate-answer', 'retry'], { MOCK_ALWAYS_FAIL: '1' });
    retried = { invocation, runsLog: fixture.read('runs.log'), ticket: fixture.read('ticket.md') };
  }

  // AC-4 — one branch of a parallel group fails while its sibling's finished work survives.
  {
    const fixture = scenario('parallel');
    // MOCK_FAIL_WRITE matches the PROMPT and not the write target (`mock.ts:98`), and the claude
    // candidate's prompt is the only one naming its own output path — which is what aims it.
    const first = fixture.run('failed-branch',
      ['run', 'requirements', TICKET, '--adapter', 'mock', '--auto'], { MOCK_FAIL_WRITE: 'candidate-claude.md' });
    // Read here rather than after the second attempt: that attempt succeeds and advances the stage,
    // so a reading taken at the end would report `requirements` and the stage claim would be false
    // of the moment it is about.
    const afterFirst = {
      runsLog: fixture.read('runs.log'),
      ticket: fixture.read('ticket.md'),
      siblingKept: fs.existsSync(fixture.at('requirements/run-1/candidate-codex.md')),
      failedFound: found(fixture.at('requirements'), 'candidate-claude.md'),
    };
    // A failed run writes no history entry, so the next attempt must not reuse its id.
    const second = fixture.run('second-attempt', ['run', 'requirements', TICKET, '--adapter', 'mock', '--auto']);
    parallel = { first, second, afterFirst, idsAfterSecond: runIds(fixture.read('runs.log')) };
  }

  // AC-6 — a failing `integrate` with no `on_fail` aborts, and the abandoned merge is rolled back.
  {
    const fixture = scenario('abandoned');
    git(fixture.repo, 'checkout', '-q', '-b', INTEGRATION);
    fs.writeFileSync(path.join(fixture.repo, 'carried.txt'), 'base\n');
    git(fixture.repo, 'add', 'carried.txt');
    git(fixture.repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '-m', 'base');
    git(fixture.repo, 'checkout', '-q', '-b', `${INTEGRATION}-side`);
    fs.writeFileSync(path.join(fixture.repo, 'impl.txt'), 'impl\n');
    git(fixture.repo, 'add', 'impl.txt');
    git(fixture.repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '-m', 'impl');
    git(fixture.repo, 'checkout', '-q', BASE_BRANCH);
    const before = git(fixture.repo, 'rev-parse', INTEGRATION).trim();
    writeFlow(fixture, 'abandon', [
      'name: abandon', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: integrate', '    type: integrate', `    branches: ["${INTEGRATION}-side"]`,
      `    into: "${INTEGRATION}"`, '    run_tests: "sh -c \'exit 1\'"', '    expect: pass',
      '    output: { writes: [dev/integration.md] }', '',
    ].join('\n'));
    const invocation = fixture.run('abandon', ['run', 'abandon', TICKET, '--adapter', 'mock', '--auto']);
    abandoned = {
      invocation,
      before,
      after: git(fixture.repo, 'rev-parse', INTEGRATION).trim(),
      ticketTree: git(fixture.repo, 'ls-tree', '-r', '--name-only', INTEGRATION),
      sideTree: git(fixture.repo, 'ls-tree', '-r', '--name-only', `${INTEGRATION}-side`),
      runsLog: fixture.read('runs.log'),
    };
  }

  // AC-7(b1) — the ticket branch and the base branch in genuine conflict over one file.
  {
    const fixture = scenario('base-conflict');
    git(fixture.repo, 'checkout', '-q', '-b', INTEGRATION);
    fs.writeFileSync(path.join(fixture.repo, 'clash.txt'), 'ticket-side\n');
    git(fixture.repo, 'add', 'clash.txt');
    git(fixture.repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '-m', 'ticket');
    git(fixture.repo, 'checkout', '-q', BASE_BRANCH);
    fs.writeFileSync(path.join(fixture.repo, 'clash.txt'), 'base-side\n');
    git(fixture.repo, 'add', 'clash.txt');
    git(fixture.repo, '-c', 'user.email=fixture@quorum.invalid', '-c', 'user.name=Quorum fixture', 'commit', '-q', '-m', 'base');
    // `input.backlog` carries the step's own report so the convergence lint is satisfied: this
    // fixture is about the base conflict, not about a blind loop.
    writeFlow(fixture, 'base-clash', [
      'name: base-clash', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: integrate', '    type: integrate', `    branches: ["${INTEGRATION}"]`,
      `    into: "${INTEGRATION}"`, '    input: { backlog: [dev/integration.md] }',
      '    output: { writes: [dev/integration.md] }',
      '    on_fail: { goto: integrate, max_iterations: 3, on_exhausted: gate }', '',
    ].join('\n'));
    const invocation = fixture.run('base-clash', ['run', 'base-clash', TICKET, '--adapter', 'mock', '--auto']);
    clashed = { invocation, runsLog: fixture.read('runs.log') };
  }
}, FIXTURE_TIMEOUT_MS);

/**
 * A sample assembled from pieces, so this file does not contain the text its own scans forbid.
 *
 * The alternative is a self-exclusion, which here would excuse a real read added later — the whole
 * of what the cutover claim is about.
 */
const assembled = (...parts: string[]): string => parts.join('');

describe('AC-1 — the exhaustion gate, and exit 3 as the operating system reports it', () => {
  test('(a) the status is exactly 3, read from the spawned result rather than composed', () => {
    // Exactly 3 and never merely non-zero: 1 is what an operator error returns and 2 is a deliberate
    // abort, so a script wrapping the command can tell "nobody was there" from either. This is the
    // only assertion in the workspace over a real process's 3 — `test/invoke.ts` reports the
    // argument `die` handed `process.exit`, which is a different claim.
    expect(exhausted.status, output(exhausted)).toBe(3);
  });

  test('(b) and (d) — the loop exhausted onto a human-locked gate, and --auto did not walk through it', () => {
    // Restated from `run.test.ts:337` (S10.6) rather than new, and the header says why: they are free
    // once this run exists, and they are what identifies the gate. Without them a process that exited
    // 3 from an early crash would satisfy (a) on its own, so these are what make it a measurement of
    // this gate rather than of any 3 at all.
    expect(output(exhausted), 'the loop did not reach an exhaustion gate').toContain('loop exhausted');
    expect(output(exhausted), 'the gate the loop reached was not human-locked').toContain('human-locked');
    expect(output(exhausted), 'auto answered the gate it may not answer')
      .not.toContain('gate: auto-advanced (human-locked)');
  });

  test('(c) it says which gate it could not answer, and what it kept', () => {
    // New at this gate. `run.test.ts:209`–`:210` asserts both sentences on the flow's DECLARED human
    // gate; the exhaustion gate is a different gate, synthesised by the engine when a bounded loop
    // runs out, and reached by a different route.
    expect(output(exhausted)).toContain('stdin closed without one');
    expect(output(exhausted)).toContain('nothing was rolled back');
  });
});

describe('AC-2 — an unanswered non-TTY gate is undecided in the durable record', () => {
  test('(a) to (c) — runs.log classifies the run undecided, not failed, and records no rollback', () => {
    // The file a maintainer reads afterwards, which no `packages/cli` suite asserted before this one:
    // `run.test.ts:202` proves the exit code, the two sentences and the stage in process. The three
    // words want three different next actions, so they are three clauses rather than a disjunction.
    expect(unanswered.runsLog, 'the run is not recorded as undecided').toMatch(/ undecided /);
    expect(unanswered.runsLog, 'an unanswered gate was recorded as a failure').not.toMatch(/ failed /);
    expect(unanswered.runsLog, 'an undecided run rolled something back').not.toContain('rolled-back');
  });

  test('(d) the stage does not move', () => {
    expect(unanswered.ticket).toMatch(/^stage: draft$/m);
  });

  test('(e) the iteration counter is the value the run reached, not a floor it cannot fall below', () => {
    // Measured on this run rather than predicted: the route is *the reviewer fails its first call for
    // the key, the loop returns, the second call passes, the flow reaches its declared human gate*,
    // so exactly one traversal is spent and the surviving counter is a property of
    // `requirements.yaml`'s own bound.
    expect(counter(unanswered.ticket, 'requirements.head-of-product'),
      'the counter the unanswered run left behind').toBe(1);
  });

  test('and the reading tells a refund from an absent key, which is what makes (e) able to fail', () => {
    // The spike's form of this assertion cannot fail — `?? '0'` against a ticket whose frontmatter is
    // `iterations: {}` makes it `n >= 0` — so the reader is shown discriminating over composed texts
    // before the equality above is trusted. A refund to zero and an absent key are different answers,
    // and both differ from 1.
    const frontmatter = (body: string): string => `---\nid: ${TICKET}\n${body}\n---\n`;
    expect(counter(frontmatter('iterations:\n  requirements.head-of-product: 0'), 'requirements.head-of-product'),
      'a refund to zero reads as the value the run reached').toBe(0);
    expect(counter(frontmatter('iterations: {}'), 'requirements.head-of-product'),
      'an absent key reads as a number, so absent and zero are the same answer').toBeNull();
    expect(counter(frontmatter('iterations:\n  requirements.head-of-product: 1'), 'requirements.head-of-product'))
      .toBe(1);
  });
});

describe('AC-3 — retry grants exactly one further traversal, and the arithmetic is the claim', () => {
  test('(a) three head-of-product traversals: one run, one loop, one grace', () => {
    // The assertion *"`retry` at an exhaustion gate authorises exactly one more traversal"*
    // (2026-08-22) actually turns on — that entry corrected an off-by-one, and a count is the only
    // shape that catches its return. A fourth would mean `retry` handed back the whole budget.
    expect((retried.runsLog.match(/step=head-of-product/g) ?? []).length,
      'retry granted something other than exactly one further traversal').toBe(3);
  });

  test('(b) the grant is recorded in runs.log', () => {
    // Carried in part by `run.test.ts:349` (S10.7), which asserts this line alone; it is restated
    // here because the three clauses around it are about the same line's consequences and a reader
    // checking the arithmetic needs the grant in front of them.
    expect(retried.runsLog).toMatch(/gate=retry counter=requirements\.head-of-product set=1/);
  });

  test('(c) and (d) — the retried loop ends one past its limit, and an unrelated counter is untouched', () => {
    expect(counter(retried.ticket, 'requirements.head-of-product'),
      'the retried loop was reset to zero rather than left one past its limit').toBe(2);
    expect(counter(retried.ticket, 'qa-final.unrelated'),
      'a retry refunded an unrelated loop\'s budget').toBe(2);
  });

  test('(e) the second, unanswered gate ends the run non-zero, which is what proves the gate returned', () => {
    // Non-zero rather than a code: which code an unanswered gate produces is AC-1(a)'s claim, made
    // once over the run that exists to make it. What this clause needs is that the gate was presented
    // a SECOND time and nothing answered it, and a run that exited 0 would mean it never returned.
    expect(retried.invocation.status, output(retried.invocation)).not.toBe(0);
  });
});

describe('AC-4 — the failed parallel sibling, its cost, and run-id uniqueness', () => {
  test('(a) a failed parallel branch fails the run', () => {
    expect(parallel.first.status, output(parallel.first)).not.toBe(0);
    expect(output(parallel.first)).toContain('1 of 2 parallel step(s) failed');
  });

  test('(b) the surviving sibling keeps its output, at the run-scoped path Q-0088 moved it to', () => {
    // The exact path rather than a glob: a glob would go on passing if the scoping were reverted.
    expect(parallel.afterFirst.siblingKept,
      'the surviving sibling lost its finished work at requirements/run-1/candidate-codex.md').toBe(true);
  });

  test('(c) and the failed sibling wrote nothing, searched for rather than tested at one path', () => {
    expect(parallel.afterFirst.failedFound,
      'the failed branch left a candidate somewhere under requirements/').toBe(false);
  });

  test('and the search discriminates, rather than passing because the tree is empty', () => {
    // The negative above is the one Q-0088 found passing for the wrong reason, so the searcher is
    // shown finding a file that IS there before its silence is read as evidence.
    const nest = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-fail-search-'));
    temporaries.push(nest);
    fs.mkdirSync(path.join(nest, 'run-1'), { recursive: true });
    fs.writeFileSync(path.join(nest, 'run-1', 'candidate-claude.md'), 'x');
    expect(found(nest, 'candidate-claude.md'), 'the search cannot see a file one directory down').toBe(true);
    expect(found(nest, 'candidate-codex.md'), 'the search reports a file that is not there').toBe(false);
  });

  test('(d) the failure is recorded and the stage does not advance', () => {
    expect(parallel.afterFirst.runsLog, 'the failed run is not recorded in runs.log').toMatch(/ failed /);
    expect(parallel.afterFirst.ticket, 'a failed run advanced the stage').toMatch(/^stage: draft$/m);
  });

  test('(e) the failed step records what it cost, and the run\'s cost includes it', () => {
    // Money spent by a step that then failed still has to appear in the run's own total: the request
    // was made and charged before it failed, which is what the mock bills.
    expect(parallel.afterFirst.runsLog).toMatch(/step=pm-claude .*FAILED cost=0\.07/);
    const failure = parallel.afterFirst.runsLog.split('\n').find((line) => / failed /.test(line)) ?? '';
    expect(Number(/cost=([\d.]+)/.exec(failure)?.[1] ?? 0),
      `the failed run's cost excludes the failed step (${failure})`).toBeGreaterThanOrEqual(0.07);
  });

  test('(f) the second attempt gets its own run id, asserted as an identity over the ids in runs.log', () => {
    // An identity rather than a uniqueness count: `new Set(ids).size === ids.length` is satisfied by
    // a single id as well as by two distinct ones, so it would pass over a second attempt that never
    // reached the log. A failed run writes no history entry, and this is what says the allocator does
    // not therefore reuse its number.
    expect(parallel.idsAfterSecond, 'the second attempt did not get its own run id').toStrictEqual(['1', '2']);
    expect(parallel.second.status, output(parallel.second)).toBe(0);
  });
});

describe('AC-6 — rollback (a): the abandoned merge', () => {
  test('(a) a failing integrate with no on_fail aborts the run', () => {
    expect(abandoned.invocation.status, output(abandoned.invocation)).not.toBe(0);
    expect(output(abandoned.invocation), 'the run stopped somewhere other than at the failing suite')
      .toContain('tests exit 1, expected pass');
  });

  test('(b) the ticket branch is at exactly the revision it started from', () => {
    // Compared as revisions rather than as messages: two commits with the same subject are two
    // different branch tips, and a rollback that landed on the wrong one would satisfy a message
    // comparison. Both readings are `git rev-parse` of the same ref, taken either side of the run.
    expect(abandoned.after, 'the aborted run moved the ticket branch').toBe(abandoned.before);
    expect(abandoned.before, 'the fixture recorded no revision, so the comparison is two empty strings')
      .toMatch(/^[0-9a-f]{40}$/);
  });

  test('(c) the abandoned merge is gone, so the next red phase measures against a clean base', () => {
    expect(abandoned.ticketTree, 'the abandoned merge survived on the ticket branch').not.toContain('impl.txt');
    expect(abandoned.ticketTree, 'the ticket branch lost the commit it started with').toContain('carried.txt');
  });

  test('(d) and the work itself survives on its own branch — nothing is lost by rolling back', () => {
    // (c) and (d) are one claim in two directions and both are required: (c) alone is satisfied by
    // losing the work, and (d) alone by never rolling back.
    expect(abandoned.sideTree, 'the implementation was lost with the merge that carried it').toContain('impl.txt');
  });

  test('(e) the rollback is recorded in runs.log', () => {
    expect(abandoned.runsLog).toMatch(/rolled-back branch=/);
  });
});

describe('AC-7(b1) — rollback (b): the base-sync conflict', () => {
  test('(a) it fails the run', () => {
    expect(clashed.invocation.status, output(clashed.invocation)).not.toBe(0);
  });

  test('(b) and (c) — it names the two branches that disagree, and says why looping would not help', () => {
    // Q-0011 burned all three iterations and $8.63 learning this, because `integrate` routed a base
    // conflict into `on_fail` like any test failure. The developers' worktrees branch from the ticket
    // branch, where nothing is wrong.
    //
    // Both names, each in its own position, because AC-7(b1)(b) is about *attribution*: `cannot sync
    // .* with ` — the form this replaces — is satisfied by any two subjects, by the two the wrong way
    // round, and by none at all, so it would report success over a diagnostic that sent a maintainer
    // to the wrong branch. That is the failure this ticket exists to make impossible, arriving in the
    // assertion rather than in the product.
    expect(output(clashed.invocation), 'the diagnostic does not name the ticket branch and the base, in that order')
      .toMatch(NAMES_BOTH);
    expect(output(clashed.invocation)).toContain('re-running the developers cannot fix it');
  });

  test('(b) and the clause discriminates: it refuses the two branches the wrong way round', () => {
    // The check on the check. A swap is the shape a wrong attribution actually takes — `into` and
    // `base` are two arguments of one template — so it is what the clause has to reject, and a
    // regexp built from the two names could still be satisfied by either order if it were written
    // with a `.*` between them.
    expect(NAMES_BOTH.test(`integrate: cannot sync ${INTEGRATION} with ${BASE_BRANCH} — conflict.`),
      'the clause cannot see the sentence the product prints').toBe(true);
    expect(NAMES_BOTH.test(`integrate: cannot sync ${BASE_BRANCH} with ${INTEGRATION} — conflict.`),
      'the two branches the wrong way round satisfy the clause').toBe(false);
    expect(NAMES_BOTH.test('integrate: cannot sync  with  — conflict.'),
      'a diagnostic naming neither branch satisfies the clause').toBe(false);
  });

  test('(d) a base conflict does not consume the iteration budget', () => {
    // The flow's `on_fail` would loop three times, so `iteration 1/3` is what its absence is about.
    expect(clashed.invocation.stdout, 'the base conflict was routed into on_fail like a test failure')
      .not.toContain('iteration 1/3');
  });

  test('(e) and it is distinguishable in runs.log from an ordinary integrate failure', () => {
    expect(clashed.runsLog).toMatch(/base-conflict base=/);
  });
});

describe('§3 R-4 to R-6 — the properties this suite has to have to be worth running', () => {
  test('R-4 — no path literal and no specifier names the spike tree, so this survives the cutover', () => {
    // Two shapes, because a read can be written either way: a path with a separator in it, and a
    // bare segment handed to `path.join`. The same pair `end-to-end.test.ts` asserts over its own
    // source, for the same reason — the cutover deletes that tree, and a suite that named it would
    // fail on the day rather than before it.
    expect(SOURCE.match(/spike\//g) ?? [], 'a path under the spike tree is named').toStrictEqual([]);
    expect(SOURCE.match(/['"`]spike['"`]/g) ?? [], 'a bare path segment naming the spike tree').toStrictEqual([]);
    const asPath = assembled('const engine = read(root, ', "'", 'spi', "ke/src/engine.js'", ');');
    expect(/spike\//.test(asPath), 'the first clause cannot see a path under that tree').toBe(true);
    const asSegment = assembled('path.join(root, ', "'", 'spi', "ke'", ", 'test');");
    expect(/['"`]spike['"`]/.test(asSegment), 'the second clause cannot see a bare segment').toBe(true);
  });

  test('R-5 — the sanitiser discriminates: an ambient switch does not reach a spawned process', () => {
    // Over an environment composed here rather than over this machine's, which sets none of them and
    // would therefore prove nothing. The three clauses are the three ways this could be wrong: a
    // switch survives, the declared override is lost, or the sanitiser takes something it was not
    // asked to take.
    const ambient = Object.fromEntries(STEERING.map((name) => [name, 'ambient']));
    const env = sanitised({ ...ambient, PATH: 'kept' }, { MOCK_ALWAYS_FAIL: '1' });
    expect(STEERING.filter((name) => env[name] !== undefined), 'an ambient switch survived the sanitiser')
      .toStrictEqual(['MOCK_ALWAYS_FAIL']);
    expect(env.MOCK_ALWAYS_FAIL, 'the call\'s own override was removed with the rest').toBe('1');
    expect(env.PATH, 'the sanitiser removed something no criterion asked it to').toBe('kept');
    expect(Object.keys(ambient).length, 'the fixture environment carries nothing, so it discriminates nothing')
      .toBe(STEERING.length);
  });

  test('R-5 — and no scenario inherited one: each carried only what its own call declared', () => {
    // The two switches this file sets are the two that decide a verdict, so a run that inherited the
    // other would reach a different gate and every wording assertion above would still pass.
    expect(exhausted.steering).toStrictEqual({ MOCK_ALWAYS_FAIL: '1' });
    expect(unanswered.invocation.steering, 'the unanswered route was handed a forcing switch').toStrictEqual({});
    expect(retried.invocation.steering).toStrictEqual({ MOCK_ALWAYS_FAIL: '1' });
    expect(parallel.first.steering).toStrictEqual({ MOCK_FAIL_WRITE: 'candidate-claude.md' });
    expect(parallel.second.steering, 'the second attempt inherited the first\'s failure switch').toStrictEqual({});
    expect(abandoned.invocation.steering).toStrictEqual({});
    expect(clashed.invocation.steering).toStrictEqual({});
  });

  test('R-6 — the one thing this machine could withhold is refused rather than skipped', () => {
    expect(SOURCE).toContain('this suite refuses rather than reporting a pass over rollbacks it never ran');
    for (const shape of [/\b(?:test|describe|it)\.(?:skip|todo|skipIf|runIf|only|failing)\b/g,
      /\bctx\.(?:skip|annotate)\(/g]) {
      expect(SOURCE.match(shape) ?? [], `${shape.source} lets a block report success over a subject it did not examine`)
        .toStrictEqual([]);
    }
  });

  test('R-6 — and the refusal is decided by running sh, not by reading the platform\'s name', () => {
    // Three clauses, because a probe can be wrong in three ways: it can refuse a machine that has a
    // subject, admit one that cannot spawn the shell at all, or admit one whose `sh` starts and
    // ignores `-c`. The middle and the last are the two a `process.platform` test cannot see, and
    // they are shown firing over commands composed here rather than over this machine's.
    expect(shellRefusal(SHELL), 'sh ran this file\'s fixtures, so a refusal here withholds a subject it has')
      .toBeNull();

    const absent = 'quorum-no-such-shell-on-any-platform';
    expect(shellRefusal(absent) ?? '', 'a shell that cannot be executed produced no refusal').toContain(absent);

    // `node -c <arg>` reads its argument as a filename to syntax-check, so it starts, declines and
    // exits non-7 — a binary that is on the machine and is not a shell, which is the case a probe
    // asking merely for exit 0 or for the file's existence would admit.
    expect(shellRefusal(process.execPath) ?? '', 'a binary that starts and does not interpret -c produced no refusal')
      .toContain('is not a shell that interprets -c');

    // And the decision is taken from the platform's name nowhere. The defect this replaces was a
    // `win32` comparison standing in for the probe, and its return would be invisible to the three
    // clauses above — all of which stay green beside it. The needle is assembled so that forbidding
    // it does not require this file to exempt itself, as the cutover scan above does.
    const byName = assembled('process.plat', 'form ===');
    expect(SOURCE, 'the platform name decides the refusal again').not.toContain(byName);
    expect(assembled('if (process.plat', "form === 'win32') throw new Error('…');").includes(byName),
      'the clause cannot see the comparison it forbids').toBe(true);
  });
});

describe('AC-13 — nothing is described twice, and the chain is written down where a reader meets it', () => {
  test('the header names the suite that already carries three of these behaviours, and its scenarios', () => {
    // Deliberately a weak check: the strong one is a reviewer reading the header against the diff.
    // It exists so that a reader editing this file meets the statement — a chain recorded only in
    // `spike-parity.test.ts`'s prose is one the implementer of the NEXT change does not meet
    // (`requirements/errata.md` E-1). The same shape `end-to-end.test.ts:484` uses for its own.
    const header = SOURCE.slice(0, SOURCE.indexOf(' */'));
    expect(header, 'the header does not name the suite that carries the in-process half')
      .toContain('run.test.ts');
    for (const id of ['S10.6', 'S10.7']) {
      expect(header, `the header does not say what ${id} already carries`).toContain(id);
    }
    expect(header, 'the header does not say what the spawned form adds').toContain('New here:');
  });
});
