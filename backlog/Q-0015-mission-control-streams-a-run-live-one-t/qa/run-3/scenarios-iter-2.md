
# Q-0015 — QA scenarios, run 3, iteration 2

*Supersedes `qa/run-3/scenarios-iter-1.md`. `qa/run-3/scenario-review-iter-1.md` returned `revise`
on exactly one blocker (B-1) and one required generalisation, and said of everything else: "the
catalog is otherwise correct and should be re-emitted unchanged... A round spent rewriting a sound
document is the churn this repository has measured three times; the subject of this revise is one
line of a fixture and one sentence of §9." This iteration therefore reproduces iteration 1's
structure and content in full and applies exactly those two changes, both marked inline below.*

**Change 1 (closes B-1, required).** Section 6, `mission-control-status.test.ts`: the nine-state
connection fixture's `requestedUrl: 'wss://x'` literal (three occurrences, all on the same line)
must be assembled rather than written raw, so it does not trip `daemon-endpoints.test.ts`'s AC-13
same-origin scan — the scan walks the whole `src` corpus, test files included, for a socket-scheme
literal among its three needles.

**Change 2 (the class, not the instance; required).** Section 9, `source.test.ts`: a new bullet
generalises the assembled-literal convention beyond AC-6's own twelve needles, to any needle any
shipped `apps/web/src` scan forbids — which is what change 1 is an instance of, and what should stop
the next fixture from rediscovering this failure.

Everything else below is unchanged from iteration 1 in substance.

---

Every scenario below describes **permanent, post-implementation behaviour**. None depends on a file
not yet existing or any other fact that stops being true once T01–T09 land: these are acceptance
tests, not red-phase evidence, per the rule that a fact only true during the red phase is evidence
for the integration report and not a scenario.

**Task satisfiability, checked first.** All 14 criteria map to at least one of T01–T09 in
`solution/tasks.yaml`, cross-checked against the architecture review's own AC→task coverage table,
which found no unsatisfiable criterion and no two tasks sharing a file. No task owns any test
file — those are QA's, and `solution.md`'s file-ownership section names exactly the five existing
files extended below (`daemon-client.test.ts`, `run-connection.test.ts`, `routes.test.ts`,
`source.test.ts`, plus `shell.test.ts` where applicable) plus four new ones under `apps/web/src`.

---

## 1. `apps/web/src/daemon-client.test.ts` (extend) — T01

- **AC-1 / one validated read.** *Given* a fetcher that resolves `GET /runs` with a body matching
  `wireRunListSchema`, *when* `fetchRuns(fetcher, now)` is called, *then* it resolves to
  `{kind:'loaded', value:{runs:[...]}, fetchedAt}` and the fetcher was invoked exactly once against
  `DAEMON_ENDPOINTS.runs`.
- **AC-1 edge / the same five outcomes as `fetchRun`.** *Given* three fetchers — one that rejects,
  one that resolves 4xx with a `WireRefusal` body, one that resolves 200 with a body failing
  `wireRunListSchema` — *when* `fetchRuns` is called for each, *then* it answers `unreachable`,
  `refused` (carrying the refusal), and `unparseable` respectively, proving `fetchRuns` invents no
  sixth outcome beyond the closed five `RequestState` already has.

## 2. `apps/web/src/mission-control-model.test.ts` (new) — T02

- **AC-4a / interleaved grouping.** *Given* events for two distinct `stepId`s **interleaved,
  alternating** (not two contiguous blocks — the load-bearing shape per the requirement), *when*
  `partitionTrace` runs, *then* it returns two columns, ordered by first appearance, each holding
  only its own events in arrival order.
- **AC-4b edge / collapsed ids.** *Given* two events sharing the exact same `stepId`, **including
  the literal string `'undefined'`**, *when* `partitionTrace` runs, *then* they land in **one**
  column — the pre-Q-0050-round-6-fix engine shape, pinned as a regression.
- **AC-5a / run-activity membership.** *Given* one each of `info`, `warn`, `gate`, `terminal` (none
  carries a `stepId` field), *when* `partitionTrace` runs, *then* all four land in `runActivity` in
  arrival order.
