# Review verdict — Q-0050 round 3

*Judge: panel deduplication · 2026-08-29 · over `review/round-3/claude.md` (5 majors, 5 nits) and
`review/round-3/codex.md` (3 majors). Read at `harness/Q-0050/integration` (`8355940`), against
`spike/src/engine.js`, `requirements/merged.md`, `solution/solution.md`, `solution/errata.md`
E-1–E-17, `contracts/Q-0050/**`, `qa/scenarios.md` and
`docs/decisions/062-what-a-runs-event-stream-carries.md`.*

**changes-requested — six majors and five nits. No blocker.**

Every finding below was checked against the code rather than taken from the review that raised it.
Two panel findings did not survive that check and are recorded, with their evidence, under **Not
upheld** so round 4 does not re-derive them.

## The tree this verdict judges

The branch tip is `8355940`. Three test files in the integration worktree carry **uncommitted**
hand edits (+70 lines: an AC-3a aborted-run test, AC-8a's step-stub spy, the AC-9f cost test, and
the AC-13d identity register), and `qa/scenarios.md` in the main checkout carries uncommitted row
rewrites. They are not on the branch, and they are stated here rather than silently credited or
silently ignored: they close the *"two tests do not exist"* half of Claude's M-3 and the
`toBeGreaterThanOrEqual` half of its AC-13d complaint, and they close nothing else. Where a finding
is affected, it says so.

## Deduplication

| Panel finding | Disposition |
| --- | --- |
| claude M-1 context copy | **major 1**, confirmed |
| claude M-2 missing AC-10 authority lines | **major 2**, confirmed and strengthened |
| codex 3 pending pull at abandonment | **major 3**, confirmed |
| claude M-4 unread oracle entries | **major 4**, confirmed |
| claude M-3 traceability rows | **major 5**, narrowed — two halves closed by uncommitted work |
| claude M-5 decision 062 + codex 2 gate-id allocation | **major 6**, merged; codex's code-side remedy refused per E-17 |
| claude N-4, N-2, N-3, N-1, N-5 | **nits 1–5**, all confirmed |
| codex 1 `step`/`done` never emitted | **not upheld** — ownership and charter §2; see below |

---

## Majors

### Major 1 — every step receives a *copy* of the run context, so state a step writes for a later step is discarded

`packages/core/src/engine/engine.ts:213` · production · **confirmed by reading both trees**

```ts
const stepContext: EngineContext = { ...context, emit: withStepId(emit, stepId) };
const result: StepResult = await runStep(step, stepContext);
```

Object-valued fields survive because they are mutated in place, which is why nothing fails today.
Anything a step *assigns* is lost when the step returns, and the spike does exactly that across
steps. Verified in `spike/src/engine.js`:

| written | at | read | at |
| --- | --- | --- | --- |
| `ctx.fanned` | `:940`, `:954` (`runFanOut`) | wildcard `into` resolution, integrate's branch→task map | `:982`, `:1073` |
| `ctx.failingTasks` | `:1074`, `:1080` (`runIntegrate`) | `scope: failing-tasks-only` | `:932-933` |
| `ctx.lastIntegration` | `:1071` (`runIntegrate`) | the task prompt's *Previous integration result* | `:957` |

Q-0051's `ctx.diffInputs`/`ctx.deferredDiffs` are safe by accident — `Map`s built at construction.
`lastIntegration` is a **string assignment** and would not be saved by declaring a field on
`RunContext` either. Three silent Q-0053 failures follow, none of which throws: a failed integrate
re-runs every task, a wildcard `into` resolves to the empty branch list, and the re-run implementer
never learns why the last integration failed.

The ticket body calls this file *"the run context every other engine ticket writes into"*, and
nothing in `types.ts`, `module-layout.contract.md` or `solution.md` states that it is a copy. AC-12's
own rule applies to the port's design as much as to git's exit codes: *an unstated answer is what
lets the next reader assume the question was considered.*

**Remedy** — the copy exists only to carry the step id into `emit`. Cheapest first: put the current
step id on the shared context and let one `emit` closure read it; or assign and restore
`context.emit` around the call in a `finally`; or pass the step-scoped emitter as a second argument.
Whichever is chosen, one line in `types.ts` should say the context handed to a step is the run's own
object. **Who:** a development revise round — `engine.ts` is `q0050-engine-compose`'s; name
`q0050-engine-types` too if the fix adds a field.

### Major 2 — AC-10's two mandated authority lines are absent, and the register that landed this round codifies their absence

`packages/core/src/engine/engine.ts:121`, `packages/core/src/engine/lifecycle.ts:19-30` ·
**confirmed by grep over the whole folder**

