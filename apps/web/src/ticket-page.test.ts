// @vitest-environment jsdom
/**
 * Q-0127 AC-8 to AC-12 — what the ticket page draws, over a daemon this file answers for.
 *
 * THE DOM COMES FROM THE DOCBLOCK ABOVE AND FROM NOWHERE ELSE, and the file is `.test.ts` rather
 * than `.test.tsx` — both for the reasons `backlog-board.test.ts`'s header gives:
 * `apps/web/vitest.config.js` is pinned byte for byte by the discovery guard, and `testFilesIn`
 * matches a `.test.ts` suffix only, so a `.tsx` suite would run while being invisible to that guard
 * and hashed by no turbo input.
 *
 * It sits under `src/` because it reaches for nothing a browser does not have: a document, React,
 * and the app's own modules. Every request is injected, so nothing here opens a socket.
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import type { WireTicketFileEntry } from '@quorum/shared';

import { ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import type { DaemonResponse } from './daemon-client.js';
import {
  CHOOSE_FILE, LOG_HEADING, NO_FILES, NO_RUN_LOG, RETRY_LABEL, RUN_LOG, tabsOf, TICKET_FILE,
  TicketPage,
} from './ticket-page.js';

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

const TICKET = 'Q-0001';

/** One ticket row, with everything a header can carry defaulted to the quiet answer. */
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: TICKET, folder: `${TICKET}-a-ticket`, title: 'a ticket', stage: 'draft', owner: 'ruud',
  branch: `harness/${TICKET}/integration`, containment: null, iterations: {}, billedCostUsd: null,
  ...over,
});

/** One listing entry, typed so `tabsOf` can be driven over the same fixtures the DOM cases use. */
const entry = (rel: string, bytes = 64): WireTicketFileEntry => ({ rel, bytes });

/** One detail body, with the files a fixture names. */
const detail = (files: WireTicketFileEntry[], over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ticket: row(),
  files,
  excluded: { count: 0, bytes: 0 },
  ...over,
});

/** What a fixture's daemon answers for each path, and what every request it took looked like. */
interface Answers {
  /** The detail body, or a status to refuse it with. */
  readonly detail?: unknown;
  /** Each file's text, by relative path. A path absent here is refused with `status`. */
  readonly texts?: Record<string, string>;
  readonly status?: number;
  readonly fileStatus?: number;
  readonly reject?: boolean;
}

function daemon(answers: Answers): { fetch: (path: string) => Promise<DaemonResponse>; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetch: (path: string) => {
      asked.push(path);
      if (answers.reject === true) return Promise.reject(new Error('connection refused'));
      const isDetail = path === ticketDetailPath(TICKET);
      if (isDetail) {
        const status = answers.status ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(answers.detail ?? detail([])),
        });
      }
      const rel = Object.keys(answers.texts ?? {}).find((each) => path === ticketFilePath(TICKET, each));
      if (rel === undefined) {
        const status = answers.fileStatus ?? 404;
        return Promise.resolve({
          ok: false,
          status,
          json: () => Promise.resolve({ code: 'no-such-file', condition: `${path} is not a file this ticket holds`, remedy: null }),
        });
      }
      const text = answers.texts?.[rel] ?? '';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ rel, bytes: text.length, text }),
      });
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

/** The page over one set of answers, already settled, with the requests it made. */
async function page(answers: Answers, ticketId = TICKET): Promise<{ view: HTMLElement; asked: string[] }> {
  const server = daemon(answers);
  const view = await render(createElement(TicketPage, { ticketId, fetcher: server.fetch, now: CLOCK }));
  return { view, asked: server.asked };
}

/** Every button on the page whose label is exactly `label`. */
const buttonsFor = (view: HTMLElement, label: string): HTMLButtonElement[] =>
  [...view.querySelectorAll('button')].filter((button) => button.textContent === label);

/** Click the first element matching `selector` whose text contains `text`. */
async function click(view: HTMLElement, selector: string, text: string): Promise<void> {
  const target = [...view.querySelectorAll(selector)].find((node) => (node.textContent ?? '').includes(text));
  if (!target) throw new Error(`nothing matching ${selector} holds ${text}`);
  await act(async () => { (target as HTMLElement).click(); });
}

