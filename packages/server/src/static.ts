/**
 * The daemon's static route: the built `apps/web` bundle, served from a root it is handed.
 *
 * **This is the first surface in this product that turns a URL into a file read**, from a process
 * with no authentication of any kind, which is why {@link confinedFile} is the centre of the module
 * rather than a detail of it and why it reuses `@quorum/core`'s primitive instead of resolving
 * anything here. `docs/GLOSSARY.md`'s **Confinement** — *"Enforced in `core`, so the CLI and M3's
 * server inherit one rule instead of each writing a weaker one"* — is that instruction; the bundle
 * root is the third declared root, after the backlog root and the run-history root.
 *
 * **The bundle root is supplied and never discovered.** Nothing here climbs to a repository, reads
 * `import.meta.url` or joins a path onto the working directory: `@hono/node-server`'s own
 * `serveStatic` documents its `root` as *"relative to current working directory from which the app
 * was started. Absolute paths are not supported"*, and the daemon's working directory is the
 * operator's project while the bundle's location is package-relative — two facts that cannot be
 * reconciled by a default. A caller that has one passes it; a caller that has none serves no UI,
 * which is a state rather than a failure.
 *
 * **The rule, stated once here and implemented once below.** In order:
 *
 * 1. A request naming a file that exists under the bundle root is answered with that file, whatever
 *    it asked to accept.
 * 2. Otherwise a `GET` or `HEAD` that is a top-level navigation is answered with `index.html`, and
 *    the shell's own Not found view is what tells a human the path is unknown. This is what makes a
 *    deep link such as `/runs/run-3` survive a reload.
 * 3. Otherwise the request falls through to the JSON routes and their 404s.
 * 4. A path that names a **file** and is absent from the build is a 404 and never `index.html` — a
 *    200 HTML answer for a missing script is a blank page with a successful status, which is the
 *    worst shape this could take.
 *
 * **`index.html` goes through {@link confinedFile} like every other file, and that is review round
 * 1's blocker.** It is the one path this route chooses rather than one a caller names, which is
 * exactly why it was the one exempted from the boundary: clause 2 read it through a `path.join`
 * computed once at mount, and {@link bundleRefusal} accepted it through a `statSync` that follows a
 * link — so an `index.html` symlinked out of the bundle passed startup and was then served, with a
 * `text/html` content type, on every navigation. A file a caller cannot name is still a file this
 * process reads, and the whole point of a confined root is that nothing inside the module gets to
 * decide it is exempt. Resolved **per request** rather than once, for the same reason clause 1 is:
 * a bundle is rebuilt while the daemon runs, so an answer computed at startup is an answer that was
 * true earlier.
 *
 * **Why it is registered ahead of the JSON routes rather than behind them.** Hono matches an exact
 * registered pattern, so prefix-shadowing is the dev proxy's problem and not this one — but four of
 * the shell's twelve paths ARE daemon `GET` routes: `/flows`, `/runs`, `/runs/:handle` against
 * `GET /runs/:id`, and `/history`. A handler that returns a response ends the chain, so a fallback
 * registered after them is never reached for those four and a reload at any of them 404s while
 * in-app navigation keeps working — Q-0120 review round 1's B-1, reproduced in the shipped product.
 * Sitting first and discriminating on the **request** rather than on the path is what avoids it, and
 * `next()` is what keeps every JSON route answering exactly what it answered before.
 *
 * Why: deliberate addition, not preservation — Q-0122.
 */
import fs from 'node:fs';
import path from 'node:path';

import { pathInside } from '@quorum/core';
import { isNavigationRequest } from '@quorum/shared';
import type { Context, Hono } from 'hono';

import type { Refusal } from './refusal.js';

/** The one file a built bundle must hold, and the answer to every navigation. */
export const BUNDLE_ENTRY = 'index.html';

/**
 * {@link BUNDLE_ENTRY} as a URL path, so the entry reaches {@link confinedFile} in the shape every
 * other file reaches it in — one function deciding what is inside the root, asked the same way.
 */
const ENTRY_PATH = `/${BUNDLE_ENTRY}`;

/**
 * What this surface offers a caller pointed at a directory that holds no build.
 *
 * A statement about what the directory has to contain rather than a command to type, for the reason
 * `refusal.ts` gives: the caller may be a browser, and this package composes no shell imperative.
 */
export const NO_BUNDLE_REMEDY = `run the web app's build task, so that ${BUNDLE_ENTRY} exists in that directory`;

/**
 * Content types by extension, for the shapes a Vite build of this app actually emits plus the
 * handful an `index.html` can reference.
 *
 * Deliberately a short closed table rather than a dependency. An unknown extension is served as
 * `application/octet-stream`, which a browser will not execute and will not render — the safe
 * answer for a file this table does not recognise, and never a guess at `text/html`.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/** The content type for a path this route is about to answer with. */
