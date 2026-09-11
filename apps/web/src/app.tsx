/**
 * The application: which path the browser is at, and what the shell draws for it.
 *
 * It holds the current path and nothing else, in memory. There is no cache of tickets, runs or
 * containment here and there is not meant to be one — the files are the database, and the two facts
 * a board derives from git are derived per request by design, so a copy held in a browser would be
 * the UI holding a truth it cannot keep current.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { resolveFinal } from './router.js';
import { Shell } from './shell.js';
import { NotFound, Placeholder } from './views.js';

/** Where the app starts when nothing tells it otherwise — the browser's own location. */
const currentPath = (): string => (typeof window === 'undefined' ? '/' : window.location.pathname);

/**
 * The shell, at one path, with the view that path resolves to inside it.
 *
 * `initialPath` exists so the resolution can be driven directly; left out, the app reads the
 * browser's location and keeps in step with the back and forward buttons.
 */
export function App({ initialPath }: { initialPath?: string }): ReactNode {
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

  return (
    <Shell path={redirectedTo ?? path} onNavigate={navigate}>
      {rendered.kind === 'screen' ? (
        <Placeholder route={rendered.route} params={rendered.params} />
      ) : (
        <NotFound path={rendered.path} onNavigate={navigate} />
      )}
    </Shell>
  );
}
