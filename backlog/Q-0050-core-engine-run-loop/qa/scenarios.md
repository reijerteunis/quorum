# QA scenarios — Q-0050: `core/engine`, the run loop, routing and the event stream

*Round 4 · automation QA · 2026-08-29 · responds to `qa/scenario-review.md` round 3 (verdict: **revise**).
Criterion lettering (AC-1a…AC-13e) is unchanged from round 3 so the traceability table below reads
directly against that review. Round 3's design-half findings (blockers B-1 through B-5, findings F-1
through F-6) are each closed or explicitly deferred below, cross-referenced by number. `solution/errata.md`
E-1–E-6 is binding and is not re-litigated here; where an erratum already settles something, this document
states the settlement and moves on.*

## What changed since round 3

Round 3's "QA, in this loop — mechanical" list, items 1–6, closed in order:

1. **B-1 (four of six guard failures).** `q0050.source.test.ts`'s three source-scans (root derivation,
   cross-package literal, computed-read base) now read through `packages/core/test/corpus.ts`'s
   `repoFile()` — the same helper `adapters.source.test.ts`, `fanout.source.test.ts` and
   `run-history.source.test.ts` already use — instead of hand-rolled path math. AC-13c's reverse-direction
   clause ("`shared` imports nothing from `core`") moves to `packages/shared/src/index.test.ts`, which
   already declares `packages/core/package.json` and `packages/core/src/index.ts` as inputs (line 48), so
   the assertion costs no new register entry. See AC-13c below.
2. **B-1 (remaining two).** `engine.test.ts` writes `harness/harness.yaml` into a temporary repository as
   fixture setup — it is a write of test data, not a read of anything real. Registered in
   `turbo-inputs.test.ts`'s data-write allowlist beside the existing
   `packages/shared/src/project.test.ts: harness/harness.yaml` entry.
3. **B-3.** The three unsatisfiable `expect(opts.backlog.write).not.toHaveBeenCalled()`-style assertions
   are replaced by `vi.spyOn(project.backlog, 'write' | 'writeFile' | 'log')` installed **before** the run,
   so the spy observes whether the dry view's `Object.create` shadow ever lets a call reach the prototype
   method. AC-10a — which had no test at all — now carries the on-disk half of the same scenario.
4. **B-4.** All fourteen listed scenarios (AC-2b, AC-2c, AC-2f, AC-5a, AC-5b, AC-5e, AC-8b, AC-8c, AC-8d,
   AC-9e, AC-10a, AC-10d, AC-12c, AC-12d) are written out below with a concrete mechanism, not just a
   restated criterion.
5. **B-5.** Every scenario asserting Q-0050-owned narration now names the exact
   `contracts/Q-0050/run-messages.fixture.json` key it interpolates. The two hand-retyped literals
   (`log.retryGrant`, `log.recordEvent`) and the two substring/prefix matches (`log.terminal`,
   `log.gateAnswer`) are replaced with full-string equality against the fixture value.
6. **F-3.** The traceability table immediately below is new.

Round 3's three "human, at the gate" items are **not** this document's to close and are not re-opened:
the red-phase-evidence gap is recorded in `solution/errata.md` E-6(a); the fixture's `turbo.json`
registration is E-6(b); the note that `q0050-shared-events` has no failing test is E-6(c), restated under
AC-2e/AC-3c/AC-3d below per F-1. See **Known limitations carried, not owned** at the end of this document.

## Traceability

