// Q-0040 — a run that reaches a gate nobody can answer is undecided, and keeps the branch it proved.
//
// Every case builds its own repository under `os.tmpdir()` and asks git itself what happened, so no
// verdict here depends on this checkout's branches, its ignored directories, its git identity or
// the machine's git configuration ("A test's verdict is a property of the commit, not of the
// checkout or the account", docs/DECISIONS.md 2026-08-30).
//
// The fixture's ticket is `runFixture`'s own, which is why the branches below read `Q-0052`.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { MANIFEST_FILE, RUN_HISTORY_ROOT, runIdOf, worktreeDirName } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { git, removeTempDirs, write } from '../../test/repo.js';
import { TICKET_ID, runFixture, stubAdapter } from '../../test/run-fixture.js';
import type { RunFixture } from '../../test/run-fixture.js';
import { runFlow } from './engine.js';
import { FlowError, GateUnansweredError } from './types.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

const IMPLEMENT = `harness/${TICKET_ID}/implement`;
const INTEGRATION = `harness/${TICKET_ID}/integration`;

/** Where a branch's worktree lands, derived through `shared` rather than re-spelled. */
const worktreeOf = (repoDir: string, branch: string): string =>
  path.join(repoDir, '.harness', 'worktrees', worktreeDirName(branch));

const warns = (events: Event[]): string[] => events.filter((e) => e.type === 'warn').map((e) => e.message);

/** Every line of the ticket's `runs.log` with `Backlog.log`'s ISO timestamp taken off. */
const runsLog = (fixture: RunFixture): string[] =>
  fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8')
    .split('\n').filter(Boolean).map((line) => line.replace(/^\S+ /, ''));

/**
 * The run's manifest, which is where an occurrence's status is durable.
 *
 * The run-history root and the manifest's name come from `shared` rather than being spelled here,
 * so this file names no path a working checkout also holds — Q-0072's guard reads a quoted literal
 * and cannot tell one of those from a repository path.
 */
const manifest = (fixture: RunFixture): { steps: { step_id: string; status: string }[]; status: string } =>
  JSON.parse(fs.readFileSync(
    path.join(fixture.repoDir, RUN_HISTORY_ROOT, runIdOf(TICKET_ID, 1), MANIFEST_FILE), 'utf8',
  )) as { steps: { step_id: string; status: string }[]; status: string };

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

/**
 * A chore-shaped flow: write in a worktree, merge into the ticket branch, then ask a human.
 *
 * **The merge before the gate is the whole point of the fixture.** A gate reached before anything
 * has been integrated proves nothing about the rollback — `chore.yaml`'s exhaustion gate precedes
 * its `integrate`, which is why no exhaustion-gate failure in this backlog ever produced a
 * `rolled-back` line. The destructive case is the terminal human gate, after the merge, and it is
 * the one reproduced here.
 */
const provingFlow = (fixture: RunFixture): void => {
  // The integration branch exists before the run, which is `chore.yaml`'s own precondition and is
  // load-bearing here twice over: the rollback is additionally guarded by `branchHeadAtStart` being
  // truthy, so a branch the run itself created is spared the reset whatever its status. Without
  // this line the control case below would report no rollback for a reason that has nothing to do
  // with the classification.
  git(fixture.repoDir, 'branch', INTEGRATION, 'HEAD');
  fixture.steps([
    { id: 'implement', worktree: true, branch: IMPLEMENT },
    { id: 'merge', type: 'integrate', branches: [IMPLEMENT], into: INTEGRATION },
    { id: 'approve', gate: 'human', reason: 'Chore owner approves the review' },
  ]);
};

/** The integration branch's head, or `null` when the branch does not exist. */
const headOf = (repoDir: string, branch: string): string | null => {
  try { return git(repoDir, 'rev-parse', '--verify', branch); } catch { return null; }
};

