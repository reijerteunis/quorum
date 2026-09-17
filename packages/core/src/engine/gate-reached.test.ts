/**
 * Q-0129 AC-2 to AC-6 — what a gate question carries about the step that reached it.
 *
 * Over real runs rather than over a composed context, because the claim is about a value crossing
 * from the site that validates a verdict to the site that builds a question, and a fixture that
 * assigned the slot itself would prove only that the question spreads what it is handed.
 *
 * **AC-2's other half is `src/gate-evidence.source.test.ts`**, which asks whether a second path to
 * the value exists anywhere in the workspace. Neither can make the other's claim: this one shows the
 * one path works, and that one shows there is no second.
 *
 * **AC-6's `development.yaml` clause is `packages/shared/src/flow.test.ts`'s**, where the shipped
 * flows are already a declared read. Asserting it here would earn this task a named input for one
 * sentence, and the claim — that the one shipped flow with no verdict anywhere still has none — is
 * about the flow corpus rather than about the engine.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import type { Event, GateAnswerEnvelope, GateQuestionEvent, GateReached } from '@quorum/shared';

import { removeTempDirs, write } from '../../test/repo.js';
import { runFixture, stubAdapter } from '../../test/run-fixture.js';
import * as lifecycle from './lifecycle.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

/** Usage a vendor genuinely reported, so nothing here depends on the unpriced path. */
const BILLED = {
  vendor: 'stub', input_tokens: 1200, output_tokens: 34, cost_usd: 0.25,
  cached_input_tokens: null, cache_write_input_tokens: null,
};

/**
 * Findings whose own text carries each of the three separators the emitted prose joins on.
 *
 * Not decoration: **4 of this repository's 1,080 findings contain `" | "` themselves and 1,071
 * contain `": "`**, which is the measurement that refused parsing the `warn` message. A value that
 * travels structurally must survive them element for element, so the fixture is the hard case.
 */
const SEPARATOR_FINDINGS = [
  'major: src/wire.ts:12 the union is `refused | running | ended` and the row narrows it',
  'nit: src/host.ts:4 `missedCount: number | null` — the two are one field apart',
  'observation: the suite is red under load — that is somebody else\'s ticket',
];

/**
 * The same three separators under a PASSING verdict, which permits only nits and observations.
 *
 * Not a weaker fixture: *"A nit does not contradict an approval"* (2026-08-28) is what
 * `checkAgainstSchema` enforces, so an `approve` carrying a `major:` is refused before a gate is
 * ever reached — and the separators, which are what these fixtures are about, are unchanged.
 */
const PASSING_SEPARATOR_FINDINGS = [
  'nit: src/wire.ts:12 the union is `refused | running | ended` and the row narrows it',
  'nit: src/host.ts:4 `missedCount: number | null` — the two are one field apart',
  'observation: the suite is red under load — that is somebody else\'s ticket',
];

/** The gate question a run stopped at, which every clause here is about. */
function gateOf(events: Event[]): GateQuestionEvent {
  const gate = events.find((event) => event.type === 'gate');
  expect(gate, 'the fixture never reached a gate — this check has lost its subject').toBeDefined();
  return gate as GateQuestionEvent;
}

/** Answer every gate `abort`, so a fixture stops at the first question it asks. */
const aborting = (question: GateQuestionEvent): Promise<GateAnswerEnvelope> =>
  Promise.resolve({ gateId: question.gateId, answer: 'abort' as const });

/** A run whose steps are `steps`, drained to its terminal event. */
async function runWith(
  steps: Record<string, unknown>[],
  answer: (options: { prompt: string }, call: number) => Record<string, unknown> | Promise<Record<string, unknown>>,
  options: { config?: string } = {},
): Promise<{ events: Event[]; ticketDir: string; error: unknown }> {
  const fixture = runFixture({
    ...(options.config === undefined ? {} : { config: options.config }),
    run: { answerGate: aborting },
  });
  fixture.steps(steps);
  stubAdapter(async (invocation, call) => ({
    output: await answer({ prompt: invocation.prompt }, call), raw: '{}', usage: BILLED,
  }));
  const { events, error } = await fixture.settle();
  return { events, ticketDir: fixture.ticketDir, error };
}

