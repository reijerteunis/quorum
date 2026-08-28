# Requirements — Q-0050: core/engine — the run loop, routing and the event stream

## Problem

The run loop is the stateful coordinator for every flow. It routes steps, enforces bounded backward edges, asks gate questions, advances or regresses ticket stages, persists counters and terminal outcomes, and restores the ticket branch after an unsuccessful run. A mistake here can spend additional subscription usage, advance a ticket without proof, refund an exhausted loop, or leave the repository in a misleading state.

The spike couples this behavior to a CLI-owned `ui` object. The port must instead expose `runFlow(opts): AsyncIterable<Event>` using the event contract in `packages/shared`, so the CLI and the future local daemon can consume the same ordered stream. This is the port’s one authorised interface change. The current event contract describes a gate question but does not define how its answer returns to a suspended run, and it does not contain a structured run-level terminal event. Those two contract decisions must be settled before implementation.

Except for the event-stream interface, this ticket is a behavior-preserving port. Known defects in git diagnostics and discard reporting must be reproduced and reported unless an accepted, dated decision explicitly authorises a coordinated change to both the spike and the port after Q-0048 lands.

Surfaces touched: `packages/core` public API and engine module; the shared in-memory event contract as a dependency and, only if an accepted decision widens it, `packages/shared`. The CLI, Studio, `harness/` flow files, `backlog/` ticket files, `runs.log`, and `.quorum/runs/` are consumers or observable effects but are not implemented as new surfaces in this ticket.

## User story

As a **solo maintainer**, I want one run loop to emit an ordered, vendor-neutral event stream and enforce gates, loop limits, stage changes, and terminal bookkeeping in core, so I can run unattended work without silently spending an extra iteration or advancing failed work.

As a **cold-clone adopter**, I want dry runs and failed runs to leave my working tree and ticket state safe, with failures that state their cause, so I can trust the first run without understanding the engine internals.

As an **adapter contributor**, I want adapter events to pass through one documented run event contract with the engine adding only run context, so a new adapter does not require vendor-specific changes in the CLI, local daemon, or Studio.

## Acceptance criteria

1. **Public run contract and validation — core API**

   1. `packages/core` exports `runFlow(opts): AsyncIterable<Event>` and the supporting public types needed to start, observe, answer, cancel, and identify one run.
   2. Every yielded value passes `packages/shared`’s strict run-event schema. Core does not declare a second event schema.
   3. Before starting a run, core rejects a ticket whose current `stage` differs from the selected flow’s `consumes`. The error names the ticket id, current stage, flow name, and required stage.
   4. The run uses the supplied ticket, backlog, harness directory, repository directory, configuration, `auto`, and `dry` settings. It does not obtain hidden state from a CLI or daemon singleton.
   5. The exact gate-answer channel and structured terminal representation satisfy AC-6 and AC-12 after blocking open questions OQ-1 and OQ-2 are decided.

2. **Event contents — core event stream**

   1. An adapter `spawn`, `stdout`, or contract-layer `retry` event is yielded with the executing `stepId` added and no other vendor-specific field added by core.
   2. An adapter event’s relative order is preserved for its step. Core does not promise ordering between events produced concurrently by different members of a parallel group.
   3. The spike’s `ui.step`, `ui.done`, `ui.info`, `ui.warn`, and `ui.gate` observations are represented respectively by the shared `step`, `done`, `info`, `warn`, and `gate` event shapes, preserving their human-readable messages.
   4. `step` is emitted before the corresponding step begins observable execution. `done` is emitted only after that step completes successfully. A failed or aborted step does not emit a misleading `done` event.
   5. Each `gate` event carries `kind`, `reason`, the absolute `ticketDir`, and `retry` only when retry is available.
   6. Vendor identity is limited to the shared event contract’s open `vendor` label. No event field or engine branch is specific to Claude, Codex, or another adapter.
   7. Unknown event fields are rejected rather than silently discarded.
   8. The stream is live and in memory. It is not persisted or replayed by this ticket.

