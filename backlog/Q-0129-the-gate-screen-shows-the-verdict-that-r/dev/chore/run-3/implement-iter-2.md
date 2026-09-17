# Q-0129 — implement, run 3, iteration 2

*A `retry` round, not a revise round: there is no review report on this branch. What changed since
iteration 1 is that the gate landed the contract note by hand, so the one criterion that round
stopped on became satisfiable.*

**Verdict: `proceed`.** All twelve criteria are complete.

---

## 1. What this round was for

Round 1 returned `blocked` on AC-12's first clause and was right to. That clause requires
`contracts/Q-0050/run-events.contract.md` to gain a superseded-by note beside its
`GateQuestionEvent` block, and `contracts/` is not among `developer-generalist`'s fourteen declared
roots — *"A requirement may not name a surface its flow cannot write"* (2026-08-25).

The gate did three things, and the remedy was `retry` rather than `advance` for exactly this reason:

1. wrote the note by hand (`358b780`), taking round 1's own §7 wording as offered;
2. recorded the ruling as **erratum E-6**;
3. answered `retry`, so an implement step reads a tree in which the note exists.

Verified before writing anything: the note is on this branch at
`contracts/Q-0050/run-events.contract.md:49–54`, immediately after the fenced declaration block and
before the `undecided` paragraph Q-0040 added. It is byte-identical to what round 1 offered.

**So the work left was AC-12's *Test:* clause — the guard — and nothing else.** The other eleven
criteria are round 1's and are untouched; I re-ran them rather than re-reading them.

---

## 2. What changed, file by file

Two files, 179 insertions and 4 deletions.

### `packages/shared/src/docs.test.ts` (+177 / −4)

**(a) The AC-12 guard** — a new `describe` at the end of the file, three tests over one predicate.

`citationProblem(contract, rows, entries)` returns the one thing wrong with the contract's `reached`
note, or `null`. It:

- selects the note **by its subject** — the paragraphs carrying `superseded by` and naming
  `reached` — rather than by position, so reordering the document cannot quietly move the check onto
  a different paragraph. There is a second superseded-by note in that file, Q-0040's, and it names
  neither;
- refuses a citation **by file name** (`decisions/…​.md`, or a bare `NNN-slug.md`) and **by number**
  (`decision 097`, `entry 97`, `#097`), which is the half the rule states negatively;
- parses the `*"Title"* (YYYY-MM-DD)` shape, **collapses the whitespace in the captured title**, and
  looks it up in `docs/DECISIONS.md`'s index through the `listed()` helper this file already has;
- compares the index's date for that row against the cited one;
- reads the entry the index links to through the audited `onDisk()` walk, and requires its `# Title
  — Date` heading to be the citation;
- and requires that entry to name `reached` and `gateQuestionEventSchema`.

**The last clause is what makes it a check about *this* ticket's entry.** Without it the note could
cite any landed entry, resolve cleanly, and still not be the ruling it claims to be.

**What it deliberately does not do is compare the note against a title typed into the test.** The
rule is that an entry is cited by its title and date; a guard asserting equality with a transcribed
string would go on passing over an index row renamed underneath it, which is precisely the drift a
citation rule exists to catch. Both sides are derived.

**(b) A dead loop removed.** Round 1's edit to the Q-0017 AC-15 block inserted its new clauses and
left the original loop's tail behind with an empty array literal:

```ts
for (const [what, needle] of [
] as [string, RegExp][]) {
  expect(needle.test(gate), `the gate paragraph does not record ${what}`).toBe(true);
}
```

It iterates nothing and asserts nothing — a check that cannot fail, in the most literal form, in
code this ticket wrote on this branch two commits ago. Removed. No assertion was lost: the four
clauses that loop used to carry were moved into the loop above it by the same edit, and they are
still there and still green.

### `packages/shared/turbo.json` (+6)

One row, `../../contracts/Q-0050/run-events.contract.md`, with the comment naming the ticket and the
reason. **This is the first file under `contracts/` that any suite in this workspace reads** — that
directory has no package, so nothing had opened one before and no task declared one. Checked by
grep across every `turbo.json` and every `.ts` under `packages/` and `apps/` before adding it.

---

## 3. Three measurements, each worth more than the lines they produced

### 3.1 `contracts/` is unwritable here, so the guard was demonstrated over the real bytes in memory

I cannot mutate `contracts/Q-0050/run-events.contract.md` to show a clause red — that is the same
constraint that blocked round 1, and it does not go away because the note now exists.

So the check is shaped as a **predicate applied to both the shipped contract and the fixtures**,
rather than as assertions inside the real-file test with a re-implementation beside it for the
fixtures. A fixture checked by a second implementation demonstrates *that implementation* and not
the guard — the nit Q-0125's implementer wrote three times and its reviewer reported three times.

Then, to show the real-file path discriminates rather than merely returning `null` today, I added a
**temporary** test that mutated the real bytes in memory and ran them through the same predicate.
Its output, verbatim:

```
NOTE REMOVED      → the contract carries no superseded-by note about `reached` — this check has lost its subject
TITLE MISQUOTED   → the note cites "A ruling nobody landed, carries the decision that reached it", which docs/DECISIONS.md does not list
DATE MOVED        → the note dates that entry 2026-09-16 where the index lists it under 2026-09-17
CITED BY NUMBER   → the note cites the entry by its number
CITED BY FILENAME → the note cites the entry by its file name
UNTOUCHED         → null
```

Five distinct messages and a null for the shipped file. **The temporary test is removed**; it is
recorded here rather than shipped, because a test that mutates a document it may not own is a
demonstration rather than a guard.

`TITLE MISQUOTED` is also the proof that the whitespace collapse is load-bearing: the contract wraps
its prose, so the title spans a line break and the captured text carries the newline. The message
shows the collapsed title, which is what makes the index lookup the lookup it reads as. Without the
collapse the **shipped** note fails, so the real file is what discriminates that clause and no
fixture has to stand in for it.

### 3.2 The scanner refused my first shape, and the reason is recorded in place

The read was first written as `const CONTRACT = 'contracts/…'` with two `repoFile(CONTRACT)` call
sites. `packages/core/src/turbo-inputs.test.ts` went red with:

```
packages/shared/src/docs.test.ts: repoFile → CONTRACT
```

It collects a quoted literal and reads a binding as an **indirect route** that would then need
excusing in `INDIRECT_ROUTES` — a register row bought for nothing. Corrected to a single helper
holding the literal, and the measurement is written where the next person will meet it rather than
in this report alone.

### 3.3 The turbo row is load-bearing, shown rather than asserted

Removed the declaration and re-ran the scanner: **three clauses red, each naming
`contracts/Q-0050/run-events.contract.md`**. Restored, green. So a cached pass cannot stand over a
note whose citation has drifted from the entry it names, which is the property the row exists for.

---

## 4. Verification

- `pnpm install --frozen-lockfile` → already up to date.
- `pnpm turbo run test lint typecheck --force --continue` → **21 successful, 21 total, 0 cached**.
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → **green twice in two runs**.
- The AC-12 guard shown red five ways over the real bytes (§3.1), the turbo row three ways (§3.3).

**Test counts, and a correction to round 1's report.** Per package: `@quorum/core` 1,567 (+2
skipped), `@quorum/cli` 692, `@quorum/web` 425, `@quorum/shared` **262**, `@quorum/server` 215,
`@quorum/compiler` 1, `@quorum/templates` 1 — **3,163 passed, 2 skipped**.

Round 1 reported *"3,161 tests passed, 2 skipped"*, and its own per-package figures sum to **3,160**.
The transcribed total was off by one. This round's figure reconciles: 3,160 + 3 = 3,163, with
`@quorum/shared` moving 259 → 262 — my three new tests — and **every other package unchanged**,
which is the check that says this round touched only what it claims to have touched.

**The sweep rate is stated rather than characterised.** Round 1 recorded 1 failure in 3 on
`packages/core/src/adapters/exec.test.ts`, an EPIPE write/exit race, and routed it to **Q-0102**.
Two green runs here is a second observation, not evidence the flake is gone, and nothing in this
change touches that file or that subsystem.

---

## 5. What I deliberately left alone

- **`contracts/Q-0050/run-events.contract.md` itself.** Still outside this role's paths. The note is
  the gate's, and I did not edit a character of it — including not "improving" the wording it took
  from round 1.
- **The `**220**`, `**148**`, `returns 255` and `34 retry-grant lines` figures** in the design-brief
  test. §5.10 makes refreshing them a non-goal: they are dated to Q-0016's gate, and a dated
  measurement is not drift. Today's census is 235/157, and it belongs in a sentence carrying today's
  date, not retrofitted into that paragraph.
- **Round 1's eleven criteria.** Re-run, not re-litigated.
- **Round 1's three reported residuals**, unchanged and still reported rather than fixed: the
  `routing.ts:78` slot race no shipped flow reaches; fan-out children being outside AC-3's exception,
  which names `parallel` alone; and the pre-existing unused `eslint-disable` at
  `packages/core/src/backlog/backlog.ts:448`, which is code I was not sent to change.

---

## 6. Not done, and whose it is

**GO-5** — verification forced in *both* environment rows — is the operator's at the close. This run
was performed in one worktree, and I am not reporting the second row.

**GO-6** — the product run by hand, with the step id, verdict and at least one finding the gate
screen rendered transcribed into `runs.log` — cannot be performed from here. E-5 and the criterion
itself both say why this matters: Q-0016's equivalent obligation was **reported discharged when its
by-hand half had not been performed**, Q-0015's gate found that, and Q-0130's GO-4 was written to be
unfakeable because of it. So it is named as outstanding rather than quietly omitted.
