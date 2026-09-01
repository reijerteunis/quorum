import { describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { coreSourceFiles } from '../../test/corpus.js';
import { finish, outcome, recordEvent } from './lifecycle.js';
import type { LifecycleContext, RegressionFields, RunStatus } from './types.js';

const render = (template: string, values: Record<string, string | number>): string =>
  template.replace(/<([^>]+)>/g, (whole, key: string) => String(values[key] ?? whole));

/**
 * The `RunStatus` union as `engine/types.ts` declares it, so the table below can be checked against
 * the vocabulary instead of standing in for it. Read from the corpus the package already collects,
 * which leaves no path literal for `turbo-inputs.test.ts` to want registered.
 *
 * @throws {Error} when the declaration is missing or carries no member — a check that cannot find
 *   its subject reports that rather than passing over nothing.
 */
function declaredRunStatuses(): string[] {
  const types = coreSourceFiles().find(([name]) => name === 'engine/types.ts')?.[1];
  if (types === undefined) throw new Error('corpus missing: packages/core/src/engine/types.ts');
  const declaration = /export type RunStatus =([^;]+);/.exec(types);
  if (declaration === null) throw new Error('packages/core/src/engine/types.ts declares no RunStatus union');
  const members = [...declaration[1]!.matchAll(/'([^']+)'/g)].map(([, member]) => member!);
  if (members.length === 0) throw new Error('packages/core/src/engine/types.ts: RunStatus names no member');
  return members;
}

function lifecycle(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  const flow = { name: 'qa-red', consumes: 'solutioned', produces: 'red', steps: [] } as unknown as Flow;
  const ticket = {
    dir: '/repo/backlog/Q-0050-core-engine-run-loop', folder: 'Q-0050-core-engine-run-loop', body: 'body\n',
    meta: {
      id: 'Q-0050', title: 'engine', stage: 'solutioned', owner: 'qa', repos: [],
      branch: 'harness/Q-0050/integration', priority: 'p1', created: '2026-08-28', iterations: { review: 2 }, history: [],
    },
  };
  const backlog = {
    write: vi.fn(), writeFile: vi.fn(), log: vi.fn(), read: vi.fn(), readFiles: vi.fn(),
  };
  return {
    ticket, flow, repoDir: '/repo', harnessDir: '/repo/harness', config: {}, backlog,
    runId: 7, counters: ticket.meta.iterations, vars: {},
    stats: { cost: 1.23456, tokens: 42, unpriced: 0 }, dry: false, auto: false,
    emit: vi.fn<(event: Event) => void>(),
    persistence: {
      writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(),
      registerOccurrence: vi.fn(), finaliseManifest: vi.fn(), finaliseActiveOccurrences: vi.fn(),
    },
    branchHeadAtStart: 'aaaaaaaaaaaaaaaa', readBranchHead: vi.fn(() => 'aaaaaaaaaaaaaaaa'), resetBranch: vi.fn(),
    ...overrides,
  } as unknown as LifecycleContext;
}

const regression: RegressionFields = {
  targetFlow: 'requirements', stageBefore: 'solutioned', stageAfter: 'requirements',
  counter: 'qa-red.review', count: 2, limit: 2, remaining: 0,
};

describe('Q-0050 AC-9 — lifecycle is directly executable', () => {
  test.each([
    ['completed', 'red', true],
    ['regressed', 'requirements', true],
    ['aborted', 'solutioned', false],
    ['failed', 'solutioned', false],
    ['interrupted', 'solutioned', false],
    // The sixth, added by Q-0040. It is here rather than in a suite of its own because every
    // clause below is a property of EVERY terminal status, and a table that enumerated five of
    // six would say the new one is a special case when it is not.
    ['undecided', 'solutioned', false],
  ] as const)('%s persists counters/history and applies its stage rule', async (status, target, moves) => {
    const ctx = lifecycle();
    const before = ctx.ticket.meta.stage;
    const fields = status === 'regressed' ? regression : undefined;
    await expect(finish(ctx, target, status as RunStatus, status === 'failed' ? 'script exited 1: denied' : null, fields))
      .resolves.toMatchObject({ status, stage: target, cost: 1.23456, runId: 7 });
    expect(ctx.ticket.meta.stage).toBe(moves ? target : before);
    expect(ctx.ticket.meta.iterations).toStrictEqual({ review: 2 });
    expect(ctx.ticket.meta.history).toHaveLength(1);
    expect(ctx.persistence.writeTicket).toHaveBeenCalledTimes(1);
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, expect.stringMatching(`run=7 ${status} stage=`));
    expect(ctx.emit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'terminal', status }));
    // The manifest is finalised with the stage the ticket was LEFT at, and before anything is
    // emitted or written — spike/src/engine.js:625-632. Asserted through the invocation order
    // rather than by reading the source, because the whole defect was one `await` too late.
    expect(ctx.persistence.finaliseManifest).toHaveBeenCalledWith(status, moves ? target : before);
    expect((ctx.persistence.finaliseManifest as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan((ctx.persistence.writeTicket as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
    expect((ctx.persistence.finaliseManifest as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan((ctx.emit as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
  });

  test('AC-9f — the payload carries the raw cost and the history entry carries the rounded one', async () => {
    const ctx = lifecycle();
    const result = await finish(ctx, 'red', 'completed', null);
    // Both halves. The raw one was already asserted by the five-status matrix; the rounded one —
    // what actually lands in the ticket's frontmatter and is read for months — was not, which the
    // criterion itself anticipated.
    expect(result.cost).toBe(1.23456);
    expect(ctx.ticket.meta.history?.at(-1)).toMatchObject({ cost: 1.235 });
    expect(ctx.emit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'terminal', cost: 1.235 }));
  });

  test('AC-9 — the terminal runs.log line is rendered whole from the oracle, not matched by prefix', async () => {
    // `log.terminal` was read by NO test: the five-status matrix matched `run=7 <status> stage=` as
    // a prefix, and the interrupted test's regex stepped over `cost=` and `tokens=` with `.*`. The
    // enumerated segment was the unchecked segment, on the criterion whose subject it is.
    const ctx = lifecycle({ stats: { cost: 1.23456, tokens: 42, unpriced: 0 } });
    await finish(ctx, 'red', 'failed', 'script exited 1: denied');
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, render(fixture.log.terminal, {
      runId: 7, status: 'failed', stageBefore: 'solutioned', stageAfter: 'solutioned',
      roundedCost: 1.235, tokens: 42,
      errorSuffix: render(fixture.log.errorSuffix, { 'JSON-quoted-note': '"script exited 1: denied"' }),
    }));
  });

  test('AC-2a — both unpricedSuffix branches render, singular and plural', async () => {
    // A string preserved byte-for-byte from engine.js:650, two-space prefix included, whose plural
    // branch no test had ever reached: every other test runs at `unpriced: 0`.
    for (const [unpriced, key] of [[1, 'one'], [2, 'many']] as const) {
      const ctx = lifecycle({ stats: { cost: 0, tokens: 0, unpriced } });
      await finish(ctx, 'red', 'completed', null);
      const suffix = render(fixture.unpricedSuffix[key], { count: unpriced });
      expect(ctx.emit).toHaveBeenCalledWith({
        type: 'info',
        message: render(fixture.terminalInfo, {
          runId: 7, status: 'completed', stageBefore: 'solutioned', stageAfter: 'red',
          roundedCost: 0, tokens: 0, unpricedSuffix: suffix,
        }),
      });
    }
  });

  test('outcome uses run, duplicates stage/stage_after, and never invents cost', () => {
    const ctx = lifecycle();
    expect(outcome(ctx, 'solutioned', 'red', 'completed', null)).toMatchObject({
      run: 7, flow: 'qa-red', status: 'completed', stage: 'red',
      stage_before: 'solutioned', stage_after: 'red', cost: null,
    });
  });

  test('recordEvent persists exhausted at one unchanged stage before returning', async () => {
    const ctx = lifecycle();
    await expect(recordEvent(ctx, 'solutioned', 'exhausted', 0)).resolves.toBeUndefined();
    expect(ctx.ticket.meta.history).toContainEqual(expect.objectContaining({
      status: 'exhausted', stage_before: 'solutioned', stage_after: 'solutioned', cost: 0,
    }));
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, render(fixture.log.recordEvent, {
      runId: 7, status: 'exhausted', stage: 'solutioned', cost: 0,
    }));
  });

  test('recordEvent owns the mutation and performs it exactly once through the capability', async () => {
    // Both layers used to implement these four writes: `recordEvent` did them AND called
    // `persistence.recordOccurrenceEvent`, whose real implementation in engine.ts did them again.
    // One exhaustion appended two history entries and two log lines. The composed path is only
    // observable here because engine.ts's capability is a delegation — asserted as source text in
    // q0050.source.test.ts — so this test wires it the same way and counts the writes.
    const ctx = lifecycle();
    ctx.persistence.recordOccurrenceEvent = vi.fn((_ticket, stage, event, cost) => recordEvent(ctx, stage, event, cost));

    await ctx.persistence.recordOccurrenceEvent(ctx.ticket, 'solutioned', 'exhausted', 0);

    expect(ctx.ticket.meta.history).toHaveLength(1);
    expect(ctx.persistence.writeTicket).toHaveBeenCalledTimes(1);
    expect(ctx.persistence.appendLog).toHaveBeenCalledTimes(1);
    expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, render(fixture.log.recordEvent, {
      runId: 7, status: 'exhausted', stage: 'solutioned', cost: 0,
    }));
  });

  test('recordEvent does not call the capability it is reached through', async () => {
    // The other half of the pair, and what makes engine.ts's delegation safe rather than recursive.
    const ctx = lifecycle();
    await recordEvent(ctx, 'solutioned', 'exhausted', 0);
    expect(ctx.persistence.recordOccurrenceEvent).not.toHaveBeenCalled();
  });

  test('rollback requires all four guards and never touches a neighbouring task branch', async () => {
    for (const [dry, status, start, current, expected] of [
      [false, 'failed', 'aaaaaaaa', 'bbbbbbbb', 1],
      [true, 'failed', 'aaaaaaaa', 'bbbbbbbb', 0],
      [false, 'completed', 'aaaaaaaa', 'bbbbbbbb', 0],
      [false, 'regressed', 'aaaaaaaa', 'bbbbbbbb', 0],
      [false, 'failed', null, 'bbbbbbbb', 0],
      [false, 'failed', 'aaaaaaaa', 'aaaaaaaa', 0],
      [false, 'failed', 'aaaaaaaa', null, 0],
      // Q-0040: the one non-advancing status that does not restore. Every guard this matrix tests
      // is satisfied — not dry, a start head, a current head, and the two differ — and the reset
      // still must not happen, which is the row no other status can stand in for.
      [false, 'undecided', 'aaaaaaaa', 'bbbbbbbb', 0],
    ] as const) {
      const reset = vi.fn();
      const ctx = lifecycle({ dry, branchHeadAtStart: start, readBranchHead: vi.fn(() => current), resetBranch: reset });
      // The subject of this matrix is ROLLBACK — whether `reset` is called — and `regressed`
      // is here only as one of the five statuses. The fields are incidental to that, but
      // finish() narrows them at the regressed branch, so the row supplies them rather than
      // asserting a shape it is not testing. Whether that narrowing should be a runtime
      // throw at all is a charter §2 question for review: the spike spreads `...fields` and
      // never throws.
      const fields = status === 'regressed'
        ? { targetFlow: 'development', stageBefore: 'solutioned', stageAfter: 'red', counter: 'f.x', count: 1, limit: 1, remaining: 0 }
        : undefined;
      await expect(finish(ctx, 'solutioned', status, null, fields)).resolves.toBeDefined();
      expect(reset, `${dry}/${status}/${start}/${current}`).toHaveBeenCalledTimes(expected);
      if (expected) {
        expect(reset).toHaveBeenCalledWith('/repo', 'harness/Q-0050/integration', 'aaaaaaaa');
        expect(ctx.emit).toHaveBeenCalledWith({
          type: 'warn',
          message: render(fixture.rollback, { branch: 'harness/Q-0050/integration', shortStartSha: 'aaaaaaa' }),
        });
        expect(ctx.persistence.appendLog).toHaveBeenCalledWith(ctx.ticket, render(fixture.log.rollback, {
          runId: 7, branch: 'harness/Q-0050/integration', shortCurrentSha: 'bbbbbbb', shortStartSha: 'aaaaaaa',
        }));
      }
    }
  });

  test('a null current branch head skips rollback without manufacturing a warning', async () => {
    const ctx = lifecycle({ branchHeadAtStart: 'aaaaaaaa', readBranchHead: vi.fn(() => null) });
    await expect(finish(ctx, 'solutioned', 'failed', 'git unavailable')).resolves.toBeDefined();
    expect(ctx.resetBranch).not.toHaveBeenCalled();
    expect(ctx.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'warn' }));
  });

  test('dry preserves in-memory mutations while the prototype view absorbs writes', async () => {
    const realBacklog = { write: vi.fn(), writeFile: vi.fn(), log: vi.fn() };
    const dryBacklog = Object.assign(Object.create(realBacklog), {
      write: vi.fn(), writeFile: vi.fn(), log: vi.fn(),
    });
    const ctx = lifecycle({ dry: true, backlog: dryBacklog });
    ctx.persistence.writeTicket = vi.fn((ticket) => ctx.backlog.write(ticket));
    ctx.persistence.appendLog = vi.fn((ticket, line) => ctx.backlog.log(ticket, line));
    await expect(finish(ctx, 'red', 'completed', null)).resolves.toBeDefined();
    expect(ctx.ticket.meta.stage).toBe('red');
    expect(ctx.ticket.meta.history).toHaveLength(1);
    expect(ctx.persistence.writeTicket).toHaveBeenCalledTimes(1);
    expect(ctx.persistence.appendLog).toHaveBeenCalled();
    expect(realBacklog.write).not.toHaveBeenCalled();
    expect(realBacklog.log).not.toHaveBeenCalled();
  });
});

