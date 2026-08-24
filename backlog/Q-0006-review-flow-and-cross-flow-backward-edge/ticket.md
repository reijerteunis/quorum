---
id: Q-0006
title: Review flow — engine, counters and the backward edge
stage: green
owner: ruud
repos: []
branch: harness/Q-0006/integration
priority: p2
created: 2026-08-22
iterations:
  solutioning.architecture-review: 3
  qa-red.scenario-review: 1
  development.integrate: 0
  review: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    at: 2026-08-22T16:51:48.368Z
    cost: 4.146
  - stage: requirements
    run: 3
    flow: architect-only
    at: 2026-08-22T18:05:23.532Z
    cost: 0
  - stage: solutioned
    run: 4
    flow: solutioning
    at: 2026-08-22T18:46:11.606Z
    cost: 3.887
  - stage: red
    run: 8
    flow: qa-red
    at: 2026-08-22T21:52:29.658Z
    cost: 9.094
  - stage: green
    run: 9
    flow: development
    at: 2026-08-22T22:06:04.194Z
    cost: 0
  - stage: red
    run: 10
    flow: review
    status: regressed
    stage_before: green
    stage_after: red
    at: 2026-08-23T23:11:00.940Z
    cost: 5.023
  - stage: red
    run: 11
    flow: development
    status: failed
    stage_before: red
    stage_after: red
    at: 2026-08-23T23:31:00.423Z
    cost: 0
  - stage: green
    run: 12
    flow: development
    status: completed
    stage_before: red
    stage_after: green
    at: 2026-08-23T23:45:50.678Z
    cost: 0
---
The seven-stage SDLC has no review stage yet: a ticket reaching `green` has passing tests but
nobody has read the diff. This ticket adds `review.yaml` — a panel of reviewers on different
vendors reading the integrated branch, followed by a verdict step that either advances the
ticket to `reviewed` or sends it back to development. The interesting part is the way back:
a backward edge that crosses a flow boundary (`goto: flow:development`) and therefore has to
regress the ticket's stage from `green` to `solutioned`, bounded by `max_iterations` with a
counter persisted on the ticket and a human gate when it is exhausted. It is the first place
where the loop the review stage exists for meets the safety rule that no loop may run
unbounded on a user's subscription. Belongs to M1 in docs/06-development-plan.md.

**Split 2026-08-22, before development.** This ticket carried 30 acceptance criteria and hit its
iteration bound at every stage; the ticket-size decision of the same date says a requirement that
large is split rather than carried forward. Q-0006 now owns the **engine half** — everything
under `spike/src/`: the `{round}` variable and round numbering, diff materialisation into the
prompt, derived regression across the flow boundary, counter persistence, retry and exhaustion
semantics, rework worktree sync, audit and failure containment, and the mock switches the tests
need. The **surface half** — the CLI, lint rules, config keys, the shipped `review.yaml` and
`code-reviewer` role, README and docs — moved to Q-0033, which depends on this one.

The requirement, solution and contracts in this folder still describe both halves and are not
re-cut: they are the shared design, and Q-0033 consumes them as input. What changed is
`solution/tasks.yaml`, which now fans out only the two engine tasks; the pre-split file is kept
beside it as `tasks-before-split.yaml`. Recorded as E-2 in `solution/errata.md`.
