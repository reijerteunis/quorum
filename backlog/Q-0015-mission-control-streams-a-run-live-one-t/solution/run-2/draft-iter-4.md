# Q-0015 — Mission control streams a run live, one trace column per step

*Solution, run 2, iteration 4, 2026-09-16. This draft supersedes iterations 1–3; its Contracts and Tasks sections are the only versions to use.*

## Chosen approach

Build two read-only browser screens over the existing daemon and wire contracts.

1. `/runs` reads `GET /runs` once on mount, preserves daemon order, offers an explicit Refresh, and links each row to mission control.
2. `/runs/:handle` uses the existing socket snapshot and one metadata read. Rendering is divided by region:
   - `mission-control-trace.tsx` renders the run-activity lane and exact-`stepId` columns;
   - `mission-control-status.tsx` renders connection and request states, run identity, both loss notices, disclosures, and the pending-gate link;
   - `mission-control-screen.tsx` performs the metadata read, composes those regions, and renders the observed-only timeline.
3. `mission-control-model.ts` owns pure, lossless projections for trace partitioning and the three-disposition timeline.
4. `run-connection.ts` retains the newest 500 accepted events and counts browser-side discards independently from daemon replay loss.
5. Acceptance-sensitive copy is frozen in `mission-control-text.ts`, including the null-ticket sentence. The module is a complete contract and needs no implementation task.
6. `App` retains one controller across run-handle changes, disposes it on leaving run routes, and creates no socket on the gate route.
7. Layout follows the existing component utility-class pattern. No raw-CSS task is introduced.
8. The app remains read-only except for the previously shipped gate answer. Q-0015 neither starts nor stops runs and does not change `WRITE_RULES`.

The design adds no dependency, daemon route, wire schema, event-union member, persistence, polling, timestamp, migration, or decision entry.

### Required AC-6 erratum

The requirement’s proposed whole-corpus ban on bare `role=` cannot hold because `apps/web/src/backlog-board.test.ts` legitimately contains `[role="progressbar"]`. The ruling is recorded in `solution/errata.md`, which the QA scenario phase reads.

The corrected guard:

- keeps the complete `apps/web/src` corpus, including tests and non-TypeScript files;
- scans twelve parsing needles: each of `cost=`, `role=`, and `verdict=` prefixed by a single quote, double quote, backtick, or slash;
- rejects a template-literal parsing fixture and accepts `[role="progressbar"]`;
- assembles fixture strings so the guard does not flag its own source.

This preserves AC-6’s prohibition on deriving machine values from human prose without weakening the existing accessibility assertion.

## Rejected alternatives

### Parse messages for model, branch, cost, tokens, verdict, or attribution

Rejected because human-readable messages are not contracts. Event messages and stdout remain escaped text; no renderer parses `step`, `done`, `info`, `warn`, `spawn.cmd`, or `stdout.line` for machine values.

### Add timestamps, sequence numbers, structured cost fields, or new event kinds

Rejected because Q-0015 does not own the event union. Structured header values remain successor work coordinated with Q-0129.

### Leave browser retention unbounded

Rejected because immutable append would remain O(n) per event and quadratic over a long run in a screen intended to stay open.

### Choose a new browser-only retention number

Rejected because no per-run event-count measurement exists. The daemon’s disclosed 500-event retention is the only existing product value. Verification will record event count and peak concurrent-column count for later reconsideration.

### Cap only rendered rows

Rejected because it leaves the transport’s unbounded quadratic append intact and creates a hidden second history extent.

### Drop or infer ownership for events without `stepId`

Rejected. Dropping loses much of the engine’s account of a run; parsing message prefixes invents structure. These events belong to a separately labelled run-activity lane.

### Treat every unmatched start as currently running

Rejected because failure paths do not emit `done`. After a terminal event, an unmatched start is reported as a step for which the run ended without reporting an end.

### Derive the gate link from a streamed `gate` event

Rejected because a late joiner may not receive that event. The link derives from loaded `WireRun.pendingGates` and the registered route.

### Put stop back into Q-0015

Rejected because the browser cannot start a daemon-owned run today. Start and stop form one lifecycle-write successor and require deliberate widening of the guarded mutation boundary.

### Omit the runs landing

Rejected because mission control would remain reachable only by manually typing an opaque handle. The listing is one read against a shipped endpoint and schema.

### Add a raw-CSS task

Rejected because `theme.css` owns tokens while layout is expressed through component utility classes. A separate CSS task would have neither an acceptance criterion nor contracted selectors.

### Give another development role access to `apps/web`

Rejected because the repository role contract grants `apps/*` only to `frontend`. The application fan-out is necessarily single-vendor; independent vendor scrutiny occurs in architecture and code review. The backend task below owns documentation only and is not presented as a second-vendor implementation.

