# Q-0120 — Live daemon connection solution

## Chosen approach

Use `@quorum/shared` as the single browser-safe owner of `WireMessage` and its runtime schema. The server imports and re-exports that type, preserving its existing source surface without making `@quorum/server` a browser dependency.

The browser implementation is divided into four plain TypeScript seams and one React integration seam:

1. `daemon-endpoints.ts` is the single register for same-origin daemon paths and constructs the encoded WebSocket URL.
2. `frame-parser.ts` validates untrusted messages and returns a closed, distinguishable refusal union.
3. `connection-state.ts` is the pure connection reducer and plain-language renderer.
4. `run-connection.ts` owns socket lifetime, accepted events, missed-count state and explicit retry through an injectable transport.
5. `app.tsx` and `shell.tsx` adapt the controller to the run route and top bar.

The pure seams contain no React or DOM dependency. This keeps AC-14 through AC-18 directly testable and lets the socket lifecycle and UI be implemented independently against committed interfaces.

The dev server imports the same endpoint register and proxies all five daemon prefixes to an object-form target. Its configured port defaults to `7717`. That number is only a development-server convention: the daemon itself continues to have no default port, and a future `quorum open` command must arrange agreement.

All connection data remains controller and React memory. No persistence adapter or storage abstraction is introduced.

## Rejected alternatives

### Exporting `@quorum/server`

Rejected because the package deliberately has no build or export surface, and its package guard pins that fact. It would also make server-only dependencies reachable from browser code. Moving only the consumed `WireMessage` contract to `shared` preserves the existing dependency direction and makes browser import safety structural.

### Copying the frame union into the web app

Rejected because it creates a second wire definition and gives runtime parsing no authority. A TypeScript assertion after `JSON.parse` would accept malformed input silently.

### Moving `WireRefusal`, `WireRun` or `WireTicket`

Rejected for this ticket because the live connection receives none of them. Moving unused HTTP response types would expand scope without creating a consumer. The first browser HTTP client can move them using the same shared-package pattern.

### A React hook containing parsing, reduction and socket ownership

Rejected because it couples protocol tests to jsdom and makes late-callback invalidation difficult to test directly. A framework-neutral controller with an injectable socket factory provides a smaller contract and lets React remain an adapter.

### Automatic reconnection

Rejected because the protocol has no resume cursor. Automatic retry could duplicate accepted events or conceal a missed prefix. Retry remains a user action and preserves already accepted evidence.

### CORS or an absolute daemon URL

Rejected because the unauthenticated daemon is intentionally loopback-only. Vite provides the development bridge, while browser code stays same-origin and deployment-neutral.

### A proxy target expressed as a URL string

Rejected because the existing whole-package network-literal guard intentionally has no exemption. Vite accepts an object target, so no weakening is necessary.

### Adding a web build script

Rejected because emitted web artifacts belong to Q-0122. This ticket only adds Vite's client-side `quorum-source` resolution condition so development and later builds do not depend on a pre-existing `packages/shared/dist`.

## Contracts

The following contracts were committed in the worktree.

- `packages/shared/src/wire.ts` — complete browser-safe `wireMessageSchema` and inferred `WireMessage` definition. The missed count is a finite, non-negative integer; event payload validation remains the parser's second pass through `eventSchema`.
- `packages/shared/src/index.ts` — barrel export for the new wire module.
- `packages/server/src/wire.ts` — type-only import/re-export preserving the server's `WireMessage` source surface while removing its duplicate declaration.
- `apps/web/package.json` — runtime workspace dependency on `@quorum/shared`.
- `pnpm-lock.yaml` — matching `apps/web` workspace link, committed with the manifest so a frozen install can reach red assertions.
- `apps/web/src/daemon-endpoints.ts` — complete `DAEMON_ENDPOINTS` register plus `runEventsPath` and `runEventsUrl` contracts. Handles are encoded as one segment and the socket scheme is derived from the page scheme without network literals.
- `apps/web/src/frame-parser.ts` — typed stub for `parseFrame`, with the complete `ParsedFrame`, `FrameParseResult` and closed `FrameRefusal` unions. Its body throws `not implemented` until development.
- `apps/web/src/connection-state.ts` — typed stubs for `reduceConnection`, `connectionStateText` and `canRetry`, with complete connection-state, action and reducer-memory unions. Bodies throw `not implemented` until development.
- `apps/web/src/run-connection.ts` — typed stub for `createRunConnection`, including the injectable `SocketTransport`, `SocketFactory`, `RunConnectionSnapshot` and `RunConnection` interfaces. Its body throws `not implemented` until development.
- `contracts/Q-0120/live-connection.contract.md` — prose contract freezing parser refusals, close precedence, retry policy, callback invalidation, preservation and memory-only lifetime.

No migration or persistent data schema is required.

## Behavioural details

### Parsing

`parseFrame` accepts an unknown browser message value. Only strings proceed to `JSON.parse`. It returns one of six refusal kinds rather than throwing:

- `non-text-message`
- `invalid-json`
- `non-object`
- `unknown-type`
- `invalid-event`
- `invalid-count`

An event envelope is accepted only after its payload passes `eventSchema`. A missed envelope is accepted only when its count is a finite, non-negative integer.

### State precedence

The reducer applies close outcomes in this order:

1. `1008` becomes `no-such-run`.
2. `1013` becomes `dropped`.
3. A normal close after an accepted terminal event becomes `ended`.
4. Every other close after opening and before a terminal event becomes `interrupted`, retaining code and reason.
5. Failure before `open` becomes `no-daemon`, retaining the requested same-origin URL.

A parser refusal becomes `protocol-error`. Non-run routes use `idle`. Every member has plain-language text; only failure members offer Retry.

### Socket ownership

`createRunConnection` constructs an idle controller and does not itself open a socket. `connect` replaces the current socket by invalidating and closing it before constructing one successor. `retry` uses the last handle and page URL, follows the same replacement path, and preserves events and missed-count state. `dispose` is idempotent. Every callback captures a generation identity so callbacks belonging to closed, replaced or disposed sockets are ignored.

### UI boundary

The run route creates exactly one connection for its decoded handle. Other routes dispose the connection and render `idle`. The top bar receives connection text and Retry capability as data; it does not own transport behaviour. The run-route panel may display only connection state, missed notice, accepted-event count and the latest event's `type` and `stepId`. Existing mission-control placeholder metadata remains unchanged.

## Tasks

