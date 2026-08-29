# Verdict — Q-0050 `core/engine`, the run loop, routing and the event stream

*Round 1 · panel verdict · read-only · 2026-08-29 · reviewers: claude (14 findings), codex (7 findings)*

**Verdict: `changes-requested`.** Two blockers and eight majors survive deduplication; five nits are
recorded rather than dropped.

## How this verdict was reached

Every finding on both lists was re-verified against `harness/Q-0050/integration` and, where the claim
was about preservation, against `spike/src/engine.js` — not accepted from the review text.
`solution/errata.md` E-1 to E-9 was read first, so nothing ruled at a gate is reopened, and one
codex finding is struck by E-5(c)/E-9 for exactly that reason.

Sixteen reported items became fifteen: four are the same defect found twice and are merged with both
reviewers' evidence preserved, one is struck, and one survives only in reduced form.

| Panel finding | Disposition |
| --- | --- |
| claude B-1 `writesOf` | **blocker**, confirmed |
| claude B-2 + codex 1 — gate id | **merged, blocker** (codex rated it major; escalated, reasoned below) |
| claude M-2 + codex 2 — cancellation | **merged, major** |
| claude M-3 + codex 5 — `recordEvent` | **merged, major** |
| claude M-1 + codex 3 — active occurrences | **merged, major** |
| claude M-6, M-7, M-4, M-5, M-8 | **major**, each confirmed |
| claude N-1, N-2, N-3 | **nit**, confirmed |
| claude N-4 + codex 6 — single consumer | **merged, nit** (codex rated it major; downgraded, reasoned below) |
| codex 4 — wrap failures in `FlowError` | **reduced to a nit against the contract**, not the code |
| codex 7 — `docs/03-adapter-contract.md` | **struck** by E-5(c) and E-9 |

---

## Blockers

### B-1 — `writesOf` drops `output.writes` whenever `output.write` is present

`packages/core/src/engine/loaders.ts:52`, pinned by `packages/core/src/engine/loaders.test.ts:47`

The port chooses; every other statement of this rule in the repository concatenates.

```ts
// loaders.ts:52-55
return output.write ? [output.write] : (output.writes ?? []);
```
```js
// spike/src/engine.js:739
return [...(o.write ? [o.write] : []), ...(o.writes ?? [])];
```

Verified in three more places, all landed and all disagreeing with the port:
`packages/core/src/lint/lint.ts:82-85` concatenates, with the rule in its JSDoc — *"`output.write`
first, then `output.writes` in order"*; `packages/shared/src/step-output.ts:33` cites the spike line
by number — *"`writesOf` takes `write` and `writes` (spike/src/engine.js:739)"*; and
`contracts/Q-0050/run-flow-api.contract.ts` declares only the signature, not the rule.

**Impact.** A step declaring both writes one artifact and silently skips the rest, while `lint`'s
producer/ownership map (`lint.ts`) still believes both are produced — so the single-owner and
cross-vendor rules are computed over a set the engine no longer honours. No shipped flow declares
both today, so nothing fails now; the failure mode when it arrives is a missing file and no message,
which is what `.claude/rules/engineering.md` means by *never default silently*.

This is a behaviour change, and charter §2 gives this ticket exactly one, spent on the stream.

**Why it is a blocker and not a major:** it is already pinned. `loaders.test.ts:47` asserts
`writesOf({ output: { write: 'one', writes: ['two'] } })` is `['one']`, so the red phase locked the
deviation in and a correction has to *delete an assertion*, not add one. Left as it is, the port's
behaviour becomes the repository's oracle by default.

**Origin, which decides the route.** AC-11's wording — *"`writesOf` returns `output.write` before
`output.writes`"* — reads naturally as ordering, which is what the spike does; qa-red read it as
precedence and wrote the pin, and the implementer complied with the pin. So neither the implement
task nor a revise round can close this: the remedy is one line in `loaders.ts`, one JSDoc correction
at `:51`, and an edit to a test file no development task may write. **It needs an erratum naming
AC-11's reading and a hand or QA-side change**, on the E-5(d) precedent.

### B-2 — gate ids repeat once per step, so the stale-answer refusal cannot fire

