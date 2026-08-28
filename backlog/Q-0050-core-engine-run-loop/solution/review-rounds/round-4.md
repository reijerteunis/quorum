# Architecture review — Q-0050 solution, round 4

*Reviewer: architecture-reviewer · 2026-08-28 · verdict **revise***

Reviewed against `requirements/merged.md` (13 criteria), `harness/architecture.md`,
`harness/rules.md` and charter §2/§6. Artifacts read in the solutioning worktree
`.harness/worktrees/harness__Q-0050__contracts` at `a0fbccb`, not from the document's
description of them; every preservation claim was checked against `spike/src/engine.js`.

**Process note.** Run 2's exhaustion gate was answered `retry` at 16:39, authorising exactly
one further traversal. This is that traversal. A `revise` verdict exhausts the loop and
re-presents the gate; the findings below are written to be closable in one pass, by hand at
the gate if that is cheaper than a fifth round.

## What is right, and should not be re-litigated

The design half is settled and I would not reopen it.

- **The channel shape is correct.** Lazy start, single consumer, lossless FIFO, `answerGate`
  as an out-of-band callback, `AbortSignal` for cancellation, terminal-event-then-throw, and
  `return()` as the abandonment signal. This resolves OQ-1 (a), OQ-2 (widen the union),
  OQ-3 (preserve and pin) and OQ-6 (lazy with a queue) exactly as the requirement recommended,
  and the rejected-alternatives section gives real reasons rather than taste.
- **`run-events.contract.md`:35-58 is the strongest artifact here.** The nested
  `z.discriminatedUnion('status', …)` inside one outer `type: 'terminal'` option is the right
  call, and the note that the outer union's discriminator requires unique type literals is the
  kind of detail that saves an implement round.
- **The fixture's literal text is faithful where it exists.** I compared all seven templates
  against `engine.js:67`, `:146`, `:545`, `:548`, `:571`, `:644` and `:651`, including the
  double space in the banner and the three-then-two spacing in the terminal info line. Six of
  seven are exact.
- **The eight preserved defects are enumerated with per-site dispositions**
  (`lifecycle-routing.contract.md`:79-86), and the branch-head seam is honestly scoped: the
  contract states plainly that injecting `readBranchHead` tests the consumer's response to
  `null` and does **not** witness `fanout.safe()` swallowing the underlying failure, leaving
  that to Q-0074. That is the correct answer to AC-12 and it resists the quiet-fix hazard.
- **AC-12's `dev/implement-report.md` clause is correctly identified as unsatisfiable on this
  route** (`lifecycle-routing.contract.md`:75-77). Confirmed: `dev/implement-report.md` is
  written only by `chore.yaml:16`; `development.yaml:27` writes `dev/integration.md` and
  `dev/green-report.md`. Making the contract table the durable enumeration is the right remedy.
- **Cross-vendor fan-out is real.** `backend` (codex) owns shared-events, routing, lifecycle,
  documentation; `tooling` (claude) owns loaders, types, channel, engine-compose. Both may write
  `packages/core` and `packages/shared` per `harness/architecture.md`, every concrete file has
  exactly one owner, and the argument that `tooling` is a live fan-out role is correct.

## Blockers

### B-1 — `outcome()`'s contracted return type contradicts the history entry it must preserve

`run-flow-api.contract.ts:32` declares:

```ts
export declare function outcome(context: LifecycleContext, status: RunStatus, fields?: FinishFields): RunOutcome;
```

with `RunOutcome extends Readonly<Record<string, unknown>> { status; stage; cost; runId: number }`
(`:17`). The spike's `outcome` (`engine.js:655-657`) returns the eight-field history entry:

```js
{ stage: after, run: ctx.runId, flow: ctx.flow.name, status, stage_before: before, stage_after: after, at, cost }
```

validated by the **landed** `ticketHistoryEntrySchema` (`packages/shared/src/ticket.ts:29-48`),
whose key is `run: z.number()` — not `runId`. Three separate failures follow:

1. **The required key is wrong.** An object carrying `run` does not satisfy `RunOutcome`, which
   requires `runId`. The implementer's only typechecking escape is to emit `runId` *into the
   history entry* — the schema is `z.looseObject`, so it would be accepted at run time and
   silently written into every ticket's frontmatter. That contradicts the requirement's
   cross-cutting checklist (*"No change to … `ticket.md`'s frontmatter shape"*) and charter §2.
   A defect that typechecks and persists is the worst available outcome.
2. **The `before`/`after` pair is gone.** `finish` calls `outcome(ctx, from, ticket.meta.stage, …)`
   with *distinct* values; `recordEvent` calls `outcome(ctx, stage, stage, …)` with the *same*
   value. The function table in the requirement names this: *"`stage` and `stage_after`
   deliberately duplicated"*. With no parameters, one signature cannot produce both shapes.
