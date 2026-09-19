// @vitest-environment jsdom
/**
 * Q-0137 AC-8, AC-10, AC-11 and AC-12 — what an occurrence retained, on the screen.
 *
 * **Every fixture is built here and every one is hostile** (R-4). A rendering test over two
 * well-formed adapter occurrences passes over every rule this ticket added: the kind-keyed absence
 * sentences are invisible unless an occurrence has no prompt, the terminal-no-output case is
 * invisible unless a finished step retained none, and the warning case is invisible unless the
 * daemon could not read a directory. So the fixtures carry an `integrate` occurrence whose STEP ID
 * is `prove-red` — 12 of the 85 such occurrences in this repository's own history carry a step id
 * that is not `integrate`, which is what a step-id-keyed implementation gets wrong — a `script`
 * occurrence this product has never produced, a running occurrence, a terminal one with no output,
 * and an occurrence the listing warned about.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { OUTPUT_FILE, PROMPT_FILE } from '@quorum/shared';
import type {
  WireRunHistory, WireRunHistoryList, WireRunHistoryOccurrence, WireRunHistoryRetained,
  WireRunHistoryRow,
} from '@quorum/shared';

import { DAEMON_ENDPOINTS, historyDetailPath, historyFilePath, historyRetainedPath } from './daemon-endpoints.js';
import { HistoryScreen } from './history-screen.js';
import * as historyText from './history-text.js';
import {
  CLOSE_FILE_LABEL, EMPTY_FILE_TEXT, EXPAND_LABEL, HISTORY_RETRY_LABEL, NO_OUTPUT_RUNNING_TEXT,
  NO_OUTPUT_TERMINAL_TEXT, NO_RETAINED_FILES_TEXT, OPEN_FILE_LABEL, RETAINED_UNLISTED_TEXT,
  noPromptText, retainedSizeText,
} from './history-text.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => {
  for (const close of roots.splice(0)) await act(async () => close());
  document.body.innerHTML = '';
});

const CLOCK = (): string => '2026-09-19T09:00:00.000Z';
const RUN = 'Q-0137-1';

/** One listing row, with only the fields a clause is about supplied. */
const row = (over: Partial<WireRunHistoryRow> & { id: string }): WireRunHistoryRow => ({
  ticket: 'Q-0137', flow: 'chore', status: 'completed', incomplete: false,
  started_at: '2026-09-19T01:00:00.000Z', ended_at: '2026-09-19T01:10:00.000Z', duration_ms: 600_000,
  occurrenceCount: 1, rollup: [], ...over,
});

/** One occurrence as the detail route reports it. */
const step = (over: Partial<WireRunHistoryOccurrence> & { step_id: string; seq: number }): WireRunHistoryOccurrence => ({
  kind: 'adapter', status: 'completed', started_at: '2026-09-19T01:00:01.000Z',
  duration_ms: 1200, adapter: 'zeta', ...over,
});

/** One detail response, carrying the occurrences a case is about. */
const detail = (steps: WireRunHistoryOccurrence[]): WireRunHistory => ({
  manifest: {
    started_at: '2026-09-19T01:00:00.000Z', ended_at: '2026-09-19T01:10:00.000Z',
    duration_ms: 600_000, status: 'completed', rollup: [],
  },
  incomplete: false,
  tokensByVendor: {},
  steps,
});

/** The retained listing a case answers with. */
const retained = (over: Partial<WireRunHistoryRetained> = {}): WireRunHistoryRetained =>
  ({ occurrences: [], warnings: [], ...over });

/** A daemon that answers the listing, one detail, one retained listing and files by path. */
function mount(
  listing: WireRunHistoryList,
  bodies: Record<string, unknown>,
  status: Record<string, number> = {},
) {
  const calls: string[] = [];
  const fetcher = (requested: string) => {
    calls.push(requested);
    const code = status[requested] ?? 200;
    return Promise.resolve({
      ok: code < 400,
      status: code,
      json: () => Promise.resolve(requested === DAEMON_ENDPOINTS.history ? listing : bodies[requested]),
    });
  };
  const view = document.createElement('div');
  document.body.append(view);
  const root = createRoot(view);
  roots.push(() => root.unmount());
  return { view, calls, render: () => act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK }))) };
}

