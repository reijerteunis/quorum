# Q-0015 — Mission control streams a run live, one trace column per step

*Solution, run 2, iteration 2, 2026-09-16.*

## Chosen approach

Build two read-only browser screens over contracts that already exist:

1. `/runs` reads `GET /runs` once on mount, preserves daemon order, exposes explicit refresh, and links each row to mission control.
2. `/runs/:handle` projects the existing event snapshot into:
   - one lossless run-activity lane for events without `stepId`;
   - one column per exact `stepId`, ordered by first appearance;
   - a three-disposition timeline derived only from observed `step` and `done` events;
   - separately worded daemon-replay and browser-retention loss notices;
   - metadata, gate navigation, and explicit disclosures for values the wire cannot supply.
3. The browser retains the newest 500 accepted events. The constant belongs to `run-connection.ts`, where the policy is enforced, and the browser discard count is independent of the daemon’s `missedCount`.
4. User-facing sentences shared with assertions live in `mission-control-text.ts`. Rendering modules import them instead of independently inventing acceptance-sensitive wording.
5. `App` keeps the existing single-controller lifecycle: handle changes re-target the controller, leaving run routes disposes it, and the gate route remains socket-free.
6. The app remains read-only except for the previously shipped gate answer. Q-0015 neither starts nor stops a run and does not change `WRITE_RULES`.

The design introduces no package dependency, daemon route, wire schema, event-union member, persistence, polling, timestamp, or decision entry.

### AC-6 erratum required before red tests

The requirement’s proposed whole-corpus ban on bare `role=` is unsatisfiable: `apps/web/src/backlog-board.test.ts` legitimately contains `[role="progressbar"]`, and AC-3/AC-8 tests may use the same accessibility-selector idiom. No implementation task owns that shipped test, nor should it weaken the assertion.

The gate should ratify this narrow erratum:

- Keep the complete `apps/web/src` corpus, including tests and non-TypeScript files.
- Detect quoted or regex-delimited parsing needles: `'cost=`, `"cost=`, `/cost=`, and the corresponding `role=` and `verdict=` forms.
- Prove both directions: a fixture containing `line.split('role=')[1]` is rejected, while `[role="progressbar"]` is accepted.
- Assemble fixture needles so the guard does not flag its own source.

This preserves AC-6’s purpose—prohibiting machine parsing of human messages—without prohibiting unrelated ARIA selectors. Narrowing the corpus or deleting the existing selector assertion is expressly rejected.

## Rejected alternatives

### Parse messages to recover model, branch, cost, tokens, or attribution

Rejected because human-readable messages are not contracts. The screen renders them as escaped text and never parses `step`, `done`, `info`, `warn`, `spawn.cmd`, or `stdout.line` for machine values.

### Add timestamps, sequence numbers, cost fields, or new event kinds

Rejected because Q-0015 does not own the event union, and timestamping contradicts the landed event-stream decision. Structured header values remain a successor with Q-0129.

### Leave browser retention unbounded

Rejected because immutable append is otherwise O(n) per event and quadratic over a long run. A view intended to remain open must not grow without bound.

### Choose a new browser-only retention number

Rejected because the repository has no per-run event-count measurement. Reusing the daemon’s disclosed 500-event retention is the only existing product value. The demonstration records event count and peak column count so a successor can revisit it with evidence.

### Cap only rendered rows while retaining every event

Rejected because it leaves the transport’s unbounded quadratic append intact and creates a hidden second history extent.

### Drop or infer ownership for events without `stepId`

Rejected. Dropping loses much of the engine’s account of a run; parsing message prefixes invents structure. Such events go to one run-activity lane.

### Treat unmatched starts as running forever

Rejected because `done` is absent on failure paths. After a terminal event, an unmatched start is explicitly “the run ended without reporting an end for this step.”

### Derive the gate link from a streamed `gate` event

Rejected because a late joiner may not receive that event. The link is derived from loaded `WireRun.pendingGates` and the registered route.

### Put the stop button back into Q-0015

