# Git worktrees are the execution model — 2026-08-06
**Decision:** Every code-writing step runs in its own git worktree on its own branch (e.g. `harness/run-42/coder-a`). Judges/reviewers receive branches + diffs as input. A run's end product is a branch or PR — the user's working tree is never mutated except by an explicit, user-approved merge. Failed/runaway runs are discarded by deleting branches.
**Alternatives considered:** Agents share the working tree (parallel agents collide, destructive); full repo clones per step (safe but slow and disk-hungry).
**Why:** Worktrees give collision-free parallelism, make every candidate implementation an inspectable diff (so judge verdicts are checkable), and keep the user's repo safe by construction.
