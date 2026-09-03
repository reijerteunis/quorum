/**
 * Q-0093 AC-9 — the scaffolding is `core`'s, it throws rather than exiting, and the config is
 * edited rather than re-emitted.
 *
 * **The template tree here is built by the fixture and is not the shipped one.** What
 * `packages/cli/templates/harness` contains is that package's subject: its own suite asserts the
 * twenty files are byte-identical to `spike/templates/harness` and that `init` preserves the real
 * `harness.yaml`'s comments. Reading the shipped tree from here would make `@quorum/core#test`'s
 * verdict depend on a directory this package's turbo inputs do not declare (Q-0072), to re-assert
 * something a sibling suite already covers.
 *
 * Every fixture is a temporary directory this file created. The git repositories are built here and
 * carry an explicit identity on the one call that writes an object — *"A test's verdict is a
 * property of the commit, not of the checkout or the account"* (2026-08-30).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { pathToFileURL } from 'node:url';

import YAML from 'yaml';
import { afterEach, describe, expect, test } from 'vitest';

import { initProject, ProjectExistsError } from './scaffold.js';
import * as scaffoldModule from './scaffold.js';
import * as barrel from '../index.js';
import { coreSourceFiles } from '../../test/corpus.js';

/** This module's own text, through the corpus helper — the read route already registered. */
const scaffoldSource = (): string => {
  const found = coreSourceFiles().find(([name]) => name === 'backlog/scaffold.ts');
  if (!found) throw new Error('corpus missing: packages/core/src/backlog/scaffold.ts does not exist');
  return found[1];
};

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const tmp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `q0093-${prefix}`));
  made.push(dir);
  return dir;
};

/**
 * The template `harness.yaml` these fixtures copy: two keys under `repo`, each behind a comment, so
 * the comment-preservation claim has a subject that is not the shipped file.
 */
const TEMPLATE_CONFIG = [
  '# Harness project config.',
  'backlog:',
  '  path: backlog',
  'repo:',
  '  # Base branch used to materialize review diffs.',
  '  base_branch: main',
  '  # Maximum UTF-8 byte length of a review diff before truncation.',
  '  max_diff_bytes: 200000',
  '',
].join('\n');

/** A template tree with a config, a flow and a role — three files at three depths. */
function templates(): string {
  const root = tmp('templates-');
  fs.mkdirSync(path.join(root, 'flows'), { recursive: true });
  fs.mkdirSync(path.join(root, 'roles'), { recursive: true });
  fs.writeFileSync(path.join(root, 'harness.yaml'), TEMPLATE_CONFIG);
  fs.writeFileSync(path.join(root, 'flows', 'requirements.yaml'), 'name: requirements\nsteps: []\n');
  fs.writeFileSync(path.join(root, 'roles', 'product-manager.md'), '# product-manager\n');
  return root;
}

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A repository on `branch`, with a commit unless the caller wants an unborn HEAD. */
function repo(branch: string, commit = true): string {
  const dir = tmp('repo-');
  git(dir, 'init', '-q', '-b', branch);
  if (commit) git(dir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

/** Every path under `dir`, relative and sorted. */
function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? [path.relative(base, full), ...walk(full, base)] : [path.relative(base, full)];
  }).sort();
}

const configOf = (dir: string): { repo?: { base_branch?: string; max_diff_bytes?: number } } =>
  YAML.parse(fs.readFileSync(path.join(dir, 'harness', 'harness.yaml'), 'utf8')) as
    { repo?: { base_branch?: string; max_diff_bytes?: number } };

