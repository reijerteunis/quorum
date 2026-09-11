/**
 * The shell every screen sits in: the left rail, the top bar, and the region a view is drawn into.
 *
 * It asserts nothing it has not loaded. No project name, branch or login state is guessed,
 * defaulted or derived — each data region reads {@link NOT_LOADED} until the ticket that fetches it
 * arrives, and the primary control is disabled because there is nothing behind it yet. A shell that
 * showed a plausible project name would be showing a fact nobody measured, which is the failure
 * this repository refuses in `quorum board`'s containment token and in its push-lag line.
 *
 * The one region that is loaded is the live connection: where the route the app has resolved to is
 * a run route, `app.tsx` supplies a {@link ShellConnectionProps} built from the run connection's own
 * snapshot, and the top bar renders exactly what it is given — state, a missed-count notice where
 * one is due, the accepted event count, and the latest event's identity.
 */
import type { ReactNode } from 'react';
import type { Event } from '@quorum/shared';

import type { RunConnectionSnapshot } from './run-connection.js';
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

/** The primary control's label, disabled here and enabled by whichever ticket can start a run. */
export const RUN_FLOW_LABEL = 'Run flow';

/** The Retry action's label, offered only while the connection is in a failure state. */
export const RETRY_LABEL = 'Retry';

/** Live connection evidence supplied by the route-level controller. */
export interface ShellConnectionProps {
  readonly snapshot: RunConnectionSnapshot;
  readonly text: string;
  readonly retryable: boolean;
  readonly onRetry: () => void;
}

/** Inputs shared by the application adapter and the global shell. */
export interface ShellProps {
  readonly path: string;
  readonly onNavigate: (to: string) => void;
  readonly children: ReactNode;
  readonly connection?: ShellConnectionProps;
}

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

/** What the latest accepted event is, in the shortest form that still names it. */
function eventIdentity(event: Event): string {
  return 'stepId' in event ? `${event.type} ${event.stepId}` : event.type;
}

/** The connection region: state, a missed-count notice where one is due, count, latest identity. */
function ConnectionRegion({ connection }: { connection: ShellConnectionProps }): ReactNode {
  const { snapshot, text, retryable, onRetry } = connection;
  const latest = snapshot.events.at(-1);
  return (
    <div className="flex items-center gap-3 font-mono">
      <span className="text-idle">{text}</span>
      {snapshot.missedCount === null || snapshot.missedCount === 0 ? null : (
        <span className="text-waiting-on-human">missed {snapshot.missedCount}</span>
      )}
      <span className="text-muted">{snapshot.events.length} events</span>
      {latest === undefined ? null : <span className="text-muted">{eventIdentity(latest)}</span>}
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-border px-2 py-1 text-text hover:text-accent"
        >
          {RETRY_LABEL}
        </button>
      ) : null}
    </div>
  );
}

/** The top bar: three regions with nothing in them yet, the connection region, and a disabled action. */
function TopBar({ connection }: { connection?: ShellConnectionProps }): ReactNode {
  return (
    <header className="flex items-center gap-6 border-b border-border bg-surface px-4 py-2 text-sm">
      {TOP_BAR_REGIONS.map((region) => (
        <div key={region.id} className="flex items-center gap-2">
          <span className="text-muted">{region.label}</span>
          <span className="font-mono text-idle">{NOT_LOADED}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-4">
        {connection === undefined ? null : <ConnectionRegion connection={connection} />}
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
  connection,
}: ShellProps): ReactNode {
  return (
    <div className="flex h-full bg-bg text-text">
      <Rail path={path} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar connection={connection} />
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
