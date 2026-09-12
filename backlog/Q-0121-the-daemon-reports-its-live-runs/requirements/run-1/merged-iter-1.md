# Q-0121 — The daemon reports its live runs

*Merged requirement, run 1, iteration 1. Written against the tree at 2026-09-12, after Q-0120
merged. Every measurement either candidate rests on was re-run here rather than relayed —
"a measurement copied from a document is not a measurement" (Q-0099).*

---

## §0 — What the tree says

The ticket body's re-measurement of 2026-09-12 was re-checked, not relayed. Its items (b), (c), (d)
and (e) hold verbatim. Item (a) holds in its narrow form and **over-reaches in one clause**, which
candidate-claude found and candidate-codex assumed away. Four further measurements neither candidate
had change the shape of the work.

### 0.1 — (a)'s CLI clause is true and **this ticket cannot close it**

The body lists among the unreachable clients *"the ordinary case today — any run started from the
CLI, which no browser learns of at all"*. Measured:

- `RunHost` is an **in-process** registry. `records` is a `Map` local to one `createRunHost` closure
  (`host.ts:223`) and a handle is minted from a module-level counter, *"unique within this process"*
  and *"deliberately meaningless across a restart"* (`host.ts:57–64`).
- `grep -rn "@quorum/server"` returns **no source file in the workspace** — every hit is under
  `backlog/`. Nothing imports the package.
- `packages/server/package.json` declares **no `exports`, no `main`, no `types`** — verbatim the
  state Q-0096 measured for `@quorum/core`. There is no `quorum open` and no CLI command that
  constructs a daemon.

A `quorum run` invocation is a different operating-system process. It shares a repository with the
daemon and shares nothing else: no `records`, no counter, no broadcast, no `AbortController`. When
the two do coexist, a host enumeration will report the daemon's runs and be **silent about the
CLI's, correctly** — reporting one would mean inventing a handle for a run this process cannot
watch, stop or answer.

**Partly covered already, which is worth saying rather than opening work for.** Q-0119's
`GET /history` (`read.ts:120`) lists every run under `.quorum/runs`, and `isIncomplete` is
`status === 'running' || ended_at == null` (`core/run-history/reader.ts:158–160`), so a CLI run
already appears there as an incomplete run in the `<TICKET>-<n>` id space. It is not watchable and
not answerable, and reporting it as such is a true report rather than a gap this ticket should paper
over.

**What survives of (a) is the whole justification**: a fresh tab, a second browser, a tab whose URL
was closed, and the `/runs` landing route itself cannot reach a live run *this daemon is driving*.
That is discovery, and it is what this ticket is about.

### 0.2 — `WireRun.state` is declared `string`, not a union, and neither candidate measured it

`wire.ts:112–117` is exactly:

```ts
export interface WireRun {
  readonly handle: string;
  readonly flow: string;
  readonly runId: number | null;
  readonly state: string;
}
```

`RunState` is `'refused' | 'running' | 'ended'` (`host.ts:79`) and `wireRunOf` copies the field
straight across. So the wire's state vocabulary is **open today**, which is what makes
candidate-codex's declaration of a two-member union read as a restatement when it is a narrowing —
and its two members are the wrong two, because §0.5 gives the detail route a third.

### 0.3 — `RunHost.records` is never pruned, and a listing is the first thing that makes it visible

`records.set` is called once per `mint` (`host.ts:260`). There is no `records.delete` and no
`records.clear` anywhere in `packages/server` — the grep returns nothing. A record survives its run
ending and survives `shutdown()`, which filters for `state === 'running'` and removes nothing
(`host.ts:424`).

That is invisible while `view(handle)` is the only reader, because a caller must already hold a
handle. **An enumeration is the first consumer that turns it into a growing answer.** Not urgent —
one small record per run in a single-user local process — but a listing must state its bound rather
than have one discovered. Registered, not fixed; see §5 OQ-3 and GO-2.

### 0.4 — a **refused** run is the one that cannot be backed, and its handle is never disclosed

