/**
 * Q-0099 AC-7, AC-8 and AC-9's second half for `quorum adapters`.
 *
 * **Every assertion here is new.** No file under `spike/test/` outside `smoke.js` exercises this
 * command — the one occurrence of the string in `q0033-surface.js` is a flow-lint scenario about a
 * review panel spanning two adapters — and `smoke.js` is Q-0095's. So there is nothing to translate
 * and nothing to compare against; `spike-parity.test.ts` records that absence in words rather than
 * leaving it as a silence.
 *
 * **The registry is stubbed, and the stub is asserted to be in force.** `adapter.check()` runs
 * `claude --version` and `codex --version`, and `probeAdapter` makes a real billed request against
 * whatever login the machine has — Q-0001 measured a hello-world probe inside a project at $0.39. A
 * suite that reached either would have a verdict that is a property of the machine and of the
 * account, which *"A test's verdict is a property of the commit"* (2026-08-30) forbids, and would
 * spend money doing it. `vi.mock` replaces exactly the two symbols and leaves `loadProject` and
 * `ProjectNotFoundError` real, so the project-opening half is still the shipped path.
 *
 * Nothing here spawns the binary, and nothing here spells a key: the BYOS claim is made by showing
 * that whatever an adapter throws reaches the terminal unaltered, so the sentence stays `core`'s and
 * this file never has to know it (AC-8(a), (b)).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getAdapter, probeAdapter } from '@quorum/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SUCCESS } from './exit.js';
import { invoke, plain, type Invocation } from '../test/invoke.js';

vi.mock('@quorum/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@quorum/core')>();
  return { ...actual, getAdapter: vi.fn(), probeAdapter: vi.fn() };
});

/** What a stubbed `check()` does: answer a version, or refuse with a sentence. */
type Check = { version: string } | { refusal: string };

/**
 * What a stubbed `probeAdapter` answers — the two arms of `core`'s `ProbeResult`, structurally.
 *
 * Declared here rather than imported because the type is not on `@quorum/core`'s barrel, and a
 * command child does not widen that surface to type its own fixture (AC-10, ground rule 4).
 */
type Probe =
  | { ok: true; vendor: string; ms: number; cost_usd: number | null; tokens: number; session: string | null }
  | { ok: false; vendor: string; ms: number; error: string; raw?: string };

