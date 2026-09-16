# Q-0016 — implement report, run 2, iteration 1

*The gate screen over the channels that exist, at fourteen criteria. Every number below was taken
from this tree; where a figure in `requirements/merged.md` has moved since it was written, §5 says
so rather than restating it.*

---

## 1. What shipped, criterion by criterion

**AC-1 — `@quorum/shared`: a run's wire shape carries the questions its gates are asking.**
`WireRun` gains `gates: readonly GateQuestionEvent[]` beside `pendingGates`, and `wireRunSchema`
gains `gates: z.array(gateQuestionEventSchema)` — the event union's **own** schema as the element,
never a second declaration of those six fields. The schema keeps `.strict()` and its
`z.ZodType<WireRun>` annotation. The field may keep the name `gates` for the reason Q-0121 GO-3
gives rather than as an exception to it: that rule binds a wire field that **narrows** a `RunView`
field, and this narrows nothing — same array, same element schema.

**AC-2 — `packages/server`: the projection carries them, derived per request.** `wireRunOf` gains
one line, `gates: view.gates`, and `pendingGates` stays `view.gates.length` — so the two are
structurally unable to disagree, one being the other's length. It is still the **one** projection
all three run-answering routes go through (Q-0121 AC-8), and `RunView.gates` is built by `viewOf`
from the registry `askGate` parks on, so both fields are answers about this request and nothing is
cached.

**AC-3 — no route is added.** `packages/server/src/package.test.ts`'s derivation reports the same
fourteen routes it did before, unedited, and it is an identity list rather than a count. The answer
route's own suite passes unmodified — its `204`, its four refusal codes and their statuses are
untouched, including that `http.ts` validates no envelope.

**AC-4 — `apps/web` can issue exactly one request that is not a GET.** `FetchLike` widens to
`(path, request?: DaemonRequest)`, where `DaemonRequest.method` is the literal `'POST'` — so the
set of things this app can do to the daemon is closed by the compiler and not only by a scan.
`answerGate` recognises the success **from its status before anything reads a body**: routed
through `requestJson` a settled gate would be reported as *the response body was not JSON*. Two
refusals sharing `404` are told apart by the body's `code` and never by the status. The refusal
branch was extracted into one `refused()` helper that `requestJson` and `answerGate` share, so the
non-refusal-body fallback is written once.

**AC-5 — the read-only boundary, re-aimed and not deleted.** `test/source.test.ts`'s write guard is
now a table of `{needle, what, permitted}`: four method literals and two route literals, of which
exactly two carry a permitted module — `method: 'POST'` in `daemon-client.ts` and `'/gate'` in
`daemon-endpoints.ts`. `'/stop'`, `PUT`, `PATCH` and `DELETE` are permitted **nowhere**. Its comment
moved with it: the clause that read *"no gate answered"* now reads *"no run is started, no run is
stopped, no stage is moved, no run lock is taken"*, which are the three of four that are still true.
A second test runs the same rules over the same corpus **with the exemptions ignored** and asserts
what comes back is exactly those two modules — so an exemption that forgave nothing would fail.

**AC-6 — the gate path comes from the endpoint register.** `daemon-endpoints.ts` gains
`runDetailPath` and `runGatePath`, both page-relative with the handle percent-encoded to one
segment, asserted over a real `URL` for five hostile handles including `../project`. `/gate` is
deliberately **not** a sixth `DAEMON_ENDPOINTS` entry: that register is the set of prefixes the dev
proxy forwards, `/runs` already covers it, and `daemon-endpoints.test.ts` pins that set at five.

**AC-7 — the question, and nothing composed.** Kind as the word sent, reason **verbatim**, the
ticket folder, and the step a send-back returns to where the question carries one. **Three** real
reason shapes are rendered in full and asserted: a flow file's static `reason:`, the exhaustion
sentence, and Q-0083's bound-zero sentence. The `gateId` is opaque — echoed into the envelope and
never split, sliced, matched or indexed, which a source scan holds shut in both directions.

**AC-8 — the answers offered are the answers that gate will honour.** `answersOffered` derives from
`gateAnswerSchema.options` and removes `retry` where the question carries no target. Two controls
and the sentence saying why the third is absent; three where a target is named. **The criterion is
shown red**, and its failure message names the abort: the forbidden implementation is run over the
same question and reported as offering an answer that `routing.ts:97` answers with `{abort: true}`.

