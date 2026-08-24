---
id: Q-0034
title: Reconcile the unmerged green branches (Q-0006, Q-0011)
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0034/integration
priority: p1
created: 2026-08-24
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-08-24T18:39:02.997Z
    cost: 0
  - stage: draft
    run: 1
    flow: requirements
    status: failed
    stage_before: draft
    stage_after: draft
    at: 2026-08-24T18:39:03.002Z
    cost: 7.188
---
*Re-scoped 2026-08-24 at the requirements gate. The merged requirement came back seventeen criteria
across three workstreams that route differently, and the maintainer accepted the head-of-product's
proposed split: this ticket keeps **AC-1 … AC-9** (landing), Q-0035 takes the empty-range diagnostic
and Q-0036 takes what `green` means. The full requirement, including the criteria now owned
elsewhere, stays in `requirements/merged.md` — it is the artifact the run produced and it is not
rewritten.*

Two of M1's three tickets reached stage `green`, were paid for, and never landed on `main`.
`harness/Q-0011/integration` carries **48 commits** that `main` does not have — the whole
run-history feature the ticket was written for: `.quorum/runs/<id>/` written by the engine, the
`harness runs [ticket|run-id] [--json]` reader, and the per-vendor roll-up that reports money where
a vendor reports money and tokens where it does not. `harness/Q-0006/integration` carries **3**,
touching `spike/src/engine.js` and `spike/src/adapters/index.js`. That work is in no clone of this
repository, and it is invisible from the board, which shows both tickets as `green` and says nothing
about where the code is. The gap was found on 2026-08-24 while chasing something else: `.quorum/`
does not exist in the working tree, and `grep -rn "\.quorum" spike/src spike/bin` on `main` returns
nothing, because the feature that creates it was never merged — not, as first assumed, because
`.gitignore` was hiding it.

Merging is not a formality and that is why this is a ticket rather than a command, though the
requirements run made both branches smaller than they looked. Q-0006's three commits are a merge of
`main`, one development commit, and its integration merge — three `fix(engine) … [Q-0006]` commits
were hand-landed on `main` out of band and are already ancestors of both — so the task is to land
one commit's 45 insertions, which carry six separable decisions including a rename of the SIGINT
terminal outcome that nobody noticed. Its merge is conflict-free by construction: zero file overlap
with `main` since merge-base `6cc9da4`. Q-0011 is the larger job, conflicting in **five** files
across seven hunks — `docs/04-architecture.md` among them, a numbered living document that earlier
loss-checks all missed. Its apparent deletion of `spike/src/lint.js` is an artifact of a two-dot
diff, not a real conflict. It has never been through the review flow, and AC-2 requires that review
to happen **while the branch is still unlanded**, since merging it is what destroys the diff.

Two fixes made on 2026-08-24 while preparing this run are carried here rather than in Q-0035,
because both collide with Q-0006's branch on the same lines and the collision should be resolved
once, by whoever is already resolving it: `--dry` mutating the ticket it previewed (AC-8), and
`PROBE_SCHEMA` declaring a property it did not require, which made `adapters --probe` report a
healthy Codex login as unusable (AC-9). Q-0006's branch already contains an identical `PROBE_SCHEMA`
fix, found and paid for during that ticket and never landed — which is this ticket's whole thesis in
one file. Landing is a human act on `main` performed outside the flows, per the 2026-08-23 decision.
Belongs to M2 in `docs/06-development-plan.md`.
