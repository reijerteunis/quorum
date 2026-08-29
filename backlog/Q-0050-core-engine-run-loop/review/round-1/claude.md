# Review — Q-0050 `core/engine`, the run loop, routing and the event stream

*Round 1 · code-reviewer (claude) · read-only · 2026-08-29*

## What I read, and against what

Every production file in the diff was read against its original in `spike/src/engine.js` — `runFlow`
(`:37-174`), `runStep` (`:176-198`), `handleFail` (`:539-555`), `runGate` (`:557-616`), `finish`
(`:618-653`), `outcome` (`:655-657`), `recordEvent` (`:659-664`), and the helpers at `:727-760` —
and against the landed siblings it now composes with: `packages/core/src/lint/lint.ts`,
`packages/core/src/fanout/fanout.ts`, `packages/core/src/backlog/backlog.ts`,
`packages/core/src/run-history/{writer,manifest}.ts`, `packages/shared/src/role.ts` and
`packages/shared/src/step-output.ts`.

`solution/errata.md` E-1 to E-9 was read first, so that nothing ruled at a gate is reopened here. In
particular I do **not** report: `docs/03-adapter-contract.md` being untouched (struck by E-5(c) and
E-9), the eight struck scenarios (E-8), the absent `mergeFailure` test (E-5(a)), AC-12e having no test
(E-5(b)), or `lifecycle-routing.contract.md:72`'s stale `(harnessDir, name)` prose (E-5(d)). The
landed decision *"What a run's event stream carries, and how a gate answer travels back"*
(2026-08-28) is treated as binding.

**The design half is right and is not in question.** The lazy single-consumer channel, the lossless
FIFO, terminal-then-throw, the out-of-band `answerGate` callback, caller-owned `AbortSignal`,
`Object.create(backlog)` for dry, the nested status-discriminated terminal member, and the refusal of
timestamps all match the decision entry clause for clause. The findings below are about the
translation layer underneath it.

Fourteen findings: **2 blockers, 8 majors, 4 nits.**

---

## Blockers

### B-1 — `writesOf` drops `output.writes` whenever `output.write` is present

`packages/core/src/engine/loaders.ts:51-55`

```ts
/** The step's output paths: singular `output.write` is preferred over plural `output.writes`. */
export function writesOf(step: Readonly<Record<string, unknown>>): readonly string[] {
  const output = (step.output ?? {}) as { write?: string; writes?: readonly string[] };
  return output.write ? [output.write] : (output.writes ?? []);
}
```

The spike **concatenates**; it does not choose:

```js
// spike/src/engine.js:739
export function writesOf(step) { const o = step.output ?? {}; return [...(o.write ? [o.write] : []), ...(o.writes ?? [])]; }
```

So does the ported lint that landed with Q-0044, in the same package, with the rule spelled out in its
JSDoc — *"`output.write` first, then `output.writes` in order"* (`packages/core/src/lint/lint.ts:82-86`)
— and so does a landed comment in `shared`, which cites the spike line by number:
*"`writesOf` takes `write` and `writes` (spike/src/engine.js:739)"*
(`packages/shared/src/step-output.ts:33`).

**Impact.** For a step declaring both, `runAgentStep` (Q-0052) will write one artifact and silently
skip the rest, `schemaFor` will still require a `document`, and `lint`'s producer/ownership map
(`lint.ts:221`) will believe files are produced that nothing writes — the cross-vendor and
single-owner rules are computed from a set the engine no longer honours. No shipped flow declares
both today (`grep` over `harness/flows/**` and `spike/templates/harness/flows/**` finds only `writes:`),
so nothing is failing now; the failure mode when it arrives is a missing file and no message, which
is the shape `.claude/rules/engineering.md` names as *"never default silently"*.

This is a behaviour change, not a translation, and charter §2 gives this ticket exactly one
authorised behaviour change, spent on the stream. The requirement's own wording — *"Singular
`output.write` before plural `output.writes`"* (AC-11) — reads naturally as ordering, which is what
the spike does; it was read as precedence.

**It is also now pinned.** `packages/core/src/engine/loaders.test.ts:46-47` asserts
`writesOf({ output: { write: 'one', writes: ['two'] } })` is `['one']`, so the red phase locked in the
changed behaviour and a later fix has to delete an assertion rather than add one.

