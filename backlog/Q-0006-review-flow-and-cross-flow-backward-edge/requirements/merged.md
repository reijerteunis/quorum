# Q-0006 — Review flow with cross-flow backward edge

*Merged requirement (head-of-product). Ticket Q-0006, stage draft → requirements. Milestone M1.
Judged from `requirements/candidate-claude.md` and `requirements/candidate-codex.md`, verified against the spike.*

## Problem

A ticket at stage `green` has an integration branch whose tests pass, and nobody has read the diff. Tests written by an automation-qa agent against contracts written by an architect agent, satisfied by developer agents, is a closed loop with no outside opinion in it — the exact failure mode Quorum exists to prevent. The seven-stage SDLC names `reviewed` as a stage and `review.yaml` as its flow; neither exists. `harness/flows/` ships four flows, `harness/roles/` ships eight roles, and `code-reviewer` is not one of them. Until this ticket lands, the cold-clone promise — "a multi-vendor-**reviewed**, human-approved merged branch" — is not true.

The panel is the easy half. The hard half is the way back: a reviewer that finds a blocker must send the ticket to a *different flow* consuming a *different stage*, and that round trip must be bounded, counted on the ticket, and must end at a human gate instead of continuing to spend the user's subscription. Q-0006 is the first place where the loop a review stage exists for meets the rule that no loop runs unbounded.

Four things found in the spike shape this requirement:

- **The engine already implements the edge.** `runFlow` handles `goto: flow:<name>` (`spike/src/engine.js:76-86`): it loads the target flow and regresses the ticket to that flow's `consumes`. Missing are the flow file, the role, round numbering, lint coverage, the diff, and the state a fix round needs.
- **The documented `review.yaml` does not run.** `docs/02-sdlc-pipeline-spec.md:293-330` uses `type: judge`, `input: { findings: [...] }`, `output: { findings: true, tasks: true }` and `on_fail.with:` — none of which `runStep`, `buildPrompt`, `schemaFor` or `handleFail` support. It also writes rounds to `review/round-{iter}/`, and `{iter}` is the in-run loop index, which is always 1 in a review run because the cross-flow edge returns immediately. Every round would overwrite round 1.
- **Reviewers cannot get their own diff.** `buildPrompt` only *tells* the agent to run `git diff` (`spike/src/engine.js:281`), while a step without `worktree` runs under `--permission-mode plan` (claude) and `--sandbox read-only` (codex).
- **The loop cannot close.** A second development run reuses the first run's task worktrees (`ensureWorktree` returns the existing directory, `spike/src/git.js:11`) and only syncs to the base when `iter > 1` or wave > 0, so a rework round starts from a stale tree.

## User stories

**Maintainer.** As a solo maintainer with Claude and Codex subscriptions, I run `harness run review Q-0006` on a green ticket and get two independent reviews of the same diff from two vendors plus a verdict that deduplicates them. When the verdict says `changes-requested` the ticket moves itself back to the stage development consumes, with the round's findings on disk, so my next command is `harness run development Q-0006` and the developers can read what the reviewers said. I never fear two vendors arguing all night: after three rounds it stops and asks me.

**Adopter.** As a stranger trying Quorum on my own repo, the review stage is what makes the README's promise real and it costs me no new setup — no key, no login beyond the two CLIs I already have, no file I must author. If my default branch is not `main`, the run tells me which line of `harness/harness.yaml` to change instead of failing on an unreadable git error.

**Contributor.** As someone adapting the shipped templates, `review.yaml` is a flow file I can read and copy. When I break the cross-flow edge — point it at a flow that does not exist, or one whose chain never leads back here — `harness lint` names both flows and the stage where the chain dies, instead of letting the run discover it at the moment it would have regressed.

## Decisions taken here (so solutioning is not blocked)

Both candidates raised these as open; each is answered below and encoded as an acceptance criterion. Two of them override a written source and are called out first.

