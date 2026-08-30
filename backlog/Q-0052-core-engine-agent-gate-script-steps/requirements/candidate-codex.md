# Q-0052 — core/engine agent, gate and script steps

## Problem

`packages/core` can route a flow, but it cannot execute agent or script steps, and its declared gate-step behavior is incomplete. Those step kinds still reject as owned by Q-0052. As a result, the CLI cannot yet run the `qa-red`, `qa-final`, deploy, or chore flows through `core`.

The port must preserve the observable behavior of `spike/src/engine.js` without importing or editing `spike/**`. It must also connect the run-history and event seams introduced by Q-0050, exercise the strict-schema rule deferred by Q-0046, preserve the cross-vendor model boundary assigned by Q-0047, and retain the run-scoped write behavior introduced by Q-0057.

Gates are safety boundaries. Ordinary gates pause by default, `auto` is opt-in per gate, and a `human-locked` gate cannot be bypassed. A bounded loop that exhausts presents an engine-generated exhaustion gate and requires an explicit valid answer. Silence or malformed input must never become permission to continue.

This ticket touches the `packages/core` engine and its Vitest fixtures. It affects the future `quorum` CLI only through the core API; implementing or changing the binary is outside this ticket.

## User story

As a **solo maintainer**, I want agent, gate, and script steps to execute through `packages/core` with the same safety and file behavior as the spike, so that I can run the existing flows without losing human control, structured-output validation, run history, or cost reporting.

As a **cold-clone adopter**, I want failed commands, invalid agent output, unavailable gate answers, and exhausted loops to stop explicitly, so that a flow cannot silently proceed or write an invalid result while I am learning the product.

As an **adapter contributor**, I want prompt, schema, adapter, and model selection to pass through vendor-neutral engine contracts, so that an adapter receives only an explicitly permitted model and no vendor-specific behavior leaks into the engine.

## Acceptance criteria

1. **Agent-step execution replaces the Q-0052 placeholder.** On the `packages/core` surface, a non-gate step that is neither `script`, `integrate`, nor `fan_out` executes as an agent step. The implementation ports `runAgentStep` and its required `buildPrompt`, `schemaFor`, `resolveModel`, `reviewRound`, and `formatCost` behavior. `integrate` and `fan_out` remain unavailable with ownership attributed to Q-0053.

2. **Prompt construction uses the declared sources in deterministic flow order.** `buildPrompt` includes the harness context, the selected role file, and each input declared by the step, using the existing core loaders and diff subsystem. Missing required input fails with a clear error rather than being omitted or replaced with invented content. Prompt construction does not write to the user's working tree.

3. **Input interpolation deliberately accepts YAML scalar values.** Every Q-0052 call site converts a possibly non-string YAML value with `String(...)` before calling the typed `interpolate(string, vars)` function. This applies at minimum to `step.run`, `step.branch`, every declarative write destination such as `s.into`, and every `site.input.diff`. A fixture with a numeric value such as `branch: 2` proves that the value is interpolated as text and does not cause a TypeScript escape hatch or implicit coercion inside `interpolate`.

4. **Dry-run deferred diffs are reported by the existing prompt placeholder.** When a dry run reaches an input range recorded as deferred and no materialized bytes are available, `buildPrompt` includes text stating that the named range is produced by an earlier step and will be materialized after that step runs. This placeholder is the required report that the subject was skipped; it must not claim that examination passed. No additional event or decision entry is required by this ticket.

5. **The known preflight cache defect is preserved and cited.** When `ctx.diffInputs` already contains an entry for a range, `buildPrompt` continues to prefer that cached entry even if the site was classified as deferred. The read site contains one short authority comment in the form `Why: preserved defect, see Q-0038 E-3(b) / Q-0078.` A focused regression test pins this current cached-byte behavior. The discriminating red scenario and the eventual behavior change belong to Q-0078.

6. **Agent write paths retain the run identifier.** For every declarative agent-step write, the destination is interpolated using the complete run variables, including `{run}` from `nextRunId`. A fixture using `review/chore/run-{run}/chore-iter-{iter}.md` proves that run 2 writes below `run-2` and does not fall back to the legacy flat review path. The implementation does not change how `nextRunId` is derived.

7. **Generated schemas satisfy strict structured-output rules.** For every distinct schema shape emitted by `schemaFor(step)`, a Vitest fixture imports and calls the exported `strictSchemaProblems` helper from `packages/core/test/strict-schema.ts` and asserts that it returns no problems. The test must not copy or reimplement that helper. In every emitted object schema, every declared property appears in `required`, and no undeclared property is accepted where the generated contract is strict.

