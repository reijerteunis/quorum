# Q-0130 — The browser starts and stops a run

*Requirements, run 1, candidate-claude. Every measurement below was taken from the tree on
2026-09-17 and none is transcribed from the ticket body, the design brief, `docs/06-development-plan.md`
or a sibling entry. The body's own re-measurement of 2026-09-17 is accurate in all nine claims it
makes and I record no correction to any of them. What follows is what it did **not** have —
**ten measurements, three of which change what this ticket builds**, and two of which refute a
sentence in the body.*

---

## 0. What was measured, before anything was designed

### M-1 (decisive) — a start answers `201` with a body; only a stop answers `204`

The body says `daemon-client.ts` gains *"functions recognising **204 before any body is read**, as
`answerGate` does … and reporting a 2xx that is not 204 rather than taking it for success."* That
sentence is exactly right for one of the two routes and wrong for the other.

- `packages/server/src/http.ts:183` — `return c.json(wireRunOf(outcome.run), 201);`
- `packages/server/src/http.ts:254` — `if (refusal === null) return c.body(null, 204);`
- confirmed in the route's own suite: `packages/server/src/http.test.ts:400` asserts `201`, and
  `:506` asserts `204` for the gate.

A `startRun` written to the body's sentence would report **every successful start as a
disagreement between this page and the daemon**, and would do something worse than that: it would
throw away the response body, which is the only place a handle exists. `host.ts:64` mints handles
from a module-level counter and `wireRunOf` (`packages/server/src/wire.ts:124`) is the one
projection that carries one. There is no second channel — recovering a handle from `GET /runs`
afterwards means matching the newest row for a flow and a ticket, which is inference rather than
identity, and two starts on two tickets in the same second would make it wrong.

**Consequence:** two unlike client functions, not one shape written twice. `stopRun` follows
`answerGate` (`daemon-client.ts:221–257`) exactly. `startRun` is a POST whose **success body is
parsed** through `@quorum/shared`'s own schema, on `requestJson`'s terms, and whose success value
is the `WireRun` — which is what AC-7 then navigates by.

### M-2 (decisive) — the start request body is declared in a package the browser cannot import

The shape `POST /runs` accepts exists in exactly two places, both inside `@quorum/server`:

- `packages/server/src/http.ts:56` — `const START_FIELDS = new Set(['flow','ticket','dry','auto','base']);`
- `packages/server/src/host.ts:82–93` — `interface StartRequest`.

`apps/web/package.json` declares `@quorum/shared` and nothing else of this workspace. So an
implementer given *"the browser sends `{flow, ticket}`"* has one available move: write the field
names into `apps/web`. **That is verbatim the drift Q-0120's ticket body names as the cause it was
opened on**, and it is the drift Q-0121 closed for `WireRefusal` and `WireRun` — with a schema,
because a browser needs a runtime parser and not a type.

The precedent is in the file that would copy it: `answerGate` builds its body with
`gateAnswerEnvelopeSchema.parse({ gateId, answer })` (`daemon-client.ts:234`), and that is already a
**request** shape living in `@quorum/shared`. So moving the start shape there is not a new kind of
thing and owes no ruling of its own.

**The schema describes what the route accepts, not what the browser sends.** It carries all five
fields including `auto` and `base`, because narrowing it would make `@quorum/shared` a second and
weaker authority for a route a non-browser client may also call. What the browser will not send is a
separate, separately-checked property (AC-12).

### M-3 (decisive) — the write register moves by one permission, and afterwards it cannot tell a start from a read

The body says *"It widens the write boundary, and by more than an act."* Measured against
`apps/web/test/source.test.ts:255–262`, it widens by **one row**:

| needle | today | after |
| --- | --- | --- |
| `method: 'POST'` | `daemon-client.ts` | unchanged — a start and a stop are both POSTs from that module |
| `'/gate'` | `daemon-endpoints.ts` | unchanged |
| `'/stop'` | `null` | `daemon-endpoints.ts` |
| `PUT` / `PATCH` / `DELETE` | `null` | unchanged — the daemon routes none of them |

