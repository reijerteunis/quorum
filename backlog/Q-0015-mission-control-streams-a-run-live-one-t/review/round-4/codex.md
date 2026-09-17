# Code review — Q-0015, round 4

## Findings

### major — Retry loss is attributed to the wrong cause

`apps/web/src/run-connection.ts:229`

`retry()` clears every accepted event and adds their count to `browserDiscardedCount`. That counter is rendered as “discarded … to keep the view bounded” (`apps/web/src/mission-control-text.ts:30`), but these events were discarded because the user retried, even when the trace was far below the 500-event bound. This makes the loss disclosure factually wrong and conflates a third loss mechanism with AC-10’s browser-retention loss. It also contradicts the architecture’s still-current guarantee that explicit retry preserves accepted evidence (`docs/04-architecture.md:340`).

Use a separately modelled and accurately worded retry-loss state/counter, or retain the accepted evidence as the existing contract requires. If retry semantics are intentionally changing, update the governing requirement/decision and architecture documentation rather than charging the loss to retention overflow.

### major — The required development-plan record was not advanced

`docs/06-development-plan.md:3777`

The Q-0015 entry still records only the requirements gate and its cost; it does not record the implemented runs landing, bounded live trace, run-level lane, observed-only timeline, gate link, or missing-data disclosures. AC-14 explicitly requires this ticket’s plan entry to move, and the new contract repeats that requirement. Leaving the milestone register at the pre-implementation state makes the project’s canonical development plan claim that the ticket has not shipped.

Update the Q-0015 entry with the completed implementation and verification facts available from this run, following the plan’s established completed-ticket format.

## Verification note

`git diff --check` passed. The web test suite could not start in the read-only review environment because Vite attempted to create a temporary config file under `apps/web/node_modules/.vite-temp` and received `EPERM`.