describe('Q-0129 AC-2 — the question carries what the step that reached it decided', () => {
  test('the four members are the values that run wrote to disk, compared one at a time', async () => {
    // **The two sources are shown to AGREE rather than one of them being asserted twice.** The
    // artifact is what `steps.ts` writes from `output`, and the slot is built beside it from the
    // same `output`; comparing the question against a literal would pass equally well if the
    // question carried a value composed somewhere else entirely.
    const decided = {
      summary: 'two majors and a nit', document: '# review\n',
      verdict: 'changes-requested', findings: SEPARATOR_FINDINGS,
    };
    const { events, ticketDir } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 0 } },
      ],
      () => decided,
    );

    const reached = gateOf(events).reached;
    expect(reached, 'the gate carried nothing about the step that reached it').toBeDefined();
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(ticketDir, '.harness/run-1/review-verdict-iter-1.json'), 'utf8'),
    ) as Omit<GateReached, 'stepId'>;
    expect(reached?.verdict).toBe(onDisk.verdict);
    expect(reached?.findings).toStrictEqual(onDisk.findings);
    expect(reached?.summary).toBe(onDisk.summary);
    // The one member the artifact does not carry, because its path is what names the step there.
    expect(reached?.stepId).toBe('review');
  });
});

describe('Q-0129 AC-3 — provenance is execution order, except inside a parallel group', () => {
  test('(a) a chore-shaped flow carries the verdict step\'s values, not the step after it', async () => {
    // The two steps run in order, so the call number is what tells them apart — a prompt carries
    // its step's role and this fixture's steps declare none, which is the shipped shape.
    const { events, error } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
        { id: 'note', output: { write: 'dev/n.md' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      (_invocation, call) => call === 1
        ? { summary: 'the review', document: '# r\n', verdict: 'approve', findings: [] }
        : { summary: 'a note that decided nothing', document: '# n\n' },
    );

    expect(error).toBeUndefined();
    const reached = gateOf(events).reached;
    expect(reached?.stepId, 'a step that declared no verdict displaced one that did').toBe('review');
    expect(reached?.verdict).toBe('approve');
  });

  test('(b) a revise loop carries iteration 2\'s values and not iteration 1\'s', async () => {
    const { events } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 1 } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      (_invocation, call) => call === 1
        ? { summary: 'round one', document: '# r\n', verdict: 'changes-requested', findings: ['major: a.ts:1 x'] }
        : { summary: 'round two', document: '# r\n', verdict: 'approve', findings: [] },
    );

    const reached = gateOf(events).reached;
    expect(reached?.summary, 'the gate carried the iteration the loop had already replaced').toBe('round two');
    expect(reached?.verdict).toBe('approve');
    expect(reached?.findings).toStrictEqual([]);
  });

  test('(c) a parallel group is ordered by declaration, not by which member answered first', async () => {
    // **Synthetic by necessity, and the criterion says so rather than leaving a reader to hunt.**
    // No shipped flow has two verdict-declaring members in one `parallel:` group — `review.yaml`'s
    // panel members declare none and its `verdict` step is not in the group — and inventing one in
    // `harness/flows/` to make this reproducible is the non-goal at §5.8. So the fixture is built
    // here, and the discriminator is that the LATER-declared member answers FIRST: under the
    // last-writer-wins the slot has on its own, the first-declared member's values would be what a
    // reader saw, chosen by how fast a vendor replied.
    const fixture = runFixture({ run: { answerGate: aborting } });
    fixture.role('alpha', '---\n---\nthe first member\n');
    fixture.role('beta', '---\n---\nthe second member\n');
    fixture.steps([
      {
        parallel: [
          { id: 'alpha', role: 'alpha', output: { write: 'dev/a.md', verdict: 'approve|changes-requested' } },
          { id: 'beta', role: 'beta', output: { write: 'dev/b.md', verdict: 'approve|changes-requested' } },
        ],
      },
      { gate: 'human', reason: 'approve to advance' },
    ]);
    const finished: string[] = [];
    stubAdapter(async (invocation) => {
      const first = invocation.prompt.includes('# Role: beta');
      await new Promise((resolve) => { setTimeout(resolve, first ? 5 : 60); });
      finished.push(first ? 'beta' : 'alpha');
      return {
        output: { summary: first ? 'beta decided' : 'alpha decided', document: '# d\n', verdict: 'approve', findings: [] },
        raw: '{}', usage: BILLED,
      };
    });

    const { events } = await fixture.settle();

    // The fixture really did complete out of order, so the assertion below is about reconciliation
    // rather than about an ordering that happened to agree.
    expect(finished, 'the members completed in declaration order — the fixture proves nothing')
      .toStrictEqual(['beta', 'alpha']);
    expect(gateOf(events).reached?.stepId, 'the group was ordered by completion rather than by declaration')
      .toBe('beta');
  });
});

