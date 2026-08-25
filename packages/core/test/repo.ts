// Test support for `core`: throwaway git repositories, and a `git` first on PATH that can count
// or break invocations.
//
// It lives OUTSIDE `src/` because Vitest is configured to collect `src/**/*.test.ts` and this is
// not a suite. Every fixture below builds the topology it asserts: no test in this package may
// assert the containment state of a branch in THIS repository, which would be red until the next
// landing and green forever after — the failure the permanent-acceptance-test decision
// (docs/DECISIONS.md, 2026-08-23) exists to prevent.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const created: string[] = [];

/** A temporary directory that {@link removeTempDirs} will clean up at the end of the file. */
export function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `q0042-${prefix}`));
  created.push(dir);
  return dir;
}

export function removeTempDirs(): void {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** An identity is passed per invocation so the suite does not depend on the machine's git config. */
export const commit = (cwd: string, message: string): void => {
  git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', message);
};

export const commitAll = (cwd: string, message: string): void => {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', message);
};

export const write = (file: string, body: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

/** A repository with one commit on `main`, and nothing else. */
export function repo(): string {
  const dir = tempDir('repo-');
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, 'init');
  return dir;
}

/** A directory that is not a git repository at all, and is inside none. */
export const notARepo = (): string => tempDir('plain-');

/**
 * A genuinely shallow clone of `origin`. `--depth` is silently ignored for a plain local path, so
 * the `file://` scheme is required — as spike/test/q0036-board-containment.js:132 already notes.
 */
export function shallowCloneOf(origin: string): string {
  const parent = tempDir('clone-');
  const clone = path.join(parent, 'clone');
  git(parent, 'clone', '-q', '--depth', '1', '--no-single-branch', `file://${origin}`, clone);
  if (git(clone, 'rev-parse', '--is-shallow-repository') !== 'true') {
    throw new Error('fixture is not shallow: the clone reported a complete history');
  }
  return clone;
}

/** A recursive listing of `dir`, sorted — the before/after snapshot for "this writes nothing". */
export const walk = (dir: string): string[] =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort() : [];

export interface GitShim {
  /** How many git processes have been spawned since the shim was installed. */
  calls(): number;
  restore(): void;
}

/**
 * Puts a `git` of our own first on PATH for the duration, which counts every invocation and — when
 * `body` says so — makes a chosen subcommand fail. Both are needed by criteria that must not
 * change the module's signature to be testable: AC-6 counts spawns, and AC-4's `git failed` cases
 * are otherwise unreachable through a repository that is healthy enough to have been probed.
 *
 * `body` is shell, run before the real git is exec'd; `exit 3` in it makes the call fail with a
 * status that is neither 0 nor 1, which is exactly what rule 1 turns on. POSIX only, which the
 * workspace already is (docs/04-architecture.md's non-goals put Windows beyond WSL out of v1).
 */
export function installGitShim(body = ''): GitShim {
  const dir = tempDir('shim-');
  const log = path.join(dir, 'calls');
  const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const shim = path.join(dir, 'git');
  fs.writeFileSync(shim, [
    '#!/bin/sh',
    `printf . >> ${JSON.stringify(log)}`,
    body,
    `exec ${JSON.stringify(realGit)} "$@"`,
    '',
  ].join('\n'));
  fs.chmodSync(shim, 0o755);
  const previous = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${previous ?? ''}`;
  return {
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').length : 0),
    restore: () => {
      if (previous === undefined) delete process.env.PATH;
      else process.env.PATH = previous;
    },
  };
}

/** Runs `fn` with the shim installed, and hands back its result and the number of git spawns. */
export function counting<T>(fn: () => T, body = ''): { result: T; calls: number } {
  const shim = installGitShim(body);
  try {
    const result = fn();
    return { result, calls: shim.calls() };
  } finally {
    shim.restore();
  }
}
