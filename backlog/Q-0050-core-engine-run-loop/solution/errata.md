# Q-0050 — errata to `solution/`

Amendments to the solution and its contracts, decided at the solutioning gate and binding on the
implementer and the reviewer alike. Each names the clause it supersedes. The rest of
`solution/solution.md` and `contracts/Q-0050/**` stands.

Round 5's review returned `revise` with two blockers and two majors, the loop exhausted for the
second time, and the gate was answered `advance`. The reviewer's own note to the gate is why this
file exists rather than a round 6: every remaining finding is a mechanical correction to a contract
file, the remedies were written to be transcribable, and Q-0072's E-1/E-2 and Q-0073's E-4 are the
precedent. `qa-red.yaml:10` and `:23` read this file, so it is the oracle for anything below.

**Verified before writing, twice.** `finalize` and `tasks` ran after round 5 but wrote only
`solution/solution.md` and `solution/tasks.yaml` — no contract file moved from `63d4a6c`, the commit
round 5 reviewed. Re-checked after `merge-contracts` against `harness/Q-0050/integration` at
`d9d1bd0`, which is the base qa-red will read: `RunFlowOptions` and `RunContext` still carry no
project config, `backlog` and `writeFile` appear nowhere, `StepResult` is undeclared, and the
fixture still holds `log: [errorSuffix, gateAnswer, retryGrant, rollback, terminal]` and
`gate: [kind, reason, retry, ticketDir]`. All four findings are open exactly as reviewed.

**What `finalize` did do, which changes what this file is for.** `solution/solution.md`, written
after round 5, already states all four remedies in prose — the caller-supplied `Project` and
`Backlog`, the `Object.create(backlog)` dry view, the closed `StepResult` with routing returning and
`engine.ts` moving the cursor, and the four oracle strings. So this erratum is not deciding four
things at a gate. **It is recording that the contract files have not caught up with the solution
document, and binding the contracts to it** — which matters because qa-red writes its tests against
`contracts/Q-0050/**`, not against `solution.md`. Where the two disagree today, the entries below
say the solution wins.

## E-1 — the run context carries the project config — 2026-08-28

**Supersedes** `run-flow-api.contract.ts:6` (`RunFlowOptions`) and `:13` (`RunContext`), and the
claim in `module-layout.contract.md` that *"`RoutingContext` and `LifecycleContext` are complete
named seams"*.

**The amendment.** `RunFlowOptions` gains `project: Project` and `RunContext` gains
`config: ProjectConfig`. `packages/core/src/backlog/project.ts:40` already declares `Project` as
`{ repoDir, harnessDir, config }`, so this also collapses the duplicated `repoDir`/`harnessDir`
fields rather than adding a fourth spelling of them. `lifecycle-routing.contract.md` gains one
sentence: `vars.base` is `config.repo?.base_branch ?? 'main'`, and `adapterOverride` is
caller-supplied and is never read from disk.

**Why it is not a nit.** `engine.js:45` builds `vars.base` from `config.repo?.base_branch`, and with
no config on the context the implementer's only moves are to invent an option in a file another task
owns, or to hardcode `'main'` — which silently breaks every `{base}...` diff range downstream.
Sharper: `harness.js:608` sets `adapterOverride` on the *loaded* config, so `loadProject(repoDir)`
inside `runFlow` cannot recover it — the value never existed on disk. **AC-2's own test is one run
over a mock-adapter fixture flow**, and as contracted there is no way to ask for the mock adapter.
The project's regression suite is the mock-adapter suite; a contract that cannot drive it cannot be
tested against. Three later consumers read `ctx.config` too — `cmdTimeout` (`:497`),
`max_diff_bytes` (`:831`, Q-0051) and `commands.test` (`:1031`, Q-0053).

**The ownership argument, which is why this is an erratum and not a development finding.** The fix
belongs in `types.ts`, owned by `q0050-engine-types` in wave 2. The gap surfaces in
`q0050-engine-compose` in wave 4, whose own description says *"report a violation in another owner's
file instead of editing it"*. So the discovering task may not fix it and the owning task has already
finished — *"a loop spending its budget on work no agent in it can perform"*, and the remedy is to
close it before the fan-out starts rather than after.

## E-2 — the dry view keeps its mechanism: the context carries the backlog — 2026-08-28

**Supersedes** `run-flow-api.contract.ts:11` (`RunPersistence` as the only persistence seam) and
resolves the contradiction between `lifecycle-routing.contract.md` § Dry view — *"Use
`Object.create(backlog)` and replace `write`, `writeFile`, and `log` with no-ops"* — and a typed
contract in which no backlog exists.

**The amendment, and the choice the reviewer requires this file to state.** Of the two options
round 5 offers, **option 1 is taken** — and it was taken by `finalize`, not here:
`solution.md` § *Project, configuration and persistence seams* already says *"Core creates
`Object.create(backlog)` and replaces `write`, `writeFile` and `log` with no-ops before placing that
view in the run context."* This entry states it because the reviewer requires the oracle to name the
choice explicitly, and because the contract file still does not carry it. `RunFlowOptions` and
`RunContext` carry
`backlog: Backlog`, and the dry view stays `Object.create(backlog)` verbatim from `engine.js:29-34`.
`RunPersistence` is retained for what it already names and is no longer the only persistence seam.
The dry-view paragraph is unchanged, because it is now true.

**Why option 1 rather than option 2.** Three reasons, in order of weight.

1. **AC-10 makes the mechanism the requirement, not the outcome** — *"preserved as a view, not as
   guards at the call sites … making the database read-only cannot be forgotten"*. Option 1 keeps
   that provable by transcription against `engine.js:29-34`; option 2 substitutes a different
   construction and asks a reviewer to agree it has the same property.
2. **`writeFile` is not this ticket's to skip.** `backlog.ts:193` declares it and `engine.js:276`,
   `:284`, `:289`, `:602` (Q-0052) and `:1015`, `:1060` (Q-0053) call it. Option 2 lands a
   capability that Q-0052 must widen on its first day, which is the *"wrong stream shape is the most
   expensive mistake available here"* risk arriving through the context instead of the stream.
   Option 1 hands the later tickets the whole object and needs no widening.
3. **It ends the two-vocabulary problem** rather than documenting it. The dry section names the
   `Backlog` class's methods (`backlog.ts:83`) and the typed contract names the capability's; a
   reader cannot tell which is normative, and `writeFile` appears in neither.

