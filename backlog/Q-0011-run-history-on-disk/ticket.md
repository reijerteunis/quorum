---
id: Q-0011
title: Run history on disk with per-vendor roll-up
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0011/integration
priority: p1
created: 2026-08-22
iterations: {}
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
---
Everything a run knows today dies with the terminal it printed to. `runs.log` keeps one line per
step and the ticket keeps a cost per run, but the traces, the prompts, the per-vendor token
counts and the reason a step failed are gone the moment the process exits — which is why the
$4.54 lost in the Q-0006 crash could not be recovered, and why nobody can answer "what did this
ticket actually cost, per vendor" without reading a scrollback. This ticket puts a run's history
on disk under `.quorum/runs/<id>/`: an events file per step, a manifest describing the run, and a
roll-up that reports money where a vendor reports money and tokens where it does not, per the
tokens-only decision. It splits cleanly along a boundary this repository has not yet exercised —
the engine writes the history, the CLI reads it back for a human — which is why it is M1's
dogfood ticket instead of Q-0006: two roles on two vendors, on genuinely disjoint files, which is
what M1's definition of done asks the fan-out to demonstrate. It should also produce the first
contract the repository can execute end to end, now that `harness validate` exists: an events
schema that qa-red can fail a real artifact against. Belongs to M1 in
docs/06-development-plan.md, pulled forward from M2.
