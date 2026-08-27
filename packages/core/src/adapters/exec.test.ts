// Q-0047 AC-8: `exec()` as Q-0063 fixed it.
//
// These are spike/test/q0063-stdin-epipe.js's five checks, landing here in Vitest because `exec` is
// this ticket's module and charter §1 puts a module's library-level tests with the module rather
// than with Q-0054. The spike file is not edited, deleted or re-pointed (charter §3): both run.
//
// A CLI that exits before reading its prompt closes that pipe under us. Prompts run to 50-150KB
// against a 64KB pipe buffer, so the write cannot complete in one pass and depends on the child
// draining it — and an expired login, a rejected model alias or a crash all win that race. Before
// Q-0063 the resulting EPIPE landed on a stream with no listener, Node threw `Unhandled 'error'
// event`, and the vendor's own message was replaced by a node:events stack trace. It presented as a
// flaky CI test, because on an unloaded machine the write wins.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { exec } from './exec.js';
import { removeTempDirs, tempDir } from '../../test/repo.js';

afterAll(removeTempDirs);

const dir = tempDir('q0063-');
let written = 0;

/** An executable that runs `body` and nothing else — deliberately not the recording stub, which drains stdin. */
const script = (body: string): string => {
  const file = path.join(dir, `bin-${written++}`);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`);
  fs.chmodSync(file, 0o755);
  return file;
};

/** Comfortably past a 64KB pipe buffer, so the write provably cannot complete in one pass. */
const HUGE = 'x'.repeat(512 * 1024);

describe('AC-8 — a CLI that exits before reading its prompt fails its step, it does not kill the run', () => {
  test('exiting 0 without reading stdin does not crash the process', async () => {
    const result = await exec(script("printf 'done'\nexit 0"), [], { cwd: dir, stdin: HUGE });
    expect(result.code, 'the child exit code is the authority').toBe(0);
    expect(result.stdout).toBe('done');
  });

  test('exiting non-zero without reading stdin reports the CHILD\'s exit code and message', async () => {
    const result = await exec(script("printf 'vendor said no' >&2\nexit 7"), [], { cwd: dir, stdin: HUGE });
    expect(result.code, 'the vendor exit code must survive, not be replaced by an EPIPE').toBe(7);
    expect(result.stderr, 'the vendor\'s own message must reach the caller').toMatch(/vendor said no/);
  });

  test('the truncated prompt is recorded rather than swallowed', async () => {
    const result = await exec(script('exit 3'), [], { cwd: dir, stdin: HUGE });
    expect(result.code).toBe(3);
    expect(result.stderr, 'a prompt that was never delivered is a fact the run needs — never default silently')
      .toMatch(/closed its input before the prompt was fully written/);
  });

  test('a CLI that does read its prompt is unaffected', async () => {
    const result = await exec(script('wc -c'), [], { cwd: dir, stdin: HUGE });
    expect(result.code).toBe(0);
    expect(Number(result.stdout.trim()), 'the whole prompt must still arrive').toBe(HUGE.length);
    expect(result.stderr, 'no truncation note when nothing was truncated').not.toMatch(/closed its input/);
  });

  test('a missing binary resolves with code -1 rather than throwing', async () => {
    const result = await exec(path.join(dir, 'does-not-exist'), [], { cwd: dir, stdin: 'small' });
    expect(result.code, 'exec() resolves on spawn failure; that behaviour is preserved').toBe(-1);
    expect(result.stderr).toMatch(/ENOENT/);
  });
});

describe('AC-8 — lines arrive complete, in order, and a trailing partial one is flushed', () => {
  test('each complete line is delivered without its newline', async () => {
    const lines: string[] = [];
    await exec(script("printf 'one\\ntwo\\nthree\\n'"), [], { cwd: dir, onLine: (line) => lines.push(line) });
    expect(lines).toStrictEqual(['one', 'two', 'three']);
  });

  test('a trailing line with no newline is flushed on close, exactly once', async () => {
    const lines: string[] = [];
    const result = await exec(script("printf 'one\\npartial'"), [], { cwd: dir, onLine: (line) => lines.push(line) });
    expect(lines).toStrictEqual(['one', 'partial']);
    expect(result.stdout, 'stdout is the whole of it, newlines included').toBe('one\npartial');
  });

  test('and nothing at all is delivered as nothing', async () => {
    const lines: string[] = [];
    await exec(script('exit 0'), [], { cwd: dir, onLine: (line) => lines.push(line) });
    expect(lines).toStrictEqual([]);
  });

  test('argv reaches the child, and cwd is where it runs', async () => {
    const result = await exec(script('printf "%s|" "$@"; pwd'), ['--first', 'second value'], { cwd: dir });
    expect(result.stdout).toContain('--first|second value|');
    expect(result.stdout.trim().endsWith(path.basename(dir))).toBe(true);
  });
});
