# Q-0015 — architecture review of `solution/run-2/draft-iter-3.md`

*Review iteration 3, run 2, 2026-09-16. Verdict: **revise** — **no blocker**, three majors, three
nits. All three majors are one-line edits to one sentence of the contract and one task's `contracts`
list. No design decision moves, no criterion moves, and nothing in `apps/web` is re-cut.*

> **Read this first.** Iteration 2's five majors and four nits are **all closed**, and two of them
> were closed better than the remedy asked for. What I found instead is narrower and is a consequence
> of the remedy for M-1: **splitting the screen into three modules moved the trace and the timeline
> into new tasks and left the copy citation and the `data-*` anchors behind in the status module.**
> So the two criteria the requirement names as *not eligible for trimming* — AC-4 and AC-5, the
> columns and the lane — are now the two regions on this screen with **no frozen selector at all**,
> and the task that renders the timeline cites neither the module holding its labels nor the section
> holding its anchor. That is iteration 2's M-2 at the three sites the split created.
>
> **The loop is exhausted, so this verdict reaches a gate**, and the gate is the right venue: the
> AC-6 erratum this document asks for is owed there anyway, all three majors are edits a human can
> land in the same sitting, and §7 says exactly what to write. **Once those three are in, I would let
> QA start.**

---

## 0. What I verified, so the next reader does not re-derive it

**Every figure below was taken from the tree during this review.** `main` at `61de8ff`;
`harness/Q-0015/contracts` at `0b1c965`, parent `d90768f`, parent `f1e21b1`.

### 0.1 Iteration 2's six requested changes were all made, and two exceed what was asked

| # | asked | measured |
| --- | --- | --- |
| 1 | split the screen by region; delete the copy task | **done** — `mission-control-trace.tsx` and `mission-control-status.tsx` exist at `0b1c965`; ten tasks, T06 trace, T07 status, T08 composition + timeline. `mission-control-text.ts` has no task, correctly |
| 2 | freeze anchors for the header and run-identity regions | **done** — the contract now names `data-mission-control-header` and `data-run-identity` |
| 3 | resolve the `theme.css` task | **done, and better than the remedy** — the task is deleted and the rejection is argued from `theme.css`'s own header (tokens, not layout), with layout owned as utility classes by the component that renders it |
| 4 | twelve needles, not nine | **done** — contract and erratum bullet both say four delimiters × three prefixes. Verified the discrimination by hand: `'[role="progressbar"]'` matches none of the twelve (the quote sits on the far side of the `=`), and the criterion's own named fixture `` `cost=$0.123` `` now matches the backtick needle, which it did not last round |
| 5 | correct §Contracts to name the commit | **half done** — the iteration-2 sentence is corrected to `d90768f`, and the identical false claim is re-made for iteration 3. **M-3** |
| 6 | fold the four nits | **done** — N-1 answered by a documentation paragraph added to the contract's *Write boundary*; N-2 answered **structurally rather than in prose**, `connectionText` and `retryable` removed from the props so the status module *must* derive from `snapshot.state`; N-3 recorded; N-4 partly, see N-3 below |

N-2's answer is the strongest single edit in this round. Removing the two props means AC-8's nine
assertions can vary one input and cannot be satisfied by a screen echoing a string, which is what the
nit was for — and it needed no contract prose, because the type refuses the inconsistent pair.

### 0.2 The contracts are real, complete and committed — including iteration 3's

Measured in the worktree at `.harness/worktrees/harness__Q-0015__contracts`:

- `git status --porcelain` is **empty**.
- `0b1c965` — *"architect: Revised the Q-0015 solution to close every iteration-2 revie [Q-0015]"* —
  four files, 48 insertions: `mission-control-status.tsx` (+21), `mission-control-trace.tsx` (+13),
  `mission-control-screen.tsx` (−2 props), `mission-control.contract.md` (+19/−6).
- All nine code contracts and the prose contract resolve at `HEAD`.

**Nothing is missing and nothing needs committing.** See M-3.

### 0.3 The stubs are concrete, and I checked the ones a red test compiles against

