# Q-0015 — architecture review of `solution/run-2/draft-iter-4.md`

*Review iteration 4, run 2, 2026-09-16. Verdict: **approve** — no blocker, no major, three nits and
three observations. **I would let QA start writing tests today.***

> **Read this first.** Iteration 3's three majors and three nits are **all closed**, each by the
> remedy §7 named and two of them more cleanly than asked. The contracts are concrete, committed,
> and reachable by every downstream phase; every criterion has a task, every task cites a contract,
> no two tasks share a file, and nothing in the fourteen criteria is unsatisfiable.
>
> **What I found instead is in the Verification list, not in the contracts.** `apps/web/test/routes.test.ts`
> holds a four-assertion block about the `/runs` row that T04 turns false, and the document's
> Verification section names only the two count identities. Two of the four are named in AC-14's own
> prose, `routes.test.ts` is qa-red's file, and the adjacent `toStrictEqual` at `:132` forces QA into
> that exact describe block — so this does not block a start. **One of the four fails open rather
> than red, and it is named nowhere**: that is N-2, and it is the one worth landing.
>
> This is the traversal the gate authorised with `retry`. It earned its answer: the tree moved every
> round, and this round moved it to done.

---

## 0. What I verified, so the next reader does not re-derive it

**Every figure below was taken from the tree during this review.** `main` at `007060d`;
`harness/Q-0015/contracts` at **`89cd4d9`**, parent `0b1c965`, parent `d90768f`, parent `f1e21b1`.
`git status --porcelain` in `.harness/worktrees/harness__Q-0015__contracts` is **empty**.

### 0.1 Iteration 3's six requested changes were all made

| # | asked | measured |
| --- | --- | --- |
| M-1 | two anchors for the trace, in the sentence freezing the other five | **closed** — `#routes-and-reads` now ends *"Each trace column is marked with `data-trace-step-id` whose value is its exact `stepId`; the run-activity lane is marked with `data-run-activity`."* The column's carries its `stepId`, which is what AC-4's *"each holding only its own events"* needs to tell two columns apart. T06's description names both anchors by name |
| M-2 | two references on T08 | **closed** — T08's `contracts` list is now seven entries and carries both `apps/web/src/mission-control-text.ts#STEP_DISPOSITION_TEXT` and `contracts/Q-0015/mission-control.contract.md#routes-and-reads`; its description names `STEP_DISPOSITION_TEXT` and `data-step-disposition` explicitly rather than saying *"disposition anchors"* |
| M-3 | replace §Contracts' closing sentence with the mechanism | **closed, verbatim to the remedy** — *"This iteration's contract edits are committed by the engine when the architect step ends; the running step cannot observe its own resulting SHA, and no follow-up commit is owed to the surrounding workflow."* The false imperative to a downstream actor is gone. Confirmed by events: `89cd4d9`'s timestamp is 23:33:24 +0200 and `runs.log` records `2026-09-16T21:33:24.641Z run=2 step=architect` — the same instant |
| N-1 | export the ticket-absence sentence | **closed** — `NO_TICKET_ID_TEXT` is exported at `mission-control-text.ts:8` with a finished value; the contract cites the export rather than quoting the sentence; T05's `contracts` list gains it. The module is still complete and still needs no task |
| N-2 | pin the run number's source | **closed** — *"The run number is read from the terminal event in the socket snapshot, never from a second metadata read."* T07 says *"the terminal-event run number"*. Discriminating and buildable: `MissionControlStatusProps` carries **both** `snapshot` and `metadata`, so a fixture pairing a terminal `runId` with a null `metadata.runId` — and the converse — separates the two readings |
| N-3 | a supersession sentence | **closed** — the draft opens *"This draft supersedes iterations 1–3; its Contracts and Tasks sections are the only versions to use."* `finalize` reads all four drafts and now cannot merge three Tasks blocks |

**§2.4's gate obligation is discharged and I checked where.** `backlog/Q-0015-…/solution/errata.md`
exists and carries **E-1**, the twelve-needle ruling, at the path `qa-red.yaml`'s `scenarios` step
reads — not at `requirements/errata.md`, where no qa-red step would have seen it. The draft says so
in place: *"The ruling is recorded in `solution/errata.md`, which the QA scenario phase reads."*