3. **Flow and role loading — core API**

   1. `loadFlow(file)` reads YAML, attaches the source file path, validates the result with the shared flow schema and flow linter, and returns the validated flow or a cause-bearing error.
   2. `loadFlowByName(name, harnessDir)` resolves exactly `harnessDir/flows/<name>.yaml` and applies the same validation as `loadFlow`.
   3. `loadRole(name, harnessDir)` resolves exactly `harnessDir/roles/<name>.md`, parses its frontmatter and body, and fails with the missing or invalid role named.
   4. Loading does not silently substitute a default flow or role after a read, parse, or validation failure.

4. **Step routing — core run loop**

   1. Sequential steps execute in declared order. A parallel group waits for all its members before routing onward unless a member produces a failure route that ends or redirects the group under the preserved spike behavior.
   2. `runStep` dispatches author-declared gates, parallel groups, script steps, integrate steps, fan-out steps, and adapter steps according to the validated flow shape.
   3. A same-flow `goto` resumes at the named earlier step and increments the run’s iteration variable once per traversal.
   4. A `goto` target that cannot be found after validation fails with the source step and target named; it does not continue at an inferred position.
   5. `interpolate` replaces a known `{key}` with its value and leaves an unknown placeholder unchanged. It does not silently replace an unknown value with an empty string.
   6. `writesOf` returns `output.write`, when present, followed by every entry in `output.writes`, without inventing paths.

5. **Bounded backward edges and exhaustion — core run loop**

   1. Each failed backward edge increments only its configured counter, or the preserved default counter `<flow-name>.<step-id>` when none is configured.
   2. While the incremented count is at most `max_iterations`, the run emits a warning naming the step, current count, limit, and target, then traverses the configured `goto`.
   3. When the count exceeds `max_iterations`, the run records an `exhausted` history event with the current counters and presents an engine-generated `human-locked` exhaustion gate.
   4. `--auto` never bypasses an exhaustion gate.
   5. An `advance` answer accepts the current result and continues without changing any counter.
   6. A valid `retry` answer at an exhaustion gate sets that gate’s counter to exactly `max_iterations`, changes no other counter, appends a `runs.log` entry naming the counter and grant, and authorises exactly one more traversal to the gate’s retry target.
   7. If that grace traversal fails, the counter increments past the limit and the exhaustion gate is presented again.
   8. `retry` is not accepted at a gate that has no retry target.

6. **Gate interaction and answer ordering — core API**

   1. A gate that is neither automatically advanced nor skipped by a dry run yields exactly one `gate` question and suspends further flow execution until that same run receives an answer, is cancelled, or is interrupted.
   2. The answer channel correlates an answer to the pending run and gate without parsing event text. A stale, duplicate, or answer-for-another-gate value fails explicitly and cannot advance the run.
   3. Accepted answers are the full words allowed for that gate. A missing, empty, invalid, or disallowed answer fails rather than inventing a decision.
   4. In non-interactive use, supplied gate answers are consumed once, in order, by the first gates actually encountered. Engine-generated exhaustion gates participate in the same sequence.
   5. An author-declared `auto` gate advances without requesting an answer. With run-level `auto` enabled, an author-declared gate advances unless it is `human-locked`.
   6. A `human-locked` gate cannot be overridden by run-level `auto`.
   7. A dry run emits an `info` event saying that a gate would pause and neither yields an answer-requiring gate nor consumes a supplied answer.
   8. `advance`, valid exhaustion `retry`, and abort behavior are appended to `runs.log` for a real run before execution continues or terminates.

7. **Cross-flow regression — core run loop**

   1. For `goto: flow:<name>`, core loads and validates the named flow and derives the target ticket stage from that flow’s `consumes` value.
   2. The target stage is not hard-coded and is not derived from the current flow’s `consumes` or `produces`.
   3. The current run finishes with status `regressed`, persists the counter, count, limit, remaining traversals, target flow name, stage before, and stage after, and emits the corresponding warning and terminal observations.
   4. The target flow is not run immediately. A later invocation may select it using the regressed ticket stage.
   5. A missing or invalid target flow fails with its name and cause and does not change the ticket stage.

