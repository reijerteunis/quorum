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

import { HELP } from './commands.js';
import { SUCCESS } from './exit.js';
import { main } from './main.js';

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
