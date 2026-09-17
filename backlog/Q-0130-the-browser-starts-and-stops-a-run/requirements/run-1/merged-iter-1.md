# Q-0130 — The browser starts and stops a run

*Merged requirement, run 1, iteration 1. Every measurement in §0 was taken from the tree on
2026-09-17 and none is transcribed from the ticket body, `docs/06-development-plan.md`, the design
brief or a sibling ticket's entry. The body's own re-measurement of that date is accurate in all
nine claims it makes and none is corrected here. What follows is what it did not have: **ten
measurements, three of which change what this ticket builds, and one of which refutes a sentence in
the body.***

---

## 0. What was measured, before anything was designed

### M-1 (decisive) — a start answers `201` with a body; only a stop answers `204`

The ticket body says the new client functions recognise *"**204 before any body is read**, as
`answerGate` does … and reporting a 2xx that is not 204 rather than taking it for success."* That
sentence is exactly right for one of the two routes and wrong for the other.

- `packages/server/src/http.ts`, the `POST /runs` handler: `return c.json(wireRunOf(outcome.run), 201);`
- `packages/server/src/http.ts:224` and `:255`, the gate and stop handlers: `if (refusal === null) return c.body(null, 204);`
- confirmed by the route's own suite: `http.test.ts` asserts `201` for a start and `204` for a gate.

A `startRun` written to the body's sentence would report **every successful start as a disagreement
between this page and the daemon** — and would do something worse: discard the response body, which
is the only place a handle exists. Handles are minted inside the host from a module-level counter
and reach a client through `wireRunOf` alone. There is no second channel; recovering one from
`GET /runs` afterwards means matching the newest row for a flow and a ticket, which is inference
rather than identity, and two starts in the same second would make it wrong.

**Consequence:** two unlike client functions, not one shape written twice. `stopRun` follows
`answerGate` exactly. `startRun` parses its success body through `@quorum/shared`'s own schema and
its `loaded` value is the `WireRun` — which is what AC-7 then navigates by.

### M-2 (decisive) — the start request's shape is declared in a package the browser cannot import

The field set `POST /runs` accepts exists in exactly two places, both inside `@quorum/server`:
`http.ts:56`, `const START_FIELDS = new Set(['flow', 'ticket', 'dry', 'auto', 'base']);`, and the
`StartRequest` interface in `host.ts`. `apps/web/package.json` declares `@quorum/shared` and nothing
else of this workspace.

So an implementer given *"the browser sends `{flow, ticket}`"* has one available move: write the
field names into `apps/web`. **That is verbatim the drift Q-0120's body names as the cause it was
opened on**, and the drift Q-0121 closed for `WireRefusal` and `WireRun` — with a schema, because a
browser needs a runtime parser and not a type.

The precedent is in the file that would copy it: `answerGate` builds its body with
`gateAnswerEnvelopeSchema.parse({ gateId, answer })` (`daemon-client.ts`), and that is already a
**request** shape living in `@quorum/shared`. Moving the start shape there is not a new kind of thing
and owes no ruling of its own.

**The schema describes what the route accepts, not what the browser sends.** It carries all five
fields, because narrowing it would make `@quorum/shared` a second and weaker authority for a route
another client may also call. What the browser will not send is a separate, separately-checked
property (AC-12).

### M-3 (decisive) — the register moves by one permission, and then stops discriminating

`apps/web/test/source.test.ts`'s `WRITE_RULES` is six needles with per-needle exemptions. Measured
against it, this ticket widens the boundary by **one row**:

| needle | today | after |
| --- | --- | --- |
| `method: 'POST'` | `daemon-client.ts` | unchanged — a start and a stop are both POSTs from that module |
| `'/gate'` | `daemon-endpoints.ts` | unchanged |
| `'/stop'` | `null` | `daemon-endpoints.ts` |
| `PUT` / `PATCH` / `DELETE` | `null` | unchanged — the daemon routes none of them |

A start needs **no new path literal at all**: it posts to `DAEMON_ENDPOINTS.runs`, which
`daemon-endpoints.ts` already declares and `fetchRuns` already **reads**. The permitted *module* set
stays exactly two.

That is weaker than it sounds, and it is the finding. After this ticket the needles can no longer
tell *this app starts runs* from *this app lists runs*, because the path is the listing's and the
method was already permitted. A register that has stopped discriminating reads as coverage and is
not — Q-0073's *a count is not an identity*. So the guard needs a **second clause with a different
subject**: an identity register of the functions in `daemon-client.ts` that issue a non-GET, which
after this ticket is exactly three and named. AC-11 is that.

### M-4 — a `204` from a stop does not mean the run ended

