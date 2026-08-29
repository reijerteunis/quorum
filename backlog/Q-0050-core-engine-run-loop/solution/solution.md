# Solution — Q-0050: `core/engine`, the run loop, routing and the event stream

*Final · principal architect · 2026-08-28*

## Chosen approach

Implement `runFlow` as a lazy, single-consumer `AsyncIterable<Event>` backed by a lossless FIFO. The first iterator pull starts execution. Synchronous adapter callbacks enqueue without back-pressure, preserving order within a step; concurrently executing parallel members have no promised global order.

The interface has four explicit boundaries:

1. `RunFlowOptions.answerGate` is an out-of-band asynchronous callback. Core emits a correlated gate event before invoking it, then validates the returned `gateId` and closed `advance | retry | abort` answer.
2. `RunFlowOptions.signal` is caller-owned cancellation. Core installs no signal listener and never exits the process.
3. Every normal terminal status is the stream’s final event. A failed run emits its terminal event and the following pull throws the existing `FlowError` with a non-empty cause.
4. Iterator `return()` cancels active work and awaits interrupted-run persistence. An abandoning `for await` consumer cannot observe the terminal event it caused, but counters, occurrences and the terminal log record persist before `return()` resolves.

The shared event union gains strict gate correlation, a separately validated gate-answer envelope and one terminal member. The terminal member contains a nested status-discriminated union so the seven regression values are either complete or absent. No event gains a timestamp or sequence number, and only the terminal event carries run identity.

### Module split

Production is divided into six engine files with disjoint ownership:

| File | Responsibility |
| --- | --- |
| `types.ts` | Public options, complete contexts, injected capabilities, lifecycle seams and the existing `FlowError` re-export. |
| `channel.ts` | Lazy iterator, FIFO buffering, completion, terminal-then-throw and abandonment. |
| `loaders.ts` | Flow and role loading plus the four pure helpers. |
| `routing.ts` | Dispatch, gate policy, counters, failure routing and backward-edge decisions. |
| `lifecycle.ts` | History outcomes, terminal persistence, stage movement, dry behavior and rollback. |
| `engine.ts` | Stage precondition, context construction, orchestration, goto cursor movement and event composition. |

There is no engine-folder barrel and no edit to `packages/core/src/index.ts`.

### Gate and cancellation protocol

`answerGate(question)` may settle outside the iterator pull stack and minutes after the question was emitted. The answer repeats the pending gate’s opaque `gateId`. An unknown answer, stale id, mismatched id or missing callback fails the run naming the gate rather than inventing a decision.

Automatic and dry short-circuits run before a question is allocated. Eligible automatic gates emit `info` and consume no answer; `human-locked` gates never auto-advance. Every answered gate is logged before its answer is acted on.

The 1000 ms `signalWindow` timer is preserved and marked `Why: preserved defect, see Q-0050 AC-4.` unless the required pre-development decision explicitly authorises removal.

### Project, configuration and persistence seams

`RunFlowOptions` receives the caller’s loaded `Project` and `Backlog`. The project is authoritative for `repoDir`, `harnessDir` and `config`; the engine does not reload project configuration from disk. This preserves transient caller configuration such as `config.adapterOverride` and supplies the later engine tickets with `cmdTimeout`, `repo.max_diff_bytes` and configured commands.

Context construction derives `vars.base` from `config.repo?.base_branch ?? 'main'`. The mock adapter is selected through the caller-supplied `config.adapterOverride`, never by re-reading configuration.

Dry execution preserves the spike’s whole-capability view. Core creates `Object.create(backlog)` and replaces `write`, `writeFile` and `log` with no-ops before placing that view in the run context. Read operations and prototype behavior remain available, while every backlog writer is disabled at the boundary rather than guarded independently at call sites. The caller’s in-memory ticket and aliased iteration counters retain their preserved dry-run mutations.

### Routing result and cursor ownership

`runStep` and `handleFail` return the closed `StepResult` union:

