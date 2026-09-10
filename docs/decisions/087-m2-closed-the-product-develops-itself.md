# M2 closed: the product develops itself, through two of its seven flows — 2026-09-10

**Decision:** M2 is complete. All five done-when criteria are met, verified against the tree rather
than against this plan: the monorepo scaffold stands (pnpm, Turborepo, `strict: true`, Vitest,
ESLint); `packages/core` holds the eight ported subsystems — `adapters`, `backlog`, `contracts`,
`engine`, `fanout`, `git`, `lint`, `run-history` — and imports `zod` **zero** times, the schemas
living in `packages/shared` as `04-architecture.md` always said; one suite runs on Vitest and CI
runs it on every push across **three** jobs where seven stood before the cutover; `packages/cli`
dispatches all **eight** commands and `quorum` runs from a clean clone by the two paths this
repository claims and tests; and `harness/` and `backlog/` are what drive the work — `spike/` is
gone, and `pnpm exec quorum board` and `quorum run` are how this repository develops itself.

**What it cost.** **$2,803.12 billed and 3.63 billion tokens across 197 runs**, over 85 tickets: 55
run through the flows, 15 finished by hand, 11 still open, 4 abandoned. It produced **48 decision
entries**, 039 to 086 — more entries than the two milestones before it produced tickets.

**The measurement that reframes the milestone, and it was not looked for.** The seven-stage SDLC
this product is *about* was exercised by **four tickets in total**. `solutioning`, `qa-red` and
`development` have run for Q-0006, Q-0011, Q-0033 and Q-0050 and for nothing else; `review` for
three of those four; and three of the four are **M1's**, not M2's. Every other ticket that ran went
`requirements` → `chore` — 62 and 55 runs against 39 for the whole of the rest. Two of the seven
flows, `qa-final` and `deploy`, have never existed at all: that is Q-0012, still open.

This is not a failure and it is not what the dogfooding claim sounds like. The chore flow was
created in M1 for *"machinery and configuration work"* (2026-08-24), and **M2's work was machinery**
— a scaffold, a port, a CLI, a cutover. The route matched the work. What follows from it is a
sequencing fact rather than a reproach: **the flows M3's feature work will use have four tickets of
evidence between them, all from August, while the route it will not use has fifty-five.**

**What the money bought, measured over the whole corpus rather than per ticket.** **145 review
verdicts: 108 `revise` and 37 `approve` — 74%.** The plan cited 71% from a sample of 59 partway
through; re-derived over every run, it did not move. That number is the milestone's actual product:
a cross-vendor panel that disagrees with its writer three times in four, and whose findings this
page records as real far more often than not. The gate answers behind it are 139 `advance`, 29
`retry` and 11 `abort`.

**What kept going wrong, stated as one thing.** Q-0009's port closed on the finding that its cost
*"was scaffolding rather than porting"* and that all five decisions it produced were about **checks
reporting success over a subject they had not examined**. M2 never stopped producing that defect,
and the instructive instances are the ones inside the instrument: a guard whose needle matched
nothing including its own subject (Q-0111); an assertion whose verdict came from the checkout rather
than the commit, found inside the sweep built to forbid exactly that (Q-0105); a scanner blind to
every root-level file, in the guard written to close that class (Q-0108); and a preflight that had
silently deferred a range on **every chore run this repository has ever performed** (Q-0082). The
rule that came out of it is not new but it is now paid for: *a check is not established by reading
it* (2026-08-29).

**The second recurring failure is the operator's, and it is worth naming because it is mine.**
Fixing the instance a reviewer names rather than the class it belongs to — three rounds of Q-0112,
two of Q-0067, and, most clearly, an erratum in Q-0039 that narrowed a guarantee at two sites and
left the third standing in the glossary, caught by the next review rather than by its author.

**Fifteen tickets were finished by hand, and each had a reason that generalises.** They fall into
four kinds: the deliverable **is** a decision entry, which no step in any flow may write (Q-0082,
Q-0085); the change is to the flow or engine the run itself loads at start, so the run could not
benefit from its own fix (Q-0083, Q-0086, Q-0087, Q-0088, Q-0089); the gate costs more than the work
(Q-0108, Q-0110, Q-0111, Q-0112); and something was broken now (Q-0063, Q-0104). Q-0077 is its own
kind — the flow could not review a merged ticket, so the fix for that had to be made outside it.
**This is the honest form of the dogfooding claim**: the flows are the route for work that changes
what the repository *does*, and roughly one ticket in five changes what it *is*.

**Alternatives considered:** Closing M2 when Q-0010 shipped on 2026-09-06, which is when the
done-when was first met — rejected, because Q-0039 was named by both the M1 and Q-0034 closing
entries as landing before M3's daemon makes concurrent runs ordinary, and closing a milestone over
a known blocker for the next one is how the carried-items list at the end of that section grew in
the first place. Holding M2 open until the remaining eleven tickets are done — rejected: none is a
done-when item, they are defects and design questions with their own priorities, and a milestone
that closes only when its backlog is empty never closes. Leaving Q-0006, Q-0011 and Q-0033 at the
stages a backward edge left them at — rejected, and swept: a board that misreports three tickets is
wrong about the one question a board exists to answer, which is the finding M0's close already
recorded once.

**Why:** M2 was the milestone that turned a spike into a product, and the thing to record is that
**it was not the port that cost the money**. Q-0009's fourteen children came to $657 and Q-0010's
eleven to $728; the remaining $1,400 went on defects, guards and rulings found *while* doing that
work, which is the same shape M1's close reported one layer down. The risk M2 was ordered to retire
— *can the spike become the product's core?* — was retired early and cheaply. What it actually
bought was the evidence that **this project's failures are evidential rather than mechanical**: the
engine works, the adapters work, the flows run, and what breaks is a check that did not examine its
subject, a document that drifted from the code, or an obligation recorded somewhere that is not a
ticket. Three of those obligations were found orphaned in a single week (Q-0110, Q-0111, Q-0112),
each having lived only inside a closed ticket's prose or a source comment, one since 2026-09-02.

M3 is a different kind of risk and the ordering above is the warning: it is the first milestone
whose work is **product behaviour** rather than machinery, so it is the first that will run the
flows this product exists to sell, on a route with four tickets of evidence. It also makes
concurrent and unattended runs ordinary, which is why Q-0039 landed first and why Q-0113 and Q-0074
are named in the plan as wanting settling before the daemon rather than after it.
