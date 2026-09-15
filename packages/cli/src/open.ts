/**
 * `quorum open` — start the daemon against this project, serve the built web app, print one URL and
 * open it.
 *
 * The command M3's done-when has named since the milestone was written, and the one that makes the
 * UI reachable at all: after Q-0122 `apps/web` emits a bundle and `packages/server` serves it on
 * `GET /*`, and until this existed the only way to see either was to write a process.
 *
 * **The browser is opened by `@quorum/core` and not here, and that is a rule rather than a layering
 * preference.** `frame.source.test.ts`'s `IO_MODULE` refuses `node:child_process` in every
 * production module of this package, on the stated ground that every read and every spawn goes
 * through `@quorum/core` — and opening a browser is a spawn. So this module holds one expression
 * and `core/browser/` holds the table, which is the division Q-0093 made for `quorum init`'s
 * scaffolding at a second site. That command's own helper is deliberately *not* named here: AC-10's
 * scan reads a module's whole text, and a command naming another command's domain symbol fails it
 * whether the mention is code or prose. Why: see *"`core` opens a URL, and the ninth folder is named
 * for what it is about"* (2026-09-14).
 *
 * **A launch that did not happen is a warning and never a failed run.** By the time it could fail
 * the daemon is listening and the URL has been printed, so what is lost is a convenience —
 * {@link launchWarning} says so and the exit code does not move. `--no-open` serves without
 * launching, and the URL line is byte-identical either way.
 *
 * **The daemon and the bundle are both ordinary dependencies, and the specifier is static.**
 * `@quorum/cli` declares `@quorum/server` and `@quorum/web` under `dependencies`, so an installation
 * that has this package has both, and what used to be deferred is deferred no longer. A required
 * edge removes the case the deferral was for — *absent* stops being reachable, and what remains is a
 * corrupt install, which every command should fail loudly on rather than one command report
 * politely. Why: see *"The distribution set is five, and rejoins the emitting set"* (2026-09-15),
 * which supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14)
 * rather than amending it: the exemption that entry authorised is deleted, not widened.
 *
 * **The bundle is found by package name, and that is the one expression both installations
 * answer.** `@quorum/web` publishes a single locator subpath, so {@link BUNDLE} resolves through
 * that package's own manifest — to `apps/web/dist/` in this workspace and to
 * `node_modules/@quorum/web/dist/` in a packed install — where the module-relative path this
 * replaced answered `node_modules/apps/web/dist` outside the workspace, a directory with no meaning
 * there. `process.cwd()` would answer the operator's directory and an environment variable whatever
 * was exported, which is the argument `static.ts`'s header already makes for the daemon. It travels
 * as a `URL` because this package may import no `node:url` — see {@link BUNDLE}.
 *
 * **The order of the two refusals is ruled** — project, then bundle. It was three, and the first of
 * them named a daemon that had not resolved; the entry above removes that case and with it the
 * reason the bundle check came last, which was that it could not name a real directory on a packed
 * install. It can now, so what remains is ordered by cost: the project is the cheaper question and
 * the one an operator is likelier to have got wrong. The two argv refusals sit ahead of both and are
 * not further members of that order: these two are claims about an *installation*, and those are
 * about what was typed, which is wrong on every installation and costs nothing to establish.
 */
import { loadProject, openUrl, ProjectNotFoundError, type BrowserLaunch } from '@quorum/core';
import { BIND_HOSTNAME, createDaemon } from '@quorum/server';
import { DEFAULT_DAEMON_PORT, NO_BUNDLE_CODE } from '@quorum/shared';

import { c } from './colour.js';
import { die, dieNoProject } from './fail.js';
import { SIGNAL } from './exit.js';
import type { CommandHandler } from './main.js';

