# Q-0045 — core/contracts: AJV validation and run-manifest semantics

## Problem

Quorum has two related contract capabilities in the spike that are not available from `packages/core`:

1. Generic execution of solutioning-authored JSON Schema contracts using JSON Schema draft 2020-12 and `format` validation.
2. Product-level semantic validation for `run-manifest-v1`, covering lifecycle, occurrence, and roll-up invariants that JSON Schema cannot express.

The second capability currently lives inside the spike CLI. That makes a versioned product contract unavailable to later core consumers, including M3's server, and difficult for contributors to discover.

The port must preserve the spike's behavior. In particular, a schema with a missing or unknown `x-quorum-contract` annotation still receives structural validation, but its run-manifest semantic checks are explicitly reported as **skipped**. Skipped must never be represented as passed.

This ticket touches `packages/core` and its unit tests. It does not add or change the `quorum` CLI, the Studio, `harness/` file formats, `backlog/` file formats, or `.quorum/` persistence.

## User story

As a **maintainer**, I want core to execute solutioning-authored JSON Schema contracts and their recognised product-level semantic checks, so that every product surface can apply the same contract without relying on spike CLI code.

As a **contributor**, I want the generic validator and the versioned run-manifest semantic pass to be exported from the core package and tested against repository artifacts, so that I can find, reuse, and safely extend contract behavior without duplicating it in a command.

## Acceptance criteria

1. **Generic JSON Schema validation — `packages/core`.** Core exports a `validate(schema, data)` operation that validates data using AJV's draft 2020-12 implementation with `ajv-formats` enabled. Conforming data returns `{ ok: true, errors: [] }`. Nonconforming data returns `{ ok: false, errors: string[] }` and does not throw. An invalid or uncompileable schema remains an authoring error and throws rather than being converted into a data-validation result.

2. **Preserved AJV behavior — `packages/core`.** The AJV instance preserves the spike configuration of `allErrors: true` and `strict: false`; this ticket does not tighten or relax schema compilation behavior. Validation reports all detected violations, including `oneOf`, `if/then`, `format: date-time`, nested `required`, enum, type, and `additionalProperties` violations.

3. **Validation diagnostics — `packages/core`.** Each returned validation error uses the spike format `<instance path or />: <AJV message>`. When AJV identifies an additional property, the diagnostic also includes that property's name in parentheses. Tests assert the precise path and message content needed to locate nested and conditional failures; callers are not required to inspect AJV error objects.

4. **Data-file reading — `packages/core`.** Core exports `readData(file)` with the preserved file rules: a case-insensitive `.yaml` or `.yml` suffix is parsed as YAML, and every other suffix is parsed as JSON. File-read and parse failures are allowed to throw. Markdown/frontmatter extraction and format inference from file contents are not added.

5. **File validation — `packages/core`.** Core exports `validateFile(schemaFile, dataFile)`. It reads both files through `readData`, validates the data, and returns the validation result plus `schema` and `data` fields containing only the respective basenames. Read, parse, and schema-compilation failures are allowed to throw.

