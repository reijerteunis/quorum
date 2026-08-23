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
---
Everything a run knows today dies with the terminal it printed to. `runs.log` keeps one line per
step and the ticket keeps a cost per run, but the traces, the prompts, the per-vendor token
counts and the reason a step failed are gone the moment the process exits — which is why the
$4.54 lost in the Q-0006 crash could not be recovered, and why nobody can answer "what did this
ticket actually cost, per vendor" without reading a scrollback. This ticket puts a run's history
on disk under `.quorum/runs/<id>/`: prompt and output files per attempt, plus a manifest whose
roll-up reports money where a vendor reports money and tokens where it does not, per the
tokens-only decision. It splits cleanly along a boundary this repository has not yet exercised —
the engine writes the history, the CLI reads it back for a human — which is why it is M1's
dogfood ticket instead of Q-0006: two roles on two vendors, on genuinely disjoint files, which is
what M1's definition of done asks the fan-out to demonstrate. The executable contract is the run
manifest schema, validated against a real artifact. The 2026-08-23 scope cut in
`requirements/merged.md` removes the event stream; `solution/errata.md` resolves the two surviving
requirement ambiguities and is normative for QA and development. Belongs to M1 in
docs/06-development-plan.md, pulled forward from M2.
