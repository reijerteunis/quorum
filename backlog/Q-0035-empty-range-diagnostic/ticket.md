---
id: Q-0035
title: The empty-range diagnostic reports evidence, not a story
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0035/integration
priority: p2
created: 2026-08-24
iterations: {}
history:
  - stage: draft
    run: 1
    flow: requirements
    status: failed
    stage_before: draft
    stage_after: draft
    at: 2026-08-24T22:09:18.702Z
    cost: 3.817
---
When a step's `input.diff` resolves to an empty range, `materialiseDiff` in `spike/src/engine.js`
explains it. The explanation is a story rather than evidence: it runs `git merge-base --is-ancestor`
and then reports a *historical event* — that the branch "is already merged into" the base — from an
*ancestry fact*, which is precisely the shape of claim the 2026-08-24 erratum in `docs/DECISIONS.md`
exists to warn about. It also recommends a workaround, pointing `input.diff` at the merge commit,
that the range guard makes impossible. The message should name the range, both refs with their short
SHAs, and the outcome of the check that produced its conclusion, and it should assert only git
states the engine has verified.

**Updated 2026-08-24, after Q-0034 landed.** Two clauses above have moved and the ticket is smaller
than it was written. Q-0006's branch is now on `main`, and landing it changed the same function
twice more, so read the code rather than this paragraph. What is no longer true: the message does
not hard-code "main" — it diagnoses against the range's own endpoints, because the chore flow
reviews `integration...implement` and the question there is whether the implement side is contained
in the integration side. What is still true, and is this ticket's whole subject: it reports a
historical event from an ancestry fact, it names no SHAs and no check outcome, and it still
recommends pointing `input.diff` at a merge commit — which the guard now rejects more definitively
than before, since both endpoints must be the configured base or one of this ticket's own branches.
The billing clause is also partly satisfied already: the run-level preflight materialises every
pre-existing-ref range before the first step, so no adapter is billed against a bad ref. It does
*not* cover ranges an earlier step of the same flow creates, which defer to step time by design —
whether that gap needs closing, and how it could be, is a real question for this ticket rather than
a settled one.

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