export function contentTypeOf(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Whether a URL path names a file rather than a screen — clause 4's discriminator.
 *
 * The last segment carrying a `.` is what separates `/assets/index-DyDp4y-o.js` from
 * `/runs/run-3`. It is a heuristic about URLs and is stated as one: a screen route with a dot in
 * its last segment would be answered 404 instead of with the shell. None of the shell's twelve
 * paths has one, `test/static.test.ts` asserts that over `ROUTES` rather than by eye, and the
 * failure if one ever does is a visible 404 rather than a silent blank page.
 */
export function looksLikeAFile(urlPath: string): boolean {
  return path.posix.basename(urlPath).includes('.');
}

/**
 * The file `urlPath` names inside `bundle`, or `null` when it names anything else.
 *
 * **Every refusal in this function is a refusal to read**, and they are separate because they fail
 * for different reasons. A path the URL layer cannot decode is refused rather than passed on as
 * bytes — `%2e%2e%2f` is `../` and a decoder that threw halfway would otherwise leave a caller
 * deciding what a half-decoded string meant. A decoded path is then handed to `pathInside`, which
 * is the whole of the boundary: it collapses `..` and repeated separators through `path.join`,
 * compares component by component so `/x/dist-old` is not inside `/x/dist`, resolves the leaf with
 * `realpathSync` so a symlink pointing out of the bundle is refused rather than followed, and
 * refuses a name that stands there and resolves to nothing — the **dangling** symlink that was
 * Q-0059's round-2 blocker, where a lexical test plus an existence check would have let a write
 * create its own target outside the root. Nothing is added to that here.
 *
 * A directory is not a file, so `/assets` answers `null` and there is no listing of any kind.
 */
export function confinedFile(bundle: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  // A NUL truncates a path at the syscall boundary, so a name carrying one is refused before it
  // reaches anything that would open it rather than being silently shortened.
  if (decoded.includes('\0')) return null;
  const relative = decoded.replace(/^\/+/, '');
  if (relative === '') return null;
  const full = pathInside(bundle, relative);
  if (full === null) return null;
  return fs.statSync(full, { throwIfNoEntry: false })?.isFile() === true ? full : null;
}

/**
 * Whether `bundle` holds a build this route may serve, or the refusal saying it does not.
 *
 * Asked once, before a listener is bound, so a daemon pointed at the wrong directory says so at
 * startup instead of answering 404 at `/` to somebody who opened a browser. It asks for the entry
 * file rather than for the directory: a `dist/` that exists and is empty is the shape a cleaned
 * checkout has, and it is the one this most needs to catch.
 *
 * **Through {@link confinedFile} rather than `statSync`**, so startup and the route ask one question
 * of one primitive and neither can accept what the other refuses — a `stat` follows a link, and an
 * entry resolving outside the supplied root is not a build this server may serve. The condition is
 * that predicate rather than a sentence per case: *"is not a file inside that directory"* is what
 * was asked, and is true of an absent entry and of an escaping one alike.
 */
export function bundleRefusal(bundle: string): Refusal | null {
  if (confinedFile(bundle, ENTRY_PATH) !== null) return null;
  return {
    condition: `no built web app at ${bundle}: ${BUNDLE_ENTRY} is not a file inside that directory`,
    remedy: NO_BUNDLE_REMEDY,
  };
}

/**
 * Register the static route on `app`, ahead of everything else it will carry.
 *
 * Registered with `app.get` and a quoted literal deliberately: `packages/server/src/package.test.ts`
 * derives the route register from `app.<method>(` calls with a literal first argument and **does not
 * match `app.use` at all**, so a middleware mount would be invisible to the guard that holds the
 * route set against `docs/04-architecture.md`. `'/*'` is a literal that guard can read, which is
 * why the route appears there as `GET /*`.
 *
 * @param app the app to register on, before any other route.
 * @param bundle the directory holding the built app, or `undefined` to serve none.
 * @returns the same app, so this composes with the other mounts.
 */
export function mountStatic(app: Hono, bundle: string | undefined): Hono {
  if (bundle === undefined) return app;
  app.get('/*', async (c, next) => {
    const file = confinedFile(bundle, c.req.path);
    if (file !== null) return sendFile(c, file);
    // Clause 4 before clause 2: a missing `.js` under `/assets/` is a 404 whatever it accepts, so a
    // script tag never receives the shell with a 200 and a browser never renders a blank page.
    if (!looksLikeAFile(c.req.path) && isNavigationRequest(c.req.method, c.req.header('accept'))) {
      // The entry is resolved here rather than at mount, and through the same boundary as any other
      // file: see the module docblock's clause 2. An entry that is gone or has become a link out of
      // the bundle leaves nothing to answer a navigation with, so the request is one this route
      // cannot serve and clause 3 takes it — `next()`, and the JSON routes' own 404.
      const entry = confinedFile(bundle, ENTRY_PATH);
      if (entry !== null) return sendFile(c, entry);
    }
    await next();
    return undefined;
  });
  return app;
}

/**
 * Answer with a file's bytes, or with a 404 if it went between the check and the read.
 *
 * Read whole rather than streamed: this bundle is measured in hundreds of kilobytes, a stream would
 * need its own error path on a socket that has already been given a status, and a local daemon
 * serving one browser is not where that complexity earns anything. `HEAD` is answered by the same
 * handler with the body dropped, so the two cannot report different statuses or content types.
 */
function sendFile(c: Context, file: string): Response {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    // Between `statSync` and here the file can go. Reported as absent rather than as a 500: what a
    // caller can act on is that it is not there, and a stack from a daemon is not that.
    return c.body(null, 404);
  }
  const headers = { 'content-type': contentTypeOf(file), 'content-length': String(bytes.byteLength) };
  if (c.req.method === 'HEAD') return c.body(null, 200, headers);
  return c.body(new Uint8Array(bytes), 200, headers);
}
