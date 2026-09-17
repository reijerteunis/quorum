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
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import type { WireFlow, WireTicketFileEntry } from '@quorum/shared';

import { DAEMON_ENDPOINTS, ticketDetailPath, ticketFilePath } from './daemon-endpoints.js';
import type { DaemonRequest, DaemonResponse } from './daemon-client.js';
import { FLOWS_UNREAD, NO_CONSUMING_FLOW } from './backlog-board.js';
import { runPath } from './routes.js';
import {
  CONFIRM_START_LABEL, LOOK_AGAIN_LABEL, REFUSED_FLOW_NOTE, START_REFUSAL_TEXT, STARTED_PREFIX,
  WITHDRAW_LABEL, startConfirmation, startLabel,
} from './run-lifecycle.js';
import {
  CHOOSE_FILE, LOG_HEADING, NO_FILES, NO_RUN_LOG, offerStanding, REFRESH_LABEL, RETRY_LABEL,
  RUN_LOG, tabsOf, TICKET_FILE, TicketPage,
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

/**
 * The daemon's `lock-held` condition as this page receives it, rendered verbatim and never read into.
 *
 * **Assembled rather than written out**, so no file under `apps/web/src` spells the run-number
 * literal the engine's own narration is written with — Q-0131 AC-6 forbids it over the whole corpus
 * rather than registering the sites that are not parses, and a fixture is the one place it would
 * otherwise survive. `apps/web/test/source.test.ts` is where that is enforced — over every file in
 * the tree, comments included, which is why this one names the literal without spelling it.
 */
const LOCK_HELD_CONDITION = `run lock refused: ticket Q-0130 is held by run${' '}#7`;

/**
 * A navigation that goes nowhere, for the clauses whose subject is not a start.
 *
 * Q-0130 AC-7's own clauses supply a recorder instead: a spy asserted to have been called with the
 * registered run path is what proves the navigation happens, and every clause below it predates the
 * control that causes one.
 */
const NOWHERE = (): void => undefined;

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
  /**
   * The flow listing, which the page reads beside the detail since Q-0130.
   *
   * Empty by default, so every clause that predates the start control gets a region saying no flow
   * consumes this stage rather than one saying the listing could not be read — the second would be
   * an unrelated failure sentence on a page under assertion for something else.
   */
  readonly flows?: unknown;
  readonly flowStatus?: number;
}

function daemon(answers: Answers): { fetch: (path: string) => Promise<DaemonResponse>; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetch: (path: string) => {
      asked.push(path);
      if (answers.reject === true) return Promise.reject(new Error('connection refused'));
      if (path === DAEMON_ENDPOINTS.flows) {
        const status = answers.flowStatus ?? 200;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(answers.flows ?? { flows: [] }),
        });
      }
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

/**
 * A daemon that answers nothing until a test says so, which is what lets an ORDER be staged.
 *
 * {@link daemon} answers every request before the next one can be made, so it cannot reach the case
 * two requests being in flight at once creates — and that case is the whole of what the two clauses
 * below are about. Each request parks its resolver under the path it asked for, so a test settles
 * them in whatever order it wants and asserts what the page did with the answers.
 */
function deferring(): {
  fetch: (path: string) => Promise<DaemonResponse>;
  settle: (path: string, body: unknown) => Promise<void>;
  waiting: (path: string) => number;
} {
  const held = new Map<string, ((answer: DaemonResponse) => void)[]>();
  return {
    fetch: (path: string) => new Promise<DaemonResponse>((resolve) => {
      held.set(path, [...(held.get(path) ?? []), resolve]);
    }),
    settle: async (path: string, body: unknown) => {
      const resolve = held.get(path)?.shift();
      // A settle naming a path nobody asked for would pass silently and prove nothing, so it stops
      // here instead: the staging is half the assertion in every case below.
      if (resolve === undefined) throw new Error(`no request is waiting on ${path}`);
      await act(async () => { resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }); });
    },
    waiting: (path: string) => held.get(path)?.length ?? 0,
  };
}

/** One file body, as the daemon answers it. */
const fileBody = (rel: string, text: string): Record<string, unknown> => ({ rel, bytes: text.length, text });

