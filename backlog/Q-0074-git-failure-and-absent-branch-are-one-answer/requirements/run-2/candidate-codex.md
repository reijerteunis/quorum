# Q-0074 — A failed git probe is read as a proven negative

## Problem

Quorum currently uses identical `safe()` helpers in `packages/core/src/git/git.ts` and `packages/core/src/fanout/fanout.ts`. These helpers convert every thrown git error to `null`. At callers that ask a yes-or-no question, `null` is then interpreted as a proven negative even though git may not have answered.

This ambiguity can make the CLI:

- treat a branch whose state could not be read as absent;
- omit repository or push-lag information after a failed repository probe;
- skip rollback when either the start-of-run or rollback-time branch-head read fails, silently leaving changes merged by an integrate step;
- report a failed discard as successful;
- omit the first character of one modified path; and
- replace git’s content-conflict explanation with “git reported no reason.”

The same reasoning error exists beyond these named callers: a search that finds no evidence is not evidence of absence when the search itself may have failed. The implementation therefore needs a current census of both `safe()` helpers’ call sites. Each site must deliberately classify failure as either meaningful uncertainty, an operation failure, or an intentionally ignored best-effort failure.

This ticket touches the CLI and `packages/core`. It does not change the Studio, adapter contract, flow files, ticket file format, or any public installation path.

## User story

As a **maintainer**, I want Quorum to distinguish “git answered no” from “git could not answer,” so that a run stops with an actionable error instead of silently skipping rollback or presenting an uncertain repository state as fact.

As a **cold-clone adopter**, I want git failures reported in plain language with the affected repository, ref, and required recovery action, so that I can recover without understanding Quorum’s internals.

## Acceptance criteria

1. Before implementation is accepted, a new append-only decision entry is added to `docs/decisions/` and indexed in `docs/DECISIONS.md`. It states that absence may be reported only when the underlying operation produced evidence of absence; a failed or incomplete probe is represented separately and must not be inferred as a negative. It also states, in one sentence, that this applies to the reasoning used around a probe and not only to a particular `catch` block. The entry names the accepted caller responses: stop with actionable work, continue with an explicit uncertainty, or intentionally ignore a best-effort cleanup failure.

2. The solution report contains a census generated from the implementation commit, not copied from this ticket, covering every call site of both `safe()` declarations in `packages/core/src/git/git.ts` and `packages/core/src/fanout/fanout.ts`. Each row identifies the caller, the operation being attempted, the meaning currently assigned to failure, and one of these dispositions: distinguish failure, propagate operation failure, or retain best-effort suppression with a reason. The implementation and tests match every row. No acceptance criterion depends on the historical totals of 23 or 24 call sites.

3. On the CLI surface, branch-existence and branch-head probes distinguish all three outcomes: git proved the ref is present, git proved the ref is absent, or git could not answer. The third outcome is not exposed to any caller as the same value used for absence. Tests cover an absent ref and a failing git invocation as separate cases, and rewrite rather than delete the preserved-defect test currently associated with branch probing.

4. If the start-of-run branch-head probe cannot answer, the run stops before executing any step or changing the ticket’s in-memory stage or iteration counters. The diagnostic identifies the repository and branch, says that the starting head could not be determined, includes the available git failure detail, and does not say or imply that the branch is absent.

5. For every status for which `restoresBranch` requires rollback, rollback is attempted only when the start head is known. If the rollback-time branch-head probe cannot answer, Quorum records the run as failed, does not report rollback as completed or unnecessary, and emits an actionable diagnostic identifying the repository and branch and stating that the integration branch may require manual inspection or restoration. Tests independently cover failure of the start-of-run read and failure of the rollback-time read, including both truthiness guards currently represented in `lifecycle.ts`.

6. Repository detection distinguishes a repository that git proves is absent from a probe that fails because the project root’s `.git` gitfile is malformed or unreadable. In the latter two cases, `repositoryAt`/`workTreeProbe` produces the failed-probe outcome used by the CLI; it does not produce `outside`. CLI tests verify that these failures are visible and are not rendered as the silence reserved for a successful negative answer. The implementation does not parse translated git prose or reimplement git’s upward repository-discovery walk.

7. The JSDoc for repository detection accurately describes the returned outcomes and no longer claims that the implementation preserves a discrimination that it discards. Any new or changed exported result type or field has JSDoc describing how callers must handle a failed probe without restating the decision entry.

8. When `commitAll` cannot complete its checkout or clean operation, it propagates an operation failure with the available git detail. It does not invoke the discard-success callback and does not emit wording that says the changes were discarded. The existing preserved-defect test for a failed revert is rewritten to assert this behavior.

9. `commitAll` reports every modified path without removing or altering its first character, including when the first entry is modified but unstaged. A regression test asserts the complete ordered path values, including `backlog/T-0001/ticket.md` and `backlog/T-0001/sneaked.md`, and replaces the corresponding preserved-defect assertion.