Appendix B says *"it must not report a run it cannot back: a handle whose stream has ended is
`ended`, a state `RunView` already carries, not an absence."* That is correct about `ended` and
silent about the case that matters.

- An **ended** run is still fully backable. `Broadcast.subscribe()` is documented *"Permitted after
  `Broadcast.close`"* (`broadcast.ts:56`) and implemented that way — the replay is taken from
  `retained` at registration and only the live tail is skipped (`broadcast.ts:153–158`). Opening the
  socket on an ended run's handle replays up to `retain` events with its `missed` count and closes.
  Listing it is honest.
- A **refused** run cannot be backed. `begin` returns through `refuse` before `record.broadcast` is
  assigned (`host.ts:347–358`), so `broadcast` stays `null`, `host.subscribe(handle)` answers `null`
  (`host.ts:391`) and the socket route closes **1008** (`serve.ts:113–116`).
- **And no client is ever told a refused handle.** `POST /runs` answers `wireRunOf(outcome)` only on
  `outcome.started` (`http.ts:136`); a refusal answers a `WireRefusal` — `code`, `condition`,
  `remedy` — which carries no handle at all (`http.ts:133–135`).

That last fact is the one neither candidate had, and it decides §5's first ruling.

### 0.5 — `apps/web` makes no HTTP request at all

`grep -rn "fetch(" apps/web/src/ apps/web/test/` returns **nothing**. The app's one network
capability is the run-events WebSocket, and `04-architecture.md:196` records *"nothing is fetched
from a network"* as deliberate. A browser consumer of this listing would therefore be the app's
first HTTP request, its first response parser, its first request-failure state and its first
not-yet-loaded moment — against `04-architecture.md:200`'s rule that *"no placeholder is a blank
panel, a spinner or a skeleton"*. That is a screen's worth of decisions, and it is why the browser
half is a non-goal (§4.1) rather than a trim.

### 0.6 — the two documents, and where the routes may be mounted

- `04-architecture.md:81–83` — **"Three routes and one socket, over the host below."** Neither a
  listing nor a detail read is among them.
- `04-architecture.md:157–159`, *"What the transport still owes"* — the same three POSTs, *"REST for
  project/backlog/flows/history"*, and the socket. A live-run listing is in neither noun list.
- `serve.ts:95` composes the app as `mountRead(createApp({ host }), host.project)`. **`mountRead`
  takes a project and never the host**, and `read.ts`'s header states that everything it serves is
  already on `@quorum/core`'s barrel. A route that reads the host therefore cannot live there
  without changing that module's signature and breaking its stated property.

### 0.7 — (d) verified, and it is required rather than optional

`wire.ts:8–14` carries the obligation by ticket id: *"`WireRefusal` and `WireRun` are still declared
below, and whoever needs them from a browser (Q-0015 or Q-0121) moves them the same way rather than
copying them."* The precedent is in `packages/shared/src/wire.ts:1–18` — `WireMessage` moved **with
`wireMessageSchema`**, because *"a browser needs a runtime PARSER and not a type"* and *"a
`JSON.parse` result assigned to `WireMessage` is a silent default, which this repository's rules
forbid"*. A moved type with no schema recreates the half-measure Q-0120 had to repair.

---

## §1 — Problem

**In the maintainer's words.** I started a run in the browser and it is at a gate. I opened a second
tab to look at the backlog, and that tab has no way back to the run — the rail's Runs entry tells me
the daemon reports no listing, and the run itself is reachable only if I still have the URL. If I
closed the first tab, the run is still going, still holding my ticket's lock, still waiting for me at
a gate, and nothing I can click will find it.

**Mechanically.** `RunHost` exposes `view(handle)` and no enumeration (`host.ts:172–173`), and no
route exposes even that: nine routes are registered — three POSTs (`http.ts:122,141,156`), the
WebSocket (`serve.ts:99`) and five GETs (`read.ts:76,82,97,120,140`) — and `POST /runs` is the only
one that has ever told a client a handle.

