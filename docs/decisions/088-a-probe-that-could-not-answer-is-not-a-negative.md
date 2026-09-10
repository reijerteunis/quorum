# A probe that could not answer is not a negative — 2026-09-10

## Decision

**Absence is reported only on evidence of absence.** Where an operation fails, is interrupted, or
cannot be run, that outcome is represented as its own state and is never inferred as a negative
answer to the question the operation was asked. This governs `packages/core` wherever a probe's
result becomes a claim — git ancestry, ref existence, worktree membership, working-tree cleanliness,
merge outcome.

**A caller has exactly three admissible responses to "could not answer",** and which one applies is
a property of the caller, not of the probe:

1. **Stop, and name the work a human must do.** For a caller whose next action would otherwise be
   destructive or unverifiable.
2. **Continue, carrying the uncertainty explicitly.** The state travels into whatever the caller
   renders or returns, selected from a closed set that includes a member meaning *could not tell* —
   the shape containment, push lag and verified version already have.
3. **Suppress, best-effort, with a recorded reason.** Legitimate only where the caller is cleaning
   up after itself and the failure genuinely changes nothing it will go on to claim.

**The rule that decides between them, and the reason this entry is not simply "stop wrapping things
in `try`/`catch`":**

> **`safe()` is correct wherever the caller's question cannot tell its two inputs apart, and wrong
> wherever the caller acts differently on them. The primitive is not the defect; a caller that
> merges an unanswerable probe into a positive claim is.**

`configuredUser` is the worked example of the correct case: *git could not run* and *git has no
`user.name` configured* both honestly mean **nobody said**, and the caller renders that as the
sentinel `unknown` under *"A ticket's owner is supplied, never guessed"* (2026-09-08). `branchHead`
is the worked example of the wrong one: *the branch is absent* and *git could not be asked* lead a
caller to different actions, and collapsing them is what lets a failed run silently keep work it
should have rolled back.

**A rollback that cannot read a head does not reset. It warns, and it records.** Resetting anyway is
impossible where the start head was never read — there is no revision to reset *to* — and
unverifiable where the current head could not be read. Today's silent skip is what this entry
removes: the skip stays, and it stops being silent. This is *the instrument may warn and it may
never reassure* applied to an action rather than to a report.

**A narrow filesystem inspection may distinguish an absent `.git` from an unreadable or malformed
one.** *"Membership is a git question, not a filesystem one"* (2026-08-28) does **not** govern this
case. That entry is scoped to `turbo-inputs.test.ts` and argues from what turbo hashes into a task's
inputs, where git's index is the authority on whether a file is part of the project. *Is there a
readable git directory at this path* is not a membership question, and the filesystem is the only
thing that can answer it when git's own answer is the thing that failed. Q-0090's E-1 is the
precedent for ruling exactly this kind of scope question, and it ruled the same way.

The permission is bounded and the bound is the point: the inspection may separate **absent** from
**present but unreadable or unparseable**, and nothing else. It may not decide whether a path is
inside a repository, whether a ref exists, or whether a file is tracked — all of which stay git's,
and none of which a stat can honestly answer.

**One sentence on the habit, and no more.** The three failures that prompted this entry were not all
`catch` blocks: two were an author grepping for one token, finding nothing, and reading absence into
it. A decision entry rules on code; that a measurement which failed to look is not a measurement
that found nothing belongs in `harness/rules.md`, and if it earns more than a sentence it earns its
own entry.

## Alternatives considered

**Widen every `safe()` return type to a three-state result.** Refused on the census: of twenty-four
call sites, **eleven are already correct**, several deliberately so with their reasoning in their
own JSDoc. A blanket widening would churn eleven correct sites, produce a diff nobody could review
against its purpose, and — worse — imply the primitive was the defect, which would leave the next
author reaching for a wider type instead of asking what their caller does with the answer.

**Delete `safe()` and require an explicit `try`/`catch` at every site.** The same objection, plus it
removes the one place a rule can be written down. `safe()` with a documented contract is better than
twenty-four hand-rolled catches.

**Rule per site and write no entry.** Refused: the question is *what a caller may claim*, which is
product policy, and it recurs. Q-0050 deferred it once on the ground that a fix needed an accepted
entry first; deferring again would make that deferral permanent.

**Answer the filesystem question at the successor's own gate.** Efficient rather than necessary — it
governs that half's design, so ruling it here means the successor arrives unblocked. Deferring costs
one ruling instead of one run only if the ruling goes the obvious way, and it is not obvious enough
to leave to a gate under time pressure.

## Why

Twenty-four call sites of one primitive, declared byte-for-byte twice in two modules with nobody's
attention on either copy. **Thirteen collapse a failure into a negative.** Four of those were named
by no ticket, no comment and no test before the census that produced this entry:

- `git.ts:345` — one failed `for-each-ref` empties the branch set, and `quorum board` then answers
  **`no branch` for every ticket in the backlog**, a state the glossary defines as *"git was never
  asked"*. The product's most-used command, telling an adopter none of their work exists.
- `git.ts:143` — a base probe that fails is ignored, and the worktree is cut from `HEAD` instead.
- `fanout.ts:280` — a failed status probe reads as a clean `backlog/`, so no revert runs and the
  discard callback never fires.
- `fanout.ts:317` — a failed `merge --abort` is discarded, leaving a merge in progress against a
  JSDoc promising *"leave the worktree clean either way"*.

The engine's rollback is the sharpest case and it has **two** routes rather than the one recorded
until now: `lifecycle.ts:136` guards on the head read at run start and `:139` on the head read at
rollback time, and both operands come from `safe()`-wrapped reads. A git that fails at either end
makes a failed run silently keep whatever `integrate` merged.

None of this is likely today — a run reaching this code has already spawned git many times. It stops
being unlikely at M3, where a run nobody is watching is exactly where *git failed* rendering as *the
branch is not there* costs something, and where the rollback skipping itself is unattended rather
than observed. That is why this is ruled now rather than when it fires.

Extends *"Containment is derived from git on each board invocation, never stored"* (2026-08-24),
*"An absent branch is an answer, and the board decides whether it is worth saying"* (2026-08-28) and
*"The board reports push lag, and never a CI conclusion"* (2026-09-06), which settled this same
discipline for three subjects one at a time. This states it once, for the primitive underneath them.
