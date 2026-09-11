# Q-0120 — The web app holds a live connection to the daemon

Stage: draft  
Iteration: 1  
Surface: Studio web UI, local daemon transport contract, and the Vite development server  
Primary persona: maintainer

## Problem

The daemon can start a run, return a run handle, and stream that run’s events over a WebSocket. It can also tell a late subscriber how many retained events were missed, close an unknown run with code 1008, and drop a subscriber that falls behind with code 1013. HTTP refusals carry a machine-readable code, `core`’s condition, and an optional remedy.

The Studio consumes none of this behavior today. A maintainer opening a run route cannot tell whether the Studio is connecting, live, disconnected from the daemon, pointed at an unknown run, behind the retained event window, or receiving invalid data. No client owns the socket lifecycle, and no client test exercises the daemon’s retention, unknown-run, or backpressure behavior.

The three existing wire shapes also cannot be imported through `@quorum/server`: that package has no browser-consumable export surface or emitted artifact. Copying those shapes into `apps/web` would create two definitions of one contract and allow them to drift.

This ticket fills the run route and top-bar connection region created by Q-0014. It does not build the mission control presentation owned by Q-0015.

## User story

As a **maintainer**, I want the Studio to hold one live connection to the daemon for the run I am viewing, so that I can see accepted events and explicit connection failures without losing already received information or wondering whether the Studio is still live.

## Acceptance criteria

### AC-12 — The wire contract has one browser-safe definition

The canonical definitions of `WireRefusal`, `WireRun`, and `WireMessage`, together with a runtime schema for `WireMessage`, live in `@quorum/shared` if Open question 1 is accepted at the requirements gate.

`packages/server/src/wire.ts` imports and re-exports the three wire shapes so that `packages/server` continues to export every name exported by the Q-0118 barrel. The server-only helpers, status tables, and imports from `./host.js` and `./refusal.js` remain in `packages/server`.

No interface, type alias, schema, or object literal in `apps/web` restates the fields of any of the three wire shapes. At least one shipping source file in `apps/web` imports the shared contract.

The moved code introduces no import in `packages/shared/src` other than a relative `./…` import or `zod`. No file under `packages/shared/src`, including tests and JSDoc, contains the literal package prefix forbidden by its browser-safety test; tests that inspect that prefix assemble the search value at runtime.

**Verification:**

1. A source scan proves that the module defining the wire shapes is imported by both `packages/server/src/wire.ts` and shipping `apps/web` source.
2. A source scan proves that `condition`, `remedy`, and `handle` are not declared as duplicated wire fields in `apps/web`.
3. The scan is shown to have a subject by running it against a fixture that redeclares `WireRun` and reporting that fixture as a violation.
4. Existing server barrel tests prove that every previously exported name remains exported.
5. Existing shared-package browser-safety and import-boundary tests remain green.

### AC-13 — The client reaches the daemon through its own origin

Every HTTP request and WebSocket upgrade initiated by shipping `apps/web` source starts from the page’s own origin. Shipping source contains no absolute daemon URL, hostname, fixed port, or literal WebSocket scheme.

The socket URL is constructed from the page URL, uses the WebSocket equivalent of the page’s current scheme, and appends the run handle as one encoded path segment under `/runs/:handle/events`. A handle containing reserved path characters cannot create an additional path segment or alter the query or fragment.

`apps/web/vite.config.ts` proxies `/runs`, `/project`, `/tickets`, `/flows`, and `/history` to a configurable daemon target. The configuration documents its local default, and the `/runs` proxy supports WebSocket upgrades.

No CORS middleware, CORS response header, or CORS dependency is added to `packages/server`. `BIND_HOSTNAME` remains unchanged.

**Verification:**

1. Unit tests assert URL construction for an HTTP page, an HTTPS page, and a handle containing `/`, `?`, `#`, and a space.
2. A source scan rejects absolute URLs, hostnames, fixed ports, `ws:` literals, and `wss:` literals in `apps/web/src`; `apps/web/vite.config.ts` is the only configuration exemption.
3. A separate scan of `packages/server/src/*.ts` and the server manifest proves that neither gained `cors` in source, dependency names, or headers.
4. Vite configuration tests assert all five proxy prefixes, the configurable target and documented default, and WebSocket upgrade support for `/runs`.

The correctness of Vite’s proxy implementation itself is not claimed by this ticket.

### AC-14 — Every incoming frame is parsed and every parsing failure is distinguishable

The WebSocket frame parser is a pure function. It accepts text frames only, parses their JSON, and validates the result with the shared `WireMessage` schema. The schema validates an `event` payload with `eventSchema` and validates a `missed` count as a finite, non-negative integer.

The parser never casts the result of `JSON.parse` to a wire type. Unknown message types, invalid event payloads, non-object JSON values, malformed JSON, and non-text frames are explicit, distinguishable results that can be rendered and compared by value.

A parsing failure moves the connection to `protocol error`, closes the current socket, and prevents later callbacks from that socket from changing client state. Invalid input is never ignored and is never emitted as an event.

**Verification:** pure-function tests cover:

