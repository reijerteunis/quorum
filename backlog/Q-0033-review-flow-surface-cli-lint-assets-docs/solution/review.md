# Architecture review — Q-0033 solution, round 2

**Verdict: approve.** All nine round-1 findings are closed, and I checked each one against the
artifact it was about rather than against the disposition note. Nothing blocks QA. Four small
items are recorded at the bottom as implementation carry-overs, not as a reason to spend another
round.

## Verification of the round-1 findings

I re-read the three contracts from `harness/Q-0033/contracts` at `07eac81`, not from the draft's
description of them.

**B1 — red phase inside the fan-out.** Closed. `Q0033-contract-tests` is gone. Both remaining
task descriptions end with "Do not edit tests", `## Ownership and sequencing` states "Qa-red owns
`spike/test/**`", and the coverage list has moved into `documentation-and-evidence.contract.md`
§ *Automated evidence*, which is what the qa-red scenario author actually reads. The rejected
alternative is stated with the right reason — `development.yaml:17` forbids editing tests and
`:22-27` integrates with `expect: pass`, so a red deliverable could never have satisfied it.

**B2 — subscription-spending evidence as a fan-out task.** Closed. `Q0033-real-cli-evidence` is
gone, criterion 12 is a `### Closing-gate checklist` item, and both task descriptions carry "or
create real-CLI evidence" in their prohibition list. The contract clause and the task list now
agree instead of contradicting each other.

**B3 — no `description`, so ownership never reaches the agent.** Closed. Both tasks now name
every writable file explicitly. `spike/bin/harness.js`, the lint portion of `spike/src/engine.js`,
`spike/src/lint.js`, and both `harness.yaml` files belong to `Q0033-cli-lint-config`; both
`review.yaml` copies, both `code-reviewer.md` copies and the four docs belong to
`Q0033-assets-docs`. The two sets are disjoint, and each description names the other's files in
its prohibition list, which is the belt-and-braces the broad `backend` role allowance needs.
`README.md` is correctly dropped from the inherited description, and the Q-0006 ticket-body clause
with it.

**M1 — mock switches referenced by no task.** Closed.
`contracts/Q-0006/mock-adapter-switches.contract.md` is in both tasks' `contracts:` lists, and the
evidence clause now names both traversals with their terminal stages: `green -> red` through
`targetFlow.consumes` under `MOCK_ALWAYS_FAIL`, `green -> reviewed` under `MOCK_ALWAYS_PASS`. I
traced both as feasible. The switches touch only steps whose schema contains `verdict`, so the
panel steps are unaffected and only the judge is forced; the first forced `changes-requested`
increments `review` to 1, which is inside the bound of 3, so it regresses rather than exhausting;
and `development.consumes` is `red`, so the derived stage in the assertion is right.

**M2 — unborn HEAD.** Closed, and closed in the right direction.
`cli-review-surface.contract.md` now reads "An unborn HEAD whose current branch Git can name is a
discovery success. Outside Git, or for detached, unborn, or other HEAD states whose current branch
Git cannot name, discovery is best-effort". `git init -b master` followed by `harness init` now
has one defined answer, and it is `master`. That is the case that decides whether an adopter's
first integrate dies at `engine.js:411`.

**M3 — comment preservation.** Closed. The contract requires the edit to preserve "the copied
YAML's comments and formatting, including the one-line comments on both `repo` keys and the
existing `commands.install` comment", the design names `YAML.parseDocument` + `setIn` + `toString`
or a narrow textual replacement, and the evidence list names a surviving comment. The rejected
alternative explains why the obvious implementation passes a parsed-value test while destroying
the file.

