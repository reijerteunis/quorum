/**
 * Q-0094 — `quorum run`, its flags, its preflight and the exit code it maps a terminal status to.
 *
 * **The translated binary half of four spike files.** `q0040-undecided.js`'s `cliFixture` block —
 * the five gate sites, their exit codes, exit 3 as its own code and `--gate-answer undecided`
 * refused; `q0033-surface.js`'s S10.1–S10.7, E3, E4 and E7; `q0077-base-flag.js`'s B5 and B7; and
 * `q0034-review-fixes.js`'s B3, whose whole binary claim is that a `FlowError` reaches the terminal
 * as one sentence and exit 1. `spike-parity.test.ts` records each on its own row.
 *
 * **Every fixture is a project this suite created and scaffolded through `quorum init`**, so the
 * flows a run loads are the shipped ones and no verdict depends on this checkout. The git
 * repositories are built here with an explicit identity on the one call that writes an object
 * (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
 * 2026-08-30), and the mock adapter is selected with `--adapter mock` and steered with the two
 * environment switches `packages/core/src/adapters/mock.ts:9–10` reads, set through `vi.stubEnv`.
 *
 * **Nothing here spawns the binary.** `build.test.ts` is the one file Q-0098 AC-15(c) rules may
 * spawn the emit, and requiring a build to test a gate would make this suite's verdict a property
 * of whether `dist/` exists — the assertion Q-0096's round 2 retired for exactly that. The three
 * sites that need a terminal are `gate.test.ts`'s, over the streams the reader takes as parameters.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Event } from '@quorum/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ABORTED, ERROR, SUCCESS, UNDECIDED } from './exit.js';
import { consumeRun, exitCodeFor } from './run.js';
import { capture, invoke, plain } from '../test/invoke.js';

/** Where every fixture of one test lives, removed afterwards. */
let sandbox = '';

