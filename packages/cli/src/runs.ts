/**
 * `quorum runs [ticket|run-id] [--json]` — run history, listed, filtered by ticket, or opened one
 * run at a time.
 *
 * **Everything read here belongs to `core`.** `readRunsDir`, `sortRuns`, `isIncomplete`,
 * `occurrenceSeq`, `vendorTokenTotal` and `readRun` decide what a run *is*, what order runs come in,
 * whether one is finished, how its occurrences are ordered, what a vendor's token total is, and
 * which directory a token may name. What this module owns is the rendering: the markers, the
 * colours, the indentation, the two JSON shapes, and the four failure sentences.
 *
 * **The Q-0037 ruling is the reason this is its own module and not a paragraph of one.** An
 * occurrence's usage is not a roll-up row and is not rendered as one — {@link formatVendorSummary}
 * sums, {@link formatOccurrenceUsage} does not, and the difference between the two lines is the
 * whole of what was once collapsed. See Q-0037 OQ-2, ruled 2026-09-01.
 *
 * **`contracts/Q-0011/runs-cli.contract.md` opens with a location** — *"the reader lives entirely in
 * `spike/bin/harness.js`"* — which the port necessarily falsifies, as it falsified the same sentence
 * for `lint` and for `validate`. Charter §2 preserves behaviour and not location, and Q-0091's
 * erratum E-3 already ruled that this contract's prose states what must be *conveyed*. No erratum is
 * owed for it; see Q-0092 merged.md OQ-4.
 *
 * **Five preserved defects reach this command, and none of them is repaired here** (ground rule 3,
 * Q-0092 AC-12). Two are pinned by assertion in `runs.test.ts` so a later fix is a deliberate act,
 * and three are recorded where they are reached:
 *
 * 1. *The listing and the detail disagree about a symlinked run directory.* `readdirSync` with
 *    `withFileTypes` has `lstat` semantics, so a symlink to a sibling run is silently absent from a
 *    listing while `resolveRunDirectory` accepts it and `quorum runs <the link>` opens it. Two
 *    answers to one question; already recorded at `packages/core/src/run-history/reader.ts:111–114`,
 *    and inherited unchanged. Why: preserved defect, see Q-0049 AC-13.
 * 2. *A roll-up row whose totals are both null reads `n/a` while its cache fields are populated.*
 *    Why: ruled rather than fixed, see Q-0037 AC-7 — no adapter can produce that row, and summing
 *    its cache breakdown would print a number that is not a token total in the one place run history
 *    exists to report one.
 * 3. *`ProjectNotFoundError` calls the binary `harness`.* Reached through {@link repoDirOf}, and
 *    Q-0100's to rule for every command at once.
 * 4. *`manifestShapeError` proves five things and then casts*, so a document that reaches a
 *    formatter here can still carry a field of the wrong type; and a detail read validates no schema
 *    at all. Both deliberate — refusing in a listing would make one sibling's damage take the whole
 *    listing down, and `quorum validate` against the frozen contract is the job that proves more.
 * 5. *{@link runDetailJSON}'s `warnings` is always empty*, because a detail request collects none.
 */
import path from 'node:path';

import {
  isIncomplete, loadProject, occurrenceSeq, ProjectNotFoundError, readRun, readRunsDir, sortRuns,
  vendorTokenTotal,
  type Occurrence, type OccurrenceUsage, type RunEntry, type RunManifest, type RunWarning,
  type VendorRollup,
} from '@quorum/core';
import { MANIFEST_FILE, RUN_HISTORY_ROOT, parseTicketId } from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die, failSoftly } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The project this command reads history out of, or the spike's sentence and a hard exit.
 *
 * Six lines duplicated from `lint.ts` rather than shared, and the duplication is forced rather than
 * accepted: a helper module holding it would be a *frame* module naming `loadProject`, which
 * `frame.source.test.ts`'s AC-10 partition forbids — a domain symbol may be named by a command
 * module and by nothing else. Q-0091 erratum E-6 governs the `--project` argument: the spike reads
 * that flag *inside* its own `loadProject`, so passing it here is what keeps `--project` deciding
 * which project is read rather than a new behaviour.
 *
 * Why: preserved — `core`'s message names the binary `harness`, which this one is not called. That
 * whole class is Q-0100's, which exists to rule it once rather than once per command.
 */
