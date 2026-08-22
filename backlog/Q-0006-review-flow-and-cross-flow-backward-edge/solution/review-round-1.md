# Q-0006 — Architecture review of `solution/draft.md` (round 1) — findings only

**Verdict: revise.** Four blockers, five majors, five minors.

> **Note on provenance.** The full round-1 review document was overwritten by round 2: the
> `architecture-review` step writes to the fixed path `solution/review.md` every traversal, so a
> bounded loop destroys its own audit trail. What follows is the round-1 `findings` array exactly
> as the step emitted it, recovered from the run output. This is the same failure class that
> `requirements/merged.md` predicted for review rounds (D2 / AC-8) — here it has happened for
> real, in solutioning, one flow earlier.

## Blockers

1. All four tasks use `role: backend`, but `harness/roles/developer-backend.md:3` declares `paths: [services/api, packages/domain]` and its body plus `development.yaml`'s fan-out instruction ("Do not touch files outside your role's allowed paths") forbid every file this ticket touches (`spike/**`, `harness/**`, `docs/**`). No other role covers them either. `paths` is prompt-only (nothing in `spike/src/` reads it), so a compliant agent stops and reports a blocker while a non-compliant one writes outside its declared boundary. Q-0006 must own filling the "Roles for task fan-out" table in `harness/architecture.md` (still an unedited template) and widening `developer-backend.md` + its template copy.

2. `Q0006-regression-suite` makes a development agent write `spike/test/smoke.js`, which `development.yaml` explicitly forbids ("Do not modify tests") and which `qa-red`'s `write-tests` step already owns; `depends_on` on the other three tasks also puts the red phase last. Move AC-27/29 out of `tasks.yaml` into qa-red scenarios, and split AC-28's `MOCK_ALWAYS_PASS` switch — production code in `spike/src/adapters/mock.js` that QA may not touch — into its own dependency-free development task whose contract names the switches and their precedence when both are set.

3. The claim that the first three tasks have disjoint ownership is false. `Q0006-cli-lint` must change per-flow lint rules (`max_iterations > 0`, counter spelling, same-role panel adapters) that live in `lintFlow` (`spike/src/engine.js:21-56`) and must change `--auto` exhaustion handling in `runGate`/`handleFail` (`engine.js:187-209`) — both inside `spike/src/engine.js`, owned by `Q0006-runtime`. `harness/harness.yaml` and its template copy are claimed by both `Q0006-cli-lint` and `Q0006-assets-docs`. Extract lint into a `spike/src/lint.js` owned by one task and give the config files a single owner, or merge the tasks and drop the parallelism claim.

4. `contracts/Q-0006/ticket-review-state.schema.json` requires history entries to carry `run, flow, status, stage_before, stage_after, at, cost` and drops `stage`, but `finish()` writes `{stage, run, flow, at, cost}` (`spike/src/engine.js:234`) and that is what is committed in `backlog/Q-0001-…/ticket.md` and `backlog/Q-0006-…/ticket.md`. The obvious red-phase test — validate existing tickets against the schema — fails, contradicting the requirement's "no existing ticket becomes invalid". Specify either a `stage` alias plus new-entries-only requirement, or a one-time rewrite and the task that performs it.

## Majors

5. The `exhausted` status in the state schema is unreachable and failure outcomes never reach `history`. `review-runtime.contract.md` never says when a run is *recorded* exhausted; tracing the engine, the exhaustion gate yields `completed` (advance), `aborted` (abort) or `regressed` (retry), and `finish()` appends history only for `completed`/`regressed` (`engine.js:232-235`). AC-22 needs one clause: every terminal outcome appends a history entry, and `exhausted` is recorded when the gate is presented.

6. `harness/roles/code-reviewer.md` (AC-2) has no contract, and the gap is dangerous: `resolveModel` (`spike/src/engine.js:246-251`) suppresses a role's `model` only when the role also declares a differing `adapter`. If the role copies `architecture-reviewer.md`'s shape without the `adapter:` line, the `review-codex` step receives `-m opus` — the exact Q-0001 leak DECISIONS closed, and AC-2's "pins no codex model name" does not catch it. Add a short role contract: `adapter` mandatory whenever `model` is present, blocker/major/nit taxonomy, `file:line` citation, never rewrites code.

7. AC-14's "the CLI reports the target flow, the stage before → after, and the remaining iterations" has no contract clause and no owner. The runtime contract stops at "finish with `regressed`", remaining iterations are printed nowhere today, and `bin/harness.js` belongs to `Q0006-cli-lint`, whose description never mentions regression output. Name the required fields in the runtime contract and assign the line.

8. The coverage table claims "AC 1–9 are implemented and tested against the flow fixture and artifact schema", but AC-7's severity threshold is prose in the step's `instructions` and the mock derives its verdict from a per-role call counter (`spike/src/adapters/mock.js:62-66`), so no deterministic test can exercise it. State what the red-phase test actually asserts (instruction text present in the shipped flow; schema rejects an `approve` carrying findings) and record real-CLI evidence per Open question 3.

9. `review-lint.contract.md`'s chain walk is under-specified three ways: no visited-set, so a stage cycle (`A: x→y`, `B: y→x`) loops forever instead of producing AC-25's error; no error text or tie-break when two flows share a `consumes` ("the unique available flow"); and the positive case passes before taking a step, since `development.produces` is `green`, which is `review.consumes`. Name the failing case QA must test — `goto: flow:review` terminates at `reviewed`, which no flow consumes.

## Minors

10. AC-15's "`harness board` shows it" has no contract clause. `board` already prints `iter={...}` (`spike/bin/harness.js:97`); state "no change required, the test asserts the counter appears in board output" rather than leaving it implied.

11. The runtime contract gives an exact error message for a missing base ref but only says the `harness/<id>/integration` ref is "verified". Give it a message too — a review run on a ticket whose integration branch was deleted is a plausible cold-clone failure.

12. "The shipped `harness/flows/review.yaml` must be semantically identical to this document" is a judgement call, not a predicate, so AC-1's fixture test has no failing form. Define it: `YAML.parse` both, delete `file`, deep-equal.

13. All four tasks are `backend`, and `developer-backend` is `adapter: codex`, so Q-0006's own development stage runs single-vendor. Not an AC violation (`development.yaml` sets no `cross_vendor`), but M1's done-when is "two roles on two vendors fan out into worktrees" and this is the M1 dogfood run — state the intent either way.

14. `harness/architecture.md` is still the shipped template, so the "Contract conventions" and "Testing and tooling" sections that solutioning and this review take as input are placeholder prose. Filling the role table is required by B1; note the rest as a known gap so the next architect does not treat the file as authoritative.
