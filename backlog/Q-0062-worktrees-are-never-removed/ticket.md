---
id: Q-0062
title: Worktrees are never removed — removeWorktree has no callers
stage: draft
owner: ruud
repos: []
branch: harness/Q-0062/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Raised by Ruud on 2026-08-26: *"worktrees are not automatically cleared after they have finished"*.

**The defect.** `removeWorktree(repoDir, branch, { deleteBranch })` exists at `spike/src/git.js:26`,
is exported, and was ported to `packages/core/src/git.ts:84` by Q-0042 with four tests covering
removal, idempotence, branch deletion and the refusal to delete the current branch. **It has zero
call sites.** Nothing in `engine.js`, `fanout.js` or `finish()` calls it, so every worktree a run
creates stays on disk forever.

    $ git worktree list
    …/.harness/worktrees/harness__Q-0042__implement      96f746c
    …/.harness/worktrees/harness__Q-0042__integration    8bed311
    …/.harness/worktrees/harness__Q-0043__implement      61ed7c8
    …/.harness/worktrees/harness__Q-0043__integration    f560b91

Four from two tickets, both of which completed, merged and are `main:contained`. Every run since M1
has left its own; the count grows with the backlog and nothing prunes it.

**Why it is more than untidiness.** A stale worktree holds a checked-out branch, so
`git branch -d` refuses and the branch survives too — which is how `git branch -a` reached the size
it is now. It also puts a full second copy of `node_modules` on disk per worktree once `integrate`
has installed there. And a worktree whose branch has been rolled back by `finish()` is a directory
containing work no ref points at, which is the *"state outliving the run that created it"* pattern
M1's closing entry named.

**Deliberately not decided here: what counts as finished.** A worktree is safe to remove when its
run has completed *and* its branch is contained in the ticket branch — but the M1 item *"`finish()`
does not roll back task branches"* is still open, and a failed run's worktree is exactly the thing
someone wants to inspect. The likely shape is: remove on success, keep on failure, and offer
`harness worktrees --prune` for the rest. **The two must be decided together** — this ticket and the
task-branch rollback are the same question about the same lifecycle, and fixing one without the
other produces a half-cleaned state that is harder to reason about than either.

**Scope.** `spike/src` is frozen (`harness/port-charter.md` §3), so the call sites land against
`packages/core` after Q-0050 (`core/engine` — the run loop) and Q-0053 (fan-out and integrate),
which are where `finish()` and the fan-out's worktree creation arrive. The primitive is already
ported and tested, so this ticket is call sites plus a lifecycle decision, not new git code. A
`--prune` command belongs to Q-0010. Belongs to M2 in `docs/06-development-plan.md`.
