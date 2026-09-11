# Q-0120 — Live daemon connection solution

## Chosen approach

`@quorum/shared` owns the single browser-safe `WireMessage` definition and its runtime schema. `packages/server/src/wire.ts` imports and re-exports that name, preserving the server source surface without creating an `@quorum/server` package export or making server dependencies browser-reachable.

The browser implementation is divided into five framework-neutral modules and one React integration seam:

1. `daemon-endpoints.ts` owns the complete daemon endpoint register and the stubbed same-origin URL builders.
2. `frame-parser.ts` validates untrusted messages and returns a closed, distinguishable refusal union.
3. `connection-state.ts` owns the pure reducer, plain-language rendering, close precedence and Retry eligibility.
4. `run-connection.ts` owns one socket, callback invalidation, accepted events, missed-count state and explicit Retry through an injectable transport.
5. `vite.config.ts` imports the endpoint register, configures the same-origin development proxy and selects the shared package's source export condition.
6. `app.tsx` and `shell.tsx` form one React adapter seam. Their committed prop interfaces define how an injected socket factory and controller snapshot cross the component boundary.

The shared wire schema remains a development responsibility rather than completed behavior disguised as a contract. Its exported type and `z.ZodType<WireMessage>` signature are complete, while the schema body throws `not implemented`. The backend task implements the schema without changing that API. This restores the intended two-vendor implementation fan-out: backend owns shared/server wire behavior, while frontend owns the browser behavior.

`DAEMON_ENDPOINTS` is complete because it is a register and an empty register would make its tests vacuous. `runEventsPath` and `runEventsUrl` are typed stubs because encoding and protocol selection are behavior tested during qa-red.

The proxy target uses Vite's object form and defaults to port `7717`, read from configuration. The adjacent documentation must state that 7717 is only the development server's convention: the daemon has no default port, and a future `quorum open` must arrange agreement.

All run handles, events, notices and connection state remain in memory. There is no persistence adapter and no automatic reconnection.

## Rejected alternatives

### Exporting `@quorum/server`

Rejected because the server package deliberately has no build or package export surface, a fact pinned by its package guard. It would also leave server-only dependencies reachable from browser code. The existing `server → shared` direction is the established repository pattern.

### Copying the frame union into `apps/web`

Rejected because it creates a second definition and provides no runtime validation. A cast after `JSON.parse` would silently accept malformed input.

### Moving `WireRefusal`, `WireRun` or `WireTicket`

Rejected because this ticket receives none of them. The first browser HTTP consumer can move the shapes it actually consumes using the same shared-package pattern.

### Completing runtime behavior during solutioning

Rejected for the schema and URL builders because it would make qa-red assertions green before development and leave later corrections without an owner. Only declarations and non-vacuous static registers are complete contracts; executable validation and URL construction remain stubbed.

### Separate React tasks for `App` and `Shell`

Rejected because the two files share one component-tree protocol. Separate worktrees would have to invent matching props independently. One task owns both files against the committed `AppProps`, `ShellProps` and `ShellConnectionProps` contracts.

### A React hook containing parsing, reduction and socket ownership

Rejected because it couples protocol tests to jsdom and obscures stale-callback invalidation. Pure modules and an injectable transport provide smaller, directly driven contracts.

### Automatic reconnection

Rejected because the wire protocol has no resume cursor. Automatic reconnection could duplicate accepted events or hide a missed prefix. Retry is explicit and preserves existing evidence.

### CORS or an absolute daemon URL

Rejected because the unauthenticated daemon is intentionally loopback-only. Vite supplies the development bridge while browser code remains same-origin and deployment-neutral.

### A URL-string proxy target or a source-scan exemption

Rejected because the existing whole-package network-literal guard deliberately has no exemption. Vite accepts an object target, so the guard need not be weakened.

### Adding a web build script

Rejected because emitted browser artifacts belong to Q-0122. This ticket adds only the client-side `quorum-source` resolution condition needed to avoid depending on a pre-existing `packages/shared/dist`.

### Putting qa-red work in `tasks.yaml`

Rejected because `development.yaml` dispatches every task on its first traversal and explicitly forbids development agents from modifying tests. Test ownership is specified separately below and reaches `write-tests` through the scenario document. `tasks.yaml` contains development work only.

## Contracts

The following contracts were created or refined in the repository worktree:

