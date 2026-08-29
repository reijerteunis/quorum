# Review — Q-0050 round 6

*claude · read-only · 2026-08-29 · read at `8a900eb`, against `spike/src/engine.js`,
`requirements/merged.md`, `solution/solution.md`, `solution/errata.md` E-1–E-21,
`contracts/Q-0050/**`, `qa/scenarios.md`, `docs/decisions/062-…` and `065-…`.*

**changes-requested — four majors and five nits. No blocker.**

## How this was performed

Round 5's four majors and four nits are closed, and I checked each against the code rather than
against the fix report: the three-case gate test is restored whole (`lifecycle-routing.test.ts:60`,
`:67`, `:101` — AC-4e and E-19's pin both have subjects again); the authority register is anchored on
`Why:` and throws on an unclassifiable line (`q0050.source.test.ts:65`, `:156`), covering thirteen
markers including `loaders.ts:3` and `lifecycle.ts:97`; the transcription scan reads every line and
unwraps paragraphs before splitting, with a fixture that only passes on a sentence absent from the
raw file (`:202`); and `types.ts:127`'s "a step receives this object itself" is pinned by
`engine.test.ts:455`. Nothing from rounds 1–5 is re-raised below.

`solution/errata.md` E-1–E-21 is treated as binding. I do **not** report: `writesOf`'s concatenation
(E-10, landed), `loadRole` returning `Frontmatter` (E-11), the unwrapped terminal rejection (E-12),
`interpolate`'s dropped `String()` (E-21), the gate id spent by an auto-advanced gate (E-17 and
decision 065), the rounded cost on the terminal event (E-18), the refused unparseable answer (E-19),
the seven-marker count (E-20), the eight struck scenarios (E-8), `step`/`done` (round 3's verdict,
ownership), or an abandonment arriving after a committed terminal status (E-15).

**I executed the suites rather than reading the tick**, in the working checkout at `8a900eb`:
`npx vitest run src/engine` — 6 files, **72 tests, all passing**; `npx tsc --noEmit -p packages/core`
exit 0; `npx eslint packages/core/src/engine packages/shared/src/events.ts` exit 0. Every finding
below is green today. Three of the four majors are things a green suite cannot see.

---

## Majors

### M-1 — step-id enrichment moved to the run loop, so every parallel member is stamped with the group's id — which both shipped panels leave undefined

`packages/core/src/engine/engine.ts:72-86`, `:145-146`, `:227`, with `packages/core/src/engine/routing.ts:63`

The spike stamps at the **adapter call site**, with the step actually running:

```js
// spike/src/engine.js:186   →  runAgentStep(s, ctx) for each MEMBER
const settled = await Promise.allSettled(step.parallel.map((s) => runAgentStep(s, ctx)));
// spike/src/engine.js:252   →  inside runAgentStep, `step` is that member
onEvent: (e) => ui.trace(step.id, e),
```

The port stamps in the **run loop**, from a single variable holding the top-level step:

```ts
// engine.ts:145-146
let stepId: string | null = null;
const stepEmit: EmitEvent = withStepId(emit, () => stepId);
// engine.ts:227
stepId = String(step.id);
```

Three consequences, and the first is live for the two flows this ticket is itself run under.

**A `parallel:` group carries no id, so the literal string `"undefined"` is stamped.** Verified in
the tree: `harness/flows/requirements.yaml:6` and `harness/flows/review.yaml:6` are both `- parallel:`
with the ids on the members beneath, which is how a group is written — the group is a container, not
a step. `String(undefined)` is `"undefined"`, so once Q-0052 emits anything, every `spawn`, `stdout`
and `retry` from `pm-claude` **and** `pm-codex` arrives as `stepId: "undefined"`, where the spike
carries `pm-claude` and `pm-codex`. `packages/shared/src/flow.ts`'s header already names this hazard
and enumerates its sites — *"an id-less step reaches both as the literal `undefined`"*, naming the
worktree branch (`engine.js:211`) and the loop counter (`:541`), which is Q-0055. This is a **third
site, and it is worse than the two Q-0055 owns**: those fire only when an author forgets an id, this
one fires on every shipped panel because the group correctly has none.

