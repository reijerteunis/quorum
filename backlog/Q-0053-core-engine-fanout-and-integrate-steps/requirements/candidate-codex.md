# Q-0053 — core/engine fan-out and integrate steps

## Problem

The core engine cannot execute a fan-out step or an integrate step. `packages/core/src/engine/routing.ts` still rejects both kinds as owned by Q-0053, so the port cannot run the M1 contracts → red tests → fan-out development → green sequence.

A direct translation is safety-sensitive. An integrate step with `expect: fail` must distinguish a test suite that ran and failed from a command that failed before the suite started. It must also install dependencies in its fresh worktree, sync the ticket branch with the configured base branch, and persist every outcome. Losing any of these behaviors can make an invalid environment appear to prove a trustworthy red phase.

This ticket ports the behavior already present in `spike/src/engine.js`; it does not redesign it. The source spans and collaborators must be re-derived from the branch SHA used for implementation. The measured scope on 2026-08-31 is `runFanOut`, `runIntegrate`, `syncBaseIntoTicketBranch`, `environmentFailure`, `testReport`, and `safeMergeBase`, plus dispatch and tests. `mergeFailure` and `IntegrationError` already exist. The timeout helper already exists as the private `commandTimeout` in `engine/steps.ts` and must be shared rather than duplicated.

Surfaces touched: the CLI engine, `harness/` flow execution, ticket artifacts and `runs.log` under `backlog/`, and integrate occurrences under `.quorum/`. No Studio surface is involved.

## User story

As a **solo maintainer**, I want a fan-out step to execute the solution’s tasks in the declared dependency order and an integrate step to merge and test their branches in an isolated worktree, so that red and green results are evidence about the code rather than about a stale checkout or broken environment.

As a **cold-clone adopter**, I want these steps to use the repository’s declared install and test commands without writing to my working tree, so that the standard flow remains safe and requires no undocumented machine setup.

As an **adapter contributor**, I want fan-out to invoke the existing generic agent-step contract, so that composite execution does not add vendor-specific behavior above the adapter layer.

## Acceptance criteria

1. **Composite-step dispatch**
   1. `runStep` dispatches a step whose `type` is `integrate` to the ported integrate implementation and a step with `fan_out` to the ported fan-out implementation.
   2. The two `unavailableStep(step, 'Q-0053')` paths for these kinds are removed.
   3. Other dispatch precedence remains unchanged: parallel groups and gates are handled before these checks, script steps still use `runScript`, and ordinary steps still use `runAgentStep`.
   4. Unit tests invoke both composite kinds through `runStep`, rather than proving only direct helper calls.

2. **One shared command timeout**
   1. The existing `commandTimeout` implementation in `engine/steps.ts` is exported or moved to a shared core module and used by `runScript` and both integrate command invocations.
   2. It returns `config.commands.timeout_ms` when configured and otherwise returns 15 minutes.
   3. Q-0053 does not introduce a second timeout implementation or a second copy of the 15-minute default.

3. **Fan-out task selection and planning**
   1. Fan-out loads the ticket’s tasks through the existing `loadTasks` helper.
   2. With `fan_out.scope: failing-tasks-only` and a non-empty `context.failingTasks`, it uses `scopeToFailing`, emits a warning naming the selected task ids, and executes only those tasks.
   3. With no tasks after selection, it throws a `FlowError` naming the step and stating that there are no tasks to fan out.
   4. With `fan_out.respect: depends_on`, it uses the existing `waves` planner. All other values execute the selected tasks in one wave.
   5. Tasks within a wave run concurrently. Waves run in order.
   6. It emits the task count, wave count, and each wave’s task id and role using the existing event surface.

4. **Fan-out agent-step contract**
   1. Each selected task is executed through the existing `runAgentStep(step, context, extra)` signature; that signature is not reshaped by this ticket.
   2. The template step is independently cloned for each task before task-specific fields are changed.
   3. The child id, role, adapter, model, and branch retain the spike’s interpolation and fallback behavior, including role metadata resolution.
   4. The child step always requests a worktree.
   5. `extra.vars` receives `taskVars(task)`, `extra.syncBase` is `true`, and `extra.promptSuffix` appends `taskPromptSection(task, cwd)`.
   6. When a previous integration result exists, the prompt suffix also includes its first 4,000 characters under the same “Previous integration result” heading as the spike.
   7. The resolved task id, branch, and role are appended to the same mutable run context’s fan-out state so a later integrate step can read them.
   8. A child result containing `goto` or `abort` is returned after the current wave settles, preserving the spike’s result selection behavior.