- `Event` is the **run** event union (`events.ts:241`), not the adapter one. `stepId` is
  `z.string()` — **required, never optional** — on `spawn`/`stdout`/`retry` via `.extend`, and native
  on `step` (`:148`) and `done` (`:155`). Four members have no such field: `info`, `warn`, `gate`,
  `terminal`. So AC-5's four kinds are exactly right, `partitionTrace` discriminates on the union
  rather than on `!== undefined`, and AC-4's literal `"undefined"` clause is a string key like any
  other.
- `spawn` carries `vendor` (`:105`) **and so does `retry`** (`:123`) — the contract's *latest
  observed on `spawn` or `retry`* is buildable, and codex's correction of claude's `spawn`-only rule
  holds.
- `stdout` carries `line`; `step` and `done` carry `message`; `runTerminalStatusSchema` carries
  `runId: z.number()` (`:202`), required — so AC-11's *"the number renders once a `terminal` carries
  it"* has a source, and AC-9's head eviction can never evict it, the terminal being last.
- `WireRun` carries `handle`, `flow`, `ticketId: string | null`, `runId: number | null`, `state`,
  `pendingGates`, `gates`, `refusal`. AC-2's five rendered fields and AC-12's `pendingGates` are all
  there, and `wireRunListSchema` is on the shared barrel with no browser consumer.
- `connectionStateText(state)` (`connection-state.ts:97`) and `canRetry(state)` (`:121`) exist and
  are pure, which is what makes N-2's structural answer work.
- `RUN_EVENT_RETENTION` and `browserDiscardedCount` are in `run-connection.ts` at the contract
  commit, the counter reset alongside `events` and `missedCount` in `connect` — so T03's reset clause
  is a two-line completion of a shape already declared rather than a new one.

### 0.4 Three collisions I went looking for and did not find

Recorded because establishing a negative cost something, and because each would have been a red test
no development task could green.

- **The timer guard reaches the new files and nothing in the design trips it.**
  `source.test.ts:244` forbids `setInterval(`, `setTimeout(` and `requestIdleCallback(` in **every**
  file under `src`. AC-1's mount-read-plus-explicit-Refresh needs none, and neither does the
  metadata read. AC-1's *"advance fake timers and assert no second [fetch]"* is a test-side fake, not
  a source-side timer.
- **`screenExists` is read by no source file.** Grepped across `apps/web/src`: the field occurs in
  `routes.ts` and nowhere else; its only reader is `apps/web/test/routes.test.ts`. So AC-14's three
  flips are a pure register change owned by T04, `views.tsx` needs no task, and no component
  behaviour follows from them. That confirms iteration 2's finding by a different route.
- **`routes.test.ts:138–144` binds T09 and T04 together, and the solution already satisfies it.**
  That test reads `app.tsx` and requires the **constant's name** to appear for every row claiming a
  screen, plus a refusal of any quoted `/backlog` literal. T09's description says *"select both
  screens by route-register constants"*, and `DAEMON_ENDPOINTS.runs` — the other `'/runs'` literal in
  this app — lives in `daemon-endpoints.ts`, not `app.tsx`. No collision.

---

## 1. Blocker — none

Stated plainly because it is the first thing this role checks.

