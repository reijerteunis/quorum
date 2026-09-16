---
id: Q-0015
title: Mission control streams a run live, one trace column per step
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0015/integration
priority: p2
created: 2026-09-16
iterations:
  requirements.head-of-product: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-16T20:20:30.961Z
    cost: 19.759
---
The hero screen: a run in flight, one trace column per concurrent step, a step timeline beneath, and what the run is doing said in a sentence rather than left to a spinner.

**M3**, `docs/06-development-plan.md`, where the bullet has read *"Q-0015 Mission control screen"*
since the milestone was written, and where `docs/05-design-prompt.md` screen 5 calls it **the hero
screen** and says to open the mockup on it. The id was allocated by the plan rather than by the
allocator, so the folder is created at it with `--id`.

## Measured against the tree, 2026-09-16, before the run

Every figure below was taken from the tree today, after Q-0016 merged. None is transcribed from the
plan, from the design brief, or from a sibling ticket's entry — which is the rule this cut has now
broken three times in three tickets.

**(a) The trace columns are buildable, and this is the decisive enabling fact.** Each parallel member
and each fan-out child stamps its **own** `stepId` on every adapter event
(`packages/core/src/engine/steps.ts:289`, `onEvent: (event) => context.emit({ ...event, stepId })`),
and the run loop's single slot fills one in only where the emitter supplied none —
`engine.ts:87`, whose comment says *"An id the emitter already carries WINS"*. A `parallel:` container
correctly carries no id of its own (`engine.ts:370`), and a fan-out child is named `<step>:<task.id>`
(`composite.ts:144`), which is the brief's own `dev:Q-0042.1` shape.

**This is Q-0050 round 6's Major 1 fixed, and never yet exercised.** That review — found independently
by both vendors — reported the opposite: one mutable slot the run loop owned, so a `parallel:` group
stamped the literal `"undefined"` and concurrent members shared it. It was fixed against a stubbed
`runAgentStep`, so **no consumer has ever read those ids**. This screen is the first, and a criterion
that proves two concurrent members are distinguishable on the stream is this ticket's most load-bearing.

**(b) Three of the four things the brief's header names are not on the wire.** Screen 5 specifies
*"run #42 on ticket Q-0042 … flow `development`, elapsed 14:32, per-vendor cost ticker (Claude $3.84 ·
Codex 226k tokens, unpriced — never one blended number), stop button"*.

- **The run number is `null` for the whole life of a live run.** `WireRun.runId` is `number | null`
  and `host.ts:304` assigns it in the terminal-event branch alone, under a comment saying the terminal
  event is the only one carrying run identity. So a running run has no number and the header cannot
  say *"run #42"* — it has the opaque handle and the flow. Q-0016's M-6 measured this and **struck a
  candidate design on it**; it binds here for a second reason.
- **Elapsed has no source.** No event carries a timestamp, and `events.ts:143` says in place that the
  union *"deliberately adds no timestamp or sequence number"* — *"What a run's event stream carries"*
  (2026-08-28). `WireRun` carries no start time either. Timing from the moment **this browser**
  connected is a different quantity, and rendering it as the run's age would be a value nobody
  measured, which `docs/04-architecture.md:317` forbids.
- **The cost ticker is half structural and half prose.** The **vendor** is a real field —
  `spawnEventSchema` carries `vendor` — so a column knows which vendor it is. The **cost** crosses
  only inside the `done` event's free-text `message`, composed by `formatCost`
  (`steps.ts:127–133`, `steps.ts:353`) as `cost=$0.123` or
  `cost=n/a (<n> tokens, vendor reports no price)`. Reading it means parsing a human sentence for a
  machine value. **That is the same problem Q-0129 owns for the verdict**, on a different field, and
  the two may want one answer rather than two.
- The fourth, **the stop button**, is real and shipped: `POST /runs/:id/stop`.

**(c) This screen is the first consumer of the accumulated event list, and the list is unbounded.**
`apps/web/src/run-connection.ts:151` is `events = [...events, result.frame.event]` — a fresh array per
event, so the copying is quadratic in the length of the run and nothing caps it. It has never mattered
because nothing renders the list: `shell.tsx:96` reads `.at(-1)` and `:113` reads `.length`, both
O(1). This screen renders it. The shape is Q-0123's — a record nothing releases — one layer up, in a
browser rather than in the daemon.

**(d) What a late joiner receives is bounded, and the screen must say so rather than imply it is
whole.** `DEFAULT_RETENTION` is 500 and `createBroadcast` evicts from the head
(`broadcast.ts:123–125`), so a browser joining a run already under way gets the last 500 events and a
`missed` count — which already crosses the wire and which `RunConnectionSnapshot.missedCount` already
holds. A trace presented as the run's whole history when it is its tail is the reassurance this
repository refuses at `quorum board` and refused again at Q-0016.

**(e) One thing this body could NOT measure, stated rather than guessed.** How many events a real run
emits — and therefore whether 500 is generous or routinely exceeded — is **not derivable from what is
retained**: `output.txt` is the extracted document rather than the stream, and `<step>-<ms>.raw.txt` is
written only where structured output failed to parse (`steps.ts:319`), of which the whole backlog holds
**three**. Q-0123 measured the mean stdout event at 214 B over 8,054 lines but produced no per-run
count. **Establishing it is the requirements run's**, and no criterion should rest on a figure this
body does not have.

