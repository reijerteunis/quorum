# Verdict — Q-0050 review round 2

*Judge · 2026-08-29 · panel: claude (3 majors, 3 nits), codex (1 blocker, 1 major, 1 nit) · reviewed at `harness/Q-0050/integration` (`fd23acd`)*

**changes-requested — four majors and four nits. No blocker survives.**

Nine raw findings deduplicate to eight. Two pairs merged, one finding promoted, one demoted. Every
disputed claim below was re-read in `harness/Q-0050/integration` and in `spike/src/engine.js`
before it was ruled on, because *"a reviewer approves the change it asked for"*
(`docs/DECISIONS.md`, 2026-08-29) is this ticket's own lesson and a severity taken on trust is a
severity nobody measured. What was verified is recorded so round 3 does not re-derive it.

---

## Majors

### M-1 — the manifest is finalised *after* the terminal event, so a persist failure emits a `warn` behind the run's last event

`packages/core/src/engine/engine.ts:152` · from claude M-1 · **confirmed by reading**

`finishRun` awaits `finish(...)` — which appends the terminal `runs.log` line (`lifecycle.ts:41`),
emits the terminal `info` (`:45`) and emits the `terminal` event (`:54`), all synchronously — and
only then calls `history.finalise(status, result.stage)`.

The spike does the reverse and deliberately: `spike/src/engine.js:626-632` assigns the manifest and
calls `replaceManifest(ctx)` **inside** `finish`, above `backlog.write` (`:648`), the terminal log
line (`:649`) and `ui.info` (`:651`). The port inverted that order when it moved finalisation out of
`finish` into `engine.ts`'s `finishRun` seam. That is a preservation deviation under charter §2, on
top of the criterion it breaks.

Verified downstream: `RunHistory.finalise` calls `replaceManifest()` non-fatally
(`packages/core/src/run-history/writer.ts:393`), whose catch reports through
`host.warn('could not persist run history at …')` (`:305`), and `engine.ts:180` wires that host to
`emit({ type: 'warn', … })`. So a manifest write that fails at finalise time — full disk, removed
`.quorum/runs`, permissions changed mid-run — puts a `warn` on the stream **after** the terminal
event. AC-3 requires the terminal outcome to be *"one per run, always last"* and
`contracts/Q-0050/run-events.contract.md` repeats it. In the spike that warning reached the terminal
ahead of the terminal line; here it arrives behind the event that says the run is over.

The second consequence is the one M3 meets on an ordinary run, and it is a window rather than a
disk-state defect: a consumer told `{type:'terminal', status:'completed'}` and reading
`run-manifest.json` in response sees `status: "running"` and `ended_at: null`. Sub-millisecond
in-process today; a socket makes it reachable.

**Remedy** is the three-line `finishRun` shape claude gives, or a `finaliseManifest` capability on
`RunPersistence` called from inside `finish` — the closer transcription of `engine.js:626`, which
amends `run-flow-api.contract.ts` additively on the route E-13 already established. Either is
available; only the second needs an erratum first.

**Who can perform it:** a development revise round (`engine.ts` is owned).

### M-2 — the channel does not latch after `return()`, so a further `next()` drains buffered events *and can start the run the caller abandoned*

`packages/core/src/engine/channel.ts:100` · **merged**: codex major + claude N-2 · **promoted to major**

`abandon()` awaits `finalise` and resolves `{ done: true }` without closing the channel or marking
it terminated, and `next` (`channel.ts:86`) has no abandoned check. Two consequences, and the panel
found one each:

- **Buffered delivery after done** (claude N-2). Events emitted *during* finalisation — the
  rollback `warn`, the terminal `info`, the `terminal` event — are still in the FIFO, so a `next()`
  after `return()` receives them. The iterator protocol says a returned iterator is done, and
  `run-events.contract.md` states outright that an abandoning consumer *"cannot observe the terminal
  event it caused"*, which this makes untrue for a manual consumer and true only by convention for a
  `for await` one.
- **Lazy start after abandonment** (codex). `abandon()` never sets `started`, so `return()` before
  the first pull followed by `next()` calls `start()` and runs `run()`. Traced: the stage
  precondition passes, the banner is emitted, `persistence.appendLog` writes the
  `run=<id> flow=<f> start` line, `initialiseRunHistory` creates `.quorum/runs/<id>/` and writes a
  manifest, and only then does the loop's first `throwIfInterrupted()` observe the already-aborted
  signal and record `interrupted`. Durable artefacts on disk for a run the caller had already
  abandoned, and `channel.ts`'s own header claims *"a caller who never iterates never triggers
  work"*.

