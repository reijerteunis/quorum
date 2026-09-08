/**
 * Q-0099 AC-3, AC-4, AC-5 and AC-6 for `quorum board`.
 *
 * **The translated binary half of `spike/test/q0036-board-containment.js`** — all ten of its
 * scenarios, C1 to C10, each keeping the discriminating assertion it was written for — plus the one
 * board row `q0033-surface.js`'s S11 asserts over a rewritten `iterations` and a summed `history`.
 * `spike-parity.test.ts` records both transfers as `binaryCarriedBy`.
 *
 * Every fixture is a temporary directory this file created, built through the product's own
 * commands: `quorum init` scaffolds it and `quorum ticket new` writes the ticket, so the frontmatter
 * under test — including the default `branch: harness/T-0001/integration` — is exactly what the
 * product writes, which is what `q0036-board-containment.js:46` asks for and what a hand-written
 * YAML fixture would quietly stop being. Both commands landed in Q-0093; the inherited risk saying
 * they could not be used is obsolete (merged.md M-5).
 *
 * Every fixture is pointed with `--project <dir>` rather than by `process.chdir`, which exercises
 * the flag the spike reads inside its own `loadProject` and keeps this file out of a
 * working-directory race with its neighbours. Every commit carries `-c user.email=…` and
 * `-c user.name=…` **at the call site**, because `packages/core/src/git-identity.test.ts` reads
 * literals and a helper supplying them invisibly looks like a violation to the guard written to find
 * one (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
 * 2026-08-30).
 *
 * Nothing here spawns the binary: `main` is the dispatch boundary this package claims (Q-0091 AC-2),
 * and the one spawned-binary property is `build.test.ts`'s (Q-0098 AC-15(c)). Ten scenarios each
 * starting a Node process would cost seconds for a claim `invoke` already makes (merged.md OQ-6).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { SUCCESS } from './exit.js';
import { invoke, plain, type Invocation } from '../test/invoke.js';

/** The repository root, reached package-relatively — this file names no absolute path. */
const WORKSPACE = fileURLToPath(new URL('../../..', import.meta.url));

/** The shipped flow directory, which AC-3(c) is about and which nothing here modifies. */
const SHIPPED_FLOWS = path.join(WORKSPACE, 'harness', 'flows');

/** The branch every ticket names from creation, and which only an `integrate` step ever creates. */
const TICKET_BRANCH = 'harness/T-0001/integration';

/** Every temporary directory a test made, removed afterwards whatever it asserted. */
const sandboxes: string[] = [];

afterEach(() => {
  for (const dir of sandboxes.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A temporary directory, realpathed and registered for removal.
 *
 * Realpathed because `os.tmpdir()` is `/var/folders/…` on macOS, a symlink to `/private/var/…`, and
 * `loadProject` resolves what it is given: an unresolved fixture path would make a `file://` clone
 * URL and a `process.cwd()` comparison answer for two different directories.
 */
function tmp(prefix = 'quorum-cli-board-'): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  sandboxes.push(dir);
  return dir;
}

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A scaffolded project, in the repository state the scenario asks for. */
async function projectFixture(
  { branch = 'main', commit = true, gitRepo = true }: { branch?: string; commit?: boolean; gitRepo?: boolean } = {},
): Promise<string> {
  const root = tmp();
  if (gitRepo) {
    git(root, 'init', '-q', '-b', branch);
    if (commit) {
      git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
    }
  }
  const created = await invoke(['init', root]);
  expect(created.exitCode, plain(created.stderr)).toBe(SUCCESS);
  return root;
}

/**
 * One ticket at `T-0001`, created through the product's own allocator.
 *
 * `--owner qa` is supplied rather than defaulted, because the default is not a constant: `core`
 * writes `unknown` where nobody said and the CLI resolves git's configured name first (Q-0112), so
 * a row asserting `owner=` off the default would have a verdict that is a property of the machine.
 */
async function makeTicket(root: string, title = 'Board fixture'): Promise<string> {
  const created = await invoke(['ticket', 'new', title, '--owner', 'qa', '--project', root]);
  expect(created.exitCode, plain(created.stderr)).toBe(SUCCESS);
  const folder = fs.readdirSync(path.join(root, 'backlog')).find((name) => name.startsWith('T-0001'));
  expect(folder, 'the ticket folder the allocator was asked for is not there').toBeDefined();
  return path.join(root, 'backlog', folder ?? '');
}

/** Run the board over `root`, as a shell would see it. */
const board = async (root: string): Promise<Invocation> => invoke(['board', '--project', root]);

/** Everything a caller sees, ANSI stripped — `q0036-board-containment.js:31`'s `output`. */
const out = (result: Invocation): string => plain(`${result.stdout}${result.stderr}`);

/** The stage names the board rendered a column for, in the order it printed them. */
const columnsIn = (text: string): string[] => text.split('\n')
  .filter((line) => /^[a-z]/.test(line))
  .map((line) => line.split(' ')[0]);

/** Read and rewrite a fixture ticket's `ticket.md`. */
const ticketText = (ticket: string): string => fs.readFileSync(path.join(ticket, 'ticket.md'), 'utf8');
const rewriteTicket = (ticket: string, body: string): void =>
  fs.writeFileSync(path.join(ticket, 'ticket.md'), body, 'utf8');
const setStage = (ticket: string, stage: string): void =>
  rewriteTicket(ticket, ticketText(ticket).replace(/^stage: .*$/m, `stage: ${stage}`));

/** Every path under `dir`, sorted, or the empty list where it is not there. */
const walk = (dir: string): string[] => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .map((entry) => path.join(entry.parentPath, entry.name)).sort()
  : []);

/** Replace a fixture's flow directory with `files`, written as `<name>.yaml`. */
function flows(root: string, files: Record<string, string>): void {
  const into = path.join(root, 'harness', 'flows');
  fs.rmSync(into, { recursive: true, force: true });
  fs.mkdirSync(into, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(into, `${name}.yaml`), body, 'utf8');
  }
}

