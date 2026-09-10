---
id: Q-0102
title: The git-identity sweep is red under load, and CI runs it
stage: draft
owner: ruud
repos: []
branch: harness/Q-0102/integration
priority: p1
created: 2026-09-04
iterations: {}
history: []
---
**Re-measured the same evening: 25 sweeps across two commits and both checkout shapes, 0
failures — see the section below, which exonerates the commit and leaves the sighting standing.**

**`pnpm sweep:git-identity` exited 1 on `main` when this was written, and `.github/workflows/ci.yml` runs it as two
required jobs** — `git identity sweep (bare checkout)` and `(populated checkout)`. So CI is red or
flaky right now. Found on 2026-09-04 while verifying Q-0095's merge, by running the sweep as the
post-merge check Q-0072's closing finding requires.

## What is measured, and what is not

**Measured.**

- The sweep fails in phase **`workspace suite`**, with `@quorum/core#test` red: *"the workspace suite
  is RED under a git configuration that resolves no identity"*.
- **The failures are not stable.** Two consecutive runs at the same commit gave **28 failures across
  10 files** and then **6 across 4**. A verdict that changes without the tree changing is the
  definition of a flake.
- **It is not Q-0095's code.** The sweep is red at `13c390d`, the commit *before* that merge, as well
  as at `bb8e143` after it.
- **The survivors cluster on worktree lifecycle** — `packages/core/src/engine/worktree-lifecycle.test.ts`
  (AC-2, AC-3) and `src/engine/undecided.test.ts` (AC-6, AC-7).
- **Those same files pass 29/29 in isolation**, immediately after a sweep in which they failed, and
  leave no stray worktree behind (`git worktree list` is 1).
- **They do not share a path.** `worktree-lifecycle.test.ts:3` states that every case builds its own
  repository under `os.tmpdir()`, and both files compute
  `path.join(repoDir, '.harness', 'worktrees', worktreeDirName(branch))` against that per-case root.
  **So "make them isolated" is already true and is not the fix** — which is the first hypothesis
  anyone will reach for, and it is refuted before the ticket starts.

**Not measured, and the ticket's actual work.**

- **When it started.** The sweep was green when run by hand after Q-0099's merge on 2026-09-04.
  Everything landing between that and the first red is `docs/` and `backlog/` — a plan pass, Q-0095's
  requirements, the Q-0101 split and the plan figure corrections — none of which touches a worktree
  test. Either a `docs/` change moved a turbo input and re-ran something previously cached, or the
  red is load-dependent and was always latent. **Bisect it rather than reason about it.**
- **The mechanism.** The leading hypothesis is contention: the sweep runs every package forced and in
  parallel, and Q-0095 added `packages/cli/src/end-to-end.test.ts`, which builds isolated workspace
  copies and spawns a process per invocation. More concurrent git and `node` processes than any
  previous suite. But the red **predates that merge**, so the hypothesis is incomplete and must not
  be adopted without evidence.

## Re-measured 2026-09-04 evening: 25 sweeps, 0 failures, and the commit is exonerated

**Measured by hand, on the machine that made the original sighting, before any fix was attempted.**
Every run below is `bash .github/scripts/git-identity-sweep.sh` — the same entry point
`pnpm sweep:git-identity` and both CI jobs use — with exit code, wall time and any Vitest failure
counts recorded per run.

| cell | commit | checkout shape | runs | result | wall time |
| --- | --- | --- | --- | --- | --- |
| idle | `e47fb1d` | populated (working checkout) | 11 | **all exit 0** | 105–110 s |
| 48 CPU burners on 16 cores | `e47fb1d` | populated | 1 | **exit 0**, 7/7 tasks | 162 s (1.5x slower, so the contention was real) |
| concurrent second `pnpm turbo run test --force` in the same repository | `e47fb1d` | populated | 1 | **both exit 0** | — |
| idle | `e47fb1d` | **bare** (fresh clone, both directories absent) | 7 | **all exit 0** | 109–132 s |
| idle | **`bb8e143`** | **bare** | 5 | **all exit 0** | 109–112 s |

