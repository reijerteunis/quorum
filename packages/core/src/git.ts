// Worktree per writing step. Never touches the user's working tree.
//
// Ported from spike/src/git.js for Q-0042 with behaviour preserved (harness/port-charter.md §2).
// The rules below are not implementation notes: each was bought after a failure that cost real
// money, and each has an obvious implementation that is wrong. A TypeScript rewrite is exactly
// where they get lost — `execFileSync` throws `unknown` under `strict` and the shortest route to a
// clean compile is `catch { return false }`, which is the confident falsehood Q-0035 removed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { REPO_WORKTREE_ROOT, worktreeDirName } from '@quorum/shared';
import type { AncestryReason, AncestryResult, ContainmentReason, ContainmentResult } from '@quorum/shared';

// argv, never a shell. Branch names are built from ticket and task ids, and task ids come from a
// tasks.yaml an agent wrote — so they are untrusted input reaching a command line. See Q-0011.
const git = (args: readonly string[], cwd: string): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const safe = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

/**
 * What `execFileSync` throws is `unknown`, and the two things this module needs from it — the
 * child's exit status and its stderr — are reachable only by narrowing. Reading them through one
 * guard keeps `any` out and keeps every caller honest about what it actually established: a
 * property that is absent, or present with the wrong type, yields `undefined` rather than a
 * default that happens to be convenient.
 */
