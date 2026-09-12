---
id: Q-0121
title: The daemon reports its live runs
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0121/integration
priority: p2
created: 2026-09-11
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-12T11:37:59.273Z
    cost: 9.397
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-12T12:30:20.350Z
    cost: 42.307
---
Successor B of Q-0014, from Appendix B. RunHost exposes view(handle) and no enumeration, and no route exposes even that, so a browser that refreshes has lost every live run and DEFAULT_RETENTION's late-joiner buffer is unreachable.

Opened **2026-09-11 at Q-0014's requirements gate**, transcribed **in full** from that ticket's
merged requirement rather than referenced — three obligations found in one week (Q-0110, Q-0111,
Q-0112) had lived only inside a closed ticket's prose or a source comment.

**Allocated at the allocator's next id**, not a planned one: M3's `Q-0015`–`Q-0019` are the screens.

## Transcribed from Q-0014, Appendix B

**Problem.** `RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that. Nine
routes are registered and `POST /runs` is the only one that ever tells a client a handle (§1.9). A
browser that refreshes has lost every live run, and `DEFAULT_RETENTION`'s late-joiner buffer — built
precisely for *"a browser opened after a run began, or reopened after a refresh"* — is unreachable,
because the reopened browser cannot name the run.

**What it owes.** A `GET /runs` listing the host's live runs as `WireRun`s and a `GET /runs/:id`
answering one. Both are reads over state the host already holds; neither adds domain logic. The open
question is whether `RunHost` gains an enumeration or the transport keeps its own index — the first is
where the state is, the second keeps the host's surface at what Q-0013 proved.

**What it must not do.** Persist a handle in the browser — `04-architecture.md:183` permits no
client-side persistence beyond UI preferences. And it must not report a run it cannot back: a handle
whose stream has ended is `ended`, a state `RunView` already carries, not an absence.

**Sequencing.** After Q-0014, which creates a browser that can reload, and before or with Q-0015.

---

## Re-measured against the tree, 2026-09-12, before the run

The body above was transcribed at **Q-0014's** requirements gate on 2026-09-11. **Q-0120 shipped on
2026-09-12**, between that gate and this run, and it moves two of the sentences above. Nothing here
withdraws the ticket: the defect is real and unfixed, and what changes is *who* cannot reach a live
run and *what a listing would have to carry*.

**(a) "A browser that refreshes has lost every live run" is no longer true as written.** Q-0120
shipped `/runs/:handle` as a route (`apps/web/src/routes.ts:124`) and `app.tsx` reads the handle out
of the matched route's params and connects on it — so an ordinary reload keeps the handle in the URL
bar, reconnects, and **does** reach `DEFAULT_RETENTION`'s buffer, `missed` count and all
(`broadcast.ts:156`, `retain = 500` at `serve.ts:43`). What is unreachable is a client **that never
held the handle**: a fresh tab, a second browser, a tab whose URL was closed, the `/runs` landing
route itself, and — the ordinary case today — **any run started from the CLI**, which no browser
learns of at all. The defect is *discovery*, not *survival*, and a criterion written against the
original sentence would aim at a case Q-0120 already closed.

**(b) The shipped app already names this gap as its reason for being empty.** `routes.ts:117`'s
`/runs` landing entry carries, verbatim, *"No ticket builds this screen yet, and the daemon reports
no listing of its live runs, so there is nothing here to list."* That is a live consumer of this
ticket's deliverable and the one place a user meets the defect, so whichever half of that sentence
this ticket makes false is the half that moves with it.

**(c) `WireRun` cannot carry a listing as it stands.** `wire.ts:WireRun` is exactly
`{handle, flow, runId, state}` — **no ticket id**. `RunView` holds `ticket: TicketRecord | null`,
`gates`, `watchers`, `failure`, `refusal` and `terminal`, none of which crosses the wire today. So
*"listing the host's live runs as `WireRun`s"* is under-specified rather than settled: a Runs
landing screen that cannot say **which ticket** each run is against lists handles nobody can read.
What a listing row carries is a design question for the gate, and widening `WireRun` is a change to
a shape `POST /runs` already answers with.

**(d) An inherited obligation this ticket is named in.** `packages/server/src/wire.ts`'s header says
of `WireRefusal` and `WireRun`: *"whoever needs them from a browser (Q-0015 or Q-0121) moves them
the same way rather than copying them"* — the way being `@quorum/shared`, where Q-0120 put
`WireMessage` and its schema, because a browser needs a runtime **parser** and not a type. If this
ticket's listing is consumed by `apps/web`, that move is this ticket's, and copying the interface
into the app is the drift Q-0120's own body was opened on.

**(e) Two citations verified, one corrected.** *"Nine routes are registered"* holds — three POSTs
(`http.ts:122,141,156`), the WebSocket (`serve.ts:99`) and five GETs (`read.ts:76,82,97,120,140`) —
and `POST /runs` is still the only one that ever tells a client a handle. `RunHost` still exposes
`view(handle)` and no enumeration (`host.ts`). The no-client-side-persistence rule is at
**`04-architecture.md:194`**, not `:183`; the line moved, the sentence did not — *"State from the
WebSocket stream; no client-side persistence beyond UI preferences."*

## Ruled at the requirements gate, 2026-09-12

The merged requirement was approved `advance` and all four of the gate's own obligations are
discharged here, before the chore run, rather than left for a closing entry. The two that belong to
the implementer — GO-5, show AC-13's guard red by registering a route without the prose, and GO-6,
verify forced in both environment rows after the merge — are unchanged and stay where they are.

**GO-1 — no decision entry is owed, and the document edit is.** §5's ruling is taken as written. The
two routes are reads over state the host already holds, in the id space `:id` already names; they add
no dependency, no state and no new kind of surface, and contradict no landed entry. What they do
contradict is `docs/04-architecture.md`, which lists the transport's routes in two places
(`:81–83`'s *"Three routes and one socket"* and `:157–159`'s *"What the transport still owes"*) and
carries a live-run listing in neither — verified by hand at this gate. That is a numbered living
document, and *"When code and docs disagree, the docs are wrong until a DECISIONS entry says
otherwise — fix the docs in the same PR"* is the rule that governs it. AC-13 is the whole of the
remedy. Q-0118's *"executing a landed document is not changing the architecture"* is the
neighbouring precedent read the other way round, and it is narrower than it sounds: **adding a route
a landed document does not list is a document edit; adding a dependency, a surface or a state it
does not contemplate would not be.**

**GO-2 — discharged: the successor is `Q-0123`**, *"A run host record is never released, and a
listing makes it visible"*, opened at this gate with its body written out in full and allocated at
the allocator's next id. Q-0121 registers §0.3's growth and does not fix it; the reason pruning was
refused — an ended run's retained buffer is exactly what AC-4 and AC-11 make reachable, so evicting
ended records would remove what this ticket adds — is written into that ticket so it is not
rediscovered and undone.

**GO-3 — confirmed as specified.** `WireRun` becomes
`{handle, flow, ticketId, runId, state, pendingGates}`. Both renames are ratified rather than
inherited: `ticketId` narrows `RunView.ticket`, which is a whole `TicketRecord`, and `pendingGates`
narrows `RunView.gates`, which is an array of `GateQuestionEvent` — **a wire field that narrows a
`RunView` field may not keep that field's name**, because the name would then promise what the wire
does not carry. `watchers` stays off the row on OQ-2's reasoning, which the gate also takes: it
changes nothing a maintainer does and it churns without any run-state change, which would make a
listing row non-idempotent for no decision. `state` narrows from today's `string` (§0.2, verified at
this gate — `wire.ts:116` is `readonly state: string`) to the host's closed three.

**GO-4 — recorded: no glossary term is coined here and none is owed.** A listing of live runs invents
no vocabulary — every noun it uses (**run**, **gate**, **flow**, **ticket**, **connection state**) is
already in `docs/GLOSSARY.md` — and minting one would reach `CLAUDE.md`'s term list, which Q-0103
erratum E-2 makes the human's to write, at the cost of a second gate. §5's observation stands and is
**not** work this ticket takes: `RunState` — `refused | running | ended` — is named in no glossary
entry while **Connection state** contrasts itself with *"run state"* by name. That predates this
ticket, is not created by it, and a later reader meeting the gap should read this paragraph rather
than re-litigating it.

**One correction to the merged document, which changes no criterion.** §0.1 reports that
`grep -rn "@quorum/server"` *"returns no source file in the workspace — every hit is under
`backlog/`"*. Re-run at this gate, it returns seven hits under `packages/server` itself: its own
manifest name, its own two suites asserting that name, and three of its own module headers. **No
file outside the package names it**, which is the claim the criteria rest on and which holds; the
sentence as written is one step stronger than what was measured. Recorded here rather than in an
erratum, because no criterion depends on the difference and *"An erratum is the last repair, not the
first"* (2026-08-30).

**The route is the chore flow**, taken at this gate. Q-0120 walked the full seven-stage route and
that measurement is not repeated here: this is thirteen criteria over two read routes and a shape
move, the work the chore flow was made for, and M2's closing finding — that the pipeline's evidence
is thin — is an argument for exercising it on a ticket with behaviour to prove, which Q-0122's
served bundle and Q-0015's screen both have and this one does not.
