# Q-0006 — Review flow with cross-flow backward edge: Test Scenarios

*Written by automation-qa against `requirements/merged.md` and `solution/solution.md`. One Given/When/Then
scenario per acceptance criterion (AC1–AC30), followed by edge cases the architecture reviewer or the
solution called out that are not fully captured by a single AC. Each scenario is tagged with the task
id(s) whose implementation it exercises. Scenarios assume `--adapter mock` unless a scenario is explicitly
about real-vendor-shaped output.*

## How to read this

- **Tasks** lists the `tasks.yaml` id(s) whose contract(s) the scenario exercises, per the ownership map in
  `solution.md` (`Q0006-mock-switch`, `Q0006-runtime`, `Q0006-cli-lint`, `Q0006-assets-docs`).
- Scenarios use the mock adapter's deterministic switches (`MOCK_ALWAYS_PASS`, `MOCK_ALWAYS_FAIL`) only on
  the step(s) each scenario is about, per D2/AC-28 — never relying on call-order determinism.
- A scenario written against a real-vendor-shaped payload (AC-23) is a fixture, not a live CLI call —
  Q-0006 explicitly excludes automated real-CLI evidence (see the closing note).

---

## The flow and the panel (AC1–AC9)

### SC-01 — `review.yaml` exists and lints (AC-1)
**Tasks:** Q0006-assets-docs, Q0006-cli-lint
- **Given** `harness/flows/review.yaml` declares `name: review`, `consumes: green`, `produces: reviewed`,
  `cross_vendor: required`, and a byte-identical copy exists at `spike/templates/harness/flows/review.yaml`
- **When** `harness lint` runs and `diff -rq harness/flows spike/templates/harness/flows` is run
- **Then** lint reports `review.yaml` valid with no errors, and the diff command returns no output

### SC-02 — the `code-reviewer` role exists (AC-2)
**Tasks:** Q0006-assets-docs
- **Given** `harness/roles/code-reviewer.md` and its byte-identical copy at
  `spike/templates/harness/roles/code-reviewer.md` define a persona that reads a diff against a requirement
  and a solution, classifies findings as blocker/major/nit, quotes `file:line`, and never rewrites code, and
  pins no codex model name
- **When** `diff -rq harness/roles spike/templates/harness/roles` runs and the existing
  `spike/test/smoke.js:128` "no shipped template pins a codex model name" assertion runs with
  `code-reviewer.md` included in its scan
- **Then** the two role files are byte-identical and the smoke assertion still passes

### SC-03 — the flow uses only engine-supported step fields (AC-3)
**Tasks:** Q0006-assets-docs, Q0006-runtime
- **Given** `review.yaml` is parsed by the engine
- **When** the parsed flow is inspected
- **Then** it contains no `type: judge` step, no `input: { findings: [...] }`, no
  `output: { findings: true, tasks: true }`, and no `on_fail.with:`
- **And when** `harness run review <ticket> --adapter mock` executes on a `green` ticket
- **Then** the run completes end to end using only step types/fields the engine already implements before
  this ticket (`step`, `parallel`, `gate`, `goto`)

### SC-04 — the panel is two reviewers on two vendors (AC-4)
**Tasks:** Q0006-runtime, Q0006-assets-docs
- **Given** a ticket at stage `green` and a review run where `{round}` resolves to `1`
- **When** the panel's `parallel` group runs
- **Then** one step runs with `adapter: claude` and the other with `adapter: codex`
- **And** `backlog/<ticket>/review/round-1/claude.md` and `backlog/<ticket>/review/round-1/codex.md` are both
  written

### SC-05 — reviewers are read-only (AC-5)
**Tasks:** Q0006-runtime
- **Given** neither panel step declares `worktree`
- **When** the panel runs
- **Then** both steps execute with `allowWrite: false`
- **And after** the run, `git status --porcelain` shows no change outside `backlog/`, `git worktree list`
  gained nothing, and no branch was created