beforeEach(() => {
  // Realpathed: on macOS `os.tmpdir()` is a symlink, and `loadProject` resolves what it is given, so
  // an unresolved fixture path would make a message assertion fail for a reason that is a property
  // of the machine rather than of the command.
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-run-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(sandbox, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A scaffolded project with one `draft` ticket, built through this package's own two commands. */
async function project(name = 'project'): Promise<string> {
  const dir = path.join(sandbox, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  expect((await invoke(['init', dir])).exitCode, 'the fixture could not scaffold').toBe(SUCCESS);
  expect((await invoke(['ticket', 'new', 'Gate sites', '--project', dir])).exitCode,
    'the fixture could not create a ticket').toBe(SUCCESS);
  return dir;
}

/** The ticket folder `ticket new` allocated — `T-0001-…`, whose exact slug is the allocator's. */
const ticketDir = (dir: string): string => {
  const folder = fs.readdirSync(path.join(dir, 'backlog')).find((entry) => entry.startsWith('T-0001'));
  expect(folder, 'the fixture allocated no T-0001 folder').toBeDefined();
  return path.join(dir, 'backlog', folder ?? '');
};

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');

/** Move the fixture's ticket to `stage`, for a flow that consumes something other than `draft`. */
const setStage = (dir: string, stage: string): void => {
  const file = path.join(ticketDir(dir), 'ticket.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^stage: \w+$/m, `stage: ${stage}`));
};

/** One extra flow file in a scaffolded project's own flow directory. */
const writeFlow = (dir: string, name: string, lines: readonly string[]): void =>
  fs.writeFileSync(path.join(dir, 'harness', 'flows', `${name}.yaml`), `${lines.join('\n')}\n`);

/** The command line every run in this file starts from. */
const RUN = (dir: string, ...extra: string[]): string[] =>
  ['run', 'requirements', 'T-0001', '--project', dir, '--adapter', 'mock', ...extra];

/** Everything a caller of the binary would have seen, escapes stripped. */
const output = (invocation: { stdout: string; stderr: string }): string =>
  plain(invocation.stdout + invocation.stderr);

describe('AC-1 — the frame dispatches run, and its two argument refusals are the spike\'s', () => {
  test('no flow and no ticket each print the usage line verbatim and exit 1', async () => {
    for (const argv of [['run'], ['run', 'requirements']]) {
      const result = await invoke(argv);
      expect({ exitCode: result.exitCode, hard: result.hard }, argv.join(' '))
        .toStrictEqual({ exitCode: ERROR, hard: true });
      expect(plain(result.stderr)).toContain(
        'usage: harness run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock]'
        + ' [--verbose] [--gate-answer advance|retry|abort]',
      );
    }
  });

  test('Q-0100 fifth instance — the usage line says `harness`, preserved rather than fixed', async () => {
    // Registered, not repaired (non-goal 3). Its two landed neighbours keep theirs, so spelling this
    // one `quorum` would make one command disagree with the other two while pre-empting the ruling
    // that owns all of them. The pin is what makes the eventual fix a deliberate act.
    const result = await invoke(['run']);
    expect(plain(result.stderr)).toContain('usage: harness run');
    expect(plain(result.stderr), 'the usage line was renamed here rather than by Q-0100')
      .not.toContain('usage: quorum run');
  });

  test('B5 — a valueless --base is refused before any project is opened, and the usage names the flag', async () => {
    // `--base` with no value parses to the boolean `true`: it names no revision, so it is refused
    // rather than coerced into the string "true" and interpolated into a diff range.
    const refused = await invoke(['run', 'review', 'T-9', '--base']);
    expect({ exitCode: refused.exitCode, hard: refused.hard }).toStrictEqual({ exitCode: ERROR, hard: true });
    expect(plain(refused.stderr)).toContain('--base needs a revision: harness run <flow> <ticket> --base <ref>');
    // Before any project is opened: this ran in a directory with no `harness/harness.yaml` anywhere
    // above it, and the refusal is the flag's rather than `no harness/harness.yaml found`.
    expect(plain(refused.stderr), 'a project was opened first').not.toContain('harness.yaml found');
    const usage = await invoke(['run']);
    expect(plain(usage.stderr), 'the usage string names the flag').toContain('[--base <ref>]');
  });
});

describe('AC-9 — the exit code is the terminal event\'s, through the table that already exists', () => {
  test('a passing run answered advance completes and exits 0', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance'));
    expect({ exitCode: result.exitCode, hard: result.hard }, output(result))
      .toStrictEqual({ exitCode: SUCCESS, hard: true });
    expect(output(result)).toContain('run #1 completed: draft → requirements');
    expect(read(ticketDir(dir), 'ticket.md')).toMatch(/stage: requirements/);
  });

  test('--gate-answer abort ends the run aborted and exits 2', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'abort'));
    expect(result.exitCode, output(result)).toBe(ABORTED);
    expect(read(ticketDir(dir), 'ticket.md'), 'an aborted run moved the stage').toMatch(/stage: draft/);
  });

  test('a backward edge to another flow regresses the ticket and still exits 0', async () => {
    // Why: preserved defect, see Q-0090 AC-4(c) — `spike/bin/harness.js:557` names only `aborted`
    // and `undecided`, so `regressed` reaches the fallthrough and reports success. Registered rather
    // than fixed (non-goal 4), and asserted through a whole run rather than only through the table,
    // because a run that regressed is the one status a script would most want to tell from 0.
    vi.stubEnv('MOCK_ALWAYS_FAIL', '1');
    const dir = await project();
    // `green`, because the whole-directory lint requires a cross-flow `goto` to return to the stage
    // the flow consumes — `development` produces `green`, so a `draft` flow pointing at it fails the
    // preflight rather than reaching the run. That is `review.yaml`'s own shape, reproduced here
    // rather than run against `review.yaml`, which needs a diff range and a branch.
    setStage(dir, 'green');
    writeFlow(dir, 'regress', [
      'name: regress', 'consumes: green', 'produces: reviewed', 'steps:',
      '  - id: judge', '    role: head-of-product', '    adapter: mock',
      '    input: { backlog: [ticket.md] }',
      '    output: { write: "regress.md", verdict: ready|needs-input }',
      '    on_fail: { goto: "flow:development", counter: regress, max_iterations: 1, on_exhausted: gate }',
    ]);
    const result = await invoke(['run', 'regress', 'T-0001', '--project', dir, '--adapter', 'mock']);
    expect(result.exitCode, output(result)).toBe(SUCCESS);
    expect(output(result)).toContain('backward edge → flow:development');
    expect(output(result)).toContain('run #1 regressed');
    expect(read(ticketDir(dir), 'ticket.md'), 'the ticket did not regress').toMatch(/stage: red/);
  });

  test('AC-9(2) — a stream that ends without a terminal event is not success', async () => {
    // No `runFlow` ends without one, so the claim has a subject only here: `exitCodeFor` is handed
    // the value `consumeRun` returns for such a stream, and must refuse rather than report 0. A
    // silent false green is the one failure the exit-code contract cannot survive.
    const result = await capture(() => { exitCodeFor(undefined); });
    expect({ exitCode: result.exitCode, hard: result.hard }).toStrictEqual({ exitCode: ERROR, hard: true });
    expect(plain(result.stderr)).toContain('produced no terminal event');
  });

  test('and every one of the six statuses maps to the code the table names', () => {
    const terminal = (status: string): Parameters<typeof exitCodeFor>[0] => ({
      type: 'terminal', status, runId: 1, stageBefore: 'draft', stageAfter: 'draft', cost: 0, tokens: 0,
    } as Parameters<typeof exitCodeFor>[0]);
    expect({
      completed: exitCodeFor(terminal('completed')),
      // Why: preserved defect, see Q-0090 AC-4(c) — `spike/bin/harness.js:557` names only `aborted`
      // and `undecided`, so `regressed` reaches the fallthrough and reports success.
      regressed: exitCodeFor(terminal('regressed')),
      aborted: exitCodeFor(terminal('aborted')),
      undecided: exitCodeFor(terminal('undecided')),
      failed: exitCodeFor(terminal('failed')),
      interrupted: exitCodeFor(terminal('interrupted')),
    }).toStrictEqual({
      completed: 0, regressed: 0, aborted: 2, undecided: 3, failed: 1, interrupted: 130,
    });
  });
});

describe('AC-6 — answers exhausted with no terminal is undecided, and the work is intact', () => {
  test('exit 3 is its own code, nothing is rolled back, and the stage does not move', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir));
    // Not merely non-zero: 1 is an operator error and 2 is a deliberate abort, so a script wrapping
    // this command can tell "nobody was there" from either.
    expect(result.exitCode, output(result)).toBe(UNDECIDED);
    expect(output(result)).toContain('needs an answer and stdin closed without one — pass --gate-answer');
    expect(output(result)).toContain('nothing was rolled back');
    expect(output(result)).toContain('run #1 undecided');
    expect(read(ticketDir(dir), 'ticket.md')).toMatch(/stage: draft/);
  });

  test('AC-6(3) — stdin is not read on that path, even when an answer is piped at it', async () => {
    // S10.4. The fixture's TTY predicate answers false and its input stream carries `advance\n`; a
    // reader that fell back to whatever happens to be on stdin would advance the gate instead.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir));
    expect(result.exitCode, output(result)).toBe(UNDECIDED);
    expect(output(result)).not.toContain('(from --gate-answer)');
  });
});