## Contracts

Typed code contracts live at their final paths under `apps/web/src`. Non-code contract prose lives under `contracts/Q-0015/`. No data schema or migration skeleton is created because no persisted or wire shape changes.

### Created or extended in the worktree

- `contracts/Q-0015/mission-control.contract.md`
  - Freezes routes and reads, lossless partitioning, latest-observed vendor semantics, timeline dispositions, retention, disclosures, connection lifetime, the unchanged write boundary, documentation outcomes, and rendering anchors.
  - Defines `data-trace-step-id`, whose value is the exact column `stepId`, and `data-run-activity` for the run-level lane.
  - Defines `data-mission-control-state`, `data-mission-control-disclosures`, `data-mission-control-header`, `data-run-identity`, `data-step-disposition`, and the existing `data-request-state` idiom.
  - Requires the displayed run number to come from the terminal event in the socket snapshot, never from a second metadata read.
  - Defines the corrected twelve-needle AC-6 guard and both discriminating fixtures.
- `apps/web/src/mission-control-model.ts`
  - Typed stub for `TraceColumn`, `TracePartition`, `StepDisposition`, `StepTimelineItem`, `partitionTrace`, and `buildStepTimeline`.
- `apps/web/src/mission-control-text.ts`
  - Complete typed copy contract for `NO_TICKET_ID_TEXT`, `EMPTY_RUNS_TEXT`, `STEP_DISPOSITION_TEXT`, `MISSION_CONTROL_DISCLOSURES`, `daemonMissedText`, and `browserDiscardedText`.
- `apps/web/src/mission-control-trace.tsx`
  - Typed component stub for `MissionControlTraceProps` and `MissionControlTrace`, owning the run lane and trace columns.
- `apps/web/src/mission-control-status.tsx`
  - Typed component stub for `MissionControlStatusProps` and `MissionControlStatus`, owning state, identity, losses, disclosures, and gate navigation.
- `apps/web/src/mission-control-screen.tsx`
  - Typed composition stub for `MissionControlScreenProps` and `MissionControlScreen`. Connection prose and retryability derive from `snapshot.state` rather than redundant props.
- `apps/web/src/runs-screen.tsx`
  - Typed component stub for `RunsScreenProps` and `RunsScreen`.
- `apps/web/src/daemon-client.ts`
  - Typed `fetchRuns` stub returning `Promise<RequestState<WireRunList>>` through the existing request vocabulary. Its synchronous throw is stub behaviour only; the implementation must return the promise contract.
- `apps/web/src/routes.ts`
  - Final route symbols `RUNS_PATH`, `RUN_ROUTE`, `runPath`, and `gatePath`.
- `apps/web/src/run-connection.ts`
  - Extends `RunConnectionSnapshot` with `browserDiscardedCount` and owns `RUN_EVENT_RETENTION = 500` with the three-part AC-9 rationale.
- `apps/web/src/app.tsx`
  - Extends the idle snapshot to satisfy the revised connection snapshot contract.
- `backlog/Q-0015-mission-control-streams-a-run-live-one-t/solution/errata.md`
  - Records the AC-6 correction where the QA scenario phase can read it.

Iterations 1 and 2 were committed on `harness/Q-0015/contracts` at `f1e21b1` and `d90768f`. Iteration 3 was committed at `0b1c965`. This iteration’s contract edits are committed by the engine when the architect step ends; the running step cannot observe its own resulting SHA, and no follow-up commit is owed to the surrounding workflow.

## Contract details

### Trace partition

`partitionTrace(events)` conserves the input: every event appears exactly once in either `runActivity` or one column. Columns use exact `stepId` equality, retain event arrival order, and retain first-appearance column order. Vendor is the latest value observed on that step’s `spawn` or `retry`; absence remains `null`.

The renderer marks every column with `data-trace-step-id="<exact stepId>"` and the run-level lane with `data-run-activity`. These are behavioural test anchors, not styling hooks.

### Timeline

`buildStepTimeline(events)` emits one item per id observed on `step` or `done`:

- `started`: a start was observed and the run has not ended;
- `ended`: a done was observed, including when retention removed its start;
- `started-with-no-end-reported`: a terminal was observed after an unmatched start.

No queued or otherwise unobserved step is invented. Renderers and tests import the exact labels from `STEP_DISPOSITION_TEXT`, and each row carries `data-step-disposition`.

### Retention and loss

The browser keeps the newest `RUN_EVENT_RETENTION` accepted events. Overflow evicts from the head, increments `browserDiscardedCount`, and does not mutate a previously returned snapshot.

