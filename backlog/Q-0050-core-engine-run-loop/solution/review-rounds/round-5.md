# Architecture review — Q-0050 solution, round 5

*architecture-reviewer · 2026-08-28 · verdict: **revise** · 2 blockers, 2 majors, 3 nits*

Round 4's four findings are closed, and closed properly rather than papered over. The verdict is
`revise` for two defects of the **same class** round 4's closing paragraph named — *"the typed
contract was written from the intended API rather than checked against the spike's actual
signatures"* — surviving one layer up. Round 4 corrected the function signatures. Nobody has yet
checked the **run context** against `engine.js:37-45`, and two members the spike's context carries
are absent from every contracted type.

Both are mechanical. Neither is a redesign. See the closing section on how to spend the round.

## What is right, and should not be re-litigated

- **The four round-four findings are genuinely closed.** I checked each against the spike rather
  than against the resolution table. `outcome(ctx, before, after, status, cost)` now returns
  `TicketHistoryEntry` with `run` and the duplicated `stage`/`stage_after` (`engine.js:655-657`);
  `finish(ctx, stage, status, note, fields)` has its target stage and note back (`:618`);
  `packages/shared/src/events.ts` has a real stub; `RunOutcome` and `RegressionFields` are a closed
  discriminated union with the index signatures gone.
- **The terminal schema works, and I ran it.** `z.discriminatedUnion('type', […])` accepting a
  nested `z.discriminatedUnion('status', […])` as an option is not obvious and would have failed
  under zod 3. Executed inside `packages/shared` against the installed **zod 4.4.3**: the outer
  union constructs, both variants parse, an unknown key is rejected, a partial regression payload is
  rejected, and the existing members still parse. AC-3's schema half is testable today. **A later
  reviewer should not reopen this** — the contract's warning against two flat `type: 'terminal'`
  options is correct and the committed shape is the working one.
- **The design decisions are the right ones and match the requirement's recommendations.** Lazy
  single-consumer iterable with a lossless FIFO (OQ-6), `answerGate` callback keeping
  `runFlow(opts): AsyncIterable<Event>` literally true (OQ-1(a)), terminal event rather than a
  generator return (OQ-2), caller-owned `AbortSignal` with no `process.exit` and no signal listener
  (AC-5), `signalWindow` preserved and pinned (OQ-3). The rejected-alternatives section argues each
  one on the mechanism rather than on taste.
- **The `dev/implement-report.md` impossibility is handled correctly, and I verified the premise.**
  `dev/implement-report.md` is written only by `chore.yaml:16`; `development.yaml`'s fan-out step
  declares no `output` and `integrate` writes `dev/integration.md` and `dev/green-report.md`. So
  AC-12's report clause names a surface this route cannot write. Redirecting the durable enumeration
  into `lifecycle-routing.contract.md`, forbidding the assertion in the QA contract, and routing the
  amendment to `solution/errata.md` is exactly right — this is *"a requirement may not name a
  surface its flow cannot write"* (2026-08-25) caught by the architect rather than by a burnt loop.
- **The `askGate` boundary move is now routed.** Round 4's nit is closed: the handoff is in the
  gate conditions and in the lifecycle contract. The reasoning is sound — AC-4's `auto`/`--auto`/
  `--dry`/`human-locked` clauses need one owner and the requirement tests them here.
- **The fan-out is valid and cross-vendor.** `backend` and `tooling` resolve to
  `developer-backend.md` (codex) and `developer-tooling.md` (claude) via `development.yaml`'s
  `role: "developer-{role}"`; both may write `packages/core/` and `packages/shared/`. Wave 1 holds
  `q0050-shared-events` (backend) and `q0050-loaders` (tooling), so the split is real. The note that
  the solutioning prompt's `frontend|backend|data` list cannot serve this surface is correct and
  matches Q-0011's and Q-0033's precedent.
- **The barrel and the byte-pins are respected.** `packages/core/src/index.ts` is untouched, which
  `backlog.source.test.ts:117` and `index.test.ts` pin. I also checked the four landed whole-corpus
  scans — no-zod, no-`z.object(`, no-spike-import, single-`execSync` — against the committed stubs:
  **all four still pass**, so `merge-contracts` does not land a red house rule on qa-red's base.