**Recommendation.** Restore the concatenation verbatim from `engine.js:739`, correct the JSDoc on
`:51` (which currently states the wrong rule), and change `loaders.test.ts:46-47` to expect
`['one', 'two']` with a third case proving order. If precedence is genuinely wanted, it needs its own
dated decision entry accepted first and a coordinated change with `lint.ts:82-86` and
`step-output.ts:33` — which is a different ticket.

### B-2 — `gateId` is not unique within a run, so the stale-answer refusal does not hold

`packages/core/src/engine/routing.ts:6-12`, with `packages/core/src/engine/engine.ts:163`

```ts
const gateSequences = new WeakMap<RoutingContext, number>();

function nextGateId(context: RoutingContext): string {
  const sequence = (gateSequences.get(context) ?? 0) + 1;
  gateSequences.set(context, sequence);
  return `${context.runId}:${sequence}`;
}
```

The sequence is keyed on the context **object identity**, and `engine.ts` builds a fresh context
object on every pass of the step loop:

```ts
// engine.ts:163
const stepContext: EngineContext = { ...context, emit: withStepId(emit, stepId) };
const result: StepResult = await runStep(step, stepContext);
```

`nextGateId` is called from `runStep:92` and `handleFail:131`, both with that per-step copy. So the
counter resets at every step: **every step's first gate is `<runId>:1`**. Two gates in different steps
of one run carry the same id, and — worse — a step re-entered by a backward edge gets a *new* context
object, so round 2's exhaustion gate re-uses round 1's id exactly.

**Impact.** `askGate:78-80` refuses an answer whose `gateId` does not match the pending question. That
refusal is the whole mechanism, and the decision entry states it as a property of the design:
*"validates the returned opaque `gateId` … a stale or mismatched id … fails the run naming the gate
rather than inventing a decision."* Requirement AC-4(3) says the same: *"a stale, duplicate or
answer-for-another-gate value is refused explicitly rather than applied."* With ids colliding, an
answer queued or replayed for an earlier gate passes validation at a later one and is acted on. The
scenario that matters is precisely M3's: a browser answers a gate, the socket redelivers, the run has
moved on, and the redelivered `advance` satisfies the next gate silently. `askGate` even logs it as a
legitimate answer (`routing.ts:81`) before acting.

The contract states the requirement in as many words: *"`gateId`: opaque, unique within one run"*
(`contracts/Q-0050/run-events.contract.md`).

**Recommendation.** Allocate the sequence from run-scoped state rather than object identity — a
mutable counter on the run context that `engine.ts` creates once and the per-step spread carries by
reference (an object like `{ n: 0 }`, or a closure supplied as a `nextGateId` capability on
`RoutingContext`, which also matches how every other capability on that seam is injected). Then add
the assertion that would have caught this: two gates in one run, in different steps, have different
ids — and a gate re-entered by a backward edge does not repeat the first round's id.

---

## Majors

### M-1 — a failed run's active occurrences are recorded as `interrupted`, with the truncated message

`packages/core/src/engine/engine.ts:113-117`

```ts
finaliseActiveOccurrences: (status, cause) => {
  if (!history) return;
  for (const occurrence of active) history.terminal(occurrence, status, { error: { category: 'interrupted', message: cause } });
  active.clear();
},
```

The spike derives the category from the occurrence and passes the whole error:

```js
// spike/src/engine.js:161-166
terminalOccurrence(ctx, occurrence, 'failed', { error: { category: occurrence.kind === 'integrate' ? 'integrate' : occurrence.kind === 'script' ? 'script' : 'unknown', message: String(e.message ?? e) } });
```

`ErrorCategory` (`packages/core/src/run-history/manifest.ts:48-49`) admits all eight values precisely
so callers like this one can record their own; the port hard-codes one of them for both statuses.
`cause` is `note ?? status` from `lifecycle.ts:19`, i.e. the first line truncated to 200 characters
(`engine.ts:71-74`), not the full message.

**Impact.** Requirement AC-5 states this one as preserved-exactly: *"active occurrences finalised
`failed` with their category"*. Every occurrence of a failed run will be categorised `interrupted` in
`run-manifest.json`, so the per-category roll-up that run history exists to produce is wrong for the
one status a reader most wants to group by, and a script or integrate failure becomes
indistinguishable from a Ctrl-C. `active` is never populated by this ticket (occurrence allocation is
Q-0052's and Q-0053's), so nothing is wrong on disk today — the defect lands the day Q-0052 allocates
its first occurrence, with no test in either ticket looking at it.

