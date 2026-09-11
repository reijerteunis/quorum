/**
 * The fan-out's plumbing: a solution's tasks, the waves they run in, and the branches, worktrees
 * and commits a run makes out of them. The step types that drive it are Q-0053 — nothing here
 * reads a flow file, a run's iteration state or `harness.yaml`.
 *
 * This is the module whose subject is the user's repository, so its write surface is stated rather
 * than left to be read off: every function below writes into a worktree under
 * {@link REPO_WORKTREE_ROOT} or into a ref, with exactly one carve-out — {@link loadTasks}
 * materialising `solution/tasks.yaml`, which is the engine writing its own artifact into a ticket
 * folder. Nothing here touches the user's working tree, and nothing writes under `.quorum/`.
 *
 * Why: behaviour preserved from spike/src/fanout.js — harness/port-charter.md §2, Q-0048.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { REPO_WORKTREE_ROOT, worktreeDirName } from '@quorum/shared';

import { ensureWorktree, exitStatus, failureDetail } from '../git/git.js';

/**
 * A fan-out or integrate step that cannot proceed, carrying one sentence.
 *
 * It overrides nothing — not `name`, not `message`, not the stack. A command routes on
 * `e instanceof IntegrationError` to print `e.message` alone instead of a stack trace, exactly as
 * `FlowError` is treated, so `.name` reads `'Error'` and setting it would change what a stranger
 * sees at the top of a failure.
 */
export class IntegrationError extends Error {}

// ---------- what a task is ----------

/**
 * What {@link waves} and {@link scopeToFailing} need of a task: its id, and what it waits for.
 *
 * Separate from {@link Task} because both functions are given tasks and hand the same objects
 * back, and because a scoped retry is ordered by dependencies alone.
 */
export interface TaskNode {
  /** The task's id, as `tasks.yaml` spells it. Agent-authored; see {@link taskVars}. */
  id: string;
  /** Ids that must land in an earlier wave. Missing or `null` reads as none. */
  depends_on?: string[] | null;
}

/**
 * One task of a solution's `tasks.yaml`, as this module reads it.
 *
 * Structural and deliberately not a schema: `loadTasks` validates nothing today, and a runtime
 * check here would refuse files the engine currently accepts — a behaviour change the port does
 * not authorise (charter §2), and a rule arriving through a type, which the zod boundary
 * (docs/DECISIONS.md, 2026-08-25) forbids. `description` is the only free-form field the fan-out
 * forwards to an agent; see {@link taskPromptSection}.
 */
export interface Task extends TaskNode {
  /** The role the task runs as — a file in `harness/roles/`. */
  role: string;
  /** One line naming the work. It heads the task's prompt and is a {@link taskVars} key. */
  title: string;
  /** Where a task states its file ownership, because it is the only field that reaches the agent. */
  description?: string;
  /** Paths, relative to the task's worktree, whose contents are inlined into its prompt. */
  contracts?: string[];
}

/**
 * A ticket folder, as this module needs it: its directory and nothing else.
 *
 * Structural on purpose. `TicketRecord` from `backlog/` is assignable to it, and importing that
 * module here would make Q-0043 a dependency of this one for a single string.
 */
export interface TicketFolder {
  /** Absolute path of the ticket folder. */
  dir: string;
}

// ---------- tasks ----------

/**
 * The parsed `tasks.yaml`, as a cast and never a check.
 *
 * Why: preserved defect, see Q-0048 AC-12. Reading `.tasks` through this must still throw the raw
 * `TypeError` an empty file throws today — `YAML.parse('')` is `null` — rather than becoming an
 * {@link IntegrationError} or a silent `[]`.
 */
const parsedTasks = (value: unknown): { tasks?: Task[] | null } => value as { tasks?: Task[] | null };

/** The first fenced YAML block of a solution document, and its language tag's optional `a`. */
const YAML_BLOCK = /```ya?ml\n([\s\S]*?)```/g;

/**
 * A ticket's tasks, by three routes: `solution/tasks.yaml` if it is there; otherwise the first
 * fenced YAML block of `solution/solution.md` that declares `tasks:`, **written to
 * `solution/tasks.yaml` verbatim** so the next run reads the file rather than the document; and
 * otherwise a refusal.
 *
 * That write is this module's only write outside a worktree, and it is the engine persisting its
 * own artifact into a ticket folder — not an agent writing from a code-writing worktree, which is
 * what {@link commitAll} exists to prevent.
 *
 * @throws {IntegrationError} when neither file is there, or the document holds no such block.
 */