Q-0120 made this narrower than Appendix B describes and did not close it. `/runs/:handle` is a route
(`routes.ts:124`) and `app.tsx` reads the handle out of the matched params, so an ordinary **reload**
reconnects and does reach the retained buffer. What is unreachable is any client that never held the
handle — and the daemon's retention exists for exactly that reader: *"a browser opened after a run
began, or reopened after a refresh"* (`serve.ts:34–37`). A 500-event buffer is built for a late
joiner and there is no way for a late joiner to name what to join.

The shipped app already says so, in the one place a user meets it (`routes.ts:120–121`):

> No ticket builds this screen yet, and the daemon reports no listing of its live runs, so there is
> nothing here to list.

**Two clauses, and this ticket makes exactly one of them false.**

---

## §2 — User stories

**`maintainer`** — *As a maintainer with several tabs and a run at a gate, I want any tab to ask the
daemon what it is running, so that losing a URL is not losing a run.*

**`maintainer`** — *As a maintainer whose second start was refused because the first holds the
ticket's lock, I want to find the run that holds it, so that a 409 points me somewhere instead of
only saying no.*

**`adopter`** — *As someone opening the app fresh, I want the difference between "this daemon is
running nothing" and "this app cannot see runs" to be visible, so that an empty screen is an answer
rather than a doubt.*

**`contributor`** — *As someone writing a client against the daemon, I want a run row to be one
definition with a schema I can execute, so that I parse what the daemon sends rather than asserting
it.*

**Surfaces touched:** `packages/server` (the host and the transport), `packages/shared` (the wire
shapes and their schemas), `apps/web/src/routes.ts` (one sentence), `docs/04-architecture.md`.

---

## §3 — Acceptance criteria

Thirteen, against the fifteen that split Q-0107 and the eighteen that refused Q-0013. Each is
independently testable. **A criterion's *Test:* clause bounds the instrument** — a reviewer may find
the instrument fails the job that clause gives it, and may not raise the job (Q-0067 E-1).

### The host

**AC-1 — the host answers with every run it has minted, and the enumeration is the host's.**
`RunHost` gains a read-only enumeration answering every minted run as a `RunView`, in **mint order**,
including refused runs and ended ones. It adds no state and no lifecycle: it projects `records`,
which already holds all three states, through the same `viewOf` that `view(handle)` uses. *The
method's name and signature are solutioning's* — what binds is that the set of runs has one
authority and it is the host.
*Test:* `host.test.ts` — mint a refused start (unknown ticket), a running run and a run driven to its
terminal event; the enumeration answers three views in mint order, and each entry is deep-equal to
`view(handle)`'s. Shown red by filtering to `state === 'running'`.

**AC-2 — the transport keeps no index of its own, proven behaviourally rather than by scanning.**
A run started by calling the host's `start` directly — never through `POST /runs` — appears in
`GET /runs`. This is what discriminates the two designs OQ-1 names: a transport-side index records
what it *saw*; a host enumeration reports what *exists*.
*Test:* `http.test.ts` — build the app over a host, start a run through the host object, `GET /runs`
lists it. Shown red against an implementation that appends to a route-local collection on start.

### The routes

**AC-3 — `GET /runs` answers 200 with `{ runs: WireRun[] }`, most-recently-minted first.**
A host with nothing to list answers `200 {"runs": []}` and never a 404: nothing is missing, there is
nothing to list, and those are different sentences. The order is stable across repeated requests, and
is the reverse of AC-1's mint order. **Order is specified because it is the only recency the wire
carries** — the handle is documented opaque (`host.ts:57–64`), so a client may not derive age from
`run-<n>`, and the row a maintainer most often wants is the last run started.
*Test:* `http.test.ts` — the empty case by body equality; and with three runs, the response's handles
equal the reverse of the host enumeration's handles, and repeating the request without starting
another run returns the same array.

