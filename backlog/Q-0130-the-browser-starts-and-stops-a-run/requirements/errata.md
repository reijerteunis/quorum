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
