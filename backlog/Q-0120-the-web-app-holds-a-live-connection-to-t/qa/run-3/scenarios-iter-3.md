# Q-0120 — Test scenarios (qa-red, run 3, iteration 3)

*One Given/When/Then scenario per acceptance criterion (AC-12 to AC-23), plus edge cases named by
the solution and by the two prior scenario reviews. Every scenario is tagged with the task id(s) in
`solution/tasks.yaml` whose deliverable it exercises. Written after the qa-red exhaustion gate's
erratum (`solution/errata.md` §E-3), so this iteration folds in E-1, E-2 and E-3(a)–(d) rather than
repeating the predicates iterations 1 and 2 found unsatisfiable.*

## 0. What changed since iteration 2

Iteration 2's scenario review (`qa/run-3/scenario-review-iter-2.md`) found the coverage and the red
phase sound and blocked on satisfiability alone. Two blockers reached the qa-red exhaustion gate and
were ruled there rather than by a fourth traversal (`solution/errata.md` E-3):

- **AC-12's declaration scan is re-specified twice over.** E-1 replaced the member-name scan (`type`,
  `event`, `count` anywhere in a file) with a predicate on the union's unique signature — pairing
  `type: 'missed'` with `count`. E-3(a) then bounded that predicate to **one brace-balanced
  declaration body**, because a whole-file version (what iteration 2's implementation actually shipped)
  flags an import specifier and an unrelated object literal dozens of lines apart, and cannot be fixed
  by any development task since the false positives sit in `*.test.ts` files. Scenarios 12.1–12.5 below
  are written against the bounded predicate.
- **The qa-red file map gains two files in `packages/server`, and `wire.test.ts` loses a misrouted
  assertion.** E-2 moves the re-export check (AC-12 Test ii) into `packages/server/src/index.test.ts`
  and the no-CORS check (AC-13(e)) into `packages/server/src/package.test.ts` — both owned by
  `backend-wire-schema`, which is the package granted to `backend` at this ticket's requirements gate.
  Neither assertion may live in `packages/shared/src/wire.test.ts`, which the two registers governing
  that suite's declared reads do not permit.
- **`wire.test.ts` reads the lockfile through the package's own corpus helper, not a self-derived
  root.** E-3(b) replaces the `fileURLToPath`/`import.meta.url` root climb with
  `repoFile('pnpm-lock.yaml')` from `../test/corpus.js` — the same helper `docs.test.ts` already uses
  — which needs no `ROOT_DERIVATIONS`, `ESCAPING_LITERALS` or `READ_BASES` registration at all. Only
  the existing `MANIFEST` row (already at `turbo-inputs.test.ts:166`) applies.
- **`parseFrame`'s third branch is named.** E-3(c): a value that is neither a string nor binary is
  treated as already-parsed; if it is then not an object it is refused as `non-object`.
- **The socket scheme is a transform, never a literal comparison.** E-3(d): `page.protocol` must be
  *transformed* (e.g. `.replace('http', 'ws')`), because a `=== 'https:' ? 'wss:' : 'ws:'` ternary
  writes the literals the source-only scan in `daemon-endpoints.test.ts` forbids under `src/`.

Two items iteration 2 raised as **not blockers** are folded into scenarios here rather than left as
review prose: the zero-vs-null missed count (§7 of the iter-2 review) is scenario 14.3/16.2, and the
`parseFrame` non-string/non-binary branch (§7) is scenario 14.10. Scenario 19.3, which iteration 2
found unimplemented but did not require, is kept: it is cheap, it is a real fact about the feature,
and striking it would remove the only test that a fresh controller starts from empty state.

## 1. Satisfiability check

Every scenario below names a production file already granted to exactly one task in
`solution/tasks.yaml`, or is a permanent, always-true negative assertion over a file no task in this
ticket touches (the CORS guard over `packages/server`'s pre-existing routes; the lockfile content
itself, which is a human edit discharged at the requirements gate per GO-1(iii) and already correct
on disk). No scenario's only possible fix is an edit to a `*.test.ts` file — the three predicates
that were exactly that shape in iterations 1 and 2 (the lockfile needle, the `turbo-inputs.test.ts`
registers, the route exception, and the AC-12 scan) are all written here against their **corrected**
form per §0, so satisfying them is a production-code or documentation change, never a test edit.

| files under test | owning task |
| --- | --- |
| `packages/shared/src/wire.ts`, `packages/shared/src/index.ts` | `backend-wire-schema` |
| `packages/server/src/wire.ts` | `backend-wire-schema` |
| `packages/server/src/*.ts` (no-CORS, pre-existing) | none — permanent negative assertion |
| `apps/web/src/daemon-endpoints.ts` | `frontend-daemon-endpoints` |
| `apps/web/src/connection-state.ts` | `frontend-connection-state` |
| `apps/web/vite.config.ts`, `apps/web/package.json` | `frontend-dev-proxy` |
| `packages/shared/turbo.json` | `backend-lockfile-test-input` |
| `apps/web/src/frame-parser.ts` | `frontend-frame-parser` |
| `apps/web/src/run-connection.ts` | `frontend-run-connection` |
| `apps/web/src/app.tsx`, `apps/web/src/shell.tsx` | `frontend-react-connection` |
| `docs/04-architecture.md`, `docs/GLOSSARY.md`, `harness/architecture.md` | `backend-connection-docs` |
| `pnpm-lock.yaml` | gate-owned human edit, already on disk |

## 2. AC-12 — one frame-union definition, reachable from a browser bundle

**12.1 — a second declaration is caught, bounded to one declaration body.**
*Given* a fixture file under `apps/web/src` containing a single `interface` or `type` alias whose own
body pairs a `type: 'missed'` member with a `count` member,
*when* the declaration scan runs over the package,
*then* that file is reported as re-declaring the wire union.
`[apps/web tasks — scanner fixture]`

**12.2 — an import specifier and an unrelated object literal, far apart, are not flagged.**
*Given* `apps/web/src/run-connection.test.ts`, which imports `type SocketTransport` near the top and
separately constructs `JSON.stringify({ type: 'missed', count: 0 })` dozens of lines later inside a
test body,
*when* the scan runs,
*then* the file is **not** reported — the two fragments belong to no single declaration.
`[frontend-run-connection]`

**12.3 — the same shape in `shell.test.ts` is not flagged.**
*Given* `apps/web/src/shell.test.ts`, which imports `type SocketTransport` and separately builds a
`{ type: 'missed', count: 2 }` literal in an unrelated test body,
*when* the scan runs,
*then* the file is not reported.
`[frontend-react-connection]`

**12.4 — a type reference is not a restatement, and a function body is not a declaration.**
*Given* `apps/web/src/frame-parser.ts` declares `ParsedFrame` including
`Extract<WireMessage, { type: 'missed' }>` and its implementation later writes
`count: value.count` inside a function body (not inside any `interface`/`type` block),
*when* the scan runs,
*then* the file is not reported — a reference to the shared type is not a second declaration, and a
function body is not a declaration at all.
`[frontend-frame-parser]`

**12.5 — the server re-exports the moved type without a new export surface.**
*Given* `packages/server/src/wire.ts`,
*when* its source is inspected,
*then* it imports `WireMessage` from `@quorum/shared` and re-exports it by name, and
`packages/server/src/index.test.ts`'s existing `SURFACE` register is unchanged by the move.
`[backend-wire-schema]`

**12.6 — the shared barrel gains the schema, and the type is proven by use, not by a runtime check.**
*Given* `packages/shared/src/index.ts`,
*when* the barrel is inspected,
*then* it carries `export * from './wire.js'`, `wireMessageSchema` appears in the explicit runtime
export register, and no test asserts `WireMessage`'s presence with a `toHaveProperty`-style runtime
check — its availability is established through type-checked use.
`[backend-wire-schema]`

**12.7 — the shared package's six house-rule clauses hold over the enlarged corpus.**
*Given* `packages/shared/src/index.test.ts`'s six existing clauses (flat `src/`, barrel completeness,
`./…`/`zod`-only import specifiers, no `node:` imports, no filesystem/process/env access, no bare
`@quorum/` literal),
*when* they are re-run after `wire.ts` and `wire.test.ts` are added,
*then* all six pass unmodified, because they read the directory rather than a fixed file list.
`[backend-wire-schema]`

