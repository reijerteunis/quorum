# Q-0047 requirements — core/adapters: Claude and Codex

Stage: draft · Iteration: 1

## Problem

Quorum's core package currently exposes the adapter contract and the mock adapter, but it cannot create or run the two vendor adapters proven during M0. `getAdapter('claude')` and `getAdapter('codex')` therefore fail even though the spike supports both names.

Porting the adapters is not a direct file translation. CLI flags and response fields vary by installed CLI version, so the target architecture requires each adapter to isolate that knowledge in a `capabilities.ts` module selected through a version probe. This is new behavior absent from the spike.

The port must also retain behavior that prevents personal CLI configuration, cross-vendor model leakage, incomplete Claude token totals, lost usage from failed requests, and API-key authentication from changing a run. CI cannot prove that an installed CLI's subscription login works; the final acceptance evidence requires a local authenticated probe.

Surfaces touched:

- `packages/core` adapter API and registry.
- The future `quorum adapters --probe` CLI path, as acceptance evidence only; implementing the binary or command remains Q-0010's scope.
- No Studio, `backlog/` persistence, or flow-file format changes.

## User stories

As a **solo maintainer**, I want Quorum to run Claude and Codex through their installed subscription-authenticated CLIs with predictable flags and truthful usage, so a versioned flow does not depend on my personal CLI configuration and run accounting does not hide paid work.

As a **cold-clone adopter**, I want adapter checks to reject API-key authentication before checking whether a CLI is installed, and I want a real probe to tell me whether my subscription login works, so setup failures are explicit and actionable.

As an **adapter contributor**, I want version-specific flags and response-field mappings isolated behind each adapter's capability module, so a supported CLI update can be handled without leaking vendor-specific logic into the contract, engine, or other adapters.

## Acceptance criteria

1. **Core exports and registry membership**

   `packages/core` exports factories for Claude and Codex adapters and the adapter-control function lifted from `spike/bin/harness.js:612`. `getAdapter('claude', config)` and `getAdapter('codex', config)` return retry-wrapped adapters whose `vendor` values are respectively `claude` and `codex`. The existing `mock` entry remains available. An unknown name retains Q-0046's exact error format and its known-name list is derived from the registry; after this ticket it includes `mock`, `claude`, and `codex`.

2. **Configuration reaches the selected adapter**

   For each registered vendor, `getAdapter` passes that vendor's `AdapterConfig` entry to its factory. `bin` replaces only that adapter's default executable, `extraArgs` are appended to that adapter's normal invocation, and the existing retry configuration continues to be applied by the contract layer. No new configuration field, flow field, environment variable, or dependency is introduced.

3. **API-key refusal precedes every executable probe**

   Before invoking the configured executable with `--version`:

   - Claude `check()` refuses when `ANTHROPIC_API_KEY` is set.
   - Codex `check()` refuses when `OPENAI_API_KEY` or `CODEX_API_KEY` is set.

   Tests cover all three variable names separately, spy on process creation to prove that no `--version` process was attempted, and repeat each applicable case with `bin` set to a missing executable. The refusal must remain the reported error when the executable is missing. No vendor adapter, test, fixture, documentation example, or configuration path accepts an API key.

4. **Presence checks do not claim login validity**

   With the relevant prohibited variables absent, each adapter's `check()` invokes its configured executable once with `--version`, returns trimmed stdout on exit 0, and throws an error identifying that vendor's CLI as not runnable on a spawn failure or non-zero exit. `check()` makes no authenticated request and is not presented as proof of a working subscription login; only Q-0046's `probeAdapter` provides that proof.

5. **Version-specific behavior is isolated per adapter**

   Claude and Codex each have a `capabilities.ts` module. All CLI-version-specific flag names, supported invocation shapes, JSON or JSONL field paths, and failure-event recognition used by the adapter reside in that vendor's capability module rather than in the contract layer, registry, engine, or the other vendor's adapter. Each adapter obtains the installed CLI version before selecting capabilities. Tests use fake executable output to select the supported M0 capability definitions for Claude Code 2.1.220 and Codex CLI 0.149.0 and prove that changing a mapped flag or field requires changing only the corresponding capability module and its tests.

   The behavior for unrecognised and malformed versions is blocked by OQ-1 and must be settled before implementation.

6. **Claude invocation matches the verified capability**

   For the M0-verified Claude capability, `run()` reads the complete prompt from stdin and invokes the configured executable with:

   - `-p`;
   - `--output-format json`;
   - `--json-schema` followed by the serialized step schema;
   - `--permission-mode acceptEdits` when `allowWrite` is true, otherwise `--permission-mode plan`;
   - `--model <model>` only when `AdapterRunOptions.model` is non-null and non-empty;
   - one `--add-dir <directory>` pair per `extraDirs` entry; and
   - configured `extraArgs` last.

   It does not pass a turn-budget flag and does not pin a default vendor model. `maxTurns` remains accepted as part of the common contract and is ignored.

