/**
 * Opening a URL in the platform's default browser: one table, one spawn, one closed answer.
 *
 * The ninth folder, and it is named for what it is about. `packages/cli` may spawn nothing — every
 * production module of that package is refused `node:child_process`, on the stated ground that every
 * read and every spawn goes through `@quorum/core` — so the browser half of `quorum open` cannot sit
 * in the package whose command it serves, which is Q-0093's precedent for `initProject`. Why: see
 * *"`core` opens a URL, and the ninth folder is named for what it is about"* (2026-09-14), which also
 * widens principle 1's enumeration by this one item and by nothing else.
 *
 * **The URL is an argv element and never part of a command string.** {@link LAUNCHER} names an
 * executable per platform and {@link openUrl} hands it exactly one argument, so there is no shell,
 * no interpolation and therefore no injection surface — which is the property that makes the
 * principle's widening safe to state at all (entry clause 4).
 *
 * **Windows is `unsupported`, explicitly.** Its `start` is a `cmd.exe` builtin rather than an
 * executable, so an argument-based spawn cannot exec it and the alternative composes the URL into a
 * command string, which the paragraph above refuses. It is therefore absent from the table and
 * answers {@link BrowserLaunch}'s `unsupported-platform`, which is a smaller promise than a row
 * nobody has run (entry clause 5). This repository has never claimed Windows support.
 *
 * **What this folder may not claim is the reason its result is a closed set.** It cannot see a
 * browser: it knows the process it started and how that process exited. So `launched` says the
 * launcher exited zero and never that a page is showing, and no state says there is no browser —
 * *"A probe that could not answer is not a negative"* (2026-09-10) at the site Q-0074 and Q-0115
 * spent two tickets removing instances of.
 *
 * **The states are declared here rather than in `@quorum/shared`, and that is a departure from the
 * three unions the entry compares this to.** Containment, push lag and verified version are each
 * declared there because a second *package* renders them and `@quorum/shared` is what two packages
 * may define against — the wire and the browser bundle among them. This one has a single consumer,
 * `packages/cli`'s `open` command, which reaches it through the same barrel as the function it
 * comes from; and `shared` is declarations a browser bundle may hold, which is the last place a
 * launcher's vocabulary belongs. What the entry compares is the **discipline** — a closed set, and
 * never an answer the probe did not give — and that is what is carried here.
 */
import { spawn } from 'node:child_process';

/**
 * The launcher per platform, as `process.platform` spells it.
 *
 * A table rather than a chain of conditionals, so a platform is a row that is present or absent and
 * never a branch that fell through. What is absent is `unsupported-platform` rather than a guess:
 * `xdg-open` exists on the BSDs too and this product has run on neither, so naming them would be a
 * claim rather than a measurement.
 */
const LAUNCHER: Readonly<Record<string, string>> = {
  darwin: 'open',
  linux: 'xdg-open',
};

/**
 * What a launch attempt did — exactly four, and none of them is a claim about a browser.
 *
 * `launched` means the launcher was spawned and exited zero. `unsupported-platform` means
 * {@link LAUNCHER} has no row for this platform, which is a fact about the table. Both of the
 * remaining two are failures and neither is a negative: `executable-unavailable` says the operating
 * system reported no such file for the launcher this platform names — an observation about
 * `open` or `xdg-open`, never about whether a browser is installed — and `launch-failed` is the
 * member that means *could not tell*, which is where every other failure goes.
 */
export type BrowserLaunch =
  | { readonly state: 'launched'; readonly command: string }
  | { readonly state: 'unsupported-platform'; readonly platform: string }
  | { readonly state: 'executable-unavailable'; readonly command: string }
  | { readonly state: 'launch-failed'; readonly command: string; readonly reason: string };

/** Every member of {@link BrowserLaunch}'s `state`, so a caller can be checked against the set. */
export const BROWSER_LAUNCH_STATES = [
  'launched', 'unsupported-platform', 'executable-unavailable', 'launch-failed',
] as const;

/**
 * How {@link openUrl} starts a process: the launcher's exit code, or a rejection.
 *
 * `null` is what Node reports for a child a signal killed, and it is a failure like any other here.
 * The seam exists so the table and the four states can be proven per platform without a test opening
 * a browser on the machine it runs on, which *"A test's verdict is a property of the commit, not of
 * the checkout or the account"* (2026-08-30) would otherwise be decided by.
 */
export type LaunchSpawn = (command: string, args: readonly string[]) => Promise<number | null>;

/** What {@link openUrl} reads beyond the URL. Both default to the real thing. */
export interface OpenUrlOptions {
  /** The platform to look up in {@link LAUNCHER}; `process.platform` unless a test supplies one. */
  readonly platform?: string;
  /** How the launcher is started; the real spawn unless a test supplies one. */
  readonly spawn?: LaunchSpawn;
}

/**
 * The real launcher: one child, its own process group, nothing of its output read.
 *
 * **`detached` is the load-bearing option and it is not a tidy-up.** Without it the launcher — and
 * on Linux any browser it execs rather than hands off to — shares this process's group, so the
 * Ctrl-C that stops `quorum open` would reach a browser the operator is at that moment reading.
 * `unref` follows from it: this process must not be held open by a child it has stopped waiting for.
 *
 * `stdio: 'ignore'` because `core` prints nothing and this folder has nothing to parse. The bound
 * that costs, stated rather than left to be found: a launcher that fails with a message can report
 * only its exit code here, so {@link BrowserLaunch}'s `reason` names the code and not the sentence.
 */
const spawnLauncher: LaunchSpawn = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, [...args], { stdio: 'ignore', detached: true });
  child.on('error', reject);
  child.on('close', (code) => { resolve(code); });
  child.unref();
});

/**
 * Ask the platform's default browser to open `url`, and say what happened.
 *
 * The one place in this workspace that launches a browser, which `browser.source.test.ts` asserts
 * over every package rather than over this folder.
 *
 * @param url handed to the launcher as a single argv element, exactly as given.
 * @param options the platform and the spawn, both defaulted to the real ones.
 * @returns one of {@link BrowserLaunch}'s four states. It never rejects: a launcher that could not
 *   be started is something the caller reports in a sentence, which is `exec`'s rule one folder
 *   over, and it is a warning rather than a failed run at every call site this product has.
 */
export async function openUrl(
  url: string,
  { platform = process.platform, spawn: launch = spawnLauncher }: OpenUrlOptions = {},
): Promise<BrowserLaunch> {
  const command = LAUNCHER[platform];
  if (command === undefined) return { state: 'unsupported-platform', platform };
  try {
    const code = await launch(command, [url]);
    if (code === 0) return { state: 'launched', command };
    // A non-zero exit is the launcher's own verdict and says nothing about what is installed, so it
    // is `launch-failed` and never `executable-unavailable`. Both spellings of "it did not exit
    // zero" are carried, because a signal and a status are different things to read in a warning.
    return {
      state: 'launch-failed',
      command,
      reason: code === null ? `${command} was killed by a signal` : `${command} exited ${String(code)}`,
    };
  } catch (error) {
    // `ENOENT` is the one failure that is an observation rather than an absence of one: the
    // operating system looked for this executable and reported that it is not there. Everything
    // else — a permission, a resource limit, a spawn this process could not complete — is a
    // question that was not answered, and answers `launch-failed`.
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT') return { state: 'executable-unavailable', command };
    return { state: 'launch-failed', command, reason: error instanceof Error ? error.message : String(error) };
  }
}
