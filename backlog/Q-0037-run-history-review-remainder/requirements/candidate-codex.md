# Q-0037 requirements — Run-history review remainder

## Problem

Run history contains one process-lifecycle defect and seven live review findings after the TypeScript port closed.

The lifecycle defect can let a process waiting at a gate exit successfully after an engine-owned one-second timer expires, while its manifest still says `running`. The timer exists to support a test fixture that owns no event-loop handle; neither shipped gate path needs it, and `packages/core` uses caller-owned cancellation rather than signal handling.

The remaining findings affect manifest-write cost, stale temporary files, CLI reporting, validation reads and messages, and documentation of an intentionally retained stage guard. They currently differ between the independent `spike/` and `packages/core/` implementations.

The live scope is one major finding plus seven items:

1. Remove the engine-owned gate timer.
2. Avoid rewriting and synchronising the complete manifest once per terminal occurrence.
3. Handle a stale `manifest.json.tmp` left by an interrupted atomic write.
4. Retain and document the stage guard in the spike.
5. Correct the spike CLI's per-step usage output.
6. Make spike validation read each artifact once.
7. Make the spike validation skip message contract-neutral.
8. Rule on cache-only malformed usage: retain `tokens=n/a` rather than treating cache measures as additional totals.

Surfaces touched: the CLI, `.quorum/` run-history files, `spike/`, `packages/core/`, and the port-freeze record in `harness/port-charter.md`. There is no Studio change.

### Gate action before implementation

Before an implement step starts, the maintainer must land a separate decision entry resolving how an append-only `docs/DECISIONS.md` index orders a decision authored earlier but landed after newer decisions. The decision must choose which property governs index placement when chronological grouping conflicts with append-only insertion.

No step for Q-0037 may create or edit that decision entry. Q-0037 may start implementation only after the decision is present on its base branch. This is a route precondition, not an acceptance criterion for the Q-0037 change.

## User story

As a **solo maintainer**, I want a run waiting at a gate to remain alive until the gate resolves or cancellation is requested, and I want run-history persistence and CLI reporting to be accurate and bounded in cost, so that I can trust a completed process, its manifest, and its reported usage without maintaining divergent spike and core behaviour.

## Acceptance criteria

1. **Gate lifetime — spike.** In `spike/`, the engine does not create a one-second timer, or any replacement timer, solely to keep a pending gate alive. A regression test uses a pending gate fixture that owns its own event-loop handle, observes the manifest in `running` state, terminates the child through the existing signal path, and cleans up the fixture-owned handle.

2. **Gate lifetime — core.** In `packages/core`, gate routing creates no timer solely to keep the process alive. A test proves that a pending gate remains pending until its caller-provided `AbortSignal` is aborted and that cancellation follows the existing core cancellation contract.

3. **Q-0050 source pins.** The core source test is updated as one coherent change: the `AC-4h` assertion for the preserved timer and literal `1000` is removed, the matching `REGISTERED` entry for `routing.ts` is removed, and the explanatory authority-line arithmetic is corrected. The remaining identity register still uses exact equality and all remaining authority markers are still checked.

4. **No lifecycle masking.** Neither implementation may replace the removed timer with another engine-owned event-loop handle. Shipped TTY, non-interactive, and caller-cancelled gate paths retain their existing outcomes and exit codes.

5. **Bounded terminal persistence — spike.** When one integrate step produces multiple terminal occurrences, `spike/` updates the in-memory manifest for every occurrence and performs no more than one complete manifest serialisation, atomic replacement, and file synchronisation for that completed batch. A test with at least three terminal occurrences instruments the persistence boundary and verifies one persisted batch rather than one rewrite per occurrence.

6. **Bounded terminal persistence — core.** `packages/core` provides the same batching behaviour and the same observable final manifest as AC-5. A test with at least three terminal occurrences verifies that the persisted occurrence order and contents are unchanged and that no more than one complete manifest write-and-synchronise cycle occurs for the completed batch.

