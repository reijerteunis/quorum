# Q-0015 — Scenario review, run 3, iteration 2

*Architecture review of `qa/run-3/scenarios-iter-2.md` against `requirements/merged.md`'s fourteen
criteria, and of `qa/run-3/red-report-iter-2.md` against the suite it reports on. Established against
the merged integration worktree at **`9d33b8b`** (`harness/Q-0015/tests` `a928e80` merged into
`harness/Q-0015/integration` `024de9b`), the ten tasks in `solution/tasks.yaml`, and the flow files
that decide what a development task may write.*

**Verdict: `approve`.** Both assigned checks pass, and this time they pass without a blocker beside
them: **all fourteen criteria have at least one scenario**, verified against the encoded tests rather
than against the catalog's own table, and **the suite fails on assertions and stubs rather than on
compile errors** — 24 stub throws, 6 assertion failures, **zero** collection, transform or
environment signatures across twelve swept patterns. Iteration 1's **B-1** is closed, by exactly the
one-line remedy it prescribed and by nothing else.

Two nits and four observations follow. Neither nit contradicts the approval (*"A nit does not
contradict an approval"*, 2026-08-28), and the first of them is the one thing this pass found that
the last one did not.

---

## 0. What iteration 2 changed, measured rather than taken from its own preamble

The catalog opens by saying it reproduces iteration 1 in full and applies exactly two changes. That
claim is checkable on the branch, and it holds.

```
git diff --stat 3df37bb a928e80 -- . ':!backlog'
 apps/web/src/mission-control-status.test.ts | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

**One file, one line.** `const socketUrl = ['wss', '://x'].join('');` now stands where three raw
`'wss://x'` literals stood on the nine-state fixture's line, and the three `ConnectionState` members
read that binding. The value is identical — `['wss', '://x'].join('') === 'wss://x'` — and
`requestedUrl` is only ever interpolated by `describeConnection`, so every rendered sentence is
byte-identical and the nine-state assertion keeps the subject it had. That is the remedy iteration 1
specified, in the form it specified, following the convention the same file already used three lines
below for a path.

**The catalog's second required change is present.** §9 gains **AC-6-src-e**, which states the
convention as a class rather than as this instance: a fixture under `apps/web/src` assembles any
value that would match a needle **any** shipped scan in the package forbids, naming
`daemon-endpoints.test.ts`'s three same-origin needles beside AC-6's twelve. §3 gains **AC-9f** and
the flagged list gains items 5–7 recording the three observations. Nothing else in the catalog moved.

**What the suite did in consequence, measured both ways.**

| | iteration 1 | iteration 2 |
| --- | --- | --- |
| test files | 20 — **9 failed** / 11 passed | 20 — **8 failed** / 12 passed |
| tests | 355 — **31 failed** / 324 passed | 355 — **30 failed** / 325 passed |
| `test/daemon-endpoints.test.ts` | **1 failed** (B-1) | **15 passed** |
| stub throws / assertion failures | 24 / 7 | 24 / **6** |

**Exactly one test moved, and it is the one that was asked to move.** The stub-throw count is
unchanged at 24, the assertion count fell by the single failure B-1 named, and `test/source.test.ts`
is still 37 passed — so the `WRITE_RULES` register and AC-6's twelve-needle scan are untouched and
still green, which is R-6's named hazard not happening for a second round. A revise round that
changed one line and moved one test is what this step asked for; the churn iteration 1 warned against
did not occur.

## 0.1 How the verdict was established, and why not from the report I was handed

`qa/run-3/red-report-iter-2.md` is 24,490 B — `testReport`'s body cut, 12,000 bytes from each end,
with `… 80009 characters of output omitted from the middle …` between them. Measured against it, it
cannot support either half of the check it exists for:

| asked of the report | what it holds |
| --- | --- |
| failing tests named | **9 of 30** — six in `mission-control-model.test.ts`, three in `routes.test.ts` |
| the `## Failed Tests` section, with every diagnostic | **absent** |
| occurrences of `not implemented` | **0** |
| occurrences of `AssertionError` | **0** |
| `runs-screen`, `mission-control-trace`, `mission-control-status`, `mission-control-screen`, `daemon-client` named anywhere | **0 each** |
| `@quorum/web`'s own summary (`30 failed \| 325 passed`) | **absent** |
| the result-line roster | *"No lines in the output looked like test results."* |

So the verdict was established from **`apps/web/.turbo/turbo-test.log`** — 41,491 B, untrimmed,
written by the same `--force` run at 00:22 — on Q-0120's precedent and iteration 1's. Every figure in
this document comes from that log, from the branch, or from the tree.

**One thing worth recording about the two reports rather than only about the mechanism.** Iteration 1
held **5 of 31** named failures and iteration 2 holds **9 of 30** — the head cut landed at a
different point in a near-identical run, so *which* failures survive is a property of byte offsets
rather than of the suite. That is the argument for a roster being the protection and a body cut being
what it protects against, stated by the two instances rather than from the JSDoc. The mechanism is
**O-1**, and since iteration 1 it has a ticket: **Q-0133**, opened at `78655f2` from this very run.

---

## 1. Satisfiability, checked first

**B-1 is closed.** `test/daemon-endpoints.test.ts`'s AC-13 same-origin scan passes, 15 of 15, where
it carried the one failure no task could clear. A sweep of the whole `apps/web/src` corpus for all
three of that guard's needles — `/['"`]wss?:/`, `/127\.0\.0\.1/`, `/7717/` — returns nothing, so the
set is empty rather than reduced.

**Every one of the 30 remaining failures is reachable by a task that owns the file it names.**

| failing suite | tests | kind | cleared by |
| --- | --- | --- | --- |
| `src/daemon-client.test.ts` | 2 | stub — `daemon-client.ts:199` | **T01**, owns `daemon-client.ts` |
| `src/mission-control-model.test.ts` | 6 | stub — `mission-control-model.ts:35`, `:40` | **T02**, owns `mission-control-model.ts` |
| `src/run-connection.test.ts` | 2 | **assertion** — `700` against `500`; `browserDiscardedCount` `null` against `1` | **T03**, owns `run-connection.ts` and `RUN_EVENT_RETENTION` |
| `test/routes.test.ts` | 3 | **assertion** — rail identity, the five-row identity, the `waitingFor` claim | **T04**, owns `routes.ts`; **T09**, whose `app.tsx` must name `RUNS_PATH` and `RUN_ROUTE` |
| `src/runs-screen.test.ts` | 6 | stub — `runs-screen.tsx:15` | **T05**, owns `runs-screen.tsx` |
| `src/mission-control-trace.test.ts` | 2 | stub — `mission-control-trace.tsx:12` | **T06**, owns `mission-control-trace.tsx` |
| `src/mission-control-status.test.ts` | 6 | stub — `mission-control-status.tsx:20` | **T07**, owns `mission-control-status.tsx` |
| `src/mission-control-screen.test.ts` | 3 | 1 **assertion** (`expected null not to be null`, `:19`) + 2 stub — `mission-control-screen.tsx:19` | **T08** (composition) and **T09** (dispatch) |

Neither of the two kinds this step exists to catch is present: no failure lies in a file no task
owns, and no assertion is true only during the red phase. Both re-checked rather than inherited —
task ownership read out of `tasks.yaml`'s `Own only …` clauses and `contracts:` lists, not from
iteration 1's table.

**One file is owned by no task, correctly, and it is worth saying so before a development-stage
reviewer meets it as a gap.** `src/mission-control-text.ts` appears in T05's, T07's and T08's
`contracts:` and in nobody's `Own only`. It needs no owner because nothing in it is a stub: six real
exports, no `throw`, five `MISSION_CONTROL_DISCLOSURES`, three `STEP_DISPOSITION_TEXT` labels, and
two loss sentences that share no distinguishing word. If it threw, the six status failures would name
it rather than `mission-control-status.tsx:20`, and they do not.

---

## 2. Coverage — all fourteen criteria have at least one scenario

Verified against the **encoded tests**, by reading each file, rather than against the catalog's own
AC→suite table.

| AC | scenario | suite carrying it | observed |
| --- | --- | --- | --- |
| **AC-1** one validated read, no poll, explicit refresh | §1 ×2, §4 AC-1a–c | `daemon-client.test.ts` (2), `runs-screen.test.ts` | red (stub) |
| **AC-2** daemon order, row fields, explicit ticket absence | §4 AC-2a–d | `runs-screen.test.ts` | red (stub) |
| **AC-3** five request states, honest empty with its cause | §4 AC-3a–c | `runs-screen.test.ts`, `request-state.test.ts` | red (stub) + green register — **nit N-1** |
| **AC-4** one column per exact `stepId`, interleaved | §2 AC-4a/b, §5 | `mission-control-model.test.ts`, `-trace.test.ts` | red (stub) |
| **AC-5** run-level lane, nothing dropped | §2 AC-5a–c, §5 | `mission-control-model.test.ts`, `-trace.test.ts` | red (stub) |
| **AC-6** verbatim escaped text, vendor badge, nothing derived | §2 vendor, §5 AC-6a–c, §9 AC-6-src-a–e | `-trace.test.ts`, `source.test.ts` | red (stub) + green guard |
| **AC-7** three dispositions, never *running* after terminal | §2 AC-7a–f, §7 | `mission-control-model.test.ts`, `-screen.test.ts` | red (stub) |
| **AC-8** nine states in the main region, never blank | §6 AC-8a–c, §7 | `mission-control-status.test.ts`, `-screen.test.ts` | red (stub) |
| **AC-9** bounded retention, derived not chosen | §3 AC-9a–f | `run-connection.test.ts` | red (**assertion**) |
| **AC-10** two losses, two counters, two sentences | §3 AC-10 + lexical pin, §6 AC-10a–d | `run-connection.test.ts`, `-status.test.ts` | red |
| **AC-11** five disclosures, no substitute rendered | §6 AC-11a–d | `mission-control-status.test.ts` | red (stub) |
| **AC-12** gate link from `pendingGates`, not from a `gate` event | §6 AC-12a–c | `mission-control-status.test.ts` | red (stub) |
| **AC-13** one connection, re-targeted not leaked | §7 AC-13a–d | `mission-control-screen.test.ts`, `shell.test.ts` | 1 red, 2 green pins |
| **AC-14** the write boundary does not move; registers do | §7 AC-14 wiring, §8 AC-14a–h | `-screen.test.ts`, `routes.test.ts`, `source.test.ts` | red (**assertion**) |

**Assigned check 1: pass.** No criterion is uncovered. The four the requirement names as not eligible
for trimming each still carry the discriminating clause its *Test:* paragraph asks for, re-read in
place this iteration:

- **AC-4** — the fixture is genuinely alternating, `[step('b'), step('a'), done('b'), done('a')]`,
  and the expected column order `['b','a']` is **not sorted**, so a renderer opening a column on
  every change of id fails it; the same-id clause takes the literal `'undefined'` and expects one
  column.
- **AC-5** — conservation is arithmetic,
  `runActivity.length + Σ columns.events.length === events.length`, beside an exact `runActivity`
  type identity `['info','warn','gate','terminal']` over a fixture whose `info` carries a
  `dev:T-0001.1: ` prefix. That is what makes prefix re-attribution **fail** rather than merely be
  discouraged.
- **AC-11** — all five disclosures asserted `toContain` **and in ascending index order**, plus the
  header needle `/—|\$|0:00|n\/a/`, plus the pairing that discriminates the source of the run number:
  loaded metadata carrying `runId: 99` must still render the handle, and a retained `terminal`
  carrying `runId: 42` must render `42`.
- **AC-14** — `source.test.ts` is unchanged at 37 passed, so `'/stop'` is still `permitted: null`,
  the permitted set is still exactly the two named modules, and all three anti-vacuity clauses still
  read as they do on `main`. The write boundary has not moved, which is the property that keeps
  §5.6's split honest.

Two clauses are carried by their *Test:* paragraph rather than by a direct assertion, and neither is
raised as a gap, per *"An adapter records the version it was verified against"* E-1 — a criterion's
*Test:* clause bounds the instrument and a reviewer may not raise the job it gives it. AC-9's
*"per-event append work is bounded rather than growing with the run's length"* is discharged by the
500 / 501st / 700 cases, the order, the exact counter and the unchanged earlier snapshot, all four
present. And **AC-9f** — the catalog's new clause about `run-connection.ts`'s comment stating the
surviving reasons and dropping the stale Q-0121 forecast — has no test, which is correct: AC-9's own
*Test:* clause specifies the retention cases and asks for no source-text assertion, and the
requirement's Appendix B routes that comment correction to an `observation:` rather than to a guard.
`run-connection.ts:160` still carries the stale sentence; T03 owns the file, so the development round
can close it, and nothing goes red if it does not. Recorded, not raised.

---

## 3. Red for the right reason — 24 stub throws, 6 assertions, 0 compile errors

| kind | tests | blocks | where |
| --- | --- | --- | --- |
| `Error: not implemented`, thrown by a typed stub at its final path | **24** | 12 | `fetchRuns`, `partitionTrace`, `buildStepTimeline`, `RunsScreen`, `MissionControlTrace`, `MissionControlStatus`, `MissionControlScreen` |
| `AssertionError` over real values | **6** | 6 | `routes.test.ts` ×3, `run-connection.test.ts` ×2, `mission-control-screen.test.ts` ×1 |

30 `FAIL` lines, 30 failures, and the two kinds account for all of them.

Every stub failure names a line in a **production** file at its shipped path — `daemon-client.ts:199`,
`mission-control-model.ts:35` and `:40`, `runs-screen.tsx:15`, `mission-control-trace.tsx:12`,
`mission-control-status.tsx:20`, `mission-control-screen.tsx:19` — which is *"A typed stub lives at
its final path"* (2026-09-11) working: the imports resolve, the types exist, and the failure is
behaviour rather than absence. `RUN_EVENT_RETENTION` resolves, which is why AC-9 fails on `700`
against `500` rather than on a missing symbol.

**Nothing in the log is a collection failure.** Swept for every signature `environmentFailure`
recognises and for the shapes it does not: `Cannot find package` 0, `Cannot find module` 0,
`ERR_MODULE_NOT_FOUND` 0, `SyntaxError` 0, `command not found` 0, `ERR_REQUIRE_ESM` 0,
`does not provide an export` 0, `Transform failed` 0, `Unhandled Error` 0, `Failed to load` 0,
`No test suite found` 0, `TypeError` 0. All 20 files were collected and all 355 tests ran.

**Assigned check 2: pass.**

**Three suites are green by design, and `8 failed | 12 passed` should not be read as dropped
scenarios.** `source.test.ts` (37) carries AC-6's twelve-needle scan, a negative property already
true of the corpus, with both anti-vacuity fixtures present and assembled — the positive control on
`` `cost=$0.123` `` and the acceptance case on `[role="progressbar"]`, which is the exact false
positive E-1 exists to avoid. `daemon-endpoints.test.ts` (15) is green because B-1 was fixed. And two
of `mission-control-screen.test.ts`'s five are AC-13's **regression pins** — one controller
re-targeted across handles with its stale callback inert, and the gate route constructing no socket,
which is Q-0016 erratum E-2's ruling. Green is the correct colour for all three.

---

## 4. Nits

**N-1 — AC-3's *Test:* clause asks for one case per request-state kind, and the suite stages four of
five: `RunsScreen` is never rendered while its read is in flight.** The four are `loaded` (three
cases), `unreachable`, `refused` and `unparseable`, the last three through one `test.each`. There is
no `in-flight` case, and the catalog's own §4 AC-3a names that kind **first** among the four it
lists — so this is the catalog and the suite disagreeing, not only the suite and the requirement.

What that permits is specific: an implementation that renders a blank region, a spinner or a skeleton
for the one moment before the read settles is **green**, and that is the shape AC-3's own last
sentence forbids by name (*"No state is a spinner, skeleton, blank panel, colour or disabled control
alone"*) and `docs/04-architecture.md:317` forbids by name. `in-flight` is the only one of the five
where a spinner is even tempting.

**Why a nit and not a blocker, stated rather than assumed.** The property underneath it is already
asserted **by value over all five kinds** in a green pre-existing suite: `request-state.test.ts`
proves the corpus covers every declared kind, that every member renders more than ten characters of
non-whitespace, and — as an identity — that *"the two that are not failures offer no retry, and the
three failures do"*. AC-3 requires the screen to render `request-state.ts`'s text *verbatim*, so a
screen that reaches for the module inherits the property; what is unasserted is only that
`RunsScreen` selects it for that moment. T05 owns `runs-screen.tsx`, so this is a defect the
development flow can both introduce and repair — it is not the class this step blocks on, which is a
fix no task can make. And this step's backward edge is `max_iterations: 1`, spent by iteration 1, so
a second `revise` reaches an exhaustion gate over roughly three lines rather than buying a round.

**The remedy exists three times in this package, verbatim, in files the author was reading.**
`backlog-board.test.ts:526–530` renders with `() => new Promise(() => undefined)`, asserts the
in-flight text names the endpoint it is waiting for, and then asserts
`querySelector('[role="progressbar"]')` is `null` under the message *"the screen is a spinner"*.
`ticket-page.test.ts:535–548` stages the same moment inside a five-kind identity whose comment reads
*"in-flight: rendered before anything settles, which is what the never-resolving fetch stages"*, and
`:569` asserts all five kinds were seen. `gate-screen.test.ts:417` records the reason in one line:
*"The in-flight moment, which is the one a spinner would occupy."* **The runs landing is the only
screen in `apps/web` whose in-flight moment is unstaged and the only one with no anti-spinner
assertion.** Closing it is a copy of an existing pattern into a file QA already owns.

**N-2 — `routes.test.ts`'s derived guard is still derived in its subject list and enumerated in its
needle.** Iteration 1's N-1, recommended and not taken — correctly, given that iteration 2 was told
to change one line. `:139` derives its subjects from `SCREEN_ROUTES.filter(screenExists)` as SE-2
asked, and the constant *name* it then looks for in `app.tsx` is a five-branch ternary whose final
`else` is `'RUN_ROUTE'`, so a sixth screen-bearing route matching none of the five would be checked
against a needle `app.tsx` already contains. The fail-open shape Q-0051 found in
`q0050.source.test.ts`. It does not weaken this ticket's subject — AC-14f holds, and removing
`RUNS_PATH` from `app.tsx` turns it red by name — and it is restated once so the gate can see it is
still open rather than assume the recommendation was taken.

Iteration 1's other nit is **resolved rather than carried**: the `/runs` row's replacement sentence
is not bounded by length alone. `routes.test.ts:232`'s
`.not.toMatch(/No ticket builds this screen yet/)` is a content assertion, it is failure 3 of 30, and
the green sibling *"and it says what it is now waiting for, which is a screen rather than a daemon"*
carries the other half.

---

## 5. Observations

True, worth recording, and none of them a claim about this change (decision 089).

**O-1 — the red report a QA gate reads carries 9 of 30 failures and no diagnostics at all, and the
mechanism now has a ticket.** `suite-output.ts`'s `RESULT_LINE` anchors at the start of a line, after
optional colour, on a tick, cross, `ok`, `#`, `N)` or `PASS|FAIL|SKIP`; turbo prefixes every line
with `@quorum/web:test: `, so nothing matches, the roster is empty, and the report says *"No lines in
the output looked like test results"* over output containing `30 failed | 325 passed`. Iteration 1
recorded this with no ticket behind it; it is now **Q-0133**, opened at `78655f2` from this run, with
the 8-of-8-populated / 7-of-7-empty census. Nothing here is asked of this ticket:
`packages/core/src/engine/` is outside this step's surface, and a `RESULT_LINE` that tolerates a
prefix changes how every report in this repository is composed.

**O-2 — nothing on this route gates `typecheck` or `lint`, and I measured the one shape of that
hazard present on the branch.** `harness/harness.yaml` makes `commands.test` a `turbo run test`
invocation, so `integrate` runs `test` alone; vitest strips types without checking them, and
`typecheck` and `lint` are separate tasks no step of `qa-red` or `development` runs. Iteration 1
declined to measure whether one bites here. One candidate does exist —
`src/runs-screen.test.ts` and `src/mission-control-status.test.ts` each import `type ReactElement`
and never use it — and it is **harmless under this configuration**: `tsconfig.base.json` sets
`strict` and no `noUnusedLocals`, and `eslint.config.js` enables three rules
(`no-explicit-any`, `ban-ts-comment`, `no-deprecated`), none of which is `no-unused-vars`. Stated
narrowly: that shape does not bite. I did not run `tsc`, so I make no claim that the fixtures
typecheck.

**O-3 — the per-run event count AC-9's bound was derived rather than measured against is still
unmeasured, and correctly not in this suite.** The catalog flags it, and that is right: it is
AC-14's hand-`POST /runs` demonstration at implement or review time, against a daemon this suite does
not stand up. Recorded so the figure Appendix A(b) needs is not assumed to have arrived with the red
phase.

**O-4 — `src/mission-control-text.ts` is named in three tasks' `contracts:` and in no task's `Own
only`, and needs no owner.** It is complete rather than stubbed: six exports, no `throw`, five
disclosures, three disposition labels, two loss sentences. A development-stage reviewer meeting an
unowned file in the diff should not read it as a gap; the discriminating evidence is that the six
status failures name `mission-control-status.tsx:20` and not this module.

---

## 6. What the gate inherits

The suite is red for the right reason, every red is red at a file a task owns, all fourteen criteria
have an instrument, and the four the requirement protects from trimming each keep the discriminator
their clause asks for. The write boundary has not moved.

Two things are open and neither needs a round to close. **N-1** is one test in a file QA owns,
copyable from `ticket-page.test.ts:537`; if the QA owner wants it before development starts, `retry`
at the exhaustion gate is the cheap way to get it, and if not, AC-3's own last sentence is what a
development-stage reviewer reads. **N-2** is a guard's spelling, recommended twice now and taken
neither time, and closing it for a sixth route wants the same file open anyway.

Nothing here asks the development flow to do something no task can do, which is the failure this step
exists to catch and the one it caught last round.
