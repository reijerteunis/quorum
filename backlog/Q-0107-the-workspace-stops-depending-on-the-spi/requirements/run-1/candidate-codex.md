# Q-0107 — The workspace stops depending on the spike

## Problem

The production workspace no longer needs `spike/`, but tests and configuration under `packages/**` still depend on it as an independent witness, fixture source, parity subject, import prohibition, or declared Turborepo input. Some of these dependencies fail loudly when the spike disappears; others would remain green while no longer checking a live property.

Deleting `spike/` before disposing of these dependencies would make it impossible to prove that re-aimed checks can fail against their former subject. Q-0107 therefore performs the judgement-bearing part of the cutover while the spike remains present.

This ticket is Child B of Q-0103. The required order is Q-0106 → Q-0107 → Q-0103, one at a time while Q-0039 remains unfixed. Q-0106 is already contained. Q-0103 must not launch until Q-0107’s `integrate` step is green.

The governing decision is *“A check outlives its subject only if it can still fail”* (2026-09-05). This ticket applies that decision; it does not reopen it.

Surfaces touched: repository tests and test support under `packages/**`, package-level `turbo.json` files, `.github/scripts/git-identity-sweep.sh`, and the implementation evidence stored with this ticket. No CLI behaviour, flow, gate, adapter contract, or persistent product schema changes.

## User story

As the `maintainer`, I want every workspace dependency on the spike explicitly retired, re-aimed, transcribed, or moved while the spike is still available, so each surviving check is shown to fail for a meaningful reason before Q-0103 deletes its former subject.

As the `contributor`, I want the workspace suite and package configuration to refer only to maintained workspace subjects, so a green result after the cutover does not hide missing fixtures, dangling inputs, or checks that became vacuous.

## Acceptance criteria

The normative acceptance criteria are AC-8 through AC-19 of `backlog/Q-0103-the-cutover-delete-the-spike-retire-its-/requirements/merged.md`, written against commit `83b193c` on 2026-09-05. They are incorporated by reference and are not copied here because Q-0103 §12 forbids carrying forward derived counts or claims without re-measuring the tree. Criterion numbering remains continuous across the three cutover children.

1. **AC-8 — move the Q-0080 allocation fixture.** Move `spike/test/q0080-allocation.json` into the workspace, correct its one-tree description, and re-aim its remaining reader without changing the correspondence between table rows and assertions.

2. **AC-9 — retire spike-specific corpus helpers.** Remove the three spike-specific exports from `packages/shared/test/corpus.ts` and every call to them. Keep and accurately document the general workspace corpus helpers. Add an executable assertion that rejects their reintroduction.

3. **AC-10 — disposition every dependency site.** Enumerate dependency sites from the current tree rather than trusting any prose count. Record one sentence per site using exactly one verdict: `retired`, `re-aimed`, `transcribed`, or `moved`. Each sentence names the sibling assertion, new subject, contractual authority, or destination required by its verdict. No site may be omitted. Transcription is permitted only for the product’s own contract, under *“A check outlives its subject only if it can still fail”* (2026-09-05); evidence about the spike itself must not be transcribed.

4. **AC-11 — prove every re-aim red before green.** While the live spike tree is still present, demonstrate every `re-aimed` site failing and then passing. The implementation report records the assertion name and observed failure message for each demonstration. Reading the rewritten assertion is not evidence.

5. **AC-12 — dispose of the six silent import guards.** Retire or re-aim each named `*.source.test.ts` spike-import clause under the AC-10 register. No clause may survive while describing coverage it no longer provides. For every re-aimed guard, introducing a disallowed import into its real module must make the test fail.

6. **AC-13 — re-aim the pinned validator citations.** Change the three spike paths asserted by `packages/shared/src/step-output.test.ts` and the corresponding JSDoc citations in `step-output.ts` together. Every replacement path must identify an existing workspace implementation of the same validator, and the assertion must contain no `spike/` path.

7. **AC-14 — replace the two-link template parity chain.** Compare `harness/flows/` directly with `packages/cli/templates/harness/flows/`, update the existing parity-chain register, and preserve separately reported checks in both directions. Mutating either copy of a shared flow must fail the guard.

8. **AC-15 — keep the git-identity corpus falsifiable.** Remove the `spike/test` corpus row and replace its spike-membership assertion with coverage that fails when the remaining corpus is empty and identifies the directories still covered.

9. **AC-16 — remove spike phases from the git-identity sweep.** Remove `spikeSources()`, its consumers, spike CI-job reads, the obsolete register, spike installation, and the `spike suite` phase. The script and its test must derive and agree on the remaining phase list rather than maintaining duplicate literals.

10. **AC-17 — remove nonexistent future Turborepo inputs.** Remove all spike inputs and their explanatory comments from the three package `turbo.json` files, plus corresponding test copies and register rows. The resulting guard must fail if any declared input names a path that does not exist.

11. **AC-18 — replace the role-table check before its spike implementation disappears.** Add a workspace test that compares role `paths:` values with the third column of `harness/architecture.md`. Changing either side without the other must fail.

