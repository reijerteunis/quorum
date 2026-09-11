/**
 * The shell every screen sits in: the left rail, the top bar, and the region a view is drawn into.
 *
 * It asserts nothing it has not loaded. No project name, branch or login state is guessed,
 * defaulted or derived — each data region reads {@link NOT_LOADED} until the ticket that fetches it
 * arrives, and the primary control is disabled because there is nothing behind it yet. A shell that
 * showed a plausible project name would be showing a fact nobody measured, which is the failure
 * this repository refuses in `quorum board`'s containment token and in its push-lag line.
 */
import type { ReactNode } from 'react';

import { activeRailPath } from './router.js';
import { RAIL } from './routes.js';

/**
 * What a region that has no data yet says. One string, used once per region, so a reader can tell
 * "nobody has fetched this" from "this is empty".
 */
export const NOT_LOADED = 'not loaded';

/**
 * The top bar's data regions — the three `docs/05-design-prompt.md:21` names that carry a value.
 *
 * The fourth thing that paragraph names is the primary control, which is not a data region: it has
 * no value to be unloaded, only an action it cannot yet perform.
 */
export const TOP_BAR_REGIONS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'branch', label: 'Branch' },
  { id: 'subscriptions', label: 'Subscriptions' },
];

/**
 * The connection region's text until the live connection exists.
 *
 * It names the ticket that adds one, because the alternative — an empty region, or a region that
 * simply reads "offline" — is silence standing in for an answer.
 */
export const CONNECTION_PENDING = 'no live connection yet — Q-0120 opens one';

/** The primary control's label, disabled here and enabled by whichever ticket can start a run. */
export const RUN_FLOW_LABEL = 'Run flow';

/** The left rail. Every entry is an anchor, so it is reachable and activatable from a keyboard. */
function Rail({ path, onNavigate }: { path: string; onNavigate: (to: string) => void }): ReactNode {
  const active = activeRailPath(path, RAIL.map((entry) => entry.path));
  return (
    <nav aria-label="Sections" className="flex w-40 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2">
      {RAIL.map((entry) => (
        <a
          key={entry.id}
          href={entry.path}
          aria-current={entry.path === active ? 'page' : undefined}
          className={`rounded px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            entry.path === active ? 'bg-bg text-accent' : 'text-muted hover:text-text'
          }`}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(entry.path);
          }}
        >
          {entry.label}
        </a>
      ))}
    </nav>
  );
}

/** The top bar: three regions with nothing in them yet, a disabled action, and a connection state. */
function TopBar(): ReactNode {
  return (
    <header className="flex items-center gap-6 border-b border-border bg-surface px-4 py-2 text-sm">
      {TOP_BAR_REGIONS.map((region) => (
        <div key={region.id} className="flex items-center gap-2">
          <span className="text-muted">{region.label}</span>
          <span className="font-mono text-idle">{NOT_LOADED}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-4">
        <span className="text-idle">{CONNECTION_PENDING}</span>
        <button type="button" disabled className="rounded border border-border px-3 py-1 text-idle">
          {RUN_FLOW_LABEL}
        </button>
      </div>
    </header>
  );
}

/** The rail, the top bar and the view, arranged. Renders with nothing listening on any port. */
export function Shell({
  path,
  onNavigate,
  children,
}: {
  path: string;
  onNavigate: (to: string) => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex h-full bg-bg text-text">
      <Rail path={path} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
