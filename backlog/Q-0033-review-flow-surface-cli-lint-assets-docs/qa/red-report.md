# Test output

```
product":1,"solutioning.architecture-review":1,"qa-red.scenario-review":1,"development.integrate":1}[0m
[2m· cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included[0m
✓ board lists tickets
[31m✗[0m claude: ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only
[31m✗[0m codex: CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only
[2m· presence only — logins NOT verified; run `harness adapters --probe` before a real run[0m
✓ claude adapter refuses an API key regardless of CLI presence
✓ codex adapter refuses an API key regardless of CLI presence
[32m✓[0m T-0003 created at backlog/T-0003-parallel-failure (stage: draft)
[2m·[0m run #1  flow=requirements  ticket=T-0003  draft → requirements
[36m▸[0m [1mpm-claude[0m [2mmock/opus role=product-manager[0m
[36m▸[0m [1mpm-codex[0m [2mmock role=product-manager[0m
[2m·[0m pm-codex: wrote requirements/candidate-codex.md
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
[2m·[0m run #1 failed: draft → draft   cost $0.08  tokens 967
✓ a failed parallel branch fails the run
✓ surviving parallel sibling keeps its output
✓ failed parallel sibling wrote nothing
✓ failed run is recorded in runs.log
✓ failed run does not advance the stage
✓ a failed step records what it cost
✓ failed run's cost includes the failed step (saw 0.08)
[2m·[0m run #2  flow=requirements  ticket=T-0003  draft → requirements
[36m▸[0m [1mpm-claude[0m [2mmock/opus role=product-manager[0m
[36m▸[0m [1mpm-codex[0m [2mmock role=product-manager[0m
[2m·[0m pm-claude: wrote requirements/candidate-claude.md
[32m✓[0m [1mpm-claude[0m [2mcost=$0.010 20ms[0m
[2m·[0m pm-codex: wrote requirements/candidate-codex.md
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mhead-of-product[0m [2mmock/opus role=head-of-product[0m
[2m·[0m head-of-product: wrote requirements/merged.md
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
[33m![0m head-of-product: needs-input — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m head-of-product: iteration 1/1 → goto head-of-product
[36m▸[0m [1mhead-of-product[0m [2mmock/opus role=head-of-product[0m
[2m·[0m head-of-product: wrote requirements/merged.md
[32m✓[0m [1mhead-of-product[0m [2mverdict=ready cost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #2 completed: draft → requirements   cost $0.04  tokens 4045
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
✓ the unanswered second exhaustion gate exits non-zero
✓ retry grants exactly one more traversal, no more (saw 3, expected 3)
✓ the retry grant is recorded in runs.log
✓ the retried loop ends one past its limit, not reset to zero
✓ a retry does not refund an unrelated loop’s budget
[32m✓[0m T-0005 created at backlog/T-0005-interrupted-at-a-gate (stage: draft)
✓ the interrupt fixture reaches the gate

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

──── q0033-surface.js ────
✓ S1.1/S1.2/S1.4 — review flow matches its fixture and all shipped flow peers are byte-identical
✓ S1.3/S3.4/S6.1/S7.8/S8.2/S8.5 — the complete shipped flow directory lints clean
✓ S2.1-S2.5 — the designated reviewer role alone is shared and obeys its persona contract
✓ S3.1 — review flow contains no payload-only or unsupported engine fields
✓ S3.2/S3.3 — shipped mock review traverses rejection and approval paths
- S3.5 — SKIP: finding only: the frozen Q-0006 mock contract already guarantees the schema-valid finding shape
✓ S4.1-S4.3/E6 — shipped config declares commented keys and runtime defaults remain optional
✓ S5.1-S5.7/E5 — init discovers named branches and preserves template formatting while Git failures fall back
✓ S6.2-S6.10 — return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles
✓ S7.1-S7.7 — bounds and counter spelling reject every invalid form
✓ S8.1-S8.4 — same-role review panels must span at least two adapters
✓ S9.1-S9.4/E1 — run uses the same pristine whole-directory preflight before overrides and side effects
✓ S10.1-S10.7/E3/E4 — gate answers accumulate in order, are exact, and never come from auto or closed stdin
✓ S11.1-S11.4 — suite wiring, explicit gates, and board counter/cost compatibility are pinned
✓ S11.5/S11.6 — frozen Q-0006 inputs are guarded and unreachable baselines skip explicitly
✓ S13.1 — the review-failure arrow returns reviewed to red
✓ S13.2-S13.4 — the documented review flow, config and M1 decision match the contracts
✓ S13.5 — the development plan records the Q-0006/Q-0033 split
✓ S13.6 — DECISIONS contains both complete review-flow decisions
✓ S13.7 — the Gate glossary entry distinguishes declared and exhaustion gates
✓ S13.8 — README remains byte-unchanged from the frozen baseline
✓ E7 — unused explicit gate answers are ignored after a gate-free regression
- S12.1 — SKIP: manual: requires authenticated Claude and Codex subscription evidence
- E2 — SKIP: forward-looking guarantee covered indirectly by S6.6-S6.10; future flows do not exist yet
[31m✗ [0mticket T-0001 is at stage "draft", flow "solutioning" consumes "requirements"
[31m✗ [0mgate (human-locked) "loop exhausted at head-of-product (requirements.head-of-product = 2, limit 1); choose: advance (accept as is), retry (exactly one more head-of-product), abort" needs an answer and stdin closed without one — pass --gate-answer advance|retry|abort or run interactively
[31m✗ [0m1 of 2 parallel step(s) failed:
  - pm-claude: mock: simulated adapter failure for candidate-claude.md
  kept: pm-codex (already written to the ticket; a re-run will overwrite them)
✗ an interrupted run is recorded in runs.log
✗ smoke.js exited 1
Preparing worktree (checking out 'harness/T-0001/task-a')

✗ 1 of 3 test file(s) failed

```
