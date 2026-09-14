/**
 * Q-0126 AC-12 and AC-13 — the platform table and the closed result set.
 *
 * **Nothing here opens a browser**, and that is a property of the file rather than a hope: every
 * test supplies its own {@link LaunchSpawn}, so no assertion below depends on what is installed on
 * the machine running it (*"A test's verdict is a property of the commit, not of the checkout or the
 * account"*, 2026-08-30). `browser.source.test.ts` is the other half, and asserts that the real
 * spawn is the only one in the workspace.
 */
import { describe, expect, test } from 'vitest';

import { BROWSER_LAUNCH_STATES, openUrl, type BrowserLaunch, type LaunchSpawn } from './browser.js';

/** A spawn that records what it was asked to start and then reports `code`. */
function recording(code: number | null = 0): { spawn: LaunchSpawn; calls: [string, readonly string[]][] } {
  const calls: [string, readonly string[]][] = [];
  return {
    calls,
    spawn: (command, args) => {
      calls.push([command, args]);
      return Promise.resolve(code);
    },
  };
}

/** A spawn that fails the way `error` says, which is how the two failure states are told apart. */
const failing = (error: unknown): LaunchSpawn => () => Promise.reject(error);

/** An `ENOENT` as Node raises it, so the one observation this module may make has a real shape. */
const noSuchFile = (): NodeJS.ErrnoException =>
  Object.assign(new Error('spawn xdg-open ENOENT'), { code: 'ENOENT' });

const URL_UNDER_TEST = 'http://127.0.0.1:7717';

describe('AC-12 — the launcher is a table, and the URL is one argv element', () => {
  test('darwin spawns `open` and linux spawns `xdg-open`, each with the URL alone', async () => {
    for (const [platform, command] of [['darwin', 'open'], ['linux', 'xdg-open']] as const) {
      const { spawn, calls } = recording();
      const result = await openUrl(URL_UNDER_TEST, { platform, spawn });
      expect(result, platform).toStrictEqual({ state: 'launched', command });
      expect(calls, `${platform} did not spawn exactly once`).toHaveLength(1);
      expect(calls[0][0], `${platform} spawned the wrong executable`).toBe(command);
      expect(calls[0][1], `${platform} passed more than the URL`).toStrictEqual([URL_UNDER_TEST]);
    }
  });

  test('and the table is what selects it — a platform it has no row for spawns nothing at all', async () => {
    // The clause that keeps the table a table. `win32` is the row this product deliberately does not
    // have — `start` is a `cmd.exe` builtin rather than an executable — and it is asserted beside a
    // platform nobody has considered, so the answer is a property of the row's absence rather than
    // of a branch written for Windows. Why: see *"`core` opens a URL, and the ninth folder is named
    // for what it is about"* (2026-09-14) clause 5.
    for (const platform of ['win32', 'freebsd', 'aix']) {
      const { spawn, calls } = recording();
      expect(await openUrl(URL_UNDER_TEST, { platform, spawn }), platform)
        .toStrictEqual({ state: 'unsupported-platform', platform });
      expect(calls, `${platform} spawned something`).toStrictEqual([]);
    }
  });

  test('a URL carrying shell metacharacters reaches the launcher unmodified and unquoted', async () => {
    // What "never composed into a shell string" means as a behaviour rather than as a source scan.
    // Under any shell composition this URL would be split, globbed or worse; as one argv element it
    // arrives exactly as it was given, which is the property the principle's widening rests on.
    const hostile = 'http://127.0.0.1:7717/?a=b c&d=$(id);rm -rf /|x`y`*';
    const { spawn, calls } = recording();
    await openUrl(hostile, { platform: 'darwin', spawn });
    expect(calls[0][1]).toStrictEqual([hostile]);
    expect(calls[0][1][0], 'the URL was quoted, escaped or otherwise rewritten').toBe(hostile);
  });
});

