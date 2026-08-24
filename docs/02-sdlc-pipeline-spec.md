# SDLC Pipeline Spec — seven stage-chained flows on Quorum

*Status: draft v1, 2026-08-21; §3.4 amended 2026-08-24 (Q-0036) to state what a stage asserts, what it does not, and where containment is visible; §5.5 amended 2026-08-25 (Q-0035) with the `input.diff` rule, what an empty range reports, and the boundary between preflighted and deferred ranges. Extends the locked v1 definition (01-product-definition.md). New decisions it depends on are recorded in DECISIONS.md under the 2026-08-21 entries. Terms in GLOSSARY.md.*

## 1. Purpose

Quorum is product-agnostic: the same seven flows run on every repository, and a project's `harness/` context files (`product-context.md`, `architecture.md`, `rules.md`) are the only thing that makes output product-specific. Run a full software delivery lifecycle — requirements → solutioning → red tests → development → review → final QA → deploy — as a chain of small, independently runnable flows, each driven by multiple vendors' CLI agents on subscription OAuth, with the backlog stored as files in git instead of a ticketing tool. Different humans can own different stages; the backlog state is the only handoff mechanism.

## 2. Principles (the non-negotiables)

1. **Backlog is files in git.** No Jira, no database. A ticket is a folder; its stage is a frontmatter field. Every artifact a stage produces is a file in that folder, reviewable as a diff.
2. **One flow per stage, chained by state.** A flow declares the stage it consumes and the stage it produces. Nothing else couples stages. Replace any stage's flow without touching the others.
3. **Writer ≠ reviewer vendor.** Whatever writes an artifact is reviewed or judged by a different vendor. Enforced by a lint on flow files, not by convention.
4. **Loops are bounded.** Every backward edge has `max_iterations`; exhausting it always lands on a human gate.
5. **Contracts before tests.** Solutioning must emit machine-checkable contracts (interfaces, schemas, stubs) so the red phase can produce tests that compile and fail for the right reason.
6. **Deploy is always human-gated.** It is the one gate that cannot be flipped to `auto`.
7. **Everything else already holds:** BYOS OAuth, worktree per writing step, human gates by default, canonical harness compiled to vendor dialects.

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
      candidate-claude.md
      candidate-codex.md
      merged.md          # output of the Head-of-Product judge → the requirement
    solution/
      draft.md           # written by Codex
      review.md          # Claude's review
      solution.md        # final, after review applied
      contracts/         # interfaces, OpenAPI/JSON schemas, type stubs, migration skeletons
      tasks.yaml         # work breakdown with role tags
    qa/
      scenarios.md       # Gherkin-ish scenarios
      red-report.md      # proof that the suite fails before development
      final-report.md    # final QA verdict
    dev/
      integration.md     # integration agent's merge notes
      green-report.md    # test output on integrated branch
    review/
      round-1/claude.md
      round-1/codex.md
      round-1/verdict.md
      round-2/...
    runs.log             # append-only: run id, flow, stage before/after, cost
```

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
iterations:
  review: 0                # review↔dev loop counter
  qa: 0                    # final-qa → dev/solution loop counter
history:
  - {stage: requirements, run: 41, at: 2026-08-21T09:12Z, cost: 0.84}
  - {stage: solutioned,   run: 42, at: 2026-08-21T10:40Z, cost: 1.92}
---
Clinics can downgrade their plan mid-cycle. Define what happens to active
subscriptions, proration and the patient-facing side.
```

### 3.4 State machine

```
draft ──▶ requirements ──▶ solutioned ──▶ red ──▶ green ──▶ reviewed ──▶ qa-passed ──▶ deployed
                                         └─────────────────┘ (review fail: rejection targets development's `red`, ≤3)
                               ▲                               │
                               └────────────────────────────────┘ (qa: dev issue, ≤2)
                    ▲                                          │
                    └──────────────────────────────────────────┘ (qa: design issue, ≤1)
```

