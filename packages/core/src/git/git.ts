/**
 * Worktrees, ancestry and containment. Never writes to the user's working tree.
 *
 * Why: behaviour preserved from spike/src/git.js — harness/port-charter.md §2, Q-0042.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { REPO_WORKTREE_ROOT, worktreeDirName } from '@quorum/shared';
import type { AncestryReason, AncestryResult, ContainmentReason, ContainmentResult } from '@quorum/shared';

/** Every git call: argv, never a shell — branch names carry agent-written task ids (Q-0011). */
const git = (args: readonly string[], cwd: string): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const safe = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

/**
 * One property off whatever `execFileSync` threw — `undefined` when it is absent or of another
 * type, so no caller mistakes a missing property for a convenient default.
 */
function errorProperty(error: unknown, key: 'status' | 'stderr' | 'message'): unknown {
  return typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

/**
 * The child's exit status, or `null` when the throw carried none. {@link ancestry} turns on this
 * being exactly `1`, so anything that is not a number is not a `1`.
 */
const exitStatus = (error: unknown): number | null => {
  const status = errorProperty(error, 'status');
  return typeof status === 'number' ? status : null;
};

const firstLine = (text: unknown): string | null => {
  const line = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)[0];
  return line ? line.slice(0, 200) : null;
};

/** git's own first line of stderr, falling back to the error's message, normalised and truncated. */
const failureDetail = (error: unknown): string | null =>
  firstLine(errorProperty(error, 'stderr')) ?? firstLine(errorProperty(error, 'message'));

/**
 * The pattern appended to the repository's own `info/exclude`, so the worktree root never shows up
 * in the user's `git status`.
 *
 * Why: a literal rather than `TICKET_ARTIFACT_DIR` — that is the other `.harness` namespace and
 * lacks the trailing slash. This string is written into a file in the user's repository, which
 * makes it externally observable and means it must survive byte for byte.
 */
const EXCLUDE_PATTERN = '.harness/';

/**
 * The worktree for `branch` under the repository's worktree root, created if it is not there. An
 * existing directory is returned untouched; an absent branch is created from `base` when `base`
 * resolves, and from `HEAD` otherwise.
 */
