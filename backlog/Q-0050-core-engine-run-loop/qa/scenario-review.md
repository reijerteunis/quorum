# Scenario review — Q-0050, round 3

*Architecture reviewer, 2026-08-29 · verdict **revise**. This traversal is the one the exhaustion
gate's `retry` at 07:37 authorised (`runs.log`: `counter=qa-red.scenario-review set=1`), so a second
`revise` re-presents that gate rather than looping. The work list at the end is written for that:
mechanical, bounded, and split by who can actually perform each item.*

*Inputs: `requirements/merged.md`, `qa/scenarios.md` (round 3), `qa/red-report.md`,
`qa/red-integration.md`. Also read and **executed**, because the report is truncated and — as B-2
shows — largely empty: the seven test files on `harness/Q-0050/tests` at `ce369db`,
`contracts/Q-0050/**`, `solution/tasks.yaml`, `solution/errata.md` E-1–E-5, `packages/core/turbo.json`,
`packages/shared/turbo.json`, `packages/core/src/turbo-inputs.test.ts`, `packages/core/test/corpus.ts`,
`packages/core/src/lint/lint.ts`, `packages/shared/src/events.ts`, `harness/roles/automation-qa.md`,
and `@vitest/expect`'s matcher source. Every number below was measured in
`.harness/worktrees/harness__Q-0050__integration` at `1d79099`, which carries the merged tests
(`git diff --stat harness/Q-0050/tests -- packages/` is empty).*

## The two questions this step asks, answered first

**Every acceptance criterion has at least one scenario: yes, 13 of 13.** Nothing is uncovered at the
criterion level, and round 2's six blockers are genuinely addressed in the document: the lint fixture
now names a rule `lintFlow` really enforces (`lint.ts:177`, `on_fail without goto` — verified),
composed runs use a real repository, `round()`'s output is no longer assumed to carry two decimals,
`finish()`'s raw cost is separated from `outcome()`'s rounded one, and the dry proof runs through a
delegating `persistence` instead of demanding an `if (ctx.dry)` the contract forbids.

**The red report shows the suite failing on assertions rather than compile errors: the report does
not show that, and it cannot.** `@quorum/core#test` never ran. The evidence is three-way and each
leg is independent:

- `turbo run test --dry=json` in the integration worktree reports **7 tasks**, and
  `@quorum/core#test | deps: ["@quorum/shared#test"]` — the only task in the graph with a dependency.
  The report's summary says `5 successful, 6 total` with `Failed: @quorum/shared#test`. The seventh
  task was pruned by the failure of the sixth.
- The report's total wall time is **1.101s**. The core suite alone takes **26.75s** here, forced.
- The string `@quorum/core` appears **nowhere** in the retained head or tail of the 57 KB report.
  Core can only run *after* shared, so its output would have been in the tail, which is intact.

So the artifact the gate reads proves exactly **one** assertion red: `docs.test.ts:165`,
`toContain('terminal')` over `docs/GLOSSARY.md`. That is AC-13b and nothing else.

I therefore answered the question directly instead of from the artifact. In the merge worktree:

```
packages/core: tsc --noEmit           → exit 0        (no compile error, JSON import included)
packages/core: vitest run             → 39 failed | 835 passed | 2 skipped  (42 files, 26.75s)
                                        34 AssertionError, 1 raw stub throw, 0 transform/import errors
packages/core: vitest run src/engine  → 33 failed | 4 passed  (37 tests, 6 files)
packages/core: vitest run src/turbo-inputs.test.ts → 6 failed | 56 passed
packages/shared: events.q0050.test.ts → 15 passed | 0 failed
```

**The engine tests are red for the right reason** — assertions and caught stub throws, no missing
symbol, no transform failure. That half is good work. But 6 of the 39 failures are a landed guard
the new tests broke, and no development task may repair it; and none of the 39 reached the report.

**Verdict: revise.** Satisfiability first, per this role's ordering: two classes of assertion cannot
go green against any implementation obeying the contracts, and the gate's own evidence is missing.

---

## Blockers

### B-1 — Six assertions in a landed guard, fixable by no task in `tasks.yaml`

`packages/core/src/turbo-inputs.test.ts` fails six times, entirely because of the two new files:

| Clause | Reported |
| --- | --- |
| B — "names no repository path that nothing hashes" | `engine.test.ts: harness/harness.yaml` |
| Q-0073 — two inventories classify identically (×2) | `engine.test.ts: harness/harness.yaml` |
| C2 — repository root derived outside the route modules | `q0050.source.test.ts: import.meta` |
| C3 — no literal names a location outside its package | `q0050.source.test.ts: ../../../shared/src/events.ts` |
| C4 — every computed read names its base | `q0050.source.test.ts: folder` |

