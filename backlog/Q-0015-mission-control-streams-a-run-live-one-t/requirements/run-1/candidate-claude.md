# Q-0015 — Mission control streams a run live, one trace column per step

*Requirements, run 1, 2026-09-16. Surface: `apps/web` (the browser), plus one new read and one new
write in `apps/web/src/daemon-client.ts` against routes that already exist. No `core` change, no new
daemon route, no new wire shape.*

---

## 0. What was measured, before anything was specified

Every figure here was taken from the tree during this run. Where it agrees with the ticket body that
is stated; where it does not, the body is corrected; and §0.9 is a finding neither the body, the
plan, nor the design brief has.

### 0.1 The ticket body is confirmed on its decisive enabling fact

Each parallel member and each fan-out child stamps its own `stepId` on every adapter event
(`packages/core/src/engine/steps.ts:289`), and the run loop's slot fills one in only where the
emitter supplied none (`engine.ts:87`). A `parallel:` container carries no id (`engine.ts:370`); a
fan-out child is named `<step>:<task.id>` (`composite.ts:144`). Confirmed by reading all four sites.

**A hazard was checked and refuted.** `withStepId` (`engine.ts:76–93`) switches on the event type and
stamps only `spawn`, `stdout` and `retry`; `default:` passes the event through untouched. Had it
stamped an `info`, that event would carry an unknown key against `infoEventSchema`'s `.strict()`,
`parseFrame` would answer `invalid-event`, and — since Q-0120 round 2's M-4 — **a refused frame ends
the socket**. Mission control would have died on the first `info` of any agent step. It cannot: the
switch is exhaustive in the right direction. Recorded because the next reader of `withStepId` should
not have to re-derive that the `default:` branch is load-bearing.

### 0.2 `done` is emitted three times, and never on a failure path

This is the measurement the ticket body does not have, and it changes the timeline half of the work.

| | sites |
| --- | --- |
| `step` | **4** — agent step dry (`steps.ts:260`), agent step live (`:277`), script (`:384`), integrate (`composite.ts:243`) |
| `done` | **3** — agent step success (`steps.ts:353`), script exit 0 (`:394`), integrate success (`composite.ts:413–417`) |

Every failure path emits **no** `done`: an agent step that threw re-throws at `steps.ts:306`, a
script with a non-zero exit emits a `warn` at `:402`, and an integrate that aborts returns at
`composite.ts:410`. **So the absence of a `done` is not evidence that a step is running.** A timeline
built from `step`/`done` and rendering everything unpaired as *running* would report a failed step as
in flight for the rest of the session — on the screen whose entire job is saying what a run is doing.

**A fan-out parent emits neither.** `runFanOut` (`composite.ts:175–235`) emits only `info` and
`warn`; its id crosses as a message prefix and nowhere else. Its children each go through
`runAgentStep` and so do appear. A timeline that expected a parent row would render nothing for it.

### 0.3 The events with no `stepId` are a permanent, populated stream — not an edge case

OQ-4 supposes a step that happens to carry no id. Measured, the larger fact is that four of the nine
event kinds carry no `stepId` **field at all** by design — `info`, `warn`, `gate`, `terminal` — and
that the engine routes a great deal through them:

| kind | emit sites in `packages/core/src` | of which carry `<stepId>: ` in the message text |
| --- | --- | --- |
| `info` | 15 | 9 |
| `warn` | 22 | 8 |

So **17 of 37 `info`/`warn` sites name a step in prose and 20 do not**, and nothing on the wire
attributes any of them. Worktree creation, base sync, wave composition, merge conflicts, committed
file counts and every `warn` a step raises are in this stream. A screen that dropped it would drop
most of what a run says about itself.

### 0.4 What a trace column actually contains, against what the brief draws

`docs/05-design-prompt.md:39` specifies columns "streaming believable agent events (tool calls like
`Edit src/billing/plans.ts`, `Bash npm test — 34 passed`, short assistant reasoning snippets)".

`packages/shared/src/events.ts:25` says in its own table: **`tool`, `text` — emitted by nothing — NOT
ADDED**, and the paragraph beneath it refuses to invent them. What a column can contain is `spawn`,
`stdout`, `step`, `done` and `retry`. A `stdout` event is one line of the vendor CLI's stdout,
verbatim.

**And the two vendors are structurally asymmetric, which no account of this screen has recorded.**
`claude.ts:108–118` runs with `--output-format json` and the result is parsed as **one** JSON
document (`JSON.parse(result.stdout)`, `:125`), so a claude step's `stdout` events are however many
lines one JSON envelope occupies. `codex.ts:100–126` runs with `--json` and parses **per line** as
JSONL, emitting one `stdout` per line. The brief's two side-by-side columns "each streaming" are
therefore not what the stream produces: one column scrolls and the other does not.

