# Q-0129 — implement, run 3, iteration 1

*What changed, file by file; what I deliberately left alone; and the one criterion I stopped on.*

**Verdict: `blocked`.** Eleven criteria are complete. AC-12 is complete except for its first clause,
which names a file outside this role's write paths. Everything else was implemented, and the exact
text the blocked clause needs is in §7 so that a single `retry` closes it.

---

## 1. What shipped

**The gate question carries the decision that reached it**, exactly as
*"A gate question carries the decision that reached it"* (2026-09-17) rules it. One optional field,
whole or absent; one run-scoped slot in `packages/core`; no change at all in `packages/server`; a
browser that renders a value rather than parsing a sentence.

### `packages/shared/src/events.ts` (+41)

`gateReachedSchema` — `{stepId, verdict, findings, summary}`, all four **required**, `.strict()` —
and `gateQuestionEventSchema` gains `reached: gateReachedSchema.optional()`. `GateReached` is
exported; the barrel is `export *`, so nothing else moved. No other member of the union changed, no
event gained a timestamp, a sequence number or a run id.

The JSDoc states the two things a reader will otherwise re-derive: why *whole or absent* rather than
four optional members (a summary a step wrote empty and a summary nobody wrote are not the same
claim), and that `findings` is **not** parsed, grouped or counted here — `FINDING_PATTERN` governs
only the steps whose vocabulary carries `changes-requested`, so an entry matching none of the
register is ordinary rather than malformed and a renderer owes it a place.

### `packages/core/src/engine/types.ts` (+18)

`RunContext` gains **one** optional slot, `reached?: GateReached`, beside `failingTasks` and
`lastIntegration` and documented in their shape. Its docblock carries the ordering rule and the one
exception, so the rule is where a maintainer meets the field rather than in a test.

### `packages/core/src/engine/steps.ts` (+27)

The slot is assigned at **one** site: inside the first `if (declared?.verdict)` block, beside the
write of the verdict artifact. That placement is the correction the merged requirement's §0.5 made
to both candidates, and the code says why in place — `handleFail(step, context)` receives no output,
and 154 of this repository's 157 author-declared gate answers were given at a gate reached on a
**passing** verdict, which never enters `handleFail`.

`AgentStepExtra` gains `collectReached?`, which is a **notification and not a second destination**:
the slot is assigned either way, because a member reaching its own exhaustion gate has to see its
own verdict, and the callback is what lets `runStep`'s parallel branch re-order a group afterwards.

Each `??` is a representable empty rather than a default, with the reason named: `schemaFor` makes
all three required whenever a step declares a verdict, and a schema that stopped doing so must put
an empty string in front of a reader and never the word `undefined` — Q-0052's `adapterOverride`
coercion lesson at a second site.

### `packages/core/src/engine/routing.ts` (+34)

`reachedBy(context)` is the fragment a question spreads — `{}` when the slot is empty, so *no step
before this gate declared a verdict* renders as the field being **absent**. Both gate-building sites
spread it: `runStep`'s `step.gate` branch and `handleFail`'s exhaustion gate.

The parallel branch collects each member's decision **by declaration index** and re-applies them in
that order once `allSettled` returns, because members complete in whatever order the vendors answer
and what a reader is shown may not be a property of scheduling. Re-applied rather than picked, so a
member that decided nothing displaces nobody.

### `apps/web/src/gate-screen.tsx` (+162)

`ReachedRegion`, drawn above the answer controls for every parked gate:

- the deciding step's id, the verdict word **exactly as the engine sent it** — Q-0016's AC-9
  anti-coining rule at a second field — the summary, and every reported entry;
- entries grouped by `REPORT_GROUPS`, which is `[...FINDING_SEVERITIES, OBSERVATION_TAG]`
  **imported and never re-spelled**, so a member dropped from the register stops this file
  compiling;
- an entry matching none of it rendered **whole, in its own place**, under its own heading, never
  dropped and never counted into a severity it does not claim;
- an empty findings array, an empty summary and an absent `reached` each rendering a named sentence
  rather than an empty region;
