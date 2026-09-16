# Q-0016 — The gate screen shows a step's verdict and takes the answer

*Merged requirement, run 1, iteration 1. Every measurement below was re-run against the tree on
2026-09-16 rather than taken from either candidate, from the ticket body, from
`docs/05-design-prompt.md` or from a sibling ticket's entry. **Four measurements refute something**,
and two of them change what this ticket should build.*

---

## 0. What was measured, and what it refutes

Both candidates measured well. §0 records only what survives re-derivation, plus the corrections.

### M-1 (decisive) — the daemon already holds the question, and the wire drops it to a count

`packages/server/src/host.ts:118` declares `RunView.gates` as `readonly GateQuestionEvent[]` — the
**questions themselves** — and `:264` fills it per call from `gates.pending(record.handle)`, the
registry `packages/server/src/gates.ts` exposes. `wireRunOf` then projects it:

```ts
export function wireRunOf(view: RunView): WireRun {
  return { handle, flow, ticketId, runId, state, pendingGates: view.gates.length };
}
```

So `gateId`, `kind`, `reason`, `ticketDir` and `retry` are in the daemon's memory, derived per
request, on every one of `POST /runs`, `GET /runs` and `GET /runs/:id`, and are deliberately not
sent.

**This refutes the ticket body's (d)**, which concludes *"the replay is the only channel carrying
the question itself"*. It is the only channel carrying it **today**; it is not the only channel that
can. The consequence is the whole shape of this ticket: the screen half needs **no new route, no
event-union change, no `.harness/` exposure and no new dependency** — one additive field on a shape
that already crosses the wire. Every expensive option the ticket's OQ-1 lists is a cost the
*evidence* half pays.

The body's mechanism claim in (d) is otherwise correct: `createBroadcast` evicts from the head, so a
parked run's question is the newest retained event. That stays true and is now a second source
rather than the only one.

### M-2 (decisive, and the safety criterion) — `retry` at an author-declared gate aborts the run

`packages/core/src/engine/routing.ts:78–96`, verified verbatim:

```ts
const retry = typeof step.retryTarget === 'string' ? step.retryTarget : undefined;
const answer = await askGate(request, context);
if (answer === 'advance') return null;
if (answer === 'retry' && retry !== undefined) { … return { goto: retry, counter, limit }; }
return { abort: true };
```

`retry` with no `retryTarget` falls through to `{ abort: true }`. `handleFail` (`:145–160`) always
sets `retry: target`, so the engine-presented gate is unaffected.

**This refutes the ticket body's OQ-5**, which reasons that offering the third answer where the
question carries none *"would be a control that does nothing"*. It does the most destructive of the
three things available: it ends the run. **AC-8.**

### M-3 — the modal gate carries no verdict, and at none of them was `retry` ever possible

`backlog/*/runs.log`, all 108 ticket folders. `askGate` appends
`run=<n> gate=<kind> answer=<answer>` at exactly one site, so the log is the census:

| kind | advance | retry | abort | total |
| --- | --- | --- | --- | --- |
| `human` (author-declared) | 144 | **0** | 3 | **147** |
| `human-locked` (engine-presented) | 30 | 34 | 8 | **72** |
| | | | | **219** |

**Correction to candidate-claude, which reported 220.** A 220th line matches the same grep and
carries an **empty** answer (`gate=erratum answer=`). `askGate` writes one of exactly three words, so
no call site can produce it: it is a hand-written `runs.log` note, not an engine answer. The split is
147 / 72 either way — 67.1% author-declared — and the totals are 219.

The zero is structural rather than a sample artefact. `grep -rn retryTarget packages/core/src
packages/shared/src harness/flows` returns **one production site** (the reader at `routing.ts:79`)
and **one fixture** (`engine.test.ts:72`). All six shipped flows end in a bare `- gate: human` with a
static `reason:`. So **no shipped flow sets `retryTarget` on any gate step**, and at 147 of 219 real
gates an unconditional `retry` control would have ended the run.

`docs/05-design-prompt.md` screen 6 says the screen is reached *"when a judge or integrate step
finishes"* and makes *"Send back to development (round 2/3)"* the **primary** action. That describes
the 33% case and makes the destructive answer primary on the 67% case. **AC-14** records the
divergence on the precedent Q-0017 set for that same document.

### M-4 — `kind` does not distinguish an engine-presented gate from a deploy gate

`handleFail` composes `kind: 'human-locked'` (`routing.ts:148`). An author-declared `human-locked`
deploy gate — which `docs/GLOSSARY.md` requires be unflippable and which Q-0012 will ship — carries
the same word. The only structural discriminator is the presence of `retry`. **AC-9.**

### M-5 — findings cross the wire as prose, and are unattributable structurally

`warnEventSchema` is `.strict()` over `{ type, message }` — **no `stepId`**. The findings warn is
`steps.ts:364`, `` `${stepId}: ${verdict} — ${findings.join(' | ')}` ``. `stepDoneEventSchema` does
carry `stepId`, and its `message` is free text opening `verdict=`. So attributing findings to a step
means parsing a human sentence. This is why the evidence half is a decision and not a rendering
choice, and it is Q-0129's.