export function loadTasks(ticket: TicketFolder): Task[] {
  const f = path.join(ticket.dir, 'solution', 'tasks.yaml');
  if (fs.existsSync(f)) return parsedTasks(YAML.parse(fs.readFileSync(f, 'utf8'))).tasks ?? [];
  const doc = path.join(ticket.dir, 'solution', 'solution.md');
  if (!fs.existsSync(doc)) throw new IntegrationError('no solution/tasks.yaml and no solution/solution.md');
  const m = [...fs.readFileSync(doc, 'utf8').matchAll(YAML_BLOCK)].map((x) => x[1]).find((y) => /^tasks:/m.test(y));
  if (!m) throw new IntegrationError('solution.md has no ```yaml block with tasks:');
  fs.writeFileSync(f, m);
  return parsedTasks(YAML.parse(m)).tasks ?? [];
}

/**
 * Narrow a fan-out to the tasks that still fail, keeping their input order and their fields.
 *
 * A `depends_on` naming a task outside the scope is already satisfied — that task succeeded and its
 * branch is merged — so it is dropped rather than left for {@link waves} to report as an
 * unresolvable graph. Q-0006's run 11 crashed on exactly that: a conflict scoped a retry to one
 * task whose dependency had already landed. Returns new objects; the input is not mutated.
 */
export function scopeToFailing<T extends TaskNode>(tasks: readonly T[], failing: ReadonlySet<string>): T[] {
  const kept = tasks.filter((t) => failing.has(t.id));
  const ids = new Set(kept.map((t) => t.id));
  return kept.map((t) => ({ ...t, depends_on: (t.depends_on ?? []).filter((d) => ids.has(d)) }));
}

/**
 * Group tasks into waves: a task enters a wave once every id in its `depends_on` is in an earlier
 * one. Order within a wave is the order the tasks were given, and every task appears exactly once.
 *
 * Where tasks are genuinely independent they declare `depends_on: []` and this returns a single
 * wave — which is where a two-vendor fan-out comes from ("Tasks are small; the fan-out is the unit
 * of parallelism, not of scope", docs/DECISIONS.md 2026-08-23).
 *
 * @throws {IntegrationError} naming every remaining task, when none of them is ready — a cycle, or
 *   a dependency on an id that is not in the set. It never drops the dependency, reorders it into a
 *   runnable wave, or runs part of the blocked remainder.
 */
export function waves<T extends TaskNode>(tasks: readonly T[]): T[][] {
  const done = new Set<string>(); const out: T[][] = [];
  let remaining = [...tasks];
  while (remaining.length) {
    const ready = remaining.filter((t) => (t.depends_on ?? []).every((d) => done.has(d)));
    if (!ready.length) throw new IntegrationError(`dependency cycle or unknown depends_on among: ${remaining.map((t) => t.id).join(', ')}`);
    out.push(ready); ready.forEach((t) => done.add(t.id));
    remaining = remaining.filter((t) => !ready.includes(t));
  }
  return out;
}

/**
 * The variable namespace one task contributes, which the engine interpolates into a step's id,
 * prompt and branch name. Exactly four keys, `role` deliberately duplicating `task.role`.
 *
 * Why: preserved defect, see Q-0048 AC-12. This is what lifts an agent-authored `task.id` into the
 * namespace a branch name is built from, and it validates, normalises and escapes nothing — argv
 * stops shell injection, not option injection, and a leading `-` is read by git as a flag. Latent
 * only because every caller prefixes `harness/<ticket-id>/`. Q-0042 finding 4.
 */
export function taskVars(task: Task): Record<string, string> {
  return { 'task.id': task.id, 'task.role': task.role, 'task.title': task.title, role: task.role };
}

/**
 * The section of a task's prompt that describes the task: its heading, its `description`, the text
 * of each contract it names, and a line naming the dependencies already merged into its base.
 *
 * `description` is the ONLY field of the task that reaches the agent. The ownership rule turns on
 * that — an architect states file ownership there because it is the only field the fan-out
 * forwards ("Every file a red test requires must be owned by exactly one task",
 * docs/DECISIONS.md 2026-08-23) — so widening what this sends moves the ownership channel and
 * needs that decision restated rather than silently improved.
 *
 * @param worktreeDir the task's own checkout, which every `contracts` path is resolved against.
 */
