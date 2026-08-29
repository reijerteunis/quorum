# Review — Q-0050: `core/engine`, the run loop, routing and the event stream

*Round 2 · claude · read-only · 2026-08-29 · reviewed at `harness/Q-0050/integration` (`fd23acd`), against `main`*

**Three majors, three nits, no blockers.** None of the six is a round-1 item.

## How this review was performed

Round 1 raised two blockers and eight majors, and the fix round closed all fourteen findings by
hand. *"A reviewer approves the change it asked for"* (`docs/DECISIONS.md`, 2026-08-29) is this
ticket's own lesson and it applies to me first, so:

- Every round-1 finding was re-verified **against `spike/src/engine.js`**, not against the fix
  round's account of itself. The closure table below is that verification, recorded so round 3 does
  not re-derive it.
- The six findings reported here were found by re-reading `finish`, `runGate` and the signal path
  in the spike and comparing them with the ported code **as it now stands** — not by re-checking
  round 1's list. Two of the three majors are in code the fix round wrote.
- `solution/errata.md` E-1 to E-13 was read first. Nothing ruled at a gate is reopened: `writesOf`
  (E-10), `loadRole`'s return type (E-11), the unwrapped terminal rejection (E-12), the two new
  context capabilities (E-13), the struck `docs/03-adapter-contract.md` (E-5(c)/E-9) and the eight
  struck scenarios (E-8) are all treated as settled.
- I did not execute the suite. `runs.log` records it verified forced in the integration worktree at
  `fd23acd` — 21/21 tasks 0 cached, 890 passed / 2 skipped, spike 13/13 — and this is a read-only
  review.

---

## Majors

### M-1 — the manifest is finalised *after* the terminal event, so a persist failure emits a `warn` after the run's last event

`packages/core/src/engine/engine.ts:152-156`, against `spike/src/engine.js:625-651`

```ts
async function finishRun(stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome> {
  const result = await finish(context, stage, status, note, fields);
  if (history) history.finalise(status, result.stage);
  return result;
}
```

`finish` emits the terminal `info` line (`lifecycle.ts:45`) and the `terminal` event
(`lifecycle.ts:54`) and appends the terminal `runs.log` line (`lifecycle.ts:41`) **before** it
returns. Only then does `finishRun` write the manifest.

The spike does the opposite, and deliberately: `finish` finalises the manifest at `:625-632`,
between the stage assignment and the ticket-history push, so `replaceManifest` has already run by
the time `backlog.write` (`:648`), the terminal log line (`:649`) and `ui.info` (`:651`) execute.
The port inverted that order when it moved manifest finalisation out of `finish` and into
`engine.ts`'s `finishRun` seam.

**Two consequences, and the first is a stated criterion.**

`RunHistory.finalise` calls `replaceManifest()` non-fatally, and a failed write reports through the
host: `host.warn(\`could not persist run history at ${target}: …\`)`
(`packages/core/src/run-history/writer.ts`, the `replaceManifest` catch). `engine.ts:180` wires that
host to `warn: (message) => emit({ type: 'warn', message })`. So a manifest write that fails at
finalise time — a full disk, a removed `.quorum/runs`, a permissions change mid-run — emits a
`warn` **after** the `terminal` event. AC-3 requires the terminal outcome to be *"one per run,
always last"*, and `contracts/Q-0050/run-events.contract.md` repeats it: *"One terminal event is
produced for every terminal status and is the last value."* In the spike that warn reached the
terminal at `:426`/`:632`, ahead of `:651`'s terminal line; here it reaches the stream behind the
event that says the run is over.

Second, and this is the one M3 meets on an ordinary run: a consumer told `{type:'terminal',
status:'completed'}` over the WebSocket and reading `.quorum/runs/<id>/run-manifest.json` in
response sees `status: "running"`, `ended_at: null` and no `rollup`. Q-0049's own JSDoc calls a
manifest carrying `running` beside a terminal record *"the lifecycle contradiction this subsystem
exists to make impossible"*. The port does not create that contradiction on disk — the manifest is
finalised a tick later — but it creates a window in which the stream and the durable record
disagree, and the whole point of AC-3's terminal event is that a consumer may act on it.

**Nothing is wrong on disk today.** Q-0050 emits no adapter events and the window is
sub-millisecond in-process. It becomes reachable the day a socket sits between the emitter and the
reader, which is M3.