8. **Stage transitions — backlog surface**

   1. Only terminal status `completed` changes the ticket stage to the current flow’s `produces`.
   2. Only terminal status `regressed` changes the ticket stage to the named target flow’s `consumes`.
   3. Failed, aborted, and interrupted runs retain the stage at which the run terminated.
   4. A failure during run-history initialisation receives a failed terminal `runs.log` entry and does not advance the stage.
   5. No gate question alone advances a stage.

9. **Dry-run immutability — CLI-observable core behavior**

   1. `dry: true` traverses the same routing machinery as a real run, subject to the dry behavior of each step; it is not a separate simplified flow interpreter.
   2. A dry run invokes no adapter and executes no script, integrate, git mutation, branch reset, worktree mutation, or gate answer.
   3. A dry run writes no ticket frontmatter, artifact, history entry, `runs.log` line, run manifest, occurrence file, branch, commit, or worktree.
   4. A dry run does not change stage or counters, including the in-memory ticket object supplied by the caller.
   5. The event stream still reports the steps and gates that would be encountered so a caller can display the dry run.
   6. Q-0051 owns run-level diff preflight. This ticket must expose the same run path and extension point; it does not implement Q-0051’s preflight behavior.

10. **Working-tree and branch safety — core**

   1. A flow never writes generated code or agent changes into the user’s working tree. Code-writing execution uses worktrees under `.harness/worktrees/` and branches beside `harness/<ticket-id>/integration` through the fan-out and git APIs supplied by Q-0048.
   2. Before a real run can mutate the ticket branch, core captures its starting head when the existing helper returns one.
   3. On failed, aborted, or interrupted termination, core restores the ticket branch to its captured starting head when the preserved helper reports both heads and they differ.
   4. Completed and regressed runs do not perform that rollback.
   5. Task branches are not rolled back by `finish()`. This known gap is preserved under charter register row 20 and is covered by a regression test citing this criterion.
   6. Ticket state and engine-owned artifacts remain in the main project’s `backlog/`; agent edits to `backlog/` inside a worktree are not accepted as authoritative.

11. **Counters and durable terminal bookkeeping — backlog and run-history surfaces**

   1. Every real run receives a run id greater than any id found in either ticket history or `runs.log`, so a failed prior run’s id is not reused.
   2. Every real terminal outcome—completed, regressed, failed, aborted, or interrupted—persists the current counter map before control returns, the iterator closes, an error propagates, or interruption exits the process.
   3. Every real terminal outcome appends a terminal `runs.log` line containing run id, status, stage before and after, cost, tokens, and a cause when one exists.
   4. Every real terminal outcome finalises its run manifest, when initialisation succeeded, with status, end time, non-negative duration, stage before and after, and roll-up.
   5. Active occurrences are finalised as failed or interrupted before the run’s terminal record is written.
   6. An interrupted run does not refund counters, including interruption while waiting at a gate.
   7. Completed and regressed runs append ticket history using the preserved outcome fields. Whether failed, aborted, and interrupted runs also remain in ticket frontmatter history is preserved exactly from the spike; `runs.log` and the run manifest remain the audit sources for every attempt.
   8. `recordEvent` persists counters before recording a non-terminal history event such as exhaustion.
   9. Dry runs satisfy none of the persistence clauses above because AC-9 requires zero mutation.

12. **Stream termination, cancellation, and failures — core API**

   1. A completed, regressed, or aborted run produces one unambiguous structured terminal result before or as iteration completes; a consumer does not need to parse an `info.message` to learn status, stage, cost, or run id.
   2. A failed run persists its terminal bookkeeping, emits the available cause-bearing warning or terminal observation, and then rejects iteration with a typed error whose message names the cause.
   3. Cancellation while executing a step or waiting at a gate reaches the same interrupted finalisation path, persists counters and active occurrence state, and stops further events and steps.
   4. Signal handling is scoped to the active run and removed on every exit path. Repeated runs do not accumulate signal listeners.
   5. An iterator consumer stopping early does not leave an unobserved run continuing indefinitely. The precise cancellation semantics are part of OQ-1.
   6. Error presentation is consistent for `FlowError`, `IntegrationError`, adapter failure, git failure, script failure, invalid structured output, and unexpected errors: the caller receives a concise sentence with a non-empty cause, while retained diagnostic detail remains available in the applicable occurrence output or error cause.
   7. Invalid structured output is retained beside the ticket through the Q-0046 contract path, stops the run, and is never replaced by a default value.

