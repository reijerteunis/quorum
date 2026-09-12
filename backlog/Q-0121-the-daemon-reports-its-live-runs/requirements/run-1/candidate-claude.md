# Q-0121 — The daemon reports its live runs

*Requirements, run 1, candidate-claude. Written against the tree at 2026-09-12, after Q-0120 merged.*

---

## §0 — What the body says, and what the tree says

The ticket body carries a re-measurement dated 2026-09-12. It was re-checked here rather than
relayed, because *"a measurement copied from a document is not a measurement"* (Q-0099). Its items
(b), (c), (d) and (e) hold. **Item (a) does not hold in full, and four things nobody had measured
change the shape of the work.**

### 0.1 — (a)'s CLI clause is refuted: no host enumeration can ever reach a CLI run

The body lists, among the clients that cannot reach a live run, *"the ordinary case today — **any run
started from the CLI**, which no browser learns of at all"*.

That is true and **this ticket cannot close it**, which the body does not say. `RunHost` is an
**in-process** registry: `records` is a `Map` local to one `createRunHost` closure
(`packages/server/src/host.ts:223`), and a handle is minted from a module-level counter that is
*"unique within this process"* and *"deliberately meaningless across a restart"* (`host.ts:60–64`).
A `quorum run` invocation is a different operating-system process. It shares a repository with the
daemon and shares nothing else — no `records`, no counter, no broadcast.

Measured, so the gap is not merely argued:

- `grep` for `@quorum/server` across the workspace returns **no source file at all** — every hit is
  inside `backlog/`. Nothing imports the package.
- There is no `quorum open` and no CLI command that constructs a daemon: `packages/cli/src/` holds
  eight command modules and none of them names `createDaemon`.
- `packages/server/package.json` declares **no `exports`, no `main` and no `types`** — verbatim the
  state Q-0096 measured for `@quorum/core`, and the state Q-0120's own body named. Q-0120 did not
  fix it; it routed `WireMessage` through `@quorum/shared` instead.

So today the daemon runs under its own test suite and nowhere else, and a CLI run and a daemon run
have never coexisted. When they do, a host enumeration will report the daemon's runs and will be
**silent about the CLI's, correctly** — reporting them would mean inventing a handle for a run this
process cannot watch, stop or answer.

**Partly covered already, and worth saying so rather than opening work for it.** Q-0119's
`GET /history` (`read.ts:120`) lists every run under `.quorum/runs`, including one in flight:
`isIncomplete` is `status === 'running' || ended_at == null`
(`packages/core/src/run-history/reader.ts:158–160`). A CLI run therefore already appears there, in
the `<TICKET>-<n>` id space, as an incomplete run. It is not watchable and not answerable, and that
is a true report rather than a gap this ticket should paper over.

**What survives of (a) is the whole justification, and it is enough**: a fresh tab, a second
browser, a tab whose URL was closed, and the `/runs` landing route itself all cannot reach a live
run this daemon *is* driving. That is discovery, and it is what §1 is about.

### 0.2 — `docs/04-architecture.md` does not name a `GET /runs`, in either of the two places it lists routes

Neither the body nor Appendix B measured this.

- `04-architecture.md:82–83`: **"Three routes and one socket, over the host below."** `POST /runs`,
  `POST /runs/:id/gate`, `POST /runs/:id/stop`, `GET /runs/:id/events`.
- `04-architecture.md:157–159`, *"What the transport still owes"*: the same three POSTs, plus
  *"REST for project/backlog/flows/history"* and the socket.

A listing of **live runs** is in neither list. The second list is the read-only surface Q-0119 built,
and its four nouns are project, backlog, flows and history — history being run history on disk, which
`read.ts`'s own header separates from the live handle space by name (`read.ts:14–18`).

So this ticket adds a route a landed numbered document does not carry, and
`.claude/rules/docs-and-decisions.md` binds: *"When code and docs disagree, the docs are wrong until
a DECISIONS entry says otherwise — fix the docs in the same change."* Both paragraphs move here.
Whether an **entry** is also owed is OQ-4.

### 0.3 — `RunHost.records` is never pruned, and a listing is the first thing that makes it visible