AC-10 names both preserved dry-run mutations and then says, in as many words: *"Both carry one line
naming the authority — `Why: preserved defect, see Q-0050 AC-10.`"* AC-13d repeats the obligation.
Five such lines exist in the folder and **none names AC-10**: `engine.ts:155` (AC-12), `:210`
(AC-12d), `lifecycle.ts:33` (AC-12), `routing.ts:25` (AC-4), `:62` (AC-12).

- **The in-memory ticket is still advanced under `--dry`**: `lifecycle.ts:19` assigns the counters,
  `:22` the stage, `:30` the history entry, none guarded by `dry`. The only comment at `:20-21` is
  about the `stage` argument's *type*.
- **The counters alias `ticket.meta.iterations`**: `engine.ts:121`'s `ticket.meta.iterations ?? {}`
  returns the frontmatter object when one exists. The only trace is a descriptive JSDoc in a third
  file (`types.ts:124`), which is a fact about a field, not an authority for a defect.

Both are *positively pinned by tests* (`engine.test.ts:193`, `:255-257`), so the next reader who
removes them fails a test they cannot explain — the one class where the annotation is the entire
defence, and the ticket's risk section says four of its preserved defects *"look exactly like
tidy-ups"*.

**Strengthened by this round's own uncommitted work.** `qa/scenarios.md:436`'s AC-13d scenario
enumerates the expected sites as *"(AC-4h, AC-10c, AC-10f, AC-12a/b/c/d)"* — AC-10's two among them
— while the new identity register at `q0050.source.test.ts:106` pins
`{ engine.ts: ['AC-12.','AC-12d'], lifecycle.ts: ['AC-12.'], routing.ts: ['AC-4.','AC-12.'] }` and
`toHaveLength(5)`. The register was written to the *shipped* set, not to the criterion's, so adding
the two lines now fails it until `REGISTERED` is updated in the same change. Better than the floor
it replaced, and it must not be allowed to ratify the omission.

**Who:** a development revise round for the two source lines; the register update is a test file —
QA or hand, in the same round.

### Major 3 — abandonment does not detach or settle a pending pull, so an event can still be delivered after `return()`

`packages/core/src/engine/channel.ts:106` · **confirmed by reading; raised by codex, and Claude's
"the channel latches" is true only of pulls made *after* `return()`**

```ts
async function abandon(): Promise<IteratorResult<Event>> {
  abandoned = true;
  await finalise();
  return { value: undefined, done: true };
}
```

`abandoned` is checked at the top of `next()` (`:94`), so a *later* pull is `{ done: true }`. A pull
already in flight is untouched: `pending` still holds its `resolve`/`reject`, and `finalise()` runs
the producer's interrupted finalisation, which emits — the rollback warn, the terminal `info`, the
terminal event — each reaching `sink.emit` → `settlePending()` → `resolve({ value, done: false })`.
`run-events.contract.md:82` says `return()` *"closes delivery"*; it does not. The consumer that
abandoned can be handed the terminal event it caused, and `return()` and a prior `next()` can both
settle successfully. When the run threw, `sink.complete(error)` instead **rejects** that stale pull,
which a caller who has stopped awaiting it will see as an unhandled rejection.

Not reachable from a `for await` loop, which never has a pull outstanding when it breaks — reachable
from exactly the shape M3 will use, `Promise.race([it.next(), shutdown])` followed by `it.return()`.
`next()` already guards re-entrancy explicitly (`:89`), so concurrent pull handling is within this
channel's design, not outside it. E-15's sentence rests the guarantee on async-iteration *syntax*;
the channel's own contract sentence is the one falsified here.

**Remedy** — in `abandon`/`abandonWithError`, before awaiting `finalise`, take `pending` and settle
it `{ done: true }` (or reject it with the abandonment reason), and null it so `settlePending` cannot
find it. One test: start a `next()`, call `return()`, emit during finalisation, assert the pending
pull cannot receive it. **Who:** a development revise round — `channel.ts` is
`q0050-event-channel`'s; the test is QA or hand.

### Major 4 — four entries of the "single oracle for exact event and log text" are asserted by nothing, including AC-9's own terminal `runs.log` line

`contracts/Q-0050/run-messages.fixture.json` · `packages/core/src/engine/lifecycle.test.ts:60` ·
**confirmed by grepping every fixture key against all six test files**

