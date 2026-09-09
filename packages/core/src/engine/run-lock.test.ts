/**
 * Q-0039 AC-1, AC-5, AC-6 and AC-8 — where the lock is taken, when it is given back, and what a run
 * that meets one does not do.
 *
 * The claim's own properties are `writer.test.ts`'s, over the module's API. What is here is what
 * only a real run can show: that the lock is taken before the three resources a run holds
 * exclusively become facts, that every way out of `run()` gives it back, and that a refused run
 * leaves the ticket exactly as it found it.
 *
 * `routing.runStep` is the seam every terminal status is composed through, as `engine.test.ts`
 * composes AC-8's cursor moves through it: the six exits are properties of `run()`, and stubbing the
 * step is what makes each of them reachable without a vendor, a worktree or a flow file per case.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import { loadProject } from '../backlog/project.js';
import * as fanout from '../fanout/fanout.js';
import * as writer from '../run-history/writer.js';
import { removeTempDirs, repo, walk, write } from '../../test/repo.js';
import { runFlow } from './engine.js';
import { loadFlow } from './loaders.js';
import * as routing from './routing.js';
import { GateUnansweredError, type RunFlowOptions } from './types.js';

const TICKET = 'Q-0039';

/**
 * A run over a ticket folder and a flow file that exist, in a repository this test made.
 *
 * The shape `engine.test.ts` uses, narrowed to this ticket's subject: the flow carries no steps of
 * its own because every case below supplies its outcome through the routing seam.
 */
function options(overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
  const repoDir = repo();
  write(path.join(repoDir, 'harness/harness.yaml'), 'adapterOverride: mock\nrepo:\n  base_branch: main\n');
  const project = loadProject(repoDir);
  const flowFile = path.join(repoDir, 'harness/flows/requirements.yaml');
  write(flowFile, 'name: requirements\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: pm\n');
  const flow: Flow = { ...loadFlow(flowFile), steps: [{ id: 'pm' }] as unknown as Flow['steps'] };
  const ticketDir = path.join(repoDir, `backlog/${TICKET}-one-run-at-a-time-per-ticket`);
  write(path.join(ticketDir, 'ticket.md'), `---\nid: ${TICKET}\n---\nbody\n`);
  const ticket = {
    dir: ticketDir, folder: `${TICKET}-one-run-at-a-time-per-ticket`, body: 'body\n',
    meta: {
      id: TICKET, title: 'one run at a time per ticket', stage: 'draft', owner: 'qa', repos: [],
      branch: `harness/${TICKET}/integration`, priority: 'p2', created: '2026-08-31',
      iterations: {}, history: [],
    },
  };
  return { ticket, flow, backlog: project.backlog, project, ...overrides } as unknown as RunFlowOptions;
}

/** The lock file this ticket's run holds inside `repoDir`. */
const lockFile = (repoDir: string): string => path.join(repoDir, '.quorum', 'locks', `${TICKET}.json`);

/** A lock held by somebody else, written by hand — never a second run racing this one (AC-11). */
const heldByHand = (repoDir: string, fields: Record<string, unknown> = {}): string => {
  const file = lockFile(repoDir);
  write(file, `${JSON.stringify({
    schema_version: 1, ticket_id: TICKET, run: 4, flow: 'chore', pid: 424242,
    hostname: 'another.machine.invalid', started_at: '2026-09-09T08:00:00.000Z', token: 'held-by-hand',
    ...fields,
  }, null, 2)}\n`);
  return file;
};

/** Drains the run, keeping both what it emitted and whatever it threw. */
async function settle(opts: RunFlowOptions): Promise<{ events: Event[]; error: unknown }> {
  const events: Event[] = [];
  try {
    for await (const event of runFlow(opts)) events.push(event);
    return { events, error: undefined };
  } catch (error: unknown) {
    return { events, error };
  }
}

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