**Recommendation.** Widen the capability so the caller supplies the category — either
`finaliseActiveOccurrences(status, cause)` deriving it from `occurrence.kind` inside the loop, as the
spike does, or an explicit `ErrorCategory` parameter — and pass the full error text rather than the
truncated terminal note, which is a separate string with a separate purpose. Q-0052 should not have to
discover this.

### M-2 — the step loop never observes cancellation, so an abandoned run can complete and move the stage

`packages/core/src/engine/engine.ts:158-191`

The `while (i < steps.length)` loop reads `signal` nowhere. The only place the signal is consulted is
`askGate` (`routing.ts:28`, `:53-58`). `engine.ts:193` then reads `signal.aborted` **only inside the
catch**, to choose the status of an error that has already been thrown.

**Impact.** The decision entry says *"Iterator `return()` cancels active work and awaits
interrupted-run persistence"*, and AC-5 says *"An abandoned run does not continue unobserved."* What
the port actually guarantees is narrower: abandonment is observed if and only if the run happens to be
suspended at a gate. Abort between steps, or during any step that does not itself watch the signal,
and the loop proceeds to the next step, runs it, and — if the flow then ends normally — reaches
`finishRun(flow.produces, 'completed')` at `:191`. A consumer that broke out of its `for await` gets a
run that advanced the ticket's stage, wrote a `completed` history entry and skipped the rollback
because `completed` is a rollback-exempt status. `runFlow`'s `finaliseAbandonment` (`:219-222`) then
awaits `settle`, so `return()` also blocks for the full remaining run rather than for the cancellation
it asked for.

This is not something a later ticket can add on its behalf: the loop is Q-0050's, and the stage move
is Q-0050's. E-8 struck AC-5b's *test* on the grounds that a cancellable step belongs to Q-0052; it
did not licence the loop to have no cancellation point of its own.

**Recommendation.** Check the signal once per iteration, before dispatching the next step, and throw
the same interruption error `askGate` throws so it lands on the existing catch and gets the existing
terminal record. One line and one test — abort mid-flow, assert the run ends `interrupted`, the stage
does not move, and the remaining steps did not run.

### M-3 — `recordEvent` is dead, its live twin is an untested copy, and calling the export would double-write

`packages/core/src/engine/lifecycle.ts:77-83` and `packages/core/src/engine/engine.ts:107-112`

`handleFail` does not call `lifecycle.recordEvent`; it calls the persistence capability directly
(`routing.ts:126`). `engine.ts` implements that capability by re-doing what `recordEvent` does:
pushing the history entry, writing the ticket and appending the `run=<id> exhausted stage=x→x cost=0`
line. `engine.ts` imports only `{ finish, outcome }` from `lifecycle.js`, so **`recordEvent` has no
production caller at all**.

Worse, the two are not merely redundant — they compose destructively. `recordEvent` pushes a history
entry (`:78-79`), then calls `persistence.recordOccurrenceEvent` (`:80`), which under the real
implementation pushes a *second* entry and writes a *second* log line, after which `recordEvent` writes
the ticket and appends a *third* line. Anyone wiring the documented lifecycle export to the real
persistence gets two `exhausted` entries in frontmatter and two log lines per exhaustion.

`lifecycle.test.ts:96-102` passes because it supplies `recordOccurrenceEvent: vi.fn()` — the collaborator
that would expose the duplication is stubbed out. The live code path's log format is asserted nowhere:
`lifecycle-routing.test.ts:107` only checks that the mock was *called* with the right arguments.

**Impact.** The tested implementation and the executed implementation are different code. AC-6's
*"`recordEvent` writes the `exhausted` history entry and log line before the question is asked"* is
green over a function no run reaches, and the one that runs has no coverage of its own format.

**Recommendation.** Pick one. Either `handleFail` calls `lifecycle.recordEvent` and
`RunPersistence.recordOccurrenceEvent` narrows to the run-history side only, or `recordEvent` is
deleted from `lifecycle.ts` and its test moved onto the composed path. Whichever survives should be
the one `lifecycle.test.ts` asserts the exact line against, and it should be asserted through
`engine.ts` at least once so the fixture's `log.recordEvent` key has a subject.

### M-4 — `loadRole` declares a return type it knowingly does not return

`packages/core/src/engine/loaders.ts:32-45`

