# Q-0120 — The web app holds a live connection to the daemon

*Requirements, run 1, candidate: claude. Written 2026-09-11 against the tree at `082b0e4`, not
transcribed from Q-0014's Appendix A — §0 is the difference, and eight of its entries would each
have cost a round.*

**Surfaces:** `apps/web` (the browser source and its dev server), `packages/shared` (the wire
shapes and their parser), `packages/server` (a type-only re-export, and nothing else),
`docs/GLOSSARY.md` and `docs/04-architecture.md`. **Not** the CLI, not `core`, not `backlog/`.

**Route:** the full pipeline — `solutioning` → `qa-red` → `development` → `review` — ruled at
Q-0014's gate. This document is written for that route: §6 says what contracts solutioning owes,
§7 maps every file to a task owner, and **GO-1 is a blocking gate obligation** because the fan-out
role table as it stands cannot own one of them.

---

## 0. What was measured, and what it changes

Eight things. Each is a claim in Appendix A or an assumption behind it, checked against the tree.

**§0.1 — The blocking question is already answered by a landed guard, and the answer is (B).**
Appendix A offers two homes for the three wire shapes and recommends (B). It is not a preference:
`packages/server/src/package.test.ts:138` asserts

```
expect(own.exports).toBe(undefined);
expect(own.main).toBe(undefined);
expect(own.types).toBe(undefined);
```

under the comment *"The local distribution set is three packages and this ticket does not make it
four."* Option (A) — give `@quorum/server` an export surface — turns that red and moves
`packages/cli/src/build.test.ts`'s per-package emit register with it. Option (B) touches neither.
Ruled in AC-12; the argument is closed and an implementer may not reopen it.

**§0.2 — `apps/web` must gain a dependency, and an existing guard pins the set exactly.**
`apps/web/package.json` declares `react` and `react-dom` and no workspace package at all.
`apps/web/test/package.test.ts:97`:

```
expect(Object.keys(own.dependencies ?? {}).sort()).toStrictEqual(['react', 'react-dom']);
```

and `:88` requires `JUSTIFICATIONS`'s keys to equal the declared set in **both** directions. So
AC-12 and AC-14 cannot be satisfied without moving two registers. They move **with their claim
intact** — the division `:94` asserts is *what a bundle contains against what only builds or tests
it*, and `@quorum/shared` is on the bundle side, because AC-14 needs the schema **executed in a
browser**. AC-21.

**§0.3 — AC-13's URL literals collide with Q-0014's own network scan, and the collision is
avoidable rather than exemptable.** `apps/web/test/source.test.ts:255` walks **every file in the
package** — `index.html` and `package.json` are asserted to be in the walk at `:265` — and forbids
`http://`, `https://` and `//fonts.` with **no exemption for anything**. A proxy target written
`'http://127.0.0.1:4317'` fails it. Appendix A's remedy is *"a source scan for the forbidden
literals with `vite.config.ts` the one exemption"*, which addresses AC-13's own new scan and says
nothing about Q-0014's. Measured against the installed types instead: `vite@8.2.2`'s
`ProxyTargetUrl` (`node_modules/vite/dist/node/index.d.ts:365`) is
`URL | string | { port: number; host: string; protocol?: string }`, so the target can be an object
and **no URL literal is written anywhere**. That satisfies both scans and creates no exemption.
AC-13 is rewritten accordingly: an exemption is forbidden rather than granted, because an exemption
in the scan that forbids network literals is the narrowing Q-0014's round 2 already paid for once.

**§0.4 — There is no default daemon port, so "a documented default" had no subject.**
`serve({ host, port = 0 })` and `createDaemon({ project, port = 0, … })` both ask the operating
system for a free port, and a search over `packages/server/src`, `packages/cli/src` and
`docs/04-architecture.md` finds no port constant, no `DEFAULT_PORT`, and no `quorum open`
implementation — that command is named in `04-architecture.md:165` and in M3's done-when and does
not exist. So the number a dev-server proxy points at is **a convention of the dev server**, not a
fact about the daemon, and AC-13 must say so in the file rather than imply a product default that
does not exist. Choosing the daemon's own port belongs with `quorum open`; inventing one here would
put a second authority for it in a Vite config. AC-13(c).

**§0.5 — Same-origin means the client has no daemon address to name.** AC-15 asks that **no
daemon** *"names the address the client tried"*. Under AC-13 the address the client tried is the
**page's own origin** plus a path; the proxy target is the dev server's and the browser never sees
it. A client that printed `127.0.0.1:<port>` would be asserting something it does not hold — the
failure `quorum board` refuses when it declines to render a containment token git could not
produce. Narrowed in AC-15 to the URL the client actually requested, which is the honest and the
useful thing: it is what a reader pastes into a terminal to check.