- **No fix lands in a file no task owns.** Checked file by file across T01–T10, and against the role
  grants rather than against the architecture table alone: `developer-frontend`'s frontmatter is
  `paths: [apps/*, packages/ui, packages/i18n]` and its prose repeats it, so T01–T09 are inside it;
  `developer-backend`'s is `[packages/core, packages/shared, packages/server, harness, docs,
  backlog]`, so T10's two documents are inside it. `automation-qa` and `principal-architect` declare
  no `paths` at all, so the six test files the solution assigns to `qa-red` are reachable.
  `mission-control-text.ts` is owned by no task and needs none: every export in it is a finished
  value and nothing in it throws.
- **No assertion is true only during the red phase.** AC-14's register counts are rewritten to the
  post-change values (`RAIL` 1→2, `SCREEN_ROUTES` 3→5, verified as `toStrictEqual(['backlog'])` at
  `:100` and a three-path identity at `:131`) and stay true afterwards; AC-9's retention assertions
  describe shipped behaviour after T03.
- **The write boundary genuinely does not move.** `WRITE_RULES` at `source.test.ts:200–206` matches
  AC-14's description needle for needle; `'/stop'` is `permitted: null` at `:206` and its
  `toBeNull()` clause is at `:241`; no task touches that file, and the solution's *File ownership and
  QA boundary* tells QA to leave every assertion intact.
- **The single-vendor fan-out is correct and correctly declared.** `development.yaml` carries **no**
  `cross_vendor:` key, so nine `frontend` tasks trip no lint; `harness/architecture.md` asks that an
  undividable ticket *"say so in the solution rather than default to `backend`"*, and the rejected
  alternative does exactly that, with the role grant as the reason rather than a preference. T10 is
  correctly presented as a documentation task and not as a second-vendor implementation.
- **The AC-6 erratum is requested through the right channel and is greenable at the gate.** See
  §2.4, which is about *where it has to live*, not about whether it is owed.

---

## 2. Majors

### M-1 — the two regions this ticket exists to build are the two with no frozen anchor

The contract freezes six selectors and **not one of them names a trace column or the run-activity
lane**:

> Mission control marks its main state region with `data-mission-control-state`, its disclosures with
> `data-mission-control-disclosures`, and each timeline row with `data-step-disposition`. Its
> complete header region is `data-mission-control-header`, and the nested handle-or-run-number region
> is `data-run-identity`. The runs landing marks its request state with the existing
> `data-request-state` idiom.

AC-4's *Test:* clause is a DOM assertion and says so — *"drive the app with a fake socket … Assert
**two independently labelled columns**, each holding only its own events, order preserved"*, and a
second clause requiring that a same-id fixture render **one** column. AC-5's is *"assert all four in
the lane; assert the prefixed one is **in the lane** and not in that step's column"*. Neither can be
written without a selector for a column and a selector for the lane, and T06 is told to render both
with *"local utility classes"* — class names it invents, in a file whose contract names none.

**This is iteration 2's M-2 at the site the remedy for M-1 created.** Last round the unanchored
regions were the header and run identity; they were anchored, the screen was split, and the trace
moved into a module of its own with no anchor sentence following it. The requirement calls AC-4 and
AC-5 *"not eligible for trimming"* and calls AC-4's interleaving clause *"this ticket's most
load-bearing"*, so the two criteria with no selector are the two that matter most.

It is a major and not a blocker for the reason last round's was: T06's worktree is cut from
`harness/Q-0015/integration`, which carries the test branch after `prove-red`, and
`development.yaml` gives it `repo: true` — so T06 can read the red test and emit whatever anchor it
targets. The cost is that the loop then goes red for a selector rather than for behaviour, which is
what the house `data-*` idiom exists to avoid. That idiom is well established here: `gate-screen.tsx`
carries five (`data-gate-kind`, `data-answer`, `data-answer-state`, `data-refusal`,
`data-gate-subject`), and the board and the ticket page carry `data-request-state`.

**The remedy is two names in the sentence that already freezes the other five** — one for a column,
one for the lane — and a word saying the column's carries its `stepId`, since AC-4's *"each holding
only its own events"* needs the columns told apart and the handle-to-column mapping is what tells
them apart.

### M-2 — T08 renders the timeline and cites neither its labels nor its anchor

T08's `contracts` are `mission-control-screen.tsx`, `mission-control-trace.tsx#MissionControlTrace`,
`mission-control-status.tsx#MissionControlStatus`, `mission-control-model.ts#buildStepTimeline` and
`contracts/Q-0015/mission-control.contract.md#trace-and-timeline`. Its description says *"render the
observed-only timeline with its disposition anchors"* and *"Do not … edit … copy"*.

Two things AC-7's *Test:* clause targets are outside every one of those references:

1. **The rendered labels.** `#trace-and-timeline` freezes the three **identifiers** — `started`,
   `ended`, `started-with-no-end-reported` — and says nothing about the sentences. The sentences are
   `STEP_DISPOSITION_TEXT` in `mission-control-text.ts`, and the rule binding a renderer to them
   (*"Renderers and tests import those exports rather than restating their wording"*) is in
   **`#routes-and-reads`**, which T08 does not cite. T07 cites the whole copy module; T05 cites
   `#EMPTY_RUNS_TEXT`. **T08 cites neither**, so an implementer reading T08 and following its
   citations finds three identifiers and invents three sentences, while QA imports the frozen ones.
