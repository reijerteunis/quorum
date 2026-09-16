# Q-0015 — Scenario review, run 3, iteration 1

*Architecture review of `qa/run-3/scenarios-iter-1.md` against `requirements/merged.md`'s fourteen
criteria, and of `qa/run-3/red-report-iter-1.md` against the suite it reports on. Verified against
the merged integration worktree at `024de9b` (`harness/Q-0015/tests` `3df37bb` merged into
`harness/Q-0015/integration`), the ten tasks in `solution/tasks.yaml`, and the flow files that
decide what a development task may write.*

**Verdict: `revise`.** One blocker — **B-1**, an assertion that cannot go green whatever the
development flow builds. Both of the checks this step is asked for pass: **all fourteen criteria
have at least one scenario**, and **the suite fails on assertions and stubs rather than on compile
errors** — 24 stub throws, 7 assertion failures, zero collection or environment signatures. The
catalog itself is sound and needs no rewrite; §6 says precisely what the round should change, which
is one line in one test file plus one clause in §9 of the catalog so the class is closed rather than
the instance.

---

## 0. How this verdict was established, and why not from the report I was handed

`qa/run-3/red-report-iter-1.md` is 24,496 B — `testReport`'s 24,000-byte body cut, 12,000 from each
end, with `… 86308 characters of output omitted from the middle …` between them. Measured against
it, it cannot support either half of the check it exists for:

| asked of the report | what it holds |
| --- | --- |
| failing tests named | **5 of 31** — three in `routes.test.ts`, two in `run-connection.test.ts` |
| the `## Failed Tests` section, with every diagnostic | **absent** |
| occurrences of `not implemented` | **0** |
| the five new suites named anywhere | **0** |
| `@quorum/web`'s own summary (`31 failed \| 324 passed`) | **absent** |
| the result-line roster | *"No lines in the output looked like test results."* |

So the verdict was established from **`apps/web/.turbo/turbo-test.log`** — 44 KB, untrimmed, written
by the same `--force` run — on Q-0120's precedent, where all three scenario reviews established
their verdicts from the untrimmed artifact instead of the trimmed one. Every figure below is from
that log or from the tree. The mechanism behind the report's silence is **O-1**, and it is the
engine's rather than this ticket's.

**Whole-workspace shape.** Seven packages, six green, `@quorum/web` red: 20 files, **9 failed / 11
passed**; 355 tests, **31 failed / 324 passed**. `@quorum/shared` 247 passed, `@quorum/cli` 692
passed, `core`, `server`, `templates` and `compiler` green. The red is confined to the surface under
change, which is what a red phase should look like.

---

## 1. Satisfiability, checked first

### B-1 (blocker) — one failing assertion cannot be cleared by anything the development flow builds

```
FAIL  test/daemon-endpoints.test.ts > AC-13 — same-origin daemon endpoints
      > browser source contains no socket scheme, daemon hostname, or chosen daemon port
AssertionError: mission-control-status.test.ts carries a socket scheme literal:
      expected true to be false
 ❯ test/daemon-endpoints.test.ts:112:102
```

**The offender is one line, and the set is complete.** `apps/web/src/mission-control-status.test.ts:15`
builds its nine-state fixture with `requestedUrl: 'wss://x'`, three times on that line. A sweep of the
whole corpus for all three of the guard's needles — `/['"`]wss?:/`, `/127\.0\.0\.1/`, `/7717/` —
returns that line and nothing else, so this is one instance and not the first of several. The same
grep over `main` returns nothing, so the guard was green and this branch introduced its only
violation.

**Why it cannot go green.** The guard walks every file under `apps/web/src` — test files included,
which is Q-0014 AC-5's deliberate shape — and asserts per file. Three routes out, all closed:

1. **Fix the fixture.** `apps/web/src/mission-control-status.test.ts` is a test file. Not one of
   T01–T10 names it in `contracts:`, every one of T01–T09 ends *"Do not touch … tests"*, T10 says
   *"Do not touch apps, packages, tests"*, and `development.yaml:16` instructs every fanned-out task
   *"Implement ONLY your task so that the tests covering it pass. Do not modify tests."*
