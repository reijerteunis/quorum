# The plan and the backlog are checked against each other, and the two directions are not the same — 2026-09-01

**Decision:** `packages/shared/src/plan-backlog.test.ts` holds `docs/06-development-plan.md` and
`backlog/` to each other, with a deliberate asymmetry:

- **backlog → plan is absolute.** Every ticket folder that exists must be named somewhere in the
  plan. A ticket that exists is work in flight, the plan is where this project records what is in
  flight, and there is no legitimate reason for one to be missing. This direction takes no
  exceptions and has none.
- **plan → backlog is registered, not absolute.** Only the **current milestone's** bullets are held
  to it, because M3–M6 name their tickets long before anyone creates them — that is what a plan is
  for. Even there a bullet may legitimately name uncreated work, so those live in an `UNCREATED`
  register carrying the reason each does not exist. A new uncreated bullet fails until someone
  classifies it.

The register is keyed by identity and guarded in both directions: an entry naming a ticket that now
has a folder fails, and an entry naming something that is not a current-milestone bullet fails,
so it cannot quietly stop excusing anything.

**Alternatives considered.**

*Symmetry — every plan id must have a folder.* Refused on measurement rather than taste. The plan
names **84** ids and `backlog/` holds **59**; the 25-way gap is almost entirely M3–M6's ticket lists
plus M1 items deliberately never created, so a symmetric rule would be red on landing and would stay
red for months. A guard that cannot be green is not a guard.

*Only backlog → plan.* This is the cheap half and it would have caught Q-0074 and Q-0077, which sat
in `backlog/` for three days unnamed. It would **not** have caught Q-0039 and Q-0040, which had full
entries in M2's list and no folder for a week. Both directions were observed inside four days, so
shipping the half that happened to catch the more recent one would have been fitting the guard to
the last defect.

*A lint in `harness lint` or a CLI command.* Refused: `harness lint` validates flow files against
the engine's own reader, and this is a documentation-consistency question with no runtime subject.
It belongs where `docs.test.ts` already checks `DECISIONS.md` against `decisions/` — the same shape,
one directory over.

**Why.** The drift is the class *"a claim nothing executes"* that this repository keeps paying for,
one layer up from where Q-0072 and Q-0073 closed it. The plan is the artifact a reader trusts to say
what is in flight, and it was wrong in both directions within four days without anything noticing —
the second instance found only because a `/milestone` listing was cross-checked by hand. The
asymmetry is the load-bearing part and is stated here rather than left in a comment, because a later
contributor meeting a one-sided guard will reasonably try to make it symmetric, and the measurement
above is the answer.

Both directions were demonstrated red before the guard was trusted: removing `Q-0077` from the plan
fails the first, adding an unregistered M2 bullet fails the second, and emptying the register fails
the second plus its own load-bearing check.
