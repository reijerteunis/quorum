a# Q-0015 — Mission control streams a run live, one trace column per step

*Merged requirement, run 1, **iteration 2**, 2026-09-16. Surface: `apps/web`, plus one new read in
`apps/web/src/daemon-client.ts` against a route that already exists. No `core` change, no daemon
route, no wire shape, no dependency, **and no mutation**.*

> **Fourteen criteria.** The ticket is scoped smaller than either candidate; §5.6 carries the seam
> and Appendix A carries both successors in full. Every open question is ruled. What remains for the
> gate is ratification, in §8 — and no criterion below moves under either answer to any of it.

---

## 0. What was measured, and where iteration 1 is corrected

### 0.0 The tree has not moved, and this is said first

`HEAD` is `ddc9155` — the commit that opened this ticket. `docs/decisions/` still ends at
**096**, `git status` shows one untracked path and it is this run's own `requirements/` folder, and
no file named by any criterion below has changed. **Iteration 1's document could not have been
falsified by the tree**, so the only honest thing a second pass can do is re-derive its measurements
rather than re-read its conclusions, which is *"a retry on an unchanged tree cannot rule its own
blocker"* (Q-0090, Q-0096) — sixth recorded instance, and the fourth where the second pass found
something anyway (Q-0105, Q-0122, Q-0016).

**Thirteen measurements were re-run and held exactly.** Four `step` emit sites and three `done`
sites; `vendor` on both `spawnEventSchema` (`events.ts:105`) and `retryEventSchema` (`:123`);
`WireRun.runId` nullable at `wire.ts:156` with `gates` and `pendingGates` beside it;
`REQUEST_STATE_KINDS` closed at five; `DEFAULT_RETENTION = 500`; one production caller of
`host.start`; `WRITE_RULES`' six needles and three anti-vacuity clauses; the route register rows and
`routes.test.ts`'s two count assertions as quoted. **Two moved, and both are below.**

### 0.1 The decisive enabling fact holds

Each parallel member and each fan-out child stamps its **own** `stepId` on every adapter event
(`steps.ts:289`), and the run loop's single slot fills one in only where the emitter supplied none —
`engine.ts:76–93`, whose comment reads *"An id the emitter already carries WINS"*. A `parallel:`
container carries no id of its own; a fan-out child is named `<step>:<task.id>`
(`composite.ts:144`). Verified at all four sites.

This is Q-0050 round 6's Major 1 fixed, **never yet exercised by any consumer**, because it was
fixed against a stubbed `runAgentStep`. AC-4 is the first reader of those ids in this product's
history, which is why its interleaving clause is named as not eligible for trimming.

**The hazard, re-verified.** `withStepId` switches on the event type and stamps only `spawn`,
`stdout` and `retry`; `default:` passes the event through untouched. That branch is load-bearing:
`infoEventSchema` and `warnEventSchema` are `.strict()` over `{type, message}` alone, so a stamped
`info` would carry an unknown key, `parseFrame` would answer `invalid-event`, and — since Q-0120
round 2's M-4 — **a refused frame ends the socket**. Mission control would die on the first `info` of
any agent step. It cannot. Recorded so the next reader does not have to re-derive that the dullest
branch of that switch is the one holding this screen up.

### 0.2 `done` is emitted three times and on no failure path

| | sites, counted today |
| --- | --- |
| `step` | **4** — agent dry (`steps.ts:260`), agent live (`:277`), script (`:384`), integrate (`composite.ts:243`) |
| `done` | **3** — agent success (`steps.ts:353`), script exit 0 (`:394`), integrate success (`composite.ts:414`) |

A failing agent step re-throws, a non-zero script emits a `warn`, an aborting integrate returns.
**So the absence of a `done` is not evidence that a step is running.** A timeline rendering every
unpaired `step` as *running* would report a failed step as in flight for the rest of the session, on
the screen whose whole job is saying what a run is doing. Codex's AC-11 has two dispositions and
would have shipped exactly that; claude's AC-4 has three, and is adopted (AC-7).

A fan-out **parent** emits neither — `runFanOut` emits only `info` and `warn` — so a timeline
expecting a parent row renders nothing for it. Its children pass through `runAgentStep` and do appear.

### 0.3 The un-attributed stream — **corrected: 36 lines, 37 sites, and one of them is a helper**

Four of the nine event kinds carry no `stepId` **field at all**: `info`, `warn`, `gate`, `terminal`.
Iteration 1 reported *"15 `info` and 22 `warn` sites … of which 17 carry a `${stepId}` in their
message text and 20 do not"*. Re-counted:

- `type: 'info'` — **15** matching lines. `type: 'warn'` — **22**. But the two greps together return
  **36 distinct lines**, not 37, because **one line matches both**:
  `composite.ts:55`, `context.emit(ok ? { type: 'info', message } : { type: 'warn', message })`.
- So the honest figures are **36 source lines carrying 37 emit sites**, and **17** carry a
  `${stepId}` in their message text. The complement is **19 lines**, not the 20 iteration 1 reported
  — a number produced by subtracting from a double-counted total.
- And the ternary is inside `report(context, ok, message)`, a **helper**: its message is the
  caller's, so whether that site names a step is not a property of the site at all.

Both candidates carried the arithmetic and so did I. It is a correction and not a reversal: **the
ruling it supports is unaffected and in fact strengthened** — worktree creation, base sync, wave
composition, merge conflicts, committed file counts and every `warn` a step raises live in this
stream, a screen that dropped it would drop most of what a run says about itself, and one that
re-attributed by parsing a prefix would be making a message into a contract. Both are refused
(AC-5). Recorded rather than quietly fixed, because *a measurement copied from a document is not a
measurement* and this is the instrument catching its own transcription.

So OQ-4 is not an edge case about a step that happens to carry no id. It is a lane.

### 0.4 What a column can contain, against what the brief draws

`docs/05-design-prompt.md:39` draws columns "streaming believable agent events (tool calls like
`Edit src/billing/plans.ts`, `Bash npm test — 34 passed`, short assistant reasoning snippets)".
`packages/shared/src/events.ts:25` says in its own table: **`tool`, `text` — emitted by nothing —
NOT ADDED**, and the paragraph beneath refuses to invent them. A column carries `spawn`, `stdout`,
`step`, `done` and `retry`; a `stdout` is one line of the vendor CLI's output, verbatim.

