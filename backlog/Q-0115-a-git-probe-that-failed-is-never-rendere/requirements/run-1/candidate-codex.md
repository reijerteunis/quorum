# Q-0115 — A git probe that failed is never rendered as an answer

## Problem

The `core` git module has five `safe()` call sites where a failed git operation is merged with a legitimate negative answer.

The adopter-visible failure is in containment. If the local-branch enumeration fails, `containment()` behaves as though it received an empty branch list. `quorum board` then labels every ticket `no branch`, although git was asked and could not answer. A failed base-ref probe is similarly rendered as `missing ref`.

The same conflation occurs below two other callers:

- `repositoryAt()` returns `false` both when `.git` is absent and when the operation intended to inspect a present `.git` cannot answer. `workTreeProbe()` can therefore report `outside`, causing the board to suppress repository information for a repository that is present but unreadable or malformed.
- `shortSha()` returns `null` both for an absent ref and for a failed git operation. The engine uses that value as its endpoint-existence test, so a failed probe is reported as a missing ref.

The fifth site is `ensureWorktree()`’s base-ref probe. It can cut a worktree from `HEAD` after a failed probe, but this ticket inherits the earlier scope decision to register that site without repairing it.

The governing decision already exists: *“A probe that could not answer is not a negative”* (2026-09-10). It permits a narrow filesystem inspection of the project root’s `.git` solely to distinguish absence from present-but-unreadable or present-but-unparseable. It does not permit filesystem inference of repository membership, ref existence, tracked status, or git’s upward discovery result.

Surfaces touched: `core` and the existing `quorum board` CLI output. No persistent file format changes.

## User story

As a **cold-clone adopter**, when `quorum board` cannot obtain a git fact, I want it to say that git failed instead of claiming that every ticket has no branch or suppressing the repository fact, so that I can distinguish a broken probe from missing work. *(CLI, `core`)*

As a **maintainer**, when the engine validates a diff endpoint, I want a failed git probe to stop with a git-failure diagnostic instead of a missing-ref diagnostic, so that I investigate the failed instrument rather than the ref. *(`core`)*

As a **contributor**, I want every `safe()` site classified in an executable register and the git module’s documentation to match its behaviour, so that a new collapsing site or a misleading contract cannot pass unnoticed. *(`core`)*

## Acceptance criteria

1. **The existing decision governs the change, without a second decision entry.** Source added or changed for this ticket cites *“A probe that could not answer is not a negative”* (2026-09-10) where an authority citation is required, and does not transcribe the decision’s reasoning. No new file is added under `docs/decisions/`, and `docs/DECISIONS.md` is unchanged.

2. **The 24-site census becomes an executable register rather than a recorded total.** A test derives every `safe()` call site under `packages/core/src` from source and requires each site to be keyed by identity with one of `distinguish`, `propagate`, or `best-effort`, plus a one-sentence reason. Adding an unclassified call, deleting a classified call, or changing a registered call’s identity fails the test. The test does not assert that the total is 24. Its mutations demonstrate separately that an added call and a deleted call both fail. The register covers both existing declarations of `safe()` and both `git.ts` and `fanout.ts`, even though this ticket changes behaviour only in `git.ts`.

3. **The two `safe()` declarations remain explicitly registered.** A source test identifies the declarations in `packages/core/src/git/git.ts` and `packages/core/src/fanout/fanout.ts`, with the reason each module retains its own declaration. A third declaration anywhere under `packages/*/src` fails. The register is keyed by source identity rather than a count, and the unrelated `safeId` identifier does not satisfy it.

4. **An absent `.git` remains different from a present `.git` that cannot be interpreted.** Through `repositoryAt()` and `workTreeProbe()`, an absent project-root `.git` may produce `outside`, while a present but malformed, unreadable, or unparseable `.git` produces `failed`. Consequently, `pushLag()` returns `null` only when absence was established and returns `{ state: 'indeterminate', reason: 'git failed' }` for the present-but-unanswerable cases. Tests cover absence and a deterministic malformed `.git` as distinct fixtures. Any unreadable-case fixture uses an injected or structured filesystem failure if permissions cannot be staged portably; its verdict must not depend on `chmod`, the enclosing checkout, the operator account, or translated git prose.

5. **A failed containment base probe is not `missing ref`.** When the configured base ref is proven absent, `containment().stateOf()` continues to return `{ state: 'indeterminate', reason: 'missing ref' }`. When the same `rev-parse --verify --quiet` probe cannot answer for another reason, it returns `{ state: 'indeterminate', reason: 'git failed' }`. Tests force each outcome independently and prove the results differ.

6. **A failed local-branch enumeration is not an empty branch list.** When `for-each-ref` succeeds, a ticket branch absent from its output continues to return `{ state: 'indeterminate', reason: 'no branch' }`. When `for-each-ref` fails, every valid string passed to that containment result returns `{ state: 'indeterminate', reason: 'git failed' }`; no ticket is classified as `no branch` from that failed enumeration. A CLI test with at least two backlog tickets proves `quorum board` renders `indeterminate(git failed)` for both and does not render `indeterminate(no branch)` for either. The existing suppression of a proven `no branch` in stages where a branch is not expected remains unchanged.

