# Q-0051 — core/engine diff preflight and materialisation

## Problem

A solo maintainer can pay one or more adapters to review an empty, missing, malformed, or otherwise unusable diff. Because an adapter can inspect the repository directly, it may still return a plausible verdict, hiding that the evidence supplied by the flow was invalid.

The spike prevents this where evidence can be checked at run start and delays the check only where the run must first create an endpoint. That behavior, including its diagnostic and truncation rules, has not yet been ported to `packages/core`.

This ticket touches the CLI behavior produced by a flow run and the internal `packages/core/src/engine/` implementation. It does not add a CLI command or option.

## User story

As a **solo maintainer**, I want Quorum to reject unusable diff evidence before the first avoidable adapter invocation, so that a verdict cannot advance a flow when its supplied diff was empty, invalid, or unavailable.

As a **cold-clone adopter**, I want a failed or skipped diff check to say exactly what was examined and what was not, so that I can correct the flow or repository state without inferring a cause from an ambiguous message.

## Acceptance criteria

1. **Module and public contract.** Add `packages/core/src/engine/diff.ts` as the seventh production module in `packages/core/src/engine/`. It owns and exports the ported diff-site discovery and diff materialisation behavior needed by `engine.ts` and the later prompt-building code. Update `packages/core/src/engine/q0050.source.test.ts` so its exact production-file list includes `diff.ts`. Every export in the new module has JSDoc anchored immediately to that export.

2. **Run-context state.** Extend `RunContext` with run-scoped collections for:
   - materialised diff text keyed by the fully interpolated range; and
   - deferred ranges keyed by the fully interpolated range, with the endpoint and producing step that caused deferral.

   `runFlow` initialises both collections once on the run's existing context object. Step execution receives that same object, so later prompt construction can read values written by preflight. No new `RunFlowOptions` field or configuration option is introduced.

3. **Preflight position and terminal handling.** Inside `runFlow`, execute the diff preflight inside the existing run `try` block, after run initialisation and before the step loop invokes any adapter. A preflight failure follows the same failed-run path as another error in that block, including terminal event, run-history and ticket-log behavior already owned by Q-0050. The preflight itself creates no adapter occurrence.

4. **Every runtime diff site is discovered.** Preflight examines both places a flow step can supply `input.diff`:
   - the step's own `input.diff`; and
   - a fan-out step's `step.input.diff` template.

   A fan-out template is labelled `<fan-out-step-id>.step` in failures, matching the static lint label. It is not otherwise treated as a flattened flow step. A missing or falsey `input.diff` is not a diff site, preserving the spike behavior.

5. **Order-aware endpoint production.** Preflight walks flow groups in declaration order. For each group, it examines all member diff sites before recording branches created by members of that group. A parallel sibling is therefore concurrent, not an earlier producer. After examining a group, it records only the earliest step that declares each created ref through:
   - `worktree`, using the interpolated explicit `branch` or the existing `harness/{id}/{step-id}` default; and
   - an `integrate` step's interpolated `into` value.

6. **String conversion at interpolation boundaries.** Because `interpolate` accepts only a string, the port deliberately applies `String(...)` before interpolating each runtime value read from the flow shape: `site.input.diff`, an explicit `branch`, and `into`. `materialiseDiff` likewise preserves its existing `String(step.input.diff)` conversion. A YAML numeric value such as `branch: 2` compiles and is interpreted as the string `"2"`; this conversion does not otherwise change interpolation semantics.

7. **Immediate and deferred classification.** For each interpolated range:
   - if neither endpoint is produced by an earlier step, materialise it during preflight;
   - if an endpoint is produced by an earlier step, record the range as deferred with that endpoint and the earliest producing step, and do not materialise it during preflight; and
   - if the site is a per-task fan-out template whose interpolated range still contains a `{...}` placeholder, report that examination was skipped until task expansion and leave it for earliest-possible step-time materialisation.

   An unresolved placeholder in a non-template diff is not silently skipped and proceeds to normal validation. The mixed-endpoint behavior in this criterion is subject to OQ-1.

8. **One stable value per distinct range.** A non-deferred, fully resolved range is materialised at most once per run and stored by its fully interpolated range. Repeated sites, including fan-out task expansions, receive the same stored bytes. If any preflight range fails, the run stops even when another distinct range was valid.

9. **Range guard.** `materialiseDiff` requires exactly two non-empty endpoints joined by exactly `...`. Each endpoint must be either:
   - the current run's diff anchor from `ctx.vars.base`; or
   - a branch beneath `harness/<ticket-id>/`.

   A malformed range, unrelated ref, arbitrary SHA not selected as the diff anchor, or another ticket's branch throws `FlowError` before a diff or containment command is run. The diagnostic names the step, received range, current diff anchor, and permitted ticket prefix. This runtime guard does not replace or relax Q-0044's static lint rule.

