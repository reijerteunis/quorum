/**
 * Q-0122 AC-12 to AC-20 — the daemon serves the built web app, and serves nothing else.
 *
 * **Everything here runs over a real socket, and the reason is the subject.** The four route
 * collisions this guards against are a property of handler ORDER inside one app, and the confinement
 * half is a property of what a raw request line can carry. Both are things an in-process call to
 * `app.fetch` with a `URL` would normalise away — `new URL('http://x/../y')` is `http://x/y` before
 * anything sees it — so a suite that drove the app in process could report every traversal refused
 * while never sending one. `request()` below writes the path onto the request line unaltered.
 *
 * **The bundle is built here rather than read from `apps/web/dist`.** That directory is gitignored
 * and may not exist, so asserting over it would make this file's verdict a property of whether
 * somebody had run a build — *"A test's verdict is a property of the commit, not of the checkout or
 * the account"* (2026-08-30). What is read out of `apps/web` is its **route register**, which is
 * tracked source, and reading it rather than transcribing twelve paths is AC-14's own instruction.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { Hono } from 'hono';

import { isNavigationRequest } from '@quorum/shared';

import { createRunHost } from './host.js';
import { BIND_HOSTNAME, serve } from './serve.js';
import type { ConfinedFile } from './static.js';
import {
  BUNDLE_ENTRY, bundleRefusal, confinedFile, contentTypeOf, looksLikeAFile, mountStatic,
  NO_BUNDLE_REMEDY, readConfined,
} from './static.js';
import { createApp } from './http.js';
import { mountRead } from './read.js';
import { fixture, removeTempDirs, tempDir, write } from '../test/fixture.js';

afterAll(removeTempDirs);

/** The workspace root, reached from this file rather than by climbing to a repository. */
const WORKSPACE = path.resolve(import.meta.dirname, '..', '..', '..');

const repoFile = (relative: string): string => fs.readFileSync(path.join(WORKSPACE, relative), 'utf8');

/**
 * `source` with its comments blanked, for the scans that are about what a module DOES.
 *
 * Written because the first version of the clause below reported `static.ts` as computing its own
 * bundle root, on the strength of its own docblock saying it does not — a guard talked into firing
 * by text it does not execute, which is Q-0079's first review finding in the opposite direction.
 * Blanking rather than deleting keeps offsets, and the direction it can fail in is the safe one:
 * a needle inside a string literal is still found, so the scan can over-report and not under.
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** The body of `index.html` in the fixture bundle — distinctive, so "is this the shell?" is exact. */
const SHELL = '<!doctype html><html><head><title>Quorum</title></head><body>q0122-shell</body></html>';

/** A directory shaped like a Vite build of this app: an entry, a script and a stylesheet. */
function bundle(): string {
  const root = tempDir('bundle-');
  write(path.join(root, BUNDLE_ENTRY), SHELL);
  write(path.join(root, 'assets', 'index-abc.js'), 'export const app = 1;\n');
  write(path.join(root, 'assets', 'index-abc.css'), ':root { color: red }\n');
  return root;
}

/**
 * What `confinedFile` approved, or a failure naming what it was asked.
 *
 * The swap tests below are only about anything if the check PASSED first: a `null` travelling into
 * them would make every refusal they assert a refusal of something that was never admitted.
 */
function approved(root: string, urlPath: string): ConfinedFile {
  const file = confinedFile(root, urlPath);
  if (file === null) throw new Error(`the check refused ${urlPath} before anything was swapped`);
  return file;
}

/** One raw HTTP response: the parts these assertions read. */
interface Answer {
  readonly status: number;
  readonly type: string;
  readonly length: string;
  readonly body: string;
}

/**
 * One request, with `path` written onto the request line **unaltered**.
 *
 * `fetch` builds a `URL`, and a `URL` resolves dot segments before a byte leaves the process — so
 * the traversal half of AC-17 would be testing the WHATWG URL parser rather than this route. Node's
 * client sends what it is given.
 */