- **AC-5b edge / no prefix parsing.** *Given* an `info` event whose `message` contains a
  `"dev:T-0001.1: "`-style prefix, *when* `partitionTrace` runs, *then* it still lands in
  `runActivity` and is **not** attributed to that step's column — proves message text is never
  parsed to re-derive ownership.
- **AC-5c / conservation.** *Given* a mixed fixture of N events, *when* `partitionTrace` runs,
  *then* `runActivity.length + Σ column.events.length === N` — the checkable "nothing is dropped"
  property.
- **Vendor derivation (feeds AC-6).** *Given* a step whose first event is a `spawn` naming vendor
  `codex` and whose later event is a `retry` naming vendor `claude`, *when* `partitionTrace` runs,
  *then* that column's `vendor` is `'claude'` — the **latest** of `spawn` **or** `retry`, not
  `spawn`-only.
- **AC-7a–d / the three dispositions plus the evicted-start case.** *Given* (a) a `step` alone, (b)
  a `step` then its `done`, (c) a `step` with no `done` followed by a `terminal`, (d) a `done` with
  no preceding `step`, *when* `buildStepTimeline` runs, *then* it reports `started`, `ended` (with
  `doneMessage` set), `started-with-no-end-reported` (`runEnded: true`), and `ended` respectively.
- **AC-7e / the distinction has a subject.** *Given* fixture (c) above, *when* the disposition is
  read, *then* it is literally `'started-with-no-end-reported'` and not `'started'` — the assertion
  that would go green if the third disposition were collapsed into the first, which is exactly the
  failure mode the requirement names as needing its own case.
- **AC-7f / no invented rows.** *Given* a fan-out parent's events (`info`/`warn` only, per
  `runFanOut` never emitting `step`/`done`), *when* `buildStepTimeline` runs, *then* no timeline
  row exists for the parent — a row appears only for a `stepId` actually observed on `step` or
  `done`.

## 3. `apps/web/src/run-connection.test.ts` (extend) — T03

- **AC-9a–c / bounded retention.** *Given* exactly `RUN_EVENT_RETENTION` (500) accepted events,
  *then* the 501st, *then* continued overflow to 700, *when* each batch is delivered, *then*
  `snapshot.events` never exceeds 500, always holds the newest events in order, and
  `browserDiscardedCount` is exact (0, then 1, then 200).
- **AC-9d / immutability.** *Given* a snapshot captured before an eviction, *when* further events
  push the tail past retention, *then* the earlier captured snapshot object is unchanged
  (`toStrictEqual` against a saved copy).
