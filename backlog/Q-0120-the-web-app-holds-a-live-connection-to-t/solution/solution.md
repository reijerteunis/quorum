# Q-0120 — The web app holds a live connection to the daemon

## Chosen approach

Move only `WireMessage` into the browser-safe `@quorum/shared` package and place a runtime `wireMessageSchema` beside it. The server imports and re-exports that name without acquiring a package export surface. The browser imports the schema and `eventSchema` as runtime values, so frames are validated rather than cast and the Vite source-resolution condition has a real browser-bundle subject.

The browser implementation is split along stable seams:

- `daemon-endpoints.ts` owns the shared endpoint register and same-origin WebSocket URL construction.
- `frame-parser.ts` owns staged, non-throwing parsing and distinguishable refusals.
- `connection-state.ts` owns the pure connection reducer and user-facing state text.
- `run-connection.ts` owns one-socket lifecycle, accepted events, missed-count state and explicit retry.
- `app.tsx` and `shell.tsx` form one React task because their prop protocol crosses one component tree.
- `vite.config.ts` owns the object-form development proxy and client source-resolution condition.

Envelope validation is deliberately staged. The parser rejects non-text input, invalid JSON, non-objects and unknown discriminants itself. It then calls `wireMessageSchema.safeParse` on a recognised branch. A failed missed branch becomes `invalid-count`; an accepted event envelope still passes its payload through `eventSchema`, producing `invalid-event` on failure. This keeps every AC-14 refusal distinguishable while making the shared runtime schema load-bearing.

`DAEMON_ENDPOINTS` is a complete contract because an empty register would make its tests vacuous. The two URL builders remain throwing typed stubs for development. Connection types, component props and transport interfaces are committed at their final paths so qa-red compiles against real names and fails on assertions.

The route-literal guard remains recursive over all source files, including comments and tests. Its eight current exceptions are a measured baseline, not a frozen count. New tests derive paths from `DAEMON_ENDPOINTS` and `runEventsPath`; any unavoidable literal receives an exercised `(file, literal, reason)` entry. Guard needles and fixture strings that would otherwise become their own subjects are assembled at runtime.

Development tasks contain production and documentation work only. The qa-red file map is part of the prose contract under `contracts/Q-0120/`, because `write-tests` reads contracts but does not read this solution document directly.

## Rejected alternatives

### Export `@quorum/server`

Rejected because the package intentionally has no `exports`, `main`, `types`, `files`, `bin` or build script. Adding them would create an emitted artifact that does not exist and allow browser code to reach Hono, core and Node capabilities.

### Copy the wire union into the web app

Rejected because it creates a second definition and replaces runtime validation with an unchecked assertion over `JSON.parse` output.

### Move `WireRefusal`, `WireRun` or `WireTicket`

Rejected because this ticket consumes none of them. The socket receives only `WireMessage`; moving unused shapes would add scope without a caller.

### Validate the whole frame in one catch-all parse

Rejected because one undifferentiated Zod failure would collapse `non-object`, `unknown-type`, `invalid-count` and `invalid-event`, contrary to AC-14.

### Put all connection behaviour in one React hook

Rejected because parsing, state reduction and socket lifetime are independently testable without DOM or React. Keeping them pure also avoids `.test.tsx`, which this package's test inventory does not admit.

### Automatically reconnect

Rejected because no resume cursor exists. Reconnection could duplicate accepted events or hide a missed prefix. Retry remains an explicit user action and preserves prior evidence.

### Use a string proxy target or add CORS

Rejected because a URL string violates the existing whole-package network-literal guard, while CORS would widen an unauthenticated loopback daemon that starts runs. Vite accepts an object-form proxy target.

### Freeze the route exception table at eight rows

Rejected because qa-red enlarges the scanned corpus. The table is governed by identity and exercised-use rules; eight is only the measured pre-qa baseline.

### Run parser and shared-schema development concurrently

Rejected because the committed schema stub throws even through `safeParse`. The parser task therefore depends on the schema task, giving its developer a usable implementation and avoiding a failure in another role's file.

### Serialize the controller and React adapter behind frontend implementations

Rejected because their committed interfaces, rather than predecessor bodies, are the contracts they consume. Running them independently reduces merge boundaries and permits the frontend work to fan out without weakening ownership or API guarantees.

## Behavioral decisions

### Connection states

