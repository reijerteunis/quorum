---
id: Q-0116
title: A dry run may not mutate the caller's ticket
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0116/integration
priority: p3
created: 2026-09-10
iterations: {}
history: []
---
finish() advances stage and aliases the counters before its dry guard, so a caller reusing the ticket object in-process sees a walk that wrote nothing but changed everything. What it owes is a decision about ownership, not a patch. Strictly before Q-0013.

Opened **2026-09-10 at Q-0074's requirements gate** (its GO-3), from §6.2 of that ticket's merged
requirement, transcribed in full rather than referenced. Written as a ticket at the gate because
three obligations found orphaned in the week before that run — Q-0110's, Q-0111's and Q-0112's —
each lived only inside a closed ticket's prose or a source comment.

**Its decision entry already exists**: *"A probe that could not answer is not a negative"*
(2026-09-10), landed at that same gate. This ticket owes no second one.

## Transcribed from Q-0074 §6.2

### 6.2 `--dry` mutates the caller's ticket, and the counters are an alias

The ticket body carries two mutations `--dry` does not guard. Measured, they are **in-memory only**
and **pinned as deliberate**: `engine.ts:194` substitutes `readOnlyBacklog(backlog)` under dry so
nothing reaches disk, `lifecycle.ts:118` carries `Why: preserved defect, see Q-0050 AC-10`, and
`lifecycle.test.ts:228` pins the arrangement by name. **A criterion that breaks a landed
preserved-defect pin is a ruling, not a criterion** — which is why the Codex candidate's AC-12 is
struck rather than merged. They have nothing to do with `safe()`, with git, or with an unanswerable
probe.

**`--dry` mutates the caller's ticket, and the counters are an alias.** `finish()` sets
`ticket.meta.iterations = context.counters` and advances `ticket.meta.stage` before its
`if (!context.dry)` guard (`lifecycle.ts:118–122`), and `recordEvent` does the same at `:191`.
`types.ts:215` documents the counters as *"the same object as `ticket.meta.iterations` — an
alias, not a copy"*. Nothing reaches disk: `engine.ts:194` swaps in `readOnlyBacklog(backlog)`
under dry, and `lifecycle.test.ts:228` pins that arrangement deliberately. **So this is bounded
today to a caller that reuses the ticket object in-process, and there is exactly one such caller
planned: M3's server**, which will hold a ticket across runs and answer `GET` requests from an
object a `--dry` walk has just advanced. What it owes is not a fix but a decision about
ownership: does `runFlow` receive a ticket it may mutate, or a copy it may not? The second is the
cheap answer and it changes `lifecycle.test.ts:228`'s pin, which is why it wants a ruling rather
than a patch. Its tests must retain references to the original ticket and iteration objects and
assert them deeply unchanged after both a successful and a failed dry run — comparing serialised
output after the run cannot see an alias. Strictly before Q-0013. Do not fold it into a git-probe
ticket: the two share a file and nothing else.
