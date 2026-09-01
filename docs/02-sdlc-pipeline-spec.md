# SDLC Pipeline Spec — seven stage-chained flows on Quorum, plus `chore`

*Status: draft v1, 2026-08-21; §3.4 amended 2026-08-24 (Q-0036) to state what a stage asserts, what it does not, and where containment is visible; §5.5 amended 2026-08-25 (Q-0035) with the `input.diff` rule, what an empty range reports, the boundary between preflighted and deferred ranges, and how a `fan_out` template's range is judged. 2026-08-25 docs review: §5.8 adds the chore flow and its prerequisite, §3.4 gains the chore edge, principle 2 no longer claims one flow per stage, `harness/T-{id}` branch refs corrected to `harness/{id}`, and two open questions closed. §3.3's `ticket.md` example corrected 2026-08-25 (Q-0041) to the `iterations` keys and eight-field `history` entries the engine actually writes. §5.5's two range paragraphs rewritten 2026-08-30 (Q-0038): the preflight's guarantee is per endpoint, not per range, so a deferred range's pre-existing endpoints are proven at run start and a knowably absent one costs nothing. §5.8 gained a paragraph 2026-08-30 (Q-0057): a chore review artifact is named by the run that wrote it — `review/chore/run-<run>/chore-iter-<iter>.md` — and a revise round reads its own run only. §5.8's run-scoping paragraph widened 2026-09-01 to both sides of the revise loop (Q-0086) and then to a rule covering every flow (Q-0087): a write path carries `{run}`, and one a bounded loop can re-enter within a run carries `{iter}` too, which moved the `integrate` artifacts in `chore.yaml`, `development.yaml` and `qa-red.yaml`; it also records that an `integrate` step's content is chosen by whether its path contains `report`; completed the same day (Q-0088) across `requirements.yaml`, `solutioning.yaml` and `qa-red.yaml`, which added the pointer half of the rule, rewrote §3.3's folder tree to the layout that results, and replaced §5.1–§5.5's hand-maintained snippets with the shipped files under a test that fails on any drift. §2 gained principle 8 on 2026-08-31 (Q-0062): a run gives back the worktrees it obtained when it finishes, keeps them when it does not, keeps a worktree that is not clean, and never deletes a ref. Extends the locked v1 definition (01-product-definition.md). New decisions it depends on are recorded in DECISIONS.md under the 2026-08-21 entries. Terms in GLOSSARY.md.*

## 1. Purpose

Quorum is product-agnostic: the same seven flows run on every repository, and a project's `harness/` context files (`product-context.md`, `architecture.md`, `rules.md`) are the only thing that makes output product-specific. Run a full software delivery lifecycle — requirements → solutioning → red tests → development → review → final QA → deploy — as a chain of small, independently runnable flows, each driven by multiple vendors' CLI agents on subscription OAuth, with the backlog stored as files in git instead of a ticketing tool. Different humans can own different stages; the backlog state is the only handoff mechanism.

## 2. Principles (the non-negotiables)

1. **Backlog is files in git.** No Jira, no database. A ticket is a folder; its stage is a frontmatter field. Every artifact a stage produces is a file in that folder, reviewable as a diff.
2. **Flows are chained by state.** A flow declares the stage it consumes and the stage it produces. Nothing else couples stages. Replace any stage's flow without touching the others. The seven SDLC flows map one-to-one onto the stages; `chore` (§5.8) does not — it consumes `requirements` and produces `reviewed`, skipping three stages — so more than one flow may consume a stage, and a flow may produce a stage later than the next one.
3. **Writer ≠ reviewer vendor.** Whatever writes an artifact is reviewed or judged by a different vendor. Enforced by a lint on flow files, not by convention.
4. **Loops are bounded.** Every backward edge has `max_iterations`; exhausting it always lands on a human gate.
5. **Contracts before tests.** Solutioning must emit machine-checkable contracts (interfaces, schemas, stubs) so the red phase can produce tests that compile and fail for the right reason.
6. **Deploy is always human-gated.** It is the one gate that cannot be flipped to `auto`.
7. **Everything else already holds:** BYOS OAuth, worktree per writing step, human gates by default, canonical harness compiled to vendor dialects.
8. **A run cleans up after itself, and never after anyone else.** A run that finished removes the worktrees it obtained — the writing steps' and the integration one's — and keeps any worktree holding uncommitted content, naming the paths that kept it. A run that did **not** finish removes nothing, so a failed run's worktree is still there to be opened, and neither does a dry run, which obtains none. **No ref is deleted at any point**: the branches outlive their worktrees, which is what makes the removal reversible and what a post-hoc review reads. A worktree an earlier run or a person left behind belongs to nobody's run and is removed by nothing; `harness/<id>/*` branches likewise accumulate until someone deletes them by hand. See *"A run removes the worktrees it made, and never the refs"* (2026-08-31).

