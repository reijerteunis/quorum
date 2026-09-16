# Q-0015 — Mission control streams a run live, one trace column per step

*Solution, run 2, iteration 3, 2026-09-16.*

## Chosen approach

Build two read-only browser screens over the existing daemon and wire contracts.

1. `/runs` reads `GET /runs` once on mount, preserves daemon order, offers an explicit Refresh, and links each row to mission control.
2. `/runs/:handle` uses the existing socket snapshot and one metadata read. Its rendering is split into three modules with file-level ownership:
   - `mission-control-trace.tsx` renders the run-activity lane and exact-`stepId` columns;
   - `mission-control-status.tsx` renders connection and request states, run identity, both loss notices, disclosures, and the pending-gate link;
   - `mission-control-screen.tsx` performs the metadata read, composes those regions, and renders the observed-only step timeline.
3. Pure projections remain in `mission-control-model.ts`: a lossless event partition and the three-disposition timeline model.
4. The browser retains the newest 500 accepted events. `run-connection.ts`, where this policy is enforced, owns the constant and the independent browser-discard counter.
5. Acceptance-sensitive copy remains frozen in `mission-control-text.ts`. It is already a complete code contract and therefore receives no empty implementation task.
6. `App` retains one controller across run-handle changes, disposes it when leaving run routes, and continues to create no socket on the gate route.
7. Layout uses the app’s existing component utility-class pattern. No unverifiable raw-CSS task is introduced.
8. The app remains read-only except for the previously shipped gate answer. Q-0015 neither starts nor stops runs and does not change `WRITE_RULES`.

The design adds no dependency, daemon route, wire schema, event-union member, persistence, polling, timestamp, migration, or decision entry.

### Required AC-6 erratum

The requirement’s proposed whole-corpus ban on bare `role=` cannot hold: `apps/web/src/backlog-board.test.ts` legitimately contains `[role="progressbar"]`, and the state tests may use the same accessibility-selector idiom. No implementation task owns that shipped test, and deleting or weakening it is not an acceptable fix.

The gate must ratify this narrow correction before QA writes the red suite:

- Keep the complete `apps/web/src` corpus, including tests and non-TypeScript files.
- Scan for twelve parsing needles: each of `cost=`, `role=`, and `verdict=` prefixed by a single quote, double quote, backtick, or slash.
- Prove both directions: a template-literal parsing fixture is rejected, while `[role="progressbar"]` is accepted.
- Assemble the fixture strings so the guard does not flag its own source.

This preserves AC-6’s purpose—preventing machine parsing of human prose—without narrowing the corpus or banning unrelated ARIA selectors.

## Rejected alternatives

### Parse messages for model, branch, cost, tokens, verdict, or attribution

Rejected because human-readable messages are not contracts. Event messages and stdout remain escaped text; no renderer parses `step`, `done`, `info`, `warn`, `spawn.cmd`, or `stdout.line` for machine values.

### Add timestamps, sequence numbers, structured cost fields, or new event kinds

Rejected because Q-0015 does not own the event union. Timestamping also contradicts the landed event-stream decision. Structured header values remain successor work coordinated with Q-0129.

### Leave browser retention unbounded

Rejected because immutable append would remain O(n) per event and quadratic over a long run in a screen intended to stay open.

### Choose a new browser-only retention number

Rejected because no per-run event-count measurement exists. The daemon’s disclosed 500-event retention is the only existing product value. Verification will record event count and peak concurrent-column count so a successor can revisit the bound with evidence.

### Cap only rendered rows

Rejected because it leaves the transport’s unbounded quadratic append intact and creates a hidden second history extent.

### Drop or infer ownership for events without `stepId`

Rejected. Dropping loses much of the engine’s account of a run; parsing message prefixes invents structure. These events belong to a separately labelled run-activity lane.

### Treat every unmatched start as currently running

Rejected because failure paths do not emit `done`. Once a terminal event arrives, an unmatched start is reported as “the run ended without reporting an end for this step.”

### Derive the gate link from a streamed `gate` event

