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
 * `@quorum/core`, and this module renders `e.message` unaltered; the sentence it still carries calls
 * the *product* a harness, which is Q-0068's and is preserved verbatim (Q-0099 AC-8(a)). The notice
 * below names the *binary*, and that class was ruled by Q-0100: it is `quorum`.
 *
 * **This command answers two questions and reports a status for one of them.** Without `--probe` it
 * is a report and exits 0 whatever it finds, including a machine with no vendor CLI at all — its
 * own last line disclaims being the gate. With `--probe` it is a check, and a login that is not
 * usable is ERROR. Why: see *"What an exit code may claim, and the three zeros it was asked about"*
 * (2026-09-08), which ratified the first and changed the second.
 *
 * **Since Q-0067 it also reports provenance, which is neither of those questions.** `cliVersion`
 * compares the version `check()` already returned with the one the adapter records having been
 * verified against, and the result renders as at most one dim clause under `--probe` and as two
 * keys in `--json`. Why: see *"An adapter records the version it was verified against, and never a
 * version it supports"* (2026-09-08).
 *
 * **One preserved defect reaches this command and is not repaired here** (ground rule 3):
 *
 * `probeAdapter` dereferences a null `usage`, so an adapter whose login is perfect and which
 *    reports no measure answers `✗ login not usable: Cannot read properties of null`. Why: preserved
 *    defect, see Q-0066, which lands in both trees together — a fix here would leave the spike
 *    disagreeing with `core` until the cutover.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:406–424` (Q-0099 AC-7).
 */
import { cliVersion, getAdapter, loadProject, probeAdapter, ProjectNotFoundError } from '@quorum/core';
import type { CliVersionResult } from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { dieNoProject, failSoftly } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The project whose `adapters` configuration and directory this command uses, or the spike's
 * sentence and a hard exit where none is there.
 *
 * Why: a sixth copy of `lint.ts`'s block rather than a shared helper, because a frame module naming
 * `loadProject` is what `frame.source.test.ts`'s AC-10 partition forbids (Q-0099 AC-3, OQ-5).
 * The message is `core`'s, rendered unaltered — this module composes no recovery advice of its own,
 * which is what keeps one sentence in one place. `--project` is passed through per Q-0091 erratum
 * E-6.
 */
function projectOf(project: FlagValue | readonly FlagValue[] | undefined): ReturnType<typeof loadProject> {
  try {
    return loadProject(project as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return dieNoProject(error.message);
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

/**
 * What each state is worth saying, and the one that is worth saying nothing about.
 *
 * A total map over the closed vocabulary rather than a chain of conditions, so a fifth state added
 * to `@quorum/shared` fails to compile here. `as-verified` is `null`: the two numbers agree, and
 * there is nothing to report.
 */
const VERSION_CLAUSE: Record<CliVersionResult['state'], string | null> = {
  'as-verified': null,
  ahead: 'the installed CLI is newer than the record',
  behind: 'the installed CLI is older than the record',
  indeterminate: 'the two could not be compared',
};

/**
 * One vendor's verified-version clause, or nothing at all: it names the installed version and the
 * recorded one and stops.
 *
 * The shape is `board.ts`'s `pushLagLegend`: a sentence or `null`, the caller deciding indentation
 * and colour.
 *
 * Why: see *"An adapter records the version it was verified against, and never a version it
 * supports"* (2026-09-08); `adapters.test.ts`'s AC-9 block is what holds these strings to it.
 */
const versionClause = (version: CliVersionResult): string | null => {
  const how = VERSION_CLAUSE[version.state];
  if (how === null) return null;
  return `· verified version = ${version.verified ?? 'none recorded'}, installed ${version.installed} — ${how}`;
};

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

    // No second spawn: the string `check()` already returned. The comparison is `core`'s, the
    // record living in a capabilities module that is not on its public surface.
    const seen = cliVersion(name, version);
    const provenance = { version_state: seen.state, verified_version: seen.verified };

    if (!probe) {
      report.push({ adapter: name, installed: true, version, ...provenance, login: 'unverified' });
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
    // After the verdict, and under `--probe` alone. Why: see *"An adapter records the version it
    // was verified against, and never a version it supports"* (2026-09-08), clause (e).
    const clause = versionClause(seen);
    if (clause !== null) console.log(`  ${c.dim(clause)}`);
    report.push({ adapter: name, installed: true, version, ...provenance, login: result.ok ? 'verified' : 'failed', ...result });
  }
  if (!probe) console.log(c.dim('· presence only — logins NOT verified; run `quorum adapters --probe` before a real run'));
  // After the human lines rather than instead of them: `--json` is a combined stream in the spike
  // and a consumer piping it gets both. Redefining it as JSON-only is a contract change.
  if (asJson) console.log(JSON.stringify({ probed: probe, adapters: report }, null, 2));
  // `--probe` is the check and the presence listing is the report, so only the first answers with a
  // status. Set rather than thrown, so the listing and the `--json` above still reach the terminal.
  // Why: see *"What an exit code may claim, and the three zeros it was asked about"* (2026-09-08).
  if (probe && report.some((entry) => entry.login !== 'verified')) failSoftly();
};
