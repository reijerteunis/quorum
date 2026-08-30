# Q-0051 — core/engine diff preflight and materialisation

## Problem

A maintainer can currently run a reviewing step against a missing or empty diff. Because an adapter can inspect the repository directly, it may still return a plausible verdict, concealing that the evidence supplied by the flow was invalid. This can bill adapters before the failure is discovered and can allow a flow to advance on a verdict about no diff.

The spike prevents this with a run-level preflight and a materialisation path that validate each endpoint, reject empty ranges with reproducible evidence, defer only endpoints created by earlier steps, reuse identical diff bytes, and truncate at a valid UTF-8 boundary. This behavior is absent from `packages/core`.

This ticket ports the post-Q-0038 implementation from `spike/src/engine.js` as it exists on `main` at `a8ddbe3` or later. Line numbers in the ticket body are navigation hints only and must be re-derived from the current file.

Surfaces touched: CLI run behavior through `packages/core`; no new CLI option or output format is introduced. The `harness/`, `backlog/`, Studio, and adapter contracts are unchanged.

## User story

As a **maintainer**, I want every diff endpoint that can be checked before a flow starts to be validated before an adapter is billed, and every later-created endpoint to be checked at the earliest possible step, so that a missing or empty diff cannot silently become review evidence.

## Acceptance criteria

1. **Owned module and source boundary**

   Add `packages/core/src/engine/diff.ts` as the seventh engine module. It owns the ported equivalents of `named`, `diffSitesOf`, `classifyEndpoints`, `notDueClause`, `missingEndpointFailure`, `materialiseDiff`, `emptyRangeFailure`, and `trimIncompleteUtf8Suffix`, plus the run-level preflight entry point used by `runFlow`.

   `materialiseDiff` and the preflight entry point are exported for engine use and direct tests. Helpers that have no caller outside `diff.ts` remain private. Every export has JSDoc immediately anchored above its declaration.

   Update both deliberate pins in `packages/core/src/engine/q0050.source.test.ts`: the exact engine-folder file list and the file-keyed `Why:` authority register. The existing checks continue to cover all seven files: anchored export JSDoc, recognised authority clauses, no copied forty-character sentence from `docs/DECISIONS.md` or the relevant ticket body, no `console.*`, no prohibited `process.*`, no terminal escape sequence, and no import from `spike/`.

2. **Run-loop placement and failure lifecycle**

   `runFlow` invokes the diff preflight inside its existing run `try` block, after the start event/log and run-history initialisation and before the step loop invokes any adapter.

   A preflight failure follows the same failed-run path as another run error: active occurrences are finalised, the run receives its failed terminal record, normal rollback behavior applies, and the original error is rethrown. The preflight adds no second run path.

   Preserve the spike’s ordering in which the preflight iterates `flow.steps` before the loop reads `steps.length`. A flow without `steps` therefore exposes the spike-compatible raw `TypeError` message `flow.steps is not iterable`, rather than core’s former `Cannot read properties of undefined (reading 'length')`.

3. **Range guard**

   Before invoking Git for a diff, `materialiseDiff` interpolates the written `input.diff` and requires exactly two non-empty endpoints separated by exactly one `...`.

   Each endpoint must equal the run’s effective diff anchor or begin with `harness/<ticket-id>/`. The effective anchor is `ctx.vars.base`, with the existing configuration/default fallback retained only for directly constructed contexts. It must not be re-derived from `config.repo.base_branch` when `ctx.vars.base` exists.

   A rejected range names the step, effective base, allowed ticket prefix, and received range. No Git diff or ancestry operation runs for a rejected range.