**Cost accepted:** the engine's context now names a concrete `Backlog` rather than a narrow
capability, which is less injectable than option 2 would have been. That is what the port
preserves — the spike passes the object itself — and narrowing it is a later ticket's argument to
make with a decision entry, not this one's to make in passing.

## E-3 — the routing seam is named, and one file moves the cursor — 2026-08-28

**Supersedes** `run-flow-api.contract.ts:18`'s `runStep` and `handleFail` returning
`Promise<unknown>`.

**The amendment.** The contract declares

    type StepResult = { goto: string; counter: string; limit: number } | { abort: true } | null

and both functions return `Promise<StepResult>`. **`routing.ts` returns the target and never moves
the cursor; `engine.ts` resolves a `goto` into the next index and owns every cursor move**,
including the intra-flow `ctx.vars.iter` increment, cross-flow regression through the target flow's
`consumes` stage, and the preserved unknown-target `findIndex() === -1` TypeError.

**This half is already settled and the erratum only makes the contract agree with it.** `tasks.yaml`
gives `q0050-routing` *"Return targets without resolving the step index or moving the engine
cursor"* and `q0050-engine-compose` *"Resolve StepResult goto targets and move the cursor here
only"*. The task plan is unambiguous; the contract still says `unknown`. Since qa-red writes its
tests against the contracts and not against `tasks.yaml`, the contract is the one that has to say
it.

**Why it is not cosmetic.** That return value is what AC-6, AC-7 and AC-8 all turn on, and
`module-layout.contract.md` promises *"complete named seams, not open objects or `unknown`
placeholders"* — the same discipline round 4's M-2 applied to `RunOutcome`, stopping one boundary
short.

## E-4 — the message oracle gains the four strings the boundary move left behind — 2026-08-28

**Supersedes** `run-messages.fixture.json` as committed at `63d4a6c`, which the QA contract calls
*"the single oracle for exact event and log text"* while omitting four strings this ticket owns.

**The amendment.** Four entries, byte-faithful to the spike:

| key | spike | asserted by |
| --- | --- | --- |
| `log.recordEvent` — `run=<runId> <status> stage=<stage>→<stage> cost=<cost>` | `engine.js:663` | AC-6 |
| `log.start` — `run=<runId> flow=<flow> start stage=<stage>` | `:68` | `nextRunId` scans `run=(\d+)` |
| `gateAutoAdvanced` — `gate: auto-advanced (<kind>)` | `:559` | AC-4(6) |
| `gateDryRun` — `gate (<kind>): would pause here` | `:560` | AC-4(6) |

Verified against the committed fixture at `63d4a6c`: `log` holds `errorSuffix`, `gateAnswer`,
`retryGrant`, `rollback`, `terminal`; `gate` holds `kind`, `reason`, `retry`, `ticketDir`. Round 4's
M-1 is otherwise closed — the four `runs.log` formats, the exhaustion `reason` and the unpriced
plural branch all landed and were checked byte-for-byte.

**The lesson worth keeping, because it is general.** The two gate `info` texts were **Q-0052's**
under the requirement's `ui`→`Event` map. They became **Q-0050's** the moment this solution moved
gate policy into `askGate`. The move is right; its consequence for the oracle was not carried with
it. **A boundary change has to bring its strings across** — and an oracle that calls itself single
while missing four of them is the shape *"a check that skips its subject must not report success"*
(2026-08-25) takes inside a fixture.

---

**Not amended, and deliberately so.** The design half stands as round 5 left it and is not reopened
here: lazy single-consumer stream, lossless FIFO, `answerGate` as an out-of-band callback,
`AbortSignal` cancellation, terminal-event-then-throw, `return()` as the abandonment signal, no
timestamps. Round 5 verified it against the spike rather than against the solution's own account of
it, and resolved OQ-1 (a), OQ-2 (widen the union), OQ-3 (preserve and pin) and OQ-6 (lazy with a
queue) exactly as the merged requirement recommended.

**Still owed before implementation, and no step on this route can write it:** the dated decision
entry covering the event stream, the gate-answer channel, cancellation ownership, the timestamp
refusal and the `signalWindow` timer. Named in `requirements/merged.md`'s pre-run action 2 and again
in round 3's review. It is the precondition-external-to-the-document shape that exhausted Q-0070's
loop at $8.31 and Q-0069's at roughly $12.

**Still blocking the next stage:** Q-0049 is `draft` and `packages/core/src/run-history/` does not
exist. Charter §5 clause 5 says a child whose dependency is not contained does not start its first
run, so `qa-red` and `development` wait on it regardless of this ticket's stage.

## E-5 — four corrections the qa-red loop cannot make for itself — 2026-08-29

**Written during the loop, at the exhaustion gate, on the reviewer's own recommendation** — round 1's
F-6 asked for the first item and round 2's F-5 asked for all four, saying *"write it now, during the
loop, not at the gate."* That is *"a reviewer approves the change it asked for"* (2026-08-29) applied
one step earlier: no qa-red step can write `solution/`, so an obligation named in a review dies unless
a human writes it down. Every claim below was re-measured against the tree before it was written here.

### (a) Q-0050's QA does not test the empty merge error

**Supersedes** `lifecycle-routing.contract.md:96-97`, whose second clause reads *"QA for Q-0050
induces failures only at the two owned branch-head sites and **tests the non-empty subject before the
empty merge-error suffix**."* That half is struck. The first half stands.

**Why.** No file `tasks.yaml` assigns to this ticket consumes `mergeFailure`. The eight tasks own six
engine files, `packages/shared/src/events.ts` and three documents; the merge-error row of the same
table places its consumers in Q-0052 and Q-0053. QA raised this itself and declined to encode it,
which is the correct handling of *a criterion whose subject no task owns* — encoding it would have
burned a development loop on work no agent in it could perform.

**What keeps the behaviour honest meanwhile.** Q-0048's landed
`packages/core/src/fanout/fanout.test.ts:404` — *"a content conflict reports an EMPTY error, because
git wrote its reason to stdout"* — pins it with its `Why: preserved defect` line, and Q-0074 owns the
fix. Nothing is lost by striking the clause; the test that would have been written here would have had
no subject in this ticket's code.

### (b) AC-12e is a freeze check, and has no test file

AC-12e asserts that `lifecycle-routing.contract.md`'s own table names its six subjects. It is a check
on a landed file no task may edit, and all six strings are present today, so it can never be red. It
is recorded as verified once, here, and **no test implements it**.

