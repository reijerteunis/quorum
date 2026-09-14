/**
 * Q-0126 AC-2 to AC-6 for `quorum open`.
 *
 * **Two ways in, and the split is the one `run.test.ts` already has.** Everything that is a claim
 * about *dispatch* — that the frame carries the name, that argv reaches the handler, what a bad flag
 * exits with — goes through {@link invoke} and therefore through `main`, because that boundary is
 * part of what is claimed (Q-0091 AC-2). Everything that has to *serve* goes through {@link capture}
 * over `openOn({ bundle })`, which is the seam `test/invoke.ts` documents for `quorum run`'s gate
 * reader: the shipped bundle root is module-relative by AC-3 and names `apps/web/dist`, and a test
 * that wrote a fixture there would race `build.test.ts`'s own `runBuild()` inside this same package.
 *
 * **Nothing here requires {@link DEFAULT_DAEMON_PORT} to be free.** Every fixture that binds asks
 * the operating system for a port a moment earlier, which keeps the verdict a property of the commit
 * rather than of whatever else is running on this machine (*"A test's verdict is a property of the
 * commit, not of the checkout or the account"*, 2026-08-30). The default is asserted as a **value**,
 * once, and never by binding it.
 *
 * **Nothing here spawns the binary.** The emit's own assertions live in `build.test.ts`, which is
 * the file Q-0098 AC-15(c) rules may spawn it — AC-8's claim about what `dist/open.js` resolves and
 * AC-10's about what a packed install answers are both there.
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_DAEMON_PORT } from '@quorum/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { parseArgv } from './argv.js';
import { ERROR, SIGNAL } from './exit.js';
import { NO_DAEMON_CONDITION, NO_DAEMON_REMEDY, openOn, servingLine } from './open.js';
import { capture, invoke, plain, type Invocation } from '../test/invoke.js';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** This file's own name, so the scan below can leave itself out and say that it did. */
const GUARD = path.basename(fileURLToPath(import.meta.url));

/** The sandbox each test works in. */
let sandbox = '';
let project = '';
let bundle = '';

beforeEach(() => {
  // Realpathed for `init.test.ts`'s reason: on macOS `os.tmpdir()` is a symlink, so a refusal that
  // names a directory would otherwise be compared against a path the command never printed.
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-open-')));
  project = path.join(sandbox, 'project');
  bundle = path.join(sandbox, 'bundle');
  fs.mkdirSync(path.join(project, 'harness'), { recursive: true });
  fs.writeFileSync(path.join(project, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n');
  fs.mkdirSync(bundle, { recursive: true });
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/** A built web app: the one file `bundleRefusal` asks for, and one asset beside it. */
function build(): void {
  fs.writeFileSync(path.join(bundle, 'index.html'), '<!doctype html><title>Quorum</title>');
  fs.mkdirSync(path.join(bundle, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(bundle, 'assets', 'app.js'), 'export const a = 1;\n');
}

/**
 * A port nothing is listening on, obtained by asking the operating system for one and giving it
 * back.
 *
 * The alternative — binding `0` and reading the port out of the printed line — is unavailable to a
 * test that has to make requests *while* the command is still running, because {@link capture}
 * returns what reached stdout only once the invocation has finished. So the port is chosen here and
 * passed in, and the window between releasing it and the daemon taking it is the accepted cost.
 */
const freePort = async (): Promise<number> => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    probe.close(() => { resolve(port); });
  });
});

/** Whether anything answers on `port` — which is how *nothing bound* is asserted. */
const answers = async (port: number): Promise<boolean> => new Promise((resolve) => {
  const probe = net.connect({ port, host: '127.0.0.1' });
  const settle = (value: boolean): void => { probe.destroy(); resolve(value); };
  probe.once('connect', () => { settle(true); });
  probe.once('error', () => { settle(false); });
});

/** Keep asking until the daemon answers, so a fixture does not race its own start. */
async function untilServing(port: number): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (await answers(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`nothing answered on ${String(port)} — the daemon did not start`);
}

/** Run `quorum open` over a fixture bundle, through the frame's own argv parser. */
const runOpen = async (root: string, ...argv: string[]): Promise<Invocation> =>
  capture(() => openOn({ bundle: pathToFileURL(`${root}/`) })(
    parseArgv(['open', '--project', project, ...argv])));

/** Every file this package carries, for the package-wide scan below. */
const files = (): [string, string][] => {
  const walk = (at: string, below: string): [string, string][] =>
    fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'dist', '.turbo'].includes(entry.name)) return [];
      const next = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return walk(path.join(at, entry.name), next);
      return [[next, fs.readFileSync(path.join(at, entry.name), 'utf8')] as [string, string]];
    });
  return walk(PACKAGE, '');
};