**D1 — The regression target is derived, and today it is `red`.** *(Overrides the ticket body.)* Three sources disagree: the ticket says `green → solutioned`, the engine derives `red` from `development.consumes`, and the state diagram in docs/02 §3.4 draws the arrow back to `green`. `green` is broken — no flow but `review` consumes it, so a rejection would loop the same diff forever. `solutioned` is runnable but re-runs qa-red and rewrites the very tests the review just validated. `red` is the only answer consistent with "a flow may only run on a ticket whose stage matches its `consumes`". The criterion below tests the *derivation*, never the literal stage name, so this decision costs one line to reverse: `goto: flow:qa-red` lands the ticket on `solutioned` with no engine change and no change to any other file. The ticket body and the §3.4 diagram are corrected in the same change, with a DECISIONS.md entry.

**D2 — Round numbers come from the filesystem, not from the counter.** *(Overrides candidate-claude AC-5.)* `iterations.review + 1` is wrong the moment a round approves: approval does not increment the counter, so after `qa-final` sends a ticket back to development and it returns to `green`, the second review run would compute round 1 again and overwrite the first round's audit trail. Codex flagged the same class of bug for aborted rounds. Rule: **the round number is the highest `N` for which `review/round-N/verdict.md` exists, plus one**, computed at run start. A round that failed before writing a verdict is retried into the same directory — which is exactly the engine's existing, documented re-run semantics for a failed parallel step.

**D3 — No machine-readable task handoff.** `on_fail.with:` does not exist in the engine and building it means inventing a cross-flow payload mechanism, a precedence rule against `solution/tasks.yaml`, and a merge story. For M1 a rejected review re-runs the full `tasks.yaml`; the fan-out reads `review/verdict.md` as context. Scoping is a follow-up once the cost is measured.

**D4 — `retry` at the exhausted gate resets only its own counter.** Today `runGate` sets `ctx.counters = {}` (`spike/src/engine.js:207`), which would also wipe a ticket's `qa` counter and hand a later stage a budget it did not earn.

**D5 — The exhaustion gate is not auto-advanceable.** Quality pillar 4 of docs/02 says exhausting a loop "always lands on a human gate"; `runGate` currently auto-advances anything but `human-locked` under `--auto` (`spike/src/engine.js:202`). The code is wrong, not the pillar. Needs a DECISIONS.md entry because it changes `--auto` for every flow.

**D6 — Cross-vendor lint stays static and intra-flow.** Tracing which vendor wrote each hunk of an integrated diff across flows is not statically knowable and is not built. Instead: in a `cross_vendor: required` flow, a parallel group whose members share a role must span at least two adapters. That guarantees at least one reviewer differs from whoever wrote the code, whatever wrote it.

**D7 — The base ref is configuration.** `repo.base_branch` in `harness.yaml`, written by `harness init` from the repository's current branch, defaulting to `main`, with an explicit error when the ref is missing. Hard-coding `main` fails a `master` adopter's cold-clone test.

**D8 — Severity threshold.** Any surviving blocker *or* major produces `changes-requested`; nits never do.

**D9 — The verdict step judges reviews, not code.** It receives the two reviews, the merged requirement and the solution — not the diff. It reuses the `code-reviewer` role; judging behaviour lives in the step's `instructions`, as `head-of-product` already demonstrates for requirements.

## Acceptance criteria

Surfaces touched: **`harness/`** (one flow, one role, two config keys), **`backlog/`** (new artifact paths, one counter), **CLI** (`run`, `lint`, `init`), **spike engine and mock suite**. No UI work.

### The flow and the panel

1. **`review.yaml` exists and lints.** `harness/flows/review.yaml` declares `name: review`, `consumes: green`, `produces: reviewed`, `cross_vendor: required`, and `harness lint` reports it ✓. A byte-identical copy exists at `spike/templates/harness/flows/review.yaml`; `diff -rq harness/flows spike/templates/harness/flows` returns empty (it does today, for all four flows).

2. **The `code-reviewer` role exists.** `harness/roles/code-reviewer.md` and its byte-identical template copy define the persona: reads a diff against a requirement and a solution, classifies every finding as blocker / major / nit, quotes file and line, never rewrites code. It pins no codex model name — the existing smoke assertion at `spike/test/smoke.js:128` still passes.

3. **The flow uses only engine-supported step fields.** No `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true }` or `tasks: true`, no `on_fail.with:`. Testable: `review.yaml` runs end to end under the mock adapter without any engine feature added beyond those named in these criteria.

