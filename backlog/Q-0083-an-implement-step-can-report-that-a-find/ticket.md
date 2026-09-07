---
id: Q-0083
title: An implement step can report that a finding demands what it may not do
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0083/integration
priority: p3
created: 2026-08-30
iterations: {}
history: []
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

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

## After the cutover — corrected 2026-09-07

**Void: the whole of *Land in one tree*.** There is one tree. `chore.yaml` exists at
`harness/flows/chore.yaml` and `packages/cli/templates/harness/flows/chore.yaml` — Q-0093 moved the
template copy out of `packages/templates` — and the engine change is `packages/core/src/engine/`
alone. There is no freeze SHA and no charter §3 row.

**Void: *Sequencing*. This ticket is unblocked.** Q-0053 and Q-0054 both closed on 2026-08-31, so the
question of whether it runs before them to protect them cannot be asked. Nothing sequences it now.

**The gap, re-measured.** `harness/flows/chore.yaml:6` is `implement` with `output.writes` and no
verdict; `:27` is `review`, whose `:35` declares `verdict: approve|revise`. Unchanged, in both copies.

**The evidence is no longer one run — the pattern has been priced three more times since, with
numbers.** The body rests on Q-0052's chore run. What has happened since:

- **Q-0091** — rounds 2 and 3 cost **$14.28** holding refusals that were right the first time, and
  round 3 changed **no files at all**, byte-identical to round 2's commit. The plan records it as the
  eleventh appearance and the first where the cost was written down.
- **Q-0101** — rounds 3, 4 and 5 cost **$31.16** on two blockers no step on the route could clear,
  round 3 again changing no files. Twelfth and thirteenth.
- **Q-0103** — the implement step refused four majors **three times each**, correctly: none of the
  four surfaces was in `developer-generalist`'s `paths:`. Fifteenth.
- **Q-0102** — parked rather than launched, because no step in the requirements flow can produce a
  failure rate. Sixteenth, and **the first recognised before the money was spent**.

**So the measured waste attributable to this ticket's absence is at least $45.44 across two tickets**,
in rounds that changed nothing, and the mechanism is named as owed by a decision entry. That is a
stronger case than the body carries and it should be the requirement's opening measurement.

**Everything else stands**: the three things it must decide, the two things it must not do — an agent
may not write the erratum, and the verdict must not become a way to refuse work an agent merely finds
hard — and the non-goals.
