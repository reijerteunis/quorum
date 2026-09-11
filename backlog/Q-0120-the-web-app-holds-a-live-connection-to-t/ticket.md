---
id: Q-0120
title: The web app holds a live connection to the daemon
stage: draft
owner: ruud
repos: []
branch: harness/Q-0120/integration
priority: p1
created: 2026-09-11
iterations: {}
history: []
---
Successor A of Q-0014, transcribed in full from that ticket's merged requirement Appendix A. The frame parser, the connection states, missed and refusal rendering, socket lifecycle, manual retry, and where the three wire shapes live — because packages/server cannot be imported by name today.

Opened **2026-09-11 at Q-0014's requirements gate**, transcribed **in full** from that ticket's
merged requirement rather than referenced — three obligations found in one week (Q-0110, Q-0111,
Q-0112) had lived only inside a closed ticket's prose or a source comment.

**Allocated at the allocator's next id**, not a planned one: M3's `Q-0015`–`Q-0019` are the screens.

**Route ruled at that gate: the FULL pipeline** — `solutioning` → `qa-red` → `development` →
`review`. This half has behaviour a red test can fail on where the shell had none, and M2's closing
measurement is that the seven-stage route has four tickets of evidence between them, all from August.
The argument was deferred at Q-0013's gate and again at Q-0118's; it is taken here.

## Transcribed from Q-0014, Appendix A

**Problem.** Q-0118 shipped a WebSocket carrying one event per message, an envelope that tells a late
subscriber how many events it missed, and a refusal body carrying a code, `core`'s own condition and a
remedy. **Nothing consumes any of it**, and the shapes it exports cannot be imported (§1.1). Until a
client exists, `DEFAULT_RETENTION`, the 1013 backpressure close and the 1008 unknown-run close are
behaviour no test outside `packages/server` has ever exercised. Q-0014 ships the route that holds a run
and the top-bar region that holds connection status; this fills both.

**Its one blocking question, inherited: where do the three wire shapes live?** *Owner: that ticket's
gate, before implementation.* Two answers.

**(A) Give `@quorum/server` an export surface** mirroring `@quorum/core`'s. *Cost:* it is Q-0096's six
criteria arriving inside another ticket; the `default` condition would name a `dist/` this package has
no build script to produce, which is the artifact-that-does-not-exist decision 078 rejects; and it
leaves a value import one keystroke from pulling `hono`, `@quorum/core` and `node:` builtins into a
browser bundle, where AC-5 is a guard and a guard is weaker than an impossibility.

**(B) Recommended. Move the three interfaces into `@quorum/shared` with a `WireMessage` schema beside
them**, and have `packages/server/src/wire.ts` re-export so Q-0118's barrel keeps every name it exports
today. *Why:* AC-14 needs a runtime **parser**, not a type — a type buys nothing against `JSON.parse` —
so the schema must live where a browser can execute it; `@quorum/shared` is the only package with an
`exports` map, a browser-safety guard, and a header that **names this app as its reason**. The three
interfaces are free of host types: `WireRefusal` is three strings, `WireRun` four primitives,
`WireMessage`'s event field `unknown`. The direction is `server → shared`, the normal one
`04-architecture.md:61` already states.

**What moves is smaller than it looks, measured (§1.5):** the three interfaces and a new schema.
`badRequest`, `wireRefusalOf(code, refusal: Refusal)` and `wireRunOf(outcome: StartOutcome)` stay, the
last two being typed against `./host.js` and `./refusal.js`, and so do the three status tables, typed
against `AnswerRefusal` and `StopRefusal`.

**Two measured caveats that will each cost a round if they are not said in advance.**
`packages/shared/src/index.test.ts` asserts the literal `@quorum/` appears in **no file under
`packages/shared/src`, tests included** — which is why that file assembles the needle at run time — so
`WireMessage`'s JSDoc, which currently reads *"`event` is `@quorum/shared`'s `Event` unaltered"*, must
be reworded, and any new test for the moved schema must assemble its needles too. And the same file
asserts every import specifier under `src/` is `./…` or `zod`, so nothing moved may bring an import
with it.

**AC-12 — the three wire shapes have exactly one definition, and it is reachable from a browser
bundle.** No interface, type alias or object literal in `apps/web` restates any of their fields, and
`packages/server` continues to export every name Q-0118's barrel exports today. ***Test:*** a source
scan asserts `condition`, `remedy` and `handle` appear in `apps/web` only in expression position and
never in a declaration, and that the module holding the definitions is imported both by
`packages/server/src/wire.ts` and by at least one `apps/web` source file; shown to have a subject by
reporting a violation over a fixture that re-declares `WireRun`.