`records.set` is called once per `mint` (`host.ts:260`) and there is no `records.delete` and no
`records.clear` anywhere in the package — checked, and the grep returns nothing. A record survives
its run ending, and survives `shutdown()`, which filters for `state === 'running'` and removes
nothing (`host.ts:424`).

That is invisible today, because `view(handle)` is the only reader and a caller must already know a
handle. **An enumeration is the first consumer that turns it into a growing answer**: a maintainer
who starts forty runs and mistypes ten tickets is served fifty rows, forever, and the fiftieth is as
prominent as the first. This is not urgent — one small record per run in a single-user local process
— but a listing must state its bound rather than have one discovered. OQ-5.

### 0.4 — The body's "cannot back" sentence is right about `ended` and silent about `refused`

Appendix B: *"it must not report a run it cannot back: a handle whose stream has ended is `ended`, a
state `RunView` already carries, not an absence."* Measured, that is correct **and the interesting
case is the other one**.

- An **ended** run is still fully backable. `Broadcast.subscribe()` is documented *"Permitted after
  `Broadcast.close`"* (`broadcast.ts:56`) and implemented that way: the replay is taken from
  `retained` and `subscribers.add` is skipped only for the live tail (`broadcast.ts:156–158`). So
  opening the socket on an ended run's handle replays up to `DEFAULT_RETENTION` events with its
  `missed` count and then closes. Listing it is honest.
- A **refused** run is the one that cannot be backed. `begin` returns through `refuse` before
  `record.broadcast` is ever assigned (`host.ts:347–358`), so `broadcast` stays `null`,
  `host.subscribe(handle)` answers `null` (`host.ts:391`), and the socket route closes **1008**
  (`serve.ts:113–116`). A refusal is real, it is what a client most needs to see, and it is not
  watchable.

The listing therefore carries all three states and **says which**, rather than filtering. Filtering
refusals would hide the answer a client most often wants; presenting them as watchable would be the
report this repository refuses.

### 0.5 — `apps/web` makes no HTTP request at all today

`grep -rn "fetch(" apps/web/src/` returns **nothing**. The app has one network capability — the
run-events WebSocket — and `04-architecture.md:196` records that *"nothing is fetched from a
network"* as a deliberate property.

A browser consumer of this listing is therefore the app's **first HTTP request**: its first response
parser, its first request-failure state, and its first "waiting for data" moment — against
`04-architecture.md:200`'s rule that *"no placeholder is a blank panel, a spinner or a skeleton"*.
That is a screen's worth of design decisions, and it is the single largest driver of this ticket's
size. OQ-1.

### 0.6 — (d) verified, and it is required rather than optional

`packages/server/src/wire.ts:8–14` carries the obligation verbatim, and §0.1 confirms its premise:
the package has no export surface, so a browser cannot import `WireRun` from it. The precedent is
in the same header — `WireMessage` moved to `@quorum/shared` **with its schema**, because *"a
browser needs a runtime PARSER and not a type"* and *"a `JSON.parse` result assigned to
`WireMessage` is a silent default, which this repository's rules forbid"*
(`packages/shared/src/wire.ts:1–18`).

A moved type with no schema would recreate exactly the half-measure Q-0120 had to repair.

---

## §1 — Problem

**In the `maintainer`'s words.** I started a run in the browser and it is at a gate. I opened a
second tab to look at the backlog, and now that tab has no way to get back to the run — it can reach
the rail's Runs entry, which tells me the daemon reports no listing, and it can reach the run itself
only if I still have the URL somewhere. If I closed the first tab, the run is still going, still
holding my ticket's lock, still waiting for me at a gate, and nothing I can click will find it.

**In the `adopter`'s words.** I refreshed and it worked, so I assumed the app knew about my run. It
did not: my *address bar* knew about it. When I opened the app fresh from a bookmark there was
nothing there, and no way to tell whether that meant "no runs" or "the app cannot see them".

**Mechanically.** `RunHost` exposes `view(handle)` and no enumeration (`host.ts:172–173`), and no
route exposes even that: five GETs exist and all five are Q-0119's read-only surface over disk
(`read.ts:76,82,97,120,140`). `POST /runs` is the only thing in the product that has ever told a
client a handle (`http.ts:138`).