**AC-4 — the listing carries the runs this host can back — `running` and `ended` — and never a
refused start, and it is derived per request.**
A run that has, or had, an event stream is listed. A refused start is not: §0.4 measured that it has
no broadcast, that its socket closes 1008, and that its handle was never disclosed to any client, so
listing it would surface a row nobody asked for and none can open. An **ended** run stays listed,
because its retained buffer is exactly what AC-11 makes reachable. Nothing is cached: a run listed as
`running` is listed as `ended` after it finishes, under the same `handle`, `flow` and `ticketId`,
with `runId` moving from `null` to `core`'s number.
*Test:* one listing containing a running run and an ended one and **not** a refused start, with the
refused handle asserted absent by value; then drive the running run to completion and list again,
asserting the transition and the three unchanged fields. Shown red by listing every minted record.

**AC-5 — `GET /runs/:id` answers for any handle this host minted, including a refused one, and 404
means never minted.**
200 with one `WireRun` wherever `view(handle)` answers non-null — so a refused start reports
`state: 'refused'` rather than being reported as absent. 404 only where the host minted no such
handle, in `badRequest`'s three-field shape with `code: 'no-such-run'`, whose condition — *"no run is
registered under that handle"* — is then **true**. This is what makes AC-4's exclusion a selection
rather than a silent drop: the listing answers *what can I join?*, the lookup answers *what do you
know about this handle?*
*Test:* three cases — running, refused, never-minted. The 404 body's key set is exactly
`{code, condition, remedy}`. Shown red against an implementation that 404s a refused handle, which
prints a sentence the host's own records contradict.

**AC-6 — both routes are GETs, and reading moves nothing.**
A POST or DELETE to either is not routed. Listing a run parked at a gate leaves that gate pending and
unanswered; listing creates no subscription, does not change `watchers`, does not stop or resume a
run, and writes nothing under `backlog/`, `harness/` or `.quorum/`.
*Test:* `read.test.ts:45`'s existing method loop applied to the two paths; plus a run parked at a
gate, two listings, and `view(handle).gates` and `view(handle).watchers` unchanged afterwards.

**AC-7 — they are served by the app that has the host, and by the daemon.**
Both routes are on the app `createApp` returns — so a test that never opens a socket reaches them —
over the **same** host as `POST /runs` and `/runs/:id/events`, and are present on `createDaemon`'s
daemon. They are not mounted through `mountRead`, which is given a project and no host (§0.6).
*Test:* `http.test.ts` reaches both on a bare `createApp` result; `serve.test.ts` reaches both over a
real port on a daemon; and a run started through the daemon's own `POST /runs` is the run the listing
answers with.

### What a row carries

**AC-8 — `WireRun` is `{handle, flow, ticketId, runId, state, pendingGates}`, and one projection
produces it for every route that answers one.**
`ticketId` is the ticket's id and is `null` only where the start never resolved one — which, by AC-4,
is never a listed row. `state` narrows from today's `string` (§0.2) to the host's closed **three**.
`pendingGates` is a count, and it is what makes a row actionable: the case this ticket exists to
remove is a run waiting on a human that nobody can find. `wireRunOf` is **widened rather than joined
by a second projection**, so `POST /runs`, the listing and the lookup cannot answer different shapes
for one run. The names are not `RunView`'s: `RunView.ticket` is a whole `TicketRecord` and
`RunView.gates` an array of questions, so a field that narrows one may not keep its name.
*Test:* a run at a gate reports `pendingGates: 1`; a start whose ticket never resolved reports
`ticketId: null` — not `""` and not the token the caller sent; and `POST /runs`'s 201 body has the
same key set as a `GET /runs` row, asserted as a set rather than field by field.

**AC-9 — no `TicketRecord`, no `Event` and no gate question crosses the wire in a `WireRun`.**
The ticket narrows to its id and the gates to a count. The row's key set is a declared register, so a
field added later is a visible act.
*Test:* a fixture ticket whose body carries a distinctive marker; serialise the listing and the
lookup and assert the marker appears in neither. Asserted over **serialised bytes** rather than over
the type, because the type is what gets got right and the bytes are what ships.