**(f) The stop button moves one row of a register Q-0016 built yesterday.** `WRITE_RULES` in
`apps/web/test/source.test.ts` is six needles with a `permitted` exemption each: `POST` is allowed in
`daemon-client.ts`, `'/gate'` in `daemon-endpoints.ts`, and **`'/stop'` is `permitted: null`** — still
forbidden everywhere. Re-aim it, never delete it: `PUT`, `PATCH` and `DELETE` have no exemption and
should keep none, and the board and the ticket page still may not write.

**(g) This is the screen that makes two shipped things reachable.** `/runs/:handle/gate` shipped at
Q-0016 and **nothing navigates to it** — it is reached by typing a URL. `GET /runs` shipped at Q-0121
and has had no consumer since; that ticket's own R-1 recorded it as shipping with none, and named this
ticket as what would read it. The `/runs` landing row carries `ticket: null` and says so
(`routes.ts:183–188`).

## The seam, proposed rather than assumed

**This ticket — the live trace, over channels that exist.** One column per `stepId` built from the
stream, the step timeline from `step` and `done`, the stop control, every not-streaming state named,
the missed-count disclosed, and the link to the gate screen that closes Q-0016's loop. Every endpoint
it needs is shipped.

**A successor — the header's measured values.** The per-vendor cost ticker, elapsed, and the run
number. All three need something the wire does not carry, and the cost ticker is **Q-0129's problem in
a second place**: a structured value that exists only inside a sentence composed for a human. Whether
it is one answer for both or two is the thing to measure, not assume.

**Whether `/runs` — the landing list — is in this ticket or beside it** is the third question. It has
no ticket today, `GET /runs` already serves it, and without it mission control is reachable only by
URL, which is exactly the state Q-0016 shipped in and which this ticket is supposed to end.

Recommended: **split, and rule `/runs` in** — a hero screen nothing can navigate to is the defect this
ticket exists to remove, and the listing is one fetch against a shipped route. The gate rules;
Q-0122's gate refused the split its own document recommended and wrote down what that cost.

## Ground rules

1. **No fabricated value, anywhere.** `docs/04-architecture.md:317`. A figure the wire does not carry
   is not rendered — not as a dash, not as a zero, not as a skeleton. An unpriced step is **unpriced,
   not free**, which `formatCost` already refuses to spell `$0.000` and which the brief states as
   *"never one blended number"*.
2. **A parsed sentence is not a contract.** If the cost ticker is taken at all, it is taken from a
   field, not from a regex over `done.message`. Q-0129 carries the same rule for the verdict.
3. **Nothing is persisted in the browser**, and nothing refetches on a timer — both already guarded in
   `apps/web/test/source.test.ts`.
4. **The read-only guard is re-aimed, never deleted** (ground rule 4 of Q-0016, which built it).
5. **Stopping is the only mutation**, beside the gate answer Q-0016 already ships. No run is started,
   no stage moved, no lock taken.
6. **The event union is not edited here.** Adding a timestamp to an event contradicts a landed entry
   and is a decision entry before a line of code — `verdict=blocked` is the channel (Q-0083).

## Open questions

**OQ-1 (BLOCKING) — the header's three absent values**, and whether any of them is taken here. Measure
before choosing; the cost half should be weighed **together with Q-0129**, not separately.

**OQ-2 (BLOCKING) — `/runs`, the landing list**: in this ticket, a successor, or left. It decides
whether anything can navigate to this screen.

**OQ-3 — what bounds the browser's event list**, given (c) and the unmeasured (e). A cap discards a
run's own history in the one screen built to show it; no cap is unbounded growth in the screen most
likely to be left open. Whatever is chosen must be **disclosed where a reader sees it** (Q-0124), and
a cap must not be confused with the daemon's `missed`, which is a different loss with a different cause.

**OQ-4 — how a column is identified when a step has no id.** `engine.ts:370` sets the slot to `null`
for a step carrying none, and `withStepId` then leaves the event unstamped. An event with no `stepId`
belongs to no column; whether it has a run-level lane, is listed separately, or is dropped is a
rendering decision this body does not rule — but dropping it silently is the one answer that is wrong.

**OQ-5 — the route through the flows**, taken at the gate. Q-0016 went `requirements` → `chore` at
$126.68 on the argument that its shape was chore-shaped; this screen has more genuinely behavioural
surface than that one did. Re-derive the full-route evidence rather than copying Q-0016's erratum E-5,
which was true on 2026-09-16 and is the kind of sentence this repository has watched travel.

## Non-goals

The gate screen (Q-0016, shipped). The verdict and diff (Q-0129). Step chat (Q-0022), including the
`/runs/:handle/steps/:stepId` route already registered for it. Run history (Q-0018) and resume
(Q-0019). Starting a run from the browser. Widening the gate answer set. Adding a timestamp or a
sequence number to any event. Any authentication.