| Criterion | Task(s) | Test file · test name | Fixture key(s) |
| --- | --- | --- | --- |
| AC-1a | q0050-engine-compose (+ all) | `q0050.source.test.ts` — folder shape, export list | — |
| AC-1b | — (inherited pattern) | landed `fanout.source.test.ts`, `run-history.source.test.ts` | — |
| AC-1c | q0050-engine-compose | `q0050.source.test.ts` — no console/ANSI/`spike` import | — |
| AC-1d | all engine tasks | `q0050.source.test.ts` — JSDoc-per-export scan | — |
| AC-2a | q0050-routing, q0050-lifecycle, q0050-engine-compose | `engine.test.ts` — 7-site fixture equality | all 7 owned keys |
| AC-2b | q0050-engine-compose | — none (struck, E-8) | — |
| AC-2c | q0050-event-channel | — none (struck, E-8) | — |
| AC-2d | q0050-event-channel | `channel.test.ts` — burst, 500 events | — |
| AC-2e | q0050-shared-events | `events.q0050.test.ts` (already green, F-1) | — |
| AC-2f | q0050-engine-compose | — none (struck, E-8) | — |
| AC-3a | q0050-lifecycle, q0050-engine-compose | `engine.test.ts` — terminal event, all 5 statuses | `terminalInfo` |
| AC-3b | q0050-event-channel | `channel.test.ts` — throw-after-terminal | — |
| AC-3c/3d | q0050-shared-events | `events.q0050.test.ts` (already green, F-1) | — |
| AC-4a–4h | q0050-routing, q0050-shared-events | `lifecycle-routing.test.ts`, `q0050.source.test.ts` | `gate.*`, `gateAutoAdvanced`, `gateDryRun`, `log.gateAnswer` |
| AC-5a | q0050-lifecycle, q0050-engine-compose | — none (struck, E-8) | `log.errorSuffix` |
| AC-5b | q0050-engine-compose | — none (struck, E-8) | — |
| AC-5c/5d | q0050-lifecycle, q0050-event-channel | `lifecycle-routing.test.ts`, `channel.test.ts` — abandonment | — |
| AC-5e | q0050-engine-compose | — none (struck, E-8) | — |
| AC-6a–6c/6e | q0050-routing | `lifecycle-routing.test.ts` — counters, exhaustion | `loopIteration`, `loopExhausted`, `exhaustionReason` |
| AC-6d | q0050-routing, q0050-lifecycle | `lifecycle-routing.test.ts` + `lifecycle.test.ts` | — |
| AC-7a–7c | q0050-routing | `lifecycle-routing.test.ts` — retry grant | `log.retryGrant` |
| AC-8a | q0050-routing, q0050-loaders | `lifecycle-routing.test.ts` — stage derivation | — |
| AC-8b | q0050-routing, q0050-engine-compose, q0050-loaders | `engine.test.ts` — cross-flow edge, seven fields (hand-written, E-8) | `crossFlowRegression` |
| AC-8c | q0050-engine-compose | `engine.test.ts` — absent target flow (hand-written, E-8) | — |
| AC-8d | q0050-routing, q0050-engine-compose | `engine.test.ts` — remaining clamps at 0 (hand-written, E-8) | — |
| AC-9a–9c | q0050-lifecycle | `lifecycle.test.ts` — 5 statuses | `log.terminal` |
| AC-9d | q0050-lifecycle | `lifecycle.test.ts` + `q0050.source.test.ts` | `log.rollback`, `rollback` |
| AC-9e | q0050-lifecycle, q0050-engine-compose | — none (struck, E-8) | — |
| AC-9f | q0050-lifecycle | `lifecycle.test.ts` — raw vs rounded cost | — |
| AC-10a | q0050-engine-compose | `engine.test.ts` — nothing on disk | — |
| AC-10b/10c | q0050-engine-compose, q0050-lifecycle | `engine.test.ts` — spies + in-memory mutation | — |
| AC-10d | q0050-engine-compose | — none (struck, E-8) | — |
| AC-10e | q0050-routing | `lifecycle-routing.test.ts` — dry gate info | `gateDryRun` |
| AC-10f | q0050-lifecycle | `lifecycle.test.ts` — counters alias iterations | — |
| AC-11a | q0050-engine-compose | `engine.test.ts` — stage precondition | — |
| AC-11b–11g | q0050-loaders | `loaders.test.ts` — six helpers | — |
| AC-12a/12b | q0050-lifecycle | `lifecycle.test.ts` + `q0050.source.test.ts` | — |
| AC-12c | q0050-routing | `lifecycle-routing.test.ts` — top-level vs nested pair (hand-written, E-8) | — |
| AC-12d | q0050-engine-compose | `engine.test.ts` — unknown goto target (hand-written, E-8) | — |
| AC-12e | — | verified by inspection, no test (E-5b) | — |
| AC-13a | — | gate action (`pnpm lint` / `pnpm typecheck`), n/a | — |
| AC-13b | q0050-documentation | `packages/shared/src/docs.test.ts` | — |
| AC-13c | — (structural) | `q0050.source.test.ts` + `packages/shared/src/index.test.ts` | — |
| AC-13d | all tasks | `q0050.source.test.ts` — `Why:` line scan | — |
| AC-13e | — | gate action (module-header citation review), n/a | — |

## AC-1 — module shape, no dependency, no output

**Given** `packages/core/src/engine/` after all eight tasks land.

- **AC-1a** — **When** `q0050.source.test.ts` reads the folder via `coreSourceFiles()` (recursive, per
  Q-0064) and `test/corpus.ts`'s `repoFile()` for each individual source string, **Then** the file set is
  exactly `{types,channel,loaders,routing,lifecycle,engine}.ts`, no barrel exists, and every export named
  in `contracts/Q-0050/run-flow-api.contract.ts` is present. `corpus.test.ts`'s module-folder assertion is
  extended in the same change and demonstrated failing first over the un-extended corpus.