**Remedy, and it is three lines in the file that owns the seam.** `finalise` takes its stage
explicitly, so `finishRun` can compute it and finalise before delegating, mirroring the spike's
order without moving the stage rule into two places being a problem — it is already stated once in
`finish`:

```ts
async function finishRun(stage, status, note, fields) {
  const stageAfter = status === 'completed' || status === 'regressed' ? stage : ticket.meta.stage;
  if (history) history.finalise(status, stageAfter);
  return finish(context, stage, status, note, fields);
}
```

The alternative — a `finaliseManifest(status, stageAfter)` capability on `RunPersistence`, called
from inside `finish` immediately after the stage assignment — is the closer transcription of
`engine.js:625` and is the shape I would prefer if the duplicated stage rule is judged a smell. It
amends `contracts/Q-0050/run-flow-api.contract.ts:13` additively, which **E-13 has already
established the route for**, so either fix is available to a revise round; only the second needs an
erratum.

### M-2 — the `interrupted` record is not the spike's, in its note and in its occurrence category, and no erratum rules on it

`packages/core/src/engine/engine.ts:148-150`, `:225-229` and `:53-57`, against `spike/src/engine.js:57-64`

AC-5 states the interrupted case as preservation, in as many words: *"The persisted record is
byte-identical to today's (`interrupted`, note `received SIGINT`)."* The spike's signal handler is
what "today" means:

```js
// spike/src/engine.js:58-61
for (const occurrence of ctx.activeOccurrences ?? []) terminalOccurrence(ctx, occurrence, 'interrupted', { error: { category: 'interrupted', message: `received ${sig}` } });
finish(ctx, ticket.meta.stage, 'interrupted', `received ${sig}`);
```

The port merged the spike's two entry points — the run catch (`failed`, category derived, message
in full) and the signal handler (`interrupted`, category `interrupted`, message `received <sig>`) —
into one catch, and then applied the *catch's* treatment to both:

```ts
// engine.ts:225-229
const status: RunStatus = signal.aborted ? 'interrupted' : 'failed';
await persistence.finaliseActiveOccurrences(status, occurrenceMessage(error));
await finishRun(ticket.meta.stage, status, failureMessage(error));
```

So an interrupted run persists:

| field | spike | port |
| --- | --- | --- |
| `runs.log` `error=` | `"received SIGINT"` | `"run #1 (requirements) interrupted"` (`engine.ts:149`) or `"gate human (approve to continue) interrupted"` (`routing.ts:7`) |
| occurrence `error.category` | `interrupted` | `integrate` / `script` / `unknown` (`engine.ts:53-57`) |
| occurrence `error.message` | `received SIGINT` | the thrown `FlowError`'s text |

The note now depends on **where** the run happened to be cancelled, which is not something a reader
of `runs.log` can use, and `ErrorCategory`'s `'interrupted'` member — whose declaring JSDoc at
`packages/core/src/run-history/manifest.ts:43-45` names *"a signal"* as one of the five categories
*"written by callers this module does not own"* — now has **no producer anywhere in `core`**.

**This is not the M-3 fix overshooting.** Round 1 was right that deriving the category from the
occurrence is correct on the *failed* path; the defect is that the same derivation was applied to
the *interrupted* path, where the spike does not derive.

**Why it is a major and not a nit.** `core` deliberately no longer knows about signals (AC-5, and
the accepted decision), so it genuinely cannot write `received SIGINT` on its own — which means one
of two things must happen and neither has:

- **The caller supplies it.** `AbortController.abort(reason)` is the standard mechanism and
  `AbortSignal.reason` is read nowhere in this folder. Using it where it is a string, and falling
  back to the synthesised text otherwise, restores the byte-identity AC-5 asked for and gives
  Q-0010 the seam it needs to write `received SIGINT` when it installs the handler. The occurrence
  half is one line: pass `'interrupted'` as the category when `status === 'interrupted'`.
- **Or the clause is ruled unattainable**, in `solution/errata.md`, naming what the interrupted
  record carries instead. AC-5's byte-identity clause then stops being a criterion a later reader
  can cite against this code.

What may not happen is the current state: a stated preservation clause silently unmet, in the one
status the requirement singled out, with the divergence visible only by reading two trees side by
side. That is precisely the shape AC-12 exists to prevent — *"an unstated answer is what lets the
next reader assume the question was considered"* — arriving on a criterion AC-12 does not cover.