## 3. Backlog schema

### 3.1 Location

Two supported layouts, chosen per project in `harness/harness.yaml`:

```yaml
backlog:
  layout: in-repo          # backlog/ folder inside the target repo (default)
  # layout: central        # separate repo; tickets reference target repos
  path: backlog
```

`central` is for multi-repo organisations: one backlog repo, each ticket names its `repos:`. Flows that write code clone/worktree the referenced repo(s).

### 3.2 Ticket folder

```
backlog/
  T-0012-subscription-downgrade/
    ticket.md            # frontmatter = state; body = one-paragraph intent
    requirements/
      merged.md          # POINTER: the current requirement, read by four later flows
      run-1/
        candidate-claude.md
        candidate-codex.md
        merged-iter-1.md # the Head-of-Product judge, one file per traversal
        merged-iter-2.md
    solution/
      solution.md        # POINTER: read by qa-red, development and review
      tasks.yaml         # POINTER: development's fan_out reads it by literal name
      contracts/         # interfaces, OpenAPI/JSON schemas, type stubs, migration skeletons
      run-2/
        draft-iter-1.md  # written by Codex, one per traversal of the review loop
        review-iter-1.md # Claude's review of it
        solution.md      # the run's own copy of what the pointer names
        tasks.yaml
        integration.md
    qa/
      run-3/
        scenarios-iter-1.md      # Gherkin-ish scenarios
        scenario-review-iter-1.md
        red-report-iter-1.md     # proof that the suite fails before development
        red-integration-iter-1.md
    dev/
      chore/run-4/
        implement-iter-1.md      # the implementer's report, one per revise round
        integration.md
      development/run-5/
        integration-iter-1.md    # the integrator's merge notes
        green-report-iter-1.md   # test output on the integrated branch
    review/
      verdict.md         # POINTER: development's fan-out reads it by literal name
      round-1/claude.md
      round-1/codex.md
      round-1/verdict.md
      round-2/...
    runs.log             # append-only: run id, flow, stage before/after, cost
```

**Two shapes appear above, and the difference is which run reads the file.** An artifact its own
flow reads is named by the run that wrote it — and by the iteration too, where a bounded loop can
rewrite it — so nothing a run produces is destroyed by the next round or the next run. An artifact a
**later** flow reads cannot be, because `{run}` interpolates to the *reading* run's id and a
consumer two runs later would glob an empty directory; those four are written twice, as a per-run
copy for history and a flat **pointer** at the stable name the consumer knows. `review/verdict.md`
has been that pattern since the review flow shipped; §5.8 states the rule and
`packages/shared/src/flow.test.ts` enforces it over the shipped files.

Tests themselves are **not** stored in the backlog: they are committed to the target repo on the ticket branch (`harness/T-0012/tests`, beside the integration branch `harness/T-0012/integration`) so the developers' worktrees inherit them.

### 3.3 `ticket.md` frontmatter

```yaml
---
id: T-0012
title: Subscription downgrade mid-cycle
stage: solutioned          # see state machine
owner: ruud                # human who owns the *current* stage
repos: [my-saas-api]       # only meaningful for central layout
branch: harness/T-0012/integration   # ticket integration branch (git refs: a branch cannot be both a ref and a directory, so step branches sit beside it)
priority: p1
created: 2026-08-21
iterations:                # loop counters, created on first use — never a fixed set of keys
  solutioning.architecture-review: 2   # <flow>.<step>, computed when a step names no counter
  review: 1                            # a bare key, from a step's explicit on_fail.counter
history:
  - {stage: requirements, run: 41, flow: requirements, status: completed,
     stage_before: draft, stage_after: requirements, at: 2026-08-21T09:12:00.000Z, cost: 0.84}
  - {stage: solutioned,   run: 42, flow: solutioning,  status: completed,
     stage_before: requirements, stage_after: solutioned, at: 2026-08-21T10:40:00.000Z, cost: 1.92}
---
Clinics can downgrade their plan mid-cycle. Define what happens to active
subscriptions, proration and the patient-facing side.
```

Two fields here are not what an earlier draft of this document showed, and the difference matters
to anything that reads a ticket.

**`iterations` has no fixed set of keys.** A counter is created the first time a loop traverses,
and its name is either the `<flow>.<step>` pair the engine computes or the unprefixed key a step's
`on_fail.counter` declares — the flow lint rejects a key that carries an `iterations.` prefix. A
ticket that has looped nowhere has `iterations: {}`.

