# Requirements — Q-0050: `core/engine`, the run loop, routing and the event stream

*Merged requirement, head-of-product, 2026-08-28 · route **full SDLC** · parent Q-0009 · charter §6 row `Q-0050` · depends on Q-0041, Q-0049 · depended on by Q-0051 · register rows 5, 6, 16, 17, 19, 20, 21. Where this document and charter §6's register differ, the register is right. Claims marked **Verified** were re-read in `spike/src/engine.js` today at the line given; three inherited claims were corrected in that pass and are flagged where they appear.*

## Problem

Thirteen children of Q-0009 translate a module. This one designs an interface.

`spike/src/engine.js:37` takes a `ui` object and prints through it, returning `{ status, stage, cost, runId }`. `docs/04-architecture.md:42` specifies `runFlow(opts): AsyncIterable<Event>` — the **one** behaviour change the port authorises (*"The port preserves behaviour; one exception is authorised"*, 2026-08-25). Five tickets queue behind its shape: Q-0051–Q-0053 code against it, Q-0010 renders it, M3's WebSocket transports it.

The design is unfinished in a documented way, and the deferral is explicit. `packages/shared/src/events.ts` ships eight members and hands this ticket four questions by name (**Verified**, `:35-37` and `:142-143`): *"How a gate's ANSWER travels back is not decided here. Q-0050 owns the channel, along with ordering, terminal semantics and error representation."* · *"Ordering, timestamps, run ids and terminal events belong to Q-0050."* That sentence is also the **authority** for this ticket to widen the union if solutioning chooses to, so a reviewer should not cite the `shared` non-goal against it.

Three things are easy to get wrong here and only surface later.

**A gate is a question back.** An `AsyncIterable` carries values one way. `ui.gate` is awaited at `:574` and the run cannot continue until a human answers.

**`runFlow` returns something, and an async iterable has nowhere to put it.** Every exit returns `finish()`'s value and the CLI acts on it — `aborted` becomes exit 2 (`harness.js:604`).

**One safety property breaks silently under the new interface, and the interface is what breaks it.** Register row 6 requires every terminal outcome to reach `runs.log` with counters persisted; an interrupt that refunded its budget was an undocumented route to unlimited retries. An async generator whose consumer stops pulling does not run its `catch` — it runs its `finally`, via the iterator's `return()`. **Verified** at `engine.js:84-172`: `finish()` is called in the `catch` (`:167`) and in the signal handler (`:60`), and the `finally` (`:169-172`) does nothing but remove two signal listeners. A `for await` with a `break` therefore abandons a run with no terminal record at all. This path does not exist in the spike; the port creates it, so it is specified here rather than discovered in review.

## User stories

**As the `maintainer`,** I run a flow and see exactly what I saw yesterday — same lines, same order, same gate prompt, same refusals, same exit code — because a rewrite of the plumbing is not something I should be able to detect from the terminal.

**As the `contributor`,** I read `runFlow`'s type and know what a run emits and how a gate is answered without reading the engine, because the stream is the contract between `core` and everything above it.

**As the `maintainer` again,** when a run stops for any reason — a throw, a cancellation, or my own `break` — I find a terminal line in `runs.log` and my iteration budget still spent, because a bound I cannot trust is not a bound.

**As the `adapter contributor`,** adapter events reach a consumer through one documented run-event contract with the engine adding only the step id, so a new adapter needs no vendor-specific change in the CLI, the daemon or the UI.

**As the `adopter`,** none of this reaches me: no new command, no new flag, no new file, same first thirty minutes.

## Context the implementer should not re-derive

**What is already there.** Q-0041–Q-0048 are `reviewed` and contained. `packages/core/src/` holds `adapters/`, `backlog/`, `contracts/`, `fanout/`, `git/`, `lint/` — **`engine/` and `run-history/` do not exist** (**Verified**), Q-0049 is `draft`, and `core/src/index.ts` is still the one-line scaffold `export const name = '@quorum/core';`, byte-pinned by `fanout.source.test.ts:49`. Two module-private facts constrain the design: `safe()` is **not exported** from `fanout.ts`, so the engine cannot reach a three-valued git answer; and `fanout.test.ts:562` asserts `.quorum` is absent after every fan-out test.

**The run loop, function by function.** All line numbers **Verified** today.

| Export | Line | What must survive |
| --- | --- | --- |
| `runFlow` | `37-174` | Stage precondition **before** the dry substitution; context construction; signal path; step loop; three exit points |
| `runStep` | `176-198` | Dispatch order; `allSettled` over a `parallel` group, never `all`; the survivors message |
| `handleFail` | `539-555` | Counter keying, increment-before-compare, the synthesised exhaustion gate |
| `finish` | `618-653` | Stage moves on two statuses only; counters persisted for all five; branch rollback; two log lines |
| `outcome` | `655-657` | The eight-field history entry, `stage` and `stage_after` deliberately duplicated |
| `recordEvent` | `659-664` | A mid-run history entry that does **not** move the stage |
| `loadFlow` | `15-20` | `flow.file` set on the parsed object; `lintFlow` runs before the flow is usable |
| `loadFlowByName` | `734-736` | **Corrected:** it is `loadFlow(path.join(harnessDir, 'flows', name + '.yaml'))`, so parse **and lint do apply** — Codex was right and Claude's "path join only" understated it. It does no *existence* check, so a missing flow surfaces as `ENOENT` from `readFileSync` rather than a `FlowError` — Claude was right and Codex was silent. Both halves are preserved. |
| `loadRole` | `727-732` | Falsy name yields `{ meta: {}, body: '' }`; missing file throws a `FlowError` naming the full path |
| `interpolate` | `740` | An unknown placeholder is left literal as `{key}`; dotted keys are flat lookups, not paths |
| `writesOf` | `739` | Singular `output.write` before plural `output.writes` |
| `reviewRound` | `753-760` | Highest round directory **containing `verdict.md`**, plus one; 1 when the directory is absent |

`nextRunId` (`744-752`) is **Q-0049's** — its ticket names it among the writer's functions — and is consumed here at `:45`. Its rule is that the id exceeds the highest run in **both** ticket history and `runs.log`, because history gains an entry only on completion and regression, so deriving from history alone hands a failed run's number to the next one. Say so in the module header or a reviewer spends a round on it.

**The `ui` to `Event` map.** Seven Q-0050-owned print sites, each becoming one member. The text is externally observable behaviour that charter §2 preserves, so it is asserted as string equality, not `toContain`.

| Line | Call | Event |
| --- | --- | --- |
| `67` | run banner: run number, flow, ticket, consumed → produced stage | `info` |
| `146` | the backward edge, naming the target flow and the stage it regresses to | `warn` |
| `545` | step id, iteration n of max, goto target | `warn` |
| `548` | step id, `loop exhausted (max)`, human gate follows | `warn` |
| `574` | `ui.gate` with kind, reason, ticket directory, optional retry — **asks** | `gate` + the answer channel |
| `644` | branch, short sha rolled back to, and why | `warn` |
| `651` | run number, status, stage transition, cost, tokens | `info` |
| `652` | the returned `{ status, stage, cost, runId, ...fields }` | **no member today** |

