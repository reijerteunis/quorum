# Q-0120 — The web app holds a live connection to the daemon

*Merged requirement, run 1, iteration 1. Written 2026-09-11 against the tree at `082b0e4`.*

*Every measurement either candidate rests on was re-run at this gate rather than relayed. Seven of
the claude candidate's eight reproduced exactly; one did not and is corrected in §0.8. Two surfaces
neither candidate reached are §0.9 and §0.10, and the second of them is why this document returns
**needs-input**.*

**Surfaces:** `apps/web`, `packages/shared`, `packages/server` (a type-only re-export and nothing
else), `pnpm-lock.yaml`, `docs/04-architecture.md`, `docs/GLOSSARY.md`, `harness/architecture.md`.
**Not** the CLI, not `core`, not `backlog/`, not `harness/flows/`.

**Route:** the full pipeline — `solutioning` → `qa-red` → `development` → `review` — ruled at
Q-0014's gate. This document is written for that route: §6 states what solutioning must emit for a
red phase to fail on assertions rather than on missing symbols, §7 maps every file to a task owner,
and **§10 GO-1 is blocking** because two of those files have no owner.

---

## 0. What was measured at this gate, and what it changes

Ten entries. Each is a claim in one of the candidates, or an assumption behind one, checked against
the tree.

**§0.1 — The blocking question about where the wire shapes live is already answered by a landed
guard, and the answer is (B).** `packages/server/src/package.test.ts:138–147` asserts, under the
comment *"The local distribution set is three packages and this ticket does not make it four"*:

```
expect(own.scripts?.build).toBe(undefined);
expect(own.exports).toBe(undefined);
expect(own.main).toBe(undefined);
expect(own.types).toBe(undefined);
```

Option (A) — give `@quorum/server` an export surface — turns that red and moves
`packages/cli/src/build.test.ts`'s per-package emit register with it, and its `default` condition
would name a `dist/` this package has no build script to produce, which is the
artifact-that-does-not-exist decision 078 rejects. Option (B) touches neither. **Ruled in AC-12; an
implementer may not reopen it.** Both candidates recommended (B); only the claude candidate gave a
reason that is a landed check rather than a preference.

**§0.2 — The three shapes are genuinely host-independent, verified field by field.**
`packages/server/src/wire.ts:24–28` `WireRefusal` is three strings; `:100–105` `WireRun` is four
primitives; `:122–124` `WireMessage`'s `event` is `unknown`. The helpers that are *not* movable are
equally clear: `badRequest` (`:31`), `wireRefusalOf(code, refusal: Refusal)` (`:36`),
`wireRunOf(outcome: StartOutcome)` (`:108`) and the three status tables (`:53`, `:74`, `:87`) are
typed against `./host.js` and `./refusal.js` and stay. `packages/server/src/index.ts:40–41` exports
the three as types from `./wire.js`, so a re-export keeps the barrel byte-identical.

**§0.3 — There is a fourth wire shape, and it stays where it is.** `packages/server/src/read.ts:50`
declares `WireTicket`, Q-0119's, exported from the same barrel. It is host-independent too, so the
"only three are movable" reading is wrong — what makes the three movable *now* is that this client
consumes them and nothing consumes `WireTicket`. AC-12 names the three and states that `WireTicket`
stays, so an implementer does not move it as tidying and a reviewer does not block for its absence.
Neither candidate mentions it.

**§0.4 — `apps/web` must gain a dependency, and two registers pin the set exactly.**
`apps/web/package.json` declares `react` and `react-dom` and no workspace package.
`apps/web/test/package.test.ts:97` asserts
`Object.keys(own.dependencies).sort()` is `['react', 'react-dom']`, and `:88` asserts
`JUSTIFICATIONS`'s keys equal the declared set in **both** directions. Both move, **with their claim
intact**: the division `:94–95` states is *what a bundle contains against what only builds or tests
it*, and `@quorum/shared` is on the bundle side because AC-14 executes its schema in a browser.
AC-21.

**§0.5 — AC-13's URL literals collide with Q-0014's own network scan, and the collision is
avoidable rather than exemptable.** `apps/web/test/source.test.ts:243–252` walks **every file in the
package** — `:255–259` asserts `index.html` and `package.json` are in the walk — and forbids
`http://`, `https://` and `//fonts.` with no exemption for anything. A proxy target written
`'http://127.0.0.1:4317'` fails it. Measured against the installed types rather than argued:
`vite@8.2.2`'s `ProxyTargetUrl` (`node_modules/vite/dist/node/index.d.ts:365–369`) is
`URL | string | { port: number; host: string; protocol?: string }`, so the target is an object and
**no URL literal is written anywhere**. `:260–266` already asserts that a same-origin path such as
`<a href="/backlog">` trips none of the three needles, so the client's own paths are safe. An
exemption is therefore **forbidden rather than granted** — an exemption in the scan that forbids
network literals is the narrowing Q-0014's round 2 already paid for once.

**§0.6 — There is no default daemon port, so "a documented default" had no subject.**
`packages/server/src/serve.ts:91` is `serve({ host, port = 0 })` and `createDaemon` does the same:
both ask the operating system for a free port. No `DEFAULT_PORT` exists anywhere, and `quorum open`
— named in `04-architecture.md:165` and in M3's done-when — **does not exist**, verified by search
over `packages/cli/src`. So the number a dev-server proxy points at is **a convention of the dev
server** and not a fact about the daemon, and it must say so in the file rather than imply a product
default. AC-13(c).

**§0.7 — Same-origin means the client has no daemon address to name.** The codex candidate asks that
*no daemon* include *"the complete address the client attempted"*. Under AC-13 the address the
client attempted is the **page's own origin** plus a path; the proxy target is the dev server's and
the browser never sees it. A client printing `127.0.0.1:<port>` would assert something it does not
hold — the failure `quorum board` refuses when it declines to render a containment token git could
not produce. Narrowed in AC-15 to the URL the client actually requested, which is also the useful
thing: it is what a reader pastes into a terminal.

**§0.8 — A glossary term is addable without touching `CLAUDE.md`, and the candidate's count for it
does not reproduce.** `packages/shared/src/docs.test.ts:629–648` compares `CLAUDE.md`'s
*"use exactly these terms"* list with `docs/README.md`'s copy of the same list, **with each other and
with nothing else** — an anti-vacuity anchor on the first and last terms, a **floor** of `> 15`
rather than a count, and an ordered equality between the two files. Neither is compared with
`docs/GLOSSARY.md`'s own headings. Both lists hold 22 terms; the glossary holds many more, and
**Confinement**, **Run lock**, **Undecided**, **Event** and **Run history** are each glossary entries
absent from them, with Q-0059 the precedent that added one to the glossary alone, through the flows.
So adding a glossary entry is a `docs/GLOSSARY.md` edit and nothing else. **The candidate's "33
glossary terms" did not reproduce** — `grep -cE '^\*\*[^*]+\*\*' docs/GLOSSARY.md` answers 38, of
which at least one (*"A past measurement, and never a policy."*) is a bolded sentence inside an
entry rather than a heading. The count is not load-bearing, no criterion depends on it, and it is
recorded as not-reproduced rather than repeated, because a measurement copied from a document is not
a measurement.