```ts
type StepResult =
  | { goto: string; counter: string; limit: number }
  | { abort: true }
  | null;
```

`routing.ts` selects and returns a routing decision but never moves the step cursor. `engine.ts` owns the step list and resolves `goto` into the next index. It increments `ctx.vars.iter` for an intra-flow backward edge, preserves the unknown-target `findIndex() === -1` `TypeError`, and sends `flow:<name>` decisions through named-flow loading and lifecycle regression using the target flow’s `consumes` stage.

This separation leaves routing independently testable without exposing mutable cursor state through `RoutingContext`.

### Loader argument order

All named loaders use `(name, harnessDir)`: `loadRole(name, harnessDir)`, `loadFlowByName(name, harnessDir)` and `RoutingContext.loadNamedFlow(name, harnessDir)`. This deliberately retains the spike’s order and prevents two interchangeable string parameters from compiling in contradictory orders.

### Lifecycle and history signatures

The lifecycle contract preserves the spike’s actual signatures instead of deriving a cleaner but incompatible API:

- `finish(context, stage, status, note, fields?)` receives the target stage and optional diagnostic note explicitly. Completed callers pass `flow.produces`; regressed callers pass the target flow’s `consumes`; other callers pass the current stage.
- `outcome(context, before, after, status, cost)` returns `TicketHistoryEntry`, whose run identifier is `run`, not `runId`. It preserves the duplicated `stage` and `stage_after` fields.
- `recordEvent(context, stage, status, cost)` passes the same stage as before and after, including cost zero for the pre-gate `exhausted` entry.
- `RunOutcome` is a closed discriminated union. A regressed result carries the complete seven-value regression group; other statuses cannot carry it.

The optional `note` supplies the JSON-quoted terminal-log suffix and the terminal event’s `error`. It is not hidden in an open fields bag.

### Complete context seams

`RoutingContext` names every value used by `runStep`, `handleFail` and `askGate`: flow, ticket, repository and harness directories, caller-supplied project configuration, backlog view, run id, counters, variables, statistics, dry/auto state, event emission, gate callback, cancellation, persistence, named-flow loading and lifecycle completion.

`LifecycleContext` adds the start head, an injected `BranchHeadReader` and reset capability. This seam tests the run loop’s preserved response to `null`; it does not prove whether `fanout.safe()` swallowed an underlying operational git failure. That witness remains Q-0074’s obligation.

The persistence capability adapts the concrete `Backlog` API used for ticket writes, file writes, `runs.log`, occurrence history and active-occurrence finalisation without pre-empting Q-0049’s implementation. `engine.ts` constructs the real or dry backlog view and adapts Q-0049’s landed API to the named lifecycle capabilities.

### Exact message oracle

`contracts/Q-0050/run-messages.fixture.json` is the single oracle for Q-0050-owned event and log text. In addition to the terminal, rollback, gate-answer and retry-grant formats, exhaustion reason and priced/unpriced plural branches, it contains:

- `log.recordEvent`: `run=<runId> <status> stage=<stage>→<stage> cost=<cost>`
- `log.start`: `run=<runId> flow=<flow> start stage=<stage>`
- `gateAutoAdvanced`: `gate: auto-advanced (<kind>)`
- `gateDryRun`: `gate (<kind>): would pause here`

The start line remains part of the oracle because `nextRunId` scans the log for `run=(\d+)`.

### Preservation rules

Counter arithmetic, bounded backward edges, cross-flow regression, five statuses, stage movement, rollback conditions, dry execution and exact narration follow the spike.

The port positively pins these defects rather than repairing them silently:

- dry runs still mutate the caller’s in-memory ticket;
- counters still alias `ticket.meta.iterations`;
- branch-head absence and operational git failure remain indistinguishable;
- a failed discard can still be reported as successful;
- the first modified discarded path can still lose its first character;
- an empty merge diagnostic still becomes `git reported no reason`;
- nested parallel gate or script steps still dispatch as agent steps;
- an unknown goto still reaches the preserved `TypeError`.