5. **Fan-out branch synchronization and intermediate waves**
   1. Before non-dry fan-out execution, `syncBaseIntoTicketBranch` resolves the child template’s base, falling back to the ticket branch, and resolves `repo.base_branch`, falling back to `main`.
   2. Synchronization is skipped, with an explicit reason, when the base is the ticket branch, the ticket branch does not yet exist, or the base branch does not exist.
   3. Otherwise it merges the base into the ticket branch’s worktree before child worktrees are created.
   4. A failed base merge throws a sentence-form `FlowError` using the existing `mergeFailure` helper. The message identifies the target and base, tells the maintainer to resolve and commit the conflict in a worktree on the target, and states that an agent in the loop cannot repair it.
   5. Dry execution does not synchronize or merge branches.
   6. Between dependency waves, every completed task branch in the wave is merged into the ticket branch before the next wave starts. A failed intermediate merge emits the spike-compatible warning and does not silently report success.

6. **Integrate target and branches**
   1. Integrate resolves `into`, falling back to the ticket branch, and announces the resolved target.
   2. The `into` interpolation call deliberately uses `String(step.into ?? ticket.meta.branch)` so numeric YAML values retain the spike’s coercion behavior while satisfying the typed `interpolate` contract.
   3. An explicit branch array is interpolated item by item in declared order.
   4. A wildcard branch declaration resolves to the distinct branches recorded by prior fan-out execution, preserving first occurrence order.
   5. A non-wildcard scalar resolves to one branch.
   6. Branches that do not exist are filtered out, preserving the spike’s behavior rather than introducing a new error.
   7. Dry execution returns after announcing the target and creates no worktree, branch merge, command invocation, ticket write, log record, or occurrence.

7. **Integrate occurrence and evidence**
   1. A non-dry integrate step allocates one `integrate` occurrence through `context.persistence.allocateOccurrence` before performing integration work.
   2. Its notes identify the run id, iteration, target, target head or `(new)`, and configured base.
   3. For each explicitly listed source branch, `safeMergeBase` records the merge-base short SHA when one can be obtained.
   4. `safeMergeBase` returns the merge-base SHA with surrounding whitespace removed, or `null` for any git failure. The existing boolean `ancestry` helper is not used as a substitute.
   5. Command output is persisted as that occurrence’s `output.txt`, including empty output.
   6. A successful integrate occurrence becomes `completed`. Invalid environment, merge-conflict, and unmet-test-expectation paths become `failed` with category `integrate` and an actionable sentence-form message. If an earlier throw leaves an occurrence active, the existing run finalization seam remains responsible for closing it.

8. **Base synchronization during integrate**
   1. Before source branches are merged, integrate resolves `repo.base_branch`, falling back to `main`, and merges it into the target when it exists and differs from the target.
   2. Notes and emitted information identify whether the base merge succeeded, using `mergeFailure` for a failure reason.
   3. A base-merge conflict writes all declared integration note artifacts, appends a `base-conflict` entry to `runs.log` naming the base and conflicting files, and stops with a `FlowError`.
   4. The error explains that re-running developers cannot fix a conflict between the ticket branch and base, and tells the maintainer to merge the base into the target before re-running.
   5. No backward edge or iteration retry is taken for this failure.

9. **Source-branch merges**
   1. Integrate attempts each existing source branch in resolved order through the existing `mergeInto` helper.
   2. Notes and events record success or failure for every attempted branch.
   3. A merge failure is collected rather than throwing immediately, allowing the integration report to list all attempted branches.
   4. Human-facing merge failures use the existing `mergeFailure` sentence contract rather than a stack or an empty conflicts list.

10. **Install before test**
    1. `run_tests: true` selects `config.commands.test`, falling back to `npm test`.
    2. Any other truthy `run_tests` value is interpolated with run variables and flattened `cmd.*` command values. A falsy value runs neither install nor test.
    3. When a test command is selected, `config.commands.install` is run first in the integration worktree, provided no merge conflict has already occurred.
    4. The install command uses the shared command timeout from AC-2.
    5. Its command, exit code, and result are added to notes and emitted events.
    6. A non-zero install exit records its output and creates an environment error. The test command is not run afterward.
    7. An install failure stops the run after artifacts, occurrence state, and `runs.log` have been persisted; it does not take `on_fail` or consume another iteration.

11. **Test expectation and timeout**
    1. The test command runs in the integration worktree only when there are no merge conflicts and no install error.
    2. It uses the shared timeout from AC-2 and retains the command’s combined captured output.
    3. The default expectation is `pass`. For `expect: pass`, only exit code 0 satisfies the expectation. For `expect: fail`, only a non-zero exit satisfies it, after AC-12 has established that the suite ran.
    4. A timed-out command is invalid evidence regardless of exit code or expectation. The reason reports the rounded timeout in minutes and that the command was killed.
    5. Notes and emitted events distinguish `OK`, `NOT OK`, and `INVALID` outcomes and include the actual exit code and expected result.