**The last row is the bisect this section's predecessor asked for, and it settles the largest
question: the commit is not the variable.** `bb8e143` is the commit named red above. In a fresh
clone with `.harness/worktrees` and `.quorum/runs` absent — CI's bare cell, reproduced rather than
approximated, asserted absent before each run and still absent after — it is green five times out of
five. So no `docs/` or `backlog/` change between it and `e47fb1d` repaired anything, and the red is
**not a property of the tree**. That is this ticket's own thesis, now with the commit positively
exonerated rather than merely suspected.

**Both checkout shapes are covered.** The eleven original runs were in a working checkout, which is
neither CI cell — it carries installed dependencies, turbo caches and run history. The bare cell was
then built the way `ci.yml` builds it, and the clone stays untracked-clean across a full sweep, so
repeated runs in it remain valid.

**Two mechanisms are closed, and neither was the cause.**

- **Cross-file fixture deletion is impossible.** `packages/core/test/repo.ts:15` keeps its temporary
  directories in a module-scoped `created` array that `removeTempDirs()` splices; under Vitest's
  default per-file isolation each file gets its own registry, so no file can delete a neighbour's
  fixture. The first hypothesis anyone reaches for after "make them isolated" is also refuted.
- **CPU contention alone is not sufficient.** Saturating all 16 cores slowed the suite by half and
  it stayed green.

**What is still not measured, stated so the next reader does not mistake this for an all-clear.**
Twenty-five non-reproductions bound the rate; they do not explain the sighting, and they do not make
it false — it was first-hand, and it is left standing above. If the rate were anywhere near the
observed "two consecutive runs both red", twenty-five greens would be a coincidence of order 1e-8,
so either the rate is very low or **the triggering condition was present then and is absent now**.
The instrument is also wrong for the target: this is one machine, 16 cores, darwin 25.3.0, fd limit
1048576, with a warm pnpm store, against CI's two-core `ubuntu-latest`. Untested here: CI's own
hardware, memory and IO pressure as distinct from CPU, and a concurrent *harness run* holding
worktrees, which is not the same load as a concurrent suite.

**The most plausible surviving mechanism, recorded as a lead rather than a finding.** No
`testTimeout` is configured anywhere — `vitest.shared.js` sets only `include`, `exclude` and
`ssr.resolve` — so every test runs against Vitest's **5-second default**, while
`worktree-lifecycle.test.ts` makes **18 synchronous `git` spawns** and `undecided.test.ts` four. A
broad, unstable failure count across many files is what a timeout ceiling produces under contention,
and two cores would reach it far sooner than sixteen. This was not reproduced at 1.5x slowdown and
is not adopted as the cause; it is where the next measurement should aim, on CI's hardware.

## A second instance, in a different test, measured 2026-09-05

**The same shape as the subject above, found while merging Q-0101 and worth recording here rather
than in that ticket, because the ticket it belongs to is this one.**

Immediately after `harness/Q-0101/integration` merged to `main`, the post-merge verification —
Q-0072's *"verify forced in both environment rows"* — went **red in the working checkout**:
`@quorum/cli`'s `build.test.ts` failed Q-0098's AC-19/AC-20 packer-agreement test, *"pnpm pack and
npm pack disagree on which files @quorum/cli ships"*, one packer seeing 57 files including `dist/`
and the other 21. Measured at **2 failures in 6** runs.

**The commit is not the variable, again.** Twelve interleaved iterations per arm, each arm a fresh
clone installed and built so `dist/` exists — the precondition without which the race cannot be
observed at all:

| arm | commit | clone | runs | failures |
| --- | --- | --- | --- | --- |
| post-merge | `8b8781f` | fresh, built | 12 | **0** |
| pre-merge | `edcc7ad` | fresh, built | 12 | **0** |

The working checkout then stopped reproducing it too — 2 in the first 6, **0 in the next 6**, and 0
in a further 4. So: a verdict that changed without the tree changing, in a window, and then
resolved. `main` is green as of this writing, both suites forced 7/7 with 0 cached, and the sweep
exit 0.

