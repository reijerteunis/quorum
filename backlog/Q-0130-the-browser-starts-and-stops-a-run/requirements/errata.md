# Q-0130 — errata

Written at the requirements gate on 2026-09-17, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and the chore implement step reads **this file** and not `ticket.md`
(Q-0125).

`requirements/merged.md` is the specification, ready on its first pass at fourteen criteria with the
split seam named in advance. Nothing below changes a criterion.

---

## E-1 — GO-1 ratified: no decision entry is owed, and the ticket body's guess is corrected

The body said *"a decision entry is likely owed"*. **Measured, the answer is no**, and the
measurement is §0's M-3 rather than a preference: the register moves by **one row** — `'/stop'` from
`null` to `daemon-endpoints.ts` — and a start needs **no new path literal at all**, posting to
`DAEMON_ENDPOINTS.runs`, which that module already declares and `fetchRuns` already reads. **The
permitted module set stays exactly two.** So the question the body posed — *is this still one
boundary or a family?* — is answered by arithmetic: one boundary, widened by one permission.

`docs/decisions/` holds no entry ruling what `apps/web` may write, checked both ways. Q-0016 widened
that boundary from zero writes to one and took no entry; widening it by two acts on the same rule,
under the same guard, with the module set unchanged, is the same kind of change. The reasoning
belongs in the guard's own authority comment — Q-0108's precedent.

**The one answer that would owe an entry is OQ-4 answered yes**, and E-2 rules it no, so no criterion
depends on an entry being written.

## E-2 — the five open questions are ratified as ruled

They were **stated rather than asked**, which is Q-0105's remedy for this exact pattern, and each
records what moves if overturned. Ratified in full:

- **OQ-1 — the ticket page, not a board card.** The board names flows per *column* and a ticket is
  not the subject of that naming.
- **OQ-2 — a stop carries a constant naming this surface**, declared once, rather than free text or
  nothing.
- **OQ-3 — the shell's *Run flow* control does not flip.** It has no ticket, so it would need a
  picker nobody has designed, and its comment is already correct about why it is disabled.
- **OQ-4 — the browser may NOT send `auto`.** *"Human-gated by default"* is a quality pillar and a
  browser checkbox that flips it is a decision rather than a control. This is the answer that owes
  no entry; the opposite would owe one.
- **OQ-5 — the chore route**, which E-3 takes.

## E-3 — OQ-5 ruled: the chore route

`requirements` → `chore`. Adopted as recommended, and the reason is re-derived rather than copied
from Q-0015's E-9, which ruled the other way on a different ticket: **that one had a behaviour change
with an eviction rule and three red-testable properties; this one is `apps/web` plus one register row
plus two client functions.** Q-0015's full route cost **$296.00** against Q-0016's $126.68 and
Q-0127's $108.67, and its own closing record is that $81.27 of its development stage bought one
three-line change — because findings in files no task owns cannot reach the fan-out. This ticket's
surface has the same property and a smaller behavioural core, so the chore route is where its
findings can actually be acted on.

## E-4 — GO-4 is this gate's standing obligation, and it is written the way it is because of Q-0016

The demonstration is **performed and transcribed, not reported**: the daemon started with
`quorum open`, a flow started **from the browser** on a real ticket — a dry walk first, on M-10 —
watched in mission control, and a run stopped from that screen. `runs.log` records the ticket, the
flow, the handle the start answered, what `GET /runs` listed afterwards, and what the daemon answered
the stop with.

**It is phrased to be unfakeable because the operator faked it once.** Q-0016's GO-6 asked for the
product run by hand and it was reported discharged when its by-hand half had not been performed;
Q-0015's gate found that, and Q-0015's own AC-14 was then transcribed rather than paraphrased for the
same reason. A closing entry that says *"verified by hand"* without the handle and the answers is not
evidence, and this obligation does not accept one.

## E-5 — the ticket body survived re-measurement, which is recorded rather than assumed