1. A valid event frame.
2. A valid missed frame.
3. An unknown `type`.
4. An event rejected by `eventSchema`.
5. A non-object JSON value.
6. Malformed JSON.
7. A non-text message.
8. Invalid missed counts, including a string, a negative number, a fractional number, and a non-finite number.

Each invalid category is asserted by its complete refusal value rather than by a shared catch-all message.

### AC-15 — Every connection outcome has a named state and visible text

The connection reducer is pure and has, at minimum, these states:

1. `connecting` — a socket has been requested but has not opened.
2. `live` — the socket opened and may accept frames.
3. `no-daemon` — the socket could not establish a connection to the derived daemon address.
4. `no-such-run` — the daemon answered and closed with code 1008.
5. `ended` — a valid terminal event was accepted before a normal close.
6. `interrupted` — the socket closed before a terminal event and no more specific rule applies; the browser-provided close reason is retained as text.
7. `dropped` — the daemon closed with code 1013 because this subscriber fell behind.
8. `protocol-error` — frame validation failed under AC-14.

The precedence for a close is: 1008 produces `no-such-run`; 1013 produces `dropped`; a normal close after an accepted terminal event produces `ended`; every other close before a terminal event produces `interrupted`. A browser connection failure before `open` produces `no-daemon` rather than `interrupted`.

Every state renders plain-language text in Q-0014’s top-bar connection region. `no-daemon` includes the complete address the client attempted. `no-daemon` and `no-such-run` have different state values and different instructions: the former directs the maintainer to start or reach the daemon, while the latter says the run handle is unknown.

No connection failure is represented by an absent element, an unchanged `connecting` label, or console output alone.

**Verification:** reducer tests drive and assert every transition by complete state value. Renderer tests assert the exact user-facing text for every state and separately prove that `no-daemon` and `no-such-run` differ in both state and text.

### AC-16 — Missed events and refusal details remain visible

A valid `{type: 'missed', count: n}` message creates or updates an incomplete-replay notice containing `n`. It is never added to the event list and is never silently discarded. A count of zero remains a valid, visible result.

A `WireRefusal` renderer always presents `condition` exactly as received. It also presents `remedy` when the value is not `null`. Rendering does not depend on recognising `code`: an unknown or newly added code still shows its condition and remedy.

No ANSI escape, terminal colour code, or vendor-specific branch is introduced into a wire message or its browser rendering.

**Verification:**

1. Refusal-renderer tests use a known code with a remedy, a known code with `remedy: null`, and an invented code.
2. All three assert that the exact condition is present; the invented code test proves the condition was not replaced by generic text.
3. Missed-message tests use counts 0 and 7, prove that 7 is visible, and prove that neither message enters the accepted event list.

### AC-17 — Exactly one socket belongs to the viewed run

The run connection controller owns no more than one active socket. Mounting the run route opens one socket for its handle. Changing the handle closes the previous socket before opening exactly one replacement. Leaving the run route or unmounting closes the active socket and opens no replacement.

Once a socket has been superseded, closed, or disposed, none of its `open`, `message`, `error`, or `close` callbacks may change connection state, accepted events, refusal content, or the incomplete-replay notice.

Repeated cleanup is safe and does not create or close unrelated sockets.

**Verification:** tests use an injected fake transport and assert its own creation and close records. They prove that a handle change closes the first socket and opens exactly one replacement, late callbacks from the first socket change no state, and unmount closes the active socket.

### AC-18 — Retry is manual and preserves accepted information

`no-daemon`, `no-such-run`, `interrupted`, `dropped`, and `protocol-error` states present a Retry action. The client never creates a replacement socket automatically after any close, error, refusal, or protocol failure.

Invoking Retry closes any previous socket, invalidates its callbacks, and opens exactly one replacement for the current handle. Retry retains every previously accepted event and retains the incomplete-replay notice. It changes the connection state to `connecting` while the replacement is opening.

Repeated Retry activation cannot leave concurrent sockets: each activation supersedes and closes the socket created by the previous activation.

**Verification:** fake-transport tests prove that no socket is created after failure without an explicit Retry action, one Retry creates exactly one replacement, repeated Retry actions still leave one current socket, and accepted events plus the missed notice survive.

### AC-19 — Run connection state is memory-only

The current run handle, accepted events, refusal content, incomplete-replay notice, and connection state are held in memory only. Shipping `apps/web` source does not write them to browser storage, cookies, caches, files, URLs, or another persistence mechanism.

A page refresh may therefore lose the handle and live view until Q-0121 provides live-run discovery. This ticket does not work around that gap with browser persistence.

