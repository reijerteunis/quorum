# Q-0016 — errata

Written at the requirements gate on 2026-09-16, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and the chore implement step reads **this file** and not `ticket.md`
(Q-0125) — so every ruling a later step must obey is here rather than in the ticket body.

`requirements/merged.md` is the specification. Nothing below changes a criterion; E-1 to E-3 record
which of §6's obligations are ratified and which moved, and E-4 corrects the ticket body.

---

## E-1 — GO-1 ratified: the split is accepted, and **Q-0129** is opened

This ticket is **the answerable screen at fourteen criteria**; the verdict, its findings and the diff
are Q-0129, whose folder exists as of this gate with §7's body transcribed in full.

Accepted rather than merely permitted, on evidence that arrived from four directions independently:
both candidates reached it without having seen each other, the head-of-product recommended it twice,
and the ticket body proposed the same seam before the run began. What decides it is §3.1's
measurement rather than the agreement — **the two halves have disjoint blockers**. This half needs no
decision entry, no new route, no new dependency and no `.harness/` ruling. The other needs at least
one decision entry by Q-0127 erratum E-1's own words, and for the diff a range the wire does not carry
and a dependency this workspace does not have.

Q-0013 was refused at eighteen criteria and cut in three, Q-0014 cut in two, Q-0017 cut in two at
exactly this seam and opened Q-0127 at its gate. **GO-5 is discharged by the same act**: the
successor's body is a ticket on disk rather than a paragraph in a closed document, which is what three
obligations found orphaned in one week (Q-0110's, Q-0111's, Q-0112's) were not.

## E-2 — GO-2 and GO-4 ratified as ruled

**GO-2 — the question comes from the wire.** `WireRun` gains `gates`, carrying
`gateQuestionEventSchema`'s own shape whole beside the existing `pendingGates`. Ratified on §3.2's
argument rather than on preference: reading the replay instead leaves two states in which the screen
cannot do its one job — a pending count whose question replay did not supply, and an incomplete replay
the screen must disclose and cannot repair — and candidate-codex's own AC-18 and AC-6 concede both.
Widening the wire does not mitigate those states, it removes them, and `RunView.gates` already holds
the questions and derives them per request. The name `gates` is correct and the reasoning is checked:
Q-0121 GO-3's rule binds a wire field that **narrows** a `RunView` field, and this narrows nothing.

**GO-4 — the screen holds no socket**, with §3.3's consequence stated rather than smoothed over: a
gate arriving while the screen is open is not shown until the reader asks again, and what the run does
next is shown by re-reading. That is a real limitation, it is accepted, and it is not to be closed by
an implement step reaching for `run-connection.ts` — rendering a run's event stream is Q-0015's
subject, and coupling to that controller before Q-0015 has decided how it is held is a design no
ticket has done.

## E-3 — GO-3 ratified: **no decision entry is owed**, and the authority line is where it goes

Checked against the five grounds §6 gives, each verified at this gate rather than taken from the
document. The event union is unchanged and `gateQuestionEventSchema` is reused as an element rather
than altered; nothing reads, lists or serves `.harness/`; no route is added, so
`04-architecture.md`'s route list is **executed** rather than changed; no dependency is added; and
Q-0121 GO-3's naming rule is satisfied for the reason E-2 gives.

**Q-0108's precedent governs**: a ruling that changes no behaviour and contradicts no landed entry
belongs in the check's or the code's own authority comment, and none was written there because none
was owed. The one change that **would** owe an entry is widening the gate answer set, which §5(3)
refuses and which this ticket may not do.

**If an implement step concludes otherwise, it must stop rather than write one.** A decision entry is
outside `developer-generalist`'s paths; `verdict=blocked` is the channel (Q-0083), and Q-0062's three
implement rounds on exactly this are what that channel exists to prevent.

## E-4 — the ticket body is corrected in three places, and the cause of one is worth more than the count

`ticket.md` was written before the run and the merged document refuted it three times. All three
corrections were re-verified at this gate against the tree, independently of the document:

**(a) §0(b)'s verdict-artifact count is wrong — 199 files across 35 folders by the glob it used, and
275 across 71 for the thing it was counting.** The cause is not arithmetic. The glob required
`-verdict-iter-`, which is the shape Q-0089 introduced on 2026-09-01 when it scoped the verdict file
by run and iteration; every artifact written before that is a flat `<stepId>-verdict.json` and was
silently excluded. **A search keyed on a naming convention rather than on the thing it names** — the
family this repository has recorded at Q-0051, Q-0067, Q-0073, Q-0107, Q-0108, Q-0115, Q-0122 and
Q-0125, committed here inside a body that cites the class. The figure also moves while it is measured:
this run's own two verdict artifacts are why 274 became 275.

**(b) §0(d) is wrong that the replay is the only channel that can carry the question.** It is the only
one that does. `RunView.gates` holds the questions whole. E-2 is the consequence.

**(c) OQ-5's reasoning is wrong in the most damaging direction.** It says offering `retry` where the
question carries none *"would be a control that does nothing"*. `routing.ts:97` is
`return { abort: true }`: it ends the run. Measured at this gate — `retryTarget` has one production
reader, one fixture and **no occurrence in any shipped flow**, and of 219 engine-recorded gate answers
147 are at author-declared gates where `retry` was chosen zero times. An unconditional retry control
would have aborted the run at two-thirds of the real gates this repository has answered. **AC-8 is the
criterion, and it is not eligible for trimming.**

**And ground rule 2 cites the wrong line.** The placeholder rule is `docs/04-architecture.md:317`;
`:200` is the run-identity paragraph and says nothing of the kind. A criterion citing a line that does
not say what it claims is this repository's most-recorded defect class arriving through a citation —
which is the same failure as (a), one document over.

**The ticket body is not edited.** It is the record of what was assumed before the run, the merged
document is the specification, and this file is where the two are reconciled.
