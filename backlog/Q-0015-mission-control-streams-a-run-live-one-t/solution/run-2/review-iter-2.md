# Q-0015 — architecture review of `solution/run-2/draft-iter-2.md`

*Review iteration 2, run 2, 2026-09-16. Verdict: **revise** — **no blocker**, five majors, four nits.
Every major is a contract-file edit; none touches the shape of the solution.*

> **Read this first.** Iteration 1's blocker is closed, properly, and the satisfiability sweep came
> back clean on every other axis. What remains is that **two of ten fan-out tasks cannot be
> verified** — one has nothing to implement and one has no criterion — and that **two of AC-11's
> three test clauses still have no anchor to target**. All of those are consequences of iteration
> 1's M-1 and M-2 being answered in form rather than in substance. The seam is right, the
> projections are the right abstraction, and I expect to approve the next pass.
>
> **Because the bound is 2, this verdict exhausts the loop and reaches a gate.** That is the right
> venue rather than an accident: the AC-6 erratum this document asks for is owed at that gate
> anyway, and §7 lists what to fold in there if the gate prefers `advance` to a third architect
> round.

---

## 0. What I verified, so the next reader does not re-derive it

**Iteration 1's six requested changes were all made.** Checked one at a time: the AC-6 contradiction
is named with the erratum and both discriminating directions (§"AC-6 erratum required before red
tests" and the contract's *Trace and timeline*); `mission-control-text.ts` exists as a contract with
its own task; AC-10's byte-level property is defined as *each contains at least one word absent from
the other*, which is exactly what M-4 asked for; the second-vendor claim is replaced with the
measured reason; and all five nits are folded in — `RUN_EVENT_RETENTION` moved to
`run-connection.ts` with its three reasons, T04 given the JSDoc, a *Connection lifetime* section
added and cited by T08, the Q-0121 comment assigned to T03, and `vendor` stated as the latest
observed. That is a well-executed revision round and I want to say so before the findings.

**The contracts are real, and they are all committed.** `d90768f` on `harness/Q-0015/contracts`,
parent `f1e21b1`; nine files and 220 insertions against `main`. `git status --porcelain` in that
worktree is **empty**. `git cat-file -e HEAD:apps/web/src/mission-control-text.ts` and
`HEAD:contracts/Q-0015/mission-control.contract.md` both resolve. See M-5 — the document says
otherwise.

**They remain invisible from where this step runs**, recorded as an observation rather than a
finding, as last round. `solutioning.yaml` gives `architect` `worktree: true` on
`harness/{id}/contracts`; `architecture-review` carries `input.repo: true` and no worktree, so it
reads the main checkout, where `contracts/Q-0015/` does not exist. A reviewer that did not read the
branch explicitly would report "the contracts are absent" — a failed probe read as a proven
negative, filed against this solution rather than against the flow.

**Six measurements this round's rulings rest on were re-run and hold.**

| claim | measured |
| --- | --- |
| `role=` under `apps/web/src` is one occurrence, and it is an ARIA selector | **exactly 1** — `backlog-board.test.ts:530`, `[role="progressbar"]`. `cost=` and `verdict=` clean |
| `'role=`, `"role=`, `/role=` do not match that selector | hold — the quote sits on the far side of the `=` |
| `role: frontend` is right for the fan-out | `development.yaml` templates `developer-{role}`; `Q-0120/solution/tasks.yaml` uses `frontend`/`backend` |
| the bare-list YAML in §Tasks is not a defect | `solutioning.yaml`'s `tasks` step normalises to `tasks: [...]` before `loadTasks` reads it |
| `RAIL` 1→2 and `ROUTES` 3→5 | `routes.test.ts:100` is `toStrictEqual(['backlog'])`; the three `screenExists: true` rows are board, ticket page, gate |
| the `/runs` row is `ticket: null, screenExists: false` with a non-empty `waitingFor` | confirmed in `routes.ts`, and the three `ticket: null` rows are home, `/runs`, `/settings` — N-2's count confirmed |

**Two collisions I went looking for are not there, and the negatives are worth recording, because
both would have been red tests no development task could green.**

- **The product-name scan does not forbid "quorum".** `EMPTY_RUNS_TEXT` contains *"quorum run uses a
  different process"*, and `source.test.ts:522–529`'s `FORBIDDEN_NAMES` is five entries —
  `acme-billing`, `heyruud.com`, `northwind-crm`, `feedmind`, `flextann`. The test is titled *"no
  mockup project name and no product name appears under src"*, so the title reads wider than the
  needles; the needles are what executes. AC-3's cause clause is safe.
- **The cost/token scan does not forbid the disclosure sentence.**
  `MISSION_CONTROL_DISCLOSURES[2]` is *"Per-vendor cost and token totals are unavailable as
  structured values…"*. `source.test.ts:271–296` forbids the phrase `cost to date`
  case-insensitively and five field identifiers — `tokensByVendor`, `vendorTokenTotal`,
  `input_tokens`, `output_tokens`, `cached_input_tokens`. Its own comment records why it is keyed on
  field names rather than on the word *token*. The sentence matches none of them.

**One concreteness question the contract answers better than I expected.** "Events with a `stepId`
field" is well-defined rather than loose: `events.ts:242–244` builds `runEventSchema` as
`spawnEventSchema.extend({ stepId })`, `stdoutEventSchema.extend({ stepId })` and
`retryEventSchema.extend({ stepId })` with `stepId = z.string()` — **required, never optional** —
beside `step` and `done`, which carry it at `:148` and `:155`, and `info`, `warn`, `gate`,
`terminal`, which have no such field at all. So `partitionTrace` discriminates on the union rather
than on `!== undefined`, AC-5's four no-`stepId` kinds are exactly right, and AC-4's literal
`"undefined"` clause is a string key like any other. Nothing here is ambiguous.

---

## 1. Blocker — none

Stated plainly because it is the first thing this role checks and because last round had one.

- **Iteration 1's blocker is closed.** AC-6's corpus is not narrowed — the contract says so in as
  many words, *"it never narrows the corpus"* — and the needle moves instead. I re-derived the
  discrimination table and it holds. The erratum is named as owed at the gate rather than
  implemented around, which is Q-0121 E-1's shape and the right handling.
- **No fix lands in a file no task owns.** Checked file by file across T01–T10. `views.tsx` is
  untouched, `app.tsx` has T08, `routes.ts` has T04, `theme.css` has T09, the two documents have
  T10 and `docs/` is in `backend`'s granted paths. The four test files AC-14 moves belong to
  `qa-red`, correctly, and no development task lists one.
- **No assertion is true only during the red phase.** AC-14's register counts are rewritten to the
  post-change values and stay true afterwards; AC-9's retention assertions describe shipped
  behaviour after T03.
- **The write boundary genuinely does not move.** `WRITE_RULES` matches AC-14's description,
  `'/stop'` is still `permitted: null`, and no task touches that file. The rejection of the stop
  button — on the measurement that nothing produces a run, so the control has no user — is right.

---

## 2. Majors

### M-1 — T06 has nothing to implement, so M-2's split did not happen

`apps/web/src/mission-control-text.ts` at `d90768f` is **complete**. Every export is a finished
value: `EMPTY_RUNS_TEXT` is a string literal, `STEP_DISPOSITION_TEXT` carries all three labels,
`MISSION_CONTROL_DISCLOSURES` carries all five sentences, and `daemonMissedText` and
`browserDiscardedText` have real bodies. **Nothing in the file throws.** I checked AC-10's lexical
property against the two frozen strings directly and it already holds — `daemon`, `omitted`, `from`,
`replay` on one side, `browser`, `discarded`, `live`, `keep`, `view`, `bounded` on the other.

T06's description is *"replace no exported name or frozen sentence while completing any
implementation detail needed by its typed copy contract"*. There is no implementation detail left.
T06 is a fan-out slot, a worktree, a branch and a vendor call for zero work.

**That matters because of what it was for.** Iteration 1's M-2 was that the screen task is the whole
screen and cannot be split later, against `harness/architecture.md`'s *"a task touches one coherent
file set and is describable in a sentence"* and decision 033's *"tasks are small; the fan-out is the
unit of parallelism, not of scope"*. The remedy offered was extracting the copy module into its own
task. It was extracted — but because copy is **data**, the extraction removed no work from the
screen. T07 now reads:

> render the run-activity lane, trace columns, timeline, main-region connection and metadata states,
> independent loss notices, five disclosures, terminal run number and pendingGates-derived gate link

Nine items — the same count M-2 objected to — satisfying **AC-4, AC-5, AC-6, AC-7, AC-8, AC-10,
AC-11 and AC-12**. Eight criteria in one file, in a decomposition whose cleanliness everywhere else
comes from per-file ownership.

**The remedy is to split the screen by region, which per-file ownership supports.** Declare two
component stubs at their final paths instead of one — a trace module owning the lane and the columns
(AC-4, AC-5, AC-6) and a status module owning the disclosures, both loss notices, run identity, the
gate link and the connection and metadata states (AC-8, AC-10, AC-11, AC-12) — and reduce the screen
task to composition and the timeline. That is two tasks with real work in place of one overloaded
task and one empty one, at the same slot count. Then **delete T06**: a complete contract does not
need an implementer.

### M-2 — two of AC-11's three test clauses have no anchor, which is M-1 of last round unfixed at two sites

AC-11's *Test:* clause names three targets:

1. *"assert the five sentences on a live-run fixture"* → anchored, `data-mission-control-disclosures`. ✓
2. *"assert **the header region's** text matches none of `—`, `$`, `0:00`, `n/a`"* → **no anchor.**
3. *"assert **the run-identity region** shows the handle before a `terminal` and the number after
   one"* → **no anchor.**

The contract freezes three anchors — `data-mission-control-state` for the main state region,
`data-mission-control-disclosures` for the disclosures, `data-step-disposition` for timeline rows —
plus the existing `data-request-state`. The run-identity region is unmistakably a fourth region: it
renders the handle and then swaps in the number, which no other region does, and the contract's own
prose says *"The handle identifies a live run; a terminal-provided run number replaces that
explanation only after it exists"* while giving it nothing to be selected by.

This is precisely iteration 1's M-1 — *"QA writes assertions encoding wording that T05 and T07 will
invent later, independently"* — answered for three regions and left open for two. The negative glyph
clause is the worse of the two, because a scan for `$` or `—` over the **whole** rendered output
would collide with any legitimate use elsewhere on the screen, so the assertion genuinely needs a
bounded subtree. It is greenable, since T07 can read the red test and emit whatever anchor it
targets — which is why this is a major and not a blocker — but the loop then goes red for an anchor
rather than for behaviour, which is the cost the house idiom exists to avoid.

**The remedy is two more `data-*` names in the same sentence of the contract**, on the shipped
precedent of `data-gate-kind`, `data-answer-state`, `data-gate-subject`, `data-refusal` and
`data-request-state`.

### M-3 — T09 has no criterion, no red test, no contract content, and no selector vocabulary

Four things are true of T09 at once, and each is enough to question it:

- **No acceptance criterion requires it.** I read all fourteen. None names `theme.css`, a layout, a
  class or an overflow behaviour. The nearest thing is R-3, *"the overflow is horizontal and
  accessible"* — a **risk**, not a criterion.
- **No red test can hold it**, which follows from the first. `integrate` runs `expect: pass`, so
  T09's output is neither required for green nor falsifiable by it.
- **Its contract references do not contain its deliverable.** It cites `#trace-and-timeline`, which
  specifies `partitionTrace`'s losslessness, vendor derivation, the AC-6 scan and
  `buildStepTimeline` — and says nothing about styling. The review instruction is *every task
  references a contract*; T09 satisfies it nominally and not in substance.
- **It works against this app's styling model, and the layout therefore lands in files it does not
  own.** `theme.css` is Tailwind v4 `@theme` tokens plus three element rules (`html, body, #root`
  and `body`), and its own header says it is *"the one place a colour is written down"* and that
  *"a component says `bg-surface` and never a colour"*. Layout in this app is utility classes **in
  the component** — T05's and T07's files. T09 is told to add rules for *"the runs listing, labelled
  run-activity lane, horizontally scrollable per-step columns, timeline, disclosures and state
  regions"*, and the contract freezes selectors for at most three of those six. The lane and the
  columns — the two things this ticket is about — have no frozen selector at all, while T09 declares
  `depends_on: []`. So T09 invents class names T07 will not emit, or T07 must emit names T09
  invents, with nothing binding them.

The outcome is not a failed loop, it is dead CSS and an unmitigated R-3 that no test catches.
**Either delete T09 and put the layout in T05 and T07 as utility classes, which is the house
pattern**, or, if raw CSS is genuinely wanted for the horizontal scroller, freeze the class
vocabulary in the contract beside the `data-*` anchors and give the styling an acceptance criterion
so it has a subject.

### M-4 — the narrowed AC-6 needle set omits one of TypeScript's three string delimiters

The contract freezes the needles as *"`'cost=`, `"cost=`, `/cost=`, and the corresponding `role=`
and `verdict=` forms"* — nine needles across three delimiters: single quote, double quote, regex.
**The backtick is missing.** `` message.split(`cost=`) `` and `` const NEEDLE = `role=` `` evade all
nine, in a repository whose engine composes the very strings this guard is about as template
literals — `` `${adapterName}/${model} role=${role}` `` at `steps.ts:257`.

I am not raising the job AC-6's *Test:* clause gives the instrument, which would be Q-0067 E-1's
error. AC-6 asks for a clause that catches a browser file parsing human prose for a machine value.
The narrowing is correct and necessary; it is just **incomplete in the one dimension it is narrowing
on**. Enumerating two of three delimiters in a guard whose whole subject is delimiters is the
"failing on any third reader" gap Q-0067 rounds 1 and 2 found twice.

It also removes an ambiguity in the erratum itself: AC-6's clause says the guard must be *"shown to
discriminate over a fixture containing `` `cost=$0.123` ``"*, and a fixture written as a template
literal would not match the nine-needle set — so the criterion's own named fixture could fail to
fire.

**The fix is one character per needle, twelve in place of nine**, in the contract and in the
erratum's bullet list. Same shape as the fix iteration 1 proposed.

### M-5 — the document says its own iteration-2 contracts are uncommitted, and they are

§Contracts closes:

> The initial contracts were committed on `harness/Q-0015/contracts` at `f1e21b1`. The iteration-2
> revisions are present in this worktree; committing them was attempted but the sandbox could not
> create the parent repository's worktree `index.lock`.

Measured: **`d90768f`**, *"architect: Revised the solution around the review's satisfiability find
[Q-0015]"*, parent `f1e21b1`, four files and 61 insertions — `mission-control-text.ts` created,
`mission-control-model.ts` losing the retention constant, `run-connection.ts` gaining it, and 23
lines added to the contract. `git status --porcelain` in that worktree is empty and both new paths
resolve at `HEAD`.

**This is in the safe direction and still has a concrete downstream cost**, which is why it is a
major rather than an observation. `harness/architecture.md` says *"Never write the stub twice: a copy
under `contracts/` beside the real file is a second definition free to drift"* — and a QA agent told
its contracts may not have landed has one obvious recovery, which is to re-create them. That
produces exactly the second definition the rule forbids, or a red suite written against a copy of
`mission-control-text.ts` whose sentences drift from the one T07 imports. It is also the class the
architecture context lists first among this repository's recurring mistakes: a claim with no
executable check behind it, recorded in a durable artifact. One sentence to correct, and the commit
to name is `d90768f`.

---

## 3. Coverage — every criterion has a task, and the two verification gaps are marked

Checked one at a time against the tree.

| AC | tasks | contract | |
| --- | --- | --- | --- |
| 1 landing reads once, never polls | T01, T05 | `daemon-client.ts#fetchRuns`, `#routes-and-reads` | ✓ |
| 2 row order, fields, null ticket | T05 | `#routes-and-reads`, sentence frozen | ✓ |
| 3 five request states, honest empty | T05, T06 | `#routes-and-reads`, `EMPTY_RUNS_TEXT` | ✓ |
| 4 one column per `stepId` | T02, T07 | `mission-control-model.ts`, `#trace-and-timeline` | ✓ strong |
| 5 run-level lane, conservation | T02, T07 | `#trace-and-timeline` | ✓ strong |
| 6 what a column renders / never derives | T02, T07, qa-red | `#trace-and-timeline` | ⚠ M-4 |
| 7 three dispositions | T02, T06, T07 | `StepDisposition`, `#trace-and-timeline` | ✓ strong |
| 8 every non-streaming state, main region | T07 | `#retention-and-disclosure`, `data-mission-control-state` | ✓, see N-2 |
| 9 bounded list, exact counter, immutability | T03 | `run-connection.ts#RUN_EVENT_RETENTION` | ✓ |
| 10 two counters, two sentences | T03, T06, T07 | both sentences frozen, property defined | ✓ |
| 11 five things it cannot show | T06, T07 | sentences frozen, **two regions unanchored** | ⚠ M-2 |
| 12 gate link from `pendingGates` | T04, T07 | `#routes-and-reads` | ✓ strong |
| 13 one connection, re-targeted | T08 | `#connection-lifetime` | ✓ |
| 14 boundary unmoved; registers and docs move | T04, T08, T10, qa-red | `#write-boundary` | ✓, see N-1 |
| — | **T09** | cites a section that does not specify it | ✗ M-3 |
| — | **T06** | complete on arrival; nothing to implement | ✗ M-1 |

**No two tasks share an owned file**, verified across all ten; all declare `depends_on: []` and form
one wave. That works because every symbol a task imports across the seam is already committed:
T08 imports `RUNS_PATH` and `RUN_ROUTE` while T04 still owns `routes.ts`, T07 imports
`TracePartition` while T02 still owns the model, T03 imports nothing backwards now that the
retention constant moved. That is N-1 of last round paying off immediately.

**The four strongest contracts, named so a later round does not weaken them.** AC-5's conservation
clause — *"every input event occurs exactly once in either the run-activity lane or one step
column"* — is what makes *"nothing is dropped"* checkable rather than asserted, and it is checkable
because `runEventSchema` makes `stepId` required on exactly five members. `StepDisposition`'s third
member puts AC-7's *"never calls a failed step running"* in the **type**, where no round can collapse
it into a neighbour without a compile error. AC-12's rule that the link comes from `pendingGates`
and *"never by observing a gate event"* is right for the late joiner the daemon's retention exists to
serve. And `mission-control-text.ts` as a frozen copy module is the correct answer to M-1 — it is
only its *task* that should not exist.

---

## 4. Satisfiability — the rest of the sweep

Beyond §1, I checked the two shapes the role brief names at every site this change touches and
found neither. Recorded because the negatives cost something to establish:

- **`source.test.ts:138`** — *"no test renders a run route without supplying a socket factory"*. This
  binds `qa-red`, not a development task, and the design satisfies it: `app.tsx` takes an injectable
  `socketFactory` and AC-4's fixture drives it. No collision.
- **`source.test.ts:340`** — *"nothing turns a run-log line into a link, and no renderer or sanitiser
  is imported"*. AC-6 renders stdout as React text nodes and imports neither. No collision.
- **`source.test.ts:473–483`** — the corpus is every file under `src`, pinned by
  `toContain('shell.test.ts')` and `toContain('theme.css')`. Four new files enter that corpus and
  none trips the Node-builtin, engine-import, colour, URL or font clauses: `mission-control-model.ts`
  imports `type { Event }` from `@quorum/shared` only, the two `.tsx` files import `type { ReactNode }`
  from `react`, and `mission-control-text.ts` imports nothing.
- **`lint-coverage.test.ts`** — `.tsx` has been in ESLint's scope since Q-0014 AC-4. Two new `.tsx`
  files need no configuration change.
- **`routes.test.ts:95`, `:125`** — rewritten by `qa-red` to two and five, red until T04 lands, true
  afterwards. Correct red-test shape.

---

## 5. Nits

**N-1 — T10 cites a contract that says nothing about documentation.** Its only reference is
`contracts/Q-0015/mission-control.contract.md`, whose five sections are routes and reads, trace and
timeline, retention and disclosure, connection lifetime, and write boundary. None mentions
`docs/04-architecture.md` or `docs/06-development-plan.md`. AC-14's prose is what actually specifies
the work, so the task is not unowned — but the citation is doing no work. Either add a sentence to
the write-boundary section naming what the two documents must record, or cite AC-14 directly.

**N-2 — `connectionText` and `retryable` duplicate two shipped derivations.**
`connection-state.ts` exports `connectionStateText(state)` at `:97` and `canRetry(state)` at `:121`,
both pure over `ConnectionState`. `MissionControlScreenProps` takes `snapshot` (which carries
`state`) **and** `connectionText: string` **and** `retryable: boolean`, so a test can hand the
screen an inconsistent pair — `state: { kind: 'live' }` with the *no daemon* sentence — and
AC-8's nine assertions would then be proving that the screen echoes a string rather than that each
state reaches the main region. `shell.tsx:95` takes text the same way, so this is the house pattern
for the top bar and not a defect; deriving inside the screen from `snapshot.state` is simply
stronger, removes two props, and lets AC-8's fixture vary one input.

**N-3 — `fetchRuns` is typed `Promise` and throws synchronously.**
`export const fetchRuns = (_fetcher, _now): Promise<RequestState<WireRunList>> => { void
wireRunListSchema; throw new Error('not implemented'); }`. Throwing is the house stub convention and
the sibling `fetchRun` returns `requestJson(...)`, so the shape is right — but a red test written as
`await expect(fetchRuns(f, now)).rejects.toThrow()` throws at the call rather than rejecting, which
is a trap worth one word in the contract. The `void wireRunListSchema` is a reasonable way to keep
the import live.

**N-4 — the `finalize` step will carry M-5's false sentence forward.** `solutioning.yaml`'s
`finalize` instruction is *"Keep the Contracts and Tasks sections verbatim unless the review changed
them"*. This review changed them, so say so explicitly in the next draft rather than relying on that
clause.

---

## 6. Observations

*True and worth recording; none is a claim about this change.*

**observation:** This step cannot see the artifacts it reviews. `architecture-review` carries
`input.repo: true` and no `worktree`, while `architect` writes to `harness/{id}/contracts` — so the
contracts are absent from the checkout this step reads, and a reviewer that did not read the branch
by name would report them missing. Two consecutive iterations have now had to work around it. It is
a property of `solutioning.yaml` rather than of this ticket, and the cheap fix — giving this step
the same `branch:` the architect writes — is a flow change and somebody else's.

**observation:** `docs/06-development-plan.md`'s bullets are rewritten by hand at each plan pass,
which Q-0094's erratum E-3(a) recorded when it withdrew E-2 for exactly this reason — *"this page's
bullets are rewritten by hand at each plan pass, so iteration 3's revert cost nothing"*. AC-14 names
that file, so T10 is right to edit it; a reader should expect the edit to be superseded rather than
preserved.

**observation:** `source.test.ts:513`'s describe block is titled *"the app names no project it has
not been given"* and its test *"no mockup project name and no product name appears under src"*,
while `FORBIDDEN_NAMES` contains no product name — three mockup projects and two SaaS names. The
title reads wider than the needles execute. Nothing is wrong today and `EMPTY_RUNS_TEXT`'s
*"quorum run"* is safe; a future reader taking the title at face value would reach the wrong
conclusion about what is forbidden.

---

## 7. What the next pass needs, and what a gate can fold in instead

All five majors are edits to `contracts/Q-0015/mission-control.contract.md` and the Tasks block. No
design decision moves, no criterion moves, and nothing in `apps/web` is re-cut.

1. **Split the screen by region and delete T06** (M-1). Two component stubs at their final paths —
   trace (AC-4, AC-5, AC-6) and status (AC-8, AC-10, AC-11, AC-12) — with the screen task reduced to
   composition and the timeline. Ten tasks stay ten, and both new ones have work.
2. **Freeze anchors for the header region and the run-identity region** (M-2), in the sentence that
   already freezes the other three.
3. **Resolve T09** (M-3): delete it and put the layout in the two screen tasks as utility classes,
   or freeze a class vocabulary and give the styling a criterion.
4. **Add the backtick delimiter to the AC-6 needle set** (M-4), in the contract and in the erratum
   bullet — twelve needles, not nine.
5. **Correct §Contracts to say the iteration-2 revisions are committed at `d90768f`** (M-5).
6. Fold the four nits.

**If the gate answers `advance` rather than `retry`**, items 2, 4 and 5 are one-line contract edits a
human can land there, and items 1 and 3 are a Tasks-block rewrite of the same size — which is what
*"A refused finding is a gate, not another round"* (2026-08-31) contemplates. What must not be
carried past that gate is item 2: `qa-red` writes AC-11's assertions next, and two of its three
clauses currently have nothing to target.

The AC-6 erratum this document asks for is owed at that gate regardless, so the gate is the venue
either way. **Once items 1–5 are in, I would let QA start.**

---

*Reviewed against `harness/Q-0015/contracts` at `d90768f` and `main` at `61de8ff`. Every figure above
was taken from the tree during this review; none is transcribed from the requirement, the draft, or a
sibling ticket's entry.*
