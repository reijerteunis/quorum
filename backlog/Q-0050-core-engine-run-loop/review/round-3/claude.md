# Review — Q-0050 round 3

*Reviewer: claude · 2026-08-29 · read at `harness/Q-0050/integration` (`8355940`), against `main`, `spike/src/engine.js`, `requirements/merged.md`, `solution/solution.md`, `solution/errata.md` E-1–E-17, `contracts/Q-0050/**` and `docs/decisions/062-what-a-runs-event-stream-carries.md`.*

**changes-requested — five majors and five nits. No blocker.**

Round 2's four majors and four nits are **all genuinely closed**, and I checked each against the code rather than against the fix report: the manifest is finalised inside `finish` between the stage assignment and the ticket write (`lifecycle.ts:24`, E-14); the channel latches (`channel.ts:56`, `:94`, `:107`, `:113`); the interrupted note comes from `AbortSignal.reason` and `categoryOf` takes the status (`engine.ts:56-61`, `:98-102`, E-16); `engine.test.ts` now drives `runFlow`'s own `finaliseAbandonment` through a `for await` that breaks at a gate; `routing.ts:99` logs `set=${String(step.retryMax)}`; the subscription alternation gained three APIs (`q0050.source.test.ts:66`); and E-15 and E-17 supply the two missing sentences. Nothing from round 1 or round 2 reappears below.

**I executed the suites rather than reading the tick,** in `.harness/worktrees/harness__Q-0050__integration` at `8355940`: `packages/core` **897 passed / 2 skipped** over 42 files (`src/engine` alone: 6 files, 60 tests), `packages/shared` **107 passed** over 11 files, `tsc --noEmit` exit 0, `eslint packages/core/src/engine packages/shared/src/events.ts` exit 0. Every finding below is green today; four of the five majors are things a green suite cannot see.

---

## Majors

### M-1 — every step gets a *copy* of the run context, so state a step writes for a later step is silently discarded

`packages/core/src/engine/engine.ts:213` · **production** · confirmed by reading both trees

```ts
const stepContext: EngineContext = { ...context, emit: withStepId(emit, stepId) };
const result: StepResult = await runStep(step, stepContext);
```

A fresh object per step, per re-entry through a backward edge. Object-valued fields survive because they are mutated in place — `counters`, `vars`, `stats` — and that is why nothing fails today. **Anything a step *assigns* to its context is lost the moment the step returns**, and the spike does exactly that, from inside one step, for another step to read:

| written | by | read | by |
| --- | --- | --- | --- |
| `ctx.fanned` | `engine.js:940`, `:954` (`runFanOut`) | `:982`, `:1073` | `runIntegrate` |
| `ctx.failingTasks` | `engine.js:1074`, `:1080` (`runIntegrate`) | `:932-933` | `runFanOut`, for `scope: failing-tasks-only` |
| `ctx.lastIntegration` | `engine.js:1071` (`runIntegrate`) | `:957` | the task prompt's *Previous integration result* section |

Q-0051's `ctx.diffInputs` and `ctx.deferredDiffs` are safe by accident — they are `Map`s created at context construction, so they are on `context` before the spread. The three above are created **by a step**, and a `RunContext` field declared and initialised in `engine.ts` would not save `lastIntegration` either, because a step *assigns* a string to it.

Three silent failures follow, all in Q-0053, none of which throws: a failed integrate re-runs **every** task instead of the failing ones (the feature the development plan records as shipped with the fan-out and exercised by Q-0033); `branches` resolves to the empty list where a wildcard `into` pattern is used; and the re-run implementer never sees why the last integration failed. No test can catch this until Q-0053 exists, and by then the seam is written.

The ticket body calls this file *"the run context every other engine ticket writes into"*, and the port has quietly made that false. AC-12's own rule applies to the port's own design as much as to git's exit codes: *an unstated answer is what lets the next reader assume the question was considered*. Nothing in `types.ts`, `module-layout.contract.md` or `solution.md` states that a step's context is a copy.

**Remedy** — the copy exists only to carry the step id into `emit`. Three shapes, cheapest first: put the current step id on the shared context (`context.currentStepId = stepId`) and let one `emit` closure read it; or set `context.emit = withStepId(...)` before the call and restore it after, in a `finally`; or pass the step-scoped emitter as a second argument and stop copying. Whichever is chosen, `types.ts` should say in one line that the context handed to a step is the run's own object, so a later ticket can rely on it.

**Who can perform it:** a development revise round — `engine.ts` is owned by `q0050-engine-compose`; if the fix adds a field, `types.ts` is `q0050-engine-types`'s, so name both in the round.

