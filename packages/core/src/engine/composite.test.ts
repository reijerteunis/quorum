// Q-0053 AC-1/AC-4 to AC-9/AC-12/AC-13 — the two composite step kinds, over repositories each test
// builds for itself.
//
// The three library-level blocks spike/test/smoke.js froze are ported here: :693-733's base sync
// rebuilt on `context.emit`, and the install/red-phase behaviours the CLI-driven end-to-end blocks
// (:84, :305-335, :340-365) cover there and which stay on the spike per charter §5. What those
// cannot reach at all — a fan-out's wave plan, the `extra` a child receives, the failing-task set a
// failed integrate leaves behind — is unit-level and is here for the first time in either tree.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { worktreeDirName } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { commitAll as commitTree, git, removeTempDirs, repo, write } from '../../test/repo.js';
import { Backlog } from '../backlog/backlog.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { runFanOut, runIntegrate, syncBaseIntoTicketBranch } from './composite.js';
import { runStep } from './routing.js';
import * as steps from './steps.js';
import type { RoutingContext, StepResult } from './types.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

const TICKET_ID = 'Q-0053';
const FOLDER = 'Q-0053-fanout-and-integrate';
const INTEGRATION = 'harness/Q-0053/integration';

/** What one prepared repository hands back. */
interface Fixture {
  context: RoutingContext;
  events: Event[];
  repoDir: string;
  ticketDir: string;
  /** Where a branch's worktree lands, derived through `shared` rather than re-spelled. */
  worktree(branch: string): string;
  /** Writes `harness/roles/<name>.md`, which `runTask` loads for its adapter and model defaults. */
  role(name: string, frontmatter: string): void;
  /** Writes `solution/tasks.yaml` for `loadTasks`. */
  tasks(body: string): void;
  /** Cuts `branch` from the integration branch carrying one file, and returns to `main`. */
  branchWith(branch: string, file: string, body: string): void;
}

