# Solution — Q-0050: `core/engine`, the run loop, routing and the event stream

*Revision round 5 · principal architect · 2026-08-28*

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
| `routing.ts` | Dispatch, gate policy, counters, failure routing and backward edges. |
| `lifecycle.ts` | History outcomes, terminal persistence, stage movement, dry behavior and rollback. |
| `engine.ts` | Stage precondition, context construction, orchestration and event composition. |

There is no engine-folder barrel and no edit to `packages/core/src/index.ts`.

### Gate and cancellation protocol

`answerGate(question)` may settle outside the iterator pull stack and minutes after the question was emitted. The answer repeats the pending gate’s opaque `gateId`. An unknown answer, stale id, mismatched id or missing callback fails the run naming the gate rather than inventing a decision.

Automatic and dry short-circuits run before a question is allocated. Eligible automatic gates emit `info` and consume no answer; `human-locked` gates never auto-advance. Every answered gate is logged before its answer is acted on.

The 1000 ms `signalWindow` timer is preserved and marked `Why: preserved defect, see Q-0050 AC-4.` unless the required pre-development decision explicitly authorises removal.

### Lifecycle and history signatures

The lifecycle contract preserves the spike’s actual signatures instead of deriving a cleaner but incompatible API:

- `finish(context, stage, status, note, fields?)` receives the target stage and optional diagnostic note explicitly. Completed callers pass `flow.produces`; regressed callers pass the target flow’s `consumes`; other callers pass the current stage.
- `outcome(context, before, after, status, cost)` returns `TicketHistoryEntry`, whose run identifier is `run`, not `runId`. It preserves the duplicated `stage` and `stage_after` fields.
- `recordEvent(context, stage, status, cost)` passes the same stage as before and after, including cost zero for the pre-gate `exhausted` entry.
- `RunOutcome` is a closed discriminated union. A regressed result carries the complete seven-value regression group; other statuses cannot carry it.

The optional `note` supplies the JSON-quoted terminal-log suffix and the terminal event’s `error`. It is not hidden in an open fields bag.

### Complete context seams

`RoutingContext` names every value used by `runStep`, `handleFail` and `askGate`: flow, ticket, repository and harness directories, run id, counters, variables, statistics, dry/auto state, event emission, gate callback, cancellation, persistence, named-flow loading and lifecycle completion.

`LifecycleContext` adds the start head, an injected `BranchHeadReader` and reset capability. This seam tests the run loop’s preserved response to `null`; it does not prove whether `fanout.safe()` swallowed an underlying operational git failure. That witness remains Q-0074’s obligation.

The persistence capability abstracts ticket writes, `runs.log`, occurrence history and active-occurrence finalisation without pre-empting Q-0049’s concrete API. `engine.ts` adapts Q-0049’s landed API to this contract.

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

### Open lifecycle payload bags

Rejected because index signatures suppress excess-property checking and allow regression or history fields to drift silently. Named closed types make incompatible changes fail at the contract seam.

### Optional regression fields

Rejected because convention cannot prevent partial payloads. A status-discriminated union enforces the complete group.

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
| `contracts/Q-0050/run-flow-api.contract.ts` | Typed interface contract | Declares shared event and ticket-history types, closed lifecycle payloads, gate callback, complete contexts, persistence capabilities, loaders, routing functions and corrected lifecycle signatures. |
| `contracts/Q-0050/run-events.contract.md` | Runtime-schema contract | Defines strict gate correlation, answer validation, terminal variants, ordering, buffering, failure delivery and abandonment. |
| `contracts/Q-0050/lifecycle-routing.contract.md` | Domain contract | Defines lifecycle parameters, history-entry construction, counters, gate policy, retry, regression, stage changes, dry behavior, rollback and all routed diagnostic dispositions. |
| `contracts/Q-0050/module-layout.contract.md` | Module and ownership contract | Assigns declarations to files, fixes dependency direction, names all seven production contract surfaces and separates focused from end-to-end tests. |
| `contracts/Q-0050/run-messages.fixture.json` | Exact-message fixture | Pins the seven stream messages, exhaustion reason, unpriced singular/plural suffixes and four `runs.log` formats. |

Solutioning created or extended these production-path stubs so qa-red fails on behavior rather than missing symbols:

| Stub | Contracted surface |
| --- | --- |
| `packages/shared/src/events.ts` | `gateId`, `GateAnswer`, `GateAnswerEnvelope`, strict answer schema, strict terminal schema and terminal event-union member. |
| `packages/core/src/engine/types.ts` | Shared gate types, options, complete contexts, capabilities, closed outcomes, statuses and `FlowError` re-export. |
| `packages/core/src/engine/channel.ts` | Event sink and lazy iterator channel. |
| `packages/core/src/engine/loaders.ts` | Six loader/helper exports returning shared types. |
| `packages/core/src/engine/routing.ts` | `askGate`, `runStep` and `handleFail`. |
| `packages/core/src/engine/lifecycle.ts` | Correctly typed `finish`, `outcome` and `recordEvent`. |
| `packages/core/src/engine/engine.ts` | `runFlow(options): AsyncIterable<Event>`. |

No database migration or persistent schema skeleton is created. Q-0050 changes no on-disk format; the event union and out-of-band gate-answer envelope are in-memory protocol schemas.

## QA contract

QA-red owns every new or changed test file and must not edit production stubs. It:

- extends `packages/core/src/corpus.test.ts` for the engine folder;
- extends `packages/shared/src/events.test.ts` for strict terminal and gate-answer schemas;
- creates `packages/core/src/engine/docs.test.ts` for documentation assertions;
- imports loaders, routing and lifecycle directly for focused tests;
- exercises stage preconditions, cancellation, abandonment and the complete stream through `engine.ts`;
- uses `contracts/Q-0050/run-messages.fixture.json` as the single oracle for exact event and log text.