**This is not bookkeeping.** `docs-q0050.test.ts:9-14` implemented it, and that implementation is what
drags `contracts/Q-0050/**` into `packages/core`'s read set — which `packages/core/turbo.json` does not
declare, so Q-0072's input guard reports it. Deleting the test removes the read.

### (c) AC-13b covers two documents, not three

**Supersedes** AC-13b's three-document list. `docs/03-adapter-contract.md` is removed from it.

**Measured:** that document contains neither `runFlow` nor "event stream" — zero occurrences. AC-13's
own wording is to correct a document *"where it names the stream"*, and this one never does, so the
criterion as tested required it to **acquire** run-loop prose rather than have any claim corrected.
It is a reference for vendor flags and JSONL fields. AC-13b is `docs/04-architecture.md` and
`docs/GLOSSARY.md`.

**And the assertions belong in `packages/shared`.** `packages/shared/turbo.json` already declares
`docs/GLOSSARY.md`, `docs/04-architecture.md` and `docs/03-adapter-contract.md` as inputs, and
`packages/shared/src/docs.test.ts` is already the file asserting over GLOSSARY's **Event** term.
Putting them there needs no `READ_BASES` entry and no `turbo.json` edit — neither of which any task
owns. Any core-side out-of-package read that survives must be registered in **both**
`packages/core/turbo.json` and `turbo-inputs.test.ts`'s `READ_BASES` in the same round.

### (d) the Loaders prose is stale; `(name, harnessDir)` is right

**Supersedes** `lifecycle-routing.contract.md:72`, which reads `loadFlowByName(harnessDir, name)`.

The order is `(name, harnessDir)` — the spike's own at `engine.js:727` and `:734`, what round 5's nit
resolved, what `solution.md` § *Loader argument order* states, and what the typed contract, the stub
and the tests now carry. The prose was left behind when those were corrected at `7a72797`; it is
recorded here so a later reader does not "fix" the code to match the document.

## E-6 — the red phase's own evidence, and two things it cannot show — 2026-08-29

**Written at qa-red's second exhaustion gate, after round 3.** Round 3's review splits its work list
by who can perform each item and puts three under *"Human, at the gate — cannot be produced by any
step on this route"*. These are those three. Every number below was **re-measured by hand** in
`.harness/worktrees/harness__Q-0050__integration` before it was written here, per
*"verify inherited measurements"*; one of the reviewer's figures was wrong and is corrected in (c).

### (a) `prove-red`'s artifact is not sufficient evidence of this ticket's red phase

**The mechanism.** Root `turbo.json` declares `"test": { "dependsOn": ["^test"] }` (Q-0072) and
`@quorum/core` depends on `@quorum/shared`, so `@quorum/core#test` is the only task in the graph with
a dependency and is **pruned whenever `@quorum/shared#test` fails**. AC-13b's test is in
`packages/shared/src/docs.test.ts` — correctly, per E-5(c) — and is red because
`q0050-documentation` has not written the documents yet. So for as long as the red phase is doing its
job, the artifact `prove-red` writes can show nothing about the engine.

Round 2 recorded this as closed because shared happened to be green that round. It was not closed; it
was dormant. **It will recur in development** until the docs task lands, and it is not confined to
this ticket: any red test in an upstream package hides every downstream package's failures, which is
backwards for a red phase.

**No step on this route can fix it.** `commands.test` lives in `harness/harness.yaml` and is governed
by *"The test command defeats its own cache"* (2026-08-27); `qa/red-report.md` is written by
`prove-red`'s `type: integrate` step from raw `testReport` output, not by an agent.

**The evidence it replaces, measured by hand at the gate rather than taken from the review.** In the
integration worktree carrying the merged round-3 tests:

| Measurement | Result |
| --- | --- |
| `packages/core`: `tsc --noEmit` | exit 0 |
| `packages/core`: `vitest run` | **39 failed, 835 passed, 2 skipped** (876 tests, 42 files) |
| failure kinds across those 39 | **34 `AssertionError`, 1 raw stub throw**, 0 transform or import errors |
| `pnpm turbo run test --force --continue` | core 7 files failed *and* shared 1 file failed — both run |
| the same without `--continue` | `5 successful, 6 total`; core never executes |

So the suite **is** red on assertions rather than compile errors, which is the question this step
exists to answer. The engine's four owned behaviours are among the failures by name — the lazy
lossless channel, terminal-then-throw, gate correlation with out-of-band answers, and the
one-traversal retry grant.

**The general defect is a successor, and its body is written out here so the obligation cannot
expire** — *a deferred obligation dies unless it is written into a successor's body*. It still needs
creating as a ticket.

> **Q-00xx — A package's red hides its dependents', so a red phase cannot report itself.**
> `turbo.json`'s `test` task declares `dependsOn: ["^test"]`, which is correct for a green run — a
> dependent's pass is meaningless if its dependency failed — and exactly wrong for a red one, where
> every failure is the deliverable. `harness.yaml`'s `commands.test` is `pnpm turbo run test
> --force` with no `--continue`, so an `integrate` step with `expect: fail` reports a red it cannot
> describe, and one with `expect: pass` is unaffected. Measured on Q-0050 at its qa-red gate: with
> `--continue`, core reports 7 failing files and shared 1; without it, `5 successful, 6 total` and
> core never runs, in 1.1 s against core's 26.75 s forced. **This is Q-0071 inverted** — that ticket
> asked what a green tick was being claimed for; here a red tick claims a suite that never executed,
> and the gate reads it as proof. The fix is not reflexively adding `--continue` everywhere: it
> changes what a failing `integrate` means for every flow, so decide whether `expect: fail` and
> `expect: pass` want different commands, or whether the step should report per-task results rather
> than an exit code. Do not re-derive the numbers from Q-0050's `red-report.md` — it is the artifact
> the defect blinds.

### (b) the message oracle is declared as an input, and the guard could not have told us

`packages/core/turbo.json` now declares `../../contracts/Q-0050/run-messages.fixture.json`. Added by
hand at this gate because **no task in `tasks.yaml` owns that file** and the tests interpolate the
fixture, so without it `@quorum/core#test` could replay a cached pass after the oracle changed —
Q-0072's defect one layer over.

**Verified before and after:** `turbo-inputs.test.ts` reports **6 failures both ways**, so the
declaration closes a hole without moving the guard. Those six are QA's, and round 3's work list items
1 and 2 name their remedies.