4. **The panel is two reviewers on two vendors.** One `parallel` group runs two `code-reviewer` steps, one on `claude` and one on `codex`, writing `review/round-{round}/claude.md` and `review/round-{round}/codex.md`.

5. **Reviewers are read-only.** Neither step sets `worktree`, so both run with `allowWrite: false`. After a review run: `git status --porcelain` is unchanged except under `backlog/`, `git worktree list` gained nothing, and no branch was created.

6. **One verdict step judges the panel.** A single step reads `review/round-{round}/*.md` from the backlog plus `requirements/merged.md` and `solution/solution.md`, writes `review/round-{round}/verdict.md`, and emits `verdict: approve|changes-requested`. On `changes-requested` `findings` is non-empty; on `approve` it is empty. It does not receive the diff.

7. **Severity threshold is testable.** The verdict document lists surviving findings grouped by severity with `file:line`. A round whose reviews contain only nits yields `approve`; a round containing at least one blocker or major yields `changes-requested`.

8. **Rounds never overwrite each other.** `{round}` is exposed to flow files and computed at run start as (highest `N` with `review/round-N/verdict.md`) + 1. After an approving round and a later regression-triggered round, both `review/round-1/verdict.md` and `review/round-2/verdict.md` exist with different content. A run that fails before writing a verdict reuses its round number. `{iter}` keeps its current meaning, so no shipped flow changes behaviour.

9. **The latest verdict has a stable path.** Every round also writes `review/verdict.md`, overwritten each round. That is the path other flows read; `review/round-N/` is the audit trail.

### The diff the reviewers actually see

10. **The harness computes the diff.** The engine materialises `input.diff` into the prompt: `git diff --stat` in full, then the patch truncated at `repo.max_diff_bytes` (default 200 000). Truncation is stated in the prompt and recorded in `runs.log`. Reviewers are not asked to shell out — under `--permission-mode plan` / `--sandbox read-only` they cannot be relied on to.

11. **Correct range.** The range is `<base>...harness/<id>/integration` — three dots, changes on the ticket branch since it diverged. The `harness/T-{id}..main` in docs/02 §5.5 is inverted and shows the opposite change; it is corrected in the same change.

12. **Base branch is configured, not assumed.** `harness.yaml` gains `repo: { base_branch: <name> }`; `harness init` writes the repository's current branch into it; an absent key falls back to `main`. When the resolved ref does not exist the run stops **before any agent is spawned**, with a message naming the key, the file and the missing ref.

### The backward edge

13. **Regression is derived, never hard-coded.** On `changes-requested` within budget the run ends with status `regressed` and the ticket's stage is set to the `consumes` of the flow named in `goto: flow:<name>`, read from that flow file. Testable: changing `review.yaml`'s goto target to `flow:qa-red` lands a rejected review on `solutioned` instead of `red`, with no engine change.

14. **The run stops there.** The regressed run does not execute the review flow's final gate and does not start the target flow. The CLI reports the target flow, the stage before → after, and the remaining iterations. Starting the next flow stays the human's command.

15. **The counter is persisted and human-readable.** Flow files write `counter: review`; the value lands as `iterations.review` in `ticket.md`, increments once per traversal, is written before the process exits, and is read back by the next process. `harness board` shows it. Lint rejects a `counter:` value with an `iterations.` prefix and gives the corrected spelling — the prefixed form in docs/02 §5.5 would create a literal `"iterations.review"` key nested inside `iterations`, and the doc is corrected in the same change.

16. **The bound is exact.** With `max_iterations: 3`, the first three `changes-requested` verdicts regress the ticket and the fourth presents the exhaustion gate. Lint fails a missing, non-integer, zero or negative `max_iterations`, naming the step and the field.

17. **Exhaustion lands on a gate that `--auto` cannot walk through.** The gate's reason names the counter, the current count and limit, the outstanding blockers, and the three options. The stage does not regress and no development run starts.

18. **The three gate answers are not interchangeable.** `advance` accepts the current diff and completes toward `reviewed`; `retry` authorises exactly one more traversal and resets `iterations.review` **only** — a ticket's `qa` or any other counter is untouched, and the reset is recorded in `runs.log`; `abort` ends the run with the stage unchanged.

