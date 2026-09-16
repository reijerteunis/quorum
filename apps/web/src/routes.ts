/**
 * The rail and the routes, as two tables — the one place in this app a route may be named.
 *
 * Everything else is built FROM these: `router.ts` matches against {@link ROUTES}, `shell.tsx`
 * draws {@link RAIL}, and `views.tsx` takes a placeholder's whole content from the row it was
 * matched to. A component that wrote a path of its own would be a second register free to drift,
 * so `test/routes.test.ts` scans the components and refuses any route-path literal these tables do
 * not hold.
 *
 * THE M4 PATHS ARE DECLARED NOW, ahead of the tickets that fill them, for the same reason: four
 * later tickets inherit a URL shape instead of each inventing one. The rail is seven entries
 * because `docs/05-design-prompt.md:21` names seven, and it does NOT map one-to-one onto the M3
 * screen tickets — two rail entries have no ticket at all, and three routes (mission control, the
 * gate screen, step chat) are reached from a run rather than from the rail.
 */

/** One entry in the left rail, in the order the design brief lists them. */
export interface RailEntry {
  /** Stable identity, used by the register and by nothing the user sees. */
  readonly id: string;
  /** What the rail shows. */
  readonly label: string;
  /** The path this entry navigates to; always a static path {@link ROUTES} holds. */
  readonly path: string;
  /**
   * Whether the screen behind this entry has been built. Every entry is `false` today and a later
   * ticket flips exactly one, which is why it is a field rather than an assumption: the shell must
   * be able to say "not yet" without a component deciding it.
   */
  readonly screenExists: boolean;
}

/** A path the shell recognises and sends somewhere else. */
export interface RedirectRoute {
  readonly path: string;
  readonly redirectTo: string;
}

/** A path the shell recognises and renders a screen — or, today, a placeholder for one — at. */
export interface ScreenRoute {
  readonly path: string;
  /** The screen's name, as the design brief and the development plan call it. */
  readonly screen: string;
  /** The ticket that builds it, or `null` where no ticket does. Never guessed. */
  readonly ticket: string | null;
  /**
   * Whether the screen behind this route has been built — {@link RailEntry.screenExists} for the
   * rows the rail does not reach.
   *
   * It arrived at Q-0127 because that ticket's screen is the first with no rail entry to say so:
   * the board's row is marked by `RAIL`, and `/backlog/:ticketId` is in neither table the rail
   * draws from. A row saying `false` is what makes a placeholder's sentence live rather than
   * describing work that is finished.
   */
  readonly screenExists: boolean;
  /**
   * What this route is waiting for, in a sentence the placeholder shows verbatim. It lives here
   * rather than in the component so that what a user reads and what the register claims cannot
   * come apart, and so that a screen's explanation cannot be attached to another screen's route.
   */
  readonly waitingFor: string;
}

export type Route = RedirectRoute | ScreenRoute;

/** True when `route` is the kind that sends the browser somewhere else. */
export const isRedirect = (route: Route): route is RedirectRoute => 'redirectTo' in route;

/**
 * Where `/` sends the browser, and the one path a component may reach for by name — the Not found
 * view offers it as the way back. Declared here so that even that reference is a register lookup.
 */
export const HOME_PATH = '/projects';

/**
 * Where the backlog board lives — the second path a component may reach for by name, and the first
 * one that has a screen behind it.
 *
 * Declared here for {@link HOME_PATH}'s reason: `app.tsx` has to know which resolved route draws a
 * real screen rather than a placeholder, and a path written there would be a second register. It is
 * the path both tables below use, so the rail entry and the route row cannot come apart.
 */
export const BOARD_PATH = '/backlog';

/**
 * The ticket page's pattern, named once because three things need it: the register row below,
 * {@link ticketPath}, which the board's cards link with, and `app.tsx`, which has to know which
 * resolved route draws the ticket page rather than a placeholder.
 *
 * Declared as a constant rather than written twice for the reason this whole file exists — and for
 * a mechanical one beside it: `test/routes.test.ts` refuses any route-path literal the register does
 * not hold, so a card assembling the ticket path out of its own template would be a second path
 * register that the scan would have to be told to excuse. Exported at Q-0127 on {@link BOARD_PATH}'s
 * own precedent, when the screen behind it arrived.
 */
export const TICKET_ROUTE = '/backlog/:ticketId';

/**
 * The gate screen's pattern, named once for {@link TICKET_ROUTE}'s reason: `app.tsx` has to know
 * which resolved route draws it rather than a placeholder, and a path written there would be a
 * second register the component scan would then have to be told to excuse.
 *
 * It has no rail entry — it is reached from a run rather than from the rail — which is why its row
 * below carries `screenExists` and why that field exists at all.
 */
export const GATE_ROUTE = '/runs/:handle/gate';

/** The registered static path for the runs landing. */
export const RUNS_PATH = '/runs';

/** The registered pattern for mission control. */
export const RUN_ROUTE = '/runs/:handle';

/**
 * Where one ticket's page lives, with the id confined to a single path segment.
 *
 * Built by substitution into the registered pattern, so the path a card links to and the path the
 * router matches are the same string with one hole filled. A ticket id is agent-written frontmatter
 * — `Backlog.read` asserts rather than parses — so it is percent-encoded rather than trusted to be
 * the `<PREFIX>-nnnn` grammar the glossary describes.
 */