2. **Re-aim the guard.** `apps/web/test/daemon-endpoints.test.ts` is also a test file, owned by no
   task, and narrowing its corpus to exclude tests would retire a property Q-0126 AC-5 landed and
   Q-0120 round 2's M-4 hardened — a decision, not a repair.
3. **Wait for the production code.** The failure names a `.test.ts` file. No implementation of
   `mission-control-status.tsx` changes what a sibling fixture's line 15 contains.

Stated precisely rather than overstated: `developer-frontend`'s `paths:` is `[apps/*, packages/ui,
packages/i18n]`, so the engine would **not** revert a write to that file — the surface is reachable
by the allow-list and forbidden by the flow's instruction and by every task's own scope. The
practical consequence is the same: no task is asked to clear it, and an implementer that clears it
anyway is violating its instructions.

**Which of the two kinds, and therefore which remedy.** The **first** — the fix lies in a file no
task owns — not the second, which is an assertion true only during the red phase. So it wants an
owner or it wants not to exist; it does not want a fact moved into the integration report.

**What it costs if it ships.** `development.yaml`'s `integrate` runs
`pnpm turbo run test --force --continue` over the whole workspace, so after all ten tasks land
perfectly the suite still exits 1 and `expect: pass` fails. `scope: failing-tasks-only` then maps
the failing test back to a task and finds none, so the backward edge fires up to
`max_iterations: 3` against work that is already complete and reaches an exhaustion gate with a
correct tree and a red tick. Q-0120 priced its development stage at $56.17 + $16.31 and recorded
half its repair done by hand for exactly this class; this review exists to spend one cheap round
instead.

**The remedy is one line, and the discipline is already in the file.** Three lines below the
offender, the same suite writes `['', 'runs', 'h'].join('/')` rather than a path literal, and
`mission-control-model.test.ts` writes `['', 'tmp', 't'].join('/')` for its `ticketDir` — the house
convention the catalog's own **AC-6-src-d** prescribes and the guard's own fixtures use
(`` `const url = ${'`'}ws${':'}//host/x${'`'};` ``). Assembling it — `['wss', '://x'].join('')` —
leaves every rendered sentence byte-identical, because `ConnectionState.requestedUrl` is a plain
`string` that `describeConnection` only interpolates, and the assertion is that the nine sentences
are distinct and non-empty rather than anything about the value. A scheme-free placeholder would do
equally well.

### Everything else is reachable, checked task by task

| failing suite | tests | cleared by |
| --- | --- | --- |
| `src/daemon-client.test.ts` | 2 | **T01** — owns `daemon-client.ts`, implements `fetchRuns` |
| `src/mission-control-model.test.ts` | 6 | **T02** — owns `mission-control-model.ts` |
| `src/run-connection.test.ts` | 2 | **T03** — owns `run-connection.ts`, `RUN_EVENT_RETENTION` |
| `test/routes.test.ts` | 3 | **T04** — owns `routes.ts` (rail row, both route rows, `waitingFor`, `ticket`) and **T09**, whose `app.tsx` must name `RUNS_PATH` and `RUN_ROUTE` |
| `src/runs-screen.test.ts` | 6 | **T05** — owns `runs-screen.tsx` |
| `src/mission-control-trace.test.ts` | 2 | **T06** — owns `mission-control-trace.tsx` |
| `src/mission-control-status.test.ts` | 6 | **T07** — owns `mission-control-status.tsx` |
| `src/mission-control-screen.test.ts` | 3 | **T08** (composition, `STEP_DISPOSITION_TEXT`) and **T09** (dispatch) |
| `test/daemon-endpoints.test.ts` | **1** | **nobody — B-1** |

Two neighbouring hazards were checked and are clear rather than assumed: `development.yaml`
interpolates `role: "developer-{role}"`, so `tasks.yaml`'s `frontend` and `backend` resolve to
`developer-frontend.md` and `developer-backend.md`; and T10's `docs/04-architecture.md` is inside
`developer-backend`'s `paths:`, which includes `docs`. No task is aimed at a surface its role cannot
write.

