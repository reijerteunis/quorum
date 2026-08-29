# QA scenarios — Q-0050: `core/engine`, the run loop, routing and the event stream

*Automation QA · route: full SDLC · grounded against `contracts/Q-0050/**`, `packages/shared/src/events.ts`
and the six `packages/core/src/engine/*.ts` stubs as they exist in the `harness/Q-0050/tests`
worktree (they are not on `main`), `contracts/Q-0050/run-messages.fixture.json` as the exact-text
oracle, `solution/errata.md` E-1–E-5, and the accepted decision "What a run's event stream carries,
and how a gate answer travels back" (2026-08-28), which settles OQ-1(a), OQ-2, OQ-3 and OQ-6 exactly
as recommended. Revised at round 3 from `qa/scenario-review.md`'s round-2 verdict (**revise**), which
read the six actual test files already written from round 2's scenario document
(`engine.test.ts`, `lifecycle.test.ts`, `loaders.test.ts`, `lifecycle-routing.test.ts`,
`docs-q0050.test.ts`, `q0050.source.test.ts`) rather than the scenario prose, and found six blockers
that make specific assertions unsatisfiable by any implementation obeying the contracts, plus two
class-level findings and three nits. Round 2's own verdict had endorsed the scenario *content* — every
criterion had a scenario — so round 3, like round 2, is a scoped correction to what was actually
found broken, not a rewrite. Every fix below was re-verified against the worktree's actual source
before being written here, not inferred from the review's prose alone. See "Round-2 review findings
resolved" below.*

## Test-design notes

- **Oracle for exact text, enforced without exception.** Every quoted string below is a placeholder
  name from `run-messages.fixture.json` (e.g. `runBanner`, `log.terminal`) — tests interpolate the
  fixture for the run's actual values, never a hand-retyped literal and never a partial/prefix
  regex, so a fixture edit cannot silently desync from the assertions. **This failed in round 2's own
  output**, not in the scenario text: `engine.test.ts` retyped the banner as a literal and used a
  prefix regex for the terminal narration, and five of the seven owned texts
  (`crossFlowRegression`, `loopIteration`, `loopExhausted`, `exhaustionReason`, `rollback`) were
  never asserted at all (F-1). AC-2a below restates the rule for all seven sites by name; a test
  file that imports the seven fixture keys and interpolates each is the only way to satisfy it —
  `import fixture from '../../../../contracts/Q-0050/run-messages.fixture.json'` (or the package's
  established JSON-import path) is expected in whichever file carries AC-2a.
- **Task ownership.** Each scenario is tagged `Tasks:` with the `tasks.yaml` id(s) whose *production*
  file(s) the scenario exercises. QA owns every `*.test.ts`/`*.source.test.ts` file itself — that
  ownership is not re-stated per scenario.
- **A lint-failure fixture must name a rule `lintFlow` actually enforces.** Round 2's `loaders.test.ts`
  used `steps:\n  - role: x\n` (a step with no `id`) as its "fails lint" example for both AC-11b and
  AC-11c; `lintFlow` (`packages/core/src/lint/lint.ts:171`) filters id-less steps out of the
  duplicate-id check *before* it runs and has no other rule an id-less, `on_fail`-less,
  `output.verdict`-less, `fan_out`-less, non-`integrate` step could trip — the fixture lints clean
  and the `toThrow(FlowError)` assertion can never fire (B-2; this is Q-0055's own subject, which
  exists precisely because `lintFlow` requires an `id` on no step kind). A scenario needing "a flow
  that fails lint" must use a construct `lintFlow` actually rejects: `on_fail` present without
  `goto`; a `goto` target absent from the flow's own step ids; `on_fail.max_iterations` not a
  positive integer; an `on_fail.counter` prefixed `iterations.`; `on_exhausted` present and not
  `'gate'`; two steps sharing one `id`; `fan_out` with no `step` template; `type: integrate` with no
  `branches`; a step with `output.verdict` but neither `on_fail` nor `route`; or an `input.diff` range
  that isn't two `...`-joined `{base}`/ticket-prefixed endpoints. AC-11b and AC-11c below now use
  `on_fail` without `goto` — an id-bearing step, so the fixture is unambiguous about *why* it fails.