A start needs **no new path literal at all**: it posts to `DAEMON_ENDPOINTS.runs`, which
`daemon-endpoints.ts:3` already declares and `fetchRuns` (`daemon-client.ts:197`) already **reads**.
The permitted *module* set is still exactly two.

That is weaker than it sounds, and it is the finding: after this ticket the register's needles can
no longer distinguish *this app starts runs* from *this app lists runs*, because the path is the
listing's and the method was already permitted. A register that has stopped discriminating reads as
coverage and is not — `docs/GLOSSARY.md`'s own discipline, and Q-0073's *a count is not an
identity*. So the guard needs a **second clause with a different subject**: an identity register of
the functions in `daemon-client.ts` that pass a `DaemonRequest`, which after this ticket is exactly
three and named. AC-11 is that.

### M-4 — a `204` from a stop does not mean the run ended

`packages/server/src/host.ts:424–435`:

```ts
stop(handle, reason) {
  const record = records.get(handle);
  if (!record) return 'no-such-run';
  if (record.state !== 'running' || !record.controller) return 'not-running';
  const note = (reason ?? DEFAULT_STOP_REASON).trim();
  if (note === '') return 'not-a-reason';
  record.controller.abort(note);
  return null;
}
```

`abort` is delivered to the `AbortSignal` the run was started with; the record stays `running` until
`consume`'s `finally` runs (`host.ts:326–330`). So a `204` says **the cancellation was delivered**
and nothing else. This is the same shape `answerGate`'s own docblock already states for a gate
answer — *"what the run does next is a read, not an inference from a 204"* — and the body's closing
clause (*"never infers completion from an attempted mutation"*) is right and applies in **both**
directions: a stop that was accepted has not ended a run, and a stop that was refused has not proved
one is still going.

### M-5 — a start has no handle to name in a confirmation

The body: *"Each asks for confirmation naming the handle."* A handle is minted inside `begin`
(`host.ts:269–280`), after the request is accepted, and first reaches a client in the `201` body. So
before a start there is nothing to name. A start's confirmation names the **ticket, the flow and
whether it is a dry walk**; a stop's names the **handle**. Corrected in AC-9 rather than carried.

### M-6 — one shipped sentence a user reads today goes false, and it is not in a document

`apps/web/src/mission-control-text.ts:4–5`:

> `The daemon is driving no runs. This app cannot start one, and quorum run uses a different process that this daemon cannot see.`

Rendered at `runs-screen.tsx:156` and asserted at `runs-screen.test.ts:32`. The **first** clause
becomes false the day this ships; the **second** stays true and must survive, `quorum run` calling
`runFlow` in its own process. Beside it, four more sites and two documents:

- `apps/web/src/daemon-client.ts:26–30` — *"Since Q-0016 exactly one request here is not a GET … no run is started, no run is stopped"*.
- `apps/web/src/gate-screen.tsx:5` — *"It is the whole of what this app writes … no run is started, no run is stopped"*.
- `apps/web/test/source.test.ts:236–252, 271–274` — the guard's docblock and its comment, including *"`'/stop'` is permitted nowhere, this app stopping no run"*.
- `docs/04-architecture.md:332` — *"the gate screen is where this app stops being read-only"* and *"**The one write is `POST /runs/:id/gate`**"*.
- `docs/04-architecture.md:338` — *"**Nothing starts a run from here** … Starting and stopping are Q-0130's, and the read-only guard's `WRITE_RULES` register is unmoved by this ticket."*

`apps/web/src/backlog-board.tsx:19–24` — *"Nothing on this screen writes"* — stays true under the
recommended siting (M-8) and is not touched.

### M-7 — `auto` is a landed entry's subject, and a browser is the one surface where it has no user

*"Human-gated by default, auto opt-in per gate"* (2026-08-06) reads: *"Individual gates can be set
to `auto` **in the flow file**."* The `auto` the daemon accepts is a run-level blanket
(`host.ts:360`, `auto: request.auto ?? false`), narrower than it sounds — `human-locked` and
engine-presented gates stay unbypassable, and `host.ts:358–360` says so in place — but still a flag
that advances every author-declared gate without a human. A browser is by construction a surface
where a human is present.

