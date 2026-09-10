# Q-0068 — A healthy login reads unusable, and the refusal misnames the product

## Problem

The CLI surface `quorum adapters --probe` can fail a working installation. When an adapter completes the authenticated round-trip successfully but returns `usage: null`, `probeAdapter` dereferences `usage`, catches its own `TypeError`, and reports the subscription login as unusable. Because `--probe` is a check, that incorrect result also makes the command exit 1. A contributor can therefore implement a valid adapter whose vendor CLI reports no usage and receive a failed check for a healthy login.

The same CLI surface renders BYOS refusal messages from the Claude and Codex adapters that say “Harness runs on subscription OAuth only.” Harness is the concept and folder; Quorum is the product. This is one of the first messages a cold-clone adopter may see, and it uses the wrong product name and less familiar terminology than the rest of the product.

This ticket touches the CLI and adapter surfaces. It does not touch the Studio, `harness/` files, or `backlog/` formats.

## User story

As a **cold-clone adopter**, I want `quorum adapters --probe` to distinguish a working subscription login from absent usage measurements, so that a healthy installation does not fail my local check or CI.

As a **cold-clone adopter**, when Quorum refuses an environment that would bypass my CLI subscription login, I want the refusal to name Quorum and tell me what to correct in plain language.

As an **adapter contributor**, I want the adapter contract to permit a successful probe with no usage measurements, so that I do not have to invent measurements merely to make a valid adapter pass.

## Acceptance criteria

1. **A successful unmeasured probe remains successful.** When an adapter returns schema-valid probe output and `usage: null`, `probeAdapter` returns `ok: true`. It must not throw, return `ok: false`, call `authError`, or include a JavaScript `TypeError` as an adapter error.

2. **Absent measurements remain absent.** In the successful `ProbeResult`, `cost_usd` is `null` and `tokens` is `null` when the adapter returns `usage: null`. The `ProbeResult` TypeScript contract is updated so `tokens` explicitly permits `null`. Absence must not be represented as zero.

3. **Measured zero remains distinct from absence.** When an adapter returns a non-null usage object whose reported input and output measures total zero, `probeAdapter` returns `tokens: 0`. Existing handling of a reported `cost_usd: 0` remains unchanged. Tests independently cover `usage: null` and measured zero.

4. **The human-readable probe result is successful without invented measures.** For an adapter that passes the authenticated round-trip with `usage: null`, `quorum adapters --probe` renders a `login verified` line. The line omits both the price and token clauses; it must not render `$0.0000`, `0 tokens`, `n/a`, `login not usable`, or an implementation error.

5. **The machine-readable probe result preserves the distinction.** With `--probe --json`, the same adapter entry has `login: "verified"`, `ok: true`, `cost_usd: null`, and `tokens: null`. A successful unmeasured adapter does not by itself cause `quorum adapters --probe` to exit 1. Existing JSON key names and the combined human-readable-plus-JSON output remain unchanged.

6. **Other probe failures still fail the check.** Invalid structured output, an adapter invocation failure, and a recognised subscription-login failure continue to return `ok: false`, render `login not usable`, and cause `quorum adapters --probe` to exit 1. The bare `quorum adapters` command remains a presence report with its existing exit behavior.

7. **The Claude BYOS refusal uses the approved sentence.** When `ANTHROPIC_API_KEY` is set, the exact adapter error is:

   `ANTHROPIC_API_KEY is set — unset it; Quorum uses the CLI's subscription login only`

   The rendered terminal line is therefore:

   `✗ claude: ANTHROPIC_API_KEY is set — unset it; Quorum uses the CLI's subscription login only`

8. **The Codex BYOS refusal uses the approved sentence.** When either `CODEX_API_KEY` or `OPENAI_API_KEY` is set, the exact adapter error is:

   `CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Quorum uses the CLI's subscription login only`

   The rendered terminal line is therefore:

   `✗ codex: CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Quorum uses the CLI's subscription login only`

9. **BYOS refusal precedence and coverage do not change.** Each adapter checks the same environment variables it checks today, refuses before invoking its vendor CLI, and does not inspect the other adapter's variables. A missing or broken vendor CLI cannot mask the refusal. Tests continue to prove the exact guarded variable sets and that no vendor CLI is invoked after its refusal condition is found.

10. **All existing pins move to the new behavior rather than being removed.** Update the adapter unit tests, the `probeAdapter` regression test, the CLI adapter test, and the mock-adapter end-to-end test so they assert the outcomes in criteria 1–9. The end-to-end suite must assert the complete rendered `✗ <vendor>: ...` line for both vendors.

