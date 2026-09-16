# Q-0016 — The gate screen shows a step's verdict and takes the answer

*Requirements, run 1, candidate-claude. Every measurement below was taken from the tree on
2026-09-16 and none is transcribed from the ticket body, the design brief or a sibling entry. **Three
of them refute the ticket body**, and two of those change what the ticket should build.*

---

## 0. What was measured, before anything was designed

The ticket body's §"Measured against the tree" is accurate in (a), (b), (e), (f) and (g); I re-ran
each and record no correction. What follows is what it did **not** have, in order of how much it
moves the work.

### M-1 (decisive) — the daemon already holds the question, and the wire drops it to a count

`packages/server/src/host.ts:118` declares `RunView.gates` as `readonly GateQuestionEvent[]` — the
**questions themselves**, not a count — and `:264` fills it per call from `gates.pending(handle)`,
the registry `packages/server/src/gates.ts:89` exposes. `wireRunOf`
(`packages/server/src/wire.ts:109–118`) then projects it to `pendingGates: view.gates.length`.

So `gateId`, `kind`, `reason`, `ticketDir` and `retry` are in the daemon's memory, derived per
request, on every one of `POST /runs`, `GET /runs` and `GET /runs/:id` — and are deliberately not
sent.

**This refutes the ticket body's (d).** That paragraph concludes *"the replay is the only channel
carrying the question itself"*. It is the only channel carrying it **today**; it is not the only
channel that can. The consequence is large: the screen half needs **no new route, no event-union
change, no `.harness/` exposure and no new dependency** — one additive field on a shape that already
crosses the wire. Every expensive option OQ-1 lists is a cost the verdict half pays, not one the
screen half pays.

The body's mechanism claim in (d) is otherwise correct and I verified it: `createBroadcast` evicts
from the head, so a parked run's question is the newest retained event. That remains true and is now
a *second* source rather than the only one.

### M-2 (decisive) — `retry` at an author-declared gate does not do nothing; it aborts the run

`packages/core/src/engine/routing.ts:78–96`:

```ts
const retry = typeof step.retryTarget === 'string' ? step.retryTarget : undefined;
…
const answer = await askGate(request, context);
if (answer === 'advance') return null;
if (answer === 'retry' && retry !== undefined) { … return { goto: retry, counter, limit }; }
return { abort: true };
```

`retry` with no `retryTarget` falls through to `{ abort: true }`. `handleFail` (`:145–160`) always
sets `retry: target`, so the engine-presented gate is unaffected.

**This refutes the ticket body's OQ-5**, which reasons that offering the third answer where the
question carries none *"would be a control that does nothing"*. It does the most destructive of the
three things: it ends the run. A screen that renders three buttons unconditionally has a button
labelled *retry* that aborts, on the gate kind that is two thirds of all gates (M-3).

This is the single most important criterion in the document and it is **AC-8**.

### M-3 — two thirds of real gates carry no verdict, and at none of them was `retry` ever possible

`backlog/*/runs.log`, all 108 ticket folders, **220 answered gate questions**:

| kind | advance | retry | abort | total |
| --- | --- | --- | --- | --- |
| `human` (author-declared) | 144 | **0** | 3 | **147** |
| `human-locked` (engine-presented) | 30 | 34 | 8 | **72** |

The zero is structural, not a sample artefact: **no shipped flow sets `retryTarget` on a gate step**.
`grep -rn retryTarget packages/core/src packages/shared/src` returns one production site — the reader
at `routing.ts:79` — and one fixture, `engine.test.ts:72`. All six flows in `harness/flows/` end in a
bare `- gate: human` with a static `reason:` from the flow file.

So the modal gate in this product is the **author-declared end-of-flow gate**: no verdict, no
findings, no diff, no retry, and a reason a flow author wrote months ago. The verdict-bearing gate is
the minority at 33%, and *there* `retry` is the modal answer at 47%.

`docs/05-design-prompt.md` screen 6 says the screen is *"reached when a judge or integrate step
finishes"* and makes *"Send back to development (round 2/3)"* the **primary** action. That describes
the minority case and makes the destructive answer primary on the majority case. Recorded as a
divergence in AC-15, on the precedent Q-0017 set for that same document's board paragraph.

### M-4 — `kind` does not distinguish an engine-presented gate from a deploy gate

`handleFail` composes `kind: 'human-locked'` (`routing.ts:148`). An author-declared `human-locked`
deploy gate — which `docs/GLOSSARY.md` requires be unflippable and which Q-0012 will ship — carries
the same word. The only structural discriminator is the presence of `retry`. A screen may therefore
not label a gate *"exhaustion gate"*, *"deploy gate"* or anything else derived from `kind` alone.
**AC-9.**

