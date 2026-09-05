---
id: Q-0105
title: Nothing checks whether main has been validated by CI
stage: draft
owner: ruud
repos: []
branch: harness/Q-0105/integration
priority: p1
created: 2026-09-05
iterations: {}
history: []
---
**Opened 2026-09-05, from the session that closed Q-0101.** `main` stood **89 commits and four
days** ahead of `origin/main`, so **nothing this month had been validated by CI at all** — the whole
CLI cut, Q-0090 to Q-0101. Every gate in that period reported green from a local checkout, and every
one of them was telling the truth about the wrong machine.

**Q-0073 recorded this exact gap and it was not closed.** Its entry says *"no CI run ever executed
the defective revision"*, with `main` then **15 commits** ahead, and treats that as a caveat on one
table's fresh-clone row. It reached 89. A caveat that nobody converted into a check is how a
measurement becomes folklore.

## What the gap actually hid, measured

Pushing on 2026-09-05 produced three CI runs and two real defects, neither visible to any local gate:

- **Q-0104** — the packed-install fixture died on `ERR_MODULE_NOT_FOUND` for
  `zod/v4/core/json-schema.js`, deterministically, in **three of seven jobs**. It had **never run on
  CI**: the test landed in `68a83f0` (2026-09-02) and the last CI run was `729dcb3` (2026-09-01). It
  was broken on a clean machine for **three days**, on the **cold-clone path M6 turns on**.
- **Q-0102's CI subject** — `fail.test.ts` AC-5 required a 1 MiB write to be truncated by
  `process.exit`, which is a race outcome. Both sweep cells failed on it; the `workspace` job passed
  at the same commit on the same runner image.

**Both had passed implement, cross-vendor review, `integrate`, and a hand verification.** Q-0098's
and Q-0093's plan entries each record the packed path as *"verified end to end after the gate"*.
Both verifications were local. That is the cost of this gap stated precisely: **not that CI was red,
but that four documents said a path worked when it did not.**

## Why this cannot be a test, which is the ticket's real design problem

The obvious instrument is refused by a rule this repository already holds. *"A test's verdict is a
property of the commit, not of the checkout or the account"* (2026-08-30) — and *"has CI run this
commit?"* is a property of a **remote service at a moment in time**, not of the commit. A suite
assertion asking it would need the network, would fail offline, would fail on a fork, and would give
different answers minutes apart at one tree. It is the exact shape Q-0079 built the sweep to forbid,
so the fix may not live in `packages/**/*.test.ts`.

That leaves surfaces that are allowed to know about the outside world:

1. **`harness board`** — it already derives **containment** from git on every invocation and never
   stores it (2026-08-24). A push-lag column is the same kind of fact, computed the same way, and the
   board is *"the one question a board exists to answer"*: what is open and where is the code.
2. **A gate** — a chore run's human gate could report the lag beside its verdict, since a gate is
   where a human decides and is already the window for an erratum.
3. **A script beside the sweep** — `.github/scripts/` already holds one oracle a maintainer runs by
   hand and CI runs identically. A second could report unvalidated-commit count.
4. **Nothing, and say so** — record the gap as accepted, with the argument that a solo maintainer
   pushing on their own cadence is not a defect. This is a real option and the ticket should not
   pretend otherwise; what it must not do is leave the question unasked a third time.

**Recommended: (1), and it is the only one that costs nothing to consult.** A board that says
`main:contained` about a branch while saying nothing about whether `main` itself was ever built is
answering half its own question.

## Open questions

- **OQ-1: what is the fact being reported?** Candidates measured today: commits ahead of
  `origin/main` (89), age of the newest unpushed commit (4 days), and whether `HEAD` has a CI
  conclusion at all. The third is the one that matters and the only one needing the network; the
  first two are pure git and answer it well enough in practice.
- **OQ-2: does this belong to the product or to this repository?** Quorum is product-agnostic and an
  adopter may not use GitHub Actions, or any CI. A board column that assumes a remote and a CI
  service would be product knowledge leaking into the tool — `product-boundaries.md`. A **push-lag**
  column assumes only a git remote, which is why OQ-1's answer decides this one.
- **OQ-3: is this M2 or M6?** The cold-clone test is M6's finish line and is what the gap threatened.
  Nothing forces it earlier, but the gap is what let a broken installation path sit for three days
  and it will do so again before M6.

## Non-goals

- Fixing Q-0104 or Q-0102. Both are already fixed; this ticket is about why nobody knew.
- Making CI a required gate for a run, or pushing automatically. **A push is an outward-facing act
  and stays the human's**, which is the same principle as the human gate — this ticket reports a
  fact, it does not act on it.
- Any change to what the sweep runs. GO-2 of Q-0102 applies here too.

Belongs to M2 in `docs/06-development-plan.md`. Opened from CI runs 33967146498, 33968439312 and
33969196058 — red, red, green.