2. **The anchor.** `data-step-disposition` is frozen in that same `#routes-and-reads` sentence. T08's
   description names *"disposition anchors"* without naming the anchor, and its cited section does
   not carry it.

The split is what did this: before it, T07 rendered the timeline **and** cited the copy module. The
timeline moved to T08 and the citation stayed.

**The remedy is two entries in T08's `contracts` list** —
`apps/web/src/mission-control-text.ts#STEP_DISPOSITION_TEXT` and
`contracts/Q-0015/mission-control.contract.md#routes-and-reads`. No prose moves.

### M-3 — the document says its iteration-3 contracts are uncommitted. They are committed at `0b1c965`

§Contracts closes:

> The initial contracts were committed on `harness/Q-0015/contracts` at `f1e21b1`; the iteration-2
> revisions are committed at `d90768f`. The iteration-3 contract split and prose corrections are
> present in this worktree. A commit was attempted, but the sandbox denied creation of the parent
> repository's worktree `index.lock`; **they must be committed by the surrounding workflow before
> fan-out.**

Measured: `0b1c965`, *"architect: Revised the Q-0015 solution to close every iteration-2 revie
[Q-0015]"*, parent `d90768f`, four files, 48 insertions; `git status --porcelain` in that worktree is
empty; `mission-control-trace.tsx` and `mission-control-status.tsx` both resolve at `HEAD`.

**This is iteration 2's M-5, unchanged, for the third artifact in a row** — the instance was
corrected and the class was not, which is the failure `harness/architecture.md` lists fourth among
this repository's recurring mistakes. It has grown a new half: the sentence now issues a **false
imperative** to a downstream actor. There is nothing to commit, so *"committed by the surrounding
workflow before fan-out"* is either a no-op somebody spends time on or, worse, a QA agent's licence
to re-create the contracts it was told may not have landed — which is the second definition
`harness/architecture.md` forbids in as many words (*"Never write the stub twice"*).

**The mechanism is knowable and is the right thing to write down.** `0b1c965`'s commit timestamp is
23:13:22 +0200 and `runs.log` records `2026-09-16T21:13:22.861Z run=2 step=architect … ms=163507` —
the same instant. The engine commits the architect's worktree *at the end of the step*, so an
architect can never observe its own commit and an `index.lock` refusal from inside the step is the
expected state rather than a failure. **The remedy is to say that**, rather than to assert a failure
that did not happen: *"iterations 1 and 2 are committed at `f1e21b1` and `d90768f`; this iteration's
are committed by the engine when this step ends, which is why no SHA is named here."* That sentence
survives the next round.

---

## 3. Coverage — every criterion has a task, every task has a contract, two citations are thin

Checked one at a time against the tree.

| AC | tasks | contract reached | |
| --- | --- | --- | --- |
| 1 landing reads once, never polls | T01, T05 | `daemon-client.ts#fetchRuns`, `#routes-and-reads` | ✓ |
| 2 row order, fields, explicit null ticket | T05 | `#routes-and-reads` — sentence frozen in prose only | ✓, see N-1 |
| 3 five request states, honest empty | T05 | `EMPTY_RUNS_TEXT`, `#routes-and-reads` | ✓ strong |
| 4 one column per `stepId`, interleaved | T02, T06 | `mission-control-model.ts`, `#trace-and-timeline` | ⚠ **M-1** (DOM half unanchored) |
| 5 run-level lane, conservation | T02, T06 | `#trace-and-timeline` | ⚠ **M-1** (lane unanchored) |
| 6 what a column renders / never derives | T02, T06, qa-red | `#trace-and-timeline`, twelve needles | ✓, see §2.4 |
| 7 three dispositions | T02, T08 | `StepDisposition`, `#trace-and-timeline` | ⚠ **M-2** (labels and anchor uncited) |
| 8 every non-streaming state, main region | T07 | `#retention-and-disclosure`, `data-mission-control-state` | ✓ strong |
| 9 bounded tail, exact counter, immutability | T03 | `run-connection.ts#RUN_EVENT_RETENTION` | ✓ strong |
| 10 two counters, two sentences | T03, T07 | both sentences frozen, lexical property defined | ✓ strong |
| 11 five things it cannot show | T07 | five sentences frozen, `data-mission-control-header`, `data-run-identity` | ✓ |
| 12 gate link from `pendingGates` | T04, T07 | `#routes-and-reads`, `routes.ts#gatePath` | ✓ strong |
| 13 one connection, re-targeted | T09 | `#connection-lifetime` | ✓ |
| 14 boundary unmoved; registers and docs move | T04, T09, T10, qa-red | `#write-boundary`, now with the documentation paragraph | ✓ |

