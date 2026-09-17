// @vitest-environment jsdom
/**
 * Q-0016 AC-7 to AC-14 — what the gate screen draws, and what it will not send.
 *
 * THE DOM COMES FROM THE DOCBLOCK ABOVE AND FROM NOWHERE ELSE, and the file is `.test.ts` rather
 * than `.test.tsx` — both for the reasons `ticket-page.test.ts`'s and `backlog-board.test.ts`'s
 * headers give: `apps/web/vitest.config.js` is pinned byte for byte by the discovery guard, and
 * `testFilesIn` matches a `.test.ts` suffix only, so a `.tsx` suite would run while being invisible
 * to that guard and hashed by no turbo input.
 *
 * It sits under `src/` because it reaches for nothing a browser does not have: a document, React,
 * and the app's own modules. Every request is injected, so nothing here opens a socket or answers a
 * gate anywhere but into this file's own array.
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import {
  FINDING_SEVERITIES, gateAnswerSchema, OBSERVATION_TAG,
  type GateAnswer, type GateQuestionEvent,
} from '@quorum/shared';

import { App } from './app.js';
import type { DaemonRequest, DaemonResponse } from './daemon-client.js';
import { runDetailPath, runGatePath } from './daemon-endpoints.js';
import {
  ANSWER_LABEL, ANSWERED_PREFIX, answersOffered, GATE_GONE, GATE_GONE_CODE, GATE_HEADING,
  GATE_SUBJECT_TEXT, GATE_SUBJECTS, gateSubjectOf, GateScreen, groupReported, LOOK_AGAIN_LABEL,
  NO_FINDINGS, NO_REACHED, NO_RETRY_TARGET, NO_SUMMARY, REACHED_HEADING, REFRESH_LABEL, REFUSAL_PREFIX,
  REFUSAL_UNSTATED, REPORT_GROUPS, RETURNS_TO, RETRY_LABEL,
} from './gate-screen.js';
import { GATE_ROUTE } from './routes.js';
import type { SocketTransport } from './run-connection.js';
import { DOES_NOT_EXIST } from './views.js';

declare global {
  // React refuses to run `act` outside an environment that declares itself one, and says so rather
  // than silently not flushing. `var` is what a global declaration takes.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: (() => void)[] = [];

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await act(async () => unmount());
  document.body.innerHTML = '';
});

/** A clock this file owns, so a rendered instant is a value rather than a property of the machine. */
const CLOCK = (): string => '2026-09-16T09:00:00.000Z';

const HANDLE = 'run-7';

/**
 * The ticket folder a question carries — an absolute path on the daemon's machine and not a route.
 *
 * Written once, because `test/routes.test.ts` collects every quoted literal beginning with a slash
 * and refuses the ones its register does not hold; this one is registered there with that reason.
 */
const TICKET_DIR = '/repo/backlog/Q-0016-the-gate-screen';

/** One gate question, in the shape `askGate` emits. */
const question = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'gate', gateId: '3:1', kind: 'human',
  reason: 'chore: approve to advance ticket to "reviewed"',
  ticketDir: TICKET_DIR, ...over,
});

/** One run row, parked on that question unless a fixture says otherwise. */
const run = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  handle: HANDLE, flow: 'chore', ticketId: 'Q-0016', runId: null, state: 'running',
  pendingGates: 1, gates: [question()], refusal: null, ...over,
});

/** What one request carried, so *what was sent* is asserted rather than assumed. */
interface Sent {
  readonly path: string;
  readonly request?: DaemonRequest;
}

/** What a fixture's daemon answers. `runs` is a queue; the last entry answers every later read. */
interface Answers {
  readonly runs?: unknown[];
  readonly runStatus?: number;
  readonly gateStatus?: number;
  readonly gateBody?: unknown;
  readonly reject?: boolean;
}

function daemon(answers: Answers): { fetch: (path: string, request?: DaemonRequest) => Promise<DaemonResponse>; sent: Sent[] } {
  const sent: Sent[] = [];
  const queue = [...(answers.runs ?? [run()])];
  return {
    sent,
    fetch: (path: string, request?: DaemonRequest) => {
      sent.push({ path, request });
      if (answers.reject) return Promise.reject(new Error('connection refused'));
      if (request?.method === 'POST') {
        const status = answers.gateStatus ?? 204;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(answers.gateBody ?? null),
        });
      }
      const body = queue.length > 1 ? queue.shift() : queue[0];
      const status = answers.runStatus ?? 200;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      });
    },
  };
}

/**
 * A daemon whose first read answers a parked run and whose SECOND read never arrives.
 *
 * The shape that separates *the daemon settled this answer* from *the screen knows where the run is
 * now*. The first is established by the exchange the reader just had; the second is a further
 * request, and it is the half this page cannot promise — so a fixture that answers both in one turn
 * cannot tell whether the first survives without the second. `followUp` is what the read does: stay
 * out for ever, or fail.
 */
function afterAnswering(
  gate: { readonly status: number; readonly body?: unknown },
  followUp: 'never answers' | 'fails',
): { fetch: (path: string, request?: DaemonRequest) => Promise<DaemonResponse>; sent: Sent[] } {
  const sent: Sent[] = [];
  let reads = 0;
  return {
    sent,
    fetch: (path: string, request?: DaemonRequest) => {
      sent.push({ path, request });
      if (request?.method === 'POST') {
        return Promise.resolve({
          ok: gate.status >= 200 && gate.status < 300,
          status: gate.status,
          json: () => Promise.resolve(gate.body ?? null),
        });
      }
      reads += 1;
      if (reads === 1) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(run()) });
      return followUp === 'never answers'
        ? new Promise<DaemonResponse>(() => { /* the read that follows the answer never arrives */ })
        : Promise.reject(new Error('connection refused'));
    },
  };
}

/** Render `element` into a real document and answer the element it was mounted into. */
async function render(element: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  mounted.push(() => root.unmount());
  return container;
}

/** The screen, over one fixture's daemon. */
const screen = async (answers: Answers, handle = HANDLE): Promise<{ container: HTMLElement; sent: Sent[] }> => {
  const fake = daemon(answers);
  const container = await render(createElement(GateScreen, { handle, fetcher: fake.fetch, now: CLOCK }));
  return { container, sent: fake.sent };
};

const textOf = (container: HTMLElement): string => container.textContent ?? '';

/** Every answer control the screen is offering, in the order it renders them. */
const controls = (container: HTMLElement): HTMLButtonElement[] =>
  [...container.querySelectorAll('button[data-answer]')] as HTMLButtonElement[];