## 3. AC-13 — same-origin reachability, one endpoint register, dev-proxy bridge

**13.1 — an `http:` page builds a `ws:` URL.**
*Given* the page's own origin is `http:`,
*when* `runEventsUrl` builds the socket URL for a handle,
*then* the result is `ws://<same-origin-host>/runs/<handle>/events` with no absolute literal anywhere
in source.
`[frontend-daemon-endpoints]`

**13.2 — an `https:` page builds a `wss:` URL.**
*Given* the page's own origin is `https:`,
*when* the URL is built,
*then* the scheme is `wss:`.
`[frontend-daemon-endpoints]`

**13.3–13.6 — hostile handles stay inside one path segment.**
*Given* a handle containing `/`, `?`, `#`, or a literal space respectively,
*when* the URL is built,
*then* the handle is percent-encoded into exactly one path segment and creates no second path
segment, no query string, and no fragment.
`[frontend-daemon-endpoints]`

**13.7 — the socket scheme is derived by transform, and the forbidden-literal scan proves it.**
*Given* `runEventsUrl` derives the scheme via a transform of `page.protocol` (e.g.
`page.protocol.replace('http', 'ws')`) rather than a literal comparison against `'https:'`,
*when* the source-only scan over `apps/web/src` for `ws:`, `wss:`, `127.0.0.1` and `7717` literals
runs,
*then* it stays green — a ternary comparing against a hard-coded scheme string would instead write one
of the forbidden literals and turn this scan red.
`[frontend-daemon-endpoints]`

