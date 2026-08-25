---
id: Q-0044
title: core/lint — flow lint and whole-directory validation
stage: draft
owner: ruud
repos: []
branch: harness/Q-0044/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
---
Ports `spike/src/lint.js` (194 lines) — `FlowError`, `flattenSteps`, `lintFlow`, `lintFlowDirectory`,
`validateFlowDirectory` — to `packages/core`, and lifts `lintDirectory` from
`spike/bin/harness.js:374` so the CLI is left with printing. The lint is how this product's opinions
become enforceable, so the port is a transcription of rules rather than a rewrite. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**The rules, each with the decision that put it there.** Duplicate step ids. `on_fail` needs a
`goto`, an integer `max_iterations` greater than zero, an unprefixed `counter` (a `counter` written
`iterations.x` is rejected with the correction spelled out), and `on_exhausted: gate` — the bounded
backward edges decision, 2026-08-21. A verdict with nowhere to go. `fan_out` without a `step`
template; `integrate` without `branches`. `cross_vendor: required`, in the refined form of
2026-08-21: a panel satisfies it by spanning adapters, and a single-writer review still needs writer
≠ reviewer, so a judge over N candidates only needs the candidates to span vendors. A backward edge
whose destination never receives what the source writes — *"the loop cannot converge"*. `consumes`
and `produces` on every flow, and a `human-locked` gate on any flow producing `deployed`. At the
directory level, a `goto: flow:<target>` must name a flow that exists and whose produced-stage return
chain reaches the source flow's consumed stage (2026-08-23).

**The rule most likely to be lost in a rewrite.** `diffSites` reads every `input.diff` a flow can
hold **including the one inside a `fan_out` step's `step:` template**, which `flattenSteps`
deliberately does not visit — the template's id, role and adapter are placeholders the other rules
must not see. Q-0035's closing entry states why in one line: *"a static check that skips a step
template is a static check with a hole in exactly the place a run is most expensive to fail."* The
range grammar it enforces (two `...`-joined endpoints, each `{base}` or `harness/{id}/…`) was settled
by Q-0034 and deliberately not relaxed when it broke a flow that did not exist when it was written —
the message was changed to agree with the guard instead.

**Error messages are part of the behaviour.** Each problem names something the reader can find in the
file, and a flow with several problems reports all of them at once rather than the first. Q-0033's
suite compares lint output; the ported messages are load-bearing.

**Two candidate rules that are not in scope.** Q-0038 records that the chore flow's step order —
`review` before the `integrate` that creates the branch `review` diffs against — is a statically
checkable flow property and a candidate for `harness lint`. It belongs to a ticket that decides it,
not to the port. Same for anything that would newly reject a flow file shipped in
`harness/flows/`: this ticket must leave all six shipped flows and their template copies passing.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `lint.js` — `FlowError`, `flattenSteps`, `lintFlow`, `validateFlowDirectory`
- **Lifts from `spike/bin/harness.js`:** `lintDirectory` (:374)
- **Depends on:** Q-0041 · **Depended on by:** —
- **Invariants inherited:** register rows 12, 16, 18 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
