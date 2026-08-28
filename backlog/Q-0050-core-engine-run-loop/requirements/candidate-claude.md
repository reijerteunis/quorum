# Q-0050 — `core/engine`: the run loop, routing and the event stream

*Candidate requirement, product-manager (claude), 2026-08-28 · route **full SDLC** · parent Q-0009 · charter §6 row `Q-0050` · depends on Q-0041, Q-0049 · depended on by Q-0051 · register rows 5, 6, 16, 17, 19, 20, 21. Where this and §6's register differ, the register is right. Claims marked **Measured** were re-derived by reading the named line today.*

## Problem

Thirteen children of Q-0009 translate a module. This one designs an interface.

`spike/src/engine.js:37` takes a `ui` object with six methods and prints through it, returning `{ status, stage, cost, runId }`. `docs/04-architecture.md:42` specifies `runFlow(opts): AsyncIterable<Event>` — the **one** behaviour change the port authorises (*"The port preserves behaviour; one exception is authorised"*, 2026-08-25). Five tickets queue behind its shape: Q-0051–Q-0053 code against it, Q-0010 renders it, M3's WebSocket transports it.

The design is unfinished in a documented way. `packages/shared/src/events.ts` ships eight members and hands six questions here by name (`:35-37`, `:142-143`): *"How a gate's ANSWER travels back is not decided here. Q-0050 owns the channel, along with ordering, terminal semantics and error representation."* · *"Ordering, timestamps, run ids and terminal events belong to Q-0050."*

Three things are easy to get wrong and only surface later.

**A gate is a question back.** An `AsyncIterable` carries values one way. `ui.gate` is awaited at `:574` and the run cannot continue until a human answers.

**`runFlow` returns something, and an async iterable has nowhere to put it.** Every exit returns `finish()`'s value (`:652`) and the CLI acts on it — `aborted` becomes exit 2 (`harness.js:604`).

**One safety property breaks silently under the new interface.** Register row 6 requires every terminal outcome to reach `runs.log` with counters persisted; an interrupt that refunded its budget was an undocumented route to unlimited retries. An async generator a consumer stops pulling from does not run its `catch` — it runs its `finally`, via the iterator's `return()`. A `for await` with a `break` therefore abandons a run mid-flight. **Measured** at `engine.js:84-172`: `finish()` is in the `catch` (`:167`) and the signal handler (`:60`), never in the `finally` (`:169-172`). The new interface creates the failure mode.

## User stories

**As the `maintainer`,** I run a flow and see exactly what I saw yesterday — same lines, same order, same gate prompt, same refusals, same exit code — because a rewrite of the plumbing is not something I should detect from the terminal.

**As the `contributor`,** I read `runFlow`'s type and know what a run emits and how a gate is answered without reading the engine, because the stream is the contract between `core` and everything above it.

**As the `maintainer` again,** when a run stops for any reason I find a terminal line in `runs.log` and my iteration budget still spent, because a bound I cannot trust is not a bound.

**As the `adopter`,** none of this reaches me: no new command, no new flag, no new file, same first thirty minutes.

## Context the implementer should not re-derive

**What is already there.** Q-0041–Q-0048 are `reviewed` and contained. `packages/core/src/` holds `adapters/`, `backlog/`, `contracts/`, `fanout/`, `git/`, `lint/`. **`run-history/` and `engine/` do not exist** — Q-0049 is `draft`, and `core/src/index.ts` is still the one-line scaffold, byte-pinned by `fanout.source.test.ts:49`. Two module-private facts constrain the design: `safe()` is **not exported** from `fanout.ts:206`, so the engine cannot reach a three-valued git answer; and `fanout.test.ts:562` asserts `.quorum` is absent after every fan-out test.

**The run loop, function by function.**

| Export | Line | What must survive |
| --- | --- | --- |
| `runFlow` | `37-174` | Stage precondition; context construction; signal path; step loop; three exit points |
| `runStep` | `176-198` | Dispatch order; `allSettled` over a `parallel` group, never `all`; the survivors message |
| `handleFail` | `539-555` | Counter keying, increment-before-compare, the synthesised exhaustion gate |
| `finish` | `618-653` | Stage moves on two statuses only; counters persisted; branch rollback; two log lines |
| `outcome` | `655-657` | The eight-field history entry, `stage` and `stage_after` deliberately duplicated |
| `recordEvent` | `659-664` | A mid-run history entry that does **not** move the stage |
| `loadFlow` | `15-20` | `flow.file` set on the parsed object; `lintFlow` runs before the flow is usable |
| `loadFlowByName` | `734-736` | Path join only — a missing flow is `ENOENT`, not `FlowError` |
| `loadRole` | `727-732` | Falsy name yields an empty role; missing file throws naming the path |
| `interpolate` | `740` | An unknown placeholder is left literal; dotted keys are flat lookups |
| `writesOf` | `739` | Singular `write` before plural `writes` |
| `reviewRound` | `753-760` | Highest round directory **containing `verdict.md`**, plus one |

`nextRunId` (`744-752`) is **Q-0049's** — its ticket names it among the writer's functions — and is consumed here. Say so in the module header or a reviewer spends a round on it.

**The `ui` to `Event` map.** Seven Q-0050-owned print sites, each becoming one member. The text is externally observable behaviour charter §2 preserves, so it is asserted as string equality, not `toContain`.