function fixture(overrides: Partial<RoutingContext> = {}): Fixture {
  const repoDir = repo();
  const ticketDir = path.join(repoDir, 'backlog', FOLDER);
  write(path.join(ticketDir, 'ticket.md'), `---\nid: ${TICKET_ID}\n---\nbody\n`);
  // Tracked, so every worktree cut from the ticket branch holds a `backlog/` folder.
  commitTree(repoDir, 'backlog');
  git(repoDir, 'branch', INTEGRATION);
  const events: Event[] = [];
  const ticket = {
    dir: ticketDir, folder: FOLDER, body: 'body\n',
    meta: { id: TICKET_ID, title: 'fan-out and integrate', stage: 'red', branch: INTEGRATION },
  } as unknown as TicketRecord;
  const context = {
    ticket, repoDir, harnessDir: path.join(repoDir, 'harness'),
    flow: { name: 'development', consumes: 'red', produces: 'green', steps: [] },
    config: { repo: { base_branch: 'main' } },
    backlog: new Backlog(path.join(repoDir, 'backlog')), runId: 4,
    counters: {}, vars: { id: TICKET_ID, iter: 1, run: 4, base: 'main' },
    stats: { cost: 0, tokens: 0, unpriced: 0 }, dry: false, auto: false,
    emit: (event: Event) => events.push(event),
    persistence: {
      writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(),
      allocateOccurrence: vi.fn(() => ({ step_id: 'integrate', occurrence_dir: 'steps/001-integrate' })),
      persistArtifact: vi.fn(), terminalOccurrence: vi.fn(),
      finaliseManifest: vi.fn(), finaliseActiveOccurrences: vi.fn(),
    },
    nextGateId: () => '4:1', loadNamedFlow: vi.fn(), finishRun: vi.fn(),
    diffInputs: new Map(), deferredDiffs: new Map(), baseOverride: null,
    ...overrides,
  } as unknown as RoutingContext;

  return {
    context, events, repoDir, ticketDir,
    worktree: (branch) => path.join(repoDir, '.harness', 'worktrees', worktreeDirName(branch)),
    // Two segments, not one literal: `harness/roles` is a real repository path, and spelling it
    // whole would make this fixture name one — which clause B collects and a register would then
    // have to excuse. The directory this writes into is inside the temp repository.
    role: (name, frontmatter) => write(path.join(repoDir, 'harness', 'roles', `${name}.md`), `---\n${frontmatter}---\nA role.\n`),
    tasks: (body) => write(path.join(ticketDir, 'solution/tasks.yaml'), body),
    branchWith(branch, file, body) {
      git(repoDir, 'checkout', '-q', '-b', branch, INTEGRATION);
      write(path.join(repoDir, file), body);
      // Only the named file is staged. `add -A` would sweep up the untracked `solution/tasks.yaml`
      // a fan-out test wrote, commit it onto this branch, and take it away again on the way back to
      // `main` — which is a fixture quietly deleting its own subject.
      git(repoDir, 'add', '--', file);
      git(repoDir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', `${branch}: ${file}`);
      git(repoDir, 'checkout', '-q', 'main');
    },
  };
}

const infos = (events: Event[]): string[] => events.filter((e) => e.type === 'info').map((e) => e.message);
const warns = (events: Event[]): string[] => events.filter((e) => e.type === 'warn').map((e) => e.message);

/** Two independent tasks in one wave, and the same two with a dependency edge between them. */
const TWO_TASKS = 'tasks:\n  - id: t1\n    role: backend\n    title: first\n    depends_on: []\n'
  + '  - id: t2\n    role: tooling\n    title: second\n    depends_on: []\n';
const TWO_WAVES = 'tasks:\n  - id: t1\n    role: backend\n    title: first\n    depends_on: []\n'
  + '  - id: t2\n    role: tooling\n    title: second\n    depends_on: [t1]\n';

/** Replaces `runAgentStep` for a fan-out test, recording what each child was handed. */
function childCalls(answer: (index: number) => StepResult = () => null): {
  calls: { step: Record<string, unknown>; extra: steps.AgentStepExtra }[];
} {
  const calls: { step: Record<string, unknown>; extra: steps.AgentStepExtra }[] = [];
  vi.spyOn(steps, 'runAgentStep').mockImplementation((step, _context, extra = {}) => {
    calls.push({ step: { ...step }, extra });
    return Promise.resolve(answer(calls.length));
  });
  return { calls };
}

describe('Q-0053 AC-1 — both composite kinds dispatch through runStep', () => {
  test('an integrate step reaches runIntegrate rather than the agent step', async () => {
    // Behavioural rather than a spy: the `step` event's message is `runIntegrate`'s own, and no
    // adapter is resolved, which is what a fall-through to `runAgentStep` would have done.
    const f = fixture({ dry: true });
    await expect(runStep({ id: 'integrate', type: 'integrate', branches: [] }, f.context)).resolves.toBeNull();
    expect(f.events).toStrictEqual([{ type: 'step', stepId: 'integrate', message: `integrate → ${INTEGRATION}` }]);
  });

  test('a fan-out step reaches runFanOut rather than the agent step', async () => {
    const f = fixture();
    f.tasks('tasks: []\n');
    await expect(runStep({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context))
      .rejects.toThrow('dev: no tasks to fan out');
  });

  test('script still wins over integrate, and a gate over both — the spike\'s order is unmoved', async () => {
    const f = fixture({ dry: true });
    await expect(runStep({ id: 's', type: 'script', run: 'true', gate: 'human' }, f.context)).resolves.toBeNull();
    expect(f.events.some((e) => e.type === 'info' && e.message.includes('would pause here'))).toBe(true);
  });
});

describe('Q-0053 AC-4 — the ticket branch catches up with the base before worktrees are cut', () => {
  test('work landed on the base is present on the ticket branch before any worktree is cut', () => {
    // spike/test/smoke.js:693-733, rebuilt on `context.emit`. Q-0006 run 11 lost its runtime task
    // because the base moved after the ticket branch was cut and nothing caught it up.
    const f = fixture();
    write(path.join(f.repoDir, 'landed.txt'), 'landed on main\n');
    commitTree(f.repoDir, 'landed on main');
    const step = { id: 'developers', step: { base: INTEGRATION } };

    expect(syncBaseIntoTicketBranch(step, f.context)).toStrictEqual({ ok: true });

    expect(git(f.repoDir, 'ls-tree', '--name-only', INTEGRATION).split('\n')).toContain('landed.txt');
    expect(infos(f.events)).toStrictEqual([`developers: ${INTEGRATION} synced to main before fan-out`]);
  });

  test('a ticket with no integration branch yet is skipped, not failed', () => {
    const f = fixture();
    const step = { id: 'developers', step: { base: 'harness/Q-0053/nobody-created-this' } };
    expect(syncBaseIntoTicketBranch(step, f.context))
      .toStrictEqual({ skipped: 'harness/Q-0053/nobody-created-this does not exist yet' });
    expect(f.events).toStrictEqual([]);
  });

  test('a base that is the target, or that is empty, is skipped before git is asked', () => {
    const f = fixture({ config: { repo: { base_branch: INTEGRATION } } });
    expect(syncBaseIntoTicketBranch({ id: 'developers', step: {} }, f.context))
      .toStrictEqual({ skipped: 'base is the ticket branch' });

    const empty = fixture({ config: { repo: { base_branch: '' } } });
    expect(syncBaseIntoTicketBranch({ id: 'developers', step: {} }, empty.context))
      .toStrictEqual({ skipped: 'base is the ticket branch' });
  });

  test('a base branch that is not there is skipped, and named', () => {
    const f = fixture({ config: { repo: { base_branch: 'release-9' } } });
    expect(syncBaseIntoTicketBranch({ id: 'developers', step: {} }, f.context))
      .toStrictEqual({ skipped: 'release-9 does not exist' });
  });

  test('a genuine base conflict throws and names the work a human must do', () => {
    const f = fixture();
    const step = { id: 'developers', step: { base: INTEGRATION } };
    // The ticket-side edit is made in the worktree the sync creates: git will not check the same
    // branch out twice, which is the whole reason worktrees exist.
    expect(syncBaseIntoTicketBranch(step, f.context)).toStrictEqual({ ok: true });
    const worktree = f.worktree(INTEGRATION);
    write(path.join(worktree, 'shared.txt'), 'ticket side\n');
    commitTree(worktree, 'ticket edit');
    write(path.join(f.repoDir, 'shared.txt'), 'base side\n');
    commitTree(f.repoDir, 'base edit');

    expect(() => syncBaseIntoTicketBranch(step, f.context))
      .toThrow(/no agent in this loop can repair a base conflict/);
    // …and it says WHY, rather than trailing off after the dash.
    expect(() => syncBaseIntoTicketBranch(step, f.context)).toThrow(/conflicts: shared\.txt/);
  });

  test('the fan-out performs the sync, and a dry fan-out does not', async () => {
    const f = fixture({ dry: true });
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: claude\n');
    childCalls();
    write(path.join(f.repoDir, 'landed.txt'), 'landed\n');
    commitTree(f.repoDir, 'landed');

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(git(f.repoDir, 'ls-tree', '--name-only', INTEGRATION)).not.toContain('landed.txt');
    expect(fs.existsSync(f.worktree(INTEGRATION))).toBe(false);
  });
});

describe('Q-0053 AC-5/AC-6 — the fan-out selects, plans, clones and merges between waves', () => {
  test('AC-5 — one wave per dependency level, announced in order, with its members named', async () => {
    const f = fixture();
    f.tasks(TWO_WAVES);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    f.branchWith('harness/Q-0053/t1', 'from-t1.txt', 'first wave\n');
    childCalls();

    await expect(runFanOut({ id: 'dev', fan_out: { respect: 'depends_on' }, step: { id: 'dev:{task.id}' } }, f.context))
      .resolves.toBeNull();

    expect(infos(f.events)).toEqual(expect.arrayContaining([
      'dev: 2 task(s) in 2 wave(s)',
      'dev: wave 1: t1(backend)',
      'dev: wave 2: t2(tooling)',
    ]));
    // The inter-wave merge really happened: wave 2 builds on wave 1's work.
    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'from-t1.txt'))).toBe(true);
  });

  test('AC-5 — anything but depends_on is one wave', async () => {
    const f = fixture();
    f.tasks(TWO_WAVES);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    childCalls();

    await runFanOut({ id: 'dev', fan_out: { respect: 'role' }, step: { id: 'dev:{task.id}' } }, f.context);

    expect(infos(f.events)).toContain('dev: 2 task(s) in 1 wave(s)');
    expect(infos(f.events)).toContain('dev: wave 1: t1(backend) t2(tooling)');
  });

  test('AC-5 — selection narrows to the failing tasks, and says which', async () => {
    const f = fixture({ failingTasks: new Set(['t2']) });
    f.tasks(TWO_TASKS);
    f.role('developer-tooling', 'adapter: codex\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: { scope: 'failing-tasks-only' }, step: { id: 'dev:{task.id}' } }, f.context);

    expect(warns(f.events)).toContain('dev: scoped to failing tasks: t2');
    expect(calls.map((call) => call.step.id)).toStrictEqual(['dev:t2']);
  });

  test('AC-5 — an EMPTY failing set does not narrow anything', async () => {
    // The half `?.size` decides: `failingTasks` is `null` after a green integrate and an empty set
    // is not a reason to run nothing. Without the size test this fans out zero tasks and throws.
    const f = fixture({ failingTasks: new Set<string>() });
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: { scope: 'failing-tasks-only' }, step: { id: 'dev:{task.id}' } }, f.context);

    expect(calls).toHaveLength(2);
    expect(warns(f.events)).toStrictEqual([]);
  });

  test('AC-5 — no task at all is a stop, not an empty success', async () => {
    const f = fixture();
    f.tasks('tasks: []\n');
    await expect(runFanOut({ id: 'dev', fan_out: {}, step: {} }, f.context)).rejects.toThrow('dev: no tasks to fan out');
  });

  test('AC-5 — a member returning goto short-circuits the waves after it', async () => {
    const f = fixture();
    f.tasks(TWO_WAVES);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    const { calls } = childCalls(() => ({ goto: 'implement', counter: 'c', limit: 2 }));

    await expect(runFanOut({ id: 'dev', fan_out: { respect: 'depends_on' }, step: { id: 'dev:{task.id}' } }, f.context))
      .resolves.toStrictEqual({ goto: 'implement', counter: 'c', limit: 2 });

    expect(calls.map((call) => call.step.id)).toStrictEqual(['dev:t1']);
  });

  test('AC-5 — an abort short-circuits too, and a plain null does not', async () => {
    const aborting = fixture();
    aborting.tasks(TWO_WAVES);
    aborting.role('developer-backend', 'adapter: claude\n');
    aborting.role('developer-tooling', 'adapter: codex\n');
    const first = childCalls(() => ({ abort: true }));
    await expect(runFanOut({ id: 'dev', fan_out: { respect: 'depends_on' }, step: { id: 'dev:{task.id}' } }, aborting.context))
      .resolves.toStrictEqual({ abort: true });
    expect(first.calls).toHaveLength(1);

    vi.restoreAllMocks();
    const passing = fixture();
    passing.tasks(TWO_WAVES);
    passing.role('developer-backend', 'adapter: claude\n');
    passing.role('developer-tooling', 'adapter: codex\n');
    const second = childCalls(() => null);
    await expect(runFanOut({ id: 'dev', fan_out: { respect: 'depends_on' }, step: { id: 'dev:{task.id}' } }, passing.context))
      .resolves.toBeNull();
    expect(second.calls).toHaveLength(2);
  });

  test('AC-5 — a rejected task rejects the whole wave', async () => {
    // `Promise.all`, not `allSettled`: a child that threw is a run-level failure, and swallowing it
    // would let the next wave build on a tree the first never produced.
    const f = fixture();
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    vi.spyOn(steps, 'runAgentStep').mockImplementation((step) =>
      String(step.id) === 'dev:t2' ? Promise.reject(new Error('the vendor died')) : Promise.resolve(null));

    await expect(runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context))
      .rejects.toThrow('the vendor died');
  });

  test('AC-6 — the template is cloned per task, so one task\'s interpolated id cannot leak', async () => {
    const f = fixture();
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\nmodel: opus\n');
    f.role('developer-tooling', 'adapter: codex\n');
    const template = { id: 'dev:{task.id}', branch: 'harness/{id}/{task.id}', adapter: '{role.adapter}', model: '{role.model}' };
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: template }, f.context);

    // Both ids resolved from the SAME template. Shared and mutated, the second reads `dev:t1`.
    expect(calls.map((call) => call.step.id)).toStrictEqual(['dev:t1', 'dev:t2']);
    expect(calls.map((call) => call.step.role)).toStrictEqual(['developer-backend', 'developer-tooling']);
    // The template's `branch` is handed on UNINTERPOLATED — the fan-out's own interpolation goes
    // into `fanned` and nowhere else, and the agent step resolves the template again for itself.
    expect(calls.map((call) => call.step.branch)).toStrictEqual(['harness/{id}/{task.id}', 'harness/{id}/{task.id}']);
    // The sentinels fall through to each role file's own frontmatter.
    expect(calls.map((call) => call.step.adapter)).toStrictEqual(['claude', 'codex']);
    expect(calls.map((call) => call.step.model)).toStrictEqual(['opus', undefined]);
    expect(calls.every((call) => call.step.worktree === true)).toBe(true);
    // …and the declaration the run holds is untouched.
    expect(template.id).toBe('dev:{task.id}');
  });

  test('AC-6 — an undefined-valued template key is DROPPED, which is the JSON round trip\'s signature', async () => {
    // The discriminator against `structuredClone`, which keeps such a key. `branch` is the one field
    // the fan-out reads and never writes back, so the key's presence is observable on the child.
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', 'adapter: claude\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}', branch: undefined } }, f.context);

    expect(Object.keys(calls[0]!.step)).not.toContain('branch');
    expect(f.context.fanned?.map((entry) => entry.branch)).toStrictEqual(['harness/Q-0053/t1']);
  });

  test('AC-6 — an absent adapter falls back to the role file, then to claude', async () => {
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', '');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(calls[0]!.step.adapter).toBe('claude');
    expect(calls[0]!.step.model).toBeUndefined();
  });

  test('AC-6 — the default id and role templates are the spike\'s', async () => {
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', 'adapter: claude\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: {} }, f.context);

    expect(calls[0]!.step.id).toBe('dev:t1');
    expect(calls[0]!.step.role).toBe('developer-backend');
  });

  test('AC-6 — all three fields of the landed AgentStepExtra are supplied, and none is reshaped', async () => {
    const f = fixture({ lastIntegration: `previous notes\n${'z'.repeat(5000)}` });
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n    description: owns a.ts\n');
    f.role('developer-backend', 'adapter: claude\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    const { extra } = calls[0]!;
    expect(extra.vars).toStrictEqual({ 'task.id': 't1', 'task.role': 'backend', 'task.title': 'first', role: 'backend' });
    expect(extra.syncBase).toBe(true);
    const suffix = extra.promptSuffix!('/tmp/somewhere');
    expect(suffix).toContain('# Task t1 (backend): first');
    expect(suffix).toContain('owns a.ts');
    expect(suffix).toContain('## Previous integration result');
    // Capped at 4,000 characters of the previous integration, and no more.
    expect(suffix.split('## Previous integration result\n\n')[1]).toHaveLength(4000);
  });

  test('AC-6 — with no previous integration the suffix is the task section alone', async () => {
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', 'adapter: claude\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(calls[0]!.extra.promptSuffix!('/tmp/somewhere')).not.toContain('Previous integration result');
  });

  test('AC-6 — fanned records the task\'s OWN role, not the developer- role the template built', async () => {
    const f = fixture();
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(f.context.fanned).toStrictEqual([
      { task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' },
      { task: 't2', branch: 'harness/Q-0053/t2', role: 'tooling' },
    ]);
  });

  test('AC-14(1)/(2) — the inter-wave merge re-derives the branch name and only warns when it fails', async () => {
    // The preserved defect, pinned so a later change is deliberate: the merge uses
    // `harness/<id>/<task>` rather than the branch recorded in `fanned`, so a template spelling the
    // branch differently merges a ref that may not exist — and the failure is a warning, so the next
    // wave builds on a tree missing its predecessor's work.
    const f = fixture();
    f.tasks(TWO_WAVES);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    f.branchWith('task/t1', 'from-t1.txt', 'first wave\n');
    childCalls();

    await expect(runFanOut(
      { id: 'dev', fan_out: { respect: 'depends_on' }, step: { id: 'dev:{task.id}', branch: 'task/{task.id}' } },
      f.context,
    )).resolves.toBeNull();

    expect(f.context.fanned?.map((entry) => entry.branch)).toStrictEqual(['task/t1', 'task/t2']);
    expect(warns(f.events).join('\n')).toContain('dev: wave merge conflict on t1:');
    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'from-t1.txt'))).toBe(false);
  });

  test('AC-14 — a template with no `branch` records one name and the child cuts another', async () => {
    // Found by porting rather than inherited from the criterion, preserved and reported. The
    // fan-out's computed branch is written to `fanned` alone, so with no `branch:` in the template
    // the record and the worktree disagree — and the child's own default carries the `:` from the
    // default step id, which git refuses outright. Latent: every shipped fan-out spells `branch:`.
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', 'adapter: claude\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(f.context.fanned?.[0]?.branch).toBe('harness/Q-0053/t1');
    expect(calls[0]!.step.branch).toBeUndefined();
    // What the child then derives for itself, which is neither that name nor a legal one.
    expect(() => git(f.repoDir, 'check-ref-format', '--branch', `harness/Q-0053/${String(calls[0]!.step.id)}`)).toThrow();
  });

  test('AC-5 — a single wave performs no inter-wave merge at all', async () => {
    // The worktree still exists afterwards, because the base sync creates it. What must not happen
    // is a merge: with one wave there is no predecessor for anything to build on.
    const f = fixture();
    f.tasks(TWO_TASKS);
    f.role('developer-backend', 'adapter: claude\n');
    f.role('developer-tooling', 'adapter: codex\n');
    f.branchWith('harness/Q-0053/t1', 'from-t1.txt', 'first\n');
    childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}' } }, f.context);

    expect(warns(f.events)).toStrictEqual([]);
    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'from-t1.txt'))).toBe(false);
  });
});

