# Test output

`npm test --prefix spike && pnpm turbo run test --force --continue`

## Every result line

```
[32m✓[0m harness/ and backlog/ created in /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH
✓ init
[32m✓[0m chore.yaml
[32m✓[0m development.yaml
[32m✓[0m qa-red.yaml
[32m✓[0m requirements.yaml
[32m✓[0m review.yaml
[32m✓[0m solutioning.yaml
✓ lint passes on shipped flows
[32m✓[0m T-0001 created at backlog/T-0001-subscription-downgrade-mid-cycle (stage: draft)
✓ ticket created
✓ ticket starts at draft
✓ refuses flow whose consumes != ticket stage
[32m✓[0m [1mpm-claude[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=ready cost=$0.010 20ms[0m
✓ requirements flow completes
✓ both PM candidates written
✓ merged requirement written
✓ stage advanced to requirements
✓ backward edge counter persisted (needs-input → retry once)
[32m✓[0m [1marchitect[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1marchitecture-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[32m✓[0m [1marchitect[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1marchitecture-review[0m [2mverdict=approve cost=$0.010 20ms[0m
[32m✓[0m [1mfinalize[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mtasks[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mmerge-contracts[0m [2m1 branch(es) on harness/T-0001/integration[0m
✓ solutioning flow completes
✓ review loop bounced back to architect once
✓ solution.md written
✓ stage advanced to solutioned
✓ architect ran in its own worktree/branch
✓ user working tree untouched except backlog/
✓ tasks.yaml emitted
✓ contracts merged into ticket branch
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[32m✓[0m [1mscenario-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[32m✓[0m [1mscenario-review[0m [2mverdict=approve cost=$0.010 20ms[0m
✓ qa-red flow completes
✓ suite proven red on the ticket branch
✓ stage advanced to red
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mintegrate[0m [2m2 branch(es) on harness/T-0001/integration, tests green[0m
✓ development flow completes
✓ tasks fanned out in dependency waves
✓ failed integration re-ran fan-out scoped to failing tasks
✓ integrated branch is green
✓ stage advanced to green
✓ ticket branch holds contracts, tests and both implementations
✓ user working tree still untouched
✓ integrate runs commands.install in the integration worktree before the tests
[32m✓[0m T-0002 created at backlog/T-0002-second-ticket (stage: draft)
[32m✓[0m [1mpm-claude[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
✓ exhausted loop reaches a gate
✓ --auto does not bypass the exhaustion gate
✓ a gate with no answer available fails the run
✓ the run says which gate it could not answer, instead of hanging or assuming
✓ a human-locked gate is never auto-advanced
✓ board lists tickets
[31m✗[0m claude: ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only
[31m✗[0m codex: CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only
✓ claude adapter refuses an API key regardless of CLI presence
✓ codex adapter refuses an API key regardless of CLI presence
[32m✓[0m T-0003 created at backlog/T-0003-parallel-failure (stage: draft)
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
✓ a failed parallel branch fails the run
✓ surviving parallel sibling keeps its output
✓ failed parallel sibling wrote nothing
✓ failed run is recorded in runs.log
✓ failed run does not advance the stage
✓ a failed step records what it cost
✓ failed run's cost includes the failed step (saw 0.08)
[32m✓[0m [1mpm-claude[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mpm-codex[0m [2mcost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
[32m✓[0m [1mhead-of-product[0m [2mverdict=ready cost=$0.010 20ms[0m
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
✓ an unanswered non-TTY gate terminates the run
✓ an unanswered gate records a terminal outcome in runs.log
✓ an unanswered gate does not advance the stage
✓ an unanswered gate does not refund its iteration counter
✓ a loop that hides its verdict from the step it returns to fails lint
✓ the lint names the artifact that never arrives
✓ feeding the verdict back makes the loop lintable
✓ a fan-out target is exempt — the engine feeds it the result
✓ conflicts are listed when there are any
✓ git's own words are used when nothing conflicted
✓ a failure with no reason says so instead of trailing off
✓ a missing result does not crash the reporter
✓ a base branch that does not exist yet is stated, not warned about
✓ no sync warning is raised when there was nothing to sync
✓ no failure is ever reported with an empty reason
✓ a result line at the very start survives truncation
✓ a result line at the very end survives truncation
✓ the cut is in the middle and says so
✓ the report names the command it ran
✓ output with no result lines says so rather than looking empty
[32m✓[0m T-0006 created at backlog/T-0006-abandoned-merge (stage: draft)
✓ a failing integrate with no on_fail aborts the run
✓ an aborted run leaves the ticket branch exactly as it found it
✓ the abandoned merge is gone, so the next red phase measures against a clean base
✓ the work itself survives on its own branch — nothing is lost by rolling back
✓ the rollback is recorded in runs.log
[32m✓[0m T-0007 created at backlog/T-0007-base-conflict (stage: draft)
✓ a base-sync conflict fails the run
✓ the failure names the two branches that disagree
✓ it says why looping would not help
✓ a base conflict does not consume the iteration budget
✓ the base conflict is distinguishable in runs.log
✓ a commit message never reaches a shell
✓ the message is committed verbatim, backticks and all
✓ backlog edits are reported, not silently dropped (2)
✓ an agent cannot rewrite engine-owned ticket state from a worktree
✓ a file an agent adds under backlog/ is removed, not committed
✓ nothing under backlog/ is committed from a worktree
✓ work outside backlog/ still commits normally
✓ the worktree is left clean under backlog/
✓ the role table has rows (found 5)
✓ role table row "generalist" has a role file
✓ developer-generalist runs on the vendor the table names (claude)
✓ developer-generalist declares paths in frontmatter
✓ developer-generalist frontmatter matches the table (.github,.gitignore,.npmrc,apps,docs,harness,package.json,packages,pnpm-workspace.yaml,spike,tsconfig*.json,turbo.json vs .github,.gitignore,.npmrc,apps,docs,harness,package.json,packages,pnpm-workspace.yaml,spike,tsconfig*.json,turbo.json)
✓ developer-generalist prose names its allowed path .github
✓ developer-generalist prose names its allowed path .gitignore
✓ developer-generalist prose names its allowed path .npmrc
✓ developer-generalist prose names its allowed path apps
✓ developer-generalist prose names its allowed path docs
✓ developer-generalist prose names its allowed path harness
✓ developer-generalist prose names its allowed path package.json
✓ developer-generalist prose names its allowed path packages
✓ developer-generalist prose names its allowed path pnpm-workspace.yaml
✓ developer-generalist prose names its allowed path spike
✓ developer-generalist prose names its allowed path tsconfig*.json
✓ developer-generalist prose names its allowed path turbo.json
✓ role table row "backend" has a role file
✓ developer-backend runs on the vendor the table names (codex)
✓ developer-backend declares paths in frontmatter
✓ developer-backend frontmatter matches the table (backlog,docs,harness,packages/core,packages/shared,spike/src vs backlog,docs,harness,packages/core,packages/shared,spike/src)
✓ developer-backend prose names its allowed path backlog
✓ developer-backend prose names its allowed path docs
✓ developer-backend prose names its allowed path harness
✓ developer-backend prose names its allowed path packages/core
✓ developer-backend prose names its allowed path packages/shared
✓ developer-backend prose names its allowed path spike/src
✓ role table row "tooling" has a role file
✓ developer-tooling runs on the vendor the table names (claude)
✓ developer-tooling declares paths in frontmatter
✓ developer-tooling frontmatter matches the table (packages/core,packages/shared,spike/bin,spike/test vs packages/core,packages/shared,spike/bin,spike/test)
✓ developer-tooling prose names its allowed path packages/core
✓ developer-tooling prose names its allowed path packages/shared
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
✓ the role table spans more than one vendor (claude,codex)
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
✓ harness validate exits 1 so a red test can fail on it
✓ a priced step shows money
✓ an unpriced step shows tokens, not $0.000
✓ an unpriced step is never displayed as free
✓ role model applies on its own vendor
✓ role model does not leak to another vendor
✓ an explicit step model always wins
✓ a range with commits yields the patch
✓ an empty diff range throws instead of reviewing nothing
✓ the error names both refs
✓ and the short SHA main resolved to
✓ and the one the branch resolved to
✓ and the check it ran, quotably
✓ and that check's outcome
✓ the error claims no historical event
✓ and recommends no range the guard would reject
✓ unscoped tasks still wave by depends_on
✓ waves() alone still rejects a depends_on it cannot resolve
✓ scoping keeps only the failing task
✓ a dependency on a merged sibling is dropped, not carried
✓ the scoped retry runs in one wave instead of crashing
✓ scoping does not mutate the loaded tasks
✓ a dependency inside the scope is preserved
✓ the ticket branch syncs to base before fan-out
✓ work landed on base is present before any worktree is cut
✓ a ticket with no integration branch yet is skipped, not failed
✓ a base conflict before fan-out throws instead of spawning agents
✓ and it says a human must resolve it
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
✓ AC-12/EDGE-10/EDGE-11 — lists, filters, warns, and applies the specified selection grammar/order
✓ AC-12 — missing history is an explicit successful empty state
✓ AC-13/EDGE-9 — detail is ordered and honestly reports incomplete manifests
✓ AC-13/EDGE-20 — detail exposes every attempt including usage-null failures and all contracted fields
✓ AC-13/EDGE-12 — --json is one ANSI-free document for list, detail, warning, and error modes
✓ AC-14 — real schema validation rejects structural mutations
✓ AC-14/EDGE-13 — annotation activates roll-up semantics and generic schemas announce skips
✓ EDGE-15/EDGE-16 — semantic validation rejects duplicate occurrence directories and vendors
✓ EDGE-17/EDGE-18 — semantic validation rejects lifecycle and kind/nullability contradictions
✓ S1.1/S1.2/S1.4 — review flow matches its fixture and all shipped flow peers are byte-identical
✓ S1.3/S3.4/S6.1/S7.8/S8.2/S8.5 — the complete shipped flow directory lints clean
✓ S2.1-S2.5 — the designated reviewer role alone is shared and obeys its persona contract
✓ S3.1 — review flow contains no payload-only or unsupported engine fields
✓ S3.2/S3.3 — shipped mock review traverses rejection and approval paths
SKIP S3.5: finding only: the frozen Q-0006 mock contract already guarantees the schema-valid finding shape
✓ S4.1-S4.3/E6 — shipped config declares commented keys and runtime defaults remain optional
✓ S5.1-S5.7/E5 — init discovers named branches and preserves template formatting while Git failures fall back
  ✓ S6.2 multi-hop
  ✓ S6.3 missing
  ✓ S6.4 unloadable
  ✓ S6.5 dead end
  ✓ S6.6 ambiguity
  ✓ S6.8/S6.10 cycle/repeated pair
  ✓ S6.9 self target
  ✓ S6.7 unreached ambiguity
✓ S6.2-S6.10 — return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles
  ✓ S7.1
  ✓ S7.2
  ✓ S7.3
  ✓ S7.4
  ✓ S7.5
  ✓ S7.6
  ✓ S7.7
✓ S7.1-S7.7 — bounds and counter spelling reject every invalid form
  ✓ S8.1 two-member single vendor
  ✓ S8.2 shipped panel
  ✓ S8.3 three-member single vendor
  ✓ S8.4 mixed three-member panel
✓ S8.1-S8.4 — same-role review panels must span at least two adapters
✓ S9.1-S9.4/E1 — run uses the same pristine whole-directory preflight before overrides and side effects
  ✓ S10.1/S10.2 ordered answers
  ✓ S10.3 exact explicit answer
  ✓ S10.4 non-TTY has no default
  ✓ S10.6 auto cannot answer exhaustion
  ✓ S10.7 review retry persists the limit
  ✓ E3 other repeated flags stay last-wins
  ✓ E4 explicit exhaustion answer avoids stdin rejection
✓ S10.1-S10.7/E3/E4 — gate answers accumulate in order, are exact, and never come from auto or closed stdin
SKIP S10.5: requires an interactive TTY to prove empty-line rejection and re-prompting
✓ S11.1-S11.4 — suite wiring, explicit gates, and board counter/cost compatibility are pinned
✓ S11.5 — frozen Q-0006 inputs are unchanged from the reachable baseline
SKIP S11.6: baseline 0000000000000000000000000000000000000033 unavailable (guard skips without raw Git output)
✓ S13.1 — the review-failure arrow returns reviewed to red
✓ S13.2-S13.4 — the documented review flow, config and M1 decision match the contracts
✓ S13.5 — the development plan records the Q-0006/Q-0033 split
✓ S13.6 — DECISIONS contains both complete review-flow decisions
✓ S13.7 — the Gate glossary entry distinguishes declared and exhaustion gates
✓ S13.8 — README remains byte-unchanged from the frozen baseline
✓ E7 — unused explicit gate answers are ignored after a gate-free regression
SKIP S12.1: manual: requires authenticated Claude and Codex subscription evidence
SKIP E2: forward-looking guarantee covered indirectly by S6.6-S6.10; future flows do not exist yet
# E8 evidence — merge-base 352d0a0adb68cc3d6688a2575358a4db07618e08; paths: (none)
SKIP E9: already covered by smoke.js's five truncation assertions
✓ S1.1/S1.2/S1.4 review flow matches its fixture and all shipped flow peers are byte-identical
✓ S1.3/S3.4/S6.1/S7.8/S8.2/S8.5 the complete shipped flow directory lints clean
✓ S2.1-S2.5 the designated reviewer role alone is shared and obeys its persona contract
✓ S3.1 review flow contains no payload-only or unsupported engine fields
✓ S3.2/S3.3 shipped mock review traverses rejection and approval paths
SKIP S3.5 finding only: the frozen Q-0006 mock contract already guarantees the schema-valid finding shape
✓ S4.1-S4.3/E6 shipped config declares commented keys and runtime defaults remain optional
✓ S5.1-S5.7/E5 init discovers named branches and preserves template formatting while Git failures fall back
✓ S6.2 multi-hop fixture
✓ S6.3 missing fixture
✓ S6.4 unloadable fixture
✓ S6.5 dead end fixture
✓ S6.6 ambiguity fixture
✓ S6.8/S6.10 cycle/repeated pair fixture
✓ S6.9 self target fixture
✓ S6.7 unreached ambiguity fixture
✓ S6.2-S6.10 return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles
✓ S7.1 fixture
✓ S7.2 fixture
✓ S7.3 fixture
✓ S7.4 fixture
✓ S7.5 fixture
✓ S7.6 fixture
✓ S7.7 fixture
✓ S7.1-S7.7 bounds and counter spelling reject every invalid form
✓ S8.1 two-member single vendor fixture
✓ S8.2 shipped panel fixture
✓ S8.3 three-member single vendor fixture
✓ S8.4 mixed three-member panel fixture
✓ S8.1-S8.4 same-role review panels must span at least two adapters
✓ S9.1-S9.4/E1 run uses the same pristine whole-directory preflight before overrides and side effects
✓ S10.1/S10.2 ordered answers fixture
✓ S10.3 exact explicit answer fixture
✓ S10.4 non-TTY has no default fixture
✓ S10.6 auto cannot answer exhaustion fixture
✓ S10.7 review retry persists the limit fixture
✓ E3 other repeated flags stay last-wins fixture
✓ E4 explicit exhaustion answer avoids stdin rejection fixture
✓ S10.1-S10.7/E3/E4 gate answers accumulate in order, are exact, and never come from auto or closed stdin
SKIP S10.5 requires an interactive TTY to prove empty-line rejection and re-prompting
✓ S11.1-S11.4 suite wiring, explicit gates, and board counter/cost compatibility are pinned
✓ S11.5 frozen Q-0006 inputs are unchanged from the reachable baseline
SKIP S11.6 baseline 0000000000000000000000000000000000000033 unavailable (guard skips without raw Git output)
✓ S13.1 the review-failure arrow returns reviewed to red
✓ S13.2-S13.4 the documented review flow, config and M1 decision match the contracts
✓ S13.5 the development plan records the Q-0006/Q-0033 split
✓ S13.6 DECISIONS contains both complete review-flow decisions
✓ S13.7 the Gate glossary entry distinguishes declared and exhaustion gates
✓ S13.8 README remains byte-unchanged from the frozen baseline
✓ E7 unused explicit gate answers are ignored after a gate-free regression
SKIP S12.1 manual: requires authenticated Claude and Codex subscription evidence
SKIP E2 forward-looking guarantee covered indirectly by S6.6-S6.10; future flows do not exist yet
SKIP E9 already covered by smoke.js's five truncation assertions
✓ C1 — a chore-shaped flow runs end to end: flow-created ranges defer to step time and the guard admits integration...implement
✓ C1b — a dry run of the chore-shaped flow previews without demanding branches only a real run creates
✓ C2 — the preflight still fails before any step for a pre-existing-ref range with a missing endpoint
✓ C3 — the guard still rejects a range aimed at refs unrelated to the ticket
✓ 4 scenarios passed
✓ D1 — a dry run leaves ticket.md byte-identical and writes no runs.log
✓ D2 — the real run still consumes the stage a dry run previewed
✓ 2 scenarios passed
  ✓ PROBE_SCHEMA requires every property it declares
  ✓ schemaFor() is strict for every step shape it emits
✓ 2 checks passed
✓ B1 — no bookkeeping field reaches a persisted manifest, mid-run included
✓ B2 — vendor token totals do not add cache components a second time
✓ B3 — an existing run directory is refused by name, not by raw EEXIST
✓ B4 — a run token cannot select a directory outside .quorum/runs
✓ 4 scenarios passed
✓ E1 — AC-1/AC-2/AC-4.1 — right contained in left: the failure names its evidence and claims no event
✓ E2 — AC-4.2 — different commits with identical trees: not contained, and never called the same commit
✓ E3 — AC-4.3 — nothing added since the merge base, trees differ: not contained, nothing added
✓ E4 — AC-4.4 — the check could not answer: indeterminate with a reason, never a containment claim
✓ E5 — AC-5 — an unresolvable endpoint fails with the evidence that exists and keeps its identifying phrase
✓ E6 — AC-6 — every remedy passes the guard, and a guard failure stays a guard failure
✓ E7 — AC-7 — the guard derives its expected endpoints from ctx.vars.base, so a future --base composes
✓ E8 — AC-11 — a valid range is untouched: same patch, same stat, same truncation
✓ E9 — AC-10 — harness lint rejects a malformed or out-of-class input.diff, and admits every shipped flow
✓ E10 — AC-8 — a bad range over pre-existing refs fails with zero adapter invocations
✓ E11 — AC-9 — a deferred range fails before the adapter that would consume it, naming the step that owed the branch
✓ E12 — AC-9 — the --dry placeholder for a deferred range is unchanged
✓ E13 — AC-3 — a shallow probe that cannot answer never becomes a confident negative
✓ E14 — AC-10 — the lint rule reaches a fan_out step's template, where a bad range would survive to a billed run
✓ E15 — AC-9 — a deferred range that comes out indeterminate says so, and still names the step that owed the branch
✓ E16 — AC-9 — a deferred range whose endpoint does not resolve reports the evidence that exists
✓ E17 — AC-8/AC-11 — the preflight reaches a fan_out template, so its range is judged once, before the fan-out is billed
✓ q0035 empty-range diagnostic: all scenarios passed
✓ C1 — a contained branch is annotated, nothing is written, and no legend appears
✓ C2 — a diverged branch counts base..branch, not the symmetric difference
✓ C10 — a branch that is not here is reported once the stage claims the work is done, and not before
✓ C3 — an unresolvable or absent branch renders as today, as does an empty backlog
✓ C4 — a missing base ref is indeterminate (missing ref) with the legend, never a containment claim
✓ C5 — a shallow clone turns a provable-only-with-history negative into indeterminate (shallow clone)
✓ C6 — a project that is not a git repository renders as today and exits 0
✓ C7 — a master-based project annotates master and says main nowhere
✓ C8 — an injection-shaped branch value never reaches a git command line
✓ C9 — a tag sharing the branch name does not stop the branch being annotated
✓ q0036 board containment: all scenarios passed
  ✓ a CLI that exits 0 without reading stdin does not crash the process
  ✓ a CLI that exits non-zero without reading stdin reports its own exit code
  ✓ the truncated prompt is recorded rather than swallowed
  ✓ a CLI that does read its prompt is unaffected
  ✓ a missing binary still resolves with code -1 rather than throwing
  ✓ 2 MiB arrives whole and the status survives — monolithic, leaves naturally, status 0
  ✓ 2 MiB arrives whole and the status survives — monolithic, leaves naturally, status 3
  ✓ 2 MiB arrives whole and the status survives — monolithic, leaves by exit(), status 0 [THE FALSE GREEN]
  ✓ 2 MiB arrives whole and the status survives — monolithic, leaves by exit(), status 3
  ✓ 2 MiB arrives whole and the status survives — progressive, leaves naturally, status 0
  ✓ 2 MiB arrives whole and the status survives — progressive, leaves naturally, status 3
  ✓ 2 MiB arrives whole and the status survives — progressive, leaves by exit(), status 0
  ✓ 2 MiB arrives whole and the status survives — progressive, leaves by exit(), status 3
  ✓ a 900 KiB child still returns code 0 and every byte — the under-ceiling regression
  ✓ stderr is discarded on the success path
  ✓ the failure path is whole stdout then whole stderr, never interleaved
  ✓ a timeout is still a timeout, and it keeps what the child produced
  ✓ stdin is still ignored, so a command that reads it finishes instead of waiting
  ✓ a capture that cannot be created throws, and reports no verdict
  ✓ a capture that cannot be read back throws rather than reporting an empty command
  ✓ a close that reports a deferred write failure names the capture, not the command
✓ all 13 test files passed
```