describe('AC-5 — --gate-answer is a queue: in order, exact, once each, and leftovers are silent', () => {
  test('S10.1/S10.2 — answers are consumed in command-line order across two gates', async () => {
    // A failing head-of-product exhausts its bounded loop, which synthesises a `human-locked` gate;
    // the flow's own `gate: human` follows it. The first queued answer goes to the first gate asked,
    // never to the gate whose kind it looks like.
    vi.stubEnv('MOCK_ALWAYS_FAIL', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance', '--gate-answer', 'abort'));
    expect(result.exitCode, output(result)).toBe(ABORTED);
    expect(read(ticketDir(dir), 'runs.log')).toMatch(
      /gate=human-locked answer=advance[\s\S]*gate=human answer=abort[\s\S]*aborted stage=draft→draft/,
    );
    expect(read(ticketDir(dir), 'ticket.md')).toMatch(/stage: draft/);
  });

  test('S10.3 — an abbreviation is refused, and the run fails rather than going undecided', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'ad'));
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(output(result)).toContain('received --gate-answer "ad" — expected exactly one of: advance / abort (no abbreviations)');
  });

  test('a valueless --gate-answer is reported as `true` rather than as an empty word', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer'));
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(output(result)).toContain('received --gate-answer "true"');
  });

  test('AC-5(8) — `undecided` is a run status and never a gate answer', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'undecided'));
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(output(result)).toMatch(/expected exactly one of: advance \/ (retry \/ )?abort/);
  });

  test('AC-5(4) — a word that is wrong for this gate does not let the next queued answer take its place', async () => {
    // The sharpest of the queue's properties, and the one a reader that fell through would satisfy
    // every message assertion without holding: `abort` is queued behind an invalid word, and the run
    // must fail on the word rather than abort on the answer meant for the gate after it.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'ad', '--gate-answer', 'abort'));
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(result.exitCode, 'the queued abort answered the gate the bad word was meant for').not.toBe(ABORTED);
    expect(read(ticketDir(dir), 'runs.log'), 'a gate was answered at all').not.toMatch(/gate=human answer=/);
  });

  test('AC-5(6) — an accepted scripted answer echoes what it answered and where it came from', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance'));
    expect(plain(result.stdout)).toContain('  advance / abort > advance  (from --gate-answer)');
  });

  test('E7 — leftover answers are ignored without comment, and the run still exits 0', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance', '--gate-answer', 'advance', '--gate-answer', 'advance'));
    expect(result.exitCode, output(result)).toBe(SUCCESS);
    expect(output(result)).not.toMatch(/unused|unconsumed|leftover/i);
  });

  test('E4 — an explicit answer for every gate avoids the stdin refusal entirely', async () => {
    vi.stubEnv('MOCK_ALWAYS_FAIL', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance', '--gate-answer', 'abort'));
    expect(output(result)).not.toMatch(/stdin closed without one/i);
  });

  test('AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it', async () => {
    // Reachable only because these invocations share a process, which the spike's spawned binary
    // never could. A reader consuming `ParsedArgv.gateAnswers` in place would leave the second run
    // with an empty queue and send it `undecided`.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const first = await project('one');
    const second = await project('two');
    expect((await invoke(RUN(first, '--gate-answer', 'advance'))).exitCode).toBe(SUCCESS);
    const again = await invoke(RUN(second, '--gate-answer', 'advance'));
    expect(again.exitCode, output(again)).toBe(SUCCESS);
  });
});

