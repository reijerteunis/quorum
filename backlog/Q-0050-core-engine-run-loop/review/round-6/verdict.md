# Verdict — Q-0050 round 6

*Panel judge · read-only · 2026-08-29 · claude.md + codex.md, judged against the tree at `8a900eb`.*

**changes-requested — three majors and seven nits. No blocker.**

Every finding below was re-checked against the code before it was carried, and two were changed in
the checking. Nothing from rounds 1–5 is reopened; `solution/errata.md` E-1–E-21 is treated as
binding by both panellists and by this verdict.

## How the panel was judged

Claude reported four majors and five nits; Codex reported one major and one nit. Codex's major and
Claude's M-1 are **the same finding** and are merged. Codex's nit is new and survives. Of Claude's
four majors, three survive as majors and one is downgraded on the evidence.

I did not re-run the suites — Claude executed them (72 tests, `tsc` exit 0, `eslint` exit 0) and
that report is consistent with the tree. What I did instead was verify each claim's *subject* by
reading, because three of the four majors are about things a green suite cannot see, and a judge
that accepts those on assertion adds nothing.

| Panel finding | Ruling |
| --- | --- |
| claude M-1 · codex major — step-id enrichment in the run loop | **merged → major 1**, verified |
| claude M-2 — `registerOccurrence` unreachable | **downgraded to nit 1**, see below |
| claude M-3 — AC-6's `vars.iter` clause unasserted | **major 2**, verified by measurement |
| claude M-4 — failed terminal-then-throw not joined through `runFlow` | **major 3**, verified by reading `collect` |
| claude N-1…N-5 | carried as nits 3–7, N-4 narrowed |
| codex nit — `auto` JSDoc | **nit 2**, verified |

### The two rulings that changed a panellist's classification