describe('AC-5 — an undecided run keeps the ticket branch exactly where the run left it', () => {
  test('the branch is the post-merge commit, nothing is rolled back, and the run does not throw', async () => {
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const before = headOf(fixture.repoDir, INTEGRATION);
    const { events, error } = await fixture.settle();

    // Nothing failed, so nothing propagates. Asserted first: were the run still throwing, every
    // assertion below would be about a run that had already been classified `failed`.
    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided' });

    const after = headOf(fixture.repoDir, INTEGRATION);
    expect(after, 'the branch must exist for this case to be about anything').not.toBeNull();
    expect(after).not.toBe(before);
    expect(git(fixture.repoDir, 'show', `${INTEGRATION}:src/work.ts`)).toContain('export const done');
    expect(warns(events).filter((message) => message.includes('rolled back to'))).toStrictEqual([]);
    expect(runsLog(fixture).filter((line) => line.includes('rolled-back'))).toStrictEqual([]);
  });

  test('the same flow stopped by an operator error rolls the branch back, as it always did', async () => {
    // The control case, and it is what makes the one above a claim about `undecided` rather than
    // about the fixture: identical flow, identical merge, a gate that fails for a different reason.
    // A fix that spared every non-advancing status its rollback would pass the case above and fail
    // this one.
    const fixture = runFixture({ run: { answerGate: () => Promise.resolve({ gateId: 'not-the-one', answer: 'advance' }) } });
    provingFlow(fixture);
    writing();

    const before = headOf(fixture.repoDir, INTEGRATION);
    const { events, error } = await fixture.settle();

    expect(error).toBeInstanceOf(FlowError);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed' });
    expect(headOf(fixture.repoDir, INTEGRATION)).toBe(before);
    expect(warns(events).some((message) => message.includes('rolled back to'))).toBe(true);
    expect(runsLog(fixture).some((line) => line.includes('rolled-back'))).toBe(true);
  });
});

describe('AC-6 — an undecided run keeps every worktree it obtained', () => {
  test('both directories, both registrations and both branches survive, and nothing is logged as removed', async () => {
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const { events } = await fixture.settle();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided' });

    for (const branch of [IMPLEMENT, INTEGRATION]) {
      expect(fs.existsSync(worktreeOf(fixture.repoDir, branch)), `${branch}: directory`).toBe(true);
      expect(git(fixture.repoDir, 'worktree', 'list'), `${branch}: registration`).toContain(worktreeDirName(branch));
      // No ref is deleted on any path — *"A run removes the worktrees it made, and never the
      // refs"* (2026-08-31) is untouched by this status.
      expect(headOf(fixture.repoDir, branch), `${branch}: ref`).not.toBeNull();
    }
    expect(events.filter((e) => e.type === 'info' && e.message.includes('worktree removed'))).toStrictEqual([]);
    expect(runsLog(fixture).filter((line) => line.includes('removed-worktrees='))).toStrictEqual([]);
  });

  test('the same flow answered `advance` removes them, so this is not a rewrite that spared everybody', async () => {
    // The `completed` control AC-6 asks for by name: without it, a table-driven change that skipped
    // cleanup for every status would leave the case above green.
    let gateId = '';
    const fixture = runFixture({
      run: {
        answerGate: (question) => { gateId = question.gateId; return Promise.resolve({ gateId, answer: 'advance' }); },
      },
    });
    provingFlow(fixture);
    writing();

    const { events } = await fixture.settle();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    for (const branch of [IMPLEMENT, INTEGRATION]) {
      expect(fs.existsSync(worktreeOf(fixture.repoDir, branch)), `${branch}: directory`).toBe(false);
    }
    expect(runsLog(fixture)).toContain('run=1 removed-worktrees=2 kept=0');
  });
});

describe('AC-7 — an undecided run moves no stage, records one entry, and fails no occurrence', () => {
  test('the frontmatter, the terminal line and the manifest all say the run decided nothing', async () => {
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const stageBefore = fixture.opts.ticket.meta.stage;
    const { events } = await fixture.settle();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided', stageBefore, stageAfter: stageBefore });

    const frontmatter = fs.readFileSync(path.join(fixture.ticketDir, 'ticket.md'), 'utf8');
    expect(frontmatter).toContain(`stage: ${stageBefore}`);
    expect(frontmatter).toContain('status: undecided');
    expect(runsLog(fixture).at(-1)).toMatch(
      new RegExp(`^run=1 undecided stage=${stageBefore}→${stageBefore} cost=\\S+ tokens=\\d+`),
    );

    // "A gate allocates no occurrence" is a property of the engine rather than of this ticket, so
    // it is asserted rather than assumed: no occurrence's status changed because of the gate, and
    // none is left running either.
    const record = manifest(fixture);
    expect(record.status).toBe('undecided');
    expect(record.steps.map((step) => step.status)).toStrictEqual(['completed', 'completed']);
    expect(record.steps.map((step) => step.step_id)).toStrictEqual(['implement', 'merge']);
  });
});

