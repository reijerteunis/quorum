# Q-0065 — Make `integrate` test results trustworthy

## Problem

The `integrate` step treats the configured test command’s exit code as evidence that the test suite ran and produced the expected result. Three defects make that evidence unreliable or unobtainable.

First, this repository runs `pnpm turbo run test` without disabling Turborepo’s cache. Turborepo can replay an earlier pass without executing any tests, after which `integrate` records `tests=ok` and advances the flow. This produced a false green on 2026-08-26: a cached 7/7 pass was followed immediately by a forced run that exposed a failing test.

Second, Turborepo removes undeclared environment variables from test processes. The documented command for the opt-in real-adapter probe sets `QUORUM_REAL_CLI=1`, but the `test` task does not declare that variable. The probe therefore skips instead of executing. This is not a false pass—the probe reports the skip—but the documented evidence cannot be obtained.

Third, `runCommand` uses Node’s synchronous child-process output buffer. Output above the 1 MiB default can be truncated and reported as an ordinary non-zero result. A passing suite can therefore be reported as failing, while an `expect: fail` step can incorrectly accept output-buffer failure as proof of red. For a child that exits non-zero near the buffer limit, the returned error does not reliably identify the overflow, so inspecting the error is insufficient.

The selected product behavior is:

- Disable Turborepo caching explicitly in this repository’s configured test command. Do not put Turborepo-specific behavior in the flow engine.
- Declare `QUORUM_REAL_CLI` as an input to Turborepo’s `test` task so the documented opt-in command reaches the probe and changes the task’s cache identity.
- Execute commands with stdout and stderr directed to temporary files, then construct the existing `runCommand` result from the complete files. This removes the child-process output ceiling without changing the public result fields or creating a persistent artifact.
- Warn adopters in the shipped harness template that their configured test command must disable any runner cache when fresh execution is required. Quorum cannot infer a generic cache-bypass option for arbitrary test runners.

Surfaces touched: CLI behavior through the `integrate` step, repository `harness/` configuration, the harness template copied by `harness init`, and the internal command runner in both the spike and ported core implementations.

## User story

As a **solo maintainer**, I want an `integrate` step to record pass or fail only from a test command that executed with complete output, so that a flow cannot advance on a cached pass or mistake output capture failure for a test result.

As a **cold-clone adopter**, I want the generated harness configuration to tell me that cached test results do not prove fresh execution, so that I can configure the cache-bypass option appropriate to my repository’s test runner.

As an **adapter contributor**, I want the documented opt-in real-adapter probe command to pass its switch through Turborepo, so that following the source documentation actually executes the probes at the gate where paid subscription use is permitted.

## Acceptance criteria

1. **Repository harness — fresh execution:** `harness/harness.yaml` configures the workspace half of `commands.test` as `pnpm turbo run test --force`. The spike test command remains part of the same shell chain and remains unchanged except where needed to append the Turbo option.

2. **Repository harness — no engine coupling:** Running an `integrate` step with `run_tests: true` continues to execute the configured `commands.test` string as written. The engine does not parse Turborepo output, inject `TURBO_FORCE`, inspect cache counts, or otherwise acquire knowledge of Turborepo, Nx, Gradle, Bazel, or another test runner.

3. **Repository harness — observable non-cached run:** An automated acceptance test or fixture proves that the configured Turbo invocation includes `--force`. The evidence must not depend only on a real local Turbo cache being warm or cold.

4. **Shipped template — cache warning:** The comment beside `commands.test` in `spike/templates/harness/harness.yaml` states in plain language that `integrate` trusts the command’s exit result and that adopters using a caching test runner must configure that command to force fresh execution or otherwise disable replay. The default remains `npm test` because the template cannot know the adopter’s runner-specific option.

5. **Turborepo environment contract:** `turbo.json` declares `QUORUM_REAL_CLI` in the `test` task’s `env` list. It is not declared as `passThroughEnv`, because changing whether paid probes are selected must also change the task’s cache identity.

6. **Real-probe command:** With `QUORUM_REAL_CLI=1`, the documented command `pnpm turbo run test --force --filter @quorum/core` passes the variable to the `@quorum/core` test process. A test that substitutes a harmless environment-reading fixture proves the propagation without calling a real vendor CLI or spending a subscription round-trip.

7. **Probe documentation:** The JSDoc in `packages/core/src/adapters/real-cli.probe.test.ts` continues to document the Turbo command from criterion 6. No second, contradictory invocation is introduced. The probe remains skipped when `QUORUM_REAL_CLI` is absent.

8. **Complete successful output:** In both `spike/src/fanout.js` and `packages/core/src/fanout/command.ts`, `runCommand` can execute a child that writes at least 2 MiB to stdout and exits 0. It returns `code: 0`, `timedOut: false`, and the complete stdout without an `ENOBUFS` failure or truncation.

9. **Complete failing output:** In both implementations, `runCommand` can execute a child that writes at least 2 MiB across stdout and/or stderr and then exits with a known non-zero status. It returns that child status, `timedOut: false`, and complete captured output. The result must not depend on whether Node kills the child before it exits.

10. **No fixed child-output ceiling:** Command execution directs stdout and stderr to temporary files rather than asking `execSync`, `spawnSync`, or an equivalent synchronous capture API to retain child output within a configured `maxBuffer`. Raising `maxBuffer` to another fixed value does not satisfy this criterion.

