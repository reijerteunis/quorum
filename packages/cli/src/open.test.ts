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
 * AC-10's about what a packed install answers are both there. {@link daemonImportFailure} spawns a
 * plain `node` process over a fixture of its own and is not that: what it needs is **Node's** error
 * for a failed import, which Vitest cannot produce because it resolves through Vite and the
 * `quorum-source` condition. `build.test.ts` and `package.test.ts` each keep a plain-process probe
 * for the same reason.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { openUrl } from '@quorum/core';
import { DEFAULT_DAEMON_PORT } from '@quorum/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { parseArgv } from './argv.js';
import { ERROR, SIGNAL } from './exit.js';
import {
  isDaemonUnresolved, launchWarning, NO_DAEMON_CONDITION, NO_DAEMON_REMEDY, openOn, servingLine,
} from './open.js';
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

/**
 * Run `quorum open` over a fixture bundle, through the frame's own argv parser.
 *
 * **`--no-open` on every fixture that is not about the browser**, with {@link neverCalled} behind it
 * so the flag is load-bearing rather than trusted: a regression that ignored it reaches a spawn that
 * refuses, which surfaces as a warning on a stream these tests require to be empty. AC-15's own
 * fixtures supply their spawn and leave the flag off.
 */
const runOpen = async (root: string, ...argv: string[]): Promise<Invocation> =>
  capture(() => openOn({ bundle: pathToFileURL(`${root}/`), launcher: { spawn: neverCalled } })(
    parseArgv(['open', '--project', project, '--no-open', ...argv])));

/**
 * A spawn no fixture outside AC-15 may reach, and which fails loudly where one does.
 *
 * Every fixture in this file that starts a daemon would otherwise launch a **real browser** on the
 * machine running the suite, which is both a side effect a test may not have and a verdict that
 * would depend on what is installed (*"A test's verdict is a property of the commit, not of the
 * checkout or the account"*, 2026-08-30). A refusal rather than a silent stub, so a fixture that
 * starts reaching it says so instead of quietly proving less.
 */
const neverCalled: NonNullable<Parameters<typeof openUrl>[1]>['spawn'] = (command) =>
  Promise.reject(new Error(`this fixture launched ${command}, which no test here may do`));

/** A spawn that records what it was asked to start, and says when it was first reached. */
function recordingSpawn(code: number | null = 0): {
  spawn: NonNullable<Parameters<typeof openUrl>[1]>['spawn'];
  calls: string[];
  called: Promise<void>;
} {
  const calls: string[] = [];
  let reached = (): void => {};
  const called = new Promise<void>((resolve) => { reached = resolve; });
  return {
    calls,
    called,
    spawn: (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      reached();
      return Promise.resolve(code);
    },
  };
}

