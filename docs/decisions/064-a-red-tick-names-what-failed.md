# A red tick names what failed, not what was skipped — 2026-08-29

**Decision:** `harness/harness.yaml`'s `commands.test` gains `--continue`, so it reads
`npm test --prefix spike && pnpm turbo run test --force --continue`. Turbo's root `test` task
declares `dependsOn: ["^test"]`, which is correct for a green run — a dependent's pass means nothing
if its dependency failed — and **backwards for a red one, where every failure is the deliverable**.
Without `--continue`, a failing upstream package prunes every downstream package, and an `integrate`
step with `expect: fail` reports a red it cannot describe.

**No verdict changes, and that is what makes this safe.** Turbo still exits non-zero when any task
fails, measured on turbo 2.10.11 against a tree with two failing packages: exit 1 either way. So
`expect: pass` and `expect: fail` reach the same conclusion as before; the only difference is what
the report contains. This is a change to what the artifact can *say*, not to what the step decides.

The shipped template keeps `npm test` and gains a comment, because the template cannot know which
runner an adopter uses — the same shape *"The test command defeats its own cache"* (2026-08-27)
chose for `--force`, and for the same reason. `core` learns nothing about any runner; this is
configuration, and the test that enforces that refusal is untouched.

**Alternatives considered.**

**Leave it, and open a ticket.** The default, and refused: the fix is one flag in one file, the
measurement was already in hand, and the defect blinds the very step that would have to prove any
successor's work. Carrying it would have meant a second ticket opened by a ticket, which is the
habit this entry deliberately breaks.

**Different commands for `expect: fail` and `expect: pass`.** Considered because the two steps want
different things from a failing run. Refused because they do not: `--continue` costs a green run
nothing — no task is pruned when none fails — and a second command is a second thing to keep
correct, in the file that has now been wrong twice.

**Fix it in the engine** — have `integrate` parse per-task results instead of reading an exit code.
Refused for the reason 2026-08-27 gives: `core` would have to learn what a monorepo runner is, and
the exit code is a correct summary. What was wrong was the *report*, not the verdict.

**Why.** This is the third time this project has asked what a tick is being claimed for, and the
first time the tick was red. *"A green tick names what it examined"* (2026-08-27) and *"A cache hit
names what the task reads"* (2026-08-28) both caught a pass claiming work that never ran. Here a
**red** claimed a suite that never ran, which is worse in one specific way: a green tick that lies
is caught by the next failure, while a red tick that lies is *accepted as success by the step
reading it* — `expect: fail` was satisfied, `prove-red` wrote `tests=ok`, and the gate was handed an
artifact proving one assertion of thirteen criteria.

**Measured on Q-0050's qa-red run**, 2026-08-29. AC-13b's test lives in `packages/shared` — put
there by that ticket's own erratum, to keep an out-of-package read inside a package that already
declares it — and it is red because the documentation task has not run yet. That single red pruned
`@quorum/core#test` entirely. The run reported `5 successful, 6 total` in **1.101 s**; core's suite
alone takes **26.75 s** forced and was failing **39 tests across 7 files**, all but one an
`AssertionError`, with `tsc --noEmit` clean. Three consecutive review rounds spent their findings on
evidence the step was structurally incapable of producing, and round 2 recorded the defect as
*closed* because `shared` happened to be green that round — it was dormant, not closed.

**Cost accepted:** a failing green run now executes packages whose dependency already failed, so it
is slower and its output is longer in exactly the case where someone is reading it. That is the
trade this entry takes deliberately: a longer report beats a shorter lie.

**A note on when it takes effect, because it is the same trap as last time.** `runFlow` stores
`config` at run start and never re-reads it, so this change could not affect the run that found it —
Q-0065's fix had the identical property and its own `integrate` still replayed. **The first proof is
the next run's `prove-red` line**, and it is worth checking rather than assuming.
