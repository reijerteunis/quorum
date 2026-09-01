import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { eventSchema } from '@quorum/shared';
import type { Event, GateQuestionEvent } from '@quorum/shared';

import fixtureText from '../../../../contracts/Q-0050/run-messages.fixture.json' with { type: 'json' };
import { git, removeTempDirs, walk, write } from '../../test/repo.js';
import { manifestOf, runFixture, stubAdapter } from '../../test/run-fixture.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

/** Usage a vendor genuinely reported, so an assertion on the `done` payload has a price in it. */
const BILLED = {
  vendor: 'stub', input_tokens: 1200, output_tokens: 34, cost_usd: 0.25,
  cached_input_tokens: null, cache_write_input_tokens: null,
};

/** What a review step answers when it approves. */
const approving = { summary: 'a review', document: '# review\n', verdict: 'approve', findings: [] };

/** …and when it does not. */
const revising = { summary: 'a review', document: '# review\n', verdict: 'changes-requested', findings: ['major: a.ts:1 x', 'nit: b.ts:2 y'] };

const messages = (events: Event[], type: Event['type']): string[] =>
  events.filter((event) => event.type === type).map((event) => (event as { message: string }).message);

describe('Q-0052 AC-6 — the declarative write loop, with {run} in scope', () => {
  test('AC-6b — a run-scoped write path lands under the id THIS run was allocated', async () => {
    // Q-0057's behaviour half, which `core` could not receive because there was no write loop. The
    // ticket's runs.log already ends at run=2 — nextRunId's own input, not a second source — so a
    // hard-coded 1, or a path tracking the iteration counter, cannot pass. Red against an
    // implementation that drops `{run}` from the interpolation values: the review lands beside the
    // flat legacy files and the next chore run silently overwrites it.
    const fixture = runFixture();
    write(path.join(fixture.ticketDir, 'runs.log'),
      'ts run=1 flow=chore start stage=requirements\nts run=2 flow=chore start stage=requirements\n');
    fixture.steps([{ id: 'review', output: { write: 'review/chore/run-{run}/chore-iter-{iter}.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# the review\n' }, raw: '{}', usage: BILLED }));

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(fs.readFileSync(path.join(fixture.ticketDir, 'review/chore/run-3/chore-iter-1.md'), 'utf8')).toBe('# the review\n');
    // AC-6a: the `info` names the path relative to the ticket folder, not the absolute one.
    expect(messages(events, 'info')).toContain('review: wrote review/chore/run-3/chore-iter-1.md');
  });

  test('AC-6a — every declared path receives the document, and `raw` where there is none', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'review', output: { write: 'dev/one.md', writes: ['dev/two-{iter}.md'] } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# doc\n' }, raw: 'the raw answer', usage: BILLED }));

    await fixture.settle();

    expect(fs.readFileSync(path.join(fixture.ticketDir, 'dev/one.md'), 'utf8')).toBe('# doc\n');
    expect(fs.readFileSync(path.join(fixture.ticketDir, 'dev/two-1.md'), 'utf8')).toBe('# doc\n');
  });

  test('AC-6c — the verdict file defaults into .harness/ and carries three keys', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } }]);
    stubAdapter(() => ({ output: approving, raw: '{}', usage: BILLED }));

    await fixture.settle();

    expect(JSON.parse(fs.readFileSync(path.join(fixture.ticketDir, '.harness/run-1/review-verdict-iter-1.json'), 'utf8')))
      .toStrictEqual({ verdict: 'approve', findings: [], summary: 'a review' });
  });

  test('AC-6c — findings default to an empty list rather than being omitted', async () => {
    // The `?? []` in the verdict file, which nothing else observes: a vocabulary that is not a
    // review vocabulary still writes `findings`, so a consumer never has to test for the key.
    const fixture = runFixture();
    fixture.steps([{ id: 'gate-check', output: { verdict: 'ready|needs-input' } }]);
    stubAdapter(() => ({ output: { summary: 's', verdict: 'ready', findings: [] }, raw: '{}', usage: BILLED }));

    await fixture.settle();

    expect(JSON.parse(fs.readFileSync(path.join(fixture.ticketDir, '.harness/run-1/gate-check-verdict-iter-1.json'), 'utf8')))
      .toStrictEqual({ verdict: 'ready', findings: [], summary: 's' });
  });

  test('AC-6d — the first option passes; anything else warns with the findings and takes the edge', async () => {
    const fixture = runFixture();
    fixture.steps([
      { id: 'implement' },
      { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'implement', max_iterations: 1 } },
    ]);
    stubAdapter((_options, call) => ({ output: call === 2 ? revising : { summary: 's' }, raw: '{}', usage: BILLED }));

    const { events } = await fixture.settle();

    expect(messages(events, 'warn')).toContain('review: changes-requested — major: a.ts:1 x | nit: b.ts:2 y');
    expect(messages(events, 'warn')).toContain('review: iteration 1/1 → goto implement');
  });

  test('AC-6d — a verdict that IS the first option takes no edge at all', async () => {
    // The other half of the same branch. Without it, an implementation that always routes through
    // `handleFail` passes the row above.
    const fixture = runFixture();
    fixture.steps([{ id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 1 } }]);
    stubAdapter(() => ({ output: approving, raw: '{}', usage: BILLED }));

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(messages(events, 'warn')).toStrictEqual([]);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed', stageAfter: 'reviewed' });
  });
});