- `packages/shared/src/wire.ts` — complete `WireMessage` union and typed `wireMessageSchema` stub. The schema is declared as `z.ZodType<WireMessage>` and throws `not implemented` until the backend task supplies strict event and finite non-negative integer missed-frame validation.
- `packages/shared/src/index.ts` — complete barrel export for the wire module.
- `packages/server/src/wire.ts` — complete type import/re-export contract preserving the existing server source surface and removing the duplicate declaration.
- `apps/web/package.json` — complete runtime dependency contract for `@quorum/shared` as `workspace:*`.
- `pnpm-lock.yaml` — matching workspace-link contract under the `apps/web` importer.
- `apps/web/src/daemon-endpoints.ts` — complete `DAEMON_ENDPOINTS` register and typed stubs for `runEventsPath` and `runEventsUrl`.
- `apps/web/src/frame-parser.ts` — typed `parseFrame` stub plus complete `ParsedFrame`, `FrameParseResult` and closed `FrameRefusal` unions.
- `apps/web/src/connection-state.ts` — typed reducer, renderer and Retry stubs plus complete `ConnectionState`, `ConnectionAction` and `ConnectionMachine` contracts.
- `apps/web/src/run-connection.ts` — typed `createRunConnection` stub plus complete `SocketTransport`, `SocketFactory`, `RunConnectionSnapshot` and `RunConnection` interfaces.
- `apps/web/src/app.tsx` — complete `AppProps` contract exposing optional `socketFactory` and `pageUrl` injection while retaining the existing optional `initialPath` test seam.
- `apps/web/src/shell.tsx` — complete `ShellProps` and `ShellConnectionProps` contracts for snapshot rendering and explicit Retry.
- `contracts/Q-0120/live-connection.contract.md` — prose contract freezing parser refusal names, close precedence, retry policy, callback invalidation, preservation and memory-only lifetime.

No migration or persistent data schema is required.

## Behavioral decisions

### Parsing

`parseFrame` accepts an unknown received value. Only strings proceed to JSON parsing. It never throws and returns one of these refusal values:

- `non-text-message`
- `invalid-json`
- `non-object`
- `unknown-type`
- `invalid-event`
- `invalid-count`

The shared schema validates the outer envelope. The parser then validates event payloads with `eventSchema`. A missed count is accepted only when it is a finite, non-negative integer. Every refusal is asserted by value.

### Connection precedence

The reducer applies close outcomes in this order:

1. Code 1008 becomes `no-such-run`.
2. Code 1013 becomes `dropped`.
3. A normal close after an accepted terminal event becomes `ended`.
4. Every other close after opening and before a terminal event becomes `interrupted`, retaining its code and reason.
5. Failure before `open` becomes `no-daemon`, retaining the requested same-origin URL.

A parser refusal becomes `protocol-error`. Non-run routes use `idle`. Only `no-daemon`, `no-such-run`, `interrupted`, `dropped` and `protocol-error` offer Retry.

### Socket ownership

`createRunConnection` constructs an idle controller and opens nothing. `connect` invalidates and closes the previous transport before creating one replacement. `retry` follows the same replacement path using the retained handle and page URL. It preserves accepted events and the missed notice. `dispose` is idempotent. Each callback captures a connection generation, and callbacks from superseded or disposed transports are ignored.

### UI boundary

The run route connects for its decoded handle. Handle changes replace the connection; leaving the run route disposes it. Non-run routes remain idle and open no socket.

The shell receives connection evidence through `ShellConnectionProps`. It may render only state text, a missed notice, accepted-event count, the latest event's `type` and `stepId`, and Retry where eligible. The existing mission-control placeholder metadata and disabled run-flow control remain unchanged.

## What qa-red must write

These are qa-red file assignments, not development tasks. Scenario generation must carry them into `write-tests`, and every scenario must name the development task ids it exercises.