**The hole in the guard is real and outlives this ticket.** `engine.test.ts:7` reaches the fixture by
`import … with { type: 'json' }`, and `turbo-inputs.test.ts:1985` excludes module specifiers from its
scan **on purpose** — sound for in-package imports and for workspace dependencies, which
`dependsOn: ["^test"]` hashes, and blind to an import that leaves the package into a non-package
directory. That is a successor for Q-0073's line of work, and this paragraph is its record.

### (c) `q0050-shared-events` has no failing test, and that is stated rather than left silent

`packages/shared/src/events.q0050.test.ts` is **green: 3 tests, 3 passing** — *not* the 15 round 3's
F-1 reports, which counts assertions rather than tests. Re-measured at the gate.

It passes because solutioning already shipped the final schemas in `packages/shared/src/events.ts`:
`gateId`, `gateAnswerEnvelopeSchema` and `runTerminalEventSchema` with the closed regression group.
So AC-2e, AC-3c, AC-3d and the schema half of AC-4c/AC-4d **are satisfied by the executable contract
already on the branch**, and they carry forward as permanent guards rather than as red tests.

**The consequence for the fan-out, stated so nobody discovers it mid-round:** `q0050-shared-events`
has no failing test to turn green, and its own description — *"replace the Q-0050 contract
declarations with the final strict schemas"* — is already satisfied. Its remaining work is whatever
the final schemas still lack, not the schemas themselves. Silence here is the one option that would
leave a reader believing the red phase proved something about that task.

## E-7 — the pruning defect is fixed, not carried — 2026-08-29

**Supersedes** E-6(a)'s successor body and its sentence *"It still needs creating as a ticket."*
There is no successor. The defect it describes was resolved directly, at this gate, in the file that
carried it: `harness/harness.yaml`'s `commands.test` now ends `--force --continue`. See
*"A red tick names what failed, not what was skipped"* (2026-08-29). E-6(a)'s **measurements stand
unchanged** and remain this ticket's red-phase evidence; only its disposition is superseded.

**Why it could be closed rather than carried.** The measurement was already in hand, the fix is one
flag in one file, and — the deciding fact — **turbo still exits non-zero with `--continue`**, so no
`expect: pass` or `expect: fail` verdict changes anywhere. Verified on turbo 2.10.11 against a tree
with two failing packages: exit 1 with the flag and without it. A change that alters only what a
report contains, and never what a step decides, does not need a ticket to be made safe.

**It does not affect run 3, and QA should not expect it to.** `runFlow` stores `config` at run start
and never re-reads it, so round 4's `prove-red` runs the *old* command and its `red-report.md` will
again show only `@quorum/shared` failing, with `@quorum/core#test` pruned. **That is expected and is
not a round-4 defect.** E-6(a)'s hand-measured table is the red-phase evidence for this ticket, and
it stays the evidence; the first artifact to benefit from the fix is a later run's. This is the same
ordering trap Q-0065's own `integrate` fell into, named here so it is not rediscovered.

**Nothing in the round-4 work list changes.** Items 1 and 2 — routing `q0050.source.test.ts`'s reads
through `test/corpus.ts`'s `repoFile()`, moving AC-13c into `packages/shared`, and registering
`engine.test.ts`'s temp-repo `harness/harness.yaml` — are still the six guard failures' remedy, and
they are still QA's. `--continue` makes a red phase *describable*; it does not make an unsatisfiable
assertion satisfiable.

## E-8 — the five load-bearing tests, written by hand, and the eight struck — 2026-08-29

**Written at qa-red's third exhaustion gate**, after round 4 returned `revise` having added no
tests — 37 before, 37 after. Rounds 3 and 4 both named the same five as the ones they would not let
through; neither round produced them. They are now in the tree, and the eight remaining scenarios
are struck rather than left as a table row promising coverage that does not exist.

### Why the loop could not write them, which is a fact about the ticket and not about the writer

All five need a step to **fail**, and at this ticket's boundary nothing can. `runStep` dispatches
agent, script, integrate and fan-out steps to Q-0052 and Q-0053; the only kind Q-0050 owns end to
end is the gate, and an author-declared gate returns `null` or `{ abort: true }` — it carries no
retry target, so it can never return a goto. Only the exhaustion gate does, and it is reached from
`handleFail`, which is called from the step kinds this ticket does not own.

So the observable surface of AC-8b/8c/8d and AC-12d is not "a step fails" but **`engine.ts` acting
on a `StepResult`**, which E-3 makes its sole responsibility. The tests stub `routing.runStep` to
return one result and assert what `engine.ts` does with it: nothing about how the result was
produced, which is the half that belongs to a later ticket. That seam is stated in the test file so
the next reader does not mistake it for convenience.

### The five

| Criterion | Test | What it pins |
| --- | --- | --- |
| AC-8b | `engine.test.ts` | the `crossFlowRegression` warn interpolated from the fixture, and all seven regression fields asserted as one object so a partial payload fails |
| AC-8c | `engine.test.ts` | an absent target flow fails naming it, and the **stage** does not move |
| AC-8d | `engine.test.ts` | `remaining` is 0 when the counter has passed the limit — constructed at count 3, limit 2, where an unclamped subtraction reports −1 |
| AC-12c | `lifecycle-routing.test.ts` | the same gate step asks at the top level and does **not** ask nested in a `parallel` group |
| AC-12d | `engine.test.ts` | a goto naming no step throws a raw `TypeError`, not a `FlowError` |

All five are red on assertions, `tsc --noEmit` clean. The engine folder goes from 37 tests to 42 and
from 33 failures to 38.

**AC-12c is written as a pair, deliberately.** A lone *"`answerGate` was not called"* passes against
a stub that throws before reaching anything, and would keep passing if the dispatch were deleted
altogether — *"a check that skips its subject must not report success"* (2026-08-25) inside a
negative assertion. Running the same member both ways makes the difference the subject.

### AC-8c's scenario contains an unsatisfiable clause, and the test does not implement it

**Supersedes** the AC-8c scenario's *"the ticket's stage on disk is unchanged (byte-identical
`ticket.md` before and after)"*.

`finish` calls `backlog.write(ticket)` on **every** terminal status and appends a history entry
before it (`engine.js:634`, `:648`), so a failed run necessarily rewrites `ticket.md`. What a
failure leaves alone is the **stage** — only `completed` and `regressed` move it (`:622-624`). The
test asserts the stage and the appended `failed` entry instead. Written as specified it would have
been a sixth unsatisfiable assertion, in the round that existed to remove them.