Q-0120 made this narrower than Appendix B describes and did not close it. `/runs/:handle` is a route
(`routes.ts:124`) and `app.tsx:86` reads the handle out of the matched params, so a **reload**
reconnects and does reach `DEFAULT_RETENTION`'s buffer. What is unreachable is any client that never
held the handle — and the daemon's own retention exists for exactly that reader: *"a browser opened
after a run began, or reopened after a refresh"* (`serve.ts:34–37`). A 500-event buffer is built for
a late joiner and there is no way for a late joiner to name what to join.

The shipped app already says so, in the one place a user meets it. `routes.ts:120–121`:

> No ticket builds this screen yet, and the daemon reports no listing of its live runs, so there is
> nothing here to list.

**Two clauses, and this ticket makes exactly one of them false.**

---

## §2 — User stories

**`maintainer`** — *As a maintainer with several tabs and a run at a gate, I want any tab to ask the
daemon what it is running, so that losing a URL is not losing a run.*

**`maintainer`** — *As a maintainer whose start was refused, I want that refusal to be something I
can still read afterwards, so that a mistyped ticket is a row I can see rather than a request that
vanished.*

**`adopter`** — *As someone opening the app for the first time, I want the difference between "this
daemon is running nothing" and "this app cannot see runs" to be visible, so that an empty screen is
an answer rather than a doubt.*

**`contributor`** — *As someone writing a client against the daemon, I want the shape of a run row
to be one definition with a schema I can execute, so that I parse what the daemon sends rather than
asserting it.*

**Surfaces touched:** `packages/server` (the host and the transport), `packages/shared` (the wire
shapes), `apps/web` (one sentence in the route register — see OQ-1), `docs/04-architecture.md`.

---

## §3 — Acceptance criteria

Fourteen, against the fifteen that split Q-0107 and the eighteen that refused Q-0013. Each is
independently testable. **A criterion's *Test:* clause bounds the instrument** — a reviewer may find
the instrument fails the job that clause gives it and may not raise the job (Q-0067 E-1).

### The host

**AC-1 — `RunHost` gains an enumeration, and it is the host's rather than the transport's.**
`RunHost.list()` answers every run this host has minted, in mint order, as `RunView`s — including
runs that were refused and runs that have ended. It adds no state: it projects `records`, which
already holds all three.
*Test:* `host.test.ts` — mint a refused start (unknown ticket), a running run and a run driven to
its terminal event; `list()` answers three views in mint order, and for each, `list()`'s entry is
deep-equal to `view(handle)`'s. Shown red by returning only `state === 'running'`.

**AC-2 — the transport keeps no index of its own, proven behaviourally rather than by scanning.**
A run started by calling `host.start()` directly — never through `POST /runs` — appears in
`GET /runs`. This discriminates the two designs OQ-2 names: a transport-side index records what it
saw, and a host enumeration reports what exists.
*Test:* `http.test.ts` — build the app over a host, start a run through the host object, `GET /runs`
lists it. Shown red against an implementation that appends to a route-local collection on start.

### The routes

**AC-3 — `GET /runs` answers 200 with `{ runs: WireRun[] }`, in the host's order.**
A host with no runs answers `200 {"runs": []}` and never a 404: nothing is missing, there is nothing
to list, and those are different sentences.
*Test:* `http.test.ts` — the empty case; and with three runs, the response's handles equal
`host.list()`'s handles in the same order.

**AC-4 — `GET /runs/:id` answers 200 with one `WireRun` for a minted handle, and 404 for anything
else, in `badRequest`'s three-field shape.**
The refusal carries `code: 'no-such-run'`, a `condition` naming the handle, and a `remedy` of `null`
— the same shape and the same code the gate and stop routes already answer with
(`http.ts:194`, `ANSWER_REFUSAL_STATUS`).
*Test:* both cases; the 404 body's key set is exactly `{code, condition, remedy}` and `condition`
contains the requested handle.