13. **Preserved git-answer conflation — core caller behavior**

   Unless an accepted decision authorises the coordinated fix described in AC-16, tests must separately induce an absent branch and an operational git failure at every listed caller and prove the following preserved behavior:

   1. At fan-out base synchronisation, `branchExists(ticket-branch)` returning false causes “ticket branch does not exist yet” to be reported as skipped. A git failure produces the same result as an absent ticket branch.
   2. At fan-out base synchronisation, `branchExists(base)` returning false causes “base does not exist” to be reported as skipped. A git failure produces the same result as an absent base branch.
   3. When integrate resolves task branches, a branch for which `branchExists` returns false is removed from the merge list. A git failure is therefore treated the same as an absent task branch.
   4. Before integrate syncs the configured base, `branchExists(base)` returning false omits the base merge. A git failure is therefore treated the same as an absent base branch.
   5. Where parallel-wave or integration routing filters existing branches through `branchExists`, an operational git failure omits that branch exactly as an absent branch does.
   6. If `branchHead` cannot read the ticket branch at run start, core records no starting head. An operational git failure is treated the same as an absent branch, so later unsuccessful termination cannot restore that branch through `finish()`.
   7. If `branchHead` cannot read the ticket branch during integration evidence, the evidence reports the preserved “new” representation. An operational git failure is treated the same as an absent branch.
   8. If `branchHead` cannot read the current ticket-branch head during unsuccessful finalisation, rollback is omitted. An operational git failure is treated the same as an absent branch.
   9. Each test and the implementation’s authority comment identifies this as preserved behavior under Q-0050, not as proof that git successfully established absence.

14. **Preserved discard-report defects — core caller behavior**

   Unless AC-16 is activated:

   1. When `commitAll` reports discarded `backlog/` paths, the run emits the same discard warning and continues whether checkout and clean succeeded or failed. The caller does not gain a new success/failure signal in this port.
   2. A failed checkout or clean is therefore still reported as though the worktree edits were discarded. A regression test pins that behavior and identifies it as a preserved defect.
   3. For a porcelain status whose first line is a modified-but-unstaged path, the first reported path retains the spike’s loss of its first character; untracked and later paths retain their existing behavior.
   4. The discard list remains a human-facing report and is not used as a path to open, delete, or mutate a file.
   5. These defects do not weaken the separate rule that agent-authored `backlog/` state is non-authoritative.

15. **Preserved merge diagnostics — core caller behavior**

   Unless AC-16 is activated:

   1. A content conflict may return populated `conflicts` with `error: ''`; the run names the conflicted paths through the preserved merge-failure formatting.
   2. A merge failure with no conflicted paths may also return `error: ''`. The run preserves the spike’s resulting empty diagnostic rather than selecting stdout or `Error.message` in passing.
   3. Tests of merge diagnostics assert that their subject is non-empty before making suffix or formatting assertions; a vacuous check over an empty string must not report success.
   4. The known empty-error behavior is recorded as a defect and risk, not described as an adequate cause-bearing failure under AC-12.6. This explicit exception remains until AC-16 is activated or a follow-up ticket is accepted.

