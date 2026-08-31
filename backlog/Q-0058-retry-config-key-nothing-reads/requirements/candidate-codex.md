# Q-0058 — Make retry configuration explicit and enforceable

## Problem

The shipped `harness.yaml` example documents `adapters.<vendor>.retry.base_delay_ms`, but both adapter implementations read `baseDelayMs`. The documented value is therefore ignored without an error. The example conceals the defect because its value, `5000`, is also the implementation default.

The retry policy also supports a maximum delay, but no shipped harness file documents that field. An adopter cannot discover the complete policy without reading implementation code.

This is a file-format defect on the **harness** surface and a runtime validation defect on the **CLI** surface. It affects both the frozen spike implementation and its ported twin in `packages/core`. Fixing only the example would leave existing harness files silently wrong and would not prevent another misspelled Quorum-owned key.

For this ticket, multi-word keys written in `harness.yaml` are canonical snake_case. The retry block therefore uses `base_delay_ms` and `max_delay_ms`. The adapter implementation may retain camelCase internally, but conversion occurs once at the project-config boundary. Because Quorum owns the complete retry key set, unknown keys in that block are refused. Adopter-owned or extensible parts of the project configuration remain loose.

## User story

As a **cold-clone adopter**, I want the retry settings shown in my generated harness file to be the settings the CLI actually applies, and I want a clear error for a misspelled retry key, so that a flaky connection cannot trigger unexpected retry timing without warning.

As a **solo maintainer**, I want one stated naming convention and schema for Quorum-owned retry settings, so that configuration examples, validation, and both adapter implementations cannot drift silently.

As an **adapter contributor**, I want the external retry configuration translated into the adapter contract at one defined boundary, so that adapter code receives one stable internal retry-policy shape.

## Acceptance criteria

1. **Canonical retry file format — harness surface.** In both `harness/harness.yaml` and `spike/templates/harness/harness.yaml`, the commented retry example uses exactly the externally supported fields `attempts`, `base_delay_ms`, and `max_delay_ms`. The example gives valid values for all three and states that retry applies only to the already-supported transient failure classes. Neither shipped example presents `baseDelayMs` or `maxDelayMs` as harness keys.

2. **Naming convention is recorded.** A new append-only decision entry, indexed from `docs/DECISIONS.md`, states that new multi-word keys in `harness.yaml` use snake_case, while an implementation may map those keys to an internal TypeScript or JavaScript shape at a single config boundary. The entry identifies the previously documented camelCase exception `extraArgs` as retained compatibility, not precedent for new fields.

3. **Retry schema owns its complete key set — CLI and file-format surfaces.** `retryPolicySchema` accepts only `attempts`, `base_delay_ms`, and `max_delay_ms`. Any additional key directly inside `adapters.<vendor>.retry`, including `baseDelayMs`, `maxDelayMs`, or a misspelling, makes project configuration invalid. Strictness is limited to the retry object; top-level project keys and other intentionally loose adopter-owned configuration remain preserved according to the existing ownership decision.

4. **Project configuration is validated in production — CLI surface.** The production project-loading path calls `projectConfigSchema` before adapter configuration is used. The two existing source-text tests that forbid `.parse(` and `.safeParse(` in `packages/core/src/backlog/project.ts` are deliberately replaced or narrowed so they assert the intended boundary instead of forbidding all production validation. Validation is not test-only.

5. **Invalid retry configuration stops clearly — CLI surface.** When a loaded harness file contains an unknown retry key or an invalid retry value, the CLI stops before creating or running the selected adapter. The error identifies the configuration path at least through `adapters.<vendor>.retry` and identifies the rejected field or value. The CLI does not discard the field, substitute its default, or begin a retry attempt.

6. **External-to-internal mapping is singular.** Valid snake_case retry configuration is converted once into the existing internal retry-policy fields `attempts`, `baseDelayMs`, and `maxDelayMs` before `withRetry` performs delay arithmetic. Adapter implementations and retry arithmetic do not independently inspect both snake_case and camelCase spellings.

7. **Configured values affect behavior.** Automated tests use non-default values and prove independently that `attempts`, `base_delay_ms`, and `max_delay_ms` reach retry behavior. At minimum, the tests demonstrate that `base_delay_ms` changes the first retry delay and that `max_delay_ms` caps a later exponential delay. A test using `5000` alone is insufficient because it cannot distinguish successful mapping from the default.

8. **Defaults remain stable.** Omitting the retry block, or omitting any supported field within it, preserves the current defaults: `attempts = 5`, base delay `5000 ms`, and maximum delay `60000 ms`. Tests cover the omitted-block case and at least one partially specified policy.

9. **Both implementation trees remain equivalent.** The behavior in criteria 3, 5, 6, 7, and 8 is implemented and tested in both `packages/core/src/adapters/adapters.ts` and `spike/src/adapters/index.js`. The spike and ported core accept the same external keys, reject the same unknown retry keys, apply the same defaults, and calculate the same delays.

