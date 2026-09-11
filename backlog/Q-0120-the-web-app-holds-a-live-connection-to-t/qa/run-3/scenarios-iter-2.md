# Q-0120 — Scenario document (qa-red, run 3, iteration 2)

*Supersedes `qa/run-3/scenarios-iter-1.md`. Written directly against
`scenario-review-iter-1.md`'s verdict (`revise`) and against `solution/errata.md`'s E-1 and E-2,
which already reshaped AC-12 and AC-13(e)/AC-12(ii) before this document was drafted. Coverage,
stub strategy and 9 of 12 criteria are unchanged from iteration 1 per the review's own §6 ("do not
re-litigate"); this document restates them so the file is self-contained rather than a diff. Every
type and function name below is verified against the actual stub content on
`harness/Q-0120/tests` (identical to `harness/Q-0120/integration`), not assumed from the
requirement's prose.*

## 0. What changed since iteration 1

Three edits, each inside a file this step owns (`*.test.ts`), none inside any development task's
surface — the review's §8 "what this iteration owes". Verified directly against the current
branch content of each file:

1. **`packages/shared/src/wire.test.ts`** (26 lines total). Its second test, "the web importer
   declares shared in the lockfile" (lines 19–25), builds the needle
   `` `${scope}:` `` where `scope = '@quorum/shared'` — i.e. the unquoted, colon-terminated form
   `@quorum/shared:`. `pnpm-lock.yaml`'s `apps/web:` importer always writes the dependency key
   **quoted**: `'@quorum/shared':`. The character immediately after `shared` is `'`, never `:`, so
   the needle can never match. Corrected to the precedent scenario 21.3 already named —
   `packages/server/src/package.test.ts:129–136`'s shape: match the quoted key (or drop the
   needle's trailing colon and match the unquoted substring), then assert on the sliced remainder.
2. **`packages/core/src/turbo-inputs.test.ts`**. `ROOT_DERIVATIONS` (lines 1103–1128) and
   `ESCAPING_LITERALS` (lines 1159–1214) are hand-audited registers, not turbo-input readers, and
   neither has an entry for `packages/shared/src/wire.test.ts`; declaring
   `../../pnpm-lock.yaml` in `packages/shared/turbo.json` cannot satisfy clauses C2 (line
   2293–2299) or C3 (line 2332–2338), which compare the scanned corpus against these two maps
   directly and nothing else. `wire.test.ts:9`'s
   `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')` supplies exactly the
   tokens the review named: `fileURLToPath` and `import.meta` as unregistered derivation sites
   (C2), and one unregistered escaping literal (C3) — normalised, per the file's existing
   convention (e.g. `git.ts`'s `'..'` rows), to the key `'..'` rather than the raw substring
   `'../../..'`. Both maps gain the entry with its reason (see AC-21.5).
3. **`apps/web/test/routes.test.ts`** (202 lines total). `EXCEPTIONS` (lines 59–66) has no entry
   for `run-connection.test.ts:/B/events`. The recursive corpus walk (`componentFiles()`, lines
   26–33) reaches every file under `apps/web/src` including test files, per R-7 and
   `test/package.test.ts:143`'s "test files live in `src/` by identity" rule, so
   `apps/web/src/run-connection.test.ts`'s fixture URL for handle `B` produces the literal
   `/B/events`, which is neither in the endpoint register nor in `EXCEPTIONS` — failing the
   assertion at line 188. Registered in `EXCEPTIONS` with its reason. Line 189's companion
   assertion requires every `EXCEPTIONS` entry to have a live subject, so the new row must
   correspond to a literal `componentFiles()` actually finds — which this one does.

All three are satisfiable by this step alone: each fix is a one- or two-line edit inside a
`*.test.ts` file already in `write-tests`' ownership, and none requires a development task to touch
a test (which every `tasks.yaml` entry forbids).

## 1. Scope note: what is unchanged from iteration 1, and what the stubs actually are

Per the review's §6, the following hold and are not re-litigated: coverage is 12/12 acceptance
criteria; the stub strategy makes the red phase fail on assertions, not on missing symbols, in all
three touched packages; `pnpm install --frozen-lockfile` passes; `wire.test.ts` importing `node:fs`
does not violate the browser-safety guard (it scans `sharedSourceFiles()`, not every file);
`test/package.test.ts:130` and `shell.test.ts:248/:264` are correct red, owned by
`frontend-dev-proxy` and `frontend-react-connection` respectively; the two `docs.test.ts` failures
are owned by `backend-connection-docs`. Confirmed directly this iteration against the real stub
files: `wire.test.ts`'s first test already exercises AC-14's invalid-count table (`'7'`, `-1`,
`1.5`, `Infinity`) and the unknown-type refusal (`'heartbeat'`) against `wireMessageSchema` — the
schema layer beneath the browser parser's own staged refusals. `vite.config.ts` currently has two
plugins and **no `server.proxy` block at all** — confirming AC-13's proxy scenarios (13.6–13.8)
describe not-yet-built behavior, exactly what a red phase should do. `FrameRefusal.kind` is
declared as the closed set `non-text-message | invalid-json | non-object | unknown-type |
invalid-event | invalid-count`; `ConnectionState.kind` is declared as `idle | connecting | live |
no-daemon | no-such-run | ended | interrupted | dropped | protocol-error`, with `connecting`,
`live` and `no-daemon` each carrying a `requestedUrl: string` field and `interrupted` carrying
`code`/`reason`. Scenarios below use these exact identifiers.

---

## 2. Scenarios by acceptance criterion

### AC-12 — one frame-union definition, browser-reachable, house rules hold

**12.1 — Declaration scan: legitimate declarations are not flagged**
*Given* `apps/web/src/frame-parser.ts` declares `FrameRefusal`, `ParsedFrame` and
`FrameParseResult`, referencing the missed branch via `Extract<WireMessage, { type: 'missed' }>`,
and `apps/web/src/connection-state.ts` declares `ConnectionAction` variants each carrying a `type`
field
*When* `apps/web/test/source.test.ts`'s declaration-restatement scan (per erratum E-1: no
declaration may pair `type: 'missed'` with `count`) walks every file under `apps/web/src`
*Then* it reports zero violations, because a `type` field or an `Extract` reference is not a
restatement of the union's pairing.
Tags: `frontend-frame-parser`, `frontend-connection-state`

