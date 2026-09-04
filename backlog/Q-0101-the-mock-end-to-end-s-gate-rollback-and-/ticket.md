---
id: Q-0101
title: The mock end-to-end's gate, rollback and register half
stage: draft
owner: ruud
repos: []
branch: harness/Q-0101/integration
priority: p2
created: 2026-09-04
iterations: {}
history: []
---
**Split from Q-0095 at its requirements gate on 2026-09-04**, where the head-of-product loop
exhausted at limit 1 with the split as its first blocker. Q-0095 keeps the **spawn harness and the
green chain** (§3.1, eleven criteria) and runs first; this ticket takes the **failure, gate and
rollback paths** (ten criteria). The seam is **by scenario independence, not by command** — the
parent correctly refused a per-command cut, because `smoke.js`'s binary half does not partition that
way, which is the admitted weakness of Q-0010's whole seam.

**The body below is §3.2 of
`backlog/Q-0095-the-mock-end-to-end-suite-runs-against-t/requirements/merged.md`, transcribed in
full rather than referenced**, because `input.backlog` resolves against **this** folder and nothing
injects a sibling's document into this ticket's run. That document's Appendix A (the 158 assertion
sites, classified) and Appendix B (the three register clauses and which half moves each) are this
ticket's background.

## Why this ticket must exist before Q-0095's chore run, and not after

**`packages/core/src/spike-parity.test.ts:1617` and `:1694` assert
`REGISTER['q0033-surface.js'].binaryHalf` `.toMatch(/Q-0095/)`.** If Q-0095 closed carrying only the
chain half, those clauses would go on naming a **closed** ticket as owing work — the exact
contradiction Q-0091's erratum E-2 created `binaryCarriedBy` to make impossible, running in the
opposite direction. Q-0095's AC-10 re-aims them at **this id**, which is why the folder was created
at that gate rather than at this ticket's start: an implement step cannot allocate one, and
`backlog/` is not an agent-writable surface.

That is the same class as Q-0062's GO-1, where the requirement named the hazard in advance, the run
was launched without the artifact anyway, and three implement rounds went on a blocker no step on
the route could clear.

**AC-1 — The exhaustion gate, its exit code and what it kept.**
`--auto` does not walk through a human-locked exhaustion gate; the run says which gate it could not
answer and what it kept; it exits **3** and not merely non-zero (`smoke.js:113`–`:121`).
*Test:* exit 3 asserted as `=== 3`, never as `!== 0` — the spike's own comment says why.

**AC-2 — An unanswered non-TTY gate is `undecided`.**
It is recorded `undecided` in `runs.log`, is not recorded as `failed`, rolls nothing back, does not
advance the stage and does not refund its iteration counter (`smoke.js:259`–`:267`).

**AC-3 — `retry` grants exactly one further traversal.**
Three `step=head-of-product` lines, `gate=retry counter=requirements.head-of-product set=1`, the loop
ending one past its limit, and an unrelated counter untouched (`smoke.js:234`–`:245`).

**AC-4 — The failed parallel sibling, its cost and run-id uniqueness.**
A failed parallel branch fails the run; the surviving sibling keeps its output at
`requirements/run-1/candidate-codex.md`; **the negative assertion searches `requirements/`
recursively** for `candidate-claude.md` rather than testing one path; the failure is recorded in
`runs.log` and does not advance the stage; a failed step records what it cost and the run's cost
includes it; the next attempt gets its own run id (`smoke.js:141`–`:162`).

**AC-5 — Both re-aimed assertions are demonstrated red against a deliberately broken binary, and the
evidence names the break.**
Before the final green run: one injected break causes the expected run-scoped candidate not to be
found, and one causes a failed parallel sibling's candidate to be found recursively. The recorded
verification identifies **each test, its injected break, and the resulting failing assertion**. **A
process that fails to start, an unrelated process failure, or a different earlier assertion failing
does not count as the red witness.** The break lives in the isolated copy or the mutation procedure
and is never committed as product behaviour.
*Why this is its own criterion:* the single-path form went green the moment Q-0088 moved the file,
proving the writer had failed only by accident. A translation that re-flattens either one re-opens
that hole **and passes**.

**AC-6 — Rollback (a): the abandoned merge.**
A failing `integrate` with no `on_fail` aborts the run, leaves the ticket branch at exactly the SHA it
started from, removes the abandoned merge so the next red phase measures a clean base, leaves the work
intact on its own branch, and records `rolled-back branch=` in `runs.log` (`smoke.js:359`–`:365`).