`host.ts`'s `stop` refuses `no-such-run` for an unknown handle, `not-running` where the record is not
`running`, and `not-a-reason` where the trimmed note is empty; otherwise it calls
`record.controller.abort(note)` and returns `null`. The record stays `running` until the consumer's
`finally` runs. So a `204` says **the cancellation was delivered** and nothing else — the same shape
`answerGate`'s own docblock already states for a gate answer: *"what the run does next is a read, not
an inference from a 204."* The body's closing clause is right and applies in **both** directions: a
stop that was accepted has not ended a run, and a stop that was refused has not proved one is still
going.

### M-5 — a start has no handle to name in its confirmation

The body says *"Each asks for confirmation naming the handle."* A handle is minted after the request
is accepted and first reaches a client in the `201` body, so before a start there is nothing to name.
A start's confirmation names the **ticket, the flow and whether it is a dry walk**; a stop's names
the **handle**. Corrected in AC-9 rather than carried.

### M-6 — the sentences that go false are five source sites and two documents

`mission-control-text.ts:4–5`: *"The daemon is driving no runs. This app cannot start one, and
quorum run uses a different process that this daemon cannot see."* — rendered at
`runs-screen.tsx:156`. The **first** clause goes false the day this ships; the **second** stays true
and must survive, `quorum run` calling `runFlow` in its own process. Beside it:

- `daemon-client.ts`'s header — *"Since Q-0016 exactly one request here is not a GET … no run is started, no run is stopped"*.
- `gate-screen.tsx`'s header — the same clause.
- `apps/web/test/source.test.ts`'s `WRITE_RULES` docblock — *"`'/stop'` is permitted nowhere, this app stopping no run"*, and the comment *"this ticket widened the boundary by one act rather than by a family of them"*.
- `shell.tsx:40` — *"The primary control's label, disabled here and enabled by whichever ticket can start a run."* This ticket makes that sentence false without flipping the control (§6, OQ-3).
- `docs/04-architecture.md` §`apps/web` — *"the gate screen is where this app stops being read-only"*, *"**The one write is `POST /runs/:id/gate`**"*, and *"**Nothing starts a run from here** … Starting and stopping are Q-0130's, and the read-only guard's `WRITE_RULES` register is unmoved by this ticket."*
- `docs/05-design-prompt.md` — screen 2's *"Run next flow ▸"* and screen 5's header.

`backlog-board.tsx`'s *"Nothing on this screen writes"* stays true under the ruled placement (M-8)
and is not touched.

### M-7 — `auto` is a landed entry's subject, and a browser is where it has no user

*"Human-gated by default, auto opt-in per gate"* (2026-08-06) reads: *"Individual gates can be set
to `auto` **in the flow file**."* The `auto` the daemon accepts is a run-level blanket, narrower than
it sounds — `human-locked` and engine-presented gates stay unbypassable — but still a flag that
advances every author-declared gate without a human. A browser is by construction a surface where a
human is present.

Omitting the field owes no decision entry. **Offering it does**, because that entry names the flow
file as where a gate is set to `auto`, and a per-run browser control is a second mechanism for the
same thing. That is the one answer in this ticket that would owe an entry, and it is ruled in §6 so
that no criterion depends on one being written.

### M-8 — the board names flows per COLUMN, and a card is one anchor

Two facts decide placement, and the first is the one neither candidate had.
`backlog-board.tsx:220–229`'s `ConsumedBy` renders **per stage column**, not per card: it filters
`flows` by `flow.consumes === stage` and names them under the column heading. So the board's flow
naming is not attached to a ticket at all, and "make the naming actionable" cannot be done where the
naming is — a start needs a ticket and the naming has none.

Second, a card renders as a single `<a>` deliberately, so a reader can middle-click it. A start
control on a card therefore sits either **inside** that anchor, nesting interactive content in a
link, or **beside** it, which changes what a card is.

`ticket-page.tsx:334` already renders `stage {ticket.stage} · owner … · cost …` in a header a reader
reaches in one click, and that screen is where a reader has just read the ticket. It fetches
`GET /tickets/:id` and would gain `GET /flows` — one request over a directory of six files, against
the board's per-ticket git probes. **Ruled: the ticket page** (§6, OQ-1).

### M-9 — nothing on the transport needs a new route, a new proxy entry, or a socket

`packages/shared/src/navigation.ts` answers `false` for any method that is not `GET` or `HEAD`, so a
POST is **never** a navigation: the daemon's `GET /*` calls `next()` for it and the dev proxy does not
step aside, and `/runs` is already one of the five forwarded prefixes. Verified rather than assumed,
because Q-0120 review round 1's B-1 was exactly a routing collision at these paths.
`daemon-endpoints.ts`'s own docblock records that `/gate` is deliberately **not** a sixth
`DAEMON_ENDPOINTS` entry for that reason; `/stop` is not one either.

