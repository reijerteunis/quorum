# Q-0015 — Mission control streams a run live, one trace column per step

## Chosen approach

Build two read-only browser screens over channels already shipped:

1. `/runs` reads the daemon’s ordered run listing once, renders the five existing request states, and links each row to mission control.
2. `/runs/:handle` renders the existing connection snapshot as:
   - one lossless run-activity lane for events without a `stepId` field;
   - one column per exact `stepId`, ordered by first appearance;
   - a three-disposition timeline derived only from observed `step` and `done` events;
   - metadata and a gate link derived from the existing run read;
   - explicit disclosures for missing values and retained-history loss.

The browser event tail is bounded at 500 accepted events, matching the daemon’s existing retention. The implementation preserves immutable snapshots by creating a new bounded array on append, evicts from the head, and records browser eviction separately from the daemon’s replay omission count.

The implementation remains wholly inside `apps/web` except for the required M3 documentation updates. It adds no dependency, daemon route, shared schema, event member, timestamp, persistence, polling, or mutation.

The decomposition uses contracts to keep tasks independent. The pure projection module defines trace and timeline outputs; the two screen component stubs define their application boundary; the route builders define navigation; and the prose contract freezes behavior that should not be duplicated as machine-readable domain schemas.

### Important implementation rules

- Test files remain owned by the earlier `qa-red` phase. Every development task below must not modify `apps/web/src/**/*.test.ts` or `apps/web/test/**`.
- Human-readable event fields are display text, never machine contracts. No task may parse `done.message`, `step.message`, `info.message`, `warn.message`, `spawn.cmd`, or `stdout.line` to derive vendor, model, cost, tokens, branch, verdict, or attribution.
- React text rendering supplies escaping for event output. No raw-HTML API is introduced.
- `ConnectionState` and `RequestState` remain separate state machines.
- The existing write guard is not re-aimed. Starting and stopping runs remain successors.
- The existing event union and wire schemas are imported unchanged.

## Contracts

The following contracts were created in the repository worktree.

### Typed stubs at final package paths

- `apps/web/src/mission-control-model.ts`
  - `RUN_EVENT_RETENTION`
  - `TraceColumn`
  - `TracePartition`
  - `StepDisposition`
  - `StepTimelineItem`
  - `partitionTrace(events)`
  - `buildStepTimeline(events)`
  - The two functions deliberately throw `not implemented`; red tests can compile against their final names.
- `apps/web/src/runs-screen.tsx`
  - `RunsScreenProps`
  - `RunsScreen(props)`
  - The component is at its final path and deliberately throws `not implemented`.
- `apps/web/src/mission-control-screen.tsx`
  - `MissionControlScreenProps`
  - `MissionControlScreen(props)`
  - The component is at its final path and deliberately throws `not implemented`.
- `apps/web/src/daemon-client.ts`
  - `fetchRuns(fetcher, now)` returning `Promise<RequestState<WireRunList>>`.
  - The function uses the existing shared schema symbol and deliberately throws `not implemented`.

### Extended existing typed contracts

- `apps/web/src/run-connection.ts`
  - `RunConnectionSnapshot.browserDiscardedCount: number | null` records browser eviction independently from `missedCount`.
- `apps/web/src/routes.ts`
  - `RUNS_PATH`
  - `RUN_ROUTE`
  - `runPath(handle)`
  - `gatePath(handle)`
  - These names prevent components from introducing route literals.
- `apps/web/src/app.tsx`
  - `IDLE_SNAPSHOT` now satisfies the extended snapshot contract with a null browser-discard count.

### Prose contract

- `contracts/Q-0015/mission-control.contract.md`
  - Freezes the listing read behavior, row order and null-ticket wording.
  - Freezes trace partitioning, vendor derivation, timeline dispositions, retention and loss disclosure.
  - Freezes absent-value disclosures, connection-state behavior, gate navigation, and the unchanged write boundary.

No JSON Schema was created because Q-0015 introduces no data shape. No migration skeleton was created because it introduces no persistence. No shared-package contract was added because the existing event and wire contracts already carry every field this solution is allowed to consume.

## Detailed design

### Runs landing

`RunsScreen` owns its request state and performs `fetchRuns` on mount. Refresh or a retry replaces that state with a new in-flight state and performs one further read. There is no interval or timeout.

A loaded response is rendered in wire order. A row shows only supplied fields: handle, flow, state, pending-gate count, and either its ticket id or the contract’s explicit absence sentence. `runPath` supplies the row link. An empty loaded response explains both that the daemon is driving no runs and why a real installation can remain empty today.

### Mission-control projection

`partitionTrace` performs one ordered pass over retained events:

