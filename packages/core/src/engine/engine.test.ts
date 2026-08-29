import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import type { Event, Flow } from '@quorum/shared';

import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { loadProject } from '../backlog/project.js';
import { removeTempDirs, repo, write } from '../../test/repo.js';
import { runFlow } from './engine.js';
import * as routing from './routing.js';
import type { RunFlowOptions, StepResult } from './types.js';

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
    const writeSpy = vi.spyOn(opts.backlog, 'write');
    const writeFileSpy = vi.spyOn(opts.backlog, 'writeFile');
    const logSpy = vi.spyOn(opts.backlog, 'log');
    const originalIterations = opts.ticket.meta.iterations;
    const before = JSON.stringify(opts.ticket);
    const ticketFile = path.join(opts.ticket.dir, 'ticket.md');
    write(ticketFile, 'sentinel ticket bytes\n');
    const beforeFile = fs.readFileSync(ticketFile, 'utf8');
    const events = await collect(stream(opts));
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    expect(writeSpy).not.toHaveBeenCalled();
    expect(writeFileSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(fs.readFileSync(ticketFile, 'utf8')).toBe(beforeFile);
    expect(fs.existsSync(path.join(opts.ticket.dir, 'runs.log'))).toBe(false);
    expect(fs.existsSync(path.join(opts.project.repoDir, '.quorum'))).toBe(false);
    expect(opts.ticket.meta.iterations).toBe(originalIterations);
    expect(JSON.stringify(opts.ticket)).not.toBe(before);
    expect(opts.ticket.meta.stage).toBe('requirements');
  });

});

/**
 * Drive `engine.ts`'s goto resolution without a failing step.
 *
 * Why the seam is here and not a real failure: every step kind that can reach `handleFail` —
 * agent, script, integrate, fan-out — belongs to Q-0052 and Q-0053, and the only step kind this
 * ticket owns end to end is the gate, which returns `null` or `{ abort: true }` and never a goto
 * (an author gate carries no retry target). So the observable surface of AC-8b/8c/8d and AC-12d is
 * `engine.ts` acting on a StepResult, which E-3 makes its sole responsibility. Stubbing `runStep`
 * tests exactly that and nothing about how the result was produced.
 */
const routeOnce = (result: StepResult): void => {
  let served = false;
  vi.spyOn(routing, 'runStep').mockImplementation(async () => {
    if (served) return null;
    served = true;
    return result;
  });
};

afterEach(() => { vi.restoreAllMocks(); });

describe('Q-0050 AC-8b/AC-8c/AC-8d/AC-12d — engine.ts owns every cursor move', () => {
  const targetFlow = 'development';

  function withTarget(overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
    const opts = options(overrides);
    write(path.join(opts.project.repoDir, `harness/flows/${targetFlow}.yaml`),
      `name: ${targetFlow}\nconsumes: red\nproduces: green\nsteps:\n  - id: build\n    role: developer-backend\n`);
    return opts;
  }

  test('AC-8b — a cross-flow edge warns with the fixture text and regresses with all seven fields', async () => {
    const opts = withTarget();
    opts.flow.steps = [{ id: 'a' }] as unknown as typeof opts.flow.steps;
    opts.ticket.meta.iterations = { 'requirements.a': 2 };
    routeOnce({ goto: `flow:${targetFlow}`, counter: 'requirements.a', limit: 2 });

    const events = await collect(stream(opts));

    expect(events).toContainEqual({
      type: 'warn',
      message: render(fixture.crossFlowRegression, { target: targetFlow, stage: 'red' }),
    });
    // The seven fields are asserted as a whole object, so a partial payload fails rather than
    // passing on the subset that happens to be present. AC-3's closed union is what makes that
    // assertable at all.
    expect(events.at(-1)).toMatchObject({
      type: 'terminal', status: 'regressed', runId: 1,
      targetFlow, stageBefore: 'draft', stageAfter: 'red',
      counter: 'requirements.a', count: 2, limit: 2, remaining: 0,
    });
    expect(opts.ticket.meta.stage).toBe('red');
  });

  test('AC-8c — a goto naming an absent flow fails by name and moves no stage', async () => {
    const opts = options();
    opts.flow.steps = [{ id: 'a' }] as unknown as typeof opts.flow.steps;
    routeOnce({ goto: 'flow:doesNotExist', counter: 'requirements.a', limit: 1 });

    const error = await collect(stream(opts)).then(() => undefined, (cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('doesNotExist');
    // NOT byte-identical `ticket.md`: `finish` writes the ticket on every terminal status, so a
    // failed run appends its history entry. What a failure leaves alone is the STAGE — only
    // `completed` and `regressed` move it. Asserting the bytes would be unsatisfiable.
    expect(opts.ticket.meta.stage).toBe('draft');
    expect(opts.ticket.meta.history?.at(-1)).toMatchObject({ status: 'failed', stage_after: 'draft' });
  });

  test('AC-8d — remaining clamps at zero when the counter has passed the limit', async () => {
    const opts = withTarget();
    opts.flow.steps = [{ id: 'a' }] as unknown as typeof opts.flow.steps;
    // count > limit is the boundary the clamp exists for, constructed rather than inferred from
    // Math.max by reading: an unclamped subtraction reports -1 here.
    opts.ticket.meta.iterations = { 'requirements.a': 3 };
    routeOnce({ goto: `flow:${targetFlow}`, counter: 'requirements.a', limit: 2 });

    const events = await collect(stream(opts));

    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'regressed', count: 3, limit: 2, remaining: 0 });
  });

  test('AC-12d — a goto naming no step throws a raw TypeError, not a FlowError', async () => {
    const opts = options();
    opts.flow.steps = [{ id: 'a' }] as unknown as typeof opts.flow.steps;
    routeOnce({ goto: 'no-such-step', counter: 'requirements.a', limit: 1 });

    const error = await collect(stream(opts)).then(() => undefined, (cause: unknown) => cause);

    // Why: preserved defect, see Q-0050 AC-12d — findIndex() === -1 indexes the step array at -1
    // and the next dispatch dereferences undefined. Pinned so a later fix is deliberate.
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).name).toBe('TypeError');
  });
});