export function ensureWorktree(repoDir: string, branch: string, base?: string | null): string {
  const root = path.join(repoDir, REPO_WORKTREE_ROOT);
  const dir = path.join(root, worktreeDirName(branch));
  if (fs.existsSync(dir)) return dir;
  fs.mkdirSync(root, { recursive: true });
  ensureExcluded(repoDir, EXCLUDE_PATTERN);
  const branchExists = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repoDir));
  if (branchExists) {
    git(['worktree', 'add', dir, branch], repoDir);
  } else {
    const baseExists = base ? safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}`], repoDir)) : null;
    git(['worktree', 'add', '-b', branch, dir, base && baseExists ? base : 'HEAD'], repoDir);
  }
  return dir;
}

/** Remove `branch`'s worktree if it is there, and the branch too when `deleteBranch` says so. */
export function removeWorktree(
  repoDir: string,
  branch: string,
  { deleteBranch = false }: { deleteBranch?: boolean } = {},
): void {
  const dir = path.join(repoDir, REPO_WORKTREE_ROOT, worktreeDirName(branch));
  if (fs.existsSync(dir)) git(['worktree', 'remove', '--force', dir], repoDir);
  if (deleteBranch) safe(() => git(['branch', '-D', branch], repoDir));
}

/** What a caller already knows about the repository's history when it asks {@link ancestry}. */
export interface AncestryOptions {
  /** `true` shallow, `false` not shallow, `null` the probe could not answer — see {@link ancestry}. */
  shallow?: boolean | null;
  /** The probe's own failure detail, carried through when `shallow` is `null`. */
  shallowDetail?: string | null;
}

/**
 * Is `ref` contained in `inRef`? The repository's one answer — the board and the engine's
 * empty-range diagnostic both reach it, so the two cannot drift apart.
 *
 * The state is selected from git's own exit code and from nothing else: 0 contained, 1 provably not
 * contained, any other exit — including a git that could not run at all — indeterminate. In a
 * shallow repository an exit 1 is indeterminate too, because absent history cannot disprove
 * ancestry; `shallow: null`, an unanswered probe, is held distinct from `false` for the same reason.
 *
 * Why: "not contained" is never inferred from a failure — the containment decision of 2026-08-24,
 * and Q-0035, which removed an engine-side `catch { return false }` that did.
 *
 * @returns the state, git's own first stderr line as `detail` (never load-bearing), and `command`
 *   verbatim, so a reader can re-run the check by hand.
 */
export function ancestry(
  repoDir: string,
  ref: string,
  inRef: string,
  { shallow = false, shallowDetail = null }: AncestryOptions = {},
): AncestryResult {
  const command = `git merge-base --is-ancestor ${ref} ${inRef}`;
  try { git(['merge-base', '--is-ancestor', ref, inRef], repoDir); }
  catch (error) {
    if (exitStatus(error) !== 1) return { state: 'indeterminate', reason: 'git failed', detail: failureDetail(error), command };
    if (shallow === true) return { state: 'indeterminate', reason: 'shallow clone', detail: null, command };
    if (shallow === null) return { state: 'indeterminate', reason: 'shallow state unknown', detail: shallowDetail, command };
    return { state: 'not-contained', reason: null, detail: null, command };
  }
  return { state: 'contained', reason: null, detail: null, command };
}

/** What the shallow probe established, which includes having established nothing. */
export interface ShallowState {
  shallow: boolean | null;
  detail: string | null;
}

/** Whether this repository's history is truncated. `null` is "could not ask", not `false` (Q-0035). */
export function shallowState(repoDir: string): ShallowState {
  try { return { shallow: git(['rev-parse', '--is-shallow-repository'], repoDir) === 'true', detail: null }; }
  catch (error) { return { shallow: null, detail: failureDetail(error) }; }
}

/**
 * git's own abbreviation of `ref`, so a message can be re-checked after the refs have moved — which
 * is the only time anyone wants to. `null` when the ref does not resolve, which is also how the
 * engine tests an endpoint's existence. The length is git's business; nothing may assume it.
 */
export function shortSha(repoDir: string, ref: string): string | null {
  return safe(() => git(['rev-parse', '--verify', '--quiet', '--short', ref], repoDir));
}

/** Everything git can still prove about a three-dot range that showed nothing. */
export interface EmptyRangeEvidence {
  check: AncestryResult;
  sameTree: boolean | null;
}

/**
 * Gathered here, beside the rules, so the engine quotes evidence instead of narrating a cause.
 *
 * Direction matters: a three-dot range shows what the RIGHT endpoint added since its merge base
 * with the left, so the question asked is whether the right endpoint is contained in the left.
 * `sameTree` is asked only once ancestry has proven the two unrelated, because that is the one place
 * it discriminates — "different commits holding the same tree" against "nothing added since the
 * merge base" — and it is `null` when git could not compare them, about which a caller then claims
 * nothing. See Q-0035.
 */
export function emptyRangeEvidence(repoDir: string, left: string, right: string): EmptyRangeEvidence {
  const { shallow, detail } = shallowState(repoDir);
  const check = ancestry(repoDir, right, left, { shallow, shallowDetail: detail });
  if (check.state !== 'not-contained') return { check, sameTree: null };
  const leftTree = safe(() => git(['rev-parse', `${left}^{tree}`], repoDir));
  const rightTree = safe(() => git(['rev-parse', `${right}^{tree}`], repoDir));
  return { check, sameTree: leftTree && rightTree ? leftTree === rightTree : null };
}

/**
 * {@link ancestry}'s reason set as the board can see it. `shallow state unknown` needs
 * `shallow: null`, which {@link containment} cannot pass — a probe that could not answer made it
 * return `null` before any branch was examined — so mapping the fourth reason here, rather than
 * widening the board's set, is what keeps the rendered vocabulary closed.
 */
const boardReason = (reason: AncestryReason): ContainmentReason =>
  reason === 'shallow clone' ? 'shallow clone' : 'git failed';

/** One board invocation's answers, over a repository probed once when the closure was built. */
export interface Containment {
  /**
   * `null` when the value is not a string: nothing was named, so there is no question to ask.
   * A string naming no local branch answers `indeterminate (no branch)` — the fact that the work
   * never reached a branch, which the caller may render or suppress. `unknown` rather than
   * `string`, because it arrives from agent-written frontmatter.
   */
  stateOf(branch: unknown): ContainmentResult | null;
}

/**
 * Where a ticket's code actually is, derived from git at the moment of asking and never stored — a
 * persisted copy of a git fact drifts the first time someone merges by hand, and a wrong field is
 * believed. `null` when `repoDir` is not a git work tree, or git is unavailable: the caller renders
 * as it always did, because containment is information, never a failure.
 *
 * The per-invocation probes run once here and each {@link Containment.stateOf} costs at most two
 * more spawns, so a board of n tickets issues at most 2n + 3. A ticket's `branch` — untrusted,
 * agent-written frontmatter — is matched as a plain string against a list that came out of git, so
 * a hostile name never reaches a git command line at all. See Q-0036.
 */
export function containment(repoDir: string, base: string): Containment | null {
  let probe: string;
  try { probe = git(['rev-parse', '--is-inside-work-tree', '--is-shallow-repository'], repoDir); }
  catch { return null; }
  const [inWorkTree, shallow] = probe.split('\n').map((line) => line.trim() === 'true');
  if (!inWorkTree) return null;
  const baseResolves = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}^{commit}`], repoDir)) != null;
  // lstrip=2 drops exactly "refs/heads/". Not %(refname:short), which shortens ambiguously: a tag
  // sharing a branch's name makes it emit "heads/<name>" and the lookup below would miss it.
  const branches = new Set((safe(() => git(['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads'], repoDir)) ?? '')
    .split('\n').filter(Boolean));
  return {
    stateOf(branch: unknown): ContainmentResult | null {
      if (typeof branch !== 'string') return null;
      // Named a branch that is not here. A git fact, reported rather than swallowed: returning
      // null made it indistinguishable from "no question was asked", which is how a reviewed
      // ticket whose work never reached a branch rendered identically to one nobody had looked
      // at. What to DO with it is the board's decision, not this function's. Q-0070.
      if (!branches.has(branch)) return { state: 'indeterminate', reason: 'no branch' };
      if (!baseResolves) return { state: 'indeterminate', reason: 'missing ref' };
      const check = ancestry(repoDir, `refs/heads/${branch}`, `refs/heads/${base}`, { shallow });
      if (check.state === 'contained') return { state: 'contained' };
      if (check.state === 'indeterminate') return { state: 'indeterminate', reason: boardReason(check.reason) };
      // base..branch, not the symmetric difference, and only for a proven negative.
      const ahead = safe(() => git(['rev-list', '--count', `refs/heads/${base}..refs/heads/${branch}`], repoDir));
      if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };
      return { state: 'not-contained', ahead: Number(ahead) };
    },
  };
}

/** Append `pattern` to the repository's `info/exclude` if it is not already a line of it. */
export function ensureExcluded(repoDir: string, pattern: string): void {
  let f: string | undefined;
  try {
    const resolved = git(['rev-parse', '--git-path', 'info/exclude'], repoDir);
    f = path.isAbsolute(resolved) ? resolved : path.resolve(repoDir, resolved);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (!cur.split('\n').includes(pattern)) fs.appendFileSync(f, `${cur.endsWith('\n') || !cur ? '' : '\n'}${pattern}\n`);
  } catch (error) {
    const target = f ?? path.join(repoDir, '.git', 'info', 'exclude');
    // Why: what a command prints is externally observable, so this channel is Q-0050's to decide
    // (Q-0042 OQ-3) — `shared`'s `warn` event is precisely the tempting change to avoid here.
    console.warn(`warning: could not add ${pattern} to ${target}: ${String(errorProperty(error, 'message'))}`);
  }
}