**A fan-out wave is stamped with the parent's id.** `spike/src/engine.js:951` synthesises
`tpl.id = \`${step.id}:{task.id}\`` per task and hands it to `runAgentStep`, so five concurrent tasks
carry five ids. Under the port they share one `stepId`, which holds the fan-out step's. M3's mission
control is *"parallel trace columns"* (`06-development-plan.md`, M3) and the fan-out is the reason
that screen exists; five columns cannot be derived from one id.

**And a later ticket cannot fix it in its own file**, which is what makes this Q-0050's rather than
Q-0053's. `withStepId` spreads last:

```ts
// engine.ts:80
emit({ ...event, stepId });
```

so an id a fan-out or panel supplies is **overwritten** by the loop's. `RunPersistence` and
`RoutingContext` expose no other emitter. Sharper still, the seam's type points the wrong way:
`EmitEvent` takes `Event` — the *run* event, whose `spawn`/`stdout`/`retry` members require
`stepId` — not `AdapterEvent`, which is what an adapter's `onEvent` produces. `engine.test.ts:445`
already has to write `as unknown as Event` to call it. So Q-0052 is typed into supplying a step id
and will have it silently discarded, which is E-11's cast problem arriving on the emitter.

Nothing is wrong on disk today: `runAgentStep` is a stub that rejects (`routing.ts:55`), so this
ticket emits no adapter event. AC-2b's test is struck by E-8 and E-8 says so in as many words —
*"step-id enrichment … enter[s] Q-0052 **unpinned**"* — but that strike was about a missing test,
not a licence for the mechanism to be unable to carry a member's id.

**Remedy.** Restore the spike's placement, or make it reachable: pass the step-scoped emitter to
`runStep` as a second argument — the third shape round 3's verdict offered and the one that does not
reopen the no-copy ruling — so `runStep`'s parallel branch and Q-0053's wave can each derive one per
member; or have `withStepId` preserve an existing `stepId` and type the sink `(event: AdapterEvent)`.
Either way one assertion says it: a `parallel:` group with **no** `id` whose two members each emit,
asserted to carry their own ids rather than `"undefined"`.

**Who can perform it:** a development revise round — `engine.ts` is `q0050-engine-compose`'s;
name `q0050-routing` and `q0050-engine-types` if the emitter is threaded or retyped.

---

### M-2 — `registerOccurrence` cannot be called by the ticket it was added for, so the seam it was meant to close is still open

`packages/core/src/engine/types.ts:89-97`, `packages/core/src/engine/engine.ts:159`

E-13 adds `RunPersistence.registerOccurrence(occurrence: Occurrence)` and states its purpose:

> *"Q-0050 allocates none … It exists because the finaliser without it is a permanent no-op, and a
> later ticket discovering that would have to widen the capability and add registration in the same
> round."*

An `Occurrence` is produced by exactly one thing: `RunHistory.allocate(step, kind, fields)`
(`packages/core/src/run-history/writer.ts:96`). The `RunHistory` handle is a **local** in `run()`
(`engine.ts:138`); it is on neither `RunContext`, `RoutingContext` nor `RunPersistence`. So there is
no path from a step to an `Occurrence`, and `registerOccurrence` cannot be reached by any caller
inside or outside this ticket. Grepped: its only appearances are the declaration, the implementation
and `lifecycle.test.ts:31`'s stub.

**Impact.** Q-0052 must widen `RunPersistence` on its first day regardless — it needs `allocate`,
`terminal` and `persistArtifact` (`spike/src/engine.js:245-246`, `:308`) — and once it has an
allocation capability the natural implementation adds the occurrence to `active` inside it, at which
point this member is deleted unread. So the round-1 M-3 remedy did not achieve the thing it was
accepted for, and the interface ships a member whose JSDoc asserts a property it does not have, in a
contract two later tickets code against. That is the shape E-11 named — a statement about a seam that
a reader has no reason to doubt and no way to check.

**Remedy, and it is a choice rather than a fix.** Either widen the seam now with the one capability
that makes registration usable (`allocateOccurrence(step, kind, fields): Occurrence`, registering as
it allocates, which also removes the two-call ordering hazard), or delete `registerOccurrence` and
record in `solution/errata.md` that occurrence allocation and registration land together in Q-0052 —
which is the honest version of what is true today. What may not stand is a member that documents a
guarantee it cannot provide.