The occurrence half is latent (Q-0050 allocates no occurrence, per E-13); the `runs.log` half is
live now and is exercised by `engine.test.ts:141`, which asserts the terminal status and stage and
reads no note.

### M-3 — the abandonment path is recorded as covered and is tested only against a stub

`backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:63`, with `packages/core/src/engine/channel.test.ts` and `packages/core/src/engine/engine.test.ts`

The requirement calls this the ticket's own new failure mode, in its Problem section: *"One safety
property breaks silently under the new interface, and the interface is what breaks it… This path
does not exist in the spike; the port creates it, so it is specified here rather than discovered in
review."* AC-5's third bullet requires an abandoned run to be recorded `interrupted` with the same
record as any other early stop. Round 1's M-1 found it broken — a `break` completed the run and
moved the stage — and the fix is correct: `throwIfInterrupted` (`engine.ts:148-150`, `:190`,
`:223`) now observes `abandonment.abort()` through the combined signal at `engine.ts:250`.

**Nothing tests the composition.** The two halves are tested separately and the join is not:

- `channel.test.ts:60` — *"return awaits abandonment finalisation"* — drives `iterator.return()`
  against a **hand-written `finalise`** that resolves a test-controlled promise. It proves the
  channel waits; it proves nothing about what `runFlow`'s `finaliseAbandonment`
  (`engine.ts:259-262`) does.
- `engine.test.ts:141` — *"a run cancelled between steps"* — drives the **caller-supplied
  `signal`**, never `return()`.

So the path from `for await … break` to an `interrupted` terminal record — abort the internal
controller, have the loop notice, finalise occurrences, persist counters, write the terminal
`runs.log` line, resolve `return()` only then — is asserted nowhere.

**And it is recorded as covered.** `qa/scenarios.md:63` reads
`| AC-5c/5d | q0050-lifecycle, q0050-event-channel | lifecycle-routing.test.ts, channel.test.ts — abandonment | — |`,
with an empty gap column. `lifecycle-routing.test.ts` contains no abandonment test at all — its
three describes are AC-4 gate behaviour, AC-6/7/8 failure routing, and AC-12c. That table is the
same document whose AC-2a row was corrected in this round to name its six uncovered fixture keys
honestly; this row was not given the same treatment, so the one criterion whose failure mode the
port *invents* reads as covered.

This is *"a check that skips its subject must not report success"* (2026-08-25) at the level of the
coverage record rather than of an assertion, and round-1 M-1 is the evidence for why it matters:
the defect was found by reading, not by a test, and a regression would be silent again.

**Remedy.** One test in `engine.test.ts`, using the fixture that already exists there — iterate
`runFlow(withGates().opts)`, `break` after the banner, then assert `opts.ticket.meta.stage` is
unchanged, that the last history entry is `interrupted`, and that the terminal `runs.log` line was
appended before `return()` resolved. If the join is judged untestable for a reason I have not seen,
`scenarios.md:63` should say so in its gap column, as `:51` now does.

**Who can perform it:** a test file, so QA or hand — not a development revise round.

---

## Nits

### N-1 — the author-gate retry log line writes `set=NaN` where the spike writes `set=undefined`

`packages/core/src/engine/routing.ts:92` and `:97`

Round 1's N-1 restored the spike's null guard on the counter *write* (`:96`) and left the two
values it is computed from unguarded:

```ts
const counter = String(step.retryCounter);   // "undefined"
const limit = Number(step.retryMax);         // NaN
if (step.retryCounter != null) context.counters[counter] = limit;
context.persistence.appendLog(context.ticket, `run=… gate=retry counter=${counter} set=${limit} …`);
```

The spike interpolates the raw values (`spike/src/engine.js:587`), so it logs
`counter=undefined set=undefined`; the port logs `counter=undefined set=NaN`, and returns
`{ goto, counter: 'undefined', limit: NaN }` to the cursor. Reachable only from a hand-written flow
that puts `retryTarget` on a `gate:` step — `lintFlow` knows nothing about `retryTarget`, since it
is synthesised rather than authored, so such a flow lints clean. No shipped flow does it, the
counter write is correctly guarded, and the only casualty is one garbage log line, which is why
this is a nit and not the second half of a major. Compute `limit` inside the guard, or interpolate
`step.retryMax` directly as the spike does.

### N-2 — after `return()`, a further `next()` yields buffered events instead of `{ done: true }`

`packages/core/src/engine/channel.ts:99-113`