Rejected because nothing in the browser starts a daemon-owned run today. Start and stop are one lifecycle-write successor and require a separate widening of the guarded mutation boundary.

### Omit the runs landing

Rejected because it would leave mission control reachable only through a manually typed opaque handle. The listing is a small read over a shipped endpoint and schema.

### Give another development role access to `apps/web`

Rejected because the repository role contract grants `apps/*` only to `frontend`. Changing that grant would be a harness architecture decision outside this ticket. The implementation fan-out is therefore deliberately single-vendor; independent vendor scrutiny comes from architecture and code review, not a fictitious backend code task.

## Contracts

All code contracts are at their final paths in `apps/web/src`. Non-code contract prose is under `contracts/Q-0015/`. No schema or migration is created because no persisted or wire data shape changes.

### Created or extended in the worktree

- `contracts/Q-0015/mission-control.contract.md`
  - Freezes routes and reads, the lossless trace partition, latest-observed vendor semantics, timeline dispositions, retention and disclosure behavior, rendering anchors, connection lifetime, lexical distinction of loss sentences, the corrected AC-6 scan, and the unchanged write boundary.
- `apps/web/src/mission-control-model.ts`
  - Typed stub for `TraceColumn`, `TracePartition`, `StepDisposition`, `StepTimelineItem`, `partitionTrace`, and `buildStepTimeline`.
- `apps/web/src/mission-control-text.ts`
  - Typed copy contract for `EMPTY_RUNS_TEXT`, `STEP_DISPOSITION_TEXT`, `MISSION_CONTROL_DISCLOSURES`, `daemonMissedText`, and `browserDiscardedText`.
- `apps/web/src/mission-control-screen.tsx`
  - Typed component stub for `MissionControlScreenProps` and `MissionControlScreen`.
- `apps/web/src/runs-screen.tsx`
  - Typed component stub for `RunsScreenProps` and `RunsScreen`.
- `apps/web/src/daemon-client.ts`
  - Typed `fetchRuns` stub returning `RequestState<WireRunList>` through the existing browser request vocabulary.
- `apps/web/src/routes.ts`
  - Final route symbols `RUNS_PATH`, `RUN_ROUTE`, `runPath`, and `gatePath`.
- `apps/web/src/run-connection.ts`
  - Extends `RunConnectionSnapshot` with `browserDiscardedCount` and owns `RUN_EVENT_RETENTION = 500` with the three-part rationale required by AC-9.
- `apps/web/src/app.tsx`
  - Extends the idle snapshot to satisfy the revised `RunConnectionSnapshot` contract.

The initial contracts were committed on `harness/Q-0015/contracts` at `f1e21b1`. The iteration-2 revisions are present in this worktree; committing them was attempted but the sandbox could not create the parent repository’s worktree `index.lock`.

## Rendering contracts

### Trace partition

`partitionTrace(events)` conserves the input: every event appears exactly once in either `runActivity` or one column. Columns use exact `stepId` equality, retain event arrival order, and retain column first-appearance order. Vendor is the latest vendor observed on that step’s `spawn` or `retry`; absence remains `null`.

### Timeline

`buildStepTimeline(events)` emits one item per id observed on `step` or `done`:

- `started`: a start was observed and the run has not ended;
- `ended`: a done was observed, including when retention removed the start;
- `started-with-no-end-reported`: a terminal was observed after an unmatched start.

No unobserved or queued step is invented.

### Text and anchors

Acceptance-sensitive text comes from `mission-control-text.ts`. Mission control exposes:

- `data-mission-control-state` on its main state region;
- `data-mission-control-disclosures` on its five-sentence disclosure region;
- `data-step-disposition` on timeline rows;
- the existing `data-request-state` idiom on landing request states.

The two loss sentences satisfy an executable distinction: each contains words absent from the other—`daemon`/`replay` versus `browser`/`discarded`/`bounded`. Shared words such as “earlier” and “events” do not fail the check.

## File ownership and QA boundary