**AC-13 — the client reaches the daemon same-origin, and the dev server is what bridges it.** Every
request and the WebSocket upgrade use a path relative to the page's own origin; no absolute URL,
hostname, port, `ws://` or `wss://` literal appears in `apps/web/src`, and a socket URL derives its
scheme from the page's (`ws:` for `http:`, `wss:` for `https:`) with the handle encoded as one path
segment. `apps/web/vite.config.ts` proxies `/runs`, `/project`, `/tickets`, `/flows` and `/history`,
WebSocket upgrade included, to a target read from configuration with a documented default. **No CORS
middleware, header or dependency is added to `packages/server`, and `BIND_HOSTNAME` does not move** —
adding CORS to an unauthenticated loopback daemon that starts agent runs widens exactly what that
constant's own JSDoc refuses to widen. ***Test:*** a source scan for the forbidden literals with
`vite.config.ts` the one exemption; a separate assertion reads `packages/server/src/*.ts` and its
manifest and asserts neither gained the string `cors`. The proxy's own correctness is an integration
concern and is deliberately **not** claimed — the bound is that the source is same-origin, which is
what makes the eventually-served bundle work unchanged.

**AC-14 — a frame is parsed, never cast, and each refusal is distinguishable.** An `event` frame's
payload goes through `@quorum/shared`'s `eventSchema`, a `missed` frame's `count` is checked to be a
number, and anything else is refused and surfaced rather than ignored — *"Errors are explicit … never
default silently"*, and a `JSON.parse` result assigned to `WireMessage` is a silent default.
***Test:*** the parser is a pure function driven with (a) a valid event frame, (b) a valid missed
frame, (c) an unknown `type`, (d) an event that fails `eventSchema`, (e) a non-object and (f) a
non-text message; each of (c) to (f) produces a **distinguishable** refusal asserted by value, because
a single catch-all satisfies a weaker assertion while telling the user the same wrong thing four
times.

**AC-15 — the connection has a named state for every case and none of them is silence.** At minimum:
*connecting*, *live*, **no daemon** (the socket could not be opened at all), *no such run* (the daemon
answered and closed 1008), *ended* (a terminal event then a normal close), *interrupted* (a close
before a terminal event, carrying the browser's close reason as **text**), *dropped* (1013, this
subscriber fell behind) and *protocol error* (AC-14). Each renders in the top bar's connection region
in plain language, and **no daemon** names the address the client tried. The distinction between *no
daemon* and *no such run* is load-bearing: they are "start the daemon" and "that handle is wrong".
***Test:*** the state machine is a pure reducer driven over each transition and asserted **by value**;
those two are asserted to produce different states **and** different user-facing strings, which is the
clause a single catch-all fails.

**AC-16 — a `missed` count is reported, and a refusal renders what it carries.** A
`{type:'missed', count:n}` frame is surfaced with its count, never dropped and never emitted as an
event. A refusal renders from its `condition` — `core`'s sentence unaltered — and its `remedy` where
one is present; a `code` this client does not recognise **still renders its condition** rather than
being replaced by a generic message. No ANSI escape, colour code or vendor branching is introduced into
anything that crosses the wire. ***Test:*** the renderer is driven with a known code carrying a remedy,
a known code with `remedy: null`, and an **invented** code, asserting the exact `condition` string
appears in all three and that the unknown code did not suppress it; the missed handler is driven with
`count: 0` and `count: 7`, and the second must surface the number 7.

**AC-17 — one socket at a time, and leaving closes it.** Leaving the run route, changing the handle, or
unmounting closes the active socket and prevents its callbacks from updating anything afterwards.
***Test:*** driven against a fake transport: a handle change closes the first and opens exactly one
replacement, a late callback from the closed socket changes no state, and unmount closes. Asserted over
the transport's own close record rather than over "the run still exists", which is true whether or not
anything was released — the shape Q-0118's round 2 caught.

**AC-18 — retry is explicit, and retrying preserves what arrived.** An interrupted, refused or errored
connection offers a Retry action. **The client does not reconnect automatically**: without a resume
cursor an automatic reconnection either duplicates events or hides a missed prefix, and Q-0118's
envelope exists precisely so a gap is reported rather than smoothed over. Retry closes any previous
socket, opens exactly one replacement, and clears neither the events already accepted nor the
incomplete-replay notice. ***Test:*** over the fake transport; asserted that no socket is created
without an explicit retry, that exactly one replacement is created, and that prior events and the
missed notice survive.

**AC-19 — nothing is persisted in the browser.** Route content, events, the incomplete-replay notice,
the connection state and the run handle are held in memory only. `04-architecture.md:183` permits *"no
client-side persistence beyond UI preferences"*, and a run handle is not a preference. ***Test:*** a
source scan over `apps/web/src` for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`
and `caches`, shown to have a subject by reporting a violation over a fixture that uses one.

**Sequencing.** After Q-0014, whose AC-6 creates the route it mounts in and whose AC-9 creates the
region it fills. Before or with Q-0015, whose mission control is the first screen that needs it.

---
