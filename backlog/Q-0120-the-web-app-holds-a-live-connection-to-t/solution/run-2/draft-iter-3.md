# Q-0120 — Live daemon connection solution

## Chosen approach

`@quorum/shared` owns the single browser-safe `WireMessage` definition and the runtime schema for its outer envelope. `packages/server/src/wire.ts` imports and re-exports that type, preserving the server source surface without creating an `@quorum/server` package export.

Envelope parsing is deliberately staged so malformed inputs remain distinguishable:

1. `parseFrame` rejects non-text messages.
2. It parses JSON and rejects invalid JSON.
3. It rejects non-object values and unknown discriminants itself.
4. For a recognised discriminant, it calls `wireMessageSchema.safeParse`.
5. A rejected `missed` branch becomes `invalid-count`.
6. An accepted `event` envelope still carries an unknown payload, which is passed through `eventSchema`; failure becomes `invalid-event`.

This gives `wireMessageSchema` a real production consumer while preventing a single `ZodError` from collapsing `non-object`, `unknown-type`, `invalid-count`, and `invalid-event` into one refusal. `apps/web/src/frame-parser.ts` imports `wireMessageSchema` and `eventSchema` as runtime values, so browser reachability, workspace source resolution, and the Vite condition all have a non-vacuous subject.

The browser implementation is divided into five framework-neutral modules and one React integration seam:

1. `daemon-endpoints.ts` owns the complete daemon endpoint register and typed same-origin URL-builder stubs.
2. `frame-parser.ts` owns staged parsing and the closed refusal union.
3. `connection-state.ts` owns the pure reducer, close precedence, rendering, and Retry eligibility.
4. `run-connection.ts` owns one socket, callback invalidation, accepted events, missed-count state, and explicit Retry through an injectable transport.
5. `vite.config.ts` imports the endpoint register, configures the development proxy, and selects the shared package’s source export condition.
6. `app.tsx` and `shell.tsx` form one React adapter seam. Their committed prop interfaces define how the socket factory and connection snapshot cross the component boundary.

`DAEMON_ENDPOINTS` is complete because an empty register would make its tests vacuous. `runEventsPath` and `runEventsUrl` remain typed throwing stubs because encoding and protocol selection are development behavior.

The widened route-literal scan remains recursive over all source files, including tests and comments. It uses an exact `file + literal + reason` exception register for the eight measured non-route literals. Every exception must be exercised, and the two daemon endpoint exceptions are checked against `DAEMON_ENDPOINTS`.

The proxy uses Vite’s object target form and a configured port defaulting to `7717`. Documentation beside the value states that this is only the development server’s convention: the daemon has no default port, and a future `quorum open` must arrange agreement.

All handles, events, notices, and connection state remain in memory. There is no persistence adapter and no automatic reconnection.

## Rejected alternatives

### Exporting `@quorum/server`

Rejected because the package deliberately has no build or package export surface, which its existing package guard pins. It would also place server-only dependencies within reach of browser imports.

### Copying the frame union into `apps/web`

Rejected because it creates a second definition and provides no runtime protection against malformed JSON.

### Moving `WireRefusal`, `WireRun`, or `WireTicket`

Rejected because this ticket consumes none of them. The first browser HTTP consumer can move the shapes it uses through the same shared-package pattern.

### Letting `wireMessageSchema` validate the entire message in one undifferentiated operation

Rejected because one generic schema failure would not preserve the required identities for non-object input, an unknown discriminant, an invalid count, and an invalid event. Staged classification preserves those values without inspecting arbitrary Zod issue trees.

### Dropping `wireMessageSchema` and parsing the envelope entirely in the web package

Rejected because AC-12 explicitly requires the runtime schema beside the shared type, and it would reduce the backend half of the implementation to dead code with a dedicated test.

### Completing runtime behavior during solutioning

Rejected for schemas, URL builders, reducers, parsers, and controllers because qa-red must fail on their assertions before development. Only types and non-vacuous static registers are complete contracts.

### Blanking comments or excluding tests from the recursive route scan

