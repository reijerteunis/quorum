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