/** `quorum open` over a fixture bundle with the browser spawn supplied by the caller. */
const runOpenLaunching = async (
  root: string,
  launcher: Parameters<typeof openUrl>[1],
  ...argv: string[]
): Promise<Invocation> =>
  capture(() => openOn({ bundle: pathToFileURL(`${root}/`), launcher })(
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

/**
 * What Node really raises for one way of failing to load `@quorum/server`, measured against a
 * fixture installation this test builds rather than described in a comment.
 *
 * `entry` is the daemon module's text, or `null` for an installation that carries no daemon at all.
 * The probe runs in a plain process rooted at that fixture, so what comes back is the error the
 * shipped predicate will actually be handed on a packed install — an import performed here would be
 * Vite's and would fail in a different shape.
 */
function daemonImportFailure(entry: string | null): { code: string; message: string } {
  const root = fs.mkdtempSync(path.join(sandbox, 'import-'));
  if (entry !== null) {
    const daemon = path.join(root, 'node_modules', '@quorum', 'server');
    fs.mkdirSync(daemon, { recursive: true });
    fs.writeFileSync(path.join(daemon, 'package.json'),
      JSON.stringify({ name: '@quorum/server', version: '0.0.0', type: 'module', main: 'index.js' }));
    fs.writeFileSync(path.join(daemon, 'index.js'), entry);
  }
  const script = "try { await import('@quorum/server'); console.log(JSON.stringify({ code: 'LOADED', message: '' })) }"
    + ' catch (e) { console.log(JSON.stringify({ code: e?.code ?? "", message: String(e?.message) })) }';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
  const failure = JSON.parse(out) as { code: string; message: string };
  // A fixture that loaded is a probe with no subject, and would make every comparison below read as
  // agreement. It says so here rather than surfacing as a confusing assertion.
  if (failure.code === 'LOADED') throw new Error('the fixture daemon loaded — this probe has nothing to measure');
  return failure;
}

describe('AC-10 — the refusal is for a daemon that did not resolve, never one that failed after it had', () => {
  test('the four ways loading it can fail are told apart, and two of them share a code', () => {
    const absent = daemonImportFailure(null);
    const transitive = daemonImportFailure("import 'a-package-that-is-not-installed';\n");
    const syntax = daemonImportFailure('export const = ;\n');
    const threw = daemonImportFailure('throw new Error("the daemon blew up while loading");\n');

    // Each fixture failed for the reason it was built to fail for, so everything below is about
    // Node's behaviour rather than about objects written in this file.
    expect(absent.message, 'the fixture root resolved a daemon, so the absent case is not absent')
      .toContain("Cannot find package '@quorum/server'");
    expect(transitive.message, 'the inner dependency resolved, so this is not the case it claims to be')
      .toContain('a-package-that-is-not-installed');
    expect(syntax.message, 'the unparseable fixture parsed').toContain('Unexpected token');
    expect(threw.message, 'the throwing fixture did not throw').toContain('the daemon blew up while loading');
    // And the probe can tell a failure from a success at all: a daemon that loads is refused rather
    // than returned as an empty failure, which is what would make all four comparisons vacuous.
    expect(() => daemonImportFailure('export const loads = 1;\n'),
      'a fixture that loaded would be read as a fixture that failed').toThrow('nothing to measure');

    // **The measurement the narrowing rests on.** An absent package and a dependency missing from
    // inside a package that is present raise the SAME code, so a guard that read only `code` would
    // report the second as the first — which is what the blanket catch this replaced did to all
    // three of the resolved cases. If Node ever stops sharing it, this fails rather than the
    // message clause quietly becoming decoration.
    expect(transitive.code, 'the two shapes no longer share a code — the message clause has no subject')
      .toBe(absent.code);
    expect(absent.code, 'an absent package stopped raising the code this reads').toBe('ERR_MODULE_NOT_FOUND');
    expect([syntax.code, threw.code], 'a failure to load started carrying a resolution code')
      .toStrictEqual(['', '']);

    expect(isDaemonUnresolved(absent), 'an installation carrying no daemon is no longer refused').toBe(true);
    // The finding this round closed: a daemon that resolved and then failed is a package that IS
    // here, and reporting one as absent both claims what the process never established and hides
    // the failure a maintainer has to act on. Why: see *"An optional edge says the daemon may be
    // absent, and never why"* (2026-09-14), clause 2.
    const resolvedAndFailed = [
      ['a dependency missing from inside the daemon', transitive],
      ['a daemon that will not parse', syntax],
      ['a daemon that threw while loading', threw],
    ] as const;
    for (const [what, failure] of resolvedAndFailed) {
      expect(isDaemonUnresolved(failure), `${what} is reported as a daemon that did not resolve`).toBe(false);
    }
  }, 60_000);

  test('both clauses are load-bearing, and nothing that is not an error is read as one', () => {
    // `dieOnUnexpected` is handed whatever was thrown, which need not be an `Error` at all, so the
    // predicate deciding whether to reach it has to survive the same values. The two halves below
    // carry one clause each and neither is enough on its own, which is what stops the pair reading
    // as one condition written twice.
    const refused: [string, unknown][] = [
      ['nothing at all', null],
      ['an absent value', undefined],
      ['a thrown string', 'Cannot find package \'@quorum/server\''],
      ['a thrown number', 42],
      ['the code without the specifier', { code: 'ERR_MODULE_NOT_FOUND', message: "Cannot find package 'hono'" }],
      ['the specifier without the code', { message: "Cannot find package '@quorum/server' imported from x" }],
    ];
    for (const [what, thrown] of refused) {
      expect(isDaemonUnresolved(thrown), `${what} was read as a daemon that did not resolve`).toBe(false);
    }
    // And the pair together IS recognised, so the six above are refused for their own reason rather
    // than by a predicate that answers `false` to everything.
    expect(isDaemonUnresolved({
      code: 'ERR_MODULE_NOT_FOUND', message: "Cannot find package '@quorum/server' imported from /x/open.js",
    }), 'the predicate no longer recognises the one shape it is for').toBe(true);
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
      const running = capture(() => openOn({ bundle: pathToFileURL(`${bundle}/`), launcher: { spawn: neverCalled } })(
        parseArgv(['open', '--project', project, '--no-open', '--port', '0'])));
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

describe('AC-15 — a browser is launched, a failed launch is a warning, and --no-open serves without one', () => {
  test('the URL line is byte-identical with and without a launch, and exactly one of them spawns', async () => {
    // **The same port for both runs**, which is what makes "byte-identical" a claim about bytes
    // rather than about how the line is composed: two ports would differ in the one place the line
    // carries a number, and comparing `servingLine(url)` with itself would prove only that the
    // helper is deterministic. The first daemon is stopped before the second starts.
    build();
    const port = await freePort();

    const launching = recordingSpawn();
    const withBrowser = runOpenLaunching(bundle, { platform: 'linux', spawn: launching.spawn }, '--port', String(port));
    await untilServing(port);
    await launching.called;
    process.emit('SIGINT');
    const opened = await withBrowser;

    const declined = recordingSpawn();
    const withoutBrowser = runOpenLaunching(
      bundle, { platform: 'linux', spawn: declined.spawn }, '--port', String(port), '--no-open');
    await untilServing(port);
    process.emit('SIGINT');
    const quiet = await withoutBrowser;

    expect(opened.stdout, 'the URL line moved when a browser was launched').toBe(quiet.stdout);
    expect(plain(opened.stdout).trim()).toBe(plain(servingLine(`http://127.0.0.1:${String(port)}`)));
    expect(launching.calls, 'the launch did not reach the platform table').toStrictEqual([
      `xdg-open http://127.0.0.1:${String(port)}`,
    ]);
    expect(declined.calls, '--no-open launched a browser anyway').toStrictEqual([]);
    // Neither run is a failure: a launch that worked and a launch that never happened both end the
    // way a stopped command ends.
    expect([opened.exitCode, quiet.exitCode]).toStrictEqual([SIGNAL, SIGNAL]);
    expect([opened.stderr, quiet.stderr], 'a successful serve wrote to stderr').toStrictEqual(['', '']);
  }, 60_000);

  test('a launch that failed warns and changes nothing else — the run is not failed', async () => {
    // The whole of "a warning, not a failed run", over the shipped `openUrl` with only its spawn
    // supplied: the daemon went on serving, the exit code is the one a stopped command has, and the
    // sentence carries the URL a person can use instead.
    build();
    const port = await freePort();
    const failing = recordingSpawn(1);
    const running = runOpenLaunching(bundle, { platform: 'linux', spawn: failing.spawn }, '--port', String(port));
    await untilServing(port);
    await failing.called;

    // Still serving AFTER the launch failed, which is the claim; asserted over the socket rather
    // than from the absence of a shutdown message.
    const page = await fetch(`http://127.0.0.1:${String(port)}/`, { headers: { accept: 'text/html' } });
    expect(page.status, 'a failed browser launch took the daemon down with it').toBe(200);

    process.emit('SIGINT');
    const result = await running;
    expect(result.exitCode, 'a failed launch changed the exit code').toBe(SIGNAL);
    // `hard` is deliberately NOT the discriminator here and the reason is worth stating: this
    // command ends every successful run through `process.exit(SIGNAL)`, so `capture` reports a hard
    // exit whether or not anything failed, and an assertion on it would pass over a `die`. What
    // separates the two is the code — a refusal is `ERROR`, and AC-4 asserts that shape directly.
    expect(result.exitCode, 'a failed launch was rendered as a refusal').not.toBe(ERROR);
    expect(plain(result.stdout).trim(), 'the URL line moved because the launch failed')
      .toBe(plain(servingLine(`http://127.0.0.1:${String(port)}`)));
    const warning = plain(result.stderr).trim();
    expect(warning, 'nothing was said about a launch that did not happen').not.toBe('');
    expect(warning, 'the warning does not carry the URL').toContain(`http://127.0.0.1:${String(port)}`);
    expect(warning, 'the warning does not say the daemon is still running').toContain('still running');
    expect(warning, 'the launcher own verdict was not reported').toContain('xdg-open exited 1');
  }, 60_000);

  test('and the warning is built from the closed set, claiming nothing about a browser', () => {
    // Unit-level over `launchWarning`, because three of the four states cannot be produced by a
    // fixture on the machine running this suite without making the verdict a property of that
    // machine. Each is asserted by what it says AND by what it may not: `openUrl` reports the
    // launcher it ran, so a sentence here inferring that no browser exists would be the claim
    // *"A probe that could not answer is not a negative"* (2026-09-10) refuses.
    const url = 'http://127.0.0.1:7717';
    const sentences = [
      launchWarning({ state: 'unsupported-platform', platform: 'win32' }, url),
      launchWarning({ state: 'executable-unavailable', command: 'xdg-open' }, url),
      launchWarning({ state: 'launch-failed', command: 'open', reason: 'open exited 3' }, url),
    ].map(plain);
    expect(sentences[0], 'the unsupported platform is not named').toContain('win32');
    expect(sentences[1], 'the launcher that was not found is not named').toContain('xdg-open');
    expect(sentences[2], 'the launcher own verdict is not reported').toContain('open exited 3');
    for (const sentence of sentences) {
      expect(sentence, 'the warning does not carry the URL').toContain(url);
      expect(sentence, 'the warning does not say the daemon survives').toContain('the daemon is still running');
      for (const forbidden of ['no browser', 'browser is not', 'not installed', 'missing']) {
        expect(sentence, `the warning claims "${forbidden}"`).not.toContain(forbidden);
      }
    }
    // And the scan discriminates, so a rewording that DID make one of those claims fails here.
    expect(`${sentences[0]} no browser is installed`).toContain('no browser');
  });

  test('SSH and any other environment are not detected, so what it does does not move with the machine', () => {
    // Codex's OQ-6, declined on the record. An environment oracle — `SSH_TTY`, `DISPLAY`, a
    // container probe — would make a fixture's verdict a function of where it runs, which *"A
    // test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30)
    // forbids, and it would change what the command does for a reason nobody typed. `--no-open` is
    // the whole of the opt-out.
    const text = read('src', 'open.ts');
    for (const probe of ['SSH_TTY', 'SSH_CONNECTION', 'DISPLAY', 'WAYLAND', 'isTTY', 'process.env']) {
      expect(text.includes(probe), `open.ts reads ${probe} to decide whether to launch`).toBe(false);
    }
    expect(text, 'the opt-out is no longer a flag the operator types').toContain("flags['no-open']");
  });
});