The count per step is **not derivable from run history** — the body is right about that, and it was
re-checked: `.quorum/runs/<id>/steps/<n>-<step>/` holds `prompt.txt` and `output.txt` and no stream.
No criterion below rests on a per-run event count.

### 0.5 Of the brief's five per-column values, exactly one is a field

`vendor` is on `spawnEventSchema` and a `spawn` is stamped with its step id, so **the vendor badge is
derivable per column**. The other four are not:

- **model** crosses inside the `step` message, `` `${adapterName}/${model} role=${role}` `` (`steps.ts:257`);
- **worktree branch** inside an `info` message, `` `${stepId}: worktree ${cwd} (${branch})` `` (`:225`);
- **cost** inside the `done` message via `formatCost` (`:127–133`, `:353`) — `cost=$0.123`, or
  `cost=n/a (<n> tokens, vendor reports no price)`;
- **token count** only inside that same sentence.

Reading any of them means a regex over prose, which ground rule 2 forbids and which Q-0129 carries
for the verdict. There is a second, independent bar: `apps/web/test/source.test.ts:271–294` forbids
`tokensByVendor`, `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` in
**any** file under `src`. A per-vendor cost ticker cannot be built here without moving a shipped
guard, which is a decision and not a criterion.

### 0.6 The header's three absent values, re-verified

- **The run number is `null` for the whole life of a live run.** `host.ts:304` assigns `record.runId`
  in the terminal-event branch alone, under a JSDoc (`:101–107`) saying so. Confirmed.
  **One correction to the body, in the useful direction:** `runTerminalEventSchema` carries
  `runId: z.number()`, so the number arrives **on the stream** when the run ends and needs no fetch —
  it is absent exactly while it would be useful and present once it is not.
- **Elapsed has no source.** `events.ts:143`: the union "deliberately adds no timestamp or sequence
  number". `WireRun` carries no start time. Confirmed.
- **The cost ticker** — §0.5.

### 0.7 The browser's event list, and the obligation this ticket inherits

`run-connection.ts:151` is `events = [...events, result.frame.event]`, and the comment above it
(`:143–150`) names this ticket by id: the copy is deliberate, so a handed-out snapshot never changes
under its holder, *"and Q-0015 renders mission control from this same snapshot … the cap question
AC-19 deliberately leaves open is where this belongs, with a measurement behind it."* So OQ-3 is an
inherited obligation with a named owner, not a fresh question.

Nothing renders the list today: `shell.tsx:96` reads `.at(-1)` and `:113` reads `.length`.

The daemon's own bound is separate and already disclosed: `DEFAULT_RETENTION = 500`
(`serve.ts:47`), evicted from the head in `broadcast.ts`'s `publish`, surfaced as `missed` and held
in `RunConnectionSnapshot.missedCount`.

### 0.8 The registers this ticket moves, named exactly

- `apps/web/test/source.test.ts:200–207` — `WRITE_RULES`, six needles. `'/stop'` is
  `permitted: null`. Two anti-vacuity clauses ride on it: `:234–235` asserts
  `writeOffenders(false)` is exactly the two named modules, and `:241` asserts the stop needle's
  `permitted` is `null` under the message *"stopping a run became permitted"*. Both move, by design.
- `apps/web/src/routes.ts:191–196` — mission control, `screenExists: false`, `ticket: 'Q-0015'`;
  `:182–189` — the runs landing, `ticket: null`, whose sentence reads *"what this route waits for is
  a screen that reads that listing"*; `:125` — the `runs` rail entry, `screenExists: false`.
- `apps/web/test/routes.test.ts:95` — *"exactly one entry is marked as having a screen"*; `:125` —
  *"exactly three route rows claim a screen"*; `:307` — every route-path literal a component carries
  must be one the register holds.