**AC-9 — no gate labelled from `kind` alone.** The word the engine sent is rendered as sent; two
`human-locked` questions differing only in their target render the same label; and a scan refuses
the coined nouns in this module's source.

**AC-10 — every not-parked state names itself.** Four subjects over the wire's closed three
(`parked`, `no-gate`, `ended`, `refused`) as an exhaustive `switch`, so a fourth run state would
fail to compile; plus the four request states `request-state.ts` already owns. `GATE_SUBJECT_TEXT`
is a total `Record`, so a fifth subject cannot arrive without a sentence. Each is asserted to render
its own sentence and **none of the others**, and only `parked` offers controls. A run started with
`auto` reaches `no-gate` and is correct there — `askGate` returns without emitting.

**AC-11 — one answer in flight.** A ref makes it a property rather than a hope: two activations in
one turn produce exactly one request. On a `204` the screen says which answer it sent and then
**reads**, claiming no outcome the read did not establish. The controls are gone once the gate is no
longer pending, and the route stays put.

**AC-12 — a gate that is gone is reported as that.** `no-such-gate` renders its own sentence and
claims **neither** that the earlier answer arrived nor that it failed, because the registry deletes
before it settles and a lost `204`, an answer given at the command line, and a stopped run are
indistinguishable to the daemon. It re-reads and re-sends nothing. The other four refusals render
distinguishably, carrying the daemon's `code`, `condition` and `remedy`.

**AC-13 — no verdict, no findings, no summary, no diff, and no region where one would go.** A
source scan over the module refuses the six words such a region would need; the rendered output over
a parked run is asserted to carry none of five placeholder markers and to contain no empty element;
and the module reads no event `message` field at all.

**AC-14 — the register and the documents.** `GATE_ROUTE` is a register constant `app.tsx` selects
by; the row is `screenExists: true` with a sentence naming **Q-0129** for the half it does not
build; the retired sentence appears in no file under `src`; `04-architecture.md` §`packages/server`
and §`apps/web` and its status line record what moved; and `05-design-prompt.md` screen 6 gains a
divergence paragraph on the board's precedent, with **the census re-derived and the command that
produces it written into the paragraph**.

---

## 2. File by file

| file | what changed |
| --- | --- |
| `packages/shared/src/wire.ts` | `WireRun.gates` and its schema entry; the docblock's two-narrowed-fields paragraph rewritten, because only one field narrows now |
| `packages/shared/src/wire.test.ts` | AC-1: the question crosses whole and in order; the element is the union's own schema; what the `z.ZodType` annotation does and does not catch |
| `packages/server/src/wire.ts` | `wireRunOf` carries `gates`; docblock says why the redundancy with `pendingGates` is safe |
| `packages/server/src/http.test.ts` | AC-2 (two tests); the key-set identity gains `gates`; **Q-0121 AC-9 re-aimed** — see §5(b) |
| `apps/web/src/daemon-endpoints.ts` | `runDetailPath`, `runGatePath`, and `GATE_SEGMENT` as a named literal so the guard's exemption has a subject |
| `apps/web/src/daemon-client.ts` | `DaemonRequest`; `FetchLike` widened; `refused()` extracted; `fetchRun`; `answerGate`; `runInFlight`; `gateAnswerInFlight`; header records the one non-GET |
| `apps/web/src/daemon-client.test.ts` | AC-4: eight clauses over `answerGate`, three over `fetchRun` |
| `apps/web/src/gate-screen.tsx` | **new** — the screen, its subject classifier, its offered-answer rule and its sentences |
| `apps/web/src/gate-screen.test.ts` | **new** — AC-7 to AC-14, 35 clauses |
| `apps/web/src/routes.ts` | `GATE_ROUTE`; the row flipped with its sentence rewritten |
| `apps/web/src/app.tsx` | selects the screen by the register's own constant |
| `apps/web/test/source.test.ts` | AC-5 re-aim plus the exemption-is-load-bearing clause; AC-7/8/9/13 source guards; AC-14 retired sentence |
| `apps/web/test/routes.test.ts` | AC-14 register clauses; three exception rows with reasons |
| `apps/web/test/daemon-endpoints.test.ts` | AC-6 |
| `docs/04-architecture.md` | §`packages/server` row sentence; §`apps/web` gate-screen paragraph; status line |
| `docs/05-design-prompt.md` | screen 6 divergence paragraph; status line |
| `packages/shared/src/docs.test.ts` | two clauses holding that paragraph and its re-derived count |

---

## 3. What I deliberately left alone

