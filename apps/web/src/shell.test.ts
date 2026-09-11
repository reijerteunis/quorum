// @vitest-environment jsdom
/**
 * Q-0014 AC-2, AC-7, AC-8, AC-9 — the shell mounts, and what it draws asserts nothing it has not
 * loaded.
 *
 * THE DOM COMES FROM THE DOCBLOCK ABOVE AND FROM NOWHERE ELSE. `apps/web/vitest.config.js` is
 * pinned byte for byte by `packages/core/src/test-discovery.test.ts:176` — a package that stopped
 * re-exporting the shared configuration could narrow its own collection silently — and
 * `vitest.shared.js` sets no `environment`, so every test in this workspace runs in Node. A per-file
 * `@vitest-environment` is a property of this file rather than of the configuration, so it buys a
 * document here without moving either guard.
 *
 * The file is `.test.ts` and not `.test.tsx` deliberately, and so is every other test this ticket
 * adds: `testFilesIn` in that same guard matches a `.test.ts` suffix only, `packages/core`'s own
 * `turbo.json` declares the `apps` test glob with that same suffix and nothing wider, and Vitest's
 * include would run a `.test.tsx` regardless — so one named that way would execute while being
 * invisible to the discovery guard AND hashed by no turbo input. It is bounded by this naming rule
 * and registered as R-3 rather than closed here, `testFilesIn` being `packages/core`'s surface;
 * `test/package.test.ts` is where that rule is asserted rather than only stated.
 *
 * THIS IS ONE OF TWO TEST FILES LEFT UNDER `src/`, and it is here because it reaches for nothing a
 * browser does not have: a document, React, and the app's own modules. The four that read the
 * filesystem live in `test/`, because AC-5's subject is every file under `src` — see
 * `test/source.test.ts`'s header.
 */
import { createElement, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { App } from './app.js';
import { CONNECTION_PENDING, NOT_LOADED, RUN_FLOW_LABEL, TOP_BAR_REGIONS } from './shell.js';
import { isRedirect, RAIL, ROUTES, type ScreenRoute } from './routes.js';
import { DOES_NOT_EXIST, NOT_FOUND_HEADING, Placeholder } from './views.js';

declare global {
  // React refuses to run `act` outside an environment that declares itself one, and says so rather
  // than silently not flushing. `var` is what a global declaration takes; `let` declares a
  // block-scoped binding that never reaches `globalThis`.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Every screen route in the register — the redirect is the one row with nothing to draw. */
const SCREEN_ROUTES: ScreenRoute[] = ROUTES.filter((route): route is ScreenRoute => !isRedirect(route));

const mounted: (() => void)[] = [];

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await act(async () => unmount());
  document.body.innerHTML = '';
});

/** Render `element` into a real document and answer the element it was mounted into. */
async function render(element: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  mounted.push(() => root.unmount());
  return container;
}

