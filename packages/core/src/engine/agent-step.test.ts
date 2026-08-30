import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { worktreeDirName } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { commitAll as commitRepo, git, removeTempDirs, repo, write } from '../../test/repo.js';
import { stubAdapter } from '../../test/run-fixture.js';
import { Backlog } from '../backlog/backlog.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { branchExists } from '../fanout/fanout.js';
import { runAgentStep } from './steps.js';
import type { RoutingContext } from './types.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

const TICKET_ID = 'Q-0052';
const FOLDER = 'Q-0052-agent-gate-script';
const INTEGRATION = 'harness/Q-0052/integration';

/** One agent step's context over a real git repository, with the persistence seam observed. */
function agentContext(overrides: Partial<RoutingContext> = {}): {
  context: RoutingContext;
  events: Event[];
  repoDir: string;
  ticketDir: string;
  occurrence: Record<string, unknown>;
} {
  const repoDir = repo();
  const ticketDir = path.join(repoDir, 'backlog', FOLDER);
  write(path.join(ticketDir, 'ticket.md'), `---\nid: ${TICKET_ID}\n---\nbody\n`);
  // Tracked, so every worktree this repository cuts holds a `backlog/` for AC-7d to dirty.
  commitRepo(repoDir, 'backlog');
  const events: Event[] = [];
  const occurrence: Record<string, unknown> = { step_id: 'implement', occurrence_dir: 'steps/001-implement' };
  const ticket = {
    dir: ticketDir, folder: FOLDER, body: 'body\n',
    meta: { id: TICKET_ID, title: 'agent step', stage: 'requirements', branch: INTEGRATION },
  } as unknown as TicketRecord;
  const context = {
    ticket, repoDir, harnessDir: path.join(repoDir, 'harness'),
    flow: { name: 'chore', consumes: 'requirements', produces: 'reviewed', steps: [] },
    config: {}, backlog: new Backlog(path.join(repoDir, 'backlog')), runId: 4,
    counters: {}, vars: { id: TICKET_ID, iter: 1, run: 4, base: 'main' },
    stats: { cost: 0, tokens: 0, unpriced: 0 }, dry: false, auto: false,
    emit: (event: Event) => events.push(event),
    persistence: {
      writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(),
      allocateOccurrence: vi.fn(() => occurrence),
      persistArtifact: vi.fn(), terminalOccurrence: vi.fn(),
      finaliseManifest: vi.fn(), finaliseActiveOccurrences: vi.fn(),
    },
    nextGateId: () => '4:1', loadNamedFlow: vi.fn(), finishRun: vi.fn(),
    diffInputs: new Map(), deferredDiffs: new Map(), baseOverride: null,
    ...overrides,
  } as unknown as RoutingContext;
  return { context, events, repoDir, ticketDir, occurrence };
}

/** An adapter that answers a bare summary and, optionally, writes files into the step's own cwd. */
const answering = (writes: Record<string, string> = {}): ReturnType<typeof stubAdapter> => stubAdapter((options) => {
  for (const [rel, text] of Object.entries(writes)) write(path.join(options.cwd, rel), text);
  const output = { summary: 'a summary long enough to be cut at sixty characters by the commit message builder' };
  return { output, raw: JSON.stringify(output), usage: { vendor: 'stub', cost_usd: 0.5, input_tokens: 1, output_tokens: 2, cached_input_tokens: null, cache_write_input_tokens: null } };
});

/** Where `ensureWorktree` puts a branch's worktree, derived through shared rather than re-spelled. */
const worktreeOf = (repoDir: string, branch: string): string =>
  path.join(repoDir, '.harness', 'worktrees', worktreeDirName(branch));

const infos = (events: Event[]): string[] => events.filter((e) => e.type === 'info').map((e) => e.message);
const warns = (events: Event[]): string[] => events.filter((e) => e.type === 'warn').map((e) => e.message);

