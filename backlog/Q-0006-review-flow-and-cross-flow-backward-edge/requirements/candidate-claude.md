# Q-0006 — Review flow with cross-flow backward edge

*Requirement candidate (product-manager, Claude). Ticket Q-0006, stage draft → requirements. Milestone M1.*

## Problem

A ticket that reaches stage `green` has an integration branch whose tests pass. Nobody has read the diff. Passing tests written by an automation-qa agent against contracts written by an architect agent, satisfied by developer agents, is a closed loop with no outside opinion in it — the exact failure mode Quorum exists to prevent. The seven-stage SDLC names `reviewed` as a stage and `review.yaml` as its flow, but neither exists: `harness/flows/` ships four flows, `harness/roles/` ships eight roles, and `code-reviewer` is not one of them.

The `maintainer` cannot today get from "tests pass" to "a second and third vendor read this diff and I saw their disagreement" without leaving Quorum. The `adopter`'s cold-clone test says "multi-vendor-**reviewed**, human-approved merged branch" — with no review stage, the sentence in the README is not yet true.

The hard part is not the panel. It is the way back. A reviewer that finds a blocker must send the ticket to development, which is a *different flow* consuming a *different stage*, and that round trip must be bounded, counted on the ticket, and must end at a human gate rather than continuing to spend the user's subscription. Q-0006 is the first place where the loop a review stage exists for meets the rule that no loop runs unbounded.

Three things found while reading the spike change the shape of this requirement:

- **The engine already implements half of it.** `runFlow` handles `goto: flow:<name>` (`spike/src/engine.js:76-86`): it loads the target flow and regresses the ticket to that flow's `consumes` stage. What is missing is the flow file, the role, round numbering, lint coverage, and the state the fix round needs.
- **The regression target in the ticket body is wrong.** The ticket says `green` → `solutioned`. The engine derives `red` (development's `consumes`). The state diagram in `docs/02-sdlc-pipeline-spec.md:93-98` draws the arrow back to `green`. Three sources, three answers — see Open question 1.
- **The loop cannot close today even once the flow exists.** A second development run reuses the task worktrees from the first (`ensureWorktree` returns the existing directory, `spike/src/git.js:11`) and only syncs to the base when `iter > 1` or wave > 0 — so on a rework round the developers work from a stale tree. That is AC-15.

## User stories

**Maintainer.** As a solo maintainer with Claude and Codex subscriptions, I run `harness run review Q-0006` on a green ticket and get two independent reviews of the same diff from two vendors plus a verdict that deduplicates them. When the verdict says `changes-requested`, the ticket moves itself back to the stage development consumes, with the round's findings on disk, so my next command is `harness run development Q-0006` and the developers can see what the reviewers said. I never fear an argument between two vendors running all night: after three rounds it stops and asks me.

**Adopter.** As a stranger trying Quorum on my own repo for the first time, the review stage is the step that makes the README's promise real, and it costs me no new setup: no key, no login beyond the two CLIs I already have, no new file I must author. If my repo's default branch is not `main`, the run tells me which line of `harness/harness.yaml` to change instead of failing on an unreadable git error.

**Contributor.** As someone adapting the shipped templates, `review.yaml` is a flow file I can read and copy. When I break the cross-flow edge — point it at a flow that does not exist, or one that does not lead back here — `harness lint` names both flows and both stages instead of letting the run discover it at the moment it would have regressed.

## Acceptance criteria

Surfaces touched: **`harness/`** (one new flow, one new role), **`backlog/`** (new artifact paths and one counter), **CLI** (`harness run`, `harness lint`, `harness init`). No UI work.

### The flow and the panel

1. **`review.yaml` exists and lints.** `harness/flows/review.yaml` declares `consumes: green`, `produces: reviewed`, `cross_vendor: required`, and `harness lint` reports it ✓. A byte-identical copy exists at `spike/templates/harness/flows/review.yaml` — the four shipped flows and eight roles are currently byte-identical across the two locations and that invariant holds after this change (testable: `diff` returns empty for every file in both directories).

2. **The `code-reviewer` role exists.** `harness/roles/code-reviewer.md` and its identical template copy define the reviewer persona: reads a diff against a requirement and a solution, classifies each finding as blocker / major / nit, quotes the file and line, and never rewrites the code. Its frontmatter pins no codex model name — the existing smoke assertion "no shipped template pins a codex model name" still passes.

3. **The panel is two reviewers on two vendors, read-only.** A `parallel` group runs two `code-reviewer` steps, one on `claude` and one on `codex`, each writing `review/round-{round}/claude.md` and `review/round-{round}/codex.md`. Neither step sets `worktree`, so both run with `allowWrite: false` (`--permission-mode plan` / `--sandbox read-only`). Testable: after a review run, `git status --porcelain` in the repository is unchanged, `git worktree list` gained nothing, and no branch was created.

4. **One verdict step judges the panel.** A single step reads `review/round-{round}/*.md` from the backlog, writes `review/round-{round}/verdict.md`, and emits `verdict: approve|changes-requested`. On `changes-requested` the `findings` array is non-empty; on `approve` it is empty. The step deduplicates the two reviews, drops nits, and keeps blockers and majors. It does not receive the code — only the two reviews, the requirement and the solution.

5. **Rounds do not overwrite each other.** The Nth review run on a ticket writes into `review/round-N/`, where N is derived from the persisted counter at run start (`(iterations.review ?? 0) + 1`) and exposed to flow files as `{round}`. Testable: after a `changes-requested` round and a second review run, both `review/round-1/verdict.md` and `review/round-2/verdict.md` exist with different content. The existing `{iter}` variable keeps its current meaning (in-run loop index) so no shipped flow changes behaviour.

6. **The latest verdict has a stable path.** Each round also writes `review/verdict.md`, overwritten every round. This is the path other flows read; `review/round-N/` is the audit trail.

### The diff the reviewers actually see

7. **Correct range.** Reviewers receive the change *on the ticket branch*: `<base>...harness/<id>/integration` (three dots — changes on the ticket branch since it diverged). The range in `docs/02-sdlc-pipeline-spec.md:305` (`harness/T-{id}..main`) is inverted and shows the opposite change; it is corrected in the same change.

8. **Base branch is configured, not assumed.** `harness.yaml` gains `repo: { base_branch: <name> }`. `harness init` writes the repository's current branch into it. When the key is absent the engine falls back to `main`; when the resolved ref does not exist the run stops before spending anything, with a message naming the key, the file and the missing ref. No silent default, per the explicit-errors rule.

9. **The harness computes the diff; the reviewer does not shell out.** The `input.diff` step input is materialised by the engine into the prompt: `git diff --stat` in full, then the patch up to `repo.max_diff_bytes` (default 200 000). Truncation is stated in the prompt and recorded in `runs.log`. Rationale: reviewers run under `--permission-mode plan` (claude) and `--sandbox read-only` (codex), and today `buildPrompt` only *instructs* the agent to run `git diff` itself (`spike/src/engine.js:281`) — the commented-out `extraArgs: ["--allowedTools", "Read", "Bash(git diff *)"]` in `harness/harness.yaml` suggests this was already suspected. Verified on both real CLIs before this ticket closes; if inlining proves unnecessary the criterion is met by evidence in the ticket folder rather than by code.

### The backward edge

10. **Regression is derived, never hard-coded.** On `changes-requested`, the run ends with status `regressed` and the ticket's stage is set to the `consumes` stage of the flow named in `goto: flow:<name>` — read from that flow file, not written in the engine or in `review.yaml`. Testable: renaming which stage `development.yaml` consumes changes where a rejected review lands, with no change to `review.yaml`.

11. **The counter is persisted and named for humans.** `iterations.review` on `ticket.md` increments once per rejected round and survives across runs, because each rework is a separate process. `harness board` shows it (`iter={"review":2}`). Flow files write `counter: review`; a `counter:` value with an `iterations.` prefix is rejected by lint with a message giving the corrected form. (docs/02 §5.5 currently writes `counter: iterations.review`, which would produce the literal key `"iterations.review"` inside `iterations` — the doc is corrected in the same change.)

12. **The run is auditable.** A regressed run appends to `runs.log` (run id, flow, verdict, stage before → after, cost) and adds a `history` entry recording the regression, so `green → red → green → reviewed` is reconstructable from the ticket folder alone.

13. **The loop is bounded and lands on a gate.** `max_iterations: 3`. On the fourth `changes-requested` the stage does *not* regress; the run stops at a gate whose reason names the counter, the limit, the outstanding blockers and the options (advance / retry / abort). Subject to Open question 3, `--auto` does not walk through this gate.

14. **A gate retry resets one counter.** Answering `retry` at an exhausted review loop resets `iterations.review` only. Today `runGate` sets `ctx.counters = {}` (`spike/src/engine.js:207`), which would also wipe a ticket's `qa` counter and hand the next stage a fresh budget it did not earn.

### Making the round trip actually work

15. **Rework starts from the integration branch.** When a development run begins on a ticket whose task branches already exist, each task worktree merges `harness/<id>/integration` before its agent runs, so developers see the tests, the contracts and the previous rounds' merges. A merge conflict during that sync is a warning naming the task, never silent. Testable: after review → development → review, the second development run's worktrees contain the files the first run merged.

16. **Developers see the verdict.** `development.yaml`'s fan-out step adds `review/verdict.md` to its `input.backlog`. The file is absent on a first pass and `readFiles` returns nothing, so fresh tickets are unaffected — testable by the existing `draft → green` smoke path staying green unchanged.

### Lint and regression suite

17. **Lint understands cross-flow edges.** `harness lint` fails when `goto: flow:<name>` names a flow file that does not exist or does not load, and fails when the target flow's `produces` is not this flow's `consumes` — an edge that does not lead back here strands the ticket in a stage no flow chains from. The message names both flows and both stages. Additionally, in a flow with `cross_vendor: required`, a `parallel` group whose steps share one role must span at least two adapters, so a single-vendor "panel" is caught at lint rather than at the gate.

18. **The mock-adapter suite covers the loop.** The smoke test gains: `green → review → regressed` (stage lands on the derived stage, `iterations.review = 1`, `review/round-1/` complete, working tree untouched), a rework `development` run reaching green again, a second review round writing `review/round-2/` without touching round 1, and an exhausted loop stopping at a gate. This requires a deterministic pass switch in the mock adapter (`MOCK_ALWAYS_PASS=1`): a verdict step returns the failing enum value on call #1 of each process, so a fresh `harness run review` can never currently approve. `pnpm test` stays green.

## Non-goals

- **A lighter `fix.yaml`.** docs/02 §10 Q1 asks whether review fixes deserve their own single-agent flow. Answer for M1: no — the rejected review re-enters `development`. Revisit when the cost is measured (Risk 1).
- **Scoped rework.** The `with: { tasks: … }` payload in docs/02 §5.5 is not built. A review-triggered development run fans out over all of `tasks.yaml`; `scope: failing-tasks-only` only narrows within a single run, because `ctx.failingTasks` is per-run state. Follow-up ticket, see Open question 6.
- **Budget enforcement.** `harness.yaml` carries `budget:` and nothing reads it. Per the plan, a budget line lands before M3; a review loop is where it will first matter, but it is not built here.
- **Line-level review comments, PR creation, GitHub integration.** Reviews are markdown documents in the ticket folder. `deploy.yaml` opens the PR (Q-0012).
- **`qa-final.yaml` and `deploy.yaml`.** They also need cross-flow edges and will inherit whatever this ticket builds. Q-0012.
- **Any UI.** Mission control, the gate screen and a review-loop view are M3.
- **Renaming `.harness/worktrees/` to `.quorum/worktrees/`.** The spike writes `.harness/`; the rules say `.quorum/`. Real drift, not this ticket's.
- **A single-vendor fallback when only one CLI is logged in.** The panel fails with the existing actionable auth message. Degrading to one reviewer would quietly delete the headline feature.
- **A third reviewer, or a Gemini adapter.** v1 exclusion list.
- **A new stage.** `reviewed` and the existing eight stages are enough; no `rework` stage is introduced (see Risk 3).

## Open questions

| # | Question | Owner | Blocking? | Recommendation |
|---|---|---|---|---|
| 1 | Which stage does a rejected review regress to? The ticket body says `solutioned`; the engine derives `red` from `development.consumes`; the state diagram in docs/02 §3.4 draws the arrow back to `green`. | Ruud | **Blocks AC-10** | The derived answer: the target flow's `consumes`, i.e. `red`. It is the only one consistent with "a flow may only run on a ticket whose stage matches its `consumes`" — `solutioned` would re-run qa-red and rewrite the tests the review just validated, and `green` would leave the ticket in a stage no flow consumes. The ticket body and the §3.4 diagram are then wrong and are corrected in the same change. |
| 2 | Counter naming in flow files: `counter: review` or `counter: iterations.review` as docs/02 §5.5 writes it? | Ruud | **Blocks AC-11** (file format) | `counter: review`. Counter names are keys inside `iterations`; the prefixed form produces a literal `"iterations.review"` key. Lint rejects the prefixed form with the corrected spelling. |
| 3 | Does `--auto` bypass the exhausted-loop gate? It does today (`runGate` returns immediately unless the gate is `human-locked`), which contradicts quality pillar 3: "exhausted loops and exceeded budgets always land on a human gate". | Ruud | **Blocks AC-13** | Make the exhausted-loop gate non-auto-advanceable and give the smoke test a scripted answer on stdin. This changes `--auto` for every flow, so it needs a DECISIONS entry. If rejected, AC-13 drops its last sentence and the safety pillar's wording must be softened instead — the two cannot both stand. |
| 4 | Where does the base branch come from on a repository that is not on `main`? | Ruud | No | `repo.base_branch` in `harness.yaml`, written by `harness init` from the repo's current branch, defaulting to `main`, with an explicit error when the ref is missing (AC-8). Cheapest thing that keeps the cold-clone test honest on a `master` repo. |
| 5 | Do the two reviewer CLIs reliably obtain a diff themselves under plan / read-only sandbox, or must the harness inline it? | Adapter work, this ticket | No — AC-9 states the assumption | Inline it. Deterministic, adapter-agnostic, reproducible, and cheaper than an agent groping around with git. Record the real-CLI evidence in the ticket folder either way. |
| 6 | Full development re-run per review round, or persist the affected task ids so the fan-out can scope? | Ruud | No | Full re-run for M1; measure the cost (Risk 1); open a follow-up if it hurts. Scoping needs a cross-flow payload mechanism that does not exist. |
| 7 | Should the verdict step have its own role, or reuse `code-reviewer` with judging instructions? | Ruud | No | Reuse `code-reviewer`. A second role means a new persona in docs/02 §6 and the glossary for one step; the judging behaviour fits in the step's `instructions`, as `head-of-product` already demonstrates for requirements. |

## Risks

1. **Cost per rework round.** One round is two reviewers over a full diff plus one judge; a rejection then re-runs *every* task in `development` plus an integrate step. Three rounds is up to twelve agent calls on top of the original development run, on the user's subscription. Mitigations in scope: the bound (AC-13), per-round cost in `runs.log` (AC-12). Mitigation deliberately out of scope: budget enforcement. This is the strongest argument for revisiting Open question 6 early.
2. **Reviewers drown in a large diff.** A ticket that touched forty files produces a patch no reviewer reads well, and AC-9's cap truncates it. The stat block always survives, so a reviewer can say "this diff is too large to review as one change" — that is a legitimate `changes-requested` finding and better than a silently truncated approval.
3. **`red` will mean "tests are red" when they are green.** After a rejected review the ticket sits at stage `red` with a passing suite. Harmless mechanically — development re-runs and integrate proves green again — but it will read oddly on the board and in `history`. Accepted for M1 rather than introducing a `rework` stage; if it grates in practice it is a stage-machine ticket, not a review ticket.
4. **A reviewer that always finds something.** Two adversarial personas can generate blockers indefinitely; the bound converts that into a gate rather than a bill, but a maintainer who hits the gate every time will stop trusting the stage. Watch the first real runs: if round 3 findings are consistently nits, the verdict step's "drop nits" instruction is too weak.
5. **Two copies of every template.** `harness/` and `spike/templates/harness/` are byte-identical today; this change adds a flow and a role to both. Nothing enforces it — AC-1 and AC-2 make it a test rather than a habit.
6. **Mock determinism.** The regression suite can only test the happy path with a new mock switch (AC-18). A switch that makes verdicts pass can hide a real routing bug if it is used too broadly; use it only for the steps a given assertion is not about.

## Cross-cutting checklist

- **BYOS.** No new auth path. The panel uses the existing `claude` and `codex` adapters and their `check()` guards; no test, fixture or example in this change mentions a key. A missing login surfaces through the existing translated message, and `harness adapters --probe` remains the way to find out before paying for a review round.
- **Worktree safety.** Reviewers create no worktree and no branch and run with `allowWrite: false` (AC-3). Nothing in this flow writes to the user's working tree; the only writes are into `backlog/<ticket>/review/` and `ticket.md`. The rework sync in AC-15 happens inside existing task worktrees under `.harness/worktrees/`.
- **Gate behaviour.** One `gate: human` at the end of the flow (default, may be flipped to `auto` by the user); one gate on loop exhaustion (AC-13, subject to Open question 3). No `human-locked` gate — that stays deploy's.
- **File format and schema.** New backlog paths `review/round-N/{claude,codex,verdict}.md` and `review/verdict.md`; new ticket counter key `iterations.review`; new `harness.yaml` keys `repo.base_branch` and `repo.max_diff_bytes`; new flow-file variable `{round}`. All additive — no existing ticket, flow or config file becomes invalid. Step output schema (`summary`, `document`, `verdict`, `findings`) is unchanged; the `findings: true` and `tasks: true` step outputs sketched in docs/02 §5.5 are not built and are removed from the doc.
- **Lint rules.** Two additions (AC-17): cross-flow target resolution with stage round-tripping, and vendor diversity within a same-role parallel group. The existing cross-vendor lint already passes for this flow — the verdict step's inputs are produced by two different adapters, which the refined cross-vendor rule permits for a judge.
- **Cold-clone impact.** One more command in the README's path (`harness run review <id>`), which is the command that makes "multi-vendor-reviewed" true. No new setup step: `base_branch` is written by `init`. Net effect on the 30 minutes is the runtime of two reviews and a verdict, and it buys the sentence the launch post is built on.
- **Product-agnostic.** Nothing in the flow, the role or the tests names a product. The role text speaks about diffs, contracts and requirements only.
- **Errors are explicit.** A missing base ref stops the run before any agent is spawned (AC-8); a truncated diff is declared (AC-9); an unresolvable `flow:` target fails at lint (AC-17); invalid structured output keeps the existing behaviour of dumping raw text beside the ticket and stopping.

## Documentation to update in the same change

`docs/02-sdlc-pipeline-spec.md`: §3.4 state diagram (regression target), §5.5 (the flow as shipped — diff range, counter spelling, no `findings:`/`tasks:` outputs), §10 Q1 answered. `docs/06-development-plan.md`: M1 done-when line for the review flow. `docs/GLOSSARY.md`: `code-reviewer` is covered by the existing **Role** entry — no new term is introduced; if Open question 3 changes `--auto`, **Gate** gains a sentence. `docs/DECISIONS.md`: one entry for the regression-target rule (Open question 1), and one for the exhausted-loop gate versus `--auto` if that lands (Open question 3).