describe('Q-0053 AC-7 — integrate resolves its target and branch list, and records the evidence', () => {
  test('AC-7 — the notes header, the target and both evidence lines, in the documented order', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    const step = {
      id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'],
      output: { write: 'dev/integration.md' },
    };

    // Read BEFORE the run: merging a branch moves the target, so a sha taken afterwards is a
    // different one and the assertion would be pinning nothing.
    const head = git(f.repoDir, 'rev-parse', INTEGRATION).slice(0, 7);
    const forked = git(f.repoDir, 'merge-base', INTEGRATION, 'harness/Q-0053/t1').slice(0, 7);

    await expect(runIntegrate(step, f.context)).resolves.toBeNull();

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/integration.md'), 'utf8');
    expect(notes.split('\n').slice(0, 6)).toStrictEqual([
      '# Integration — run 4, iteration 1',
      '',
      `Target: \`${INTEGRATION}\``,
      '',
      `Evidence: \`${INTEGRATION}\` at ${head}, base \`main\`.`,
      `Evidence: \`harness/Q-0053/t1\` diverges from \`${INTEGRATION}\` at ${forked}.`,
    ]);
    expect(notes).toContain('- ✓ harness/Q-0053/t1');
  });

  test('AC-7 — a target that did not exist is CREATED first, so the evidence names its sha', async () => {
    // Reported, not fixed (charter §2): the `(new)` fallback the spike writes for an absent target
    // is unreachable through this path, because `ticketWorktree` creates the branch two statements
    // above the read. Pinned as it behaves rather than as the string suggests, so a later change to
    // either ordering is a deliberate act. See the implement report.
    const f = fixture();
    const step = { id: 'integrate', type: 'integrate', into: 'harness/{id}/fresh', branches: [], output: { write: 'dev/i.md' } };

    await runIntegrate(step, f.context);

    const head = git(f.repoDir, 'rev-parse', 'harness/Q-0053/fresh').slice(0, 7);
    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes).toContain(`Evidence: \`harness/Q-0053/fresh\` at ${head}, base \`main\`.`);
    expect(notes).not.toContain('(new)');
  });

  test('AC-7 — a glob resolves against fanned branches, de-duplicated, preserving first-seen order', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    f.branchWith('harness/Q-0053/t2', 'b.txt', 'b\n');
    f.context.fanned = [
      { task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' },
      { task: 't2', branch: 'harness/Q-0053/t2', role: 'tooling' },
      { task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' },
    ];
    const step = { id: 'integrate', type: 'integrate', branches: 'harness/{id}/*', output: { write: 'dev/i.md' } };

    await runIntegrate(step, f.context);

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes.split('\n').filter((line) => line.startsWith('- ✓ harness/'))).toStrictEqual([
      '- ✓ harness/Q-0053/t1', '- ✓ harness/Q-0053/t2',
    ]);
    // A glob names no branch explicitly, so the evidence loop has nothing to ask about.
    expect(notes).not.toContain('diverges from');
  });

  test('AC-7 — a scalar that is not a glob is a one-element list, and an absent branch is dropped', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    const listed = { id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1', 'harness/{id}/nobody'], output: { write: 'dev/i.md' } };

    await runIntegrate(listed, f.context);

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes).toContain('- ✓ harness/Q-0053/t1');
    expect(notes).not.toContain('- ✓ harness/Q-0053/nobody');
    // AC-12: `merged=` counts the FILTERED list, so the dropped branch is not a missing merge.
    expect(vi.mocked(f.context.persistence.appendLog)).toHaveBeenCalledWith(f.context.ticket,
      'run=4 step=integrate merged=1/1 tests=-');
  });

  test('AC-14(5) — the evidence loop asks about a branch the filter dropped as absent', async () => {
    // The preserved defect: the loop reads the DECLARED list, not the filtered one. `mergeBase`
    // answers `null` for a ref that is not there, so nothing is printed — but git was still asked.
    const f = fixture();
    const step = { id: 'integrate', type: 'integrate', branches: ['harness/{id}/nobody'], output: { write: 'dev/i.md' } };

    await runIntegrate(step, f.context);

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes).not.toContain('diverges from');
    expect(notes).toContain('Evidence: `harness/Q-0053/integration` at');
  });

  test('AC-7 — a dry run reports the step and does nothing else at all', async () => {
    const f = fixture({ dry: true });
    const before = fs.readdirSync(f.ticketDir).sort();
    const step = { id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'], output: { write: 'dev/i.md' } };

    await expect(runIntegrate(step, f.context)).resolves.toBeNull();

    expect(f.events).toStrictEqual([{ type: 'step', stepId: 'integrate', message: `integrate → ${INTEGRATION}` }]);
    expect(vi.mocked(f.context.persistence.allocateOccurrence)).not.toHaveBeenCalled();
    expect(vi.mocked(f.context.persistence.appendLog)).not.toHaveBeenCalled();
    expect(fs.readdirSync(f.ticketDir).sort()).toStrictEqual(before);
    expect(fs.existsSync(path.join(f.repoDir, '.harness', 'worktrees'))).toBe(false);
  });

  test('AC-7 — a run keeping no history integrates nothing', async () => {
    const f = fixture();
    vi.mocked(f.context.persistence.allocateOccurrence).mockReturnValue(null);
    await expect(runIntegrate({ id: 'integrate', type: 'integrate', branches: [] }, f.context)).resolves.toBeNull();
    expect(fs.existsSync(path.join(f.repoDir, '.harness', 'worktrees'))).toBe(false);
  });
});

