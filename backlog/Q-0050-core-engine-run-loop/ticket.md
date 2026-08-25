---
id: Q-0050
title: core/engine — the run loop, routing and the event stream
stage: draft
owner: ruud
repos: []
branch: harness/Q-0050/integration
priority: p1
created: 2026-08-25
iterations: {}
history: []
---
The spine of the port: `runFlow`, `runStep`, `handleFail`, `finish`, `outcome`, `recordEvent`,
`loadFlow`, `loadFlowByName`, `loadRole`, `interpolate`, `writesOf` — the run context every other
engine ticket writes into, plus counters, bounded backward edges, cross-flow regression, stage
transitions, `--dry` and `--auto`. Roughly 250 of `engine.js`'s 1,113 lines, and the ticket the other
three engine tickets depend on. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**It carries the one deliberate interface change in the whole port.** `04-architecture.md` specifies
`runFlow(opts): AsyncIterable<Event>` over the trace format in `shared`, where the spike's `runFlow`
takes a `ui` object and prints. That is design work, not translation: what the stream carries decides
what M3's WebSocket can show, what the gate screen can render and what run history could persist. It
is also where a port stops being safely mechanical, so it deserves the requirements flow's attention
more than any other ticket here. The `ui.gate` callback is the sharpest edge — a gate is a *question
back*, which an `AsyncIterable` of events does not naturally express.

**The safety properties this loop is responsible for.** M1's closing entry records that they held
under real failure and they are the product's actual claim: stages never advance on a failed run, the
user's working tree is never touched, bounded loops stop where they are told to, and counters survive
a crash. Enforced in `core`, not in the UI or by convention.

**Rules with money behind them.**

- **A dry run previews; it never mutates.** `harness run requirements Q-0034 --dry` advanced a ticket
  from `draft` to `requirements`, wrote a `runs.log` and appended a "completed" history entry without
  invoking a single agent — every *step* checked `ctx.dry`, the run's own bookkeeping did not. And
  `--dry` is the same run machinery rather than a separate path, which is why its preflight must be
  as honest as a real run's (Q-0051).
- **`retry` at an exhaustion gate authorises exactly one more traversal** — that loop's counter is
  set to `max_iterations`, no other counter is touched, and the grant is recorded in `runs.log`.
  Clearing every counter refunded a `qa` budget a ticket had already spent.
- **A non-interactive run authorises the first N gates it meets, not the N you had in mind.**
  `--gate-answer` values are consumed in order by whichever gate arrives first, and an engine-presented
  exhaustion gate is a gate (2026-08-25).
- **Cross-flow regression derives its target stage from the named flow's `consumes`**, rather than
  hard-coding a stage or running the target flow immediately (2026-08-23).
- **Every terminal outcome is written with its counters persisted** — completed, regressed, failed,
  interrupted. Ctrl-C at a gate once wrote no outcome and silently refunded the iteration budget, an
  undocumented route to unlimited retries.
- **Failures name their cause.** *"A failure that withholds the one thing the reader needs"* is one of
  M1's three recurring shapes: `exited 1:` with nothing after it, `could not sync base:` with no
  reason, an `IntegrationError` printing a raw stack while a `FlowError` printed a sentence.

**Two open tickets sit on this code**, and the port should be sequenced against them rather than
around them: Q-0039 (no lock on a ticket — two runs overlapped twice in one night) and Q-0040 (a gate
cannot say "undecided", so `finish()` rolls back proven-green work). Both are listed before M3 for the
same reason, and both change this file.