describe('Q-0052 AC-9 — step and done gain their first producers in core', () => {
  test('AC-9a — the two payloads are the spike\'s, to the character', async () => {
    const fixture = runFixture({ config: 'adapterOverride: codex\n' });
    fixture.role('code-reviewer', '---\nadapter: codex\nmodel: gpt-5\n---\nA reviewer.\n');
    fixture.steps([{ id: 'review', role: 'code-reviewer', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } }]);
    stubAdapter(() => ({ output: approving, raw: '{}', usage: BILLED, ms: 42 }));

    const { events } = await fixture.settle();

    expect(events.filter((event) => event.type === 'step')).toStrictEqual([
      { type: 'step', stepId: 'review', message: 'codex/gpt-5 role=code-reviewer' },
    ]);
    expect(events.filter((event) => event.type === 'done')).toStrictEqual([
      { type: 'done', stepId: 'review', message: 'verdict=approve cost=$0.250 42ms' },
    ]);
  });

  test('AC-9a — a step with no model and no role names neither, and an unpriced call says so', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', ms: 7, usage: { ...BILLED, cost_usd: null } }));

    const { events } = await fixture.settle();

    expect(events.filter((event) => event.type === 'step')).toStrictEqual([
      { type: 'step', stepId: 'implement', message: 'mock role=-' },
    ]);
    expect(events.filter((event) => event.type === 'done')).toStrictEqual([
      { type: 'done', stepId: 'implement', message: 'cost=n/a (1234 tokens, vendor reports no price) 7ms' },
    ]);
  });

  test('AC-9b/AC-13b — a gate emits neither, and a step that throws emits no done', async () => {
    // Emitting around `runStep` would fire for a gate step and for a fan-out parent, which the
    // spike never does; and `ui.done` is BELOW the throw, so a failed step has a `step` event and
    // no `done`. Red against an implementation that emits `done` in a `finally`.
    const fixture = runFixture({ run: { auto: true } });
    fixture.steps([{ id: 'approve', gate: 'human', reason: 'approve to continue' }, { id: 'implement' }]);
    stubAdapter(() => { throw new Error('the vendor died'); });

    const { events } = await fixture.settle();

    expect(events.filter((event) => event.type === 'step').map((event) => event.stepId)).toStrictEqual(['implement']);
    expect(events.filter((event) => event.type === 'done')).toStrictEqual([]);
  });

  test('AC-9b — a fan-out parent emits neither, because it is a container and its members speak', async () => {
    // Replaced at Q-0053 AC-1. It used to assert the dispatch REFUSAL — `(error as Error).message`
    // containing `'Q-0053'` — which the moment dispatch landed could only go red. What it was
    // standing in for is the property below: the parent is not a step, so nothing announces it, and
    // each child announces itself under its own interpolated id.
    const fixture = runFixture();
    fixture.role('developer-backend', '---\nadapter: mock\n---\nA developer.\n');
    fixture.ticketFile('solution/tasks.yaml', 'tasks:\n  - id: t1\n    role: backend\n    title: first\n');
    // `branch` is declared, as every shipped fan-out declares it. Without it the child falls back to
    // `harness/<id>/<step id>` and the default step id carries a colon, which git refuses as a
    // refname — reported by Q-0053 and preserved, since development.yaml spells the branch itself.
    fixture.steps([{ id: 'dev', fan_out: {}, step: { id: 'dev:{task.id}', branch: 'harness/{id}/{task.id}' } }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    const announced = events.filter((event) => event.type === 'step' || event.type === 'done');
    expect(announced.map((event) => event.stepId)).toStrictEqual(['dev:t1', 'dev:t1']);
    expect(announced.map((event) => event.stepId)).not.toContain('dev');
  });

  test('AC-9b — an integrate step announces itself and its result under its own id', async () => {
    // The other composite kind through the same composed run: `integrate` IS a step, so unlike a
    // fan-out parent it emits both, and its `step` event carries the target it resolved.
    const fixture = runFixture();
    fixture.steps([{ id: 'integrate', type: 'integrate', branches: [], run_tests: false }]);

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(events.filter((event) => event.type === 'step')).toStrictEqual([
      { type: 'step', stepId: 'integrate', message: 'integrate → harness/Q-0052/integration' },
    ]);
    expect(events.filter((event) => event.type === 'done')).toStrictEqual([
      { type: 'done', stepId: 'integrate', message: '0 branch(es) on harness/Q-0052/integration' },
    ]);
  });

  test('AC-9c — a parallel group carries no id and each member stamps its own', async () => {
    // Q-0050 round 6, Major 1 — found independently by both vendors, on flows this ticket is itself
    // run under. Red against an implementation relying on `engine.ts`'s single mutable slot: a group
    // stamps nothing and two concurrent members share one slot.
    const fixture = runFixture();
    fixture.steps([{ parallel: [{ id: 'a' }, { id: 'b' }] }]);
    stubAdapter((options) => {
      options.onEvent?.({ type: 'stdout', line: 'a line from a member' });
      return { output: { summary: 's' }, raw: '{}', usage: BILLED };
    });

    const { events } = await fixture.settle();

    const stamped = events.filter((event) => event.type === 'stdout').map((event) => event.stepId);
    expect(stamped.slice().sort()).toStrictEqual(['a', 'b']);
    expect(stamped).not.toContain('undefined');
    expect(stamped).not.toContain(undefined);
  });

  test('AC-9d — every event a composed agent run yields parses against the shared union', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } }]);
    stubAdapter((options) => {
      options.onEvent?.({ type: 'spawn', vendor: 'stub', cmd: 'stub --headless' });
      options.onEvent?.({ type: 'stdout', line: 'working' });
      return { output: approving, raw: '{}', usage: BILLED };
    });

    const { events } = await fixture.settle();

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['info', 'step', 'spawn', 'stdout', 'done', 'terminal']),
    );
    for (const event of events) expect(() => eventSchema.parse(event), JSON.stringify(event)).not.toThrow();
  });
});