describe('Q-0053 AC-8 — a base conflict stops the run rather than looping', () => {
  test('the artifacts and the log line are on disk BEFORE the throw, and no iteration is spent', async () => {
    // Q-0011 spent its whole budget and $8.63 rediscovering this conflict three times: the task
    // worktrees branch from the ticket branch, where nothing is wrong, so the agents correctly change
    // nothing and the conflict comes back unchanged.
    const f = fixture();
    git(f.repoDir, 'checkout', '-q', INTEGRATION);
    write(path.join(f.repoDir, 'shared.txt'), 'ticket side\n');
    commitTree(f.repoDir, 'ticket edit');
    git(f.repoDir, 'checkout', '-q', 'main');
    write(path.join(f.repoDir, 'shared.txt'), 'base side\n');
    commitTree(f.repoDir, 'base edit');
    const step = {
      id: 'integrate', type: 'integrate', branches: [], output: { write: 'dev/i.md' },
      on_fail: { goto: 'developers', max_iterations: 3, counter: 'development.integrate' },
    };

    const error = await runIntegrate(step, f.context).then(() => undefined, (cause: unknown) => cause);

    expect((error as Error).message).toContain('This is a conflict between the ticket branch and main');
    expect((error as Error).message).toContain(`their worktrees branch from ${INTEGRATION}, where nothing is wrong`);
    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes).toContain('- ✗ base `main` — conflicts: shared.txt');
    expect(vi.mocked(f.context.persistence.appendLog)).toHaveBeenCalledWith(f.context.ticket,
      'run=4 step=integrate base-conflict base=main files=shared.txt');
    // No backward edge, no handleFail, no iteration consumed.
    expect(f.context.counters).toStrictEqual({});
    expect(warns(f.events)).toContain('integrate: could not sync base main — conflicts: shared.txt');
  });

  test('AC-14(7) — the throw leaves its occurrence open, which review round 1 asked to be closed', async () => {
    // Pinned rather than argued. The spike does the same (spike/src/engine.js:1113-1120: the
    // artifacts and the log line, then the throw), and `finalise` sweeps nothing, so the manifest
    // keeps this step at `running` with no `output.txt`. AC-12's clauses are scoped by their own
    // citation to the tail block and its `merged=…` line, which this path does not reach — it
    // writes `base-conflict` instead, per AC-8. Charter §2 therefore refuses the repair and this
    // test is what makes a later one deliberate. See the implement report.
    const f = fixture();
    git(f.repoDir, 'checkout', '-q', INTEGRATION);
    write(path.join(f.repoDir, 'shared.txt'), 'ticket side\n');
    commitTree(f.repoDir, 'ticket edit');
    git(f.repoDir, 'checkout', '-q', 'main');
    write(path.join(f.repoDir, 'shared.txt'), 'base side\n');
    commitTree(f.repoDir, 'base edit');

    await expect(runIntegrate({ id: 'integrate', type: 'integrate', branches: [], output: { write: 'dev/i.md' } }, f.context))
      .rejects.toThrow(/cannot sync/);

    expect(vi.mocked(f.context.persistence.allocateOccurrence)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(f.context.persistence.persistArtifact)).not.toHaveBeenCalled();
    expect(vi.mocked(f.context.persistence.terminalOccurrence)).not.toHaveBeenCalled();
  });

  test('the base is merged before any source branch', async () => {
    const f = fixture();
    write(path.join(f.repoDir, 'landed.txt'), 'landed on main\n');
    commitTree(f.repoDir, 'landed on main');
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    const step = { id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'], output: { write: 'dev/i.md' } };

    await runIntegrate(step, f.context);

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8').split('\n');
    expect(notes.indexOf('- ✓ base `main`')).toBeLessThan(notes.indexOf('- ✓ harness/Q-0053/t1'));
    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'landed.txt'))).toBe(true);
  });
});