### Where the shapes live

**AC-10 — `WireRun` and `WireRefusal` are defined in `@quorum/shared`, each with a runtime schema,
and re-exported by `packages/server`.**
This discharges the obligation `wire.ts:8–14` names by ticket id. The **type alone is not the
deliverable** (§0.7): the row schema and a schema for the `{ runs: … }` envelope both land, and the
TypeScript types are inferred from or checked against them so the parser and the type cannot drift.
`wireRunOf` **stays in `packages/server`**, taking a `RunView`, because the dependency direction does
not permit `shared` to know one.
*Test:* `@quorum/shared`'s barrel exports both names and both schemas; `@quorum/server`'s barrel still
exports both names, so no existing import breaks; `packages/shared`'s browser-safety guard passes over
the moved file; and each schema refuses an unknown key, a missing required field and a state outside
the closed three, **distinguishably** — one message per class.

### The proof, and the two documents

**AC-11 — the acceptance path, end to end over a real socket.**
A client with no prior knowledge of any handle lists the runs, takes one from the listing, opens the
event socket on it, and receives the retained replay with its `missed` message where one is due. This
is the criterion that proves the ticket did its job: it is the retention buffer reached by a reader
that could not name it before.
*Test:* `serve.test.ts` — start a run through the daemon and **discard the handle the start
answered**; `GET /runs` over the real port; take the handle from the response; open
`/runs/:handle/events` with it. Discarding the start's handle is load-bearing: a test that reused it
would prove nothing this ticket adds.

**AC-12 — `apps/web/src/routes.ts`'s `/runs` entry no longer claims the daemon reports no listing.**
The second clause of `routes.ts:120–121` becomes false with this change and the first stays true — no
ticket builds the Runs landing screen. The sentence is corrected to what remains true, and may not be
replaced by one promising a screen that does not exist.
*Test:* `apps/web/test/routes.test.ts` asserts that entry's `waitingFor` no longer claims the daemon
reports no listing, and that its `ticket` is still `null`. Shown red against the current text.

**AC-13 — `docs/04-architecture.md` names the new routes in both places it enumerates them.**
§0.6 measured that neither the *"Three routes and one socket"* paragraph (`:81–83`) nor *"What the
transport still owes"* (`:157–159`) carries a live-run listing. Both move, and the status line at the
top of the document gains its dated line.
*Test:* a guard deriving every route path literal the app registers — the first argument of each
`app.get(` / `app.post(` in `packages/server/src` — and asserting each appears in that document's
`packages/server` section. Stronger than a string check on two sentences, and it keeps working when a
later ticket adds a route. Shown red by registering a route and not the prose (GO-5).

---

## §4 — Non-goals

1. **The Runs landing screen, and any `fetch` in `apps/web`.** §0.5 measured this as the app's first
   HTTP request, which is a screen's worth of decisions and is Q-0015's neighbourhood. The whole of
   the app's change here is AC-12's sentence.
2. **Reporting a run this daemon did not start.** §0.1 — a CLI run is another process, and
   `GET /history` already reports it as incomplete.
3. **Persisting a handle, a run list or connection state in the browser.**
   `04-architecture.md:194` — *"State from the WebSocket stream; no client-side persistence beyond UI
   preferences."*
4. **Durable handles across a daemon restart.** *"Deliberately meaningless across a restart"*
   (`host.ts:60–64`); resumption is **Q-0019's**.
5. **Pruning, evicting, capping or expiring host records, or paginating the listing.** §0.3 —
   registered, not fixed; see OQ-3 and GO-2. A cap on the listing is worse than none: it would hide
   runs while looking complete.
6. **Widening the row further** — no timestamp, no cost, no duration, no `watchers`, no terminal
   status, no failure or refusal detail, no ticket title, no filtering, sorting options or polling
   hints. Each is refused with its reason in OQ-2 and OQ-5 rather than by omission.
7. **Changing retention, the `missed` count, event ordering, frame shapes or backpressure.** Q-0118's
   and Q-0120's, and AC-11 exercises them unchanged.
