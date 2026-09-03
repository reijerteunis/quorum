/**
 * Q-0093 AC-6, AC-7 and AC-8 for `quorum init`.
 *
 * **The translated half of `spike/test/q0033-surface.js`'s `initFixture` and S5.1–S5.7/E5** — the
 * six repository states an adopter can run this in, and the property the fixture exists to prove:
 * `harness.yaml` is *edited* rather than re-emitted, so its comments survive. `spike-parity.test.ts`
 * records the transfer on that file's row as `binaryCarriedBy`, beside Q-0091's `lint.test.ts`.
 *
 * Every fixture is a temporary directory this file created, and the git repositories are built here
 * with an explicit identity on the one call that writes an object (*"A test's verdict is a property
 * of the commit, not of the checkout or the account"*, 2026-08-30). What is read out of the
 * repository is this package's own `templates/`, which is not a read outside the package at all —
 * the parity of that tree with the spike's is `templates.test.ts`'s subject.
 *
 * Nothing here spawns the binary: the emitted target's own assertions live in `build.test.ts`, which
 * is the file Q-0098 AC-15(c) rules may spawn the emit, and the end-to-end suite is Q-0095's.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { invoke, plain } from '../test/invoke.js';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The tree `init` copies, which is this package's own asset directory. */
const SHIPPED_TEMPLATES = path.join(PACKAGE, 'templates', 'harness');

/**
 * The sandbox each test works in, and the working directory it is entered from.
 *
 * `<sandbox>/project` is what `init` is pointed at, so `<sandbox>` is the region AC-6(e) asks about:
 * anything written beside `project/` is a write outside the directory the user chose.
 */
let sandbox = '';
let project = '';
let cwd = '';