- Events with a `stepId` field enter the column keyed by that exact string.
- A column is created at the first occurrence of its id and never reordered.
- Events without a `stepId` field enter the run-activity lane.
- Vendor is derived only from `spawn.vendor` and `retry.vendor` for the same id.
- The output conserves all inputs: lane length plus column event lengths equals input length.

`buildStepTimeline` also performs an ordered pass. It creates rows only for ids observed on `step` or `done`. A retained `done` without a retained `step` is a valid ended row. An unmatched start remains `started` until a terminal event is observed, after which it is rendered as `started-with-no-end-reported`, not as running.

These projections are pure and DOM-free. `MissionControlScreen` owns rendering, metadata request state, the gate link, and human-facing disclosures.

### Bounded snapshots

`createRunConnection` continues to return immutable snapshots. On each accepted event it:

1. appends the event;
2. retains the newest `RUN_EVENT_RETENTION` entries;
3. increments `browserDiscardedCount` by the number evicted;
4. hands consumers a newly allocated retained array.

A reconnect to another handle resets events, daemon missed count, and browser discard count. Callbacks from superseded, closed, or disposed sockets retain their existing inability to mutate state.

The UI renders daemon replay loss and browser live eviction as different sentences. Neither appears at null or zero. The trace is described as a retained tail, never as complete history.

### Application and routes

`app.tsx` selects `RunsScreen` by `RUNS_PATH` and `MissionControlScreen` by `RUN_ROUTE`. It passes the existing connection snapshot and retry action into mission control. The gate route remains excluded from socket ownership.

The route register changes are data changes, not a second routing system:

- the runs rail entry becomes available;
- `/runs` becomes a Q-0015 screen and receives a durable non-empty `waitingFor` sentence;
- `/runs/:handle` becomes available;
- all component navigation uses exported builders.

### Documentation

The M3 architecture section and Q-0015 development-plan bullet are updated to describe what shipped and what remains deferred. They must state that a daemon-visible run still requires an external producer and that start/stop and measured header values are successor work.

## Rejected alternatives

### Include the stop button

Rejected. The browser cannot currently start a daemon-owned run, so stop has no normal browser-created subject. Start and stop are one lifecycle mutation boundary and should be designed together. Including stop here would widen `WRITE_RULES`, introduce confirmation and in-flight races, and contradict the accepted fourteen-criterion seam.

### Leave `/runs` for a successor

Rejected. Mission control would remain reachable only through a manually typed opaque handle. The shipped listing route and schema make the landing a small read-only addition, and the landing is also the only honest place to explain why the daemon registry is empty.

### Keep the browser event array unbounded

Rejected. Copy-on-append becomes quadratic and retains memory without limit on the screen most likely to remain open. Rendering only a capped projection would hide the memory problem rather than solve it.

### Choose a new browser-specific retention number

Rejected. No per-run event-count measurement exists. Using a novel figure would be arbitrary. The daemon’s existing 500-event retention is the only shipped, disclosed bound available; verification from this ticket supplies evidence for later reconsideration.

### Mutate old snapshots to obtain constant-time append

Rejected. Existing consumers rely on snapshots not changing after delivery. A bounded fresh array retains that contract while making the total copy cost bounded.

### Parse message prefixes or completion prose

Rejected. Message text is human output, not a contract. Parsing it would misattribute run-level events and would duplicate the same structural defect already identified for verdict and cost.

### Add timestamps, sequence numbers, costs, or step lists to the wire

Rejected. Those changes contradict the scoped requirement and, for event timestamps, a landed decision. They require separate measurement and decision work.

### Render absent header values as dashes, zeroes, skeletons, or connection-age estimates

Rejected. Each would fabricate a measured value or imply that one is forthcoming from this request. Mission control instead names the missing source.

### Reuse the gate event as the gate-link source

Rejected. A late joiner may not receive the event. `WireRun.pendingGates` is the durable existing read contract for actionability.

## Tasks

