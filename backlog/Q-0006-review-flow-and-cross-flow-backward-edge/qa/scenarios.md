## Q-0006 — Test scenarios: review flow with cross-flow backward edge

Source: `requirements/merged.md` (30 acceptance criteria, decisions D1–D9) and `solution/solution.md`
(runtime design, architecture review rounds 1–3). One scenario per acceptance criterion, in order,
followed by edge cases the architecture review and solution called out that are not already a
numbered AC. Each scenario is tagged with the task id(s) whose contract it proves.

Tasks referenced: `Q0006-mock-switch`, `Q0006-runtime`, `Q0006-cli-lint`, `Q0006-assets-docs`.

---

### Acceptance-criterion scenarios

**AC-1 — `review.yaml` exists and lints**
Tags: Q0006-assets-docs, Q0006-cli-lint
- Given `harness/flows/review.yaml` declares `name: review`, `consumes: green`, `produces: reviewed`, `cross_vendor: required`
- When `harness lint` runs
- Then it reports `review.yaml` ✓, and `diff -rq harness/flows spike/templates/harness/flows` returns empty across every shipped flow, including this one.

**AC-2 — the `code-reviewer` role exists**
Tags: Q0006-assets-docs
- Given `harness/roles/code-reviewer.md` defines a read-only persona that classifies findings as blocker/major/nit, quotes file and line, and pins no codex model name
- When its byte-identical template copy is diffed and `spike/test/smoke.js:128`'s no-pinned-model assertion runs
- Then the diff is empty and the smoke assertion still passes.

**AC-3 — the flow uses only engine-supported step fields**
Tags: Q0006-assets-docs, Q0006-runtime
- Given `review.yaml` contains no `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true, tasks: true }`, and no `on_fail.with:`
- When the mock adapter runs `review.yaml` end to end
- Then the run completes using only step fields `runStep`, `buildPrompt`, `schemaFor` and `handleFail` already support, with no engine feature added beyond what these ACs name.

**AC-4 — the panel is two reviewers on two vendors**
Tags: Q0006-runtime, Q0006-assets-docs
- Given a ticket at stage `green` with an integration branch `harness/<id>/integration`
- When `harness run review <id>` executes the panel's parallel group
- Then one step runs on `claude` and the other on `codex`, writing `review/round-{round}/claude.md` and `review/round-{round}/codex.md` respectively.

**AC-5 — reviewers are read-only**
Tags: Q0006-runtime
- Given neither panel step declares `worktree`
- When the panel runs
- Then both run with `allowWrite: false`, and afterwards `git status --porcelain` shows changes only under `backlog/`, `git worktree list` is unchanged, and no branch was created.

**AC-6 — one verdict step judges the panel**
Tags: Q0006-runtime
- Given `review/round-{round}/claude.md` and `codex.md` exist alongside `requirements/merged.md` and `solution/solution.md`
- When the verdict step runs
- Then it writes `review/round-{round}/verdict.md`, emits `verdict: approve|changes-requested` with `findings` non-empty iff `changes-requested`, and its input excludes the diff entirely.

**AC-7 — severity threshold is testable**
Tags: Q0006-runtime, Q0006-assets-docs
- Given a round whose two reviews contain only `nit` findings
- When the verdict step evaluates them
- Then the verdict is `approve`; given instead a round where at least one review contains a `blocker` or `major`, then the verdict is `changes-requested`.

**AC-8 — rounds never overwrite each other**
Tags: Q0006-runtime
- Given `review/round-1/verdict.md` already exists from a prior approved round
- When a later, regression-triggered review run executes
- Then `{round}` resolves to `2`, `review/round-2/verdict.md` is written with different content, and `review/round-1/verdict.md` is untouched.
- Given instead a round failed before writing a verdict, when it is retried, then it reuses that same round's directory rather than advancing `{round}`.

**AC-9 — the latest verdict has a stable path**
Tags: Q0006-runtime
- Given any round `N` completes
- When the verdict step finishes
- Then `review/verdict.md` is overwritten with round `N`'s content while `review/round-N/verdict.md` remains as the untouched audit-trail copy.

