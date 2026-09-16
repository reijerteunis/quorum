# Q-0016 — The gate screen shows a step's verdict and takes the answer

*Merged requirement, run 1, **iteration 2**. The tree has not moved since iteration 1: `git log`'s
tip is `2bb20e3`, the commit that opened this ticket; `requirements/errata.md` does not exist; the
ticket body is untouched. So this pass does what the three recorded instances of that situation say
to do — re-run every measurement a criterion rests on rather than re-state it (Q-0090, Q-0096,
Q-0105). **Three decisive findings survive verbatim and seven measurements did not**, two of them in
the ticket body and two in iteration 1's own document. §12 says what changed and why the verdict
moved.*

---

## 0. What was measured, and what it refutes

Every number below was taken from the tree on 2026-09-16 by the command named beside it. None is
transcribed from the ticket body, from either candidate, from iteration 1's merged document, from
`docs/05-design-prompt.md` or from a sibling ticket's entry.

### M-1 (decisive, re-verified) — the daemon already holds the question, and the wire drops it to a count

`packages/server/src/host.ts:118` declares `RunView.gates` as `readonly GateQuestionEvent[]` — the
**questions themselves** — and `viewOf` fills it at `:264` from `gates.pending(record.handle)`, the
registry accessor declared at `gates.ts:57` and implemented at `:89` as
`[...(runs.get(handle)?.values() ?? [])].map((gate) => gate.question)`. `wireRunOf`
(`packages/server/src/wire.ts:109–117`) then projects it:

```ts
export function wireRunOf(view: RunView): WireRun {
  return { handle, flow, ticketId, runId, state, pendingGates: view.gates.length };
}
```

So `gateId`, `kind`, `reason`, `ticketDir` and `retry` are in the daemon's memory, derived per call,
on every one of `POST /runs`, `GET /runs` and `GET /runs/:id`, and are deliberately not sent.
`viewOf` builds `gates` for **every** record including a `refused` one, so the field is derived
rather than captured at any particular moment.

**This refutes the ticket body's (d)**, which concludes *"the replay is the only channel carrying the
question itself"*. It is the only channel carrying it **today**; it is not the only channel that can.
The consequence is the whole shape of this ticket: the screen half needs **no new route, no
event-union change, no `.harness/` exposure and no new dependency** — one additive field on a shape
that already crosses the wire. Every expensive option the ticket's OQ-1 lists is a cost the
*evidence* half pays.

The body's mechanism claim in (d) is otherwise correct and is now a second source rather than the
only one: `createBroadcast` evicts from the head, so a parked run's question is the newest retained
event.

### M-2 (decisive, re-verified verbatim, and the safety criterion) — `retry` at an author-declared gate aborts the run

`packages/core/src/engine/routing.ts:79–96`:

```ts
const retry = typeof step.retryTarget === 'string' ? step.retryTarget : undefined;
const request: GateQuestionEvent = { type: 'gate', gateId: context.nextGateId(), kind: String(step.gate), … };
const answer = await askGate(request, context);
if (answer === 'advance') return null;
if (answer === 'retry' && retry !== undefined) { … return { goto: retry, counter, limit }; }
return { abort: true };
```

`retry` with no `retryTarget` falls through to `{ abort: true }`. `handleFail` (`:138–142`) always
sets `retry: target`, so the engine-presented gate is unaffected.

**This refutes the ticket body's OQ-5**, which reasons that offering the third answer where the
question carries none *"would be a control that does nothing"*. It does the most destructive of the
three things available: it ends the run. **AC-8.**

### M-3 (re-verified, with iteration 1's evidence corrected) — the modal gate carries no verdict, and at none of them was `retry` ever possible

`askGate` writes the answer line at **exactly one site**, `routing.ts:48`:
`appendLog(ticket, \`run=${runId} gate=${request.kind} answer=${parsed.data.answer}\`)`, reached only
after `gateAnswerEnvelopeSchema` has parsed, so the word is one of exactly three. That makes
`backlog/*/runs.log` the census. Over all 108 ticket folders:

| kind | advance | retry | abort | total |
| --- | --- | --- | --- | --- |
| `human` (author-declared) | 144 | **0** | 3 | **147** |
| `human-locked` (engine-presented) | 30 | 34 | 8 | **72** |
| | | | | **219** |

**The denominator has to be derived carefully and iteration 1 got its evidence wrong.** A naive
`grep -c 'gate='` returns **254**, which decomposes exactly: 219 answers, **34** retry-grant lines
(`gate=retry counter=<c> set=<n>`, a different sentence written at `routing.ts:97` and `:160`, and
matching the 34 `answer=retry` lines one-for-one), and **1** hand-written note. Iteration 1 reported
that note as *"carrying an empty answer (`gate=erratum answer=`)"*. It is not empty. It reads
`run=2 gate=erratum answer=E-1 (out-of-band: …)` in `Q-0107/runs.log:19`, and "empty" was an artifact
of the lowercase `answer=[a-z]*` regex that measured it. **The conclusion is unchanged and correct**
— no `askGate` call site can produce it, so it is not an engine answer — and the evidence offered for
it was false. Recorded rather than silently fixed, because a correction that travels one document
further by being copied is this repository's own most-recorded failure (Q-0099).

The zero is structural rather than a sample artefact. `grep -rn retryTarget packages/ apps/ harness/`
returns **one production read** (`routing.ts:79`) and **one fixture** (`engine.test.ts:72`). All six
shipped flows — `requirements`, `solutioning`, `qa-red`, `development`, `review`, `chore` — end in a
bare `- gate: human` with a static `reason:`. **No shipped flow sets `retryTarget` on any gate step**,
so at 147 of 219 real gates an unconditional `retry` control would have ended the run.

`docs/05-design-prompt.md` screen 6 says the screen is reached *"when a judge or integrate step
finishes"* and makes *"Send back to development (round 2/3)"* the **primary** action. That describes
the 33% case and makes the destructive answer primary on the 67% case. **AC-14** records the
divergence on the precedent Q-0017 set for that same document.

### M-4 (re-verified) — `kind` cannot distinguish an engine-presented gate from a deploy gate

`handleFail` composes `kind: 'human-locked'` (`routing.ts:139`); an author-declared gate composes
`kind: String(step.gate)`. `gateQuestionEventSchema.kind` is `z.string()` — open, and its own JSDoc
says so. An author-declared `human-locked` deploy gate, which `docs/GLOSSARY.md` requires be
unflippable and which Q-0012 will ship, will carry the same word as every exhaustion gate. The only
structural discriminator is the presence of `retry`. **AC-9.**