**AC-5 — both routes are GETs, write nothing, and move nothing.**
A POST, PUT or DELETE to either is not routed. Listing a run that is waiting at a gate leaves that
gate pending; listing a running run does not stop it, and listing a refused one does not retry it.
*Test:* `read.test.ts`'s existing method loop applied to the two paths; plus a run parked at a gate,
`GET /runs` twice, and `host.view(handle).gates` unchanged in length afterwards.

### What a row carries

**AC-6 — `WireRun` carries the ticket id, the pending-gate count and the watcher count, and one
projection produces it for every route that answers one.**
Today `WireRun` is `{handle, flow, runId, state}` (`wire.ts:112–117`) — **no ticket**. A listing of
handles with no ticket id is a listing nobody can read. `runId` stays `null` until the terminal
event, which is a fact about the engine and not a gap (`host.ts:101–107`), so the ticket id is what
makes a row identifiable while the run is alive. The pending-gate count is what makes a row
*actionable*: a run waiting on a human that nobody can find is the worst case this ticket exists to
remove. `wireRunOf` is widened rather than joined by a second projection, so `POST /runs` and both
new routes cannot answer different shapes for the same run.
*Test:* a run at a gate reports `gates: 1`; a start whose ticket never resolved reports
`ticket: null` (not `""` and not the token the caller sent); a run with two subscribers reports
`watchers: 2`; and `POST /runs`'s 201 body has the same key set as a `GET /runs` row.

**AC-7 — no ticket body, no `TicketRecord` and no `Event` crosses the wire in a `WireRun`.**
`RunView.ticket` is a whole `TicketRecord` (`host.ts:109`) and `RunView.gates` is an array of
`GateQuestionEvent` (`host.ts:118`). Neither is sent: the ticket narrows to its id and the gates
narrow to a count.
*Test:* a fixture ticket whose body carries a distinctive marker string; serialise the route's
answer and assert the marker does not appear. And the row's key set equals a declared register, so a
field added later is a visible act.

**AC-8 — a refused run is listed as `refused` with its refusal, and is distinguishable from one that
ended.**
Measured in §0.4: refused is the state that cannot be watched. A row carries enough to tell them
apart without a second request.
*Test:* a start refused by an unknown ticket lists with `state: 'refused'` and the refusal's
`condition` in `core`'s own words, unaltered; a completed run lists with `state: 'ended'` and no
refusal. Both are present in the same listing.

**AC-9 — an ended run stays listed and stays watchable.**
The buffer outlives the run (`broadcast.ts:56,153–158`), so `ended` is a state rather than an
absence, and a client that discovers an ended run can still read its retained trace.
*Test:* drive a run to completion; `GET /runs` still lists it as `ended`; opening
`/runs/:handle/events` on that handle replays the retained events and closes 1000. Shown red by
removing the record on stream close.

### Where the shapes live

**AC-10 — `WireRun` and `WireRefusal` are defined in `@quorum/shared`, each with a runtime schema,
and re-exported by `packages/server`.**
This discharges the obligation `wire.ts:8–14` names by ticket id. The **type alone is not the
deliverable**: `@quorum/shared`'s own header records why `WireMessage` moved with
`wireMessageSchema` — a browser needs a parser, and a `JSON.parse` result assigned to a type is the
silent default the rules forbid. `wireRunOf` **stays in `packages/server`**, because it takes a
`RunView` and the dependency direction does not permit `shared` to know one.
*Test:* `@quorum/shared`'s barrel exports both names and both schemas; `@quorum/server`'s barrel
still exports both names, so no consumer's import breaks; `packages/shared`'s browser-safety guard
passes over the moved file; and each schema refuses a row with an unknown key and one with a missing
one, distinguishably.

**AC-11 — the acceptance path, end to end over a real socket.**
A client with no prior knowledge of any handle lists the runs, takes one from the listing, opens the
event socket on it, and receives the retained replay with its `missed` count. This is the criterion
that proves the ticket did its job: it is `DEFAULT_RETENTION`'s buffer reached by a reader that could
not name it before.
*Test:* `serve.test.ts` — start a run through the daemon and **discard the handle the start
answered**; `GET /runs` over the real port; take the handle from the response; open
`/runs/:handle/events`; assert the `missed` message and the replayed events arrive. Discarding the
start's handle is load-bearing: a test that reused it would prove nothing this ticket adds.

