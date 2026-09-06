# Errata — Q-0107

Rulings on `requirements/merged.md`, written at a gate. **The window for an erratum is a gate** — one
landed between a review returning and the next implement starting reaches neither (Q-0094 E-3(a),
Q-0097 E-1/E-2). Run 2's implement round 3 correctly declined to write this itself and returned the
question, citing GO-5.

## E-1 — AC-10's completeness is *visible* for the disposed half, not *derived*. 2026-09-06, at the hand-finished gate of run 2.

**Ruling: option (2) of the round-3 report.** AC-10's *"a site with no verdict fails"* binds the sites
that **exist in the tree at test time** — which the live scan and `EXCLUSIONS` enforce by derivation —
while the **already-disposed** half is a *visible* register protected by `ROWS`, an identity rather
than a count. AC-29's "derived" applies to the live half. The shipped guard satisfies AC-10 and AC-29
as now read, and no code moves.

**Why the alternative routes are refused, each on a measurement the round supplied and this gate
re-verified.**

- **A pre-change scan at test time** needs `git show` against a commit the branch is merged from, and
  the clone depth is not uniform: `ci.yml`'s `workspace` job uses a bare `actions/checkout@v4`
  — depth 1 — while **both** sweep jobs set `fetch-depth: 0` (`:153`, `:179`). **Verified at this
  gate.** One commit would pass in two jobs and fail in a third, and a `--depth 1` contributor clone
  would fail where a full clone passed. *"A test's verdict is a property of the commit, not of the
  checkout or the account"* (2026-08-30) forbids it.
- **Pinning that scan's output as a constant** puts **both operands in one file**, so the comparison
  can only fail when somebody edits the check. That is class (a) of *"A check outlives its subject
  only if it can still fail"* (2026-09-05) — installed inside the guard written to retire class (a).
  Refused on the entry GO-1 made blocking, not on cost.
- **Deriving membership from prose** selects **83** test-side files against the **24** the register
  names; the other 59 carry JSDoc about behaviour that genuinely came from the spike and stays true
  after the deletion, which **AC-19 forbids touching**.

**What this costs, stated rather than implied.** A row deleted from the disposed half by hand is
caught by `ROWS`'s identity arithmetic, not by a derivation — so the guarantee there is Q-0073's
*"a count is not an identity"*, one level weaker than the live half's. That is a real limit and it is
recorded here so a later reader meets it as a ruling rather than re-opening it as a defect. It is the
third time this ticket's own subject has appeared inside the guard built to retire it.

**What does not change.** AC-11's demonstrated-red requirement is untouched, and so is every verdict's
authority under decision 079. This rules the completeness *mechanism* for one half of one register; it
rules nothing about what any individual site's disposition may be.
