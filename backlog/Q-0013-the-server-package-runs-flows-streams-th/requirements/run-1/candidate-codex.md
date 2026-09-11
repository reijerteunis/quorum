# Q-0013 — The server package runs flows, streams their events and answers their gates

## Problem

The Studio has no process through which a browser can start or observe a flow. `packages/server` is a one-line stub with no dependencies. Although `@quorum/core` can run a flow, its event stream has one consumer, while an ordinary Studio session may have multiple browser connections watching the same run. A gate also waits on an asynchronous callback, but there is no server surface that can receive a later browser answer and settle that callback.

Without this package, the Studio cannot become a second surface over the existing core behaviour. Implementing it carelessly could consume events twice, lose events for one watcher, accept an answer for the wrong gate, expose an unauthenticated daemon beyond the local machine, or introduce server behaviour that conflicts with the CLI.

This ticket touches the **local daemon + web UI surface**, but only the daemon side of that surface. It also makes the minimum public export change in `@quorum/core` required by the daemon.

## User story

As a **solo maintainer**, I want a local daemon to start a flow for a ticket, stream the run’s events to every browser watching it, and carry my gate answer back to the waiting run, so that the later Studio screens can operate the same flow engine as the CLI without changing its safety rules.

As a **cold-clone adopter**, I want the daemon to listen only on my machine and return actionable errors, so that trying the Studio does not expose my repository or require knowledge of core internals.

## Acceptance criteria

1. **Server start and binding.** `packages/server` exposes a documented programmatic start function that accepts an explicit project path and optional port, and returns a handle containing the resolved loopback address and an asynchronous close operation. If no port is supplied, the server may select an available port. The server listens on `127.0.0.1` only; a request to bind another host is refused with a non-empty error. No authentication mechanism is introduced.

2. **Start-run HTTP contract.** `POST /runs` accepts JSON containing exactly the inputs needed to select an existing project, ticket and flow: `ticketId`, `flow`, and optional `dry`. The project is the project path supplied when the server starts and cannot be overridden per request. Unknown fields, malformed JSON, wrong field types, a missing ticket, or a missing flow produce a `400` or `404` JSON response with stable `code`, human-readable `message`, and an actionable `remedy`; they do not start a run.

3. **Core loading and execution.** For a valid start request, the server uses the public `@quorum/core` barrel to load the configured project, backlog, ticket and named flow, then invokes `runFlow` with that already-loaded context, a server-owned `AbortSignal`, and an `answerGate` callback. The server does not duplicate flow execution, gate policy, ticket locking, worktree containment, stage transition, or run-history logic.

4. **Start response and lazy consumption.** The server begins consuming the lazy `runFlow` iterable itself before returning a successful start response. It returns `202` JSON containing the core-assigned `runId` and URLs for the run’s event stream and gate-answer resource. If the run cannot reach the point at which core assigns a run id, the request returns the mapped core failure instead of inventing an id. The server is the iterable’s only consumer for that run.

5. **Concurrent-run refusal.** If core refuses a second real run for a locked ticket, `POST /runs` returns `409` JSON whose `code`, `message`, and `remedy` identify the conflicting ticket, the existing lock holder information supplied by core, and the lock file a maintainer may inspect or remove. The server does not wait, queue, retry, or reclaim a stale lock. A dry run retains core’s rule that it neither takes nor is refused by that lock.

6. **WebSocket event contract.** `GET /runs/{runId}/events` upgrades to a WebSocket connection for a run known to the current server process. Each message is one UTF-8 JSON object with the shape `{ "type": "event", "event": <Event> }`, where `event` is the unchanged `Event` value received from core. The server does not add ordering claims, timestamps, sequence numbers, vendor-specific fields, or a second event schema.

7. **Fan-out and ordering.** The server consumes each core event once and delivers it exactly once to every WebSocket watcher registered when that event is published. A slow watcher cannot cause another watcher to miss, duplicate, or reorder events. Per watcher, delivery preserves the order in which the server consumed events, including the gate question before any consequence of its answer. Tests must cover at least two simultaneous watchers and parallel-step events without asserting an order core does not promise.

8. **Late watcher replay.** While a run remains known to the current server process, the server keeps that run’s consumed events in memory. A watcher connecting after the run starts first receives all previously consumed events in original consumption order and then receives live events without a gap or duplicate at the replay-to-live boundary. This buffer is transient coordination state: it is not written outside core’s existing `.quorum/` records, is discarded when the server closes, and does not make a run resumable after restart.

9. **Terminal and failed streams.** Core’s terminal event is delivered as an ordinary event and is the final event message. After it has been delivered, the server closes each watcher normally. If the pull following a failed terminal event throws, the server records or reports that failure but does not replace, duplicate, or append to the terminal event. A watcher connecting after termination receives the buffered events through the terminal event and is then closed normally.

10. **Gate-answer HTTP contract.** `PUT /runs/{runId}/gates/{gateId}` accepts JSON `{ "answer": "advance" | "retry" | "abort" }`. For the one currently pending gate whose opaque `gateId` exactly matches the path, it settles the promise returned by that run’s `answerGate` callback with the matching `GateAnswerEnvelope` and returns `204`. The server treats `gateId` as opaque and does not parse the run id or sequence embedded in its current representation.

11. **Gate-answer refusal cases.** A malformed or unknown answer returns `400`; an unknown run or gate returns `404`; an answer for a gate that is not currently waiting, has already been answered, or does not belong to the named run returns `409`. Every refusal uses the same `code`, `message`, and `remedy` error shape and leaves the waiting gate unchanged. Concurrent valid submissions for one gate result in exactly one `204`; all others return `409`. The server never supplies a default answer.

