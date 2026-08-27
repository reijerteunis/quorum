/**
 * Spawning a vendor CLI: one child process, the whole prompt on its stdin, its stdout delivered a
 * line at a time.
 *
 * Both adapters run through here. In the spike it lives inside `claude.js` and `codex.js` imports it
 * from there (spike/src/adapters/codex.js:5); internal file layout is the one thing the port does
 * not preserve (charter §2), so it gets a file of its own — and it is the only file in this folder
 * that may reach for `node:child_process`.
 *
 * Why: behaviour preserved from spike/src/adapters/claude.js:70-94, including the stdin listener
 * Q-0063 added — see {@link exec}.
 */
import { spawn } from 'node:child_process';

/** Everything {@link exec} needs beyond the argv. */
export interface ExecOptions {
  /** The directory the child runs in. */
  cwd?: string;
  /** Written to the child's stdin, which is then closed. Absent closes it without writing. */
  stdin?: string;
  /** Called with each complete line of stdout, its newline stripped, in the order they arrive. */
  onLine?: (line: string) => void;
}

/** What the child did, as every caller reads it. */
export interface ExecResult {
  /**
   * The child's own exit code — `-1` where the spawn itself failed or stdin errored, and `null`
   * where a signal killed it. Both of the last two read as non-zero at every call site, which is
   * what makes them a result rather than a rejection.
   */
  code: number | null;
  /** Everything the child wrote to stdout, newlines included — where both vendors report failure. */
  stdout: string;
  /** Everything it wrote to stderr, plus the note below when its prompt could not be delivered. */
  stderr: string;
}

/**
 * Runs `bin` with `args` and resolves with what happened. It never rejects: a CLI that is not
 * installed is something the caller reports in a sentence, not a crash.
 *
 * The stdin listener is the part that is easy to lose. A CLI that exits before reading its prompt
 * closes that pipe under us, and prompts run to 50-150KB against a 64KB pipe buffer — so the write
 * cannot complete in one pass, and an expired login, a rejected model or a crash all win that race.
 * Without a listener the `EPIPE` is an unhandled `'error'` event, Node kills the process, and the
 * vendor's own message is replaced by a `node:events` stack trace. The child's exit code is the
 * authority on what happened, so a truncated prompt is recorded in `stderr` and `'close'` is left to
 * resolve; any other stdin error is terminal.
 * Why: see Q-0063 and backlog/Q-0009-…/requirements/errata.md E-2.
 */
export function exec(bin: string, args: string[], { cwd, stdin, onLine }: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', buffered = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      buffered += text;
      let end = buffered.indexOf('\n');
      while (end >= 0) {
        onLine?.(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
        end = buffered.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (e) => { resolve({ code: -1, stdout, stderr: String(e) }); });
    child.on('close', (code) => {
      if (buffered) onLine?.(buffered);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on('error', (e) => {
      if ((e as NodeJS.ErrnoException).code === 'EPIPE') {
        stderr += `\n[quorum] the CLI closed its input before the prompt was fully written\n`;
        return;
      }
      resolve({ code: -1, stdout, stderr: `${stderr}\n${String(e)}` });
    });
    if (stdin != null) child.stdin.end(stdin); else child.stdin.end();
  });
}