7. **Claude parses success and failure from stdout**

   Claude parses the JSON envelope on stdout before deciding success. A non-zero exit or an envelope with `is_error: true` throws even when stderr is empty or the process exits 0. The error detail follows the spike's precedence of `result`, `error.message`, `subtype`, then the final bounded combined output; recognised subscription-login failures continue through Q-0046's `authError` translation. Successful results use `structured_output` when present, otherwise Q-0046's `extractJson` over `result` or stdout. The returned result includes `vendor`, raw final text, structured output, session id or `null`, elapsed milliseconds, and usage.

8. **Claude usage is cache-inclusive and survives failure**

   Claude maps usage as follows:

   - `input_tokens` is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` when usage exists;
   - `cached_input_tokens` is `cache_read_input_tokens` or `null`;
   - `cache_write_input_tokens` is `cache_creation_input_tokens` or `null`;
   - `output_tokens` is the reported value or `null`; and
   - `cost_usd` is `total_cost_usd` or `null`.

   Missing usage produces null measures rather than invented totals. A thrown billed failure carries the same mapped usage on the error so Q-0046's retry wrapper and Q-0049's roll-up can count the failed attempt.

9. **Codex invocation ignores personal configuration and does not pin a model**

   For the M0-verified Codex capability, every `run()` invocation reads the complete prompt from stdin and includes:

   - `exec --json`;
   - `--output-schema <temporary-schema-file>`;
   - `-o <temporary-final-message-file>`;
   - `-C <cwd>`;
   - `--sandbox workspace-write` when `allowWrite` is true, otherwise `--sandbox read-only`;
   - `--skip-git-repo-check`;
   - `--ephemeral`;
   - `--ignore-user-config`;
   - one `--add-dir <directory>` pair per `extraDirs` entry;
   - configured `extraArgs`; and
   - the trailing `-` stdin prompt marker.

   `-m <model>` appears only when `AdapterRunOptions.model` is non-null and non-empty. With no supplied model, neither `-m` nor any hard-coded vendor model name appears. Tests cover both cases and prove `--ignore-user-config` is present in both.

10. **Role defaults do not cross vendors**

    A role's default model may reach `AdapterRunOptions.model` only when the step runs on that role's own adapter. An explicit model written on the step remains eligible to be passed. Overriding a step from Claude to Codex, or Codex to Claude, must not cause the former role adapter's default model to become the new adapter's `-m` or `--model` value.

    The implementation location and ticket ownership are blocked by OQ-2 because the adapters cannot distinguish an explicit step model from a role-derived model in the Q-0046 contract.

11. **Codex JSONL mapping is complete and vendor-local**

    Codex consumes stdout line by line, emits each line as the shared `{type: 'stdout', line}` adapter event, tolerates non-JSON lines, and uses its selected capability to map:

    - session ids from the verified thread/session fields;
    - usage from the verified top-level or nested usage fields;
    - errors from `error`, `turn.failed`, and error-item events; and
    - nested JSON error strings to their human-readable message when possible.

    `input_tokens`, `cached_input_tokens`, and `cache_write_input_tokens` use reported values or remain `null`. `output_tokens` includes both reported output tokens and reasoning-output tokens. Vendor-specific event fields do not escape the Codex adapter; downstream code receives only the Q-0041/Q-0046 shared contract shapes and the neutral open-string vendor label.

12. **Codex remains unpriced, including on failures**

    Every Codex result and billed error reports `cost_usd: null`; no local rate table, price lookup, zero-cost substitute, or model-price mapping is added. On non-zero exit, errors reported through stdout are included even when stderr is empty, duplicate messages are collapsed, recognised login failures use `authError`, and all usage observed before failure is attached to the thrown error. Q-0049 remains responsible for rendering `null` as `n/a` and counting unpriced steps in roll-ups.

13. **Codex structured output and temporary files**

    Codex writes the supplied schema to a newly created directory under the operating system's temporary directory, asks the CLI to write the final message there, and reads that file when it exists. It parses the file as JSON first and falls back to Q-0046's `extractJson`; if the file is absent it applies the same parsing to stdout. The temporary directory is removed after success, non-zero exit, or process-spawn failure. No file is written to the user's working tree, `backlog/`, `.quorum/`, or `.harness/worktrees/` by this adapter setup work.

14. **Process execution preserves the Q-0063 fix**

    The shared process-execution helper ports the fixed spike behavior: it captures stdout and stderr, forwards complete stdout lines in order (including the final unterminated line), writes the prompt to stdin, and resolves spawn failures as adapter-readable results. If the child closes stdin before the full prompt is written, an `EPIPE` does not crash the Quorum process; the helper records the diagnostic and allows the child's close result and vendor output to determine the adapter error. Tests use a prompt larger than the pipe buffer and a fake executable that exits without reading it.

15. **Adapter events preserve the shared contract**

    Before each vendor process starts, the adapter emits one `{type: 'spawn', vendor, cmd}` event. Stdout events preserve line order and contain no step id. Command rendering is bounded and safe for diagnostics. The adapters do not invent `tool`, `text`, or other event variants, persist events, or add vendor-specific fields to the shared event union.

16. **Adapter override behavior is reusable core logic**

    The function lifted from `spike/bin/harness.js:612` is exported from core rather than implemented in the CLI. Given a flow and an adapter name, it updates adapter-bearing top-level steps and adapter-bearing members of parallel steps, leaves steps without an adapter unchanged, and does not read, write, or persist the flow file. Tests cover a top-level step, members of a parallel step, and a step without an adapter. Any model adjustment required by AC-10 must follow the resolution of OQ-2; no unrelated flow mutation is permitted.

17. **Automated evidence is hermetic**

    Unit tests use fake executables and fixture stdout/JSONL; they do not require Claude or Codex to be installed, inspect a developer's home configuration, make a paid request, or depend on subscription state. The existing mock-adapter end-to-end regression suite remains green. Tests cover both success and failure arriving on stdout with empty stderr.

18. **Real-CLI acceptance evidence is recorded locally**

    On a machine with supported Claude and Codex versions and active subscription logins, the designated local probe invokes Q-0046's `probeAdapter` once for each registered vendor and records: installed CLI version, capability selected, success or actionable error, elapsed milliseconds, token total, Claude-reported cost, and Codex cost as `null`/`n/a`. The evidence must come from the `quorum adapters --probe` path required by `docs/04-architecture.md`, not from `check()` or a login-status command.

    How this ticket can obtain that command before Q-0010 is blocked by OQ-3. No CI job may claim that subscription login was verified.

19. **Documentation and port conformance**

    The implementation is checked flag by flag and field by field against `docs/03-adapter-contract.md`. If observed supported-CLI behavior differs, the same change updates that document rather than silently adapting the code. Any behavior divergence from the spike stops implementation unless a dated ticket erratum or `docs/DECISIONS.md` entry authorises it first. The implementation does not edit any file under `spike/**`.

20. **Product naming is resolved deliberately**

    The adapter refusal messages must follow the accepted resolution of OQ-4. The implementation may not silently replace or preserve the spike's use of “Harness”: changing it is a behavior change under the port charter, while retaining it conflicts with the canonical product-boundary rule. `spike/test/smoke.js` remains unchanged in either case.

## Non-goals

- Implementing or changing the `quorum` binary or its command rendering and exit codes; that belongs to Q-0010.
- Porting the engine's general model-resolution logic, except for a narrowly authorised resolution of OQ-2.
- Implementing Q-0049's run-history roll-up, unpriced-step count, or `n/a` display.
- Persisting, replaying, or extending the event stream.
- Adding `tool`, `text`, or other speculative event variants.
- Proving subscription login from `check()`, `--version`, or a vendor login-status command.
- Pinning or recommending any Claude or Codex model name.
- Adding local Codex pricing or treating missing price as zero.
- Honouring `maxTurns` through an unverified vendor flag.
- Changing the adapter contract, flow schema, role format, or `harness.yaml` schema without a separately accepted decision or erratum.
- Editing `spike/**`, including the frozen wording fixture.
- Fixing any other defect discovered while reading the spike.
- Porting another Q-0009 child's module, performing the cutover, or changing another package's public API.
- Studio work, multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

| ID | Question | Owner | Status / effect |
| --- | --- | --- | --- |
| OQ-1 | What exact directory layout, version parser, supported version ranges, probe frequency, and fail-closed behavior are required for each `capabilities.ts`? In particular, should an unknown newer CLI version be rejected, use the latest known mapping with a warning, or be probed for individual flags and fields? | Architecture owner | **Blocker.** This changes runtime behavior and determines whether AC-5 is implementable and independently testable. M0 verifies only Claude 2.1.220 and Codex 0.149.0. |
| OQ-2 | Which ticket owns preventing a role-derived model from crossing vendors? Q-0047 owns the invariant, but Q-0046's `AdapterRunOptions` exposes only the resolved model and cannot identify whether it was explicit or inherited; the relevant resolution currently lives in `engine.js`, assigned to Q-0052. Should Q-0047 receive a narrowly documented model-resolution helper, should `overrideAdapters` clear only proven role-derived defaults, or should the criterion be handed to Q-0052 by erratum? | Q-0009 owner and Q-0052 owner | **Blocker.** Silently changing `overrideAdapters` would diverge from the spike, while implementing the rule inside an adapter is impossible with the current contract. |
| OQ-3 | How is AC-18 executed at this ticket's gate when `quorum adapters --probe` is assigned to Q-0010 and Q-0047 declares no dependency on Q-0010? Should Q-0010 become a dependency, should a temporary core-level probe runner be authorised, or should real-CLI evidence be deferred and explicitly linked to Q-0010? | Release owner / Q-0010 owner | **Blocker for closing the ticket.** A direct vendor invocation or `check()` is not equivalent evidence. |
| OQ-4 | May the adapter error text change from “Harness runs on subscription OAuth only” to product-correct Quorum wording? The current text violates the product-boundary rule, but changing it without a prior erratum or decision violates the port charter. What exact replacement wording is approved, including whether “OAuth” should remain given the canonical vocabulary requirement to say “subscription”? | Product owner | **Blocker before adapter messages and fixtures are written.** `spike/test/smoke.js` remains frozen. |
| OQ-5 | Does `--permission-mode plan` on the supported Claude version permit all required repository and `--add-dir` reads? `docs/03-adapter-contract.md` still marks this as unverified. | Adapter owner | Non-blocking for the port if behavior is preserved; a contrary real result stops the ticket and requires a documentation correction and explicit decision. |

## Risks

- An unknown CLI version could be accepted with a stale mapping and fail only after a paid request, or be rejected too aggressively despite remaining compatible. OQ-1 must define the policy.
- The new version probe could accidentally occur before the API-key refusal, recreating the exact register-row-1 failure this ticket inherits.
- A fake-executable suite can prove parsing and argument construction but cannot prove subscription login or current vendor behavior. Local evidence must be clearly separated from CI evidence.
- Passing a role-derived Claude model to Codex, or vice versa, can make a valid subscription appear unusable. The current contract loses the provenance needed to prevent that at the adapter boundary.
- Appending `extraArgs` permits deliberate flag overrides and can create duplicate flags. This is preserved behavior, not an invitation to add precedence logic during the port.
- Claude can report failure inside a successful process exit, and both vendors can report failures only on stdout. Exit-code-only or stderr-only tests would miss paid failures and actionable messages.
- Temporary Codex files can leak schemas or final output if cleanup is not exercised on every termination path.
- Incorrectly adding Claude cache measures twice would overcount tokens; omitting them would reproduce the three-orders-of-magnitude undercount. Tests need fixtures where all three input components are non-zero.
- Treating Codex's absent cost as zero would make aggregate costs falsely complete. Q-0049 must retain the distinction between zero and unknown.
- Quietly correcting the “Harness” message would break the port's behavioral evidence; quietly retaining it would violate the canonical product language. OQ-4 requires an explicit record either way.

## Cross-cutting checklist

| Concern | Requirement |
| --- | --- |
| BYOS | Applies centrally. AC-3 refuses all three prohibited variables before process creation; AC-4 separates presence from subscription validity; AC-17 forbids paid CI requests. |
| Worktree safety | Applies narrowly. Adapters run in the caller-supplied `cwd`; Codex setup files use the OS temporary directory. This ticket creates no branch or worktree and writes nothing to the user's working tree. |
| Gate behavior | n/a. No gate is created, bypassed, or changed. Real-CLI evidence is presented at the human gate once OQ-3 is resolved. |
| File format and schema | No persistent format or schema changes. The supplied JSON Schema is passed through to each CLI; Codex's temporary schema file is disposable. |
| Lint and cross-vendor rules | No lint-rule change. AC-10 preserves the model half of cross-vendor isolation; the flow linter's writer/reviewer rule remains outside this ticket. |
| Files are the database | No persistent state is introduced. Version capability definitions are source files; runtime probes create no hidden durable state. |
| Product-agnostic | Vendor names occur only in their adapters, registry membership, tests, and vendor-neutral labels allowed by the contract. No SaaS product knowledge is added. |
| Cold-clone impact | No new setup field, dependency, or model choice. The adopter still needs installed, logged-in vendor CLIs; the local probe is intended to make that state explicit. OQ-3 must avoid adding a second user-facing command. |
| Errors are explicit | Failure envelopes and stdout JSONL are parsed before fallback errors; missing structured output is not silently replaced. Existing Q-0046 validation remains responsible for saving invalid raw output beside the ticket. |
| Human-gated default | n/a to runtime behavior. This ticket neither changes gate defaults nor makes `auto` or `human-locked` decisions. |
