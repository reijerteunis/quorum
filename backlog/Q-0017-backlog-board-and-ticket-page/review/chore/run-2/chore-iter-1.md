# Q-0017 code review — run 2, iteration 1

Verdict: **revise**

- major: apps/web/src/backlog-board.tsx:217 Each `load()` creates its own `live` flag, but only the invocation returned from `useEffect` has its cleanup retained. Retry and Refresh discard the returned cleanup, so an earlier slow request can complete after a later refresh and overwrite the newer board with stale containment, push-lag, flow, and fetched-at data. Track the current request with a generation/abort mechanism shared across invocations, invalidate the preceding request before starting another, and add a test resolving overlapping loads out of order.

- major: packages/server/src/read.ts:106 A malformed ticket without an id is projected as the literal `"undefined"`, discarding the ticket folder—the only stable identity still available. Multiple damaged tickets consequently become indistinguishable, and the renderer also gives them duplicate React keys at `apps/web/src/backlog-board.tsx:298`. This does not satisfy AC-8's requirement to name the folder when the id is unreadable. Carry a non-fabricated folder identity on the wire for this case, render it in the unplaceable region, and test multiple malformed tickets together.

The six files omitted from the supplied truncated patch were inspected directly from `harness/Q-0017/implement`; no judgment was made from the diff stat alone.
