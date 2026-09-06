/**
 * Worktrees, ancestry and containment. Never writes to the user's working tree.
 *
 * Why: behaviour preserved from spike/src/git.js — harness/port-charter.md §2, Q-0042.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { REPO_WORKTREE_ROOT, worktreeDirName } from '@quorum/shared';
import type {
  AncestryReason, AncestryResult, ContainmentReason, ContainmentResult, PushLagResult,
} from '@quorum/shared';

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

/**
 * git's exit code for a fatal, which is also the code it issues where there is no repository —
 * `fatal: not a git repository`, measured at 128 on git 2.55. {@link insideWorkTree} turns on it.
 */
const GIT_FATAL = 128;

/**
 * Is `repoDir` inside a work tree? `true` and `false` are git's own answers; `null` is **the probe
 * could not answer**, which is a different thing from either and is never collapsed into `false`.
 *
 * The distinction is what {@link pushLag} needs and {@link containment} does not: git exits
 * {@link GIT_FATAL} to say there is no repository here, and anything else — no git on the path, a
 * killed process, a shim — is the probe failing rather than answering. Selected from git's exit code
 * and from nothing else, which is {@link ancestry}'s rule one function along; stderr is not read,
 * because git translates it and a locale would then decide the state.
 *
 * The residual limit, stated rather than hidden: git spends 128 on every fatal, so a repository it
 * refuses to *open* — dubious ownership, an unsupported format version — is read here as "no
 * repository", and a caller is silent about it. That is the same answer {@link containment} gives
 * the same directory, and telling the two apart needs git's prose, which is exactly what may not
 * decide a state.
 */
function insideWorkTree(repoDir: string): boolean | null {
  try { return git(['rev-parse', '--is-inside-work-tree'], repoDir) === 'true'; }
  catch (error) { return exitStatus(error) === GIT_FATAL ? false : null; }
}

/**
 * Does `ref` name a commit in this repository? `false` on git's own "no such ref" exit of 1, which
 * `--verify --quiet` is documented to use; `null` where the probe failed for any other reason, so a
 * broken git is never reported as an absent ref.
 */
function resolvesToCommit(repoDir: string, ref: string): boolean | null {
  try { git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], repoDir); return true; }
  catch (error) { return exitStatus(error) === 1 ? false : null; }
}

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

/**
 * Where `a` and `b` forked, as a sha, or `null` when git could not answer — a ref that does not
 * exist being one of the reasons, which this deliberately does not tell apart from the others.
 *
 * It lives here rather than in the engine because a landed guard permits `merge-base` in exactly one
 * file, and {@link ancestry} is not a substitute: that one asks a yes/no/unknown question and this
 * one is read for the revision it names, in an integration step's evidence line.
 *
 * Why: deliberate addition, not preservation — see Q-0053 errata E-1, which accepts the one
 * divergence it carries. The spike's `safeMergeBase` runs with git's stderr inherited, so a failing
 * call printed git's own `fatal:` line to the terminal; this module has one runner, it pipes, and a
 * library M3's daemon hosts has no terminal to print to.
 */
export function mergeBase(repoDir: string, a: string, b: string): string | null {
  return safe(() => git(['merge-base', a, b], repoDir));
}

/**
 * The branch `dir` is on, or `null` where git cannot name one.
 *
 * `git branch --show-current` names the branch even on an **unborn HEAD** — a fresh
 * `git init -b <name>` before the first commit — and prints an **empty string**, not an error, on a
 * detached HEAD. Both are "cannot name a branch" for a caller's purposes, so the empty string
 * becomes `null` here rather than reaching one as a branch called nothing. Outside a repository, or
 * with a broken `GIT_DIR`, the command itself fails and that is `null` too.
 *
 * **git's stderr never leaves this function**, which is a property rather than an accident of the
 * runner: its one caller scaffolds a project, which is the first command an adopter runs, and a raw
 * `fatal: not a git repository` on that path reads as the product having crashed. Why: preserved from
 * `spike/bin/harness.js:287–292`, whose `stdio` is `['ignore', 'pipe', 'ignore']` for the same
 * reason; this module's one runner already pipes both, so the behaviour is the same and the
 * spelling is the module's.
 *
 * Not on `@quorum/core`'s barrel: a symbol reaches it because a command needs it, and no command
 * asks this question — `init` asks for a project to be scaffolded and this is how that is answered.
 */