let root = '';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-adapters-')));
  fs.mkdirSync(path.join(root, 'harness'), { recursive: true });
  fs.mkdirSync(path.join(root, 'backlog'), { recursive: true });
  fs.writeFileSync(path.join(root, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n', 'utf8');
  // A repository with two refs, so AC-9's ref snapshot has something to compare rather than the
  // empty string on both sides. The identity is spelled at the call site because
  // `packages/core/src/git-identity.test.ts` reads literals (2026-08-30).
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'fixture');
  git(root, 'branch', 'harness/T-0001/integration');

  // The default is a loud failure rather than an empty mock: a case that installed no stub would
  // otherwise reach `undefined.check()` and read as a code defect, and a case that reached the real
  // registry would spawn a vendor CLI. `getAdapter` is called OUTSIDE the command's `try`, exactly
  // as the spike calls it, so this throw is not swallowed into a per-adapter `✗` line.
  vi.mocked(getAdapter).mockImplementation((name) => {
    throw new Error(`no stub installed for "${name}" — this case would have reached the real registry`);
  });
  vi.mocked(probeAdapter).mockImplementation(() => {
    throw new Error('no probe stub installed — this case would have billed a subscription');
  });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Install a `check()` per vendor, and optionally a probe answer per vendor. */
function stub(checks: Record<string, Check>, probes: Record<string, Probe> = {}): void {
  vi.mocked(getAdapter).mockImplementation((name) => {
    const check = checks[name];
    if (check === undefined) throw new Error(`the fixture named no vendor "${name}"`);
    return {
      vendor: name,
      check: () => ('version' in check ? Promise.resolve(check.version) : Promise.reject(new Error(check.refusal))),
      run: (): never => {
        throw new Error('a probe reached adapter.run — probeAdapter is stubbed and must not be bypassed');
      },
    };
  });
  vi.mocked(probeAdapter).mockImplementation((adapter) => {
    const probe = probes[adapter.vendor];
    if (probe === undefined) throw new Error(`the fixture named no probe for "${adapter.vendor}"`);
    return Promise.resolve(probe);
  });
}

/**
 * A successful probe with every measure reported, which the cases below vary one field of.
 *
 * Typed as the `ok: true` arm rather than as the union, so `{ ...verified('claude'), cost_usd: null }`
 * stays that arm: spreading a union widens it, and the excess-property check would then reject a
 * field the failing arm has no room for.
 */
const verified = (vendor: string): Extract<Probe, { ok: true }> =>
  ({ ok: true, vendor, ms: 1234, cost_usd: 0.0031, tokens: 4200, session: 's-1' });

const run = async (...flags: string[]): Promise<Invocation> =>
  invoke(['adapters', '--project', root, ...flags]);

/** Everything a caller sees, ANSI stripped. */
const out = (result: Invocation): string => plain(`${result.stdout}${result.stderr}`);

/** The `{ probed, adapters }` document `--json` prints, parsed out of the tail of the output. */
function json(result: Invocation): { probed: boolean; adapters: Record<string, unknown>[] } {
  const text = plain(result.stdout);
  const start = text.indexOf('{');
  expect(start, 'no JSON document was printed').toBeGreaterThanOrEqual(0);
  return JSON.parse(text.slice(start)) as { probed: boolean; adapters: Record<string, unknown>[] };
}

describe('AC-7 — presence', () => {
  test('the stub is in force, so no case here can reach a real vendor CLI', () => {
    // Asserted rather than assumed: without this every case below could be passing because the
    // machine happens to have both CLIs installed, which is exactly the verdict-from-the-machine
    // failure the mock exists to prevent (R-2, R-3).
    expect(vi.isMockFunction(getAdapter), 'the registry is the real one').toBe(true);
    expect(vi.isMockFunction(probeAdapter), 'the probe is the real one').toBe(true);
  });

  test('both present — one line each, claude then codex, and the presence-only notice', async () => {
    stub({ claude: { version: '2.1.231' }, codex: { version: '0.149.1' } });
    const result = await run();
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const lines = out(result).split('\n');
    expect(lines[0]).toBe('✓ claude: 2.1.231');
    expect(lines[1]).toBe('✓ codex: 0.149.1');
    // Preserved verbatim, `harness` included: the binary named in it is Q-0100's, which owns all
    // five such sentences at once rather than one command at a time.
    expect(out(result)).toContain('· presence only — logins NOT verified; run `harness adapters --probe` before a real run');
    // check() proves presence and nothing else, so nothing was probed and nothing was billed.
    expect(vi.mocked(probeAdapter), 'presence alone must make no authenticated request').not.toHaveBeenCalled();
    expect(vi.mocked(getAdapter).mock.calls.map((call) => call[0])).toStrictEqual(['claude', 'codex']);
  });

  test('one absent — it is reported and the loop continues to the second', async () => {
    stub({ claude: { refusal: 'claude not found on PATH' }, codex: { version: '0.149.1' } });
    const result = await run();
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const lines = out(result).split('\n');
    expect(lines[0]).toBe('✗ claude: claude not found on PATH');
    expect(lines[1], 'the loop stopped at the first failure').toBe('✓ codex: 0.149.1');
  });

  test('and its report entry records the failure without a version or a login', async () => {
    stub({ claude: { refusal: 'claude not found on PATH' }, codex: { version: '0.149.1' } });
    const result = await run('--json');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(json(result).adapters[0]).toStrictEqual({
      adapter: 'claude', installed: false, error: 'claude not found on PATH',
    });
    expect(json(result).adapters[1]).toStrictEqual({
      adapter: 'codex', installed: true, version: '0.149.1', login: 'unverified',
    });
  });
});

describe('AC-7 — --probe', () => {
  test('a verified login prints the round-trip, the cost and the tokens, indented under its adapter', async () => {
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: verified('claude'), codex: verified('codex') },
    );
    const result = await run('--probe');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const lines = out(result).split('\n');
    expect(lines[0]).toBe('✓ claude: 2.1.231');
    expect(lines[1]).toBe('  ✓ login verified — round-trip 1234ms, $0.0031, 4200 tokens');
    // Probed with the resolved project directory, so the round-trip happens where the run would.
    expect(vi.mocked(probeAdapter).mock.calls[0]?.[1]).toStrictEqual({ cwd: root });
    expect(out(result), 'presence-only was claimed after a probe').not.toContain('presence only');
  });

  test('a failed login is one bold sentence and the command still exits 0', async () => {
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      {
        claude: { ok: false, vendor: 'claude', ms: 90, error: 'login expired — run `claude /login`' },
        codex: verified('codex'),
      },
    );
    const result = await run('--probe');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result).split('\n')[1]).toBe('  ✗ login not usable: login expired — run `claude /login`');
    expect(json(await run('--probe', '--json')).adapters[0]).toMatchObject({
      adapter: 'claude', installed: true, version: '2.1.231', login: 'failed', ok: false,
    });
  });

  test('a null cost is absent from the line rather than rendered $0.0000', async () => {
    // `null` is "the vendor reported no price", which is not zero — printing `$0.0000` would make a
    // token-only vendor indistinguishable from a free call, which is the whole of the tokens-only
    // decision (2026-08-22).
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: { ...verified('claude'), cost_usd: null }, codex: verified('codex') },
    );
    const result = await run('--probe');
    expect(out(result).split('\n')[1]).toBe('  ✓ login verified — round-trip 1234ms, 4200 tokens');
    expect(out(result), 'a vendor that reported no price was priced at zero').not.toContain('$0.0000');
  });

  test('a zero token count is absent too, because the clause is truthiness and not presence', async () => {
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: { ...verified('claude'), tokens: 0 }, codex: verified('codex') },
    );
    const result = await run('--probe');
    expect(out(result).split('\n')[1]).toBe('  ✓ login verified — round-trip 1234ms, $0.0031');
    expect(out(result)).not.toContain(', 0 tokens');
  });
});