**§0.6 — The daemon's endpoint paths must not enter `ROUTES`, and the existing scan cannot see
them.** `apps/web/test/routes.test.ts:167` refuses any route-path literal a component carries that
the register does not hold — over `.tsx` files under `src/` only (`:26`). Two consequences. First,
`/runs/:handle/events` **may not be added to `ROUTES`**: the router matches `ROUTES`
(`src/router.ts:75`), so the shell would navigate to a WebSocket URL and draw a placeholder at it.
Second, writing the socket path in a `.ts` module puts it outside the scan — which is dodging a
guard by file extension, the same shape as the *"shipping files"* narrowing Q-0014's round 2
caught. So the shell's **routes** and the daemon's **endpoints** are two registers, the scan is
widened to `.ts`, and it excuses exactly what the second register holds. AC-13(d), and it buys
something Appendix A leaves open: the proxy list and the paths the client requests come from one
place, so they cannot drift.

**§0.7 — AC-12's cross-package assertion must be split, or it escapes a package nothing audits.**
`packages/core/src/turbo-inputs.test.ts:151` audits exactly two suites — `packages/shared` and
`packages/core` — and `apps/web` has **no `turbo.json`**. So an `apps/web` test reading
`packages/server/src/wire.ts` would be refused by no clause **and** covered by no declared input: a
cached `@quorum/web#test` pass could stand over an edited `wire.ts`. Reading `packages/shared` is
different and is already solved — `MANIFEST`'s own comment says *"`core`'s reads of
`packages/shared` are deliberately absent, because AC-4 covers those with the dependency edge"*,
and the `test` task's `dependsOn: ["^test"]` gives `apps/web` that edge the moment it declares the
dependency. AC-12 therefore asserts each half **inside the package it is about**, and adds no
`turbo.json` and no dependency on `@quorum/server`.

