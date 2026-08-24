---
id: Q-0036
title: What `green` means, and where the code is
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0036/integration
priority: p2
created: 2026-08-24
iterations:
  chore.review: 1
history:
  - stage: draft
    run: 1
    flow: requirements
    status: failed
    stage_before: draft
    stage_after: draft
    at: 2026-08-24T20:39:24.980Z
    cost: 1.644
  - stage: draft
    run: 2
    flow: requirements
    status: failed
    stage_before: draft
    stage_after: draft
    at: 2026-08-24T21:01:31.664Z
    cost: 3.673
  - stage: requirements
    run: 3
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-24T21:17:58.586Z
    cost: 4.634
  - stage: requirements
    run: 4
    flow: chore
    status: failed
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-24T21:48:37.164Z
    cost: 16.854
---
`harness board` renders the same word for work that shipped and work that exists on one laptop.
Q-0006, Q-0011 and Q-0033 all read `green`; only Q-0033 is on `main`. Nothing in the stage list, in
`docs/02-sdlc-pipeline-spec.md` §3.4 or in the **Stage** entry of `docs/GLOSSARY.md` distinguishes
"the integration branch integrated and passed its configured suite" from "the code is in the
clone" — which is why two tickets' worth of paid, tested work sat unmerged for a day and was found
only by someone chasing a missing directory. Of the three workstreams Q-0034 split into, this is
the only one that stops the problem recurring, which is exactly why it must not be the one dropped
when the landing runs long.

The board should show, for every ticket at `green` or later whose `branch` resolves to a real ref,
one of three factual states against the base branch: contained, not contained with how far ahead, or
indeterminate because a ref is missing. The third state is the one that matters — a missing ref must
never be reported as contained or not contained, and a shallow clone must not be described as "not
contained". The value is derived from git on every invocation and nothing is stored in `ticket.md`,
so no field can drift. Note that `case 'board'` makes no git call today: this is new surface in the
render path, not a tweak.

Scope is AC-14 through AC-17 of `backlog/Q-0034-reconcile-the-unmerged-green-branches/requirements/merged.md`,
which is the merged requirement this ticket was split from; read it there rather than restating it.
Independent of Q-0034 and Q-0035 — it is ordered last only because nothing is at risk while it
waits, whereas the two branches rot against `main` every day they are not landed. Routed through the
**chore flow**. Belongs to M2 in `docs/06-development-plan.md`.