- **AC-1b** — **Given** the dependency-diff pattern already landed for `fanout` and `run-history`.
  **Then** no new test is written; the existing `fanout.source.test.ts`/`run-history.source.test.ts`
  dependency-diff assertions already cover `packages/core/package.json` as a whole and need no
  Q-0050-specific duplicate. Stated here so a reviewer does not ask for one.
- **AC-1c** — **When** `q0050.source.test.ts` greps every engine source file for `console.`,
  `process.stdout`, `process.stderr`, and ANSI escape sequences (`\x1b\[`), and for any import specifier
  starting with `../../../spike` or resolving under `spike/`. **Then** zero matches.
- **AC-1d** — **When** the same file scans each exported symbol and non-obvious interface field for an
  immediately preceding JSDoc block. **Then** every export has one. *(Nit carried from round 3: the regex
  must anchor per-export, not per-file — one comment above one export must not satisfy the whole file's
  export list. Fixed in this round's rewrite of the scanner.)*

Test: `packages/core/src/engine/q0050.source.test.ts`. Task: all eight engine tasks jointly satisfy this;
no single task is tagged as owner.

## AC-2 — the event stream: shape, ordering, enrichment

**Given** a run over the mock-adapter fixture flow carrying a `parallel` group of two members, an
`on_fail` loop, and a human gate — the same fixture round 3 already built.

- **AC-2a** — **When** the run executes to completion, **Then** each of the seven owned sites (banner,
  backward-edge warn, loop-iteration warn, loop-exhausted warn, gate question, rollback warn, terminal
  info) appears exactly once with a message **string-equal** to
  `contracts/Q-0050/run-messages.fixture.json`'s `runBanner`, `crossFlowRegression`, `loopIteration`,
  `loopExhausted`, `gate.*`, `rollback`, and `terminalInfo` values respectively — all interpolated, none
  hand-retyped.
- **AC-2b** — **Given** a single agent step whose mock adapter emits a raw `stdout` event carrying no
  `stepId`. **When** the engine composes the stream (not the channel directly — the previous round's test
  supplied `stepId` itself, which proves nothing about enrichment), **Then** the yielded event's key set
  equals the adapter event's key set plus exactly `stepId`, and `stepId` equals the currently executing
  step's id. Asserted by `Object.keys(...).sort()` equality, not `toMatchObject`.
- **AC-2c** — **Given** the parallel group's two members configured so member B's mock adapter resolves
  before member A's (inverting natural declaration order). **When** the run executes, **Then** (i) all of
  member A's own events keep their relative order, (ii) all of member B's own events keep their relative
  order, (iii) the total event count for the group equals the sum of both members' counts, and (iv) **no
  assertion is made about the interleaving between A's and B's events** — the test explicitly checks that
  such an interleaving is *possible* (B's first event can precede A's first event) rather than asserting
  a fixed cross-member order, which would over-specify a property the requirement declines to guarantee.
- **AC-2d** — **When** one step's mock adapter emits 500 `stdout` events synchronously in a tight loop
  (simulating an un-back-pressured `onEvent` burst). **Then** the consumer receives exactly 500, in
  emission order, none dropped, coalesced or deduplicated. *(Unchanged from round 3 — already red for the
  right reason.)*
- **AC-2e** — **Given** `packages/shared/src/events.ts`'s shipped strict schema. **Then** no new test:
  `events.q0050.test.ts` already asserts that a key beyond the union's declared set is rejected (3
  tests, 3 passing, per errata E-6(c)/F-1). This scenario is satisfied by the executable contract already
  on the branch and carries forward as a permanent guard, not a red test for `q0050-shared-events` to turn
  green.
- **AC-2f** — **Given** a step whose mock adapter is configured to throw. **When** the run executes that
  step, **Then** the stream contains a `step` event for it but **no** `done` event carrying that step's
  id — a failed step never emits the success marker.

Test: `packages/core/src/engine/engine.test.ts` (AC-2a, 2b, 2c, 2f), `channel.test.ts` (AC-2d),
`packages/shared/src/events.q0050.test.ts` (AC-2e). Task: q0050-engine-compose (2a enrichment path, 2b,
2c, 2f), q0050-event-channel (2d), q0050-shared-events (2e, already satisfied).

## AC-3 — the terminal outcome

**Given** five independent fixture flows, one per status (`completed`, `regressed`, `aborted`, `failed`,
`interrupted`).