Rejected because a late joiner may not receive that event. The link derives from loaded `WireRun.pendingGates` and the registered route.

### Put stop back into Q-0015

Rejected because the browser cannot start a daemon-owned run today. Start and stop are one lifecycle-write successor and require a deliberate widening of the guarded mutation boundary.

### Omit the runs landing

Rejected because mission control would remain reachable only by manually typing an opaque handle. The listing is one read against a shipped endpoint and schema.

### Add a raw-CSS task for the new screens

Rejected because `theme.css` holds tokens while this app expresses layout through component utility classes. No acceptance criterion or stable selector vocabulary supports a separate CSS task.

### Give another development role access to `apps/web`

Rejected because the repository role contract grants `apps/*` only to `frontend`. Changing that grant is a harness architecture decision outside this ticket. The application implementation is necessarily single-vendor; independent vendor scrutiny occurs in architecture and code review.

## Contracts

Code contracts live at their final paths under `apps/web/src`. Non-code contract prose lives under `contracts/Q-0015/`. No schema or migration skeleton is created because no persisted or wire shape changes.

### Created or extended in the worktree

- `contracts/Q-0015/mission-control.contract.md`
  - Freezes routes and reads, lossless partitioning, latest-observed vendor semantics, timeline dispositions, retention, disclosures, connection lifetime, the unchanged write boundary, documentation outcomes, and rendering anchors.
  - Defines the corrected twelve-needle AC-6 guard and its positive and negative fixtures.
  - Defines `data-mission-control-header` and nested `data-run-identity`, in addition to the previously frozen state, disclosure, disposition, and request-state anchors.
- `apps/web/src/mission-control-model.ts`
  - Typed stub for `TraceColumn`, `TracePartition`, `StepDisposition`, `StepTimelineItem`, `partitionTrace`, and `buildStepTimeline`.
- `apps/web/src/mission-control-text.ts`
  - Complete typed copy contract for `EMPTY_RUNS_TEXT`, `STEP_DISPOSITION_TEXT`, `MISSION_CONTROL_DISCLOSURES`, `daemonMissedText`, and `browserDiscardedText`.
- `apps/web/src/mission-control-trace.tsx`
  - Typed component stub for `MissionControlTraceProps` and `MissionControlTrace`, owning the run lane and trace columns.
- `apps/web/src/mission-control-status.tsx`
  - Typed component stub for `MissionControlStatusProps` and `MissionControlStatus`, owning state, identity, losses, disclosures, and gate navigation.
- `apps/web/src/mission-control-screen.tsx`
  - Typed composition stub for `MissionControlScreenProps` and `MissionControlScreen`; redundant `connectionText` and `retryable` props were removed so state prose and retryability must derive from `snapshot.state`.
- `apps/web/src/runs-screen.tsx`
  - Typed component stub for `RunsScreenProps` and `RunsScreen`.
- `apps/web/src/daemon-client.ts`
  - Typed `fetchRuns` stub returning `RequestState<WireRunList>` through the existing request vocabulary. Its synchronous throw is stub behavior only; red tests exercise the implemented promise contract rather than treating the throw as product behavior.
- `apps/web/src/routes.ts`
  - Final route symbols `RUNS_PATH`, `RUN_ROUTE`, `runPath`, and `gatePath`.
- `apps/web/src/run-connection.ts`
  - Extends `RunConnectionSnapshot` with `browserDiscardedCount` and owns `RUN_EVENT_RETENTION = 500` with the three-part AC-9 rationale.
- `apps/web/src/app.tsx`
  - Extends the idle snapshot to satisfy the revised connection snapshot contract.

The initial contracts were committed on `harness/Q-0015/contracts` at `f1e21b1`; the iteration-2 revisions are committed at `d90768f`. The iteration-3 contract split and prose corrections are present in this worktree. A commit was attempted, but the sandbox denied creation of the parent repository’s worktree `index.lock`; they must be committed by the surrounding workflow before fan-out.

## Contract details

### Trace partition

`partitionTrace(events)` conserves the input: every event appears exactly once in either `runActivity` or one column. Columns use exact `stepId` equality, retain event arrival order, and retain first-appearance column order. Vendor is the latest value observed on that step’s `spawn` or `retry`; absence remains `null`.