/** Every envelope this screen actually sent, decoded. */
const envelopes = (sent: Sent[]): { gateId: string; answer: string }[] => sent
  .filter((each) => each.request?.method === 'POST')
  .map((each) => JSON.parse(each.request?.body ?? '{}') as { gateId: string; answer: string });

const click = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => { button.click(); });
};

describe('AC-7 — the screen renders the question it was asked, and nothing it composed', () => {
  /**
   * The three shapes a `reason` really takes, transcribed from the two sites that compose one.
   *
   * A flow file's own static `reason:`; the sentence a spent bound produces; and Q-0083's, for a
   * bound of zero, where nothing looped. The last two spell the three answers themselves, which is
   * a rendering fact rather than a defect — the screen shows what it was sent.
   */
  const REASONS = [
    'chore: approve to advance ticket to "reviewed"',
    'loop exhausted at implement (chore.implement = 3, limit 3); choose: advance (accept as is), retry (exactly one more implement), abort',
    'implement stopped rather than looping (chore.implement = 1, limit 0); choose: advance (accept its answer and carry on), retry (exactly one more implement, for once you have changed what it reads), abort',
  ];

  test.each(REASONS)('renders in full the reason %#, whole and unshortened', async (reason) => {
    const { container } = await screen({ runs: [run({ gates: [question({ reason })] })] });
    expect(textOf(container), 'the sentence the engine composed was shortened or rewritten').toContain(reason);
  });

  test('the kind, the folder and the retry target are the engine\'s own values', async () => {
    const { container } = await screen({
      runs: [run({ gates: [question({ kind: 'human-locked', retry: 'implement' })] })],
    });
    const text = textOf(container);
    expect(text, 'the kind the engine sent is not rendered').toContain('human-locked');
    expect(text, 'the ticket folder a human is sent to look at is not rendered').toContain(TICKET_DIR);
    expect(text, 'the step a send-back returns to is not named').toContain(RETURNS_TO);
    expect(text, 'the step a send-back returns to is not the one the question named').toContain('implement');
  });

  test('and no string the engine did not send appears as part of the question', async () => {
    // The question's own region carries the four fields and nothing composed beside them. Asserted
    // over that region rather than over the page, the page legitimately carrying this screen's own
    // sentences — the heading, the subject, the controls.
    const { container } = await screen({ runs: [run()] });
    const region = container.querySelector('[data-gate-kind]')?.parentElement;
    expect(region, 'the question region is not there — this clause has lost its subject').not.toBeNull();
    const shown = region?.textContent ?? '';
    for (const value of ['human', 'chore: approve to advance ticket to "reviewed"', TICKET_DIR]) {
      expect(shown, `the question region does not carry ${value}`).toContain(value);
    }
    // What is left once the engine's own values and this screen's own declared sentences are
    // removed is nothing: the region carries no prose composed on the way through, and no sentence
    // about the question that is not one of this module's exported constants.
    const known = [
      'human', 'chore: approve to advance ticket to "reviewed"', TICKET_DIR,
      NO_RETRY_TARGET, ...Object.values(ANSWER_LABEL),
    ];
    const residue = known.reduce((left, piece) => left.replace(piece, ''), shown);
    expect(residue.trim(), 'the question region carries prose nobody sent and this screen does not declare').toBe('');
    // …and the subtraction is not a needle that removes everything: a sentence nobody declared
    // survives it, so the emptiness above is an absence rather than an over-broad replace.
    const tampered = known.reduce((left, piece) => left.replace(piece, ''), `${shown}Two blockers were raised.`);
    expect(tampered.trim(), 'the subtraction removes prose it was never given').toBe('Two blockers were raised.');
  });
});

describe('AC-8 — the answers offered are the answers that gate will honour', () => {
  test('a question with no target offers two controls and says why the third is absent', async () => {
    const { container } = await screen({ runs: [run()] });
    expect(controls(container).map((button) => button.dataset.answer))
      .toStrictEqual(['advance', 'abort']);
    // Not merely missing: a reader cannot tell a screen that omitted an answer from one that lost a
    // control, so the absence is explained where the control would have been.
    expect(textOf(container), 'the third answer is absent with no reason given').toContain(NO_RETRY_TARGET);
  });

  test('and no interaction with it produces a retry envelope', async () => {
    // The property, asserted over every control the screen renders rather than over the two it is
    // expected to: a third that appeared under any other name is exercised here too.
    //
    // **Each control is driven on a screen of its own, and that is load-bearing rather than tidy.**
    // The first draft clicked them in a loop over one render, and the mutation demonstration found
    // it vacuous: answering re-reads the run, React replaces the nodes, and every click after the
    // first was against a detached element — so the loop passed with an unconditional third control
    // present. One render per control, and a count asserted against the number of envelopes, is
    // what makes "every control was pressed" a fact rather than an intention.
    const offered = (await screen({ runs: [run()] })).container;
    const count = controls(offered).length;
    expect(count, 'the fixture offers no control at all, so this proves nothing').toBeGreaterThan(0);
    const answers: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const fake = daemon({ runs: [run()] });
      const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
      await click(controls(container)[index]);
      answers.push(...envelopes(fake.sent).map((each) => each.answer));
    }
    expect(answers.length, 'a control was pressed and sent nothing').toBe(count);
    expect(answers, 'the screen sent an answer this gate does not offer').not.toContain('retry');
  });

  test('a question carrying a target offers all three, and names the step', async () => {
    const { container } = await screen({ runs: [run({ gates: [question({ retry: 'implement' })] })] });
    expect(controls(container).map((button) => button.dataset.answer)).toStrictEqual([...gateAnswerSchema.options]);
    expect(textOf(container)).toContain(RETURNS_TO);
  });

  test('THE CRITERION SHOWN RED — an unconditional third control would answer an abort', () => {
    // **The implementation this criterion forbids, run over the same question as the one this
    // screen renders.** `routing.ts:79-99` reads the step's own `retryTarget`, and a `retry` answered at a
    // gate that carries none falls through to `return { abort: true }` — so a control reading *send
    // it back* would END THE RUN. Measured over this repository's own history at this ticket's
    // gate: 148 of 220 engine-recorded gate answers were at gates that carry no target, so an
    // unconditional control would have been wrong at two thirds of the real gates here.
    const withoutTarget = question() as unknown as GateQuestionEvent;
    const unconditional: readonly GateAnswer[] = gateAnswerSchema.options;
    expect(answersOffered(withoutTarget), 'the offered set is not the two this gate honours')
      .toStrictEqual(['advance', 'abort']);
    expect(
      unconditional.filter((answer) => !answersOffered(withoutTarget).includes(answer)),
      'an unconditional control set offers `retry` at a gate with no target, where the engine answers { abort: true } and ends the run',
    ).toStrictEqual(['retry']);
    // And the discriminating direction: with a target the two sets agree, so the filter is about
    // the question rather than about always removing an answer.
    const withTarget = question({ retry: 'implement' }) as unknown as GateQuestionEvent;
    expect(answersOffered(withTarget)).toStrictEqual([...unconditional]);
  });

  test('and the vocabulary is the schema\'s, with a label for every member', () => {
    // A fourth answer would fail to compile against the total `Record`; this is the half saying the
    // three that exist each have one, so no control can render with no name.
    expect(Object.keys(ANSWER_LABEL).sort()).toStrictEqual([...gateAnswerSchema.options].sort());
    for (const answer of gateAnswerSchema.options) {
      expect(ANSWER_LABEL[answer].length, `${answer} has no label`).toBeGreaterThan(0);
    }
  });
});

