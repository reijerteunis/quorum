# Test output

```
es: exit 1 with the reason only in the envelope (got claude failed (exit 1, error_max_turns): reached the turn limit)
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
✓ a broken environment is not a red phase: Error: Cannot find package 'yaml' imported f
✓ a broken environment is not a red phase: Error: Cannot find module './nope.js'
✓ a broken environment is not a red phase: code: 'ERR_MODULE_NOT_FOUND'
✓ a broken environment is not a red phase: SyntaxError: Unexpected token '||'
✓ a broken environment is not a red phase: sh: vitest: command not found
✓ a genuine assertion failure is still red: AssertionError [ERR_ASSERTION]: expected sta
✓ a genuine assertion failure is still red: ✗ init
✓ a genuine assertion failure is still red: FAIL test/review.test.js
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

all good — /var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-WdoW0r

──── q0006-behavior.js ────
✓ AC-28: verdict switches do not alter non-verdict steps
✓ EDGE-6: init outside Git succeeds with main
✓ AC-1/25: valid cross-flow review flow lints
✓ AC-16: lint rejects max_iterations missing
✓ AC-16: lint rejects max_iterations max_iterations: 1.5
✓ EDGE-9: mock override does not poison pristine-flow preflight
✓ AC-12/EDGE-5: substituted base ref is validated before adapter execution
✓ AC-24: panel failure retains successful siblings and blocks verdict
✓ AC-20: rework synchronizes task worktrees and reports conflicts
✓ AC-13: regression stage is derived from the target flow consumes value
✓ AC-17: exhaustion gate survives auto and names all three choices
✓ AC-15/16: iteration count is persisted before regression returns
✓ AC-23: invalid structured output is saved before a failed result
✓ AC-23/24: invalid output and panel failure preserve stage and counters
✓ EDGE-1: retry persists exactly max_iterations, never max_iterations - 1
✓ AC-17: exhaustion reason names count, limit, and outstanding findings
✓ AC-18: advance and abort have distinct terminal routing
✓ EDGE-10: exhaustion advance does not reset the review counter
✓ EDGE-12: exhaustion presentation records zero cost separately
✓ AC-22: failed outcomes are distinguishable in both audit stores
✓ AC-8: only an existing verdict advances the review round
✓ EDGE-13: frozen contract remains non-empty: code-reviewer-role.contract.md
✓ EDGE-13: frozen contract remains non-empty: mock-adapter-switches.contract.md
✓ EDGE-13: frozen contract remains non-empty: review-artifacts.schema.json
✓ EDGE-13: frozen contract remains non-empty: review-flow.contract.yaml
✓ EDGE-13: frozen contract remains non-empty: review-lint.contract.md
✓ EDGE-13: frozen contract remains non-empty: review-runtime.contract.md
✓ EDGE-13: frozen contract remains non-empty: ticket-review-state.schema.json

──── q0006-contracts.js ────
✓ AC-2: reviewer role pins no model
✓ EDGE-14: adopter backend role retains adopter paths
✓ EDGE-2/AC-23 schema clause: approve with no findings
✓ EDGE-2/AC-23 schema clause: real-vendor-shaped rejection
✓ EDGE-2/AC-23 schema clause: approve with findings
✓ EDGE-2/AC-23 schema clause: rejection without findings
✓ EDGE-2/AC-23 schema clause: malformed citation
✓ EDGE-2/AC-23 schema clause: unknown verdict enum
✓ EDGE-2/AC-23 schema clause: additional key
✓ EDGE-11: legacy history validates without migration
✓ AC-22/EDGE-12: current exhausted event validates
✓ EDGE-12: exhaustion presentation cost must be zero
✓ AC-30 docs include exhaustion gate
✓ AC-29/EDGE-2: no new npm dependency was added
✓ EDGE-13: frozen contract set remains present and parseable
✓ EDGE-13: contracts/Q-0006 is byte-identical to the checked-in contracts commit
[31m✗ [0mticket T-0001 is at stage "draft", flow "solutioning" consumes "requirements"
[31m✗ [0m1 of 2 parallel step(s) failed:
  - pm-claude: mock: simulated adapter failure for candidate-claude.md
  kept: pm-codex (already written to the ticket; a re-run will overwrite them)
✗ AC-28: MOCK_ALWAYS_PASS forces a schema-valid approval
✗ AC-7/28: MOCK_ALWAYS_FAIL forces a cited blocker/major verdict
✗ EDGE-3: conflicting mock switches are rejected
✗ EDGE-6: init discovers the checked-out branch
✗ AC-10/12: init writes the default max diff bytes
✗ AC-15: lint rejects prefixed counter with correction
✗ AC-16: lint rejects max_iterations max_iterations: 0
✗ AC-16: lint rejects max_iterations max_iterations: -1
✗ AC-25: missing cross-flow target fails with source, target, and stage
✗ AC-26: same-vendor panel fails lint naming both steps
✗ AC-10/EDGE-4: runtime computes full stat and UTF-8 byte-bounded patch
✗ AC-10/EDGE-4: prompt and run log record truncation
✗ AC-8/9: completed verdicts determine round and stable latest copy
✗ AC-5/10: diff reviewers run read-only
✗ AC-22/EDGE-12: all review outcomes have auditable before/after status
✗ AC-21: development optionally includes the latest verdict
✗ AC-18/19/EDGE-7: repeatable gate answers are queued in encounter order
✗ AC-19: missing non-TTY gate answer is an error
✗ AC-14: regression terminates with target, transition, and remaining budget

✗ 19 Q-0006 behavior assertion(s) failed
✗ q0006-behavior.js exited 1
✗ AC-1/3/4/6/7/13/16: shipped review flow equals its frozen contract
✗ AC-1: review flow and template are byte-identical
✗ AC-2: code-reviewer role and template are byte-identical
✗ AC-2: reviewer persona specifies read-only severity and citations
✗ EDGE-14: backend allow-list agrees and excludes contracts
✗ EDGE-1: runtime contract requires retry to persist exactly max_iterations (3)
✗ AC-30 docs include README review command
✗ AC-30 docs include round variable
✗ AC-30 docs include counter spelling
✗ AC-30 docs include three-dot diff
✗ AC-30 docs include derived regression

✗ 11 Q-0006 contract/asset assertion(s) failed
✗ q0006-contracts.js exited 1

✗ 2 of 3 test file(s) failed

```