describe('AC-13 — the flags reach the run, and --base moves the anchor and nothing else', () => {
  test('--dry writes nothing and its gates report that they would pause', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--dry'));
    expect(result.exitCode, output(result)).toBe(SUCCESS);
    expect(output(result)).toContain('would pause here');
    expect(read(ticketDir(dir), 'ticket.md'), 'a dry run moved the stage on disk').toMatch(/stage: draft/);
    expect(fs.existsSync(path.join(ticketDir(dir), 'runs.log')), 'a dry run wrote a run log').toBe(false);
  });

  test('AC-4(3) — neither --dry nor --auto prints a gate banner or a prompt', async () => {
    // `askGate` returns before it emits the question in both cases, so the banner has no event to be
    // rendered from and the reader is never called. The `info` line it emits instead is rendered by
    // the ordinary `info` row and needs no special case.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dry = await invoke(RUN(await project('dry'), '--dry'));
    expect(output(dry)).not.toContain('■ GATE');
    expect(output(dry)).not.toMatch(/advance \/ abort >/);
    const auto = await invoke(RUN(await project('auto'), '--auto'));
    expect(output(auto), output(auto)).toContain('gate: auto-advanced (human)');
    expect(output(auto)).not.toContain('■ GATE');
    expect(output(auto)).not.toMatch(/advance \/ abort >/);
  });

  test('S10.6 — --auto cannot answer an exhaustion gate, and alone it ends the run undecided', async () => {
    // *"Erratum: `--auto` does reach an unanswered gate, and can end a run undecided"* (2026-09-01)
    // is the reading this is built against; decision 076's earlier sentence is not.
    vi.stubEnv('MOCK_ALWAYS_FAIL', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--auto'));
    expect(result.exitCode, output(result)).toBe(UNDECIDED);
    expect(output(result)).toMatch(/human-locked|loop exhausted/i);
    expect(output(result), 'auto answered the gate it may not answer').not.toContain('auto-advanced (human-locked)');
  });

  test('S10.7 — a retry answer at the exhaustion gate persists the counter it authorised', async () => {
    vi.stubEnv('MOCK_ALWAYS_FAIL', '1');
    const dir = await project();
    await invoke(RUN(dir, '--gate-answer', 'retry', '--gate-answer', 'abort'));
    expect(read(ticketDir(dir), 'runs.log')).toMatch(/gate=retry.*counter=requirements\.head-of-product.*set=1/);
  });

  test('E3 — a repeated --adapter is last-wins, like every flag but --gate-answer', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--adapter', 'doesnotexist', '--adapter', 'mock', '--auto', '--gate-answer', 'advance'));
    expect(result.exitCode, output(result)).toBe(SUCCESS);
    expect(output(result)).toContain('mock');
  });

  test('AC-13(5) — the override reaches a step the walk cannot touch, through the config', async () => {
    // Both halves are set on the same line the spike sets them on, and they reach two different
    // kinds of step. `overrideAdapters` rewrites only a step that ALREADY names an adapter, and
    // deliberately never descends into a `fan_out` step's `step:` template — so `adapterOverride` is
    // what reaches everything else. The probe flow's one step names none and its role names
    // `claude`, so the walk provably did not touch it: a run with only the walk would resolve
    // `claude` and the step line would say so.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    writeFlow(dir, 'probe', [
      'name: probe', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: probe', '    role: product-manager', '    input: { backlog: [ticket.md] }',
      '    output: { write: "probe.md" }',
    ]);
    const result = await invoke(['run', 'probe', 'T-0001', '--project', dir, '--adapter', 'mock', '--auto']);
    expect(result.exitCode, output(result)).toBe(SUCCESS);
    expect(plain(result.stdout), 'the step resolved its role\'s adapter, not the override')
      .toMatch(/^▸ probe mock\b/m);
    expect(plain(result.stdout)).not.toMatch(/^▸ probe claude\b/m);
  });

  test('B7 — an unresolvable --base is blamed on the flag, end to end', async () => {
    // The last link, as B5 is for the flag's parsing: argv → runFlow → the diagnostic a maintainer
    // actually reads. The ticket branch exists, so the only endpoint that can fail is the one the
    // flag names, and the message must not send anyone to a file it did not read the value from.
    const dir = await project();
    git(dir, 'branch', 'harness/T-0001/integration', 'main');
    writeFlow(dir, 'anchored', [
      'name: anchored', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: look', '    role: product-manager', '    adapter: mock',
      '    input: { diff: "{base}...harness/{id}/integration" }',
      '    output: { write: "look.md" }',
    ]);
    const result = await invoke(['run', 'anchored', 'T-0001', '--project', dir, '--adapter', 'mock',
      '--base', 'no-such-revision', '--auto']);
    expect(result.exitCode, output(result)).toBe(ERROR);
    const text = output(result);
    expect(text, 'it names the flag').toContain('--base');
    expect(text, 'it names the revision supplied').toContain('no-such-revision');
    expect(text, 'it sent the maintainer to a file it did not read the value from')
      .not.toContain('repo.base_branch');
    expect(text).not.toContain('harness.yaml');
  });

  test('and with no flag the same unresolvable value is blamed on the configuration file instead', async () => {
    // The other half of the attribution, and what makes B7 a measurement rather than a wording: the
    // value is identical and only the flag differs, so a CLI that never threaded `--base` would
    // produce this message in both tests.
    const dir = await project();
    git(dir, 'branch', 'harness/T-0001/integration', 'main');
    const config = path.join(dir, 'harness', 'harness.yaml');
    fs.writeFileSync(config, read(config).replace('base_branch: main', 'base_branch: no-such-revision'));
    writeFlow(dir, 'anchored', [
      'name: anchored', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: look', '    role: product-manager', '    adapter: mock',
      '    input: { diff: "{base}...harness/{id}/integration" }',
      '    output: { write: "look.md" }',
    ]);
    const configured = await invoke(['run', 'anchored', 'T-0001', '--project', dir, '--adapter', 'mock', '--auto']);
    expect(configured.exitCode, output(configured)).toBe(ERROR);
    expect(output(configured)).toMatch(/repo\.base_branch in harness\/harness\.yaml names missing ref "no-such-revision"/);
    expect(output(configured)).not.toContain('--base');

    // And an override naming the configured value is still an override: attribution keys on whether
    // the flag was TYPED, never on whether its value differs from the configured branch.
    const overridden = await invoke(['run', 'anchored', 'T-0001', '--project', dir, '--adapter', 'mock',
      '--base', 'no-such-revision', '--auto']);
    expect(output(overridden)).toContain('--base');
    expect(output(overridden)).not.toContain('repo.base_branch');
  });

  test('AC-3 — --verbose gates stdout, end to end', async () => {
    // Only the `stdout` half is observable here: the mock adapter emits `stdout` and no `spawn` or
    // `retry` (`packages/core/src/adapters/mock.ts:105`), so the other two rows of AC-3's table —
    // and the claim that `--verbose` does not gate them — are asserted in `trace.test.ts`, over the
    // renderer itself. Without that companion this pair would be satisfied by a renderer that
    // dropped all three.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const quiet = await invoke(RUN(await project('quiet'), '--auto'));
    const loud = await invoke(RUN(await project('loud'), '--auto', '--verbose'));
    const stdoutLines = (text: string): string[] =>
      plain(text).split('\n').filter((line) => /^ {2}\[[^\]]+] (?!\$)/.test(line));
    expect(stdoutLines(quiet.stdout), 'a quiet run showed a step\'s stdout').toStrictEqual([]);
    expect(stdoutLines(loud.stdout).length, '--verbose showed no stdout at all').toBeGreaterThan(0);
    expect(stdoutLines(loud.stdout)[0]).toContain('[mock]');
  });
});