describe('AC-9 — no gate is labelled from its kind alone', () => {
  test('two questions differing only in their target render the same label', async () => {
    // `handleFail` composes `kind: 'human-locked'` for every gate the engine presents itself, and an
    // author-declared deploy gate carries the same word — the field is an open string, so the only
    // structural discriminator is the presence of a target. A screen naming a KIND of gate from it
    // would be labelling one thing two ways and two things one way.
    // Rendered one after the other rather than together: `act` is not re-entrant, so two overlapping
    // renders leave the act environment in a state every later test in this file inherits.
    const plain = await screen({ runs: [run({ gates: [question({ kind: 'human-locked' })] })] });
    const looping = await screen({ runs: [run({ gates: [question({ kind: 'human-locked', retry: 'implement' })] })] });
    const labelOf = (container: HTMLElement): string => container.querySelector('[data-gate-kind]')?.textContent ?? '';
    expect(labelOf(plain.container), 'the kind rendered is not the word the engine sent').toBe('human-locked');
    expect(labelOf(looping.container), 'two gates of one kind are labelled differently')
      .toBe(labelOf(plain.container));
  });
});

describe('AC-10 — every state that is not "parked at a gate" says which one it is', () => {
  /** The four subjects a loaded run can have, each with the fixture that produces it. */
  const SUBJECTS: [string, Record<string, unknown>][] = [
    ['parked', run()],
    ['no-gate', run({ pendingGates: 0, gates: [] })],
    ['ended', run({ state: 'ended', runId: 3, pendingGates: 0, gates: [] })],
    ['refused', run({ state: 'refused', pendingGates: 0, gates: [] })],
  ];

  test.each(SUBJECTS)('a %s run renders its own sentence, and no other', async (kind, body) => {
    const { container } = await screen({ runs: [body] });
    const text = textOf(container);
    const mine = GATE_SUBJECT_TEXT[kind as keyof typeof GATE_SUBJECT_TEXT];
    expect(text, `a ${kind} run does not say so`).toContain(mine);
    for (const other of GATE_SUBJECTS.filter((each) => each !== kind)) {
      expect(text, `a ${kind} run also says it is ${other}`).not.toContain(GATE_SUBJECT_TEXT[other]);
    }
    // Only the parked one offers controls: a screen that rendered an answer for a run with no gate
    // would be offering to settle something that is not waiting.
    expect(controls(container).length > 0, `a ${kind} run offers answer controls`).toBe(kind === 'parked');
  });

  test('the subject set is closed and every member has a sentence', () => {
    // A later subject cannot be added silently: the text record is total over the register, so one
    // added without a sentence fails to compile, and one added to neither is not reachable.
    expect(Object.keys(GATE_SUBJECT_TEXT).sort()).toStrictEqual([...GATE_SUBJECTS].sort());
    for (const kind of GATE_SUBJECTS) {
      expect(GATE_SUBJECT_TEXT[kind].length, `${kind} renders an empty sentence`).toBeGreaterThan(40);
    }
    // And the classifier really produces each of them over the wire's own closed state set.
    expect(GATE_SUBJECTS.map((kind) => kind)).toStrictEqual(['parked', 'no-gate', 'ended', 'refused']);
    expect(SUBJECTS.map(([, body]) => gateSubjectOf(body as never).kind)).toStrictEqual([...GATE_SUBJECTS]);
  });

  test('a refused start reports the daemon\'s own condition, and its remedy where there is one', async () => {
    // AC-10's `refused` clause in full. The row carried the STATE and no reason until this ticket
    // widened the projection, so the screen said it carried none — a surface admitting a gap with
    // the daemon's own sentence one field away, which is what a criterion asking for the condition
    // is not satisfied by. The condition is `core`'s own words and the remedy is the daemon's, both
    // rendered unaltered.
    const condition = 'no ticket T-0404 in this backlog';
    const remedy = 'point the server at a directory holding harness/harness.yaml';
    const { container } = await screen({
      runs: [run({ state: 'refused', pendingGates: 0, gates: [], refusal: { condition, remedy } })],
    });
    const text = textOf(container);
    expect(text, 'the refused state stopped saying what it is').toContain(GATE_SUBJECT_TEXT.refused);
    expect(text, 'the daemon\'s own condition for the refusal is not rendered').toContain(condition);
    expect(text, 'the remedy the daemon composed is not rendered').toContain(remedy);
    expect(text, 'the screen still claims the row carries no reason').not.toContain(REFUSAL_UNSTATED);
    expect(controls(container).length, 'a refused start offered an answer').toBe(0);
  });

  test('and a refused row that carries no reason says that, rather than rendering an empty region', async () => {
    // Reachable rather than defensive: a record is minted `refused` and stays so until its start
    // resolves, so a row read inside that window is a refusal nobody has written yet. It is the one
    // case where this screen has a state and no sentence from the daemon, and it says so.
    const { container } = await screen({ runs: [run({ state: 'refused', pendingGates: 0, gates: [], refusal: null })] });
    const text = textOf(container);
    expect(text, 'a refused row with no reason rendered nothing about it').toContain(REFUSAL_UNSTATED);
    expect(text, 'the screen introduced a reason it does not have').not.toContain(REFUSAL_PREFIX);
  });

  test('a handle the daemon never minted is its own refusal, and is not silence', async () => {
    const { container } = await screen({
      runs: [{ code: 'no-such-run', condition: 'no run is registered under that handle', remedy: null }],
      runStatus: 404,
    });
    const text = textOf(container);
    expect(text, 'the daemon\'s own condition is not rendered').toContain('no run is registered under that handle');
    expect(text, 'a refusal offered no action').toContain(RETRY_LABEL);
    // …and it is TOLD APART from a gate that is no longer waiting, which shares its status.
    expect(text, 'a missing run reads as an answered gate').not.toContain(GATE_GONE);
    expect(controls(container).length, 'a run that is not there offered an answer').toBe(0);
  });

  test('a daemon that answers nothing at all says so, and offers the one thing that could help', async () => {
    const { container } = await screen({ reject: true });
    const text = textOf(container);
    expect(text, 'nothing answering at all was reported as a refusal').toContain('not responding');
    expect(text).toContain(RETRY_LABEL);
  });

  test('a body this page cannot read is reported as that rather than as a run', async () => {
    const { container } = await screen({ runs: [{ handle: HANDLE, surprise: true }] });
    expect(textOf(container), 'a body of the wrong shape was rendered as a run').toContain('not the shape this page can read');
    expect(controls(container).length, 'an unreadable body offered an answer').toBe(0);
  });

  test('and no state renders an empty region — the mount says what it is waiting for', async () => {
    // The in-flight moment, which is the one a spinner would occupy. Asserted before the fixture's
    // promise settles by never settling it.
    const container = await render(createElement(GateScreen, {
      handle: HANDLE,
      fetcher: () => new Promise<DaemonResponse>(() => { /* never answers */ }),
      now: CLOCK,
    }));
    expect(textOf(container), 'the screen says nothing while it waits').toContain(runDetailPath(HANDLE));
    expect(textOf(container).trim().length, 'the screen rendered an empty region').toBeGreaterThan(20);
  });
});