- **Any non-dry run driven through `runFlow` to a terminus needs a real repository, not a placeholder
  path.** `RunFlowOptions` carries no persistence override (`types.ts`'s contract has none): `engine.ts`
  builds `RunContext.persistence` itself from `project.repoDir`/`project.harnessDir` and Q-0049's real
  run-history writer, for every non-dry status, not only `completed` — `finish()` calls
  `persistence.writeTicket`/`appendLog` regardless of which terminal status it reaches. Round 2's
  `engine.test.ts` set `project.repoDir = '/repo'` for its non-dry completed-run test, which cannot be
  created on a read-only root or as a non-root CI user, so that run fails before it ever reaches
  `completed` and the test can never pass in the one environment it names (B-3). Any scenario driving a
  non-dry composed run to a terminus (AC-2a, AC-3a's engine-compose half, AC-5a, AC-8a) must back it
  with a real writable directory — `packages/core/test/repo.ts`'s `repo()` for the git repository, a
  written `harness/harness.yaml` and either `loadProject(dir)` or an equivalently constructed real
  `Project`. A run that fails *before* context construction (AC-11a's stage-mismatch rejection) or that
  never leaves the dry, no-op view (AC-10's scenarios) touches no disk and may keep a placeholder path —
  say so explicitly in each such scenario so a later round does not add an unneeded repository or, worse,
  drop the real one where it *is* needed.
- **`round()`'s output is not two-decimal formatted.** `round = n => Math.round(n * 1000) / 1000`
  (spike, preserved). A zero-cost run's `terminalInfo` interpolation therefore reads `cost $0  tokens
  0`, never `cost $0.00  tokens 0` — round 2's `engine.test.ts` asserted the latter and could never
  pass (B-4). A scenario asserting narration text must interpolate the fixture with the run's actual
  numeric `stats.cost`/`round()` output, never assume fixed decimal places.
- **`finish()`'s returned cost is raw; only the persisted history entry rounds.** The requirement's own
  correction stands: `finish`'s resolved `RunOutcome` — and the terminal *event* built from it — carry
  the unrounded `ctx.stats.cost` (e.g. `1.23456` stays `1.23456`). The **only** stated rounding clause
  in `lifecycle-routing.contract.md` is `outcome`'s: `finish` passes a *rounded* cost (three decimals,
  e.g. `1.235`) into `outcome(ctx, before, after, status, cost)` when building the persisted
  `TicketHistoryEntry`. Round 2's `lifecycle.test.ts` asserted `finish()`'s own resolved value as
  `cost: 1.23` — neither the raw figure nor the three-decimal-rounded one — which is unsatisfiable
  either way (B-5). A scenario testing `finish()`'s return value directly asserts the raw, full-precision
  figure; a scenario testing the entry `outcome()` builds (or that a completed `finish()` call appended
  to history) asserts the three-decimal-rounded figure; the two are never interchanged.
- **`finish()` contains no per-call dry branch; the backlog view is what is dry.** `lifecycle-routing.
  contract.md`'s Dry view section and every lifecycle task description forbid guarding writers inside
  `finish` itself — dry-ness travels entirely through which `backlog` (real, or `Object.create`-based
  no-op) was threaded into the context at construction. Round 2's `lifecycle.test.ts` wired a bare
  `vi.fn()`-based `persistence` object and then required `persistence.writeTicket` to have been called
  on a non-dry run and *not* called on a dry one — satisfiable only by adding the very per-call `if
  (ctx.dry)` branch the contract forbids (B-6). A scenario proving dry behaviour at the `lifecycle.ts`
  unit level must wire `persistence`'s writers to delegate to `ctx.backlog.write`/`writeFile`/`log`
  (real for non-dry, the no-op prototype view for dry) and assert on that underlying `backlog` call,
  never on whether `persistence.writeTicket` itself was invoked — the delegate function runs
  unconditionally either way.
- **A source-text count assertion must not let an empty match crash the test.**
  `` `${a}\n${b}`.match(re)?.length `` yields `undefined` when nothing matches, so a
  `toBeGreaterThanOrEqual` comparison against `undefined` throws `TypeError: actual value must be
  number or bigint` rather than failing as a normal assertion (a nit in round 2's own
  `q0050.source.test.ts:47`). Any scenario counting occurrences via regex uses
  `(text.match(re) ?? []).length`, which fails the way every other assertion in this document is
  expected to fail — as a wrong number, not a crash.
- **A gate scenario asserts correlation, not literal object identity.** `askGate` is contracted to
  "allocate and emit *a* correlated question" — its `gateId` matching what the eventual answer must
  repeat — not to echo a caller-constructed event object verbatim. A scenario asserting the emitted
  gate event must check field-by-field equality/correlation (same `gateId` the answer will need, same
  `kind`/`reason`/`ticketDir`/`retry` the step declared), never `toStrictEqual` against a hand-built
  literal constructed independently of the call (a nit in round 2's `lifecycle-routing.test.ts:35`,
  whose `toStrictEqual([gate()])` happened to pass only because the test's own helper was reused
  verbatim as the comparison value).
- **A message-content assertion checks each required value individually, never one alternation
  regex.** `/Q-0050.*requirements.*requirements.*draft|stage/i` (round 2's `engine.test.ts:64`) is
  satisfied by any message containing the word "stage" alone, because `|` binds the entire pattern,
  not just its last term — a nit that let AC-11a's assertion pass over a message naming none of the
  four required values. A scenario requiring several distinct values to appear in one message (AC-11a's
  ticket id, actual stage, flow name, consumed stage) asserts each with its own `toContain`/`toMatch`
  check, never combines them behind a single `|`.
- **A scenario below is satisfied by exercising the described behaviour, not by scanning for an
  implementation's own identifiers.** `toContain('completed')`,
  `toMatch(/counters\[[^\]]+\]\s*=\s*limit/)` and equivalents do not satisfy AC-6d/e, AC-7, AC-8,
  AC-9 or AC-10 — those criteria are behavioural, and the Given/When/Then below already names the
  observable each one turns on (a counter's value, a stage on disk, a branch head, a persisted
  history entry, a `runs.log` line), never a variable name or a call-order idiom in the source.
  Source-text assertions are the right tool only where the criterion is itself about source shape —
  AC-1 (folder/exports/dependencies/no-console/JSDoc), AC-4h's preserved-defect comment, AC-9d's
  *"no such helper exists"* half, AC-13d — and each of those already says so explicitly. AC-12e is a
  freeze check verified by reading, not a test at all (see below). Where a scenario reads as an
  ordering claim (AC-4g, AC-6d), the ordering is asserted on the observable effect (the log line
  exists / the history entry exists at the point checked), never on the relative position of two
  identifiers inside the source text.
- **`lifecycle.ts`'s three exports need a test file that actually calls them.** AC-9's scenarios
  exercise `finish`, `outcome` and `recordEvent` directly; whatever file carries them must `import`
  from `./lifecycle.js`. Round 2's `lifecycle.test.ts` does this correctly and is the model to keep.
- **Documentation scenarios live where their inputs are already declared, not in a new
  `packages/core` file.** AC-13b and AC-12e read `docs/GLOSSARY.md`, `docs/04-architecture.md` and
  `contracts/Q-0050/lifecycle-routing.contract.md`. `packages/core/turbo.json` declares neither
  `docs/GLOSSARY.md` nor any `contracts/Q-0050/**` path as a test input, so a `packages/core` test file
  reading either one — round 2's `docs-q0050.test.ts` read both — makes `pnpm turbo run test --force`
  report an undeclared read that Q-0072's own guard exists to catch, over a file no task in
  `tasks.yaml` may edit (`packages/core/turbo.json`) and no task may register (`turbo-inputs.test.ts`'s
  `READ_BASES`) (B-1). `packages/shared/turbo.json` already declares `docs/GLOSSARY.md` and
  `docs/04-architecture.md`, and `packages/shared/src/docs.test.ts` already exists and already asserts
  over GLOSSARY's **Event** term — AC-13b's scenario is implemented there, as a new `describe` block
  beside the file's existing ones, needing no `turbo.json` or `READ_BASES` edit. AC-12e reads
  `contracts/Q-0050/lifecycle-routing.contract.md`, which neither package declares; per its own
  scenario below, it is not implemented as an automated test at all, so the question of which
  package's `turbo.json` would need to declare it does not arise.
- **Route-specific exclusion.** This route has no writer for `dev/implement-report.md` (no full-SDLC
  step produces it). AC-12's six sites inside Q-0052's/Q-0053's not-yet-written code are **not**
  tested here; they are read from `lifecycle-routing.contract.md`'s "Preserved diagnostic decisions"
  table, which is the durable enumeration this route substitutes for the report. Only the two sites
  inside Q-0050's own files are induced and asserted (AC-12a, AC-12b). Per `solution/errata.md`
  E-5(a), no Q-0050-owned file consumes `mergeFailure`, so the empty-merge-error fallback is not a
  Q-0050 scenario at all — it stays pinned in Q-0048's landed `fanout.test.ts:405` until Q-0052/Q-0053
  exercise it as a consumption site.
- **The decision entry already exists.** `docs/decisions/062-what-a-runs-event-stream-carries.md`
  is accepted and dated 2026-08-28, so AC-13's documentation scenarios cite it by that exact title
  and date rather than treating it as still owed.
- **Two events for one preserved line.** `finish`'s narration (spike `:651`) is **preserved** as an
  `info` event using the `terminalInfo` fixture text (AC-2). The **new** `terminal` event (AC-3) is
  an addition carrying the same facts as typed fields for a machine consumer — it does not replace
  the `info` line, and a scenario asserting one must not assume it subsumes the other.
- **Every scenario in this document needs exactly one executing test, and the report must say which.**
  Round 2 wrote scenarios for AC-5a, AC-5b, AC-8b, AC-8c, AC-8d, AC-9e, AC-10d and AC-10e that were
  never implemented in the six test files actually produced (F-2, F-4) — a gap in execution, not in
  this document, but one that recurred silently until the reviewer read the files directly rather
  than trusting the scenario list. `red-report.md` names, per criterion, which test executes it; a
  criterion present in this document with nothing named against it in the report is this gap
  recurring and blocks the gate on its own.
- **A finding, not a scenario:** see the end of this document.

## Round-2 review findings resolved

| Finding | Resolution |
| --- | --- |
| B-1: the new tests break Q-0072's input guard; `docs-q0050.test.ts` reads `docs/GLOSSARY.md` and `contracts/Q-0050/lifecycle-routing.contract.md`, neither declared in `packages/core/turbo.json`, and no task owns fixing the guard | AC-13b relocated to `packages/shared/src/docs.test.ts` (already declares both GLOSSARY and architecture docs); AC-12e rewritten as a by-reading freeze check with **no test file** — the read is removed rather than registered |
| B-2: `loaders.test.ts`'s lint fixture (`steps:\n  - role: x\n`, a step with no `id`) lints clean, so `toThrow(FlowError)` can never fire | New test-design note enumerating rules `lintFlow` actually rejects; AC-11b and AC-11c now use `on_fail` present without `goto` |
| B-3: `engine.test.ts`'s composed-run tests use `project.repoDir = '/repo'`, which cannot be created, so a non-dry run to `completed` can never pass | New test-design note requiring a real repository (`packages/core/test/repo.ts`'s `repo()` + `loadProject`) for any non-dry composed run to any terminus; explicit exemption stated for pre-context-construction rejections and dry runs |
| B-4: `engine.test.ts:57` requires `cost $0.00`, which `round()` never produces for zero | New test-design note; `round()`'s exact output (`$0`, not `$0.00`) stated explicitly |
| B-5: `lifecycle.test.ts:50` pins `finish()`'s returned cost as the three-decimal-rounded `1.23`, which is neither the raw value nor `outcome`'s own rounding | New test-design note splitting raw (`finish()`'s return) from rounded (`outcome`'s persisted entry); new scenario **AC-9f** states both explicitly |
| B-6: `lifecycle.test.ts:50` and `:106-107` together require a per-call `if (ctx.dry)` guard inside `finish`, which the contract forbids | New test-design note; new scenario **AC-10f** requires the dry proof to run through a delegating `persistence` and assert on the underlying `backlog` call, never on `persistence.writeTicket`'s own call count |
| F-1: the fixture oracle is read by no test, and five of AC-2a's seven texts are unasserted | Test-design notes' oracle rule strengthened to name all seven sites and forbid hand literals/prefix regexes explicitly; AC-2a restates the same rule inline |
| F-2: AC-5a and AC-5b have no executed test | Scenarios unchanged (they were already correct); new test-design note makes the report responsible for naming, per criterion, which test executes it, so a silent drop is visible at the gate rather than only at the next review |
| F-3: AC-13b's adapter-contract premise is false — `docs/03-adapter-contract.md` contains neither `runFlow` nor "event stream" | Resolved by `solution/errata.md` E-5(c): AC-13b's tested scope is `docs/04-architecture.md` and `docs/GLOSSARY.md` only; the adapter contract is out of this criterion's tested claims |
| F-4: AC-8b, AC-8c, AC-8d, AC-9e, AC-10d, AC-10e have no executed test | Same handling as F-2 — scenarios unchanged, report-naming note added |
| F-5: E-5 was still owed | `solution/errata.md` already carries E-5(a)–(d) as of this round; this document's route-specific-exclusion note and AC-12e/AC-13b scenarios are written to agree with it |
| Nit: `q0050.source.test.ts:47`'s `match(...)?.length` crashes instead of failing as a wrong count | New test-design note requiring `(text.match(re) ?? []).length` |
| Nit: `lifecycle-routing.test.ts:35`'s `toStrictEqual([gate()])` pins object identity, not correlation | New test-design note; AC-4a reworded to assert correlation and field equality |
| Nit: `engine.test.ts:64`'s alternation regex is satisfied by the word "stage" alone | New test-design note; AC-11a reworded to four discrete checks |
| Nit: `lifecycle-routing.contract.md`'s Loaders section still reads `loadFlowByName(harnessDir, name)` | Not this document's to fix (a contract-file correction); `solution/errata.md` E-5(d) already records it, and this document's scenarios use `(name, harnessDir)` throughout, matching the stub and the tests |

---

## AC-1 — The module lands as `core/engine/`, adds no dependency, and prints nothing

**AC-1a — folder shape and export list**
Given the six files `types.ts`, `channel.ts`, `loaders.ts`, `routing.ts`, `lifecycle.ts`,
`engine.ts` exist under `packages/core/src/engine/` with no barrel file,
When `coreSourceFiles()` walks `packages/core/src`,
Then the engine folder's keys and `corpus.test.ts`'s module-folder assertion list appear together,
`engine.ts` exports `runFlow` and nothing else does that engine.ts doesn't also need, and each of
the other five files exports only the declarations `module-layout.contract.md`'s table names for it.
**Tasks:** q0050-engine-types, q0050-event-channel, q0050-loaders, q0050-routing, q0050-lifecycle,
q0050-engine-compose.

**AC-1b — no new dependency**
Given `packages/core/package.json` before this ticket's tasks run,
When the six production files are complete,
Then a dependency diff over `packages/core/package.json` is empty — imports are limited to Node
builtins, `yaml`, `@quorum/shared` and engine-folder siblings, and no file imports anything under
`spike/`.
**Tasks:** q0050-engine-types, q0050-event-channel, q0050-loaders, q0050-routing, q0050-lifecycle,
q0050-engine-compose.

**AC-1c — nothing writes to a stream**
Given the complete engine folder's source text,
When a scan searches for `console.`, `process.stdout`, `process.stderr` and ANSI escape sequences,
Then none is found anywhere under `packages/core/src/engine/`, matching the spike's own zero-count
over `engine.js` before the port.
**Tasks:** q0050-engine-types, q0050-event-channel, q0050-loaders, q0050-routing, q0050-lifecycle,
q0050-engine-compose.

**AC-1d — JSDoc on every export and non-obvious field**
Given the six production files,
When a scan collects every exported symbol and every field of `RunContext`, `RoutingContext` and
`LifecycleContext` that is not self-explanatory from its name and type,
Then each carries a `/** … */` comment, and the module-folder assertion is demonstrated to fail
first against the un-extended corpus so the extension is proven live rather than vacuous.
**Tasks:** q0050-engine-types, q0050-event-channel, q0050-loaders, q0050-routing, q0050-lifecycle,
q0050-engine-compose.

---

## AC-2 — `runFlow` emits `shared`'s `Event`, byte-identical to the spike's seven owned lines

**AC-2a — the seven owned sites, string-equal, every one interpolated from the fixture**
Given a mock-adapter fixture flow that exercises a plain step, a `parallel` group, an `on_fail` loop
and a gate, run to completion as a non-dry run against a real temporary repository (`repo()` +
`loadProject`, per the test-design note — never a placeholder `repoDir`),
When the flow is run through `runFlow` to completion,
Then the run banner (`runBanner`), the backward-edge warning (`crossFlowRegression`), the loop
iteration and loop-exhausted warnings (`loopIteration`, `loopExhausted`), the gate question, the
rollback warning (`rollback`) and the terminal narration (`terminalInfo`) each arrive as one event
of the documented kind whose message is string-equal to the fixture, interpolated for the run's
actual values — every one of the seven sites is asserted this way, none as a hand-retyped literal
and none as a prefix or partial regex.
**Tasks:** q0050-engine-compose, q0050-routing, q0050-event-channel.

**AC-2b — adapter event order and enrichment within a step**
Given a step whose adapter emits `spawn`, several `stdout` lines and one `retry`,
When the events are drained from the iterator,
Then they arrive in their original relative order, each carrying exactly the executing step's id
added and no other new field.
**Tasks:** q0050-engine-compose, q0050-event-channel.

**AC-2c — no cross-member order inside a `parallel` group**
Given a `parallel` group of three steps whose adapters interleave arbitrarily,
When the group runs under `Promise.allSettled`,
Then the test asserts only that each member's own events keep their internal order — it does not
assert, and would fail if it asserted, a fixed order between members.
**Tasks:** q0050-routing, q0050-event-channel.

**AC-2d — a burst is not dropped, coalesced or reordered**
Given a step whose adapter synchronously emits 500 `stdout` events in one call-stack turn,
When the consumer drains the iterator at its own pace,
Then exactly 500 `stdout` events are yielded, in their original order, within that step.
**Tasks:** q0050-event-channel.

**AC-2e — no event carries a field beyond the union**
Given each of the eight event kinds, over samples that include the required `gateId` on every gate
event,
When a run-event schema check runs over a captured stream,
Then every event validates against `eventSchema`, and a key assertion confirms no event has a field
name outside its own member's declared keys — in particular no timestamp, sequence number or run id
on any non-terminal event.
**Tasks:** q0050-shared-events.

**AC-2f — a failed step never emits `done`**
Given a step whose script or agent invocation fails,
When the step is run,
Then a `step` event was queued before execution and no `done` event is ever queued for that step id.
**Tasks:** q0050-routing, q0050-engine-compose.

---

## AC-3 — The terminal outcome is on the stream, and a failure also throws

**AC-3a — one terminal event, last, per status**
Given five separately constructed runs, one reaching each of `completed`, `regressed`, `aborted`,
`failed` and `interrupted` — the non-`dry` composed cases backed by a real temporary repository per
the test-design note, since `finish()` writes real ticket/log state regardless of which terminal
status it reaches —
When each run's stream is drained fully,
Then exactly one `terminal`-typed event is yielded, it is the last value produced, and its
`stageBefore`/`stageAfter`/`runId` match `finish()`'s own values for that run. `cost` matches
`finish()`'s own *raw, unrounded* value (see AC-9f) — never the three-decimal figure `outcome()`
rounds for the persisted history entry. `tokens` and (for `regressed`) the seven regression fields
are present as the deliberate addition the requirement names, not as inherited spike behaviour.
**Tasks:** q0050-lifecycle, q0050-engine-compose, q0050-shared-events.

**AC-3b — a failed run's next pull throws**
Given a run whose second step throws,
When the terminal event is consumed and the iterator is pulled once more,
Then that pull rejects with the module's single `FlowError`, re-exported from `../lint/lint.js`, and
`error.message` is non-empty and names the cause.
**Tasks:** q0050-event-channel, q0050-lifecycle.

**AC-3c — the terminal schema rejects malformed shapes**
Given a valid `completed` terminal payload,
When one unknown key is added, or when a `regressed` payload is built with only three of its five
regression-only fields present,
Then `runTerminalEventSchema` rejects both — the discriminated union requires the group complete or
wholly absent, never partial.
**Tasks:** q0050-shared-events.

**AC-3d — non-regressed statuses carry no regression fields**
Given `completed`, `aborted`, `failed` and `interrupted` terminal events,
When they are checked against the schema's non-regression branch,
Then none of `targetFlow`, `counter`, `count`, `limit`, `remaining` is present or accepted on them.
**Tasks:** q0050-shared-events.

---

## AC-4 — The gate channel

**AC-4a — a passive consumer sees the question, correlated rather than compared by identity**
Given a flow with an author-declared human gate and no `answerGate` behaviour attached to the
consumer beyond draining,
When the run reaches the gate,
Then a `gate` event is yielded on the stream carrying `gateId`, `kind`, `reason`, absolute
`ticketDir` and (only when offered) `retry`, matching the fixture's `gate` shape, whether or not
anything is ready to answer it yet. The assertion checks that this `gateId` is the one the eventual
answer must repeat and that `kind`/`reason`/`ticketDir`/`retry` equal the step's own declared
values — it does not assert deep-equality against a hand-built event literal constructed
independently of the call, since `askGate` is contracted only to allocate and emit *a* correlated
question, not to echo a caller-supplied object verbatim.
**Tasks:** q0050-routing, q0050-event-channel.

**AC-4b — the answer may arrive later, from outside the pull**
Given a pending gate question and an `answerGate` callback whose promise resolves 200 ms later from
a timer outside the `for await` loop,
When that promise resolves with `advance`,
Then the run continues and completes without the consumer having done anything but keep iterating.
**Tasks:** q0050-routing.

**AC-4c — correlation, not text-parsing; stale and duplicate answers are refused**
Given a pending gate with `gateId = g1`,
When an envelope naming a different or already-resolved `gateId` is delivered, and separately when a
second envelope for `g1` is delivered after the first was accepted,
Then both are refused explicitly (the run fails naming the gate) rather than silently applied, and
the accepted answer is exactly the first one.
**Tasks:** q0050-routing.

**AC-4d — an answer outside the closed union is rejected, not treated as a default**
Given a gate awaiting an answer,
When the callback resolves with an envelope whose `answer` is not one of `advance | retry | abort`,
Then the run fails naming the gate rather than treating the value as any particular one of the
three — the shape is a compile-time closed union in `shared` and a runtime-validated boundary in
`routing.ts`.
**Tasks:** q0050-routing, q0050-shared-events.

**AC-4e — no channel supplied fails the run by name**
Given a flow reaching a human gate and `RunFlowOptions.answerGate` left `undefined`,
When the run reaches that gate,
Then the run fails naming the gate's kind and reason — it does not advance, abort silently, or hang.
**Tasks:** q0050-routing.

**AC-4f — auto/`--auto`/`--dry` are evaluated before a question exists**
Given three flows: one with an `auto`-kind gate, one with an author-declared human gate run under
`auto: true` on the options, and one run with `dry: true`,
When each reaches its gate,
Then the first two emit `info` (`gateAutoAdvanced`) and consume no answer; the dry run emits `info`
(`gateDryRun`) and consumes no answer; and a fourth flow whose gate is `human-locked` run under
`auto: true` still asks — it never auto-advances.
**Tasks:** q0050-routing.

**AC-4g — every answered gate is logged before the answer is acted on**
Given an author-declared gate answered `advance`,
When the run continues past it,
Then `runs.log` carries the `log.gateAnswer` line, and that line is present the moment the answer is
observed to take effect (never written after) — asserted on the observable order of effects, not on
the relative position of two identifiers in `routing.ts`'s source text.
**Tasks:** q0050-routing.

**AC-4h — `signalWindow` is preserved and pinned**
Given `askGate`'s implementation in `routing.ts`,
When its source is inspected,
Then the 1000 ms timer survives with a same-line comment reading `Why: preserved defect, see Q-0050
AC-4.`, matching the accepted decision's "cost accepted" clause rather than being silently dropped
or silently kept unremarked.
**Tasks:** q0050-routing.

---

## AC-5 — A run that stops early still writes its terminal record; `core` never exits the process

**AC-5a — a step throws**
Given a run whose second step's script exits non-zero, driven against a real temporary repository,
When the run is driven to exhaustion,
Then every active occurrence is finalised `failed` with its category before `finish(..., 'failed',
<first 200 chars of the first line>)` runs, `runs.log` gets its terminal line, and the iterator's
subsequent pull throws — matching AC-3b from the other direction.
**Tasks:** q0050-lifecycle, q0050-engine-compose.

**AC-5b — cancelled mid-step**
Given a run with an `AbortSignal` aborted while a step is executing, driven against a real temporary
repository,
When the abort fires,
Then the run's terminal record is `interrupted` with note `received SIGINT`-equivalent text, is
complete on disk before the caller regains control, and a process-wide check confirms `core`
installed no `process.on`/`process.once` signal listener and called `process.exit` nowhere.
**Tasks:** q0050-engine-compose, q0050-lifecycle.

**AC-5c — cancelled while suspended at a gate**
Given a run awaiting `answerGate`'s promise at a pending gate, with an `AbortSignal` aborted before
that promise ever resolves,
When the abort fires,
Then the run ends `interrupted`, the same terminal record and log line as AC-5b, and no answer is
ever applied even if the callback later resolves.
**Tasks:** q0050-routing, q0050-lifecycle.

**AC-5d — the consumer walks away**
Given a `for await` loop over the stream that executes `break` after its third yielded event, mid-run,
When the iterator's `return()` is invoked by that `break`,
Then `return()` does not resolve until the interrupted terminal record and counters are persisted —
an abandoned run is recorded exactly as AC-5b's cancellation, not silently dropped, which is the
failure mode the spike's `finally` (removing only signal listeners) does not guard against today.
**Tasks:** q0050-event-channel, q0050-lifecycle.

**AC-5e — no listener leak across repeated runs**
Given ten sequential runs against the same process, mixing completed and cancelled outcomes,
When `process.listenerCount` for every signal is read before the first and after the tenth,
Then the counts are identical — nothing accumulates.
**Tasks:** q0050-engine-compose.

---

## AC-6 — Counters, the backward edge and the exhaustion gate

**AC-6a — arithmetic across a bounded loop**
Given a step whose `on_fail` targets an earlier step with `max_iterations: 2` and no explicit
`counter`,
When the step fails three times in a row,
Then the counter key is `` `${flow.name}.${step.id}` ``, its value is 1 then 2 after the first two
failures (each emitting the exact `loopIteration` text and permitting the goto), and the third
failure — where the pre-increment value would exceed the limit — instead records `exhausted` and
presents the synthesised gate.
**Tasks:** q0050-routing.

**AC-6b — an untouched sibling loop**
Given a second, independent bounded loop elsewhere in the same flow that never fails,
When the loop in AC-6a exhausts,
Then the sibling's counter remains absent/zero throughout.
**Tasks:** q0050-routing.

**AC-6c — `--auto` cannot bypass the exhaustion gate**
Given the same flow run with `auto: true`, and containing one author-declared `auto`-kind gate
elsewhere,
When the run reaches the author-declared gate and then the loop's exhaustion gate,
Then the first auto-advances with no answer consumed, and the second still asks — `human-locked`
regardless of `--auto`.
**Tasks:** q0050-routing.

**AC-6d — the spend is on disk before the question is asked**
Given the loop from AC-6a exhausting,
When the exhaustion gate is presented but not yet answered,
Then `ticket.md`'s history already carries an `exhausted` entry (via `recordEvent`, cost 0, same
stage before/after) and `runs.log` already carries its `log.recordEvent` line — both written before
`askGate` returns, checked by reading disk state at that point in the run, not by a source-order
assertion.
**Tasks:** q0050-routing, q0050-lifecycle.

**AC-6e — `advance` changes no counter**
Given the exhausted gate from AC-6a answered `advance`,
When the run continues,
Then every counter (the exhausted one and any sibling) is byte-identical to its pre-answer value —
`advance` accepts the current result and moves nothing.
**Tasks:** q0050-routing.

---

## AC-7 — `retry` authorises exactly one more traversal

**AC-7a — the retried counter is set to the limit, not cleared**
Given two independent bounded loops, one exhausted per AC-6a and one untouched,
When the exhausted gate is answered `retry`,
Then the retried loop's counter becomes exactly `max_iterations` (not 0, not deleted), the untouched
loop's counter is unaffected, the retry's own goto is permitted as the one authorised traversal, and
the next failure of that same loop increments past the limit and re-presents the gate rather than
looping again.
**Tasks:** q0050-routing.

**AC-7b — the grant is logged exactly**
Given the same `retry` answer,
When `runs.log` is read afterward,
Then it carries the `log.retryGrant` line naming the counter and the value set.
**Tasks:** q0050-routing.

**AC-7c — `retry` with no retry target aborts**
Given an author-declared human gate with no `retry` target configured,
When it is answered `retry`,
Then the run ends `aborted` — the spike's actual fallthrough behaviour — rather than being rejected
as an invalid answer.
**Tasks:** q0050-routing.

---

## AC-8 — Cross-flow regression derives its stage from the target's `consumes`

**AC-8a — the ticket regresses to the target's `consumes`, and the target never runs**
Given a fixture pair of flows A and B, where one of A's steps has `on_fail: { goto: 'flow:B' }`,
and B declares `consumes: qa-red`, run against a real temporary repository,
When that step in A fails,
Then the run ends `regressed`, the ticket's stage becomes `qa-red` (B's `consumes`, never B's
`produces`, never a hard-coded value, never A's own `consumes`), and none of B's steps are ever
invoked.
**Tasks:** q0050-routing, q0050-engine-compose.

**AC-8b — the exact warning and the seven terminal fields**
Given the same regression,
When the stream and the terminal event are inspected,
Then a `warn` event string-equal to `crossFlowRegression` is yielded before the terminal event, and
the terminal event's regression fields are B's name, A's pre-mutation stage as `stageBefore`, `qa-red`
as `stageAfter`, the counter key, count, limit, and `remaining` clamped at zero when count equals
limit.
**Tasks:** q0050-lifecycle, q0050-shared-events, q0050-routing.

**AC-8c — a goto to an absent flow fails naming it**
Given `on_fail: { goto: 'flow:does-not-exist' }`,
When that step fails,
Then the run fails naming the flow and the cause, and the ticket's stage is left unchanged — not
regressed, not advanced.
**Tasks:** q0050-routing, q0050-engine-compose.

**AC-8d — `remaining` after a retry that consumed the full budget**
Given a loop retried once per AC-7a so that its counter equals `max_iterations`, which then fails
again and cross-flow-regresses,
When the terminal event's regression fields are read,
Then `remaining` is 0 (count === limit), not negative.
**Tasks:** q0050-routing.

---

## AC-9 — `finish()` moves the stage on two statuses only; task branches are not rolled back

**AC-9a — five runs, one per status**
Given five separately driven runs reaching `completed`, `regressed`, `aborted`, `failed` and
`interrupted` respectively, exercised through a test file that imports `finish`, `outcome` and
`recordEvent` directly from `./lifecycle.js`,
When each finishes,
Then `ticket.meta.iterations` is persisted for all five, the ticket's stage changes only for
`completed` (to `flow.produces`) and `regressed` (to the target's `consumes`), and a history entry
is appended for every one of the five — including the three that do not advance the stage.
**Tasks:** q0050-lifecycle.

**AC-9b — the two `runs.log` formats**
Given a completed run and a run that rolls its branch back,
When `runs.log` is read,
Then the terminal line matches `log.terminal` exactly (including the JSON-quoted `errorSuffix` only
when `note` is non-null) and the rollback line matches `log.rollback` exactly.
**Tasks:** q0050-lifecycle.

**AC-9c — the rollback's four-way guard**
Given a run whose ticket branch moved during execution (start head ≠ some later head), tested across
`dry`/non-`dry`, `completed`/non-`completed`, start-head null/non-null, and current-head equal/
different,
When `finish()` runs,
Then the branch is reset only in the one cell where all four conditions point to it: non-dry,
non-`completed`/non-`regressed`, start head truthy, and current head differs from it — every other
cell leaves the branch untouched.
**Tasks:** q0050-lifecycle.

**AC-9d — task branches survive, and no helper exists to move them**
Given a failed run where a fan-out-style task branch (created directly by the test fixture, not by
this ticket's own code) sits beside the ticket branch,
When `finish()` completes,
Then the task branch's head is unchanged (a behavioural check, run against the real branch), and a
source scan of `lifecycle.ts` and its siblings finds no function that resets or deletes a task
branch in any form (the one half of this scenario a source scan legitimately answers, since it is a
negative-existence claim about the codebase rather than a claim about runtime behaviour).
**Tasks:** q0050-lifecycle.

**AC-9e — a run-history initialisation failure still terminates cleanly**
Given a persistence capability whose initialisation throws,
When the run is started,
Then the failed terminal line is written to `runs.log`, the stage is not moved, and no manifest
finalisation is attempted.
**Tasks:** q0050-engine-compose, q0050-lifecycle.

**AC-9f — cost precision splits between `finish()`'s return and the persisted history entry**
Given a `LifecycleContext` whose `stats.cost` is `1.23456`,
When `finish` resolves for a `completed` run, and separately when the `TicketHistoryEntry` it wrote is
inspected (or `outcome` is called directly with the same rounded value `finish` would pass it),
Then `finish`'s resolved `RunOutcome.cost` is the raw `1.23456` — matching AC-3a's terminal-event
correction, since nothing on the return path rounds it — while the persisted history entry's `cost`,
built by `outcome`, is rounded to three decimal places (`1.235`). This is `lifecycle-routing.
contract.md`'s one stated rounding clause ("`finish` supplies distinct stages and rounded run cost");
it applies to the value fed into the persisted entry, never to `finish`'s own returned object.
**Tasks:** q0050-lifecycle.

---

## AC-10 — `--dry` writes no file; its two preserved mutations are pinned, not fixed

**AC-10a — nothing lands on disk**
Given a flow with an agent step, a script step and a gate, run with `dry: true`,
When the run completes,
Then `ticket.md` and `runs.log` are byte-unchanged on disk, no `.quorum/` directory is created, and
no worktree is created by anything this ticket owns.
**Tasks:** q0050-engine-compose, q0050-lifecycle.

**AC-10b — the in-memory ticket still advances (preserved, asserted positively)**
Given the same dry run,
When the in-memory `ticket` object passed into `RunFlowOptions` is inspected after the run,
Then its `meta.stage`, `meta.iterations` and `history` reflect `finish()`'s assignment exactly as a
non-dry run would — the disk write alone is the no-op, matching `Why: preserved defect, see Q-0050
AC-10.`
**Tasks:** q0050-lifecycle.

**AC-10c — counters alias the ticket's iterations object (preserved, asserted positively)**
Given a dry run over a flow containing a bounded loop that fails once,
When the run's internal counter object and `ticket.meta.iterations` are compared by reference,
Then they are the same object — a write through one is visible through the other immediately,
matching the same preserved-defect line.
**Tasks:** q0050-engine-compose.

**AC-10d — the dry view is a prototype, not per-call guards**
Given a dry run's constructed backlog view,
When `write`, `writeFile` and `log` are called on it, and separately when a read method inherited
from the prototype is called,
Then the three writers are no-ops and the read method still executes against the real backlog —
`Object.create(backlog)` with three own-property overrides, not a guard at each call site.
**Tasks:** q0050-engine-compose.

**AC-10e — the dry gate consumes no answer**
Given a dry run reaching a gate,
When the gate is encountered,
Then an `info` event string-equal to `gateDryRun` is yielded and `answerGate` is never invoked.
**Tasks:** q0050-routing.

**AC-10f — `finish()` adds no per-call dry guard of its own; the view is what is dry**
Given a `LifecycleContext` whose `persistence.writeTicket` (and `appendLog`) delegate to
`ctx.backlog.write`/`log` — real for a non-dry call, the `Object.create` no-op view for a dry call —
rather than being an independent bare mock,
When `finish` is called once non-dry and once dry with everything else identical,
Then `persistence.writeTicket` (and the ticket-history push, counters, `emit`) run unconditionally in
both calls — `finish`'s own source contains no `if (ctx.dry)` or ternary switching its own writer
calls — while the underlying `backlog.write` the delegate reaches is invoked in the non-dry call and
never invoked in the dry call, because the no-op view absorbs it rather than a guard inside `finish`.
**Tasks:** q0050-lifecycle.

---

## AC-11 — The stage precondition and the six helpers

**AC-11a — the stage precondition fires before anything else, each required value checked on its own**
Given a ticket whose `meta.stage` does not equal `flow.consumes`,
When `runFlow` is invoked,
Then the very first thing observable is a failure whose message is checked with four separate
assertions — one each for the ticket id, the ticket's actual stage, the flow's name, and the flow's
`consumes` — never a single regex combining them behind `|`, which a message naming only one of the
four could satisfy. No dry substitution happened, no context was built, no `runs.log` line was
written and no run directory exists; this scenario needs no real repository, since the rejection
happens before any file is touched.
**Tasks:** q0050-engine-compose.

**AC-11b — `loadFlow` lints before returning**
Given a flow file that parses as YAML but fails `lintFlow` — an id-bearing step whose `on_fail` has
no `goto` (never "a step with no `id`", which lints clean per Q-0055 and cannot demonstrate this
scenario),
When `loadFlow(file)` is called,
Then it throws lint's own error rather than returning an unvalidated `Flow`, and for a valid file it
returns a `Flow` whose `.file` equals the path passed in.
**Tasks:** q0050-loaders.

**AC-11c — `loadFlowByName`'s two failure shapes**
Given a harness directory missing `flows/ghost.yaml`, and separately one whose `flows/broken.yaml`
declares an id-bearing step with `on_fail` and no `goto` (the same lint-failing construct as AC-11b,
never an id-less step),
When `loadFlowByName('ghost', harnessDir)` and `loadFlowByName('broken', harnessDir)` are called,
Then the first throws `ENOENT` (not `FlowError` — it performs no existence check of its own) and the
second throws the lint `FlowError`.
**Tasks:** q0050-loaders.

**AC-11d — `loadRole`'s falsy and missing cases**
Given a step with no `role` property, and separately a step naming a role file that does not exist,
When `loadRole` is called for each,
Then the first returns `{ meta: {}, body: '' }` and the second throws `FlowError` whose message
contains the full path attempted.
**Tasks:** q0050-loaders.

**AC-11e — `interpolate`'s unknown-key and dotted-key behaviour**
Given a template containing `{known}`, `{unknown}` and `{a.b}` where only `known` is a top-level key
in the values object,
When `interpolate` runs,
Then `{known}` is substituted, `{unknown}` is left literally as `{unknown}`, and `{a.b}` is looked up
as the flat key `"a.b"` (which is absent) and also left literal — never treated as a path into a
nested `a` object, and never substituted with an empty string.
**Tasks:** q0050-loaders.

**AC-11f — `writesOf` prefers the singular**
Given a step declaring both `output.write` and `output.writes`,
When `writesOf(step)` runs,
Then it returns the singular value only, and for a step declaring only the plural it returns that
array — inventing no path in either case.
**Tasks:** q0050-loaders.

**AC-11g — `reviewRound` counts completed rounds only**
Given a ticket directory with `review/round-1/verdict.md`, `review/round-2/` (no `verdict.md` yet),
and separately a ticket with no `review/` directory at all,
When `reviewRound(ticketDir)` runs on each,
Then the first returns 2 (highest round *containing* `verdict.md`, plus one — round 2 doesn't count
because it has none) and the second returns 1.
**Tasks:** q0050-loaders.

---

## AC-12 — Git-fails vs. branch-absent, stated everywhere and tested at the two owned sites

**AC-12a — the start-of-run branch-head site**
Given `LifecycleContext.readBranchHead` injected to return `null` (standing in for both "no such
branch" and "git failed" — the two are indistinguishable at this boundary today),
When a run that later needs to roll back is driven to a non-completed, non-regressed, non-dry
terminus,
Then the rollback block is skipped with no warning at all — the same behaviour whether the branch
was truly absent or git itself failed — and the source carries `Why: preserved defect, see Q-0050
AC-12.` at that call site.
**Tasks:** q0050-engine-compose.

**AC-12b — the rollback-read site**
Given a run whose start head was a real, truthy value, but whose `readBranchHead` returns `null`
specifically at the point `finish()` re-reads the current head,
When `finish()` runs,
Then the rollback is skipped with no warning, even though the run genuinely moved the branch and a
non-null read would have triggered the reset — the same preserved-defect line applies.
**Tasks:** q0050-lifecycle.

**AC-12c — a gate or script nested in a `parallel` group still dispatches as an agent step**
Given a `parallel` group containing one member of kind `gate` and one of kind `script`,
When the group runs,
Then both are dispatched through `runAgentStep`, not through gate or script handling — the
preserved defect the requirement names, not a crash and not correct routing.
**Tasks:** q0050-routing.

**AC-12d — an `on_fail` goto to an unknown step id throws `TypeError`, not `FlowError`**
Given a step whose `on_fail.goto` names a step id absent from the flow (bypassing lint, which
normally forbids this),
When that step fails,
Then the run dies with a raw `TypeError` from indexing the step list at `-1`, not a `FlowError` —
preserved because lint protects the normal path and no ticket authorises hardening the engine
against a lint bypass.
**Tasks:** q0050-engine-compose.

**AC-12e — each of the eight sites states its disposition somewhere durable (verified by reading, no test file)**
Given `lifecycle-routing.contract.md`'s "Preserved diagnostic decisions" table, frozen to every
implement task,
When it is read against this ticket's owned files at the gate,
Then all eight sites — the two above plus base/ticket sync, the discard report, five task-branch
filters and the merge-failure consumers — have a stated disposition (even "exactly what it does
today"), satisfying AC-12's "for each site, state it" obligation without requiring
`dev/implement-report.md`, which this route does not produce.
**This is a freeze check on a landed, implementer-unwritable file, not an acceptance test that starts
red and turns green, and it is not implemented as a test at all.** All six subject strings the table
needs are present today, so this scenario can never be red at any point in the loop — and per this
role's own rule, a check that can never fail is not a scenario to encode as one. Round 2's
`docs-q0050.test.ts` implemented it as an automated `fs.readFileSync` over
`contracts/Q-0050/lifecycle-routing.contract.md`, which is exactly the read that escaped Q-0072's
undeclared-input guard (B-1); the fix is to remove the read, not to register it. Verified once, by
reading, at the gate — it does not count toward AC-12's *tested* coverage of the eight sites, which
is AC-12a and AC-12b alone.
**Tasks:** *(no production task and no test file — verified once at the gate, not run by `pnpm test`.)*

---

## AC-13 — House rules, corrected docs, and the freeze

**AC-13a — lint, typecheck and test, forced**
Given the complete engine folder and its `packages/shared` additions,
When `pnpm lint`, `pnpm typecheck` and `pnpm test` run forced, in the merge worktree and again in a
fresh checkout of `main` after merge,
Then all three pass in both environments with no suppressed diagnostic lacking a same-line reason
and no new `@typescript-eslint/no-deprecated` finding.
**Tasks:** q0050-engine-types, q0050-event-channel, q0050-loaders, q0050-routing, q0050-lifecycle,
q0050-engine-compose, q0050-shared-events.

**AC-13b — the docs describe the terminal member and the channel (tested in `packages/shared/src/docs.test.ts`)**
Given `docs/GLOSSARY.md`'s **Event** entry and `docs/04-architecture.md` principle 2 and its
`runFlow` line,
When they are read after this ticket,
Then each describes the terminal event, the out-of-band `answerGate` channel, caller-owned
cancellation, the parallel-group ordering limit and the no-timestamp rule, and cites *"What a run's
event stream carries, and how a gate answer travels back"* (2026-08-28) by that exact title and
date — never by file name or number.
This scenario is implemented as a new `describe` block inside `packages/shared/src/docs.test.ts` —
already the file asserting over GLOSSARY's **Event** term, and already declared as a turbo input by
`packages/shared/turbo.json` — not as a new file under `packages/core/src/engine/`; a core-side test
reading `docs/GLOSSARY.md` with no matching `turbo.json`/`READ_BASES` entry is exactly what B-1
struck. `docs/03-adapter-contract.md` is **out of this criterion's tested scope**, per
`solution/errata.md` E-5(c): measured to contain neither `runFlow` nor "event stream" today, so it
has no existing claim to correct, and the `q0050-documentation` task's edit to it (if any) is not
separately verified by a scenario.
**Tasks:** q0050-documentation (doc edits); the test lives in `packages/shared/src/docs.test.ts`,
owned by QA, not by any production task.

**AC-13c — dependency direction**
Given `packages/core` and `packages/shared`,
When the shared-resolution test runs,
Then `core` imports event/flow/ticket/role/step-output types from `shared`, and `shared` imports
nothing from `core`.
**Tasks:** q0050-shared-events, q0050-engine-types.

**AC-13d — preserved-defect comments name their authority, never transcribe it**
Given every `Why: preserved defect, see Q-0050 AC-<n>.`-style comment added across the six files,
When the comments are scanned,
Then each is a single line naming the criterion, and none reproduces a sentence from
`docs/DECISIONS.md`, the ticket body or the requirement verbatim.
This scan reads only `packages/core/src/engine/*.ts` — already inside the package, no external doc
read to register — and belongs beside AC-1's and AC-12's shape checks in `q0050.source.test.ts`, not
in a separate documentation-testing file.
**Tasks:** q0050-routing, q0050-lifecycle, q0050-engine-compose.

**AC-13e — the freeze is intact**
Given the full diff this ticket's tasks produce,
When it is checked against `spike/**`,
Then nothing under `spike/` changed, and CI's branch-scoped port-freeze job passes over this
ticket's branches.
**Tasks:** *(repo-wide check, not owned by any single task — verified at the gate.)*

---

## Findings

**The empty-merge-error clause in `lifecycle-routing.contract.md` names no site inside a
Q-0050-owned file.** No file `tasks.yaml` assigns to this ticket calls `mergeInto` or consumes
`mergeFailure`'s result; the fan-out/integrate code that does is Q-0053's, unwritten. Per this role's
brief — *"if a criterion needs a file no task owns, say so as a finding instead of encoding it as a
scenario"* — this document does not write a Q-0050 scenario for the empty-error-suffix fallback. It
does not need one: the behaviour is already pinned in Q-0048's landed
`packages/core/src/fanout/fanout.test.ts` (`:405`), and it will be exercised again as a *consumption*
site when Q-0052 and Q-0053 land, which is where `lifecycle-routing.contract.md`'s own table places
it. **This is now formalised rather than merely recommended:** `solution/errata.md` E-5(a),
written during round 2's own exhaustion gate at the reviewer's request, strikes
`lifecycle-routing.contract.md:97-98`'s *"tests the non-empty subject before the empty merge-error
suffix"* clause and records exactly this disposition, so a future reader has the erratum rather than
only this document's finding to go on.
</document>