## Blockers

### B-1 — The contracted context carries no project config, so `vars.base` has no source and the mock adapter cannot be selected

`run-flow-api.contract.ts` and the committed `types.ts` declare:

```ts
export interface RunFlowOptions { ticket; flow; repoDir; harnessDir; dry?; auto?; answerGate?; signal? }
export interface RunContext { ticket; flow; repoDir; harnessDir; runId; counters; vars; stats;
                              dry; auto; emit; answerGate?; signal?; persistence }
```

The spike's is `runFlow({ flow, ticket, backlog, harnessDir, repoDir, config, ui, auto, dry })`
(`engine.js:37`). **`config` is gone, and it is load-bearing inside this ticket's own ported lines.**

- `engine.js:45` — `vars: { id, iter: 1, base: config.repo?.base_branch ?? 'main', round }`. Context
  construction is `q0050-engine-compose`'s. With no `config` on `RunFlowOptions` there is nothing to
  read `base` from. The implementer's only options are to invent an option in a file another task
  owns, or to hardcode `'main'` — which silently breaks every `{base}...` diff range downstream.
- **`config.adapterOverride` cannot be re-derived.** `harness.js:608` sets
  `proj.config.adapterOverride = flags.adapter` on the *loaded* config, and `engine.js:204` reads it.
  So `loadProject(repoDir)` inside `runFlow` is not a substitute — the value never existed on disk.
  This is the sharp edge: **AC-2's own test is *"one run over a mock-adapter fixture flow"***, and
  the contracted `RunFlowOptions` gives QA no way to ask for the mock adapter. The project's
  regression suite is the mock-adapter end-to-end suite; as contracted, it cannot be driven.
- Three more consumers of `ctx.config` are the seam the requirement says five tickets code against:
  `cmdTimeout` (`:497`), `config.repo?.max_diff_bytes` (`:831`, Q-0051), `config.commands?.test`
  (`:1031`, Q-0053). `module-layout.contract.md` claims *"`RoutingContext` and `LifecycleContext`
  are complete named seams"*. They are not complete; they are missing the member every later engine
  ticket reads.

**Why this is a blocker and not a major.** The fix belongs in `packages/core/src/engine/types.ts`,
owned by `q0050-engine-types` in wave 2. `q0050-engine-compose` (wave 4) is where the gap surfaces,
and its own description says *"report a violation in another owner's file instead of editing it"*.
So the discovering task cannot fix it, the owning task has already finished, and the development
loop spends its three iterations learning that — the exact failure the scenario gate exists to
catch. **This is the "fix lies in a file no task owns" shape, and it wants an owner.**

**Remedy.** Add `project: Project` to `RunFlowOptions` and `config: ProjectConfig` to `RunContext`
(`packages/core/src/backlog/project.ts:40` already declares `Project` as `{ repoDir, harnessDir,
config }`, which also collapses the duplicated directory fields), and state in
`lifecycle-routing.contract.md` that `vars.base` comes from `config.repo?.base_branch ?? 'main'` and
that `adapterOverride` is caller-supplied and never read from disk. One interface, one sentence.

### B-2 — The dry view is mandated in prose and impossible in types: no `backlog`, and `RunPersistence` has no `writeFile`

`lifecycle-routing.contract.md` § Dry view: *"Use `Object.create(backlog)` and replace `write`,
`writeFile`, and `log` with no-ops."* That is `engine.js:29-34` transcribed exactly, and AC-10 makes
the **mechanism** the requirement rather than the outcome — *"preserved as a view, not as guards at
the call sites … making the database read-only cannot be forgotten"*.

But no contracted type carries a backlog. `RunPersistence` is a fresh four-method interface —
`writeTicket`, `appendLog`, `recordOccurrenceEvent`, `finaliseActiveOccurrences` — and it is a
plain object literal, not a prototype-chained view of anything. Three concrete consequences:

1. **`q0050-lifecycle` is assigned "dry view" with no seam for it.** Its `LifecycleContext` has
   `persistence` and no backlog. It cannot implement the sentence its own contract gives it.