**Why major rather than claude's nit.** Claude weighed only the first consequence and reasonably
called it cosmetic. The second is not: it is out-of-protocol misuse producing on-disk state, and the
file's JSDoc and the runtime contract each assert a property the code does not hold. Round 1's N-4
closed the two-consumer and re-entrant-pull cases of exactly this class by name; leaving the third
undone after fixing its two siblings is arbitrary, and the fix is the same three lines — set a flag
in `abandon`/`abandonWithError`, have `next` resolve `{ done: true }` once it is set and refuse to
`start()`.

**Who can perform it:** a development revise round (`channel.ts` is owned).

### M-3 — the `interrupted` record is not the spike's, and no erratum rules on the clause it misses

`packages/core/src/engine/engine.ts:225` · from claude M-2 · **confirmed by reading**

AC-5 states the interrupted case as preservation in as many words: *"The persisted record is
byte-identical to today's (`interrupted`, note `received SIGINT`)."* The port merged the spike's two
entry points — the run catch (`failed`, category derived) and the signal handler (`interrupted`,
category `interrupted`, note `received <sig>`, `spike/src/engine.js:58-61`) — into one catch and
applied the catch's treatment to both:

| field | spike | port |
| --- | --- | --- |
| `runs.log` `error=` | `received SIGINT` | `run #1 (requirements) interrupted` (`engine.ts:149`) or `gate human (approve to continue) interrupted` (`routing.ts:7`) |
| occurrence `error.category` | `interrupted` | `integrate` / `script` / `unknown` (`engine.ts:53`) |

The note now depends on *where* the run happened to be cancelled, which is not a fact a reader of
`runs.log` can use. Verified: `ErrorCategory`'s `'interrupted'` member
(`packages/core/src/run-history/manifest.ts:50`) has **no producer** anywhere in `core` — the only
other appearances are the occurrence *status* (`types.ts:94`) and the run status
(`engine.ts:225`), which are different fields.

This is not the round-1 M-3 fix overshooting its own subject: deriving the category from
`occurrence.kind` is right on the *failed* path and `categoryOf`'s JSDoc argues that correctly. The
defect is that the same derivation was applied to the *interrupted* path, where the spike does not
derive.

**Why major.** `core` deliberately no longer knows about signals, so it cannot write
`received SIGINT` unaided — which means either the caller supplies it (`AbortSignal.reason` is the
standard mechanism and is read nowhere in this folder) or the clause is ruled unattainable in
`solution/errata.md`, naming what the record carries instead. What may not stand is the present
state: a stated preservation clause silently unmet, in the one status the requirement singled out,
visible only by reading two trees side by side. The `runs.log` half is live now; the occurrence half
is latent, since Q-0050 allocates no occurrence (E-13).

**Who can perform it:** the code half is a development revise round, but **which way it goes is a
ruling** — restore the note through `signal.reason`, or rule AC-5's clause unattainable in
`solution/errata.md`. One or the other, at the gate.

### M-4 — the abandonment path is recorded as covered and is tested only against stubs

`backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:63` · **merged**: claude M-3 + the surviving half of codex's blocker · **confirmed by reading**

The requirement calls this the ticket's own invented failure mode: *"This path does not exist in the
spike; the port creates it, so it is specified here rather than discovered in review."* Round 1's
M-1 found it broken and the fix is correct — `throwIfInterrupted` (`engine.ts:148`, `:190`, `:223`)
observes `abandonment.abort()` through the combined signal at `engine.ts:250`.

**Nothing tests the composition.** Verified:

- `channel.test.ts:64` — *"return awaits abandonment finalisation"* — drives `iterator.return()`
  against a **hand-written** `finalise` resolving a test-controlled promise. It proves the channel
  waits; it says nothing about what `runFlow`'s `finaliseAbandonment` (`engine.ts:259`) does.
- `engine.test.ts` contains no `break`, no `.return()` and no abandonment test at all — its two
  describes are the composed run stream and cursor movement.

**And the record claims otherwise.** `scenarios.md:63` reads
`| AC-5c/5d | q0050-lifecycle, q0050-event-channel | lifecycle-routing.test.ts, channel.test.ts — abandonment | — |`.
`lifecycle-routing.test.ts` has three describes — AC-4 gate behaviour, AC-6/7/8 failure routing,
AC-12c — and nothing on abandonment. So a criterion row names a file containing nothing on its
subject, for the one criterion whose failure mode the port *invents*. That is *"a check that skips
its subject must not report success"* (2026-08-25) at the level of the coverage record, and round-1
M-1 is the evidence for why it matters: the defect was found by reading, and a regression would be
silent again.