**A `history` entry carries eight fields, not four.** `stage`, `run`, `flow`, `status`,
`stage_before`, `stage_after`, `at` and `cost`, where `cost` may be null for a vendor that reports
no price, and `stage` duplicates `stage_after`. Entries written before `status` existed are shorter
and are still valid; nothing rewrites them. `status` is one of `completed`, `regressed`, `aborted`,
`failed`, `interrupted` or `exhausted` — and note that only `completed` and `regressed` move the
stage, so a ticket's history legitimately contains entries whose `stage_before` equals its
`stage_after`.

### 3.4 State machine

```
                ┌───────────────────────────────────────────────┐  (chore: machinery/config work, §5.8)
                │                                               ▼
draft ──▶ requirements ──▶ solutioned ──▶ red ──▶ green ──▶ reviewed ──▶ qa-passed ──▶ deployed
                                         └─────────────────┘ (review fail: rejection targets development's `red`, ≤3)
                               ▲                               │
                               └────────────────────────────────┘ (qa: dev issue, ≤2)
                    ▲                                          │
                    └──────────────────────────────────────────┘ (qa: design issue, ≤1)
```

Plus `blocked` (human parked it) and `abandoned` from any stage. A flow may only start on a ticket whose `stage` equals the flow's `consumes`. Quorum's backlog board is a kanban over this field.

A stage is the ticket's position in this state machine, and only that. `green` means the ticket's integration branch integrated and passed its configured suite; it says nothing about where that code now is. No stage — `green` or any later one — implies the ticket's branch is contained in the configured base branch, because containment is a fact about two refs at the moment of reading and either ref can move after any transition. It is therefore never stored in `ticket.md`. `harness board` derives it from git on every invocation and shows it beside each ticket whose `branch` resolves to a local ref, as one token naming the configured base literally: `main:contained`, `main:not-contained(+12)`, or `main:indeterminate(missing ref)` / `main:indeterminate(shallow clone)` / `main:indeterminate(git failed)` when git could not answer — which is never reported as either of the other two states.

### 3.5 `tasks.yaml` (output of solutioning)

```yaml
tasks:
  - id: T-0012.1
    role: backend
    title: Proration service + downgrade endpoint
    contracts: [contracts/billing.openapi.yaml, contracts/ProrationService.ts]
    depends_on: []
  - id: T-0012.2
    role: data
    title: "Migration: subscription_changes table"
    contracts: [contracts/migrations/0042_subscription_changes.sql]
    depends_on: []
  - id: T-0012.3
    role: frontend
    title: Downgrade confirmation flow in clinic dashboard
    contracts: [contracts/billing.openapi.yaml]
    depends_on: [T-0012.1]
```

`role` selects which developer profile (prompt + model + allowed paths) picks up the task. Roles are defined per project in `harness/roles/*.md`.

## 4. Flow engine additions (beyond locked v1)

| Addition | Why |
|---|---|
| `consumes` / `produces` on a flow | Stage chaining; Quorum can list "runnable now" tickets per flow |
| `backlog` step input type | Steps receive ticket files as context without ad-hoc prompting |
| `write` step output → backlog path | Declarative persistence of artifacts |
| `on_fail: goto` + `max_iterations` + `on_exhausted: gate` | Bounded loops |
| `fan_out: tasks.yaml by role` | Dynamic parallelism: N tasks → N worktrees |
| `integrate` step | Merge N task branches onto the ticket branch, run tests |
| `cross_vendor: required` lint | Writer/reviewer vendor separation |
| `gate: human-locked` | Gate that cannot be set to auto (deploy) |

Everything else reuses v1 primitives: `adapter`, `model`, `worktree: true`, `parallel`, `judge`, `gate`.

## 5. The seven flows, plus `chore`

All examples use `claude` and `codex` adapters. Model names are placeholders — set them per project.

**§5.1 to §5.5 are the shipped files themselves, byte for byte**, and
`packages/shared/src/docs.test.ts` fails if any of them drifts by a character. They were
hand-maintained until 2026-09-01 and had drifted in both of the ways a transcription does: they
showed flat write paths that tickets had since moved, and they named a `harness:` input the shipped
files never carried. A transcription of code drifts *silently*, because it goes on looking like the
thing it describes — which is why the fix is a check rather than a correction. §5.8's `chore.yaml`
is described in prose rather than printed, and is checked by `flow.test.ts` instead.

**§5.6 and §5.7 are sketches, not files.** `qa-final.yaml` and `deploy.yaml` are Q-0012's and do not
exist yet, so those blocks are design rather than record; the same test registers them by name, so a
new block in §5 fails until someone says which of the two it is, and a sketch whose flow later
acquires a file fails until it moves. Q-0056 owns the separate fact that §5.6's sketch does not pass
the real `lintFlow`.

### 5.1 `requirements.yaml` — PM×2 + Head of Product