function repoDirOf(project: FlagValue | readonly FlagValue[] | undefined): string {
  try {
    return loadProject(project as string | undefined).repoDir;
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);
  }
}

/**
 * Money to three decimals, or `n/a`.
 *
 * Why: preserved — at two decimals a real `$0.004` step renders `$0.00` and becomes
 * indistinguishable from a vendor that reported zero, which is the confusion the tokens-only
 * decision bans at `$0.000` reached one digit earlier. See Q-0034.
 */
const formatMoney = (value: number | null): string => (value == null ? 'n/a' : `$${value.toFixed(3)}`);

/** A token measure, or `n/a` — which is what "the vendor did not report this" reads as, never `0`. */
const formatTokens = (value: number | null): string => (value == null ? 'n/a' : String(value));

/**
 * One roll-up row: the vendor, its cost, its token total and how much of that total is unpriced.
 *
 * **No combined money total is produced here or anywhere**, and no combined token total either: one
 * blended number is fiction the moment a vendor that reports no price is in the mix.
 */
const formatVendorSummary = (row: VendorRollup): string =>
  `${row.vendor}: cost=${formatMoney(row.cost_usd)} tokens=${formatTokens(vendorTokenTotal(row))} `
  + `unpriced_steps=${String(row.unpriced_steps)}`;

/**
 * One occurrence's own usage, which is a different thing from a roll-up row and is not rendered as
 * one.
 *
 * The four measures stay separate, each through {@link formatTokens}, so a null reads `n/a` and
 * never `0`, and the cache pair is visible as the breakdown it is rather than folded away. There is
 * no `unpriced_steps` — over a single occurrence it can only be 0 or 1 and says nothing the status
 * does not — and no `tokens=<sum>`, because summing is the roll-up's business.
 *
 * Why: ruled, see Q-0037 OQ-2 (2026-09-01). A CLI that re-collapses the two reintroduces Q-0011's
 * round-2 nit 5, and the guards are two blocks in two views rather than one.
 */
const formatOccurrenceUsage = (usage: OccurrenceUsage): string =>
  `${usage.vendor}: cost=${formatMoney(usage.cost_usd)} input_tokens=${formatTokens(usage.input_tokens)} `
  + `output_tokens=${formatTokens(usage.output_tokens)} cached_input_tokens=${formatTokens(usage.cached_input_tokens)} `
  + `cache_write_input_tokens=${formatTokens(usage.cache_write_input_tokens)}`;

/** A status, painted green when it completed, amber while it runs, and dim for everything else. */
function statusLabel(status: string): string {
  const paint = status === 'completed' ? c.green : status === 'running' ? c.amber : c.dim;
  return paint(status);
}

/**
 * The one line that identifies a run, shared by the listing and by the head of the detail view.
 *
 * The optional chaining is load-bearing rather than defensive: `manifestShapeError` proves five
 * things about a document and `stage` is not one of them, so a hand-edited manifest reaching here
 * without one renders `? -> ?` instead of raising. Why: preserved from
 * `spike/bin/harness.js:204–208`.
 */
function runHeaderLine(manifest: RunManifest): string {
  const stage = `${manifest.stage?.before ?? '?'} -> ${manifest.stage?.after ?? '?'}`;
  const duration = manifest.duration_ms == null
    ? 'duration=n/a'
    : `duration=${(manifest.duration_ms / 1000).toFixed(1)}s`;
  return `${c.bold(manifest.run_id)} ${c.dim(manifest.ticket_id)} ${manifest.flow} `
    + `${c.dim(stage)} ${statusLabel(manifest.status)} ${c.dim(duration)}`;
}