**What codex's blocker contributes here, and it is the load-bearing part.** Its worked example is
correct and I confirmed it: `finish` is an `async` function with no internal `await`
(`lifecycle.ts:9-60`), so for a short flow the entire terminal record — ticket write, terminal
`runs.log` line, terminal event — is written during the synchronous prefix of `start()`, before the
first `next()` resolves. A test author who writes "break after the first event, assert
`interrupted`" against a two-step fixture will therefore get `completed` and mis-diagnose it as a
bug. The test must use a fixture with a genuine suspension point (a gate, or a step that awaits) and
assert what the design actually promises: a terminal record exists, counters are persisted, and
`return()` does not resolve until it has been written.

**Who can perform it:** a test file and a backlog document — **QA or hand, not a development revise
round.** If the join is judged untestable, `scenarios.md:63` must say so rather than read as covered.

---

## Nits

### N-1 — the author-gate retry log line writes `set=NaN` where the spike writes `set=undefined`

`packages/core/src/engine/routing.ts:97` · from claude N-1 · confirmed

Round 1's N-1 restored the null guard on the counter *write* (`routing.ts:96`) and left the value it
is computed from unguarded: `const limit = Number(step.retryMax)` (`:92`) is `NaN`, while
`spike/src/engine.js:587` interpolates `step.retryMax` raw and logs `set=undefined`. `counter=` is
identical in both (`"undefined"`). Reachable only from a hand-written flow putting `retryTarget` on
a `gate:` step, which `lintFlow` cannot forbid because `retryTarget` is synthesised rather than
authored; no shipped flow does it, and the counter write itself is correctly guarded. Interpolate
`step.retryMax` directly, or compute `limit` inside the guard.

### N-2 — the no-signal-subscription guard names three subscription APIs and misses three more

`packages/core/src/engine/q0050.source.test.ts:66` · from claude N-3 · confirmed

The assertion is `expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once)|\[/)`.
AC-5 requires *"`process.exit` and any `process.on`/`process.once` signal subscription appear
nowhere"*, and the guard transcribes those two names literally: `process.addListener`,
`process.prependListener` and `process.prependOnceListener` are the same subscription and pass it.
The rule it holds — *a library that exits the process cannot host M3's daemon* — governs every file
Q-0051–Q-0053 will add to this folder, so widening the alternation is worth doing while the folder
is six files. This is Q-0071's *"a guard has a subject proves the guard fires, not that each of its
clauses does"* pointed at a clause that does not exist rather than one that never runs.

**Who can perform it:** a test file — QA or hand.

### N-3 — a gate that is never asked still consumes a gate id

`packages/core/src/engine/routing.ts:84` (and `:126`) · from codex · confirmed

The `GateQuestionEvent` is built with `gateId: context.nextGateId()` *before* `askGate` evaluates
its `auto`, `--auto` and `--dry` short-circuits (`routing.ts:12-19`), so a gate that is
auto-advanced or dry-skipped burns an id. The solution document states the opposite in as many
words — *"Automatic and dry short-circuits run before a question is allocated"* — and
`engine.test.ts:122`'s `['1:2','1:3']` pins the skip rather than flagging it. Harmless at runtime:
ids are opaque, run-scoped, and used only for correlation, which is why this is a nit and not a
contract violation with teeth. Either allocate on the branch that emits the question and update the
pin, or amend the solution sentence in `solution/errata.md` — but the two should stop disagreeing.

### N-4 — nothing states what an abandonment arriving *after* a terminal status has been committed does

`packages/core/src/engine/engine.ts:252` · **codex's blocker, demoted** · see the ruling below

`run-events.contract.md` and AC-5 describe abandonment as producing an `interrupted` record. Neither
says what happens when the producer has already committed a different terminal status before
`return()` is called, which — per M-4's finding above — is the ordinary case for a short flow. The
behaviour is defensible and I am not asking for it to change; what is missing is the sentence. This
is AC-12's own shape (*"an unstated answer is what lets the next reader assume the question was
considered"*) arriving on a criterion AC-12 does not cover. One sentence in
`contracts/Q-0050/run-events.contract.md` via `solution/errata.md`.

---

## Rulings on the panel

**Codex's blocker (`engine.ts:252`) is demoted to N-4 plus the test obligation now in M-4.**