export const ticketPath = (id: string): string => TICKET_ROUTE.replace(':ticketId', encodeURIComponent(id));

/** Where mission control for one opaque handle lives. */
export const runPath = (handle: string): string => RUN_ROUTE.replace(':handle', encodeURIComponent(handle));

/** Where the existing gate screen for one opaque handle lives. */
export const gatePath = (handle: string): string => GATE_ROUTE.replace(':handle', encodeURIComponent(handle));

/** The left rail: seven entries, in `docs/05-design-prompt.md:21`'s order. */
export const RAIL: readonly RailEntry[] = [
  { id: 'projects', label: 'Projects', path: HOME_PATH, screenExists: false },
  // The one entry Q-0017 flipped, and the first `true` this table has ever held.
  { id: 'backlog', label: 'Backlog', path: BOARD_PATH, screenExists: true },
  { id: 'harness', label: 'Harness', path: '/harness', screenExists: false },
  { id: 'flows', label: 'Flows', path: '/flows', screenExists: false },
  // The second entry to flip, at Q-0015: the runs landing this rail entry points to is built.
  { id: 'runs', label: 'Runs', path: RUNS_PATH, screenExists: true },
  { id: 'history', label: 'History', path: '/history', screenExists: false },
  { id: 'settings', label: 'Settings', path: '/settings', screenExists: false },
];

/**
 * Every path the shell recognises. Twelve, of which one is a redirect.
 *
 * The two rows carrying `ticket: null` say so in their own sentence rather than borrowing a
 * neighbour's id: no screen ticket exists for the projects home or settings, and a placeholder
 * that named one would be attaching a ticket to work it does not cover.
 */
export const ROUTES: readonly Route[] = [
  { path: '/', redirectTo: HOME_PATH },
  {
    path: HOME_PATH,
    screen: 'Projects home',
    ticket: null,
    screenExists: false,
    waitingFor:
      'No ticket builds this screen yet. The daemon this app talks to holds one project and answers for that one, so there is no grid of projects for it to feed.',
  },
  // Its `waitingFor` is kept although nothing renders it any more: `screenExists` is what says the
  // screen is built, and a row whose sentence had been emptied would make a later `false` silent.
  {
    path: BOARD_PATH,
    screen: 'Backlog board',
    ticket: 'Q-0017',
    screenExists: true,
    waitingFor: 'The board renders the backlog as one column per stage.',
  },
  // Re-aimed at Q-0127 by Q-0017's AC-14 and built by it. Both rows named Q-0017 while it owned the
  // whole of this work; the gate split it at the seam between a screen over endpoints that exist and
  // a screen that needs a route built for it. The sentence is kept for the reason the board's is:
  // `screenExists` is what says the screen is built, and a row whose sentence had been emptied would
  // make a later `false` silent.
  {
    path: TICKET_ROUTE,
    screen: 'Ticket page',
    ticket: 'Q-0127',
    screenExists: true,
    waitingFor: "The ticket page renders a ticket's folder as tabs, with its run log down the side.",
  },
  {
    path: '/harness',
    screen: 'Harness editor',
    ticket: 'Q-0021',
    screenExists: false,
    waitingFor: 'The harness editor is M4 work, after the screens this milestone builds.',
  },
  {
    path: '/flows',
    screen: 'Flow editor',
    ticket: 'Q-0020',
    screenExists: false,
    waitingFor: 'The flow editor is M4 work, after the screens this milestone builds.',
  },
  {
    path: RUNS_PATH,
    screen: 'Runs landing',
    ticket: 'Q-0015',
    screenExists: true,
    waitingFor:
      'The runs landing lists the runs the daemon is driving, with each row linking to mission control.',
  },
  {
    path: RUN_ROUTE,
    screen: 'Mission control',
    ticket: 'Q-0015',
    screenExists: true,
    waitingFor:
      "Mission control streams a run live: a run-activity lane, one trace column per parallel step, and an observed-only timeline. The header's run number, elapsed time and per-vendor cost are Q-0131's; starting or stopping a run is Q-0130's.",
  },
  // Built by Q-0016, which was cut in two at its own requirements gate: this screen is the half
  // over channels that already existed, and what the step it follows decided — with the change it
  // is about — is Q-0129's, needing a payload no route on this transport carries. The sentence is
  // kept for the board's and the ticket page's reason: `screenExists` is what says the screen is
  // built, and a row whose sentence had been emptied would make a later `false` silent.
  {
    path: GATE_ROUTE,
    screen: 'Gate screen',
    ticket: 'Q-0016',
    screenExists: true,
    waitingFor: 'The gate screen shows what a parked run is being asked and takes the answer; what the step before it decided is what Q-0129 adds.',
  },
  {
    path: '/runs/:handle/steps/:stepId',
    screen: 'Step chat',
    ticket: 'Q-0022',
    screenExists: false,
    waitingFor: 'Step chat is M4 work, for the steps that ask the human a question mid-run.',
  },
  {
    path: '/history',
    screen: 'Run history',
    ticket: 'Q-0018',
    screenExists: false,
    waitingFor: 'Run history lists the runs that finished, and drills into one of them.',
  },
  {
    path: '/settings',
    screen: 'Settings',
    ticket: null,
    screenExists: false,
    waitingFor: 'No ticket builds this screen yet, and nothing in this app has a setting to hold.',
  },
];
