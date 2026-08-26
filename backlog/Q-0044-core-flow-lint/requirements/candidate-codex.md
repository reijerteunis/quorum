# Q-0044 — `core/lint`: flow lint and whole-directory validation

*Candidate requirement (product-manager), 2026-08-26. Route: chore (`requirements → chore → human gate`). Parent: Q-0009. Depends on Q-0041. The normative scope is `harness/port-charter.md` §6, row Q-0044; inherited invariants are register rows 12, 16 and 18. Surfaces: `packages/core` and the `harness/flows/` files consumed by it. The future `quorum` CLI will print the returned report, but CLI implementation is not part of this ticket.*

## Problem

Flow linting is still implemented in `spike/src/lint.js`, while whole-directory report construction remains inside `spike/bin/harness.js`. This leaves product safety rules coupled to the spike and leaves domain logic in the CLI boundary that M3’s server would otherwise have to duplicate.

This is a high-risk port because lint output is externally observable behavior. The rules encode bounded backward edges, cross-vendor judging, safe diff ranges, return chains between flows and the human-locked deploy gate. A superficially cleaner rewrite can silently change which flows pass, stop after the first problem instead of reporting all problems, or omit the `input.diff` inside a fan-out step’s `step:` template. The last omission makes an invalid deferred range fail only after adapters have already run.

The port must therefore transcribe the spike’s behavior into strict TypeScript and port its tests. It must not add a new lint opinion, improve a diagnostic, fix an incidental defect or newly reject any shipped flow.

## User story

**As the maintainer**, I want core to reject unsafe or internally inconsistent flows before a run starts and to report every problem it can find in one invocation, so I can correct the file without paying for repeated partial failures.

**As a cold-clone adopter**, I want every flow file to receive the same deterministic, file-specific lint report whether I invoke lint or start a run, so a configuration mistake has one clear diagnosis and does not fail after adapter work begins.

**As an adapter or flow contributor**, I want the lint rules and exact diagnostics to be covered by permanent tests in `packages/core`, including fan-out templates and whole-directory return chains, so adding an adapter or flow cannot silently weaken product safety.

## Acceptance criteria

1. **Core owns the complete lint surface.** `packages/core` contains strict TypeScript implementations of `FlowError`, `flattenSteps`, `lintFlow`, `lintFlowDirectory`, `validateFlowDirectory` and `lintDirectory`. These functions do not import runtime code from `spike/**`, use `any`, or use `@ts-ignore`. `lintDirectory` is lifted from `spike/bin/harness.js` so its caller only needs to print the returned report and select an exit status. No file under `spike/**` is modified.

2. **`FlowError` and successful return values preserve their contracts.** `FlowError` remains an `Error` subclass usable with `instanceof FlowError`. A valid flow makes `lintFlow` return `true`. A valid directory makes `validateFlowDirectory` return its loaded flow objects in lexicographic filename order. Invalid input throws `FlowError` only at the same validation boundaries as the spike; native filesystem and YAML behavior is not silently defaulted or converted into success.

3. **Step flattening remains deliberately shallow.** `flattenSteps()` defaults a missing argument to an empty array. For each top-level entry, it substitutes `entry.parallel` when that property is truthy and otherwise returns the entry itself, preserving order. It does not descend recursively and does not visit a fan-out step’s `step:` template. Tests cover ordinary steps, a parallel group, mixed ordering, no argument and a fan-out template that remains absent from the flattened result.

