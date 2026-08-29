# Q-0050 run-event and gate-answer contract

Production declarations live in `packages/shared/src/events.ts`; `packages/shared/src/index.ts`
already exports that module and does not need a Q-0050 edit. Every schema below is strict.

## Additions to `@quorum/shared`

```ts
type GateAnswer = 'advance' | 'retry' | 'abort';

interface GateQuestionEvent {
  type: 'gate';
  gateId: string;       // opaque, unique within one run
  kind: string;
  reason: string;
  ticketDir: string;    // absolute
  retry?: string;       // present only when retry is offered
}

interface GateAnswerEnvelope {
  gateId: string;
  answer: GateAnswer;
}

interface RunTerminalBase {
  type: 'terminal';
  runId: number;
  stageBefore: string;
  stageAfter: string;
  cost: number;
  tokens: number;
  error?: string;
}

type RunTerminalEvent =
  | (RunTerminalBase & {
      status: 'regressed';
      targetFlow: string;
      counter: string;
      count: number;
      limit: number;
      remaining: number;
    })
  | (RunTerminalBase & {
      status: 'completed' | 'aborted' | 'failed' | 'interrupted';
    });
```

The regression payload has seven values in the spike: target flow, stage before, stage after,
counter, count, limit, and remaining. `stageBefore` and `stageAfter` are already required terminal
fields, so a regressed event adds the other five fields. They must either all be present when
`status === 'regressed'`, or all be absent for every other status. Implement this as a discriminated
Zod union, not optional fields plus a convention. `remaining` is clamped at zero. `error` is present
only when `finish` receives an error/note field and is byte-identical to the terminal `runs.log`
error suffix before JSON quoting. Implement `runTerminalEventSchema` as one outer event option
containing a nested `z.discriminatedUnion('status', [...])` with strict common fields. Do not add
two flat `type: 'terminal'` alternatives to the outer union, whose discriminator requires unique
type literals.

`eventSchema` gains `RunTerminalEvent`, and its existing gate member gains `gateId`. The answer
schema is exported separately and is not an event. Export the corresponding schemas and inferred
types. Unknown keys, an unknown answer, a mismatched gate id, and a partial regression payload are
rejected.

No event gains a timestamp, sequence number, or run id other than the terminal event's existing
run identity. No vendor-specific member or branch is added. Adapter `spawn`, `stdout`, and `retry`
events gain exactly `stepId` at the engine boundary.

## Ordering and termination

- The first pull starts the producer. One iterator instance supports one consumer.
- `gateId` is opaque and **not to be parsed**. It is derived from the run id and a run-scoped
  sequence and renders as `<runId>:<n>`, which is a correlation token rather than an event field —
  the "no sequence number, no run id" rule governs the payload a consumer reads.
- The FIFO never drops, coalesces, or deduplicates. Within one step, adapter event order is stable.
  Parallel members have no global ordering promise.
- A `step` event is queued before observable step execution. `done` is queued only after success.
- A gate question is queued before `answerGate` is invoked. The producer may then await the callback
  while the consumer continues draining the FIFO.
- One terminal event is produced for every terminal status and is the last value. On failure, the
  next pull after that value rejects with **whatever the run threw**, unwrapped, and the failure
  cause is non-empty. Not always a `FlowError`: AC-11 preserves `loadFlowByName`'s raw `ENOENT` and
  AC-12 preserves the unknown-goto `TypeError`, both of which reach the consumer as themselves.
  Superseded by solution/errata.md E-12.
- Iterator `return()` is the abandonment signal. It closes delivery, cancels active work, and waits
  for the interrupted terminal record and counters to persist. It also latches: a `next()` after it
  is `{ done: true }` and never starts the producer.
- **An abandonment that arrives after a terminal status has already been committed does not retract
  it.** `finish` runs to completion synchronously, so a flow with no suspension point persists its
  outcome during the producer's first turn, before the first `next()` resolves; `return()` then
  aborts a run that has already ended and the record keeps the status the run actually reached. A
  status describes what happened, not who was still reading. Added by solution/errata.md E-15. Async iteration syntax does not
  expose a value returned from `return()`, so an abandoning consumer cannot observe the terminal
  event it caused; this does not relax the persisted lifecycle contract.

## Gate protocol

`answerGate(question)` is the one answer channel. It runs outside the iterator pull stack and may
settle minutes later. Its envelope must repeat the pending `gateId`; stale or mismatched ids and
runtime-invalid answers fail the run by gate kind and reason. Promise settlement supplies exactly
one answer, so duplicates cannot be applied. A missing callback fails after the question is queued.

`auto`, command-level auto, and dry short-circuits are evaluated after the question is built and
before it is emitted — superseded by solution/errata.md E-17 and by the 2026-08-29 erratum to
*What a run's event stream carries*. A gate that is never asked still spends an id:
eligible automatic gates and dry previews emit `info` and consume no answer. `human-locked` never
auto-advances. An answered gate is logged before its answer is acted on.