describe('Q-0129 AC-4 — the exact validated values, and an override changes nothing', () => {
  test('a verdict_file at a path of the author\'s choosing yields identical evidence', async () => {
    const decided = { summary: 'same either way', document: '# r\n', verdict: 'approve', findings: PASSING_SEPARATOR_FINDINGS };
    const defaulted = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => decided,
    );
    vi.restoreAllMocks();
    const overridden = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested', verdict_file: 'review/chosen-{run}.json' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => decided,
    );

    expect(fs.existsSync(path.join(overridden.ticketDir, 'review/chosen-1.json')),
      'the override did not move the artifact — the fixture proves nothing').toBe(true);
    expect(gateOf(overridden.events).reached).toStrictEqual(gateOf(defaulted.events).reached);
  });

  test('a findings array survives element for element, separators and all', async () => {
    const { events, error } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => ({ summary: 'a review', document: '# r\n', verdict: 'approve', findings: PASSING_SEPARATOR_FINDINGS }),
    );

    expect(error).toBeUndefined();
    expect(gateOf(events).reached?.findings).toStrictEqual(PASSING_SEPARATOR_FINDINGS);
  });

  test('the step id is the one the trace carries, so the screen and the log name one step', async () => {
    // AC-4's identity half, checked rather than argued. A fan-out child's id is
    // `<parent>:<task>` and is INTERPOLATED before it reaches either site, so the claim is that the
    // gate carries the same value the `done` event does — not that it looks like a step id.
    const { events, error } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => ({ summary: 'a review', document: '# r\n', verdict: 'approve', findings: [] }),
    );

    expect(error).toBeUndefined();
    const done = events.filter((event) => event.type === 'done').map((event) => event.stepId);
    expect(done, 'no step reported done — this clause has lost its subject').toContain('review');
    expect(gateOf(events).reached?.stepId, 'the gate names a step the trace does not').toBe(done.at(-1));
  });

  test('an empty findings array and an empty summary are carried as the values they are', async () => {
    const { events } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => ({ summary: '', document: '# r\n', verdict: 'approve', findings: [] }),
    );

    expect(gateOf(events).reached).toStrictEqual({ stepId: 'review', verdict: 'approve', findings: [], summary: '' });
  });
});