The closed set is `idle`, `connecting`, `live`, `no-daemon`, `no-such-run`, `ended`, `interrupted`, `dropped` and `protocol-error`.

Close precedence is:

1. Code 1008 produces `no-such-run`.
2. Code 1013 produces `dropped`.
3. A normal close after an accepted terminal event produces `ended`.
4. Every other close after opening and before a terminal event produces `interrupted` with its code and browser reason.
5. Failure before `open` produces `no-daemon` and names the requested same-origin URL.

Only failure states offer Retry. A non-run route is `idle` and opens no socket.

### Missed frames

A missed frame never enters the event list. `count: 7` becomes a visible notice. `count: 0` is retained in the snapshot as `missedCount === 0`, distinct from `null`, while rendering no notice. A later missed frame replaces the earlier count; counts do not accumulate because the server emits at most one replay-prefix envelope per connection.

### Socket lifetime

Each controller owns at most one socket. Replacement closes and invalidates the previous socket before constructing another. Superseded, closed or disposed callbacks cannot mutate state, events or missed-count state. Disposal is idempotent. Retry is never automatic, constructs exactly one replacement, moves to `connecting`, and preserves accepted events and the missed count.

### URL construction

The handle is percent-encoded as one path segment. The socket protocol is derived from the page protocol: HTTP becomes WebSocket and HTTPS becomes secure WebSocket. The browser receives only a same-origin URL; the Vite proxy target is not presented as an address the browser contacted.

The development proxy port defaults to 7717 as a Vite convention. The daemon itself still has no default port, and the eventual `quorum open` command must arrange agreement with this convention.

`AppProps.pageUrl` defaults to the browser's current location when `window` exists. Tests and non-browser rendering must inject it explicitly when a run connection is opened.

## Contracts

### Typed contracts at their final package paths

- `packages/shared/src/wire.ts` — defines `WireMessage` and the throwing `wireMessageSchema` runtime stub. The schema implementation must accept only event envelopes with an `event` member and missed envelopes whose count is a finite non-negative integer.
- `packages/shared/src/index.ts` — exports the wire module from the shared barrel.
- `packages/server/src/wire.ts` — imports and re-exports `WireMessage`; the obsolete orphaned JSDoc is removed rather than left unattached.
- `apps/web/src/daemon-endpoints.ts` — contains the complete five-entry `DAEMON_ENDPOINTS` table plus throwing `runEventsPath` and `runEventsUrl` stubs.
- `apps/web/src/frame-parser.ts` — exports `FrameRefusal`, `ParsedFrame`, `FrameParseResult` and a throwing `parseFrame` stub. Its value imports of `wireMessageSchema` and `eventSchema` make shared validation browser-reachable.
- `apps/web/src/connection-state.ts` — exports the closed `ConnectionState` and `ConnectionAction` unions, `ConnectionMachine`, and throwing reducer, renderer and retry-policy stubs.
- `apps/web/src/run-connection.ts` — exports `SocketTransport`, `SocketFactory`, `RunConnectionSnapshot`, `RunConnection` and the throwing `createRunConnection` stub.
- `apps/web/src/app.tsx` — exports `AppProps`, including the socket factory and page URL injection seam. The `App` function retains its own JSDoc instead of leaving two comments attached to `AppProps`.
- `apps/web/src/shell.tsx` — exports `ShellConnectionProps` and `ShellProps`, establishing the component-tree protocol used by qa-red.

### Contract-time dependency support

- `apps/web/package.json` — declares `@quorum/shared` as a browser runtime dependency. `frontend-dev-proxy` owns this manifest during development if correction is required.
- `pnpm-lock.yaml` — carries the matching `apps/web` workspace-link importer so frozen installation reaches tests rather than failing first. It remains a generated contract prerequisite; any correction is performed by the human at a gate with `pnpm install`, not by a development task.

### Prose contract

- `contracts/Q-0120/live-connection.contract.md` — freezes parser refusal identities, staged validation, close precedence, socket lifetime, missed-count replacement semantics, the route-exception rule, assembled-needle rules and the complete qa-red file assignment.

The authoritative declaration-restatement predicate is structural: no `interface` or `type` alias in `apps/web` may pair a `type: 'missed'` discriminant with a `count` member. `ParsedFrame`'s `Extract<WireMessage, { type: 'missed' }>` is a reference to the shared definition, not a restatement. The guard must be shown to have a subject with a fixture that re-declares the complete `WireMessage` union, while the legitimate `FrameRefusal` and `ConnectionAction` declarations remain accepted.