**13.8 — no network literal anywhere in the package, with no exemption.**
*Given* Q-0014's whole-package scan for `http://`, `https://` and `//fonts.` literals, widened to walk
every file under `apps/web` including comments and tests,
*when* the merge lands,
*then* every one of the five daemon-facing prefixes is expressed through `DAEMON_ENDPOINTS` rather
than a literal, and the scan grants no new exemption.
`[all frontend tasks]`

**13.9 — the dev proxy uses an object target, never a URL string.**
*Given* `apps/web/vite.config.ts`,
*when* its proxy configuration is inspected,
*then* each of the five daemon prefixes is proxied to an object of the shape `{ host, port }`
constructed from a configured value, and no `http://` string literal appears anywhere in the file.
`[frontend-dev-proxy]`

**13.10 — the port has a documented dev-server default, and the daemon owns no default.**
*Given* the port environment variable is unset,
*when* `vite.config.ts` resolves its proxy target,
*then* it falls back to `7717`, and a comment beside the literal states that this is a Vite-side
convention rather than a fact about the daemon, which has no default port of its own.
`[frontend-dev-proxy]`

**13.11 — the daemon gains no CORS surface.**
*Given* `packages/server/src/*.ts` and its `package.json`,
*when* scanned after this ticket lands,
*then* neither contains the string `cors`, and `BIND_HOSTNAME` is unchanged from Q-0118's value.
`[backend-wire-schema]`

**13.12 — the shell's route table is not extended, and the daemon's endpoint register is separate.**
*Given* `src/router.ts`'s `ROUTES` table,
*when* this ticket lands,
*then* it gains no new entry for the events endpoint — the socket is reached through
`DAEMON_ENDPOINTS`, a register the shell's navigable routes never share.
`[frontend-daemon-endpoints, frontend-react-connection]`

