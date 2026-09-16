---
id: Q-0132
title: Three flows cannot read a gate ruling
stage: draft
owner: ruud
repos: []
branch: harness/Q-0132/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
A gate erratum reaches a chore run and a qa-red run and no other. solutioning, development and review read no errata file, so a ruling written at a gate is invisible to the steps it was written for.

**M3.** Opened 2026-09-16 at Q-0015's solutioning exhaustion gate, from that ticket's
`requirements/errata.md` E-10 — written when a ruling that had to reach the architect had nowhere in
the flow to go.

## Measured, by what each flow reads rather than by a filename

| flow | consumes | errata file it reads |
| --- | --- | --- |
| `chore` | `requirements` | `requirements/errata.md` |
| `qa-red` | `solutioned` | `solution/errata.md` |
| `solutioning` | `requirements` | **none** |
| `development` | `red` | **none** |
| `review` | `green` | **none** |
| `requirements` | `draft` | **none** — and correctly, a draft has no gate before it |

The two that have one read **the errata of the stage whose artifact they consume**. By that rule
`solutioning` consumes `requirements` and should read `requirements/errata.md`, exactly as `chore`
does from the same stage, and does not.

## What it costs, demonstrated rather than predicted

**Q-0015 wrote nine errata at its requirements gate and not one was readable by the flow it then
ran.** The AC-6 ruling — a criterion the architecture review correctly found unsatisfiable, whose
remedy no step in `solutioning` may perform — had to be routed to `solution/errata.md` for `qa-red`
instead, which works only because AC-6 happens to be a test-guard spelling. A ruling about a
*contract* would have had nowhere to go at all.

**Q-0120 is the corroborating instance and it is already on the record.** The only other recent
full-route ticket; its plan entry says **half its repair work was done by hand**, and its errata E-4,
E-5 and E-6 exist to say which half. That was read at the time as a consequence of *"a review verdict
can name a surface the development flow may not write"*. It is also this: the flow had no channel to
tell the next step what the gate had ruled.

## What this ticket owes before a line of code

**A measurement this body does not have**: whether `development` and `review` want the same edge, and
whether the right shape is one path listed per flow or **one derived from the stage the flow
consumes**. The second is the rule the two working flows already follow, and a derived edge is what
stops a seventh flow arriving without one — the `q0050.source.test.ts` fail-open shape Q-0051 found,
avoided by construction rather than by remembering.

**And a question the table above raises**: `requirements` reads no errata and is right not to, since
nothing gates a `draft`. So the rule is not *every flow* — it is *every flow whose consumed stage can
have been gated*, which is every flow but that one.

## Why it cannot be fixed by the run that found it

`runFlow` loads the flow at run start (Q-0057), so a run cannot benefit from a change to the flow it
is running, and an implement step editing the flow that governs its own inputs is a hazard rather
than a demonstration. Q-0057, Q-0086, Q-0087 and Q-0089 were each done by hand for this reason and
the plan records the class. **Expect this by hand, and say so at its gate rather than mid-run.**

## Non-goals

Widening what an erratum may say. Changing `chore.yaml`'s or `qa-red.yaml`'s existing edges, which
work. Adding a second channel beside errata — Q-0083's `verdict=blocked` and Q-0117's `observation:`
are the other two and neither is this. Any change to what a gate answer is.
