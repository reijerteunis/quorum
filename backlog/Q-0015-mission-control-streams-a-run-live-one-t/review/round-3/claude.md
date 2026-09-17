# Q-0015 — code review, round 3

*Read-only review. Cross-vendor: claude. Reviewed against the branch tip
`harness/Q-0015/integration` = `b81415a`, not against the patch supplied with this prompt — see
observation O-1, which is why.*

**Verdict: `revise`.** Two majors, five nits, two observations.

---

## What was reviewed, and how much of it

`git diff main...harness/Q-0015/integration` is **181,044 bytes** against `repo.max_diff_bytes`'s
200,000 default. **Nothing was truncated**, no file arrived without a patch, and the alphabetical
tail R-4 named as the thing a cut would hide — `apps/web/test/source.test.ts` and
`apps/web/test/routes.test.ts` — was present and read. Two of the nits below are in it. R-4's
prediction is therefore refuted by measurement, which is the second consecutive ticket to predict
its own truncation and be wrong about it (Q-0127 was the first).

Verified at the source rather than from the reports: `apps/web/src/{app,run-connection,
mission-control-model,mission-control-status,mission-control-trace,mission-control-screen,
mission-control-text,runs-screen,routes,daemon-client,connection-state,request-state}.ts(x)`,
`apps/web/test/{source,routes}.test.ts`, `contracts/Q-0015/mission-control.contract.md`,
`docs/04-architecture.md`, and — because three criteria rest on claims about them —
`packages/shared/src/{events,wire}.ts`, `packages/server/src/{http,serve,broadcast,host}.ts`,
`eslint.config.js` and `tsconfig.base.json`.

---

## Findings

### M-1 (major) — a Retry appends the daemon's replay onto the trace the browser kept, so every retained event renders twice

**`apps/web/src/run-connection.ts:218`** (`retry()`), against **`:207–215`** (`connect()`).

`connect()` clears `events`, `missedCount` and `browserDiscardedCount` before opening. `retry()`
clears none of them and calls `open()` on the same URL. On the other end, a new socket is a new
subscription: `packages/server/src/serve.ts:162` calls `host.subscribe(handle)`, and
`packages/server/src/broadcast.ts`'s `subscribe()` builds `{ queue: [...retained] }` — its own
docblock says *"Registers a subscriber, **replaying what is retained**"* — so the reconnected socket
sends the whole retained buffer (up to `DEFAULT_RETENTION` = 500, `serve.ts:47`) ahead of the live
tail. The browser appends all of it to what it already holds.

**Failure scenario, concretely.** A run emits 40 events; the socket closes `1006` after opening, so
`reduceConnection` lands on `interrupted` (`connection-state.ts`), whose *only* offered action is
Retry (`canRetry` returns true for `interrupted`, `dropped` and `protocol-error` — exactly the three
states in which the browser is holding accepted events). The reader presses it. The daemon replays
40; `partitionTrace` is now handed 80; **every column and the run-activity lane render every line
twice**, in a single ordered list where the duplicate pair is not adjacent. A second Retry makes it
120. Past 500 the new eviction fires and AC-10's browser sentence reports *"This browser discarded N
earlier live events to keep the view bounded"* for a loss caused by duplication rather than by
volume — which is precisely the confusion AC-10 and the frozen contract's *"two counters, two
sentences, never confusable"* exist to prevent. `missedCount` also survives the retry: `serve.ts`
sends a `missed` frame only `if (missed)`, so a zero-eviction replay leaves the previous
connection's count on screen describing a replay that did not happen.

**Scope, stated rather than assumed.** This is latent Q-0120 code and it has been invisible because
nothing rendered the list — `shell.tsx` reads `.at(-1)` and `.length`, so the only symptom was an
inflated count nobody could check. **AC-9 opens this exact file**, and
`.claude/rules/engineering.md` says a defect found in code you are already changing is reported. It
is reported here rather than carried, because this ticket is what makes it visible: the screen whose
subject is *what the run is doing* shows each thing it did twice, after the one action offered for
the failure it is most likely to meet.

It is also not an oversight that can be closed by reading the module: `run-connection.ts`'s own
docblock states both halves of the contradiction — *"reconnects only through an explicit retry that
**preserves accepted evidence**"* and *"the daemon's `missed` envelope exists precisely so a gap is
reported rather than smoothed over"*. Preserving the browser's evidence and accepting the daemon's
replay cannot both hold without a resume cursor, and there is none.

**Recommendation.** Rule it, in this round. The cheap and defensible answer is that `retry()` clears
`events`, `missedCount` and `browserDiscardedCount` exactly as `connect()` does — the daemon's
replay plus its `missed` count is a complete and self-describing account of the run, and the browser
has nothing to splice it with. If the gate prefers to keep the pre-retry evidence, the duplication
has to be disclosed in its own sentence and must not be allowed to drive the browser-discard
counter. What it may not do is ship silent: a trace that renders each line twice is not a report,
and no criterion or test currently fails on it.