Rejected because the existing scan deliberately over-collects in the safe direction, while excluding tests repeats the “shipping files only” narrowing already ruled out. Exact, exercised exceptions retain the broad subject without refusing known fixtures and prose.

### Rewording `router.ts` merely to satisfy the scan

Rejected because its three literals are explanatory documentation, not route declarations. An identity-based exception is more explicit and does not require adding an otherwise unrelated production-file owner.

### Separate React tasks for `App` and `Shell`

Rejected because both files share one component-tree protocol. Separate worktrees would have to invent matching props independently.

### A React hook containing parsing, reduction, and socket ownership

Rejected because it would couple protocol tests to jsdom and obscure stale-callback invalidation. Pure modules and an injectable transport are directly testable.

### Automatic reconnection

Rejected because the protocol has no resume cursor. It could duplicate accepted events or hide a missed prefix. Retry remains explicit and preserves existing evidence.

### CORS, an absolute daemon URL, or a URL-string proxy target

Rejected because the unauthenticated daemon is intentionally loopback-only and the existing whole-package network-literal guard has no exemption. Vite’s object target provides the bridge without weakening that guard.

### Adding a web build script

Rejected because emitted browser artifacts belong to Q-0122. This ticket adds only the source resolution condition needed to avoid relying on an existing `packages/shared/dist`.

### Putting qa-red work in `tasks.yaml`

Rejected because development dispatches every task on its first traversal and forbids test edits. Test assignments are stated separately and reach `write-tests` through generated scenarios.

## Contracts

The following contracts were created or refined in the worktree:

- `packages/shared/src/wire.ts` — complete `WireMessage` union and typed `wireMessageSchema` stub. The schema contract validates the outer envelope, including a finite non-negative integer missed count, while retaining an unknown event payload for `eventSchema`.
- `packages/shared/src/index.ts` — complete barrel export for the wire module.
- `packages/server/src/wire.ts` — complete type re-export preserving the server source surface. The obsolete JSDoc left without a declaration beneath it has been removed; the shared module now documents the moved shape.
- `apps/web/package.json` — complete runtime dependency contract for `@quorum/shared` as `workspace:*`.
- `pnpm-lock.yaml` — matching workspace link under the `apps/web` importer.
- `apps/web/src/daemon-endpoints.ts` — complete `DAEMON_ENDPOINTS` register and typed stubs for `runEventsPath` and `runEventsUrl`.
- `apps/web/src/frame-parser.ts` — typed `parseFrame` stub, runtime imports of `wireMessageSchema` and `eventSchema`, and complete `ParsedFrame`, `FrameParseResult`, and `FrameRefusal` unions.
- `apps/web/src/connection-state.ts` — typed reducer, renderer, and Retry stubs plus complete `ConnectionState`, `ConnectionAction`, and `ConnectionMachine` contracts.
- `apps/web/src/run-connection.ts` — typed `createRunConnection` stub plus complete `SocketTransport`, `SocketFactory`, `RunConnectionSnapshot`, and `RunConnection` interfaces.
- `apps/web/src/app.tsx` — complete `AppProps` contract exposing optional socket-factory and page-URL injection. Its `App` JSDoc is attached to `App`, not stacked above `AppProps`.
- `apps/web/src/shell.tsx` — complete `ShellProps` and `ShellConnectionProps` contracts for snapshot rendering and explicit Retry.
- `contracts/Q-0120/live-connection.contract.md` — prose contract freezing staged parsing, refusal names, the eight route-scan exception identities, close precedence, retry policy, callback invalidation, evidence preservation, and memory-only lifetime.

No migration or persistent data schema is required.

## Behavioral decisions

### Parsing

`parseFrame` accepts an unknown received value and never throws. Its refusal union is closed:

- `non-text-message`
- `invalid-json`
- `non-object`
- `unknown-type`
- `invalid-event`
- `invalid-count`

After the text and JSON checks, the parser establishes that the value is a non-null object and reads its discriminant. An unrecognised discriminant produces `unknown-type` before schema validation.