### M-6 — a run parked at a gate has no run-history id

`host.ts:296–304` sets `record.runId` **only** when `event.type === 'terminal'`, under a comment
saying the terminal event is the only one carrying run identity. History is keyed `<TICKET>-<n>`. So
a parked run has `runId: null` and its history id cannot be composed. **The ticket's OQ-1 candidate
(iv) — read the verdict word from `GET /history/:id` — is unreachable for the live case** and is
struck rather than weighed.

### M-7 — `--auto` and `--dry` emit no question at all

`askGate` (`routing.ts:13–21`) returns `advance` without emitting for `kind === 'auto'`, for
`context.auto` where the kind is not `human-locked`, and for `context.dry`. A run started with
`auto: true` therefore has no gate for this screen to show, correctly. Relevant to **AC-10**.

### M-8 — the engine-presented gate's `reason` already spells the three answers

`routing.ts:152–155` composes *"…; choose: advance (accept as is), retry (exactly one more
`<target>`), abort"*. A screen rendering that verbatim beside controls shows the choices twice. A
rendering constraint, not a defect. **AC-7.**

### M-9 — "exactly one answer wins" is a property, and a lost response is indistinguishable

`gates.ts` `answer()` returns one of `not-an-answer`, `not-this-run`, `no-such-gate` or `null`, and
**deletes before it settles**, with its own comment saying the delete and the settle are one step
with no await between them. `packages/server/src/http.ts:212–225` answers `204` on success and maps
each refusal through `ANSWER_REFUSAL_STATUS`, plus a `400 malformed-json`.

So a client whose POST succeeded and whose response was lost is answered `no-such-gate` on retry
**for an answer that landed** — and `no-such-gate` is also what a gate answered by the CLI in another
window produces. The response cannot tell the two apart. **AC-12** takes candidate-codex's wording
over candidate-claude's for exactly this reason.

### M-10 — the app's read boundary, and the guard that holds it

`apps/web/src/daemon-client.ts:48` declares `FetchLike = (path: string) => Promise<DaemonResponse>` —
a GET and nothing else. `apps/web/test/source.test.ts` forbids, over **every** file under
`apps/web/src`, the four `method: '…'` literals **and** the strings `'/gate'` and `'/stop'`, with
discriminator fixtures assembled so the file is not its own subject; it also forbids `setInterval`,
`setTimeout`, `requestIdleCallback`, five persistence APIs and absolute URLs.
`apps/web/src/daemon-endpoints.ts` holds `DAEMON_ENDPOINTS`, `runEventsPath`, `ticketDetailPath`,
`ticketFilePath` and `runEventsUrl`, and **no gate path**. `apps/web/src/routes.ts` carries
`/runs/:handle/gate` with `screenExists: false`.

### M-11 — correction to the ticket body's citation

Ground rule 2 cites `docs/04-architecture.md:200` for the placeholder rule. That rule is at **`:317`**
— *"No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated project,
run, ticket or cost"* — and `:200` carries nothing of the kind. Candidate-claude quoted both and is
inconsistent; `:317` is right. Recorded because a criterion citing a line that does not say what it
claims is this repository's most-recorded defect class arriving through a citation.

### M-12 — the payload is small, so no cap is specified anywhere

A gate question is `gateId` (`<run>:<n>`), `kind` (one word), `reason` (longest measured form is the
exhaustion sentence, ~210 bytes), `ticketDir` (an absolute path) and optional `retry` (a step id) —
under 400 bytes, at most one per parked run. **No cap appears anywhere in this document**, and that
is Q-0127's lesson rather than an omission: nothing large is fetched, so there is nothing to
disclose.

---

## 1. Problem

**`maintainer`.** A run parked at a gate can be answered from exactly one place: the terminal that
started it. Since Q-0126 `quorum open` starts the daemon and serves the UI; since Q-0017 and Q-0127 a
maintainer can read the board and a ticket's folder in the browser. The one act this product's whole
model rests on — the human's say between every step — has no surface there. A maintainer who closed
the terminal, started the run from another window, or is looking at the board on a second screen can
see from `pendingGates` that a run is waiting and has no way to answer it.

M3's done-when says *"CLI and UI can both answer the same gate"*. The CLI half has worked since
Q-0094; the UI half is met by nothing.

**What makes it more than a form.** Measured (M-2, M-3), the naive gate screen — three controls,
always — is actively dangerous: on 67% of real gates the `retry` control ends the run. And the
document every screen ticket is built from describes the other 33% and makes that control primary.

**`adopter`.** A stranger following the README reaches a gate inside the first thirty minutes — it is
the moment the product is *for*. Being sent back to a terminal is where "local mission control" stops
being true.

**`contributor`.** `apps/web` has never issued a request that is not a GET. Whoever adds the second
write inherits whatever this ticket does about the read-only boundary; deleted rather than re-aimed,
the board and the ticket page silently stop being read-only too.

---

## 2. User stories

- **As a `maintainer`**, when a run I started is parked at a gate, I want to open its gate screen in
  the browser and see what is being asked, so that I can answer it without returning to the terminal
  that started the run.
- **As a `maintainer`**, I want the screen to offer me only answers that gate will actually honour,
  so that I cannot end a run by pressing a control that reads as *try again*.
