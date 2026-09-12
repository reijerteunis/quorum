# Q-0121 — The daemon reports its live runs

## Problem

The daemon assigns an opaque handle to each run it starts, but only `POST /runs` returns that handle. A client that did not make the start request—such as a fresh tab, a second browser, or the Studio observing a run started from the CLI—cannot discover the run. The `/runs` landing route therefore has nothing to list, and the client cannot open the run route or subscribe to the daemon’s retained events.

Q-0120 already preserves a handle across an ordinary reload because the handle is in `/runs/:handle`. This ticket addresses discovery by clients that do not already have a handle; it does not address reload survival.

The daemon already holds the required state in memory. It must expose that state without introducing browser persistence, durable daemon state, or a second source of truth.

Surfaces touched: local daemon HTTP API and the shared browser/server wire contract. The Studio shell copy at `/runs` is updated to remain truthful, but this ticket does not build the Runs landing screen or mission control.

## User story

As a **solo maintainer**, I want a client connected to my local daemon to discover every run that daemon successfully started, including runs started from the CLI and runs that have already ended during this daemon process, so that I can navigate to a run without having received its handle when it started.

## Acceptance criteria

1. The daemon exposes `GET /runs`. A successful response has HTTP status `200` and a JSON body of the form `{ "runs": WireRun[] }`.

2. `GET /runs` reports every run that the current `RunHost` successfully started and still holds, whether its state is `running` or `ended`. A run whose start was refused is not included because it has no subscribable event stream and its handle was never returned as a successful run.

3. An ended run remains present in `GET /runs` for as long as the current host retains that run. It is returned with `state: "ended"`; ending the event stream must not make the run appear absent.

4. `GET /runs` returns runs in reverse creation order: the most recently minted included handle is first. Repeating the request without starting another run returns the same order.

5. When the current host has no successfully started runs, `GET /runs` returns HTTP `200` with `{ "runs": [] }`. An empty result is not an error and does not consult durable run history.

6. The daemon exposes `GET /runs/:handle`. When the handle names a successfully started run retained by the current host, the route returns HTTP `200` and one `WireRun` using the same projection as the corresponding row from `GET /runs`.

7. `GET /runs/:handle` returns the run’s current state at request time. In particular, a response may change from `running` to `ended` after the run finishes, without changing its handle, flow, ticket id, or run id once known.

8. When `:handle` is unknown, belongs to a refused start, or is no longer retained by the current host, `GET /runs/:handle` returns HTTP `404` with a `WireRefusal` whose code is `no-such-run` and whose condition states that no run is registered under that handle. It must not return an empty object, `null`, or an invented run.

9. `WireRun` has exactly these fields:

   - `handle: string` — the host-minted, process-local handle used by the run routes;
   - `flow: string` — the flow name supplied at start;
   - `ticketId: string` — the resolved ticket id for the successfully started run;
   - `runId: number | null` — `null` until the terminal event supplies the core run number;
   - `state: "running" | "ended"` — the current state of a successfully started run.

10. The widened `WireRun` shape also applies to the existing successful `POST /runs` response. A successful start returns `ticketId` and the closed run-state vocabulary; no route maintains a different run summary shape.

11. `WireRun`, its run-state vocabulary, and a runtime schema capable of parsing one `WireRun` are defined in `@quorum/shared`. `packages/server` may re-export them, but neither `packages/server` nor `apps/web` declares or copies a competing interface or parser.

12. `@quorum/shared` also exports a runtime schema for the `GET /runs` success envelope. The schema accepts the response defined by AC-1 and rejects missing required fields, unknown run states, and values of the wrong type. The TypeScript types are inferred from, or checked against, these runtime schemas so the type and parser cannot drift independently.

13. The list and detail routes are reads over `RunHost` state. Calling either route does not start, stop, resume, answer, subscribe to, or otherwise change a run; does not change watcher counts; and does not write under `backlog/`, `harness/`, or `.quorum/`.

14. The new routes are mounted wherever the existing run-control routes are mounted, including the daemon created by `createDaemon`. They answer for the same `RunHost` used by `POST /runs` and `GET /runs/:handle/events`; the transport does not create a second run registry with independently changing contents.

15. A run started through the existing HTTP route and a run started directly through the same host, representing a CLI caller in the integration test, are both discoverable through `GET /runs` once their starts succeed.