**Who can perform it:** `types.ts` and `engine.ts` are owned, so the code half is a revise round;
which of the two options is taken is a ruling, and either way the E-13 entry needs a sentence.

---

### M-3 — AC-6's `vars.iter` clause is asserted nowhere in either direction, and `chore.yaml` interpolates it

`packages/core/src/engine/engine.ts:247` and `:251`

AC-6 states it as a preserved behaviour in as many words: *"`ctx.vars.iter` increments on the
intra-flow branch only (`:155`), never on the cross-flow one, which returns first."* The code is
**correct** — the cross-flow branch returns at `:247`, before the increment at `:251`, exactly as
`spike/src/engine.js` does. Nothing asserts it.

Measured: the string `iter` (as a word) does not appear in any of the six test files under
`packages/core/src/engine/`, and no scenario under `qa/scenarios.md`'s `## AC-6` names it — 6a–6e
are counters, the exhaustion gate, `--auto` and `advance`. So both halves of the clause are free:
an increment added to the cross-flow branch, or removed from the intra-flow one, is green everywhere.

**Why this one has money behind it rather than being tidiness.** `{iter}` is not decorative.
`harness/flows/chore.yaml:34` writes `review/chore-iter-{iter}.md`, so `vars.iter` is the only thing
keeping a chore revise round's review artifact from overwriting the previous round's — and the
failure mode is already a filed ticket, Q-0057, whose subject is precisely reviews overwriting each
other because `{iter}` is run-scoped. A regression here would reproduce an open defect's symptom
under a different cause, silently.

**And the fixtures already exist.** `engine.test.ts`'s `withGates()` drives a genuine intra-flow
goto (the `approve` gate's own retry target sends the cursor back), and `routeOnce({ goto:
'flow:development', … })` drives a cross-flow one. A `vi.spyOn(routing, 'runStep')` reading
`context.vars.iter` on each call closes both halves in one test — `[1, 2]` for the re-entered step,
and `1` unchanged for the regression.

**Who can perform it:** a test file plus the AC-6 rows — QA or hand, not a development revise round.

---

### M-4 — a failed run's terminal-event-then-throw is never asserted through `runFlow`; both composed failing tests discard their events

`packages/core/src/engine/engine.test.ts:389` and `:480`, with `channel.test.ts:30`

AC-3 is the criterion the whole interface change exists for: *"A failure **additionally** throws a
typed `FlowError` after its terminal event … a consumer reading only the stream can tell how a run
ended."* The two halves are tested apart and the join is not.

- `channel.test.ts:30` — *"yields the queued terminal, then throws the named error"* — drives a
  **hand-written sink**: the test emits the terminal event and calls `sink.complete(cause)` itself.
  It proves the channel drains before it rejects. It says nothing about whether `run()` emits a
  terminal event before rethrowing.
- The two composed tests that reach a `failed` status both throw their events away:
  `engine.test.ts:389` (AC-8c) and `:480` (AC-12d) are
  `await collect(stream(opts)).then(() => undefined, (cause) => cause)`, and `collect` accumulates
  into a local array it never returns on rejection. Both assert the message and, in AC-8c's case,
  the history entry — neither looks at the stream.

So of the five statuses, `completed`, `aborted`, `regressed` and `interrupted` each have
`expect(events.at(-1)).toMatchObject({ type: 'terminal', … })` at the composed level, and `failed`
— the one status where the event and the throw interact, and the only one where AC-3's *"additionally
throws"* clause has a subject — has none. `qa/scenarios.md:57`'s AC-3a row reads *"all five statuses
driven through `runFlow`"*, which is literally true of the statuses and reads as coverage of the
property.

A `finish` that stopped emitting before the rethrow, or a channel that rejected without draining,
would be green in both files. That is round 2's M-4 and round 3's M-4 in a new place: a claim whose
executable check is one seam short of its subject.

**Remedy.** Three lines in AC-8c: collect into an array declared outside the `try`, and assert
`events.at(-1)` is `{ type: 'terminal', status: 'failed' }` before asserting the rejection. The
behaviour is right — I traced it: `finish` emits at `lifecycle.ts:60`, `run` rethrows,
`sink.complete(error)` sets `closed`, and `next` checks `queue.length > 0` before `closed`
(`channel.ts:101-102`), so the terminal event is delivered first. It is the assertion that is
missing, on the criterion the port's one authorised behaviour change was spent on.

**Who can perform it:** a test file — QA or hand.

---

## Nits

### N-1 — a `toBeGreaterThanOrEqual` floor survives twenty-six lines above the register that replaced it

`packages/core/src/engine/q0050.source.test.ts:141`

```ts
expect((`${engine}\n${lifecycle}`.match(/Why: preserved defect, see Q-0050 AC-12\./g) ?? []).length)
  .toBeGreaterThanOrEqual(2);