4. **Per-flow structural rules and their diagnostics are preserved verbatim.** `lintFlow` reports all applicable instances of these existing rules in deterministic discovery order:
   1. duplicate non-empty step ids;
   2. every `on_fail` has `goto`;
   3. an in-flow `goto` names a flattened step id, while a value beginning `flow:` is deferred to directory validation;
   4. `on_fail.max_iterations` is an integer greater than zero;
   5. a supplied `on_fail.counter` is a non-empty string and is unprefixed;
   6. a counter beginning `iterations.` is rejected and the message names the corrected unprefixed value;
   7. `on_fail.on_exhausted` is exactly `gate`;
   8. a step emitting `output.verdict` has either `on_fail` or `route`;
   9. a truthy `fan_out` has a `step` template;
   10. a step with `type: integrate` has truthy `branches`;
   11. the flow has truthy `consumes` and `produces`; and
   12. a flow producing `deployed` contains at least one flattened step whose `gate` is exactly `human-locked`.

   Tests assert the full current message for every rule, including punctuation, quoting, indentation and the flow identifier. A fixture with several independent defects proves one `FlowError` contains all of them rather than stopping at the first.

5. **Every diff site is checked, including the fan-out template hole excluded from flattening.** The lint examines `input.diff` on every flattened step and, for a flattened step with truthy `fan_out` and `step`, also examines `step.input.diff` in that template. The template site is identified as `<fan-out-step-id>.step` in its error. Its placeholder id, role and adapter remain invisible to duplicate-id, `goto`, cross-vendor and other flattened-step rules. Tests prove an invalid template range is rejected even though `flattenSteps` does not return the template.

6. **The diff range grammar is unchanged.** A present `input.diff` is valid only when it is a string split by `...` into exactly two endpoints and each endpoint is either exactly `{base}` or matches `harness/{id}/` followed by at least one character. No whitespace trimming, interpolation, Git lookup, alternative separator, arbitrary branch, empty suffix or additional endpoint is accepted. The diagnostic remains exactly `input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got <JSON value>` after the site label. Tests cover both valid endpoint types in both positions and invalid type, separator, endpoint count, whitespace, arbitrary ref and empty `harness/{id}/` suffix.

7. **The cross-vendor panel rule preserves the refined behavior.** When `cross_vendor` is exactly `required`, each top-level parallel group containing at least two members is grouped by role. Any same-role subgroup with at least two members must span at least two distinct adapter values. A panel spanning adapters satisfies the rule; it is not required that every panel member use a different adapter. The existing diagnostic names the implicated step ids, role and shared adapter exactly. Parallel groups with fewer than two members and role groups with fewer than two members do not trigger this panel rule.

8. **The cross-vendor single-writer judging rule is preserved.** When no invalid panel was found, lint maps each written backlog artifact from `output.write` and `output.writes` to its producing adapter. For every flattened verdict step, it expands the step’s `input.backlog` patterns using the spike’s one-segment `*` matching and trailing-slash prefix behavior. If at least one produced artifact is judged and every matched artifact was written by the verdict step’s own adapter, lint rejects the flow with the current message naming the verdict step, matched artifacts and adapter. A judge over multiple candidates passes when those candidates span adapters, even if one candidate shares the judge’s adapter. Tests also pin the existing behavior that detection of any invalid same-role panel suppresses this per-verdict pass for that invocation; changing that behavior requires a separate decision.

9. **Backward-edge convergence validation is unchanged.** For each non-`flow:` `on_fail.goto`, when the source writes at least one artifact and the destination exists and is not a fan-out step, at least one source artifact must match at least one destination `input.backlog` pattern using the existing glob semantics. Otherwise lint reports `<source>: loops back to "<destination>", which never receives <writes> — the loop cannot converge`. The rule does not run for a cross-flow edge, a source with no writes, a missing destination already reported by the target rule, or a fan-out destination. Tests cover each branch.

10. **Per-flow errors retain exact aggregation and identification behavior.** `lintFlow` throws one `FlowError` formatted as `flow <flow.name-or-file> invalid:` followed by two-space-indented `-` bullets in the order the spike discovers them. `flow.name` takes precedence over `flow.file`. Duplicate occurrences and multiple failing steps remain separate bullets. Error messages continue to name a flow, file, step, target, artifact, stage, role or adapter that a reader can locate; this port does not rewrite wording for clarity.