`packages/core/src/engine/routing.ts:6`, with `packages/core/src/engine/engine.ts:163`
*(claude B-2; codex 1 — same defect, same remedy)*

```ts
const gateSequences = new WeakMap<RoutingContext, number>();
```

The sequence is keyed on **object identity**, and the step loop builds a fresh context every pass:

```ts
// engine.ts:163
const stepContext: EngineContext = { ...context, emit: withStepId(emit, stepId) };
const result: StepResult = await runStep(step, stepContext);
```

So every step's first gate is `<runId>:1`. Two gate steps in one flow collide; a step re-entered by a
backward edge gets a new object and repeats the earlier round's id exactly.

**Impact.** `routing.ts:47` refuses an answer whose `gateId` does not match the pending question —
that refusal is the entire correlation mechanism. AC-4(3) requires *"a stale, duplicate or
answer-for-another-gate value is refused explicitly rather than applied"*, and
`contracts/Q-0050/run-events.contract.md:13` states the property in as many words: *"`gateId`:
opaque, unique within one run"*. With ids colliding, an answer queued or redelivered for an earlier
gate validates at a later one, is logged as legitimate (`routing.ts:50`) and is acted on. That is
M3's ordinary case: a browser answers, the socket redelivers, the run has moved on.

**Escalated from codex's major to blocker.** The gate is the product's human control point and the
one place `core` is required to refuse rather than infer; a silently misapplied human decision is
the failure this correlation exists to prevent. Both reviewers agree on the mechanism; only the
severity differed.

**Remedy.** Allocate from run-scoped state — a counter object created once in `engine.ts` and
carried by reference through the per-step spread, or a `nextGateId` capability injected on
`RoutingContext` like every other seam there. Then assert what would have caught it: two gates in one
run, in different steps, have different ids, and a re-entered step does not repeat round 1's.

---

## Majors

### M-1 — the step loop never observes cancellation, so an abandoned run can complete and move the stage

`packages/core/src/engine/engine.ts:158`, with `packages/core/src/engine/channel.ts:85`
*(claude M-2; codex 2)*

The `while (i < steps.length)` loop reads `signal` nowhere. The only consumer is `askGate`
(`routing.ts:28`, `:38`); `engine.ts:193` reads `signal.aborted` **only inside the catch**, to label
an error that has already been thrown.

Verified consequence, following the code rather than the claim: `channel.ts:84-87`'s `abandon()`
calls `finaliseAbandonment`, which aborts the controller and then **awaits `settle`** — the whole
remaining run. Since the loop never checks the signal, `settle` resolves only when the flow ends
normally, at which point `engine.ts:191` reaches `finishRun(flow.produces, 'completed')`. So a
consumer that `break`s gets a run that advanced the ticket's stage, wrote a `completed` history
entry, skipped the rollback (a rollback-exempt status), and blocked its own `return()` for the full
duration. Codex adds the cheaper instance: an already-aborted signal runs the entire flow.

AC-5 requires *"An abandoned run does not continue unobserved"* and that abandonment be recorded
`interrupted`. What ships is narrower: abandonment is observed only if the run happens to be
suspended at a gate.

E-8 struck AC-5b's *test* because a cancellable step belongs to Q-0052. It did not licence the loop
to have no cancellation point of its own — the loop and the stage move are both this ticket's.

**Remedy.** Check the signal once per iteration, before dispatching, and throw the same interruption
error `askGate` throws so it lands on the existing catch and gets the existing terminal record.

### M-2 — `recordEvent` is dead, and calling it with the real persistence double-writes

`packages/core/src/engine/lifecycle.ts:80`, with `packages/core/src/engine/engine.ts:107`
*(claude M-3; codex 5)*

Verified by grep over the branch: `recordEvent` appears in `lifecycle.ts` and `lifecycle.test.ts` and
nowhere else. `handleFail` calls `context.persistence.recordOccurrenceEvent` directly
(`routing.ts:128`), and `engine.ts:107-112` implements that capability by doing what `recordEvent`
does — pushing the history entry, writing the ticket and appending the `run=<id> exhausted
stage=x→x cost=0` line.

