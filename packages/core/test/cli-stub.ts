// A fake vendor CLI on disk, so an adapter's real spawn/parse path runs and production code needs
// no seam. The technique is the spike's own (spike/test/smoke.js:157-172); what is added here is the
// recording, because Q-0047 has to assert argv element for element and has to prove that a refusal
// happened BEFORE anything was spawned.
//
// It lives outside `src/` for the reason `repo.ts` does: this is support, not a suite. Since Q-0054
// that is a statement about its NAME and no longer about its directory — the include is Vitest's own
// default, so `test/` is not a place a file is safe by virtue of being in.
import fs from 'node:fs';
import path from 'node:path';

import { tempDir } from './repo.js';

/** What the stub should do when it runs. */
export interface CliStubOptions {
  /** Printed on stdout verbatim. Nothing is printed when this is absent or empty. */
  stdout?: string;
  /** Printed on stderr verbatim. */
  stderr?: string;
  /** The exit code. 0 unless a test says otherwise. */
  exit?: number;
  /** Extra `/bin/sh` run after the argv is recorded and before anything is printed. `"$@"` is the argv. */
  body?: string;
}

/** A stub executable, and everything it saw. */
export interface CliStub {
  /** The path to hand to `cfg.bin`. */
  bin: string;
  /** The directory holding the stub and its recordings, for a test that needs a path inside it. */
  dir: string;
  /**
   * Whether the executable ever ran. This is the sentinel AC-3 clause 3 turns on: a refusal that
   * fires before the CLI is probed leaves it false, and asserting only the message does not.
   */
  ran: () => boolean;
  /** Every invocation's argv, in order, one array per invocation. */
  invocations: () => string[][];
  /** The last invocation's argv. Throws when it never ran, rather than answering for nothing. */
  argv: () => string[];
  /** What the last invocation was handed on stdin — the stub always drains it. */
  stdin: () => string;
}

/** Ends one invocation's block in the argv log. No argv element in this suite contains a newline. */
const END = '<<<argv-end>>>';

/**
 * Writes an executable that records its argv and its stdin, optionally does something else, prints
 * canned bytes and exits with a chosen code.
 *
 * stdout and stderr are handed over as files the script `cat`s rather than as heredocs, so a fixture
 * containing any delimiter, quote or backslash arrives byte for byte.
 */
export function cliStub({ stdout = '', stderr = '', exit = 0, body = '' }: CliStubOptions = {}): CliStub {
  const dir = tempDir('cli-stub-');
  const at = (name: string): string => path.join(dir, name);
  const [argvLog, stdinFile, stdoutFile, stderrFile, bin] =
    ['argv.log', 'stdin.txt', 'stdout.txt', 'stderr.txt', 'cli'].map(at);

  fs.writeFileSync(stdoutFile, stdout);
  fs.writeFileSync(stderrFile, stderr);
  fs.writeFileSync(bin, [
    '#!/bin/sh',
    `{ for a in "$@"; do printf '%s\\n' "$a"; done; printf '%s\\n' ${JSON.stringify(END)}; } >> ${JSON.stringify(argvLog)}`,
    `cat > ${JSON.stringify(stdinFile)}`,
    body,
    `[ -s ${JSON.stringify(stdoutFile)} ] && cat ${JSON.stringify(stdoutFile)}`,
    `[ -s ${JSON.stringify(stderrFile)} ] && cat ${JSON.stringify(stderrFile)} >&2`,
    `exit ${exit}`,
    '',
  ].join('\n'));
  fs.chmodSync(bin, 0o755);

  const invocations = (): string[][] => {
    if (!fs.existsSync(argvLog)) return [];
    return fs.readFileSync(argvLog, 'utf8')
      .split(`${END}\n`)
      .filter((block) => block !== '')
      .map((block) => block.split('\n').slice(0, -1));
  };

  return {
    bin,
    dir,
    ran: () => fs.existsSync(argvLog),
    invocations,
    argv: () => {
      const all = invocations();
      if (!all.length) throw new Error(`the stub at ${bin} never ran, so it has no argv to report`);
      return all[all.length - 1];
    },
    stdin: () => (fs.existsSync(stdinFile) ? fs.readFileSync(stdinFile, 'utf8') : ''),
  };
}