- no cap, no paging, nothing behind a control, and nothing rendered as markup.

The attribute is `data-decided` and not `data-verdict`, and the file says why: Q-0015 AC-6 forbids
that field's name followed by `=` anywhere under `src` because it is the token a parser of the
`done` message would key on, and its emptiness is measured. A JSX attribute of that name would
write the token while parsing nothing, and weakening the needle to allow it would stop it forbidding
the thing it was measured for. **The guard caught this while I was writing it**, which is the guard
working.

---

## 2. Tests, and what each is for

| file | what it proves |
| --- | --- |
| `packages/shared/src/events.test.ts` (+87) | **AC-1.** Optional and round-trips whole; refused with any one of the four members missing, tested one at a time; strict at both levels, with type clauses so a value with the right key names is not accepted for one with the right shape; every other union member parsed and compared by value; none of them may acquire the field; no member gained a timestamp, a sequence number or a run id. |
| `packages/core/src/engine/gate-reached.test.ts` (new, 363) | **AC-2(a), AC-3, AC-4, AC-5, AC-6.** Thirteen tests over **real runs**, because the claim is about a value crossing from the site that validates a verdict to the site that builds a question, and a fixture that assigned the slot itself would prove only that the question spreads what it is handed. |
| `packages/core/src/gate-evidence.source.test.ts` (new, 217) | **AC-2(b), AC-12(2).** Four needles over `packages/core/src`, `packages/server/src` and `apps/web/src`, plus the clause that nothing in the two surfaces still routes the decision to this ticket. |
| `packages/server/src/serve.test.ts` (+57) | **AC-7.** Over a real port: the gate question a WebSocket client receives, deep-equalled against the row `GET /runs/:id` answers. |
| `apps/web/src/gate-screen.test.ts` (+197) | **AC-8 to AC-11.** |
| `packages/shared/src/flow.test.ts` (+26) | **AC-6's `development.yaml` clause** — see §5. |
| `packages/core/src/engine/run-composition.test.ts` (+11) | Q-0052 AC-14's gate oracle, re-aimed — see §5. |

### The fixtures worth naming

**AC-2(a) compares two sources rather than asserting one twice.** The `reached` on the emitted
question is compared member by member against the JSON the same run wrote to `.harness/`. Comparing
against a literal would pass equally well if the question carried a value composed somewhere else.

**AC-3(c) is synthetic, and the criterion says so in its own text** so a reader does not go hunting.
No shipped flow has two verdict-declaring members in one `parallel:` group — `review.yaml`'s panel
members declare none — and inventing one in `harness/flows/` is the non-goal at §5.8. The
discriminator is that the **later-declared member answers first**, and the fixture asserts that it
really did complete out of order before asserting what the gate carried; without that clause the
test would pass over an ordering that happened to agree.

**AC-4's separator fixture is the hard case rather than decoration.** Findings whose own text
carries `" | "`, `": "` and `" — "` — which is the measurement that refused parsing the `warn`
message: 4 of this repository's 1,080 findings contain the join separator themselves and 1,071
contain `": "`.

**AC-4 gained a clause the criterion asks for and neither candidate had**: the step id on the slot
is asserted equal to the `stepId` the `done` event carried, so *"the screen, `runs.log` and the
manifest all agree"* is checked rather than argued.

**AC-6 asserts absence with `in` and not with a truthiness test**, which is the distinction that
criterion is about — absent, not an object of empty members.

**AC-9's grouping has a pure half**: `groupReported`'s two outputs are shown to **sum to the input**
element for element, so *nothing is dropped* is a property rather than an intention.

---

## 3. Mutations — twelve, each red with a discriminating message

Every one was reverted and the suite re-run green afterwards.