**AC-7 — Rollback (b): the base-sync conflict.**
It fails the run, names the two branches, says re-running the developers cannot fix it, **does not
consume the iteration budget**, and is distinguishable in `runs.log` as `base-conflict base=`
(`smoke.js:394`–`:398`). Base-sync reporting read off the solutioning run's stdout is asserted with it
(`:317`–`:319`).

**AC-8 — `q0033-surface.js` S3.2/S3.3: the shipped review flow traverses both paths.**
Over the shipped `review.yaml`, both rows: `MOCK_ALWAYS_FAIL` + `--gate-answer abort` ends at
`stage: red` with a changes-requested/development/red word in the output; `MOCK_ALWAYS_PASS` +
`--gate-answer advance` ends at `stage: reviewed`, says `approve`, and writes `review/verdict.md`.
Both exit 0 (`spike/test/q0033-surface.js:170`–`:181`).
*Note:* this scenario uses the **forcing** switches, so it does not depend on the mock counter and
**may run in process** through `invoke()`. If it lives in `run.test.ts`, that file's *"Nothing here
spawns the binary"* header stays true — and note that file already drives `run review` at `:117` and
`:528`, the latter a stage-mismatch refusal that traverses no step.

**AC-9 — The shipped-template model pin is re-homed rather than lost.**
`packages/cli/src/templates.test.ts` asserts that no file under
`packages/cli/templates/harness/{flows,roles}` matches `/^\s*model:\s*gpt-/m`, carrying
`smoke.js:216`'s claim onto the corpus Q-0093 mirrored. That file contains zero `model` or `gpt`
matches today (verified); `capabilities.source.test.ts:65` guards a different subject.
*Test:* shown red by adding `model: gpt-5` to a template in a fixture copy.

**AC-10 — The register is completed, and the totals re-derived unmoved.**
`smoke.js`'s row names both counterparts with prose saying which claims each carries — the Q-0092
precedent, *"across two files because the assertion claims two things"* — and its `binaryHalf` stops
naming any successor; `q0033-surface.js` gains its sixth counterpart and `:1617`/`:1694` are
**inverted** to `.not.toMatch(/— <successor id>\b/)`, matching the shape those clauses already use for
Q-0093, Q-0094 and Q-0099. The five totals are re-derived and expected unchanged.
*Test:* each moved clause shown red against its superseded value first.

---

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. If a change there is genuinely required, stop and say so.
2. **The spike's own tests are not deleted or edited to make room.** `spike/test/**` keeps working
   until the cutover deletes it wholesale — which this ticket unblocks but does not perform.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059,
   Q-0060, Q-0066 and Q-0068 are open and land in both trees; Q-0100 carries the user-facing
   `harness` sentences. Do not close one here.
4. **`packages/core` already holds the logic.** Look there before porting anything.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   **re-derived rather than adjusted**, and using `binaryCarriedBy` (Q-0091 E-2) rather than a
   fourth verdict.

## Gate obligations

**GO-1 — Q-0095 must be `reviewed` before this ticket's chore run.** It lands the spawn harness this
ticket's scenarios ride on, and re-aims the two register clauses at this id. Running the two
concurrently is refused for a second reason: Q-0039 is unfixed, so two runs on one ticket share a
worktree and compute the same run id.

**GO-2 — `harness/Q-0101/integration` must exist before the first chore run**, per
`docs/02-sdlc-pipeline-spec.md` §5.8: `review` diffs against that branch and only `integrate`, which
runs later, creates it.

**GO-3 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on has
no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31); the remedy is
an erratum written **during** the loop, and **the window for one is a gate** — landed between a
review returning and the next implement starting, it reaches neither (Q-0094 E-3(a)).

**GO-4 — the cutover is the successor to this ticket and still has no ticket.** Deleting `spike/`,
retiring its CI job and retiring `harness/port-charter.md` is Q-0010 §5's follow-up. It should be
allocated at **this** ticket's close rather than remembered.

## Non-goals

- The spawn harness and the green chain — **Q-0095's**, and it runs first.
- Deleting `spike/` or retiring its CI job — the cutover's, per GO-4.
- Any change to `spike/`.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, split from **Q-0095**.
