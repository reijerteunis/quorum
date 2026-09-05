# Q-0101 — implement report, chore run 2, iteration 5

**This round changed one line: a `Why:` citation.** The finding open at the end of round 4 —
`review/chore/run-2/chore-iter-4.md`'s blocker on the `q0033-surface.js` register row — asked for
exactly one of two remedies: *"Obtain a gate erratum correcting AC-10 or naming the missing
counterpart, then make the register and its assertions match that ruling."* The erratum now exists:
`requirements/errata.md` **E-3**, landed 2026-09-05 at the second exhaustion gate of this run. This
round is the first that can read it, per GO-3's own rule that the window for an erratum is a gate.

---

## 1. Every finding, addressed

### iter-4 blocker — `spike-parity.test.ts:185`, AC-10's sixth counterpart

**Ruled by E-3: the surface row stays at five entries, and the prose carries the claim.** E-3's
reasoning, restated only enough to show it was followed: AC-8 is required by R-8 — ruled in §3 of
the merged requirement as *"ruled, not open"* — to land in `packages/cli/src/run.test.ts`, and that
file is **already** the row's fifth entry. A sixth entry could only be satisfied by naming a file
the audit would then require to exist and be collected — an invented counterpart, the false register
entry `binaryCarriedBy` (Q-0091 E-2) exists to make impossible. So the row's list does not grow;
what AC-10 requires of this row is that its **prose** stop naming Q-0101 as a successor and state
that `run.test.ts` now also carries S3.2/S3.3, on the Q-0092 precedent AC-10 itself cites.

**The register and its assertions already matched that ruling at `4438307`**, verified clause by
clause this round rather than asserted:

| what E-3 rules | where it already holds |
| --- | --- |
| `binaryCarriedBy` stays exactly five entries | the row at `:186`–`:191`; pinned by test (p)'s `toStrictEqual` at `:1694`–`:1701` (*'the surface row lost a counterpart'*) |
| the prose states `run.test.ts` also carries S3.2/S3.3 | the row's `binaryHalf` at `:184`: *"and S3.2/S3.3 — the shipped review flow walked down both of its paths … — carried by run.test.ts since Q-0101, in process rather than through a spawned binary because the forcing switches make the scenario independent of the mock's per-key counter"* |
| `binaryHalf` stops naming Q-0101 as a successor | the `owing` identity at `:1818`–`:1822` (`/— Q-\d{4}\b/` over every row → `[]`), plus the inverted clauses at `:1633` and `:1713` |
| AC-11's three inversions untouched | tests (l), (p) and (r) — unchanged since round 3, each still carrying its re-aim comment |
| AC-12's sixth totals block untouched | `:1839`–`:1858`, unchanged |
| the `smoke.js` row's two-file requirement untouched | test (s) at `:1803`–`:1814`, unchanged — `failure-paths.test.ts` is a genuinely new file carrying new claims, so that row's list **did** grow, per the same precedent |

**What moved is the citation, and only the citation.** E-3 did not exist when round 4 ran, so
nothing in the source named the authority for a five-entry list sitting under a requirement whose
AC-10 sentence says "gains its sixth counterpart" — a reader meeting the two would find an apparent
contradiction and no pointer. That is the case the engineering rules' one-line authority form
exists for, and the disposition is Q-0094's round-4 precedent exactly: once the erratum lands, the
authority comment moves from argument to citation. One line, at the site the blocker named:

```ts
// Why: five entries, not six — a claim landing in a listed file moves the prose, not the list; see Q-0101 requirements/errata.md E-3.
binaryCarriedBy: [
```

No assertion was added. E-3 names nothing new to assert — the ruled state is the already-asserted
state, per the table above — and a new pin the requirement does not ask for would be scope this role
refuses.

### iter-1 · iter-2 · iter-3 blockers — GO-5 (`failure-paths.test.ts:1`)

**Discharged by `requirements/errata.md` E-2, cited and not re-attempted**, per that erratum's own
instruction that no further implement round may spend itself on it. E-2 records the measurement
performed at the gate: five matched pairs, interleaved, each arm a separate clone in the bare shape
— `edcc7ad` five runs all exit 0, the implement tip five runs all exit 0, 109–116 s against
108–112 s. The direction GO-5 exists to detect is absent.