## Output

```

> quorum (spike)@0.0.1 test
> node test/run.js


──── smoke.js ────
[32m✓[0m harness/ and backlog/ created in /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH
  next: harness adapters · harness ticket new "…" · harness run requirements T-0001
✓ init
[32m✓[0m chore.yaml
[32m✓[0m development.yaml
[32m✓[0m qa-red.yaml
[32m✓[0m requirements.yaml
[32m✓[0m review.yaml
[32m✓[0m solutioning.yaml
✓ lint passes on shipped flows
[32m✓[0m T-0001 created at backlog/T-0001-subscription-downgrade-mid-cycle (stage: draft)
✓ ticket created
✓ ticket starts at draft
✓ refuses flow whose consumes != ticket stage
[2m·[0m run #1  flow=requirements  ticket=T-0001  draft → requirements
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
[2m·[0m run #1 completed: draft → requirements   cost $0.04  tokens 4009
✓ requirements flow completes
✓ both PM candidates written
✓ merged requirement written
✓ stage advanced to requirements
✓ backward edge counter persisted (needs-input → retry once)
[2m·[0m run #2  flow=solutioning  ticket=T-0001  requirements → solutioned
[2m·[0m architect: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__contracts (harness/T-0001/contracts)
[36m▸[0m [1marchitect[0m [2mmock role=principal-architect[0m
[2m·[0m architect: wrote solution/draft.md
[2m·[0m architect: 1 file(s) committed on harness/T-0001/contracts
[32m✓[0m [1marchitect[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1marchitecture-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m architecture-review: wrote solution/review.md
[32m✓[0m [1marchitecture-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[33m![0m architecture-review: revise — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m architecture-review: iteration 1/2 → goto architect
[2m·[0m architect: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__contracts (harness/T-0001/contracts)
[2m·[0m architect: base harness/T-0001/integration does not exist yet — nothing to sync
[36m▸[0m [1marchitect[0m [2mmock role=principal-architect[0m
[2m·[0m architect: wrote solution/draft.md
[2m·[0m architect: 1 file(s) committed on harness/T-0001/contracts
[32m✓[0m [1marchitect[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1marchitecture-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m architecture-review: wrote solution/review.md
[32m✓[0m [1marchitecture-review[0m [2mverdict=approve cost=$0.010 20ms[0m
[36m▸[0m [1mfinalize[0m [2mmock role=principal-architect[0m
[2m·[0m finalize: wrote solution/solution.md
[32m✓[0m [1mfinalize[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mtasks[0m [2mmock role=principal-architect[0m
[2m·[0m tasks: wrote solution/tasks.yaml
[32m✓[0m [1mtasks[0m [2mcost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[36m▸[0m [1mmerge-contracts[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m merge-contracts: synced base master
[2m·[0m merge-contracts: merged harness/T-0001/contracts
[32m✓[0m [1mmerge-contracts[0m [2m1 branch(es) on harness/T-0001/integration[0m
[2m·[0m run #2 completed: requirements → solutioned   cost $0.06  tokens 7165
✓ solutioning flow completes
✓ review loop bounced back to architect once
✓ solution.md written
✓ stage advanced to solutioned
✓ architect ran in its own worktree/branch
✓ user working tree untouched except backlog/
✓ tasks.yaml emitted
✓ contracts merged into ticket branch
[2m·[0m run #3  flow=qa-red  ticket=T-0001  solutioned → red
[36m▸[0m [1mscenarios[0m [2mmock/sonnet role=automation-qa[0m
[2m·[0m scenarios: wrote qa/scenarios.md
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[2m·[0m write-tests: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__tests (harness/T-0001/tests)
[36m▸[0m [1mwrite-tests[0m [2mmock role=automation-qa[0m
[2m·[0m write-tests: 1 file(s) committed on harness/T-0001/tests
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mprove-red[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m prove-red: synced base master
[2m·[0m prove-red: merged harness/T-0001/tests
[2m·[0m prove-red: install exit 0
[2m·[0m prove-red: tests exit 1, expected fail
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[36m▸[0m [1mscenario-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m scenario-review: wrote qa/scenario-review.md
[32m✓[0m [1mscenario-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[33m![0m scenario-review: revise — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m scenario-review: iteration 1/1 → goto scenarios
[36m▸[0m [1mscenarios[0m [2mmock/sonnet role=automation-qa[0m
[2m·[0m scenarios: wrote qa/scenarios.md
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[2m·[0m write-tests: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__tests (harness/T-0001/tests)
[2m·[0m write-tests: synced to harness/T-0001/integration
[36m▸[0m [1mwrite-tests[0m [2mmock role=automation-qa[0m
[2m·[0m write-tests: no file changes on harness/T-0001/tests
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mprove-red[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m prove-red: synced base master
[2m·[0m prove-red: merged harness/T-0001/tests
[2m·[0m prove-red: install exit 0
[2m·[0m prove-red: tests exit 1, expected fail
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[36m▸[0m [1mscenario-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m scenario-review: wrote qa/scenario-review.md
[32m✓[0m [1mscenario-review[0m [2mverdict=approve cost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #3 completed: solutioned → red   cost $0.06  tokens 6866
✓ qa-red flow completes
✓ suite proven red on the ticket branch
✓ stage advanced to red
[2m·[0m run #4  flow=development  ticket=T-0001  red → green
[2m·[0m developers: harness/T-0001/integration synced to master before fan-out
[2m·[0m developers: 2 task(s) in 2 wave(s)
[2m·[0m developers: wave 1: T-0001.1(backend)
[2m·[0m dev:T-0001.1: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__T-0001.1 (harness/T-0001/T-0001.1)
[2m·[0m dev:T-0001.1: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.1[0m [2mmock role=developer-backend[0m
[2m·[0m dev:T-0001.1: 1 file(s) committed on harness/T-0001/T-0001.1
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[2m·[0m developers: wave 2: T-0001.2(frontend)
[2m·[0m dev:T-0001.2: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__T-0001.2 (harness/T-0001/T-0001.2)
[2m·[0m dev:T-0001.2: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.2[0m [2mmock/sonnet role=developer-frontend[0m
[2m·[0m dev:T-0001.2: no file changes on harness/T-0001/T-0001.2
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mintegrate[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m integrate: synced base master
[2m·[0m integrate: merged harness/T-0001/T-0001.1
[2m·[0m integrate: merged harness/T-0001/T-0001.2
[2m·[0m integrate: install exit 0
[33m![0m integrate: tests exit 1, expected pass
[33m![0m integrate: iteration 1/3 → goto developers
[33m![0m developers: scoped to failing tasks: T-0001.1, T-0001.2
[2m·[0m developers: harness/T-0001/integration synced to master before fan-out
[2m·[0m developers: 2 task(s) in 2 wave(s)
[2m·[0m developers: wave 1: T-0001.1(backend)
[2m·[0m dev:T-0001.1: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__T-0001.1 (harness/T-0001/T-0001.1)
[2m·[0m dev:T-0001.1: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.1[0m [2mmock role=developer-backend[0m
[2m·[0m dev:T-0001.1: 1 file(s) committed on harness/T-0001/T-0001.1
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[2m·[0m developers: wave 2: T-0001.2(frontend)
[2m·[0m dev:T-0001.2: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-7usHPH/.harness/worktrees/harness__T-0001__T-0001.2 (harness/T-0001/T-0001.2)
[2m·[0m dev:T-0001.2: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.2[0m [2mmock/sonnet role=developer-frontend[0m
[2m·[0m dev:T-0001.2: 1 file(s) committed on harness/T-0001/T-0001.2
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mintegrate[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m integrate: synced base master
[2m·[0m integrate: merged harness/T-0001/T-0001.1
[2m·[0m integrate: merged harness/T-0001/T-0001.2
[2m·[0m integrate: install exit 0
[2m·[0m integrate: tests exit 0, expected pass
[32m✓[0m [1mintegrate[0m [2m2 branch(es) on harness/T-0001/integration, tests green[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #4 completed: red → green   cost $0.04  tokens 4471
✓ development flow completes
✓ tasks fanned out in dependency waves
✓ failed integration re-ran fan-out scoped to failing tasks
✓ integrated branch is green
✓ stage advanced to green
✓ ticket branch holds contracts, tests and both implementations
✓ user working tree still untouched
✓ integrate runs commands.install in the integration worktree before the tests
[32m✓[0m T-0002 created at backlog/T-0002-second-ticket (stage: draft)
[2m·[0m run #1  flow=requirements  ticket=T-0002  draft → requirements
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
[32m✓[0m [1mhead-of-product[0m [2mverdict=needs-input cost=$0.010 20ms[0m
[33m![0m head-of-product: needs-input — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m head-of-product: loop exhausted (1) → human gate

[33m■ GATE[0m (human-locked) loop exhausted at h

… 45489 characters of output omitted from the middle …

[39m
@quorum/core:test:      [33m[2m✓[22m[39m a CLI that does read its prompt is unaffected [33m 922[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m each complete line is delivered without its newline [33m 961[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a trailing line with no newline is flushed on close, exactly once [33m 739[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and nothing at all is delivered as nothing [33m 823[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m argv reaches the child, and cwd is where it runs [33m 858[2mms[22m[39m
@quorum/core:test:  [32m✓[39m src/git/git.test.ts [2m([22m[2m52 tests[22m[2m)[22m[33m 8954[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m any other successful output is false, preserved from the spike (OQ-4) [33m 1103[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a failed ancestry check, and a failed ahead count, are both indeterminate (git failed) [33m 1753[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the per-invocation probes are issued once per containment() call [33m 705[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m each ticket costs at most two more, contained and not-contained alike [33m 980[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a failed tree comparison never changes the ancestry state [33m 818[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the exclusion is written before the worktree is added [33m 837[2mms[22m[39m
@quorum/core:test:  [32m✓[39m src/adapters/claude.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 24890[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and on NO other vendor's — "all three variables" is a property of the pair, not of one adapter [33m 525[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m on success it answers the trimmed version and makes no authenticated request [33m 936[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a CLI that exits non-zero on --version is not runnable, and says so in its own words [33m 936[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m read-only, no model, no extra directories, no extraArgs [33m 1126[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a worktree step asks for the writing permission mode [33m 746[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a named model is passed, and an unnamed one leaves the flag off entirely [33m 1397[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m several extra directories each get their own flag, in order [33m 1562[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m extraArgs land last, and may duplicate a flag the adapter already passed [33m 551[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m maxTurns is accepted and ignored: no turn-budget flag is passed [33m 700[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the prompt goes on stdin, whole [33m 412[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m exit 1 with the reason only in the envelope [33m 437[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m is_error: true while exiting 0 — the envelope is parsed before the exit code is judged [33m 436[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m nothing on either stream reads as nothing, not as an empty message [33m 403[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the detail falls back through error.message, then subtype, then the tail of both streams [33m 1572[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the detail is truncated to 2000 characters [33m 548[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m an auth failure becomes the one actionable sentence instead [33m 517[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and a compile error is left in the vendor's own words [33m 510[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a failure with no usage at all still carries a usage object of nulls [33m 542[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the M0 probe: 65 uncached tokens against a real $0.39, and 74264 once the cache is counted [33m 523[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a missing cache field counts as zero rather than voiding the sum [33m 515[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m an envelope carrying no usage at all reports null for every measure — never zero [33m 534[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the session id comes from the envelope, and is null when there is none [33m 1041[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m native structured output wins, and raw is the final message [33m 532[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m absent, it falls back to a fenced block in the message [33m 524[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m absent with nothing parseable, the answer is null — never a repaired object [33m 513[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m an unparseable envelope leaves raw as the whole of stdout [33m 537[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a final message that is not a string is still the vendor's answer, not a reason to use stdout [33m 525[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and only an ABSENT one falls back to stdout [33m 536[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m an empty final message is present, so it does NOT fall back [33m 500[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a session id that is not a string is handed on as the vendor sent it [33m 533[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a measure that is not a number is handed on too — judging it is not the adapter's job [33m 519[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a usage field that is not an object reports zero tokens, not "unmeasured" [33m 531[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m PRESERVED DEFECT: a non-string message with no structured output crashes the run [33m 523[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m spawn once, then one stdout event per complete line, in order [33m 517[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m it never emits a retry — the union permits it and withRetry owns it [33m 528[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the spawn event names the vendor and quotes every argument that needs it [33m 529[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a long argument is truncated at 80 characters, and a short one is left alone [33m 518[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a directory whose name contains a space IS quoted, which is claude's half of the asymmetry [33m 528[2mms[22m[39m
@quorum/core:test:  [32m✓[39m src/adapters/codex.test.ts [2m([22m[2m38 tests[22m[2m)[22m[33m 26164[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and NOT on claude's — "all three variables" is a property of the pair, not of one adapter [33m 744[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m on success it answers the trimmed version and makes no authenticated request [33m 917[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m read-only, no model, no extra directories, no extraArgs [33m 1145[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a worktree step asks for the writing sandbox [33m 920[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m --ignore-user-config is unconditional, on every combination [33m 2992[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a named model is passed, and an unnamed one leaves the flag off entirely [33m 1560[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m several extra directories each get their own flag, in order [33m 413[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m extraArgs land after the flags and before the trailing dash, and may duplicate one [33m 416[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the schema is written to the temp directory, and the prompt goes on stdin [33m 438[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the vendor's own JSON nested inside message is dug out [33m 432[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m all three error shapes are collected, de-duplicated, and joined [33m 411[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m nothing reported at all falls back to the streams, then to saying so [33m 1054[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m an expired refresh token becomes the one actionable sentence [33m 520[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and a compile error is not translated [33m 543[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a stream that dies mid-turn still reports the tokens it had already spent [33m 512[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the temp directory is removed on every terminal path — success, non-zero exit, and a spawn failure [33m 1057[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the exact 0.149.0 envelope from the contract document [33m 516[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m reasoning tokens are billed as output and added to it [33m 527[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m usage is read from the event, from its payload, and from its item [33m 1576[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m cost is null and never zero, on a measured run and on an unmeasured one [33m 1053[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m nothing reported leaves every measure null, and cache writes are never reported at all [33m 515[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a zero output count keeps whatever was reported before it [33m 527[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the session id comes from thread_id, session_id or the payload, and lines that are not JSON are ignored [33m 2102[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a measure that is not a number is handed on as the stream reported it [33m 518[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a usage field that is not an object leaves every measure where it was [33m 530[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m a thread id that is not a string is handed on as the vendor sent it [33m 522[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m and an event carrying no id at all leaves the previous one standing [33m 522[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m last.txt present and holding JSON wins over stdout [33m 523[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m last.txt present but malformed falls through to the fenced-block extraction [33m 528[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m last.txt missing falls back to stdout, and an unparseable tail is null [33m 1048[2mms[22m[39m
@quorum/core:test:      [33m[2m✓[22m[39m the answer carries the six fields the contract names and nothing else [33m 317[2mms[22m[39m
@quorum/core:test: 
@quorum/core:test: [2m Test Files [22m [1m[32m41 passed[39m[22m[2m | [22m[33m1 skipped[39m[90m (42)[39m
@quorum/core:test: [2m      Tests [22m [1m[32m879 passed[39m[22m[2m | [22m[33m2 skipped[39m[90m (881)[39m
@quorum/core:test: [2m   Start at [22m 14:37:49
@quorum/core:test: [2m   Duration [22m 26.46s[2m (transform 1.95s, setup 0ms, import 4.04s, tests 80.26s, environment 2ms)[22m
@quorum/core:test: 

 Tasks:    7 successful, 7 total
Cached:    0 cached, 7 total
  Time:    27.571s 


```