**Corrected, and it matters for AC-3:** the returned object is exactly `{ status, stage: ticket.meta.stage, cost, runId, ...fields }` — it carries **no `tokens`** and no stage-before except via the regression `fields`. The `info` line at `:651` carries tokens; the return does not. A terminal event carrying tokens and stage-before for every status is therefore a deliberate **addition**, not preservation, and must be described as one.

The envelope rule is this ticket's, though most sites applying it are Q-0052's and Q-0053's: an adapter emits no identity and the engine supplies the step id (`:247`); `events.ts` already encodes it as `.extend({ stepId })` on the three adapter members.

**Boundaries, stated so a reviewer need not derive them.** *Q-0049* owns run history — this ticket calls it from four places (`:59`, `:69`, `:164`, `:625-632`) and owns the **lifecycle contract**: a run that started is a run that ended. *Q-0051* owns the diff preflight; this ticket owns only the block's *position*, inside the run try, so a failed preflight receives the same terminal record as any other error. *Q-0052* owns `runGate`'s body, `runAgentStep`, `runScript`, `schemaFor`, `buildPrompt`, `resolveModel`; this ticket owns the **channel** `runGate` asks through and the exhaustion gate's *construction* at `:550-554`, because `handleFail` is this ticket's and the synthesised gate is not a flow step. Charter §8's Q-0050-only item settles the channel at solutioning, before Q-0049–Q-0053 start. *Q-0053* owns fan-out and integrate.

**Five statuses, not four.** Register row 6 enumerates *completed, regressed, failed, interrupted* and omits `aborted`, while the spike writes `aborted` at `:158` for a gate abort. The register enumerates; it does not exclude. All five are preserved, and this paragraph exists so a reviewer does not cite row 6 against the fifth. *(Raised as an open question by Codex; resolved here by reading.)*

**The four routed diagnostics and every site in the loop that consumes one.** All four are pinned in `packages/core/src/fanout/fanout.test.ts` at `:248`, `:331`, `:351`, `:405`.

| # | Defect | Consumption sites |
| --- | --- | --- |
| 1 | `branchExists`/`branchHead` cannot tell "absent" from "git failed" | `:48` start-of-run head and `:641` rollback read — **this ticket's own**; also base/ticket-branch sync and task-branch filtering at `:213`, `:220` (Q-0052) and `:919-920`, `:984`, `:992`, `:1005`, `:1018` (Q-0053) |
| 2 | `commitAll` reports a discard when the revert failed | `:292-295` — Q-0052's site, this ticket's decision |
| 3 | `commitAll`'s first discarded path loses its first character | same report; `['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']` |
| 4 | `mergeInto` returns an empty error on a content conflict | `mergeFailure` (`:319-323`) reaching `:228`, `:926`, `:1007`, `:1018`, `:1026` |

**Defect 1 has teeth here, and both sites with teeth are this ticket's own.** **Verified** at `:640-647`: the rollback is guarded by `ctx.branchHeadAtStart` being truthy and then by `now && now !== ctx.branchHeadAtStart`. If git *fails* at `:48` the recorded head is null and the entire block is skipped by its own truthiness guard; if git fails at `:641` the current head is null and the inequality is false. Either way a failed run **silently keeps whatever `integrate` merged** — the contamination register row 19 exists to prevent — and nothing is printed. Defect 4 gives M1's named failure shape: **Verified** at `:322`, `mergeFailure` falls through to `'git reported no reason'` when the error string is empty.

## Acceptance criteria

Thirteen, each independently testable with Vitest against `packages/core`. AC-2–AC-5 are the design half; AC-6–AC-11 are preservation, proved by the ported suite; AC-12–AC-13 are the freeze and the house rules.

### AC-1 — The module lands as `core/engine/`, exports what it declares, adds no dependency, and prints nothing