---

### M-2 — AC-10's two mandated `Why: preserved defect, see Q-0050 AC-10.` lines are absent, and nothing looks for them

`packages/core/src/engine/engine.ts:121` and `packages/core/src/engine/lifecycle.ts:19-30` · confirmed by grep over the whole folder

AC-10 names both preserved dry-run mutations and then says, in as many words: *"Both carry one line naming the authority — `Why: preserved defect, see Q-0050 AC-10.`"* AC-13 repeats the obligation for every preserved defect. Neither site carries it. Grepping `packages/core/src/engine/*.ts` for `Why: preserved defect, see Q-0050` returns **five** lines and not one of them is AC-10's:

```
engine.ts:155   … AC-12.   (branchHead conflation, start-of-run)
engine.ts:210   … AC-12d   (unknown goto → TypeError)
lifecycle.ts:33 … AC-12.   (branchHead conflation, rollback read)
routing.ts:25   … AC-4.    (signalWindow)
routing.ts:62   … AC-12.   (parallel member dispatched as an agent step)
```

- **The in-memory ticket is still advanced under `--dry`.** `finish` runs `ticket.meta.iterations = context.counters` (`lifecycle.ts:19`), the stage assignment (`:22`) and the history push (`:30`) with no `dry` guard, exactly as the spike does. The file has a comment about the *stage argument's* type at `:20-21` and none about the defect.
- **The run's counters alias `ticket.meta.iterations`.** `engine.ts:121`'s `const counters = ticket.meta.iterations ?? {}` returns the existing object when one is present, so `handleFail`'s write lands on the frontmatter object immediately, dry or not. The only trace is a descriptive JSDoc on `RunContext.counters` (`types.ts:124`) — *"an alias, not a copy"* — which is a fact about a field, not an authority for a defect, and is in a third file.

This is not bookkeeping. Both defects are *positively pinned by tests* (`engine.test.ts:193`, `:255-257`), so the next reader who removes them will fail a test they cannot explain, and the annotation is the thing that would have explained it. The ticket's own risk section says four of its preserved defects *"look exactly like tidy-ups"*; this is the one class where the annotation is the entire defence.

`q0050.source.test.ts:103` scans for `AC-12` annotations only, so the omission is invisible to the suite — which is why it survived a fan-out, an integrate, a forced suite and two review rounds.

**Who can perform it:** a development revise round for the two source lines (`engine.ts`, `lifecycle.ts` are owned); the guard extension is a test file, so QA or hand.

---

### M-3 — the traceability table names two tests that do not exist, and one of its claims is false about the code

`backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:75` and `:90` · confirmed by grep across all six engine test files

Round 2's M-4 was a coverage row naming a file with nothing on its subject. Two more rows are in that state, and one is worse than empty.

**AC-9f (`:75`)** reads: *"`lifecycle.test.ts` — AC-9f: the payload and terminal event carry the raw `1.23456`, the history entry carries the rounded `1.235`. Both halves; the rounded one was unasserted until 2026-08-29."* There is **no test mentioning AC-9f** in any engine test file, and no assertion anywhere on `1.235`. `lifecycle.test.ts:55` asserts `cost: 1.23456` on `finish`'s returned payload inside the five-status test, and that is the whole of it. The history entry's rounded cost is asserted by nothing; the terminal **event's** cost is asserted by nothing.

And the row's middle claim contradicts the code. `lifecycle.ts:53-54` puts `cost: roundedCost` on the terminal event; `:64` returns `cost: context.stats.cost` **raw**. So the terminal event carries `1.235`, not `1.23456`. That divergence is itself undecided: AC-3's test line requires the terminal event to carry *"fields equal to `finish()`'s values for the same run"*, and on `cost` it does not. Nothing catches it because every `engine.test.ts` run has `stats.cost === 0`, where rounded and raw are the same number.

**AC-13d (`:90`)** reads: *"`q0050.source.test.ts` — AC-13d: a register of the five preserved-defect sites by file and authority, asserted as an identity map rather than a count."* There is **no test mentioning AC-13d**, and the check that exists is the opposite of what the row describes:

```ts
// q0050.source.test.ts:103
expect((`${engine}\n${lifecycle}`.match(/Why: preserved defect, see Q-0050 AC-12\./g) ?? []).length)
  .toBeGreaterThanOrEqual(2);
```

A `toBeGreaterThanOrEqual` floor over a concatenation of **two** of the five annotated files. It cannot say *which* site is annotated: moving both `AC-12.` lines into `engine.ts` and leaving `lifecycle.ts`'s rollback conflation bare passes. That is precisely the shape Q-0073 closed six days ago and wrote down — *"a count is not an identity: the no-contraction guard was two `toBeGreaterThanOrEqual` floors … and is now a register of `file: literal` identities"* — and the row is describing Q-0073's remedy while the test is Q-0073's defect.