2. **The contract mixes two vocabularies in the same document.** The dry section names the `Backlog`
   class's methods (`packages/core/src/backlog/backlog.ts:83`, `write`/`writeFile`/`log`); the typed
   contract names the capability's (`writeTicket`/`appendLog`). A reader cannot tell which is
   normative, and `writeFile` (`backlog.ts:193`) exists in neither the capability nor anywhere else.
3. **`writeFile` is not this ticket's to skip.** `engine.js:276`, `:284`, `:289`, `:602` (Q-0052) and
   `:1015`, `:1060` (Q-0053) all call it. Landing a persistence capability without it means Q-0052
   must widen Q-0050's contracted context on its first day — which is the "wrong stream shape is the
   most expensive mistake available here" risk the requirement names, arriving through the context
   instead of the stream.

**Remedy.** Either put `backlog: Backlog` on `RunFlowOptions`/`RunContext` and keep
`Object.create(backlog)` verbatim (the smallest change, and the one that makes AC-10 provable by
transcription); or keep `RunPersistence`, add `writeFile`, and **rewrite the dry-view paragraph** to
say the dry run substitutes a whole persistence object whose writers are no-ops, stating that this
is the same "cannot be forgotten" property by a different construction. Either is fine. What is not
fine is a contract that says `Object.create(backlog)` while no backlog exists.

## Majors

### M-1 — The single message oracle still omits three owned strings, two of them created by this solution's own boundary move

Round 4's M-1 is **most of the way** closed — the four `runs.log` formats, the exhaustion `reason`
and the unpriced plural branch all landed, and I checked their templates against `engine.js:645`,
`:649`, `:578`, `:587`, `:552` and `:650`: they are byte-faithful. Three gaps remain, and the QA
contract still calls this file *"the single oracle for exact event and log text"*:

| Missing | Spike | Criterion that asserts it |
| --- | --- | --- |
| `run=<runId> <status> stage=<stage>→<stage> cost=<cost>` — `recordEvent`'s line | `:663` | **AC-6**: *"the exhausted entry and log line present on disk before the gate resolves"* |
| `gate: auto-advanced (<kind>)` | `:559` | **AC-4(6)**: *"`auto` and `--auto` advance … and emits `info` naming its kind"* |
| `gate (<kind>): would pause here` | `:560` | **AC-4(6)**: *"`--dry` emits the would-pause `info` and consumes nothing"* |
| `run=<runId> flow=<flow> start stage=<stage>` | `:68` | not directly asserted, but it is a Q-0050-owned `runs.log` write and `nextRunId` scans for `run=(\d+)` |

The two gate `info` texts are the instructive ones: they were **Q-0052's** under the requirement's
`ui`→`Event` map, and they became **Q-0050's** the moment this solution moved gate policy into
`askGate`. The move is right; its consequence for the oracle was not carried with it. A boundary
change has to bring its strings across.

**Remedy.** Four entries in a JSON file: `log.recordEvent`, `log.start`, `gateAutoAdvanced`,
`gateDryRun`.

### M-2 — The routing↔engine seam is `unknown`, and the goto resolution is assigned to two files

`run-flow-api.contract.ts` declares:

```ts
export declare function runStep(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<unknown>;
export declare function handleFail(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<unknown>;
```

That `Promise<unknown>` is the value carrying `{ goto, counter, limit }` / `{ abort: true }` /
`null` — the value **AC-6, AC-7 and AC-8 all turn on**. `module-layout.contract.md` promises
*"complete named seams, not open objects or `unknown` placeholders"*, and round 4's M-2 removed
index signatures from `RunOutcome` for precisely this reason. The same discipline stopped at the
routing boundary.

It compounds into an ownership gap. `lifecycle-routing.contract.md` § Routing gives `routing.ts`
*"Intra-flow goto increments `ctx.vars.iter`; cross-flow goto does not. Preserve the unknown-target
`findIndex() === -1` TypeError"* and *"`flow:<name>` … terminates regressed"*. But in the spike all
of that is in the **`runFlow` loop** (`engine.js:143-156`), it mutates the loop-local index `i`, and
`RoutingContext` has no way to reach or move it. Meanwhile `module-layout.contract.md` gives
`engine.ts` *"orchestration, step loop"*, and `q0050-engine-compose`'s description says "step loop"
while `q0050-routing`'s says "intra-flow goto, cross-flow regression". Two tasks, two vendors, two
waves, one behaviour, and each is forbidden from editing the other's file.

