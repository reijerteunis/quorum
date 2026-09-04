/**
 * Running a command line in process, and reporting what a shell would have seen.
 *
 * Every assertion about a command in this package runs through {@link main} rather than by calling
 * a handler, because the dispatch boundary is part of what is being claimed (Q-0091 AC-2): a
 * command that re-parsed argv, or one registered under a name the frame does not carry, would pass
 * a direct call and fail here.
 *
 * A real `node:console` over two streams this helper owns, rather than a spy on `console.log`: it
 * is the *stream* that is being claimed, and Vitest routes console output through its own
 * interception, so a spy proves only that a function was called. `process.exit` is replaced with a
 * throw for the same reason {@link https://vitest.dev | Vitest} survives it at all — {@link die}
 * ends the process, and an assertion about what it printed has to run afterwards.
 *
 * Not collected by any include: it is `test/invoke.ts` rather than `*.test.ts`, so it is a helper
 * two suites share instead of a third copy of the same twenty lines.
 */
import { Console } from 'node:console';
import { Writable } from 'node:stream';

import { vi } from 'vitest';

import { SUCCESS } from '../src/exit.js';
import { main } from '../src/main.js';

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

/** Everything a caller of the binary could observe about one invocation. */
export interface Invocation {
  /** What reached stdout, escapes and all — nothing is stripped here. */
  readonly stdout: string;
  /** What reached stderr. `die` writes here; the commands write nowhere else. */
  readonly stderr: string;
  /**
   * The status the process would exit with: the code `die` passed to `process.exit`, or the
   * `process.exitCode` the command left behind, or {@link SUCCESS} where it left none.
   *
   * One number for both mechanisms deliberately — the claim is what a shell sees, and `fail.ts`
   * keeps the two apart so that pending output survives, not so that they report differently.
   */
  readonly exitCode: number;
  /** Whether the command stopped through `die` rather than returning. */
  readonly hard: boolean;
}

/** ANSI-stripped, as every spike assertion about this output reads it. */
export const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Run one command line and report what happened. Restores the console, the exit spy's target and
 * `process.exitCode` before returning, so nothing leaks into the next test.
 *
 * @throws whatever the command threw, where it was not a `process.exit` — a crash must stay visible
 *   rather than being folded into a status, since that is the difference between `die` and a defect.
 */
export async function invoke(argv: readonly string[]): Promise<Invocation> {
  return capture(() => main(argv));
}

/**
 * As {@link invoke}, but over a piece of a command a test constructed rather than over `main`.
 *
 * The one case the dispatch boundary cannot reach: `quorum run`'s gate reader takes its input
 * stream, its output stream and its TTY predicate as parameters, and three of its five sites are
 * reachable only when a human is at a terminal — so a test has to build the handler with streams it
 * owns. `main` takes argv and nothing else, correctly, so the composition lives here instead of
 * being a second copy of the twenty lines below. Registration through `main` is what {@link invoke}
 * covers, and every gate site that does *not* need a terminal is asserted through it.
 *
 * @param body whatever the test wants run with the console, `process.exit` and the exit status
 *   captured — usually `() => runOn({ … })(parseArgv([…]))`.
 */
export async function capture(body: () => void | Promise<void>): Promise<Invocation> {
  const out = sink();
  const err = sink();
  const saved = globalThis.console;
  const savedCode = process.exitCode;
  process.exitCode = undefined;
  globalThis.console = new Console({ stdout: out.stream, stderr: err.stream });
  const exit = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null): never => {
    throw new Exited(code);
  });
  let thrown: { error: unknown } | undefined;
  let stopped: Exited | undefined;
  try {
    await body();
  } catch (error) {
    if (error instanceof Exited) stopped = error;
    else thrown = { error };
  } finally {
    globalThis.console = saved;
    exit.mockRestore();
  }
  const soft = process.exitCode;
  process.exitCode = savedCode;
  if (thrown) throw thrown.error;
  return {
    stdout: out.text(),
    stderr: err.text(),
    // The hard path's number is the argument `die` handed `process.exit`, not `process.exitCode`:
    // `die` never sets the soft status, and reading it here would report 0 for every hard failure.
    exitCode: stopped === undefined ? Number(soft ?? SUCCESS) : Number(stopped.code),
    hard: stopped !== undefined,
  };
}