| Line | Call | Event |
| --- | --- | --- |
| `67` | run banner: run number, flow, ticket, consumed to produced stage | `info` |
| `146` | the backward edge, naming the target flow and the stage it regresses to | `warn` |
| `545` | step id, iteration n of max, goto target | `warn` |
| `548` | step id, `loop exhausted (max)`, human gate follows | `warn` |
| `574` | `ui.gate` with kind, reason, ticket directory, optional retry — **asks** | `gate` + the answer channel |
| `644` | branch, short sha rolled back to, and why | `warn` |
| `651` | run number, status, stage transition, cost, tokens | `info` |
| `652` | the returned `{ status, stage, cost, runId, ...fields }` | **no member today** |

The envelope rule is this ticket's, though the sites applying it are Q-0052's and Q-0053's: an adapter emits no identity and the engine supplies the step id (`:247`); `events.ts:196` already encodes it.

**Error representation is the fourth deferred question.** Today an error throws after `finish` records it as failed (`:161-168`). Nothing in the union represents a failure.

**Boundaries, stated so a reviewer need not derive them.** *Q-0049* owns run history — this ticket calls it from four places (`:69`, `:59`, `:164`, `:625-632`) and owns the **lifecycle contract**: a run that started is a run that ended. *Q-0051* owns the diff preflight; this ticket owns only the block's *position*, inside the run try, so a failed preflight gets the same terminal record as any error. *Q-0052* owns `runGate`'s body, `runAgentStep`, `runScript`, `schemaFor`, `buildPrompt`, `resolveModel`; this ticket owns the **channel** `runGate` asks through and the exhaustion gate's *construction* at `:550-554`, because `handleFail` is this ticket's and the synthesised gate is not a flow step. Charter §8 says the channel is settled now, before Q-0049–Q-0053 start. *Q-0053* owns fan-out and integrate.

**The four routed diagnostics and where this loop consumes them.** All pinned in `packages/core/src/fanout/fanout.test.ts` at `:248`, `:331`, `:351`, `:405`.

| # | Defect | Sites in this loop |
| --- | --- | --- |
| 1 | `branchExists`/`branchHead` cannot tell "absent" from "git failed" | `:50` (start-of-run head), `:641` (rollback) — **this ticket's**; also `:213`, `:220` (Q-0052), `:919-920`, `:984`, `:992`, `:1005` (Q-0053) |
| 2 | `commitAll` reports a discard when the revert failed | `:292-295` — Q-0052's site, this ticket's decision |
| 3 | `commitAll`'s first discarded path loses its first character | same report; **Measured**, `['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']` |
| 4 | `mergeInto` returns an empty error on a content conflict | `mergeFailure` (`:319-323`) reaching `:228`, `:926`, `:1007`, `:1018`, `:1026` |

Defect 1 has teeth here and both sites are this ticket's own. `finish:640-647` rolls back when the head differs from the head recorded at `:50`. If git *fails* at `:50` the recorded head is null and the whole block is skipped by its own truthiness guard, so a failed run silently keeps whatever `integrate` merged — the contamination row 19 exists to prevent. If git fails at `:641` the current head is null, the inequality is false, same result. Neither is announced. Defect 4 gives M1's named failure shape: `mergeFailure` falls through to "git reported no reason" when the error string is empty (**Measured**, `:322`).

## Acceptance criteria

Thirteen, each independently testable with Vitest against `packages/core`. AC-2–AC-5 are the design half; AC-6–AC-11 are preservation, proved by the ported test; AC-12–AC-13 are the freeze.

### AC-1 — The module lands as `core/engine/`, exports what it declares, adds no dependency, and prints nothing

No barrel; no new dependency (`yaml` and `@quorum/shared` are already there); imports limited to node builtins, `yaml`, `@quorum/shared` and siblings — **never `spike/`**; JSDoc on every export and interface field. `coreSourceFiles()` (`test/corpus.ts:68`) picks the folder up recursively and `corpus.test.ts`'s module-folder assertion is updated in the same change.

**Nothing here writes to a stream** — no `console` call, no `process.stdout`, no ANSI escape. This is the point of the change and it is a source-text assertion: the spike's engine already prints only through `ui` (**Measured** — zero `console.` in `engine.js`), and after the port there is no `ui`.

*Test:* the folder-shape and export-list assertions the five landed modules carry; a dependency diff over `package.json`; the source-text scan; the JSDoc scan; `corpus.test.ts` extended and demonstrated failing over the un-extended corpus first.

### AC-2 — `runFlow` is an async iterable of `shared`'s `Event`, and every line the spike printed arrives as the same kind with byte-identical text

For each of the seven owned sites, a run over a mock-adapter fixture flow emits one event of the stated kind whose message is **string-equal** to the spike's output for the same run. Events arrive in production order; none is dropped, coalesced, deduplicated or reordered, including in a burst — an adapter's `onEvent` is a synchronous callback deep in the call stack and cannot be back-pressured, so the bridge to the iterator must buffer rather than discard.

**No event gains a timestamp, sequence number or run id**, and a test says so. The stream is ordered by construction, nothing persists it in v1 (`04-architecture.md:75-80`), and run history already timestamps every occurrence. Three fields on eight members with no consumer is a cost paid now and removed never — a refusal recorded as one, in the shape Q-0065 used.

