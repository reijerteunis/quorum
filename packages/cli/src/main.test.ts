/**
 * Q-0090 AC-6 (an unknown or absent command prints help and exits 0) and AC-8's second half (the
 * frame writes nothing anywhere).
 *
 * Everything runs in process. `main` returns rather than exiting, so "exits 0" is observed as
 * `process.exitCode` never being set — which is the same claim, made without ending the suite.
 */
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

/** The four shapes AC-8 names, and the three AC-6 names among them. */
const INVOCATIONS: readonly (readonly string[])[] = [
  [],
  ['--help'],
  ['nonsense'],
  ['--', '-x', '--gate-answer', '--adapter'],
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
    // a handler taking only its name would have to re-derive.
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
    // A project shaped like one the commands will one day be pointed at, so a stray relative write
    // would land somewhere this test can see it.
    for (const sub of ['harness', 'backlog', '.quorum/runs', '.harness/worktrees']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n', 'utf8');
    cwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Every path below `root`, relative and sorted, with each file's bytes. */
  const snapshot = (root: string): Record<string, string> => {
    const seen: Record<string, string> = {};
    const walk = (at: string): void => {
      for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(at, entry.name);
        if (entry.isDirectory()) {
          seen[`${path.relative(root, full)}/`] = '';
          walk(full);
        } else {
          seen[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
        }
      }
    };
    walk(root);
    return seen;
  };

  test('every invocation shape leaves the working tree byte for byte as it found it', async () => {
    const before = snapshot(dir);
    expect(Object.keys(before).length, 'the fixture is empty — this test proves nothing').toBeGreaterThan(4);
    for (const argv of INVOCATIONS) await invoke(argv);
    expect(snapshot(dir)).toStrictEqual(before);
  });

  test('the snapshot has a subject — a file written into the fixture is seen', () => {
    const before = snapshot(dir);
    fs.writeFileSync(path.join(dir, 'backlog', 'stray.md'), 'x', 'utf8');
    expect(snapshot(dir)).not.toStrictEqual(before);
  });
});
