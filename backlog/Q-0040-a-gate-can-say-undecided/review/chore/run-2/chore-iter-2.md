# Q-0040 code review — chore run 2, iteration 2

Verdict: **revise**

major: `backlog/Q-0040-a-gate-can-say-undecided/requirements/errata.md:42` AC-11 requires an erratum naming all five superseded contracts, but this file still says that erratum is needed and contains only E-1 about the decision-entry correction. Add the required E-2 covering the five landed contract changes before treating AC-11 as complete.

major: `packages/core/src/engine/engine.ts:134` The disposition warning that says nothing was rolled back identifies only the gate kind, not `error.gate.reason`; the durable log at line 136 also omits the reason. AC-13 requires the line describing what was kept to name the unanswered gate’s reason. Include the reason in the disposition record and assert it in the core test.

major: `spike/src/engine.js:792` The spike mirrors the same AC-13 gap: the disposition warning and `runs.log` record identify only the gate kind, while the required gate reason appears only in a separate diagnostic. Include `error.gate.reason` in the line stating that nothing was rolled back and update the spike assertions accordingly.

major: `packages/core/src/engine/lifecycle.test.ts:250` The claimed AC-4 invariant is evaluated over a manually maintained, non-exhaustive `TABLE`. Adding another `RunStatus` does not require adding a row, so the new status can evade all three lifecycle decisions and the invariant while this suite remains green; lines 270–272 incorrectly claim otherwise. Make the table exhaustive against `RunStatus` (for example through an exhaustive status-keyed record) and assert the production consequences for every member.