```yaml
name: requirements
consumes: draft
produces: requirements
cross_vendor: required
steps:
  - parallel:
    - id: pm-claude
      role: product-manager
      adapter: claude
      model: opus
      input: { backlog: [ticket.md], harness: [rules.md, product-context.md] }
      output: { write: "requirements/run-{run}/candidate-claude.md" }
    - id: pm-codex
      role: product-manager
      adapter: codex
      input: { backlog: [ticket.md], harness: [rules.md, product-context.md] }
      output: { write: "requirements/run-{run}/candidate-codex.md" }

  - id: head-of-product
    role: head-of-product
    adapter: claude
    model: opus
    input: { backlog: [ticket.md, "requirements/run-{run}/candidate-*.md", requirements/merged.md, ".harness/run-{run}/head-of-product-verdict-iter-*.json"] }
    output: { writes: ["requirements/run-{run}/merged-iter-{iter}.md", requirements/merged.md], verdict: ready|needs-input }
    instructions: >
      Judge both candidate requirement documents for completeness, testability and
      scope discipline. Produce ONE merged requirement: user story, acceptance criteria
      (numbered, each independently testable), non-goals, open questions, and a short
      "provenance" section noting which candidate contributed what. Verdict "ready" when
      no open question blocks solutioning; otherwise "needs-input" with the blocking
      questions as findings.
    on_fail: { goto: head-of-product, max_iterations: 1, on_exhausted: gate }

  - gate: human
    reason: PM owner approves requirements/merged.md
```

Optional: make `pm-*` interactive (step chat) so the PM can answer clarifying questions — this is the existing grill pattern.

### 5.2 `solutioning.yaml` — Architect writes (Codex), Claude reviews

```yaml
name: solutioning
consumes: requirements
produces: solutioned
cross_vendor: required
steps:
  - id: architect
    role: principal-architect
    adapter: codex
    worktree: true
    branch: "harness/{id}/contracts"
    input: { backlog: [requirements/merged.md, "solution/run-{run}/review-iter-*.md"], harness: [architecture.md, rules.md], repo: true }
    output: { writes: ["solution/run-{run}/draft-iter-{iter}.md"] }
    instructions: >
      Produce the solution document for this requirement. It MUST contain: (1) chosen
      approach and rejected alternatives, (2) a "Contracts" section listing every
      interface, schema, stub or migration skeleton you created as files under
      contracts/ in the repository worktree, (3) a "Tasks" section as a YAML block with
      id, role (frontend|backend|data), title, contracts, depends_on — every task
      references at least one contract. If a solution/review.md input is present, this
      is a revision round: address every finding explicitly.

  - id: architecture-review
    role: architecture-reviewer
    adapter: claude
    model: opus
    input: { backlog: [requirements/merged.md, "solution/run-{run}/draft-iter-*.md"], harness: [architecture.md, rules.md], repo: true }
    output: { writes: ["solution/run-{run}/review-iter-{iter}.md"], verdict: approve|revise }
    instructions: >
      Review the solution against the requirement and the architecture rules. Check that
      every acceptance criterion maps to a task, every task references a contract, and
      contracts are concrete enough to write failing tests against. "approve" only if you
      would let QA start writing tests today.
    on_fail: { goto: architect, max_iterations: 2, on_exhausted: gate }

  - id: finalize
    role: principal-architect
    adapter: codex
    input: { backlog: ["solution/run-{run}/draft-iter-*.md", "solution/run-{run}/review-iter-*.md"] }
    output: { writes: ["solution/run-{run}/solution.md", solution/solution.md] }
    instructions: Produce the final solution document, incorporating the review. Keep the Contracts and Tasks sections verbatim unless the review changed them.

  - id: tasks
    role: principal-architect
    adapter: codex
    input: { backlog: ["solution/run-{run}/solution.md"] }
    output: { writes: ["solution/run-{run}/tasks.yaml", solution/tasks.yaml] }
    instructions: >
      Extract the Tasks section of the solution as a YAML document with exactly this shape
      and nothing else: tasks: [{id, role, title, description, contracts: [paths], depends_on: [ids]}].
      Put the YAML in "document" without code fences.

  - gate: human
    reason: Architect owner approves solution/solution.md and solution/tasks.yaml

  - id: merge-contracts
    type: integrate
    branches: ["harness/{id}/contracts"]
    into: "harness/{id}/integration"
    output: { writes: ["solution/run-{run}/integration.md"] }
```

### 5.3 `qa-red.yaml` — Automation QA writes failing tests