```

`REGISTERED` at `:156` already pins `engine.ts` and `lifecycle.ts` as each carrying exactly one
`preserved defect/AC-12`, under `toStrictEqual` at `:167`, so this floor cannot fail unless the
register fails first. It is also the exact shape the same file's next test condemns in its own
comment — *"A register of identities, not a count. Q-0073's lesson — a floor passes while a site is
swapped out"* — and Q-0073's entry says it in as many words. Delete it, or keep the test name and
assert the two identities from `found`.

### N-2 — AC-13b's documentation guard checks for words, and a document stating the opposite passes it

`packages/shared/src/docs.test.ts:164`

`for (const token of ['terminal', 'answerGate', 'AbortSignal', 'timestamp', title, '2026-08-28'])
expect(body).toContain(token)`. Presence of a token is not the claim: a GLOSSARY entry reading *"every
event carries a **timestamp**"* satisfies it, as does one saying core installs its own handler while
mentioning `AbortSignal`. AC-13b's own wording is that the documents *state* the rules.

This is not hypothetical on this ticket. `docs/decisions/065-…` exists precisely because two
**statements** in 062 were false while every word in them was the right word, and the guard that was
supposed to keep the documents honest could not have seen it. One `toMatch` per rule against the
sentence rather than the noun — `/no (event )?(gains|carries) a timestamp/`, `/installs no process
signal handler/` — costs the same and can fail.

### N-3 — the glossary sends a reader to 062 with nothing pointing at its erratum

`docs/GLOSSARY.md:73`, with `docs/04-architecture.md:33`

065's own *Alternatives considered* states the reason it exists: *"`04-architecture.md` and
`GLOSSARY.md` cite 062 by title and date, so Q-0051 and M3 arrive at it and find two sentences
describing an engine that was never built, with nothing pointing away from them."* Both citations
still name 062 alone — `GLOSSARY.md:73` and principle 2's closing sentence at `04-architecture.md:33`.
Only `04-architecture.md`'s **status line** mentions *"and its 2026-08-29 erratum"*, which is the
paragraph a reader skips.

Half the gap the entry was written to close is still open, and the fix is four words in each
citation. Worth doing while the entry is a day old rather than after Q-0051 has cited it.

### N-4 — the two computed numbers on the terminal event are unguarded, and the schema check never sees a regressed terminal

`packages/core/src/engine/engine.ts:244-245`, with `packages/core/src/engine/engine.test.ts:119`

`count: context.counters[result.counter]` and `limit: result.limit` are the only fields on any event
that are neither literal nor derived from a validated string. `count` is an unchecked index (so
`undefined` for a counter never charged) and `limit` reaches `handleFail` as `Number(failure.max_iterations)`
(so `NaN` for a flow lint has not rejected). `runTerminalEventSchema` declares both `z.number()`,
which rejects `NaN` and `undefined` — so either value produces an event that fails the union AC-2
promises every yielded value satisfies. Both are unreachable through `routing.ts`, which always
charges the counter and which lint requires `max_iterations` for, which is why this is a nit.

What makes it worth a line is the second half: AC-2's schema assertion at `engine.test.ts:119` runs
over `withGates()` alone, which emits `info`, `gate`, `info` and a `completed` terminal. **No test
ever passes a `regressed` terminal through `eventSchema.parse`** — the one member with a nested
discriminated union, the seven-field group AC-3 spent its design on, and the only member whose fields
are computed. One `eventSchema.parse(events.at(-1)!)` in the AC-8b test covers it and passes today.

### N-5 — a test titled "is lazy" asserts everything except laziness

`packages/core/src/engine/engine.test.ts:91`

*"is lazy, emits the exact banner, and ends in one terminal event"*. The banner and the terminal
event are asserted; laziness is not. The `stream()` helper at `:75` catches only a **synchronous
throw** from `runFlow`, so an eager implementation that ran the whole flow before returning would
satisfy it — every assertion in the test is made after `collect` has drained the stream anyway.

The property is genuinely covered one level down (`channel.test.ts:23`'s `expect(start).not.toHaveBeenCalled()`),
so nothing is unguarded; what is wrong is the title, which is round 3's Nit 3 in a new test. Either
assert it here — construct the iterable, `expect(fs.existsSync(runsLog)).toBe(false)`, then pull —
or drop the clause from the name.

---

## Verified and correct — recorded so round 7 does not re-derive it

Read against the spike and confirmed unchanged or correctly ported: `finish`'s stage rule, counter
persistence for all five statuses, the history push after the manifest finalisation, the four-guard
rollback and both its message formats (`spike/src/engine.js:618-653`); `outcome`'s `run` key and
duplicated `stage`/`stage_after` (`:656`); `recordEvent` as the sole owner of its four writes
(`:659-664`), with both directions of the delegation pinned; `handleFail`'s counter key,
increment-before-compare, exhaustion synthesis as `human-locked` and the `exhausted` record written
before the question (`:539-555`); `askGate`'s auto/dry short-circuits, the answer log written above
the branch that acts on it, and the one-traversal retry grant with its guard and its raw
`step.retryMax` (`:557-591`); the completed `finish` outside the try as `:174` is; the cross-flow
branch returning before the `vars.iter` increment and deriving its stage from the target's `consumes`
with `remaining` clamped and the target never run; `steps.findIndex() === -1` still reaching a raw
`TypeError`; `runStep`'s `allSettled` with its survivors message; the `Object.create` dry view with
all three writers stubbed and both preserved in-memory mutations asserted positively; `loadFlow`
linting before returning and `loadFlowByName`'s deliberate `ENOENT`; `loadRole`'s exact message;
`interpolate`'s flat-key behaviour; `reviewRound`'s verdict-gated count; `writesOf`'s concatenation
now agreeing with `lint.ts` and `step-output.ts`.

Also checked: the channel's latch, `detachPending`, the refusal of a second iterator and a re-entrant
pull, and that an already-in-flight pull is settled `{ done: true }` before finalisation emits;
`interruptionNote` reading `AbortSignal.reason` and falling back cleanly when the abandonment
controller aborts without one; `categoryOf` deriving on the failed path and writing `interrupted`
flat on the interrupted one, so `ErrorCategory`'s `interrupted` member has a producer; the manifest
finalised inside `finish` between the stage assignment and the ticket write, pinned by invocation
order; 18 of the fixture's 22 leaf keys interpolated by a test, with the four unread ones being the
gate object's, correctly asserted as a shape; `docs/decisions/065-…` present with its index line, and
the supersession markers landed at `run-events.contract.md:84` and `:104`. `pnpm`-level checks green:
72 tests, `tsc` exit 0, `eslint` exit 0. Nothing under `spike/` is touched.

---

## What a revise round can actually close

| Finding | Who can perform it |
| --- | --- |
| **M-1** | development revise round — `engine.ts`; name `q0050-routing`/`q0050-engine-types` if the emitter is threaded or retyped |
| **M-2** | **a ruling first** (widen, or delete and record), then a development revise round for the code half |
| **M-3** | a test file plus `qa/scenarios.md`'s AC-6 rows — QA or hand |
| **M-4** | a test file — QA or hand |
| **N-1**, **N-2**, **N-5** | test files — QA or hand |
| **N-3** | `docs/GLOSSARY.md` and `docs/04-architecture.md` — `q0050-documentation` owns both, so a revise round |
| **N-4** | a test file for the parse; the guard half is `engine.ts`, so either |

Two of four majors and one nit are closable by a development revise round; **M-3, M-4, N-1, N-2 and
N-5 are QA-or-hand**, and M-2 needs a ruling before any of it. A round that hands all nine to the
fan-out will pay to be told it cannot write five of them — the split that has cost this ticket a
round in each of the last four.