**And the two vendors are structurally asymmetric.** `claude.ts` runs `--output-format json` and
parses **one** document; `codex.ts` runs `--json` and parses **per line**, emitting one `stdout` per
line. The brief's two symmetric side-by-side columns are not what the stream produces: one scrolls
and one does not. AC-11(5) makes that explicit rather than letting a reader infer the product is
under-reporting.

The per-run event count is **not derivable from the tree** — `output.txt` is the extracted document
and `<step>-<ms>.raw.txt` exists only where structured output failed to parse, of which the whole
backlog holds three. Both candidates say so and both are right. No criterion rests on it, and AC-9's
verification produces the first datum this repository will have had.

### 0.5 Of the brief's per-column values, exactly one is a field — and codex is right about which

`spawn` carries `vendor` (`events.ts:105`) **and so does `retry`** (`:123`), which claude's AC-3
misses by naming `spawn` alone. Codex's AC-10 is adopted. The other four are prose:

- **model** inside the `step` message, `` `${adapterName}/${model} role=${role}` `` (`steps.ts:257`);
- **worktree branch** inside an `info`, `` `${stepId}: worktree ${cwd} (${branch})` ``;
- **cost** and **tokens** inside the `done` message via `formatCost` (`steps.ts:127–133`, `:353`) —
  `cost=$0.123`, or `cost=n/a (<n> tokens, vendor reports no price)`.

There is a **second, independent bar** claude found and codex did not, re-read in place today:
`apps/web/test/source.test.ts` forbids `tokensByVendor`, `vendorTokenTotal`, `input_tokens`,
`output_tokens` and `cached_input_tokens` in **any** file under `src`, and forbids the phrase
*cost to date*, each with its own discriminating fixture. A cost ticker here moves a shipped guard,
which is a decision and not a criterion. Appendix A(b).

### 0.6 The header's three absent values, re-verified

- **The run number is `null` for the whole life of a live run.** `WireRun.runId` is
  `number | null` (`wire.ts:138`, `:156`) and `host.ts:304` assigns it in the terminal-event branch
  alone, under a JSDoc at `wire.ts:103` saying it *"is `null` until the terminal event carries it"*.
  **Claude's correction is confirmed and is the useful one:** `runTerminalEventSchema` carries
  `runId`, so the number arrives **on the stream** when the run ends and needs no second fetch — it
  is absent exactly while it would be useful and present once it is not.
