# Q-0094 — CLI run command, gate reader and its flags

## Problem

The workspace CLI does not yet provide the command that executes a flow. The authoritative spike supports `harness run <flow> <ticket>`, but its command handling, gate reader, terminal rendering, signal handling, and exit behavior still live in `spike/bin/harness.js`.

Without an equivalent `quorum run` command, a maintainer cannot execute the `runFlow` API in `packages/core`, answer gates interactively or from a script, select a diff base or adapter, observe the event stream, or distinguish a completed run from an aborted, failed, interrupted, or unanswered run.

This ticket touches the **CLI** surface. It reads the selected flow from `harness/`, reads and updates the selected ticket in `backlog/`, and permits `core` to persist run history under `.quorum/`. It does not add a Studio surface.

## User story

As a **solo maintainer**, I want to run a named flow for a ticket from the CLI, answer each gate interactively or with ordered command-line answers, and receive a distinct terminal exit status, so that I can operate Quorum manually or from a shell script without confusing “nobody answered,” “a human stopped,” and “the run failed.”

As a **cold-clone adopter**, I want `quorum run` to show useful progress, explicit gate instructions, and actionable errors while preserving worktree safety, so that I can complete my first run from the README without learning internal engine APIs.

As an **adapter contributor**, I want the CLI to pass adapter selection into the existing core API and render the shared event contract without vendor-specific branches, so that a new adapter does not require changes to the run command.

## Acceptance criteria

1. **Command registration and usage.** The CLI registers `run` in its command registry and help output in the spike’s relative command order. `quorum run <flow> <ticket>` dispatches to the run handler. If either positional argument is missing, the command prints an error containing the complete usage shape and exits `1`:
   `quorum run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter <name>] [--verbose] [--gate-answer advance|retry|abort]`.

2. **Project, flow, and ticket loading order.** The command resolves the project using the CLI’s existing project rules, lints the project’s complete `harness/flows/` directory before loading the selected ticket or starting a run, loads the named flow from `harness/`, and reads the named ticket through the existing backlog API. A failed lint prints the existing lint report, exits `1`, and does not start `runFlow` or write run state.

3. **Core API boundary.** The CLI invokes the existing `packages/core` `runFlow` function as a lazy, single-consumer `AsyncIterable<Event>`. It consumes the iterable with asynchronous iteration, renders every yielded event in order, and obtains the run outcome from the terminal event. It does not introduce a callback-based `runFlow` interface, duplicate domain helpers from the spike, or make `core` print to the terminal or install process signal handlers.

4. **Run option forwarding.** The command passes the selected flow, ticket, resolved project dependencies, and a caller-owned `AbortSignal` to `runFlow`. It forwards `--dry` and `--auto` as booleans. It forwards the value of `--base <ref>`, or `null` when absent. It applies `--adapter <name>` using the existing adapter override behavior before execution, including the corresponding in-memory project configuration used by core. Adapter override occurs only after directory linting, so linting evaluates the flow files’ declared cross-vendor structure rather than the override.

5. **Base argument validation.** A bare `--base` is rejected before project files are read or any run state is written. The error states that `--base` needs a revision and exits `1`. A supplied base is treated as the diff anchor. It does not change `config.repo.base_branch`, the integration branch, or the branch from which a rework step merges. If an explicitly supplied ref cannot be resolved, the error identifies `--base` as the source of that ref, including when its value equals the configured base value.

6. **Ordered scripted gate answers.** Every `--gate-answer` occurrence is retained and consumed once, in command-line order, by the next gate that requires an answer. Valid scripted answers are full words, matched after trimming and case-folding: `advance`, `abort`, and, only when that gate offers retry, `retry`. Scripted abbreviations are not accepted. A value invalid for the current gate is not skipped and the following queued answer is not consumed in its place.

7. **Scripted-answer operator errors.** A bare `--gate-answer`, an unrecognized scripted value, or `retry` supplied to a gate that does not offer retry causes a `FlowError`. The error names the gate kind and reason, shows the supplied value, lists exactly the answers available at that gate, and exits `1`. These cases remain failed operator errors; they are not classified as `undecided`.

8. **Non-interactive unanswered gate.** When the queued scripted answers are exhausted and stdin is not a TTY, the gate reader does not read stdin and does not wait. It throws `GateUnansweredError` with gate metadata whose condition is `answers-exhausted`. The message names the gate, lists the applicable repeatable `--gate-answer` values, and says that an interactive run is an alternative. Core classifies the run by the error type, completes the event stream with terminal status `undecided`, and the CLI exits `3`.

9. **Interactive gate presentation.** When stdin is a TTY and no scripted answer remains, the CLI opens a readline prompt. Before asking, it prints the gate kind and reason and the ticket folder to inspect. A normal gate offers `advance / abort`; a retry-capable gate offers `advance / retry / abort`. The readline handle is closed after an answer or interruption and is not leaked across gates or after the run.