### Timeline

`buildStepTimeline(events)` emits one item per id observed on `step` or `done`:

- `started`: a start was observed and the run has not ended;
- `ended`: a done was observed, including when retention removed its start;
- `started-with-no-end-reported`: a terminal was observed after an unmatched start.

No queued or otherwise unobserved step is invented.

### Text and anchors

Acceptance-sensitive text comes from `mission-control-text.ts`. The renderers expose:

- `data-mission-control-state` on the main connection-state region;
- `data-mission-control-disclosures` on the five-sentence disclosure region;
- `data-mission-control-header` on the complete header subject to the no-placeholder assertion;
- `data-run-identity` on the nested handle-or-terminal-run-number region;
- `data-step-disposition` on timeline rows;
- the existing `data-request-state` idiom on landing and metadata request states.

The two loss sentences satisfy an executable distinction: each contains at least one word absent from the other—`daemon`/`replay` versus `browser`/`discarded`/`bounded`. Shared words such as “earlier” and “events” do not fail the check.

### Connection state derivation

`MissionControlStatus` receives the socket snapshot, not separately supplied connection prose or retryability. It derives text through `connectionStateText(snapshot.state)` and retry availability through `canRetry(snapshot.state)`. This prevents fixtures or callers from pairing a live state with an unrelated error sentence.

### Component layout ownership

`MissionControlTrace` owns utility classes for its labelled run lane and horizontally scrollable columns. `MissionControlStatus` owns utility classes for its header, state, loss, and disclosure regions. `MissionControlScreen` owns only composition and timeline layout. `RunsScreen` owns its list layout. No task must coordinate class names with `theme.css`.

## File ownership and QA boundary

Development tasks must not modify `apps/web/src/**/*.test.ts`, `apps/web/test/**/*.test.ts`, or any other test file. Those files belong to `qa-red`.

QA owns the red-suite changes in:

- `apps/web/src/daemon-client.test.ts`;
- `apps/web/src/run-connection.test.ts`;
- `apps/web/src/shell.test.ts`;
- new focused tests beside the model, trace, status, composition, text, and runs-screen modules;
- `apps/web/test/routes.test.ts`;
- `apps/web/test/source.test.ts`.

QA must apply the ratified AC-6 erratum, leave every existing `WRITE_RULES` assertion intact, and must not modify production, contract, or documentation files.

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
    RequestState promise contract. Do not touch any component, route, connection,
    contract, documentation, style, or test file.

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
    touch transport, React components, copy, routes, styles, documentation, or tests.

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
    events, increment browserDiscardedCount exactly, preserve prior snapshot
    immutability, reset both loss counters on retarget, and correct the stale Q-0121
    forecast in the append comment. Do not touch models, components, routes, copy,
    contracts, documentation, or tests.

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
    built, assign the runs landing to Q-0015, replace rather than empty waitingFor,
    use exported route constants in register rows, and update the nearby JSDoc from
    three ticket-null rows to two. Do not touch the router, app, components, tests,
    styles, contracts, or documentation.

- id: T05
  role: frontend
  title: Implement the runs landing screen
  contracts:
    - apps/web/src/runs-screen.tsx
    - apps/web/src/mission-control-text.ts#EMPTY_RUNS_TEXT
    - apps/web/src/routes.ts#runPath
    - apps/web/src/daemon-client.ts#fetchRuns
    - contracts/Q-0015/mission-control.contract.md#routes-and-reads
  depends_on: []
  description: >-
    Own only apps/web/src/runs-screen.tsx and implement one mount read, explicit
    refresh, five request-state presentations, the contracted loaded-empty text,
    daemon-order rows, explicit null-ticket text, runPath navigation, and the
    screen's utility-class layout. Do not edit copy, clients, routes, app wiring,
    mission control, theme.css, contracts, documentation, or tests.