3. **`cost` is gone.** `finish` passes `round(ctx.stats.cost)`; `recordEvent` passes `0` for the
   exhausted entry. AC-6 requires that exhausted entry present on disk *before* the gate resolves.

**Consequence for QA:** AC-6's "exhausted entry on disk" test and AC-9's "history entry appended
for every status" test are written this week against a signature that cannot produce the entry.
The break surfaces at integrate, in `lifecycle.ts`, owned by one task that may not change
`types.ts`.

**Remedy:** type `outcome` against the landed entry — e.g.
`outcome(context: LifecycleContext, before: string, after: string, status: RunStatus, cost: number | null): TicketHistoryEntry`,
importing the inferred type from `@quorum/shared`. Note `cost` is `z.number().nullable()`.

### B-2 — `finish()` drops the target-stage and note parameters with no named replacement

Spike: `finish(ctx, stage, status, note, fields = {})` (`engine.js:618`). All six call sites pass
a stage explicitly — `targetFlow.consumes` (`:147`), `flow.produces` (`:173`),
`ticket.meta.stage` (`:60`, `:79`, `:158`, `:167`) — and three pass a `note`.

Contract: `finish(context, status, fields?)` (`:31`) and `RoutingContext.finishRun(status, fields?)`
(`:18`). Neither parameter survives.

- **The regression stage has no input.** `completed` can derive `flow.produces` from `ctx.flow`,
  but AC-8 requires the regressed finish to land on the **target** flow's `consumes`, which is
  knowable only to the caller. `lifecycle-routing.contract.md`:15-16 says *"Move the stage only
  for completed and regressed"* and never says **to what value** for regressed. It could be
  smuggled through `fields.stageAfter`, but no contract clause says so — and
  `run-events.contract.md`:50 treats `stageBefore`/`stageAfter` as *terminal event output*
  fields, which is the opposite reading. `routing.ts` and `lifecycle.ts` are separate tasks with
  no edge between them; they must agree on a protocol nothing writes down.
- **The failure cause has no named home.** AC-5 requires
  `finish(…, 'failed', <first 200 chars of the first line>)` and AC-9 requires the terminal log
  line's optional JSON-quoted error suffix. `run-events.contract.md`:53-55 says `error` is present
  *"only when `finish` receives an error/note field"* — referring to a parameter the signature does
  not have, through a `FinishFields` bag with no named `note` key.

**Remedy:** restore both as named parameters —
`finish(context, stage: string, status: RunStatus, note: string | null, fields?: RegressionFields)`
— or state explicitly, in `lifecycle-routing.contract.md`, which `fields` key carries the target
stage and which carries the note, and mirror that in `RoutingContext.finishRun`.

### B-3 — No stub for `packages/shared/src/events.ts`, against the contract's own standard

`module-layout.contract.md`:28-32 commits the architect to stubs *"so tests fail on assertions
rather than resolution"* — and then scopes them to the six `core/engine` files only. Confirmed on
disk: `contracts/Q-0050/` plus six engine stubs, nothing under `packages/shared/`.

The QA contract has QA extend `packages/shared/src/events.test.ts` for *"strict terminal and answer
schemas"*. Those tests must import `runTerminalEventSchema`, a `gateAnswerEnvelopeSchema` and a
`gateId` field on the gate member. None exists — `events.ts:179` is
`gateQuestionEventSchema = z.object({ type: z.literal('gate'), … })` with no `gateId`. The red
tests therefore fail at module resolution and `pnpm typecheck`, not on an assertion.

That is the failure mode the port's other children created stubs to avoid, and it is the
*"red for the right reason is an engine property"* line (2026-08-22): a suite that fails because a
symbol is missing has not tested the schema's strictness, its discriminated union, or its
unknown-key refusal — the three things AC-3 actually asks for.

**Remedy:** add throwing/placeholder declarations to `packages/shared/src/events.ts` on the
solutioning branch — the terminal member, `gateAnswer`, the envelope, and `gateId` on the gate
member — exactly as the six engine stubs do, and extend `module-layout.contract.md`:28 to name
seven files rather than six.

## Majors

### M-1 — The named message oracle omits every `runs.log` format the criteria assert

`lifecycle-routing.contract.md`:3-5 states that *"Exact user-visible messages **and line formats**
come from `contracts/Q-0050/run-messages.fixture.json`; implementations do not paraphrase them"*,
and the QA contract calls it *"the single exact-message oracle"*. The file has seven entries, all
terminal-UI templates. It contains:

- **no `runs.log` line formats at all** — not the terminal line
  (`run=N <status> stage=from→to cost=X tokens=Y error="…"`, `engine.js:650`), not the rolled-back
  line (`:645`), not AC-7's retry-grant line, not AC-4(7)'s `gate=<kind> answer=<answer>` line;
- **no template for the exhaustion gate's `reason`** — the fixture's gate entry is bare
  `"<reason>"`, while `engine.js:552` builds a specific sentence naming the step, counter, value,
  limit and the three choices, which AC-6 requires asserted;
- **no definition of `<unpricedSuffix>`** — `engine.js:650` builds
  `  (+N unpriced step{s} — vendor reports no price)` with a pluralisation branch, and it is part
  of the very terminal line AC-2 requires byte-identical.

AC-4(7), AC-6, AC-7 and AC-9 all demand exact log-line equality. QA pointed at this oracle will
either block or invent the strings, and an invented string that both suites agree on is a silent
behaviour change — the precise hazard charter §2 exists to expose.

**Remedy:** extend the fixture with a `log` section covering the four line formats, the exhaustion
`reason` template, and the unpriced suffix including its plural branch; or narrow the contract
sentence to "messages" and name `spike/src/engine.js` as the transcription source for log lines.

### M-2 — `RunOutcome` and `FinishFields` are open bags, re-opening the defect round 3 closed

`module-layout.contract.md`:35 promises *"`RoutingContext` and `LifecycleContext` are complete
named seams, not open objects or `unknown` placeholders"*, and the resolution table claims B-1 and
B-2 closed on that basis. The two context types do honour it. But the payload types do not:

```ts
export interface FinishFields { readonly [key: string]: string | number | undefined }
export interface RunOutcome extends Readonly<Record<string, unknown>> { status; stage; cost; runId }
```

`RunOutcome` extending an index signature disables excess-property checking entirely — any object
with those four keys and any other keys satisfies it. So AC-3's *"refuses unknown keys like the
other eight members"* has a runtime guard and no compile-time counterpart, and the seven regression
fields the contract is careful to make a discriminated union at the schema layer are an untyped
string/number bag at the API layer. This is round 3's finding wearing different clothes, and it is
what makes B-1 and B-2 survivable enough to reach integrate rather than failing loudly at the seam.

**Remedy:** name the regression payload as a closed interface and make `RunOutcome` a plain
interface with an explicit optional regression group, dropping the `Record<string, unknown>` base.

## Nits

- **The Q-0052 boundary change is well argued but not routed.**
  `lifecycle-routing.contract.md`:33-36 deliberately moves gate policy for author-declared
  `step.gate` into Q-0050, against the requirement's stated Q-0052 non-goal, and says so plainly.
  I agree with the reasoning — AC-4's `auto`/`--auto`/`--dry`/`human-locked` clauses need one
  owner. But nothing writes it into Q-0052's ticket body, and per *"a deferred obligation dies
  unless it is written into the next ticket's body"* it will be rediscovered as a surprise. Add it
  to the gate actions.
- **QA may still write the unsatisfiable report test.** The `dev/implement-report.md` impossibility
  is stated in `lifecycle-routing.contract.md`:75-77 but not repeated in the solution's QA contract
  section, which is what a qa-red step reads first. One sentence there would close it.
- **`types.ts:6` declares a local `GateQuestion`** structurally duplicating shared's
  `gateQuestionEventSchema`. Once shared gains `gateId` the two can drift silently. Prefer
  importing the inferred type from `@quorum/shared`.
- **Typecheck was never run**, as the document honestly admits (no `node_modules` in the worktree).
  I verified the imports resolve — `Event`, `Flow`, `Role` via `packages/shared/src/index.ts`'s
  `export *`, `TicketRecord` at `backlog.ts:30`, `FlowError` at `lint.ts:29` — so the stubs are
  probably compilable. B-1's `runId`/`run` mismatch is the one that would not have survived a real
  `tsc --noEmit`, which is the argument for running it before the next gate.

## What would make this an approve

B-1 and B-2 are signature corrections in `run-flow-api.contract.ts` plus two clarifying sentences
in `lifecycle-routing.contract.md`. B-3 is a stub file. M-1 is an extension to a 9-line JSON
fixture. M-2 is two type edits. None requires redesign — the architecture is right, and the round-4
document is a genuine improvement on round 3. The defects are all in the layer where the contract
meets the preserved behaviour, and all four blockers/majors are the same underlying miss: the typed
contract was written from the *intended* API rather than checked against the spike's actual
signatures. One pass over `engine.js:618-664` with the contract open beside it closes every one.
