# Q-0062 — Remove worktrees after successful runs

## Problem

The CLI creates worktrees under `.harness/worktrees/` but never removes them. The removal primitive exists in both `spike/src/git.js` and `packages/core/src/git/git.ts`, with core tests covering its behaviour, but it has no callers.

The reproducible measurement is that one closed ticket, Q-0058, left two worktrees using 277 MB, including two 125 MB copies of `node_modules`. Its `implement` and `integration` branches also remained because Git will not delete a branch while it is checked out in a worktree. Earlier counts of four worktrees and a large branch list were subsequently changed by manual cleanup and are not evidence for an accumulation rate.

Automatic cleanup must distinguish successful runs from unsuccessful runs. A failed run's worktree is evidence a maintainer may need to inspect. A successful run may remove a run-owned branch only after Git proves that branch is contained in the ticket branch; otherwise cleanup could destroy work that has no surviving ref.

The spike remains the implementation that runs flows in this repository. A core-only change would leave the defect active until the unplanned cutover tracked under Q-0010. This ticket therefore changes both the CLI's current spike implementation and the corresponding core implementation.

Surface: CLI run lifecycle. This ticket also changes internal Git lifecycle behaviour and tests in `spike/` and `packages/core/`. It does not add a CLI command or change a persisted file format.

## User story

As a **solo maintainer**, I want worktrees and contained run-owned branches removed after a successful flow run, so completed work does not consume disk space or leave branches checked out, while unsuccessful runs remain available for diagnosis.

## Acceptance criteria

1. **Successful terminal states trigger cleanup in both implementations.** When a non-dry run reaches terminal status `completed` or `regressed`, the spike and core run lifecycles attempt cleanup before emitting or returning that terminal outcome. Equivalent automated tests cover both statuses.

2. **The run records every worktree it touches.** In both implementations, each successful call that obtains a worktree for an agent step, fan-out child, integrate step, or ticket-branch operation registers the resolved branch in run-scoped, in-memory state. Registration includes an existing worktree reused by the run as well as one newly created by the run. A branch is registered at most once for cleanup purposes.

3. **The ticket branch worktree is removed but its branch is retained.** On successful cleanup, if the registered branch equals `ticket.meta.branch`, its worktree is removed through the existing `removeWorktree` primitive with branch deletion disabled. The ticket branch ref remains resolvable at the same commit after cleanup.

4. **Contained run-owned branches are removed.** For every other registered branch under `harness/<ticket-id>/`, cleanup uses the repository's existing ancestry/containment result to determine whether the branch is contained in `ticket.meta.branch`. When and only when the result is `contained`, cleanup removes the worktree and requests deletion of that branch through the existing `removeWorktree` primitive. A real-repository test proves that the worktree directory and branch ref are both absent afterward.

5. **Uncontained or indeterminate branches are preserved.** If a registered non-ticket branch is `not-contained` or containment is `indeterminate`, cleanup neither removes its worktree nor deletes its branch. The CLI emits a warning naming the branch and the containment state; for an indeterminate result it also includes the available Git failure detail. Tests cover both states without relying on the identity or configuration of the host repository.

6. **Cleanup is restricted to this ticket's namespace.** Automatic branch deletion applies only to registered branches whose names begin with `harness/<ticket-id>/`. A registered branch outside that namespace is left untouched and produces a warning. Cleanup does not enumerate or prune unrelated worktrees or refs.

7. **Unsuccessful runs retain diagnostic state.** Terminal statuses `failed`, `aborted`, and `interrupted` do not remove registered worktrees and do not reset or delete their task or step branches. Existing ticket-branch rollback remains in effect for these statuses. Tests prove that the ticket branch is restored as today while a task branch and its worktree remain inspectable.

8. **Task-branch lifecycle is settled as one policy.** Task and step branches are not rolled back independently. They are deleted only after a `completed` or `regressed` run and only when containment in the ticket branch is proven. On every other terminal state, or when containment is not proven, both branch and worktree are retained. No half-cleaned state may leave a branch deleted while its worktree directory remains, or remove a non-contained worktree while its branch is the only ref to its work.

9. **Cleanup failures are explicit without rewriting the run result.** If removing an eligible worktree throws, the CLI emits a warning naming the branch and the Git failure, continues cleanup for the remaining registered branches, and preserves the already-determined `completed` or `regressed` outcome. It must not emit a second terminal outcome or reclassify the run as failed. The failed cleanup target remains available for manual inspection.

10. **Dry runs perform no cleanup.** A dry run does not remove a worktree, delete a branch, or perform a containment-dependent mutation, regardless of its terminal status. Tests cover a dry completed run.

11. **Cleanup is idempotent.** Repeating successful cleanup for the same registered branches does not fail and does not alter unrelated refs or worktrees. This criterion may rely on the existing idempotence contract of `removeWorktree`; the primitive is not reimplemented.

12. **The active spike receives the behaviour.** `spike/src` gains the lifecycle call sites and run-scoped registration required by criteria 1–11. A spike regression test runs a successful flow against a repository it creates, then proves the applicable worktrees and contained run-owned branches are absent. A corresponding unsuccessful-run test proves diagnostic state remains.