/**
 * The built web app, resolved through `@quorum/web`'s own manifest.
 *
 * **Found by package name rather than by this module's location, which is what makes one expression
 * answer both installations.** `@quorum/web` publishes exactly one subpath — the bundle's entry
 * document — and the directory that holds it is what `serve` wants, so the containing URL is derived
 * from what the resolver answered. Under the workspace that is `apps/web/dist/`; under a packed
 * install it is `node_modules/@quorum/web/dist/`. The register the package publishes is deliberately
 * one key rather than a `./dist/*` pattern, on the refusal `package.test.ts` already makes for
 * `@quorum/core`: a wildcard defers what a consumer may reach to whoever types one first, and the
 * emitted asset filenames are hashed and nobody else's business.
 *
 * **It answers without the build existing**, which is what keeps `serve`'s own missing-build refusal
 * reachable: resolution reads the manifest and does not open the target. Measured rather than
 * assumed — with `dist/` removed this still resolves, and the refusal below is what reports it,
 * naming a directory inside the installation the reader is standing in.
 *
 * **A `URL`, handed across the package boundary unconverted**, which is the shape `init.ts`'s
 * `TEMPLATES` already has and for the identical reason: `frame.source.test.ts`'s `IO_MODULE`
 * refuses `node:url` in every production module of this package, so `fileURLToPath` is not
 * available here — and `new URL(…).pathname` is not a substitute, because it leaves percent-encoding
 * in place, so an installation under a path containing a space would resolve to a directory that
 * does not exist and be refused for a build that is present. `ServeOptions.bundle` therefore takes
 * `string | URL` and `packages/server` converts at the one site that needs a path.
 */
const BUNDLE = new URL('.', import.meta.resolve('@quorum/web/bundle'));

/**
 * What this command takes, quoted at a refusal.
 *
 * Byte-identical to the flags `commands.ts`'s own `open` line offers, because the two are read by
 * the same person a moment apart and a usage line that disagreed with the help would be a second,
 * quieter promise. `--project` is left out of both for the same reason it is left out of every
 * other line: no command's help has ever named it.
 */
const USAGE = 'usage: quorum open [--port <n>] [--no-open]';

/** The one line a started daemon prints, and the only thing this command writes on success. */
export const servingLine = (url: string): string =>
  `${c.green('✓')} Quorum is serving ${url} — press Ctrl-C to stop`;

/**
 * What a launch that did not happen is told to a person — a **warning**, never a failed run.
 *
 * The daemon is listening by the time this can be written, so nothing shuts down and the exit code
 * does not move: what was lost is a convenience, and {@link servingLine} has already printed the URL
 * that replaces it. That line is byte-identical either way, which is what makes the fallback an
 * instruction rather than a second, different answer.
 *
 * **No branch of this claims anything about a browser**, which is `openUrl`'s own rule arriving at
 * the surface that renders it: `core` reports the launcher it ran and how that exited, and a
 * sentence here saying *no browser is installed* would be the inference that primitive refuses to
 * draw. See *"A probe that could not answer is not a negative"* (2026-09-10).
 */
export const launchWarning = (result: Exclude<BrowserLaunch, { state: 'launched' }>, url: string): string => {
  // `has no launcher for` rather than `knows no browser launcher for`, which was the first wording
  // and which its own test refused: that sentence contains the phrase *no browser*, and a reader
  // skimming it learns something this command cannot establish. The distinction is the whole of
  // clause 6 — what is absent is a row in a table here, never a browser on the machine.
  const because = result.state === 'unsupported-platform'
    ? `Quorum has no launcher for ${result.platform}`
    : result.state === 'executable-unavailable'
      ? `${result.command} was not found on this system`
      : result.reason;
  return `${c.amber('!')} did not launch a browser: ${because} — open ${url} yourself; the daemon is still running`;
};

/**
 * The port this run asks for: `--port <n>` where one is supplied, and {@link DEFAULT_DAEMON_PORT}
 * where none is. `0` asks the operating system for a free one, which is `serve`'s own meaning for it
 * and what a test wants.
 *
 * **Spelled rather than coerced**, because every interesting failure here is one `Number` swallows:
 * `argv.ts:54` gives a valueless `--port` the boolean `true`, which `Number` reads as the port `1`,
 * and `--port ""` is `0`, which would silently bind somewhere nobody can guess instead of where the
 * flag said. A digit string is what a port is written as, so that is what this accepts; the bounds
 * are the protocol's rather than a policy.
 */
function portFrom(value: unknown): number {
  if (value === undefined) return DEFAULT_DAEMON_PORT;
  const asked = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : -1;
  if (asked < 0 || asked > 65_535) {
    die(`--port takes a number from 0 to 65535, and was given ${JSON.stringify(value)}`);
  }
  return asked;
}