8. **Agent output is checked against the exact generated schema.** The engine validates the extracted structured result against the same schema instance or semantically identical schema produced for that step. Tests independently cover missing required keys, invalid enum members, unexpected keys where prohibited, and a declared coupling such as an `approve` verdict carrying no findings. Each invalid result fails the step; no value, verdict, finding, or gate answer is defaulted.

9. **Invalid structured output remains an explicit, inspectable failure.** When extracted output violates the generated schema, the unvalidated raw agent text is saved beside the ticket using the established core persistence contract, and the run stops with a message that identifies invalid structured output and where the raw text was saved. Wrapper tolerance remains exclusively in Q-0046's `extractJson`; Q-0052 does not broaden extraction or merge extraction with schema validation.

10. **Adapter and model resolution preserve the cross-vendor boundary.** The resolved adapter honors `ctx.config.adapterOverride` at the existing precedence point. The step's own non-empty `model` always wins. In the absence of a step model, the role's default model is passed only when `role.meta.adapter` equals the resolved adapter name. If they differ, no model is passed, allowing that adapter's CLI to select a model supported by its subscription. Tests cover all three cases, including a role model such as `opus` not reaching a `codex` step. No vendor alias or vendor-specific branch is introduced in core.

11. **Agent occurrences are allocated and registered atomically.** The run-history seam exposes an operation equivalent to `allocateOccurrence(step, kind, fields)` that both allocates an `Occurrence` and registers it as active before adapter or command execution can fail. No caller can allocate an unregistered active occurrence. Agent occurrences retain their exact `prompt.txt` and `output.txt` artifacts and are finalized through the existing run-history contract.

12. **Agent events have the member step id.** An agent step emits the spike-equivalent `step` event before execution begins and emits `done` only after successful completion and output persistence. Adapter-shaped `spawn`, `stdout`, and `retry` events carry the executing step's id. For a `parallel:` group with no group id, a fixture with two emitting members proves that each member's events carry its own id and neither member receives the other's id.

13. **Failed and cancelled agent steps do not emit `done`.** A fixture proves that a schema failure, adapter failure, and cancellation after `step` suppress `done`. Cancellation propagates to the adapter through the run signal, finalizes the active occurrence as interrupted, records the terminal run outcome using the existing lifecycle behavior, and does not advance the ticket stage.

14. **Run-history initialization failure stops before step execution.** If run-history initialization fails, no adapter or script command is invoked, no `step` or `done` event is emitted, and the failure is surfaced through the run stream. Existing terminal persistence behavior is used only where initialization produced the capabilities needed to do so; the engine must not invent a partial manifest.

15. **Agent completion reports cost without locally pricing tokens.** `formatCost` preserves the spike's formatting cases covered by `spike/test/smoke.js:612–618`: monetary cost is presented as money; token-only usage is presented as tokens; and unavailable monetary cost is not rendered as zero. The agent completion message uses this formatter. `formatMoney`, `formatTokens`, and `formatVendorSummary` remain outside core.

16. **Declared gate steps preserve pause policy.** A gate step pauses and publishes a correlated gate question by default. A gate declared `auto` advances without requesting an answer. Run-level `--auto` advances a normal gate but never a `human-locked` gate. A dry run reports that a non-auto gate would pause and advances without waiting or persisting an answer.

17. **Gate answers fail closed.** A waiting gate accepts only a valid answer envelope for its current gate id. Missing answer channels, rejected or unavailable answers, empty answers, invalid envelopes, stale gate ids, answers outside the allowed full words, and disallowed answers each stop with a clear gate error. None is converted to `advance`. Answers are consumed in supplied order, and an accepted answer is recorded once in `runs.log`.

18. **Exhaustion gates cannot be bypassed.** After a bounded loop exceeds its configured limit, the engine presents a `human-locked` exhaustion gate even when run-level `--auto` is enabled. It is not required to be declared as a flow step and allocates no run-history occurrence. It requires an explicit `advance`, `retry`, or `abort`: `advance` continues, `abort` terminates, and `retry` sets only that loop's counter to exactly `max_iterations`, records the decision, and authorizes exactly one further traversal. Missing, empty, invalid, unavailable, stale, or disallowed input stops instead of selecting a decision.

19. **Gate messages use the shared fixture as their oracle.** Tests read `contracts/Q-0050/run-messages.fixture.json` rather than duplicating its strings and assert the four `gate.*` leaves as a shape. This covers both emitted gate `info` messages: auto-advance and dry-run would-pause text.

