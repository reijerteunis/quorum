# A run removes the worktrees it made, and never the refs — 2026-08-31

**Decision:** A run that **finished** — `completed` or `regressed` — removes each worktree it
obtained. A run that did **not** finish — `failed`, `aborted` or `interrupted` — keeps every one of
them, because the directory a run stopped in is the thing a maintainer is about to open. **No ref is
ever deleted**: not a task branch, not a step branch, not the integration branch.

It is the same predicate `finish()` already reads for the stage transition and the ticket-branch
rollback, read once and consumed three times, so the inspection story and the cleanup story cannot
drift apart. Cleanup is **registration, never enumeration**: the run keeps a branch → directory map
filled at the `ensureWorktree` and `ticketWorktree` call sites it actually reaches, and nothing walks
`.harness/worktrees/` or the ref namespace. A worktree the run **reused** is registered, because a
run that reused it is the run that finished with it; a worktree anyone else left is removed by
nothing. A worktree holding uncommitted content is **kept**, and the run names the paths that kept
it, because `git worktree remove --force` discards untracked and modified content and a delete
taking a decision on somebody's behalf must at least say it took one. A removal or a status read
that fails costs one `warn` and nothing else: the status, the stage transition, the manifest, the
history entry, the terminal event and the exit code are what they would have been.

This settles register row 20 of `harness/port-charter.md` — *"`finish()` does not roll back task
branches — a known gap carried into M2"*, carried on the authority of *"M1 closed: the mechanisms
hold; what fails is scope, ownership and evidence"* (2026-08-24). The gap stops being carried and
becomes decided behaviour, and the answer is opposite for each half: **worktrees are given back,
refs are kept.**

**Alternatives considered.**

*Delete the registered `harness/<id>/*` branches after a successful run, once git proves them
contained in the ticket branch.* Refused on four grounds, the third decisive. Nobody asked for it —
the complaint was that a checked-out branch **cannot** be deleted, and removing the worktree
restores the maintainer's ability to delete it by hand. The two acts are not symmetric in
reversibility: `ensureWorktree` re-creates a removed directory from its branch, while nothing
re-creates a deleted branch by name without hunting a SHA out of the reflog. And on a completed
chore run `harness/<id>/implement` is contained in `harness/<id>/integration` **by construction**,
because `integrate` merged it — so the rule would delete, on every single run, precisely the branch
this repository reads *after* a run ends: Q-0050's rounds 4 and 6 diffed one by hand, Q-0077's
`--base` flag exists so a contained ticket can still be reviewed, and Q-0079's three hand reviews
ran against branches whose runs had finished. A policy correct in the abstract that deletes the
artifact the repository's own review practice depends on is the wrong policy. Finally it keeps the
half-cleaned state unrepresentable: with the branch always surviving, a deleted ref beside a
surviving directory is impossible by construction.

*Gate the removal on containment.* Struck by the ruling above. Once no ref is deleted, containment
answers nothing — a removed directory is re-creatable from its branch whether or not it is
contained — so the check would cost a git call per worktree on the terminal path and change no
outcome.

*Keep the integration worktree until its branch is merged.* Refused. `finish()` runs after every
step of the flow, so the inspection window at the human gate is untouched; the merge is done from
the main checkout; and the post-merge verification this project practises is *"forced on `main`
after the merge"*. Keeping it would halve the saving and leave the branch checked out, so
`git branch -d` would still refuse — half of what the ticket is about.

*A `--keep-worktrees` flag, or a `harness.yaml` policy key.* Declined for now. The escape hatch
already exists and is better aimed: a run that did not finish keeps everything, which is when
inspection is wanted. A key fixes nothing until someone edits a file, so every existing backlog
would keep the defect unless configured — Q-0080's precedent. Both stay available as later
refinements over working behaviour.

**Why.** A worktree is scaffolding, and scaffolding that outlives the work is the *"state outliving
the run that created it"* pattern M1's closing entry named. Measured on 2026-08-31, one closed chore
ticket left two directories and 277 MB, 250 MB of it `node_modules`, and the only thing that had
ever cleaned one in this repository was a person remembering to. The branch is not scaffolding: it
is the evidence, it is what a post-hoc review reads, and it is what makes the removal reversible.
Removing the directory while keeping the ref is the only split that gives back the disk without
giving up the record.

This ticket is **prospective**: it removes nothing already on disk. The successor — `harness
worktrees`, to list, prune stale registrations, and remove what is contained — lands with or after
Q-0010 and is written out in full in Q-0062's merged requirement.
