# Q-0015 — errata

Written at the requirements gate on 2026-09-16, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and a chore implement step reads **this file** and not `ticket.md`
(Q-0125).

`requirements/merged.md` is the specification. Nothing below changes a criterion — §8's own opening
says so, which is why the document is `ready` at fourteen.

---

## E-1 — GO-3 ratified: the split stands, and the seam is the stop button

Fourteen criteria: the live trace and the landing. **Q-0130** takes start and stop; **Q-0131** takes
the header's measured values. Both bodies are Appendix A, transcribed into ticket folders at this
gate rather than left in a document that closes.

**The seam is better than the one the ticket body proposed and the gate is adopting the document's
rather than its own.** The body recommended splitting the header's absent values and keeping the stop
button; §5.6 measured the opposite and is right. Start and stop widen the same write boundary, need
the same confirm-and-single-in-flight discipline, sit on the same control surface and raise the same
routing question, so answering it once is worth more than answering it twice — and the decisive half
is §0.9: **whoever can hand-`POST` a start can hand-`POST` a stop**, so a stop control has no user on
a real machine until the browser can start a run. Removing it also removes the `WRITE_RULES` re-aim,
a second act on a boundary Q-0016 deliberately widened *"by one act rather than by a family of
them"*, the stop-versus-completion race, and the irreversible-action discipline that was **Q-0016's
own blocker**. The header's values are still split out, as A(b) — so the body's seam is taken too,
and what changed is which of the two goes first.

**The landing stays in**, which the body recommended and §5.6 ratifies: three criteria over a shipped
route, a shipped schema and shipped request-state scaffolding, and it is what makes the screen
reachable at all.

## E-2 — GO-1 ratified: no decision entry is owed

Checked against the six grounds §8 gives. The event union is unchanged — **and a timestamp is the one
change that would owe an entry**, which §4 refuses and ground rule 6 of the ticket body forbids. No
route is added, changed or removed; no dependency is added; the gate answer set is untouched; nothing
under `.harness/` is read or served; and **the app's write boundary does not move at all**, this
ticket issuing no request that is not a GET. That last one is a consequence of E-1 rather than an
accident: the split is what makes this true, and Q-0130 is where the boundary question is answered.

If an implement step concludes otherwise it must **stop rather than write one** — a decision entry is
outside `developer-generalist`'s paths and `verdict=blocked` is the channel (Q-0083).

## E-3 — GO-2 ratified: AC-9's bound is 500, derived and not chosen

Ratified as written, including the narrowing the document performed on itself: iteration 1's fourth
reason — *"a browser may not hold what the daemon cannot replay"* — is **withdrawn and must not be
reinstated**, because a browser present from the start genuinely observed those events and its longer
history is real rather than fabricated. What the bound rests on is the three that survive: it bounds
an append that is otherwise quadratic over a long run in the screen most likely to be left open all
day; matching the daemon's own disclosed retention stops two readers of one run disagreeing about how
much of it exists; and **any other number would be invented**, no per-run event count existing or
being producible from the tree.

**The residual is accepted and is not to be closed in passing**: `apps/web` declares `@quorum/shared`
and not `@quorum/server`, so the two constants agree by citation rather than by a shared symbol.
Promoting it is a wire-shape question this ticket does not need to answer.

## E-4 — GO-4 ruled: *trace column* is a rendering, and no glossary term is coined

`docs/GLOSSARY.md` defines **Event** and says *"the trace is the stream, an event is one item of
it"*. A column is a rendering of that stream grouped by `stepId` — it invents no concept, and the
no-synonyms rule is what would be broken by coining one. Recorded here so a fourth reader does not
re-litigate it. **No term is added and none is owed.**

## E-5 — GO-6 ruled: this ships ahead of a producer, and the ordering was already decided

Ratified on the citation §5 gives rather than on preference: `apps/web/src/backlog-board.tsx:23`
refused the brief's *"Run next flow ▸"* button at Q-0017 saying *"starting a run needs somewhere to
watch it, which is Q-0015's"*. Building the producer first lands a button that starts a run nobody
can look at.