```yaml
name: qa-red
consumes: solutioned
produces: red
cross_vendor: required
steps:
  - id: scenarios
    role: automation-qa
    adapter: claude
    model: sonnet
    input: { backlog: [requirements/merged.md, solution/solution.md, solution/errata.md, solution/tasks.yaml, "qa/run-{run}/scenario-review-iter-*.md"] }
    output: { writes: ["qa/run-{run}/scenarios-iter-{iter}.md"] }
    instructions: >
      Write the test scenarios for this ticket: one Given/When/Then scenario per acceptance
      criterion, plus edge cases the architecture reviewer or the solution call out. Tag
      each scenario with the task id(s) it covers.

  - id: write-tests
    role: automation-qa
    adapter: codex
    worktree: true
    branch: "harness/{id}/tests"
    base: "harness/{id}/integration"
    input: { backlog: ["qa/run-{run}/scenarios-iter-*.md", solution/tasks.yaml, solution/errata.md, "qa/run-{run}/scenario-review-iter-*.md", "qa/run-{run}/red-report-iter-*.md"], harness: [architecture.md], repo: true }
    instructions: >
      Implement automated tests for every scenario against the contracts under contracts/.
      Tests must compile/typecheck against the stubs and FAIL on assertions, not on missing
      symbols. Do not implement production code. Summarise which files you created.

  - id: prove-red
    type: integrate
    branches: ["harness/{id}/tests"]
    into: "harness/{id}/integration"
    run_tests: true
    expect: fail
    output: { writes: ["qa/run-{run}/red-integration-iter-{iter}.md", "qa/run-{run}/red-report-iter-{iter}.md"] }
    on_fail: { goto: write-tests, max_iterations: 2, on_exhausted: gate }

  - id: scenario-review
    role: architecture-reviewer
    adapter: claude
    model: opus
    input: { backlog: [requirements/merged.md, "qa/run-{run}/scenarios-iter-*.md", "qa/run-{run}/red-report-iter-*.md"] }
    output: { writes: ["qa/run-{run}/scenario-review-iter-{iter}.md"], verdict: approve|revise }
    instructions: >
      Check coverage: every acceptance criterion has at least one scenario and the red
      report shows the suite failing on assertions (not compile errors). "revise" lists the
      uncovered criteria or the compile failures.
    on_fail: { goto: scenarios, max_iterations: 1, on_exhausted: gate }

  - gate: human
    reason: QA owner approves the failing suite
```

### 5.4 `development.yaml` — Specialised developers fan out, integrate to green

```yaml
name: development
consumes: red
produces: green
steps:
  - id: developers
    fan_out: { from: solution/tasks.yaml, by: role, respect: depends_on, scope: failing-tasks-only }
    step:
      id: "dev:{task.id}"
      role: "developer-{role}"
      adapter: "{role.adapter}"
      model: "{role.model}"
      branch: "harness/{id}/{task.id}"
      base: "harness/{id}/integration"
      input: { backlog: [solution/solution.md, review/verdict.md], harness: [rules.md, architecture.md], repo: true }
      instructions: >
        Implement ONLY your task so that the tests covering it pass. Do not modify tests.
        Do not touch files outside your role's allowed paths. Commit nothing — the harness
        commits your worktree. If a contract is missing or contradictory, stop and say so
        in the summary instead of guessing.

  - id: integrate
    type: integrate
    branches: "harness/{id}/*"
    into: "harness/{id}/integration"
    run_tests: true
    expect: pass
    output: { writes: ["dev/development/run-{run}/integration-iter-{iter}.md", "dev/development/run-{run}/green-report-iter-{iter}.md"] }
    on_fail: { goto: developers, max_iterations: 3, on_exhausted: gate }

  - gate: human
    reason: Integrated branch is green; approve to hand over to review
```

Roles example `harness/roles/developer-frontend.md` frontmatter: `adapter: claude, paths: [apps/web/**]`; `developer-backend.md`: `adapter: codex, paths: [apps/api/**]`. Mixing vendors across roles is how you get genuine multi-model development without pinning model names that may not be available through an adopter's subscription.

### 5.5 `review.yaml` — Claude + Codex panel, loops to development

```yaml
name: review
consumes: green
produces: reviewed
cross_vendor: required
steps:
  - parallel:
      - id: review-claude
        role: code-reviewer
        adapter: claude
        input:
          backlog: [requirements/merged.md, solution/solution.md]
          diff: "{base}...harness/{id}/integration"
        output: {writes: ["review/round-{round}/claude.md"]}
      - id: review-codex
        role: code-reviewer
        adapter: codex
        input:
          backlog: [requirements/merged.md, solution/solution.md]
          diff: "{base}...harness/{id}/integration"
        output: {writes: ["review/round-{round}/codex.md"]}

  - id: verdict
    role: code-reviewer
    adapter: claude
    input:
      backlog:
        - "review/round-{round}/claude.md"
        - "review/round-{round}/codex.md"
        - requirements/merged.md
        - solution/solution.md
    output:
      writes: ["review/round-{round}/verdict.md", review/verdict.md]
      verdict: approve|changes-requested
    instructions: >
      Deduplicate the panel findings. Preserve file:line references and group surviving
      findings as blocker, major, or nit. Approve exactly when no blocker or major
      survives; nits alone approve, and a nit you have is reported rather than dropped. On
      approve every finding must be a nit; on changes-requested there must be at least one
      finding. Judge the reviews, not the code diff.
    on_fail:
      goto: flow:development
      counter: review
      max_iterations: 3
      on_exhausted: gate

  - gate: human
    reason: Review verdict is approve; accept or abort handover to final QA
```