**§0.8 — A glossary term is addable, and the reason two tickets believed otherwise is measurable.**
Q-0013's and Q-0014's status-line entries both record *"No glossary term was added and none is
owed … minting a term means `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to
write."* That conflates two lists. `docs/GLOSSARY.md` holds **33** terms;
`CLAUDE.md`'s *"use exactly these terms"* parenthetical holds **22**, and
`packages/shared/src/docs.test.ts:639` compares it only with `docs/README.md`'s copy of the same
22. Eleven glossary terms are absent from it — **Confinement** (Q-0059), **Run lock** (Q-0039),
**Undecided**, **Event**, **Run history**, **Fan-out step**, **Human-locked gate**, **Quorum**,
**Agent-agnostic**, **Canonical harness**, **Template library** — so adding a glossary entry is a
`docs/GLOSSARY.md` edit alone, and only adding a term to the *rule* touches `CLAUDE.md`. Q-0059 is
the precedent: it added **Confinement** to the glossary and not to the list, in the same change,
through the flows. AC-23, with the explicit instruction not to touch `CLAUDE.md`.

---

## 1. Problem

The `maintainer` starts a run and the browser cannot watch it. Q-0118 shipped
`GET /runs/:id/events` — one event per message, an envelope telling a late subscriber how many
events it missed, a 1008 close for a handle nothing holds, a 1013 close for a subscriber that fell
behind — and Q-0119 shipped five read routes. **Nothing consumes any of it.** `apps/web` opens no
socket, and `src/shell.test.ts:83` installs a throwing `globalThis.WebSocket` to prove it: *"the
shell must not open a socket"*. The top bar's connection region reads
`no live connection yet — Q-0120 opens one` (`src/shell.tsx:39`).

So `DEFAULT_RETENTION`, `MAX_BUFFERED_BYTES`, the 1013 close and the 1008 close are behaviour no
test outside `packages/server` has ever exercised, and the three shapes Q-0118 built for this app
**cannot be imported by name** — `packages/server` declares no `exports`, no `main` and no `types`,
which its own suite pins as correct. Meanwhile `packages/server/src/wire.ts:4` calls itself *"the
contract Q-0014 codes against"*. An implementer who obeys that sentence finds it unresolvable and
copies the three interfaces into `apps/web`: **the drift arrived at by obeying the sentence
forbidding it.**

For the `adopter` the failure is worse than absence. With no connection state, a daemon that is
not running and a handle that does not exist look identical — a screen that shows nothing. Those
are *"start the daemon"* and *"that handle is wrong"*, and a product that cannot tell them apart
has made silence stand in for both answers, which is what this repository refuses in `quorum
board`'s containment token, in its push-lag line, and in a verified-version state.

## 2. User stories

- **`maintainer`** — *I open a run's URL in the browser and see its events arrive live, and when
  the connection is not live I am told which of the seven ways it is not, in a sentence I can act
  on. If I joined late I am told how many events I missed rather than shown a stream that looks
  complete.*
- **`adopter`** — *I run the dev server before I have a daemon, and the app tells me the daemon is
  not answering and names the URL it asked for, instead of drawing an empty panel. Nothing is left
  in my browser when I close the tab.*
- **`contributor`** — *I read one definition of what crosses the wire, in the one package that is
  safe to bundle for a browser, and I can see from `packages/server`'s own source that it is the
  same definition the daemon serialises.*

## 3. Non-goals

1. **Mission control itself** — trace columns, cost tickers, the step timeline. Q-0015. This
   ticket renders arriving events in whatever minimal, unfabricated form the run route already
   permits, and adds no screen.
2. **Starting, answering or stopping a run from the browser.** `POST /runs`,
   `POST /runs/:id/gate` and `POST /runs/:id/stop` stay unreached; `RUN_FLOW_LABEL`'s button stays
   disabled. A control that appears to mutate something is the fabrication Q-0014 refused.
3. **Listing the daemon's live runs.** Q-0121. A handle reaches this app through its URL only, and
   §9 R-1 records what that costs.
4. **A `build` script, a bundle, a static route, and the emitted-artifact ruling.** Q-0122. This
   ticket keeps the emitting set at three and `test/package.test.ts:191` asserts it.
5. **Automatic reconnection, a resume cursor, and event replay by sequence number.** AC-18 refuses
   the first with its reason; the other two would widen `WireMessage` and are nobody's yet.
6. **CORS, a configurable bind, and authentication.** `BIND_HOSTNAME` does not move, and
   `packages/server` gains no middleware, header or dependency. AC-13(e).
7. **Client-side persistence of any kind**, including a "last run" convenience. AC-19.
8. **Widening the gate-answer envelope** — *"override with reason"* is corrected in two documents
   already and a control reintroducing it would reinstate what `gateAnswerEnvelopeSchema` refuses.
9. **Changing `eventSchema`, `WireMessage`'s vocabulary, or the close codes Q-0118 chose.** This is
   a consumer. A frame shape it cannot parse is a finding against this ticket, not a licence to
   edit the producer.
10. **A `turbo.json` for `apps/web`, and a dependency on `@quorum/server`.** §0.7; AC-12's *Test:*
    clause is bounded so neither is needed.

## 4. Acceptance criteria

Numbered from 12, continuing Q-0014's, so a criterion keeps its name now that the cut has moved
(Q-0106's convention). Fourteen, against the fifteen that split Q-0013 at eighteen and Q-0096 at
twenty-one.

---

**AC-12 — the three wire shapes have exactly one definition, and it is reachable from a browser
bundle.**

`WireRefusal`, `WireRun` and `WireMessage` are declared in **`packages/shared/src/wire.ts`**, a new
flat module, with a runtime `wireMessageSchema` beside them. `packages/server/src/wire.ts`
re-exports the three as types, so the runtime surface of `@quorum/server` is unchanged and
`packages/server/src/index.test.ts`'s `SURFACE` register does not move. `packages/server`'s
manifest gains no `exports`, `main`, `types`, `files` or `bin`. No interface, type alias or object
literal in `apps/web` restates any of their fields.

***Test:*** three assertions, **each inside the package it is about**, because a scan that left
`apps/web` would be covered by no declared input and refused by no clause (§0.7).
(a) In `apps/web`: a scan over every file under `src/` reporting any *declaration* of `condition`,
`remedy`, `handle`, `runId` or `count` — a `:` binding in an `interface`, `type` or object literal
— while permitting every expression-position use, shown to have a subject by reporting a violation
over a fixture that re-declares `WireRun`; plus an assertion that at least one file under `src/`
imports the shared package.
(b) In `packages/server`: `wire.ts`'s import specifiers include the shared package and the three
names are re-exported from it, asserted over the file's own text, with the barrel's runtime surface
asserted unchanged by the existing register.
(c) In `packages/shared`: the schema is on the barrel and `index.ts` still holds nothing but
one-line re-exports, which `src/index.test.ts:131`'s
`/^export \* from '\.\/[a-z-]+\.js';$/` already enforces.

---

**AC-13 — the client reaches the daemon same-origin, the endpoint paths are a register, and the
dev server is what bridges them.**

(a) **Same-origin.** Every request and the WebSocket upgrade use a path relative to the page's own
origin. No absolute URL, hostname, port, `ws:` or `wss:` literal appears anywhere under
`apps/web/src`. A socket URL derives its scheme from the page's — `ws:` for `http:`, `wss:` for
`https:` — and carries the handle as **one** path segment, percent-encoded.

(b) **No URL literal anywhere in the package, and no exemption.** `apps/web/vite.config.ts`'s proxy
target is an **object** — `{ host, port }` — and not a URL string, so Q-0014's AC-10 scan over every
file in the package keeps forbidding `http://` and `https://` with no file excused (§0.3). Adding an
exemption to that scan is a failure of this criterion.

(c) **The port is configuration, and its default is the dev server's convention, stated as such.**
The target port is read from the environment with a documented default, and the comment beside it
says that the daemon has **no default port** — `serve` and `createDaemon` both ask the operating
system for a free one — and that choosing the daemon's is `quorum open`'s. **No test reads the
variable**, so the `test` task's `env` allow-list does not move.

(d) **One register for the daemon's endpoints, separate from the shell's routes.** The five paths
the proxy forwards and the paths the client requests come from one exported table, which
`vite.config.ts` imports. `ROUTES` is **not** extended: `src/router.ts` matches it, so an entry for
the events endpoint would make the shell navigate to a WebSocket URL. `test/routes.test.ts`'s
component scan is widened from `.tsx` to every file under `src/` and excuses exactly the literals
the endpoint register holds — a path in a `.ts` module being invisible to it today is a narrowing,
not a permission (§0.6).