- **As a `maintainer`**, when I open the gate screen for a run that is not parked — it ended, it was
  refused, it never existed, the daemon is not running — I want a sentence telling me which of those
  it is, so that I am not left looking at an empty panel wondering whether I am early or wrong.
- **As a `maintainer`**, when my answer's response goes missing and I answer again, I want to be told
  the gate is no longer waiting rather than that my answer failed, so that I do not answer a third
  time or go looking for a defect that is not there.
- **As an `adopter`**, I want the first gate I ever meet to be answerable where I am looking, so that
  the thirty-minute path does not require two windows.
- **As a `contributor`**, I want the rule *"this app reads and does not write"* to still exist after
  this ticket, narrowed by name to the one module that answers a gate, so that the next screen cannot
  quietly widen it.

---

## 3. Scope, and the two things ruled inside it

**Recommended: split, and this ticket takes the answerable screen.** The seam the ticket body
proposes is the right one and M-1 moves it: the screen half is smaller than the body assumed, because
the question is already in the daemon. Both candidates reached this independently — candidate-claude
by recommending it outright, candidate-codex by scoping to the same half and marking its own OQ-1 and
OQ-2 *"blocking for the follow-up ticket, not Q-0016"*.

**This ticket — the answer, over channels that exist plus one additive field.** The pending question
read from `GET /runs/:id` and rendered; exactly the answers that gate can take, posted to the shipped
`POST /runs/:id/gate`; every not-parked state named; the app's first write, and the read-only
boundary re-aimed. **It renders no verdict, no findings and no diff**, and AC-13 makes that a checked
property rather than an omission a later reader mistakes for a gap.

**Q-0129 — the evidence.** The verdict card with its findings and summary, and the diff. §7 writes
its body out in full, on the lesson that an obligation left in a closing entry expires.

**Why split rather than accept the size.** Q-0013 was refused at eighteen criteria and cut in three;
Q-0014 cut in two; Q-0017 cut in two at exactly this seam. Measured here, the two halves have
**disjoint blockers**: this half needs no decision entry, no new route, no new dependency and no
`.harness/` ruling, while the other needs at least one decision entry by Q-0127 erratum E-1's own
words and, for the diff, a range the wire does not carry and a dependency this workspace does not
have. **GO-1** — and it is a recommendation, not a decision: Q-0122's gate refused the split its own
document recommended and wrote down what that cost.

### 3.1 Ruled: the question comes from the wire, not from the replay

The two candidates disagree on the channel and the disagreement is the design.

Candidate-codex reads the pending question from the replayed event stream and needs no wire change at
all. Candidate-claude widens `WireRun` and reads it from `GET /runs/:id`.

**The wire wins, and codex's own AC-18 is the reason.** That criterion concedes a state in which
`GET /runs/:handle` reports a gate is waiting, replay has not supplied the question, and the screen
*"renders no answer controls because it has no `gateId` to correlate safely"* — the screen cannot do
its one job. Its AC-6 concedes a second: an incomplete replay, which the screen must disclose and
cannot repair. Both states exist only because the design reads a **buffer** where the **authority**
already holds the value and derives it per request (M-1). Widening the wire does not mitigate those
states; it removes them.

Two further reasons, both measured: `run-connection.ts`'s snapshot is mission control's subject and a
second consumer of that controller before Q-0015 has decided how it is held is a coupling neither
ticket has designed; and the widening is one additive field plus one line in the single projection
Q-0121 deliberately made all three run routes share. **GO-2** ratifies it.

### 3.2 Ruled: the screen holds no socket, and the consequence is named

It reads on mount and when the reader asks again — which is the board's rule (`04-architecture.md`
§`apps/web`) rather than a new one — and after answering it re-reads rather than watching the stream.

**The consequence, stated rather than smoothed over:** a gate that arrives while the screen is open
is not shown until the reader asks again, and what the run does next is shown by re-reading rather
than live. That is a real limitation. It is accepted here because the alternative couples this ticket
to `run-connection.ts` and adds the two states §3.1 just removed, and because rendering a run's event
stream is mission control's subject. **GO-4** — non-blocking, because the screen works without it.

---

## 4. Acceptance criteria

Fourteen, against this role's ceiling of fifteen. Surfaces named per criterion.

---

**AC-1 — `@quorum/shared`: one run's wire shape carries the questions its gates are asking.**
`WireRun` gains `gates`, the pending gate questions **whole** — `gateQuestionEventSchema`'s own shape,
reused and not redeclared — beside the existing `pendingGates`. The field may take the name `gates`
precisely because it is **not** a narrowing: Q-0121 GO-3's rule is that a wire field narrowing a
`RunView` field may not keep that field's name, and this carries `RunView.gates` unchanged.
`wireRunSchema` stays `.strict()`.
*Test:* `wireRunSchema` parses a run carrying one question and rejects the same body with an unknown
key; a `WireRun` built from a `RunView` with two pending questions carries both, in order; and a
source assertion that the element schema is `@quorum/shared`'s own gate-question schema rather than a
second declaration of those five fields.