**13.13 — the recursive route-literal scan collects test-file literals, and the exception register has
a live subject.**
*Given* the widened, recursive scan over every file under `apps/web/src` (not just `.tsx`, not just
non-test files),
*when* it collects the path literal `/B/events` from `run-connection.test.ts`'s own fixture,
*then* that literal is present in the exception register keyed to that file and literal, and the
register's anti-vacuity clause confirms the entry has a live subject rather than sitting unused.
`[frontend-run-connection]`

## 4. AC-14 — a frame is parsed, never cast, and every refusal is distinguishable

**14.1 — a valid event frame parses through `eventSchema`.**
*Given* a text message `{"type":"event","event":{...valid terminal event...}}`,
*when* `parseFrame` runs,
*then* it returns `{ ok: true, frame: { kind: 'event', event } }` with the event validated by
`eventSchema`.
`[frontend-frame-parser, backend-wire-schema]`

**14.2 — a valid missed frame with a positive count parses.**
*Given* `{"type":"missed","count":7}`,
*when* parsed,
*then* it returns `{ ok: true, frame: { kind: 'missed', count: 7 } }`.
`[frontend-frame-parser]`

**14.3 — a missed frame with count zero is distinct from absent.**
*Given* `{"type":"missed","count":0}`,
*when* parsed,
*then* it returns `{ ok: true, frame: { kind: 'missed', count: 0 } }` — `0`, not `null` and not a
refusal.
`[frontend-frame-parser]`

**14.4 — an unrecognised discriminant refuses distinguishably.**
*Given* `{"type":"unknown-thing"}`,
*when* parsed,
*then* it returns a refusal of kind `unknown-type`, distinguishable by value from every other refusal
kind below.
`[frontend-frame-parser]`

**14.5 — an event frame whose payload fails `eventSchema` refuses as `invalid-event`.**
*Given* `{"type":"event","event":{"type":"not-a-real-event-type"}}`,
*when* parsed,
*then* it returns a refusal of kind `invalid-event`.
`[frontend-frame-parser, backend-wire-schema]`

**14.6 — JSON parsing to a non-object refuses as `non-object`.**
*Given* the text message `"just a string"` (valid JSON, not an object),
*when* parsed,
*then* it returns a refusal of kind `non-object`.
`[frontend-frame-parser]`

**14.7 — a binary message refuses as `non-text-message` and never throws.**
*Given* an `ArrayBuffer` message,
*when* parsed,
*then* it returns a refusal of kind `non-text-message` and the call does not throw.
`[frontend-frame-parser]`

**14.8 — text that is not JSON refuses as `invalid-json`.**
*Given* the text message `"{not json"`,
*when* parsed,
*then* it returns a refusal of kind `invalid-json`.
`[frontend-frame-parser]`

**14.9 — every invalid count shape refuses as `invalid-count`.**
*Given* `{"type":"missed","count":"7"}`, `{"type":"missed","count":-1}`,
`{"type":"missed","count":1.5}`, and `{"type":"missed","count":Infinity}` in turn,
*when* each is parsed,
*then* each returns a refusal of kind `invalid-count`.
`[frontend-frame-parser]`

**14.10 — a non-string, non-binary value is treated as already-parsed, then refused if not an object.**
*Given* the raw value `42` handed directly to `parseFrame` (bypassing the socket's text/binary
framing),
*when* parsed,
*then* the string/JSON stage is skipped, `42` is found not to be an object, and the result is a
refusal of kind `non-object`.
`[frontend-frame-parser]`

**14.11 — the parser never throws, over the full refusal matrix.**
*Given* each of the eight malformed inputs above,
*when* each is passed to `parseFrame` inside a call wrapped to detect a thrown error,
*then* none of the eight calls throws.
`[frontend-frame-parser]`