**12.2 — Declaration scan: has a subject**
*Given* a fixture module re-declaring `WireMessage`'s full union locally
(`{ type: 'missed'; count: number } | { type: 'event'; event: unknown }`)
*When* the same scan runs over a corpus that includes the fixture
*Then* it reports exactly one violation naming the fixture file — proof the guard is not vacuous
("a check that skips its subject must not report success", 2026-08-25).
Tags: qa-red fixture (scans the output of `frontend-frame-parser` and `frontend-connection-state`)

**12.3 — Literals are the compiler's job, not the scan's**
*Given* a test constructs a literal `{ type: 'missed', count: 7 }` typed as `WireMessage`
*When* `tsc --noEmit` runs over `apps/web`
*Then* it typechecks without error — proving frame literals are validated structurally by the
compiler rather than refused by the declaration scan (AC-12(b)).
Tags: `frontend-run-connection`

**12.4 — Shared barrel exposes the wire module**
*Given* `packages/shared/src/index.ts` after `backend-wire-schema` lands
*When* `packages/shared/src/index.test.ts`'s barrel-completeness assertion runs
*Then* it finds `export * from './wire.js';` matching the required pattern, and the module appears
in the enumerated barrel surface.
Tags: `backend-wire-schema`

**12.5 — No `@quorum/` literal anywhere under `packages/shared/src`**
*Given* `packages/shared/src/wire.ts` and `packages/shared/src/wire.test.ts`
*When* `index.test.ts`'s literal scan runs (needle assembled at runtime, not written as a literal
in the guard itself)
*Then* neither file contains the string `@quorum/`.
Tags: `backend-wire-schema`

**12.6 — Server re-export assertion (relocated per erratum E-2)**
*Given* `packages/server/src/wire.ts` imports and re-exports `WireMessage` from `@quorum/shared`
via `export type { WireMessage } from '@quorum/shared';`, with its orphaned JSDoc repaired rather
than left dangling
*When* `packages/server/src/index.test.ts` asserts the type re-export and re-reads the existing
`SURFACE` runtime register
*Then* `WireMessage` is confirmed re-exported, and `SURFACE` is byte-identical to its value before
this ticket (`WireRefusal`, `badRequest`, `wireRefusalOf`, `WireRun`, `wireRunOf`, and the three
status tables are untouched).
Tags: `backend-wire-schema`

**12.7 — No export surface added to `packages/server`**
*Given* `packages/server/package.json` is untouched by this ticket
*When* `packages/server/src/package.test.ts`'s six no-export-surface assertions run (`exports`,
`main`, `types`, `files`, `bin`, `build` all `undefined`)
*Then* all six pass.
Tags: `backend-wire-schema` (negative verification — no task adds any of these)

### AC-13 — same-origin, one endpoint register, dev-server bridges it