### The two documents and the one sentence

**AC-12 — `apps/web/src/routes.ts`'s `/runs` entry no longer claims the daemon reports no listing.**
The second clause of `routes.ts:120–121` becomes false with this change and the first stays true —
no ticket builds the Runs landing screen. The sentence is corrected to what remains true, and it may
not be replaced with one promising a screen that does not exist.
*Test:* `apps/web/test/routes.test.ts` asserts the `/runs` entry's `waitingFor` does not claim the
daemon reports no listing, and that its `ticket` is still `null`. Shown red against the current text.

**AC-13 — `docs/04-architecture.md` names the two routes in both places it enumerates them.**
§0.2 measured that neither the *"Three routes and one socket"* paragraph (`:82–83`) nor *"What the
transport still owes"* (`:157–159`) carries a live-run listing. Both move, and the status line at the
top of the document gains its dated line.
*Test:* a guard that derives every route path literal `http.ts` registers — the first argument of
each `app.get(` and `app.post(` — and asserts each appears in §`packages/server`. That is stronger
than a string check on two sentences, and it keeps working when a later ticket adds a route. Shown
red by adding a route and not the prose.

**AC-14 — the dev proxy forwards a `fetch` of `/runs` to the daemon and still steps aside for a page
load of `/runs`. This is a pin on behaviour that already holds, not new work.**
`DAEMON_ENDPOINTS.runs` is `/runs` (`daemon-endpoints.ts:3`) and `vite.config.ts`'s
`bypassNavigation` returns `/index.html` only for a GET whose `Accept` contains `text/html`. A
`fetch` sends `*/*` or `application/json`, neither of which does, so it proxies — Q-0120 review round
1's B-1 fix already covers this exact case, and this criterion exists so that the first HTTP consumer
does not rediscover it.
*Test:* `apps/web/test/daemon-endpoints.test.ts` — `bypassNavigation` answers `/index.html` for
`Accept: text/html`, and `undefined` for `*/*`, for `application/json` and for a non-GET. Shown to
have a subject by asserting a row for `/runs` specifically rather than for the map in general.

---

## §4 — Non-goals

1. **The Runs landing screen.** No `fetch` in `apps/web`, no list rendering, no request-failure
   state, no empty state beyond the corrected register sentence. §0.5 measured this as the app's
   first HTTP request, which is a screen's worth of decisions. See OQ-1.
2. **Reporting a run this daemon did not start.** §0.1 measured that a host enumeration cannot; a
   CLI run is another process. `GET /history` already reports it as incomplete, which is the honest
   coverage that exists.
3. **Persisting a handle in the browser.** `04-architecture.md:194` — *"State from the WebSocket
   stream; no client-side persistence beyond UI preferences."*
4. **Durable handles across a daemon restart.** A handle is *"deliberately meaningless across a
   restart"* (`host.ts:60–64`); resumption is **Q-0019's**.
5. **Pruning, capping or expiring `records`.** §0.3 — registered, not fixed. See OQ-5.
6. **Any change to `POST /runs`'s refusal table, statuses or classifier.** `WireRun` widens
   additively and nothing else on that route moves.
7. **Giving `packages/server` an `exports` map.** The shapes move to `@quorum/shared` instead, which
   is Q-0120's precedent and the cheaper half of the two Q-0014's gate weighed.
8. **Serving the bundle, a build task for `apps/web`, or `quorum open`.** Q-0122's, together with the
   ruling on whether a served bundle is an **emitted artifact**.
9. **Authentication, a non-loopback bind, or a configurable one.** Settled by Q-0118 and
   `serve.ts:19–27`.
10. **Widening the gate answer vocabulary.** Three answers, `.strict()`; Q-0016's to ask for with an
    entry of its own.
11. **A new external dependency.** Nothing here needs one.

---

## §5 — Open questions

