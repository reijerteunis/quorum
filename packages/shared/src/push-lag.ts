// Push lag: the git-derived relationship between the configured BASE BRANCH and the upstream
// tracking ref it is configured to push to, expressed as a closed set of states and one closed set
// of reasons. Declarations only — the derivation lives in packages/core's git module and the
// rendering in the CLI, and neither may spell one of these strings a second time.
//
// A sibling of containment.ts rather than an addition to it, because it is a second SUBJECT under
// the same rules. Containment answers "where is a ticket branch relative to the base"; this answers
// "where is the base relative to its upstream". See docs/DECISIONS.md, "The board reports push lag,
// and never a CI conclusion" (2026-09-06), which extends "Containment is derived from git on each
// board invocation, never stored" (2026-08-24) rather than contradicting it: derive on every
// invocation, persist nothing, select from a closed set, and never report an unanswerable question
// as one of the answerable states.
//
// ---------------------------------------------------------------------------------------------
// THE INSTRUMENT MAY WARN AND MAY NEVER REASSURE
// ---------------------------------------------------------------------------------------------
//
// A `git push` updates the tracking ref locally, so for the maintainer's own commits the count is
// exact; absent a fetch it can OVER-report and never under-report, except where a remote moved
// backwards. Every answer here is therefore "as of the last fetch", which is why `pushed` means
// only "git had nothing to say" and never "this was validated". Nothing in this vocabulary, and
// nothing rendered from it, may carry wording equivalent to "CI passed", "verified" or "not
// validated": what is measured is whether commits have left the machine, and that is all.
//
// ---------------------------------------------------------------------------------------------
// THE STATE SET IS COMPLETE; THE RENDERING TABLE IS SEPARATE
// ---------------------------------------------------------------------------------------------
//
// `no remote` is a first-class answer here and prints nothing on the board, exactly as containment's
// `no branch` is — a repository with no remotes has nothing to be behind, and telling an adopter so
// on every invocation would be noise. Whether an answer is worth rendering is the surface's call and
// not this vocabulary's.

/**
 * Exactly three. `pushed` is "the upstream holds everything the base does", which is a statement
 * about two local refs; it is never inferred from a probe that failed, and never read as a claim
 * that anything ran anywhere.
 */
export const PUSH_LAG_STATES = ['pushed', 'unpushed', 'indeterminate'] as const;

export type PushLagState = (typeof PUSH_LAG_STATES)[number];

/**
 * Why the probe could not answer. Five, and each is a different question going unanswered rather
 * than a different flavour of failure.
 *
 * - `no remote` — the repository has no remotes configured at all, so there is nothing the base
 *   could be ahead of. A fresh `quorum init` project is this, which is why the board suppresses it.
 * - `no upstream` — a remote exists and the base tracks nothing, so git knows of somewhere to push
 *   and has not been told this branch goes there. Worth saying: it is the state that most resembles
 *   the incident this was built for, a base branch nothing is watching.
 * - `missing ref` — one of the two refs the count is over does not resolve: the configured base
 *   branch, or the tracking ref its own configuration names, which git renders as `[gone]` and
 *   which outlives the objects it pointed at. Containment's reason of the same name is about the
 *   base alone, because containment counts over a ticket branch that it has already seen listed.
 * - `shallow clone` — history is truncated, so a count of commits the upstream lacks can only
 *   understate. A number that can only be too small is not reported as a number.
 * - `git failed` — any spawn failure, non-zero exit, timeout, or no git on the path at all, at any
 *   step from the work-tree probe onward. **Including that probe**: git's own fatal saying there is
 *   no repository here is an answer and is not this reason, and every other way of failing to
 *   answer is, because for a fact whose success output is silence an unexamined subject that says
 *   nothing is indistinguishable from a clean one (2026-08-25).
 */
export const PUSH_LAG_REASONS = [
  'no remote', 'no upstream', 'missing ref', 'shallow clone', 'git failed',
] as const;

export type PushLagReason = (typeof PUSH_LAG_REASONS)[number];

/**
 * What a surface renders, as at most one repository-level line — never a per-ticket annotation and
 * never a `<base>:` token, which is containment's grammar and stays containment's.
 *
 * `ahead` is `<upstream>..<base>`: the commits the base holds and the upstream does not, never the
 * symmetric difference. A base that is only BEHIND its upstream has no push lag and is `pushed` —
 * nothing is waiting to leave this machine, whatever the upstream has moved on to.
 *
 * `upstream` is git's own short name for the tracking ref, carried because the rendered sentence has
 * to name it and because the surface must not compose one: the remote is whatever this repository
 * calls it, and no code here spells a remote's name.
 *
 * The `?: never` members are not decoration. Without them an object typed as one variant is
 * assignable to another whenever its extra key happens to be absent from the target's declaration,
 * so the claim would hold for object literals and quietly fail for everything else.
 */
export type PushLagResult =
  | { state: 'pushed'; ahead?: never; upstream?: never; reason?: never }
  | { state: 'unpushed'; ahead: number; upstream: string; reason?: never }
  | { state: 'indeterminate'; reason: PushLagReason; ahead?: never; upstream?: never };