6. **Roll-up recomputation — `packages/core`.** Core exports `computeManifestRollup(steps)`. It groups only occurrences with non-null `usage` by the exact `usage.vendor` value and returns one map entry per such vendor. Each entry contains `vendor`, `step_count`, `unpriced_steps`, `input_tokens`, `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, and `cost_usd`. `step_count` counts usage-bearing occurrences; `unpriced_steps` counts occurrences whose `cost_usd` is null; each numeric field sums only non-null reported values and remains null when every occurrence reports null. Reported zero remains zero and is not treated as null.

7. **Manifest uniqueness and lifecycle semantics — `packages/core`.** Core exports `checkRunManifestSemantics(data)`, returning an array of error strings and not throwing for semantic violations. It reports duplicate `occurrence_dir` values, duplicate roll-up vendor rows, a terminal run with null `ended_at` or `duration_ms`, a running run with non-null `ended_at` or `duration_ms`, and a non-null run duration that differs exactly from `Date.parse(ended_at) - Date.parse(started_at)`. The terminal status set is the same set used by the spike.

8. **Occurrence semantics — `packages/core`.** `checkRunManifestSemantics` reports each preserved occurrence violation independently: an adapter occurrence with a null adapter; a non-adapter occurrence with a non-null adapter, model, or usage; a terminal occurrence with null `duration_ms`; and a running occurrence with non-null `duration_ms`. Diagnostics identify the occurrence by `step_id` and preserve the spike's distinction between adapter and non-adapter kinds.

9. **Exact persisted roll-up comparison — `packages/core`.** `checkRunManifestSemantics` recomputes the roll-up through `computeManifestRollup` and compares all seven computed fields using exact equality. It reports a missing persisted row for a vendor with occurrence usage, every mismatched field with both persisted and recomputed values, and a persisted vendor row for which no occurrence reports usage. A persisted `cost_usd: 0` therefore fails when the recomputed value is `null`, while a genuinely reported zero passes.

10. **Annotation selection and skipped state — `packages/core`.** Core exposes one package-level operation or result shape that combines structural validation with product-contract selection. The exact annotation value `x-quorum-contract: run-manifest-v1` selects `checkRunManifestSemantics`, and semantic checks run only after structural validation succeeds. A missing annotation or any unknown value performs structural validation but returns an explicit semantic status of `skipped`; it must not return or imply a semantic status of passed. Selection is not based on filename, path, title, or `$id`. A recognised annotation with no semantic errors reports semantic checks as passed; semantic errors report failure and are included in the result.

11. **Separation from adapter validation — `packages/core`.** The implementation does not import, call, replace, or change `checkAgainstSchema` or vendor-output extraction. The AJV contract validator remains a separate core capability, and no vendor-specific parsing or tolerance is introduced into it.

12. **Repository-artifact acceptance tests — `packages/core` tests.** Tests use the committed `contracts/Q-0006/ticket-review-state.schema.json` and the committed Q-0006 ticket state, rather than replacing them with a simplified schema fixture. They prove that the real valid state is accepted and malformed variants are rejected with useful errors across `oneOf`, `if/then`, `format: date-time`, and nested `required`. Tests also use `contracts/Q-0011/run-manifest.schema.json` and manifest variants derived from repository artifacts to cover every semantic rule in AC-6 through AC-10, including null-versus-zero cost.

13. **Package integration and regression — `packages/core`.** `@quorum/core` declares `ajv` and `ajv-formats` as direct runtime dependencies, retains `yaml`, and exports the public contract operations through the package's established source entry point. TypeScript remains strict with no `any` or unexplained `@ts-ignore`. Core lint, typecheck, and tests pass, and the existing mock-adapter end-to-end regression suite remains green.

14. **Port boundary — repository.** No file under `spike/**` is edited or deleted. If implementation or test porting exposes behavior that differs from the spike, work stops and the difference is reported; it is not fixed in this ticket without an accepted erratum or decision. The implementation names inherited invariant-register rows 13 and 14 in its test or solution evidence.

## Non-goals

- Adding or changing the `quorum` binary or porting the spike's `harness validate` command; Q-0010 owns the binary and later cutover work owns CLI wiring.
- Changing `checkAgainstSchema`, `extractJson`, an adapter, or vendor-output tolerance.
- Replacing JSON Schema or AJV with the Q-0041 Zod schemas.
- Adding a new contract annotation value or changing the `run-manifest-v1` schema.
- Adding JSONL parsing, event-stream persistence, or any other event-stream capability.
- Writing, repairing, migrating, or atomically replacing run manifests.
- Changing `.quorum/`, `backlog/`, `harness/`, ticket, manifest, or roll-up file formats.
- Rendering CLI symbols, text, colors, or exit codes for passed, failed, or skipped validation.
- Editing or deleting any file under `spike/**`.
- Fixing a defect discovered while reading or porting the spike.
- Porting another Q-0009 child ticket's module or performing the M2 cutover.
- Adding budget enforcement, multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **What is the public result type for the combined structural and semantic validation in AC-10?** The result must distinguish `passed`, `failed`, and `skipped` without inference, but neither the spike helper nor the current core package defines a reusable type. **Owner: solution architect. Blocker: yes**, because Q-0049 and the later server will code against this package API. The decision must not change the preserved validation or semantic rules.

2. **Should `computeManifestRollup` return a `Map`, matching the spike, or a serialisable array/object?** AC-6 requires the preserved grouping and values, but changing the container affects downstream callers without changing the calculation. **Owner: solution architect. Blocker: yes** for the exported TypeScript signature; default to the spike's `Map` only if no accepted solution document resolves it differently.

3. **Which existing committed run manifest should be the canonical valid semantic-test input?** `contracts/Q-0011/run-manifest.schema.json` is fixed, but the ticket does not identify one durable manifest path. **Owner: engineer. Blocker: no.** Use an existing committed manifest if one is stable; otherwise derive variants from the real schema and committed run-history artifacts while keeping the real schema unchanged.

## Risks

- **False success:** A boolean-only combined result could collapse skipped semantics into success. The explicit three-state result and tests in AC-10 are the primary control.
- **Accidental behavior change:** Translating dynamic JavaScript into strict TypeScript may invite new guards, coercions, or stricter AJV settings. The spike-compatible cases and error strings are the authority for this port.
- **Null-to-zero corruption:** Generic summing utilities often initialize totals to zero. That would erase the product distinction between unpriced usage and a reported zero. AC-6 and AC-9 require dedicated regression cases.
- **Public API churn:** Q-0049 depends on this ticket, and M3 will consume the same product contract. An underspecified combined result or roll-up container would move ambiguity downstream; OQ-1 and OQ-2 must be resolved before implementation is accepted.
- **Artifact brittleness:** Tests tied to real repository artifacts can fail when those artifacts legitimately evolve. This is intentional contract evidence; an artifact change must be reviewed as a contract change rather than hidden behind a simplified fixture.
- **Dependency duplication:** AJV and Zod serve different contract languages. Future cleanup could incorrectly remove one after seeing overlapping validation code; AC-11 and the dependency justification preserve the boundary.

## Cross-cutting checklist

| Concern | Requirement |
| --- | --- |
| BYOS | N/A. No adapter execution or subscription handling is added. No API-key path, fixture, or example may be introduced. |
| Worktree safety | N/A at runtime. The module is read-only apart from reading files requested by its caller and does not create or modify a worktree or working-tree file. |
| Gate behavior | N/A. No flow or gate behavior changes. The chore route still ends at its existing human gate. |
| Files are the database | Preserved. `readData` reads caller-selected files; this ticket adds no persistence or hidden daemon state. |
| File format and schema | No format changes. JSON and YAML parsing behavior is preserved; `run-manifest-v1` remains selected only by its schema annotation. |
| Lint rules | No flow-lint rule changes. TypeScript, ESLint, and package-boundary rules apply to the new core module. |
| Cross-vendor rule | N/A. No reviewing or judging step is created or changed. Roll-up grouping uses neutral vendor labels and adds no vendor-specific logic. |
| Human-gated default | N/A to the library behavior; no `auto` or `human-locked` behavior changes. |
| Product-agnostic | Required. The validator and semantic pass contain no knowledge of a specific SaaS product or vendor behavior. |
| Explicit errors | Required. Structural and semantic failures remain explicit; skipped semantic validation is represented as skipped, never passed or silently defaulted. |
| Cold-clone impact | None expected. No CLI command, setup step, configuration, or first-run interaction changes. |