| # | mutation | what went red |
| --- | --- | --- |
| 1 | `reached` dropped from the **exhaustion** gate | 3 tests, incl. the Q-0052 oracle: *"the gate carried nothing about the step that reached it"* |
| 2 | `reached` dropped from the **author-declared** gate | 7 tests, incl. *"a gate reached on a passing verdict carried nothing"* |
| 3 | the declaration-order reconciliation removed | AC-3(c): *"the group was ordered by completion rather than by declaration: expected 'alpha' to be 'beta'"* |
| 4 | `wireRunOf` hand-copies the question's five fields | AC-7: *"the row is not the question the engine emitted"* — the exact silent-drop this criterion exists for |
| 5 | the uncategorised branch deleted from the screen | AC-9, **naming the dropped text**: *"a reported entry was dropped: the step wrote this with no prefix at all"* |
| 6 | the absent-evidence branch returns `null` | AC-10: *"the screen is silent about a gate that follows no verdict"* |
| 7 | `summary` made optional and `.strict()` dropped | AC-1, two clauses: *"a question survived without summary"* |
| 8 | a browser file parses an event message through an optional chain off a cast | AC-2(b) — **after the needle was strengthened**; see §6 |
| 9 | `packages/server` splits a `gateId` | AC-2(b): *"it takes the correlation token apart"* |
| 10 | `packages/server` registers `GET /runs/:id/verdict` | AC-2(b): *"it registers a route naming a verdict"* |
| 11 | `apps/web` imports `TICKET_ARTIFACT_DIR` | AC-2(b): *"it reaches the verdict artifact"* |
| 12 | the retired register sentence restored in `routes.ts` | AC-12: *"the row still routes the decision to the ticket that has landed it"* |

---

## 4. Documents and registers (AC-12)

- **`docs/04-architecture.md`** — status line rewritten for this ticket with the previous one kept
  in the `*(Before that: …)*` form the file uses. §`packages/server` gains one sentence saying the
  pass-through is what carried this change with no edit in that package. §`apps/web` gains the
  *Since Q-0129* clause; the sentence claiming the screen renders **nothing** about what the step
  decided was **false the moment this landed** and is corrected rather than joined by a newer one,
  which is this file's own convention. The mission-control clause that read *"to be weighed with
  Q-0129"* now names the entry as the ruling Q-0131 **applies** rather than a ticket it waits on.
- **`docs/05-design-prompt.md`** — screen 6's divergence paragraph re-aimed at **Q-0134** for the
  half that is still owed, and a second paragraph added recording what shipped and what it
  deliberately does not do. **Its figures are not refreshed**: they are dated to Q-0016's gate, and
  a dated measurement is not drift.
- **`apps/web/src/routes.ts`** and **`apps/web/test/routes.test.ts`** — the register row and its
  clause re-aimed to Q-0134, **not deleted**, with a negative (`not.toMatch(/Q-0129/)`) beside the
  positive.
- **`packages/shared/src/docs.test.ts`** — the `/Q-0129/` clause re-aimed to `/Q-0134/`, two new
  positives added, and a negative asserting the retired routing clause is gone from that paragraph
  rather than merely joined.
- **`apps/web/test/source.test.ts`** — the AC-13 guard **narrowed by exactly half**. `verdict`,
  `findings` and `summary` retire and are named in place as retired, with a clause asserting the
  screen really does name all three now; `diff`, `blocker`, `hunk` and the `.message` ban survive as
  Q-0134's. The surviving `blocker` needle becomes the enforcement of AC-9's import rule — a screen
  taking its labels from `@quorum/shared` cannot write the word. A new clause forbids
  `dangerouslySetInnerHTML` (AC-8).
- **`packages/shared/src/wire.ts`** — the JSDoc clause listing what a question carries was a count
  of another shape's fields written down a second time, and it went stale the day the union widened.
  Replaced with the property (the element **is** `GateQuestionEvent`) rather than a longer list.
- **`apps/web/src/gate-screen.tsx`** module header no longer routes the verdict half to this ticket.

---

## 5. Two clauses placed in a sibling package, with the reason

Both are deliberate and both are stated in the code that carries them.

