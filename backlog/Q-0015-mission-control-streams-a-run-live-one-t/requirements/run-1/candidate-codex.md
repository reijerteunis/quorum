# Q-0015 — Mission control streams a run live, one trace column per step

## Problem

A solo maintainer can start and observe a run through the daemon, but the Studio does not yet provide a mission-control screen that explains what the run is doing. The existing shell reports only the connection and latest event. It does not separate concurrent steps, present an observed step timeline, stop a run, or lead to the shipped gate screen.

The run stream contains enough information to separate events by `stepId`, including concurrent parallel members and fan-out children. It does not contain the live run number, start time, structured cost, model, token count, or worktree branch. Those values must not be inferred from browser connection time or parsed from human-readable event messages.

The browser currently retains every accepted event and copies the entire array for every new event. Mission control would make that unbounded, quadratic accumulation visible in the screen most likely to remain open. A late subscriber can also receive only the daemon’s retained tail, with a `missed` count. Both forms of loss must be bounded and disclosed separately.

Finally, mission control and the shipped gate screen are currently reachable only by typing their URLs. `GET /runs` already supplies the active and ended runs the daemon can still serve, but `/runs` has no screen.

Surfaces touched: the Studio and its existing daemon client. No flow, harness file, backlog file, adapter contract, or event schema changes.

## User story

As a **solo maintainer**, I want to open the Studio’s Runs screen, select a run, and see each observed step’s live trace in a separate column, so that I can distinguish concurrent work, understand the run’s current activity, stop it when necessary, and continue to its gate without returning to the terminal.

As a **cold-clone adopter**, I want every connection, truncation, refusal, and terminal state stated in plain language, so that I am not asked to interpret a spinner, an empty panel, or a value the daemon never supplied.

## Acceptance criteria

1. **Runs landing — route and navigation.** The Studio renders a real screen at `/runs`, marks the existing Runs rail entry and route register entry as built by Q-0015, and loads `GET /runs` once when the screen mounts. It does not poll. A visible Refresh action performs another explicit load.

2. **Runs landing — rows.** Each returned run is rendered once with its opaque handle, flow, state, pending-gate count, and ticket id when `ticketId` is non-null. Each row links to `/runs/:handle`. A null ticket id produces no invented ticket label or placeholder value. The screen does not claim to include refused starts, because `GET /runs` does not return them.

3. **Runs landing — request states.** Initial loading, an unreachable daemon, a refused response, an unparseable response, an empty run list, and a loaded non-empty list each render distinct plain-language text. No state is represented only by a spinner, skeleton, blank panel, colour, or disabled control.

4. **Mission-control metadata.** On `/runs/:handle`, the screen reads `GET /runs/:id` on mount and renders the daemon-supplied handle, flow, state, and non-null ticket id. It provides an explicit Retry or Refresh action after a failed read and does not refetch on a timer.

5. **Absent header values.** While a run is live, mission control does not render a run number, elapsed duration, cost or price, token count, model, or worktree branch. It does not render placeholders, zeroes, dashes, skeletons, or estimates for them. It does not parse any event `message`, `line`, or `cmd` to derive them.

6. **One trace column per step.** Mission control groups every event carrying `stepId` by the exact `stepId` value and renders one trace column per distinct observed value. Columns are ordered by the first accepted event for each `stepId`; subsequent interleaving does not reorder them.

7. **Concurrent identity regression.** An automated integration test sends interleaved events for two concurrently active step ids, including the fan-out-shaped ids `dev:Q-0042.1` and `dev:Q-0042.2`. The rendered result contains two independently labelled columns, and every event appears only in the column matching its own `stepId`. This test must fail if both streams are stamped with one shared id or with the string `undefined`.

8. **Run-level events.** Events without `stepId` are rendered in a separately labelled **Run activity** lane. They are never silently discarded or assigned to a step column. This lane includes `info`, `warn`, `gate`, and `terminal` events when observed.

9. **Trace content.** Each trace entry visibly names its event type and renders only fields supplied by that event. `stdout.line` and human-readable messages are displayed verbatim as text; command, retry, gate, warning, and terminal fields may be formatted for readability without extracting new structured facts from prose. Agent-provided text is escaped and is not interpreted as HTML.