**Remedy.** Either write the two tests the rows name — an identity register `{ 'engine.ts': ['AC-12.', 'AC-12d'], 'lifecycle.ts': ['AC-12.'], 'routing.ts': ['AC-4.', 'AC-12.'] }` covering all five sites plus M-2's two new ones, and an AC-9f test asserting the three cost values apart at a non-zero, non-round `stats.cost` — or mark both rows `— none (struck, E-nn)` with the reason, as E-8 correctly did for eight others. What may not stand is a row that reads as covered and is not.

**Who can perform it:** a test file plus `qa/scenarios.md` — QA or hand, not a development revise round. The raw-vs-rounded `cost` question needs a ruling first: state which value the terminal event carries and why, in `solution/errata.md`.

---

### M-4 — four entries of the "single oracle for exact event and log text" are asserted by nothing, including AC-9's terminal `runs.log` line

`contracts/Q-0050/run-messages.fixture.json` · `packages/core/src/engine/*.test.ts`

Eleven of the fixture's entries are read through it. **Four are read by no test at all** — `log.terminal`, `log.errorSuffix`, `log.start` and `unpricedSuffix` — and two more (`log.gateAnswer`, `log.retryGrant`) are matched as hand-written literals that bypass the oracle.

The record is honest about this: `scenarios.md:51` names all six and says they are *"named here rather than counted as covered"*. That disclosure is the right instinct and I am not treating it as concealment. It does not, however, make the criteria met, and two of the four have teeth:

- **`log.terminal` is AC-9's own subject.** AC-9 says *"Two `runs.log` lines keep their exact format: the terminal line with run number, status, `stage=from→to`, cost, tokens and an optional JSON-quoted error suffix, and the rolled-back line."* The rolled-back line is pinned byte-for-byte through the fixture (`lifecycle.test.ts:157`). The terminal line is matched by `expect.stringMatching('run=7 <status> stage=')` (`lifecycle.test.ts:57`) — a prefix — and by `/run=1 interrupted stage=draft→draft .*error="received SIGINT"/` (`engine.test.ts`), whose `.*` steps over `cost=` and `tokens=` entirely. So the segment AC-9 enumerates is the segment nothing checks. `scenarios.md:72` lists `log.terminal` in AC-9a–9c's fixture column while `:51` says it is not asserted; the table disagrees with itself.
- **`unpricedSuffix` has a plural branch and no test.** `lifecycle.ts:47-49` computes `step` vs `steps` from `context.stats.unpriced > 1`. Every test in the folder runs with `unpriced: 0`, and `engine.test.ts:105` interpolates `unpricedSuffix: ''`. Both branches of a user-visible string preserved byte-for-byte from `engine.js:650` are unexercised, including the two-space prefix that makes it join correctly.

**Remedy.** Three assertions: one terminal `runs.log` line rendered whole from `fixture.log.terminal` at a non-zero cost with a note, and two `terminalInfo` renders at `unpriced: 1` and `unpriced: 2`. That closes AC-9's stated criterion and both plural branches. `log.start` is worth one more, since `nextRunId` parses it.

**Who can perform it:** test files — QA or hand.

---

### M-5 — the landed decision entry is contradicted by the code in two clauses, and the correction was written where no future reader will look

`docs/decisions/062-what-a-runs-event-stream-carries.md` · `solution/errata.md` E-12, E-17

`.claude/rules/docs-and-decisions.md` is unambiguous: *"A landed entry is never edited — reversing one is a new entry that names the old one"*, and *"Never contradict an entry silently."* Two of 062's sentences are now false of the shipped code, and both corrections were written into `solution/errata.md`, which is not a decision entry and which E-9 itself records as read by no flow on this route.

1. **062, gate paragraph:** *"Automatic and dry short-circuits run **before** a question is allocated."* They do not. `routing.ts:84` and `:128` build the whole `GateQuestionEvent`, `gateId` included, and `askGate` evaluates `auto`/`--auto`/`dry` at `:12-19`, after allocation. `engine.test.ts:122`'s `['1:2','1:3']` pins the skipped id. **E-17 says so in as many words** — *"Supersedes `solution/solution.md`'s … They do not"* — and supersedes only the solution document. The identical sentence in 062 stands.
2. **062, terminal paragraph:** *"a failed run emits its terminal event and the **following** pull throws the existing `FlowError` with a non-empty cause."* It throws whatever the run threw, unwrapped: `engine.ts:274` completes the channel with `toError(error)` and `engine.test.ts`'s AC-12d pin asserts `toBeInstanceOf(TypeError)` on the iterator's rejection. **E-12 rules the contract wrong and the code right**, correctly — AC-11 preserves `loadFlowByName`'s raw `ENOENT` and AC-12 preserves the unknown-goto `TypeError` — and amends `run-events.contract.md` only.

