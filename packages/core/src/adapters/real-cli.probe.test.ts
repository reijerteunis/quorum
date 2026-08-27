/**
 * Q-0047 AC-13: the one thing CI cannot answer.
 *
 * Subscription auth means no CI job can log in, so these two adapters are the only files in the
 * port whose acceptance evidence does not come from a pipeline (docs/04-architecture.md, §Testing
 * strategy). Everything else in this folder runs against `#!/bin/sh` stubs, which is genuinely most
 * of the way and is not the same thing: a stub cannot tell you that the flags this adapter passes
 * are flags the installed CLI still has.
 *
 * **Run it with:**
 *
 * ```
 * QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core
 * ```
 *
 * `--force` because a cached pass is a pass nobody executed (Q-0065), and this file is the one
 * place in the workspace where that distinction costs money rather than time.
 *
 * **What it costs.** About $0.39 on claude even in an empty directory, because the CLI's own system
 * prompt and tool definitions dominate a hello-world request (M0, 2026-08-22). `probeAdapter` runs
 * each adapter exactly once, in a temp directory it creates and removes, so the repository's own
 * `CLAUDE.md` and rules are not loaded on top of that.
 *
 * **What it uses.** Each CLI's own subscription login, and nothing else — enforced here rather than
 * assumed, by {@link withoutApiKeys}. `probeAdapter` deliberately does not call `check()`
 * (adapters.ts:12-16) and `run()` carries no BYOS guard of its own, so an inherited key would reach
 * the vendor CLI, which may prefer it over the subscription — spending API credit and then being
 * read as evidence that a subscription login works. The three variables are removed for the length
 * of each probe and put back afterwards.
 *
 * Without the switch it reports **skipped**, never passed: it is the only proof of the thing CI
 * cannot see, and a check that skips its subject must not report success (docs/DECISIONS.md,
 * 2026-08-25).
 */
import { describe, expect, test } from 'vitest';

import { getAdapter, probeAdapter } from './adapters.js';

/** A real round-trip took 4148-4674ms in M0; the CLIs are slower on a cold start than Vitest waits. */
const TIMEOUT = 180_000;

/** Every variable the two adapters refuse on — both vendors', because one process runs both. */
const API_KEY_VARIABLES = ['ANTHROPIC_API_KEY', 'CODEX_API_KEY', 'OPENAI_API_KEY'] as const;

/**
 * Runs one probe with all three API-key variables absent, and restores exactly what was there —
 * a variable that was unset stays unset rather than coming back as an empty string.
 *
 * Deleting them from `process.env` is what reaches the child: `exec` spawns with `env: process.env`
 * (exec.ts:54), so the CLI cannot see a key this process cannot see. The assertion is not
 * decoration — it is the whole guarantee, and without it a future edit that drops the deletion
 * would spend API credit while still reporting subscription evidence (AC-13).
 */
async function withoutApiKeys<T>(probe: () => Promise<T>): Promise<T> {
  const saved = API_KEY_VARIABLES.map((name) => [name, process.env[name]] as const);
  for (const name of API_KEY_VARIABLES) delete process.env[name];
  try {
    for (const name of API_KEY_VARIABLES) expect(process.env[name], `${name} must not reach the CLI`).toBeUndefined();
    return await probe();
  } finally {
    for (const [name, value] of saved) if (value !== undefined) process.env[name] = value;
  }
}

describe.skipIf(!process.env.QUORUM_REAL_CLI)('AC-13 — the ported adapters reach a real subscription', () => {
  test('claude answers, and reports what it cost', async () => {
    const result = await withoutApiKeys(() => probeAdapter(getAdapter('claude')));

    expect(result.ok, result.ok === false ? result.error : '').toBe(true);
    if (!result.ok) return;
    expect(result.session, 'claude reports a session id').not.toBeNull();
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.cost_usd, 'claude reports money, and it was right throughout M0').not.toBeNull();
  }, TIMEOUT);

  test('codex answers, and reports tokens with no price', async () => {
    const result = await withoutApiKeys(() => probeAdapter(getAdapter('codex')));

    expect(result.ok, result.ok === false ? result.error : '').toBe(true);
    if (!result.ok) return;
    expect(result.session, 'codex reports a thread id').not.toBeNull();
    expect(result.tokens).toBeGreaterThan(0);
    // Never rounded to zero, and never priced locally from a rate table that would go stale in
    // silence ("Codex cost is reported as tokens, never priced locally", docs/DECISIONS.md
    // 2026-08-22).
    expect(result.cost_usd).toBeNull();
  }, TIMEOUT);
});
