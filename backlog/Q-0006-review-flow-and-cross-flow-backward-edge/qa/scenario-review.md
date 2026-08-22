# Q-0006 — Scenario review (qa-red gate), round 2

*Architecture review of `qa/scenarios.md` and `qa/red-report.md` against `requirements/merged.md`,
`solution/solution.md` and the frozen contracts on `harness/Q-0006/contracts`.
Verdict: **revise**.*

## What was checked

Two questions, per the gate's charter: does every acceptance criterion have at least one scenario,
and does the red report show the suite failing on assertions rather than on compilation? I also
traced the report back to the tree that produced it — the integration worktree, the test file on
`harness/Q-0006/tests`, that branch's merge-base against `main`, and the frozen contracts — because
a red report is only as good as the tree it ran in.

`scenarios.md` has been rewritten since round 1: the EC-* block is gone, replaced by SC-31…SC-42,
and every one of the 42 scenarios now carries a `**Tasks:**` line. That closes round 1's N1 and N3.
`red-report.md` has not been touched.

## Coverage: passes

`SC-01` … `SC-30` map one-to-one onto AC-1 … AC-30. No criterion is orphaned, and the mapping is
substantive rather than nominal — SC-12 covers both halves of AC-12 (absent key → `main`, present
but unresolvable ref → stop before spawning), SC-16 covers both the exact bound and the four invalid
`max_iterations` forms, SC-22 covers all five terminal outcomes plus the reconstructability clause.

`SC-31` … `SC-42` carry the reviewer rounds' findings and the solution's decisions. They remain the
strongest part of the document: SC-39 (exhaustion costs zero, terminal cost recorded exactly once)
and SC-34 (preflight validates the pristine on-disk flows before the `--adapter mock` substitution)
are scenarios that only get written by someone who thought about how the thing fails.

The closing note — that real-CLI diff behaviour and reviewer-quality judgment are deliberately not
automated, because faking determinism or spending the user's subscription inside a test run both
violate BYOS test isolation — is the right call, stated in the right place.

That is the half that passes. Everything below is why the gate does not open.

## Blockers

### B1 — The red report is an environment failure, not a red phase, and it has not changed

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'yaml' imported from
  .../.harness/worktrees/harness__Q-0006__integration/spike/bin/harness.js