/** The visible text of `element`, whitespace-normalised so a line break is not a difference. */
const textOf = (element: HTMLElement): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/** How many times `needle` occurs in `haystack` — a count, where `toContain` answers only presence. */
const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('AC-2 — the application mounts into a real document, with no daemon running', () => {
  test('it renders the rail and the top bar without throwing', async () => {
    // The smoke test, and the only one that needs the whole app: nothing is listening on any port,
    // no daemon was started, and the shell is expected to draw anyway. Both network primitives are
    // replaced with throwing stubs for the duration, so "with no daemon running" is asserted rather
    // than merely arranged — a shell that tried to fetch would fail here instead of quietly
    // rendering an empty state.
    const realFetch = globalThis.fetch;
    const realSocket = globalThis.WebSocket;
    const reached: string[] = [];
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: () => { reached.push('fetch'); throw new Error('the shell must not fetch'); },
    });
    Object.defineProperty(globalThis, 'WebSocket', {
      configurable: true,
      value: function FakeSocket() { reached.push('WebSocket'); throw new Error('the shell must not open a socket'); },
    });
    try {
      const container = await render(createElement(App, { initialPath: RAIL[0].path }));
      expect(container.querySelector('nav'), 'the shell rendered no rail').not.toBeNull();
      expect(container.querySelector('header'), 'the shell rendered no top bar').not.toBeNull();
      expect(container.querySelector('main'), 'the shell rendered no view region').not.toBeNull();
      expect(reached, 'the shell reached for the network while mounting').toEqual([]);
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: realFetch });
      Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: realSocket });
    }
  });

  test('and the rail is seven anchors carrying the register\'s own paths, so it is reachable by keyboard', async () => {
    // An anchor with an `href` is focusable and activatable without a pointer; a `div` with a click
    // handler is neither. Asserted over the register rather than a literal list, so an eighth entry
    // is covered without anyone remembering.
    const container = await render(createElement(App, { initialPath: RAIL[0].path }));
    const links = [...(container.querySelector('nav')?.querySelectorAll('a') ?? [])];
    expect(links.map((link) => link.getAttribute('href'))).toStrictEqual(RAIL.map((entry) => entry.path));
    expect(links.map((link) => (link.textContent ?? '').trim())).toStrictEqual(RAIL.map((entry) => entry.label));
  });

  test('and the root path is redirected rather than rendered as a miss', async () => {
    // The one redirect in the register, end to end: `/` draws the projects placeholder rather than
    // the Not found view.
    const container = await render(createElement(App, { initialPath: '/' }));
    expect(textOf(container)).toContain(SCREEN_ROUTES[0].screen);
    expect(textOf(container)).not.toContain(NOT_FOUND_HEADING);
  });
});

describe('AC-7 — a route whose screen does not exist says what it is waiting for, and fabricates nothing', () => {
  test.each(SCREEN_ROUTES.map((route) => [route.path, route] as const))(
    '%s names its screen and carries the register\'s own explanation', async (_path, route) => {
      const container = await render(createElement(Placeholder, { route, params: {} }));
      const text = textOf(container);
      expect(text, 'the placeholder does not name its screen').toContain(route.screen);
      expect(text, 'the placeholder does not say the screen is absent').toContain(DOES_NOT_EXIST);
      expect(route.waitingFor.length, `${route.path} carries no explanation in the register`).toBeGreaterThan(0);
      expect(text, 'the explanation shown is not the one the register holds').toContain(route.waitingFor);
    });

  test.each(SCREEN_ROUTES.filter((route) => route.ticket !== null).map((route) => [route.path, route] as const))(
    '%s names the ticket that builds it', async (_path, route) => {
      const container = await render(createElement(Placeholder, { route, params: {} }));
      expect(textOf(container)).toContain(route.ticket ?? '');
    });

  test.each(SCREEN_ROUTES.filter((route) => route.ticket === null).map((route) => [route.path, route] as const))(
    '%s has no ticket, and borrows no other screen\'s', async (_path, route) => {
      // The clause that stops a later reader quietly attaching one screen's ticket to another's
      // placeholder. The needle is assembled so this file can be scanned by its own rule elsewhere
      // without matching itself.
      const container = await render(createElement(Placeholder, { route, params: {} }));
      expect(textOf(container)).not.toMatch(new RegExp(`${'Q'}-\\d{4}`));
    });

  test('the register has three ticketless screens, so the clause above discriminates', () => {
    // Without this, a register in which every screen had a ticket would satisfy the clause above by
    // running over nothing at all.
    expect(SCREEN_ROUTES.filter((route) => route.ticket === null).map((route) => route.path))
      .toStrictEqual(['/projects', '/runs', '/settings']);
  });

  test('a dynamic route shows the decoded segment the URL supplied', async () => {
    // Percent-encoded on the way in, decoded on the way out: this is the only thing the shell knows
    // about the run, and showing the raw encoding would be showing what the browser sent rather
    // than what the user asked for.
    const container = await render(createElement(App, { initialPath: '/runs/run%20one' }));
    const text = textOf(container);
    expect(text, 'the segment was not decoded').toContain('run one');
    expect(text, 'the raw encoding is being shown instead').not.toContain('run%20one');
  });

  test('and no placeholder shows a fabricated figure or a control that claims to act', async () => {
    // The mockup's own data is the thing that must not leak into a real app: a project name, a run,
    // a cost. Every placeholder is checked for the shapes those take.
    for (const route of SCREEN_ROUTES) {
      const container = await render(createElement(Placeholder, { route, params: {} }));
      const text = textOf(container);
      expect(text, `${route.path} shows a currency figure`).not.toMatch(/\$\d/);
      expect(text, `${route.path} shows a token count`).not.toMatch(/\d+k tokens/);
      expect(container.querySelectorAll('button').length, `${route.path} offers a control`).toBe(0);
      expect(container.querySelectorAll('input,select,textarea').length, `${route.path} offers an input`).toBe(0);
    }
  });
});

