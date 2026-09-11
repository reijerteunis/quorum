/**
 * The two things this app can draw today: a placeholder for a screen that does not exist, and the
 * Not found view.
 *
 * Neither fabricates anything. There is no project, subscription, run, ticket, gate or cost figure
 * here, and no control that appears to start, stop, answer or mutate something — a mockup's fake
 * data in a real app is a claim the product cannot back. And neither is a blank panel, a spinner or
 * a skeleton: a screen that looks like it is loading something that is never coming is reassurance
 * standing in for an answer, which is what `quorum board` refuses when it declines to render a
 * containment token git could not produce.
 */
import type { ReactNode } from 'react';

import { HOME_PATH, RAIL, type ScreenRoute } from './routes.js';

/** What a placeholder says about itself, in one place so every route says it the same way. */
export const DOES_NOT_EXIST = 'This screen does not exist yet.';

/** How a placeholder names the ticket that will build it. Only rendered where there is one. */
export const BUILT_BY = 'Built by';

/**
 * A screen that has not been written, saying what it is and what it is waiting for.
 *
 * The explanation comes from the route register rather than from here, so that what the user reads
 * is the same sentence the register claims and a screen's explanation cannot be attached to another
 * screen's route. Where `route.ticket` is `null` no ticket line is rendered at all, rather than a
 * neighbouring screen's id being borrowed to fill the gap.
 *
 * A dynamic route shows the segments the URL supplied, decoded — that is the only thing the shell
 * knows about a run or a ticket, and showing it is how a reader confirms the URL was understood.
 */
export function Placeholder({
  route,
  params,
}: {
  route: ScreenRoute;
  params: Readonly<Record<string, string>>;
}): ReactNode {
  const supplied = Object.entries(params);
  return (
    <section className="max-w-2xl">
      <h1 className="text-lg text-text">{route.screen}</h1>
      <p className="mt-2 text-muted">{DOES_NOT_EXIST}</p>
      {route.ticket === null ? null : (
        <p className="mt-1 text-muted">
          {BUILT_BY} <span className="font-mono text-text">{route.ticket}</span>
        </p>
      )}
      <p className="mt-4 text-muted">{route.waitingFor}</p>
      {supplied.length === 0 ? null : (
        <dl className="mt-4 font-mono text-sm">
          {supplied.map(([name, value]) => (
            <div key={name} className="flex gap-2">
              <dt className="text-muted">{name}</dt>
              <dd className="text-text">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** How the Not found view opens, in one place so the test and the view cannot disagree. */
export const NOT_FOUND_HEADING = 'No such page';

/**
 * An unmatched URL, inside the shell rather than instead of it.
 *
 * The requested path is rendered as text — React escapes it, and it reaches here precisely when it
 * was something the router could not make sense of, including a percent-encoding that does not
 * decode. The way back is the rail's own home path, taken from the register.
 */
export function NotFound({ path, onNavigate }: { path: string; onNavigate: (to: string) => void }): ReactNode {
  const home = RAIL.find((entry) => entry.path === HOME_PATH);
  return (
    <section className="max-w-2xl">
      <h1 className="text-lg text-text">{NOT_FOUND_HEADING}</h1>
      <p className="mt-2 text-muted">
        Nothing in this app answers <span className="font-mono text-text">{path}</span>.
      </p>
      <p className="mt-4">
        <a
          href={HOME_PATH}
          className="text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(HOME_PATH);
          }}
        >
          {home?.label ?? HOME_PATH}
        </a>
      </p>
    </section>
  );
}