describe('AC-11 — one answer in flight, and nothing claimed that was not observed', () => {
  test('two activations in one turn produce exactly one request', async () => {
    const fake = daemon({ runs: [run(), run({ pendingGates: 0, gates: [] })] });
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    const [advance] = controls(container);
    await act(async () => { advance.click(); advance.click(); });
    expect(envelopes(fake.sent).length, 'a double activation answered the gate twice').toBe(1);
  });

  test('an accepted answer says which answer it sent, and claims nothing beyond it', async () => {
    const fake = daemon({ runs: [run(), run({ pendingGates: 0, gates: [] })] });
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, 'the screen does not say what it sent').toContain(ANSWERED_PREFIX);
    expect(text, 'the screen does not name the answer it sent').toContain(ANSWER_LABEL.advance);
    // It may not claim the next step ran, the ticket advanced or the run ended: what it says next
    // is what a READ established, and the read this fixture answers with is a run with no gate.
    expect(text, 'the screen claimed an outcome the exchange did not carry').toContain(GATE_SUBJECT_TEXT['no-gate']);
    expect(text, 'the screen claimed the run ended').not.toContain(GATE_SUBJECT_TEXT.ended);
  });

  test.each([
    ['never answers', runDetailPath(HANDLE)],
    ['fails', 'not responding'],
  ] as const)('and it keeps saying so while the read that follows it %s', async (followUp, readSays) => {
    // **The half the run-2 review found missing.** The screen reads the run again the moment an
    // answer is accepted, and that read is a further request: it can hang, and it can fail. What the
    // exchange established — *the daemon took this answer* — is true whatever the read does, so it
    // stays on the page rather than being replaced by the state of a question about something else.
    // It was not: everything below the heading was drawn inside the loaded-run branch, so the read
    // going back in flight hid the sentence naming the answer a reader had just sent, and a read that
    // never arrived hid it for ever.
    const fake = afterAnswering({ status: 204 }, followUp);
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, 'the screen stopped saying the daemon had taken an answer').toContain(ANSWERED_PREFIX);
    expect(text, 'the screen stopped naming the answer it sent').toContain(ANSWER_LABEL.advance);
    // …beside the read's own state, which is the other thing a reader needs and the thing that
    // replaced it. Both, rather than either.
    expect(text, 'the screen does not say what the read that follows is doing').toContain(readSays);
    // And this really is the branch that used to hide it: the run is no longer loaded, so there is
    // nothing to answer and no control is drawn.
    expect(controls(container).length, 'the run is still loaded, so this clause has lost its subject').toBe(0);
    // Nothing was re-sent to get here.
    expect(envelopes(fake.sent).length, 'the answer was sent more than once').toBe(1);
  });

  test('and an answer about one run is never rendered under another', async () => {
    // **The guard the clause above needs**, and the reason it is a clause rather than a line in a
    // report. Drawn outside the loaded-run branch, the answer region is no longer gated by the run
    // at all — so what the answer is ABOUT has to travel with it. A prop is committed before the
    // effect reacting to it runs, and an answer still in flight is not cleared by that effect
    // either, so without the handle beside it a screen moved from one run to another names the
    // first run's gate path under the second run's heading. `loadedFor` cannot stand in for it: it
    // moves with the read, which is a request that has not come back yet.
    const other = 'run-8';
    const fetcher = (path: string, request?: DaemonRequest): Promise<DaemonResponse> => {
      // The answer stays out for ever, which is what keeps it in flight across the move.
      if (request?.method === 'POST') return new Promise<DaemonResponse>(() => { /* never answers */ });
      const body = path === runDetailPath(HANDLE) ? run() : run({ handle: other });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => root.unmount());

    await act(async () => root.render(createElement(GateScreen, { handle: HANDLE, fetcher, now: CLOCK })));
    await click(controls(container)[0]);
    expect(textOf(container), 'the answer was never dispatched — this clause has lost its subject')
      .toContain(runGatePath(HANDLE));

    await act(async () => root.render(createElement(GateScreen, { handle: other, fetcher, now: CLOCK })));
    expect(textOf(container), 'the screen is not showing the run it was moved to').toContain(other);
    expect(textOf(container), 'one run\'s answer is rendered under another run\'s heading')
      .not.toContain(runGatePath(HANDLE));
    // …and the controls the second run draws are inert, because the guard is still held by the first
    // run's answer. Drawn live from the answer this handle can see — which is none — they would be
    // controls a reader can press that silently do nothing, which is the disagreement between the two
    // halves of *inert* that the run-2 blocker was about.
    expect(controls(container).length, 'the second run drew no control — this clause has lost its subject')
      .toBeGreaterThan(0);
    expect(controls(container).every((button) => button.disabled),
      'a control was live while an answer was still outstanding').toBe(true);
  });

  test('and the controls are gone once the gate is no longer pending, the route staying put', async () => {
    const fake = daemon({ runs: [run(), run({ pendingGates: 0, gates: [] })] });
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    expect(controls(container).length, 'the fixture never offered a control').toBeGreaterThan(0);
    await click(controls(container)[0]);
    expect(controls(container).length, 'an answered gate still offers an answer').toBe(0);
    // Still the gate screen, rather than a redirect to a screen that does not exist.
    expect(textOf(container)).toContain(GATE_HEADING);
    // And the answer is settled through a READ, which is the request after the POST.
    expect(fake.sent.map((each) => each.path))
      .toStrictEqual([runDetailPath(HANDLE), runGatePath(HANDLE), runDetailPath(HANDLE)]);
  });

  test('the controls are inert while an answer is outstanding', async () => {
    // The rendered half of the property above: a reader is not invited to press a second control
    // while the first is in flight. Driven with a gate response that never settles.
    const sent: Sent[] = [];
    const container = await render(createElement(GateScreen, {
      handle: HANDLE,
      fetcher: (path: string, request?: DaemonRequest) => {
        sent.push({ path, request });
        if (request?.method === 'POST') return new Promise<DaemonResponse>(() => { /* never answers */ });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(run()) });
      },
      now: CLOCK,
    }));
    await click(controls(container)[0]);
    expect(controls(container).every((button) => button.disabled), 'a control was live while an answer was outstanding').toBe(true);
    expect(textOf(container), 'the screen does not say what it is waiting for').toContain(runGatePath(HANDLE));
  });

  test('and a fresh look withdraws nothing: the controls stay inert while the answer is on its way', async () => {
    // **INVERTED RATHER THAN DELETED** (Q-0116's shape). This clause asserted the opposite until the
    // run-2 review: a Refresh released the guard, so the controls came back live while the first
    // answer was still out and a reader could send a second, DIFFERENT one. The two race, and an
    // `abort` sent after an `advance` can arrive first — so the screen would have offered a way to
    // end a run the reader had just chosen to advance.
    //
    // The two halves of *inert* still have to agree, which is what the earlier version was right
    // about and fixed the wrong way round: a read does not clear the answer region either, so what a
    // reader sees is the run read again with the outstanding answer's own sentence beside it.
    const sent: Sent[] = [];
    const pending: ((response: DaemonResponse) => void)[] = [];
    const container = await render(createElement(GateScreen, {
      handle: HANDLE,
      fetcher: (path: string, request?: DaemonRequest) => {
        sent.push({ path, request });
        if (request?.method === 'POST') return new Promise<DaemonResponse>((resolve) => { pending.push(resolve); });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(run()) });
      },
      now: CLOCK,
    }));
    await click(controls(container)[0]);
    expect(controls(container).every((button) => button.disabled), 'the first answer left a control live').toBe(true);
    const refresh = [...container.querySelectorAll('button')].find((button) => button.textContent === REFRESH_LABEL);
    expect(refresh, 'there is no way to ask again — this clause has lost its subject').toBeDefined();
    await click(refresh as HTMLButtonElement);

    // The read happened — a fresh look is still a fresh look…
    expect(sent.filter((each) => each.path === runDetailPath(HANDLE)).length,
      'the fresh look did not read the run again').toBe(2);
    // …and it withdrew nothing: the controls are still inert, the region still names the request it
    // is waiting for, and a press produces no second envelope.
    expect(controls(container).every((button) => button.disabled), 'a fresh look re-enabled the controls while an answer was outstanding').toBe(true);
    expect(textOf(container), 'the fresh look erased the sentence saying an answer is on its way').toContain(runGatePath(HANDLE));
    // Pressed on a DIFFERENT control from the one already in flight, which is the shape that made
    // this a blocker rather than a redundancy: what a released guard permits is not a repeat of the
    // answer already sent but an abort overtaking an advance.
    await click(controls(container)[1]);
    expect(envelopes(sent).length, 'a second answer was sent while the first was still in flight').toBe(1);

    // And it is not a deadlock: once the answer settles, the screen is answerable again.
    expect(pending.length, 'the answer was never dispatched — this clause has lost its subject').toBe(1);
    await act(async () => {
      pending[0]({
        ok: false, status: 400,
        json: () => Promise.resolve({ code: 'not-an-answer', condition: 'the envelope is not an answer', remedy: null }),
      });
    });
    expect(controls(container).some((button) => button.disabled), 'a settled answer left the controls inert').toBe(false);
    await click(controls(container)[0]);
    expect(envelopes(sent).length, 'a control a reader can press did nothing').toBe(2);
  });
});

