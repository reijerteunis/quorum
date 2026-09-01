---
id: Q-0089
title: The verdict file is scoped by default, because no flow author writes its path
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0089/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
*Implemented by hand 2026-09-01, closing the one artifact Q-0087 and Q-0088 could not reach. Stage
`reviewed` by hand, history deliberately empty. **This is the only one of the four that changes
`spike/src`**, so it walks charter §3's mirror-and-re-record.*

**Why the flow-level rule could not reach it.** Q-0088 made every write path in every shipped flow
either scoped or a pointer, enforced by deriving from the flow files. The verdict file is invisible
to that guard because **there is no path in a flow to read**: `output: { verdict: approve|revise }`
declares a vocabulary, and the engine invents the filename. So the one artifact whose path a flow
author never writes was the one the rule could not be applied to — and it is exactly the artifact
where forgetting is invisible, because there is no line for a reviewer to notice missing.

**What it cost.** `.harness/<step>-verdict.json`, one path per step per ticket, rewritten on every
traversal and every run. The file carries `{verdict, findings, summary}` — so on a loop that turned,
**the record of why it turned was destroyed by the round that fixed it**. Measured on a mock run
before and after: the head-of-product's iteration 1 writes `needs-input` with one finding and
iteration 2 writes `ready` with none; under the old default only the second survived.

**The fix is the default, not a `verdict_file:` in each flow.** Setting it per flow would have
avoided touching `spike/src` entirely, and was rejected: a rule that holds only where somebody
remembered to write the key is not a rule, and this is the artifact where remembering is hardest.
The default is now `.harness/run-{run}/<step>-verdict-iter-{iter}.json` in both trees.
**`{iter}` is unconditional rather than loop-aware**, because the engine cannot see whether a
backward edge reaches a given step — the loop analysis Q-0087's guard does over a flow file is not
available at the point of the write — and a spurious iteration number on a step that ran once costs
nothing. That is a deliberate asymmetry with the flow-level rule and is stated rather than left to
be noticed.

**Pinned as three properties, not a string**, in both trees, so a spelling change that keeps the
scoping still passes and one that drops it cannot: scoped to a run, scoped to a traversal, and
**still naming the step** — two steps of one flow both declaring a verdict must not collide, which
run and iteration alone do not prevent. Each was demonstrated red on its own.

**The assertion was first written on the wrong side, and Q-0072's guard is what said so.** Putting
both trees' checks in `packages/shared/src/constants.test.ts` made `shared` read a `packages/core`
source — the dependency direction `04-architecture.md` fixes — and the input guard refused it as an
undeclared read rather than as an architecture violation, which is the same finding arriving through
a different door. The spike half stays in `shared` beside the other spike-source pins; the core half
is in `packages/core/src/engine/q0050.source.test.ts`.

**The one reader moved with it.** `requirements.yaml`'s `head-of-product` reads its own previous
verdict on a retry, and now globs `.harness/run-{run}/head-of-product-verdict-iter-*.json` — same
flow, same run, so a glob is correct where a pointer would be needed for a cross-flow reader.
Verified end to end rather than by reading: occurrence `004-head-of-product` — iteration 2 — has
iteration 1's verdict file in its prompt.

**The sibling artifact needed nothing.** `.harness/<step>-<timestamp>.raw.txt`, written when
structured output fails validation, was already unique per write because a timestamp is in its name.
Checked rather than assumed.

**Charter §3 walked, second time.** `spike/src/engine.js` changed, so the freeze-SHA half goes red
by design; the change lands in both trees in one commit and `freeze-sha` is re-recorded in a
follow-up commit whose parent is that one, per Q-0037's erratum E-1.

Belongs to M2 in `docs/06-development-plan.md`.
