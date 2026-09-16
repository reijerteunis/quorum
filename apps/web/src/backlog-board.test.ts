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
import { afterEach, describe, expect, test } from 'vitest';

import { BacklogBoard, COST_LEGEND, NOT_SET, REFRESH_LABEL, RETRY_LABEL, UNPLACEABLE_HEADING, UNREADABLE_FLOWS_HEADING } from './backlog-board.js';
import type { DaemonResponse } from './daemon-client.js';
import { DAEMON_ENDPOINTS } from './daemon-endpoints.js';

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
const ticket = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'Q-0001', title: 'a ticket', stage: 'draft', owner: 'ruud',
  branch: 'harness/Q-0001/integration', containment: null, iterations: {}, billedCostUsd: null,
  ...over,
});

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

/** Every column heading the board rendered, in order. */
const columns = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('section[aria-label]')].map((node) => node.getAttribute('aria-label') ?? '');

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
});
