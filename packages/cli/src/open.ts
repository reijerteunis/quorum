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
 * **The daemon is reached through a dynamic import, and that is a packaging constraint rather than
 * a style.** `@quorum/cli` declares `@quorum/server` under `optionalDependencies`, so an
 * installation that could not resolve it still installs; `main.ts` imports every command module
 * statically and dispatches from a table, so the module is loaded whatever command was typed, and a
 * static specifier here would make `quorum help` die with `ERR_MODULE_NOT_FOUND` on that
 * installation. What must be deferred is therefore the **specifier**, not the module. Both halves
 * are required and neither rescues the other. Why: see *"An optional edge says the daemon may be
 * absent, and never why"* (2026-09-14).
 *
 * **What the refusal may claim is the other half of that entry.** An import that did not resolve
 * cannot tell an installation deliberately without the daemon from one that is damaged, so
 * {@link NO_DAEMON_CONDITION} reports what failed to resolve *here* and names the workspace that
 * carries it, and says nothing about why. A failed probe is not a proven negative — *"A probe that
 * could not answer is not a negative"* (2026-09-10).
 *
 * **And it is reached only where that package is what failed to resolve.** A daemon that resolved
 * and then failed — a syntax error, a top-level throw, a dependency missing from inside it — is a
 * package that *is* here, so rendering one of those as *did not resolve from this installation*
 * would assert the absence that entry forbids asserting and bury an actionable failure behind a
 * packaging sentence. {@link isDaemonUnresolved} is that distinction, and everything it does not
 * recognise propagates as itself.
 *
 * **The bundle root is this module's own location and nothing else.** `process.cwd()` answers the
 * operator's directory and an environment variable answers whatever was exported, which is the
 * argument `static.ts`'s header already makes for the daemon and which reaches its caller unchanged.
 * It travels as a `URL` because this package may import no `node:url` — see {@link BUNDLE}.
 *
 * **The order of the three refusals is ruled** — daemon, then project, then bundle. On a packed
 * install this file sits at `node_modules/@quorum/cli/dist/`, so {@link BUNDLE} resolves to a path
 * with no meaning there, and checking it first would report *no build at `node_modules/apps/web/dist`*
 * instead of the true thing, which is that this installation did not resolve the daemon. The two
 * argv refusals sit ahead of all three and are not further members of that order: those three are
 * claims about an *installation*, and these are about what was typed, which is wrong on every
 * installation and costs nothing to establish.
 */
import { loadProject, openUrl, ProjectNotFoundError, type BrowserLaunch } from '@quorum/core';
import { DEFAULT_DAEMON_PORT, NO_BUNDLE_CODE } from '@quorum/shared';

import { c } from './colour.js';
import { die, dieNoProject } from './fail.js';
import { SIGNAL } from './exit.js';
import type { CommandHandler } from './main.js';

/**
 * The built web app, resolved relative to this module and to nothing else.
 *
 * **A `URL`, handed across the package boundary unconverted**, which is the shape `init.ts`'s
 * `TEMPLATES` already has and for the identical reason: `frame.source.test.ts`'s `IO_MODULE`
 * refuses `node:url` in every production module of this package, so `fileURLToPath` is not
 * available here — and `new URL(…).pathname` is not a substitute, because it leaves percent-encoding
 * in place, so an installation under a path containing a space would resolve to a directory that
 * does not exist and be refused for a build that is present. `ServeOptions.bundle` therefore takes
 * `string | URL` and `packages/server` converts at the one site that needs a path.
 *
 * Three levels up because this module sits at `<package>/src/` under the source condition and at
 * `<package>/dist/` under the emit, and 078(e) fixes that depth so both answer the same directory.
 */
const BUNDLE = new URL('../../../apps/web/dist/', import.meta.url);

/**
 * What this command says when `@quorum/server` did not resolve.
 *
 * Two constants rather than one sentence, on `refusal.ts`'s split: the **condition** is what was
 * observed and the **remedy** is what this surface offers for it. It names no cause, because the
 * import cannot establish one — it may not say the daemon is missing, broken or deliberately
 * omitted, all three of which are claims about an installation this process cannot inspect.
 */
export const NO_DAEMON_CONDITION = '@quorum/server did not resolve from this installation';

/** The remedy for {@link NO_DAEMON_CONDITION}: where the daemon is, and what is unaffected. */
export const NO_DAEMON_REMEDY =
  'the Quorum workspace carries it at packages/server; every other command works here';

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
 * By `code` and never by message, which is what {@link isPortInUse} does and what
 * {@link isDaemonUnresolved} has to depart from for want of anything else to read. `serve` attaches
 * {@link NO_BUNDLE_CODE} at the throw site precisely so this caller need not read a sentence, and
 * the sentence it then renders is `packages/server`'s own, unaltered.
 */