**OQ-1 — Does this ticket stop at the daemon, or does it also build the browser's consumption of the
listing? *Owner: the gate. This is the one the criteria list depends on, so it is a blocker.***
*Recommended: stop at the daemon.* §0.5 measured that a browser consumer is `apps/web`'s first HTTP
request, its first response parser and its first not-yet-loaded state, against a rule that forbids a
spinner standing in for an answer — and the screen that would render it has **no ticket** and is
plainly Q-0015's neighbourhood. Under the recommendation, AC-12 is the whole of the app's change and
AC-11 is what proves the daemon half works. The cost, stated plainly: the ticket ships with no
user-visible consumer beyond one corrected sentence, which R-1 addresses. If the gate takes the wider
reading, expect four to six further criteria and a re-check against the fifteen-criterion ceiling.

**OQ-2 — Does `RunHost` gain the enumeration, or does the transport keep its own index?**
*Owner: the gate. Recommended: the host, and the tree has already answered it.* `http.ts:6` says
**"It owns no run state"**, and `04-architecture.md:84` says *"The transport owns no run state"*. An
index in the transport would be a second authority for the set of runs, kept in step with `mint` and
`shutdown` by hand, and would miss any run started through the host object rather than through the
route — which AC-2 is written to catch. AC-1 takes the host. Appendix B's counter-argument — that an
index *"keeps the host's surface at what Q-0013 proved"* — is real and is answered by the shape:
`list()` adds no state, no lifecycle and no failure mode, and projects a map that already exists.

**OQ-3 — What does a listing row carry?** *Owner: the gate. Recommended: widen the one `WireRun`
rather than add a second shape*, to `{handle, flow, runId, state, ticket, gates, watchers}` — see
AC-6. The alternative is a separate `WireRunSummary` for the listing, which keeps `POST /runs`
byte-identical at the cost of two shapes for one thing and a client having to know which route
answers which. Widening is additive, so every existing assertion on the 201 body survives.

**OQ-4 — Does adding a route the architecture document does not list owe a decision entry, or only a
document edit?** *Owner: the gate. Recommended: only the edit, and the edit is owed either way
(AC-13).* Q-0118's precedent is *"executing a landed document is not changing the architecture"*;
this is the converse and is narrower than it sounds — the route adds no dependency, no state, no new
kind of surface, and contradicts no landed entry. It is a read over state the host already holds, in
the id space `:id` already names. If the gate disagrees, **the entry must land before the implement
step**, a `developer-generalist` being forbidden to write one — the hazard Q-0062 paid three rounds
for.

**OQ-5 — Unbounded `records`: accept and register, or open a successor?**
*Owner: the gate. Recommended: register it in the host's own words and open the successor at the
gate rather than in a closing entry* (Q-0105's precedent, against the three obligations found in one
week living only inside closed tickets). Pruning is refused here on measurement rather than taste: an
ended run's retained buffer is exactly what AC-9 and AC-11 make reachable, so evicting ended records
would remove the thing this ticket adds. A cap on the *listing* is worse — it would hide runs while
looking complete.

**OQ-6 — Do the moved shapes carry schemas, or types only?** *Owner: the gate. Recommended:
schemas*, per AC-10 and `packages/shared/src/wire.ts:1–18`. A type in `shared` with no schema is the
half-measure Q-0120 had to repair, and it would leave the first browser consumer parsing a fetched
body by assertion. If OQ-1 defers the browser half, the schema is still worth landing now: it costs
little and it is what Q-0015 inherits.