19. **A gate answer is never defaulted silently.** In a non-interactive run the answer comes from an explicit source (`--gate-answer advance|retry|abort`, or stdin); an empty or absent answer is an error naming the gate, not a silent `advance`. Today `bin/harness.js:61` treats an empty line as `advance`, which is a human gate advancing itself.

### Making the round trip actually work

20. **Rework starts from the integration branch.** When a development run begins on a ticket whose task branches already exist, each task worktree merges `harness/<id>/integration` before its agent runs. A conflict during that sync is a warning naming the task, never silent. Testable: after review → development → review, the second development run's worktrees contain the files the first run merged.

21. **Developers see the verdict.** `development.yaml`'s fan-out step adds `review/verdict.md` to its `input.backlog`. The file is absent on a first pass and `readFiles` returns nothing, so the existing `draft → green` smoke path stays green unchanged.

### Audit and failure containment

22. **Every outcome is distinguishable on disk.** `completed`, `regressed`, `exhausted`, `aborted` and `failed` review runs are told apart in `runs.log` and `history`, each recording run id, flow, stage before → after and cost. A failed or interrupted run is never recorded as completed, and `green → red → green → reviewed` is reconstructable from the ticket folder alone.

23. **Invalid structured output stops the run cleanly.** The raw response is saved beside the ticket, the run stops with a message naming the failed step and the saved file, the stage neither advances nor regresses, and `iterations.review` does not change.

24. **An asymmetric panel failure loses nothing and decides nothing.** When one reviewer fails and the other succeeds, the survivor's artifact is kept, the verdict step does not run on a half panel, the stage is unchanged and the counter is not incremented.

### Lint

25. **Cross-flow targets resolve before anything runs.** `harness lint` fails when `goto: flow:<name>` names a flow file that is missing or does not load, and fails when the chain from the target flow's `produces` does not lead back to this flow's `consumes` over the available flows. The message names both flows and the stage where the chain dies. Resolution happens at lint time, before any agent is spawned or any ticket file is written.

26. **A single-vendor panel fails lint.** In a flow with `cross_vendor: required`, a `parallel` group whose steps share one role must span at least two adapters; the message names the step ids and the shared adapter. The existing verdict-input rule keeps passing for this flow — the verdict's inputs are written by two different adapters, which the refined cross-vendor rule permits for a judge.

### Regression suite

27. **The mock suite covers the loop.** New deterministic checks: `green → review → regressed` (stage lands on the derived stage, `iterations.review = 1`, `review/round-1/` complete, working tree untouched); a rework `development` run reaching green again; a second review round writing `review/round-2/` without touching round 1; `green → reviewed` on approval; an exhausted loop presenting a gate that `--auto` does not bypass and that is answered non-interactively; `abort` at exhaustion preserving the stage; an invalid cross-flow target failing lint before execution; invalid structured output changing neither stage nor counter.

28. **Test determinism does not depend on call ordering.** The mock keys its call counter by role, and the panel and the verdict step share the `code-reviewer` role, so the verdict's call number would depend on panel size. Review outcomes in tests are driven by an explicit switch (`MOCK_ALWAYS_FAIL` / a new `MOCK_ALWAYS_PASS`), used only for the steps a given assertion is not about.

29. **Everything else stays green.** `npm test --prefix spike` passes, including the existing `draft → green` path, the API-key refusals and the "no shipped template pins a codex model name" assertion. No new dependency.

### Documentation

30. **Docs agree with the shipped flow in the same change.** `docs/02-sdlc-pipeline-spec.md`: §3.4 state diagram (regression target), §5.5 rewritten as the flow actually ships (three-dot diff range, `{round}`, `counter: review`, no `judge`/`findings:`/`tasks:`/`with:`), §10 Q1 answered. `docs/06-development-plan.md`: M1 done-when line. `docs/DECISIONS.md`: one entry for the derived-regression rule (D1), one for the exhaustion gate versus `--auto` (D5). `docs/GLOSSARY.md` needs no new term — `code-reviewer` is covered by **Role** — but **Gate** gains a sentence about exhaustion gates. README gains the one command `harness run review <id>`; no new setup step, because `init` writes `base_branch`.

