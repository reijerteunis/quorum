/**
 * Q-0090 AC-3 (`die`) and AC-5 (hard exit and soft exit are two mechanisms).
 *
 * `die` is observed rather than suffered: `process.exit` is replaced with a throw, so the assertion
 * runs in this process and the suite survives it. AC-5 cannot be observed that way — truncation is
 * a property of a real process leaving a real pipe unflushed — so it is demonstrated in two spawned
 * children instead, written to a directory this test creates under `os.tmpdir` and removes again.
 */
import { execFileSync } from 'node:child_process';
import { Console } from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { die, dieOnUnexpected, failSoftly } from './fail.js';

/** What the replaced `process.exit` throws, so control flow matches `die`'s `never` return. */
class Exited extends Error {
  constructor(readonly code: unknown) {
    super(`process.exit(${String(code)})`);
  }
}

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

/** How a body ended: it exited through `die`, it raised before reaching one, or it just returned. */
type Outcome =
  | { kind: 'exited'; code: unknown; stdout: string; stderr: string }
  | { kind: 'raised'; error: unknown; stdout: string; stderr: string }
  | { kind: 'returned'; stdout: string; stderr: string };

/**
 * Run `body` with the global console bound to two streams this test owns, and `process.exit`
 * replaced with a throw, and report which of the three ways it ended.
 *
 * A real `node:console` over two distinct streams is what makes the *stream* assertable rather than
 * the function: spying on `console.error` would only prove `die` called it, and spying on
 * `process.stderr.write` proves nothing under Vitest, which routes console output through its own
 * interception. Here the bytes have to arrive in one stream or the other.
 *
 * The three outcomes are distinguished here rather than at the call sites because two of AC-3's
 * rows *raise* instead of exiting, and a helper that could only express "it exited" would have to
 * be worked around to test them — which is how a check stops discriminating.
 */
function attempt(body: () => void): Outcome {
  const out = sink();
  const err = sink();
  const saved = globalThis.console;
  globalThis.console = new Console({ stdout: out.stream, stderr: err.stream });
  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null): never => {
    throw new Exited(code);
  });
  let raised: { error: unknown } | undefined;
  try {
    body();
  } catch (error) {
    raised = { error };
  } finally {
    globalThis.console = saved;
  }
  const streams = { stdout: out.text(), stderr: err.text() };
  if (!raised) return { kind: 'returned', ...streams };
  if (raised.error instanceof Exited) return { kind: 'exited', code: raised.error.code, ...streams };
  return { kind: 'raised', error: raised.error, ...streams };
}

/** {@link attempt} for a body that must reach `die`, which every command's error path does. */
function observe(body: () => void): { stdout: string; stderr: string; code: unknown } {
  const outcome = attempt(body);
  if (outcome.kind !== 'exited') throw new Error(`expected die, and the body ${outcome.kind}`);
  return { stdout: outcome.stdout, stderr: outcome.stderr, code: outcome.code };
}

/**
 * {@link attempt} for a body that must raise before anything is printed.
 *
 * It refuses an `exited` outcome rather than reporting one, which is what makes it discriminate: an
 * implementation that guards the property access prints and exits here, and this throws instead of
 * quietly returning empty streams.
 */