- `packages/shared`'s barrel already exports `wireRunListSchema` (`index.ts:19`, `export * from
  './wire.js'`) and **nothing outside `packages/server`'s own tests consumes it.** The listing needs
  no new shape.

### 0.9 The finding this run exists for: mission control has no producer

`host.start` has **exactly one** production caller in the workspace: `POST /runs`, at
`packages/server/src/http.ts:178`. Verified by search across `packages/server/src`,
`packages/cli/src` and `apps/web/src`.

- **`apps/web` never issues it.** The one non-GET this app makes is the gate answer, and
  `source.test.ts`'s `WRITE_RULES` permits `POST` in `daemon-client.ts` alone. The shell's *Run flow*
  control is `disabled` (`shell.tsx:140`), and `backlog-board.tsx:19–24` refuses the brief's *"Run
  next flow ▸"* button deliberately.
- **`quorum run` is a different process.** `packages/cli/src/run.ts` imports `runFlow` from
  `@quorum/core` and consumes its stream in-process; it does not import `@quorum/server`.
  `quorum open` (`packages/cli/src/open.ts:263`) starts `createDaemon` and nothing else. Q-0121's own
  requirements run measured the same thing from the other side — `records` is a `Map` local to one
  `createRunHost` closure — and its bullet says the listing *"will be silent about the CLI's runs,
  correctly"*.

**So on a real machine today the daemon's run registry is empty and stays empty.** `GET /runs`
answers `{"runs": []}`; `/runs/:handle` is reachable only with a handle that exists, and none does.

This does not block the ticket, and it is not a reason to weaken it. The screen is fully buildable
and fully testable against a driven socket and a driven fetcher, which is how every screen in this
app is already tested. What it changes is three things, and each is carried into a criterion below:

1. **The acceptance evidence must say how a run was produced.** "Open the browser on a real run" is
   not available; a hand `POST /runs` against a running daemon is (AC-15's verification clause).
2. **The `/runs` landing's empty state is the honest state of a real machine**, and it must name the
   cause rather than reading as a failure (AC-13).
3. **A successor is owed** — starting a run from the browser — and it is written out in Appendix A
   rather than left in this document to expire.

---

## 1. Problem

A run in flight is invisible. The daemon has streamed events over a WebSocket since Q-0118 and the
browser has held that socket since Q-0120, but the only thing rendered from it is four items in the
top bar: a state word, a missed count, an event count and the latest event's identity
(`shell.tsx:94–125`). Everything the run says — which step is speaking, what its vendor printed, what
a step's verdict and cost were, which steps have finished — is accepted into an array and shown to
nobody.

Two shipped things are unreachable because of it. `/runs/:handle/gate` shipped at Q-0016 and is
reached only by typing a URL; `GET /runs` shipped at Q-0121 and has had no consumer since, its own
R-1 recording that it shipped with none and naming this ticket as what would read it.

And a distinct, structural gap sits underneath: **nothing produces a run for the daemon to show**
(§0.9). A screen for watching runs and no way to start one are two halves of one hole; this ticket
takes the half the other half depends on, which is the ordering `backlog-board.tsx:23` already
argued — *"starting a run needs somewhere to watch it, which is Q-0015's"*.

## 2. User stories

**`maintainer`** — *"I started a flow and I want to see what it is doing, per step, while it does
it."* I open the run and get one column per concurrent step with that step's own output in it, a
timeline of what has started and what has finished, everything the run said that belongs to no step,
and — when it stops to ask me something — a way to get to the question. If it is doing something I
do not want, I can stop it.

**`maintainer`** — *"I want to know what I am not being shown."* I would rather read *"this trace
begins 340 events in, because the browser joined late"* than a column that looks complete. I would
rather read *"the run's number is not on the wire until it ends"* than a header showing `run #—`.

**`adopter`** — *"I ran `quorum open` and the Runs screen is empty."* I want to be told that the
daemon is driving no runs and **why one might be absent** — that this app does not start runs yet and
that a `quorum run` in my terminal is a different process this daemon cannot see — rather than
wondering whether something is broken.

## 3. Acceptance criteria

Fifteen. AC-1, AC-2, AC-4 and AC-10 are named as **not eligible for trimming**: the first three are
what this screen is, and the fourth is the only act on it that changes anything.

---

**AC-1 — One trace column per step id, and two concurrent members are distinguishable.**
`/runs/:handle` renders the accepted events grouped by their `stepId` field: one column per distinct
id, ordered by first appearance, each holding that id's events in arrival order. A column renders
`spawn`, `stdout`, `step`, `done` and `retry`; a `stdout` line is rendered verbatim as the text it
is.
*Test:* drive `App` with a fake socket carrying events for two ids **interleaved** —
`dev:T-0001.1` and `dev:T-0001.2`, alternating — and assert two columns, each holding only its own
events, with within-column order preserved. **The interleaving is load-bearing:** two ids arriving in
two contiguous blocks would also pass over a renderer that opened a new column on every change of id.
This is the first consumer ever to read those ids — Q-0050 round 6's Major 1 was fixed against a
stubbed `runAgentStep` — so a second clause asserts that a fixture in which both members carry the
*same* id renders **one** column, which is what the pre-fix engine produced.