The two compose destructively. `recordEvent` pushes an entry (`:79`), calls
`persistence.recordOccurrenceEvent` (`:80`) — which pushes a **second** entry and writes a **second**
log line — then writes the ticket and appends a **third**. It is a contracted export
(`run-flow-api.contract.ts`) that cannot be used with the shipped persistence implementation.

`lifecycle.test.ts:69` passes because it supplies `recordOccurrenceEvent: vi.fn()` — the collaborator
that exposes the duplication is stubbed. The executed path's log format is asserted nowhere;
`lifecycle-routing.test.ts:95` only checks the mock was called with the right arguments.

So AC-6's *"`recordEvent` writes the `exhausted` history entry and log line before the question is
asked"* is green over a function no run reaches, and the function that does run has no format
coverage. **Pick one owner for the mutation and make the other delegate**, then assert the exact line
through the composed path at least once.

### M-3 — every occurrence of a failed run is categorised `interrupted`, with the truncated message, and none is ever registered

`packages/core/src/engine/engine.ts:115`, with `:98` *(claude M-1; codex 3 — merged, same site)*

```ts
for (const occurrence of active) history.terminal(occurrence, status, { error: { category: 'interrupted', message: cause } });
```

The spike derives the category from the occurrence and passes the whole error:

```js
// spike/src/engine.js:161-166
terminalOccurrence(ctx, occurrence, 'failed', { error: { category: occurrence.kind === 'integrate' ? 'integrate' : occurrence.kind === 'script' ? 'script' : 'unknown', message: String(e.message ?? e) } });
```

`ErrorCategory` (`packages/core/src/run-history/manifest.ts`) admits all eight values so callers can
record their own; the port hard-codes one for both statuses. `cause` is `note ?? status`
(`lifecycle.ts:19`), the first line truncated to 200 characters — a terminal note, not the error.
AC-5 states this one as preserved exactly: *"active occurrences finalised `failed` with their
category"*.

Codex's half of the same site: `active` is never populated and neither the context nor
`RunPersistence` exposes registration, so the finaliser is currently a no-op and a later ticket has
no seam to join. That half is milder than codex rates it — occurrence allocation is explicitly
Q-0052's and Q-0053's, and those tickets extend this folder — but it belongs to the same remedy:
whoever widens the capability to carry a category should add registration at the same time, so
Q-0052 does not discover both.

Nothing is wrong on disk today. The defect lands the day Q-0052 allocates its first occurrence, with
no test in either ticket looking at it.

### M-4 — the `completed` finish moved inside the run `try`, so a success-path throw emits a second terminal event

`packages/core/src/engine/engine.ts:191` *(claude M-6)*

Verified against the spike: the completed finish is deliberately **outside** the try/catch —
`spike/src/engine.js:174`, after the `finally`, while the `regressed` and `aborted` finishes are
inside in both trees and are correctly preserved.

```ts
    await finishRun(flow.produces, 'completed', null);
  } catch (error) {
    const status: RunStatus = signal.aborted ? 'interrupted' : 'failed';
    await finishRun(ticket.meta.stage, status, failureMessage(error));
    throw error;
  }
```

Anything `finish` or `history.finalise` can throw on the success path — `writeTicket`, `appendLog`,
the manifest replace — now re-enters the catch and finishes a second time: a second history entry, a
second terminal `runs.log` line, and a **second terminal event**, against AC-3's *"one per run,
always last"*.

**Remedy.** Move it out of the try, mirroring `engine.js:174`. That is preservation and needs no
argument; making `finishRun` idempotent is the alternative and needs one.

### M-5 — two filesystem/path additions the spike does not make

`packages/core/src/engine/engine.ts:88` and `:148` *(claude M-7)*

```ts
if (!dry) fs.mkdirSync(ticket.dir, { recursive: true });
...
flowFile: flow.file ?? path.join(harnessDir, 'flows', `${flow.name}.yaml`)
```

Neither exists in the spike — confirmed by reading `runFlow` end to end. `loadFlow` always sets
`flow.file` (`loaders.ts:18`), and every ticket is read from disk, so both branches are unreachable
for real callers and exist because `engine.test.ts:19-31` hand-builds a `TicketRecord` and a `Flow`
literal that have neither.