- **AC-9e / reset on retarget.** *Given* a connection with a non-null `browserDiscardedCount`,
  *when* `connect()` is called for a new handle, *then* `browserDiscardedCount` resets to `null`
  (mirroring `missedCount`'s existing reset).
- **AC-9f / the comment states the surviving reasons, not the withdrawn one.** *Given*
  `run-connection.ts`'s comment beside the per-event append, *when* read, *then* it argues the
  immutable-append trade on bounding an otherwise-O(n) append and matching the daemon's disclosed
  retention, and does **not** claim a browser "may not hold what the daemon cannot replay," and does
  **not** describe Q-0121 as something that "will hold several controllers at once" — Q-0121 shipped
  as the daemon's run **listing**, not a multi-controller browser change, so that forecast is stale
  and is corrected in the same edit that adds `RUN_EVENT_RETENTION`.
- **AC-10 / two independent counters.** *Given* a `missed` frame **and** enough overflow to trip
  browser-side discard, with **different** values for each, *when* the snapshot is read, *then*
  both counters are non-null and unequal — proving they are not aliases of one field.
- **AC-10 lexical pin.** *Given* `daemonMissedText(7)` and `browserDiscardedText(7)` (same count, so
  the distinguishing power must come from words), *then* each string contains at least one word
  absent from the other (`daemon`/`replay` vs. `browser`/`discarded`/`bounded`) — the byte-level
  property the contract names explicitly.

## 4. `apps/web/src/runs-screen.test.ts` (new) — T01, T05

- **AC-1a–c / mount-once, no poll, explicit refresh.** *Given* a spy fetcher, *when* `RunsScreen`
  mounts, *then* exactly one `fetchRuns` call fires; *when* fake timers are advanced, *then* no
  second call fires; *when* the Refresh control is activated, *then* exactly one further call
  fires.
- **AC-2a / daemon order preserved.** *Given* a response whose rows are deliberately **not** in
  handle-sorted order, *when* rendered, *then* the DOM order matches the response order exactly.
- **AC-2b / row fields and link.** *Given* one row, *then* it shows handle, flow, state, pending-gate
  count, and links to `runPath(handle)`.
- **AC-2c–d / explicit ticket absence.** *Given* one row with `ticketId: null` and another with a
  real id, *then* the first renders `NO_TICKET_ID_TEXT` verbatim and no other row's id, and the
  second renders its own id rather than the absence sentence.
- **AC-3a / five distinct, actionable states.** *Given* in-flight / unreachable / refused /
  unparseable, *then* each renders distinct non-empty text with retry offered exactly where
  `canRetryRequest` says so.
- **AC-3b / honest empty, with its cause.** *Given* a `loaded` response with `runs: []`, *then* it
  renders `EMPTY_RUNS_TEXT` verbatim, which itself names the cause (no producer in this app, and
  `quorum run` being a separate process) rather than reading as a bare error.
- **AC-3c regression.** `REQUEST_STATE_KINDS.length` is still 5 as imported — the empty-list case is
  not promoted into a sixth kind by this screen's own logic.

## 5. `apps/web/src/mission-control-trace.test.ts` (new) — T02 (via `TraceColumn`/`TracePartition`), T06

- **AC-4 render / one column per exact id.** *Given* a `TracePartition` with two columns, *then* the
  component renders two elements each carrying `data-trace-step-id="<exact stepId>"`, each
  containing only its own events in order.
- **AC-5 render / the lane.** *Given* a partition with a non-empty `runActivity`, *then* one region
  carries `data-run-activity` holding those events in arrival order.
- **AC-6a / verbatim, escaped text.** *Given* a `stdout.line` containing markup (e.g. an HTML tag),
  *then* it renders as literal text, never interpreted.
- **AC-6b / badge sourced from the column, not guessed.** *Given* one column with a non-null
  `vendor` and one with `null`, *then* the first shows a vendor badge with that value and the second
  shows none — no placeholder guess.
- **AC-6c / nothing else is derived.** *Given* event messages that happen to contain the substrings
  `role=`, `model=`, `branch=`, `cost=` or `verdict=`, *then* the rendered trace region never shows
  a model, worktree branch, token count or cost anywhere — only the raw event fields the props
  supply.

## 6. `apps/web/src/mission-control-status.test.ts` (new) — T07

- **AC-8a / nine distinct states.** *Given* each of the nine `ConnectionState` members, *then*
  `data-mission-control-state` renders distinct non-empty text for each.
- **AC-8b / metadata vs. connection, not confused.** *Given* connection `live` and metadata
  `unreachable` simultaneously, *then* the two rendered sentences are distinguishable — proving the
  socket's account and the HTTP read's account do not collapse into one.
- **AC-8c / independent retries.** *Given* both `onRetryConnection` and `onRetryMetadata` supplied,
  *when* one control is activated, *then* only its own callback fires.
- **AC-10a–d / two counters, two sentences, zero is silent.** *Given* (a) daemon-only non-zero, (b)
  browser-only non-zero, (c) both non-zero and unequal, (d) both zero/null, *then* respectively:
  only the daemon sentence; only the browser sentence; both, each showing its own value and neither
  showing the other's; neither sentence at all.
- **AC-11a / all five disclosures, verbatim, in order.** *Given* any live-run fixture, *then* all
  five `MISSION_CONTROL_DISCLOSURES` strings render inside `data-mission-control-disclosures`,
  unparaphrased and in array order.
- **AC-11b / no fabricated header value.** *Given* the same fixture, *then*
  `data-mission-control-header`'s text contains none of `—`, `$`, `0:00`, `n/a`.
- **AC-11c–d / run identity, sourced correctly.** *Given* a socket snapshot with no `terminal` event
  observed, *then* `data-run-identity` shows the raw handle. *Given* a snapshot whose events include
  a `terminal` carrying `runId`, *then* it shows that number **without** needing `metadata.runId` to
  be set — proving the source is the terminal event, not a second fetch. The converse (loaded
  metadata carrying a non-null `runId`, no terminal observed yet) must still show the handle, not
  metadata's number — the exact pairing the review names as discriminating.
- **AC-12a–b / gate link from `pendingGates`.** *Given* loaded metadata with `pendingGates: 1`,
  *then* a link renders with `href` built via `gatePath(handle)`. *Given* `pendingGates: 0`, *then*
  no link renders.
- **AC-12c edge / derived from the read, not the stream.** *Given* a socket snapshot whose events
  contain **no** `gate` event at all (retention evicted it, or the browser joined late) but loaded
  `metadata.pendingGates === 1`, *then* the link **still** renders — the clause that discriminates
  "derived from `pendingGates`" from "derived from a live `gate` event" and proves the late-joiner
  case the daemon's retention exists to serve.
- **Fixture correction (closes B-1, required this iteration).** The nine-state fixture array used
  by every scenario above builds three of its states — `connecting`, `live`, `no-daemon` — with
  `requestedUrl: 'wss://x'`, a raw socket-scheme literal, all three on one line. That trips
  `apps/web/test/daemon-endpoints.test.ts`'s AC-13 same-origin scan, which walks the **whole** `src`
  corpus, test files included, for exactly this shape (`/['"`]wss?:/`). *Given* this fixture is
  authored, *when* `requestedUrl` needs a value that merely has to look like a socket URL, *then*
  it is assembled — e.g. `['wss', '://x'].join('')` — rather than written as the matching literal,
  following the identical convention this same file already uses one test later for a path
  (`['', 'runs', 'h'].join('/')`), and every sentence rendered from it stays byte-identical to
  before, because `requestedUrl` is only ever interpolated, never parsed.

## 7. `apps/web/src/mission-control-screen.test.ts` (new) — T08, and (via `App`) T09

- **AC-7 render / timeline uses exact contracted labels.** *Given* a driven snapshot mixing
  `step`/`done`/`terminal` across two ids, *then* one row per id renders, in first-observed order,
  each under `data-step-disposition` showing the **exact** `STEP_DISPOSITION_TEXT[...]` string —
  asserted as the specific sentence, not "non-empty text", so a mislabelled third disposition is
  caught by name.
- **AC-8 composition / no-such-run renders zero columns.** *Given* connection state `no-such-run`,
  *then* the trace region renders **zero** columns (not empty-but-present) — a composition-level
  fact, since only the screen decides whether/what to hand the trace component.
- **AC-8 composition / two independent regions, simultaneously.** *Given* connection `live` and
  metadata `in-flight`, *then* both are rendered as distinguishable, non-blocking regions at once.
- **AC-13a / handle-to-handle retarget, not a dangling second controller.** *Given* `App` rendered
  at `/runs/handle-a` then navigated to `/runs/handle-b` **without** an intervening non-run route,
  *then* the socket opened for handle A is closed (`closes >= 1`) as a side effect of the same
  controller's `connect()` replacing it — proving one owned controller was retargeted rather than a
  second, independent controller left open alongside the first.
- **AC-13b regression / leaving still disposes, with the real screen now mounted.** Re-verify
  `shell.test.ts`'s existing "leaving a run route… closes the socket… opens no replacement" holds
  once `MissionControlScreen` (not a placeholder) is what's mounted at `RUN_ROUTE` — same assertion
  shape, new main-content renderer underneath it.
- **AC-13c regression / the gate route still opens nothing.** *Given* `App` navigated directly to
  `/runs/:handle/gate`, *then* zero sockets are constructed — re-verified now that a sibling route
  (`/runs/:handle`) is a live screen rather than a placeholder, guarding against the exclusion in
  `app.tsx` being accidentally widened or narrowed.
- **AC-13d / stale callback inertness.** *Given* a message delivered on socket A **after**
  navigating to handle B (socket A superseded), *then* it does not appear anywhere in the currently
  rendered handle-B screen and moves neither loss counter currently displayed.
- **AC-14 wiring / dispatch by register constant.** *Given* `App` initialized at `RUNS_PATH`,
  *then* the runs landing renders (its own fetch path is exercised). *Given* `App` initialized at a
  `RUN_ROUTE` path, *then* mission control content renders and the old placeholder's `waitingFor`
  sentence is **gone** from the page — a direct regression pin that the dispatch actually changed.

## 8. `apps/web/test/routes.test.ts` (extend) — T04, plus N-1 and N-2's named remedies

- **AC-14a–b / the `/runs` row (N-1's remedy).** Rewrite the now-false assertions: `screenExists:
  true`, `ticket: 'Q-0015'`, and a **new** non-empty `waitingFor` (length > 60, ends with `.`) that
  does **not** match `/No ticket builds this screen yet/`; assert the replacement sentence directly
  rather than constraining it with the stale `/listing/` substring match.
- **AC-14c–d / `RUN_ROUTE` and the rail.** `RUN_ROUTE`'s row flips `screenExists` to `true`; the
  existing rail-identity assertions extend to include `'runs'` among the entries with a screen.
- **AC-14e / the binding guard is derived, not enumerated (N-2's remedy).** The loop currently
  hard-coding `[['BOARD_PATH', BOARD_PATH], ['TICKET_ROUTE', TICKET_ROUTE], ['GATE_ROUTE',
  GATE_ROUTE]]` is rewritten to derive its subjects from `SCREEN_ROUTES.filter((route) =>
  route.screenExists)`, so it automatically covers `RUNS_PATH` and `RUN_ROUTE` alongside the three
  existing constants without a fifth or sixth entry needing to be remembered by hand.
- **AC-14f / show the derived guard red before green.** With that derivation in place, removing
  `RUNS_PATH` (or `RUN_ROUTE`) from `app.tsx`'s selection logic makes this specific assertion fail,
  naming the missing route — the demonstration SE-2 explicitly asks for.
- **AC-14g / the five-row identity.** The existing `SCREEN_ROUTES.filter(screenExists).map(path)`
  identity extends from three entries to five:
  `[BOARD_PATH, TICKET_ROUTE, GATE_ROUTE, RUNS_PATH, RUN_ROUTE]`.
- **AC-14h / the write boundary is provably unchanged.** Extend the existing `WRITE_RULES`
  assertions with an explicit regression pin: after this ticket's six new files join the corpus,
  `'/stop'`'s `permitted` is still `null` and the permitted-module set is still exactly
  `['daemon-client.ts', 'daemon-endpoints.ts']` — guarding against an implementer widening the
  write boundary while adding the stop control prematurely (which is explicitly out of scope here).
- **Recommended, not required (this review's N-1).** The guard's own route→constant-name mapping
  currently ends in a catch-all naming `RUN_ROUTE`, so a hypothetical sixth screen-bearing route
  matching none of the five would be checked against `RUN_ROUTE`'s own needle rather than failing
  outright. Registering each path against its constant name explicitly, and refusing a path with no
  entry, closes that for a sixth route. Not required for this revise round — AC-14f already holds
  for the two routes this ticket adds — but worth taking if the same file is being edited anyway.

## 9. `apps/web/test/source.test.ts` (extend) — E-1's twelve-needle correction (AC-6)

- **AC-6-src-a / the corpus is clean today.** The complete `apps/web/src` corpus (every file,
  including tests and non-TS) contains none of the twelve needles: `cost=`, `role=`, `verdict=`,
  each immediately preceded by `'`, `"`, `` ` ``, or `/`.
- **AC-6-src-b / the scan discriminates (positive control).** A fixture string containing
  `` `cost=$0.123` `` is rejected — proves the guard has teeth.
- **AC-6-src-c / the specific false positive E-1 exists to avoid.** The fixture string
  `[role="progressbar"]` (the real selector `backlog-board.test.ts` uses) is **accepted** — the
  character immediately before `role=` there is `[`, not one of the four prefixes, so bare `role=`
  is correctly not a needle.
- **AC-6-src-d / the guard is not its own subject.** Fixture strings inside this test are assembled
  (e.g. via concatenation), on the same house convention every other needle scan in this file
  already uses, so the guard's own source file cannot trip its own scan.
- **AC-6-src-e / the convention generalises beyond this guard's own needles (new this iteration,
  required — closes the class, not the instance).** *Given* any fixture authored under
  `apps/web/src` — in this guard's own tests or in any other — *when* it needs a value that would
  otherwise match a needle **any** shipped scan in this package forbids (this guard's twelve, or
  `daemon-endpoints.test.ts`'s three same-origin needles: a socket-scheme literal, the daemon
  hostname, the chosen daemon port), *then* that value is assembled rather than written as a
  matching literal. §6's fixture correction above is the first instance this rule was needed for;
  this bullet is what stops the next one being discovered the same way — by a review rather than by
  the author.