### M-5 (corrected) — findings cross the wire as prose, unattributably, and the shape is conditional

`warnEventSchema` (`packages/shared/src/events.ts`) is `.strict()` over `{ type, message }` — **no
`stepId`**. `stepDoneEventSchema` is `.strict()` over `{ type, stepId, message }`.

**Both messages are conditionally composed, which neither candidate nor iteration 1 recorded.**
`steps.ts:364`:

```ts
message: `${stepId}: ${String(output.verdict)}${output.findings?.length ? ' — ' + output.findings.join(' | ') : ''}`
```

So a `revise` carrying **no** findings emits `<step>: revise` with no em-dash and no list at all —
the separator a parser would key on is absent exactly when the list is. And `:353`'s `done` message
is `` `${output.verdict ? 'verdict=' + output.verdict + ' ' : ''}${formatCost(usage)} ${ms}ms` ``, so
a step with no declared verdict emits a `done` that does not open `verdict=`. Iteration 1 stated both
formats unconditionally.

This is why the evidence half is a decision rather than a rendering choice, and it is Q-0129's: the
findings are unattributable structurally **and** their sentence changes shape with their own content.

### M-6 (re-verified, and independently confirmed in the architecture document) — a run parked at a gate has no run-history id

`host.ts:294–306` sets `record.runId` only when `event.type === 'terminal'`, under a comment reading
*"The terminal event is the only event carrying run identity… Nothing here reads an event's `message`
text or takes a run number out of a `gateId`: two authorities for one run's identity is what `minted`
exists to prevent."* `docs/04-architecture.md:200` says the same thing in prose. History is keyed
`<TICKET>-<n>` (`read.ts:390`). So a parked run has `runId: null` and its history id cannot be
composed. **The ticket's OQ-1 candidate (iv) — read the verdict word from `GET /history/:id` — is
unreachable for the live case** and is struck rather than weighed.

### M-7 (corrected) — the `gateId` format is real, which is what makes parsing it tempting and wrong

`engine.ts:329`: `nextGateId: () => \`${runId}:${(gateSequence += 1)}\``. So a `gateId` does contain
`core`'s run number. And `gateQuestionEventSchema` calls it *"Opaque correlation id, unique among the
gates asked by one run"*, while `host.ts`'s comment above names taking a run number out of a `gateId`
as precisely the second authority it refuses. **The browser is under the same rule and it is not
self-evident**: the token must be echoed into the answer envelope unaltered and never parsed, split
or rendered as a run number. Iteration 1 asserted the format in passing and drew no rule from it.
**AC-7.**

### M-8 (corrected) — the engine-presented gate has TWO reason sentences, not one

`handleFail` composes one of two, on `const exhausted = limit > 0` (`routing.ts:130–142`): the
exhaustion sentence *"loop exhausted at `<step>` (`<counter>` = N, limit L); choose: advance (accept
as is), retry (exactly one more `<target>`), abort"*, and Q-0083's bound-zero sentence *"`<step>`
stopped rather than looping (…); choose: advance (accept its answer and carry on), retry (exactly one
more `<target>`, for once you have changed what it reads), abort"*. Both spell the three answers, so
a screen rendering either verbatim beside controls shows the choices twice — a rendering constraint,
not a defect. **AC-7's test therefore covers three real reason shapes**, not the two iteration 1
named: a flow file's static `reason:`, the exhaustion sentence, and the bound-zero sentence.

### M-9 (re-verified and widened) — "exactly one answer wins", and three different things produce `no-such-gate`

`gates.ts:93–111` returns one of `not-an-answer`, `not-this-run`, `no-such-gate` or `null`, and
**deletes before it settles**, its own comment saying the delete and the settle are one step with no
await between them. `release(handle)` (`:119`) forgets a run's gates wholesale when it ends.

So `no-such-gate` is what a client is told when **(i)** its own POST succeeded and the response was
lost, **(ii)** the gate was answered at the CLI or in another tab, or **(iii)** the run was stopped
or ended while the screen was open and `release` forgot its gates. The response cannot tell the three
apart. Iteration 1 argued from (i) and (ii); (iii) is new and makes the case for neutral wording
stronger rather than weaker. **AC-12.**

### M-10 (new, and a trap) — the success answer is `204` with no body, and two refusals share a status

`http.ts:212–225`: the envelope is deliberately **not** validated in the route — `gates.ts` owns that
vocabulary — and on success the route answers `return c.body(null, 204)`. Refusals map through
`ANSWER_REFUSAL_STATUS` (`wire.ts:73–79`): `no-such-run` **404**, `no-such-gate` **404**,
`not-this-run` **409**, `not-an-answer` **400**, plus a `malformed-json` **400** composed in the route
itself.

Two consequences no earlier account has:

1. **The success path carries no body.** `apps/web/src/daemon-client.ts:48` declares
   `FetchLike = (path: string) => Promise<DaemonResponse>` and `DaemonResponse` exposes exactly
   `ok`, `status` and `json()`. Every existing read goes through a helper that parses a body and
   distinguishes *"the body was not JSON"* as a failure — so an answer routed through that helper
   reports a **successful** gate answer as a parse failure. A 204 must be recognised from its status
   before any body is read.
2. **Two distinct refusals are both 404.** A client branching on HTTP status alone cannot tell *"no
   run under that handle"* from *"no gate waiting under that id"* — which are AC-10's and AC-12's
   states respectively, and they say opposite things to a reader. The discriminator is the refusal
   `code` in the body, not the status.

**AC-4.**

### M-11 (re-verified) — the app's read boundary, and the guard that holds it

`apps/web/test/source.test.ts:184–201` is Q-0017's AC-5/AC-10/AC-11/AC-13 guard: over every file
`sourceFiles()` returns, it forbids four method literals (assembled as `` `method:${' '}'POST'` `` so
the file is not its own subject) and the two quoted route strings `'/gate'` and `'/stop'`, with
discriminator assertions beneath proving each needle selects. Beside it, `:207+` forbids
`setInterval`, `setTimeout` and `requestIdleCallback`; the block at the top forbids five persistence
APIs; a later one forbids absolute URLs.

**The guard's own comment is part of its subject.** It reads *"Nothing this ticket adds writes: no run
is started, no gate answered, no stage moved, no run lock taken"* — a sentence this ticket makes false
in one of its four clauses while the other three stay true. A re-aim that moves the code and leaves
the comment ships a comment claiming what the code no longer does, which is the class Q-0067 and
Q-0068 each closed. **AC-5.**

