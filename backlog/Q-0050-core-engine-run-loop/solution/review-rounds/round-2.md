# Architecture review — Q-0050 solution, round 2

*Reviewer: architecture-reviewer (claude/opus), 2026-08-28 · input: `requirements/merged.md`,
`solution/draft.md`, `contracts/Q-0050/*` read from `harness/Q-0050/contracts` at `8e798fb` ·
verdict: **revise***

**Verdict in one sentence.** Every round-one finding is genuinely resolved and the design is one I
would sign; I am refusing on three satisfiability defects that all live in the seam round one
opened — the red phase's compilable surface — plus one landed symbol the contract duplicates.

## Round one, closed

Stated so a third round does not churn what is now correct.

| Finding | Status |
| --- | --- |
| **B-1** gate-asking body unowned | **Closed.** `routing.ts` owns `askGate(request, ctx)` outright, `ctx` injects the callback, and `lifecycle-routing.contract.md` puts auto/dry short-circuits, question emission, answer validation, pre-action logging, the one-traversal retry grant and the `signalWindow` timer inside it. The no-import-cycle constraint is stated (`routing.ts` never imports `engine.ts`) rather than left to be discovered. |
| **B-3** unwritable implement report | **Closed.** The durable enumeration is `lifecycle-routing.contract.md`'s eight-row table plus one-line `Why:` annotations, with the report discrepancy routed to the human gate. That is the remedy, taken. |
| **M-2** seven narration strings, one owner | **Closed.** The per-site table assigns each string to the file containing its function; the transcribed fixture stays the common oracle. |
| **M-3** false `documentation` dependency | **Closed.** `q0050-engine-compose` depends on `event-channel`, `routing`, `lifecycle` and nothing else. |
| **M-4** errata condition | **Closed, and correctly.** "errata reaches qa-red, not development; anything a developer must act on has to be in `solution/solution.md` or a contract" is the true statement. |
| **M-1** single-vendor fan-out | **Accepted explicitly**, which is one of the two outcomes round one offered. The invalid `tooling`/`docs` fallback is deleted and `q0050-event-channel` is named as the seam if the vocabulary changes. See M-3 below for the one thing left to do with it. |
| nits | Finalisation hook declared in `types.ts`; regression payload is a discriminated union, not optionals; `terminal.error` and the `runs.log` suffix pinned to one pre-quoting string; the corpus assertion named as a deliberate QA extension. All four taken. |

Two additions of the architect's own are worth naming because they are better than what was asked
for. Making `askGate` the primitive Q-0052 *calls* rather than a seam Q-0052 *reimplements* is the
stronger reading of B-1's remedy. And `run-events.contract.md`'s statement that
`packages/shared/src/index.ts` needs no Q-0050 edit is **correct and load-bearing** — I checked:
the barrel is `export * from './events.js'`, so the new terminal member and answer schemas reach
`core` without touching a second file or a second owner.

---

## Blockers

### B-1 — Three of the six production files get no stub, and AC-11 cannot compile without one

`module-layout.contract.md:28-31` names the stub set exactly:

> Before writing assertions, qa-red also owns declaration-only compilable stubs at
> `packages/core/src/engine/types.ts`, `channel.ts`, and `engine.ts`.

The same contract's own ownership table gives `loaders.ts` six exports — `loadFlow`,
`loadFlowByName`, `loadRole`, `interpolate`, `writesOf`, `reviewRound` — and gives `routing.ts` and
`lifecycle.ts` their own. None of the three is stubbed, and `run-flow-api.contract.ts` declares no
loader, routing or lifecycle symbol at all: its exports are `RunFlowOptions`, `AnswerGate`,
`RunStatus`, `RunTicket`, `RunFlowDefinition`, the two contract-local gate shapes, `runFlow` and
`FlowError`. So there is nothing to copy into a stub even for an implementer who decided to write
one.

AC-11's test line is not satisfiable through `engine.ts`:

> *Test:* **one focused test per helper** asserting the exact string where a message exists; a
> stage-mismatch run asserting the message …; `loadFlowByName` over a missing flow asserting
> `ENOENT` and over a lint-failing flow asserting the `FlowError`.