**AC-2 — `packages/server`: the projection carries them, derived per request, and `pendingGates`
stays `gates.length`.**
`wireRunOf` is still the **one** projection all three run routes go through (Q-0121 AC-8); it gains
one line. The two fields cannot disagree, because one is computed from the other.
*Test:* `GET /runs/:id` for a run parked at a gate answers the question with its `gateId`, `kind`,
`reason`, `ticketDir` and — where the gate offers one — `retry`; answering that gate and re-fetching
answers `gates: []` and `pendingGates: 0` **without the process being restarted**, which is what
proves it is derived rather than captured; and `pendingGates === gates.length` over runs with zero,
one and two pending gates.

**AC-3 — `packages/server`: no route is added, and the gate answer route is unchanged.**
The transport stays at its current registered set. `POST /runs/:id/gate`, its envelope validation in
`gates.ts`, its four refusal codes and their statuses are untouched — including that `http.ts` does
**not** validate the envelope, `gates.ts` owning that vocabulary.
*Test:* the package's own route-deriving guard reports the same set before and after; and the answer
route's existing suite passes unmodified.

**AC-4 — `apps/web`: the app can issue exactly one request that is not a GET, in the one module where
every request is made.**
`FetchLike` widens to carry a method and a body. `daemon-client.ts` gains one function that answers a
gate and reports the outcome on `requestJson`'s terms: the four failure paths told apart in the order
they can occur, and a non-2xx whose body is a `WireRefusal` carried through unaltered.
*Test:* a `204` reports accepted; `no-such-gate`, `not-this-run`, `not-an-answer`, `no-such-run` and
`malformed-json` each reach the caller distinguishably; a fetcher that throws reports unreachable; a
2xx body that is not the shape it claims is reported as such rather than as a success; and no second
module in the package constructs a request.

**AC-5 — `apps/web`: the package's source boundaries after this ticket — one re-aimed, three
unmoved.**
`source.test.ts`'s Q-0017 AC-5/AC-10/AC-11/AC-13 write guard keeps its subject over every file under
`apps/web/src` **except** the one module AC-4 names, which is exempted **by name**; `'/stop'` stays
forbidden everywhere, this ticket starting and stopping nothing. The persistence, timer and
absolute-URL guards keep their subject and are demonstrated over the new module rather than inherited
by assumption.
*Test:* injecting `method: 'POST'` into `backlog-board.tsx` or `ticket-page.tsx` fails the guard by
file name; **removing the exemption fails the guard over the gate module**, which is what proves the
exemption is doing work rather than merely being present; `'/stop'` injected anywhere fails; the
guard's own discriminator fixtures still select what they claim; and a browser-persistence call, a
timer call and an absolute URL each injected into the new module fail their own guard by name.
Q-0116's inverted pin and Q-0055's flipped `PRESENCE_CASES` rows are the shape — a guard whose
subject moved, not one that was dropped.

**AC-6 — `apps/web`: the gate path comes from the endpoint register.**
`daemon-endpoints.ts` gains the page-relative gate path with the handle confined to one segment,
beside `runEventsPath`. No path literal is written anywhere else.
*Test:* `test/routes.test.ts`'s existing refusal of a path literal the register does not hold still
fires; a handle carrying a separator is percent-encoded rather than trusted; and the path is
page-relative, so the absolute-URL scan stays clean.

**AC-7 — `apps/web`: the screen renders the question it was asked, and nothing it composed.**
Kind as the word the engine sent, reason **verbatim**, the ticket folder, and — where the question
carries one — the step a `retry` returns to. The reason is not rewritten, summarised or truncated,
and no machine value is parsed out of it.
*Test:* both real reason shapes render in full — an author-declared flow's static `reason:` and the
exhaustion sentence, which already spells the three answers (M-8) — and no string the engine did not
send appears as part of the question.

**AC-8 — `apps/web`: the answers offered are the answers that gate will honour, and an answer it does
not offer is explained rather than silently absent. (The safety criterion.)**
No control may issue `answer: "retry"` for a question carrying no `retry`. Measured (M-2), that
answer returns `{ abort: true }`, so an unconditional third control is one reading *try again* that
ends the run — on 147 of 219 real gates (M-3). `advance` and `abort` are always offered. **No fourth
control and no reason field**, `gateAnswerSchema` being `z.enum(['advance','retry','abort'])` and its
envelope `.strict()`.
Where the question carries no `retry`, the screen **says the gate offers no retry target**. Whether
that is an inert control with its reason beside it (candidate-codex) or a sentence in its place
(candidate-claude) is a rendering choice this document does not rule; what it rules out is the third
option — two controls and no explanation — because a reader cannot then tell a screen that omitted an
answer from one that lost a control.
*Test:* a question with no `retry` emits no `retry` envelope under any interaction **and** renders
the explanatory sentence; a question carrying `retry` offers it and names the step; a source
assertion that the answer vocabulary is imported from `@quorum/shared` rather than written here; and
**the criterion is shown red** by making the third control unconditional, failing with a message
naming the abort.

**AC-9 — `apps/web`: no gate is labelled from `kind` alone.**
`kind` renders as the word the engine sent. The screen does not call a gate an exhaustion gate, a
deploy gate or a review gate, because `handleFail` composes `kind: 'human-locked'` and an
author-declared deploy gate will carry the same word (M-4).
*Test:* two questions differing only in `retry`, both `human-locked`, render the same label; and a
scan refuses the coined nouns in this package's source.