4. **Per-endpoint preflight classification**

   The preflight examines every diff site in flow order and classifies the left and right endpoints independently. Its authority is: “A range is checked one endpoint at a time, because an endpoint is what can be absent” (2026-08-30).

   For each group, endpoint classification uses only branches created by strictly earlier groups:

   - `step-created`: an earlier group creates the exact interpolated ref;
   - `template`: a fan-out `step:` template endpoint still contains a per-task placeholder and no earlier group creates it;
   - `pre-existing`: every other endpoint, including one created only by the current group, a parallel sibling, or a later group.

   A worktree step contributes its interpolated explicit `branch`, or `harness/<ticket-id>/<step-id>` when omitted. An integrate step with `into` contributes its interpolated destination. The earliest producer of a ref wins.

   Branch and destination values are converted with `String(...)` before calling the strictly typed `interpolate`; numeric YAML values retain the spike’s interpolation meaning without widening `interpolate` or silently coercing inside it.

5. **Sites examined**

   The preflight examines both places a group member may declare diff evidence:

   - the member’s own `input.diff`; and
   - a fan-out member’s `step.input.diff`, identified in diagnostics as `<fan-out-id>.step`.

   A fan-out template is classified per endpoint. A template endpoint does not excuse a due, pre-existing endpoint from resolution. An outer step’s unresolved `{…}` text is not treated as a per-task template and fails as a missing pre-existing ref.

   A malformed range is not endpoint-classified; it is passed to `materialiseDiff` so the single range-shape guard owns its failure.

6. **Pre-existing evidence is checked before billing**

   When both endpoints are pre-existing, the preflight materialises the range before the first adapter call. Each distinct interpolated range is materialised at most once and stored in `ctx.diffInputs` for later consumers.

   A missing endpoint or empty range that can be determined from refs present or due when the run starts stops the run before any adapter call. Under `--dry`, the same preflight runs and reports the same validation result without persistent mutation.

   This guarantee is limited to evidence that exists or is due when the run starts. It does not promise zero adapter cost for a range whose endpoint an earlier step must create.

7. **Deferred evidence and earliest-possible failure**

   If either endpoint is `step-created`, the complete range is not materialised during preflight. The preflight records the range in `ctx.deferredDiffs` only when at least one endpoint is `step-created` and neither endpoint remains a per-task template.

   The deferred record retains every step-created endpoint in left-to-right order, including its ref, side, and producing step. Its compatibility fields name the first producer from the left.

   Every pre-existing endpoint in the same range is still resolved during preflight. A missing due endpoint fails before the producing adapter runs and the diagnostic explains that the other endpoint is not yet created, naming its producing step, rather than claiming that endpoint also failed to resolve.

   At step time, `materialiseDiff` validates both endpoints and the range. The producing adapter may have run; the consuming adapter must not run when the resulting evidence is missing or empty. A failure names whichever producing step owed each failed or deferred endpoint, independent of endpoint order.

8. **Missing-endpoint diagnostics**

   A missing-endpoint failure names:

   - the failing left or right endpoint;
   - the interpolated range and the flow-file value;
   - the other endpoint’s resolution state or why it is not yet due;
   - all relevant producing steps for a deferred range; and
   - that neither the diff nor containment check ran.

   When the missing ref equals the effective base, a run explicitly given `--base` attributes the value to `--base`, even if it equals the configured value. Without an override it attributes the value to `repo.base_branch in harness/harness.yaml`.

   A missing `harness/<ticket-id>/integration` ref states that review requires an integrated branch. Another missing ref is attributed to the diff-bearing step. Preflight and step-time materialisation use the same diagnostic builder.

9. **Empty-range evidence**

   After both endpoints resolve, an empty `git diff --stat <range>` is a failure. The diagnostic contains:

   - the step id;
   - the interpolated range and flow-file value;
   - both endpoint names and their resolved short SHAs;
   - for deferred evidence, the producing step and expected ref;
   - the containment command verbatim;
   - an outcome of exactly `contained`, `not contained`, or `indeterminate`, with an indeterminate reason/detail when available;
   - a diagnosis limited to facts established by Git; and
   - at most one remedy, which proposes only a range or action accepted by the range guard.

   Containment uses the single `ancestry()` primitive owned by Q-0042. No private catch-to-false ancestry implementation is added. The diagnostic does not claim a merge, cherry-pick, rebase, landing, or other historical event from commit containment.