**Observation, not a question, and no criterion depends on it** (Q-0117's channel): `docs/GLOSSARY.md`'s
**Connection state** entry contrasts itself with *"run state"*, which has no entry of its own —
`RunState` is `refused | running | ended` (`host.ts:79`) and is named nowhere in the vocabulary. That
predates this ticket and is not created by it. **No glossary term is coined here and none is owed**:
a listing of live runs invents no vocabulary, and minting a term would reach `CLAUDE.md`'s list,
which Q-0103 erratum E-2 makes the human's to write.

---

## §6 — Risks

**R-1 — Under OQ-1's recommendation the ticket ships with no user-visible consumer.** A maintainer
gains nothing they can click; what changes is one sentence and a route two tests exercise. *Mitigation
and honesty:* AC-11 is the proof that the capability is real, AC-12 is the visible change, and the
alternative — bundling a screen — is what turned Q-0013 into three tickets and Q-0014 into two. State
it at the close rather than presenting the daemon half as the feature.

**R-2 — `WireRun` widens a shape `POST /runs` already answers with, and Q-0118's tests pin it.** The
widening is additive, so assertions reading individual fields survive; an assertion on the whole key
set does not. *Mitigation:* AC-6 requires the 201 body and a listing row to share a key set, which
forces the check rather than leaving it to be discovered at `integrate`.

**R-3 — the move to `@quorum/shared` fails if `WireRun` keeps a `core` type.** That package carries a
browser-safety guard and must not reach `@quorum/core`; `RunView.ticket` is a `TicketRecord`.
*Mitigation:* AC-6's narrowing to the ticket **id** is not a presentation choice, it is what makes
AC-10 possible at all. Doing them in the wrong order means writing the move twice.

**R-4 — `records` grows for the life of the process, and this ticket makes it visible.** §0.3. Bounded
in practice by a single-user local daemon's session length. Registered by OQ-5 and not fixed.

**R-5 — AC-11 opens a real socket, which is Q-0102's neighbourhood.** *Mitigation:* `serve.test.ts`
already binds a real port and drives a real WebSocket, so no new machinery is introduced; that suite's
existing shape is reused rather than a second one written. If the new test proves load-sensitive, the
threshold in Q-0102's body is what it is measured against — not a re-run until green.

**R-6 — a listing is a new place to leak.** `RunView` carries a whole ticket, its gate questions and a
failure string. AC-7 is the guard, and it asserts over serialised bytes rather than over the type,
because the type is what would be got right and the bytes are what ships.

---

## §7 — Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a. No code path here reads an environment variable, and no new dependency is added. Nothing in a `WireRun` could carry a credential; there are none in this product. |
| **Safety by construction** | n/a to worktrees, and load-bearing for reads. Both routes are GETs (AC-5), start nothing, answer no gate and write no file. The run lock is untouched: listing a run neither takes nor releases one. |
| **Human-gated by default** | Unchanged, and *improved in the only way this ticket can*: AC-6's gate count makes a run waiting for a human discoverable. No gate is answered, no gate is auto-advanced, and the answer vocabulary stays three. |
| **Files are the database** | Nothing is persisted. The listing is derived per request from in-memory host state, and no cache is introduced — the same discipline `read.ts:60–72` applies to containment and push lag. |
| **Cross-vendor rule** | n/a — no flow, role or adapter changes. |
| **Product-agnostic** | n/a — nothing here names a product. |
| **The cold-clone test** | No impact. No new dependency, no new install step, no new command, and no change to either claimed installation path. |
| **Errors are explicit** | AC-4's 404 carries `code`, `condition` and `remedy`; AC-8 keeps a refusal's condition in `core`'s own words per *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07); AC-10's schemas refuse a malformed row rather than defaulting it. |
| **File format / schema** | `@quorum/shared` gains two schemas (AC-10). No on-disk format changes. |
| **Lint rules** | None added. `eslint.config.js` already covers `packages/**/*.ts`. |

---

## §8 — Gate obligations

**GO-1 — Answer OQ-1 before the run.** The criteria list depends on it: under the wide reading four
to six criteria are added and the ceiling must be re-checked. Do not launch with it open.

**GO-2 — Rule OQ-4, and if an entry is owed, land it at this gate.** No step on the chore route may
write one, and a loop handed work no agent in it can perform is the pattern this repository has
recorded fifteen times.

**GO-3 — Open OQ-5's successor here rather than in a closing entry**, if the gate takes the register
route. Three obligations in one week (Q-0110, Q-0111, Q-0112) lived only inside a closed ticket's
prose or a source comment.

**GO-4 — Verify forced in both environment rows after the merge** (Q-0072's closing finding): in the
integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`.

**GO-5 — Confirm AC-14 has a subject before trusting it.** It pins behaviour that already holds, so
it can pass vacuously; it must be shown red against a proxy entry with the bypass removed, or it is
reassurance rather than a check.

**GO-6 — Record that no glossary term is coined and none is owed**, per the observation in §5, so a
later reader does not re-litigate it.
