// Q-0062 — a run gives back the worktrees it obtained, and only those, and never a ref.
//
// Every case builds its own repository under `os.tmpdir()` and asks git itself what happened, so no
// verdict here depends on this checkout's branches, its ignored directories, its git identity or
// the machine's git configuration ("A test's verdict is a property of the commit, not of the
// checkout or the account", docs/DECISIONS.md 2026-08-30).
//
// The fixture's ticket is `runFixture`'s own, which is why the branches below read `Q-0052`: it is
// the shared composed-run fixture and its ids are its, not this ticket's.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { worktreeDirName } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { git, removeTempDirs, write } from '../../test/repo.js';
import { DEFAULT_CONFIG, TICKET_ID, runFixture, stubAdapter } from '../../test/run-fixture.js';
import type { RunFixture } from '../../test/run-fixture.js';
import * as gitModule from '../git/git.js';
import { nextRunId } from '../run-history/writer.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

const IMPLEMENT = `harness/${TICKET_ID}/implement`;
const INTEGRATION = `harness/${TICKET_ID}/integration`;

/** Where a branch's worktree lands, derived through `shared` rather than re-spelled. */
const worktreeOf = (repoDir: string, branch: string): string =>
  path.join(repoDir, '.harness', 'worktrees', worktreeDirName(branch));

const infos = (events: Event[]): string[] => events.filter((e) => e.type === 'info').map((e) => e.message);
const warns = (events: Event[]): string[] => events.filter((e) => e.type === 'warn').map((e) => e.message);

/**
 * Every line of the ticket's `runs.log` with its ISO timestamp taken off, which is where a run says
 * what it removed. The timestamp is `Backlog.log`'s and belongs to no assertion here.
 */
const runsLog = (fixture: RunFixture): string[] =>
  fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8')
    .split('\n').filter(Boolean).map((line) => line.replace(/^\S+ /, ''));

/** What `git worktree list` currently registers, as one string. */
const registered = (repoDir: string): string => git(repoDir, 'worktree', 'list');

/** What a billed call reports; the step dereferences `usage` unguarded (Q-0052's preserved defect). */
const BILLED = {
  vendor: 'stub', cost_usd: 0.5, input_tokens: 1, output_tokens: 2,
  cached_input_tokens: null, cache_write_input_tokens: null,
};

/** An adapter that writes one file into the step's own worktree, so the branch has work on it. */
const writing = (): ReturnType<typeof stubAdapter> => stubAdapter((options) => {
  write(path.join(options.cwd, 'src', 'work.ts'), 'export const done = true;\n');
  const output = { summary: 'wrote the work' };
  return { output, raw: JSON.stringify(output), usage: BILLED };
});

/** The two steps a code-writing flow is made of: one worktree step, then an integrate. */
const codingFlow = (fixture: RunFixture, integrate: Record<string, unknown> = {}): void => {
  fixture.steps([
    { id: 'implement', worktree: true, branch: IMPLEMENT },
    { id: 'merge', type: 'integrate', branches: [IMPLEMENT], into: INTEGRATION, ...integrate },
  ]);
};