describe('AC-7 — --json', () => {
  test('the report is printed after the human lines, not instead of them', async () => {
    // Deliberately a combined stream and not a JSON-only one: a consumer piping it gets both,
    // exactly as today. Redefining it is a separately authorised contract change.
    stub({ claude: { version: '2.1.231' }, codex: { version: '0.149.1' } });
    const result = await run('--json');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const text = plain(result.stdout);
    expect(text.indexOf('✓ claude: 2.1.231'), 'the human lines follow the JSON')
      .toBeLessThan(text.indexOf('{'));
    expect(text.indexOf('presence only'), 'the notice follows the JSON').toBeLessThan(text.indexOf('{'));
    expect(json(result).probed).toBe(false);
    expect(text, 'the document is printed at two-space indent').toContain('\n  "probed": false,');
  });

  test('both flags together — probed is true and each entry carries the probe spread last', async () => {
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: verified('claude'), codex: verified('codex') },
    );
    const result = await run('--probe', '--json');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    const report = json(result);
    expect(report.probed).toBe(true);
    expect(report.adapters).toHaveLength(2);
    // The key order is the spike's and the spread is last, which is what makes `--json`'s shape the
    // probe's own result rather than a second description of it that could drift.
    expect(Object.keys(report.adapters[0])).toStrictEqual([
      'adapter', 'installed', 'version', 'login', 'ok', 'vendor', 'ms', 'cost_usd', 'tokens', 'session',
    ]);
    expect(report.adapters[0]).toMatchObject({ login: 'verified', ms: 1234, cost_usd: 0.0031 });
  });

  test('both flags are read as truthiness, so `--probe x` and `--json x` behave as the bare forms', async () => {
    // `argv.ts:54` gives a flag the token after it unless that token is another flag, so `--probe x`
    // carries the string `x` rather than `true`. `Boolean(...)` is what the spike applies to both,
    // and the claim covers both because a command reading one of them with `=== true` would refuse a
    // spelling the parser produces.
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: verified('claude'), codex: verified('codex') },
    );
    const result = await invoke(['adapters', '--project', root, '--probe', 'x', '--json', 'y']);
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result), 'a valued --probe did not probe').toContain('login verified');
    expect(out(result)).not.toContain('presence only');
    expect(json(result).probed, 'and the report says it probed').toBe(true);
    expect(json(result).adapters, 'a valued --json printed no report').toHaveLength(2);
  });
});

