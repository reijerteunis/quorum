# Q-0073 — Make the input guard independent of checkout state

## Problem

The core test guard in `packages/core/src/turbo-inputs.test.ts` decides whether to collect a path-shaped literal by checking whether that path currently exists in the checkout. Identical source files can therefore produce different test verdicts depending on whether a flow has previously created `.harness/worktrees` or `.quorum/runs`.

This makes a clean integrate worktree or clone structurally less capable of detecting some failures than a maintainer's used checkout. A green result cannot be trusted as evidence that the same source would pass elsewhere.

The measured cause is the existence filter in `pathLiterals`, not only the later directory classification. At the measured baseline, 307 distinct literals pass the syntactic filters, 270 are excluded because they do not exist, and only three differ between on-disk and git-tracked state. A change must address collection without accidentally treating import specifiers, diagnostic text, shell fragments, arguments, or prose as audited input paths.

This ticket touches the repository test suite in the CLI/core codebase. It does not change runtime CLI behavior, the Studio, `harness/` file formats, or `backlog/` file formats.

## User story

As a **maintainer**, I want the input guard to return the same verdict for identical tracked source regardless of artifacts left by earlier flows, so that a green result from a clean integrate worktree is valid for a used developer checkout as well.

As a **contributor**, I want every exception in the input guard's named-but-never-read register to be exercised by the guard, so that obsolete entries cannot silently make the guard appear broader than it is.

## Acceptance criteria

1. **Checkout-independent collection.** In the core test surface, the set of path literals collected from identical tracked source is unchanged when `.harness/worktrees` and `.quorum/runs` are alternately absent, present as empty directories, and present as plain files. The test must perform these state changes in an isolated temporary repository or equivalent isolated fixture and must not alter the user's working tree.

2. **Checkout-independent verdict.** A regression test runs the relevant guard logic against identical source in both of these states: (a) a clean-checkout state in which `.harness/worktrees` and `.quorum/runs` are absent, and (b) a used-checkout state in which both paths exist. The two runs must produce the same pass/fail verdict and the same reported audited occurrences.

3. **Known product paths remain covered.** The regression fixture includes all six measured occurrences of `.harness/worktrees` and `.quorum/runs` across `packages/shared/src/constants.ts`, `packages/shared/src/constants.test.ts`, `packages/core/src/fanout.source.test.ts`, and `packages/core/src/git.source.test.ts`. None may be included or excluded solely because its corresponding path exists on disk.

4. **Existing non-path strings remain excluded.** The guard continues to exclude path-shaped text that is outside its current claim, including at least one fixture for each measured category: an import specifier, diagnostic or lint text, a shell fragment, an argument containing an absolute temporary path, and prose. Tests must demonstrate that the chosen collection rule does not promote these fixtures merely because they contain `/`.

5. **Existing audited paths retain coverage.** Every literal collected by the guard at the measured baseline because it names a tracked repository file or directory remains collected after the change, unless an independently justified correction is documented in the ticket's solution. The forced core suite must detect any unintended reduction.

6. **Register entries must be reachable.** The core test surface contains an independently testable assertion that every entry in `NOT_READ` matches at least one literal collected by the guard. A stale or unreachable entry fails with a message naming that entry.

7. **Installed-tool exception is resolved explicitly.** `node_modules/.bin/turbo` must not remain as an unreachable `NOT_READ` entry. The implementation must either keep it deterministically collectable without consulting checkout existence, or remove it from `NOT_READ` and cover its intended treatment with a focused test. The solution document records which outcome was chosen and why.

8. **No filesystem-existence decision.** Production test-helper logic used to collect or classify literals must not call `existsSync`, `statSync`, or an equivalent working-filesystem probe to decide whether a source literal is in the guard's subject set. Filesystem operations used only to construct and clean up isolated regression fixtures are permitted.

9. **Worktree execution.** The guard passes when run from a normal checkout and from a git worktree. If the implementation uses git metadata, a focused test covers worktree metadata layout rather than assuming `.git` is a directory.