Eleven entries are read through the oracle. `log.terminal`, `log.errorSuffix`, `log.start` and both
`unpricedSuffix` branches are read by **no test**; `log.gateAnswer` and `log.retryGrant` are matched
as hand-written literals (`lifecycle-routing.test.ts:140`) that bypass it. `qa/scenarios.md:51` names
all six and says they are *"named here rather than counted as covered"* — the right instinct, and it
does not make the criterion met. Note that round 4's own change list, item 5, claims these were
*"replaced with full-string equality against the fixture value"*; they were not, and the disclosure
at `:51` contradicts that item.

- **`log.terminal` is AC-9's stated subject.** AC-9: *"Two `runs.log` lines keep their exact format"*.
  The rolled-back line is pinned byte-for-byte (`lifecycle.test.ts:157`). The terminal line is
  matched by `expect.stringMatching('run=7 <status> stage=')` — a prefix — and by
  `/run=1 interrupted stage=draft→draft .*error="received SIGINT"/`, whose `.*` steps over `cost=`
  and `tokens=` entirely. The enumerated segment is the unchecked segment.
- **`unpricedSuffix` has a plural branch and no test.** `lifecycle.ts:47-49` computes `step` vs
  `steps` from `unpriced > 1`; every test runs at `unpriced: 0` and `engine.test.ts:107`
  interpolates `unpricedSuffix: ''`. Both branches of a string preserved byte-for-byte from
  `engine.js:650`, including its two-space prefix, are unexercised.

**Remedy** — three assertions: one terminal `runs.log` line rendered whole from `fixture.log.terminal`
at a non-zero cost with a note, and two `terminalInfo` renders at `unpriced: 1` and `unpriced: 2`.
`log.start` is worth one more, since `nextRunId` parses it. **Who:** test files — QA or hand.

### Major 5 — the AC-9f traceability row is false about the code, and the divergence it misdescribes is now pinned without a ruling

`backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:75` · **narrowed from claude M-3; two of its
three halves are closed by the uncommitted worktree work**

Closed and not re-raised: the AC-9f test now exists (`lifecycle.test.ts:72`) and the AC-13d row's
identity register now exists (`q0050.source.test.ts:106`), both uncommitted. What remains is live and
is the half with a decision behind it.

The row reads *"the payload and terminal event carry the raw `1.23456`, the history entry carries the
rounded `1.235`."* The code carries the rounded value on the terminal event — `lifecycle.ts:53` sets
`cost: roundedCost` on the event while `:64` returns `cost: context.stats.cost` raw — and the new
test written to satisfy this row asserts `cost: 1.235` on the terminal event. The row contradicts
both the code and its own test.

Underneath it is an unruled divergence, not a typo. AC-3's *Test:* line requires the terminal event
to carry *"fields equal to `finish()`'s values for the same run"*, and on `cost` it does not. Nothing
caught it because every engine-level test runs at `stats.cost === 0`, where rounded and raw are the
same number — and the new test now pins the divergence as intended without an erratum saying so,
which is the *"unstated decision"* shape this ticket's own risk section names.

**Remedy** — one sentence in `solution/errata.md` stating which value the terminal event carries and
why (the terminal `info` line and the history entry are both rounded, so rounding the event is the
defensible answer), then correct the row to match. **Who:** hand or QA — `qa/scenarios.md` and
`solution/errata.md`; not a development revise round.

### Major 6 — the landed decision entry is contradicted by the code in two clauses, and both corrections were written where no future reader will look

`docs/decisions/062-what-a-runs-event-stream-carries.md:14` and `:28` ·
`contracts/Q-0050/run-events.contract.md:100` · **merges claude M-5 with codex's gate-id finding**

`.claude/rules/docs-and-decisions.md` is unambiguous: *"A landed entry is never edited — reversing
one is a new entry that names the old one"*, and *"Never contradict an entry silently."* Two of 062's
sentences are false of the shipped code, and both corrections live in `solution/errata.md`, which is
not a decision entry and which E-9 records as read by no flow on this route.

1. **062:14** — *"Automatic and dry short-circuits run **before** a question is allocated."* They do
   not: `routing.ts:84` and `:128` build the whole `GateQuestionEvent`, `gateId` included, and
   `askGate` evaluates `auto`/`--auto`/`dry` at `:12-19`. **E-17 rules the code right and the
   sentence wrong, and I uphold that ruling** — moving allocation into `askGate` past the
   short-circuits would force `askGate` to stop taking a fully-formed `GateQuestionEvent`, a
   signature change to the one gate-policy primitive two later tickets code against, to close a gap
   in an opaque token. Codex's remedy is therefore **refused**; its observation is not.
   E-17 supersedes `solution.md` only, so the identical sentence stands in 062 **and** at
   `run-events.contract.md:100` — where, unlike `:81`, it carries no `Superseded by …` marker even
   though every other erratum in this ticket annotates the contract inline.
