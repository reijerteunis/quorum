/**
 * Q-0014 AC-6 — the rail and the routes are one register, and no component names a route beside it.
 *
 * Every clause here is a REGISTER OF IDENTITIES rather than a count. A count is satisfied by a
 * member swapped out for another — *"A cache hit names what the task reads, not what its package
 * contains"* (2026-08-28) — and the thing that would go wrong here is exactly a substitution: a
 * rail entry pointed at a neighbour's path, or a route quietly renamed.
 *
 * It sits in `test/` rather than in `src/` because the component scan below reads the filesystem,
 * and AC-5's subject is every file under `src`. See `test/source.test.ts`'s header for the whole of
 * that reasoning and the `packages/shared/test/corpus.ts` precedent it follows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { activeRailPath, resolve, resolveFinal } from '../src/router.js';
import { HOME_PATH, isRedirect, RAIL, ROUTES, type ScreenRoute } from '../src/routes.js';

/** This package's source directory: `apps/web/test/` → the tree beside it. */
const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** The components — the files whose route-path literals clause 3 refuses. */
const componentFiles = (): [string, string][] =>
  fs.readdirSync(SOURCE)
    .filter((name) => name.endsWith('.tsx'))
    .sort()
    .map((name) => [name, fs.readFileSync(path.join(SOURCE, name), 'utf8')]);

/**
 * Every quoted literal in `text` that begins with a slash.
 *
 * Over raw text rather than over code alone, so a path written in a comment is collected too. That
 * over-collects, which is the safe direction: an extra literal is refused until somebody either
 * puts it in the register or stops writing it, where a missed one is the silence this clause exists
 * to close.
 */