describe('Q-0052 AC-7 — worktree, base sync, and the commit', () => {
  test('AC-7a/7e — the branch and base are interpolated, and the adapter is given the worktree', async () => {
    const { context, events, repoDir } = agentContext();
    const stub = answering();
    const step = { id: 'implement', worktree: true, branch: 'harness/{id}/{iter}-implement', base: '{base}' };

    await expect(runAgentStep(step, context)).resolves.toBeNull();

    const worktree = worktreeOf(repoDir, 'harness/Q-0052/1-implement');
    expect(branchExists(repoDir, 'harness/Q-0052/1-implement')).toBe(true);
    expect(infos(events)).toContain(`implement: worktree ${worktree} (harness/Q-0052/1-implement)`);
    // The DIRECTORY the adapter received, not merely that it was called: `cwd` is what decides
    // whether a code-writing step touches the user's checkout or its own worktree.
    expect(stub.calls[0]?.cwd).toBe(worktree);
    expect(stub.calls[0]?.allowWrite).toBe(true);
  });

  test('AC-7e — a step with no worktree runs in the repository and may not write', async () => {
    const { context, repoDir } = agentContext();
    const stub = answering();
    await expect(runAgentStep({ id: 'review' }, context)).resolves.toBeNull();
    expect(stub.calls[0]?.cwd).toBe(repoDir);
    expect(stub.calls[0]?.allowWrite).toBe(false);
    expect(fs.existsSync(path.join(repoDir, '.harness', 'worktrees'))).toBe(false);
  });

  test('AC-7c — a base that does not exist yet is an info, not a warning with nothing after it', async () => {
    const { context, events } = agentContext();
    answering();
    // Normal on a ticket's first pass: `integrate` creates the integration branch and has not run.
    await runAgentStep({ id: 'implement', worktree: true, base: INTEGRATION }, context, { syncBase: true });

    expect(infos(events)).toContain(`implement: base ${INTEGRATION} does not exist yet — nothing to sync`);
    expect(warns(events)).toStrictEqual([]);
  });

  test('AC-7b/7c — an existing branch is synced to its base, and the sync says so', async () => {
    const { context, events, repoDir } = agentContext();
    answering();
    git(repoDir, 'branch', INTEGRATION, 'main');
    git(repoDir, 'branch', 'harness/Q-0052/implement', 'main');
    // A commit on the base AFTER the step branch was cut, so the merge has something to do and
    // "synced" is distinguishable from "nothing happened".
    git(repoDir, 'checkout', '-q', INTEGRATION);
    write(path.join(repoDir, 'landed.txt'), 'landed since\n');
    commitRepo(repoDir, 'landed since');
    git(repoDir, 'checkout', '-q', 'main');

    await runAgentStep({ id: 'implement', worktree: true, base: INTEGRATION }, context);

    expect(infos(events)).toContain(`implement: synced to ${INTEGRATION}`);
    expect(fs.existsSync(path.join(worktreeOf(repoDir, 'harness/Q-0052/implement'), 'landed.txt'))).toBe(true);
  });

  test('AC-7b — a branch this call created is NOT synced unless the caller asks', async () => {
    // The other half of `existed || extra.syncBase`, and the reason Q-0004 widened it: without the
    // first disjunct a branch from an earlier round works against yesterday's tree. Without this
    // row, an implementation that always syncs passes the two above.
    const { context, events, repoDir } = agentContext();
    answering();
    git(repoDir, 'branch', INTEGRATION, 'main');

    await runAgentStep({ id: 'implement', worktree: true, base: INTEGRATION }, context);

    expect(infos(events).some((message) => message.includes('synced to'))).toBe(false);
  });

  test('AC-7c — a merge that conflicts warns with git\'s reason, never an empty one', async () => {
    const { context, events, repoDir } = agentContext();
    answering();
    write(path.join(repoDir, 'shared.txt'), 'original\n');
    commitRepo(repoDir, 'shared file');
    git(repoDir, 'branch', INTEGRATION, 'main');
    git(repoDir, 'branch', 'harness/Q-0052/implement', 'main');
    git(repoDir, 'checkout', '-q', INTEGRATION);
    write(path.join(repoDir, 'shared.txt'), 'from the base\n');
    commitRepo(repoDir, 'base edit');
    git(repoDir, 'checkout', '-q', 'harness/Q-0052/implement');
    write(path.join(repoDir, 'shared.txt'), 'from the branch\n');
    commitRepo(repoDir, 'branch edit');
    git(repoDir, 'checkout', '-q', 'main');

    await runAgentStep({ id: 'implement', worktree: true, base: INTEGRATION }, context);

    expect(warns(events)).toStrictEqual([`implement: could not sync to ${INTEGRATION} — conflicts: shared.txt`]);
  });

  test('AC-7d — the commit message is the step, the truncated summary and the ticket', async () => {
    const { context, events, repoDir } = agentContext();
    answering({ 'src/written.ts': 'export const ok = true;\n' });

    await runAgentStep({ id: 'implement', worktree: true }, context);

    const worktree = worktreeOf(repoDir, 'harness/Q-0052/implement');
    expect(git(worktree, 'log', '-1', '--pretty=%s')).toBe(
      'implement: a summary long enough to be cut at sixty characters by the c [Q-0052]',
    );
    // Sixty characters of it, exactly — the cut is what keeps a rambling summary out of `git log`.
    expect(git(worktree, 'log', '-1', '--pretty=%s')).toHaveLength('implement: '.length + 60 + ' [Q-0052]'.length);
    expect(infos(events)).toContain('implement: 1 file(s) committed on harness/Q-0052/implement');
  });

  test('AC-7d — an agent\'s edits under backlog/ are discarded, named, and kept out of the commit', async () => {
    const { context, events, repoDir } = agentContext();
    answering({
      'src/written.ts': 'export const ok = true;\n',
      [`backlog/${FOLDER}/agent-note.md`]: 'the agent writing into the engine\'s own state\n',
    });

    await runAgentStep({ id: 'implement', worktree: true }, context);

    const worktree = worktreeOf(repoDir, 'harness/Q-0052/implement');
    expect(warns(events)).toStrictEqual([
      `implement: discarded 1 edit(s) under backlog/ — the engine owns ticket state, not the agent: backlog/${FOLDER}/agent-note.md`,
    ]);
    expect(git(worktree, 'log', '-1', '--name-only', '--pretty=')).toBe('src/written.ts');
    expect(fs.existsSync(path.join(worktree, 'backlog', FOLDER, 'agent-note.md'))).toBe(false);
  });

  test('AC-7d — more than four discarded paths are cut to four and say so', async () => {
    const { context, events, repoDir } = agentContext();
    answering(Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e'].map((name) => [`backlog/${FOLDER}/note-${name}.md`, 'agent noise\n']),
    ));

    await runAgentStep({ id: 'implement', worktree: true }, context);

    // Four named, the fifth elided — and the count is the real one, so the ellipsis cannot be read
    // as "that was all of them".
    expect(warns(events)[0]).toBe(
      'implement: discarded 5 edit(s) under backlog/ — the engine owns ticket state, not the agent:'
      + ` backlog/${FOLDER}/note-a.md, backlog/${FOLDER}/note-b.md, backlog/${FOLDER}/note-c.md, backlog/${FOLDER}/note-d.md, …`,
    );
    // The other branch of the same `info`: nothing survived the revert, so nothing was committed.
    expect(infos(events)).toContain('implement: no file changes on harness/Q-0052/implement');
  });
});