Both rulings are right. The route is what is wrong, and it is the failure mode E-12 itself names one paragraph later: *"The sentence is corrected **before** a later ticket cites it against the code, which is the whole value of writing it down now."* An entry in the ticket's own `solution/errata.md` does not do that. When Q-0051 or M3 reads 062 — the entry `04-architecture.md` and `GLOSSARY.md` now both cite by title and date — it will read two sentences that describe a different engine, with nothing pointing away from them, and the ticket folder that holds the correction will be four months cold.

**Remedy.** One short dated erratum entry in `docs/decisions/`, naming 062 and correcting exactly these two clauses, plus its line in `DECISIONS.md`. `docs/decisions/040` and `043` are the precedent for an erratum-as-entry; Q-0073's E-4 is the precedent for a supersession that spans two trees. Cite E-12 and E-17 as the working; do not restate them.

**Who can perform it: hand, at the gate.** No step on this route may write `docs/decisions/` — `module-layout.contract.md` says so explicitly (*"development cites its title and date but does not create or edit the append-only decision record"*), and `q0050-documentation` owns two documents, neither of them this one. This is the precondition-external-to-the-document shape a revise round will burn a loop on if it is asked to close it.

---

## Nits

### N-1 — `docs/04-architecture.md`'s status line was not bumped

`docs/04-architecture.md:3`

`.claude/rules/docs-and-decisions.md` and `docs/README.md` both say the numbered documents are edited in place *"and bump the status line at the top with the date and what changed."* This change rewrites principle 2 — its largest edit since Q-0041 wrote it — and the status paragraph still ends at Q-0072. Q-0041, Q-0064, Q-0047, Q-0071 and Q-0072 each added their sentence; Q-0050 did not.

The precedent is not only in the file, it is in the test file this change extends: `packages/shared/src/docs.test.ts:131`, *"the status line of every document this change edits was bumped"*, asserts `Q-0041` in that exact paragraph. The new `Q-0050 AC-13b` describe sits directly beneath it and checks tokens only. `GLOSSARY.md` carries no status line and is correctly untouched in this respect.

**Who can perform it:** a development revise round — `q0050-documentation` owns the file. One sentence, and one line added to the AC-13b test if you want it to hold for Q-0051.

### N-2 — a self-comparison that cannot fail is standing in for the counter-alias assertion

`packages/core/src/engine/engine.test.ts:193`

```ts
expect(opts.ticket.meta.iterations).toBe(opts.ticket.meta.iterations);
```

`x === x`. It reads, in the abandonment test, as the counters-alias assertion its neighbours make, and it asserts nothing. The dry test's `expect(opts.ticket.meta.iterations).toBe(originalIterations)` (`:257`) is the real version — it captures the object *before* the run. Either capture the pre-run reference here too, or delete the line; leaving it is *"a check that skips its subject must not report success"* (2026-08-25) in one line.

### N-3 — the stage-precondition test asserts half of its own title

`packages/core/src/engine/engine.test.ts:226-236`

Titled *"rejects a stage mismatch before context construction **or any write**"*, and it asserts four substrings of the message and nothing else. AC-11's own *Test:* line names the missing half: *"a stage-mismatch run asserting the message **and that neither a `runs.log` line nor a run directory was created**"*. The two assertions are already written twelve lines below in the dry test (`:254-255`) and cost nothing to repeat. The code is plainly correct — the throw is the first statement of `run()` — which is exactly why the assertion should be cheap to add rather than left to a title.

### N-4 — `interpolate` drops the spike's `String(s)` coercion

`packages/core/src/engine/loaders.ts:45`

`engine.js:740` is `String(s).replace(…)`; the port takes `template: string` and calls `.replace` directly. The coercion is not decoration — every call site interpolates a value that came out of YAML (`step.run`, `step.branch`, `s.into`, `site.input.diff`), and YAML will hand back a number for `branch: 2` or `run: 2024`. Under the port that becomes `TypeError: template.replace is not a function` at whichever of Q-0051's or Q-0052's call sites reaches it first, in place of the substitution the spike performed. Charter §2 preserves behaviour; restore `String(template)`, or state in the JSDoc that coercion is now each caller's, so Q-0052 writes `String(step.run)` deliberately rather than discovering it.