### M-5 — findings cross the wire as prose, with no step id

`warnEventSchema` (`packages/shared/src/events.ts`) is `.strict()` over `{ type, message }` — **no
`stepId`**. The findings warn is `steps.ts:364`, `` `${stepId}: ${verdict} — ${findings.join(' | ')}` ``.
`stepDoneEventSchema` *does* carry `stepId`, but its `message` is free text opening `verdict=`.

So attributing findings to a step means parsing a human sentence, which `docs/04-architecture.md`'s
own rule against a second authority forbids in substance. The ticket body's (c) names the two
messages correctly; what it does not say is that the warn is **unattributable structurally**, which is
what makes verbatim display the only honest option short of widening the union.

Event order on the path that reaches a gate, verified by reading `runAgentStep` then `handleFail`:
`done` (`verdict=…`) → `warn` (`<step>: <verdict> — <findings>`) → `warn` (`loop exhausted (N) →
human gate`, or the bound-zero sentence) → `gate`. Adjacent, which is convenient and is still prose.

### M-6 — `GET /history/:id` cannot be addressed for a run that is parked at a gate

`host.ts:300–306` sets `record.runId` **only** when `event.type === 'terminal'`. Run history is keyed
`<TICKET>-<n>` (`read.ts:390`). A run parked at a gate has emitted no terminal event, so
`WireRun.runId` is `null` and the history id cannot be composed. Matching the newest `GET /history`
row for the ticket is inference, not identity.

**OQ-1's candidate (iv) is unreachable for the live case**, not merely thin. It is struck rather than
weighed.

### M-7 — `--auto` and `--dry` emit no question at all

`askGate` (`routing.ts:13–21`) returns `advance` without emitting for `kind === 'auto'`, for
`context.auto` where the kind is not `human-locked`, and for `context.dry`. A run started with
`auto: true` therefore has no gate for this screen to show, correctly — and `host.ts:360` never widens
`auto` on its own. Relevant to AC-10's "not parked" states.

### M-8 — the engine-presented gate's `reason` already spells the three answers

`routing.ts:152–155`: *"…; choose: advance (accept as is), retry (exactly one more `<target>`),
abort"*. A screen rendering that sentence verbatim beside three buttons shows the choices twice. Not
a defect; a rendering constraint, and AC-7's note.

### M-9 — at most one gate is pending per run, by construction

`runStep`'s `parallel:` branch dispatches `runAgentStep` only; a gate step and `handleFail` are both
awaited. So a sequential flow parks on exactly one. The registry (`gates.ts:72`) is a `Map` per run
and permits more. The screen renders the array rather than assuming one — cheap, and the assumption
is the kind that is right until a flow shape changes.

### M-10 — the web app already has the connection primitive, and the guard that forbids writing

`apps/web/src/run-connection.ts` (Q-0120) is shipped and accumulates `readonly Event[]`.
`apps/web/src/daemon-client.ts:48` declares `FetchLike = (path: string) => Promise<DaemonResponse>` —
a GET and nothing else. `apps/web/test/source.test.ts:190–191` forbids, over **every** file under
`apps/web/src`, the four `method: '…'` literals **and** the strings `'/gate'` and `'/stop'`; `:211`
forbids `setInterval`, `setTimeout` and `requestIdleCallback`; `:58` forbids five persistence APIs;
`:511` forbids absolute URLs. Q-0016 is the ticket that moves the first of those five and must leave
the other four with their subject intact.

### M-11 — the payload is small

A gate question is `gateId` (`<run>:<n>`), `kind` (one word), `reason` (longest measured form is the
exhaustion sentence, ~210 bytes), `ticketDir` (an absolute path) and optional `retry` (a step id).
Under 400 bytes, at most one per run. `GET /runs` over this repository's busiest session would carry
a few hundred bytes more. **No cap is specified anywhere in this document**, and the reason is
Q-0127's rather than an omission: nothing large is fetched, so there is nothing to disclose.

---

## 1. Problem

**`maintainer`.** A run parked at a gate can be answered from exactly one place: the terminal that
started it. Since Q-0126 `quorum open` starts the daemon and serves the UI; since Q-0017 and Q-0127 a
maintainer can look at the board and read a ticket's folder in the browser. The one act this
product's whole model rests on — the human's say between every step — has no surface there. A
maintainer who closed the terminal, or started the run from another window, or is looking at the
board on a second screen, can see from `pendingGates` that a run is waiting and has no way to answer
it.

M3's done-when says *"CLI and UI can both answer the same gate"*. The CLI half has worked since
Q-0094. The UI half is met by nothing, and this is the ticket that meets it.

