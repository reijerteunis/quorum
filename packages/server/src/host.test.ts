/**
 * Q-0013 AC-3 to AC-5 and AC-8 to AC-13 — the host driving real runs of the mock adapter.
 *
 * Every run below is a genuine `runFlow` over a repository, a harness, a flow file and a ticket that
 * the fixture built under `os.tmpdir()`: real `git` subprocesses, real run history, real gates. The
 * synthetic halves — eviction, the gate arithmetic — are `broadcast.test.ts`'s and `gates.test.ts`'s;
 * what only a run can show is here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { loadFlowByName, runFlow } from '@quorum/core';
import type { Event, GateQuestionEvent } from '@quorum/shared';

import {
  GATED_FLOW, ONE_STEP_FLOW, TICKET_ID, WORKTREE_FLOW, fixture, removeTempDirs, tempDir, write,
} from '../test/fixture.js';
import { createRunHost } from './host.js';
import type { RunHost } from './host.js';
import { NO_PROJECT_REMEDY, openProject, refusalFor } from './refusal.js';

afterAll(removeTempDirs);
afterEach(() => { vi.unstubAllEnvs(); });

/** How long a poll below waits before it reports what it was waiting for rather than hanging. */
const DEADLINE_MS = 10_000;

/**
 * Wait until `predicate` holds, or say what never happened.
 *
 * A deadline rather than an oracle: nothing below asserts how long anything took, and Vitest's own
 * chosen 20 s budget is what governs the file (Q-0102).
 */
async function until(predicate: () => boolean, what: string): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > DEADLINE_MS) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => { setTimeout(resolve, 5); });
  }
}

/** A background drain of one run's fan-out, so a test can watch while it acts. */
function watch(host: RunHost, handle: string): { events: Event[]; drained: Promise<void> } {
  const subscription = host.subscribe(handle);
  if (!subscription) throw new Error(`no subscription for ${handle}`);
  const events: Event[] = [];
  const drained = (async () => { for await (const event of subscription.events) events.push(event); })();
  return { events, drained };
}

/** The handle a start produced, whether it started or was refused. */
const handleOf = (outcome: { run: { handle: string } }): string => outcome.run.handle;

/** Start one run, failing the test with the refusal's own sentence when it did not start. */
async function started(host: RunHost, request: { flow: string; ticket: string; dry?: boolean; auto?: boolean }): Promise<string> {
  const outcome = await host.start(request);
  if (!outcome.started) throw new Error(`the run did not start: ${outcome.refusal.condition}`);
  return outcome.run.handle;
}

describe('AC-3 — identity is the host\'s, and core\'s run number is correlated onto it', () => {
  test('a completed run carries core\'s runId after the terminal event and none before it', async () => {
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 100 });

    const outcome = await host.start({ flow: 'probe', ticket: TICKET_ID });

    // Under way, and no run number yet: the terminal event is the only event carrying run identity.
    expect(outcome.started).toBe(true);
    expect(outcome.run.runId).toBeNull();
    expect(outcome.run.handle).not.toBe('');
    const seen = watch(host, outcome.run.handle);
    await seen.drained;

    const view = host.view(outcome.run.handle);
    expect(view?.runId).toBe(1);
    expect(view?.terminal?.status).toBe('completed');
    expect(view?.terminal?.runId).toBe(1);
    // The handle is the host's own name and is not core's number spelled differently.
    expect(view?.handle).not.toBe('1');
  });

  test('two runs of one host take two handles, and a handle nobody minted answers nothing', async () => {
    const project = fixture({ flow: ONE_STEP_FLOW });
    project.addTicket({ id: 'T-0002', folder: 'T-0002-second' });
    const host = createRunHost({ project: project.project, retain: 100 });

    const one = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await watch(host, one).drained;
    const two = await started(host, { flow: 'probe', ticket: 'T-0002' });
    await watch(host, two).drained;

    expect(one).not.toBe(two);
    expect(host.view('run-nobody-minted')).toBeNull();
    expect(host.subscribe('run-nobody-minted')).toBeNull();
  });
});