**Why it belongs to this ticket.** It is not the git-identity sweep and not `worktree-lifecycle.test.ts`,
so it is not the same *defect*. It is the same *class*, and it is the second measured instance of
this ticket's central claim — that **load is a third term beside the checkout and the account** — now
in a test whose subject is packaging rather than git identity. A hypothesis that only explains the
sweep is too narrow.

**What it excludes.** Four candidate causes are measured and excluded across both instances: the
commit, the checkout shape (bare and populated both), CPU saturation, and a concurrent second suite
run. What survives is something about a long-lived working checkout under sustained use, which
neither instance has pinned.

**One methodological warning, recorded because it cost an hour and nearly cost a revert.** The first
A/B compared a *working tree* against a *fresh clone* and attributed the 2-of-6 difference to the
commit. Those two differ in far more than the commit, and the second design — cloning both arms —
removed the confound and reversed the conclusion. **A verdict read off a checkout rather than a
commit is this ticket's own subject**, and it was reproduced by the investigation into it. The
smaller sample was p ≈ 0.45 and was reported as not significant at the time; it still pointed the
wrong way.

## CI measured at last, 2026-09-05 — red, but not for this ticket's reason

**The premise above had never been observed.** This ticket says CI *"runs it as two required jobs,
so CI is red or flaky right now"*. That was an inference from a local sweep failure: `main` was **89
commits ahead of `origin/main`** and CI had not run since **2026-09-01**, when all seven jobs — both
sweep cells included — were **green**. Q-0073 recorded the same gap at 15 commits; it reached 89.

Pushed 2026-09-05 (`729dcb3..b26413d`). CI run **33967146498**: three jobs failed —
`workspace (lint, typecheck, test)` and **both** sweep cells — and **all three failed on the same
single test**, deterministically:

```
FAIL src/build.test.ts > Q-0098 AC-19 and AC-20 — the packed set installs outside the
     workspace with the registry dead, and runs
ERR_MODULE_NOT_FOUND: .../node_modules/zod/v4/core/json-schema.js
```

**So CI is red, and this ticket is not why.** The failure is `@quorum/cli`'s packaging fixture, one
test, three jobs, identical message — not the unstable `@quorum/core` cluster on
`worktree-lifecycle.test.ts` and `undecided.test.ts` this ticket describes, and not flaky. It is
**Q-0104**, opened and fixed the same day.

**What that does to this ticket.** The sweep cells fail here *because they run the workspace suite*,
which contains the broken test — so their red is inherited rather than their own, and nothing in
this run is evidence about the flake. **The `p1` argument survives on its other half**: a flaky
oracle trains the reader to re-run until green, which does not depend on a rate. What does not
survive is *"every push is red or lucky"* as a statement about observed CI, and the body above now
says so.

**What is still owed here.** The sweep has now been run **35 times locally with no failure** and
CI's own verdict is uninformative until Q-0104 lands. The next CI run after that fix is the first
measurement of this ticket's subject on the instrument that matters — two cores rather than sixteen,
which is where contention was always likeliest and which no local run can stand in for.

## The subject on CI, isolated at last — and it is one assertion, not a cluster

**With Q-0104 fixed, CI run 33968439312 left the sweep cells failing alone**, which is the first time
this ticket's subject has been visible on the instrument that matters. `workspace` went green; both
sweep cells failed, deterministically, on **one assertion**:

```
FAIL packages/cli/src/fail.test.ts > AC-5 — demonstrated, in two spawned children
AssertionError: process.exit truncated the child mid-write:
     expected 1048576 to be less than 1048576
```

**It is not the cluster this ticket describes.** No `@quorum/core`, no
`worktree-lifecycle.test.ts`, no `undecided.test.ts`, and nothing unstable: one file, one clause,
both cells, same message. The local sighting and the CI subject are **different manifestations**, and
only the thesis is shared.

**What the assertion did.** A child writes 1 MiB to stdout and calls `process.exit(1)`; the clause
required the write to be **truncated**. That is the outcome of a race between the exit and the flush,
so the test required a hazard to reliably occur — making its verdict a property of the machine, which
is exactly what this ticket exists to forbid.