`{base}` resolves from `repo.base_branch` in `harness/harness.yaml` and defaults to `main` when omitted. The engine materialises the three-dot diff from that configured base to `harness/{id}/integration` and truncates its patch at `repo.max_diff_bytes`, whose default is `200000` bytes. When the fourth rejection exceeds the three permitted regressions, the engine presents an exhaustion gate without changing the stage. That gate requires an explicit `advance`, `retry`, or `abort`; `--auto` cannot bypass it.

An `input.diff` must name exactly two endpoints joined by `...`, each of which is `{base}` or a branch under `harness/{id}/`. `harness lint` enforces that as written, before a run starts and without consulting git, so a malformed or out-of-class range never costs anything. The rule applies wherever a flow file puts an `input.diff`, including inside a `fan_out` step's `step:` template, whose range reaches the engine exactly like any other once the fan-out expands it. The engine enforces the same rule again on the interpolated range, and a range that resolves but shows nothing stops the run: an empty diff is never a reviewable state, and the failure names both endpoints with the short SHA each resolved to, the containment check it ran, and that check's outcome — `contained`, `not contained` or `indeterminate`. It reports only the ancestry git returned and never how that state arose, because an ancestry check cannot distinguish a merge from a cherry-pick, a rebase or a branch that never moved.

The unit judged is the endpoint, not the range, because a ref is what can be absent. A range whose endpoints both already exist when the run starts is materialised by a **run-level preflight before the first step**, so no adapter is ever billed against evidence that turns out to be missing or empty — this is `review.yaml`'s case, and it is why M1's $5.02 review of a diff that did not exist cannot recur. An endpoint an *earlier step of the same flow creates* — the right endpoint of `chore.yaml`'s `harness/{id}/integration...harness/{id}/implement` — cannot be checked that early, because the evidence does not exist until its producer has run and been billed, so a range holding one is materialised at step time instead. Its pre-existing endpoints are nevertheless resolved at run start, where they cost nothing: a left endpoint naming an integration branch nobody has created stops the run before the implementer is spawned, and the message names the branch, says which endpoint it is, and states that the other one is not created until its producing step runs rather than reporting a branch nothing has produced yet as one that failed to resolve. What the deferred endpoint alone can prove is still the earliest guarantee available: the producing adapter may run, the consuming adapter may not, and the failure additionally names the step that was expected to create the endpoint — whichever endpoint turned out to be bad — so the reader learns the implementer committed nothing rather than that a branch is missing. A `--dry` run over a deferred range shows a placeholder instead of demanding branches only a paid run produces, and refuses exactly what a real run refuses.

The preflight reads a `fan_out` step's `step:` template as a diff site like any other, so a template range over pre-existing refs is judged once, before the fan-out is billed, and every task in the wave then receives the same bytes rather than re-resolving the range one at a time. The exception is a template endpoint naming a per-task variable, such as `harness/{id}/{task.id}`: it has no single value until `tasks.yaml` is expanded, so it carries the same earliest-possible guarantee a deferred endpoint does, with its shape still checked for free by `harness lint` — while a pre-existing endpoint beside it is resolved at run start like any other. Only a template may be left unresolved that way; an ordinary step's uninterpolated endpoint fails on the ref it names.

### 5.6 `qa-final.yaml` — Final QA decides dev / solution / pass

```yaml
name: qa-final
consumes: reviewed
produces: qa-passed
steps:
  - id: run-suite
    type: script
    run: "npm test && npm run e2e"
    output: { write: qa/final-report.md }
  - id: exploratory
    role: automation-qa
    adapter: codex
    worktree: true
    input: { backlog: [requirements/merged.md, qa/scenarios.md], repo: true }
    instructions: >
      Attempt to break the feature beyond the existing suite. Classify every
      failure as IMPLEMENTATION (code wrong vs. solution) or DESIGN (solution
      wrong vs. requirement). Add a failing test for each implementation finding.
    output: { append: qa/final-report.md, verdict: pass|dev|solution }
  - id: second-opinion
    adapter: claude
    input: { backlog: [qa/final-report.md, requirements/merged.md, solution/solution.md] }
    output: { verdict: confirm|override, append: qa/final-report.md }
  - route:
      pass:     { produce: qa-passed }
      dev:      { goto: flow:development, counter: iterations.qa, max_iterations: 2, on_exhausted: gate }
      solution: { goto: flow:solutioning, counter: iterations.qa, max_iterations: 1, on_exhausted: gate }
  - gate: human
cross_vendor: required
```