describe('Q-0129 AC-5 — both gate kinds carry it, from one slot', () => {
  test('an exhaustion gate carries the verdict of the step whose refusal reached it', async () => {
    const { events } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 0 } },
      ],
      () => ({ summary: 'it is not ready', document: '# r\n', verdict: 'changes-requested', findings: ['major: a.ts:1 x'] }),
    );

    const gate = gateOf(events);
    expect(gate.kind).toBe('human-locked');
    expect(gate.reached).toStrictEqual({
      stepId: 'review', verdict: 'changes-requested', summary: 'it is not ready', findings: ['major: a.ts:1 x'],
    });
  });

  test('an author-declared gate reached on a PASSING verdict carries it too', async () => {
    // The clause that fails against a population anchored on the fail path: `handleFail` never runs
    // here, and this is the gate 154 of this repository's 157 author-declared answers were given at.
    const { events } = await runWith(
      [
        { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'review', max_iterations: 1 } },
        { gate: 'human', reason: 'approve to advance' },
      ],
      () => ({ summary: 'nothing to report', document: '# r\n', verdict: 'approve', findings: [] }),
    );

    const gate = gateOf(events);
    expect(gate.kind).toBe('human');
    expect(gate.reached, 'a gate reached on a passing verdict carried nothing').toStrictEqual({
      stepId: 'review', verdict: 'approve', summary: 'nothing to report', findings: [],
    });
  });

  test('a member that exhausts carries its own decision, not the sibling that landed in its window', async () => {
    // **The interleaving is staged rather than described**, on Q-0127 round 4's precedent: a race a
    // finding says no test can stage is staged by hooking the call that opens the window. Every
    // member of a `parallel:` group shares one `RunContext`, and the window is the `await` on the
    // exhaustion record — between this member's own assignment and the question built after it.
    // **It cannot pass vacuously**: the sibling is held until the hook releases it, so a hook that
    // never fired leaves the group waiting rather than reporting a green with no window staged.
    let releaseBeta = (): void => {};
    const betaHeld = new Promise<void>((resolve) => { releaseBeta = resolve; });
    const recordEvent = lifecycle.recordEvent;
    vi.spyOn(lifecycle, 'recordEvent').mockImplementation(async (...args) => {
      await recordEvent(...args);
      if (args[2] !== 'exhausted') return;
      releaseBeta();
      // A macrotask, so every microtask the sibling's continuation is made of has run: from its
      // stub's resumption to `context.reached = …` nothing awaits, so the slot holds the SIBLING's
      // decision by the time this returns. That is the interleaving rather than a hope about one.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    });

    const fixture = runFixture({ run: { answerGate: aborting } });
    fixture.role('alpha', '---\n---\nthe member that stops\n');
    fixture.role('beta', '---\n---\nthe member that finishes\n');
    fixture.steps([
      {
        parallel: [
          { id: 'alpha', role: 'alpha', output: { write: 'dev/a.md', verdict: 'approve|changes-requested' }, on_fail: { goto: 'alpha', max_iterations: 0 } },
          { id: 'beta', role: 'beta', output: { write: 'dev/b.md', verdict: 'approve|changes-requested' } },
        ],
      },
    ]);
    stubAdapter(async (invocation) => {
      if (invocation.prompt.includes('# Role: beta')) {
        await betaHeld;
        return { output: { summary: 'beta decided', document: '# b\n', verdict: 'approve', findings: [] }, raw: '{}', usage: BILLED };
      }
      return {
        output: { summary: 'alpha stopped', document: '# a\n', verdict: 'changes-requested', findings: ['major: a.ts:1 the shape is wrong'] },
        raw: '{}', usage: BILLED,
      };
    });

    const { events } = await fixture.settle();

    // The sibling really did decide before the question was built, so the clause below is about
    // isolation rather than an interleaving that never happened: `steps.ts` assigns the slot BEFORE
    // it emits `done`, so a `done` for beta ahead of the question IS that assignment, observed.
    const sibling = events.findIndex((event) => event.type === 'done' && event.stepId === 'beta');
    const asked = events.findIndex((event) => event.type === 'gate');
    expect(sibling, 'the sibling never finished — the fixture proves nothing').toBeGreaterThan(-1);
    expect(asked, 'no question was asked — this clause has lost its subject').toBeGreaterThan(-1);
    expect(sibling, 'the sibling had not decided when the question was built — the window was not staged')
      .toBeLessThan(asked);
    expect(gateOf(events).reached, 'the question carried the sibling that landed in its window').toStrictEqual({
      stepId: 'alpha', verdict: 'changes-requested', summary: 'alpha stopped',
      findings: ['major: a.ts:1 the shape is wrong'],
    });
  });
});