**13.1 — HTTP page yields a `ws:` URL**
*Given* `page = new URL('http://localhost:5173/runs/X')`
*When* `runEventsUrl(page, handle)` is called
*Then* it returns a same-origin URL with scheme `ws:` and path `/runs/<handle>/events`.
Tags: `frontend-daemon-endpoints`

**13.2 — HTTPS page yields a `wss:` URL**
*Given* `page = new URL('https://example.internal/runs/X')`
*When* `runEventsUrl(page, handle)` is called
*Then* the returned scheme is `wss:`.
Tags: `frontend-daemon-endpoints`

**13.3 — A `/`-bearing handle stays one path segment**
*Given* handle `"a/b"`
*When* `runEventsPath(handle)` is called
*Then* the result is `/runs/a%2Fb/events` — one segment, not two.
Tags: `frontend-daemon-endpoints`

**13.4 — `?`, `#` and space in a handle cannot create a query, fragment or bare space**
*Given* handles `"a?b"`, `"a#b"`, `"a b"`
*When* `runEventsPath` is called for each
*Then* none of the resulting paths gains a query string, a fragment, or an unencoded space.
Tags: `frontend-daemon-endpoints`

**13.5 — No absolute URL/hostname/port literal anywhere in `apps/web/src`**
*Given* the full corpus under `apps/web/src`
*When* `source.test.ts`'s network-literal scan runs (needles for `http:`+`//`, `https:`+`//`,
`//fonts.` assembled at runtime)
*Then* zero matches, with `vite.config.ts` the sole named exemption and no new exemption granted.
Tags: `frontend-daemon-endpoints`, `frontend-dev-proxy`, `frontend-frame-parser`,
`frontend-connection-state`, `frontend-run-connection`, `frontend-react-connection`

**13.6 — Proxy target is an object, never a URL string**
*Given* `apps/web/vite.config.ts`, which currently declares no `server.proxy` block at all
*When* `frontend-dev-proxy` adds one and the proxy configuration for each of the five prefixes is
read
*Then* every target is an object literal (`{ host, port, ws: true }` shape), never a string.
Tags: `frontend-dev-proxy`

**13.7 — Port is configuration with a stated default, unread by any test**
*Given* no environment variable overriding the proxy port is set
*When* `vite.config.ts` resolves its target port
*Then* it defaults to `7717`, with a comment recording this as a dev-server convention (the daemon
has no default port), and `turbo.json`'s `test` task `env` list stays `["QUORUM_REAL_CLI"]` only.
Tags: `frontend-dev-proxy`

**13.8 — One register drives both the proxy and the client**
*Given* `DAEMON_ENDPOINTS` (currently `{ runs: '/runs', project: '/project', tickets: '/tickets',
flows: '/flows', history: '/history' }`)
*When* `vite.config.ts` builds proxy rules from it and the client builds its request path from the
same table
*Then* both sides read the one exported constant; neither hardcodes the prefix list a second time.
Tags: `frontend-daemon-endpoints`, `frontend-dev-proxy`