2. **062:28** — *"a failed run emits its terminal event and the **following** pull throws the
   existing `FlowError`."* It throws whatever the run threw, unwrapped (`engine.ts:274`
   `sink.complete(toError(error))`; the AC-12d pin asserts `toBeInstanceOf(TypeError)`). E-12 rules
   the contract wrong and the code right, correctly, and amends `run-events.contract.md:81` only.

Both rulings are right; the route is wrong, and it is the failure E-12 itself names one paragraph
later: *"The sentence is corrected before a later ticket cites it against the code."* An entry in
this ticket's `solution/errata.md` does not do that. Q-0051 and M3 will read 062 — cited by title and
date from `04-architecture.md` and `GLOSSARY.md` — and find two sentences describing a different
engine with nothing pointing away from them.

**Remedy** — one short dated erratum entry in `docs/decisions/` naming 062 and correcting exactly
these two clauses, plus its line in `DECISIONS.md`; `decisions/040` and `043` are the precedent.
Cite E-12 and E-17 as the working rather than restating them. Add the missing `Superseded by
solution/errata.md E-17.` marker at `run-events.contract.md:100` while there.
**Who: hand, at the gate.** No step on this route may write `docs/decisions/` —
`module-layout.contract.md` says so, and `q0050-documentation` owns two documents, neither of them
this one. Handing it to a fan-out burns a loop on a precondition no agent in it can satisfy.

---

## Nits

### Nit 1 — `interpolate` drops the spike's `String(…)` coercion, and says nothing about it

`packages/core/src/engine/loaders.ts:45`. `engine.js:740` is `String(s).replace(…)`; the port takes
`template: string`. The coercion is not decoration — the call sites interpolate values that came out
of YAML (`step.run`, `step.branch`, `s.into`, `site.input.diff`), and YAML hands back a number for
`branch: 2`. One correction to the review that raised it: because the parameter is typed, a
number-valued call site is a **compile error in Q-0051/Q-0052**, not the runtime `TypeError` the
finding describes — unless a call site casts, which under a `Record<string, unknown>` step shape is
the likely path. Either restore `String(template)` or state in the JSDoc that coercion is now the
caller's, so Q-0052 writes `String(step.run)` deliberately rather than discovering it.

### Nit 2 — a self-comparison stands in for the counter-alias assertion

`packages/core/src/engine/engine.test.ts:193`:
`expect(opts.ticket.meta.iterations).toBe(opts.ticket.meta.iterations);` — `x === x`. It reads, in
the abandonment test, as the assertion its neighbours make. The dry test's
`toBe(originalIterations)` (`:255-257`) is the real version, because it captures the reference before
the run. Capture it here too, or delete the line: *"a check that skips its subject must not report
success"* (2026-08-25), in one line.

### Nit 3 — the stage-precondition test asserts half of its own title

`packages/core/src/engine/engine.test.ts:226-236`. Titled *"rejects a stage mismatch before context
construction **or any write**"*, it asserts four substrings of the message and nothing else. AC-11's
*Test:* line names the missing half — *"and that neither a `runs.log` line nor a run directory was
created"* — and the two assertions already exist twenty lines below in the dry test. The code is
plainly correct, which is why the assertion is cheap.

### Nit 4 — `docs/04-architecture.md`'s status line was not bumped

`docs/04-architecture.md:3`. The rules and `docs/README.md` both require the numbered documents to be
edited in place *"and bump the status line at the top with the date and what changed."* This change
rewrites principle 2 and the status paragraph still ends at Q-0072 — verified: it contains no
`Q-0050`. Q-0041, Q-0064, Q-0047, Q-0071 and Q-0072 each added their sentence.
`packages/shared/src/docs.test.ts` already asserts `Q-0041` in that paragraph for exactly this
reason. `GLOSSARY.md` carries no status line and is correctly untouched. **Who:** a development
revise round — `q0050-documentation` owns the file.

### Nit 5 — the opaque gate id is `<runId>:<n>`, which is the two things 062 says no event carries

`packages/core/src/engine/engine.ts:181`:
`nextGateId: () => \`${runId}:${(gateSequence += 1)}\``. 062:31 reads *"No event carries a timestamp,
a sequence number or a run id. Only the terminal event carries run identity"*, and a gate event's
`gateId` renders as `"1:2"`. `run-events.contract.md` calls the token opaque, which is the licence,
and nothing parses it. Either say in the contract that the token is deliberately derived from run and
sequence and is not to be parsed, or make it genuinely opaque. One sentence, and worth it because M3
will route answers by this token.

---

## Not upheld

### `step` and `done` are never emitted for a successful step (codex, major)