The authoritative qa-red assignment includes the following server-local checks:

- `packages/server/src/index.test.ts` — assert that `WireMessage` is re-exported from shared while the existing runtime `SURFACE` register remains unchanged.
- `packages/server/src/package.test.ts` — assert that server source and manifest contain no CORS middleware, header or dependency, while retaining the six no-export-surface assertions.
- `packages/shared/src/wire.test.ts` — test the shared schema and the `apps/web` lockfile importer only; it must not read server source.

The shared barrel's explicit runtime register adds `wireMessageSchema`. `WireMessage` is type-only and must not be asserted with a runtime `toHaveProperty` check; its availability is established through type use and the server type re-export check.

No migration or data-schema skeleton is required.

## What qa-red must write

The authoritative assignment is in `contracts/Q-0120/live-connection.contract.md`; this section is a summary, not a competing copy.

- Put URL-builder tests in `apps/web/test/daemon-endpoints.test.ts`. Cover HTTP and HTTPS pages, handles containing `/`, `?`, `#` and a space, the source-only WebSocket/hostname/port scan, and proof that both client path construction and the Vite proxy consume `DAEMON_ENDPOINTS`.
- Recursively scan all files under `apps/web/src` in `apps/web/test/routes.test.ts`. Keep comments and tests in the corpus. Implement the `(file, literal, reason)` exception rule using the eight measured rows as a baseline; derive new fixture paths from contract values wherever possible.
- Assemble `http:` plus `//`, `https:` plus `//`, `ws:`/`wss:` and the workspace-scope needle at runtime whenever their containing corpus is scanned.
- In `apps/web/test/source.test.ts`, reject a declaration that pairs `type: 'missed'` with `count`; demonstrate the guard with a full duplicate-union fixture and demonstrate its discrimination by accepting the contracted refusal, action and `Extract`-based declarations.
- Put parser, reducer and controller tests beside their pure subjects as `.test.ts`. Parser scenarios tag both `frontend-frame-parser` and `backend-wire-schema`.
- For zero missed events, assert `snapshot.missedCount === 0`, `events` unchanged and no rendered notice. Do not let `null` satisfy the test.
- Remove `CONNECTION_PENDING` from `shell.test.ts`'s named import and retire its old assertion before development deletes the symbol. “Retired by replacement” applies to the sentence, not preservation of the constant.
- Keep lockfile reads out of the web suite. Place the importer assertion in `packages/shared/src/wire.test.ts`, assemble its scope needle, declare the lockfile in the shared test task inputs, and update the hand-audited shared-test read register in `packages/core/src/turbo-inputs.test.ts`.
- Add `wireMessageSchema` to `packages/shared/src/index.test.ts`'s explicit runtime register. Prove `WireMessage` through type use rather than a runtime-property assertion.
- In `packages/server/src/index.test.ts`, assert the shared `WireMessage` type re-export without changing the runtime `SURFACE` register.
- In `packages/server/src/package.test.ts`, add the source-and-manifest CORS guard while preserving the package's six no-export-surface assertions.
- Reuse the existing shared export-condition assertion rather than duplicating it.
- Cover the retired documentation sentences, glossary definition and unchanged terminology lists in `packages/shared/src/docs.test.ts`.

Development tasks must not edit any `*.test.ts` file.

## Tasks