function request(port: number, urlPath: string, options: { method?: string; accept?: string } = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (options.accept !== undefined) headers.accept = options.accept;
    const req = http.request(
      { host: BIND_HOSTNAME, port, path: urlPath, method: options.method ?? 'GET', headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers['content-type'] ?? ''),
            length: String(res.headers['content-length'] ?? ''),
            body,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** A listening daemon over a throwaway repository, with or without a bundle to serve. */
async function listening(options: { bundle?: string } = {}) {
  const project = fixture({});
  const host = createRunHost({ project: project.project, retain: 100 });
  const server = await serve({ host, bundle: options.bundle });
  return {
    port: server.port,
    stop: async (): Promise<void> => { await host.shutdown(); await server.close(); },
  };
}

/** What a browser sends on a page load, near enough that the predicate sees what it sees. */
const NAVIGATION = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/**
 * Every path the shell recognises, read out of `apps/web/src/routes.ts` rather than transcribed.
 *
 * **Read as text, not imported.** `packages/server` may not import `apps/web` in either direction:
 * the dependency direction is one-way and this package is not a consumer of the app it serves. What
 * makes reading it legal is that it is tracked source — and the read is declared in
 * `packages/server/turbo.json`, because nothing else in this task's input closure covers it.
 *
 * A `:param` segment is given a literal, since what is being asked is whether the SHAPE survives a
 * reload; a router matches `/runs/:handle` and a browser only ever asks for `/runs/run-3`.
 */
function shellPaths(): string[] {
  const source = repoFile('apps/web/src/routes.ts');
  const block = /export const ROUTES: readonly Route\[\] = \[([\s\S]*?)\n\];/.exec(source)?.[1] ?? '';
  const paths = [...block.matchAll(/\bpath:\s*(?:'([^']+)'|(HOME_PATH))/g)]
    .map((match) => match[1] ?? '/projects');
  return paths.map((entry) => entry.replace(/:[A-Za-z]+/g, 'q0122'));
}

describe('Q-0122 AC-12 — the bundle root is supplied, never discovered, and its absence is a state', () => {
  test('with no bundle the daemon serves no HTML at all, at any path, however it is asked', async () => {
    const { port, stop } = await listening();
    try {
      for (const urlPath of ['/', '/projects', '/runs/run-1', '/index.html', '/assets/index-abc.js']) {
        const answer = await request(port, urlPath, { accept: NAVIGATION });
        expect(answer.type, `${urlPath} answered HTML from a daemon with no bundle`).not.toContain('text/html');
        expect(answer.body, `${urlPath} answered the shell from a daemon with no bundle`).not.toContain('q0122-shell');
      }
      // And the JSON surface is untouched: a daemon with no UI is the daemon that existed before
      // this ticket, which is what makes the option's absence a state rather than a degraded mode.
      const project = await request(port, '/project', { accept: 'application/json' });
      expect(project.status).toBe(200);
      expect(project.type).toContain('application/json');
    } finally {
      await stop();
    }
  });

  test('and nothing in the route computes where a bundle might be', () => {
    // The criterion's word is *supplied*. A module that could work it out would work it out
    // differently from whoever launched the daemon: `@hono/node-server`'s own `serve-static`
    // documents its root as *"relative to current working directory from which the app was
    // started"*, and the daemon's working directory is the operator's project while the bundle's
    // location is package-relative. So the absence of these four is the criterion, not tidiness.
    const source = codeOnly(repoFile('packages/server/src/static.ts'));
    for (const spelling of ['import.meta.url', 'import.meta.dirname', 'process.cwd(', '__dirname']) {
      expect(source.includes(spelling), `static.ts reaches for ${spelling} instead of being told`).toBe(false);
    }
    // Anti-vacuity in both directions. The blanking must not have removed the module: a strip that
    // ate everything would satisfy every clause above.
    expect(source, 'the comment strip removed the code as well').toContain('export function confinedFile');
    // …and the same needles find one where one is written, in code rather than in prose.
    expect(['import.meta.url', 'process.cwd(']
      .filter((s) => codeOnly('const here = import.meta.url; const cwd = process.cwd();').includes(s)))
      .toHaveLength(2);
    // …and the strip is what makes this clause different from reading the file, demonstrated on the
    // exact sentence that made its first version fail: the docblock names the spelling it forbids.
    expect(repoFile('packages/server/src/static.ts'), 'the docblock no longer names what it forbids')
      .toContain('import.meta.url');
  });
});

describe('Q-0122 AC-13 — a supplied root holding no build refuses before anything binds', () => {
  test('the refusal names the missing output and what to do, and is not a 404 later', async () => {
    const empty = tempDir('no-build-');
    await expect(serve({ host: createRunHost({ project: fixture({}).project, retain: 10 }), bundle: empty }))
      .rejects.toThrow(BUNDLE_ENTRY);
    await expect(serve({ host: createRunHost({ project: fixture({}).project, retain: 10 }), bundle: empty }))
      .rejects.toThrow(NO_BUNDLE_REMEDY);
    // A directory that exists and is empty is the shape a cleaned checkout has, which is the case
    // this most has to catch — so the check asks for the entry file rather than for the directory.
    expect(fs.existsSync(empty)).toBe(true);
    expect(bundleRefusal(empty)?.condition).toContain(empty);
    expect(bundleRefusal(bundle()), 'a real bundle was refused').toBeNull();
  });

  test('and it binds no listener — proven by refusing on a port that is already taken', async () => {
    // The discriminating fixture: a port somebody else holds. If the bundle check happened after
    // the bind, this would reject with `EADDRINUSE`; it rejects naming `index.html` instead, so the
    // listener was never attempted. A daemon that bound first would print a port and then answer
    // 404 at `/` to somebody who had already opened a browser.
    const held = await listening();
    try {
      const empty = tempDir('no-build-port-');
      const attempt = serve({
        host: createRunHost({ project: fixture({}).project, retain: 10 }),
        bundle: empty,
        port: held.port,
      });
      await expect(attempt).rejects.toThrow(BUNDLE_ENTRY);
      await expect(attempt).rejects.not.toThrow('EADDRINUSE');
      // The holder still answers, which is what says nothing displaced it.
      expect((await request(held.port, '/project', { accept: 'application/json' })).status).toBe(200);
    } finally {
      await held.stop();
    }
  });
});

describe('Q-0122 AC-14 — every path the shell recognises survives a reload', () => {
  test('the register this reads has a subject, and it is the shell\'s own', () => {
    // Without this a regex that matched nothing would make the clause below pass over an empty
    // list — and the four that matter most are the ones that collide with a daemon route.
    const paths = shellPaths();
    expect(paths, 'apps/web/src/routes.ts yielded no path — this clause has lost its subject').toHaveLength(12);
    for (const collides of ['/flows', '/runs', '/runs/q0122', '/history']) {
      expect(paths, `the register no longer holds ${collides}, which is one of the four collisions`).toContain(collides);
    }
    expect(paths, 'the redirect at the root is not in the set').toContain('/');
  });

  test('all twelve answer the shell over a real socket', async () => {
    const { port, stop } = await listening({ bundle: bundle() });
    try {
      for (const urlPath of shellPaths()) {
        const answer = await request(port, urlPath, { accept: NAVIGATION });
        expect(answer.status, `${urlPath} did not answer a navigation`).toBe(200);
        expect(answer.type, `${urlPath} answered a navigation with ${answer.type}`).toContain('text/html');
        expect(answer.body, `${urlPath} answered something that is not the shell`).toContain('q0122-shell');
      }
    } finally {
      await stop();
    }
  });

  test('and it is shown RED against a fallback registered after the JSON routes', async () => {
    // **Q-0120 review round 1's B-1, reproduced in the shipped product's own shape.** A handler
    // that returns a response ends the chain, so a static route registered last is never reached
    // for a path a JSON route already claims. Built here as an app rather than argued: same
    // handler, same bundle, one difference — the order it was registered in.
    const root = bundle();
    const project = fixture({});
    const host = createRunHost({ project: project.project, retain: 10 });
    const wrong = mountStatic(mountRead(createApp({ host }), project.project), root);
    const answers = await Promise.all(shellPaths().map(async (urlPath) => {
      const response = await wrong.fetch(new Request(`http://${BIND_HOSTNAME}${urlPath}`, { headers: { accept: NAVIGATION } }));
      return [urlPath, response.status, response.headers.get('content-type') ?? ''] as const;
    }));
    const notTheShell = answers.filter(([, , type]) => !type.includes('text/html')).map(([urlPath]) => urlPath);
    // Exactly the four the requirement measured, named rather than counted: a count would be
    // satisfied by four different ones.
    expect(notTheShell.sort(), 'the late registration no longer loses the four colliding routes')
      .toStrictEqual(['/flows', '/history', '/runs', '/runs/q0122']);
    await host.shutdown();
  });
});

describe('Q-0122 AC-15 — nothing that is not a navigation is given HTML', () => {
  test('the daemon\'s own routes answer byte for byte what they answer with no bundle', async () => {
    // The strongest available form of *"exactly what they answer today"*: two daemons over two
    // fresh repositories, one serving a bundle and one not, asked the same questions. A regression
    // in the static route shows up as a difference rather than as an assertion somebody has to have
    // predicted.
    const withUi = await listening({ bundle: bundle() });
    const without = await listening();
    try {
      // Eight of the eleven: the seven `GET`s Q-0119 and Q-0121 registered, plus the socket route
      // asked without an upgrade, which is the one a static handler in front of it could swallow.
      const routes = ['/project', '/tickets', '/flows', '/history', '/history/nope', '/runs', '/runs/nope', '/runs/nope/events'];
      for (const accept of ['application/json', '*/*']) {
        for (const urlPath of routes) {
          const a = await request(withUi.port, urlPath, { accept });
          const b = await request(without.port, urlPath, { accept });
          expect({ path: urlPath, accept, status: a.status, type: a.type })
            .toStrictEqual({ path: urlPath, accept, status: b.status, type: b.type });
          expect(a.type, `${urlPath} answered HTML under ${accept}`).not.toContain('text/html');
        }
      }
      // And the three `POST`s, which `app.get('/*')` cannot reach by construction — asserted rather
      // than reasoned, because "cannot reach by construction" is the claim a method-scoped route
      // makes and this is what would fail if the handler were ever widened to `app.all`. Driven
      // with a body each route refuses, so the answer is a refusal both daemons must compose
      // identically rather than a run one of them started.
      for (const urlPath of ['/runs', '/runs/nope/gate', '/runs/nope/stop']) {
        const post = async (port: number): Promise<{ status: number; body: string }> => {
          const response = await fetch(`http://${BIND_HOSTNAME}:${String(port)}${urlPath}`, {
            method: 'POST', headers: { 'content-type': 'application/json', accept: NAVIGATION }, body: '{}',
          });
          return { status: response.status, body: await response.text() };
        };
        const a = await post(withUi.port);
        expect({ path: urlPath, ...a }).toStrictEqual({ path: urlPath, ...(await post(without.port)) });
        expect(a.body, `${urlPath} answered the shell to a POST`).not.toContain('q0122-shell');
      }
    } finally {
      await withUi.stop();
      await without.stop();
    }
  });

  test('a HEAD matches its GET and carries no body', async () => {
    const { port, stop } = await listening({ bundle: bundle() });
    try {
      for (const urlPath of ['/index.html', '/assets/index-abc.js', '/runs/run-3']) {
        const get = await request(port, urlPath, { accept: NAVIGATION });
        const head = await request(port, urlPath, { method: 'HEAD', accept: NAVIGATION });
        expect(head.status, `HEAD ${urlPath}`).toBe(get.status);
        expect(head.type, `HEAD ${urlPath}`).toBe(get.type);
        expect(head.length, `HEAD ${urlPath} reports a different length from its GET`).toBe(get.length);
        expect(head.body, `HEAD ${urlPath} carried a body`).toBe('');
        expect(get.body.length, `GET ${urlPath} carried no body, so the comparison proves nothing`).toBeGreaterThan(0);
      }
    } finally {
      await stop();
    }
  });

  test('the WebSocket still upgrades past the static route', async () => {
    // The route the static handler sits in front of and must not answer: an upgrade is a GET, and
    // one that received `index.html` would be a run nobody can watch. Asked at the protocol level
    // rather than through a client, because what is being proven is that the request reached the
    // upgrade handler at all.
    const { port, stop } = await listening({ bundle: bundle() });
    try {
      const status = await new Promise<number>((resolve, reject) => {
        const req = http.request({
          host: BIND_HOSTNAME, port, path: '/runs/nope/events', method: 'GET',
          headers: {
            connection: 'Upgrade', upgrade: 'websocket',
            'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13',
          },
        });
        req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode ?? 101); });
        req.on('response', (res) => { res.resume(); resolve(res.statusCode ?? 0); });
        req.on('error', reject);
        req.end();
      });
      expect(status, 'the upgrade did not reach the WebSocket route').toBe(101);
    } finally {
      await stop();
    }
  });
});

