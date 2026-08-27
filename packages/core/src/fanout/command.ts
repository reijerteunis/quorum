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
 * Why: behaviour preserved from spike/src/fanout.js:124-134 — harness/port-charter.md §2, Q-0048.
 */
import { execSync } from 'node:child_process';

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

/** One property off whatever `execSync` threw, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'status' | 'stdout' | 'stderr' | 'killed' | 'signal' | 'code'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/** `?? ''` over a stream the child may not have produced, coercing exactly as the spike's `+` does. */
const stream = (value: unknown): string => (value == null ? '' : String(value));

/**
 * Run `cmd` in `cwd` and report what happened, never throwing.
 *
 * A string through a shell is deliberate: `commands.test` is a user-configured command line
 * (`npm test --prefix spike && pnpm turbo run test`), and turning it into argv would break every
 * adopter's configuration. stdin is `ignore`, so a command that prompts fails fast instead of
 * waiting forever.
 *
 * Why: preserved defect, see Q-0048 AC-12. This inherits `execSync`'s 1 MiB `maxBuffer`, and an
 * overflow has no outcome of its own here — the fix is Q-0065.
 */
export function runCommand(cmd: string, cwd: string, { timeoutMs = 15 * 60_000 }: RunCommandOptions = {}): CommandResult {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: timeoutMs, killSignal: 'SIGKILL' });
    return { code: 0, out, timedOut: false };
  } catch (e) {
    // execSync reports a timeout as a kill, not a status; without all three disjuncts it looks like
    // an ordinary non-zero exit, which `expect: fail` would happily bank as proof of red.
    const timedOut = errorProperty(e, 'killed') === true || errorProperty(e, 'signal') === 'SIGKILL' || errorProperty(e, 'code') === 'ETIMEDOUT';
    const status = errorProperty(e, 'status');
    return { code: typeof status === 'number' ? status : 1, out: stream(errorProperty(e, 'stdout')) + stream(errorProperty(e, 'stderr')), timedOut, timeoutMs };
  }
}
