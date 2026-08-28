# Q-0070 — Preserve complete command output and report only real timeouts

## Problem

`runCommand` executes both `integrate` and `commands.install` commands with Node's default 1 MiB output buffer. When a child exceeds that buffer, Node kills it with `SIGKILL`; `runCommand` then reports `timedOut: true`, even though the configured fifteen-minute timeout did not expire. The CLI consequently records `tests=invalid` and directs the maintainer toward an environment or installation problem instead of the output-capture failure.

A second failure mode can produce a false green. A child that writes 2 MiB in one operation and immediately calls `process.exit(0)` can flush only 64 KiB through a pipe. `runCommand` then returns `code: 0` with incomplete output, allowing `integrate` to record `tests=ok`. Raising `maxBuffer` cannot correct this case because the missing bytes never reach the parent process.

The selected design is therefore to remove the pipe-buffer ceiling: each `runCommand` invocation shall direct stdout and stderr to invocation-unique temporary files and construct its result from those files after the child ends. The files must be outside tracked repository content and removed on every terminal path. This is a behavior change with a testable red phase and new infrastructure-failure modes, so Q-0070 follows the full SDLC route, not the chore route.

Surfaces affected: the CLI, `integrate`, `commands.install`, `dev/integration.md`, persisted `output.txt`, and the corresponding implementations in `spike/` and `packages/core/`.

## User story

As a **maintainer**, I want commands run by `integrate` and `commands.install` to return their complete output and distinguish genuine timeouts from capture failures, so that a flow cannot record a false test success or stop with a misleading timeout diagnosis.

## Acceptance criteria

1. Before implementation begins, `docs/DECISIONS.md` contains an append-only entry for Q-0070, using the required **Decision**, **Alternatives considered**, and **Why** headings. It selects invocation-unique temporary-file capture for stdout and stderr, rejects merely raising `maxBuffer` because that does not fix the measured false-green case, defines the file lifecycle and result-construction contract, and records that Q-0070 uses the full SDLC route.

2. `runCommand` in both `spike/src/fanout.js` and `packages/core/src/fanout/command.ts` directs child stdout and stderr to capture files outside the repository's tracked content. Capture paths are unique for concurrent invocations, and the returned `CommandResult` preserves the existing public fields and the existing stdout/stderr composition order while containing all bytes delivered to the files.

3. Equivalent automated tests in both implementation trees run a child that produces exactly 2,097,152 bytes on stdout and exits with status 0. For both a single monolithic write and 2,048 progressive 1 KiB writes, and for both natural completion and an explicit `process.exit(0)`, `runCommand` returns `code: 0`, `timedOut: false`, and all 2,097,152 bytes.

4. Equivalent automated tests in both implementation trees repeat the large-output matrix from AC-3 with a non-zero child exit status. Each result contains all 2,097,152 bytes, reports the child's own status, and has `timedOut: false`. No output-volume path may kill the child or be classified as a timeout.

5. The existing 900 KiB regression case returns `code: 0`, `timedOut: false`, and all 921,600 bytes in both implementation trees. The result must not depend on whether the child writes monolithically or progressively or ends naturally or with explicit `process.exit()`.

6. A command is reported with `timedOut: true` only when the configured elapsed-time limit expires. The existing sleep-based timing assertions in `packages/core/src/fanout/command.test.ts:34–48` remain present and green, and equivalent spike coverage verifies that timeout enforcement and termination have not been weakened. Output captured before a genuine timeout is returned according to the documented `CommandResult` contract.

7. Failure to create, write, close, read, or remove required capture infrastructure stops the run with an explicit capture-infrastructure error. It is not returned as an ordinary child exit, a timeout, or a test failure; cannot satisfy `expect: pass` or `expect: fail`; and cannot cause `tests=ok` to be written. Automated tests cover at least capture setup failure and capture read failure. Cleanup failure after an otherwise completed command is also surfaced explicitly rather than silently ignored.