```yaml
- id: frontend-frame-parser
  role: frontend
  title: Implement validated WebSocket frame parsing
  description: >-
    Own apps/web/src/frame-parser.ts only. Implement the non-throwing parser against the shared
    schemas and closed refusal union. Do not touch connection state, socket lifecycle, React files,
    configuration, manifests, lockfiles, documentation, or any test file.
  contracts:
    - packages/shared/src/wire.ts
    - apps/web/src/frame-parser.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-connection-reducer
  role: frontend
  title: Implement the connection reducer and user-facing state text
  description: >-
    Own apps/web/src/connection-state.ts only. Implement every reducer transition, close-code
    precedence, distinct plain-language rendering and Retry eligibility. Do not touch parsing,
    transport ownership, React files, configuration, manifests, lockfiles, documentation, or any
    test file.
  contracts:
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-socket-controller
  role: frontend
  title: Implement single-socket lifecycle and explicit retry
  description: >-
    Own apps/web/src/run-connection.ts only. Implement transport construction, generation-based
    callback invalidation, missed handling, event retention, explicit Retry and idempotent disposal
    against the committed parser and reducer interfaces. Do not touch those interface modules,
    React files, configuration, manifests, lockfiles, documentation, or any test file.
  contracts:
    - apps/web/src/run-connection.ts
    - apps/web/src/frame-parser.ts
    - apps/web/src/connection-state.ts
    - apps/web/src/daemon-endpoints.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-dev-proxy
  role: frontend
  title: Configure the same-origin daemon proxy and source resolution
  description: >-
    Own apps/web/vite.config.ts only. Import DAEMON_ENDPOINTS, proxy its five prefixes with WebSocket
    upgrade enabled to an object target whose configured port defaults to 7717, document that this is
    a dev-server convention rather than a daemon default, and add quorum-source after Vite's client
    default conditions. Do not add URL-string exemptions, change the endpoint contract, add a build
    script, touch server code, manifests, lockfiles, React code, documentation, or any test file.
  contracts:
    - apps/web/src/daemon-endpoints.ts
    - apps/web/package.json
  depends_on: []

- id: frontend-route-connection
  role: frontend
  title: Mount the live connection on the run route
  description: >-
    Own apps/web/src/app.tsx only. Adapt the committed controller to route changes so only a run route
    connects, handle changes replace the connection, leaving disposes it, and controller snapshots
    remain in memory. Do not touch shell presentation, views, routes metadata, controller internals,
    CSS, configuration, manifests, lockfiles, documentation, or any test file.
  contracts:
    - apps/web/src/run-connection.ts
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-connection-region
  role: frontend
  title: Render live connection evidence and Retry in the shell
  description: >-
    Own apps/web/src/shell.tsx only. Replace CONNECTION_PENDING with props that render every
    connection state, missed notice, accepted-event count, latest event type and stepId, plus Retry
    only where permitted; retain the existing disabled run-flow control. Do not touch app lifecycle,
    routes or placeholder metadata, controller internals, CSS, configuration, manifests, lockfiles,
    documentation, or any test file.
  contracts:
    - apps/web/src/run-connection.ts
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-route-scan
  role: frontend
  title: Complete the recursive endpoint-aware route guard
  description: >-
    Own apps/web/test/routes.test.ts only during qa-red. Make the source walk recursive across every
    file under apps/web/src, excuse exactly the literals exported by DAEMON_ENDPOINTS, and add a
    discriminating nested TypeScript fixture. Do not touch production code, other tests,
    configuration, manifests, lockfiles, or documentation.
  contracts:
    - apps/web/src/daemon-endpoints.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-protocol-tests
  role: frontend
  title: Add parser, reducer, missed-count and lifecycle red tests
  description: >-
    Own new apps/web/src/frame-parser.test.ts, apps/web/src/connection-state.test.ts and
    apps/web/src/run-connection.test.ts only during qa-red. Cover every refusal by value, all state
    transitions, zero and seven missed counts, fake-transport replacement, stale callbacks,
    disposal, absence of automatic reconnect and preservation on Retry. Do not touch production
    code, existing tests, configuration, manifests, lockfiles, or documentation.
  contracts:
    - apps/web/src/frame-parser.ts
    - apps/web/src/connection-state.ts
    - apps/web/src/run-connection.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-shell-tests
  role: frontend
  title: Extend shell tests for route-scoped connection rendering
  description: >-
    Own apps/web/src/shell.test.ts only during qa-red. Preserve the throwing-global non-run assertion,
    assert one injected socket on a run route, and cover connection text, evidence and Retry
    rendering without introducing a .test.tsx file. Do not touch production code, other tests,
    configuration, manifests, lockfiles, or documentation.
  contracts:
    - apps/web/src/run-connection.ts
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: frontend-package-guards
  role: frontend
  title: Update web dependency, resolution and source-safety guards
  description: >-
    Own apps/web/test/package.test.ts and apps/web/test/source.test.ts only during qa-red. Update the
    exact dependency and justification registers, assert the workspace lockfile link and shared
    export conditions, structurally assert client resolution conditions, and add discriminating
    declaration and persistence scans without weakening the existing whole-package network scan.
    Do not touch production code, other tests, configuration, manifests, lockfiles, or documentation.
  contracts:
    - apps/web/package.json
    - pnpm-lock.yaml
    - packages/shared/src/wire.ts
    - apps/web/src/daemon-endpoints.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: backend-wire-guards
  role: backend
  title: Prove the shared wire definition and server re-export
  description: >-
    Own packages/shared/src/index.test.ts and packages/server/src/index.test.ts only during qa-red.
    Assert the shared schema barrel surface and server type re-export while retaining the server's
    exact runtime SURFACE register and all shared browser-safety house rules. Do not touch production
    code, other tests, manifests, lockfiles, harness files, or documentation.
  contracts:
    - packages/shared/src/wire.ts
    - packages/shared/src/index.ts
    - packages/server/src/wire.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: backend-cors-guard
  role: backend
  title: Guard the daemon against CORS widening
  description: >-
    Own packages/server/src/package.test.ts only during qa-red. Add the discriminating source and
    manifest assertion that no CORS middleware, header or dependency was introduced, while retaining
    the package's no-export-surface assertions. Do not touch production code, other tests, manifests,
    lockfiles, harness files, or documentation.
  contracts:
    - packages/server/src/wire.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: backend-architecture-docs
  role: backend
  title: Document the live connection boundary and vocabulary
  description: >-
    Own docs/04-architecture.md, docs/GLOSSARY.md and harness/architecture.md only. Replace the stale
    no-connection statement, document shared ownership and server re-export of the frame union, add
    the dated status entry, define Connection state including its distinction from run state, and
    mark frontend as active without changing role path cells. Do not touch CLAUDE.md,
    docs/README.md, code, manifests, lockfiles, flows, templates, or any test file.
  contracts:
    - packages/shared/src/wire.ts
    - packages/server/src/wire.ts
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []

- id: backend-documentation-tests
  role: backend
  title: Pin the shipped architecture and connection-state terminology
  description: >-
    Own packages/shared/src/docs.test.ts only during qa-red. Assert removal of stale architecture
    sentences, the shared/server wire boundary, the complete Connection state glossary definition,
    and that the two existing exact-term lists remain byte-identical. Do not touch production code,
    other tests, manifests, lockfiles, harness files, or documentation.
  contracts:
    - packages/shared/src/wire.ts
    - apps/web/src/connection-state.ts
    - contracts/Q-0120/live-connection.contract.md
  depends_on: []
```

The qa-red-owned test tasks are listed explicitly because existing test registers must move before development and development roles are forbidden to modify tests. Their file sets do not overlap implementation tasks or one another.

## Verification notes

`pnpm install --frozen-lockfile` accepted the updated lockfile and began installing the expected workspace graph, which confirms the manifest and lockfile are mutually consistent. The environment could not reach `registry.npmjs.org`, so installation stopped with `ENOTFOUND`; subsequent typechecks could not resolve installed dependencies and therefore did not constitute a code verdict. `git diff --check` completed without whitespace errors.

The final gate still owes the runtime measurements named by the requirement: daemon-down behaviour through a real Vite proxy, cold-store delta, source resolution with `packages/shared/dist` absent, and the forced integration/main verification rows.