## Non-goals

- **A lighter `fix.yaml`.** docs/02 §10 Q1: answered no for M1; a rejected review re-enters `development`. Revisit when cost is measured.
- **Scoped rework and task handoff.** No `with:` payload, no review-generated `tasks.yaml`, no precedence rule against the architect's tasks (D3). `scope: failing-tasks-only` continues to narrow only within a single run.
- **Auto-starting the target flow after a regression.**
- **Budget enforcement.** `harness.yaml` carries `budget:` and nothing reads it; a budget line lands before M3.
- **Tracing the producing vendor of an integrated diff in lint** (D6).
- **Overriding the verdict at the ordinary end-of-flow gate.** The gate keeps `advance` / `abort`; a maintainer who disagrees with an `approve` aborts and re-runs.
- **Line-level review comments, PR creation, GitHub integration.** Reviews are markdown in the ticket folder; `deploy.yaml` opens the PR (Q-0012).
- **`qa-final.yaml` and `deploy.yaml`.** They inherit whatever this ticket builds. Q-0012.
- **Any UI.** Mission control, gate screen and review-loop view are M3.
- **Renaming `.harness/worktrees/` to `.quorum/worktrees/`.** Real drift between the spike and the rules, not this ticket's.
- **A single-vendor fallback when only one CLI is logged in.** The panel fails with the existing translated auth message; degrading to one reviewer would quietly delete the headline feature.
- **A third reviewer or a Gemini adapter.** v1 exclusion list.
- **A new stage.** No `rework` stage; the eight existing stages stand.
- **Severity taxonomies beyond blocker / major / nit, eval suites, automated dispute resolution between reviewers.**

## Open questions (none blocking)

| # | Question | Owner | Default already in the ACs |
|---|---|---|---|
| 1 | Does a ticket sitting at `red` with a passing suite read badly enough on the board to justify a `rework` stage? | Ruud | Accept for M1. If it grates in practice it is a stage-machine ticket, not a review ticket. |
| 2 | Is a full development re-run per review round affordable? | Ruud | Full re-run for M1; per-round cost is in `runs.log` (AC-22). If it hurts, open the scoping follow-up (D3). |
| 3 | Do the real CLIs obtain a diff themselves under plan / read-only sandbox? | This ticket's implementation | Irrelevant to the design — the harness inlines it either way (AC-10), because inlining is deterministic and reproducible. Record the real-CLI evidence in the ticket folder. |
| 4 | Is `max_diff_bytes: 200000` the right default? | This ticket's implementation | Ship 200 000, tune after the first real run. |
| 5 | Should a human `advance` at the exhaustion gate record a written acceptance reason? | Ruud | `runs.log` + `history` entries suffice for M1; a reason field belongs to M3's gate screen. |

## Risks

1. **Cost per rework round.** Two reviewers over a full diff plus a judge, and a rejection re-runs *every* task plus an integrate step. Three rounds is up to twelve agent calls on top of the original development run. Mitigated by the bound (AC-16) and per-round cost (AC-22); budget enforcement is deliberately out of scope. Strongest argument for revisiting Open question 2 early.
2. **Reviewers drown in a large diff.** A forty-file ticket produces a patch no reviewer reads well and AC-10 truncates it. The stat block always survives, so "this diff is too large to review as one change" is a legitimate `changes-requested` finding — better than a silently truncated approval.
3. **A reviewer that always finds something.** Two adversarial personas can generate blockers indefinitely; the bound turns that into a gate rather than a bill. If round-3 findings are consistently nits, the verdict step's threshold instruction (D8) is too weak.
4. **`red` will mean "tests are red" when they are green.** Harmless mechanically — development re-runs and integrate proves green again — but it reads oddly on the board (Open question 1).
5. **Two copies of every template.** Nothing enforces that `harness/` and `spike/templates/harness/` stay identical; AC-1 and AC-2 make it a test rather than a habit.
6. **Mock switches hiding real routing bugs.** A switch that forces verdicts can mask a routing defect if used too broadly; AC-28 confines it to steps the assertion is not about.
7. **A counter lost to an interruption.** `finish()` persists counters on the regressed *and* failed paths, so an interrupted run cannot silently buy extra iterations — AC-22 and AC-23 are what keep that true.

