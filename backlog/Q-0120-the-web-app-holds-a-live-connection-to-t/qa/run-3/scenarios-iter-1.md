# Q-0120 — Test scenarios (qa-red, run 3, iteration 1)

Written against `requirements/merged.md` (run 1, iteration 2), `solution/solution.md`, `solution/errata.md` (E-1, E-2) and `solution/tasks.yaml`. One scenario set per acceptance criterion (AC-12 to AC-23), in the Test: shape each criterion already specifies — this document operationalises those clauses rather than inventing new scope. Every scenario was checked against `tasks.yaml` before it was written: each production file a scenario requires changed has exactly one task owner, and no scenario asks a development task to touch a `*.test.ts` file.

Errata are already folded in: **E-1** replaces AC-12's Test clause (i) — the member-name declaration scan — with a structural predicate on the `type: 'missed'` + `count` pairing; **E-2** moves the AC-12(c-i) re-export assertion and the AC-13(e) no-CORS assertion into `packages/server`'s own test files and strikes the "server re-export text" clause from `packages/shared/src/wire.test.ts`.

File paths below are illustrative, drawn from `solution.md`'s explicit "What qa-red must write" instructions and from `requirements/merged.md §0.5/§0.13` (`apps/web/test/source.test.ts`, `apps/web/test/routes.test.ts`). The authoritative assignment is `contracts/Q-0120/live-connection.contract.md`, which this document did not have direct access to; where a path is not explicitly stated in the inputs available, it is marked "(proposed)".

---

## AC-12 — the frame union has exactly one definition, reachable from a browser bundle

### 12.1 — declaration pairing is refused (E-1 predicate)
**Tasks:** backend-wire-schema, frontend-frame-parser, frontend-connection-state
**Test file:** `apps/web/test/source.test.ts`

- **Given** a fixture file under `apps/web/src` declares `interface Bogus { type: 'missed'; count: number }`, restating the shared union
- **When** the declaration-pairing scan runs over the fixture corpus
- **Then** it reports a violation naming the fixture file, proving the guard has a subject

### 12.2 — legitimate declarations are not flagged (discrimination)
**Tasks:** frontend-frame-parser, frontend-connection-state
**Test file:** `apps/web/test/source.test.ts`

- **Given** `apps/web/src/frame-parser.ts` declares `FrameRefusal` (carrying its own `type`-like discriminants but never a `type: 'missed'` + `count` pair) and `apps/web/src/connection-state.ts` declares `ConnectionAction` with branches like `{ type: 'message'; ... }`
- **When** the scan runs over the real (non-fixture) source tree
- **Then** it reports zero violations for `FrameRefusal` and `ConnectionAction`

### 12.3 — a real reference to the union via `Extract` is not a restatement
**Tasks:** frontend-frame-parser
**Test file:** `apps/web/test/source.test.ts`

- **Given** `apps/web/src/frame-parser.ts:15` uses `Extract<WireMessage, { type: 'missed' }>` to narrow the imported type
- **When** the scan runs
- **Then** it does not flag this usage, because it is a reference to the imported type, not a second declaration

### 12.4 — at least one file under `src/` imports the shared package
**Tasks:** backend-wire-schema, frontend-frame-parser
**Test file:** `apps/web/test/source.test.ts`

- **Given** the merged tree after implementation
- **When** the corpus walk collects import specifiers under `apps/web/src`
- **Then** at least one file imports `@quorum/shared`, so `WireMessage` is genuinely reachable from a browser module rather than merely declared

### 12.5 — the server re-exports `WireMessage`, and its runtime surface is unchanged
**Tasks:** backend-wire-schema
**Test file:** `packages/server/src/index.test.ts` (per errata E-2)

- **Given** `packages/server/src/wire.ts` imports `WireMessage` from `@quorum/shared` and re-exports it
- **When** the barrel's existing `SURFACE` register is read against the file's own text
- **Then** the register is unchanged from before this ticket, and a static assertion confirms `WireMessage` is exported from `@quorum/shared` via `wire.ts`

### 12.6 — `packages/shared`'s house rules hold over the enlarged corpus
**Tasks:** backend-wire-schema
**Test file:** `packages/shared/src/index.test.ts`