**AC-2 — The run-level lane, and nothing is dropped.**
Every event with no `stepId` **field** — `info`, `warn`, `gate`, `terminal` — renders in one
run-level lane beside the columns, in arrival order. The `<stepId>: ` prefix that 17 of 37
`info`/`warn` sites carry in their message text (§0.3) is **not** parsed to re-attribute an event to
a column: ground rule 2, and a message is not a contract.
*Test:* a fixture carrying one of each of the four, one of them with a `dev:T-0001.1: ` prefix;
assert all four in the lane, assert the prefixed one is in the lane and **not** in that step's
column, and assert `lane.length + Σ column.length === snapshot.events.length`, which is the clause
that makes *"nothing is dropped"* checkable rather than asserted.

**AC-3 — The vendor is a badge; the model, the branch, the token count and the cost are not.**
A column whose events include a `spawn` shows that `spawn`'s `vendor`. A column with none yet shows
no vendor rather than a guess. Nothing on the screen renders a model, a worktree branch, a token
count or a cost.
*Test:* a two-column fixture, one with a `spawn` and one without, asserts the badge and its absence.
Plus a source clause over every file under `apps/web/src`: none contains `cost=`, `role=`, `verdict=`
or `tokens` as a literal, which is ground rule 2 held as a property of the source rather than of one
render. The clause is shown to discriminate over a fixture containing `` `cost=$0.123` ``.

**AC-4 — The timeline reports started and ended, and never calls a failed step running.**
Built from `step` and `done`. Given §0.2, a step has exactly three dispositions and the third is
named rather than collapsed into either neighbour: **started**, **ended** (rendering the `done`
message), and **started, with no end reported**. Once a `terminal` event has arrived, every step in
the third disposition renders as one the run ended without reporting an end for — never as running.
*Test:* three fixtures — a `step` alone; a `step` then its `done`; a `step` with no `done` followed by
a `terminal` — each asserting the rendered disposition. A fourth asserts that reverting the third
disposition to *running* turns the third fixture red, so the distinction has a subject.

**AC-5 — Every connection state renders something a reader can act on, in the main region.**
The nine members of `ConnectionState` are already sentenced by `connectionStateText` and already
shown in the top bar. This criterion is about the **main region**, which must never be blank: where
the connection is not `live` and no event has been accepted, the region renders that state's sentence
and, where `canRetry` is true, the Retry the top bar offers. `no-such-run` renders no columns at all
rather than empty ones.
*Test:* nine assertions, one per state kind, each asserting non-empty rendered text in the main
region; plus one asserting `no-such-run` renders zero columns.

**AC-6 — The screen names the five things it does not show, and shows no substitute for any of them.**
One region, five sentences, each naming the reason in a clause:

1. **the run's number** — `null` on the wire until the run ends (`host.ts:304`); the **handle** is
   what identifies the run meanwhile, and the number renders once a `terminal` carries it;
2. **elapsed** — no event carries a timestamp, by *"What a run's event stream carries"* (2026-08-28);
3. **per-vendor cost** — it crosses only inside a `done` message (§0.5), and Q-0129 is its neighbour;
4. **what comes next in the flow** — no route on this transport serves a flow's step list
   (`WireFlow` carries `name`, `runnable`, `consumes`, `produces`, `problems` and no steps), so the
   brief's *"integrate (queued)"* is a value nobody measured;
5. **structured tool calls and assistant reasoning** — `tool` and `text` are emitted by nothing
   (`events.ts:25`); what a column carries is the vendor's stdout.

No dash, no zero, no currency symbol, no spinner and no skeleton stands in for any of them
(`docs/04-architecture.md:336`).
*Test:* assert the five sentences render on a live-run fixture; assert the header region's text
matches none of `—`, `$`, `0:00`, `n/a`; assert the run-number region shows the handle before a
`terminal` and the number after one.

**AC-7 — The missed count is disclosed as a gap in this trace, in its own words.**
Where `missedCount` is non-null and non-zero, the screen says that this trace begins partway through
and names the count: these are events the daemon evicted before this browser subscribed
(`DEFAULT_RETENTION` 500, head eviction). The sentence is distinct from AC-8's and neither is
phrased so that a reader could take one for the other.
*Test:* a fixture with a `missed` frame asserts the sentence and the count; a byte-level clause
asserts the two sentences share no distinguishing phrase.