10. **Vendor labels.** A step column displays a vendor label only after a `spawn` or `retry` event for that same `stepId` supplies one. If no retained event supplies a vendor, the label is omitted. Events from different vendors are never combined into a cost or token total.

11. **Observed step timeline.** Beneath the trace lanes, the screen renders one timeline item per observed `stepId`, in first-observed order. A `step` event marks that item as started; a `done` event marks it as completed. A `done` event received without its earlier `step` event still creates a completed item. The screen does not invent queued steps or infer unobserved flow structure.

12. **Run activity sentence.** The mission-control body always states the current observable condition in a sentence. At minimum it distinguishes connecting, live with no event yet, live with observed activity, waiting at a gate, ended after a terminal event, unreachable daemon, unknown handle, interrupted connection, dropped subscriber, protocol error, refused run, and metadata still unresolved. Existing connection-state sentences may be reused, but a top-bar indicator alone does not satisfy this criterion.

13. **Daemon replay disclosure.** When the socket reports `missedCount > 0`, the screen displays before the traces: “The daemon omitted N earlier events from this replay.” The notice remains visible for that connection. `null` and `0` do not render a loss notice, and the screen never describes a retained tail as the complete run history.

14. **Browser retention bound.** The run connection retains at most the latest 500 accepted `Event` values for the current connection. Once the 501st event is accepted, the oldest retained event is removed and a cumulative browser-discard count is incremented. Storage and append work remain bounded by that limit rather than growing with the total event count, while snapshots already handed to consumers remain immutable.

15. **Browser-loss disclosure.** When the browser-discard count is greater than zero, the screen displays before the traces: “This browser discarded N earlier live events to keep the view bounded.” This notice is separate from the daemon replay notice, may appear at the same time, and resets only when the controller connects to a different run or explicitly reconnects.

16. **Retention evidence.** Tests cover exactly 500 accepted events, the 501st event, continued overflow, and simultaneous non-zero daemon-missed and browser-discard counts. They prove the newest 500 events remain in order, the two counters retain their distinct values, and neither notice uses the other counter’s wording.

17. **Stop availability.** A Stop run control is enabled only when `WireRun.state` is `running` and no stop request for that handle is in flight. Refused and ended runs do not offer an enabled stop action. Activating Stop requires an explicit confirmation that identifies the run handle.

18. **Stop request and result.** Confirming Stop sends one `POST /runs/:id/stop` through `daemon-client.ts`, using a path assembled in `daemon-endpoints.ts`. A `204` is handled before reading a response body and produces the sentence “Stop requested for this run.” A network failure or non-204 response renders the daemon’s refusal condition and remedy where supplied, leaves the trace readable, and permits another attempt when safe. The UI does not claim the run has ended until the stream or a later explicit read establishes that fact.

19. **Write guard.** The source write register is re-aimed so `POST` remains permitted only in `daemon-client.ts`, `'/gate'` and `'/stop'` are permitted only in `daemon-endpoints.ts`, and every exemption is proven to match an actual occurrence. `PUT`, `PATCH`, and `DELETE` remain forbidden everywhere under `apps/web/src`. No component, board, ticket page, or Runs landing module constructs or issues a mutation.

20. **Gate navigation.** When the loaded run has `pendingGates > 0`, mission control displays a link to the registered `/runs/:handle/gate` route. The link is derived from the route register, not from a second path literal. No verdict, diff, gate answer control, or inferred gate outcome is duplicated on mission control.

21. **Connection lifetime.** Leaving `/runs/:handle`, navigating to its gate screen, changing handles, or unmounting the app disposes or supersedes the current socket. Callbacks from a disposed, closed, or superseded socket cannot append events, alter either loss counter, or change the visible state of the new route.

22. **No browser persistence.** Run rows, trace events, loss counters, request results, and stop state remain in memory only. No browser persistence API, service-worker cache, cookie, or hidden daemon write is introduced.

23. **Shared contracts.** The implementation consumes `Event`, `WireRun`, `WireRunList`, and refusal schemas from `@quorum/shared`. It does not redeclare their shapes, add fields to the event union, or parse a human-readable sentence as a machine contract.