The engine now **creates a directory from caller-supplied input** where the spike fails — in a
package whose sibling `dirOf` already accepts a traversing argument (Q-0059, open), and in the module
M3's server will drive from a ticket id arriving over HTTP. The comment justifies it by a caller that
does not exist yet. The `flowFile` fallback fabricates a path into the persisted manifest for a flow
that was never at it — the *"invents a path"* prohibition AC-11 applies to `writesOf`, one function
over.

**Remedy.** Delete both; give the test a real ticket folder and a real flow file — `test/repo.ts`'s
`repo()` and `write()` are already used two lines above, and `loadFlow` is in the same folder. If the
daemon's shape genuinely needs a folder created, that is a decision about who owns ticket-folder
creation and belongs with Q-0039/M3.

### M-6 — `loadRole` declares a return type it documents as wrong, bridged by two `unknown` casts

`packages/core/src/engine/loaders.ts:39` *(claude M-4)*

```ts
export function loadRole(name: string | null | undefined, harnessDir: string): Role {
  if (!name) return { meta: {}, body: '' } as unknown as Role;
  ...
  return parseFrontmatter(fs.readFileSync(file, 'utf8')) as unknown as Role;
}
```

`Role` is a role file's frontmatter (`packages/shared/src/role.ts`); what is returned is the
`{ meta, body }` wrapper. The JSDoc at `:28-37` says so and ships anyway. Two `as unknown as` casts
exist solely to defeat a correct compiler complaint, which is the evasion
`.claude/rules/engineering.md` bans under `any` and `@ts-ignore`, and every caller inherits the false
type: `resolveModel` reads `role.meta?.adapter` and `buildPrompt` reads `role.body`
(`engine.js:668-675`, `:709`), neither of which exists on `Role`, so Q-0052 casts again on its first
day.

An honest type is already exported and importable from the owned file: `parseFrontmatter` returns
`Frontmatter` (`packages/core/src/backlog/backlog.ts:62`).

**Route.** `contracts/Q-0050/run-flow-api.contract.ts:26` declares the `Role` return, and no task owns
`contracts/**` — so the implementer followed a contract that is wrong, which is the right handling of
an unwritable surface, but the knowledge went into a comment instead of an erratum, where E-5(d) had
just shown the route. **This needs an erratum correcting the contract plus the type change in
`loaders.ts`.**

### M-7 — the single message oracle is asserted for three of its keys, and nothing validates an emitted event

`packages/core/src/engine/engine.test.ts:8`, with `backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:51`
*(claude M-5)*

Verified by grep: `contracts/Q-0050/run-messages.fixture.json` is imported in one file and three keys
are used — `runBanner` (`:59`), `terminalInfo` (`:68`), `crossFlowRegression` (`:153`).

| fixture key | asserted |
| --- | --- |
| `runBanner`, `terminalInfo`, `crossFlowRegression` | ✅ |
| `loopIteration`, `loopExhausted` | ❌ nowhere — `lifecycle-routing.test.ts:81-86` asserts the returned decision, never the warn text |
| `exhaustionReason`, `gate` | ❌ only `{ kind, retry }` shape (`lifecycle-routing.test.ts:95`), never the reason text |
| `rollback`, `gateAutoAdvanced`, `gateDryRun`, `log.start`, `log.recordEvent`, `log.rollback` | ❌ nowhere (`log.retryGrant` is matched as a hard-coded literal, not through the fixture) |

`qa/scenarios.md:51` records AC-2a as *"`engine.test.ts` — 7-site fixture equality | all 7 owned
keys."* That is three. E-4 added four of these strings to the fixture *because* an oracle that calls
itself single while missing them is *"a check that skips its subject must not report success"*
(2026-08-25) — and they landed with nothing asserting them.

Also unasserted: **no file under `packages/core` imports `eventSchema`**. AC-2's *"Every yielded value
passes `shared`'s strict run-event schema"* has no test; `packages/shared/src/events.q0050.test.ts`
validates hand-written literals, not what `runFlow` produces.

The four unchecked warns are the ones a human reads while a loop is burning budget, and AC-2 is the
criterion that makes the rewrite invisible from the terminal. **Remedy:** assert `loopIteration`,
`loopExhausted` and `exhaustionReason` in `lifecycle-routing.test.ts` (the collector is already
there — one line each), `rollback` in `lifecycle.test.ts`, the two gate `info` texts, pipe one
composed run through `eventSchema.parse`, and correct `scenarios.md:51` to what is covered.