## 5. AC-15 — a named state for every case, none of them silence

**15.1 — a non-run route is idle and opens no socket.**
*Given* any route other than the run route,
*when* the app renders,
*then* the connection state is `idle` and no socket is constructed.
`[frontend-connection-state, frontend-react-connection]`

**15.2 — a successful open moves from connecting to live.**
*Given* the run route has just mounted for a handle,
*when* the socket transport reports it opened,
*then* the state moves from `connecting` to `live`.
`[frontend-connection-state]`

**15.3 — close code 1008 is `no-such-run`, regardless of prior events.**
*Given* a connection that has accepted zero or more events,
*when* the socket closes with code 1008,
*then* the state becomes `no-such-run`.
`[frontend-connection-state]`

**15.4 — close code 1013 is `dropped`.**
*Given* a live connection,
*when* the socket closes with code 1013,
*then* the state becomes `dropped`.
`[frontend-connection-state]`

**15.5 — a terminal event followed by a normal close is `ended`.**
*Given* a `terminal` event has been accepted,
*when* the socket then closes normally,
*then* the state becomes `ended`.
`[frontend-connection-state]`

**15.6 — any other close before a terminal event is `interrupted`, carrying the code and reason as
text.**
*Given* no `terminal` event has been accepted,
*when* the socket closes with a code other than 1008 or 1013,
*then* the state becomes `interrupted`, and the close code and the browser's close reason are both
present as text.
`[frontend-connection-state]`

**15.7 — a failure before `open` is `no-daemon`, naming the requested URL.**
*Given* the socket never reports opening,
*when* it fails or closes before ever reaching `open`,
*then* the state becomes `no-daemon` and names the same-origin URL the client requested.
`[frontend-connection-state, frontend-run-connection]`

**15.8 — a normal close with no terminal event is `interrupted`, not `ended`.**
*Given* the connection has been live but accepted no `terminal` event,
*when* the socket closes with a normal close code,
*then* the state is `interrupted`, not `ended`.
`[frontend-connection-state]`

**15.9 — `no-daemon` and `no-such-run` are distinguishable states with distinguishable strings.**
*Given* one connection that never reaches `open` and another that opens and is then closed with 1008,
*when* both are rendered,
*then* they produce different `ConnectionState` values and different user-facing strings.
`[frontend-connection-state]`

**15.10 — a protocol-error frame moves the connection to `protocol-error`.**
*Given* a live connection,
*when* it receives a frame that `parseFrame` refuses (any AC-14 refusal),
*then* the state becomes `protocol-error`.
`[frontend-connection-state, frontend-run-connection]`

**15.11 — the declared precedence holds when a terminal event precedes an 1008 close.**
*Given* a `terminal` event has already been accepted,
*when* the socket then closes with code 1008,
*then* the state is `no-such-run`, not `ended` — the close-code checks are evaluated ahead of the
terminal-based rule, per the declared precedence.
`[frontend-connection-state]`

## 6. AC-16 — a missed count is reported, never treated as an event

**16.1 — a positive missed count surfaces without becoming an event.**
*Given* a `missed` frame with `count: 7`,
*when* handled,
*then* the snapshot's `missedCount` becomes `7` and the accepted event list is unchanged.
`[frontend-run-connection]`

**16.2 — a zero missed count is retained as `0`, and renders no notice.**
*Given* a `missed` frame with `count: 0`,
*when* handled,
*then* `snapshot.missedCount === 0` (not `null`), the event list is unchanged, and the connection
panel renders no missed-events notice.
`[frontend-run-connection, frontend-react-connection]`

**16.3 — the missed notice survives a retry.**
*Given* a `missed` notice is showing and the connection then fails,
*when* the user retries,
*then* the missed notice is still present after the replacement socket is constructed.
`[frontend-run-connection]`

