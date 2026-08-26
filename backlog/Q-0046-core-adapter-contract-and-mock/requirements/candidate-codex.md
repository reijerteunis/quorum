# Q-0046 — Core adapter contract and mock adapter

## Problem

The vendor-independent adapter contract exists only in `spike/src/adapters/`. Its JavaScript shapes and shared behaviours are enforced partly by convention, so an adapter contributor cannot implement a new adapter against a strict TypeScript interface in `packages/core`.

The mock adapter is also still in the spike. Tests and demos depend on it to exercise adapter calls without invoking a paid subscription. Q-0054 cannot port the end-to-end regression suite until the mock is available from `packages/core`.

This ticket ports the contract layer and mock without changing externally observable behaviour. It touches the `packages/core` developer API and its unit tests. It does not add or change a CLI, Studio, `harness/`, or `backlog/` surface.

## User stories

As an **adapter contributor**, I want a strict, documented TypeScript adapter contract and shared contract utilities in `packages/core`, so I can add an adapter without reimplementing retry, authentication-error classification, probing, structured-output extraction, or validation.

As a **maintainer**, I want the existing mock adapter and its control switches available in `packages/core`, so ported tests and demos can exercise flows deterministically without invoking a vendor subscription.

As a **cold-clone adopter**, I want subscription-only enforcement and explicit login verification to remain unchanged during the port, so a presence check cannot be mistaken for proof that a subscription login works.

## Acceptance criteria