describe('AC-9 — the listing on mount, and no artifact text until a reader asks', () => {
  const FOLDER = [
    entry(TICKET_FILE, 812),
    entry(RUN_LOG, 240),
    entry('review/hand-review.txt', 1_048_576),
  ];

  test('mounting issues exactly three requests, and none is for the megabyte artifact', async () => {
    const { asked } = await page({
      detail: detail(FOLDER),
      texts: { [TICKET_FILE]: 'the ticket\n', [RUN_LOG]: 'a line\n' },
    });
    expect(asked).toStrictEqual([
      ticketDetailPath(TICKET),
      ticketFilePath(TICKET, TICKET_FILE),
      ticketFilePath(TICKET, RUN_LOG),
    ]);
    expect(asked, 'the page fetched a file nobody opened')
      .not.toContain(ticketFilePath(TICKET, 'review/hand-review.txt'));
  });

  test('and a folder of fifty files still costs three, which is what a prefetcher fails', async () => {
    // The discriminator, rather than a second reading of the clause above: three is a constant of
    // the design and not of the fixture, so a version that fetched what it listed would issue
    // fifty-one here and three there. The count is what goes red, by 48.
    const many = [entry(TICKET_FILE), entry(RUN_LOG)];
    for (let at = 0; at < 48; at += 1) many.push(entry(`dev/chore/run-${String(at)}/implement-iter-1.md`));
    const { asked } = await page({
      detail: detail(many),
      texts: { [TICKET_FILE]: 'the ticket\n', [RUN_LOG]: 'a line\n' },
    });
    expect(asked.length, 'the page fetched more than the listing and the two files it renders').toBe(3);
  });

  test('and selecting that file issues exactly one more request, which is for it', async () => {
    const { view, asked } = await page({
      detail: detail(FOLDER),
      texts: { [TICKET_FILE]: 'the ticket\n', [RUN_LOG]: 'a line\n', 'review/hand-review.txt': 'the review\n' },
    });
    const before = asked.length;
    await click(view, 'button', 'review');
    await click(view, 'button', 'review/hand-review.txt');
    expect(asked.length - before, 'opening one file cost more than one request').toBe(1);
    expect(asked.at(-1)).toBe(ticketFilePath(TICKET, 'review/hand-review.txt'));
    expect(view.textContent, 'the file a reader opened is not on the page').toContain('the review');
  });

  test('every row carries its size before the file is asked for', async () => {
    const { view } = await page({ detail: detail(FOLDER), texts: { [TICKET_FILE]: 'x' } });
    await click(view, 'button', 'review');
    expect(view.textContent, 'a reader is offered a file without being told what it costs')
      .toContain('1048576 bytes');
  });

  test('a failed file request leaves the listing and the tabs rendered', async () => {
    // The two states are separate by design: a file that could not be read is not a ticket that is
    // not there, and a page that collapsed into one message would send a reader to look for the
    // wrong thing.
    const { view } = await page({ detail: detail(FOLDER), texts: { [RUN_LOG]: 'a line\n' } });
    // `ticket.md` is the file the mount asked for and the one that was refused; the listing, the
    // tabs and the header are all still there, and the request that failed is the only thing that
    // reports a failure.
    expect([...view.querySelectorAll('nav button')].map((node) => node.textContent),
      'a failed file request erased the tabs').toStrictEqual([TICKET_FILE, 'review']);
    expect(view.textContent, 'a failed file request erased the listing').toContain(`${TICKET_FILE} · 812 bytes`);
    expect(view.textContent, 'a failed file request relabelled the ticket as missing').toContain('a ticket');
    expect(view.querySelector('[data-request-state]')?.getAttribute('data-request-state'),
      'a failed file request was reported as a failed ticket').toBe('loaded');
    expect(buttonsFor(view, RETRY_LABEL).length, 'a failed file request offers no way to ask again')
      .toBeGreaterThan(0);
  });

  test('a different id renders nothing from the ticket before it', async () => {
    const server = daemon({ detail: detail(FOLDER), texts: { [TICKET_FILE]: 'FIRST-TICKET-TEXT\n' } });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TicketPage, { ticketId: TICKET, fetcher: server.fetch, now: CLOCK })));
    mounted.push(() => root.unmount());
    expect(container.textContent).toContain('FIRST-TICKET-TEXT');
    await act(async () => root.render(createElement(TicketPage, { ticketId: 'Q-0002', fetcher: server.fetch, now: CLOCK })));
    expect(container.textContent, 'one ticket\'s file is rendered under another ticket\'s id')
      .not.toContain('FIRST-TICKET-TEXT');
  });
});

