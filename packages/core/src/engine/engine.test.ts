import { describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import { runFlow } from './engine.js';
import type { RunFlowOptions } from './types.js';

function options(overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
  const flow = { name: 'requirements', consumes: 'draft', produces: 'requirements', steps: [] } as unknown as Flow;
  const ticket = {
    dir: '/repo/backlog/Q-0050-engine', folder: 'Q-0050-engine', body: 'body\n',
    meta: {
      id: 'Q-0050', title: 'engine', stage: 'draft', owner: 'qa', repos: [], branch: 'harness/Q-0050/integration',
      priority: 'p1', created: '2026-08-28', iterations: {}, history: [],
    },
  };
  const backlog = {
    root: '/repo/backlog', write: vi.fn(), writeFile: vi.fn(), log: vi.fn(),
    read: vi.fn(), readFiles: vi.fn(() => []), list: vi.fn(() => []), dirOf: vi.fn(), nextId: vi.fn(), create: vi.fn(),
  };
  return {
    ticket, flow, backlog,
    project: { repoDir: '/repo', harnessDir: '/repo/harness', config: { adapterOverride: 'mock' }, backlog },
    ...overrides,
  } as unknown as RunFlowOptions;
}

function stream(opts: RunFlowOptions): AsyncIterable<Event> {
  try {
    return runFlow(opts);
  } catch (error) {
    expect(error, 'runFlow must return its lazy iterable before doing work').toBeUndefined();
    throw error;
  }
}

async function collect(iterable: AsyncIterable<Event>): Promise<Event[]> {
  const events: Event[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('Q-0050 AC-2/AC-3/AC-10/AC-11a — composed run stream', () => {
  test('is lazy, emits the exact banner, and ends in one terminal event', async () => {
    const opts = options();
    const iterable = stream(opts);
    expect(opts.backlog.write).not.toHaveBeenCalled();
    const events = await collect(iterable);
    expect(events[0]).toStrictEqual({
      type: 'info', message: 'run #1  flow=requirements  ticket=Q-0050  draft → requirements',
    });
    expect(events.filter((event) => event.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: 'terminal', status: 'completed', stageBefore: 'draft', stageAfter: 'requirements', runId: 1,
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'info', message: expect.stringMatching(/^run #1 completed: draft → requirements   cost \$0\.00  tokens 0/),
    }));
  });

  test('rejects a stage mismatch before context construction or any write', async () => {
    const opts = options();
    opts.ticket.meta.stage = 'requirements';
    await expect(collect(stream(opts))).rejects.toThrow(/Q-0050.*requirements.*requirements.*draft|stage/i);
    expect(opts.backlog.write).not.toHaveBeenCalled();
    expect(opts.backlog.log).not.toHaveBeenCalled();
  });

  test('dry is the same run but all three persistent writers are replaced', async () => {
    const opts = options({ dry: true });
    const originalIterations = opts.ticket.meta.iterations;
    const before = JSON.stringify(opts.ticket);
    const events = await collect(stream(opts));
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    expect(opts.backlog.write).not.toHaveBeenCalled();
    expect(opts.backlog.writeFile).not.toHaveBeenCalled();
    expect(opts.backlog.log).not.toHaveBeenCalled();
    expect(opts.ticket.meta.iterations).toBe(originalIterations);
    expect(JSON.stringify(opts.ticket)).not.toBe(before);
    expect(opts.ticket.meta.stage).toBe('requirements');
  });

});