13. **Core receives matching behaviour.** `packages/core` gains the equivalent lifecycle call sites and run-scoped registration required by criteria 1–11. Core tests use repositories created by the tests and Git itself as the behavioural witness; their verdict must not depend on this repository's branches, ignored directories, Git identity, or machine-level Git configuration.

14. **The fan-out source pin is deliberately revised.** `packages/core/src/fanout/fanout.source.test.ts` no longer forbids `removeWorktree` or branch deletion merely because Q-0062 was open. Its replacement asserts the policy in this requirement: cleanup is reached through the authorised lifecycle, deletion is namespace-bounded and containment-gated, and fan-out code does not independently prune repositories. The restrictions on ad hoc `for-each-ref` enumeration remain unless the implementation can demonstrate that a listed restriction is required solely to permit the authorised call site.

15. **The Q-0050 task-branch pin is deliberately revised.** `packages/core/src/engine/q0050.source.test.ts` AC-9d no longer imposes the blanket `/(?:reset|delete|remove)TaskBranch/i` prohibition. Its replacement permits Q-0062's successful-run cleanup while continuing to fail if an unsuccessful run resets or deletes task branches. The test derives its engine source inventory from `production` as it does today.

16. **The stale four-worktree comment is corrected.** The comment in `packages/core/src/fanout/fanout.test.ts` no longer claims that four worktrees from completed tickets remain on disk. It states only the durable rule that suite-created worktrees live in test-owned temporary repositories and are removed with those repositories. No test verdict depends on the historical Q-0042/Q-0043 worktree count.

17. **No new Git removal primitive is introduced.** Production cleanup calls the existing `removeWorktree(repoDir, branch, { deleteBranch })` implementation in each tree. This ticket may add lifecycle orchestration and containment checks, but it does not add a second worktree-removal implementation or change the public signature of the existing primitive.

18. **Existing safety boundaries remain green.** No flow writes to the user's working tree. Worktrees remain under `.harness/worktrees/`; `.quorum/` remains run-history storage only. Cleanup does not modify files in the user's working tree.

19. **Regression suites cover the change.** After installing dependencies as required by `harness/rules.md`, `npm test --prefix spike` and `pnpm turbo run test --force` pass. Every new behaviour above has an automated test in the implementation tree where that behaviour exists.

20. **Cross-cutting checklist.** BYOS: not applicable; no subscription or environment-variable handling changes. Worktree safety: covered by criteria 3–8 and 18. Gate behaviour: unchanged. Files-as-database and schemas: no persisted file or schema changes. Cross-vendor rule: unchanged. Product-agnostic behaviour: no product-specific names or rules are added. Lint rules: TypeScript remains strict, with no `any`, unjustified `@ts-ignore`, or deprecated API introduced; spike remains outside ESLint's configured scope. Cold-clone impact: no new setup step or user action is introduced, and successful runs use less retained disk space.

## Non-goals

- Adding `harness worktrees --prune`, `quorum worktrees --prune`, or any other manual pruning command; that belongs to Q-0010.
- Enumerating and deleting worktrees or branches left by earlier runs.
- Deleting unrelated worktrees or branches outside `harness/<ticket-id>/`.
- Removing worktrees after `failed`, `aborted`, or `interrupted` runs.
- Rolling back task or step branches on unsuccessful runs.
- Deleting a branch whose containment is `not-contained` or `indeterminate`.
- Changing the existing `removeWorktree` signature or replacing its established unit tests.
- Changing flow YAML, ticket frontmatter, run-history formats, the adapter contract, gate behaviour, or Studio behaviour.
- Implementing the core cutover or otherwise expanding Q-0010.
- Proving historical accumulation from the non-reproducible 2026-08-26 worktree or branch counts.
- Cleaning `node_modules` separately from removal of its containing worktree.

## Open questions

None. The lifecycle decision for this ticket is explicit: clean registered, provably contained run state after `completed` and `regressed` outcomes; retain diagnostic state after every unsuccessful outcome. Historical pruning remains owned by Q-0010.

## Risks

- A flow may use a custom branch outside the ticket namespace. The namespace guard preserves it, which can leave disk use behind but avoids deleting a branch the run does not clearly own.
- Containment can be indeterminate in a shallow repository or when Git fails. Preserving both branch and worktree is intentionally conservative and may require later manual pruning.
- Removing a worktree with `--force` discards uncommitted files in that worktree. The containment check protects committed history, but tests must confirm successful step completion has committed the expected work before cleanup runs.
- Cleanup spans concurrent fan-out children. Run-scoped registration must be safe under concurrent additions and must not allow one child's cleanup bookkeeping to overwrite another's.
- The spike and core implementations can drift before cutover. Matching behavioural tests in both trees are required because fixing only one leaves either current execution or the future implementation incorrect.
- Cleanup occurs on the terminal path. Incorrect ordering could emit a completed outcome before cleanup has been attempted or could emit two terminal outcomes when cleanup fails; criteria 1 and 9 make those regressions observable.