11. **Result contract preserved:** `runCommand` retains its existing externally observed result contract: successful results contain `code`, `out`, and `timedOut`; ordinary failures additionally retain the existing timeout-related fields where currently returned. Successful output preserves the current behavior of returning stdout. Failed output preserves the current behavior of returning stdout followed by stderr. No new overflow outcome or required result field is added.

12. **Timeout behavior preserved:** A command exceeding `timeoutMs` is still terminated and returns a non-zero result with `timedOut: true` and the configured `timeoutMs`. Output written before termination is returned completely. Output volume alone never sets `timedOut: true`.

13. **Temporary-file lifecycle:** Output capture files are created outside tracked repository content, are unique per invocation, and are removed after success, ordinary failure, and timeout. Failure to create, read, or remove a capture file stops the run with an explicit error that names the capture operation; it is never converted into an expected test failure.

14. **Both implementations remain witnesses:** Equivalent regression tests cover criteria 8–13 in the spike and ported core trees. The behavior change lands in `spike/src/fanout.js` and `packages/core/src/fanout/command.ts` together despite the spike freeze, so the port does not preserve the known defect as its independent witness.

15. **End-to-end integrate result:** An automated `integrate` test runs a command whose output exceeds 1 MiB and verifies both expectations: an exiting-zero command can satisfy `expect: pass`, and output-capture infrastructure failure cannot satisfy `expect: fail` or write `tests=ok`. Existing mock-adapter end-to-end tests, type checking, and lint remain green.

## Non-goals

- Detecting cache hits by parsing test-runner output.
- Automatically discovering or injecting cache-bypass options for adopter-defined test runners.
- Disabling caches for commands a maintainer runs manually outside a flow.
- Changing the meaning of `expect: pass` or `expect: fail` beyond ensuring that the command result and output are intact.
- Adding a persistent test-output artifact or changing the declared files written by an `integrate` step.
- Streaming live test output to the CLI or Studio. Temporary-file capture removes the ceiling but does not add live display.
- Changing the `runCommand` result into an asynchronous API or adding an overflow status.
- Running a paid real-adapter probe in automated tests, implementation work, or review.
- Changing adapter contracts, flow YAML schemas, gate behavior, ticket stages, or run-history file formats.
- Fixing cached or truncated results produced before this change.
- Multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Non-blocking — temporary directory location (owner: engineer):** Which operating-system temporary-directory API and filename convention should the two implementations share? The choice must satisfy criterion 13 and must not create tracked files. It does not change product behavior or a public contract.

2. **Non-blocking — cleanup retry behavior (owner: engineer):** On platforms where antivirus or process shutdown briefly holds a capture file open, should cleanup be retried before reporting the explicit cleanup error? Any retry must be bounded and tested. Silent abandonment is not allowed.

There are no blocker open questions. The cache policy, Turborepo environment declaration, output-capture design, and public result shape are decided by this requirement.

## Risks

- Forced Turbo execution makes every repository `integrate` run slower. This is an intentional cost of claiming that the current tree was tested; the spike suite remains unaffected by Turbo caching.
- Declaring `QUORUM_REAL_CLI` in `env` means its presence and value participate in Turborepo’s task hash. That can create separate cache entries, but forced gate runs do not replay either entry.
- Temporary-file capture trades a memory-buffer ceiling for disk usage. A command with unbounded output can consume available temporary storage; capture-file I/O failures must therefore stop explicitly rather than resemble a test result.
- Reading complete output after the child exits can still require substantial application memory. This ticket removes Node’s 1 MiB child-process capture limit; it does not introduce log paging or an application-level output retention policy.
- Maintaining equivalent JavaScript and TypeScript implementations can drift. Shared behavioral fixtures or identical test cases should be preferred where the current test structure permits them.
- Tests involving multi-megabyte output and timeouts may be slow or timing-sensitive. Fixtures should use deterministic byte counts and bounded commands rather than relying on the host’s pipe timing.

### Cross-cutting checklist

- **BYOS:** No subscription key path, fixture, documentation example, or automated paid CLI call is added. `QUORUM_REAL_CLI` remains an explicit opt-in switch for subscription-authenticated CLI probes.
- **Worktree safety:** Flow commands still run in their integration worktree. Capture files live outside tracked repository content and are cleaned up; the user’s working tree is not modified.
- **Gate behavior:** Unchanged. The change improves the evidence presented to existing gates; it does not add, remove, bypass, or automate a gate.
- **Files and schemas:** `harness/harness.yaml`, the shipped harness template, and `turbo.json` change. No persistent file format or schema changes.
- **Lint and type rules:** The TypeScript implementation remains strict, uses no `any` or unreasoned suppression, and introduces no deprecated API. The spike remains outside ESLint scope but receives equivalent behavioral tests.
- **Cross-vendor rule:** Not applicable; no reviewing or judging step changes.
- **Product agnosticism:** Core remains test-runner-agnostic. Turborepo-specific configuration is confined to this repository’s own harness and workspace configuration; the shipped template uses generic wording.
- **Cold-clone impact:** No additional command is required for an adopter using the default `npm test`. Adopters with caching runners receive one configuration warning and must choose their runner’s cache-bypass option before relying on fresh-execution evidence.
- **Errors are explicit:** Capture infrastructure errors stop the run and cannot be treated as red-test evidence or recorded as `tests=ok`.