describe('AC-8 — an unmatched URL is a Not found view inside the same shell', () => {
  test.each([
    ['an unmatched path', '/nowhere/at/all'],
    ['a malformed percent-encoding', '/backlog/%E0%A4%A'],
  ])('%s reaches the Not found view without throwing', async (_what, path) => {
    const container = await render(createElement(App, { initialPath: path }));
    const text = textOf(container);
    expect(text, 'the Not found view did not render').toContain(NOT_FOUND_HEADING);
    expect(text, 'the requested path is not shown as text').toContain(path);
    expect(container.querySelector('nav'), 'the Not found view replaced the rail').not.toBeNull();
    expect(container.querySelector('header'), 'the Not found view replaced the top bar').not.toBeNull();
  });

  test('and it offers a keyboard-reachable way back', async () => {
    const container = await render(createElement(App, { initialPath: '/nowhere/at/all' }));
    const back = container.querySelector('main a');
    expect(back, 'the Not found view offers no link back').not.toBeNull();
    expect(back?.getAttribute('href')).toBe(RAIL[0].path);
  });

  test('the malformed path really is one — the clause is not passing over a decodable string', () => {
    // Isolating what makes the row above a malformed-encoding case rather than a second unmatched
    // path: `decodeURIComponent` must actually refuse it.
    expect(() => decodeURIComponent('%E0%A4%A')).toThrow();
  });
});

describe('AC-9 — the top bar reserves its regions and asserts nothing it has not loaded', () => {
  test('every data region reads the not-loaded string, once each', async () => {
    const container = await render(createElement(App, { initialPath: RAIL[0].path }));
    const header = container.querySelector('header');
    expect(header, 'there is no top bar').not.toBeNull();
    const text = textOf(header as HTMLElement);
    expect(TOP_BAR_REGIONS.length, 'the top bar declares no data region').toBeGreaterThan(0);
    expect(occurrences(text, NOT_LOADED), 'a region is loaded, empty, or repeated')
      .toBe(TOP_BAR_REGIONS.length);
    for (const region of TOP_BAR_REGIONS) {
      expect(text, `the top bar has no ${region.id} region`).toContain(region.label);
    }
  });

  test('the primary control is present and disabled', async () => {
    const container = await render(createElement(App, { initialPath: RAIL[0].path }));
    const button = container.querySelector('header button');
    expect(button, 'the top bar offers no primary control').not.toBeNull();
    expect((button as HTMLButtonElement).disabled, 'the control is enabled with nothing behind it').toBe(true);
    expect((button?.textContent ?? '').trim()).toContain(RUN_FLOW_LABEL);
  });

  test('the connection region says there is none yet, and names the ticket that opens one', async () => {
    const container = await render(createElement(App, { initialPath: RAIL[0].path }));
    const text = textOf(container.querySelector('header') as HTMLElement);
    expect(text, 'the connection region is silent about there being no connection').toContain(CONNECTION_PENDING);
    expect(CONNECTION_PENDING, 'the connection region names no successor').toMatch(new RegExp(`${'Q'}-\\d{4}`));
  });

  test('and the shell shows no project name, cost or vendor state it has not been given', async () => {
    const container = await render(createElement(App, { initialPath: RAIL[0].path }));
    const text = textOf(container);
    expect(text, 'a currency figure appears with nothing behind it').not.toMatch(/\$\d/);
    expect(text, 'a branch name appears with nothing behind it').not.toMatch(/\bmain\b/);
  });
});
