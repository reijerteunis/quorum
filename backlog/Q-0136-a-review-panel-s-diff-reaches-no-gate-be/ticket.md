---
id: Q-0136
title: A review panel's diff reaches no gate, because the deciding step is not
  the one that read it
stage: draft
owner: ruud
repos: []
branch: harness/Q-0136/integration
priority: p2
created: 2026-09-17
iterations: {}
history: []
---
On review.yaml the gate screen shows no diff: the deciding step is verdict, which reads none by design, while the two panel members read the diff and declare no verdict. Found by Q-0134's GO-5.

**M3**, opened 2026-09-17 at Q-0134's close, from what its **GO-5** demonstration measured. p2.

**The measurement, made by running the product rather than reading it.** Q-0134 serves the gate
screen the diff its **deciding** step was given — AC-2's model, and correct on `chore.yaml`, where
one step both reads the diff and declares the verdict. On `review.yaml` the deciding step is
`verdict`, whose `input` is the panel's two reports and **no diff at all**, and whose own instruction
reads *"Judge the reviews, not the code diff."* The steps that read the diff are `review-claude` and
`review-codex`, and neither declares a verdict.

So at a `review` flow's gate the screen renders *"The step whose decision reached this gate was given
no diff"* — **true, honest, and the flow named for reviewing a change shows none of it.**

**This is not Q-0134's defect and must not be filed as one.** Q-0134's implementation matches its
criterion; the criterion's model is what is too narrow, and it was too narrow because the flow it was
measured against — 89% of this repository's history — is the one where the two roles coincide.

**What it must decide, and the hard part is not the plumbing.** `review.yaml`'s panel is **two**
members reading the **same** range. So *"show the panel's diff"* is well defined by **range** and
ambiguous by **step**, and the options are not equivalent:

- serve the evidence of the nearest step that read one, which needs a rule for *nearest* that a
  `parallel:` group does not supply;
- serve it keyed by **range** rather than by step, which is identity for this flow and silently
  merges two members whose ranges could differ in a flow nobody has written yet;
- have the gate carry more than one evidence record, which changes the wire and the route;
- or rule that this is correct and the screen should say *why* it has none here, which costs nothing
  and may be the honest answer.

**Measure before choosing**, and measure what a `parallel:` group actually produces: Q-0129 found
that **no shipped flow declares a verdict on a `parallel:` member** — re-derived by parsing all six
flow files, because a grep across whole files reports two that do — so any rule keyed on *the member
that decided* has no subject today and would be written blind.

**Two constraints that already hold and are not this ticket's to revisit.** The evidence does not
travel on the event union — `contracts/Q-0050/run-events.contract.md` carries the note and the reason
is size and replay, 200,000 B against a 214 B mean event. And the route accepts only the opaque
`gateId`, never a range, ref, path or step id from the browser.

**Q-0135 is its sibling in kind rather than in subject**: both are halves the first pass measured
and deferred rather than defects.

*Re-measure before writing anything. Q-0134's own body had a claim wrong by one — the chore gate is
two steps after the review, not three — and this repository has moved a cited line number under four
consecutive tickets.*
