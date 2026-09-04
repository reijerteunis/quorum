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
 * `--owner qa` is supplied rather than defaulted, because `Backlog.create` defaults `owner` to
 * `process.env.USER` — the preserved defect ground rule 3 forbids closing here — and a row
 * asserting `owner=` off that default would have a verdict that is a property of the account.
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

/** A flow with no steps, as `lint.test.ts`'s `basicFlow` builds one. */
const basicFlow = (name: string, consumes: string, produces: string): string =>
  `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps: []\n`;

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
    expect(out(result)).toContain('→ harness run alpha <id>');
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
    ).toContain('requirements  → harness run chore <id>');
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
    // stage name can occupy, and enough to tell `padEnd(14)` from any fixed separator.
    expect(lines, 'the shortest stage name').toContain(`draft${' '.repeat(9)}→ harness run requirements <id>`);
    expect(lines, 'the longest stage name').toContain(`requirements${' '.repeat(2)}→ harness run chore <id>`);
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
