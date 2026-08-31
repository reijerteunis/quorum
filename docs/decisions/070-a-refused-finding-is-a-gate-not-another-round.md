# A refused finding is a gate, not another round — 2026-08-31

**Decision:** When an implement round **refuses** a review finding on an authority the reviewer
cannot overrule — charter §2's preservation rule, a decision entry only the human may write, a
surface outside the role's write paths — the loop has no convergence point, and the next traversal
is not a revise round. Sending it round again buys one of two outcomes and neither is the right one:
the implementer holds and the round is wasted, or the implementer yields and the loop ships the very
change the authority forbids, wearing an approval.

Until a flow can express a refusal, **the obligation is the human gate's**. A chore gate is answered
by reading the review record for a finding that was refused and then overridden — not only by
reading `integrate`'s tick and the final verdict. Where one is found, the repair is made **after**
the gate, on the branch's merge rather than by editing the branch the gate approved, and the erratum
that should have closed it mid-loop is written then.

This **extends and does not reverse** *A reviewer approves the change it asked for* (2026-08-29).
That entry's remedy — write the erratum during the loop, as soon as the contradiction is provable —
is correct and stands. What this entry adds is that the remedy assumes a **human is reading reviews
while the loop runs**, and nothing in the flow requires or even prompts that. An unattended loop
reaches an approval faster than a ruling can be written into it.

**Alternatives considered:** **Reducing `chore.yaml`'s `max_iterations` to 1**, so every revise
reaches an exhaustion gate. Rejected on the measurement: 42 of 59 chore reviews to date returned
`revise`, and nearly all of those were ordinary findings the next round fixed. It gates the common
case to catch the rare one, and the cost is paid on every ticket forever. **A gate step after
`review`.** The same objection, and worse — it stops on approvals too. **Relying on the 2026-08-29
remedy as written.** Rejected: that is what was in force, and it did not fire, because it has no
trigger. **Letting the implement step return a verdict that routes to a gate** — `proceed` or
`blocked`, where `blocked` means *this finding demands something I am not permitted to do*. This is
the right mechanism and it is why the decision above is written as an interim: it makes the refusal
visible to the engine instead of to a prose report nobody reads until the gate. It is a flow and
engine change rather than a ruling, so it is **Q-0083** and not this entry.

**Why: the mechanism failed in about an hour, unattended, and cost more to repair than to prevent.**
Q-0052's chore run. Review round 1 reported, correctly, that `resolveModel` inherits a role's model
when the role names no adapter — contradicting its own AC-4(a), which requires equality. The finding
was real; the fix it demanded was a behaviour change to a ported function, which charter §2 forbids
and whose one authorised exception the port had already spent. Round 2's implementer refused,
preserved the code and added the authority line the engineering rules prescribe. Round 2's reviewer
refused the refusal, answering only the weaker half of the argument — that frozen coverage is not
authority, which is true and was not what had been argued — and never addressing the charter. Round
3 yielded, shipped the strict form, and **deleted the preserved-defect pin that recorded the
divergence**. Round 3's reviewer approved and named the deletion approvingly.

Three implement rounds and three reviews completed in roughly an hour with no human step between
them. The contradiction was provable after round 1 and the erratum was never written, not because
anyone judged it unnecessary but because the loop finished first. The human gate caught it, which is
what the gate is for; the repair then cost a restore, two guard updates, an erratum and a successor
ticket, against one erratum had it been written at round 1.

The second-order lesson is why the pin matters as much as the code. A preservation is recorded by an
authority line and registered in a source guard; deleting the line makes a true record false, and a
reviewer that approves the deletion has removed the only evidence that a decision was ever taken. It
was `q0050.source.test.ts`'s identity register — not the suite, which stayed green — that made the
deletion visible at all.