describe('Q-0053 AC-9 — install before test, and neither a kill nor a broken environment is a result', () => {
  /** A step declaring a bound, so every cell can assert that no iteration was spent on it. */
  const bounded = (extra: Record<string, unknown>): Record<string, unknown> => ({
    id: 'integrate', type: 'integrate', branches: [], output: { write: 'dev/i.md' },
    on_fail: { goto: 'developers', max_iterations: 3, counter: 'development.integrate' },
    ...extra,
  });

  test('(a) install runs in the worktree, before the test command, and the test command sees it', async () => {
    // spike/test/smoke.js:84's shape at unit level. A worktree is a fresh checkout with no
    // node_modules; without the install the test command dies on a missing dependency and
    // `expect: fail` reads exit 1 as proof of red — on every ticket, forever.
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { install: 'printf x > marker.txt', test: 'test -f marker.txt' } } });

    await expect(runIntegrate(bounded({ run_tests: true }), f.context)).resolves.toBeNull();

    const notes = fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8');
    expect(notes).toContain('Install: `printf x > marker.txt` → exit 0');
    expect(notes).toContain('Tests: `test -f marker.txt` → exit 0 (expected pass) → OK');
    expect(infos(f.events)).toContain('integrate: install exit 0');
  });

  test('(a) a failing install stops the run and the test command is never spawned', async () => {
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { install: 'exit 7', test: 'printf ran > ran.txt' } } });

    const error = await runIntegrate(bounded({ run_tests: true }), f.context).then(() => undefined, (cause: unknown) => cause);

    expect((error as Error).message).toContain('integrate: install failed (`exit 7` exited 7)');
    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'ran.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8')).not.toContain('Tests: ');
    expect(f.context.counters).toStrictEqual({});
    expect(warns(f.events)).toContain('integrate: install exit 7');
  });

  test('(c) a genuine non-zero exit under expect: fail IS a red phase', async () => {
    const f = fixture();

    await expect(runIntegrate(bounded({ run_tests: 'node -e "process.exit(1)"', expect: 'fail' }), f.context))
      .resolves.toBeNull();

    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8')).toContain('(expected fail) → OK');
    expect(f.events.filter((e) => e.type === 'done')).toStrictEqual([
      { type: 'done', stepId: 'integrate', message: `0 branch(es) on ${INTEGRATION}, tests red as expected` },
    ]);
  });

  test('(c) the same exit code from a suite that could not START is INVALID, and throws', async () => {
    // Register row 7's second clause. Non-zero because the suite never ran is not a red phase, and
    // this is the one cell that separates the two — the exit code is identical to the row above.
    const f = fixture();

    const error = await runIntegrate(bounded({ run_tests: `node -e "require('./nope.js')"`, expect: 'fail' }), f.context)
      .then(() => undefined, (cause: unknown) => cause);

    expect((error as Error).message).toContain('the suite never ran — missing module "./nope.js"');
    expect((error as Error).message).toContain('fix the environment (commands.install in harness.yaml) and re-run');
    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8')).toContain('(expected fail) → INVALID');
    expect(vi.mocked(f.context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'failed', {
      error: { category: 'integrate', message: 'integrate: the suite never ran — missing module "./nope.js"' },
    });
    expect(f.context.counters).toStrictEqual({});
  });

  test('(c) a killed command reports the kill, in the project\'s own minutes, and throws', async () => {
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { timeout_ms: 50 } } });

    const error = await runIntegrate(bounded({ run_tests: 'sleep 5', expect: 'fail' }), f.context)
      .then(() => undefined, (cause: unknown) => cause);

    expect((error as Error).message)
      .toContain('the suite never ran — the test command did not finish within 0 minutes and was killed');
    expect(f.context.counters).toStrictEqual({});
  });

  test('(b) with no command resolved, neither install nor test runs and the log says so', async () => {
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { install: 'printf x > marker.txt', test: 'true' } } });

    await expect(runIntegrate(bounded({ run_tests: false }), f.context)).resolves.toBeNull();

    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'marker.txt'))).toBe(false);
    expect(vi.mocked(f.context.persistence.appendLog)).toHaveBeenCalledWith(f.context.ticket,
      'run=4 step=integrate merged=0/0 tests=-');
  });

  test('(b) a conflict stops the install and the test command from running at all', async () => {
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { install: 'printf x > marker.txt', test: 'true' } } });
    f.branchWith('harness/Q-0053/t1', 'shared.txt', 'one side\n');
    f.branchWith('harness/Q-0053/t2', 'shared.txt', 'other side\n');

    await expect(runIntegrate(bounded({ branches: ['harness/{id}/t1', 'harness/{id}/t2'], run_tests: true }), f.context))
      .resolves.toStrictEqual({ goto: 'developers', counter: 'development.integrate', limit: 3 });

    expect(fs.existsSync(path.join(f.worktree(INTEGRATION), 'marker.txt'))).toBe(false);
    // `tests=ok` for a suite that never ran, which is the preserved defect the marker in
    // `composite.ts` names: `testsOk` is initialised true and only the test block ever clears it.
    expect(vi.mocked(f.context.persistence.appendLog)).toHaveBeenCalledWith(f.context.ticket,
      'run=4 step=integrate merged=1/2 tests=ok');
  });
});

