---
id: Q-0038
title: Deferred-range failures name their producing step in every case
stage: draft
owner: ruud
repos: []
branch: harness/Q-0038/integration
priority: p3
created: 2026-08-24
iterations: {}
history: []
---
Opened under AC-2 of Q-0034, which allows a review finding to become a follow-up ticket rather than
forcing another revise loop. This is the one finding that survived Q-0035's chore review
(`backlog/Q-0035-empty-range-diagnostic/review/chore-iter-3.md`). It did not block: the reviewer
returned three majors, then three, then this one, and never a blocker, and Q-0035's `integrate`
proved both suites green before the ticket was accepted at its gate.

**The finding, in the reviewer's words.** `spike/src/engine.js:820` — a deferred range only names its
producing step when the unresolved ref is *exactly* the deferred endpoint. If the other endpoint is
the missing one, the message omits the step and branch that caused the preflight to defer the range,
though AC-9 of Q-0035's merged requirement asks deferred empty, missing and indeterminate failures to
name the expected producer. The fix keeps the distinction about *which* endpoint is missing and adds
the deferred producer and the ref it was expected to create.

**Why this is worth its own ticket rather than a nit.** The same asymmetry cost real money on the
night Q-0035 was implemented, from the other direction. The run-level preflight defers an entire
range when *either* endpoint is created by an earlier step of the same flow — `createdSoFar` is
consulted with a single `find` over both endpoints — so a range like
`harness/{id}/integration...harness/{id}/implement` is skipped whole. When `harness/Q-0035/integration`
did not exist, nothing checked it: `harness run chore Q-0035 --dry` reported the range valid, and the
real run billed **$13.86** to the `implement` step before `review` failed on the missing left
endpoint. The left endpoint is a pre-existing-ref-class endpoint, and it was knowably absent before
the run started.

So there are two halves of one gap, and this ticket should decide whether to close both:

1. **Diagnosis** (the reviewer's finding) — when a deferred range fails, always say which step owed
   which ref, whichever endpoint turned out to be bad.
2. **Timing** (found by walking into it) — validate each endpoint on its own class rather than
   deferring the range wholesale, so a missing pre-existing endpoint fails before any adapter is
   billed. Q-0035's AC-8 promises zero invocations for pre-existing-ref ranges and AC-9 accepts
   earliest-possible for deferred ones; a range with one of each is covered by neither, which is why
   it slipped through a requirement that had otherwise thought hard about this exact subject.

**Two neighbours found the same night, recorded here so they are not lost.** Neither belongs to this
ticket and both want their own:

- **The chore flow cannot run on a ticket's first pass.** `chore.yaml` puts `review` — which diffs
  `integration...implement` — before `integrate`, and `integrate` is the only step that creates the
  integration branch (`spike/src/engine.js:200` says so in a comment). `backlog.js:64` writes the
  branch *name* into frontmatter and nothing ever creates the ref. Q-0008 and Q-0036 only worked
  because the branch was created from `main` by hand minutes before each run — the reflog shows
  `harness/Q-0036/integration` "Created from main" at 23:28:46 against a run that started 23:30:38.
  A statically checkable flow property, and a candidate for `harness lint`.
- **`budget.per_run_usd` does not stop a run.** It is `10` in `harness/harness.yaml`; Q-0035's run 2
  spent $13.86 in a single step and run 3 spent $22.27, neither interrupted.

Belongs to M2 in `docs/06-development-plan.md`.