function raises(body: () => void): { error: unknown; stdout: string; stderr: string } {
  const outcome = attempt(body);
  if (outcome.kind !== 'raised') throw new Error(`expected a raise, and the body ${outcome.kind}`);
  return { error: outcome.error, stdout: outcome.stdout, stderr: outcome.stderr };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('AC-3 — die', () => {
  test('writes to stderr, in red, with the space inside the span, and exits 1', () => {
    // Why: preserved, see Q-0090 AC-3. `spike/bin/harness.js:124` puts the space *inside* the red
    // span, unlike every other call site in that file, and the port keeps it there.
    const { stderr, code } = observe(() => die('no harness/harness.yaml found'));
    expect(stderr).toBe('\x1b[31m✗ \x1b[0mno harness/harness.yaml found\n');
    expect(code).toBe(ERROR);
  });

  test('and nothing reaches stdout, which is the half that makes it the error stream', () => {
    const { stdout, stderr } = observe(() => die('nothing here'));
    expect(stdout).toBe('');
    expect(stderr).toContain('nothing here');
  });

  test('the message is written whole, however long, and an empty one still marks the failure', () => {
    const long = 'x'.repeat(10_000);
    expect(observe(() => die(long)).stderr).toContain(long);
    expect(observe(() => die('')).stderr).toBe('\x1b[31m✗ \x1b[0m\n');
  });
});

describe('AC-3 — the uncaught-rejection path', () => {
  test('an Error is reported by its stack', () => {
    const error = new Error('boom');
    const { stderr, code } = observe(() => dieOnUnexpected(error));
    expect(error.stack).toBeDefined();
    expect(stderr).toContain(error.stack);
    expect(code).toBe(ERROR);
  });

  test('a thrown value that is not an Error is reported by String()', () => {
    expect(observe(() => dieOnUnexpected('just a string')).stderr).toContain('just a string');
    expect(observe(() => dieOnUnexpected(42)).stderr).toContain('42');
  });

  test('a stack that is present but not a string is still what is reported', () => {
    // `spike/bin/harness.js:569` is `e.stack ?? String(e)`: the `??` tests whether the property is
    // there, never what type it is, and `die`'s `+` coerces whatever comes back. Reading the type
    // instead reports `[object Object]` here, which is the whole difference.
    const number = observe(() => dieOnUnexpected({ stack: 42 })).stderr;
    expect(number).toContain('42');
    expect(number, 'the value was read, not its type').not.toContain('[object Object]');
  });

  test('and a stack on a thrown function is reported, since typeof answers "function" there', () => {
    // Its own test rather than a second assertion above: a clause sharing a test with a failing one
    // is never run, so it would be carried rather than checked (Q-0071).
    const carrier = Object.assign(() => undefined, { stack: 'a stack on a function' });
    expect(observe(() => dieOnUnexpected(carrier)).stderr).toContain('a stack on a function');
  });

  test('and a nullish stack falls back to the value, which is what the ?? is for', () => {
    expect(observe(() => dieOnUnexpected({ stack: null })).stderr).toContain('[object Object]');
    expect(observe(() => dieOnUnexpected({ stack: undefined })).stderr).toContain('[object Object]');
  });

  // The three rows on which `e.stack ?? String(e)` does not print. Measured against the spike's own
  // expression rather than reasoned about, and preserved rather than repaired: the path that exists
  // to turn a crash into a message replaces it with a different crash, which is a defect this
  // ticket reports (Q-0090 ground rule 3, AC-3).
  //
  // One row each, because two clauses in one test means the second is never reached once the first
  // fails, and the second is exactly the one an implementation is likely to get differently
  // (Q-0071).
  test.each([
    ['null', null],
    ['undefined', undefined],
  ])('a thrown %s raises, because the property access is unguarded', (_name, value) => {
    // An optional chain would print the value and exit 1 here. That is the readable spelling and it
    // is a behaviour change, so it is not the one that ships.
    const { error, stderr, stdout } = raises(() => dieOnUnexpected(value));
    expect(error).toBeInstanceOf(TypeError);
    expect(stderr, 'die was never reached, so nothing was printed').toBe('');
    expect(stdout).toBe('');
  });

  test('a symbol-valued stack raises inside die, where the + cannot coerce it', () => {
    // The `??` yields the symbol untouched, and `c.red('✗ ') + symbol` is a TypeError. Coercing it
    // with `String()` on the way in would print `Symbol(unprintable)` instead — the other readable
    // spelling, and the other behaviour change.
    const { error, stderr } = raises(() => dieOnUnexpected({ stack: Symbol('unprintable') }));
    expect(error).toBeInstanceOf(TypeError);
    expect(stderr, 'the concatenation raised before console.error was called').toBe('');
  });

  test('while a thrown symbol prints, because the fallback is String() and String() takes one', () => {
    // The row that discriminates `?? String(e)` from `?? e`: `String(Symbol('s'))` is `'Symbol(s)'`
    // where `'' + Symbol('s')` raises. A port whose fallback is the bare value passes every other
    // row in this file and fails this one.
    expect(observe(() => dieOnUnexpected(Symbol('thrown'))).stderr).toContain('Symbol(thrown)');
  });
});

describe('AC-5 — the soft path sets the status and returns', () => {
  test('failSoftly sets the exit status and calls nothing that would stop the process', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('failSoftly must not call process.exit');
    });
    expect(process.exitCode).toBe(undefined);
    failSoftly();
    expect(process.exitCode).toBe(ERROR);
    expect(exit).not.toHaveBeenCalled();
  });

  test('and die reaches the same number through process.exit, which is the difference', () => {
    expect(observe(() => die('stop now')).code).toBe(ERROR);
    expect(process.exitCode, 'die never sets the soft status').toBe(undefined);
  });
});

/**
 * The pair of children AC-5 asks for, as one payload written two ways.
 *
 * A megabyte, so the write cannot complete in one pass through a pipe whose buffer is 64 KiB — the
 * measurement Q-0070 made against `runCommand`, arriving here as the reason the two mechanisms are
 * kept apart rather than as a claim about any particular buffer size. The assertion below is
 * `< PAYLOAD_BYTES` rather than an exact count, so what is pinned is that output was lost and not
 * how much.
 */
const PAYLOAD_BYTES = 1024 * 1024;

/** A child that writes the payload and then ends the process the way `ending` says. */
const child = (ending: string): string =>
  `const payload = 'q'.repeat(${String(PAYLOAD_BYTES)});\nprocess.stdout.write(payload);\n${ending}\n`;

describe('AC-5 — demonstrated, in two spawned children', () => {
  let dir = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-exit-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Write one child, run it, and report the code it exited with and how much stdout arrived. */
  const run = (name: string, ending: string): { code: number; bytes: number } => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, child(ending), 'utf8');
    try {
      return { code: SUCCESS, bytes: execFileSync(process.execPath, [file], { maxBuffer: PAYLOAD_BYTES * 4 }).length };
    } catch (thrown) {
      const failure = thrown as { status?: number; stdout?: Buffer };
      return { code: failure.status ?? -1, bytes: failure.stdout?.length ?? 0 };
    }
  };

  test('the soft code keeps the payload and process.exit loses it, on one payload', () => {
    const soft = run('soft.mjs', 'process.exitCode = 1;');
    const hard = run('hard.mjs', 'process.exit(1);');

    // Both report the same failure, which is what makes the difference between them about output.
    expect(soft.code, 'the soft child exits 1').toBe(ERROR);
    expect(hard.code, 'the hard child exits 1 too').toBe(ERROR);

    expect(soft.bytes, 'the soft child wrote everything it had').toBe(PAYLOAD_BYTES);
    expect(hard.bytes, 'process.exit truncated the child mid-write').toBeLessThan(PAYLOAD_BYTES);
  });
});