*Test:* one run over a fixture flow with a `parallel` group, an `on_fail` loop and a gate; per-site string equality against a transcribed fixture of the spike's output; a burst test asserting 500 stdout events yield 500 in order; a key assertion proving no field beyond the union's.

### AC-3 — The run's terminal outcome is on the stream, and a failure also throws

`finish()`'s value — status, stage before and after, run id, cost, tokens, plus the regression fields when `regressed` — is emitted as a **terminal event**, one per run, always last, for all five statuses (`completed`, `regressed`, `aborted`, `failed`, `interrupted`). A consumer reading only the stream can tell how a run ended, which M3's gate screen needs and a generator return value cannot give it over a WebSocket.

A failure **additionally** throws a `FlowError` after its terminal event, so a caller cannot mistake a failed run for a completed one by ignoring the payload. *"Errors are explicit … never default silently"*, and an error that is only an event is one a consumer may skip.

Adding a member edits `packages/shared/src/events.ts`, Q-0041's module. **Authorised by that file's own header** (`:35-37`, `:142-143`) and charter §10, and named here so a reviewer does not cite the shared non-goal against it. It refuses unknown keys like the other eight (*"Unknown keys are refused where Quorum owns the key set"*, 2026-08-25).

*Test:* completed, aborted, regressed and failed runs each yield exactly one terminal event, last, with fields equal to the spike's `finish()` return; the failed run's iterator throws after the event; the schema accepts the member and rejects it with one unknown key added.

### AC-4 — A gate question is asked through one channel a consumer can answer out of band, and an unanswerable gate fails by name

The question is emitted as the `gate` event `shared` defines, **and** the run pauses until an answer arrives. Whatever shape solutioning picks satisfies six properties:

1. A passive consumer sees the question on the stream whether or not it can answer.
2. The answer may arrive asynchronously from outside the iterating call stack — M3's human answers in a browser, minutes later.
3. Exactly one answer per question; a second is refused rather than applied.
4. The answer type is a closed union of `advance`, `retry`, `abort`, so a value outside it is a compile error and is rejected at run time where the channel crosses a process boundary. **A type change, not a behaviour change:** `:590` currently returns an abort for anything that is neither `advance` nor a valid `retry`, and the CLI's exact-match validation (`harness.js:83-88`) is the only reason that branch is unreachable. A `core`-owned channel with a second consumer makes it reachable, and row 17 requires a disallowed answer to fail rather than invent a decision. Safety is enforced in `core`, not by a consumer's diligence.
5. A consumer that cannot answer — no channel supplied — makes the run **fail naming the gate**. It does not advance, abort, default or wait forever. *"A gate is never assumed"* (`harness.js:114`).
6. `human-locked` is never auto-advanced, and the `auto`/`--auto`/`--dry` short-circuits are evaluated before the question is asked, so an auto-advanced gate consumes no answer (`:559-560`).

Row 17's clause *"answers are full words consumed in order"* is **not this ticket's** — the queue is `harness.js:82` and this ticket lifts nothing from the CLI (charter §6). It transfers at Q-0010. Stated so a reviewer does not block on a missing feature.

*Test:* `advance` continues, `abort` ends aborted, `retry` at an exhaustion gate loops; a second answer is refused; no channel fails with a message containing the gate's kind and reason; a promise resolved 200 ms later from outside the iteration completes the run; `auto` and `--auto` advance without consuming an answer, `human-locked` does not.

### AC-5 — A run that stops early still writes its terminal record, and `core` never exits the process

Three ways to stop short of `finish()`, all writing the record row 6 requires — status, counters persisted, one `runs.log` line, every open occurrence closed:

- **A step throws.** Preserved exactly: `failed`, first 200 characters of the first line as the note, then the rethrow.
- **The run is cancelled.** An interrupt arrives as cancellation, not as a signal the engine listens for. `core` installs **no** process signal handler and calls `process.exit` **nowhere** — charter §7 gives "process exit behaviour" to the CLI, and a library that exits the process cannot host M3's daemon, where one process runs many runs. The record is byte-identical to today's (`interrupted`, "received SIGINT") and complete before the caller is free to exit; exit 130 moves to Q-0010.
- **The consumer walks away.** A `for await` that breaks, returns or throws invokes the iterator's `return()`. This path does not exist in the spike and the new interface creates it, so it is specified rather than discovered: an abandoned run is `interrupted`, same record.

*Test:* a run whose second step throws; a run cancelled mid-step; a run whose consumer breaks after the third event — each asserted for the terminal log line, the persisted counters and the occurrence statuses; a source-text assertion that `process.exit` and a process signal subscription appear nowhere under `core/src/engine/`; no listener left on `process` after a run.

### AC-6 — Counters, the backward edge and the exhaustion gate keep their exact arithmetic

The counter key is `on_fail.counter` when present, otherwise the flow name and step id joined by a dot — so an explicit `counter: review` is a bare key shared across flows, which is how `review.yaml` bounds an edge spanning two. The counter is incremented **before** the comparison (`:542-543`), so exactly `max_iterations` traversals are permitted and the next failure exhausts. The iteration variable increments on the intra-flow branch only (`:155`), never the cross-flow one.