### 0.2 The contracts are real, complete and committed — including this iteration's

`89cd4d9` is two files, 11 insertions: `mission-control-text.ts` (+3) and
`mission-control.contract.md` (+14/−6). All ten contracts resolve at `HEAD`:

- `contracts/Q-0015/mission-control.contract.md` (5.9 K, five sections)
- `mission-control-model.ts`, `mission-control-text.ts`, `mission-control-trace.tsx`,
  `mission-control-status.tsx`, `mission-control-screen.tsx`, `runs-screen.tsx`
- `daemon-client.ts#fetchRuns`, `routes.ts` (`RUNS_PATH:109`, `RUN_ROUTE:112`, `runPath:125`,
  `gatePath:128`), `run-connection.ts` (`RUN_EVENT_RETENTION = 500` at `:28`,
  `browserDiscardedCount` at `:48`, `:65`, in `snapshotOf` at `:72`, reset at `:205`)

**Nothing is missing and nothing needs committing.**

### 0.3 The stubs are concrete, and I re-checked the ones the new clauses rest on

- `MissionControlStatusProps` carries `handle`, `snapshot`, `metadata`, `onRetryConnection`,
  `onRetryMetadata`, `onNavigate` — and **not** `connectionText` or `retryable`, which is iteration
  2's N-2 still answered in the type. It has everything the new run-number clause needs and
  everything AC-8's two-sentence separation needs.
- `MissionControlTraceProps` is `{ events }` alone — T06 reaches `partitionTrace`, which it cites,
  and can reach nothing else. AC-6's *"never derives"* is a property of the props.
- `StepTimelineItem` carries `doneMessage: string | null` and `runEnded: boolean`, so AC-7's
  *"ended (rendering the `done` message)"* and the post-terminal third disposition both have a
  source in the type rather than in prose.
- `STEP_DISPOSITION_TEXT`'s three keys are exactly `StepDisposition`'s three members, `as const`, so
  T08 cannot render a fourth and cannot invent a sentence.
- `fetchRuns` keeps `void wireRunListSchema;` — the house convention that keeps the schema import
  live through a throwing body.

### 0.4 Collisions I went looking for and did not find

Recorded because establishing a negative cost something, and because each would have been a red test
no development task could green.

- **`WRITE_RULES` does not move and nothing new trips it.** `source.test.ts:200–206` is the six
  needles as AC-14 describes them; `'/stop'` is `permitted: null` at `:206`, the `toBeNull()` clause
  is at `:241`, `writeOffenders(false)` is pinned to the two modules at `:236`. No task touches that
  file. **And the gate link does not trip the `'/gate'` needle**: the needle is a quote immediately
  before `/gate`, while `GATE_ROUTE` is `'/runs/:handle/gate'`, whose `/gate` follows `:handle` — the
  same reason that constant passes today.
- **The AC-6 twelve-needle guard discriminates, re-derived rather than inherited.**
  `backlog-board.test.ts` is the only `role=` under `src`, as `container.querySelector('[role="progressbar"]')`
  — the character before `role=` is `[`, so none of the four `role=` needles matches, while the
  criterion's own named fixture `` `cost=$0.123` `` matches the backtick needle. Neither
  `MISSION_CONTROL_DISCLOSURES[2]` (*"Per-vendor cost and token totals…"*) nor `EMPTY_RUNS_TEXT`
  carries a needle.
- **No register enumerates `apps/web/src` by file name.** Six new modules appear and nothing counts
  them: `routes.test.ts:304` is a `toBeGreaterThan(3)` floor, `source.test.ts:575`'s `TOKENS.length`
  is the colour set, `package.test.ts:230` is the manifest rule, `lint-coverage.test.ts:116` is the
  ignore globs. The `theme.css` task's deletion leaves the token register untouched.
- **The route-literal scan is satisfied by construction.** `routes.test.ts:310` collects path
  literals from every component and requires the register hold them; the new screens navigate through
  `runPath` and `gatePath` and carry none.