/** The smallest flow that lints clean, as `lint.test.ts`'s `basicFlow` builds one (Q-0055). */
const basicFlow = (name: string, consumes: string, produces: string): string =>
  `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps:\n  - id: s\n`;

describe('AC-3 — the columns, and the hint over the flow set core already computes', () => {
  test('every stage with tickets renders, plus the three that always do, in STAGES order', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    const second = await invoke(['ticket', 'new', 'Second', '--owner', 'qa', '--project', root]);
    expect(second.exitCode, plain(second.stderr)).toBe(SUCCESS);
    const other = fs.readdirSync(path.join(root, 'backlog')).find((name) => name.startsWith('T-0002')) ?? '';
    setStage(ticket, 'blocked');
    setStage(path.join(root, 'backlog', other), 'abandoned');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    // `draft` is empty and still renders, which is the half a stranger's first board depends on:
    // showing nothing at all would answer "there is no backlog" where the truth is "nothing is in
    // it yet". `red`, `green`, `reviewed`, `qa-passed` and `deployed` are empty and do not.
    expect(columnsIn(out(result)))
      .toStrictEqual(['draft', 'requirements', 'solutioned', 'blocked', 'abandoned']);
  });

  test('the hint names the first flow consuming that stage, sorted rather than in directory order', async () => {
    // Divergence 1's subject. Both flows consume `requirements`, so the answer is decided by the
    // order the records arrive in; `lintFlowDirectory` sorts, so it is `alpha` whatever the
    // filesystem hands back. The rule, not today's answer — on this machine `readdirSync` already
    // returns sorted order, so a board built on the spike's unspecified order would agree here and
    // disagree somewhere else.
    const root = await projectFixture();
    flows(root, {
      zebra: basicFlow('zebra', 'requirements', 'reviewed'),
      alpha: basicFlow('alpha', 'requirements', 'reviewed'),
    });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toContain('→ quorum run alpha <id>');
    expect(out(result), 'the later-sorting flow won the column').not.toContain('run zebra');
  });

  test('over the six shipped flows the requirements hint is chore, which is today\'s answer', async () => {
    // The fixture above proves the rule; this proves what the shipped directory actually says, and
    // would go red if a seventh flow sorted ahead of `chore.yaml` on the same consumed stage. The
    // read is `harness/flows`, already a declared turbo input for this package's test task.
    const root = await projectFixture();
    fs.rmSync(path.join(root, 'harness', 'flows'), { recursive: true, force: true });
    fs.cpSync(SHIPPED_FLOWS, path.join(root, 'harness', 'flows'), { recursive: true });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(
      out(result),
      'chore.yaml and solutioning.yaml both consume requirements, and chore sorts first',
    ).toContain('requirements  → quorum run chore <id>');
  });

  test('a project with no flows directory renders every column, prints no hint, and exits 0', async () => {
    // Divergence 2's first half: the spike guards with `fs.existsSync`, which no production module
    // in this package may import, so the mechanism is a narrow `ENOENT` catch and the behaviour is
    // the same.
    const root = await projectFixture();
    fs.rmSync(path.join(root, 'harness', 'flows'), { recursive: true, force: true });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(columnsIn(out(result))).toStrictEqual(['draft', 'requirements', 'solutioned']);
    expect(out(result), 'a hint was printed with no flow to name').not.toContain('→');
  });

  test('and a `flows` that is a file still stops the command, which is what keeps the catch narrow', async () => {
    // The other half, and the reason the catch tests `ENOENT` rather than swallowing everything: a
    // blanket `catch {}` would turn a corrupt project, a permissions failure or a lint crash into
    // "no hint" while reporting success — "a check that skips its subject must not report success"
    // (2026-08-25) applied to a command. The spike propagates this too: its `existsSync` answers
    // true for a file and `readdirSync` then raises `ENOTDIR`.
    const root = await projectFixture();
    fs.rmSync(path.join(root, 'harness', 'flows'), { recursive: true, force: true });
    fs.writeFileSync(path.join(root, 'harness', 'flows'), 'not a directory\n', 'utf8');
    await expect(board(root)).rejects.toThrow(/ENOTDIR|not a directory/i);
  });

  test('a column header is the stage name padded to fourteen, whatever its length', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    // `deployed` is the last stage and no shipped flow consumes it, which is what gives this test a
    // column with no hint; it renders at all because the ticket is standing in it.
    setStage(ticket, 'deployed');
    const result = await board(root);
    const lines = out(result).split('\n');
    // `draft` is 5 and `requirements` is 12, so the padding is 9 and 2 — the two ends of the range a
    // stage name can occupy, and enough to tell `padEnd(14)` from any fixed separator. The two
    // numbers are `stage.padEnd(14)`'s and are independent of the hint beside them, so Q-0100's
    // rename moved the binary's name and neither count: a round that "corrects" 9 or 2 because the
    // line got shorter has misread what this test measures.
    expect(lines, 'the shortest stage name').toContain(`draft${' '.repeat(9)}→ quorum run requirements <id>`);
    expect(lines, 'the longest stage name').toContain(`requirements${' '.repeat(2)}→ quorum run chore <id>`);
    // And a column with no consuming flow is the padded name and nothing else: the spike emits an
    // empty dim span there, which is preserved and which nothing rendering through `plain` can see.
    expect(lines, 'a column with no consuming flow').toContain(`deployed${' '.repeat(6)}`);
  });
});