describe('AC-9(a) — it copies the tree, creates the backlog, and refuses rather than exiting', () => {
  test('the template tree lands at <dir>/harness and <dir>/backlog is created', () => {
    const dir = tmp('project-');
    initProject(dir, templates());
    expect(walk(dir)).toStrictEqual([
      'backlog',
      'harness',
      path.join('harness', 'flows'),
      path.join('harness', 'flows', 'requirements.yaml'),
      path.join('harness', 'harness.yaml'),
      path.join('harness', 'roles'),
      path.join('harness', 'roles', 'product-manager.md'),
    ].sort());
    expect(fs.statSync(path.join(dir, 'backlog')).isDirectory()).toBe(true);
  });

  test('an existing <dir>/harness throws the spike\'s sentence, naming the absolute path', () => {
    // The message is what a caller prints, so it is asserted as an identity rather than matched:
    // `spike/bin/harness.js:320` is ``die(`${dst} already exists`)`` and `dst` is the joined path.
    const dir = tmp('occupied-');
    fs.mkdirSync(path.join(dir, 'harness'));
    expect(() => initProject(dir, templates())).toThrow(ProjectExistsError);
    expect(() => initProject(dir, templates())).toThrow(`${path.join(dir, 'harness')} already exists`);
  });

  test('and that refusal leaves a previously absent backlog absent, because the check runs first', () => {
    // AC-6(b)'s ordering clause, which is a property of `initProject` and not of the command: the
    // spike tests `harness/` before `mkdirSync`ing `backlog/`, so a refusal writes nothing at all.
    // A tidier implementation that created the backlog first would pass every other test here.
    const dir = tmp('order-');
    fs.mkdirSync(path.join(dir, 'harness'));
    expect(() => initProject(dir, templates())).toThrow(ProjectExistsError);
    expect(walk(dir)).toStrictEqual(['harness']);
  });

  test('an existing <dir>/backlog is not a refusal, and its contents survive', () => {
    // The asymmetry beside the ordering: only `harness/` is tested, and the `recursive: true` over
    // an existing `backlog/` is a no-op. Preserved and pinned — Q-0093 AC-6(b).
    const dir = tmp('backlog-there-');
    fs.mkdirSync(path.join(dir, 'backlog', 'T-0001-x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'backlog', 'T-0001-x', 'ticket.md'), 'kept\n');
    initProject(dir, templates());
    expect(fs.readFileSync(path.join(dir, 'backlog', 'T-0001-x', 'ticket.md'), 'utf8')).toBe('kept\n');
    expect(fs.existsSync(path.join(dir, 'harness', 'harness.yaml'))).toBe(true);
  });

  test('it terminates nothing and writes to no stream, which is what a library may not do', () => {
    // `project.ts`'s reason, asserted rather than restated: the CLI's own version of this ends in
    // `die()`, and M3's daemon hosts the same function.
    const text = scaffoldSource();
    for (const forbidden of ['process.exit', 'console.']) {
      expect(text.includes(forbidden), `scaffold.ts must not reach for ${forbidden}`).toBe(false);
    }
  });
});

describe('AC-9(b)/(c) — the probe is the module\'s and the barrel carries the pair a command needs', () => {
  test('scaffold.ts exports the function and the error class, and nothing else', () => {
    expect(Object.keys(scaffoldModule).sort()).toStrictEqual(['ProjectExistsError', 'initProject']);
    expect(scaffoldModule.ProjectExistsError.prototype).toBeInstanceOf(Error);
  });

  test('both reach the barrel, and the branch probe does not', () => {
    // A symbol reaches the public surface because a command needs it (Q-0092's rule, applied when it
    // withheld `manifestShapeError`). No command asks git for a branch name; `initProject` does.
    expect(Object.keys(scaffoldModule).filter((symbol) => symbol in barrel).sort())
      .toStrictEqual(['ProjectExistsError', 'initProject']);
    expect(Object.keys(barrel), 'the probe is on the public surface and no command needs it')
      .not.toContain('currentBranch');
  });
});

describe('AC-7 — the base branch comes from the checkout, and every fallback is silent', () => {
  test('a named branch with a commit replaces the template\'s default', () => {
    const dir = repo('master');
    initProject(dir, templates());
    expect(configOf(dir).repo?.base_branch).toBe('master');
  });

  test('an unborn HEAD names its branch too, which is the case an adopter meets first', () => {
    // `git init -b master` before any commit: `--show-current` answers `master` rather than failing,
    // and a fresh repository is exactly the state `quorum init` is run in.
    const dir = repo('master', false);
    expect(git(dir, 'branch', '--show-current'), 'the fixture has no unborn HEAD').toBe('master');
    initProject(dir, templates());
    expect(configOf(dir).repo?.base_branch).toBe('master');
  });

  test('a detached HEAD falls back, and that row exercises successful git with empty stdout', () => {
    // The row `q0033-surface.js` asserts explicitly before relying on it: a fixture that made git
    // *fail* would have tested the no-repository case twice and this one never.
    const dir = repo('main');
    git(dir, 'checkout', '-q', '--detach', 'HEAD');
    expect(git(dir, 'branch', '--show-current'), 'the fixture must exercise successful git with empty stdout').toBe('');
    initProject(dir, templates());
    expect(configOf(dir).repo?.base_branch).toBe('main');
  });

  test('a directory that is no repository falls back to the template\'s own value', () => {
    const dir = tmp('norepo-');
    initProject(dir, templates());
    expect(configOf(dir).repo?.base_branch).toBe('main');
  });

  test('the file is edited rather than re-emitted, so its comments and its other keys survive', () => {
    // The property the mechanism exists for. `parseDocument` + `setIn` + `toString` moves one
    // scalar; a `YAML.parse` / `YAML.stringify` round trip answers the same for `base_branch` and
    // destroys every comment, which is most of what an adopter's first config file is.
    const dir = repo('master');
    initProject(dir, templates());
    const text = fs.readFileSync(path.join(dir, 'harness', 'harness.yaml'), 'utf8');
    expect(text).toContain('# Harness project config.');
    expect(text).toContain('# Base branch used to materialize review diffs.');
    expect(text).toContain('# Maximum UTF-8 byte length of a review diff before truncation.');
    expect(configOf(dir).repo?.max_diff_bytes, 'a wholesale rewrite kept one key and lost the rest').toBe(200000);
    expect(text).toContain('base_branch: master');
  });

  test('and that claim discriminates — a round trip through parse/stringify loses them', () => {
    // Without this the assertions above would hold for any implementation that happened to leave the
    // file alone, and the mechanism would be unestablished (2026-08-29).
    const roundTripped = YAML.stringify(YAML.parse(TEMPLATE_CONFIG));
    expect(roundTripped).toContain('base_branch: main');
    expect(roundTripped, 'the round trip preserved the comments, so the claim above is empty').not.toContain('#');
  });

  test('a config the edit cannot parse leaves init successful and the file untouched', () => {
    // The `catch` is best-effort by design: `init` may not fail because of a branch name, and a
    // template a fork has edited into something unparseable still scaffolds.
    const source = templates();
    fs.writeFileSync(path.join(source, 'harness.yaml'), 'repo: [unclosed\n');
    const dir = repo('master');
    expect(() => initProject(dir, source)).not.toThrow();
    expect(fs.readFileSync(path.join(dir, 'harness', 'harness.yaml'), 'utf8')).toBe('repo: [unclosed\n');
  });

  test('a template tree handed as a file: URL copies the same tree, which is what keeps node:url out of the CLI', () => {
    // Q-0093 OQ-1, re-confirmed under this workspace's Node rather than inherited from the gate's
    // measurement: `fs.cpSync` takes `string | URL` for its source, so `packages/cli` can hand this
    // function `new URL('../templates/harness/', import.meta.url)` and import no URL machinery of
    // its own. Both spellings are run over the same tree, so a divergence is a failure rather than
    // an untested assumption.
    const source = templates();
    const byPath = tmp('by-path-');
    const byUrl = tmp('by-url-');
    initProject(byPath, source);
    initProject(byUrl, pathToFileURL(`${source}${path.sep}`));
    expect(walk(byUrl)).toStrictEqual(walk(byPath));
    expect(fs.readFileSync(path.join(byUrl, 'harness', 'harness.yaml'), 'utf8'))
      .toBe(fs.readFileSync(path.join(byPath, 'harness', 'harness.yaml'), 'utf8'));
  });
});