**What makes it more than a form.** Measured (M-2, M-3), the naive gate screen — three buttons,
always — is actively dangerous: on 67% of real gates the `retry` button ends the run. And the
document every screen ticket is built from (`05-design-prompt.md` screen 6) describes the other 33%
and makes that button primary.

**`adopter`.** A stranger following the README reaches a gate inside the first thirty minutes — it is
the moment the product is *for*. Being told to go back to a terminal is the point at which "local
mission control" stops being true.

**`contributor`.** `apps/web` has never issued a request that is not a GET. Whoever adds the second
write inherits whatever this ticket does about the read-only boundary; if it is deleted rather than
re-aimed, the board and the ticket page silently stop being read-only too.

---

## 2. User stories

- **As a `maintainer`**, when a run I started is parked at a gate, I want to open its gate screen in
  the browser and see what is being asked, so that I can answer it without going back to the terminal
  that started the run.
- **As a `maintainer`**, I want the screen to offer me only answers that gate will actually honour, so
  that I cannot end a run by pressing a button that looks like *try again*.
- **As a `maintainer`**, when I open the gate screen for a run that is not parked — it ended, it was
  refused, it never existed, the daemon is not running — I want a sentence that tells me which of
  those it is, so that I am not left looking at an empty panel wondering whether I am early or wrong.
- **As an `adopter`**, I want the first gate I ever meet to be answerable where I am looking, so that
  the thirty-minute path does not require two windows.
- **As a `contributor`**, I want the rule *"this app reads and does not write"* to still exist after
  this ticket, narrowed by name to the one module that answers a gate, so that the next screen cannot
  quietly widen it.

---

## 3. Scope: recommended split

**Recommended: split, and this ticket takes the screen.** The seam the ticket body proposes is the
right one, and M-1 moves it: the screen half is smaller than the body assumed, because the question is
already in the daemon.

**This ticket — the answer, over channels that exist plus one additive field.**
The pending question read from `GET /runs/:id`, rendered; exactly the answers that gate can take,
posted to the shipped `POST /runs/:id/gate`; every not-parked state named; the app's first write, and
the read-only boundary re-aimed. **It renders no verdict, no findings and no diff**, and AC-12 makes
that a checked property rather than an omission.

**Q-0129 — the evidence.** The verdict card with its findings and summary, and the diff. §7 writes
its body out in full, on the lesson that an obligation left in a closing entry expires.