describe('AC-8 — runFlow completes rather than throwing, and the terminal event carries the status', () => {
  test('the iterator finishes, its last value is the terminal event, and the next pull is done', async () => {
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    // Iterated by hand rather than through `settle`, because the assertion is about what the
    // iterator does AFTER the terminal value — which is what distinguishes this from a `failed`
    // run, whose next pull still rejects (contracts/Q-0050/run-events.contract.md:80).
    const iterator = runFlow(fixture.opts)[Symbol.asyncIterator]();
    const events: Event[] = [];
    for (let pulled = await iterator.next(); !pulled.done; pulled = await iterator.next()) events.push(pulled.value);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided' });
    await expect(iterator.next()).resolves.toStrictEqual({ done: true, value: undefined });
  });
});

describe('AC-3 — classification is by type, not by text, and abort keeps precedence', () => {
  /** A flow whose one gate rejects with whatever the case supplies. */
  const rejectingGate = (rejection: (signal: AbortSignal | undefined) => unknown, signal?: AbortSignal): RunFixture => {
    const fixture = runFixture({
      run: { signal, answerGate: () => Promise.reject(rejection(signal)) },
    });
    fixture.steps([{ id: 'approve', gate: 'human', reason: 'Chore owner approves the review' }]);
    return fixture;
  };

  const unanswered = (message: string): GateUnansweredError =>
    new GateUnansweredError(message, { kind: 'human', reason: 'Chore owner approves the review', condition: 'stdin-closed' });

  test('an empty message still ends the run undecided — the type decides, not the words', async () => {
    const { events, error } = await rejectingGate(() => unanswered('')).settle();
    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided' });
  });

  test('a plain FlowError carrying the spike\'s verbatim wording still ends the run failed', async () => {
    // The discriminating case: it fails against a classifier keyed on message text and passes
    // against one keyed on the type. The wording is `spike/bin/harness.js`'s, byte for byte.
    const verbatim = 'gate (human) "Chore owner approves the review" needs an answer and stdin closed'
      + ' without one — pass --gate-answer advance|abort (repeatable, consumed in order), or run interactively';
    const { events, error } = await rejectingGate(() => new FlowError(verbatim)).settle();
    expect(error).toBeInstanceOf(FlowError);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed' });
  });

  test('an abort arriving while the gate is open is interrupted, not undecided', async () => {
    // An ordering invisible to inspection: both tests would pass with the `instanceof` first, and
    // the run would then record "nobody decided" for a cancellation somebody chose.
    const controller = new AbortController();
    const fixture = rejectingGate((signal) => {
      controller.abort('received SIGINT');
      expect(signal?.aborted).toBe(true);
      return unanswered('gate (human) "Chore owner approves the review" needs an answer');
    }, controller.signal);

    const { events } = await fixture.settle();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'interrupted' });
  });
});

describe('AC-2 — exactly the no-answer-available sites are undecided; the operator errors are not', () => {
  /** One gate, answered by `answerGate` or by nobody. */
  const gated = (run: Record<string, unknown> = {}): RunFixture => {
    const fixture = runFixture({ run });
    fixture.steps([{ id: 'approve', gate: 'human', reason: 'Chore owner approves the review' }]);
    return fixture;
  };

  test('routing.ts — no answer channel at all is undecided', async () => {
    const { events, error } = await gated().settle();
    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'undecided' });
  });

  test.each([
    ['an invalid answer envelope', { gateId: 'anything', answer: 'maybe' }],
    ['a stale gate id', { gateId: 'a-gate-that-is-not-this-one', answer: 'advance' }],
  ])('routing.ts — %s is an operator error and stays failed', async (_label, answer) => {
    const fixture = gated({ answerGate: () => Promise.resolve(answer) });
    const { events, error } = await fixture.settle();
    expect(error).toBeInstanceOf(FlowError);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed' });
  });
});