1. **AC-1's *"asserted over `contracts/Q-0050/run-messages.fixture.json`"*** is carried by
   `packages/core/src/engine/run-composition.test.ts`, which already imports that fixture and whose
   Q-0052 AC-14 oracle had to be re-aimed anyway. **`reached` is not added to the fixture, and that
   is the ruling**: that file is the oracle for the **message formats** a run emits — every leaf of
   its `gate` object is a placeholder string — and `reached` carries no message, so it has no format
   for that oracle to hold. The assertion is narrowed rather than widened: the four keys the fixture
   names are carried, plus `reached` where a verdict-declaring step reached the gate, and the
   author-declared case with no preceding verdict still matches the fixture's set exactly, which is
   what keeps that half a check on the oracle rather than on this addition. The schema clauses of
   AC-1 are in `packages/shared/src/events.test.ts` where the schema is.
2. **AC-6's `development.yaml` clause** is in `packages/shared/src/flow.test.ts`, where the shipped
   flows are already a declared turbo input. Asserting it in `packages/core` would have earned that
   task a named input and a `MANIFEST` row for one sentence, and the claim — that one shipped flow
   declares no verdict anywhere — is about the flow corpus rather than about the engine. It is an
   **identity** rather than a count of the zeroes: `{chore: 2, development: 0, qa-red: 1,
   requirements: 1, review: 1, solutioning: 1}`, so a flow that started declaring one fails by name
   as readily as one that stopped.

---

## 6. Three things the work measured that are worth more than the code

**The AC-2(b) needle was keyed on the wrong thing and a probe walked through it.** The first draft
required the receiver's name to carry `event`, `gate` or `step`, so that `(thrown as Error).message.split`
in `lint.test.ts` would not be collected. A mutation reaching the same field through
`.event?.message` off a cast was **invisible to it** — a guard talked out of firing by a spelling,
which is Q-0079 round 2's shape. Measured instead: across all three trees exactly **two** sites
parse a `message` at all and both are an `Error`. So the needle is keyed on the **act** and the two
exceptions are a register, which forbids every parse, names what may, and fires in both directions.
Strictly stronger than the heuristic and shorter.

**A guard's fixture caught a real defect in my own code before any reviewer did.** Writing
`data-verdict={reached.verdict}` put the literal `verdict=` into `apps/web/src` and turned Q-0015
AC-6 red. The needle is measured — that token occurs nowhere in that corpus — so weakening it to
admit a JSX attribute would have stopped it forbidding what it was measured for. The attribute was
renamed and the reason written where the next person will meet it.

**The `contracts/` fixture flow had to be shaped by the linter rather than by preference.** The
`DECIDING_GATED_FLOW` added to `packages/server/test/fixture.ts` needed `on_exhausted: gate` and an
`input.backlog` naming its own written file, because `lintFlow` refuses a backward edge whose target
never receives what the failing step writes — *"the loop cannot converge"*. Found by running it, not
by reading.

---

## 7. Blocked — AC-12's contract clause

**What I cannot do.** AC-12's first clause requires
`contracts/Q-0050/run-events.contract.md` to gain a superseded-by note beside its
`GateQuestionEvent` block, and its *Test:* clause requires a guard asserting that note names the
decision entry by title and date.

**The authority.** `contracts/` is not among `developer-generalist`'s `paths:`
(`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.npmrc`, `.gitignore`,
`.github`, `packages`, `apps`, `harness`, `docs`, `README.md`, `eslint.config.js`,
`vitest.shared.js`). Every commit that has ever touched that directory came from the **architect**
in the solutioning flow or from a hand fix. This is *"A requirement may not name a surface its flow
cannot write"* (2026-08-25) — the same rule the merged requirement's own §11 cites when it strikes
candidate-codex's AC-2 for making the decision entry an acceptance criterion. `contracts/` was
missed one criterion later.

**What I did instead.** Everything else in AC-12, including its second and third test clauses:

- the source clause asserting **no file under `packages/server/src` or `apps/web/src` still routes
  the decision to this ticket** is written and green, keyed on the **routing** forms (`Q-0129's`,
  `Q-0129 adds`, `Q-0129 will`, `Q-0129 owns`) rather than on the ticket id, because provenance —
  *"completed by Q-0129"* — is a true sentence an over-broad needle would have forbidden, and both
  directions are demonstrated over the retired sentence and the one that replaced it;