**AC-10 — the harness computes the diff**
Tags: Q0006-runtime
- Given a review run starts
- When the engine builds the reviewer prompt
- Then it embeds the full `git diff --stat` output plus the patch truncated at `repo.max_diff_bytes` (default 200000), and when truncation occurs it is stated explicitly in both the prompt and `runs.log`.

**AC-11 — correct diff range**
Tags: Q0006-runtime
- Given `repo.base_branch` resolves to `main` and the ticket's integration branch is `harness/<id>/integration`
- When the diff is computed
- Then the range used is `<base>...harness/<id>/integration` (three dots), never the inverted form.

**AC-12 — base branch is configured, not assumed**
Tags: Q0006-cli-lint, Q0006-runtime
- Given `harness.yaml` has no `repo.base_branch` key
- When `harness init` runs
- Then it falls back to `main`.
- Given instead `repo.base_branch` names a ref that does not exist
- When `harness run review <id>` executes
- Then it stops before any adapter is spawned, naming `repo.base_branch`, `harness/harness.yaml`, and the missing ref.

**AC-13 — regression is derived, never hard-coded**
Tags: Q0006-runtime
- Given `review.yaml`'s `on_fail` is `goto: flow:development`
- When a `changes-requested` verdict is accepted within budget
- Then the ticket's stage is set to `development.yaml`'s `consumes` value (`red`), read from that flow file at run time.
- Given the goto is instead edited to `flow:qa-red`
- When the same verdict is rejected
- Then the ticket lands on `solutioned` with no engine code change.

**AC-14 — the run stops there**
Tags: Q0006-runtime, Q0006-cli-lint
- Given a review run regresses the ticket
- When the run finishes
- Then it does not execute `review.yaml`'s closing gate and does not start `development.yaml`; the CLI output names the target flow, stage before → after, and remaining iterations.

**AC-15 — the counter is persisted and human-readable**
Tags: Q0006-runtime, Q0006-cli-lint
- Given `review.yaml` declares `counter: review`
- When a round completes as `changes-requested`
- Then `iterations.review` in `ticket.md` increments by exactly one, is written before the process exits, is read back correctly by the next invocation, and is visible in `harness board`.
- Given a flow instead declares `counter: iterations.review`
- When `harness lint` runs
- Then it fails, naming the corrected unprefixed spelling.

**AC-16 — the bound is exact**
Tags: Q0006-runtime, Q0006-cli-lint
- Given `review.yaml` sets `max_iterations: 3`
- When three consecutive `changes-requested` verdicts occur
- Then each regresses the ticket, and a fourth `changes-requested` verdict presents the exhaustion gate instead of a fourth regression.
- Given `max_iterations` is missing, `0`, negative, or non-integer
- When `harness lint` runs
- Then it fails, naming the step and the field.

**AC-17 — exhaustion lands on a gate `--auto` cannot walk through**
Tags: Q0006-runtime
- Given `iterations.review == max_iterations` and a further verdict is `changes-requested`
- When the run reaches the exhaustion point, including under `--auto`
- Then it presents a human gate naming the counter, current count, limit, outstanding blockers and the three answer options, the stage does not regress, and no development run starts.

**AC-18 — the three gate answers are not interchangeable**
Tags: Q0006-runtime
- Given the exhaustion gate is presented
- When answered `advance`
- Then the run accepts the current diff and proceeds toward `reviewed`.
- When instead answered `retry`
- Then `iterations.review` is persisted to exactly `max_iterations` (3), one further regression traversal is granted immediately, and the reset is logged in `runs.log`.
- When instead answered `abort`
- Then the run ends with the stage unchanged.

**AC-19 — a gate answer is never defaulted silently**
Tags: Q0006-cli-lint
- Given a non-interactive run reaches a gate with no `--gate-answer` value remaining and stdin is not a TTY (or the input is empty/invalid)
- When the gate is evaluated
- Then the run exits non-zero with an error naming the gate, rather than defaulting to `advance`.