`abandon()` awaits `finalise` and resolves `{ done: true }` without closing the channel, and `next`
(`:86`) has no abandoned check. Events emitted **during** finalisation — the rollback `warn`, the
terminal `info`, the `terminal` event itself — are still in the FIFO, so a consumer that calls
`next()` after `return()` receives them. The iterator protocol says a returned iterator is done.

No shipped consumer does this: `for await` calls `return()` exactly once and never pulls again, and
`contracts/Q-0050/run-events.contract.md` states outright that an abandoning consumer *"cannot
observe the terminal event it caused"* — which the current code makes untrue for a manual consumer
and true only by convention for a `for await` one. That is the same silent-misuse shape round 1
made a nit of in N-4 and the fix round closed for the two-consumer and re-entrant-pull cases; this
is the third case, and it closes the same way — set a flag in `abandon`/`abandonWithError` and have
`next` resolve `{ done: true }` once it is set. Three lines beside the two guards already there.

### N-3 — the no-signal-subscription guard names three subscription APIs and misses three more

`packages/core/src/engine/q0050.source.test.ts:66`

```ts
expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once)|\[/);
```

AC-5 requires *"a source-text assertion that `process.exit` and any `process.on`/`process.once`
signal subscription appear nowhere"*, and the guard transcribes those two names literally.
`process.addListener`, `process.prependListener` and `process.prependOnceListener` are the same
subscription and pass it. The rule this guard exists to hold is *"a library that exits the process
cannot host M3's daemon"*, and it will govern every file Q-0051–Q-0053 add to this folder, so the
alternation is worth widening now — `process\.(stdout|stderr|exit|(?:prepend)?(?:once)?[aA]ddListener|on|once)` or
simply `process\.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)`.
This is the *"a guard has a subject proves the guard fires, not that each of its clauses does"*
lesson from Q-0071 pointed at a clause that does not exist rather than one that never runs.

**Who can perform it:** a test file — QA or hand.

---

## Round 1's fourteen, re-verified closed

Recorded against the spike rather than against the fix round's own account, so round 3 does not
re-derive it and so that "closed" is a measurement.

| Round 1 | Where it landed | Verified |
| --- | --- | --- |
| **B-1** `writesOf` precedence | `loaders.ts:49`, five assertions at `loaders.test.ts`, E-10 | Concatenates, matching `spike/src/engine.js:739`, `lint.ts:84-87` and `step-output.ts:33`. The JSDoc is now `lint.ts`'s sentence verbatim. The pin that made the deviation load-bearing is gone, and both-keys / each-key-alone / neither are all asserted. |
| **B-2** colliding gate ids | `engine.ts:112`, `:163`; `types.ts` `nextGateId`; E-13 | Allocation is run-scoped and survives the per-step spread. `engine.test.ts:122` pins `['1:2','1:3']` — one step asked twice through its own retry target, which is the case a per-context counter cannot distinguish, and is the right regression test rather than a uniqueness test. |
| **M-1** loop never observes cancellation | `engine.ts:148-150`, `:190`, `:223` | Checked before every dispatch and after the loop, throwing so the existing catch writes the existing record. An already-aborted signal now stops at the first iteration. See M-3 above for what is still untested. |
| **M-2** `recordEvent` dead and double-writing | `engine.ts:124`, `lifecycle.ts:80-86` | The capability delegates; `lifecycle.ts` is the sole owner. Both directions are pinned — the composed path writes once (`lifecycle.test.ts`), and `recordEvent` does not re-enter the capability — and `q0050.source.test.ts:74-75` asserts the wiring is a delegation and not a second implementation, which is what makes the composed-path test a statement about shipped code. |
| **M-3** occurrence category / message / registration | `engine.ts:53-57`, `:81-83`, `:125`; E-13 | Category derived from `occurrence.kind` as `spike/src/engine.js:165` does; the message is the failure in full rather than the 200-character terminal note; `registerOccurrence` gives the finaliser something to close. Partially reopened by M-2 above, for the `interrupted` path only. |
| **M-4** `completed` finish inside the try | `engine.ts:236` | Outside the try, as `spike/src/engine.js:174` is, with the reason in a comment. No second terminal event. |
| **M-5** `mkdirSync` and the fabricated `flowFile` | `engine.ts:179`; `engine.test.ts:19-38` | Both deleted. The engine creates no directory from caller input and invents no path; the fixture now goes through `repo()`, `write()` and `loadFlow`, so `flow.file` is set the way every real caller sets it. |
| **M-6** `loadRole`'s false `Role` return | `loaders.ts:39`; E-11 | Returns `Frontmatter`; both `as unknown as` casts are gone; the contract was corrected by erratum rather than the knowledge being left in a comment. |
| **M-7** the oracle asserted for three keys | `lifecycle-routing.test.ts`, `lifecycle.test.ts`, `engine.test.ts:112`; `scenarios.md:51` | Eleven of eighteen strings now read through the fixture, including all four E-4 added; a composed run is piped through `eventSchema.parse`; and `scenarios.md:51` names the seven that are matched as literals or not at all rather than counting them as covered. The honesty half is the part that matters and it is done. |
| **M-8** the JSDoc guard could not fail | `q0050.source.test.ts:22-38`, `:49-56` | Anchored per export on the preceding non-blank line, with `export {` re-exports correctly excluded, and **demonstrated failing** over `channel.ts`'s stripped header before being trusted over the fixed tree. |
| **N-1** unguarded retry counter | `routing.ts:96` | Guarded. See N-1 above for the half that was not. |
| **N-2** three unexercised branches | `lifecycle-routing.test.ts` | An explicit `on_fail.counter` as a bare key, `auto: true` over an author-declared `human` gate, and a second `handleFail` proving `advance` changes no counter and the gate returns. |
| **N-3** bare `Error` in `requiredRegressionFields` | `lifecycle.ts:96` | Throws `FlowError` with a one-line authority naming it a deliberate addition rather than preservation. |
| **N-4** "single consumer" enforced nowhere | `channel.ts:87`, `:110-112` | A second `[Symbol.asyncIterator]()` and a re-entrant `next()` each throw by name, and the test proves the already-in-flight pull is **not** orphaned by the refusal — which is the half a bare "it throws" assertion would have missed. |
| **N-5** contract promised a `FlowError` | E-12 | The contract sentence corrected, not the code; the preserved `ENOENT` and `TypeError` reach the consumer as themselves and stay pinned. |