16. **Authority required to fix inherited fan-out defects**

   1. Q-0050 does not fix AC-13, AC-14, or AC-15 unless a dated decision or accepted ticket erratum authorising the behavior change exists before implementation.
   2. If authorised, implementation waits until Q-0048 has landed and changes `spike/src/fanout.js` and `packages/core/src/fanout/` together, with equivalent tests in both trees, so the spike remains an independent witness of the deliberate change.
   3. The authorised contract must distinguish “provably absent” from “git could not answer.” Git exit 1 is not inferred from a timeout, missing binary, spawn failure, or other operational failure.
   4. For every core caller listed in AC-13, the authorising decision must specify whether an indeterminate git answer stops the run or preserves the current route, and what cause and human remedy are emitted.
   5. For `commitAll`, the decision must specify how checkout and clean failures affect continuation and discard reporting, and whether the first-path parsing defect is corrected in the same change.
   6. For `mergeInto`, the decision must choose and document the diagnostic source for a failure with no conflicted paths.
   7. Without that authority, the port preserves the defects, reports them in review, and leaves the issue open.

17. **`--auto` behavior — core**

   1. `auto` affects only gates that the gate contract permits it to advance.
   2. It does not change step order, backward-edge counters, failure routing, stage transition rules, terminal persistence, or dry-run mutation rules.
   3. An automatically advanced gate emits an `info` event naming its kind and does not emit an answer-requiring gate event or consume a scripted answer.
   4. Exhaustion and author-declared `human-locked` gates remain answer-requiring.

18. **TypeScript, package boundaries, and tests — workspace**

   1. The implementation is strict TypeScript with no `any`, no unjustified `@ts-ignore`, and no newly used deprecated API.
   2. Core imports event, flow, ticket, role, and step-output types or schemas from `packages/shared`; `shared` imports nothing from core.
   3. Exported symbols and non-obvious interface fields have contract-focused JSDoc. Preserved defects carry one authority line in the form required by `harness/rules.md`.
   4. Unit tests cover the helpers and every branch in AC-1 through AC-17 that this ticket owns.
   5. Ported engine-level regression tests remain behaviorally equivalent to the spike except where the accepted event-stream contract requires a deliberate difference.
   6. The mock-adapter end-to-end suite remains green.
   7. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass without changing lint scope or suppressing failures.

19. **Cross-cutting product checks**

   1. **BYOS:** no production path, test, fixture, type, event, or documentation example introduced by this ticket accepts subscription secrets or adds direct vendor API access. Adapter subscription checks remain outside this run-loop ticket.
   2. **Worktree safety:** AC-10 is enforced by core and tested against the actual user working tree, not asserted only through a mocked UI.
   3. **Gate behavior:** AC-5, AC-6, and AC-17 cover default-human, `auto`, `human-locked`, exhaustion, answer order, interruption, and retry budget behavior.
   4. **Files and schemas:** ticket state, `runs.log`, and run manifests retain their existing formats. Events are validated in memory against the single shared schema and are not persisted.
   5. **Lint rules:** this ticket does not change flow lint semantics owned by Q-0044. Invalid loaded flows still fail before execution.
   6. **Cross-vendor rule:** this ticket preserves adapter identity and ordering needed by the linter and panel execution but does not redefine cross-vendor eligibility.
   7. **Product-agnostic:** engine behavior and tests contain no product-specific SaaS rule.
   8. **Cold-clone impact:** no new setup step, service, subscription configuration, or user-managed state is introduced. The interface change is internal until CLI cutover.

## Non-goals

- Implementing Q-0051’s full run preflight, diff evidence, or CLI command wiring.
- Implementing Q-0039’s one-run-per-ticket lock unless it lands in the spike before this port’s freeze baseline and is explicitly added to Q-0050’s accepted scope.
- Implementing Q-0040’s `undecided` gate answer unless it lands in the spike before this port’s freeze baseline and is explicitly added to Q-0050’s accepted scope.
- Editing or deleting `spike/**` without the prior authority and coordinated-change conditions in AC-16.
- Fixing task-branch rollback, branch-answer conflation, failed discard reporting, the first discarded path, or empty merge diagnostics in passing.
- Porting another child ticket’s module, including fan-out implementation, adapters, contracts, lint, run-history storage, backlog storage, or git/worktree primitives beyond the engine-facing integration required here.
- Changing flow, role, ticket, step-output, run-manifest, or `runs.log` file formats.
- Persisting, replaying, querying, or migrating the event stream.
- Implementing the CLI `quorum` binary, local daemon, WebSocket transport, Studio gate screen, or run-history UI.
- The Q-0058 cutover or removal of the spike.
- Enforcing budget caps.
- Adding vendor JSONL-derived `tool` or `text` events without a separate accepted contract change and producer.
- Multi-user operation, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter, desktop shell, or native Windows support.

