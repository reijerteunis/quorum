# Q-0095 — The mock end-to-end suite runs against the CLI binary

## Problem

A solo maintainer cannot complete the M2 CLI cutover because the workspace suite does not yet exercise the complete mock end-to-end journey through the `packages/cli` binary. The authoritative coverage remains in `spike/test/smoke.js`, which combines binary execution with direct imports from `spike/src/`. Moving the whole file would duplicate library coverage already carried by the workspace suite, while omitting its binary-facing behavior would leave regressions across the CLI commands undetected.

The transfer also has a known false-positive hazard. Two candidate-output assertions were updated after requirements candidates moved under `requirements/run-{run}/`; one earlier assertion passed because it checked an obsolete flat path. A translated test that checks only the old path can appear green while a failed parallel sibling incorrectly writes a candidate. Passing against the correct binary is therefore insufficient evidence: the relevant translated assertions must also fail against a deliberately broken binary.

Surfaces touched: the `quorum` CLI and its automated workspace test coverage. The `harness/`, `backlog/`, and Studio product behavior are not changed.

## User story

As a **solo maintainer**, I want the complete binary-facing behavior of the mock end-to-end journey exercised against the workspace-built `quorum` CLI so that I can detect command-level regressions and know that the M2 cutover is ready without relying on the spike binary.

As an **adapter contributor**, I want the mock end-to-end suite to continue covering adapter reporting through the public CLI boundary so that changes to an adapter cannot silently break the command behavior shared by all adapters.

## Acceptance criteria

1. **Workspace CLI — binary under test.** The added workspace tests execute the CLI binary produced from `packages/cli`; they do not execute the spike binary and do not satisfy binary coverage by calling command handlers or `packages/core` APIs directly. The test setup records or otherwise exposes the resolved executable path so a test failure identifies which binary was exercised.

2. **Workspace CLI — scope of transfer.** The workspace suite carries the binary-facing behavior represented by `spike/test/smoke.js` while leaving its direct-import library behavior to the existing workspace coverage. The transfer does not add imports from `spike/src/`, copy implementations from `spike/src/`, or duplicate a scenario solely to reproduce one of the file's fifteen dynamic `await import()` calls.

3. **Workspace CLI — command coverage.** Through spawned CLI processes, the transferred suite exercises every command family covered by the smoke witness: `init`, `ticket new`, `run` across its represented flows, `board`, `adapters`, `runs`, `validate`, and `lint`. Each command family has at least one independently identifiable test or subtest, and removing or bypassing its CLI invocation makes that test or subtest fail.

4. **Workspace CLI — behavioral parity.** For every binary invocation transferred from `spike/test/smoke.js`, the workspace test asserts the same externally observable contract that the spike witness asserts, including applicable exit status, stdout or stderr, and files or directories created, changed, or left absent. Differences caused only by the workspace binary's invocation path may be adapted; weakening or deleting an observable assertion is not permitted without recording it as an open scope decision.

5. **Workspace CLI — mock-only and deterministic.** The transferred suite uses mock adapters and repositories or project directories created by the test itself. Its verdict does not depend on a vendor subscription, network access, global or local Git identity, an unset Git configuration value, or a pre-existing gitignored directory. Any Git identity needed for commits is set explicitly inside the fixture repository.

6. **Workspace CLI — isolated writes.** Each scenario runs in an isolated temporary project created by the test and may inspect only that project, the test package, tracked-and-unignored repository inventory, and artifacts it built itself. No flow scenario writes to the developer's working tree. Code-writing flow artifacts and branches remain in the locations required by the existing behavior, including worktrees under `.harness/worktrees/` and the `harness/<id>/integration` branch family.

7. **Workspace CLI — nested requirements candidates.** Assertions concerning requirements candidates inspect the current run-scoped layout under `requirements/run-{run}/`. The successful candidate assertion verifies the expected candidate in that run-scoped directory. The assertion that a failed parallel sibling wrote no candidate searches recursively beneath the relevant requirements directory and fails if that sibling's candidate exists at any depth; it does not infer absence from the obsolete flat path `requirements/candidate-claude.md`.