**Why the split rather than one ticket.** Precedent: Q-0013 was refused at eighteen criteria and cut
in three; Q-0014 cut in two; Q-0017 cut in two at exactly this seam — a screen over endpoints that
exist, against a screen needing a route built for it. Measured here, the two halves have **disjoint
blockers**: this half needs no decision entry, no new route, no dependency and no `.harness/` ruling,
while the other half needs at least one decision entry (Q-0127 E-1's own words) and, for the diff, a
range the wire does not carry and a dependency this workspace does not have.

**This is a recommendation and not a decision.** Q-0122's gate refused the split its own document
recommended and wrote down what that cost; the gate rules here too. **GO-1.**

---

## 4. Acceptance criteria

Fifteen, against this role's ceiling of fifteen. Surfaces named per criterion.

---

**AC-1 — `@quorum/shared`: one run's wire shape carries the questions its gates are asking.**
`WireRun` gains `gates`, the pending gate questions **whole** — `gateQuestionEventSchema`'s own
shape, reused and not redeclared — beside the existing `pendingGates`. The field may take the name
`gates` precisely because it is **not** a narrowing: Q-0121 GO-3's rule (`wire.ts:104–108`) is that a
wire field narrowing a `RunView` field may not keep that field's name, and this carries `RunView.gates`
unchanged. `wireRunSchema` stays `.strict()`.
*Test:* `wireRunSchema` parses a run carrying one question and rejects the same body with an unknown
key; a `WireRun` built from a `RunView` with two pending questions carries both; and a source
assertion that the element schema is `@quorum/shared`'s own gate-question schema rather than a second
declaration of those five fields.

**AC-2 — `packages/server`: the projection carries them, derived per request, and `pendingGates` stays
`gates.length`.**
`wireRunOf` is still the **one** projection all three run routes go through (Q-0121 AC-8); it gains
one line. The two fields cannot disagree, because one is computed from the other.
*Test:* `GET /runs/:id` for a run parked at a gate answers the question with its `gateId`, `kind`,
`reason`, `ticketDir` and — where the gate offers one — `retry`; answering that gate and re-fetching
answers `gates: []` and `pendingGates: 0` **without the process being restarted**, which is what
proves it is derived rather than captured; and `pendingGates === gates.length` over a run with zero,
one and two pending gates.

**AC-3 — `packages/server`: no route is added, and the gate answer route is unchanged.**
The transport stays at fourteen registered routes. `POST /runs/:id/gate`, its envelope validation in
`gates.ts`, its four refusal codes and their statuses are untouched.
*Test:* the package's own route-deriving guard reports the same set before and after; and the answer
route's existing suite passes unmodified.

**AC-4 — `apps/web`: the app can issue exactly one request that is not a GET, in the one module where
every request is made.**
`FetchLike` widens to carry a method and a body. `daemon-client.ts` gains one function that answers a
gate and returns the closed answer vocabulary's outcome, on `requestJson`'s terms: the four failure
paths told apart in the order they can occur, and a non-2xx whose body is a `WireRefusal` carried
through unaltered.
*Test:* a `204` reports accepted; a `404 no-such-gate`, a `409 not-this-run`, a `400 not-an-answer`
and a `404 no-such-run` each reach the caller distinguishably; a fetcher that throws reports
unreachable; and no second module in the package constructs a request.

**AC-5 — `apps/web`: the read-only boundary is re-aimed and never deleted.**
`source.test.ts`'s Q-0017 AC-5/AC-10/AC-11/AC-13 guard keeps its subject over every file under
`apps/web/src` **except** the one module AC-4 names, which is exempted **by name** and whose exemption
is asserted load-bearing. `'/stop'` stays forbidden everywhere, this ticket starting and stopping
nothing.
*Test:* injecting `method: 'POST'` into `backlog-board.tsx` or `ticket-page.tsx` fails the guard by
file name; removing the exemption fails it over the gate module, which proves the exemption is doing
work; `'/stop'` injected anywhere fails; and the guard's own discriminator fixtures still select what
they claim. Q-0116's inverted pin and Q-0055's flipped `PRESENCE_CASES` rows are the shape — a guard
whose subject moved, not one that was dropped.

**AC-6 — `apps/web`: the gate path comes from the endpoint register.**
`daemon-endpoints.ts` gains the page-relative gate path with the handle confined to one segment,
beside `runEventsPath`. No path literal is written anywhere else.
*Test:* `test/routes.test.ts`'s existing refusal of a path literal the register does not hold still
fires; the handle is percent-encoded; and the path is page-relative, so `source.test.ts`'s
absolute-URL scan stays clean.

**AC-7 — `apps/web`: the screen renders the question it was asked, and nothing it composed.**
Kind, reason verbatim, the ticket folder, and — where the question carries one — the step a `retry`
returns to. The reason is the engine's sentence and is not rewritten, summarised or truncated.
*Test:* both real reason shapes render in full — an author-declared flow's static `reason:` and the
exhaustion sentence, which already spells the three answers (M-8) — and no string the engine did not
send appears as the question.

**AC-8 — `apps/web`: the answers offered are the answers that gate will honour. (The safety
criterion.)**
`retry` is offered **only** where the question carries `retry`. Measured (M-2), `retry` at a gate with
no `retryTarget` returns `{ abort: true }`, so an unconditional third control is a button labelled
*try again* that ends the run — on the 67% of gates that are author-declared (M-3). `advance` and
`abort` are always offered. **No fourth control and no reason field**, `gateAnswerSchema` being
`z.enum(['advance','retry','abort'])` and its envelope `.strict()`.
*Test:* a question with no `retry` offers exactly two answers and the module emits no `retry`
envelope for it at all; a question carrying `retry` offers three and names the step; a source
assertion that the answer vocabulary is imported from `@quorum/shared` rather than written here; and
the criterion is shown red by making the third control unconditional, which must fail with a message
naming the abort.

**AC-9 — `apps/web`: no gate is labelled from `kind` alone.**
`kind` renders as the word the engine sent. The screen does not call a gate an exhaustion gate, a
deploy gate or a review gate, because `handleFail` composes `kind: 'human-locked'` and an
author-declared deploy gate will carry the same word (M-4).
*Test:* two questions differing only in `retry`, both `human-locked`, render the same label; and a
scan refuses the coined nouns in this package's source.

**AC-10 — `apps/web`: every state that is not *parked at a gate* says which one it is, and none is
silence.**
At least: the run is parked (the subject); the run exists and is parked at no gate; the run has
`ended`; the start was `refused`, which reports the daemon's own condition; the handle was never
minted, which is the route's 404; the daemon is unreachable; the body did not parse. A run started
with `auto` reaches the second of those and is correct there (M-7). No state is a blank panel, a
spinner or a skeleton (`docs/04-architecture.md:317`), and none claims a gate that is not there.
*Test:* one case per state, each asserting a sentence a reader can act on; and a scan of the module's
rendered strings against the enumerated set, so a later state cannot be added silently.

**AC-11 — `apps/web`: answering says what happened, and a gate that is no longer waiting is not
reported as a failure.**
On `204` the screen re-reads `GET /runs/:id` and renders what the run is now — which is how it says
the answer landed, rather than asserting an outcome it did not observe. On `no-such-gate` it says
**the gate is no longer waiting** and re-reads, because that is what the code means: `gates.ts:110`
deletes before it settles, so a client whose POST succeeded and whose response was lost is answered
`no-such-gate` for an answer that landed, and *your answer failed* would be false in the common case.
`not-this-run`, `not-an-answer` and `no-such-run` each render their own sentence.
*Test:* the lost-response path — answer once, answer again with the same envelope — renders the
not-waiting sentence and never a failure; and the other three refusals render distinguishably.

**AC-12 — `apps/web`: no verdict, no findings, no diff, and no control that implies one.**
The screen renders no verdict card, no findings list, no summary, no diff and no file list, and shows
no dash, skeleton or empty region where one would go. Ground rule 2, as a checked property rather
than as an omission a later reader mistakes for a gap.
*Test:* a scan of the module refusing the words a fabricated evidence region would need, and an
assertion that the rendered output over a parked run contains no region whose only content is a
placeholder for absent evidence. The route register's own sentence (AC-14) is what names Q-0129.

**AC-13 — `apps/web`: nothing is persisted, nothing is polled, every request is same-origin.**
The three inherited guards keep their subject over the new module: no browser persistence API, no
timer, no absolute URL. The screen loads on mount and on an explicit act — answering, or the reader
asking again.
*Test:* each of the three guards shown to fail over a fixture injected into the new module, so the
coverage is demonstrated rather than inherited by assumption.

**AC-14 — `apps/web`: the route register says the screen exists.**
`/runs/:handle/gate` flips `screenExists: true` and its `waitingFor` sentence is replaced by one
describing what the screen does, naming **Q-0129** as what the evidence half is waiting for. The
route keeps its path.
*Test:* `test/routes.test.ts`'s register assertions; the placeholder no longer renders for this path;
and the retired sentence appears in no file, on `source.test.ts`'s existing retired-sentence shape.

**AC-15 — the documents say what shipped.**
`docs/04-architecture.md` §`apps/web` describes the gate screen and the one write this app now makes,
and §`packages/server` records that `WireRun` carries the questions rather than only their count.
`docs/05-design-prompt.md` screen 6 gains a divergence paragraph on Q-0017's precedent, recording
what shipped against what it describes: **the gate this product asks most often carries no verdict at
all** (147 of 220 measured), the brief's *"reached when a judge or integrate step finishes"* names the
minority case, and making `retry` the **primary** action is refused because at an author-declared gate
`retry` aborts.
*Test:* `packages/shared/src/docs.test.ts`'s existing checks; and the count in the divergence
paragraph is re-derived rather than transcribed.

---

## 5. Non-goals

Each is a deliberate exclusion with its reason, not an oversight.

1. **The verdict card, the findings and the summary.** Q-0129. Structurally unavailable without
   either widening the event union (decision *"The event union is derived from what the product
   emits"*, 2026-08-25), a route over `.harness/` (Q-0127 erratum E-1's own words make the opposite
   answer owe a decision entry), or parsing a `warn` message that carries no step id (M-5).
2. **The diff.** Q-0129. No route serves one, `materialiseDiff` is a prompt-building function inside a
   run, the range is the flow's and the wire does not carry it, and `diff2html`/`diff`/`jsdiff` are in
   no manifest here.
3. **Widening the gate answer set.** Three documents promised *"override with reason"* and all three
   are corrected. `docs/05-design-prompt.md`'s status line names this ticket as the one that may ask
   for a fourth answer **with a decision entry of its own**. Not asking is the default; asking is not
   a screen decision.
4. **A live socket on this screen.** `run-connection.ts` exists and is not used here. The question is
   derived per request from the host's own registry, which is a better source than scanning a replayed
   buffer for the newest `gate` event, and rendering a run's event stream is mission control's
   (Q-0015). **The stated consequence:** a gate that appears while the screen is open is not shown
   until the reader asks again. That is a real limitation and it is named rather than smoothed over —
   see OQ-2.
5. **Mission control, and the navigation that reaches this screen from it.** Q-0015. Until then the
   screen is reached by typing a URL or from a run listing that does not yet exist.
6. **Starting or stopping a run from the browser.** `'/stop'` stays forbidden by AC-5.
7. **Listing or serving `.harness/` from the ticket routes.** Q-0127 E-1 stands.
8. **Any authentication.** The daemon binds loopback and has none; this screen adds none and is not
   the place to argue about it.
9. **Resuming a run whose daemon restarted.** Q-0019. A handle is meaningless across a restart and
   this screen does not pretend otherwise.
10. **Step chat** (Q-0022) and **run history** (Q-0018).

---

## 6. Gate obligations

Work no step in this flow may perform. Each must be settled at the requirements gate, before an
implement step runs — Q-0062 spent three implement rounds on a blocker its own requirement had named
in advance, and Q-0126's round 1 returned `blocked` because an erratum carried one forward as
*unchanged*.

**GO-1 (BLOCKING) — rule the split.** §3 recommends this ticket takes the screen and Q-0129 takes the
evidence. If the gate refuses the split, the criteria for the verdict card and the diff must be
written **at the gate**, OQ-1 and OQ-2 ruled there, and the size accepted explicitly with the seam
named in advance as the remedy on exhaustion — Q-0122's erratum E-1 is the shape.

**GO-2 (BLOCKING) — rule the wire widening (AC-1).** `WireRun` is a shipped `.strict()` shape with
three routes answering it. The question is whether it gains `gates`, or whether `GET /runs/:id`
answers a second shape, or whether a fifteenth route serves the questions. **Recommendation:
widen `WireRun`.** Measured: Q-0121 deliberately made `wireRunOf` the one projection all three routes
go through, so a second shape undoes that on purpose; a new route duplicates a value the host already
computes for every run view; and the naming rule GO-3 of that ticket established is satisfied, the
field carrying `RunView.gates` whole rather than narrowing it. The cost is that `GET /runs` carries a
few hundred bytes more per parked run (M-11).

**GO-3 (BLOCKING) — whether a decision entry is owed.** **Measured answer: no**, and it is the gate's
to ratify rather than mine to assume.
 - *"The event union is derived from what the product emits"* (2026-08-25) is **not reached**: no
   event changes, and `gateQuestionEventSchema` is reused rather than altered.
 - Q-0127 erratum E-1 is **not reached**: nothing here reads, lists or serves `.harness/`.
 - `04-architecture.md` chose Hono and the route list; no route is added (AC-3), so *executing a
   landed document* applies.
 - No new dependency, so `engineering.md`'s dependency clause is not reached.
 - Q-0121 GO-3's naming rule binds and is satisfied.
 - The one thing that **would** owe an entry is widening the gate answer set, which §5(3) refuses.
 A ruling that changes no behaviour and contradicts no landed entry belongs in the code's own
 authority comment, which is Q-0108's precedent.

**GO-4 — rule OQ-2 (whether the screen subscribes).** Recommendation: it does not; see §5(4).

**GO-5 — Q-0129's body, written out in full at this gate.** §7 is that body. Three obligations found
orphaned in one week (Q-0110's, Q-0111's, Q-0112's) had lived only inside a closed ticket's prose or a
source comment; Q-0105 is the counter-example, and Q-0127 was opened this way at Q-0017's gate.

**GO-6 — verify forced in both environment rows**, per Q-0072's closing finding: a worktree with
neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge. Plus the product run by
hand: a real run parked at a real gate, answered from the browser, with the run continuing.

---

## 7. Q-0129 — the successor's body, in full

> **Q-0129 — The gate screen shows the verdict that reached it, and the diff.** *(Opened at Q-0016's
> requirements gate, p2.)* Q-0016 ships the gate screen over channels that exist: the question, the
> answers, the states. It renders **no verdict, no findings, no summary and no diff**, and AC-12
> makes that a checked property. This is the half that was split off, and the split was on measured
> blockers rather than on size.
>
> **What is missing and why each is a decision rather than a fetch.**
>
> **(a) The verdict and its findings.** `steps.ts` writes `{verdict, findings, summary}` to
> `.harness/run-{run}/{stepId}-verdict-iter-{iter}.json` inside the ticket folder — 197 of them across
> 34 tickets today. `listTicketFiles` excludes every dot-segment path and `GET /tickets/:id/file`
> re-derives membership per request, so `.harness/` is unreadable as well as unnamed. **Q-0127's
> erratum E-1 ruled that exclusion and ruled that no decision entry was owed *for excluding it*
> precisely because the opposite answer would owe one** — serving engine run state from a backlog
> route makes `.harness/` part of what the backlog surface means. So a route over that artifact is a
> decision entry before a line of code.
>
> The three alternatives, each measured at Q-0016's gate:
> *(i) verbatim prose from the stream.* The findings are on the wire as a `warn` message,
> `` `${stepId}: ${verdict} — ${findings.join(' | ')}` ``, and `warnEventSchema` is `.strict()` over
> `{type, message}` with **no `stepId`** — so attributing it to a step means parsing a sentence.
> *(ii) widen the event union* so a verdict crosses structurally, which is *"The event union is
> derived from what the product emits"* (2026-08-25) and a `packages/shared` change.
> *(iii) read it from run history.* **Struck at Q-0016's gate and must not be reconsidered without new
> evidence:** `host.ts` correlates `record.runId` only when the terminal event arrives, and history is
> keyed `<TICKET>-<n>`, so a run parked at a gate has `runId: null` and its history id cannot be
> composed. Matching the newest `GET /history` row for the ticket is inference, not identity.
>
> **(b) The diff.** No route serves one. `materialiseDiff` is `packages/core/src/engine/diff.ts`'s and
> is a prompt-building function *inside* a run; the range is the flow's — `review.yaml` diffs
> `{base}...harness/{id}/integration` — and the wire carries neither. A diff renderer would be this
> workspace's first: `diff2html`, `diff` and `jsdiff` appear in no manifest. Whether the daemon derives
> the diff or `core` gains a function, and whether the dependency is taken, are this ticket's to
> decide; a new dependency needs a one-line justification and, if it changes architecture, an entry.
> `repo.max_diff_bytes` and **Q-0128** are the neighbours: a diff served to a browser has the same
> truncation question a diff handed to a reviewer has, and answering it twice in two places is how the
> two drift.
>
> **What it must not do.** It may not widen the gate answer set — that is a decision entry of its own
> and `gateAnswerEnvelopeSchema` refuses a fourth today. It may not show a verdict where none exists:
> measured at Q-0016's gate, **147 of 220 real gate answers were at author-declared gates that carry
> no verdict at all**, so the screen it extends must stay correct for the two-thirds case, and
> `docs/04-architecture.md:317` forbids a placeholder showing a value nobody measured. And it may not
> make `retry` the primary action, `05-design-prompt.md` screen 6 notwithstanding: at an
> author-declared gate `retry` aborts the run (`routing.ts:78–96`).
>
> **Start by re-measuring.** Do not re-derive the counts above from this body — they were true on
> 2026-09-16 and this repository's own record is that a measurement copied from a document is not a
> measurement.

---

## 8. Open questions

Non-blocking unless marked. The blocking ones are in §6.

**OQ-1 — does `pendingGates` survive beside `gates`?** It is redundant once the array crosses
(`pendingGates === gates.length`). **Recommendation: keep it.** It is a shipped field with a schema, a
listing of many runs wants a count rather than N arrays, and removing it is a breaking change to a
`.strict()` shape for no measured gain. AC-2 makes the two structurally unable to disagree, which is
what makes the redundancy safe rather than a second authority.

**OQ-2 — does the screen hold a socket?** §5(4) says no and names the consequence. The argument for
yes is that a gate appearing while the screen is open is the case the screen exists for; the argument
for no is that `run-connection.ts`'s snapshot is mission control's subject, that the question is
better read from the host than from a replayed buffer, and that a second consumer of that controller
before Q-0015 has decided how it is held is a coupling neither ticket has designed. **GO-4.**

**OQ-3 — does `/runs/:handle/gate` survive as a route?** It is a URL for a transient state: the gate
it names is gone once answered, so a bookmark is a bookmark to a decision somebody already took.
**Recommendation: keep it.** The register already holds it, the four M4 paths are declared there for
the same reason, and AC-10 gives every not-parked state a sentence — which is exactly what makes a
stale bookmark harmless rather than confusing. Folding it into `/runs/:handle` couples this screen's
delivery to Q-0015's.

**OQ-4 — the route through the flows.** Taken at the gate. Q-0120 walked the full seven-stage route
and is the only M3 ticket to have done so, at $198.54; Q-0017 and Q-0127 went `requirements` →
`chore` at $123.34 and $108.67. M2's closing measurement — that the feature flows have four tickets
of evidence between them, all from August — is the argument for the full route. The argument against
is that fifteen criteria over three packages, with one behavioural criterion (AC-8) that a red test
can genuinely fail on, is chore-shaped; and that `solutioning` would be asked to emit contracts for a
React screen whose only new shape is one field on an existing schema.

**OQ-5 — what the screen says about the ticket.** The question carries `ticketDir`, an **absolute
path on the daemon's machine**. Rendering it is honest and is also the only thing the wire gives.
`WireRun.ticketId` is beside it and is what `/backlog/:ticketId` takes, so a link to the ticket page
is available. Whether the screen links there, and whether an absolute server path belongs in a
browser at all, is a rendering question this document does not rule.

---

## 9. Risks

**R-1 — AC-8 is the criterion most likely to be weakened by a reviewer who has not read M-2.** An
unconditional third button is the obvious implementation and is what `05-design-prompt.md` describes.
The mitigation is in the criterion: it must be shown **red** by making the control unconditional, with
a message naming the abort, so the danger is in the failure output rather than only in this document.

**R-2 — the guard re-aim (AC-5) is where this ticket is likeliest to ship a hole.** Q-0014's round 2
found a guard narrowed to *"shipping files"* such that every file carrying the defect was outside the
scan forbidding it; Q-0111's first needle matched nothing including its own subject. AC-5 therefore
requires the **exemption itself** be shown load-bearing, not merely that the guard still passes.

**R-3 — this ticket's own review may be truncated.** Four consecutive tickets before Q-0127 were
reviewed against a diff cut at `repo.max_diff_bytes` (200,000). Q-0127 peaked at 191,552 B with zero
truncation. This change is smaller than Q-0127's — one field, one module, one guard re-aim, one screen
— so truncation is unlikely; **Q-0124's warn now names any file it gave no patch for**, and if it
fires, a hand cross-vendor pass over the named files is owed before the gate. Predicted and to be
measured, not assumed: Q-0127 predicted truncation and was refuted.

**R-4 — a flow could later set `retryTarget` on an author-declared gate**, at which point M-3's zero
stops being structural. AC-8 keys on the **question's** `retry` field rather than on the gate kind or
on a count, so it stays correct if that happens. Stated because the criterion's correctness depends on
it and a reader checking only the measurement would think otherwise.

**R-5 — version skew between a packed daemon and a packed bundle.** `wireRunSchema` is `.strict()`, so
a browser running the old schema against a new body rejects it. Both ship in the same five-tarball set
(*"The distribution set is five, and rejoins the emitting set"*, 2026-09-15), so there is no supported
arrangement in which they differ. Registered rather than mitigated.

**R-6 — the screen has no way in until Q-0015.** Reached by typing a URL. This is §5(5) and it is the
same trade Q-0121 recorded: shipping a capability before the screen that reaches it, rather than
bundling them and growing the ticket that way.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a as a code path — this ticket touches no adapter and no `check()`. **Not n/a as a word**: no criterion, test name, rendered string or document sentence may use *API key*, *token* or *credential*; the word is **subscription**. |
| **Worktree safety** | n/a. Nothing here writes to a working tree, creates a branch or touches a worktree. The screen's one mutation settles a promise `core` is already parked on. |
| **Gate behaviour** | The subject. Human-gated by default is unchanged; `auto` is opt-in per gate and `host.ts` never widens it; `human-locked` stays unbypassable — nothing in `apps/web` reaches `askGate`'s policy, and the three answers are `@quorum/shared`'s enum. **The screen may offer fewer answers than three and never more** (AC-8). |
| **File format and schema** | One additive field on `WireRun`, with its schema, in `@quorum/shared` — the one place a wire shape is declared and the only one executable in a browser. No file on disk changes format. No ticket, flow, role or manifest schema is touched. |
| **Lint rules** | No flow changes, so `quorum lint` has no new subject. `@typescript-eslint/no-deprecated` covers `apps/**/*.ts` already. `turbo-inputs.test.ts` earns a registration only if a new out-of-package read appears; none is planned, and if one does it is that guard working as designed. |
| **Cold-clone impact** | **Positive and the reason to build it.** The thirty-minute path reaches a gate — it is the moment the product is for — and today it requires the terminal that started the run. No new dependency, so the install does not move. `quorum open` already serves the bundle. |
| **Product-agnostic** | Nothing here knows about any SaaS product. |
| **Files are the database** | Unchanged: the daemon holds no new state. `RunView.gates` is derived per call from the registry `askGate` parks on, and `pendingGates`/`gates` are computed per request. Nothing is cached, nothing is persisted in the browser. |
| **Errors are explicit** | AC-10 and AC-11. Every state names itself; no state is silence, a spinner or a skeleton; a refusal carries the daemon's own `code`, `condition` and `remedy`; and a gate that is no longer waiting is reported as that rather than as a failure. |
| **Vocabulary** | **gate**, **flow**, **step**, **ticket**, **stage**, **adapter**, **run lock**, **connection state** used as `docs/GLOSSARY.md` defines them. No term is coined and none is owed — this screen introduces no noun — so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). Forbidden here specifically: a gate is not an *approval*, a *checkpoint* or a *review step*; an answer is not an *override*. |