✗ init
```

That worktree has no `spike/node_modules`. The error is thrown by the *harness binary* spawned as a
child process by the pre-existing smoke suite, and `✗ init` is smoke check #1 (`smoke.js:20`) —
nothing in `q0006-review.test.js` is involved. The test script on that branch is

```
"test": "node test/smoke.js && node --test test/q0006-review.test.js"
```

so the `&&` short-circuited on smoke's non-zero exit and **not one Q-0006 assertion ever ran**. The
report contains zero evidence about any acceptance criterion. It is the report you would get from a
branch on which no work had been done at all.

This file is byte-identical to the one round 1 rejected as B1. `scenarios.md` was rewritten in
response to that review; `red-report.md` was not re-run. `qa/red-integration.md` still records:

> Tests: `npm test --prefix spike` → exit 1 (expected fail) → OK

A missing dependency satisfied `expect: fail` — twice now. This is the failure the M0 decision warned
about ("without contracts the red→green mechanism is a hope, not a mechanism") one turn further
along: the mechanism accepts an unresolved import as proof, and accepted the same one again.

The good news is that this is shallow. The tests branch forks at `4c69a48`, before `f755f07` (ajv)
and `e9126b5` (`test/run.js`) landed on `main`; every symbol the test file imports exists on `main`.
The file will link and run once the branch is current and dependencies are installed.

**Do:** install dependencies in the integration worktree — better, have the `integrate` step do it
before `commands.test`, since every future qa-red run hits this — rebase the tests branch onto
`main`, re-run, and attach a report in which every failure line is an `AssertionError` naming a
scenario id. A red phase that cannot name which criterion is red is not a red phase.

### B2 — Scenario ids and test ids no longer share a namespace

`scenarios.md` renumbered the edge cases from `EC-01`…`EC-20` to `SC-31`…`SC-42`.
`spike/test/q0006-review.test.js` still titles them `EC-01`…`EC-20`. Only `SC-42` appears in both.

The result is a two-way break: 19 test titles cite ids that no longer exist in the scenario
document, and `SC-31`…`SC-41` have no test citing them. The mapping is recoverable by reading both
files side by side, which is exactly what a traceable id is supposed to make unnecessary.

This also blocks B1's remedy. "Attach a report whose every failure names a scenario" is not
achievable while the failing test names `EC-05`.

**Do:** retitle the test file to the `SC-` ids in the same change that re-runs the suite.

### B3 — SC-29's implementing test has no legal path to green

```js
assert.deepEqual(pkg.dependencies, { yaml: '^2.5.0' });
assert.match(pkg.scripts.test, /smoke\.js/);
```

On `main`, `spike/package.json` carries `ajv`, `ajv-formats` and `yaml`, and its test script is
`node test/run.js`. Both assertions therefore fail permanently against the target of this ticket, and
development's only route to green is to delete ajv and re-hard-code the runner:

- **`ajv` / `ajv-formats`** landed in `f755f07` under the DECISIONS entry *"Contracts are executable:
  ajv in the toolchain, `harness validate` in the flows"*. `spike/src/contracts.js` imports ajv.
  Deleting them breaks `harness validate` — the mechanism qa-red exists to use to turn a contract
  into a failing test.
- **`test/run.js`** landed in `e9126b5`, whose commit message is *"discover test files so qa-red can
  prove a red phase"*. Replacing it with a hard-coded `&&` chain reintroduces exactly the
  short-circuit that produced B1.

AC-29 says *Q-0006 adds no new dependency*; it does not say the repository has exactly one. SC-29's
own wording ("no new npm dependency was added") is what licensed the absolute assertion, so both need
fixing.

**Do:** restate SC-29 as a statement about the delta — "Q-0006 introduces no dependency beyond those
already present on `main`" — and assert that `pkg.scripts.test` invokes the discovering runner rather
than that it mentions `smoke.js`.

### B4 — SC-31 and the frozen contract state mutually exclusive retry semantics

`contracts/Q-0006/review-runtime.contract.md:56-59`:

> `advance` continues toward `reviewed`; `retry` sets only `iterations.review` to
> `max_iterations - 1` (persisted value `2` for the shipped limit), then regresses to the configured
> target. The next accepted rejection increments to `3` and is the one additional regression
> traversal; a following rejection re-presents the gate at `4`.

SC-31 requires the persisted value to be exactly `3`, with the gate-triggered regression itself as
the one authorised traversal and the next rejection landing at `4`.

These differ in more than the number. The contract's model grants **two** further traversals after
`retry` (the immediate regression, then the count-3 regression); SC-31's grants **one**. AC-18 says
`retry` *"authorises exactly one more traversal"* — so SC-31 matches the requirement and the frozen
contract does not. Round 1 read this as an undecided numbering dispute; on re-reading, the
requirement does adjudicate it, and the contract is the artifact that is wrong.

Meanwhile SC-36 asserts `contracts/Q-0006/**` is byte-identical to the contracts commit, and all four
task descriptions in `solution/tasks.yaml` carry "Do not edit `contracts/Q-0006/**`". Development is
being asked to satisfy two mutually exclusive statements with no legal path to green.

**Do:** amend the contract explicitly — a further solutioning round, or a dated erratum committed to
the ticket folder and referenced by the contract — rather than letting a test overrule a frozen
artifact silently. A contract that a test can quietly outvote is not a contract.

## Majors

### M1 — SC-32's implementing test asserts the opposite of SC-32

The `EC-02/03/04` test answers `['advance','abort']` at the exhaustion gate and asserts
`stage === 'green'` with exit status 2 — that is, `advance` did not advance. SC-32 requires the run
to "proceed toward `reviewed`", and `review-runtime.contract.md:56` agrees. Separately, SC-32's stated
Then — a later return to review presents exhaustion immediately, with no fresh three-round budget —
is never exercised by the test that claims it.

**Do:** split SC-32 from SC-37; assert `reviewed` after the closing gate, and give SC-32 its own run
that re-enters review with the counter already at 4.

### M2 — SC-36's implementing test can never fail

```js
const diff = execSync('git diff -- contracts/Q-0006', { cwd: repo, encoding: 'utf8' });
assert.equal(diff, '');
```

An unstaged working-tree diff with no revision range, which is empty on any committed branch. The
same applies to the accompanying unranged `git diff --check`. SC-36 says "compared to the contracts
commit". As written this is a guaranteed green tick that asserts nothing — and it is the check
standing between a development task and a rewritten contract, which is what makes B4 dangerous rather
than merely inconsistent.

**Do:** `git diff <contracts-base>..HEAD -- contracts/Q-0006` and `git diff --check <base>...HEAD`.

### M3 — AC-16's exactness is never executed

SC-16's test covers only the lint half — `undefined`, `'three'`, `0`, `-1` all throw. The first half
of the scenario, three consecutive `changes-requested` rounds reaching 1, 2, 3 before the gate, has no
assertion anywhere: the SC-17/18/19 test pre-seeds `iterations.review = 3`, so rounds 1–3 never
happen and an off-by-one in the increment passes silently. "The bound is exact" is the criterion; its
exactness is the one part not tested.

**Do:** drive three real rejection rounds and assert the counter at each step.

### M4 — Four scenarios are backed by greps over YAML rather than by runtime assertions

These will read green in a repaired red run and prove nothing about the implementation:

| Scenario | The scenario says | The test actually does |
|---|---|---|
| SC-10 | the engine materialises the diff **into the prompt** | greps `runs.log` for `truncat` and the range string; `buildPrompt` is imported and never called |
| SC-07 | the **verdict document** lists findings grouped by severity with `file:line` | regex-matches the flow's `instructions` block; no `review/round-N/verdict.md` is ever read |
| SC-20/21 | second development run's worktrees contain the merged files; a conflict warning names the task | greps `development.yaml` for two strings — no run, no worktree, no merge |
| SC-27 | "a rework development run reaching green again"; "`green → reviewed` on approval" | no test for either; SC-08/09's passing run checks round files, never the final stage |

SC-10 and SC-20 carry the ticket's actual risk — whether reviewers see a diff at all, and whether the
loop can close. Both are currently asserted by grep over a YAML file. Static assertions are the right
tool for SC-01 through SC-06; they are the wrong tool here.

### M5 — SC-33 has no test, and the nearest candidate does not cover it

No test cites SC-33. The SC-10/11/12 test greps `runs.log` for
`main...harness/T-0001/integration`, which proves the final string but not SC-33's claim: that
`{base}` is substituted *before* the range is validated against git and before any other
interpolation, so the literal `{base}...` can never reach git.

**Do:** assert the ordering directly, or fold SC-33 into SC-12b, where the ref-validation path
already runs.

## Nits

- **N1** — AC-8's "`{iter}` keeps its current meaning, so no shipped flow changes behaviour" still
  has no scenario of its own; it leans on SC-29's blanket "everything stays green". (Carried.)
- **N2** — SC-30 is asserted by regex over all five documents concatenated into one string, so a
  substring matching anywhere satisfies it. It cannot distinguish §3.4 from §5.5, which is precisely
  what the scenario asks it to check.
- **N3** — The EC-20 test asserts `exhaustible.length >= 4`. With `review.yaml` the real count is 5,
  so the assertion tolerates one shipped flow silently losing its bound. Prefer
  `assert.equal(exhaustible.length, files.length)`. (Carried from round 1's N4.)

## What would make this approvable

1. Rebase the tests branch onto `main`, install dependencies in the integration worktree, re-run, and
   attach a red report whose every failure is an `AssertionError` citing an `SC-` id (B1).
2. Retitle the test file from `EC-*` to the `SC-31`…`SC-42` ids so a failure is traceable (B2).
3. Restate SC-29 as a delta against `main` and fix its assertions (B3).
4. Resolve retry semantics against the frozen contract, **in the contract** (B4).
5. Give SC-10, SC-16, SC-20 and SC-27 runtime assertions rather than YAML greps (M3, M4), and
   range-scope the two `git diff` checks (M2).

Items 1–4 are gating: until they are done the suite is unsatisfiable as a set and the red phase is
unproven. Item 5 is what makes the green phase mean something.

Coverage itself is not the problem, and has not been the problem in either round. Both rounds have
failed on the same file — the one that was supposed to prove the tests run.