10. **Failure remains actionable.** When the guard finds an unregistered named-but-never-read path, its failure identifies the source file and literal. When the literal can be deterministically identified as a directory, the message may retain the directory-specific explanation; correctness must not depend on that message variant.

11. **Forced verification.** `npm test --prefix spike` and `pnpm turbo run test --force` pass with no cached package test results. The Q-0073 regression test must be part of the forced package test run and must not depend on directories produced by a prior flow.

12. **Decision record threshold.** If the implementation preserves the guard's existing claim and only makes subject collection deterministic, no `docs/DECISIONS.md` entry is required. If it changes which semantic roles the guard audits—for example, by auditing literals based on data flow rather than repository membership—the change includes an append-only decision entry with Decision, Alternatives considered, and Why.

13. **BYOS.** No runtime code, test, fixture, documentation, or example added by this ticket introduces a subscription-secret input path or weakens the existing environment-variable refusal behavior.

14. **Safety by construction.** Tests that create checkout states use temporary directories or disposable worktrees. They do not create, replace, or delete `.harness/worktrees`, `.quorum/runs`, or any other artifact in the user's working tree.

15. **Other product invariants.** The change adds no persistent state, changes no gate behavior, changes no flow or ticket schema, changes no adapter or cross-vendor rule, introduces no product-specific knowledge, and adds no step to the cold-clone path.

## Non-goals

- Redesigning all clauses in `turbo-inputs.test.ts` around semantic data-flow or role analysis.
- Automatically registering every exported path constant from `packages/shared/src/constants.ts`.
- Fixing only the two known product-path entries while leaving collection dependent on checkout existence.
- Creating `.harness/worktrees` or `.quorum/runs` before every guard run as the permanent fix.
- Auditing all 307 syntactically path-shaped literals as filesystem inputs.
- Changing what `NOT_READ` means: it remains the register for paths intentionally named but never opened by audited code.
- Changing runtime worktree placement, run-history placement, flow behavior, integrate behavior, or gate policy.
- Changing CI configuration or claiming that CI observed the original defect; the fresh-clone result is the measured proxy.
- Changing any adapter contract, public API, command output, persistent file format, or schema.
- Adding a dependency unless the solution demonstrates that existing Node.js and git capabilities cannot implement the selected rule.
- Work on multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, another adapter, or a desktop shell.

## Open questions

1. **Which deterministic source of repository membership should the implementation use?** Owner: implementing engineer. Blocker: yes, before coding; no product-manager decision is required. The default is git-tracked membership because the census shows it changes only three literals and preserves the current guard's narrow scope. The solution must confirm that the selected command or library works in both clones and worktrees and must define behavior for command failure rather than silently returning an empty subject set.

2. **How should `node_modules/.bin/turbo` be represented after checkout-dependent collection is removed?** Owner: implementing engineer. Blocker: yes, before finalizing tests. The permitted outcomes are those in AC-7; an unreachable register entry is not permitted.

3. **Does deterministic collection alter the guard's claim or only its implementation?** Owner: implementing engineer, reviewed at the gate. Blocker: only for documentation scope. If the audited semantic roles change, AC-12 requires a decision entry; otherwise no entry is needed.

## Risks

- Using `git ls-files` without explicit error handling could turn a git failure into an empty subject set and reproduce the same false-green class.
- Treating every slash-containing literal as a path would expand the guard to hundreds of imports, messages, fixtures, shell fragments, arguments, and prose, creating noisy failures unrelated to input auditing.
- Treating only tracked paths as subjects can make installed-tool exceptions unreachable; the dead-entry assertion is required to expose that contraction.
- Tests that manipulate the actual repository paths could delete or replace developer data. Isolation is therefore an acceptance criterion, not a test implementation preference.
- A fixture that tests only the final verdict could pass because both environments skip the same subjects. The regression must compare collected occurrences as well as pass/fail status.
- Platform-dependent path or git behavior could make the guard deterministic on one operating system but not another; fixtures should avoid platform-specific separators and must exercise git worktree metadata.