12. **Environment-failure detection**
    1. `environmentFailure` recognizes the spike’s deliberately narrow signatures: missing package, missing module, `ERR_MODULE_NOT_FOUND`, a test-file `SyntaxError`, `command not found`, and `ERR_REQUIRE_ESM`.
    2. It returns the spike-compatible human-readable reason for the first recognized signature, or `null` when none is found.
    3. Before matching, ANSI color codes are removed and lines beginning with a test-result marker are excluded. The excluded markers include `✓`, `✗`, `×`, `√`, `ok`, `not ok`, `#`, and numbered failure headings.
    4. A test proves that a result line containing an environment signature is not classified as a broken environment while the same signature on an ordinary diagnostic line is classified.
    5. Broad signatures such as `npm ERR!` are not added.
    6. A detected environment failure is reported as “the suite never ran”, invalidates both `expect: pass` and `expect: fail`, persists the report and failed occurrence, and stops without following `on_fail`.

13. **Integration reports and truncation**
    1. `testReport(command, output)` returns Markdown containing the command, an “Every result line” roster, and the captured output.
    2. The result-line roster includes every matching result line from the complete untruncated output, in source order, even when that line is also present in the retained body.
    3. The roster recognizes the spike’s `RESULT_LINE` vocabulary, including ANSI-prefixed markers, TAP lines, numbered failures, and `PASS`, `FAIL`, or `SKIP`.
    4. When no result lines match, the report explicitly says so.
    5. Output of at most 24,000 characters is retained whole. Longer output retains the first 12,000 and final 12,000 characters with a middle omission marker that states the number of omitted characters.
    6. A test uses output larger than 24,000 characters with result lines in the omitted middle and proves that every result line remains in the roster.
    7. For every path in `writesOf(step)`, a path containing `report` receives `testReport`; other paths receive the integration notes. Existing interpolation and backlog-writing behavior is preserved.

14. **Failure routing and failing-task scope**
    1. After artifacts and logging, an integrate step with conflicts or an unmet test expectation closes its occurrence as failed and stores the previous integration notes plus the final 3,000 output characters on the run context.
    2. With conflicts, `failingTasks` contains only tasks whose recorded branches conflicted. Unknown branches do not create undefined task ids.
    3. With a test mismatch and no conflicts, `failingTasks` contains every task recorded by fan-out so the next agent round receives the test output.
    4. Without `on_fail`, this failure returns `{ abort: true }`. With `on_fail`, it delegates to the existing `handleFail` behavior.
    5. A successful integration clears `failingTasks`, emits completion text naming the branch count and applicable red/green result, and returns `null`.
    6. Broken environments, command timeouts, and base-sync conflicts never delegate to `handleFail`.

15. **Ticket log and persistent counters**
    1. Every non-dry integrate attempt that reaches normal reporting appends one `runs.log` entry with run id, step id, merged/attempted branch counts, and tests recorded as `ok`, `fail`, `invalid`, or `-`.
    2. A base conflict appends its dedicated entry before throwing.
    3. Terminal run handling continues to persist the run’s counters and terminal status for completed, regressed, failed, aborted, and interrupted outcomes, satisfying invariant-register rows 6 and 7 together.
    4. Tests cover successful, expectation-failed, environment-invalid, merge-conflicted, base-conflicted, and interrupted or thrown paths and verify that no terminal path silently omits its applicable log or occurrence state.

16. **Behavior-preserving port and regression proof**
    1. Unit-level tests port the applicable spike behavior for both composite steps and all four local helpers. Tests include dependency waves, failing-task scoping, dry execution, missing branches, base sync, install ordering, pass and fail expectations, timeout, environment signatures, report truncation, merge-base failure, artifacts, logging, and occurrence terminal states.
    2. The mock-adapter end-to-end regression suite remains green with the composite dispatch enabled.
    3. `spike/src/**` is neither modified nor deleted. The spike suite remains an independent witness and remains green.
    4. TypeScript remains strict: no `any` and no new `@ts-ignore`.
    5. No deprecated API is introduced. Workspace lint and type checking remain green.
    6. Any defect or externally observable divergence found while porting is reported and stops this ticket unless a dated, accepted exception authorizes it. It is not fixed in passing.

