# Q-0036 — What `green` means, and where the code is

*Stage: draft · Iteration: 1 · Route: chore flow · Milestone: M2*

## Problem

As a maintainer, I cannot tell from `harness board` whether a ticket at `green` has reached the configured base branch. The board currently presents work that passed its configured suite on an integration branch in the same way as work contained in `main`.

This allowed completed work for Q-0006 and Q-0011 to remain outside the base branch without being visible on the board. The discrepancy was found only by investigating a missing directory.

The stage value cannot answer the containment question. A stage records the ticket's position in the SDLC state machine; containment is a current fact about two git refs. Persisting that fact in `ticket.md` would allow it to drift whenever refs move.

This ticket changes the CLI `harness board` surface and the documentation. It introduces the board's first git-derived value. It does not change a flow, stage transition, adapter, ticket file format, or Studio surface.

## User story

**`maintainer`** — As a solo maintainer, I want `harness board` to distinguish a ticket branch that is contained in the configured base branch from one that remains ahead of it, so I do not mistake tested work for shipped work.

**`adopter`** — As a cold-clone adopter, I want the board to state when the local clone lacks enough git information to determine containment, so incomplete history or a missing ref is never presented as a definite result.

**`contributor`** — As an adapter or flow contributor, I want the documented meaning of `green` to be limited to integration and its configured suite, so I do not use the stage as evidence that code is on the base branch.

## Acceptance criteria

1. **Eligible tickets — CLI.** On every invocation, `harness board` evaluates containment for tickets whose stage is one of `green`, `reviewed`, `qa-passed`, or `deployed`. Tickets at `draft`, `requirements`, `solutioned`, or `red` retain their current rendering and cause no containment git calls. `blocked` and `abandoned` are not treated as “later than green,” because they can be entered from any stage.

2. **Configured base branch — CLI.** The comparison uses `repo.base_branch` from `harness/harness.yaml`; it does not assume `main`. The rendered containment value names the configured base branch so that, for example, a repository configured with `base_branch: master` does not display or query `main`.

3. **Contained state — CLI.** When both refs resolve to commits and git proves the ticket branch tip is an ancestor of the configured base branch, the ticket row reports `contained in <base>`. This result is allowed in a shallow clone only when git positively proves the ancestry relationship.

4. **Not-contained state — CLI.** When both refs resolve to commits, the repository is not shallow, and git proves the ticket branch tip is not an ancestor of the configured base branch, the ticket row reports `not contained in <base> (+N)`, where `N` is the decimal count produced by `git rev-list --count <base>..<ticket-branch>`. `N` counts commits reachable from the ticket branch and not reachable from the base branch; it is not a file count or a symmetric divergence count.

5. **Indeterminate state — CLI.** An eligible ticket reports `containment indeterminate (<reason>)` when any required fact cannot be established. The reason identifies at least one of: `missing branch ref <ref>`, `missing base ref <ref>`, `shallow history`, or `git error`. A missing or non-commit ref is never reported as contained or not contained. In a shallow repository, any result other than positively proven containment is reported as indeterminate; a non-zero ancestry check is not sufficient evidence for “not contained.”

6. **Missing branch metadata — CLI.** If an eligible ticket has no non-empty `branch` value, its row reports `containment indeterminate (missing branch value)`. The command continues rendering the remaining tickets and exits according to criterion 8. No fallback branch name is invented.

7. **Derived value only — CLI and backlog files.** Containment is recomputed from the current refs during every `harness board` invocation. Running the command creates or changes no file. No containment, landing, ahead-count, or last-checked field is added to `ticket.md`, another backlog artifact, or `.quorum/`.

8. **Failure isolation and exit behavior — CLI.** A missing ticket ref, missing base ref, shallow history, or failed containment query affects only the relevant rendered containment result. The board continues rendering all readable tickets and exits 0. Existing failures to load or parse required project or ticket files retain their current behavior; this ticket does not suppress them. Raw git stderr is not printed.

9. **Repositories without ticket branches — CLI.** `harness board` exits 0 and renders its normal board in a repository with no `harness/*` refs. Every eligible ticket whose configured branch is absent receives the indeterminate state; earlier-stage tickets remain unchanged.

10. **Automated state coverage — tests.** Automated CLI tests create isolated temporary git repositories and cover, at minimum: a contained ticket branch; a complete repository with a branch two commits ahead of the base, rendering `(+2)`; a missing ticket ref; a missing base ref; and a shallow repository in which containment cannot be proved. Tests assert the rendered state, the configured base name, exit code 0, and absence of raw git errors.