### N-5 — the opaque gate id is `<runId>:<n>`, which is the two things 062 says no event carries

`packages/core/src/engine/engine.ts:181`

`nextGateId: () => \`${runId}:${(gateSequence += 1)}\``. 062's own paragraph reads *"No event carries a timestamp, a sequence number or a run id. Only the terminal event carries run identity"*, and the gate event's `gateId` renders as `"1:2"` — a run id and a sequence number, in one field, on a non-terminal event. `run-events.contract.md` calls the token opaque, which is the licence, and nothing depends on the format. Either say in the contract that the token is deliberately derived from run and sequence and is not to be parsed, or make it genuinely opaque. It is worth one sentence now because M3 will route answers by this token and someone will read it.

---

## What a revise round can actually close

| Finding | Who can perform it |
| --- | --- |
| **M-1** | development revise round — `engine.ts`; name `q0050-engine-types` too if the fix adds a `RunContext` field |
| **M-2** | development revise round for the two source lines (`engine.ts`, `lifecycle.ts`); the guard extension is a test file — QA or hand |
| **M-3** | test file plus `qa/scenarios.md` — QA or hand. The raw-vs-rounded `cost` half needs a ruling in `solution/errata.md` first |
| **M-4** | test files — QA or hand |
| **M-5** | **hand, at the gate** — `docs/decisions/` is writable by no step on this route |
| **N-1** | development revise round — `q0050-documentation` owns `docs/04-architecture.md` |
| **N-2**, **N-3** | test files — QA or hand |
| **N-4** | development revise round — `loaders.ts` is owned |
| **N-5** | either — one line in `routing.ts`/`types.ts`, or one sentence via `solution/errata.md` |

Two of five majors and one nit are closable by a development revise round. **M-3, M-4, N-2 and N-3 are QA-or-hand and M-5 is hand-only**, so a round that hands all five to the fan-out will spend money proving it cannot write four of them — the split that has already cost this ticket rounds.

---

## Verified this round, recorded so round 4 does not re-derive it

**Executed** in `.harness/worktrees/harness__Q-0050__integration` at `8355940`, via `vitest` directly rather than through turbo so no cache could answer: `packages/core` 41 files passed / 1 skipped, **897 passed / 2 skipped**; `src/engine` alone 6 files, 60 tests, all passing; `packages/shared` 11 files, **107 passed**; `tsc --noEmit` exit 0; `eslint packages/core/src/engine packages/shared/src/events.ts` exit 0. Nothing under `spike/` is touched by the diff.

**Read and confirmed against `spike/src/engine.js`:** the seven owned message texts are byte-identical, including the two-space `unpricedSuffix` prefix (`:650`) and the three-then-two spacing of the terminal `info` line (`:651`); `finish`'s stage rule, counter persistence, history push, rollback quadruple-guard and both log formats match `:618-653`; `outcome` keeps `run` and the duplicated `stage`/`stage_after` (`:656`); `recordEvent` matches `:659-664` and is now the sole owner of that mutation; the manifest is finalised between the stage assignment and the ticket write, as `:625-632` does; `handleFail`'s counter key, increment-before-compare and exhaustion synthesis match `:539-555`; `askGate`'s auto/dry short-circuits, answer log and one-traversal retry grant match `:557-591`; the completed `finish` is outside the try as `:174` is; the cross-flow branch returns before the `vars.iter` increment; `steps.findIndex() === -1` still reaches a raw `TypeError`.

**Read and confirmed elsewhere:** `RunHistory.finalise`'s signature accepts all five engine statuses (`writer.ts:127`); `ErrorCategory`'s `interrupted` member now has a producer (`engine.ts:57`); `packages/shared/src/index.ts` is `export *`, so the three new schemas need no edit there; `docs/decisions/062` exists and is cited by title and date in both edited documents; `docs/04-architecture.md:42`'s public-API line already read `runFlow(opts): AsyncIterable<Event>` and needed no correction; `packages/core/turbo.json` declares the fixture and the temp-repo `harness/harness.yaml`, and `turbo-inputs.test.ts` passes with them.

**Measured:** five `Why: preserved defect, see Q-0050 …` lines in the folder — `engine.ts:155`, `:210`, `lifecycle.ts:33`, `routing.ts:25`, `:62` — and **zero** naming AC-10. Eleven of the fixture's entries are interpolated by a test; `log.terminal`, `log.errorSuffix`, `log.start` and `unpricedSuffix` are interpolated by none. No test file in `packages/core/src/engine/` contains the string `AC-9f` or `AC-13d`.