---

### M-2 (major) — the terminal event's `status` and `error` reach no surface on the screen

**`apps/web/src/mission-control-trace.tsx:35`** —
`case 'terminal': return \`${event.stageBefore} → ${event.stageAfter}\``.

`runTerminalEventSchema` (`packages/shared/src/events.ts`) carries `status` — one of `completed`,
`aborted`, `failed`, `interrupted`, `undecided`, `regressed` — an optional `error`, and, for
`regressed`, `targetFlow`, `counter`, `count`, `limit` and `remaining`. `eventLine` renders the two
stage strings and drops all of it, and **nothing else on the screen carries it**:

- `connectionStateText({ kind: 'ended' })` is `'The run has finished.'` (`connection-state.ts`) —
  one sentence for all six statuses;
- `mission-control-status.tsx:144` renders `metadata.value.state`, which is the **host's**
  `running | ended | refused` (`WireRun.state`), not the run's verdict;
- `data-run-identity` renders the terminal's `runId` and nothing else from that event;
- the timeline is built from `step`/`done` alone.

**Failure scenario.** A run dies `failed` with
`error: "codex exited 1: You've hit your usage limit"`. Mission control renders, in the
run-activity lane, `terminal  red → red`, and above it *"The run has finished."* — **byte-identical
to a `completed` run whose stage did not move** — with the error string on no surface at all. An
`undecided` run is the sharper case: that status means the run stopped at a gate nobody answered,
which is the single thing a human watching this screen most needs to see, and it renders exactly
like a success. A `regressed` run loses its counter, limit and remaining traversals as well.

This is **review round 2's major 3 one field over**. That finding added `WireRun.state` and
`refusal.condition` to the header on the reasoning that the screen was *"admitting a gap with the
daemon's words one field away"*; `status` and `error` are the run's own words, already sitting in
`snapshot.events`, discarded by the renderer. AC-11's discipline is to **name what cannot be
shown** — this can be shown and is not, and no disclosure says so.

**Recommendation.** Extend `eventLine`'s `terminal` arm to name the status and, where present, the
error, verbatim and uninterpreted — the same treatment every other arm gives its payload. Nothing
blocks it: AC-11's no-fabrication assertion is scoped to `data-mission-control-header`, and the lane
is not that region. If the gate rules the run's outcome out of this ticket, then
`MISSION_CONTROL_DISCLOSURES` owes a sixth sentence saying the outcome is deliberately not rendered
here and where it is — silence is the one answer that is wrong, on this screen above all.

---

### N-1 (nit) — the AC-6 guard's test title still says "twelve", two lines above an assertion of six

**`apps/web/test/source.test.ts:76`**: `test('the complete source corpus contains none of the twelve
parsing forms', …)`, with `:77` reading `expect(MESSAGE_PARSE_NEEDLES).toHaveLength(6)`.

`b81415a` moved the comment above the register and the contract's paragraph; the sentence a reader
and a failing-test report meet first still describes the twelve-needle set round 2 replaced —
which is the set that had stopped forbidding a bare `cost=`. Rename to six.

### N-2 (nit) — a route-register failure message now reads `[object Object]`

**`apps/web/test/routes.test.ts:149`**:
`` expect(app, `the app does not select ${route} by the register's own constant`) ``.

Round 1's N4 replaced the literal tuple loop with `for (const route of SCREEN_ROUTES.filter(…))`,
so `route` is the row object where it used to be the path string. The message the guard exists to
produce now names nothing. `${route.path}`.

### N-3 (nit) — three exported labels claim a check that no test makes

**`apps/web/src/runs-screen.tsx:30`** (`RUNS_HEADING`, and `:33`/`:36` beside it), whose JSDoc says
they exist *"so a test and the view cannot disagree about what this screen is"*.
`apps/web/src/runs-screen.test.ts` imports none of the three, while
`backlog-board.test.ts:18`, `gate-screen.test.ts:27` and `ticket-page.test.ts:24` each import their
screen's and assert over them. Either assert them here or drop the sentence — a claim with no check
behind it is this repository's most-recorded class, and the house pattern already shows what the
check looks like.

### N-4 (nit) — `runsInFlight` sits in the component while every sibling lives beside its fetch

**`apps/web/src/runs-screen.tsx:46`**. `daemon-client.ts` holds `runInFlight`, `ticketsInFlight`,
`flowsInFlight`, `ticketInFlight`, `ticketFileInFlight` and `gateAnswerInFlight`, and this ticket
added `fetchRuns` to that same module. Moving `runsInFlight` beside it restores the one-module rule,
removes the five-line comment explaining why it is not there, and removes `runs-screen.tsx`'s only
import of `DAEMON_ENDPOINTS`.

### N-5 (nit) — an unused type import in two new test files

