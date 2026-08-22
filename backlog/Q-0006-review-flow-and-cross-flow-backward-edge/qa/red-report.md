# Test output

```
le=head-of-product[0m
[2m·[0m head-of-product: wrote requirements/merged.md
[32m✓[0m [1mhead-of-product[0m [2mverdict=ready cost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #2 completed: draft → requirements   cost $0.04  tokens 3712
✓ each run attempt gets its own id (saw 1, 2)
✓ codex auth failure becomes an actionable message
✓ claude 401 is recognised as an auth failure
✓ a non-auth failure is left alone
✓ unsupported-model error names the model and the subscription
✓ unsupported-model error does not tell the user to re-login
✓ probe succeeds on a working adapter
✓ claude surfaces: exit 1 with the reason only in the envelope (got claude failed (exit 1, error_max_turns): reached the turn limit)
✓ a failed claude step carries its cost: exit 1 with the reason only in the envelope
✓ claude surfaces: is_error: true while exiting 0 (got claude failed (exit 0): overloaded)
✓ a failed claude step carries its cost: is_error: true while exiting 0
✓ claude surfaces: nothing on either stream (got claude failed (exit 1): no output on stderr or stdout)
✓ probe reports an unusable login rather than claiming ✓
✓ no shipped template pins a codex model name (none)
[32m✓[0m T-0004 created at backlog/T-0004-retry-semantics (stage: draft)
✓ retry grants exactly one more traversal, no more (saw 3, expected 3)
✓ the retry grant is recorded in runs.log
✓ the retried loop ends one past its limit, not reset to zero
✓ a retry does not refund an unrelated loop’s budget
[32m✓[0m T-0005 created at backlog/T-0005-interrupted-at-a-gate (stage: draft)
✓ the interrupt fixture reaches the gate
✓ an interrupted run is recorded in runs.log
✓ an interrupted run does not advance the stage
✓ an interrupted run persists its counters instead of refunding them
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
[32m✓[0m good.json matches c.schema.json
✓ harness validate exits 0 on a conforming artifact
[31m✗[0m bad.json violates c.schema.json:
    /stage: must be equal to one of the allowed values
✓ harness validate exits 1 so a red test can fail on it
✓ a priced step shows money
✓ an unpriced step shows tokens, not $0.000
✓ an unpriced step is never displayed as free
✓ role model applies on its own vendor
✓ role model does not leak to another vendor
✓ an explicit step model always wins

all good — /var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-0JY4y9

──── q0006-engine.js ────
✓ AC-13/AC-14/AC-15/AC-16 — three separate rejection rounds regress to the target consumes stage and persist exact counts
✓ AC-20/AC-21/AC-27 — rework task starts from integration and receives an optional latest verdict
✓ EDGE-11 — legacy ticket history remains readable and unchanged
✓ AC-29/EDGE-13 — suite discovery and frozen contracts remain intact with no new dependency
[31m✗ [0mticket T-0001 is at stage "draft", flow "solutioning" consumes "requirements"
[31m✗ [0m1 of 2 parallel step(s) failed:
  - pm-claude: mock: simulated adapter failure for candidate-claude.md
  kept: pm-codex (already written to the ticket; a re-run will overwrite them)
✗ AC-7/AC-28/EDGE-3 — mock verdict switches are valid, deterministic, scoped, and exclusive
  Expected values to be strictly equal:
+ actual - expected

+ 'changes-requested'
- 'approve'

✗ EDGE-2/AC-23 — every frozen verdict-schema clause is enforced without a validator dependency
  {"summary":"x","document":"x","verdict":"approve","findings":["nit: a.js:1 no"]}
✗ AC-5/AC-10/AC-11/EDGE-4/EDGE-5 — buildPrompt materialises the configured three-dot diff safely
  The input did not match the regular expression /git diff --stat main\.\.\.harness\/T-0001\/integration/. Input:

'# Role: code-reviewer\n' +
  'review\n' +
  '\n' +
  '# Ticket T-0001: Review fixture\n' +
  'Stage: green. Iteration: 1.\n' +
  '\n' +
  'Exercise Q-0006.\n' +
  '\n' +
  '## Input: backlog/T-0001-review-fixture/requirements/merged.md\n' +
  '\n' +
  '# Requirement\n' +
  '\n' +
  '## Input: backlog/T-0001-review-fixture/solution/solution.md\n' +
  '\n' +
  '# Solution\n' +
  '\n' +
  '## Diff to review\n' +
  '\n' +
  'Run `git diff main...harness/T-0001/integration` in the repository and review that change.\n' +
  '\n' +
  '# Output contract\n' +
  '\n' +
  'Respond ONLY with a JSON object matching the provided schema. Put the complete markdown document in "document" (it will be saved as review/round-1/claude.md).'

✗ AC-12/EDGE-5 — a missing configured base ref fails before any adapter call
  Missing expected rejection.
✗ EDGE-17 — a missing integration ref has its own pre-adapter diagnostic
  Missing expected rejection.
✗ AC-4/AC-6/AC-8/AC-9 — a real review run writes numbered panel/verdict artifacts and stable latest verdict
  review/round-1/claude.md

false !== true

✗ AC-17/AC-18/EDGE-1/EDGE-12 — fourth rejection exhausts; retry persists max and grants one traversal only
  Expected values to be strictly equal:
+ actual - expected

+ 'completed'
- 'regressed'

✗ AC-17/AC-18/EDGE-10 — advance and abort are distinct and advance keeps exhaustion loaded
  Expected values to be strictly equal:

0 !== 1

✗ AC-22/AC-24 — asymmetric panel failure retains its sibling and records failed without deciding
  Expected values to be strictly equal:

false !== true

Preparing worktree (checking out 'harness/T-0001/task-a')

✗ 9 Q-0006 engine scenario group(s) failed
✗ q0006-engine.js exited 1

✗ 1 of 2 test file(s) failed

```
