# Q-0054 — The regression suite on Vitest, and CI gating the port

## Problem

The `packages/core` port has unit tests, but it does not yet carry the spike’s independent library-level regression evidence. That evidence remains in plain Node files under `spike/test/` and is executed separately from the workspace’s Vitest suites.

At commit `3cbebf5`, excluding `run.js`, the spike regression suite contains 17 files and 4,396 lines. Nine files and 2,059 lines exercise only library code. The remaining eight files and 2,337 lines invoke `spike/bin/harness.js`; five of those also import library code. Moving those eight files now would make this ticket depend on the unfinished `quorum` binary from Q-0010 or would change the surface they test.

The port charter has already selected the route: this ticket ports only the nine library-only files to Vitest. All eight binary-entangled files remain on the frozen spike until Q-0010. This ticket therefore does not, by itself, satisfy M2’s final requirement that `smoke.js` pass against the new binary. It supplies the library-level portion and makes it a required workspace check.

A second risk is false-green discovery. The existing runner discovers new test files because qa-red demonstrates a red phase by adding a test rather than editing an existing one. The workspace command must likewise execute a newly added matching test, through Turborepo and without accepting a cached result.

Surfaces touched: `packages/core` test code and configuration, root workspace test configuration where required, and GitHub Actions CI. The CLI, Studio, `harness/`, `backlog/`, and product file formats are not changed.

## User story

As a **maintainer**, I want the spike’s library-level regression scenarios to run against `packages/core` as Vitest tests on every push, so that I can detect a behavior lost during the port without depending only on tests written alongside the new implementation.

As a **contributor**, I want a newly added matching regression test to be discovered by the same workspace command that CI runs, so that a qa-red test cannot be silently omitted by package filters, Vitest configuration, or a Turborepo cache hit.

## Acceptance criteria

1. **Current scope is re-derived before implementation.** At the implementation commit, an executable or reviewable inventory classifies every `spike/test/*.js` file other than `run.js` by whether it invokes `spike/bin/harness.js`, imports from `spike/src`, or does both. The inventory records file names and line counts. Any difference from the baseline below is reported before translation rather than silently assigned to a category:

   - Library-only: `q0006-engine.js`, `q0034-chore-preflight.js`, `q0034-dry-run.js`, `q0034-probe-schema.js`, `q0035-empty-range.js`, `q0038-endpoint-preflight.js`, `q0057-run-scoped-reviews.js`, `q0063-stdin-epipe.js`, and `q0070-capture.js`.
   - Binary-entangled: `smoke.js`, `q0011-runs-cli.js`, `q0011-run-history.js`, `q0033-surface.js`, `q0034-review-fixes.js`, `q0036-board-containment.js`, `q0077-base-flag.js`, and `q0080-allocation.js`.

2. **Every library-only file is represented in Vitest.** Each library-only file identified by AC-1 has a named Vitest counterpart under `packages/core` and is included by the package’s effective Vitest configuration. The mapping is one-to-one at the source-file level; scenarios may be split into multiple `test` or `it` cases, but no source file may be represented only by a general claim that existing unit tests cover it.

3. **Scenario parity is recorded and complete.** For each library-only source file, a checked-in parity record lists every independently reported source scenario or assertion group and identifies the Vitest case that preserves it. A reviewer can trace every source scenario to exactly one or more executable Vitest cases. Deleted, combined, weakened, or newly strengthened assertions are called out as findings; they are not treated as translation cleanup.

4. **The frozen witness is unchanged.** The implementation changes no file under `spike/**`. The existing spike CI check and the port-freeze checks remain present and green. The branch-scope freeze guard reports no modification to `spike/**` attributable to Q-0054, and no freeze exemption is added for this work.

5. **No behavior change is included.** The Vitest cases exercise `packages/core` behavior corresponding to the source scenarios without correcting a defect, changing an expected message, relaxing an error condition, removing a timing window, or substituting a different product surface. Any observed mismatch between the spike expectation and `packages/core` stops the ticket and is recorded for the charter §2 decision route. In particular, the preserved `runGate` timer is neither removed nor bypassed by a rewritten fixture.