10. **Freeze bookkeeping is part of the change.** Any modification under `spike/src/` is mirrored into the ported implementation in the same change, and the machine-readable `freeze-sha` in `harness/port-charter.md` is re-recorded as required by charter §3. The relevant freeze-SHA check passes on the resulting commit. Q-0058 is not added retrospectively to Q-0009's closed `children` list merely to make the branch-scope check pass.

11. **Generated harness regression coverage.** An automated test exercises the harness-init template or its copied output and proves that the retry example contains `base_delay_ms` and `max_delay_ms` and can be uncommented into configuration accepted by `projectConfigSchema`. The test must fail if the template returns to camelCase or documents a field the schema does not accept.

12. **Existing harness compatibility is explicit.** A harness file containing the previously shipped `base_delay_ms` spelling loads successfully and applies its value. A harness file using the undocumented implementation spellings `baseDelayMs` or `maxDelayMs` fails with the explicit validation behavior in criterion 5; no permanent camelCase alias is introduced.

13. **Regression suites pass from an installed checkout.** After installing both dependency trees as required by `harness/rules.md`, `npm test --prefix spike`, `pnpm turbo run test --force`, and the repository lint command pass. The mock-adapter end-to-end suite and adapter probe/report coverage remain green.

14. **No unrelated behavior changes.** Existing classification of retryable versus non-retryable failures is unchanged. Authentication failures and model errors remain non-retryable, and the change does not alter adapter selection, command execution, gate behavior, or worktree placement.

15. **Cold-clone behavior remains direct.** `harness init` continues without an additional prompt or migration step. A newly copied harness file contains the corrected, complete example. An invalid retry block fails at config loading with an actionable message rather than later during a flow.

## Non-goals

- Renaming existing harness keys outside `adapters.<vendor>.retry`, including `extraArgs`.
- Enforcing or implementing currently unread values such as `budget.per_run_usd`, `budget.per_ticket_usd`, or `backlog.layout`.
- Making every object in `projectConfigSchema` strict; strictness in this ticket is limited to the Quorum-owned retry key set.
- Supporting both snake_case and camelCase retry spellings indefinitely.
- Migrating existing adopter repositories automatically. Existing documented `base_delay_ms` files become functional without migration; undocumented camelCase files receive an explicit error.
- Changing retry counts, default delays, backoff arithmetic, jitter, or the classification of transient failures.
- Adding a new dependency.
- Changing adapter subscription checks, BYOS behavior, worktree safety, flow gates, cross-vendor rules, or persisted run state.
- Correcting the stale Q-0058 cutover-follow-up identifier in `harness/port-charter.md`; that requires a separately identified ticket.
- Creating `harness/Q-0058/integration` as part of the implementation diff. Repository setup must create the branch before the chore run.
- Any v1-excluded capability, including multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

No product decision remains open for implementation. The following execution item is required but does not change the requirements:

1. **Who creates the integration branch?** Owner: repository maintainer. `harness/Q-0058/integration` does not currently exist and must be created before the chore run. This is repository setup, not product behavior.

## Risks

- Activating `projectConfigSchema` in production can expose schema drift outside the retry block. Mitigation: keep non-retry objects loose where ownership is not exclusive, add tests using the repository's real `harness/harness.yaml`, and treat any unrelated rejection as a blocker rather than silently broadening this ticket.
- Strict rejection of camelCase may break an adopter who inferred configuration from implementation code. The spellings were never shipped as harness documentation; the deliberate compatibility boundary and error behavior must nevertheless be recorded in the decision entry.
- The spike and ported core can drift if only one tree receives mapping or tests. The freeze bookkeeping and parity criteria make both halves mandatory in the same change.
- A template-only assertion can pass while runtime mapping remains broken, especially when the configured value equals the default. Non-default behavioral tests are required.
- Calling validation too late could allow adapter creation or side effects before failure. The production test must prove rejection occurs before the selected adapter is created or run.
- Re-recording `freeze-sha` incorrectly can make the port guard fail even when runtime behavior is correct. The implementing change must follow charter §3 and verify the guard against the resulting commit.

## Cross-cutting checklist

- **BYOS:** No change. No new subscription path or secret-bearing configuration is introduced.
- **Worktree safety:** No change. Retry parsing and validation do not write to the user's working tree or alter `.harness/worktrees/` behavior.
- **Gate behavior:** No change. Retry exhaustion and all existing gate transitions retain current behavior.
- **Files and schema:** Changed deliberately. The retry block becomes a strict Quorum-owned object with canonical snake_case external keys; other loose configuration remains loose.
- **Lint and tests:** Both dependency trees must be installed; both suites, lint, mock-adapter end-to-end coverage, adapter probe/report coverage, template coverage, and non-default timing tests must pass.
- **Cold-clone impact:** Improved. New adopters receive an accurate complete example, with no extra prompt or setup step, and invalid retry configuration fails before a flow begins.
- **Cross-vendor rule:** Not applicable. This change does not alter flow authorship, reviewing, or judging.
- **Product-agnostic behavior:** Preserved. Retry policy remains vendor-neutral and contains no product-specific knowledge.