describe('AC-8 — BYOS, and the defects reported rather than fixed', () => {
  test('whatever an adapter throws reaches the terminal unaltered, so the refusal stays core\'s', async () => {
    // AC-8(a) and (b) in one property. The message is a sentence this test invented, so nothing here
    // has to know — or spell — what `check()` actually refuses with; what is claimed is that the CLI
    // is a pass-through. The shipped refusal still names the product "Harness", which is Q-0068's
    // and reaches the terminal through exactly this path.
    const sentence = 'refused for a reason only the adapter knows, with punctuation: — and `quotes`';
    stub({ claude: { refusal: sentence }, codex: { refusal: sentence } });
    const result = await run();
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result).split('\n').slice(0, 2)).toStrictEqual([
      `✗ claude: ${sentence}`,
      `✗ codex: ${sentence}`,
    ]);
    expect(json(await run('--json')).adapters.map((entry) => entry.error))
      .toStrictEqual([sentence, sentence]);
  });

  test('AC-8(c) — it exits 0 with both CLIs absent, which is preserved and not repaired here', async () => {
    // Why: preserved defect, see Q-0099 AC-8(c). `spike/bin/harness.js:424` returns rather than
    // reporting a status, so an adopter's CI step running `quorum adapters` reads success on a
    // machine with no vendor CLI at all. The successor is **Q-0090's GA-4**, which `main.ts:78`
    // already names for the identical preserved zero on the unknown-command path.
    stub({ claude: { refusal: 'not installed' }, codex: { refusal: 'not installed' } });
    const result = await run();
    expect(out(result)).toContain('✗ claude: not installed');
    expect(out(result)).toContain('✗ codex: not installed');
    expect(result.exitCode, 'the zero is the defect, and changing it here would be Q-0090 GA-4\'s job')
      .toBe(SUCCESS);
    expect(result.hard, 'nothing died — the command returned').toBe(false);
    expect(json(await run('--json')).adapters.every((entry) => entry.installed === false)).toBe(true);
  });

  test('AC-8(d) — Q-0066\'s crash renders as an unusable login rather than being caught in passing', async () => {
    // `probeAdapter` dereferences a null `usage`, so an adapter whose login is perfect and which
    // reports no measure answers `ok: false` carrying a `TypeError`'s own message — and the CLI
    // renders that as a login failure, which is what makes the defect visible from the outside.
    // Why: preserved defect, see Q-0066, which lands in both trees together; a fix here would leave
    // the spike disagreeing with `core` until the cutover.
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      {
        claude: {
          ok: false,
          vendor: 'claude',
          ms: 700,
          error: "Cannot read properties of null (reading 'cost_usd')",
        },
        codex: verified('codex'),
      },
    );
    const result = await run('--probe');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(out(result).split('\n')[1])
      .toBe("  ✗ login not usable: Cannot read properties of null (reading 'cost_usd')");
  });
});

describe('AC-9 — the command writes nothing, snapshotted in its own file rather than in main.test.ts', () => {
  /**
   * Everything about the fixture a command could change: every path below it with its bytes, and
   * every ref with the object it points at.
   *
   * Two halves, for the reason `main.test.ts`'s own snapshot gives: a command has two ways to leave
   * something behind and the tree walk sees only one of them. `.git` is pruned rather than read —
   * its contents move on their own, so including it would make the comparison a property of git's
   * housekeeping.
   */
  const snapshot = (dir: string): Record<string, string> => {
    const seen: Record<string, string> = {};
    const walk = (at: string): void => {
      for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(at, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.git') continue;
          seen[`${path.relative(dir, full)}/`] = '';
          walk(full);
        } else {
          seen[path.relative(dir, full)] = fs.readFileSync(full, 'utf8');
        }
      }
    };
    walk(dir);
    seen['git:for-each-ref'] = git(dir, 'for-each-ref', '--format=%(refname) %(objectname)');
    return seen;
  };

  test('a probing invocation leaves the working tree and the ref namespace as it found them', async () => {
    stub(
      { claude: { version: '2.1.231' }, codex: { version: '0.149.1' } },
      { claude: verified('claude'), codex: verified('codex') },
    );
    const before = snapshot(root);
    expect(Object.keys(before).length, 'the fixture is empty — this test proves nothing').toBeGreaterThan(2);
    expect(before['git:for-each-ref'], 'the fixture has no refs, so half this snapshot is vacuous')
      .toContain('refs/heads/harness/T-0001/integration');

    const result = await run('--probe', '--json');
    expect(result.exitCode, out(result)).toBe(SUCCESS);
    expect(snapshot(root)).toStrictEqual(before);
  });

  test('and the snapshot has a subject — a file written into the fixture is seen', () => {
    const before = snapshot(root);
    fs.writeFileSync(path.join(root, 'backlog', 'stray.md'), 'x', 'utf8');
    expect(snapshot(root)).not.toStrictEqual(before);
  });
});