- `apps/web/src/frame-parser.test.ts` — drive all valid frames and every refusal by value, including non-text, invalid JSON, non-object JSON, unknown type, invalid event and each invalid count.
- `apps/web/src/connection-state.test.ts` — drive every reducer transition and renderer value; distinguish no daemon from no such run; prove that `ended` requires a terminal event.
- `apps/web/src/run-connection.test.ts` — fake-transport coverage for replacement, close records, stale callbacks, idempotent disposal, missed counts zero and seven, no automatic reconnect, explicit Retry, repeated Retry and preservation.
- `apps/web/src/shell.test.ts` — retain the throwing-global non-run guard; drive the committed `AppProps` injection to assert exactly one run-route socket; cover connection evidence and Retry without creating a `.test.tsx` file.
- `apps/web/test/routes.test.ts` — recursively walk every file under `src`, excuse exactly the endpoint-register literals and include a nested TypeScript positive-control fixture.
- `apps/web/test/package.test.ts` — update the exact dependency and justification registers; structurally assert Vite client conditions and the unchanged no-build surface. It must not read the workspace lockfile.
- `apps/web/test/source.test.ts` — retain the whole-package network scan with no exemption; add the declaration-restatement scan, the shared-import reachability assertion, the persistence scan and their discriminating fixtures; assert that the retired connection sentence is absent from all source files.
- `packages/shared/src/index.test.ts` — pin the wire barrel export and re-run existing shared browser-safety and flat-module guards over the enlarged corpus.
- `packages/shared/src/wire.test.ts` — drive the outer schema over both valid envelope variants and invalid missed counts so the backend behavior has its own red subject.
- `packages/server/src/index.test.ts` — assert that `WireMessage` is re-exported from shared without changing the existing runtime `SURFACE` register.
- `packages/server/src/package.test.ts` — assert that server source and manifest gained no CORS middleware, header or dependency and retain the no-package-export assertions.
- `packages/shared/src/package.test.ts` or the existing package-level suite chosen by qa-red — assert that the `apps/web` lockfile importer links `@quorum/shared`. The read is covered by the `packages/shared/turbo.json` input added by task `backend-lockfile-test-input`.
- `packages/shared/src/docs.test.ts` — assert removal of retired architecture prose, the shared/server wire boundary, the complete Connection state glossary entry, and that the two existing exact-term lists remain byte-identical.

The lockfile assertion belongs to the shared suite rather than an `apps/web` suite because `apps/web` has no Turbo input declaration and non-goal 6 forbids adding its first one.

## Tasks

```yaml
tasks:
  - id: backend-wire-schema
    role: backend
    title: Implement the shared wire schema and preserve the server re-export
    description: >-
      Own packages/shared/src/wire.ts, packages/shared/src/index.ts and
      packages/server/src/wire.ts only. Implement strict runtime envelope validation while
      preserving the committed WireMessage and schema types, the shared barrel export and the
      server type re-export. Do not touch apps/web, manifests, lockfiles, documentation, harness
      files or any test file.
    contracts:
      - packages/shared/src/wire.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-daemon-endpoints
    role: frontend
    title: Implement same-origin run event URL construction
    description: >-
      Own apps/web/src/daemon-endpoints.ts only. Preserve the complete DAEMON_ENDPOINTS register
      and implement runEventsPath and runEventsUrl so the handle is one encoded segment and the
      WebSocket scheme follows the page scheme. Do not touch parsing, socket lifecycle, React
      files, Vite configuration, manifests, lockfiles, documentation or any test file.
    contracts:
      - apps/web/src/daemon-endpoints.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-frame-parser
    role: frontend
    title: Implement validated WebSocket frame parsing
    description: >-
      Own apps/web/src/frame-parser.ts only. Implement the non-throwing parser against the shared
      wire and event schemas and return the committed refusal values. Do not touch shared or server
      code, endpoint construction, connection state, socket lifecycle, React files, configuration,
      manifests, lockfiles, documentation or any test file.
    contracts:
      - apps/web/src/frame-parser.ts
      - packages/shared/src/wire.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-connection-state
    role: frontend
    title: Implement the connection reducer and plain-language rendering
    description: >-
      Own apps/web/src/connection-state.ts only. Implement every transition, the declared close
      precedence, distinct user-facing text and Retry eligibility without changing the committed
      unions. Do not touch parsing, transport ownership, React files, configuration, manifests,
      lockfiles, documentation or any test file.
    contracts:
      - apps/web/src/connection-state.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-run-connection
    role: frontend
    title: Implement single-socket lifecycle and explicit retry
    description: >-
      Own apps/web/src/run-connection.ts only. Implement transport construction,
      generation-based callback invalidation, accepted-event retention, missed handling, explicit
      Retry and idempotent disposal against the committed parser, reducer and endpoint interfaces.
      Do not touch those contract modules, React files, configuration, manifests, lockfiles,
      documentation or any test file.
    contracts:
      - apps/web/src/run-connection.ts
      - apps/web/src/frame-parser.ts
      - apps/web/src/connection-state.ts
      - apps/web/src/daemon-endpoints.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-react-connection
    role: frontend
    title: Adapt the run connection into the application and shell
    description: >-
      Own apps/web/src/app.tsx and apps/web/src/shell.tsx only. Use the committed AppProps,
      ShellProps and ShellConnectionProps to connect only on a run route, replace on handle change,
      dispose on leave or unmount, render idle elsewhere, retire CONNECTION_PENDING, show only the
      permitted connection evidence and expose Retry only where eligible. Do not touch routes or
      placeholder metadata, controller internals, CSS, Vite configuration, manifests, lockfiles,
      documentation or any test file.
    contracts:
      - apps/web/src/app.tsx
      - apps/web/src/shell.tsx
      - apps/web/src/run-connection.ts
      - apps/web/src/connection-state.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-dev-proxy
    role: frontend
    title: Configure the daemon proxy and shared source resolution
    description: >-
      Own apps/web/vite.config.ts only. Import DAEMON_ENDPOINTS, proxy all five prefixes with
      WebSocket upgrade enabled to an object target whose configured port defaults to 7717,
      document that this is a dev-server convention rather than a daemon default, and include
      quorum-source after Vite's client default conditions. Do not add a network-scan exemption,
      change endpoint code, add a build script, touch server code, manifests, lockfiles, React code,
      documentation or any test file.
    contracts:
      - apps/web/src/daemon-endpoints.ts
      - apps/web/package.json
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: backend-lockfile-test-input
    role: backend
    title: Declare the lockfile as an input to the shared package test task
    description: >-
      Own packages/shared/turbo.json only. Add ../../pnpm-lock.yaml to the shared test task inputs
      so qa-red's lockfile-importer assertion cannot replay a stale result. Do not touch the
      lockfile, manifests, source modules, documentation, harness files or any test file.
    contracts:
      - apps/web/package.json
      - pnpm-lock.yaml
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: backend-connection-docs
    role: backend
    title: Document the live connection boundary and vocabulary
    description: >-
      Own docs/04-architecture.md, docs/GLOSSARY.md and harness/architecture.md only. Replace the
      stale no-connection statement, document shared ownership and server re-export of WireMessage,
      add the dated status entry, define Connection state and distinguish it from run state, and
      mark frontend active without changing role path cells. Do not touch CLAUDE.md,
      docs/README.md, code, manifests, lockfiles, flows, templates or any test file.
    contracts:
      - packages/shared/src/wire.ts
      - packages/server/src/wire.ts
      - apps/web/src/connection-state.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []
```

