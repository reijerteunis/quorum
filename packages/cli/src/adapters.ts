/**
 * `quorum adapters [--probe] [--json]` — which vendor CLIs Quorum can see, and whether their logins
 * still answer. The command an adopter is told to run first, and the one that de-risks a paid run
 * before it is paid for.
 *
 * **Presence and login are two questions and this module never lets the cheap one stand in for the
 * expensive one.** `check()` proves the binary runs, and refuses outright where the environment says
 * BYOS is not being honoured; only `probeAdapter` makes an authenticated request. Without `--probe`
 * every success
 * is recorded `login: 'unverified'` and the notice below says so — see *"check() proves presence;
 * only `adapters --probe` proves login"* (2026-08-22).
 *
 * **Nothing here decides what a refusal says.** The BYOS refusal is each vendor adapter's own, in
 * `@quorum/core`, and this module renders `e.message` unaltered; the sentence it still carries is
 * Q-0068's, and the notice's `harness adapters --probe` is Q-0100's — a fifth user-facing sentence
 * naming a binary that is not called that. Both are preserved verbatim (Q-0099 AC-8(a), (b)).
 *
 * **Two preserved defects reach this command and neither is repaired here** (ground rule 3):
 *
 * 1. *It exits 0 even when both CLIs are absent.* `spike/bin/harness.js:424` returns, so an
 *    adopter's CI step running `quorum adapters` reports success on a machine with no vendor CLI at
 *    all. Why: preserved defect, see Q-0099 AC-8(c); the successor is Q-0090's GA-4, which carries
 *    the unknown-command zero for the same reason.
 * 2. *`probeAdapter` dereferences a null `usage`*, so an adapter whose login is perfect and which
 *    reports no measure answers `✗ login not usable: Cannot read properties of null`. Why: preserved
 *    defect, see Q-0066, which lands in both trees together — a fix here would leave the spike
 *    disagreeing with `core` until the cutover.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:406–424` (Q-0099 AC-7).
 */
import { getAdapter, loadProject, probeAdapter, ProjectNotFoundError } from '@quorum/core';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The project whose `adapters` configuration and directory this command uses, or the spike's
 * sentence and a hard exit where none is there.
 *
 * Why: a sixth copy of `lint.ts`'s block rather than a shared helper, because a frame module naming
 * `loadProject` is what `frame.source.test.ts`'s AC-10 partition forbids (Q-0099 AC-3, OQ-5).
 * Why: preserved — `core`'s message names the binary `harness`, which this one is not called; that
 * whole class is Q-0100's. `--project` is passed through per Q-0091 erratum E-6.
 */
function projectOf(project: FlagValue | readonly FlagValue[] | undefined): ReturnType<typeof loadProject> {
  try {
    return loadProject(project as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);
  }
}

/**
 * The two vendors, in the order the spike reports them.
 *
 * `mock` is deliberately absent: it is an adapter a flow may select and not a subscription anybody
 * has, so reporting it would say a login is fine that nobody logged into.
 */
const VENDORS = ['claude', 'codex'];

/**
 * The machine-readable report, one entry per vendor, in the key order the spike writes it.
 *
 * `Record<string, unknown>` rather than a union, because the probe's own result is **spread last**
 * and `--json`'s shape is that object as it stands: a declared shape here would be a second
 * description of `ProbeResult` that could drift from it. Preserved key for key, spread included
 * (Q-0099 AC-7(5)).
 */
type Report = Record<string, unknown>[];

/** Report which vendor CLIs are installed, and with `--probe` whether each login answers. */
export const adapters: CommandHandler = async ({ flags }) => {
  const { config, repoDir } = projectOf(flags.project);
  // Both read as truthiness, which is what `argv.ts` leaves them as: a flag given no value is the
  // boolean `true` and one given a value is that token, so `--probe` and `--probe x` behave alike.
  const probe = Boolean(flags.probe);
  const asJson = Boolean(flags.json);
  const report: Report = [];
  for (const name of VENDORS) {
    const adapter = getAdapter(name, config.adapters);
    let version: string;
    try {
      version = await adapter.check();
      console.log(`${c.green('✓')} ${name}: ${version}`);
    } catch (error) {
      // The loop continues: one absent CLI is not a reason to stop reporting the other, which is
      // the whole of what an adopter is running this to find out. The message is the adapter's own,
      // rendered unaltered — including the BYOS refusal, which is Q-0068's sentence and not this
      // module's to rewrite on the way through.
      console.log(`${c.red('✗')} ${name}: ${(error as Error).message}`);
      report.push({ adapter: name, installed: false, error: (error as Error).message });
      continue;
    }

    if (!probe) {
      report.push({ adapter: name, installed: true, version, login: 'unverified' });
      continue;
    }
    // check() only proves the binary exists. Only a real request proves the subscription answers.
    const result = await probeAdapter(adapter, { cwd: repoDir });
    if (result.ok) {
      const cost = result.cost_usd != null ? `, $${result.cost_usd.toFixed(4)}` : '';
      const tokens = result.tokens ? `, ${String(result.tokens)} tokens` : '';
      console.log(`  ${c.green('✓')}${c.dim(` login verified — round-trip ${String(result.ms)}ms${cost}${tokens}`)}`);
    } else {
      console.log(`  ${c.red('✗')} ${c.bold('login not usable')}: ${result.error}`);
    }
    report.push({ adapter: name, installed: true, version, login: result.ok ? 'verified' : 'failed', ...result });
  }
  // Why: preserved — the binary named here is `harness` and this one is not called that. Q-0100 owns
  // that class; renaming it here would be that ticket done one sentence at a time.
  if (!probe) console.log(c.dim('· presence only — logins NOT verified; run `harness adapters --probe` before a real run'));
  // After the human lines rather than instead of them: `--json` is a combined stream in the spike
  // and a consumer piping it gets both. Redefining it as JSON-only is a contract change.
  if (asJson) console.log(JSON.stringify({ probed: probe, adapters: report }, null, 2));
};