describe('Q-0052 AC-12c — every interpolation site this ticket adds coerces deliberately', () => {
  test('a YAML number for branch: creates the branch "2", as the spike does', async () => {
    // Behavioural rather than a source scan. `interpolate`'s parameter is typed `string` while the
    // spike coerces with `String(s)`, and YAML hands back a NUMBER for `branch: 2` — so an
    // uncoerced call is a compile error and a coerced one must still produce the spike's branch.
    // A source scan for un-coerced calls is the shape Q-0079 found could be talked out of firing by
    // a comment; a run that produces the branch cannot be.
    const { context, repoDir } = agentContext();
    answering();
    await runAgentStep({ id: 'implement', worktree: true, branch: 2 }, context);
    expect(branchExists(repoDir, '2')).toBe(true);
  });

  test('a YAML number for verdict_file: writes that file, and its verdict JSON', async () => {
    const { context, ticketDir } = agentContext();
    stubAdapter(() => {
      const output = { summary: 's', verdict: 'approve', findings: [] };
      return { output, raw: JSON.stringify(output), usage: { vendor: 'stub', cost_usd: 0, input_tokens: 1, output_tokens: 1, cached_input_tokens: null, cache_write_input_tokens: null } };
    });
    await runAgentStep({ id: 'review', output: { verdict: 'approve|reject', verdict_file: 7 } }, context);
    expect(JSON.parse(fs.readFileSync(path.join(ticketDir, '7'), 'utf8'))).toStrictEqual({
      verdict: 'approve', findings: [], summary: 's',
    });
  });
});