## Verified and correct — recorded so round 3 does not re-derive it

Re-read against the spike this round and unchanged since round 1's verdict said the same: the lazy
single-consumer channel with its lossless FIFO and drain-before-close; terminal-then-throw; the
out-of-band `answerGate` with correlation, stale-id refusal, missing-channel refusal by gate kind,
and the `runs.log` answer line written above the branch that acts on it; caller-owned `AbortSignal`
with no `process.on` and no `process.exit`; `Object.create(backlog)` with all three writers stubbed
and both dry-run defects pinned positively; the nested status-discriminated terminal member and the
refusal of timestamps; counter keying and increment-before-compare; the exhaustion gate synthesised
`human-locked` with its three retry fields and the `exhausted` entry written before the question;
`retry` setting only its own counter to `max_iterations`; `retry` at an author gate with no target
falling through to abort; cross-flow regression deriving its stage from the target's `consumes`,
clamping `remaining`, not running the target, and reading the stage before `finish` mutates it;
`finish`'s two-status stage rule with counters persisted for all five and the four-guard rollback;
the deliberate absence of task-branch rollback; the preserved `parallel`-dispatches-as-agent defect
asserted as a pair; the preserved unknown-goto `TypeError`; the preserved `signalWindow` with its
authority line; `loadFlow` linting before returning and `loadFlowByName`'s deliberate `ENOENT`;
`interpolate`'s flat-key behaviour; `reviewRound`'s verdict-gated count; and the two turbo input
declarations — the JSON fixture the guard structurally cannot see, and `harness/harness.yaml`,
declared with the reason it is declared even though the test writes its own.

The documentation half is correct and cites the accepted entry by title and date in both files.

## What a revise round can actually close

Stated because the split is what has repeatedly cost this ticket a round.

| Finding | Who can perform it |
| --- | --- |
| **M-1** | a development revise round — `engine.ts` only, if the three-line `finishRun` shape is taken. The `RunPersistence` capability shape needs an erratum first, on the E-13 precedent. |
| **M-2** | `engine.ts` is owned, so the code half is a revise round. **Which way it goes is a ruling** — restore byte-identity through `signal.reason`, or rule AC-5's clause unattainable in `solution/errata.md`. One or the other, at the gate. |
| **M-3**, **N-3** | test files, which development tasks may not modify — QA or hand. |
| **N-1**, **N-2** | a development revise round — both in owned production files. |
