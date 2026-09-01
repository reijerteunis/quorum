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

/**
 * Run `body` with the global console bound to two streams this test owns, and `process.exit`
 * replaced with a throw.
 *
 * A real `node:console` over two distinct streams is what makes the *stream* assertable rather than
 * the function: spying on `console.error` would only prove `die` called it, and spying on
 * `process.stderr.write` proves nothing under Vitest, which routes console output through its own
 * interception. Here the bytes have to arrive in one stream or the other.
 */
function observe(body: () => void): { stdout: string; stderr: string; code: unknown } {
  const out = sink();
  const err = sink();
  const saved = globalThis.console;
  globalThis.console = new Console({ stdout: out.stream, stderr: err.stream });
  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null): never => {
    throw new Exited(code);
  });
  try {
    body();
    throw new Error('the body returned, and die does not return');
  } catch (thrown) {
    if (!(thrown instanceof Exited)) throw thrown;
    return { stdout: out.text(), stderr: err.text(), code: thrown.code };
  } finally {
    globalThis.console = saved;
  }
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

  test('a thrown null is reported as null, the one deliberate divergence', () => {
    // Why: deliberate divergence, see Q-0090 AC-3. `e.stack` raises a `TypeError` inside the
    // spike's own `catch` handler for a thrown `null`; the frame reports the value instead of
    // replacing the crash with a different one.
    expect(observe(() => dieOnUnexpected(null)).stderr).toContain('null');
    expect(observe(() => dieOnUnexpected(undefined)).stderr).toContain('undefined');
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