describe('AC-4 — the ticket row, byte for byte', () => {
  test('S11 — `iter` is the iterations object and `cost` is the sum of the history', async () => {
    // `q0033-surface.js:341–342`'s two assertions, over the same rewrite: `iterations` becomes
    // `review: 2` and two history rows are appended, one costing 0 and one costing 1.25 — so the
    // SUM is what is exercised rather than a single value echoed through.
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    let body = ticketText(ticket).replace('iterations: {}', 'iterations:\n  review: 2');
    body = body.replace(
      'history: []',
      'history:\n  - {run: 1, status: exhausted, cost: 0}\n  - {run: 1, status: aborted, cost: 1.25}',
    );
    rewriteTicket(ticket, body);

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/iter=.*review.*2/);
    expect(out(result), 'the two rows are summed, not the last one shown').toMatch(/cost=\$1\.25/);
  });

  test('C3 — and a fresh ticket keeps the row\'s exact current shape at both ends of each format', async () => {
    // `q0036-board-containment.js:126` verbatim, which pins the zero-cost and empty-iterations ends
    // that the assertion above cannot reach: `$0.00` is two decimals of an empty sum, and `{}` is
    // `JSON.stringify` of an object with no keys.
    const root = await projectFixture();
    await makeTicket(root);
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/);
    // The whole line, so the two leading spaces, the single space after the id and the two before
    // the dim span are claimed rather than skipped over by a `[^\n]*`.
    expect(out(result).split('\n')).toContain('  T-0001 Board fixture  owner=qa cost=$0.00 iter={}');
  });
});

describe('AC-5 — containment is rendered in the glossary\'s vocabulary and nothing else', () => {
  test('C1 — a contained branch is annotated, and nothing at all is written', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    git(root, 'branch', TICKET_BRANCH);
    const ticketBefore = fs.readFileSync(path.join(ticket, 'ticket.md'));
    const refsBefore = git(root, 'for-each-ref');
    const filesBefore = ['backlog', 'harness', '.quorum'].map((dir) => walk(path.join(root, dir)));

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001[^\n]*main:contained/);
    expect(out(result)).not.toMatch(/indeterminate/);
    // Derived, never persisted: byte-identical ticket, no ref moved, no file appearing or vanishing.
    expect(fs.readFileSync(path.join(ticket, 'ticket.md')), 'ticket.md must be byte-identical')
      .toStrictEqual(ticketBefore);
    expect(git(root, 'for-each-ref'), 'no ref may move').toBe(refsBefore);
    expect(['backlog', 'harness', '.quorum'].map((dir) => walk(path.join(root, dir))),
      'no file may appear or vanish').toStrictEqual(filesBefore);
    expect(refsBefore, 'the fixture has no refs, so half this claim is vacuous').toContain(TICKET_BRANCH);
  });

  test('C2 — a diverged branch counts base..branch, not the symmetric difference', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    git(root, 'checkout', '-q', '-b', TICKET_BRANCH);
    for (const message of ['ours 1', 'ours 2']) {
      git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', message);
    }
    git(root, 'checkout', '-q', 'main');
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'theirs 1');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'the ahead count must be base..branch').toMatch(/main:not-contained\(\+2\)/);
    expect(out(result), 'a symmetric-difference count would read +3').not.toMatch(/\(\+3\)/);
  });

  test('C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    // Its frontmatter names a ref nothing created, and the stage is `draft`, so the board says
    // nothing rather than guessing.
    const first = await board(root);
    expect(first.exitCode, out(first)).toBe(SUCCESS);
    expect(out(first)).not.toMatch(/main:/);
    expect(out(first), 'an unresolvable branch is unannotated, not indeterminate')
      .not.toMatch(/indeterminate/);

    rewriteTicket(ticket, ticketText(ticket).replace(/^branch: .*\n/m, ''));
    const second = await board(root);
    expect(second.exitCode, out(second)).toBe(SUCCESS);
    expect(out(second)).not.toMatch(/main:|indeterminate/);

    const empty = await projectFixture();
    const third = await board(empty);
    expect(third.exitCode, out(third)).toBe(SUCCESS);
    expect(out(third)).not.toMatch(/fatal:|indeterminate/);
  });

  test('C4 — a base ref that does not resolve is indeterminate (missing ref), never a claim', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    git(root, 'branch', TICKET_BRANCH);
    const config = path.join(root, 'harness', 'harness.yaml');
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('base_branch: main', 'base_branch: trunk'), 'utf8');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001[^\n]*trunk:indeterminate\(missing ref\)/);
    expect(out(result), 'a missing ref is never a containment claim')
      .not.toMatch(/trunk:contained|trunk:not-contained/);
    expect(out(result), 'raw git stderr never reaches the user').not.toMatch(/fatal:/);
    // The base is read from the file and never substituted: `main` still exists as a branch here.
    expect(git(root, 'for-each-ref', '--format=%(refname)')).toContain('refs/heads/main');
  });

  test('C5 — a shallow clone is indeterminate (shallow clone), with no ahead count', async () => {
    const origin = await projectFixture();
    await makeTicket(origin);
    git(origin, 'add', '-A');
    git(origin, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'ticket files');
    git(origin, 'branch', TICKET_BRANCH);
    git(origin, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'later work');
    // In the full history the branch IS contained — the shallow clone must not claim otherwise.
    git(origin, 'merge-base', '--is-ancestor', `refs/heads/${TICKET_BRANCH}`, 'refs/heads/main');

    const parent = tmp('quorum-cli-board-clone-');
    const clone = path.join(parent, 'clone');
    // `--depth` is silently ignored for a plain local path; the `file://` scheme makes it real, and
    // a fixture that silently was not shallow would assert the right token over a repository that
    // could have answered — passing for the wrong reason.
    git(parent, 'clone', '-q', '--depth', '1', '--no-single-branch', `file://${origin}`, clone);
    expect(git(clone, 'rev-parse', '--is-shallow-repository'), 'the fixture is not genuinely shallow')
      .toBe('true');
    git(clone, 'branch', TICKET_BRANCH, `origin/${TICKET_BRANCH}`);

    const result = await board(clone);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001[^\n]*main:indeterminate\(shallow clone\)/);
    expect(out(result), 'no ahead count may accompany a shallow indeterminate').not.toMatch(/\(\+\d+\)/);
    expect(out(result), 'absent history cannot disprove ancestry').not.toMatch(/not-contained/);
    expect(out(result)).toMatch(/git could not answer/);
  });

  test('C6 — a project that is not a git repository renders every row and exits 0', async () => {
    const root = await projectFixture({ gitRepo: false });
    await makeTicket(root);
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001/);
    expect(out(result)).not.toMatch(/main:|indeterminate|fatal:|not a git repository/i);
  });

  test('C7 — a master-based project prints master and the string main appears nowhere', async () => {
    const root = await projectFixture({ branch: 'master' });
    await makeTicket(root);
    git(root, 'branch', TICKET_BRANCH);
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'the configured base is printed literally').toMatch(/T-0001[^\n]*master:contained/);
    expect(out(result), 'the base must be read from a file, never assumed').not.toMatch(/\bmain\b/);
  });

  test('C8 — an injection-shaped branch value never reaches a git command line', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    rewriteTicket(ticket, ticketText(ticket).replace(/^branch: .*$/m, 'branch: "--upload-pack=touch pwned"'));
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'a hostile name renders unannotated or indeterminate')
      .not.toMatch(/main:contained|main:not-contained/);
    expect(fs.existsSync(path.join(root, 'pwned')), 'no file named pwned may be created').toBe(false);
    // And here too, which is a different directory from the fixture's: nothing chdirs, so this is
    // the package root under Vitest rather than the spike's own working directory.
    expect(fs.existsSync(path.join(process.cwd(), 'pwned')), 'nor here').toBe(false);
  });

  test('C9 — a tag sharing the branch name does not stop the branch being annotated', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    git(root, 'branch', TICKET_BRANCH);
    // With `refs/tags/<name>` beside `refs/heads/<name>`, `%(refname:short)` would emit the
    // disambiguated `heads/<name>` and the branch lookup would miss a ref that resolves.
    git(root, 'tag', TICKET_BRANCH);
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'the branch resolves and must be annotated despite the tag')
      .toMatch(/T-0001[^\n]*main:contained/);
    expect(out(result)).not.toMatch(/indeterminate/);
  });

  test('C10 — `no branch` is reported once the stage claims the work is done, and not before', async () => {
    const root = await projectFixture();
    const ticket = await makeTicket(root);

    // Every ticket names a branch from creation and most never have one, so the quiet stages are the
    // common case and must stay silent. C3 pins the draft half; these are the other three.
    for (const quiet of ['draft', 'requirements', 'blocked', 'abandoned']) {
      setStage(ticket, quiet);
      const result = await board(root);
      expect(result.exitCode, out(result)).toBe(SUCCESS);
      expect(out(result), `${quiet} expects no branch, so it must not be annotated`)
        .not.toMatch(/no branch/);
      expect(out(result), `${quiet} armed the legend for a token nobody saw`)
        .not.toMatch(/does not exist \(no branch\)/);
    }

    for (const claimed of ['solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed']) {
      setStage(ticket, claimed);
      const result = await board(root);
      expect(result.exitCode, out(result)).toBe(SUCCESS);
      expect(out(result), `${claimed} claims the work is done, so a missing branch is worth saying`)
        .toMatch(/main:indeterminate\(no branch\)/);
      expect(out(result)).not.toMatch(/main:contained|not-contained/);
      expect(out(result), 'the legend must name the reason the board rendered')
        .toMatch(/does not exist \(no branch\)/);
    }

    // A ticket with no `branch` key at all asks nothing and renders nothing, at any stage.
    rewriteTicket(ticket, ticketText(ticket).replace(/^branch: .*\n/m, ''));
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).not.toMatch(/main:|indeterminate/);
  });
});