const read = (...parts: string[]): string => fs.readFileSync(path.join(PACKAGE, ...parts), 'utf8');

describe('AC-2 — the command opens a project, starts the daemon, and prints one URL', () => {
  test('it serves the bundle at /, the JSON surface beside it, and ends 130 on a signal', async () => {
    build();
    const port = await freePort();
    const running = runOpen(bundle, '--port', String(port));
    await untilServing(port);

    // `accept: text/html` because that is what a top-level browser navigation sends, and it is what
    // the static route's clause 2 discriminates on: `/` names no file, so it is answered with the
    // entry only where the request is a navigation. A bare `fetch` sends `*/*` and correctly falls
    // through to the JSON routes' 404 — the property Q-0122 built that predicate for.
    const page = await fetch(`http://127.0.0.1:${String(port)}/`, { headers: { accept: 'text/html' } });
    expect(page.status, 'the bundle is not being served').toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('Quorum');

    const json = await fetch(`http://127.0.0.1:${String(port)}/project`);
    expect(json.status, 'the daemon\'s JSON surface is not mounted').toBe(200);
    expect(json.headers.get('content-type')).toContain('application/json');

    // A deep link survives a reload, which is the whole reason the static route sits ahead of the
    // JSON ones — and the property Q-0120's B-1 was about, reached here through the command.
    const deep = await fetch(`http://127.0.0.1:${String(port)}/runs/run-3`, { headers: { accept: 'text/html' } });
    expect(deep.status, 'a reload at a shell route 404s').toBe(200);

    // Emitted rather than the handler being called by hand: what AC-6 claims is that `SIGINT`
    // reaches this command, and reaching into `process.listeners` would prove the shape of the
    // registration instead of that the event arrives.
    process.emit('SIGINT');
    const result = await running;

    const out = plain(result.stdout).trim().split('\n');
    expect(out, 'the command printed more than one line').toHaveLength(1);
    expect(out[0], 'the URL line does not carry the bind address').toContain('127.0.0.1');
    expect(out[0], 'the URL line does not carry the port it bound').toContain(String(port));
    expect(out[0]).toBe(plain(servingLine(`http://127.0.0.1:${String(port)}`)));
    expect(result.exitCode, 'a signal did not end the command with 130').toBe(SIGNAL);
    expect(result.stderr, 'a clean stop wrote to stderr').toBe('');

    // The socket is gone afterwards, which is what says `close()` ran — and ran in full:
    // `createDaemon` shuts the host down FIRST and stops the socket second, so a socket that has
    // stopped answering is a host that already released every live run through the abandonment path.
    expect(await answers(port), 'the daemon is still listening after the signal').toBe(false);
  }, 60_000);

  test('the frame dispatches the name, so the command is reachable as `quorum open`', async () => {
    // Through `main` rather than through the handler, which is the half `runOpen` cannot claim. Run
    // from a directory with no project above it, so the command reaches its second refusal and stops
    // — enough to establish that argv arrived, because a name the frame did not carry would have
    // printed the help instead.
    //
    // No `--project`: `loadProject(dir)` with an explicit directory reads the file and raises
    // `ENOENT` rather than `ProjectNotFoundError`, which is `core`'s behaviour and every command's,
    // not this one's. What AC-2 claims is the *class* this command renders, which is the one
    // `findProject` produces.
    const elsewhere = path.join(sandbox, 'nowhere');
    fs.mkdirSync(elsewhere);
    const cwd = process.cwd();
    process.chdir(elsewhere);
    try {
      const result = await invoke(['open']);
      expect(result.exitCode).toBe(ERROR);
      expect(plain(result.stderr), 'the project refusal is not core\'s sentence')
        .toContain('no harness/harness.yaml found');
      expect(plain(result.stderr), 'the remedy is not the one place it lives')
        .toContain('run `quorum init` in your repo');
      expect(result.stdout, 'the frame printed its help, so the name is not dispatched').toBe('');
    } finally {
      process.chdir(cwd);
    }
  });

  test('no production module offers a --host, and none spells the bind address', () => {
    // AC-2's clause that no flag may move the bind. `BIND_HOSTNAME` is `@quorum/server`'s and is the
    // only spelling of the address on this command's path; a literal in a production module would be
    // a second one, free to disagree with the bind it describes.
    //
    // **Over the production modules and not the whole package, and the boundary is measured rather
    // than chosen.** `build.test.ts` spells `127.0.0.1` for its own closed-registry fixture and this
    // file spells it in every `fetch` above, so a package-wide scan would report two files that are
    // doing exactly what they should — a guard narrowed to fit is the failure this repository keeps
    // finding, so the corpus is stated as *what ships* and the two readers are named as the reason.
    const production = files().filter(([name]) => name.startsWith('src/') && !name.endsWith('.test.ts'));
    expect(production.length, 'the walk found nothing — this scan proves nothing').toBeGreaterThan(10);
    expect(production.some(([name]) => name === 'src/open.ts'), 'the command is outside the scan').toBe(true);
    expect(production.some(([name]) => name === `src/${GUARD}`), 'this guard is inside its own scan').toBe(false);
    for (const [name, text] of production) {
      expect(text.includes(`--${'host'}`), `${name} offers a way to move the bind`).toBe(false);
      expect(/127\.0\.0\.1/.test(text), `${name} spells the bind address`).toBe(false);
    }
    // The help is a frame module and is covered by the loop above; asserted again by name because it
    // is the surface an operator reads, and a flag the code does not implement would still be a
    // promise. `commands.test.ts` makes the same assertion over the `open` line alone.
    expect(read('src', 'commands.ts').includes(`--${'host'}`), 'the help offers a bind flag').toBe(false);
    // Both needles discriminate, over fixtures whose own literals are assembled.
    expect(`serve ${'--'}${'host'} <name>`.includes(`--${'host'}`)).toBe(true);
    expect(/127\.0\.0\.1/.test(`const h = '127.0.${'0.1'}';`)).toBe(true);
    expect(/127\.0\.0\.1/.test('const nothing = 1;')).toBe(false);
  });
});