```ts
export function loadRole(name: string | null | undefined, harnessDir: string): Role {
  if (!name) return { meta: {}, body: '' } as unknown as Role;
  ...
  return parseFrontmatter(fs.readFileSync(file, 'utf8')) as unknown as Role;
}
```

`Role` is a role file's **frontmatter** — `{ adapter?, model?, paths? }` (`packages/shared/src/role.ts:11-36`).
What this returns is the `{ meta, body }` wrapper. The JSDoc says so plainly and then ships anyway:
*"The two shapes do not structurally overlap, so the boundary is bridged through `unknown` rather than
asserted directly. Flagged for the contract to name the wrapper type explicitly instead of `Role`."*

**Impact.** Two `as unknown as` casts exist solely to defeat the compiler's correct complaint, which is
the same evasion `.claude/rules/engineering.md` bans under `any` and `@ts-ignore`. Every caller
inherits a false type: `resolveModel` (`engine.js:668-675`, Q-0052) reads `role.meta?.adapter` and
`buildPrompt` (`engine.js:709`) reads `role.body`, neither of which exists on `Role`, so Q-0052 will
either cast again or change this signature on its first day — which is exactly the cost E-2 refused to
accept for `writeFile`. The knowledge that the contract is wrong was in hand and went into a comment
instead of `solution/errata.md`, where E-5(d) shows the route existed.

**Recommendation.** Declare the honest return type — the frontmatter wrapper `parseFrontmatter`
actually produces, which `backlog.ts:62` already names — and drop both casts. If that means the
contract file and `run-flow-api.contract.ts:28` disagree, that is an erratum, not a cast.

### M-5 — four of the seven owned message sites are compared to nothing, and the scenario table says otherwise

`packages/core/src/engine/engine.test.ts:8, 59, 68, 153`

`contracts/Q-0050/run-messages.fixture.json` is imported in exactly one file and three of its keys are
used: `runBanner`, `terminalInfo`, `crossFlowRegression`. Grepping the engine test folder for the
remaining owned strings returns nothing:

| fixture key | spike site | asserted |
| --- | --- | --- |
| `runBanner` | `:67` | ✅ `engine.test.ts:59` |
| `crossFlowRegression` | `:146` | ✅ `engine.test.ts:153` |
| `terminalInfo` | `:651` | ✅ `engine.test.ts:68` |
| `loopIteration` | `:545` | ❌ nowhere |
| `loopExhausted` | `:548` | ❌ nowhere |
| `exhaustionReason` / `gate` | `:550-554`, `:574` | ❌ only `{kind, retry}` shape, never the reason text |
| `rollback` | `:644` | ❌ nowhere |
| `gateAutoAdvanced`, `gateDryRun` | `:559-560` | ❌ nowhere |
| `log.start`, `log.terminal`, `log.rollback` | `:68`, `:649`, `:646` | ❌ nowhere (`lifecycle.test.ts:79` matches a `run=7 <status> stage=` prefix only) |

`qa/scenarios.md:51` records AC-2a as *"`engine.test.ts` — 7-site fixture equality | all 7 owned keys."*
That is three of seven, and E-4 exists precisely because an oracle that calls itself single while
missing strings is *"a check that skips its subject must not report success"* (2026-08-25) inside a
fixture. The same erratum's remedy — add the keys — landed without anything asserting them.

Also unasserted: **nothing validates an emitted event against `shared`'s union.** No file under
`packages/core` imports `eventSchema`, so AC-2's *"Every yielded value passes `shared`'s strict
run-event schema"* has no test. `events.q0050.test.ts` validates hand-written literals, not what
`runFlow` produces.

**Impact.** AC-2 is the criterion that makes the rewrite invisible from the terminal — *"same lines,
same order"* — and it is verified for under half its subject. The four unchecked warns are the ones a
human reads when a loop is burning budget.

**Recommendation.** Assert `loopIteration`, `loopExhausted` and `exhaustionReason` against the fixture
in `lifecycle-routing.test.ts` (`handleFail` already emits them into a collector there — the assertion
is one line each), assert `rollback` in `lifecycle.test.ts`'s rollback matrix, assert the two gate
`info` texts, and pipe one composed run's events through `eventSchema.parse` in `engine.test.ts`.
Then correct `qa/scenarios.md:51` to what is actually covered.

### M-6 — the `completed` finish moved inside the run `try`, creating a second terminal event

