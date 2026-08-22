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

## E-2 — 2026-08-22 — the ticket is split; this solution now serves two tickets

**Amends:** `solution/tasks.yaml` (scope only — no contract clause changes).

**Change:** `tasks.yaml` fans out only `Q0006-mock-switch` and `Q0006-runtime`. `Q0006-cli-lint`
and `Q0006-assets-docs` move to **Q-0033**, which consumes this folder's `requirements/merged.md`,
`solution/solution.md` and `contracts/Q-0006/**` unchanged. The pre-split file is preserved as
`solution/tasks-before-split.yaml`. Ownership boundaries in the task descriptions are unchanged,
which is what makes the split clean: the four tasks already declared disjoint file ownership, so
cutting between the second and the third moves whole files, not fragments.

**Why:** a human decision at the architect gate, not an agent's. 30 acceptance criteria hit the
iteration bound at every stage — requirements looped once, solutioning exhausted twice and needed
an out-of-band architect pass, qa-red exhausted once — and two reviewers on two vendors produced
four or five blockers per round without converging. See the DECISIONS entry "Ticket size is the
dominant cost driver", 2026-08-22.

**What this does not change:** no contract is re-cut, no acceptance criterion is dropped, and the
severity of nothing is downgraded. Every criterion is still owned by one of the two tickets —
those touching `spike/src/**` by Q-0006, those touching `spike/bin/**`, `harness/**`, `docs/**`
and `README.md` by Q-0033. A criterion served by both (AC-12's base-ref config is read by the
CLI and enforced by the engine) is owned by the ticket that owns the file where it is enforced,
with the other ticket depending on it.

**Consequence for qa-red:** the tests already written cover both halves. The scenarios and tests
for the surface half are Q-0033's to carry; Q-0006's red phase covers the engine half only.
