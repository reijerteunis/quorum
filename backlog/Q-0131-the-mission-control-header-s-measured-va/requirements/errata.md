# Q-0131 — errata

Written at the requirements gate on 2026-09-17, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and a chore implement step reads **this file** and not `ticket.md`
(Q-0125).

`requirements/merged.md` is the specification. Nothing below changes a criterion.

---

## E-1 — GO-1 ratified: the run number is supplied **out of band**, and no decision entry is owed

The document's own ruling is taken, and its measurement was re-derived at this gate rather than
relayed. All three landed sentences on run identity are about **an event**:

- `docs/GLOSSARY.md`'s **Event** term — *"only the terminal event carries run identity"*;
- `packages/shared/src/events.ts` — *"run identity only to the terminal event and deliberately adds
  no timestamp or sequence number"*;
- `packages/server/src/host.ts` — *"The terminal event is the only event carrying run identity."*

An out-of-band callback **is not an event**, so each stays true verbatim and there is nothing to
supersede. The in-band alternative — a new `start` member on the union — makes all three false and
**would** owe an entry; it is refused here, and the reason is recorded in AC-1's option JSDoc so the
next ticket on this surface does not re-derive it.

**The shape is precedented rather than invented**: `AnswerGate` is already an option on `runFlow` at
two declaration sites in `packages/core/src/engine/types.ts`, so a second out-of-band supply is the
channel this engine already has rather than a new mechanism.

**Decision 097 is explicitly not authority for this**, and the document is right to say so. *"A gate
question carries the decision that reached it"* (2026-09-17) rules that a value rides the stream
**because its producer already writes it there** — `steps.ts` computes the verdict and the findings.
The run number's producer is `nextRunId` at run start, which writes to `runs.log` and to the run
directory and not to the stream at all. Two different questions, and the same answer for one would
have been reasoning from a shape rather than from a measurement.

**Its cost is stated rather than waved past**: in the worst case the number arrives one read later
than an in-band event would. That is bounded, reversible, and cheaper than an entry narrowing three
landed sentences — and if it proves wrong, (a) remains available **with** its entry.

## E-2 — GO-2 discharged: the contract note is written by hand at this gate

`contracts/Q-0015/mission-control.contract.md` gains its superseded-by note. **`contracts/` is not
among `developer-generalist`'s fourteen roots** — which cost Q-0129 an implement round one ticket
ago — so this was never a criterion and the document correctly says *"No criterion may name this
file."* Two clauses move: *five* absent capabilities becomes **four**, and the run number's source.

**The second is written as a removed premise rather than a contradiction**, which is the distinction
worth keeping: *"read from the terminal event in the socket snapshot, never from a second metadata
read"* described the only source that existed when it was written. It was not wrong; its subject
changed. The three remaining disclosures and the no-placeholder rule are unchanged and still bind.

## E-3 — GO-3 ratified: the split stands, and **Q-0135** is the successor

This ticket keeps **AC-1 to AC-7**, the run number. Appendix A becomes Q-0135, opened at this gate
with the appendix transcribed in full (GO-6, discharged by the same act) — *"Mission control shows
elapsed time and the per-vendor cost split"*.

**The seam is a disjoint blocker rather than a size cut**, which is what makes it better than the
splits this repository has paid for: Half A carries the whole of the transport ruling and Half B owes
no entry under any ruling, and Half B **cannot start first** because the history id is `<TICKET>-<n>`
and a live run supplies no `n` until Half A lands. Fifteen criteria is at this role's ceiling, and
the precedent is unanimous — Q-0013 refused at eighteen and split in three, Q-0122 accepted twenty
and paid three implement rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1
`blocked`.

## E-4 — the run returned `ready` on iteration 2, and both of iteration 1's blockers were its own to rule

Recorded because it is uncommon and because of what it says about the loop. Iteration 1 returned
`needs-input` on two blockers; iteration 2 opened on an **unchanged tree** and ruled both — the
transport by measuring that the three landed sentences survive one option and not the other, and the
split by measuring the dependency direction. That is the second requirements run in this stretch not
to exhaust, after Q-0127, and **the fourth recorded case of a second pass on an unchanged tree
finding something anyway** (Q-0105, Q-0122, Q-0125). The rule it does not break is the one Q-0090 and
Q-0096 established — *a retry on an unchanged tree cannot rule its own blocker* — because these were
not blockers about the tree; they were questions the document could answer by measuring the tree it
already had.