- **AC-3a** — **When** each is run to its natural conclusion through `runFlow`/`engine.ts` (not through
  `lifecycle.ts`'s `finish()` called directly, which only proves the payload's shape — the engine-level
  test proves it is actually last on the stream). **Then** each stream's final yielded event is the
  terminal event, exactly one per run, with `status`, `stage` before/after, `runId`, `cost`, `tokens`, and
  — only for `regressed` — the seven regression fields, matching `finish()`'s values for that run.
- **AC-3b** — **Given** the `failed` fixture. **When** the consumer calls `.next()` after receiving the
  terminal event. **Then** the promise rejects with `FlowError`, whose `.cause` is non-empty and equal to
  the first 200 characters of the first line of the underlying error.
- **AC-3c/3d** — **Given** the shipped `runTerminalEventSchema`. **Then** no new test: already asserted
  green in `events.q0050.test.ts` (accepts the shape, rejects an added unknown key, and the regression
  group is all-or-nothing). Satisfied by the contract, per errata E-6(c)/F-1.

Test: `engine.test.ts` (AC-3a), `channel.test.ts` (AC-3b), `events.q0050.test.ts` (AC-3c/3d). Task:
q0050-lifecycle + q0050-engine-compose (3a), q0050-event-channel (3b), q0050-shared-events (3c/3d,
already satisfied).

## AC-4 — the gate channel

**Given** a flow with one author-declared human gate and one loop whose exhaustion presents a second gate.

- **AC-4a** — **When** the run reaches the first gate with no `answerGate` callback wired for the
  first assertion, and a wired one for the rest. **Then** a passive consumer (a `for await` with no
  answer logic) still receives the `gate` event on the stream before the run suspends.
- **AC-4b** — **When** `answerGate` resolves 200 ms after being invoked, from a `setTimeout` outside the
  iterating call stack. **Then** the run resumes and completes once the promise settles — proving the
  channel does not require the answer to be ready synchronously or from within the pull.
- **AC-4c** — **When** (i) a second `advance` envelope is sent for a `gateId` already answered, and (ii)
  an envelope carries a `gateId` that was never issued. **Then** both are refused explicitly (the run does
  not silently apply either), distinct from each other in the error's cause.
- **AC-4d** — **When** an envelope's `answer` field is a string outside `advance | retry | abort`.
  **Then** the run treats it as `{ abort: true }` — preserving `:590`'s behaviour now that `core` is a
  reachable second consumer beside the CLI's exact-match validation.
- **AC-4e** — **When** the same flow is run with **no** `answerGate` supplied at all. **Then** the run
  fails, naming the pending gate's kind and reason in the error message, rather than advancing, aborting,
  or hanging.
- **AC-4f** — **Given** one `auto`-kind gate and one `human-locked` gate in the same flow, run first
  under `{ auto: true }` and then under `{ dry: true }`. **Then** the `auto` gate advances consuming no
  answer and emits `info` matching `gateAutoAdvanced`; the `human-locked` gate is unaffected by `auto` and
  still suspends; under `--dry`, the gate emits `info` matching `gateDryRun` and consumes no answer.
- **AC-4g** — **When** the first gate is answered `advance`. **Then** `runs.log` gains a line matching
  `log.gateAnswer` (full string equality, not `stringContaining`) **before** the `advance` branch executes
  — asserted by having the fake `answerGate` callback read the log file synchronously before resolving.
- **AC-4h** — **Given** `routing.ts`'s `askGate`. **Then** a source-text assertion confirms the 1000 ms
  `signalWindow` timer is present and carries the line `Why: preserved defect, see Q-0050 AC-4.` — per
  OQ-3's resolution (preserve and pin), confirmed at the solutioning gate.

Test: `lifecycle-routing.test.ts` (4a–4g), `q0050.source.test.ts` (4h). Task: q0050-routing (4a–4h),
q0050-shared-events (the envelope schema 4c/4d rely on).

## AC-5 — early stop still persists

- **AC-5a** — **Given** a two-step flow whose second step's mock adapter throws. **When** run to
  completion. **Then** every occurrence started before the throw finalises `failed` with its category,
  `runs.log` gains one terminal line with an `errorSuffix` matching `log.errorSuffix`, and the iterator
  throws `FlowError` — order asserted: finalisation and the log line happen before the throw is observed
  by the consumer.