`on_fail.on_exhausted` is **read by nothing in the engine** — lint requires it to equal `gate` and the exhaustion gate is unconditional. Preserved, and named in a comment, because it reads like a switch and is not one.

The exhaustion gate is synthesised, not declared: kind `human-locked` — which is what makes `--auto` unable to bypass it — with a retry target, counter and maximum, and a reason naming the step, the counter, its value and the limit. `recordEvent` writes the `exhausted` entry and log line **before** the question is asked (`:549`), so an unanswered gate still leaves the spent budget on disk.

*Test:* a two-iteration loop reaching its bound, asserting the counter after each traversal and the iteration line; a second loop untouched; `--auto` walking a human gate and refusing the exhaustion gate; the exhausted entry and line present before the gate resolves.

### AC-7 — `retry` at an exhaustion gate authorises exactly one more traversal *(row 5)*

`retry` sets **that** counter to `max_iterations` — not zero, not deleted — so the retry's own goto is the single authorised traversal and the next failure exceeds the limit and re-presents the gate. No other counter is touched. The grant is written to `runs.log` as a `gate=retry` line naming the counter, the value set, and that one further traversal is authorised.

The rejected shape is on the record and worth a line in the source: clearing every counter granted `max_iterations + 1` traversals *and* refunded a `qa` budget the ticket had already spent (*"`retry` at an exhaustion gate authorises exactly one more traversal"*, 2026-08-22).

*Test:* two independent loops, one exhausted and retried; the retried counter equals `max_iterations`, the other is unchanged, exactly one further traversal occurs, the next failure re-presents the gate, and both log lines match exactly.

### AC-8 — Cross-flow regression derives its stage from the target flow's `consumes` *(row 16)*

A goto naming another flow loads it with `loadFlowByName`, warns that the ticket regresses to that flow's consumed stage, and ends the run immediately with a `regressed` finish at that stage — never its `produces`, never a hard-coded value, and the target flow is not run. The seven extra fields are the target's name, stage before, stage after, counter, count, limit and remaining, with remaining clamped at zero; stage before is read before `finish` mutates it.

*Test:* a fixture pair where the first's `on_fail` targets the second; the ticket's stage equals the target's `consumes`; the warn text; the terminal event's seven fields; the target flow's steps never ran; remaining is zero after a gate retry, where count equals limit.

### AC-9 — `finish()` moves the stage on two statuses only, rolls the ticket branch back, and does not roll back task branches *(rows 6, 19, 20)*

Counters are persisted for **every** status; the stage is assigned only for `completed` and `regressed`; `aborted`, `failed` and `interrupted` move nothing. The history entry is appended for every status. The ticket is written once. Two `runs.log` lines keep their exact format: the terminal line with run number, status, stage transition, cost, tokens and an optional error suffix, and the rolled-back line with the branch and both short shas.

The rollback fires when the status is not `completed` or `regressed`, the run is not dry, the start-of-run head is set, and the head has moved. Its reason is on the record: `integrate` merges task branches before the outcome is known, and an exhausted run that left them behind made the next `qa-red` measure its red phase against a tree that already contained the implementation — 21 green, nothing red.

**Task branches are not rolled back, and no helper to do so is added in any form** (row 20). Q-0048 was already forbidden from closing this; this ticket owns the gap and carries it forward unfixed, with a test asserting the task branches survive a failed run so a later change has to argue for closing it.

*Test:* five runs, one per status, asserting stage, persisted counters, history entry and terminal line; a run that moves the branch then aborts, asserting the reset, the warn and the log line; the same run asserting the task branches survive.

### AC-10 — `--dry` writes no file, and the two mutations that survive it are preserved and pinned

The read-only backlog is preserved as a **view**, not as guards at the call sites: a prototype-inheriting object with `write`, `writeFile` and `log` stubbed (`:29-35`). The reasoning is the requirement — guarding call sites leaves every future writer to remember; making the database read-only cannot be forgotten. Run history is not initialised, so no `.quorum/`, no manifest, no exclude entry. The rollback is skipped. The stage on disk does not move.

Two mutations survive today and are **preserved and pinned rather than fixed**, because charter §2 gives this ticket one behaviour change and it is spent on the stream:

- **The in-memory ticket is still advanced.** `finish` executes its stage assignment, counter assignment and history push; only the disk write is a no-op. The existing test dodges this by re-reading the ticket (`spike/test/q0034-dry-run.js`, D2). A daemon holding a ticket across runs sees the old defect in a new form — which is precisely M3.
- **The run's counters alias the ticket's iterations object.** The nullish fallback returns the existing object, so `handleFail`'s write lands on the frontmatter object immediately, dry or not.

Both carry one line naming the authority — `Why: preserved defect, see Q-0050 AC-10.` — and both are routed into AC-12's successor.

*Test:* a dry run over a flow with an agent step, a script step and a gate: `ticket.md` and `runs.log` unchanged on disk, no `.quorum/`, no worktree from any step this ticket owns; both preserved mutations asserted positively on the in-memory object.

### AC-11 — The stage precondition and the six helpers keep their exact behaviour and messages