`apps/web/src/daemon-endpoints.ts` exports `DAEMON_ENDPOINTS`, `runEventsPath`, `ticketDetailPath`,
`ticketFilePath` and `runEventsUrl`, and **no gate path**. `apps/web/src/routes.ts:187–190` carries
`/runs/:handle/gate`, `screen: 'Gate screen'`, `ticket: 'Q-0016'`, `screenExists: false`; its own
comment at `:146–150` records Q-0017's AC-14 as the precedent for re-aiming a row while keeping its
sentence, *"because `screenExists` is what says the screen is built, and a row whose sentence had
been emptied would make a later `false` silent"*.

### M-12 (re-verified) — fourteen registered routes, and the widening is structurally checked

`grep -rnE 'app\.(get|post|put|patch|delete|use)\('` over `packages/server/src` outside tests returns
**14**: five in `http.ts`, seven in `read.ts`, the WebSocket in `serve.ts`, the static fallback in
`static.ts`. The ticket body's (g) is right.

`packages/shared/src/wire.ts:125–132` declares `wireRunSchema: z.ZodType<WireRun>` — an **annotation**,
not an inference — `.strict()` over `handle`, `flow`, `ticketId`, `runId`, `state`, `pendingGates`,
the last `z.number().int().nonnegative()`. The annotation is what makes AC-1 cheap to get right: a
field added to the schema and not to the interface fails to compile at that line rather than at a
consumer.

### M-13 (corrected — the ticket body's own count) — the verdict artifacts, re-derived

The body reports *"**197 of them across 34 tickets**"*. Measured today,
`find backlog -path '*/.harness/*' -name '*verdict*.json'` returns **274 files across 71 ticket
folders**. This run's own iteration-1 verdict accounts for one file and one folder; the rest is the
body's figure being wrong when it was written, in both halves and in the same direction. It changes
no criterion — the artifact is Q-0129's — and it is corrected in §7 so the successor does not inherit
it, which is the third consecutive requirements run to refute a body that was measured *"against the
tree today"* (Q-0121, Q-0125, Q-0127).

Two further facts §7 needs and no earlier account has: the exclusion rule is
`isHiddenPath` (`backlog.ts:329–334`), keyed on **a leading dot in the first segment and not on the
name `.harness`**, so a second hidden directory is covered without anyone remembering; and the
artifact path is `String(declared.verdict_file ?? '<TICKET_ARTIFACT_DIR>/run-{run}/…')`
(`steps.ts:339`), a **default a flow author may override**, so no route may hard-code it.

### M-14 (re-verified) — the citation the ticket body gets wrong

Ground rule 2 cites `docs/04-architecture.md:200` for the placeholder rule. That line is about run
identity (M-6). The rule is at **`:317`** — *"No placeholder is a blank panel, a spinner or a
skeleton, and none shows a fabricated project, run, ticket or cost"*. Both were read this pass.

### M-15 (re-verified) — the payload is small, so no cap is specified anywhere

A gate question is `gateId`, `kind` (one word), `reason` (longest measured form is the bound-zero
sentence, ~240 bytes), `ticketDir` (an absolute path) and optional `retry` (a step id) — under 500
bytes, and at most one per parked run in every shipped flow, `runStep`'s `parallel:` branch
dispatching `runAgentStep` only. **No cap appears anywhere in this document**, and that is Q-0127's
lesson rather than an omission: nothing large is fetched, so there is nothing to disclose.

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
always — is actively dangerous: on 147 of 219 real gates the `retry` control ends the run. And the
document every screen ticket is built from describes the other 72 and makes that control primary.

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

## 3. Scope, and the three things ruled inside it

### 3.1 Ruled: the ticket is the answerable screen; the evidence is Q-0129

**This ticket — the answer, over channels that exist plus one additive field.** The pending question
read from `GET /runs/:id` and rendered; exactly the answers that gate can take, posted to the shipped
`POST /runs/:id/gate`; every not-parked state named; the app's first write, and the read-only
boundary re-aimed. **It renders no verdict, no findings and no diff**, and AC-13 makes that a checked
property rather than an omission a later reader mistakes for a gap.

**Q-0129 — the evidence.** The verdict card with its findings and summary, and the diff. §7 writes its
body out in full, on the lesson that an obligation left in a closing entry expires.

**The seam is measured rather than chosen, and what makes it real is that the two halves have
disjoint blockers.** This half needs no decision entry, no new route, no new dependency and no
`.harness/` ruling. The other needs at least one decision entry by Q-0127 erratum E-1's own words
and, for the diff, a range the wire does not carry and a dependency this workspace does not have.
Precedent: Q-0013 refused at eighteen criteria and cut in three; Q-0014 cut in two; **Q-0017 cut in
two at exactly this seam** — a screen over endpoints that exist against a screen needing a route
built for it — its requirements run returning `ready` while its gate performed the split.

**The gate may still refuse it** (Q-0122 refused the split its own document recommended). **GO-1**
names the remedy in advance: the verdict-card and diff criteria are written **at the gate** by
erratum, the ticket's OQ-1 and OQ-2 ruled there, and the size accepted explicitly — not added by a
later implement round.

### 3.2 Ruled: the question comes from the wire, not from the replay

The two candidates disagree on the channel and the disagreement is the design.

Candidate-codex reads the pending question from the replayed event stream and needs no wire change.
Candidate-claude widens `WireRun` and reads it from `GET /runs/:id`.

**The wire wins, and codex's own AC-18 is the reason.** That criterion concedes a state in which
`GET /runs/:handle` reports a gate is waiting, replay has not supplied the question, and the screen
*"renders no answer controls because it has no `gateId` to correlate safely"* — the screen cannot do
its one job. Its AC-6 concedes a second: an incomplete replay, which the screen must disclose and
cannot repair. Both states exist only because the design reads a **buffer** where the **authority**
already holds the value and derives it per request (M-1). Widening the wire does not mitigate those
states; it removes them.

Two further measured reasons. `run-connection.ts`'s snapshot is mission control's subject, and a
second consumer of that controller before Q-0015 has decided how it is held is a coupling neither
ticket has designed. And the widening is one additive field plus one line in the single projection
Q-0121 deliberately made all three run routes share — with `wireRunSchema`'s `z.ZodType<WireRun>`
annotation checking the interface and the schema against each other at the line (M-12).

**This is ruled here rather than asked of the gate.** Picking when candidates disagree, and saying
why, is what this step is for; and on an unchanged tree, asking again is the pattern rather than the
remedy for it (Q-0105). **GO-2** stands as a ratification, and §6 states what moves if it is
overturned.

### 3.3 Ruled: the screen holds no socket, and the consequence is named

It reads on mount and when the reader asks again — the board's rule (`04-architecture.md`
§`apps/web`) rather than a new one — and after answering it re-reads rather than watching the stream.