1. **Contract exports — `packages/core`.** `packages/core` exports strict TypeScript types for the adapter contract described by `docs/03-adapter-contract.md`. The types cover:
   - `vendor`;
   - asynchronous `check()`;
   - `run()` inputs `prompt`, `schema`, `model`, `cwd`, `extraDirs`, `allowWrite`, `maxTurns`, and `onEvent`;
   - successful results containing `output`, `raw`, `usage`, `session`, `vendor`, and `ms`;
   - the retry wrapper's `attempts` result;
   - nullable usage measures `input_tokens`, `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, and `cost_usd`.
   No exported contract type uses `any`, and `onEvent` accepts the adapter event union exported by `packages/shared` rather than declaring a second event shape.

2. **Contract documentation — `packages/core`.** The adapter module and every exported symbol and interface field have JSDoc that states their contract. Counterintuitive preserved behaviour cites its authority in one line. The implementation does not copy ticket or decision prose into source comments.

3. **Adapter lookup — `packages/core`.** `getAdapter(name, config)` preserves the spike contract: it resolves a known adapter, supplies that adapter's configuration, applies its retry configuration, and rejects an unknown name with an error that includes the rejected name and the known names. The registry boundary must follow the answer to Open question 1.

4. **Retry classification — `packages/core`.** `transientError(text)` returns the same descriptions as the spike for connection closure or failure, socket failure, recognised network error codes, failed fetches, rate limits, overload, HTTP/server codes `429`, `500`, `502`, `503`, `504`, and `529`, temporary unavailability, interrupted streams, and timeouts. It returns `null` for unrecognised failures and for every failure recognised by `authError`, including unsupported subscription-model failures.

5. **Retry execution — `packages/core`.** `withRetry(adapter, options)` preserves the spike defaults of five total attempts, a 5,000 ms base delay, a 60,000 ms maximum delay, and exponential delays capped at that maximum. A unit test uses zero or controlled delays; it does not wait on the production defaults.

6. **Retry events — `packages/core`.** Before each retry delay, `withRetry` emits the shared `{ type: "retry" }` event with the adapter vendor, failed attempt number, total allowed attempts, selected delay, classification reason, and the failure message truncated to the spike's 160-character limit. It emits no retry event for a terminal failure or after the last permitted attempt. No vendor-specific event field or event branch is introduced outside an adapter.

7. **Retry accounting — `packages/core`.** Across failed and successful attempts, `withRetry` preserves the spike's accounting rules:
   - each reported usage measure is summed independently;
   - an unknown measure remains `null` until an attempt reports it;
   - cache measures are not added again to `input_tokens`;
   - a result or thrown error reports the actual attempt count;
   - a per-call vendor declaration takes precedence, with the adapter vendor used only when the call omits one;
   - when no attempt reports any usage measure, the wrapper returns `usage: null` and does not invent a usage row;
   - a terminal or exhausted thrown error carries accumulated usage and vendor only when at least one measure was reported; and
   - exhaustion adds the existing “gave up after N attempts” suffix only when the last failure remains transient.

8. **Actionable authentication errors — `packages/core`.** `authError(vendor, text)` preserves the spike's recognised authentication-failure patterns and returns the existing actionable subscription-login instruction for known and contributor adapters. It returns `null` for unrelated failures. An unsupported-model message names the unavailable model and subscription type, instructs the caller to remove the model selection, and does not instruct the caller to log in again.

9. **Probe schema strictness — `packages/core`.** `PROBE_SCHEMA` declares an object with only `ok: boolean` and `summary: string`, sets `additionalProperties: false`, and lists both properties in `required`. A mechanical test fails if any property declared by `PROBE_SCHEMA` is absent from `required`. The port does not duplicate or take ownership of `schemaFor`; its equivalent all-properties-required test remains with the module that owns `schemaFor`.

10. **Authenticated probe — `packages/core`.** `probeAdapter(adapter, options)` preserves the spike behaviour:
    - it makes one minimal adapter `run()` call with `PROBE_SCHEMA`, no extra directories, and writes disabled;
    - it uses the supplied `cwd` when present, otherwise creates and removes a disposable empty directory;
    - it returns success only when the returned output passes `checkAgainstSchema`;
    - success reports vendor, elapsed milliseconds, nullable cost, total input plus output tokens, and session;
    - invalid structured output returns a failed report containing the validation problems and at most the first 400 characters of raw output;
    - a thrown failure returns a failed report and applies `authError`; and
    - cleanup occurs after success, invalid output, or a thrown failure.
    Tests use the mock or a local fixture and make no paid request.

11. **Presence is not login proof — contract behaviour.** The exported contract states that `check()` is a cheap presence check and makes no authenticated request. Its successful result states that subscription logins are unverified. Only `probeAdapter`, later exposed by `adapters --probe`, performs an authenticated round trip. This ticket does not add or change that CLI command.

12. **BYOS refusal order — contract behaviour.** Before any CLI presence probe can run, `check()` refuses an environment containing `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY`. Tests independently cover all three names and prove that refusal occurs even when the configured CLI executable is missing. The enforcement location must follow the answer to Open question 2. No production path, test helper, fixture, or documentation example accepts or uses one of these values to invoke a vendor.

13. **Vendor-wrapper extraction — `packages/core`.** `extractJson(text)` preserves the spike's ordered tolerance:
    - return the last valid fenced JSON payload, checking fences from last to first;
    - otherwise try the final newline-prefixed object tail;
    - otherwise try the entire trimmed text; and
    - return `null` for empty or unparseable text.
    Extraction does not weaken, repair, or default the parsed object to make it pass Quorum's schema.

14. **Strict Quorum-output validation — `packages/core`.** `checkAgainstSchema(output, schema)` preserves the spike's independently reported validation problems for:
    - a non-object or array output;
    - missing required properties;
    - unknown properties when `additionalProperties` is false;
    - enum violations;
    - invalid or too-short strings;
    - non-array values, minimum and maximum item counts, non-string items, and string-item pattern violations; and
    - verdict/findings coupling: the first verdict value requires empty findings, while every other declared verdict requires at least one finding.
    A test proves that an approving verdict with findings and a non-approving verdict without findings are rejected. Vendor-wrapper tolerance remains solely in `extractJson`.

15. **Explicit invalid-output hand-off.** The validator returns all detected problems and never substitutes a value or silently chooses a verdict. Tests preserve the raw adapter result needed by the run layer to save invalid output and stop. Writing the raw file beside the ticket and raising the run-level error remain owned by Q-0050; this ticket does not write into `backlog/` or `.quorum/`.

16. **Mock adapter — `packages/core`.** `mockAdapter(config)` implements the exported adapter interface and preserves the spike's deterministic behaviours: version check; configurable delay; per-role and per-task call counting; `stdout` event; summary, document, probe, verdict, and findings output; principal-architect contract file; automation-QA check script; developer source file; simulated write failure with billed usage; flaky second task; forced pass or fail; mutually exclusive forced pass and fail; vendor override; token-only mode; cache-bearing usage profiles; and `session: null`.

17. **Mock usage validation — `packages/core`.** The mock preserves the spike rules that numeric switches must be finite non-negative numbers, malformed or non-object run-history profiles fail explicitly, role profiles must be objects, cached-input fields are included within `input_tokens`, and token-only calls report `cost_usd: null`. Tests restore every process environment variable and shared mock counter they change, so their order does not affect results.

18. **Mock write containment — `packages/core`.** When `allowWrite` is false, the mock creates no contract, test, or source file. When it is true, it writes only the same relative fixture paths under the supplied `cwd` as the spike. Tests run in disposable directories and prove that no file is created outside the supplied directory. This criterion tests the mock boundary only; flow worktree creation and branch safety belong to later core tickets.

19. **Port fidelity and tests.** Unit-level tests for every behaviour in criteria 3–18 are ported with the module and pass under the workspace test command. The implementation does not modify `spike/**`. A source or behavioural discrepancy discovered during the port stops implementation and is reported; it is not fixed in passing. No new runtime dependency is added unless its one-line justification and required decision record are included.

20. **Package boundary.** `packages/core` imports shared schemas, constants, and adapter event types from `packages/shared` where they already exist. `packages/shared` does not import `packages/core`. Vendor-specific CLI parsing, invocation flags, and stdout-envelope handling remain outside this ticket for Q-0047. Failures supplied to the contract utilities must include stdout-derived vendor messages when the adapter has them; this ticket does not classify stderr as the sole authoritative failure stream.

21. **Cross-cutting verification.** The delivered test report records:
    - **BYOS:** applicable; criterion 12 passes and no subscription-secret invocation path was added;
    - **worktree safety:** limited to mock write containment in criterion 18; flow worktrees are otherwise not in scope;
    - **gate behaviour:** not applicable; no gate is added or changed;
    - **persistent files and schemas:** no persistent format changes; `PROBE_SCHEMA` is covered by criterion 9;
    - **lint and cross-vendor rule:** not applicable; no flow lint rule is added or changed;
    - **cold-clone impact:** no new setup step and no paid request in tests; and
    - **product-agnostic:** mock fixture names remain generic and no product-specific behaviour is added.

## Non-goals

- Porting the Claude or Codex adapter, their CLI invocations, their stdout parsers, or their capability declarations; Q-0047 owns them.
- Porting `schemaFor`, the engine, run-level raw-output persistence, or run stopping; their owning child tickets retain that work.
- Adding or changing the `quorum` binary, `adapters`, or `adapters --probe` command; Q-0010 owns the binary and later tickets perform cutover.
- Editing any file under `spike/**` or deleting the spike.
- Fixing a defect or changing observable behaviour found while reading the spike without a separately accepted decision or erratum.
- Persisting the adapter event stream.
- Adding a Gemini adapter or any other v1-excluded adapter.
- Adding an adapter plugin marketplace or runtime adapter discovery system.
- Changing flow, ticket, role, project, run-history, or task file formats.
- Implementing flow worktrees, branch management, gates, budget enforcement, the Studio, a remote daemon, cloud sync, multi-user support, a visual canvas, eval suites, or a desktop shell.
- Making `check()` authenticate, treating a successful presence check as proof of login, or making tests invoke a paid subscription.
- Expanding `checkAgainstSchema` into the ajv validator used for solutioning contracts.

## Open questions

1. **Blocker — adapter registry before Q-0047. Owner: core maintainer.** `getAdapter` is in this ticket, but the Claude and Codex factories are owned by dependent ticket Q-0047. Should Q-0046 ship a registry containing only `mock`, accept factories through an internal registration seam, or land the contract and Q-0047 atomically? The answer changes the exported or internal adapter boundary and must be settled before implementation. It may not be resolved by importing unported vendor modules or inventing runtime plugin discovery.

2. **Blocker — location of the BYOS guard. Owner: product owner and core maintainer.** Register row 1 assigns refusal ordering to Q-0046, while the spike implements the actual environment checks inside the two vendor adapters owned by Q-0047 and the mock's direct `check()` does not perform them. Should the port centralise the guard in the contract wrapper so every contributor adapter inherits it, or preserve the per-vendor implementation until Q-0047? Centralising can preserve vendor-observable behaviour but changes the internal contract and may change direct mock behaviour. This requires an accepted answer before code is written.

3. **Non-blocker unless the source disagrees — mock call-counter reset. Owner: core maintainer.** The spike holds counters in module-global state and exports no reset function. Should tests isolate modules/processes to preserve that behaviour, or is a test-only reset export permitted? Default: preserve the public surface and isolate tests. Any production reset export would change the contract and needs an explicit decision.

## Risks

- The dependency direction between Q-0046 and Q-0047 can create either a temporary incomplete registry or an accidental import of another child's module. Open question 1 must be resolved before implementation.
- Moving subscription-secret refusal into a wrapper could unintentionally change direct mock use; leaving it in vendor adapters would weaken the stated contributor contract. Open question 2 prevents that choice from being made silently.
- TypeScript types can accidentally narrow fields that are nullable or vendor-open in observed results, causing Q-0047 to work around the contract instead of conforming to it.
- Retry accounting is easy to alter while typing the code, especially all-null usage, per-call vendor attribution, cache subsets, and usage attached to thrown failures.
- Fake timers or shared process environment changes can make retry and mock tests order-dependent unless each test restores global state.
- A permissive validator could advance a flow on contradictory findings; an over-broad extractor could hide malformed output. Their responsibilities must remain separate.
- Tests that invoke a real adapter would spend subscription capacity and make the suite dependent on local login state. All Q-0046 tests must use the mock or local fixtures.