beforeEach(() => {
  // Realpathed, because `init` prints `path.resolve(rest[0] ?? '.')` and `process.cwd()` answers
  // the resolved path: on macOS `os.tmpdir()` is `/var/folders/…`, a symlink to `/private/var/…`,
  // so an unresolved fixture path would make every message assertion below fail for a reason that
  // is a property of the machine rather than of the command.
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-init-')));
  project = path.join(sandbox, 'project');
  fs.mkdirSync(project);
  cwd = process.cwd();
  process.chdir(project);
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(sandbox, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A git repository at `dir`, on `branch`, with a commit unless the caller wants an unborn HEAD. */
function repo(dir: string, branch: string, commit = true): void {
  git(dir, 'init', '-q', '-b', branch);
  if (commit) git(dir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
}

/** Every path under `dir`, relative and sorted, directories included. */
function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? [path.relative(base, full), ...walk(full, base)] : [path.relative(base, full)];
  }).sort();
}

const configText = (dir: string): string => fs.readFileSync(path.join(dir, 'harness', 'harness.yaml'), 'utf8');

/**
 * The written config's `repo.base_branch`, read out of the file's own text.
 *
 * Read rather than parsed because `@quorum/cli` depends on `yaml` — and on nothing else third-party
 * — through neither of its two workspace links (non-goal 12, and `package.test.ts`'s manifest pin).
 * The key is anchored to the start of its own line, so the `# Base branch used to materialize review
 * diffs.` comment above it cannot answer for it.
 */
const baseBranch = (dir: string): string | null =>
  /^\s*base_branch:\s*(\S+)\s*$/m.exec(configText(dir))?.[1] ?? null;

describe('AC-6 — it scaffolds where it was pointed, refuses rather than overwriting, and prints two lines', () => {
  test('with no argument it scaffolds the working directory, from the shipped templates', async () => {
    const { exitCode, hard, stdout } = await invoke(['init']);
    expect({ exitCode, hard }).toStrictEqual({ exitCode: SUCCESS, hard: false });
    expect(fs.existsSync(path.join(project, 'backlog'))).toBe(true);
    // The whole tree, not a sample: `init`'s value is that an adopter's flows are the shipped ones.
    const shipped = walk(SHIPPED_TEMPLATES);
    expect(walk(path.join(project, 'harness'))).toStrictEqual(shipped);
    for (const relative of shipped.filter((name) => fs.statSync(path.join(SHIPPED_TEMPLATES, name)).isFile())) {
      expect(fs.readFileSync(path.join(project, 'harness', relative)), relative)
        .toStrictEqual(fs.readFileSync(path.join(SHIPPED_TEMPLATES, relative)));
    }
    expect(plain(stdout)).toContain(`harness/ and backlog/ created in ${project}`);
  });

  test('with an argument it scaffolds that directory and leaves the working one alone', async () => {
    const elsewhere = path.join(sandbox, 'elsewhere');
    fs.mkdirSync(elsewhere);
    const { exitCode, stdout } = await invoke(['init', elsewhere]);
    expect(exitCode).toBe(SUCCESS);
    expect(fs.existsSync(path.join(elsewhere, 'harness', 'harness.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(project, 'harness')), 'it scaffolded the working directory as well').toBe(false);
    expect(plain(stdout)).toContain(elsewhere);
  });

  test('a relative argument is resolved against the working directory', async () => {
    // `path.resolve(rest[0] ?? '.')` and nothing else — the same expression the spike uses, so
    // `quorum init sub` from inside a project means the subdirectory rather than the repository.
    fs.mkdirSync(path.join(project, 'sub'));
    expect((await invoke(['init', 'sub'])).exitCode).toBe(SUCCESS);
    expect(fs.existsSync(path.join(project, 'sub', 'harness', 'harness.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(project, 'harness'))).toBe(false);
  });

  test('an existing <dir>/harness dies with the absolute path, one line and exit 1', async () => {
    fs.mkdirSync(path.join(project, 'harness'));
    const { exitCode, hard, stderr, stdout } = await invoke(['init']);
    expect({ exitCode, hard }).toStrictEqual({ exitCode: ERROR, hard: true });
    expect(plain(stderr).trim()).toBe(`✗ ${path.join(project, 'harness')} already exists`);
    expect(stderr.includes('\n    at '), 'a stack trace tells an adopter the product crashed').toBe(false);
    expect(stdout, 'a refusal announced a success as well').toBe('');
  });

  test('and that refusal leaves a previously absent backlog absent, because the check runs first', async () => {
    // AC-6(b)'s ordering: the `harness/` test precedes the `backlog/` creation, so a refusal writes
    // nothing at all. Preserved and pinned — a tidier implementation would create the backlog first
    // and pass every other assertion in this file.
    fs.mkdirSync(path.join(project, 'harness'));
    expect((await invoke(['init'])).exitCode).toBe(ERROR);
    expect(walk(project)).toStrictEqual(['harness']);
  });

  test('an existing <dir>/backlog is not a refusal, and what is in it survives', async () => {
    // The asymmetry beside the ordering: only `harness/` is tested. Preserved — Q-0093 AC-6(b).
    fs.mkdirSync(path.join(project, 'backlog', 'T-0001-x'), { recursive: true });
    fs.writeFileSync(path.join(project, 'backlog', 'T-0001-x', 'ticket.md'), 'kept\n');
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    expect(fs.readFileSync(path.join(project, 'backlog', 'T-0001-x', 'ticket.md'), 'utf8')).toBe('kept\n');
  });

  test('nothing is written outside the directory it was pointed at', async () => {
    // R-1: `init` is the only command in this package that writes into a directory the user chose,
    // so a path defect damages a stranger's repository rather than printing a wrong line. Asserted
    // over the filesystem — the sandbox above `<dir>` is snapshotted and required to be unchanged —
    // rather than read out of the code.
    expect(walk(sandbox), 'the sandbox holds more than the target, so this comparison is loose')
      .toStrictEqual(['project']);
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    const outside = walk(sandbox).filter((entry) => entry !== 'project' && !entry.startsWith(`project${path.sep}`));
    expect(outside, 'init wrote outside the directory it was given').toStrictEqual([]);
  });

  test('the success message names the directory and the three next commands', async () => {
    // AC-6(d). The second line's exact text is unpinned by any spike assertion — `grep -rn "next:"
    // spike/test/` returns nothing — so what is claimed here is its shape and its content, not a
    // transcription of a string nothing froze.
    const { stdout } = await invoke(['init']);
    const lines = plain(stdout).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`✓ harness/ and backlog/ created in ${project}`);
    expect(lines[1].startsWith('  next: '), lines[1]).toBe(true);
    for (const next of ['adapters', 'ticket new', 'run requirements T-0001']) {
      expect(lines[1], `the next steps no longer name ${next}`).toContain(next);
    }
  });

  test('and that line calls the binary `harness`, which is preserved and is Q-0100\'s to rule', async () => {
    // Why: preserved — Q-0100's body predicts this line by name as the fourth of its instances,
    // beside the board's hint, `ProjectNotFoundError`'s sentence and `validate`'s usage. Pinned so
    // that renaming it is a deliberate act taken with the other three rather than here alone, and so
    // that the successor has an executable subject to move.
    const { stdout } = await invoke(['init']);
    expect(plain(stdout)).toContain('harness adapters · harness ticket new "…" · harness run requirements T-0001');
  });
});

describe('AC-7 — the base branch comes from the checkout, and git never speaks to the terminal', () => {
  test('a named branch replaces the template default, committed and unborn alike', async () => {
    // Both rows of `q0033-surface.js` S5's loop. The unborn one is the state an adopter actually
    // meets: `git init -b master` and then `quorum init`, before anything is committed.
    for (const commit of [true, false]) {
      const dir = path.join(sandbox, `master-${String(commit)}`);
      fs.mkdirSync(dir);
      repo(dir, 'master', commit);
      expect((await invoke(['init', dir])).exitCode).toBe(SUCCESS);
      expect(baseBranch(dir), `commit: ${String(commit)}`).toBe('master');
    }
  });

  test('a repository already on main is discovered rather than skipped, which is the row that looks like a no-op', async () => {
    // The sixth row of the table, and the one an implementation that wrote nothing at all would
    // also pass — so the write is asserted beside the value: `toString()` re-renders the document,
    // and the one visible consequence is that the aligned inline comment on `commands.test` comes
    // back with single spacing. That line is the discriminator between "found main and wrote it"
    // and "never opened the file".
    repo(project, 'main');
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    expect(baseBranch(project)).toBe('main');
    expect(configText(project), 'the config was never rewritten, so this row proves nothing')
      .toContain('  test: npm test # used by integrate steps with run_tests: true');
    expect(fs.readFileSync(path.join(SHIPPED_TEMPLATES, 'harness.yaml'), 'utf8'),
      'the template already carries the collapsed spelling, so the discriminator discriminates nothing')
      .not.toContain('  test: npm test # used by integrate steps with run_tests: true');
  });

  test('a directory that is no repository keeps the template\'s own main, and stderr stays empty', async () => {
    const { exitCode, stderr } = await invoke(['init']);
    expect(exitCode).toBe(SUCCESS);
    expect(baseBranch(project)).toBe('main');
    expect(stderr, 'git spoke to the terminal on an adopter\'s first command').toBe('');
  });

  test('a detached HEAD falls back, and that row exercises successful git with empty stdout', async () => {
    // The distinction `q0033-surface.js` asserts explicitly before relying on it: `--show-current`
    // *succeeds* here and prints nothing, so a fixture that made git fail would have tested the
    // no-repository row twice and this one never.
    repo(project, 'main');
    git(project, 'checkout', '-q', '--detach', 'HEAD');
    expect(git(project, 'branch', '--show-current'), 'the fixture must exercise successful git with empty stdout').toBe('');
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    expect(baseBranch(project)).toBe('main');
  });

  test('a broken GIT_DIR falls back too, and prints no fatal: line', async () => {
    // E5. git's own error text may not reach a stranger's first command: `init` never fails because
    // git failed, and it never repeats what git said.
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(project, 'not-a-repository');
    try {
      const { exitCode, stdout, stderr } = await invoke(['init']);
      expect(exitCode).toBe(SUCCESS);
      expect(baseBranch(project)).toBe('main');
      expect(`${stdout}${stderr}`).not.toMatch(/fatal:|not a git repository/i);
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
  });

  test('the file is edited rather than re-emitted, so the shipped comments and the other keys survive', async () => {
    // The property the whole fixture exists for, in the criterion's own terms: the three comments
    // `q0033-surface.js` S5 names, and `max_diff_bytes` beside them so a wholesale rewrite cannot
    // pass by keeping one key.
    repo(project, 'master');
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    const text = configText(project);
    expect(text).toMatch(/#.*install/i);
    expect(text).toMatch(/#.*base branch/i);
    expect(text).toMatch(/#.*(diff|byte|size)/i);
    expect(text).toMatch(/^\s*max_diff_bytes:\s*200000\s*$/m);
    expect(baseBranch(project)).toBe('master');
  });

  test('and it is stronger than that — two lines of the shipped template differ, and this is both', async () => {
    // The discrimination the assertions above cannot make on their own: they hold for an
    // implementation that leaves the file alone, and for one that re-emits it while happening to
    // keep the comments. This compares the written file with the template line by line, as an
    // identity rather than a count, so a third silently-moved line is a failure that names itself.
    //
    // **The second row is a measurement rather than an expectation, and is reported not fixed.**
    // `toString()` re-renders the document, so an inline comment survives with its TEXT intact and
    // its COLUMN normalised to one space: the template's aligned `npm test          # used by …`
    // comes back as `npm test # used by …`. Nothing is lost and nothing is invented, which is why
    // it is preserved — it is the mechanism the spike uses, byte for byte, and `init` reflowing one
    // comment is not a behaviour this ticket may change (ground rule 3). It is pinned here because a
    // reader comparing an adopter's first `harness.yaml` with the template will see it.
    //
    // The mechanism's own red demonstration — that a full parse/stringify round trip destroys every
    // comment rather than one comment's alignment — is in
    // `packages/core/src/backlog/scaffold.test.ts`, where the mechanism lives and where `yaml` is a
    // declared dependency (non-goal 12).
    repo(project, 'master');
    expect((await invoke(['init'])).exitCode).toBe(SUCCESS);
    const before = fs.readFileSync(path.join(SHIPPED_TEMPLATES, 'harness.yaml'), 'utf8').split('\n');
    const after = configText(project).split('\n');
    expect(after.length, 'the written file has a different number of lines from the template').toBe(before.length);
    const moved = before.map((line, index) => [line, after[index]] as const).filter(([a, b]) => a !== b);
    expect(moved).toStrictEqual([
      ['  base_branch: main', '  base_branch: master'],
      [
        '  test: npm test          # used by integrate steps with run_tests: true',
        '  test: npm test # used by integrate steps with run_tests: true',
      ],
    ]);
  });
});

describe('AC-8 — the templates are found relative to the module, and to nothing else', () => {
  test('the resolution answers this package\'s own templates directory under the suite', () => {
    // Half (a) as the workspace sees it: `src/` is resolved through the `quorum-source` condition
    // here, and the same expression from the emitted `dist/` is asserted in `build.test.ts`, by
    // executing the built binary rather than by reasoning about it.
    const resolved = fileURLToPath(new URL('../templates/harness/', new URL('./init.ts', import.meta.url)));
    expect(path.resolve(resolved)).toBe(path.resolve(SHIPPED_TEMPLATES));
  });

  test('and nothing absolute, ambient or environmental participates in it', () => {
    // Half (c), over the module's own text. A `process.cwd()` would answer the user's directory —
    // which for `quorum init some/dir` is not even the directory being scaffolded — and an
    // environment variable would answer whatever was exported.
    const text = fs.readFileSync(path.join(PACKAGE, 'src', 'init.ts'), 'utf8');
    expect(text, 'the resolution is relative to this module and to nothing else')
      .toContain("new URL('../templates/harness/', import.meta.url)");
    for (const forbidden of ['process.cwd(', 'process.env', "'/"]) {
      expect(text.includes(forbidden), `init.ts must not reach for ${forbidden}`).toBe(false);
    }
  });

  test('the URL is handed to core, so node:url stays out of this package', () => {
    // Half (d). `fs.cpSync` takes `string | URL` for its source, which is what lets the filesystem
    // work stay in `@quorum/core` and lets `frame.source.test.ts`'s package-wide IO ban go on
    // holding for every production module here. Re-confirmed under this workspace's Node rather
    // than inherited from the requirements gate's measurement (merged.md OQ-1): the assertion above
    // resolves it, and the scaffolding ran through it in every test in this file.
    const text = fs.readFileSync(path.join(PACKAGE, 'src', 'init.ts'), 'utf8');
    expect(text.includes('fileURLToPath'), 'init.ts converts the URL itself').toBe(false);
    expect(text.includes("from 'node:url'"), 'init.ts imports a URL machinery of its own').toBe(false);
  });
});
