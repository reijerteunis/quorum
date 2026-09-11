// Q-0048: the fan-out's plumbing, asserted against real git and real files.
//
// The independent witness here is git itself, not the spike's suite — both suites can be green over
// a wrong port (harness/port-charter.md §2), because a test ported alongside a mis-ported module
// agrees with it. So every case below builds the repository and the topology it asserts, and no
// case asserts the branch or containment state of THIS repository.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { REPO_WORKTREE_ROOT } from '@quorum/shared';

import { runCommand } from './command.js';
import {
  IntegrationError, branchHead, branchProbe, commitAll, loadTasks, mergeInto, resetBranchTo,
  scopeToFailing, taskPromptSection, taskVars, ticketWorktree, waves,
} from './fanout.js';
import type { Task, TaskNode, TicketFolder } from './fanout.js';
import type { TicketRecord } from '../backlog/backlog.js';
import {
  commit, commitAll as commitFixture, git, installGitShim, removeTempDirs, repo, tempDir, walk,
  write,
} from '../../test/repo.js';

// Every worktree this suite cuts lives inside a temp repository, so removing the temp directories
// removes them too. Measured for Q-0062 on 2026-08-31: one closed chore ticket had left two
// worktrees and 277 MB on disk, because nothing had ever removed one. A run gives its own back
// since that ticket; a suite still has to clean up after itself, because nothing here is a run.
afterAll(removeTempDirs);

/** Whatever `fn` threw. Fails loudly when it threw nothing, rather than passing over a non-throw. */
const caught = (fn: () => unknown): unknown => {
  try { fn(); } catch (e) { return e; }
  throw new Error('expected a throw, and nothing was thrown');
};

/**
 * The sha a branch resolves to, for the cases below whose subject is the sha and not the probe.
 *
 * Fails loudly on either of the other two answers rather than substituting `''`, which is what the
 * `?? ''` at three of these sites used to do — a fixture that quietly resets a branch to nothing is
 * the shape of defect this ticket is about, in the suite asserting the fix.
 */
const headSha = (repoDir: string, branch: string): string => {
  const head = branchHead(repoDir, branch);
  if (head.state !== 'resolved') throw new Error(`fixture: ${branch} is ${head.state}, so there is no sha to assert on`);
  return head.sha;
};

/** A ticket folder holding exactly the files given, keyed by path below the folder. */
const ticketFolder = (files: Record<string, string>): TicketFolder => {
  const dir = tempDir('ticket-');
  for (const [rel, body] of Object.entries(files)) write(path.join(dir, rel), body);
  return { dir };
};

const tasksFile = (ticket: TicketFolder): string => path.join(ticket.dir, 'solution', 'tasks.yaml');

/**
 * The spike's own inline expression, evaluated here so AC-9's promise — a derivation changed, an
 * output identical — is an assertion rather than an argument in a review. This is the ONE spelling
 * of the literal permitted anywhere in this ticket, and it is in a test.
 */