/**
 * Whether `error` is a port that something else already holds.
 *
 * Read off the `code` Node sets rather than off the message, which is locale-dependent and which a
 * runtime is free to reword. A port in use **refuses naming the port** and never selects another:
 * the dev proxy and any bookmarked URL both assume the one they were given, so a daemon that drifted
 * would be reachable at an address nothing has — the **run lock**'s own rule, *"a second run refuses
 * and names the holder; it never waits"*, at a second subject. `--port` is what makes that refusal a
 * message rather than a dead end.
 */
const isPortInUse = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === 'EADDRINUSE';

/**
 * Whether `error` is `serve`'s own refusal for a bundle root that carries no build.
 *
 * By `code` and never by message, which is what {@link isPortInUse} does and what every predicate
 * in this module now does — the one that had to read a sentence for want of anything else went with
 * the case it was for, at Q-0124. `serve` attaches {@link NO_BUNDLE_CODE} at the throw site
 * precisely so this caller need not read a sentence, and the sentence it then renders is
 * `packages/server`'s own, unaltered.
 */
const isMissingBundle = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === NO_BUNDLE_CODE;

/**
 * The project this daemon serves, or the sentence a stranger reads when there is none.
 *
 * `run.ts`'s `openProject` at a second site, and reached through `@quorum/core` rather than through
 * `@quorum/server`'s own `openProject`. That was measured rather than stylistic while the daemon
 * package might not be installed; it stays because the layering is right either way — the project is
 * `core`'s to resolve, and a command reaching for it through the transport would make every other
 * command's `loadProject` the odd one out.
 */