const pathLiterals = (text: string): string[] =>
  [...text.matchAll(/['"`](\/[^'"`\n]*)['"`]/g)].map((match) => match[1]);

/** Every path the two tables hold, including where a redirect points. */
const registered = (): Set<string> => {
  const held = new Set<string>();
  for (const route of ROUTES) {
    held.add(route.path);
    if (isRedirect(route)) held.add(route.redirectTo);
  }
  for (const entry of RAIL) held.add(entry.path);
  return held;
};

const SCREEN_ROUTES: ScreenRoute[] = ROUTES.filter((route): route is ScreenRoute => !isRedirect(route));

describe('AC-6 — the rail is the seven entries the design brief names, in its order', () => {
  test('the seven ids, as an identity', () => {
    expect(RAIL.map((entry) => entry.id))
      .toStrictEqual(['projects', 'backlog', 'harness', 'flows', 'runs', 'history', 'settings']);
  });

  test('every rail entry points at a static path the route table holds', () => {
    // A rail entry aimed at a dynamic path could not be navigated to at all, having no segment to
    // supply, and one aimed at a path the table does not hold would render the Not found view.
    for (const entry of RAIL) {
      expect(entry.path.includes(':'), `${entry.id} points at a dynamic path`).toBe(false);
      expect(registered().has(entry.path), `${entry.id} points at ${entry.path}, which no route holds`).toBe(true);
      expect(resolve(entry.path).kind, `${entry.id} does not resolve`).toBe('screen');
    }
  });

  test('and every entry is marked as having no screen, because none has one yet', () => {
    // The field exists so that "not yet" is a statement the register makes rather than something a
    // component assumes. A later ticket flips exactly one of these, visibly.
    expect(RAIL.filter((entry) => entry.screenExists)).toStrictEqual([]);
  });
});

describe('AC-6 — the route table holds the twelve paths, each exactly once', () => {
  test('the twelve, as an identity in declaration order', () => {
    expect(ROUTES.map((route) => route.path)).toStrictEqual([
      '/', '/projects', '/backlog', '/backlog/:ticketId', '/harness', '/flows',
      '/runs', '/runs/:handle', '/runs/:handle/gate', '/runs/:handle/steps/:stepId',
      '/history', '/settings',
    ]);
  });

  test('every path is unique', () => {
    const paths = ROUTES.map((route) => route.path);
    expect([...new Set(paths)].length, 'two rows declare the same path').toBe(paths.length);
  });

  test('every screen route carries a screen name, and a ticket or an explicit absence', () => {
    for (const route of SCREEN_ROUTES) {
      expect(route.screen.length, `${route.path} names no screen`).toBeGreaterThan(0);
      expect(route.waitingFor.length, `${route.path} says nothing about what it waits for`).toBeGreaterThan(0);
      if (route.ticket !== null) expect(route.ticket).toMatch(new RegExp(`^${'Q'}-\\d{4}$`));
    }
  });

  test('the one redirect aims at a path the table holds', () => {
    const redirects = ROUTES.filter(isRedirect);
    expect(redirects.map((route) => route.path)).toStrictEqual(['/']);
    expect(redirects[0].redirectTo).toBe(HOME_PATH);
    expect(SCREEN_ROUTES.some((route) => route.path === HOME_PATH), 'the redirect aims at nothing').toBe(true);
  });
});

describe('AC-6 — the router is built from the tables rather than beside them', () => {
  test.each(SCREEN_ROUTES.map((route) => route.path))('%s resolves to its own row', (declared) => {
    // Driven through the register's own pattern with each dynamic segment filled, so the router is
    // exercised over exactly the paths the table declares and not over a hand-written sample.
    const supplied = declared.split('/').map((segment) => (segment.startsWith(':') ? 'x' : segment)).join('/');
    const resolution = resolve(supplied);
    expect(resolution.kind).toBe('screen');
    if (resolution.kind === 'screen') expect(resolution.route.path).toBe(declared);
  });

  test('a dynamic segment is captured under the name the pattern gives it', () => {
    const resolution = resolve('/runs/42/steps/implement');
    expect(resolution.kind).toBe('screen');
    if (resolution.kind === 'screen') expect(resolution.params).toStrictEqual({ handle: '42', stepId: 'implement' });
  });

  test('and the matcher discriminates, so "resolves" is not a constant', () => {
    // Both directions: a path nothing declares misses, a declared pattern with the wrong literal
    // segment misses, and a trailing slash is not a different route.
    expect(resolve('/nowhere').kind).toBe('not-found');
    expect(resolve('/runs/42/steps').kind).toBe('not-found');
    expect(resolve('/backlog/').kind).toBe('screen');
  });

  test('a redirect is followed to what is drawn, and reports where the browser should be', () => {
    const followed = resolveFinal('/');
    expect(followed.redirectedTo).toBe(HOME_PATH);
    expect(followed.rendered.kind).toBe('screen');
    expect(resolveFinal(HOME_PATH).redirectedTo, 'a path that is not a redirect reported one').toBeNull();
  });

  test('and a register that redirected in a circle stops rather than spinning', () => {
    // The bound, exhibited over a table this app does not ship: a browser must not be hung by a
    // register defect, and the defect must be visible rather than silent.
    const circular = [{ path: '/a', redirectTo: '/b' }, { path: '/b', redirectTo: '/a' }];
    expect(resolveFinal('/a', circular).rendered.kind).toBe('not-found');
  });

  test('the rail marks the entry the current URL sits under, not only the one it equals', () => {
    const paths = RAIL.map((entry) => entry.path);
    expect(activeRailPath('/runs/42/gate', paths)).toBe('/runs');
    expect(activeRailPath(HOME_PATH, paths)).toBe(HOME_PATH);
    expect(activeRailPath('/nowhere', paths), 'an unmatched path lit a rail entry').toBeNull();
  });

  test('and it matches on segment boundaries rather than on string prefixes', () => {
    // `/harnessed` is not below `/harness`, and a prefix test would say it is.
    expect(activeRailPath('/harnessed', RAIL.map((entry) => entry.path))).toBeNull();
  });
});

describe('AC-6 — no component names a route the tables do not hold', () => {
  test('the scan finds component files at all', () => {
    // The positive control: every failure mode of a directory walk hides files rather than
    // inventing them, so a clause that had lost its subject would report success.
    expect(componentFiles().map(([name]) => name).length, 'the walk found no component').toBeGreaterThan(3);
  });

  test('every route-path literal a component carries is one the register holds', () => {
    const held = registered();
    const unregistered = componentFiles().flatMap(([name, text]) =>
      pathLiterals(text).filter((literal) => !held.has(literal)).map((literal) => `${name}: ${literal}`));
    expect(unregistered, 'a component names a path the register does not').toStrictEqual([]);
  });

  test('and the clause has a subject — the same scan reports one that is not registered', () => {
    // Isolated over a fixture, so the emptiness above is an absence rather than a collector that
    // matches nothing. Both directions in one fixture: a registered path passes, an invented one is
    // reported.
    const fixture = `const a = '${HOME_PATH}';\nconst b = '/invented';\n`;
    const held = registered();
    expect(pathLiterals(fixture)).toStrictEqual([HOME_PATH, '/invented']);
    expect(pathLiterals(fixture).filter((literal) => !held.has(literal))).toStrictEqual(['/invented']);
  });
});
