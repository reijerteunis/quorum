# Q-0015 mission-control presentation contract

This contract freezes the seams shared by the independent browser implementation tasks. The event
union, daemon routes and wire schemas are existing contracts and are not changed by Q-0015.

## Routes and reads

- `/runs` performs one `GET /runs` read at mount through `requestJson` and `wireRunListSchema`.
  Refresh is the only repeat read; no timer performs one.
- Listing rows preserve response order and show handle, flow, state, pending-gate count and either
  the supplied ticket id or the sentence `The daemon supplied no ticket id for this run.` Each row
  links to the registered `/runs/:handle` route.
- `/runs/:handle` uses the existing socket snapshot and a `GET /runs/:handle` metadata read. The
  gate link is present exactly when the loaded run has `pendingGates > 0`, and its path is produced
  by substituting the handle into `GATE_ROUTE`, never by observing a gate event.
- The five existing request-state kinds remain closed. A loaded empty list says that the daemon is
  driving no runs, that this app cannot start one, and that `quorum run` is a different process the
  daemon cannot see.
- `mission-control-text.ts` is the single copy contract for the empty-list sentence, timeline
  labels, loss sentences and five absent-capability sentences. Renderers and tests import those
  exports rather than restating their wording. Mission control marks its main state region with
  `data-mission-control-state`, its disclosures with `data-mission-control-disclosures`, and each
  timeline row with `data-step-disposition`; the runs landing marks its request state with the
  existing `data-request-state` idiom.

## Trace and timeline

- `partitionTrace` is lossless: every input event occurs exactly once in either the run-activity
  lane or one step column. Events with a `stepId` field are grouped by its exact string, columns are
  ordered by first appearance, and events within them retain arrival order. Events without that
  field remain in the run-activity lane; message prefixes are never parsed.
- A column's vendor is the latest vendor observed on that step's `spawn` or `retry`, or `null` when
  neither supplied one. All event messages and stdout lines render as React text.
- Source protection against parsing human prose scans the complete `apps/web/src` corpus for
  quoted or regex-delimited parse needles (`'cost=`, `"cost=`, `/cost=`, and the corresponding
  `role=` and `verdict=` forms). Bare `role=` is deliberately not a needle: it falsely matches the
  existing accessibility selector `[role="progressbar"]`. The guard proves both directions with a
  parse fixture that is rejected and that selector fixture that is accepted; it never narrows the
  corpus.
- `buildStepTimeline` creates one row per step id observed on `step` or `done`, in first-observed
  order. A start alone is `started`; a done is `ended` and retains its message; after a terminal,
  an unmatched start is `started-with-no-end-reported`. A done retained without its start still
  creates an ended row. No unobserved or queued row is invented.

## Retention and disclosure

- The connection retains the newest `RUN_EVENT_RETENTION` accepted events. Overflow evicts from
  the head, increments `browserDiscardedCount`, and never mutates a previously returned snapshot.
  The daemon missed count and browser discard count are independent, nullable counters.
- A non-zero daemon count is rendered as `The daemon omitted N earlier events from this replay.` A
  non-zero browser count is rendered as `This browser discarded N earlier live events to keep the
  view bounded.` Zero and null render neither sentence.
- The counter sentences are distinct by an executable lexical property: each contains at least one
  word absent from the other (`daemon`/`replay` versus `browser`/`discarded`/`bounded`). Shared words
  such as `events` and `earlier` are not treated as a failure.
- Mission control names the five absent capabilities and their causes: live run number, elapsed
  time, structured cost/token totals, the next flow step, and structured tool/reasoning events. It
  renders no placeholder value for them. The handle identifies a live run; a terminal-provided run
  number replaces that explanation only after it exists.
- Every connection state has non-empty main-region prose. A no-such-run state creates no columns.
  Raw vendor output may be asymmetric and is not presented as a complete run history.

## Connection lifetime

- `App` owns one controller while it remains on non-gate run routes. A handle change calls
  `connect` on that controller rather than constructing another; leaving those routes disposes it.
- The gate route constructs no controller. Callbacks from a superseded, naturally closed or
  disposed socket cannot change events, either loss counter, connection state or the newly rendered
  route.

## Write boundary

Q-0015 adds no mutation. The source guard remains unchanged, including the forbidden stop path and
the exact two existing write-capable modules. Mission control links to the gate screen but never
answers a gate. Starting and stopping a run belong to the allocated successor.
