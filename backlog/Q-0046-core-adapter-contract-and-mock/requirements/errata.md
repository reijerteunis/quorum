# Errata — Q-0046 requirements

Amendments to `requirements/merged.md`, agreed at the requirements gate. The implementer reads this
file beside the requirement (`chore.yaml`'s `implement` step lists `requirements/errata.md` among
its inputs); where this file and the requirement disagree, this file wins **for the clauses it
names and no others**. Each entry is dated and names the clause it supersedes. Nothing here may
widen scope — an erratum resolves a contradiction, it does not add requirements.

## E-1 — 2026-08-26 — register row 1 is split; Q-0047 owns the refusal and its ordering

**Supersedes:** the invariant column of `harness/port-charter.md` §6's **Q-0046** row (`:314`), so
far as it assigns register row 1 (`:127`) whole to this ticket, and the same list as restated in
`backlog/Q-0046-core-adapter-contract-and-mock/ticket.md:72`. §2's register text at `:127` is
unchanged, and the other thirteen children are unaffected.

**Replacement:** row 1 splits into two halves with two owners.

- **Q-0046 owns the half it can write.** Nothing in `packages/core/src/adapters/` calls `check()`;
  `probeAdapter` is the only authenticated round-trip in the module and it never stands in for
  presence; the exported contract states in its own JSDoc that `check()` is cheap, makes no
  authenticated request, and does not prove a login. Enforced by **AC-9**
  (`requirements/merged.md:378`).
- **Q-0047 owns the refusal and its ordering.** Its requirement must carry a criterion asserting
  that the refusal fires **before** the CLI probe, over all three variable names, and that it still
  fires when the configured executable is missing.

**Why the requirement was wrong** — or rather, why the charter's assignment was. The refusal is not
in `adapters/index.js` and never was. It is in `spike/src/adapters/claude.js:12` and
`spike/src/adapters/codex.js:21`, inside each vendor's `check()`, ahead of the `--version` probe,
each carrying the comment that explains the ordering. `mockAdapter`'s `check()`
(`spike/src/adapters/mock.js:28`) performs no such check and returns `'mock 0.0.1'`. Both vendor
files are **Q-0047's** (§6 `:315`), and §6 assigns row 1 to neither. A criterion asking this ticket
to assert the refusal would name a surface its flow may not write, which the revise loop cannot
close and every round would be right to refuse — *"A requirement may not name a surface its flow
cannot write"* (`docs/DECISIONS.md`, 2026-08-25).

**Why the guard is not centralised into the contract layer instead.** That is the other available
answer and charter §2 forbids it: moving the refusal into `withRetry` or `getAdapter` is a
behaviour change — `mockAdapter().check()` would begin refusing, and every contributor adapter
would inherit a guard it does not have today — and the route for a deliberate behaviour change is
its own `docs/DECISIONS.md` entry accepted *before* implementation, never a silent improvement
discovered in review.

**What this erratum does not settle.** It does not weaken row 1. Reporting the row as *closed* by
this ticket would be the exact failure the row exists to prevent — charter §2's own words are
*"a rewrite that probes first and refuses second passes every test that checks only the refusal"* —
so the implement report must name the split and name Q-0047 as the owner of the untested half. It
also does not touch rows 13, 21 or 22, which this ticket discharges in full.

**Citation correction.** `requirements/merged.md`'s E-1 text cites the codex refusal as
`codex.js:22`; it is at **`codex.js:21`**. Verified against the working tree at `9b3781f`. The
other citations in that section — `claude.js:12`, `mock.js:28`, charter `:127`, `:314` and `:315` —
are correct as written.