## Open questions

1. **Blocker — What is the run-scoped input and cancellation contract?** Owner: Q-0050 principal architect during solutioning. The contract must state how a caller answers the currently pending gate, how answers are correlated, how scripted answers are queued, how cancellation works while awaiting a gate or adapter, and what happens when an `AsyncIterable` consumer stops iteration early. Candidate shapes include an answer/cancel controller returned alongside the iterable, callbacks supplied in `opts`, or async input sources supplied in `opts`. This changes the public core contract and must be settled before QA-red.

2. **Blocker — How is the structured terminal outcome represented?** Owner: Q-0050 principal architect with Q-0041/shared-contract owner. The existing shared union has step-level `done` and unstructured run-level `info`, but no run-level terminal event. Decide whether to widen the shared union with a run terminal event, expose a typed iterator return value through a stronger public type, or use another structured mechanism that remains compatible with `runFlow(opts): AsyncIterable<Event>`. The decision must let the future WebSocket and gate screen learn terminal status without parsing prose and must define failure behavior. If `packages/shared` changes, scope authority must be recorded because it is Q-0041’s module.

3. **Blocker — Which pre-freeze version of Q-0039 and Q-0040 is authoritative for this port?** Owner: maintainer. Confirm whether either ticket will land in `spike/src/engine.js` before the freeze SHA. Q-0050 must port the authoritative spike behavior, but may not independently design either feature.

4. **Should the known fan-out defects be fixed through the AC-16 decision route or preserved for a follow-up?** Owner: maintainer/product manager. Default: preserve and report. Choosing to fix them requires an accepted dated decision before implementation, Q-0048 to have landed, explicit caller behavior for indeterminate git answers, and coordinated spike/core changes.

5. **Does `aborted` remain a distinct terminal status from `interrupted` and `failed` in the public outcome contract?** Owner: Q-0050 principal architect. The spike writes `aborted` for a gate abort, while the ticket’s safety summary lists completed, regressed, failed, and interrupted. The event and run-result contract must name the complete status union without collapsing an existing persisted value silently.

6. **Should failed, aborted, and interrupted attempts remain in ticket frontmatter `history`, or only in `runs.log` and the run manifest?** Owner: product manager and run-history owner. AC-11 preserves the spike pending confirmation because changing ticket history is a file-format and observable-behavior decision.

## Risks

- An event stream with no answer channel can display a gate but cannot resume it; an answer callback hidden inside core would recreate the CLI coupling this port is intended to remove.
- A stream with only prose for terminal state forces the local daemon and Studio to parse human-readable messages, making later wording changes behavioral API changes.
- Async iteration creates cancellation hazards: abandoning a consumer could otherwise leave an adapter, gate wait, signal listener, or worktree operation running without an observer.
- Concurrent step events have no global deterministic order. A consumer that assumes one could display misleading parallel execution unless the contract limits ordering explicitly.
- Preserving the known git conflations can misreport an operational failure as an absent branch and skip synchronization, filtering, evidence, or rollback. This becomes more costly under unattended daemon runs.
- Preserving failed discard reporting can tell a maintainer that agent changes were removed when they remain in a worktree.
- Preserving empty merge diagnostics conflicts with the product rule that failures name their cause. The charter requires preservation unless a prior decision authorises the coordinated fix, so this remains an explicit exception and release risk.
- Signal handling implemented per iterator without disciplined cleanup can duplicate terminal records or exceed listener limits across repeated runs.
- Q-0039 and Q-0040 both change this code. Porting before their disposition risks either rework or accidental divergence between the spike and core.
- Q-0051 depends on this run context. An unstable public contract here blocks preflight, CLI, server, gate-screen, and run-history consumers downstream.