10. **Diff anchor behavior.** `materialiseDiff` derives the allowed base and `{base}` anchor from `ctx.vars.base`, falling back only when that value is absent to `config.repo.base_branch`, then `main`, as in the spike. A caller-supplied `RunFlowOptions.base` therefore changes the diff anchor and range-guard base. It does not change `config.repo.base_branch` or any merge-source selection.

11. **Endpoint resolution failure.** Resolve both endpoints to Git's short SHA before running the diff or containment check. If either endpoint does not resolve, throw `FlowError` that:
   - names the interpolated range and the flow-file value;
   - identifies the missing endpoint as left or right;
   - gives the other endpoint's short SHA when it resolves, or says that it also does not resolve;
   - preserves the existing identifying message for a missing configured base or missing integration branch;
   - names the producing step and expected ref when the failed endpoint is the recorded deferred endpoint; and
   - states that neither the diff nor containment check ran.

   It makes no containment claim and supplies no more than one remedy.

12. **Empty-range evidence.** When `git diff --stat <range>` produces only whitespace, throw `FlowError`. The message must include:
   - the step/site label;
   - the fully interpolated range and the range as written in the flow file;
   - both endpoint names and their resolved short SHAs;
   - the exact `git merge-base --is-ancestor <right> <left>` command returned by the shared Git evidence primitive; and
   - one rendered result: `contained`, `not contained`, or `indeterminate`, with the indeterminate reason and available detail.

   The implementation uses `emptyRangeEvidence`, and therefore the repository's single `ancestry()` primitive, rather than adding an engine-local containment check or converting an error into `false`.

13. **No historical story.** An empty-range diagnostic describes only evidence. It must not state or imply that work was merged, landed, shipped, rebased, cherry-picked, or otherwise describe how the commits reached their relationship. When containment is proven, it may say that the right endpoint is contained in the left and that the range spans no commits. When containment is indeterminate, it explicitly says Git could not answer and makes no further containment claim.

14. **Empty-range distinctions and remedy.** Preserve these evidence-based distinctions:
   - `contained`: the right endpoint is contained in the left;
   - `not contained` with equal endpoint trees: different commits hold identical trees;
   - `not contained` with unequal endpoint trees: the right endpoint adds nothing since its merge base with the left; and
   - `indeterminate`: no tree-based diagnosis is asserted.

   Each failure contains at most one remedy, and that remedy must describe a range or action accepted by the range guard. For a deferred range, the remedy tells the maintainer to check that the named producing step committed its work to the expected ref; it must not advise reviewing the ref “before it becomes contained.”

15. **Earliest-possible adapter boundary.** For a range whose evidence exists when the run starts, malformed, out-of-class, missing, empty, or indeterminate evidence stops the run with zero adapter invocations. For a legitimately deferred range, its producing adapter may run, but materialisation occurs before the consuming adapter, and unusable evidence prevents that consuming adapter from running. The product does not claim that every bad deferred range can be detected before its producer is billed.

16. **Skipped is not passed.** A dry run or preflight that cannot examine a range because an endpoint or per-task value must be created later reports that check as skipped/deferred, not successful. Existing dry-run behavior is preserved: it invokes no adapter, does not demand a branch that only a real run creates, does not mutate the ticket or run history, and uses the same run machinery rather than a second validation path.

17. **Materialised prompt text.** For a valid non-empty range, return the existing prompt fragment with:
   - `## Diff to review`;
   - `### git diff --stat <range>` followed by trimmed stat output;
   - `## Patch (<range>)`; and
   - the decoded patch bytes.

   No new wrapping, escaping, normalisation, or interpretation of Git output is introduced.

18. **Bounded diff bytes.** Read the byte limit from `ctx.config.repo?.max_diff_bytes`, defaulting to `200000`. When the patch exceeds the limit, take the first `limit` bytes, remove only an incomplete UTF-8 code point at the suffix, append the existing truncation notice with retained and configured byte counts, and append the existing `runs.log` truncation record. A patch at or below the limit has neither notice nor truncation log.

19. **UTF-8 suffix behavior.** Port `trimIncompleteUtf8Suffix` with the spike behavior for empty buffers, ASCII, complete and incomplete two-, three-, and four-byte code points, continuation-byte suffixes, and invalid lead bytes. It changes only a truncated suffix; it does not validate, repair, or re-encode the rest of the diff.

20. **Source constraints.** All production files in `packages/core/src/engine/`, including `diff.ts`, continue to satisfy Q-0050's source guards:
   - every export has its own anchored JSDoc;
   - no comment line copies a forty-character sentence from `docs/DECISIONS.md` or this ticket verbatim;
   - every `Why:` clause is accepted by `classifyAuthority`;
   - no `console.*`, process output/exit/signal subscription, ANSI escape, or import from `spike/` is introduced; and
   - no deprecated API, `any`, or unexplained `@ts-ignore` is used.