11. **Directory loading produces one deterministic record per YAML file.** `lintFlowDirectory(directory)` reads only immediate files whose names end exactly in `.yaml`, sorted lexicographically. For each file it parses YAML, assigns the absolute or joined file path used by the loader to `flow.file`, and runs `lintFlow`. A successfully parsed and locally valid file produces `{ file, flow, problems: [] }`. A YAML or local-lint failure produces `{ file, problems: [error.message] }` and is excluded from cross-flow indexes. One invalid file does not prevent the remaining files from being read and checked. Non-YAML files and nested directories are ignored.

12. **Cross-flow targets must exist as locally valid YAML flows.** For every flattened step whose `on_fail.goto` begins `flow:`, the suffix names the target by YAML filename without `.yaml`. If no successfully loaded, locally valid target has that filename, the source record receives exactly `flow <source.name>: target flow <target> is missing or unloadable`. The check does not resolve targets by the target flow’s internal `name`.

13. **Cross-flow return chains are derived from stages.** For a valid target flow, directory lint begins with the target’s `produces` stage and follows the unique locally valid flow whose `consumes` equals the current stage until it reaches the source flow’s `consumes` stage. Reaching that stage passes. No consumer produces the existing `dies at stage` diagnostic; more than one consumer produces the existing `ambiguous at stage` diagnostic naming implicated flows; revisiting the same flow-and-stage pair produces the existing cycle diagnostic naming the stage and implicated flows. Tests assert every full message and cover a direct return, a multi-flow return, a dead end, ambiguity and a cycle. This preserves register row 16: the target flow’s declared stages, not a duplicated edge annotation, define the regression return chain.

14. **Directory validation aggregates by file.** `validateFlowDirectory` calls the same directory walk as `lintFlowDirectory`. If any record has problems, it throws one `FlowError` containing each invalid filename followed by that record’s indented bullets, in filename order. If none has problems, it returns all flow objects in filename order. A test with local errors, a missing target and a return-chain error in different files proves the function reports all invalid files at once.

15. **The reusable lint report preserves CLI-visible output.** `lintDirectory` calls `lintFlowDirectory` rather than reimplementing validation. It returns `{ ok, report }`, where `ok` is true only when every record has no problems and `report` has one string per YAML file in filename order. A valid row is the existing green check mark plus filename. An invalid row is the existing red cross plus filename and two-space-indented bullets. When a stored per-flow error begins with the `flow … invalid:` header, the report removes that header and renders its existing bullets once; directory-level problems remain bullets beside the same file. Tests compare the complete report strings, including color-control bytes if the lifted formatter emits them. Printing, logging and `process.exit` remain outside this function.

16. **All shipped flows remain accepted.** `validateFlowDirectory` succeeds against all six flow files currently shipped in `harness/flows/` and against their copies under `spike/templates/harness/flows/`. The test fails if either directory contains fewer than six YAML files, so deletion cannot satisfy it. This ticket does not change those files to make the test pass.

17. **Unit-level regression coverage moves with the module.** Vitest coverage in `packages/core` ports the lint-specific cases from Q-0033, Q-0035 and the spike smoke suite, including exact output comparisons, multi-problem aggregation, fan-out-template diff validation and every cross-flow return-chain outcome. Tests use temporary directories for generated fixtures and do not modify checked-in flows. Workspace lint, strict typechecking and tests remain green.

18. **A discovered discrepancy stops the port.** If transcription or the ported tests reveal a spike defect, inconsistency, or behavior not covered by this requirement, implementation records the exact fixture, actual output and expected authority and stops for an accepted erratum or separate ticket. It does not fix the behavior, normalize the error, broaden the grammar or alter a shipped flow in passing.

19. **Cross-cutting quality check is recorded in the implementation report.** BYOS is not applicable and no subscription path is added; worktree safety is unchanged because lint performs no Git or worktree writes; bounded backward edges and the human-locked deploy gate retain the behaviors above; flow files remain YAML files and no schema or persisted state is added; lint rules are transcribed without additions; no product-specific SaaS knowledge is introduced; and the cold-clone path gains no command, prompt or required input.

