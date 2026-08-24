# Q-0034 — Reconcile the unmerged green branches (Q-0006, Q-0011)

## Problem

A solo maintainer can see Q-0006 and Q-0011 at stage `green`, but cannot tell that neither integration branch is included in `main`. As a result, tested work can appear complete while remaining unavailable to every fresh clone.

Q-0011 contains the run-history feature: engine output under `.quorum/runs/<id>/`, the `harness history` reader, and per-vendor usage roll-ups. Q-0006 contains changes to the engine and adapter registry. These branches must not be applied blindly because they predate later changes on `main`, including Q-0033's extraction of `spike/src/lint.js`.

The same investigation exposed an unreliable diagnostic. An empty review diff is currently explained as evidence that an integration branch was already merged when that causal conclusion may not follow from the available git state. Empty evidence must stop the run, but its message must report facts the engine can prove.

Surfaces touched: CLI, `backlog/`, `.quorum/`, `harness/`, and product documentation. The Studio is not implemented by this ticket.

## User story

As a **solo maintainer**, I want the tested work from Q-0006 and Q-0011 reconciled with the current base branch, reviewed, and included in `main`, so that a fresh clone contains the behavior represented by the tickets and I can distinguish a green integration branch from work included in the base branch.

As a **cold-clone adopter**, I want run history to be written and readable without additional setup, so that I can inspect completed runs and vendor-reported usage while retaining the existing subscription-only and worktree-safety guarantees.

As an **adapter contributor**, I want usage attribution to remain behind the adapter contract, so that run-history consumers do not need vendor-specific logic.

## Acceptance criteria

1. **Reconciliation record (`backlog/`)** — Before code is integrated, Q-0034 contains a committed reconciliation record for Q-0006 and Q-0011. For each branch it records the examined head commit, merge base with the configured base branch, unique commits, changed files, overlap with current base-branch changes, selected strategy (`merge`, `rebase`, or `re-derive`), and the reason for that selection. It maps every retained or deliberately omitted behavior to a source commit or existing base-branch implementation. An omission without a recorded reason fails this criterion.

2. **Q-0006 behavior (`CLI`, engine, adapters)** — The reconciled result retains every Q-0006 behavior still required by `backlog/Q-0006-review-flow-and-cross-flow-backward-edge/requirements/merged.md`, or identifies an equivalent implementation already on the base branch in the reconciliation record. All applicable Q-0006 automated tests pass against the reconciled result.

3. **Run files (`.quorum/`)** — Executing a run creates `.quorum/runs/<id>/` using the Q-0011 schema and lifecycle rules. Automated tests verify the expected files and required fields, isolation between two run IDs, and explicit failure when persisted structured output is invalid. No run state needed by the history reader exists only in process memory.

4. **History reader (`CLI`)** — `harness history` reads persisted run files and presents the run fields required by Q-0011, including run identity, ticket, flow, status, timing, and usage. Tests cover no run directory, one valid run, multiple runs in their specified order, and one malformed run. A malformed run produces a clear non-zero failure and identifies the affected path; it is not silently skipped or replaced with defaults.

5. **Vendor usage roll-up (`CLI`, adapter contract)** — Run history reports billed money only when an adapter reports billed money and reports token counts when billed money is unavailable. It neither estimates missing money nor labels a partial billed-money total as the complete cost. Tests exercise a money-reporting adapter, a token-only adapter, and a run containing both. Vendor-specific field interpretation remains inside adapters; the engine and history reader consume the shared usage shape.

6. **Current-base preservation (`harness/`, CLI)** — Reconciliation preserves all behavior currently on `main` unless a deliberate replacement is documented. In particular, `spike/src/lint.js` remains present, shipped lint behavior still passes its tests, and Q-0011 is not allowed to restore an older inline lint implementation or delete the extracted module merely because its branch predates Q-0033.

7. **Regression suite (`CLI`)** — The mock-adapter end-to-end suite, adapter probe tests, Q-0006 tests, Q-0011 tests, Q-0033 lint tests, and all other existing automated tests pass together on the reconciled integration branch. The green report records the exact commands and results. New behavior introduced by reconciliation has automated coverage.

8. **Review before inclusion (`backlog/`, harness)** — The complete reconciled diff against the configured base branch goes through the review flow before it is included in that base branch. The review input contains a non-empty diff, the verdict and any resulting changes are committed beside Q-0034, and a rejected verdict cannot advance the ticket. Review continues to satisfy the cross-vendor rule.

9. **Landing evidence (`backlog/`, git)** — Completion evidence records the reviewed integration commit and the base-branch commit that includes it. A test or scripted verification proves that the reviewed tree is represented in the configured base branch and that a fresh checkout of that base branch passes the regression suite. Q-0006 and Q-0011 may not be described as reconciled solely because their original integration branches remain green.

10. **Meaning of green (`CLI`, documentation)** — Documentation and the CLI board consistently define `green` as: the ticket's integration branch integrated successfully and passed its configured suite. They state that `green` does not prove inclusion in the configured base branch. The existing stage state machine is not silently reinterpreted.