6. **Temporary repositories remain the oracle for repository-state behavior.** A ported scenario that examines branches, containment, refs, commits, worktrees, ticket state, run history, or repository configuration creates and controls a disposable repository for that case. Its verdict does not depend on the branch containment, git identity, global git configuration, `.harness/worktrees/`, or `.quorum/runs/` state of the checkout running the suite. Commit-creating fixtures set their own identity on the individual git command.

7. **The empty-range assertions retain their original limits.** The Vitest counterpart of `q0035-empty-range.js` does not use snapshots, does not assert any whole explanatory sentence, and does not assume a fixed width for a short commit SHA. It separately verifies the durable evidence fields and accepted outcome values exercised by the source scenarios.

8. **The command-capture cases preserve process evidence.** The counterparts of `q0063-stdin-epipe.js` and `q0070-capture.js` retain their distinctions between child exit status, timeout, spawn failure, captured output, early input closure, and capture-file failure. A process crash, signal termination, missing result, or truncated evidence cannot be reported as a pass merely because the Vitest process itself remains alive.

9. **Vitest discovery is proved through the package command.** An automated check demonstrates that a newly added file matching the effective `packages/core` Vitest include pattern is executed by `pnpm --filter @quorum/core test`. The injected test has a unique deliberate failure marker; the check passes only when the command exits non-zero and reports that marker. A hard-coded list of regression filenames does not satisfy this criterion.

10. **Discovery is proved through the exact CI workspace command.** An automated check also demonstrates that the same newly added matching failing test makes `pnpm turbo run test --force` exit non-zero and report its unique marker. The proof exercises the repository’s real Turborepo package graph and effective Vitest configuration. It must fail if `@quorum/core` is filtered out, if the include pattern excludes the new file, or if the test result is served from a Turborepo task cache.

11. **CI gates the port on every supported event.** The existing `workspace` CI job runs `pnpm turbo run test --force` after a frozen-lockfile install on both `push` and `pull_request`. The job fails when any ported regression case fails. No path filter, branch filter, conditional step, allow-failure setting, or package-specific exception may let a change to a ported test or its subject skip that command.

12. **The CI input closure covers what the tests read.** Files read by the ported suite outside `packages/core` are declared as inputs to `@quorum/core#test` in Turborepo configuration, or the tests copy/set those values in their own disposable fixture. An automated guard fails when a repository file read by a ported test is omitted from the task’s declared inputs. This applies even though CI currently uses `--force`, because local unforced runs must not reuse a verdict for different inputs.

13. **All existing CI claims are retained.** Q-0054 does not remove, merge, weaken, or condition away the `workspace`, `port-freeze-policy`, `port-freeze-branch-scope`, `port-freeze-sha`, `spike`, or git-identity-sweep checks present at the implementation base. The workspace and spike regression checks both pass after dependencies are installed.

14. **Required verification is reproducible.** From a clean checkout, after `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`, all of the following exit zero:

    1. `pnpm lint`
    2. `pnpm turbo run typecheck --force`
    3. `pnpm turbo run test --force`
    4. `npm test --prefix spike`

    The implementation record states the commit tested and the result of each command. An uninstalled or unrun suite is not reported as green.

15. **The deferred boundary is explicit in the parity record.** The eight binary-entangled files from AC-1 are listed as deferred to Q-0010 and have no Vitest translation in this ticket. The record states that `smoke.js` remains a spike-binary test and that M2’s new-binary smoke-test condition remains outstanding until Q-0010 ports the CLI-driven suites.

16. **No new runtime dependency is introduced.** The work uses the workspace’s existing Vitest and Node facilities. If implementation proves a new test-only dependency unavoidable, work stops for a maintainer decision; it is not added under this ticket by default.