`packages/core/src/engine/engine.ts:191-196`

```ts
    await finishRun(flow.produces, 'completed', null);
  } catch (error) {
    const status: RunStatus = signal.aborted ? 'interrupted' : 'failed';
    await finishRun(ticket.meta.stage, status, failureMessage(error));
    throw error;
  }
```

In the spike, the completed finish is deliberately outside:

```js
  } catch (e) { … finish(ctx, ticket.meta.stage, 'failed', …); throw e;
  } finally { … }
  return finish(ctx, flow.produces, 'completed');   // engine.js:174
```

**Impact.** Anything `finish` or `history.finalise` can throw on the success path — `writeTicket`,
`appendLog`, the manifest replace — now re-enters the catch and runs `finish` a second time. That
appends a second history entry, writes a second terminal `runs.log` line, and emits a **second terminal
event**, against AC-3's *"one per run, always last"* and the decision entry's *"every normal terminal
status is the stream's final event."* The same is true of the `regressed` and `aborted` finishes at
`:172` and `:186`, but those are inside the try in the spike too and are preserved; the `completed`
one is new.

**Recommendation.** Move the completed finish out of the try (mirroring `engine.js:174`), or guard
`finishRun` so it is idempotent per run. The first is preservation and needs no argument.

### M-7 — two filesystem/path additions the spike does not make, both shaped by the test's synthetic records

`packages/core/src/engine/engine.ts:85-88` and `:148`

```ts
// A ticket created through Backlog.create() already has its folder; a run built directly over a
// ticket record (the daemon's shape) does not. Idempotent, and skipped under dry so a preview
// creates nothing on disk.
if (!dry) fs.mkdirSync(ticket.dir, { recursive: true });
```

```ts
flowFile: flow.file ?? path.join(harnessDir, 'flows', `${flow.name}.yaml`)
```

Neither exists in the spike. `runFlow` there assumes the ticket folder exists — it always does, because
every ticket is read from disk (`backlog.ts:121-126`) — and `initialiseRunHistory` records
`ctx.flow.file`, which `loadFlow` always sets (`loaders.ts:16-21`). Both additions exist because
`engine.test.ts:19-31` hand-builds a `TicketRecord` and a `Flow` literal that have neither.

**Impact.** The engine now **creates a directory from caller-supplied input** rather than failing on a
ticket that is not there — in a package whose sibling `dirOf` already accepts a traversing argument
(Q-0059, open), and in the module M3's server will drive from a ticket id arriving over HTTP. The
comment justifies it by a caller that does not exist yet, which is the definition of a change charter
§2 does not authorise. The `flowFile` fallback fabricates a path into the persisted manifest for a flow
that was never at that path, which is the *"invents a path"* prohibition AC-11 applies to `writesOf`
arriving one function over.

**Recommendation.** Delete both and give the test a real ticket folder and a real flow file —
`test/repo.ts`'s `repo()` and `write()` already do exactly this two lines above, and `loadFlow` is in
the same folder. If the daemon's shape genuinely needs a folder created, that is a decision about who
owns ticket-folder creation and belongs in Q-0039/M3, not in a spread of the port.

### M-8 — the JSDoc guard cannot fail, and it is already passing over a violation

`packages/core/src/engine/q0050.source.test.ts:26`

```ts
for (const name of production) expect(source(name), name).toMatch(/\/\*\*[\s\S]*?export /);
```

This asserts that *somewhere* in each file a `/**` precedes *some* `export`. A module header plus one
export satisfies it, whatever the other exports look like. AC-1 requires *"JSDoc on every export and
non-obvious interface field."*

It is already green over a real violation: `packages/core/src/engine/channel.ts:32`,
`export function createEventChannel`, has no JSDoc — the nearest comment above it is `PendingPull`'s,
which documents a different, private symbol. `createEventChannel` is the module's only export and the
seam `engine.ts` composes the whole stream over.

**Impact.** *"A check that skips its subject must not report success"* (2026-08-25) is a decision in
this repository, and this is the shape it names — a guard that reports on a criterion it cannot
measure. The immediate cost is one undocumented export; the durable cost is that AC-1's JSDoc rule is
unenforced for every file Q-0051–Q-0053 add to this folder.