**AC-14's demonstration is a hand `POST /runs` and the closing entry must say so**, in those words,
rather than reporting a run somebody watched.

## E-6 — the ticket body is corrected, and §0.9 is the correction that matters

**(a) §0.9 — mission control has no producer, and the ticket body did not know it.** `host.start` has
exactly one production caller, `POST /runs` at `http.ts:178`; `apps/web` never issues it; `quorum
run` imports `runFlow` from `@quorum/core` and runs in-process, never touching `@quorum/server`; and
`quorum open` imports `createDaemon` and `BIND_HOSTNAME` alone. Verified four ways at this gate. **So
on a real machine the daemon's run registry is empty and stays empty.** The body's (g) said this
screen *"makes two shipped things reachable"* — true of navigation and false of the product, because
there is no run for either screen to show.

**(b) That is a correction to Q-0016's close as well, and it is the operator's.** Its GO-6 required
*"the product run by hand: a real run parked at a real gate, answered from the browser … the one no
unit test can stand in for"*. The forced-suite half was performed in both rows; **the by-hand half
was not**, and it was reported as discharged. Had it been attempted it would have failed, and this
gap would have been found a day earlier by the obligation written to find it. Q-0016's plan bullet is
amended to say so; its code is unaffected and its criteria are met.

**(c) The body's OQ-5 warned against copying Q-0016's route reasoning, and the document did not
copy it** — §5's OQ-5 re-derives it and reaches the opposite recommendation, on AC-9 being a
behaviour change rather than a rendering. Recorded because the warning worked.

**The ticket body is not edited.** It is the record of what was assumed before the run; the merged
document is the specification.

## E-7 — a defect this run's own inputs contained, found while reading its output

`harness/product-context.md:32` described a surface as `**Local daemon + web UI** ("the Studio")`.
**"The Studio" is retired vocabulary** — `docs/GLOSSARY.md:5` says it *"is the same thing and is not
current vocabulary"* — and that file is fed to **every** product-manager step at run time, so every
requirements run inherited it. Measured: the codex candidate used it **six** times here and **seven**
on Q-0016, while the claude candidate used it zero times on both, which is what points at the shared
input rather than at either model.

Corrected at this gate rather than mid-run: changing a step's inputs while the run is in flight is
the hazard Q-0094 E-3 names, and the two candidates had already read it. This is Q-0098's class — a
harness context file carrying a claim every future requirement inherits — and the second recorded
instance.

**Whether a check belongs beside it is not decided here.** *Where a check lives is a decision*
(Q-0105 GO-2, Q-0108), the glossary names exactly one retired term, and this ticket did not
authorise one.

## E-8 — a second defect in the same run-time input, larger than E-7 and found the same way

`harness/product-context.md`'s **Current priorities** section read *"M0 — prove the two real CLI
adapters on a real repository … M1 — prove contracts → red tests → fan-out development → green.
Everything else waits."*

**M0 closed 2026-08-22, M1 on 2026-08-24 and M2 on 2026-09-10.** So for **25 days** that file — read
by every product-manager and head-of-product step before any requirement is written or judged — told
every run the project's priority was proving the adapters work, while the adapters had been proven,
the core ported, the CLI cut, the daemon built and two screens shipped.

**Corrected by removing the copy rather than by updating it.** `docs/06-development-plan.md` is the
authority — `docs/README.md` says *"The current milestone lives here"* — and a restatement is a
second register free to rot, which is what it did. The section now points at the plan's last unclosed
`## M<n>` heading and states what does not change with the milestone. What rotted is recorded in
place rather than quietly replaced, because the next reader should know this file can lie.

**This is the same class as E-7 and the same file**, found in the same reading, and the second and
third recorded instances of Q-0098's finding: *a claim in a harness context file is one every future
requirement inherits*. Two in one file in one sitting is the argument that a check may be owed —
which is still not this ticket's to authorise, and which now has two subjects rather than one.