describe('AC-1 — the lock is taken inside run(), after the stage check and before anything kept', () => {
  test('a stage mismatch acquires nothing at all', async () => {
    const opts = options();
    opts.ticket.meta.stage = 'requirements';
    const before = walk(opts.project.repoDir);

    const { error } = await settle(opts);

    expect((error as Error).message).toContain('consumes "draft"');
    expect(fs.existsSync(path.join(opts.project.repoDir, '.quorum')), 'a refused stage created run state').toBe(false);
    expect(walk(opts.project.repoDir)).toStrictEqual(before);
  });

  test('and a proceeding run acquires before the branch head, the start line and run history', async () => {
    // The order is the criterion: the branch head a rollback restores, the run number `runs.log`
    // carries and the worktree a run gives back must each be a fact about a run that is already the
    // only one. Recorded at the seams rather than inferred from what is on disk afterwards.
    const opts = options();
    const order: string[] = [];
    const acquireRunLock = writer.acquireRunLock;
    vi.spyOn(writer, 'acquireRunLock').mockImplementation((claim) => {
      order.push('acquire');
      return acquireRunLock(claim);
    });
    const branchHead = fanout.branchHead;
    vi.spyOn(fanout, 'branchHead').mockImplementation((dir, branch) => {
      order.push('branchHead');
      return branchHead(dir, branch);
    });
    const initialiseRunHistory = writer.initialiseRunHistory;
    vi.spyOn(writer, 'initialiseRunHistory').mockImplementation((start, host) => {
      order.push('history');
      return initialiseRunHistory(start, host);
    });
    const log = opts.backlog.log.bind(opts.backlog);
    vi.spyOn(opts.backlog, 'log').mockImplementation((ticket, line) => {
      if (line.includes(' start ')) order.push('start-line');
      log(ticket, line);
    });
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);

    const { error } = await settle(opts);

    expect(error).toBeUndefined();
    expect(order.indexOf('acquire'), 'the lock is not taken at all').toBe(0);
    for (const later of ['branchHead', 'start-line', 'history']) {
      expect(order.indexOf(later), `${later} happens before the lock is taken`).toBeGreaterThan(0);
    }
  });

  test('a caller that builds the iterable and never pulls takes no lock', async () => {
    // `runFlow` is lazy, so `run()` has not started — stated here rather than left to be discovered
    // by a caller that composed a run and abandoned it.
    const opts = options();
    const iterable = runFlow(opts);
    expect(fs.existsSync(lockFile(opts.project.repoDir))).toBe(false);
    // Drained afterwards, so the abandonment path is exercised too and the fixture leaves nothing.
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);
    for await (const _event of iterable) { /* drained */ }
    expect(fs.existsSync(lockFile(opts.project.repoDir))).toBe(false);
  });
});

describe('AC-5 — release is a finally, and it covers every way out of run()', () => {
  /** Every exit of `run()`, and how a stubbed step reaches it. */
  const EXITS: [string, (opts: RunFlowOptions) => void][] = [
    ['completed', () => { vi.spyOn(routing, 'runStep').mockResolvedValue(null); }],
    ['aborted', () => { vi.spyOn(routing, 'runStep').mockResolvedValue({ abort: true }); }],
    ['failed', () => {
      vi.spyOn(routing, 'runStep').mockImplementation(() => { throw new Error('the step went wrong'); });
    }],
    ['undecided', () => {
      vi.spyOn(routing, 'runStep').mockImplementation(() => {
        throw new GateUnansweredError('gate "approve" went unanswered', {
          kind: 'human', reason: 'approve', condition: 'stdin-closed',
        });
      });
    }],
    ['interrupted', (opts) => {
      const abort = new AbortController();
      opts.signal = abort.signal;
      vi.spyOn(routing, 'runStep').mockImplementation(async () => { abort.abort('received SIGTERM'); return null; });
    }],
    ['regressed', (opts) => {
      write(path.join(opts.project.repoDir, 'harness/flows/development.yaml'),
        'name: development\nconsumes: red\nproduces: green\nsteps:\n  - id: build\n');
      vi.spyOn(routing, 'runStep').mockResolvedValue({ goto: 'flow:development', counter: 'requirements.pm', limit: 1 });
    }],
  ];

  for (const [status, arrange] of EXITS) {
    test(`a run that ends ${status} gives its lock back`, async () => {
      const opts = options();
      arrange(opts);

      const { events } = await settle(opts);

      const terminal = events.filter((event) => event.type === 'terminal');
      expect(terminal.at(-1), `the run did not end ${status}`).toMatchObject({ type: 'terminal', status });
      expect(fs.existsSync(lockFile(opts.project.repoDir)), `an ${status} run kept its lock`).toBe(false);
    });
  }

  test('and so does a run that throws between the claim and the run try', async () => {
    // The sixth exit, which is not a status: `branchHead` and `reviewRound` run after the lock is
    // taken and before the try the catch belongs to, so a throw there reaches no terminal record at
    // all — and a release written at each exit rather than in a finally would miss exactly this one.
    const opts = options();
    vi.spyOn(fanout, 'branchHead').mockImplementation(() => { throw new Error('git went away'); });

    const { events, error } = await settle(opts);

    expect((error as Error).message).toBe('git went away');
    expect(events.filter((event) => event.type === 'terminal'), 'nothing recorded this run').toStrictEqual([]);
    expect(fs.existsSync(lockFile(opts.project.repoDir)), 'the lock outlived a run with no terminal record').toBe(false);
  });

  test('a release that fails warns and leaves the run\'s own outcome exactly as it was', async () => {
    // R-7: the status a run earned, its history entry and its exit code are authoritative. A lock
    // that could not be removed is one warning after the terminal event and nothing else.
    const opts = options();
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);
    vi.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw new Error('the disk went away'); });

    const { events, error } = await settle(opts);

    expect(error).toBeUndefined();
    expect(events.filter((event) => event.type === 'terminal')).toMatchObject([
      { type: 'terminal', status: 'completed', stageAfter: 'requirements' },
    ]);
    expect(opts.ticket.meta.stage).toBe('requirements');
    const warnings = events.filter((event) => event.type === 'warn').map((event) => event.message);
    expect(warnings.filter((message) => message.includes('could not release the run lock'))).toHaveLength(1);
    // The warning is the LAST thing said, because the release is the last thing done — and the
    // terminal event is still the terminal event.
    expect(events.at(-1)?.type).toBe('warn');
    expect(events.filter((event) => event.type === 'terminal')).toHaveLength(1);
  });
});