(e) **Nothing is added to the daemon.** No CORS middleware, header or dependency reaches
`packages/server`, and `BIND_HOSTNAME` does not move — adding CORS to an unauthenticated loopback
process that starts agent runs widens exactly what that constant's JSDoc refuses to widen.

***Test:*** a scan over `apps/web/src` for the forbidden literals, with the positive control that
the scan finds source at all; a scan over `apps/web` asserting no file carries a URL literal, which
is Q-0014's existing clause re-run rather than replaced, plus an assertion that it grants no
exemption; a comparison asserting the proxy's forwarded prefixes and the client's request paths are
the same set, taken from the register in both cases rather than written down twice; and a read of
`packages/server/src/*.ts` and its manifest asserting neither gained the string `cors`. **The
proxy's own runtime behaviour is not claimed** — it is an integration concern, and the bound is that
the source is same-origin, which is what makes the eventually-served bundle work unchanged.

---

**AC-14 — a frame is parsed, never cast, and every refusal is distinguishable.**

One pure function turns one received message into either a parsed frame or a refusal drawn from a
**closed set**. An `event` frame's payload goes through `@quorum/shared`'s `eventSchema`. A `missed`
frame's `count` must be a **non-negative integer**, not merely a number: rendering *"you missed -3
events"* is a silent default wearing a different hat. Anything else — an unknown `type`, an event
that fails the schema, a non-object, a non-text message — is refused and surfaced. The function
**never throws**; a `JSON.parse` failure is one of its refusals.

***Test:*** the parser driven with (a) a valid event frame, (b) a valid `missed` frame, (c) an
unknown `type`, (d) an event that fails `eventSchema`, (e) a non-object, (f) a non-text message,
(g) text that is not JSON, and (h) `count: -1`; each of (c) to (h) produces a **distinguishable**
refusal asserted **by value**, because a single catch-all satisfies a weaker assertion while
telling the user the same wrong thing six times. Driven directly, with no DOM and no socket.

---

**AC-15 — the connection has a named state for every case, and none of them is silence.**

A pure reducer over a closed set, at minimum: **idle** (no run is open — every route but the run
route), **connecting**, **live**, **no daemon** (the socket never opened), **no such run** (the
daemon answered and closed 1008), **ended** (a `terminal` event, then a normal close),
**interrupted** (a close before any `terminal` event, carrying the close code and the reason text
the browser supplied), **dropped** (1013 — this subscriber fell behind), and **protocol error**
(AC-14). Each renders in the top bar's connection region in plain language.

**The discriminator between the two load-bearing states is named rather than left to be
rediscovered**: *no daemon* is *the socket never reached open*, and *no such run* is *it opened and
then closed 1008*. **No daemon** names **the URL the client requested** — the page's own origin and
the path — and never an address it does not hold, because same-origin means it has none (§0.5).

***Test:*** the reducer driven over every transition and asserted **by value**; *no daemon* and *no
such run* asserted to produce different states **and** different user-facing strings, which is the
clause a single catch-all fails; *ended* asserted to require a `terminal` event and not a close code
alone, and a normal close with no terminal event asserted to be *interrupted*. Driven directly, with
no DOM.

---

**AC-16 — a `missed` count is reported, and a refusal renders what it carries.**

A `missed` frame is surfaced with its count, never dropped and never emitted as an event. A refusal
body renders from its `condition` — `core`'s or the daemon's own sentence, unaltered — and its
`remedy` where one is present; a `code` this client does not recognise **still renders its
condition** rather than being replaced by a generic message, which is `startRefusalCode`'s own
discipline read from the other end. No ANSI escape, colour code or vendor branching is introduced
into anything that crosses the wire.

***Test:*** the renderer driven with a known code carrying a remedy, a known code with
`remedy: null`, and an **invented** code, asserting the exact `condition` string appears in all
three and that the unknown code suppressed nothing; the missed notice driven with `count: 7` and
required to surface the number, and with `count: 0` and required to render no notice — **with the
reason recorded beside it** that the daemon never sends a zero (`missedMessage` returns `null` for
`count <= 0`), so the zero case is the parser's defence and not evidence about the wire.

---

**AC-17 — one socket at a time, and leaving closes it.**

Leaving the run route, changing the handle, or unmounting closes the active socket and prevents its
callbacks from changing anything afterwards. **The socket constructor is injectable**, because a
throwing global — which is the instrument Q-0014 installed at `src/shell.test.ts:83` — can prove a
socket was *not* opened and cannot drive `onmessage`, `onclose` or `onerror`.

***Test:*** driven against a fake transport that records construction, sends and closes: a handle
change closes the first and constructs **exactly one** replacement; a late callback from the closed
socket changes no state; unmount closes. Asserted over **the transport's own close record**, never
over "the run still exists", which is true whether or not anything was released — the shape
Q-0118's round 2 caught.

---

**AC-18 — retry is explicit, and retrying preserves what arrived.**

