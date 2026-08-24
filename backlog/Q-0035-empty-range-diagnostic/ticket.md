---
id: Q-0035
title: The empty-range diagnostic reports evidence, not a story
stage: draft
owner: ruud
repos: []
branch: harness/Q-0035/integration
priority: p2
created: 2026-08-24
iterations: {}
history: []
---
When a step's `input.diff` resolves to an empty range, `materialiseDiff` in `spike/src/engine.js`
explains it. The explanation is a story rather than evidence: it runs `git merge-base --is-ancestor`
and then reports a *historical event* — that the branch "is already merged into" the base — from an
*ancestry fact*, which is precisely the shape of claim the 2026-08-24 erratum in `docs/DECISIONS.md`
exists to warn about. It also recommends a workaround, pointing `input.diff` at the merge commit,
that the range guard on `harness/Q-0006/integration` makes impossible. The message should name the
range, both refs with their short SHAs, and the outcome of the check that produced its conclusion,
and it should assert only git states the engine has verified.

Two things travel with it. No adapter should be billed before bad evidence is found: M1 paid two
vendors $5.02 to review a diff that did not exist, and a flow whose later step carries an empty or
unresolvable range should fail before the first adapter is invoked — testable with the mock adapter
by counting invocations. And the 2026-08-24 erratum should be closed by a DECISIONS entry that
states, with re-runnable evidence, whether the sentence the engine printed was accurate at the time.

Scope is AC-10 through AC-13 of `backlog/Q-0034-reconcile-the-unmerged-green-branches/requirements/merged.md`,
which is the merged requirement this ticket was split from; read it there rather than restating it.
Runs **after Q-0034**, because landing Q-0006 rewrites `materialiseDiff` and rewriting one function
from two directions is how this goes wrong. Routed through the **chore flow** despite having a
genuine red phase: `materialiseDiff` is the function the review flow calls to build its own input,
so a full-SDLC run would review a branch through the code that branch is changing — the reflexive
hazard named in the 2026-08-23 decision. Belongs to M2 in `docs/06-development-plan.md`.
