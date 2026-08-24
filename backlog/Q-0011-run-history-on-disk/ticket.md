---
id: Q-0011
title: Run history on disk with per-vendor roll-up
stage: red
owner: ruud
repos: []
branch: harness/Q-0011/integration
priority: p1
created: 2026-08-22
iterations:
  solutioning.architecture-review: 2
  qa-red.scenario-review: 1
  review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-22T23:14:13.255Z
    cost: 5.024
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-22T23:56:35.954Z
    cost: 0
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T00:11:53.693Z
    cost: 0
  - stage: requirements
    run: 2
    flow: solutioning
    status: aborted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T00:14:05.733Z
    cost: 13.908
  - stage: requirements
    run: 3
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T00:52:33.963Z
    cost: 0
  - stage: requirements
    run: 3
    flow: solutioning
    status: aborted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T00:55:04.306Z
    cost: 10.216
  - stage: requirements
    run: 4
    flow: architect-only
    status: completed
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T00:59:06.177Z
    cost: 0
  - stage: requirements
    run: 5
    flow: solutioning
    status: aborted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-23T01:18:15.146Z
    cost: 3.624
  - stage: solutioned
    run: 5
    flow: solutioning
    status: completed
    stage_before: requirements
    stage_after: solutioned
    at: 2026-08-23T01:20:54.000Z
    cost: 0
  - stage: solutioned
    run: 6
    flow: qa-red
    status: failed
    stage_before: solutioned
    stage_after: solutioned
    at: 2026-08-23T08:26:29.075Z
    cost: 1.21
  - stage: solutioned
    run: 7
    flow: qa-red
    status: exhausted
    stage_before: solutioned
    stage_after: solutioned
    at: 2026-08-23T11:34:36.680Z
    cost: 0
  - stage: solutioned
    run: 7
    flow: qa-red
    status: aborted
    stage_before: solutioned
    stage_after: solutioned
    at: 2026-08-23T11:36:38.434Z
    cost: 8.338
  - stage: red
    run: 8
    flow: qa-red
    status: completed
    stage_before: solutioned
    stage_after: red
    at: 2026-08-23T12:42:33.679Z
    cost: 8.499
  - stage: red
    run: 9
    flow: development
    status: interrupted
    stage_before: red
    stage_after: red
    at: 2026-08-23T13:43:42.509Z
    cost: 4.745
  - stage: red
    run: 10
    flow: development
    status: exhausted
    stage_before: red
    stage_after: red
    at: 2026-08-23T14:30:00.355Z
    cost: 0
  - stage: red
    run: 10
    flow: development
    status: aborted
    stage_before: red
    stage_after: red
    at: 2026-08-23T14:35:17.193Z
    cost: 8.628
  - stage: green
    run: 11
    flow: development
    status: completed
    stage_before: red
    stage_after: green
    at: 2026-08-23T14:48:59.621Z
    cost: 1.228
  - stage: red
    run: 12
    flow: review
    status: regressed
    stage_before: green
    stage_after: red
    at: 2026-08-24T19:12:46.394Z
    cost: 6.651
  - stage: red
    run: 13
    flow: review
    status: regressed
    stage_before: green
    stage_after: red
    at: 2026-08-24T19:41:54.654Z
    cost: 5.95
---
Everything a run knows today dies with the terminal it printed to. `runs.log` keeps one line per
step and the ticket keeps a cost per run, but the traces, the prompts, the per-vendor token
counts and the reason a step failed are gone the moment the process exits — which is why the
$4.54 lost in the Q-0006 crash could not be recovered, and why nobody can answer "what did this
ticket actually cost, per vendor" without reading a scrollback. This ticket puts a run's history
on disk under `.quorum/runs/<id>/`: a manifest describing the run, the prompt and output of every
step attempt, and a
roll-up that reports money where a vendor reports money and tokens where it does not, per the
tokens-only decision. It splits cleanly along a boundary this repository has not yet exercised —
the engine writes the history, the CLI reads it back for a human — which is why it is M1's
dogfood ticket instead of Q-0006: two roles on two vendors, on genuinely disjoint files, which is
what M1's definition of done asks the fan-out to demonstrate. It should also produce the first
contract the repository can execute end to end, now that `harness validate` exists: an events
schema that qa-red can fail a real artifact against. Belongs to M1 in
docs/06-development-plan.md, pulled forward from M2.