An interrupted, refused, dropped or errored connection offers a Retry action. **The client does not
reconnect automatically**: without a resume cursor an automatic reconnection either duplicates
events or hides a missed prefix, and Q-0118's `missed` envelope exists precisely so a gap is
reported rather than smoothed over. Retry closes any previous socket, constructs exactly one
replacement, and clears neither the events already accepted nor the incomplete-replay notice.

***Test:*** over the fake transport — no socket is constructed without an explicit retry after a
terminal state, exactly one replacement is constructed, and both the prior events and the missed
notice survive it.

---

**AC-19 — nothing is persisted in the browser.**

Events, the incomplete-replay notice, the connection state and the run handle are held in memory
only. `04-architecture.md:183` permits *"no client-side persistence beyond UI preferences"*, and a
run handle is not a preference.

***Test:*** a scan over every file under `apps/web/src` for `localStorage`, `sessionStorage`,
`indexedDB`, `document.cookie` and `caches`, shown to have a subject by reporting a violation over
a fixture that uses one, with the positive control that the scan finds source at all. The existing
`history.pushState` use is named as not persistence, so the clause is not read as forbidding it.

---

**AC-20 — the shell's connection region says what is true of the route it is on, and a non-run
route still opens no socket.**

`CONNECTION_PENDING` is **retired by replacement, not deleted**: the region now renders the AC-15
state, and on every route but the run route that state is **idle** and says so — the top bar is
global and the socket is the run route's. Q-0014's *"the shell must not open a socket"* guard is
**kept, unchanged, and shown still to have a subject**: it mounts `/projects`, and after this
ticket `/projects` still constructs no socket and performs no fetch.

***Test:*** the existing guard re-run at `RAIL[0].path` with the throwing `WebSocket` and `fetch`
globals still in place and still asserting `reached === []`; a second mounting of the run route
asserted to construct **exactly one** socket through the injected transport; and an assertion that
no file under `src/` carries the retired sentence, so the replacement cannot sit beside the thing it
replaced.

---

**AC-21 — the manifest declares the new dependency, its two registers move with their claim
intact, and the cold-clone install does not grow.**

`@quorum/shared` is a `dependencies` entry of `apps/web` (`workspace:*`), because AC-14 executes its
schema **in the browser**, which is the division `test/package.test.ts:94` asserts. `JUSTIFICATIONS`
gains its line. **No new package enters the pnpm store**: `@quorum/shared` is a workspace link and
its only runtime dependency is `zod`, already in `pnpm-lock.yaml`, so the cold-store figures Q-0014
measured — 203 packages, 179 MB, 10.4 s — do not move.

***Test:*** the dependency register asserted as the new exact set with `@quorum/shared` on the
bundle side, the justification register asserted against the manifest in both directions as it is
today, and a value from the new dependency asserted to resolve under the workspace source condition
— the shape `packages/server/src/package.test.ts:158` already uses. The store claim is **verified at
the gate rather than asserted by a test** (GO-4), because it is a measurement about an install and a
test asserting it would be reading a lockfile to predict a download.

---

**AC-22 — `packages/shared`'s house rules hold over the new module.**

`src/` stays flat and the new file is one module named in lower case with hyphens, which
`index.test.ts:131`'s regex requires of its barrel line. The literal `@quorum/` appears in **no file
under `packages/shared/src`, tests included** — so `WireMessage`'s JSDoc, which today reads
*"`event` is `@quorum/shared`'s `Event` unaltered"*, is reworded, and any needle a new test uses is
assembled at run time. Every import specifier under `src/` is `./…` or `zod`. The module reaches for
no filesystem, process or environment.

***Test:*** the four existing clauses of `src/index.test.ts` re-run over the enlarged corpus —
they already read the directory rather than a file list, so they cover the new module without
anyone remembering — plus the barrel-surface register gaining the schema's name.

---

**AC-23 — the glossary gains one term, and `CLAUDE.md` is not touched.**

`docs/GLOSSARY.md` gains **Connection state**: the closed set AC-15 names, derived per moment and
never stored, rendered in plain language, with the rule that no member of it is silence and the
statement of what it is **not** — not a **run state**, which is `packages/server`'s
`refused | running | ended` and is a fact about the *run*; the two are near-homographs for unrelated
questions and neither is ever used for the other, which is the discipline **Containment** and
**Confinement** already carry.

**`CLAUDE.md`'s and `docs/README.md`'s *"use exactly these terms"* lists are NOT edited.** Those are
a curated 22 of the glossary's 33, and eleven terms — **Confinement**, **Run lock**, **Undecided**,
**Event**, **Run history** among them — are glossary entries absent from them (§0.8). `CLAUDE.md` is
the human's to write under Q-0103 erratum E-2, and this criterion does not name it: **an
implementer that edits it has failed this criterion, not satisfied it.**

***Test:*** the glossary term asserted present with its closed set, its never-silence rule and its
*not a run state* clause — the shape `docs.test.ts` already uses for **Verified version** and
**Push lag** — and, in the same file, an assertion that the two 22-term lists are **byte-identical
to what they hold today**, so this change cannot move them. Q-0067's sequencing lesson does not
apply here precisely because the lists do not move.

