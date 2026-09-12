/**
 * The application: which path the browser is at, and what the shell draws for it.
 *
 * It holds the current path and nothing else, in memory. There is no cache of tickets, runs or
 * containment here and there is not meant to be one — the files are the database, and the two facts
 * a board derives from git are derived per request by design, so a copy held in a browser would be
 * the UI holding a truth it cannot keep current.
 *
 * The one exception is the live connection a run route opens: `apps/web/src/run-connection.ts`
 * owns the socket, and this component owns only the one controller a run route needs, when the
 * path resolves to one.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { canRetry, connectionStateText } from './connection-state.js';
import { resolveFinal } from './router.js';
import {
  createRunConnection,
  type RunConnection,
  type RunConnectionSnapshot,
  type SocketFactory,
  type SocketTransport,
} from './run-connection.js';
import { Shell, type ShellConnectionProps } from './shell.js';
import { NotFound, Placeholder } from './views.js';

/** Where the app starts when nothing tells it otherwise — the browser's own location. */
const currentPath = (): string => (typeof window === 'undefined' ? '/' : window.location.pathname);

/** The browser's own address, in the form the run connection needs to derive a same-origin URL. */
const currentPageUrl = (): URL | undefined => (typeof window === 'undefined' ? undefined : new URL(window.location.href));

/**
 * A real browser socket, narrowed to the subset {@link SocketTransport} declares.
 *
 * `WebSocket`'s own handler properties carry an event argument this narrower interface does not, so
 * a direct structural assignment does not compile; the cast through `unknown` is the bridge between
 * the two, not a widening of what the connection is permitted to call on it.
 */
const defaultSocketFactory: SocketFactory = (url) => new WebSocket(url.toString()) as unknown as SocketTransport;

/** What the top bar shows wherever no run route holds a live connection. */
const IDLE_SNAPSHOT: RunConnectionSnapshot = { state: { kind: 'idle' }, events: [], missedCount: null };

/** Injectable application inputs used by the browser and the transport-driven tests. */
export interface AppProps {
  readonly initialPath?: string;
  readonly socketFactory?: SocketFactory;
  readonly pageUrl?: URL;
}

/**
 * The shell, at one path, with the view that path resolves to inside it.
 *
 * `initialPath` exists so the resolution can be driven directly; left out, the app reads the
 * browser's location and keeps in step with the back and forward buttons.
 */
export function App({ initialPath, socketFactory, pageUrl }: AppProps): ReactNode {
  const [path, setPath] = useState(initialPath ?? currentPath());

  const navigate = useCallback((to: string) => {
    setPath(to);
    if (typeof window !== 'undefined') window.history.pushState(null, '', to);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = (): void => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const { rendered, redirectedTo } = resolveFinal(path);

  useEffect(() => {
    // The address bar is corrected after the fact rather than during render: a redirect has already
    // decided what is drawn, and what is left is telling the browser which address it is at.
    if (redirectedTo !== null && typeof window !== 'undefined') {
      window.history.replaceState(null, '', redirectedTo);
    }
  }, [redirectedTo]);

  // Present on every route the register gives a `:handle` segment — today `/runs/:handle` and its
  // two children — and absent everywhere else, which is what tells this component a live
  // connection belongs on the current screen at all.
  const handle = rendered.kind === 'screen' && 'handle' in rendered.params ? rendered.params.handle : undefined;
  const page = pageUrl ?? currentPageUrl();
  const pageHref = page?.href;
  const pageOrigin = page?.origin;

  const connectionRef = useRef<RunConnection | null>(null);
  const [snapshot, setSnapshot] = useState<RunConnectionSnapshot | null>(null);

  useEffect(() => {
    // One controller for as long as the current route is a run route at all. A handle change does
    // not recreate it — the effect below calls `connect` again on this same controller, which is
    // what replaces the socket it owns — so this effect's dependency is the boolean rather than the
    // handle itself.
    if (handle === undefined) return undefined;
    const controller = createRunConnection(socketFactory ?? defaultSocketFactory);
    connectionRef.current = controller;
    const unsubscribe = controller.subscribe(setSnapshot);
    setSnapshot(controller.snapshot);
    return () => {
      unsubscribe();
      controller.dispose();
      connectionRef.current = null;
      setSnapshot(null);
    };
  }, [handle !== undefined, socketFactory]);

  useEffect(() => {
    // Depends on the origin rather than the full href: `runEventsUrl` reads only protocol and host,
    // and re-deriving the socket URL on every same-handle navigation would replace a live socket and
    // discard the trace it has already accepted.
    if (handle === undefined || pageHref === undefined) return;
    connectionRef.current?.connect(handle, new URL(pageHref));
    // `socketFactory` is a dependency here as well as above, and the mismatch was the defect: the
    // effect above rebuilds the controller when the factory's identity moves, and without this one
    // firing too the replacement was never connected — leaving the region at `idle`, which offers no
    // Retry, a state with no user action and the thing AC-15 exists to forbid. Unreachable from
    // `main.tsx`, which passes no factory, but `AppProps` exports the seam and the idiomatic call is
    // an inline arrow. Q-0120 review round 3, N-1.
  }, [handle, pageOrigin, socketFactory]);

  const onRetry = useCallback(() => connectionRef.current?.retry(), []);

  // Always a real value, never absent: off a run route, or before the controller's first snapshot,
  // the region shows the idle state rather than rendering nothing.
  const connection: ShellConnectionProps =
    handle === undefined || snapshot === null
      ? { snapshot: IDLE_SNAPSHOT, text: connectionStateText(IDLE_SNAPSHOT.state), retryable: canRetry(IDLE_SNAPSHOT.state), onRetry }
      : { snapshot, text: connectionStateText(snapshot.state), retryable: canRetry(snapshot.state), onRetry };

  return (
    <Shell path={redirectedTo ?? path} onNavigate={navigate} connection={connection}>
      {rendered.kind === 'screen' ? (
        <Placeholder route={rendered.route} params={rendered.params} />
      ) : (
        <NotFound path={rendered.path} onNavigate={navigate} />
      )}
    </Shell>
  );
}