- **Elapsed has no source.** No event carries a timestamp (`events.ts:143`, *"What a run's event
  stream carries"*, 2026-08-28) and `WireRun` carries no start time. Timing from this browser's
  connection moment is a different quantity.
- **Per-vendor cost** — §0.5.

### 0.7 Where claude is wrong about the gate link, and codex is right

Claude's AC-9 derives the gate link from a `gate` event in the run-level lane. `WireRun` carries
`gates: readonly GateQuestionEvent[]` **whole**, plus `pendingGates`, both derived per request
(`wire.ts:140–143`) — added by Q-0016 for exactly this reason, and its JSDoc says so at `:118–119`:
*"`pendingGates` is what makes a row actionable … `gates` is what makes it ANSWERABLE"*. A browser
that joins a run already parked at a gate may never see that `gate` event: the daemon retains 500 and
evicts from the head, so the question can be behind the cut. **Claude's rule fails precisely for the
late joiner the retention exists to serve.** Codex's AC-20 is adopted (AC-12).

**New this iteration:** `GET /runs` projects each row through the **same** `wireRunOf` as
`GET /runs/:id` (`http.ts:194–199`), so a listing row already carries `gates` and `pendingGates`
whole. The gate link is therefore derivable from either read, which makes AC-12 robust to whichever
the implementation reaches for and is worth stating rather than leaving to be discovered.

### 0.8 What is already shipped, which both candidates under-state

`fetchRun` (`daemon-client.ts:193`), `runInFlight` (`:276`), `requestJson` (`:131`),
`request-state.ts`'s five kinds and `connection-state.ts`'s nine members all exist. So does the
connection lifecycle: `app.tsx:103–129` creates **one** controller for as long as the route is a run
route, **excludes `GATE_ROUTE` by name**, and re-targets on a handle change rather than replacing the
socket — its own comment says *"rendering a run's event stream is mission control's subject"* and
that `/runs/:handle` and `/runs/:handle/steps/:stepId` are unchanged. Codex's AC-21 is written as new
work and is not; it becomes a regression pin (AC-13), worth keeping because mission control is the
first screen that *renders* from the snapshot, so a stale append stops being invisible.

**`wireRunListSchema` has no browser consumer**, verified by search today: every reference outside
`@quorum/shared`'s own test is in `packages/server`'s. Q-0121's R-1 recorded it as shipping with none
and named this ticket as what would read it.

**One correction to codex.** Its AC-3 names six request states. `REQUEST_STATE_KINDS` is a closed
register of **five** — `in-flight`, `loaded`, `unreachable`, `refused`, `unparseable`
(`request-state.ts:40–42`) — and "empty list" is a *loaded value*, not a sixth kind. Adding it would
widen a closed set to hold a fact about a payload. AC-3 keeps the five.

### 0.9 The finding this run exists for: **mission control has no producer**

Claude's §0.9, re-verified: `host.start` has **exactly one** call site in the workspace outside
tests, `packages/server/src/http.ts:178`, and a search across `packages/server/src`,
`packages/cli/src` and `apps/web/src` finds no other `.start(` at all.

- **`apps/web` never issues it.** Its one non-GET is the gate answer; the shell's *Run flow* control
  is `disabled`; `backlog-board.tsx:19–24` refuses the brief's *"Run next flow ▸"* deliberately.
- **`quorum run` is a different process.** It imports `runFlow` from `@quorum/core` and consumes the
  stream in-process; it never touches `@quorum/server`. Confirmed from the manifest side too:
  `apps/web/package.json` declares `@quorum/shared` and **not** `@quorum/server`.

**So on a real machine today the daemon's run registry is empty and stays empty.** `GET /runs`
answers `{"runs": []}` and `/runs/:handle` is reachable only with a handle nothing mints.

This does not block the ticket and is not a reason to weaken it — the screen is fully buildable and
fully testable against a driven socket and a driven fetcher, `app.tsx` already taking an injectable
`socketFactory`. It changes three things, each carried into a criterion: the empty state is the
**honest** state of a real machine and must name its cause (AC-3); the acceptance evidence must say
how a run was produced (AC-14); and it is what decides where the stop button goes (§5.6).

---

## 1. Problem

A run in flight is invisible. The daemon has streamed events since Q-0118 and the browser has held
that socket since Q-0120, but the only thing rendered from it is four items in the top bar: a state
word, a missed count, an event count and the latest event's identity (`shell.tsx:94–125`). Everything
the run says — which step is speaking, what its vendor printed, which steps have finished, what the
engine warned about — is accepted into an array and shown to nobody.

Two shipped things are unreachable for it. `/runs/:handle/gate` shipped at Q-0016 and is reached only
by typing a URL; `GET /runs` shipped at Q-0121 and has had no consumer since.

## 2. User stories

**`maintainer`** — *"I started a flow and I want to see what it is doing, per step, while it does
it."* I open the run and get one column per concurrent step with that step's own output in it, a
timeline of what has started and what has finished, everything the run said that belongs to no step,
and — when it stops to ask me something — a way to get to the question.

**`maintainer`** — *"I want to know what I am not being shown."* I would rather read *"this trace
begins 340 events in, because the browser joined late"* than a column that looks complete, and
*"the run's number is not on the wire until it ends"* than a header showing `run #—`.

**`adopter`** — *"I ran `quorum open` and the Runs screen is empty."* I want to be told that the
daemon is driving no runs **and why one might be absent** — that this app does not start runs yet and
that a `quorum run` in my terminal is a different process this daemon cannot see — rather than
wondering whether something is broken.

## 3. Acceptance criteria

Fourteen. **AC-4, AC-5, AC-11 and AC-14 are not eligible for trimming**: the first is what this
screen is, the second is the only clause that makes *"nothing is dropped"* checkable, the third is
the no-fabrication rule, and the fourth is what proves the split at §5.6 was honoured rather than
quietly undone.

---

**AC-1 — The runs landing exists at `/runs`, reads once, and never polls.**
`/runs` renders a real screen. It issues `GET /runs` once when it mounts, through `requestJson` and
`wireRunListSchema`, which is already on `@quorum/shared`'s barrel and has no browser consumer
(§0.8). It does not refetch on a timer; a visible Refresh performs another explicit read.
*Test:* mount and assert exactly one fetch; advance fake timers and assert no second; activate
Refresh and assert a second. `source.test.ts`'s existing no-timer clause is unchanged and still
passes.

**AC-2 — A row says what the daemon said, in the order the daemon said it.**
Each returned run renders once with its handle, flow, state and pending-gate count, its `ticketId`
where non-null and an **explicit absence** where null — never an invented label, a dash or a blank
cell. Rows render in the order received and are **not re-sorted**: that order is the only recency the
wire carries and the handle is opaque, so sorting on it would invent one. Each row links to
`/runs/:handle`. The screen makes no claim about refused starts, which `GET /runs` does not return.
*Test:* a fixture whose rows are deliberately not in handle order asserts the rendered order matches
the response; a null-`ticketId` row asserts the explicit sentence and asserts no other row's ticket
id appears on it.

**AC-3 — The landing's five request states are distinct and actionable, and an empty list is not one
of them.**
`in-flight`, `loaded`, `unreachable`, `refused` and `unparseable` each render plain-language text
through `request-state.ts` verbatim, with its retry predicate offering the retry. **A loaded-but-empty
listing is a loaded value and not a sixth kind** — `REQUEST_STATE_KINDS` is a closed register and is
not widened (§0.8). The empty listing renders *the daemon is driving no runs*, never an error, **and
names why one may be absent**: nothing in this app starts a run, and a `quorum run` is a different
process this daemon cannot see (§0.9). No state is a spinner, skeleton, blank panel, colour or
disabled control alone.
*Test:* one case per kind asserting non-empty distinct text; an empty-list case asserting the
sentence **with its cause clause present**, since the sentence without it is the one that reads as a
failure; and an assertion that `REQUEST_STATE_KINDS` still has exactly five members.

**AC-4 — One trace column per `stepId`, and two concurrent members are distinguishable.**
`/runs/:handle` groups every event carrying a `stepId` by its exact value: one column per distinct
id, ordered by first appearance and not reordered by later interleaving, each holding that id's
events in arrival order.
*Test:* drive the app with a fake socket — `app.tsx` already takes an injectable `socketFactory` —
carrying events for `dev:T-0001.1` and `dev:T-0001.2` **interleaved, alternating**. The interleaving
is load-bearing: two ids arriving in two contiguous blocks would also pass over a renderer that
opened a new column on every change of id. Assert two independently labelled columns, each holding
only its own events, order preserved. A second clause asserts that a fixture in which both members
carry the **same** id, or the literal `undefined`, renders **one** column — which is what the
pre-Q-0050-fix engine produced, and this is the first consumer ever to read those ids (§0.1).

**AC-5 — The run-level lane, and nothing is dropped.**
Every event with no `stepId` **field** — `info`, `warn`, `gate`, `terminal` — renders in one
separately labelled run-activity lane, in arrival order. The `${stepId}: ` prefix that 17 of the 37
`info`/`warn` emit sites carry in their message text is **not** parsed to re-attribute an event to a
column (ground rule 2), and neither is any other message.
*Test:* a fixture carrying one of each of the four, one of them with a `dev:T-0001.1: ` prefix.
Assert all four in the lane; assert the prefixed one is in the lane and **not** in that step's
column; and assert `lane.length + Σ column.length === snapshot.events.length`, which is the clause
that makes *"nothing is dropped"* checkable rather than asserted.

**AC-6 — What a column renders, and what it never derives.**
Each entry names its event type and renders only fields that event supplies. `stdout.line` and every
message render **verbatim as text**, escaped, never interpreted as markup — agent output is
untrusted input. A column shows a vendor badge only after a `spawn` **or a `retry`** for that same
`stepId` supplied one (§0.5), and shows none otherwise rather than guessing. Nothing on the screen
renders a model, a worktree branch, a token count or a cost.
*Test:* a two-column fixture, one with a vendor-supplying event and one without, asserts the badge
and its absence; a further case supplies the vendor via `retry` alone, which is the clause that
discriminates this rule from claude's `spawn`-only one. A fixture whose `stdout.line` contains markup
asserts it renders as text. Plus a source clause over every file under `apps/web/src`: none contains
`cost=`, `role=` or `verdict=` as a literal, shown to discriminate over a fixture containing
`` `cost=$0.123` ``. The five count-field needles already forbidden by the shipped guard are
untouched.

**AC-7 — The timeline reports what was observed, and never calls a failed step running.**
One item per observed `stepId`, in first-observed order, built from `step` and `done`. A step has
exactly **three** dispositions and the third is named rather than collapsed into either neighbour
(§0.2): **started**, **ended** (rendering the `done` message), and **started with no end reported**.
Once a `terminal` has arrived, every item in the third disposition renders as one the run ended
without reporting an end for — never as running. A `done` arriving without its earlier `step` still
produces a completed item, because retention can evict a start. No queued or unobserved step is
invented: no route on this transport serves a flow's step list.
*Test:* four fixtures — a `step` alone; a `step` then its `done`; a `step` with no `done` followed by
a `terminal`; a `done` with no preceding `step` — each asserting the rendered disposition. A fifth
asserts that collapsing the third disposition into *running* turns the third fixture red, so the
distinction has a subject.

**AC-8 — Every non-streaming condition says something a reader can act on, in the main region.**
`ConnectionState`'s nine members (`connection-state.ts:15–24`) are already sentenced and already
shown in the top bar. This criterion is about the **main region**, which is never blank: where the
connection is not `live` and no event has been accepted, the region renders that state's sentence
and, where the retry predicate allows, the retry. `no-such-run` renders **zero** columns rather than
empty ones. The metadata read's own states render through `request-state.ts` and are not confused
with the socket's.
*Test:* nine assertions, one per connection state, each asserting non-empty text in the main region;
one asserting `no-such-run` renders no columns; one asserting an unresolved metadata read and a live
socket render two distinguishable sentences.

**AC-9 — The retained event list is bounded, and the bound is derived rather than chosen.**
`run-connection.ts` retains at most `DEFAULT_RETENTION`-many (500) of the most recent accepted
events, evicting from the head and incrementing a browser-discard counter. Per-event append work is
bounded by that figure rather than growing with the run's length, and a snapshot already handed to a
consumer still never changes after it is handed out — the immutability Q-0120 argued for deliberately
is preserved, not traded.
**Why 500, stated honestly and narrowed from iteration 1.** Three reasons, none of which is *"a
browser may not hold what the daemon cannot replay"* — that argument is **withdrawn**, because a
browser present from the start genuinely observed those events and its longer history is real rather
than fabricated. What survives: (a) it bounds an append that is otherwise O(n) per event and
quadratic over a long run, in the screen most likely to be left open all day; (b) matching the
daemon's own disclosed retention is what stops two readers of one run disagreeing about how much of
it exists, which a late joiner and an early one otherwise would; and (c) **any other number would be
invented** — no measurement of a per-run event count exists or can be produced from the tree (§0.4),
while 500 is a figure this product already applies and already discloses. The constant is named in
one place in this app with that reasoning recorded beside it.
*Test:* exactly 500 accepted; the 501st; continued overflow — asserting the newest 500 remain in
order, the discard counter is exact, and a snapshot taken before the eviction is unchanged after it.
*Accepted residual, stated rather than hidden:* `apps/web` declares `@quorum/shared` and not
`@quorum/server` (§0.9), so the two constants agree by **citation** and not by a shared symbol;
promoting it into `@quorum/shared` is a wire-shape question this ticket does not need to answer.
*Verification product:* AC-14's demonstration records its observed event count and peak concurrent
column count — the first per-run measurement this repository will hold, and what Appendix A(b)'s
revisit needs.

**AC-10 — Two losses, two counters, two sentences, never confusable.**
The daemon's `missedCount` renders *"the daemon omitted N earlier events from this replay"*; the
browser's discard counter renders *"this browser discarded N earlier live events to keep the view
bounded"*. They have different causes and different remedies; both may show at once; neither renders
at `null` or `0`; and neither is ever phrased so a reader could take one for the other. The screen
never describes a retained tail as the run's complete history.
*Test:* a `missed` frame alone, an overflow alone, and both together with **different** values;
assert each sentence reads its own counter, and a byte-level clause asserts the two sentences share
no distinguishing phrase.

**AC-11 — The screen names what it cannot show, and renders no substitute for any of it.**
One region, five sentences, each naming its reason:

1. **the run's number** — `null` on the wire until the run ends (`host.ts:304`, `wire.ts:103`); the
   **handle** identifies the run meanwhile, and the number renders once a `terminal` carries it;
2. **elapsed** — no event carries a timestamp, by *"What a run's event stream carries"* (2026-08-28),
   and `WireRun` carries no start time;
3. **per-vendor cost and token counts** — they cross only inside a `done` message (§0.5), and
   Q-0129 is their neighbour;
4. **what comes next in the flow** — `WireFlow` carries no step list, so the brief's
   *"integrate (queued)"* is a value nobody measured;
5. **structured tool calls and assistant reasoning** — `tool` and `text` are emitted by nothing
   (`events.ts:25`); what a column carries is the vendor's stdout, and the two vendors are
   structurally asymmetric about how much of it there is (§0.4).

No dash, no zero, no currency symbol, no spinner and no skeleton stands in for any of them. An
unpriced step is unpriced, not free.
*Test:* assert the five sentences on a live-run fixture; assert the header region's text matches none
of `—`, `$`, `0:00`, `n/a`; assert the run-identity region shows the handle before a `terminal` and
the number after one.

**AC-12 — The gate link, derived from a read and from the route register.**
Where the loaded `WireRun` reports `pendingGates > 0`, the screen offers a link to that handle's gate
screen. **Derived from `pendingGates` and not from a `gate` event in the lane**, because the daemon
evicts from the head and a browser joining a parked run may never see that event (§0.7). The link is
built by substitution into `GATE_ROUTE` — a `gatePath` beside the existing `ticketPath` — so no
component carries a route-path literal the register does not hold. Following it navigates; it answers
nothing, and no verdict, diff or answer control is duplicated here.
*Test:* fixtures at `pendingGates` 0 and 1 assert the link's absence and presence and its `href`; a
fixture whose socket carried **no** `gate` event but whose read reports one asserts the link is still
offered, which is the clause that discriminates this rule from the one it replaces. The existing
route-literal scan is unchanged and still passes.

**AC-13 — One connection across the run routes, re-targeted rather than leaked.**
A handle change re-targets the existing controller; leaving the run routes disposes it; and callbacks
from a disposed, closed or superseded socket cannot append an event, move either counter, or change
what the new route renders. `GATE_ROUTE` continues to hold **no** socket, which is Q-0016 erratum
E-2's ruling and must not be reopened by a screen that now renders from the snapshot.
*Test:* navigate handle → handle asserting one controller and one re-target; navigate a run route →
the board asserting disposal; deliver an event through a superseded socket asserting no visible
change. A clause asserts the gate route still creates none.

**AC-14 — The write boundary does not move; the registers and the documents do.**
**`WRITE_RULES` in `apps/web/test/source.test.ts` is untouched**: `'/stop'` stays `permitted: null`,
`PUT`/`PATCH`/`DELETE` stay `null`, the permitted set stays exactly `['daemon-client.ts',
'daemon-endpoints.ts']`, and all three anti-vacuity clauses — `writeOffenders(true)` empty,
`writeOffenders(false)` exactly the two named modules, and the stop needle's `toBeNull()` — read as
they do today. That is the property that says the §5.6 split was honoured rather than quietly undone
by an implementer who thought a stop button was one more line.
`routes.ts`: `/runs/:handle` → `screenExists: true`; `/runs` → `screenExists: true` and
`ticket: 'Q-0015'`, its `waitingFor` **replaced rather than emptied**, per that file's own rule that
an emptied sentence would make a later `false` silent; `RAIL`'s `runs` entry → `screenExists: true`.
`app.tsx` selects both screens by register constant, on `BOARD_PATH`'s and `GATE_ROUTE`'s precedent.
`routes.test.ts`: *"exactly one entry is marked as having a screen"* becomes two, *"exactly three
route rows claim a screen"* becomes five, and the `/runs` row's *"No ticket builds this screen yet"*
clause is rewritten. `docs/04-architecture.md`'s M3 section and this ticket's bullet in
`docs/06-development-plan.md` move. No decision entry (GO-1).
*Test:* each identity as it now reads; one asserting the two new `screenExists` rows are the two this
ticket built; and the three `WRITE_RULES` assertions unchanged and still passing.
*Verification, stated because §0.9 makes it non-obvious:* the screen is demonstrated against a
running daemon by starting a run with a hand `POST /runs` and opening `/runs/<handle>`. The evidence
**records the request that produced the run**, because *"open the browser on a real run"* is not
available on this workspace today and a report claiming it would be claiming something nobody did.
Both suites run forced in both environment rows.

---

## 4. Non-goals

**Stopping a run, and starting one** — Appendix A(a), and see §5.6. The header's run number, elapsed
and per-vendor cost ticker — Appendix A(b), with Q-0129. The gate screen (Q-0016, shipped) and its
verdict and diff (Q-0129). Step chat (Q-0022), including the `/runs/:handle/steps/:stepId` register
row already carried for it. Run history (Q-0018) and resume (Q-0019). Any change to the event union,
including a timestamp or a sequence number — which contradicts a landed entry and owes a decision
entry before a line of code; `verdict=blocked` is the channel (Q-0083). Any change to the gate answer
set. Any parse of a `done`, `step`, `info`, `warn`, `spawn.cmd` or `stdout.line` message for a machine
value. Normalising vendor JSONL into `tool` and `text` events — that enlarges the adapter contract and
`events.ts:27–33` refuses to invent a payload without a producer. Evicting daemon run records or
changing the daemon's retention (Q-0123). Rendering unobserved steps as queued. Persistence, polling,
authentication, multi-user, a remote daemon.

## 5. Open questions

**None blocks solutioning.** All six are ruled below, with the reason recorded so a later reader does
not re-litigate them; the three that need a human act are gate obligations in §8, and **no criterion
above moves under either answer to any of them.**

**OQ-1 — the header's three absent values. RULED: none is taken here.** The run number is `null` for
the life of a live run and arrives on the terminal event, so it renders then and the handle stands
for it meanwhile (AC-11). Elapsed has no source, and inventing one from this browser's connection
moment would be a value nobody measured. The per-vendor cost crosses only inside free text **and** is
barred from `src` by a shipped guard (§0.5), so taking it means both a prose parse and a register
move — two decisions, in a ticket already at fourteen criteria. It goes to Appendix A(b) **with
Q-0129**, as the ticket body asks, because both are one problem: a structured value that exists only
inside a sentence composed for a human.

**OQ-2 — `/runs`, the landing list. RULED: in, and small.** One fetch against a shipped route with a
shipped schema that has no consumer, reusing a request-state vocabulary built twice already, and it
is the only thing that can render the honest state of a real machine today (§0.9). Left out, the sole
entry to mission control is a typed URL containing an opaque handle a user has no way to learn —
which is the defect this ticket exists to remove.

**OQ-3 — what bounds the browser's event list. RULED: the list is bounded, at the daemon's own
retention** (AC-9), with the rationale narrowed this iteration to the three reasons that survive
scrutiny. Codex's engineering is adopted and claude's refusal to invent a figure is honoured by
**deriving** the number rather than choosing it. Claude's alternative — cap the rendering, leave the
retention unbounded and register the quadratic — is the fallback if the gate wants a measurement
first, and it is a worse default: it leaves an unbounded O(n²) append in the screen most likely to be
left open all day.

**OQ-4 — events with no `stepId`. RULED: a run-level lane** (AC-5), on §0.3's measurement that this
is not an edge case but most of what the engine says about itself. Dropping is refused;
re-attributing by message prefix is refused separately, because it is the parse ground rule 2
forbids.

**OQ-5 — the route through the flows. RULED as a recommendation; the choice is the gate's ordinary
business and moves no criterion.** Recommended: **the full route**, and the reason is re-derived
rather than copied from Q-0016's erratum E-5. Claude recommends `requirements` → `chore` on the
ground that there is no `core` change, no daemon route, no wire shape and no dependency, which is
true. Codex has the better of it, and AC-9 is why: this is no longer a rendering ticket. AC-9 is a
**behaviour change to `run-connection.ts`** with an eviction rule and a counter; AC-4's interleaving
clause and AC-7's third disposition are both properties a red test can hold before any code exists;
and AC-5's conservation clause is a contract in the literal sense. M2's closing measurement is that
the flows M3's feature work will use have four tickets of evidence between them, all from August.
Against that sits $126.68 one ticket back. **Whichever is chosen the record must state the reason
re-derived** — that sentence was true on 2026-09-16 and is exactly the kind this repository has
watched travel.

**OQ-6 — does this ship ahead of a producer? RULED: yes, and the ruling is a citation rather than a
preference.** §0.9: nothing starts a run for the daemon, so on a real machine this screen has nothing
to show and `GET /runs` answers `{"runs": []}` for ever. `apps/web/src/backlog-board.tsx:23` already
ruled the ordering when it refused the brief's *"Run next flow ▸"* button — *"starting a run needs
somewhere to watch it, which is Q-0015's."* Building the producer first lands a button that starts a
run a user cannot then look at. What follows from it is already in the criteria: AC-3's empty state
names the cause and AC-14's demonstration is a hand `POST /runs`, said out loud so the closing entry
does not report a run somebody watched. **No criterion changes if the gate reverses this** — only the
order the two tickets run in.

### 5.6 The seam, and why it is the stop button rather than the landing

Both candidates keep the stop control. Codex's document reaches **25** criteria and claude's fifteen
only by compressing; merged honestly, the union is nineteen to twenty-five across two screens, a
live-stream renderer, a retention change and a mutation. Q-0013 was refused at eighteen and split in
three; Q-0122 accepted twenty and paid three rounds and an erratum; Q-0126 accepted sixteen and round
1 returned `blocked`. At the ceiling this role is given, something has to go.

**It is the stop button, and the argument is measured rather than aesthetic.** `host.start` has one
production caller and nothing issues it (§0.9), so a run visible in mission control today was started
by a hand `POST /runs` — and **whoever can hand-POST a start can hand-POST a stop**. The stop button
has no user on a real machine until the browser can start a run. Start and stop are the app's two
run-lifecycle mutations; they widen the same write boundary, need the same
confirm-and-single-in-flight discipline, sit on the same control surface, and raise the same routing
question. Answering that once is worth more than answering it twice.

Removing stop from here also removes, in one act: the `WRITE_RULES` re-aim and its three
anti-vacuity clauses; the irreversible-act discipline that was **Q-0016's blocker** on the last
screen to ship; the race between a stop request and a run completing; and the ratification of a
*second* act on a boundary whose own comment says Q-0016 *"widened the boundary by one act rather
than by a family of them"*. Four risks for one criterion's worth of scope.

**The landing stays** (OQ-2): three criteria, one fetch, a shipped route, a shipped schema and
shipped request-state scaffolding, and it is what makes the screen reachable at all.

**The order is Q-0015 → Appendix A(a) → Appendix A(b) with Q-0129.** Each needs what precedes it.

## 6. Risks

**R-1 — the ticket ships a screen with nothing to show, and that is visible to the reader.** §0.9.
Mitigated rather than hidden: AC-3's empty state names the cause and AC-14's verification says how a
run was produced. Not mitigated away — the honest summary at the close will be that mission control
works and that this workspace cannot yet feed it, which is what Appendix A(a) fixes.

**R-2 — the hero screen will not look like the hero mockup.** §0.4: the brief draws two symmetric
columns of structured tool calls; the stream carries raw stdout, and a claude column may hold one
enormous line where a codex column holds hundreds. AC-6 and AC-11(5) make that explicit rather than
letting a reader infer the product is under-reporting.

**R-3 — a dense fan-out makes more columns than fit.** One column per id is the requirement; the
overflow is horizontal and accessible. Collapsing two ids into one column would break AC-4, which is
the ticket.

**R-4 — the review will be handed a fraction of this change.** Q-0016 crossed `repo.max_diff_bytes`
on rounds 2 and 3 at 91.6% and 87.3%; Q-0017 was truncated on all three rounds; Q-0127 predicted its
own truncation and was **refuted** at 191,552 B against the 200,000 cap. So this is a prediction to
measure, not an assertion. `git diff` orders by path and the cap cuts the head, so what a truncation
hides here is the **tail**: `apps/web/test/source.test.ts` and `routes.test.ts`, which is where
AC-14's whole subject lives. Q-0124's warn now names the files with no patch and Q-0117's
`observation:` tag is where a reviewer reports compensating for it — Q-0016 proved that pair
composes. GO-4 measures it either way; Q-0128 is the open ticket.

**R-5 — fourteen criteria, four not trimmable.** If the loop exhausts, the further seam is written
down in advance rather than discovered at a gate: AC-1, AC-2, AC-3 and their two register rows split
off as the runs landing, leaving mission control complete and reachable by URL. That is a second
erratum at the gate, not a fifth implement round.

**R-6 — AC-14 is the criterion most likely to be met by deletion.** An implementer who adds a stop
button "because it is one line" will re-aim `WRITE_RULES` to make the suite green, and the three
anti-vacuity clauses are what make that visible. The criterion names them and requires them
unchanged; a reviewer should check that first.

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No key path. The screen renders the neutral `vendor` label and branches on no vendor. |
| **Worktree safety** | n/a. Nothing writes to the user's tree; this ticket issues no mutation at all. |
| **Gate behaviour** | The answer set is untouched. AC-12 navigates to the gate screen and answers nothing; no gate outcome is inferred or duplicated. AC-13 keeps the gate route socket-free. |
| **File format and schema** | No new wire shape, no schema change, no event-union change. `wireRunSchema` and `wireRunListSchema` exist on the shared barrel; `apps/web` declares neither of its own. |
| **Lint rules** | `.tsx` has been in ESLint's scope since Q-0014 AC-4. No new rule. |
| **Cold-clone** | Adds nothing to the first 30 minutes. `quorum open` already serves the bundle; this adds two screens behind it. |
| **Dependencies** | None added. `apps/web` declares `@quorum/shared` and not `@quorum/server`, and that does not change. |
| **Decision entry** | None owed — GO-1. |

## 8. Gate obligations

Three ratifications and three procedural obligations. **None of them changes a criterion**, which is
why the verdict is `ready` — Q-0127's precedent, where three errata ratified three gate obligations
on a document that was ready on its first pass.

**GO-1 — ratify that no decision entry is owed.** Checked six ways: the event union is unchanged; no
route is added, changed or removed; no dependency is added; the gate answer set is untouched; nothing
under `.harness/` is served; and **the app's write boundary does not move**, so the second-act
question claude's candidate raises does not arise here and is Appendix A(a)'s to answer once.

**GO-2 — ratify AC-9's bound.** It changes `run-connection.ts`, whose own comment argues the
per-event copy deliberately and routes the cap question to this ticket *"with a measurement behind
it"* — and the measurement does not exist and cannot be produced by a requirements run (§0.4). The
bound is therefore **derived** from the daemon's shipped retention rather than chosen, on the three
reasons in AC-9 rather than on iteration 1's fourth, which is withdrawn. AC-9's verification produces
the first datum. If the gate wants the measurement first, OQ-3's fallback is claude's answer: cap the
rendering, register the quadratic, defer the bound to Appendix A(b).

**GO-3 — ratify or refuse the split at §5.6, and rule OQ-5 and OQ-6.** The document is scoped to
fourteen criteria with the seam measured and both successors written out in full, so this is a
ratification rather than a question: **the criteria above are complete and buildable under every
answer**, and a refusal is an erratum promoting Appendix A(a), which is the path Q-0122's and
Q-0126's gates took and priced. Recommended: ratify the split; take the full route (OQ-5); ship this
before the producer (OQ-6).

**GO-4 — rule on the term *trace column*.** `docs/GLOSSARY.md` defines **Event** and says *"the trace
is the stream, an event is one item of it"*, and defines no rendering of it. The rule is that a term
goes in the glossary before its second file. Recommended: rule it a **rendering of the trace and not
a new term**, recorded so a fourth reader does not re-litigate it — but the rule says ask.

**GO-5 — allocate the two successors** from Appendix A, at the gate, with their bodies transcribed in
full. An obligation recorded only in a closed ticket's entry is one that expires; the plan records
seven directions of that drift.

**GO-6 — measure R-4's truncation and record it either way**, with the byte figure and the files that
got no patch; and **verify forced in both environment rows** with CI green on the merged commit.

---

## Appendix A — the successors, in full

### A(a) — Q-01xx: the browser starts and stops a run

*Opened at Q-0015's requirements gate, 2026-09-16. p2. Runs after Q-0015.*

**Two halves, and they are one ticket because they are one boundary.** `host.start` has exactly one
production caller — `POST /runs` (`packages/server/src/http.ts:178`) — and **nothing issues it**:
`apps/web` makes one non-GET and it is the gate answer, the shell's *Run flow* control is `disabled`,
and `quorum run` calls `runFlow` from `@quorum/core` in its own process and never touches
`@quorum/server` — confirmed from the manifest side too, `apps/web/package.json` declaring
`@quorum/shared` alone. So the daemon's registry is empty on every real machine, `GET /runs` answers
`{"runs": []}` for ever, and Q-0015's mission control has nothing to show. Measured at that ticket's
gate; see its §0.9.

**Stop is here rather than in Q-0015, and the reason is measured.** A run visible in mission control
today was started by a hand `POST /runs`, and whoever can do that can hand-POST a stop — so the stop
button has no user until this ticket's first half exists. `POST /runs/:id/stop` is shipped and takes
an optional `{"reason"}`; `daemon-endpoints.ts` gains a `/stop` segment as a named constant and a
`runStopPath(handle)` beside `runGatePath`, on that function's own stated precedent — *"an exemption
that forgives a string nobody wrote would forgive nothing, so the string is written"*.
`daemon-client.ts` gains functions recognising **204 before any body is read**, as `answerGate` does,
mapping refusals by their codes rather than by status, and reporting a 2xx that is not 204 rather
than taking it for success.

**Both acts are deliberate, single and not gate answers.** Each asks for confirmation naming the
handle, because both are irreversible and this is a screen a reader leaves open; at most one is in
flight, the control being disabled while one is outstanding; and the outcome is rendered from the
daemon's answer rather than assumed. **A stop is never worded with `advance`, `retry` or `abort`** —
it cancels the run through its `AbortSignal` and is not one of the three words a gate takes.
Q-0016's blocker was exactly this class on exactly this kind of control: `load()` cleared the
in-flight guard while a POST was unresolved, so Refresh re-enabled the buttons and a second answer
could win. **It must not be found by a reviewer a second time.**

**It carries a routing decision, which is why the start half is not a button.**
`backlog-board.tsx:19–24` refused the brief's *"Run next flow ▸"* deliberately and gave the reason:
**two flows consume `requirements`** — `chore` and `solutioning` — so a single button takes the most
consequential routing choice in this product silently. What the board does instead is *name* the
flows that consume a stage. This ticket's job is to make that naming actionable: the human picks the
flow, and `--dry`, `--auto` and `--base` are each ruled in or out with a reason. `auto` in
particular: *"Human-gated by default"* is a quality pillar and a browser control that flips it is a
decision, not a checkbox.

**It widens the write boundary, and by more than an act.** `WRITE_RULES` in
`apps/web/test/source.test.ts` is the register — six needles, each with a `permitted` exemption, plus
**three** anti-vacuity clauses: `writeOffenders(true)` empty, `writeOffenders(false)` exactly the two
named modules, the permitted set exactly those two, and `'/stop'`'s `permitted` `toBeNull()` under
the message *"stopping a run became permitted"*. They move, by design, and **the `toBeNull()` clause
is replaced by one naming the module rather than removed**, which is the clause a tidy implementation
deletes. This is where the question *is this still one boundary or a family?* has to be answered
rather than deferred again, and a decision entry is likely owed. **Measure rather than assume**, and
do not re-derive it from Q-0016's comment, which was written when this app could not start anything.

Also here: the race between a stop and a run finishing — the client renders the daemon's refusal and
never infers completion from an attempted mutation.

### A(b) — Q-01yy: the header's measured values

*Opened at Q-0015's requirements gate, 2026-09-16. p2. Weighed together with Q-0129, not separately.*

Deferred from Q-0015's OQ-1, with its measurements so they are not re-derived from the design brief —
`docs/05-design-prompt.md:39` specifies *"run #42 … elapsed 14:32, per-vendor cost ticker"* and three
of those four are not on the wire.

- **The run number** is `null` for the life of a live run (`host.ts:304`, `wire.ts:103`) and arrives
  only on the terminal event, which carries `runId`. Correlating it earlier is a `core` question, not
  a transport one.
- **Elapsed** has no source: no event carries a timestamp, by *"What a run's event stream carries"*
  (2026-08-28), and `WireRun` carries no start time. Widening the event union contradicts that landed
  entry and owes a decision before a line of code; carrying a start time on `WireRun` does not, and is
  the cheaper shape. **Measure both before choosing.**
- **The per-vendor cost ticker** crosses only inside a `done` event's free-text message, composed by
  `formatCost` (`steps.ts:127–133`, `:353`) as `cost=$0.123` or
  `cost=n/a (<n> tokens, vendor reports no price)`. **This is Q-0129's problem on a second field** — a
  structured value that exists only inside a sentence written for a human — and the two should be
  answered once. A regex over that sentence is refused by Q-0015's ground rule 2.
  There is a **second, independent bar**: `apps/web/test/source.test.ts` forbids `tokensByVendor`,
  `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` in any file under
  `src`, and forbids the phrase *cost to date*, each half with its own discriminating fixture. Any
  token count on this screen moves that guard, and the guard's reasoning — *"Codex cost is reported
  as tokens, never priced locally"* (2026-08-22) and *never one blended number* — is what the new
  rendering must satisfy, not route around.

It also revisits **Q-0015 AC-9's bound** with the datum that ticket's verification produced: the
observed event count and peak concurrent column count of a real run. Revisit the figure only with
that evidence; do not adjust it on an impression.

---

## Appendix B — reported, not fixed

**`apps/web/src/run-connection.ts:143–150` names Q-0121 wrongly.** The comment reads *"Q-0015 renders
mission control from this same snapshot while Q-0121 will hold several controllers at once"*. Q-0121
shipped as the daemon's run **listing** — a server-side enumeration that holds no browser controller
and creates none. A forecast the id did not turn out to fit; what will hold several controllers, if
anything does, is a screen nobody has ticketed. `.claude/rules/engineering.md` says a defect found in
code you are already changing is **reported, not migrated in passing**. AC-9 opens that file, so the
correction is a one-line comment fix and an **`observation:`** entry is the channel for saying so.

**`withStepId`'s `default:` branch is load-bearing and nothing says so.** §0.1: stamping an `info` or
a `warn` would make the event fail `.strict()` in the browser's frame parser, which since Q-0120
round 2's M-4 **ends the socket**. The switch is exhaustive in the right direction today and nothing
records why it must stay that way. An `observation:` is the channel; a test for it is Q-0120's
surface rather than this ticket's.

**`composite.ts:55` is one line carrying two emit sites**, through the `report(context, ok, message)`
helper. Any future census of the event stream keyed on a line count will be wrong by one in a way
that is invisible — which is how iteration 1 of this document, and both candidates, arrived at a
denominator of 37 lines (§0.3).

---

## Provenance

**candidate-claude** contributed the run-level lane and the measurement that makes it a lane rather
than an edge case (§0.3 — recounted this iteration and corrected); the three-disposition timeline and
the `done`-on-no-failure-path measurement behind it (§0.2, recounted and exact); §0.9, the finding
that nothing produces a run, which is what decides the seam; the `withStepId` hazard and why its
dullest branch holds the screen up; the second bar on the cost ticker, the shipped token-field guard
codex did not see; the run-number correction that the number arrives on the terminal event rather
than needing a fetch; the conservation clause that makes *"nothing is dropped"* checkable; and
Appendix B's first entry.

**candidate-codex** contributed the vendor badge derived from `spawn` **or `retry`**, which is right
where claude's is wrong; the gate link derived from `pendingGates` rather than from a live `gate`
event, which is right where claude's fails for the late joiner the retention exists to serve; the
bounded browser retention with a second counter and its own sentence, which is right where claude's
leaves an unbounded quadratic; the escaping clause on agent-provided text; the connection-lifetime
criterion; the daemon-order-preserved rule on the listing; and the sharper framing of the flow-route
argument in OQ-5.

**Iteration 1 of this merge** ruled the seam neither candidate proposed (§5.6), on the measurement
that a stop button has no user until the browser can start a run; corrected codex's six request
states to the closed register's five; corrected codex's connection-lifetime criterion from new work
to a regression pin, `app.tsx:103–129` already holding it; reconciled the retention disagreement by
**deriving** the bound from the daemon's shipped retention rather than choosing a number; made AC-14
assert that the write boundary has **not** moved, which is the property that keeps the split honest;
and made AC-9's verification produce the per-run event count this repository has never had.

**Iteration 2** opened on an unchanged tree and said so before anything else (§0.0), then re-derived
every measurement iteration 1 rested a ruling on. Thirteen held. **Two moved.** The un-attributed
stream is 36 source lines carrying 37 emit sites, not 37 lines, because `composite.ts:55` is a
ternary inside a helper — so the complement iteration 1 reported was produced by subtracting from a
double-counted total, and the helper's message belongs to its callers rather than to the site.
**AC-9's stated reason was narrowed**: *"a browser may not hold what the daemon cannot replay"* is
withdrawn, because a browser present from the start genuinely observed those events and its longer
history is real rather than fabricated; the bound now rests on the three reasons that survive. It
added the measurement that `GET /runs` projects through the same `wireRunOf` as `GET /runs/:id`, so a
listing row carries `gates` and `pendingGates` whole and AC-12 is robust to either read; and it
confirmed from the manifest that `apps/web` declares `@quorum/shared` and not `@quorum/server`, which
is what makes AC-9's citation residual a fact rather than an assumption. **And it moved all three of
iteration 1's blockers to gate obligations, carrying every recommendation unchanged on the merits** —
because the document is at fourteen criteria with the seam named and both successors written out, so
the size rule is satisfied rather than violated, and not one of the three moves a single acceptance
criterion. A complete document that reads as a blocked one is the failure Q-0105 corrected, and this
cut has now paid for it twice.
