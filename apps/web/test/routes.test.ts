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
import { DAEMON_ENDPOINTS } from '../src/daemon-endpoints.js';
import { BOARD_PATH, GATE_ROUTE, HOME_PATH, isRedirect, RAIL, ROUTES, RUN_ROUTE, RUNS_PATH, TICKET_ROUTE, ticketPath, type ScreenRoute } from '../src/routes.js';

/** This package's source directory: `apps/web/test/` → the tree beside it. */
const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** Every source file, recursively: routes can be named outside React components. */
const componentFiles = (): [string, string][] => {
  const walk = (at: string, below = ''): [string, string][] => fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const name = below ? `${below}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(at, entry.name), name) : [[name, fs.readFileSync(path.join(at, entry.name), 'utf8')]];
  });
  return walk(SOURCE).sort(([a], [b]) => a.localeCompare(b));
};

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

// Identities of (file, literal, reason), which is what the frozen contract asks for. It was a bare
// Set until Q-0120 review round 1, N-5: the exercised-use assertion below already fails a stale row,
// but the reason column is what a reviewer weighs instead of re-deriving, and a contract document is
// not where the next person editing this scan looks.
const EXCEPTION_REASONS: Record<string, string> = {
  'router.ts:/backlog/': 'the prefix the dynamic backlog route is matched by, not a route of its own',
  'router.ts:/har': 'a truncated prefix used to prove the matcher is not a substring test',
  'router.ts:/runs/<handle>': 'the placeholder form of a dynamic segment, never a literal URL',
  'shell.test.ts:/runs/run%20one': 'the percent-encoded fixture handle the decoding assertions use',
  'shell.test.ts:/nowhere/at/all': 'the unmatched URL the Not found view is proved on',
  'shell.test.ts:/backlog/%E0%A4%A': 'a malformed percent sequence, asserted not to throw',
  'run-connection.test.ts:/B/events': 'the second handle in the one-socket-at-a-time fixture',
  'shell.test.ts:/runs/run%20one/events': 'the socket path the no-daemon sentence names, asserted to reach the page since round 2 M-1',
  'backlog-board.test.ts:/backlog/Q-00%2042': "the percent-encoded href a card must build for a ticket id holding a space, asserted in both directions — a ticket id is agent-written frontmatter and `Backlog.read` asserts rather than parses it, so one segment is the property. Written out rather than taken from `ticketPath`, which would assert the implementation against itself",
  'daemon-endpoints.ts:/stop': "the DAEMON's run-cancelling segment, on the `/gate` row's terms and for its reasons (Q-0130 AC-2). It is not a shell route — no path in either table ends in it — and it is deliberately not a `DAEMON_ENDPOINTS` prefix, `/runs` already being forwarded by the dev proxy and covering everything below it. Written as a literal rather than as a template tail so that `test/source.test.ts`'s write guard, which permits it in this module and nowhere else, has a string to find",
  'daemon-endpoints.ts:/gate': "the DAEMON's gate-answering segment, which is not a shell route and is deliberately not a DAEMON_ENDPOINTS prefix — the dev proxy forwards `/runs`, which already covers it, and a sixth entry there would claim a prefix nothing forwards. Written as a literal rather than as a template tail so that `test/source.test.ts`'s write guard, which permits it in this module and nowhere else, has a string to find: an exemption forgiving something nobody wrote would forgive nothing",
  'gate-screen.test.ts:/repo/backlog/Q-0016-the-gate-screen': "the ticket folder a gate question carries, which is an absolute path on the DAEMON's machine rather than a route — `GateQuestionEvent.ticketDir`, asserted rendered verbatim. Declared once in that file so it is one row here rather than one per fixture",
  'daemon-client.test.ts:/repo/backlog/Q-0016-a': 'the same field in the client suite, where a run body has to carry a well-formed question for the schema to accept it',
};
const EXCEPTIONS = new Set(Object.keys(EXCEPTION_REASONS));

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

  test('Q-0015 AC-14 — the backlog and runs rail entries have screens', () => {
    // The field exists so that "not yet" is a statement the register makes rather than something a
    // component assumes, and Q-0014 left every entry `false` saying *"a later ticket flips exactly
    // one of these, visibly"*. This is that ticket, and this is the visible part: the count is one,
    // and the one is named, because a count alone is satisfied by a member swapped for another.
    expect(RAIL.filter((entry) => entry.screenExists).map((entry) => entry.id)).toStrictEqual(['backlog', 'runs']);
    expect(RAIL.find((entry) => entry.id === 'backlog')?.path, 'the flipped entry points somewhere else')
      .toBe(BOARD_PATH);
    // …and the six that did not move, as an identity rather than as a count of what is left.
    expect(RAIL.filter((entry) => !entry.screenExists).map((entry) => entry.id))
      .toStrictEqual(['projects', 'harness', 'flows', 'history', 'settings']);
  });
});

describe('Q-0127 AC-13 — the register gains no path, and says which screens exist', () => {
  test('the ticket route names Q-0127 and no longer says it is waiting for a route', () => {
    // **This clause moved because its subject did.** Q-0017 wrote it to assert that the row still
    // carried a placeholder sentence naming the route the daemon did not have — and this ticket
    // built that route, so the assertion that the sentence says *route* became a check that could
    // only fail if the work had been done. *"A check outlives its subject only if it can still
    // fail"* (2026-09-05): what survives is the half that is still about something — the row names
    // the ticket that built it, and its sentence describes the screen rather than a wait.
    const route = SCREEN_ROUTES.find((entry) => entry.path === '/backlog/:ticketId');
    if (!route) throw new Error('no ticket-page route — this check has lost its subject');
    expect(route.ticket, 'the ticket page no longer names the ticket that built it').toBe('Q-0127');
    expect(route.waitingFor.length, 'the sentence a user reads was emptied').toBeGreaterThan(60);
    expect(route.waitingFor, 'the row still tells a reader the daemon cannot answer for one ticket')
      .not.toMatch(/does not have yet/);
  });

  test('exactly five route rows claim a screen, and app selects every one by its registered constant', () => {
    // The rail says which entry has a screen and the rail has no ticket-page or gate entry, which
    // is why this field is on the route row too: `/backlog/:ticketId` and `/runs/:handle/gate` are
    // in neither table the rail draws from, so without it nothing in the register could say those
    // screens exist. An identity rather than a count, because a count is satisfied by a row swapped
    // for another. Two until Q-0016, which built the third.
    expect(SCREEN_ROUTES.filter((route) => route.screenExists).map((route) => route.path))
      .toStrictEqual([BOARD_PATH, TICKET_ROUTE, RUNS_PATH, RUN_ROUTE, GATE_ROUTE]);
    // The two registers agree where they overlap: the rail's board entry and the route row.
    expect(RAIL.find((entry) => entry.id === 'backlog')?.screenExists).toBe(true);
    // …and the field is load-bearing rather than decorative: every row claiming a screen is one
    // `app.tsx` selects by the register's own constant, and every row that does not is one the
    // placeholder still draws.
    const app = fs.readFileSync(path.join(SOURCE, 'app.tsx'), 'utf8');
    for (const route of SCREEN_ROUTES.filter((entry) => entry.screenExists)) {
      // A total map rather than a ternary chain: the chain's last arm was an unguarded default, so
      // a SIXTH row claiming a screen took `RUN_ROUTE`'s name and passed on the fifth row's
      // evidence. An unmapped row now fails here by name. Review round 1, N4.
      const NAMES: Readonly<Record<string, string>> = {
        [BOARD_PATH]: 'BOARD_PATH', [TICKET_ROUTE]: 'TICKET_ROUTE', [GATE_ROUTE]: 'GATE_ROUTE',
        [RUNS_PATH]: 'RUNS_PATH', [RUN_ROUTE]: 'RUN_ROUTE',
      };
      const name = NAMES[route.path];
      expect(name, `${route.path} claims a screen and this clause has no constant name for it`).toBeDefined();
      // The assertion is that `app.tsx` MENTIONS the register's constant for this row, which is
      // weaker than selecting by it; the sentence says the weaker thing. Review round 4, N-2.
      expect(app, `app.tsx does not name ${String(name)}, the register's own constant for ${route.path}`).toContain(name);
    }
    expect(app, 'the app names a route path of its own rather than a register constant')
      .not.toMatch(/['"`]\/backlog/);
  });

  test('Q-0129 AC-12 — the gate row names what the screen renders now and whose the rest is', () => {
    // **The same move `routes.ts:146` records for the ticket page, one row down.** The sentence is
    // kept rather than emptied, because `screenExists` is what says a screen is built and a row
    // whose explanation had been deleted would make a later `false` silent.
    //
    // **Re-aimed at the successor rather than deleted, which is the half of this that matters.**
    // It named Q-0129 as the ticket that would add what the step before the gate decided; that has
    // landed, so the row says the screen shows it — and the clause pointing at the half that has
    // NOT landed moves to **Q-0134** instead of going away, because a register that stops naming
    // an owed half is one nothing will notice is owed.
    const route = SCREEN_ROUTES.find((entry) => entry.path === GATE_ROUTE);
    if (!route) throw new Error('no gate-screen route — this check has lost its subject');
    expect(route.screenExists, 'the row still says the screen is unbuilt').toBe(true);
    expect(route.ticket, 'the gate screen no longer names the ticket that built it').toBe('Q-0016');
    expect(route.waitingFor.length, 'the sentence a user reads was emptied').toBeGreaterThan(60);
    expect(route.waitingFor, 'the row still promises the diff this screen does not render')
      .not.toMatch(/diffs/);
    expect(route.waitingFor, 'the row still routes the decision to the ticket that has landed it')
      .not.toMatch(/Q-0129/);
    // Keyed on the landed entry's own noun rather than on a transcribed sentence. The clause read
    // `/what the step before it decided/` until the hand repair after this ticket's exhaustion gate,
    // which is two defects in one line: it pinned a WORDING where the criterion is about a
    // PROPERTY, so an honest rephrasing turned it red — and the wording it pinned was the one the
    // review found wrong, because the deciding step is not the preceding one. It also forbids the
    // retired claim, so the sentence cannot drift back.
    expect(route.waitingFor, 'the row does not say the screen renders the decision that reached the gate')
      .toMatch(/decision that reached it/);
    expect(route.waitingFor, 'the row claims the deciding step was the one immediately before the gate')
      .not.toMatch(/step before/);
    expect(route.waitingFor, 'the row does not name what the rest of the screen waits for')
      .toContain('Q-0134');
  });

  test('and the board\'s own path is a register constant both tables are built from', () => {
    // `app.tsx` has to know which resolved route draws a real screen; a path written there would be
    // a second register. It reaches for `BOARD_PATH`, on `HOME_PATH`'s precedent, and both tables
    // here use the same constant so the rail entry and the route row cannot come apart.
    expect(ROUTES.some((route) => !isRedirect(route) && route.path === BOARD_PATH)).toBe(true);
    expect(RAIL.some((entry) => entry.path === BOARD_PATH)).toBe(true);
    expect(fs.readFileSync(path.join(SOURCE, 'app.tsx'), 'utf8'), 'the app names the board path rather than importing it')
      .toContain('BOARD_PATH');
  });

  test('the ticket path is built by substitution into the registered pattern', () => {
    // One string with one hole filled, so the path a card links to and the path the router matches
    // cannot become two. And the id is percent-encoded to a single segment: a ticket id is
    // agent-written frontmatter, which `Backlog.read` asserts rather than parses.
    expect(ticketPath('Q-0042')).toBe('/backlog/Q-0042');
    expect(ticketPath('a/b'), 'an id with a slash became two path segments').toBe('/backlog/a%2Fb');
    expect(resolve(ticketPath('a/b')).kind, 'the path a card links to does not resolve').toBe('screen');
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

describe('Q-0121 AC-12 — the Runs landing route no longer says the daemon reports no listing', () => {
  /** The row the placeholder shows verbatim, which is the one place this sentence exists. */
  const runsRoute = (): ScreenRoute => {
    const route = SCREEN_ROUTES.find((entry) => entry.path === '/runs');
    if (!route) throw new Error('no /runs screen route — this check has lost its subject');
    return route;
  };

  test('the claim that became false is gone, and the one that is still true stays', () => {
    // Two clauses stood here and this ticket makes exactly one of them false. The daemon lists its
    // live runs now, so the sentence is corrected to what remains true — and it may NOT be replaced
    // by one promising a screen that does not exist, which is the rule the register is under:
    // no placeholder shows a fabricated run, and none says a screen is on its way when it is not.
    const { waitingFor, ticket } = runsRoute();
    expect(waitingFor, 'the route still tells a user the daemon reports no listing')
      .not.toMatch(/reports no listing/);
    expect(waitingFor, 'the route still tells a user there is nothing to list')
      .not.toMatch(/nothing here to list/);
    expect(waitingFor, 'the built screen still claims no ticket builds it').not.toMatch(/No ticket builds this screen yet/);
    expect(ticket).toBe('Q-0015');
    expect(runsRoute().screenExists).toBe(true);
  });

  test('and it says what it is now waiting for, which is a screen rather than a daemon', () => {
    // The register carries the sentence so that what a user reads and what the register claims
    // cannot come apart; this is the half that says the replacement is an ANSWER rather than the
    // absence of the old claim.
    const { waitingFor } = runsRoute();
    expect(waitingFor.length).toBeGreaterThan(60);
    expect(waitingFor.trim().endsWith('.'), 'the sentence a user reads is not a sentence').toBe(true);
    // And the shipped text is what this clause was written against, so an edit that emptied the
    // field would fail rather than satisfy every negative above.
    expect(waitingFor.length, 'the sentence is implausibly short').toBeGreaterThan(60);
    // …and by content, as the gate row's own clause is: a length floor is satisfied by any
    // 61-character sentence, including one describing a screen that no longer exists. Round 1, N6.
    expect(waitingFor, 'the sentence does not describe the screen that shipped').toContain('runs the daemon is driving');
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
    const held = new Set([...registered(), ...Object.values(DAEMON_ENDPOINTS)]);
    const seenExceptions = new Set<string>();
    const unregistered = componentFiles().flatMap(([name, text]) => pathLiterals(text).flatMap((literal) => {
      if (held.has(literal)) return [];
      const identity = `${name}:${literal}`;
      if (EXCEPTIONS.has(identity)) { seenExceptions.add(identity); return []; }
      return [`${name}: ${literal}`];
    }));
    expect(unregistered, 'a component names a path the register does not').toStrictEqual([]);
    expect([...seenExceptions].sort(), 'a route-literal exception has lost its subject').toStrictEqual([...EXCEPTIONS].sort());
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