describe('AC-6 — the two legends, each printed only when a row earned it', () => {
  test('C4 — one indeterminate legend line, however many rows were indeterminate', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    const second = await invoke(['ticket', 'new', 'Second', '--owner', 'qa', '--project', root]);
    expect(second.exitCode, plain(second.stderr)).toBe(SUCCESS);
    for (const id of ['T-0001', 'T-0002']) {
      const folder = fs.readdirSync(path.join(root, 'backlog')).find((name) => name.startsWith(id)) ?? '';
      git(root, 'branch', `harness/${id}/integration`);
      setStage(path.join(root, 'backlog', folder), 'reviewed');
    }
    const config = path.join(root, 'harness', 'harness.yaml');
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('base_branch: main', 'base_branch: trunk'), 'utf8');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result).match(/trunk:indeterminate\(missing ref\)/g), 'two rows must be indeterminate')
      .toHaveLength(2);
    expect(out(result).split('git could not answer').length - 1,
      'exactly one legend line explains indeterminate').toBe(1);
  });

  test('the cost legend prints when a ticket has history, and not when none has', async () => {
    // Both directions, because a legend that always printed would satisfy the positive half alone.
    const root = await projectFixture();
    const ticket = await makeTicket(root);
    const quiet = await board(root);
    expect(quiet.exitCode, out(quiet)).toBe(SUCCESS);
    expect(out(quiet), 'a board with no run behind it explained a cost column')
      .not.toMatch(/cost = billed cost/);

    rewriteTicket(ticket, ticketText(ticket).replace(
      'history: []',
      'history:\n  - {run: 1, status: completed, cost: 0.5}',
    ));
    const loud = await board(root);
    expect(loud.exitCode, out(loud)).toBe(SUCCESS);
    expect(out(loud), 'the roll-up can only see vendors that report a price, and must say so')
      .toMatch(/cost = billed cost where the vendor reports one/);
    expect(out(loud), 'and it names the vendors it cannot price').toMatch(/token-only vendors \(codex\)/);
  });

  test('a suppressed `no branch` does not arm the indeterminate legend', async () => {
    // The flag is set from the POST-suppression value, which is what makes AC-6's clause true rather
    // than incidental: a draft ticket naming a branch nobody created is the commonest row there is,
    // and a legend under it would explain a token the reader never saw.
    const root = await projectFixture();
    await makeTicket(root);
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toMatch(/T-0001/);
    expect(out(result), 'the legend explained a token no row rendered')
      .not.toMatch(/git could not answer/);
  });
});