describe('Q-0052 — a preserved defect this port carries into core', () => {
  test('a successful call that reported NO usage crashes on the runs.log line', async () => {
    // Why: preserved defect, see Q-0052. `withRetry` answers `usage: null` for a call that reported
    // no measure at all (Q-0034, deliberate), and the step's own log line dereferences it — two
    // lines below a failure path that guards the identical read. Pinned so a later fix is a
    // deliberate act rather than an incidental one, exactly as Q-0080's allocator pins were.
    const { context } = agentContext();
    stubAdapter(() => {
      const output = { summary: 's' };
      return { output, raw: JSON.stringify(output), usage: null };
    });

    const error = await runAgentStep({ id: 'implement' }, context).then(() => undefined, (cause: unknown) => cause);

    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toContain('cost_usd');
    // …and the step got that far: the occurrence was billed and its output persisted first, so what
    // is lost is the log line and everything after it, not the record of the call.
    expect(vi.mocked(context.persistence.persistArtifact)).toHaveBeenCalledWith(expect.anything(), 'output.txt', '{"summary":"s"}');
  });
});

describe('Q-0052 R-3 — runAgentStep keeps the extra parameter Q-0053 supplies', () => {
  test('extra.vars overlay the run\'s for one call, and the run context is not changed by it', async () => {
    const { context, ticketDir } = agentContext();
    const stub = stubAdapter(() => {
      const output = { summary: 's', document: '# task output\n' };
      return { output, raw: JSON.stringify(output), usage: { vendor: 'stub', cost_usd: 0.1, input_tokens: 1, output_tokens: 1, cached_input_tokens: null, cache_write_input_tokens: null } };
    });
    const step = { id: 'implement', output: { write: 'dev/{task}.md' } };

    await runAgentStep(step, context, { vars: { task: 'Q-0052.1', iter: 9 } });

    // Both readers of the merged values: the write loop's interpolation, and the prompt's.
    expect(fs.readFileSync(path.join(ticketDir, 'dev/Q-0052.1.md'), 'utf8')).toBe('# task output\n');
    expect(stub.calls[0]?.prompt).toContain('it will be saved as dev/Q-0052.1.md');
    expect(stub.calls[0]?.prompt).toContain('Iteration: 9.');
    // The overlay is a view for one call. `RunContext`'s own contract is that a step receives the
    // run's object rather than a copy, so the run's own values must be untouched afterwards.
    expect(context.vars.iter).toBe(1);
    expect(context.vars.task).toBeUndefined();
  });

  test('extra.promptSuffix is appended, and is given the working directory the step resolved', async () => {
    const { context, repoDir } = agentContext();
    const stub = answering();
    const seen: string[] = [];

    await runAgentStep({ id: 'implement', worktree: true }, context, {
      promptSuffix: (cwd) => { seen.push(cwd); return '\n\n# Task Q-0052.1'; },
    });

    expect(seen).toStrictEqual([worktreeOf(repoDir, 'harness/Q-0052/implement')]);
    expect(stub.calls[0]?.prompt.endsWith('\n\n# Task Q-0052.1')).toBe(true);
  });
});