10. **Empty-range outcome behavior**

    Preserve the post-Q-0038 result branches:

    - `contained`: report that the right endpoint is contained in the left and that the range spans no commits; for deferred evidence, tell the maintainer to check that the named producer committed its work; otherwise advise reviewing the right endpoint before it becomes contained;
    - `not contained`: report that fact and, when Git can determine it, distinguish identical endpoint trees from a right endpoint that adds nothing since the merge base; use the applicable committed-work remedy;
    - `indeterminate`: report that Git could not establish containment and advise re-running the displayed check and fixing what prevented Git from answering.

    These messages report evidence, not a story about how the commits arose.

11. **Materialised bytes and cache identity**

    For a non-empty range, `materialiseDiff` returns the spike-compatible prompt section containing the trimmed `git diff --stat` output and patch from `git diff <range>`.

    All consumers of the same preflighted interpolated range receive the exact cached bytes from `ctx.diffInputs`; the diff is not re-read for each panel member or fan-out task. The cache key remains the interpolated range string.

12. **Bounded UTF-8 truncation**

    The byte limit is `ctx.config.repo?.max_diff_bytes ?? 200000`. When the patch exceeds it, truncate the buffer to the limit and remove only an incomplete trailing UTF-8 code point before decoding.

    `trimIncompleteUtf8Suffix` preserves complete ASCII and valid two-, three-, and four-byte suffixes; removes an incomplete valid multibyte suffix; leaves an empty buffer empty; and does not scan beyond the final candidate code point.

    A truncated result appends the spike-compatible truncation notice with both retained UTF-8 byte count and configured limit, and appends the existing diff-truncation line to the run log. An untruncated result adds neither.

13. **Run context and integration seam**

    Extend `RunContext` with typed run-scoped `diffInputs` and `deferredDiffs` fields and initialise both maps once when `runFlow` constructs the context. Steps continue to receive the run’s own context object, not a spread copy, so preflight state survives to prompt construction.

    The implementation uses the existing `config`, `vars.base`, backlog, run id, Git, and ancestry seams. It introduces no duplicate base option, configuration loader, direct terminal output, process handler, or persistent state.

14. **Frozen regression coverage**

    Port the applicable behavior exercised by the current post-Q-0038 versions of:

    - `spike/test/q0035-empty-range.js`, scenarios E1–E17;
    - `spike/test/q0038-endpoint-preflight.js`;
    - `spike/test/q0034-chore-preflight.js`, B1–B5;
    - `spike/test/q0034-dry-run.js`, C1, C1b, C2, and C3;
    - `spike/test/q0034-review-fixes.js`, D1 and D2;
    - `spike/test/q0077-base-flag.js`, including all six direct `materialiseDiff` cases;
    - the applicable diff assertions in `spike/test/q0006-engine.js` and `spike/test/smoke.js`.

    Tests must include positive and paired negative cases proving that adapter calls are absent before a due preflight failure, permitted only for a necessary producer, and absent for the consuming step after deferred evidence fails.

    The port uses the current Q-0038 expectations, including E16’s `deepEqual(calls, [])`; it must not restore the obsolete whole-range `.find()` behavior or its former short-SHA expectation.

15. **Preservation and source guards**

    Existing workspace tests and the independent spike suite remain green after installing their declared dependencies. New core tests must fail against core before this port and pass after it; modifying `spike/**` to make the independent witness pass is prohibited.

    Any counterintuitive preserved behavior carries one `Why:` authority line in the form accepted by `classifyAuthority`. Comments cite the relevant acceptance criterion or ticket and do not reproduce durable decision or ticket prose.