## Cross-cutting checklist

- **BYOS.** No new auth path. The panel uses the existing `claude` and `codex` adapters and their `check()` guards; no test, fixture or example mentions a key. A dead login surfaces through the existing translated message; `harness adapters --probe` remains the way to find out before paying for a round.
- **Worktree safety.** Reviewers create no worktree and no branch and run with `allowWrite: false` (AC-5). The only writes are into `backlog/<ticket>/review/` and `ticket.md`. The rework sync (AC-20) happens inside existing task worktrees.
- **Gates.** One `gate: human` at the end of the flow (flippable to `auto` by the user); one exhaustion gate that `--auto` cannot bypass (AC-17). No `human-locked` gate — that stays deploy's.
- **Files are the database.** New paths `review/round-N/{claude,codex,verdict}.md` and `review/verdict.md`; new counter key `iterations.review`; new config keys `repo.base_branch` and `repo.max_diff_bytes`; new flow variable `{round}`. All additive — no existing ticket, flow or config file becomes invalid. The step output schema (`summary`, `document`, `verdict`, `findings`) is unchanged.
- **Errors are explicit.** Missing base ref stops before spawning (AC-12); truncation is declared (AC-10); an unresolvable `flow:` target fails at lint (AC-25); invalid output dumps raw text and stops (AC-23); an empty gate answer is an error (AC-19).
- **Cold-clone impact.** One more command in the README path — the one that makes "multi-vendor-reviewed" true. No new setup step. Net cost to the 30 minutes is two reviews and a verdict.
- **Product-agnostic.** Nothing in the flow, the role or the tests names a product; the role text speaks only about diffs, contracts and requirements.

## Provenance

**Base document: candidate-claude.** It is the only one grounded in the running code, and every code-level claim in it that I checked held: the cross-flow edge already exists (`engine.js:76-86`), `input.diff` merely instructs the agent (`engine.js:281`), `runGate` wipes all counters on retry (`engine.js:207`), `--auto` bypasses everything but `human-locked` (`engine.js:202`), worktrees are reused without syncing (`git.js:11`, `engine.js:337`), and the shipped flow/role copies are byte-identical today. Its problem statement, user stories, the read-only panel, the stable `review/verdict.md`, the diff range correction, `repo.base_branch`, the derived-regression rule, counter naming, the rework sync, and the "developers see the verdict" criterion are all its work and are carried over largely intact.

**From candidate-codex:** the criteria that hold a failing system honest rather than describing a working one — outcome-distinguishable run history (AC-22), invalid structured output leaving stage and counter untouched (AC-23), asymmetric parallel-reviewer failure (AC-24), lint resolving cross-flow targets *before* any execution or file write (AC-25), the exact reading of `max_iterations` and its lint validation (AC-16), the three non-interchangeable gate outcomes (AC-18), and the explicit statement that the engine must not auto-start the target flow (AC-14). Its risk list also contributed the interruption-versus-counter risk and the "hard-coded base branch fails a cold-clone adopter" framing. Its instinct to name five blockers is what forced the decisions section; it was right that they were unanswered, wrong that they needed Ruud.

**Neither candidate:** the round-numbering rule (D2) — Claude proposed `iterations.review + 1`, which silently overwrites round 1 after an approval followed by a qa-final regression; Codex spotted the failure class but proposed no rule. Also mine: AC-3 (the flow may use only step fields the engine actually has, since the documented `review.yaml` uses four it does not), AC-19 (an empty gate answer currently means `advance`), AC-28 (the mock keys call counts by role, so the panel and the verdict share a counter), and the one-line reversal for D1 (`goto: flow:qa-red`) that turns the regression-target disagreement from a blocker into a configuration choice.

**Struck as untestable or out of scope:** Codex's "the two copies have equivalent behavior" (replaced by a byte-identical `diff` check), its "applicable harness rules" as a reviewer input (replaced by the named files), its cross-flow provenance requirement for lint (D6 — not statically knowable, so it could only ever pass vacuously), and its review-task handoff (D3 — it requires a payload mechanism the engine does not have and a file-format decision that belongs to whichever ticket actually needs it).