For a recognised branch, the parser calls `wireMessageSchema.safeParse`. The shared schema validates the two-field outer union and accepts a missed count only when it is a finite, non-negative integer. A failed recognised `missed` branch maps to `invalid-count`, retaining the supplied count where available. An accepted event envelope is subsequently passed through `eventSchema`; a failure maps to `invalid-event`.

The parser imports both schemas as values. It does not cast `JSON.parse` output to `WireMessage`, inspect Zod’s issue strings, or use a generic schema-error refusal.

### Route-literal scan

`apps/web/test/routes.test.ts` recursively walks every file below `apps/web/src`, including tests and comments. Its exception register contains exactly these measured identities:

| file | literal | reason |
| --- | --- | --- |
| `daemon-endpoints.ts` | `/project` | registered daemon endpoint, not a shell route |
| `daemon-endpoints.ts` | `/tickets` | registered daemon endpoint, not a shell route |
| `router.ts` | `/backlog/` | explanatory JSDoc fragment |
| `router.ts` | `/har` | explanatory JSDoc fragment |
| `router.ts` | `/runs/<handle>` | explanatory JSDoc placeholder |
| `shell.test.ts` | `/runs/run%20one` | encoded-handle fixture |
| `shell.test.ts` | `/nowhere/at/all` | unmatched-path fixture |
| `shell.test.ts` | `/backlog/%E0%A4%A` | malformed-encoding fixture |

Each entry is keyed by source-relative file and literal, carries a non-empty reason, and must be observed by the scan. Unused exceptions fail. The endpoint exceptions must equal the non-route literals contributed by `DAEMON_ENDPOINTS`, preventing the exception table from becoming an independent endpoint register.

### Connection precedence

The reducer applies close outcomes in this order:

1. Code 1008 becomes `no-such-run`.
2. Code 1013 becomes `dropped`.
3. A normal close after an accepted terminal event becomes `ended`.
4. Every other close after opening and before a terminal event becomes `interrupted`, retaining its code and reason.
5. Failure before `open` becomes `no-daemon`, retaining the requested same-origin URL.

A parser refusal becomes `protocol-error`. Non-run routes use `idle`. Only `no-daemon`, `no-such-run`, `interrupted`, `dropped`, and `protocol-error` offer Retry.

### Socket ownership

`createRunConnection` constructs an idle controller and opens nothing. `connect` invalidates and closes the previous transport before creating one replacement. `retry` uses the same replacement path with the retained handle and page URL. It preserves accepted events and the missed notice. `dispose` is idempotent. Every callback captures a connection generation, and callbacks from superseded or disposed transports are ignored.

### UI boundary

The run route connects for its decoded handle. Handle changes replace the connection; leaving the run route disposes it. Non-run routes remain idle and open no socket.

The shell receives evidence through `ShellConnectionProps`. It may render only state text, the missed notice, accepted-event count, the latest event’s `type` and `stepId`, and Retry where eligible. Mission-control placeholder metadata and the disabled run-flow control remain unchanged.

`CONNECTION_PENDING` the constant is deleted during development. Its old user-facing sentence is retired by replacement with connection-state rendering. Because deleting the constant would otherwise leave qa-red’s existing import uncompilable, qa-red must remove `CONNECTION_PENDING` from the named import in `apps/web/src/shell.test.ts` before development starts.

## What qa-red must write

These are qa-red file assignments, not development tasks. Scenario generation must carry them into `write-tests`, and every scenario must name the development task ids it exercises.