**M4 — the retry value.** Closed, and this is the fix that mattered most. The value now appears
literally in `cli-review-surface.contract.md`: "`retry` persists `iterations.review =
max_iterations`, which is `3` for the shipped limit … a test expecting `2` is incorrect." That
sentence is inlined verbatim into every task prompt by `taskPromptSection`, which is the delivery
mechanism the round-1 finding was actually about. `errata.md` is added to both tasks'
`contracts:` lists; I confirmed the path
`backlog/Q-0006-review-flow-and-cross-flow-backward-edge/solution/errata.md` resolves, and that
`taskPromptSection` reads contract paths relative to the worktree root, so a backlog path works
exactly like a `contracts/` path.

**N1 — unscoped flag accumulation.** Closed: "Only `--gate-answer` becomes accumulating and
repeatable; all other flags keep their current last-wins behavior."

**N2 — the pinned baseline in a shallow clone.** Closed: the guard skips with a printed reason
naming `5d16e06` rather than surfacing a git error or claiming parity was checked.

## What I checked independently

I re-verified the facts the design rests on, because a solution that is right for the wrong reason
fails on the next ticket.

- **The flow-parity rule is true today.** `diff -rq harness/flows spike/templates/harness/flows`
  is empty across all four flows, including `development.yaml`, which `Q0033-assets-docs` is
  forbidden to edit. So the new parity test cannot demand a change to a file no task owns.
  `diff -rq harness/roles spike/templates/harness/roles` is *not* empty — `developer-backend.md`
  differs and `developer-tooling.md` is repo-local — which is exactly why scoping the role rule to
  `code-reviewer.md` alone is correct rather than lazy.
- **The shipped `review.yaml` passes both cross-vendor rules.** The existing verdict rule at
  `engine.js:44-49` builds `producer` from `writesOf`, so the judge's two named panel inputs map
  to `claude` and `codex`; `every` is false and the rule passes. The new panel rule sees one
  parallel group of two `code-reviewer` steps spanning two adapters. `requirements.yaml`'s
  `pm-claude`/`pm-codex` group also spans two, so the new rule adds no failure to the shipped set.
- **The return chain resolves both ways.** `development` produces `green`, which is `review`'s
  `consumes`, so the walk terminates on its first hop. `review → qa-red` walks `red → development
  → green`. `review → review` walks to `reviewed`, which no shipped flow consumes — a dead end,
  and the named negative fixture. The `(flow, stage)` visited set is what keeps that true when
  Q-0012 gives `reviewed` a consumer.
- **Serialising the two tasks cannot strand the integrate step.** `runFanOut` merges a wave into
  the ticket branch between waves but runs no test command there; only the separate `integrate`
  step runs `commands.test`, and it runs after every wave. So wave 1 landing the lint rules while
  `review.yaml` is still absent is not observable to any assertion.
- **The board claim matches the code.** `handleFail` calls `recordEvent(…, 'exhausted', 0)` and
  `finish` appends the terminal entry with `round(ctx.stats.cost)`; `board` sums `h.cost` across
  history. Zero plus the measured cost is the run's cost, counted once. The contract's "no
  production change" is correct.
- **Criterion coverage.** 1, 2, 3 (asset half) and 13 → `Q0033-assets-docs`. 4–10 →
  `Q0033-cli-lint-config`. 11 and the test halves of 1–3 → qa-red, by contract. 12 → the closing
  gate. No criterion is orphaned, no task lacks a contract, and both non-task homes are the ones
  the round-1 findings demanded.
- **QA can start today.** `write-tests` receives `qa/scenarios.md`, `solution/tasks.yaml`,
  `harness/architecture.md` and the repo — and `contracts/Q-0033/**` is in the repo, so the
  evidence checklist and the literal `3` reach the QA agent without depending on `solution.md`
  being an input. That was the failure mode M4 described, and it is now closed at the file level.

## Carry into implementation

None of these changes the design or justifies another round. They are the four places where a
compliant implementer could still guess, and I would rather they be settled in the commit than in
a review.

1. **Say whether "exact words, no prefixes" governs the interactive prompt.** `draft.md:70` and
   the contract's gate-answer section scope accumulation to `--gate-answer` but leave the
   normalisation rule's reach unstated. `harness.js:71` currently accepts `a`, `adv`, `r` typed at
   a TTY. Read literally, criterion 10 ("not one of the three words … exits non-zero") applies to
   any answer source, which would turn a maintainer typing `a` into a lost run mid-flow. Two
   implementations satisfy the contract and disagree. My recommendation: exact words for
   `--gate-answer`, and keep the interactive prompt forgiving — it re-prompts a human, it does not
   silently invent an answer, which is the property criterion 10 exists to protect.
2. **Name `spike/test/smoke.js:82-85` in the qa-red guidance.** Criterion 11 names it; the
   evidence clause covers it only through the generic "Tests requiring a gate provide explicit
   answers". The blast radius is small — the assertion reads `loop exhausted`, which `handleFail`
   prints before `runGate`, so it survives either way — but it is the one place the requirement
   pointed at by line number, and only qa-red is permitted to touch it.
3. **The serialisation rationale describes a mechanism that does not exist.** `draft.md:91` says
   serial execution "avoids parallel integration diagnosing a temporarily absent review flow".
   There is no intermediate test run under either ordering, so parallel would not have produced
   that diagnosis. The real reason is better and goes unstated: both tasks are `role: backend`,
   the backend role's write allowance covers `spike/`, `harness/` and `docs/` in full, and running
   them concurrently would put each agent's files inside the other's permission set with only a
   task description separating them — which is round-1's B3 restated as a scheduling risk. Serial
   is the right call; the sentence justifying it should be the true one, because the next ticket
   will copy it.
4. **The Tasks YAML block omits the `tasks:` key.** Q-0006's `solution.md:237` opens its block
   with `tasks:`; `draft.md:176` opens with `- id:`. The `tasks` step normalises this before
   `tasks.yaml` is written, so the happy path is fine — but `loadTasks`'s fallback keys on
   `/^tasks:/m` in `solution.md`, and `finalize` is instructed to keep the Tasks section verbatim,
   so the fallback would not fire if `tasks.yaml` were ever missing. One line, worth matching the
   established shape.

## Not changed, and should not be

The lint design, the preflight-before-override ordering, the parity scoping, the frozen-input
guard, and everything under `contracts/Q-0006/`. The rejected-alternatives section grew and is
still the strongest part of the document — in particular the three entries added this round
(comment-destroying `parse`/`stringify`, categorical unborn-HEAD fallback, and the shallow-clone
guard failure) each name a plausible implementation and say why it is wrong, which is what makes
them useful to the agent that will read them.

I would be on call for this.