**The consequence, stated rather than smoothed over:** a gate that arrives while the screen is open is
not shown until the reader asks again, and what the run does next is shown by re-reading rather than
live. That is a real limitation. It is accepted because the alternative couples this ticket to
`run-connection.ts` and adds the two states §3.2 just removed, and because rendering a run's event
stream is mission control's subject. **GO-4**, non-blocking: the screen works either way and §6 names
the two criteria that move if it is overturned.

---

## 4. Acceptance criteria

Fourteen, against this role's ceiling of fifteen. Surfaces named per criterion. Iteration 2 added no
criterion: every new measurement folded into the criterion whose subject it already was.

---

**AC-1 — `@quorum/shared`: one run's wire shape carries the questions its gates are asking.**
`WireRun` gains `gates`, the pending gate questions **whole** — `gateQuestionEventSchema`'s own shape,
reused and not redeclared — beside the existing `pendingGates`. The field may take the name `gates`
precisely because it is **not** a narrowing: Q-0121 GO-3's rule is that a wire field narrowing a
`RunView` field may not keep that field's name, and this carries `RunView.gates` unchanged.
`wireRunSchema` stays `.strict()` and keeps its `z.ZodType<WireRun>` annotation.
*Test:* `wireRunSchema` parses a run carrying one question and rejects the same body with an unknown
key; a `WireRun` built from a `RunView` with two pending questions carries both, in order; a source
assertion that the element schema is `@quorum/shared`'s own gate-question schema rather than a second
declaration of those six fields; and the annotation shown load-bearing — a schema field with no
interface field fails at `wire.ts` rather than at a consumer.

**AC-2 — `packages/server`: the projection carries them, derived per request, and `pendingGates`
stays `gates.length`.**
`wireRunOf` is still the **one** projection all three run routes go through (Q-0121 AC-8); it gains
one line. The two fields cannot disagree, because one is computed from the other.
*Test:* `GET /runs/:id` for a run parked at a gate answers the question with its `gateId`, `kind`,
`reason`, `ticketDir` and — where the gate offers one — `retry`; answering that gate and re-fetching
answers `gates: []` and `pendingGates: 0` **without the process being restarted**, which is what
proves it is derived rather than captured; and `pendingGates === gates.length` over runs with zero,
one and two pending gates, including a `refused` run, whose `viewOf` builds the field too.

**AC-3 — `packages/server`: no route is added, and the gate answer route is unchanged.**
The transport stays at its measured **fourteen** registered routes (M-12). `POST /runs/:id/gate`, its
`204`-on-success body, its four refusal codes and their statuses are untouched — including that
`http.ts` does **not** validate the envelope, `gates.ts` owning that vocabulary, so no second copy of
`advance|retry|abort` appears on the transport.
*Test:* the package's own route-deriving guard reports the same set before and after; and the answer
route's existing suite passes unmodified.

**AC-4 — `apps/web`: the app can issue exactly one request that is not a GET, in the one module where
every request is made, and it reads the answer the daemon actually gives.**
`FetchLike` widens to carry a method and a body. `daemon-client.ts` gains one function that answers a
gate. Two properties are structural rather than stylistic, both measured at M-10: **success is `204`
with no body**, so it is recognised from its status before anything parses a body — a success routed
through the existing body-parsing helper would be reported as *"the body was not JSON"*; and
**`no-such-run` and `no-such-gate` are both `404`**, so the outcome is told apart by the refusal
`code` in the body and never by the status alone. A non-2xx whose body is a `WireRefusal` is carried
through unaltered.
*Test:* a `204` reports accepted **and is asserted not to have read a body**; `no-such-gate`,
`not-this-run`, `not-an-answer`, `no-such-run` and `malformed-json` each reach the caller
distinguishably, with the two 404s shown to be distinguished; a fetcher that throws reports
unreachable; a 2xx body that is not the shape it claims is reported as such rather than as a success;
and no second module in the package constructs a request.

**AC-5 — `apps/web`: the package's source boundaries after this ticket — one re-aimed, three unmoved,
and the re-aimed one's comment moves with it.**
`source.test.ts`'s Q-0017 AC-5/AC-10/AC-11/AC-13 write guard keeps its subject over every file under
`apps/web/src` **except** the one module AC-4 names, which is exempted **by name**; `'/stop'` stays
forbidden everywhere, this ticket starting and stopping nothing. Its comment — *"no run is started,
no gate answered, no stage moved, no run lock taken"* — is corrected to the three clauses that are
still true, because a guard whose comment claims what it no longer forbids is the shape Q-0067 and
Q-0068 each closed. The persistence, timer and absolute-URL guards keep their subject.
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

**AC-7 — `apps/web`: the screen renders the question it was asked, and nothing it composed or parsed.**
Kind as the word the engine sent, reason **verbatim**, the ticket folder, and — where the question
carries one — the step a `retry` returns to. The reason is not rewritten, summarised or truncated, and
no machine value is parsed out of it. **The `gateId` is opaque**: echoed into the answer envelope
unaltered, never split, parsed or rendered as a run number, because its format *is* `<runId>:<n>`
(M-7) and `host.ts`'s own comment names deriving run identity from it as the second authority it
exists to prevent.
*Test:* **three** real reason shapes render in full — a flow file's static `reason:`, the exhaustion
sentence, and Q-0083's bound-zero sentence, the last two both already spelling the three answers
(M-8); no string the engine did not send appears as part of the question; and a source assertion that
the module performs no split, slice, regex or index on `gateId`.

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
*Test:* a question with no `retry` emits no `retry` envelope under any interaction **and** renders the
explanatory sentence; a question carrying `retry` offers it and names the step; a source assertion
that the answer vocabulary is imported from `@quorum/shared` rather than written here; and **the
criterion is shown red** by making the third control unconditional, failing with a message naming the
abort.

**AC-9 — `apps/web`: no gate is labelled from `kind` alone.**
`kind` renders as the word the engine sent. The screen does not call a gate an exhaustion gate, a
deploy gate or a review gate, because `handleFail` composes `kind: 'human-locked'`, an
author-declared deploy gate will carry the same word, and the field is `z.string()` and open (M-4).
*Test:* two questions differing only in `retry`, both `human-locked`, render the same label; and a
scan refuses the coined nouns in this package's source.