### The eight struck, with the reason each is struck

Marked `— none (struck, E-8)` in `qa/scenarios.md`'s traceability table rather than left naming a
test that does not exist. Two groups, and the distinction matters:

**Blocked by the same boundary as the five, without the five's payoff.** AC-2b (the engine adds the
step id and nothing else), AC-2f (a failed step emits no `done`), AC-5a (a step throws) and AC-9e (a
run-history initialisation failure) all require a real step to run or fail. Each could be written
against a stubbed `runStep` like the five, but each would then assert on the stub rather than on the
enrichment or the failure path it names — a test of the harness. They belong to Q-0052, whose step
implementations give them a subject.

**Not red-phase material.** AC-2c (no cross-member order in a `parallel` group) asserts the
*absence* of a guarantee; there is no failing form of it. AC-5b (cancelled mid-step) needs a step
long enough to cancel, which is Q-0052's. AC-5e (listener count across ten runs) is a property of
`core` installing no signal handler, already pinned by `q0050.source.test.ts`'s negative scan, and a
ten-run loop would measure the harness. AC-10d (the `Object.create` view identity built by
`engine.ts`) is covered behaviourally by AC-10a/10b/10c's on-disk and spy assertions, which is the
property AC-10 actually names; asserting the prototype identity pins a construction rather than the
read-only boundary.

**What this costs, stated rather than implied.** The red phase pins 24 of 37 behaviours. Cross-flow
regression and the two preserved defects are covered — they were the ones with money behind them.
Step-id enrichment, the failed-step `done` suppression, cancellation and run-history initialisation
failure enter Q-0052 **unpinned**, and that ticket's requirement should carry them as criteria
rather than rediscover them.

## E-9 — the documentation task loses a document, because development cannot read this file — 2026-08-29

**Supersedes** `solution/tasks.yaml`'s `q0050-documentation` description, which owned
`docs/03-adapter-contract.md` alongside the other two. It now owns
`docs/04-architecture.md` and `docs/GLOSSARY.md` only, and its description carries E-5(c)'s reason
and names its failing test.

**Why the correction had to be made in `tasks.yaml` rather than left here.**
`harness/flows/development.yaml`'s fan-out reads `solution/solution.md` and `review/verdict.md`;
**it does not read `solution/errata.md`.** Only `qa-red.yaml` (`:10`, `:23`) and `chore.yaml`
(`:13`, `:31`) do. So every ruling in this file — E-5(c) among them — is invisible to the eight
implement tasks, and a task description is the one artifact the fan-out interpolates verbatim.

Without the edit, `q0050-documentation` would have added run-loop prose to a document E-5(c) ruled
has nothing to correct: it contains neither `runFlow` nor "event stream", measured at zero
occurrences, and `packages/shared/src/docs.test.ts` asserts over two documents, not three. Nothing
would have failed — which is the point. It would have been a silent contradiction of a landed
ruling, found later by a reviewer or not at all.

**The general gap is real and is deliberately not fixed here.** `development.yaml` and `review.yaml`
naming no errata input is a change to `harness/flows/`, and Q-0050's own pre-run action 6 says that
is not this ticket's to make. It is worth making: ten tickets have needed an erratum, and on this
route the two stages that *write code* are the two that cannot read one. Recorded so the next flow
change has the evidence rather than the anecdote.

## E-10 — `writesOf` concatenates: AC-11 stated an ordering and the red phase read it as a precedence — 2026-08-29

**Supersedes three statements and one landed test**, all saying the same wrong thing in four
places:

- **AC-11** (`requirements/merged.md:214`) — *"`writesOf` returns `output.write` before
  `output.writes` and invents no path."* The clause stands, read as what it says: an **ordering**
  of a concatenation, singular first.
- **`qa/scenarios.md:371`** (AC-11f) — *"returns the singular `output.write` when present, **ahead
  of** the plural `output.writes`"*, which is the same ordering; and its test, which is not.
- **`contracts/Q-0050/lifecycle-routing.contract.md:77`** — *"`writesOf` **prefers** singular
  `output.write` over plural `output.writes`."* This one is unambiguous and is struck. `prefers`
  is replaced by *"returns `output.write` first, then `output.writes` in order"*.
- **`packages/core/src/engine/loaders.test.ts:47`**, which asserted
  `writesOf({ output: { write: 'one', writes: ['two'] } })` is `['one']` — the pin that made the
  deviation load-bearing.

`contracts/Q-0050/run-flow-api.contract.ts:28` declares the signature only and needs no change.

**The rule is concatenation, and it is stated in three landed places that all agree.** Measured
against the tree rather than argued:

| site | text |
| --- | --- |
| `spike/src/engine.js:739` | `[...(o.write ? [o.write] : []), ...(o.writes ?? [])]` |
| `packages/core/src/lint/lint.ts:84-87` | the same expression, with the rule in its JSDoc |
| `packages/shared/src/step-output.ts:33` | *"`writesOf` takes `write` **and** `writes` (spike/src/engine.js:739)"* |

Charter §2 gives this ticket one authorised behaviour change and it is spent on the event stream, so
the port had no licence to make a second one here. The corrected `loaders.ts` JSDoc is now the same
sentence as `lint.ts`'s, deliberately — two functions computing one rule should not describe it in
two voices.

**Why an erratum rather than a revise round.** Round 1's B-1 is correct and the remedy is three
lines, but one of them **deletes an assertion** in a test file no development task may write, and
the reading it corrects is the requirement's. A revise round could have changed `loaders.ts` and
would then have failed its own qa-red pin — the loop spending its budget on work no agent in it can
perform, for the seventh time. E-5(d) is the precedent and the route is the same: rule it here,
change it by hand.

**Nothing failed today, and that is the finding rather than the excuse.** Every shipped flow step
declares `write:` or `writes:`, never both — checked across all six files in `harness/flows/`, where
`requirements`, `solutioning` and `qa-red` use the singular and `development`, `chore` and `review`
the plural. So the deviation was invisible to every gate: eight implement tasks, an `integrate`, a
forced suite and a two-vendor review panel all reported green over it. The failure mode when a step
does declare both is a missing artifact and no message, while `lint.ts`'s producer map still believes
both are produced — so the single-owner and cross-vendor rules would be computed over a set the
engine no longer honours. That is what `.claude/rules/engineering.md` means by *never default
silently*.

