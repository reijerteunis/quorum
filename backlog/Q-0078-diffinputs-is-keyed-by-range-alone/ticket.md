---
id: Q-0078
title: A deferred diff site can be served an earlier site's cached materialisation
stage: draft
owner: ruud
repos: []
branch: harness/Q-0078/integration
priority: p3
created: 2026-08-30
iterations: {}
history: []
---
Found by Q-0038's round-4 reviewer — the first review round in that run to examine the code rather
than the implement report — and ruled out of scope there by `requirements/errata.md` E-3(b), which
this body carries forward so the obligation does not expire. Belongs to M2 in
`docs/06-development-plan.md`.

**The defect.** `ctx.diffInputs` is keyed by the interpolated range alone. A diff site in an early
group materialises `X...Y` while both endpoints are pre-existing; a later group's step then creates
`Y`; a second site over the identical range is correctly classified as deferred and is *not*
materialised — and then `buildPrompt` hands it the first site's bytes anyway, because
`ctx.diffInputs?.get(range) ?? …` prefers the cache unconditionally. The consumer is billed against
evidence captured before its producer ran, which is the failure the deferral exists to prevent.

**It is pre-existing, and Q-0038 neither introduced nor widened it.** `buildPrompt` is byte-identical
before and after that change — Q-0038's engine diff has five hunks and `buildPrompt`'s diff branch
falls in none of them. Neither the old preflight nor the new one removes a `diffInputs` entry when a
later site defers the same range: the old code recorded the deferral and `continue`d, the new one
records it and never materialises. An earlier materialisation survives on both texts.

**It is not reachable in any shipped flow, in either tree.** It needs one range read both before
*and* after its producing step. `chore.yaml:32`'s only diff site follows its producer;
`review.yaml:12` and `:19` are parallel members of one group with no producer between them, and the
same holds for `spike/templates/harness/flows/`. So this is a latent hazard in the mechanism, not a
live defect — which is why it is a `p3` and why it was right to keep it out of Q-0038.

**Why it needs a requirement rather than a line.** The obvious fix — delete the cached entry when a
range is deferred — makes the two sites materialise the same range separately, at different moments.
That is precisely what Q-0038's AC-10 (*"every panel member receives identical bytes"*) and its risk
R-D forbid, and the once-per-distinct-range guarantee is load-bearing: it is what stops one range
costing n git spawns across a fan-out wave. So the ticket is a choice among at least three, and the
choice is the work:

1. **Key the cache by site as well as range** — every site gets its own entry, so a deferred site
   cannot read a materialised one's. Costs the dedup across a panel unless sites that are not
   separated by a producer still share.
2. **Invalidate on deferral** — drop the entry when any site defers that range. Simplest, and it
   demotes the earlier site to step-time materialisation, so two members of one group could see
   different bytes.
3. **Accept it and forbid the shape** — a `harness lint` rule refusing a flow that reads one range
   both before and after a step creating an endpoint of it. Nothing is materialised twice and the
   hazard becomes unrepresentable, at the cost of a rule that has to compute step order.

**The discriminating test the reviewer asked for, which none exists today:** a flow consuming the
same range before and after its producer, asserting the second consumer receives bytes that include
the producer's work. Write it before choosing, and demonstrate it red — *"a check is not established
by reading it"* (2026-08-29).

**Sequencing.** Lands in `spike/src/engine.js`, and after Q-0051 has ported the diff subsystem it is
a two-tree change (the Q-0066/Q-0068 shape). Doing it before Q-0051 keeps it to one tree — the same
argument that put Q-0038 ahead of Q-0051 — but unlike Q-0038 it does not block the port, because
Q-0051 preserves whatever behaviour is here.