8. Every capture file is removed after successful exit, non-zero exit, genuine timeout, and capture-infrastructure failure. Automated tests verify cleanup on each path and verify that two concurrent `runCommand` invocations cannot share or overwrite capture content. No capture artifact is created in the user's working tree, `.quorum/`, `backlog/`, or `harness/`.

9. Both `integrate` and `commands.install` continue to use the corrected `runCommand`. An integration-level regression test demonstrates that a successful 2 MiB-producing command can write `tests=ok` only when its complete output was captured, while a capture-infrastructure failure stops the run without writing `tests=ok` or being treated as an expected command failure. Persisted `output.txt` and `ctx.lastIntegration` are derived from the complete captured result, including a failure summary at the end of long output.

10. The same change updates all tests and source pins affected by the implementation, including whole-object `toStrictEqual` assertions in `command.test.ts`, the exact `command.ts` export assertion in `fanout.source.test.ts`, and the source-text assertion for `killSignal: 'SIGKILL'`. The implementation report names each updated or intentionally unchanged pin. It also corrects the `command.ts` JSDoc example to the command configured by Q-0065, including `--force`, and corrects the spike twin comment if one exists.

11. The fix lands in `spike/src/fanout.js` and `packages/core/src/fanout/command.ts` together with behaviorally equivalent tests. The implementation report records the full verification commands and results, re-runs `.github/scripts/port-freeze-guard.sh` for Q-0070, and records that the guard exits successfully because Q-0070 is not one of Q-0009's fourteen children.

12. Cross-cutting checks are recorded in the implementation report: BYOS is unchanged; no subscription-authentication path is added; worktree isolation is unchanged and temporary captures never enter the user's working tree; gate behavior is unchanged; no persistent file format or schema is introduced; applicable lint and type checks pass; the spike remains outside ESLint scope and any unfamiliar dependency API is checked against its current typings; the cross-vendor rule is unchanged; and cold-clone setup gains no new user action or dependency.

## Non-goals

- Raising `maxBuffer` to a larger finite value or selecting a new output-size ceiling.
- Streaming live command output to the terminal, Studio, or another consumer.
- Changing the configured command timeout or weakening termination of genuinely timed-out children.
- Changing the `CommandResult` public fields, child exit-code semantics, or the established stdout/stderr composition order.
- Retaining capture files as run artifacts or introducing a new persistent file format.
- Changing `expect: pass`, `expect: fail`, `environmentFailure`, gate behavior, or the meanings of `tests=ok` and `tests=invalid`, except that capture failures must be handled explicitly as required above.
- Migrating unrelated deprecated APIs, adding a dependency, or refactoring command execution beyond what temporary-file capture requires.
- Changing adapters, subscription login, cross-vendor enforcement, the Studio, or remote execution.
- Porting Q-0054's remaining regression suite or setting a future output-headroom policy.

## Open questions

None. The measured false-green case rules out a larger finite buffer, and this requirement settles both the capture design and the delivery route. Any implementation discovery that would require changing `CommandResult`, output composition order, or a persistent file format must return Q-0070 to the requirements gate rather than being resolved during implementation.

## Risks

- Temporary-file APIs and child-process descriptor behavior can differ across operating systems. Tests must exercise the supported environments; POSIX behavior alone must not be assumed to establish portability.
- Cleanup may race with child termination or file reads, particularly on timeout paths. Cleanup must occur only after the child no longer owns the descriptors and result construction has completed.
- Separate stdout and stderr files preserve completeness but cannot reconstruct interleaving that the existing contract did not retain. The implementation must preserve the established composition order and document it in the decision entry.
- Disk exhaustion, permission failures, antivirus interference, or abrupt process termination can prevent capture or cleanup. Failures observable by the running process must be explicit; cleanup after an uncatchable process termination is not guaranteed.
- Reading complete output into `CommandResult` removes Node's pipe ceiling but still consumes memory when constructing the returned strings. This ticket prevents silent loss and false timeout classification; redesigning `CommandResult` as a streaming or file-backed public contract is out of scope.