/** The listing: one header line per run, its roll-up rows beneath it, then the store's warnings. */
function printRunsListHuman(runs: readonly RunEntry[], warnings: readonly RunWarning[]): void {
  if (!runs.length) console.log(c.dim('· no runs found'));
  for (const { manifest } of runs) {
    console.log(runHeaderLine(manifest) + (isIncomplete(manifest) ? ' ' + c.amber('(incomplete)') : ''));
    for (const row of manifest.rollup ?? []) console.log('  ' + c.dim(formatVendorSummary(row)));
  }
  for (const warning of warnings) console.log(c.amber('!') + ` ${warning.runId}: ${warning.message}`);
}

/** The listing as one document: the identifying fields, the derived `incomplete`, and the roll-up. */
const runsListJSON = (runs: readonly RunEntry[], warnings: readonly RunWarning[]) => ({
  mode: 'list',
  runs: runs.map(({ manifest }) => ({
    run_id: manifest.run_id,
    ticket_id: manifest.ticket_id,
    flow: manifest.flow,
    stage: manifest.stage,
    status: manifest.status,
    started_at: manifest.started_at,
    ended_at: manifest.ended_at,
    duration_ms: manifest.duration_ms,
    incomplete: isIncomplete(manifest),
    rollup: manifest.rollup ?? [],
  })),
  warnings: warnings.map((warning) => `${warning.runId}: ${warning.message}`),
});

/** An occurrence's second line: everything it recorded about itself, `n/a` for each absent value. */
const occurrenceFields = (step: Occurrence): string => [
  `kind=${step.kind}`,
  `adapter=${step.adapter ?? 'n/a'}`,
  `model=${step.model ?? 'n/a'}`,
  statusLabel(step.status),
  `started_at=${step.started_at}`,
  `duration_ms=${step.duration_ms == null ? 'n/a' : String(step.duration_ms)}`,
  `attempts=${String(step.attempts)}`,
  `verdict=${step.verdict ?? 'n/a'}`,
].join(' ');

/**
 * One run in full: its header, whether it is incomplete, and every occurrence it recorded.
 *
 * **Every entry in `steps` is rendered** — failed ones and null-usage ones included — because a
 * failure is where the number matters most, and ordered by {@link occurrenceSeq}, which sorts an
 * unparseable prefix last rather than first. No roll-up is rendered at all: `formatVendorSummary`
 * has no call site on this path, which is what makes the Q-0037 ruling structural here rather than
 * observed.
 */
function printRunDetailHuman(runId: string, manifest: RunManifest, manifestPath: string, repoDir: string): void {
  console.log(runHeaderLine(manifest));
  if (isIncomplete(manifest)) {
    console.log(c.amber('! incomplete') + c.dim(` — ${path.relative(repoDir, manifestPath)}`));
  }
  const steps = [...(manifest.steps ?? [])]
    .sort((a, b) => occurrenceSeq(a.occurrence_dir) - occurrenceSeq(b.occurrence_dir));
  for (const step of steps) {
    const relative = path.join(RUN_HISTORY_ROOT, runId, step.occurrence_dir).split(path.sep).join('/');
    console.log('  ' + c.teal(step.step_id) + ' ' + c.dim(relative));
    console.log('    ' + occurrenceFields(step));
    console.log('    usage: ' + (step.usage ? formatOccurrenceUsage(step.usage) : 'n/a'));
    if (step.error) console.log('    error: ' + `${step.error.category}: ${step.error.message}`);
  }
}

/**
 * One run as one document: the manifest exactly as it was parsed, never reshaped and never given a
 * derived roll-up.
 *
 * `warnings` is always the empty array. Why: preserved — a detail request collects none by
 * construction, and the key is present so the two modes have one shape.
 */