describe('AC-10 — the tabs are derived from the listing, never from a list', () => {
  test('a top-level file this product has not thought of gets a tab', async () => {
    // `docs/05-design-prompt.md:27` names six artifact folders, and one ticket in this backlog
    // already holds a seventh top-level entry — so a written-down set loses a file on the day it is
    // written down.
    const { view } = await page({
      detail: detail([entry(TICKET_FILE), entry('adapter-probe.md'), entry('dev/notes.md')]),
      texts: { [TICKET_FILE]: 'x' },
    });
    const tabs = [...view.querySelectorAll('nav button')].map((node) => node.textContent);
    expect(tabs).toStrictEqual([TICKET_FILE, 'adapter-probe.md', 'dev']);
  });

  test('a folder that is absent renders no tab, and no empty one', async () => {
    // 5 tickets in 107 have a `solution/`, so a tab for the other 102 would be a promise of
    // something that is not there — which `docs/04-architecture.md` forbids by name.
    const { view } = await page({ detail: detail([entry(TICKET_FILE), entry('dev/notes.md')]), texts: { [TICKET_FILE]: 'x' } });
    const tabs = [...view.querySelectorAll('nav button')].map((node) => node.textContent);
    expect(tabs, 'a tab was drawn for a folder the listing does not hold').not.toContain('solution');
    expect(tabs).toStrictEqual([TICKET_FILE, 'dev']);
  });

  test('an existing directory holding no file renders no tab, which is a measured bound', async () => {
    // Stated in place rather than left to be found: the response carries files and no directories,
    // so a directory that exists and is empty is indistinguishable from one that is absent. There
    // are zero empty directories under this repository's backlog and git cannot track one, so the
    // case reaches a clone only through an interrupted run — at which point the tab would have
    // nothing to show anyway.
    const { view } = await page({ detail: detail([entry(TICKET_FILE)]), texts: { [TICKET_FILE]: 'x' } });
    expect([...view.querySelectorAll('nav button')].map((node) => node.textContent)).toStrictEqual([TICKET_FILE]);
  });

  test('a four-level path is reachable, and two runs of one flow stay distinct', async () => {
    // The divergence from *"Review — rounds as columns"*, which was written before Q-0086 to Q-0089
    // scoped every artifact by `{run}` and `{iter}`: the real shape is two levels below the tab and
    // a flow can run more than once, so columns would merge two rounds into one.
    const { view } = await page({
      detail: detail([
        entry(TICKET_FILE),
        entry('dev/chore/run-2/implement-iter-1.md'),
        entry('dev/chore/run-4/implement-iter-1.md'),
        entry('dev/development/run-4/green-report-iter-1.md'),
      ]),
      texts: { [TICKET_FILE]: 'x', 'dev/chore/run-4/implement-iter-1.md': 'the fourth run\n' },
    });
    await click(view, 'nav button', 'dev');
    for (const rel of ['dev/chore/run-2/implement-iter-1.md', 'dev/chore/run-4/implement-iter-1.md', 'dev/development/run-4/green-report-iter-1.md']) {
      expect(view.textContent, `${rel} is not reachable`).toContain(rel);
    }
    await click(view, 'button', 'dev/chore/run-4/implement-iter-1.md');
    expect(view.textContent, 'one run\'s report was served for another\'s').toContain('the fourth run');
  });

  test('the run log is not a tab, because it has a region of its own', async () => {
    const { view } = await page({
      detail: detail([entry(TICKET_FILE), entry(RUN_LOG)]),
      texts: { [TICKET_FILE]: 'x', [RUN_LOG]: 'a line\n' },
    });
    expect([...view.querySelectorAll('nav button')].map((node) => node.textContent), 'the run log is offered twice')
      .toStrictEqual([TICKET_FILE]);
  });

  test('and the derivation itself is a function of the listing, asserted directly', () => {
    // Over the exported function as well as over the DOM, because what AC-10 forbids is a list —
    // and a component with a hard-coded set would still render the right tabs for a fixture whose
    // folders happen to be on it.
    expect(tabsOf([entry('qa/red-report.md'), entry(TICKET_FILE), entry(RUN_LOG), entry('zz-unknown/x.md')])
      .map((tab) => tab.name)).toStrictEqual([TICKET_FILE, 'qa', 'zz-unknown']);
    expect(tabsOf([]), 'an empty listing produced a tab').toStrictEqual([]);
    expect(tabsOf([entry(RUN_LOG)]).length, 'the run log produced a tab').toBe(0);
  });

  test('a folder with nothing to show says so rather than drawing an empty panel', async () => {
    const { view } = await page({ detail: detail([]) });
    expect(view.textContent).toContain(NO_FILES);
  });
});

describe('AC-11 — the run log renders down the side, and its absence says so', () => {
  test('a ticket with a run log renders its lines', async () => {
    const { view } = await page({
      detail: detail([entry(TICKET_FILE), entry(RUN_LOG)]),
      texts: { [TICKET_FILE]: 'x', [RUN_LOG]: '2026-09-16 run=1 flow=chore\n2026-09-16 run=2 flow=chore\n' },
    });
    const rail = view.querySelector(`[aria-label="${LOG_HEADING}"]`);
    expect(rail, 'there is no run-log region at all').not.toBeNull();
    expect(rail?.textContent, 'the run log is not rendered').toContain('run=2 flow=chore');
  });

  test('a ticket without one renders a sentence naming what is absent', async () => {
    // 16 of 107 tickets here have no run log, which is not an error and must not read as one.
    // Asserted by rendered TEXT rather than by a node count: an empty rail would satisfy a count.
    const { view } = await page({ detail: detail([entry(TICKET_FILE)]), texts: { [TICKET_FILE]: 'x' } });
    const rail = view.querySelector(`[aria-label="${LOG_HEADING}"]`);
    expect(rail?.textContent, 'an absent run log renders an empty rail').toContain(NO_RUN_LOG);
  });
});

