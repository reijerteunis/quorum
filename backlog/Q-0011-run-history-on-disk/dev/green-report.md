# Test output

```
e table (spike/bin,spike/test vs spike/bin,spike/test)
✓ developer-tooling prose names its allowed path spike/bin
✓ developer-tooling prose names its allowed path spike/test
✓ role table row "frontend" has a role file
✓ developer-frontend runs on the vendor the table names (claude)
✓ developer-frontend declares paths in frontmatter
✓ developer-frontend frontmatter matches the table (apps/*,packages/i18n,packages/ui vs apps/*,packages/i18n,packages/ui)
✓ developer-frontend prose names its allowed path apps/*
✓ developer-frontend prose names its allowed path packages/i18n
✓ developer-frontend prose names its allowed path packages/ui
✓ role table row "data" has a role file
✓ developer-data runs on the vendor the table names (codex)
✓ developer-data declares paths in frontmatter
✓ developer-data frontmatter matches the table (packages/database vs packages/database)
✓ developer-data prose names its allowed path packages/database
✓ the role table spans more than one vendor (codex,claude)
✓ worth retrying: API Error: Connection closed mid-respons
✓ worth retrying: Error: socket hang up
✓ worth retrying: FetchError: request failed, reason: ECON
✓ worth retrying: 529 overloaded_error: Overloaded
✓ worth retrying: 429 rate_limit_error
✓ not worth retrying: ANTHROPIC_API_KEY is set — unset it; Harness
✓ not worth retrying: codex: model "gpt-5" is not available on a C
✓ not worth retrying: claude failed (exit 1, error_max_turns): rea
✓ not worth retrying: Invalid schema for response_format: addition
✓ a transient failure is retried until it succeeds
✓ the retried step reports what all its attempts cost
✓ each retry is announced rather than sitting silent
✓ retries are bounded and the give-up is explicit
✓ a deterministic failure is not retried
✓ a broken environment is not a red phase: Error: Cannot find package 'yaml' imported f
✓ a broken environment is not a red phase: Error: Cannot find module './nope.js'
✓ a broken environment is not a red phase: code: 'ERR_MODULE_NOT_FOUND'
✓ a broken environment is not a red phase: SyntaxError: Unexpected token '||'
✓ a broken environment is not a red phase: sh: vitest: command not found
✓ a genuine assertion failure is still red: AssertionError [ERR_ASSERTION]: expected sta
✓ a genuine assertion failure is still red: ✗ init
✓ a genuine assertion failure is still red: FAIL test/review.test.js
✓ a signature quoted inside a test result is not an environment failure: ✓ a broken environment is not a red phas
✓ a signature quoted inside a test result is not an environment failure: ✓ handled: Cannot find module './nope.js
✓ a signature quoted inside a test result is not an environment failure: ok 4 - reports ERR_MODULE_NOT_FOUND
✓ a signature quoted inside a test result is not an environment failure: 1) rejects SyntaxError: Unexpected token
✓ an unhandled crash is still an environment failure even after some checks passed
✓ test runner exits 0 when every discovered file passes
✓ a newly added failing test file turns the suite red
✓ the runner names the file that failed
✓ the suite goes green again once the failing file is gone
✓ the contract validator accepts a conforming artifact
✓ contract validator rejects: missing required key (/: must have required property 'stage')
✓ contract validator rejects: enum violation (/stage: must be equal to one of the allowed values)
✓ contract validator rejects: additionalProperties: false (/: must NOT have additional properties ("extra"))
✓ contract validator rejects: format constraint (/history/0/at: must match format "date-time")
✓ contract validator rejects: nested type (/history/0/run: must be integer)
[2m·[0m good.json: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)
[32m✓[0m good.json matches c.schema.json
✓ harness validate exits 0 on a conforming artifact
[2m·[0m bad.json: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)
[31m✗[0m bad.json violates c.schema.json:
    /stage: must be equal to one of the allowed values
✓ harness validate exits 1 so a red test can fail on it
✓ a priced step shows money
✓ an unpriced step shows tokens, not $0.000
✓ an unpriced step is never displayed as free
✓ role model applies on its own vendor
✓ role model does not leak to another vendor
✓ an explicit step model always wins

all good — /var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-oDymZ1

──── q0006-engine.js ────
✓ AC-7/AC-28/EDGE-3 — mock verdict switches are valid, deterministic, scoped, and exclusive
✓ EDGE-2/AC-23 — every frozen verdict-schema clause is enforced without a validator dependency
✓ AC-5/AC-10/AC-11/EDGE-4/EDGE-5 — buildPrompt materialises the configured three-dot diff safely
✓ AC-12/EDGE-5 — a missing configured base ref fails before any adapter call
✓ EDGE-17 — a missing integration ref has its own pre-adapter diagnostic
✓ AC-4/AC-6/AC-8/AC-9 — a real review run writes numbered panel/verdict artifacts and stable latest verdict
✓ AC-13/AC-14/AC-15/AC-16 — three separate rejection rounds regress to the target consumes stage and persist exact counts
✓ AC-17/AC-18/EDGE-1/EDGE-12 — fourth rejection exhausts; retry persists max and grants one traversal only
✓ AC-17/AC-18/EDGE-10 — advance and abort are distinct and advance keeps exhaustion loaded
✓ AC-22/AC-24 — asymmetric panel failure retains its sibling and records failed without deciding
✓ AC-20/AC-21/AC-27 — rework task starts from integration and receives an optional latest verdict
✓ EDGE-11 — legacy ticket history remains readable and unchanged
✓ AC-29/EDGE-13 — suite discovery and frozen contracts remain intact with no new dependency

──── q0011-run-history.js ────
✓ AC-1 — initialises exclusively before work and dry-run writes nothing
✓ AC-2/EDGE-7 — excludes history, leaks no environment, and persists relative paths
✓ AC-1 — fatal initialisation failure happens before adapter billing
✓ AC-3/AC-4/AC-5/AC-8 — atomic manifest records every real occurrence and exact artifacts
✓ AC-9/AC-10/EDGE-4 — mock preserves per-call usage and billed failure detail
✓ AC-3 — parallel terminal updates retain both step records
✓ AC-9/EDGE-19 — unknown measures remain null and malformed mock switches fail explicitly
✓ AC-8/AC-10 — retry wrapper exposes exact attempts and preserves billed usage on success and failure
✓ AC-11 — roll-up groups reported usage without inventing cross-vendor money
✓ EDGE-21 — structured-output and script failures map to their exact categories
✓ EDGE-2/EDGE-3 — integrate phases allocate one occurrence including empty command configuration
✓ AC-4/AC-5 — gates allocate nothing and script output is captured without a prompt
✓ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
✓ EDGE-6 — post-initialisation persistence failures warn without discarding the run
✓ AC-4/EDGE-8 — backward edge revisits one id without overwriting either occurrence
✓ EDGE-21 — error category vocabulary is frozen and exhaustive
✓ EDGE-5/EDGE-8/EDGE-14 — allocator does not collide, truncate, or emit exhausted
✓ EDGE-1 — task ownership remains two-vendor and disjoint

──── q0011-runs-cli.js ────
✓ AC-12/EDGE-10/EDGE-11 — lists, filters, warns, and applies the specified selection grammar/order
✓ AC-12 — missing history is an explicit successful empty state
✓ AC-13/EDGE-9 — detail is ordered and honestly reports incomplete manifests
✓ AC-13/EDGE-20 — detail exposes every attempt including usage-null failures and all contracted fields
✓ AC-13/EDGE-12 — --json is one ANSI-free document for list, detail, warning, and error modes
✓ AC-14 — real schema validation rejects structural mutations
✓ AC-14/EDGE-13 — annotation activates roll-up semantics and generic schemas announce skips
✓ EDGE-15/EDGE-16 — semantic validation rejects duplicate occurrence directories and vendors
✓ EDGE-17/EDGE-18 — semantic validation rejects lifecycle and kind/nullability contradictions

✓ all 4 test files passed

```