8. **Workspace CLI — required red witness.** Before the final green run, the implementation demonstrates that both translated candidate-output assertions from criterion 7 fail for the intended reason against a deliberately broken form of the workspace CLI: one break causes the expected run-scoped candidate not to be found, and one break causes a failed parallel sibling's candidate to be found recursively. The broken form is confined to the test or mutation procedure and is not committed as product behavior. The recorded verification identifies the two tests, the injected break for each, and the resulting failing assertion; unrelated process failure, failure to start the binary, or a different earlier assertion does not count as the red witness.

9. **Workspace CLI — preserved defects.** The transferred coverage preserves current behavior for the known defects tracked by Q-0059, Q-0060, Q-0066, and Q-0068. This ticket neither changes the traversing `dirOf` behavior, adds an error for silent frontmatter handling, repairs the adapter probe crash, nor changes the product name in the BYOS refusal. Where a test must encode counterintuitive behavior, its source cites the applicable ticket instead of restating the ticket history.

10. **Workspace tests — spike independence.** The new coverage is located under the workspace test suite and can run after `spike/` is removed. It does not read, import, spawn, or require files under `spike/` at test runtime. Comparison with the spike witness during implementation is allowed, but the committed test verdict is independent of the continued presence of `spike/`.

11. **Spike witness — unchanged authority.** No file under `spike/src/` or `spike/test/` is modified or deleted. After installing the spike dependencies as specified by the engineering rules, `npm test --prefix spike` passes without reducing or skipping its existing coverage.

12. **Parity register — classification.** `packages/core/src/spike-parity.test.ts` is updated in the same change so that `spike/test/smoke.js` remains classified as `split`, its library half is recorded as already carried by the workspace suite, and its binary half is recorded as transferred by this ticket. It is not classified as binary-only.

13. **Parity register — measurements.** Any pinned line totals or related measurements for `spike/test/smoke.js` in the parity register are re-derived from the unchanged source file using the register's established measurement method. The resulting values match the source inventory; they are not obtained by incrementing or decrementing previous totals to make the assertion pass.

14. **Repository verification.** After installing workspace dependencies with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force` passes with the transferred suite enabled. After installing spike dependencies with `npm install --prefix spike --no-audit --no-fund`, `npm test --prefix spike` also passes. No test added by this ticket is skipped, focused, or conditionally omitted in either required run.

15. **Static quality checks.** The changed workspace files pass the repository's TypeScript strict checks and `pnpm lint`. The implementation introduces no `any`, no unexplained `@ts-ignore`, and no new use of an API marked deprecated by its dependency typings.

16. **BYOS.** The transferred tests and fixtures do not add a path for supplying a subscription secret through an environment variable, option, fixture, or documentation example. Existing refusal behavior when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` is set remains covered where represented by the binary half of the smoke witness, including refusal before a CLI probe.

17. **Gate and flow behavior.** Where the transferred smoke scenarios exercise gates or flows, their existing observable behavior is preserved: gates remain human-gated by default, `auto` remains opt-in per gate, a human-locked gate cannot be overridden, exhausted loops land on a human gate, and the cross-vendor rule remains enforced by `lint`. This ticket adds regression coverage and does not introduce a new gate or flow format.

18. **Files and schemas.** Persistent outputs observed by the transferred suite remain files in `backlog/`, `harness/`, or `.quorum/` according to the existing contracts. No hidden state store, new persistent file format, or schema change is introduced by the test transfer.

19. **Product neutrality.** New production code, test infrastructure, fixture names, and assertions remain product-agnostic. Vendor names may appear only where the existing adapter contract or representative demo data requires them; no SaaS-product-specific behavior is added.

20. **Cold-clone impact.** The change does not alter installation instructions, runtime setup, or the supported acquisition paths. It makes no claim that registry-resolved `npx quorum` works. Added test-only setup does not add a step to an adopter's first-run path.

