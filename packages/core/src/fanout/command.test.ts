// Q-0048 AC-10: the shell, the fifteen-minute default, and the three ways to spot a kill.
//
// No case here waits for the default timeout: every timing assertion supplies a short `timeoutMs`
// and then bounds the elapsed time well inside what the command was asked to do.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import { runCommand } from './command.js';
import { removeTempDirs, tempDir } from '../../test/repo.js';

afterAll(removeTempDirs);

describe('AC-10 — runCommand keeps its shape on both paths', () => {
  test('success is exactly {code, out, timedOut}, with stdout only and no timeoutMs', () => {
    expect(runCommand('printf hello', tempDir('cmd-'))).toStrictEqual({ code: 0, out: 'hello', timedOut: false });
  });

  test('the command runs in the directory it is given', () => {
    const dir = tempDir('cmd-');
    expect(runCommand('pwd', dir).out.trim()).toContain(dir.split('/').pop() ?? '');
  });

  test('a non-zero exit carries its own status, timedOut false, and the budget it was given', () => {
    expect(runCommand('exit 3', tempDir('cmd-'))).toStrictEqual({
      code: 3, out: '', timedOut: false, timeoutMs: 15 * 60_000,
    });
  });

  test('failure concatenates stdout and then stderr, in that order', () => {
    const result = runCommand('printf OUT; printf ERR >&2; exit 1', tempDir('cmd-'));
    expect(result.code).toBe(1);
    expect(result.out).toBe('OUTERR');
  });

  test('a caller\'s timeoutMs overrides the default and is reported back', () => {
    const started = Date.now();
    const result = runCommand('sleep 30', tempDir('cmd-'), { timeoutMs: 300 });
    const elapsed = Date.now() - started;

    // All three disjuncts stay: execSync reports a timeout as a kill rather than a status, and
    // without them a timeout looks like an ordinary non-zero exit — which `expect: fail` would
    // happily bank as proof of red.
    expect(result.timedOut).toBe(true);
    expect(result.timeoutMs).toBe(300);
    expect(elapsed, `returned after ${elapsed}ms, and the command was asked to sleep 30s`).toBeLessThan(10_000);
  });

  test('a timeout is never reported as a clean run', () => {
    expect(runCommand('sleep 30', tempDir('cmd-'), { timeoutMs: 300 }).code).not.toBe(0);
  });

  test('stdin is ignored, so a command that reads it finishes instead of waiting', () => {
    const started = Date.now();
    const result = runCommand('cat', tempDir('cmd-'), { timeoutMs: 10_000 });
    const elapsed = Date.now() - started;

    expect(result.timedOut, 'a prompting command must fail fast, not hang').toBe(false);
    expect(result.code).toBe(0);
    expect(elapsed).toBeLessThan(5_000);
  });
});

// ---------------------------------------------------------------------------------------------
// Q-0070: the capture has no ceiling, so what a command produced is what a caller reads.
//
// The matrix below IS the red phase — it fails against the unchanged function and passes after,
// which is why it is written as the full conjunction rather than as a spot check. Three different
// records each proposed a different single discriminator (the write shape, the exit status, the
// exit route) and all three were wrong: only the conjunction of a monolithic write AND an explicit
// process.exit() reaches the cell that banked a false green. See docs/decisions/058-*.md.

/** Two mebibytes: past the 1 MiB ceiling that used to exist, and past a 64 KiB pipe buffer. */
const TWO_MIB = 2 * 1024 * 1024;

/** 900 KiB: under the ceiling that used to exist, so it is the regression the fix must not move. */
const UNDER_OLD_CEILING = 900 * 1024;

/**
 * A child that writes `bytes` to its output and then leaves, in each of the ways that has been
 * proposed as the discriminator. `by exit()` is the load-bearing one: it does not flush a pipe, so
 * before Q-0070 the child discarded its own unwritten bytes and one pipe buffer was all that ever
 * arrived.
 */
const producer = (
  bytes: number,
  shape: 'monolithic' | 'progressive',
  leaves: 'naturally' | 'by exit()',
  status: number,
): string => {
  const chunk = 1024;
  const write = shape === 'monolithic'
    ? `const s='x'.repeat(${bytes});process.stdout.write(s);`
    : `for(let i=0;i<${bytes / chunk};i++)process.stdout.write('x'.repeat(${chunk}));`;
  const leave = leaves === 'by exit()' ? `process.exit(${status});` : `process.exitCode=${status};`;
  return `node -e ${JSON.stringify(write + leave)}`;
};

describe('AC-3 — the result does not depend on the write shape, on process.exit(), or on a kill', () => {
  for (const shape of ['monolithic', 'progressive'] as const) {
    for (const leaves of ['naturally', 'by exit()'] as const) {
      for (const status of [0, 3]) {
        const cell = `${shape}, leaves ${leaves}, status ${status}`;
        // Named in the test, as the criterion requires: this is the cell that returned code 0 with
        // 65,536 of 2,097,152 bytes and no marker of any kind, so integrate wrote tests=ok over a
        // suite whose output had been thrown away. Raising maxBuffer could never have reached it.
        const known = shape === 'monolithic' && leaves === 'by exit()' && status === 0
          ? ' [THE FALSE GREEN]' : '';

        test(`2 MiB arrives whole and the status survives — ${cell}${known}`, () => {
          const result = runCommand(producer(TWO_MIB, shape, leaves, status), tempDir('cmd-'));

          expect(result.out.length, `${cell}: got ${result.out.length} of ${TWO_MIB} bytes`).toBe(TWO_MIB);
          expect(result.code, `${cell}: the child's own status, not a kill's`).toBe(status);
          expect(result.timedOut, `${cell}: nothing here timed out`).toBe(false);
        });
      }
    }
  }
});

