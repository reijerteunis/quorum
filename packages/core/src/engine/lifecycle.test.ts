import { describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { finish, outcome, recordEvent } from './lifecycle.js';
import type { LifecycleContext, RegressionFields, RunStatus } from './types.js';

const render = (template: string, values: Record<string, string | number>): string =>
  template.replace(/<([^>]+)>/g, (whole, key: string) => String(values[key] ?? whole));

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
      writeTicket: vi.fn(), appendLog: vi.fn(), recordOccurrenceEvent: vi.fn(), finaliseActiveOccurrences: vi.fn(),
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