QA must not assert that this route writes `dev/implement-report.md`: no full-SDLC step writes that file. AC-12’s durable enumeration is `contracts/Q-0050/lifecycle-routing.contract.md`; amendments go to `solution/errata.md`.

The branch-head tests inject `LifecycleContext.readBranchHead`. They test the consumer’s preserved response to `null`, not `fanout.safe()`’s swallowing of the underlying git failure.

The deliberately minimal throwing engine stubs may initially fail the JSDoc/source-shape assertions. Each development task clears failures only in its owned production file.

## Gate conditions

Before qa-red or development:

- Q-0049 must be `main:contained`.
- A dated decision covering the stream, gate channel, cancellation ownership, timestamp refusal and timer must be accepted.
- The four routed diagnostics remain preserved unless separate authority and a freeze exemption permit a coordinated spike/core correction.
- Q-0052’s gate actions must state that it calls Q-0050’s `askGate` for author-declared gates and does not recreate gate policy.
- Amendments use `solution/errata.md`; `requirements/errata.md` is not read on this route.
- Nothing under `spike/**` may change.

`git diff --check` passes. `pnpm typecheck` was attempted but cannot run in this isolated worktree because `node_modules` and the local `turbo` executable are absent. QA-red must run forced lint, typecheck and tests once dependencies are available.

## Round-four review findings resolved

| Finding | Resolution |
| --- | --- |
| B-1: `outcome()` contradicted ticket history | Its contract and stub now accept `before`, `after`, `status` and nullable `cost`, return shared `TicketHistoryEntry`, and preserve the `run` key plus duplicated stage fields. |
| B-2: `finish()` lost target stage and note | Both are restored as named parameters in `finish` and `RoutingContext.finishRun`; regression callers pass the target flow’s `consumes`, and `note` owns the diagnostic suffix. |
| B-3: missing shared production stub | `packages/shared/src/events.ts` now declares gate correlation, closed answers, the strict terminal schema and the event-union member; the module-layout contract names seven production contract surfaces. |
| M-1: message oracle omitted log formats | The fixture now includes terminal, rollback, gate-answer and retry-grant log lines, the exhaustion reason and both unpriced pluralisation branches. |
| M-2: open `RunOutcome` and `FinishFields` | The index signatures are removed. `RegressionFields` and the two status-discriminated outcome interfaces form a closed union. |
| Nit: Q-0052 boundary was not routed | The lifecycle contract and gate conditions explicitly route the inherited `askGate` policy to Q-0052. |
| Nit: QA could test an impossible implement report | The QA contract explicitly forbids that assertion and names the durable contract and errata route. |
| Nit: local gate type duplicated shared | Core types and routing import `GateQuestionEvent` and `GateAnswerEnvelope` from `@quorum/shared`. |
| Nit: typecheck not run | It was attempted and failed because this worktree has no installed dependencies or `turbo`; the limitation and required later verification are recorded. |

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
      returning shared Flow and Role types and preserving exact errors. Do not
      touch any other engine file, packages/shared/**, tests, docs/**, contracts/**,
      backlog/**, harness/** or spike/**.
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
      RunFlowOptions over shared Flow and gate types, RunContext, RoutingContext,
      LifecycleContext, persistence, branch-head/reset and abandonment capabilities,
      RegressionFields and the closed RunOutcome union. Re-export FlowError and add
      required JSDoc. Do not touch any other engine file, packages/shared/**, tests,
      docs/**, contracts/**, backlog/**, harness/** or spike/**.
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
    title: Implement gates, bounded failure routing and regression
    description: >
      Own packages/core/src/engine/routing.ts only and replace its stub. Implement
      runStep, handleFail and askGate using RoutingContext, including exact fixture
      text, allSettled parallel dispatch, auto/dry policy, correlated answers,
      answer logging, one-traversal retry, intra-flow goto, cross-flow regression
      and preserved routing defects. Preserve signalWindow with its authority line.
      Do not implement Q-0052 agent/script or Q-0053 fan-out/integrate bodies. Do
      not touch other engine files, fanout/**, packages/shared/**, tests, docs/**,
      contracts/**, backlog/**, harness/** or spike/**.
    contracts:
      - contracts/Q-0050/run-flow-api.contract.ts
      - contracts/Q-0050/lifecycle-routing.contract.md
      - contracts/Q-0050/run-events.contract.md
      - contracts/Q-0050/run-messages.fixture.json
    depends_on:
      - q0050-engine-types
      - q0050-loaders

  - id: q0050-lifecycle
    role: backend
    title: Implement typed history, terminal persistence and rollback
    description: >
      Own packages/core/src/engine/lifecycle.ts only and replace its stub. Implement
      finish(context, stage, status, note, fields), outcome(context, before, after,
      status, cost) and recordEvent(context, stage, status, cost). Preserve the
      TicketHistoryEntry shape, terminal events, occurrence finalisation, counters,
      five-status stage rules, ticket rollback, dry view and exact fixture text.
      Use readBranchHead and resetBranch while preserving branch-head conflation,
      task branches and both dry-run in-memory defects. Do not touch other engine
      files, fanout/**, packages/shared/**, tests, docs/**, contracts/**, backlog/**,
      harness/** or spike/**.
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
      runFlow, the stage precondition, context construction, Q-0049 persistence
      adaptation, producer orchestration, step loop, run banner, stepId enrichment
      and failure propagation through lifecycle and channel. Verify the engine
      folder has no console output, ANSI, signal subscription, process exit,
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