Omitting the field owes no decision entry. **Offering it does**, because that entry's decision
clause names the flow file as where a gate is set to `auto`, and a control that flips it per run
from a browser is a second mechanism for the same thing. That is the one answer in this ticket that
would owe an entry, and it is named so the gate rules it rather than an implementer meeting it.

### M-8 — the board card is one anchor, and the ticket page already has the stage

`backlog-board.tsx`'s `Card` renders the whole card as a single `<a>` (`:180–215`), which is
deliberate — *"the whole of it is one link"*, so a reader can middle-click or open a ticket in a new
tab. A start control on a card therefore sits either **inside** that anchor, nesting interactive
content in a link, or **beside** it, which changes what a card is and moves that screen's tests.

`ticket-page.tsx:334` already renders `stage {ticket.stage} · owner …` in a header a reader reaches
in one click, and that screen is where a reader has just read the ticket. It fetches
`GET /tickets/:id` and would gain `GET /flows` — one extra request over a directory of six files,
against the board's per-ticket git probes.

Recommended site: **the ticket page**. It is OQ-1 rather than a criterion's premise, because the
control's mechanics are identical wherever it lands.

### M-9 — nothing on the transport needs a new route, a new proxy entry, or a socket

`packages/shared/src/navigation.ts:34` — `if (method !== 'GET' && method !== 'HEAD') return false;`
— so a POST is **never** a navigation. The daemon's `GET /*` (`static.ts:269`) calls `next()` for it
and the dev proxy's `bypassNavigation` does not step aside, and `/runs` is already one of the five
forwarded prefixes. Verified rather than assumed, because Q-0120 review round 1's B-1 was exactly a
routing collision at these paths, and because `daemon-endpoints.ts:36`'s own docblock records that
`/gate` is deliberately not a sixth `DAEMON_ENDPOINTS` entry for the same reason. `/stop` is not one
either.

### M-10 — a dry walk is the cheapest correct first act, and it is already proven end to end

`docs/GLOSSARY.md`, **Run lock**: *"`--dry` takes none and is refused by none."* *"A dry run changes
nothing the caller passed it"* (2026-09-11). And Q-0015's own AC-14 demonstration was a `--dry`
walk that put **10 events, 0 missed, peak 3 concurrent columns** through mission control. So a dry
walk invokes no adapter, spends nothing, writes nothing, takes no lock — and still exercises the
whole chain this ticket builds. It is in scope, and it is the act the demonstration should use
first.

One consequence, stated rather than left to be found: because a dry run is refused by no lock, a dry
walk started from the browser while a real run holds the same ticket **will not refuse**. That is
harmless under decision 090 — the walk works on its own copy of the ticket and persists nothing —
and it is not a case any criterion needs to close.

---

## 1. Problem

The daemon can drive runs and nothing asks it to. `host.start` has exactly one production caller —
`POST /runs` at `packages/server/src/http.ts:167` — and no client issues it: `apps/web`'s only
non-GET is the gate answer, the shell's *Run flow* control is `disabled` (`shell.tsx:140`), and
`quorum run` imports `runFlow` from `@quorum/core` and runs in its own process, which this daemon
cannot see.

So on a real machine `GET /runs` answers `{"runs": []}` for ever. Mission control, which Q-0015
shipped, renders a screen that has nothing to render; the runs landing renders a sentence explaining
that this app cannot start a run; and the gate screen, which Q-0016 shipped, waits for a parked run
no browser can produce. Three screens were built against runs a human had to create by hand with an
HTTP client. This ticket is the one that gives them a subject.

The other half is the same boundary from the other end: a run that is going wrong — burning a
subscription on a loop that will not converge — can be stopped from a terminal signal or from a
hand-`POST`, and not from the screen that is showing it going wrong.

## 2. User stories

**`maintainer`.** I have read a ticket in the browser and I want to run the next flow on it without
leaving for a terminal — and I want to pick *which* flow, because two of them consume
`requirements` and the choice between `chore` and `solutioning` is the most consequential routing
decision in this product. When I watch that run in mission control and see it going nowhere, I want
to stop it from there, and I want the screen to tell me what the daemon actually did rather than
what it assumes followed.