**AC-20 — rework starts from the integration branch**
Tags: Q0006-runtime
- Given a ticket's task branches already exist from a prior development run
- When a new development run begins (triggered by a review regression)
- Then each task worktree merges `harness/<id>/integration` before its agent runs, warning (naming the task and paths) rather than failing silently on conflict; after review → development → review, the second run's worktrees contain the files the first run merged.

**AC-21 — developers see the verdict**
Tags: Q0006-runtime
- Given `review/verdict.md` exists from a prior round
- When `development.yaml`'s fan-out step runs
- Then `input.backlog` includes `review/verdict.md`.
- Given the file is instead absent (first pass)
- When the same step runs
- Then `readFiles` returns nothing and the existing `draft → green` smoke path is unaffected.

**AC-22 — every outcome is distinguishable on disk**
Tags: Q0006-runtime
- Given review runs that complete, regress, exhaust, are aborted, or fail
- When each is recorded
- Then `runs.log` and `ticket.md` history record run id, flow, stage before → after and cost distinctly per outcome, a failed/interrupted run is never recorded as completed, and `green → red → green → reviewed` is reconstructable from the ticket folder alone.

**AC-23 — invalid structured output stops the run cleanly**
Tags: Q0006-runtime
- Given an adapter returns output that fails validation (e.g. `approve` with findings, or a malformed `file:line` citation)
- When that step's output is processed
- Then the raw response is saved beside the ticket, the run stops naming the failed step and the saved file, and stage and `iterations.review` are unchanged.

**AC-24 — an asymmetric panel failure loses nothing and decides nothing**
Tags: Q0006-runtime
- Given one reviewer (e.g. codex) fails while the other (claude) succeeds
- When the panel step completes
- Then claude's artifact is retained, the verdict step does not run, and stage and counter are both unchanged.

