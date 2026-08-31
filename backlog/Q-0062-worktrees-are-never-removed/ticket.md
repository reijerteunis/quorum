---
id: Q-0062
title: Worktrees are never removed — removeWorktree has no callers
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0062/integration
priority: p2
created: 2026-08-26
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-31T19:18:30.028Z
    cost: 8.445
---
Raised by Ruud on 2026-08-26: *"worktrees are not automatically cleared after they have finished"*.

**The defect.** `removeWorktree(repoDir, branch, { deleteBranch })` exists at `spike/src/git.js:26`,
is exported, and was ported to `packages/core/src/git/git.ts` by Q-0042 with four tests covering
removal, idempotence, branch deletion and the refusal to delete the current branch. **It has zero
call sites.** Nothing in `engine.js`, `fanout.js` or `finish()` calls it, so every worktree a run
creates stays on disk forever.

    $ git worktree list                                     # 2026-08-26, as raised
    …/.harness/worktrees/harness__Q-0042__implement      96f746c
    …/.harness/worktrees/harness__Q-0042__integration    8bed311
    …/.harness/worktrees/harness__Q-0043__implement      61ed7c8
    …/.harness/worktrees/harness__Q-0043__integration    f560b91

Four from two tickets, both of which completed, merged and are `main:contained`. Every run since M1
has left its own, and nothing prunes it.

**Re-measured 2026-08-31, before the requirements run.** Those four are gone — removed by hand at
some point between, which is itself the finding: the only thing that has ever cleaned a worktree in
this repository is a person remembering to. Today's instance is Q-0058's, the ticket that closed the
same day:

    $ git worktree list
    …/.harness/worktrees/harness__Q-0058__implement      85467fd
    …/.harness/worktrees/harness__Q-0058__integration    dc22890

    $ du -sh .harness/worktrees/
    277M    .harness/worktrees/          # 250M of it node_modules, 125M per worktree

**Do not re-derive the accumulation claim from the 2026-08-26 count**, which no longer reproduces.
The measurement that survives is the per-run one: a single closed chore ticket leaves two worktrees
and 277 MB.

**Why it is more than untidiness.** A stale worktree holds a checked-out branch, so
`git branch -d` refuses and the branch survives too: Q-0058's `implement` and `integration` branches
are both still on disk for that reason, and they are two of the five refs `git branch -a` reports.
**The original claim that this is "how `git branch -a` reached the size it is now" no longer holds**
and should not be inherited — the branch list has since been pruned by hand to five. The mechanism
is intact; the accumulation evidence for it is not.

It also puts a full second copy of `node_modules` on disk per worktree — **and the qualifier "once
`integrate` has installed there" is wrong**. Both Q-0058 worktrees carry 125M of it, including the
`implement` one, where `commands.install` does not run: `engine.js:1034` runs it only in an
`integrate` worktree, so that copy is there because the implementer hand-built it, which is the cost
Q-0049's run recorded paying and `harness/rules.md` now warns about. Either route leaves the same
250 MB behind.

And a worktree whose branch has been rolled back by `finish()` is a directory containing work no ref
points at, which is the *"state outliving the run that created it"* pattern M1's closing entry
named.

**Deliberately not decided here: what counts as finished.** A worktree is safe to remove when its
run has completed *and* its branch is contained in the ticket branch — but the M1 item *"`finish()`
does not roll back task branches"* is still open, and a failed run's worktree is exactly the thing
someone wants to inspect. The likely shape is: remove on success, keep on failure, and offer
`harness worktrees --prune` for the rest. **The two must be decided together** — this ticket and the
task-branch rollback are the same question about the same lifecycle, and fixing one without the
other produces a half-cleaned state that is harder to reason about than either.

**Scope — corrected 2026-08-31, and the correction changes which tree is in scope.** The body
said `spike/src` is frozen so the call sites land in `packages/core`. **That reads the charter
wrong.** §3's freeze is a property of Q-0009's fifteen tickets, not of any ticket or role, and the
machine-readable `children:` list at `harness/port-charter.md:264` is Q-0041–Q-0054. Q-0062 is not
in it, so the branch-scope job reports it out of scope rather than passing silently, exactly as it
did for Q-0038 and Q-0057. **Q-0062 may write `spike/src`.**

Which means *whether* it should is an open question rather than a settled constraint, and Q-0057's
precedent argues it must: the spike is still what runs every flow in this repository, so a
`core`-only fix removes no worktree anyone will actually accumulate until the cutover — and the
cutover is behind Q-0010, which has no ticket. A `core`-only fix would leave this defect live in the
only tree that currently creates worktrees. The requirements run should settle this and not assume
the original sentence.

**The blocking dependency is discharged.** Q-0050 and Q-0053 are both `reviewed` and contained as of
2026-08-29 and 2026-08-31. `finish()` is `packages/core/src/engine/lifecycle.ts:9`, the run loop's
`finishRun` is `engine.ts:204`, and the fan-out's worktree creation is `fanout.ts`, which imports
`ensureWorktree` from `../git/git.js`.

**Three landed pins forbid the fix, and a criterion written without naming them will fail against a
green guard.** The port did not leave a gap here by accident; it left a hole with a lid on it, and
every one of these was landed deliberately with Q-0062 named as the owner:

| Pin | What it forbids |
| --- | --- |
| `packages/core/src/fanout/fanout.source.test.ts:209` | the literal `removeWorktree`, `for-each-ref`, `'-D'` and `'branch', '-d'` in **every** fan-out module, its comment binding it to register row 20 |
| `packages/core/src/engine/q0050.source.test.ts:133` (AC-9d) | any engine file matching `/(?:reset\|delete\|remove)TaskBranch/i`, derived from `production` so it covers new engine files without anyone remembering |
| `packages/core/src/fanout/fanout.test.ts:27` | nothing, but its comment cites this ticket's **four-worktree count**, which is now false in landed source |

Changing a landed pin is a deliberate act a reviewer will correctly block unless the requirement
authorises it in as many words — the cost Q-0080's requirement stated plainly against its own
ticket body. Say which pins move, and why, before an implementer meets them.

The primitive is already ported and tested, so this ticket is call sites plus a lifecycle decision,
not new git code. A `--prune` command belongs to Q-0010. Belongs to M2 in
`docs/06-development-plan.md`.