---

## 2. Coverage — all fourteen criteria have at least one scenario

| AC | scenario | suite that carries it | observed |
| --- | --- | --- | --- |
| **AC-1** one validated read, no poll, explicit refresh | §1 ×2, §4 AC-1a–c | `daemon-client.test.ts`, `runs-screen.test.ts` | red (stub) |
| **AC-2** daemon order, row fields, explicit ticket absence | §4 AC-2a–d | `runs-screen.test.ts` | red (stub) |
| **AC-3** five request states, honest empty with its cause | §4 AC-3a–c | `runs-screen.test.ts` | red (stub) |
| **AC-4** one column per exact `stepId`, interleaved | §2 AC-4a/b, §5 | `mission-control-model.test.ts`, `-trace.test.ts` | red (stub) |
| **AC-5** run-level lane, nothing dropped | §2 AC-5a–c, §5 | `mission-control-model.test.ts`, `-trace.test.ts` | red (stub) |
| **AC-6** verbatim escaped text, vendor badge, nothing derived | §2 vendor, §5 AC-6a–c, §9 AC-6-src-a–d | `-trace.test.ts`, `source.test.ts` | red (stub) + green guard |
| **AC-7** three dispositions, never *running* after terminal | §2 AC-7a–f, §7 | `mission-control-model.test.ts`, `-screen.test.ts` | red (stub) |
| **AC-8** nine states in the main region, never blank | §6 AC-8a–c, §7 | `mission-control-status.test.ts`, `-screen.test.ts` | red (stub) |
| **AC-9** bounded retention, derived not chosen | §3 AC-9a–e | `run-connection.test.ts` | red (assertion) |
| **AC-10** two losses, two counters, two sentences | §3 AC-10 + lexical pin, §6 AC-10a–d | `run-connection.test.ts`, `-status.test.ts` | red |
| **AC-11** five disclosures, no substitute rendered | §6 AC-11a–d | `mission-control-status.test.ts` | red (stub) |
| **AC-12** gate link from `pendingGates`, not from a `gate` event | §6 AC-12a–c | `mission-control-status.test.ts` | red (stub) |
| **AC-13** one connection, re-targeted not leaked | §7 AC-13a–d | `mission-control-screen.test.ts` | 1 red, 2 green pins |
| **AC-14** the write boundary does not move; registers do | §7 AC-14 wiring, §8 AC-14a–h | `-screen.test.ts`, `routes.test.ts` | red (assertion) |

**Assigned check 1: pass.** No criterion is uncovered, and the four the requirement names as not
eligible for trimming each have the discriminating clause its *Test:* paragraph asks for:

- **AC-4**'s interleaving is a genuinely alternating fixture — `[step('b'), step('a'), done('b'),
  done('a')]` — whose expected column order `['b','a']` is not sorted, so a renderer that opened a
  column on every change of id fails it; and the same-id clause (`'undefined'` literal included) is
  §2's second test.
- **AC-5**'s conservation is asserted arithmetically —
  `runActivity.length + Σ columns.events.length === events.length` — beside an exact `runActivity`
  type identity, which is what makes prefix re-attribution fail rather than merely be discouraged.
- **AC-11**'s no-fabrication clause is §6's fourth test, and its header needle covers `—`, `$`,
  `0:00` and `n/a`.
- **AC-14**'s *"the write boundary has not moved"* is §8 AC-14h, and the three `WRITE_RULES`
  anti-vacuity clauses are untouched in the diff and still passing — `'/stop'` still
  `permitted: null`. R-6's named hazard, that this criterion is the one most likely to be met by
  deletion, did not happen.

One AC-9 clause is covered by its *Test:* paragraph and not by a direct assertion — *"per-event
append work is bounded rather than growing with the run's length"*. That paragraph specifies the 500
/ 501st / overflow cases, the order, the exact counter and the unchanged earlier snapshot, all four
of which are present. Per *"An adapter records the version it was verified against"* E-1's rule —
a criterion's *Test:* clause bounds the instrument, and a reviewer may not raise the job — this is
not a gap and is not raised as one.

---

## 3. Red for the right reason — 24 stub throws, 7 assertions, 0 compile errors

| kind | tests | groups | where |
| --- | --- | --- | --- |
| `Error: not implemented`, thrown by a typed stub at its final path | **24** | 12 | `fetchRuns`, `partitionTrace`, `buildStepTimeline`, `RunsScreen`, `MissionControlTrace`, `MissionControlStatus`, `MissionControlScreen` |
| `AssertionError` over real values | **7** | 7 | `routes.test.ts` ×3, `run-connection.test.ts` ×2, `mission-control-screen.test.ts` ×1, `daemon-endpoints.test.ts` ×1 (**B-1**) |

Every stub failure names a line in a **production** file at its shipped path —
`src/mission-control-model.ts:35`, `src/mission-control-status.tsx:20`, `src/runs-screen.tsx:15`,
`src/daemon-client.ts:199`, and so on — which is decision 091's *"A typed stub lives at its final
path"* working: the imports resolve, the types exist, and the failure is behaviour rather than
absence. `RUN_EVENT_RETENTION = 500` resolves too, which is why AC-9 fails on `700` against `500`
rather than on a missing symbol, and `contracts/Q-0015/mission-control.contract.md` is in place.

**Nothing in the log is a collection failure.** Swept for every signature `environmentFailure`
recognises and for the shapes it does not: `Cannot find package` 0, `Cannot find module` 0,
`ERR_MODULE_NOT_FOUND` 0, `SyntaxError` 0, `command not found` 0, `ERR_REQUIRE_ESM` 0,
`does not provide an export` 0, `Transform failed` 0, `Unhandled Error` 0, `Failed to load` 0. All
20 files were collected and all 355 tests ran.

**Assigned check 2: pass on the letter.** The suite fails on assertions and stubs, not on compile
errors — and B-1 is neither of those, which is why it is reported under satisfiability rather than
here.

**Two suites are green by design, and a reader of "9 failed | 11 passed" should not read that as
dropped scenarios.** `source.test.ts` (37 passed) carries AC-6's new twelve-needle scan, which is a
negative property already true of the corpus; its subject is a future regression and its
anti-vacuity half is the fixture pair in §9 AC-6-src-b/c, both present and both passing over
assembled literals. And two of `mission-control-screen.test.ts`'s five tests pass because they are
AC-13's **regression pins** — one controller re-targeted across handles, and the gate route
constructing no socket, which is Q-0016 erratum E-2's ruling. Green is the correct colour for all
three.

---

## 4. Nits

**N-1 — `routes.test.ts`'s derived guard is derived in its subject list and enumerated in its
needle.** SE-2 asked for the three-element array at `:139` to derive from
`SCREEN_ROUTES.filter(screenExists)`, and it now does. The constant *name* it then looks for in
`app.tsx` is a five-branch ternary whose final `else` is `'RUN_ROUTE'`, so a sixth screen route
whose path matches none of the five would be checked against `RUN_ROUTE` — a needle `app.tsx`
already contains for the fifth row, so the clause would pass over a route the app does not select.
The fail-open shape Q-0051 found in `q0050.source.test.ts`. It does not weaken this ticket's
subject: AC-14f holds, and removing `RUNS_PATH` from `app.tsx` does turn it red by name. A register
mapping path → constant name, refusing a path it has no entry for, closes it for the sixth.

**N-2 — AC-14's replacement `waitingFor` is bounded by length rather than by content.** The clause
that was `expect(waitingFor).toMatch(/listing/)` is now
`expect(waitingFor.length).toBeGreaterThan(60)`, which passes over the old sentence and the new one
alike, so on its own it cannot tell a replacement from the text it replaces. The sibling clause —
`.not.toMatch(/No ticket builds this screen yet/)` — is what carries the property, so the pair is
sound and this is about the weaker half only. The catalog specifies it this way in §8 AC-14a, so it
is the instrument the criterion asked for and the nit is on the spelling, not on the job.

---

## 5. Observations

These are true and worth recording, and none is a claim about this change (decision 089).

**O-1 — the red report's result-line roster matches nothing under the only test command this
repository uses, so the artifact a QA gate reads carries 5 of 31 failures and no diagnostics at
all.** `suite-output.ts`'s `RESULT_LINE` anchors at the start of a line, after optional colour, on a
tick, cross, `ok`, `#`, `N)` or `PASS|FAIL|SKIP`. Turbo prefixes every line of a task's output with
`@quorum/web:test: `, so not one line matches, the roster is empty and the report says *"No lines in
the output looked like test results"* over output containing `31 failed | 324 passed`. That defeats
the exact protection `testReport`'s own JSDoc claims — *"the roster is the point and the byte count
is not … on Q-0033 seven of nineteen failing groups had no line in it at all, so the reviewer never
saw them … collected from the **full** output, whatever the body loses"* — because with no roster the
body cut is all there is, and here it hid 19 of the 31 failures, every one of the 24 stub throws, and
B-1. Q-0120 recorded the trim and routed it to **Q-0076**; this adds the mechanism, which is
narrower than the cap and is recorded nowhere. Not fixed here: `packages/core/src/engine/` is
outside this step's surface, and a `RESULT_LINE` that tolerates a prefix is a change to how every
report in this repository is composed.