export function taskPromptSection(task: Task, worktreeDir: string): string {
  const parts = [`\n# Task ${task.id} (${task.role}): ${task.title}`];
  if (task.description) parts.push(task.description);
  for (const c of task.contracts ?? []) {
    const f = path.join(worktreeDir, c);
    parts.push(`\n## Contract: ${c}\n\n${fs.existsSync(f) ? '```\n' + fs.readFileSync(f, 'utf8').trim() + '\n```' : '(file not found in worktree — treat as a blocker and say so in summary)'}`);
  }
  if (task.depends_on?.length) parts.push(`\nDepends on: ${task.depends_on.join(', ')} (already merged into your base branch).`);
  return parts.join('\n');
}

// ---------- git helpers ----------

/**
 * Every git call: argv, never a shell. A step summary written by an agent becomes a commit
 * message, so this is untrusted text on a command line — backticks in one crashed a run, and
 * `$(…)` would have been executed rather than committed. Branch names carry agent-authored task
 * ids for the same reason. See Q-0011.
 *
 * Declared here rather than imported: `git/git.ts` keeps its own runner module-private, and a port
 * that exported it to save four lines would widen that module's surface for this one's
 * convenience.
 */
const git = (args: readonly string[], cwd: string): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const safe = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

/** One property off whatever `execFileSync` threw, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'stdout' | 'stderr' | 'message'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/**
 * What a branch probe established, which is three answers rather than a boolean.
 *
 * Spelled as a bare union rather than as a result object, and the two shapes in this package are
 * chosen per question rather than uniformly: this one is read to decide what to *do* next and its
 * failure is reported by the caller in the caller's own words, where {@link BranchHeadResult} is
 * read into durable records that a reader meets without the run beside them.
 */
export type BranchProbe =
  /** git resolved the ref: the branch is there. */
  | 'present'
  /** git answered, with its own documented exit of 1: there is no such branch here. */
  | 'absent'
  /** The probe could not answer, which is never reported as either of the other two. */
  | 'failed';

/**
 * Does `branch` name a local branch? Three answers, because the callers act differently on two of
 * them and used to be told one.
 *
 * `--verify --quiet` is documented to exit **1** for a ref that is not there, and that exit — and
 * only that exit — is `absent`; everything else is the probe failing. See *"A probe that could not
 * answer is not a negative"* (2026-09-10).
 *
 * Named `branchProbe` and not `branchExists` because neither `if (!x)` nor a filter predicate is a
 * type error under any three-answer shape, so only the rename makes a consumer that kept reading it
 * as a boolean fail to compile.
 */
export function branchProbe(repo: string, branch: string): BranchProbe {
  try { git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo); return 'present'; }
  catch (error) { return exitStatus(error) === 1 ? 'absent' : 'failed'; }
}

/**
 * What the branch-head probe established, in `git/git.ts`'s `ShortShaResult` shape because it
 * answers the same question about the same kind of failure — and separately from it, because that
 * one abbreviates and a rollback needs the whole sha.
 */
export type BranchHeadResult =
  /** git answered with the revision's full sha. */
  | { state: 'resolved'; sha: string; detail: null }
  /** git answered, with its own documented exit of 1: the revision does not resolve here. */
  | { state: 'no-such-ref'; sha: null; detail: null }
  /** The probe could not answer, which is never reported as either of the other two. */
  | { state: 'failed'; sha: null; detail: string | null };

/**
 * The full sha `branch` resolves to, as three answers.
 *
 * `finish()` reads this before a run touches the ticket branch, so that a run which does not
 * complete can put it back where it found it: integrate merges task branches before anyone knows
 * whether the run will succeed, and an exhausted or aborted run used to leave those merges behind
 * — so the next stage measured its red phase against a tree that already held the implementation.
 * Nothing is lost by rolling back; each task's work stays on its own branch. See Q-0033.
 *
 * That is why the third answer is not optional here: the rollback reads a head at each end and
 * *does nothing* where it reads none, so a failed probe collapsed into "the branch is not there"
 * makes a failed run silently keep whatever integrate merged. `--verify --quiet` is what supplies
 * the discrimination, and it resolves a revision expression exactly as the bare form did.
 */
export function branchHead(repo: string, branch: string): BranchHeadResult {
  try { return { state: 'resolved', sha: git(['rev-parse', '--verify', '--quiet', branch], repo), detail: null }; }
  catch (error) {
    return exitStatus(error) === 1
      ? { state: 'no-such-ref', sha: null, detail: null }
      : { state: 'failed', sha: null, detail: failureDetail(error) };
  }
}

