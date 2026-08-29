# Review — Q-0050 round 6 · Codex

## Findings

- **major** — `packages/core/src/engine/engine.ts:143`: Step-ID enrichment relies on one mutable run-wide `stepId`, set from the outer step at `engine.ts:225`, but `routing.ts:58` executes members of a `parallel` group concurrently. All adapter events from those members therefore receive the outer group’s ID—often `"undefined"`—rather than the executing member’s ID. A single mutable slot also cannot represent multiple concurrently active members. This violates AC-2’s requirement that each adapter event gain its executing step ID and will cause M3 consumers to attribute parallel output to the wrong task. Preserve the shared mutable run context while giving each parallel member a member-scoped emitter, or enrich adapter callbacks inside `runAgentStep` from that member’s ID; add a parallel test asserting distinct member IDs.

- **nit** — `packages/core/src/engine/types.ts:47`: The public `auto` option says exhaustion gates are included, but exhaustion gates are `human-locked` and `routing.ts:12` explicitly prevents `auto` from advancing them. This contradicts AC-6 and could make callers omit an answer channel expecting a non-interactive run, only for the run to fail at exhaustion. Correct the JSDoc to state that `auto` advances eligible gates but never `human-locked` exhaustion gates.