**O-2 — nothing in this flow gates the `write-tests` instruction that tests must *typecheck* against
the stubs.** `harness/harness.yaml:42` makes `commands.test` `pnpm turbo run test --force
--continue`, so `integrate` runs `test` alone; vitest strips types without checking them, and
`typecheck` and `lint` are separate turbo tasks that no step of `qa-red` or `development` runs. A
type error in a QA-authored fixture would therefore pass every gate on this route and surface in CI.
I make no claim that one exists here — I did not run `tsc`, and the fixtures I read against
`events.ts` (`gate` with `retry` optional, `terminal` with the `completed` member) are consistent
with the schemas.

**O-3 — the per-run event count AC-9's bound was derived rather than measured against is still
unmeasured, and correctly not in this suite.** The catalog flags it, and that is right: it is
AC-14's hand-`POST /runs` demonstration, at implement or review time, against a daemon this suite
does not stand up. Recorded so the figure Appendix A(b) needs is not assumed to have arrived with
the red phase.

---

## 6. What the revise round should change, and what it should leave alone

A `revise` here follows `scenario-review`'s own `on_fail: { goto: scenarios, max_iterations: 1 }`, so
this is one bounded round and then a gate. `write-tests` reuses `harness/Q-0015/tests`, so round 2 is
an edit and not a rewrite, and both steps read this file.

**Required — B-1, one line.** Assemble the socket-scheme literal at
`apps/web/src/mission-control-status.test.ts:15` — `['wss', '://x'].join('')`, or any placeholder
that is not scheme-shaped — so that `apps/web/test/daemon-endpoints.test.ts`'s AC-13 scan is green
and the only red left is red the ten tasks can clear. Do **not** edit the guard, and do not move the
file: its `src` location is what T05–T08's neighbours share and what Q-0014 AC-5's corpus is about.

**Required — the class, not the instance.** Add one clause to catalog §9 stating that a fixture
under `apps/web/src` assembles any literal the shipped scans forbid — the three needles of
`daemon-endpoints.test.ts` (`wss?:`, `127.0.0.1`, `7717`) as well as the twelve of AC-6 — which is
AC-6-src-d's own rule applied to the guards that already existed rather than only to the guard this
ticket adds. Without it the next `src` fixture rediscovers B-1.

**Recommended — N-1.** Replace the ternary that names a route constant with a register that refuses
a path it has no entry for, so the guard is derived in both halves.

**Leave alone.** The catalog is otherwise correct and should be re-emitted unchanged: all fourteen
criteria are covered, the four not-trimmable clauses each carry their discriminator, the flagged
items (SE-3's T10 narrowing, the four gate obligations, AC-9's and AC-14's manual demonstrations,
ground rule 6) are correctly flagged rather than faked into tests, and the `WRITE_RULES` pins are
intact. A round spent rewriting a sound document is the churn this repository has measured three
times; the subject of this `revise` is one line of a fixture and one sentence of §9.