/**
 * Put `branch` back at `sha`: hard reset inside its worktree when one is checked out there, and a
 * plain `branch -f` in the repository when there is not.
 *
 * Why: preserved defect, see Q-0048 AC-12. The route is chosen from `fs.existsSync` alone, so a
 * worktree directory deleted by hand — with git still holding its administrative entry — takes the
 * second route and wedges the branch. No stale registration is detected, repaired or pruned.
 * Q-0042 finding 5.
 *
 * The directory is derived through `shared` rather than re-spelled here (AC-9); the path it
 * produces is externally observable and is byte-identical to the spike's.
 */
export function resetBranchTo(repo: string, branch: string, sha: string): void {
  const dir = path.join(repo, REPO_WORKTREE_ROOT, worktreeDirName(branch));
  if (fs.existsSync(dir)) { git(['reset', '--hard', sha], dir); safe(() => git(['clean', '-qfd'], dir)); }
  else git(['branch', '-f', branch, sha], repo);
}

/**
 * The paths one `status --porcelain` names, whatever this module's runner did to the first line.
 *
 * The status field is one or two characters and a space, and {@link git} trims the whole output —
 * so on line one alone a leading ` M ` arrives as `M `, and the fixed `.slice(3)` that stood here
 * ate a character of the path: `acklog/T-0001/ticket.md`. Dropping the first whitespace-delimited
 * token instead is right for both shapes and leaves every other reading — a rename's `old -> new`
 * among them — exactly where it was. The runner's own `.trim()` is untouched: it feeds every git
 * call this module makes, and moving it would move all of their outputs (Q-0074 NG-3).
 */
const porcelainPaths = (status: string): string[] => status
  .split('\n').map((line) => /^\s*\S{1,2}\s+(.*)$/.exec(line)?.[1]?.trim() ?? '').filter(Boolean);

/** What `backlog/` is holding, or a refusal naming git's own reason for not being able to say. */
function backlogChanges(dir: string, when: string): string[] {
  try { return porcelainPaths(git(['status', '--porcelain', '--', 'backlog'], dir)); }
  catch (error) {
    const detail = failureDetail(error);
    throw new IntegrationError(
      `cannot read what backlog/ is holding in ${dir} ${when}${detail === null ? '' : ` — ${detail}`}`,
    );
  }
}

/**
 * Commit everything in `dir`, having first put `backlog/` back the way the engine left it.
 *
 * The engine owns everything under `backlog/`: a ticket's stage, counters, history and cost, and
 * the per-stage artifacts it writes itself into the main worktree. A worktree is a full checkout,
 * so `backlog/` is sitting there in every step's working directory — and an agent's edit to it is
 * never authoritative. Q-0011's architect rewrote a ticket's frontmatter on its branch, resetting
 * `iterations` to `{}` and deleting three history entries with their costs; only a merge conflict
 * caught it, which is luck rather than design. Tracked edits are reverted and added files are
 * deleted, so a dirty `backlog/` cannot block the next merge either. Work outside `backlog/` in the
 * same call commits normally: this is a revert of one directory, not a refusal to commit.
 *
 * **The revert is judged by its outcome and never by the two exit codes**, which is what lets both
 * halves stay tolerant of failure without either of them lying: one of the pair legitimately fails
 * where the other did the work — `checkout -- backlog` has no pathspec to match when the only edit
 * is a file the agent added — so a second status read is what establishes that the directory really
 * did come back. Where it did not, or where either read could not be made at all, nothing is
 * staged and nothing is committed: an unread `backlog/` is one this function cannot promise it put
 * back, and committing over it is the incident above.
 *
 * @param message committed verbatim through argv — untrusted agent text, never a shell.
 * @param onDiscard called once, with what was reverted, whenever anything was — and only once the
 *   revert is proven, so it never reports a discard that did not happen. Never silent.
 * @returns the staged paths in git's order, or `null` when nothing was staged.
 * @throws {IntegrationError} where `backlog/` could not be read, or is still dirty after the revert.
 */
