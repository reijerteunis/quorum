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
 * screen tickets — three rail entries have no ticket at all, and three routes (mission control, the
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

/** The left rail: seven entries, in `docs/05-design-prompt.md:21`'s order. */
export const RAIL: readonly RailEntry[] = [
  { id: 'projects', label: 'Projects', path: HOME_PATH, screenExists: false },
  { id: 'backlog', label: 'Backlog', path: '/backlog', screenExists: false },
  { id: 'harness', label: 'Harness', path: '/harness', screenExists: false },
  { id: 'flows', label: 'Flows', path: '/flows', screenExists: false },
  { id: 'runs', label: 'Runs', path: '/runs', screenExists: false },
  { id: 'history', label: 'History', path: '/history', screenExists: false },
  { id: 'settings', label: 'Settings', path: '/settings', screenExists: false },
];

/**
 * Every path the shell recognises. Twelve, of which one is a redirect.
 *
 * The three rows carrying `ticket: null` say so in their own sentence rather than borrowing a
 * neighbour's id: no screen ticket exists for the projects home, the runs landing or settings, and
 * a placeholder that named one would be attaching a ticket to work it does not cover.
 */
export const ROUTES: readonly Route[] = [
  { path: '/', redirectTo: HOME_PATH },
  {
    path: HOME_PATH,
    screen: 'Projects home',
    ticket: null,
    waitingFor:
      'No ticket builds this screen yet. The daemon this app talks to holds one project and answers for that one, so there is no grid of projects for it to feed.',
  },
  {
    path: '/backlog',
    screen: 'Backlog board',
    ticket: 'Q-0017',
    waitingFor: 'The board renders the backlog as one column per stage.',
  },
  {
    path: '/backlog/:ticketId',
    screen: 'Ticket page',
    ticket: 'Q-0017',
    waitingFor: "The ticket page renders a ticket's folder as tabs, with its run log down the side.",
  },
  {
    path: '/harness',
    screen: 'Harness editor',
    ticket: 'Q-0021',
    waitingFor: 'The harness editor is M4 work, after the screens this milestone builds.',
  },
  {
    path: '/flows',
    screen: 'Flow editor',
    ticket: 'Q-0020',
    waitingFor: 'The flow editor is M4 work, after the screens this milestone builds.',
  },
  {
    path: '/runs',
    screen: 'Runs landing',
    ticket: null,
    waitingFor:
      'No ticket builds this screen yet, and the daemon reports no listing of its live runs, so there is nothing here to list.',
  },
  {
    path: '/runs/:handle',
    screen: 'Mission control',
    ticket: 'Q-0015',
    waitingFor: 'Mission control streams a run live, one trace column per parallel step.',
  },
  {
    path: '/runs/:handle/gate',
    screen: 'Gate screen',
    ticket: 'Q-0016',
    waitingFor: "The gate screen shows a step's verdict and diffs, and takes the answer.",
  },
  {
    path: '/runs/:handle/steps/:stepId',
    screen: 'Step chat',
    ticket: 'Q-0022',
    waitingFor: 'Step chat is M4 work, for the steps that ask the human a question mid-run.',
  },
  {
    path: '/history',
    screen: 'Run history',
    ticket: 'Q-0018',
    waitingFor: 'Run history lists the runs that finished, and drills into one of them.',
  },
  {
    path: '/settings',
    screen: 'Settings',
    ticket: null,
    waitingFor: 'No ticket builds this screen yet, and nothing in this app has a setting to hold.',
  },
];