/** The one control on a row, found by the label it renders in whichever position it is in. */
const toggleFor = (view: HTMLElement, id: string): HTMLButtonElement => {
  const found = [...(view.querySelector(`[data-history-row="${id}"]`)?.querySelectorAll('button') ?? [])]
    .find((node) => node.textContent === EXPAND_LABEL);
  if (!found) throw new Error(`no control on row ${id} — this clause has lost its subject`);
  return found;
};

/** The Open control beside one named retained file. */
const openFor = (view: HTMLElement, name: string): HTMLButtonElement => {
  const found = [...(view.querySelector(`[data-retained-file="${name}"]`)?.querySelectorAll('button') ?? [])]
    .find((node) => node.textContent === OPEN_FILE_LABEL || node.textContent === CLOSE_FILE_LABEL);
  if (!found) throw new Error(`no control beside ${name} — this clause has lost its subject`);
  return found as HTMLButtonElement;
};

/** One run, one occurrence, its detail and its retained listing — the shape most cases start from. */
function oneRun(steps: WireRunHistoryOccurrence[], listing: WireRunHistoryRetained, files: Record<string, unknown> = {}) {
  return mount(
    { runs: [row({ id: RUN, occurrenceCount: steps.length })], warnings: [] },
    { [historyDetailPath(RUN)]: detail(steps), [historyRetainedPath(RUN)]: listing, ...files },
  );
}

describe('Q-0137 AC-10/AC-12 — an opened row names what each occurrence retained, and one opens', () => {
  test('one listing request beside the detail, and no file request until a reader chooses one', async () => {
    const { view, calls, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }, { name: OUTPUT_FILE, bytes: 8 }] }] }),
      { [historyFilePath(RUN, 1, PROMPT_FILE)]: { name: PROMPT_FILE, bytes: 3, text: 'ask' } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect([...calls].sort(), 'opening a row did not issue exactly the two reads')
      .toStrictEqual([DAEMON_ENDPOINTS.history, historyDetailPath(RUN), historyRetainedPath(RUN)].sort());

    // Both names and both sizes, with nothing fetched for either.
    for (const [name, bytes] of [[PROMPT_FILE, 3], [OUTPUT_FILE, 8]] as [string, number][]) {
      const named = view.querySelector(`[data-retained-file="${name}"]`);
      expect(named, `${name} was not named`).not.toBeNull();
      expect(named?.textContent, `${name}'s size is not in front of the reader`)
        .toContain(retainedSizeText(bytes));
    }
    expect(calls.some((path) => path.includes('/file')), 'a file was fetched before anybody asked for it')
      .toBe(false);

    await act(async () => openFor(view, PROMPT_FILE).click());
    expect(calls.filter((path) => path.includes('/file')), 'choosing a file did not read exactly it')
      .toStrictEqual([historyFilePath(RUN, 1, PROMPT_FILE)]);
    expect(view.querySelector(`[data-retained-text="${PROMPT_FILE}"]`)?.textContent, 'the text did not render')
      .toBe('ask');
  });

  test('a retained name this product does not write is named and opens, with nothing hard-coded', async () => {
    const { view, calls, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: 'transcript.jsonl', bytes: 7 }] }] }),
      { [historyFilePath(RUN, 1, 'transcript.jsonl')]: { name: 'transcript.jsonl', bytes: 7, text: '{"a":1}' } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    await act(async () => openFor(view, 'transcript.jsonl').click());
    expect(view.querySelector('[data-retained-text="transcript.jsonl"]')?.textContent).toBe('{"a":1}');
    expect(calls, 'the third name was fetched at a path built from a register rather than from the listing')
      .toContain(historyFilePath(RUN, 1, 'transcript.jsonl'));
  });

  test('an occurrence the daemon warned about says so rather than appearing to have retained nothing', async () => {
    // The distinction that matters: *the daemon looked and there is nothing* against *the daemon
    // could not look*. Both render, and the second renders the daemon's own words.
    const message = "this occurrence's recorded directory is not there";
    const { view, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 }), step({ step_id: 'gone', seq: 2 })],
      retained({
        occurrences: [{ seq: 1, step_id: 'implement', files: [] }],
        warnings: [{ seq: 2, step_id: 'gone', message }],
      }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(view.querySelector('[data-retained-none="1"]')?.textContent, 'an empty directory said nothing')
      .toBe(NO_RETAINED_FILES_TEXT);
    expect(view.querySelector('[data-retained-warning="2"]')?.textContent, "the daemon's own words were lost")
      .toBe(message);
    // …and the two are different sentences, which is the whole clause.
    expect(NO_RETAINED_FILES_TEXT).not.toBe(message);
  });

  test('an occurrence the listing named in neither half says which read disagreed', async () => {
    // Reachable rather than hypothetical: the detail and the retained listing are two reads of one
    // manifest at two moments, and this store grows under a reader in ordinary operation.
    const { view, render } = oneRun([step({ step_id: 'implement', seq: 1 })], retained({}));
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(view.querySelector('[data-retained-unlisted="1"]')?.textContent).toBe(RETAINED_UNLISTED_TEXT);
  });

  test('the browser never receives or composes an occurrence directory', async () => {
    const { view, calls, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }] }] }),
      { [historyFilePath(RUN, 1, PROMPT_FILE)]: { name: PROMPT_FILE, bytes: 3, text: 'ask' } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    await act(async () => openFor(view, PROMPT_FILE).click());
    for (const path of calls) {
      expect(path.includes('occurrence_dir'), `${path} sent an occurrence directory`).toBe(false);
      expect(path.includes('steps/'), `${path} composed a filesystem path`).toBe(false);
    }
    expect(view.textContent?.includes('steps/'), 'an occurrence directory was rendered').toBe(false);
    // The file is addressed by the sequence number the listing carries, which is what the request
    // above shows — asserted by identity so a change of scheme is a visible act.
    expect(calls, 'the file was not addressed by its sequence number')
      .toContain(historyFilePath(RUN, 1, PROMPT_FILE));
  });
});