Every task is independent against committed contracts and therefore starts in the first wave. No two tasks own the same file. Every description states both its owned files and forbidden surfaces. Test files belong exclusively to qa-red.

## Review findings addressed

- **B-1:** Removed all qa-red tasks from the YAML. Test ownership now appears in the dedicated qa-red section and reaches `write-tests` through scenarios.
- **B-2:** Added `frontend-daemon-endpoints` as the sole owner of `daemon-endpoints.ts`; the register remains real while both URL functions are now typed stubs.
- **B-3:** Added committed `AppProps`, `ShellProps` and `ShellConnectionProps` contracts and merged `app.tsx` and `shell.tsx` into one development task.
- **B-4:** Added `backend-wire-schema`, owning `packages/shared/src/wire.ts`, its barrel and the server re-export. The runtime schema is now a typed throwing stub rather than completed behavior without an owner.
- **B-5:** Restored a substantive backend implementation task, so the code fan-out uses both codex-backed backend and claude-backed frontend roles.
- **M-1:** Moved the lockfile assertion out of `apps/web` and assigned `packages/shared/turbo.json` to a backend task that declares the lockfile input.
- **M-2:** Retained the manifest and lockfile together, but did not claim a successful install. The verification attempt still encounters registry DNS failure; qa-red must not launch until a gate environment completes the frozen install.
- **M-3:** Assigned the retired-sentence assertion explicitly to `apps/web/test/source.test.ts` in the qa-red section.
- **Minor — lockfile prompt size:** No development task lists the lockfile except the small Turbo-input task that needs to identify its exact subject; agents need only inspect the importer stanza, not treat the lockfile as an implementation template.
- **Minor — YAML shape:** The Tasks block now has the required top-level `tasks:` key.
- **Minor — broad contracts:** Each development task cites only its direct typed/prose contracts.
- **Minor — shared import reachability:** Assigned explicitly to `apps/web/test/source.test.ts`.

## Verification and gate obligations

`git diff --check` reports no whitespace errors for the revised contracts.

A fresh `pnpm install --frozen-lockfile` accepted the lockfile and skipped resolution, demonstrating that its importer shape is internally current, but dependency materialization attempted registry downloads and encountered `ENOTFOUND`. That is not a completed install and not a code verdict. The solutioning gate must run the frozen install to exit 0 before qa-red starts; otherwise `expect: fail` could mistake installation failure for a valid red suite.

The later gates still owe the requirement's runtime measurements: daemon-down behavior through a real Vite proxy, cold-store delta, source resolution with `packages/shared/dist` absent, and forced verification in both integration and main environment rows.
