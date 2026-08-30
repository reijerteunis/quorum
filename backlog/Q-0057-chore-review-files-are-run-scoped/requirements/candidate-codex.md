# Q-0057 — Preserve chore reviews by run

## Problem

The chore flow writes review artifacts using an iteration number that restarts at `1` for every run. A later run can therefore overwrite an earlier run’s reviews. If an earlier run produced more iterations than the later run, the remaining files form a mixture of reviews from different runs.

The chore flow also supplies every matching review file to a revision round. An implement step can consequently receive findings about different code revisions without being told which run produced each file.

This affects the `harness/` flow definition, the core engine’s interpolation variables, and review artifacts stored in `backlog/`. The CLI remains the user-facing surface. The Studio is not in scope.

This change must land after the Q-0009 port and its cutover are complete. It must change `packages/core` and the chore flow together. It must not modify `spike/src/`, which remains the port’s independent witness until cutover.

## User story

As a **solo maintainer**, I want every chore review to be preserved under the run that produced it and a revision round to receive only reviews from its current run, so that rerunning a ticket neither destroys earlier reasoning nor supplies stale findings as if they described the current change.

## Acceptance criteria

1. **Core engine — run interpolation variable.** At the start of every flow run, the core engine exposes the allocated numeric run number as the interpolation variable `{run}`. Its value equals the run number reported by the CLI and recorded for that run; it remains unchanged for the full run, including every backward-edge traversal.

2. **Harness flow — run-specific write path.** The chore review step writes its artifact to `review/chore/run-{run}/chore-iter-{iter}.md`. For example, iteration 1 of run 3 writes `review/chore/run-3/chore-iter-1.md`.

3. **Harness flow — iteration behavior.** Within one run, the first chore review uses iteration `1`. Each intra-flow backward edge from `review` to `implement` increments the iteration once, so later reviews in that run use `2`, `3`, and so on. Starting another run resets its iteration to `1` without reusing the preceding run’s directory.

4. **Backlog persistence — no overwrite between runs.** If the same ticket completes at least one chore review in two different runs, both runs’ review files remain present under their respective run directories. The second run does not modify or delete any review file written by the first run.

5. **Backlog persistence — provenance from the path.** Every newly written chore review is attributable to its run without consulting file modification times or interpreting its prose: the numeric directory component following `review/chore/run-` is the run number that wrote it.

6. **Harness flow — current-run revision inputs.** The chore implement step’s review input matches only `review/chore/run-{run}/chore-iter-*.md`. On its first execution in a run, it receives no chore review from an earlier run. After a backward edge, it receives the reviews already produced in the current run and no reviews from another run.

7. **Harness flow — prior decisions remain available.** The implement step continues to receive `requirements/merged.md` and `requirements/errata.md`. Earlier-run reviews are not supplied as an implicit substitute for recording an accepted requirement correction in `requirements/errata.md`.

8. **Legacy artifacts.** Existing flat files matching `review/chore-iter-*.md` are neither moved, rewritten, nor deleted. The updated chore flow does not include them in an implement step’s inputs. A ticket containing only legacy chore reviews can start a new run successfully and writes new reviews using the run-specific layout.

9. **Existing review flow.** The behavior and artifact layout of `review.yaml`, including `{round}` and `review/round-N/verdict.md`, remain unchanged. `reviewRound` retains its existing contract and is not generalized to count chore artifacts.

10. **Sequencing and atomicity.** The core support for `{run}` and the updated chore flow land in the same change after the Q-0009 port cutover. No released repository state may contain a chore flow that references `{run}` while the active core engine leaves that placeholder unresolved.

11. **Port constraint.** This ticket does not modify or delete any file under `spike/src/` and does not change the port-freeze policy. The fix is implemented against the post-cutover core engine.

12. **Regression coverage — interpolation.** An automated core test proves that `{run}` resolves to the allocated run number and remains stable when an intra-flow backward edge changes `{iter}`.

13. **Regression coverage — consecutive runs.** An automated test executes or faithfully exercises two chore runs for one ticket and proves all of the following independently:
    1. both runs begin with `chore-iter-1.md` in different run directories;
    2. a retry in the first run produces its next iteration in the first run’s directory;
    3. the second run leaves every first-run review byte-for-byte unchanged; and
    4. the second run’s implement input contains no first-run or legacy review file.

