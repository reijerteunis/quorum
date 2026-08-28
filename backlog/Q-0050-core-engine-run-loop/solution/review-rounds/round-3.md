# Architecture review — Q-0050 solution, round 3

*Reviewer: architecture-reviewer · 2026-08-28 · verdict **revise** · subject `solution/draft.md` revision round 3, verified against the solutioning worktree `harness/Q-0050/contracts` at `9fb5b43`.*

Everything below was checked by reading the repository and the committed artifacts, not by reading the solution's account of them. Where the document and the tree disagree, the tree is quoted.

---

## What round 3 actually fixed

Round 2's three blockers are genuinely closed, and I want that on the record so round 4 does not re-litigate them.

- **B-1 / B-2 (stub authorship).** All six production files exist at their eventual paths under `packages/core/src/engine/` — `types.ts`, `channel.ts`, `loaders.ts`, `routing.ts`, `lifecycle.ts`, `engine.ts` — committed by solutioning, throwing `Error('Q-0050 contract stub')`. `merge-contracts` will put them on qa-red's base. QA authors no production code. This was the right remedy.
- **B-3 (duplicate `FlowError`).** `types.ts` does `export { FlowError } from '../lint/lint.js';` and no engine file declares a second class. `packages/core/src/lint/lint.ts:29` is the one identity. Correct.
- **`run-events.contract.md` is test-ready.** The nested `z.discriminatedUnion('status', …)` inside one outer `type: 'terminal'` option, the all-or-nothing regression payload, `gateId` correlation, `remaining` clamped at zero, `error` byte-identical to the `runs.log` suffix before JSON quoting, and the honest note that async iteration cannot observe a value returned from `return()` — this is the strongest artifact in the set. I could write failing tests against it this afternoon.
- **The `dev/implement-report.md` disposition is exemplary, and I verified it.** AC-12 requires the eight site dispositions to be stated in `dev/implement-report.md`. Only `chore.yaml:16` writes that file; `development.yaml`'s only `output.writes` are `dev/integration.md` and `dev/green-report.md`, and `commitAll` (`spike/src/fanout.js:82-88`) runs `git checkout -- backlog` and `git clean -qfd -- backlog` in every task worktree, so a development task's write under `backlog/` is discarded by construction. The criterion is unsatisfiable on this route. Putting the durable enumeration in `lifecycle-routing.contract.md` and routing the discrepancy to the human gate is *"A requirement may not name a surface its flow cannot write"* (2026-08-25) applied correctly, not an excuse. The eight-site table with distinct absent-versus-failure columns satisfies AC-12's statement scope.

The design itself — lazy single-consumer stream, lossless FIFO, `answerGate` callback, `AbortSignal` cancellation, terminal event in `shared`, no timestamps — is right, well-argued, and consistent with OQ-1/OQ-2/OQ-6's recommendations. **I am not asking for a redesign.** Every blocker below is a declaration missing from the contract surface.

---

## Blockers

### B-1 — `RoutingContext` cannot support `askGate` or `handleFail`, let alone a test of them

Three incompatible definitions ship in one solution:

| Where | Declared shape |
| --- | --- |
| `contracts/Q-0050/run-flow-api.contract.ts` | `{ counters, vars, dry?, auto? }` |
| `packages/core/src/engine/types.ts` (the stub) | `{ counters, vars, dry?, auto?, emit?, answerGate?, signal? }` |
| `lifecycle-routing.contract.md` (prose) | "event enqueueing, the optional `answerGate` callback, cancellation, and **logging** as injected capabilities" |

No version declares a logging capability. None declares `flow`, `ticket`, `runId` or `harnessDir`. The spike reads all of them from `ctx` in exactly the code this ticket ports:

- `engine.js:541` — `const counter = f.counter ?? \`${ctx.flow.name}.${step.id}\`` → **AC-6**'s counter key needs `ctx.flow.name`.
- `engine.js:549` — `recordEvent(ctx, ctx.ticket.meta.stage, 'exhausted', 0)` → **AC-6**'s "exhausted entry and log line present on disk before the gate resolves" needs `ctx.ticket` and a history seam.
- `engine.js:587` — `ctx.backlog.log(ctx.ticket, \`run=${ctx.runId} gate=retry counter=… set=…\`)` → **AC-7**'s grant line, and **AC-4** property 7's `gate=<kind> answer=<answer>` line, both need `ctx.backlog` and `ctx.runId`.
- `engine.js:145-152` — `loadFlowByName(target.slice(5), harnessDir)`, `ticket.meta.stage`, `finish(ctx, …, 'regressed', …)` → **AC-8**'s seven fields need `harnessDir`, the pre-mutation `ticket.meta.stage`, and a lifecycle seam.
- `engine.js:154` — `steps.findIndex(…)` → the preserved `-1` `TypeError` needs `flow.steps`.

`module-layout.contract.md` *mandates* the focused route: "counter, gate, and regression tests import routing". QA writes those tests during qa-red, **before** `q0050-engine-types` runs. With the context undeclared, QA invents a shape, the types task declares a different one, and the tests fail permanently for every correct implementation. That is a red scenario that can never go green, and the development loop will spend its whole iteration budget discovering it.

This is not the "a file no task owns" flavour — `q0050-engine-types` owns the file. It is the second, quieter failure: **the seam the assertion targets is undeclared, so the assertion cannot be written correctly at all.** The remedy is a declaration, not an owner.

**Required:** declare the complete `RoutingContext` in `run-flow-api.contract.ts` — every field `runStep`, `handleFail` and `askGate` read, with the injected capability types (`emit`, `answerGate`, `signal`, the `runs.log` writer, the `recordEvent`/history seam) named and typed — and make the stub `types.ts` byte-agree with it.

### B-2 — `finish`, `outcome` and `recordEvent` take `context: unknown`, and `BranchHeadReader` has no declared home

Both the contract and the stub declare:

```ts
finish(context: unknown, status: RunStatus, fields?: FinishFields): Promise<Readonly<Record<string, unknown>>>
```

AC-9 requires five focused lifecycle tests — one per status — asserting stage, persisted counters, the history entry and the terminal `runs.log` line, plus a rollback test asserting the reset, the warn and the log line. The QA contract commits to more: *"The rollback diagnostic test uses the injected `BranchHeadReader`: it succeeds at start and returns `null` at finish."*

`BranchHeadReader` is declared as a bare type alias in `types.ts` and appears in **no** interface. Nothing says where it is injected, what the field is called, or what else `finish` reads (`ticket`, `backlog`, `repoDir`, `flow`, `runId`, `counters`, the run-history writer, the branch name). `unknown` accepts every object, so QA's test will compile and the lifecycle task's implementation will compile, and they will not be the same object. Same failure mode as B-1, on the criterion with the most tests behind it.

The `BranchHeadReader` *idea* is good — it exercises AC-12's preserved conflation deterministically without PATH mutation or mid-run repository sabotage, and I prefer it to the requirement's `rev-parse` shim. It just has to be declared somewhere a test can reach.

**Required:** declare a `LifecycleContext` (or extend `RunContext`) naming every field the three functions read, with `BranchHeadReader` as a typed member of it, and replace `context: unknown` in both the contract and the stub.

### B-3 — `runFlow({ flow: loadFlow(f) })` does not typecheck, and the contract and stub disagree on `loadFlow`

`RunFlowOptions.flow` (stub `types.ts`) and `RunFlowDefinition` (contract) both require:

```ts
{ name: string; consumes: string; produces: string; file: string; steps: readonly unknown[] }
```

`@quorum/shared`'s `Flow` — which the committed `loaders.ts` stub returns — is `z.infer<typeof flowSchema>` (`packages/shared/src/flow.ts:354-410`), where **`name`, `steps` and `file` are all `.optional()`**. `file`'s own JSDoc explains why: *"`loadFlow` assigns it onto the parsed object before lint sees it … a schema that rejected it would reject all six shipped flows. This is the key that makes a naive `.strict()` flow schema wrong."*

So `Flow` is not assignable to `RunFlowOptions['flow']` on three fields. `module-layout.contract.md` mandates that "stage-precondition, cancellation, abandonment, and end-to-end stream tests exercise `runFlow` through `engine.ts`" — which means constructing options from a real loaded flow. Under TypeScript strict, `@typescript-eslint/no-explicit-any` at error, and no `@ts-ignore` without a same-line reason, QA cannot write that test without a cast the house rules forbid.