describe('AC-12 — a gate that is no longer waiting is reported as that, and never as a failure', () => {
  test('answering twice reports the gate as gone, claiming neither success nor failure', async () => {
    // The lost-response path: the first answer settled the gate and its `204` never arrived, so the
    // reader answers again. The daemon cannot tell that from an answer given at the command line or
    // from a run that stopped, and neither can this screen — so it says so.
    const { container } = await screen({
      runs: [run(), run()],
      gateStatus: 404,
      gateBody: { code: GATE_GONE_CODE, condition: 'that run has no gate waiting under that id', remedy: null },
    });
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, 'a gate that is no longer waiting was not reported as that').toContain(GATE_GONE);
    expect(text, 'the screen claimed the earlier answer was accepted').not.toContain(ANSWERED_PREFIX);
    expect(text, 'the screen reported a gate that is gone as a request that failed')
      .not.toContain('The daemon refused');
  });

  test.each([
    ['never answers', runDetailPath(HANDLE)],
    ['fails', 'not responding'],
  ] as const)('and it keeps saying so while the read that follows it %s', async (followUp, readSays) => {
    // AC-12's half of the same defect, and the worse half: this sentence is the only thing standing
    // between a reader and answering a third time. If the read that follows it hides it, what is left
    // on the page is a request that looks like it is still happening, which is an invitation to try
    // again — against a gate that is already settled.
    const fake = afterAnswering({
      status: 404,
      body: { code: GATE_GONE_CODE, condition: 'that run has no gate waiting under that id', remedy: null },
    }, followUp);
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, 'a gate that is no longer waiting stopped being reported as that').toContain(GATE_GONE);
    expect(text, 'the screen claimed the earlier answer was accepted').not.toContain(ANSWERED_PREFIX);
    expect(text, 'the screen does not say what the read that follows is doing').toContain(readSays);
    expect(controls(container).length, 'the run is still loaded, so this clause has lost its subject').toBe(0);
    expect(envelopes(fake.sent).length, 'a gate that is gone was answered again').toBe(1);
  });

  test('and it reads the run again rather than re-sending anything', async () => {
    const fake = daemon({
      runs: [run(), run({ pendingGates: 0, gates: [] })],
      gateStatus: 404,
      gateBody: { code: GATE_GONE_CODE, condition: 'that run has no gate waiting under that id', remedy: null },
    });
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher: fake.fetch, now: CLOCK }));
    await click(controls(container)[0]);
    expect(envelopes(fake.sent).length, 'a failure was silently retried').toBe(1);
    expect(fake.sent.filter((each) => each.path === runDetailPath(HANDLE)).length,
      'the screen did not read the run again').toBe(2);
  });

  test.each([
    ['not-this-run', 409, 'that gate is waiting on a different run'],
    ['not-an-answer', 400, 'the envelope is not {gateId, answer} over advance, retry or abort'],
    ['no-such-run', 404, 'no run is registered under that handle'],
    ['malformed-json', 400, 'the request body is not valid JSON'],
  ])('%s renders its own sentence, carrying the daemon\'s condition', async (code, status, condition) => {
    const { container } = await screen({
      runs: [run()],
      gateStatus: status,
      gateBody: { code, condition, remedy: null },
    });
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, `${code} does not carry the daemon's own condition`).toContain(condition);
    expect(text, `${code} was reported as a gate that is no longer waiting`).not.toContain(GATE_GONE);
    // Every failure offers the one action that could help, and it repeats the READ rather than the
    // answer: re-sending identical bytes to a route that refused them is not a remedy.
    expect(text, `${code} offers no action`).toContain(LOOK_AGAIN_LABEL);
  });

  test('and an answer nothing responded to is told apart from one the daemon refused', async () => {
    const sent: Sent[] = [];
    const container = await render(createElement(GateScreen, {
      handle: HANDLE,
      fetcher: (path: string, request?: DaemonRequest) => {
        sent.push({ path, request });
        if (request?.method === 'POST') return Promise.reject(new Error('connection refused'));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(run()) });
      },
      now: CLOCK,
    }));
    await click(controls(container)[0]);
    const text = textOf(container);
    expect(text, 'nothing answering the answer was reported as a refusal').toContain('not responding');
    expect(text, 'the screen claimed the answer was accepted').not.toContain(ANSWERED_PREFIX);
  });
});