```yaml
- id: Q0015-T01
  role: frontend
  title: Implement the ordered runs-list daemon read
  description: >-
    Own apps/web/src/daemon-client.ts and replace only the fetchRuns typed stub with a requestJson
    read through wireRunListSchema. Do not touch any other source file, any test file, shared schemas,
    endpoint definitions, or write methods.
  contracts:
    - apps/web/src/daemon-client.ts#fetchRuns
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []

- id: Q0015-T02
  role: frontend
  title: Implement lossless trace and timeline projections
  description: >-
    Own apps/web/src/mission-control-model.ts and implement partitionTrace and buildStepTimeline
    against the existing Event union. Do not touch React components, transport state, routes,
    daemon-client.ts, or any test file.
  contracts:
    - apps/web/src/mission-control-model.ts
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []

- id: Q0015-T03
  role: frontend
  title: Bound the live connection snapshot and count browser evictions
  description: >-
    Own apps/web/src/run-connection.ts and implement newest-500 retention using
    RUN_EVENT_RETENTION, exact browserDiscardedCount accounting, reset behavior, and immutable prior
    snapshots. Do not touch projection code, components, routes, daemon-client.ts, or any test file.
  contracts:
    - apps/web/src/mission-control-model.ts#RUN_EVENT_RETENTION
    - apps/web/src/run-connection.ts#RunConnectionSnapshot
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
  depends_on: []

- id: Q0015-T04
  role: frontend
  title: Activate the registered runs routes and path builders
  description: >-
    Own apps/web/src/routes.ts and replace the two literal runs paths with RUNS_PATH and RUN_ROUTE,
    mark the runs rail and both Q-0015 route rows as built, assign the landing to Q-0015, and retain
    non-empty durable waitingFor text. Do not touch app.tsx, components, styling, daemon-client.ts,
    or any test file.
  contracts:
    - apps/web/src/routes.ts#RUNS_PATH
    - apps/web/src/routes.ts#RUN_ROUTE
    - apps/web/src/routes.ts#runPath
    - apps/web/src/routes.ts#gatePath
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []

- id: Q0015-T05
  role: frontend
  title: Implement the read-only runs landing screen
  description: >-
    Own apps/web/src/runs-screen.tsx and implement its mount read, explicit refresh and retry,
    five request-state presentations, honest empty state, response-order rows, explicit null-ticket
    wording, and runPath navigation. Do not touch daemon-client.ts, routes.ts, app.tsx, shared styling,
    mission-control files, or any test file.
  contracts:
    - apps/web/src/runs-screen.tsx#RunsScreenProps
    - apps/web/src/daemon-client.ts#fetchRuns
    - apps/web/src/routes.ts#runPath
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []

- id: Q0015-T06
  role: frontend
  title: Implement the mission-control trace and timeline screen
  description: >-
    Own apps/web/src/mission-control-screen.tsx and implement metadata request states, trace columns,
    run activity, timeline, vendor badges, both loss disclosures, five unavailable-value sentences,
    connection-state main-region prose, and the pendingGates-derived gate link. Render all event text
    through React text nodes. Do not touch the model, connection, client, routes, app integration,
    shared styling, or any test file.
  contracts:
    - apps/web/src/mission-control-screen.tsx#MissionControlScreenProps
    - apps/web/src/mission-control-model.ts
    - apps/web/src/routes.ts#gatePath
    - contracts/Q-0015/mission-control.contract.md
  depends_on: []

- id: Q0015-T07
  role: frontend
  title: Select both Q-0015 screens in the application shell
  description: >-
    Own apps/web/src/app.tsx and replace the Q-0015 placeholders with RunsScreen and
    MissionControlScreen selected by RUNS_PATH and RUN_ROUTE, passing the existing fetch, clock,
    navigation, snapshot, connection sentence and retry seams. Preserve one re-targeted controller
    across run routes and keep GATE_ROUTE socket-free. Do not touch screen implementations, routes.ts,
    run-connection.ts, styling, or any test file.
  contracts:
    - apps/web/src/runs-screen.tsx#RunsScreenProps
    - apps/web/src/mission-control-screen.tsx#MissionControlScreenProps
    - apps/web/src/run-connection.ts#RunConnectionSnapshot
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []

- id: Q0015-T08
  role: frontend
  title: Add responsive trace-column and timeline styling
  description: >-
    Own apps/web/src/theme.css and add only the layout rules needed for horizontally accessible
    trace columns, readable raw output, run activity, timeline rows, loss notices and narrow screens.
    Do not touch components, TypeScript, route data, generated assets, or any test file.
  contracts:
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
  depends_on: []

- id: Q0015-T09
  role: backend
  title: Record the shipped M3 scope and its deferred successors
  description: >-
    Own docs/04-architecture.md and docs/06-development-plan.md and update only the M3 mission-control
    material to record the two read-only screens, retained-tail disclosure, absent daemon run producer,
    and deferred lifecycle/header successors. Do not touch decisions, glossary, application code,
    contracts, harness files, backlog files, or tests.
  contracts:
    - contracts/Q-0015/mission-control.contract.md#write-boundary
  depends_on: []
```

All tasks are independent because their imported names and behavior are fixed by the committed contracts. No development task shares an owned file with another task. The frontend tasks run on the frontend role’s vendor, while the documentation task runs independently on the backend role’s different vendor, giving the fan-out a genuine second-vendor pass without granting either task overlapping ownership.

The red phase remains responsible for changes to `apps/web/src/**/*.test.ts`, `apps/web/test/routes.test.ts`, and other files under `apps/web/test/`. Development tasks are explicitly forbidden from modifying those files.