---

**AC-24 — the two documents that describe this absence describe what shipped.**

`docs/04-architecture.md` §`apps/web` says *"There is no connection to the daemon — the frame
parser, the connection states and the socket lifecycle are Q-0120's, and the top bar reserves the
region they fill"*, which this change makes false; §`packages/server` gains the one sentence that
the wire shapes are declared in `shared` and re-exported here, and why. The status line gains its
dated entry. **Where a fan-out `frontend` task lands work, `harness/architecture.md`'s
*"`frontend` and `data` remain inert"* is corrected in the same change** — that file is fed to the
architect on every run, so a stale sentence there is one every future solution inherits.

***Test:*** each claim asserted against the shipped document by the mechanism `docs.test.ts`
already uses, including that the retired sentences are **gone** rather than merely joined by new
ones; the status line asserted to carry `Q-0120` and the landing date; and, if the role table moved,
`packages/shared/src/role.test.ts` re-run — it parses the third column as a path list and asserts it
equals the role's `paths` frontmatter **and** that the role's prose names every directory it is
granted, so a partial edit is red.

---

**AC-25 — BYOS and the no-network property survive the change.**

No file in `apps/web` names a credential literal, and the existing scan keeps its subject. Nothing
this ticket adds fetches anything from off the machine: the only network the app touches is its own
origin, which the dev server forwards to loopback. The browser holds no credential, because what
authenticates an agent is a subscription the vendor's own CLI already owns.

***Test:*** `test/package.test.ts`'s credential scan and its discriminating fixture re-run over the
enlarged package, and the AC-13(b) whole-package URL scan, which is the same clause from the other
side.

---

## 5. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-25. No key on any path, in any fixture, in any sentence. The proxy target is a host and a port and carries no credential. |
| **Worktree safety** | n/a to the code; the flow's own concern. Nothing here writes outside a worktree, and no criterion names `backlog/`. |
| **Gate behaviour** | Untouched. `gateAnswerEnvelopeSchema` is not widened, no gate control is added, and *"override with reason"* is a non-goal. |
| **File format and schema** | One new schema in `packages/shared`, over a shape `packages/server` already declares. `eventSchema` is **consumed** and not changed. No persisted format moves; nothing is written to `.quorum/`, `harness/` or `backlog/`. |
| **Lint rules** | `eslint.config.js` already covers `apps/**/*.ts` and `apps/**/*.tsx` since Q-0014. No flow-lint rule is added. No deprecated API is introduced. |
| **Cold-clone impact** | AC-21: **no new package enters the store**, so the first thirty minutes do not grow. The dev server gains a proxy, which is one fewer thing an adopter has to configure. |
| **Product-agnostic** | Nothing here names a SaaS product. The mockup's three fake project names stay refused by Q-0014's AC-9 scan. |

## 6. Contracts solutioning owes

The `qa-red` flow requires tests that **compile and fail on assertions, not on missing symbols**.
For a TypeScript app that means the contracts are **stubs in their final locations**, not documents
under `contracts/` alone:

1. `packages/shared/src/wire.ts` — the three interfaces moved, `wireMessageSchema` declared, and
   the barrel line. Complete, not stubbed: it is declarations, and a declaration has nothing to
   implement.
2. `packages/server/src/wire.ts` — the type-only re-export, so `packages/server` typechecks against
   the moved interfaces. **One import line and three names.** See GO-1.
3. `apps/web/src/` — the frame parser, the reducer, the refusal and missed renderers, and the
   socket-lifecycle hook, as stubs that **typecheck** and whose return types are the real ones, so
   AC-14's and AC-15's tests are *assertion* failures rather than unresolved imports. The fake
   transport's interface is part of the contract, because AC-17 and AC-18 are written against it.
4. `apps/web/src/` — the endpoint register (AC-13(d)) and the connection-state register (AC-15), as
   the real tables. A register stubbed empty makes every test that reads it vacuous.
5. `contracts/Q-0120/` — the prose contract naming the close-code-to-state mapping and the closed
   refusal set, so the reducer's completeness is reviewable against a document rather than against
   itself.

A contract document that describes these without creating the modules leaves the red phase failing
on missing symbols, which `prove-red`'s `scenario-review` step is written to reject.

## 7. Task ownership, for `tasks.yaml`

`harness/architecture.md` requires that *"between them, a solution's tasks must own every file the
red suite requires changed — a file no task owns cannot be fixed by anyone, and the development loop
will spend its whole iteration budget discovering that."* Measured against the table at
`harness/architecture.md:25–31`:

| files | fan-out role that may write them |
| --- | --- |
| `apps/web/**` | `frontend` (`apps/*`) — claude |
| `packages/shared/**` | `backend` (`packages/shared/`) — codex; also `tooling` |
| `docs/GLOSSARY.md`, `docs/04-architecture.md`, `harness/architecture.md` | `backend` (`docs/`, `harness/`) — codex |
| **`packages/server/src/wire.ts`** | **none** |