describe('Q-0122 AC-16 — a file that is not in the build is a 404, never the shell', () => {
  test('a missing script answers 404 even when it asks for HTML', async () => {
    // A 200 HTML answer for a missing script is a blank page with a successful status, which is
    // the worst shape this could take: the browser reports nothing wrong and renders nothing.
    const { port, stop } = await listening({ bundle: bundle() });
    try {
      for (const urlPath of ['/assets/gone.js', '/assets/gone.css', '/favicon.ico', '/assets/index-abc.js.map']) {
        for (const accept of [NAVIGATION, 'application/json', '*/*']) {
          const answer = await request(port, urlPath, { accept });
          expect(answer.status, `${urlPath} under ${accept}`).toBe(404);
          expect(answer.body, `${urlPath} was answered with the shell`).not.toContain('q0122-shell');
        }
      }
      // …and the discriminator is exercised in both directions, so the clause is not passing
      // because everything 404s: the file that IS there is served under every one of them.
      for (const accept of [NAVIGATION, 'application/json', '*/*']) {
        const answer = await request(port, '/assets/index-abc.js', { accept });
        expect(answer.status, `an existing asset under ${accept}`).toBe(200);
        expect(answer.type).toContain('text/javascript');
      }
    } finally {
      await stop();
    }
  });

  test('and the file-vs-screen discriminator does not misread any path the shell owns', () => {
    // The heuristic is a dot in the last segment, and the risk it carries is a screen route with
    // one — that route would 404 instead of reloading. Asked of the register rather than by eye.
    expect(shellPaths().filter(looksLikeAFile), 'a shell route looks like a file and would 404 on reload')
      .toStrictEqual([]);
    expect(looksLikeAFile('/assets/index-abc.js')).toBe(true);
    expect(looksLikeAFile('/runs/run-3')).toBe(false);
    expect(looksLikeAFile('/')).toBe(false);
  });
});

