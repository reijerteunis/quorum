# Code review — Q-0015, round 1

## Findings

### major — Trace entries do not name their event type

`apps/web/src/mission-control-trace.tsx:51`

Both step columns and the run-activity lane render only `eventLine(event)`. That helper returns a payload such as `message`, `line`, `cmd`, or a stage transition, but never the event’s `type`. Consequently, readers cannot distinguish `step` from `done`, `info` from `warn`, or other events with similar text. This directly misses AC-6’s requirement that each entry name its event type.

Render the event type alongside the verbatim payload for every event kind, and add assertions covering both a step column and the run-activity lane.

### major — Handle navigation can render the previous run under the new handle

`apps/web/src/app.tsx:153`

On a handle-to-handle navigation, `handle` changes synchronously while `snapshot` still belongs to the previous handle. The controller is retargeted only in the passive effect at lines 135–147, so the intervening render passes the old snapshot to mission control under the new route. The same problem independently affects metadata: `MissionControlScreen` retains its previous `metadata` state and resets it only in the effect at `apps/web/src/mission-control-screen.tsx:66`. This can display the old run’s terminal number, trace, timeline, flow, ticket, and pending-gate status under the new handle; particularly, an old pending-gate count can create an actionable gate link targeting the new handle.

Associate both snapshot and metadata state with their source handle and render them only when that subject matches the current route, or otherwise synchronously present the new handle’s idle/in-flight state. Add a navigation test that first loads events and pending metadata for handle A, navigates to B, and asserts that none of A’s data is rendered during B’s first render.

### major — Architecture documentation fabricates runs-list recency

`docs/04-architecture.md:338`

The new architecture text says `/runs` lists runs “newest first.” The implementation deliberately preserves daemon response order without sorting, and AC-2 explicitly says that this order is the only available signal and must not be presented as derived recency. No wire field establishes creation time or recency, so the document turns an unmeasured ordering into a product guarantee contrary to the ticket’s no-fabrication rule.

Describe the list as preserving daemon order, without calling that order newest-first unless the daemon contract is separately changed to guarantee it.