Daemon replay loss and browser live-tail loss remain separate nullable counters with separate sentences. Each sentence contains a word absent from the other: `daemon`/`replay` versus `browser`/`discarded`/`bounded`.

### Run identity and absent values

The handle identifies a live run. If a terminal event exists in `snapshot.events`, its `runId` becomes the displayed number. The renderer does not obtain the number through a second metadata read.

The five disclosure sentences name unavailable elapsed time, structured cost/token totals, the next flow step, structured tool calls/reasoning, and the live run number before terminal. No dash, zero, currency value, spinner, or skeleton substitutes for missing data.

### Connection lifetime

`App` owns one controller while on non-gate run routes. A handle change retargets that controller; leaving run routes disposes it. The gate route creates none. Callbacks from superseded, closed, or disposed sockets cannot affect the current route.

## File ownership and QA boundary

Development tasks must not modify `apps/web/src/**/*.test.ts`, `apps/web/test/**/*.test.ts`, or any other test file. Those files belong to `qa-red`.

QA owns the red-suite changes in existing and new focused web tests, including `daemon-client.test.ts`, `run-connection.test.ts`, `shell.test.ts`, `routes.test.ts`, and `source.test.ts`. QA must apply `solution/errata.md`, leave all existing `WRITE_RULES` assertions intact, and must not modify production, contract, or documentation files.

## Tasks

```yaml
- id: T01
  role: frontend
  title: Implement the ordered runs-list read
  contracts:
    - apps/web/src/daemon-client.ts#fetchRuns
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/daemon-client.ts and implement fetchRuns through requestJson,
    DAEMON_ENDPOINTS.runs, and wireRunListSchema, returning the existing five-kind
    RequestState promise contract. Do not touch components, routes, connection code,
    contracts, documentation, styles, or tests.

- id: T02
  role: frontend
  title: Implement lossless trace and timeline projections
  contracts:
    - apps/web/src/mission-control-model.ts
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-model.ts and implement partitionTrace and
    buildStepTimeline, including exact-id grouping, first-appearance ordering,
    conservation, latest spawn-or-retry vendor, and all three dispositions. Do not
    touch transport, components, copy, routes, documentation, styles, or tests.

- id: T03
  role: frontend
  title: Bound the accepted event tail and count browser discards
  contracts:
    - apps/web/src/run-connection.ts#RUN_EVENT_RETENTION
    - apps/web/src/run-connection.ts#RunConnectionSnapshot
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
  depends_on: []
  description: >-
    Own only apps/web/src/run-connection.ts; retain the newest RUN_EVENT_RETENTION
    events, increment browserDiscardedCount exactly, preserve earlier snapshot
    immutability, reset both loss counters on retarget, and correct the stale Q-0121
    forecast in the append comment. Do not touch models, components, routes, copy,
    contracts, documentation, styles, or tests.

- id: T04
  role: frontend
  title: Finalize the mission-control route register
  contracts:
    - apps/web/src/routes.ts#RUNS_PATH
    - apps/web/src/routes.ts#RUN_ROUTE
    - apps/web/src/routes.ts#runPath
    - apps/web/src/routes.ts#gatePath
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/routes.ts; mark the runs rail and both Q-0015 route rows
    built, assign the landing to Q-0015, replace rather than empty waitingFor, use
    exported route constants, and update the nearby JSDoc from three ticket-null rows
    to two. Do not touch the router, app, components, tests, contracts, documentation,
    or styles.

- id: T05
  role: frontend
  title: Implement the runs landing screen
  contracts:
    - apps/web/src/runs-screen.tsx
    - apps/web/src/mission-control-text.ts#EMPTY_RUNS_TEXT
    - apps/web/src/mission-control-text.ts#NO_TICKET_ID_TEXT
    - apps/web/src/routes.ts#runPath
    - apps/web/src/daemon-client.ts#fetchRuns
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/runs-screen.tsx and implement one mount read, explicit
    refresh, five request-state presentations, contracted loaded-empty and null-ticket
    text, daemon-order rows, runPath navigation, and local utility-class layout. Do
    not edit copy, clients, routes, app wiring, mission control, theme.css, contracts,
    documentation, or tests.

- id: T06
  role: frontend
  title: Render the lossless run lane and trace columns
  contracts:
    - apps/web/src/mission-control-trace.tsx
    - apps/web/src/mission-control-model.ts#partitionTrace
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-trace.tsx and render the data-run-activity
    lane plus one data-trace-step-id column per exact stepId, with latest observed
    vendor and arrival-ordered event fields rendered as React text. Use local utility
    classes and parse no message. Do not touch projections, status, composition,
    transport, copy, routes, theme.css, documentation, contracts, or tests.

- id: T07
  role: frontend
  title: Render mission-control status and disclosures
  contracts:
    - apps/web/src/mission-control-status.tsx
    - apps/web/src/mission-control-text.ts
    - apps/web/src/routes.ts#gatePath
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-status.tsx and render connection and metadata
    states, retry actions, contracted header and identity anchors, independent loss
    notices, five disclosures, the terminal-event run number, and the pendingGates-
    derived gate link. Derive connection prose and retryability from snapshot.state
    and use local utility classes. Do not touch trace, composition, copy, clients,
    projections, routes, theme.css, documentation, contracts, or tests.

- id: T08
  role: frontend
  title: Compose mission control and render its observed timeline
  contracts:
    - apps/web/src/mission-control-screen.tsx
    - apps/web/src/mission-control-trace.tsx#MissionControlTrace
    - apps/web/src/mission-control-status.tsx#MissionControlStatus
    - apps/web/src/mission-control-model.ts#buildStepTimeline
    - apps/web/src/mission-control-text.ts#STEP_DISPOSITION_TEXT
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-screen.tsx; perform the handle metadata read,
    compose the contracted trace and status components, and render the observed-only
    timeline using STEP_DISPOSITION_TEXT, data-step-disposition, and local utility
    classes. Do not duplicate child regions or edit child components, clients,
    projections, copy, routes, app wiring, theme.css, documentation, contracts, or tests.

- id: T09
  role: frontend
  title: Wire both Q-0015 screens into the application
  contracts:
    - apps/web/src/app.tsx#App
    - apps/web/src/runs-screen.tsx#RunsScreen
    - apps/web/src/mission-control-screen.tsx#MissionControlScreen
    - contracts/Q-0015/mission-control.contract.md#connection-lifetime
  depends_on: []
  description: >-
    Own only apps/web/src/app.tsx; select both screens by route-register constants,
    pass request and connection inputs, preserve one controller across handle changes,
    dispose it on leaving run routes, keep GATE_ROUTE socket-free, and prevent stale
    callbacks from changing the new route. Do not touch screen implementations,
    connection internals, routes, styles, contracts, documentation, or tests.

- id: T10
  role: backend
  title: Record the shipped M3 mission-control surface
  contracts:
    - contracts/Q-0015/mission-control.contract.md#write-boundary
  depends_on: []
  description: >-
    Own only docs/04-architecture.md and docs/06-development-plan.md; update the M3
    apps/web account and Q-0015 plan entry to record the runs landing, bounded live
    trace, run-level lane, observed-only timeline, gate link, and missing-data
    disclosures, while retaining browser start/stop and structured header values as
    successors. Do not touch apps, packages, tests, contracts, the decisions index,
    or decision entries.
```

