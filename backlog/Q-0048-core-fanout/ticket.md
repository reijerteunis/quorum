---
id: Q-0048
title: core/fanout — tasks, waves, worktrees and branches
stage: draft
owner: ruud
repos: []
branch: harness/Q-0048/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
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