describe('AC-7 — the retention bound is refused where it is chosen', () => {
  test('a host built with a capacity nothing can honour does not look healthy until a run starts', () => {
    const project = fixture();
    expect(() => createRunHost({ project: project.project, retain: -1 })).toThrow(RangeError);
    expect(() => createRunHost({ project: project.project, retain: 2.5 })).toThrow(RangeError);
    expect(() => createRunHost({ project: project.project, retain: 0 })).not.toThrow();
  });
});

describe('AC-4 — a start answers only once the run is under way', () => {
  test('the second start for one ticket is refused, and core\'s sentence names the holder', async () => {
    // The lazy-start trap: `runFlow` evaluates the stage precondition and takes the run lock on the
    // FIRST PULL, so a host that stored the iterable and answered would report two started runs.
    // The first flow parks at a gate, which is what keeps the lock held while the second start runs.
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 100 });

    const first = await host.start({ flow: 'probe', ticket: TICKET_ID });
    const second = await host.start({ flow: 'probe', ticket: TICKET_ID });

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    if (second.started) throw new Error('unreachable');
    expect(second.refusal.condition).toContain(`run lock refused: ticket ${TICKET_ID} is held by run #1`);
    expect(second.refusal.condition).toMatch(/\(flow probe, pid \d+ on .+, started \d{4}-\d\d-\d\dT/);
    expect(second.refusal.condition).toContain('.quorum/locks');
    expect(second.run.runId, 'a refused start claimed a run number').toBeNull();
    expect(host.view(handleOf(second))?.state).toBe('refused');

    await host.shutdown();
  });

  test('and exactly one of the two runs exists — the refusal started nothing', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 100 });

    const first = await host.start({ flow: 'probe', ticket: TICKET_ID });
    const second = await host.start({ flow: 'probe', ticket: TICKET_ID });

    expect(host.subscribe(handleOf(second)), 'a refused start has a stream to watch').toBeNull();
    await host.shutdown();
    expect(project.manifests()).toHaveLength(1);
    expect(host.view(handleOf(first))?.state).toBe('ended');
  });
});

describe('AC-5 — a refusal carries the condition core gave, and no run number', () => {
  test('a stage the flow does not consume is refused in core\'s own words, byte for byte', async () => {
    const project = fixture({ stage: 'requirements' });
    const host = createRunHost({ project: project.project, retain: 10 });

    const outcome = await host.start({ flow: 'probe', ticket: TICKET_ID });

    // Taken FROM core rather than transcribed: the same refusal is driven directly through
    // `runFlow` and the two strings compared, so a reworded precondition cannot leave this file
    // asserting a sentence nothing prints. Safe to drive twice — a stage mismatch throws above the
    // run lock, the branch head and run history, so it creates nothing (Q-0039 AC-1).
    let direct = '';
    try {
      for await (const _event of runFlow({
        flow: loadFlowByName('probe', project.harnessDir),
        ticket: project.project.backlog.read(TICKET_ID),
        project: project.project,
        backlog: project.project.backlog,
      })) { throw new Error('the stage precondition let a run start'); }
    } catch (error) {
      direct = (error as Error).message;
    }

    expect(outcome.started).toBe(false);
    if (outcome.started) throw new Error('unreachable');
    expect(direct).toBe(`ticket ${TICKET_ID} is at stage "requirements", flow "probe" consumes "draft"`);
    expect(outcome.refusal.condition).toBe(direct);
    expect(outcome.refusal.remedy, 'this surface invented a remedy for a condition it has none for').toBeNull();
    expect(outcome.run.runId).toBeNull();
    expect(project.manifests(), 'a refused start wrote run history').toStrictEqual([]);
  });

  test('a flow that is not there, and a ticket that is not, are refused the same way', async () => {
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 10 });

    const noFlow = await host.start({ flow: 'nosuchflow', ticket: TICKET_ID });
    const noTicket = await host.start({ flow: 'probe', ticket: 'T-9999' });

    expect(noFlow.started).toBe(false);
    expect(noTicket.started).toBe(false);
    if (noFlow.started || noTicket.started) throw new Error('unreachable');
    expect(noFlow.refusal.condition).toContain('nosuchflow.yaml');
    expect(noTicket.refusal.condition).toBe('ticket not found: T-9999');
    expect(noFlow.run.runId).toBeNull();
    expect(noTicket.run.runId).toBeNull();
    expect(noTicket.run.ticket, 'a start that never resolved a ticket claimed one').toBeNull();
  });

  test('ProjectNotFoundError reaches a caller as core\'s sentence plus this surface\'s remedy', () => {
    // Composed at one site, and taken as a STRING so the module that owns the remedy names no
    // `core` symbol — `packages/cli/src/fail.ts`'s `dieNoProject` is the shape.
    //
    // Reached through `refusalFor` rather than through `openProject`, and the reason is the rule
    // this file is under: `loadProject(dir)` throws `ENOENT` for a directory that holds no harness,
    // and `ProjectNotFoundError` fires only when NO directory is given and the upward search finds
    // nothing — which from inside this repository finds this repository. A fixture that reached it
    // would have a verdict that is a property of the checkout (2026-08-30).
    const refusal = refusalFor(new (class extends Error { name = 'ProjectNotFoundError'; })('x'));
    expect(refusal.remedy, 'a look-alike by name got the remedy').toBeNull();

    const project = fixture();
    const outcome = openProject(project.repoDir);
    expect(outcome.opened).toBe(true);

    const missing = openProject(tempDir('plain-'));
    expect(missing.opened).toBe(false);
    if (missing.opened) throw new Error('unreachable');
    expect(missing.refusal.condition).toContain('harness.yaml');
    expect(missing.refusal.remedy, 'a remedy was applied to a condition it does not fit').toBeNull();
  });

  test('and the remedy is a statement about configuration, not a command somebody has to type', () => {
    expect(NO_PROJECT_REMEDY).toContain('harness/harness.yaml');
    expect(NO_PROJECT_REMEDY).not.toContain('quorum init');
    expect(NO_PROJECT_REMEDY).not.toContain('`');
  });
});