This is round 2's B-1 arriving through new doors. `solution/errata.md` E-5(c) already wrote the rule
down — *"Any core-side out-of-package read that survives must be registered in **both**
`packages/core/turbo.json` and `turbo-inputs.test.ts`'s `READ_BASES` in the same round"* — and round
3 deleted `docs-q0050.test.ts` (correct) while introducing two fresh violations of the same rule.

**Nobody in the development stage can close it.** All eight tasks say *"Do not touch … tests"*, and
no task names `packages/core/turbo.json`. An `integrate` step with `expect: pass` therefore cannot go
green: the fan-out would spend its budget being unable to tell "the agents failed" from "the agents
were asked for the impossible". That is the first of the two questions
`harness/roles/automation-qa.md` puts to a scenario, answering no.

**The remedy is smaller than the problem, and it is QA's, this round.**

- `q0050.source.test.ts` should read its subjects through `packages/core/test/corpus.ts`'s
  `repoFile()` — the route module every landed `*.source.test.ts` already uses
  (`adapters.source.test.ts:102`, `fanout.source.test.ts:56`, `run-history.source.test.ts:179`).
  That removes C2, C3 and C4 outright, with no register edit at all.
- **AC-13c's reverse direction belongs in `packages/shared`.** The claim is "`shared` imports nothing
  from `core`", and asserting it from `packages/shared/src/*.test.ts` makes it an in-package read
  costing nothing — the exact shape E-5(c) chose for AC-13b. `packages/shared/src/index.test.ts:48`
  already reads `packages/core/package.json` and `src/index.ts` under a declaration, so the file and
  the precedent both exist. The forward direction is already pinned by the landed
  `packages/core/src/shared-resolution.test.ts`.
- `engine.test.ts`'s `harness/harness.yaml` is a path **written into a temp repository** — data, not
  a read. It needs a register entry, exactly like the landed
  `packages/shared/src/project.test.ts: harness/harness.yaml` entry at `turbo-inputs.test.ts:1626`.

### B-2 — The red evidence covers one criterion of thirteen, and it is structural, not a bad run

Measured above: `@quorum/core#test` was pruned because `@quorum/shared#test` failed first and the
root `test` task declares `dependsOn: ["^test"]` (Q-0072). Round 2's review recorded that this
pruning was *closed* — "`@quorum/shared#test` is green, so `dependsOn: ["^test"]` no longer prunes
`@quorum/core#test`". Round 3 made shared red, correctly and deliberately, to give AC-13b a failing
test — and re-opened it. Every subsequent round has the same property: **while AC-13b is red, no
engine evidence can reach the gate**, and the same will be true of the development stage's evidence
until the docs task lands.

Nothing QA owns fixes this. `commands.test` is `harness/harness.yaml`'s and is governed by Q-0065's
decision; `qa/red-report.md` is written by `prove-red`'s `type: integrate` step, not by an agent.
So this needs a human action at the gate, in the shape of E-5:

- record in `solution/errata.md` that on this route a red in `@quorum/shared` prunes
  `@quorum/core`, so the integrate artifact is not sufficient evidence for a red phase; and
- attach the direct run as the evidence it replaces. I performed it once, above: **39 failed, 835
  passed, 2 skipped; 34 `AssertionError`, one raw stub throw, zero compile or import errors**, with
  `tsc --noEmit` clean.

The general defect — a package's red hiding its dependents' reds, which is backwards for a red phase
— is worth a successor ticket rather than a footnote. It is Q-0071's *"what is a green tick being
claimed for"* inverted: here a red tick claims a suite that never executed.

### B-3 — `engine.test.ts`'s dry scenario asserts spy matchers on a real `Backlog`

`options()` passes `backlog: project.backlog` from `loadProject(repoDir)`, which is a real `Backlog`
instance (`packages/core/src/backlog/project.ts:86`) whose `write`, `writeFile` and `log` are ordinary
prototype methods (`backlog.ts:131`, `:193`, `:201`). Lines 83–85 then assert:

```ts
expect(opts.backlog.write).not.toHaveBeenCalled();
```

`@vitest/expect`'s `called` matcher calls `assertIsMock` **first** (`dist/index.js:1429-1435`), which
throws `TypeError: … is not a spy or a call to a spy!` — `.not` does not reach it. Three assertions
that no implementation can satisfy, in the test that carries AC-10b and AC-10c. This is round 2's B-6
recurring one level up: the document's own note ("assert on the underlying `backlog` call") was
applied in `lifecycle.test.ts` and not here.