`runFlow` refuses before anything else — before the dry substitution, before the context — when the ticket's stage is not the flow's `consumes`, naming the ticket, its stage, the flow and the stage it consumes. `loadFlow` sets `flow.file` and runs `lintFlow` before returning, so an unlinted flow is unreachable. `loadFlowByName` does no existence check — a missing flow is `ENOENT`, preserved, worth one line because it is the one loader that does not produce a `FlowError`. `loadRole` returns an empty role for a falsy name and throws naming the full path when absent. `interpolate` leaves an unknown placeholder literal and treats a dotted key as a flat lookup, not a path. `writesOf` returns singular before plural. `reviewRound` counts only round directories containing a `verdict.md`, and returns 1 when the directory is absent.

*Test:* one focused test per helper asserting the exact string where a message exists; a stage-mismatch run asserting the message and that no log line and no run directory were created.

### AC-12 — The four routed diagnostics: every consumption site states what it does when git fails, as distinct from when the branch is absent

For each of the four defects, this ticket states — in the source, on one line, and in `dev/implement-report.md` — what the run loop does when git **fails** as distinct from when the branch is **absent**, *including where the answer is "exactly what it does today"*. An unstated answer is what lets the next reader assume the question was considered.

The behaviour is **preserved**: no three-valued return, no error propagation, no new message, and no reach into `fanout/` at all. The reason is not timidity — `ancestry()` ships the three-valued shape and has a caller acting on the third value; these do not, and widening a return type with nothing reading the widened case ships a type change and no behaviour. The escape route is named in "Before the first run": a dated decision entry accepted before implementation, landing in `spike/src/fanout.js` and `packages/core/src/fanout/` together. Absent it, this ticket preserves and reports.

Two further preserved defects in this ticket's own code, found by reading it today:

- **A gate or script step nested in a `parallel` group is run as an agent step.** `:181` dispatches members to `runAgentStep`, not `runStep`, so the dispatch chain at `:193-196` is never consulted for a group member. No shipped flow does it; nothing in lint forbids it.
- **An `on_fail` goto naming a nonexistent step indexes the step list with minus one,** because `findIndex` returns `-1` (`:154`), and the run dies with a `TypeError` rather than a `FlowError`. Unreachable only because lint validates goto targets — a lint rule protecting an engine assumption, and Q-0055 records the twin case where it does not.

*Test:* one per site under a git shim that fails `rev-parse` — the start-of-run head is null and the rollback is skipped without a warning; `mergeFailure` over a failed merge with no conflicts and an empty error returns "git reported no reason"; a `parallel` group containing a gate step, run as an agent step; a goto to an unknown id asserting a `TypeError`. Each names this criterion in a comment. Reporting is checked at the gate, not by a test.

### AC-13 — The house rules hold, the documents that list the union gain its new member, and the freeze is intact

Strict TypeScript, no `any`, no suppressed diagnostic without a same-line reason, no deprecated API — the deprecation rule covers `packages/**/*.ts` including tests since Q-0069. JSDoc comments; every preserved defect names its authority on one line and none transcribes a decision entry or ticket body.

Three documents list the union or `runFlow`'s signature and all three are corrected in the same change, because *when code and docs disagree, the docs are wrong until an entry says otherwise*: `docs/GLOSSARY.md`'s **Event** entry, `docs/04-architecture.md` principle 2 and its `:42` public-API line, and `docs/03-adapter-contract.md` where it names the stream. The module header cites the decision entry by **title and date**, never by file name or number.

Nothing under `spike/` is touched; CI's branch-scoped port-freeze job covers this ticket's branches. Both suites are verified green **forced** on `main` after the merge, in the worktree and in a fresh checkout, because `integrate`'s tick is worktree-scoped and Q-0072 shipped a change green at every gate and red on `main`.

*Test:* lint, typecheck and test forced; the source-text house-rule suite; a docs assertion that AC-3's new member appears in GLOSSARY's Event entry and in `04-architecture.md`.

## Before the first run — five actions, all by hand, all costly to forget

1. **Q-0049 must be `main:contained` before development starts.** Charter §5 clause 3 orders Q-0049 through Q-0053; clause 5 says a child whose dependency is not contained does not start its first run. Q-0049 is `draft` and `core/src/run-history/` does not exist. **Requirements and solutioning are authorised now anyway** — §5's "run order is not landing order" and §8's Q-0050-only item say so, and the whole reason this child takes the full SDLC is that the stream's shape must be settled while the independent children still run. `qa-red` and `development` wait for Q-0049.
2. **Write the decision entry, or rule it is not owed, at the requirements or solutioning gate.** This ticket settles the answer channel, the terminal event, the timestamp refusal and where `process.exit` lives — durable choices M3 codes against, outliving the charter, which is retired at the cutover. **No step on this route can write it**: requirements and review steps have no worktree, the architect writes only `solution/*`, and an entry written by the development fan-out is written *during* implementation, not accepted before it. This is the precondition-external-to-the-document shape that exhausted Q-0070's loop at $8.31 and Q-0069's at about $12 — named here rather than asserted as a criterion for exactly that reason. Suggested title: *"What a run's event stream carries, and how a gate answer travels back"*.
3. **Decide whether the four routed diagnostics are fixed, and accept that entry first if so.** The fix must land in both trees together — the Q-0066/Q-0068 shape — and `spike/src/**` is frozen for this ticket, so it needs a human commit carrying a port-freeze-exemption trailer naming this ticket and a reason. An agent does not write that trailer. **Recommendation: no** — see OQ-2.
4. **Pass no more `--gate-answer` values than you would authorise blind.** They are consumed in order by whichever gate arrives first, and an engine-presented exhaustion gate is a gate. This route has five flows and at least six gates.
5. **One run at a time** (Q-0039, unenforced), and **expect an unanswerable gate to fail the run and roll the ticket branch back** (Q-0040). Answer the final gate, or accept that proven-green work is discarded and the merge re-performed by hand.

