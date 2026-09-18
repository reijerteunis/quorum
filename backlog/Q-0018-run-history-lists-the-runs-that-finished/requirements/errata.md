# Errata — Q-0018

*Rulings made at the requirements gate on 2026-09-18, after `requirements/merged.md` was written and
before any implement step runs. **The window for an erratum is a gate** — Q-0094's E-3 — and this
file is the channel the chore `implement` step reads; it does not read `ticket.md`, which is why a
ruling recorded only there would reach nobody (Q-0125 E-1).*

## E-1 — The split is taken, and the seam is §6's rather than the ticket body's

**GO-1 is ruled: this ticket is the manifest-read half.** AC-1 to AC-14 as `merged.md` specifies
them, and nothing else. The retained-file drill-down is **Q-0137**, opened at this gate (E-2).

The ticket body put the seam at *listing / drill-down*. §6 measured that one step off and it is
correct: the brief's **inline expansion** — the occurrence timeline and the per-vendor split — needs
no route, no file read, no confinement surface and no ruling, because `GET /history/:id` has existed
since Q-0119 and `fetchRunHistory` already calls it. The seam that is actually disjoint is
**manifests against retained files**, which is this repository's rule of splitting on a disjoint
blocker rather than on size (Q-0016, Q-0129, Q-0131).

**It is checkable in code rather than only in prose**, which is what makes it a seam and not a
preference: `occurrenceSeq` parses a directory *name* and opens nothing, so **this ticket never
composes a filesystem path**. Q-0137 does. An implement step that finds itself joining a path has
left this ticket.

**AC-14's subject does not move with the split.** All three document corrections stay here: the
`WireRunHistory` docblock sentence this change makes false, `04-architecture.md`, and
`05-design-prompt.md` §8's recorded divergence. A correction deferred to a successor is a correction
that expires (Q-0110, Q-0111, Q-0112 each lived inside a closed ticket's prose; Q-0100's inside a
source comment).

**Fourteen criteria is at the working ceiling and not under it.** If the review loop exhausts, the
remedy is a second erratum ruling what is trimmed — and **AC-4 and AC-14 are named now as not
eligible**, AC-4 because a projection that repairs a `running` manifest is a defect against a live
case rather than a missing feature, and AC-14 for the reason above. Named in advance because
Q-0122's E-1 did and Q-0126 paid $177.92 for not having done so.

## E-2 — Q-0137 is the successor, and its id was allocated rather than assumed

**GO-2 is discharged.** `quorum ticket new` allocated **Q-0137**; Appendix A's body is transcribed
into it in full, and `docs/06-development-plan.md` carries a bullet for it, so it exists on both
sides of the plan/backlog check rather than in this document alone.

Its blocking question is `merged.md`'s **OQ-1**, and it travels with it: whether
`WireExcludedFiles`'s forwarding of this subject to Q-0018 **by name** survives the difference
between an empty `.harness/` inside a ticket folder and 115 MB under `.quorum/runs`. Not this
ticket's, and **not a precondition for it** — nothing in AC-1 to AC-14 opens a file.

## E-3 — No decision entry is owed, and this is the ratification GO-3 asked for

**GO-3 is ruled: no entry, and the ruling belongs in the code's own authority comment.** The test
this repository applies is *does any landed sentence go false?*, and it was applied at five sites
rather than assumed:

1. **No route is added**, so `04-architecture.md`'s enumeration changes in wording and not in
   content — the fifteen registered routes stay fifteen.
2. **Nothing new is persisted and no event gains a field**, so *"Files are the database"* and the
   **Event** term are untouched.
3. **No dependency is added.**
4. **No glossary term is coined or widened.** OQ-6's naming ruling — `WireRunHistoryList` and
   `WireRunHistoryRow` — is a wire shape's name and not vocabulary; it goes in the shape's JSDoc.
5. **The only sentence that goes false is a source docblock**, `WireRunHistory`'s *"`steps` is
   deliberately absent"*, **whose own reasoning expires by its own terms**: it rests on *"read by
   nothing that reads this shape"*, which ceases to be true the moment a caller reads it. AC-5
   replaces it in place rather than leaving it standing.

Widening a wire shape without an entry is precedented twice: Q-0016 added two fields to `WireRun`,
and Q-0121 moved two shapes into `@quorum/shared` with schemas. **Q-0108's precedent governs where
the ruling lives** — a ruling that changes no behaviour and contradicts no landed entry belongs in
the check's or the shape's own authority comment, not in `docs/decisions/`.

**This is a ratification and not a discovery.** If an implement step finds a landed sentence this
misses, that is an erratum's subject and not a thing to work around — say so and stop, which is what
`verdict: blocked` is for (Q-0083).

## E-4 — Two of the ticket body's measurements are corrected, and one corrected itself

Recorded here because the body stays as it was written and a reader meeting it first should not
re-derive against it.

**`incomplete` is not 0 of 170.** The body measured 170 run directories with none incomplete. At the
gate there are **171**, and one is `status: running` with `ended_at: null` — **`Q-0018-1`, the run
that produced this document**. The case the body called untestable from this corpus is the state the
corpus was in, because measuring it created it. AC-4 and AC-11 are written against it.

**The brief asks for eight columns, not nine.** `docs/05-design-prompt.md` §8 lists id, ticket, flow,
vendors, status, duration, cost, tokens. The body's arithmetic was its own.

**And one measurement in `merged.md` was true when taken and is now false**, which is the same
mechanism a third time: Appendix A records *"exactly one occurrence has no `output.txt`: a step that
is still running"*. That step is this run's own `head-of-product`, which has since terminated, and
`writer.ts` guarantees an empty `output.txt` at terminalisation — so the count is **zero** now. The
**rule** Appendix A states is unaffected and is what Q-0137 needs: no output means not finished,
never damaged.