const runDetailJSON = (manifest: RunManifest, manifestPath: string, repoDir: string) => ({
  mode: 'detail',
  run: manifest,
  incomplete: isIncomplete(manifest),
  manifest_path: path.relative(repoDir, manifestPath),
  warnings: [],
});

/**
 * Report a failure the command could not answer, without stopping the process.
 *
 * All four failure paths are soft. The spike ends each of them in `process.exitCode = 1`
 * (`spike/bin/harness.js:499`, `:517`, `:523`, `:531`) rather than in `die`, and the difference is
 * output that has already been written: a listing that reports a store warning still prints the
 * listing. The human spelling is `die`'s own, space inside the red span included, and only the
 * mechanism differs.
 */
function reportFailure(message: string, jsonMode: boolean): void {
  if (jsonMode) console.log(JSON.stringify({ error: message }));
  else console.error(c.red('✗ ') + message);
  failSoftly();
}

/** List every readable run, print each warning, and fail softly if the store had one. */
function listAll(runs: readonly RunEntry[], warnings: readonly RunWarning[], jsonMode: boolean): void {
  if (jsonMode) console.log(JSON.stringify(runsListJSON(runs, warnings)));
  else printRunsListHuman(runs, warnings);
  // Erratum E-4 (`backlog/Q-0011-…/solution/errata.md`, 2026-08-24): the contract states both "zero
  // matches … exit zero" and "a malformed sibling is named … and the final exit is non-zero", and a
  // corrupt store satisfies both. Store health wins, whatever the selection matched.
  if (warnings.length) failSoftly();
}

/** Show run history: everything, one ticket's runs, or one run. */
export const runs: CommandHandler = ({ rest, flags }) => {
  const repoDir = repoDirOf(flags.project);
  const runsRoot = path.join(repoDir, RUN_HISTORY_ROOT);
  const token = rest[0];
  const jsonMode = Boolean(flags.json);
  // `readRunsDir` parses EVERY sibling manifest. A detail request needs exactly one run directory,
  // and reading the rest couples it to the health and size of a store that may hold a year of
  // history — so it is called in the two branches that genuinely list, and never above them. See
  // Q-0034 AC-13, and `readRun`, which is the single-run read this defers to instead.
  const listRuns = (): { runs: RunEntry[]; warnings: RunWarning[] } => readRunsDir(runsRoot);

  // Truthiness rather than `token !== undefined`, so that `quorum runs ""` lists every run exactly
  // as `quorum runs` does. `parseArgv` keeps an empty positional (`argv.ts:62`), so the two spellings
  // genuinely differ on it, and the strict one turns a token the spike reads as *absent* into
  // `unknown run or ticket: ` and a non-zero exit. Why: preserved behaviour, see `spike/bin/harness.js:471`.
  if (token) {
    // A confined, existing run directory wins over every other reading of the token, which is what
    // makes a run id and a ticket id unambiguous when one could be both. Confinement is `core`'s
    // and is not reimplemented here: `resolveRunDirectory`'s lexical clauses reject `..`, a nested
    // path and an absolute one, and its `realpath` half is the only thing that sees through a
    // single-segment symlink pointing out of the runs root.
    const found = readRun(runsRoot, token);
    if (found.outcome === 'malformed') {
      reportFailure(`run "${token}": malformed ${MANIFEST_FILE} (${found.message})`, jsonMode);
      return;
    }
    if (found.outcome === 'run') {
      if (jsonMode) console.log(JSON.stringify(runDetailJSON(found.manifest, found.manifestPath, repoDir)));
      else printRunDetailHuman(token, found.manifest, found.manifestPath, repoDir);
      return;
    }
    if (parseTicketId(token)) {
      const { runs: all, warnings } = listRuns();
      listAll(sortRuns(all.filter((entry) => entry.manifest.ticket_id === token)), warnings, jsonMode);
      return;
    }
    reportFailure(`unknown run or ticket: ${token}`, jsonMode);
    return;
  }

  const { runs: all, warnings } = listRuns();
  listAll(sortRuns(all), warnings, jsonMode);
};
