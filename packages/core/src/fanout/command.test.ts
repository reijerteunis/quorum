// Q-0048 AC-10: the shell, the fifteen-minute default, and the three ways to spot a kill.
//
// No case here waits for the default timeout: every timing assertion supplies a short `timeoutMs`
// and then bounds the elapsed time well inside what the command was asked to do.
import { afterAll, describe, expect, test } from 'vitest';

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