- `apps/web/src/frame-parser.test.ts` — drive valid event and missed frames plus every refusal by exact value. Cover non-text, invalid JSON, non-object JSON, unknown type, invalid event, and invalid count values of a string, `-1`, `1.5`, and a non-finite number. Include a test proving `wireMessageSchema.safeParse` is used for a recognised branch and `eventSchema` validates the event payload.
- `apps/web/src/connection-state.test.ts` — drive every reducer transition and rendered value; distinguish no daemon from no such run; prove that `ended` requires a terminal event.
- `apps/web/src/run-connection.test.ts` — use a fake transport to cover replacement, transport close records, stale callbacks, idempotent disposal, missed counts zero and seven, absence of automatic reconnect, explicit Retry, repeated Retry, and evidence preservation.
- `apps/web/src/shell.test.ts` — remove `CONNECTION_PENDING` from the existing import before development; retain the throwing-global non-run guard; use `AppProps` injection to assert exactly one run-route socket; cover connection evidence and Retry without creating a `.test.tsx` file.
- `apps/web/test/routes.test.ts` — recursively walk every file below `src`; add the exact eight-entry `file + literal + reason` exception register specified by the prose contract; fail on unused exceptions; compare endpoint exceptions to `DAEMON_ENDPOINTS`; retain comments and test files in the corpus; add a nested TypeScript positive-control fixture.
- `apps/web/test/package.test.ts` — update the exact dependency and justification registers; structurally assert Vite client conditions and the unchanged no-build surface. It must not read the workspace lockfile.
- `apps/web/test/source.test.ts` — retain the whole-package network scan without exemptions; add the declaration-restatement scan, a value-import reachability assertion, the persistence scan, and discriminating fixtures; assert that the retired connection sentence is absent from all source files.
- `packages/shared/src/index.test.ts` — pin the wire barrel export and re-run the existing browser-safety and flat-module guards over the enlarged corpus.
- `packages/shared/src/wire.test.ts` — drive `wireMessageSchema` over both valid outer-envelope variants and invalid missed counts. This same suite owns the `apps/web` lockfile-importer assertion, whose repository-root read is covered by the Turbo input task.
- `packages/server/src/index.test.ts` — assert that `WireMessage` is re-exported from shared without changing the existing runtime `SURFACE` register.
- `packages/server/src/package.test.ts` — assert that server source and manifest gained no CORS middleware, header, or dependency and retain the no-package-export assertions.
- `packages/shared/src/docs.test.ts` — assert removal of retired architecture prose, the shared/server wire boundary, the complete Connection state glossary entry, and that the two existing exact-term lists remain byte-identical.

The lockfile assertion belongs to the shared suite because `apps/web` has no Turbo input declaration and this ticket must not add its first one.

## Tasks