12. **Cancellation and shutdown.** Closing the server stops accepting new HTTP and WebSocket connections, aborts every active run through its caller-owned `AbortSignal`, closes active watchers, awaits each iterable’s cancellation and interrupted-run persistence, and only then resolves the close operation. The server installs no process signal handler and does not call `process.exit`. Starting and stopping a single run through a public endpoint is not part of this ticket.

13. **Public contracts and dependencies.** `AnswerGate` is exported from the public `@quorum/core` barrel, and server production code imports `runFlow`, its required loaders, `AnswerGate`, `Event`, and related public types only through package barrels. `packages/server/package.json` declares its actual workspace dependencies. Any new external WebSocket dependency is small, maintained, non-deprecated, and receives a one-line justification in the solution document; an architectural change also receives a new append-only decision entry.

14. **Safety and product constraints.** Automated tests demonstrate that server-started runs retain core’s worktree containment, human-gate and human-locked-gate behaviour, dry-run immutability, cross-vendor enforcement, and file-backed persistence. No production path, test, fixture, documentation example, request field, header, or environment setup accepts an API key. The server and its protocol contain no product-specific or adapter-specific behaviour.

15. **Repository integration and verification.** The change removes the `Q-0013` row from `plan-backlog.test.ts`’s `UNCREATED` register. Behaviour tests cover server binding, request validation, start success and failure, concurrent-run refusal, two-watcher fan-out, late replay, terminal closure, every gate-answer refusal, answer races, and shutdown cancellation. After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. Tests use ports and repositories they create themselves and do not depend on machine identity, existing ignored state, or a public package registry.

## Non-goals

- Any Studio screen or browser application code; those begin with Q-0014.
- `quorum open` or changing the CLI’s launch path.
- A public endpoint to stop one run. Server shutdown cancels active runs only so resources can be released safely; per-run stop remains separate M3 work.
- Resuming, reconstructing, or answering a run after the daemon restarts; that is Q-0019.
- Remote access, binding to `0.0.0.0`, multi-user operation, authentication, permissions, or cloud sync.
- A REST endpoint for recorded run history or a durable replay log beyond the files core already writes.
- Changing core’s event shapes, single-consumer contract, event ordering, gate policy, lock policy, error conditions, or cancellation ownership.
- Queuing two runs for one ticket or automatically reclaiming a stale ticket lock.
- Editing flow, harness, or ticket files through the server.
- Persisting the daemon’s active-run registry, watcher list, replay buffer, or pending gate resolvers.
- Adding an adapter or changing the adapter contract.
- Registry installation or claiming that `npx quorum` works from a cold machine.

## Open questions

1. **Blocker — HTTP and WebSocket protocol decision. Owner: product manager and architect, before solutioning.** Should the paths and message envelopes in AC-2, AC-6, and AC-10 become the stable M3 browser contract, or should M3 adopt an existing protocol convention? The decision must be recorded before implementation because Q-0014 and later Studio tickets will depend on it.

2. **Blocker — lifetime of completed-run replay. Owner: product manager, before solutioning.** This draft keeps completed runs and their buffered events until daemon shutdown, which is simple but unbounded. Should the first implementation instead apply a documented count, byte, or time limit? If bounded, a late watcher needs an explicit response when replay is no longer available; it must not receive a silently truncated stream.

3. **Blocker — obtaining `runId` for the `202` response. Owner: architect, before implementation.** Does the current `runFlow` contract expose the assigned id early enough to satisfy AC-4 without consuming and withholding events or reading private core state? If not, the solution must propose the smallest public core contract change and record it before code is written; the server must not derive or preallocate the id independently.

4. **Non-blocking — port selection for the later CLI. Owner: Q-0014 or the `quorum open` ticket.** This ticket permits an explicit port or an available ephemeral port for programmatic use. The fixed/default user-facing port and browser-launch discovery mechanism remain to be chosen with the launch surface.

## Risks

- **Scope:** Starting runs, live fan-out, replay, gates, shutdown, error translation, and an export change are near the upper bound for one ticket. If solutioning exceeds 15 implementation tasks, split after the start-and-gate transport contract: keep core export, run start, gate answering, and single-watcher streaming here; move multi-watcher replay and retention policy to a follow-up required before Q-0014.
- **Unbounded memory:** Retaining every event for the daemon lifetime can exhaust memory during long or verbose runs. Open question 2 must set an explicit policy before implementation.
- **Backpressure:** A WebSocket library may buffer indefinitely for a slow watcher. The solution must define a measurable per-watcher limit and an explicit close/error outcome without allowing that watcher to block the core consumer.
- **Race conditions:** Watcher registration during replay, simultaneous gate answers, shutdown during a pending gate, and terminal delivery followed by a thrown pull can each produce gaps or double settlement without one owner for state transitions.
- **Security:** Repository contents and gate control are sensitive even on a local machine. Loopback-only binding is therefore part of the acceptance contract; proxying or remote exposure is outside the supported product.
- **Contract expansion:** Returning a run id before the terminal event may reveal a missing public core capability. Solving it by reading private files or duplicating allocation would create two authorities for run identity.
- **Error drift:** Translating core failures into remedies can diverge from the CLI. Server mappings need direct tests against representative core error types, while preserving the condition named by core.
- **Cold-clone impact:** A new runtime dependency increases install size and time. It is acceptable only if justified and measured; this ticket must not introduce another installation path.