17. **Cross-cutting quality checks are recorded.** The implementation record gives an explicit result for each item:

    - BYOS: no production path, test, fixture, or documentation example accepts subscription access through environment secrets; expected result is unchanged/not applicable.
    - Worktree safety: no flow behavior changes, and repository-writing cases use disposable repositories; expected result is preserved.
    - Gate behavior: regression coverage may be ported, but gate semantics and the preserved timer are unchanged.
    - Files and schemas: no persistent product file format or schema changes.
    - Cross-vendor rule: no flow or adapter selection changes.
    - Product-agnostic behavior: fixtures introduce no product-specific SaaS knowledge.
    - Lint and types: new TypeScript is strict, contains no `any`, no unjustified `@ts-ignore`, and no deprecated API use.
    - Cold-clone impact: production installation and startup are unchanged; test-only runtime impact is reported.

## Non-goals

- Porting or wrapping the `quorum` binary; that belongs to Q-0010.
- Translating `smoke.js` or any other file that invokes `spike/bin/harness.js`, including files that also import library code.
- Re-aiming a CLI-driven scenario at a `packages/core` API.
- Claiming that this ticket alone completes M2’s 30-check smoke-test condition.
- Editing, deleting, reorganizing, formatting, or fixing anything under `spike/**`.
- Replacing or deleting the spike regression CI check, any port-freeze check, or a git-identity-sweep check.
- Deleting `spike/` or performing the Q-0009 cutover.
- Changing production behavior, including fixing a defect found during translation.
- Removing, shortening, or bypassing the preserved `runGate` signal-window timer.
- Porting another Q-0009 child’s module or changing a public core API solely to make a test easier to translate.
- Adding snapshots where the source tests intentionally assert stable fragments or fields.
- Making a test verdict depend on this repository’s current branches, ticket stages, user git configuration, or gitignored runtime directories.
- Persisting the event stream or changing its contract.
- Changing a flow, gate, adapter, schema, ticket format, or run-history format.
- Any v1 exclusion-list item: multi-user support, remote daemon, cloud sync, plugin marketplace, visual flow canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

1. **What checked-in format should hold the scenario parity record required by AC-3?** Owner: maintainer. Non-blocking before implementation; choose a plain Markdown table colocated with the ported tests or the ticket’s solution record. The chosen format must remain reviewable without executing code.

2. **Should Q-0010 consume the deferred-file inventory directly, or restate it at its own implementation SHA?** Owner: Q-0010 product manager. Non-blocking for Q-0054. Q-0010 must re-derive the inventory regardless, because new spike tests may land before that ticket starts.

3. **Does the implementation-base inventory contain a newly added file whose classification is ambiguous because it resolves the binary path indirectly?** Owner: implementer, confirmed by maintainer. Blocking if encountered: classify by observed execution and imports before porting it; do not infer library-only status from a simple text search.

## Risks

- **False parity:** A syntactically faithful Vitest rewrite can weaken an assertion or alter fixture behavior while both suites stay green. The scenario mapping and stop-on-mismatch rule reduce this risk.
- **False discovery:** A package filter, Vitest include pattern, or Turborepo cache can omit a qa-red file. AC-9 and AC-10 require executable red proofs at both command layers.
- **Concurrent-test interference:** Vitest may schedule cases differently from the sequential Node runner. Shared paths, process state, timers, environment variables, or branches could make results order-dependent. Fixtures must be isolated rather than relying on file order.
- **Machine-dependent verdicts:** Git identity and pre-existing ignored directories have caused prior false results. Disposable repositories and per-command identity settings are required.
- **Scope drift into Q-0010:** Fifty-three percent of the current suite is binary-entangled. Pulling it into this ticket would more than double the translated scope and either introduce an unfinished dependency or change what those tests prove.
- **Milestone overstatement:** A green workspace suite after Q-0054 is not proof that the new CLI passes `smoke.js`. CI and ticket reporting must continue to distinguish the workspace and spike claims.
- **Frozen-witness contamination:** Editing spike tests to ease translation would remove the independent comparison the port relies on and would trip the freeze policy.
- **Runtime growth:** The nine files include large process and repository fixtures. Running them on every push may materially lengthen CI. Performance changes may optimize setup only if scenario semantics and evidence remain unchanged; dropping or silently skipping cases is not an optimization.
- **Cost overrun:** The port has already exceeded its original aggregate and mean-per-child estimates, and this is the largest remaining translation. The fixed nine-file boundary and prohibition on binary-entangled work are intended to keep the ticket reviewable.