The two artifacts also disagree on the symbol itself:

- `run-flow-api.contract.ts`: `export declare function loadFlow(file: string): RunFlowDefinition;`
- `packages/core/src/engine/loaders.ts`: `export function loadFlow(_file: string): Flow`

The solution states the contract "is hand-synchronised with the six stubs". It diverges on the first symbol I checked. The document is candid that `tsc` could not run in the isolated worktree (`node_modules` absent) — this is what that cost, and it is the reason the sync claim needs a machine behind it rather than a sentence.

**Required:** make `RunFlowOptions.flow` the shared `Flow` type (with the engine reading `flow.steps ?? []` and `flow.name ?? flow.file` exactly as `lintFlow` and the spike do), or state the narrowing and supply the total function that performs it. Then typecheck the six stubs somewhere dependencies exist and say so.

### B-4 — The cross-vendor conflict the gate is asked to accept does not exist

The solution's central escalation:

> The requirement says the development fan-out is cross-vendor. This solution cannot satisfy that statement: the solutioning task vocabulary permits only `frontend | backend | data` … All development tasks are therefore backend/Codex tasks. The human solution gate must accept this stated conflict.

Its only support is prose at `harness/flows/solutioning.yaml:18`. Four facts contradict it:

1. **Nothing enforces that enum.** `development.yaml:7` is `role: "developer-{role}"` — a string interpolation. No schema, no lint rule, no engine check validates the task role.
2. **`harness/roles/developer-tooling.md` exists**, with `adapter: claude` and `paths: [spike/bin, spike/test, packages/core, packages/shared]`.
3. **`harness/architecture.md` — an input to this very step** — says it in as many words: *"`backend` and `tooling` are the two live **fan-out** roles, and they are deliberately on **different vendors** … Both may write `packages/core/` and `packages/shared/`."* And: *"A single-role fan-out is parallelism without a second opinion: it runs one vendor's judgement across the whole change, which is the thing this project exists to avoid."*
4. **The requirement's own cross-cutting checklist** names the pairing: *"satisfied on this route by `development.yaml`'s two fan-out roles being on different vendors — `developer-backend` (codex) and `developer-tooling` (claude), both of which may write `packages/core` and `packages/shared`."*

Seven of the eight tasks touch only `packages/core/**` and `packages/shared/**` — entirely inside `developer-tooling`'s paths. Only `q0050-documentation` (`docs/`) is backend-only. The work is divisible; the single-vendor outcome is a choice.

`cross_vendor: required` will not catch this — `lint.ts:200-213` inspects `parallel` groups only, and `development.yaml` declares no `cross_vendor` key — so nothing downstream will stop it. That makes it a review finding or nothing. On the one ticket whose interface five others code against, running one vendor's judgement across the whole change is the worst available place to lose the second opinion.

**Required:** split the fan-out across `backend` and `tooling` — e.g. `q0050-loaders`, `q0050-event-channel` and `q0050-engine-types` to `tooling`; `q0050-routing`, `q0050-lifecycle`, `q0050-shared-events`, `q0050-documentation` to `backend` — keeping every file owned by exactly one task, and drop the escalation. If you still believe the fan-out must be single-vendor, the argument has to engage `architecture.md`'s table and `developer-tooling.md`, not `solutioning.yaml:18`.

---

## Minors

**M-1 — `packages/core/src/docs.test.ts` does not exist.** Both the QA contract and `module-layout.contract.md` tell QA to extend it. `docs.test.ts` lives at `packages/shared/src/docs.test.ts`; `packages/core/src/` has `corpus.test.ts`, `index.test.ts`, `shared-resolution.test.ts`, `test-command.test.ts`, `turbo-inputs.test.ts` and no docs suite. AC-13's docs assertion needs the right path or a new core suite named as such. (`corpus.test.ts` and `packages/shared/src/events.test.ts` are both correct.)