### 5.7 `deploy.yaml` — human-locked

```yaml
name: deploy
consumes: qa-passed
produces: deployed
steps:
  - id: release-notes
    adapter: claude
    input: { backlog: [requirements/merged.md, solution/solution.md], diff: "{base}...harness/{id}/integration" }
    output: { write: deploy/release-notes.md }
  - id: open-pr
    type: script
    run: "gh pr create --base main --head harness/{id}/integration --body-file backlog/{id}/deploy/release-notes.md"
  - gate: human-locked     # merge + deploy decision; cannot be auto
  - id: deploy
    type: script
    run: "./scripts/deploy.sh"
```

### 5.8 `chore.yaml` — the short route for machinery and configuration work

Consumes `requirements`, produces `reviewed`. One `implement` step in a worktree on
`harness/<id>/implement`, then a `review` step on the other vendor over
`harness/<id>/integration...harness/<id>/implement` with `on_fail: goto implement,
max_iterations: 2`, then `type: integrate` onto the ticket branch with `run_tests: true` and
`expect: pass`, then a human gate. `cross_vendor: required` and every gate are kept; what is
dropped is solutioning's contracts and qa-red's failing suite, because work that changes what
the repository *is* has no behaviour a test could fail on before it exists. The reasoning is in
the DECISIONS entry of 2026-08-24; the shipped file is `harness/flows/chore.yaml`.

**Every artifact a run can rewrite is named by what makes it unique.** The rule is two sentences
and covers every write path in every shipped flow. *A write path carries `{run}` — or `{round}`,
review's own per-run counter — and one a bounded loop can re-enter within a run additionally carries
`{iter}`. A path that carries neither must be a **pointer**: the step writing it must write a scoped
copy in the same breath.* `{run}` alone lets iteration 2 overwrite iteration 1; `{iter}` alone lets
run 2 overwrite run 1, since it restarts at 1 in each run, which is why it can never name a path by
itself. Whether a step is loop-reachable is a property of the flow's own `on_fail` edges —
everything from a `goto` target through the edge that names it — so `chore.yaml`'s `integrate`,
which sits after its loop, is named by the run alone and is not an exception to the rule but a
consequence of it.

**The pointer half exists because `{run}` is the *reading* run's id.** An artifact its own flow
reads can be globbed inside `run-{run}/`, because writer and reader are the same run. An artifact a
**later flow** reads cannot: by the time `development.yaml` looks for `solution/tasks.yaml`, `{run}`
has moved on, and a glob over `run-*` would sort `run-10` before `run-2` and return every run's copy
where a fan-out needs exactly one file. So exactly four artifacts are written twice — a per-run copy
for history and a flat name their consumer reads as a literal: `requirements/merged.md`,
`solution/solution.md`, `solution/tasks.yaml` and `review/verdict.md`. The last has been that shape
since the review flow shipped, which is where the pattern comes from.
`packages/shared/src/flow.test.ts` derives all of it from each shipped flow rather than listing
paths, and pins those four by identity so adding a fifth is a visible act.

**A caution for anyone renaming one of these.** Both engines choose an `integrate` step's *content*
by whether its write path contains the substring `report` — the captured test output if it does,
the integration notes if it does not (`spike/src/engine.js:1241`,
`packages/core/src/engine/composite.ts:340`). A rename across that boundary silently swaps what the
file holds, and the same test pins the class each shipped path selects.

**In the chore flow specifically:**
The review step writes `review/chore/run-<run>/chore-iter-<iter>.md` and the implement step reads
`review/chore/run-<run>/chore-iter-*.md`; the implement step writes
`dev/chore/run-<run>/implement-iter-<iter>.md` and the review step reads
`dev/chore/run-<run>/implement-iter-*.md`. So each side of the loop is fed its own run's artifacts
and no others, sees every earlier round of that run rather than only the last, and every earlier
run's stay on disk under their own directory. The rule is the **pair** of variables and not either
one: `{run}` alone lets iteration 2 overwrite iteration 1, and `{iter}` alone lets run 2 overwrite
run 1. The implement report was flat until Q-0037 — Q-0057 scoped the review path and left the
report beside it — so a revision round's report replaced the previous round's, and the measured
evidence a criterion had been verified with stopped existing while the run reported green. That is
the same defect on the other side of the same loop, found by a reviewer that could not check four
criteria and could not say why from the artifact it was given. `{run}` is the
run's id: the number `runs.log` carries as `run=N` and `.quorum/runs/<id>-N/` is named after.
`{iter}` still counts backward edges inside one run and still restarts at 1 in each run, which is
why it cannot name a path on its own — until Q-0057 it did, and a second run of the flow on a
ticket overwrote the first run's reviews and fed the surviving mixture back to the implementer. A
finding that must outlive the run it was made in belongs in `requirements/errata.md`, which the
implement step reads on every run. Artifacts written before their path was scoped keep their flat
names — `review/chore-iter-<iter>.md` before Q-0057, `dev/implement-report.md` before Q-0037;
nothing moves them and no glob reads them.