**`adopter`.** I ran `quorum open`, the browser opened, and every screen tells me something is
waiting for a run that nothing can start. I want the UI to be a way in, not a viewer for work I have
to start somewhere else.

**`contributor`.** When I read how the browser asks the daemon to start a run, I want the request's
shape to be declared once, in the package both ends may import, so that adding a field is one edit
rather than two that can disagree.

## 3. What this builds

One request shape in `@quorum/shared`; two client functions in `daemon-client.ts`; one path builder
in `daemon-endpoints.ts`; a **start** control on one screen that names every flow consuming the
ticket's stage and navigates to mission control on the handle the daemon answered with; a **stop**
control in mission control's header; and one shared discipline for both — confirm, at most one in
flight, render the daemon's answer and infer nothing from it.

It adds **no daemon route, no dependency, no event-union change, no socket and no glossary term**.
Both routes have been shipped since Q-0118.

## 4. Acceptance criteria

Fifteen, which is the ceiling this repository has measured for one ticket: Q-0013 was refused at
eighteen and Q-0091 and Q-0096 were split at twenty-one, each at a gate and at cost. The seam for a
split is written out in Appendix A **in advance** rather than left for an exhaustion gate to find,
on Q-0122 erratum E-1's precedent.

**AC-1 — the start request's shape is declared once, in the package both ends may import.**
`@quorum/shared` gains `WIRE_START_FIELDS` (the field-name tuple), `WireStartRequest` and
`wireStartRequestSchema`, in the arrangement `WIRE_RUN_STATES` / `WireRunState` /
`wireRunStateSchema` already uses in that file. The schema carries all five fields the route accepts
— `flow`, `ticket`, `dry`, `auto`, `base` — because it describes the **route's** contract and not
this browser's policy. `packages/server/src/http.ts`'s `START_FIELDS` is that tuple rather than a
second literal, and **every refusal code and sentence `startRequestOf` composes is unchanged**:
`not-an-object`, `unknown-field`, `missing-field`, `wrong-type`.
*Test:* `apps/web` declares neither `WireStartRequest` nor a field-name literal of its own, by the
scan `apps/web/test/source.test.ts` already applies to `WireTicketDetail` and its siblings; and
`packages/server/src/http.test.ts`'s existing refusal assertions pass unedited, which is what says
this is a register move and not a behaviour change.

**AC-2 — `runStopPath`, with the segment written as a literal.** `daemon-endpoints.ts` gains a
module-private `STOP_SEGMENT = '/stop'` and `runStopPath(handle)` beside `runGatePath`, with the
handle percent-encoded into one segment. The literal is written out rather than assembled, on that
module's own stated reason: *"an exemption that forgives a string nobody wrote would forgive
nothing."* No sixth `DAEMON_ENDPOINTS` entry is added — `/runs` already covers it and the dev proxy
already forwards it.
*Test:* `runStopPath` on a handle containing a separator yields one encoded segment, and the module
holds the literal.

**AC-3 — `startRun` recognises `201` and parses the body it carries.** It POSTs the body built
through `wireStartRequestSchema` to `DAEMON_ENDPOINTS.runs`; a `201` body is parsed through
`wireRunSchema` and the `loaded` value is that `WireRun`; a body that does not validate is
`unparseable`; a non-2xx is the existing `refused` path, carrying the daemon's own `code`,
`condition` and `remedy` through unaltered; a 2xx that is **not** `201` is reported as a
disagreement rather than taken for success.
*Test:* the four outcomes over a driven fetcher, and a `200`-with-a-valid-run fixture reported
rather than accepted.

**AC-4 — `stopRun` recognises `204` before any body is read.** Exactly `answerGate`'s shape: the
status is checked before `response.json()` is called, so a route that answers no body is not
reported as *the response body was not JSON*; a non-2xx goes through `refused`; a 2xx that is not
`204` is reported.
*Test:* a fetcher whose `json()` throws still yields `loaded` on a `204`, which is the property and
not an optimisation.