### SC-06 — one verdict step judges the panel (AC-6)
**Tasks:** Q0006-runtime
- **Given** `review/round-1/claude.md`, `review/round-1/codex.md`, `requirements/merged.md`, and
  `solution/solution.md` exist
- **When** the verdict step runs
- **Then** it reads exactly those four named files (never the diff), writes `review/round-1/verdict.md`, and
  emits `verdict: approve` or `verdict: changes-requested`
- **And** when `verdict` is `changes-requested`, `findings` is non-empty; when `approve`, `findings` is empty

### SC-07 — severity threshold is testable (AC-7)
**Tasks:** Q0006-runtime, Q0006-mock-switch
- **Given** a round whose two reviews contain only `nit` findings
- **When** the verdict step evaluates them
- **Then** the verdict is `approve`
- **Given** a round where at least one review contains a `blocker` or `major` finding
- **When** the verdict step evaluates them
- **Then** the verdict is `changes-requested`

### SC-08 — rounds never overwrite each other (AC-8)
**Tasks:** Q0006-runtime
- **Given** round 1 completed with an `approve` verdict, and a later `qa-final` regression returns the
  ticket to `green`
- **When** a second review run starts
- **Then** `{round}` is computed as `2` (highest `N` with an existing `review/round-N/verdict.md`, plus one),
  `review/round-1/verdict.md` is untouched, and `review/round-2/verdict.md` is newly written with different
  content
- **Given** a review run fails before writing `review/round-2/verdict.md`
- **When** the run is retried
- **Then** it reuses round `2` rather than advancing to round `3`

### SC-09 — the latest verdict has a stable path (AC-9)
**Tasks:** Q0006-runtime
- **Given** `review/round-1/verdict.md` recorded `changes-requested`
- **When** round 2 completes with `approve`
- **Then** `review/verdict.md` now contains round 2's content, overwriting round 1's copy

---

## The diff the reviewers actually see (AC10–AC12)

### SC-10 — the harness computes the diff (AC-10)
**Tasks:** Q0006-runtime
- **Given** a ticket branch `harness/<id>/integration` diverged from the configured base
- **When** the panel step's prompt is built
- **Then** it contains the full `git diff --stat` output and the patch for the three-dot range, truncated in
  UTF-8 bytes at `repo.max_diff_bytes`
- **And** when truncation occurs, the prompt states it explicitly and `runs.log` records the truncation

### SC-11 — correct diff range (AC-11)
**Tasks:** Q0006-runtime
- **Given** `base_branch` is `main` and the ticket's integration branch is `harness/Q-0099/integration`
- **When** the diff is materialised
- **Then** the range used is `main...harness/Q-0099/integration` (three dots), never
  `harness/Q-0099/integration..main`

### SC-12 — base branch is configured, not assumed (AC-12)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** `harness.yaml` has no `repo.base_branch` key
- **When** a review run resolves the base ref
- **Then** it falls back to `main`
- **Given** `harness.yaml` sets `repo.base_branch: trunk` but ref `trunk` does not exist in the repository
- **When** `harness run review <ticket>` executes
- **Then** the run stops before any adapter is spawned, with a message naming `repo.base_branch`,
  `harness/harness.yaml`, and the missing ref `trunk`

---

## The backward edge (AC13–AC19)

### SC-13 — regression is derived, never hard-coded (AC-13)
**Tasks:** Q0006-runtime
- **Given** `review.yaml`'s `on_fail` is `goto: flow:development` and `development.yaml` declares
  `consumes: red`
- **When** a `changes-requested` verdict is reached within budget
- **Then** the ticket's stage is set to `red` (development's `consumes`), never a literal hard-coded value
- **Given** `review.yaml`'s goto target is changed to `flow:qa-red` (which declares `consumes: solutioned`),
  with no other file changed
- **When** the same scenario runs
- **Then** the ticket regresses to `solutioned` instead of `red`