**M-2 is a nit, not a major.** The reachability half is correct and I confirmed it: `history` is a
local in `run()` (`engine.ts:138`), it is on none of `RunContext`, `RoutingContext` or
`RunPersistence`, and `RunHistory.allocate` is the only producer of an `Occurrence` — so no caller
inside or outside this ticket can reach `registerOccurrence` (`engine.ts:159`, `types.ts:97`, plus
`lifecycle.test.ts:31`'s stub, and nothing else in `packages/` or `contracts/`). What does not hold
is the charge the major rests on — that the interface "ships a member whose JSDoc asserts a property
it does not have". `types.ts:89-97`'s JSDoc says, in as many words, *"Q-0050 allocates none … so
this seam has no caller inside this ticket"*. It discloses exactly the fact the review says is
hidden, which is the opposite of the E-11 shape it is likened to. Whether the member earns its place
is then a judgement about Q-0052's eventual shape — the review's own argument is that Q-0052 will
*probably* register inside its allocate capability — and that is a design preference, not a defect.
It was added as an accepted round-1 remedy; re-litigating an accepted remedy in round 6 with no
false statement to cite is not a major. It stays reported, because the reachability fact is real and
worth a sentence.

**N-4 is narrower than reported.** Claude writes *"No test ever passes a `regressed` terminal
through `eventSchema.parse`"*. `packages/shared/src/events.q0050.test.ts:36` parses a regressed
terminal through `runTerminalEventSchema`, including the `remaining: undefined` and unknown-key
rejections. What is true, and is the finding worth keeping, is that no **engine-produced** regressed
terminal is validated: `engine.test.ts:119`'s AC-2 loop runs over `withGates()`, which completes.
The nit is carried in that form.

---

## Majors

### Major 1 — step-id enrichment moved to the run loop, so a `parallel:` group stamps `"undefined"` and a fan-out wave stamps its parent

*claude M-1 · codex major (`engine.ts:143`) — one finding.*

`packages/core/src/engine/engine.ts:145`, with `:80`, `:227` and `packages/core/src/engine/routing.ts:63`

Verified in the tree, all four halves:

- `engine.ts:145-146` holds a single mutable `stepId`, and `:227` sets it to `String(step.id)` for
  the **top-level** step only.
- `routing.ts:63` maps a group's members to `runAgentStep(member)` with no member-scoped emitter, so
  concurrently executing members share that one slot.
- `harness/flows/requirements.yaml:6` and `harness/flows/review.yaml:6` are both `- parallel:` with
  the ids on the members beneath. A group is a container and correctly carries no id, so
  `String(undefined)` is the literal `"undefined"` — on both flows this ticket is itself run under.
- `engine.ts:80` spreads `stepId` **last**, so an id a later ticket supplies is overwritten. There
  is no second emitter on `RunPersistence` or `RoutingContext`, and `EmitEvent` is typed over `Event`
  rather than `AdapterEvent` (`engine.test.ts:445` already needs `as unknown as Event`), so Q-0052 is
  typed into supplying a step id and having it discarded.

Nothing is wrong on disk today — `runAgentStep` is a stub that rejects (`routing.ts:55`) — and E-8
struck AC-2b's test knowingly. But E-8 struck a *test*; it did not licence a mechanism that cannot
carry a member's id. AC-2 requires each adapter event to gain **the executing step's** id, and a
group is not the executing step. M3's mission control is parallel trace columns, and five columns
cannot be derived from one id.

Both vendors found this independently, from different starting points (Claude from the shipped panel
flows, Codex from the mutable slot's inability to represent concurrent members). That agreement is
the strongest signal in the round.

**Remedy** — either shape closes it: pass the step-scoped emitter to `runStep` as a second argument
so the parallel branch and Q-0053's wave each derive one per member, or have `withStepId` preserve an
existing `stepId` and type the sink `(event: AdapterEvent)`. One assertion is the subject: a
`parallel:` group with **no** `id` whose two members each emit, asserted to carry their own ids.

**Who can perform it:** a development revise round — `engine.ts` is `q0050-engine-compose`'s; name
`q0050-routing` and `q0050-engine-types` if the emitter is threaded or retyped.

### Major 2 — AC-6's `vars.iter` clause is asserted in neither direction

`packages/core/src/engine/engine.ts:251`, with `:247`

Measured, not read: the word `iter` occurs in `packages/core/src/engine/` at exactly three sites —
`engine.ts:134` (the initial value), `engine.ts:251` (the increment) and `types.ts:144` (a JSDoc) —
and in **none** of the six test files. AC-6 states the clause as preserved behaviour
(*"increments on the intra-flow branch only, never on the cross-flow one, which returns first"*), the
code is correct, and both halves are free: an increment added to the cross-flow branch, or removed
from the intra-flow one, is green everywhere.

The clause is load-bearing. `harness/flows/chore.yaml:34` writes `review/chore-iter-{iter}.md`, so
`vars.iter` is the only thing keeping a revise round's review artifact off the previous round's — the
symptom of open ticket Q-0057, which a regression here would reproduce under a different cause.

The fixtures exist: `engine.test.ts`'s `withGates()` drives a genuine intra-flow goto and
`routeOnce({ goto: 'flow:development', … })` a cross-flow one; a spy reading `context.vars.iter` per
`runStep` call closes both halves in one test.

**Who can perform it:** a test file plus `qa/scenarios.md`'s AC-6 rows — QA or hand.

### Major 3 — the failed run's terminal-event-then-throw is never joined through `runFlow`

`packages/core/src/engine/engine.test.ts:389` and `:480`, with `packages/core/src/engine/channel.test.ts:30`

Verified by reading the helper rather than the tests: `collect` accumulates into a local array and
returns it only on normal completion, so `await collect(stream(opts)).then(() => undefined, (cause)
=> cause)` — the shape of both `failed` tests, AC-8c at `:389` and AC-12d at `:480` — throws the
events away. `channel.test.ts:30` drives a hand-written sink: it proves the *channel* drains before
it rejects, not that `run()` emits a terminal event before rethrowing.

So of the five statuses, `completed`, `aborted`, `regressed` and `interrupted` each carry a composed
`expect(events.at(-1)).toMatchObject({ type: 'terminal', … })`, and `failed` — the only status where
AC-3's *"additionally throws"* has a subject at all — carries none. `qa/scenarios.md:57`'s AC-3a row
reads *"all five statuses driven through `runFlow`"*, which is true of the statuses and reads as
coverage of the property. A `finish` that stopped emitting before the rethrow would be green in both
files.

This is the criterion the port's one authorised behaviour change was spent on, which is why it is a
major rather than a coverage nit. The remedy is three lines in AC-8c: collect into an array declared
outside the `try` and assert the last event before asserting the rejection.

**Who can perform it:** a test file — QA or hand.

---

## Nits

### Nit 1 — `registerOccurrence` has no reachable caller, and the sentence saying what that buys is a prediction

`packages/core/src/engine/types.ts:89-97`, with `packages/core/src/engine/engine.ts:159`

Downgraded from claude M-2 for the reason given above: the JSDoc discloses that the seam has no
caller in this ticket, so nothing false ships. What is worth a line is that the member cannot be
called by anyone — `RunHistory` is a local, and `allocate` is on no context — so Q-0052 must widen
the capability on its first day regardless, which is the cost the member was accepted to avoid. Say
so in `solution/errata.md` beside E-13, or widen the seam now with
`allocateOccurrence(step, kind, fields)` that registers as it allocates. A ruling either way; the
code half is then a revise round on `types.ts` and `engine.ts`.

### Nit 2 — the `auto` option's JSDoc says the opposite of what `auto` does

`packages/core/src/engine/types.ts:47` *(codex)*

*"Authorises the first gates the run meets without a human answer, exhaustion gates included."*
`routing.ts:12` is `request.kind === 'auto' || (context.auto && request.kind !== 'human-locked')`,
and AC-6 synthesises the exhaustion gate as `human-locked` precisely so `--auto` cannot bypass it.
The glossary says the same (*"cannot be bypassed by `--auto`"*), as does *"Non-auto exhaustion gates
require an explicit human or scripted answer"* (2026-08-23).

The consequence is bounded — a caller who believes it supplies no `answerGate` and the run fails at
the exhaustion gate **by name**, which is the specified safe behaviour — which is why this is a nit
and not a major. It is nonetheless the first nit to fix: it is one line in the public options type
this ticket exists to design, and it contradicts a decision entry. `q0050-engine-types` owns it.

### Nit 3 — a `toBeGreaterThanOrEqual` floor survives twenty-six lines above the register that replaced it

`packages/core/src/engine/q0050.source.test.ts:141` *(claude N-1)*

Confirmed: the floor matches `Why: preserved defect, see Q-0050 AC-12\.` across `engine.ts` and
`lifecycle.ts`, and `REGISTERED` at `:156` already pins each of those files as carrying exactly one
`preserved defect/AC-12` under `toStrictEqual` at `:167`. The floor cannot fail unless the register
fails first, and it is the exact shape the next test's own comment condemns — *"A register of
identities, not a count. Q-0073's lesson"*. Delete it, or keep the name and assert the two identities
from `found`.

### Nit 4 — AC-13b's documentation guard checks for words, so a document stating the opposite passes

`packages/shared/src/docs.test.ts:164` *(claude N-2)*

Confirmed: `for (const token of ['terminal', 'answerGate', 'AbortSignal', 'timestamp', title,
'2026-08-28']) expect(body).toContain(token)`. A glossary reading *"every event carries a
timestamp"* satisfies it. This is not hypothetical on this ticket — `docs/decisions/065-…` exists
because two **statements** in 062 were false while every word in them was the right word, which is
the failure this guard is positioned to catch and cannot. One `toMatch` per rule against the sentence
rather than the noun costs the same and can fail.

### Nit 5 — the glossary cites 062 with nothing pointing at its erratum

`docs/GLOSSARY.md:73`, with `docs/04-architecture.md:33` *(claude N-3)*

Confirmed in both files: `GLOSSARY.md:73` and principle 2's closing sentence cite *"What a run's
event stream carries…"* (2026-08-28) alone; only `04-architecture.md`'s **status line** mentions
*"and its 2026-08-29 erratum"*. 065's own *Alternatives considered* names these two citations as the
reason it exists. Half the gap the entry was written to close is still open, and it is four words in
each citation. `q0050-documentation` owns both files, so a revise round can do it.

### Nit 6 — no engine-produced `regressed` terminal is schema-checked, and its two computed fields are unguarded

`packages/core/src/engine/engine.test.ts:119`, with `packages/core/src/engine/engine.ts:244-245` *(claude N-4, narrowed)*

Narrowed as set out above: `events.q0050.test.ts:36` does parse a regressed terminal, from a
hand-written literal. What no test does is pass the **engine's own** regressed terminal through the
union — `engine.test.ts:119`'s AC-2 loop runs over `withGates()`, which emits `info`, `gate`, `info`
and a `completed` terminal. The regressed member is the one with a nested discriminated union, the
seven-field group AC-3 spent its design on, and the only member whose fields are computed:
`count: context.counters[result.counter]` is an unchecked index and `limit` reaches `handleFail` as
`Number(failure.max_iterations)`, while `packages/shared/src/events.ts:216-217` declares both
`z.number()`, which rejects `undefined` and `NaN`. Both are unreachable through `routing.ts` today,
which is why this is a nit. One `eventSchema.parse(events.at(-1)!)` in the AC-8b test covers it and
passes today.

### Nit 7 — a test titled "is lazy" asserts everything except laziness

`packages/core/src/engine/engine.test.ts:91` *(claude N-5)*

Confirmed: `stream()` at `:75` catches only a **synchronous** throw from `runFlow`, and every
assertion in the test is made after `collect` has drained the stream, so an eager implementation
would satisfy it. The property is genuinely covered one level down
(`channel.test.ts:23`'s `expect(start).not.toHaveBeenCalled()`), so nothing is unguarded — the title
is what is wrong. Either assert it here (construct the iterable, assert no `runs.log`, then pull) or
drop the clause from the name.

---

## What a revise round can actually close

| Finding | Who can perform it |
| --- | --- |
| **Major 1** | development revise round — `engine.ts`; name `q0050-routing`/`q0050-engine-types` if the emitter is threaded or retyped |
| **Major 2**, **Major 3** | test files (plus `qa/scenarios.md`'s AC-6 rows for Major 2) — QA or hand |
| **Nit 1** | a ruling first, then `types.ts`/`engine.ts` or one sentence in `solution/errata.md` |
| **Nit 2** | `types.ts` — development revise round |
| **Nits 3, 4, 6, 7** | test files — QA or hand (Nit 6's guard half, if wanted, is `engine.ts`) |
| **Nit 5** | `docs/GLOSSARY.md` and `docs/04-architecture.md` — `q0050-documentation` owns both |

Exactly **two** of the ten items — Major 1 and Nit 2 — are closable by a development fan-out.
Everything else is a test file, a document or a ruling. The split that has cost this ticket a round
in each of the last four is the same split here, and handing all ten to the fan-out will pay to be
told it cannot write eight of them.

## Recorded so round 7 does not re-derive it

Both panellists' round-5 close-out checks were spot-checked and hold: the three-case gate test is
present at `lifecycle-routing.test.ts:60`/`:67`/`:101`, the authority register at
`q0050.source.test.ts:156` is anchored on `Why:` and classifies thirteen markers under
`toStrictEqual`, and `docs/decisions/065-…` is landed with its index line. Claude's executed-suite
report (72 tests, `tsc` exit 0, `eslint` exit 0) is consistent with the tree at `8a900eb` and is not
re-derived here. Nothing under `spike/` is touched by either review's remedies.