**Not upheld on ownership, and its remedy is refused.** The finding is factually right that no
`step` or `done` event is emitted anywhere under `packages/core/src/engine/` — verified by grep — and
wrong that this ticket owes them.

- In the spike, `ui.step` and `ui.done` are called at `engine.js:234`, `:238` and `:302`
  (`runAgentStep`), `:595` and `:605` (`runScript`), and `:974` and `:1078` (`runIntegrate`). All
  three functions are **Q-0052's and Q-0053's** by this ticket's non-goals. The requirement's
  `ui`→`Event` map enumerates the seven Q-0050-owned print sites (`:67`, `:146`, `:545`, `:548`,
  `:574`, `:644`, `:651`); neither `step` nor `done` is among them.
- The payloads are byte-preserved strings this ticket cannot construct —
  `"<adapter>/<model> role=<role>"` needs `resolveModel`, `"verdict=… cost=… <n>ms"` needs the
  adapter result.
- The proposed remedy — emit `step` before `runStep` and `done` after it resolves — would emit both
  for **gate steps and fan-out parents**, which the spike never does. That is a behaviour change
  charter §2 forbids, arriving in the one child already carrying the port's only authorised change.
- `solution/errata.md` **E-8** already struck AC-2f and AC-2b with the reason, and stated the cost
  rather than hiding it: *"Step-id enrichment, the failed-step `done` suppression, cancellation and
  run-history initialisation failure enter Q-0052 **unpinned**, and that ticket's requirement should
  carry them as criteria rather than rediscover them."* `qa/scenarios.md` marks both rows
  `— none (struck, E-8)`.

The one thing worth carrying forward is E-8's own instruction: Q-0052's requirement must name the
`step`/`done` obligation as a criterion. That is a gate note, not a change to this branch.

### Auto and dry gates consume a correlation id (codex, major)

Folded into **major 6** as a documentation defect. The code side is ruled by E-17 and the ruling is
upheld here; what survives is that the superseded sentence still stands in 062 and in
`run-events.contract.md:100`.

---

## Who can close what

| Finding | Who |
| --- | --- |
| Major 1 | development revise round — `engine.ts`; name `q0050-engine-types` if a field is added |
| Major 2 | development revise round (two source lines) + the register update in `q0050.source.test.ts` — QA or hand |
| Major 3 | development revise round — `channel.ts`; the test is QA or hand |
| Major 4 | test files — QA or hand |
| Major 5 | hand or QA — `solution/errata.md` ruling first, then `qa/scenarios.md:75` |
| Major 6 | **hand, at the gate** — `docs/decisions/` is writable by no step on this route |
| Nit 1, Nit 4 | development revise round — `loaders.ts`, `docs/04-architecture.md` |
| Nit 2, Nit 3 | test files — QA or hand |
| Nit 5 | either — one line in `types.ts`/the contract, or one sentence via `solution/errata.md` |

Three of six majors and two nits are closable by a development revise round. **Major 6 is hand-only**
and majors 4 and 5 are QA-or-hand, so a round that hands all six to the fan-out will pay to be told
it cannot write three of them — the split that has already cost this ticket rounds.

## Recorded so round 4 does not re-derive it

**Verified by reading, not taken from either review:** `engine.js:940/954/982/1073`,
`:1074/1080/932-933`, `:1071/957` for the three step-assigned context fields; five
`Why: preserved defect` lines in the engine folder and zero naming AC-10; `lifecycle.ts:53` rounded
on the event against `:64` raw on the return; every fixture key grepped against all six test files
(11 read, `log.terminal`/`log.errorSuffix`/`log.start`/`unpricedSuffix.*` read by none,
`log.retryGrant` hand-typed at `lifecycle-routing.test.ts:140`, `log.terminal` prefix-matched at
`lifecycle.test.ts:60`); `062:14` and `:28` against `routing.ts:12-19`/`:84` and `engine.ts:274`;
`run-events.contract.md:100` carrying no supersession marker where `:81` carries E-12's;
`docs/04-architecture.md:3` containing no `Q-0050`; `channel.ts:94` latching later pulls while
`:106` leaves `pending` attached; the spike's seven `ui.step`/`ui.done` sites, all inside functions
this ticket does not own.

**State of the tree:** branch tip `8355940`; uncommitted in the integration worktree —
`engine.test.ts` (+24), `lifecycle.test.ts` (+11), `q0050.source.test.ts` (+35); uncommitted in the
main checkout — `qa/scenarios.md` rows for AC-3a, AC-8a, AC-9f, AC-10f and AC-13d. Those edits close
two halves of the traceability finding and nothing else; they need committing to the branch either
way.
