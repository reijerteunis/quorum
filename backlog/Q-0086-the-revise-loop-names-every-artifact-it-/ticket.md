---
id: Q-0086
title: The revise loop names every artifact it rewrites by run and iteration
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0086/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
*Implemented by hand 2026-09-01, in the same session that closed Q-0037. The stage is `reviewed`
by hand and the history is deliberately empty: no engine run advanced this ticket, and none could
have — see "Why no flow ran it" below.*

Opened from Q-0037's erratum E-2 and implemented immediately rather than queued.

**The defect.** `chore.yaml`'s `implement` step declared `output: { writes: [dev/implement-report.md] }`
— one flat path the engine rewrites on **every traversal of the revise loop**. So a revision round's
report replaced the previous round's, and the measured evidence a criterion had been verified with
stopped existing while the run went on reporting green.

**It is Q-0057's defect on the other side of the same loop.** That ticket moved the review artifact
to `review/chore/run-{run}/chore-iter-{iter}.md`, write path and input glob together, and left the
implement report flat beside it. The reasoning it recorded — that the engine writes an agent's
document verbatim and never adds a header, so the *path* is the only place identity can be stamped
— applies unchanged to the report.

**How it surfaced, which is the part worth keeping.** Q-0037's review round 2 reported that the
current report omitted evidence AC-3, AC-4, AC-5 and AC-8 explicitly require, and that a general
reference to *"round 1's work"* preserved nothing. That reviewer was right and could not have known
why: round 2's implementer had changed only what round 1's review asked for, and could not keep
round 1's evidence because it does not own the file. Round 1's 471-line report was recoverable only
because an unrelated commit's `git add -A` happened to catch it — luck, and Q-0037's E-2 records it
as luck rather than as a mechanism.

**The fix, in both shipped copies.** `implement` writes
`dev/chore/run-{run}/implement-iter-{iter}.md` and `review` reads
`dev/chore/run-{run}/implement-iter-*.md` — the mirror of what `review` writes and `implement`
reads. `harness/flows/chore.yaml` and `spike/templates/harness/flows/chore.yaml` together, which
`lint.test.ts`'s existing parity assertion would have failed had only one moved. No engine change:
`{run}` and `{iter}` already interpolate on any step, `Backlog.writeFile` creates nested
directories, and `Backlog.readFiles` globs the basename inside `path.dirname(pattern)`, so a nested
path with a glob in its last segment already resolves.

**The rule is the pair of variables, not either one**, and the guard says so in three separately
demonstrated clauses: `{run}` alone lets iteration 2 overwrite iteration 1, `{iter}` alone lets run
2 overwrite run 1, and a reader glob without `{run}` mixes runs. `packages/shared/src/flow.test.ts`
asserts it over the **shipped file** rather than a fixture, because the shipped file is what a run
loads, and it additionally refuses the flat spellings anywhere in that file — a second `writes:`
naming one would satisfy the four positive assertions. Each clause was shown red on its own before
the change was trusted, per *"a check is not established by reading it"* (2026-08-29) and Q-0071's
narrower point that showing a guard has a subject proves it fires and not that each clause does.

**Registered, not worked around.** Q-0072's input guard refused the new `read(chore!)` site because
its path is not a quoted literal. It is registered in `INDIRECT_ROUTES` with the reason the value
is a literal — it comes from `flowFiles()`, the audited walk of `harness/flows` — which is the
machinery working as designed and the fourth ticket to earn a registration on the way in.

**Why no flow ran it.** The change is to `chore.yaml` itself, and every chore run loads the flow at
run start — so a run fixing this flow could not benefit from its own fix, exactly as Q-0057's could
not. Running it through the chore flow would also have meant an implement step editing the file
governing its own output path mid-run. Verified by hand instead: both suites forced, `harness lint`
6/6, and the three red demonstrations above.

**Reported and not fixed.** `dev/integration.md` and the `integrate` step's other outputs are
**run**-scoped only by accident — `integrate` runs once per run, so no revise loop rewrites them,
but a second run of the flow on a ticket still replaces the first run's. That is the same class at a
much lower frequency, it spans `development.yaml` and `qa-red.yaml` as well as `chore.yaml`, and it
wants its own requirement rather than being widened into this one.

Belongs to M2 in `docs/06-development-plan.md`.
