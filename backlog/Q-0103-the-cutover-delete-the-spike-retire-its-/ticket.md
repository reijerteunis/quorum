---
id: Q-0103
title: "The cutover: delete the spike, retire its CI job and its charter"
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0103/integration
priority: p2
created: 2026-09-05
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-05T14:13:53.136Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-05T14:34:43.727Z
    cost: 11.205
---
**Q-0010 §5's follow-up, allocated at Q-0101's close per that ticket's GO-4** rather than
remembered. Every child of the CLI cut is `reviewed` and `main:contained`, so the spike has no
remaining reader: `packages/cli` dispatches all eight commands, and `packages/core` holds the logic.
This ticket is what makes that true on disk.

## What it deletes, measured 2026-09-05

- **`spike/` — 55 tracked files, 9,732 lines.** The whole tree, including `spike/test/**`, which is
  the last thing holding a second regression suite in this repository.
- **`packages/core/src/spike-parity.test.ts` — 1,957 lines.** It goes *with* `spike/test/**` and not
  before: its whole subject is the relationship between two suites, so it is meaningless the moment
  one of them stops existing. Q-0010's own bullet says so.
- **`harness/port-charter.md` — 516 lines.** Its §2 preserve-behaviour rule, its §3 mirror-and-
  re-record procedure and its `freeze-sha` all describe a tree that will not exist.

## What it edits rather than deletes

- **`.github/workflows/ci.yml`** — the `spike` job (`:106`) is retired, and with it the three
  port-freeze jobs (`port-freeze-policy` `:46`, `port-freeze-branch-scope` `:70`, `port-freeze-sha`
  `:92`), which exist only to police a freeze on a deleted tree. **Seven jobs become three**:
  `workspace` and the two `git identity sweep` cells. Whether the freeze jobs go in this ticket or
  in a successor is an open question below, because they are a different subject from the spike.
- **`harness/harness.yaml`** — `commands.install` (`:40`) and `commands.test` (`:48`) each chain a
  spike half that will fail on a missing directory. This is the **highest-risk edit in the ticket**:
  every flow's `integrate` step runs these two commands, so a mistake here is not caught by a test
  but by the next run failing in its worktree. The comments at `:30` and `:35` explaining why there
  are two suites go with them.
- **`eslint.config.js:19`** — `spike/**` leaves the ignore list, and the comment at `:13` naming
  Q-0009 goes with it.
- **`vitest.shared.js:8`** — a comment citing `spike/test/run.js`'s header as the source of the
  discovery guarantee. The guarantee stays; the citation needs a new home or a rewording.
- **`README.md` and `CLAUDE.md`** — both tell a reader the runnable code is the spike. `CLAUDE.md`
  says it twice, once under *"Read first"* and once under *"Commands"*, and the second gives
  `node spike/bin/harness.js` as the command to run.
- **`docs/`** — `04-architecture.md` and `06-development-plan.md` both describe two required suites
  as a present-tense fact. `docs/decisions/` is **append-only and is not edited**: an entry
  describing the spike stays true of when it was written.

## Why this cannot go through the chore flow as one ticket — measured 2026-09-05

**A chore run for this ticket would abort at its own `integrate`, after paying for implement and
review.** `runFlow` receives `config` as a parameter (`spike/src/engine.js:61`) and never re-reads
it, and the integrate step reads `ctx.config.commands?.test` and `ctx.config.commands?.install`
(`:1306`, `:1309`; `packages/core/src/engine/composite.ts:353` is the ported twin). So the commands
a run executes are the ones that existed **when it started**:

1. `implement` deletes `spike/` and rewrites `harness.yaml`'s two commands.
2. `integrate` merges, then runs the **run-start** `commands.install` —
   `npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile` —
   against a directory the run has just deleted.
3. npm fails, and `engine.js:1342` classifies it as an environment failure: *"The report is on disk,
   but it is not evidence of anything — fix the environment (commands.install in harness.yaml) and
   re-run."* The run stops with no merge.

This is *"Do not drive harness-machinery work through the harness"* (2026-08-23) with a mechanism
rather than a principle, and it is **Q-0057's shape made fatal**: that ticket's run merely could not
*benefit* from its own fix, while this one would be *killed* by it.

**The cut that is runnable, and why it is two changes rather than one.** Split at the commands:

- **Step 1 — the commands stop naming the spike, while `spike/` stays.** Its own `integrate` runs
  the *old* commands, which still work because the tree is still there. The cost is one run whose
  integrate does not exercise the spike suite; acceptable only because step 2 deletes it, and it
  must be stated rather than discovered.
- **Step 2 — everything else.** Its `integrate` runs the *new* commands, which name no spike, so the
  deletion in the same change is safe.

Both halves are then ordinary chore tickets. The alternative decision 035 also offers — *"a stage run
manually"* — remains open and is cheaper in adapter cost but buys no review.

**This is a gate question, not an implementation detail**, and it is written here so the requirements
run rules on it rather than rediscovering it: whether to split, to run by hand, or to accept a
deliberately failed `integrate` and finish it out of band.

## Ground rules

1. **Nothing in `packages/` changes behaviour.** This ticket deletes a tree and repairs what pointed
   at it. A change to `packages/core` or `packages/cli` source is out of scope and is the signal
   that something was still depending on the spike — report it rather than fixing it in passing.
2. **`commands.install` and `commands.test` are verified by running them**, not by reading them. The
   ticket is not done until a real `integrate` step has passed with the new commands.
3. **The decisions are not edited.** See `.claude/rules/docs-and-decisions.md`.

## Open questions

- **OQ-1: do the three port-freeze jobs go here or in a successor?** They are 46 lines of `ci.yml`
  and their subject is the freeze rather than the spike, but they are unrunnable once `spike/src`
  is gone, so leaving them is not neutral. Recommended: here, because a job that cannot fail is
  worse than one that is missing.
- **OQ-2: does `harness/rules.md` need an edit?** It states that `spike/**` is outside ESLint's
  scope, which stops being true in the sense that the directory stops existing. Its derived copy in
  `.claude/rules/` is **not** a surface a requirement may name — see *"`.claude/rules/` is a derived
  copy"* (2026-08-27).
- **OQ-3: what replaces the `freeze-sha` guard's evidence?** Nothing needs it after the cutover, but
  the guard's own test file is `.github/scripts/port-freeze-guard.test.mjs` and Q-0079 recorded that
  file as one **nothing executes**. Deleting it is right; confirming nothing runs it first is the
  measurement.

## Non-goals

- Registry-resolved `npx quorum` — refused while every package is `"private": true`, and Q-0029's in M6.
- Any fix to Q-0102, whose subject is a flaky oracle rather than the spike.
- Q-0059, Q-0060, Q-0066, Q-0068 and Q-0100, the open defects that land in both trees. **After this
  ticket there is only one tree**, which makes each of them smaller rather than closed — none may be
  closed in passing here.

Belongs to M2 in `docs/06-development-plan.md`. Successor to **Q-0101**; the last item of **Q-0010** §5.