describe('Q-0055 AC-16/AC-17 — a flow the board could not read is named, and nothing else is claimed', () => {
  /** A flow file whose one step carries no id, which is what Q-0055 refuses. */
  const idLessFlow = (name: string, consumes: string, produces: string): string =>
    `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps:\n  - role: r\n`;

  /**
   * A flow that lints clean on its own and is refused for its backward edge to a flow that is not
   * there — the one shape where "did it parse" and "did it lint" disagree, because
   * `lintFlowDirectory` appends the cross-flow problem to a record that kept its parsed flow.
   */
  const danglingFlow = (name: string, consumes: string, produces: string): string =>
    `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps:\n  - id: s\n`
    + '    on_fail:\n      goto: flow:nowhere\n      max_iterations: 1\n      on_exhausted: gate\n';

  test('AC-16 — the good flow keeps its hint and the bad file is named beside it', async () => {
    // The two halves in one board, because either alone would pass over the defect: a board that
    // dropped both would still print the legend, and a board that printed no legend would still
    // show the hint. `broken.yaml` fails lint rather than YAML parsing, so what is being reported
    // is a flow the board read and refused rather than a file it could not open.
    const root = await projectFixture();
    flows(root, {
      alpha: basicFlow('alpha', 'requirements', 'reviewed'),
      broken: idLessFlow('broken', 'draft', 'requirements'),
    });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'the flow that lints must still name its command').toContain('→ quorum run alpha <id>');
    expect(out(result), 'and the one that does not must be named').toContain('could not read = broken.yaml');
    // The file it names is the one that failed and not the one that did not — a legend listing both
    // would be as uninformative as listing neither.
    expect(out(result), 'a clean flow was reported as unreadable').not.toContain('alpha.yaml');
  });

  test('AC-16 — with nothing unreadable the line is absent, so silence still means nothing to say', async () => {
    const root = await projectFixture();
    flows(root, { alpha: basicFlow('alpha', 'requirements', 'reviewed') });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'a legend printed with nothing to report').not.toContain('could not read');
  });

  test('AC-16 — a file that will not parse at all is named the same way, and does not stop the board', async () => {
    // The other route to a record with no flow: a YAML syntax error rather than a lint refusal.
    // Both arrive as the same absence in `lintFlowDirectory`'s records, and the board must not care
    // which — what it can say is that it could not read the file.
    const root = await projectFixture();
    flows(root, {
      alpha: basicFlow('alpha', 'requirements', 'reviewed'),
      torn: 'name: torn\nsteps: [\n',
    });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toContain('could not read = torn.yaml');
    expect(out(result), 'one bad file must not cost the good one its hint').toContain('→ quorum run alpha <id>');
  });

  test('AC-16 — a flow refused for a cross-flow edge loses its hint and is named with the rest', async () => {
    // Run 2 iteration 1's review finding. `dangling` parses, passes every per-flow rule and is then
    // refused by the cross-flow pass, which appends the problem to a record still carrying its
    // flow — so a board classifying on `flow` gave it a hint for a command `quorum run` refuses
    // (`run.ts` lints the whole directory first) and left it out of the legend that exists to
    // explain exactly that.
    const root = await projectFixture();
    flows(root, {
      alpha: basicFlow('alpha', 'requirements', 'reviewed'),
      dangling: danglingFlow('dangling', 'draft', 'requirements'),
    });

    // The premise, asserted rather than assumed: this fixture must fail on the cross-flow edge and
    // not on a per-flow rule, or the test is the id-less one again under another name.
    const linted = await invoke(['lint', '--project', root]);
    expect(out(linted), 'the fixture stopped being a cross-flow failure')
      .toContain('target flow nowhere is missing or unloadable');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'a flow the linter refuses kept its hint').not.toContain('quorum run dangling');
    expect(out(result), 'and it was named nowhere').toContain('could not read = dangling.yaml');
    expect(out(result), 'the clean flow lost its hint to its neighbour').toContain('→ quorum run alpha <id>');
  });

  test('AC-16 — two bad files are one line naming both, in filename order', async () => {
    const root = await projectFixture();
    flows(root, {
      zulu: idLessFlow('zulu', 'draft', 'requirements'),
      apple: idLessFlow('apple', 'solutioned', 'red'),
      good: basicFlow('good', 'requirements', 'reviewed'),
    });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result)).toContain('could not read = apple.yaml, zulu.yaml');
    expect(out(result).split('could not read').length - 1, 'one line, however many files').toBe(1);
  });

  test('AC-17 — the board still exits 0, and claims nothing about the flows it did read', async () => {
    // A refused flow is a fact this board reports, not a failure of the board: `quorum board` is a
    // report and `quorum lint` is the check, which is what *"What an exit code may claim, and the
    // three zeros it was asked about"* (2026-09-08) settles for exactly this shape. And the line
    // may warn and may never reassure — no wording equivalent to "all flows valid" may appear in
    // either shape, which is why the clean board is checked as well as the broken one.
    const root = await projectFixture();
    flows(root, { good: basicFlow('good', 'requirements', 'reviewed'), broken: idLessFlow('broken', 'draft', 'requirements') });
    const withBad = await board(root);
    expect(withBad.exitCode, out(withBad)).toBe(SUCCESS);

    flows(root, { good: basicFlow('good', 'requirements', 'reviewed') });
    const clean = await board(root);
    expect(clean.exitCode, out(clean)).toBe(SUCCESS);

    for (const [what, result] of [['with a refused flow', withBad], ['with none', clean]] as const) {
      for (const reassurance of [/all flows/i, /flows are valid/i, /every flow/i, /\bvalid\b/i, /\bok\b/i, /\bpassed\b/i]) {
        expect(out(result), `${what}: the board reassured about flows it did not check`).not.toMatch(reassurance);
      }
    }
  });
});