- **Given** a new flat module `packages/shared/src/wire.ts` and its `wireMessageSchema` export added to the barrel
- **When** the six existing clauses of `index.test.ts` re-run (barrel-line pattern, flat `src/`, import specifiers are `./…` or `zod`, no `node:` imports, no filesystem/process/env access, no `@quorum/` literal anywhere under `src/`, including this new file)
- **Then** all six clauses pass without modification, because they read the directory rather than a hand-maintained file list

### 12.7 — `WireRefusal`, `WireRun` and `WireTicket` are unmoved
**Tasks:** backend-wire-schema
**Test file:** `packages/server/src/index.test.ts`

- **Given** the merged change
- **When** `packages/server`'s exported symbol set is compared against its pre-ticket baseline
- **Then** `WireRefusal`, `WireRun` and `WireTicket` are still declared in `packages/server`, not moved to `packages/shared` — §0.17 struck that scope

---

## AC-13 — the client reaches the daemon same-origin, and the dev server bridges it

### 13.1 — URL construction for an `http:` page
**Tasks:** frontend-daemon-endpoints
**Test file:** `apps/web/test/daemon-endpoints.test.ts`

- **Given** the page's own origin is `http://localhost:5173` and a run handle `Q-0120-3`
- **When** `runEventsUrl(handle, pageUrl)` is called
- **Then** it returns a `ws://localhost:5173/runs/Q-0120-3/events`-shaped URL — same host and port as the page, scheme derived as `ws:`

### 13.2 — URL construction for an `https:` page
**Tasks:** frontend-daemon-endpoints
**Test file:** `apps/web/test/daemon-endpoints.test.ts`

- **Given** the page's own origin is `https://quorum.example`
- **When** `runEventsUrl` is called
- **Then** the returned URL's scheme is `wss:`, never `ws:`

### 13.3 — hostile handles cannot create a second path segment
**Tasks:** frontend-daemon-endpoints
**Test file:** `apps/web/test/daemon-endpoints.test.ts`

- **Given** four handles: one containing `/`, one containing `?`, one containing `#`, one containing a space
- **When** each is passed to `runEventsPath`/`runEventsUrl`
- **Then** each produces exactly one percent-encoded path segment — the resulting URL's path has no extra `/` segment, no query string, and no fragment introduced by the handle

### 13.4 — the client's request path and the proxy's forwarded prefix share one register
**Tasks:** frontend-daemon-endpoints, frontend-dev-proxy
**Test file:** `apps/web/test/daemon-endpoints.test.ts`

- **Given** `DAEMON_ENDPOINTS` names `/runs` among its five prefixes
- **When** `runEventsPath`'s output prefix is compared against `vite.config.ts`'s proxy configuration
- **Then** both read from the same exported table rather than each hard-coding `/runs`, so a prefix change in one place changes both

### 13.5 — no absolute URL or network literal appears in `apps/web/src`
**Tasks:** frontend-daemon-endpoints, frontend-dev-proxy
**Test file:** `apps/web/test/source.test.ts`