describe('AC-2 — the preflight runs in the spike\'s order, and a clean lint is silent', () => {
  test('a clean flow directory prints no lint line at all', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--auto'));
    expect(plain(result.stdout), 'the run preflight printed a per-file lint report')
      .not.toMatch(/^✓ requirements\.yaml$/m);
  });

  test('a broken flow stops the run before anything is written, with `lint`\'s own diagnostic', async () => {
    const dir = await project();
    writeFlow(dir, 'bad', [
      'name: bad', 'consumes: x', 'produces: y', 'steps:', '  - id: bad',
      '    on_fail: {goto: "flow:missing", counter: bad, max_iterations: 3, on_exhausted: gate}',
    ]);
    const lint = await invoke(['lint', '--project', dir]);
    const run = await invoke(RUN(dir));
    expect(run.exitCode, output(run)).toBe(ERROR);
    expect(output(run)).toContain('missing');
    // The identical diagnostic for the identical defect, which is why the renderer is shared rather
    // than spelled twice: the block `lint` prints for `bad.yaml` is the block the preflight prints.
    const block = (text: string): string =>
      plain(text).split('\n').filter((line) => line.startsWith('✗ bad.yaml') || line.startsWith('  - ')).join('\n');
    expect(block(run.stdout)).toBe(block(lint.stdout));
    expect(block(run.stdout), 'the shared renderer produced nothing — this proves nothing').not.toBe('');
    // Nothing was written: the preflight is before the ticket is read and before the run starts.
    expect(fs.existsSync(path.join(ticketDir(dir), 'runs.log')), 'the preflight wrote runs.log').toBe(false);
    expect(fs.existsSync(path.join(ticketDir(dir), 'requirements')), 'the preflight wrote artifacts').toBe(false);
  });

  test('AC-2(4) — the directory is linted before --adapter rewrites a step, not after', async () => {
    // The ordering is the criterion: a directory declaring a legitimate cross-vendor panel must not
    // appear single-vendor because execution later points every step at one adapter. Asserted by
    // giving the run an override AND a broken flow — a preflight running after the override would
    // still refuse, so what discriminates is that the refusal happens with the flow file's own
    // declared adapters intact, which the diagnostic below names.
    const dir = await project();
    writeFlow(dir, 'panel', [
      'name: panel', 'consumes: draft', 'produces: requirements', 'cross_vendor: required', 'steps:',
      '  - parallel:', '    - id: a', '      role: product-manager', '      adapter: claude',
      '      output: { write: "a.md" }', '    - id: b', '      role: product-manager',
      '      adapter: claude', '      output: { write: "b.md" }',
    ]);
    const result = await invoke(['run', 'panel', 'T-0001', '--project', dir, '--adapter', 'mock', '--auto']);
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(output(result), 'the override hid the single-vendor panel from the lint')
      .toMatch(/panel\.yaml[\s\S]*cross_vendor/);
  });

  test('AC-2(1) — no project is a sentence and exit 1, not a Node stack', async () => {
    // Reached by standing somewhere with no `harness/harness.yaml` above it and passing no
    // `--project`, which is the only shape that produces `ProjectNotFoundError`: with an explicit
    // directory `loadProject` resolves it and reads, so a directory that is simply not a project
    // raises `ENOENT` and prints a stack. Why: preserved — `spike/bin/harness.js:53–55` does the
    // same, and the sentence exists for the discovery case.
    const nowhere = path.join(sandbox, 'nowhere');
    fs.mkdirSync(nowhere);
    const cwd = process.cwd();
    process.chdir(nowhere);
    try {
      const result = await invoke(['run', 'requirements', 'T-0001']);
      expect({ exitCode: result.exitCode, hard: result.hard }).toStrictEqual({ exitCode: ERROR, hard: true });
      expect(plain(result.stderr)).toContain('no harness/harness.yaml found');
      expect(plain(result.stderr), 'a stack reached the terminal').not.toContain('    at ');
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('AC-10 — one sentence for a FlowError, a stack for anything else', () => {
  test('B3 — a stage mismatch is one red sentence and exit 1, with no stack and no terminal event', async () => {
    // The failure raised before any terminal event: `engine.ts:189–191` throws outside the run's own
    // `try`, so the handler must not require a terminal event to have arrived. The other side of
    // AC-9(2), and the reason the two are separate claims.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(['run', 'review', 'T-0001', '--project', dir, '--adapter', 'mock']);
    expect({ exitCode: result.exitCode, hard: result.hard }, output(result))
      .toStrictEqual({ exitCode: ERROR, hard: true });
    expect(plain(result.stderr)).toContain('is at stage "draft", flow "review" consumes "green"');
    expect(plain(result.stderr), 'a stack reached the terminal').not.toContain('    at ');
    expect(plain(result.stderr).split('\n').filter(Boolean), 'more than one line reached stderr').toHaveLength(1);
  });

  test('a run that fails at a gate refusal prints its sentence once and exits 1', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'nope'));
    expect(result.exitCode, output(result)).toBe(ERROR);
    expect(plain(result.stderr)).toContain('✗ gate (human)');
    expect(plain(result.stderr), 'a stack reached the terminal').not.toContain('    at ');
  });

  test('AC-10(2) — an unknown adapter is not a FlowError, so its stack still reaches the top', async () => {
    // `getAdapter` throws a plain `Error`, and the spike prints a stack for it. Preserved: the
    // rethrow is what `main().catch(dieOnUnexpected)` is for, and folding it into a sentence would
    // hide a defect behind an operator error.
    //
    // Over a single-step flow rather than the shipped `requirements`, whose first step is a
    // `parallel:` group: `routing.ts:70` collects a failed group into a `FlowError`, so that route
    // reaches `die` for a reason that has nothing to do with the adapter name. The distinction is
    // the criterion, so the fixture is the one that shows it.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    writeFlow(dir, 'probe', [
      'name: probe', 'consumes: draft', 'produces: requirements', 'steps:',
      '  - id: probe', '    role: product-manager', '    input: { backlog: [ticket.md] }',
      '    output: { write: "probe.md" }',
    ]);
    await expect(invoke(['run', 'probe', 'T-0001', '--project', dir, '--adapter', 'doesnotexist']))
      .rejects.toThrow(/unknown adapter "doesnotexist"/);
  });
});