12. **AC-19 — constrain production-source edits.** The only non-test production-source changes under `packages/*/src` are the JSDoc citation updates in `packages/cli/src/ticket.ts`, `packages/shared/src/role.ts`, and `packages/shared/src/step-output.ts`. No behavioural production change is permitted. Any additional required production change stops implementation and returns the ticket to a gate.

13. The `integrate` step installs dependencies with `pnpm install --frozen-lockfile` and runs `pnpm turbo run test --force --continue` using Q-0106’s landed commands. Both commands complete successfully. This is the required operational proof of Q-0106; a passing local checkout alone does not satisfy it.

14. `spike/` remains tracked and available for the entire Q-0107 change, including all AC-11 demonstrations and the green `integrate` result. Q-0103 is not started until that result has been observed.

15. The final change passes `pnpm lint`, `pnpm typecheck`, and `pnpm turbo run test --force --continue`. The mock-adapter end-to-end regression suite remains green.

## Non-goals

- Deleting or editing `spike/`, except that AC-8 moves the shared allocation fixture while leaving the rest of the tree live. The full deletion belongs to Q-0103.
- Deleting spike CI jobs, port-freeze jobs, port-freeze scripts, `packages/core/src/spike-parity.test.ts`, or `harness/port-charter.md`. These belong to Q-0103.
- Changing Q-0106’s commands, harness context files, or role assignments. Q-0107 only proves the landed commands through `integrate`.
- Sweeping every production JSDoc citation that mentions the spike. Only AC-19’s three files are in scope; the remaining mechanical sweep requires a separate ticket.
- Preserving the spike as an archive, fixture tree, tarball, or second suite.
- Fixing Q-0039, Q-0102, Q-0100, or defects already shared by the spike and workspace.
- Changing product behaviour, adapters, flows, gates, the cross-vendor rule, worktree containment, run-history formats, schemas, or CLI output.
- Adding a dependency.
- Claiming support for registry-resolved `npx quorum`.
- Merging the `developer-backend` and `developer-tooling` roles.
- Any v1 exclusion-list item: multi-user operation, remote daemon, cloud sync, plugin marketplace, visual flow canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

1. **Where is the AC-10 disposition register stored?** Recommended: a dedicated section of the run-scoped implementation report, beside AC-11’s red-before-green evidence, because it is verification evidence rather than a product file format. Owner: solution author. Blocking before implementation if the selected flow cannot persist that report location.

2. **Which surviving spike mentions count as dependency sites for AC-10?** The normative boundary is Q-0103 §3.2, re-measured against the implementation base: executable reads, asserted citations, guards, register entries, declared inputs, and transcribed cases under `packages/**`. Historical prose and the deferred production JSDoc sweep are excluded unless an executable assertion pins them. Owner: implementer, verified by the cross-vendor reviewer. Any ambiguous executable site is included rather than silently excluded.

3. **Does AC-11 require retaining deliberately failing mutations in git?** Recommended: no. The implementation report records the assertion, temporary mutation, command, and failure message; the final commit contains the green implementation only. Owner: gate. Non-blocking unless the gate requires committed proof artifacts.

## Risks

- **Silent coverage loss.** A retired assertion may be described as redundant even though its named sibling does not prove the same property. AC-10’s per-site rationale and cross-vendor review are the primary controls.

- **Unconvincing red-before-green evidence.** A failure caused by syntax, missing dependencies, or an unrelated assertion does not establish the re-aimed check. AC-11 evidence must identify the intended assertion and its relevant failure message.

- **Inventory drift.** The dependency inventory was previously undercounted. Implementation must enumerate the current tree and must not use the figures in Q-0103’s prose as its oracle.

- **Production behaviour discovered behind a test dependency.** If a dependency cannot be removed without changing production behaviour beyond AC-19’s citations, the premise of the cutover is false. Stop at the gate rather than expanding scope.

- **Template parity becomes one-directional.** Replacing two links with one can accidentally protect only one source. AC-14 requires independent mutations on both sides.

- **Q-0106’s commands may fail only in a fresh worktree.** Local success can be masked by existing dependencies. The green `integrate` step is mandatory and is the sequencing gate for Q-0103.

- **Concurrent runs can collide while Q-0039 is open.** Q-0106, Q-0107, and Q-0103 must run sequentially.

- **BYOS:** No authentication path changes. No environment-variable acceptance or subscription behaviour may be added.

- **Worktree safety:** Unchanged. The flow continues to write only in `.harness/worktrees/`; no requirement authorizes writing to the user’s working tree.

- **Gate behaviour:** Unchanged. The Q-0107 green `integrate` result is an entry condition for launching Q-0103, not a new gate type.

- **Files and schemas:** AC-8 moves one JSON fixture without changing its shape. No product schema or adapter contract changes.

- **Cold-clone impact:** Neutral in this child. The eventual cutover reduces the workspace to one dependency installation and one suite, but Q-0107 does not alter an adopter-facing installation path.
