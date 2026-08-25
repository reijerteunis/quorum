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
