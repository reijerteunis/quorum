---
id: Q-0013
title: The server package runs flows, streams their events and answers their gates
stage: draft
owner: ruud
repos: []
branch: harness/Q-0013/integration
priority: p1
created: 2026-09-11
iterations: {}
history: []
---
M3's first ticket. packages/server is a one-line stub; it becomes the process that starts a run, streams its events to a browser over WebSocket, and carries a gate answer back into the run that is waiting for it.

Created **2026-09-11** at the id `docs/06-development-plan.md` has named for this work since M3 was
written, using `--id` rather than the allocator's next number so the plan and the backlog agree.
`plan-backlog.test.ts`'s `UNCREATED` register loses its `Q-0013` row in the same change.

## What is there today, measured rather than assumed

**`packages/server` is a one-line stub.** `src/index.ts` is `export const name = '@quorum/server';`
and its `package.json` declares **no dependencies at all** — not `@quorum/core`, not
`@quorum/shared`. Everything below is new.

**The barrel already carries what running a flow needs**, which is the half Q-0092 and Q-0096 each
found missing for their own consumer and had to add: `runFlow`, `loadProject`, `findProject`,
`loadFlowByName`, `loadFlow`, `Backlog`, `readRun`, `readRunsDir`, `sortRuns`. `Event` and
`RunTerminalEvent` come from `@quorum/shared` through a star export, which is how
`packages/cli/src/run.ts` gets them.

**One type a server needs is NOT exported, and it is the one the gate turns on.**
`AnswerGate` — `(question: GateQuestionEvent) => Promise<GateAnswerEnvelope>` — is declared at
`packages/core/src/engine/types.ts:75` and appears nowhere on `packages/core/src/index.ts`. A server
supplying `answerGate` cannot name its own callback's type. That is the Q-0092 shape exactly
(*"true of existence and false of reachability"*), found before the run rather than at its gate.

## What already rules this, and must not be re-litigated

- ***"What a run's event stream carries, and how a gate answer travels back"*** (2026-08-28) **and its
  2026-08-29 erratum** are the governing entries. `runFlow` is a **lazy, single-consumer**
  `AsyncIterable<Event>` over a lossless FIFO; order is stable within a step and parallel members
  have **no global ordering promise**; the gate question is queued **before** the out-of-band
  `answerGate` callback is invoked; cancellation belongs to the caller's `AbortSignal` and `core`
  installs no signal handler. A server does not get to change any of that — it consumes it.
- ***"A run holds a lock on its ticket"*** (2026-09-09). Two runs on one ticket already refuse, and
  the server inherits that refusal rather than inventing a queue.
- ***"A `core` error names the condition; the remedy belongs to the surface"*** (2026-09-07) was
  ruled **for this ticket**: the server is the second surface, and `packages/cli/src/fail.ts` shows
  the shape a surface's remedy takes.
- ***"A dry run changes nothing the caller passed it"*** (2026-09-11) landed the day before this was
  opened, so a server holding a ticket across runs can serve it after a `--dry` walk.

## The questions this owes, none of them settled here

1. **Single-consumer stream, many watchers.** Decision 062 makes `runFlow`'s stream single-consumer.
   Two browsers watching one run is the ordinary case, so the **fan-out is the server's** — and what
   a client that connects mid-run receives (nothing, a replay, a snapshot) is a product decision, not
   an implementation detail.
2. **How a gate answer travels from an HTTP request into a promise a run is awaiting.** `answerGate`
   returns a promise; the answer arrives on a different connection, possibly a different one from the
   watcher. The correlation the entry already describes is the mechanism; the *surface* is not.
3. **What the server binds to, and what that means.** Local-first with no auth is the product's
   position, and *binding to `127.0.0.1`* versus *`0.0.0.0` with a token* is a decision with a
   security consequence, so it is made deliberately and written down.
4. **Whether the server starts runs at all in this ticket, or only observes them.** M3's done-when
   says *"start/stop runs, stream events over WebSocket, answer gates"* — three verbs, and the first
   is what makes the package a daemon rather than a viewer.
5. **Scope.** Three verbs plus a transport plus an export gap is plausibly past the fifteen criteria
   that forced splits at Q-0091 and Q-0096, **both at cost**. If it splits, the seam is the
   transport: REST over an existing run's recorded history is separable from the live WS stream, and
   the export gap belongs with whichever half runs first.

## Not in scope

**Resumable runs after a daemon restart** — Q-0019, explicitly a separate ticket in M3's list.
**Any screen** — Q-0014 onward. **`quorum open`** — it is in M3's done-when and belongs with the web
app rather than with the server package.