### M-8 — the JSDoc guard cannot fail, and it is already green over a violation

`packages/core/src/engine/q0050.source.test.ts:26`, with `packages/core/src/engine/channel.ts:32`
*(claude M-8)*

```ts
for (const name of production) expect(source(name), name).toMatch(/\/\*\*[\s\S]*?export /);
```

This asserts only that *somewhere* in each file a `/**` precedes *some* `export`; a module header plus
one export satisfies it whatever the other exports look like. AC-1 requires *"JSDoc on every export
and non-obvious interface field."*

Confirmed green over a real violation: `channel.ts:32`, `export function createEventChannel`, has no
JSDoc — the nearest comment above it documents the private `PendingPull`. It is the module's only
export and the seam `engine.ts` composes the whole stream over.

The immediate cost is one undocumented export; the durable cost is that AC-1's JSDoc rule is
unenforced for every file Q-0051–Q-0053 add to this folder. **Anchor the check per export** — for
each `^export (function|const|class|interface|type)`, require a `*/` on the preceding non-blank
line — **and demonstrate it failing over `channel.ts` as it stands** before trusting it over the
fixed tree.

---

## Nits

### N-1 — the author-gate retry path drops the spike's null guard and can persist `undefined: NaN`

`packages/core/src/engine/routing.ts:99`. The spike writes the counter only when it exists —
`if (step.retryCounter != null) ctx.counters[step.retryCounter] = step.retryMax;`
(`spike/src/engine.js:586`). The port writes unconditionally, so a step carrying `retryTarget`
without `retryCounter` sets `counters['undefined'] = NaN`, which `finish` then persists into
`ticket.meta.iterations` — a permanent garbage key in frontmatter. Unreachable from shipped flows
(only synthesised exhaustion gates carry these fields, and `handleFail:130-134` supplies all three),
which is why it is a nit. Restore the guard.

### N-2 — three branches the scenarios name are not exercised

`packages/core/src/engine/lifecycle-routing.test.ts:88`. Confirmed by reading the fixtures: every
`on_fail` omits `counter:`, so `routing.ts:116`'s `typeof failure.counter === 'string'` branch — the
one that makes `review.yaml` bound an edge across two flows — never runs. AC-6c's *"`--auto` walks
the author-declared human gate"* is likewise untested: `:61-64` covers `dry`, `kind: 'auto'` and
`auto` + `human-locked`, but never `auto: true` with `kind: 'human'`, which is the `--auto` clause
itself (`routing.ts:20`). AC-7b's *"the next failure re-presents the gate"* is claimed in the table
and has no second `handleFail` call. Three short additions to an existing file.

### N-3 — `finish` throws a bare `Error` where the spike cannot throw

`packages/core/src/engine/lifecycle.ts:87`. `requiredRegressionFields` throws
`new Error('regressed run requires complete regression fields')`; the spike spreads `fields = {}` and
never throws. Keep the check — AC-3's closed union is worth a runtime backstop where the channel
crosses a process boundary — but throw the workspace's `FlowError` (already re-exported at
`types.ts`) so it reaches a consumer as a sentence like every other engine failure, and carry a
one-line authority naming it as a deliberate addition rather than preservation.

### N-4 — "single-consumer" is asserted in prose and enforced nowhere

`packages/core/src/engine/channel.ts:95` *(claude N-4; codex 6 — merged)*. `[Symbol.asyncIterator]()`
returns a fresh wrapper over the same `next`, and `next` stores one `pending` slot: a second
`for await` splits the stream between two consumers, and two concurrent `next()` calls orphan the
first promise forever.

**Downgraded from codex's major.** The constraint is stated in
`contracts/Q-0050/run-events.contract.md`, no shipped consumer violates it, and reaching it requires
caller misuse rather than any specified path — `for await` calls `[Symbol.asyncIterator]()` once and
never re-enters `next()`. It stays a finding because the failure is a silent hang rather than a named
error, which *"errors are explicit"* argues against, and a `throw` on the second iterator and on a
re-entrant pull makes the documented constraint provable in three lines.