**AC-10 — `apps/web`: every state that is not *parked at a gate* says which one it is, and none is
silence.**
At least: parked (the subject); the run exists and is parked at no gate; the run has `ended`; the
start was `refused`, reporting the daemon's own condition; the handle was never minted, which is the
route's 404; the daemon is unreachable; the body did not parse. A run started with `auto` reaches the
second of those and is correct there (M-7). No state is a blank panel, a spinner or a skeleton
(`docs/04-architecture.md:317`), and none claims a gate that is not there or renders answer controls.
*Test:* one case per state, each asserting a sentence a reader can act on; and a scan of the module's
rendered strings against the enumerated set, so a later state cannot be added silently.

**AC-11 — `apps/web`: one answer in flight, and nothing claimed that was not observed.**
While an answer request is in flight every answer control is inert, so one screen instance can have
at most one answer request outstanding for a gate. On a `204` the screen says which answer it sent,
re-reads `GET /runs/:id` and renders what the run is now; it does **not** claim the next step
succeeded, the ticket advanced or the run ended until a read establishes it. Once the gate is no
longer pending the answer controls are gone, and the route stays on screen rather than redirecting to
a screen that does not exist.
*Test:* two activations in the same turn produce exactly one request; the post-answer render asserts
no outcome beyond what the re-read returned; and the controls are absent once `gates` no longer holds
that `gateId`.

**AC-12 — `apps/web`: a gate that is no longer waiting is reported as that, and never as a failure or
as a success.**
`no-such-gate` renders as *the gate is no longer waiting* and re-reads. It may claim **neither** that
the earlier answer landed **nor** that it failed, because the response cannot tell a lost 204 from an
answer given at the CLI from any other disappearance of that gate (M-9). `not-this-run`,
`not-an-answer`, `no-such-run` and `malformed-json` each render their own sentence, carrying the
daemon's `code`, `condition` and `remedy` where it supplies them. No failure is silently retried.
*Test:* the lost-response path — answer once, answer again with the same envelope — renders the
not-waiting sentence and never a failure or an optimistic success; and the other four refusals render
distinguishably.

**AC-13 — `apps/web`: no verdict, no findings, no summary, no diff, and no region where one would
go.**
The screen renders no verdict card, no findings list, no summary, no diff and no file list, and shows
no dash, skeleton or empty region standing in for absent evidence. It parses no verdict, finding,
count, cost or duration out of any `warn` or `done` message. Ground rule 2, as a checked property.
*Test:* a scan of the module refusing the words a fabricated evidence region would need; an assertion
that the rendered output over a parked run contains no region whose only content is a placeholder for
absent evidence; and a source assertion that the module reads no event `message` field at all.

**AC-14 — the route register and the documents say what shipped.**
`/runs/:handle/gate` flips `screenExists: true` and its `waitingFor` sentence is replaced by one
describing what the screen does, naming **Q-0129** as what the evidence half waits for; the route
keeps its path. `docs/04-architecture.md` §`apps/web` describes the screen and the one write this app
now makes, and §`packages/server` records that `WireRun` carries the questions rather than only their
count. `docs/05-design-prompt.md` screen 6 gains a divergence paragraph on Q-0017's precedent: **the
gate this product asks most often carries no verdict at all** (147 of 219 measured), the brief's
*"reached when a judge or integrate step finishes"* names the minority case, and making `retry` the
**primary** action is refused because at an author-declared gate `retry` aborts.
*Test:* `test/routes.test.ts`'s register assertions and the placeholder no longer rendering for this
path; the retired sentence appearing in no file, on `source.test.ts`'s existing retired-sentence
shape; `packages/shared/src/docs.test.ts`'s existing checks; and **the count in the divergence
paragraph re-derived rather than transcribed from this document**.

---

## 5. Non-goals

Each is a deliberate exclusion with its reason.

1. **The verdict card, the findings and the summary.** Q-0129. Structurally unavailable without
   either widening the event union (*"The event union is derived from what the product emits"*,
   2026-08-25), a route over `.harness/` (Q-0127 erratum E-1 makes the opposite answer owe a decision
   entry), or parsing a `warn` that carries no step id (M-5).
2. **The diff.** Q-0129. No route serves one; `materialiseDiff` is a prompt-building function inside
   a run; the range is the flow's and the wire carries neither; `diff2html`, `diff` and `jsdiff` are
   in no manifest here.
3. **Widening the gate answer set.** Three documents promised *"override with reason"* and all three
   are corrected — `04-architecture.md` at Q-0013, the plan's M3 line at Q-0118, the design brief at
   Q-0017, whose status line names **this ticket** as the one that may ask for a fourth answer **with
   a decision entry of its own**. Not asking is the default; asking is not a screen decision.
4. **A live socket on this screen.** §3.2, with its consequence named. `run-connection.ts` exists and
   is not used here.
