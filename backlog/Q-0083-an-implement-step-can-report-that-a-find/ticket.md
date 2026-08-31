---
id: Q-0083
title: An implement step can report that a finding demands what it may not do
stage: draft
owner: ruud
repos: []
branch: harness/Q-0083/integration
priority: p3
created: 2026-08-30
iterations: {}
history: []
---
chore.yaml's implement step has no verdict, so an implementer that refuses a review finding on charter grounds can only say so in prose nobody reads until the gate. Give it a verdict — proceed or blocked — where blocked routes to a gate instead of another revise round, and decide what the engine does with it. Named as the owed mechanism by the 2026-08-31 decision entry.

Opened 2026-08-31, named as the owed mechanism by *"A refused finding is a gate, not another
round"* (`docs/DECISIONS.md`, 2026-08-31). That entry rules the interim — the human gate carries
the obligation — and says in as many words that the ruling is interim **because** this ticket is
what makes a refusal visible to the engine rather than to prose. Belongs to M2 in
`docs/06-development-plan.md`.

## The gap

`chore.yaml`'s `implement` step declares `output.writes` and **no `verdict`**. Its `review` step
declares `verdict: approve|revise`. So the reviewer can stop the loop and the implementer cannot,
and an implementer that has concluded *this finding demands something I am not permitted to do* has
exactly one channel: prose in `dev/implement-report.md`, which the next reviewer reads and the human
does not see until the final gate.

The refusals in question are not disagreements about the code. They are appeals to an authority the
reviewer cannot overrule: charter §2's preservation rule; a `docs/decisions/` entry only the human
may write; a surface outside the role's write paths, which the engine reverts anyway.

## What it must decide

1. **The verdict's shape.** `proceed | blocked` is the obvious pair. Whether `blocked` needs to name
   its authority as a separate field, or whether the report is enough, is open — a free-text reason
   is unvalidatable, and an enum of authorities goes stale.
2. **What the engine does with it.** The gate must be one a human answers, and the useful answers
   are not the same as an exhaustion gate's: `advance` (the refusal stands, integrate as is),
   `override` (the finding is right, do it) and `abort` are three, and `retry` is meaningless here
   because nothing has changed. Whether this reuses the gate kind or needs a new one is the
   design.
3. **Whether the same applies to other step kinds.** `review` can already stop. Fan-out members and
   `integrate` have their own failure paths. The question is whether `blocked` is an `agent`-step
   property or a `chore`-flow one.

## What it must not do

**Let an agent write the erratum.** A `blocked` verdict routes to a human; it does not authorise the
step to amend a criterion. The erratum stays the human's, per *"An erratum is the last repair, not
the first"* (2026-08-30).

**Give the implementer a way to refuse work it simply finds hard.** The verdict is for an authority
appeal, and a flow lint or a schema cannot tell one from the other. That is an argument for keeping
the gate human rather than for validating the reason, and it should be stated in the requirement
rather than discovered in review.

**Land in one tree.** `chore.yaml` exists in `harness/flows/` and `spike/templates/harness/flows/`,
and the engine change touches `spike/src/engine.js` and `packages/core/src/engine/`. The freeze SHA
is recorded, so a `spike/src` change re-records it in the same commit and wants a row in
`harness/port-charter.md` §3.

## The evidence

Q-0052's chore run, recorded in `backlog/Q-0052-…/review/chore/run-2/` and ruled in that ticket's
`requirements/errata.md` E-1. Round 2's implementer refused correctly and had nowhere to say so;
round 3 yielded and deleted the pin recording the divergence; round 3's reviewer approved the
deletion. Three rounds in about an hour, unattended.

**Sequencing.** Runs after the port's remaining children (Q-0053, Q-0054) unless it is judged to
protect them, which is the Q-0057 argument and is a real question rather than a rhetorical one:
those two children run this exact flow. Weigh it at the requirements gate rather than assuming
either answer.

- **Depends on:** nothing · **Blocks:** nothing
- **Non-goals:** `route` and the qa-final sketch (Q-0056); the exhaustion gate's own semantics;
  `max_iterations` tuning, which the 2026-08-31 entry considered and rejected.
