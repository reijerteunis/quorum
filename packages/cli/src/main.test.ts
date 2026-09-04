/**
 * Q-0090 AC-6 (an unknown or absent command prints help and exits 0) and AC-8's second half (the
 * frame writes nothing anywhere).
 *
 * Everything runs in process. `main` returns rather than exiting, so "exits 0" is observed as
 * `process.exitCode` never being set — which is the same claim, made without ending the suite.
 */
import { execFileSync } from 'node:child_process';
import { Console } from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { parseArgv, type ParsedArgv } from './argv.js';
import { COMMANDS, HELP } from './commands.js';
import { SUCCESS } from './exit.js';
import { HANDLERS, main } from './main.js';

/** The four shapes AC-6 names — the ones that must print the help and leave the status at 0. */
const INVOCATIONS: readonly (readonly string[])[] = [
  [],
  ['--help'],
  ['nonsense'],
  ['--', '-x', '--gate-answer', '--adapter'],
];

/**
 * Every shape AC-8's byte-identical-tree snapshot drives, which is the four above plus one real
 * invocation of each read-only command.
 *
 * **Split from {@link INVOCATIONS} by Q-0091 rather than grown in place**: that list is also AC-6's
 * subject, and `quorum lint` neither prints the help nor is meant to. What AC-8 claims is that a
 * command introduced no write path, and the cheapest available proof of it is that the tree is
 * unchanged afterwards — so the list grows with each read-only command as it lands. Q-0093's `init`
 * and `ticket` write by design and belong to a different claim, not to a widening of this one.
 */
const READ_ONLY: readonly (readonly string[])[] = [
  ...INVOCATIONS,
  ['help'],
  ['lint'],
  ['validate', 'contract.schema.json', 'artifact.json'],
];

/** A stream that keeps what is written to it. */
const sink = (): { text: () => string; stream: Writable } => {
  let text = '';
  const stream = new Writable({
    write(chunk: unknown, _encoding: unknown, done: () => void) {
      text += String(chunk);
      done();
    },
  });
  return { text: () => text, stream };
};

/**
 * Run `main` with the global console bound to streams this test owns, returning what reached each
 * of them and the exit status the call left behind.
 *
 * A real `node:console` over two streams rather than a spy on `console.log`, for the reason
 * `fail.test.ts` gives: it is the stream that is being claimed, and Vitest routes console output
 * through its own interception.
 */
async function invoke(argv: readonly string[]): Promise<{ stdout: string; stderr: string; exitCode: unknown }> {
  const out = sink();
  const err = sink();
  const saved = globalThis.console;
  globalThis.console = new Console({ stdout: out.stream, stderr: err.stream });
  try {
    await main(argv);
    return { stdout: out.text(), stderr: err.text(), exitCode: process.exitCode };
  } finally {
    globalThis.console = saved;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('AC-6 — an unknown or absent command prints help and exits 0', () => {
  test.each(INVOCATIONS)('quorum %j prints the help and leaves the status at 0', async (...argv) => {
    // Why: preserved defect, see Q-0090 AC-6. `spike/bin/harness.js:560–562` is a `default:` branch
    // that prints usage and returns, so `main()` resolves and the process exits 0 — a shell script
    // cannot tell "did the thing" from "did not understand you". Registered rather than fixed,
    // because changing it is a behaviour change on the surface a stranger meets first; the
    // successor is Q-0090's GA-4.
    const { stdout, stderr, exitCode } = await invoke(argv);
    expect(stdout.trim(), 'nothing was printed').not.toBe('');
    expect(stdout).toContain(HELP);
    expect(stderr, 'the help is not an error, so it goes to stdout').toBe('');
    expect(exitCode ?? SUCCESS).toBe(SUCCESS);
  });

  test('and the one registered command prints the same text', async () => {
    const { stdout, exitCode } = await invoke(['help']);
    expect(stdout).toContain(HELP);
    expect(exitCode ?? SUCCESS).toBe(SUCCESS);
  });

  test('main resolves rather than exiting, which is what makes the status observable', async () => {
    // A `main` returning a code would be spent as `process.exit(main(argv))`, and that call
    // overrides `process.exitCode` — collapsing the two mechanisms AC-5 keeps apart.
    const exit = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('the frame must not call process.exit');
    });
    await invoke([]);
    expect(exit).not.toHaveBeenCalled();
  });
});

/**
 * The dispatch contract: what a handler is given, and what the entry waits for.
 *
 * Both properties belong to AC-8's frame rather than to any command — Q-0091 to Q-0094 write
 * against them and none of them may have to widen this module to do it — and both were found
 * missing by run 2's fifth review. Exercised over {@link COMMANDS} rather than over a command
 * written for the test, so a sibling's entry inherits the checks instead of needing its own.
 */