17. **Inherited source-authority guard**
    1. Any deliberately preserved defect introduced into an engine production file receives one concise `Why: preserved defect, see Q-0053 AC-…` authority line as required by the repository comment rules.
    2. `q0050.source.test.ts` is updated to register each new authority-line identity in the correct file.
    3. The explanatory arithmetic comment and exact `preserved defect/` total are updated together from the current value of 11 to the value implied by the newly registered Q-0053 sites; neither may be changed without the other.
    4. The guard continues to fail for an unregistered, removed, moved, or unclassifiable authority line and continues to reject copied ticket or decision prose.

18. **Cross-cutting product checks**
    1. **BYOS:** no adapter authentication behavior, subscription handling, environment refusal, documentation example, or alternate access path is added.
    2. **Worktree safety:** all installs, tests, and merges execute in worktrees under the existing `.harness/worktrees/` machinery. A test proves that the repository’s user working tree is not the command or merge target.
    3. **Gate behavior:** this ticket adds no gate kind and does not weaken human-locked or exhaustion-gate behavior. Only the existing `handleFail` path can create a backward edge from an ordinary integration failure.
    4. **Files and schemas:** no flow, task, ticket-frontmatter, run-manifest, event, or adapter schema changes. Existing ticket artifacts, `runs.log`, and `.quorum/` history remain the persistent record.
    5. **Cross-vendor rule:** fan-out uses `runAgentStep` and introduces no vendor-specific branching or event field.
    6. **Product-agnostic:** production code, tests, and fixtures add no knowledge of a specific SaaS product.
    7. **Cold-clone impact:** no new dependency or setup step is introduced. Integrate uses the project’s existing `commands.install` and `commands.test` configuration.

## Non-goals

- Changing externally observable spike behavior, including fixing a defect found during the port.
- Editing or deleting anything under `spike/src/`.
- Reimplementing `mergeFailure`, `IntegrationError`, `runAgentStep`, fan-out plumbing owned by Q-0048, run-history plumbing, routing-budget behavior, or command execution.
- Duplicating the command-timeout default.
- Replacing `safeMergeBase` with the boolean or three-valued ancestry APIs.
- Changing task, flow, project-config, run-manifest, event, or adapter contracts.
- Enforcing the qa-red ownership rules that every file required by a red test belongs to exactly one task and every red test is permanent; those belong to the qa-red gate.
- Automatically resolving merge conflicts or retrying failures that no agent in the loop can repair.
- Adding budget-cap enforcement.
- Persisting a new event stream or adding vendor-specific events.
- Changing task-branch cleanup or the known `finish()` task-branch rollback gap.
- Cutover from the spike, the `quorum` binary work owned by Q-0010, or another Q-0009 child’s module.
- Studio work, remote or multi-user execution, cloud sync, a plugin marketplace, a visual canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Implementation file boundary — owner: implementer; non-blocking.** The composite functions may live in a new focused engine module or an existing engine module, provided dispatch and tests use the production exports and the module does not create a dependency cycle. Internal layout is not behavior preserved by the charter.
2. **Newly discovered defect — owner: product manager and human gate; blocking if encountered.** If inspection or parity tests reveal behavior not covered above that appears defective or inconsistent, should it be preserved and registered, or authorized as a separate behavior change? The implementer must stop and present the observed spike behavior, core behavior, and user-visible consequence; the chore route cannot decide this silently.

No file-format or adapter-contract question is open. The timeout ownership decision is closed by AC-2: one shared exported or relocated helper, never duplication.

## Risks

- A non-zero test exit can be mistaken for a valid red phase when installation, timeout, or environment classification is omitted. AC-10 through AC-12 require separate evidence and stop behavior.
- Result-line filtering can classify its own test text as an environment failure. AC-12 requires result lines to be removed before matching and tests both sides of the boundary.
- Truncating raw output can hide failing groups from the next agent. AC-13 retains a complete result-line roster independently of body truncation.
- A stale ticket branch can make valid base changes appear reverted or make task agents repeatedly rediscover an unrepairable conflict. AC-5 and AC-8 require synchronization before work and an actionable stop on conflict.
- Duplicating the timeout helper can let script and integrate defaults drift without a failing test. AC-2 makes the helper shared and testable.
- Using ancestry in place of merge-base would lose the divergence SHA used as evidence. AC-7 preserves the distinct primitive.
- Mutable fan-out state can disappear if a copied context is passed between steps. AC-4 and AC-14 require assignments on the shared run context and end-to-end dispatch tests.
- The source-authority guard uses cross-file exact arithmetic. Updating only its count or only its explanatory register would leave a green test that documents the wrong inventory; AC-17 requires both to move together.
- Broadening environment signatures or improving missing-branch handling would be tempting but would violate the port charter. AC-16 requires parity and escalation instead of an in-ticket fix.