describe('AC-3 — the run\'s own summary line is printed once', () => {
  test('R-2 — the terminal event prints nothing, so the outcome is not reported twice', async () => {
    // `core` emits the human line as an `info` immediately before the terminal event
    // (`lifecycle.ts:155`). A renderer that also formatted the terminal event would print every
    // run's outcome twice, and the doubling reads as a formatting nit rather than as the misreading
    // of the interface that it is.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const result = await invoke(RUN(dir, '--gate-answer', 'advance'));
    const summaries = plain(result.stdout).split('\n').filter((line) => /run #\d+ \w+:/.test(line));
    expect(summaries, output(result)).toHaveLength(1);
  });
});

describe('AC-11 — the signal handler is this package\'s, installed per run', () => {
  test('a run installs one SIGINT and one SIGTERM listener and removes both, twice over', async () => {
    // Counted before and after rather than asserted to be zero: whatever the runner installs for
    // itself is not this package's. Repeated, because a handler registered at module scope — or one
    // a path forgot to remove — accumulates, and one invocation cannot show that.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const count = (): Record<string, number> =>
      ({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') });
    const before = count();
    expect((await invoke(RUN(await project('one'), '--auto'))).exitCode).toBe(SUCCESS);
    expect(count(), 'the first run left a listener behind').toStrictEqual(before);
    expect((await invoke(RUN(await project('two'), '--auto'))).exitCode).toBe(SUCCESS);
    expect(count(), 'listeners accumulate across invocations').toStrictEqual(before);
  });

  test('and a run that failed removes them too', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const count = (): number => process.listenerCount('SIGINT') + process.listenerCount('SIGTERM');
    const before = count();
    const dir = await project();
    expect((await invoke(RUN(dir, '--gate-answer', 'nope'))).exitCode).toBe(ERROR);
    expect(count(), 'a failing run left its handlers installed').toBe(before);
  });
});

describe('R-5 — the loop keeps pulling while a gate is open', () => {
  test('consumeRun renders every event and cues the reader for each gate, awaiting nothing', async () => {
    // The stream-shaped half of the loop, over events this test wrote: the renderer sees all of
    // them in order, each gate is announced by id, and the terminal event is the value returned
    // rather than a line printed.
    const announced: string[] = [];
    const events: Event[] = [
      { type: 'info', message: 'one' },
      { type: 'gate', gateId: '1:1', kind: 'human', reason: 'why', ticketDir: '/t' },
      { type: 'gate', gateId: '1:2', kind: 'human-locked', reason: 'other', ticketDir: '/t' },
      { type: 'terminal', status: 'completed', runId: 1, stageBefore: 'a', stageAfter: 'b', cost: 0, tokens: 0 },
    ];
    const stream = (async function* stream() { yield* events; })();
    const printed: string[] = [];
    const saved = console.log;
    console.log = (line: unknown): void => { printed.push(String(line)); };
    let trace;
    try {
      trace = await consumeRun(stream, {
        answerGate: () => Promise.reject(new Error('not called by the loop')),
        announce: (gateId) => announced.push(gateId),
      }, false);
    } finally {
      console.log = saved;
    }
    expect(announced).toStrictEqual(['1:1', '1:2']);
    expect(trace.closed).toBeNull();
    expect(trace.terminal?.status).toBe('completed');
    expect(printed.filter((line) => line.includes('GATE'))).toHaveLength(2);
  });

  test('and a stream that closes with an error still reports the terminal event it delivered', async () => {
    // The channel drains before it rejects, which is what makes both available at once. A loop that
    // let the throw escape would lose the terminal event and take AC-10(4)'s interrupted branch
    // with it.
    const boom = new Error('closed');
    const closing: Event = {
      type: 'terminal', status: 'interrupted', runId: 1, stageBefore: 'a', stageAfter: 'a', cost: 0, tokens: 0,
    };
    const stream = (async function* stream() {
      yield closing;
      throw boom;
    })();
    const saved = console.log;
    console.log = (): void => {};
    let trace;
    try {
      trace = await consumeRun(stream, { answerGate: () => Promise.reject(boom), announce: () => {} }, false);
    } finally {
      console.log = saved;
    }
    expect(trace.terminal?.status).toBe('interrupted');
    expect(trace.closed?.error).toBe(boom);
  });
});