No task edits `fanout/` or `spike/`.

## Rejected alternatives

### Two-way async-generator input

Rejected because `for await` cannot provide a value to `next()`. A normal consumer could observe a gate but could not answer it.

### Mutable run handle

Rejected because `answerGate` and `AbortSignal` provide the required daemon seams while preserving the specified `AsyncIterable<Event>` API. Q-0040 may revisit a longer-lived handle if “undecided” must outlive a run.

### Generator return value for terminal state

Rejected because `for await` discards it and it does not naturally cross a WebSocket. A terminal event is observable by every normal stream consumer.

### Eager execution

Rejected because it could mutate before a consumer elects to observe the run. Lazy start also gives iterator abandonment a precise ownership boundary.

### Execution entirely inside each pull

Rejected because awaiting an answer callback could prevent delivery of the gate event needed to solicit that answer.

### Back-pressure on adapter callbacks

Rejected because the landed callback is synchronous. A FIFO absorbs bursts without dropping or reordering events within a step.

### Reloading project configuration inside `runFlow`

Rejected because `adapterOverride` is applied to the already-loaded project and may never exist on disk. Reloading would also sever the caller’s selected configuration from the run.

### A synthetic persistence object unrelated to `Backlog`

Rejected because AC-10 requires the spike’s prototype-based dry view and later engine tickets use `writeFile`. Keeping the `Backlog` surface makes the non-mutating boundary provable by direct transcription.

### Routing-owned cursor mutation

Rejected because the step index belongs to the orchestration loop. Exposing it through `RoutingContext` would couple routing policy to mutable loop mechanics and leave two modules responsible for one transition.

### Open lifecycle payload bags

Rejected because index signatures suppress excess-property checking and allow regression or history fields to drift silently. Named closed types make incompatible changes fail at the contract seam.

### Optional regression fields

Rejected because convention cannot prevent partial payloads. A status-discriminated union enforces the complete group.

### `unknown` routing results

Rejected because goto, abort and continuation are the control contract between two independently owned files. A closed `StepResult` prevents either implementation from inventing an unhandled shape.

### A second engine `FlowError`

Rejected because it would split runtime identity and `instanceof` behavior. Engine code re-exports the class from `core/lint`.

### Narrowed engine-only flow type

Rejected because loaders return shared `Flow`. A second shape would require forbidden casts or redundant validation.

### Timestamps, sequence numbers and run ids on every event

Rejected because delivery is already ordered, history timestamps occurrences, and v1 neither persists nor replays the stream.

### Fixing preserved defects

Rejected by the port charter. Fan-out corrections require separate authority and a coordinated spike/core change.

### Populating the core barrel

Rejected because it is byte-pinned and already omits other public modules. Cutover owns creation of a complete public barrel.

### Single-vendor fan-out

Rejected because the repository’s normative fan-out contract requires the live `backend` and `tooling` roles on different vendors. Although the task prompt lists only `frontend | backend | data`, those roles cannot provide a valid cross-vendor split for this surface: `frontend` and `data` lack write authority over these files. `development.yaml`, `developer-tooling.md` and `harness/architecture.md` make `tooling` the applicable repository role.

## Contracts