describe('Q-0122 AC-17 — no path outside the bundle root is served', () => {
  test('traversal is refused in every encoding, over a real request line', async () => {
    const root = bundle();
    // The secret sits beside the bundle rather than inside it, so a traversal that worked would
    // return something recognisable rather than merely a different 404.
    const outside = path.join(path.dirname(root), 'q0122-secret.txt');
    fs.writeFileSync(outside, 'q0122-outside-the-bundle');
    const { port, stop } = await listening({ bundle: root });
    try {
      const escapes = [
        `/../${path.basename(outside)}`,
        `/%2e%2e/${path.basename(outside)}`,
        `/%2E%2E%2F${path.basename(outside)}`,
        `/..%2f${path.basename(outside)}`,
        `/assets/../../${path.basename(outside)}`,
        `//..//${path.basename(outside)}`,
        `/assets/./../../${path.basename(outside)}`,
        `/%2e%2e%2f%2e%2e%2f${path.basename(outside)}`,
      ];
      for (const urlPath of escapes) {
        const answer = await request(port, urlPath, { accept: 'application/json' });
        expect(answer.body, `${urlPath} served a file outside the bundle`).not.toContain('q0122-outside-the-bundle');
      }
      // The fixture is real: the same bytes are reachable through the filesystem, so the refusals
      // above are refusals rather than a file that was never there.
      expect(fs.readFileSync(outside, 'utf8')).toContain('q0122-outside-the-bundle');
    } finally {
      await stop();
    }
  });

  test('a symlink pointing out of the bundle is refused, and so is a dangling one', () => {
    // Asked of `confinedFile` directly as well as over the socket, because these two are the
    // clauses `pathInside` contributes and they are worth naming: `realpathSync` on the leaf is
    // what refuses the first, and *"a name that stands there and resolves to nothing"* is what
    // refuses the second. A dangling link was Q-0059's round-2 blocker, where a lexical test plus
    // an existence check let a write create its own target outside the root.
    const root = bundle();
    const outside = path.join(path.dirname(root), 'q0122-linked.txt');
    fs.writeFileSync(outside, 'q0122-outside-the-bundle');
    fs.symlinkSync(outside, path.join(root, 'escape.txt'));
    fs.symlinkSync(path.join(path.dirname(root), 'q0122-nothing-here.txt'), path.join(root, 'dangling.txt'));

    expect(confinedFile(root, '/escape.txt'), 'a symlink out of the bundle was followed').toBeNull();
    expect(confinedFile(root, '/dangling.txt'), 'a dangling symlink was accepted').toBeNull();

    // **The two clauses are not equally load-bearing here, and saying so is worth more than the
    // assertion above.** Measured by replacing `pathInside` with the lexical check it exists to
    // refuse — `path.join` plus a `startsWith`: the escaping link is then FOLLOWED and this test
    // goes red naming it, while the dangling one stays refused, because a read path asks
    // `statSync(...).isFile()` and a link to nothing does not stat. So confinement is what catches
    // the first and the read itself would catch the second. The dangling clause is kept because
    // the criterion names it and because the two are one primitive, but it is **over-determined on
    // this route** and a reader should not take its green as evidence that confinement is what
    // produced it. Where it is load-bearing is a WRITE — an open with `O_CREAT` follows a dangling
    // link and creates its target outside the root, which was Q-0059's round-2 blocker — and this
    // route never writes.
    const dangling = path.join(root, 'dangling.txt');
    expect(fs.lstatSync(dangling).isSymbolicLink(), 'the dangling fixture is not a link').toBe(true);
    expect(fs.statSync(dangling, { throwIfNoEntry: false }), 'the dangling link resolves after all')
      .toBeUndefined();
    // …against the file beside them that IS served, so the two nulls are refusals rather than a
    // function that answers null for everything.
    expect(confinedFile(root, '/assets/index-abc.js')?.path).toContain('index-abc.js');
    expect(confinedFile(root, `/${BUNDLE_ENTRY}`)?.path).toContain(BUNDLE_ENTRY);
  });

  test('and the entry itself is confined: an index.html linked out of the bundle is refused, never served', async () => {
    // **Review round 1's blocker, as a fixture.** `index.html` is the one path this route chooses
    // rather than one a caller names, and it was the one exempted from the boundary: clause 2 read
    // it through a `path.join` computed at mount and `bundleRefusal` accepted it through a
    // `statSync`, which follows a link. So a bundle whose entry resolved outside the supplied root
    // passed startup and was then handed out, as `text/html`, on every navigation — while a direct
    // `GET /index.html` for the same file was correctly refused, which is the inconsistency that
    // says the exemption was the defect rather than the policy.
    const root = tempDir('escaped-entry-');
    const outside = path.join(path.dirname(root), 'q0122-outside-shell.html');
    fs.writeFileSync(outside, '<!doctype html><body>q0122-outside-the-bundle</body>');
    fs.symlinkSync(outside, path.join(root, BUNDLE_ENTRY));
    write(path.join(root, 'assets', 'index-abc.js'), 'export const app = 1;\n');
    // The fixture discriminates: a link-following `stat` reads this directory as holding a build,
    // so what refuses it below is confinement and not an entry that was never there.
    expect(fs.statSync(path.join(root, BUNDLE_ENTRY)).isFile(), 'the linked entry does not stat as a file')
      .toBe(true);
    expect(fs.lstatSync(path.join(root, BUNDLE_ENTRY)).isSymbolicLink(), 'the fixture entry is not a link')
      .toBe(true);

    // (1) Startup refuses it, naming the condition it actually found.
    expect(bundleRefusal(root), 'a bundle whose entry resolves outside it was accepted at startup').not.toBeNull();
    expect(bundleRefusal(root)?.condition).toContain(BUNDLE_ENTRY);
    await expect(serve({ host: createRunHost({ project: fixture({}).project, retain: 10 }), bundle: root }))
      .rejects.toThrow(BUNDLE_ENTRY);

    // (2) …and the route refuses it on its own, asked without the startup check in front of it.
    // The two are separate defences and a fixture that only proved the first would leave the
    // handler free to serve what startup happened to have rejected.
    const escaped = mountStatic(new Hono(), root);
    const navigation = await escaped.request('/runs/run-3', { headers: { accept: NAVIGATION } });
    expect(await navigation.text(), 'a navigation was answered with a file outside the bundle')
      .not.toContain('q0122-outside-the-bundle');
    expect(navigation.status, 'a navigation with no servable entry did not fall through to clause 3').toBe(404);
    // …against the same instrument over a real bundle, so the 404 above is a refusal rather than a
    // handler that never answers a navigation at all.
    const served = await mountStatic(new Hono(), bundle()).request('/runs/run-3', { headers: { accept: NAVIGATION } });
    expect(served.status).toBe(200);
    expect(await served.text()).toContain('q0122-shell');
  });

  test('and the entry is resolved per request, so a link swapped in under a running daemon is refused', async () => {
    // What makes *per request* load-bearing rather than incidental: a bundle is rebuilt while the
    // daemon runs, so an entry confined once at mount is an answer that was true earlier. Against a
    // mount-time resolution this clause goes red and the clause above still passes.
    const live = bundle();
    const outside = path.join(path.dirname(live), 'q0122-swapped-shell.html');
    fs.writeFileSync(outside, '<!doctype html><body>q0122-outside-the-bundle</body>');
    const { port, stop } = await listening({ bundle: live });
    try {
      expect((await request(port, '/runs/run-3', { accept: NAVIGATION })).body, 'the daemon did not serve the shell to begin with')
        .toContain('q0122-shell');
      fs.unlinkSync(path.join(live, BUNDLE_ENTRY));
      fs.symlinkSync(outside, path.join(live, BUNDLE_ENTRY));
      const after = await request(port, '/runs/run-3', { accept: NAVIGATION });
      expect(after.body, 'the entry was resolved once at mount, so a link swapped in later was served')
        .not.toContain('q0122-outside-the-bundle');
    } finally {
      await stop();
    }
  });

  test('and the check and the read name one file: a leaf swapped between them is refused', () => {
    // **Review round 2's blocker, as a fixture.** Confinement decides where a path is *at the moment
    // it is checked* — `docs/GLOSSARY.md` says that in as many words — so a boundary that hands the
    // read a NAME lets the name be resolved a second time, and the second resolution was never
    // approved by the first. Deterministic rather than timed: the check and the read are two calls
    // here and the swap happens between them, on this thread, with nothing racing.
    //
    // At unit level for the same reason the symlink clause above is: what is being asked is which
    // of the module's two steps refuses, and a socket puts one request across both of them.
    const root = bundle();
    const outside = path.join(path.dirname(root), 'q0122-swapped-asset.js');
    fs.writeFileSync(outside, 'q0122-outside-the-bundle');
    const asset = path.join(root, 'assets', 'index-abc.js');

    const file = approved(root, '/assets/index-abc.js');
    expect(readConfined(file)?.toString('utf8'), 'the approved asset was not readable before the swap')
      .toContain('export const app');

    // The swap: the leaf becomes a link out of the bundle, after the check and before the read.
    fs.unlinkSync(asset);
    fs.symlinkSync(outside, asset);
    // The fixture discriminates — the swapped name still stats as a file, so what refuses the read
    // below is the identity comparison and not a path that stopped resolving.
    expect(fs.statSync(asset).isFile(), 'the swapped leaf does not stat as a file').toBe(true);

    expect(readConfined(file), 'the read resolved the name a second time and followed the new link')
      .toBeNull();
    // …and what the previous shape did, in one line, kept as a demonstration rather than as a
    // sentence about a commit nobody can run: reading the NAME hands back the outside bytes.
    expect(fs.readFileSync(file.path, 'utf8'), 'the fixture no longer reproduces the defect')
      .toContain('q0122-outside-the-bundle');
  });

  test('and a parent directory swapped between them is refused too, which no open flag covers', () => {
    // The half an `O_NOFOLLOW` open cannot reach: that flag governs the LAST component, and Node
    // exposes no `openat` to walk the rest, so a directory replaced after the check is followed by
    // any open of the name. Holding the descriptor against the identity that was approved is what
    // answers this one, which is why the boundary is built from a comparison rather than a flag.
    const root = bundle();
    const elsewhere = tempDir('outside-assets-');
    write(path.join(elsewhere, 'index-abc.js'), 'q0122-outside-the-bundle');

    const file = approved(root, '/assets/index-abc.js');
    const assets = path.join(root, 'assets');
    fs.renameSync(assets, path.join(root, 'assets-moved'));
    fs.symlinkSync(elsewhere, assets);

    // The swap took: the same name now reaches a file outside the bundle entirely.
    expect(fs.readFileSync(file.path, 'utf8'), 'the parent swap did not take')
      .toContain('q0122-outside-the-bundle');
    expect(readConfined(file), 'a parent replaced after the check was followed').toBeNull();
  });

  test('and the module performs exactly one read, on the descriptor it checked', () => {
    // An identity rather than a count (Q-0073): a second `readFileSync` anywhere in this module is
    // a second resolution of a name, which is the defect above however carefully it is written. The
    // argument list is what the clause is about — `readFileSync(handle)` is the approved descriptor
    // and `readFileSync(file.path)` is the name, and only the first may appear.
    const code = codeOnly(repoFile('packages/server/src/static.ts'));
    expect([...code.matchAll(/readFileSync\s*\(([^)]*)\)/g)].map((match) => match[1]?.trim()))
      .toStrictEqual(['handle']);
    // …and the scan discriminates rather than merely matching: over the shape it forbids it yields
    // a different argument, which is what makes the equality above a check and not a spelling.
    expect([...codeOnly('const b = fs.readFileSync(file.path);').matchAll(/readFileSync\s*\(([^)]*)\)/g)]
      .map((match) => match[1]?.trim()))
      .toStrictEqual(['file.path']);
  });

  test('and the shapes below a file are refused too — a directory, an empty path, a NUL', () => {
    const root = bundle();
    expect(confinedFile(root, '/assets'), 'a directory was served').toBeNull();
    expect(confinedFile(root, '/'), 'the root was served as a file').toBeNull();
    expect(confinedFile(root, '/index%00.html'), 'a NUL reached the filesystem').toBeNull();
    expect(confinedFile(root, '/%zz'), 'an undecodable path was passed on as bytes').toBeNull();
    expect(confinedFile(root, '///assets///index-abc.js')?.path, 'repeated separators are not collapsed')
      .toContain('index-abc.js');
  });

  test('the content type of an unknown extension is never text/html', () => {
    // The other half of *"never the shell"*: a file this table does not recognise is served as
    // bytes a browser will not execute and will not render, rather than guessed at.
    expect(contentTypeOf('/x/thing.unknown')).toBe('application/octet-stream');
    expect(contentTypeOf('/x/thing')).toBe('application/octet-stream');
    expect(contentTypeOf('/x/a.js')).toContain('text/javascript');
    expect(contentTypeOf('/x/a.HTML'), 'the extension match is case sensitive').toContain('text/html');
  });
});