describe('the frame hands a handler the parsed command line, and waits for what it dispatched to', () => {
  /** A command line carrying all four of the parser's fields, so a truncated one is visible. */
  const tail = ['ticket', '--adapter', 'mock', '--gate-answer', 'advance', '--gate-answer', 'abort'];

  test.each([...COMMANDS])('the %s handler receives exactly what parseArgv returned', async (name) => {
    const seen: ParsedArgv[] = [];
    vi.spyOn(HANDLERS, name).mockImplementation((parsed) => {
      seen.push(parsed);
    });
    const argv = [name, ...tail];
    await invoke(argv);
    expect(seen).toStrictEqual([parseArgv(argv)]);
    // Named one by one as well, because a structural comparison against the parser's own output
    // would still hold if both sides lost a field. `rest`, `flags` and `gateAnswers` are the three
    // a handler taking only its name would have to re-derive; `cmd` is the fourth, and it is named
    // here rather than inside a command module because it is the key the dispatch used — a handler
    // reads it by being the one that ran. Q-0094 review round 2 asked for all four to be covered.
    expect(seen[0]?.cmd).toBe(name);
    expect(seen[0]?.rest).toStrictEqual(['ticket']);
    expect(seen[0]?.flags.adapter).toBe('mock');
    expect(seen[0]?.gateAnswers).toStrictEqual(['advance', 'abort']);
  });

  test.each([...COMMANDS])('main does not resolve until an asynchronous %s handler does', async (name) => {
    // The handler waits on a promise this test alone can settle, and the wait is drained through a
    // macrotask, so every microtask an unawaited dispatch could hide behind has run before the
    // assertion. The first shape written here — a handler suspended on one `await Promise.resolve()`
    // and a flag read after `main` — passed against `void HANDLERS[cmd](parsed)`, because the
    // handler's continuation is queued ahead of the caller's: a check that could not see its own
    // subject, which is why this one holds the handler open instead of racing it.
    //
    // The declared return type carries none of this, and that was measured rather than assumed:
    // TypeScript accepts a `Promise<void>`-returning function wherever `void` is declared, so
    // narrowing `CommandHandler` back to `(argv: ParsedArgv) => void` leaves `tsc --noEmit` and all
    // 94 of this package's tests green. The union says what a handler may do; only the `await` in
    // `main` makes it true, so only a behavioural check can hold it.
    let release = (): void => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    vi.spyOn(HANDLERS, name).mockImplementation(async () => {
      await held;
      finished = true;
    });

    let resolved = false;
    const running = invoke([name]).then(() => {
      resolved = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolved, 'main resolved while its handler was still waiting').toBe(false);
    expect(finished).toBe(false);

    release();
    await running;
    expect(finished, 'main resolved with its handler still running').toBe(true);
  });

  test.each([...COMMANDS])('a rejecting %s handler rejects main, which is what carries it to die', async (name) => {
    // `spike/bin/harness.js:569` is `main().catch((e) => die(e.stack ?? String(e)))`. A detached
    // rejection reaches Node's unhandled-rejection path instead, which neither prints through the
    // error path nor exits with ERROR. The binary that installs that `catch` is Q-0096's; the
    // property it will depend on is this one.
    vi.spyOn(HANDLERS, name).mockImplementation(() => Promise.reject(new Error('a command failed')));
    await expect(main([name])).rejects.toThrow('a command failed');
  });

  test('the registry is what the type says it is, and the spies restore it', () => {
    // The three checks above replace an entry and rely on `restoreAllMocks` to put it back; this
    // asserts the restoration rather than assuming it, so a later test cannot silently run against
    // a mocked frame.
    expect(Object.keys(HANDLERS).sort()).toStrictEqual([...COMMANDS].sort());
    for (const name of COMMANDS) expect(vi.isMockFunction(HANDLERS[name])).toBe(false);
  });
});

describe('AC-8 — the frame writes nothing, starts nothing and probes nothing', () => {
  let dir = '';
  let cwd = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-frame-'));
    // A project shaped like one the commands are pointed at, so a stray relative write would land
    // somewhere this test can see it.
    for (const sub of ['harness/flows', 'backlog', '.quorum/runs', '.harness/worktrees']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n', 'utf8');
    // One clean flow and one conforming artifact, so the two read-only commands in {@link READ_ONLY}
    // do their real work rather than failing on the way in — a snapshot taken around a command that
    // stopped at its first line would be a green tick over nothing.
    fs.writeFileSync(
      path.join(dir, 'harness', 'flows', 'sample.yaml'),
      'name: sample\nconsumes: draft\nproduces: requirements\nsteps: []\n',
      'utf8',
    );
    fs.writeFileSync(path.join(dir, 'contract.schema.json'), '{"type":"object","required":["a"]}\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'artifact.json'), '{"a":1}\n', 'utf8');
    // A repository with two refs, so `for-each-ref` below has something to compare rather than the
    // empty string on both sides — a ref snapshot over a repository with no refs would report
    // agreement whatever a command did. Through {@link git} rather than `execFileSync` directly, so
    // the commit is visible to `packages/core/src/git-identity.test.ts`: that guard is anchored on a
    // call to a helper named `git`, and a spawn spelled any other way is invisible to it.
    git('init', '-q', '-b', 'main');
    git('-c', 'user.email=q0091@quorum.invalid', '-c', 'user.name=q0091 fixture',
      'commit', '-q', '--allow-empty', '-m', 'fixture');
    git('branch', 'harness/T-0001/integration');
    cwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Run git in the fixture with an identity this test supplies at the call site.
   *
   * `-c` pairs rather than an ambient `user.email`, so the verdict is a property of the commit and
   * not of the account the suite runs as (`harness/rules.md`; *"A test's verdict is a property of
   * the commit"*, 2026-08-30) — and spelled at each call site rather than hidden in this helper,
   * because `packages/core/src/git-identity.test.ts` reads the literals before the subcommand and a
   * helper that supplied them invisibly would look like a violation to the guard that exists to
   * find one.
   */
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  /**
   * Everything about the fixture a command could change: every path below it with its bytes, and
   * every ref with the object it points at.
   *
   * Two halves because a command has two ways to leave something behind, and the tree walk sees only
   * one of them — a branch created for a ticket is a ref and not a file, which is the shape Q-0062's
   * *"no ref is ever deleted"* rule is about from the other side. `.git` is pruned from the walk
   * rather than read: its contents move on their own (index, logs, packed refs), so including it
   * would make the comparison a property of git's housekeeping, and `for-each-ref` is the part of it
   * that is a claim about this repository.
   */
  const snapshot = (root: string): Record<string, string> => {
    const seen: Record<string, string> = {};
    const walk = (at: string): void => {
      for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(at, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.git') continue;
          seen[`${path.relative(root, full)}/`] = '';
          walk(full);
        } else {
          seen[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
        }
      }
    };
    walk(root);
    seen['git:for-each-ref'] = git('for-each-ref', '--format=%(refname) %(objectname)');
    return seen;
  };

  test('every invocation shape leaves the working tree and the ref namespace as it found them', async () => {
    const before = snapshot(dir);
    expect(Object.keys(before).length, 'the fixture is empty — this test proves nothing').toBeGreaterThan(4);
    expect(before['git:for-each-ref'], 'the fixture has no refs, so half this snapshot is vacuous')
      .toContain('refs/heads/harness/T-0001/integration');
    for (const argv of READ_ONLY) await invoke(argv);
    expect(snapshot(dir)).toStrictEqual(before);
  });

  test('and it is shown to fail against a handler that writes, which the invocation loop is what runs', async () => {
    // The `:226` clause below writes a file directly and so proves the *snapshot* has a subject.
    // This proves the *loop* does: what is replaced is a registered handler, so the write happens
    // where a command's write would happen — through dispatch, at the working directory a command
    // sees. Both halves of the snapshot are shown moving, because a stub that only wrote a file
    // would leave the ref half unexercised.
    const before = snapshot(dir);
    vi.spyOn(HANDLERS, 'lint').mockImplementation(() => {
      fs.writeFileSync(path.join(dir, 'backlog', 'written-by-a-command.md'), 'x', 'utf8');
      git('branch', 'harness/T-0002/integration');
    });
    await invoke(['lint']);
    const after = snapshot(dir);
    expect(after).not.toStrictEqual(before);
    expect(Object.keys(after)).toContain(path.join('backlog', 'written-by-a-command.md'));
    expect(after['git:for-each-ref']).toContain('refs/heads/harness/T-0002/integration');
  });

  test('and the two read-only commands really ran inside it, so the snapshot covers them', async () => {
    // Without this the clause above would hold just as well over a `lint` that had died on its
    // first line: a command that does nothing writes nothing. Both are shown producing the output
    // they are for, in this fixture, at the same working directory the snapshot is taken around.
    const lint = await invoke(['lint']);
    expect(lint.stdout, 'lint read the flow directory').toContain('sample.yaml');
    const validate = await invoke(['validate', 'contract.schema.json', 'artifact.json']);
    expect(validate.stdout, 'validate read the artifact').toContain('matches contract.schema.json');
    for (const name of ['lint', 'validate']) {
      expect(READ_ONLY.map((argv) => argv[0]), `${name} is not in the snapshot's list`).toContain(name);
    }
  });

  test('the snapshot has a subject — a file written into the fixture is seen', () => {
    const before = snapshot(dir);
    fs.writeFileSync(path.join(dir, 'backlog', 'stray.md'), 'x', 'utf8');
    expect(snapshot(dir)).not.toStrictEqual(before);
  });
});