**M-2 — the seven byte-identical messages are pinned to a fixture that no artifact names.** AC-2 demands string equality, and the contract defers to "the transcribed spike fixtures named by the requirements" — but the requirement gives line numbers (`:67`, `:146`, `:545`, `:548`, `:574`, `:644`, `:651`), not strings. Round 3 also deliberately scattered narration across three owners (`engine.ts`, `routing.ts`, `lifecycle.ts`). Workable, since the spike is readable by QA and by every task, but name the fixture path in the contract so six independent transcriptions cannot drift.

**M-3 — the stubs violate AC-1's JSDoc rule they will be measured by.** `types.ts` carries one file-level block over roughly ten exports; `loaders.ts` one over six. Harmless in itself — development replaces them — but these stubs land on qa-red's base, so the house-rule JSDoc scan fails red on files QA does not own. Say in the contract that this failure is expected and which task clears it, or the first reviewer of a red run will file it as a defect.

**M-4 — nit: the `BranchHeadReader` seam tests the consumer, not the conflation.** AC-12 asks for "a shim that fails `rev-parse`"; injecting a reader proves the two owned sites respond identically to `null`, and never exercises `fanout.ts`'s `safe()` swallowing the error. That is the better test and I would keep it, but the report should say which of the two it is, so Q-0074 knows the swallow itself is still unwitnessed.

---

## Coverage

Every acceptance criterion maps to at least one task, and every task carries a `contracts:` list. No criterion is orphaned.

| AC | Tasks | Contract adequate to red-test? |
| --- | --- | --- |
| AC-1 module shape, prints nothing | `engine-compose`; QA extends corpus | Yes |
| AC-2 stream, byte-identical text, ordering | `event-channel`, `engine-compose`, `routing`, `lifecycle` | Yes, but see M-2 |
| AC-3 terminal event + throw | `shared-events`, `lifecycle`, `event-channel` | **Yes — strongest artifact** |
| AC-4 gate channel | `routing`, `shared-events` | **No — B-1** (property 7 has no logging seam) |
| AC-5 early stop, no `process.exit` | `event-channel`, `engine-types`, `lifecycle`, `engine-compose` | Yes |
| AC-6 counters, exhaustion gate | `routing` | **No — B-1** |
| AC-7 retry grant | `routing` | **No — B-1** (grant line needs `backlog`/`runId`) |
| AC-8 cross-flow regression | `routing`, `loaders` | **No — B-1** (needs `harnessDir`, `ticket`, `flow`) |
| AC-9 `finish` five statuses, rollback | `lifecycle` | **No — B-2** (`context: unknown`) |
| AC-10 `--dry` + two pinned defects | `lifecycle`, `routing` | Yes |
| AC-11 six helpers | `loaders` | Yes — the cleanest criterion in the set |
| AC-12 eight sites stated, two tested | `lifecycle`, `routing`, contract table | Statement scope yes; test seam blocked by B-2 |
| AC-13 house rules + docs | `documentation`, all | Yes, modulo M-1 |

Task waves are coherent (`shared-events`/`loaders`/`documentation` → `engine-types` → `channel`/`routing`/`lifecycle` → `engine-compose`), ownership is disjoint, and no two tasks share a file.

---

## What round 4 needs

Four changes, all in the contract surface. None touches the design.

1. Declare `RoutingContext` completely — every field `runStep`, `handleFail` and `askGate` read, with the logging and history capabilities typed — in `run-flow-api.contract.ts`, and make `types.ts` agree.
2. Replace `context: unknown` on `finish`/`outcome`/`recordEvent` with a declared lifecycle context that names `BranchHeadReader`'s injection point.
3. Reconcile `RunFlowOptions.flow` with shared's `Flow` (optional `name`/`file`/`steps`), align `loadFlow`'s return type between contract and stub, and typecheck the six stubs where `node_modules` exists.
4. Split the fan-out across `backend` (codex) and `tooling` (claude), and withdraw the cross-vendor escalation.

The pre-development gate actions the solution lists are correct and unaffected: Q-0049 `main:contained` before qa-red and development, and the dated decision entry covering the stream, the gate-answer channel, cancellation ownership, the timestamp refusal and the `signalWindow` timer, accepted **before** implementation starts. No step on this route can write that entry.

Fix the four and I would be on call for this. The design is right; it is under-declared, and QA cannot write a test against a seam that has no name.