/**
 * How long the prompt AC-11's fixture builds is — the one number in the dry-run `info` a step's own
 * declaration decides, so it is written down rather than matched loosely.
 *
 * Derived from the fixture below and pinned: `toContain('dry run — prompt')` would pass over a
 * prompt that lost every section, which is the number the line exists to report.
 */
const DRY_PROMPT_LENGTH = 298;

describe('Q-0053 AC-12 — a failed integrate aborts, and the run puts the ticket branch back', () => {
  test('the merge an aborted run made is rolled back, and the rollback says so', async () => {
    // The half of AC-12 that only a COMPOSED run can show: `runIntegrate` merges task branches
    // before anyone knows the outcome, and `lifecycle.finish` is what restores the branch when the
    // run does not complete. Without it the next stage measures its red phase against a tree that
    // already holds the implementation.
    const fixture = runFixture();
    const branch = 'harness/Q-0052/integration';
    git(fixture.repoDir, 'branch', branch);
    git(fixture.repoDir, 'checkout', '-q', '-b', 'harness/Q-0052/t1', branch);
    write(path.join(fixture.repoDir, 'a.txt'), 'a\n');
    git(fixture.repoDir, 'add', '--', 'a.txt');
    git(fixture.repoDir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'task work');
    git(fixture.repoDir, 'checkout', '-q', 'main');
    const before = git(fixture.repoDir, 'rev-parse', branch);
    fixture.steps([{ id: 'integrate', type: 'integrate', branches: ['harness/{id}/t1'], run_tests: 'exit 1' }]);

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'aborted', stageAfter: 'requirements' });
    expect(git(fixture.repoDir, 'rev-parse', branch), 'the merge integrate made must not survive an aborted run').toBe(before);
    expect(messages(events, 'warn').join('\n')).toContain(`${branch}: rolled back to ${before.slice(0, 7)}`);
  });
});