Its factual core is correct and I verified it rather than taking it on report: `finish` runs to
completion synchronously, so an empty or short flow persists `completed` before the first `next()`
resolves, and `finaliseAbandonment`'s `abort()` cannot retract it. What does not survive is the
severity and the remedy.

- **The safety property AC-5 states is met.** Register row 6 requires every terminal outcome to
  reach `runs.log` with counters persisted. It does. The failure mode the requirement identified —
  *"a `for await` with a `break` therefore abandons a run with no terminal record at all"* — is
  fixed. AC-5's *"an abandoned run does not continue unobserved"* is also met: `return()` aborts the
  combined signal and awaits `settle`, so it does not resolve until the run has actually stopped at
  the next cancellation point.
- **The remedy reverses an accepted design.** *"Couple execution or terminal commitment to delivery
  state"* is the rejected alternative *"Execution entirely inside each pull"* and the rejected
  back-pressure option, both ruled at solutioning and contracted. A reviewer may not reverse a ruled
  design in review; the route is an erratum (`solution/errata.md`), which is what E-1 through E-13
  are for on this ticket.
- **And the remedy would make the durable record lie.** Under it, a run that executed every step,
  invoked adapters, spent money and merged branches persists as `interrupted` because its consumer
  stopped reading. That is the confident falsehood this repository rules against — *"Containment is
  derived from git on each board invocation"* (2026-08-24) states the general form, and `finish`'s
  stage rule exists precisely so a status describes what happened rather than who was watching.

The half of the blocker that is real and additive — *"add the required composed `runFlow` test that
breaks after an early event"* — is merged into M-4, where it independently corroborates claude's
finding and, usefully, tells the test author why the naive version of that test will fail.

**Codex's channel major and claude's N-2 are one finding, taken at codex's severity.** Same site,
same fix; codex found a consequence claude did not weigh.

**Claude's three majors all survive at major.** Each was re-verified against the spike and the
landed code, not against the review's own account of itself.

**No round-1 finding reappears.** Claude's fourteen-row closure table was spot-checked on the two
that most affect this round — B-2's run-scoped gate ids (`engine.ts:112`, `:163`) and M-1's
cancellation observation (`:148`, `:190`, `:223`) — and both are as reported. Nothing ruled in
`solution/errata.md` E-1 to E-13 is reopened here.

---

## What a revise round can actually close

Stated because the split has repeatedly cost this ticket a round.

| Finding | Who can perform it |
| --- | --- |
| **M-1** | development revise round — `engine.ts` only, for the three-line `finishRun` shape. The `RunPersistence` capability variant needs an erratum first, on the E-13 precedent. |
| **M-2** | development revise round — `channel.ts` is owned. |
| **M-3** | **a ruling first**, then a development revise round for the code half, or an erratum alone if the clause is ruled unattainable. |
| **M-4** | a test file plus `qa/scenarios.md` — QA or hand, not a development task. |
| **N-1**, **N-3** (code half) | development revise round — `routing.ts` is owned. |
| **N-2** | a test file — QA or hand. |
| **N-3** (contract half), **N-4** | `solution/errata.md` — hand, at the gate. |

Three of the four majors and both remaining production nits are closable by a development revise
round; M-4 and N-2 are not, and a round that leaves them to the fan-out will spend money proving it
cannot write them.

## Verified this round, recorded so round 3 does not re-derive it

Read in `harness/Q-0050/integration` at `fd23acd` and in `spike/src/engine.js`: `finish` is
internally synchronous and emits its terminal event before returning (`lifecycle.ts:9-60`); the
spike finalises the manifest inside `finish` above the ticket write, the log line and `ui.info`
(`engine.js:626-651`); `replaceManifest`'s non-fatal catch warns through the host
(`writer.ts:289-306`) and `finalise` calls it non-fatally (`:393`); `ErrorCategory`'s `interrupted`
member has no producer in `core`; `askGate`'s auto and dry short-circuits precede the emitted
question but follow id allocation; `channel.ts`'s `abandon` sets neither `closed` nor `started`;
`lifecycle-routing.test.ts` carries three describes and no abandonment test; `engine.test.ts`
carries no `break` or `.return()`; `q0050.source.test.ts:66`'s alternation is
`process\.(stdout|stderr|exit|on|once)`; the spike's retry grant logs `set=${step.retryMax}` where
the port logs `Number(...)`. The suite was not executed — `runs.log` records it verified forced in
the integration worktree at `fd23acd` (21/21 tasks 0 cached, 890 passed / 2 skipped, spike 13/13),
and this is a read-only review.