describe('AC-12 — artifact text renders as escaped preformatted text', () => {
  test('a file carrying markup renders those characters and creates nothing', async () => {
    const hostile = `<script>alert(1)</script> & <img ${'onerror'}="alert(2)">`;
    const { view } = await page({
      detail: detail([entry(TICKET_FILE), entry('dev/notes.md')]),
      texts: { [TICKET_FILE]: 'x', 'dev/notes.md': hostile },
    });
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/notes.md');
    const shown = [...view.querySelectorAll('pre')].map((node) => node.textContent ?? '').join('\n');
    expect(shown, 'the file\'s own characters are not on the page').toContain('<script>alert(1)</script>');
    expect(shown, 'the ampersand was swallowed').toContain(' & ');
    // Nothing was CREATED from it: no element, no attribute, no handler. Asserted over the DOM
    // rather than over the markup — the serialised HTML still holds those characters, escaped,
    // which is exactly what "rendered as text" means and is not a violation.
    expect(view.querySelectorAll('script').length, 'a script element was created from a file\'s text').toBe(0);
    expect(view.querySelectorAll('img').length, 'an image element was created from a file\'s text').toBe(0);
    expect(view.querySelectorAll('[onerror]').length, 'an attribute was created from a file\'s text').toBe(0);
    // …and the escaping is what did it, which the markup is where to see: the angle brackets a
    // browser would have parsed are entities.
    expect(view.innerHTML, 'a file\'s markup reached the parser unescaped').toContain('&lt;script&gt;');
    expect(view.innerHTML, 'the ampersand reached the parser unescaped').toContain('&amp;');
  });
});

describe('AC-8 — every request state renders, and each offers what can be done about it', () => {
  test('the five states are five sentences, and no two collapse', async () => {
    const seen = new Set<string>();
    // in-flight: rendered before anything settles, which is what the never-resolving fetch stages.
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TicketPage, {
      ticketId: TICKET,
      fetcher: () => new Promise<DaemonResponse>(() => undefined),
      now: CLOCK,
    })));
    mounted.push(() => root.unmount());
    seen.add(container.querySelector('[data-request-state]')?.getAttribute('data-request-state') ?? '');
    expect(container.textContent, 'the in-flight state does not name what it is waiting for')
      .toContain(ticketDetailPath(TICKET));

    // loaded, unreachable, refused, unparseable — each over the detail request, which is the one
    // whose state the page as a whole reports.
    const cases: [string, Answers][] = [
      ['loaded', { detail: detail([entry(TICKET_FILE)]), texts: { [TICKET_FILE]: 'x' } }],
      ['unreachable', { reject: true }],
      ['refused', { status: 404 }],
      ['unparseable', { detail: { nonsense: true } }],
    ];
    for (const [expected, answers] of cases) {
      const { view } = await page(answers);
      const state = view.querySelector('[data-request-state]')?.getAttribute('data-request-state');
      expect(state, `a ${expected} answer did not render as one`).toBe(expected);
      seen.add(state ?? '');
      // Every failure offers the one action that could help; a settled success does not.
      expect(buttonsFor(view, RETRY_LABEL).length > 0, `${expected} offers the wrong retry`)
        .toBe(expected !== 'loaded');
    }
    expect([...seen].sort(), 'two states rendered as one')
      .toStrictEqual(['in-flight', 'loaded', 'refused', 'unparseable', 'unreachable']);
  });

  test('a refusal carries the daemon\'s own condition rather than a sentence this page wrote', async () => {
    const { view } = await page({
      detail: detail([entry(TICKET_FILE), entry('dev/notes.md')]),
      texts: { [TICKET_FILE]: 'x' },
      fileStatus: 422,
    });
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/notes.md');
    expect(view.textContent, 'the daemon\'s own condition did not reach the page')
      .toContain('is not a file this ticket holds');
  });

  test('before a file is chosen the page says so rather than showing an empty panel', () => {
    // The constant exists so that the sentence a reader meets and the one a test asserts cannot
    // become two. A tab whose file nobody has opened is not a blank region.
    expect(CHOOSE_FILE.trim().length).toBeGreaterThan(10);
  });
});