describe('Q-0052 AC-11 — a dry run resolves everything and invokes nothing', () => {
  test('AC-11b/11c/11d — it announces the step, writes nothing, and leaves the ticket byte-identical', async () => {
    const fixture = runFixture({ run: { dry: true } });
    fixture.steps([{ id: 'implement', worktree: true, output: { write: 'dev/report.md' } }]);
    const stub = stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));
    const before = walk(fixture.ticketDir);
    const ticketBytes = fs.readFileSync(path.join(fixture.ticketDir, 'ticket.md'), 'utf8');

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(messages(events, 'info')).toContain(`implement: dry run — prompt ${DRY_PROMPT_LENGTH} chars, schema summary,document`);
    expect(stub.calls).toStrictEqual([]);
    expect(walk(fixture.ticketDir)).toStrictEqual(before);
    expect(fs.readFileSync(path.join(fixture.ticketDir, 'ticket.md'), 'utf8')).toBe(ticketBytes);
    expect(fs.existsSync(path.join(fixture.ticketDir, 'runs.log'))).toBe(false);
    expect(fs.existsSync(path.join(fixture.repoDir, '.quorum'))).toBe(false);
    expect(fs.existsSync(path.join(fixture.repoDir, '.harness', 'worktrees'))).toBe(false);
  });

  test('AC-11a — a role file that is not there fails the dry run', async () => {
    const fixture = runFixture({ run: { dry: true } });
    fixture.steps([{ id: 'implement', role: 'nobody-wrote-this' }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    const { error } = await fixture.settle();

    expect((error as Error).message).toContain('role "nobody-wrote-this" not found');
  });

  test('AC-11a — an adapter Quorum does not know fails the dry run', async () => {
    // The registry left in place: what makes `--dry` worth running is that it refuses the things a
    // paid run would refuse, before anything is paid for.
    const fixture = runFixture({ config: 'adapterOverride: nosuchvendor\n', run: { dry: true } });
    fixture.steps([{ id: 'implement' }]);

    const { error } = await fixture.settle();

    expect((error as Error).message).toContain('unknown adapter "nosuchvendor"');
  });

  test('AC-11a — a diff range whose endpoint does not resolve fails the dry run', async () => {
    const fixture = runFixture({ run: { dry: true } });
    fixture.steps([{ id: 'review', input: { diff: '{base}...harness/{id}/nobody-created-this' } }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    const { error } = await fixture.settle();

    expect((error as Error).message).toContain('harness/Q-0052/nobody-created-this');
  });
});

describe('Q-0052 AC-13 — the scenarios Q-0050 deferred here, now that a step kind can fail', () => {
  test('AC-13c — a run cancelled mid-step records interrupted, leaves no done, and moves no stage', async () => {
    // What "mid-step" can mean here, stated rather than implied: `core` passes no signal into an
    // adapter (the spike passes none either), so the abort is observed by whatever throws next. The
    // fixture aborts DURING the adapter call and then fails the ticket write, which is the window
    // in which the occurrence is still open — the only one in which the run's own catch decides its
    // status. An occurrence the step already closed keeps the status the step gave it.
    const fixture = runFixture();
    const abort = new AbortController();
    fixture.opts.signal = abort.signal;
    fixture.steps([{ id: 'implement', output: { write: 'dev/report.md' } }]);
    stubAdapter(() => {
      abort.abort('received SIGINT');
      return { output: { summary: 's', document: '# d\n' }, raw: '{}', usage: BILLED };
    });
    vi.spyOn(fixture.opts.backlog, 'writeFile').mockImplementation(() => { throw new Error('interrupted mid-write'); });

    const { events, error } = await fixture.settle();

    expect(error).toBeInstanceOf(Error);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'interrupted', error: 'received SIGINT' });
    expect(events.filter((event) => event.type === 'done')).toStrictEqual([]);
    expect(fixture.opts.ticket.meta.stage).toBe('requirements');
    const occurrence = manifestOf(fixture.repoDir).steps[0];
    expect(occurrence?.status).toBe('interrupted');
    expect(occurrence?.error?.category).toBe('interrupted');
  });

  test('AC-13e — the exhausted record is on disk before the exhaustion gate asks', async () => {
    // Q-0050 AC-6d, unreachable there because `handleFail` had no caller in packages/core/src. It
    // has two now, and this is the first composed run to reach it — so the criterion's own method,
    // reading BOTH records from disk inside the still-unresolved answerGate, works at last.
    const fixture = runFixture();
    let onDisk: { ticket: string; log: string } | null = null;
    fixture.opts.answerGate = (question: GateQuestionEvent) => {
      onDisk = {
        ticket: fs.readFileSync(path.join(fixture.ticketDir, 'ticket.md'), 'utf8'),
        log: fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8'),
      };
      return Promise.resolve({ gateId: question.gateId, answer: 'abort' as const });
    };
    fixture.steps([{ id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 0 } }]);
    stubAdapter(() => ({ output: revising, raw: '{}', usage: BILLED }));

    const { events } = await fixture.settle();

    expect(onDisk).not.toBeNull();
    expect(onDisk!.ticket).toContain('status: exhausted');
    expect(onDisk!.log).toContain('run=1 exhausted stage=requirements→requirements cost=0');
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'aborted', stageAfter: 'requirements' });
  });
});