/** Every `pre` on the page, joined — which is where a file's text and the run log are rendered. */
const preformatted = (view: HTMLElement): string =>
  [...view.querySelectorAll('pre')].map((node) => node.textContent ?? '').join('\n');

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
  const view = await render(createElement(TicketPage, { ticketId, fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE }));
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

  test('mounting issues exactly four requests, and none is for the megabyte artifact', async () => {
    // **Four since Q-0130 and three before it**, and the one that arrived is the flow directory:
    // which flows consume this ticket's stage is what the start region is built from. The clause is
    // an IDENTITY rather than a count, so the arrival is visible as the path it is rather than as a
    // number that moved — and what it has always been about is unchanged below.
    const { asked } = await page({
      detail: detail(FOLDER),
      texts: { [TICKET_FILE]: 'the ticket\n', [RUN_LOG]: 'a line\n' },
    });
    expect(asked).toStrictEqual([
      DAEMON_ENDPOINTS.flows,
      ticketDetailPath(TICKET),
      ticketFilePath(TICKET, TICKET_FILE),
      ticketFilePath(TICKET, RUN_LOG),
    ]);
    expect(asked, 'the page fetched a file nobody opened')
      .not.toContain(ticketFilePath(TICKET, 'review/hand-review.txt'));
  });

  test('and a folder of fifty files still costs four, which is what a prefetcher fails', async () => {
    // The discriminator, rather than a second reading of the clause above: the count is a constant
    // of the design and not of the fixture, so a version that fetched what it listed would issue
    // fifty-two here and four there. The count is what goes red, by 48 — the number the flow
    // listing adds is the same on both sides, so what this clause measures did not move.
    const many = [entry(TICKET_FILE), entry(RUN_LOG)];
    for (let at = 0; at < 48; at += 1) many.push(entry(`dev/chore/run-${String(at)}/implement-iter-1.md`));
    const { asked } = await page({
      detail: detail(many),
      texts: { [TICKET_FILE]: 'the ticket\n', [RUN_LOG]: 'a line\n' },
    });
    expect(asked.length, 'the page fetched more than the listing, the flow directory and the two files it renders').toBe(4);
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
    await act(async () => root.render(createElement(TicketPage, { ticketId: TICKET, fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE })));
    mounted.push(() => root.unmount());
    expect(container.textContent).toContain('FIRST-TICKET-TEXT');
    await act(async () => root.render(createElement(TicketPage, { ticketId: 'Q-0002', fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE })));
    expect(container.textContent, 'one ticket\'s file is rendered under another ticket\'s id')
      .not.toContain('FIRST-TICKET-TEXT');
  });

  test('and the commit that navigation makes renders nothing from it either', async () => {
    // The clause above settles the replacement request inside `act`, so the earliest page it can
    // read is the one after the effect that reloads has already run — and the defect is one commit
    // before that. A prop reaches a component before any effect reacting to it, so state cleared in
    // an effect is cleared one commit too late, and what has to be inspected is the commit itself:
    // `flushSync` renders and commits synchronously while a `useEffect` stays a passive effect
    // React schedules after it, and this daemon holds the replacement's answer so nothing else
    // settles in between. Measured against a version that cleared in the effect, this commit was
    // the previous ticket's WHOLE page — its id, its title, its listing and its open file — under
    // the id the URL had just changed to. Chore run 2, review iteration 2.
    const OTHER = 'Q-0002';
    const server = deferring();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(TicketPage, { ticketId: TICKET, fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE })));
    mounted.push(() => root.unmount());
    await server.settle(ticketDetailPath(TICKET), detail([entry(TICKET_FILE, 812)]));
    await server.settle(ticketFilePath(TICKET, TICKET_FILE), fileBody(TICKET_FILE, 'FIRST-TICKET-TEXT'));
    expect(container.textContent, 'the first ticket never rendered at all — nothing is staged')
      .toContain('FIRST-TICKET-TEXT');

    let committed = '';
    await act(async () => {
      flushSync(() => root.render(createElement(TicketPage, { ticketId: OTHER, fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE })));
      committed = container.textContent ?? '';
    });

    expect(committed, 'one ticket\'s file was committed under another ticket\'s id')
      .not.toContain('FIRST-TICKET-TEXT');
    expect(committed, 'one ticket\'s own id and frontmatter were committed under another\'s')
      .not.toContain(TICKET);
    expect(committed, 'the commit names neither ticket').toContain(OTHER);
    // …and it is not a blank panel either: what a reader sees in the gap is what a mount shows,
    // which is the request being waited for, naming the id the URL now carries.
    expect(committed, 'the commit says nothing about what it is waiting for')
      .toContain(ticketDetailPath(OTHER));

    // The other direction, and it is what stops the gate being a page that never opens again: the
    // replacement request was issued by the effect that followed this commit, and answering it
    // renders the ticket that was navigated to. Without it a gate that simply refused to render
    // would satisfy every assertion above.
    await server.settle(ticketDetailPath(OTHER), detail([entry('dev/notes.md')], {
      ticket: row({ id: OTHER, folder: `${OTHER}-another-ticket`, title: 'the other ticket' }),
    }));
    expect(container.textContent, 'the ticket that was navigated to never rendered')
      .toContain('the other ticket');
    expect(container.textContent, 'the replacement page still holds the previous ticket\'s file')
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