**16.4 — no ANSI, colour, or vendor branching crosses the wire.**
*Given* `packages/shared/src/wire.ts` and `apps/web/src/frame-parser.ts`,
*when* scanned,
*then* neither contains an ANSI escape, a colour code, or a branch keyed on adapter/vendor identity.
`[backend-wire-schema, frontend-frame-parser]`

**16.5 — a later missed frame replaces, rather than accumulates, the count.**
*Given* a missed frame with `count: 3` has already been handled,
*when* a second missed frame with `count: 5` arrives,
*then* `snapshot.missedCount` becomes `5`, not `8`.
`[frontend-run-connection]`

## 7. AC-17 — one socket at a time, and leaving closes it

**17.1 — mounting opens exactly one socket.**
*Given* the run route mounts for a handle,
*when* the injected transport is inspected,
*then* exactly one socket has been constructed.
`[frontend-react-connection, frontend-run-connection]`

**17.2 — a handle change replaces the socket exactly once.**
*Given* a live connection for handle A,
*when* the route's handle changes to B,
*then* the socket for A is closed and exactly one new socket is constructed for B.
`[frontend-run-connection]`

**17.3 — leaving the route or unmounting closes the socket and opens none.**
*Given* a live connection,
*when* the run route is left or the component unmounts,
*then* the active socket is closed and no further socket is constructed.
`[frontend-react-connection]`

**17.4 — a superseded socket's callbacks cannot mutate state.**
*Given* a socket has been superseded, closed, or disposed,
*when* that socket's transport later invokes an `open`, `message`, `error`, or `close` callback,
*then* connection state, accepted events, and the missed count are all unchanged.
`[frontend-run-connection]`

**17.5 — repeated cleanup is safe.**
*Given* a connection has already been disposed,
*when* disposal is invoked again,
*then* nothing throws and no additional socket is closed.
`[frontend-run-connection]`

**17.6 — the socket constructor is injectable.**
*Given* a fake transport supplied through the connection's factory seam,
*when* a connection is created,
*then* the fake transport, not a real global `WebSocket`, is what gets constructed — proven
independently of Q-0014's throwing-global guard, which can prove absence but cannot drive a callback.
`[frontend-run-connection]`

## 8. AC-18 — retry is explicit, and retrying preserves what arrived

**18.1 — only failure states offer Retry.**
*Given* each of `no-daemon`, `no-such-run`, `interrupted`, `dropped`, and `protocol-error`,
*when* rendered,
*then* each offers a Retry action; `idle`, `connecting`, `live`, and `ended` do not.
`[frontend-connection-state, frontend-react-connection]`

**18.2 — retry closes the previous socket and opens exactly one replacement.**
*Given* a connection in `interrupted`,
*when* Retry is activated,
*then* any previous socket is closed, exactly one replacement is constructed, and the state moves to
`connecting`.
`[frontend-run-connection]`

**18.3 — retry preserves prior events and the missed notice.**
*Given* a connection has accepted events and shows a missed notice, then fails,
*when* Retry is activated,
*then* both the previously accepted events and the missed notice are still present afterward.
`[frontend-run-connection]`

**18.4 — repeated Retry cannot leave concurrent sockets.**
*Given* Retry is activated twice in quick succession,
*when* the transport is inspected afterward,
*then* exactly one socket is current and no earlier one remains open.
`[frontend-run-connection]`

**18.5 — no automatic reconnection.**
*Given* a connection has just failed,
*when* no explicit Retry has been triggered,
*then* no new socket is constructed.
`[frontend-run-connection]`

## 9. AC-19 — nothing is persisted in the browser

**19.1 — no browser storage API is used for connection state.**
*Given* a recursive scan of every file under `apps/web/src`,
*when* it searches for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, and `caches`,
*then* none is found, with a positive-control fixture using one reported as a violation.
`[all frontend tasks]`

**19.2 — `history.pushState` is not read as persistence.**
*Given* the existing `history.pushState` use in routing,
*when* the AC-19 scan runs,
*then* it is not flagged — the clause forbids storage, not navigation history.
`[frontend-react-connection]`