## Non-goals

- Adding a rule that every step has an id; Q-0055 owns that behavior change.
- Rejecting the chore flow because `review` appears before the integrate step that creates the branch it diffs against; Q-0038 records this as a candidate for a separate decision.
- Any rule that newly rejects a checked-in flow under `harness/flows/` or its shipped template copy.
- Changing cross-vendor policy, glob semantics, diff range grammar, stage vocabulary, return-chain selection or any diagnostic text.
- Recursively validating nested flow directories or accepting file extensions other than `.yaml`.
- Adding schema validation beyond the behavior already performed by the spike linter.
- Loading or running a flow, materialising a diff, interpolating refs, invoking Git, probing an adapter or charging a budget.
- Porting another child’s module, including engine preflight, flow execution, contracts, adapters, Git, fan-out, backlog or run history.
- Editing or deleting any file under `spike/**`, or deleting the spike.
- Implementing the `quorum` binary, argument parsing, terminal printing or process exit behavior; these belong to Q-0010.
- The Q-0009 cutover, persisting the event stream, daemon or Studio behavior.
- Fixing any defect found while reading the spike without a separately accepted behavior-change decision.
- Multi-user support, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter or desktop shell.

## Open questions

| ID | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Where should Q-0044 export its lint surface while `packages/core/src/index.ts` is still pinned by landed Q-0041 tests: directly from a new `lint` module only, or also from the package entry point after updating that pin? | Q-0044 engineer and Q-0041 owner | **Yes.** It determines the public import path and which landed test must change. Default if resolved by existing repository convention: follow the folder/module export pattern established by Q-0064 and do not modify the package entry point unless an accepted dependency requires it. |
| OQ-2 | Must `lintDirectory` retain terminal color-control bytes inside core’s `report`, as the literal spike lift does, or should core return uncolored report lines plus presentation metadata for the future CLI? | Product owner | **Yes.** Changing the representation would violate literal output preservation unless expressly authorised. Default for this port: preserve the complete current strings, including color bytes, and leave only printing to the CLI. |
| OQ-3 | `lintFlowDirectory` catches any thrown value and reads `.message`; strict TypeScript requires narrowing, while the spike can consequently store `undefined` for a non-`Error` throw. Should that edge case be preserved or may non-`Error` values be stringified? | Q-0044 engineer | No for ordinary YAML/filesystem behavior. Preserve the observed spike result with a narrow helper or assertion; stringifying would be a diagnostic behavior change and needs an erratum if tests expose it. |
| OQ-4 | The cross-vendor implementation skips all per-verdict writer/reviewer checks when any invalid same-role panel exists. Is that intentional policy or an aggregation defect? | Product owner | No for this port. AC-8 pins the current behavior; changing it requires a separate ticket because this ticket may not fix a discovered defect. |

## Risks

- A rewrite that recursively flattens steps will treat fan-out template placeholders as real ids, roles and adapters and create false duplicate or cross-vendor failures.
- Reusing `flattenSteps` to locate diff ranges will omit the fan-out template and allow a malformed deferred range to fail only after adapter work has begun.
- A more conventional cross-vendor implementation may enforce writer ≠ reviewer for every candidate and wrongly reject a valid multi-adapter panel.
- Directory validation can appear correct on direct return edges while mishandling dead ends, ambiguity or cycles in longer stage chains.
- Improving error wording, error wrapping, bullet order or color handling will break Q-0033 output compatibility even when the same flow is rejected.
- Introducing shared mutable indexes or caching directory results could make lint depend on file traversal history. The implementation must rebuild its records and indexes for each invocation.
- Q-0041 or Q-0064 may change the expected module and export layout before implementation begins. OQ-1 must be resolved against the landed tree rather than guessed.
- The shipped-flow regression can be weakened accidentally if it validates only one directory, silently skips files or permits deletion to reduce the fixture set. AC-16 guards both directories and the minimum count.