- **AC-5b** — **Given** an `AbortController` supplied as `signal`. **When** `.abort()` is called (i)
  while a step's mock adapter is mid-execution and (ii) while the run is suspended awaiting a gate answer.
  **Then** both cases persist `interrupted` with note `received SIGINT` (byte-identical to the spike's
  note despite the new caller-driven trigger, per the requirement's explicit preservation), and complete
  before the caller's `await` on cancellation resolves.
- **AC-5c/5d** — *(unchanged from round 3, already red for the right reason)* a consumer that `break`s a
  `for await` after the third event triggers the iterator's `return()`, which persists `interrupted` with
  the same shape as 5b before `return()`'s promise resolves.
- **AC-5e** — **Given** ten sequential runs against the fixture flow, each run to completion. **When**
  `process.listenerCount` for every event name is sampled before the first run and after the tenth.
  **Then** the counts are identical — no listener leaked, consistent with AC-5's requirement that `core`
  installs none in the first place.

Test: `engine.test.ts` (5a, 5b, 5e), `lifecycle-routing.test.ts` + `channel.test.ts` (5c/5d). Task:
q0050-lifecycle + q0050-engine-compose (5a), q0050-engine-compose (5b, 5e), q0050-event-channel (5c/5d).

## AC-6 — counters and the exhaustion gate

*(Unchanged from round 3 except AC-6d, which gains an ordering assertion.)*

- **AC-6a** — a two-iteration loop with an explicit `counter: review` key reaches its bound; the counter
  after each traversal equals the number of prior failures, keyed by the explicit name, not
  `${flow}.${step}`.
- **AC-6b** — a second, independent loop's counter is untouched by the first's traversals.
- **AC-6c** — `--auto` walks the author-declared human gate but is refused at the synthesised exhaustion
  gate (still `human-locked`, still suspends).
- **AC-6d** — **Given** the exhaustion gate synthesised at the bound. **When** inspected. **Then** its
  `kind` is `human-locked`, `retryTarget`/`retryCounter`/`retryMax` are set, its `reason` string equals
  `exhaustionReason` interpolated with the step, counter, value and limit, **and** the `exhausted` history
  entry plus its `runs.log` line are both written **before** the gate's promise is awaited — asserted by
  reading both from disk inside the (still-unresolved) `answerGate` callback.
- **AC-6e** — `advance` at the exhaustion gate leaves every counter unchanged.

Test: `lifecycle-routing.test.ts`. Task: q0050-routing (6a–6e), q0050-lifecycle (the `exhausted` entry
half of 6d).

## AC-7 — retry authorises exactly one traversal

- **AC-7a** — two independent loops, one exhausted; `retry` sets **only** that loop's counter to
  `max_iterations`, verified by reading the other loop's counter unchanged in the same tick.
- **AC-7b** — the next failure of the retried loop re-presents the exhaustion gate rather than looping
  silently; `runs.log`'s grant line matches `log.retryGrant` by full string equality (fixture-interpolated
  counter name and value — the two hand-retyped instances from round 3 are removed).
- **AC-7c** — `retry` sent at an author-declared gate with no `retryTarget` ends the run `aborted`:
  asserted by the terminal event's status, the `runs.log` terminal line, and the ticket's stage left
  unmoved — observable-behaviour assertions rather than a private call-count on whichever function
  performs the termination, closing F-4's "unwitnessed caller" concern by construction.

Test: `lifecycle-routing.test.ts`. Task: q0050-routing.

## AC-8 — cross-flow regression

**Given** flow A's `on_fail` targets `flow:B`, and B's `consumes` stage differs from both A's `consumes`
and A's `produces`.

- **AC-8a** — the ticket's stage after regression equals B's `consumes`, never B's `produces`, A's
  `consumes`, or a hard-coded value; B's own steps are asserted never to have run (a spy on B's step
  dispatch records zero calls).