/**
 * What each terminal status decides, as three independent questions.
 *
 * `finished` used to answer all three, and the worktree return and the branch rollback were the
 * two arms of one `if`/`else` — mutually exclusive by construction, so "keep the worktrees *and*
 * leave the branch alone" was unsayable however the predicate was widened. Splitting the
 * conditional loses that structural guarantee, so the invariant below is what replaces it: without
 * it this criterion is a rename and Q-0062's *"cannot drift apart"* property is gone.
 *
 * The table asserts the CONSEQUENCES rather than the three private predicates, because a predicate
 * nothing reads decides nothing — which is the shape of the defect this repository keeps finding.
 *
 * It is keyed by `RunStatus` and checked against the union `types.ts` declares, because a hand-kept
 * list of rows is not a claim about the vocabulary: a seventh status added with no row would
 * otherwise take all three decisions and evade the invariant while this suite reported green. Both
 * halves fire — the key type fails `pnpm typecheck`, and the vocabulary check below fails the suite
 * — so neither gate has to be the one somebody happens to run.
 */
describe('Q-0040 AC-4 — three named questions, and no status takes both arms', () => {
  const withWorktrees = (overrides: Partial<LifecycleContext> = {}): LifecycleContext => lifecycle({
    worktrees: new Map([['harness/Q-0050/implement', '/repo/.harness/worktrees/harness__Q-0050__implement']]),
    readWorktreeChanges: vi.fn(() => []),
    removeWorktree: vi.fn(),
    branchHeadAtStart: 'aaaaaaaa',
    readBranchHead: vi.fn(() => 'bbbbbbbb'),
    resetBranch: vi.fn(),
    ...overrides,
  } as unknown as Partial<LifecycleContext>);

  /** What one status decides, as the three questions `lifecycle.ts` asks of it. */
  interface Consequences { advances: boolean; returns: boolean; restores: boolean }

  const TABLE: Readonly<Record<RunStatus, Consequences>> = {
    completed: { advances: true, returns: true, restores: false },
    regressed: { advances: true, returns: true, restores: false },
    aborted: { advances: false, returns: false, restores: true },
    failed: { advances: false, returns: false, restores: true },
    interrupted: { advances: false, returns: false, restores: true },
    undecided: { advances: false, returns: false, restores: false },
  };

  const ROWS = Object.entries(TABLE).map(([status, row]) => ({ status: status as RunStatus, ...row }));

  test('every RunStatus has a row, and no row invents a status', () => {
    // The table's own subject, read out of `types.ts` rather than restated here: without this the
    // rows below are a list somebody remembered to extend, and the invariant is a claim about that
    // list rather than about the vocabulary.
    expect([...Object.keys(TABLE)].sort()).toStrictEqual([...declaredRunStatuses()].sort());
  });

  test.each(ROWS)('$status: stage $advances, worktrees $returns, branch $restores', async (row) => {
    const ctx = withWorktrees();
    const before = ctx.ticket.meta.stage;
    const fields = row.status === 'regressed' ? regression : undefined;
    await expect(finish(ctx, 'red', row.status, null, fields)).resolves.toBeDefined();
    expect(ctx.ticket.meta.stage, 'stage').toBe(row.advances ? 'red' : before);
    expect((ctx.removeWorktree as ReturnType<typeof vi.fn>).mock.calls.length > 0, 'worktrees').toBe(row.returns);
    expect((ctx.resetBranch as ReturnType<typeof vi.fn>).mock.calls.length > 0, 'branch').toBe(row.restores);
  });

  test('no status both returns its worktrees and restores its branch', () => {
    // The property the `if`/`else` used to guarantee, asserted over the whole vocabulary rather
    // than over the row that motivated the split. A seventh status is caught before it reaches
    // here: with no row it fails the vocabulary check above and the key type; with one it answers
    // all three questions in the rows above, and answering two of them the old, coupled way fails
    // here.
    for (const row of ROWS) expect(row.returns && row.restores, row.status).toBe(false);
    expect(ROWS.filter((row) => !row.returns && !row.restores).map((row) => row.status))
      .toStrictEqual(['undecided']);
  });
});