describe('Q-0129 AC-8 — the decision that reached the gate, whole, as text', () => {
  test('the step, the verdict word, the summary and every reported entry', async () => {
    // **Twenty-three, which is the measured maximum a verdict record in this repository carries.**
    // Nothing is paged, capped or put behind a control: the largest such record is 13 KB, so the
    // property is that the rendered count EQUALS the array's length rather than that it is large.
    const entries = Array.from({ length: 23 }, (_value, at) => `nit: src/m${String(at)}.ts:${String(at + 1)} entry number ${String(at)}`);
    const { container } = await screen({
      runs: [run({ gates: [question({ reached: { stepId: 'dev:backend-wire-schema', verdict: 'changes-requested', summary: 'the summary this step returned', findings: entries } })] })],
    });
    const text = textOf(container);

    expect(text, 'the deciding step is not named').toContain('dev:backend-wire-schema');
    // The word the engine sent, and not a noun coined from it. `Q-0016`'s AC-9 rule at a second
    // field: `changes-requested` is one flow's vocabulary and another declares `needs-input`.
    expect(text, 'the verdict word the engine sent is not rendered').toContain('changes-requested');
    expect(text, 'the summary is not rendered').toContain('the summary this step returned');
    for (const entry of entries) {
      expect(text, `a reported entry is missing: ${entry}`).toContain(entry);
    }
    expect(container.querySelectorAll('[data-finding]'), 'the rendered count is not the array\'s length')
      .toHaveLength(entries.length);
  });

  test('the verdict is what the question carried, whatever word that is', async () => {
    // The anti-coining half with a subject: a screen mapping verdicts to nouns of its own would
    // render the same thing for both of these.
    for (const verdict of ['approve', 'ready', 'proceed', 'needs-input']) {
      const { container } = await screen({
        runs: [run({ gates: [question({ reached: { stepId: 'work', verdict, summary: 's', findings: [] } })] })],
      });
      expect(textOf(container), `the verdict ${verdict} is not rendered as the engine sent it`).toContain(verdict);
    }
  });
});

describe('Q-0129 AC-9 — grouped only by the register `@quorum/shared` declares', () => {
  /** One per severity, one observation, and the two the register does not recognise. */
  const SEVEN = [
    'blocker: src/a.ts:1 the first',
    'major: src/b.ts:2 the second',
    'nit: src/c.ts:3 the third',
    'observation: the suite is red under load',
    'the step wrote this with no prefix at all',
    'minor: src/d.ts:4 a severity this product does not declare',
  ];

  test('all six render, and the two outside the register are whole and in their own place', async () => {
    const { container } = await screen({
      runs: [run({ gates: [question({ reached: { stepId: 'review', verdict: 'changes-requested', summary: 's', findings: SEVEN } })] })],
    });
    const text = textOf(container);

    // Nothing is dropped, which is the half a grouping implementation gets wrong: 13.9% of this
    // repository's findings carry no recognised prefix.
    for (const entry of SEVEN) expect(text, `a reported entry was dropped: ${entry}`).toContain(entry);
    expect(container.querySelectorAll('[data-finding]')).toHaveLength(SEVEN.length);

    // The two are outside EVERY severity group rather than merely present — filed under one they do
    // not claim, they would still be findable in the text above.
    const uncategorised = [...container.querySelectorAll('[data-finding="uncategorised"]')]
      .map((element) => element.textContent ?? '');
    expect(uncategorised, 'an unrecognised entry was re-filed under a severity it does not claim')
      .toStrictEqual([SEVEN[4], SEVEN[5]]);
    // …and it is verbatim, rather than trimmed to look like one that is inside the register.
    expect(uncategorised[1], 'the entry was rewritten on its way to its own group').toBe('minor: src/d.ts:4 a severity this product does not declare');

    // Each recognised entry is under its own group and under no other, so a grouping that put
    // everything in the first bucket fails here rather than passing on the text above.
    for (const [group, entry] of [['blocker', SEVEN[0]], ['major', SEVEN[1]], ['nit', SEVEN[2]], ['observation', SEVEN[3]]] as const) {
      const under = [...container.querySelectorAll(`[data-finding="${group}"]`)].map((element) => element.textContent ?? '');
      expect(under, `the ${group} group does not hold exactly its own entry`).toStrictEqual([entry]);
    }
  });

  test('the grouping keeps everything, which is asserted rather than intended', () => {
    // The pure half, so the property is checkable without a DOM: the two halves sum to the input,
    // element for element, and nothing is rewritten on the way.
    const { grouped, rest } = groupReported(SEVEN);
    expect([...grouped.flatMap((each) => each.entries), ...rest].sort()).toStrictEqual([...SEVEN].sort());
    expect(grouped.map((each) => each.group), 'a group with no entries was rendered')
      .toStrictEqual(['blocker', 'major', 'nit', 'observation']);
    expect(rest).toStrictEqual([SEVEN[4], SEVEN[5]]);
    // The register is the shared package's, in its own order — which is what fails if this screen
    // ever writes one of its own.
    expect(REPORT_GROUPS).toStrictEqual([...FINDING_SEVERITIES, OBSERVATION_TAG]);
  });

  test('an empty list says so, and never renders as nothing having been wrong', async () => {
    const { container } = await screen({
      runs: [run({ gates: [question({ reached: { stepId: 'review', verdict: 'approve', summary: 'nothing to report', findings: [] } })] })],
    });
    const text = textOf(container);
    expect(text, 'an empty list renders no sentence at all').toContain(NO_FINDINGS);
    expect(container.querySelectorAll('[data-finding]'), 'an empty list rendered an entry').toHaveLength(0);
  });

  test('an empty summary is a value and is reported as one', async () => {
    const { container } = await screen({
      runs: [run({ gates: [question({ reached: { stepId: 'review', verdict: 'approve', summary: '', findings: [] } })] })],
    });
    expect(textOf(container), 'an empty summary rendered as an empty region').toContain(NO_SUMMARY);
  });
});