16. **Known defect registration: Q-0078**

    Preserve and register, without fixing, the pre-existing Q-0078 defect: `ctx.diffInputs` is keyed only by interpolated range, and prompt construction prefers a cached entry even when a later site correctly defers the same range after a producer is introduced.

    The registration names Q-0078 and states that selecting site-based keys, invalidating on deferral, or rejecting the flow shape in lint is outside this ticket. No test may disguise the behavior as newly correct.

17. **Cross-cutting product checks**

    - BYOS: no subscription-login or adapter-check path changes; no API-key path, fixture, documentation, or example is added.
    - Worktree safety: the preflight and materialisation read repository evidence only. They do not write to the user’s working tree or alter branch/worktree creation.
    - Gate behavior: no gate rule changes. A diff failure stops before the affected consuming step can reach a gate.
    - Files and schema: no persistent file format or schema changes. Existing run history and `runs.log` behavior is reused.
    - Lint: the static range guard remains owned by Q-0044; this ticket does not duplicate or relax it.
    - Cross-vendor rule: unchanged.
    - Cold-clone impact: no new command, dependency, setup step, or user configuration is introduced.
    - Product-agnostic behavior: diagnostics and code contain no SaaS-specific behavior.

## Non-goals

- Changing any file under `spike/**`.
- Relaxing or redesigning the diff range guard or its Q-0044 lint twin.
- Fixing Q-0078’s cache-key defect.
- Adding a second preflight path for `--dry` or changing `--dry` mutation behavior.
- Changing what `--base` controls; it moves the diff anchor only, not any merge source or branch destination.
- Changing `interpolate` to accept non-string values or changing interpolation semantics.
- Changing adapter invocation, output, event, gate, run-history, ticket, flow, or project-configuration schemas.
- Persisting `diffInputs` or `deferredDiffs` beyond one run.
- Porting prompt construction, step execution, fan-out execution, integrate behavior, or another Q-0009 child’s module except for the minimum typed call seam required here.
- Fixing any other defect discovered while reading the spike; it must be reported and this port stopped pending an accepted decision or erratum.
- The cutover, the `quorum` binary, Studio work, a plugin marketplace, remote or multi-user operation, cloud sync, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Owner: engineering — non-blocking verification.** Does the current Q-0052 branch already define the prompt-side reads of `diffInputs` and `deferredDiffs`, or must this ticket expose only the typed fields and `materialiseDiff` API for Q-0052 to consume later? The answer may change imports and tests but must not change behavior or expand this ticket into prompt construction.

No file-format, schema, adapter-contract, or product decision remains open. If implementation reveals one, it is a blocker rather than an invitation to infer a new contract.

## Risks

- **Behavioral drift from stale source references.** The spike moved repeatedly and Q-0038 replaced whole-range deferral with per-endpoint classification. Mitigation: derive the port from current `main` and run the Q-0038 regression scenarios.
- **False green from incomplete coverage.** Reviewers can compensate for absent evidence by reading the repository. Mitigation: assert adapter call counts and exact preflight/deferred stopping points, not only final error text.
- **Wrong base under `--base`.** Re-reading the configured base inside materialisation would silently ignore the caller’s diff anchor. Mitigation: direct tests cover all six Q-0077 materialisation cases and keep merge-source behavior out of scope.
- **Lost shared run state.** A copied context would discard preflight maps before step execution. Mitigation: type and initialise the maps on the existing shared `RunContext` object.
- **UTF-8 corruption.** Byte truncation can split a multibyte code point and produce replacement characters or exceed the stated retained-byte count. Mitigation: boundary-focused unit tests cover complete and incomplete one- through four-byte suffixes.
- **Source-guard breakage outside the new module.** Adding a seventh file intentionally breaks Q-0050’s exact folder and authority registers. Mitigation: update both pins in the same change and retain their full-folder checks.
- **Accidental Q-0078 fix.** A seemingly safer cache or invalidation design would change preserved behavior and collide with identical-byte guarantees. Mitigation: register the defect explicitly and keep range-only keying unchanged.