- **The timer guard reaches the new files and nothing in the design trips it.** AC-1's mount read
  plus explicit Refresh needs no timer, and so does the metadata read; the fake-timer advance is
  test-side.

---

## 1. Satisfiability — no blocker

Stated plainly because it is the first thing this role checks, and checked at every site this change
touches.

- **No fix lands in a file no task owns.** Against the role grants rather than the architecture table
  alone: `developer-frontend` is `paths: [apps/*, packages/ui, packages/i18n]`, so T01–T09 are
  inside it; `developer-backend` is `[packages/core, packages/shared, packages/server, harness, docs,
  backlog]`, so T10's two documents are inside it. `mission-control-text.ts` is owned by no task and
  needs none — every export is a finished value and nothing in it throws, `NO_TICKET_ID_TEXT`
  included.
- **No assertion is true only during the red phase.** AC-9's retention assertions and AC-14's
  register identities describe shipped behaviour after T03 and T04 and stay true afterwards. The
  inverse shape — an assertion true *now* that T04 makes false — exists in `routes.test.ts` and is
  N-1 below; it is qa-red's file, written before development, so it is a completeness question rather
  than a satisfiability one.
- **`prove-red` can fail on assertions rather than on missing symbols.** All six new modules are
  typed stubs at their final paths whose bodies throw; every name a red test imports resolves and
  typechecks. A throwing component fails at render, which Q-0120 measured as the expected red shape.
- **`merge-contracts` puts the contracts where the later phases need them.** `solutioning.yaml`'s
  last step merges `harness/Q-0015/contracts` into `harness/Q-0015/integration`, and `qa-red`'s
  `write-tests` and every `development` task declare `base: harness/{id}/integration`.
- **The fan-out branch names are valid refs.** `T01`–`T10` carry no separator, so Q-0055's
  colon-in-a-refname defect is not reachable.
- **The single-vendor fan-out is correct and correctly declared.** `development.yaml` carries no
  `cross_vendor:` key, so nine `frontend` tasks trip no lint, and the rejected alternative argues it
  from the role grant rather than from preference — which is what `harness/architecture.md` asks of
  an undividable ticket. T10 is presented as documentation and not as a second-vendor implementation.

---

## 2. Coverage — every criterion has a task, every task has a contract

Checked one at a time against the tree.

| AC | tasks | contract reached | |
| --- | --- | --- | --- |
| 1 landing reads once, never polls | T01, T05 | `daemon-client.ts#fetchRuns`, `#routes-and-reads` | ✓ |
| 2 row order, fields, explicit null ticket | T05 | `#routes-and-reads`, `#NO_TICKET_ID_TEXT` | ✓ **closed by N-1** |
| 3 five request states, honest empty | T05 | `#EMPTY_RUNS_TEXT`, `#routes-and-reads` | ✓ strong |
| 4 one column per `stepId`, interleaved | T02, T06 | `mission-control-model.ts`, `#trace-and-timeline`, `data-trace-step-id` | ✓ **closed by M-1** |
| 5 run-level lane, conservation | T02, T06 | `#trace-and-timeline`, `data-run-activity` | ✓ **closed by M-1** |
| 6 what a column renders / never derives | T02, T06, qa-red | `#trace-and-timeline`, twelve needles, `solution/errata.md` E-1 | ✓ |
| 7 three dispositions | T02, T08 | `StepDisposition`, `#STEP_DISPOSITION_TEXT`, `#routes-and-reads` | ✓ **closed by M-2** |
| 8 every non-streaming state, main region | T07 | `#retention-and-disclosure`, `data-mission-control-state` | ✓ strong |
| 9 bounded tail, exact counter, immutability | T03 | `run-connection.ts#RUN_EVENT_RETENTION` | ✓ strong |
| 10 two counters, two sentences | T03, T07 | both sentences frozen, lexical property defined | ✓ strong |
| 11 five things it cannot show | T07 | five sentences frozen, `data-mission-control-header`, `data-run-identity`, terminal-event clause | ✓ **closed by N-2** |
| 12 gate link from `pendingGates` | T04, T07 | `#routes-and-reads`, `routes.ts#gatePath` | ✓ strong |
| 13 one connection, re-targeted | T09 | `#connection-lifetime` | ✓ |
| 14 boundary unmoved; registers and docs move | T04, T09, T10, qa-red | `#write-boundary` | ✓, see N-1 |