- id: T06
  role: frontend
  title: Render the lossless run lane and trace columns
  contracts:
    - apps/web/src/mission-control-trace.tsx
    - apps/web/src/mission-control-model.ts#partitionTrace
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-trace.tsx and render the labelled
    run-activity lane plus one horizontally accessible column per exact stepId,
    with latest observed vendor and arrival-ordered event fields rendered as React
    text. Use local utility classes and parse no message. Do not touch projections,
    status, composition, transport, copy, routes, theme.css, documentation, or tests.

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
    Own only apps/web/src/mission-control-status.tsx and render connection and
    metadata states, retry actions, the contracted header and identity anchors,
    independent loss notices, five disclosures, terminal run number, and the
    pendingGates-derived gate link. Derive connection prose and retryability from
    snapshot.state and use local utility classes. Do not touch trace, composition,
    copy, clients, projections, routes, theme.css, documentation, or tests.

- id: T08
  role: frontend
  title: Compose mission control and render its observed timeline
  contracts:
    - apps/web/src/mission-control-screen.tsx
    - apps/web/src/mission-control-trace.tsx#MissionControlTrace
    - apps/web/src/mission-control-status.tsx#MissionControlStatus
    - apps/web/src/mission-control-model.ts#buildStepTimeline
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []
  description: >-
    Own only apps/web/src/mission-control-screen.tsx; perform the handle metadata
    read, compose the contracted trace and status components, and render the
    observed-only timeline with its disposition anchors and local utility classes.
    Do not duplicate child-region rendering or edit child components, clients,
    projections, copy, routes, app wiring, theme.css, documentation, or tests.

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
    pass request and connection inputs, preserve one controller across handle
    changes, dispose it on leaving run routes, keep GATE_ROUTE socket-free, and
    prevent stale callbacks from affecting the new route. Do not touch screen
    implementations, connection internals, routes, styles, contracts,
    documentation, or tests.

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

All ten development tasks own disjoint file sets and can run in one wave after the iteration-3 contracts are committed. Every task therefore declares `depends_on: []`. T10 is a legitimate backend-owned documentation task, but it is not represented as a second-vendor implementation of `apps/web`; the repository’s role grants make such a claim false.

## Verification

QA should make these assertions red before implementation and green afterward:

- `fetchRuns` makes one schema-validated read; mount, fake-time advance, and explicit refresh prove there is no polling.
- Listing rows preserve daemon order and render handle, flow, state, pending gates, and explicit ticket absence across all five request states.
- Alternating events for two concurrent ids produce two stable columns; repeated identical ids or the literal string `undefined` produce one.
- Run-lane length plus all column lengths equals input length, including prefixed `info`, `warn`, `gate`, and `terminal` events.
- Vendor is absent until supplied and follows the latest `spawn` or `retry` for that id.
- Markup-bearing stdout renders as text.
- The complete source corpus rejects all twelve delimiter-aware parse forms, rejects a template-literal parsing fixture, and accepts `[role="progressbar"]`.
- All four timeline cases render, including a retained `done` without its start and the post-terminal third disposition.
- All nine connection states produce main-region prose; `no-such-run` produces no columns; metadata and socket states remain distinguishable.
- Retention at 500, 501, and continuing overflow preserves newest order, exact discard count, and earlier snapshot immutability.
- Daemon loss, browser loss, and both together use their own values and satisfy the contracted lexical distinction.
- The five disclosure sentences render under `data-mission-control-disclosures`.
- The text under `data-mission-control-header` contains none of `—`, `$`, `0:00`, or `n/a`.
- `data-run-identity` shows the handle before a terminal run number exists and the run number afterward.
- The gate link derives from loaded `pendingGates`, including when the socket supplied no gate event.
- Handle-to-handle navigation reuses one controller; leaving run routes disposes it; superseded callbacks are inert; the gate route creates no socket.
- Route-register counts move from one to two rail screens and three to five route screens.
- Every existing `WRITE_RULES` assertion remains byte-for-byte unchanged, including the forbidden stop path.

The demonstration against a running daemon must record the hand `POST /runs` request that produced the run, its observed event count, and peak concurrent-column count. It must not imply that the browser or `quorum run` populated the daemon registry.