16. An HTTP integration test proves the late-joiner path end to end: start a run, wait until at least one event has been emitted before making the list request, discover its handle through `GET /runs`, request `GET /runs/:handle`, and subscribe to `/runs/:handle/events` using that discovered handle. The subscription receives the existing retained-event behavior, including the existing `missed` message when the retention bound was exceeded. This ticket does not change retention calculations or WebSocket framing.

17. Tests independently cover an empty listing, multiple running runs, an ended run remaining listed as ended, exclusion of a refused start, a directly-host-started run, detail lookup, unknown-handle refusal, reverse creation order, `POST /runs` compatibility with the widened shape, schema rejection, and the absence of read-side state changes.

18. The mock-adapter end-to-end regression suite remains green. Verification follows the repository commands: install with `pnpm install --frozen-lockfile`, then run `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck`.

19. The `/runs` route-register copy no longer claims that the daemon reports no listing. It continues to state that no ticket builds the Runs landing screen, because this ticket supplies the daemon contract but does not build that screen.

20. The change introduces no subscription-authentication path, does not alter worktree placement or branch behavior, does not alter gate defaults or `human-locked` behavior, does not change a flow or adapter contract, and does not add network access beyond the existing loopback daemon.

## Non-goals

- Building the Runs landing screen or rendering the returned rows in the Studio.
- Building mission control, the gate screen, step chat, or run history.
- Persisting a handle, run list, events, or connection state in browser storage.
- Making a handle durable or meaningful across daemon restarts.
- Reconstructing live runs from `.quorum/runs/` or combining live runs with run history.
- Resuming an interrupted or ended run.
- Changing `DEFAULT_RETENTION`, retained-event ordering, missed-event counting, WebSocket frames, or subscriber backpressure.
- Adding pagination, filtering, searching, sorting options, polling intervals, timestamps, cost data, gate data, watcher counts, failure details, refusal details, ticket titles, or full `TicketRecord`s to `WireRun`.
- Evicting ended records or introducing a time-based retention policy for host records.
- Exposing refused starts as discoverable runs.
- Adding remote-daemon, multi-user, cloud-sync, desktop-shell, plugin-marketplace, or visual-canvas behavior.
- Changing flow execution, adapter behavior, BYOS checks, worktree safety, or gate semantics.

## Open questions

1. **Blocker — Principal architect:** Should `RunHost` gain a read-only enumeration method, or should its existing registry be exposed through another host-owned read abstraction? The transport must not keep its own index under AC-14, but the exact host API needs to be settled before solutioning because Q-0013 deliberately proved a smaller public surface.

2. **Non-blocking — Product owner:** Should a later ticket add creation time to the run summary so the Runs landing screen can display time rather than relying on response order? This ticket specifies deterministic reverse creation order and deliberately does not widen the wire contract with an unneeded timestamp.

## Risks

- `RunHost` currently retains records for the process lifetime. Making ended records discoverable makes that existing lifetime visible, but does not bound memory growth. Eviction needs a separate requirement because it would change whether a previously issued handle remains valid.
- Widening `WireRun` changes the successful `POST /runs` response. Additive fields are compatible with clients that ignore unknown fields, but strict external parsers must adopt the shared schema.
- A transport-owned index could drift during concurrent starts or shutdown and report a run the host cannot serve. AC-14 prohibits that design; the blocking architecture question must preserve one host-owned authority.
- A list response can become stale immediately as runs end. Returning current snapshots and keeping ended runs address this without promising a transactional relationship between the list, detail, and WebSocket requests.
- The name “live runs” can be misread as “currently running only.” The contract explicitly means successfully started runs retained by the live daemon process, including the `ended` state, and keeps durable run history separate.

## Cross-cutting checklist

- **BYOS:** N/A to behavior; no subscription-authentication or environment-check path changes.
- **Worktree safety:** N/A to behavior; the routes are read-only and use the existing host.
- **Gate behavior:** N/A; listing and detail neither answer nor alter a gate.
- **Files as the database:** Preserved. These routes expose process-local live-run state only and create no persistent state. Durable run history remains under `.quorum/runs/`.
- **File format and schema:** No file format changes. The HTTP contract gains runtime schemas in `@quorum/shared`.
- **Flow lint and cross-vendor rule:** N/A; no flow or adapter changes.
- **Product-agnostic:** Preserved; the response contains only Quorum domain fields.
- **Cold-clone impact:** None. No installation step, dependency, or first-run action is added.