describe('Q-0122 AC-18 — the navigation predicate has exactly one definition', () => {
  test('it is declared in @quorum/shared, and that module imports nothing', () => {
    const source = repoFile('packages/shared/src/navigation.ts');
    expect(source).toContain('export function isNavigationRequest');
    // "importing neither" is the criterion's own phrase, and the strongest form of it is that this
    // module imports nothing at all — which is what lets both ends reach it, since `packages/server`
    // may not import `apps/web` and `apps/web` may not import `packages/server`.
    expect(/^\s*import\s/m.test(source), 'the shared predicate imports something').toBe(false);
    expect(typeof isNavigationRequest, 'the barrel does not carry it').toBe('function');
  });

  test('both ends reach that one definition and neither writes its own', () => {
    const ends = {
      'apps/web/vite.config.ts': repoFile('apps/web/vite.config.ts'),
      'packages/server/src/static.ts': repoFile('packages/server/src/static.ts'),
    };
    for (const [file, source] of Object.entries(ends)) {
      expect(source, `${file} does not import the predicate`).toContain('isNavigationRequest');
      expect(codeOnly(source).includes('function isNavigationRequest'), `${file} declares a second definition`).toBe(false);
    }
    // The dev proxy is the end that regressed before (Q-0120 B-1), so its use is named rather than
    // left to the substring above: it is what the proxy's bypass is keyed on.
    expect(ends['apps/web/vite.config.ts']).toMatch(/bypassNavigation[\s\S]{0,200}isNavigationRequest/);
  });

  test('and the predicate answers the four cases the two ends disagree about', () => {
    expect(isNavigationRequest('GET', NAVIGATION)).toBe(true);
    expect(isNavigationRequest('HEAD', NAVIGATION)).toBe(true);
    expect(isNavigationRequest('GET', 'application/json')).toBe(false);
    expect(isNavigationRequest('GET', '*/*')).toBe(false);
    expect(isNavigationRequest('POST', NAVIGATION), 'a POST was read as a page load').toBe(false);
    // No `Accept` is not a navigation: every browser sends one on a page load, so absence is
    // evidence of a programmatic client rather than a case to guess at. A WebSocket upgrade from
    // one is what this keeps out of the shell.
    expect(isNavigationRequest('GET', undefined)).toBe(false);
    expect(isNavigationRequest('GET', null)).toBe(false);
  });
});