20. **The port removes the gate test's artificial timer.** `askGate` and its new Vitest fixtures do not create the spike's one-second `signalWindow` timer. The waiting fixture owns a pending promise with its own libuv handle or uses an equivalent deterministic Vitest mechanism. Removing this timer is the sole authorized test-driven behavior cleanup in Q-0052; other spike behavior remains unchanged.

21. **Script steps execute real project commands.** A step with `type: script` interpolates its declared command and branch values, executes the command through the existing `runCommand` abstraction in the intended repository or worktree context, and returns the spike-equivalent step result. It does not introduce a shell execution path outside `runCommand`.

22. **Script commands inherit command timeouts and cancellation.** The script step passes the configured command timeout and run cancellation signal to `runCommand`. A hanging command is terminated through the existing timeout behavior and fails clearly. A cancelled script finalizes its active occurrence as interrupted and does not advance the ticket stage.

23. **Script occurrences and events match agent-step lifecycle rules.** A script occurrence is allocated and registered before execution. The step emits `step` before command execution and `done` only after a zero-exit completion and required persistence. Non-zero exit, timeout, cancellation, or persistence failure suppresses `done`. Emitted step-scoped events carry the script step's id.

24. **Script failure reaches both deferred Q-0050 coverage halves.** New core fixtures use a failing script step to prove: (a) a loop can fail once during a dry run and charge the correct counter before routing; and (b) the disk-level `handleFail` ordering promised by Q-0050 AC-6d is observable through files written by the real core caller. Tests do not use gate dry-run short-circuiting as a substitute for a failing step.

25. **Step completion is ordered after durable output.** For agent and script steps, files, occurrence artifacts, manifest state, and required ticket/run log updates complete before `done` is emitted. If any required persistence operation fails, the step fails and emits no `done`. A test observes both event order and disk state rather than asserting calls alone.

26. **Failure preserves completed parallel work.** Agent members of a `parallel:` group settle together as in the spike. If one or more members fail, the engine reports every failed member and identifies successful members whose ticket artifacts were retained. It does not cancel, delete, or disguise already completed member output. Fan-out semantics remain Q-0053's responsibility.

27. **No step execution writes to the user's working tree.** Tests prove that code-writing agent operations and project commands execute only in the repository/worktree context supplied by core, with execution worktrees under `.harness/worktrees/`. Persistent run data remains under the ticket folder or `.quorum/` according to the existing contracts. Q-0052 does not weaken the worktree guards supplied by earlier tickets.

28. **BYOS remains unchanged.** No implementation, test, fixture, schema, error, or documentation in this ticket accepts or demonstrates an API-key path. Agent execution uses the selected adapter's existing subscription-authenticated CLI contract. Adapter `check()` and probe behavior are not reimplemented in the engine.

29. **The port remains product-agnostic and vendor-neutral.** Prompts, schemas, events, errors, fixtures, and example flows contain no product-specific SaaS logic. Vendor-specific parsing, flags, and event fields remain inside adapters. The core branches only on adapter identity where AC-10 requires equality to enforce the cross-vendor model rule.

30. **The port has independent workspace coverage.** New tests are Vitest tests under the workspace and import only `packages/**` code. No test imports `spike/src/engine.js`, edits `spike/**`, or treats the spike suite as coverage for the port. All changed TypeScript passes strict type checking without `any`, `@ts-ignore`, or a newly used deprecated API.

31. **Regression verification is complete after dependencies are installed.** From a clean checkout, verification installs workspace and spike dependencies using the repository-prescribed frozen commands, then passes `npm test --prefix spike` and `pnpm turbo run test --force`. The independent spike suite remains unchanged and acts as the frozen behavior witness.

32. **Cold-clone behavior does not add setup.** The port adds no dependency, configuration key, prompt, subscription step, or manual setup requirement for a cold-clone adopter. If implementation proves that a new dependency is unavoidable, work stops for an accepted scope change and the required architecture decision; it is not added under this criterion.

## Non-goals

