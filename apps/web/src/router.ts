/**
 * Matching a URL against {@link ROUTES}, and nothing else.
 *
 * Written rather than taken from a library, which is the choice GO-2 left open. The register is
 * twelve closed paths with at most two dynamic segments, and AC-6 requires the router be built FROM
 * that register in any case — so a library would be adapted to the table rather than replacing it,
 * and this is about forty lines against a dependency on the cold-clone install path. The one thing
 * a router must not do is throw: a malformed percent-encoding is a URL a user can type, so it
 * resolves to the Not found view like any other unmatched path (AC-8).
 */
import { isRedirect, type Route, type ScreenRoute, ROUTES } from './routes.js';

/** What the shell should draw for a given path. */
export type Resolution =
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'screen'; readonly route: ScreenRoute; readonly params: Readonly<Record<string, string>> }
  | { readonly kind: 'not-found'; readonly path: string };

/** A resolution the shell can actually draw — everything {@link Resolution} holds but a redirect. */
export type DrawnResolution = Exclude<Resolution, { kind: 'redirect' }>;

/**
 * One path split into segments, with a trailing slash treated as absent.
 *
 * `/backlog/` and `/backlog` are the same route; `/` alone is the empty list, which is what makes
 * the redirect row match it.
 */
const segmentsOf = (path: string): string[] => path.split('/').filter((segment) => segment !== '');

/**
 * `decodeURIComponent` that answers rather than throwing.
 *
 * A segment like `%E0%A4%A` is a URI malformation, and the only thing a shell can honestly do with
 * one is decline to match it. Returning `null` is what carries that up to {@link resolve}.
 */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The parameters `path` supplies to `pattern`, or `null` where it does not match it at all.
 *
 * A `:name` segment matches any one segment and captures its decoded value; every other segment
 * must be equal. A segment that cannot be decoded fails the match rather than the process.
 */
function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const expected = segmentsOf(pattern);
  const actual = segmentsOf(path);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const supplied = actual[index];
    if (!segment.startsWith(':')) {
      if (segment !== supplied) return null;
      continue;
    }
    const decoded = decodeSegment(supplied);
    if (decoded === null) return null;
    params[segment.slice(1)] = decoded;
  }
  return params;
}

/**
 * What `path` resolves to, over `routes` — the register by default, an explicit table in a test.
 *
 * Never throws, and never reports a match it does not have: an unrecognised path, and a recognised
 * shape whose segments cannot be decoded, both answer `not-found` carrying the path as given, which
 * is what the Not found view shows.
 */
export function resolve(path: string, routes: readonly Route[] = ROUTES): Resolution {
  for (const route of routes) {
    const params = matchPattern(route.path, path);
    if (params === null) continue;
    return isRedirect(route) ? { kind: 'redirect', to: route.redirectTo } : { kind: 'screen', route, params };
  }
  return { kind: 'not-found', path };
}

/**
 * {@link resolve}, with a redirect followed to whatever is finally drawn.
 *
 * The shell needs both halves: what to render, and — where a redirect was followed — the address
 * the browser's own bar should be corrected to. Hops are bounded by the size of the register, so a
 * table that redirected in a circle stops and reports `not-found` rather than spinning; that is a
 * defect in the register and this is where it becomes visible instead of hanging a browser.
 */
export function resolveFinal(
  path: string,
  routes: readonly Route[] = ROUTES,
): { readonly rendered: DrawnResolution; readonly redirectedTo: string | null } {
  let at = path;
  let redirectedTo: string | null = null;
  for (let hop = 0; hop <= routes.length; hop += 1) {
    const resolution = resolve(at, routes);
    if (resolution.kind !== 'redirect') return { rendered: resolution, redirectedTo };
    at = resolution.to;
    redirectedTo = resolution.to;
  }
  return { rendered: { kind: 'not-found', path }, redirectedTo: null };
}

/**
 * The rail entry whose path the current location sits under, or `null`.
 *
 * Prefix rather than equality, so `/runs/<handle>` still lights the Runs entry — the rail is seven
 * entries and the register holds twelve paths, so most locations are below an entry rather than at
 * one. The boundary is a segment boundary, so `/harness` never lights an entry called `/har`.
 */
export function activeRailPath(path: string, paths: readonly string[]): string | null {
  const actual = segmentsOf(path);
  let best: string | null = null;
  for (const candidate of paths) {
    const expected = segmentsOf(candidate);
    if (expected.length > actual.length) continue;
    if (expected.some((segment, index) => segment !== actual[index])) continue;
    if (best === null || expected.length > segmentsOf(best).length) best = candidate;
  }
  return best;
}
