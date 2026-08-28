# Q-0050 lifecycle, routing, and preservation contract

This contract partitions the ported behaviour without changing it. Exact user-visible messages and
line formats come from `contracts/Q-0050/run-messages.fixture.json`; implementations do not
paraphrase them.

## Lifecycle

- Validate `ticket.meta.stage === flow.consumes` before dry substitution, context creation, run-id
  allocation, history initialisation, or any write.
- Q-0049 supplies `nextRunId` and the run-history writer. The id exceeds both ticket history and
  `runs.log`. Q-0050 owns the rule that every successfully started run reaches one terminal state.
- Initialise history inside the run `try`. Preflight remains inside that same `try` when Q-0051
  lands. If history initialisation fails, write the terminal `runs.log` line without advancing.
- Persist counters and one terminal line for completed, regressed, aborted, failed, and interrupted.
  Move the stage only for completed and regressed. Write the ticket once.
- For non-dry failed, aborted, or interrupted runs, reset the ticket branch when both start and
  current heads are truthy and differ. Do not reset task branches or add a helper to do so.
- Cancellation is an `AbortSignal`; core contains no `process.exit`, `process.on`, or `process.once`
  signal path. A throw, cancellation, gate cancellation, and iterator abandonment first finalise
  active occurrences, then persist counters and the terminal record, then release the caller.
- Preserve the 1000 ms `signalWindow` timer with `Why: preserved defect, see Q-0050 AC-4.` The
  accepted pre-development decision may supersede this clause; absent that entry it remains.

## Routing and counters

`routing.ts` owns `askGate(request, ctx)` as the one gate-policy primitive. The complete
`RoutingContext` in `run-flow-api.contract.ts` supplies flow, ticket, harness directory, run id,
counters, event enqueueing, the optional `answerGate` callback, cancellation, logging, history,
named-flow loading, and lifecycle completion as injected capabilities;
`routing.ts` never imports `engine.ts`. `askGate` performs auto/dry short-circuits, allocates and
emits the correlated question, validates and logs the answer before acting, and preserves the
`signalWindow` timer. `handleFail` calls it for exhaustion. In Q-0050, `runStep`'s author-declared
`step.gate` branch also calls `askGate`; Q-0052 inherits that call and adds no gate policy. This
deliberately moves the gate-policy body across the requirement's Q-0052 non-goal because one owner
is required for AC-4's ordinary-gate clauses and round one accepted that boundary change.

- `runStep` dispatches in spike order. Parallel groups use `Promise.allSettled`, report survivors,
  and preserve the defect that every nested member is sent to `runAgentStep` irrespective of kind.
- Counter key: explicit `on_fail.counter`, otherwise `<flow.name>.<step.id>`. Increment before the
  bound comparison. `on_fail.on_exhausted` remains unread and receives a preservation comment.
- Intra-flow goto increments `ctx.vars.iter`; cross-flow goto does not. Preserve the unknown-target
  `findIndex() === -1` TypeError, protected in normal use by lint.
- Exhaustion first records `exhausted`, then asks a synthetic `human-locked` gate with retry target,
  counter and max. Advance changes no counter.
- Retry is valid only with a retry target. Set only that counter to `max_iterations`, log the grant,
  and make exactly one further traversal. Retry without a target preserves the spike's abort.
- `flow:<name>` loads and lints the named flow, derives the target stage from its `consumes`, emits
  the exact warning, and terminates regressed without executing the target flow. Its seven terminal
  regression values use the pre-mutation stage and clamp remaining at zero.

## Dry view

Use `Object.create(backlog)` and replace `write`, `writeFile`, and `log` with no-ops. A dry run uses
the real routing path but invokes no adapter, script, integration, git mutation, branch reset,
worktree mutation, run-history initialisation, exclude edit, or persistent write. Preserve and mark
both defects: `finish` still mutates the caller's in-memory ticket, and counters still alias
`ticket.meta.iterations`.

## Loaders and helpers

- `loadFlow(file)` parses YAML, assigns `flow.file`, and runs `lintFlow` before returning.
- `loadFlowByName(harnessDir, name)` delegates to `loadFlow(<harnessDir>/flows/<name>.yaml)` and
  deliberately lets a missing file throw `ENOENT`, not `FlowError`.
- `loadRole` returns `{ meta: {}, body: '' }` for a falsy name; a missing named role throws
  `FlowError` containing the full path.
- `interpolate` performs flat key lookup and leaves unknown placeholders, including dotted keys,
  literal. `writesOf` prefers singular `output.write` over plural `output.writes`.
- `reviewRound` returns one plus the highest review round containing `verdict.md`, or 1 when the
  review directory is absent.

## Preserved diagnostic decisions

The implementation adds one-line `Why: preserved defect, see Q-0050 AC-12.` annotations at the
owned source sites. This table is the durable enumeration for all eight sites; this full-SDLC route
cannot write `dev/implement-report.md`. The human gate records that discrepancy and routes any
needed amendment through `solution/errata.md`. Production does not edit `fanout/`.

| Consumer | Absent/normal result | Operational git or diagnostic failure |
| --- | --- | --- |
| start branch head, Q-0050 | null; rollback later skips | same null, no warning; rollback later skips |
| rollback current head, Q-0050 | null; rollback skips | same null, no warning; rollback skips |
| base/ticket sync, Q-0052 | preserve the spike branch selection | indistinguishable from absence; preserve the same selection |
| Q-0052 discard report | report returned dropped paths | failed checkout/clean still reports discard; first modified path still loses its first character |
| task-branch filters, Q-0053 (five sites) | preserve absent-branch filtering | indistinguishable from absence; preserve the same filtering |
| merge failure consumers, Q-0052/Q-0053 | report conflicts or returned error | empty error falls back to `git reported no reason` |

QA for Q-0050 induces failures only at the two owned branch-head sites and tests the non-empty
subject before the empty merge-error suffix. Q-0052 and Q-0053 own tests for their later sites.

`LifecycleContext.readBranchHead` is the declared injection point for `BranchHeadReader`; the same
context names ticket, flow, repository, run id, counters, statistics, persistence, emission, the
start head, and reset capability. The branch-head tests inject that member. One returns `null` at run start; the
operational-failure case returns a valid head first and `null` at finish. This deterministic seam
tests the consumer's preserved response to `null`; it does not witness `fanout.safe()` swallowing
the underlying git failure. That swallow remains explicitly unwitnessed for Q-0074.