**The obvious explanation is refuted, and the refutation matters.** Node documents stdout-pipe writes
as **synchronous on Linux and Windows, asynchronous on macOS**, which would make truncation
impossible on a Linux runner and explain the red completely. It does not: **the `workspace` job
passed on the same runner image, at the same commit, in the same run**. So this is not the documented
platform split, and it is not the commit — it is a third thing, on the same operating system, which
is precisely *"load is a third term beside the checkout and the account"* with a named subject at
last.

**Fixed 2026-09-05, and the first fix was withdrawn as worse than the defect.** The clause now
asserts the guarantee `die` actually rests on — the soft child delivers all 1,048,576 bytes — and no
longer requires the race. The first replacement written was `hard.bytes <= soft.bytes`; it was
**withdrawn for being unfalsifiable**, since a hard exit cannot invent output, so no commit could
ever turn it red. Trading a machine-dependent assertion for a vacuous one is not a repair, and it is
the defect class *"A check is not established by reading it"* (2026-08-29) names. Both surviving
clauses were demonstrated red by mutation: swapping the two endings fails the guarantee at
**65536 bytes of 1048576** — one pipe buffer exactly, which is Q-0070's own measurement arriving from
the other direction — and a hard child that produces nothing fails the second.

**What remains this ticket's work.** The local `@quorum/core` sighting is still unexplained and still
unreproduced in **35** local sweeps. The CI subject is now fixed rather than diagnosed: what made the
same suite truncate in one job and not another, on one machine, is unknown. The next CI run is the
first where a sweep result carries information about this ticket rather than about Q-0104.

## Why it is p1

`.claude/rules/engineering.md` calls the sweep's subject safety by construction, and Q-0079 built it
as the **oracle** for *"A test's verdict is a property of the commit, not of the checkout or the
account"* (2026-08-30) — with the tripwire beside it explicitly **not** coverage for the
checkout-shaped instances. A flaky oracle is worse than a missing one: it trains the reader to re-run
until green, which is exactly the habit the entry exists to forbid. And the two CI jobs are required,
so every push is now either red or lucky.

**It is also, precisely, an instance of its own subject** — a verdict that depends on the machine's
load rather than on the commit. The rule Q-0079 wrote names the checkout and the account; load is a
third term nobody had measured.

## Shapes, none adopted

1. **Serialise the suite under the sweep** — run the packages one at a time there, keeping the
   ordinary `pnpm test` parallel. Cheapest, and it hides the flake rather than fixing it: the same
   contention would still be reachable on a loaded developer machine.
2. **Find and fix the contended resource.** Requires the bisect and a mechanism first. If it is git
   process limits or a timeout, the fix may be a bounded retry inside the helper rather than in the
   tests.
3. **Bound concurrency per package** rather than globally, so the process-spawning suite cannot
   starve the worktree suites.
4. **Split the sweep's two CI jobs from the workspace suite's** so a flake is attributed rather than
   blamed on whichever job noticed. Diagnostic, not a fix.

## Gate obligations

**GO-1 — reproduce before repairing.** The ticket opens on a flake, so a fix demonstrated once proves
nothing. Establish a failure rate at a fixed commit — N runs, count reds — before and after, and
state both. *"A check is not established by reading it"* (2026-08-29) applies to this fix more than
to most.

**GO-2 — do not weaken the sweep to make it green.** Neutralising the environment, skipping a file,
or reducing what it runs would produce a permissive oracle, which Q-0079's own header calls out as
the failure mode that makes it green over everything. The negative and positive probes must still
discriminate.

**GO-3 — `harness/Q-0102/integration` must exist before the first chore run** (§5.8).

## Non-goals

- Changing what the sweep asserts, or the rule it enforces.
- Q-0039's concurrent-run lock, which is a different subject that happens to share the word.

Belongs to M2 in `docs/06-development-plan.md`. Found at Q-0095's merge, 2026-09-04.

## The instrument that matters has now answered, 2026-09-06 — 28 sweep cells, all green

