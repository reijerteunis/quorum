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

import { ensureWorktree } from '../git/git.js';

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
const errorProperty = (error: unknown, key: 'stderr' | 'message'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/**
 * Does `b` name a local branch?
 *
 * Why: preserved defect, see Q-0048 AC-6. This returns `false` when git itself failed as well as
 * when the branch is absent — the conflation `ancestry()` in this same package was rewritten to
 * forbid. Latent because a run reaching here has already spawned git successfully several times.
 */
export function branchExists(repo: string, b: string): boolean {
  return Boolean(safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${b}`], repo)));
}

/**
 * The full sha `branch` resolves to, or `null`.
 *
 * `finish()` reads this before a run touches the ticket branch, so that a run which does not
 * complete can put it back where it found it: integrate merges task branches before anyone knows
 * whether the run will succeed, and an exhausted or aborted run used to leave those merges behind
 * — so the next stage measured its red phase against a tree that already held the implementation.
 * Nothing is lost by rolling back; each task's work stays on its own branch. See Q-0033.
 *
 * Why: preserved defect, see Q-0048 AC-6 — `null` is also what a failed git returns.
 */
export function branchHead(repo: string, branch: string): string | null {
  return safe(() => git(['rev-parse', branch], repo));
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
 * Why: preserved defect, see Q-0048 AC-12. Both halves of the revert are tolerant of failure, so a
 * revert that FAILED still reports through `onDiscard` as though it had discarded.
 *
 * @param message committed verbatim through argv — untrusted agent text, never a shell.
 * @param onDiscard called once, with what was reverted, whenever anything was. Never silent.
 * @returns the staged paths in git's order, or `null` when nothing was staged.
 */
export function commitAll(dir: string, message: string, onDiscard?: (dropped: string[]) => void): string[] | null {
  const dirty = (safe(() => git(['status', '--porcelain', '--', 'backlog'], dir)) ?? '')
    .split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  if (dirty.length) {
    safe(() => git(['checkout', '--', 'backlog'], dir));   // revert tracked edits
    safe(() => git(['clean', '-qfd', '--', 'backlog'], dir)); // drop files the agent added
    onDiscard?.(dirty);
  }
  git(['add', '-A'], dir);
  const staged = git(['diff', '--cached', '--name-only'], dir);
  if (!staged) return null;
  git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'commit', '-q', '-m', message], dir);
  return staged.split('\n');
}

/** What a merge did. `error` is present only on failure; that asymmetry is the spike's. */
export interface MergeResult {
  /** Whether the merge landed. `false` is a result the caller decides on, never a throw. */
  ok: boolean;
  /** Paths left unmerged, read before the merge is aborted. Empty on success. */
  conflicts: string[];
  /** The LAST 500 characters of what git said — its own reason is at the end. Failure only. */
  error?: string;
}

/**
 * Merge `branch` into whatever is checked out at `dir`, and leave the worktree clean either way.
 *
 * A conflict is a result, not a throw: the unmerged paths are collected, the merge is aborted, and
 * the caller decides. It never resolves a conflict, leaves a partial merge behind, or reports
 * success it did not have.
 */
export function mergeInto(dir: string, branch: string): MergeResult {
  try {
    git(['-c', 'user.email=harness@local', '-c', 'user.name=harness', 'merge', '--no-ff', '--no-edit', branch], dir);
    return { ok: true, conflicts: [] };
  } catch (e) {
    const conflicts = (safe(() => git(['diff', '--name-only', '--diff-filter=U'], dir)) ?? '').split('\n').filter(Boolean);
    safe(() => git(['merge', '--abort'], dir));
    return { ok: false, conflicts, error: String(errorProperty(e, 'stderr') ?? errorProperty(e, 'message')).slice(-500) };
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
