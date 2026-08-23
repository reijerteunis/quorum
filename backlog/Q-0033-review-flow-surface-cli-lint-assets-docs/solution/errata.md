# Errata — Q-0033

Amendments to this ticket's solution, agreed after the architect gate approved it. Development
and QA implement what is written here; where this file and the solution disagree, this file wins
for the clauses it names. An erratum resolves a contradiction — it never widens scope.

## E-1 — 2026-08-23 — the two tasks are re-cut into six

**Amends:** `solution/tasks.yaml` (decomposition and ownership only — no contract clause changes,
no acceptance criterion dropped). The pre-recut file is kept as `solution/tasks-before-recut.yaml`.

**Why.** The development loop exhausted all three iterations without a single agent making a
change. Both were right every round: their assigned scenarios passed. The three failures were in
files neither task owned — `spike/test/smoke.js` twice and `spike/src/adapters/mock.js` once —
so no agent in the loop could have fixed them, and nothing in the flow could tell the difference
between "the agents are failing" and "the agents are being asked for something they may not do".

**The new cut**, one coherent file set each, every task independently completable:

| task | role → vendor | owns |
| --- | --- | --- |
| `Q0033-cli` | tooling → claude | `spike/bin/harness.js` |
| `Q0033-lint` | backend → codex | `spike/src/lint.js` (new), the lint portion of `spike/src/engine.js` |
| `Q0033-config` | backend → codex | `harness/harness.yaml` and its template copy |
| `Q0033-assets` | backend → codex | `review.yaml`, `code-reviewer.md`, and their template copies |
| `Q0033-mock` | backend → codex | `spike/src/adapters/mock.js` |
| `Q0033-docs` | backend → codex | `docs/02`, `docs/06`, `GLOSSARY.md`, `DECISIONS.md`, `README.md` |

All six declare `depends_on: []` and run in one wave. `Q0033-mock` exists because S3.2/S3.3
requires the mock's code-reviewer to produce a schema-valid approval, and no task owned that file.
`Q0033-cli` moves to `tooling` because `spike/bin/` is tooling's by the role table, which also
makes the fan-out two-vendor rather than merely parallel.

See the DECISIONS entries of 2026-08-23: "Every file a red test requires must be owned by exactly
one task" and "Tasks are small; the fan-out is the unit of parallelism, not of scope".

## E-2 — 2026-08-23 — scenario S11.1–S11.4 is not a valid red test

**Amends:** `qa/scenarios.md`, scenario group S11.1–S11.4, and the assertion implementing it in
`spike/test/q0033-surface.js`.

**The problem.** S11.1–S11.4 asserts that `spike/test/smoke.js` contains a `--gate-answer … abort`
call. `spike/test/**` is qa-red's artifact and every development task carries "Do not modify
tests", so **no task can ever satisfy it**. It is a red that stays red by construction, and it
consumed a third of the ticket's iteration budget proving so.

**The amendment.** The criterion behind it — that a non-interactive run answers its gates
explicitly rather than defaulting — is real and stays. What must change is where it is proved:
assert it against a run the test itself drives, passing `--gate-answer` on the command line and
checking the run's behaviour, rather than against the contents of another test file. Rewriting a
scenario is qa-red's work, so this returns to qa-red rather than being handed to development.

**The rule this establishes**, now in `automation-qa`'s role and `harness/architecture.md`: a
scenario whose only possible fix lies outside every task's ownership is a finding for the
scenario gate, not a red test. S3.2/S3.3 was the same shape and is resolved differently — by
giving `spike/src/adapters/mock.js` an owner, because that file is legitimately development's.

## E-3 — 2026-08-23 — Q0033-mock dropped, README struck, and one review finding rejected

**Amends:** `solution/tasks.yaml` (scope only). Two corrections to E-1's re-cut, both mine, and one
finding declined.

**`Q0033-mock` is dropped.** I added it in E-1 because S3.2/S3.3 was failing and no task owned
`spike/src/adapters/mock.js`. On a clean base that scenario passes without touching the file: the
frozen `mock-adapter-switches.contract.md` already guarantees the finding shape, and both stage
transitions are proved against `mock.js` unchanged. The task would have dispatched an agent
against nothing to do — which is the mirror of the gap E-1 was written to close, and just as
wasteful.

**The README clause is struck from `Q0033-docs`.** It told the task to "give the README the one new
command" while a scenario asserts `README.md` is byte-unchanged and the merged requirement assigns
the rewrite to Q-0028 in M6. A task instructed to do the one thing that fails its own red test.
`README.md` is out of the task's ownership entirely, and the description now says to leave it alone
and why.

**Declined: the finding that `spike/test/smoke.js` and `q0033-surface.js` contradict each other.**
The review of 2026-08-23 called them "the same command" and asked for the smoke assertion to be
deleted. They are not the same command:

- `smoke.js` runs `… --auto` with no `--gate-answer` and asserts the run reports `stdin closed
  without one`.
- `q0033-surface.js` runs `… --auto --gate-answer abort` and asserts it does not.

Both are correct and one implementation satisfies both: answer the gate when told, error when not.
Deleting the smoke assertion would have removed a correct regression test for behaviour this
ticket is about to change. Recorded rather than silently ignored, because this reviewer has been
right about everything else on this ticket and the next reader deserves to know why one finding
was not acted on.