**No two tasks share an owned file**, verified across all ten: `daemon-client.ts`,
`mission-control-model.ts`, `run-connection.ts`, `routes.ts`, `runs-screen.tsx`,
`mission-control-trace.tsx`, `mission-control-status.tsx`, `mission-control-screen.tsx`, `app.tsx`,
and the two documents. All ten declare `depends_on: []` and form one wave, which works because every
symbol crossing a seam is committed already — T09 imports `RUNS_PATH` while T04 owns `routes.ts`, T06
imports `TracePartition` while T02 owns the model, T08 imports both child components while T06 and
T07 own them.

**The four strongest contracts, named so a later round does not weaken them.** AC-5's conservation
clause — *"every input event occurs exactly once in either the run-activity lane or one step
column"* — is checkable rather than asserted precisely because `eventSchema` makes `stepId` required
on five members and absent from four. `StepDisposition`'s third member puts AC-7's *"never calls a
failed step running"* in the **type**, where no round can collapse it into a neighbour without a
compile error. AC-12's *"never by observing a gate event"* is right for the late joiner the daemon's
500-event retention exists to serve. And removing `connectionText`/`retryable` from
`MissionControlStatusProps` makes AC-8's nine assertions structurally unable to pass over a screen
that merely echoes a string.

### 2.4 — where the AC-6 erratum has to live, which the document does not say

The erratum is correctly owed and correctly argued: `apps/web/src/backlog-board.test.ts:530` is the
**only** occurrence of `role=` anywhere under `apps/web/src` — `container.querySelector('[role="progressbar"]')`,
in a live assertion — and `cost=` and `verdict=` are clean. I re-ran all three greps. A bare-`role=`
scan is red on arrival against a shipped assertion no development task owns.

**What the document does not say is where the ruling must be written, and the flow makes that
decisive.** `qa-red.yaml`'s `scenarios` step reads
`[requirements/merged.md, solution/solution.md, solution/errata.md, solution/tasks.yaml, …]` and
carries **no `repo: true`** — so it cannot see `contracts/Q-0015/mission-control.contract.md` and
will write its AC-6 scenario from `merged.md`'s literal wording. `write-tests` reads
`solution/errata.md` and the repo, so it could recover; but a scenario the review step then checks
for coverage would already name the impossible clause.

`backlog/Q-0015-…/solution/` **does not exist today** — only `requirements/errata.md` does. So the
gate obligation is precise: **write the ruling to `backlog/Q-0015-…/solution/errata.md` before the
qa-red run starts.** Naming `requirements/errata.md` instead would put it where no qa-red step reads
it. Worth one sentence in §"Required AC-6 erratum", because the document currently says only
*"the gate must ratify this"*.

Recorded and not a finding against the solution: the development fan-out reads
`solution/solution.md` and `review/verdict.md` and **no errata at all**, so anything an implementer
must know has to be in `solution.md` or in the repo. The twelve-needle rule is in the contract file,
which is on `harness/Q-0015/integration` after `merge-contracts`, so it reaches an implementer
either way.

---

## 4. Satisfiability — the rest of the sweep

Beyond §1, the two shapes the role brief names, checked at every site this change touches:

- **`prove-red` can fail on assertions rather than on missing symbols.** All five new modules are
  typed stubs at their final paths whose bodies throw; every name a red test imports resolves and
  typechecks. `fetchRuns`'s `void wireRunListSchema;` keeps the schema import live, which is the
  house convention. A throwing component fails at render, which Q-0120 already measured as the
  expected red shape (*"19 of its failures coming from stubs rather than missing symbols"*).
- **`merge-contracts` puts the contracts where the later phases need them.** `solutioning.yaml`'s
  last step merges `harness/Q-0015/contracts` into `harness/Q-0015/integration`; `qa-red`'s
  `write-tests` and every `development` task declare `base: harness/{id}/integration`. So the stubs
  reach QA and the implementers without anyone copying them.
- **The fan-out branch names are valid refs.** `development.yaml` templates
  `branch: "harness/{id}/{task.id}"` and `id: "dev:{task.id}"`; `T01`–`T10` carry no separator, so
  Q-0055's colon-in-a-refname defect is not reachable.
- **`app.tsx` already holds AC-13 and T09's change is contained.** `:103–105` computes the handle
  from any route carrying `:handle` with `GATE_ROUTE` excluded by name, `:113–129` owns one
  controller keyed on `handle !== undefined`, and `:131–143` re-targets. `RUN_ROUTE` carries
  `:handle`, so mission control already gets the connection; what T09 adds is two register-constant
  branches in the render and the `snapshot ?? IDLE_SNAPSHOT` pass-down. `IDLE_SNAPSHOT` was already
  widened with `browserDiscardedCount` at `f1e21b1`.
- **The new files pass every existing corpus clause.** `mission-control-model.ts` imports
  `type { Event }` from `@quorum/shared`; the three `.tsx` files import `type { ReactNode }` from
  `react` and app-local types; `mission-control-text.ts` imports nothing. None trips the
  Node-builtin, engine-import, colour, absolute-URL, font-host or timer clauses, and `.tsx` has been
  in ESLint's scope since Q-0014 AC-4.
- **`EMPTY_RUNS_TEXT` is still safe against the product-name scan**, re-verified rather than
  inherited: `FORBIDDEN_NAMES` at `source.test.ts:522–529` is five entries and none is *quorum*.
  `MISSION_CONTROL_DISCLOSURES[2]` is still safe against the cost/token scan, which is keyed on five
  field identifiers and the phrase *cost to date*.

---

## 5. Nits

**N-1 — the ticket-absence sentence is frozen in prose while every other sentence is frozen in
code.** The contract freezes `The daemon supplied no ticket id for this run.` in `#routes-and-reads`,
and `mission-control-text.ts` does not export it — its own sentence enumerates *"the empty-list
sentence, timeline labels, loss sentences and five absent-capability sentences"* and stops. AC-2's
*Test:* clause is *"a null-`ticketId` row asserts the explicit sentence"*, so T05 transcribes it and
qa-red transcribes it independently, and a capital `ID` in either is a red round for a transcription
rather than for behaviour. That is the exact cost the copy module was created to remove, at the one
sentence left outside it, and it contradicts the document's own approach clause 4. One export, no new
task — the module stays complete, so it still needs no implementer.

**N-2 — AC-11's run-number clause has two possible sources and the contract names neither.** The
number can come from the terminal event in `snapshot.events` or from `metadata.runId`, which stops
being `null` once the run ends. `#retention-and-disclosure` says *"a terminal-provided run number"*,
which points at the stream, and the requirement's §0.6 says the same in as many words — so it is
determinate enough to build. It is not determinate enough for a fixture: QA supplying a terminal
event while T07 reads `metadata` goes red for the reason M-2 is about. One clause —
*"read from the terminal event on the snapshot, never from a second read"* — settles it, and the
eviction bound cannot reach it, the terminal event being last.