### SC-14 — the run stops there (AC-14)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** a `changes-requested` verdict within budget
- **When** the review run regresses the ticket
- **Then** the run does not execute `review.yaml`'s closing gate and does not start the `development` flow
- **And** the CLI output reports the target flow name, stage before → after, and remaining iterations

### SC-15 — the counter is persisted and human-readable (AC-15)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** `review.yaml` sets `counter: review`
- **When** a review round completes and regresses
- **Then** `ticket.md`'s `iterations.review` increments by exactly 1, is flushed to disk before the process
  exits, and is read back correctly by the next `harness` invocation
- **And** `harness board` displays `iterations.review` for the ticket
- **Given** a flow declares `counter: iterations.review`
- **When** `harness lint` runs
- **Then** lint rejects it and suggests the corrected spelling `review`

### SC-16 — the bound is exact (AC-16)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** `max_iterations: 3` on `review.yaml`'s `on_fail`
- **When** three consecutive review rounds each return `changes-requested`
- **Then** each of the first three regresses the ticket, incrementing `iterations.review` to 1, 2, 3
  respectively
- **And** the fourth `changes-requested` verdict does not regress; it presents the exhaustion gate instead
- **Given** a flow step omits `max_iterations`, or sets it to `0`, `"abc"`, or `-1`
- **When** `harness lint` runs
- **Then** lint fails for each invalid form, naming the step id and the `max_iterations` field

### SC-17 — exhaustion lands on a gate `--auto` cannot walk through (AC-17)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** `iterations.review` has reached `max_iterations` (3) and a fourth `changes-requested` verdict
  arrives
- **When** the run reaches the exhaustion gate, including under `harness run review <ticket> --auto`
- **Then** `--auto` does not advance past it; the gate's reason names the counter (`review`), the current
  count and limit (`3/3`), the outstanding blockers, and the three available options
  (`advance`/`retry`/`abort`)

### SC-18 — the three gate answers are not interchangeable (AC-18)
**Tasks:** Q0006-runtime
- **Given** the exhaustion gate is presented
- **When** answered `advance`
- **Then** the current diff is accepted and the ticket proceeds toward `reviewed`
- **When** instead answered `retry`
- **Then** exactly one more traversal is authorised, and only `iterations.review` is reset — `iterations.qa`
  and any other counter are untouched
- **When** instead answered `abort`
- **Then** the run ends with the ticket's stage unchanged

### SC-19 — a gate answer is never defaulted silently (AC-19)
**Tasks:** Q0006-cli-lint
- **Given** a non-interactive run (no TTY) reaches a human gate
- **When** no `--gate-answer` is supplied and stdin is empty
- **Then** the run exits non-zero with an error naming the gate, and never defaults to `advance`

---

## Making the round trip actually work (AC20–AC21)

### SC-20 — rework starts from the integration branch (AC-20)
**Tasks:** Q0006-runtime
- **Given** a ticket's task branches already exist from a prior development run
- **When** a new development run begins (triggered by a review regression)
- **Then** each task's worktree merges `harness/<id>/integration` before its agent runs
- **And** when that merge conflicts, a warning names the task and the conflicting paths — never silent
- **Given** the sequence review → development → review runs twice
- **Then** the second development run's task worktrees contain the files the first run merged

### SC-21 — developers see the verdict (AC-21)
**Tasks:** Q0006-runtime
- **Given** `development.yaml`'s fan-out step lists `review/verdict.md` in `input.backlog`
- **When** a first-pass development run executes with no prior `review/verdict.md` on disk
- **Then** `readFiles` returns nothing for that path, and the existing `draft → green` smoke path stays green
  unchanged
- **Given** a rework run executes after a review regression, with `review/verdict.md` present
- **When** the fan-out step's prompt is built
- **Then** it includes the verdict file's content

---

## Audit and failure containment (AC22–AC24)

### SC-22 — every outcome is distinguishable on disk (AC-22)
**Tasks:** Q0006-runtime
- **Given** five separate review runs end respectively as `completed`, `regressed`, `exhausted`, `aborted`,
  and `failed`