**AC-5 — every refusal a well-formed request can provoke has a sentence, and nothing branches on a
status.** Start: `lock-held` (409), `not-runnable` (409), `no-such-ticket` (404), `no-such-flow`
(404), `host-closed` (503), `refused` (500). Stop: `no-such-run` (404), `not-running` (409). Two
pairs share a status in each direction, so the **code** is what tells them apart — `no-such-ticket`
against `no-such-flow`, and `lock-held` against `not-runnable`, which say different things to a
reader. Any other code renders the daemon's `condition` unaltered through the existing fallback.
*Test:* each named code renders text that is not another code's, asserted by value over the set
rather than by rendering each one.

**AC-6 — the start control names every flow that consumes the ticket's stage, and never one.** On
the screen OQ-1 rules (written here for the ticket page), a reader chooses **the flow** from the
flows whose `consumes` equals the ticket's `stage`, and **whether the run is a dry walk**. A flow the
linter refused (`runnable: false`) is named and is not offered, on the board's own precedent
(`backlog-board.tsx:229`). Where no flow consumes the stage, the screen says so and offers no
control; where the flow listing could not be read, it says that instead and does not report an empty
choice as *no flow consumes this stage*.
*Test:* a stage two flows consume offers two; a refused flow is named and not offered; the two
unavailable cases render their own distinct sentences.

**AC-7 — a start that succeeded navigates to mission control on the handle the daemon answered
with.** The handle comes from the `201` body and from nowhere else — never from `GET /runs`, never
composed. Nothing navigates on a refusal.
*Test:* a driven start resolves to `runPath(handle)` for the handle in the response, with the
navigation asserted against the registered pattern rather than a literal.

**AC-8 — the stop control is offered only while the daemon last reported the run `running`.** It
lives in mission control's header region, reads `state` from that screen's own
`GET /runs/:handle` metadata, and is absent for `refused` and `ended`. It is **never worded with
`advance`, `retry` or `abort`**: a stop cancels a run through its `AbortSignal` and is not one of
the three words a gate takes.
*Test:* the control is present for `running` and absent for the other two, and no label or sentence
this ticket adds contains any of the three answers.

**AC-9 — both acts are confirmed, single, and at most one in flight.** Each control asks for
confirmation first: a start's names the ticket, the flow and whether it is a dry walk — **not a
handle, which does not exist yet** (M-5) — and a stop's names the handle. While a mutation is
outstanding the control is inert. The guard is a value that changes when it is set, not state, and
**it is released by that request's own resolution and by nothing else**: a read does not release it
and does not clear the sentence saying a mutation is on its way. This is Q-0016's review blocker,
and the body is explicit that it must not be found by a reviewer a second time.
*Test:* two activations in one turn issue one request; a read while one is outstanding leaves the
control inert and the outstanding sentence standing; the guard's release is shown to be the
request's own resolution by a fixture that reads in between.

**AC-10 — nothing infers an outcome from a mutation, and a failed mutation offers a read.** A
`204` from a stop reports that the cancellation was **delivered** and never that the run ended
(M-4); what is true next is established by reading the run again. A `201` from a start reports a run
under way, which is what the daemon proved before answering. Where either was refused, the action
offered beside it reads the run or the ticket again and **re-sends nothing** — `gate-screen.tsx`'s
`LOOK_AGAIN_LABEL` precedent, because `canRetryRequest` returns `true` for `refused` and a bare
Retry beside a write would re-issue a mutation.
*Test:* a stop answered `204` renders no claim that the run ended; a refused mutation's action
issues a GET, asserted by the path the fetcher was called with.

**AC-11 — the write register moves by one permission, and gains a clause with a different
subject.** In `apps/web/test/source.test.ts`: `'/stop'`'s `permitted` becomes
`'daemon-endpoints.ts'`; `writeOffenders(true)` is still empty; `writeOffenders(false)` is the three
`<file>: <what>` rows those exemptions now forgive; the permitted **module** set is still exactly
`['daemon-client.ts', 'daemon-endpoints.ts']`. **The `toBeNull()` clause is replaced by one naming
the module, not deleted** — it is the clause a tidy implementation removes. And because the needles
can no longer tell a start from a read (M-3), a second clause registers the **identity** of every
function in `daemon-client.ts` that passes a `DaemonRequest`: exactly three, named —
`answerGate`, `startRun`, `stopRun`.
*Test:* each clause shown red on its own; the identity register shown red against a fourth writer
and against one swapped for another.

