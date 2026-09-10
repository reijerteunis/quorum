# Q-0074 — A failed git probe is read as a proven negative

## Problem

Quorum uses a duplicated `safe()` helper around git commands in `packages/core/src/git/git.ts` and `packages/core/src/fanout/fanout.ts`. The helper converts every thrown error to `null`, after which callers may interpret the result as a proven negative such as “the branch is absent” or “this is outside a repository.” Git declining to answer and git proving absence are therefore indistinguishable at several call sites.

The highest-risk case is rollback after a run that does not complete. Quorum reads the ticket branch head before execution and again before rollback. A failed git invocation at either read currently satisfies a truthiness guard that skips rollback without a warning, potentially leaving merges from an integrate step on the ticket branch. The same defect causes a malformed or unreadable `.git` at the project root to be reported as being outside a repository.

Three related defects exist in the same fan-out code: a failed `backlog/` revert is reported as a successful discard and then committed, the first modified path in that report loses its first character, and a merge conflict can carry an empty error because git wrote its explanation to stdout.

A dry run also mutates the caller-supplied ticket in memory and aliases its `iterations` object even though persistent writers are disabled. This becomes observable when a process retains the ticket across runs.

Surfaces touched: the core git, fan-out, and run-lifecycle behavior in `packages/core`; CLI-visible errors propagated from core; core tests; and the append-only decision record. No backlog, harness, run-history, event, flow, or adapter file format changes.

## User story

As a **solo maintainer**, I want Quorum to distinguish a negative answer from a git probe that could not answer, so that a failed run never silently leaves integrate-step changes on the ticket branch and every intervention I must perform is named explicitly.

As a **cold-clone adopter**, I want repository and branch failures to produce truthful errors, so that I do not mistake a broken repository or git installation for ordinary absence.

As an **adapter contributor**, I want each swallowed git failure to have an explicit, tested reason, so that adding unrelated core behavior does not reintroduce a proven-negative inference.

## Acceptance criteria

1. **Decision and terminology.** Before the behavior change lands, a new append-only decision entry and its `docs/DECISIONS.md` index line define the rule that a failed observation is not evidence of absence. The entry applies the rule to both duplicated `safe()` helpers, cites the existing three-valued git precedents, distinguishes proof probes from best-effort cleanup and optional metadata, and includes one sentence stating that the rule is a reasoning discipline rather than a rule limited to one `catch` block. It also records whether checking for `.git` at the exact project root is consistent with *“Membership is a git question, not a filesystem one”* (2026-08-28), without editing the landed entry.

2. **Fresh census.** The implementation re-derives every `safe()` call site in `packages/core/src/git/git.ts` and `packages/core/src/fanout/fanout.ts` from the revision being changed. Each site is classified as one of: a proof whose negative result must remain distinct from failure; best-effort cleanup whose failure is intentionally ignored; or optional information for which absence and failure have the same caller-visible meaning. The implementation evidence lists the symbol and rationale for every site rather than relying on the ticket’s historical count. `configuredUser` is explicitly classified; retaining its current `null` result for both no configured name and an unavailable answer is permitted because its caller renders both as `unknown` under *“A ticket’s owner is supplied, never guessed”* (2026-09-08).

3. **Durable enforcement of the census.** Tests or an equally durable source-level guard fail when a new use of either duplicated `safe()` helper is added without an explicit classification. The guard does not require every call site to adopt a tri-state return and does not fail merely because an intentionally best-effort or optional-information call still ignores an error.

4. **Branch existence.** `branchExists` returns `true` only when git proves the named local branch exists and `false` only when git returns its documented absent-ref result. An unavailable binary, killed process, timeout, repository failure, or any other unexpected git failure produces a non-empty core error naming that the branch-existence probe failed. Existing callers must not render that error as “branch does not exist” or skip work on that basis.

5. **Branch head.** `branchHead` distinguishes all three outcomes: the resolved commit, a proven absent ref, and a failed probe. The public type makes it impossible for callers to interpret a failed probe as absence without an explicit branch. Existing successful and absent-ref behavior remains supported. A failed probe produces a non-empty core error naming the ref whose head could not be read.

6. **Start-of-run rollback evidence.** If the ticket branch head cannot be read before step execution, the run stops before invoking an adapter, script, fan-out step, or integrate step. It names the failed branch-head probe, releases any run lock it acquired, writes no ticket stage or counter change, and does not emit a successful terminal outcome.

7. **Rollback at both reads.** For every status that requires branch restoration, lifecycle handling covers the start and current branch-head outcomes independently:
   - if the start head was a commit and the current head is a different commit, the ticket branch is restored to the start commit;
   - if the start head was a commit and git proves the branch is now absent, the branch is restored to the start commit;
   - if the start head was proven absent, no rollback is attempted solely because it remains absent;
   - if the current-head probe fails, Quorum does not report that rollback was completed or silently skipped. It emits or throws a non-empty core error naming that rollback state could not be established and leaves the ticket branch for human inspection.

   Tests exercise failures at both the initial read and the rollback-time read. The preserved-defect comment in `engine.ts`, the preserved-defect comment in `lifecycle.ts`, and tests that endorse either truthiness guard are removed or rewritten.

8. **Repository detection.** `workTreeProbe` reports `outside` only when git establishes that no work tree or repository exists at the project root. A malformed gitfile, a `.git` path that cannot be read, or an equivalent failure while a repository exists at that exact root reports `failed`. The already-accepted limitation for a project directory below a refused repository remains unchanged. Tests use deterministic fixtures or injected command failures; their verdict must not depend on the executing account’s permissions, git identity, checkout location, or git-build-specific ownership hooks. The contradictory `repositoryAt` JSDoc is rewritten to describe the behavior the code actually preserves.