**Verification:** a source scan over `apps/web/src` rejects `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, and browser `caches`. The scan is shown to have a subject by reporting a fixture containing one prohibited use.

### AC-20 — Package and regression checks remain green

The implementation uses strict TypeScript with no `any`, adds no deprecated API, and adds no new runtime dependency unless the solution document gives a one-line justification and records any architectural change required by repository rules.

After installing dependencies with the locked workspace lockfile, the full forced test suite, lint, and typecheck pass. Tests for browser code remain outside `apps/web/src` so the shipping-source browser-safety boundary created by Q-0014 is preserved.

**Verification:** run:

1. `pnpm install --frozen-lockfile`
2. `pnpm turbo run test --force --continue`
3. `pnpm lint`
4. `pnpm typecheck`

## Non-goals

- Building mission control trace columns, timelines, cost displays, or other run presentation owned by Q-0015.
- Building the gate screen, backlog board, run history, harness editor, flow editor, or step chat.
- Starting a run, answering a gate, stopping a run, or defining those HTTP interactions beyond providing the shared refusal renderer.
- Listing or rediscovering live runs after refresh; Q-0121 owns daemon-side live-run discovery.
- Serving the built Studio from the daemon or defining whether its bundle is an emitted artifact; Q-0122 owns that work.
- Implementing `quorum open`.
- Automatic reconnection, resume cursors, event deduplication, or gap repair.
- Persisting run state or a run handle in the browser.
- Changing retention size, backpressure thresholds, close codes, refusal conditions, or any daemon route introduced by Q-0118 and Q-0119.
- Adding CORS, authentication, a configurable daemon bind hostname, or remote-daemon support.
- Adding a desktop shell, cloud sync, multi-user behavior, plugin marketplace, visual flow canvas, eval suite, or Gemini adapter.
- Adding an API-key path or changing adapter subscription behavior.
- Changing worktree containment, gate behavior, flow files, the adapter contract, or any persistent file format.

## Open questions

1. **Blocker — where do the wire shapes live?**  
   **Owner:** requirements gate, before solutioning or implementation.  
   **Recommendation:** accept AC-12 as written: move the three host-independent shapes to `@quorum/shared`, add the runtime `WireMessage` schema there, and re-export the shapes from `packages/server/src/wire.ts`.  
   **Alternative:** give `@quorum/server` a package export surface. This would pull Q-0096-sized packaging work into the ticket, require resolving an emitted artifact the package does not currently build, and leave server-only dependencies reachable from browser code. Choosing this alternative requires rewriting AC-12 and recording any architecture decision before implementation.

2. **Should a zero missed count be shown to the maintainer?**  
   **Owner:** requirements gate.  
   **Assumption in this candidate:** yes. The protocol permits the value, and explicit rendering makes the parser and notice behavior total. If the daemon guarantees it never sends zero, the gate may instead retain parser coverage while requiring no notice for zero.

3. **What exact daemon target configuration key should Vite read?**  
   **Owner:** solutioning.  
   **Constraint:** it must have one documented loopback default, affect development proxy configuration only, and must not create an absolute daemon address in shipping `apps/web/src` or change `BIND_HOSTNAME`.

## Risks

- **Contract drift:** leaving the wire shapes in the server or copying them into the Studio creates definitions that can diverge. AC-12’s single-definition scan is the control.
- **False reassurance:** collapsing connection failures into one disconnected state would give the same advice for an absent daemon, an unknown run, backpressure, and invalid protocol data. AC-15 requires distinct values and text.
- **Duplicate or missing events:** automatic reconnection without a resume cursor can replay accepted events or conceal a missing prefix. AC-18 prohibits it and preserves the explicit missed notice.
- **Stale callback races:** a closed socket can deliver queued callbacks after a handle change or unmount. AC-17 requires generation-safe callback invalidation and verifies the transport’s close record.
- **Browser-bundle contamination:** importing server implementation code could pull Hono, `core`, or Node built-ins into the Studio. The recommended shared contract and existing browser-safety checks keep that dependency direction impossible.
- **Development and served behavior can diverge:** this ticket configures the Vite proxy but does not serve the built Studio. Q-0122 must preserve the same-origin route behavior when it adds production serving.
- **Refresh loses the run:** memory-only state means the current run cannot be rediscovered after refresh until Q-0121 lands. That is an explicit sequencing gap, not a storage workaround for this ticket.
- **Cold-clone impact:** the feature adds no installation step or claimed registry path. A new dependency could still increase install size or time and therefore requires the justification and measurement required by repository rules.

## Cross-cutting checklist

- **BYOS:** not affected; no subscription or adapter login path changes, and no API-key path is introduced.
- **Worktree safety:** not affected; the Studio observes a run and does not move flow execution out of core containment.
- **Gate behavior:** not affected; this ticket neither answers nor changes a gate.
- **Files and schemas:** one runtime wire schema is added to `@quorum/shared`; no persistent file format changes and no browser persistence is added.
- **Cross-vendor rule:** not affected; no flow definition or adapter selection changes.
- **Product agnosticism:** preserved; connection behavior contains no product- or vendor-specific branch.
- **Cold-clone test:** no new user step and no public-registry claim; dependency impact must be measured if the solution adds one.
- **Errors are explicit:** parser failures, connection failures, missed events, and daemon refusals all produce visible, distinguishable values.

## Sequencing

Q-0014 must land first because it provides the run route and top-bar connection region. Q-0120 must land before or with Q-0015, whose mission control screen is the first consumer of accepted events. Q-0121 is required to rediscover live runs after a refresh, and Q-0122 is required to serve the built Studio; neither is required to test or complete the live connection described here.