**AC-8 — What is rendered is bounded; what is retained is not; and both are said.**
No cap is placed on the accepted event list — a cap would discard a run's own history in the one
screen built to show it, and the list is what Q-0120's AC-19 left open. Each **column** renders its
most recent *N* events, with the number not shown named beside it and a control that shows them. The
retained list is unchanged and the snapshot still holds everything.
*Test:* a fixture with *N + k* events in one column asserts exactly *N* rendered, asserts *k* is named
in the rendered text, and asserts `snapshot.events.length === N + k`.
*Registered and not fixed:* `run-connection.ts:151` copies the array per event, so accumulation is
quadratic in the length of the run. It is bounded at `DEFAULT_RETENTION` for a browser that joins
late and unbounded for one present from the start. Changing it means changing the snapshot
immutability Q-0120 argued for deliberately, which is that module's decision and not this screen's;
**Q-0123 is its sibling** — a thing nothing releases, measured rather than called small.

**AC-9 — The gate link, which closes the loop Q-0016 left open.**
Where the lane holds a `gate` event and no `terminal` has arrived, the screen offers a link to that
gate's screen for this handle. The link is built by substitution into `GATE_ROUTE` — a `gatePath`
beside the existing `ticketPath` — so no component carries a route-path literal the register does not
hold (`routes.test.ts:307`). Following it navigates; it answers nothing.
*Test:* a fixture with a `gate` event asserts the link and its `href`; one without asserts its
absence; one with a `gate` followed by a `terminal` asserts its absence. Plus the existing
route-literal scan, unchanged and still passing.

**AC-10 — Stopping a run, over the route that exists.**
`POST /runs/:id/stop` with an optional `{"reason"}`. `daemon-endpoints.ts` gains a `/stop` segment as
a named constant and `runStopPath(handle)` beside `runGatePath`, on that function's own stated
precedent — *"an exemption that forgives a string nobody wrote would forgive nothing, so the string
is written"*. `daemon-client.ts` gains one function recognising **204 before any body is read**, as
`answerGate` does, and mapping the three refusals by their codes rather than by status:
`no-such-run` 404, `not-running` 409, `not-a-reason` 400.
*Test:* one case per outcome, each asserting the rendered sentence differs; and one asserting a 2xx
that is not 204 is reported rather than taken for success, which is `answerGate`'s own rule.

**AC-11 — Stopping is deliberate, single, and not confused with a gate answer.**
The control asks for confirmation before it sends, because the act is irreversible and the screen is
one a reader leaves open. At most one stop is in flight: the control is disabled while it is
outstanding, and the outcome is rendered from the daemon's answer rather than assumed. The wording
never uses `abort`, `advance` or `retry`: a stop cancels the run through its `AbortSignal` and is not
one of the three words a gate takes.
*Test:* a fixture asserting a second activation while one is in flight sends nothing — which is
Q-0016's blocker on this screen's own irreversible act, and it must not be found by a reviewer twice.
A source clause asserts no gate-answer word labels the control.

**AC-12 — The read-only guard is re-aimed, never deleted, and by exactly one act.**
`WRITE_RULES`'s `'/stop'` row gains `permitted: 'daemon-endpoints.ts'`; `method: 'POST'` keeps
`daemon-client.ts`; `PUT`, `PATCH` and `DELETE` keep `permitted: null`. The two anti-vacuity clauses
move with it: `writeOffenders(false)` becomes the three named modules, and `:241`'s
`toBeNull()` on the stop needle is **replaced by one naming the module**, not removed. The board and
the ticket page still may not write.
*Test:* the identity as it now reads; the permitted set as exactly three entries; and a clause
asserting `PUT`/`PATCH`/`DELETE` remain `null`, so a family was not opened where one act was asked
for.

**AC-13 — The runs landing at `/runs`, and an empty host that says why.**
`GET /runs` through `requestJson` and `wireRunListSchema`, which is already on the shared barrel and
has no browser consumer. Rows render in the order the daemon gave them and are **not re-sorted**:
that order is the only recency the wire carries, the handle is opaque, and sorting on it would invent
one. Each row shows handle, flow, ticket id or the explicit absence, state and pending-gate count,
and links to `/runs/:handle`. The four request states reuse `request-state.ts` verbatim.
**An empty listing is `200 {"runs": []}`** and renders *the daemon is driving no runs* — never an
error — **and names why one may be absent**: nothing in this app starts a run, and a `quorum run` is
a different process this daemon cannot see (§0.9).
*Test:* loaded, empty, refused and in-flight; an ordering clause over a fixture whose rows are not in
handle order; and the empty sentence asserted with its cause clause present, since the sentence
without it is the one that reads as a failure.