**One correction to the verdict that raised it.** B-1 names `run-flow-api.contract.ts` as declaring
*"only the signature, not the rule"* — true of that file, and it led the finding to report three
disagreeing sites when there were four. `lifecycle-routing.contract.md:77` states the precedence
outright, and it is a contract file qa-red reads. Had the fix been made from the verdict alone, the
contract would have been left contradicting the code, for a later ticket to cite against it. The
reviewer read the typed contract and not its prose sibling; both are `contracts/Q-0050/**` and both
are frozen to this ticket.

**Landed by hand**, in `packages/core/src/engine/loaders.ts` (the expression and its JSDoc at `:51`),
`packages/core/src/engine/loaders.test.ts` (the pin replaced by five assertions covering both keys,
each key alone, and neither), and `contracts/Q-0050/lifecycle-routing.contract.md:77`. Verified
forced on `harness/Q-0050/integration`: 7/7 packages, **0 cached**, 879 passed and 2 skipped.

## E-11 — `loadRole` returns the frontmatter wrapper, and the contract said `Role` — 2026-08-29

**Supersedes** `contracts/Q-0050/run-flow-api.contract.ts:26`, which declared
`loadRole(name, harnessDir): Role`. It is `Frontmatter` — the `{ meta, body }` wrapper
`parseFrontmatter` returns, exported from `packages/core/src/backlog/backlog.ts:24`.

**Why the contract is the thing that was wrong.** `Role` (`packages/shared/src/role.ts`) is a role
file's *frontmatter fields*; what the loader returns is the wrapper around them, whose `meta` is
deliberately `unknown` because `parseFrontmatter` is also the ticket reader and validates nothing
(Q-0043 AC-4). The two shapes do not structurally overlap, so honouring the declaration cost two
`as unknown as` casts — the evasion `.claude/rules/engineering.md` bans under `any` and
`@ts-ignore` — and handed every caller a type carrying neither the `.meta` nor the `.body` it
reads. `resolveModel` reads `role.meta?.adapter` and `buildPrompt` reads `role.body`
(`spike/src/engine.js:668-675`, `:709`); on the declared type both are errors, so Q-0052 would have
cast a third time on its first day.

**The implementer's handling was right and its route was not.** Following a contract it may not edit
is correct — no task owns `contracts/**`. But the knowledge went into a twelve-line JSDoc ending
*"Flagged for the contract to name the wrapper type explicitly"*, and a comment is not a route.
E-5(d) had shown the route two days earlier on this same ticket: an obligation named in a source
comment dies there, one written into this file binds. That is the general lesson and it is worth
more than the type.

## E-12 — the terminal rejection carries what was thrown, not a `FlowError` — 2026-08-29

**Supersedes** `contracts/Q-0050/run-events.contract.md:76-77` — *"the next pull after that value
rejects with `FlowError`; the failure cause is non-empty."* The rejection carries **whatever the run
threw, unwrapped**. The non-empty-cause half stands.

**The code is right and the contract is wrong**, which is the unusual direction and the reason this
is an erratum rather than a fix. Two landed criteria require exactly this: AC-11 preserves
`loadFlowByName`'s raw `ENOENT` as *"the one loader that does not produce a `FlowError`"*, and
AC-12 preserves the unknown-goto `TypeError`. E-8 then wrote the pin —
`engine.test.ts`'s *"AC-12d — a goto naming no step throws a raw TypeError, not a FlowError"*
asserts `toBeInstanceOf(TypeError)` on the iterator's own rejection. Wrapping ordinary failures
would fail a landed acceptance test and close two preserved defects in passing, which charter §2
forbids.

Round 1's codex reviewer asked for the wrapping as a major; the verdict reduced it to a nit against
the contract, and this entry is that nit closed. The sentence is corrected **before** a later ticket
cites it against the code, which is the whole value of writing it down now rather than at the
cutover.

## E-13 — two capabilities the round-1 fixes add to the contracted context — 2026-08-29

**Amends** `contracts/Q-0050/run-flow-api.contract.ts:13` and `:20`, additively. Both members are
new; nothing declared there is removed or retyped.

- **`RoutingContext.nextGateId(): string`** — B-2. Gate ids were sequenced from a
  `WeakMap<RoutingContext, number>` while `engine.ts` builds a fresh context per step and per
  re-entry, so every step's first gate was `<runId>:1`. Allocation moves to a run-scoped capability,
  which is how every other seam on that interface already works. The alternative — carrying a
  mutable counter object through the per-step spread — works and hides the run-scoping inside a
  shared reference; a named capability says it.
- **`RunPersistence.registerOccurrence(occurrence: Occurrence): void`** — M-3. `finaliseActiveOccurrences`
  closed over a set nothing could add to, so it was a permanent no-op with no seam for the ticket
  that would need it. Q-0050 allocates no occurrence and therefore calls this nowhere; it is added
  now because the same round that taught the finaliser to derive a category is the round that should
  give it something to finalise. Q-0052 otherwise discovers both.

**What is *not* amended, deliberately.** `finaliseActiveOccurrences`' signature is unchanged. Its
`cause` is now the failure in full rather than `note ?? status` — the 200-character first line
belongs to `runs.log` and an occurrence's `error.message` is what a manifest reader has — and the
call moved from `finish` into `engine.ts`'s catch, where the raw error still exists. Both are
preservation: `spike/src/engine.js:161-168` finalises in the catch with `String(e.message ?? e)`
before calling `finish`, AC-5 states that order in as many words, and
`lifecycle-routing.contract.md:28` already reads *"first finalise active occurrences, then persist
counters and the terminal record"*.

## E-14 — `finaliseManifest` joins the persistence seam, so the manifest is written where the spike writes it — 2026-08-29

**Amends** `contracts/Q-0050/run-flow-api.contract.ts:14` additively:
`RunPersistence.finaliseManifest(status: RunStatus, stageAfter: string): void`. On the E-13
precedent; nothing declared there is removed or retyped.