10. When `mergeInto` encounters a content conflict, its failure includes the useful reason emitted by git whether git wrote that reason to stdout, stderr, or both. `mergeFailure` does not use “git reported no reason” when either stream contains non-whitespace diagnostic text. A regression test creates a content conflict and replaces the preserved-defect assertion for the empty error.

11. The four preserved-defect tests in `packages/core/src/fanout/fanout.test.ts` for branch-probe failure, failed discard, the truncated first path, and empty conflict detail are rewritten in place as positive regression tests. Their `Why: preserved defect` lines are removed. None of the four cases is covered solely by deleting, skipping, renaming away, or weakening its existing test.

12. A dry run does not mutate the in-memory ticket’s stage, history, or iteration counters. Run counters used during a dry run do not alias `ticket.iterations` or any nested mutable value. Tests retain references to the original ticket and iteration objects and verify that they remain deeply unchanged after both a successful and a failed dry run.

13. Tests for probe failures use repositories and failure conditions created by the test itself. Their verdict does not depend on the enclosing checkout, the operator’s git configuration, translated git text, filesystem permissions unsupported by the test environment, or an existing ignored directory. Where an unreadable-file fixture cannot be made deterministic on the current platform, the lower-level git invocation is injected or stubbed to return the same structured failure instead of treating the platform as the oracle.

14. The implementation introduces no new dependency and passes `pnpm lint`, `pnpm typecheck`, and, after `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`. The mock-adapter end-to-end regression suite remains green.

15. Cross-cutting checks are recorded in the solution report: BYOS is unchanged and no subscription-login refusal path is weakened; flows still write only to worktrees under `.harness/worktrees/`; gate behavior is unchanged; no persistent file format or schema changes; the cross-vendor rule is unchanged; the implementation remains product-agnostic; and the cold-clone path gains no command, dependency, or setup step.

## Non-goals

- Replacing every use of `safe()` with one universal tri-state return type. The required outcome is deliberate behavior per caller, not a prescribed shared type.
- Treating every failed best-effort cleanup as fatal. Call sites such as branch deletion or merge abort may continue suppressing failure when the census records why no user-facing claim depends on their success.
- Detecting a refused repository located above the supplied project root by parsing git’s translated prose or reproducing git’s upward discovery algorithm.
- Changing repository membership into a general filesystem-existence question. Any narrow inspection needed to distinguish a malformed or unreadable `.git` gitfile must be justified by the decision entry and must not replace git as the authority on repository membership.
- Changing flow YAML, the adapter contract, event or trace formats, gate behavior, the ticket frontmatter schema, or Studio behavior.
- Adding retry orchestration, automatic repair of corrupt repositories, automatic conflict resolution, or an automatic rollback fallback when the relevant branch head is unknown.
- Restoring or modifying the deleted `spike/` tree, the retired port freeze, or any freeze-exemption mechanism.
- Revisiting Q-0105’s definition of push lag or claiming that Q-0105 failed its original acceptance criteria.
- Fixing unrelated instances where an operator or document search inferred absence from an incomplete search.
- Adding an API-key path, remote service, plugin, registry installation claim, or new dependency.

## Open questions

1. **Blocking — decision owner: maintainer.** Should the accepted decision permit a narrow filesystem inspection of the project root’s `.git` entry solely to distinguish malformed or unreadable gitfiles after git fails, or must the implementation obtain that distinction through an injected/structured git operation alone? This must be resolved in the new decision entry before solutioning because it determines the repository-probe design and its relationship to *“Membership is a git question, not a filesystem one”* (2026-08-28).

2. **Non-blocking — implementation owner: engineer.** What concrete TypeScript shape best represents the required outcomes at each probe: a named union, `boolean | null`, a result object, or separate functions? The choice must preserve exhaustive caller handling and satisfy the behavior above; this requirement does not mandate one shared representation.

3. **Non-blocking — implementation owner: engineer.** Should the census live only in the solution report or also be enforced by a focused structural test that prevents a new ambiguous `safe()` probe call? Prefer the test only if it checks a semantic boundary without freezing incidental call counts or source layout.

## Risks

- A broad mechanical replacement of `safe()` could turn intentionally ignored cleanup failures into new fatal paths and make failed runs harder to recover from. The per-site census is the control.
- A partial type widening could repair the start-of-run truthiness guard while leaving the rollback-time guard ambiguous. Separate regression tests are required for both reads.
- Filesystem-based repository detection could contradict the existing authority assigned to git or behave differently across platforms, worktrees, bare repositories, and gitfiles. The blocking decision and self-contained fixtures must settle that boundary.
- Diagnostics assembled from only stderr may remain empty for content conflicts; diagnostics assembled carelessly from both streams may duplicate output or expose irrelevant command noise.
- Dry-run aliasing may survive if tests compare only serialized output after the run. The tests must retain and inspect the original object references.
- A static call-site count will rot as new code lands. The census must be regenerated from the implementation commit and explain dispositions rather than enshrine a number.