10. **Interactive answer rules.** Interactive answers are trimmed and case-folded. Prefixes beginning `ad` select `advance`; prefixes beginning `ab` select `abort`; and prefixes beginning `r` select `retry` only when retry is offered. An empty answer or an unrecognized answer throws `FlowError`, names the gate and allowed answers, ends the run as `failed`, and exits `1`. No empty, closed, or malformed input defaults to `advance`.

11. **TTY closed without an answer.** If readline closes before its question callback receives an answer, the gate reader throws `GateUnansweredError` with gate metadata whose condition is `stdin-closed`. Core completes the event stream as `undecided`, and the CLI exits `3`. Classification is based on `instanceof GateUnansweredError`, never on matching error-message text.

12. **Gate answer envelope.** For each `gate` event, the CLI returns the selected answer to core in the shared correlated envelope containing that event’s exact `gateId`. The CLI does not invent `undecided` as a gate answer. Invalid envelopes and stale gate IDs remain core operator errors, produce terminal status `failed`, and exit `1`.

13. **Automatic and human-locked gates.** With `--auto`, gates that core permits to auto-advance require no CLI answer. A `human-locked` gate is never auto-answered. If an unattended `--auto` run reaches a `human-locked` gate with no scripted or interactive answer available, it may and must end `undecided` under criteria 8 or 11; it must not advance the gate or be reported as completed.

14. **Abort precedence.** If the caller’s `AbortSignal` becomes aborted while an answer is pending, interruption takes precedence over `GateUnansweredError`. The resulting terminal status is `interrupted`, not `undecided`, even if readline or stdin closes during the same interval.

15. **Terminal event rendering.** The CLI renders the shared event stream without inspecting adapter-specific payloads:
    - `info` as dim run narration;
    - `warn` as an amber warning;
    - `step` as a teal step marker with a bold step id and dim message;
    - `done` as a green completion marker with a bold step id and dim message;
    - `spawn` as a dim command line for its step, regardless of `--verbose`;
    - `stdout` only when `--verbose` is present, dimmed, prefixed by its step id, and truncated to the spike’s first 160 characters;
    - `retry` regardless of `--verbose`, including step id, reason, attempt, total attempts, rounded delay in seconds, and the failure message;
    - `gate` through the gate reader in criteria 6–14;
    - `terminal` as the final run summary supplied by the shared event stream.

16. **Terminal status to exit code.** After consuming the terminal event, the CLI maps statuses through the existing exhaustive `EXIT_CODE_FOR_STATUS` table: `completed` → `0`, `regressed` → `0`, `aborted` → `2`, `undecided` → `3`, `failed` → `1`, and `interrupted` → `130`. The `regressed` value of `0` is a preserved known defect, not a new product decision. A terminal event is required for a normally completed iteration; the handler must not infer success from the iterable merely ending.

17. **Signal ownership and cleanup.** For the duration of one run invocation, the CLI installs one-shot handlers for `SIGINT` and `SIGTERM`. Either signal aborts the caller-owned controller with the message `received <signal>`, allowing core to finish and persist an `interrupted` terminal event. The CLI then exits `130`. Signal listeners are removed when the run terminates, throws, or fails to start, and repeated in-process invocations do not accumulate listeners. Core installs no signal listener and never exits the process.

18. **Readline Ctrl-C behavior.** When readline receives its own `SIGINT` event while a TTY gate is open, the CLI closes that readline handle and routes the interruption through the command’s process-signal path. It does not interpret Ctrl-C as an empty gate answer, `abort`, `failed`, or `undecided`.

19. **Error routing.** Expected `FlowError` and `IntegrationError` failures print their message through the CLI’s existing immediate error path and exit `1` without an unexpected stack. Other thrown values continue through the existing top-level unexpected-error handler. A core terminal event with status `failed` exits `1` without requiring core to throw.

20. **Inherited `--base` regression coverage.** Workspace CLI tests translate all seven relevant scenarios from `spike/test/q0077-base-flag.js`. Together with existing core coverage, they prove that the base override moves only the diff anchor, a bare base is refused, explicit-ref diagnostics attribute the value to `--base`, and rework merges continue from the configured branch.

21. **Inherited review-fix coverage.** Workspace CLI tests translate the remaining binary half of `spike/test/q0034-review-fixes.js`: a `FlowError` encountered through `quorum run` uses the expected human-readable message and exit `1`. Existing `packages/cli` coverage for the run-history portions remains intact.

22. **Gate classification coverage.** CLI tests exercise all five CLI gate-reader outcomes: scripted answers exhausted without a TTY and TTY closure before an answer exit `3`; invalid scripted input, empty interactive input, and unrecognized interactive input exit `1`. Integration coverage also proves that no answer channel in core is `undecided`, while invalid answer envelopes and stale gate IDs remain `failed`. Tests include an empty-message `GateUnansweredError` or equivalent type-focused case so that message-text classification cannot satisfy them.

