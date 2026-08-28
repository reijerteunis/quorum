/**
 * Running a project's own configured command line — the one place in `core` that hands a string to
 * a shell, which is why it is a file of its own rather than a function in `fanout.ts`: "the shell
 * appears in exactly one file" is a rule a source test can enforce, and "be careful with this call"
 * is not.
 *
 * A project's test command runs here, and a hung one used to hang the whole flow forever with no
 * output: Q-0011's integrate sat on a blocked suite for 24 minutes and would still be sitting
 * there. The timeout is a safety property, not a nicety — an orchestrator that can wait
 * indefinitely cannot be trusted to run unattended.
 *
 * Why: behaviour preserved from spike/src/fanout.js — harness/port-charter.md §2, Q-0048 — with one
 * authorised exception, the capture below, which lands in both trees together. See Q-0070 and
 * docs/decisions/058-a-commands-output-is-captured-whole.md.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** What {@link runCommand} accepts beyond the command line and its directory. */
export interface RunCommandOptions {
  /**
   * How long the command may run before it is killed. Defaults to fifteen minutes.
   *
   * The engine's `commands.timeout_ms` override is read by the engine and passed in here; this
   * module reads no configuration file.
   */
  timeoutMs?: number;
}

/** What a command did, as every caller reads it. */
export interface CommandResult {
  /** The child's exit status, or `1` where the throw carried none — a timeout among them. */
  code: number;
  /** stdout on success; stdout followed by stderr on failure. */
  out: string;
  /**
   * Whether the command was killed for running too long, rather than exiting by itself. A timeout
   * is never converted into an expected failure and is never retried here.
   */
  timedOut: boolean;
  /** The budget the command was given. Present on the failure path, and on no other. */
  timeoutMs?: number;
}

/**
 * The capture directory's name prefix. Named rather than inlined because it is what
 * `turbo-inputs.test.ts` registers this file's reads against: a directory this function created
 * and removes again, never a path in the repository.
 */
const CAPTURE_PREFIX = 'quorum-command-';

/** One property off whatever `execSync` threw, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'status' | 'killed' | 'signal' | 'code'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/**
 * A capture failure, as one error that can never be mistaken for something the command did.
 *
 * It throws rather than reporting, and that is the one place this module's contract is broken on
 * purpose. A new result field would be ignored by the single line that decides `tests=ok`, and
 * reusing `code` or `timedOut` would make an infrastructure failure indistinguishable from a
 * verdict — so the only honest report is no verdict at all. Because the engine's `tests=` line is
 * never reached on a throw, a broken capture can satisfy neither `expect: pass` nor `expect: fail`.
 */
const captureFailure = (what: string, cause: unknown): Error =>
  new Error(
    `runCommand could not ${what}: ${cause instanceof Error ? cause.message : String(cause)}. `
    + 'The command\'s output was not captured, so no result is reported for it.',
  );

/**
 * Close both capture descriptors, attempting the second even when the first fails.
 *
 * Close is the only place a write failure can be seen: the child owns the descriptor while it
 * writes, so nothing here observes the write, and a deferred error — a full disk being the
 * ordinary cause — surfaces here on the filesystems that defer it. Unwrapped, it threw a bare
 * `ENOSPC`, which AC-6 does not accept: a capture failure must name the capture, or it reads as
 * something the command did.
 *
 * What this does not buy: a close that reports nothing is no guarantee the writes landed. A child
 * that ignores its own write error and exits zero is outside what any file capture can detect,
 * because there is no expected size to compare against. Q-0070's hand review.
 */
const closeCapture = (out: number, err: number): void => {
  let failure: unknown;
  let which = '';
  for (const [fd, what] of [[out, 'output'], [err, 'errors']] as const) {
    try {
      fs.closeSync(fd);
    } catch (e) {
      if (failure === undefined) { failure = e; which = what; }
    }
  }
  if (failure !== undefined) {
    throw captureFailure(`finish writing its capture file for the command's ${which}`, failure);
  }
};

/** Read one capture file back, whole. A capture that cannot be read is not a failing command. */
const readCapture = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw captureFailure(`read back what the command wrote to ${path.basename(file)}`, e);
  }
};

/**
 * Run `cmd` in `cwd` and report what happened.
 *
 * A string through a shell is deliberate: `commands.test` is a user-configured command line
 * (`npm test --prefix spike && pnpm turbo run test --force`), and turning it into argv would break
 * every adopter's configuration. stdin is `ignore`, so a command that prompts fails fast instead of
 * waiting forever.
 *
 * The child writes into two files rather than through two pipes, so there is no ceiling and no
 * shape of writing that can lose a byte. A pipe imposed both: Node's 1 MiB default killed a
 * progressive writer mid-run and reported the kill as a timeout, and an explicit exit discarded a
 * monolithic writer's own unflushed bytes, delivering 64 KiB of whatever it produced and — when it
 * exited zero — a clean result that satisfied `expect: pass`. Writes to a file are synchronous, so
 * neither can happen. Two files rather than one, because interleaving them would change what a
 * green run reports.
 *
 * @throws {Error} only when the capture itself fails — never for anything the command did.
 */
export function runCommand(cmd: string, cwd: string, { timeoutMs = 15 * 60_000 }: RunCommandOptions = {}): CommandResult {
  let dir: string;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), CAPTURE_PREFIX));
  } catch (e) {
    throw captureFailure('create the directory it captures output into', e);
  }
  const outFile = path.join(dir, 'stdout');
  const errFile = path.join(dir, 'stderr');
  try {
    let out: number;
    let err: number;
    try {
      out = fs.openSync(outFile, 'w');
    } catch (e) {
      throw captureFailure('open its capture file for the command\'s output', e);
    }
    try {
      err = fs.openSync(errFile, 'w');
    } catch (e) {
      fs.closeSync(out);
      throw captureFailure('open its capture file for the command\'s errors', e);
    }
    try {
      execSync(cmd, { cwd, stdio: ['ignore', out, err], env: process.env, timeout: timeoutMs, killSignal: 'SIGKILL' });
    } catch (e) {
      // execSync reports a timeout as a kill, not a status; without all three disjuncts it looks
      // like an ordinary non-zero exit, which `expect: fail` would happily bank as proof of red.
      // Since Q-0070 a kill can only mean the timeout: no volume of output kills anything.
      const timedOut = errorProperty(e, 'killed') === true || errorProperty(e, 'signal') === 'SIGKILL' || errorProperty(e, 'code') === 'ETIMEDOUT';
      const status = errorProperty(e, 'status');
      // Read before either `finally` runs. The error carries no streams now that the child wrote
      // through descriptors, so the files are the only account of what it produced — and reading
      // after cleanup is how this becomes an empty-output defect that only appears under load.
      const captured = readCapture(outFile) + readCapture(errFile);
      return { code: typeof status === 'number' ? status : 1, out: captured, timedOut, timeoutMs };
    } finally {
      closeCapture(out, err);
    }
    return { code: 0, out: readCapture(outFile), timedOut: false };
  } finally {
    // Not wrapped: a capture directory that cannot be removed is surfaced rather than swallowed,
    // and it invents no verdict to say so.
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