describe('AC-4 — a directory holding no build refuses, and nothing binds', () => {
  test('the refusal names the directory and the entry it wanted, and no socket was opened', async () => {
    // The bundle directory exists and is empty, which is the shape a cleaned checkout has and the
    // one this most needs to catch — `bundleRefusal` asks for the entry rather than for the
    // directory for exactly that reason.
    const port = await freePort();
    const result = await runOpen(bundle, '--port', String(port));
    expect(result.exitCode, 'a missing build did not stop the command').toBe(ERROR);
    expect(result.hard, 'the refusal was soft, so the command carried on').toBe(true);
    expect(plain(result.stderr), 'the refusal does not name the directory it looked in').toContain(bundle);
    expect(plain(result.stderr), 'the refusal does not name the file it wanted').toContain('index.html');
    expect(result.stdout, 'a port was printed for a daemon that never started').toBe('');
    // Asserted by attempting a connection rather than by reading the message: *nothing bound* is the
    // claim, and a sentence about it is not evidence for it.
    expect(await answers(port), 'something is listening on the port the command would have used').toBe(false);
  }, 60_000);

  test('the condition is the library\'s and the imperative is this surface\'s', () => {
    // `bundleRefusal` composes a statement about what the directory has to contain and carries no
    // shell imperative — *"A `core` error names the condition; the remedy belongs to the surface"*
    // (2026-09-07) — and this module renders it unaltered rather than composing advice of its own.
    const text = read('src', 'open.ts');
    expect(text, 'open.ts composes its own advice for a missing build').not.toContain('pnpm turbo run build');
    expect(text, 'the library refusal is no longer rendered unaltered').toContain('die(error.message)');
  });

  test('and the daemon-absent refusal is checked first, which is what makes that message right', () => {
    // The ordering ruling, asserted structurally because in this workspace `@quorum/server` always
    // resolves and the other branch cannot be taken. On a packed install `open.js` sits at
    // `node_modules/@quorum/cli/dist/`, so the bundle root resolves to `node_modules/apps/web/dist`
    // — a path with no meaning there — and checking it first would report *no build at* that
    // nonsense path instead of the true thing. The packed half is `build.test.ts`'s AC-10.
    const text = read('src', 'open.ts');
    const daemonFirst = text.indexOf('await daemon()');
    const bundleUsed = text.indexOf('createDaemon({ project, port, bundle })');
    expect(daemonFirst, 'open.ts no longer resolves the daemon through a named step').toBeGreaterThan(-1);
    expect(bundleUsed, 'open.ts no longer hands the bundle to the daemon').toBeGreaterThan(-1);
    expect(daemonFirst, 'the bundle is reached before the daemon').toBeLessThan(bundleUsed);
  });

  test('the two refusal sentences are this command\'s own literals, so a packed install and this agree', () => {
    // AC-10 asserts the packed refusal by bytes against these, which is why they are exported rather
    // than written twice. The condition claims what failed to resolve HERE and nothing about why: an
    // import that did not resolve cannot tell a deliberately daemon-less install from a damaged one.
    // Why: *"An optional edge says the daemon may be absent, and never why"* (2026-09-14), clause 2.
    expect(NO_DAEMON_CONDITION).toContain('@quorum/server');
    expect(NO_DAEMON_CONDITION).toContain('this installation');
    expect(NO_DAEMON_REMEDY, 'the remedy does not name where the daemon is').toContain('packages/server');
    const sentence = `${NO_DAEMON_CONDITION} ${NO_DAEMON_REMEDY}`;
    for (const forbidden of ['missing', 'not installed', 'broken', 'omitted', 'deliberately']) {
      expect(sentence, `the refusal claims the daemon is ${forbidden}`).not.toContain(forbidden);
    }
    // And the scan discriminates, so a future rewording that DID claim one fails here.
    expect(`${sentence} the daemon is missing`).toContain('missing');
  });
});