The integration branch does **not** need creating by hand: charter §8's first item is chore-route only, and here solutioning's `merge-contracts` step creates it.

## Non-goals

- **Run history's writer and reader** — Q-0049, rows 3, 4, 15. This ticket calls them and owns the lifecycle contract; it implements none of them and does not change the frozen `run-manifest.schema.json`.
- **The diff preflight and `materialiseDiff`** — Q-0051, rows 10, 11, 12. Only the block's position is kept.
- **`runGate`'s body, `runAgentStep`, `runScript`, `schemaFor`, `buildPrompt`, `resolveModel`** — Q-0052. The channel and the exhaustion gate's construction are here; the gate *step* is not. `schemaFor` now encodes the nit rule (*"A nit does not contradict an approval"*, 2026-08-28) and porting it must carry that.
- **Fan-out and integrate** — Q-0053, including the unguarded inter-wave worktree call that creates a worktree under `--dry`. Reported here because AC-10 owns the rule; the site is Q-0053's.
- **Fixing any of the six preserved defects** — AC-10's two and AC-12's four, plus the two in `runStep`. Charter §2: report, do not fix. A reviewer may block if one has been fixed.
- **Persisting or replaying the event stream** — `04-architecture.md:75-80` freezes its absence in v1; M3's resumability comes from step results on disk.
- **Q-0039 and Q-0040** — both change this file and both are listed before M3. This ticket ports the code they will change without pre-empting them and without adding state they would have to unpick.
- **The `--gate-answer` queue and its ordering rule, and process exit behaviour** — `spike/bin/harness.js`, transferring at Q-0010.
- **`route`** — lint knows it, the spec describes it, the engine does not implement it, and a flow using it passes lint and silently drops its verdict. Q-0056 owns it.
- The cutover; the `quorum` binary (Q-0010); Studio behaviour; another child's module; any edit under `spike/` (§3); everything on v1's exclusion list.

## Open questions

**One blocks, and it blocks solutioning rather than this gate.** OQ-1 is the design question charter §8 routes to solutioning by name; it is recorded with constraints and a recommendation so solutioning starts from a position rather than a blank page. The rest are gate actions.

**OQ-1 — What shape does the gate answer channel take?** · Owner: the architect, at solutioning (§8, "the gate answer channel is settled there"). Three candidates; AC-4's six properties are the test. (a) **A callback on `opts`** — the engine emits the question, then awaits it. (b) **The two-way generator protocol** — the consumer answers through the iterator's `next`. (c) **A run handle** — async-iterable *and* carrying an `answer` method. **Recommendation: (a).** It keeps `runFlow(opts): AsyncIterable<Event>` literally true as `:42` specifies; it works under `for await`, which (b) does not — a `for await` loop cannot pass a value to `next`, so every plain consumer would silently receive nothing at every gate; it maps directly onto the daemon, whose callback resolves when the gate route is called; and it is the shortest distance from `ui.gate`, which makes behaviour preservation provable rather than argued. (c) is better if Q-0040's "undecided" needs a gate answerable *later*, outside the run's lifetime — worth ten minutes at solutioning, not more.

**OQ-2 — Do the four routed diagnostics get fixed now?** · Owner: Ruud, at the requirements gate. **Recommendation: no — preserve, report, open the successor.** The case for fixing is real: *"Containment is derived from git on each board invocation"* (2026-08-24) says exit 1 is never inferred from a failure, a timeout or an absent binary, and `core` will ship that primitive in the same package as two helpers that violate it. Against: a fix needs a decision entry accepted first, a freeze exemption on a human commit, and a change in two trees, inside the one child already carrying the port's only interface change. Splitting it out costs one ticket and buys that change an undivided reviewer.

