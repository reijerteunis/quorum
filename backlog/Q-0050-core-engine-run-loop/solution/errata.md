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

**The amendment, and this is the choice the reviewer requires this file to state.** Of the two
options round 5 offers, **option 1 is taken**: `RunFlowOptions` and `RunContext` carry
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
| `gate.autoAdvanced` — `gate: auto-advanced (<kind>)` | `:559` | AC-4(6) |
| `gate.dryRun` — `gate (<kind>): would pause here` | `:560` | AC-4(6) |

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