8. **Changing `POST /runs`'s refusal table, statuses or classifier.** `WireRun` widens additively;
   nothing else on that route moves.
9. **Giving `packages/server` an `exports` map.** The shapes move to `@quorum/shared` instead —
   Q-0120's precedent, and the cheaper of the two halves Q-0014's gate weighed.
10. **Serving the bundle, a build task for `apps/web`, or `quorum open`.** Q-0122's, with the ruling
    on whether a served bundle is an **emitted artifact**.
11. **Authentication, a non-loopback bind, or a configurable one.** Settled by Q-0118 and
    `serve.ts:19–27`.
12. **Widening the gate answer vocabulary.** Three answers, `.strict()`; Q-0016's to ask for, with an
    entry of its own.
13. **A new external dependency.** Nothing here needs one.

---

## §5 — Open questions

Both candidates' blocking questions are **ruled here**, because each is a scope or authority question
a head of product takes and none is work solutioning cannot start without.

**Ruled — the scope is the daemon, not the screen.** Both candidates recommended it independently;
§0.5 is the measurement behind it, and §4.1 carries it. The cost is stated rather than hidden: see
R-1.

**Ruled — a refused start is not listed, and is not reported absent either.** AC-4 and AC-5 together.
candidate-claude argued for listing refusals as *"what a client most needs to see"*; measured, the
client that needs it **already has it synchronously** in the 4xx body, and no other client was ever
told the handle (§0.4). candidate-codex argued for excluding them and then answering 404
*"no run is registered under that handle"* for one, which is a sentence the host's own records
contradict — the class *"a failed probe read as a proven negative"* that Q-0074 and Q-0115 exist to
remove. The merge takes codex's exclusion and refuses its 404.

**Ruled — no decision entry is owed; the document edit is (AC-13).** A read route over state the host
already holds, in the id space `:id` already names, adds no dependency, no state and no new kind of
surface, and contradicts no landed entry. `04-architecture.md` is a numbered living document, edited
in place — *"When code and docs disagree, the docs are wrong until a DECISIONS entry says
otherwise — fix the docs in the same PR"* — and Q-0118's *"executing a landed document is not
changing the architecture"* is the neighbouring precedent. **If the gate disagrees, the entry lands
at this gate** (GO-1): no step on the chore route may write one, and a loop handed work no agent in
it can perform is this repository's most-recorded failure.

**OQ-1 — the enumeration's exact signature on `RunHost`.** *Owner: solutioning. Non-blocking.*
AC-1 and AC-2 pin the property — one authority for the set of runs, and it is the host — and leave
the shape (a method returning an array, an iterable, or a projection) to the architect, because
Q-0013 deliberately proved a small public surface and the trade is between that surface and a second
call site. Appendix B's counter-argument, that a transport index *"keeps the host's surface at what
Q-0013 proved"*, is answered by the shape rather than dismissed: the enumeration adds no state, no
lifecycle and no failure mode.

**OQ-2 — should a row carry `watchers`?** *Owner: the gate. Recommended: no.* It is already on
`RunView` and is one line, so nothing is foreclosed. It is excluded because it changes nothing a
maintainer does and it churns without any run-state change, which makes a listing row
non-idempotent for no decision — where `pendingGates` changes what a maintainer does, which is why
that one is in.

**OQ-3 — unbounded host records: register, or fix?** *Owner: the gate. Recommended: register, and
open the successor here* (Q-0105's precedent, against the three obligations found in one week living
only inside closed tickets). Pruning is refused on measurement rather than taste: an ended run's
retained buffer is exactly what AC-4 and AC-11 make reachable, so evicting ended records would remove
the thing this ticket adds. AC-3's newest-first order is the only mitigation taken, and it is a
mitigation of the *reading* rather than of the growth.

**OQ-4 — should the listing say how an ended run ended?** *Owner: the gate. Recommended: no.* The
outcome is the terminal event's, which the stream carries and which `.quorum/runs` records and
`GET /history` reports. Putting it on a live-run row would be a second authority for a run's verdict.