describe("Q-0129 AC-3(a) — the heading names the DECIDING step, never the preceding one", () => {
  // Review round 4's surviving major, repaired by hand after the exhaustion gate on Q-0073's and
  // Q-0080's precedent. `chore.yaml` runs `implement` (verdict), `review` (verdict), `integrate`
  // (none), then the owner gate — so at the most common gate in this repository's history the step
  // that DECIDED is `review` and the step BEFORE is `integrate`. A heading claiming adjacency names
  // the wrong one, and nothing in this file could have caught it: every earlier fixture puts the
  // deciding step immediately before the gate, where the two readings coincide.
  //
  // Asserted over the heading's own words rather than over a rendering, because the defect was a
  // sentence. The needles are the adjacency claims; each is a phrase the retired heading contained.
  test('it claims no adjacency, in any of the spellings the retired heading used', () => {
    for (const claim of ['step before', 'previous step', 'preceding step', 'last step', 'step prior']) {
      expect(REACHED_HEADING.toLowerCase(), `the heading claims the deciding step was adjacent: "${claim}"`)
        .not.toContain(claim);
    }
    // Anti-vacuity: a heading that said nothing at all would pass every clause above.
    expect(REACHED_HEADING.toLowerCase(), 'the heading no longer names a decision at all').toContain('decision');
  });

  test('the deciding step it names is the one the question carries, across an intervening step', async () => {
    // The shape the review named: `review` decided, `integrate` ran after it and decided nothing,
    // and the gate carries `review`. The screen must name `review` and must not name `integrate`.
    const { container } = await screen({
      runs: [run({ gates: [question({ reached: { stepId: 'review', verdict: 'approve', summary: 's', findings: [] } })] })],
    });
    const text = textOf(container);
    expect(text, 'the screen did not name the step whose decision the question carries').toContain('review');
    expect(text, 'the screen named a step the question does not carry').not.toContain('integrate');
  });
});

describe('Q-0129 AC-10 — absent evidence names the condition, and no region is empty', () => {
  test('a question carrying no decision says so, and claims nothing about what was found', async () => {
    const { container } = await screen({ runs: [run({ gates: [question({ retry: 'implement' })] })] });
    const text = textOf(container);

    expect(text, 'the screen is silent about a gate that follows no verdict').toContain(NO_REACHED);
    expect(container.querySelector('[data-reached="none"]'), 'the absent case has no region of its own').not.toBeNull();
    expect(container.querySelectorAll('[data-finding]'), 'a question with no decision rendered entries').toHaveLength(0);

    // The markers a fabricated region would need. Each is a thing this app renders elsewhere for a
    // measured absence and which here would stand in for evidence nobody measured.
    for (const placeholder of ['n/a', 'not set', 'TBD', '—', '--']) {
      expect(text.includes(placeholder), `the screen renders the placeholder ${placeholder}`).toBe(false);
    }
    // And no element on the page is an empty region: every one the screen draws carries text.
    const regions = [...container.querySelectorAll('section, div, p')];
    expect(regions.length, 'the screen drew nothing — this clause has lost its subject').toBeGreaterThan(3);
    for (const region of regions) {
      expect((region.textContent ?? '').trim().length, `${region.tagName} is an empty region`).toBeGreaterThan(0);
    }
  });

  test('the question and its controls stay usable in the absent case', async () => {
    // The half a region added above the controls could break: the gate is still answerable.
    const { container } = await screen({ runs: [run({ gates: [question({ retry: 'implement' })] })] });
    expect(controls(container).map((button) => button.dataset.answer)).toStrictEqual(['advance', 'retry', 'abort']);
    expect(textOf(container), 'the reason the engine composed is gone').toContain('chore: approve to advance ticket to "reviewed"');
  });

  test('and the needles discriminate, over a region built to trip them', () => {
    const fabricated = 'changes requested — 2 findings; files changed n/a';
    expect(['n/a', '—'].filter((placeholder) => fabricated.includes(placeholder)))
      .toStrictEqual(['n/a', '—']);
  });
});