24. **Regression coverage.** Behaviour changes include component and controller tests covering the Runs landing screen, distinct concurrent columns, the Run activity lane, observed-only timeline states, every non-streaming state, both truncation notices, stopping success and refusal, gate navigation, route disposal, and the absence of fabricated header values. The existing mock-adapter end-to-end suite remains green.

25. **Cross-cutting constraints.** The change adds no subscription-secret path; does not alter adapter `check()` behaviour; does not write to the user’s working tree; does not start a run, move a ticket stage, take a run lock, answer a gate, or change gate policy; adds no persistent file format or schema; introduces no vendor-specific knowledge above the adapter layer; and adds no dependency. It does not lengthen the cold-clone installation path because it changes only screens served by the already-built Studio.

## Non-goals

- Adding the run number, run start time, elapsed duration, per-vendor cost, token totals, model, or worktree branch to a live-run contract.
- Parsing `done.message`, `step.message`, `stdout.line`, or `spawn.cmd` for cost, verdict, timing, model, branch, or token data.
- Changing the event union, adding an event timestamp or sequence number, or changing the adapter contract.
- Proving that 500 events is sufficient to show a typical complete run. The repository retains vendor output lines but not a recoverable per-run event stream, so that distribution cannot be measured from the current tree.
- Run history or durable trace replay (Q-0018), daemon restart and resume (Q-0019), verdict and diff evidence (Q-0129), or step chat (Q-0022).
- Building or changing the gate screen, widening gate answers, or answering a gate from mission control.
- Starting or re-running a run, editing instructions, selecting a flow, moving a ticket stage, or taking a run lock from the Studio.
- Rendering unobserved steps as queued or reconstructing a flow from files in the browser.
- Authentication, multi-user access, a remote daemon, cloud sync, a desktop shell, a visual flow canvas, eval suites, a Gemini adapter, or a plugin marketplace.
- Evicting daemon run records or changing the daemon’s 500-event replay retention.

## Open questions

1. **Structured live-run header values — blocking for a successor, not Q-0015.** Owner: product manager with the Q-0129 owner and a core/server engineer. Decide whether run identity, start time, structured per-step usage/cost, model, and branch belong in one additive run projection or in separate contracts. Cost and verdict must be considered together because both currently exist only inside human-readable prose. Any event-union change requires a new decision entry. Q-0015 proceeds with all six values absent.

2. **Adequacy of the 500-event browser bound — non-blocking.** Owner: product manager. The available corpus establishes line-size distribution but cannot recover event counts per real run. After a shipped consumer can record aggregate counts without persisting event content, measure total events and peak concurrently visible events over real runs. Revisit the bound only with that evidence. This does not block using 500 as an explicit resource limit with visible loss reporting.

3. **Flow route — gate decision.** Owner: human at the requirements gate. Recommendation: use the full requirements → solutioning → qa-red → development route. The ticket adds new user-visible state derivation, bounded-retention behaviour, a mutation, and concurrency-sensitive integration coverage; its red tests can fail on behaviour the implementation must fix. If the chore flow is chosen instead, the gate record must state why those behavioural contracts do not warrant a red phase rather than copying Q-0016’s routing rationale.

## Risks

- **Misleading completeness.** A late subscriber or bounded browser view can show only a tail. Separate daemon and browser loss notices reduce the risk but cannot recover discarded events.
- **Incorrect attribution under concurrency.** Any regression to shared mutable step identity would mix simultaneous agents. The interleaved two-step integration test is the primary control.
- **Prose accidentally becoming a contract.** Existing messages contain tempting cost, timing, model, and verdict fragments. A future renderer could parse them unless source and component tests explicitly forbid those derived regions.
- **Stop races.** A run may finish between the metadata read and the stop request. The client must render the daemon’s refusal and must not infer completion from the attempted mutation.
- **Partial timeline.** Retention can remove a step’s start while preserving its completion, or remove the step entirely. The timeline therefore reports observed facts only and must not be presented as the flow definition or complete history.
- **Dense traces.** A run with many fan-out children can create more columns than fit horizontally. The screen must preserve one column per id with accessible horizontal overflow; collapsing different ids into one column would break the core requirement.
- **Scope pressure from the design brief.** The hero mockup names cost, elapsed time, run number, model, branch, and tokens. Adding any of them without a structured source would violate the no-fabricated-value rule and expand this ticket across a contract decision already shared with Q-0129.