7. **Persistence boundary.** In both trees, the batched manifest is durably replaced before the integrate step is reported complete or its completion result is returned. A failed serialisation, write, synchronisation, or rename remains an explicit run error; it is not reported as a successful integrate step.

8. **Stale temporary file — spike.** Before `spike/` writes a run's `manifest.json.tmp`, it removes an existing temporary file for that same run. A test pre-creates a stale temporary file, performs the next manifest write, and verifies that the write succeeds, the final `manifest.json` contains the new complete document, and no `.tmp` file remains.

9. **Stale temporary file — core.** `packages/core` implements and tests the same stale-file handling as AC-8. Cleanup is limited to the known `manifest.json.tmp` beside the target manifest and must not remove any other file.

10. **Interrupted-write semantics.** In both trees, a temporary file is never treated as a readable manifest or recovery source. If no valid `manifest.json` exists, the existing explicit missing-or-invalid-manifest behaviour remains in force; stale temporary contents are not promoted silently.

11. **Retained stage guard.** The existing stage guard in `spike/src/engine.js` remains behaviourally unchanged and gains one concise authority comment explaining that it is intentionally reachable for programmatic ticket records even though the current CLI cannot reach it, citing `Q-0037` and this criterion. The corresponding core guard remains unchanged. No duplicate explanation of the ticket body is added.

12. **Per-step usage output.** The spike CLI's per-step `usage:` line is formatted by a per-occurrence formatter rather than by synthesising a vendor roll-up. It reports the occurrence's four stored measures separately—`input_tokens`, `output_tokens`, `cache_read_input_tokens`, and `cache_creation_input_tokens`—using the CLI's existing unavailable-value convention, and reports the occurrence cost using the existing cost convention. It does not print `unpriced_steps` and does not replace the four measures with one combined total.

13. **Usage-output regression coverage.** A CLI test supplies distinct values for all four usage measures and verifies that each value is associated with the correct label, cost is preserved, and neither `unpriced_steps` nor a synthetic combined total appears on the per-step line. Existing vendor-summary output remains unchanged.

14. **Single artifact read.** During one spike CLI validation request, each artifact is read and parsed no more than once before schema and semantic validation complete. A test instruments file reads and verifies one read for a valid artifact. The validated parsed value is passed to subsequent checks rather than re-reading the path.

15. **Read-race removal.** A spike validation test proves that schema validation and semantic validation operate on the same parsed value. There is no second read from which a different value could be observed.

16. **Contract-neutral skip notice.** When spike validation skips semantic checks because an annotation is unrecognised, the notice is `semantic checks skipped: unrecognised contract annotation` or an equivalently contract-neutral message. It must not say or imply that run-manifest checks were selected when validating another schema. Existing success/failure status and exit-code behaviour remain unchanged.

17. **Cache-only malformed usage ruling.** `vendorTokenTotal` in both trees continues to return no total when both `input_tokens` and `output_tokens` are absent, even if cache measures are populated. Cache measures are breakdown fields, not additional summands. Tests in both trees cover this malformed cache-only row and verify that the summary reports `tokens=n/a` while retaining any separately displayed cache measures.

18. **No silent repair of malformed usage.** Neither reader infers `input_tokens` from cache measures, adds cache measures to a total, or rewrites malformed stored usage. Existing schema or semantic validation behaviour for malformed manifests is unchanged by this ticket.

19. **Mirrored scope.** AC-1–10 and AC-17–18 are implemented in both `spike/` and `packages/core/` in one commit. AC-11 aligns documentation of the existing guard. AC-12–16 change only the spike CLI because `packages/cli` does not yet exist; this ticket does not create a core or future CLI counterpart.

20. **Port-freeze record.** The same commit that changes `spike/src` mirrors the applicable behaviour in `packages/core` and updates the machine-readable `freeze-sha` in `harness/port-charter.md` to that commit's required recorded value, following the charter's established procedure. No exemption trailer is added for Q-0037.

21. **Behaviour-change tests.** Every changed behaviour has automated regression coverage in the tree where it changes. Tests must fail against the pre-Q-0037 behaviour for the condition they cover and pass after the change.