1. **`packages/core` — untouched, entirely.** No engine change, no answer-set change. §4.6 and §5(3).
2. **No fifteenth route.** AC-3. The screen needs none, which is what made the split cheap.
3. **No decision entry**, per erratum E-3 and GO-3's five grounds, each re-verified here: the event
   union is unchanged and its schema is reused as an element; nothing reads, lists or serves
   `.harness/`; the route list is executed rather than changed; no dependency is added; and
   Q-0121 GO-3's naming rule is satisfied because `gates` narrows nothing.
4. **No dependency.** `apps/web`'s manifest is untouched and its register still pins three.
5. **`run-connection.ts` is untouched and the screen holds no socket** (GO-4, §3.3). The consequence
   is written into the module header rather than smoothed over: a gate arriving while the screen is
   open is not shown until the reader asks again.
6. **`pendingGates` survives beside `gates`** (OQ-1, recommendation taken): a shipped `.strict()`
   field with a `.nonnegative()` constraint, a listing wanting a number, and no measured gain from
   removing it.
7. **`/runs/:handle/gate` survives as a route** (OQ-2, recommendation taken).
8. **`ticketDir` is rendered and not linked** (OQ-3): the screen shows what the wire gives and
   composes no navigation from it, that being a rendering question the document does not rule.
9. **`docs/06-development-plan.md` is untouched.** AC-14 names three surfaces and not that one, and
   its bullets are rewritten by hand at each plan pass (Q-0094 E-3(a)).
10. **`backlog/` untouched**, as the role requires.

---

## 4. Shown red before green — nine mutations, each with a discriminating message

| # | mutation | what went red |
| --- | --- | --- |
| 1 | `wireRunOf` answers `gates: []` | 3 server tests — *"/runs did not carry the gate's question"*, *"expected [] to have a length of 1"*, *"a row carrying 1 questions reported a different count"* |
| 2 | `answersOffered` made unconditional | 3 web tests — including *"the screen sent an answer this gate does not offer"* and the criterion's own abort message |
| 3 | the `sending` guard removed | *"a double activation answered the gate twice: expected 2 to be 1"* |
| 4 | the `no-such-gate` branch disabled | *"a gate that is no longer waiting was not reported as that"* |
| 5 | `'/gate'` spelled as a template tail | *"the exemptions forgive something other than the two modules named"* |
| 6 | the element schema replaced by a loose object | *"a row carried an event that is not a gate question"* |
| 7 | `app.tsx` stops selecting the screen | *"the placeholder still draws at the gate route"* |
| 8 | `response.ok` instead of `status === 204` | 2 client tests — *"expected 'loaded' to be 'unparseable'"*, and the six-outcomes clause collapsing to five |
| 9 | `sending` not released in `load()` | *"a control a reader can press did nothing"* |

---

## 5. What I found, and where I diverged

**(a) AC-10's `refused` clause is delivered in a weaker form than its words, and this is for the
gate.** It asks for *"the start was `refused`, reporting the daemon's own condition"*. A refused
start's condition is `RunView.refusal`, which is **not** a field of a run row — and AC-1 authorises
exactly one added field, with AC-2's key-set assertion pinning the result at seven keys. Projecting
the refusal too would be a second widening the gate did not rule, so the screen says the start was
refused, that nothing ran, and **that this route carries no reason for it** — an explicit absence
rather than a fabricated one. I did not improvise the wire change. If the gate wants the condition,
it is one more field on the same projection and one more key in that assertion.

**(b) Q-0121 AC-9 had to be re-aimed, and one of its three clauses is now deliberately false.** That
test asserted no ticket record, **event or gate question** crossed the wire. The question crosses
now, by design. What that clause was actually about — the ticket record — is unchanged and still
checked: a marker in the ticket body reaches no client and the row still narrows the ticket to its
id. The **folder** half moved with the question rather than being abandoned: `ticketDir` is a field
of `GateQuestionEvent`, so a gate's own question carries the folder and the listing row still does
not, which is how it is now asserted. The test's title and docblock say all of this in place.
`docs/04-architecture.md`'s matching sentence moved in the same change, which is the rule when code
and a numbered document disagree.