- **When** `runs.log` and `ticket.md` history are inspected
- **Then** each entry records run id, flow, stage before → after, and cost, and the five outcomes are
  distinguishable from one another
- **And** a failed or interrupted run is never recorded as `completed`
- **And** the sequence `green → red → green → reviewed` is reconstructable solely from the ticket folder

### SC-23 — invalid structured output stops the run cleanly (AC-23)
**Tasks:** Q0006-runtime
- **Given** a reviewer or verdict step returns structured output that fails validation (e.g. an `approve`
  verdict carrying findings, or a malformed `file:line` citation), including real-Claude/Codex-shaped
  payloads
- **When** the run processes that output
- **Then** the raw response is saved beside the ticket under `.harness/`, the run stops with a message
  naming the failed step and the saved file path, the ticket's stage neither advances nor regresses, and
  `iterations.review` does not change

### SC-24 — an asymmetric panel failure loses nothing and decides nothing (AC-24)
**Tasks:** Q0006-runtime
- **Given** the claude panel step succeeds and the codex panel step fails (or vice versa)
- **When** the panel's parallel group settles
- **Then** the surviving reviewer's artifact (e.g. `round-N/claude.md`) is kept on disk, the verdict step
  does not run, the ticket's stage is unchanged, and `iterations.review` is not incremented

---

## Lint (AC25–AC26)

### SC-25 — cross-flow targets resolve before anything runs (AC-25)
**Tasks:** Q0006-cli-lint
- **Given** `review.yaml`'s `on_fail` targets `goto: flow:nonexistent`
- **When** `harness lint` runs
- **Then** lint fails, naming `review` as the source flow and `nonexistent` as the missing target
- **Given** a chain of `goto` targets whose `produces`/`consumes` never leads back to `review`'s `consumes`
  stage
- **When** `harness lint` runs
- **Then** lint fails, naming both flows and the stage where the chain dies
- **And** in both cases resolution happens at lint time — before any agent is spawned or any ticket file is
  written

### SC-26 — a single-vendor panel fails lint (AC-26)
**Tasks:** Q0006-cli-lint
- **Given** a `cross_vendor: required` flow has a `parallel` group of two `code-reviewer` steps that both
  set `adapter: claude`
- **When** `harness lint` runs
- **Then** lint fails, naming both step ids and the shared adapter `claude`
- **Given** `review.yaml`'s own verdict step reads inputs written by two different adapters (`claude` and
  `codex`)
- **When** `harness lint` runs
- **Then** the cross-vendor rule for that judge step continues to pass

---

## Regression suite (AC27–AC29)

### SC-27 — the mock suite covers the loop (AC-27)
**Tasks:** Q0006-runtime, Q0006-mock-switch, Q0006-cli-lint
- **Given** the mock adapter is configured deterministically
- **When** the regression suite runs
- **Then** it exercises: `green → review → regressed` (derived stage, `iterations.review = 1`, complete
  `review/round-1/`, untouched working tree); a rework `development` run reaching `green` again; a second
  review round writing `review/round-2/` without touching round 1; `green → reviewed` on approval; an
  exhausted loop presenting a gate `--auto` does not bypass, answered non-interactively; `abort` at
  exhaustion preserving the stage; an invalid cross-flow target failing lint before execution; and invalid
  structured output changing neither stage nor counter

### SC-28 — test determinism does not depend on call ordering (AC-28)
**Tasks:** Q0006-mock-switch
- **Given** the mock adapter keys its call counter by role, and both the panel and verdict step share the
  `code-reviewer` role
- **When** a test needs a specific reviewer or verdict outcome
- **Then** it drives that outcome with an explicit switch (`MOCK_ALWAYS_FAIL` or the new
  `MOCK_ALWAYS_PASS`), applied only to the step(s) the assertion is about — never by relying on call order