describe('AC-6 — the host is the stream\'s one consumer and subscribers are its fan-out', () => {
  test('two simultaneous subscribers each receive every event once, in consumption order', async () => {
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 100 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    const one = watch(host, handle);
    const two = watch(host, handle);
    await Promise.all([one.drained, two.drained]);

    expect(one.events.length).toBeGreaterThan(1);
    expect(two.events).toStrictEqual(one.events);
    expect(one.events.filter((event) => event.type === 'terminal')).toHaveLength(1);
    expect(one.events[one.events.length - 1]?.type).toBe('terminal');
  });

  test('and the hazard is real: core\'s own stream throws on a second iteration', async () => {
    // Why the fan-out exists rather than being an enhancement. A host that handed the iterable to a
    // per-connection handler is correct for one watcher and throws on the second, and the FIRST
    // watcher is the common test. Demonstrated on a stream this test owns.
    const project = fixture();
    const stream = runFlow({
      flow: loadFlowByName('probe', project.harnessDir),
      ticket: project.project.backlog.read(TICKET_ID),
      project: project.project,
      backlog: project.project.backlog,
    });
    const iterator = stream[Symbol.asyncIterator]();

    expect(() => stream[Symbol.asyncIterator]()).toThrow('already iterated');

    await iterator.return?.();
  });

  test('a `parallel:` group is fanned out without claiming an order core does not promise', async () => {
    // Members run concurrently and have no global ordering or interleaving promise, so the claim is
    // that both subscribers saw the SAME sequence and that both members spoke — never that one
    // spoke before the other.
    const project = fixture({
      flow: 'name: probe\nconsumes: draft\nproduces: requirements\nsteps:\n  - parallel:\n      - id: alpha\n      - id: beta\n',
    });
    const host = createRunHost({ project: project.project, retain: 200 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    const one = watch(host, handle);
    const two = watch(host, handle);
    await Promise.all([one.drained, two.drained]);

    const ids = new Set(one.events.map((event) => ('stepId' in event ? event.stepId : undefined)));
    expect(ids.has('alpha')).toBe(true);
    expect(ids.has('beta')).toBe(true);
    expect(two.events).toStrictEqual(one.events);
  });
});

describe('AC-7 — retention over a real run, at both ends of the bound', () => {
  test('a subscriber attached after the start replays what was consumed, then the live tail', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 200 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    const late = host.subscribe(handle);
    if (!late) throw new Error('no subscription');
    const seen: Event[] = [];
    const drained = (async () => { for await (const event of late.events) seen.push(event); })();
    const gate = host.view(handle)?.gates[0];
    expect(host.answer(handle, { gateId: gate?.gateId, answer: 'advance' })).toBeNull();
    await drained;

    expect(late.missed).toBe(0);
    expect(seen[0]?.type, 'the replay did not begin at the run banner').toBe('info');
    expect(seen.filter((event) => event.type === 'gate')).toHaveLength(1);
    expect(seen[seen.length - 1]?.type).toBe('terminal');
  });

  test('at capacity zero a late subscriber gets the live tail and is told what it missed', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 0 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    const late = host.subscribe(handle);
    if (!late) throw new Error('no subscription');
    const seen: Event[] = [];
    const drained = (async () => { for await (const event of late.events) seen.push(event); })();
    const gate = host.view(handle)?.gates[0];
    expect(host.answer(handle, { gateId: gate?.gateId, answer: 'advance' })).toBeNull();
    await drained;

    expect(late.missed).toBeGreaterThan(0);
    expect(seen.filter((event) => event.type === 'gate'), 'the gate was replayed at capacity zero').toHaveLength(0);
    expect(seen[seen.length - 1]?.type).toBe('terminal');
  });
});