22. **Required verification.** From a checkout with dependencies installed using `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`, both `npm test --prefix spike` and `pnpm turbo run test --force` pass.

23. **Run-history compatibility.** Existing valid manifest files remain readable without migration. The manifest file name, directory layout, JSON schema, occurrence ordering, and atomic write-via-rename convention do not change.

24. **CLI compatibility.** Apart from the per-step usage fields and contract-neutral skip wording specified above, existing CLI commands, arguments, exit codes, vendor-summary output, and validation results remain unchanged.

25. **Cross-cutting checks.** The completed change records the following results in its implementation evidence:

    - BYOS: no subscription-authentication or environment refusal path changes; no API-key path is introduced.
    - Worktree safety: no flow path writes to the user's working tree; run history remains under `.quorum/`.
    - Gate behaviour: human-gated defaults and `human-locked` behaviour are unchanged.
    - Files and schema: no manifest schema or persistent file-format change is introduced.
    - Cross-vendor rule: no flow or reviewing-step assignment changes.
    - Product-agnosticism: no product-specific behaviour or example is introduced.
    - Lint rules: TypeScript remains strict, with no `any`, new `@ts-ignore`, or deprecated API use.
    - Cold-clone impact: no new dependency, setup step, or user-visible delay is introduced.

## Non-goals

- Changing the run-manifest schema, version, directory layout, or occurrence model.
- Recovering or promoting data from `manifest.json.tmp` after an interrupted write.
- Guaranteeing cleanup at the instant of `SIGKILL`; cleanup occurs on the next write for that run.
- Changing the TTY interaction, non-interactive rejection, caller cancellation contract, gate defaults, or `human-locked` behaviour.
- Removing or changing the `initialiseRunHistory` stage guard.
- Treating cache measures as independent additions to input or output totals.
- Adding new validation rules for malformed cache-only usage.
- Changing vendor-summary formatting or roll-up semantics.
- Creating `packages/cli`, pre-implementing Q-0010, or manufacturing core counterparts for spike-only CLI findings.
- Revisiting findings already closed by Q-0045 or before Q-0011 landed.
- Repositioning or editing the existing product-level schema-annotation decision.
- Writing the separate decision about append-only index ordering within this ticket.
- Adding a dependency, daemon state, database, Studio surface, remote service, cloud sync, plugin marketplace, visual canvas, eval suite, Gemini adapter, or desktop shell.
- Splitting the required mirrored changes across separate commits or allowing the spike and core behaviours to diverge.

## Open questions

1. **Blocker — decision-index ordering. Owner: Ruud.** When a decision authored on an earlier date lands after newer decisions, should `docs/DECISIONS.md` append it at the end regardless of date grouping, or insert it under its authored date? This must be resolved by a separate landed decision entry before Q-0037 implementation begins.

2. **Non-blocking — exact unavailable-value spelling. Owner: engineer.** AC-12 requires the existing CLI unavailable-value convention. Confirm its current literal spelling in the affected formatter tests and retain it; this does not permit a new output convention.

## Risks

- Batching occurrence persistence could accidentally return success before the final manifest replacement is durable. AC-7 makes the completion boundary explicit.
- A test fixture that creates an interval or other handle could leak it and hang the suite. The fixture must own and deterministically release its handle during cleanup.
- Removing only the timer source line would leave Q-0050's identity register or arithmetic record false. AC-3 requires the three related pins to move together.
- Temporary-file cleanup could delete unrelated files if implemented with a glob or broad directory cleanup. AC-9 limits deletion to one resolved filename.
- Changing per-step usage formatting could unintentionally alter vendor roll-ups because both currently share a formatter. Separate regression coverage is required for both surfaces.
- Inferring a total from cache-only malformed data would make run-history reporting appear precise when the required total fields are absent. AC-17 explicitly retains `tokens=n/a`.
- Mirrored implementations may drift if tests assert only final output and not persistence count or cancellation ownership. Equivalent tests are required in both trees.
- Updating the freeze record incorrectly could make the port's independent-witness check misleading. The charter procedure and both full test suites must be applied to the final commit.
