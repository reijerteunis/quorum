---
id: Q-0054
title: The regression suite on Vitest, and CI gating the port
stage: draft
owner: ruud
repos: []
branch: harness/Q-0054/integration
priority: p1
created: 2026-08-25
iterations: {}
history: []
---
The last ticket of Q-0009's port and the only one that can prove any of the others. M2's done-when
asks for *"the 30-check smoke test passes as a Vitest suite; CI runs it on every push"*. Today that
suite is `spike/test/smoke.js` — 739 lines of plain Node driving the binary — beside 2,400 lines
across eleven other files, run by a hand-rolled discovering runner (`spike/test/run.js`) in CI's
second job. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**The entanglement this ticket has to solve.** Most of the suite tests the *product*, not the library:
`smoke.js`, `q0011-runs-cli.js` and `q0036-board-containment.js` drive `bin/harness.js` and import no
source module at all, and `q0011-run-history.js`, `q0033-surface.js` and `q0034-review-fixes.js` do
both. So the acceptance evidence for a `packages/core` port runs through `packages/cli`, which is
Q-0010. Three routes, and the requirements flow should pick one deliberately rather than discover it:
port the library-level suites first and leave the CLI-driven ones on the spike until Q-0010 lands;
sequence this ticket after Q-0010 entirely; or re-aim the CLI-driven suites at core's public API,
which changes what they test and would need saying out loud.

**What the runner does that Vitest must keep doing.** `run.js` executes `smoke.js` first and then
*discovers* every other `test/*.js` in name order. Discovery is the point, and the comment says why:
qa-red proves a red phase by writing **new** test files and asserting the suite fails, so a runner
hard-coded to a file list would execute none of them, the suite would stay green, and
`integrate --expect fail` would loop until it hit a gate having proved nothing. Vitest globs by
default, which satisfies this — but the flows call `pnpm test` through Turborepo, and a filter, a
cache hit or a per-package `include` that silently skips a new file recreates the same failure with
better ergonomics. Worth an explicit check rather than an assumption.

**The suites are frozen artifacts.** `spike/test/**` is qa-red's output, and a developer who can edit
the tests judging the work can make anything green — the reason Q-0034 wrote a new file rather than
editing Q-0011's. Translating them to Vitest is not editing them, but the line is thin, and every
behavioural difference between the ported assertion and the original is a finding to record rather
than a tidy-up. The exception Q-0052 names is the `runGate` signal-window fixture, which exists
*because* the old file was frozen.

**Tests that must not become false.** Several suites build a throwaway repository per case
specifically so that nothing asserts the containment state of a branch in *this* repository — an
assertion that would be red until the next landing and green forever after, which is the
permanent-acceptance-test decision (2026-08-23) in action. Ported fixtures keep that discipline. And
`q0035-empty-range.js` deliberately never asserts a whole sentence and never assumes a short SHA is a
fixed width; a Vitest rewrite reaching for snapshots would undo both.

**The cutover is not this ticket's.** Deleting `spike/` and dropping CI's second job belongs to
Q-0009, after Q-0010. Until then both CI jobs stay green: the workspace job proves the port, the spike
job proves the harness the port is being developed with still works.

## Line map re-derived 2026-08-31, before the requirements run

The body above was written 2026-08-25, when four children had landed. Thirteen have now, and this
ticket's whole subject is *what the suites contain* — so it is the child a stale body hurts most.
Measured today at `adf091e`. **Re-derive at the branch's own SHA rather than trusting these
numbers**: Q-0051's were wrong within ten hours, and this ticket's inputs move every time a child
lands a new suite.

**The suite is half again as big as the body says.** Not "2,400 lines across eleven other files"
but **3,657 lines across sixteen**, plus `smoke.js` at 739 — which is the one figure above that
still holds — and `run.js` at 37. **4,396 lines of tests in eighteen files.** `q0035-empty-range.js`
alone is **730 lines**, all but level with `smoke.js`, which matters because the body singles it out
as the file a snapshot-happy rewrite would break.

**The entanglement is worse than the body states, and now it has a number.** Classified by whether
a file spawns `bin/harness.js`, imports from `../src/`, or both:

| | files | lines | |
| --- | --- | --- | --- |
| **binary-only** | 3 | 1,075 | `smoke.js`, `q0011-runs-cli.js`, `q0036-board-containment.js` |
| **both** | 5 | 1,262 | `q0011-run-history.js`, `q0033-surface.js`, `q0034-review-fixes.js`, **`q0077-base-flag.js`**, **`q0080-allocation.js`** |
| **library-only** | 9 | 2,059 | the rest |

The body's binary-only trio is exactly right. Its "both" list is **missing two**, and both are new:
`q0077-base-flag.js` and `q0080-allocation.js` landed in the last four days. So **53% of the suite
is entangled with the binary**, not the ~half of eleven files the body implies — and route 1 (*port
the library-level suites first, leave the CLI-driven ones on the spike until Q-0010*) now leaves
**2,337 lines across eight files** behind rather than six. That percentage is the fact the routing
decision turns on and it has never been computed before; compute it again at the branch, because
two of the eight arrived while this body sat unread.

**The `runGate` signal-window exception no longer exists, and this is the correction that would
otherwise mislead.** The body's last paragraph says *"The exception Q-0052 names is the `runGate`
signal-window fixture, which exists because the old file was frozen."* Q-0052 **declined it**:
its R-7 ruled the invitation already spent by the child that ported the gate, and GO-2 recorded
in that ticket's `runs.log` that it is **spent and the timer permanently preserved** — the third
consecutive decline. `packages/core/src/engine/routing.ts:27` still carries
`setTimeout(() => {}, 1000)` with `// Why: preserved defect, see Q-0050 AC-4.`, pinned three ways.
**This ticket inherits no authorised behaviour change of any kind.** A Vitest fixture that "no
longer needs" the timer is a behaviour change like any other and takes charter §2's route.

**CI has five jobs, not two.** `workspace`, `port-freeze-policy`, `port-freeze-branch-scope`,
`port-freeze-sha`, and `spike` — which is the **last**, not "CI's second job". The freeze-SHA job
is live and green as of `95079ac`, so anything this ticket does to `spike/**` turns it red until
the SHA is re-recorded. The body's non-goals already forbid editing `spike/**`; the point here is
that the guard now enforces it rather than merely asking.

**`run.js` behaves exactly as the body describes** — verified rather than assumed. It reads the
directory, filters `*.js`, excludes itself, and sorts `smoke.js` first with `localeCompare` for the
rest. The discovery reasoning is in its own header comment, and the body's summary of why it
matters is accurate.

**Dependencies: all thirteen are `reviewed` and `main:contained`.** Nothing blocks this ticket. It
is the last child, and `packages/core/src/engine/routing.ts` no longer contains `unavailableStep` at
all — every step kind dispatches to a real implementation, so there is nothing left for a
regression suite to find missing.

**One number for the requirement to weigh.** The port has cost **$599.77 billed across thirteen
children, mean $46.14** — charter §9's per-child threshold is $40 and its fourteen-child projection
was $550, so both are already exceeded, while the threshold §9 calls the one to watch (*more than
three chore runs on any one child*) was never tripped. Cost overran; the signal for a child cut
wrong never fired. This ticket is the largest remaining unknown in that estimate.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `spike/test/**` library-level suites → Vitest; CI gating
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** all thirteen above · **Depended on by:** — (lands last)
- **Invariants inherited:** register rows — (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