**AC-25 — cross-flow targets resolve before anything runs**
Tags: Q0006-cli-lint
- Given `review.yaml`'s `goto` names a flow that is missing, fails to load, or whose `produces → consumes` chain never returns to review's own `consumes`
- When `harness lint` runs (and equivalently, `harness run`'s preflight)
- Then it fails before any ticket file is written or agent spawned, naming both flows and the stage where the chain dies.

**AC-26 — a single-vendor panel fails lint**
Tags: Q0006-cli-lint
- Given a `cross_vendor: required` flow whose parallel group has two steps sharing one role but the same adapter
- When `harness lint` runs
- Then it fails, naming the step ids and the shared adapter.
- Given instead the verdict step reads two artifacts written by different adapters
- When the same flow is linted
- Then that step is not flagged (the refined cross-vendor rule permits it for a judge).

**AC-27 — the mock suite covers the loop**
Tags: Q0006-mock-switch, Q0006-runtime, Q0006-cli-lint
- Given the spike's deterministic mock suite
- When it runs
- Then it exercises: `green → review → regressed` with `iterations.review = 1` and a complete, untouched round-1; a rework development run reaching `green` again; a second round writing `round-2` without touching `round-1`; `green → reviewed` on approval; an exhausted loop presenting a non-bypassable gate answered non-interactively; `abort` at exhaustion preserving stage; an invalid cross-flow target failing lint before execution; and invalid structured output leaving stage and counter unchanged.

**AC-28 — test determinism does not depend on call ordering**
Tags: Q0006-mock-switch
- Given the panel and verdict step share the `code-reviewer` role and hence the mock's per-role call counter
- When a test needs a specific panel or verdict outcome
- Then it is driven by an explicit switch (`MOCK_ALWAYS_FAIL` / `MOCK_ALWAYS_PASS`) applied only to the steps not under assertion, never inferred from call-count position.

**AC-29 — everything else stays green**
Tags: Q0006-mock-switch, Q0006-runtime, Q0006-cli-lint, Q0006-assets-docs
- Given the full spike suite after this ticket's changes
- When `npm test --prefix spike` runs
- Then the existing `draft → green` path, the API-key refusal tests, and the no-shipped-template-pins-a-codex-model assertion all still pass, and no new npm dependency was added.

**AC-30 — docs agree with the shipped flow**
Tags: Q0006-assets-docs
- Given the review flow as actually shipped
- When `docs/02-sdlc-pipeline-spec.md`, `docs/06-development-plan.md`, `docs/DECISIONS.md`, `docs/GLOSSARY.md` and `README.md` are inspected
- Then §3.4 shows the derived regression target, §5.5 matches the shipped mechanics (three-dot range, `{round}`, `counter: review`, no `judge`/`findings:`/`tasks:`/`with:`), §10 Q1 is answered, M1's done-when line covers `review.yaml`, DECISIONS.md carries entries for D1 and D5, GLOSSARY's **Gate** entry mentions exhaustion gates, and README documents `harness run review <id>` with no new setup step.

---

### Edge cases (from the architecture review and solution design, not separately numbered as ACs)

**EDGE-1 — retry persists exactly `max_iterations`, not `max_iterations - 1`**
Tags: Q0006-runtime
- Given `iterations.review` is at 3 (exhausted) and the gate is answered `retry`
- When the persisted counter is inspected immediately afterward
- Then it reads exactly `3`, the retry's own `goto` performs the single authorised regression, and the *next* `changes-requested` verdict increments the counter to `4` and re-presents exhaustion rather than granting a second regression. (Round 3 blocker B1 — the round-2 recommendation of `max_iterations - 1` would have granted two traversals.)

**EDGE-2 — schema clauses are executed without a validator dependency**
Tags: Q0006-runtime, Q0006-mock-switch
- Given `mockAdapter().run()` returns a structured verdict object
- When QA asserts directly against `review-artifacts.schema.json`'s individual clauses (required keys, permitted verdict enum, the `^(blocker|major|nit): .+:[1-9][0-9]* .+` finding format, approve-requires-zero-findings, changes-requested-requires-at-least-one-finding)
- Then every clause is checked via explicit, dependency-free assertions against both mock and real-vendor-shaped output, and no JSON Schema validator library is added. (Round 3 blocker B2.)

**EDGE-3 — mutually exclusive mock switches**
Tags: Q0006-mock-switch
- Given both `MOCK_ALWAYS_PASS` and `MOCK_ALWAYS_FAIL` are set
- When the mock adapter runs
- Then it rejects the configuration rather than silently preferring one switch.

**EDGE-4 — diff truncation lands on a byte/character boundary and always states itself**
Tags: Q0006-runtime
- Given a patch exceeds `repo.max_diff_bytes`
- When the engine truncates it
- Then the cut occurs at a UTF-8 character boundary (never mid-codepoint), the `--stat` block is always included in full regardless of truncation, and both the prompt and `runs.log` record that truncation occurred.

**EDGE-5 — `{base}` is substituted before ref validation and interpolation**
Tags: Q0006-runtime
- Given `repo.base_branch` resolves to a ref
- When the engine builds the diff range
- Then `{base}` is substituted before the ref-existence check and before the range is handed to Git, so a missing base never leaks into a literal `{base}...harness/<id>/integration` string.

**EDGE-6 — `harness init` branch discovery across Git states**
Tags: Q0006-cli-lint
- Given a repository with a checked-out branch, when `harness init` runs, then `repo.base_branch` is set to that branch name.
- Given a repository outside Git, or on an unidentifiable unborn branch, when `harness init` runs, then it keeps the template default `main` and still succeeds.

**EDGE-7 — repeatable `--gate-answer` values are consumed in encounter order**
Tags: Q0006-cli-lint
- Given `--gate-answer advance --gate-answer abort` is passed to a run that reaches the exhaustion gate first and the closing gate second
- When each gate is reached
- Then the exhaustion gate consumes `advance` and the closing gate consumes `abort`, in that order, with no cross-wiring.

**EDGE-8 — lint ambiguity is scoped to the checked return chain**
Tags: Q0006-cli-lint
- Given a stage is a legal target for multiple flows unrelated to review's own `goto` chain
- When `harness lint` validates `review.yaml`'s cross-flow target
- Then no ambiguity error is raised for those unrelated flows; ambiguity is reported only when a stage recurs along the chain being walked back to review's own `consumes`.

**EDGE-9 — preflight validates pristine flow files before the mock override applies**
Tags: Q0006-cli-lint
- Given `harness run review <id> --adapter mock` is invoked
- When the preflight executes
- Then it loads and validates flow files from disk exactly as `harness lint` would, before the in-memory `--adapter mock` substitution is applied — so a flow valid on disk is never rejected as an artifact of the mock override, and a genuinely single-vendor flow is never waved through by it either.

**EDGE-10 — an exhaustion `advance` leaves the counter loaded for the ticket's next visit to review**
Tags: Q0006-runtime
- Given the exhaustion gate was answered `advance` (count stays at 4)
- When the ticket later regresses back into review from a different flow (e.g. `qa-final`) and that round is rejected
- Then the exhaustion gate presents immediately, granting no further regression, because `iterations.review` is still `4` and was never reset.

**EDGE-11 — legacy ticket history remains readable without migration**
Tags: Q0006-runtime
- Given a `ticket.md` written before this ticket, containing only legacy `{stage, run, flow, at, cost}` history entries
- When `ticket-review-state.schema.json` validation runs against it
- Then it validates unchanged, with no rewrite required, and `harness board` renders it as before.

**EDGE-12 — exhaustion cost is recorded once, not twice**
Tags: Q0006-runtime
- Given a run presents the exhaustion gate and is later driven to a terminal outcome (advance/retry/abort)
- When history is inspected
- Then the exhaustion-presentation entry has `cost: 0` and unchanged `stage_before`/`stage_after`, exactly one later terminal entry carries the run's full measured cost, and `harness board`'s roll-up counts that cost once.

**EDGE-13 — frozen contracts are never touched by implementation**
Tags: Q0006-mock-switch, Q0006-runtime, Q0006-cli-lint, Q0006-assets-docs
- Given every task is forbidden from editing `contracts/Q-0006/**`
- When the integration branch is diffed against the contracts commit for that path
- Then `contracts/Q-0006/**` is byte-identical, and both JSON Schema files still parse successfully.

**EDGE-14 — backend allow-list agrees across architecture table, frontmatter and prose, and excludes contracts**
Tags: Q0006-assets-docs
- Given `harness/architecture.md`'s role table and the backend role's frontmatter and body all state the same allow-list
- When the three are compared
- Then they agree, `contracts/` is excluded from the allow-list, and the adopter starter template's backend role still names `services/api` / `packages/domain` rather than Quorum's own `spike/` layout. (Round 2 blocker B1.)

**EDGE-15 — panel steps carry no local instructions; guidance lives in the role and the verdict step respectively**
Tags: Q0006-runtime, Q0006-assets-docs
- Given `review.yaml`'s two panel steps define no step-local `instructions`
- When reviewer severity/citation/read-only guidance is checked
- Then it is found only in `harness/roles/code-reviewer.md`, while the verdict step's deduplication and severity-threshold behaviour is found only in that step's own literal `instructions` — each is validated against its own source, not the other's.

---

### Not flagged as untestable

Every criterion in the merged requirement was already resolved to a checkable behaviour by decisions
D1–D9, so none needed rejection here. The one deliberately non-automatable step is the closing-gate
maintainer action — running the first real `harness run review <id>` against live Claude/Codex CLIs
and saving ticket-local evidence of diff delivery and semantic severity behaviour — which the
requirement and solution both already scope as manual, outside development fan-out and outside the
deterministic regression suite. Open questions 1–5 in the requirement are explicitly non-blocking for
M1 and are not converted into scenarios here.