### M-10 — a dry walk is the cheapest correct first act, and it is already proven end to end

`docs/GLOSSARY.md`, **Run lock**: *"`--dry` takes none and is refused by none."* *"A dry run changes
nothing the caller passed it"* (2026-09-11). And Q-0015's own acceptance demonstration was a `--dry`
walk that put 10 events and 0 missed through mission control. So a dry walk invokes no adapter,
spends nothing, writes nothing and takes no lock — and still exercises the whole chain this ticket
builds. It is in scope (AC-12), and it is the act GO-4's demonstration performs first.

One consequence, stated rather than left to be found: because a dry run is refused by no lock, a dry
walk started from the browser while a real run holds the same ticket **will not refuse**. That is
harmless under the 2026-09-11 entry — the walk works on its own copy of the ticket and persists
nothing — and no criterion needs to close it.

---

## 1. Problem

The daemon can drive runs and nothing asks it to. `host.start` has exactly one production caller —
`POST /runs` — and no client issues it: `apps/web`'s only non-GET is the gate answer, the shell's
*Run flow* control is `disabled`, and `quorum run` imports `runFlow` from `@quorum/core` and runs in
its own process, which this daemon cannot see.

So on a real machine `GET /runs` answers `{"runs": []}` for ever. Mission control renders a screen
with nothing to render, the runs landing renders a sentence explaining that this app cannot start a
run, and the gate screen waits for a parked run no browser can produce. Three shipped screens were
built against runs a human had to create by hand with an HTTP client. This ticket gives them a
subject.

The other half is the same boundary from the other end: a run that is going wrong — burning a
subscription on a loop that will not converge — can be stopped from a signal or a hand-`POST`, and
not from the screen that is showing it going wrong.

## 2. User stories

**`maintainer`.** I have read a ticket in the browser and I want to run the next flow on it without
leaving for a terminal — and I want to pick *which* flow, because two of them consume `requirements`
and the choice between `chore` and `solutioning` is the most consequential routing decision in this
product. When I watch that run in mission control and see it going nowhere, I want to stop it from
there, and I want the screen to tell me what the daemon actually did rather than what it assumes
followed.

**`adopter`.** I ran `quorum open`, the browser opened, and every screen tells me something is
waiting for a run that nothing can start. I want the UI to be a way in, not a viewer for work I have
to start somewhere else.

**`contributor`.** When I read how the browser asks the daemon to start a run, I want the request's
shape declared once, in the package both ends may import, so adding a field is one edit rather than
two that can disagree.

## 3. What this builds

One request shape in `@quorum/shared`; two client functions in `daemon-client.ts`; one path builder
in `daemon-endpoints.ts`; a **start** control on the ticket page that names every flow consuming that
ticket's stage and navigates to mission control on the handle the daemon answered with; a **stop**
control in mission control; and one shared discipline for both — confirm, at most one in flight,
render the daemon's answer and infer nothing from it.

It adds **no daemon route, no dependency, no event-union change, no socket, no glossary term and no
decision entry**. Both routes have been shipped since Q-0118.

## 4. Acceptance criteria

Fourteen. The seam for a split is written out in Appendix A **in advance** rather than left for an
exhaustion gate to find, on Q-0122 erratum E-1's precedent.