**Remedy.** Name the value — `type StepResult = { goto: string; counter: string; limit: number } |
{ abort: true } | null` — give `runStep`/`handleFail` that return type, and add one sentence saying
which file resolves a `goto` into the next index. If it is `engine.ts`, say `routing.ts` returns the
target and never moves the cursor; if it is `routing.ts`, `RoutingContext` needs the step list and
an index seam. Either works; the ambiguity does not.

## Nits

- **Three argument orders for the same two strings, in one file.** The contract declares
  `loadRole(harnessDir, name)` and `loadFlowByName(harnessDir, name)`, reversing the spike's
  `loadRole(name, harnessDir)` (`engine.js:727`) and `loadFlowByName(name, harnessDir)` (`:734`) —
  and then declares `RoutingContext.loadNamedFlow(name, harnessDir)` in the spike's order, twelve
  lines away. All three take `(string, string)`, so a call site transcribed from the spike by
  Q-0052 or Q-0053 compiles and passes the wrong values silently. Reordering is layout and the port
  permits it; pick **one** order, apply it to all three, and say in the loaders contract that the
  order was deliberately changed from the spike's.
- **`q0050-routing`'s `depends_on: [q0050-loaders]` is spurious.** Routing reaches flows through the
  injected `RoutingContext.loadNamedFlow`, not by importing `loaders.ts` — that is the point of the
  seam. The dependency serialises a claude task ahead of a codex task for nothing and narrows
  wave 1. Drop it, or say what routing imports from loaders.
- **The gate conditions require a decision entry but do not name the two facts it must settle that
  are already contracted.** The entry is owed on the answer channel, terminal representation,
  timestamp refusal, `process.exit` ownership and the timer — but `askGate`'s move across the
  Q-0052 boundary and the deliberate absence of `dev/implement-report.md` on this route are also
  durable choices M3 and Q-0052 will code against. One clause in the suggested title's scope.

## What would make this an approve

Three fields on `types.ts` and one paragraph (B-1, B-2), four entries in a nine-key JSON file (M-1),
one type alias and one sentence of ownership (M-2). The architecture is unchanged by all of it, and
round 5 is a real improvement on round 4 — the signature layer is now correct and I verified it
against the spike rather than against the resolution table.

**A note for the human at the gate, not for the architect.** This loop has exhausted twice and
would be entering round 6. Charter §9's third rule says more than three runs means the child was cut
wrong; I do not think that is what happened here — the findings have been *different* each round and
each was real, which is Q-0072's five-round shape rather than a loop spinning. But every one of the
four findings above is a mechanical correction to a contract file, and this project has a settled
route for that: an **erratum in `solution/errata.md`**, written and accepted at the gate, rather than
another architect round. Q-0072's E-1/E-2 and Q-0073's E-4 are the precedent, and the remedies above
are written to be transcribable. If Ruud takes that route, the erratum must also state which of
B-2's two options was chosen, because qa-red reads it as the AC-10 oracle.

**Verified by reading or executing today, not cited:** `spike/src/engine.js` `:25-45`, `:60-80`,
`:140-200`, `:200-210`, `:490-500`, `:536-600`, `:616-670`, `:720-765`, `:820-840`, `:1025-1065`;
`spike/bin/harness.js:608`; `harness/flows/development.yaml`, `solutioning.yaml`, `chore.yaml:16`;
`packages/core/src/backlog/backlog.ts:83,193`, `project.ts:40,78`; `packages/core/src/corpus.test.ts`;
the four whole-corpus scans in `backlog.source.test.ts:43,57,117` and `fanout.source.test.ts:130`;
`packages/shared/src/events.ts` and its diff against `main`; all five files under
`contracts/Q-0050/` and all six stubs under `packages/core/src/engine/`, read from
`.harness/worktrees/harness__Q-0050__contracts` at `63d4a6c`.
**Executed:** the nested `z.discriminatedUnion` shape against zod 4.4.3 inside `packages/shared` —
constructs, parses both variants, rejects an unknown key and a partial regression payload.
