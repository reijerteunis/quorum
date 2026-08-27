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
 * **What it uses.** Each CLI's own subscription login, and nothing else. No API key is read, set or
 * accepted on any path here — if one is in the environment, `check()` refuses, and this file does
 * not call `check()` at all because presence and login are separate questions.
 *
 * Without the switch it reports **skipped**, never passed: it is the only proof of the thing CI
 * cannot see, and a check that skips its subject must not report success (docs/DECISIONS.md,
 * 2026-08-25).
 */
import { describe, expect, test } from 'vitest';

import { getAdapter, probeAdapter } from './adapters.js';

/** A real round-trip took 4148-4674ms in M0; the CLIs are slower on a cold start than Vitest waits. */
const TIMEOUT = 180_000;

describe.skipIf(!process.env.QUORUM_REAL_CLI)('AC-13 — the ported adapters reach a real subscription', () => {
  test('claude answers, and reports what it cost', async () => {
    const result = await probeAdapter(getAdapter('claude'));

    expect(result.ok, result.ok === false ? result.error : '').toBe(true);
    if (!result.ok) return;
    expect(result.session, 'claude reports a session id').not.toBeNull();
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.cost_usd, 'claude reports money, and it was right throughout M0').not.toBeNull();
  }, TIMEOUT);

  test('codex answers, and reports tokens with no price', async () => {
    const result = await probeAdapter(getAdapter('codex'));

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