## E-5 — GO-4 is not optional here, and GO-5 is the operator's at the close

**GO-4**: every truncated review's omitted tail is read by hand, cross-vendor, with the ratio and the
file set recorded per round. Q-0129 measured that set growing **10 → 13 → 14 → 15** across four
rounds while the visible share fell 78.9% → 70.2%, and the hand pass over it found a defect at four
live sites no reviewer had seen. **Q-0128** accumulates that evidence.

**GO-5**: verified forced in both environment rows and recorded. Q-0016's equivalent was reported
discharged when its by-hand half had not been performed; every gate since has been written to be
unfakeable for that reason, and this one is no exception.

## E-6 — ruled at the review exhaustion gate: one finding refused as an instrument escalation, one accepted as a trade rather than as a defect

Three review rounds, four majors, **every one about the same guard** — AC-6's clause forbidding the
run number's narration being parsed — while **the subject stopped moving after round 1**. Round 1:
the clause exempted two files so its own fixture could carry the literal, turning a corpus-wide
prohibition into a register of exceptions. That was right and was fixed. Rounds 2 and 3 each asked
for a strictly stronger instrument against a corpus that contains **no extraction of any form**.

### (a) Round 3's Major 1 is refused — *a criterion's `Test:` clause bounds the instrument*

It asks for the text scan to be replaced by *"preferably a type-aware lint rule"* covering
data-flow through object properties and unary coercion. **AC-6's `Test:` clause reads**: *the new
clause is shown red over a fixture that parses `run #` out of a message, and green over the shipped
corpus.* That is the job the criterion gives the instrument, and it is met.

This is *"An adapter records the version it was verified against"*'s erratum E-1 rule at a sixth
site: **a reviewer may find that the instrument fails the job its `Test:` clause gives it — which is
exactly what round 1 found — and may not raise the job.** The escalation here is monotonic across
three rounds, which is the shape that rule was written for.

**And its recommended remedy contradicts a landed entry.** *"Type-aware linting is on for exactly
one rule"* (2026-08-27) is a decision, and `@typescript-eslint/no-deprecated` is that rule; adding a
second is an entry `developer-generalist` may not write, so the finding names a remedy no step on
this route may take.

### (b) Round 3's Major 2 is accepted as the trade it is, and is NOT reverted

The reviewer is literally right that AC-6's words authorise forbidding extraction *from event prose*
and that `COERCES_TO_NUMBER` bans `Number`, `parseInt` and `parseFloat` under `apps/web/src`
outright. But it reads a **deliberate, measured and documented trade** as an accident, and the trade
is what answers round 2's own finding: anchoring on the **coercion** rather than on the operand is
what survives aliasing, an assembled literal and any number of hands the string passed through —
*"what makes a number is the coercion rather than the operand"*, which is the implementer's sentence
and is correct.

**Its cost was measured rather than assumed: there are zero occurrences of all three under
`apps/web/src` today, tests included.** A screen that needs a number is handed one — `WireRun.runId`
is a typed `number`, which is the whole of what this ticket did. The residual is stated in place
rather than implied: `+text`, `text * 1` and `charCodeAt` coerce too and are not needled, because a
needle reporting every `+` is one a reader learns to override.

**What the finding does earn is the exit condition, written down**, because a constraint wider than
its criterion's words must say so where it fires: the clause is deliberately broader than AC-6, the
day `apps/web/src` legitimately needs one of the three it is **narrowed rather than overridden**, and
that is a visible act. Verified by hand at this gate that the failure message names the reason rather
than only the file.

### (c) The answer is `advance`, and the remedy for what remains is a hand repair

E-7 of Q-0129 named the same remedy in the same situation one ticket ago and it applies unchanged:
a loop escalating the instrument is not converging, and a fourth grant buys a fifth finding rather
than a fix. The run completes through `integrate`, and anything owed is repaired on `main` after the
gate on Q-0073's and Q-0080's precedent.
