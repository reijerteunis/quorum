# Q-0103 — The cutover: delete the spike, retire its CI job and its charter

## Problem

Quorum now runs all eight CLI commands through `packages/cli`, with their logic in `packages/core`. The old `spike/` implementation nevertheless remains in the repository, has its own regression suite and CI job, and is still named by the harness commands, documentation, lint configuration, and port-freeze machinery.

This leaves two apparent implementations and two required suites after only one is authoritative. It also keeps controls whose subject disappears at cutover.

The cutover cannot safely be made as one ordinary chore flow run. A run retains the `commands.install` and `commands.test` values read at its start. If that run both deletes `spike/` and changes those commands, its `integrate` step still executes the old install command against the deleted directory and fails for an environmental reason.

Surfaces touched: CLI repository documentation, `harness/`, CI, workspace test and lint configuration, and deletion of obsolete source and tests. No CLI or Studio behaviour changes.

## User story

As a **maintainer**, I want the obsolete spike and every repository control that exists only for it removed, so there is one implementation, one regression suite, and one truthful set of install and test commands.

As a **cold-clone adopter**, I want the README and repository instructions to direct me to the supported workspace-local Quorum CLI, so I do not follow an obsolete spike command or an unsupported public-registry installation path.

As an **adapter contributor**, I want the workspace suite to be the only regression suite named by the repository, so I have one authoritative test result when changing an adapter.

## Acceptance criteria

1. Before implementation begins, the requirements gate records one execution route from OQ-1. If the split route is selected, the command-only change is assigned its own ticket and is contained in `main` before Q-0103 starts its deletion run. Q-0103 must not start as a single ordinary chore flow run while its run-start commands still name `spike/`.

2. The prerequisite command-only change, if selected, changes `harness/harness.yaml` as follows while retaining the complete `spike/` tree:
   - `commands.install` runs only `pnpm install --frozen-lockfile`.
   - `commands.test` runs only `pnpm turbo run test --force --continue`.
   - Comments that say two dependency sets or two suites are required are removed or rewritten to describe the workspace suite.
   - `commands.timeout_ms` and the reasons for `--force` and `--continue` remain unchanged.

3. The prerequisite command-only change is verified by a real chore flow `integrate` step. Its retained occurrence or report shows that the old run-start commands completed while `spike/` still existed. The gate record explicitly acknowledges that this integrate occurrence did not exercise the spike suite after the command edit; it is accepted only as the prerequisite to Q-0103.

4. Q-0103 deletes the entire tracked `spike/` tree, including `spike/src/**`, `spike/bin/**`, `spike/test/**`, its npm manifest, and its npm lockfile. After the change, `git ls-files spike` returns no paths.

5. Q-0103 deletes `packages/core/src/spike-parity.test.ts` in the same change that deletes `spike/test/**`. No replacement parity test or inventory relating the workspace suite to the deleted suite is introduced.

6. Q-0103 deletes `harness/port-charter.md`. No replacement freeze SHA, mirror procedure, preserve-behaviour charter, or port register is introduced.

7. `.github/workflows/ci.yml` contains exactly these three CI jobs after the cutover:
   1. `workspace`
   2. `git-identity-sweep-bare`
   3. `git-identity-sweep-populated`

   The `spike`, `port-freeze-policy`, `port-freeze-branch-scope`, and `port-freeze-sha` jobs and their job-specific comments are absent. The commands, cache policy, forced execution, checkout premises, and hostile-environment checks of the three retained jobs do not change.

8. Before deleting the port-freeze scripts, a repository-wide tracked-file search records every caller of `.github/scripts/port-freeze-guard.sh` and `.github/scripts/port-freeze-guard.test.mjs`. If the search finds no surviving caller or product contract after the workflow jobs and charter are removed, both files are deleted. If another caller or contract is found, implementation stops and reports the dependency at the gate instead of editing that dependent behaviour in passing.