describe('Q-0053 AC-12 — every terminal outcome is written, and the artifact routing is preserved', () => {
  test('a path containing "report" receives the test report, and every other path the notes', async () => {
    // What routes `dev/green-report.md` and `dev/integration.md` differently in development.yaml:27.
    const f = fixture();

    await runIntegrate({
      id: 'integrate', type: 'integrate', branches: [], run_tests: 'printf "✓ one check\\n"',
      output: { write: 'dev/integration.md', writes: ['dev/green-report.md'] },
    }, f.context);

    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/integration.md'), 'utf8')).toContain('# Integration — run 4');
    const report = fs.readFileSync(path.join(f.ticketDir, 'dev/green-report.md'), 'utf8');
    expect(report).toContain('# Test output');
    expect(report).toContain('✓ one check');
  });

  test('output.txt is persisted always, empty included, and the occurrence completes', async () => {
    const f = fixture();

    await runIntegrate({ id: 'integrate', type: 'integrate', branches: [] }, f.context);

    expect(vi.mocked(f.context.persistence.persistArtifact)).toHaveBeenCalledWith(expect.anything(), 'output.txt', '');
    expect(vi.mocked(f.context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'completed');
    expect(f.context.failingTasks).toBeNull();
  });

  test('an unmet expectation fails the occurrence, keeps the last integration, and takes the edge', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    f.context.fanned = [
      { task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' },
      { task: 't2', branch: 'harness/Q-0053/t2', role: 'tooling' },
    ];

    await expect(runIntegrate({
      id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'], run_tests: 'printf "✗ one\\n"; exit 1',
      output: { write: 'dev/i.md' }, on_fail: { goto: 'developers', max_iterations: 3, counter: 'development.integrate' },
    }, f.context)).resolves.toStrictEqual({ goto: 'developers', counter: 'development.integrate', limit: 3 });

    expect(vi.mocked(f.context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'failed', {
      error: { category: 'integrate', message: 'integrate: tests did not meet expectation' },
    });
    expect(vi.mocked(f.context.persistence.appendLog)).toHaveBeenCalledWith(f.context.ticket,
      'run=4 step=integrate merged=1/1 tests=fail');
    // Tests failed without a conflict, so every fanned task is re-run: the agents need the output.
    expect([...f.context.failingTasks!]).toStrictEqual(['t1', 't2']);
    expect(f.context.lastIntegration).toContain('# Integration — run 4');
    expect(f.context.lastIntegration).toContain('✗ one');
  });

  test('a conflict fails the occurrence and narrows the failing set to the conflicting tasks', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    f.branchWith('harness/Q-0053/t2', 'shared.txt', 'one side\n');
    f.branchWith('harness/Q-0053/t3', 'shared.txt', 'other side\n');
    f.context.fanned = [
      { task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' },
      { task: 't2', branch: 'harness/Q-0053/t2', role: 'tooling' },
      { task: 't3', branch: 'harness/Q-0053/t3', role: 'backend' },
    ];

    await expect(runIntegrate({
      id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1', 'harness/{id}/t2', 'harness/{id}/t3'],
      run_tests: true, output: { write: 'dev/i.md' },
    }, f.context)).resolves.toStrictEqual({ abort: true });

    expect(vi.mocked(f.context.persistence.terminalOccurrence)).toHaveBeenCalledWith(expect.anything(), 'failed', {
      error: { category: 'integrate', message: 'integrate: integration conflicts: harness/Q-0053/t3' },
    });
    expect([...f.context.failingTasks!]).toStrictEqual(['t3']);
  });

  test('a conflicting branch fanned knows nothing about is DROPPED, never an undefined task id', async () => {
    // The `.filter(Boolean)` half, which an implementation mapping straight through loses: an
    // unknown branch would put `undefined` into the set a later fan-out scopes itself by.
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'shared.txt', 'one side\n');
    f.branchWith('harness/Q-0053/stray', 'shared.txt', 'other side\n');
    f.context.fanned = [{ task: 't1', branch: 'harness/Q-0053/t1', role: 'backend' }];

    await expect(runIntegrate({
      id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1', 'harness/{id}/stray'], output: { write: 'dev/i.md' },
    }, f.context)).resolves.toStrictEqual({ abort: true });

    expect([...f.context.failingTasks!]).toStrictEqual([]);
  });

  test('a failing integrate with no on_fail aborts rather than looping', async () => {
    const f = fixture();
    await expect(runIntegrate({ id: 'integrate', type: 'integrate', branches: [], run_tests: 'exit 1' }, f.context))
      .resolves.toStrictEqual({ abort: true });
    expect(f.context.counters).toStrictEqual({});
  });

  test('a green integrate names its branches and clears the failing set', async () => {
    const f = fixture({ failingTasks: new Set(['t1']) });
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');

    await runIntegrate({ id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'], run_tests: 'true' }, f.context);

    expect(f.events.filter((e) => e.type === 'done')).toStrictEqual([
      { type: 'done', stepId: 'integrate', message: `1 branch(es) on ${INTEGRATION}, tests green` },
    ]);
    expect(f.context.failingTasks).toBeNull();
  });
});

describe('Q-0053 AC-13 — every value that arrives from a flow file is coerced at its call site', () => {
  test('a numeric `into` is a branch name, not a crash', async () => {
    const f = fixture({ dry: true });
    await runIntegrate({ id: 'integrate', type: 'integrate', into: 2, branches: [] }, f.context);
    expect(f.events).toStrictEqual([{ type: 'step', stepId: 'integrate', message: 'integrate → 2' }]);
  });

  test('a numeric member of an explicit branch list is coerced, and the list is still ordered', async () => {
    const f = fixture();
    f.branchWith('harness/Q-0053/t1', 'a.txt', 'a\n');
    await runIntegrate({ id: 'integrate', type: 'integrate', branches: [2, 'harness/{id}/t1'], output: { write: 'dev/i.md' } }, f.context);
    // `2` names no branch, so it is filtered out; `harness/Q-0053/t1` still merges.
    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8')).toContain('- ✓ harness/Q-0053/t1');
  });

  test('a string run_tests reads harness.yaml\'s commands through the cmd namespace', async () => {
    // R-4: `{cmd.test}`, `{cmd.install}` and `{cmd.lint}` have zero coverage in either tree, and a
    // port that drops the flattening compiles, typechecks and passes both suites. This is their
    // first test anywhere.
    const f = fixture({ config: { repo: { base_branch: 'main' }, commands: { test: 'printf hi', install: 'true' } } });

    await runIntegrate({
      id: 'integrate', type: 'integrate', branches: [], run_tests: '{cmd.test} && printf " {cmd.install}"',
      output: { write: 'dev/i.md' },
    }, f.context);

    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/i.md'), 'utf8'))
      .toContain('Tests: `printf hi && printf " true"` → exit 0 (expected pass) → OK');
  });

  test('a run-scoped write path is interpolated, so `{run}` and `{iter}` reach the ticket', async () => {
    const f = fixture();
    await runIntegrate({ id: 'integrate', type: 'integrate', branches: [], output: { write: 'dev/run-{run}-{iter}.md' } }, f.context);
    expect(fs.existsSync(path.join(f.ticketDir, 'dev/run-4-1.md'))).toBe(true);
  });

  test('a non-string write path is coerced once, so it is routed by the string it is written to', async () => {
    // Both uses of the entry, not just the interpolation: the routing predicate reads the coerced
    // value, so a numeric path writes a file rather than throwing on `includes` one line later.
    const f = fixture();

    await runIntegrate({
      id: 'integrate', type: 'integrate', branches: [], run_tests: 'printf "✓ one check\\n"',
      output: { write: 2, writes: ['dev/{run}-report.md'] },
    }, f.context);

    // `2` carries no `report`, so it takes the notes; the sibling path still takes the report.
    expect(fs.readFileSync(path.join(f.ticketDir, '2'), 'utf8')).toContain('# Integration — run 4');
    expect(fs.readFileSync(path.join(f.ticketDir, 'dev/4-report.md'), 'utf8')).toContain('✓ one check');
  });

  test('a numeric template field on the fan-out child is coerced rather than passed through', async () => {
    const f = fixture();
    f.tasks('tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    f.role('developer-backend', 'adapter: claude\n');
    f.role('2', 'adapter: codex\n');
    const { calls } = childCalls();

    await runFanOut({ id: 'dev', fan_out: {}, step: { id: 5, role: 2, branch: 7 } }, f.context);

    expect(calls[0]!.step.id).toBe('5');
    expect(calls[0]!.step.role).toBe('2');
    expect(f.context.fanned?.[0]?.branch).toBe('7');
  });
});