describe('AC-5 — the port has one default, and one in use refuses rather than drifting', () => {
  test('the default is declared once and this command spells no port literal of its own', () => {
    expect(DEFAULT_DAEMON_PORT).toBe(7717);
    const text = read('src', 'open.ts');
    expect(text, 'the command stopped reading the shared default').toContain('DEFAULT_DAEMON_PORT');
    expect(/\b7717\b/.test(text), 'the command spells a second copy of the default').toBe(false);
    // The needle discriminates, over a literal assembled so this file is not its own subject.
    expect(/\b7717\b/.test(`const p = ${'77'}${'17'};`)).toBe(true);
  });

  test('a port something else holds refuses, names that port, and names no other', async () => {
    const port = await freePort();
    const holder = net.createServer();
    await new Promise<void>((resolve) => { holder.listen(port, '127.0.0.1', resolve); });
    try {
      build();
      const result = await runOpen(bundle, '--port', String(port));
      expect(result.exitCode, 'a port in use did not stop the command').toBe(ERROR);
      const said = plain(result.stderr);
      expect(said, 'the refusal does not name the port').toContain(String(port));
      // It never silently selects another, which is the run lock's rule at a second subject: the dev
      // proxy and any bookmarked URL both assume the port they were given. Asserted by requiring the
      // message to carry exactly one number, so *bound 51234 instead* fails here.
      expect(said.match(/\d+/g), 'the refusal names a second port').toStrictEqual([String(port)]);
      expect(result.stdout, 'a URL was printed for a daemon that never bound').toBe('');
    } finally {
      await new Promise<void>((resolve) => { holder.close(() => { resolve(); }); });
    }
  }, 60_000);

  test('a --port that is not a port refuses rather than being coerced into one', async () => {
    // `Number` swallows both of the interesting ones: `argv.ts:54` gives a valueless flag the boolean
    // `true`, which reads as the port 1, and an empty value is 0, which asks the operating system for
    // a free one. Neither is what the flag said, and both would bind somewhere nobody can guess.
    for (const argv of [['--port'], ['--port', ''], ['--port', 'later'], ['--port', '70000'], ['--port', '-1']]) {
      const result = await invoke(['open', '--project', project, ...argv]);
      expect(result.exitCode, `${argv.join(' ')} was accepted`).toBe(ERROR);
      expect(plain(result.stderr), `${argv.join(' ')} was refused for some other reason`).toContain('--port');
    }
  }, 60_000);

  test('and 0 is accepted, because that is the one value the daemon already gives a meaning', async () => {
    // `serve`'s own `port = 0` asks the operating system for a free one. It is spelled in full rather
    // than arrived at by coercion, which is what the refusals above are protecting.
    build();
    const result = await capture(async () => {
      const running = capture(() => openOn({ bundle: pathToFileURL(`${bundle}/`) })(
        parseArgv(['open', '--project', project, '--port', '0'])));
      // The port is unknown to this test by construction, so what is claimed is only that the
      // command got past `portFrom` and printed a URL — which the assertions below read.
      await new Promise((resolve) => setTimeout(resolve, 400));
      process.emit('SIGINT');
      const inner = await running;
      console.log(inner.stdout.trim());
      expect(inner.exitCode, 'asking for a free port did not start the daemon').toBe(SIGNAL);
    });
    expect(plain(result.stdout), 'no URL was printed for an operating-system-assigned port')
      .toContain('http://127.0.0.1:');
  }, 60_000);
});