14. **Regression coverage — existing behavior.** Existing tests for `reviewRound`, the review flow, backward-edge exhaustion, human gates, run history, and mock-adapter end-to-end behavior remain green.

15. **Required verification.** After installing dependencies as prescribed by `harness/rules.md`, `npm test --prefix spike`, `pnpm turbo run test --force`, and `pnpm lint` pass. The spike suite is an unchanged compatibility witness; passing it does not authorize changes under `spike/src/`.

16. **Files are the database.** Chore-review provenance and contents are stored only in the ticket’s `backlog/` folder. The change introduces no hidden daemon state, registry, or second persisted counter.

17. **Worktree safety.** The change does not alter where code-writing steps execute, where worktrees are created, or which branch receives integration. A flow still never writes code changes into the user’s working tree.

18. **Gate behavior.** The chore flow’s human gate, retry limit, exhaustion behavior, and `auto` behavior remain unchanged.

19. **Cross-vendor rule.** The chore flow remains `cross_vendor: required`; the adapters assigned to `implement` and `review` are unchanged by this ticket, and the flow continues to pass whole-directory lint.

20. **BYOS and product scope.** The change adds no subscription-authentication path, product-specific behavior, dependency, configuration prompt, or setup step. It does not lengthen the documented cold-clone path.

21. **Explicit errors.** Failure to create or write the run-specific review artifact stops the run through the existing explicit artifact-write error path. The engine must not fall back to the legacy flat path or silently omit the review.

## Non-goals

- Migrating, renaming, deleting, or reconstructing legacy `review/chore-iter-*.md` files.
- Feeding all historical chore reviews into every later run.
- Changing the artifact layout or numbering contract of `review.yaml`.
- Generalizing or replacing `reviewRound`.
- Introducing a ticket-scoped chore counter separate from the run number and iteration number.
- Adding review provenance fields to the review document body; the run-specific path is the required provenance for this ticket.
- Changing chore retry limits, backward-edge routing, gate policy, adapter selection, roles, prompts, or verdict rules except for the implement step’s review input path.
- Modifying `spike/src/`, weakening the port freeze, or delivering a temporary spike-only fix before cutover.
- Adding Studio presentation, run-history UI, migration commands, or cleanup commands.
- Changing the general glob or interpolation language beyond exposing `{run}` through the existing variable mechanism.
- Addressing concurrent runs of the same ticket; that is separate from preventing sequential runs from reusing artifact paths.
- Any v1-excluded capability, including multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual canvas, eval suites, another adapter, or a desktop shell.

## Open questions

1. **Should legacy flat chore reviews receive a dedicated read-only presentation in future CLI or Studio run history?** Owner: product manager. Blocking: no. This ticket preserves the files but excludes them from new implement inputs.

2. **Should review document schemas eventually carry run identity inside the document as well as in its path?** Owner: product manager with core maintainer. Blocking: no. This ticket requires path-level provenance only; any content-schema change requires a separate ticket.

## Risks

- **Delayed protection.** Landing after port cutover leaves remaining pre-cutover chore runs exposed to the existing defect. Changing the frozen spike to reduce that short window would compromise the port’s independent witness, so this requirement accepts the sequencing risk explicitly.

- **Human discoverability.** Review files move one directory level deeper for new runs. Maintainers who browse ticket folders manually must look under `review/chore/run-N/`; legacy files remain at the old location.

- **Unresolved placeholder if changes are split.** Updating the flow before `{run}` exists in the active core could create a literal `{run}` directory and reintroduce collisions. AC-10 requires the two surfaces to land together.

- **Assumed ordering of run allocation.** The design relies on the existing run number being allocated before flow variables are constructed. A future lifecycle change must preserve that ordering or update the interpolation contract and its tests.

- **Historical context is no longer injected automatically.** A new run will not see unresolved findings left only in an earlier review. Accepted corrections must be recorded in `requirements/errata.md`; otherwise that context remains available on disk but not in the implement prompt.