Two fixes, and the second is better because AC-10a currently has no test at all: spy the three
writers before the run (`vi.spyOn(project.backlog, 'write')`), or assert on **disk** — `ticket.md`
byte-unchanged, no `runs.log`, no `.quorum/` — which is what AC-10a asks for in the first place.

### B-4 — Fourteen scenarios have no executing test, including seven of the eight round 2 named

Round 2's F-2/F-4 listed AC-5a, AC-5b, AC-8b, AC-8c, AC-8d, AC-9e, AC-10d and AC-10e as written but
unimplemented. Round 3 answered by leaving the scenarios unchanged and making **`red-report.md`**
responsible for naming, per criterion, which test executes it. That remedy is assigned to a file no
step on this route writes: `qa/red-report.md` is `prove-red`'s `output.writes`, an engine artifact —
its content is raw `testReport` output, as the file itself shows. So the obligation could not be
discharged, and seven of the eight are still unimplemented.

With nothing exercising them anywhere in the 37 engine tests, the three shared tests or the one docs
test:

**AC-2b** (the engine adds the step id and nothing else — `channel.test.ts` supplies `stepId` itself,
so nothing tests enrichment) · **AC-2c** (no cross-member order in a `parallel` group) · **AC-2f** (a
failed step emits no `done`) · **AC-5a** (a step throws: occurrences finalised, terminal line, then
the throw) · **AC-5b** (cancelled mid-step) · **AC-5e** (listener count across ten runs) · **AC-8b**
(the `crossFlowRegression` text and the seven regression fields) · **AC-8c** (goto naming an absent
flow) · **AC-8d** (`remaining` clamped at zero) · **AC-9e** (run-history initialisation failure) ·
**AC-10a** (nothing on disk, no `.quorum/`) · **AC-10d** (the engine's `Object.create` view, with
reads still passing through — `lifecycle.test.ts:100` builds a view *in the test*, which proves
nothing about the one `engine.ts` constructs) · **AC-12c** (a gate or script nested in a `parallel`
group dispatches as an agent step) · **AC-12d** (unknown goto target → raw `TypeError`).

Three of those are load-bearing beyond their own criterion. AC-8b/c/d are the entire observable
surface of cross-flow regression, and E-3 puts that behaviour in `engine.ts` — where the only test is
`lifecycle-routing.test.ts`'s "returns a decision without running the target", which asserts nothing
about the stage the ticket lands on. AC-12c and AC-12d are two of the eight preserved defects:
unpinned, an implementer who "fixes" either is green everywhere, which is the port's standing hazard.

### B-5 — The fixture-oracle rule the document restates is broken by the tests it governs

The test-design notes name all seven owned sites and forbid hand literals and prefix regexes without
exception. Measured across the whole workspace, `run-messages.fixture.json` is imported by exactly
one file and referenced twice: `engine.test.ts:57` (`runBanner`) and `:66` (`terminalInfo`).

- Never asserted anywhere: `crossFlowRegression`, `loopIteration`, `loopExhausted`,
  `exhaustionReason`, `rollback`, `gateAutoAdvanced`, `gateDryRun`, `log.rollback`, `log.start`.
- Asserted as a **hand-retyped literal**: `log.retryGrant` (`lifecycle-routing.test.ts:118`) and
  `log.recordEvent` (`lifecycle.test.ts:73`).
- Asserted by **prefix/substring**: `log.terminal` (`lifecycle.test.ts:56`,
  `stringMatching('run=7 ${status} stage=')` — so the cost, tokens and the JSON-quoted `errorSuffix`
  are untested), `log.gateAnswer` (`stringContaining('answer=advance')`).

That is F-1 of round 2 recurring with two of seven closed. The consequence is concrete rather than
stylistic: charter §2 preserves this text as externally observable behaviour, and five of the seven
strings currently have no oracle at all.

---

## Findings

**F-1 — `packages/shared/src/events.q0050.test.ts` is green today, so one task has no red.** All 15
tests pass, because solutioning already shipped the final schemas: `events.ts` carries `gateId`
(`:181`), `gateAnswerEnvelopeSchema` (`:194`) and `runTerminalEventSchema` (`:211`) with the closed
regression group. The `q0050-shared-events` task is told to "replace the Q-0050 contract declarations
with the final strict schemas" — and no test can tell whether it did. Either the criteria (AC-2e,
AC-3c, AC-3d and the schema half of AC-4c/d) should say plainly that they are satisfied by the
contract and carry forward as permanent guards, or the task is a no-op and the gate should record
that. Silence is the one option that leaves a reader thinking the red phase proved something here.