describe('Q-0137 AC-8 — the three absence sentences, keyed on kind and never on step id', () => {
  /** The sentence rendered for one occurrence's missing prompt, or `null` where none is. */
  const promptText = (view: HTMLElement, seq: number): string | null =>
    view.querySelector(`[data-no-prompt="${seq}"]`)?.textContent ?? null;

  /** …and for its missing output. */
  const outputText = (view: HTMLElement, seq: number): string | null =>
    view.querySelector(`[data-no-output="${seq}"]`)?.textContent ?? null;

  test('a prove-red step whose KIND is integrate gets the no-vendor sentence', async () => {
    // **The clause that goes red against a step-id-keyed implementation.** Measured over every
    // manifest here, the 85 occurrences with no prompt carry three different step ids — `integrate`
    // 73, `prove-red` 9 and `merge-contracts` 3 — so a sentence chosen by the step id is wrong
    // about 12 of them.
    const { view, render } = oneRun(
      [step({ step_id: 'prove-red', seq: 1, kind: 'integrate', adapter: null })],
      retained({ occurrences: [{ seq: 1, step_id: 'prove-red', files: [{ name: OUTPUT_FILE, bytes: 4 }] }] }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(promptText(view, 1), 'the sentence was not the kind-keyed one').toBe(noPromptText('integrate'));
    expect(promptText(view, 1), 'the sentence was chosen by the step id').not.toBe(noPromptText('prove-red'));
    // …and having an output, it says nothing about one.
    expect(outputText(view, 1), 'an occurrence that retained an output claimed it had none').toBeNull();
  });

  test('the rule is total over the three kinds, including the script this product has never produced', async () => {
    const kinds = ['adapter', 'script', 'integrate'];
    const { view, render } = oneRun(
      kinds.map((kind, index) => step({ step_id: `s${String(index)}`, seq: index + 1, kind, adapter: null })),
      retained({ occurrences: kinds.map((_kind, index) => ({ seq: index + 1, step_id: `s${String(index)}`, files: [{ name: OUTPUT_FILE, bytes: 1 }] })) }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    const rendered = kinds.map((_kind, index) => promptText(view, index + 1));
    expect(rendered, 'a kind rendered no sentence at all').toStrictEqual(kinds.map((kind) => noPromptText(kind)));
    // Three distinct sentences rather than one repeated, which a fall-through would produce.
    expect(new Set(rendered).size, 'two kinds share a sentence').toBe(3);
  });

  test('an adapter call that retained a prompt says nothing about one', async () => {
    const { view, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }, { name: OUTPUT_FILE, bytes: 8 }] }] }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(promptText(view, 1), 'an occurrence with a prompt was reported as having none').toBeNull();
    expect(outputText(view, 1), 'an occurrence with an output was reported as having none').toBeNull();
  });

  test('a running occurrence with no output has NOT FINISHED, and a terminal one retained none', async () => {
    // Two states and not one. The second is reachable because `terminal()`'s guarantee sits behind
    // an `existsSync` that answers true for a directory — so collapsing them would tell a reader to
    // wait for something that is never coming.
    const { view, render } = oneRun(
      [
        step({ step_id: 'running', seq: 1, status: 'running', duration_ms: null }),
        step({ step_id: 'finished', seq: 2, status: 'completed' }),
      ],
      retained({
        occurrences: [
          { seq: 1, step_id: 'running', files: [{ name: PROMPT_FILE, bytes: 3 }] },
          { seq: 2, step_id: 'finished', files: [{ name: PROMPT_FILE, bytes: 3 }] },
        ],
      }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(outputText(view, 1), 'a running step was told it had retained nothing').toBe(NO_OUTPUT_RUNNING_TEXT);
    expect(outputText(view, 2), 'a finished step was told to wait').toBe(NO_OUTPUT_TERMINAL_TEXT);
    expect(outputText(view, 2), 'the terminal case got the running sentence').not.toBe(NO_OUTPUT_RUNNING_TEXT);
  });

  test('a kind this page has no sentence for is NAMED rather than dropped', async () => {
    const { view, render } = oneRun(
      [step({ step_id: 'future', seq: 1, kind: 'panel', adapter: null })],
      retained({ occurrences: [{ seq: 1, step_id: 'future', files: [] }] }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(promptText(view, 1), 'an unplaceable kind rendered nothing').toBe(noPromptText('panel'));
    expect(promptText(view, 1), 'the kind was not named').toContain('panel');
  });
});

describe('Q-0138 AC-10 — the occurrence a real allocation leaves, rendered', () => {
  /** The sentence rendered for one occurrence's missing prompt, or `null` where none is. */
  const promptText = (view: HTMLElement, seq: number): string | null =>
    view.querySelector(`[data-no-prompt="${seq}"]`)?.textContent ?? null;

  /** …and for its missing output. */
  const outputText = (view: HTMLElement, seq: number): string | null =>
    view.querySelector(`[data-no-output="${seq}"]`)?.textContent ?? null;

  test('a step the writer has only allocated has its prompt, no output, and the not-finished sentence', async () => {
    // The shape `RunHistory.allocate` leaves and nothing else touches: `running`, no duration, one
    // retained file — the prompt `runAgentStep` writes before the vendor is invoked. This is the
    // rendering half, and the fixture is hand-built because the states this screen has to get right
    // are ones no store supplies (see this file's header).
    //
    // **That it is the shape the writer really produces is established by EXECUTING the producer,
    // and not here.** `packages/server/src/retained.test.ts`'s Q-0138 block starts a real run
    // through the daemon's own host, holds it between allocation and completion, and asserts what
    // the three routes answer — including that the status a real allocation puts on the wire is the
    // one `history-screen.tsx` branches on. It lives there because that is the only package where
    // both halves are reachable: this one depends on `@quorum/shared` alone and may reach neither the
    // engine nor the daemon, and giving the browser app a dependency on either to make a test
    // convenient would be an architecture change rather than a test.
    const { view, render } = oneRun(
      [step({ step_id: 'implement', seq: 1, status: 'running', duration_ms: null })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 14 }] }] }),
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(outputText(view, 1), 'a step that has not finished was told it retained nothing')
      .toBe(NO_OUTPUT_RUNNING_TEXT);
    expect(outputText(view, 1), 'the terminal sentence reached a running step').not.toBe(NO_OUTPUT_TERMINAL_TEXT);
    // Its prompt is named and sized without being opened, which is what a reader watching a step
    // actually wants.
    expect(promptText(view, 1), 'a step with a prompt was reported as having none').toBeNull();
    const cell = view.querySelector(`[data-occurrence="implement"]`)?.textContent ?? '';
    expect(cell).toContain(PROMPT_FILE);
    expect(cell).not.toContain(OUTPUT_FILE);
  });

  test('and no second running-state sentence was introduced beside the one that exists', async () => {
    // AC-10's other half: the case is answered by the constant Q-0137 already added rather than by
    // a new placeholder, so a reader meets one sentence for one state rather than two that have to
    // be told apart. Asserted over the module's own exports so a fourth is a visible act.
    const running = Object.entries(historyText)
      .filter(([, value]) => typeof value === 'string' && value.includes('has not finished'))
      .map(([name]) => name);
    expect(running, 'a second sentence for a step that has not finished').toStrictEqual(['NO_OUTPUT_RUNNING_TEXT']);
  });
});

