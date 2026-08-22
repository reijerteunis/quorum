---
id: Q-0006
title: Review flow with cross-flow backward edge
stage: solutioned
owner: ruud
repos: []
branch: harness/Q-0006/integration
priority: p2
created: 2026-08-22
iterations:
  solutioning.architecture-review: 3
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