- **Given** the whole-package scan for `http://`, `https://` and `//fonts.` (Q-0014's guard) re-run over the enlarged corpus
- **When** the scan walks every file under `apps/web` (not just `src/`)
- **Then** it finds none of the three literals outside `vite.config.ts`'s documented exemption, and — critically — **no new exemption entry exists for the proxy target**, because `vite.config.ts`'s target is an object (`{ host, port }`), not a string

### 13.6 — the object-form proxy target has a subject
**Tasks:** frontend-dev-proxy
**Test file:** `apps/web/test/source.test.ts` (positive control)

- **Given** a mutated fixture where the proxy target is written as the string literal `'http://127.0.0.1:7717'`
- **When** the network-literal scan runs over the fixture
- **Then** it reports a violation, proving the scan would have caught the string form and that the object form is a genuine avoidance rather than an unexercised exemption

### 13.7 — the daemon's default port is documented as a dev-server convention, not a daemon fact
**Tasks:** frontend-dev-proxy
**Test file:** `apps/web/test/vite-config.test.ts` (proposed)

- **Given** `vite.config.ts`'s proxy target reads its port from configuration with a literal default
- **When** the file's text is inspected
- **Then** a comment beside the default states that the daemon itself has no default port and that the value is `quorum open`'s to later reconcile — a structural/textual assertion, not a behavioural one
- **Note:** per AC-13(c), no test reads the underlying environment variable; only the default literal and its documentation are asserted

### 13.8 — the route-literal scan is recursive and blind to nothing
**Tasks:** frontend-daemon-endpoints
**Test file:** `apps/web/test/routes.test.ts`

- **Given** a template literal `` `/runs/${handle}/events` `` inside `apps/web/src/run-connection.ts`, a non-`.tsx` file, and inside a subdirectory
- **When** `routes.test.ts`'s corpus walk runs (now recursive over every file under `src/`, not `.tsx`-only and not top-level-only)
- **Then** the literal is collected, and it is registered as an accepted endpoint literal (via the `(file, literal, reason)` exception table) rather than silently passing or silently failing

### 13.9 — the endpoint does not leak into `ROUTES`
**Tasks:** frontend-daemon-endpoints
**Test file:** `apps/web/test/routes.test.ts`

- **Given** the shell's router table `ROUTES`
- **When** it is compared against the five daemon endpoint prefixes
- **Then** none of the daemon endpoints (`/runs`, `/project`, `/tickets`, `/flows`, `/history`) is present as a navigable shell route — the WebSocket endpoint is not something the router would navigate to and render a placeholder at

### 13.10 — no CORS middleware, header or dependency reaches the daemon
**Tasks:** backend-wire-schema
**Test file:** `packages/server/src/package.test.ts` (per errata E-2, retaining existing no-export-surface assertions)

- **Given** `packages/server/src/*.ts` and its `package.json`
- **When** both are scanned for the string `cors`
- **Then** neither contains it, and the six pre-existing `own.exports`/`own.main`/`own.types`/`own.files`/`own.bin`/`own.build` === `undefined` assertions from `package.test.ts:138–147` still pass unmodified

---

## AC-14 — a frame is parsed, never cast, and every refusal is distinguishable

**Tasks:** frontend-frame-parser, backend-wire-schema (dependency: the parser calls the shared schema)
**Test file:** `apps/web/src/frame-parser.test.ts`

### 14.1 — a valid event frame parses
- **Given** a text message `{"type":"event","event":{...valid per eventSchema...}}`
- **When** `parseFrame` runs
- **Then** it returns a parsed event frame, not a refusal

### 14.2 — a valid missed frame parses
- **Given** a text message `{"type":"missed","count":7}`
- **When** `parseFrame` runs
- **Then** it returns a parsed missed frame carrying `count: 7`

### 14.3 — an unknown discriminant is refused distinguishably
- **Given** `{"type":"heartbeat"}`
- **When** `parseFrame` runs
- **Then** it returns a refusal whose identity (e.g. `unknown-type`) differs from every other refusal identity in this suite

### 14.4 — an event payload failing `eventSchema` is refused as `invalid-event`
- **Given** `{"type":"event","event":{"garbage":true}}`
- **When** `parseFrame` runs
- **Then** it returns a refusal identified `invalid-event`, distinct from `unknown-type`

### 14.5 — a non-object JSON value is refused as `non-object`
- **Given** the text `"just a string"` or `42` or `[1,2,3]`
- **When** `parseFrame` runs
- **Then** it returns a refusal identified `non-object`, distinct from the four other refusals

### 14.6 — a non-text message is refused as `non-text`
- **Given** a binary/`ArrayBuffer` message
- **When** `parseFrame` runs
- **Then** it returns a refusal identified `non-text`, without ever passing the payload to `JSON.parse`

### 14.7 — text that is not JSON is refused as `invalid-json`, never thrown
- **Given** the text `not json at all {`
- **When** `parseFrame` runs
- **Then** it returns a refusal identified `invalid-json` rather than throwing — `JSON.parse`'s exception is caught inside the parser

### 14.8 — each invalid `count` shape is refused as `invalid-count`
- **Given** four missed frames: `{"type":"missed","count":"7"}`, `{"type":"missed","count":-1}`, `{"type":"missed","count":1.5}`, `{"type":"missed","count":Infinity}` (via a pre-parsed object, since raw JSON cannot encode `Infinity`)
- **When** `parseFrame` runs on each
- **Then** all four return a refusal identified `invalid-count`, distinguishable from `invalid-event` and from a successfully parsed frame

### 14.9 — the parser never throws
- **Given** every fixture in 14.3–14.8, plus malformed UTF-16 surrogate text
- **When** `parseFrame` is invoked inside a `expect(() => parseFrame(x)).not.toThrow()` wrapper
- **Then** no invocation throws — every failure path returns a refusal value

---

## AC-15 — the connection has a named state for every case, and none of them is silence

**Tasks:** frontend-connection-state
**Test file:** `apps/web/src/connection-state.test.ts`

### 15.1 — idle on a non-run route
- **Given** no run route is mounted
- **When** the reducer's initial state is inspected
- **Then** it is `idle`

### 15.2 — connecting, then live
- **Given** state `idle`
- **When** a `connect` action fires, followed by the transport's `open` event
- **Then** the state moves `idle → connecting → live`

### 15.3 — code 1008 produces `no-such-run`
- **Given** state `live` (or `connecting`)
- **When** a close action with code `1008` is dispatched
- **Then** the state becomes `no-such-run`

### 15.4 — code 1013 produces `dropped`
- **Given** state `live`
- **When** a close action with code `1013` is dispatched
- **Then** the state becomes `dropped`

### 15.5 — a normal close after an accepted terminal event produces `ended`
- **Given** state `live` and a `terminal` event has already been dispatched and accepted
- **When** a normal close (code `1000`) is dispatched
- **Then** the state becomes `ended`

### 15.6 — a normal close with no terminal event produces `interrupted`, not `ended`
- **Given** state `live`, no `terminal` event has been accepted
- **When** a normal close (code `1000`) is dispatched
- **Then** the state becomes `interrupted`, carrying the close code and the browser's reason as text — proving `ended` requires the terminal fact, not merely a clean close code

### 15.7 — any other close before a terminal event produces `interrupted`
- **Given** state `live`, no terminal event
- **When** a close with an arbitrary code (e.g. `1006`) is dispatched
- **Then** the state becomes `interrupted`, carrying that code and reason

### 15.8 — a failure before `open` produces `no-daemon`, naming the requested URL
- **Given** state `connecting`, the transport never reached `open`
- **When** an error/close action fires before any `open`
- **Then** the state becomes `no-daemon`, and its rendered text names the same-origin URL the client requested (never a host:port the client does not hold)

### 15.9 — a protocol error (AC-14 refusal) produces `protocol-error`
- **Given** state `live`
- **When** a `frame-refused` action (carrying any AC-14 refusal) is dispatched
- **Then** the state becomes `protocol-error`

### 15.10 — `no-daemon` and `no-such-run` are distinguishable by state AND by user-facing string
- **Given** the two states from 15.3 and 15.8
- **When** each is rendered
- **Then** the two rendered strings differ — one reads as "the daemon at `<url>` did not respond" in substance, the other as "no run with this handle" — proving a single catch-all string cannot satisfy both

---

## AC-16 — a `missed` count is reported, and it is not an event

**Tasks:** frontend-run-connection
**Test file:** `apps/web/src/run-connection.test.ts`

### 16.1 — a nonzero missed count surfaces and is not added to events
- **Given** an active connection with zero accepted events
- **When** a missed frame with `count: 7` arrives
- **Then** the connection snapshot exposes `missedCount === 7`, and `snapshot.events.length` is unchanged (0)

### 16.2 — a zero missed count is retained distinctly from absence
- **Given** an active connection
- **When** a missed frame with `count: 0` arrives
- **Then** `snapshot.missedCount === 0` (not `null`, not `undefined`), `events` is unchanged, and the renderer shows no notice for it — with the reason recorded beside the test: the daemon (`http.ts:109–111`) never actually sends `count: 0`, so this is the parser's own defence rather than an observed wire case

### 16.3 — a later missed frame replaces, not accumulates
- **Given** a missed frame with `count: 3` has already been accepted
- **When** a second missed frame with `count: 5` arrives
- **Then** `snapshot.missedCount === 5`, never `8` — replacement semantics, matching the server's one-envelope-per-connection behaviour

### 16.4 — a missed notice survives a retry
- **Given** `snapshot.missedCount === 7` (covered fully under AC-18; cross-referenced here)
- **When** the connection is retried (AC-18)
- **Then** `missedCount` remains `7` until superseded by a new missed frame

---

## AC-17 — one socket at a time, and leaving closes it

**Tasks:** frontend-run-connection
**Test file:** `apps/web/src/run-connection.test.ts`

### 17.1 — mounting the run route opens exactly one socket
- **Given** a fake `SocketFactory` recording construction calls
- **When** `createRunConnection(handle, ...)` is invoked for the first time
- **Then** the factory records exactly one construction, for that handle's URL

### 17.2 — changing the handle closes the previous socket and opens exactly one replacement
- **Given** an active connection for handle `A`
- **When** the connection is re-pointed at handle `B`
- **Then** the fake transport for `A` records a `close` call, and the factory records exactly one new construction, for `B`'s URL

### 17.3 — leaving/unmounting closes the active socket and opens none
- **Given** an active connection
- **When** `dispose()` (unmount) is called
- **Then** the fake transport records a `close` call, and no further construction occurs afterward

### 17.4 — a superseded socket's late callbacks cannot mutate state
- **Given** connection `A` has been superseded by connection `B` (per 17.2)
- **When** `A`'s fake transport fires a late `message` or `error` callback
- **Then** the connection snapshot is unaffected — no event added, no state transition, no missed-count change — asserted against the transport's own close record rather than against "the run still exists"

### 17.5 — repeated cleanup is safe
- **Given** an active connection
- **When** `dispose()` is called twice in succession
- **Then** neither call throws, and the transport records exactly one `close`

### 17.6 — a parse failure inside an active connection reaches `protocol-error` end to end
- **Given** an active connection wired through the real parser and reducer (not stubbed)
- **When** the fake transport delivers a message that fails `parseFrame` (e.g. non-JSON text)
- **Then** the connection snapshot's state becomes `protocol-error`, proving the parser → reducer wiring inside `run-connection.ts`

---

## AC-18 — retry is explicit, and retrying preserves what arrived

**Tasks:** frontend-run-connection
**Test file:** `apps/web/src/run-connection.test.ts`

### 18.1 — no automatic reconnection after failure
- **Given** an active connection reaches `interrupted`, `no-daemon`, `no-such-run`, `dropped` or `protocol-error`
- **When** time passes with no explicit `retry()` call
- **Then** the fake `SocketFactory` records no further construction

### 18.2 — retry closes the previous socket and constructs exactly one replacement
- **Given** a connection in `interrupted`
- **When** `retry()` is called
- **Then** the prior transport (if not already closed) is closed, the factory records exactly one new construction, and the state moves to `connecting`

### 18.3 — repeated retry activation cannot leave concurrent sockets
- **Given** a connection in `interrupted`
- **When** `retry()` is called twice in rapid succession
- **Then** the factory's construction count still reflects exactly one *current* socket — the first retry's socket, if superseded by the second, is closed and its callbacks invalidated (per 17.4)

### 18.4 — prior events and the missed notice survive a retry
- **Given** two events accepted and `missedCount === 7` before the connection dropped
- **When** `retry()` is called and the new socket opens
- **Then** the snapshot's `events` array still contains the two prior events and `missedCount` is still `7` until superseded

---

## AC-19 — nothing is persisted in the browser

**Tasks:** cross-cutting — frontend-daemon-endpoints, frontend-connection-state, frontend-run-connection, frontend-react-connection, frontend-dev-proxy (no single owner; see Findings)
**Test file:** `apps/web/test/persistence.test.ts` (proposed)

### 19.1 — no storage API literal appears in `apps/web/src`
- **Given** a recursive scan over every file under `apps/web/src`
- **When** it searches for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` and `caches`
- **Then** it finds none

### 19.2 — the scan has a subject (positive control)
- **Given** a fixture file using `localStorage.setItem('run', handle)`
- **When** the scan runs over the fixture
- **Then** it reports a violation, proving the walk actually finds source

### 19.3 — `history.pushState` is explicitly not flagged
- **Given** the shell's existing use of `history.pushState` for route navigation
- **When** the scan runs over the real source
- **Then** `pushState` usage is not reported — it is client-side routing, not persistence, and the scan's exclusion of it is itself asserted (not merely a byproduct of the search list)

---

## AC-20 — the connection region says what is true of its route, and fabricates nothing

**Tasks:** frontend-react-connection
**Test files:** `apps/web/src/shell.test.ts` (extended), `apps/web/src/app.test.ts` (proposed)

### 20.1 — no socket is opened on a non-run route
- **Given** Q-0014's throwing `WebSocket` and `fetch` globals installed, and every route except the run route mounted in turn
- **When** the shell renders
- **Then** `reached === []` for each — re-running Q-0014's existing guard over the enlarged app

### 20.2 — the run route's placeholder is unchanged
- **Given** `/runs/:handle` renders
- **When** `SCREEN_ROUTES`'s per-route placeholder assertion re-runs
- **Then** `screenExists: false` still holds for this route, and its `waitingFor` text still names mission control (Q-0015) — the connection panel is additive

### 20.3 — mounting the run route constructs exactly one socket via the injected transport
- **Given** a fake `SocketFactory` injected into `App`/`Shell`
- **When** `/runs/<handle>` mounts
- **Then** exactly one socket is constructed for that handle

### 20.4 — the retired sentence is gone, not merely joined
- **Given** the full `apps/web/src` corpus
- **When** searched for the literal string `no live connection yet — Q-0120 opens one`
- **Then** it is present in zero files

### 20.5 — the panel renders only the contracted fields
- **Given** an active connection with 3 accepted events, `missedCount === 2`, and the latest event `{ type: 'step', stepId: 'implement' }`
- **When** the connection panel renders
- **Then** it shows the connection state, the incomplete-replay (missed) notice, the count `3`, and the latest event's `type` (`step`) and `stepId` (`implement`) — and nothing else (no cost, no trace columns, no diff — those are Q-0015's)

---

## AC-21 — the manifest and lockfile move together; the store does not grow

**Tasks:** frontend-dev-proxy (manifest), backend-wire-schema (wire.test.ts location per E-2), backend-lockfile-test-input (cache correctness)
**Test files:** `apps/web/test/package.test.ts`, `packages/shared/src/wire.test.ts`, `packages/core/src/turbo-inputs.test.ts`

### 21.1 — the dependency register is the new exact set
- **Given** `apps/web/package.json`
- **When** `Object.keys(own.dependencies).sort()` is read
- **Then** it equals `['@quorum/shared', 'react', 'react-dom']`

### 21.2 — the justification register still matches the manifest in both directions
- **Given** `apps/web/test/package.test.ts`'s `JUSTIFICATIONS` map
- **When** compared against the declared dependency set
- **Then** every declared dependency has a justification entry, and every justification entry names a declared dependency — `@quorum/shared`'s entry states it is on the bundle side because AC-14 executes its schema in the browser

### 21.3 — the lockfile carries the new importer entry
- **Given** `pnpm-lock.yaml`
- **When** its `apps/web:` importer section is read
- **Then** it lists `@quorum/shared` as a `workspace:*` dependency, in the same shape `packages/server/src/package.test.ts:129–136` already asserts for its own package — this test lives in `packages/shared/src/wire.test.ts` and does not read server source (per errata E-2)

### 21.4 — a value from the new dependency resolves under the workspace source condition
- **Given** the test environment's `quorum-source` resolution condition
- **When** a symbol is imported from `@quorum/shared` inside an `apps/web` test
- **Then** it resolves to `packages/shared/src/index.ts`, not a `dist/` build artifact

### 21.5 — the shared test task declares the lockfile as an input
- **Given** `packages/shared/turbo.json` now reads `../../pnpm-lock.yaml` under the test task's `inputs`
- **When** `packages/core/src/turbo-inputs.test.ts`'s hand-audited `MANIFEST['@quorum/shared#test']` register is read
- **Then** it lists the lockfile path, so the cache hash moves when the lockfile changes — closing the gap errata E-2 identified in the original (unassigned) placement

**Note:** the "no new package enters the store" claim (zero packages, zero bytes delta) is **not** encoded as a scenario — it is GO-5, measured by installing manifests-only copies of both commits into empty stores at the delivery gate, not something a Vitest assertion can establish.

---

## AC-22 — the browser build resolves shared from source regardless of build state

**Tasks:** frontend-dev-proxy
**Test file:** `apps/web/test/vite-config.test.ts` (proposed)

### 22.1 — the client resolution condition is present and additive
- **Given** `apps/web/vite.config.ts`'s `resolve.conditions`
- **When** its contents are inspected structurally (not by attempting an actual resolution)
- **Then** it includes `quorum-source`, spread over Vite's own client defaults rather than replacing them

### 22.2 — the fact this compensates for still holds
- **Given** `packages/shared/package.json`'s `exports` map
- **When** inspected
- **Then** it still resolves `quorum-source` to `./src/index.ts` and every other condition to `./dist/index.js` — so this criterion goes red if that mapping ever changes, rather than silently stopping compensating for it

### 22.3 — no build script is added
- **Given** `apps/web/package.json`
- **When** its `scripts` are read
- **Then** there is no `build` entry, and the emitting-package register (`test-discovery.test.ts` / `package.test.ts`'s three-package assertion) is unchanged

---

## AC-23 — the documents describe what shipped, and the vocabulary gains its term

**Tasks:** backend-connection-docs
**Test files:** `packages/shared/src/docs.test.ts`, `packages/shared/src/role.test.ts` (conditional)

### 23.1 — the obsolete "no connection" sentence is gone
- **Given** `docs/04-architecture.md`
- **When** searched for the sentence *"There is no connection to the daemon — the frame parser, the connection states and the socket lifecycle are Q-0120's..."*
- **Then** it is present in zero files (gone, not joined by a correction beside it)

### 23.2 — the architecture doc states where the frame union lives
- **Given** the same file's `packages/server` section
- **When** read
- **Then** it states that the frame union is declared in `@quorum/shared` and re-exported by `packages/server`, and why

### 23.3 — `harness/architecture.md`'s stale "frontend and data remain inert" is corrected
- **Given** `harness/architecture.md:46–49`
- **When** read
- **Then** it no longer states that `frontend` is inert, without altering the role-table grants themselves

### 23.4 — the glossary gains **Connection state** with its full shape
- **Given** `docs/GLOSSARY.md`
- **When** searched for a **Connection state** entry
- **Then** it exists, states the closed set from AC-15, that it is derived per moment and never stored, that no member is silence, and that it is distinct from `packages/server`'s `refused | running | ended` **run state** — using the same shape `docs.test.ts` already checks for **Verified version** and **Push lag**

### 23.5 — the two 22-term "use exactly these terms" lists are untouched
- **Given** `CLAUDE.md` and `docs/README.md`
- **When** their term lists are compared against their pre-ticket baseline
- **Then** they are byte-identical — this change must not add **Connection state** to either list

### 23.6 — if the role table moved, it still holds against role frontmatter
- **Given** `harness/architecture.md`'s role table (unchanged by this ticket except for the inert-frontend correction)
- **When** `packages/shared/src/role.test.ts` re-runs
- **Then** every role's third-column grant still matches its `paths:` frontmatter, and every role's prose still names each directory it is granted

---

## Findings — not encoded as scenarios

1. **AC-12(b) (the compiler owns literals) is a typecheck concern, not a Vitest scenario.** The requirement itself says a value constructed in `apps/web` is checked against the imported type "by `tsc --noEmit`, which is stronger than a regex." This is enforced by the existing `pnpm typecheck` gate, not by a scenario in this document — writing a Vitest assertion for it would either duplicate the compiler or be weaker than it.

2. **AC-13(c)'s port default is deliberately under-tested.** The criterion states "no test reads the variable" that configures the proxy port. Scenario 13.7 covers only the documented default literal and its adjacent comment; no scenario exercises setting the environment variable and observing the proxy target change, per the criterion's own instruction.

3. **Four gate obligations (GO-4 to GO-7) are not qa-red scenarios.** GO-4 (measuring the real dev-server's behaviour with the daemon down, to confirm the `no-daemon` discriminator assumption in R-3), GO-5 (the empty-store install delta for AC-21), GO-6 (a `vite build` with `packages/shared/dist` physically absent, for AC-22), and GO-7 (both-environment-row forced verification) are all measurements performed by hand at the delivery gate against a running system or a real install, not assertions a red-phase suite can make. Scenario 22.1–22.2 cover AC-22's *structural* half only; the empty-`dist` measurement in GO-6 is the complementary proof that the structure is the right one.

4. **AC-19 has no single task owner.** It is a scan over the whole `apps/web/src` corpus, and every frontend task (`frontend-daemon-endpoints`, `frontend-connection-state`, `frontend-run-connection`, `frontend-react-connection`, `frontend-dev-proxy`) contributes files to that corpus. This is satisfiable — the scenario doesn't require any one task to write anything, only that none of them introduces a forbidden call — but it is worth flagging that a `revise` finding against AC-19 could implicate any frontend task and the loop should not assume a single culprit.

5. **`pnpm-lock.yaml` is gate-owned, not task-owned, and scenario 21.3 depends on it already being correct before `qa-red` starts.** Per the requirements gate's GO-1 disposition, the lockfile is generated and committed by a human once the manifest line exists, at the solutioning gate. Scenario 21.3 is written as a read-only assertion against a file that should already be correct on entry to this stage; it is not asking any development task to write the lockfile.
