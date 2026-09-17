---
id: Q-0130
title: The browser starts and stops a run
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0130/integration
priority: p2
created: 2026-09-16
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-17T07:28:05.782Z
    cost: 18.22
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-17T08:43:24.079Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-17T09:00:12.232Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-17T09:28:16.054Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-17T09:59:16.993Z
    cost: 161.906
---
The app's two run-lifecycle mutations, answered once: start and stop widen the same write boundary, need the same discipline and raise the same routing question.
**M3**, split from Q-0015 at its requirements gate on 2026-09-16. The body below is Appendix A(a)
of `backlog/Q-0015-*/requirements/merged.md`, transcribed in full rather than referenced.

*Opened at Q-0015's requirements gate, 2026-09-16. p2. Runs after Q-0015.*

**Two halves, and they are one ticket because they are one boundary.** `host.start` has exactly one
production caller — `POST /runs` (`packages/server/src/http.ts:178`) — and **nothing issues it**:
`apps/web` makes one non-GET and it is the gate answer, the shell's *Run flow* control is `disabled`,
and `quorum run` calls `runFlow` from `@quorum/core` in its own process and never touches
`@quorum/server` — confirmed from the manifest side too, `apps/web/package.json` declaring
`@quorum/shared` alone. So the daemon's registry is empty on every real machine, `GET /runs` answers
`{"runs": []}` for ever, and Q-0015's mission control has nothing to show. Measured at that ticket's
gate; see its §0.9.

**Stop is here rather than in Q-0015, and the reason is measured.** A run visible in mission control
today was started by a hand `POST /runs`, and whoever can do that can hand-POST a stop — so the stop
button has no user until this ticket's first half exists. `POST /runs/:id/stop` is shipped and takes
an optional `{"reason"}`; `daemon-endpoints.ts` gains a `/stop` segment as a named constant and a
`runStopPath(handle)` beside `runGatePath`, on that function's own stated precedent — *"an exemption
that forgives a string nobody wrote would forgive nothing, so the string is written"*.
`daemon-client.ts` gains functions recognising **204 before any body is read**, as `answerGate` does,
mapping refusals by their codes rather than by status, and reporting a 2xx that is not 204 rather
than taking it for success.

**Both acts are deliberate, single and not gate answers.** Each asks for confirmation naming the
handle, because both are irreversible and this is a screen a reader leaves open; at most one is in
flight, the control being disabled while one is outstanding; and the outcome is rendered from the
daemon's answer rather than assumed. **A stop is never worded with `advance`, `retry` or `abort`** —
it cancels the run through its `AbortSignal` and is not one of the three words a gate takes.
Q-0016's blocker was exactly this class on exactly this kind of control: `load()` cleared the
in-flight guard while a POST was unresolved, so Refresh re-enabled the buttons and a second answer
could win. **It must not be found by a reviewer a second time.**

**It carries a routing decision, which is why the start half is not a button.**
`backlog-board.tsx:19–24` refused the brief's *"Run next flow ▸"* deliberately and gave the reason:
**two flows consume `requirements`** — `chore` and `solutioning` — so a single button takes the most
consequential routing choice in this product silently. What the board does instead is *name* the
flows that consume a stage. This ticket's job is to make that naming actionable: the human picks the
flow, and `--dry`, `--auto` and `--base` are each ruled in or out with a reason. `auto` in
particular: *"Human-gated by default"* is a quality pillar and a browser control that flips it is a
decision, not a checkbox.

**It widens the write boundary, and by more than an act.** `WRITE_RULES` in
`apps/web/test/source.test.ts` is the register — six needles, each with a `permitted` exemption, plus
**three** anti-vacuity clauses: `writeOffenders(true)` empty, `writeOffenders(false)` exactly the two
named modules, the permitted set exactly those two, and `'/stop'`'s `permitted` `toBeNull()` under
the message *"stopping a run became permitted"*. They move, by design, and **the `toBeNull()` clause
is replaced by one naming the module rather than removed**, which is the clause a tidy implementation
deletes. This is where the question *is this still one boundary or a family?* has to be answered
rather than deferred again, and a decision entry is likely owed. **Measure rather than assume**, and
do not re-derive it from Q-0016's comment, which was written when this app could not start anything.

Also here: the race between a stop and a run finishing — the client renders the daemon's refusal and
never infers completion from an attempted mutation.

---

*Re-measured against the tree on 2026-09-17, before the requirements run, because three consecutive
tickets had their bodies refuted by their own run. **Nine claims checked and all nine hold**, across
a shipped Q-0015 that edited three of the files this body names: `host.start` still has exactly one
production caller; `apps/web/src`'s only non-GET is still `daemon-client.ts:232`, the gate answer;
the shell's Run flow control is still disabled; `apps/web` still declares `@quorum/shared` alone;
`POST /runs/:id/stop` and `runGatePath` are still there; `WRITE_RULES` is still six needles with
`daemon-client.ts` and `daemon-endpoints.ts` the only exemptions and all three anti-vacuity clauses
present — `writeOffenders(false)`, the permitted set, and `'/stop'`'s `toBeNull()` under "stopping a
run became permitted"; the board still refuses the brief's button for the two-flows reason; and
`chore` and `solutioning` still both consume `requirements`. Nothing is corrected because nothing
was wrong. Recorded because it is the first body in this stretch to survive the check, and the
difference is visible: it was written by the flow at a gate from a merged requirement rather than by
the operator from the plan.*
