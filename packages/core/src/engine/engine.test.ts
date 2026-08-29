import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { loadProject } from '../backlog/project.js';
import { removeTempDirs, repo, write } from '../../test/repo.js';
import { runFlow } from './engine.js';
import type { RunFlowOptions } from './types.js';

function options(overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
  const repoDir = repo();
  write(path.join(repoDir, 'harness/harness.yaml'), 'adapterOverride: mock\n');
  const project = loadProject(repoDir);
  const flow = { name: 'requirements', consumes: 'draft', produces: 'requirements', steps: [] } as unknown as Flow;
  const ticket = {
    dir: path.join(repoDir, 'backlog/Q-0050-engine'), folder: 'Q-0050-engine', body: 'body\n',
    meta: {
      id: 'Q-0050', title: 'engine', stage: 'draft', owner: 'qa', repos: [], branch: 'harness/Q-0050/integration',
      priority: 'p1', created: '2026-08-28', iterations: {}, history: [],
    },
  };
  return {
    ticket, flow, backlog: project.backlog, project,
    ...overrides,
  } as unknown as RunFlowOptions;
}

afterAll(removeTempDirs);

const render = (template: string, values: Record<string, string | number>): string =>
  template.replace(/<([^>]+)>/g, (whole, key: string) => String(values[key] ?? whole));

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
    const events = await collect(iterable);
    expect(events[0]).toStrictEqual({
      type: 'info', message: render(fixture.runBanner, {
        runId: 1, flow: 'requirements', ticket: 'Q-0050', consumes: 'draft', produces: 'requirements',
      }),
    });
    expect(events.filter((event) => event.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: 'terminal', status: 'completed', stageBefore: 'draft', stageAfter: 'requirements', runId: 1,
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'info', message: render(fixture.terminalInfo, {
        runId: 1, status: 'completed', stageBefore: 'draft', stageAfter: 'requirements', roundedCost: 0,
        tokens: 0, unpricedSuffix: '',
      }),
    }));
  });

  test('rejects a stage mismatch before context construction or any write', async () => {
    const opts = options();
    opts.ticket.meta.stage = 'requirements';
    const error = await collect(stream(opts)).then(() => undefined, (cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('Q-0050');
    expect(message).toContain('requirements');
    expect(message).toContain('draft');
    expect(message).toContain('flow');
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