5. **Rendering retained `warn`/`done` messages as evidence.** Candidate-codex's AC-4 offers this and
   it is declined *in this ticket* rather than refused outright: with no socket (§3.2) there is no
   stream to read them from, and whether a run's prose belongs on a gate screen is the question
   Q-0129 rules. Recorded so the successor does not treat it as settled against.
6. **Mission control, and the navigation that reaches this screen from it.** Q-0015. Until then the
   screen is reached by typing a URL.
7. **Starting or stopping a run from the browser.** `'/stop'` stays forbidden by AC-5.
8. **Listing or serving `.harness/` from the ticket routes.** Q-0127 E-1 stands.
9. **Any authentication.** The daemon binds loopback and has none; this screen adds none and is not
   the place to argue about it.
10. **Resuming a run whose daemon restarted** (Q-0019), **step chat** (Q-0022), **run history**
    (Q-0018).

---

## 6. Gate obligations

Work no step in this flow may perform. Each must be settled **at the requirements gate**, before an
implement step runs — Q-0062 spent three implement rounds on a blocker its own requirement had named
in advance, and Q-0126's round 1 returned `blocked` because an erratum carried one forward as
*unchanged*.

**GO-1 (BLOCKING) — rule the split.** §3. If the gate refuses it, the criteria for the verdict card
and the diff must be written at the gate, OQ-1 and OQ-2 of the ticket body ruled there, and the size
accepted explicitly with the seam named in advance as the remedy on exhaustion — Q-0122's erratum E-1
is the shape.

**GO-2 (BLOCKING) — ratify the wire widening (AC-1, AC-2).** §3.1. `WireRun` is a shipped `.strict()`
shape with three routes answering it. **Recommendation: widen it.** The alternatives — a second shape
for `GET /runs/:id`, or a fifteenth route — undo Q-0121's one-projection property on purpose, or
duplicate a value the host already computes for every run view. Cost: `GET /runs` carries a few
hundred bytes more per parked run (M-12). `04-architecture.md` moves with it (AC-14).

**GO-3 (BLOCKING) — ratify that no decision entry is owed.** **Measured answer: no**, and it is the
gate's to ratify rather than this document's to assume. The event union is unchanged and
`gateQuestionEventSchema` is reused; nothing reads, lists or serves `.harness/`; no route is added, so
`04-architecture.md`'s route list is executed rather than changed; no dependency is added; Q-0121
GO-3's naming rule binds and is satisfied. The one change that **would** owe an entry is widening the
gate answer set, which §5(3) refuses. A ruling that changes no behaviour and contradicts no landed
entry belongs in the code's own authority comment — Q-0108's precedent.

**GO-4 — rule §3.2 (whether the screen subscribes).** Recommendation: it does not, with the
consequence named. Non-blocking: the screen works either way, and the criteria that move if it is
overturned are AC-10 (two further states) and AC-13 (§5(5) reopens).