describe('AC-13 — the run says which gate went unanswered and what it kept', () => {
  test('the diagnostic is verbatim, the disposition is beside it, and runs.log carries the condition', async () => {
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const { events } = await fixture.settle();
    const head = headOf(fixture.repoDir, INTEGRATION);
    expect(head).not.toBeNull();

    // The message the operator acts on reaches them unchanged: it used to arrive through the
    // failure path this status no longer takes.
    expect(warns(events)).toContain('gate human (Chore owner approves the review) has no answer channel');
    expect(warns(events)).toContain(
      'gate (human) "Chore owner approves the review" went unanswered — the run was started with no way to ask;'
      + ` nothing was rolled back: ${INTEGRATION} stays at ${head!.slice(0, 7)}, 2 worktrees kept`,
    );
    expect(runsLog(fixture)).toContain(
      `run=1 undecided-gate kind=human reason="Chore owner approves the review" condition=no-answer-channel`
      + ` rollback=none branch=${INTEGRATION} kept-at=${head!.slice(0, 7)} kept-worktrees=2`,
    );
    // Before the terminal line, as the cleanup count is.
    const lines = runsLog(fixture);
    expect(lines.findIndex((line) => line.includes('undecided-gate')))
      .toBeLessThan(lines.findIndex((line) => line.startsWith('run=1 undecided stage=')));
  });

  test('both records name the gate\'s own reason, which is what tells two gates of one flow apart', async () => {
    // AC-13 asks for the line to name the unanswered gate, and a flow may hold more than one gate
    // of the same kind: `kind=human` alone identifies neither, so the reason is the identifier and
    // its presence is asserted here rather than left implicit in the two whole-string matches
    // above. The reason is this fixture's own, unique in the run's output, so the assertion cannot
    // be satisfied by the verbatim diagnostic emitted beside it.
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const { events } = await fixture.settle();
    const disposition = warns(events).find((message) => message.includes('went unanswered')) ?? '';
    const record = runsLog(fixture).find((line) => line.includes('undecided-gate')) ?? '';
    expect(disposition).toContain('"Chore owner approves the review"');
    expect(record).toContain('reason="Chore owner approves the review"');
  });

  test('both records state that nothing was rolled back, and neither is the rollback record', async () => {
    // AC-13 asks the `runs.log` line itself to say the branch was kept, and `kept-at=<sha>` alone
    // does not: it is a fact about where the branch is, and a reader who does not already know that
    // a rollback would have moved it cannot infer that none happened. The durable record is also
    // the one read *without* the disposition warning beside it, which is why the assertion is made
    // on the line rather than on the pair. Round 3, majors 1 and 2.
    const fixture = runFixture();
    provingFlow(fixture);
    writing();

    const { events } = await fixture.settle();
    const disposition = warns(events).find((message) => message.includes('went unanswered')) ?? '';
    const record = runsLog(fixture).find((line) => line.includes('undecided-gate')) ?? '';
    expect(disposition).toContain('nothing was rolled back');
    expect(record).toContain('rollback=none');
    // And the field is spelled so that it cannot be mistaken for the record it is the opposite of.
    // `rolled-back` belongs to `lifecycle.ts:145`, and AC-5 asserts an undecided run writes no line
    // carrying it — so a later respelling to `rolled-back=no` turns that guard red rather than
    // making the two grep alike. Pinned here because the collision is invisible in either file.
    expect(record).not.toContain('rolled-back');
  });

  test('the three conditions produce three distinguishable sentences', async () => {
    // Which of them occurred is what tells a scripting maintainer whether to supply another
    // `--gate-answer` or to run interactively, so it may not collapse into one wording. The
    // `no-answer-channel` case above is the one this tree can reach through a run; the other two
    // are `spike/bin/harness.js`'s and are exercised there. Here the three are shown to differ.
    const conditions = ['answers-exhausted', 'stdin-closed', 'no-answer-channel'] as const;
    const sentences = await Promise.all(conditions.map(async (condition) => {
      const fixture = runFixture({
        run: {
          answerGate: () => Promise.reject(new GateUnansweredError('no answer', {
            kind: 'human', reason: 'Chore owner approves the review', condition,
          })),
        },
      });
      fixture.steps([{ id: 'approve', gate: 'human', reason: 'Chore owner approves the review' }]);
      const { events } = await fixture.settle();
      return warns(events).find((message) => message.includes('went unanswered')) ?? '';
    }));
    expect(sentences.every((sentence) => sentence !== '')).toBe(true);
    expect(new Set(sentences).size, 'each condition reads differently').toBe(conditions.length);
  });
});

describe('AC-10 — the vocabulary is added where a run status is enumerated, and nowhere else', () => {
  test('an occurrence is never undecided: the writer\'s failure path stays failed | interrupted', async () => {
    // The boundary AC-10 draws, asserted where it is reachable: a run that dies mid-step closes its
    // occurrence `failed`, and no path closes one `undecided`, because a gate allocates none.
    const fixture = runFixture();
    fixture.steps([
      { id: 'implement', worktree: true, branch: IMPLEMENT },
      { id: 'approve', gate: 'human', reason: 'Chore owner approves the review' },
    ]);
    writing();

    await fixture.settle();
    const statuses = manifest(fixture).steps.map((step) => step.status);
    expect(statuses).toStrictEqual(['completed']);
    expect(statuses).not.toContain('undecided');
  });
});
