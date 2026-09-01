---
id: Q-0087
title: Every artifact a run can rewrite is named by what makes it unique
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0087/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
*Implemented by hand 2026-09-01, immediately after Q-0086 and for the same reason: the change is to
the flow files a run loads at run start. Stage `reviewed` by hand, history deliberately empty.*

Q-0086 reported the `integrate` artifacts as the same defect *"at a much lower frequency"* and left
them. **That measurement was wrong for two of the three flows, and this ticket exists because
re-measuring it was the first thing done here.**

**What the re-measurement found.** `chore.yaml`'s `integrate` sits *after* its revise loop, so it
runs once per run and only a second run overwrote it — the mild case Q-0086 described.
`development.yaml`'s `integrate` carries `on_fail: { goto: developers, max_iterations: 3 }` and
`qa-red.yaml`'s `prove-red` carries `on_fail: { goto: write-tests, max_iterations: 2 }`. **Both are
inside their own loops**, so every traversal overwrote the previous one's integration notes and test
report — the acute defect, in the two flows whose whole purpose is to show what failed on attempt 1
against attempt 2. Convergence to green is the thing `development.yaml` exists to demonstrate and it
was keeping only the last attempt.

**The rule, generalised rather than another instance patched.** A write path carries `{run}`, and
one a bounded loop can **re-enter within a run** additionally carries `{iter}`. `{run}` alone lets
iteration 2 overwrite iteration 1; `{iter}` alone lets run 2 overwrite run 1, and it restarts at 1
in each run, so it can never name a path by itself. Loop-reachability is derived from each flow's
own `on_fail` edges — every step from a `goto` target through the edge naming it — which is why
`chore.yaml`'s `integrate` is correctly named by the run alone and is not an exception to the rule.

**What moved**, in `harness/flows/` and `spike/templates/harness/flows/` together:

| Flow | Was | Now |
| --- | --- | --- |
| `chore.yaml` `integrate` | `dev/integration.md` | `dev/chore/run-{run}/integration.md` |
| `development.yaml` `integrate` | `dev/integration.md`, `dev/green-report.md` | `dev/development/run-{run}/integration-iter-{iter}.md`, `…/green-report-iter-{iter}.md` |
| `qa-red.yaml` `prove-red` | `qa/red-integration.md`, `qa/red-report.md` | `qa/red/run-{run}/red-integration-iter-{iter}.md`, `…/red-report-iter-{iter}.md` |

`qa/red-report.md` had **two readers** — `write-tests` and `scenario-review` — and both now glob
`qa/red/run-{run}/red-report-iter-*.md`, so each sees every attempt of its own run and no earlier
run's. On the first pass the directory does not exist and `readFiles` returns nothing, which is what
happened before too, so nothing regresses. The other four artifacts are read by no flow.

**The trap this had to walk past, now pinned.** Both engines choose an `integrate` step's *content*
by whether its write path contains the substring `report` — the captured test output if it does, the
integration notes if it does not (`spike/src/engine.js:1241`,
`packages/core/src/engine/composite.ts:340`), tested against the **pre-interpolation** template. So
a rename across that boundary silently swaps what the file holds and nothing else notices. Every new
path was checked against it before it was written, and a register in the guard pins the class each
shipped path selects; renaming `red-integration` to `red-integration-report` turns it red.

**The guard derives, and registers what it does not cover.** `packages/shared/src/flow.test.ts`
computes loop-reachability from each shipped flow rather than listing paths, so a flow that gains a
step or an edge is covered without anyone remembering. The write paths still flat are a **register
with a reason each** — `requirements/merged.md`, `solution/tasks.yaml`, `qa/scenarios.md` and the
rest — because scoping those moves paths that other files name by hand, and a second test asserts
every registered path is still one some flow writes, so the register cannot end up excusing nothing
while reading as coverage. **Fourteen paths are registered: the remaining work is visible rather
than closed.** Five clauses were each shown red on their own before the change was trusted.

**The guard found two defects in itself before it found any in the flows**, which is the part worth
keeping. Its first run reported that `solutioning.yaml` has an `integrate` step the draft register
had not accounted for; adding it then failed differently, because the check read only `writes:`
while `merge-contracts` uses the singular `write:` — the one shipped integrate step that does. A
guard blind to half the surface it claims to cover is this repository's most-recorded defect class,
and it was caught by the register beside it rather than by review. It now mirrors the engine's own
`writesOf` exactly, both forms in the same order.

**Not run through the flows**, for Q-0086's reason: `runFlow` loads the flow at run start, so a run
fixing these files could not benefit from its own fix, and three of the six flows it edits are ones
a run would be executing.

**Not changed:** the inline flow fixtures in `spike/test/**`, `composite.test.ts` and
`flow.test.ts`, which are deliberately independent of the shipped files — Q-0057's precedent, where
a fixture that does not track the shipped flow is the more robust arrangement. No engine change in
either tree, and `spike/src` is untouched, so no freeze re-record is owed.

Belongs to M2 in `docs/06-development-plan.md`.
