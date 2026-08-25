---
id: Q-0053
title: core/engine — fan-out and integrate steps
stage: draft
owner: ruud
repos: []
branch: harness/Q-0053/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
---
Ports the two composite step kinds — `runFanOut` and `runIntegrate` — plus
`syncBaseIntoTicketBranch`, `environmentFailure`, `testReport`, `mergeFailure` and `cmdTimeout`.
Roughly 250 lines of `spike/src/engine.js`, sitting on the plumbing Q-0048 ports. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**`integrate` is one generic step type used by three stages** (2026-08-21): it merges the listed
branches into a target in a worktree, optionally runs `commands.test`, and asserts `expect: pass|fail`.
Solutioning lands contracts with it, qa-red proves red with `expect: fail`, development proves green
with `expect: pass` and `on_fail` scoped to the failing tasks.

**Four invariants make a red phase trustworthy, and all four live here.** The 2026-08-22 decision
*"red for the right reason is an engine property, not a role property"* is the single most expensive
lesson in this file — M1's plan assumed the work was prompt-tuning the `automation-qa` role, and six
runs produced no evidence the role was ever at fault while finding six engine defects:

1. **Dependencies are installed in the worktree before the test command runs.** A worktree is a fresh
   checkout with no `node_modules`, the test command died on a missing dependency, and `expect: fail`
   read exit 1 as proof of red. *Every ticket would have proved red this way, forever.*
2. **A suite that could not start is rejected rather than counted as red.** Non-zero exit is not
   evidence a suite ran.
3. **The ticket branch is synced to `repo.base_branch` first.** Q-0006's integration branch was five
   commits stale, so QA worked against a tree without `ajv` or `test/run.js` and appeared to revert
   both.
4. **Every terminal outcome is written to `runs.log` with its counters persisted.**

**The detector that defeated itself.** The guard added for (2) was beaten by its own test: a suite
asserting *"a broken environment is not a red phase"* prints that signature in a pass message, and the
detector matched it, throwing away a genuine red phase. `environmentFailure` therefore ignores
anything on a line that reports a result — a line reporting a result is proof the suite ran, and
cannot be proof it never started. Port that reasoning, not just the regex.

**Stop rather than retry.** *"A loop spending its budget on work no agent in it can perform"* is the
first of M1's three recurring shapes, with four recorded instances — a hung test command, a base
conflict at integrate, a base conflict before fan-out, and tests whose only fix lay in a file no task
owned. The remedy is identical every time: stop and name the work a human must do. Two 2026-08-23
decisions close it from the other side (every file a red test requires is owned by exactly one task;
a red test is a permanent acceptance test), and both are enforced at the qa-red gate rather than
here — but this is where the budget gets burned when they are missed.

**`testReport` truncates on purpose** (24 KB), because a suite's output goes into the next agent's
prompt. `mergeFailure` and `IntegrationError` must keep printing sentences rather than stacks.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` fan-out and integrate steps
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0052, Q-0048 · **Depended on by:** —
- **Invariants inherited:** register rows 7 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