**13.9 — Recursive route-literal scan reaches every file, register absorbs the new fixture
(corrected this iteration)**
*Given* `routes.test.ts`'s corpus walk (`componentFiles()`, lines 26–33) recurses over every file
under `apps/web/src`, including test files (R-7's design), and
`apps/web/src/run-connection.test.ts` asserts an expected URL for fixture handle `B`
*When* the walk collects the literal `/B/events` from that fixture
*Then* the assertion at line 188 passes because `EXCEPTIONS` now carries
`'run-connection.test.ts:/B/events'` with a stated reason, and line 189's companion assertion
confirms the entry has a live subject rather than sitting unused.
Tags: `frontend-run-connection` (fixture scanned), qa-red (register entry)

**13.10 — No CORS added to the daemon (relocated per erratum E-2)**
*Given* `packages/server/src/*.ts` and its manifest after this ticket
*When* `packages/server/src/package.test.ts`'s guard scans both for the string `cors`
*Then* neither contains it, and `BIND_HOSTNAME` is unchanged.
Tags: `backend-wire-schema` (negative verification — no task adds CORS)

### AC-14 — staged, non-throwing frame parsing with distinguishable refusals

**14.1 — Valid event frame parses**
*Given* text `'{"type":"event","event":<valid Event>}'`
*When* `parseFrame` is called
*Then* it returns `{ ok: true, frame: { type: 'event', event } }` whose payload passed
`eventSchema`.
Tags: `frontend-frame-parser`

**14.2 — Valid missed frame (count > 0) parses**
*Given* text `'{"type":"missed","count":7}'`
*When* `parseFrame` is called
*Then* it returns `{ ok: true, frame: { type: 'missed', count: 7 } }`.
Tags: `frontend-frame-parser`

**14.3 — Valid missed frame with count 0 parses**
*Given* text `'{"type":"missed","count":0}'`
*When* `parseFrame` is called
*Then* it returns a parsed `missed` frame with `count: 0`, not refused and not coerced to `null` —
already proven satisfiable at the schema layer by `wire.test.ts:14`.
Tags: `frontend-frame-parser`

**14.4 — Unknown `type` refused as `unknown-type`**
*Given* text `'{"type":"bogus"}'`
*When* `parseFrame` is called
*Then* it returns `{ ok: false, refusal: { kind: 'unknown-type', type: 'bogus' } }` — the schema
layer already refuses `{ type: 'heartbeat' }` at `wire.test.ts:16`; the parser surfaces that as
this named refusal rather than a generic failure.
Tags: `frontend-frame-parser`

**14.5 — Event payload failing `eventSchema` refused as `invalid-event`**
*Given* text `'{"type":"event","event":{"garbage":true}}'`
*When* `parseFrame` is called
*Then* it returns `{ ok: false, refusal: { kind: 'invalid-event' } }`, distinct from
`invalid-count` and `unknown-type`.
Tags: `frontend-frame-parser`

**14.6 — Non-object JSON value refused as `non-object`**
*Given* text `'42'`, `'"a string"'`, and `'null'`
*When* `parseFrame` is called for each
*Then* each returns `{ ok: false, refusal: { kind: 'non-object' } }`.
Tags: `frontend-frame-parser`

**14.7 — Non-text message refused as `non-text-message`, without throwing**
*Given* a binary (`ArrayBuffer`) message
*When* `parseFrame` is called
*Then* it returns `{ ok: false, refusal: { kind: 'non-text-message' } }` and does not throw.
Tags: `frontend-frame-parser`

**14.8 — Unparsable text refused as `invalid-json`, without throwing**
*Given* text `'not json {{{'`
*When* `parseFrame` is called
*Then* it returns `{ ok: false, refusal: { kind: 'invalid-json' } }` and does not propagate an
exception.
Tags: `frontend-frame-parser`

**14.9 — Every invalid `count` shape refused as `invalid-count`, per the hardened table**
*Given* missed frames with `count` values `"7"` (string), `-1` (negative), `1.5` (fractional), and
a non-finite value (constructed directly, since JSON has no `Infinity` literal) — the same four
values `wire.test.ts:15` already proves the schema rejects
*When* `parseFrame` is called for each
*Then* each returns `{ ok: false, refusal: { kind: 'invalid-count', count } }`, and none is
silently coerced to a valid integer.
Tags: `frontend-frame-parser`

### AC-15 — a named connection state for every case, none of them silence

**15.1 — Non-run routes are `{ kind: 'idle' }`**
*Given* the app is on any route other than `/runs/:handle`
*When* the connection reducer's state is queried
*Then* it is `{ kind: 'idle' }`, and no socket construction is requested.
Tags: `frontend-connection-state`, `frontend-react-connection`

**15.2 — `connecting` → `live` on open plus first accepted event**
*Given* state `{ kind: 'connecting', requestedUrl }`
*When* the socket opens and a valid event frame is accepted
*Then* state becomes `{ kind: 'live', requestedUrl }`.
Tags: `frontend-connection-state`

**15.3 — Close 1008 → `no-such-run` (precedence 1, overrides everything)**
*Given* state `connecting` or `live`, with or without a prior terminal event
*When* the socket closes with code 1008
*Then* state becomes `{ kind: 'no-such-run' }`.
Tags: `frontend-connection-state`

**15.4 — Close 1013 → `dropped` (precedence 2)**
*Given* state `live`
*When* the socket closes with code 1013
*Then* state becomes `{ kind: 'dropped' }`.
Tags: `frontend-connection-state`

**15.5 — Normal close after an accepted terminal event → `ended` (precedence 3)**
*Given* a `terminal` event has been accepted (`terminalSeen: true`)
*When* the socket then closes normally (code 1000)
*Then* state becomes `{ kind: 'ended' }`.
Tags: `frontend-connection-state`

**15.6 — Any other close before a terminal event → `interrupted` (precedence 4)**
*Given* `terminalSeen: false`
*When* the socket closes with a non-1008/1013 code (e.g. 1006) after having opened
*Then* state becomes `{ kind: 'interrupted', code: 1006, reason }`.
Tags: `frontend-connection-state`

**15.7 — Failure before `open` → `no-daemon` (precedence 5), never `interrupted`**
*Given* state `{ kind: 'connecting', requestedUrl }`, `opened: false`
*When* the socket errors or closes before opening
*Then* state becomes `{ kind: 'no-daemon', requestedUrl }` — not `interrupted` — naming the
same-origin URL the client actually requested.
Tags: `frontend-connection-state`, `frontend-run-connection`

**15.8 — `no-daemon` and `no-such-run` are distinct states with distinct rendered strings**
*Given* one connection failing before `open` (→ `no-daemon`), and a separate one closing with 1008
(→ `no-such-run`)
*When* `connectionStateText` renders each
*Then* they produce different `ConnectionState.kind` values **and** different strings — "could not
reach the daemon at `<requestedUrl>`" versus "no run named that handle".
Tags: `frontend-connection-state`

**15.9 — A bare normal close with no terminal event is `interrupted`, not `ended`**
*Given* `terminalSeen: false`
*When* the socket closes normally (code 1000)
*Then* state becomes `{ kind: 'interrupted', code: 1000, reason }`, because a normal close code
alone is not evidence of completion.
Tags: `frontend-connection-state`

**15.10 — `protocol-error` state from an AC-14 refusal**
*Given* a `parseFrame` refusal occurs while connected
*When* the reducer processes a `{ type: 'protocol-error', refusal }` action
*Then* state becomes `{ kind: 'protocol-error', refusal }`.
Tags: `frontend-connection-state`, `frontend-run-connection`

### AC-16 — a `missed` count is reported, and it is not an event

**16.1 — Count > 0 surfaced, never added to accepted events**
*Given* a live connection with 3 accepted events
*When* `{type:'missed', count:7}` arrives
*Then* `snapshot.missedCount === 7` and `snapshot.events.length === 3` (unchanged).
Tags: `frontend-run-connection`

**16.2 — Count 0 recorded distinctly from `null`, no notice rendered**
*Given* `missedCount` is `null` (no prior missed frame)
*When* `{type:'missed', count:0}` arrives
*Then* `snapshot.missedCount === 0` (not `null`), and the renderer shows no missed-count notice for
this snapshot — recorded with the reason that the daemon never sends a zero
(`http.ts:109–111`), so this is the parser's defence rather than evidence about the wire.
Tags: `frontend-run-connection`, `frontend-react-connection`

**16.3 — A later missed frame replaces rather than accumulates**
*Given* `missedCount` is currently 7
*When* `{type:'missed', count:2}` arrives
*Then* `missedCount` becomes 2, not 9.
Tags: `frontend-run-connection`

**16.4 — No ANSI/colour/vendor branching crosses the wire**
*Given* the parsing and state-derivation source
*When* `frame-parser.ts` and `connection-state.ts` are inspected
*Then* neither introduces an ANSI escape, a colour code, or vendor-conditional branching.
Tags: `frontend-frame-parser`, `frontend-connection-state`

### AC-17 — one socket at a time, leaving closes it

**17.1 — Mounting the run route opens exactly one socket**
*Given* the run route mounts for handle `X`
*When* `RunConnection.connect(handle, page)` is invoked through the injected `SocketFactory`
*Then* the fake transport records exactly one construction.
Tags: `frontend-run-connection`, `frontend-react-connection`

**17.2 — Handle change closes the first, opens exactly one replacement**
*Given* an active connection for handle `X`
*When* `connect('Y', page)` is called on the same `RunConnection`
*Then* the fake transport records exactly one `close()` for `X`'s socket and exactly one
construction for `Y`.
Tags: `frontend-run-connection`, `frontend-react-connection`

**17.3 — A late callback from a superseded socket changes nothing**
*Given* socket A has been superseded by socket B
*When* A's `onmessage` or `onclose` fires afterward
*Then* `snapshot.state`, `snapshot.events` and `snapshot.missedCount` are all unchanged.
Tags: `frontend-run-connection`

**17.4 — Unmounting or leaving the route closes the active socket**
*Given* an active connection on the run route
*When* `RunConnection.dispose()` is called (component unmount / route leave)
*Then* the fake transport records exactly one `close()` and no further construction.
Tags: `frontend-run-connection`, `frontend-react-connection`

**17.5 — Repeated cleanup is safe**
*Given* `dispose()` has already been called
*When* `dispose()` is invoked a second time
*Then* nothing throws and no additional `close()` is recorded.
Tags: `frontend-run-connection`

**17.6 — The shell opens no socket outside the run route**
*Given* any non-run route, with a throwing global `WebSocket`
*When* the app mounts and navigates among non-run routes
*Then* the throwing constructor is never invoked.
Tags: `frontend-react-connection`

### AC-18 — explicit retry, preserving what arrived

**18.1 — No automatic reconnection**
*Given* a failed connection (`no-daemon`, `interrupted`, `dropped`, `no-such-run`, or
`protocol-error`)
*When* time passes with no call to `retry()`
*Then* the fake transport records no new socket construction.
Tags: `frontend-run-connection`

**18.2 — Retry closes the previous socket and opens exactly one replacement**
*Given* a failed connection with a stale socket reference
*When* `RunConnection.retry()` is called
*Then* the fake transport shows the previous socket closed (if not already) and exactly one new
construction, with state moving to `connecting`.
Tags: `frontend-run-connection`, `frontend-react-connection`

**18.3 — Retry preserves accepted events and the missed notice**
*Given* 5 accepted events and `missedCount: 3` before failure
*When* `retry()` begins a new connection
*Then* `snapshot.events.length === 5` and `snapshot.missedCount === 3` until new frames arrive.
Tags: `frontend-run-connection`

**18.4 — Repeated Retry cannot leave concurrent sockets**
*Given* `retry()` is called twice in quick succession
*When* both calls are processed
*Then* exactly one current socket exists afterward.
Tags: `frontend-run-connection`

### AC-19 — nothing is persisted in the browser

**19.1 — No storage API referenced anywhere in `apps/web/src`**
*Given* the full corpus under `apps/web/src`
*When* `source.test.ts` scans for `localStorage`, `sessionStorage`, `indexedDB`,
`document.cookie`, `caches`
*Then* zero matches, with a positive-control fixture proving the scan has a subject.
Tags: `frontend-run-connection`, `frontend-react-connection`, `frontend-daemon-endpoints`,
`frontend-connection-state`, `frontend-frame-parser`

**19.2 — `history.pushState` is not flagged**
*Given* `app.tsx`'s existing routing code, which calls `window.history.pushState`/`replaceState`
*When* the same scan runs
*Then* it is not reported — explicitly excluded from the forbidden-API list.
Tags: qa-red (scan-scope only; no task changes routing)

**19.3 — A fresh mount for the same handle starts from an empty snapshot**
*Given* a prior `RunConnection` accepted events and was then disposed (navigation away, not a
persistence mechanism)
*When* `createRunConnection` is called again and `connect(handle, page)` for the same handle
*Then* no prior events, missed count, or handle are recovered from storage — the snapshot starts
empty (`events: [], missedCount: null`).
Tags: `frontend-run-connection`

### AC-20 — the connection region says what is true, fabricates nothing

**20.1 — Non-run routes show `idle`, not the retired placeholder**
*Given* the shell renders a non-run route (no `connection` prop passed to `Shell`)
*When* the top-bar connection region is inspected
*Then* it shows the `idle` state text, never the retired `CONNECTION_PENDING` sentence
(`'no live connection yet — Q-0120 opens one'`).
Tags: `frontend-react-connection`

**20.2 — The retired sentence and symbol are gone, not merely joined**
*Given* the full `apps/web/src` corpus after this ticket
*When* `source.test.ts` searches for the retired sentence and `shell.test.ts`'s import list is
inspected
*Then* zero occurrences remain, and `CONNECTION_PENDING` is no longer exported from `shell.tsx`.
Tags: `frontend-react-connection`

**20.3 — Run route renders the panel beside the unchanged placeholder**
*Given* the run route mounts with mission control's `screenExists: false` still in place, and a
`ShellConnectionProps` (`snapshot`, `text`, `retryable`, `onRetry`) supplied to `Shell`
*When* the panel and placeholder are inspected
*Then* both render — the placeholder's `waitingFor` text is unchanged, and the panel shows
`text`, retry availability, `snapshot.events.length`, `snapshot.missedCount`, and the latest
event's `type`/`stepId`, and nothing more.
Tags: `frontend-react-connection`

**20.4 — The shell never opens a socket for its own concerns (Q-0014's guard, re-run)**
*Given* `RAIL[0].path` with throwing `WebSocket` and `fetch` globals
*When* the shell mounts
*Then* `reached === []`.
Tags: `frontend-react-connection`

**20.5 — Per-route placeholder assertion still holds for `SCREEN_ROUTES`**
*Given* `SCREEN_ROUTES` (routes with no live screen yet)
*When* Q-0014's placeholder test runs unchanged
*Then* it still passes — this ticket attached no screen anywhere prematurely.
Tags: `frontend-react-connection`

### AC-21 — manifest and lockfile move together, no cold-clone growth

**21.1 — `@quorum/shared` declared as a dependency**
*Given* `apps/web/package.json` after `frontend-dev-proxy`
*When* `test/package.test.ts`'s dependency-set assertion runs
*Then* `Object.keys(dependencies).sort()` equals `['@quorum/shared', 'react', 'react-dom']`.
Tags: `frontend-dev-proxy`

**21.2 — Justification register matches the manifest in both directions**
*Given* the same manifest
*When* `JUSTIFICATIONS`'s keys are compared against the declared set
*Then* they match exactly both ways.
Tags: `frontend-dev-proxy`

**21.3 — Lockfile importer assertion (corrected this iteration)**
*Given* `pnpm-lock.yaml`'s `apps/web:` importer, which quotes the key as `'@quorum/shared':`, and
`wire.test.ts:22–23`'s current needle `` `${scope}:` `` where `scope = '@quorum/shared'` (unquoted)
never matches it
*When* the needle is corrected to mirror `packages/server/src/package.test.ts:129–136`'s
precedent — matching the quoted key directly, or dropping the trailing colon and asserting on the
sliced remainder — and the lockfile assertion then runs
*Then* it passes.
Tags: `backend-lockfile-test-input` (fix lives in the shared wire test file, corrected this
iteration by `write-tests`, not by any development task)

**21.4 — Shared dependency resolves under the workspace condition**
*Given* `apps/web` after the dependency is declared
*When* `wireMessageSchema` is imported and resolved
*Then* resolution succeeds via the workspace link and no new package enters the pnpm store.
Tags: `frontend-dev-proxy`, `backend-wire-schema`

**21.5 — Shared test task declares the lockfile input, and the two hand-audited registers
recognise `wire.test.ts` (corrected this iteration)**
*Given* `packages/shared/turbo.json` gains `../../pnpm-lock.yaml` under the `test` task's `inputs`,
and `packages/core/src/turbo-inputs.test.ts`'s `ROOT_DERIVATIONS` and `ESCAPING_LITERALS` gain
`packages/shared/src/wire.test.ts`'s entries — `fileURLToPath` and `import.meta` as derivation
tokens (line 9's `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')`), and the
escaping literal normalised to the key `'..'` per the file's existing convention — each with a
stated reason
*When* `turbo-inputs.test.ts` clauses A, B, C2 (line 2293) and C3 (line 2332) all run
*Then* all four pass.
Tags: `backend-lockfile-test-input`, `backend-wire-schema` (subject file), qa-red (register
entries — corrected this iteration)

### AC-22 — browser build resolves shared from source

**22.1 — `quorum-source` condition present, defaults spread not replaced**
*Given* `apps/web/vite.config.ts`
*When* `test/package.test.ts:130`'s structural assertion runs
*Then* `resolve.conditions` includes `quorum-source` and Vite's default client conditions are
spread in, not overwritten.
Tags: `frontend-dev-proxy`

**22.2 — Shared package's own export map still resolves both ways**
*Given* `packages/shared/package.json`
*When* the same test asserts its `exports` map
*Then* `quorum-source` resolves to `./src/index.ts` and the default condition resolves to
`./dist/index.js`.
Tags: qa-red (verification of an existing invariant; no task in this ticket changes it)

**22.3 — Resolution correctness does not depend on `dist` existing in the checkout**
*Given* the assertion is written structurally rather than by attempting a live resolution
*When* it runs regardless of whether `packages/shared/dist` exists
*Then* it passes identically either way — the real-resolution proof is GO-6's manual check, not a
unit test's job.
Tags: `frontend-dev-proxy`

### AC-23 — documents describe what shipped, vocabulary gains its term

**23.1 — `04-architecture.md`'s "no connection" sentence is replaced**
*Given* `docs/04-architecture.md`
*When* `docs.test.ts` checks the relevant passage
*Then* the retired sentence is gone, replaced by one naming the frame union's home in `shared` and
its re-export from `packages/server`.
Tags: `backend-connection-docs`

**23.2 — Status line gains a dated entry**
*Given* the document's status line
*When* `docs.test.ts` checks it
*Then* it carries today's date and names what shipped.
Tags: `backend-connection-docs`

**23.3 — `harness/architecture.md`'s "frontend and data remain inert" correction — already green**
*Given* that sentence was corrected by hand at the requirements gate (discharging GO-2)
*When* the relevant check runs
*Then* it passes — recorded as pre-existing green rather than evidence this ticket implemented it
(requirements §11 observation).
Tags: `backend-connection-docs` (regression check only)

**23.4 — Glossary gains "Connection state"**
*Given* `docs/GLOSSARY.md`
*When* `docs.test.ts` checks for the new entry
*Then* it is present with its closed state set, its never-silence rule, and its "not a run state"
clause, in the shape "Verified version" and "Push lag" already use.
Tags: `backend-connection-docs`

**23.5 — The two 22-term vocabulary lists are untouched**
*Given* `CLAUDE.md` and `docs/README.md`
*When* `docs.test.ts` compares them against their pre-ticket content
*Then* they are byte-identical to what they held before this ticket.
Tags: `backend-connection-docs` (failure mode is an accidental edit — this scenario guards against
adding "Connection state" to either list)

**23.6 — Role table stays internally consistent if touched**
*Given* `harness/architecture.md`'s role table, if `backend-connection-docs` touches it for
AC-23.3's correction
*When* `packages/shared/src/role.test.ts` runs
*Then* the third column still matches each role's `paths` frontmatter and each role's prose still
names every granted directory.
Tags: `backend-connection-docs`

---

## 3. Edge cases from the architecture review and the solution document

- **Rejected: exporting `@quorum/server`.** Covered by AC-12.7's negative assertion — the six
  no-export-surface fields stay `undefined`.
- **Rejected: copying the union into `apps/web`.** Covered by AC-12.1/12.2 — a full local
  re-declaration is the fixture the guard must catch.
- **Rejected: one undifferentiated catch-all parse.** Covered by AC-14.4–14.9 — every refusal case
  must be distinguishable by its `kind` value, which a single Zod failure could not provide.
- **Rejected: automatic reconnection.** Covered by AC-18.1 — no socket is constructed without an
  explicit `retry()` call.
- **Rejected: a string proxy target, or adding CORS.** Covered by AC-13.6 (object target) and
  AC-13.10 (no CORS string anywhere in `packages/server`).
- **Rejected: freezing the route-exception table at eight rows.** Reflected in AC-13.9's design —
  the table is a measured, identity-keyed register, not a frozen count, which is exactly what let
  this iteration add the ninth row for `run-connection.test.ts` without changing the rule.
- **Rejected: running the parser and shared-schema tasks concurrently.** Reflected in the tagging
  of AC-14's scenarios (`frontend-frame-parser`) alongside a `depends_on: [backend-wire-schema]`
  edge in `tasks.yaml` — the committed schema stub throws through `safeParse`, so the parser task
  needs the real implementation, not just the stub, to exercise anything beyond "does not throw."
- **Erratum E-1 (AC-12 re-specification).** Directly the subject of 12.1–12.3; this document does
  not test the struck member-name form.
- **Erratum E-2 (file re-routing).** Directly the subject of 12.6, 13.10 — both assertions now live
  in `packages/server`, not in `packages/shared/src/wire.test.ts`.
- **`AppProps`/`ShellProps` currently declare fields (`socketFactory`, `pageUrl`, `connection`)
  their function bodies do not yet destructure.** This is expected stub state (§1) and is exactly
  what AC-17.1, AC-20.3 and the retry scenarios in AC-18 turn from unreachable declarations into
  exercised behavior once `frontend-react-connection` wires them in.

## 4. Satisfiability check

Every scenario's fix lies either in a file exactly one development task owns, or — for the three
corrections in §0 — inside a `*.test.ts` file this qa-red step itself authors this iteration, all
verified directly against current branch content rather than assumed from the review's own line
numbers (which had shifted). No scenario asks a development task to modify a test file. No scenario
names a file with no owner in `tasks.yaml`. The two `pnpm-lock.yaml`/manifest scenarios (21.1–21.5)
are satisfiable because GO-1 assigned that surface to `frontend-dev-proxy` (manifest) and to a
solutioning-gate human action (lockfile), both already reflected in the current tree per the merged
requirement and errata.

## 5. Provenance

Base structure and 12/12 AC coverage carried from `qa/run-3/scenarios-iter-1.md`, confirmed sound
by `scenario-review-iter-1.md` §6. AC-12 and AC-13(e)/AC-12(ii) reflect `solution/errata.md`'s E-1
and E-2. The three corrections in §0 and scenarios 13.9, 21.3 and 21.5 are new this iteration,
addressing `scenario-review-iter-1.md` §3, §4 and §5 exactly as that review's §8 specified, with
every cited defect and every referenced type/function signature re-verified against the actual
current contents of `wire.test.ts`, `turbo-inputs.test.ts`, `routes.test.ts`, and the ten
solutioning-stage stub files (`wire.ts` ×2, `daemon-endpoints.ts`, `frame-parser.ts`,
`connection-state.ts`, `run-connection.ts`, `app.tsx`, `shell.tsx`, the prose contract, and
`vite.config.ts`) rather than taken on the requirement's or review's word.