**AC-14 — The registers move, and their identities move with them.**
`routes.ts`: `/runs/:handle` → `screenExists: true`; `/runs` → `screenExists: true` and
`ticket: 'Q-0015'`, its `waitingFor` replaced rather than emptied, per that file's own rule that a
row whose sentence had been emptied would make a later `false` silent; `RAIL`'s `runs` entry →
`screenExists: true`. `app.tsx` selects both screens by register constant, on `BOARD_PATH`'s and
`TICKET_ROUTE`'s precedent, which means `routes.ts` exports the mission-control pattern by name.
`routes.test.ts`: *"exactly one rail entry"* becomes two, *"exactly three route rows claim a screen"*
becomes five, and the `/runs` row's *"No ticket builds this screen yet"* clause is rewritten.
*Test:* each identity as it now reads, and one asserting the two new `screenExists` rows are the two
this ticket built.

**AC-15 — Documentation, and the verification this ticket's own subject makes awkward.**
`docs/04-architecture.md`'s M3 section and this ticket's bullet in `docs/06-development-plan.md`. No
decision entry (GO-1).
*Verification, stated because §0.9 makes it non-obvious:* the screen is demonstrated against a
running daemon by starting a run with a hand `POST /runs` and opening `/runs/<handle>` — the evidence
records the request that produced the run, because *"open the browser on a real run"* is not
available on this workspace and a report claiming it would be claiming something nobody did. The
suites run forced in both environment rows.

---

## 4. Non-goals

The gate screen (Q-0016, shipped) and its verdict and diff (Q-0129). Step chat (Q-0022), including
the `/runs/:handle/steps/:stepId` route already registered for it. Run history (Q-0018) and resume
(Q-0019). **Starting a run from the browser** — Appendix A. The header's three absent values and the
per-vendor cost ticker — Appendix A, and see §5 OQ-1. Any change to the event union, including a
timestamp or a sequence number. Any change to the gate answer set. A cap on the accepted event list,
or a change to `run-connection.ts`'s snapshot immutability (AC-8's register). A queued-step timeline,
which needs a flow's step list no route serves. Polling, persistence, authentication. Any parse of a
`done`, `step`, `info` or `warn` message for a machine value.

## 5. Open questions

**OQ-1 — the header's three absent values. RULED: none of them is taken here.** The run number is
`null` for the life of a live run and arrives on the terminal event when the run ends, so it is shown
then and the handle stands for it meanwhile (AC-6). Elapsed has no source and inventing one from this
browser's connection moment would be a value nobody measured. The per-vendor cost crosses only inside
free text **and** is barred from `src` by a shipped guard (§0.5), so taking it means both a prose
parse and a register move — two decisions, in a ticket that is already fifteen criteria. It goes to
the successor **with Q-0129**, as the ticket body asks, because both are the same problem: a
structured value that exists only inside a sentence composed for a human.

**OQ-2 — `/runs`, the landing list. RULED: in, and small.** It is one fetch against a shipped route
with a shipped schema, reusing a request-state vocabulary built twice already, and it is the only
thing that can render the honest state of a real machine today (§0.9). Left out, the sole entry to
mission control is a typed URL containing an opaque handle a user has no way to learn.

**OQ-3 — what bounds the browser's event list. RULED: the rendering, not the retention** (AC-8), with
the quadratic copy registered and routed rather than fixed. A cap on the data would discard a run's
own history in the one screen built to show it; a cap on the DOM with the hidden count named
discloses the loss where a reader sees it, which is Q-0124's rule. The figure the obligation asked
for is the one this run could not produce — §0.4 says why, and no criterion rests on it.

**OQ-4 — events with no `stepId`. RULED: a run-level lane** (AC-2), on the measurement in §0.3 that
this is not an edge case but most of what the engine says. Dropping is refused; re-attributing by
message prefix is refused separately, because it is the parse ground rule 2 forbids.