All ten development tasks own disjoint file sets and can run in one wave, so every task declares `depends_on: []`.

## Verification

QA must make the following assertions red before implementation and green afterward:

- `fetchRuns` makes one schema-validated read; fake-time advance makes no second read; explicit Refresh does.
- Listing rows preserve daemon order and import the contracted empty-list and null-ticket sentences.
- Alternating events for two ids produce two `data-trace-step-id` columns; identical ids, including the literal string `undefined`, produce one.
- `data-run-activity` length plus all column lengths equals input length, including prefixed `info`, `warn`, `gate`, and `terminal` events.
- Vendor is absent until supplied and follows the latest `spawn` or `retry` for that id.
- Markup-bearing stdout renders as text.
- The complete source corpus rejects all twelve delimiter-aware parse forms and accepts `[role="progressbar"]`.
- All four timeline fixtures render using `STEP_DISPOSITION_TEXT` under `data-step-disposition`.
- All nine connection states produce main-region prose; `no-such-run` produces no columns; metadata and socket states remain distinguishable.
- Retention at 500, 501, and continuing overflow preserves newest order, exact discard count, and earlier snapshot immutability.
- Daemon loss, browser loss, and both together use their own values and satisfy the lexical distinction.
- The five disclosure sentences render under `data-mission-control-disclosures`.
- `data-mission-control-header` contains none of `—`, `$`, `0:00`, or `n/a`.
- `data-run-identity` shows the handle before terminal and the terminal event’s run number afterward, without relying on metadata `runId`.
- The gate link derives from loaded `pendingGates`, including when the socket supplied no gate event.
- Handle-to-handle navigation reuses one controller; leaving run routes disposes it; superseded callbacks are inert; the gate route creates no socket.
- Route-register counts move from one to two rail screens and three to five route screens.
- Every existing `WRITE_RULES` assertion remains unchanged, including the forbidden stop path.

The demonstration against a running daemon must record the hand `POST /runs` request that produced the run, its observed event count, and its peak concurrent-column count. It must not imply that the browser or `quorum run` populated the daemon registry.