describe('AC-6 — the daemon\'s lifetime is the command\'s', () => {
  test('a repeated signal accumulates no listeners, and both are removed when the command returns', async () => {
    build();
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    const port = await freePort();
    const running = runOpen(bundle, '--port', String(port));
    await untilServing(port);

    const during = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    expect(during.SIGINT, 'the command installed no SIGINT listener').toBe(before.SIGINT + 1);
    expect(during.SIGTERM, 'the command installed no SIGTERM listener').toBe(before.SIGTERM + 1);

    // Held down, which is what a person does when the first press seems not to have worked. One
    // handler settles a promise that is already settled, so nothing accumulates and `close()` is not
    // re-entered.
    process.emit('SIGINT');
    process.emit('SIGINT');
    process.emit('SIGTERM');
    const result = await running;

    expect(result.exitCode).toBe(SIGNAL);
    expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') },
      'the command left a listener behind').toStrictEqual(before);
    expect(await answers(port), 'the daemon is still listening').toBe(false);
  }, 60_000);

  test('SIGTERM stops it too, and not only SIGINT', async () => {
    build();
    const port = await freePort();
    const running = runOpen(bundle, '--port', String(port));
    await untilServing(port);
    process.emit('SIGTERM');
    const result = await running;
    expect(result.exitCode).toBe(SIGNAL);
    expect(await answers(port), 'SIGTERM left the daemon listening').toBe(false);
  }, 60_000);

  // **The "a stray listener is caught" demonstration is deliberately NOT written here**, and the
  // reason is one this ticket met rather than anticipated: `frame.source.test.ts`'s
  // `SIGNAL_HANDLER_OWNER` scans every file this package carries, tests included, so a fixture that
  // attached a listener of its own to show the comparison firing would have made this file a third
  // owner of process-level behaviour and turned that register red. **Its scan reads the raw text**,
  // so even naming the call here would do it — which is how this paragraph was first written, and
  // what it is now phrased around. The demonstration exists once, in `frame.source.test.ts`'s own
  // AC-4(d) block, which is that register's file and the one thing excluded from its scan.
  //
  // What establishes the pair above without it is that the two assertions point in opposite
  // directions: `during` requires the counts to have GONE UP, which cannot pass over a command that
  // registered nothing, and only then does the comparison after it require them back where they
  // started. A vacuous version of this test would fail at the first of the two.
});