describe('AC-5 — the under-ceiling and shape regressions are untouched', () => {
  test('a 900 KiB child still returns code 0 and every byte', () => {
    const result = runCommand(producer(UNDER_OLD_CEILING, 'progressive', 'naturally', 0), tempDir('cmd-'));

    expect(result.out.length).toBe(UNDER_OLD_CEILING);
    expect(result).toMatchObject({ code: 0, timedOut: false });
  });
});

describe('AC-2 — the composition contract, with a test a shared capture file fails', () => {
  // command.ts documents the asymmetry and nothing tested it until now: `printf hello` writes no
  // stderr, so the landed shape pin could not see it. The existing 'OUTERR' assertion does not
  // discriminate either — two sequential writes land in that order under one shared file as well.
  test('stderr is discarded on the success path', () => {
    expect(runCommand('printf OUT; printf ERR >&2', tempDir('cmd-')))
      .toStrictEqual({ code: 0, out: 'OUT', timedOut: false });
  });

  test('the failure path is whole stdout then whole stderr, never interleaved', () => {
    const result = runCommand('printf OUT; printf ERR >&2; printf OUT2; exit 1', tempDir('cmd-'));

    // Interleaved by arrival this reads OUTERROUT2. Two capture files is what makes it OUTOUT2ERR.
    expect(result.out).toBe('OUTOUT2ERR');
    expect(result.code).toBe(1);
  });
});

describe('AC-4 — a timeout is still a timeout, and it keeps what the child produced', () => {
  test('output written before the kill survives, and timedOut says why', () => {
    const result = runCommand(
      `node -e ${JSON.stringify("process.stdout.write('EARLY');setTimeout(()=>{},60000);")}`,
      tempDir('cmd-'),
      { timeoutMs: 750 },
    );

    expect(result.timedOut).toBe(true);
    expect(result.out, 'a timeout must not also lose the evidence').toBe('EARLY');
  });
});

describe('AC-6 — a capture failure stops the run and can never look like a test result', () => {
  // The one place this module's contract is broken on purpose. A capture failure must not be able
  // to satisfy `expect: pass` or `expect: fail`, and the engine's `tests=` line is never reached on
  // a throw — so the property holds structurally, and what is asserted here is that it throws at
  // all, on both halves of the capture, with a message naming the capture rather than the command.

  test('a capture directory that cannot be created throws, and reports no verdict', () => {
    // The working directory is made before TMPDIR moves: tempDir() reads it too, and a fixture that
    // throws in its own setup would prove nothing about runCommand.
    const cwd = tempDir('cmd-');
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = path.join(cwd, 'no', 'such', 'place');
    try {
      expect(() => runCommand('printf hello', cwd))
        .toThrow(/could not create the directory it captures output into/);
    } finally {
      if (previous === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previous;
    }
  });

  test('a capture that cannot be read back throws rather than reporting an empty command', () => {
    // The sandbox is made before the spy, and runCommand is synchronous, so nothing else reads a
    // file inside the window. Deliberately not aliased through `const real = fs.readFileSync`:
    // turbo-inputs.test.ts refuses a read API taken as a value, because an alias is exactly what
    // its scan cannot follow.
    const cwd = tempDir('cmd-');
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('EIO: simulated capture read failure');
    });

    try {
      expect(() => runCommand('printf hello', cwd))
        .toThrow(/could not read back what the command wrote/);
    } finally {
      spy.mockRestore();
    }
  });

  test('a close that reports a deferred write failure names the capture, not the command', () => {
    // Close is where a filesystem that defers write errors reports them, and it is the only place
    // this code can see one — the child owns the descriptor while it writes. Unwrapped it threw a
    // bare ENOSPC, which reads as something the command did. Q-0070's hand review.
    const cwd = tempDir('cmd-');
    const spy = vi.spyOn(fs, 'closeSync').mockImplementation(() => {
      throw new Error('ENOSPC: simulated deferred write failure');
    });

    try {
      expect(() => runCommand('printf hello', cwd))
        .toThrow(/could not finish writing its capture file for the command's output/);
      // Still a capture failure and still no verdict, so it can satisfy neither expect.
      expect(() => runCommand('printf hello', cwd)).toThrow(/no result is reported for it/);
    } finally {
      spy.mockRestore();
    }
  });

  test('the throw names the capture, so it is never read as something the command did', () => {
    const cwd = tempDir('cmd-');
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = path.join(cwd, 'absent');
    try {
      runCommand('exit 1', cwd);
      expect.unreachable('a broken capture must not return a result');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain('no result is reported for it');
    } finally {
      if (previous === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previous;
    }
  });
});