**Prerequisite, and a known gap.** `review` diffs against `harness/<id>/integration` and
`implement` bases its worktree on it, but `integrate` — the only step that creates that branch —
runs after both. On a ticket's first pass the branch therefore does not exist, and the run fails
at `review` *after* the implementer has been billed. Q-0008 and Q-0036 only passed because the
branch had been created from the base by hand beforehand. Until this is fixed, create
`harness/<id>/integration` before the first chore run on a ticket; `harness lint` should refuse a
flow that diffs a branch no earlier step creates. Found by Q-0035 at a cost of $13.86; carried in
Q-0038.

## 6. Roles (agent personas) — `harness/roles/`

One markdown file per role: frontmatter sets default `adapter`, `model`, `paths` (write allow-list), `tools`; body is the persona prompt. Flows reference roles by name; a flow step can override adapter/model. The harness compiler emits these into vendor dialects the same way it does `rules.md` (for Claude, a role can additionally map to a native subagent in the pass-through section).

Initial set: `product-manager`, `head-of-product`, `principal-architect`, `architecture-reviewer`, `automation-qa`, `developer-frontend`, `developer-backend`, `developer-data`, `integrator`, `code-reviewer`, `release-manager`.

## 7. Multi-repo and reuse

The seven flows and the roles live in Quorum's template library. `harness init --template sdlc` copies them into a project's `harness/flows/` and `harness/roles/`. Projects diverge by editing their copy; a `harness template diff` shows drift from the library. For organisations with many repos, the `central` backlog layout plus a shared `harness-org/` repo (referenced via git submodule or `harness.yaml: extends: ../harness-org`) keeps roles and rules common while each repo keeps its own `architecture.md`.

## 8. Interfaces (new Quorum screens)

- **Backlog board** — kanban over `stage`, per ticket: owner, iteration counters, cost to date **per vendor** (never one blended figure — see the Codex-pricing decision), "Run next flow" button (enabled only when a flow `consumes` that stage).
- **Ticket page** — the folder rendered as tabs (requirements, solution, QA, dev, review) with diff-between-versions and the runs.log timeline.
- **Requirement merge view** — candidate-claude / candidate-codex / merged side by side with the Head-of-Product reasoning.
- **Contracts & tasks view** — tasks.yaml as a table with role badges and dependency arrows, each task linking to its contract files and its branch.
- **Red/green matrix** — scenarios × status across red-report, green-report, final-report.
- **Review loop view** — rounds as columns, findings deduped by the verdict, which ones were fixed in which dev iteration.
- Existing: mission control (fan-out columns now N wide), gate screen, step chat, run history.

## 9. Cost and iteration guardrails

Per-flow and per-ticket budget in `harness.yaml` (`budget: { per_run_usd: 10, per_ticket_usd: 60 }`) — **specified, not implemented**: the keys exist and nothing reads them. The intent is that an exceeded budget behaves like an exhausted loop and stops at a human gate. Token/cost roll-ups already exist per run and per vendor; add per ticket and per stage.

## 10. Open questions

1. M1 ships no lighter `fix` flow. A review rejection targets the full `development` flow, whose declared `consumes: red` stage is the derived regression target.
2. ~~Script steps are on the v1 roadmap but `qa-red`, `qa-final` and `deploy` need them.~~ **Resolved 2026-08-21:** `type: script` moved into v1; see "Deploy gate is human-locked; script steps pulled into v1".
3. Does the `central` backlog layout make the cold-clone test worse? Default stays `in-repo`; `central` is opt-in.
4. ~~Codex CLI's headless output is less structured than Claude Code's stream-json; the `findings: true` / `verdict:` outputs assume the adapter can extract a trailing JSON block.~~ **Resolved:** the structured-tail convention is specced in 03-adapter-contract.md, and M0 found the fallback never fires in practice.

## 11. Minimal proof path

Day 1: backlog schema + `requirements.yaml` only (two PMs, one judge, one gate). Day 2: `solutioning.yaml` with the review loop. Day 3: `qa-red` + `development` with a two-role fan-out and integrate step. If the integrate step works on a real repo, the rest is composition.
