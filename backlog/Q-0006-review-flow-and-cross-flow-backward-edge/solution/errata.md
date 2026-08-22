# Errata — Q-0006 contracts

Amendments to frozen contracts under `contracts/Q-0006/`, agreed after they were sealed.
Development implements what is written here; where this file and a contract disagree, this file
wins **for the clauses it names and no others**. Each entry is dated and names the clause it
supersedes. Nothing here may widen scope — an erratum resolves a contradiction, it does not add
requirements.

## E-1 — 2026-08-22 — retry semantics at an exhaustion gate

**Supersedes:** `contracts/Q-0006/review-runtime.contract.md` §retry (the clause reading "sets
only `iterations.review` to `max_iterations - 1` (persisted value `2` for the shipped limit)").

**Replacement:** `retry` sets `iterations.review` to **`max_iterations`** — persisted value `3`
for the shipped limit of 3. No other counter is modified. The grant is recorded in `runs.log` as
`gate=retry counter=<name> set=<n>`.

**Why the contract was wrong.** The retry answer itself returns `{goto: …}` and causes a
traversal. With `max_iterations - 1` persisted, the following rejection increments to
`max_iterations`, which is still within the bound, and regresses a second time — two further
traversals where AC-18 promises exactly one. With `max_iterations` persisted, the retry's own
regression is the authorised traversal and the next rejection exceeds the bound, re-presenting
the gate. Traced against `handleFail` and `runGate` in `spike/src/engine.js`, and now covered by
the smoke suite ("retry grants exactly one more traversal, no more").

**Also corrected in the engine ahead of this ticket:** `runGate` previously executed
`ctx.counters = {}` on retry, wiping every counter on the ticket — a review retry refunded a
`qa` budget already spent — and granting `max_iterations + 1` further traversals rather than one.
Both are fixed; the contract's intent is now what the engine does.

**Scenario impact:** the scenario asserting persisted `3` is correct as written and needs no
change. Any test asserting `2` is wrong.
