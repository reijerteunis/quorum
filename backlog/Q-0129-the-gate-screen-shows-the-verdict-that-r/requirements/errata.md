# Q-0129 — errata

Written at the requirements gate on 2026-09-17, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and a chore implement step reads **this file** and not `ticket.md`
(Q-0125).

`requirements/merged.md` is the specification — twelve criteria, ready on its first pass, with the
successor's body written out in §7. Nothing below changes a criterion.

---

## E-1 — GO-1 discharged: the entry is landed, and it is *"A gate question carries the decision that reached it"* (2026-09-17)

`docs/decisions/097-a-gate-question-carries-the-decision-that-reached-it.md`, indexed. **It is a hard
precondition and it exists before any further run**, which is what Q-0126's round 1 returning
`blocked` and Q-0062's three rounds both cost for want of.

It rules the field, the six refusals and two boundaries a later reader will look for: it **does not
reverse** *"The event union is derived from what the product emits"* (2026-08-25) — that entry refuses
inventing a member for a producer that does not exist, and the producer here is `steps.ts`, which
already writes these three values to disk — and it leaves **Q-0127 erratum E-1's reader-side exclusion
standing**, `.harness/` remaining unreadable through the backlog routes because the value travels on
the stream instead.

**Q-0131 applies this entry to `cost`; it does not re-derive it.** The six refusals are recorded in
the entry for exactly that reason, and the sequencing note in both ticket bodies says so.

## E-2 — GO-2 ratified: the field is `reached`

Taken as ruled, with §3's three collisions accepted as the reason: the name is read on a question that
already carries `kind`, `reason` and `retry`, and `verdict` alone would collide with the gate's own
answer vocabulary. **Whole or absent, never partly present** is the half that matters and is not
negotiable at implement time — a partly populated `reached` must be unrepresentable rather than
merely unused.

## E-3 — GO-3 ratified: the split stands, and **Q-0134** is the successor

Twelve criteria here, the diff to **Q-0134**, opened at this gate with §7 transcribed in full (GO-4,
discharged by the same act). The seam is measured rather than aesthetic: the verdict is the
structured-value question this entry settles, while the diff needs a **range the wire does not carry**
— `review.yaml` diffs `{base}...harness/{id}/integration` and nothing projects it — and this
workspace's **first** diff dependency, with **Q-0128**'s truncation question as its neighbour.

## E-4 — the body's figures had all moved by the time it ran, and the run re-derived them

Re-measured before the run and confirmed by §0.1, which decomposes the census completely with nothing
left over: `gate=` matches **275** lines = **235** engine answers + **39** retry grants + **1**
hand-written erratum note. By kind, `gate=human` **157** (154 `advance`, 3 `abort`) and
`gate=human-locked` **78** (39 `retry`, 31 `advance`, 8 `abort`). The body said 274/71 verdict
artifacts and 220/148 answers; it is now **306 across 73 folders** and 235/157.

**The movement is this repository's own work between 2026-09-16 and 2026-09-17** — Q-0016, Q-0015 and
Q-0130 shipped in that window and their gates are in the census. **The one figure that did not move is
the load-bearing one**: across 157 author-declared gates, `retry` has been chosen **zero** times, which
is what AC-8 of Q-0015 rests on and what `docs/05-design-prompt.md`'s screen 6 still gets wrong.

## E-5 — GO-5 is the operator's at the close, and it is not a formality here

Verify forced in **both** environment rows and record it. Q-0016's equivalent was reported discharged
when its by-hand half had not been performed; Q-0015's gate found that, and Q-0130's GO-4 was written
to be unfakeable because of it. The same standard applies to this ticket's close.