export function currentBranch(dir: string): string | null {
  const name = safe(() => git(['branch', '--show-current'], dir));
  return name === null || name === '' ? null : name;
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
 * more spawns, so this function's own contribution to a board of n tickets is at most 2n + 3. Since
 * Q-0105 the board also calls {@link pushLag}, whose cost is constant in n — at most 7, measured by
 * the spawn counter rather than counted by eye — so the board's whole budget is at most 2n + 10. A
 * ticket's `branch` — untrusted, agent-written frontmatter — is matched as a plain string against a
 * list that came out of git, so a hostile name never reaches a git command line at all. See Q-0036.
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

/**
 * How far the configured base branch is ahead of the upstream it tracks — commits that have never
 * left this machine — derived from git at the moment of asking and never stored.
 *
 * `null` means **git said there is no work tree here**, and nothing else: the caller renders as it
 * always did, which is what keeps a freshly initialised project's board byte-identical. A probe that
 * *could not answer* is not that — it is `git failed`, and it prints. The two are told apart by
 * {@link insideWorkTree}, and conflating them is how a repository with a broken git reported
 * silence, which for this fact is the shape of a clean bill of health.
 *
 * **A second fact under {@link containment}'s rules, not a second way of doing it**, which is why it
 * is a separate function: `containment` asks where a *ticket branch* stands against the base and
 * returns `null` outside a work tree, so a fact folded into it would be unaskable exactly where a
 * caller still wants it. See "The board reports push lag, and never a CI conclusion" (2026-09-06).
 *
 * **Every state is selected from an answer git gave, never inferred from a failure.** A repository
 * with no remotes, a base that does not resolve, a base tracking nothing, truncated history and a
 * git that failed each reach their own reason, and none of them reaches `pushed` — the mistake
 * "not contained is never inferred from a failure" already forbids one fact along.
 *
 * **Probe for existence, then count.** `%(upstream)` returns the empty string rather than failing
 * when a branch tracks nothing, and `git rev-list --count` emits an integer under every locale. The
 * tempting single atom is unusable here: `%(ahead-behind:<ref>)` fatals the *whole* `for-each-ref`
 * invocation on one missing ref, and this feeds a command that must exit 0. **Both** endpoints are
 * probed, because `%(upstream)` names a ref that configuration asserts and the object store may not
 * hold; counting over one of those fatals, and the failure would be reported as a broken git rather
 * than as the absent ref it is.
 *
 * Shallow history can only make the count too small, so it is reported as a reason rather than as a
 * number that is quietly a floor. Nothing here reads or writes the network: there is no fetch, no
 * `ls-remote` and no credential on this path, and the answer is therefore as of the last fetch —
 * it may over-report and it may never under-report, which is what lets a caller warn on it and
 * forbids a caller reassuring on it.
 *
 * At most seven spawns, constant in the number of tickets a board holds, and measured by the spawn
 * counter rather than counted by eye.
 */
export function pushLag(repoDir: string, base: string): PushLagResult | null {
  // Two probes rather than one, because they answer two questions and only the first decides
  // whether there is a question at all. A work tree git could not confirm is `null` — the caller
  // renders as it always did — and every failure AFTER that is reported, silence being this fact's
  // success output: a check that skips its subject must not report success (2026-08-25).
  const inWorkTree = insideWorkTree(repoDir);
  if (inWorkTree === null) return { state: 'indeterminate', reason: 'git failed' };
  if (!inWorkTree) return null;
  // No remotes at all is an answer, not a failure: there is nowhere the base could be ahead of. A
  // freshly initialised project is this, and what to DO with it is the caller's decision.
  const remotes = safe(() => git(['remote'], repoDir));
  if (remotes == null) return { state: 'indeterminate', reason: 'git failed' };
  if (remotes === '') return { state: 'indeterminate', reason: 'no remote' };
  const baseRef = `refs/heads/${base}`;
  const baseResolves = resolvesToCommit(repoDir, baseRef);
  if (baseResolves === null) return { state: 'indeterminate', reason: 'git failed' };
  if (!baseResolves) return { state: 'indeterminate', reason: 'missing ref' };
  // Both fields in one call, separated by a space, which no ref name may contain. Exactly one line
  // comes back: the ref resolved above, so git's own D/F rule forbids `<baseRef>/…` beside it, and
  // that is the only other thing this pattern could match.
  const tracking = safe(() => git(['for-each-ref', '--format=%(upstream) %(upstream:short)', baseRef], repoDir));
  if (tracking == null) return { state: 'indeterminate', reason: 'git failed' };
  const [upstreamRef = '', upstream = ''] = tracking.split(' ');
  if (upstreamRef === '') return { state: 'indeterminate', reason: 'no upstream' };
  // `%(upstream)` is computed from `branch.<name>.remote` and `.merge`, so it names a ref that may
  // not be there — what `git branch -vv` renders as `[gone]`, and what a pruned or hand-deleted
  // tracking ref leaves behind. That is a ref that does not resolve, which is `missing ref` and not
  // a git that failed; without this the count below fatals and the wrong reason is reported.
  const upstreamResolves = resolvesToCommit(repoDir, upstreamRef);
  if (upstreamResolves === null) return { state: 'indeterminate', reason: 'git failed' };
  if (!upstreamResolves) return { state: 'indeterminate', reason: 'missing ref' };
  const { shallow } = shallowState(repoDir);
  if (shallow === null) return { state: 'indeterminate', reason: 'git failed' };
  if (shallow) return { state: 'indeterminate', reason: 'shallow clone' };
  // upstream..base, never the symmetric difference: a base that is only behind has nothing waiting.
  const ahead = safe(() => git(['rev-list', '--count', `${upstreamRef}..${baseRef}`], repoDir));
  if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };
  const count = Number(ahead);
  if (!Number.isInteger(count)) return { state: 'indeterminate', reason: 'git failed' };
  return count === 0 ? { state: 'pushed' } : { state: 'unpushed', ahead: count, upstream };
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