describe('Q-0129 AC-6 — absence is absence', () => {
  test('a script step\'s failure presents a question carrying no field at all', async () => {
    const { events } = await runWith(
      [
        { id: 'check', type: 'script', run: 'exit 3', on_fail: { goto: 'check', max_iterations: 0 } },
      ],
      () => ({ summary: 'never called' }),
    );

    const gate = gateOf(events);
    expect(gate.kind).toBe('human-locked');
    // Absent, not an object of empty members: `in` distinguishes the two where a truthiness test
    // would not, and it is the distinction AC-6 is about.
    expect('reached' in gate, 'the question carried an empty decision rather than none').toBe(false);
    expect(gate.reached).toBeUndefined();
  });

  test('an integrate step\'s failure presents one carrying no field either', async () => {
    const { events } = await runWith(
      [
        {
          id: 'integrate', type: 'integrate', branches: [], run_tests: true, expect: 'pass',
          output: { write: 'dev/integration.md' }, on_fail: { goto: 'integrate', max_iterations: 0 },
        },
      ],
      () => ({ summary: 'never called' }),
      { config: 'adapterOverride: mock\nrepo:\n  base_branch: main\ncommands:\n  test: exit 1\n' },
    );

    const gate = gateOf(events);
    expect(gate.kind).toBe('human-locked');
    expect('reached' in gate, 'the question carried an empty decision rather than none').toBe(false);
  });

  test('a step that declares no verdict is not handed the decision an answered gate carried', async () => {
    // One run, two questions. `review` decides, the author-declared gate carries that decision and
    // is answered `advance`, and then a step that decides NOTHING fails — so what the reader is
    // handed next must describe that failure rather than re-present a decision they have already
    // answered on. Three call sites reach `handleFail` and only the agent step's carries a verdict,
    // which is what the second question here is empty BECAUSE of, rather than in spite of.
    const fixture = runFixture({
      run: {
        answerGate: (question: GateQuestionEvent): Promise<GateAnswerEnvelope> => Promise.resolve({
          gateId: question.gateId, answer: question.kind === 'human' ? 'advance' as const : 'abort' as const,
        }),
      },
    });
    fixture.steps([
      { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
      { gate: 'human', reason: 'approve to advance' },
      { id: 'check', type: 'script', run: 'exit 3', on_fail: { goto: 'check', max_iterations: 0 } },
    ]);
    stubAdapter(() => ({
      output: { summary: 'nothing to report', document: '# r\n', verdict: 'approve', findings: [] },
      raw: '{}', usage: BILLED,
    }));

    const { events } = await fixture.settle();

    const gates = events.filter((event): event is GateQuestionEvent => event.type === 'gate');
    expect(gates.map((gate) => gate.kind), 'the run did not reach both questions — this clause has lost its subject')
      .toStrictEqual(['human', 'human-locked']);
    expect(gates[0]?.reached?.stepId, 'the gate that followed the decision carried nothing').toBe('review');
    expect('reached' in gates[1]!, 'a script step\'s failure was presented as the decision the reader had already answered')
      .toBe(false);
  });

  test('a later gate is not handed an earlier RUN\'s decision', async () => {
    // Two runs over one ticket, the first deciding something and the second declaring no verdict at
    // all. The slot is run-scoped, so the second run's gate carries nothing — which a slot that
    // outlived its run, or one read back off the artifact the first run left on disk, would fail.
    const fixture = runFixture({ run: { answerGate: aborting } });
    fixture.steps([
      { id: 'review', output: { write: 'dev/r.md', verdict: 'approve|changes-requested' } },
      { gate: 'human', reason: 'approve to advance' },
    ]);
    stubAdapter(() => ({ output: { summary: 'run one', document: '# r\n', verdict: 'approve', findings: [] }, raw: '{}', usage: BILLED }));
    const first = await fixture.settle();
    expect(gateOf(first.events).reached?.summary).toBe('run one');

    vi.restoreAllMocks();
    write(path.join(fixture.ticketDir, 'runs.log'), 'ts run=1 flow=chore start stage=requirements\n');
    const second = runFixture({ run: { answerGate: aborting } });
    second.steps([
      { id: 'note', output: { write: 'dev/n.md' } },
      { gate: 'human', reason: 'approve to advance' },
    ]);
    stubAdapter(() => ({ output: { summary: 'run two', document: '# n\n' }, raw: '{}', usage: BILLED }));
    const events = (await second.settle()).events;

    expect('reached' in gateOf(events), 'a run with no verdict anywhere carried one').toBe(false);
  });
});