**(c) `tsc` refuted a claim I was about to ship, and the refutation is written into the test.** I
wrote that `wireRunSchema`'s `z.ZodType<WireRun>` annotation catches a schema field with no
interface field, and demonstrated it with `@ts-expect-error`. `tsc` reported the directive
**unused**: `ZodType` is covariant in its output, so an object schema carrying an extra key is still
assignable. The clause now demonstrates the two directions the annotation **does** catch — a schema
omitting `gates`, and one whose `gates` is the wrong element — and states in place that the half
refusing an undeclared key is `.strict()` at run time, which the clause above it exercises. Two
mechanisms; neither is the other.

**(d) A test of mine was vacuous and mutation 2 is what found it.** AC-8's *"no interaction produces
a retry envelope"* clicked every control in a loop over one render. Answering re-reads the run,
React replaces the nodes, and every click after the first was against a detached element — so the
loop **passed with an unconditional third control present**. It now drives each control on a screen
of its own and asserts the envelope count equals the control count, so *every control was pressed*
is a fact rather than an intention. That is this repository's most-recorded class, caught inside the
clause written to close a different one.

**(e) The census is one higher than the merged document's, and the cause is this run.** §0.3 counts
219 engine-recorded answers, 147 of them at author-declared gates. Re-derived today:
`grep -hE 'gate=[a-z-]+ answer=(advance|retry|abort)' backlog/*/runs.log | wc -l` returns **220**,
of which **148** are `gate=human` — because this ticket's own requirements gate wrote
`gate=human answer=advance` into `backlog/Q-0016-…/runs.log` between the two measurements. The
decomposition still holds exactly: 220 answers + 34 retry-grant lines + 1 hand-written erratum note
= 255 total `gate=` lines. The document's figures were right when written; the paragraph I put in
`05-design-prompt.md` carries the current ones **with the command that produces them**, so the next
reader re-runs rather than copies. `retryTarget` still has one production reader
(`routing.ts:79`), one fixture, and **no occurrence in any shipped flow**.

**(f) A state and its guard disagreed, and closing it needed a test of its own.** The answer controls
are drawn inert from the answer **state**, and the one-in-flight guard is a **ref**. A Refresh while
an answer was outstanding cleared the state and left the ref set — so the controls looked live and
silently swallowed a press, which is worse than either behaviour alone. `load()` releases the ref,
with the reasoning in place: *exactly one answer wins* is the daemon's property, the registry
deleting a gate before it settles it. Mutation 9 is that clause shown red.

**(g) The hand verification against a running daemon was NOT performed, and I am not reporting it as
done.** `quorum open --no-open --port 7919` starts against this worktree and prints
`✓ Quorum is serving http://127.0.0.1:7919`, so the built bundle loads and the daemon binds — but
every loopback probe I tried (`curl`, and `node -e` with `fetch`) was refused by this environment's
command approval, and this session is non-interactive. So *the four shell routes answer 200
text/html, a JSON route still answers JSON, and a missing asset is 404* is **unverified here**. It
created nothing: this worktree still has neither `.harness/` nor `.quorum/`. That check and the real
parked-run-answered-from-the-browser walk are GO-6's, at the gate.

---

## 6. Verification

- `pnpm install --frozen-lockfile` then `pnpm turbo run test lint typecheck --force --continue` —
  **21/21 tasks successful, 0 cached**. Run twice, before and after the last change.
- `pnpm turbo run build --force` — **5/5, 0 cached**, so the new module compiles into the served
  bundle and the four `tsc` emits are unaffected.
- `pnpm exec quorum lint` — **6/6**.
- Package-level counts after the change: `@quorum/shared` wire suite 27, `@quorum/server` http suite
  35, `apps/web` 15 files / 349 tests.
- **Environment row: the bare one.** This is the implement worktree and it has neither
  `.harness/worktrees` nor `.quorum/runs` — checked rather than assumed. The populated row on `main`
  after the merge, and Q-0079's git-identity sweep, are the gate's (GO-6).

---

## 7. For the gate

1. **AC-10's `refused` condition** — §5(a). Delivered as an explicit absence; one field and one
   assertion away if the gate wants the daemon's own sentence.
2. **Q-0121 AC-9's re-aim** — §5(b). One landed clause is now deliberately false and the document
   moved with it. Worth a reviewer's eye, since it is a guard this change makes weaker in one
   direction and keeps in another.
3. **GO-6's hand walk** — §5(g). Not done here, and the reason is the environment rather than the
   change.
4. **The diff is ~196 KB against a 200 KB cap** — about 2% of headroom, with
   `packages/shared/src/wire.ts` in the tail that a head cut would take. If the truncation warning
   fires, R-6's hand cross-vendor pass over the named files is owed.