The following contract artifacts exist under `contracts/Q-0050/`:

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0050/run-flow-api.contract.ts` | Typed interface contract | Declares shared event and ticket-history types, closed lifecycle payloads, gate callback, complete project/config/backlog contexts, persistence capabilities, `StepResult`, loaders, routing functions and corrected lifecycle signatures. |
| `contracts/Q-0050/run-events.contract.md` | Runtime-schema contract | Defines strict gate correlation, answer validation, terminal variants, ordering, buffering, failure delivery and abandonment. |
| `contracts/Q-0050/lifecycle-routing.contract.md` | Domain contract | Defines project-derived variables, prototype-based dry persistence, lifecycle parameters, history-entry construction, counters, gate policy, retry, regression, engine-owned cursor movement, stage changes, rollback and all routed diagnostic dispositions. |
| `contracts/Q-0050/module-layout.contract.md` | Module and ownership contract | Assigns declarations to files, fixes dependency direction, names all seven production contract surfaces and separates focused from end-to-end tests. |
| `contracts/Q-0050/run-messages.fixture.json` | Exact-message fixture | Pins the seven stream messages, gate auto/dry messages, exhaustion reason, unpriced singular/plural suffixes and all Q-0050-owned `runs.log` formats. |

Solutioning created or extended these production-path stubs so qa-red fails on behavior rather than missing symbols:

| Stub | Contracted surface |
| --- | --- |
| `packages/shared/src/events.ts` | `gateId`, `GateAnswer`, `GateAnswerEnvelope`, strict answer schema, strict terminal schema and terminal event-union member. |
| `packages/core/src/engine/types.ts` | Shared gate types, project/config/backlog options, complete contexts, capabilities, `StepResult`, closed outcomes, statuses and `FlowError` re-export. |
| `packages/core/src/engine/channel.ts` | Event sink and lazy iterator channel. |
| `packages/core/src/engine/loaders.ts` | Six loader/helper exports returning shared types with consistent `(name, harnessDir)` order. |
| `packages/core/src/engine/routing.ts` | `askGate`, `runStep` and `handleFail`, returning `StepResult`. |
| `packages/core/src/engine/lifecycle.ts` | Correctly typed `finish`, `outcome` and `recordEvent`. |
| `packages/core/src/engine/engine.ts` | `runFlow(options): AsyncIterable<Event>` and engine-owned goto resolution. |

No database migration or persistent schema skeleton is created. Q-0050 changes no on-disk format; the event union and out-of-band gate-answer envelope are in-memory protocol schemas.

## QA contract

QA-red owns every new or changed test file and must not edit production stubs. It:

- extends `packages/core/src/corpus.test.ts` for the engine folder;
- extends `packages/shared/src/events.test.ts` for strict terminal and gate-answer schemas;
- creates `packages/core/src/engine/docs.test.ts` for documentation assertions;
- imports loaders, routing and lifecycle directly for focused tests;
- supplies a loaded project whose in-memory config selects the mock adapter and verifies `vars.base` comes from that config;
- proves dry behavior through a prototype-based backlog view whose `write`, `writeFile` and `log` methods are all no-ops;
- asserts routing returns the closed `StepResult` while `engine.ts` alone resolves goto targets and moves the cursor;
- exercises stage preconditions, cancellation, abandonment and the complete stream through `engine.ts`;
- uses `contracts/Q-0050/run-messages.fixture.json` as the single oracle for exact event and log text.

QA must not assert that this route writes `dev/implement-report.md`: no full-SDLC step writes that file. AC-12’s durable enumeration is `contracts/Q-0050/lifecycle-routing.contract.md`; amendments go to `solution/errata.md`.

The branch-head tests inject `LifecycleContext.readBranchHead`. They test the consumer’s preserved response to `null`, not `fanout.safe()`’s swallowing of the underlying git failure.

The deliberately minimal throwing engine stubs may initially fail the JSDoc/source-shape assertions. Each development task clears failures only in its owned production file.

## Gate conditions

Before qa-red or development:

- Q-0049 must be `main:contained`.
- A dated decision covering the event stream, answer channel, terminal representation, caller-owned cancellation and `process.exit` ownership, timestamp refusal, preserved timer, Q-0050 ownership of `askGate`, and the deliberate absence of `dev/implement-report.md` on this route must be accepted.
- The four routed diagnostics remain preserved unless separate authority and a freeze exemption permit a coordinated spike/core correction.
- Q-0052’s gate actions must state that it calls Q-0050’s `askGate` for author-declared gates and does not recreate gate policy.
- Amendments use `solution/errata.md`; `requirements/errata.md` is not read on this route.
- Nothing under `spike/**` may change.

`git diff --check` passes. `pnpm typecheck` was attempted but cannot run in this isolated worktree because `node_modules` and the local `turbo` executable are absent. QA-red must run forced lint, typecheck and tests once dependencies are available.

## Round-five review findings resolved

| Finding | Resolution |
| --- | --- |
| B-1: context omitted project configuration | `RunFlowOptions` now receives the caller’s loaded `Project`; contexts carry its config and derive directories and `vars.base` from it. `adapterOverride` remains caller-supplied and is never re-read from disk. |
| B-2: the dry view was impossible in the typed seam | The `Backlog` is explicit in options and context. Dry execution uses `Object.create(backlog)` and replaces `write`, `writeFile` and `log` with no-ops, preserving AC-10’s whole-capability boundary. |
| M-1: the exact-message oracle omitted owned strings | The fixture now includes `log.recordEvent`, `log.start`, `gateAutoAdvanced` and `gateDryRun` with their byte-faithful formats. |
| M-2: routing returned `unknown` and cursor ownership overlapped | A closed `StepResult` union now joins the modules. Routing returns decisions; `engine.ts` alone resolves goto targets and moves the cursor. |
| Nit: loader arguments had contradictory orders | All named loaders use `(name, harnessDir)`, deliberately retaining the spike’s order. |
| Nit: routing unnecessarily depended on loaders | `q0050-routing` no longer depends on `q0050-loaders`; it reaches named flows only through the injected context seam. |
| Nit: the decision scope omitted two durable choices | The gate now requires the decision to cover `askGate` ownership and the absence of `dev/implement-report.md` as well as the stream, answer, cancellation, timestamp and timer choices. |

## Tasks

Ownership is enforced entirely through each task description. Production and documentation ownership is disjoint, and development tasks must not modify tests.

```yaml
tasks:
  - id: q0050-shared-events
    role: backend
    title: Implement strict terminal and correlated gate-answer schemas
    description: >
      Own packages/shared/src/events.ts only and replace the Q-0050 contract
      declarations with the final strict schemas and inferred types. Add gateId,
      GateAnswer, GateAnswerEnvelope and the terminal member with its nested status
      union. Do not touch packages/shared/src/index.ts, packages/core/**, tests,
      docs/**, contracts/**, backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-flow-api.contract.ts
    depends_on: []

  - id: q0050-loaders
    role: tooling
    title: Implement engine loaders and pure helpers
    description: >
      Own packages/core/src/engine/loaders.ts only and replace its stub. Implement
      loadFlow, loadFlowByName, loadRole, interpolate, writesOf and reviewRound,
      returning shared Flow and Role types, using (name, harnessDir) consistently
      for named loaders and preserving exact errors. Do not touch any other engine
      file, packages/shared/**, tests, docs/**, contracts/**, backlog/**, harness/**
      or spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/lifecycle-routing.contract.md
      - contracts/Q-0050/module-layout.contract.md
    depends_on: []

  - id: q0050-documentation
    role: backend
    title: Correct event-stream and gate-channel documentation
    description: >
      Own docs/03-adapter-contract.md, docs/04-architecture.md and docs/GLOSSARY.md
      only. Document the terminal member, answerGate, caller-owned cancellation,
      ordering limits and timestamp refusal, citing the accepted decision by title
      and date. Do not create a decision entry or touch source, tests, contracts/**,
      backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/module-layout.contract.md
    depends_on: []

  - id: q0050-engine-types
    role: tooling
    title: Implement closed engine contexts and lifecycle payloads
    description: >
      Own packages/core/src/engine/types.ts only and replace its stub. Implement
      RunFlowOptions over the caller-supplied Project, Backlog, shared Flow and gate
      types; RunContext, RoutingContext and LifecycleContext with project config,
      derived directories and the backlog view; persistence, writeFile,
      branch-head/reset and abandonment capabilities; StepResult, RegressionFields
      and the closed RunOutcome union. Re-export FlowError and add required JSDoc.
      Do not touch any other engine file, packages/shared/**, tests, docs/**,
      contracts/**, backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/module-layout.contract.md
      - contracts/Q-0050/lifecycle-routing.contract.md
    depends_on:
      - q0050-shared-events

  - id: q0050-event-channel
    role: tooling
    title: Implement the lossless lazy event channel
    description: >
      Own packages/core/src/engine/channel.ts only and replace its stub. Implement
      single-consumer lazy start, lossless FIFO buffering, completion,
      terminal-then-throw sequencing and awaited abandonment finalisation. Do not
      implement gate policy or persistence and do not touch any other engine file,
      packages/shared/**, tests, docs/**, contracts/**, backlog/**, harness/** or
      spike/**.
    contracts:
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/module-layout.contract.md
    depends_on:
      - q0050-engine-types

  - id: q0050-routing
    role: backend
    title: Implement gates and bounded failure decisions
    description: >
      Own packages/core/src/engine/routing.ts only and replace its stub. Implement
      runStep, handleFail and askGate using RoutingContext, including exact fixture
      text, allSettled parallel dispatch, auto/dry policy, correlated answers,
      answer logging, one-traversal retry and closed StepResult decisions for abort,
      intra-flow goto and cross-flow regression. Return targets without resolving
      the step index or moving the engine cursor. Preserve signalWindow with its
      authority line and preserve the routed defects. Do not implement Q-0052
      agent/script or Q-0053 fan-out/integrate bodies. Do not touch other engine
      files, loaders.ts, fanout/**, packages/shared/**, tests, docs/**, contracts/**,
      backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/lifecycle-routing.contract.md
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-messages.fixture.json
    depends_on:
      - q0050-engine-types

  - id: q0050-lifecycle
    role: backend
    title: Implement typed history, terminal persistence and rollback
    description: >
      Own packages/core/src/engine/lifecycle.ts only and replace its stub. Implement
      finish(context, stage, status, note, fields), outcome(context, before, after,
      status, cost) and recordEvent(context, stage, status, cost). Preserve the
      TicketHistoryEntry shape, terminal events, occurrence finalisation, counters,
      five-status stage rules, ticket rollback and exact fixture text. Consume the
      real or prototype-based dry Backlog view supplied by the context, including
      writeFile capability, without adding per-call dry guards. Use readBranchHead
      and resetBranch while preserving branch-head conflation, task branches and
      both dry-run in-memory defects. Do not touch other engine files, fanout/**,
      packages/shared/**, tests, docs/**, contracts/**, backlog/**, harness/** or
      spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/lifecycle-routing.contract.md
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-messages.fixture.json
    depends_on:
      - q0050-engine-types
      - q0050-shared-events

  - id: q0050-engine-compose
    role: tooling
    title: Compose the lazy run loop over the contracted modules
    description: >
      Own packages/core/src/engine/engine.ts only and replace its stub. Implement
      runFlow, the stage precondition, caller-supplied Project and Backlog context
      construction, config-derived vars.base, prototype-based dry Backlog view,
      Q-0049 persistence adaptation, producer orchestration, step loop, run banner,
      stepId enrichment and failure propagation through lifecycle and channel.
      Resolve StepResult goto targets and move the cursor here only, including
      intra-flow iteration increments, cross-flow regression through the target
      flow's consumes stage and the preserved unknown-target TypeError. Verify the
      engine folder has no console output, ANSI, signal subscription, process exit,
      prohibited import or new dependency; report a violation in another owner's
      file instead of editing it. Do not touch other engine files,
      packages/core/src/index.ts, packages/shared/**, tests, docs/**, contracts/**,
      backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/lifecycle-routing.contract.md
      - contracts/Q-0050/module-layout.contract.md
      - contracts/Q-0050/run-messages.fixture.json
    depends_on:
      - q0050-event-channel
      - q0050-routing
      - q0050-lifecycle
```