- **both re-aimed register clauses are shown red against their replacements**: mutation 12 above for
  `routes.test.ts`, and the new `not.toMatch(/Q-0129's/)` negative in `docs.test.ts`.

**I did not write a deliberately failing guard for the missing note.** A red suite would fail
`integrate` after the gate rather than at it, and the honest channel for *my work is done and this
one thing is yours* is this verdict — which is what Q-0117 exists to provide.

**The note, ready to paste.** Immediately after the `GateQuestionEvent` block (or beside the
`undecided` paragraph at line 49, which is the shape that file already uses three times):

> `GateQuestionEvent` gained one optional field, `reached`, by Q-0129 — superseded by *"A gate
> question carries the decision that reached it"* (2026-09-17). It is whole or absent, never partly
> present, and carries the deciding step's id with the `verdict`, `findings` and `summary` that step
> returned. The "no timestamp, no sequence number, no run id" rule below is unchanged and still
> governs the payload a consumer reads; the `gateId` clause is unchanged, and `reached` exists
> precisely so that nothing has to be parsed out of one.

Then the guard AC-12 asks for — it belongs in `packages/shared/src/docs.test.ts`, which already
reads `docs/DECISIONS.md`, and would need `../../contracts/Q-0050/run-events.contract.md` declared
in `packages/shared/turbo.json` with a `MANIFEST` row. I have not written either, because a guard
over a note that does not exist is a check with no subject.

---

## 8. Reported and not fixed

**A residual in the parallel case, stated rather than left to be found.** A member that reaches its
**own** exhaustion gate sees its own decision, because the slot is assigned before `handleFail` is
called. But `handleFail` awaits `recordOccurrenceEvent` before building the question, so a sibling
member finishing in that window can overwrite the slot first. Closing it means a per-call context,
which the landed note on `RunContext` — *"A step receives this object itself, never a copy"* —
argues against, and AC-3 scopes reconciliation to after the group settles. **No shipped flow
reaches it**: no `parallel:` member declares a verdict at all, let alone one with `on_fail`.

**Fan-out children are not reconciled, and the requirement does not cover them.** `runFanOut` runs
agent steps concurrently too, and AC-3's exception names `parallel` alone. I implemented exactly
that rather than choosing for the uncovered case. Today it is unreachable —
`development.yaml` declares zero verdicts, which is the clause I added to `flow.test.ts` — and it
becomes live the first time a fan-out task declares one.

**A pre-existing lint warning I did not touch.** `packages/core/src/backlog/backlog.ts:448` carries
an unused `eslint-disable-next-line no-control-regex`. `pnpm lint` exits 0 (warning, not error) and
the file is outside this change; reporting rather than fixing is
`.claude/rules/engineering.md`'s rule for something found in code I was not sent to change.

**A sweep flake that is not mine.** The first `pnpm sweep:git-identity` run failed on
`packages/core/src/adapters/exec.test.ts` — *"the truncated prompt is recorded rather than
swallowed"*, which asserts an EPIPE note appears when a child exits before draining a 512 KB stdin
write. Runs 2 and 3 were green, and the file alone passes. It is a write/exit race that flips under
load, in a file and a subsystem this change does not touch, and it is **Q-0102's** subject rather
than a claim about this branch. Recorded as 1 failure in 3 sweeps rather than characterised.

---

## 9. Verification

- `pnpm install --frozen-lockfile` → up to date.
- `pnpm turbo run test lint typecheck --force --continue` → **21 successful, 21 total, 0 cached**.
  3,161 tests passed, 2 skipped. (`@quorum/core` 1,567 / `@quorum/cli` 692 / `@quorum/web` 425 /
  `@quorum/shared` 259 / `@quorum/server` 215.)
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → green twice, with the one unrelated failure recorded above.
- Twelve mutations, each red with a discriminating message, each reverted and re-verified.

**Not done and stated rather than implied:** GO-5's both-environment-row verification is the
operator's at the close, and this run was performed in one worktree; and GO-6 — the product run by
hand, with what it rendered transcribed into `runs.log` — is the operator's and cannot be performed
from here.