Plus `blocked` (human parked it) and `abandoned` from any stage. A flow may only start on a ticket whose `stage` equals the flow's `consumes`. The Studio's backlog board is a kanban over this field.

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
| `consumes` / `produces` on a flow | Stage chaining; the Studio can list "runnable now" tickets per flow |
| `backlog` step input type | Steps receive ticket files as context without ad-hoc prompting |
| `write` step output → backlog path | Declarative persistence of artifacts |
| `on_fail: goto` + `max_iterations` + `on_exhausted: gate` | Bounded loops |
| `fan_out: tasks.yaml by role` | Dynamic parallelism: N tasks → N worktrees |
| `integrate` step | Merge N task branches onto the ticket branch, run tests |
| `cross_vendor: required` lint | Writer/reviewer vendor separation |
| `gate: human-locked` | Gate that cannot be set to auto (deploy) |

Everything else reuses v1 primitives: `adapter`, `model`, `worktree: true`, `parallel`, `judge`, `gate`.

## 5. The seven flows

All examples use `claude` and `codex` adapters. Model names are placeholders — set them per project.

### 5.1 `requirements.yaml` — PM×2 + Head of Product

```yaml
name: requirements
consumes: draft
produces: requirements
steps:
  - parallel:
    - id: pm-claude
      role: product-manager
      adapter: claude
      input: { backlog: [ticket.md], harness: [rules.md, architecture.md, product-context.md] }
      output: { write: requirements/candidate-claude.md }
    - id: pm-codex
      role: product-manager
      adapter: codex
      input: { backlog: [ticket.md], harness: [rules.md, architecture.md, product-context.md] }
      output: { write: requirements/candidate-codex.md }

  - id: head-of-product
    role: head-of-product
    adapter: claude
    input: { backlog: [ticket.md, requirements/candidate-*.md] }
    output: { write: requirements/merged.md }
    instructions: >
      Judge both candidates for completeness, testability and scope discipline.
      Produce one merged requirement with acceptance criteria, non-goals and
      open questions. Note which candidate contributed what.
  - gate: human        # PM owner approves the merged requirement
```

Optional: make `pm-*` interactive (step chat) so the PM can answer clarifying questions — this is the existing grill pattern.

### 5.2 `solutioning.yaml` — Architect writes (Codex), Claude reviews

```yaml
name: solutioning
consumes: requirements
produces: solutioned
steps:
  - id: architect
    role: principal-architect
    adapter: codex
    worktree: true                       # may read the repo, may write contracts/
    input: { backlog: [requirements/merged.md], harness: [architecture.md, rules.md], repo: true }
    output:
      writes: [solution/draft.md, solution/tasks.yaml]
      write_dir: solution/contracts/
    instructions: >
      Produce a solution document, machine-checkable contracts (interfaces,
      schemas, stubs, migration skeletons) and a task breakdown tagged by role.
      Every task must reference at least one contract.
  - id: architecture-review
    role: architecture-reviewer
    adapter: claude
    input: { backlog: [requirements/merged.md, solution/draft.md, solution/contracts/, solution/tasks.yaml], repo: true }
    output: { write: solution/review.md, verdict: approve|revise }
    on_fail: { goto: architect, max_iterations: 2, on_exhausted: gate }
  - id: finalize
    adapter: codex
    input: { backlog: [solution/draft.md, solution/review.md] }
    output: { write: solution/solution.md }
  - gate: human        # architect owner approves; contracts are committed to the ticket branch
cross_vendor: required
```

### 5.3 `qa-red.yaml` — Automation QA writes failing tests

```yaml
name: qa-red
consumes: solutioned
produces: red
steps:
  - id: scenarios
    role: automation-qa
    adapter: claude
    input: { backlog: [requirements/merged.md, solution/solution.md, solution/contracts/] }
    output: { write: qa/scenarios.md }
  - id: write-tests
    role: automation-qa
    adapter: codex
    worktree: true
    branch: "harness/T-{id}/tests"
    input: { backlog: [qa/scenarios.md, solution/contracts/], repo: true }
    instructions: >
      Write the automated tests for every scenario against the contracts. Tests
      must compile/typecheck against the stubs and FAIL on assertions, not on
      missing symbols. Do not implement any production code.
  - id: prove-red
    type: script                       # v1 roadmap item, needed here
    run: "npm test -- --reporter=json > ../backlog/T-{id}/qa/red-report.json"
    assert: "all tests fail, zero compile errors"
    on_fail: { goto: write-tests, max_iterations: 2, on_exhausted: gate }
  - id: scenario-review
    adapter: claude
    input: { backlog: [requirements/merged.md, qa/scenarios.md], branch: "harness/T-{id}/tests" }
    output: { verdict: approve|revise }
    on_fail: { goto: scenarios, max_iterations: 1, on_exhausted: gate }
  - gate: human        # QA owner approves; tests branch merged into ticket branch
cross_vendor: required
```