21. **Ported regression coverage.** Add workspace tests covering the diff subsystem's unit and composed run behavior represented by the frozen spike coverage in `q0035-empty-range.js`, `q0034-chore-preflight.js`, `q0034-dry-run.js`, `q0034-review-fixes.js`, `q0077-base-flag.js`, the relevant diff assertions in `q0006-engine.js`, and `smoke.js`. Tests must demonstrate adapter-call counts rather than infer billing order from the final error alone. No test edits `spike/**`.

22. **Verification.** After installing both dependency trees as prescribed by `harness/rules.md`, `npm test --prefix spike`, `pnpm lint`, and `pnpm turbo run test --force` all pass. The spike suite remains the independent witness; this ticket does not change it to accommodate the port.

23. **Cross-cutting checks.** The implementation and tests demonstrate:
   - **BYOS:** n/a; no adapter subscription or environment-check path changes, and no API-key path is introduced.
   - **Worktree safety:** the subsystem performs Git reads and ticket-scoped logging only; it does not write to the user's working tree or create a new worktree location.
   - **Gate behavior:** n/a; gate eligibility and answers are unchanged. A diff failure stops before a consuming adapter or gate can act on its verdict.
   - **Files and schema:** no persistent file format or schema changes. The only new persisted content is the already-existing truncation log line on runs that truncate a diff.
   - **Lint:** the Q-0044 static `input.diff` rule remains authoritative and unchanged; the runtime guard remains its dynamic counterpart.
   - **Cold-clone impact:** no new command, option, dependency, setup step, or required documentation is introduced.

## Non-goals

- Fixing Q-0038's known mixed-endpoint timing and diagnostic gap unless Q-0038 lands in the spike before this port begins and its accepted behavior is then ported verbatim.
- Editing any file under `spike/**`, deleting the spike, or changing frozen spike tests.
- Changing Q-0044's flow lint behavior or making `flattenSteps` descend into fan-out templates.
- Adding, changing, or documenting `harness run --base`; Q-0077's shipped behavior is only preserved here.
- Changing what an interpolated branch, `into`, or diff value means beyond the required explicit string conversion.
- Changing the three merge-source sites that read `config.repo.base_branch`.
- Fixing a defect discovered while reading the spike; such a defect stops this child and is recorded separately under the port charter.
- Porting prompt construction, adapter execution, fan-out execution, integration, lifecycle, routing, run-history persistence, or another Q-0009 child's module.
- Adding configuration fields, a new file format, an adapter-contract change, a dependency, a CLI command, or a CLI option.
- The cutover, the `quorum` binary, event-stream persistence, budget enforcement, or any v1 exclusion-list item, including multi-user operation, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

1. **Blocker — must Q-0038 land before implementation?** Owner: **ruud**. Q-0038 is still draft and the current spike defers a whole range when either endpoint is step-created. That can allow a missing pre-existing endpoint on the other side to survive until after the producer is billed, and the resulting diagnostic may omit the producer when that other endpoint fails. Decide one of the following before implementation starts:
   - land Q-0038 in the spike and port its accepted, tested behavior; or
   - explicitly accept the current spike behavior for Q-0051 and leave both halves to Q-0038 in core later.

   This is blocking because silently resolving it in the port would be an unauthorised behavior change, while porting the current file during Q-0038's spike edit risks implementing against a moving source.

## Risks

- **False confidence from repository access.** An adapter may compensate for absent prompt evidence by reading the working tree, so tests must assert the supplied material and adapter-call boundary directly.
- **Moving-source risk.** Q-0038 can change the exact preflight classification and diagnostic behavior. Starting the port before OQ-1 is settled can produce two implementations with different contracts.
- **Module guard risk.** Adding `diff.ts` without updating Q-0050's exact folder pin fails an otherwise green suite; weakening that pin would remove deliberate protection for Q-0051 through Q-0053.
- **Base conflation risk.** Reading the diff anchor from configuration inside `materialiseDiff` would silently defeat `--base` while leaving unrelated merge behavior apparently healthy.
- **Caching risk.** Materialising at each prompt site can give panel members different evidence and multiply Git work; caching by the written template instead of the interpolated range can incorrectly combine per-task evidence.
- **UTF-8 risk.** Byte truncation followed by ordinary string decoding can introduce a replacement character when the cut splits a multibyte code point. Character-count truncation would violate the configured byte limit.
- **Diagnostic overclaim risk.** Treating Git exit 1 as conclusive in a shallow repository, or catching all ancestry failures as `false`, turns an indeterminate result into a false historical claim.
- **Dry-run presentation risk.** A deferred check that produces no failure can be rendered as passed by a caller unless its skipped state is explicit.