9. `eslint.config.js` no longer ignores `spike/**`, and comments that describe the spike as an unlinted Q-0009 implementation are removed. The configured TypeScript file scope and lint rules remain unchanged.

10. `vitest.shared.js` retains Vitest's default discovery guarantee and the existing `dist/**` exclusion. Its explanation no longer cites `spike/test/run.js` or a second suite; it instead describes the guarantee directly or cites the workspace test that enforces it. No test include pattern is narrowed.

11. Canonical harness documentation is updated so it no longer instructs contributors to install or run spike dependencies or tests and no longer says `spike/**` remains outside ESLint. This includes all obsolete spike statements in `harness/rules.md`, not only the ESLint paragraph. Any required synchronization of derived vendor dialects is performed by a human commit under *“`.claude/rules/` is a derived copy, not a surface a requirement may name”* (2026-08-27); no flow step is assigned a derived file as an editable surface.

12. `README.md` directs a cold-clone adopter only to supported commands based on `packages/cli`, including the workspace-local path where applicable. It does not claim registry-resolved `npx quorum` works and contains no runnable `node spike/bin/harness.js` command or statement that the spike is the runnable implementation.

13. `docs/04-architecture.md` and `docs/06-development-plan.md` are updated in place, with their status lines updated, so present-tense architecture and M2 completion text describe one workspace regression suite and the completed cutover. Historical accounts remain historical and are not rewritten merely because they mention the spike.

14. No existing file under `docs/decisions/` is edited, and no existing decision-index entry is rewritten. A new decision is required only if the requirements gate chooses a route that reverses or materially changes an existing decision; the deletion itself does not require one.

15. No implementation source under `packages/core/src` or `packages/cli/src` changes. The deletion of `packages/core/src/spike-parity.test.ts` is the only permitted change under those two source trees. If deleting the spike makes a package source change necessary, implementation stops and reports the remaining dependency at the gate.

16. A tracked-file search after the deletion finds no live instruction, command, CI definition, test, configuration entry, or script that depends on a path under `spike/`, `harness/port-charter.md`, or the port-freeze scripts. Historical decision entries and clearly past-tense historical records are excluded from this criterion.

17. The final Q-0103 `integrate` step runs in a fresh integration worktree using the new `commands.install` and `commands.test` values. Its retained evidence shows both commands were actually executed and exited successfully. Reading the YAML or running the commands only in the maintainer's working tree is not sufficient.

18. After integration, CI runs the three retained jobs against the resulting commit and all three pass. No deleted job appears as passed, failed, or skipped because it must no longer exist in the workflow.

19. The workspace verification remains green with no cache-served verdict: `pnpm lint`, `pnpm typecheck`, and `pnpm turbo run test --force` all pass. The mock-adapter end-to-end coverage already owned by the workspace suite remains green through the CLI binary.

20. The final diff does not close or modify the behaviour of Q-0059, Q-0060, Q-0066, Q-0068, Q-0100, or Q-0102. Their becoming single-tree defects is not evidence that any one of them is resolved.

21. Cross-cutting checks are recorded in the completion evidence:
   - **BYOS:** no subscription-login behaviour, environment refusal, test, or example changes; no API-key path is added.
   - **Worktree safety:** no flow write location or integration-branch behaviour changes.
   - **Gate behaviour:** no gate default, `auto`, human-locked gate, or exhaustion behaviour changes.
   - **Files and schemas:** no persistent file format or schema changes.
   - **Cross-vendor rule:** no flow or adapter assignment changes.
   - **Product-agnostic:** no product-specific dependency or example is added.
   - **Cold-clone impact:** obsolete spike setup is removed; both supported installation paths remain truthful; registry-resolved `npx quorum` remains unclaimed.

## Non-goals