Development tasks must not modify `apps/web/src/**/*.test.ts` or `apps/web/test/**/*.test.ts`; those files belong to `qa-red`. QA owns the red-suite changes in:

- `apps/web/src/daemon-client.test.ts`
- `apps/web/src/run-connection.test.ts`
- `apps/web/src/shell.test.ts`
- new focused tests beside `mission-control-model.ts`, `mission-control-text.ts`, `runs-screen.tsx`, and `mission-control-screen.tsx`
- `apps/web/test/routes.test.ts`
- `apps/web/test/source.test.ts`

QA must apply the ratified AC-6 erratum, retain all existing `WRITE_RULES` assertions unchanged, and must not modify production or documentation files. This separation prevents implementation tasks from weakening tests to obtain green.

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
    Own apps/web/src/daemon-client.ts and implement fetchRuns through requestJson,
    DAEMON_ENDPOINTS.runs and wireRunListSchema. Do not touch any other source file,
    any test file, contracts, routes, rendering, connection code or documentation.

- id: T02
  role: frontend
  title: Implement lossless trace and timeline projections
  contracts:
    - apps/web/src/mission-control-model.ts
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []
  description: >-
    Own apps/web/src/mission-control-model.ts and implement partitionTrace and
    buildStepTimeline, including exact-id grouping, first-appearance ordering,
    conservation, latest spawn-or-retry vendor and all three dispositions. Do not
    touch transport, React components, copy, styles, routes, tests or documentation.

- id: T03
  role: frontend
  title: Bound the accepted event tail and count browser discards
  contracts:
    - apps/web/src/run-connection.ts#RUN_EVENT_RETENTION
    - apps/web/src/run-connection.ts#RunConnectionSnapshot
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
  depends_on: []
  description: >-
    Own apps/web/src/run-connection.ts; retain the newest RUN_EVENT_RETENTION events,
    increment browserDiscardedCount exactly, preserve prior snapshot immutability,
    reset both loss counters on retarget, and correct the stale Q-0121 forecast in
    the existing append comment. Do not touch models, components, routes, tests,
    contracts or documentation.

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
    Own apps/web/src/routes.ts; mark the runs rail and both Q-0015 route rows built,
    assign the runs landing to Q-0015, replace rather than empty waitingFor text,
    use the exported route constants in register rows, and update the nearby JSDoc
    from three ticket-null rows to two. Do not touch the router, app, components,
    tests, styles, contracts or documentation.

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
    Own apps/web/src/runs-screen.tsx and implement one mount read, explicit refresh,
    five request-state presentations, the contracted loaded-empty explanation,
    daemon-order rows, explicit null ticket text and runPath navigation. Do not
    edit shared copy, clients, routes, app wiring, mission control, styles, tests,
    contracts or documentation.

- id: T06
  role: frontend
  title: Implement mission-control shared copy
  contracts:
    - apps/web/src/mission-control-text.ts
    - contracts/Q-0015/mission-control.contract.md#retention-and-disclosure
  depends_on: []
  description: >-
    Own apps/web/src/mission-control-text.ts and replace no exported name or frozen
    sentence while completing any implementation detail needed by its typed copy
    contract. Keep the two loss functions independent and the disposition mapping
    exhaustive. Do not touch screens, models, transport, routes, styles, tests,
    contracts or documentation.

- id: T07
  role: frontend
  title: Render the live mission-control screen
  contracts:
    - apps/web/src/mission-control-screen.tsx
    - apps/web/src/mission-control-model.ts
    - apps/web/src/mission-control-text.ts
    - apps/web/src/routes.ts#gatePath
    - contracts/Q-0015/mission-control.contract.md
  depends_on: []
  description: >-
    Own apps/web/src/mission-control-screen.tsx and render the run-activity lane,
    trace columns, timeline, main-region connection and metadata states, independent
    loss notices, five disclosures, terminal run number and pendingGates-derived
    gate link using the contracted data anchors. Render event fields as React text
    and parse no message. Do not touch projections, copy constants, connection code,
    app wiring, routes, styles, tests, contracts or documentation.