**F-2 — the fixture import escapes the package, and the guard is blind to it by design.**
`engine.test.ts:7` imports `../../../../contracts/Q-0050/run-messages.fixture.json`. It is the only
out-of-package import in `packages/core/src`. `turbo-inputs.test.ts:1985` excludes module specifiers
from the scan on purpose — sound for in-package imports and for workspace dependencies, which
`dependsOn: ["^test"]` hashes, and **blind to an import that leaves the package into a non-package
directory**. `packages/core/turbo.json` does not declare `contracts/**`, so `@quorum/core#test` can
replay a cached pass after the message oracle changes: Q-0072's defect one layer over, arriving where
nothing reports it. The declaration is a one-line human edit; the hole in the guard is worth carrying
to Q-0073's successor.

**F-3 — the per-criterion map belongs in `qa/scenarios.md`, the only artifact QA controls.** A table
of criterion → file → test name in this document would have made B-4 visible without a reviewer
reading seven files, and would survive the fact that `red-report.md` is engine-written.

**F-4 — `RoutingContext.finishRun` has no asserted caller.** `lifecycle-routing.test.ts:127` requires
it *not* to be called, which agrees with E-3 (routing returns the target; `engine.ts` moves the
cursor), but nothing anywhere asserts that `engine.ts` calls it. Combined with AC-8b/c/d having no
test, the whole regression path is contracted and unwitnessed.

**F-5 — `lifecycle.test.ts:106-107` cannot fail.** The dry view's own `write`/`log` are `vi.fn()`, so
`realBacklog.write` is unreachable whatever `finish` does. The load-bearing assertion in that test is
`writeTicket` having been called once; the two prototype assertions read as proof and are not. The
same shape as the empty-`error` finding Q-0048 caught by asserting the subject was non-empty first.

**F-6 — AC-9d's behavioural half is thinner than the scenario.** The scenario asks for a real task
branch beside the ticket branch, unchanged after a failed run. `lifecycle.test.ts:78` asserts call
counts on an injected `resetBranch` and its arguments; the negative-existence source scan
(`q0050.source.test.ts:41`) is the stronger half. Row 20 is the gap this ticket carries forward
deliberately — worth a real branch, once, so a later change has to argue with a branch head.

---

## Nits

- `lifecycle.test.ts:63` calls `outcome()` without the file's `implemented()`-style wrapper, so its
  stub throw surfaces raw (`Error: Q-0050 contract stub`) rather than as an assertion about the stub
  having been replaced — the one failure of 39 that is not an `AssertionError`.
- AC-1d's JSDoc scan is `/\/\*\*[\s\S]*?export /` per file, which one comment anywhere above one
  export satisfies; the criterion says *every* export and non-obvious field.
- AC-11a's "no `runs.log` line and no run directory was created" half is not asserted — only the four
  message checks are, which are correctly four discrete checks now.
- AC-4c's duplicate-answer clause (a second envelope for the same `gateId` after the first was
  accepted) is not exercised; only the stale-`gateId` case is.
- AC-13d asserts the presence and count of `Why: preserved defect` lines but not the "reproduces no
  sentence from a decision entry or ticket body" half that gives the criterion its point.

---

## Coverage at criterion level

Executing tests found: 37 in `packages/core/src/engine/*.test.ts`, 3 in
`packages/shared/src/events.q0050.test.ts`, 1 in `packages/shared/src/docs.test.ts`.