```yaml
tasks:
  - id: backend-wire-schema
    role: backend
    title: Implement the shared envelope schema and preserve the server re-export
    description: >-
      Own packages/shared/src/wire.ts, packages/shared/src/index.ts and
      packages/server/src/wire.ts only. Implement wireMessageSchema as the strict outer-envelope
      validator used by the browser parser: accept event envelopes with an unknown payload and
      missed envelopes only with a finite non-negative integer count. Preserve WireMessage, the
      shared barrel export and the server type re-export, and leave no orphaned JSDoc in server
      source. Do not touch apps/web, manifests, lockfiles, documentation, harness files or any
      test file.
    contracts:
      - packages/shared/src/wire.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-daemon-endpoints
    role: frontend
    title: Implement same-origin run-event URL construction
    description: >-
      Own apps/web/src/daemon-endpoints.ts only. Preserve the complete DAEMON_ENDPOINTS register
      and implement runEventsPath and runEventsUrl so the handle is one percent-encoded segment
      and the WebSocket scheme follows the page scheme. Do not touch parsing, socket lifecycle,
      React files, router.ts, Vite configuration, manifests, lockfiles, documentation or any test
      file.
    contracts:
      - apps/web/src/daemon-endpoints.ts
      - contracts/Q-0120/live-connection.contract.md
    depends_on: []

  - id: frontend-frame-parser
    role: frontend
    title: Implement staged WebSocket frame parsing
    description: >-
      Own apps/web/src/frame-parser.ts only. Implement the non-throwing staged parser using the
      committed runtime imports of wireMessageSchema and eventSchema. Reject non-text, invalid
      JSON, non-object and unknown-type inputs before branch validation; map a rejected recognised
      missed branch to invalid-count and a rejected event payload to invalid-event, preserving all
      committed refusal values. Do not touch shared or server code, endpoint construction,
      connection state, socket lifecycle, React files, configuration, manifests, lockfiles,
      documentation or any test file.
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
      Own apps/web/src/app.tsx and apps/web/src/shell.tsx only. Preserve the corrected JSDoc
      attachment on App. Use AppProps, ShellProps and ShellConnectionProps to connect only on a run
      route, replace on handle change, dispose on leave or unmount and render idle elsewhere.
      Delete the CONNECTION_PENDING constant and replace its sentence with connection-state
      rendering; show only permitted evidence and expose Retry only where eligible. Do not touch
      routes, router.ts, placeholder metadata, controller internals, CSS, Vite configuration,
      manifests, lockfiles, documentation or any test file.
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
    title: Declare the lockfile as an input to the shared test task
    description: >-
      Own packages/shared/turbo.json only. Add ../../pnpm-lock.yaml to the shared test task inputs
      so the lockfile-importer assertion in packages/shared/src/wire.test.ts cannot replay a stale
      result. Do not touch the lockfile, manifests, source modules, documentation, harness files or
      any test file.
    contracts:
      - apps/web/package.json
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

All tasks are development tasks. Every task references at least one committed contract. Every task is independent against those contracts and starts in the first wave. No two tasks own the same file, and every description states both its owned files and forbidden surfaces. Test files belong exclusively to qa-red.

The implementation fan-out is genuinely multi-vendor: `backend-wire-schema` owns executable shared-package validation on the backend role’s vendor, while the frontend tasks own the consuming browser implementation on the frontend role’s vendor.

## Review findings addressed

### Iteration 2 blocker 2.1 — widened route scan could never go green

Addressed by adding an exact eight-entry `file + literal + reason` exemption model to the prose contract and qa-red assignment. Comments and tests remain in the recursive corpus. Every exception must be exercised, and endpoint exceptions are checked against `DAEMON_ENDPOINTS`. No development task needs to alter `router.ts` or test fixtures.

### Iteration 2 blocker 2.2 — schema had no consumer and contradicted the prose

Addressed by choosing one staged-validation model in both code and prose. `frame-parser.ts` imports `wireMessageSchema` as a value. The parser classifies non-object and unknown-type cases first, invokes the shared schema for a recognised envelope, maps missed-branch rejection to `invalid-count`, and passes accepted event payloads through `eventSchema`. The schema is therefore reachable production code without collapsing refusal identities.

### Iteration 2 major M-1 — no browser value import from shared

Addressed by committing runtime imports of both `wireMessageSchema` and `eventSchema` in `apps/web/src/frame-parser.ts`. AC-12 browser reachability, AC-21 dependency resolution, AC-22 Vite conditions, and GO-6 now have a real subject.

### Iteration 2 major M-2 — orphaned JSDoc blocks

Addressed in the committed contracts. The obsolete server `WireMessage` block was removed, the shared declaration documents the moved envelope, and the `App` documentation now sits directly above `App` rather than above `AppProps`. Both owning task descriptions require those corrected attachments to remain intact.

### Iteration 2 major M-3 — development would delete an imported constant

Addressed by assigning qa-red to remove `CONNECTION_PENDING` from `shell.test.ts` before development. The ruling is explicit: the constant is deleted; its sentence is retired by replacement with state rendering. The source scan still proves the obsolete sentence is absent.

### Iteration 2 minor — lockfile assertion’s home was unnamed

Addressed by naming `packages/shared/src/wire.test.ts` as the owner of the lockfile-importer assertion. `backend-lockfile-test-input` names that same test in its description and owns the matching Turbo input declaration.

## Verification and gate obligations

`git diff --check` reports no whitespace errors for the revised contracts.

The solutioning gate must complete `pnpm install --frozen-lockfile` with exit status 0 before qa-red starts. A dependency materialization or registry failure is not a code verdict and must not be mistaken for proof of red.

Later gates still owe the requirement’s runtime measurements:

- daemon-down and daemon-up behavior through a real Vite proxy;
- the cold-store package and byte delta;
- browser source resolution with `packages/shared/dist` absent;
- the jsdom suite’s shared-package resolution on that same clean tree;
- forced lint, typecheck, test, `quorum lint`, and git-identity verification in both the integration worktree and merged main environment.