**The section above says the next CI run after Q-0104 is the first measurement of this ticket's
subject on the instrument that matters. That run has now happened fourteen times.** Measured at tip
`a86c3fa`, by reading every CI run from the `fail.test.ts` fix (`33969196058`, *"AC-5 asserts the
guarantee, not the race"*, 2026-09-05 13:32Z) to the current tip, and the conclusion of each sweep
job in each:

| window | CI jobs | runs | sweep cells | failures |
| --- | --- | --- | --- | --- |
| fix → Q-0103's cutover | 7 | 8 | 16 | **0** |
| cutover → tip `a86c3fa` | 3 | 6 | 12 | **0** |
| **total** | — | **14** | **28** | **0** |

Every run is `success` at the run level as well, so no other job was red behind them. **`main` is
level with `origin/main`** as of this writing, which is the condition Q-0105 exists to keep — the 89
commits that hid Q-0104 for four days are not the state today.

**Both halves of the ticket's opening claim are now dead, and they died for different reasons.**
*"`pnpm sweep:git-identity` exits 1 on `main`"* has not been true in **36 local sweeps** — the 35 the
section above records, plus one run here at `a86c3fa`, exit 0, 7/7 tasks 0 cached. And *"every push
is red or lucky"* was already withdrawn as an inference rather than an observation; the 28 cells
above now refute it as a prediction too.

**The load the leading hypothesis rests on has halved underneath the ticket, which is the change
nobody planned for.** Q-0107 AC-16 and Q-0103 took the second suite out of the sweep, so it runs one
suite where it ran two — measured locally at **57.7 s** against this ticket's own table of 105–132 s.
A contention hypothesis is being tested against roughly half the contention it was formed on, and
16 of the 28 green cells above ran *before* that change while 12 ran after. So the greens are not
explained by the cutover, and the cutover is not exonerated by them either.

**What survives, unchanged and re-verified here rather than transcribed.** The named lead is intact:
`grep -rn testTimeout` over the tree outside `node_modules` and `dist/` returns **nothing**, so every
test still runs against Vitest's 5-second default, while `worktree-lifecycle.test.ts` still makes
**18** `git(` calls and `undecided.test.ts` **4**, all of them `execFileSync` — synchronous spawns —
through `packages/core/test/repo.ts:29`. Both files are still present and still the cluster the
original sighting named. The `p1` argument's other half also survives untouched: a flaky oracle
trains the reader to re-run until green, and that does not depend on a rate.

**What this does to the ticket, stated rather than implied.** There is no longer a red to fix. The
one instance ever reproduced on CI was diagnosed and fixed inside this body's own last section, and
the local `@quorum/core` sighting stands at one occurrence and 36 non-reproductions. GO-1 —
*establish a failure rate at a fixed commit before repairing* — is now the binding constraint rather
than a caution: at an observed rate of 0 in 36 local and 0 in 28 CI, **no fix can be demonstrated to
work**, because nothing can be shown red first. A ticket whose acceptance criteria cannot be
satisfied by any measurement is not ready for a requirements run in the shape this body describes.

**Not measured, and deliberately not inferred.** Nothing here explains the original sighting, and it
is not withdrawn — it was first-hand, twice consecutively, and two consecutive reds against a
36-and-28 green record is not a coincidence anyone should be comfortable with. What is unknown is
still what it was: whether the triggering condition was present that day and is absent now, and
whether it can return. The instrument has answered; the mechanism has not.

## Parked at p2 on 2026-09-06, and what would reopen it

**Decided by the human at the start of the session that would otherwise have launched its
requirements run**, on the measurement above rather than on a judgement about whether the sighting
was real.

**Why parking is the honest move and not an abandonment.** GO-1 binds: *establish a failure rate at
a fixed commit — N runs, count reds — before and after, and state both*. The rate is **0 in 36**
locally and **0 in 28** on CI. At that rate no fix can be demonstrated red before green, so every
shape in the list above would ship as a change nothing could prove was a repair — which is the
defect class *"A check is not established by reading it"* (2026-08-29) names, arriving one layer up
as a whole ticket rather than as an assertion. A requirements run could not have rescued it either:
no step in that flow can produce a failure rate, so launching would have been the sixteenth
appearance of a loop handed work no agent in it can perform.

**The `p1` argument is superseded rather than refuted.** The section *"Why it is p1"* above rests on
two halves. The first — *"the two CI jobs are required, so every push is now either red or lucky"* —
is measurably false: fourteen consecutive green runs, 28 sweep cells, 0 failures. The second — *a
flaky oracle trains the reader to re-run until green* — still stands and does not depend on a rate,
and it is what keeps this at `p2` rather than closing it. An oracle observed to flake once is not an
oracle anyone should forget about.

**The sighting is not withdrawn.** It was first-hand, twice consecutively, in phase `workspace
suite`, and no mechanism has ever explained it. What is recorded is that it cannot be reproduced,
not that it did not happen.

**What reopens this at p1, stated so the next reader does not have to re-derive the threshold.**
Any one of: a sweep cell failing on CI on the `@quorum/core` cluster rather than on an unrelated
broken test; a local sweep failing again at a tip whose workspace suite passes unswept; or a
third measured instance of the class in a third test, which would make *load is a third term beside
the checkout and the account* a pattern rather than two sightings. The first of those is now cheap
to notice, because `main` is level with `origin/main` and Q-0105 exists to keep it that way.

**Non-goal while parked:** do not make the sweep green by weakening it, and do not adopt the
timeout lead as a cause. GO-2 outlives the parking.

## Reopened at p1, 2026-09-11 — the reproduction this ticket was parked for want of

**Parked 2026-09-06 at 0 failures in 36 local sweeps and 0 in 28 CI sweep cells**, on GO-1's rule
that a failure rate must be established at a fixed commit before anything is repaired. That rate now
exists, measured during Q-0115's chore run and re-measured by hand rather than relayed.

**The measurement.** At `harness/Q-0115/implement`: **1 failure in 6 `pnpm sweep:git-identity` runs
and 1 in 2 unswept `pnpm turbo run test --force` runs**, both on the same test —
`packages/core/src/adapters/codex.test.ts` → *AC-4 … `--ignore-user-config` is unconditional, on
every combination* — with the same symptom, `Error: Test timed out in 5000ms`. Three later runs at
the same tip passed, so it is intermittent at roughly one in four to one in eight.

**Which threshold is met, and which is refuted.** Q-0115's implement step reported this as meeting
threshold 2 — *"a local sweep failing at a tip whose unswept suite passes"*. **That is refuted**: the
unswept suite fails on the identical test, so this is not sweep-specific and the sweep is not the
subject. **Threshold 3 is met** — *a third measured instance of the class* — which is what makes
*load is a third term beside the checkout and the account* a pattern rather than two sightings.

**The named lead is confirmed and the cluster has widened.** `grep -rn testTimeout` over the tree
returns nothing, so Vitest's **5000 ms default** governs, exactly as this ticket's body predicted.
What that body did not predict is the file: the original cluster was `worktree-lifecycle.test.ts`
and `undecided.test.ts`, which make 18 and 4 synchronous `git` spawns; `codex.test.ts` AC-4 spawns
**no git at all** — it loops four option combinations, each `await`ing a helper that builds argv over
a temp directory. So the shared property is **`await`ed filesystem work under a seven-package
parallel run**, not git.

**It passes alone.** 4/4 in isolation on `main` at 38/38, and `main`'s full forced suite passed 3/3
in the same session. So the verdict is a property of the machine's load at the moment of the run and
of nothing in the commit — which is *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30), and the reason this is p1 rather than a nuisance.

**GO-2 still binds and is now the hard part.** *No fix may make the sweep green by weakening what it
runs.* Raising `testTimeout` does not weaken **what** runs, but it does change an oracle's patience,
and a timeout raised until nothing trips it is an oracle that has been talked out of firing. The
work is to decide what a 5-second budget was ever asserting, and whether the answer is a longer
budget, a `pool`/concurrency bound that stops the suites contending, or a per-file timeout on the
files that do `await`ed I/O. **Establish the rate at a fixed commit before repairing** — that rule
did not stop applying, and this entry is what satisfies it.

**Two things this reopening does not claim.** It is not the same file as either original sighting,
and it is not evidence that the original `@quorum/core` cluster is the same defect — only that the
class has a third instance and a reproducible one. And CI is green: the last four runs passed all
three jobs, so this costs a re-run locally and nothing on the instrument that matters, today.