describe('Q-0105 — push lag, the one repository-level fact this board reports', () => {
  /**
   * Give `root`'s branch somewhere to push to, and push it there.
   *
   * The remote is not called `origin` and, wherever a test can choose, the branch is not called
   * `main`: a rendered name that came from git survives this fixture and a name the code composed
   * does not. `local` further commits are then made on top of the pushed tip, and `remoteAhead`
   * commits are made on the remote side only, through a clone that is discarded.
   */
  function withUpstream(
    root: string,
    { remote = 'backup', branch = 'main', local = 0, remoteAhead = 0 } = {},
  ): void {
    const bare = tmp('quorum-cli-board-remote-');
    git(bare, 'init', '-q', '--bare', '-b', branch);
    git(root, 'remote', 'add', remote, bare);
    git(root, 'push', '-q', '-u', remote, branch);
    if (remoteAhead > 0) {
      const other = tmp('quorum-cli-board-other-');
      git(other, 'clone', '-q', bare, other);
      for (let i = 0; i < remoteAhead; i += 1) {
        git(other, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', `theirs ${String(i)}`);
      }
      git(other, 'push', '-q', 'origin', branch);
      git(root, 'fetch', '-q', remote);
    }
    for (let i = 0; i < local; i += 1) {
      git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', `ours ${String(i)}`);
    }
    // The fixture asserts its own topology: every claim below tells one count from another, and a
    // divergence that silently did not happen would make them agree and prove nothing.
    const upstream = `refs/remotes/${remote}/${branch}`;
    expect(git(root, 'rev-list', '--count', `refs/heads/${branch}..${upstream}`),
      'the fixture is not behind by what it was asked for').toBe(String(remoteAhead));
    expect(git(root, 'rev-list', '--count', `${upstream}..refs/heads/${branch}`),
      'the fixture is not ahead by what it was asked for').toBe(String(local));
  }

  /**
   * A configured remote that `root`'s branch does not track — the `no upstream` state.
   *
   * The directory it points at is deliberately never initialised: the state under test is a
   * property of this repository's own configuration, and reaching the far end would be a network
   * call in everything but distance.
   */
  const remoteWithNoTracking = (root: string, remote = 'backup'): void => {
    git(root, 'remote', 'add', remote, tmp('quorum-cli-board-remote-'));
  };

  /** The push-lag legend line, or `null` where the board printed none. */
  const lagLine = (result: Invocation): string | null =>
    out(result).split('\n').find((line) => line.includes('push lag')) ?? null;

  /**
   * The push-lag legend, asserted to have rendered at all before anything is claimed about it.
   *
   * Without this a `toMatch` over an absent line reports *"expects to receive a string, but got
   * object"* — a failure that names the assertion's plumbing instead of the defect, which is what a
   * reader meeting a red suite has to work backwards from. Measured while demonstrating the
   * threshold mutation: applying a floor made three tests fail and none of them said so.
   */
  const requireLagLine = (result: Invocation, why: string): string => {
    const line = lagLine(result);
    expect(line, why).not.toBeNull();
    return line ?? '';
  };

  test('AC-10 — a project with no remote gains not one word, and neither does a pushed one', async () => {
    // The cold-clone claim, and it is asserted over BOTH silent states in the same test, because
    // they are silent for different reasons and a fix that suppressed only one would still add a
    // line to the path M6 turns on.
    const quiet = await projectFixture();
    await makeTicket(quiet);
    const before = await board(quiet);
    expect(before.exitCode, out(before)).toBe(SUCCESS);
    expect(lagLine(before), 'a repository with no remote was told about push lag').toBeNull();

    withUpstream(quiet);
    const after = await board(quiet);
    expect(after.exitCode, out(after)).toBe(SUCCESS);
    expect(lagLine(after), 'a base level with its upstream was told about push lag').toBeNull();
    // Byte-identical, which is the claim AC-10 actually makes: acquiring a remote and pushing to it
    // changes nothing a reader sees.
    expect(out(after), 'the two silent states do not render identically').toBe(out(before));
  });

  test('AC-7 — one unpushed commit prints, so the threshold is 1 and there is no floor', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 1 });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const line = requireLagLine(result, 'a lag of one printed nothing, so a floor was applied');
    expect(line).toMatch(/1 commit that backup\/main does not/);
    // Singular, because a line that says "1 commits" is a line nobody trusts the rest of.
    expect(line).not.toMatch(/1 commits/);
  });

  test('AC-6 — the count is upstream..base, and a symmetric difference would read one more', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 2, remoteAhead: 1 });
    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(requireLagLine(result, 'the diverged fixture printed no legend'))
      .toMatch(/holds 2 commits that backup\/main does not/);
    expect(out(result), 'a symmetric-difference count would read 3').not.toMatch(/holds 3 commits/);
  });

  test('AC-9 — the sentence claims what it can prove and no word of it is about testing', async () => {
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 2 });
    const result = await board(root);
    const line = requireLagLine(result, 'the legend this criterion is about did not render');

    // The positive half: base, upstream and count are all named, and the freshness limit is stated
    // in words. A line naming nothing would satisfy a forbidden-substring list on its own.
    expect(line, 'the base branch is not named').toContain('main');
    expect(line, 'the upstream is not named').toContain('backup/main');
    expect(line, 'the count is not named').toContain('2 commits');
    expect(line, 'the answer is presented as live rather than as of the last fetch')
      .toContain('as of the last fetch');
    expect(line, 'the line does not say what it is about').toMatch(/have not been pushed/);

    // The forbidden half. This is the criterion the ticket exists for: the failure being fixed is
    // four documents claiming a path worked, and a board line implying validation is that same
    // failure wearing a fix's clothes.
    const forbidden = [/\bci\b/i, /validated/i, /verified/i, /tested/i, /green/i, /build/i,
      /github/i, /actions/i, /pipeline/i];
    for (const pattern of forbidden) {
      expect(pattern.test(out(result)),
        `the board's output can be read as a claim about testing: ${pattern.source}`).toBe(false);
    }
    // And that list has a subject: it recognises the claim it exists to forbid where one is written.
    expect(forbidden.some((pattern) => pattern.test('main was validated by CI')),
      'the forbidden-substring list does not recognise the sentence it forbids').toBe(true);
  });

  test('AC-8 — the legend borrows none of containment\'s vocabulary', async () => {
    // Structurally required, not merely tidy: `indeterminate` is containment's closed vocabulary and
    // a second fact borrowing it makes both legends ambiguous. Mechanically it is what keeps six
    // landed assertions in this file green without one of them being edited.
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 2 });
    const withCount = requireLagLine(await board(root), 'the unpushed legend did not render');

    const noUpstream = await projectFixture();
    remoteWithNoTracking(noUpstream);
    const cannotSay = requireLagLine(await board(noUpstream), 'the cannot-say legend did not render');

    for (const [name, line] of [['unpushed', withCount], ['cannot say', cannotSay]] as const) {
      expect(line.length, `the ${name} legend did not render, so this proves nothing`)
        .toBeGreaterThan(0);
      expect(line, `the ${name} legend spells a containment token`).not.toMatch(/main:/);
      expect(line, `the ${name} legend spells containment's word`).not.toMatch(/indeterminate/);
      expect(line, `the ${name} legend reuses the phrase C4 counts`).not.toMatch(/git could not answer/);
    }
  });

  test('AC-3 and AC-5 — a base tracking nothing says so, in the repository\'s own names', async () => {
    // `trunk` tracking `somewhere-else`, so a result carrying `origin` or `main` would have had to
    // invent it. `init` aims `repo.base_branch` at the branch the checkout is on, so naming the
    // branch at `git init` is all this needs.
    const untrackedRoot = await projectFixture({ branch: 'trunk' });
    await makeTicket(untrackedRoot);
    remoteWithNoTracking(untrackedRoot, 'somewhere-else');
    const untracked = await board(untrackedRoot);
    expect(untracked.exitCode, out(untracked)).toBe(SUCCESS);
    expect(requireLagLine(untracked, 'a base branch nothing is watching is the state worth saying'))
      .toMatch(/cannot say whether trunk has been pushed \(no upstream\)/);

    const root = await projectFixture({ branch: 'trunk' });
    await makeTicket(root);
    withUpstream(root, { remote: 'somewhere-else', branch: 'trunk', local: 3 });
    const tracked = await board(root);
    expect(tracked.exitCode, out(tracked)).toBe(SUCCESS);
    expect(requireLagLine(tracked, 'the tracked fixture printed no legend'))
      .toMatch(/trunk holds 3 commits that somewhere-else\/trunk does not/);
    expect(out(tracked), 'a remote name was composed rather than read out of git').not.toMatch(/origin/i);
    expect(out(tracked), 'a base branch name was composed rather than read out of config')
      .not.toMatch(/\bmain\b/i);
  });

  /**
   * A repository healthy enough to be probed and unable to answer the one question asked of it: an
   * intermediate commit's object is removed, so both endpoints of the range still resolve and only
   * the walk between them fails.
   *
   * A real state — an interrupted `gc`, a truncated copy — reached without a shim, because the
   * claim under test is what the BOARD does with a failed probe and a shimmed `git` would be
   * proving it about a process this test invented. Returns the sha it broke, so a caller can say so.
   */
  function breakHistoryBetween(root: string, branch = 'main'): string {
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'middle');
    const middle = git(root, 'rev-parse', 'HEAD');
    git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'tip');
    const loose = path.join(root, '.git', 'objects', middle.slice(0, 2), middle.slice(2));
    expect(fs.existsSync(loose), 'the object is packed, so removing the loose copy proves nothing')
      .toBe(true);
    fs.rmSync(loose);
    // Both endpoints still resolve, which is what makes this a failed WALK rather than a missing
    // ref: without this the test would be asserting the neighbouring state's behaviour.
    for (const ref of [`refs/heads/${branch}`, `refs/remotes/backup/${branch}`]) {
      expect(() => git(root, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`),
        `${ref} does not resolve, so this fixture is a missing ref rather than a failed count`)
        .not.toThrow();
    }
    return middle;
  }

  test('AC-3 and AC-11 — a git failure inside a work tree says so, and the board still exits 0', async () => {
    // Round 1's first review finding, at the surface a reader meets. A probe that could not answer
    // must reach the cannot-say line: for a fact whose success output is SILENCE, a failure rendered
    // as nothing is indistinguishable from a clean bill of health — which is the whole shape of the
    // incident this ticket was opened for.
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root);
    breakHistoryBetween(root);

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(requireLagLine(result, 'a git command failed and the board said nothing at all'))
      .toMatch(/cannot say whether main has been pushed \(git failed\)/);
    // The rest of the board is unharmed: the failure is one legend, not a broken command.
    expect(out(result), 'the ticket rows did not render').toMatch(/T-0001/);
  });

  test('AC-3 and AC-11 — a repository git refuses to OPEN says so, and absence still says nothing', async () => {
    // Round 2's review finding, at the surface a reader meets. git exits 128 both to say there is no
    // repository and to say there is one it will not open — an unreadable format here, dubious
    // ownership in the field — so reading that code as absence rendered a refused repository exactly
    // as it renders a directory git has nothing to say about. One of those two is a failed probe
    // INSIDE the subject, and the pair below is what keeps them apart at the board.
    const refused = await projectFixture();
    await makeTicket(refused);
    withUpstream(refused, { local: 2 });
    git(refused, 'config', 'core.repositoryformatversion', '99');

    const result = await board(refused);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(requireLagLine(result, 'a repository git refused to open printed nothing at all'))
      .toMatch(/cannot say whether main has been pushed \(git failed\)/);
    expect(out(result), 'the ticket rows did not render').toMatch(/T-0001/);

    // The neighbour, in the same test so the pair cannot drift apart: a directory that is not a
    // repository is still silent, which is the half AC-10 and C6 rest on.
    const absent = tmp('quorum-cli-board-plain-');
    expect((await invoke(['init', absent])).exitCode).toBe(SUCCESS);
    expect(lagLine(await board(absent)), 'absence stopped being silent, which AC-10 forbids')
      .toBeNull();
  });

  test('AC-3 — a tracking ref that is gone is a missing ref, and never a failed git', async () => {
    // Round 1's second review finding. `%(upstream)` is computed from configuration, so deleting the
    // remote-tracking ref leaves the upstream NAMED and unresolvable — `git branch -vv` calls it
    // `[gone]`. Counting over it fatals, and reporting that as `git failed` blames the instrument
    // for a fact about the subject.
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 2 });
    git(root, 'update-ref', '-d', 'refs/remotes/backup/main');
    expect(git(root, 'for-each-ref', '--format=%(upstream)', 'refs/heads/main'),
      'the configuration went with the ref, so this fixture is `no upstream` and proves nothing')
      .toBe('refs/remotes/backup/main');

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const line = requireLagLine(result, 'an unresolvable upstream printed nothing');
    expect(line).toMatch(/cannot say whether main has been pushed \(missing ref\)/);
    expect(line, 'the absent ref was reported as a broken git').not.toMatch(/git failed/);
  });

  test('AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched', async () => {
    // The FETCH_HEAD clause is what proves no network call was made, and it is stronger and cheaper
    // than auditing the source for a verb. The fixture fetches first so the file exists — over an
    // absent one the assertion would hold vacuously.
    const root = await projectFixture();
    await makeTicket(root);
    withUpstream(root, { local: 2, remoteAhead: 1 });
    const fetchHead = path.join(root, '.git', 'FETCH_HEAD');
    expect(fs.existsSync(fetchHead), 'the fixture never fetched, so this claim would be vacuous')
      .toBe(true);

    const bytesBefore = fs.readFileSync(fetchHead);
    const mtimeBefore = fs.statSync(fetchHead).mtimeMs;
    const refsBefore = git(root, 'for-each-ref');
    const filesBefore = ['backlog', 'harness', '.quorum'].map((dir) => walk(path.join(root, dir)));

    const result = await board(root);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(lagLine(result), 'the path under test did not run').not.toBeNull();
    expect(fs.readFileSync(fetchHead), 'FETCH_HEAD moved, so something fetched')
      .toStrictEqual(bytesBefore);
    expect(fs.statSync(fetchHead).mtimeMs, 'FETCH_HEAD was rewritten with the same bytes')
      .toBe(mtimeBefore);
    expect(git(root, 'for-each-ref'), 'no ref may move').toBe(refsBefore);
    expect(['backlog', 'harness', '.quorum'].map((dir) => walk(path.join(root, dir))),
      'no file may appear or vanish').toStrictEqual(filesBefore);
  });

  test('AC-11 — every outcome still exits 0, including the ones git could not answer', async () => {
    // `board` is one of the two commands that can only exit 0, and an instrument that starts failing
    // the command it annotates has replaced a silent gap with a loud one.
    const noRemote = await projectFixture();
    const unpushed = await projectFixture();
    withUpstream(unpushed, { local: 1 });
    const missingRef = await projectFixture();
    withUpstream(missingRef);
    const config = path.join(missingRef, 'harness', 'harness.yaml');
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace('base_branch: main', 'base_branch: gone'), 'utf8');
    const notARepo = tmp('quorum-cli-board-plain-');
    const created = await invoke(['init', notARepo]);
    expect(created.exitCode, plain(created.stderr)).toBe(SUCCESS);

    for (const [name, root] of [['no remote', noRemote], ['unpushed', unpushed],
      ['missing ref', missingRef], ['not a git repository', notARepo]] as const) {
      const result = await board(root);
      expect(result.exitCode, `${name}: ${out(result)}`).toBe(SUCCESS);
    }
    // And the two that must say something did, so the loop is not four silent passes.
    expect(requireLagLine(await board(unpushed), 'the unpushed fixture said nothing'))
      .toMatch(/1 commit/);
    expect(requireLagLine(await board(missingRef), 'the missing-ref fixture said nothing'))
      .toMatch(/\(missing ref\)/);
    expect(lagLine(await board(notARepo)), 'a directory that is not a work tree has no fact to report')
      .toBeNull();
  });
});