describe('AC-6 — a second run refuses, names the holder, and changes nothing', () => {
  test('the refusal carries the ticket, the run, the flow, the pid, the host, the time and the path', async () => {
    const opts = options();
    heldByHand(opts.project.repoDir);

    const { events, error } = await settle(opts);

    for (const fact of [TICKET, 'run #4', 'chore', '424242', 'another.machine.invalid',
      '2026-09-09T08:00:00.000Z', path.join('.quorum', 'locks', `${TICKET}.json`)]) {
      expect((error as Error).message, `the refusal does not name ${fact}`).toContain(fact);
    }
    expect(events, 'a refused run emitted a run banner').toStrictEqual([]);
  });

  test('and nothing on disk moves: no log line, no run directory, no worktree, no ticket write', async () => {
    const opts = options();
    const { repoDir } = opts.project;
    heldByHand(repoDir);
    const ticketFile = path.join(opts.ticket.dir, 'ticket.md');
    const before = { tree: walk(repoDir), ticket: fs.readFileSync(ticketFile, 'utf8') };
    const stage = opts.ticket.meta.stage;
    const step = vi.spyOn(routing, 'runStep');

    const { error } = await settle(opts);

    expect(error).toBeInstanceOf(Error);
    expect(walk(repoDir), 'a refused run changed the tree').toStrictEqual(before.tree);
    expect(fs.readFileSync(ticketFile, 'utf8')).toBe(before.ticket);
    expect(fs.existsSync(path.join(opts.ticket.dir, 'runs.log'))).toBe(false);
    expect(fs.existsSync(path.join(repoDir, '.quorum', 'runs'))).toBe(false);
    expect(fs.existsSync(path.join(repoDir, '.harness', 'worktrees'))).toBe(false);
    expect(step, 'a refused run ran a step').not.toHaveBeenCalled();
    expect(opts.ticket.meta.stage).toBe(stage);
    expect(opts.ticket.meta.history).toStrictEqual([]);
  });

  test('and a refused contender leaves no gap in the run numbers', async () => {
    const opts = options();
    const file = heldByHand(opts.project.repoDir);

    await settle(opts);
    fs.rmSync(file);
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);
    const { events } = await settle(opts);

    // The number the refused run read is never used, so the next run receives the one `nextRunId`
    // would have given it with no refusal in between.
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed', runId: 1 });
  });
});

describe('AC-8 — a dry run neither takes a lock nor is refused by one', () => {
  test('it creates none', async () => {
    const opts = options({ dry: true });
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);

    const { events } = await settle(opts);

    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    expect(fs.existsSync(path.join(opts.project.repoDir, '.quorum')), 'a dry run wrote run state').toBe(false);
  });

  test('and it walks the flow while a run holds the ticket, identically', async () => {
    // A dry run replaces every writer, skips run history and returns no worktree, so it touches
    // none of the three resources a lock serialises — and a maintainer inspecting a flow while a run
    // is in flight is the case this answers.
    const free = options({ dry: true });
    vi.spyOn(routing, 'runStep').mockResolvedValue(null);
    const unlocked = await settle(free);

    const held = options({ dry: true });
    heldByHand(held.project.repoDir);
    const locked = await settle(held);

    expect(locked.error, 'a lock refused a dry run').toBeUndefined();
    expect(locked.events.map((event) => event.type)).toStrictEqual(unlocked.events.map((event) => event.type));
    expect(locked.events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
  });
});