**19.3 — a fresh mount starts from an empty snapshot.**
*Given* a connection for handle A has accumulated events and a missed count, then is disposed,
*when* a new controller is constructed for the same handle A,
*then* its initial snapshot is `{ events: [], missedCount: null }` — nothing carries over between
separate controller instances.
`[frontend-run-connection]`

## 10. AC-20 — the connection region renders only what is true, and fabricates nothing

**20.1 — the shell opens no socket on a non-run route.**
*Given* the throwing `WebSocket` and `fetch` globals Q-0014 installed,
*when* the app renders `RAIL[0].path`,
*then* `reached === []` — unchanged from before this ticket.
`[frontend-react-connection]`

**20.2 — every unbuilt screen's placeholder is unchanged.**
*Given* `SCREEN_ROUTES`,
*when* each is rendered,
*then* Q-0014's per-route placeholder assertion still holds for every route the placeholder still
governs.
`[frontend-react-connection]`

**20.3 — mounting the run route constructs exactly one socket.**
*Given* the injected fake transport,
*when* `/runs/:handle` mounts,
*then* exactly one socket has been constructed through it.
`[frontend-react-connection]`

**20.4 — the retired placeholder sentence is gone, not merely joined.**
*Given* every file under `apps/web/src`,
*when* scanned for the literal text of the retired `CONNECTION_PENDING` sentence,
*then* it is found nowhere.
`[frontend-react-connection]`

**20.5 — the panel renders only measurements, never fabrications.**
*Given* a live connection with two accepted events and a missed notice,
*when* the run route renders,
*then* the panel shows the connection state, the missed notice, the accepted-event count, and the
most recent event's `type` and `stepId` — and nothing else (no cost, no diff, no trace, no mission
control content), with the existing unbuilt-screen placeholder still present beside it.
`[frontend-react-connection]`

## 11. AC-21 — dependency, lockfile, and turbo registers move together

**21.1 — the dependency and justification registers move together.**
*Given* `apps/web/package.json`,
*when* inspected,
*then* its `dependencies` are exactly `react`, `react-dom`, and `@quorum/shared`, and the
`JUSTIFICATIONS` register's keys match that set in both directions.
`[frontend-dev-proxy]`

**21.2 — the lockfile carries the matching workspace-link importer.**
*Given* `pnpm-lock.yaml`,
*when* its `apps/web:` importer is inspected,
*then* it contains the quoted key `'@quorum/shared':` with `specifier: workspace:*`.
`[gate-owned human edit — already on disk per GO-1]`

**21.3 — the shared package declares the lockfile as a cacheable input.**
*Given* `packages/shared/turbo.json`,
*when* inspected,
*then* it declares `../../pnpm-lock.yaml` among its `test` task inputs, and the corresponding
`MANIFEST` and Q-0073 clauses in `packages/core/src/turbo-inputs.test.ts` pass without a new register
row.
`[backend-lockfile-test-input]`

**21.4 — the lockfile read needs no root-derivation registration.**
*Given* `packages/shared/src/wire.test.ts` reads the lockfile via `repoFile('pnpm-lock.yaml')` from
`../test/corpus.js`, deriving no workspace root of its own,
*when* `turbo-inputs.test.ts`'s `ROOT_DERIVATIONS`, `ESCAPING_LITERALS`, and `READ_BASES` clauses run
against it,
*then* none reports an unregistered entry for this file — there is nothing to register.
`[backend-lockfile-test-input]`

**21.5 — no new package enters the store.**
*Given* `apps/web`'s only new dependency, `@quorum/shared`, is a workspace link whose sole runtime
dependency (`zod`) is already in the lockfile,
*when* a value from `@quorum/shared` is imported in `apps/web` source and resolved,
*then* it resolves under the workspace source condition, confirming the link rather than a registry
fetch.
`[frontend-dev-proxy, backend-wire-schema]`