**OQ-5 — should a row carry a creation time so a screen can show recency?** *Owner: the gate.
Recommended: no* — candidate-codex's own recommendation, and AC-3's specified order is what carries
recency without widening the contract with a field no screen exists to render.

**Observations** (Q-0117's channel — true, and not claims about this change):

- `RunState` — `refused | running | ended` — is named in no glossary entry, while **Connection
  state** contrasts itself with *"run state"* by name. That predates this ticket. **No term is
  coined here and none is owed**: a listing of live runs invents no vocabulary, and minting one
  reaches `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to write (GO-4).
- The development proxy already forwards `/runs` to the daemon and already steps aside for a page
  navigation, Q-0120 review round 1's B-1 having fixed exactly that prefix collision. **No criterion
  pins it here**, because this ticket adds no fetch and a criterion over behaviour a change does not
  touch can only pass vacuously. Q-0015 inherits it working.
- `packages/server` still declares no `exports`, `main` or `types`, so nothing can import it by name.
  This ticket routes around that through `@quorum/shared` (§4.9) rather than fixing it.

---

## §6 — Risks

**R-1 — under the ruled scope the ticket ships with no user-visible consumer.** A maintainer gains
nothing they can click; what changes is one sentence and a route two suites exercise. *Stated rather
than mitigated away:* AC-11 is the proof the capability is real, AC-12 is the visible change, and the
alternative — bundling the screen — is what turned Q-0013 into three tickets and Q-0014 into two. Say
it at the close rather than presenting the daemon half as the feature.

**R-2 — `WireRun` widens a shape `POST /runs` already answers with, and Q-0118's tests pin it.** The
widening is additive, so assertions reading individual fields survive and an assertion over a whole
key set does not. *Mitigation:* AC-8 requires the 201 body and a listing row to share a key set, which
forces the check rather than leaving it to `integrate`.

**R-3 — the move to `@quorum/shared` fails if the row keeps a `core` type.** That package carries a
browser-safety guard and must not reach `@quorum/core`; `RunView.ticket` is a `TicketRecord`. AC-8's
narrowing to the id is therefore not a presentation choice, it is what makes AC-10 possible at all —
and doing them in the wrong order means writing the move twice.

**R-4 — host records grow for the life of the process, and this ticket makes it visible.** §0.3,
OQ-3, GO-2. Bounded in practice by a single-user local daemon's session length.

**R-5 — AC-11 opens a real socket, which is Q-0102's neighbourhood.** *Mitigation:* `serve.test.ts`
already binds a real port and drives a real WebSocket, so the existing machinery is reused rather than
a second shape written. If the new test proves load-sensitive, it is measured against the thresholds
written into Q-0102's body — not re-run until green.

**R-6 — a listing is a new place to leak.** `RunView` carries a whole ticket, its gate questions, a
failure string and a refusal. AC-9 is the guard and it asserts over serialised bytes.

---

## §7 — Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a. No code path here reads an environment variable and no dependency is added; nothing in a `WireRun` could carry a credential. |
| **Safety by construction** | n/a to worktrees, load-bearing for reads. Both routes are GETs (AC-6): they start nothing, answer no gate, take and release no run lock, and write no file. |
| **Human-gated by default** | Unchanged, and improved in the only way this ticket can — AC-8's `pendingGates` makes a run waiting for a human discoverable. No gate is answered, none is auto-advanced, and the answer vocabulary stays three. |
| **Files are the database** | Nothing is persisted. The listing is derived per request from in-memory host state with no cache (AC-4), the discipline `read.ts` already applies to containment and push lag. Durable run history stays under `.quorum/runs/` and stays at `/history`. |
| **Cross-vendor rule** | n/a — no flow, role or adapter changes. |
| **Product-agnostic** | n/a — nothing here names a product. |
| **The cold-clone test** | No impact: no dependency, no install step, no new command, no change to either claimed installation path. |
| **Errors are explicit** | AC-5's 404 carries `code`, `condition` and `remedy` and its condition is true of the case it answers; AC-10's schemas refuse a malformed row rather than defaulting it; a refusal's condition stays in `core`'s own words per *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07). |
| **File format / schema** | `@quorum/shared` gains two wire schemas and an envelope schema (AC-10). No on-disk format changes. |
| **Lint rules** | None added. `eslint.config.js` already covers `packages/**/*.ts` and `apps/**/*.ts{,x}`. |

---

## §8 — Gate obligations

**GO-1 — rule the decision-entry question.** §5 rules that none is owed and the document edit is. If
the gate disagrees, **the entry lands at this gate**, before the implement step: no step on the chore
route may write one.

**GO-2 — open OQ-3's successor here**, not in a closing entry: host records are never pruned and this
ticket is the first thing that makes that visible.

**GO-3 — confirm the two field renames are the gate's**, `ticketId` and `pendingGates`, since a wire
shape consumed by a browser parser is expensive to rename later.

**GO-4 — record that no glossary term is coined and none is owed**, per §5's observation, so a later
reader does not re-litigate it.

**GO-5 — show AC-13's guard red before trusting it**, by registering a route without the prose. A
guard over documentation that has already been corrected can pass vacuously.

**GO-6 — verify forced in both environment rows after the merge** (Q-0072's closing finding): in the
integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` —
`pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`.

---

## §9 — Provenance

**candidate-claude** contributed the shape of the document and four things the merge keeps whole:
§0.1's refutation of the CLI clause (measured, and it removes a case this ticket could not have
closed), §0.5's *"`apps/web` makes no HTTP request at all"* — which is the single best argument for
the ruled scope — AC-2's **behavioural** discriminator between a host enumeration and a transport
index, which is the strongest criterion in either candidate, and AC-13's route-literal guard in place
of a string check on two sentences. Its §0.3 (records never pruned) and §0.4 (a refused run is the
one that cannot be backed) are both kept, and §0.4's conclusion is the one thing the merge reverses.