23. **Port parity register.** In the same change, `packages/core/src/spike-parity.test.ts` reclassifies the transferred binary halves of `q0077-base-flag.js`, `q0034-review-fixes.js`, and `q0040-undecided.js` to their new `packages/cli` carriers. Its pinned source line totals and classifications are re-derived from the resulting files rather than manually offset.

24. **Authoritative spike remains unchanged.** No file under `spike/src/` or `spike/test/` is edited or deleted. The spike suite remains the behavioral witness until cutover. If satisfying these criteria appears to require changing `spike/src/`, implementation stops and reports the conflict for the parent ticket’s mirror-and-re-record decision path.

25. **Quality verification.** The implementation is TypeScript strict, introduces no `any`, no unjustified `@ts-ignore`, and no deprecated API. After installing both dependency trees as prescribed by `harness/rules.md`, `npm test --prefix spike`, `pnpm lint`, and `pnpm turbo run test --force` pass. CLI tests build their own repositories and set any Git identity they require; their verdict does not depend on the developer’s Git configuration or pre-existing ignored directories.

26. **Cross-cutting product checks.** The completed change satisfies the following checklist:
    - **BYOS:** no subscription-secret input path, fixture, documentation, or example is added; adapter checks remain owned by existing adapter code.
    - **Worktree safety:** the CLI delegates all worktree and branch safety to core and never writes a flow’s code changes into the user’s working tree.
    - **Gate behavior:** human-gated defaults, ordered explicit answers, and the `human-locked` restriction remain intact.
    - **Files and schemas:** no new persistent file format or schema is introduced; flow, ticket, event, and run-history formats remain owned by their existing packages.
    - **Cross-vendor rule:** directory linting runs before adapter override, so the override cannot conceal an invalid declared flow.
    - **Product-agnostic behavior:** rendering and routing contain no SaaS-specific or vendor-specific branch.
    - **Cold-clone impact:** the workspace-local and locally packed CLI paths gain `quorum run`; no requirement or output claims public-registry `npx quorum` support.

## Non-goals

- Changing `runFlow` behavior or adding domain logic to `packages/cli`.
- Modifying, deleting, or weakening any file under `spike/src/` or `spike/test/`.
- Fixing the known `regressed` exit-code defect, unknown-command success behavior, traversing `dirOf`, silent frontmatter handling, adapter probe crash, or product name in the BYOS refusal.
- Adding a new gate answer, resumable or suspended runs, or treating `undecided` as an answer.
- Allowing `--auto` to pass a `human-locked` gate.
- Adding JSON output for `run`, changing event schemas, adding timestamps or sequence numbers, or persisting CLI-only state.
- Adding an adapter, changing the adapter contract, or adding vendor-specific rendering.
- Adding budget enforcement.
- Adding the final emitted binary or package-distribution setup owned by Q-0096, or claiming public-registry installation.
- Adding a Studio gate screen, daemon signal handling, remote execution, multi-user behavior, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.
- Updating README onboarding unless a separate documentation ticket assigns it.

## Open questions

1. **None blocking.** The ticket and existing decisions settle the potentially ambiguous behaviors: both `SIGINT` and `SIGTERM` use exit `130`; `regressed` continues to exit `0`; `--auto` can end `undecided` only when it reaches a `human-locked` gate without an available answer; and gate classification is by `GateUnansweredError` type rather than message text. Any proposed change to those rulings requires a separate decision rather than an implementation assumption.

## Risks

- **Signal race:** a signal can arrive while readline is closing or while core is emitting its terminal event. Incorrect ordering could produce two terminal actions or misclassify the run as `undecided`. Tests must cover interruption while a gate is pending and listener cleanup afterward.
- **Premature process exit:** exiting immediately on a signal before core consumes the abort could prevent run history and terminal events from being persisted. The CLI must allow core’s interrupted conclusion to finish before applying exit `130`.
- **Event backpressure:** failing to consume the lazy iterable continuously can deadlock a gate or leave core work unobserved. Rendering and gate answering must occur inside the single asynchronous iteration.
- **Flag mutation:** sharing or mutating the parser’s `gateAnswers` array could leak consumption between tests or command invocations. The run handler needs an invocation-local queue.
- **Lint/override ordering:** applying `--adapter` before linting could make a valid cross-vendor flow appear single-vendor or conceal the declarations the linter is meant to evaluate.
- **Base-scope regression:** reusing the base override as general repository configuration could change the integration or rework merge source, violating the seven inherited scenarios.
- **TTY test portability:** forced-TTY tests can become dependent on the host terminal. Fixtures must control TTY and readline behavior themselves so their verdict is a property of the commit.
- **Parity drift:** translating binary coverage without updating and re-deriving the parity register would leave the parent cutover record claiming that completed work is still owed.