const isMissingBundle = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === NO_BUNDLE_CODE;

/**
 * Whether `error` is the daemon's own specifier failing to **resolve**, rather than a failure of
 * something inside a package that resolved perfectly well.
 *
 * **Two clauses, because the `code` alone cannot separate the four shapes — measured against Node
 * rather than reasoned about.** An installation carrying no daemon raises `ERR_MODULE_NOT_FOUND`
 * with `Cannot find package '@quorum/server' imported from …`; a dependency missing from *inside*
 * the daemon raises **the identical code** with `Cannot find package 'hono' imported from
 * …/@quorum/server/dist/index.js`. A module that will not parse is a `SyntaxError` and a top-level
 * throw is whatever was thrown, and neither carries a `code` at all. So the code separates two of
 * the shapes and the **quoted** specifier separates the other two: Node quotes the specifier it
 * could not find and leaves the importer's path beside it unquoted, which is what keeps this from
 * matching a path that merely contains the daemon's own directory.
 *
 * **Reading a message is what {@link isPortInUse} above refuses to do, and this exception is bounded
 * rather than an oversight.** There is nothing else to read — the error's own properties are
 * `stack`, `code` and `message` — so the specifier that failed is in the sentence or nowhere. What
 * makes it safe is the direction it fails in: a runtime that rewords that sentence stops matching,
 * and an error this does not recognise **propagates** to `main().catch(dieOnUnexpected)` as a stack
 * instead of being reported as an absence. A rewording costs the refusal, never the truth of it, and
 * `build.test.ts`'s packed fixture is what goes red the day one arrives.
 */
export function isDaemonUnresolved(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (code !== 'ERR_MODULE_NOT_FOUND' || typeof message !== 'string') return false;
  return message.includes("'@quorum/server'");
}

/**
 * The daemon's module, or this command's one refusal.
 *
 * The specifier is deferred and nothing else is: the module must not be named anywhere `tsc` would
 * resolve it eagerly, which is why the return type is a `typeof import(...)` query — erased by the
 * compiler, so the only occurrence the emit *loads* anything for is inside this call.
 */
async function daemon(): Promise<typeof import('@quorum/server')> {
  try {
    return await import('@quorum/server');
  } catch (error) {
    // Only this package failing to resolve becomes the refusal; a daemon that resolved and then
    // failed is rethrown so `main().catch(dieOnUnexpected)` prints its stack, which is `run.ts`'s
    // own shape for the same distinction. Why: see *"An optional edge says the daemon may be absent,
    // and never why"* (2026-09-14), clause 2.
    if (!isDaemonUnresolved(error)) throw error;
    return die(`${NO_DAEMON_CONDITION} — ${NO_DAEMON_REMEDY}`);
  }
}

/**
 * The project this daemon serves, or the sentence a stranger reads when there is none.
 *
 * `run.ts`'s `openProject` at a second site, and reached through `@quorum/core` rather than through
 * `@quorum/server`'s own `openProject` — which is measured rather than stylistic. That symbol lives
 * in the package that may not be installed, so routing project resolution through it would make
 * *no project here* unreportable on exactly the installation where the daemon is absent.
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

  const { BIND_HOSTNAME, createDaemon } = await daemon();
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
    // `main().catch(dieOnUnexpected)` as a stack. Same shape as {@link isDaemonUnresolved} above,
    // and the same reason: *"An optional edge says the daemon may be absent, and never why"*
    // (2026-09-14) clause 2.
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
 * `quorum open` against the bundle this module's own location names — the handler the frame
 * registers, and the only one an operator can reach.
 *
 * **Both parameters above are `run.ts`'s `runOn({ … })` at a second site, and neither is a flag.**
 * Non-goal 6 refuses a `--bundle`, so there stays exactly one way for an operator to find the
 * bundle; what `bundle` buys is a test that can serve a fixture without writing into a sibling
 * package's emit directory — a write that would race `build.test.ts`'s own `runBuild()`.
 * `test/invoke.ts`'s `capture` documents the same shape for the gate reader's streams. What AC-3
 * claims is that the shipped root is module-relative rather than taken from the working directory or
 * the environment, and this default is that root.
 *
 * **`launcher` is `openUrl`'s own options object and is deliberately not a stub of `openUrl`**: a
 * test that replaced the function would prove this module calls something, where one that supplies
 * the spawn drives the shipped table, the shipped four states and the shipped refusal to infer a
 * missing browser from a failed launch. It is typed off that function rather than through a new
 * name on `@quorum/core`'s barrel, which is what keeps this ticket's export count at one.
 */
export const open: CommandHandler = openOn();