**Recommendation.** Anchor the check per export — for each `^export (function|const|class|interface|type)`
line, require a `*/` on the preceding non-blank line — and demonstrate it failing over `channel.ts` as
it stands before trusting it over the fixed tree. Then add the JSDoc to `createEventChannel`.

---

## Nits

### N-1 — the author-gate retry path drops the spike's null guard and can persist `undefined: NaN`

`packages/core/src/engine/routing.ts:98-103`. The spike writes the counter only when it exists —
`if (step.retryCounter != null) ctx.counters[step.retryCounter] = step.retryMax;` (`engine.js:583`).
The port writes unconditionally, so a step carrying `retryTarget` without `retryCounter` sets
`counters['undefined'] = NaN`, and `finish` persists that into `ticket.meta.iterations` — a permanent
garbage key in frontmatter, plus a log line reading `counter=undefined set=NaN`. Unreachable from
shipped flows (only synthesised exhaustion gates carry these fields, and `handleFail:135-141` supplies
all three), which is why it is a nit rather than more. Restore the guard.

### N-2 — three branches the scenarios name are not exercised

`packages/core/src/engine/lifecycle-routing.test.ts:88-113`. AC-6a specifies *"a two-iteration loop with
an explicit `counter: review` key"*, and every fixture omits `counter:`, so `handleFail:117`'s
`typeof failure.counter === 'string'` branch — the one that makes `review.yaml` bound an edge across
two flows — never runs. AC-6c's *"`--auto` walks the author-declared human gate"* is likewise untested:
the test covers `dry`, `kind: 'auto'` and `auto` + `human-locked`, but never `auto: true` with
`kind: 'human'`, which is the `--auto` clause itself (`routing.ts:20`). AC-7b's *"the next failure
re-presents the gate"* is claimed in the table and has no second `handleFail` call. Three short
additions to an existing file.

### N-3 — `finish` throws a bare `Error` where the spike cannot throw

`packages/core/src/engine/lifecycle.ts:86-89`. `requiredRegressionFields` throws
`new Error('regressed run requires complete regression fields')`; the spike spreads `fields = {}` and
never throws (`engine.js:618`, `:653`). QA flagged this for a ruling in a comment at
`lifecycle.test.ts:100-105`, so here it is: keep the check — AC-3's closed union is worth a runtime
backstop where the channel crosses a process boundary — but throw the workspace's single `FlowError`
(already re-exported at `types.ts:13`) rather than a bare `Error`, so it reaches a consumer as a
sentence like every other engine failure, and carry a one-line authority naming it as a deliberate
addition rather than preservation.

### N-4 — "single-consumer" is asserted in prose and enforced nowhere

`packages/core/src/engine/channel.ts:88-92`. `[Symbol.asyncIterator]()` returns a fresh wrapper over the
same `next`, and `next` stores one `pending` slot: a second `for await` silently splits the stream
between two consumers, and two concurrent `next()` calls orphan the first promise forever. The contract
says *"One iterator instance supports one consumer"*; a `throw` on the second
`[Symbol.asyncIterator]()` call and on a re-entrant `next()` makes that provable in three lines, and
turns a silent hang into a named error.

---

## Verified and correct

Worth recording, so a later round does not re-derive it: the counter arithmetic and increment-before-compare
(`routing.ts:117-127`), the exhaustion gate synthesised as `human-locked` with its three retry fields,
`retry` setting only its own counter to `max_iterations`, `advance` changing none, the cross-flow
regression deriving its stage from the target flow's `consumes` with `remaining` clamped and the target
flow not run, `finish`'s two-status stage rule with counters persisted for all five, the four-guard
rollback and its absence for task branches, the `Object.create` dry view with all three writers stubbed
and both preserved in-memory mutations asserted positively, the preserved `parallel`-dispatches-as-agent
defect asserted as a pair, the preserved unknown-goto `TypeError`, the preserved `signalWindow` timer
with its authority line, `loadFlowByName`'s deliberate `ENOENT`, `loadFlow` linting before returning,
`loadRole`'s exact message, `interpolate`'s flat-key/leave-literal behaviour and `reviewRound`'s
verdict-gated count — all match the spike line for line. `docs/GLOSSARY.md` and `docs/04-architecture.md`
carry every clause of the decision entry and cite it by title and date; `docs/04-architecture.md:41`
already named `runFlow(opts): AsyncIterable<Event>` and needed no change. The turbo input declarations
and `READ_BASES` entries are correct and their over-declaration is reasoned in place.