describe('Q-0137 AC-11 — the four request states, and a late answer under the wrong selection', () => {
  test('loading, failed, loaded-empty and loaded-with-text are four distinguishable states', async () => {
    const { view, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }, { name: OUTPUT_FILE, bytes: 0 }] }] }),
      {
        [historyFilePath(RUN, 1, PROMPT_FILE)]: { name: PROMPT_FILE, bytes: 3, text: 'ask' },
        [historyFilePath(RUN, 1, OUTPUT_FILE)]: { name: OUTPUT_FILE, bytes: 0, text: '' },
      },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());

    await act(async () => openFor(view, PROMPT_FILE).click());
    expect(view.querySelector(`[data-retained-text="${PROMPT_FILE}"]`)?.textContent, 'loaded-with-text').toBe('ask');

    await act(async () => openFor(view, OUTPUT_FILE).click());
    // **Loaded-and-empty is an answer, not a request still out.** Rendering nothing for it would be
    // indistinguishable from in-flight, and eight of the files this store retains are empty.
    expect(view.querySelector(`[data-retained-empty="${OUTPUT_FILE}"]`)?.textContent).toBe(EMPTY_FILE_TEXT);
    expect(view.querySelector(`[data-retained-text="${OUTPUT_FILE}"]`), 'an empty file rendered a text region')
      .toBeNull();
  });

  test('a failed file read renders its own state and a Retry that repeats only it', async () => {
    const { view, calls, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }] }] }),
      { [historyFilePath(RUN, 1, PROMPT_FILE)]: { code: 'no-such-file', condition: 'it is no longer a file', remedy: null } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    const opened = calls.length;
    await act(async () => openFor(view, PROMPT_FILE).click());
    const region = view.querySelector('[data-retained-open], [data-request-state]');
    expect(region, 'a failed file read rendered nothing at all').not.toBeNull();

    const retry = [...view.querySelectorAll('button')].filter((node) => node.textContent === HISTORY_RETRY_LABEL);
    expect(retry.length, 'a failed file read offered no retry, so this clause has no subject').toBe(1);
    await act(async () => (retry[0] as HTMLButtonElement).click());
    expect(calls.slice(opened), 'Retry repeated something other than the file that failed')
      .toStrictEqual([historyFilePath(RUN, 1, PROMPT_FILE), historyFilePath(RUN, 1, PROMPT_FILE)]);
  });

  test('a response for a file that is no longer selected does not land under the current one', async () => {
    // Staged: the first file's body is a promise this test settles LAST, so the answer for a
    // superseded selection genuinely arrives after the selection that replaced it.
    let settle: (body: unknown) => void = () => {};
    const outstanding = new Promise<unknown>((resolve) => { settle = resolve; });
    const bodies: Record<string, unknown> = {
      [historyDetailPath(RUN)]: detail([step({ step_id: 'implement', seq: 1 })]),
      [historyRetainedPath(RUN)]: retained({
        occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }, { name: OUTPUT_FILE, bytes: 8 }] }],
      }),
      [historyFilePath(RUN, 1, OUTPUT_FILE)]: { name: OUTPUT_FILE, bytes: 8, text: 'SECOND' },
    };
    const fetcher = (requested: string) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => (requested === historyFilePath(RUN, 1, PROMPT_FILE)
        ? outstanding
        : Promise.resolve(requested === DAEMON_ENDPOINTS.history
          ? { runs: [row({ id: RUN })], warnings: [] }
          : bodies[requested])),
    });
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    await act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK })));
    await act(async () => toggleFor(view, RUN).click());

    await act(async () => openFor(view, PROMPT_FILE).click());
    await act(async () => openFor(view, OUTPUT_FILE).click());
    expect(view.querySelector(`[data-retained-text="${OUTPUT_FILE}"]`)?.textContent, 'the second selection did not render')
      .toBe('SECOND');

    await act(async () => { settle({ name: PROMPT_FILE, bytes: 3, text: 'FIRST' }); await outstanding; });
    expect(view.querySelector(`[data-retained-text="${OUTPUT_FILE}"]`)?.textContent,
      "a superseded file's answer replaced the current selection").toBe('SECOND');
    expect(view.querySelector(`[data-retained-text="${PROMPT_FILE}"]`),
      'a superseded selection reopened itself').toBeNull();
  });

  test('closing a file discards it, and closing the row discards it too', async () => {
    const { view, render } = oneRun(
      [step({ step_id: 'implement', seq: 1 })],
      retained({ occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: PROMPT_FILE, bytes: 3 }] }] }),
      { [historyFilePath(RUN, 1, PROMPT_FILE)]: { name: PROMPT_FILE, bytes: 3, text: 'ask' } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    await act(async () => openFor(view, PROMPT_FILE).click());
    expect(openFor(view, PROMPT_FILE).textContent, 'the control did not move to its close position')
      .toBe(CLOSE_FILE_LABEL);

    await act(async () => openFor(view, PROMPT_FILE).click());
    expect(view.querySelector(`[data-retained-text="${PROMPT_FILE}"]`), 'closing left the text on screen').toBeNull();
    expect(openFor(view, PROMPT_FILE).textContent).toBe(OPEN_FILE_LABEL);

    // …and collapsing the row takes the selection with it rather than holding a hidden copy.
    await act(async () => openFor(view, PROMPT_FILE).click());
    const collapse = [...(view.querySelector(`[data-history-row="${RUN}"]`)?.querySelectorAll('button') ?? [])]
      .find((node) => node.textContent !== OPEN_FILE_LABEL && node.textContent !== CLOSE_FILE_LABEL);
    await act(async () => (collapse as HTMLButtonElement).click());
    expect(view.querySelector('[data-opened-run]'), 'collapsing left the region open').toBeNull();
    await act(async () => toggleFor(view, RUN).click());
    expect(view.querySelector(`[data-retained-text="${PROMPT_FILE}"]`),
      'reopening the row restored a file the reader had closed with it').toBeNull();
  });

  test('a failed retained listing renders once for the row, not once per occurrence', async () => {
    // Fifty-five identical sentences each offering the same Retry is one answer rendered fifty-five
    // times, so the listing's own state is the row's and what is per occurrence is what the listing
    // said ABOUT it. The Retry repeats only the listing.
    const steps = [1, 2, 3].map((seq) => step({ step_id: `s${String(seq)}`, seq }));
    const { view, calls, render } = mount(
      { runs: [row({ id: RUN, occurrenceCount: 3 })], warnings: [] },
      { [historyDetailPath(RUN)]: detail(steps), [historyRetainedPath(RUN)]: { nope: true } },
    );
    await render();
    await act(async () => toggleFor(view, RUN).click());
    expect(view.querySelectorAll('[data-retained-request]').length, 'the listing state rendered per occurrence')
      .toBe(1);
    expect(view.querySelectorAll('[data-retained]').length, 'an occurrence rendered a retained region anyway')
      .toBe(0);

    const opened = calls.length;
    const retry = [...view.querySelectorAll('[data-retained-request] button')]
      .find((node) => node.textContent === HISTORY_RETRY_LABEL);
    expect(retry, 'a failed listing offered no retry, so this clause has no subject').toBeDefined();
    await act(async () => (retry as HTMLButtonElement).click());
    expect(calls.slice(opened), 'Retry repeated the detail read as well as the listing')
      .toStrictEqual([historyRetainedPath(RUN)]);
  });
});