**candidate-codex** contributed the listing's selection rule — runs the host can back, refusals
excluded — which the merge takes and re-argues on a fact neither candidate had (`POST /runs` never
discloses a refused handle); the specified **reverse creation order**, with its reason that a screen
should not need a timestamp to show recency; the one-projection rule binding `POST /runs` and both
new routes to one shape; the envelope schema for the listing; and the requirement that the routes are
mounted over the *same* host with no second registry.

**What the merge changed in both.**
- `WireRun.state` is declared `string` today (§0.2), which neither measured: it narrows to the
  host's **three** members, not codex's two, because AC-5's lookup answers a refused handle.
- codex's AC-8 would answer 404 *"no run is registered under that handle"* for a refused start the
  host **does** register. Refused: AC-5 answers it honestly and reserves 404 for a handle never
  minted.
- claude's `ticket` and `gates` field names are renamed `ticketId` and `pendingGates`: a wire field
  that narrows `RunView.ticket` (a whole `TicketRecord`) or `RunView.gates` (an array of questions)
  may not keep its name. `watchers` is dropped with its reason (OQ-2); `pendingGates` is kept with
  its reason (AC-8).
- codex's twenty criteria become thirteen. AC-17 is a test inventory — each case is already implied
  by the criterion it serves, and a criterion whose subject is *"tests exist"* has no failure mode of
  its own; AC-18 is the gate's verification obligation and is now GO-6; AC-20 is the cross-cutting
  checklist and is now §7.
- claude's AC-14 (the development-proxy pin) is struck: this ticket adds no fetch, so it pins
  behaviour the change does not touch, and its own GO admitted it could pass vacuously. Recorded as
  an observation instead.
- Both candidates' blocking open questions are **ruled** rather than returned: the scope (both
  recommended the same thing), the host-versus-transport authority (both recommended the same thing,
  and the property is now pinned by two criteria while the signature stays solutioning's), and the
  decision entry.