**No two tasks share an owned file**, verified across all ten: `daemon-client.ts`,
`mission-control-model.ts`, `run-connection.ts`, `routes.ts`, `runs-screen.tsx`,
`mission-control-trace.tsx`, `mission-control-status.tsx`, `mission-control-screen.tsx`, `app.tsx`,
and the two documents. All ten declare `depends_on: []` and form one wave, which works because every
symbol crossing a seam is committed already.

**The five strongest contracts, named so a later round does not weaken them.** AC-5's conservation
clause is checkable rather than asserted because `eventSchema` makes `stepId` required on five
members and absent from four. `StepDisposition`'s third member puts AC-7's *"never calls a failed
step running"* in the **type**. AC-12's *"never by observing a gate event"* is right for the late
joiner the daemon's 500-event retention exists to serve. Removing `connectionText`/`retryable` from
`MissionControlStatusProps` makes AC-8's nine assertions structurally unable to pass over a screen
that echoes a string. And `data-trace-step-id` carrying the exact `stepId` is what makes AC-4's
interleaving clause a DOM assertion rather than a hope — the clause the requirement calls this
ticket's most load-bearing, and the first consumer in this product's history of the ids Q-0050 round
6 fixed.

---

## 3. Nits

**N-1 — four assertions about the `/runs` row go false or stop covering when T04 lands, and the
Verification list names two of them.** `apps/web/test/routes.test.ts` is qa-red's, correctly, and the
document's *Verification* closes with *"Route-register counts move from one to two rail screens and
three to five route screens"* — which is `:100`, `:104` and `:132` and nothing else. Measured, T04
also reaches:

- `:232` — `expect(waitingFor).toMatch(/No ticket builds this screen yet/)`, false the moment
  `waitingFor` is replaced;
- `:233` — `expect(ticket, 'a ticket was claimed for a screen no ticket builds').toBeNull()`, false
  the moment the row carries `ticket: 'Q-0015'`;
- `:241` — `expect(waitingFor).toMatch(/listing/)`, a **constraint on the replacement wording** that
  appears in neither T04's description nor the contract, so a sentence describing the built screen
  without the word *listing* is red in a file no development task may touch;
- `:139` — the app.tsx binding loop, see N-2.

The first two are named in AC-14's own prose (*"its `waitingFor` **replaced rather than emptied**"*,
*"`ticket: 'Q-0015'`"*), `scenarios` reads `merged.md`, and `write-tests` has the repo — so QA has
both the authority and the sight of them, and the adjacent `:132` identity forces the edit into the
same describe block. **The remedy is three bullets in *Verification***, naming `routes.test.ts`'s
`/runs` block — `:232`, `:233`, `:241` — as assertions qa-red rewrites rather than keeps, and saying
that the replacement sentence is what `:241` is then written against. No criterion moves, no contract
moves, no task is re-cut.

**N-2 — `routes.test.ts:139` fails open when this ticket adds two screen rows, and nothing names
it.** That loop is a hard-coded three-element array:

```ts
for (const [name, route] of [['BOARD_PATH', BOARD_PATH], ['TICKET_ROUTE', TICKET_ROUTE], ['GATE_ROUTE', GATE_ROUTE]] as const) {
```

Its own comment states the property it holds: *"every row claiming a screen is one `app.tsx` selects
by the register's own constant"*. `:132` is an identity and **goes red** at five rows, so QA is
forced to fix it; `:139` is a literal list and **stays green** at three, so the property silently
stops covering `RUNS_PATH` and `RUN_ROUTE` — the two rows this ticket adds. A guard that reports
success over a subject it has stopped examining is the class `harness/architecture.md` lists first,
and the shipped state would be a guard covering three of five. T09's description already requires the
production half (*"select both screens by route-register constants"*); what is missing is the
assertion. **The remedy is one bullet**: the loop is derived from the rows claiming a screen, or
gains the two entries, and is shown red with a constant removed from `app.tsx`.