Nine of its claims were re-checked against the tree before this run and **all nine held**, across a
shipped Q-0015 that edited three of the files the body names. It is the first body in this stretch to
survive the check; Q-0016's was refuted three times, Q-0015's three times, Q-0127's twice. The
difference is visible and worth keeping: **this body was written by the flow at a gate from a merged
requirement, and those three were written by the operator from the plan.**

## E-6 — four of five majors are one class; the next round fixes the class, not a fifth instance

Written at the second exhaustion gate, after review rounds 1–4. **Counted rather than impressed:**

| round | finding | surface |
| --- | --- | --- |
| 1 | a pending confirmation captured for one subject executes under another | `run-lifecycle.ts` |
| 1 | the stop confirmation stays actionable after the run is no longer `running` | `mission-control-screen.tsx` |
| 3 | availability keyed on the metadata **request** state, so an in-flight re-read withdraws a control the daemon still licenses | `mission-control-screen.tsx` |
| 4 | the confirmation stays actionable after a refresh makes the selected flow ineligible | `ticket-page.tsx` |

**One class: a confirmation outliving the premise that made it offerable.** Round 1 named it, each
round closed the instance it was handed, and the next round found the same defect on a sibling
surface. That is *fixing the instance a reviewer names rather than the class it belongs to* — the
failure this repository has recorded most, at Q-0112 three times in one ticket — occurring four times
inside one review loop, and it is the reason this ticket is at its second exhaustion gate rather than
integrated.

**Round 3's finding is the one that proves it is a class rather than a list.** It is not a new
defect; it is round 1's second fix overshooting, and it overshot by substituting a **request** state
for a **run** state — which `docs/GLOSSARY.md`'s **Connection state** entry forbids in as many words:
*"It is not run state: connection state describes this browser's transport and can change without
changing the daemon run."* A per-instance fix had to re-derive that boundary each time and got it
wrong once.

**What the next round must do.** Not a fifth guard on a fifth surface. **One mechanism**, where the
confirmations already live: a pending confirmation carries the premise it was offered under, and is
withdrawn when that premise no longer holds — subject, run state as the daemon last *reported* it,
and flow eligibility alike — with the three existing call sites reduced to supplying their premise.
An in-flight or failed read is **not** a premise that has stopped holding; it is a read in progress,
and AC-8 already says availability rests on the daemon's last reported state.

**And one test per call site is not the evidence.** The evidence is that a **fourth** call site
cannot be added without supplying a premise — the register shape AC-11 already uses for writing
functions, which round 3 rebuilt to see all function forms after round 2 found it blind to arrow
functions. A guard keyed on one syntactic form is this cut's other recurring class and the two should
not be traded against each other.

## E-7 — E-6's rule was incomplete, and round 5 applied it exactly as written

E-6 said *"An in-flight or failed read is **not** a premise that has stopped holding; it is a read in
progress."* That is true and it is not the whole rule, and round 5's `holds` predicate is what the
half-rule produces: **any** unavailable input preserves the confirmation, including when a *different*
input has conclusively reported the premise gone.

**The completed rule.** A premise has three states, not two — *holds*, *lapsed*, and *unknown* — and
they compose asymmetrically: **one conclusive `lapsed` withdraws the offer whatever else is unknown,
and `unknown` alone never does.** An unavailable read is `unknown` for **its own** input only; it may
not mask a sibling input's `lapsed`. So the inputs are kept as independent last reports rather than
collapsed into one boolean, which is the same discipline `containment` and `push lag` already use —
a state meaning *could not tell* that is never reported as either of the other two, and never allowed
to stand in for them.

**This is the operator's imprecision rather than the implementer's error**, and it is recorded that
way because the same half-rule would be re-derived by anyone reading E-6 alone. The mechanism built
in round 5 is right and is not to be rebuilt: what changes is the predicate inside it, and the test
the review names — both mixed success/failure refresh sequences, so that neither ordering can pass by
the other's evidence.