> **Successor body, written out so the obligation cannot expire.** *A deferred obligation dies unless it is written into a successor's body; an implement report is not a durable record and is not read again after the gate.*
>
> **Q-0074 — The engine cannot tell "git failed" from "the branch is not there", and says nothing either way.** `branchExists` and `branchHead` both wrap `fanout.ts:206`'s `safe()`, which swallows every error, so an absent ref and a git that could not run give the identical answer. `commitAll` wraps its checkout and clean the same way, so a revert that *failed* still reports through its discard callback as though it had discarded. `commitAll`'s first reported path loses its first character when the file is modified-but-unstaged (`['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']`, measured). And `mergeInto` returns an empty error on a content conflict, so `mergeFailure` prints "git reported no reason" in the one case where the reason is the only information there is. All four are pinned in `packages/core/src/fanout/fanout.test.ts` at `:248`, `:331`, `:351`, `:405`, each carrying a `Why: preserved defect, see Q-0048 AC-…` line the fix must remove with it. **The two sites that make it more than cosmetic are the start-of-run branch head and `finish`'s rollback read:** a git that fails at either makes the rollback skip itself through its own truthiness guard, so a failed run silently keeps whatever `integrate` merged — the contamination register row 19 exists to prevent, arriving with no message at all. Also carried: the two mutations `--dry` does not guard (the in-memory ticket is still advanced; the run's counters alias the ticket's iterations object), which stop being latent when M3 holds a ticket across runs. **The fix lands in `spike/src/fanout.js` and `packages/core/src/fanout/` together** — the Q-0066/Q-0068 shape — or the port loses the independent witness the freeze exists to provide; `spike/src/**` is frozen for Q-0009's children, so it needs a human commit carrying a freeze-exemption trailer, or a ticket scoped outside that set. The decision owed is not *whether* to widen a return type but **what a caller does with "could not answer"** — stop and name the work a human must do, or carry on and say so. Latent today because a run reaching this code has already spawned git several times; it stops being latent at M3, where a run nobody is watching is exactly where "git failed" rendering as "the branch is not there" costs something.

**OQ-3 — Does `core/src/index.ts` start exporting `runFlow`?** · Owner: Ruud, at the requirements gate. It is still the one-line scaffold and is **byte-pinned** by `fanout.source.test.ts:49`, so any answer edits a landed assertion. `:42` names `runFlow` in core's public API, and none of `loadProject`, `lintFlow`, `Backlog` or `Adapter` is exported from the barrel either. **Recommendation: no — leave the barrel to the cutover**, exporting from the engine folder like every sibling. Populating it for one of five symbols makes the barrel a partial truth, and the cutover is where the §7 boundary is checked anyway.

**OQ-4 — Does the run advance only when the consumer pulls?** · Owner: the architect, at solutioning. A lazy generator makes abandonment detectable through `return()`, which AC-5 depends on; it also means a slow consumer slows the run, and an adapter's synchronous `onEvent` needs a buffer regardless. **Recommendation: lazy, with an internal queue**, and AC-2's no-event-dropped assertion keeps the queue honest.

**OQ-5 — Where does a post-gate amendment to this requirement go?** · Owner: Ruud, at the requirements gate. **This route has no errata channel.** `requirements/errata.md` is read by `chore.yaml:13` and `:31` and nothing else; `requirements.yaml`, `solutioning.yaml`, `development.yaml` and `review.yaml` name it in no step's inputs. Ten tickets have needed an erratum, three in the last two days, and here one would be read by nobody. **Recommendation: route amendments through `solution/errata.md`**, which `qa-red.yaml:10` and `:23` do read, and say so in the solution document. Adding an input to a shipped flow file is a change to `harness/flows/` and is not this ticket's.

## Risks

**A wrong stream shape is the most expensive mistake available here.** Five tickets code against it and M3's server and gate screen are built on it. The mitigations are structural: this is the one child on the full SDLC precisely so the shape is contracted and red-tested before it is written, and AC-4's properties are stated as observable behaviour so a solution is judged against them rather than against taste.

**Size.** Thirteen criteria over roughly 250 ported lines plus an interface design is at the top of what the head of product accepts, and the honest reading is that this ticket is large because the work is. **If it must be split, the seam is not where it looks.** Splitting "the event stream" from "the run loop" ships a stream with no producer and a loop with no output; both halves would be untestable alone. The only clean seam is to lift AC-12's diagnostics and AC-10's preserved mutations into Q-0074 up front — one criterion and about forty lines, leaving the design work untouched. That is a smaller ticket, not a different one.

**A quiet fix leaves both suites green over a wrong product.** The port's standing hazard, and this ticket carries six preserved defects, four looking exactly like tidy-ups next to `ancestry()` in the same package. AC-10 and AC-12 pin each with a test and a one-line authority, so a reviewer has something to cite either way — and charter §2 says a reviewer *may* block if one has been fixed.

**Q-0049 is not landed, and this requirement describes calls into a module that does not exist.** Mitigated by expressing every run-history criterion as an **observable output** — a manifest field, a log line, an occurrence status — rather than a call signature, so a change in Q-0049's API does not invalidate a criterion. It remains why implementation cannot start when solutioning ends.

**Cost.** The nine chore children average about $29.53 and the port's checkpoint was set against that. This route is five flows rather than two, with a fan-out and two review panels, so a plausible range is **$80–150**, to be treated as the port's most expensive child rather than an overrun. Charter §9's third rule still applies: more than three runs to reach `reviewed` means the child was cut wrong, not that it needs a fourth.

