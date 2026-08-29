import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { eventSchema } from '@quorum/shared';
import type { Event, Flow } from '@quorum/shared';

import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { loadProject } from '../backlog/project.js';
import { removeTempDirs, repo, write } from '../../test/repo.js';
import { runFlow } from './engine.js';
import { loadFlow } from './loaders.js';
import * as routing from './routing.js';
import type { RunFlowOptions, StepResult } from './types.js';

/**
 * A run over a ticket folder and a flow file that actually exist.
 *
 * Both are real because the engine no longer creates either: it used to `mkdirSync(ticket.dir)`
 * and to fabricate a `flowFile` path, and both existed only to keep a hand-built record and a flow
 * literal working here. `loadFlow` is what sets `flow.file` in every real caller, so the fixture
 * goes through it rather than around it.
 */
function options(overrides: Partial<RunFlowOptions> = {}): RunFlowOptions {
  const repoDir = repo();
  write(path.join(repoDir, 'harness/harness.yaml'), 'adapterOverride: mock\n');
  const project = loadProject(repoDir);
  const flowFile = path.join(repoDir, 'harness/flows/requirements.yaml');
  write(flowFile, 'name: requirements\nconsumes: draft\nproduces: requirements\nsteps: []\n');
  const flow: Flow = loadFlow(flowFile);
  const ticketDir = path.join(repoDir, 'backlog/Q-0050-engine');
  write(path.join(ticketDir, 'ticket.md'), '---\nid: Q-0050\n---\nbody\n');
  const ticket = {
    dir: ticketDir, folder: 'Q-0050-engine', body: 'body\n',
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

/**
 * A run over three gates: one auto, then one human re-entered once through its own retry target.
 *
 * Gates are the only step kind Q-0050 owns end to end, so they are the only way to compose a real
 * run here — and three of them in two steps is exactly the shape B-2's collision needed.
 */
function withGates(): { opts: RunFlowOptions; answers: string[] } {
  const answers: string[] = [];
  let asked = 0;
  const opts = options({
    answerGate: async (question) => {
      answers.push(question.gateId);
      asked += 1;
      return { gateId: question.gateId, answer: asked === 1 ? ('retry' as const) : ('advance' as const) };
    },
  });
  opts.flow.steps = [
    { id: 'precheck', gate: 'auto', reason: 'no human needed' },
    { id: 'approve', gate: 'human', reason: 'approve to continue', retryTarget: 'approve', retryCounter: 'f.approve', retryMax: 1 },
  ] as unknown as typeof opts.flow.steps;
  return { opts, answers };
}

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
    const logSpy = vi.spyOn(opts.backlog, 'log');
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
    // `log.start` is read by no other test and nextRunId parses this line to allocate the next id.
    // The oracle describes what the engine HANDS to `log`; `Backlog.log` prefixes the timestamp,
    // so the spy's argument is the string the fixture is about and the file line is not.
    expect(logSpy).toHaveBeenCalledWith(opts.ticket, render(fixture.log.start, {
      runId: 1, flow: 'requirements', stage: 'draft',
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'info', message: render(fixture.terminalInfo, {
        runId: 1, status: 'completed', stageBefore: 'draft', stageAfter: 'requirements', roundedCost: 0,
        tokens: 0, unpricedSuffix: '',
      }),
    }));
  });

  test('AC-2 — every event a composed run yields passes shared\'s strict schema', async () => {
    const events = await collect(stream(withGates().opts));
    // The subject is the run's OWN output, not a hand-written literal: events.q0050.test.ts
    // validates the union's shape, and until this ran nothing checked that `runFlow` produces
    // members of it.
    expect(events.length).toBeGreaterThan(4);
    for (const event of events) expect(() => eventSchema.parse(event), JSON.stringify(event)).not.toThrow();
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(['info', 'gate', 'terminal']));
  });

  test('every gate in one run has its own id, including a step re-entered by a retry', async () => {
    const { opts, answers } = withGates();
    const events = await collect(stream(opts));
    const ids = events.filter((event) => event.type === 'gate').map((event) => event.gateId);

    // Two questions reach the stream and three ids are spent: the auto gate allocates `1:1` in
    // `runStep` and `askGate` short-circuits before emitting it, then `approve` is asked twice
    // because its own retry target sends the cursor back to it.
    //
    // Keyed on context identity all three were `1:1` — engine.ts builds a fresh context for every
    // step and every re-entry — so an answer redelivered for an earlier gate validated at a later
    // one and was acted on, which is the whole of what the correlation exists to refuse. The
    // second element is what makes this a regression test rather than a uniqueness test: `1:2` vs
    // `1:3` is one step asked twice, and it is the case a per-context counter cannot distinguish.
    expect(ids).toStrictEqual(['1:2', '1:3']);
    expect(answers).toStrictEqual(['1:2', '1:3']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a run cancelled between steps stops and does not move the stage', async () => {
    const abort = new AbortController();
    const { opts } = withGates();
    opts.signal = abort.signal;
    opts.answerGate = async (question) => {
      abort.abort();
      return { gateId: question.gateId, answer: 'advance' as const };
    };
    const events: Event[] = [];
    const error = await (async () => {
      try {
        for await (const event of stream(opts)) events.push(event);
        return undefined;
      } catch (cause: unknown) { return cause; }
    })();

    // The loop is the subject. Without a cancellation point of its own the only observer is a
    // SUSPENDED askGate: a signal raised while no gate is pending was never seen, the run walked
    // to `finishRun(flow.produces, 'completed')` and moved the ticket's stage.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/interrupted/);
    expect(opts.ticket.meta.stage).toBe('draft');
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'interrupted', stageAfter: 'draft' });
  });

  test('AC-5c/5d — a consumer that breaks gets its interrupted record before return() resolves', async () => {
    // The failure mode the port INVENTS rather than inherits, and until now the only thing driving
    // it was channel.test.ts against a hand-written `finalise`. This drives runFlow's own
    // `finaliseAbandonment`.
    //
    // The fixture needs a genuine suspension point and this is why: `finish` is async with no
    // internal await, so on a short flow the whole terminal record — ticket write, runs.log line,
    // terminal event — is written during the synchronous prefix of `start()`, before the first
    // `next()` resolves. "Break after the first event and assert interrupted" therefore reports
    // `completed` on such a flow, and the naive version of this test would have been read as a bug
    // in the engine. A gate whose answer never arrives is a real suspension.
    const opts = options({ answerGate: () => new Promise(() => { /* never answered */ }) });
    opts.flow.steps = [{ id: 'approve', gate: 'human', reason: 'approve to continue' }] as unknown as typeof opts.flow.steps;

    const seen: Event[] = [];
    // A non-empty value, so identity is distinguishable from an object that was emptied: at `{}`
    // both the reference check and a deep-equality check pass over a cleared object.
    opts.ticket.meta.iterations = { 'requirements.approve': 1 };
    const iterations = opts.ticket.meta.iterations;
    const iterable = stream(opts);
    for await (const event of iterable) {
      seen.push(event);
      if (event.type === 'gate') break;
    }

    // `for await`'s break awaits return(), so by HERE the record must already exist. That is the
    // property AC-5 states — an abandoning consumer cannot be released before the persistence has
    // run — and asserting it right after the loop is what makes the ordering the subject.
    expect(seen.at(-1)).toMatchObject({ type: 'gate' });
    expect(opts.ticket.meta.history?.at(-1)).toMatchObject({ status: 'interrupted', stage_after: 'draft' });
    expect(opts.ticket.meta.stage).toBe('draft');
    // The reference captured BEFORE the run, not the field compared with itself, and carrying a
    // value so that "same object" is not satisfied by an emptied one.
    expect(opts.ticket.meta.iterations).toBe(iterations);
    expect(opts.ticket.meta.iterations).toStrictEqual({ 'requirements.approve': 1 });
    const log = fs.readFileSync(path.join(opts.ticket.dir, 'runs.log'), 'utf8');
    expect(log).toMatch(/run=1 interrupted stage=draft→draft/);
  });

  test('AC-5 — an interrupted run records the caller\'s own abort reason', async () => {
    // `core` installs no signal handler, so it cannot write the spike's `received SIGINT` unaided.
    // AbortSignal.reason is the platform's mechanism for saying why, and Q-0010's CLI is what will
    // supply it.
    const abort = new AbortController();
    const opts = options({
      signal: abort.signal,
      answerGate: () => new Promise(() => { /* never answered */ }),
    });
    opts.flow.steps = [{ id: 'approve', gate: 'human', reason: 'approve to continue' }] as unknown as typeof opts.flow.steps;

    const events: Event[] = [];
    const error = await (async () => {
      try {
        for await (const event of stream(opts)) {
          events.push(event);
          if (event.type === 'gate') abort.abort('received SIGINT');
        }
        return undefined;
      } catch (cause: unknown) { return cause; }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'interrupted', error: 'received SIGINT' });
    const log = fs.readFileSync(path.join(opts.ticket.dir, 'runs.log'), 'utf8');
    expect(log).toMatch(/run=1 interrupted stage=draft→draft .*error="received SIGINT"/);
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
    // "…or any write" — AC-11's Test: line names both, and the refusal happens before any run
    // bookkeeping rather than merely before the flow's steps.
    expect(fs.existsSync(path.join(opts.ticket.dir, 'runs.log'))).toBe(false);
    expect(fs.existsSync(path.join(opts.project.repoDir, '.quorum'))).toBe(false);
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
    // AC-8a's second half: B's steps never ran. `development.yaml` declares one step, `build`, and
    // the cursor returns before it could reach any dispatch — so the stub records exactly the one
    // call A made. Without this the row claimed a spy that did not exist.
    expect(vi.mocked(routing.runStep)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(routing.runStep).mock.calls[0]?.[0]).toMatchObject({ id: 'a' });
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

  test('AC-3a — an aborted run ends in one terminal event and moves no stage', async () => {
    // The fifth status, and the only one no engine-level test drove. AC-3a rules out
    // lifecycle.test.ts's five-status matrix as a substitute in as many words — calling `finish`
    // directly "only proves the payload's shape", while the engine-level test proves the terminal
    // event is actually last on the stream.
    const opts = options();
    opts.flow.steps = [{ id: 'a' }, { id: 'b' }] as unknown as typeof opts.flow.steps;
    routeOnce({ abort: true });

    const events = await collect(stream(opts));

    expect(events.filter((event) => event.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: 'terminal', status: 'aborted', stageBefore: 'draft', stageAfter: 'draft', runId: 1,
    });
    expect(opts.ticket.meta.stage).toBe('draft');
    expect(opts.ticket.meta.history?.at(-1)).toMatchObject({ status: 'aborted', stage_after: 'draft' });
  });

  test('an adapter event is stamped with the step running when it is EMITTED, not when emit was bound', async () => {
    // Round 3's M-1 remedy removed the per-step context copy, which also moved step-id resolution
    // from bind time to emit time. That is a semantic change and it shipped with coverage in
    // neither direction — this ticket emits no adapter events, and AC-2b is struck by E-8.
    //
    // The discriminating case: step ONE captures its emitter, step TWO calls that same captured
    // function. Under the old bind-time closure the event carries `first`; under emit-time it
    // carries `second`. A test that only checked each step stamping its own id passes either way.
    const opts = options();
    opts.flow.steps = [{ id: 'first' }, { id: 'second' }] as unknown as typeof opts.flow.steps;
    let captured: ((event: Event) => void) | undefined;
    vi.spyOn(routing, 'runStep').mockImplementation(async (step, context) => {
      if (String(step.id) === 'first') { captured = context.emit; return null; }
      captured?.({ type: 'stdout', line: 'emitted by second through first\'s emitter' } as unknown as Event);
      return null;
    });

    const events = await collect(stream(opts));
    const stamped = events.filter((event) => event.type === 'stdout') as Array<Event & { stepId?: string }>;
    expect(stamped).toHaveLength(1);
    expect(stamped[0]?.stepId).toBe('second');
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