**AC-12 — the browser sends `flow`, `ticket` and at most `dry`.** It never sends `auto` and never
sends `base`. Pillar 3 as a checked property of the source rather than as an intention: a run
started from a browser is a run a human is watching, and a blanket gate-advancing flag there would
be the one thing this product's central promise forbids (M-7). `base` moves a review's diff anchor
and needs a revision no route on this transport can enumerate.
*Test:* no file under `apps/web/src` names either field, with the needle shown to find one in a
fixture; and the body a driven start sends carries exactly the permitted keys.

**AC-13 — the route-literal scan's exception register gains one row with its reason.**
`apps/web/test/routes.test.ts`'s `EXCEPTION_REASONS` gains `daemon-endpoints.ts:/stop`, whose reason
says what `/gate`'s says and why it is not a `DAEMON_ENDPOINTS` prefix.
*Test:* the scan passes with the row and fails by name without it.

**AC-14 — every shipped sentence saying this app cannot start or stop a run moves, and the
superseded wording is refused by name.** `EMPTY_RUNS_TEXT`'s first clause moves and its second
survives unaltered (`quorum run` is still a different process this daemon cannot see);
`daemon-client.ts`'s and `gate-screen.tsx`'s headers move; the guard's docblock moves. Each is
asserted **negatively against the wording it replaces** as well as positively, in the shape
`packages/shared/src/docs.test.ts`'s Q-0122 AC-8 clause already uses, because what a document of
this kind gets wrong is the old sentence nobody re-read.
*Test:* the retired phrases are absent under `apps/web/src`, with fixtures reproducing each so the
negatives have a subject.

**AC-15 — the two documents say what shipped.** `docs/04-architecture.md` §`apps/web`: the gate
screen is no longer *where this app stops being read-only*, the one write is no longer
`POST /runs/:id/gate` alone, and the *"Nothing starts a run from here … Starting and stopping are
Q-0130's"* clause is replaced by what this ticket did — including that the register moved by one
permission and gained a second clause, which is the non-obvious half. The status line records the
ticket and its landing date. `docs/05-design-prompt.md` gains a divergence paragraph on screen 5 for
the stop control, and screen 2's existing *"No 'Run next flow ▸' button"* paragraph is amended to
say where the control went instead, on the board's own precedent.
*Test:* the section-slice anchors in `packages/shared/src/docs.test.ts` extended in the same shape —
positive clause, negative clause against the superseded wording, and a fixture reproducing it.

## 5. Non-goals

1. **`--base`.** It moves a review's diff anchor only, is useful for one flow, and needs a revision
   no route carries. Additive later; the schema already accepts it.
2. **`--auto`.** M-7. Refused rather than deferred, and the entry it would owe is named.
3. **A free-text stop reason.** The route accepts one and `not-a-reason` refuses a blank; whether
   the browser sends a constant naming its surface or nothing at all is OQ-2. A text input is not in
   scope either way.
4. **A start control on the backlog board** (under the recommended answer to OQ-1). The board's
   `ConsumedBy` naming and its *"Nothing on this screen writes"* header stay exactly as they are.
5. **Flipping the shell's global *Run flow* control.** It has no ticket in scope, so it would have
   to open a picker — a screen nobody has designed. OQ-3; recommended that it stays disabled with
   its sentence corrected.
6. **The header's measured values** — run number, elapsed time, per-vendor cost — which are
   Q-0131's, and **the verdict and diff**, which are Q-0129's.
7. **Resuming a run after a daemon restart** (Q-0019), **run history** (Q-0018), a queue of runs, a
   cancel-and-restart, and any form of polling.
8. **Any new daemon route, any change to the gate answer set, and any new dependency.**

