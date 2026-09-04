---
id: Q-0102
title: The git-identity sweep is red under load, and CI runs it
stage: draft
owner: ruud
repos: []
branch: harness/Q-0102/integration
priority: p2
created: 2026-09-04
iterations: {}
history: []
---
**`pnpm sweep:git-identity` exits 1 on `main` today, and `.github/workflows/ci.yml` runs it as two
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