### SC-29 — everything else stays green (AC-29)
**Tasks:** Q0006-mock-switch, Q0006-runtime, Q0006-cli-lint, Q0006-assets-docs
- **Given** the full spike test suite after this ticket's changes
- **When** `npm test --prefix spike` runs
- **Then** it passes, including the existing `draft → green` path, the API-key refusal tests, the
  `adapters --probe` JSON report tests, and the "no shipped template pins a codex model name" assertion
- **And** no new npm dependency was added

---

## Documentation (AC30)

### SC-30 — docs agree with the shipped flow (AC-30)
**Tasks:** Q0006-assets-docs
- **Given** the implementation ships `review.yaml` as specified
- **When** `docs/02-sdlc-pipeline-spec.md`, `docs/06-development-plan.md`, `docs/DECISIONS.md`, and
  `docs/GLOSSARY.md` are reviewed
- **Then** §3.4's state diagram shows the derived regression target, §5.5 reflects the three-dot diff range,
  `{round}`, `counter: review`, and the absence of `judge`/`findings:`/`tasks:`/`with:`, §10 Q1 is answered,
  the M1 done-when line in `06-development-plan.md` is updated, `DECISIONS.md` carries one entry for the
  derived-regression rule (D1) and one for the exhaustion gate vs. `--auto` (D5), `GLOSSARY.md`'s **Gate**
  entry gains a sentence about exhaustion gates, and `README.md` documents `harness run review <id>` with no
  new setup step

---

## Edge cases (architecture review + solution, not covered by a single AC)

### SC-31 — retry persists the limit value, not limit-minus-one (round 3 blocker B1)
**Tasks:** Q0006-runtime
- **Given** `iterations.review` has reached exhaustion at count 3 with `max_iterations: 3`
- **When** the exhaustion gate is answered `retry`
- **Then** `iterations.review` is persisted as exactly `3` (the `max_iterations` value, not `2`), the reset
  is logged in `runs.log`, and the gate-triggered regression happens immediately as the one authorised
  traversal
- **Given** the next review round after that retry also returns `changes-requested`
- **Then** `iterations.review` increments to `4` and the exhaustion gate is presented again — not a fresh
  three-round budget

### SC-32 — an exhaustion `advance` retains count 4 and does not reset the budget (N4)
**Tasks:** Q0006-runtime
- **Given** the exhaustion gate at count 4 is answered `advance`
- **When** the run completes
- **Then** `iterations.review` remains at `4` and the run proceeds toward `reviewed`
- **Given** a later flow (e.g. `qa-final`) regresses the same ticket to a stage that re-enters `review`, and
  its first verdict is `changes-requested`
- **Then** the exhaustion gate is presented immediately, without granting a fresh budget

### SC-33 — `{base}` is populated before ref validation and interpolation (N5)
**Tasks:** Q0006-runtime
- **Given** `repo.base_branch` resolves to a valid ref
- **When** the engine builds the diff range string
- **Then** `{base}` is substituted with the resolved ref value before the range is validated against git and
  before any other template interpolation occurs, so an unresolved base can never leak into git as the
  literal string `{base}...harness/<id>/integration`

### SC-34 — run preflight loads pristine flow files before adapter overrides (N1)
**Tasks:** Q0006-cli-lint, Q0006-runtime
- **Given** a flow directory that would fail lint in its on-disk form
- **When** `harness run review <ticket> --adapter mock` starts
- **Then** the same complete flow-directory validation as `harness lint` runs first, against the pristine
  files on disk, before any `--adapter mock` override is applied — so a flow invalid on disk cannot be made
  to look valid by a runtime override, and the run is rejected before any ticket write or adapter call

### SC-35 — `harness init` branch discovery (round 2 major M4)
**Tasks:** Q0006-cli-lint
- **Given** a git repository whose current branch is `release-2.0`
- **When** `harness init` runs
- **Then** `harness.yaml`'s `repo.base_branch` is written as `release-2.0`
- **Given** a directory that is not a git repository
- **When** `harness init` runs
- **Then** it keeps the template default `main` and succeeds
- **Given** a git repository on an unborn branch (no commits yet, HEAD unidentifiable)
- **When** `harness init` runs
- **Then** it keeps `main` and succeeds