### 5.4 `development.yaml` — Specialised developers fan out, integrate to green

```yaml
name: development
consumes: red
produces: green
steps:
  - id: developers
    fan_out: { from: solution/tasks.yaml, by: role, respect: depends_on }
    step:
      role: "developer-{role}"           # harness/roles/developer-backend.md etc.
      adapter: "{role.adapter}"           # per-role adapter from harness/roles
      worktree: true
      branch: "harness/T-{id}/{task.id}"
      base: "harness/T-{id}/integration"              # includes contracts + red tests
      input: { backlog: [solution/solution.md, "solution/contracts/"], task: true, repo: true }
      instructions: >
        Implement only your task. Make the tests that cover your task pass.
        Do not modify tests. Do not touch files outside your role's allowed paths.
  - id: integrate
    type: integrate
    adapter: claude
    branches: "harness/T-{id}/*"
    into: "harness/T-{id}/integration"
    run_tests: true
    output: { writes: [dev/integration.md, dev/green-report.md] }
    on_fail:                              # conflicts or still-red tests
      goto: developers
      scope: failing-tasks-only
      max_iterations: 3
      on_exhausted: gate
  - gate: human        # optional in practice; flip to auto once trusted
```

Roles example `harness/roles/developer-frontend.md` frontmatter: `adapter: claude, paths: [apps/web/**]`; `developer-backend.md`: `adapter: codex, paths: [apps/api/**]`. Mixing vendors across roles is how you get genuine multi-model development without pinning model names that may not be available through an adopter's subscription.

### 5.5 `review.yaml` — Claude + Codex panel, loops to development

```yaml
name: review
consumes: green
produces: reviewed
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
      survives; nits alone approve. Findings must be empty on approve and non-empty on
      changes-requested. Judge the reviews, not the code diff.
    on_fail:
      goto: flow:development              # cross-flow backward edge
      counter: review
      max_iterations: 3
      on_exhausted: gate
  - gate: human
    reason: Review verdict is approve; accept or abort handover to final QA
cross_vendor: required
```

`{base}` resolves from `repo.base_branch` in `harness/harness.yaml` and defaults to `main` when omitted. The engine materialises the three-dot diff from that configured base to `harness/{id}/integration` and truncates its patch at `repo.max_diff_bytes`, whose default is `200000` bytes. When the fourth rejection exceeds the three permitted regressions, the engine presents an exhaustion gate without changing the stage. That gate requires an explicit `advance`, `retry`, or `abort`; `--auto` cannot bypass it.

An `input.diff` must name exactly two endpoints joined by `...`, each of which is `{base}` or a branch under `harness/{id}/`. `harness lint` enforces that as written, before a run starts and without consulting git, so a malformed or out-of-class range never costs anything. The engine enforces the same rule again on the interpolated range, and a range that resolves but shows nothing stops the run: an empty diff is never a reviewable state, and the failure names both endpoints with the short SHA each resolved to, the containment check it ran, and that check's outcome — `contained`, `not contained` or `indeterminate`. It reports only the ancestry git returned and never how that state arose, because an ancestry check cannot distinguish a merge from a cherry-pick, a rebase or a branch that never moved.