## 6. Open questions

| | Question | Owner | Blocking |
| --- | --- | --- | --- |
| **OQ-1** | Does the start control live on the **ticket page** (recommended, M-8) or on a board card? | gate | No — the mechanics are identical; a ruling for the board moves AC-6's subject and AC-14's board clause and nothing else. **Rule it before the implement step**, because both criteria name a file. |
| **OQ-2** | Does the browser send a stop `reason` naming its surface, declared once, or send none and let `DEFAULT_STOP_REASON` apply? | gate | No. Recommended: a constant naming the surface, so run history records **where** a stop came from — the daemon's default says only that the host did it. |
| **OQ-3** | Does the shell's global *Run flow* control flip? | gate | No. Recommended: it stays `disabled` and its comment stops saying *"enabled by whichever ticket can start a run"*, which this ticket makes false without flipping it. |
| **OQ-4** | May the browser ever send `auto`? | gate | **Yes if answered yes** — it would owe a decision entry against *"Human-gated by default, auto opt-in per gate"* (2026-08-06), which `developer-generalist` may not write, so the run would be launched into a criterion no step on its route can satisfy. Recommended answer: **no**, under which nothing is owed. |
| **OQ-5** | Chore route or the full pipeline? | gate | No. Recommended: **chore**. This is behaviour a red test could fail on, which argues for the pipeline — but every screen ticket bar Q-0015 and Q-0120 took the chore route, the discipline this one needs is already shipped in `gate-screen.tsx` to copy from, and the measured difference is $296.00 against $126.68. The counter-argument is recorded rather than dismissed: Q-0015's `solutioning` step caught a criterion that could not go green and a task with no work in it, neither visible in a diff. |

## 7. Risks

**R-1 — the review will be handed a truncated diff, and the cut will hide AC-1's subject.**
`repo.max_diff_bytes` defaults to 200,000 and `git diff` orders by path, so `apps/…` and `docs/…`
come before `packages/…`: the tail behind any cut is `packages/shared/src/wire.ts` and
`packages/server/src/http.ts` — **AC-1's own subject**. Q-0016's equivalent prediction was made at
its gate from path ordering and landed on the named files. Measured comparison: Q-0016 was 2,226
insertions and crossed the cap on two of three rounds; Q-0127 was 2,704 and peaked at 191,552 with
no truncation. This is likely between them. Q-0124's `warn` now names the files with no patch, and
Q-0117's `observation:` channel is where a reviewer reports having read them from the branch — the
two composed correctly on Q-0016 and that is what should happen here. **Do not take the
compensation on trust**: Q-0017's three clean reports over a cut diff hid three real findings.

**R-2 — the irreversible-control class, found once already.** Q-0016's blocker was a `load()` that
released the in-flight guard while a POST was unresolved, so a Refresh re-enabled the controls and
an `abort` could win after an `advance`. This ticket puts two more irreversible controls on two more
screens. AC-9 is written to forbid it specifically; it is the criterion most worth mutating.

**R-3 — fifteen criteria is the ceiling, not a comfortable number.** Appendix A names the seam.

**R-4 — a guard that stops discriminating.** M-3. If AC-11's second clause is dropped as redundant,
the register goes on reading as a boundary and is not one.

**R-5 — this is the first surface that can spend money from a browser.** A misfire starts a billed
run. Mitigations that already exist and are not being built here: the run lock refuses a second
concurrent run on one ticket and names the holder; a dry walk costs nothing; and AC-9's confirmation
puts the flow and the dry choice in front of the reader before anything is sent.

## 8. Cross-cutting checklist

- **BYOS** — n/a in the sense that nothing here touches authentication, and load-bearing in the
  sense that the request body is closed at five fields by a schema: there is no place for a
  credential to be added by accident, and `apps/web` sends three of the five at most.
- **Worktree safety** — untouched. Every write to the repository is `core`'s; the browser asks the
  daemon, which asks `core`, which makes the worktrees and the branches. Nothing in `apps/web`
  touches a filesystem, which the existing `node:` scan already forbids.