**GO-5 — Q-0129's body, written out in full at this gate.** §7 is that body. Three obligations found
orphaned in one week (Q-0110's, Q-0111's, Q-0112's) had lived only inside a closed ticket's prose or a
source comment; Q-0127 was opened this way at Q-0017's gate and is the counter-example.

**GO-6 — verify forced in both environment rows**, per Q-0072's closing finding: a worktree with
neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge. Plus the product run by
hand: a real run parked at a real gate, answered from the browser, with the run continuing — the
criterion `quorum open` exists for.

---

## 7. Q-0129 — the successor's body, in full

> **Q-0129 — The gate screen shows the verdict that reached it, and the diff.** *(Opened at Q-0016's
> requirements gate, p2.)* Q-0016 ships the gate screen over channels that exist: the question, the
> answers, the states. It renders **no verdict, no findings, no summary and no diff**, and its AC-13
> makes that a checked property. This is the half that was split off, and the split was on measured
> blockers rather than on size.
>
> **(a) The verdict and its findings.** `steps.ts` writes `{verdict, findings, summary}` as JSON to
> `.harness/run-{run}/{stepId}-verdict-iter-{iter}.json` inside the ticket folder.
> `listTicketFiles` excludes every dot-segment path and `GET /tickets/:id/file` re-derives membership
> per request, so `.harness/` is unreadable as well as unnamed. **Q-0127's erratum E-1 ruled that
> exclusion and ruled that no decision entry was owed *for excluding it* precisely because the
> opposite answer would owe one** — serving engine run state from a backlog route makes `.harness/`
> part of what the backlog surface means. So a route over that artifact is a decision entry before a
> line of code.
>
> The three alternatives, each measured at Q-0016's gate:
> *(i) verbatim prose from the stream.* The findings cross the wire as a `warn` message,
> `` `${stepId}: ${verdict} — ${findings.join(' | ')}` ``, and `warnEventSchema` is `.strict()` over
> `{type, message}` with **no `stepId`** — so attributing it to a step means parsing a sentence. The
> `done` event does carry `stepId` and its `message` is free text opening `verdict=`.
> *(ii) widen the event union* so a verdict crosses structurally, which is *"The event union is
> derived from what the product emits"* (2026-08-25) and a `packages/shared` change.
> *(iii) read it from run history.* **Struck at Q-0016's gate and not to be reconsidered without new
> evidence:** `host.ts` sets `record.runId` only when the terminal event arrives, and history is keyed
> `<TICKET>-<n>`, so a run parked at a gate has `runId: null` and its history id cannot be composed.
> Matching the newest `GET /history` row for the ticket is inference, not identity.
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
> **What it must not do.** It may not widen the gate answer set — a decision entry of its own, and
> `gateAnswerEnvelopeSchema` refuses a fourth today. It may not show a verdict where none exists:
> measured at Q-0016's gate, **147 of 219 engine-recorded gate answers were at author-declared gates
> that carry no verdict at all**, so the screen it extends must stay correct for the two-thirds case,
> and `docs/04-architecture.md:317` forbids a placeholder showing a value nobody measured. And it may
> not make `retry` the primary action, `05-design-prompt.md` screen 6 notwithstanding: at an
> author-declared gate `retry` aborts the run (`routing.ts:78–96`).
>
> **Start by re-measuring.** Do not re-derive the counts above from this body — they were true on
> 2026-09-16, and this repository's own record is that a measurement copied from a document is not a
> measurement, and that a correction travels one document further by being copied (Q-0099).

---

## 8. Open questions

Non-blocking. The blocking ones are §6's GO-1, GO-2 and GO-3.

**OQ-1 — does `pendingGates` survive beside `gates`?** It is redundant once the array crosses.
**Recommendation: keep it.** It is a shipped field with a schema, a listing of many runs wants a count
rather than N arrays, and removing it is a breaking change to a `.strict()` shape for no measured
gain. AC-2 makes the two structurally unable to disagree, which is what makes the redundancy safe
rather than a second authority.

**OQ-2 — does `/runs/:handle/gate` survive as a route?** It is a URL for a transient state: the gate
it names is gone once answered, so a bookmark is a bookmark to a decision somebody already took.
**Recommendation: keep it.** The register already holds it, the four M4 paths are declared there for
the same reason, and AC-10 gives every not-parked state a sentence — which is what makes a stale
bookmark harmless rather than confusing. Folding it into `/runs/:handle` couples this screen's
delivery to Q-0015's.

**OQ-3 — what the screen says about the ticket.** The question carries `ticketDir`, an **absolute path
on the daemon's machine**. Rendering it is honest and is what the wire gives; `WireRun.ticketId` is
beside it and is what `/backlog/:ticketId` takes, so a link to the ticket page is available. Whether
the screen links there, and whether an absolute server path belongs in a browser at all, is a
rendering question this document does not rule.

**OQ-4 — the route through the flows.** Taken at the gate. Q-0120 walked the full seven-stage route
and is the only M3 ticket to have done so, at $198.54; Q-0017 and Q-0127 went `requirements` →
`chore` at $123.34 and $108.67. M2's closing measurement — the feature flows have four tickets of
evidence between them, all from August — is the argument for the full route. Against: fourteen
criteria over three packages with one genuinely behavioural criterion (AC-8) is chore-shaped, and
`solutioning` would be asked to emit contracts for a React screen whose only new shape is one field
on an existing schema.

---

## 9. Risks

**R-1 — AC-8 is the criterion most likely to be weakened by a reviewer who has not read M-2.** An
unconditional third control is the obvious implementation and is what `05-design-prompt.md`
describes. The mitigation is inside the criterion: it must be shown **red** by making the control
unconditional, with a message naming the abort, so the danger lives in failure output rather than only
in this document.

**R-2 — the guard re-aim (AC-5) is where this ticket is likeliest to ship a hole.** Q-0014's round 2
found a guard narrowed to *"shipping files"* such that every file carrying the defect was outside the
scan forbidding it; Q-0111's first needle matched nothing including its own subject. AC-5 therefore
requires the **exemption itself** be shown load-bearing, not merely that the guard still passes.

**R-3 — a flow could later set `retryTarget` on an author-declared gate**, at which point M-3's zero
stops being structural. AC-8 keys on the **question's** `retry` field rather than on `kind` or on a
count, so it stays correct if that happens. Stated because a reader checking only the measurement
would conclude otherwise.

**R-4 — version skew between a packed daemon and a packed bundle.** `wireRunSchema` is `.strict()`, so
a browser running the old schema against a new body rejects it. Both ship in the same five-tarball set
(*"The distribution set is five, and rejoins the emitting set"*, 2026-09-15), so there is no supported
arrangement in which they differ. Registered rather than mitigated.

**R-5 — this ticket's own review may be truncated.** Four consecutive tickets before Q-0127 were
reviewed against a diff cut at `repo.max_diff_bytes` (200,000); Q-0127 peaked at 191,552 B with zero
truncation. This change is comparable to Q-0127's — one field, one projection, one module, one guard
re-aim, one screen, two documents — so truncation is plausible rather than unlikely. Q-0124's `warn`
now names any file it gave no patch for; **if it fires, a hand cross-vendor pass over the named files
is owed before the gate.** Predicted and to be measured, not assumed.

**R-6 — the screen has no way in until Q-0015.** Reached by typing a URL. §5(6), and the same trade
Q-0121 recorded: shipping a capability before the screen that reaches it, rather than bundling them
and growing the ticket that way.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a as a code path — no adapter, no `check()`. **Not n/a as a word**: no criterion, test name, rendered string or document sentence may use *API key*, *token* or *credential*; the word is **subscription**. |
| **Worktree safety** | n/a. Nothing here writes to a working tree, creates a branch or touches a worktree. The one mutation settles a promise `core` is already parked on. |
| **Gate behaviour** | The subject. Human-gated by default is unchanged; `auto` is opt-in per gate and the host never widens it; `human-locked` stays unbypassable — nothing in `apps/web` reaches `askGate`'s policy, and the three answers are `@quorum/shared`'s enum. **The screen may offer fewer answers than three and never more** (AC-8). |
| **File format and schema** | One additive field on `WireRun`, with its schema, in `@quorum/shared` — the one place a wire shape is declared and the only one executable in a browser. No file on disk changes format; no ticket, flow, role or manifest schema is touched. |
| **Lint rules** | No flow changes, so `quorum lint` has no new subject. `@typescript-eslint/no-deprecated` already covers `apps/**/*.ts`. `turbo-inputs.test.ts` earns a registration only if a new out-of-package read appears; none is planned, and if one does it is that guard working as designed. |
| **Cold-clone impact** | **Positive, and the reason to build it.** The thirty-minute path reaches a gate and today requires the terminal that started the run. No new dependency, so the install does not move; `quorum open` already serves the bundle. |
| **Product-agnostic** | Nothing here knows about any SaaS product. |
| **Files are the database** | Unchanged: the daemon holds no new state. `RunView.gates` is derived per call from the registry `askGate` parks on, and both wire fields are computed per request. Nothing is cached; nothing is persisted in the browser. |
| **Errors are explicit** | AC-10 and AC-12. Every state names itself; no state is silence, a spinner or a skeleton; a refusal carries the daemon's own `code`, `condition` and `remedy`; and a gate that is no longer waiting is reported as that rather than as a failure or a success. |
| **Vocabulary** | **gate**, **flow**, **step**, **ticket**, **stage**, **run lock**, **connection state** used as `docs/GLOSSARY.md` defines them. **No term is coined and none is owed** — this screen introduces no noun — so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). Forbidden here specifically: a gate is not an *approval*, a *checkpoint* or a *review step*; an answer is not an *override*. |