| Criterion | Executing test | State |
| --- | --- | --- |
| AC-1a/1c | `q0050.source.test.ts` #1, #2; `corpus.test.ts:36` extended | green today (guards) |
| AC-1b | landed `fanout.source.test.ts:57`, `run-history.source.test.ts:180` | covered by inheritance — say so |
| AC-1d | `q0050.source.test.ts` #1 | weak (nit) |
| AC-2a | `engine.test.ts` #1 | 2 of 7 texts (B-5) |
| AC-2b, 2c, 2f | — | **none** (B-4) |
| AC-2d | `channel.test.ts` #1 | red ✓ |
| AC-2e | `events.q0050.test.ts` #1 | green already (F-1) |
| AC-3a | `engine.test.ts` #1 + `lifecycle.test.ts` #1–5 | partial: `completed` only for last-value |
| AC-3b | `channel.test.ts` #2 | red ✓ |
| AC-3c/3d | `events.q0050.test.ts` #2 | green already (F-1) |
| AC-4a/4b/4d/4e/4f/4h | `lifecycle-routing.test.ts` #1–4; `q0050.source.test.ts` #4 | red ✓ |
| AC-4c | `lifecycle-routing.test.ts` #3 | partial (duplicate answer) |
| AC-4g | `lifecycle-routing.test.ts` #2 | partial (substring) |
| AC-5a, 5b, 5e | — | **none** (B-4); the source scan is a proxy only |
| AC-5c/5d | `lifecycle-routing.test.ts` #5; `channel.test.ts` #3 | red ✓ |
| AC-6a/6b/6c/6e | `lifecycle-routing.test.ts` #6, #7, #4 | red ✓ |
| AC-6d | `lifecycle-routing.test.ts` #7 + `lifecycle.test.ts` #3 | partial (ordering not observed) |
| AC-7a/7b/7c | `lifecycle-routing.test.ts` #8, #9 | red ✓ (7b hand literal) |
| AC-8a | `lifecycle-routing.test.ts` #10 | partial: the stage half is untested |
| AC-8b, 8c, 8d | — | **none** (B-4) |
| AC-9a/9c | `lifecycle.test.ts` #1–5, #4 | red ✓ |
| AC-9b | `lifecycle.test.ts` #1–5 | partial (prefix; no rollback line) |
| AC-9d | `lifecycle.test.ts` #4 + `q0050.source.test.ts` #5 | partial (F-6) |
| AC-9e | — | **none** (B-4) |
| AC-9f | `lifecycle.test.ts` #1–5 | raw half only; the rounded entry is untested |
| AC-10a, 10d | — | **none** (B-4) |
| AC-10b/10c | `engine.test.ts` #3 | **unsatisfiable** (B-3) |
| AC-10e | `lifecycle-routing.test.ts` #4 | partial (no `gateDryRun` event) |
| AC-10f | `lifecycle.test.ts` #6 | red ✓ (F-5) |
| AC-11a | `engine.test.ts` #2 | red ✓; disk half missing |
| AC-11b–11g | `loaders.test.ts` #1–5 | red ✓ |
| AC-12a/12b | `lifecycle.test.ts` #4 (null-start row), #5; `q0050.source.test.ts` #6 | red ✓ |
| AC-12c, 12d | — | **none** (B-4) |
| AC-12e | none, by E-5(b) | correctly not a test |
| AC-13a/13e | gate actions | n/a |
| AC-13b | `packages/shared/src/docs.test.ts` (new block) | red ✓ — the one red the report shows |
| AC-13c | `q0050.source.test.ts` #3 | red ✓, but it is the read that trips the guard (B-1) |
| AC-13d | `q0050.source.test.ts` #4, #6 | partial (nit) |

---

## What round 4 has to change

**QA, in this loop — mechanical:**

1. Route `q0050.source.test.ts`'s reads through `test/corpus.ts`'s `repoFile()`, and move AC-13c's
   "`shared` imports nothing from `core`" assertion into `packages/shared`. Closes four of the six
   guard failures with no register edit.
2. Register `engine.test.ts`'s `harness/harness.yaml` as temp-repo data in `turbo-inputs.test.ts`,
   beside the existing `project.test.ts` entry. Closes the other two.
3. Replace `engine.test.ts:83-85` with spies on the real `Backlog`, or better, with AC-10a's on-disk
   assertions — which also gives AC-10a the test it does not have.
4. Write the fourteen missing tests, or strike the scenarios with a stated reason. AC-8b/c/d, AC-12c
   and AC-12d are the ones I would not let through: three are the whole observable surface of
   cross-flow regression, and two are preserved defects that nothing pins.
5. Interpolate the remaining five owned texts from the fixture, and replace the two hand literals and
   the two prefix matches.
6. Put the criterion → file → test-name table in `qa/scenarios.md`, since `red-report.md` cannot
   carry it.

**Human, at the gate — cannot be produced by any step on this route:**

7. An erratum recording that a red in `@quorum/shared` prunes `@quorum/core#test`, so `prove-red`'s
   artifact is not sufficient red-phase evidence here, with the direct run attached (39 failed / 835
   passed / 2 skipped, 34 assertion failures, `tsc --noEmit` clean).
8. One line in `packages/core/turbo.json` declaring `../../contracts/Q-0050/run-messages.fixture.json`,
   so the oracle the tests interpolate is inside the hash of the task that runs them — and a note for
   Q-0073's successor that the guard cannot see an out-of-package **import**.
9. If F-1 stands, a sentence recording that `q0050-shared-events` has no failing test because
   solutioning shipped the final schemas.