- **Regression note, not a new scenario.** The existing five-field cost/token guard
  (`tokensByVendor`, `vendorTokenTotal`, `input_tokens`, `output_tokens`, `cached_input_tokens`, and
  the phrase "cost to date") already scans the whole corpus generically and needs no edit — the six
  new mission-control files introduce none of those fields, satisfying it by construction.

---

## Flagged — not encoded as scenarios

Per the rule that a criterion needing a file no task owns, or resting on an unfalsifiable/manual
fact, is reported rather than faked into a test:

1. **AC-14's `docs/06-development-plan.md` bullet-move clause.** Errata **SE-3** narrowed T10 to
   `docs/04-architecture.md` only, on Q-0094 erratum E-3(a)'s precedent: that page is rewritten by
   hand at each plan pass and carries post-run facts (cost, rounds, findings) no development task
   can know. No task owns writing it, so no red test can pin its content.
2. **Gate obligations GO-1 (decision entry), GO-4 (glossary ruling), GO-5 (successor allocation),
   GO-6 (truncation measurement + CI-green).** These are the human gate's obligations, not
   acceptance criteria the shipped code satisfies — nothing to assert in a `.test.ts` file.
3. **AC-9's "verification product" (observed event count / peak concurrent column count) and
   AC-14's "verification" (hand `POST /runs` demonstration against a running daemon).** Both are
   manual/integration demonstrations the requirement asks for at implement/review time, over a real
   daemon this workspace's automated suite does not stand up — not part of the red suite.
4. **Ground rule 6 (the event union is not edited here).** Verified by task-ownership review rather
   than by a new test: no task among T01–T10 touches `packages/shared/src/events.ts`, and that
   package is outside every granted role path for this ticket's fan-out.
5. **Scenario-review observation O-1** (the red-report artifact's result-line roster does not match
   turbo-prefixed output, hiding most failures from the trimmed report). A defect in
   `packages/core/src/engine/`'s reporting pipeline, outside this ticket's surface, already routed
   to Q-0076/Q-0133. Not this catalog's to test — noted so a future reader does not expect a
   scenario for it here.
6. **Scenario-review observation O-2** (no flow step runs `tsc` before `test`, so a type error in a
   QA fixture would only surface in CI). An observation about the flow, not a claim this change
   needs a scenario for; the fixtures above are consistent with the real `events.ts` schemas
   (`gate`'s optional `retry`, `terminal`'s `completed` member).
7. **Scenario-review observation O-3** (AC-9's retention bound was derived rather than measured
   against a real per-run event count). Correctly left unmeasured by this suite; the requirement
   routes that measurement to AC-14's hand `POST /runs` demonstration and to Appendix A(b), not to a
   unit-level scenario.
</document>