function projectAt(where: unknown): ReturnType<typeof loadProject> {
  try {
    return loadProject(where as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return dieNoProject(error.message);
  }
}

/**
 * Resolve when this process is asked to stop, leaving no listener behind either way.
 *
 * **Installed here and removed in a `finally`, never at module scope**, which is `run.ts:179–200`'s
 * precedent and what keeps `frame.source.test.ts`'s runtime listener count unchanged after the
 * barrel is imported. `core` installs none of its own — *"What a run's event stream carries, and how
 * a gate answer travels back"* (2026-08-28) — so a command that starts a daemon is what owns when
 * `close()` runs. One handler serves both signals and settling twice is a no-op, so holding Ctrl-C
 * accumulates nothing.
 */
async function untilStopped(): Promise<void> {
  let onSignal = (): void => {};
  try {
    await new Promise<void>((resolve) => {
      onSignal = (): void => { resolve(); };
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);
    });
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

/**
 * Start the daemon, print the URL, open it, and serve until a signal arrives.
 *
 * `close()` shuts the host down before the socket, which is `createDaemon`'s order and not this
 * command's to choose: every live run is released through the abandonment path first, so stopping
 * the UI never leaves a ticket locked. A shutdown that fails is **reported and exits non-zero**
 * rather than being swallowed, because what it failed to do is release those runs.
 *
 * Ctrl-C is the documented way to stop this command, and it still exits {@link SIGNAL}: the table is
 * closed at five codes and re-interpreting one of them for the single command whose job is to keep
 * running is not a decision to take in passing (Q-0126 OQ-5).
 */
export const openOn = (
  { bundle = BUNDLE, launcher }: { bundle?: string | URL; launcher?: Parameters<typeof openUrl>[1] } = {},
): CommandHandler => async ({ rest, flags }) => {
  // AC-2's clause that this command accepts no positional argument, enforced rather than merely
  // unread: `quorum open my-project` is the mistake the shape invites — `init` takes a directory
  // there — and a handler that ignored `rest` would serve the working directory instead, which is
  // the silent default `.claude/rules/engineering.md` forbids. The first token is named because it
  // is the one that is wrong, and {@link USAGE} beside it is what the command does take.
  if (rest.length > 0) die(`quorum open takes no positional argument, and was given ${JSON.stringify(rest[0])} — ${USAGE}`);

  // The same clause where the parser hides it from `rest`. `argv.ts:54` gives a flag the token after
  // it unless that token starts with `--` (Q-0090 AC-2's preserved behaviour 4), so
  // `quorum open --no-open my-project` parks the path in this flag and leaves `rest` empty: the
  // guard above sees nothing, a truthy string switches the launch off exactly as `true` would, and
  // the argument the person typed is discarded in silence — the failure that guard exists to
  // prevent, one token further along. **This is the command's only valueless flag**, which is what
  // bounds the check to one: `--port` is spelled rather than coerced (see {@link portFrom}) and
  // `--project` takes a value, so a token after either belongs to that flag.
  const noOpen = flags['no-open'];
  if (noOpen !== undefined && noOpen !== true) {
    die(`--no-open takes no value, and was given ${JSON.stringify(noOpen)} — ${USAGE}`);
  }

  const project = projectAt(flags.project);
  const port = portFrom(flags.port);

  let listening;
  try {
    listening = await createDaemon({ project, port, bundle });
  } catch (error) {
    // Two conditions reach here and they are told apart by `code` rather than by message: a port
    // something else holds, and `serve`'s own refusal for a bundle root that carries no build. The
    // second is composed by `packages/server`'s `bundleRefusal`, names the directory and the entry
    // it wanted, and is rendered unaltered — this module composes no advice of its own for it.
    if (isPortInUse(error)) die(`port ${String(port)} is already in use`);
    if (isMissingBundle(error)) die((error as Error).message);
    // **Everything else propagates, and that is the whole of Q-0126 run 2 iteration 5's major.**
    // This arm read `if (error instanceof Error) die(error.message)` until then, which rendered a
    // permission failure, a defect inside `packages/server` and a bundle that is genuinely absent as
    // one sentence and dropped the stack — asserting a cause it had not established, and hiding the
    // one failure a maintainer could act on. AC-4 authorises catching the missing bundle; AC-5
    // authorises `EADDRINUSE`; nothing authorises the rest, so the rest reaches
    // `main().catch(dieOnUnexpected)` as a stack. It is the same shape the daemon's own catch had
    // until Q-0124 removed the case for one, and it outlives that removal because a start can still
    // fail for reasons this command has not established.
    throw error;
  }

  // Armed BEFORE anything that can take time, and awaited last. `untilStopped` registers its two
  // handlers synchronously, so from here on Ctrl-C reaches this command whatever the launcher below
  // is doing — which is what `docs/USAGE.md`'s claim that Ctrl-C stops it costs. A launcher that
  // does not return is the case: `xdg-open` may exec a browser in the foreground where no desktop
  // opener answers, and without this the stop would have to wait for the browser to be closed.
  const stopped = untilStopped();
  const url = `http://${BIND_HOSTNAME}:${String(listening.port)}`;
  console.log(servingLine(url));

  // `undefined` and not falsiness, because the guard above has already left this `true` or absent:
  // the launch happens where the operator did not type the flag, and nowhere else.
  if (noOpen === undefined) {
    // Raced against the stop for the reason above, and `undefined` is the arm that means the person
    // stopped the command first — which is not a launch failure and is not warned about.
    const result = await Promise.race([openUrl(url, launcher), stopped.then(() => undefined)]);
    if (result !== undefined && result.state !== 'launched') console.error(launchWarning(result, url));
  }
  await stopped;

  try {
    await listening.close();
  } catch (error) {
    die(`the daemon did not shut down cleanly: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(SIGNAL);
};

/**
 * `quorum open` against the bundle `@quorum/web` names — the handler the frame registers, and the
 * only one an operator can reach.
 *
 * **Both parameters above are `run.ts`'s `runOn({ … })` at a second site, and neither is a flag.**
 * Non-goal 6 refuses a `--bundle`, so there stays exactly one way for an operator to find the
 * bundle; what `bundle` buys is a test that can serve a fixture without writing into a sibling
 * package's emit directory — a write that would race `build.test.ts`'s own `runBuild()`.
 * `test/invoke.ts`'s `capture` documents the same shape for the gate reader's streams. What Q-0126
 * AC-3 claims is that the shipped root is derived rather than taken from the working directory or
 * the environment, and this default is that root — resolved through `@quorum/web` since Q-0124,
 * where it was resolved relative to this module before.
 *
 * **`launcher` is `openUrl`'s own options object and is deliberately not a stub of `openUrl`**: a
 * test that replaced the function would prove this module calls something, where one that supplies
 * the spawn drives the shipped table, the shipped four states and the shipped refusal to infer a
 * missing browser from a failed launch. It is typed off that function rather than through a new
 * name on `@quorum/core`'s barrel, which is what keeps this ticket's export count at one.
 */
export const open: CommandHandler = openOn();
