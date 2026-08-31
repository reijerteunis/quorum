# The port is closed, and what it cost was scaffolding — 2026-08-31

**Decision:** Q-0009's port is complete. All fourteen children — Q-0041 to Q-0054 — are `reviewed`
and `main:contained`, `packages/core/src/engine/routing.ts` contains no `unavailableStep`, and every
step kind dispatches to a real implementation. `harness/port-charter.md` §9's cost checkpoint is
performed here rather than in the charter, because the charter is retired at the cutover and this
result should outlive it.

**The checkpoint, measured from each child's `runs.log` and `ticket.md` history:**

| | |
| --- | --- |
| Billed Claude cost | **$657.47** across fourteen children, **mean $46.96** |
| Range | $16.87 (Q-0042) to **$131.03** (Q-0050) |
| Chore runs per child | **1** for twelve children, **2** for Q-0041, **0** for Q-0050 |
| Codex | unpriced throughout; the true total is higher in tokens and cannot be split by vendor |

Against §9's three thresholds: mean per child over $40 — **exceeded**. Projection for fourteen over
$550 — **exceeded**. Any one child needing more than three chore runs — **never approached**, the
maximum being two. §9 names the third as the one to watch, *"a child that loops is a child cut
wrong, and cost is the symptom rather than the disease"*. So the charter's instinct was right and
its money estimate was wrong, and the two facts belong in the same sentence: **the port cost 20%
over projection while showing no evidence any child was cut wrong.**

**What the money actually bought, which is the part worth carrying forward.** It was not spent
porting. Q-0050 is $131.03 — a fifth of the whole port — and its own closing record says the module
was sound while its *scaffolding* took six review rounds to become trustworthy. Rounds 4 to 6 of
that child produced **five assertions that could not fail**. Q-0052's $64.34 went three implement
rounds on one contested criterion and none on the code. Q-0054's exhaustion gate came after four
review findings that were all one class. The expensive part of a port is establishing that its
checks check anything.

**Five decisions came out of these fourteen tickets and not one is about porting.** *"A check is not
established by reading it"* (2026-08-29), *"A reviewer approves the change it asked for"*
(2026-08-29), *"An erratum is the last repair, not the first"* (2026-08-30), *"A test's verdict is a
property of the commit, not of the checkout or the account"* (2026-08-30), and *"A refused finding is
a gate, not another round"* (2026-08-31). Every one is about a guard that reported success over a
subject it had not examined. That is the port's real finding, and it is a finding about this
project's testing rather than about `packages/core`.

**Alternatives considered:** **Performing the checkpoint after the first three children, as §9
says.** It was never done, and doing it at the close is strictly worse — the point of an early
checkpoint is to catch a bad cut while eleven children remain, and by the time it ran there were
none. Recorded as a process failure rather than presented as compliance: had the mean been a symptom
of mis-cutting, this entry would be an autopsy. **Recording the result in §9 itself.** Rejected: the
charter is retired at the cutover and the numbers would go with it. §9 now points here.
**Publishing a per-child table.** Rejected as duplication — `docs/06-development-plan.md` already
carries each child's entry with its own costs and findings, and a second copy would drift.

**Why: because the estimate that was wrong is more useful than the one that was right.** Every
number above was cheap tonight and would be archaeology across fourteen `runs.log` files in a week.
The projection was built in the charter from three early children and it under-read the cost by 20%
— not because any child was mis-cut, which is what it was watching for, but because the cost of a
port is dominated by proving the tests are real, and none of the three children it extrapolated from
had yet hit that. A future estimate for work of this shape should budget for the scaffolding, not
for the translation.