**The gate the human must answer is the one that matters.** At least six gates here, and Q-0040 means an unanswered one discards proven-green work and rolls the branch back. It has already cost Q-0035 and Q-0036 their merges on consecutive nights.

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a to the module — it invokes no adapter directly and reads no vendor environment. No code path, test or fixture here accepts an API key and the word does not appear; the engine reaches vendors only through `getAdapter`, whose subscription refusal is Q-0046's and Q-0047's. |
| **Worktree safety** | Row 19's `finish()` clause is this ticket's (AC-9): a run that does not complete leaves the ticket branch as it found it. Nothing here creates a worktree — those sites are Q-0052's and Q-0053's — and nothing is written outside the ticket folder, `.quorum/` and the ticket branch. Row 20's gap is carried forward unfixed and pinned. |
| **Gate behaviour** | The subject of AC-4 and AC-6. Human-gated by default; `auto` opt-in per gate; `human-locked` never flipped; the exhaustion gate synthesised as `human-locked` so `--auto` cannot bypass it; a missing or disallowed answer fails by name rather than inventing a decision. The `--gate-answer` ordering rule stays in the CLI (Q-0010). |
| **File format and schema** | One format gains a member: `shared`'s event union, per its own reservation (AC-3), refusing unknown keys like the other eight. No change to the frozen `run-manifest.schema.json`, to `ticket.md`'s frontmatter, or to any flow file. `runs.log`'s line formats are preserved byte for byte. |
| **Lint and cross-vendor rules** | No flow-lint rule changes; `lintFlow` is Q-0044's and is called, not edited. `cross_vendor: required` is satisfied on this route by `development.yaml`'s two fan-out roles being on different vendors — `developer-backend` (codex) and `developer-tooling` (claude), both of which may write `packages/core` and `packages/shared` per `harness/architecture.md`. `tasks.yaml` must assign each file to exactly one. |
| **Explicit errors** | Row 21's second clause: a failure names its cause and nothing is silently defaulted. AC-3 keeps the throw beside the terminal event so a failure cannot be ignored; AC-4 refuses an unanswerable gate by name; AC-12 states, per site, what a failed git does as distinct from an absent branch. |
| **Cold-clone impact** | Neutral. No new command, flag or file in an adopter's repository, and nothing added to a first run's path. The one visible change — a run that ends says so on the stream — arrives with the CLI at Q-0010 and replaces an equivalent printed line. |
| **Product-agnostic** | No SaaS product is named. The product is Quorum and the folder is the harness; the refusal that calls the product "Harness" is in the adapters (Q-0068) and does not appear here. |
| **Freeze** | Nothing under `spike/` is touched; spike test blocks are transcribed, never moved. CI's branch-scoped port-freeze job covers this ticket's branches. If OQ-2 is answered "fix", the exemption is a human commit trailer and a before-the-run action, not something the loop can produce. |

## Provenance

**The spine is the ticket body's**, which names the eleven functions, the seven register rows, the four routed diagnostics and why they land here rather than in Q-0048.

**Four things are this document's**, each found by reading rather than inherited. That a consumer abandoning the stream is a terminal path the new interface creates and today's code has no branch for — `finish()` is in the catch and the signal handler, never the finally (`:84-172`). That `runFlow`'s return value has no home under `AsyncIterable<Event>`, which is what makes a terminal event necessary rather than decorative. That `:590` treats an unrecognised gate answer as an abort, unreachable today only because the CLI validates first — so the new channel makes row 17's "a disallowed answer fails rather than inventing a decision" a live requirement instead of a satisfied one. And that `:181` dispatches `parallel` members to `runAgentStep` rather than `runStep`, so a gate nested in a group is silently run as an agent step.

**Two process hazards found in the machinery, not the code.** Q-0049 is `draft` and `core/src/run-history/` does not exist, so this ticket's declared dependency is not contained and implementation cannot follow solutioning. And `requirements/errata.md` is read only by `chore.yaml`, so here a post-gate amendment reaches no step — OQ-5.

**Verified rather than cited:** `spike/src/engine.js` `:15-20`, `:29-35`, `:37-174`, `:176-198`, `:319-323`, `:539-555`, `:557-591`, `:618-664`, `:727-760`, `:913-928`; `spike/bin/harness.js:54-127`; `packages/shared/src/events.ts` in full; `packages/core/src/fanout/fanout.test.ts` `:225`, `:248`, `:331`, `:351`, `:405`; `packages/core/src/index.ts`; `harness/port-charter.md` §2, §3, §5, §6, §7, §8; `harness/flows/requirements.yaml`; `harness/roles/*.md`; `docs/04-architecture.md:37`, `:42`, `:44`, `:75-80`.

**Measured rather than cited:** `engine.js` contains zero `console.` calls, so `ui` is the only output path; `mergeFailure` returns "git reported no reason" when the error string is empty; `packages/core/src/` holds six module folders and neither `engine/` nor `run-history/`.

**Decisions this document leans on, by title and date:** *The port takes the chore route, except the one child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is authorised and everything else stops the child* (2026-08-25) · *Containment is derived from git on each board invocation, never stored* (2026-08-24) · *The event union is derived from what the product emits, and `tool` and `text` are not invented* (2026-08-25) · *Unknown keys are refused where Quorum owns the key set, and preserved where it does not* (2026-08-25) · *`retry` at an exhaustion gate authorises exactly one more traversal* (2026-08-22) · *Non-auto exhaustion gates require an explicit human or scripted answer* (2026-08-23) · *Cross-flow regression uses a derived regression target* (2026-08-23) · *Red for the right reason is an engine property, not a role property* (2026-08-22) · *A requirement may not name a surface its flow cannot write* (2026-08-25) · *`.claude/rules/` is a derived copy, not a surface a requirement may name* (2026-08-27) · *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) · *A nit does not contradict an approval* (2026-08-28) · *A cache hit names what the task reads, not what its package contains* (2026-08-28).