### N-5 — the events contract promises a `FlowError` the requirement forbids

`contracts/Q-0050/run-events.contract.md:78` — *"the next pull after that value rejects with
`FlowError`; the failure cause is non-empty."* `engine.ts:195` rethrows the original value instead.

*This is what remains of codex finding 4, and the code is right.* AC-11 preserves `loadFlowByName`'s
raw `ENOENT` as *"the one loader that does not produce a `FlowError`"*, AC-12 preserves the unknown-goto
`TypeError`, and E-8 wrote the test that pins it: `engine.test.ts` — *"AC-12d — a goto naming no step
throws a raw TypeError, not a FlowError"* — asserts `expect(error).toBeInstanceOf(TypeError)` on the
iterator's rejection. Wrapping ordinary failures would fail a landed acceptance test and close two
preserved defects in passing, which charter §2 forbids. **The contract sentence is what should
change**, by erratum, before a later ticket cites it against this code.

---

## Struck

**codex 7 — `docs/03-adapter-contract.md:38` was not updated.** Struck. `solution/errata.md` **E-5(c)**
removed that document from AC-13b before implementation started, measured: it contains neither
`runFlow` nor "event stream", so the criterion as written required it to *acquire* run-loop prose
rather than have any claim corrected. **E-9** then removed it from `q0050-documentation`'s ownership
in `tasks.yaml`. Writing it would have contradicted a landed ruling.

Worth carrying to the gate rather than only recording: the codex reviewer could not have known.
`harness/flows/review.yaml` names no errata input — E-9 measured that only `qa-red.yaml` and
`chore.yaml` read `solution/errata.md` — so on this route **the two stages that write code and the
stage that reviews it are the three that cannot read a ruling.** E-9 declined to fix it because
changing `harness/flows/` is not this ticket's. This verdict is the second instance in two days and
belongs in the evidence for that change.

---

## Verified and correct — recorded so round 2 does not re-derive it

The design half is not in question and matches the landed decision *"What a run's event stream
carries, and how a gate answer travels back"* (2026-08-28) clause for clause: the lazy
single-consumer channel, the lossless FIFO with drain-before-close, terminal-then-throw, the
out-of-band `answerGate`, caller-owned `AbortSignal` with no `process.on` and no `process.exit`,
`Object.create(backlog)` for dry with all three writers stubbed, the nested status-discriminated
terminal member, and the refusal of timestamps.

Also re-read and correct against the spike: the counter arithmetic and increment-before-compare
(`routing.ts:119-125`); the exhaustion gate synthesised as `human-locked` with its three retry
fields; `retry` setting only its own counter to `max_iterations` and `advance` changing none;
`retry` at an author gate with no target falling through to `abort`; cross-flow regression deriving
its stage from the target flow's `consumes`, clamping `remaining`, and not running the target;
`finish`'s two-status stage rule with counters persisted for all five; the four-guard rollback and
the deliberate absence of task-branch rollback; the preserved `parallel`-dispatches-as-agent defect
asserted as a pair, which is the right shape for a negative assertion; the preserved unknown-goto
`TypeError`; the preserved `signalWindow` timer with its authority line; `loadFlow` linting before
returning and `loadFlowByName`'s deliberate `ENOENT`; `loadRole`'s exact message; `interpolate`'s
flat-key/leave-literal behaviour; and `reviewRound`'s verdict-gated count.

## What a revise round can actually close

Stated because four of these findings land outside the fan-out's write paths, and a loop spending its
budget on work no agent in it can perform is this project's most repeated failure.

| Finding | Who can perform it |
| --- | --- |
| B-2, M-1, M-2, M-3, M-4, M-5, N-1, N-3, and `channel.ts`'s missing JSDoc | a development revise round — all in owned production files |
| **B-1** | source fix is owned; the pin at `loaders.test.ts:47` and AC-11's reading are not — **erratum first** |
| **M-6** | `loaders.ts` is owned; the contract declaring `Role` is not — **erratum first** |
| **M-7**, **M-8**'s guard, **N-2** | test files, which development tasks may not modify — QA or hand |
| **N-5** | `contracts/**`, which no task owns — erratum |