9. **Safe backlog discard.** When `commitAll` finds changes under `backlog/`, it calls `onDiscard` only after all required tracked edits and untracked additions have actually been removed. If status inspection, checkout, or cleaning fails, `commitAll` throws a non-empty error, does not call `onDiscard`, does not stage or commit the affected backlog content, and leaves the worktree available for inspection. A partial cleanup is not reported as a successful discard.

10. **Discarded path integrity.** `commitAll` reports every discarded path exactly as git reports the path after removing the two status columns and separator. A modified-but-unstaged first entry retains its first character. Tests cover a modified tracked file as the first entry and an added file after it, including the exact expected paths.

11. **Merge failure detail.** When `mergeInto` fails, its `error` contains a non-empty, normalized diagnostic selected from git’s stdout, stderr, or thrown message. A content conflict that writes its explanation only to stdout includes that explanation. The diagnostic remains bounded to the last 500 characters, conflict paths are collected before cleanup, and a successful abort still leaves the worktree clean. A failed best-effort abort is not misreported as a successful merge or clean worktree.

12. **Pinned regression tests.** The four preserved-defect tests currently covering failed branch probes, failed discard, the truncated first path, and the empty merge-conflict error are rewritten to assert the corrected behavior. They are not deleted or replaced only by source snapshots, and their `Why: preserved defect` lines are removed with the behavior they preserved.

13. **Dry-run object isolation.** A dry run may calculate and emit the stage, counters, history, and terminal outcome that a real run would produce, but it does so against a run-owned copy. When the dry run finishes, fails, is interrupted, or stops at a gate, the caller-supplied ticket object and its nested `meta.iterations` and `meta.history` values remain deeply equal to their pre-run values and retain their original object identities. No backlog writer, run-history writer, lock, worktree, branch mutation, or `.quorum/` file is created. Tests start with non-empty counters and history so clearing or replacing an empty object cannot pass accidentally.

14. **Regression suite and quality checks.** The change adds no dependency and no API-key path. After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. The mock-adapter end-to-end regression remains green. Tests assert behavior through git exit status or deterministic injected failures rather than matching version-dependent translated prose.

15. **Cross-cutting behavior.** BYOS and the adapter contract are unchanged; no flow writes to the user’s working tree; worktree placement and branch layout are unchanged; gate defaults and human-locked behavior are unchanged; no persistent file or schema changes; the cross-vendor rule and flow lint are unchanged; the product remains product-agnostic; and the cold-clone path gains no command, configuration, or required reading. Any discovered need to change one of these statements is a scope change and must return to a gate.

## Non-goals

- Replacing every nullable git helper in `packages/core` with one universal result type.
- Treating every ignored cleanup failure as fatal; best-effort cleanup may remain best-effort when the census records why no caller decision depends on it.
- Changing `configuredUser` or its `unknown` fallback.
- Detecting a refused repository above the supplied project root by parsing translated git prose or reimplementing git’s upward repository-discovery walk.
- Changing containment, push-lag, ancestry, empty-range, or board rendering semantics except where the census finds the same failed-probe conflation and the accepted decision requires repair.
- Changing flow YAML, ticket frontmatter, run-history, event, adapter, or gate schemas.
- Adding Studio behavior, remote execution, cloud state, multi-user behavior, a plugin marketplace, or another adapter.
- Restoring or modifying the deleted `spike/` tree, its former freeze guard, or a freeze-exemption trailer.
- Deleting branch refs or automatically repairing unrelated stale worktree registrations.
- Changing git diagnostics into CLI-specific remediation text inside core.

## Open questions

1. **Owner: product manager; blocker before implementation.** When rollback-time git fails and Quorum cannot establish whether restoration is required, should the run persist a distinct terminal status, or should the existing run fail by throwing after emitting a warning? This requirement fixes the invariant—no silent skip and no claim that rollback completed—but the externally visible terminal shape must be chosen before code changes because adding a status changes the shared event contract. Default if no event-contract change is approved: preserve the existing status set, throw a non-empty core error, and leave the branch and worktree for inspection.

2. **Owner: architect; blocker only if the decision entry rejects an exact-root filesystem check.** What deterministic mechanism distinguishes an absent `.git` from a malformed or unreadable `.git` at the exact project root while continuing to treat repository membership as git’s answer? The observable outcomes in AC-8 are fixed; the mechanism must be recorded in the decision entry and must not rely on translated prose or environment-dependent permissions.

3. **Owner: engineer; non-blocking.** What is the smallest durable form for the census guard: a registered list of classified sites, removal of the generic helpers in favor of purpose-named wrappers, or another source-level assertion? Any choice is acceptable if it satisfies AC-3 and does not turn implementation line numbers into the contract.

## Risks

- A broad mechanical replacement of `safe()` could make intentional best-effort cleanup fatal and expand the ticket beyond its defect class.
- A nullable return widened without updating both lifecycle guards could repair the start-of-run path while leaving rollback-time contamination possible.
- Throwing during finalization can leave the run’s persisted status and emitted terminal event inconsistent unless ordering is tested explicitly.
- Recreating an absent ticket branch during rollback must use the recorded start commit without deleting neighbouring step branches or touching the user’s working tree.
- Filesystem-based repository detection can contradict the existing membership decision if its exact scope is not recorded before implementation.
- Tests based on permissions, ownership, translated git text, or checkout placement can pass locally and fail in CI for reasons unrelated to the commit.
- A one-time census in an implementation report will rot as new call sites are added; without durable enforcement, the same defect can return immediately.
- Copying the complete caller ticket for a dry run may expose code that currently depends on object identity. Tests must distinguish run-owned state from caller-owned state while preserving the dry run’s simulated terminal result.