describe('AC-1 — a run that finished gives back the worktrees it obtained, and says so', () => {
  test('both directories and both registrations are gone, with one info each and one runs.log line', async () => {
    const fixture = runFixture();
    codingFlow(fixture);
    writing();

    const { events, error } = await fixture.settle();
    expect(error).toBeUndefined();

    for (const branch of [IMPLEMENT, INTEGRATION]) {
      expect(fs.existsSync(worktreeOf(fixture.repoDir, branch)), `${branch}: directory`).toBe(false);
      expect(registered(fixture.repoDir), `${branch}: registration`).not.toContain(worktreeDirName(branch));
    }
    expect(infos(events)).toContain(`${IMPLEMENT}: worktree removed — ${worktreeOf(fixture.repoDir, IMPLEMENT)}`);
    expect(infos(events)).toContain(`${INTEGRATION}: worktree removed — ${worktreeOf(fixture.repoDir, INTEGRATION)}`);
    expect(runsLog(fixture)).toContain('run=1 removed-worktrees=2 kept=0');
    // Before the terminal event, which is emitted exactly once and stays last.
    expect(events.filter((e) => e.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    expect(events.findIndex((e) => e.type === 'info' && e.message.includes('worktree removed')))
      .toBeLessThan(events.length - 1);
  });

  test('the cleanup line carries THIS run\'s number, and a line carrying another moves the next id', async () => {
    // The discriminating half. Asserting only that the next id is still 2 passes whether or not
    // `nextRunId` reads the cleanup line at all — and it does read it, on every line of the file
    // (requirements/errata.md E-1). What makes the number a constraint rather than a free choice is
    // that a DIFFERENT one moves the id, which is shown here rather than reasoned about.
    const fixture = runFixture();
    codingFlow(fixture);
    writing();
    await fixture.settle();

    const ticket = fixture.opts.ticket;
    expect(runsLog(fixture).filter((line) => line.startsWith('run=1 removed-worktrees='))).toHaveLength(1);
    expect(nextRunId(ticket)).toBe(2);

    fs.appendFileSync(path.join(fixture.ticketDir, 'runs.log'), 'run=9 removed-worktrees=0 kept=0\n');
    expect(nextRunId(ticket), 'every run= in the log is read, so the cleanup line\'s number matters').toBe(10);
  });
});

describe('AC-2 — a run that did not finish leaves everything where it is', () => {
  test.each([
    ['aborted', { id: 'stop', type: 'script', run: 'exit 7' }],
    ['failed', { id: 'stop', type: 'script', run: 'exit 7', on_fail: { goto: 'nowhere', max_iterations: 1 } }],
  ])('%s: the worktree, its registration and its branch all survive', async (_status, stopper) => {
    const fixture = runFixture();
    fixture.steps([{ id: 'implement', worktree: true, branch: IMPLEMENT }, stopper]);
    writing();

    const { events } = await fixture.settle();

    expect(fs.existsSync(worktreeOf(fixture.repoDir, IMPLEMENT))).toBe(true);
    expect(registered(fixture.repoDir)).toContain(worktreeDirName(IMPLEMENT));
    expect(git(fixture.repoDir, 'show', `${IMPLEMENT}:src/work.ts`)).toContain('export const done');
    expect(infos(events).filter((message) => message.includes('worktree removed'))).toStrictEqual([]);
    expect(runsLog(fixture).filter((line) => line.includes('removed-worktrees='))).toStrictEqual([]);
  });
});

describe('AC-3 — only what this run obtained, and a reused worktree counts', () => {
  test('a worktree for an unrelated branch survives a completed run, and a reused one does not', async () => {
    const fixture = runFixture();
    // A bystander nobody in this run touches, and the step's own worktree cut before the run — the
    // two halves of "registration, never enumeration".
    git(fixture.repoDir, 'branch', 'someone/elses-work', 'main');
    const bystander = worktreeOf(fixture.repoDir, 'someone/elses-work');
    git(fixture.repoDir, 'worktree', 'add', '-q', bystander, 'someone/elses-work');
    git(fixture.repoDir, 'branch', IMPLEMENT, 'main');
    const reused = worktreeOf(fixture.repoDir, IMPLEMENT);
    git(fixture.repoDir, 'worktree', 'add', '-q', reused, IMPLEMENT);

    codingFlow(fixture);
    writing();
    const { error } = await fixture.settle();
    expect(error).toBeUndefined();

    expect(fs.existsSync(reused), 'a run that reused a worktree is the run that finished with it').toBe(false);
    expect(fs.existsSync(bystander), 'a worktree this run never touched is nobody\'s to remove').toBe(true);
    expect(registered(fixture.repoDir)).toContain(worktreeDirName('someone/elses-work'));
    expect(git(fixture.repoDir, 'rev-parse', '--verify', 'someone/elses-work')).toHaveLength(40);
  });

  test('the ticket worktree is obtained three ways and removed once', async () => {
    // `syncBaseIntoTicketBranch`, the inter-wave merge and `integrate` all ask for the same
    // directory. Keyed by branch, so one entry and one removal — a list would have tried twice and
    // warned on the second.
    const fixture = runFixture();
    codingFlow(fixture);
    writing();
    const { events } = await fixture.settle();

    expect(infos(events).filter((message) => message.startsWith(`${INTEGRATION}: worktree removed`)))
      .toHaveLength(1);
    expect(runsLog(fixture)).toContain('run=1 removed-worktrees=2 kept=0');
  });
});

describe('AC-4 — no ref is ever deleted', () => {
  test('every removed worktree\'s branch still resolves, at the commit it was removed at', async () => {
    const fixture = runFixture();
    codingFlow(fixture);
    writing();
    await fixture.settle();

    const branches = git(fixture.repoDir, 'branch', '--list', 'harness/*');
    for (const branch of [IMPLEMENT, INTEGRATION]) {
      expect(branches, `${branch} must outlive its worktree`).toContain(branch);
      expect(git(fixture.repoDir, 'rev-parse', '--verify', branch)).toHaveLength(40);
    }
    // The work is on both of them: the step's own commit, and the merge integrate made of it.
    expect(git(fixture.repoDir, 'show', `${IMPLEMENT}:src/work.ts`)).toContain('export const done');
    expect(git(fixture.repoDir, 'show', `${INTEGRATION}:src/work.ts`)).toContain('export const done');
  });
});

describe('AC-5 — a worktree that is not clean is kept, and the run names what kept it', () => {
  test('an untracked file left by the install command keeps the integration worktree', async () => {
    // The real shape, not a contrived one: `commands.install` runs inside the integration worktree,
    // and anything it writes there that git can see is uncommitted content the removal would force
    // away. The implement worktree is clean in the same run, so one run shows both answers.
    const fixture = runFixture({
      config: `${DEFAULT_CONFIG}commands:\n  install: printf dirt > left-behind.txt\n  test: printf ok\n`,
    });
    codingFlow(fixture, { run_tests: true });
    writing();

    const { events, error } = await fixture.settle();
    expect(error).toBeUndefined();

    const kept = worktreeOf(fixture.repoDir, INTEGRATION);
    expect(fs.existsSync(path.join(kept, 'left-behind.txt')), 'the fixture must actually dirty it').toBe(true);
    expect(fs.existsSync(kept)).toBe(true);
    expect(registered(fixture.repoDir)).toContain(worktreeDirName(INTEGRATION));
    expect(warns(events)).toContain(`${INTEGRATION}: worktree kept — ${kept} holds uncommitted content: left-behind.txt`);
    expect(git(fixture.repoDir, 'rev-parse', '--verify', INTEGRATION)).toHaveLength(40);
    // And the clean one in the same run is gone, so this is a decision about the worktree rather
    // than a run that stopped removing.
    expect(fs.existsSync(worktreeOf(fixture.repoDir, IMPLEMENT))).toBe(false);
    expect(runsLog(fixture)).toContain('run=1 removed-worktrees=1 kept=1');
  });
});

describe('AC-6 — a removal that fails does not change the run\'s outcome', () => {
  test('the second worktree is still removed, and the terminal record is the control run\'s', async () => {
    const control = runFixture();
    codingFlow(control);
    writing();
    const { events: clean } = await control.settle();
    vi.restoreAllMocks();

    const fixture = runFixture();
    codingFlow(fixture);
    writing();
    const real = gitModule.removeWorktree;
    let calls = 0;
    vi.spyOn(gitModule, 'removeWorktree').mockImplementation((repoDir, branch, options) => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('spawn failed'), { stderr: 'fatal: this one refuses\nand says so\n' });
      real(repoDir, branch, options);
    });

    const { events, error } = await fixture.settle();
    expect(error, 'a failed removal is not a failed run').toBeUndefined();

    expect(calls, 'cleanup continues past a failure').toBe(2);
    // git's own first line of stderr, and only the first: the branch, the directory and one reason.
    expect(warns(events)).toStrictEqual([
      `${IMPLEMENT}: worktree kept — could not remove ${worktreeOf(fixture.repoDir, IMPLEMENT)}: fatal: this one refuses`,
    ]);
    expect(fs.existsSync(worktreeOf(fixture.repoDir, IMPLEMENT))).toBe(true);
    expect(fs.existsSync(worktreeOf(fixture.repoDir, INTEGRATION))).toBe(false);
    expect(runsLog(fixture)).toContain('run=1 removed-worktrees=1 kept=1');

    // The record itself, against the run that had no failure: one terminal event, the same one.
    expect(events.filter((e) => e.type === 'terminal')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'terminal')).toStrictEqual(clean.filter((e) => e.type === 'terminal'));
    const entry = (f: RunFixture): unknown => {
      const history = f.opts.ticket.meta.history ?? [];
      const { at: _at, ...rest } = history.at(-1) as Record<string, unknown>;
      return rest;
    };
    expect(entry(fixture)).toStrictEqual(entry(control));
    expect(fixture.opts.ticket.meta.stage).toBe(control.opts.ticket.meta.stage);
    const terminalLine = (f: RunFixture): string | undefined =>
      runsLog(f).find((line) => line.startsWith('run=1 completed'));
    expect(terminalLine(fixture)).toBe(terminalLine(control));
  });
});

describe('AC-7 — a dry run obtains nothing, so it removes nothing', () => {
  test('a worktree made by hand survives a dry run to completed, with its branch where it was', async () => {
    const fixture = runFixture({ run: { dry: true } });
    git(fixture.repoDir, 'branch', IMPLEMENT, 'main');
    const byHand = worktreeOf(fixture.repoDir, IMPLEMENT);
    git(fixture.repoDir, 'worktree', 'add', '-q', byHand, IMPLEMENT);
    const before = git(fixture.repoDir, 'rev-parse', IMPLEMENT);
    codingFlow(fixture);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    const { events, error } = await fixture.settle();
    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });

    expect(fs.existsSync(byHand)).toBe(true);
    expect(registered(fixture.repoDir)).toContain(worktreeDirName(IMPLEMENT));
    expect(git(fixture.repoDir, 'rev-parse', IMPLEMENT)).toBe(before);
    expect(infos(events).filter((message) => message.includes('worktree removed'))).toStrictEqual([]);
  });
});