describe('AC-8 — the terminal event is the last one, and the failure after it joins nothing', () => {
  test('a failing run delivers exactly one terminal event and releases its subscribers normally', async () => {
    // `MOCK_FAIL_WRITE` makes the step whose prompt carries the marker throw, which is a vendor
    // failure with no `on_fail` to catch it. The channel drains before it settles, so the terminal
    // event is observed BEFORE the failure it reports is thrown.
    vi.stubEnv('MOCK_FAIL_WRITE', 'fail this step deliberately');
    const project = fixture({
      flow: 'name: probe\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: work\n    instructions: fail this step deliberately\n',
    });
    const host = createRunHost({ project: project.project, retain: 100 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    const seen = watch(host, handle);
    await seen.drained;

    const view = host.view(handle);
    expect(seen.events.filter((event) => event.type === 'terminal')).toHaveLength(1);
    expect(seen.events[seen.events.length - 1]?.type).toBe('terminal');
    expect(view?.terminal?.status).toBe('failed');
    expect(view?.failure, 'the rejection after the terminal event was not recorded').toContain('simulated adapter failure');
    expect(view?.state).toBe('ended');
    // Recorded beside the terminal event and never joined onto it: an `error` note is the run's own
    // and the failure is how the stream closed.
    expect(view?.terminal?.error).toContain('simulated adapter failure');
  });
});

describe('AC-9 — one answer per pending gate, over a run that is actually waiting', () => {
  test('advance lets the run continue, and every other shape is refused without disturbing it', async () => {
    const project = fixture({ flow: GATED_FLOW });
    project.addTicket({ id: 'T-0002', folder: 'T-0002-second', runsLog: 'ts run=1 flow=probe start stage=draft\n' });
    const host = createRunHost({ project: project.project, retain: 200 });

    const mine = await started(host, { flow: 'probe', ticket: TICKET_ID });
    const other = await started(host, { flow: 'probe', ticket: 'T-0002' });
    const watching = watch(host, mine);
    await until(() => (host.view(mine)?.gates.length ?? 0) > 0, 'the first run to reach its gate');
    await until(() => (host.view(other)?.gates.length ?? 0) > 0, 'the second run to reach its gate');

    const gate = host.view(mine)?.gates[0] as GateQuestionEvent;
    const foreign = host.view(other)?.gates[0] as GateQuestionEvent;
    expect(gate.gateId, 'the two runs share a correlation id, so the foreign case is vacuous')
      .not.toBe(foreign.gateId);

    expect(host.answer('run-nobody-minted', { gateId: gate.gateId, answer: 'advance' })).toBe('no-such-run');
    expect(host.answer(mine, { gateId: '99:99', answer: 'advance' })).toBe('no-such-gate');
    expect(host.answer(mine, { gateId: foreign.gateId, answer: 'advance' })).toBe('not-this-run');
    expect(host.answer(mine, { gateId: gate.gateId, answer: 'proceed' })).toBe('not-an-answer');
    expect(host.answer(mine, { gateId: gate.gateId })).toBe('not-an-answer');
    // Every refusal left the run where it was.
    expect(host.view(mine)?.state).toBe('running');
    expect(host.view(mine)?.gates).toHaveLength(1);

    expect(host.answer(mine, { gateId: gate.gateId, answer: 'advance' })).toBeNull();
    expect(host.answer(mine, { gateId: gate.gateId, answer: 'abort' }), 'a second answer settled something')
      .toBe('no-such-gate');
    await watching.drained;

    expect(host.view(mine)?.terminal?.status).toBe('completed');
    expect(host.view(mine)?.terminal?.stageAfter).toBe('requirements');
    expect(host.view(other)?.state).toBe('running');
    await host.shutdown();
  });

  test('abort ends the run at the gate rather than advancing it', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 200 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    const watching = watch(host, handle);
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');

    const gate = host.view(handle)?.gates[0] as GateQuestionEvent;
    expect(host.answer(handle, { gateId: gate.gateId, answer: 'abort' })).toBeNull();
    await watching.drained;

    expect(host.view(handle)?.terminal?.status).toBe('aborted');
    expect(host.view(handle)?.terminal?.stageAfter).toBe('draft');
  });
});

describe('AC-10 — a run this host started always has an answer channel', () => {
  test('a gate reached with nobody watching does not end the run undecided', async () => {
    // `no-answer-channel` is what a caller that supplied no `answerGate` reaches. A subscriber
    // going away — or never arriving — is not nobody having been there.
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 5 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate with no subscriber');
    const gate = host.view(handle)?.gates[0] as GateQuestionEvent;
    expect(host.answer(handle, { gateId: gate.gateId, answer: 'advance' })).toBeNull();
    await until(() => host.view(handle)?.state === 'ended', 'the run to end');

    expect(host.view(handle)?.terminal?.status).toBe('completed');
    expect(host.view(handle)?.terminal?.status).not.toBe('undecided');
    expect(project.runsLog()).not.toContain('undecided');
  });
});

describe('AC-11 — stopping one run cancels through the signal it was started with', () => {
  test('the run ends interrupted, keeps its worktree, and records the reason the host supplied', async () => {
    const project = fixture({ flow: WORKTREE_FLOW });
    const host = createRunHost({ project: project.project, retain: 200 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    const watching = watch(host, handle);
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');
    expect(project.worktrees(), 'the run obtained no worktree, so "keeps it" claims nothing').not.toStrictEqual([]);

    expect(host.stop(handle, 'stopped for the test')).toBeNull();
    await watching.drained;

    expect(host.view(handle)?.terminal?.status).toBe('interrupted');
    // A STRING reason, which `interruptionNote` reads off the signal — anything else silently
    // substitutes the thrown message, and the note is what `runs.log` carries.
    expect(project.runsLog()).toContain('interrupted stage=draft→draft');
    expect(project.runsLog()).toContain('error="stopped for the test"');
    // Q-0062: a run that did not finish keeps every worktree it obtained.
    expect(project.worktrees()).not.toStrictEqual([]);
  });

  test('a blank reason, an unknown handle and a run that is over are each refused', async () => {
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 10 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    expect(host.stop(handle, '   ')).toBe('not-a-reason');
    expect(host.stop('run-nobody-minted')).toBe('no-such-run');
    await watch(host, handle).drained;
    expect(host.stop(handle)).toBe('not-running');
    expect(host.view(handle)?.terminal?.status, 'the refused stop stopped the run anyway').toBe('completed');
  });
});

describe('AC-12 — shutdown releases every live run through the abandonment path', () => {
  test('it resolves only once the interrupted run\'s terminal record is on disk', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 50 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the run to reach its gate');
    expect(project.manifests()[0]?.status, 'the run was already finalised before shutdown').toBe('running');

    await host.shutdown();

    // Read straight after the await, with nothing between: iterator `return()` awaits the run's
    // interrupted-run persistence, so the manifest is finalised by the time shutdown resolves.
    const [manifest] = project.manifests();
    expect(manifest?.status).toBe('interrupted');
    expect(manifest?.ended_at).not.toBeNull();
    expect(host.view(handle)?.state).toBe('ended');
    expect(project.runsLog()).toContain('interrupted');
  });

  test('shutting down with nothing live resolves, and a second shutdown is harmless', async () => {
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 10 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await watch(host, handle).drained;

    await host.shutdown();
    await host.shutdown();

    expect(host.view(handle)?.terminal?.status).toBe('completed');
  });

});

describe('AC-13 — safety is inherited rather than re-implemented', () => {
  test('a ticket token that escapes the backlog root is refused by core through this host', async () => {
    // No second check here: confinement is `core`'s, and a weaker copy at a second surface is what
    // enforcing it in `core` exists to prevent (Q-0059).
    const project = fixture();
    const host = createRunHost({ project: project.project, retain: 10 });

    const escaping = await host.start({ flow: 'probe', ticket: '../../etc' });

    expect(escaping.started).toBe(false);
    if (escaping.started) throw new Error('unreachable');
    expect(escaping.refusal.condition).toContain('not a ticket token');
    expect(escaping.refusal.condition).toContain('one folder directly under the backlog root');
  });

  test('a run driven with no auto reaches its declared gate', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 50 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID });

    await until(() => (host.view(handle)?.gates.length ?? 0) > 0, 'the gate the host must not bypass');

    expect(host.view(handle)?.state).toBe('running');
    await host.shutdown();
  });

  test('and auto is passed only when the caller asked for it', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 50 });
    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID, auto: true });

    await watch(host, handle).drained;

    expect(host.view(handle)?.terminal?.status).toBe('completed');
    expect(host.view(handle)?.gates).toStrictEqual([]);
  });

  test('a dry run completes without the gate registry being consulted, and writes nothing', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 50 });
    const before = fs.readFileSync(path.join(project.ticketDir, 'ticket.md'), 'utf8');

    const handle = await started(host, { flow: 'probe', ticket: TICKET_ID, dry: true });
    const watching = watch(host, handle);
    await watching.drained;

    expect(host.view(handle)?.terminal?.status).toBe('completed');
    expect(host.view(handle)?.gates, 'a dry walk reached the gate registry').toStrictEqual([]);
    expect(watching.events.some((event) => event.type === 'gate'), 'a dry walk emitted a gate question').toBe(false);
    // Q-0116: a dry walk changes nothing the caller passed it, and it holds through this host.
    expect(fs.readFileSync(path.join(project.ticketDir, 'ticket.md'), 'utf8')).toBe(before);
    expect(project.runsLog(), 'a dry walk appended to runs.log').toBe('');
    expect(project.manifests(), 'a dry run wrote run history').toStrictEqual([]);
    // And the same flow through the same host DOES write, so the three clauses above are a
    // property of `dry` rather than of a fixture that happens to write nothing.
    const real = await started(host, { flow: 'probe', ticket: TICKET_ID, auto: true });
    await watch(host, real).drained;
    expect(project.runsLog()).toContain('completed');
    expect(project.manifests()).toHaveLength(1);
  });

  test('and a dry run takes no lock, so it runs beside one that holds the ticket', async () => {
    const project = fixture({ flow: GATED_FLOW });
    const host = createRunHost({ project: project.project, retain: 50 });
    const held = await started(host, { flow: 'probe', ticket: TICKET_ID });
    await until(() => (host.view(held)?.gates.length ?? 0) > 0, 'the holding run to reach its gate');

    const walk = await host.start({ flow: 'probe', ticket: TICKET_ID, dry: true });

    expect(walk.started, 'a dry walk was refused by a lock it does not take').toBe(true);
    await watch(host, handleOf(walk)).drained;
    expect(host.view(handleOf(walk))?.terminal?.status).toBe('completed');
    await host.shutdown();
  });
});

describe('AC-14 — the verdict is a property of the commit', () => {
  test('the fixture builds its own repository, outside this one, and reads none of it', () => {
    const project = fixture();
    expect(project.repoDir.startsWith(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')))
      .toBe(false);
    expect(fs.existsSync(path.join(project.repoDir, '.git'))).toBe(true);
    // Written by this fixture rather than found: nothing above reads the machine's git identity,
    // an existing `.harness/worktrees` or `.quorum/runs`, or anything on a network.
    write(path.join(project.repoDir, 'probe.txt'), 'x');
    expect(fs.existsSync(path.join(project.repoDir, 'probe.txt'))).toBe(true);
  });
});