```yaml
tasks:
  - id: backend-wire-schema
    role: backend
    title: Implement the shared wire schema and server re-export
    description: >-
      Own packages/shared/src/wire.ts, packages/shared/src/index.ts, and
      packages/server/src/wire.ts. Implement the discriminated runtime envelope schema,
      preserve the shared barrel export, import and re-export WireMessage from the server,
      and repair the orphaned server JSDoc. Do not touch apps/web/**, package manifests,
      pnpm-lock.yaml, documentation, or any *.test.ts file.
    contracts:
      - packages/shared/src/wire.ts
      - packages/server/src/wire.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-daemon-endpoints
    role: frontend
    title: Implement same-origin run-event URL construction
    description: >-
      Own apps/web/src/daemon-endpoints.ts only. Implement runEventsPath and
      runEventsUrl from the complete DAEMON_ENDPOINTS register, percent-encoding the
      handle as one segment and deriving the WebSocket scheme from the page URL. Do not
      touch vite.config.ts, other source modules, packages/**, pnpm-lock.yaml,
      documentation, or any *.test.ts file.
    contracts:
      - apps/web/src/daemon-endpoints.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-connection-state
    role: frontend
    title: Implement the connection reducer and state presentation
    description: >-
      Own apps/web/src/connection-state.ts only. Implement every reducer transition,
      close-code precedence, terminal tracking, distinct user-facing strings and retry
      eligibility for the contracted closed state set. Do not touch socket lifecycle,
      React components, packages/**, documentation, or any *.test.ts file.
    contracts:
      - apps/web/src/connection-state.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-dev-proxy
    role: frontend
    title: Configure the daemon proxy and browser source resolution
    description: >-
      Own apps/web/vite.config.ts and apps/web/package.json only. Import
      DAEMON_ENDPOINTS, preserve the @quorum/shared workspace dependency, proxy all five
      prefixes with WebSocket upgrades to an object-form configured host and port
      defaulting to 127.0.0.1:7717, document that the port is a dev-server convention,
      and add quorum-source while spreading Vite's client defaults. Do not add URL-string
      targets, CORS, build scripts, other source changes, packages/**, pnpm-lock.yaml, or
      any *.test.ts file.
    contracts:
      - apps/web/src/daemon-endpoints.ts
      - apps/web/package.json
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: backend-lockfile-test-input
    role: backend
    title: Declare the shared suite's lockfile input
    description: >-
      Own packages/shared/turbo.json only. Add ../../pnpm-lock.yaml to the shared test
      task inputs so qa-red's importer assertion is cache-correct. Do not touch the
      lockfile itself, packages/core/**, application files, documentation, or any
      *.test.ts file.
    contracts:
      - contracts/Q-0120/live-connection.contract.md
      - pnpm-lock.yaml
    depends_on: []

  - id: frontend-frame-parser
    role: frontend
    title: Implement staged, non-throwing frame parsing
    description: >-
      Own apps/web/src/frame-parser.ts only. Implement the staged parser using the shared
      runtime envelope schema and eventSchema while preserving all six refusal identities
      and never throwing. Do not duplicate WireMessage, change shared schemas, touch socket
      lifecycle or React modules, or modify any *.test.ts file.
    contracts:
      - apps/web/src/frame-parser.ts
      - packages/shared/src/wire.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on:
      - backend-wire-schema

  - id: frontend-run-connection
    role: frontend
    title: Implement one-socket lifecycle and explicit retry
    description: >-
      Own apps/web/src/run-connection.ts only. Implement connection replacement, stale
      callback invalidation, parsing, reducer dispatch, event and missed-count snapshots,
      replacement semantics for repeated missed frames, explicit retry, subscriptions and
      idempotent disposal. Preserve events and missedCount across retry and never persist
      browser state. Do not touch endpoint, parser or reducer implementations, React
      components, packages/**, or any *.test.ts file.
    contracts:
      - apps/web/src/run-connection.ts
      - apps/web/src/frame-parser.ts
      - apps/web/src/connection-state.ts
      - apps/web/src/daemon-endpoints.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-react-connection
    role: frontend
    title: Mount and render the run connection
    description: >-
      Own apps/web/src/app.tsx and apps/web/src/shell.tsx only. Create one controller for
      a run route, replace it on handle changes, dispose it when leaving or unmounting,
      default pageUrl to the browser location, and render the contracted state, Retry,
      missed notice, event count and latest event identity beside the unchanged run
      placeholder. Delete CONNECTION_PENDING while preserving separate JSDoc for AppProps
      and App. Do not change route registration, pure connection modules, packages/**,
      documentation, or any *.test.ts file.
    contracts:
      - apps/web/src/app.tsx
      - apps/web/src/shell.tsx
      - apps/web/src/run-connection.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: backend-connection-docs
    role: backend
    title: Document the shipped connection architecture and vocabulary
    description: >-
      Own docs/04-architecture.md, docs/GLOSSARY.md, and harness/architecture.md only.
      Replace the obsolete no-connection text, document shared ownership and server
      re-export of the frame union, add the dated status entry, define Connection state
      as distinct from run state, and mark frontend as active without changing role-table
      grants. Do not touch CLAUDE.md, docs/README.md, flows, templates, application or
      package source, or any *.test.ts file.
    contracts:
      - contracts/Q-0120/live-connection.contract.md
      - packages/shared/src/wire.ts
    depends_on: []
```

