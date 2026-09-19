// @vitest-environment jsdom
/**
 * Q-0138 AC-10 — the screen renders the not-finished sentence for an occurrence a REAL writer
 * produced, over the bytes that writer put on the wire.
 *
 * **What this file is, and why it is not the rendering test one directory over.**
 * `src/history-retained.test.ts` keeps its hand-built fixture, which is what AC-10's own `Test:`
 * clause directs: the states that screen has to get right are ones no store supplies, so a fixture
 * is the only way to reach them. What that clause then asks for is a join — *"the wire shape
 * reaching it is one the writer actually produces, so the fixture and the producer cannot drift"* —
 * and run 2 iteration 2 made that join a source-text scan of one status literal, which is this
 * repository's weakest instrument and could not see the other sixteen fields. This file and
 * `packages/server/src/retained.test.ts`'s Q-0138 block are what replaced it, and between them the
 * whole wire shape is both **produced by an executed run** and **rendered by an executed screen**.
 *
 * **The recording is the join, because no process holds both halves.** Producing needs the engine
 * and the daemon; rendering needs React and jsdom, which live only here — and `@quorum/web` declares
 * `@quorum/shared` and nothing else, so giving the browser app a dependency on the engine or on the
 * daemon it talks to over HTTP would be an architecture change (`04-architecture.md`'s dependency
 * direction and its package table) rather than a test. So the two halves meet at an artifact:
 * {@link RECORDING} was captured verbatim from the three routes of a real held run, this file feeds
 * it to {@link HistoryScreen}, and `packages/server`'s suite starts that same run and asserts what it
 * answers still equals it. Neither half can pass alone — **editing the recording to satisfy this
 * file leaves the producer's suite red**, which is the clause AC-10 ends on.
 *
 * It lives under `test/` rather than under `src/` because it reads a file: `apps/web/src` may import
 * no `node:` specifier, and Q-0014 put the suites that must read the repository here for that reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { OUTPUT_FILE, PROMPT_FILE } from '@quorum/shared';
import type { WireRunHistory, WireRunHistoryList, WireRunHistoryRetained } from '@quorum/shared';

import { DAEMON_ENDPOINTS, historyDetailPath, historyRetainedPath } from '../src/daemon-endpoints.js';
import { HistoryScreen } from '../src/history-screen.js';
import { EXPAND_LABEL, NO_OUTPUT_RUNNING_TEXT, NO_OUTPUT_TERMINAL_TEXT } from '../src/history-text.js';

/** Where the recording sits, named once so the producer's suite and this one cannot drift apart. */
const RECORDING = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'running-occurrence.json',
);

/** The three bodies a real held run answered, as this file received them. */
interface Recorded {
  readonly wire: {
    readonly list: WireRunHistoryList;
    readonly detail: WireRunHistory;
    readonly retained: WireRunHistoryRetained;
  };
}

const recorded = JSON.parse(fs.readFileSync(RECORDING, 'utf8')) as Recorded;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const roots: (() => void)[] = [];
afterEach(async () => {
  for (const close of roots.splice(0)) await act(async () => close());
  document.body.innerHTML = '';
});

/** A clock the test supplies, so a fetched-at instant is not a property of the machine. */
const CLOCK = (): string => '2026-09-19T09:00:00.000Z';

describe('Q-0138 AC-10 — a recorded wire response, rendered', () => {
  /**
   * A daemon that answers exactly the three recorded bodies, at the paths this screen asks for.
   *
   * Nothing is composed here: the listing, the detail and the retained listing are the objects the
   * routes produced, handed back unaltered. A path this screen asks for that is not one of the three
   * throws rather than answering `undefined`, so a screen that started asking for something else
   * fails here instead of rendering over a hole.
   */
  function mount() {
    const bodies: Record<string, unknown> = {
      [DAEMON_ENDPOINTS.history]: recorded.wire.list,
      [historyDetailPath(RUN_ID)]: recorded.wire.detail,
      [historyRetainedPath(RUN_ID)]: recorded.wire.retained,
    };
    const fetcher = (requested: string) => {
      if (!(requested in bodies)) throw new Error(`the screen asked for ${requested}, which this run did not answer`);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(bodies[requested]) });
    };
    const view = document.createElement('div');
    document.body.append(view);
    const root = createRoot(view);
    roots.push(() => root.unmount());
    return {
      view,
      render: () => act(async () => root.render(createElement(HistoryScreen, { fetcher, now: CLOCK }))),
    };
  }

  /** The run the recording is of, read out of the recording rather than written here. */
  const RUN_ID = recorded.wire.list.runs[0].id;

  test('the recording is of a step that had not finished, so this file has a subject', () => {
    // The premise every clause below rests on, asserted rather than assumed: a recording of a
    // FINISHED occurrence would render the terminal sentence and the next test would pass for the
    // wrong reason. This is what stops the recording being silently replaced by an easier one.
    const step = recorded.wire.detail.steps[0];
    expect(step.status, 'the recorded occurrence is not one that was still going').toBe('running');
    expect(step.duration_ms, 'a step that had not finished carries a duration').toBeNull();
    const files = recorded.wire.retained.occurrences[0].files.map((file) => file.name);
    expect(files, 'the recorded occurrence retained no prompt, or already has an output').toStrictEqual([PROMPT_FILE]);
    expect(recorded.wire.list.runs[0].occurrenceCount, 'the recorded row counts no occurrence').toBe(1);
  });

  test('it renders the not-finished sentence and never the terminal one', async () => {
    const { view, render } = mount();
    await render();
    const toggle = [...(view.querySelector(`[data-history-row="${RUN_ID}"]`)?.querySelectorAll('button') ?? [])]
      .find((node) => node.textContent === EXPAND_LABEL);
    if (!toggle) throw new Error(`no control on row ${RUN_ID} — this clause has lost its subject`);
    await act(async () => toggle.click());

    const seq = recorded.wire.detail.steps[0].seq;
    const sentence = view.querySelector(`[data-no-output="${String(seq)}"]`)?.textContent ?? null;
    expect(sentence, 'the occurrence a real allocation produced rendered no output sentence at all')
      .toBe(NO_OUTPUT_RUNNING_TEXT);
    expect(sentence, 'the terminal sentence reached a step the writer had only allocated')
      .not.toBe(NO_OUTPUT_TERMINAL_TEXT);
    // …and over the whole rendered region, not only at that one anchor: a second copy of the
    // terminal sentence somewhere else on the row would be the same false claim to a reader.
    expect(view.textContent ?? '', 'the terminal sentence is rendered somewhere on this row')
      .not.toContain(NO_OUTPUT_TERMINAL_TEXT);

    // The prompt it had already retained is named and the output it cannot have yet is not, which is
    // what a reader watching a step in progress actually came for.
    const cell = view.querySelector(`[data-occurrence="${recorded.wire.detail.steps[0].step_id}"]`)?.textContent ?? '';
    expect(cell, 'the prompt this run wrote before the vendor was invoked is not named').toContain(PROMPT_FILE);
    expect(cell, 'an output was named for a step that has not produced one').not.toContain(OUTPUT_FILE);
  });

  test('the two sentences are different, so the clause above discriminates', () => {
    expect(NO_OUTPUT_RUNNING_TEXT).not.toBe(NO_OUTPUT_TERMINAL_TEXT);
  });
});