**OQ-5 (BLOCKING, the gate's) — the route through the flows.** Recommended: `requirements` → `chore`,
and the evidence is re-derived rather than copied from Q-0016's E-5. This ticket adds no `core`
behaviour, no daemon route, no wire shape, no contract and no dependency; every shape it consumes is
shipped and every endpoint it calls is registered. Q-0120 took the full route and earned it, but
Q-0120 had contracts to emit — the frame parser and the connection machine — and this has none. The
counter-argument the gate should weigh: this is the largest browser surface in the milestone and
M2's closing measurement is that the flows M3's feature work will use are the least exercised thing
here.

**OQ-6 (BLOCKING, the gate's) — given §0.9, does this ticket run before the producer or after?**
The screen has nothing to show on a real machine until something starts a run through the daemon.
Recommended: **this first**, and the recommendation is a citation rather than a preference —
`apps/web/src/backlog-board.tsx:23` already ruled the ordering when it refused the brief's *"Run next
flow ▸"* button: *"starting a run needs somewhere to watch it, which is Q-0015's."* Building the
producer first would land a button that starts a run a user cannot then look at. The alternative the
gate may prefer is to run them as one ticket, which this document refuses on size: fifteen criteria
is the ceiling, and the producer carries a routing decision of its own (Appendix A).

## 6. Risks

**R-1 — the ticket ships a screen with nothing to show, and that is visible to the reader.** §0.9.
Mitigated rather than hidden: AC-13's empty state names the cause and AC-15's verification says how a
run was produced. Not mitigated away — the honest summary at the close will be that mission control
works and that this workspace cannot yet feed it.

**R-2 — the hero screen will not look like the hero mockup.** §0.4: the brief draws two symmetric
columns of structured tool calls; the stream carries raw stdout, and a claude column may hold one
enormous line where a codex column holds hundreds. AC-3 and AC-6(5) make that explicit rather than
letting a reader infer that the product is under-reporting. Whether the adapters should normalise
vendor JSONL into `tool` and `text` events is a real question and is **not** this ticket's —
`events.ts:27–33` refuses to invent them without a producer, and creating one enlarges the adapter
contract.

**R-3 — the review will be handed a fraction of this change, and this is a prediction to measure.**
Q-0016 was 2,226 insertions across 17 files and crossed `repo.max_diff_bytes` on rounds 2 and 3,
with the reviewer seeing 91.6% and 87.3%. This ticket is comparable or larger. `git diff` orders by
path and the cap cuts the head, so what a truncation hides here is the **tail**: `apps/web/test/`
— `source.test.ts` and `routes.test.ts`, which is where AC-12's and AC-14's whole subject lives — and
`docs/`. Q-0127 predicted its own truncation and was **refuted** at 191,552 B against the 200,000
cap, so this is recorded as a prediction with its named files and is not asserted. GO-5 measures it
either way.

**R-4 — fifteen criteria is the ceiling and four are not trimmable.** The seam if the loop exhausts
is written down in advance rather than discovered at a gate: AC-13 and AC-14's `/runs` half splits
off cleanly, taking the runs landing and its two register rows and leaving the screen complete and
reachable by URL. That is a second erratum at the gate, not a fourth implement round.

**R-5 — AC-12 is the guard most likely to be met by deletion.** A register whose exemption is
widened by removing the assertion that pins it reads as coverage and is not. The criterion names
`:241` specifically and requires a replacement rather than a removal, because that is the clause a
tidy implementation deletes.

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No key path. The screen renders the neutral `vendor` label from `spawnEventSchema` and branches on no vendor. |
| **Worktree safety** | n/a. Nothing writes to the user's tree. The one mutation is a cancellation through the run's own `AbortSignal`. |
| **Gate behaviour** | The answer set is untouched. AC-9 navigates to the gate screen; it answers nothing. AC-11 forbids a stop being worded as an answer. |
| **File format and schema** | No new wire shape and no schema change. `wireRunListSchema` and `wireRunSchema` exist on the shared barrel; `apps/web` declares neither. |
| **Lint rules** | `.tsx` has been in ESLint's scope since Q-0014 AC-4; `lint-coverage.test.ts` holds it. No new rule. |
| **Cold-clone** | Adds nothing to the first 30 minutes. `quorum open` already serves the bundle; this adds two screens behind it. |
| **Decision entry** | None owed — GO-1. |

## 8. Gate obligations

**GO-1 — ratify that no decision entry is owed.** Checked five ways: the event union is unchanged; no
route is added, changed or removed; no dependency is added; the gate answer set is untouched; nothing
under `.harness/` is served. **One is the gate's to ratify rather than mine:** AC-10 takes the app's
write boundary from one act to two, and `WRITE_RULES`' own comment says Q-0016 *"widened the boundary
by one act rather than by a family of them"*. A second act of the same shape, under the same
mechanism and with the same anti-vacuity clause, is not a new rule — but it is the second, and a gate
should say so out loud. Q-0108's precedent puts the ruling in the guard's own authority comment.

**GO-2 — allocate the successor** from Appendix A, at the gate, with its body transcribed in full.
An obligation recorded only in a closed ticket's entry is one that expires; this page records seven
directions of that drift.

**GO-3 — rule on the term *trace column*.** `docs/GLOSSARY.md` defines **Event** and says *"the trace
is the stream, an event is one item of it"*, and defines no rendering of it. If *trace column* is to
appear in the code, the criteria and the architecture document, that is a second file and the rule
says a term goes in the glossary first. The recommendation is to rule it a **rendering of the trace
and not a new term**, recorded so a fourth reader does not re-litigate it — but the rule says ask.

**GO-4 — verify forced in both environment rows** and confirm CI green on the merged commit.

**GO-5 — measure R-3's truncation prediction and record it either way**, with the byte figure and
the files that got no patch. Q-0128 is open on exactly this and two consecutive tickets have now
produced a measurement for it; a third is worth more than a third assertion.

---

## Appendix A — the successor's body, in full

> ### Q-01xx — A run is started from the browser, and the header says what it costs
>
> *Opened at Q-0015's requirements gate, 2026-09-16. p2.*
>
> **Two halves, and they are one ticket because the first has no value without the second's screen
> and the second has no subject without the first's runs.**
>
> **(a) The producer.** `host.start` has exactly one production caller — `POST /runs`
> (`packages/server/src/http.ts:178`) — and **nothing issues it**: `apps/web` makes one non-GET and it
> is the gate answer, the shell's *Run flow* control is `disabled` (`shell.tsx:140`), and
> `quorum run` calls `runFlow` from `@quorum/core` in its own process and never touches
> `@quorum/server`. So the daemon's registry is empty on every real machine, `GET /runs` answers
> `{"runs": []}` for ever, and Q-0015's mission control has nothing to show. Measured at that
> ticket's gate; see its §0.9.
>
> **It carries a routing decision, which is why it is not a button.** `backlog-board.tsx:19–24`
> refused the brief's *"Run next flow ▸"* deliberately and gave the reason: **two flows consume
> `requirements`** — `chore` and `solutioning` — so a single button takes the most consequential
> routing choice in this product silently. What the board does instead is *name* the flows that
> consume a stage. The successor's job is to make that naming actionable: the human picks the flow,
> and `--dry`, `--auto` and `--base` are each ruled in or out with a reason, `auto` in particular,
> since *"Human-gated by default"* is a quality pillar and a browser control that flips it is a
> decision rather than a checkbox.
>
> **It widens the write boundary a third time**, and by more than a third act: this one starts work.
> `WRITE_RULES` in `apps/web/test/source.test.ts` is the register, and a third exemption is where the
> question *is this still one boundary or a family?* has to be answered rather than deferred again.
> A decision entry is likely owed and the ticket must measure rather than assume.
>
> **(b) The header's measured values**, deferred from Q-0015's OQ-1 with its measurements:
>
> - **The run number** is `null` for the life of a live run (`host.ts:304`) and arrives only on the
>   terminal event. Correlating it earlier is a `core` question, not a transport one.
> - **Elapsed** has no source: no event carries a timestamp, by *"What a run's event stream carries"*
>   (2026-08-28), and `WireRun` carries no start time. Widening the event union contradicts a landed
>   entry and owes a decision before a line of code; carrying a start time on `WireRun` does not, and
>   is the cheaper shape. **Measure both before choosing.**
> - **The per-vendor cost ticker** crosses only inside a `done` event's free-text message, composed by
>   `formatCost` (`steps.ts:127–133`, `:353`) as `cost=$0.123` or
>   `cost=n/a (<n> tokens, vendor reports no price)`. **This is Q-0129's problem on a second field**,
>   and the two should be weighed together rather than answered twice: a structured value that exists
>   only inside a sentence written for a human. A regex over that sentence is refused by Q-0015's
>   ground rule 2.
>   There is a **second, independent bar**: `apps/web/test/source.test.ts:271–294` forbids
>   `tokensByVendor`, `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` in
>   any file under `src`. Any token count on this screen moves that guard, and the guard's reasoning —
>   *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) and *never one blended
>   number* — is the thing the new rendering must satisfy, not route around.
>
> **Do not re-derive any of the above from the design brief.** `docs/05-design-prompt.md:39` specifies
> the header as *"run #42 … elapsed 14:32, per-vendor cost ticker"*, and three of those four are not
> on the wire; the brief is the intent and Q-0015's §0.6 is the measurement.

---

## Appendix B — reported, not fixed

**`apps/web/src/run-connection.ts:143–150` names Q-0121 wrongly.** The comment reads *"Q-0015 renders
mission control from this same snapshot while Q-0121 will hold several controllers at once"*. Q-0121
shipped as the daemon's run **listing** — a server-side enumeration that holds no browser controller
and creates none. The sentence was a forecast that the id did not turn out to fit; what will hold
several controllers, if anything does, is a screen nobody has ticketed.

Reported here rather than corrected in a criterion: `.claude/rules/engineering.md` says a defect found
in code you are already changing is **reported, not migrated in passing**. If the implement step
touches that file for AC-8's register, the correction is a one-line comment fix and an
`observation:` entry is the channel for saying so — which is what Q-0117 built that tag for, and this
is a claim about a neighbouring comment rather than about the change.