- Fan-out step execution, integrate step execution, or their module behavior; Q-0053 owns them.
- Editing, deleting, importing from, or otherwise changing `spike/**`.
- Implementing or cutting over the `quorum` binary; Q-0010 owns the binary and Q-0058 owns cutover.
- Persisting the event stream beyond the persistence already required for tickets, run history, raw output, and command artifacts.
- Changing adapter CLI flags, probes, subscription checks, output extraction, or vendor event mapping owned by Q-0046 and Q-0047.
- Moving structured-answer wrapper tolerance out of `extractJson` or weakening schema validation to accommodate vendor wrapping.
- Implementing fan-out or integrate occurrence behavior.
- Adding local model pricing or porting `formatMoney`, `formatTokens`, or `formatVendorSummary` from `spike/bin/harness.js`.
- Fixing `nextRunId` collisions, its dependence on editable history, or concurrent run allocation; Q-0039 remains the owner.
- Fixing the deferred-diff cache defect described by Q-0038 E-3(b) and Q-0078. This ticket preserves and cites it.
- Adding a preflight `info` event for a deferred diff. The existing dry-run prompt placeholder is the skipped-subject report for this scope.
- Changing task-branch rollback, gate answer vocabulary, loop-budget policy, or any other preserved behavior to simplify a test.
- Budget-cap enforcement.
- Multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.
- Changes to flow file formats or adapter contracts.

## Open questions

1. **Blocker — none identified.** The required gate policy, output contract, model precedence, event ownership, run-history seam, and dry-run reporting decision are fixed by prior decisions and this requirement.

2. **Implementation owner: core engineer.** What internal module split keeps `routing.ts` focused while avoiding a circular dependency among prompt construction, occurrence allocation, and step execution? Function and file boundaries are not externally observable, but the chosen split must satisfy all criteria without exposing vendor-specific types.

3. **Implementation owner: core engineer; QA owner verifies.** Should the focused Q-0078 preservation test live with prompt construction or the diff subsystem? Either location is acceptable if it pins only the current cache preference, cites Q-0078, and does not encode the future fix as a passing expectation.

## Risks

- **Silent permission risk:** a missing or malformed exhaustion answer could accidentally become `advance`. Gate tests must cover every fail-closed input class independently.
- **Cross-vendor model leakage:** role defaults can carry vendor-specific model names into another adapter. The precedence matrix in AC-10 is mandatory regression coverage.
- **False schema confidence:** testing only one `schemaFor` branch could leave another shape incompatible with strict structured-output vendors. Every emitted shape must pass the shared `strictSchemaProblems` helper.
- **Event attribution races:** parallel members share one run context. Binding only the top-level step id can misattribute concurrent output, so the member-emitter fixture is required.
- **Undurable success signals:** emitting `done` before files or manifests are durable can tell callers that a failed step succeeded. Disk-level ordering and failure fixtures mitigate this.
- **Occurrence leaks:** allocation without immediate registration can leave interrupted adapter or command calls permanently `running`. The combined allocation/registration capability closes that seam.
- **Run-path regression:** omitting `{run}` from declarative writes can overwrite or mix review artifacts across runs even though `{iter}` appears unique inside one run.
- **Preserved defect confusion:** the unconditional diff cache preference becomes reachable in core here. Without the authority comment and pin, a reviewer may either fix it out of scope or mistake it for an accidental regression.
- **Timer-shaped test behavior:** retaining the one-second gate timer would add latency and a false runtime dependency solely for a fixture. Its removal is authorized, but no broader behavior cleanup is.
- **Working-tree safety:** a script command executed against the caller's checkout instead of its supplied worktree could modify user files. Tests must assert the execution directory, not only the command.
- **Cold-clone impact:** additional dependencies or setup would lengthen first use. None is expected or authorized.

## Cross-cutting checklist

- **BYOS:** applicable; no new subscription or key-handling path. Covered by AC-28.
- **Worktree safety:** applicable to agent and script execution. Covered by AC-27.
- **Gate behavior:** applicable and central. Covered by AC-16 through AC-20.
- **Files and schemas:** applicable; ticket artifacts, raw output, run history, declarative writes, and generated schemas retain existing formats. No new file format is introduced. Covered by AC-6 through AC-9, AC-11, and AC-25.
- **Lint rules:** no flow-lint rule is added or changed. TypeScript strictness and deprecation lint remain mandatory under AC-30.
- **Cross-vendor rule:** this ticket enforces model non-leakage; flow-level panel validation remains with the existing linter. Covered by AC-10 and AC-29.
- **Cold-clone impact:** no added setup or dependency. Covered by AC-32.
- **Explicit errors:** applicable to gates, structured output, adapters, scripts, timeouts, cancellation, and persistence. Covered throughout, especially AC-8, AC-9, AC-13, AC-14, AC-17, AC-18, AC-22, and AC-25.
