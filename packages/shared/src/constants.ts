// The values more than one package needs, written once. Every constant below exists in the spike
// as a literal — several of them as two or three copies of the same literal — and each carries the
// citation of the line it replaces so a reviewer can compare bytes rather than take this on trust.
//
// Nothing here reaches the disk, spawns anything or reads the environment: this module supplies
// values and pure functions over strings. The safety those values describe — that a flow never
// writes to the user's working tree — is enforced in `core`, never here and never by convention.

// ---------- the two `.harness/` namespaces ----------
//
// There are two, they share a prefix, and they are unrelated. The names below are what tells them
// apart, so neither is called plain `HARNESS_DIR`.

/**
 * Worktrees, under the REPOSITORY root. Every code-writing step gets one here and the user's own
 * working tree is never touched.
 *
 * Spike: `path.join(repoDir, '.harness', 'worktrees')` — spike/src/git.js:11, and again at
 * spike/src/git.js:27 and spike/src/fanout.js:103. Three copies of one expression; this is the
 * one spelling that replaces them.
 */
export const REPO_WORKTREE_ROOT = '.harness/worktrees';

/**
 * Engine-written artifacts, inside a TICKET folder — nothing to do with worktrees. Two files land
 * here: `<step>-verdict.json` (spike/src/engine.js:288, read back by harness/flows/requirements.yaml:23)
 * and `<step>-<timestamp>.raw.txt`, the raw text saved when structured output fails validation
 * (spike/src/engine.js:276).
 */
export const TICKET_ARTIFACT_DIR = '.harness';

/**
 * A worktree directory is named for its branch with every `/` replaced by `__`, because a branch
 * name is a path and would otherwise nest. Spike: `branch.replace(/\//g, '__')` —
 * spike/src/git.js:12, spike/src/git.js:27, spike/src/fanout.js:103.
 */
export function worktreeDirName(branch: string): string {
  return branch.replace(/\//g, '__');
}

// ---------- run history, under `.quorum/` ----------

/** Spike: `path.join(ctx.repoDir, '.quorum', 'runs', runId)` — spike/src/engine.js:328. */
export const RUN_HISTORY_ROOT = '.quorum/runs';

/** Spike: `path.join(ctx.history.dir, 'manifest.json')` — spike/src/engine.js:436. */
export const MANIFEST_FILE = 'manifest.json';

/** Spike: `persistArtifact(ctx, occurrence, 'prompt.txt', prompt)` — spike/src/engine.js:237. */
export const PROMPT_FILE = 'prompt.txt';

/** Spike: `persistArtifact(ctx, occurrence, 'output.txt', …)` — spike/src/engine.js:258, :280, :1061. */
export const OUTPUT_FILE = 'output.txt';

/** The directory each occurrence gets a numbered subdirectory in — spike/src/engine.js:362. */
export const OCCURRENCE_DIR = 'steps';

/** Spike: `String(seq).padStart(3, '0')` — spike/src/engine.js:390. */
export const OCCURRENCE_SEQUENCE_PAD = 3;

/**
 * A run's id, as it names its directory under {@link RUN_HISTORY_ROOT}.
 * Spike: `` `${ctx.ticket.meta.id}-${ctx.runId}` `` — spike/src/engine.js:327.
 */
export function runIdOf(ticketId: string, run: number): string {
  return `${ticketId}-${run}`;
}

/**
 * One occurrence's directory, relative to the run directory: `steps/NNN-<step id>`, with `/` and
 * `:` in the step id replaced by `-` so a fan-out step id (`dev:T1`) stays one path segment.
 * Spike: spike/src/engine.js:389-390.
 */
export function occurrenceDirName(sequence: number, stepId: string): string {
  const safeId = String(stepId).replace(/[/:]/g, '-');
  return `${OCCURRENCE_DIR}/${String(sequence).padStart(OCCURRENCE_SEQUENCE_PAD, '0')}-${safeId}`;
}

// ---------- the ticket's branches ----------
//
// Git refs are files in directories, so `harness/<id>` cannot exist alongside `harness/<id>/x`:
// the integration branch and its siblings are all one level down. Every function here takes the
// ticket id as data and embeds no repository name.

/**
 * The prefix every branch of one ticket shares. The engine's diff range guard admits an endpoint
 * only if it is the configured base or starts with this — spike/src/engine.js:797.
 */
export function ticketBranchPrefix(ticketId: string): string {
  return `harness/${ticketId}/`;
}

/**
 * The ticket's integration branch. Spike: `` `harness/${id}/integration` `` — spike/src/backlog.js:64,
 * and again as a literal in spike/src/engine.js:789.
 */
export function integrationBranch(ticketId: string): string {
  return `harness/${ticketId}/integration`;
}

/**
 * A sibling branch beside the integration branch. Step branches and task branches are the same
 * shape: the engine builds a step branch as `` `harness/${ticket.meta.id}/${step.id}` ``
 * (spike/src/engine.js:211) and a fan-out task branch as `harness/{id}/{task.id}`
 * (spike/src/engine.js:953, harness/flows/development.yaml:12) — `leaf` is the step id or the task id.
 */
export function ticketBranch(ticketId: string, leaf: string): string {
  return `harness/${ticketId}/${leaf}`;
}

/**
 * The base branch a run compares and syncs against when `repo.base_branch` is not configured.
 * Hard-coded in the spike in four places: spike/src/engine.js:45, :916, :991, :1004.
 */
export const DEFAULT_BASE_BRANCH = 'main';

// ---------- the ticket folder's append-only log ----------

/** Spike: `path.join(ticket.dir, 'runs.log')` — spike/src/backlog.js:94, spike/src/engine.js:747. */
export const RUNS_LOG_FILE = 'runs.log';

// ---------- vocabularies ----------

/**
 * How a reviewer classifies a finding. Every shipped review step's instructions require the prefix
 * exactly (harness/flows/chore.yaml:41, harness/flows/review.yaml:36) and
 * harness/roles/code-reviewer.md says the same.
 */
export const FINDING_SEVERITIES = ['blocker', 'major', 'nit'] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/**
 * The shape a finding string must have — severity, then `file:line`, then the finding. The engine
 * puts this exact source string on the generated step schema when the verdict vocabulary contains
 * `changes-requested`; spike/src/engine.js:686. Kept here as one spelling, byte for byte.
 */
export const FINDING_PATTERN = '^(blocker|major|nit): .+:[1-9][0-9]* .+';

/**
 * The five usage measures a vendor may report, in the order the spike declares them. Declared
 * twice today — spike/src/adapters/index.js:72 and spike/src/engine.js:465 — which is exactly the
 * kind of second copy a roll-up drifts on.
 *
 * `null` is "the vendor did not report this", which is not zero: a run states how many of its
 * steps were unpriced rather than rounding them to $0.000 ("Codex cost is reported as tokens,
 * never priced locally", docs/DECISIONS.md 2026-08-22).
 */
export const USAGE_MEASURES = [
  'input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd',
] as const;

export type UsageMeasure = (typeof USAGE_MEASURES)[number];