---

## 11. Provenance

**From candidate-claude, and decisive.** M-1, that `RunView.gates` already holds the questions and
`wireRunOf` drops them to a count — verified at `host.ts:118`, `:264` and `wire.ts`, and it is what
makes the screen half cheap and removes three of the ticket's four OQ-1 options from it. M-2, that
`retry` at a gate with no `retryTarget` returns `{ abort: true }` — verified at `routing.ts:78–96`,
and it is AC-8, the criterion this document exists to get right. M-3's census. M-4, that `kind` cannot
discriminate an engine-presented gate from a deploy gate. M-5, that `warnEventSchema` carries no
`stepId`. M-6, which strikes the run-history option rather than weighing it. M-7, `auto` and `dry`.
The split with the successor's body written out in full, and the gate-obligation structure.

**From candidate-codex, and taken over candidate-claude on four points.** One answer in flight at a
time, with the controls inert while it is (AC-11) — candidate-claude has no such criterion and a
double submission is the ordinary way a maintainer meets M-9. The `no-such-gate` wording and, more
importantly, its stated reason: the response cannot distinguish a landed answer from any other
disappearance, so the screen must claim **neither** success nor failure (AC-12) — candidate-claude
renders "the gate is no longer waiting" and re-reads, which is right, but argues from the lost-response
case alone and so under-states why the wording must be neutral. The clause that the screen does not
claim the next step succeeded, the ticket advanced or the run ended until a read establishes it
(AC-11). And the enumeration of the not-parked states, which is more complete than candidate-claude's
(AC-10). Its non-goals list and its risk framing also contributed.

**Refused, with reasons.** Candidate-codex's twenty-four criteria: two of them (its AC-23 and AC-24)
are cross-cutting checklists rather than independently testable criteria and are moved to §10, and its
AC-6 and AC-18 describe states that exist **only** under its replay-based design, which §3.1 rules
against — widening the wire removes them rather than mitigating them. Candidate-claude's AC-8, which
offers two controls and no explanation where a gate carries no `retry`: merged with candidate-codex's
AC-9 into the property that an answer the gate does not offer must be **explained** rather than simply
missing, with the presentation left unruled and the third option — two controls and no explanation —
named as what may not ship.

**Corrections to both, measured rather than argued.** The census is **219** engine-recorded gate
answers, not the 220 candidate-claude reports: a 220th line matches the same grep and carries an empty
answer (`gate=erratum answer=`), which no `askGate` call can produce, `askGate` writing one of exactly
three words. The split, 147 author-declared to 72 engine-presented, is unchanged. And the placeholder
rule the ticket body cites as `docs/04-architecture.md:200` is at **`:317`**; candidate-claude quotes
both line numbers in different places and `:317` is the one that says it.

**From the ticket body, verified and kept.** (a), (b), (e), (f) and (g) each re-run and recorded
without correction. Its (d) is refuted by M-1 and its OQ-5 by M-2 — both corrections were
candidate-claude's and both survive re-derivation.