**`apps/web/src/mission-control-status.test.ts:2`** and **`apps/web/src/runs-screen.test.ts:2`**
import `type ReactElement` and annotate nothing with it (`mission-control-trace.test.ts:11` does,
which is where the line was copied from). Neither gate catches it: `tsconfig.base.json` sets no
`noUnusedLocals`, and `eslint.config.js` enables three rules, none of them `no-unused-vars`.

---

## Observations

*Exempt from the verdict rule per* "A finding is a claim about the change; anything else is an
observation" *(2026-09-11). Neither is a claim about the change, and neither carries a `file:line`.*

**observation: the diff supplied with this review is one commit behind the branch, and reviewing it
as given would have produced a false finding.** The patch in the prompt is 22 files and 1,316
insertions; `main...harness/Q-0015/integration` at tip `b81415a` is **23 files and 1,335
insertions**. Two differences: the patch's `contracts/Q-0015/mission-control.contract.md` is 84
lines and specifies *"twelve parse needles: each of `cost=`, `role=` and `verdict=` prefixed by…"*,
while the branch's is 88 lines and specifies **six**, matching the guard `c89e865` shipped; and
`backlog/Q-0015-…/solution/errata.md` (15 lines) exists on the branch and is absent from the patch.
Read from the patch alone, the frozen contract contradicts the shipped guard and re-specifies the
hole round 2's major 4 closed — a major that is simply not true of the tree. This review is written
against the tree. Worth recording because the cause is not truncation, which the repository already
has a warn and a ticket for (Q-0128); it is a diff materialised before the commit that answered the
previous round.

**observation: R-4 is refuted, measured.** 181,044 bytes against the 200,000 cap, zero truncation
notices, and the two files R-4 named as the tail a head-cut would hide were both present and are
where N-1 and N-2 were found.

---

## What was checked and holds

Recorded so a later reader knows what this round examined rather than passed over.

- **AC-14's load-bearing half is intact.** `WRITE_RULES` (`apps/web/test/source.test.ts:255`) is
  unmoved: six needles, `'/stop'` still `permitted: null`, `PUT`/`PATCH`/`DELETE` still `null`, and
  all three anti-vacuity clauses read as they did — `writeOffenders(true)` empty,
  `writeOffenders(false)` exactly the two named modules, and the stop needle's `toBeNull()`. R-6's
  named failure mode did not happen.
- **AC-4/AC-5 are correct.** `partitionTrace` keys on exact `stepId` via `'stepId' in event`, which
  is sound against the union: `info`, `warn`, `gate` and `terminal` declare no such field and every
  other member declares it required (`events.ts`), so no event can reach a column under an
  `undefined` key. Conservation holds by construction; first-appearance order holds because the
  `Map` is iterated in insertion order.
- **AC-7's third disposition is real**, including the evicted-start case, and `runEnded` is derived
  from the events rather than from connection state.
- **AC-9's citation is true.** `DEFAULT_RETENTION = 500` at `packages/server/src/serve.ts:47`, so
  the browser's bound is derived rather than invented and the JSDoc's claim about the daemon is
  accurate. Eviction allocates a new array, so an already-returned snapshot is genuinely unchanged.
- **AC-11's four stated causes are each true of the shipped wire**, checked individually:
  `WireRun.runId` is nullable and assigned only on the terminal branch; no event carries a
  timestamp; cost crosses only inside `done.message`; and `wireFlowSchema`
  (`packages/shared/src/wire.ts:405`) really does carry no step list. Round 2's major 2 is closed
  correctly — the filter drops disclosure 0 exactly when a terminal `runId` exists, and
  `runTerminalEventSchema.runId` is `z.number()`, so there is no null-terminal case where the filter
  misfires.
- **AC-12** derives the link from `pendingGates` and not from a streamed `gate` event, and
  `GET /runs` projects through the same `wireRunOf` as `GET /runs/:id`, so it is robust to either
  read.
- **Round 1's M3 is genuinely closed.** I traced `connectedHandle` (`app.tsx`) through
  handle→handle, run→board→run, run→gate→run and a `socketFactory` identity change: in every path
  either the guard holds or the controller-lifecycle effect has already set `snapshot` to `null`, so
  no commit paints one run's trace, terminal run number or gate link under another's handle.
- **No XSS surface.** Every event field renders as React text; `runPath` and `gatePath` both
  `encodeURIComponent` the handle into a path that always begins `/runs/`.
- **No new guard violations.** The new `src` files are clear of the containment synonyms, the timer
  needles, the persistence APIs, the five count fields, the `cost to date` phrase, `node:` imports
  and the six AC-6 parse needles.
- **`docs/04-architecture.md`'s ordering claim is accurate**: `packages/server/src/http.ts:194–198`
  does `.filter(…).reverse()`, so the daemon is what reverses and the screen re-sorting nothing is
  the right rule.
