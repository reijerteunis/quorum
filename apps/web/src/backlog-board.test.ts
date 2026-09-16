// @vitest-environment jsdom
/**
 * Q-0017 AC-5 to AC-14 — what the board draws, over a daemon this file answers for.
 *
 * THE DOM COMES FROM THE DOCBLOCK ABOVE AND FROM NOWHERE ELSE, and the file is `.test.ts` rather
 * than `.test.tsx` — both for the reasons `shell.test.ts`'s header gives: `apps/web/vitest.config.js`
 * is pinned byte for byte by the discovery guard, and `testFilesIn` matches a `.test.ts` suffix
 * only, so a `.tsx` suite would run while being invisible to that guard and hashed by no turbo
 * input.
 *
 * It sits under `src/` because it reaches for nothing a browser does not have: a document, React,
 * and the app's own modules. Every request is injected, so nothing here opens a socket.
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BacklogBoard, COST_LEGEND, NOT_SET, REFRESH_LABEL, RETRY_LABEL, UNPLACEABLE_HEADING, UNREADABLE_FLOWS_HEADING } from './backlog-board.js';
import type { DaemonResponse } from './daemon-client.js';
import { DAEMON_ENDPOINTS } from './daemon-endpoints.js';
import { resolve } from './router.js';
import { BOARD_PATH, ticketPath } from './routes.js';

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

/**
 * Words and phrases the board may not render, assembled rather than written.
 *
 * `test/source.test.ts` scans every file under `src` for exactly these, and this file is one of
 * them — written out, the assertions below would be the violation the scan is looking for, and the
 * scan would be red over the test that proves the screen is clean. Every other needle in this
 * package is assembled for the same reason; it is one rule rather than a judgement per site.
 */
const CONTAINMENT_SYNONYMS = ['merg', 'land', 'shipp'].map((stem) => `${stem}ed`);
const COST_TO_DATE = `cost to ${'date'}`;
const TOKEN_COUNT = `${'token'}s`;

/** One ticket row, with everything a card can carry defaulted to the quiet answer. */
const ticket = (over: Record<string, unknown> = {}): Record<string, unknown> => {
  const row = {
    id: 'Q-0001', title: 'a ticket', stage: 'draft', owner: 'ruud',
    branch: 'harness/Q-0001/integration', containment: null, iterations: {}, billedCostUsd: null,
    ...over,
  };
  // The folder follows the id unless a fixture names one, so rows are distinct without every call
  // having to say so — and a fixture about a damaged ticket, whose id is what it lacks, says so.
  return { folder: `${String(row.id)}-folder`, ...row };
};

/** One flow row, likewise. */
const flow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'chore', runnable: true, consumes: 'requirements', produces: 'reviewed', problems: [], ...over,
});

interface Answers {
  readonly tickets?: unknown;
  readonly flows?: unknown;
  readonly status?: number;
  readonly reject?: boolean;
}

/** A fetch that answers each registered path from `answers`, counting what it was asked for. */
function daemon(answers: Answers): { fetch: (path: string) => Promise<DaemonResponse>; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetch: (path: string) => {
      asked.push(path);
      if (answers.reject === true) return Promise.reject(new Error('connection refused'));
      const body = path === DAEMON_ENDPOINTS.tickets
        ? answers.tickets ?? { tickets: [], pushLag: null, baseBranch: 'main' }
        : answers.flows ?? { flows: [] };
      const status = answers.status ?? 200;
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
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

/** The board over one set of answers, already settled. */
const board = async (answers: Answers, navigate: (to: string) => void = () => undefined): Promise<HTMLElement> =>
  render(createElement(BacklogBoard, { fetcher: daemon(answers).fetch, now: CLOCK, onNavigate: navigate }));

/**
 * Run `body` with `console.error` captured, and answer every line it wrote.
 *
 * React reports a duplicate key there and nowhere else — it is a complaint rather than a thrown
 * error, so a suite that does not watch for it cannot see one.
 */
async function whileWatchingConsole(body: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const watched = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(' '));
  });
  try {
    await body();
  } finally {
    watched.mockRestore();
  }
  return lines;
}

/** Whether one captured line is React complaining that two children share a key. */
const isKeyComplaint = (line: string): boolean => /same key|unique "?key/i.test(line);