export function commitAll(dir: string, message: string, onDiscard?: (dropped: string[]) => void): string[] | null {
  const dirty = backlogChanges(dir, 'before staging');
  if (dirty.length) {
    // Why: response 3, see "A probe that could not answer is not a negative" (2026-09-10) — neither
    // half's exit code is read as an answer, because the status read below is what answers.
    safe(() => git(['checkout', '--', 'backlog'], dir));   // revert tracked edits
    safe(() => git(['clean', '-qfd', '--', 'backlog'], dir)); // drop files the agent added
    const left = backlogChanges(dir, 'after reverting it');
    if (left.length) {
      throw new IntegrationError(
        `backlog/ in ${dir} is still holding ${left.join(', ')} after the revert,`
        + ' and the engine owns it — nothing was committed',
      );
    }
    onDiscard?.(dirty);
  }
  git(['add', '-A'], dir);
  const staged = git(['diff', '--cached', '--name-only'], dir);
  if (!staged) return null;
  git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'commit', '-q', '-m', message], dir);
  return staged.split('\n');
}

/** What a merge did. `error` and `worktreeClean` are present only on failure; that asymmetry is the spike's. */
export interface MergeResult {
  /** Whether the merge landed. `false` is a result the caller decides on, never a throw. */
  ok: boolean;
  /**
   * Paths left unmerged, read before the merge is aborted. Empty on success, and `null` where the
   * probe that would have listed them could not answer — which is not the same claim as none.
   */
  conflicts: string[] | null;
  /** The LAST 500 characters of what git said — its own reason is at the end. Failure only. */
  error?: string;
  /**
   * Failure only: whether the worktree was left clean, established by asking whether a merge is
   * still in progress rather than by reading the abort's exit code — an abort legitimately fails
   * when there was no merge to abort, so its status is not the question. `null` where that could
   * not be established either.
   */
  worktreeClean?: boolean | null;
}

/**
 * git's own reason for a failure, from whichever stream carries it.
 *
 * stderr first, then **stdout**, then the error's message. The `??` that stood here read stderr and
 * fell back to the message, and `??` does not fall back on an empty string — so a content conflict,
 * whose `CONFLICT (content): …` git writes to *stdout*, reported an error of `''` and
 * `engine/steps.ts`'s `mergeFailure` answered *"git reported no reason"* in the one
 * case where the reason is the only information there is.
 */
const gitReason = (error: unknown): string =>
  [errorProperty(error, 'stderr'), errorProperty(error, 'stdout'), errorProperty(error, 'message')]
    .map((value) => String(value ?? ''))
    .find((text) => text.trim() !== '') ?? '';

/**
 * Merge `branch` into whatever is checked out at `dir`, and say what the worktree was left holding.
 *
 * A conflict is a result, not a throw: the unmerged paths are collected, the merge is aborted, and
 * the caller decides. It never resolves a conflict, leaves a partial merge behind silently, or
 * reports success it did not have.
 *
 * The promise this used to make — that the worktree came back clean whichever way the merge went —
 * was one the code could not keep and did not check: the abort is best-effort, so a merge could be
 * left in progress and every later merge into the same worktree then failed for a reason none of
 * them caused. It is corrected rather than made true, because forcing a worktree clean is a
 * decision about somebody else's tree, and turning a failed cleanup fatal makes a failed run harder
 * to recover from (Q-0074 NG-10, R-2). What is reported is what {@link MergeResult.worktreeClean}
 * found.
 */
export function mergeInto(dir: string, branch: string): MergeResult {
  try {
    git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'merge', '--no-ff', '--no-edit', branch], dir);
    return { ok: true, conflicts: [] };
  } catch (e) {
    // Why: response 3, see "A probe that could not answer is not a negative" (2026-09-10) — the
    // abort's own status answers nothing (it fails when there was no merge), so the probe below is
    // what the report rests on; a listing that could not be read stays `null` rather than empty.
    const listed = safe(() => git(['diff', '--name-only', '--diff-filter=U'], dir));
    safe(() => git(['merge', '--abort'], dir));
    const merging = branchHead(dir, 'MERGE_HEAD');
    return {
      ok: false,
      conflicts: listed === null ? null : listed.split('\n').filter(Boolean),
      error: gitReason(e).slice(-500),
      worktreeClean: merging.state === 'failed' ? null : merging.state === 'no-such-ref',
    };
  }
}

/**
 * The integration worktree for a ticket branch, created from `HEAD` on first use.
 *
 * The `null` base is deliberate and load-bearing: `ensureWorktree` creates the branch from `HEAD`
 * when it is given no base that resolves, which is how a ticket branch comes into being at all.
 */
export function ticketWorktree(repoDir: string, ticketBranch: string): string {
  return ensureWorktree(repoDir, ticketBranch, null);
}