**Why a capability rather than the three-line remedy the review offered.** Round 2's M-1 proposed
recomputing the stage inside `finishRun` and finalising before delegating to `finish`. That works
and costs a second copy of `finish`'s own stage rule — `status === 'completed' || status ===
'regressed'` — in a file that does not own it, which two later readers must keep in agreement.
`spike/src/engine.js:625-632` puts the call **inside** `finish`, between the stage assignment and
the history push, and the capability is what lets the port put it in the same place. One rule, one
site.

**What the position is for.** Everything below it emits or writes, and `replaceManifest`'s failure
is reported non-fatally through the run-history host, which `engine.ts` wires to `emit({ type:
'warn' })`. Finalising after `finish` returned put that warning **behind** the terminal event AC-3
requires to be last, and left a window — sub-millisecond in process, a socket wide in M3 — in which
a consumer acting on `{status: 'completed'}` reads a manifest still saying `running`. Q-0049's own
JSDoc calls that pairing *"the lifecycle contradiction this subsystem exists to make impossible"*.

Pinned by invocation order rather than by reading the source, because the whole defect was one
`await` too late: `lifecycle.test.ts` asserts `finaliseManifest` is called with the stage the ticket
was left at, and before both `writeTicket` and the first `emit`.

## E-15 — an abandonment after a committed terminal status does not retract it — 2026-08-29

**Adds** one clause to `contracts/Q-0050/run-events.contract.md`'s stream section. Nothing is
superseded; the sentence was simply absent.

`finish` runs to completion synchronously — it is `async` and contains no `await` — so a flow with
no suspension point persists its whole terminal record during the producer's first turn, before the
first `next()` resolves. `return()` then aborts a run that has already ended, and the record keeps
the status the run actually reached.

**This is a clause, not a change.** Round 2's codex reviewer raised it as a blocker whose remedy was
to couple terminal commitment to delivery state; the verdict demoted it, and the demotion is right
on both counts. That coupling is the rejected alternative *"execution entirely inside each pull"*,
ruled at solutioning and contracted — a reviewer may not reverse a ruled design, which is what this
file is for. And it would make the durable record lie: a run that executed every step, invoked
adapters, spent money and merged branches would persist as `interrupted` because its consumer
stopped reading. **A status describes what happened, not who was still watching.**

What was genuinely missing is the sentence, and AC-12's own rule is why it is worth writing:
*an unstated answer is what lets the next reader assume the question was considered.*

## E-16 — the interrupted note comes from `AbortSignal.reason` — 2026-08-29

**Interprets** AC-5's *"The persisted record is byte-identical to today's (`interrupted`, note
`received SIGINT`)"*, which the port could not meet as written.

`core` installs no signal handler and calls `process.exit` nowhere — AC-5 requires that in the same
breath, and charter §7 gives process-exit behaviour to the CLI — so nothing in this folder knows the
signal's name. The clause is met by the caller supplying it: `runFlow` reads `AbortSignal.reason`
when it is a non-empty string and records it as the note, falling back to the thrown message when
the caller aborted without one, which is what the stream's own abandonment does. Q-0010's CLI calls
`abort('received SIGINT')` and the byte-identical record follows.

**The alternative was to rule the clause unattainable** and record what the note carries instead.
Rejected because `reason` is the platform's own mechanism for exactly this question, it is read
nowhere in the folder today, and a daemon cancelling a run for a different cause — a budget cap, a
user pressing stop in M3's UI — wants to say so in the record. Ruling it unattainable would have
closed that off to buy nothing.

Round 2's M-3 also found the half that was a plain defect and is fixed rather than interpreted: the
occurrence category. The port applied the run catch's kind-derived category to the interrupted path
as well, where `spike/src/engine.js:58-61` writes `interrupted` flat — which left
`ErrorCategory`'s `interrupted` member with **no producer anywhere in `core`**. `categoryOf` now
takes the status. Round 1's M-3 was right that the failed path must derive; it overshot by one path.

## E-17 — the short-circuit sentence is corrected, not the allocation — 2026-08-29

**Supersedes** `solution/solution.md`'s *"Automatic and dry short-circuits run before a question is
allocated."* They do not. `runStep` and `handleFail` build the whole `GateQuestionEvent`, `gateId`
included, and hand it to `askGate`, which evaluates `auto`, `--auto` and `dry` after that. A gate
that is never asked spends an id.

**The document is what changes, and the reasoning is worth more than the nit.** Making the code
match would move allocation inside `askGate`, past the short-circuits — which means `askGate` can no
longer take a fully-formed `GateQuestionEvent`, because that type requires `gateId`. So a cosmetic
gap in an opaque, run-scoped correlation token would cost a signature change to the one gate-policy
primitive, in a contract two other tickets code against. Not worth it.

`engine.test.ts`'s `['1:2', '1:3']` pin already documents the skip in as many words — the auto gate
spends `1:1` and `askGate` short-circuits before emitting it — so the behaviour is stated where a
reader meets it. What was wrong was a sentence in `solution.md` claiming otherwise, and it is
corrected here rather than left to contradict the pin.

## E-18 — the terminal event carries the rounded cost, and AC-3's "equal to `finish()`'s values" is bounded by it — 2026-08-29

**Bounds** AC-3's *Test:* clause requiring the terminal event's fields to be *"equal to `finish()`'s
values for the same run"*. On `cost` they differ, deliberately, and nothing said so.

`lifecycle.ts:57` puts `roundedCost` on the terminal event; `:65` and `:67` return
`context.stats.cost` raw on the outcome. **The event is rounded.** That is the defensible half of
the pair: the terminal `info` line a human reads and the `TicketHistoryEntry` that lands in
frontmatter are both rounded, and an event that disagreed with both would be the odd one out. The
raw figure stays on the returned outcome, where a caller doing arithmetic wants it.

**Why this needed writing down rather than fixing.** Nothing caught the divergence because every
engine-level test runs at `stats.cost === 0`, where rounded and raw are the same number — so the
criterion was green over a value it never varied. Worse, the AC-9f row I wrote at this ticket's own
coverage audit on 2026-08-29 said the opposite — *"the payload and terminal event carry the raw
`1.23456`"* — while the test written to satisfy that row correctly asserts `1.235` on the event. The
row contradicted both the code and its own test, and a reader trusting the row would have "fixed"
the code to match it. The row is corrected in the same change.

This is the *"unstated decision"* shape this ticket's own risk section names, arriving in the
coverage record rather than in the source: a divergence pinned by a passing test with no sentence
saying it was chosen.

## E-19 — an unparseable gate answer is refused, not silently treated as `abort` — 2026-08-29

**Supersedes** AC-4d: *"an envelope's `answer` field is a string outside `advance | retry | abort`
… the run treats it as `{ abort: true }` — preserving `:590`'s behaviour."*

It does not, and should not. `askGate` validates the envelope with `gateAnswerEnvelopeSchema`
(`packages/shared/src/events.ts:195`, a strict object over a three-value enum) and throws a
`FlowError` naming the gate. The spike had no envelope: `runGate` took whatever `ctx.ui.gate`
returned and fell through `advance` and `retry` to `return { abort: true }`
(`spike/src/engine.js:590`), so an unrecognised answer *silently ended the run*.

**The code is right and the criterion is superseded**, for the reason AC-4d itself gives and then
argues past. It notes that `core` is now *"a reachable second consumer beside the CLI's exact-match
validation"* — which is the argument **against** preserving the fall-through, not for it. The CLI
validated exactly because a typo must not be actionable; `core` taking an unvalidated string and
choosing the most destructive of the three answers would abort a run that had proven work behind it,
on a malformed message from a socket. *Errors are explicit* and *never default silently* both point
one way here, and the landed decision *"What a run's event stream carries, and how a gate answer
travels back"* (2026-08-28) is what introduced the envelope this validates.

**Recorded because a passing test was pinning an unruled divergence.** `lifecycle-routing.test.ts`'s
*"no channel, stale correlation and invalid runtime answers fail by name"* asserts the throw — so
the criterion said one thing, the code did another, the suite ratified the code, and nothing said
which was intended. That is the third instance of this exact shape on this ticket (E-18 on AC-9f's
cost, E-17 on the short-circuit sentence), and all three were found by reading the criterion against
the code rather than by a failing test, because a test written from the code can never find it.

## E-20 — AC-13d's prose says eight preserved defects; its own enumeration says seven, and seven is right — 2026-08-29

**Corrects** AC-13d's opening — *"Given the **eight** preserved-defect sites across this ticket's
code"* — against its own next sentence, which enumerates *"(AC-4h, AC-10c, AC-10f,
AC-12a/b/c/d)"*. That list has **seven** members and it is the accurate one. Counted in the tree:
`routing.ts:25` (AC-4h) and `:62` (AC-12c); `engine.ts:131` (AC-10f), `:171` (AC-12a) and `:226`
(AC-12d); `lifecycle.ts:19` (AC-10c) and `:36` (AC-12b).

**The count was never the real defect.** Codex's round-4 review found the mismatch and, chasing it,
the register's scan turned out to be the weaker half: it matched `Why: preserved **defect**` only,
so **three markers in the same folder were invisible to it** — `engine.ts:35` (`preserved design`,
Q-0034's), `engine.ts:218` (`preserved behaviour`) and `routing.ts:126` (`preserved behavior`). Two
of those three spell the same word differently from each other. A register that pinned seven
identities therefore read as complete while sitting beside three sites it could never see, which is
Q-0070's `fs.rmSync` lesson exactly: *a scan that cannot see the surface it bounds is worse than no
scan.* The register now covers every `Why: preserved <kind>` marker with its kind and authority —
ten in total, seven of them `defect/`.

**And the "reproduces no sentence" half is now the scan the criterion asked for**, not the
120-character length proxy that stood in for it after round 3. Codex's objection to the proxy is
upheld in full: *any short copied sentence passes it*. The scan compares every authority line
against every sentence of forty characters or more in `docs/DECISIONS.md` and this ticket's
`ticket.md` — both already declared inputs of `@quorum/core#test`, so it needed no new route
through Q-0072's guard, which is why the earlier claim that it did was wrong. It carries a
non-empty-corpus assertion, because a scan over zero sentences reports success over nothing
(*"a check that skips its subject must not report success"*, 2026-08-25), and it was demonstrated
red by pasting `DECISIONS.md`'s own *"Every decision and why, append-only, newest last."* onto an
authority line before it was trusted.