function errorProperty(error: unknown, key: 'status' | 'stderr' | 'message'): unknown {
  return typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

/**
 * The child's exit status, or `null` when the throw carried none — a spawn failure, a signal, or
 * an error from somewhere other than the child. Rule 1 turns on this being exactly `1`, so
 * anything that is not a number is not a `1`.
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
 * The pattern written into the repository's own `info/exclude` so the worktree root never shows up
 * in the user's `git status`.
 *
 * It stays a literal rather than coming from `shared`: `TICKET_ARTIFACT_DIR` is the OTHER
 * `.harness` namespace — engine-written artifacts inside a ticket folder — and it lacks the
 * trailing slash, so it is the wrong constant. This string is appended to a file in the user's
 * repository, which makes it externally observable and means it must survive the port byte for
 * byte.
 */
const EXCLUDE_PATTERN = '.harness/';

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

export function removeWorktree(
  repoDir: string,
  branch: string,
  { deleteBranch = false }: { deleteBranch?: boolean } = {},
): void {
  const dir = path.join(repoDir, REPO_WORKTREE_ROOT, worktreeDirName(branch));
  if (fs.existsSync(dir)) git(['worktree', 'remove', '--force', dir], repoDir);
  if (deleteBranch) safe(() => git(['branch', '-D', branch], repoDir));
}

/** How a caller states what it already knows about the repository's history. */
export interface AncestryOptions {
  /**
   * `true` shallow, `false` not shallow, `null` the probe could not answer. Three-valued for the
   * same reason rule 1 exists — see the note on {@link ancestry}.
   */
  shallow?: boolean | null;
  /** The probe's own failure detail, carried through when `shallow` is `null`. */
  shallowDetail?: string | null;
}

// The repository's one answer to "is <ref> contained in <inRef>?", and the only place the two
// rules the containment decision of 2026-08-24 records are written down. Both callers reach it:
// containment() below, for the board, and materialiseDiff() in the engine, for the empty-range
// diagnostic. Until Q-0035 the engine read ancestry its own way — a bare try/catch that mapped
// every non-zero exit onto "not merged" — so one repository answered the same question two ways
// and the wrong one was the one that talked to the user.
//
// Rule 1: the state is selected from git's own exit codes and from nothing else. 0 → contained,
// 1 → provably not contained, any other exit (or a git that could not be executed at all) →
// indeterminate. "Not contained" is never inferred from a failure.
//
// Rule 2, the shallow asymmetry: exit 0 stays contained even in a shallow repository, because
// ancestry found in the history that is present is real; exit 1 becomes indeterminate, because
// history that is absent cannot disprove ancestry.
//
// `shallow` is three-valued for the same reason rule 1 exists: `null` means the shallow probe
// itself could not answer, and an unanswered probe may not be read as "not shallow". Rendering it
// as false would let a failed probe plus an exit 1 produce exactly the confident negative rule 1
// forbids — the repository would be asserting that absent history is not what made the check fail,
// having failed to establish whether any history is absent.
//
// `command` is returned so a caller can quote what it ran precisely enough for a reader to re-run
// by hand; `detail` is git's own first line of stderr, normalised, and is never load-bearing.
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

// Whether this repository's history is truncated — and, when git will not say, that it would not
// say. `shallow: null` is "could not ask", which is a different fact from "not shallow" and is
// kept distinct all the way into the message: only rule 2 can turn a proven negative into an
// honest "don't know", so a probe that fails must not quietly forfeit that. See Q-0035.
export function shallowState(repoDir: string): ShallowState {
  try { return { shallow: git(['rev-parse', '--is-shallow-repository'], repoDir) === 'true', detail: null }; }
  catch (error) { return { shallow: null, detail: failureDetail(error) }; }
}

// The abbreviation git itself chooses, so a message can be re-checked after the refs have moved —
// which is the only time anyone wants to re-check it. null when the ref does not resolve, which is
// also how the engine tests an endpoint's existence: one spawn answers both questions. The length
// is git's business and varies by repository, so nothing may assume it.
export function shortSha(repoDir: string, ref: string): string | null {
  return safe(() => git(['rev-parse', '--verify', '--quiet', '--short', ref], repoDir));
}

/** Everything git can still prove about a three-dot range that showed nothing. */
export interface EmptyRangeEvidence {
  check: AncestryResult;
  sameTree: boolean | null;
}

// Gathering it here, beside the rules, is what lets the engine quote evidence instead of narrating
// a cause.
//
// Direction matters: a three-dot range shows what the RIGHT endpoint added since its merge base
// with the left, so the question is whether the right endpoint is contained in the left.
//
// `sameTree` is asked only once ancestry has proven the two unrelated, because that is the one
// place it discriminates: it separates "different commits that happen to hold the same tree" from
// "nothing added since the merge base". It is three-valued — null means git could not compare the
// trees, and a caller must then claim nothing about them. See Q-0035.
export function emptyRangeEvidence(repoDir: string, left: string, right: string): EmptyRangeEvidence {
  const { shallow, detail } = shallowState(repoDir);
  const check = ancestry(repoDir, right, left, { shallow, shallowDetail: detail });
  if (check.state !== 'not-contained') return { check, sameTree: null };
  const leftTree = safe(() => git(['rev-parse', `${left}^{tree}`], repoDir));
  const rightTree = safe(() => git(['rev-parse', `${right}^{tree}`], repoDir));
  return { check, sameTree: leftTree && rightTree ? leftTree === rightTree : null };
}

/**
 * ancestry's reason set as the board can see it.
 *
 * The two sets overlap in the two reasons a board invocation can actually reach.
 * `shallow state unknown` needs `shallow: null`, which `containment` cannot pass: a probe that
 * could not answer made it return `null` before any branch was examined. That structural fact is
 * why GLOSSARY.md lists three board reasons while this module can produce four, and mapping the
 * fourth here rather than widening the board's set is what keeps the rendered vocabulary closed.
 */
const boardReason = (reason: AncestryReason): ContainmentReason =>
  reason === 'shallow clone' ? 'shallow clone' : 'git failed';

/** One board invocation's answers, over a repository probed once when the closure was built. */
export interface Containment {
  /**
   * `null` when the value is not a string or does not name a local branch — the row renders
   * unannotated, exactly as it did before containment existed. `branch` is `unknown` rather than
   * `string` because it arrives from agent-written frontmatter.
   */
  stateOf(branch: unknown): ContainmentResult | null;
}

// Where a ticket's code actually is, derived from git at the moment of asking and never stored —
// a persisted copy of a git fact drifts the first time someone merges by hand, and a wrong field
// is believed. Returns null when repoDir is not a git work tree (or git itself is unavailable):
// the caller renders as it always did, because containment is information, never a failure.
//
// The per-invocation probes (work tree + shallow, base ref, the branch list) run once here; each
// call to stateOf() then costs at most two more git spawns, so a board of n tickets issues at
// most 2n + 3. The branch list is read once via for-each-ref and each ticket's `branch` value —
// untrusted, agent-written frontmatter — is matched against it as a plain string, so a hostile
// name never reaches a git command line at all; the refs/heads/… forms passed below are only
// ever names that came out of git. See Q-0036.
export function containment(repoDir: string, base: string): Containment | null {
  let probe: string;
  try { probe = git(['rev-parse', '--is-inside-work-tree', '--is-shallow-repository'], repoDir); }
  catch { return null; }
  const [inWorkTree, shallow] = probe.split('\n').map((line) => line.trim() === 'true');
  if (!inWorkTree) return null;
  const baseResolves = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}^{commit}`], repoDir)) != null;
  // lstrip=2 drops exactly "refs/heads/", unconditionally. Not %(refname:short): shortening is
  // ambiguity-dependent, so a tag sharing a branch's name makes it emit "heads/<name>" and the
  // lookup below would miss a branch that resolves.
  const branches = new Set((safe(() => git(['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads'], repoDir)) ?? '')
    .split('\n').filter(Boolean));
  return {
    // null → the branch does not resolve to a local ref; the row renders unannotated. Otherwise
    // exactly one of the three states, chosen by ancestry() above — which owns both rules, so the
    // board and the engine's empty-range diagnostic cannot drift apart. See Q-0035.
    stateOf(branch: unknown): ContainmentResult | null {
      if (typeof branch !== 'string' || !branches.has(branch)) return null;
      if (!baseResolves) return { state: 'indeterminate', reason: 'missing ref' };
      const check = ancestry(repoDir, `refs/heads/${branch}`, `refs/heads/${base}`, { shallow });
      if (check.state === 'contained') return { state: 'contained' };
      if (check.state === 'indeterminate') return { state: 'indeterminate', reason: boardReason(check.reason) };
      // Commits reachable from the ticket branch and not from the base — not the symmetric
      // difference, and only computed for a proven not-contained result.
      const ahead = safe(() => git(['rev-list', '--count', `refs/heads/${base}..refs/heads/${branch}`], repoDir));
      if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };
      return { state: 'not-contained', ahead: Number(ahead) };
    },
  };
}

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
    // A library that writes to the console is a wart, and `shared`'s event union already has a
    // `warn` member — which is precisely why this is tempting and why it must not change here.
    // What a command prints is externally observable, so the channel is Q-0050's to decide
    // (Q-0042 OQ-3).
    console.warn(`warning: could not add ${pattern} to ${target}: ${String(errorProperty(error, 'message'))}`);
  }
}
