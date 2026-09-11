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
    if (handle === undefined || pageHref === undefined) return;
    connectionRef.current?.connect(handle, new URL(pageHref));
  }, [handle, pageHref]);

  const onRetry = useCallback(() => connectionRef.current?.retry(), []);

  const connection: ShellConnectionProps | undefined =
    handle === undefined || snapshot === null
      ? undefined
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