**§0.9 — The browser build resolves `@quorum/shared` through Vite's *client* conditions, which
nothing in this workspace sets.** *Neither candidate reached this, and it is the single most likely
thing to cost a round.* `packages/shared`'s `exports` map resolves `quorum-source` to
`./src/index.ts` and **everything else to `./dist/index.js`**. `vitest.shared.js` sets
`ssr.resolve.conditions`, and its own header says why: *"It is `ssr.resolve` and not `resolve`
because Vitest's node environment resolves through Vite's server pipeline; setting the client list
as well was measured to be redundant here and dropped."* `apps/web/vite.config.ts` sets neither, and
Vite's client default conditions do not include `quorum-source`. So an `import … from
'@quorum/shared'` under `apps/web/src` resolves **under Vitest to source** and **under `vite dev` /
`vite build` to `packages/shared/dist/index.js`**, which is gitignored (`.gitignore:4`) and produced
only by a `build` task no suite runs. On this machine that directory happens to exist, so the dev
server would work here and fail on any fresh clone — **a verdict that is a property of the checkout
rather than of the commit**, which *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30) forbids, and the mirror image of the assertion Q-0096's E-1
retired for the same reason. AC-22.

**§0.10 — `integrate` runs `pnpm install --frozen-lockfile`, so the lockfile moves with the
manifest — and no role may write it.** `harness/harness.yaml:34`. `pnpm-lock.yaml:36–43` carries the
`apps/web:` importer with exactly `react` and `react-dom`, so adding `@quorum/shared` changes it.
A manifest change without the lockfile makes `pnpm install --frozen-lockfile` refuse, which kills
`prove-red` and every `integrate` of the development loop — and kills `prove-red` in the worst
possible way, since `harness.yaml:31–33` records that an install failure is read as proof of red.
`pnpm-lock.yaml` appears in **no role's `paths`**, `developer-generalist`'s included, whose prose
says *"wider is not unbounded"* and then lists fourteen entries without it. Measured rather than
assumed: implement steps have written that file on six tickets — Q-0043, Q-0045, Q-0090, Q-0098,
Q-0013 and Q-0014 twice — every one of them a chore or port run, because `paths` is **advisory**
(`packages/shared/src/role.test.ts:50–54`) and enforcement reaches an agent only through role prose.
**This is the first ticket to add a workspace dependency on the full pipeline**, where the fan-out
roles carry that prose and `development.yaml`'s own instruction repeats it — *"Do not touch files
outside your role's allowed paths"* — so a well-behaved `backend` implementer refuses and the loop
spends its budget discovering it. GO-1, with §0.11.

**§0.11 — No admissible fan-out role may write `packages/server/`.** `solutioning.yaml:16` confines
the architect to *"role (frontend|backend|data)"*. Their grants, from `harness/architecture.md:26–30`
and the role frontmatter that `role.test.ts:130` holds against it: `frontend` → `apps/*`,
`packages/ui`, `packages/i18n`; `backend` → `packages/core`, `packages/shared`, `harness`, `docs`,
`backlog`; `data` → `packages/database`. **None covers `packages/server`.** `tooling` does not
either, and is not an admissible task role despite `harness/architecture.md:40` calling it a live
fan-out role — a contradiction between the flow file and the context document, recorded in §11.
GO-1.

**§0.12 — The daemon never sends a zero missed count.** `packages/server/src/http.ts:109–111`:
`missedMessage` returns `count > 0 ? … : null`. That rules the codex candidate's open question by
measurement rather than by taste: the parser must still **accept** zero, because it is a valid
non-negative integer and the parser's job is to be total, and the renderer renders **no notice** for
it. Recorded in AC-16 with the reason, so the zero case is understood as the parser's defence rather
than as evidence about the wire.

**§0.13 — The route-literal scan is blind in two directions, not one.**
`apps/web/test/routes.test.ts:26–30` builds its corpus from `fs.readdirSync(SOURCE)` filtered to
`.tsx` — so a path literal in a `.ts` module is invisible to it **and so is any file in a
subdirectory**, the walk not being recursive. Writing the socket path in a `.ts` module would dodge
a guard by file extension, which is the *"shipping files"* narrowing Q-0014's round 2 caught. Both
gaps close in AC-13(d). Note also that `pathLiterals` (`:38`) collects any quoted or backticked
literal beginning with `/`, so a template literal `` `/runs/${handle}/events` `` **is** collected and
must be registered. And `ROUTES` may not gain the endpoint: `src/router.ts` matches `ROUTES`, so the
shell would navigate to a WebSocket URL and draw a placeholder at it.

**§0.14 — An `apps/web` test may not read `packages/server`, and the reason is cache coverage.**
`packages/core/src/turbo-inputs.test.ts:152–153` audits exactly two suites, `@quorum/shared#test` and
`@quorum/core#test`, and `apps/web` has **no `turbo.json`**. An `apps/web` test reading
`packages/server/src/wire.ts` would be refused by no clause **and** covered by no declared input, so
a cached `@quorum/web#test` pass could stand over an edited `wire.ts`. Reading `packages/shared` is
different and already solved: `MANIFEST`'s own comment records that such reads are covered by the
`^test` dependency edge, which `apps/web` acquires the moment it declares the dependency. AC-12
therefore asserts each half **inside the package it is about**, and this ticket adds no `turbo.json`
and no dependency on `@quorum/server`.

---

## 1. Problem

The `maintainer` starts a run and the browser cannot watch it. Q-0118 shipped
`GET /runs/:id/events` — one event per message, an envelope telling a late subscriber how many
events it missed, a 1008 close for a handle nothing holds, a 1013 close for a subscriber that fell
behind — and Q-0119 shipped five read routes. **Nothing consumes any of it.** `apps/web` opens no
socket, and `src/shell.test.ts:81–84` installs a throwing `globalThis.WebSocket` to prove it:
*"the shell must not open a socket"*. The top bar's connection region reads
`no live connection yet — Q-0120 opens one` (`src/shell.tsx:39`), and `vite.config.ts`'s own header
already routes the proxy here: *"Proxying the daemon's routes so the app can reach them same-origin
is the live connection's, not the shell's."*

So `DEFAULT_RETENTION`, `MAX_BUFFERED_BYTES`, the 1013 close and the 1008 close are behaviour no
test outside `packages/server` has ever exercised, and the shapes Q-0118 built for this app **cannot
be imported by name** — `packages/server` declares no `exports`, `main` or `types`, which its own
suite pins as correct (§0.1). Meanwhile `packages/server/src/wire.ts:4` calls itself *"the contract
Q-0014 codes against"*. An implementer who obeys that sentence finds it unresolvable and copies the
interfaces into `apps/web`: **the drift arrived at by obeying the sentence forbidding it.**

For the `adopter` the failure is worse than absence. With no connection state, a daemon that is not
running and a handle that does not exist look identical — a screen that shows nothing. Those are
*"start the daemon"* and *"that handle is wrong"*, and a product that cannot tell them apart has made
silence stand in for both answers, which is what this repository refuses in `quorum board`'s
containment token, in its push-lag line and in a verified-version state.

## 2. User stories

- **`maintainer`** — *I open a run's URL and see its events arrive live; and when the connection is
  not live I am told which of the eight ways it is not, in a sentence I can act on. If I joined late
  I am told how many events I missed rather than shown a stream that looks complete.*
- **`adopter`** — *I run the dev server before I have a daemon, and the app tells me the daemon is
  not answering and names the URL it asked for, instead of drawing an empty panel. Nothing is left in
  my browser when I close the tab.*
- **`contributor`** — *I read one definition of what crosses the wire, in the one package that is
  safe to bundle for a browser, and I can see from `packages/server`'s own source that it is the same
  definition the daemon serialises.*

## 3. Non-goals

1. **Mission control** — trace columns, cost tickers, the step timeline. Q-0015. This ticket adds a
   connection panel, not a screen, and `/runs/:handle`'s register row stays Q-0015's (AC-20).
2. **Starting, answering or stopping a run from the browser.** `POST /runs`, `POST /runs/:id/gate`
   and `POST /runs/:id/stop` stay unreached and the top bar's action stays disabled. A control that
   appears to mutate something is the fabrication Q-0014 refused.
3. **Listing the daemon's live runs.** Q-0121. A handle reaches this app through its URL only, and
   §9 R-1 records what that costs.
4. **A `build` script, a bundle, a static route, and the emitted-artifact ruling.** Q-0122. The
   emitting set stays at three and `apps/web/test/package.test.ts:191` asserts it. §0.9's fix is a
   *resolution* condition, not a build task, and the distinction is the point.
5. **Automatic reconnection, resume cursors, event deduplication and gap repair.** AC-18 refuses the
   first with its reason; the rest would widen `WireMessage` and are nobody's yet.
6. **CORS, a configurable bind, authentication, remote daemons.** `BIND_HOSTNAME` does not move and
   `packages/server` gains no middleware, header or dependency (AC-13(e)).
7. **Client-side persistence of any kind**, including a "last run" convenience. AC-19.
8. **Widening the gate-answer envelope.** *"Override with reason"* is corrected in two documents
   already; a control reintroducing it would reinstate what `gateAnswerEnvelopeSchema` refuses.
9. **Changing `eventSchema`, `WireMessage`'s vocabulary, the retention size, the backpressure
   ceiling or the close codes.** This is a consumer. A frame shape it cannot parse is a finding
   against this ticket, not a licence to edit the producer.
10. **Moving `WireTicket`** (§0.3), **adding a `turbo.json` for `apps/web`**, or **depending on
    `@quorum/server`** (§0.14).

## 4. Acceptance criteria

Numbered from 12, continuing Q-0014's, so a criterion keeps its name now that the cut has moved
(Q-0106's convention). **Thirteen**, against the fifteen that split Q-0013 at eighteen and Q-0096 at
twenty-one.

---

**AC-12 — the three wire shapes have exactly one definition, and it is reachable from a browser
bundle.**

`WireRefusal`, `WireRun` and `WireMessage` are declared in **`packages/shared/src/wire.ts`**, a new
flat module, with a runtime `wireMessageSchema` beside them on the barrel.
`packages/server/src/wire.ts` imports and re-exports the three as types, so `@quorum/server`'s
runtime surface is unchanged and `packages/server/src/index.test.ts`'s `SURFACE` register does not
move. `packages/server`'s manifest gains no `exports`, `main`, `types`, `files`, `bin` or `build`.
No interface, type alias, schema or object literal in `apps/web` restates any of their fields.
**`WireTicket` stays in `packages/server/src/read.ts`** and is not moved: it is Q-0119's, no client
here consumes it, and moving it is scope creep (§0.3).

***Test:*** three assertions, **each inside the package it is about**, because a scan that left
`apps/web` would be refused by no clause and covered by no declared input (§0.14).
(a) In `apps/web`: a scan over every file under `src/` reporting any *declaration* of `condition`,
`remedy`, `handle`, `runId`, `flow`, `state` or `count` — a `:` binding inside an `interface`, `type`
or object literal — while permitting every expression-position use; shown to have a subject by
reporting a violation over a fixture that re-declares `WireRun`; plus an assertion that at least one
file under `src/` imports the shared package.
(b) In `packages/server`: `wire.ts`'s specifiers include the shared package and the three names are
re-exported from it, asserted over the file's own text, with the barrel's surface held by the
existing register.
(c) In `packages/shared`: the schema is on the barrel, and `index.ts` still holds nothing but
one-line re-exports, which `src/index.test.ts:131`'s `/^export \* from '\.\/[a-z-]+\.js';$/` already
enforces — `wire.js` satisfies it.

---

**AC-13 — the client reaches the daemon same-origin, the endpoint paths are a register, and the dev
server is what bridges them.**

(a) **Same-origin.** Every request and the WebSocket upgrade use a path relative to the page's own
origin. No absolute URL, hostname, port, `ws:` or `wss:` literal appears anywhere under
`apps/web/src`. A socket URL derives its scheme from the page's — `ws:` for `http:`, `wss:` for
`https:` — and carries the handle as **one** path segment, percent-encoded, so a handle containing
`/`, `?`, `#` or a space cannot create a second segment or reach the query or the fragment.

(b) **No network literal anywhere in the package, and no exemption.** `vite.config.ts`'s proxy target
is an **object** — `{ host, port }`, which `ProxyTargetUrl` accepts (§0.5) — so Q-0014's whole-package
scan keeps forbidding `http://`, `https://` and `//fonts.` with no file excused. **Adding an
exemption to that scan is a failure of this criterion.**

(c) **The port is configuration, and its default is the dev server's convention, stated as such.**
The target port is read from the environment with a documented default, and the comment beside it
records that the daemon has **no default port** — `serve` and `createDaemon` both ask the operating
system for a free one — and that choosing the daemon's is `quorum open`'s, which does not exist
(§0.6). **No test reads the variable**, so `turbo.json`'s `test` task `env` list stays
`["QUORUM_REAL_CLI"]`.

(d) **One register for the daemon's endpoints, separate from the shell's routes.** The five paths the
proxy forwards and the paths the client requests come from one exported table, which
`vite.config.ts` imports. `ROUTES` is **not** extended (§0.13). `test/routes.test.ts`'s component
scan is widened from a flat `.tsx` listing to a **recursive walk of every file under `src/`**, and
excuses exactly the literals the endpoint register holds — both blindnesses close together, because
closing one leaves the other as the way round it.

(e) **Nothing is added to the daemon.** No CORS middleware, header or dependency reaches
`packages/server`, and `BIND_HOSTNAME` does not move — adding CORS to an unauthenticated loopback
process that starts agent runs widens exactly what that constant's JSDoc refuses to widen.

***Test:*** URL construction asserted for an `http:` page, an `https:` page and the four hostile
handles; a scan over `apps/web/src` for the forbidden literals with a positive control that it found
source; Q-0014's whole-package scan re-run unchanged plus an assertion that it grants no exemption; a
comparison asserting the proxy's forwarded prefixes and the client's request paths are the same set,
taken from the register on both sides rather than written twice; and a read of
`packages/server/src/*.ts` and its manifest asserting neither gained the string `cors`. **The proxy's
own runtime behaviour is deliberately not claimed** — it is an integration concern, and the bound is
that the source is same-origin, which is what makes the eventually-served bundle work unchanged.

---

**AC-14 — a frame is parsed, never cast, and every refusal is distinguishable.**

One pure function turns one received message into either a parsed frame or a refusal drawn from a
**closed set**. Text frames only. An `event` frame's payload goes through `@quorum/shared`'s
`eventSchema`. A `missed` frame's `count` must be a **finite, non-negative integer**, not merely a
number — rendering *"you missed −3 events"* is a silent default wearing a different hat. Anything
else is refused and surfaced. The function **never throws**: a `JSON.parse` failure is one of its
refusals, not an exception.

***Test:*** the parser driven directly, with no DOM and no socket, over (a) a valid event frame,
(b) a valid `missed` frame, (c) an unknown `type`, (d) an event that fails `eventSchema`, (e) a
non-object JSON value, (f) a non-text message, (g) text that is not JSON, and (h) each invalid count
— a string, `-1`, `1.5`, and a non-finite. Each of (c) to (h) produces a **distinguishable** refusal
asserted **by value**, because a single catch-all satisfies a weaker assertion while telling the user
the same wrong thing seven times.

---

**AC-15 — the connection has a named state for every case, and none of them is silence.**

A pure reducer over a closed set: **idle** (no run is open — every route but the run route),
**connecting**, **live**, **no daemon** (the socket never reached open), **no such run** (the daemon
answered and closed 1008), **ended** (a `terminal` event, then a normal close), **interrupted** (a
close before any `terminal` event, carrying the close code and the browser's reason as **text**),
**dropped** (1013 — this subscriber fell behind), and **protocol error** (AC-14).

**The precedence for a close is declared rather than left to be rediscovered**: 1008 → *no such run*;
1013 → *dropped*; a normal close after an accepted `terminal` event → *ended*; every other close
before a `terminal` event → *interrupted*; and a failure **before `open`** → *no daemon* rather than
*interrupted*. Each state renders in the top bar's connection region in plain language. **No daemon**
names **the URL the client requested** — the page's own origin and the path — and never an address it
does not hold (§0.7). *No daemon* and *no such run* are the load-bearing pair: they are "start the
daemon" and "that handle is wrong".

***Test:*** the reducer driven over every transition and asserted **by value**, with no DOM; *no
daemon* and *no such run* asserted to produce different states **and** different user-facing strings,
which is the clause a single catch-all fails; *ended* asserted to require a `terminal` event rather
than a close code alone, and a normal close with no terminal event asserted to be *interrupted*.

---

**AC-16 — a `missed` count is reported, and a refusal renders what it carries.**

A `missed` frame is surfaced with its count, never dropped and never added to the event list. A
refusal renders from its `condition` — `core`'s or the daemon's own sentence, unaltered — and its
`remedy` where one is present; a `code` this client does not recognise **still renders its
condition** rather than being replaced by a generic message, which is `startRefusalCode`'s own
discipline read from the other end. No ANSI escape, colour code or vendor branching is introduced
into anything that crosses the wire.

***Test:*** the renderer driven with a known code carrying a remedy, a known code with
`remedy: null`, and an **invented** code, asserting the exact `condition` string appears in all three
and that the unknown code suppressed nothing; the missed notice driven with `count: 7` and required
to surface the number, and with `count: 0` and required to render no notice — **with the reason
recorded beside it** that `http.ts:109–111` returns `null` for `count <= 0`, so the daemon never
sends a zero and that case is the parser's defence rather than evidence about the wire (§0.12).

---

**AC-17 — one socket at a time, and leaving closes it.**

The run connection owns at most one active socket. Mounting the run route opens one for its handle;
changing the handle closes the previous before opening exactly one replacement; leaving the route or
unmounting closes the active one and opens none. Once a socket is superseded, closed or disposed,
none of its `open`, `message`, `error` or `close` callbacks may change connection state, accepted
events, refusal content or the incomplete-replay notice. Repeated cleanup is safe. **The socket
constructor is injectable**, because a throwing global — Q-0014's instrument at
`src/shell.test.ts:81–84` — can prove a socket was *not* opened and cannot drive a callback.

***Test:*** driven against a fake transport that records construction, sends and closes. Asserted
over **the transport's own close record**, never over "the run still exists", which is true whether
or not anything was released — the shape Q-0118's round 2 caught.

---

**AC-18 — retry is explicit, and retrying preserves what arrived.**

*No daemon*, *no such run*, *interrupted*, *dropped* and *protocol error* each offer a Retry action.
**The client never reconnects automatically**: without a resume cursor an automatic reconnection
either duplicates events or hides a missed prefix, and Q-0118's `missed` envelope exists precisely so
a gap is reported rather than smoothed over. Retry closes any previous socket, invalidates its
callbacks, constructs exactly one replacement, moves the state to *connecting*, and clears neither
the events already accepted nor the incomplete-replay notice. Repeated activation cannot leave
concurrent sockets.

***Test:*** over the fake transport — no socket is constructed after a failure without an explicit
retry, one retry constructs exactly one replacement, repeated retries still leave one current socket,
and both the prior events and the missed notice survive.

---

**AC-19 — nothing is persisted in the browser.**

Events, the incomplete-replay notice, refusal content, the connection state and the run handle are
held in memory only. `04-architecture.md:183` permits *"no client-side persistence beyond UI
preferences"*, and a run handle is not a preference. A refresh therefore loses the handle until
Q-0121 lands, and that gap is accepted rather than worked around.

***Test:*** a scan over every file under `apps/web/src` for `localStorage`, `sessionStorage`,
`indexedDB`, `document.cookie` and `caches`, with a positive control that it found source and a
fixture that uses one reported as a violation. The existing `history.pushState` use is named as not
persistence, so the clause is not read as forbidding it.

---

**AC-20 — the connection region says what is true of the route it is on, the run route fabricates
nothing, and a non-run route still opens no socket.**

`CONNECTION_PENDING` is **retired by replacement, not deleted**: the region renders the AC-15 state,
and on every route but the run route that state is **idle** and says so — the top bar is global and
the socket is the run route's. At `/runs/:handle` the connection panel renders **beside** the
existing placeholder, which is unchanged: the row stays Q-0015's, `waitingFor` still describes
mission control, and no `RailEntry.screenExists` flips, because this ticket adds a connection and not
a screen. What the panel may show is **the connection state, the incomplete-replay notice, the count
of accepted events, and the most recent event's `type` and `stepId`** — measurements rather than
fabrications, and the minimum that lets a test see that a socket delivered something. Anything more
is Q-0015's.

***Test:*** Q-0014's *"the shell must not open a socket"* guard re-run at `RAIL[0].path` with the
throwing `WebSocket` and `fetch` globals in place and still asserting `reached === []`; Q-0014's
per-route placeholder assertion re-run unchanged over `SCREEN_ROUTES`; a mounting of the run route
asserted to construct **exactly one** socket through the injected transport; and an assertion that no
file under `src/` carries the retired sentence, so the replacement cannot sit beside the thing it
replaced.

---

**AC-21 — the manifest and the lockfile declare the new dependency together, the two registers move
with their claim intact, and the cold-clone install does not grow.**

`@quorum/shared` is a `dependencies` entry of `apps/web` (`workspace:*`), because AC-14 executes its
schema **in the browser**, which is the division `test/package.test.ts:94–95` asserts.
`JUSTIFICATIONS` gains its line. **`pnpm-lock.yaml`'s `apps/web:` importer moves in the same
commit**, because `integrate` runs `pnpm install --frozen-lockfile` and a manifest ahead of the
lockfile fails it — which `prove-red` would read as proof of red (§0.10). **No new package enters the
store**: `@quorum/shared` is a workspace link whose only runtime dependency is `zod`, already in the
lockfile, so Q-0014's cold-store figures — 203 packages, 179 MB, 10.4 s — do not move.

***Test:*** the dependency register asserted as the new exact set with `@quorum/shared` on the bundle
side; the justification register asserted against the manifest in both directions as it is today; the
lockfile asserted to carry `@quorum/shared` under the `apps/web` importer, in the shape
`packages/server/src/package.test.ts:129–136` already uses for its own; and a value from the new
dependency asserted to resolve under the workspace source condition. The store claim is **verified at
the gate rather than asserted by a test** (GO-4), because it is a measurement about an install and a
test asserting it would be reading a lockfile to predict a download.

---

**AC-22 — the browser build resolves the shared package from source, and this does not depend on
whether anything has been built.**

`apps/web/vite.config.ts` declares `resolve.conditions` including `quorum-source`, spread over Vite's
own client defaults rather than replacing them — the client-side counterpart of what
`vitest.shared.js` does for `ssr.resolve`, and needed because that file deliberately sets only the
server list (§0.9). Without it `vite dev` and `vite build` resolve `@quorum/shared` to a gitignored
`dist/` that no task in this workspace builds, so the app works on a machine that has run a build and
fails on a fresh clone. `apps/web` gains **no `build` script** and the emitting set stays at three:
this is a resolution condition, not a build task.

***Test:*** the configuration asserted **structurally** — the condition is present and the default
list is spread rather than replaced — rather than by attempting a resolution, whose answer would
depend on whether `packages/shared/dist` happens to exist in the checkout, which is the very
dependence this criterion removes. Beside it, one assertion that `@quorum/shared`'s `exports` still
resolves `quorum-source` to `./src/index.ts` and everything else to `./dist/index.js`, so the
criterion names the fact it is compensating for and goes red if that fact changes.

---

**AC-23 — `packages/shared`'s house rules hold over the new module.**

`src/` stays flat and the new file is one lower-case, hyphen-free module name its barrel regex
accepts. The literal `@quorum/` appears in **no file under `packages/shared/src`, tests included** —
so `WireMessage`'s JSDoc, which today reads *"`event` is `@quorum/shared`'s `Event` unaltered"*
(`packages/server/src/wire.ts:117`), is reworded as it moves, and any needle a new test uses is
assembled at run time. Every import specifier under `src/` is `./…` or `zod`, so nothing moved brings
an import with it. The module reaches for no filesystem, process or environment.

***Test:*** the six existing clauses of `packages/shared/src/index.test.ts` re-run over the enlarged
corpus — they read the directory rather than a file list, so they cover the new module without anyone
remembering — plus the barrel-surface register gaining the schema's name.

---

**AC-24 — the documents that describe this absence describe what shipped, and the vocabulary gains
its one term.**

`docs/04-architecture.md`'s `apps/web` paragraph says *"There is no connection to the daemon — the
frame parser, the connection states and the socket lifecycle are Q-0120's, and the top bar reserves
the region they fill"*, which this change makes false; its `packages/server` paragraph gains the one
sentence that the wire shapes are declared in `shared` and re-exported here, and why. The status line
gains its dated entry. Where a `frontend` task lands work, `harness/architecture.md:45–48`'s
*"`frontend` and `data` remain inert"* is corrected in the same change — that file is fed to the
architect on every run, so a stale sentence there is one every future solution inherits.

`docs/GLOSSARY.md` gains **Connection state**: the closed set AC-15 names, derived per moment and
never stored, rendered in plain language, with the rule that no member of it is silence, and the
statement of what it is **not** — not a **run state**, which is `packages/server`'s
`refused | running | ended` and is a fact about the *run*. The two are near-homographs for unrelated
questions and neither is ever used for the other, which is the discipline **Containment** and
**Confinement** already carry, and the rule in `.claude/rules/docs-and-decisions.md` that a term is
added before it is used in a second file. **`CLAUDE.md`'s and `docs/README.md`'s *"use exactly these
terms"* lists are NOT edited** (§0.8): an implementer that edits either has failed this criterion
rather than satisfied it.

***Test:*** each claim asserted against the shipped document by the mechanism `docs.test.ts` already
uses, including that the retired sentences are **gone** rather than merely joined by new ones; the
glossary term asserted present with its closed set, its never-silence rule and its *not a run state*
clause, in the shape that file already uses for **Verified version** and **Push lag**; an assertion
in the same file that the two 22-term lists are byte-identical to what they hold today, so this
change cannot move them; and, if the role table moved, `packages/shared/src/role.test.ts` re-run,
which holds the third column against each role's `paths` frontmatter **and** requires the role's prose
to name every directory it is granted, so a partial edit is red.

---

## 5. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No key on any path, in any fixture, in any sentence. `apps/web/test/package.test.ts:101–118`'s credential scan walks the whole package and covers every file this ticket adds without moving; the proxy target is a host and a port and carries no credential. The browser holds no credential, because what authenticates an agent is a subscription the vendor's own CLI already owns. |
| **Worktree safety** | Nothing here writes outside a worktree and no criterion names `backlog/`. |
| **Gate behaviour** | Untouched. `gateAnswerEnvelopeSchema` is not widened, no gate control is added, and *"override with reason"* is a non-goal. |
| **File format and schema** | One new schema in `packages/shared`, over a shape `packages/server` already declares. `eventSchema` is **consumed**, never changed. Nothing is written to `.quorum/`, `harness/` or `backlog/`. |
| **Lint and types** | `eslint.config.js` has covered `apps/**/*.ts` and `apps/**/*.tsx` since Q-0014. Strict TypeScript, no `any`, no deprecated API, no flow-lint rule added. |
| **Cold-clone impact** | AC-21: no new package enters the store, so the first thirty minutes do not grow. AC-22 is what keeps a fresh clone working at all. The dev server gains a proxy, which is one fewer thing an adopter configures. |
| **Product-agnostic** | Nothing names a SaaS product; Q-0014's AC-9 scan still refuses the mockup's three fake project names. |
| **Errors are explicit** | AC-14, AC-15 and AC-16 are three faces of one rule: a parse failure, a connection failure and a daemon refusal each produce a visible, distinguishable value, and none of them is silence. |

## 6. Contracts solutioning owes

`qa-red`'s `write-tests` step says *"Implement automated tests for every scenario against the
contracts under `contracts/`. Tests must compile/typecheck against the stubs and FAIL on assertions,
not on missing symbols."* For a TypeScript workspace those two sentences pull apart: a `.contract.md`
under `contracts/Q-0120/` is not importable, so a suite written against it fails to compile and
`prove-red`'s `expect: fail` passes for the wrong reason. **Ruled here so no architect has to guess:
the contracts for this ticket are stubs in their final locations, plus a prose contract under
`contracts/Q-0120/`.** Specifically:

1. `packages/shared/src/wire.ts` — the three interfaces moved, `wireMessageSchema` declared, the
   barrel line added. **Complete rather than stubbed**: it is declarations, and a declaration has
   nothing to implement.
2. `packages/server/src/wire.ts` — the type-only re-export, so `packages/server` typechecks against
   the moved interfaces. One import line and three names. **See GO-1: this file has no owner.**
3. `apps/web/src/` — the frame parser, the reducer, the refusal and missed renderers, and the
   socket-lifecycle hook, as stubs that **typecheck** and whose return types are the real ones, so
   AC-14's and AC-15's tests are *assertion* failures rather than unresolved imports. **The fake
   transport's interface is part of the contract**, because AC-17 and AC-18 are written against it.
4. `apps/web/src/` — the endpoint register (AC-13(d)) and the connection-state set (AC-15), as the
   **real tables**. A register stubbed empty makes every test that reads it vacuous.
5. `contracts/Q-0120/` — the prose contract naming the close-code precedence and the closed refusal
   set, so the reducer's completeness is reviewable against a document rather than against itself.

## 7. Task ownership, for `tasks.yaml`

`harness/architecture.md` requires that *"between them, a solution's tasks must own every file the red
suite requires changed — a file no task owns cannot be fixed by anyone, and the development loop will
spend its whole iteration budget discovering that."* Measured against the table at
`harness/architecture.md:26–30` and `solutioning.yaml:16`'s `role (frontend|backend|data)`:

| files | admissible fan-out role |
| --- | --- |
| `apps/web/**` — including its `package.json` and `vite.config.ts` | `frontend` (`apps/*`) — claude |
| `packages/shared/**` | `backend` (`packages/shared`) — codex |
| `docs/GLOSSARY.md`, `docs/04-architecture.md`, `harness/architecture.md` | `backend` (`docs`, `harness`) — codex |
| **`packages/server/src/wire.ts`** | **none** |
| **`pnpm-lock.yaml`** | **none** |

Three consequences the solution must honour. **The `apps/web` half and the `packages/shared` half are
two tasks on two vendors**, which is what makes this fan-out multi-vendor rather than merely parallel
— and this is the first ticket whose work is genuinely `frontend`'s, that role having been inert only
because `packages/ui` and `packages/i18n` do not exist while `apps/*` does. **`docs/` is not
`frontend`'s**, so AC-24 attaches to the backend task and not the app task. **And the last two rows
are GO-1**: they must be answered at this gate, not discovered by a refusing implementer.

## 8. Open questions

| | question | owner |
| --- | --- | --- |
| **OQ-1** | **BLOCKING.** Who writes `packages/server/src/wire.ts` and `pnpm-lock.yaml`, given that no admissible fan-out role may (§0.10, §0.11)? See **GO-1** for the three admissible answers and their costs. | **this ticket's gate, before `solutioning`** |
| OQ-2 | Where the three wire shapes live. **Ruled here: (B), `@quorum/shared`** — not on a recommendation but on §0.1's landed guard, which refuses (A) outright. Recorded as ruled so no implementer reopens it and no round is spent on it. | ruled here |
| OQ-3 | Whether a zero `missed` count renders. **Ruled here by measurement** (§0.12): the parser accepts it, the renderer shows nothing, and the reason is recorded beside the test. | ruled here |
| OQ-4 | Whether contracts are documents under `contracts/` or stubs in final locations. **Ruled here: both** (§6), because the second is what makes a red phase fail on assertions. | ruled here |
| OQ-5 | What the run route renders. **Ruled here** (AC-20): connection state, missed notice, event count, and the latest event's `type` and `stepId` — measurements, not fabrications — beside an unchanged placeholder. | ruled here |
| OQ-6 | Whether **Connection state** earns a glossary term, given that `RunState` has none. **Ruled here: yes** (AC-24), because it is user-facing, has an *unanswerable* member, and *state* is about to mean two things in one app — and because §0.8 measures the deterrent two tickets inherited to be pointed at the wrong file. | ruled here |
| OQ-7 | The dev-server proxy's default port **number**. The mechanism is ruled (AC-13(c)); the number is solutioning's, constrained to one literal in `vite.config.ts` with the comment beside it and no test reading the variable. Not blocking. | solutioning |

## 9. Risks

- **R-1 — nothing gives the browser a handle, so this is demonstrable only against one obtained out
  of band.** `/runs`'s placeholder says in as many words that *"the daemon reports no listing of its
  live runs"*. The acceptance path is: start a run with `POST /runs` by hand, read the handle, type
  `/runs/<handle>`. **Q-0121 removes that** and is `p2`; consider running it first or alongside. The
  criteria do not depend on it; the demo does.
- **R-2 — zod enters the browser bundle.** `packages/shared`'s `exports` is `"."` alone with no
  wildcard subpath (Q-0096), so importing the barrel reaches eleven modules and their schemas.
  `packages/shared/src/index.ts`'s own header anticipates and blesses this — *"apps/web will generate
  the flow editor's form from `flowSchema` … so this has to be safe to put in a browser bundle"* — so
  no ruling is owed. The **size** is unmeasured and cannot be measured here, this package having no
  `build` script (Q-0122's). Stated so nobody reads AC-21's no-new-package result as a statement
  about bundle size.
- **R-3 — the *no daemon* discriminator rests on an unverified assumption about the proxy.** AC-15
  discriminates on *did the socket reach open*. Through Vite's WebSocket proxy a target that refuses
  should destroy the client socket before the handshake completes, so `open` never fires and the
  browser reports 1006 with no reason. **That is reasoned, not measured** — the unit tests drive a
  fake transport and prove the reducer, not the browser. GO-3 measures it once.
- **R-4 — five runs and five gates.** The four tickets that have walked this route are Q-0006,
  Q-0011, Q-0033 and Q-0050, three of them M1's and the fourth the most expensive in the project at
  $131.03. Against Q-0014's $74.83 on the chore route, budget for materially more, and expect the
  cost to be in the *route* rather than in the code — which is what the gate ruled this ticket to
  find out.
- **R-5 — `development.yaml` fans out `by: role`, and the two halves cannot see each other until
  `integrate`.** The shared module is a contract emitted by solutioning precisely so they do not have
  to. If the solution instead has the `frontend` task *create* `packages/shared/src/wire.ts`, the two
  tasks share a file, which `harness/architecture.md` names as a sign the cut is wrong — and the
  frontend role may not write that path anyway.
- **R-6 — a test rendering components must be `.test.ts`, not `.test.tsx`.**
  `apps/web/test/package.test.ts:138–147` asserts every test file in the package ends `.test.ts`,
  because `testFilesIn` and `packages/core/turbo.json:74`'s `../../apps/*/**/*.test.ts` match that
  suffix only while Vitest would run a `.test.tsx` regardless — running, unseen and uncached.
  `src/shell.test.ts` uses `createElement` under a `// @vitest-environment jsdom` docblock; new tests
  follow it. **AC-14's, AC-15's and AC-16's subjects are pure functions and need no DOM**, which is
  why they are specified that way.
- **R-7 — `apps/web/src` is held to a rule no other package meets.** Q-0014 moved four test files out
  of `src/` so that zero files under it import `node:`, against 71 across `packages/`. Every new test
  that reads the filesystem belongs in `apps/web/test/`, and a scan written into `src/` would become
  its own subject.

## 10. Gate obligations

- **GO-1 — settle who owns `packages/server/src/wire.ts` and `pnpm-lock.yaml`, before `solutioning`
  runs.** A `tasks.yaml` that hands either to `backend` anyway produces the refusal this repository
  has recorded four times — *"A requirement may not name a surface its flow cannot write"*
  (2026-08-25) — except that this time it is found before the money rather than after. Three
  admissible answers, and the gate picks one:
  **(i) The re-export is a contract, emitted by `solutioning`'s `architect` step.**
  `harness/roles/principal-architect.md` declares no `paths:` and no allowed-path prose, and that step
  runs `worktree: true` on `harness/{id}/contracts`, which `merge-contracts` lands on the integration
  branch before `qa-red` and `development` branch from it. `wire.ts:4` already calls itself *"the
  contract Q-0014 codes against"*, so moving its declarations **is** the contract act. Nothing in the
  harness changes and no round is spent. *Cost:* if a later round needs that file changed, no task can
  change it — bounded, the file being three lines.
  **(ii) Grant `packages/server/` to `backend`.** Three edits — `harness/roles/developer-backend.md`'s
  frontmatter and its allowed-path sentence, and `harness/architecture.md`'s table row — which
  `role.test.ts` holds against each other, and none of which touches the template mirror
  (`packages/cli/templates/harness/roles/developer-backend.md` carries the generic
  `services/api, packages/domain` and is not byte-shared). **This is the human's to write at the
  gate**: a role editing its own grant inside the run that fans out by role is circular. It is also a
  repository-level fact worth having on its own merits — `packages/server` has existed since M3 opened
  and no fan-out role has ever been able to write it.
  **(iii) The human makes both edits at this gate**, as Q-0055's OQ-2 criteria and Q-0059's GO-3
  rulings were made, and the tasks own neither file.
  **The lockfile half is answered separately and may take a different answer**, because it is not a
  grant question: the cheapest form is that the human runs `pnpm install` and commits the lockfile at
  the gate, before `qa-red`, since it is generated rather than authored. **Do not launch `solutioning`
  with this open** — no step on that route can settle it, which is the pattern this plan has recorded
  fifteen times.
- **GO-2 — confirm OQ-7 at this gate**, so no implement round chooses a port nobody selected.
- **GO-3 — measure R-3 once against a real dev server**, with the daemon down and with it up, and
  record what the browser reported in both cases. The reducer's tests prove the mapping; only this
  proves the input. If `open` *does* fire before the proxy fails, AC-15's discriminator moves and the
  criterion is amended by erratum **at a gate** rather than reinterpreted mid-round.
- **GO-4 — verify AC-21's store claim by measurement rather than by reading the lockfile**, on
  Q-0014's GO-4 precedent: a manifests-only copy of the merge installed into an empty store, against
  the same for `main`. The expected delta is zero packages and zero bytes, and *expected* is the word
  that makes it worth measuring.
- **GO-5 — verify AC-22 on a tree with no `packages/shared/dist`**, since this machine has one and
  the criterion exists precisely because its absence is what breaks. `rm -rf packages/shared/dist`,
  then `pnpm --filter @quorum/web exec vite build` or a dev-server start, and record the result. A
  structural assertion is what ships; this is what proves the structure was the right one.
- **GO-6 — verify the merge forced in both environment rows**, per Q-0072's closing finding: in the
  integration worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`
  after the merge, with `pnpm lint`, `pnpm typecheck`, `quorum lint` and the git-identity sweep. The
  codex candidate made this a criterion (its AC-20); it is a gate obligation here, because a suite
  passing is a property of every ticket rather than behaviour a red test can fail on.

## 11. Observations

True, worth recording, and **not claims about this change** — the `observation:` channel *"A finding
is a claim about the change; anything else is an observation"* (2026-09-11) opened. Reported and
deliberately not fixed here.

- **`observation:` `harness/flows/review.yaml`'s `verdict` instruction is spliced mid-sentence, and
  it is the flow this ticket's own review stage runs.** Q-0117's paragraph was inserted between
  *"on changes-requested there must be at least one"* and *"finding. Judge the reviews, not the code
  diff."*, so the step now reads *"…there must be at least one Anything TRUE and worth recording that
  is NOT a claim about this change — … See the 2026-09-11 decision entry. finding."*
  `harness/flows/chore.yaml` is **correct** — there the paragraph was appended after a complete
  sentence — and the mangled clause is exactly the one that makes `changes-requested` require a
  finding. Not this ticket's surface: no criterion here names `harness/flows/`, and it wants a
  one-line fix by hand in the shipped file, its template mirror and `docs/02-sdlc-pipeline-spec.md`
  §5, **before this ticket reaches `review`**.
- **`observation:` `solutioning.yaml` and `harness/architecture.md` disagree about which roles can
  receive a task.** The flow's architect instruction says *"role (frontend|backend|data)"*;
  `harness/architecture.md:40` says *"`backend` and `tooling` are the two live **fan-out** roles"*.
  `tooling` — `packages/core`, `packages/shared`, `packages/cli`, claude — cannot be given a task by
  an architect obeying the flow it is run under. Both files are fed to that step on every run. It did
  not bite this ticket because `backend` covers `packages/shared` too, but it narrows every solution's
  choice of seam silently, and it is why §7's table lists three roles rather than four.
- **`observation:` `AppOptions.upgrade` (`packages/server/src/http.ts:26–35`) is passed by nothing.**
  `serve()` calls `createApp({ host })` and then registers `/runs/:id/events` on the returned app
  itself, and no test supplies the option. So `createApp` alone has no events route and the WebSocket
  handler has exactly one caller. Not a defect and not this ticket's — recorded because a later ticket
  wanting to drive the socket without binding a port will look for that seam and find it unused rather
  than unbuilt.
- **`observation:` implement steps have written `pnpm-lock.yaml` on six tickets while no role grants
  it.** Q-0043, Q-0045, Q-0090, Q-0098, Q-0013 and Q-0014 (twice). `paths` is advisory and
  enforcement is role prose, so the chore route has been getting away with a write its own role text
  forbids. §0.10 is the first time it reaches a route where the prose is stricter; whether the grant
  should be widened or the practice stopped is a repository question larger than this ticket.

## 12. Provenance

**The claude candidate is the base**, and the reason is its §0: eight measurements against the tree
rather than a transcription of Q-0014's Appendix A. Seven reproduced exactly and are carried — the
landed guard that rules OQ-2 (§0.1), the two `apps/web` registers (§0.4), the whole-package URL scan
and Vite's object proxy target (§0.5), the absent daemon port (§0.6), the same-origin narrowing of
*no daemon* (§0.7), the two-suite turbo audit (§0.14), and the `CLAUDE.md`/glossary split (§0.8). Its
§6 (contracts as stubs in final locations), §7 (task ownership), AC-20 (retiring
`CONNECTION_PENDING` by replacement while keeping Q-0014's socket guard with a subject), AC-21 and
AC-23 are carried largely as written. **One of its eight did not reproduce** and is corrected in
§0.8: the glossary term count. Its GO-1 named one unowned surface; §0.10 found a second.

**The codex candidate contributed the two things the base lacked.** Its AC-15 declares an explicit
**close-code precedence order** — 1008, then 1013, then terminal-plus-normal-close, then everything
else, with failure-before-`open` split off — which is what makes the reducer reviewable for
completeness rather than merely enumerable; AC-15 takes it verbatim in substance. Its AC-14 drives a
**harder parser table**, adding a `missed` count that is a string, fractional or non-finite, and its
AC-13 adds the **handle-encoding cases** (`/`, `?`, `#`, a space); AC-14 and AC-13(a) take both. Its
AC-17's *"repeated cleanup is safe"* and AC-18's *"repeated Retry cannot leave concurrent sockets"*
are carried. Its OQ-2 on the zero count is carried as a question and answered by measurement (§0.12).
Its AC-20 (install, test, lint, typecheck) is **not** a criterion here — it is a property of every
ticket rather than behaviour a red test can fail on — and moved to GO-6.

**Where they disagreed, the base won on evidence rather than on preference.** Both recommended
option (B) for the wire shapes; only one gave a landed check that refuses (A). Only one saw that
`apps/web` must gain a dependency at all, that the proxy target collides with an existing scan, and
that the daemon has no default port for a "documented default" to mirror.

**Four things are neither candidate's.** §0.3 (`WireTicket` is a fourth wire shape and stays),
§0.9 and AC-22 (the browser resolves `@quorum/shared` through Vite's *client* conditions, which
nothing sets — green under Vitest, broken on a fresh clone), §0.10 (`pnpm install --frozen-lockfile`
makes the lockfile move with the manifest, and no role owns it), and §0.13's second blindness (the
route scan's corpus is not only `.tsx`-only but non-recursive).

**Size.** Thirteen criteria, from the base's fourteen and the codex candidate's nine. Its AC-25 (BYOS
and no-network) was folded into AC-13's network clause, AC-21's package clause and §5, because the
scans it names walk the whole package and cover new files without moving; its AC-23 (the glossary
term) was folded into AC-24, so the term still lands and does not spend a criterion on itself. Two
criteria were added (AC-22, and the lockfile half of AC-21). Thirteen sits under the fifteen that
split Q-0013 at eighteen and Q-0096 at twenty-one, and the judgement is that this ticket does **not**
want splitting: the parser, the reducer, the renderers and the socket lifecycle are one behaviour
observed from four angles, and a cut between them would put the fake transport in one ticket and
every test that drives it in another.