7. **Diff endpoint validation distinguishes an absent ref from a failed abbreviation probe at both call paths.** `shortSha()` exposes three outcomes to its callers: a git-provided abbreviation, a ref proven not to resolve, and a probe that could not answer. The preflight endpoint check and the step-time `materialiseDiff()` check handle all three explicitly. A proven absent ref retains the existing appropriate `missing ref` diagnostic. A failed probe stops with a `FlowError` naming that git could not determine whether the specific endpoint resolves; it does not contain `missing ref`, `does not resolve`, or any other assertion of absence. Tests force the failure separately at preflight and step time, and retain the existing successful-abbreviation and absent-ref cases.

8. **`repositoryAt()`’s JSDoc and its behaviour agree.** Its contract states the actual result distinctions after this change, including the bounded role of filesystem inspection. It does not claim that a discrimination is preserved if the return type or caller still discards it. A source guard identifies the current misleading sentence about discriminating refusal from absence as an existing subject, proves the old source satisfies that guard, and fails unless the repaired source removes or replaces it. Runtime tests from AC-4 remain the behavioural proof; the source guard alone is not accepted as evidence that the discrimination works.

9. **The fifth collapsing site is registered and deliberately left unchanged.** The executable census classifies `ensureWorktree()`’s base probe as a known collapse: when it cannot verify the declared base, current behaviour may still select `HEAD`. This ticket adds no new assertion endorsing that fallback and does not change `ensureWorktree()`’s branch selection, worktree location, or write behaviour. The other previously non-collapsing `safe()` sites retain their existing observable behaviour. Existing `containment`, `pushLag`, git source, engine diff, CLI board, mock-adapter end-to-end, lint, and typecheck suites remain green after dependencies are installed with `pnpm install --frozen-lockfile`; the forced workspace test command is `pnpm turbo run test --force --continue`.

## Non-goals

- Repairing `ensureWorktree()`’s base-ref fallback or deciding whether that case should throw, warn, or choose another revision.
- Changing any of the eight `fanout.ts` `safe()` sites. Those remain Q-0074’s scope.
- Unifying the two `safe()` declarations or introducing a shared generic result helper.
- Changing `mergeBase()`, `currentBranch()`, `configuredUser()`, `removeWorktree()`, `emptyRangeEvidence()`, or the already-discriminating `containment()` and `pushLag()` probe sites beyond changes mechanically required by the four repairs above.
- Reopening Q-0109’s case where the project root is below a repository that git refuses to open.
- Parsing git stderr or other translated prose to choose a state.
- Reimplementing git’s upward repository-discovery walk.
- Using filesystem inspection to decide repository membership, whether a ref exists, or whether a file is tracked.
- Adding retries, automatically repairing a repository, or inventing a fallback revision when a probe cannot answer.
- Adding a CLI command, flag, exit code, persistent field, schema member, reason string, dependency, adapter change, flow change, gate change, or public `@quorum/core` export solely for this work.
- Changing the closed containment or push-lag vocabulary. `git failed`, `missing ref`, and `no branch` already exist.
- Adding or changing an API-key path.

## Open questions

None. The former filesystem question was answered by *“A probe that could not answer is not a negative”* (2026-09-10): a project-root `.git` inspection is permitted only for absent versus present-but-unreadable or present-but-unparseable. Internal TypeScript representations remain an implementation choice provided all three outcomes are explicit and every caller is exhaustive.

## Risks

- **A widened result can leave one caller collapsing it.** `shortSha()` is called during both preflight and step-time materialisation. AC-7 requires independent failure tests for both paths.
- **Containment can preserve one collapse while repairing the other.** The base-ref probe and branch-list probe fail at different points and require separate fixtures under AC-5 and AC-6.
- **Filesystem tests can become machine-dependent.** Real permission denial varies by operating system, account, and privilege. AC-4 requires a deterministic malformed fixture and structured injection for an unreadable case that cannot be staged portably.
- **A source guard can have no subject or prove only wording.** AC-8 requires the old sentence to be demonstrably present and pairs the guard with runtime behaviour tests.
- **The census can rot while its count stays unchanged.** AC-2 keys entries by source identity and mutation-tests additions and deletions; it never treats 24 as the invariant.
- **Scope can leak into the unresolved worktree fallback.** AC-9 records that site but forbids changing its branch-selection behaviour.
- **The board’s first-30-minute path can regress.** Existing output for proven absent branches and repositories must stay unchanged; only failed probes gain the already-defined `git failed` rendering.

Cross-cutting checks: BYOS is unaffected; worktrees remain under `.harness/worktrees/` and no flow writes to the user’s working tree; gate behaviour and the cross-vendor rule are unchanged; no persistent file or schema changes; no flow-lint rule is added; the cold-clone path gains no command, dependency, prompt, or setup step; the change remains product-agnostic; and previously silent or false-negative git failures become explicit.