**N-3 — the twelve-needle rule reaches an implementer through the repo and not through the errata,
and the document does not say so.** The development fan-out reads `solution/solution.md` and
`review/verdict.md` and **no errata at all**; E-1 lives in `solution/errata.md`, which qa-red reads
and an implementer does not. It works because the rule is also in
`contracts/Q-0015/mission-control.contract.md`, which is on `harness/Q-0015/integration` after
`merge-contracts` — but the draft's *Required AC-6 erratum* section cites only the errata path. One
clause naming the contract as the implementer's copy removes the question for whoever reads T06's
*"parse no message"* and goes looking for the rule behind it.

---

## 4. Observations

*True and worth recording; none is a claim about this change.*

**observation:** This step cannot see the artifacts it reviews, for the fourth consecutive iteration.
`solutioning.yaml` gives `architect` `worktree: true` on `harness/{id}/contracts`;
`architecture-review` carries `input.repo: true` and no worktree, so it reads the main checkout,
where `contracts/Q-0015/` does not exist and neither do the six stubs. Every contract in this review
was read by naming the branch explicitly at
`.harness/worktrees/harness__Q-0015__contracts`. A reviewer that did not would report the contracts
absent — a failed probe read as a proven negative, filed against a solution rather than against the
flow. The cheap fix is giving this step the same `branch:` the architect writes, which is a flow
change and somebody else's; it is adjacent to **Q-0132**, opened at this run's own exhaustion gate.

**observation:** `apps/web/src/run-connection.ts:143–150` still names Q-0121 wrongly — *"Q-0015
renders mission control from this same snapshot while Q-0121 will hold several controllers at once"*.
Q-0121 shipped as the daemon's run listing, a server-side enumeration that holds no browser
controller and creates none. T03 is correctly told to fix it in a file it already owns; recorded here
because iteration 4 dropped Appendix B, which is where that correction was written down, and the
instruction now survives only inside one task description.

**observation:** the same comment routes the cap question to *"AC-19"*, and this ticket's requirement
has fourteen criteria ending at AC-14 — the bound landed as **AC-9**. A forecast written against a
criterion numbering that did not survive the requirements run. T03 opens that file and is already
correcting the sentence beside it; nothing turns on it either way.

**observation:** `routes.ts:137`'s rail entry and the `/runs` route row both carry the literal
`'/runs'` today while `RUNS_PATH` is exported at `:109`, and `daemon-endpoints.ts:3` carries a third
`'/runs'` for the daemon route. T04 closes the first two. The third is deliberate and stays — two
registers carrying one string for two different questions, the shape `ticketPath`/`ticketDetailPath`
and `gatePath`/`runGatePath` already have, and `daemon-endpoints.ts` argues for it in place.

---

## 5. What the gate may fold in, and what it need not

**Nothing is owed before QA starts.** All three nits are edits to the document's *Verification* and
*Required AC-6 erratum* sections; none touches a contract, a criterion, a task's ownership or
`apps/web`. If the gate wants them landed, they are:

1. **Three bullets** naming `routes.test.ts:232`, `:233` and `:241` as qa-red's to rewrite, with
   `:241` written against the replacement sentence (N-1).
2. **One bullet** requiring `:139`'s binding loop to be derived from the rows claiming a screen, or
   extended to five, and shown red with a constant removed from `app.tsx` (N-2).
3. **One clause** saying the twelve-needle rule reaches an implementer through
   `contracts/Q-0015/mission-control.contract.md` on the integration branch, the errata being
   qa-red's channel alone (N-3).

**The measurement worth carrying to the close.** Four architect iterations cost $6.48, $6.83, $9.55
and this review; across them the findings went 5 majors + 4 nits → 3 majors + 3 nits → 0 majors + 3
nits, every round fixing the previous round's and every round changing the tree. That is a loop
converging, which is what distinguishes this from the three recorded cases where *a retry on an
unchanged tree cannot rule its own blocker* — the gate's `retry` bought a round that closed six
findings for the price of one, and iteration 4's commit is eleven insertions.
