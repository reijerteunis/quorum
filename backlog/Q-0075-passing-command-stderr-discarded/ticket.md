---
id: Q-0075
title: A passing command's stderr is discarded, so a green suite loses its warnings
stage: draft
owner: ruud
repos: []
branch: harness/Q-0075/integration
priority: p3
created: 2026-08-28
iterations: {}
history: []
---
Opened 2026-08-28 from Q-0070's OQ-6, whose successor body the merged requirement wrote out in full
so it would outlive the ticket that found it.

**The asymmetry.** `runCommand` returns stdout **only** on the success path, and stdout followed by
stderr on the failure path. So a suite that passes with warnings loses them: whatever it wrote to
stderr is thrown away precisely when nothing else is wrong. `packages/core/src/fanout/command.ts`
documents the asymmetry in `CommandResult`'s own JSDoc and **nothing tested it** until Q-0070's AC-2
did — `printf hello` writes no stderr, so the landed shape pin could not see it.

**Q-0070 preserved it deliberately, and that is not the same as endorsing it.** The port charter
preserves behaviour, and changing this inside a fix for the capture would have been scope creep
wearing a bug fix's clothes. What Q-0070 did instead was make it visible, written down and tested,
which it was not before. This ticket is where the choice actually gets made.

**Why it is not obvious.** Changing it means every *green* `integrate` run's `dev/integration.md`
and persisted `output.txt` gain turbo's and vitest's stderr, which is most of their output. So the
question is not *"is stderr useful"* — it plainly is — but **"is `out` the artifact a human reads or
the one a machine parses"**, and `testReport` (`spike/src/engine.js:505–516`) already answers that
differently for each. An answer that does not distinguish the two consumers will be wrong for one of
them.

**Landing constraint, inherited.** Any change lands in `spike/src/fanout.js` **and**
`packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068/Q-0070 shape — or the port loses
the independent witness the freeze exists to provide. Q-0070's AC-2 tests pin the current behaviour
in both trees (`stderr is discarded on the success path`), so they are the assertions this ticket
would deliberately change, in both trees, rather than discover.

Belongs to M2 in `docs/06-development-plan.md`.