`interpolate` leaving `{key}` literal, `writesOf` preferring singular over plural, and
`reviewRound` counting only directories containing `verdict.md` are pure functions with no path
through `runFlow` that a *focused* test could take. A red test for AC-11 imports
`packages/core/src/engine/loaders.js`, that module does not exist, and the failure is module
resolution — which `qa-red.yaml:26-27` forbids in as many words (*"FAIL on assertions, not on
missing symbols"*) and which `scenario-review` is instructed to revise on, at `max_iterations: 1`,
straight into an exhaustion gate.

This is round one's B-2 relocated, not resolved: three files were given a compilable surface and
three were not.

**Remedy.** Extend the stub set to all six files and give `run-flow-api.contract.ts` (or a sibling
`.ts` contract) the exported signatures of `loaders.ts`, `routing.ts` and `lifecycle.ts` — the
declarations are already prose in `lifecycle-routing.contract.md`, so this is transcription, not
design. If the intent is instead that some criteria are only ever exercised end-to-end through
`engine.ts`, say which — but AC-11 cannot be one of them, and AC-9's `finish`, AC-10's dry view and
AC-6's counter arithmetic should each be stated as end-to-end or as focused, because QA has to pick
one before it writes a line.

### B-2 — Stub authorship is given to the one step told not to write production code, against a landed decision, through a document that step never receives

Three measured facts, each independently sufficient.

**(a) The step's own instruction forbids it.** `qa-red.yaml:27`: *"Do not implement production
code."* `module-layout.contract.md:1-2`: *"Production lands under `packages/core/src/engine/`."*
The stubs are at exactly those paths. The QA agent is handed a contradiction and this repository's
agents refuse contradictions correctly — Q-0069 burnt three revise rounds on that behaviour and it
was the right behaviour every time.

**(b) It contradicts a landed decision entry, silently.** *"Solutioning emits contracts; red phase
tests against contracts"* (2026-08-21) reads:

> The architect step must produce machine-checkable contracts (interfaces, schemas, **stubs**,
> migration skeletons) … all committed to the ticket branch. QA-red writes tests that compile
> against the stubs and fail on assertions.

`harness/architecture.md`'s contract convention repeats it — *"domain: typed interface + stub …
Tests in the red phase compile against these stubs."* The solution moves stub authorship to QA
without naming either. `.claude/rules/docs-and-decisions.md` and `harness/rules.md` both say a
decision is never contradicted silently: it takes a new entry, or an amendment naming it. This one
is not mentioned.

**(c) The instruction is delivered to a step that cannot read it.** `write-tests`' inputs
(`qa-red.yaml:23`) are `qa/scenarios.md`, `solution/tasks.yaml`, `solution/errata.md`,
`qa/scenario-review.md`, `qa/red-report.md` — **not `solution/solution.md`**, which is what
`scenarios` receives (`:10`). The stub instruction lives in the solution document and in
`module-layout.contract.md`; only the second is reachable, via `repo: true`, and it is the one the
step's own instruction contradicts. The only other signal is the phrase "Replace the QA stub"
appearing in three task descriptions in `tasks.yaml` — oblique, and it names the same three files
B-1 says are too few.

**Remedy, and the mechanism already exists.** `harness/roles/principal-architect.md` carries **no
`paths:` frontmatter**, the architect step runs `worktree: true` on `harness/{id}/contracts`, and
`merge-contracts` merges that branch into `harness/{id}/integration` — which is precisely
`write-tests`' `base` (`qa-red.yaml:24`). Land the six declaration-only stubs from the architect
step, on the branch that already carries `contracts/Q-0050/`. That is what the 2026-08-21 entry and
`architecture.md` prescribe, it deletes the contradiction in (a) rather than asking an agent to
resolve it, it removes the delivery gap in (c) entirely, and it puts the declarations in the hands
of the person who designed them. `merge-contracts` declares no `run_tests`, so throwing stubs
cannot break it, and `corpus.test.ts:37` is `expect.arrayContaining`, so a new `engine/` folder
breaks nothing on the way through.

If the architect genuinely wants QA to author them instead, that needs the decision entry the
docs rules require, and the authorisation has to be carried in `qa/scenarios.md` — the one
qa-red artifact `write-tests` actually reads.

### B-3 — `FlowError` already exists in `core`, and the contract creates a second one

**Measured.** `packages/core/src/lint/lint.ts:29` — `export class FlowError extends Error {}` —
landed by Q-0044, and its JSDoc at `:25` says why it matters: *"A command routes on `e instanceof
FlowError`."* The spike is unambiguous about the same thing: `engine.js:11` imports `FlowError`
from `./lint.js` and `:13` re-exports it.

`module-layout.contract.md:9` gives `types.ts` ownership of *"public `RunFlowOptions`, `AnswerGate`,
and `FlowError`"*, and `run-flow-api.contract.ts:86` declares `export declare class FlowError
extends Error {}`. Two classes with the same name in one package is not a naming nit — it splits
`instanceof`:

- `loadFlow` runs `lintFlow` (`lint.ts:248`), which throws **lint's** `FlowError`.
- `runFlow`'s stage precondition and `runStep`'s parallel-survivors message would throw
  **`types.ts`'s**.
- AC-11 asserts *"over a lint-failing flow asserting the `FlowError`"*; AC-3 asserts the run
  *"additionally throws a typed `FlowError`"*. Whichever module the test imports from, one of those
  two assertions is testing a different type than it thinks, and Q-0010's `instanceof` routing
  inherits the split.

Charter §2 preservation points the same way: the spike has one class, imported.

**Remedy.** State in `module-layout.contract.md` that `FlowError` is `../lint/lint.js`'s and that
`types.ts` re-exports it; no file under `engine/` declares an error class. Change
`run-flow-api.contract.ts`'s declaration to a re-export or a comment naming the real home. This
also settles B-1's stub content: `types.ts`'s stub must supply a **runtime** class, not a
`declare`, or `loaders.ts` cannot throw one.

---

## Majors

### M-1 — `runStep`'s author-declared gate branch has two readings, and four AC-4 clauses live behind it

**Measured.** `spike/src/engine.js:193`: `if (step.gate) return runGate(step, ctx);` — `runStep`
dispatches author-declared gate steps into the same function `handleFail:550` calls for exhaustion.

The solution says two things that point in opposite directions. `lifecycle-routing.contract.md`:
*"`runStep` dispatches in spike order"* and *"Q-0052 later calls the same exported primitive for
author-declared gate steps rather than reimplementing policy."* But `q0050-routing`'s description
says: *"Q-0052 will call askGate for author-declared gate steps; **do not implement its gate-step**
… bodies."* A developer taking the second reading leaves `step.gate` undispatched.

These AC-4 clauses are specified over an author-declared gate and are untestable without it:

| Clause | Why an exhaustion gate will not serve |
| --- | --- |
| 4.6 `auto` and `--auto` advance without consuming an answer | the synthesised gate is `human-locked` by construction — that is the point of AC-6 |
| 4.6 `--dry` emits the would-pause `info` | reaching an exhaustion gate under `--dry` needs a failing step, which `--dry` does not run |
| 4.5 no channel supplied fails naming the gate | wants the ordinary gate's kind and reason |
| 4.7 `gate=<kind> answer=<answer>` for **every** answered gate | "every" includes declared ones |

**Remedy.** One sentence: in Q-0050, `runStep`'s `step.gate` branch calls `askGate`; Q-0052 inherits
that call and adds no gate policy. Then delete "do not implement its gate-step … bodies" from
`q0050-routing`, which currently forbids the thing the contract requires.

**Note for the human gate.** Taking the whole gate body into Q-0050 contradicts the requirement's
Non-goals (*"`runGate`'s body … — Q-0052"*). It was round one's mandated remedy and I still think it
is right — the alternative is two owners for one policy — but the solution should name it as a
deliberate boundary change rather than leave a reviewer to find the contradiction. The requirement
also calls this ticket "at the ceiling" on size, and this adds to it.

### M-2 — `q0050-loaders` declares `depends_on: []` while `loaders.ts` cannot compile alone

`loadRole` throws `FlowError` and `loadFlow` propagates `lintFlow`'s. Under the contract as written
that symbol is `types.ts`'s, owned by `q0050-engine-types`, which depends on `q0050-shared-events`
and therefore lands a wave later — so wave 1's developer codes against a stub whose `FlowError` is
`declare`d and has no runtime class. Under B-3's remedy the dependency is on `../lint/lint.js`,
which is landed and contained, and `depends_on: []` becomes correct.

Either is fine; the document has to pick one, because `waves()` derives the schedule from
`depends_on` and a task whose real dependency is undeclared is the merge-time surprise the
architect's own role file warns about.

### M-3 — The single-vendor acceptance is sound, but it leaves the requirement's checklist asserting the opposite

All eight tasks are `role: backend`; `development.yaml:8` expands them to `developer-backend`
(codex) eight times, and `development.yaml` declares no `cross_vendor` key, so nothing lints it. I
accept the explicit acceptance — round one offered it, the stated constraint is real
(`solutioning.yaml:19` names `frontend|backend|data`), and the invalid `docs`/`tooling` fallback is
correctly deleted.

What is left undone is the contradiction it creates. `requirements/merged.md`'s cross-cutting
checklist states: *"`cross_vendor: required` is satisfied on this route by `development.yaml`'s two
fan-out roles being on different vendors."* That row is now false for this solution. Add one
sentence saying so, so the human gate rules on a stated conflict rather than approving two documents
that disagree. Worth noting for that ruling: `harness/roles/developer-tooling.md` exists and its
paths include `packages/core`, so `role: tooling` would resolve at run time — the constraint is the
architect step's instruction, not the engine.

---

## Nits

- **`run-flow-api.contract.ts:8` still imports `Event` from `@quorum/shared`,** which does not
  resolve from `contracts/` and which nothing compiles. That is now harmless, because the contract
  is explicitly not a compilation root and the stubs are the compiled copy — but say that the two
  are hand-synced, since no test compares them and a normative artifact that has never been
  typechecked can drift.
- **Name the terminal member's union mechanism.** `eventSchema` (`events.ts:196`) is a flat
  `z.discriminatedUnion('type', …)` of eight `.strict()` objects; nothing in this repository has
  nested a union inside it. Say whether the terminal member is one option that is itself
  `z.discriminatedUnion('status', …)`, or two flat `type: 'terminal'` options, so AC-3's
  partial-payload rejection test has one subject and its author is not choosing the mechanism at
  test-writing time.
- **AC-12's induced git failure needs a named seam.** `fanout.ts:204` is `execFileSync('git', args,
  { cwd })`, so a `PATH` shim or a non-repo `cwd` both work for the start-of-run head at `:48`. The
  rollback read at `:641` is harder: git must succeed at start and fail at finish, which is
  mid-run sabotage. Name the seam, or QA spends a round finding one — and the whole point of that
  criterion is that the failure is silent.
- **Two more landed suites move under this change.** `packages/shared/src/events.test.ts` and
  `docs.test.ts` will both be touched by the union widening and the `docs/` corrections. The
  contract names only the corpus assertion as a deliberate QA extension; name these two the same
  way. A landed assertion that changes without anyone deciding to change it is the Q-0072 shape.
- **`q0050-engine-compose` verifies the whole folder while editing one file.** Correct as written —
  but say what it does when it finds a violation in another owner's file, since it cannot fix one.
  "Stop and report" is the flow's own answer and costs a sentence.

---

## Coverage: criterion → task → contract

| AC | Task(s) | Contract | Status |
| --- | --- | --- | --- |
| AC-1 | every source owner; `engine-compose` verifies folder | module-layout | ✔ (nit: violation-found path) |
| AC-2 | `shared-events`, `event-channel`, `routing`, `lifecycle`, `engine-compose` | run-events, run-flow-api | ✔ — per-file narration closes M-2 of round one |
| AC-3 | `shared-events`, `event-channel`, `lifecycle` | run-events | ✔ (nits: union mechanism; **B-3** for the thrown type) |
| AC-4 | `shared-events`, `engine-types`, `routing` | run-events, run-flow-api, lifecycle-routing | ⚠ **M-1** — clauses 4.5–4.7 need the declared-gate dispatch |
| AC-5 | `event-channel`, `lifecycle`, `engine-compose` | run-events, lifecycle-routing | ✔ — hook declared in `types.ts` |
| AC-6 | `routing` | lifecycle-routing | ✔ — `askGate` owns the ask; ✖ compile via **B-1** |
| AC-7 | `routing` | lifecycle-routing | ✔ — grant, log line and no-target abort all specified |
| AC-8 | `routing` | lifecycle-routing | ✔ |
| AC-9 | `lifecycle` | lifecycle-routing | ✔ |
| AC-10 | `lifecycle` | lifecycle-routing | ✔ — both defects positively pinned |
| AC-11 | `loaders`, `engine-compose` | lifecycle-routing, module-layout | ✖ **B-1** — six focused tests, no `loaders.ts` to import; **B-3** for the `FlowError` assertion |
| AC-12 | `routing`, `lifecycle` + contract table | lifecycle-routing | ✔ — B-3 of round one closed (nit: test seam) |
| AC-13 | `documentation` + each owner | module-layout | ✔ |

Every task references at least one contract; no two tasks own the same production file; the wave
graph is acyclic and `q0050-documentation` writes only paths `developer-backend` may write. What
does not hold is that the red suite can compile, that the step told to build its compilable surface
is allowed to, and that `FlowError` names one class.

## What I verified, by reading or running

`harness/flows/{solutioning,qa-red,development}.yaml`; `harness/roles/{principal-architect,
automation-qa,developer-backend}.md`; `harness/architecture.md`'s contract conventions and role
table; `docs/decisions/013-solutioning-emits-contracts.md`; `docs/02-sdlc-pipeline-spec.md:15`,
`:253`; `spike/src/engine.js:170-198`, `:539-600`; `spike/src/lint.js:5`;
`packages/core/src/lint/lint.ts:25-29`, `:248`; `packages/core/src/fanout/fanout.ts:204`;
`packages/core/src/corpus.test.ts:36-40`, `:87-114`; `packages/core/test/corpus.ts`'s
`coreSourceFiles`; `packages/shared/src/events.ts:125-215`, `events.test.ts:101-114`,
`index.ts`; all four files of `contracts/Q-0050/` at `8e798fb` on `harness/Q-0050/contracts`.

**Measured rather than cited.** `packages/core/src/lint/lint.ts:29` already exports `class FlowError
extends Error {}`; `grep` finds no other class of that name in `packages/core/src` or
`packages/shared/src`. `packages/shared/src/index.ts` is `export *`, so no barrel edit is needed —
the contract's claim is true. Every member of `eventSchema` is a flat `.strict()` object; none is a
nested union. `corpus.test.ts:37` is `expect.arrayContaining`, so a new `engine/` folder fails
nothing on its own, and `coreSourceFiles` is recursive and will pick the folder up. `write-tests`
does not receive `solution/solution.md` (`qa-red.yaml:23`); `scenarios` does (`:10`).
`principal-architect.md` has no `paths:` frontmatter. `contracts/Q-0050/` is 301 lines across four
files on the contracts branch and absent from `main`, which is expected and not a finding.

## What a passing round 3 looks like

1. Stub all six engine files, and declare `loaders.ts`, `routing.ts` and `lifecycle.ts` exports in a
   `.ts` contract so there is something to stub from (B-1).
2. Move stub authorship to the architect step and land them on `harness/{id}/contracts`, which
   `merge-contracts` already puts on `write-tests`' base — or write the decision entry that
   overrides 2026-08-21 and carry the authorisation in `qa/scenarios.md` (B-2).
3. Make `FlowError` one class: `../lint/lint.js`'s, re-exported (B-3).
4. Say that `runStep`'s `step.gate` branch calls `askGate` in Q-0050, and delete the task line that
   forbids it — then name the Non-goals boundary change for the gate (M-1).
5. Declare `q0050-loaders`' real dependency, whichever B-3 makes it (M-2); add the sentence
   correcting the requirement's `cross_vendor` row (M-3); take the five nits.

Nothing above asks for a redesign, and nothing above touches the channel, the terminal event, the
cancellation model or the preserved defects — all four are right. This is a revise about whether QA
can start on Monday, not about what is being built.