No barrel; no new dependency (`yaml` and `@quorum/shared` are already in `core`'s four); imports limited to node builtins, `yaml`, `@quorum/shared` and siblings — **never `spike/`**; JSDoc on every export and non-obvious interface field. `coreSourceFiles()` (`test/corpus.ts:68`) picks the folder up recursively and `corpus.test.ts`'s module-folder assertion is updated in the same change.

**Nothing here writes to a stream** — no `console` call, no `process.stdout`, no ANSI escape. This is the point of the change and it is a source-text assertion: the spike's engine already prints only through `ui` (**Verified** — `engine.js` contains zero `console.` calls), and after the port there is no `ui`.

*Test:* the folder-shape and export-list assertions the five landed modules carry; a dependency diff over `packages/core/package.json` against the pinned four; the source-text scan for `console`/`process.stdout`/escape sequences; the JSDoc scan; `corpus.test.ts` extended and demonstrated failing over the un-extended corpus first.

### AC-2 — `runFlow` is an async iterable of `shared`'s `Event`, and every line the spike printed arrives as the same kind with byte-identical text

For each of the seven owned sites, a run over a mock-adapter fixture flow emits one event of the stated kind whose message is **string-equal** to the spike's output for the same run. Every yielded value passes `shared`'s strict run-event schema; `core` declares no second event schema and adds no vendor-specific field beyond the neutral open `vendor` label the union already carries.

Ordering is specified rather than assumed, and the promise is deliberately narrower than "production order":

- Within one step, an adapter's `spawn`, `stdout` and `retry` events keep their relative order and each gains the executing step id and nothing else.
- Across the members of a `parallel` group there is **no** guaranteed global order, because the members run concurrently under `allSettled`. A consumer that assumes one would display misleading parallel execution. *(Codex's correction; Claude's "events arrive in production order" over-promised.)*
- No event is dropped, coalesced or deduplicated, including in a burst — an adapter's `onEvent` is a synchronous callback deep in the call stack and cannot be back-pressured, so the bridge to the iterator buffers rather than discards.
- `step` is emitted before the corresponding step begins observable execution, and `done` is emitted **only** after that step completes successfully, so a failed or aborted step never emits a misleading `done`. *(Codex.)*

**No event gains a timestamp, sequence number or run id**, and a test says so. The stream is ordered by construction, nothing persists it in v1 (`04-architecture.md:75-80`), and run history already timestamps every occurrence. Three fields on eight members with no consumer is a cost paid now and removed never — a refusal recorded as one, in the shape Q-0065 used.

*Test:* one run over a fixture flow carrying a `parallel` group, an `on_fail` loop and a gate; per-site string equality against a transcribed fixture of the spike's output; a burst test asserting 500 stdout events yield 500 in order within their step; a key assertion proving no field beyond the union's; a failing step asserted to emit no `done`.

### AC-3 — The run's terminal outcome is on the stream, and a failure also throws

The terminal outcome — status, stage before and after, run id, cost, tokens, plus the seven regression fields when `regressed` — is emitted as a **terminal event**, one per run, always last, for all five statuses (`completed`, `regressed`, `aborted`, `failed`, `interrupted`). A consumer reading only the stream can tell how a run ended without parsing an `info.message`, which M3's gate screen needs and a generator return value cannot give it over a WebSocket.

Two things are stated precisely because the spike does not supply them. `finish`'s return is `{ status, stage, cost, runId, ...fields }` with **no `tokens`** and no stage-before outside the regression fields; the `info` line at `:651` is where tokens appear. Carrying tokens and stage-before on the terminal event for every status is a deliberate addition to a new member, described as an addition and not as preservation.

A failure **additionally** throws a typed `FlowError` after its terminal event, whose message names the cause, so a caller cannot mistake a failed run for a completed one by ignoring the payload. *"Errors are explicit … never default silently"*, and an error that is only an event is one a consumer may skip.

If the chosen mechanism is a new member of `packages/shared`'s union, that edits Q-0041's module and is **authorised by that file's own header** (**Verified**, `:35-37`, `:142-143`: *"terminal events belong to Q-0050"*) and by charter §10 — named here so a reviewer does not cite the `shared` non-goal against it. Whatever the mechanism, it refuses unknown keys like the other eight members (*"Unknown keys are refused where Quorum owns the key set"*, 2026-08-25). **The choice between widening the union and a typed iterator return is solutioning's; the observable property above is the requirement.**

*Test:* completed, aborted, regressed, failed and interrupted runs each yield exactly one terminal outcome, last, with fields equal to `finish()`'s values for the same run; the failed run's iterator throws after the event with a non-empty cause; the schema accepts the shape and rejects it with one unknown key added.

### AC-4 — A gate question is asked through one channel a consumer can answer out of band, and an unanswerable gate fails by name

The question is emitted as the `gate` event `shared` defines — `kind`, `reason`, absolute `ticketDir`, and `retry` only when the gate offers one — **and** the run suspends until an answer arrives, the run is cancelled, or it is interrupted. Whatever shape solutioning picks satisfies seven properties:

1. A passive consumer sees the question on the stream whether or not it can answer.
2. The answer may arrive asynchronously from outside the iterating call stack — M3's human answers in a browser, minutes later.
3. Exactly one answer per question, correlated to the pending run and gate **without parsing event text**; a stale, duplicate or answer-for-another-gate value is refused explicitly rather than applied.
4. The answer type is a closed union of `advance`, `retry`, `abort`, so a value outside it is a compile error and is rejected at run time where the channel crosses a process boundary. **A type change, not a behaviour change:** **Verified** at `:590`, `runGate` returns `{ abort: true }` for anything that is neither `advance` nor a valid `retry`, and the CLI's exact-match validation (`harness.js:83-88`) is the only reason that branch is unreachable today. A `core`-owned channel with a second consumer makes it reachable, and row 17 requires a disallowed answer to fail rather than invent a decision. Safety is enforced in `core`, not by a consumer's diligence.
5. A consumer that cannot answer — no channel supplied — makes the run **fail naming the gate**. It does not advance, abort, default or wait forever. *"A gate is never assumed"* (`harness.js:114`).
6. `human-locked` is never auto-advanced, and the `auto` / `--auto` / `--dry` short-circuits are evaluated **before** the question is asked, so an auto-advanced gate consumes no answer and emits `info` naming its kind (**Verified**, `:559-560`). A dry run emits `info` that the gate *would* pause and consumes no answer (**Verified**, `:561`). *(Codex supplied the dry-run clause.)*
7. Every answered gate appends its `gate=<kind> answer=<answer>` line to `runs.log` before the answer is acted on (**Verified**, `:582`, which sits above the branch).

Row 17's clause *"answers are full words consumed in order"* is **not this ticket's** — the queue is `harness.js:82` and this ticket lifts nothing from the CLI (charter §6). It transfers at Q-0010. Stated so a reviewer does not block on a missing feature.

**One preserved artefact needs a ruling rather than a silent carry.** `runGate:571` opens a 1000 ms `setTimeout` whose own comment says it exists to *"give a signal a short window to reach the synchronous finaliser"*, and that removing it means editing `spike/test/**`, frozen by Q-0004's AC-4 — *"Tracked, not resolved."* Under AC-5 `core` installs no signal handler at all, so the timer's stated purpose does not exist in the ported module, and carrying it means a library holding a libuv handle open for a second per gate. Preserve it and pin it with `Why: preserved defect, see Q-0050 AC-4.`, **or** remove it under the AC-13 decision entry — but state which in the source and the report. It may not be dropped in passing, and it may not be carried without a sentence. *(Found by the merge; in neither candidate.)*

*Test:* `advance` continues, `abort` ends aborted, `retry` at an exhaustion gate loops; a second answer is refused; no channel fails with a message containing the gate's kind and reason; a promise resolved 200 ms later from outside the iteration completes the run; `auto` and `--auto` advance without consuming an answer, `human-locked` does not; `--dry` emits the would-pause `info` and consumes nothing; the `runs.log` gate line is present for every answered gate.

### AC-5 — A run that stops early still writes its terminal record, and `core` never exits the process

Three ways to stop short of a normal `finish()`, all writing the record row 6 requires — status, counters persisted, one `runs.log` terminal line, every active occurrence finalised first:

- **A step throws.** Preserved exactly (**Verified**, `:161-168`): active occurrences finalised `failed` with their category, then `finish(..., 'failed', <first 200 chars of the first line>)`, then the rethrow.
- **The run is cancelled.** An interrupt arrives as cancellation, not as a signal the engine listens for. `core` installs **no** process signal handler and calls `process.exit` **nowhere** — **Verified** that the spike does both at `:57-64`, and charter §7 gives "process exit behaviour" to the CLI. A library that exits the process cannot host M3's daemon, where one process runs many runs. The persisted record is byte-identical to today's (`interrupted`, note `received SIGINT`) and complete before the caller is free to exit; exit 130 moves to Q-0010. No listener is left on `process` after a run, and repeated runs accumulate none.
- **The consumer walks away.** A `for await` that breaks, returns or throws invokes the iterator's `return()`. **Verified** that the spike's `finally` (`:169-172`) only removes signal listeners, so this path writes nothing today — the new interface creates the failure mode, and an abandoned run is therefore recorded as `interrupted` with the same record. An abandoned run does not continue unobserved.

*Test:* a run whose second step throws; a run cancelled mid-step and a run cancelled while suspended at a gate; a run whose consumer breaks after the third event — each asserted for the terminal `runs.log` line, the persisted counters and the finalised occurrence statuses; a source-text assertion that `process.exit` and any `process.on`/`process.once` signal subscription appear nowhere under `core/src/engine/`; a listener count on `process` unchanged across ten runs.

### AC-6 — Counters, the backward edge and the exhaustion gate keep their exact arithmetic

**Verified** at `:539-555`. The counter key is `on_fail.counter` when present, otherwise `` `${flow.name}.${step.id}` `` — so an explicit `counter: review` is a bare key shared across flows, which is how `review.yaml` bounds an edge spanning two. The counter is incremented **before** the comparison, so exactly `max_iterations` traversals are permitted and the next failure exhausts. `ctx.vars.iter` increments on the intra-flow branch only (`:155`), never on the cross-flow one, which returns first.

`on_fail.on_exhausted` is **read by nothing in the engine** — lint requires it to equal `gate` and the exhaustion gate is unconditional. Preserved, and named in a comment, because it reads like a switch and is not one.

The exhaustion gate is synthesised, not declared: kind `human-locked` — which is what makes `--auto` unable to bypass it — with `retryTarget`, `retryCounter` and `retryMax`, and a reason naming the step, the counter, its value and the limit. `recordEvent` writes the `exhausted` history entry and log line **before** the question is asked (`:549`), so an unanswered gate still leaves the spent budget on disk. An `advance` answer accepts the current result and changes **no** counter.

*Test:* a two-iteration loop reaching its bound, asserting the counter after each traversal and the exact iteration line; a second, independent loop untouched; `--auto` walking an author-declared human gate and refusing the exhaustion gate; the exhausted entry and log line present on disk before the gate resolves; `advance` leaving every counter unchanged.

### AC-7 — `retry` at an exhaustion gate authorises exactly one more traversal *(row 5)*

**Verified** at `:580-587`. `retry` sets **that** counter to `max_iterations` — not zero, not deleted — so the retry's own goto is the single authorised traversal and the next failure increments past the limit and re-presents the gate. No other counter is touched. The grant is written to `runs.log` as a line naming the counter, the value set, and that one further traversal is authorised.

`retry` is accepted **only** where a retry target exists: **Verified**, `answer === 'retry' && step.retryTarget` — at an author-declared gate with no target, `retry` falls through and the run aborts. *(Codex's clause; preserved as the abort it actually is, not as a rejection.)*

The rejected shape is on the record and worth a line in the source: clearing every counter granted `max_iterations + 1` traversals *and* refunded a `qa` budget the ticket had already spent (*"`retry` at an exhaustion gate authorises exactly one more traversal"*, 2026-08-22).

*Test:* two independent loops, one exhausted and retried; the retried counter equals `max_iterations`, the other is unchanged, exactly one further traversal occurs, the next failure re-presents the gate, and both log lines match exactly; `retry` at a gate with no target ends the run aborted.

### AC-8 — Cross-flow regression derives its stage from the target flow's `consumes` *(row 16)*

**Verified** at `:143-153`. A goto whose target starts `flow:` loads the named flow with `loadFlowByName`, warns that the ticket regresses to that flow's consumed stage, and ends the run immediately with a `regressed` finish at that stage — never its `produces`, never a hard-coded value, never the current flow's `consumes`, and the target flow is **not** run. A later invocation may select it using the regressed stage.

The seven extra fields are the target flow's name, stage before, stage after, counter, count, limit and remaining, with remaining clamped at zero by `Math.max(0, …)`; stage before is read from `ticket.meta.stage` before `finish` mutates it. A missing or invalid target flow fails naming it and its cause, and does not change the stage.

*Test:* a fixture pair where the first's `on_fail` targets the second; the ticket's stage equals the target's `consumes`; the exact warn text; the terminal outcome's seven fields; the target flow's steps asserted never to have run; remaining is zero after a gate retry, where count equals limit; a goto naming an absent flow fails with the name and leaves the stage alone.

### AC-9 — `finish()` moves the stage on two statuses only, rolls the ticket branch back, and does not roll back task branches *(rows 6, 19, 20)*

**Verified** at `:618-653`. Counters are persisted (`ticket.meta.iterations = ctx.counters`) for **every** status; the stage is assigned only for `completed` and `regressed`; `aborted`, `failed` and `interrupted` move nothing. The history entry is appended for **every** status — which settles the question of whether failed and interrupted attempts stay in frontmatter: they do, preserved, with `runs.log` and the manifest remaining the audit record for every attempt. *(Raised as an open question by Codex; resolved here by reading.)* The manifest is finalised only when run history initialised, so an initialisation failure still receives a terminal `runs.log` line and does not advance the stage (**Verified**, `:69-79`). The ticket is written once.

Two `runs.log` lines keep their exact format: the terminal line with run number, status, `stage=from→to`, cost, tokens and an optional JSON-quoted error suffix, and the rolled-back line with the branch and both short shas.

The rollback fires when the status is not `completed` or `regressed`, the run is not dry, the start-of-run head is set, and the current head differs. Its reason is on the record: `integrate` merges task branches before the outcome is known, and an exhausted run that left them behind made the next `qa-red` measure its red phase against a tree that already contained the implementation — 21 green, nothing red.

**Task branches are not rolled back, and no helper to do so is added in any form** (row 20). Q-0048 was already forbidden from closing this; this ticket owns the gap and carries it forward unfixed, with a test asserting the task branches survive a failed run so a later change has to argue for closing it.

*Test:* five runs, one per status, asserting stage, persisted counters, history entry and terminal line; a run that moves the branch then aborts, asserting the reset, the warn and the log line; the same run asserting the task branches survive; a run whose run-history initialisation throws, asserting the failed terminal line and an unmoved stage.

### AC-10 — `--dry` writes no file, and the two mutations that survive it are preserved and pinned

**Verified** at `:28-41`. The read-only backlog is preserved as a **view**, not as guards at the call sites: `Object.create(backlog)` with `write`, `writeFile` and `log` stubbed. The reasoning is the requirement and is already in the source — guarding call sites leaves every future writer to remember; making the database read-only cannot be forgotten. A dry run traverses the same routing machinery, invokes no adapter, executes no script, integrate, git mutation, branch reset or worktree mutation, initialises no run history (so no `.quorum/`, no manifest, no exclude entry), skips the rollback, and does not move the stage on disk. The stream still reports the steps and gates that would be encountered.

Two mutations survive today and are **preserved and pinned rather than fixed**, because charter §2 gives this ticket one behaviour change and it is spent on the stream:

- **The in-memory ticket is still advanced.** `finish` executes its stage assignment, counter assignment and history push; only the disk write is a no-op. The existing test dodges this by re-reading the ticket (`spike/test/q0034-dry-run.js`, D2). A daemon holding a ticket across runs sees the old defect in a new form — which is precisely M3.
- **The run's counters alias the ticket's iterations object.** **Verified** at `:45`: `counters: ticket.meta.iterations ?? {}` returns the existing object when one is present, so `handleFail`'s write lands on the frontmatter object immediately, dry or not.

Both carry one line naming the authority — `Why: preserved defect, see Q-0050 AC-10.` — and both are routed into AC-12's successor. **Codex's candidate required a dry run to leave the caller's in-memory ticket unchanged; that is a silent behaviour change against a measured fact and is struck.**

*Test:* a dry run over a flow with an agent step, a script step and a gate: `ticket.md` and `runs.log` byte-unchanged on disk, no `.quorum/`, no worktree from any step this ticket owns; both preserved mutations asserted **positively** on the in-memory object, so a future fix has to delete an assertion rather than slip past one.

### AC-11 — The stage precondition and the six helpers keep their exact behaviour and messages

**Verified** at `:37-41` and `:727-760`. `runFlow` refuses before anything else — before the dry substitution, before the context — when the ticket's stage is not the flow's `consumes`, naming the ticket, its stage, the flow and the stage it consumes. `loadFlow` sets `flow.file` and runs `lintFlow` before returning, so an unlinted flow is unreachable and no default flow or role is ever substituted after a failed read, parse or validation. `loadFlowByName` delegates to `loadFlow`, so parse and lint apply, but performs no existence check, so a missing flow is `ENOENT` and not a `FlowError` — the one loader that does not produce a `FlowError`, worth a line. `loadRole` returns `{ meta: {}, body: '' }` for a falsy name and throws a `FlowError` naming the full path when the file is absent. `interpolate` leaves an unknown `{key}` literal and treats a dotted key as a flat lookup, not a path, and never substitutes an empty string for an unknown. `writesOf` returns `output.write` before `output.writes` and invents no path. `reviewRound` counts only round directories containing a `verdict.md` and returns 1 when `review/` is absent.

*Test:* one focused test per helper asserting the exact string where a message exists; a stage-mismatch run asserting the message and that neither a `runs.log` line nor a run directory was created; `loadFlowByName` over a missing flow asserting `ENOENT` and over a lint-failing flow asserting the `FlowError`.

### AC-12 — Every consumption site states what the loop does when git *fails*, as distinct from when the branch is *absent*

For each of the four routed defects, this ticket states — in the source, on one line, and in `dev/implement-report.md` — what the run loop does when git **fails** as distinct from when the branch is **absent**, *including where the answer is "exactly what it does today"*. An unstated answer is what lets the next reader assume the question was considered. The eight sites are enumerated in "Context" above and each is named.

**The behaviour is preserved**: no three-valued return, no error propagation, no new message, and no reach into `fanout/` at all. The reason is not timidity — `ancestry()` ships the three-valued shape and has a caller acting on the third value; these do not, and widening a return type with nothing reading the widened case ships a type change and no behaviour.

**Test scope is deliberately narrower than the statement scope.** Tests induce an absent branch and an operational git failure at the **two sites this ticket owns** — the start-of-run head at `:48` and the rollback read at `:641` — asserting that both make the rollback skip itself with no warning, which is the contamination row 19 exists to prevent arriving with no message at all. The six sites inside Q-0052's and Q-0053's code are **stated** in the source and the report and **not** tested here, because that code does not exist yet in `core` and a test written against it would be a test of nothing. *(Codex demanded induced failures at all eight; that is sixteen scenarios over six unwritten functions, and it is struck as oversized and premature. Codex's enumeration is kept in full.)* Defect 4 is tested where it lands in this ticket's own reach: a failed merge with no conflicted paths and an empty error returns `'git reported no reason'`, and the test asserts its subject is non-empty **before** asserting the suffix, per *"a check that skips its subject must not report success"* (2026-08-25).

Two further preserved defects live in this ticket's own code and are pinned with it:

- **A gate or script step nested in a `parallel` group is run as an agent step.** **Verified** at `:181`: members are mapped to `runAgentStep`, not `runStep`, so the dispatch chain at `:193-197` is never consulted for a group member. No shipped flow does it; nothing in lint forbids it.
- **An `on_fail` goto naming a nonexistent step indexes the step list with minus one.** **Verified** at `:154`: `findIndex` returns `-1`, `steps[-1]` is `undefined`, and the run dies with a `TypeError` rather than a `FlowError`. Unreachable only because lint validates goto targets — a lint rule protecting an engine assumption, and Q-0055 records the twin case where it does not.

*Test:* the two owned git sites under a shim that fails `rev-parse`; `mergeFailure` over an empty error with the non-empty-subject guard first; a `parallel` group containing a gate step, asserted to run as an agent step; a goto to an unknown id asserting the `TypeError`. Each names this criterion in a comment. The six stated-not-tested sites are checked at the gate by reading the report, not by a test.

### AC-13 — The house rules hold, the documents that describe the stream are corrected, and the freeze is intact

Strict TypeScript, no `any`, no suppressed diagnostic without a same-line reason, no deprecated API — the deprecation rule covers `packages/**/*.ts` including tests since Q-0069. `core` imports event, flow, ticket, role and step-output types from `packages/shared`; `shared` imports nothing from `core`. JSDoc on exported symbols and non-obvious fields; every preserved defect names its authority on one line in the form `harness/rules.md` requires, and none transcribes a decision entry or ticket body.

The documents that describe the union or `runFlow`'s signature are corrected in the same change, because *when code and docs disagree, the docs are wrong until an entry says otherwise*: `docs/GLOSSARY.md`'s **Event** entry, `docs/04-architecture.md` principle 2 and its `:42` public-API line, and `docs/03-adapter-contract.md` where it names the stream. The module header cites the governing decision entry by **title and date**, never by file name or number.

Nothing under `spike/` is touched; spike test blocks are transcribed, never moved; CI's branch-scoped port-freeze job covers this ticket's branches. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass without changing lint scope or suppressing a failure, and both suites are verified green **forced** on `main` after the merge, in the worktree **and** in a fresh checkout — because `integrate`'s tick is worktree-scoped and Q-0072 shipped a change green at every gate and red on `main`.

*Test:* lint, typecheck and test forced; the source-text house-rule suite; a docs assertion that the terminal outcome appears in GLOSSARY's Event entry and in `04-architecture.md`; the shared-resolution test proving the dependency direction.

## Before the first run — six actions, all by hand, all costly to forget

1. **Q-0049 must be `main:contained` before `qa-red` and `development` start.** Charter §5 clause 3 orders Q-0049 through Q-0053; clause 5 says a child whose dependency is not contained does not start its first run. Q-0049 is `draft` and `core/src/run-history/` does not exist (**Verified**). **Requirements and solutioning are authorised now anyway** — §5's "run order is not landing order" and §8's Q-0050-only item say so, and the whole reason this child takes the full SDLC is that the stream's shape must be settled while the independent children still run.
2. **Write the decision entry, or rule it is not owed, at the solutioning gate.** This ticket settles the answer channel, the terminal representation, the timestamp refusal, the `signalWindow` question and where `process.exit` lives — durable choices M3 codes against, outliving the charter, which is retired at the cutover. **No step on this route can write it**: requirements and review steps have no worktree, the architect writes only `solution/*`, and an entry written by the development fan-out is written *during* implementation, not accepted before it. This is the precondition-external-to-the-document shape that exhausted Q-0070's loop at $8.31 and Q-0069's at about $12 — named here as a gate action rather than asserted as a criterion, for exactly that reason. Suggested title: *"What a run's event stream carries, and how a gate answer travels back"*. It is owed **after** solutioning decides, and **before** implementation starts.
3. **The four routed diagnostics are preserved.** Charter §2's default applies and both candidates recommended it; this document has applied it. Reversing it needs a dated decision entry accepted first, a freeze exemption on a human commit naming this ticket, and a coordinated change in `spike/src/fanout.js` and `packages/core/src/fanout/` once Q-0048 has landed — the Q-0066/Q-0068 shape. Confirm at the gate so a reviewer cannot reopen it.
4. **Pass no more `--gate-answer` values than you would authorise blind.** They are consumed in order by whichever gate arrives first, and an engine-presented exhaustion gate is a gate. This route has five flows and at least six gates.
5. **One run at a time** (Q-0039, unenforced), and **expect an unanswerable gate to fail the run and roll the ticket branch back** (Q-0040). Answer the final gate, or accept that proven-green work is discarded and the merge re-performed by hand.
6. **Amendments after this gate go in `solution/errata.md`, not `requirements/errata.md`.** On this route `requirements/errata.md` is read by nothing — `chore.yaml:13` and `:31` are its only readers, and `requirements.yaml`, `solutioning.yaml`, `development.yaml` and `review.yaml` name it in no step's inputs. Ten tickets have needed an erratum, three in the last two days. `qa-red.yaml:10` and `:23` do read `solution/errata.md`; say so in the solution document. Adding an input to a shipped flow file is a change to `harness/flows/` and is not this ticket's.

The integration branch does **not** need creating by hand: charter §8's first item is chore-route only (**Verified**), and here solutioning's `merge-contracts` step creates it.

## Non-goals

- **Run history's writer and reader** — Q-0049, rows 3, 4, 15. This ticket calls them and owns the lifecycle contract; it implements none of them and does not change the frozen `run-manifest.schema.json`.
- **The diff preflight and `materialiseDiff`** — Q-0051, rows 10, 11, 12. Only the block's position inside the run try is kept, so a failed preflight receives the same terminal record as any error.
- **`runGate`'s body, `runAgentStep`, `runScript`, `schemaFor`, `buildPrompt`, `resolveModel`** — Q-0052. The channel and the exhaustion gate's construction are here; the gate *step* is not. `schemaFor` now encodes the nit rule (*"A nit does not contradict an approval"*, 2026-08-28) and porting it must carry that.
- **Fan-out and integrate** — Q-0053, including the unguarded inter-wave worktree call that creates a worktree under `--dry`. Reported here because AC-10 owns the rule; the site is Q-0053's.
- **Fixing any of the eight preserved defects** — AC-10's two, AC-12's four routed plus two in `runStep`, and the `signalWindow` timer if it is preserved. Charter §2: report, do not fix. A reviewer may block if one has been fixed.
- **Persisting, replaying, querying or transporting the event stream** — `04-architecture.md:75-80` freezes its absence in v1; M3's resumability comes from step results on disk.
- **Adding `tool` or `text` events** — no producer exists; `events.ts`'s header refuses them and the refusal stands.
- **Q-0039 and Q-0040** — both change this file and both are listed before M3. Neither has landed in the spike, so the freeze SHA contains neither and there is no pre-freeze variant to choose between; this ticket ports what is there without pre-empting them and without adding state they would have to unpick. *(Codex raised the choice as a blocker; it is settled by reading.)*
- **The `--gate-answer` queue and its ordering rule, and process exit behaviour** — `spike/bin/harness.js`, transferring at Q-0010.
- **`route`** — lint knows it, the spec describes it, the engine does not implement it, and a flow using it passes lint and silently drops its verdict. Q-0056 owns it.
- **Budget cap enforcement.** `budget.per_run_usd` is descriptive and stops nothing.
- The cutover; the `quorum` binary (Q-0010); the server, WebSocket transport or gate screen; another child's module; any edit under `spike/` (§3); everything on v1's exclusion list.

## Open questions

**None blocks solutioning.** OQ-1 is the design question charter §8 routes *to* solutioning by name, recorded with constraints and a recommendation so an architect starts from a position rather than a blank page. The rest are gate actions whose defaults this document has already applied; confirm them so a reviewer cannot reopen one.

**OQ-1 — What shape does the gate answer channel take?** · Owner: the architect, at solutioning (§8: *"the gate answer channel is settled there"*). Three candidates; AC-4's seven properties are the test. (a) **A callback on `opts`** — the engine emits the question, then awaits it. (b) **The two-way generator protocol** — the consumer answers through the iterator's `next`. (c) **A run handle** — async-iterable *and* carrying an `answer` method, with cancellation on the same object. **Recommendation: (a).** It keeps `runFlow(opts): AsyncIterable<Event>` literally true as `:42` specifies; it works under `for await`, which (b) does not — a `for await` loop cannot pass a value to `next`, so every plain consumer would silently receive nothing at every gate; it maps directly onto the daemon, whose callback resolves when the gate route is called; and it is the shortest distance from `ui.gate`, which makes behaviour preservation provable rather than argued. (c) is worth ten minutes if Q-0040's "undecided" needs a gate answerable *later*, outside the run's lifetime, and it is the natural home for AC-5's cancellation signal.

**OQ-2 — How is the terminal outcome represented?** · Owner: the architect, at solutioning, with the `shared` owner. Widen `shared`'s union with a terminal member, or expose a typed iterator return through a stronger public type. The **authority** to touch `shared` is settled (`events.ts:142-143`, charter §10) and is not in question; only the shape is. AC-3's observable property is the test: a WebSocket consumer must learn status, stage, cost and run id without parsing prose. **Recommendation: widen the union**, because a generator's return value does not survive a `for await` and does not cross a socket.

**OQ-3 — Does the `signalWindow` timer survive the port?** · Owner: the architect, at solutioning. Its stated purpose is the signal path AC-5 removes from `core`. Preserve-and-pin, or remove under the AC-13 decision entry. **Recommendation: preserve and pin**, and let the entry record that it is dead weight whose removal belongs with the frozen fixture it exists for. *(New at this gate; in neither candidate.)*

**OQ-4 — Do the four routed diagnostics get fixed now?** · Owner: Ruud, at this gate. **Default applied: no — preserve, report, open the successor.** The case for fixing is real: *"Containment is derived from git on each board invocation"* (2026-08-24) says exit 1 is never inferred from a failure, a timeout or an absent binary, and `core` will ship that primitive in the same package as two helpers that violate it. Against: a fix needs a decision entry accepted first, a freeze exemption on a human commit, and a change in two trees, inside the one child already carrying the port's only interface change. Splitting it out costs one ticket and buys that change an undivided reviewer.

> **Successor body, written out so the obligation cannot expire.** *A deferred obligation dies unless it is written into a successor's body; an implement report is not a durable record and is not read again after the gate.*
>
> **Q-0074 — The engine cannot tell "git failed" from "the branch is not there", and says nothing either way.** `branchExists` and `branchHead` both wrap `fanout.ts`'s `safe()`, which swallows every error, so an absent ref and a git that could not run give the identical answer at all eight sites Q-0050's requirement enumerates. `commitAll` wraps its checkout and clean the same way, so a revert that *failed* still reports through its discard callback as though it had discarded. `commitAll`'s first reported path loses its first character when the file is modified-but-unstaged (`['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']`, measured). And `mergeInto` returns an empty error on a content conflict, so `mergeFailure` prints "git reported no reason" in the one case where the reason is the only information there is. All four are pinned in `packages/core/src/fanout/fanout.test.ts` at `:248`, `:331`, `:351`, `:405`, each carrying a `Why: preserved defect` line the fix must remove with it. **The two sites that make it more than cosmetic are the start-of-run branch head (`engine.js:48`) and `finish`'s rollback read (`:641`):** a git that fails at either makes the rollback skip itself through its own truthiness guard, so a failed run silently keeps whatever `integrate` merged — the contamination register row 19 exists to prevent, arriving with no message at all. Also carried: the two mutations `--dry` does not guard (the in-memory ticket is still advanced; the run's counters alias the ticket's iterations object), which stop being latent when M3 holds a ticket across runs. **The fix lands in `spike/src/fanout.js` and `packages/core/src/fanout/` together** — the Q-0066/Q-0068 shape — or the port loses the independent witness the freeze exists to provide; `spike/src/**` is frozen for Q-0009's children, so it needs a human commit carrying a freeze-exemption trailer, or a ticket scoped outside that set. The decision owed is not *whether* to widen a return type but **what a caller does with "could not answer"** — stop and name the work a human must do, or carry on and say so. Latent today because a run reaching this code has already spawned git several times; it stops being latent at M3, where a run nobody is watching is exactly where "git failed" rendering as "the branch is not there" costs something.

**OQ-5 — Does `core/src/index.ts` start exporting `runFlow`?** · Owner: Ruud, at this gate. It is still the one-line scaffold and is **byte-pinned** by `fanout.source.test.ts:49`, whose own comment reads *"this ticket adds no public re-export"* — so any answer edits a landed assertion with a stated precedent. `04-architecture.md:42` names `runFlow` in core's public API, and none of `loadProject`, `lintFlow`, `Backlog` or `Adapter` is exported from the barrel either. **Default applied: no — leave the barrel to the cutover**, exporting from the engine folder like every sibling. Populating it for one of five symbols makes the barrel a partial truth, and the cutover is where the §7 boundary is checked anyway.

**OQ-6 — Does the run advance only when the consumer pulls?** · Owner: the architect, at solutioning. A lazy generator makes abandonment detectable through `return()`, which AC-5 depends on; it also means a slow consumer slows the run, and an adapter's synchronous `onEvent` needs a buffer regardless. **Recommendation: lazy, with an internal queue**, and AC-2's no-event-dropped assertion keeps the queue honest.

## Risks

**A wrong stream shape is the most expensive mistake available here.** Five tickets code against it and M3's server and gate screen are built on it. The mitigations are structural: this is the one child on the full SDLC precisely so the shape is contracted and red-tested before it is written, and AC-4's properties are stated as observable behaviour so a solution is judged against them rather than against taste.

**Size, judged and accepted rather than assumed.** Thirteen criteria over roughly 250 ported lines plus an interface design is at the ceiling. **The split was considered and rejected**, and the reasoning is recorded so it is not re-litigated: separating "the event stream" from "the run loop" ships a stream with no producer and a loop with no output, and neither half can be red-tested alone. The one seam that exists — lifting the routed diagnostics into Q-0074 — removes one criterion of thirteen and about forty lines, and the ticket body *mandates* that criterion ("which this ticket's requirement must carry as a criterion"), so it cannot be struck here. The size control actually applied is AC-12's evidence scope: eight sites stated, two tested, six deferred to the tickets that own the code. Charter §9's third rule still applies — more than three runs to `reviewed` means the child was cut wrong, not that it needs a fourth.

**A quiet fix leaves both suites green over a wrong product.** The port's standing hazard, and this ticket carries eight preserved defects, four of which look exactly like tidy-ups next to `ancestry()` in the same package. AC-4, AC-10 and AC-12 pin each with a test and a one-line authority, so a reviewer has something to cite either way.

**Q-0049 is not landed, and this requirement describes calls into a module that does not exist.** Mitigated by expressing every run-history criterion as an **observable output** — a manifest field, a log line, an occurrence status — rather than a call signature, so a change in Q-0049's API does not invalidate a criterion. It remains why implementation cannot start when solutioning ends.

**Cancellation hazards are new with the interface.** An abandoned consumer could otherwise leave an adapter running, a gate awaited forever, or a signal listener attached. AC-5 makes each an assertion rather than a hope.

**Cost.** The nine chore children average about $29.53. This route is five flows rather than two, with a fan-out and two review panels, so a plausible range is **$80–150**, to be treated as the port's most expensive child rather than an overrun.

**The gate the human must answer is the one that matters.** At least six gates here, and Q-0040 means an unanswered one discards proven-green work and rolls the branch back. It has already cost Q-0035 and Q-0036 their merges on consecutive nights.

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a to the module — it invokes no adapter directly and reads no vendor environment. No code path, test or fixture here accepts an API key and the word does not appear; the engine reaches vendors only through `getAdapter`, whose subscription refusal is Q-0046's and Q-0047's. |
| **Worktree safety** | Row 19's `finish()` clause is this ticket's (AC-9), tested against a real tree rather than a mocked UI: a run that does not complete leaves the ticket branch as it found it. Nothing here creates a worktree — those sites are Q-0052's and Q-0053's — and nothing is written outside the ticket folder, `.quorum/` and the ticket branch. Row 20's gap is carried forward unfixed and pinned. |
| **Gate behaviour** | The subject of AC-4, AC-6 and AC-7. Human-gated by default; `auto` opt-in per gate; `human-locked` never flipped; the exhaustion gate synthesised as `human-locked` so `--auto` cannot bypass it; a missing or disallowed answer fails by name rather than inventing a decision. The `--gate-answer` ordering rule stays in the CLI (Q-0010). |
| **File format and schema** | At most one format gains a member: `shared`'s event union, per its own reservation (AC-3), refusing unknown keys like the other eight. No change to the frozen `run-manifest.schema.json`, to `ticket.md`'s frontmatter shape, or to any flow file. `runs.log`'s line formats are preserved byte for byte. |
| **Lint and cross-vendor rules** | No flow-lint rule changes; `lintFlow` is Q-0044's and is called, not edited. An invalid flow still fails before execution. `cross_vendor: required` is satisfied on this route by `development.yaml`'s two fan-out roles being on different vendors — `developer-backend` (codex) and `developer-tooling` (claude), both of which may write `packages/core` and `packages/shared` per `harness/architecture.md`. `tasks.yaml` must assign each file to exactly one. |
| **Explicit errors** | Row 21: invalid structured output saves the raw text beside the ticket through Q-0046's contract path, stops the run, and is never replaced by a default. AC-3 keeps the throw beside the terminal event so a failure cannot be ignored; AC-4 refuses an unanswerable gate by name; AC-12 states, per site, what a failed git does as distinct from an absent branch. The one acknowledged exception is `mergeFailure`'s empty-error case, recorded as a preserved defect and a risk rather than described as adequate. |
| **Cold-clone impact** | Neutral. No new command, flag, service or file in an adopter's repository, and nothing added to a first run's path. The one visible change — a run that ends says so on the stream — arrives with the CLI at Q-0010 and replaces an equivalent printed line. |
| **Product-agnostic** | No SaaS product is named. The product is Quorum and the folder is the harness; the refusal that calls the product "Harness" is in the adapters (Q-0068) and does not appear here. |
| **Freeze** | Nothing under `spike/` is touched; spike test blocks are transcribed, never moved. CI's branch-scoped port-freeze job covers this ticket's branches. If OQ-4 is answered "fix", the exemption is a human commit trailer and a before-the-run action, not something the loop can produce. |

## Provenance

**Claude's candidate supplies the spine** and is the better document: measured rather than cited, correctly sized at thirteen criteria, and the source of the merged AC structure, the function table, the `ui`→`Event` map, the no-timestamps refusal, the `process.exit`/no-signal-handler rule, the dry-run preserved mutations, the "Before the first run" checklist, the Q-0074 successor body and the provenance discipline itself. **Its central finding decides the interface**: that a consumer abandoning the stream is a terminal path the new interface creates and the spike has no branch for, because `finish()` is in the `catch` and the signal handler and never the `finally`. Also its: that `runFlow`'s return value has no home under `AsyncIterable<Event>`, which is what makes a terminal outcome necessary rather than decorative; that `:590` treats an unrecognised answer as an abort, unreachable today only because the CLI validates first; that `:181` dispatches `parallel` members to `runAgentStep`; and that this route has no errata channel.

**Codex's candidate contributed completeness Claude lacked**, and it is kept where it is additive: the eight-site enumeration of the git conflation, which is what the ticket body's *"for each site"* actually asks for and which Claude covered in four; `done` never emitted for a failed step; the honest ordering limit inside a `parallel` group, which corrects Claude's over-broad "production order"; `retry` at a gate with no target; the dry-run gate `info` event; `advance` changing no counter; the run id derived from history **and** `runs.log`; row 21's structured-output clause; that `loadFlowByName` does validate; and two status questions — whether `aborted` survives as a fifth status, and whether failed attempts stay in frontmatter history — both of which are resolved here by reading rather than left open.

**Codex's document was struck back hard on size and on one substantive error.** Nineteen criteria carrying roughly a hundred sub-clauses is four to six times the ticket a downstream flow can carry, and much of it restates the same obligation in three places. Its AC-16 is a precondition, not a testable criterion, and moved to the gate actions and OQ-4. Its AC-19 is a cross-cutting checklist, and moved to one. Its demand for induced git failures at all eight conflation sites was struck as premature: six of the eight are in Q-0052's and Q-0053's code, which does not exist in `core` yet. And **its AC-9.4 required a dry run to leave the caller's in-memory ticket unchanged, which is a silent behaviour change against a measured fact** — the spike advances it, charter §2 preserves it, and Claude measured it. That is precisely the quiet-fix hazard the port exists to expose, and it is struck.

**Three corrections and one finding are the merge's own**, from re-reading the spike today rather than from either candidate. `loadFlowByName` delegates to `loadFlow`, so parse and lint *do* apply — Claude's "path join only" understated it and Codex was right — but it does no existence check, so a missing flow is `ENOENT` and not a `FlowError`, where Claude was right and Codex was silent; both halves now ship. `finish`'s return object carries **no `tokens`** field and no stage-before outside the regression fields, so a terminal event carrying either for every status is an addition and not preservation — Claude's AC-3 described it as preserved. Register row 6 enumerates four statuses and omits `aborted` while the spike writes it at `:158`, stated so a reviewer does not cite the row against the fifth. And **neither candidate found `runGate:571`'s 1000 ms `signalWindow` timer**, whose own comment says it exists to hold a libuv handle open for the signal path — the path AC-5 deletes from `core` — and whose removal was blocked by a frozen fixture; carrying it silently into a library is not preservation, it is an unstated decision, so it is now OQ-3 and a clause of AC-4.

**Verified by reading today, not cited:** `spike/src/engine.js` `:10-45`, `:46-100`, `:140-200`, `:313-326`, `:536-600`, `:616-670`, `:725-765`; `packages/shared/src/events.ts` `:1-60` and `:130-210`; `packages/core/src/index.ts`; `packages/core/src/fanout/fanout.source.test.ts:40-60`; `harness/port-charter.md` §8 and register rows 5, 6, 16, 17, 19, 20, 21; `backlog/Q-0049-*/ticket.md`; `ls packages/core/src`.

**Measured rather than cited:** `engine.js` contains zero `console.` calls, so `ui` is the only output path; `packages/core/src/` holds six module folders and neither `engine/` nor `run-history/`; Q-0049's stage is `draft`; `index.ts` is exactly `export const name = '@quorum/core';`.

**Decisions this document leans on, by title and date:** *The port takes the chore route, except the one child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is authorised and everything else stops the child* (2026-08-25) · *Containment is derived from git on each board invocation, never stored* (2026-08-24) · *The event union is derived from what the product emits, and `tool` and `text` are not invented* (2026-08-25) · *Unknown keys are refused where Quorum owns the key set, and preserved where it does not* (2026-08-25) · *`retry` at an exhaustion gate authorises exactly one more traversal* (2026-08-22) · *Non-auto exhaustion gates require an explicit human or scripted answer* (2026-08-23) · *Cross-flow regression uses a derived regression target* (2026-08-23) · *Red for the right reason is an engine property, not a role property* (2026-08-22) · *A requirement may not name a surface its flow cannot write* (2026-08-25) · *`.claude/rules/` is a derived copy, not a surface a requirement may name* (2026-08-27) · *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) · *A nit does not contradict an approval* (2026-08-28) · *A cache hit names what the task reads, not what its package contains* (2026-08-28) · *Membership is a git question, not a filesystem one* (2026-08-28).