11. **Automated scope coverage — tests.** Tests prove that containment is evaluated for exactly `green`, `reviewed`, `qa-passed`, and `deployed`, and is not displayed for `draft`, `requirements`, `solutioned`, `red`, `blocked`, or `abandoned`. A behavior change in the spike carries a test in the mock-adapter regression suite, which remains green.

12. **Meaning of `green` — documentation.** `docs/02-sdlc-pipeline-spec.md` §3.4 and the **Stage** entry in `docs/GLOSSARY.md` state that `green` means the ticket integration branch integrated and passed its configured suite. They also state that a stage does not imply that the branch is contained in the configured base branch and identify the containment value on `harness board` as the source for that fact. No stage is added or reinterpreted.

13. **Containment vocabulary — documentation.** Before the containment terminology is repeated in a second documentation file, `docs/GLOSSARY.md` defines **Containment** as the git-derived relationship between a ticket branch tip and the configured base branch. The definition distinguishes `contained`, `not contained`, and `indeterminate`. No synonym such as “landed,” “merged,” or “shipped” is used as a substitute for a proven ancestry fact.

14. **Decision record — documentation.** An append-only entry in `docs/DECISIONS.md`, dated when implemented, records the decision to derive containment from git on each board invocation. Its alternatives include a `landed:` frontmatter field and a stage after `deployed`; it explains that a persisted field can drift and that containment is independent of the SDLC state machine.

15. **Development plan — documentation.** The M2 ticket list in `docs/06-development-plan.md` includes Q-0034, Q-0035, and Q-0036, with Q-0036 described as the board containment and `green` vocabulary work. The closed M1 record, including its historical ticket statuses, is not rewritten.

16. **Cross-cutting constraints — repository.** The change adds no dependency; introduces no subscription, adapter, gate, flow, lint-rule, or schema behavior; performs no write from a flow to the user's working tree; adds no persistent state; names no product-specific SaaS behavior; and requires no extra command or setup in the cold-clone path. If implementation requires a new dependency or any exception to these statements, the requirement must return to product review before implementation continues.

## Non-goals

- Determining whether a branch was historically merged, rebased, cherry-picked, or re-derived. Containment reports current ancestry only.
- Proving that equivalent file content exists on the base branch when the ticket branch tip is not its ancestor.
- Adding a `landed`, `contained`, `ahead`, or last-checked field to ticket frontmatter.
- Adding, removing, renaming, or automatically advancing a stage.
- Changing the meaning of `reviewed`, `qa-passed`, or `deployed`.
- Merging, rebasing, deleting, fetching, pruning, or otherwise modifying refs.
- Automatically fetching missing history or refs from a remote.
- Adding a `--base` option; the configured base remains `repo.base_branch`.
- Adding a merge queue, `land` command, or flow that writes to the base branch.
- Changing Q-0034 or Q-0035 behavior, or reconciling Q-0006 and Q-0011.
- Changing JSON output or adding a new board output format unless `harness board --json` already exists and currently promises parity with human-readable board fields.
- Studio backlog-board work; M3 owns the web surface.
- Adapter-contract, subscription-login, gate, worktree, or cross-vendor-rule changes.
- Improving general board performance beyond avoiding containment work for ineligible tickets.

## Open questions

None. The configured base branch, eligible stages, rendered states, shallow-clone behavior, persistence policy, and chore-flow routing are specified above.

## Risks

- **Shallow clones can produce false negatives.** A failed ancestry check does not prove non-containment when history is incomplete. The board therefore reports indeterminate unless containment is positively proven.
- **The board gains git work on its render path.** Large backlogs could make one or more git processes per eligible ticket noticeable. Implementation should avoid checks for ineligible tickets and may safely deduplicate comparisons for identical branch refs without caching results across invocations.
- **A missing configured base ref could create repetitive output.** Every eligible row must remain factually correct even if the same missing-base reason repeats. Consolidating that presentation is allowed only if each affected ticket remains unambiguously indeterminate.
- **Ahead counts are easy to define incorrectly.** A symmetric count or working-tree diff would answer a different question. Criterion 4 fixes the required range as `<base>..<ticket-branch>`.
- **Stage and containment may appear contradictory.** A `deployed` ticket can still be reported as not contained or indeterminate because stage and git ancestry are independent facts. Documentation must preserve that distinction rather than hiding the result.
- **Terminology can overclaim history.** “Merged,” “landed,” and “shipped” describe events or broader product states that ancestry alone cannot establish. The board and documentation use containment terminology for the derived fact.