**N-3 — `finalize` is handed three drafts with three different Tasks blocks.**
`solutioning.yaml`'s `finalize` reads `solution/run-{run}/draft-iter-*.md` — all three — under the
instruction *"Keep the Contracts and Tasks sections verbatim unless the review changed them"*.
Iteration 1 had nine tasks with `Q0015-T` ids and a `theme.css` task; iteration 2 had ten with a copy
task; iteration 3 has ten with neither. Iteration 2's N-4 asked for an explicit sentence and the
draft does not carry one. One line at the top — *"this draft supersedes iterations 1 and 2; its
Contracts and Tasks sections are the only ones"* — removes the ambiguity, and it matters because
`tasks` then reads `solution.md` alone and a merged Tasks block would fan out work nobody scoped.

---

## 6. Observations

*True and worth recording; none is a claim about this change.*

**observation:** This step cannot see the artifacts it reviews, for the third consecutive iteration.
`solutioning.yaml` gives `architect` `worktree: true` on `harness/{id}/contracts`;
`architecture-review` carries `input.repo: true` and no worktree, so it reads the main checkout,
where `contracts/Q-0015/` does not exist. Every contract in this review was read by naming the branch
explicitly. A reviewer that did not would report the contracts absent — a failed probe read as a
proven negative, filed against a solution rather than against the flow. The cheap fix is giving this
step the same `branch:` the architect writes, which is a flow change and somebody else's.

**observation:** `apps/web/src/run-connection.ts:143–150` still names Q-0121 wrongly — *"Q-0015
renders mission control from this same snapshot while Q-0121 will hold several controllers at once"*.
Q-0121 shipped as the daemon's run listing, a server-side enumeration that holds no browser
controller. The draft's own Appendix B caught this last round and T03 is correctly told to fix it in
a file it already owns; recorded here so the correction is not lost when the appendix is dropped at
`finalize`.

**observation:** `apps/web/src/routes.ts` and `apps/web/src/daemon-endpoints.ts` will both hold the
literal `'/runs'` after T04 — `RUNS_PATH` and `DAEMON_ENDPOINTS.runs`. That is two registers carrying
one string for two different questions, which is the shape `ticketPath`/`ticketDetailPath` and
`gatePath`/`runGatePath` already have and which `daemon-endpoints.ts` argues for in place. Nothing is
wrong; a reader meeting them for the first time should know the near-homograph is deliberate.

---

## 7. What the gate should land, or the next pass fold in

All three majors are edits to `contracts/Q-0015/mission-control.contract.md` and one task's
`contracts` list. Nothing in `apps/web` is re-cut and no criterion moves.

1. **Two anchors for the trace** (M-1), in the sentence that already freezes the other five: one for
   a step column, carrying its `stepId`, and one for the run-activity lane.
2. **Two references on T08** (M-2): `apps/web/src/mission-control-text.ts#STEP_DISPOSITION_TEXT` and
   `contracts/Q-0015/mission-control.contract.md#routes-and-reads`.
3. **Replace §Contracts' closing sentence** (M-3) with the mechanism: iterations 1 and 2 are at
   `f1e21b1` and `d90768f`, and this iteration's are committed by the engine when the step ends, so
   no SHA is named here and nothing is owed to the surrounding workflow.
4. Fold the three nits — one export for the ticket-absence sentence, one clause naming the terminal
   event as the run number's source, one line saying this draft supersedes the earlier two.
5. **Write the AC-6 erratum to `backlog/Q-0015-…/solution/errata.md`**, not to
   `requirements/errata.md`: `qa-red.yaml`'s `scenarios` step reads the first and has no `repo: true`
   to reach the contract file (§2.4).

**Because `on_fail: { goto: architect, max_iterations: 2 }` is already spent and this run reached
iteration 3 through a `retry`, this verdict exhausts the loop and reaches a gate.** That is the right
venue rather than an accident — item 5 is owed there regardless, and items 1 to 4 are edits of the
same size a human lands in one sitting, which is what *"A refused finding is a gate, not another
round"* (2026-08-31) contemplates. **What must not be carried past that gate is items 1 and 2**:
`qa-red` writes AC-4's, AC-5's and AC-7's assertions next, and all three currently have something to
target that no contract names.

Once those are in, I would let QA start.

---

*Reviewed against `harness/Q-0015/contracts` at `0b1c965` and `main` at `61de8ff`. Every figure above
was taken from the tree during this review; none is transcribed from the requirement, the draft, or a
sibling review.*