11. **Base-branch inclusion on the board (`CLI`)** — Each CLI board ticket at stage `green` or later displays the configured base branch and one of three factual states for its declared integration branch: its tip is included in the base branch, its tip is not included, or the inclusion state cannot be determined because a required ref is missing. Tests cover all three cases. The value is derived from git on each invocation and is not stored as hidden state. A missing ref is not reported as included or not included.

12. **Empty-diff diagnostic (`CLI`, engine)** — Review still stops before invoking an adapter when its materialised diff is empty. Its error reports the range and relevant refs, distinguishes only git states the engine has verified, and does not claim a historical cause such as “merged hours earlier.” Tests cover at least: integration tip is an ancestor of the base branch, refs have different commits but identical trees, the configured range is wrong or empty, and a required ref is missing. No adapter is invoked in any of these cases.

13. **Canonical documentation (`docs/`)** — The change preserves the existing 2026-08-24 erratum in `docs/DECISIONS.md`; any further decision is added as a new append-only entry with **Decision**, **Alternatives considered**, and **Why**. `docs/GLOSSARY.md` defines any new repeated term before it is used elsewhere, and `docs/06-development-plan.md` identifies Q-0034 as M2 work without rewriting the historical M1 record.

14. **Cross-cutting safeguards (`CLI`, harness)** — The reconciled implementation introduces no API-key path or example; adapter checks retain their current refusal behavior for prohibited environment variables; flows write code only in `.quorum/worktrees/`; human and human-locked gate behavior is unchanged; persistent data remains file-backed; and no product-specific SaaS knowledge is introduced. The cold-clone path requires no new command before the first run, and no new runtime dependency is added unless its one-line justification and any required decision entry are committed.

## Non-goals

- Rewriting Q-0006 or Q-0011 requirements beyond changes required to reconcile them with the current base branch.
- Recovering every abandoned experiment or intermediate commit from either integration branch.
- Backfilling `.quorum/runs/` for historical runs that occurred before run-history persistence existed.
- Reconstructing a definitive historical explanation for why Q-0006 once produced an empty review diff when repository evidence cannot prove one.
- Changing the adapter contract beyond the shared usage fields already required by Q-0011.
- Estimating money for adapters that do not report billed money.
- Adding a new ticket stage solely to represent git inclusion.
- Building or changing the Studio backlog board or run-history UI.
- Adding multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.
- Changing gate defaults, bypassing review, or allowing a flow to write to the user's working tree.
- Deleting the original Q-0006 or Q-0011 branches after reconciliation.

## Open questions

1. **Blocker — reconciliation strategy per branch. Owner: solution architect.** Which of merge, rebase, or re-derive produces the smallest auditable change for each branch after comparing it with current `main`? This must be answered in the reconciliation record before implementation tasks are assigned.

2. **Blocker — overlap and ordering. Owner: solution architect.** Do the Q-0006 engine and adapter changes conflict with or duplicate Q-0011 or later changes on `main`, and in what order must retained changes be applied? The answer determines task boundaries and test sequencing.

3. **Blocker — authoritative base. Owner: maintainer.** Is `main` the configured base branch for the repository used to complete Q-0034, or must all inclusion and review checks use another value from `harness/harness.yaml`? Requirements must use the configured value; the completion evidence must name the resolved ref.

4. **Blocker — authority to update `main`. Owner: maintainer.** Does Q-0034 include the final human-controlled merge into `main`, or does it end with a reviewed integration branch awaiting a separate manual merge? Acceptance criterion 9 cannot be declared complete until the reviewed tree is present on the configured base branch.

5. **Non-blocker — original branch disposition. Owner: maintainer.** After reconciliation, should the original Q-0006 and Q-0011 branches remain indefinitely for audit, or be archived later? This ticket will not delete them.

6. **Non-blocker — historical ticket metadata. Owner: product manager.** Should Q-0006 and Q-0011 receive append-only history notes pointing to Q-0034's landing evidence, or is the Q-0034 reconciliation record sufficient? Existing history must not be rewritten either way.

## Risks

- A mechanical merge may delete or regress newer base-branch work, especially the extracted lint module.
- Re-deriving behavior may lose edge cases that were covered only by the original branch tests or contracts.
- The two old branches may contain overlapping engine and adapter changes whose application order changes behavior.
- Tests passing separately on each old branch may not pass when both features and current `main` are combined.
- Git ancestry alone may not prove how equivalent trees arose; diagnostics that turn ancestry into a historical narrative may remain misleading.
- Displaying base-branch inclusion may be wrong in shallow clones or clones missing refs unless the CLI reports an indeterminate state explicitly.
- Run-history files may expose inconsistent schemas if old Q-0011 contracts and newer engine history fields are combined without one validated format.
- Cost totals may be read as complete when token-only adapter activity is present unless partial totals are labelled at every output point.
- Adding reconciliation checks to the normal cold-clone path could lengthen first use if they require fetching branches or running extra setup; this ticket permits neither.