- Changing behaviour in `packages/core` or `packages/cli`.
- Adding, repairing, or reorganizing product behaviour discovered to depend on the spike.
- Replacing the deleted parity test with another comparison against archived spike files.
- Preserving the spike as an archive, fixture, git submodule, tarball, or downloadable artifact.
- Retaining a second regression suite after cutover.
- Changing the retained CI jobs beyond removing references made obsolete by the deleted jobs.
- Changing flow definitions, adapter assignments, the cross-vendor rule, gates, worktree containment, or run-history formats.
- Editing landed decision entries to remove historical spike references.
- Registry-resolved `npx quorum`; all packages remain private and Q-0029 owns that M6 work.
- Fixing Q-0102's flaky oracle.
- Fixing or closing Q-0059, Q-0060, Q-0066, Q-0068, or Q-0100.
- Adding a new dependency.
- Any v1 exclusion-list item, including multi-user operation, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

1. **Blocking — execution route. Owner: maintainer at the requirements gate.** Which route will be used?
   - **Recommended:** allocate a prerequisite chore ticket containing only the `harness/harness.yaml` command and comment changes, contain it in `main`, then run Q-0103 as the deletion ticket.
   - Run both stages manually under *“Do not drive harness-machinery work through the harness”* (2026-08-23), with an explicitly recorded independent review.
   - Accept a deliberately failed integrate occurrence and complete the work out of band. This is not recommended because the failed occurrence is not evidence for the resulting commit.

   The selected route must identify where review and final integrate evidence come from. This question blocks implementation because it changes the safe ordering and ticket boundary.

2. **Blocking — port-freeze scope. Owner: maintainer at the requirements gate.** Should the three port-freeze jobs, charter, guard script, and guard test be removed in Q-0103 or assigned to an immediate successor? **Recommended: remove them in Q-0103.** Once `spike/src` and the charter are absent, these controls have no valid subject and cannot remain as truthful CI checks. Acceptance criteria 6–8 assume the recommendation is accepted and must be revised at the gate if it is not.

3. **Non-blocking measurement — remaining guard readers. Owner: implementer.** Does a tracked-file search find any caller or contract for either port-freeze script outside the jobs and charter being deleted? The expected answer is no. A different result becomes a gate finding; it is not permission to widen the ticket.

4. **Blocking if the command-only split is selected — prerequisite ticket identity. Owner: maintainer.** What ticket ID and integration branch will own the command-only prerequisite? The ID must be allocated through the backlog rather than invented inside Q-0103.

## Risks

- **Self-invalidating integrate command:** deleting `spike/` before the new harness commands are the run-start configuration causes integration to fail for a missing directory. Mitigation: settle and enforce AC-1 before implementation.
- **False-green command verification:** reading `harness.yaml` or relying on a local checkout would not prove that an integrate worktree can install and test. Mitigation: AC-17 requires retained evidence from a real integrate occurrence.
- **Unreviewed gap between the two changes:** the prerequisite integrate occurrence uses its run-start commands, while the edited commands are first exercised by Q-0103. Mitigation: keep the interval short, retain `spike/` until the prerequisite is contained, and require Q-0103's final integrate to execute the new commands.
- **Deleting a still-used guard:** the guard test was historically easy to leave unexecuted. Mitigation: inventory all tracked callers before deletion and stop on an unexpected dependency.
- **Documentation drift:** present-tense instructions may survive in canonical harness or numbered docs while historical decision references are intentionally retained. Mitigation: distinguish live instructions from historical records in AC-16 and update canonical sources.
- **Derived-file drift:** canonical harness edits require human synchronization until the compiler exists. Mitigation: make the human sync part of the same contained change without assigning the derived surface to an agent step.
- **Hidden spike dependency:** removal may reveal package source that still depends on the spike. Mitigation: treat any required package-source edit as evidence that the cutover premise is false and return to the gate.
- **Scope expansion through old defects:** one remaining implementation makes existing defects easier to address but does not resolve them. Mitigation: AC-20 preserves their ticket ownership.