Two consequences the solution must honour. **The `apps/web` half and the `packages/shared` half are
two tasks on two vendors**, which is what makes this fan-out multi-vendor rather than merely
parallel — and this is the first ticket in the repository whose work is genuinely `frontend`'s, that
role having been inert only because `packages/ui` and `packages/i18n` do not exist while `apps/*`
does. **And `docs/` is not `frontend`'s**, so the documentation criteria are `backend`'s and must not
be attached to the app task.

## 8. Open questions

| | question | owner |
| --- | --- | --- |
| **OQ-1** | **Blocking.** Where the three wire shapes live. **Ruled in this document: (B), `@quorum/shared`** — not on the recommendation but on §0.1's landed guard, which refuses (A) outright. Recorded as ruled so no implementer reopens it and no round is spent on it. | ruled here |
| **OQ-2** | **Blocking.** Who writes the two-line `packages/server/src/wire.ts` re-export, given that no fan-out role may. See **GO-1**. | this ticket's gate, before `solutioning` |
| **OQ-3** | The dev-server proxy's default port number. Recommended: choose one here, document it in `vite.config.ts` as the dev server's convention, and state that the daemon has none — §0.4. The alternative, requiring the variable with no default, makes the dev server fail until configured, which is honest and worse for the `adopter`'s first thirty minutes. | this ticket's gate |
| **OQ-4** | Whether the run route renders arriving events at all, or only the connection state and the missed notice. Recommended: the minimum that proves events arrive — a count and the most recent event's `type` and `stepId` — because a test that asserts a socket delivered something must be able to see it, and anything more is Q-0015's screen. | this ticket's gate |
| **OQ-5** | Whether **Connection state** is worth a glossary term at all, given that `RunState` is not one. Recommended yes, and AC-23 carries the argument: it is user-facing, it has an *unanswerable* member, and *state* is about to mean two different things in one app. If the gate rules no, AC-23 is struck and the register carries the same prose in its own JSDoc. | this ticket's gate |

## 9. Risks

- **R-1 — nothing gives the browser a handle, so this ticket is only demonstrable against one
  obtained out of band.** `RAIL`'s Runs entry goes to `/runs`, whose placeholder says in as many
  words that *"the daemon reports no listing of its live runs"*. So the acceptance path is: start a
  run with `POST /runs` by hand, read the handle, and type `/runs/<handle>` into the browser.
  **Q-0121 is what removes that**, and it is `p2`. Consider running it first or with this one; the
  criteria here do not depend on it, and the demo does.
- **R-2 — zod enters the browser bundle.** `packages/shared`'s `exports` is `"."` alone with no
  wildcard subpath (Q-0096), so importing the barrel reaches eleven modules and their zod schemas.
  `packages/shared/src/index.ts`'s own header anticipates and blesses this — *"apps/web will
  generate the flow editor's form from `flowSchema` … so this has to be safe to put in a browser
  bundle"* — so no ruling is owed. What is unmeasured is the size, and it cannot be measured here:
  this package has no `build` script, which is Q-0122's. Stated so nobody reads AC-21's
  no-new-package result as a statement about bundle size.
- **R-3 — the *no daemon* discriminator rests on an unverified assumption about the dev-server
  proxy.** AC-15 discriminates on *did the socket reach open*. Through Vite's WebSocket proxy a
  target that refuses the connection should destroy the client socket before the handshake
  completes, so `open` never fires and the browser reports 1006 with no reason. **That is reasoned,
  not measured** — the unit tests drive a fake transport and prove the reducer, not the browser.
  GO-3 measures it once against a real dev server with the daemon down and with it up.
- **R-4 — five runs and five gates.** The full pipeline is `requirements` → `solutioning` →
  `qa-red` → `development` → `review`. The four tickets that have ever walked it are Q-0006,
  Q-0011, Q-0033 and Q-0050, three of them M1's and the fourth the most expensive ticket in the
  project at $131.03. Against Q-0014's $74.83 on the chore route, budget for materially more, and
  expect the cost to be in the *route* rather than in the code — which is the thing the gate ruled
  this ticket to find out.
- **R-5 — `development.yaml`'s fan-out is `by: role` and this ticket's roles are claude and
  codex on different halves of one feature**, so the `apps/web` task cannot see the
  `packages/shared` task's work until `integrate`. The shared module is a contract emitted by
  solutioning precisely so that it does not have to. If the solution instead has the `frontend`
  task *create* the shared module, the two tasks share a file, which
  `harness/architecture.md` names as a sign the cut is wrong.
- **R-6 — a test rendering components must be `.test.ts`, not `.test.tsx`.**
  `apps/web/test/package.test.ts:145` asserts every test file in the package ends `.test.ts`,
  because `testFilesIn` and `packages/core/turbo.json`'s `apps` glob match that suffix only while
  Vitest would run a `.test.tsx` regardless — running, unseen and uncached. `src/shell.test.ts` uses
  `createElement` and a `// @vitest-environment jsdom` docblock; new tests follow it. **AC-14's and
  AC-15's subjects are pure functions and need no DOM at all**, which is why they are specified that
  way.