/** Every column heading the board rendered, in order. */
const columns = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('section[aria-label]')].map((node) => node.getAttribute('aria-label') ?? '');

/**
 * Which registered route `path` resolves to, or `null` where the shell does not recognise it.
 *
 * The pattern rather than the path, because that is what says WHICH screen a link reaches — the one
 * thing a card asserting "this navigates to a ticket" is actually claiming.
 */
const routeOf = (path: string): string | null => {
  const resolved = resolve(path);
  return resolved.kind === 'screen' ? resolved.route.path : null;
};

/** The pattern a ticket page lives at, taken from the register by resolving a path built for one. */
const TICKET_ROUTE = routeOf(ticketPath('Q-0001'));

describe('AC-7 — the columns are STAGES, and which empty ones render is the shared register', () => {
  test('a column holding an abandoned ticket renders, an empty red does not, an empty draft does', async () => {
    // The fixture the criterion names. `abandoned` is outside the design brief's eight-column list
    // and holds four tickets in this repository's own backlog today, which is what a board built
    // from the brief would silently lose.
    const root = await board({
      tickets: {
        tickets: [ticket({ id: 'Q-0002', stage: 'abandoned' })],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const rendered = columns(root);
    expect(rendered, 'a stage outside the design brief\'s eight lost its ticket').toContain('abandoned');
    expect(rendered, 'an empty column with no work in it rendered anyway').not.toContain('red');
    expect(rendered, 'a fresh project would see nothing at all').toContain('draft');
    expect(root.textContent, 'the abandoned ticket is not in the column that rendered for it').toContain('Q-0002');
  });

  test('and the brief\'s eight would drop it — the counterfactual, measured rather than argued', () => {
    // The mutation GO-6 asks for, isolated: the eight-name list `docs/05-design-prompt.md:27`
    // carries, against the ten `STAGES` declares. The two the brief lacks are the two a board
    // must not lose, `abandoned` being the one with members here today.
    const brief = ['draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed'];
    expect(brief, 'the brief\'s list has stopped being the eight this is about').toHaveLength(8);
    expect(brief.includes('abandoned'), 'the counterfactual has lost its subject').toBe(false);
    expect(brief.includes('blocked'), 'the counterfactual has lost its subject').toBe(false);
  });
});

describe('AC-8 — a stage the vocabulary cannot place is named, never dropped', () => {
  test('the ticket appears in a region of its own and in no column', async () => {
    const root = await board({
      tickets: {
        tickets: [ticket({ id: 'undefined', stage: 'undefined', title: '' })],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    expect(root.textContent, 'a ticket this board cannot place was rendered nowhere at all')
      .toContain(UNPLACEABLE_HEADING);
    expect(root.textContent, 'the unplaceable stage is not named').toContain('"undefined"');
    for (const heading of columns(root)) {
      const column = [...root.querySelectorAll('section[aria-label]')]
        .find((node) => node.getAttribute('aria-label') === heading);
      expect(column?.textContent ?? '', `the unplaceable ticket was filed under ${heading}`).not.toContain('undefined');
    }
  });

  test('two tickets whose files supplied no id are two rows, each named by its own folder', async () => {
    // The review's finding, at the surface it is visible on. The daemon answers `id: ''` for a
    // `ticket.md` `parseFrontmatter` fell open on rather than inventing one, so the folder is the
    // only identity left — and it is what tells one damaged ticket from another, both for a reader
    // and for React, which was handed the same key twice.
    let root!: HTMLElement;
    const complaints = await whileWatchingConsole(async () => {
      root = await board({
        tickets: {
          tickets: [
            ticket({ id: '', folder: 'T-0107-first-damaged', stage: 'undefined', title: '', owner: '' }),
            ticket({ id: '', folder: 'T-0108-second-damaged', stage: 'undefined', title: '', owner: '' }),
          ],
          pushLag: null,
          baseBranch: 'main',
        },
      });
    });

    const rows = [...root.querySelectorAll('li')].map((node) => node.textContent ?? '');
    expect(rows, 'two damaged tickets were collapsed into one row').toHaveLength(2);
    expect(rows.filter((text) => text.includes('T-0107-first-damaged')), 'the first is not named by its folder').toHaveLength(1);
    expect(rows.filter((text) => text.includes('T-0108-second-damaged')), 'the second is not named by its folder').toHaveLength(1);
    // Neither row falls back to the sentence a card uses for a value nobody wrote: a folder is a
    // real identity and `not set` would be two rows saying the same nothing.
    expect(root.textContent, 'a damaged ticket was rendered with no identity at all').not.toContain(NOT_SET);
    // …and React was not handed two rows under one key, which is the other half of the finding.
    expect(complaints.filter(isKeyComplaint), 'two rows share a React key').toStrictEqual([]);
  });

  test('and that key check discriminates — a list that really does repeat one complains', async () => {
    // The check above is an ABSENCE, so it is worth nothing until the instrument is shown to fire.
    // Same capture, same needle, over a list written to repeat a key on purpose.
    const complaints = await whileWatchingConsole(async () => {
      await render(createElement('ul', null,
        createElement('li', { key: 'same' }, 'first'),
        createElement('li', { key: 'same' }, 'second')));
    });
    expect(complaints.filter(isKeyComplaint).length, 'the console capture sees no duplicate key at all')
      .toBeGreaterThan(0);
  });
});

describe('AC-9 — a card carries what it has, says so where it has nothing, and is one link', () => {
  test('id, title, owner and counters, with no denominator anywhere', async () => {
    const root = await board({
      tickets: {
        tickets: [ticket({ id: 'Q-0042', title: 'Subscription downgrade', iterations: { review: 1, 'chore.review': 2 } })],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const text = root.textContent ?? '';
    expect(text).toContain('Q-0042');
    expect(text).toContain('Subscription downgrade');
    expect(text).toContain('ruud');
    expect(text, 'a counter is not rendered as the map holds it').toContain('review 1');
    expect(text).toContain('chore.review 2');
    // `max_iterations` lives inside a flow file and `GET /flows` carries no steps, so a `1/3` would
    // be a number nobody measured — which `docs/04-architecture.md` forbids by name.
    expect(/\b\d+\s*\/\s*\d+/.test(text), 'the card renders a denominator nothing supplied').toBe(false);
    // …and the needle discriminates rather than matching nothing.
    expect(/\b\d+\s*\/\s*\d+/.test('review 1/3')).toBe(true);
  });

  test('an empty title or owner says so, and never borrows a sample', async () => {
    const root = await board({
      tickets: { tickets: [ticket({ title: '', owner: '' })], pushLag: null, baseBranch: 'main' },
    });
    expect((root.textContent ?? '').split(NOT_SET).length - 1, 'an absent title and owner did not both say so').toBe(2);
  });

  test('an empty counter map renders no counter region at all', async () => {
    const root = await board({ tickets: { tickets: [ticket()], pushLag: null, baseBranch: 'main' } });
    expect(root.textContent, 'an empty counter map rendered an empty region').not.toContain('{}');
  });

  test('the whole card is one link, reachable from a keyboard, with nothing clickable inside it', async () => {
    let went: string | null = null;
    const root = await board(
      { tickets: { tickets: [ticket({ id: 'Q-00 42' })], pushLag: null, baseBranch: 'main' } },
      (to) => { went = to; },
    );
    const links = [...root.querySelectorAll('li a')];
    expect(links, 'the card is not a link').toHaveLength(1);
    const card = links[0] as HTMLAnchorElement;
    // Percent-encoded to ONE segment: an id is agent-written frontmatter, which `Backlog.read`
    // asserts rather than parses, so a space in one must not become a second path segment.
    expect(card.getAttribute('href')).toBe('/backlog/Q-00%2042');
    expect(card.querySelectorAll('a, button, input, select, textarea'), 'the card nests a second control').toHaveLength(0);
    await act(async () => card.click());
    expect(went, 'activating the card navigated nowhere').toBe('/backlog/Q-00%2042');
  });

  test('the premise: an id nobody wrote has no ticket path, because that path is the board', () => {
    // Why an id-less row cannot be a card, pinned rather than assumed — this is the fact the
    // partition below rests on. `ticketPath('')` leaves the segment empty, and `router.ts` treats a
    // trailing slash as absent, so it matches the BOARD's own row, which sits above the ticket
    // page's in the register. If a later router gave that path a ticket route of its own this goes
    // red, which is the moment to revisit the partition deliberately rather than to discover it
    // from a card that navigates a reader back to the screen they were already on.
    expect(ticketPath(''), 'an empty id no longer builds the board\'s own path').toBe(`${BOARD_PATH}/`);
    expect(routeOf(ticketPath('')), 'an empty id no longer resolves to the board, so the reason a card refuses one has moved')
      .toBe(BOARD_PATH);
    // …and a real id does reach the ticket page, so the comparison discriminates rather than
    // holding because everything under /backlog resolves to one row.
    expect(TICKET_ROUTE, 'the register holds no ticket-page route — this check has lost its subject').not.toBeNull();
    expect(TICKET_ROUTE, 'a real id resolves to the board too').not.toBe(BOARD_PATH);
  });

  test('every card links to the ticket page, and a row with no id is not a card at all', async () => {
    // The review's finding, asserted against the router rather than against a string. A card CLAIMS
    // to navigate to a ticket, and the only thing that makes the claim true is that the path it
    // carries resolves to the ticket route. A ticket whose file supplied no id has no such path, so
    // it is named in the region below rather than rendered as a link that returns to the board.
    const root = await board({
      tickets: {
        tickets: [
          ticket({ id: 'Q-0042', stage: 'draft' }),
          ticket({ id: '', folder: 'T-0109-no-id', stage: 'draft', title: 'a ticket whose file supplied no id' }),
        ],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const hrefs = [...root.querySelectorAll('li a')].map((node) => node.getAttribute('href') ?? '');
    expect(hrefs, 'the readable ticket and the id-less one were both rendered as cards').toHaveLength(1);
    for (const href of hrefs) {
      expect(routeOf(href), `a card links to ${href}, which is not the ticket page`).toBe(TICKET_ROUTE);
    }
    // Not a card, and not dropped either: named by its folder, under the region, with the reason.
    expect(root.textContent, 'the id-less ticket was rendered nowhere at all').toContain('T-0109-no-id');
    const draft = [...root.querySelectorAll('section[aria-label]')]
      .find((node) => node.getAttribute('aria-label') === 'draft');
    expect(draft?.textContent ?? '', 'the id-less ticket was filed in a column it cannot be opened from')
      .not.toContain('T-0109-no-id');

    const row = [...root.querySelectorAll('li')].map((node) => node.textContent ?? '')
      .find((text) => text.includes('T-0109-no-id')) ?? '';
    expect(row, 'the row does not say why it could not be placed').toContain('no id');
    // …and it does NOT say the other thing, which is the half that makes the reason a reason rather
    // than one sentence for every row: `draft` is a stage this board knows perfectly well.
    expect(row, 'a row kept out for its id was told its stage is unreadable').not.toContain('stage reads');
  });
});

describe('AC-10 — the figure and the sentence naming what it cannot see are one thing', () => {
  test('a priced board renders both, and the figure is labelled as neither thing it is not', async () => {
    const root = await board({
      tickets: { tickets: [ticket({ billedCostUsd: 12.5 })], pushLag: null, baseBranch: 'main' },
    });
    const text = root.textContent ?? '';
    expect(text, 'the figure did not render').toContain('$12.50');
    expect(text, 'a figure rendered with nothing saying what it omits').toContain(COST_LEGEND);
    expect(text.toLowerCase(), 'the figure is labelled as a thing it is not').not.toContain(COST_TO_DATE);
    expect(text.toLowerCase(), 'the figure is split by vendor, which one number cannot be')
      .not.toContain(`per ${'vendor'}`);
  });

  test('a board on which nothing has run renders n/a and no legend', async () => {
    const root = await board({ tickets: { tickets: [ticket()], pushLag: null, baseBranch: 'main' } });
    const text = root.textContent ?? '';
    expect(text, 'a null cost rendered as zero').toContain('cost n/a');
    expect(text, 'a legend rendered with no figure for it to qualify').not.toContain(COST_LEGEND);
    expect(text, 'a null cost was rendered as a figure').not.toContain('$0.00');
  });

  test('and no token count renders beside a dollar figure', async () => {
    // *"Codex cost is reported as tokens, never priced locally"* (2026-08-22). A blended figure is
    // the one thing that entry refuses, and a card carrying both measures is how one gets composed
    // by a reader rather than by the code.
    const root = await board({
      tickets: { tickets: [ticket({ billedCostUsd: 3.84 })], pushLag: null, baseBranch: 'main' },
    });
    expect(new RegExp(TOKEN_COUNT, 'i').test(root.textContent ?? ''), 'a token count renders beside a priced figure').toBe(false);
  });
});

describe('AC-11 — the containment token is quorum board\'s vocabulary and its suppression rule', () => {
  test('the three states render the three tokens', async () => {
    const root = await board({
      tickets: {
        tickets: [
          ticket({ id: 'Q-0001', stage: 'reviewed', containment: { state: 'contained' } }),
          ticket({ id: 'Q-0002', stage: 'reviewed', containment: { state: 'not-contained', ahead: 12 } }),
          ticket({ id: 'Q-0003', stage: 'reviewed', containment: { state: 'indeterminate', reason: 'shallow clone' } }),
        ],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const text = root.textContent ?? '';
    expect(text).toContain('main:contained');
    expect(text).toContain('main:not-contained(+12)');
    expect(text).toContain('main:indeterminate(shallow clone)');
    // …and the legend that says what `indeterminate` does NOT mean.
    expect(text, 'an indeterminate token rendered with nothing saying what it is not')
      .toContain('it does not mean the code is missing');
  });

  test('a draft ticket with no branch renders no token, and a reviewed one renders it', async () => {
    // `BRANCH_EXPECTED`, applied. Every ticket names a branch from creation and only an `integrate`
    // step ever creates one, so a board rendering every `no branch` would drown the column.
    const noBranch = { state: 'indeterminate', reason: 'no branch' };
    const root = await board({
      tickets: {
        tickets: [
          ticket({ id: 'Q-0010', stage: 'draft', containment: noBranch }),
          ticket({ id: 'Q-0011', stage: 'reviewed', containment: noBranch }),
        ],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const cards = [...root.querySelectorAll('li a')].map((node) => node.textContent ?? '');
    const draft = cards.find((text) => text.includes('Q-0010')) ?? '';
    const reviewed = cards.find((text) => text.includes('Q-0011')) ?? '';
    expect(draft, 'a draft ticket was annotated for a branch nobody has made yet').not.toContain('no branch');
    expect(reviewed, 'a reviewed ticket whose branch is gone said nothing about it').toContain('main:indeterminate(no branch)');
  });

  test('and the board says contained, and never one of the three synonyms the glossary refuses', async () => {
    const root = await board({
      tickets: {
        tickets: [ticket({ stage: 'reviewed', containment: { state: 'contained' } })],
        pushLag: null,
        baseBranch: 'main',
      },
    });
    const text = (root.textContent ?? '').toLowerCase();
    for (const forbidden of CONTAINMENT_SYNONYMS) {
      expect(text, `the board says ${forbidden}`).not.toContain(forbidden);
    }
    // The needles discriminate rather than matching nothing, over a fixture assembled the same way.
    expect(CONTAINMENT_SYNONYMS.filter((word) => `the branch was ${CONTAINMENT_SYNONYMS[0]}`.includes(word)))
      .toStrictEqual([CONTAINMENT_SYNONYMS[0]]);
  });
});

describe('AC-12 — push lag is at most one legend, it may warn and may never reassure', () => {
  test('the two silent states render nothing at all', async () => {
    for (const lag of [{ state: 'pushed' }, { state: 'indeterminate', reason: 'no remote' }]) {
      const root = await board({ tickets: { tickets: [ticket()], pushLag: lag, baseBranch: 'main' } });
      expect(root.textContent, `${JSON.stringify(lag)} rendered a line`).not.toContain('push lag');
    }
  });

  test('an unpushed base names the base, its upstream and the count, as of the last fetch', async () => {
    const root = await board({
      tickets: {
        tickets: [ticket()],
        pushLag: { state: 'unpushed', ahead: 7, upstream: 'origin/main' },
        baseBranch: 'main',
      },
    });
    const text = root.textContent ?? '';
    expect(text).toContain('main holds 7 commits that origin/main does not');
    expect(text).toContain('as of the last fetch');
    // It borrows none of containment's grammar, and it reassures about nothing.
    expect(/push lag = [^]*main:/.test(text), 'the push-lag line wears a containment token').toBe(false);
    for (const phrase of ['ci passed', 'validated', 'up to date']) {
      expect(text.toLowerCase(), `the push-lag line reassures with "${phrase}"`).not.toContain(phrase);
    }
  });
});

describe('AC-13 — the board names what consumes a stage, and starts nothing', () => {
  test('a stage two flows consume names both of them', async () => {
    // `chore` and `solutioning` both consume `requirements`. `quorum board` picks one
    // deterministically because a hint may; a screen naming one would take the
    // chore-versus-full-pipeline choice on a reader's behalf without saying it had.
    const root = await board({
      tickets: { tickets: [ticket({ stage: 'requirements' })], pushLag: null, baseBranch: 'main' },
      flows: {
        flows: [
          flow({ name: 'chore' }),
          flow({ name: 'solutioning', produces: 'solutioned' }),
          flow({ name: 'review', consumes: 'green', produces: 'reviewed' }),
        ],
      },
    });
    const column = [...root.querySelectorAll('section[aria-label]')]
      .find((node) => node.getAttribute('aria-label') === 'requirements');
    expect(column?.textContent, 'the column names neither flow').toContain('chore');
    expect(column?.textContent, 'the column names only the first flow that consumes the stage').toContain('solutioning');
    expect(column?.textContent, 'a flow that consumes another stage was named here').not.toContain('review');
  });

  test('a stage no flow consumes says so, which is not the same as a flow list nobody could read', async () => {
    const readable = await board({
      tickets: { tickets: [], pushLag: null, baseBranch: 'main' },
      flows: { flows: [flow()] },
    });
    const solutioned = [...readable.querySelectorAll('section[aria-label]')]
      .find((node) => node.getAttribute('aria-label') === 'solutioned');
    expect(solutioned?.textContent).toContain('no flow consumes this stage');

    const unreadable = await board({ tickets: { tickets: [], pushLag: null, baseBranch: 'main' }, flows: { flows: 'nonsense' } });
    expect(unreadable.textContent, 'an unreadable flow list was reported as no flow consuming the stage')
      .not.toContain('no flow consumes this stage');
    expect(unreadable.textContent).toContain('the flow list could not be read');
  });

  test('a flow the linter refused is named with its problems and invites nothing', async () => {
    const root = await board({
      tickets: { tickets: [], pushLag: null, baseBranch: 'main' },
      flows: { flows: [flow({ name: 'broken', runnable: false, consumes: null, produces: null, problems: ['goto names no flow'] })] },
    });
    expect(root.textContent).toContain(UNREADABLE_FLOWS_HEADING);
    expect(root.textContent).toContain('goto names no flow');
  });

  test('and nothing on this screen offers to start, stop or answer anything', async () => {
    const root = await board({
      tickets: { tickets: [ticket({ stage: 'requirements' })], pushLag: null, baseBranch: 'main' },
      flows: { flows: [flow()] },
    });
    // Refresh is the only control, and it re-reads. There is no Run, no gate answer, no stop.
    const buttons = [...root.querySelectorAll('button')].map((node) => node.textContent ?? '');
    expect(buttons).toStrictEqual([REFRESH_LABEL]);
  });
});

describe('AC-5/AC-6 — what the screen says before an answer, and when it does not get one', () => {
  test('before the answer it names what it is waiting for, and is not a spinner', async () => {
    // Rendered without settling the promise, which is the only moment this state exists.
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const pending = { fetch: () => new Promise<DaemonResponse>(() => undefined) };
    act(() => root.render(createElement(BacklogBoard, { fetcher: pending.fetch, now: CLOCK, onNavigate: () => undefined })));
    mounted.push(() => root.unmount());
    expect(container.textContent, 'the in-flight moment says nothing').toContain(DAEMON_ENDPOINTS.tickets);
    expect(container.querySelector('[role="progressbar"]'), 'the screen is a spinner').toBeNull();
  });

  test('nothing answering renders the sentence, the remedy and a Retry', async () => {
    const root = await board({ reject: true });
    const text = root.textContent ?? '';
    expect(text).toContain(DAEMON_ENDPOINTS.tickets);
    expect(text).toContain('Start the daemon');
    expect([...root.querySelectorAll('button')].map((node) => node.textContent)).toStrictEqual([RETRY_LABEL]);
  });

  test('a refusal renders the daemon\'s own condition rather than this page\'s paraphrase', async () => {
    const root = await board({
      status: 404,
      tickets: { code: 'no-project', condition: 'no harness/harness.yaml found', remedy: 'run quorum init' },
    });
    expect(root.textContent).toContain('no harness/harness.yaml found');
    expect(root.textContent).toContain('run quorum init');
  });

  test('a loaded board says when it loaded, and reloads only when asked', async () => {
    const answering = daemon({ tickets: { tickets: [ticket()], pushLag: null, baseBranch: 'main' } });
    const container = await render(createElement(BacklogBoard, {
      fetcher: answering.fetch, now: CLOCK, onNavigate: () => undefined,
    }));
    expect(container.textContent, 'the board does not say when its git facts were true').toContain(CLOCK());
    // Two paths on mount, and not one more until the reader asks — there is no interval here and
    // there must not be one: `GET /tickets` probes git per ticket.
    expect(answering.asked).toStrictEqual([DAEMON_ENDPOINTS.tickets, DAEMON_ENDPOINTS.flows]);
    const refresh = [...container.querySelectorAll('button')].find((node) => node.textContent === REFRESH_LABEL);
    expect(refresh, 'the board offers no way to load it again').toBeDefined();
    await act(async () => (refresh as HTMLButtonElement).click());
    expect(answering.asked).toStrictEqual([
      DAEMON_ENDPOINTS.tickets, DAEMON_ENDPOINTS.flows, DAEMON_ENDPOINTS.tickets, DAEMON_ENDPOINTS.flows,
    ]);
  });

  test('a slower earlier load never lands on top of a newer one', async () => {
    // The review's finding: every `load()` used to own a private `live` flag, and only the one the
    // mount's effect returned was ever retained — a Refresh's was dropped by the click handler. So
    // an earlier, slower request could resolve LAST and put a stale board in front of a reader who
    // had just asked for a fresh one, complete with a stale fetched-at instant and stale containment
    // and push-lag facts that this screen derives per request and stores nowhere.
    //
    // Two loads are put in flight at once the way a screen really does it: Refresh starts one, and
    // a re-render with a different fetcher starts another before the first has answered.
    const pending: ((body: unknown) => void)[] = [];
    const deferred = () => (): Promise<DaemonResponse> => new Promise<DaemonResponse>((resolve) => {
      pending.push((body) => resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }));
    });
    const listing = (id: string): unknown => ({ tickets: [ticket({ id })], pushLag: null, baseBranch: 'main' });
    /** Answer the pair of requests one load issued — tickets first, then flows. */
    const answer = async (first: number, tickets: unknown): Promise<void> => {
      await act(async () => {
        pending[first](tickets);
        pending[first + 1]({ flows: [] });
      });
    };

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const mount = (fetcher: () => Promise<DaemonResponse>): Promise<void> =>
      act(async () => root.render(createElement(BacklogBoard, { fetcher, now: CLOCK, onNavigate: () => undefined })));
    await mount(deferred());
    mounted.push(() => root.unmount());

    // The mount's load, answered, so that Refresh exists to be pressed at all.
    await answer(0, listing('Q-0001'));
    const refresh = [...container.querySelectorAll('button')].find((node) => node.textContent === REFRESH_LABEL);
    await act(async () => (refresh as HTMLButtonElement).click());
    // …and a second load started before that one answers.
    await mount(deferred());
    expect(pending, 'three loads did not each issue their own pair of requests').toHaveLength(6);

    // The newest answers first, which is the board a reader is now looking at.
    await answer(4, listing('Q-0003'));
    expect(container.textContent, 'the newest load did not render').toContain('Q-0003');
    // Then the superseded one answers, and is dropped in flight rather than overwriting it.
    await answer(2, listing('Q-0002'));
    expect(container.textContent, 'a superseded request overwrote the newer board').not.toContain('Q-0002');
    expect(container.textContent, 'the newer board was lost to a stale answer').toContain('Q-0003');
  });
});