### SC-36 — contracts stay frozen through development (round 2 major M5)
**Tasks:** Q0006-mock-switch, Q0006-runtime, Q0006-cli-lint, Q0006-assets-docs
- **Given** all four development tasks have merged into the integration branch
- **When** `contracts/Q-0006/**` on the integration branch is compared to the contracts commit
- **Then** the two are byte-identical — no development task modified a contract file

### SC-37 — repeatable `--gate-answer` values consumed in encounter order (round 2 major M3)
**Tasks:** Q0006-cli-lint
- **Given** a single invocation will hit the exhaustion gate followed by the ordinary closing gate
- **When** invoked as `harness run review <ticket> --gate-answer advance --gate-answer abort`
- **Then** the exhaustion gate consumes `advance` and the closing gate consumes `abort`, in that order

### SC-38 — legacy ticket history remains valid without migration (round 1 blocker B4)
**Tasks:** Q0006-runtime, Q0006-cli-lint
- **Given** an existing `ticket.md` whose history entries use the legacy `{stage, run, flow, at, cost}` shape
- **When** the ticket is loaded and validated against `ticket-review-state.schema.json`'s relevant clauses
- **Then** the legacy entries remain valid, are not rewritten, and the ticket loads and runs normally
  alongside new review-outcome entries

### SC-39 — zero-cost exhaustion entry plus one full-cost terminal entry (round 2 major M2)
**Tasks:** Q0006-runtime
- **Given** a review run reaches exhaustion and is later answered (`advance` or `abort`)
- **When** ticket history is inspected
- **Then** the exhaustion-presentation entry has `stage_before === stage_after` and `cost: 0`, and the run's
  terminal entry carries the full measured cost exactly once, so `harness board` does not double-count it

### SC-40 — both JSON Schema contracts parse (round 3 blocker B2 / Verification)
**Tasks:** Q0006-runtime
- **Given** `contracts/Q-0006/review-artifacts.schema.json` and
  `contracts/Q-0006/ticket-review-state.schema.json`
- **When** they are loaded with a JSON parser
- **Then** both parse without error, independent of whether a validator library enforces their clauses

### SC-41 — mock switch mutual exclusion and schema-valid mock findings
**Tasks:** Q0006-mock-switch
- **Given** both `MOCK_ALWAYS_PASS` and `MOCK_ALWAYS_FAIL` are set for the same run
- **When** the mock adapter initialises
- **Then** it rejects the configuration with an explicit error rather than silently preferring one
- **Given** `MOCK_ALWAYS_FAIL` (or the default fallback) drives a `changes-requested` verdict
- **Then** the emitted findings match the schema's `severity: file:line description` format, e.g.
  `major: src/mock.ts:1 (mock) placeholder finding`

### SC-42 — backend role allow-list includes repository-root Markdown (round 3 major M1)
**Tasks:** Q0006-assets-docs
- **Given** `harness/architecture.md`'s role table and the Quorum backend role's frontmatter and body
- **When** they are inspected after the docs task lands
- **Then** both list repository-root Markdown files including `README.md` as writable by the backend role,
  and frontmatter and body agree with each other

---

## Flagged as untestable by automation (round 3 major M2 / QA-red responsibilities)

**AC "do the real CLIs obtain a diff themselves under plan/read-only sandbox" (open question 3) and any
semantic judgment of reviewer quality.** No Given/When/Then scenario is written for these. The solution is
explicit that real-CLI evidence is a manual acceptance action taken by the maintainer at the closing human
gate after the four implementation tasks merge — it depends on paid vendor CLIs, is non-deterministic, and
must not run inside development fan-out or the deterministic regression suite. Writing an automated scenario
for it would either fake determinism the real CLIs don't have, or silently consume the user's subscription
inside a test run — both violate BYOS test isolation. This is recorded as a documentation/process step
(SC-30, SC-42) rather than as a test.
</document>
</invoke>