describe('AC-13 — four states, each produced, and a failure is never a negative', () => {
  test('every member of the closed set is reachable, and nothing outside it is', async () => {
    const produced: BrowserLaunch[] = [
      await openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: recording(0).spawn }),
      await openUrl(URL_UNDER_TEST, { platform: 'win32', spawn: recording(0).spawn }),
      await openUrl(URL_UNDER_TEST, { platform: 'linux', spawn: failing(noSuchFile()) }),
      await openUrl(URL_UNDER_TEST, { platform: 'linux', spawn: recording(3).spawn }),
    ];
    expect(produced.map((one) => one.state))
      .toStrictEqual(['launched', 'unsupported-platform', 'executable-unavailable', 'launch-failed']);
    // Every one of the four is in the register, and the register holds nothing this module cannot
    // produce — so neither side can grow a member the other does not have.
    expect([...BROWSER_LAUNCH_STATES].sort()).toStrictEqual([...new Set(produced.map((one) => one.state))].sort());
  });

  test('a spawn that throws is `could not tell`, and never the executable-unavailable one', async () => {
    // The clause AC-13 states in as many words. A permission failure, a resource limit and a plain
    // `Error` are each a question that was not answered — the module did not establish that the
    // launcher is absent, and reporting that it is would be *"a failed probe read as a proven
    // negative"* (Q-0074, Q-0115).
    for (const error of [
      Object.assign(new Error('spawn open EACCES'), { code: 'EACCES' }),
      Object.assign(new Error('spawn open EAGAIN'), { code: 'EAGAIN' }),
      new Error('something else entirely'),
      'not an Error at all',
    ]) {
      const result = await openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: failing(error) });
      expect(result.state, `${String(error)} was classified as an observation`).toBe('launch-failed');
      expect(result.state).not.toBe('executable-unavailable');
      expect(result, 'the reason did not survive').toMatchObject({ command: 'open' });
    }
  });

  test('and ENOENT is the one failure that IS an observation, so that member is not dead', async () => {
    // The other direction, which is what stops the clause above collapsing the set to three: the
    // operating system looked for this executable and said it is not there. The state names the
    // LAUNCHER and no state in the union names a browser, which is the distinction clause 6 draws.
    const result = await openUrl(URL_UNDER_TEST, { platform: 'linux', spawn: failing(noSuchFile()) });
    expect(result).toStrictEqual({ state: 'executable-unavailable', command: 'xdg-open' });
    expect(BROWSER_LAUNCH_STATES.join(' '), 'a state claims something about a browser')
      .not.toMatch(/browser/);
  });

  test('a non-zero exit and a signal are both `launch-failed`, and each says which', async () => {
    const exited = await openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: recording(1).spawn });
    expect(exited).toStrictEqual({ state: 'launch-failed', command: 'open', reason: 'open exited 1' });
    const signalled = await openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: recording(null).spawn });
    expect(signalled)
      .toStrictEqual({ state: 'launch-failed', command: 'open', reason: 'open was killed by a signal' });
  });

  test('`launched` is what the launcher did, which is why a zero exit is the whole of it', async () => {
    // The claim clause 6 forbids, as an assertion rather than a sentence: nothing in a `launched`
    // result names a page, a window or a browser — it names the executable that exited zero.
    const result = await openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: recording(0).spawn });
    expect(Object.keys(result).sort()).toStrictEqual(['command', 'state']);
    expect(JSON.stringify(result)).not.toMatch(/browser|open(ed|ing)|show/i);
  });

  test('it never rejects, whatever the spawn does', async () => {
    // `exec`'s rule one folder over, and what makes AC-15's warning possible: a caller renders a
    // sentence, and a caller that had to catch would have to decide what an unclassified throw
    // means — which is the decision this closed set exists to have already taken.
    await expect(openUrl(URL_UNDER_TEST, { platform: 'darwin', spawn: () => { throw new Error('sync'); } }))
      .resolves.toMatchObject({ state: 'launch-failed' });
  });
});