## Ownership and sequencing check

Every production or documentation file expected to change after qa-red has exactly one task owner. No task owns a test. `packages/server/src/wire.ts` is owned by the backend role now granted that package. `apps/web/package.json` is owned by `frontend-dev-proxy`; the generated lockfile remains a gate-owned contract prerequisite.

The shared schema, endpoint, reducer, proxy, controller, React adapter, input-registration and documentation tasks can begin together. The parser alone waits for `backend-wire-schema`, because the committed Zod stub throws through `safeParse`. The controller and React adapter consume committed interfaces rather than predecessor implementations, so they do not need additional dependency edges. This reduces the development fan-out from four waves to two and avoids warn-and-continue merge boundaries that provide no contract benefit.

The implementation remains multi-vendor: Codex owns substantive runtime validation and the server contract, while Claude owns browser parsing, connection behaviour and presentation.

## Review findings addressed

### Iteration 1

- Removed all qa-red-only tasks from the development YAML and moved the test assignment into prose.
- Added an owner for `daemon-endpoints.ts`; kept its table complete and its functions stubbed.
- Contracted the `App` and `Shell` prop protocols and kept both component files in one task.
- Added a backend owner for shared schema implementation, barrel export and server re-export, restoring substantive multi-vendor work.
- Moved the lockfile assertion to the shared suite and added a development task for its declared Turbo input.
- Assigned retirement of the old connection sentence and import to qa-red.

### Iteration 2

- Replaced the impossible exact-endpoint-only route exemption with an identity register.
- Made staged validation consistent between the prose contract and parser imports.
- Added runtime shared-package imports in browser source.
- Assigned both orphaned JSDoc repairs to their file owners.
- Ruled that the `CONNECTION_PENDING` symbol is deleted and its sentence replaced.

### Iteration 3

- Added a contract-wide runtime-assembly rule for HTTP(S), WebSocket and workspace-scope needles so scans do not reject their own fixtures.
- Chose `apps/web/test/daemon-endpoints.test.ts` for URL tests, outside the source-only scan.
- Changed the eight route exceptions from a frozen count to a measured baseline and required new fixtures to derive paths from contract values.
- Assigned URL construction, the new forbidden-literal scan and the proxy/client register comparison to the endpoint test file.
- Moved the complete qa-red map and ordering rules into `contracts/Q-0120/live-connection.contract.md`, which `write-tests` reads.
- Added a dependency from `frontend-frame-parser` to `backend-wire-schema`; parser scenarios additionally tag both task ids as required by the contract.
- Made `count: 0` observable at the snapshot as distinct from `null`.
- Ruled that a later missed frame replaces rather than accumulates the count.
- Specified the default for `AppProps.pageUrl`.
- Reused the existing shared export-condition assertion.
- Assigned the hand-audited shared test-input register update to qa-red and documented that the shared barrel register is explicit rather than automatic.

### Iteration 4

- Replaced the unsatisfiable member-name declaration scan with the structural `type: 'missed'` plus `count` pairing predicate. The contract distinguishes shared-type references from field restatements and requires both a positive-control fixture and legitimate declarations that remain accepted.
- Added server-local qa-red assignments for the `WireMessage` re-export and the no-CORS/no-export-surface guard; removed server-source reads from the shared wire suite.
- Gave `apps/web/package.json` to `frontend-dev-proxy` and made lockfile correction an explicit human gate action.
- Retained only the measured schema-to-parser dependency and removed unnecessary controller and React dependency edges, reducing the graph to two waves.
- Named `wireMessageSchema` as the shared barrel's runtime addition and recorded that `WireMessage` must be proven as a type rather than with a runtime-property assertion.

## Verification and gate obligations

The contract worktree previously could not complete installation because registry access returned `ENOTFOUND`; that was not a code verdict. Before qa-red starts, the gate must run `pnpm install --frozen-lockfile` to exit 0, then run typecheck so the committed stubs are proven compilable. If the manifest/importer pair needs correction, the human regenerates and commits `pnpm-lock.yaml` at that gate.

The later delivery gate still owes the real-dev-server no-daemon measurement, the empty-store comparison, a Vite build with `packages/shared/dist` absent, and forced verification in both integration and main environment rows.