const spikeWorktreeDir = (repoDir: string, branch: string): string =>
  path.join(repoDir, '.harness', 'worktrees', branch.replace(/\//g, '__'));

describe('AC-2 — loadTasks keeps its three routes, its two messages and its side effect', () => {
  test('route 1: tasks.yaml wins, solution.md is not read, and the file is not rewritten', () => {
    const ticket = ticketFolder({
      'solution/tasks.yaml': 'tasks:\n  - id: a\n    role: backend\n    title: A\n',
      'solution/solution.md': '```yaml\ntasks:\n  - id: from-the-document\n```\n',
    });
    const before = fs.readFileSync(tasksFile(ticket), 'utf8');
    expect(loadTasks(ticket)).toStrictEqual([{ id: 'a', role: 'backend', title: 'A' }]);
    expect(fs.readFileSync(tasksFile(ticket), 'utf8')).toBe(before);
  });

  test('route 2: the FIRST block declaring tasks: is written verbatim, then parsed', () => {
    const block = 'tasks:\n  - id: b\n    role: tooling\n    title: B\n';
    const ticket = ticketFolder({
      'solution/solution.md': ['# Solution', '', '```yaml', 'unrelated: true', '```', '', '```yaml', block + '```', ''].join('\n'),
    });
    expect(loadTasks(ticket)).toStrictEqual([{ id: 'b', role: 'tooling', title: 'B' }]);
    // The raw block text, not a re-serialisation: the next run reads this file rather than the doc.
    expect(fs.readFileSync(tasksFile(ticket), 'utf8')).toBe(block);
  });

  test('route 3: neither file, and the message is the whole string', () => {
    const e = caught(() => loadTasks(ticketFolder({})));
    expect(e).toBeInstanceOf(IntegrationError);
    expect((e as Error).message).toBe('no solution/tasks.yaml and no solution/solution.md');
  });

  test('a solution.md with no matching block has its own message, also whole', () => {
    const ticket = ticketFolder({ 'solution/solution.md': '```yaml\nunrelated: true\n```\n' });
    const e = caught(() => loadTasks(ticket));
    expect(e).toBeInstanceOf(IntegrationError);
    expect((e as Error).message).toBe('solution.md has no ```yaml block with tasks:');
  });

  test('`tasks:` with no value, and a file of unrelated keys, both yield []', () => {
    expect(loadTasks(ticketFolder({ 'solution/tasks.yaml': 'tasks:\n' }))).toStrictEqual([]);
    expect(loadTasks(ticketFolder({ 'solution/tasks.yaml': 'something: else\n' }))).toStrictEqual([]);
  });

  test('a TicketRecord is assignable to the structural parameter, so backlog stays unimported', () => {
    // A compile-time assertion: this file stops building if the parameter ever narrows to something
    // Q-0043's record does not satisfy. The runtime check exists so the test reports at all.
    const asFolder = (ticket: TicketRecord): TicketFolder => ticket;
    expect(typeof asFolder).toBe('function');
  });
});

describe('AC-3 — waves groups by depends_on, in order, without mutating', () => {
  test('a two-wave graph, and every task exactly once', () => {
    const tasks: TaskNode[] = [{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }];
    expect(waves(tasks).map((w) => w.map((t) => t.id))).toStrictEqual([['a'], ['b']]);
  });

  test('mutually independent tasks stay in one wave, in input order', () => {
    const tasks: TaskNode[] = [{ id: 'c', depends_on: [] }, { id: 'a' }, { id: 'b', depends_on: null }];
    expect(waves(tasks).map((w) => w.map((t) => t.id))).toStrictEqual([['c', 'a', 'b']]);
  });

  test('an empty input is an empty list of waves', () => {
    expect(waves([])).toStrictEqual([]);
  });

  test('a self-cycle throws, and the message is the whole string', () => {
    const e = caught(() => waves([{ id: 'a', depends_on: ['a'] }]));
    expect(e).toBeInstanceOf(IntegrationError);
    expect((e as Error).message).toBe('dependency cycle or unknown depends_on among: a');
  });

  test('an unknown id names every remaining task, in remaining order, joined by ", "', () => {
    const e = caught(() => waves([{ id: 'b', depends_on: ['x'] }, { id: 'c', depends_on: ['b'] }]));
    expect((e as Error).message).toBe('dependency cycle or unknown depends_on among: b, c');
  });

  test('the spike\'s own case: a lone task depending on one that is not in the set', () => {
    // spike/test/smoke.js:678 — transcribed, not moved (charter §3).
    expect(caught(() => waves([{ id: 'b', depends_on: ['a'] }]))).toBeInstanceOf(IntegrationError);
  });

  test('neither the input array nor its tasks are mutated', () => {
    const tasks: TaskNode[] = [{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }];
    waves(tasks);
    expect(tasks).toStrictEqual([{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }]);
  });
});

describe('AC-4 — scopeToFailing narrows a retry without inheriting dependencies it is not running', () => {
  // spike/test/smoke.js:673-690, transcribed. Q-0006's run 11 crashed here: a conflict scoped the
  // retry to one task whose depends_on named an already-merged sibling.
  const all = (): TaskNode[] => [{ id: 'a', depends_on: [] }, { id: 'b', depends_on: ['a'] }];

  test('unscoped tasks still wave by depends_on, and waves() alone still rejects the lone task', () => {
    expect(waves(all())).toHaveLength(2);
    expect(caught(() => waves([all()[1]]))).toBeInstanceOf(IntegrationError);
  });

  test('scoping keeps only the failing task and drops the dependency on a merged sibling', () => {
    const scoped = scopeToFailing(all(), new Set(['b']));
    expect(scoped).toStrictEqual([{ id: 'b', depends_on: [] }]);
    expect(waves(scoped)).toHaveLength(1);
  });

  test('a dependency inside the scope is preserved, so the retry still waves', () => {
    expect(waves(scopeToFailing(all(), new Set(['a', 'b'])))).toHaveLength(2);
  });

  test('scoping does not mutate the loaded tasks, and returns new objects', () => {
    const tasks = all();
    const scoped = scopeToFailing(tasks, new Set(['b']));
    expect(tasks[1].depends_on).toStrictEqual(['a']);
    expect(scoped[0]).not.toBe(tasks[1]);
  });

  test('an empty failing set scopes to nothing, and every other field survives', () => {
    const rich: Task[] = [{ id: 'a', role: 'backend', title: 'A', description: 'd', contracts: ['c'] }];
    expect(scopeToFailing(rich, new Set())).toStrictEqual([]);
    expect(scopeToFailing(rich, new Set(['a']))).toStrictEqual([
      { id: 'a', role: 'backend', title: 'A', description: 'd', contracts: ['c'], depends_on: [] },
    ]);
  });
});

describe('AC-5 — a task\'s prompt carries its description and nothing else the task holds', () => {
  /** Every field the module reads, plus three it must ignore. */
  const richTask = (worktree: string): Task => {
    write(path.join(worktree, 'contracts/one.md'), '\n  interface One { a: string }\n\n');
    return Object.assign(
      {
        id: 'T1', role: 'backend', title: 'Port the thing',
        description: 'Owns packages/core/src/fanout/**.',
        contracts: ['contracts/one.md', 'contracts/missing.md'],
        depends_on: ['T0', 'Tx'],
      },
      { files: ['spike/src/fanout.js'], acceptance: 'never forwarded', owner: 'nobody' },
    );
  };

  test('taskVars is exactly four keys, role deliberately duplicating task.role', () => {
    const vars = taskVars(richTask(tempDir('wt-')));
    expect(Object.keys(vars).sort()).toStrictEqual(['role', 'task.id', 'task.role', 'task.title']);
    expect(vars).toStrictEqual({ 'task.id': 'T1', 'task.role': 'backend', 'task.title': 'Port the thing', role: 'backend' });
  });

  test('the section is exactly this string, newline layout included', () => {
    const wt = tempDir('wt-');
    expect(taskPromptSection(richTask(wt), wt)).toBe([
      '\n# Task T1 (backend): Port the thing',
      'Owns packages/core/src/fanout/**.',
      '\n## Contract: contracts/one.md\n\n```\ninterface One { a: string }\n```',
      '\n## Contract: contracts/missing.md\n\n(file not found in worktree — treat as a blocker and say so in summary)',
      '\nDepends on: T0, Tx (already merged into your base branch).',
    ].join('\n'));
  });

  test('no value of a field the module does not read reaches the prompt', () => {
    // The ownership decision of 2026-08-23 rests on `description` being the only free-form field the
    // fan-out forwards. Widening this moves the ownership channel.
    const wt = tempDir('wt-');
    const section = taskPromptSection(richTask(wt), wt);
    for (const value of ['spike/src/fanout.js', 'never forwarded', 'nobody']) {
      expect(section.includes(value), `${value} must not reach the agent`).toBe(false);
    }
  });

  test('an empty or missing depends_on produces no line at all', () => {
    const wt = tempDir('wt-');
    const bare: Task = { id: 'T2', role: 'tooling', title: 'B', depends_on: [] };
    expect(taskPromptSection(bare, wt)).toBe('\n# Task T2 (tooling): B');
    expect(taskPromptSection({ id: 'T2', role: 'tooling', title: 'B' }, wt)).toBe('\n# Task T2 (tooling): B');
  });
});

describe('AC-6 — the branch helpers keep their git invocations, and their conflation is pinned', () => {
  const withBranch = (): string => {
    const dir = repo();
    commit(dir, 'second');
    git(dir, 'branch', 'harness/T-1/integration');
    return dir;
  };

  test('branchProbe answers present over a local ref, and absent over one git says is not there', () => {
    const dir = withBranch();
    expect(branchProbe(dir, 'harness/T-1/integration')).toBe('present');
    expect(branchProbe(dir, 'harness/T-1/nope')).toBe('absent');
  });

  test('branchHead resolves a branch and a revision expression, and reports no-such-ref for neither', () => {
    const dir = withBranch();
    const head = branchHead(dir, 'harness/T-1/integration');
    expect(head).toStrictEqual({ state: 'resolved', sha: git(dir, 'rev-parse', 'harness/T-1/integration'), detail: null });
    expect(head.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(branchHead(dir, 'HEAD~1').sha).toBe(git(dir, 'rev-parse', 'HEAD~1'));
    expect(branchHead(dir, 'harness/T-1/nope')).toStrictEqual({ state: 'no-such-ref', sha: null, detail: null });
  });

  test('a git that FAILS is a third answer, and never the negative an absent branch gets', () => {
    // Q-0074 AC-4. This test asserted the opposite until then — `false` and `null` under the shim,
    // the same two values an absent branch produced — under an authority line citing Q-0048 AC-6,
    // which is the pin the repair removes with it. `ancestry()` in this same package has forbidden
    // the inference since Q-0035; these two now forbid it too.
    const dir = withBranch();
    const shim = installGitShim('case " $* " in *rev-parse*) exit 3 ;; esac');
    let probe: ReturnType<typeof branchProbe>;
    let head: ReturnType<typeof branchHead>;
    try {
      probe = branchProbe(dir, 'harness/T-1/integration');
      head = branchHead(dir, 'harness/T-1/integration');
    } finally {
      shim.restore();
    }
    expect(probe, 'a failed probe is not the answer an absent branch gets').toBe('failed');
    expect(probe).not.toBe(branchProbe(dir, 'harness/T-1/nope'));
    expect(head.state, 'and neither is a failed head read').toBe('failed');
    expect(head.sha).toBeNull();
    expect(head).not.toStrictEqual(branchHead(dir, 'harness/T-1/nope'));
    // git's own reason travels with it, because the records that render this are read afterwards.
    expect(head.detail, 'the failure carries what git said').toEqual(expect.any(String));
  });

  test('neither helper checks out, creates, resets or moves anything', () => {
    const dir = withBranch();
    const before = walk(dir);
    branchProbe(dir, 'harness/T-1/integration');
    branchHead(dir, 'harness/T-1/integration');
    expect(git(dir, 'status', '--porcelain')).toBe('');
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(walk(dir)).toStrictEqual(before);
  });
});

describe('AC-7 — commitAll reverts backlog/ before it stages, reports it, and commits as the harness', () => {
  const TICKET = 'backlog/T-0001';
  const BEFORE = '---\nid: T-0001\nstage: solutioned\niterations:\n  solutioning.review: 2\n---\nintent\n';
  /** An agent's step summary as a commit message: untrusted text on a command line (Q-0011). */
  const NASTY = 'write-tests: Created `spike/test/q0011.js` $(touch /tmp/quorum-q0048-pwned) "quoted" \\backslash [Q-0048]';

  /** A worktree with a ticket tracked on its branch, as it is in a live repository. */
  const worktreeWithTicket = (): string => {
    const dir = repo();
    const wt = ticketWorktree(dir, 'harness/T-0001/contracts');
    write(path.join(wt, TICKET, 'ticket.md'), BEFORE);
    commitFixture(wt, 'setup');
    return wt;
  };

  /** What an agent then does: rewrite engine-owned state, add a file beside it, do real work. */
  const agentEdits = (wt: string): void => {
    write(path.join(wt, TICKET, 'ticket.md'), BEFORE.replace('stage: solutioned', 'stage: deployed').replace('  solutioning.review: 2\n', ''));
    write(path.join(wt, TICKET, 'sneaked.md'), 'written by an agent\n');
    write(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');
  };

  test('the tracked edit is reverted, the addition deleted, and legitimate work still commits', () => {
    const wt = worktreeWithTicket();
    agentEdits(wt);
    const dropped: string[] = [];
    const files = commitAll(wt, NASTY, (d) => dropped.push(...d));

    expect(dropped.length).toBeGreaterThanOrEqual(2);
    expect(fs.readFileSync(path.join(wt, TICKET, 'ticket.md'), 'utf8')).toBe(BEFORE);
    expect(fs.existsSync(path.join(wt, TICKET, 'sneaked.md'))).toBe(false);
    expect(files?.every((f) => !f.startsWith('backlog/'))).toBe(true);
    expect(files?.some((f) => f.endsWith('legit.ts'))).toBe(true);
    // A left-behind dirty backlog would break the next merge, so the worktree must come back clean.
    expect(git(wt, 'status', '--porcelain', '--', 'backlog')).toBe('');
  });

  test('the message is argv: it is committed verbatim and never reaches a shell', () => {
    const wt = worktreeWithTicket();
    write(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');
    commitAll(wt, NASTY);
    expect(fs.existsSync('/tmp/quorum-q0048-pwned')).toBe(false);
    expect(git(wt, 'log', '-1', '--pretty=%s')).toBe(NASTY);
  });

  test('the commit identity is the harness, as author and as committer', () => {
    const wt = worktreeWithTicket();
    write(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');
    commitAll(wt, 'work');
    expect(git(wt, 'log', '-1', '--pretty=%an|%ae|%cn|%ce')).toBe('harness|harness@local|harness|harness@local');
  });

  test('nothing staged returns null, and onDiscard is not called when backlog/ is clean', () => {
    const wt = worktreeWithTicket();
    let called = 0;
    expect(commitAll(wt, 'nothing to do', () => { called += 1; })).toBeNull();
    expect(called).toBe(0);
  });

  test('a revert that FAILED reports no discard, and commits nothing over the edit it left', () => {
    // Q-0074 AC-10. This asserted the opposite until then — `expect(files, 'and the edit is
    // committed anyway')` — under an authority line citing Q-0048 AC-12 defect 4, which the repair
    // removes with it. The revert is judged by its outcome now, so a `checkout` that could not run
    // and left the edit in place stops the commit instead of reporting a discard that never was.
    const wt = worktreeWithTicket();
    write(path.join(wt, TICKET, 'ticket.md'), BEFORE.replace('stage: solutioned', 'stage: deployed'));
    write(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');
    const dropped: string[] = [];
    const shim = installGitShim('case " $* " in *" checkout "*) exit 3 ;; esac');
    let thrown: unknown;
    try {
      thrown = caught(() => commitAll(wt, 'revert could not run', (d) => dropped.push(...d)));
    } finally {
      shim.restore();
    }
    expect(thrown, 'the caller is told').toBeInstanceOf(IntegrationError);
    expect(String((thrown as Error).message)).toContain(`${TICKET}/ticket.md`);
    expect(dropped, 'and nothing claimed a discard that did not happen').toStrictEqual([]);
    expect(fs.readFileSync(path.join(wt, TICKET, 'ticket.md'), 'utf8')).toContain('stage: deployed');
    expect(git(wt, 'log', '-1', '--pretty=%s'), 'nothing was committed').toBe('setup');
  });

  test('a status probe that FAILED refuses rather than reading backlog/ as clean', () => {
    // Q-0074 AC-9, and decision 088's own fourth unnamed site: the `?? ''` that stood here made a
    // failed probe an empty dirty list, so no revert ran, `onDiscard` never fired, and the `git add
    // -A` two lines down committed the agent's edit to a ticket's frontmatter.
    const wt = worktreeWithTicket();
    write(path.join(wt, TICKET, 'ticket.md'), BEFORE.replace('stage: solutioned', 'stage: deployed'));
    const dropped: string[] = [];
    // The subcommand as a whole word, and a message that does not contain it. A `*status*` pattern
    // reads `$*`, which holds the commit MESSAGE too — so it killed the commit as well as the probe
    // and the mutation below then went red for a reason that was not the one being demonstrated.
    const shim = installGitShim('case " $* " in *" status "*) exit 3 ;; esac');
    let thrown: unknown;
    try {
      thrown = caught(() => commitAll(wt, 'the probe could not run', (d) => dropped.push(...d)));
    } finally {
      shim.restore();
    }
    expect(thrown).toBeInstanceOf(IntegrationError);
    expect(String((thrown as Error).message), 'named with git\'s own reason').toMatch(/cannot read what backlog\/ is holding .* — .+/);
    expect(dropped).toStrictEqual([]);
    expect(git(wt, 'log', '-1', '--pretty=%s'), 'nothing was committed').toBe('setup');
  });

  test('and the refusal is unreachable where backlog/ is legitimately clean', () => {
    // R-6: the two are one character apart in the `?? ''` this replaces, so the guard has to be
    // shown NOT to fire on the ordinary case as well as to fire on the failing one.
    const wt = worktreeWithTicket();
    write(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');
    const dropped: string[] = [];
    expect(commitAll(wt, 'clean backlog', (d) => dropped.push(...d))).toStrictEqual(['src/legit.ts']);
    expect(dropped).toStrictEqual([]);
  });

  test('the FIRST reported name keeps its first character when the file is only modified', () => {
    // Q-0074 AC-11. This asserted `['acklog/T-0001/ticket.md', …]` until then, under an authority
    // line citing Q-0048 AC-12: `git()` trims the whole of `status --porcelain`, so a leading ` M `
    // arrives as `M ` on line one alone and the fixed `.slice(3)` ate a character of the path. The
    // status field is dropped as a token now, which is right for both shapes — and the runner's own
    // `.trim()` is untouched, because it feeds every git call this module makes (NG-3).
    const wt = worktreeWithTicket();
    write(path.join(wt, TICKET, 'ticket.md'), BEFORE.replace('stage: solutioned', 'stage: deployed'));
    write(path.join(wt, TICKET, 'sneaked.md'), 'written by an agent\n');
    const dropped: string[] = [];
    commitAll(wt, 'work', (d) => dropped.push(...d));

    expect(dropped).toStrictEqual([`${TICKET}/ticket.md`, `${TICKET}/sneaked.md`]);
    // The mechanism, not just the outcome: line one is the one the trim reaches, and the second
    // entry was always right — so a fix that only widened the slice would pass the first clause
    // and fail this one.
    expect(dropped[0], 'the first line is the one the trim reaches').toBe(`${TICKET}/ticket.md`);
    expect(dropped.every((p) => p.startsWith('backlog/'))).toBe(true);
  });
});

describe('AC-8 — mergeInto reports conflicts, git\'s reason, and what the worktree was left holding', () => {
  const TASK_A = 'harness/T-2/task-a';
  const TASK_B = 'harness/T-2/task-b';
  const INTEGRATION = 'harness/T-2/integration';

  /** Two sibling task branches that changed the same line, and an integration worktree. */
  const diverged = (): { dir: string; integration: string } => {
    const dir = repo();
    write(path.join(dir, 'f.txt'), 'base\n');
    commitFixture(dir, 'base file');
    for (const [branch, body] of [[TASK_A, 'from a\n'], [TASK_B, 'from b\n']]) {
      const wt = ticketWorktree(dir, branch);
      write(path.join(wt, 'f.txt'), body);
      commitFixture(wt, `work on ${branch}`);
    }
    return { dir, integration: ticketWorktree(dir, INTEGRATION) };
  };

  test('a clean merge returns exactly {ok, conflicts} and --no-ff made a merge commit', () => {
    const { integration } = diverged();
    expect(mergeInto(integration, TASK_A)).toStrictEqual({ ok: true, conflicts: [] });
    expect(git(integration, 'rev-list', '--count', '--merges', 'HEAD')).toBe('1');
    expect(fs.readFileSync(path.join(integration, 'f.txt'), 'utf8')).toBe('from a\n');
  });

  test('a conflicting merge names the paths, aborts, and leaves no merge in progress', () => {
    const { integration } = diverged();
    mergeInto(integration, TASK_A);
    const result = mergeInto(integration, TASK_B);

    expect(result.ok).toBe(false);
    expect(result.conflicts).toStrictEqual(['f.txt']);
    expect(git(integration, 'status', '--porcelain')).toBe('');
    expect(fs.existsSync(path.join(integration, '.git'))).toBe(true);
    // No merge in progress: MERGE_HEAD is gone, so the next step starts from a clean branch — and
    // the result says so, rather than the caller having to re-derive it.
    expect(branchHead(integration, 'MERGE_HEAD').state).toBe('no-such-ref');
    expect(result.worktreeClean).toBe(true);
  });

  test('a content conflict reports the reason git gave, on whichever stream it gave it', () => {
    // Q-0074 AC-12. This asserted `expect(result.error).toBe('')` until then, under an authority
    // line citing Q-0048 AC-12: the fallback was `e.stderr ?? e.message`, and `??` does not fall
    // back on an empty string, so git putting "CONFLICT (content): …" on STDOUT left the error ''.
    // `conflicts` carries what a caller acts on, which is why this had never been felt — and why
    // `mergeFailure` could answer "git reported no reason" only where it also had no paths.
    const { integration } = diverged();
    mergeInto(integration, TASK_A);
    const result = mergeInto(integration, TASK_B);

    const raw = caught(() => git(integration, '-c', 'user.email=harness@local', '-c', 'user.name=harness', 'merge', '--no-ff', '--no-edit', TASK_B)) as { stderr?: string; stdout?: string };
    git(integration, 'merge', '--abort');

    // The premise the old pin rested on, kept: git really does say nothing on stderr here, so a
    // reader cannot mistake this for a case where either stream would have done.
    expect(raw.stderr).toBe('');
    expect(String(raw.stdout), 'git did say why — on the other stream').toContain('CONFLICT');
    expect(result.error, 'and that is what the result now carries').toContain('CONFLICT');
    expect(result.error).toContain('f.txt');
  });

  test('a conflict probe that FAILED reports an unread list, and never an empty one', () => {
    // The two are one value apart — `[]` and `null` — and only one of them is a claim about the
    // merge. `mergeFailure` is what a human reads, so it is asserted beside the field.
    const { integration } = diverged();
    mergeInto(integration, TASK_A);
    const shim = installGitShim('case " $* " in *--diff-filter=U*) exit 3 ;; esac');
    let result: ReturnType<typeof mergeInto>;
    try { result = mergeInto(integration, TASK_B); } finally { shim.restore(); }

    expect(result.ok).toBe(false);
    expect(result.conflicts, 'an unread list is null, not empty').toBeNull();
    // The abort itself was not shimmed, so the worktree came back clean and the result says so —
    // which is the discrimination the next test is about, holding on this one's failure too.
    expect(result.worktreeClean).toBe(true);
    // The sentence a human reads is `mergeFailure`'s, and is asserted in `engine/steps.test.ts`
    // beside the other two things it may not say.
  });

  test('an abort that did not leave the worktree clean is reported, not promised away', () => {
    // The JSDoc promised "leave the worktree clean either way" over a best-effort abort, which is
    // decision 088's fourth unnamed site. What is asserted is the PROBE rather than the abort's own
    // exit code: an abort legitimately fails when there was no merge to abort, so reading its
    // status would report a dirty worktree over a clean one — this defect in the other direction.
    const { integration } = diverged();
    mergeInto(integration, TASK_A);
    const shim = installGitShim('case " $* " in *" --abort "*) exit 3 ;; esac');
    let result: ReturnType<typeof mergeInto>;
    try { result = mergeInto(integration, TASK_B); } finally { shim.restore(); }

    expect(result.worktreeClean, 'a merge really is still in progress').toBe(false);
    expect(branchHead(integration, 'MERGE_HEAD').state).toBe('resolved');
    git(integration, 'merge', '--abort');
    expect(git(integration, 'status', '--porcelain')).toBe('');
  });

  test('a failure git DOES report on stderr keeps the tail of it, bounded at 500 characters', () => {
    // Structural, never git's prose: its diagnostic text differs between platforms and versions.
    const { integration } = diverged();
    const result = mergeInto(integration, 'harness/T-2/no-such-branch');

    const raw = String((caught(() => git(integration, '-c', 'user.email=harness@local', '-c', 'user.name=harness', 'merge', '--no-ff', '--no-edit', 'harness/T-2/no-such-branch')) as { stderr?: string }).stderr ?? '');

    expect(result.ok).toBe(false);
    expect(result.conflicts, 'nothing was left unmerged, so the reason is all there is').toStrictEqual([]);
    // `endsWith` over an empty string is true, so the emptiness is refused first: a check that
    // skips its subject must not report success (docs/DECISIONS.md, 2026-08-25).
    expect(raw.length, 'the failure carried nothing, so there is no tail to compare').toBeGreaterThan(0);
    expect((result.error ?? '').length).toBeGreaterThan(0);
    expect((result.error ?? '').length).toBeLessThanOrEqual(500);
    expect(raw.endsWith(result.error ?? ''), 'the last 500 characters, because git\'s reason is at the end').toBe(true);
    expect(git(integration, 'status', '--porcelain')).toBe('');
  });

  test('the successful shape carries no error key at all', () => {
    const { integration } = diverged();
    expect('error' in mergeInto(integration, TASK_A)).toBe(false);
  });
});

describe('AC-9 — worktrees and the sibling branch layout', () => {
  test('ticketWorktree lands exactly where the spike\'s inline expression says, and is idempotent', () => {
    const dir = repo();
    const wt = ticketWorktree(dir, 'harness/T-3/integration');
    expect(wt).toBe(spikeWorktreeDir(dir, 'harness/T-3/integration'));
    expect(fs.existsSync(path.join(wt, '.git'))).toBe(true);
    // The null base is deliberate: the branch is created from HEAD on first use.
    expect(headSha(dir, 'harness/T-3/integration')).toBe(git(dir, 'rev-parse', 'main'));
    expect(ticketWorktree(dir, 'harness/T-3/integration')).toBe(wt);
  });

  test('resetBranchTo hard-resets inside the worktree when one is there, and cleans it', () => {
    const dir = repo();
    const wt = ticketWorktree(dir, 'harness/T-3/integration');
    const start = headSha(dir, 'harness/T-3/integration');
    write(path.join(wt, 'committed.txt'), 'x\n');
    commitFixture(wt, 'a commit to roll back');
    write(path.join(wt, 'uncommitted.txt'), 'y\n');

    resetBranchTo(dir, 'harness/T-3/integration', start);

    expect(headSha(dir, 'harness/T-3/integration')).toBe(start);
    expect(fs.existsSync(path.join(wt, 'committed.txt'))).toBe(false);
    expect(fs.existsSync(path.join(wt, 'uncommitted.txt'))).toBe(false);
    expect(git(wt, 'status', '--porcelain')).toBe('');
  });

  test('and moves the ref in the repository when there is no worktree, creating none', () => {
    const dir = repo();
    const start = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'branch', 'harness/T-3/contracts');
    commit(dir, 'main moves on');
    git(dir, 'branch', '-f', 'harness/T-3/contracts', 'main');

    resetBranchTo(dir, 'harness/T-3/contracts', start);

    expect(headSha(dir, 'harness/T-3/contracts')).toBe(start);
    expect(fs.existsSync(spikeWorktreeDir(dir, 'harness/T-3/contracts'))).toBe(false);
  });

  test('the full sibling set survives: nothing shortens, collapses or relocates a branch name', () => {
    // Git refs are files in directories, so `harness/<id>` cannot exist alongside `harness/<id>/x`.
    // A port that "simplifies" the naming breaks every ticket folder in backlog/.
    const dir = repo();
    const siblings = ['integration', 'contracts', 'tests', 'T1'].map((leaf) => `harness/T-4/${leaf}`);
    for (const branch of siblings) {
      const wt = ticketWorktree(dir, branch);
      expect(wt).toBe(spikeWorktreeDir(dir, branch));
      expect(branchProbe(dir, branch)).toBe('present');
      write(path.join(wt, `${branch.split('/').pop() ?? ''}.txt`), 'x\n');
      commitFixture(wt, `work on ${branch}`);
    }
    expect(branchProbe(dir, 'harness/T-4')).toBe('absent');

    const integration = spikeWorktreeDir(dir, 'harness/T-4/integration');
    for (const branch of siblings.slice(1)) expect(mergeInto(integration, branch).ok).toBe(true);
    for (const leaf of ['contracts', 'tests', 'T1']) {
      expect(fs.existsSync(path.join(integration, `${leaf}.txt`)), `${leaf} merged`).toBe(true);
    }

    const branches = git(dir, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n');
    expect(branches.filter((b) => b.startsWith('refs/heads/harness/T-4/')).sort())
      .toStrictEqual(siblings.map((b) => `refs/heads/${b}`).sort());
  });
});

describe('AC-11 — nothing in this module writes to the user\'s working tree', () => {
  /** The worktree root as `walk` spells it: below the repository, separated by this platform's `sep`. */
  const WORKTREE_ROOT = path.join(...REPO_WORKTREE_ROOT.split('/'));

  /**
   * Whether AC-11 permits `entry` to appear or vanish: git's own directory, the worktree root and
   * everything beneath it, and the ancestor directories that root cannot exist without.
   *
   * Deliberately narrower than `.harness/**`. A sibling such as `.harness/notes` is not under
   * `.harness/worktrees/`, so it is exactly what the comparison below exists to catch, and
   * filtering the whole of `.harness/` away would let a regression write there and still pass.
   */
  const permitted = (entry: string): boolean =>
    entry === '.git' || entry.startsWith(`.git${path.sep}`)
    || entry === WORKTREE_ROOT || entry.startsWith(`${WORKTREE_ROOT}${path.sep}`)
    || WORKTREE_ROOT.startsWith(`${entry}${path.sep}`);

  /** Everything a snapshot holds that must be identical before and after. */
  const outside = (entries: string[]): string[] => entries.filter((e) => !permitted(e));

  test('the comparison keeps a write anywhere else under .harness visible', () => {
    // Without this the safety test below is vacuous for `.harness/` siblings: it would filter out
    // the very regression it is there to fail on.
    const allowed = ['.harness', WORKTREE_ROOT, path.join(WORKTREE_ROOT, 'harness__T-9__integration'),
      '.git', path.join('.git', 'HEAD')];
    expect(outside(allowed), 'the root, its ancestors and git\'s directory are permitted').toStrictEqual([]);

    const forbidden = [path.join('.harness', 'notes.txt'), path.join('.harness', 'runs', 'x'),
      path.join('.quorum', 'runs'), 'f.txt'];
    expect(outside(forbidden), 'everything else stays visible to the comparison').toStrictEqual(forbidden);
  });

  test('after every function has run, the repository root is clean and unchanged', () => {
    const dir = repo();
    write(path.join(dir, 'f.txt'), 'base\n');
    commitFixture(dir, 'base file');
    const before = walk(dir);

    const task = ticketWorktree(dir, 'harness/T-5/task-a');
    write(path.join(task, 'g.txt'), 'from the task\n');
    commitAll(task, 'task work');

    const integration = ticketWorktree(dir, 'harness/T-5/integration');
    const start = headSha(dir, 'harness/T-5/integration');
    expect(mergeInto(integration, 'harness/T-5/task-a').ok).toBe(true);
    resetBranchTo(dir, 'harness/T-5/integration', start);
    expect(runCommand('printf hello', integration).code).toBe(0);

    expect(git(dir, 'status', '--porcelain'), 'the worktree root never shows in git status').toBe('');
    expect(outside(walk(dir))).toStrictEqual(outside(before));
    expect(fs.existsSync(path.join(dir, '.quorum')), 'run history is Q-0049\'s, not this module\'s').toBe(false);
  });

  test('the one write outside a worktree is loadTasks materialising tasks.yaml', () => {
    const ticket = ticketFolder({ 'solution/solution.md': '```yaml\ntasks: []\n```\n' });
    const before = walk(ticket.dir);
    loadTasks(ticket);
    expect(walk(ticket.dir).filter((e) => !before.includes(e))).toStrictEqual([path.join('solution', 'tasks.yaml')]);
  });
});

describe('AC-12 — the inherited hazards are preserved and pinned, not fixed', () => {
  test('taskVars hands back a hostile task id unchanged', () => {
    // Why: preserved defect, see Q-0048 AC-12 defect 1 (Q-0042 finding 4). argv stops shell
    // injection, not option injection: git reads a leading `-` as a flag. The ticket that adds a
    // guard changes this red test rather than a silent behaviour.
    const hostile = '--upload-pack=touch /tmp/quorum-q0048-pwned';
    expect(taskVars({ id: hostile, role: '-x', title: 't' })['task.id']).toBe(hostile);
  });

  test('a hand-deleted worktree directory wedges the branch rather than being repaired', () => {
    // Why: preserved defect, see Q-0048 AC-12 defect 2 (Q-0042 finding 5). The route is chosen from
    // fs.existsSync alone, while git still holds the administrative entry.
    const dir = repo();
    const branch = 'harness/T-6/integration';
    const wt = ticketWorktree(dir, branch);
    const start = headSha(dir, branch);
    fs.rmSync(wt, { recursive: true, force: true });

    expect(fs.existsSync(wt)).toBe(false);
    expect(git(dir, 'worktree', 'list'), 'git still holds the registration').toContain(branch);
    expect(caught(() => resetBranchTo(dir, branch, start))).toBeInstanceOf(Error);
  });

  test('an empty tasks.yaml throws a raw TypeError, not an IntegrationError', () => {
    // Why: preserved defect, see Q-0048 AC-12 defect 3. `YAML.parse('')` is null, so `.tasks`
    // throws — and the CLI's catch does not recognise it, so a user gets a stack trace.
    const e = caught(() => loadTasks(ticketFolder({ 'solution/tasks.yaml': '' })));
    expect(e).toBeInstanceOf(TypeError);
    expect(e).not.toBeInstanceOf(IntegrationError);
  });
});