**AC-1 — the start request's shape is declared once, in the package both ends may import.**
`@quorum/shared` gains `WIRE_START_FIELDS` (the field-name tuple, in the route's own order —
`flow`, `ticket`, `dry`, `auto`, `base`), `WireStartRequest` and `wireStartRequestSchema`
(`.strict()`, the two required fields required and the other three optional), in the
tuple-plus-type-plus-schema arrangement `WIRE_RUN_STATES` / `WireRunState` / `wireRunStateSchema`
already uses in that file. `packages/server/src/http.ts`'s `START_FIELDS` is built from that tuple
rather than from a second literal. **`startRequestOf` is not rewritten to parse through zod**: its
four refusal codes — `not-an-object`, `unknown-field`, `missing-field`, `wrong-type` — and every
sentence it composes are unchanged, including the remedy's `remove it; this route accepts flow,
ticket, dry, auto, base`, whose wording depends on the tuple's order.
*Test:* `packages/server/src/http.test.ts`'s existing refusal assertions pass **unedited**, which is
what says this is a register move and not a behaviour change; `packages/server` holds no second
literal list of the five names; and the existing `apps/web` scan that forbids declaring a wire shape
locally covers `WireStartRequest` as it already covers `WireTicketDetail`.

**AC-2 — `runStopPath`, with the segment written as a literal and registered where literals are
registered.** `daemon-endpoints.ts` gains a module-private `STOP_SEGMENT = '/stop'` and
`runStopPath(handle)` beside `runGatePath`, with the handle percent-encoded into one segment. The
literal is written out rather than assembled, on that module's own stated reason: *"an exemption that
forgives a string nobody wrote would forgive nothing."* No sixth `DAEMON_ENDPOINTS` entry is added —
`/runs` already covers it and the dev proxy already forwards it (M-9) — and
`apps/web/test/routes.test.ts`'s `EXCEPTION_REASONS` gains a `daemon-endpoints.ts:/stop` row whose
reason says what the `/gate` row's says and why it is not a prefix.
*Test:* `runStopPath` on a handle containing a separator yields one encoded segment; the module holds
the literal; the route scan passes with the register row and fails by name without it.

**AC-3 — `startRun` recognises `201` and parses the body it carries.** It POSTs a body built through
`wireStartRequestSchema.parse(…)` — `answerGate`'s own shape — to `DAEMON_ENDPOINTS.runs`. A `201`
body is parsed through `wireRunSchema` and the `loaded` value is that `WireRun`; a body that does not
validate is `unparseable`; a non-2xx is the existing `refused` path, carrying the daemon's own `code`,
`condition` and `remedy` through unaltered; a 2xx that is **not** `201` is reported as a disagreement
rather than taken for success.
*Test:* the four outcomes over a driven fetcher, and a `200`-carrying-a-valid-run fixture reported
rather than accepted.

**AC-4 — `stopRun` recognises `204` before any body is read, and never sends a blank reason.**
Exactly `answerGate`'s shape: the status is checked before `response.json()` is called, so a route
that answers no body is not reported as *the response body was not JSON*; a non-2xx goes through
`refused`; a 2xx that is not `204` is reported. It sends a `reason` that is one constant naming this
surface, declared once — so run history records **where** a stop came from, where the host's
`DEFAULT_STOP_REASON` (`'stopped by the run host'`) records only that the host did it — and it never
sends an empty or whitespace-only string, which `host.stop` refuses `not-a-reason`.
*Test:* a fetcher whose `json()` throws still yields `loaded` on a `204`, which is the property and
not an optimisation; and the body sent carries a `reason` whose trimmed value is non-empty.

**AC-5 — every refusal a well-formed request can provoke has its own sentence, and nothing branches
on a status.** Start: `lock-held` (409), `not-runnable` (409), `no-such-ticket` (404), `no-such-flow`
(404), `host-closed` (503), `refused` (500). Stop: `no-such-run` (404), `not-running` (409),
`not-a-reason` (400). Two pairs share a status on the start route, so the **code** is what tells them
apart — `no-such-ticket` against `no-such-flow`, and `lock-held` against `not-runnable`, which say
different things to a reader. Any other code renders the daemon's `condition` unaltered through the
existing fallback.
*Test:* each named code renders text that is not another code's, asserted by value over the set
rather than by rendering each one.

**AC-6 — the start control names every flow that consumes the ticket's stage, and never one.** On
the ticket page (§6, OQ-1) a reader chooses **the flow** from the flows whose `consumes` equals the
ticket's `stage`, and **whether the run is a dry walk**. A flow the linter refused
(`runnable: false`) is named and is not offered, on the board's own precedent. Where no flow consumes
the stage, the screen says so; where the flow listing could not be read, it says that instead and
does not report an unread listing as *no flow consumes this stage*. Both sentences are the
board's — `NO_CONSUMING_FLOW` and `FLOWS_UNREAD`, imported rather than re-worded, so the two screens
cannot disagree about one stage.
*Test:* a stage two flows consume offers two; a refused flow is named and not offered; the two
unavailable cases render their own distinct sentences, asserted against the imported constants.

**AC-7 — a start that succeeded navigates to mission control on the handle the daemon answered
with.** The handle comes from the `201` body and from nowhere else — never from `GET /runs`, never
composed. Nothing navigates on a refusal, and the handle stays visible in the rendered outcome, so a
start that succeeded and a navigation that did not leaves a reachable run rather than a silent one.
*Test:* a driven start resolves to the run route for the handle in the response, asserted against the
registered pattern rather than a literal.

**AC-8 — the stop control is offered only while the DAEMON last reported the run `running`, and its
availability is never derived from connection state.** It lives on the mission control screen, which
already reads `GET /runs/:handle` on mount and on an explicit retry, and it reads `state` from that
read. It is absent for `refused` and `ended`. **Connection state is not run state** — `docs/GLOSSARY.md`
says so in as many words, a transport can change without the daemon run changing — so no member of
that union may decide whether this control is shown. It is **never worded with `advance`, `retry` or
`abort`**: a stop cancels a run through its `AbortSignal` and is not one of the three words a gate
takes.
*Test:* the control is present for `running` and absent for the other two; a fixture whose connection
state is `ended`, `dropped` or `interrupted` while the metadata read still says `running` leaves the
control present; and no label or sentence this ticket adds contains any of the three gate answers.

**AC-9 — both acts are confirmed, single, and at most one in flight.** Each control asks for
confirmation first: a start's names the ticket, the flow and whether it is a dry walk — **not a
handle, which does not exist yet** (M-5) — and a stop's names the handle. Cancelling issues no
request. While a mutation is outstanding **every** control on that screen that could start or stop a
run is inert, so a screen offering three flows cannot issue two starts. The guard is released **by
that request's own resolution and by nothing else**: a read, a retry, a live event arriving on the
socket or any other GET completing does not re-enable a control and does not clear the sentence
saying a mutation is on its way. And a response that arrives after the screen has unmounted or its
subject has changed updates nothing — which does not cancel or reinterpret the mutation itself. This
is Q-0016's review blocker, and the body is explicit that it must not be found by a reviewer a second
time.
*Test:* two activations in one turn issue one request; a read completing while one is outstanding
leaves every control inert and the outstanding sentence standing; the release is shown to be the
request's own resolution by a fixture that reads in between; and a late resolution after a subject
change leaves the replacement subject's state untouched.

**AC-10 — nothing infers an outcome from a mutation, and a failed mutation offers a read.** A `204`
from a stop reports that the cancellation was **delivered** and never that the run ended (M-4). A run
that finished before its stop arrived renders the daemon's `not-running` refusal as what it is, and
that refusal is never relabelled a successful stop nor read as proof the run completed. A `201` from
a start reports a run under way, which is what the daemon proved before answering. Where either was
refused, the action offered beside it reads the run or the ticket again and **re-sends nothing** —
`gate-screen.tsx`'s `LOOK_AGAIN_LABEL` precedent, because `canRetryRequest` answers `true` for
`refused` and a bare Retry beside a write would re-issue a mutation.
*Test:* a stop answered `204` renders no claim that the run ended; a stop answered `not-running`
renders that refusal and no completion claim; a refused mutation's action issues a GET, asserted by
the path the fetcher was called with.

**AC-11 — the write register moves by one permission, and gains a clause with a different subject.**
In `apps/web/test/source.test.ts`: `'/stop'`'s `permitted` becomes `'daemon-endpoints.ts'`;
`writeOffenders(true)` is still empty; `writeOffenders(false)` is exactly the `<file>: <what>` rows
those exemptions now forgive; the permitted **module** set is still exactly
`['daemon-client.ts', 'daemon-endpoints.ts']`. **The `toBeNull()` clause is replaced by one naming
the module, not deleted** — it is the clause a tidy implementation removes. And because the needles
can no longer tell a start from a read (M-3), a second clause registers the **identity** of every
function in `daemon-client.ts` that issues a non-GET request: exactly three, named — `answerGate`,
`startRun`, `stopRun`.
*Test:* each clause shown red on its own; the identity register shown red against a fourth writer and
against one name swapped for another, so it is an identity and not a count.

**AC-12 — the browser sends `flow`, `ticket` and at most `dry`.** It never sends `auto` and never
sends `base`. Pillar 3 as a checked property of the source rather than as an intention: a run started
from a browser is a run a human is watching, and a blanket gate-advancing flag there is the one thing
this product's central promise forbids (M-7). `base` moves a review's diff anchor and needs a revision
no route on this transport can enumerate.
*Test:* no file under `apps/web/src` names either field, with the needle shown to find one in a
fixture; and the body a driven start sends carries exactly the permitted keys.

**AC-13 — every shipped sentence saying this app cannot start or stop a run moves, and the superseded
wording is refused by name.** The five sites of M-6 under `apps/web`: `EMPTY_RUNS_TEXT`'s first
clause moves and its second survives unaltered (`quorum run` is still a different process this daemon
cannot see); `daemon-client.ts`'s and `gate-screen.tsx`'s headers move; the guard's docblock moves;
and `shell.tsx`'s *"enabled by whichever ticket can start a run"* becomes what is true instead — the
global control stays disabled and says why, having no ticket to start a run **on** (§6, OQ-3). Each
is asserted **negatively against the wording it replaces** as well as positively, in the shape
`packages/shared/src/docs.test.ts`'s Q-0122 AC-8 clause already uses, because what a document of this
kind gets wrong is the old sentence nobody re-read.
*Test:* the retired phrases are absent under `apps/web/src`, with fixtures reproducing each so the
negatives have a subject.

**AC-14 — the two documents say what shipped.** `docs/04-architecture.md` §`apps/web`: the gate
screen is no longer *where this app stops being read-only*, the one write is no longer
`POST /runs/:id/gate` alone, and the *"Nothing starts a run from here … Starting and stopping are
Q-0130's, and the read-only guard's `WRITE_RULES` register is unmoved by this ticket"* clause is
replaced by what this ticket did — including that the register moved by one permission and gained a
second clause with a different subject, which is the non-obvious half. The status line records the
ticket and its landing date. `docs/05-design-prompt.md` gains a divergence paragraph on screen 5 for
the stop control, and screen 2's existing *"No 'Run next flow ▸' button"* paragraph is amended to say
where the control went instead and why it is not on a card, on the board's own precedent.
*Test:* the section-slice anchors in `packages/shared/src/docs.test.ts` extended in the same shape —
positive clause, negative clause against the superseded wording, and a fixture reproducing it.

## 5. Non-goals

1. **`--base`.** It moves a review's diff anchor only, is useful for one flow, and needs a revision no
   route carries. Additive later; the shared schema already accepts it.
2. **`--auto`.** M-7, and ruled in §6.
3. **A free-text stop reason, or a control that edits it.** AC-4 sends one constant.
4. **A start control on the backlog board.** The board's `ConsumedBy` naming, its single-anchor card
   and its *"Nothing on this screen writes"* header stay exactly as they are.
5. **Flipping the shell's global *Run flow* control.** It has no ticket in scope, so it would have to
   open a picker — a screen nobody has designed.
6. **The header's measured values** — run number, elapsed time, per-vendor cost — which are Q-0131's,
   and **the verdict and diff**, which are Q-0129's.
7. **Making CLI-started runs visible to the daemon.** `quorum run` is a different process; the
   sentence saying so survives (AC-13).
8. **Resuming a run after a daemon restart** (Q-0019), **run history** (Q-0018), a queue of runs, a
   restart-or-retry control, stopping an individual step, and any form of polling.
9. **Any new daemon route, any change to the `POST /runs` or `POST /runs/:id/stop` contracts, any
   change to the gate answer set, and any new dependency.**

## 6. Open questions — all five ruled, none blocking

They are **stated rather than asked**, on Q-0105's measured remedy for exactly this pattern: a
requirement that leaves a case uncovered is precisely one `developer-generalist` must stop on, and
asking the gate for a threshold is another instance rather than a repair. Each records what moves if
the gate rules otherwise.

| | Question | Ruling | If the gate rules otherwise |
| --- | --- | --- | --- |
| **OQ-1** | Ticket page or board card? | **Ticket page.** M-8: the board names flows per *column* and a ticket is not the subject of that naming, while a card is one `<a>` whose interior is not a place for a control. The ticket page already carries the stage and is where a reader has just read the ticket. | AC-6's subject and AC-14's design-brief clause move; nothing else. Ruled at the gate, because both name a file. |
| **OQ-2** | A stop `reason`, or none? | **A constant naming this surface**, declared once. The host's default records only that the host did it; run history should say a human stopped it from the browser. | AC-4's send clause alone. |
| **OQ-3** | Does the shell's *Run flow* control flip? | **No.** It has no ticket, so it would need a picker nobody has designed. Its comment is corrected to say why it stays disabled (AC-13). | Out of scope either way; flipping it is a successor. |
| **OQ-4** | May the browser send `auto`? | **No.** M-7. Under this answer nothing is owed; the opposite answer would owe a decision entry against *"Human-gated by default, auto opt-in per gate"* (2026-08-06), which `developer-generalist` may not write. | AC-12's first half becomes unsatisfiable and the entry must land **at the gate, before the implement step** — the Q-0062 failure this names in advance. |
| **OQ-5** | Chore route or the full pipeline? | **Chore**, recommended. Every screen ticket bar Q-0015 and Q-0120 took it, the discipline this one needs is already shipped in `gate-screen.tsx` to copy from, and the measured difference is $296.00 against $126.68. | Recorded rather than dismissed: Q-0015's `solutioning` step caught a criterion that could not go green and a task with no work in it, neither visible in a diff. The gate's call. |

## 7. Risks

**R-1 — the review will be handed a truncated diff, and the cut will hide AC-1's subject.**
`repo.max_diff_bytes` defaults to 200,000 and `git diff` orders by path, so `apps/…` and `docs/…`
come before `packages/…`: the tail behind any cut is `packages/shared/src/wire.ts` and
`packages/server/src/http.ts` — **AC-1's own subject**. Q-0016's equivalent prediction was made at
its gate from path ordering and landed on the named files. Measured comparison: Q-0016 was 2,226
insertions and crossed the cap on two of three rounds; Q-0127 was 2,704 and peaked at 191,552 with no
truncation. This is likely between them. Q-0124's `warn` now names the files with no patch and
Q-0117's `observation:` channel is where a reviewer reports having read them from the branch — the
two composed correctly on Q-0016 and that is what should happen here. **Do not take the compensation
on trust**: Q-0017's three clean reports over a cut diff hid three real findings.

**R-2 — the irreversible-control class, found once already.** Q-0016's blocker was a `load()` that
released the in-flight guard while a POST was unresolved, so a Refresh re-enabled the controls and an
`abort` could win after an `advance`. This ticket puts two more irreversible controls on two more
screens, one of which is also receiving live socket events. AC-9 is written to forbid it
specifically; it is the criterion most worth mutating.

**R-3 — fourteen criteria is the top of the range, not a comfortable number.** Appendix A names the
seam so an exhaustion gate has a remedy that is not a fourth round.

**R-4 — a guard that stops discriminating.** M-3. If AC-11's second clause is dropped as redundant,
the register goes on reading as a boundary and is not one.

**R-5 — this is the first surface that can spend money from a browser.** A misfire starts a billed
run. Mitigations that already exist and are not being built here: the run lock refuses a second
concurrent run on one ticket and names the holder; a dry walk costs nothing and takes no lock; and
AC-9's confirmation puts the ticket, the flow and the dry choice in front of the reader before
anything is sent.

## 8. Cross-cutting checklist

- **BYOS** — nothing here touches authentication, and the request body is closed at five fields by a
  `.strict()` schema: there is no place for a credential to be added by accident, and the browser
  sends at most three of the five.
- **Worktree safety** — untouched. Every write to the repository is `core`'s; the browser asks the
  daemon, which asks `core`, which makes the worktrees and the branches. Nothing in `apps/web` touches
  a filesystem, which the existing `node:` scan already forbids.
- **Gate behaviour** — unchanged, and protected twice: AC-12 forbids `auto`, and AC-8 forbids wording
  a stop with any of the three answers a gate takes. The gate answer set is not widened.
- **Files are the database** — no browser persistence is added; the existing scan forbidding
  `localStorage` and its siblings is unmoved, and run history stays `.quorum/`'s.
- **File format and its schema** — one new shape in `@quorum/shared` with a zod schema and
  `.strict()`, in the arrangement that file already uses. No file on disk changes format; no ticket,
  flow, role or manifest is touched.
- **Lint rules** — no new dependency, so `apps/web/test/package.test.ts`'s declared-dependency pin
  does not move. ESLint already covers `apps/**/*.tsx`.
- **Cold-clone impact** — positive and modest. The first 30 minutes get shorter for anyone who ran
  `quorum open`, because the UI stops being a viewer for work that has to be started elsewhere. Both
  installation paths are unchanged; the README rewrite is Q-0028's.
- **Product-agnostic** — nothing here names a product, and the flow names come from `GET /flows`
  rather than from a list in the app.

## 9. Gate obligations

**GO-1 — ratify that no decision entry is owed, and why.** The body says *"a decision entry is likely
owed"*; measured, the answer is **no**. `docs/decisions/` holds no entry ruling what `apps/web` may
write — grepped for both *read-only* and *write boundary*, which returns 062 (the event stream), 068
(errata) and 084 (ticket owner), and for `apps/web`, which returns 092, 093 and 096, all about
emitting and distribution. The boundary is held by `apps/web/test/source.test.ts` and described in
`docs/04-architecture.md`, which is a numbered document this change fixes in the same PR under the
standing docs rule. Q-0016 widened that boundary from zero writes to one and took no entry. Widening
it by two more acts on the same rule, under the same guard, with **the permitted module set
unchanged**, is the same kind of change, and the reasoning belongs in the guard's own authority
comment — Q-0108's precedent for exactly this shape. **The one answer that would owe an entry is
OQ-4 answered yes**, and it is ruled in §6 so no criterion depends on one being written.

**GO-2 — rule OQ-1 before the implement step**, AC-6 and AC-14 both naming a file.

**GO-3 — verify forced in both environment rows and on `main` after the merge**, with `quorum lint`
and the git-identity sweep, and confirm CI green on the merged commit.

**GO-4 — the demonstration is performed and transcribed, not reported.** Start the daemon with
`quorum open`; start a flow on a real ticket **from the browser** — a dry walk first, on M-10 — watch
it in mission control; then stop a run from that screen. Record in `runs.log`: the ticket, the flow,
the handle the start answered, what `GET /runs` listed afterwards, and what the daemon answered the
stop with.

This obligation is written this way for a measured reason. Q-0016's GO-6 asked for *"the product run
by hand: a real run parked at a real gate, answered from the browser … the one no unit test can stand
in for"*, and **it was reported discharged while its by-hand half was never performed** — attempting
it would have failed, and would have found the missing producer a day earlier. This ticket is the
producer. It is therefore the first one whose acceptance can genuinely be demonstrated, and the first
where a claim of discharge can be checked against a transcript.

## 10. Provenance

**From candidate-claude, and decisive:** M-1, the 201/204 asymmetry, which corrects the ticket body
and is the difference between a start that works and one that discards its own handle. M-2, the start
shape's move to `@quorum/shared`, without which an implementer reproduces the drift Q-0120 was opened
on. M-3, that the register widens by one row and then stops discriminating, and the identity clause
that answers it. M-5, that a start's confirmation cannot name a handle. M-6's census of the sentences
that go false. M-7's `auto` ruling and its named entry. M-9 and M-10. Appendix A's seam, its direction
and its stated cost. R-1's truncation prediction with its measured comparison, and GO-4's shape,
including why it is written as a transcript.

**From candidate-codex:** the late-response rule after unmount or a change of subject (its AC-18),
which claude lacked and which is a real hazard on a screen a reader navigates away from; the
finish-versus-stop race named explicitly rather than left under a general no-inference clause (its
AC-14), now the second sentence of AC-10; that a blank `reason` is refused `not-a-reason` and must
never be sent (its AC-11); and that **every** lifecycle control on the screen goes inert rather than
only the one pressed (its AC-16), which matters because AC-6's screen offers one control per
consuming flow. Its AC-9's insistence on one canonical stop placement is adopted as a ruling rather
than left as its OQ-3.

**Merged, and neither candidate's:** M-8's first half — that `ConsumedBy` renders per *column* and so
attaches to no ticket — which is what actually settles placement, where claude argued from the card's
anchor alone and codex proposed the board without measuring either. AC-8's clause that connection
state may not decide the control's availability, from `docs/GLOSSARY.md`'s own *"It is not run
state"*. AC-6's reuse of the board's two imported sentences so two screens cannot disagree about one
stage. AC-1's requirement that `startRequestOf` is **not** rewritten to parse through zod and that
`http.test.ts` passes unedited, which is what keeps this a register move.

**Struck from candidate-codex, with reasons.** Its 32 criteria are over any size this repository has
carried: Q-0013 was refused at eighteen and Q-0091 and Q-0096 split at twenty-one, each at a gate and
at cost. Seven of them — existing regressions staying green, BYOS, worktree safety, files as the
database, no file-format change, no adapter-contract change, the cold-clone path — are the
cross-cutting checklist every ticket here carries in §8 and are not independently testable claims
about *this* change. Its **AC-32 is struck outright**: it requires a decision entry before
implementation is accepted, which `developer-generalist` may not write, so the run would be launched
into a criterion no step on its route can satisfy — the pattern this repository has recorded fifteen
times and which cost Q-0062 three implement rounds. GO-1 replaces it with a ratification whose
default answer requires nothing to be written. Its blanket non-goal on `dry` is struck on M-10: a dry
walk is the only start a browser can make that spends nothing, takes no lock and writes nothing, and
it is the act GO-4 performs first.

---

## Appendix A — the split seam, named in advance

If the gate refuses fourteen, the seam is **stop**, and start stays.

**Moves out:** AC-2, AC-4, AC-8, AC-10's stop half, AC-11's `/stop` permission (leaving the
writing-function identity register, which start needs anyway), and the stop clauses of AC-13 and
AC-14.

**Stays:** AC-1, AC-3, AC-5's start half, AC-6, AC-7, AC-9's start half, AC-12, and the start clauses
of AC-13 and AC-14.

**Why this way round and not the other.** Stop is the half with no routing question, no flow choice
and no navigation — the three things that make the start half a design problem. Start first also
gives the daemon its producer, which is what three shipped screens are waiting for, and it is what
gives stop a user: a run visible in mission control today was hand-`POST`ed, and whoever can do that
can hand-`POST` a stop.

**What splitting costs, stated rather than presented as free.** The confirm-and-one-in-flight
discipline is specified and reviewed twice; `WRITE_RULES` and the `docs/04-architecture.md`
§`apps/web` paragraph each move twice, and the second move must not undo the first's negative
assertions; and the successor inherits AC-9 as prose rather than as a shipped pattern in the same
branch. Against that, Q-0122 accepted twenty and spent three implement rounds, and Q-0126 accepted
sixteen and spent five with a `blocked` round among them.