21. **Cutover follow-up.** Before this ticket is closed, a separate backlog ticket is created for the Q-0010 §5 cutover work: deleting `spike/`, retiring the spike CI job, and retiring `harness/port-charter.md`. That ticket records Q-0095 as its prerequisite. Those deletions are not performed by Q-0095.

## Non-goals

- Deleting or editing `spike/src/**` or `spike/test/**`.
- Deleting `spike/`, changing or retiring its CI job, or retiring `harness/port-charter.md`; those actions belong to the follow-up ticket.
- Porting the library-facing half of `spike/test/smoke.js` or duplicating coverage already carried by workspace tests.
- Reclassifying `spike/test/smoke.js` as binary-only.
- Porting domain helpers into `packages/cli`; existing behavior must use the APIs already present in `packages/core`. A genuinely missing core API is a scope blocker, not permission to copy spike logic.
- Fixing Q-0059, Q-0060, Q-0066, or Q-0068 while translating their current behavior.
- Changing CLI output, exit codes, persistent file layouts, schemas, command names, adapter contracts, flow semantics, or gate semantics except for a workspace invocation-path adaptation that does not affect users.
- Adding real-vendor end-to-end coverage, requiring a vendor subscription, or accessing the network.
- Adding a registry-based installation path or changing the cold-clone instructions.
- Adding or enforcing budget caps.
- Adding multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual canvas, eval suites, a Gemini adapter, or a desktop shell.
- Changing the Studio; this ticket concerns the CLI and automated tests only.

## Open questions

1. **Owner: implementing engineer; non-blocking.** Which existing workspace test file or new `packages/cli` test file should contain the transferred scenarios? The choice must satisfy criteria 2, 3, and 10 and must not change the observable coverage boundary.

2. **Owner: implementing engineer and reviewer; blocking before merge if the repository has no established mechanism.** What repository-supported mutation mechanism will produce and record the two red witnesses required by criterion 8 without committing broken product behavior? The answer may use a temporary built fixture, injectable test seam, or equivalent isolated mechanism, but it must exercise a spawned binary and show each target assertion failing for its intended reason.

3. **Owner: implementing engineer; blocking if encountered.** Does any binary-facing smoke scenario require a domain API that is genuinely absent from `packages/core`? If yes, stop and report the missing API and affected scenario; do not copy the implementation from the spike or expand this ticket silently.

4. **Owner: product manager; blocking if parity cannot be preserved.** Does any spike assertion depend on an invocation detail that cannot apply to the workspace binary while preserving the same external contract? If yes, identify the assertion and proposed replacement before weakening or omitting it.

5. **Owner: maintainer; non-blocking for implementation, blocking for ticket closure.** What identifier is assigned to the cutover follow-up required by criterion 21? Its scope is fixed here; only its backlog identifier and scheduling remain to be recorded.

## Risks

- A mechanical translation may accidentally include direct-import tests, duplicating library coverage while still leaving a binary path untested.
- Because the smoke witness crosses all command families, shared fixture setup can hide which command regressed or can create order-dependent failures.
- A test can appear to spawn the workspace CLI while resolving a spike entry point or directly invoking a handler; explicit executable-path evidence reduces this risk.
- Candidate absence checks can regress to the obsolete flat path and pass falsely. Recursive checking plus the required red witness is the control.
- A deliberately broken binary can yield a meaningless red result if it fails to start or fails earlier than the target assertion. Criterion 8 requires mutation-specific failure evidence.
- Tests that inherit Git identity, subscription environment variables, or pre-existing ignored directories may pass locally and fail in CI, making the verdict a property of the machine rather than the commit.
- Long-running process tests may increase workspace suite duration or become flaky if they share directories, ports, environment state, or timing assumptions.
- Updating parity totals by hand can conceal drift between the register and the unchanged witness.
- Fixing a known defect during translation would destroy parity with the authoritative spike and broaden the cutover scope.
- Treating green workspace coverage as authorization to delete the spike immediately would combine verification and cutover, removing the independent witness before the separate follow-up is reviewed.