## 12. AC-22 — the browser build resolves shared from source, independent of any prior build

**22.1 — the client resolution condition is present and additive.**
*Given* `apps/web/vite.config.ts`,
*when* its `resolve.conditions` is inspected,
*then* it includes `quorum-source` spread over Vite's own client default condition list, rather than
replacing that list.
`[frontend-dev-proxy]`

**22.2 — `apps/web` still does not emit, and the emitting set stays at three.**
*Given* `apps/web/package.json`,
*when* inspected,
*then* it has no `build` script, and the emitting-package assertion in `test-discovery.test.ts` (or
its successor) still names exactly `@quorum/shared`, `@quorum/core`, and `@quorum/cli`.
`[frontend-dev-proxy]`

**22.3 — the fact this criterion compensates for is itself pinned.**
*Given* `packages/shared`'s `exports` map,
*when* inspected,
*then* it resolves `quorum-source` to `./src/index.ts` and every other condition to
`./dist/index.js` — the criterion is written against a fact the test itself asserts, so it goes red
if that fact ever changes.
`[backend-wire-schema]`

## 13. AC-23 — the documents describe what shipped, and the vocabulary gains its one term

**23.1 — the "no connection" sentence is replaced, not joined.**
*Given* `docs/04-architecture.md`'s prior sentence describing the absent connection as "Q-0120's",
*when* this ticket lands,
*then* that sentence is gone, replaced by text naming shared ownership of the frame union and the
server's re-export.
`[backend-connection-docs]`

**23.2 — the status line gains a dated entry.**
*Given* `docs/04-architecture.md`'s status line,
*when* inspected,
*then* it carries a new dated entry describing this change.
`[backend-connection-docs]`

**23.3 — the "frontend remains inert" sentence stays corrected.**
*Given* `harness/architecture.md`'s role-activity prose, already corrected at the requirements gate,
*when* re-checked after this ticket lands,
*then* it still does not call `frontend` inert.
`[backend-connection-docs]`

**23.4 — the glossary gains "Connection state", distinguished from run state.**
*Given* `docs/GLOSSARY.md`,
*when* inspected,
*then* it defines **Connection state** as the closed set from AC-15, states that no member of it is
silence, and states explicitly that it is not a **run state** (`refused | running | ended`), which is
a fact about the run rather than about the socket.
`[backend-connection-docs]`

**23.5 — the two term lists are unedited.**
*Given* `CLAUDE.md`'s and `docs/README.md`'s "use exactly these terms" lists,
*when* compared before and after this ticket,
*then* they are byte-identical — neither gains "Connection state".
`[backend-connection-docs]`

**23.6 — if the role table moved, its cross-checks still hold.**
*Given* `packages/shared/src/role.test.ts`'s clauses binding the role table's third column against
each role's `paths` frontmatter and requiring the role's prose to name every granted directory,
*when* re-run after this ticket,
*then* both clauses still pass.
`[backend-connection-docs]`

## 14. Findings, not scenarios

Recorded per role instructions rather than encoded as red tests, because each names something no
development task in this ticket could fix, or something with no subject to assert against:

- The red-report artifact's head/tail trim swallowing `@quorum/web` and `@quorum/core` output
  (`qa/run-3/scenario-review-iter-1.md` and `-iter-2.md`, both §8/§Observations) is `Q-0076`'s subject,
  not this ticket's. No scenario is written against it.
- `backend-lockfile-test-input`'s `contracts:` list naming `pnpm-lock.yaml` while its description
  forbids touching it is a harmless self-contradiction in a document, not a testable behaviour.
- Scenario coverage for `apps/web/test/daemon-endpoints.test.ts`'s own source-only `ws:`/`wss:`
  forbidden-literal clause is folded into 13.7 above rather than kept separate, since both assert the
  same fact from the production side and the test side of one guard.
