---
id: Q-0120
title: The web app holds a live connection to the daemon
stage: solutioned
owner: ruud
repos: []
branch: harness/Q-0120/integration
priority: p1
created: 2026-09-11
iterations:
  requirements.head-of-product: 2
  solutioning.architecture-review: 3
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-11T18:45:18.028Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-11T18:47:28.428Z
    cost: 24.073
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-11T19:43:21.403Z
    cost: 0
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-11T20:36:14.414Z
    cost: 0
  - stage: solutioned
    run: 2
    flow: solutioning
    status: completed
    stage_before: requirements
    stage_after: solutioned
    at: 2026-09-11T21:12:19.945Z
    cost: 25.871
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

## Discharged at the requirements gate, 2026-09-11

The loop exhausted at limit 1 with a complete document and **two blockers that are work no step in
`requirements` may perform**, which is the Q-0070 / Q-0079 / Q-0090 / Q-0096 / Q-0105 precedent:
answered `advance`, then discharged by hand. Both GO-1 and GO-2 say *"do not launch `solutioning`
with this open"*, and neither did.

**GO-1 — `packages/server/` is granted to `backend`.** Answer (ii), the recommended one, in the
three places `role.test.ts` holds against each other: `harness/roles/developer-backend.md`'s
frontmatter, its allowed-path sentence, and `harness/architecture.md`'s table row. Written by the
human because a role editing its own grant inside a run that fans out by role is circular. **Both
directions mutation-checked** — dropping the table row gives *"frontmatter is […] and the table is
[…]"*, dropping it from the sentence gives *"the prose does not name its allowed path
packages/server"*.

**And the first attempt weakened the guard, which is recorded rather than quietly fixed.** The
paragraph explaining the grant spelled `packages/server` a second time, and `role.test.ts`'s prose
clause asks only that the body name each granted path *somewhere* — so with the name present twice,
removing it from the allowed-path sentence left all eight tests green. Measured, not reasoned about.
The paragraph now says *the server package* and the clause discriminates again.

**The lockfile half is deliberately not answered here.** It is generated rather than authored, so
the cheapest form is the human running `pnpm install` once the manifest line exists — which is the
**solutioning** gate, since the manifest is a contract.

**GO-2 — `harness/architecture.md`'s five unfilled sections are written**, and the contract
conventions half became a ruling rather than a description. See *"A typed stub lives at its final
path; `contracts/` holds what is not code"* (2026-09-11). The measurement that forced it: a `.ts`
file under `contracts/` has no package context, so one that imports a workspace package does not
typecheck — probed directly, `TS2307: Cannot find module '@quorum/shared'`, raised **inside**
`contracts/Q-0050/run-flow-api.contract.ts`, whose line 2 imports it. So a red test cannot compile
against a stub kept there, which is the one thing *"Solutioning emits contracts; red phase tests
against contracts"* (2026-08-21) requires of the red phase. Nineteen contract files exist and
thirteen are prose; the single `.contract.ts` is imported by nothing, which is that gap visible in
the tree rather than argued. `solutioning.yaml`, `qa-red.yaml`, both template mirrors and
`02-sdlc-pipeline-spec.md` — §5.2, §5.3 and the folder comment at `:51` — are corrected to match.

**Filling that file broke `role.test.ts`, and the break is the finding.** It located the role table
with a regex matching *any* three-column row in the file, so the new contract conventions table's
`| kind | format |` and `| fixture | JSON |` were read as roles and it went looking for
`harness/roles/developer-kind.md`. **A row shape is not a subject.** The function is now scoped to
the `## Roles for task fan-out` section, a renamed heading fails with *"this check has lost its
subject"* rather than matching nothing, and two new clauses pin both properties.

**GO-3 — OQ-8 answered: the proxy's default target is `127.0.0.1:7717`.** Measured first, and the
measurement changes what the answer means: `serve({ host, port = 0 })` asks the OS for an ephemeral
port and reports back what it got, so **this repository has never named a port at all**. 7717 is
therefore chosen rather than matched — above 1024, clear of Vite's own 5173 and of 3000/8000/8080 —
and nothing may depend on the value: one literal in `apps/web/vite.config.ts` with the reason beside
it, no test reading it, and `quorum open` is what will later have to agree with it.

**GO-4 to GO-7 are not this gate's.** GO-4 (the browser's behaviour with the daemon down) and GO-6
(a tree with no `packages/shared/dist`) are measurements against a running system and belong to the
implement rounds or the final gate; GO-5 is Q-0014's GO-4 method applied at the merge; GO-7 is the
both-rows verification every ticket owes.

**Verified before `solutioning` was launched:** 21/21 turbo tasks forced, 0 cached; `quorum lint`
6/6; the git-identity sweep exit 0.