describe('Q-0129 AC-11 — malformed, stale and in-flight evidence cannot show a wrong decision', () => {
  test('a row whose evidence fails the schema reaches the invalid-response state and renders none of it', async () => {
    // `reached` is `.strict()` at both levels and whole-or-absent, so a partly populated one is a
    // response this app cannot parse — which is a state it already has a sentence for. What it may
    // not do is render the half that did arrive.
    const { container } = await screen({
      runs: [run({ gates: [{ ...question(), reached: { stepId: 'review', verdict: 'changes-requested' } }] })],
    });
    expect(container.querySelector('[data-request-state="unparseable"]'), 'a malformed row was accepted').not.toBeNull();
    expect(textOf(container), 'a verdict from a row that did not parse reached the page').not.toContain('changes-requested');
    expect(container.querySelectorAll('[data-reached]'), 'a malformed row drew a decision region').toHaveLength(0);
  });

  test('a render at another handle shows none of the first handle\'s entries', async () => {
    const first = { stepId: 'review', verdict: 'changes-requested', summary: 'handle A summary', findings: ['major: src/a.ts:1 A only'] };
    // The second handle's read never answers, which is the moment the claim is about: a screen that
    // cleared its run in an effect would paint A's decision under B's heading for as long as it
    // takes React to flush one, and a fixture answering both reads in a turn cannot see that.
    let reads = 0;
    const fetcher = (): Promise<DaemonResponse> => {
      reads += 1;
      return reads === 1
        ? Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(run({ gates: [question({ reached: first })] })),
        })
        : new Promise<DaemonResponse>(() => { /* the read at the second handle never arrives */ });
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(GateScreen, { handle: HANDLE, fetcher, now: CLOCK })));
    mounted.push(() => root.unmount());
    expect(textOf(container)).toContain('major: src/a.ts:1 A only');

    // The prop is committed before an effect reacting to it runs, so this is the moment a screen
    // that cleared in an effect would paint one run's decision under another's heading.
    await act(async () => root.render(createElement(GateScreen, { handle: 'run-9', fetcher, now: CLOCK })));
    expect(textOf(container), 'the previous handle\'s entry survived the move').not.toContain('A only');
    expect(textOf(container), 'the previous handle\'s summary survived the move').not.toContain('handle A summary');
  });

  test('an answer in flight leaves the decision rendered, the controls inert, and nothing claimed', async () => {
    // **Into the SAME screen whose control is pressed.** The run-3 review found this clause reading
    // one mount while the evidence was rendered into another, so every assertion after the click
    // inspected a screen that had never had a decision on it: deleting the evidence mid-answer would
    // have left it green, and so would drawing no controls at all, `every` being true of nothing.
    //
    // And the answer **never settles**, which is the moment AC-11 is about. A fixture that resolves
    // the POST is asking what the screen says once the daemon has replied — a different claim, and
    // one the two clauses above already make.
    const reached = {
      stepId: 'review', verdict: 'changes-requested', summary: 'two majors and a nit',
      findings: ['major: src/host.ts:4 the record is never released'],
    };
    const sent: Sent[] = [];
    const fetcher = (path: string, request?: DaemonRequest): Promise<DaemonResponse> => {
      sent.push({ path, request });
      if (request?.method === 'POST') return new Promise<DaemonResponse>(() => { /* the answer stays out for ever */ });
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(run({ gates: [question({ reached })] })),
      });
    };
    const container = await render(createElement(GateScreen, { handle: HANDLE, fetcher, now: CLOCK }));
    expect(textOf(container), 'the decision never reached the screen — this clause has lost its subject')
      .toContain('two majors and a nit');

    const advance = controls(container).find((button) => button.dataset.answer === 'advance');
    expect(advance, 'there is no control to press — this clause has lost its subject').toBeDefined();
    await click(advance!);

    const text = textOf(container);
    expect(envelopes(sent).length, 'no answer went out, so nothing is in flight — this clause has lost its subject').toBe(1);
    expect(text, 'the summary was cleared while the answer was still on its way').toContain('two majors and a nit');
    expect(text, 'a reported entry was cleared while the answer was still on its way')
      .toContain('major: src/host.ts:4 the record is never released');
    const offered = controls(container);
    expect(offered.length, 'there are no controls to be inert — `every` would be true of nothing').toBeGreaterThan(0);
    expect(offered.every((button) => button.disabled), 'the controls stayed live while an answer was out').toBe(true);
    // Neither half of what has not happened yet: the ticket has not moved, and the daemon has not
    // accepted anything either — this request is still on its way.
    expect(text, 'the screen claims the ticket advanced').not.toMatch(/advanced|reviewed now|moved on/i);
    expect(text, 'the screen claimed an answer the daemon has not taken').not.toContain(ANSWERED_PREFIX);
  });
});

describe('AC-14 — the register says the screen exists, and the placeholder no longer draws it', () => {
  /**
   * A socket nothing should reach for at this route, supplied so that reaching for one is VISIBLE.
   *
   * Passed rather than omitted for the reason `apps/web/test/source.test.ts` enforces: a run route
   * rendered with no factory reaches `defaultSocketFactory` and opens a real connection to jsdom's
   * origin, so leaving it out would turn a regression here into a network error somewhere else.
   */
  class FakeSocket implements SocketTransport {
    onopen: (() => void) | null = null;
    onmessage: ((event: { readonly data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;
    close(): void { /* nothing to close */ }
  }

  test('and the route opens no socket, the screen holding none by a ruling of its own', async () => {
    // Erratum E-2/GO-4: this screen reads and does not subscribe. `app.tsx` builds a live connection
    // for a route the register gives a `:handle`, which this route has — so without the exclusion
    // there, visiting the gate screen opens a WebSocket that the screen does not read and cannot
    // use, and that answers a second way about a handle the screen is already reporting on.
    // Asserted over the FACTORY, which is what says a socket was constructed at all.
    const reached: URL[] = [];
    const factory = (url: URL): SocketTransport => { reached.push(url); return new FakeSocket(); };
    const fake = daemon({ runs: [run()] });
    await render(createElement(App, {
      initialPath: GATE_ROUTE.replace(':handle', HANDLE),
      socketFactory: factory,
      pageUrl: new URL(`https:${'/' + '/'}page.test`),
      fetcher: fake.fetch,
      clock: CLOCK,
    }));
    expect(reached, 'the gate route opened a socket').toStrictEqual([]);
    // …and the exclusion is by NAME rather than a rule about every route carrying a handle: mission
    // control's own route still opens exactly one, so this clause discriminates instead of reporting
    // that nothing anywhere connects. Its path is built by removing the gate segment from the
    // register's own pattern rather than written out — `test/routes.test.ts` collects every quoted
    // literal beginning with a slash and refuses one no route holds, which is what keeps a fixture
    // from becoming a second place a path is written down.
    await render(createElement(App, {
      initialPath: GATE_ROUTE.replace(':handle', HANDLE).replace(/\/gate$/u, ''),
      socketFactory: factory,
      pageUrl: new URL(`https:${'/' + '/'}page.test`),
      fetcher: fake.fetch,
      clock: CLOCK,
    }));
    expect(reached, 'the run route stopped opening a connection').toHaveLength(1);
  });

  test('the app draws the gate screen at its route rather than the "not built yet" view', async () => {
    const fake = daemon({ runs: [run()] });
    const container = await render(createElement(App, {
      // Built by substitution into the registered pattern rather than written here, which is the
      // rule this app's own register is under: a path written in a component or a fixture is a
      // second register free to drift from the one the router matches against.
      initialPath: GATE_ROUTE.replace(':handle', HANDLE),
      socketFactory: () => new FakeSocket(),
      pageUrl: new URL(`https:${'/' + '/'}page.test`),
      fetcher: fake.fetch,
      clock: CLOCK,
    }));
    const main = container.querySelector('main')?.textContent ?? '';
    expect(main, 'the placeholder still draws at the gate route').not.toContain(DOES_NOT_EXIST);
    expect(main, 'the gate screen did not draw').toContain(GATE_HEADING);
    expect(main, 'the question the run is parked on did not reach the page')
      .toContain('chore: approve to advance ticket to "reviewed"');
    expect(main, 'the screen offers no way to reload').toContain(REFRESH_LABEL);
    expect(fake.sent[0]?.path, 'the screen read something other than its own run').toBe(runDetailPath(HANDLE));
  });
});
