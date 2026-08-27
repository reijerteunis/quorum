---
id: Q-0048
title: core/fanout — tasks, waves, worktrees and branches
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0048/integration
priority: p2
created: 2026-08-25
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-27T07:50:55.406Z
    cost: 7.612
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-27T08:35:19.674Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-27T08:59:10.538Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-27T09:19:02.445Z
    cost: 29.409
---
Ports `spike/src/fanout.js` (139 lines) to `packages/core`: `loadTasks`, `waves`, `scopeToFailing`,
`taskVars`, `taskPromptSection`, `branchExists`, `branchHead`, `resetBranchTo`, `commitAll`,
`mergeInto`, `runCommand`, `ticketWorktree` and `IntegrationError`. It is the plumbing under the
fan-out; the *step types* that drive it are Q-0053. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**Branch layout is decided and load-bearing.** Per ticket the integration branch is
`harness/<id>/integration`, with contracts, tests and each task on sibling branches
(`harness/<id>/contracts`, `…/tests`, `…/<task.id>`), and worktrees under `.harness/worktrees/`,
git-excluded. The reason is mechanical: git refs are files in directories, so `harness/<id>` cannot
exist alongside `harness/<id>/x`. Found by the smoke test on 2026-08-21, and a port that
"simplifies" the naming breaks every ticket folder in `backlog/`.

**Task granularity is a product decision, and this module encodes it.** *"Tasks are small; the
fan-out is the unit of parallelism, not of scope"* (2026-08-23) is why `waves` exists and why
`depends_on: []` across a whole `tasks.yaml` is the good case. `scopeToFailing` is the shipped
`scope: failing-tasks-only` retry that M1 credits with making the two-vendor fan-out work — Q-0033's
five small tasks reached green in three iterations with finished tasks reporting "no changes"
instead of inventing work.

**`taskPromptSection` forwards only `description`.** The 2026-08-23 ownership decision leans on
that: the architect states file ownership in each task's `description` because it is the only field
the fan-out actually forwards. If the port widens what a task sends, the ownership rule needs
restating rather than silently improving.

**`runCommand`'s timeout is not decoration.** A hung test command is one of the four recorded
instances of *"a loop spending its budget on work no agent in it can perform"*, and the remedy in
every case was to stop and name the work a human must do rather than retry. The 15-minute default
and the `commands.timeout_ms` override both carry.

**Not in scope.** `finish()` does not roll back task branches, so a failed run leaves work the next
run syncs into. That is an open item carried from M1 into M2 and not yet ticketed; the port must not
close it by accident, because doing so changes behaviour the engine's tests describe.

**One hazard inherited from Q-0042, which its requirement must carry as a criterion — to
preserve, not to fix.** Q-0042's implement report (finding 4) hands it forward by name:
`ensureWorktree` has no equivalent of `containment`'s branch-name guard. It interpolates whatever it
is handed into `refs/heads/${branch}` and passes it to `worktree add -b <branch>`; argv prevents
*shell* injection but not *option* injection, since git parses an argument beginning with `-` as a
flag. It is latent rather than live, because every caller composes the name as
`harness/<ticket-id>/<leaf>` and the prefix means the argument never starts with a dash. It reaches
this ticket because `taskVars` is what lifts an agent-authored `task.id` out of `tasks.yaml` into
the variable namespace the branch name is built from — the interpolation itself is
`spike/src/engine.js:211`, which is Q-0053's. **A criterion must say the port adds no branch-name or
task-id validation and preserves the hazard, reporting it.** Charter §2 makes that binding in both
directions: an implementer may not fix it in passing, and a reviewer may not treat its absence as a
blocker. Its neighbour, Q-0042's finding 5 — a worktree directory deleted by hand wedges the branch,
because the decision is made from `fs.existsSync(dir)` alone — has the same shape in `resetBranchTo`
and is preserved on the same reasoning.

**One thing that changes and one that must not.** `resetBranchTo` derives its worktree directory
inline as `path.join(repo, '.harness', 'worktrees', branch.replace(/\//g, '__'))`. Q-0041 landed
that derivation in `packages/shared` as `REPO_WORKTREE_ROOT` and `worktreeDirName`, and Q-0042's
`ensureWorktree` already imports both, so reaching for them here is internal layout — which charter
§2 does not preserve — and duplicating the literal is what would be the defect. The *path it
produces* is externally observable and must survive byte for byte.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `fanout.js` — tasks, waves, worktrees, branches, `commitAll`
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0041, Q-0042 · **Depended on by:** Q-0053
- **Invariants inherited:** register rows 19 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