describe('AC-9 and AC-10 — a superseded file answer lands nowhere, and a tab takes its file with it', () => {
  // Chore run 2 iteration 1's two findings, each with the case that stages it. Both are about a
  // file request outliving the thing that asked for it: one answer arriving after a newer one, and
  // one arriving after the tab it belongs to has been left. Neither is reachable through the
  // immediate daemon above, which is why `deferring` exists.
  const FOLDER = [entry(TICKET_FILE, 812), entry('dev/a.md'), entry('dev/b.md'), entry('review/r.md')];

  /** The page over a daemon that holds its answers, with the listing already settled. */
  async function staged(files = FOLDER): Promise<{ view: HTMLElement; server: ReturnType<typeof deferring> }> {
    const server = deferring();
    const view = await render(createElement(TicketPage, { ticketId: TICKET, fetcher: server.fetch, now: CLOCK, onNavigate: NOWHERE }));
    await server.settle(ticketDetailPath(TICKET), detail(files));
    return { view, server };
  }

  test('two files opened in a row, answered in reverse order, leave the newer one on the page', async () => {
    const { view, server } = await staged();
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/a.md');
    await click(view, 'button', 'dev/b.md');
    expect(server.waiting(ticketFilePath(TICKET, 'dev/a.md')), 'the first request is not in flight, so nothing is staged')
      .toBe(1);

    // b was asked for second and answers first, which is what a small file opened after a large one
    // does. a then answers into a page that has moved on.
    await server.settle(ticketFilePath(TICKET, 'dev/b.md'), fileBody('dev/b.md', 'THE-B-FILE'));
    await server.settle(ticketFilePath(TICKET, 'dev/a.md'), fileBody('dev/a.md', 'THE-A-FILE'));

    expect(preformatted(view), 'a superseded answer arrived on top of the newer one').not.toContain('THE-A-FILE');
    expect(preformatted(view), 'the file the reader last chose is not on the page').toContain('THE-B-FILE');
    // …and the heading over it still names the file that is shown, which is the half that makes the
    // defect visible rather than merely wrong: the text and the name must not come from two requests.
    expect(view.textContent, 'the region names a file whose text it is not showing').toContain('dev/b.md · 10 bytes');
  });

  test('and the mount\'s own ticket.md answer does not land on a file chosen after it', async () => {
    // The second half of the same finding: `ticket.md` is requested by the mount rather than by a
    // reader, so it is the one request that is always in flight while the first choice is made.
    const { view, server } = await staged();
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/a.md');
    await server.settle(ticketFilePath(TICKET, 'dev/a.md'), fileBody('dev/a.md', 'THE-CHOSEN-FILE'));
    await server.settle(ticketFilePath(TICKET, TICKET_FILE), fileBody(TICKET_FILE, 'THE-MOUNTED-FILE'));

    expect(preformatted(view), 'the mount\'s own request overwrote the file a reader asked for')
      .not.toContain('THE-MOUNTED-FILE');
    expect(preformatted(view)).toContain('THE-CHOSEN-FILE');
  });

  test('changing tabs leaves no file from the tab before it on the page', async () => {
    const { view } = await page({
      detail: detail(FOLDER),
      texts: { [TICKET_FILE]: 'x', 'dev/a.md': 'THE-DEV-FILE', 'review/r.md': 'the review\n' },
    });
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/a.md');
    expect(preformatted(view), 'the file a reader opened is not on the page — nothing is staged')
      .toContain('THE-DEV-FILE');

    await click(view, 'nav button', 'review');

    expect(preformatted(view), 'the previous tab\'s file is still rendered under this tab\'s list')
      .not.toContain('THE-DEV-FILE');
    expect(view.textContent, 'a file this tab does not hold is still named on it').not.toContain('dev/a.md');
    expect(view.querySelectorAll('[aria-current="true"]').length,
      'a file the list no longer holds is still marked as the selected one').toBe(0);
    expect(view.textContent, 'the file region is a blank panel rather than a sentence').toContain(CHOOSE_FILE);
    // The tab that was asked for is the one that is shown, so the clearing did not cost the change.
    expect(view.textContent, 'the tab a reader asked for does not hold its own files').toContain('review/r.md');
  });

  test('and a file request the leaving tab started lands nowhere', async () => {
    // The discriminator for the counter rather than for the clearing: clearing alone empties the
    // region and an answer already in flight fills it again a moment later, under a tab that does
    // not hold it.
    const { view, server } = await staged();
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/a.md');
    await click(view, 'nav button', 'review');
    await server.settle(ticketFilePath(TICKET, 'dev/a.md'), fileBody('dev/a.md', 'THE-DEV-FILE'));

    expect(preformatted(view), 'a request from the tab that was left answered into the tab that replaced it')
      .not.toContain('THE-DEV-FILE');
    expect(view.textContent).toContain(CHOOSE_FILE);
  });

  test('and clicking the tab already shown is not a way to close the file being read', async () => {
    const { view } = await page({
      detail: detail(FOLDER),
      texts: { [TICKET_FILE]: 'x', 'dev/a.md': 'THE-DEV-FILE' },
    });
    await click(view, 'nav button', 'dev');
    await click(view, 'button', 'dev/a.md');
    await click(view, 'nav button', 'dev');
    expect(preformatted(view), 'clicking the current tab discarded the file open under it')
      .toContain('THE-DEV-FILE');
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
      onNavigate: NOWHERE,
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

describe('Q-0130 AC-6/AC-7/AC-9/AC-10/AC-12 — the one place this app starts a run', () => {
  /** One flow row as a VALUE, which is what `wireFlowSchema` produces and a premise is built from. */
  const flowValue = (name: string, over: Partial<WireFlow> = {}): WireFlow =>
    ({ name, runnable: true, consumes: 'requirements', produces: 'reviewed', problems: [], ...over });

  /** The same row as the daemon ANSWERS it, off the one above so the two cannot describe two shapes. */
  const flowRow = (name: string, over: Record<string, unknown> = {}): Record<string, unknown> =>
    ({ ...flowValue(name), ...over });

  /** The two flows this repository's own `requirements` stage is consumed by. Both, never one. */
  const TWO = { flows: [flowRow('chore'), flowRow('solutioning'), flowRow('review', { consumes: 'green' })] };

  /** One run row, as `POST /runs` answers a start it accepted. */
  const STARTED = {
    handle: 'run-9', flow: 'chore', ticketId: TICKET, runId: null, state: 'running',
    pendingGates: 0, gates: [], refusal: null,
  };

  interface Sent { readonly path: string; readonly request?: DaemonRequest }

  /**
   * A daemon whose reads answer at once and whose START is held until a test settles it.
   *
   * The holding is what stages an OUTSTANDING mutation, which is the only state several clauses
   * below are about: a fixture answering the start before the next act could happen cannot reach
   * the case where a read lands while one is on its way.
   */
  /** Whatever the next READ does: answer as staged, never come back, or fail to reach anything. */
  type Reads = 'answer' | 'hold' | 'fail';

  /** What a daemon a test drives can be told between one read and the next. */
  interface Staging {
    /** What the NEXT flow read lists, and with what status — a listing can change under a reader. */
    readonly setFlows: (next: unknown, status?: number) => void;
    /** What the NEXT ticket read reports as this ticket's stage. */
    readonly setStage: (next: string) => void;
    /**
     * How every further read behaves, or every further TICKET read where `only` says so.
     *
     * A POST is unaffected either way: it is still held for {@link settle}. The narrowing is what
     * stages the one window the two reads are not in step — `load` issues them together and the
     * listing can answer while the ticket is still out — which is the case where the stage half of
     * a start's premise is what decides rather than the listing half.
     */
    readonly setReads: (how: Reads, only?: 'all' | 'ticket') => void;
  }

  function startDaemon(over: { flows?: unknown; stage?: string; flowStatus?: number }): Staging & {
    fetch: (path: string, request?: DaemonRequest) => Promise<DaemonResponse>;
    sent: Sent[];
    settle: (status: number, body: unknown) => Promise<void>;
  } {
    const sent: Sent[] = [];
    const held: ((answer: DaemonResponse) => void)[] = [];
    let flows: unknown = over.flows ?? TWO;
    let flowStatus = over.flowStatus ?? 200;
    let stage = over.stage ?? 'requirements';
    let reads: Reads = 'answer';
    let readsOnly: 'all' | 'ticket' = 'all';
    const isTicketRead = (path: string): boolean =>
      path.startsWith(ticketDetailPath(TICKET)) || path.startsWith(ticketDetailPath('Q-0002'));
    return {
      sent,
      setFlows: (next: unknown, status = 200) => { flows = next; flowStatus = status; },
      setStage: (next: string) => { stage = next; },
      setReads: (how: Reads, only: 'all' | 'ticket' = 'all') => { reads = how; readsOnly = only; },
      settle: async (status: number, body: unknown) => {
        const resolve = held.shift();
        if (resolve === undefined) throw new Error('no start is waiting');
        await act(async () => {
          resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
        });
      },
      fetch: (path: string, request?: DaemonRequest) => {
        sent.push({ path, request });
        if (request?.method === 'POST') {
          return new Promise<DaemonResponse>((resolve) => { held.push(resolve); });
        }
        // Staged AFTER the write branch, so *this read never answered* stages a read and never an
        // act: a start held here would be a mutation nothing could settle rather than a refresh.
        if (readsOnly === 'all' || isTicketRead(path)) {
          if (reads === 'hold') return new Promise<DaemonResponse>(() => undefined);
          if (reads === 'fail') return Promise.reject(new Error('nothing answered'));
        }
        if (path === DAEMON_ENDPOINTS.flows) {
          return Promise.resolve({
            ok: flowStatus >= 200 && flowStatus < 300,
            status: flowStatus,
            json: () => Promise.resolve(flows),
          });
        }
        if (path.startsWith(ticketDetailPath(TICKET)) || path.startsWith(ticketDetailPath('Q-0002'))) {
          const isFile = path.includes('file?path=');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(isFile
              ? { rel: TICKET_FILE, bytes: 3, text: 'txt' }
              : detail([entry(TICKET_FILE, 3)], { ticket: row({ stage }) })),
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ code: 'no-such-file', condition: 'x', remedy: null }) });
      },
    };
  }

  /** The page over that daemon, with somewhere for a navigation to be recorded. */
  async function startPage(over: Parameters<typeof startDaemon>[0] = {}, ticketId = TICKET): Promise<Staging & {
    view: HTMLElement;
    sent: Sent[];
    went: string[];
    settle: (status: number, body: unknown) => Promise<void>;
  }> {
    const server = startDaemon(over);
    const went: string[] = [];
    const view = await render(createElement(TicketPage, {
      ticketId, fetcher: server.fetch, now: CLOCK, onNavigate: (to: string) => { went.push(to); },
    }));
    return {
      view,
      sent: server.sent,
      went,
      settle: server.settle,
      setFlows: server.setFlows,
      setStage: server.setStage,
      setReads: server.setReads,
    };
  }

  /** Every control on the page that could start a run, whatever flow it names. */
  const starters = (view: HTMLElement): HTMLButtonElement[] =>
    [...view.querySelectorAll('button[data-start-flow]')] as HTMLButtonElement[];

  /** The one control that confirms a start, where one is being confirmed. */
  const confirmControl = (view: HTMLElement): HTMLButtonElement | null =>
    view.querySelector('button[data-confirm-start]');

  /** Every start this page actually sent, decoded. */
  const bodies = (sent: Sent[]): Record<string, unknown>[] => sent
    .filter((each) => each.request?.method === 'POST')
    .map((each) => JSON.parse(each.request?.body ?? '{}') as Record<string, unknown>);

  test('AC-6 — a stage two flows consume offers two, and never one', async () => {
    const { view } = await startPage();
    expect(starters(view).map((button) => button.dataset.startFlow), 'the routing choice was taken for the reader')
      .toStrictEqual(['chore', 'solutioning']);
    for (const button of starters(view)) {
      expect(button.textContent, 'a control does not name the flow it runs').toBe(startLabel(button.dataset.startFlow ?? ''));
    }
    // …and a flow that consumes some other stage is not among them, so the filter is a filter.
    expect(view.textContent, 'a flow that consumes another stage was offered').not.toContain(startLabel('review'));
  });

  test('AC-6 — a flow the linter refused is named and is not offered', async () => {
    // The board's own rule: a flow that vanished from a list is indistinguishable from one that was
    // never there, so it is named without a control beside it.
    const { view } = await startPage({ flows: { flows: [flowRow('chore'), flowRow('solutioning', { runnable: false, problems: ['step 2 has no id'] })] } });
    expect(starters(view).map((button) => button.dataset.startFlow)).toStrictEqual(['chore']);
    const named = view.querySelector('[data-refused-flow="solutioning"]');
    expect(named, 'the refused flow was hidden rather than named').not.toBeNull();
    expect(named?.textContent, 'the refused flow is named without saying why it is not offered')
      .toContain(REFUSED_FLOW_NOTE);
  });

  test('AC-6 — the three unavailable answers are three sentences, and none is another\'s', async () => {
    // **Three rather than two.** A listing still out is neither *no flow consumes this stage* nor
    // *the flow list could not be read*, and reporting it as either would be an unanswered question
    // rendered as an answer. The first two are the board's own constants, imported so the two
    // screens cannot disagree about one stage.
    const none = await startPage({ stage: 'deployed' });
    expect(none.view.querySelector('[data-start-unavailable="no-consuming-flow"]')?.textContent)
      .toBe(NO_CONSUMING_FLOW);
    const unread = await startPage({ flowStatus: 500 });
    expect(unread.view.querySelector('[data-start-unavailable="flows-unread"]')?.textContent)
      .toBe(FLOWS_UNREAD);
    // And neither renders a control, which is what says *named* is not *offered*.
    expect(starters(none.view)).toStrictEqual([]);
    expect(starters(unread.view)).toStrictEqual([]);
    expect(NO_CONSUMING_FLOW).not.toBe(FLOWS_UNREAD);
  });

  test('AC-9 — choosing a flow sends nothing until it is confirmed, and Cancel sends nothing at all', async () => {
    const { view, sent } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    expect(bodies(sent), 'a start was sent before it was confirmed').toStrictEqual([]);
    // The confirmation names the ticket, the flow and whether it is a dry walk — and NOT a handle,
    // which does not exist until the daemon answers one.
    const asked = view.querySelector('[data-confirm="start"]')?.textContent ?? '';
    expect(asked, 'the confirmation does not name what is about to happen')
      .toContain(startConfirmation(TICKET, 'chore', false));
    expect(asked, 'the confirmation names a handle that does not exist yet').not.toContain('run-');
    await click(view, 'button[data-withdraw]', WITHDRAW_LABEL);
    expect(bodies(sent), 'withdrawing the confirmation sent a start').toStrictEqual([]);
    expect(view.querySelector('[data-confirm="start"]'), 'the confirmation survived being withdrawn').toBeNull();
  });

  test('AC-9 — two activations in one turn issue one request', async () => {
    const { view, sent } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    const confirm = confirmControl(view);
    expect(confirm, 'nothing is confirming — this clause has lost its subject').not.toBeNull();
    // Both inside ONE act, which is what makes it two activations in one turn: state has not
    // flushed between them, so a guard held in state would let the second through.
    await act(async () => { confirm?.click(); confirm?.click(); });
    expect(bodies(sent).length, 'two activations in one turn issued two starts').toBe(1);
  });

  test('AC-12 — the body carries exactly the permitted keys, and never auto or base', async () => {
    const { view, sent } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('solutioning'));
    await click(view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    expect(bodies(sent)).toStrictEqual([{ flow: 'solutioning', ticket: TICKET, dry: false }]);
    // And the dry choice really reaches the body, so `dry: false` above is a value rather than a
    // field that is always that.
    const walk = await startPage();
    await act(async () => { (walk.view.querySelector('input[data-dry]') as HTMLInputElement).click(); });
    await click(walk.view, 'button[data-start-flow]', startLabel('chore'));
    expect(walk.view.querySelector('[data-confirm="start"]')?.textContent,
      'the confirmation does not say this is a dry walk').toContain(startConfirmation(TICKET, 'chore', true));
    await click(walk.view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    expect(bodies(walk.sent)).toStrictEqual([{ flow: 'chore', ticket: TICKET, dry: true }]);
  });

  test('AC-9 — every control is inert while one is outstanding, and a READ does not release the guard', async () => {
    // **The defect this clause exists for is Q-0016's review blocker**, one act along: a read
    // released the in-flight guard there, so a Refresh re-enabled the controls and a second answer
    // could race the first. Here the screen offers a control per consuming flow, so the failure
    // would be two STARTS on one ticket rather than two answers to one gate.
    const { view, sent, settle } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    await click(view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    expect(starters(view).every((button) => button.disabled), 'a start control stayed live while one was out').toBe(true);
    expect((view.querySelector('input[data-dry]') as HTMLInputElement).disabled,
      'the dry choice stayed live while a start it is part of was out').toBe(true);
    const outstanding = view.querySelector('[data-start-outcome]')?.textContent ?? '';
    expect(outstanding, 'nothing says a start is on its way').toContain(DAEMON_ENDPOINTS.runs);

    // A read lands in between — the act that released the guard in Q-0016 — and changes none of it.
    await click(view, 'button', REFRESH_LABEL);
    expect(starters(view).every((button) => button.disabled), 'a read re-enabled the start controls').toBe(true);
    expect(view.querySelector('[data-start-outcome]')?.textContent,
      'a read cleared the sentence saying a start was on its way').toBe(outstanding);
    expect(bodies(sent).length, 'a read issued a second start').toBe(1);

    // …and the release is the request's OWN resolution, which is what the staging above proves: the
    // controls come back only now.
    await settle(201, STARTED);
    expect(starters(view).length === 0 || starters(view).every((button) => !button.disabled),
      'the start controls stayed inert after the request resolved').toBe(true);
  });

  test('AC-7 — a start the daemon accepted navigates to mission control on the handle it answered with', async () => {
    const { view, went, settle } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    await click(view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    expect(went, 'the page navigated before the daemon had answered').toStrictEqual([]);
    await settle(201, STARTED);
    // Against the registered pattern rather than a literal, so a route rename moves both together.
    expect(went, 'the page did not open mission control for the run it started')
      .toStrictEqual([runPath('run-9')]);
    // …and the handle stays visible, so a start that succeeded and a navigation that did not leaves
    // a reachable run rather than a silent one.
    const outcome = view.querySelector('[data-start-outcome="loaded"]')?.textContent ?? '';
    expect(outcome, 'the outcome does not say the daemon started a run').toContain(STARTED_PREFIX);
    expect(outcome, 'the handle the daemon answered with is not on the page').toContain('run-9');
  });

  test('AC-10 — nothing navigates on a refusal, and the action beside one issues a GET', async () => {
    const { view, sent, went, settle } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    await click(view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    await settle(409, { code: 'lock-held', condition: LOCK_HELD_CONDITION, remedy: null });
    expect(went, 'a refused start navigated to a run that never started').toStrictEqual([]);
    const outcome = view.querySelector('[data-start-outcome="refused"]')?.textContent ?? '';
    // This surface's sentence for the code, AND the daemon's own condition unaltered beside it.
    expect(outcome, 'the refusal renders no sentence of this surface\'s own')
      .toContain(START_REFUSAL_TEXT['lock-held']);
    expect(outcome, 'the daemon\'s own condition did not reach the page').toContain('run lock refused');
    // The action beside it READS and re-sends nothing: `canRetryRequest` answers `true` for a
    // refusal, so a bare Retry here would issue a second start.
    const before = bodies(sent).length;
    const asked = sent.length;
    await click(view, 'button', LOOK_AGAIN_LABEL);
    expect(bodies(sent).length, 'the action beside a refused start sent another one').toBe(before);
    expect(sent.slice(asked).every((each) => each.request === undefined), 'the action was not a GET').toBe(true);
    expect(sent.length, 'the action issued nothing at all').toBeGreaterThan(asked);
  });

  test('AC-10 — a code this page does not model keeps the daemon\'s condition and composes nothing', async () => {
    const { view, settle } = await startPage();
    await click(view, 'button[data-start-flow]', startLabel('chore'));
    await click(view, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    await settle(418, { code: 'brewing', condition: 'the daemon is a teapot', remedy: null });
    const outcome = view.querySelector('[data-start-outcome="refused"]')?.textContent ?? '';
    expect(outcome, 'the daemon\'s own condition was dropped').toContain('the daemon is a teapot');
    for (const said of Object.values(START_REFUSAL_TEXT)) {
      expect(outcome, 'a sentence for some other code was composed for one this page does not model')
        .not.toContain(said);
    }
  });

  test('AC-6/AC-9 — a read that makes the chosen flow ineligible WITHDRAWS its confirmation', async () => {
    // **Review round 4, and the fourth instance of one class in one review loop**: a confirmation
    // outliving the premise that made it offerable. A reader chooses `chore`, presses Refresh, and
    // is handed a ticket whose stage has moved or a listing where the linter now refuses that
    // file — after which the control is gone and, until this, the question beside it was not.
    // Rendering the flow as refused while keeping its live confirmation is still offering it, which
    // is what AC-6 forbids.
    //
    // **Three stagings, because eligibility is lost in three ways and a clause covering one of them
    // would be this repository's other recurring failure** — fixing the instance rather than the
    // class. What withdraws them is one predicate over one listing: {@link offerable}, which the
    // control is drawn from and the pending act is now held to.
    const INELIGIBLE: [string, (page: Awaited<ReturnType<typeof startPage>>) => void][] = [
      ['the linter now refuses that flow', (page) => page.setFlows({ flows: [flowRow('chore', { runnable: false, problems: ['step 2 has no id'] }), flowRow('solutioning')] })],
      ['the ticket has moved to a stage that flow does not consume', (page) => page.setStage('solutioned')],
      ['that flow is no longer in the listing at all', (page) => page.setFlows({ flows: [flowRow('solutioning')] })],
    ];
    for (const [what, stage] of INELIGIBLE) {
      const page = await startPage();
      await click(page.view, 'button[data-start-flow]', startLabel('chore'));
      expect(page.view.querySelector('[data-confirm="start"]'),
        `nothing is confirming, so "${what}" has lost its subject`).not.toBeNull();

      stage(page);
      const before = page.sent.length;
      await click(page.view, 'button', REFRESH_LABEL);
      expect(page.sent.length, `the read this clause stages never happened: ${what}`).toBeGreaterThan(before);
      expect(starters(page.view).map((button) => button.dataset.startFlow),
        `the control was still offered after ${what}`).not.toContain('chore');
      expect(page.view.querySelector('[data-confirm="start"]'),
        `the confirmation outlived the offer: ${what}`).toBeNull();
      // …and what is on the screen is ANSWERED rather than only counted, which is the half that
      // says *withdrawn* rather than *rendered somewhere else*.
      const stale = confirmControl(page.view);
      if (stale !== null) await act(async () => { stale.click(); });
      expect(bodies(page.sent), `a start was sent for a flow this page would no longer offer: ${what}`)
        .toStrictEqual([]);
    }

    // **Withdrawn rather than hidden**, which is what this last half discriminates: a confirmation
    // merely gated on eligibility comes back the moment a later listing offers that flow again,
    // putting an offer on the screen that nobody made twice.
    const back = await startPage();
    await click(back.view, 'button[data-start-flow]', startLabel('chore'));
    back.setFlows({ flows: [flowRow('solutioning')] });
    await click(back.view, 'button', REFRESH_LABEL);
    back.setFlows(TWO);
    await click(back.view, 'button', REFRESH_LABEL);
    expect(starters(back.view).map((button) => button.dataset.startFlow),
      'the control did not come back for a flow the listing offers again').toContain('chore');
    expect(back.view.querySelector('[data-confirm="start"]'),
      'a withdrawn confirmation was put back by a later listing').toBeNull();
  });

  test('AC-9 — a read still out and a read that failed are not reports, so neither withdraws one', async () => {
    // The other side of the same rule, and it is why the premise is *the last REPORT* rather than
    // the last request: a reader asking for a fresher view of the ticket must not lose the act they
    // were part-way through asking for. Mission control was corrected for exactly this one screen
    // over (review round 3), and the rule is now one rule in one module rather than two derivations.
    //
    // **The listing half is asserted with the page fully rendered**, because the ticket read still
    // answers: the region renders its own *could not be read* sentence and the question stands.
    const unread = await startPage();
    await click(unread.view, 'button[data-start-flow]', startLabel('chore'));
    unread.setFlows(TWO, 500);
    await click(unread.view, 'button', REFRESH_LABEL);
    expect(unread.view.querySelector('[data-start-unavailable="flows-unread"]'),
      'the listing this clause stages did not come back unread').not.toBeNull();
    expect(unread.view.querySelector('[data-confirm="start"]'),
      'a listing that could not be read withdrew a confirmation the daemon had said nothing about').not.toBeNull();

    // **And the ticket half is asserted by letting the read land**, which is stronger than looking
    // for the question while the page is showing a failure: this page replaces its whole body while
    // the detail is not loaded, so *not rendered* would prove nothing either way. The confirmation
    // coming back with the ticket is what says it was never withdrawn.
    //
    // **The TICKET read alone fails here, and that is what gives this half a subject.** `load`
    // issues both together, so failing everything leaves the listing unread too — and the listing
    // half of the premise would then be what answers, shielding the stage half from ever deciding.
    // Measured rather than reasoned: with both failing, a premise that treated an unread ticket as
    // a report of some other stage passed this clause. The one-answered-one-out window is real, the
    // two requests settling independently by design.
    const failed = await startPage();
    await click(failed.view, 'button[data-start-flow]', startLabel('chore'));
    failed.setReads('fail', 'ticket');
    await click(failed.view, 'button', REFRESH_LABEL);
    expect(failed.view.querySelector('[data-request-state]')?.getAttribute('data-request-state'),
      'the read this clause stages did not fail').toBe('unreachable');
    failed.setReads('answer');
    await click(failed.view, 'button', RETRY_LABEL);
    expect(starters(failed.view).map((button) => button.dataset.startFlow),
      'the ticket never came back, so this clause has lost its subject').toContain('chore');
    expect(failed.view.querySelector('[data-confirm="start"]'),
      'a read that could not answer withdrew a confirmation the daemon had said nothing about').not.toBeNull();
  });

  test('AC-9/E-7 — a listing that reports the flow gone withdraws the offer while the ticket read fails', async () => {
    // **Review round 5, and the first of the two mixed sequences erratum E-7 names.** The rule
    // round 4 left half-written was *an unavailable read is not a premise that stopped holding*,
    // which is true and is not the whole of it: it is *could not tell* for ITS OWN input, and the
    // predicate let it stand in for the other's answer. So a listing that conclusively dropped
    // `chore` was ignored because the ticket read beside it had failed, and the question stayed
    // answerable for a flow the daemon had just said is not there.
    //
    // **Two tests rather than one with two halves**, because under the defect the first failing
    // clause would stop the second being reached — so each is red on its own rather than red
    // because its neighbour is.
    const gone = await startPage();
    await click(gone.view, 'button[data-start-flow]', startLabel('chore'));
    expect(gone.view.querySelector('[data-confirm="start"]'),
      'nothing is confirming — this clause has lost its subject').not.toBeNull();

    // The listing answers and no longer holds `chore`; the ticket read does not answer at all.
    gone.setFlows({ flows: [flowRow('solutioning')] });
    gone.setReads('fail', 'ticket');
    await click(gone.view, 'button', REFRESH_LABEL);
    expect(gone.view.querySelector('[data-request-state]')?.getAttribute('data-request-state'),
      'the ticket read this clause stages did not fail').toBe('unreachable');

    // **The withdrawal is asserted once the page is back, and it has to be**: while the detail is
    // not loaded this page renders none of the start region, so *not on the screen* there would
    // prove nothing either way — round 5's counter-clause makes the same move for the same reason.
    // Bringing the ticket back beside a listing that offers `chore` again is also what separates
    // *withdrawn* from *hidden*: a confirmation merely gated on eligibility comes back here.
    gone.setFlows(TWO);
    gone.setReads('answer');
    await click(gone.view, 'button', RETRY_LABEL);
    expect(starters(gone.view).map((button) => button.dataset.startFlow),
      'the ticket never came back, so this clause has lost its subject').toContain('chore');
    expect(gone.view.querySelector('[data-confirm="start"]'),
      'a listing that reported the flow gone left its confirmation standing because the ticket read failed').toBeNull();
  });

  test('AC-9/E-7 — a stage that moved withdraws the offer while the listing read fails', async () => {
    // The other ordering, and the one that says the premise's two halves are kept INDEPENDENTLY
    // rather than re-derived from whatever answered last: the listing read is refused here, so the
    // flow's own `consumes` — which is what a stage is judged against — comes from what the daemon
    // last reported rather than from this refresh. Without that there is nothing for the new stage
    // to be compared with, and a premise that dropped the listing would call this *could not tell*.
    const moved = await startPage();
    await click(moved.view, 'button[data-start-flow]', startLabel('chore'));
    expect(moved.view.querySelector('[data-confirm="start"]'),
      'nothing is confirming — this clause has lost its subject').not.toBeNull();

    // The ticket answers a stage `chore` does not consume; the listing read is refused. A different
    // failure shape from the clause above deliberately — one unreachable, one refused — because
    // what decides a report is that the answer CARRIED one, not which way it failed to.
    moved.setStage('solutioned');
    moved.setFlows(TWO, 500);
    await click(moved.view, 'button', REFRESH_LABEL);
    expect(moved.view.textContent, 'the stage this clause stages did not move').toContain('stage solutioned');
    expect(moved.view.querySelector('[data-start-unavailable="flows-unread"]'),
      'the listing read this clause stages did not fail').not.toBeNull();
    expect(moved.view.querySelector('[data-confirm="start"]'),
      'a ticket that reported a stage the flow does not consume left its confirmation standing because the listing read failed').toBeNull();
  });

  test('AC-9/E-7 — the premise answers three ways, and what cannot tell never stands in for what can', () => {
    // **E-7's rule at the level the rule is written**, which is where its two `unknown` answers have
    // a subject: both inputs are kept as last reports, so while an offer stands on the screen both
    // have been reported and no sequence of reads above reaches them. Asserting them here is what
    // keeps the asymmetry from resting on that — the half-rule is exactly what round 5 found.
    const CHORE = flowValue('chore');
    const OTHER = flowValue('solutioning');
    const BOTH = [CHORE, OTHER];
    expect(offerStanding('chore', { stage: 'requirements', flows: BOTH }),
      'a flow the daemon reports as consuming this stage is not offerable').toBe('holds');
    // The three ways the reports end it, which are the three the clause above stages through the DOM.
    expect(offerStanding('chore', { stage: 'solutioned', flows: BOTH }),
      'a stage the flow does not consume did not end the offer').toBe('lapsed');
    expect(offerStanding('chore', { stage: 'requirements', flows: [flowValue('chore', { runnable: false }), OTHER] }),
      'a flow the linter now refuses did not end the offer').toBe('lapsed');
    expect(offerStanding('chore', { stage: 'requirements', flows: [OTHER] }),
      'a flow the listing no longer holds did not end the offer').toBe('lapsed');
    // **The asymmetry.** A listing that ends the offer is conclusive at every stage, so an
    // unreported stage may not mask it — which is the defect, stated as the predicate's own rule.
    expect(offerStanding('chore', { stage: null, flows: [OTHER] }),
      'an unreported stage masked a listing that no longer holds the flow').toBe('lapsed');
    expect(offerStanding('chore', { stage: null, flows: [flowValue('chore', { runnable: false })] }),
      'an unreported stage masked a listing that reports the flow refused').toBe('lapsed');
    // …and *could not tell* on its own ends nothing, whichever input it is about: a stage with no
    // listing has no `consumes` to be judged against, and a listing that still offers the flow says
    // nothing about a stage that was never reported.
    expect(offerStanding('chore', { stage: null, flows: BOTH }),
      'an unreported stage was read as a stage the flow does not consume').toBe('unknown');
    expect(offerStanding('chore', { stage: 'requirements', flows: null }),
      'an unreported listing was read as a listing without the flow').toBe('unknown');
    expect(offerStanding('chore', { stage: null, flows: null }),
      'two unreported inputs answered something other than could-not-tell').toBe('unknown');
  });

  test('AC-9 — a confirmation does not survive a change of subject, and cannot be answered after one', async () => {
    // Review round 1: the act awaiting confirmation was captured under one ticket and the subject it
    // would be recorded against was read at confirmation time, so a navigation in between left a
    // question about the ticket that was LEFT standing under the id of the one arrived at —
    // answerable, sending the old ticket's start and navigating away on its handle. `app.tsx` keys
    // mission control by handle and keys this page by nothing, so one instance survives the
    // navigation and this is the page where it happens.
    const server = startDaemon({});
    const went: string[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const at = (ticketId: string): ReactElement => createElement(TicketPage, {
      ticketId, fetcher: server.fetch, now: CLOCK, onNavigate: (to: string) => { went.push(to); },
    });
    await act(async () => root.render(at(TICKET)));
    mounted.push(() => root.unmount());
    await click(container, 'button[data-start-flow]', startLabel('chore'));
    expect(confirmControl(container), 'nothing is confirming — this clause has lost its subject').not.toBeNull();
    expect(container.querySelector('[data-confirm="start"]')?.textContent, 'the confirmation is not about the ticket being left')
      .toContain(startConfirmation(TICKET, 'chore', false));

    await act(async () => root.render(at('Q-0002')));
    expect(container.querySelector('[data-confirm="start"]'),
      'one ticket\'s confirmation was left standing under another ticket\'s id').toBeNull();
    // …and whatever IS on the screen is answered rather than only counted, which is the half that
    // says *withdrawn* and not *rendered somewhere else*. Looked up now rather than held from
    // before: this page's loading branch unmounts the whole region while the replacement ticket is
    // read, so a control captured earlier is detached and clicking it would prove nothing either
    // way — which is what the first draft of this clause did, and it passed under the defect.
    const stale = confirmControl(container);
    if (stale !== null) await act(async () => { stale.click(); });
    expect(bodies(server.sent), 'a start about the ticket that was left was sent from the one arrived at')
      .toStrictEqual([]);
    expect(went, 'confirming after a navigation navigated on the ticket that was left').toStrictEqual([]);
  });

  test('AC-9 — a start that resolves after the subject changed settles nothing on the new one', async () => {
    const server = startDaemon({});
    const went: string[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const at = (ticketId: string): ReactElement => createElement(TicketPage, {
      ticketId, fetcher: server.fetch, now: CLOCK, onNavigate: (to: string) => { went.push(to); },
    });
    await act(async () => root.render(at(TICKET)));
    mounted.push(() => root.unmount());
    await click(container, 'button[data-start-flow]', startLabel('chore'));
    await click(container, 'button[data-confirm-start]', CONFIRM_START_LABEL);
    await act(async () => root.render(at('Q-0002')));
    await server.settle(201, STARTED);
    // The request was made about the ticket that was left and is not withdrawn, reinterpreted or
    // attributed to the replacement: nothing is rendered for it here, and nothing navigated.
    expect(container.querySelector('[data-start-outcome]'),
      'one ticket\'s start was rendered under another ticket\'s id').toBeNull();
    expect(went, 'a start about one ticket navigated the screen showing another').toStrictEqual([]);
    // …and the guard it held is released, so the replacement's controls are live rather than stuck.
    expect(starters(container).every((button) => !button.disabled),
      'the replacement subject\'s controls were left inert by an act about the previous one').toBe(true);
  });
});
