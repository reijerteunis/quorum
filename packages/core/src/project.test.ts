// Q-0043 AC-10: project discovery and loading, lifted out of the CLI.
//
// Every case builds the directory tree it asserts, and the working directory is supplied through a
// spy rather than by moving the interpreter into a fixture — a suite that changes the working
// directory changes it for whatever runs beside it, and it is unavailable in some worker pools.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import { Backlog } from './backlog.js';
import { ProjectNotFoundError, findProject, loadProject } from './project.js';
import { removeTempDirs, tempDir, walk, write } from '../test/repo.js';

afterAll(removeTempDirs);

const CONFIG = 'backlog:\n  layout: in-repo\n  path: backlog\nrepo:\n  base_branch: main\n';

/** A repository root holding `harness/harness.yaml`, with whatever config text is given. */
function project(config = CONFIG): string {
  const dir = tempDir('project-');
  write(path.join(dir, 'harness', 'harness.yaml'), config);
  return dir;
}

/** Runs `fn` as if the interpreter's working directory were `dir`. */
function from<T>(dir: string, fn: () => T): T {
  const spy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe('AC-10 — findProject walks up, resolves, and answers null at the root', () => {
  test('the repository root finds itself', () => {
    const dir = project();
    expect(findProject(dir)).toBe(dir);
  });

  test('a nested subdirectory finds the root above it', () => {
    const dir = project();
    const deep = path.join(dir, 'packages', 'core', 'src');
    fs.mkdirSync(deep, { recursive: true });
    expect(findProject(deep)).toBe(dir);
  });

  test('the NEAREST project wins when one is nested inside another', () => {
    const outer = project();
    const inner = path.join(outer, 'vendor', 'other-repo');
    write(path.join(inner, 'harness', 'harness.yaml'), CONFIG);
    expect(findProject(path.join(inner, 'src'))).toBe(inner);
    expect(findProject(outer)).toBe(outer);
  });

  test('a relative start is resolved, and the answer is absolute', () => {
    const dir = project();
    const relative = path.relative(process.cwd(), dir);
    expect(path.isAbsolute(relative)).toBe(false);
    expect(findProject(relative)).toBe(dir);
  });

  test('a tree with no harness/harness.yaml above it answers null', () => {
    expect(findProject(tempDir('bare-'))).toBeNull();
  });

  test('with no argument it starts from the working directory', () => {
    const dir = project();
    expect(from(path.join(dir, 'harness'), () => findProject())).toBe(dir);
  });
});

describe('AC-10 — loadProject returns a value or throws, and never ends the run itself', () => {
  test('the four keys, absolute where they are paths', () => {
    const dir = project();
    const loaded = loadProject(dir);
    expect(Object.keys(loaded).sort()).toStrictEqual(['backlog', 'config', 'harnessDir', 'repoDir']);
    expect(loaded.repoDir).toBe(path.resolve(dir));
    expect(loaded.harnessDir).toBe(path.join(path.resolve(dir), 'harness'));
    expect(loaded.backlog).toBeInstanceOf(Backlog);
    // Reading through the shared type, which is what AC-11 declares it for.
    expect(loaded.config.repo?.base_branch).toBe('main');
    expect(loaded.config.backlog?.layout).toBe('in-repo');
  });

  test('an explicit dir is resolved; no argument discovers from the working directory', () => {
    const dir = project();
    const relative = path.relative(process.cwd(), dir);
    expect(loadProject(relative).repoDir).toBe(dir);
    expect(from(path.join(dir, 'packages', 'core'), () => loadProject().repoDir)).toBe(dir);
  });

  test('the backlog root follows config.backlog.path — relative, absolute, or absent', () => {
    const relative = project('backlog:\n  path: tickets/open\n');
    expect(loadProject(relative).backlog.root).toBe(path.join(relative, 'tickets', 'open'));

    const elsewhere = tempDir('central-');
    const absolute = project(`backlog:\n  path: ${elsewhere}\n`);
    expect(loadProject(absolute).backlog.root).toBe(elsewhere);

    const absent = project('repo:\n  base_branch: main\n');
    expect(loadProject(absent).backlog.root).toBe(path.join(absent, 'backlog'));
  });

  test('a config holding only {}, an empty one, and one that is all comment all load', () => {
    for (const text of ['{}\n', '', '# only a comment\n']) {
      const dir = project(text);
      expect(loadProject(dir).config, JSON.stringify(text)).toStrictEqual({});
      expect(loadProject(dir).backlog.root).toBe(path.join(dir, 'backlog'));
    }
  });

  test('no project found: the named error, carrying the sentence the CLI prints today', () => {
    const bare = tempDir('bare-');
    from(bare, () => {
      expect(() => loadProject()).toThrow(ProjectNotFoundError);
      try {
        loadProject();
        expect.unreachable('loadProject should have refused');
      } catch (error) {
        expect((error as Error).name).toBe('ProjectNotFoundError');
        expect((error as Error).message).toBe('no harness/harness.yaml found — run `harness init` in your repo');
      }
    });
  });

  test('loading a project creates nothing — not the backlog, not a directory, not a file', () => {
    const dir = project();
    const before = walk(dir);
    const loaded = loadProject(dir);
    loaded.backlog.list();
    findProject(dir);
    expect(walk(dir)).toStrictEqual(before);
    expect(fs.existsSync(loaded.backlog.root)).toBe(false);
  });
});