- **Gate behaviour** — unchanged, and protected twice: AC-12 forbids `auto`, and AC-8 forbids
  wording a stop with any of the three answers a gate takes. The gate answer set is not widened.
- **File format and its schema** — one new shape in `@quorum/shared` with a zod schema and
  `.strict()`, in the tuple-plus-schema arrangement that file already uses. No file on disk changes
  format; no ticket, flow, role or manifest is touched.
- **Lint rules** — no new dependency, so `apps/web/test/package.test.ts`'s declared-dependency pin
  does not move. ESLint already covers `apps/**/*.tsx`.
- **Cold-clone impact** — positive and modest. The first 30 minutes get shorter for anyone who ran
  `quorum open`, because the UI stops being a viewer for work that has to be started elsewhere. The
  README documents the CLI path and that path is unchanged; rewriting it is Q-0028's.
- **Product-agnostic** — nothing here names a product, and the flow names come from `GET /flows`
  rather than from a list in the app.

## 9. Gate obligations

**GO-1 — ratify that no decision entry is owed, and why.** The measured answer to the body's *"a
decision entry is likely owed"* is **no**. `apps/web`'s write boundary is held by
`apps/web/test/source.test.ts` and described in `docs/04-architecture.md`; no landed entry rules it,
and Q-0016 widened it from zero writes to one without taking one. Widening it by two more acts on
the same rule, under the same guard, with the permitted module set unchanged, is the same kind of
change. The reasoning belongs in the guard's own authority comment, which is Q-0108's precedent for
exactly this shape. **The one answer that would owe an entry is OQ-4 answered yes**, and it is named
so that the ruling is the gate's rather than an implementer's.

**GO-2 — rule OQ-1 before the implement step**, AC-6 and AC-14 both naming a file.

**GO-3 — verify forced in both environment rows and on `main` after the merge**, with `quorum lint`
and the git-identity sweep, and confirm CI green on the merged commit.

**GO-4 — the demonstration is performed and transcribed, not reported.** Start the daemon with
`quorum open`, start a flow on a real ticket **from the browser** — a dry walk first, on M-10 —
watch it in mission control, and stop a run from that screen. Record in `runs.log`: the ticket, the
flow, the handle the start answered, what `GET /runs` listed afterwards, and what the daemon
answered the stop with.

This obligation is written this way for a measured reason. Q-0016's GO-6 asked for *"the product run
by hand: a real run parked at a real gate, answered from the browser … the one no unit test can
stand in for"*, and **it was reported discharged while its by-hand half was never performed** —
attempting it would have failed, and would have found the missing producer a day earlier. This
ticket is the producer. It is therefore the first one whose acceptance is genuinely capable of being
demonstrated, and the first where a claim of discharge can be checked against a transcript.

---

## Appendix A — the split seam, named in advance

If the gate refuses fifteen, the seam is **stop**, and start stays.

**Moves out:** AC-2, AC-4, AC-8, AC-10's stop half, AC-11's `/stop` permission (leaving the
writing-function identity register, which start needs anyway), AC-13, and the stop clauses of AC-14
and AC-15.

**Stays:** AC-1, AC-3, AC-5's start half, AC-6, AC-7, AC-9's start half, AC-12, and the start
clauses of AC-14 and AC-15.

**Why this way round and not the other.** Stop is the half with no routing question, no flow choice
and no navigation — the three things that make the start half a design problem. And it is the half
whose user does not exist until start ships: a run visible in mission control today was hand-POSTed,
and whoever can do that can hand-POST a stop. Start first also gives the daemon its producer, which
is what three shipped screens are waiting for.

**What splitting costs, stated rather than presented as free.** The confirm-and-one-in-flight
discipline is specified and reviewed twice; `WRITE_RULES` and the `docs/04-architecture.md` §`apps/web`
paragraph each move twice, and the second move has to be careful not to undo the first's negative
assertions; and the successor inherits AC-9 as prose rather than as a shipped pattern in the same
branch. Against that, Q-0122 accepted twenty and spent three implement rounds, and Q-0126 accepted
sixteen and spent five with a `blocked` round in them.