Ranges divide into two classes, and only one of them can be checked for free. A range over refs that already exist when the run starts is materialised by a **run-level preflight before the first step**, so no adapter is ever billed against evidence that turns out to be missing or empty — this is `review.yaml`'s case, and it is why M1's $5.02 review of a diff that did not exist cannot recur. A range whose endpoint an *earlier step of the same flow creates* — `chore.yaml`'s `harness/{id}/integration...harness/{id}/implement` — cannot be checked that early, because the evidence does not exist until its producer has run and been billed. Those ranges are deferred to step time, where the guarantee is the earliest one available: the producing adapter may run, the consuming adapter may not, and the failure additionally names the step that was expected to create the endpoint, so the reader learns the implementer committed nothing rather than that a branch is missing. A `--dry` preview of a deferred range shows a placeholder instead, since a preview must not demand branches only a paid run produces.

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
    input: { backlog: [requirements/merged.md, solution/solution.md], diff: "harness/T-{id}..main" }
    output: { write: deploy/release-notes.md }
  - id: open-pr
    type: script
    run: "gh pr create --base main --head harness/T-{id} --body-file backlog/T-{id}/deploy/release-notes.md"
  - gate: human-locked     # merge + deploy decision; cannot be auto
  - id: deploy
    type: script
    run: "./scripts/deploy.sh"
```

## 6. Roles (agent personas) — `harness/roles/`

One markdown file per role: frontmatter sets default `adapter`, `model`, `paths` (write allow-list), `tools`; body is the persona prompt. Flows reference roles by name; a flow step can override adapter/model. The harness compiler emits these into vendor dialects the same way it does `rules.md` (for Claude, a role can additionally map to a native subagent in the pass-through section).

Initial set: `product-manager`, `head-of-product`, `principal-architect`, `architecture-reviewer`, `automation-qa`, `developer-frontend`, `developer-backend`, `developer-data`, `integrator`, `code-reviewer`, `release-manager`.

## 7. Multi-repo and reuse

The seven flows and the roles live in the Studio's template library. `harness init --template sdlc` copies them into a project's `harness/flows/` and `harness/roles/`. Projects diverge by editing their copy; a `harness template diff` shows drift from the library. For organisations with many repos, the `central` backlog layout plus a shared `harness-org/` repo (referenced via git submodule or `harness.yaml: extends: ../harness-org`) keeps roles and rules common while each repo keeps its own `architecture.md`.

## 8. Interfaces (new Studio screens)

- **Backlog board** — kanban over `stage`, per ticket: owner, iteration counters, cost to date, "Run next flow" button (enabled only when a flow `consumes` that stage).
- **Ticket page** — the folder rendered as tabs (requirements, solution, QA, dev, review) with diff-between-versions and the runs.log timeline.
- **Requirement merge view** — candidate-claude / candidate-codex / merged side by side with the Head-of-Product reasoning.
- **Contracts & tasks view** — tasks.yaml as a table with role badges and dependency arrows, each task linking to its contract files and its branch.
- **Red/green matrix** — scenarios × status across red-report, green-report, final-report.
- **Review loop view** — rounds as columns, findings deduped by the verdict, which ones were fixed in which dev iteration.
- Existing: mission control (fan-out columns now N wide), gate screen, step chat, run history.

## 9. Cost and iteration guardrails

Per-flow and per-ticket budget in `harness.yaml` (`budget: { per_run_usd: 10, per_ticket_usd: 60 }`) — exceeded budget behaves like an exhausted loop: stop at a human gate. Token/cost roll-ups already exist per run and per vendor; add per ticket and per stage.

## 10. Open questions

1. M1 ships no lighter `fix` flow. A review rejection targets the full `development` flow, whose declared `consumes: red` stage is the derived regression target.
2. Script steps are on the v1 roadmap but `qa-red`, `qa-final` and `deploy` need them. Pulling `type: script` into v1 is the cheapest way to unblock this spec.
3. Does the `central` backlog layout make the cold-clone test worse? Default stays `in-repo`; `central` is opt-in.
4. Codex CLI's headless output is less structured than Claude Code's stream-json; the `findings: true` / `verdict:` outputs assume the adapter can extract a trailing JSON block. Spec the "structured tail" convention in the adapter contract.

## 11. Minimal proof path

Day 1: backlog schema + `requirements.yaml` only (two PMs, one judge, one gate). Day 2: `solutioning.yaml` with the review loop. Day 3: `qa-red` + `development` with a two-role fan-out and integrate step. If the integrate step works on a real repo, the rest is composition.