**AC-10 — `apps/web`: every state that is not *parked at a gate* says which one it is, and none is
silence.**
At least: parked (the subject); the run exists and is parked at no gate; the run has `ended`; the
start was `refused`, reporting the daemon's own condition; the handle was never minted, which is the
route's `no-such-run` 404; the daemon is unreachable; the body did not parse. A run started with
`auto` reaches the second of those and is correct there — `askGate` returns `advance` without emitting
for `kind === 'auto'`, for `context.auto` where the kind is not `human-locked`, and for `context.dry`
(M-7's sibling at `routing.ts:14–21`). No state is a blank panel, a spinner or a skeleton
(`docs/04-architecture.md:317`), and none claims a gate that is not there or renders answer controls.
*Test:* one case per state, each asserting a sentence a reader can act on; the `no-such-run` case
asserted to be told apart from `no-such-gate` despite the shared status (M-10); and a scan of the
module's rendered strings against the enumerated set, so a later state cannot be added silently.

**AC-11 — `apps/web`: one answer in flight, and nothing claimed that was not observed.**
While an answer request is in flight every answer control is inert, so one screen instance can have at
most one answer request outstanding for a gate. On a `204` the screen says which answer it sent,
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
the earlier answer landed **nor** that it failed, because the response cannot tell apart a lost 204,
an answer given at the CLI, and a run stopped or ended whose gates `release` forgot (M-9).
`not-this-run`, `not-an-answer`, `no-such-run` and `malformed-json` each render their own sentence,
carrying the daemon's `code`, `condition` and `remedy` where it supplies them. No failure is silently
retried.
*Test:* the lost-response path — answer once, answer again with the same envelope — renders the
not-waiting sentence and never a failure or an optimistic success; the stop-while-parked path reaches
the same sentence; and the other four refusals render distinguishably.

**AC-13 — `apps/web`: no verdict, no findings, no summary, no diff, and no region where one would go.**
The screen renders no verdict card, no findings list, no summary, no diff and no file list, and shows
no dash, skeleton or empty region standing in for absent evidence. It parses no verdict, finding,
count, cost or duration out of any `warn` or `done` message. Ground rule 2, as a checked property.
*Test:* a scan of the module refusing the words a fabricated evidence region would need; an assertion
that the rendered output over a parked run contains no region whose only content is a placeholder for
absent evidence; and a source assertion that the module reads no event `message` field at all.

**AC-14 — the route register and the documents say what shipped.**
`/runs/:handle/gate` flips `screenExists: true` and its `waitingFor` sentence is replaced by one
describing what the screen does, naming **Q-0129** as what the evidence half waits for; the row keeps
its path and keeps a sentence, on the precedent its own file records at `routes.ts:146–150`.
`docs/04-architecture.md` §`apps/web` describes the screen and the one write this app now makes, and
§`packages/server` records that `WireRun` carries the questions rather than only their count.
`docs/05-design-prompt.md` screen 6 gains a divergence paragraph on Q-0017's precedent: **the gate
this product asks most often carries no verdict at all** (147 of 219 measured), the brief's *"reached
when a judge or integrate step finishes"* names the minority case, and making `retry` the **primary**
action is refused because at an author-declared gate `retry` aborts.
*Test:* `test/routes.test.ts`'s register assertions and the placeholder no longer rendering for this
path; the retired sentence appearing in no file, on `source.test.ts`'s existing retired-sentence
shape; `packages/shared/src/docs.test.ts`'s existing checks; and **the count in the divergence
paragraph re-derived rather than transcribed from this document**, with the grep that produces 219
rather than 254 written into the paragraph's own note.

---

## 5. Non-goals

Each is a deliberate exclusion with its reason.

1. **The verdict card, the findings and the summary.** Q-0129. Structurally unavailable without either
   widening the event union (*"The event union is derived from what the product emits"*, 2026-08-25), a
   route over `.harness/` (Q-0127 erratum E-1 makes the opposite answer owe a decision entry), or
   parsing a `warn` that carries no step id and whose shape changes with its own content (M-5).
2. **The diff.** Q-0129. No route serves one; `materialiseDiff` is a prompt-building function inside a
   run; the range is the flow's and the wire carries neither; `diff2html`, `diff` and `jsdiff` are in
   no manifest here.
3. **Widening the gate answer set.** Three documents promised *"override with reason"* and all three
   are corrected — `04-architecture.md` at Q-0013, the plan's M3 line at Q-0118, the design brief at
   Q-0017, whose status line names **this ticket** as the one that may ask for a fourth answer **with a
   decision entry of its own**. Not asking is the default; asking is not a screen decision.
4. **A live socket on this screen.** §3.3, with its consequence named. `run-connection.ts` exists and
   is not used here.
5. **Rendering retained `warn`/`done` messages as evidence.** Candidate-codex's AC-4 offers this and it
   is declined *in this ticket* rather than refused outright: with no socket (§3.3) there is no stream
   to read them from, and whether a run's prose belongs on a gate screen is the question Q-0129 rules.
   Recorded so the successor does not treat it as settled against.
6. **Mission control, and the navigation that reaches this screen from it.** Q-0015. Until then the
   screen is reached by typing a URL.
7. **Starting or stopping a run from the browser.** `'/stop'` stays forbidden by AC-5.
8. **Listing or serving `.harness/` from the ticket routes.** Q-0127 E-1 stands.
9. **Any authentication.** The daemon binds loopback and has none; this screen adds none and is not the
   place to argue about it.
10. **Resuming a run whose daemon restarted** (Q-0019), **step chat** (Q-0022), **run history**
    (Q-0018).

---

## 6. Gate obligations

Work for the human at the gate. **None of them blocks solutioning**, and §12 argues why each moved
from a blocker to a ratification rather than being dropped — all three are carried unchanged on the
merits, which is Q-0105's shape.

**GO-1 — rule the split (§3.1).** The recommendation is that this ticket is the answerable screen at
fourteen criteria and **Q-0129** is the evidence, its body in §7. If the gate refuses it, the
verdict-card and diff criteria are written **at the gate** by erratum, the ticket's OQ-1 and OQ-2
ruled there, and the size accepted explicitly with the seam named in advance as the remedy on
exhaustion — Q-0122's erratum E-1 is the shape, and its record of what that cost is the thing to read
first. **What must not happen is the halves arriving by implement round.**

**GO-2 — ratify the wire widening (§3.2, AC-1, AC-2).** Ruled here rather than asked, and the gate may
overturn it. If overturned in favour of reading the question from the replay, **AC-1 and AC-2 are
struck and AC-10 gains two states** — a pending count whose question replay did not supply, and an
incomplete replay the screen must disclose — which is candidate-codex's AC-18 and AC-6. If overturned
in favour of a fifteenth route, **AC-3 is struck** and `04-architecture.md`'s route list changes with
it.

**GO-3 — ratify that no decision entry is owed.** **Measured answer: no**, five ways, each re-verified
this pass: the event union is unchanged and `gateQuestionEventSchema` is reused as an element rather
than altered; nothing reads, lists or serves `.harness/`; no route is added, so `04-architecture.md`'s
route list is executed rather than changed; no dependency is added; and Q-0121 GO-3's naming rule
binds and is satisfied. The one change that **would** owe an entry is widening the gate answer set,
which §5(3) refuses. A ruling that changes no behaviour and contradicts no landed entry belongs in the
code's own authority comment — **Q-0108's precedent, where none was written and none was owed**, and
that is where §4 puts it. **If the gate disagrees, the entry is owed before the implement step runs**:
Q-0062 spent three implement rounds on exactly this, Q-0125 needed an erratum because the chore
implement step reads `errata.md` and not `ticket.md`, and Q-0083's `verdict=blocked` is the channel if
it is got wrong anyway.

**GO-4 — rule §3.3 (whether the screen subscribes).** Recommendation: it does not, with the
consequence named. If overturned, AC-10 gains the two states above and §5(5) reopens.

**GO-5 — Q-0129's body, written out in full at this gate.** §7 is that body. Three obligations found
orphaned in one week (Q-0110's, Q-0111's, Q-0112's) had lived only inside a closed ticket's prose or a
source comment; Q-0127 was opened this way at Q-0017's gate and is the counter-example.

**GO-6 — verify forced in both environment rows**, per Q-0072's closing finding: a worktree with
neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge. Plus the product run by
hand: a real run parked at a real gate, answered from the browser, with the run continuing — the
criterion `quorum open` exists for, and the one no unit test can stand in for.

**GO-7 — rule the route through the flows** (OQ-4). Taken at the gate, and named as an obligation
rather than left in an open question because the ticket body raises it as OQ-7 and a run cannot choose
its own route.

---

## 7. Q-0129 — the successor's body, in full

> **Q-0129 — The gate screen shows the verdict that reached it, and the diff.** *(Opened at Q-0016's
> requirements gate, p2.)* Q-0016 ships the gate screen over channels that exist: the question, the
> answers, the states. It renders **no verdict, no findings, no summary and no diff**, and its AC-13
> makes that a checked property. This is the half that was split off, and the split was on measured
> blockers rather than on size.
>
> **(a) The verdict and its findings.** `steps.ts:339–340` writes `{verdict, findings, summary}` as
> JSON to a path that is **a default a flow author may override** —
> `String(declared.verdict_file ?? '<TICKET_ARTIFACT_DIR>/run-{run}/{stepId}-verdict-iter-{iter}.json')`
> — inside the ticket folder. Measured 2026-09-16: **274 such files across 71 ticket folders**, not
> the *"197 across 34"* Q-0016's own body reported, which was wrong in both halves when it was
> written. `listTicketFiles` excludes them through `isHiddenPath` (`backlog.ts:329–334`), whose rule
> is **a leading dot in the first segment and not the name `.harness`**, so a second hidden directory
> is covered without anyone remembering; `GET /tickets/:id/file` re-derives membership per request, so
> `.harness/` is unreadable as well as unnamed. **Q-0127's erratum E-1 ruled that exclusion and ruled
> that no decision entry was owed *for excluding it* precisely because the opposite answer would owe
> one** — serving engine run state from a backlog route makes `.harness/` part of what the backlog
> surface means. So a route over that artifact is a decision entry before a line of code.
>
> The three alternatives, each measured at Q-0016's gate:
> *(i) verbatim prose from the stream.* The findings cross the wire as a `warn` whose message is
> `` `${stepId}: ${verdict}${findings?.length ? ' — ' + findings.join(' | ') : ''}` `` — **conditional**,
> so a `revise` carrying no findings emits no em-dash and no list, and the separator a parser would
> key on is absent exactly when the list is. `warnEventSchema` is `.strict()` over `{type, message}`
> with **no `stepId`**, so attributing it to a step means parsing a sentence. The `done` event does
> carry `stepId` and its message opens `verdict=` **only where a verdict exists**.
> *(ii) widen the event union* so a verdict crosses structurally, which is *"The event union is
> derived from what the product emits"* (2026-08-25) and a `packages/shared` change.
> *(iii) read it from run history.* **Struck at Q-0016's gate and not to be reconsidered without new
> evidence:** `host.ts:294–306` sets `record.runId` only when the terminal event arrives — its comment
> naming the terminal event as the only one carrying run identity and refusing to take a run number
> out of a `gateId` — and history is keyed `<TICKET>-<n>`, so a run parked at a gate has `runId: null`
> and its history id cannot be composed. Matching the newest `GET /history` row for the ticket is
> inference, not identity.
>
> **(b) The diff.** No route serves one; the transport's registered set is fourteen and none of them
> does. `materialiseDiff` is `packages/core/src/engine/diff.ts`'s and is a prompt-building function
> *inside* a run; the range is the flow's — `review.yaml` diffs `{base}...harness/{id}/integration` —
> and the wire carries neither. A diff renderer would be this workspace's first: `diff2html`, `diff`
> and `jsdiff` appear in no manifest. Whether the daemon derives the diff or `core` gains a function,
> and whether the dependency is taken, are this ticket's to decide; a new dependency needs a one-line
> justification and, if it changes architecture, an entry. `repo.max_diff_bytes` and **Q-0128** are the
> neighbours: a diff served to a browser has the same truncation question a diff handed to a reviewer
> has, and answering it twice in two places is how the two drift.
>
> **What it must not do.** It may not widen the gate answer set — a decision entry of its own, and
> `gateAnswerEnvelopeSchema` refuses a fourth today. It may not show a verdict where none exists:
> measured at Q-0016's gate, **147 of 219 engine-recorded gate answers were at author-declared gates
> that carry no verdict at all**, so the screen it extends must stay correct for the two-thirds case,
> and `docs/04-architecture.md:317` forbids a placeholder showing a value nobody measured. And it may
> not make `retry` the primary action, `05-design-prompt.md` screen 6 notwithstanding: at an
> author-declared gate `retry` aborts the run (`routing.ts:79–96`).
>
> **Start by re-measuring, and know how the census is counted.** `grep -c 'gate='` over
> `backlog/*/runs.log` returns **254**, which is not the answer: it decomposes as 219 engine answers
> (`gate=<kind> answer=<word>`, written at `routing.ts:48` alone), 34 retry-grant lines
> (`gate=retry counter=…`), and one hand-written erratum note. Do not re-derive any figure above from
> this body — they were true on 2026-09-16, and this repository's record is that a measurement copied
> from a document is not a measurement, and that a correction travels one document further by being
> copied (Q-0099).

---

## 8. Open questions

All non-blocking. §6 holds what the gate rules.

**OQ-1 — does `pendingGates` survive beside `gates`?** It is redundant once the array crosses.
**Recommendation: keep it.** It is a shipped field with a schema and a `.nonnegative()` constraint, a
listing of many runs wants a count rather than N arrays, and removing it is a breaking change to a
`.strict()` shape for no measured gain. AC-2 makes the two structurally unable to disagree, which is
what makes the redundancy safe rather than a second authority.

**OQ-2 — does `/runs/:handle/gate` survive as a route?** It is a URL for a transient state: the gate it
names is gone once answered, so a bookmark is a bookmark to a decision somebody already took.
**Recommendation: keep it.** The register already holds it, the four M4 paths are declared there for
the same reason, and AC-10 gives every not-parked state a sentence — which is what makes a stale
bookmark harmless rather than confusing. Folding it into `/runs/:handle` couples this screen's
delivery to Q-0015's.

**OQ-3 — what the screen says about the ticket.** The question carries `ticketDir`, an **absolute path
on the daemon's machine**. Rendering it is honest and is what the wire gives; `WireRun.ticketId` is
beside it and is what `/backlog/:ticketId` takes, so a link to the ticket page is available. Whether
the screen links there, and whether an absolute server path belongs in a browser at all, is a
rendering question this document does not rule.

**OQ-4 — the route through the flows.** **GO-7**; recorded here because the ticket body raises it.
Q-0120 walked the full seven-stage route and is the only M3 ticket to have done so, at $198.54;
Q-0017 and Q-0127 went `requirements` → `chore` at $123.34 and $108.67. M2's closing measurement — the
feature flows have four tickets of evidence between them, all from August — is the argument for the
full route. Against: fourteen criteria over three packages with one genuinely behavioural criterion
(AC-8) is chore-shaped, and `solutioning` would be asked to emit contracts for a React screen whose
only new shape is one field on an existing schema.

---

## 9. Risks

**R-1 — AC-8 is the criterion most likely to be weakened by a reviewer who has not read M-2.** An
unconditional third control is the obvious implementation and is what `05-design-prompt.md` describes.
The mitigation is inside the criterion: it must be shown **red** by making the control unconditional,
with a message naming the abort, so the danger lives in failure output rather than only in this
document.

**R-2 — the guard re-aim (AC-5) is where this ticket is likeliest to ship a hole.** Q-0014's round 2
found a guard narrowed to *"shipping files"* such that every file carrying the defect was outside the
scan forbidding it; Q-0111's first needle matched nothing including its own subject. AC-5 therefore
requires the **exemption itself** be shown load-bearing, not merely that the guard still passes.

**R-3 — the `204` and the two 404s are where the client is likeliest to ship a wrong sentence.** M-10
is new this iteration and neither candidate had it. An implementer reusing the existing body-parsing
helper reports a successful gate answer as a parse failure; one branching on status reports *"no run
under that handle"* for a gate that was simply already answered. Both are wrong sentences rather than
crashes, which is the kind that survives review. AC-4 pins each.

**R-4 — a flow could later set `retryTarget` on an author-declared gate**, at which point M-3's zero
stops being structural. AC-8 keys on the **question's** `retry` field rather than on `kind` or on a
count, so it stays correct if that happens. Stated because a reader checking only the measurement
would conclude otherwise.

**R-5 — version skew between a packed daemon and a packed bundle.** `wireRunSchema` is `.strict()`, so
a browser running the old schema against a new body rejects it. Both ship in the same five-tarball set
(*"The distribution set is five, and rejoins the emitting set"*, 2026-09-15), so there is no supported
arrangement in which they differ. Registered rather than mitigated.

**R-6 — this ticket's own review may be truncated.** Four consecutive tickets before Q-0127 were
reviewed against a diff cut at `repo.max_diff_bytes` (200,000); Q-0127 peaked at 191,552 B with zero
truncation and its own prediction of truncation was refuted. This change is comparable — one field,
one projection, one module, one guard re-aim, one screen, two documents — so truncation is plausible
rather than unlikely. Q-0124's `warn` now names any file it gave no patch for; **if it fires, a hand
cross-vendor pass over the named files is owed before the gate.** Predicted and to be measured, not
assumed.

**R-7 — the screen has no way in until Q-0015.** Reached by typing a URL. §5(6), and the same trade
Q-0121 recorded: shipping a capability before the screen that reaches it, rather than bundling them
and growing the ticket that way.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a as a code path — no adapter, no `check()`. **Not n/a as a word**: no criterion, test name, rendered string or document sentence may use *API key*, *token* or *credential*; the word is **subscription**. |
| **Worktree safety** | n/a. Nothing here writes to a working tree, creates a branch or touches a worktree. The one mutation settles a promise `core` is already parked on. |
| **Gate behaviour** | The subject. Human-gated by default is unchanged; `auto` is opt-in per gate and the host never widens it; `human-locked` stays unbypassable — nothing in `apps/web` reaches `askGate`'s policy, and the three answers are `@quorum/shared`'s enum. **The screen may offer fewer answers than three and never more** (AC-8). |
| **File format and schema** | One additive field on `WireRun`, with its schema, in `@quorum/shared` — the one place a wire shape is declared and the only one a browser may import. No file on disk changes format; no ticket, flow, role or manifest schema is touched. |
| **Lint rules** | No flow changes, so `quorum lint` has no new subject. `@typescript-eslint/no-deprecated` already covers `apps/**/*.ts` and, since Q-0014, `apps/**/*.tsx`. `turbo-inputs.test.ts` earns a registration only if a new out-of-package read appears; none is planned, and if one does it is that guard working as designed. |
| **Cold-clone impact** | **Positive, and the reason to build it.** The thirty-minute path reaches a gate and today requires the terminal that started the run. No new dependency, so the install does not move; `quorum open` already serves the bundle. |
| **Product-agnostic** | Nothing here knows about any SaaS product. |
| **Files are the database** | Unchanged: the daemon holds no new state. `RunView.gates` is derived per call from the registry `askGate` parks on, and both wire fields are computed per request. Nothing is cached; nothing is persisted in the browser. |
| **Errors are explicit** | AC-10 and AC-12. Every state names itself; no state is silence, a spinner or a skeleton; a refusal carries the daemon's own `code`, `condition` and `remedy`; a gate that is no longer waiting is reported as that rather than as a failure or a success; and two refusals sharing a status are told apart by code rather than collapsed. |
| **Vocabulary** | **gate**, **flow**, **step**, **ticket**, **stage**, **run lock**, **connection state** used as `docs/GLOSSARY.md` defines them. **No term is coined and none is owed** — this screen introduces no noun — so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). Forbidden here specifically: a gate is not an *approval*, a *checkpoint* or a *review step*; an answer is not an *override*. |

---

## 11. Provenance

**From candidate-claude, and decisive.** M-1, that `RunView.gates` already holds the questions and
`wireRunOf` drops them to a count — re-verified this pass at `host.ts:118`, `:264` and `wire.ts:109`,
and it is what makes the screen half cheap and removes three of the ticket's four OQ-1 options from
it. M-2, that `retry` at a gate with no `retryTarget` returns `{ abort: true }` — re-verified verbatim
at `routing.ts:79–96`, and it is AC-8, the criterion this document exists to get right. M-3's census.
M-4, that `kind` cannot discriminate an engine-presented gate from a deploy gate. M-5, that
`warnEventSchema` carries no `stepId`. M-6, which strikes the run-history option rather than weighing
it. The `auto`/`dry` short-circuits. The split with the successor's body written out in full, and the
gate-obligation structure.

**From candidate-codex, and taken over candidate-claude on four points.** One answer in flight at a
time, with the controls inert while it is (AC-11) — candidate-claude has no such criterion and a
double submission is the ordinary way a maintainer meets M-9. The `no-such-gate` wording and, more
importantly, its stated reason: the response cannot distinguish a landed answer from any other
disappearance, so the screen must claim **neither** success nor failure (AC-12) — candidate-claude
renders the right sentence but argues from the lost-response case alone and so under-states why the
wording must be neutral. The clause that the screen does not claim the next step succeeded, the ticket
advanced or the run ended until a read establishes it (AC-11). And the enumeration of the not-parked
states, which is more complete than candidate-claude's (AC-10). Its non-goals list and risk framing
also contributed.

**Refused, with reasons.** Candidate-codex's twenty-four criteria: two of them (its AC-23 and AC-24)
are cross-cutting checklists rather than independently testable criteria and are moved to §10, and its
AC-6 and AC-18 describe states that exist **only** under its replay-based design, which §3.2 rules
against — widening the wire removes them rather than mitigating them. Candidate-claude's AC-8, which
offers two controls and no explanation where a gate carries no `retry`: merged with candidate-codex's
AC-9 into the property that an answer the gate does not offer must be **explained** rather than simply
missing, with the presentation left unruled and the third option — two controls and no explanation —
named as what may not ship.

**From the ticket body, verified and kept.** Its (a), (b)'s mechanism, (e), (f) and (g) each re-run;
(g)'s fourteen routes confirmed. Its (d) is refuted by M-1 and its OQ-5 by M-2.

---

## 12. What iteration 2 changed, and why the verdict moved

**The tree has not moved.** `git log` tip is `2bb20e3`, the commit that opened this ticket;
`requirements/errata.md` does not exist; the ticket body is byte-identical. So none of iteration 1's
three findings could have been answered by waiting, and re-stating them would be the second instance
of *a retry on an unchanged tree cannot rule its own blocker* rather than the remedy for it.

**Seven measurements did not survive re-derivation**, which is what iteration 2 was for:

1. **The ticket body's verdict-artifact count** is 274 across 71 ticket folders, not 197 across 34 —
   wrong in both halves when written (M-13). Corrected in §7.
2. **The ticket body's citation** of the placeholder rule at `04-architecture.md:200` is at `:317`;
   `:200` is the run-identity paragraph (M-14, M-6).
3. **Iteration 1's own census evidence was a regex artifact.** The 220th line does not carry an empty
   answer; it reads `gate=erratum answer=E-1 (…)`, and "empty" came from a lowercase-only pattern. The
   conclusion stands, the evidence for it did not (M-3).
4. **Iteration 1's `gateId` claim was stated and no rule drawn from it.** The format really is
   `<runId>:<n>` (`engine.ts:329`), which is what makes parsing it tempting and wrong — `host.ts`'s own
   comment names that temptation as the second authority it exists to prevent (M-7). Now AC-7.
5. **The engine-presented gate has two reason sentences**, not one: Q-0083's bound-zero sentence
   beside the exhaustion one. AC-7's test covers three shapes, not two (M-8).
6. **The verdict `warn` and `done` messages are conditionally composed** — a findings-less `revise`
   emits no em-dash at all, and a step with no verdict emits a `done` that does not open `verdict=`.
   Both were stated unconditionally by both candidates and by iteration 1 (M-5). It strengthens §7's
   case that prose is not a contract.
7. **`POST /runs/:id/gate` answers `204` with no body, and two distinct refusals are both `404`**
   (M-10). Neither candidate nor iteration 1 had either. Both fold into AC-4, and R-3 names them as the
   likeliest wrong sentences this ticket could ship.

**One further cause of `no-such-gate`** was found — a run stopped or ended while the screen is open,
whose gates `release` forgets — which strengthens AC-12's neutral wording rather than changing it.

**The verdict moves to `ready`, and all three of iteration 1's findings are carried unchanged on the
merits.** What moved is where they sit, which is Q-0105's shape exactly.

- **GO-1 (the split)** — the document is **fourteen** criteria, under the ceiling, and the successor's
  body is written out in full. My role's instruction to return `needs-input` binds on a requirement
  that *exceeds* the size; this one does not, because the splitting work is already done in it.
  **Q-0017's requirements run, one ticket old, returned `ready` on iteration 2 and its gate then
  performed the split it recommended, opening Q-0127** — the precedent is exact. GO-1 names the
  remedy if the gate refuses.
- **GO-2 (the channel)** — picking when candidates disagree, and saying why, is what this step is for.
  It owes no decision entry, touches no surface this flow cannot write, and rests on a measurement
  re-verified twice. Asking the gate to ratify a ruling this role is empowered to make, on an
  unchanged tree, is the pattern rather than the remedy. **The ruling is stated; §6 says what moves if
  it is overturned.**
- **GO-3 (whether an entry is owed)** — this is the one that genuinely can block, because
  `developer-generalist` may not write a decision entry and Q-0062, Q-0122 and Q-0125 each record what
  launching with one owed costs. It is **answered**, five ways, each re-verified this pass, and
  Q-0108's precedent is that a ruling changing no behaviour and contradicting no landed entry belongs
  in the code's own authority comment with no entry written. **An answered question is not an open
  one**; §6 states the answer and what to do if the gate disagrees.

**Nothing left open changes the design**, which is the test this verdict is held to: an architect can
emit contracts for the field, the projection, the client and the screen's states from this document as
it stands.