## 10. Gate obligations

- **GO-1 — settle who writes `packages/server/src/wire.ts`, before `solutioning` runs.** No
  fan-out role may write `packages/server/` (§7), and a `tasks.yaml` that hands it to `backend`
  anyway produces the refusal this repository has recorded four times — *"A requirement may not name
  a surface its flow cannot write"* (2026-08-25) — except that this time it is found before the
  money rather than after. Two admissible answers:
  **(i) Recommended — the re-export is a contract, emitted by `solutioning`'s `architect` step.**
  `harness/roles/principal-architect.md` declares no `paths:` and no allowed-path prose, and that
  step runs `worktree: true` on `harness/{id}/contracts`. `wire.ts:4` already calls itself *"the
  contract Q-0014 codes against"*, so moving its declarations **is** the contract act. Nothing in
  the harness changes and no round is spent.
  **(ii) Grant `packages/server/` to `backend`.** Three edits — `harness/roles/developer-backend.md`'s
  frontmatter and its allowed-path sentence, and `harness/architecture.md`'s table row — all of
  which `role.test.ts` checks against each other, and none of which touches the template mirror
  (measured: `packages/cli/templates/harness/roles/developer-backend.md` carries the generic
  `services/api, packages/domain` and is not byte-shared). **This is the human's to write at the
  gate**, not an implementer's: a role editing its own grant inside the run that fans out by role is
  circular. It is also a repository-level fact worth having on its own merits — `packages/server`
  has existed since M3 opened and no fan-out role has ever been able to write it.
  Answer (i) or (ii) here. **Do not launch `solutioning` with this open**: no step on that route can
  settle it, which is the pattern this plan has recorded fifteen times.
- **GO-2 — confirm OQ-3, OQ-4 and OQ-5 at this gate**, so no implement round chooses a default
  nobody selected. OQ-5 in particular: if the term is refused, AC-23 is struck rather than narrowed.
- **GO-3 — measure R-3 once against a real dev server**, with the daemon down and with it up, and
  record what the browser reported in both cases. The reducer's tests prove the mapping; only this
  proves the input. If `open` *does* fire before the proxy fails, AC-15's discriminator moves and the
  criterion is amended by erratum at a gate rather than reinterpreted mid-round.
- **GO-4 — verify AC-21's store claim by measurement, not by reading the lockfile**, on Q-0014's
  GO-4 precedent: a manifests-only copy of the merge installed into an empty store, against the same
  for `main`. The expected delta is zero packages and zero bytes, and *expected* is the word that
  makes it worth measuring.
- **GO-5 — verify the merge forced in both environment rows**, per Q-0072's closing finding: in the
  integration worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
  `main` after the merge. `apps/web`'s scans walk the package rather than the repository, so they
  are less exposed than Q-0072's were — which is a reason to check rather than a reason not to.

## 11. Observations

True, worth recording, and **not claims about this change** — the `observation:` channel decision
*"A finding is a claim about the change; anything else is an observation"* (2026-09-11) opened.
Reported and deliberately not fixed here.

- **`observation:` `harness/flows/review.yaml`'s `verdict` instruction is spliced mid-sentence, in
  both shipped copies.** Q-0117's paragraph was inserted between *"on changes-requested there must
  be at least one"* and *"finding. Judge the reviews, not the code diff."*, so the step now reads
  *"…there must be at least one Anything TRUE and worth recording that is NOT a claim about this
  change — … See the 2026-09-11 decision entry. finding."* `harness/flows/chore.yaml` is **correct**
  — there the paragraph was appended after a complete sentence — and a byte comparison confirms the
  shipped and template `review.yaml` are identical, so `templates.test.ts`'s parity guard is green
  over the defect in both and `docs/02-sdlc-pipeline-spec.md` §5 carries it too, its snippets being
  held byte-identical to the shipped files. **This is the flow this ticket's own review stage runs**,
  and the mangled clause is the one that makes `changes-requested` require a finding. It is not this
  ticket's surface — no criterion here names `harness/flows/` — and it wants a one-line fix in three
  files by hand, before this ticket reaches `review`.
- **`observation:` two consecutive tickets declined to coin a glossary term on a premise that is
  measurably too broad.** Q-0013's and Q-0014's status-line entries both say *"minting a term means
  `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to write"*. Eleven of the
  glossary's 33 terms are absent from that list, and Q-0059 added **Confinement** to the glossary
  alone, through the flows, four days earlier. The deterrent is real and it is pointed at the wrong
  file; §0.8 records the measurement so a third ticket does not inherit it.
- **`observation:` `AppOptions.upgrade` in `packages/server/src/http.ts:35` is passed by nothing.**
  `serve()` calls `createApp({ host })` and then registers `/runs/:id/events` on the returned app
  itself, and no test supplies the option either. So `createApp` alone has no events route, and the
  WebSocket handler has exactly one caller. Not a defect and not this ticket's — recorded because a
  later ticket wanting to drive the socket without binding a port will look for that seam and find
  it unused rather than unbuilt.