- **AC-8b** — **Given** the full engine-level run (not `lifecycle-routing.test.ts`'s isolated "returns a
  decision without running B", which proves nothing about where the ticket lands). **When** A's step
  fails and the goto resolves. **Then** the warn event's text equals `crossFlowRegression` interpolated
  with B's name and the target stage, and the terminal event's regression-fields object carries exactly
  the seven named fields (flow, stage before, stage after, counter, count, limit, remaining) with values
  matching the run.
- **AC-8c** — **Given** A's `on_fail` names `flow:doesNotExist`. **When** A's step fails. **Then** the
  run fails naming `doesNotExist` and the underlying load error as cause, and the ticket's stage on disk
  is unchanged (byte-identical `ticket.md` before and after).
- **AC-8d** — **Given** a loop retried once so that `count === limit` exactly at the moment regression is
  evaluated. **Then** `remaining` is `0`, not negative — proven by constructing the boundary case directly
  rather than trusting `Math.max` by inspection.

Test: `lifecycle-routing.test.ts` (8a), `engine.test.ts` (8b, 8c, 8d). Task: q0050-routing +
q0050-loaders (8a, target-flow loading), q0050-engine-compose (8b, 8c, 8d, cursor/regression resolution
per errata E-3).

## AC-9 — `finish()`: stage, rollback, history

- **AC-9a** — across five runs, one per status, `ticket.meta.iterations` (counters) is persisted to the
  in-memory ticket for every status, including `aborted`, `failed` and `interrupted`.
- **AC-9b** — stage is assigned only for `completed` and `regressed`; the other three leave
  `ticket.meta.stage` exactly as it was at run start.
- **AC-9c** — a history entry is appended for **every** status, including `failed` and `interrupted` —
  frontmatter retains failed/interrupted attempts, per the requirement's reading-derived resolution.
- **AC-9d** — **Given** a real task branch created beside the ticket branch before a run that ends
  `aborted` after having moved the ticket branch. **When** the run finishes. **Then** the ticket branch is
  reset to its start-of-run head (warn text equals `rollback`, `runs.log` line equals `log.rollback`,
  both fixture-interpolated with the real branch name and both short shas), **and** the task branch still
  exists afterward — a real branch, not an injected stub, so a later change closing row 20 has to argue
  with an actual branch head rather than a mock's return value.
- **AC-9e** — **Given** a `RunPersistence` capability whose init throws (simulating a run-history
  directory that cannot be created). **When** `runFlow` is called. **Then** the run ends with a `failed`
  terminal `runs.log` line and the ticket's stage is unmoved — the manifest is never finalised because it
  was never initialised, and that alone does not skip the terminal record.
- **AC-9f** — **Given** a run with a non-integer real cost (e.g. `$1.2345`). **When** compared against
  `finish()`'s raw value and `outcome()`'s persisted `TicketHistoryEntry`. **Then** `finish()`'s payload
  (and the terminal event) carries the unrounded figure while the history entry's `cost` is rounded —
  both asserted, not just the raw half round 3 left standing.

Test: `lifecycle.test.ts` (9a, 9b, 9c, 9f), `lifecycle.test.ts` + `q0050.source.test.ts` (9d),
`engine.test.ts` (9e). Task: q0050-lifecycle (9a, 9b, 9c, 9d, 9f), q0050-lifecycle + q0050-engine-compose
(9e).

## AC-10 — `--dry` writes nothing, and its two preserved mutations are pinned

**Given** a flow with an agent step, a script step and a gate, run with `{ dry: true }`.

- **AC-10a** — **When** the run completes. **Then** `ticket.md` is byte-unchanged on disk, no
  `runs.log` file is created (or, if one pre-existed, it is byte-unchanged), no `.quorum/` directory
  appears, and no worktree is created by any step this ticket owns.
- **AC-10b** — **Given** `vi.spyOn(project.backlog, 'write')`, `'writeFile'` and `'log'` installed on the
  real, loaded `Backlog` **before** the run starts (not on the dry view — spying the prototype methods the
  view's own-property no-ops are meant to shadow). **When** the run completes. **Then** none of the three
  spies was called — proving the dry boundary actually intercepts, not merely that a pre-mocked function
  went unreached.
- **AC-10c** — **Given** the same run. **When** `ticket.meta.stage`, `.iterations` and `.history` are
  read on the **in-memory** ticket object passed into `runFlow`. **Then** they reflect the completed run
  exactly as a non-dry run would — the preserved defect, asserted positively so a future fix must delete
  this assertion rather than slip past it.
- **AC-10d** — **Given** the `Backlog` view `engine.ts` constructs internally for the dry run. **When**
  its prototype chain and a non-overridden method are inspected (via a diagnostic hook the test injects,
  or by reading the effect of a read call routed through the context). **Then**
  `Object.getPrototypeOf(view) === realBacklog`, `view.write !== realBacklog.write` (own-property
  shadowing), and a read method inherited from the prototype (e.g. listing tickets) returns the same
  result as calling it on `realBacklog` directly — proving reads still pass through while writers are
  shadowed.
- **AC-10e** — **Given** the `human-locked` gate reached under `{ dry: true }`. **Then** its `info` event
  matches `gateDryRun` exactly, and `answerGate` (if supplied) is never invoked — closing round 3's
  "no `gateDryRun` event" gap.
- **AC-10f** — **Given** a ticket whose `meta.iterations` is a specific object reference (not a literal
  passed inline), and a flow whose loop fails once during the dry run. **When** the run completes.
  **Then** `ticket.meta.iterations` — the *same object reference*, checked with `Object.is` — carries the
  incremented counter, proving aliasing by identity rather than by a vacuous spy-on-an-unrelated-mock
  assertion (F-5's fix: the previous test's `realBacklog.write` check is removed entirely, since it was
  provably unreachable regardless of correctness).

Test: `engine.test.ts` (10a, 10b, 10c, 10d), `lifecycle-routing.test.ts` (10e), `lifecycle.test.ts`
(10f). Task: q0050-engine-compose (10a–10d), q0050-routing (10e), q0050-lifecycle (10f).

## AC-11 — stage precondition and the six pure helpers

- **AC-11a** — **Given** a ticket whose stage is not the flow's `consumes`. **When** `runFlow` is called.
  **Then** the run fails immediately naming the ticket, its stage, the flow, and the stage it consumes,
  **and** — the half round 3 left untested — no `runs.log` line is appended and no run directory is
  created under `.quorum/runs/`, proving the refusal happens before any run bookkeeping, not just before
  the flow's steps.
- **AC-11b** — `loadFlow` sets `flow.file` on the parsed object and runs `lintFlow` before returning; an
  unlinted flow throws before it is usable.
- **AC-11c** — `loadFlowByName(name, harnessDir)` delegates to `loadFlow` (parse and lint apply) but
  performs no existence check: a missing flow surfaces as `ENOENT`, not `FlowError`.
- **AC-11d** — `loadRole('', harnessDir)` returns `{ meta: {}, body: '' }`; a named-but-missing role file
  throws `FlowError` naming the full path.
- **AC-11e** — `interpolate` leaves an unknown `{key}` literal untouched and treats a dotted key
  (`a.b`) as one flat lookup key, never as a nested path.
- **AC-11f** — `writesOf` returns the singular `output.write` when present, ahead of the plural
  `output.writes`.
- **AC-11g** — `reviewRound` returns the highest round directory containing a `verdict.md` plus one, and
  `1` when `review/` is absent entirely.

Test: `engine.test.ts` (11a), `loaders.test.ts` (11b–11g). Task: q0050-engine-compose (11a),
q0050-loaders (11b–11g).

## AC-12 — routed diagnostics and this ticket's own preserved defects

- **AC-12a** — **Given** a `LifecycleContext.readBranchHead` shim that returns `null` at start-of-run
  (simulating git failing at `:48`'s equivalent). **When** the run later ends non-`completed`/-`regressed`.
  **Then** the rollback is silently skipped (no warn, no `runs.log` rollback line) — the same observable
  behaviour as an absent branch, preserved rather than distinguished, with a source comment naming this
  criterion.
- **AC-12b** — **Given** the same shim returning `null` from the **post-run** read instead (simulating
  git failing at the rollback comparison). **Then** the same silent skip.
- **AC-12c** — **Given** a `parallel` step group containing one member of kind `gate`. **When** the group
  runs. **Then** that member is dispatched through the agent-step path (observed via an injected spy that
  distinguishes "ran as an agent" from "ran as a gate" — e.g. whether `askGate`'s log/event side effects
  occurred), preserving the defect that `runStep`'s `allSettled` maps every parallel member to
  `runAgentStep` regardless of declared kind.
- **AC-12d** — **Given** an `on_fail.goto` naming a step id absent from the flow's step list, constructed
  directly as a `Flow` object bypassing `lintFlow` (since lint would normally catch this). **When** the
  step fails and `engine.ts` resolves the goto. **Then** a raw `TypeError` is thrown, not a `FlowError` —
  preserving `findIndex() === -1` indexing the step array at `-1`.
- **AC-12e** — **Given** `lifecycle-routing.contract.md`'s table naming its six subject sites. **Then**
  no test is written. Verified once, by inspection, at this gate: all six strings are present in the
  landed file today. Per errata E-5(b), any executable version of this check would import
  `contracts/Q-0050/**` from a `packages/core` test file with no corresponding `turbo.json` declaration,
  reproducing the escaping-read shape Q-0072/Q-0073 exist to prevent — and the file it would check is
  frozen prose no development task may edit, so it can never go red. `docs-q0050.test.ts`, which
  previously implemented it, has already been deleted for exactly this reason; this entry records why it
  stays deleted.

Test: `lifecycle.test.ts` (12a, 12b), `q0050.source.test.ts` (12b positive scan),
`lifecycle-routing.test.ts` (12c), `engine.test.ts` (12d). Task: q0050-lifecycle (12a, 12b),
q0050-routing (12c), q0050-engine-compose (12d).

**Explicitly not tested, per errata E-5(a):** the empty-error `mergeFailure` clause
(`'git reported no reason'`) is struck from this ticket's scope. No task `tasks.yaml` assigns to Q-0050
consumes `mergeFailure` — its callers are all in Q-0052's and Q-0053's code, which does not exist in
`core` yet. It remains pinned by Q-0048's landed `fanout.test.ts:404` and is Q-0074's obligation to fix.
Encoding it here would be a red test with no task able to turn it green.

## AC-13 — house rules, documentation, freeze

- **AC-13a** — **Given** the standing house rules (strict TS, no `any`, no deprecated API, JSDoc).
  **Then** no Vitest scenario is written for this criterion: it is verified by `pnpm lint` and
  `pnpm typecheck` at the gate, which are existing CI gates this ticket does not add to or narrow. Stated
  as a gate action rather than forced into an unnecessary duplicate test, matching round 3's own
  classification.
- **AC-13b** — **Given** `packages/shared/src/docs.test.ts`, which already declares `docs/GLOSSARY.md`
  and `docs/04-architecture.md` as inputs (per `packages/shared/turbo.json`). **When** extended. **Then**
  it asserts `docs/GLOSSARY.md`'s **Event** entry mentions the terminal member and `docs/04-architecture.md`
  principle 2's `:42` line reflects `runFlow(opts): AsyncIterable<Event>` plus the `answerGate` channel.
  Per errata E-5(c), `docs/03-adapter-contract.md` is **not** part of this criterion — measured to contain
  zero occurrences of `runFlow` or "event stream" — and no assertion is written against it.
- **AC-13c** — **Given** the two-directional dependency claim ("`core` imports from `shared`; `shared`
  imports nothing from `core`"). **When** tested. **Then** the forward direction is unchanged — already
  pinned by the landed `packages/core/src/shared-resolution.test.ts` — and the reverse direction is a new
  assertion in `packages/shared/src/index.test.ts` (which already reads `packages/core/package.json` and
  `src/index.ts` under a declared input): grep every `packages/shared/src/*.ts` file for an import
  specifier resolving into `packages/core`, and assert none exists. `q0050.source.test.ts` no longer
  performs this grep itself, closing the last two of B-1's six guard failures.
- **AC-13d** — **Given** the eight preserved-defect sites across this ticket's code. **When**
  `q0050.source.test.ts` scans for `Why: preserved defect, see Q-0050` lines. **Then** the count matches
  the number of preserved defects this ticket's own tasks introduce or carry (AC-4h, AC-10c, AC-10f,
  AC-12a/b/c/d), and — closing round 3's nit — each such line is checked **not** to contain a verbatim
  sentence from `docs/DECISIONS.md` or from this ticket's own body (a substring scan against both
  documents), giving the criterion's "reproduces no sentence" half an actual check rather than only a
  presence count.
- **AC-13e** — **Given** the module header's citation of the governing decision entry. **Then** no
  Vitest scenario: verified by manual gate review that the citation uses "title and date" form
  (`*"…"* (YYYY-MM-DD)`) and never a file name or number, per `docs-and-decisions.md`. Left as a gate
  action, consistent with round 3.

Test: `packages/shared/src/docs.test.ts` (13b), `packages/shared/src/index.test.ts` +
`q0050.source.test.ts` (13c), `q0050.source.test.ts` (13d). Task: q0050-documentation (13b),
structural/no task (13c), all engine tasks (13d).

## Known limitations carried, not owned

Recorded so round 5 does not reopen either as a QA gap:

- **The `prove-red` artifact cannot show this ticket's own red phase** whenever `@quorum/shared#test` is
  itself red (as it correctly is while `q0050-documentation` is unimplemented), because root `turbo.json`'s
  `test` task depends on `^test` and prunes `@quorum/core#test` on a failed dependency. This is
  `solution/errata.md` E-6(a)'s finding, not a defect in the scenarios above; the direct measurement it
  records (39 failed / 835 passed / 2 skipped, 34 `AssertionError`, `tsc --noEmit` clean) is the evidence
  of record until the successor ticket it describes is created and lands.
- **The message-oracle fixture's registration in `packages/core/turbo.json`** was added by hand at the
  qa-red gate (errata E-6(b)) because no task in `tasks.yaml` owns that file. This document's scenarios
  assume that declaration is present; it is not re-derived or re-justified here.
- **`q0050-shared-events` has no failing test to turn green.** Per errata E-6(c) and F-1, restated at
  AC-2e/AC-3c/AC-3d above: the final schemas already ship on the branch. Development should read this as
  "the task's stated goal is already satisfied" rather than infer a missing scenario.
