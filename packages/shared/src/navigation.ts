/**
 * What tells a top-level browser navigation from every other request, defined once for both ends.
 *
 * **Why it lives here rather than in either place that uses it.** Two things have to agree about
 * this question and they run in different processes: the dev server's proxy, which must step aside
 * for a page load instead of forwarding it to the daemon (`apps/web/vite.config.ts`), and the
 * daemon's own static route, which must answer a page load with `index.html` instead of falling
 * through to a JSON 404 (`packages/server/src/static.ts`). Those two disagreeing is not a cosmetic
 * drift: it is a route that works in development and 404s in the shipped product, which is exactly
 * the defect Q-0120's review round 1 found in the proxy — seven of twelve routes 404 on a reload
 * while in-app navigation kept working and hid it. One definition is what makes that class of
 * disagreement unrepresentable rather than merely unlikely.
 *
 * This module imports nothing, from this package or any other, which is what lets both ends reach
 * it: `packages/server` may not import `apps/web` and `apps/web` may not import `packages/server`.
 *
 * **Not a content-negotiation library.** It answers one question with one rule, and the rule is
 * deliberately narrow: a browser asks for `text/html` when it is loading a page into a window, and
 * a `fetch` for JSON, a WebSocket upgrade and a script tag's request for its own source all do not.
 */

/**
 * Whether a request is a top-level navigation — a page load rather than a fetch.
 *
 * `HEAD` is included beside `GET` because a `HEAD` is a `GET` whose body is discarded, and a
 * navigation predicate that answered differently for the two would make `HEAD /runs/run-3` a 404
 * where `GET /runs/run-3` is a page.
 *
 * @param method the request method, in the casing the transport reports it.
 * @param accept the request's `Accept` header, or `undefined`/`null` where it sent none. A request
 *   with no `Accept` is **not** a navigation: every browser sends one on a page load, so absence is
 *   evidence of a programmatic client rather than a case to guess at.
 * @returns true when this request should be answered with the application shell.
 */
export function isNavigationRequest(method: string, accept: string | null | undefined): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return (accept ?? '').includes('text/html');
}