## E-21 — `interpolate` does not coerce, and the obligation is here rather than in a comment — 2026-08-29

**Supersedes** nothing in the requirement; it records a deliberate divergence from
`spike/src/engine.js:740`, which is `String(s).replace(…)`.

The port types the parameter `template: string` and performs no coercion. The spike's call sites
interpolate values that came out of YAML — `step.run`, `step.branch`, `s.into`, `site.input.diff` —
and YAML hands back a **number** for `branch: 2`. So the coercion was doing work.

**The divergence is the right one and it changes who owns the problem.** With the parameter typed,
a number-valued call site is a **compile error in Q-0051 and Q-0052** rather than the spike's silent
runtime pass-through. That is the port turning a latent defect into a build failure, which is what a
type system is for. What it costs: a step shape typed `Record<string, unknown>` will need
`String(step.run)` written deliberately at each site.

**Why this is an erratum and not the JSDoc line it started as.** Round 3's N-1 was closed by adding
a JSDoc paragraph on `interpolate` addressed to Q-0051 and Q-0052. Round 4 pointed out that this is
E-11's own finding repeated — *a comment is not a route*. Q-0052's implementer reads
`solution/errata.md` (`qa-red.yaml:10`, `:23`) and its own requirement; it does not read the JSDoc of
a function it is about to call for the first time. The obligation is written here so that ticket's
requirement can carry it as a criterion, which is the same handling E-8 gave the unpinned
`step`/`done` obligation. The JSDoc stays — it is useful where it is — but it is no longer the only
record.

## E-22 — `registerOccurrence` has no reachable caller, and that is recorded rather than fixed — 2026-08-29

**Amends** E-13's account of what adding `RunPersistence.registerOccurrence` bought. The member is
sound and its JSDoc is honest — it says outright that Q-0050 allocates no occurrence — but round 6
established something E-13 did not: **nobody can call it.**

`history` is a local in `run()`; it is on none of `RunContext`, `RoutingContext` or
`RunPersistence`, and `RunHistory.allocate` is the only producer of an `Occurrence`. So no caller
inside this ticket *or outside it* can obtain the argument the seam takes. Q-0052 must widen the
capability on its first day regardless — which is exactly the cost E-13 added the member to avoid.

**It stays as it is, and the reason is a rule this ticket has now broken twice.** Widening the seam
to `allocateOccurrence(step, kind, fields)` is the right shape and it is **Q-0052's design to make**:
it decides where an occurrence is allocated, and a capability shaped for it in advance by a ticket
that allocates none is a guess with a compiler behind it. Round 6's panel reached the same place from
the other side — its own argument is that Q-0052 will *probably* register inside its allocate
capability, and "probably" is not a basis for freezing an interface two tickets ahead.

**What Q-0052's requirement must carry**, so this does not have to be rediscovered: the seam as
shipped cannot be reached, and the round that allocates the first occurrence widens it in the same
change. This is E-8's handling of the unpinned `step`/`done` obligation applied to a capability
rather than to a test.