- id: T08
  role: frontend
  title: Wire both Q-0015 screens into the application
  contracts:
    - apps/web/src/app.tsx#App
    - apps/web/src/runs-screen.tsx#RunsScreen
    - apps/web/src/mission-control-screen.tsx#MissionControlScreen
    - contracts/Q-0015/mission-control.contract.md#connection-lifetime
  depends_on: []
  description: >-
    Own apps/web/src/app.tsx; select both screens by route-register constants, pass
    request and connection inputs, preserve one controller across handle changes,
    dispose it on leaving run routes, keep GATE_ROUTE socket-free, and prevent stale
    callbacks from affecting the new route. Do not touch screen implementations,
    connection internals, routes, styles, tests, contracts or documentation.

- id: T09
  role: frontend
  title: Style the runs landing and horizontally accessible trace
  contracts:
    - apps/web/src/mission-control-screen.tsx
    - apps/web/src/runs-screen.tsx
    - contracts/Q-0015/mission-control.contract.md#trace-and-timeline
  depends_on: []
  description: >-
    Own apps/web/src/theme.css and add styles for the runs listing, labelled
    run-activity lane, horizontally scrollable per-step columns, timeline,
    disclosures and state regions without hiding overflow or using animation as a
    state. Do not touch TypeScript, tests, contracts or documentation.

- id: T10
  role: backend
  title: Record the shipped M3 mission-control surface
  contracts:
    - contracts/Q-0015/mission-control.contract.md
  depends_on: []
  description: >-
    Own docs/04-architecture.md and docs/06-development-plan.md; update only the M3
    apps/web architecture account and Q-0015 plan entry to describe the runs landing,
    bounded live trace, run-level lane, observed timeline, gate link and explicit
    missing-data disclosures, while stating that start/stop and structured header
    values remain successors. Do not touch apps, packages, tests, contracts, the
    decisions index or decision entries.
```

All ten development tasks are independent because their typed and prose contracts already exist. They intentionally declare `depends_on: []` and own disjoint files. T10 supplies a real second-vendor review of the documented outcome, but not a second-vendor implementation of `apps/web`; the role table makes that impossible without an unrelated harness decision.

## Verification

QA should make the following red before implementation and green afterward:

- `fetchRuns` makes one schema-validated read; mount, fake-time advance and explicit refresh prove no polling.
- Listing order, null-ticket wording, all five request states and the loaded-empty explanation.
- Alternating events for two concurrent ids produce two stable columns; repeated identical or literal `undefined` ids produce one.
- Run-lane plus column lengths equal the input length, including prefixed `info`, `warn`, `gate` and `terminal` events.
- Vendor is absent until supplied and follows the latest `spawn` or `retry` for that id.
- Markup-bearing stdout renders as text.
- All four timeline cases and the post-terminal third disposition.
- Nine connection states produce main-region prose; `no-such-run` produces no columns.
- Retention at 500, 501 and continuing overflow preserves newest order, exact discard count and old-snapshot immutability.
- Daemon loss, browser loss and both together use their own values and satisfy the defined lexical distinction.
- All five disclosure sentences render, with no fabricated substitute.
- Gate navigation comes from loaded `pendingGates`, even without a streamed gate event.
- Handle-to-handle navigation re-targets one controller; leaving disposes it; superseded callbacks are inert; gate creates none.
- Route-register counts move from one to two built rail entries and three to five built route rows.
- The complete-source AC-6 scan rejects quoted/regex-delimited parsing and accepts `[role="progressbar"]`.
- Existing `WRITE_RULES`, no-timer, browser-boundary and route-literal guards remain intact.

The manual demonstration must start a daemon-owned run with an explicit hand `POST /runs`, open `/runs/<handle>`, and record that producing request, observed event count, peak concurrent column count, daemon missed count and browser discard count. It must not claim that `quorum run` produced the visible run. Run `pnpm install --frozen-lockfile`, then `pnpm turbo run test --force --continue`, plus lint and typecheck, in both required environment rows.
