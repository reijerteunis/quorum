---
id: Q-0057
title: A chore run's reviews overwrite the previous run's, and the survivors mix
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0057/integration
priority: p2
created: 2026-08-25
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-30T11:10:24.252Z
    cost: 6.054
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-30T12:01:41.861Z
    cost: 14.908
---
Found by Q-0041's fifth implement round, which asked for this ticket by name at its gate: *"the
review-overwrite defect needs a ticket, and it is not cosmetic. It destroyed one review on this
ticket and it feeds mixed-run reviews back into the implement step. It will do the same on the
thirteen remaining children of Q-0009, every one of which runs this flow."* Recorded as
stop-and-report under *"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25).

**The defect.** `chore.yaml:34` writes `review/chore-iter-{iter}.md`. `{iter}` is `ctx.vars.iter`,
initialised to `1` at **run** start (`spike/src/engine.js:50`) and incremented per backward-edge
traversal (`:180`). It is **run-scoped**, so every new run restarts the numbering and its first
review lands on `chore-iter-1.md` again, on top of whatever was there.

**Two flows, two conventions, and only one of them survives a second run.** `review.yaml` uses
`{round}` — `reviewRound(ticket)` at `engine.js:778–785`, which reads the ticket folder and returns
one more than the highest completed round. That is ticket-scoped and correct. `chore.yaml` is the
one that is not.

**The evidence is Q-0041's folder, not this one** — this ticket has never run. Run 2 wrote
`chore-iter-1.md`, `-2` and `-3`. Run 3 wrote `-1` and `-2`, over the top. What is on disk now is
a *mixture*, and mtimes confirm it independently of the reports: `-3` is stamped 20:55 while
`-1` and `-2` are 21:39 and 22:02, so the highest-numbered file is the oldest.

| file | written by |
| --- | --- |
| `chore-iter-1.md` | run 3 |
| `chore-iter-2.md` | run 3 |
| `chore-iter-3.md` | run 2 — orphaned, nothing overwrote it |

Run 2's `chore-iter-1.md` — the review that found the union-fallthrough major — exists **only**
because it happened to be committed by hand before run 3 started (`e6b31b7`). Nothing in the product
preserved it. Had it not been committed, the reasoning that produced the erratum would be
unreconstructable.

**And the mixture is fed back to the implementer.** `chore.yaml:13` lists
`review/chore-iter-*.md` — a glob — among the `implement` step's inputs. When run 3's retry started
its implement round, that glob resolved to run 3's `-1` beside run 2's orphaned `-2` and `-3`:
reviews of **different code, from different runs, with nothing in the files distinguishing them**.
It coped — its report opens by noting that "rounds 2 and 3's findings were settled by
`requirements/errata.md` and implemented in round 4" — but it had to work that out, and the next
implementer may not.

**The obvious fix does not work, and this is the point of the ticket.** Swapping `{iter}` for
`{round}` in `chore.yaml` reproduces the bug under a new name. `reviewRound` counts **directories**
matching `review/round-N/` that contain a `verdict.md` (`engine.js:781–783`); chore writes flat files
and creates no such directory, so `reviewRound` would return `1` on every chore run forever. Only
tickets that ran `review.yaml` have `round-N/` directories today — **Q-0006, Q-0011 and Q-0050,
whose six rounds landed after this ticket was written** — and no chore ticket, which is what makes
the claim hold.

**Three shapes worth costing, none of them decided here.**

1. Make the write path run-unique — `review/run-{run}/chore-iter-{iter}.md`. `ctx.runId` is already
   allocated at `engine.js:49` and would need exposing as a var. Cheapest, and it changes where a
   human looks for a review.
2. Generalise `reviewRound` so it recognises chore's artifacts as completed rounds, and give chore
   `{round}`. Keeps one convention across both flows; needs care, since `reviewRound`'s current
   contract is "a round is a directory with a verdict".
3. Give the chore flow its own ticket-scoped counter, leaving `reviewRound` alone.

**One question the fix must answer either way:** should a revision round see *only* the current run's
reviews, or every review the ticket has accumulated? Q-0041 argues both sides — the stale reviews
were noise on the retry, but a run started after an erratum genuinely benefits from seeing what
earlier runs found. Whichever way it goes, the files need to say which run wrote them.

**Scope — re-derived 2026-08-30, and the 2026-08-25 sequencing above it is stale.** Every line
number in this body had moved and is corrected above; the sequencing had moved further. Measured
against `main` at `6a13d29`:

| surface | where it is now |
| --- | --- |
| `reviewRound` | **ported** — `packages/core/src/engine/loaders.ts:63`, called from `engine.ts:137`. Q-0050's, landed and contained 2026-08-29 |
| the `vars` literal carrying `iter: 1` | **ported** — `packages/core/src/engine/engine.ts:138` |
| `ctx.vars.iter += 1` on a backward edge | **not ported** — `spike/src/engine.js:180` has no counterpart in `routing.ts` |
| `chore.yaml` | never frozen |

So this ticket's original *"lands against `packages/core` after Q-0052"* is **not the current
answer**: two of its three engine surfaces are already in `core` and belong to Q-0050, not Q-0052,
and Q-0044 is closed. What that leaves is a genuinely mixed sequencing question — two surfaces want
the Q-0066/Q-0068/Q-0070 shape of landing in **both trees together**, while the third exists in one
tree only. **That is for the requirements gate to settle, and it is named here rather than
answered.** `spike/src` is still frozen for the port (`harness/port-charter.md` §3), which is the
constraint the answer has to satisfy, and the flow-file half is not frozen. Sequencing
is the first thing to settle at its requirements gate — **and it is worth settling early**, because
every remaining child of Q-0009 runs this flow, and each one that exhausts and is re-run loses a
review. **The thirteen the quote above names are now three** — Q-0052, Q-0053 and Q-0054 — which
cuts the remaining exposure but does not change the defect, and the flow outlives the port. Belongs to M2 in `docs/06-development-plan.md`.