describe('Q-0052 AC-14 — the gate oracle\'s last four leaf keys gain their first reader', () => {
  /** The four keys `contracts/Q-0050/run-messages.fixture.json` says a gate question carries. */
  const KEYS = Object.keys(fixtureText.gate);

  /** Everything a gate event carries beyond the two fields the correlation itself needs. */
  const payloadKeys = (event: GateQuestionEvent): string[] =>
    Object.keys(event).filter((key) => key !== 'type' && key !== 'gateId');

  async function gateOf(steps: Record<string, unknown>[]): Promise<GateQuestionEvent> {
    const fixture = runFixture();
    fixture.opts.answerGate = (question: GateQuestionEvent) =>
      Promise.resolve({ gateId: question.gateId, answer: 'abort' as const });
    fixture.steps(steps);
    stubAdapter(() => ({ output: revising, raw: '{}', usage: BILLED }));
    const { events } = await fixture.settle();
    const gate = events.find((event) => event.type === 'gate');
    expect(gate, 'the fixture must actually reach a gate').toBeDefined();
    return gate as GateQuestionEvent;
  }

  test('an exhaustion gate carries all four, and an author-declared gate carries all but retry', async () => {
    // The property the oracle's "single oracle" claim needs: a key added to the fixture with no
    // reader fails here. `retry` is present only when the gate offers one, which is what separates
    // the two flavours.
    expect(KEYS).toStrictEqual(['kind', 'reason', 'ticketDir', 'retry']);

    const exhaustion = await gateOf([
      { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 0 } },
    ]);
    expect(payloadKeys(exhaustion)).toStrictEqual(KEYS);
    expect(exhaustion.kind).toBe('human-locked');
    expect(exhaustion.retry).toBe('review');

    vi.restoreAllMocks();
    const declared = await gateOf([{ id: 'approve', gate: 'human', reason: 'approve to continue' }]);
    expect(payloadKeys(declared)).toStrictEqual(KEYS.filter((key) => key !== 'retry'));
  });

  test('ticketDir is the ticket folder a human is being sent to look at', async () => {
    const fixture = runFixture();
    fixture.opts.answerGate = (question: GateQuestionEvent) =>
      Promise.resolve({ gateId: question.gateId, answer: 'abort' as const });
    fixture.steps([{ id: 'approve', gate: 'human', reason: 'approve to continue' }]);

    const { events } = await fixture.settle();
    const gate = events.find((event) => event.type === 'gate') as GateQuestionEvent;

    expect(gate.ticketDir).toBe(fixture.ticketDir);
    expect(fs.existsSync(path.join(gate.ticketDir, 'ticket.md'))).toBe(true);
  });
});