One nuance is stated rather than left to be noticed: this round's tree is **no longer**
byte-identical to `4438307` — it adds one comment line. I did not re-run the sweep over it, because
E-2 rules the obligation discharged at the gate, and a comment inside a string-adjacent register in
a test file is not a mechanism by which a process-spawning suite's contention profile moves. If the
gate wants a sample at the new tip regardless, that is the gate's row, as E-2's own procedure was.

### iter-1 major — `failure-paths.test.ts:72`, the `sh` refusal

Fixed in round 2, independently verified in round 4 (its §1), unchanged this round: the probe runs
the shell (`spawnSync(shell, ['-c', 'exit 7'])`), refuses at module scope naming which of four ways
the answer is no, and its discrimination is asserted over a parameterised command rather than
described.

### iter-1 major — `failure-paths.test.ts:676`, AC-7(b1)(b) branch attribution

Fixed in round 2, independently verified in round 4 (its §1), unchanged this round: `NAMES_BOTH`
pins both branch constants in their own positions through a `literal()` escaper, with the
swapped-order and neither-named probes shown `false`.

---

## 2. Files

### 2.1 Changed this round

- **`packages/core/src/spike-parity.test.ts`** — one line: the `Why:` citation of E-3 above the
  `q0033-surface.js` row's `binaryCarriedBy`, at the line the iter-4 blocker named. No assertion, no
  register field, no expected value moved.

```
 packages/core/src/spike-parity.test.ts | 1 +
 1 file changed, 1 insertion(+)
```

### 2.2 The change under review, otherwise unchanged since `4438307`

```
 packages/cli/src/end-to-end.test.ts    |  31 +-
 packages/cli/src/failure-paths.test.ts | 861 +++++++++++++++++++++++++++++++++
 packages/cli/src/package.test.ts       |  10 +-
 packages/cli/src/run.test.ts           |  62 +++
 packages/cli/src/templates.test.ts     |  68 +++
 packages/core/src/spike-parity.test.ts | 125 ++++-
 6 files changed, 1132 insertions(+), 25 deletions(-)
```

### 2.3 Deliberately left alone

- **The register's five-entry list and every assertion over it** — E-3 ratifies them as they stand;
  editing what a ruling confirms would be movement without a subject.
- **AC-11's three inverted clauses and their comments** — E-3 names them untouched.
- **`spike/`** — ground rules 1 and 2, non-goal. Read while verifying; not written.
- **All product source.** Nothing under any `src/` outside the one test-file comment.
- **`backlog/`** — not an agent-writable surface. E-2 and E-3 are the operator's; both are cited,
  neither edited.
- **`docs/`, `docs/decisions/`, `06-development-plan.md`** — none owed (§8), and a decision is the
  human's.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100, Q-0102** — open, untouched, no user-facing `harness`
  sentence altered.

---

## 3. Verification

Run at this round's tree, forced.

| | |
| --- | --- |
| `pnpm install --frozen-lockfile` | already up to date |
| `npm install --prefix spike --no-audit --no-fund` | up to date |
| `npm test --prefix spike` | **19/19 files passed** |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached**; `@quorum/cli` 23 files / **545 tests**, `@quorum/core`'s `spike-parity.test.ts` green with the new line in place |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `pnpm sweep:git-identity` | not re-run — GO-5 discharged by E-2 at the gate; see §1 |

Per *"Integrate's tick is worktree-scoped"*, both suites want re-running forced on `main` after the
merge; that is the gate's row, not this worktree's.

---

## 4. For the gate

1. **All four review rounds' findings are now closed** — three by E-2's gate measurement, two by
   round 2's fixes (re-verified in round 4), and the last by E-3 plus this round's citation. Nothing
   is refused, deferred or owed an erratum.
2. **GO-4 is still owed and is the human's**: allocate the cutover ticket — deleting `spike/`,
   retiring its CI job and `harness/port-charter.md` — at this ticket's close rather than
   remembering it. Clause (s)'s `owing → []` identity is the state that cutover needs, and it holds.
3. **OQ-1 stands answered from round 2**: the AC-2(e) counter is `1`, measured, with the assertion
   shown red against a refund to `0` and against the key being absent.