11. **Obsolete preservation comments are removed or replaced with current authority.** The comments associated with the former Q-0066 probe pin and the Q-0068 refusal no longer say that a fix must land in both `spike/` and `packages/core`, that the spike must remain in agreement, or that either defect is still preserved. This includes the stale comments currently in `packages/cli/src/adapters.ts`, `packages/cli/src/adapters.test.ts`, and `packages/core/src/adapters/claude.test.ts`. Any retained explanation cites Q-0068 without restating the ticket body.

12. **The documented adapter contract agrees with the shipped contract.** `docs/03-adapter-contract.md` states that a successful probe may report `cost_usd: null` and `tokens: null` when the vendor reports no usage. It distinguishes that absence from a measured zero and does not describe missing usage as a failed login. No new decision entry is required because this resolves defects within the existing BYOS, product-name, and honest-measurement decisions rather than changing them.

13. **Repository verification passes.** After installing dependencies with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. The mock-adapter end-to-end regression suite is included in the test result.

## Non-goals

- Changing `withRetry` or its deliberate `usage: null` result when no attempt reports a measure.
- Requiring an adapter or vendor CLI to report usage, price, or token measures.
- Adding a third human-readable state such as “verified but unmeasured”; the existing successful line with omitted measurement clauses is sufficient.
- Changing how non-null input and output token measures are summed.
- Changing `authError` messages or subscription-login failure recognition.
- Changing the distinction between the bare `quorum adapters` report and the `quorum adapters --probe` check.
- Changing exit codes except for removing the erroneous exit 1 caused solely by a successful probe with `usage: null`.
- Changing `--json` into a JSON-only stream or renaming, adding, or removing its keys.
- Changing verified-version comparison or rendering.
- Changing which environment variables trigger BYOS refusal, accepting an environment-based vendor access path, or adding any alternative access path.
- Determining whether a vendor CLI is installed after a BYOS refusal. The refusal deliberately happens before the CLI is invoked, so the product has no installation result to report in that case.
- Auditing unrelated occurrences of “Harness” in documentation, tests, comments, historical ticket bodies, or generated files.
- Repairing other preserved adapter defects, including the non-string Claude final-message failure referenced near the stale cutover comment.
- Changing any flow, gate, worktree behavior, persistent file format, schema, or Studio behavior.
- Adding a new dependency.

## Open questions

None blocking.

The two choices raised by the ticket are resolved here:

- A successful round-trip with no usage is successful and carries `cost_usd: null` and `tokens: null`; it is not a third login state and is not a measured zero.
- The refusal says “Quorum uses the CLI's subscription login only.” This names the product, uses the established “subscription login” language, and retains the immediate `unset it` remedy.

## Risks

- Consumers of the exported `ProbeResult` type may currently assume `tokens` is always a number on success. TypeScript must expose the new nullable contract so those consumers fail at compile time rather than silently treating absence as zero.
- A truthiness-based renderer already omits zero tokens as well as absent tokens. This ticket preserves that human-readable behavior, while JSON and the TypeScript contract carry the exact distinction. Expanding the terminal output for measured zero is separate scope.
- Editing the refusal text in only one adapter or updating only unit fixtures would leave vendor behavior inconsistent. The complete-line end-to-end assertions are the regression guard.
- Stale comments can reinstate deleted cutover constraints during later maintenance. The three comments tied to these defects must move with the behavior change, while unrelated “both trees” comments remain untouched.
- The refusal still names environment variables because that is the condition the adopter must correct. It must not be generalized into a supported alternative authentication mechanism.

### Cross-cutting check

- **BYOS:** Applicable. Refusal coverage and refusal-before-CLI ordering are unchanged and tested.
- **Worktree safety:** Not applicable. This command and the probe do not write to the user's working tree; the probe's existing temporary-directory cleanup behavior remains unchanged.
- **Gate behavior:** Not applicable. No flow or gate changes.
- **File format and schema:** No persistent file format changes. The in-memory/exported `ProbeResult` contract changes `tokens` from `number` to `number | null`; JSON retains the same key with a nullable value.
- **Lint rules:** No lint-rule changes. Strict TypeScript must identify every consumer that needs to handle nullable probe tokens.
- **Cold-clone impact:** Improved. A valid subscription login no longer fails `quorum adapters --probe`, and the refusal names Quorum with an actionable correction. No installation step or additional command is introduced.
- **Product-agnostic:** Preserved. Vendor names remain confined to their adapters and existing adapter-report surface.
