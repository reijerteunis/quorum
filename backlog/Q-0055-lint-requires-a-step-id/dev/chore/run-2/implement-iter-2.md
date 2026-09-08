# Q-0055 — implement report, run 2 iteration 2

*A revision round. One finding was returned and it is real; this report is what it cost and what it
did not touch. Against `45d8dc2`. Every measurement below was produced by running code.*

---

## 1. The finding, and whether it holds

> **major** — `packages/cli/src/board.ts:83` `flowsIn` treats `record.flow !== undefined` as proof
> that a flow linted successfully, but `lintFlowDirectory` retains `flow` when it later appends
> cross-flow problems such as missing, cyclic, or ambiguous target flows.

**It holds, and it was verified against the code rather than accepted.** `lintFlowDirectory`
(`packages/core/src/lint/lint.ts:363`) pushes `{ file, flow, problems: [] }` for every file that
parsed and passed `lintFlow`, and *then* walks the cross-flow edges over exactly those records,
appending to `record.problems` at `:397` (missing or unloadable target), `:407` (cycle), `:413`
(dies at a stage) and `:417` (ambiguous). The record keeps its flow throughout. So
`record.flow !== undefined` answers **did it parse**, and iteration 1 used it to answer **did it
lint**. Those two questions have exactly one shape on which they disagree, and that shape is a
backward edge to a flow that is not there.

The consequence is the one the reviewer names and it is worse than a missing legend entry: such a
flow **kept its `→ quorum run <flow> <id>` hint**, while `run.ts:151` lints the whole flows
directory and exits 1 before anything is loaded — so the board offered a command the product
refuses, and the legend written to explain a missing hint said nothing, because from its point of
view nothing was missing. Reproduced before it was believed; §3 is the run.

It is also the shipped legend's own sentence being false. `unreadableFlowsLegend` renders
*"a flow that fails to load or lint has no → quorum run hint above"*, which is a general claim about
every flow that fails lint, not a claim about the files it names — and iteration 1 shipped it beside
a classifier for which it was untrue.

---

## 2. What changed, file by file

Two files. No other file in the workspace is touched.

### `packages/cli/src/board.ts` (+18 / −9, no behaviour outside `flowsIn`)

```ts
flows: records.flatMap((record) => (record.problems.length || record.flow === undefined ? [] : [record.flow])),
unreadable: records.filter((record) => record.problems.length).map((record) => path.basename(record.file)),
```

- **`problems.length` is the classifier in both clauses**, so the two lists **partition** the
  records: every record is in exactly one, no record with a problem is runnable, and every record
  with a problem is named. That is what makes the legend's sentence true rather than true-of-some,
  which is the property iteration 1 did not have.
- **`record.flow === undefined` survives only as a type narrowing** and says so in a one-line
  remark: a record with no problem always carries a flow, every failure path recording one, so the
  clause adds nothing to the rule and its removal would only cost `Flow | undefined`. It is
  deliberately *not* the disjunct doing the work — mutation 1 in §3 is what proves that.
- **Filename order is unchanged** in both lists: `lintFlowDirectory` sorts and `filter`/`flatMap`
  preserve it, so AC-16's *"two bad files are one line naming both, in filename order"* still holds
  with a cross-flow failure among them.
- **The JSDoc gained the paragraph the defect deserved** rather than a corrected sentence: the old
  one asserted *"`lintFlowDirectory` records a problem and no `flow` for such a file"*, which is the
  false premise itself, and is gone. The new one names why `flow` is the wrong question, names the
  shape that discriminates, and names the consequence — a hint for a command `run.ts` refuses. The
  `FlowIndex` field comment moved from *"the loaded flows"* to *"the flows whose file lints clean"*
  for the same reason.
- **Nothing else in the file moved.** `unreadableFlowsLegend`'s bytes, the legend ordering, the
  containment and push-lag legends, the exit code and every rendered token are untouched.

### `packages/cli/src/board.test.ts` (+34, one new test and one new fixture builder)

- **`danglingFlow(name, consumes, produces)`** — a flow whose one step carries an id and an
  `on_fail` with `goto: flow:nowhere`, `max_iterations: 1`, `on_exhausted: gate`. It satisfies every
  per-flow rule, including Q-0055's own, and is refused only by the cross-flow pass. Its docstring
  says what it is for: the one shape where *did it parse* and *did it lint* disagree.
- **`AC-16 — a flow refused for a cross-flow edge loses its hint and is named with the rest`**,
  beside the existing id-less, unparseable and two-bad-files tests. Three assertions on one board:
  `dangling` has no hint, `dangling.yaml` is named, and `alpha` keeps its own hint — because either
  half alone passes over the defect, which is the shape the neighbouring AC-16 tests already use.
- **It carries a premise assertion, and that is the part worth reading.** Before the board runs, the
  fixture is put through `quorum lint` and the output is required to contain
  `target flow nowhere is missing or unloadable`. Without it, a fixture that drifted into failing a
  *per-flow* rule would make this test pass for the wrong reason and be a second copy of the id-less
  test under another name — the vacuity this repository keeps finding in checks written to close
  something else. The premise passed under the pre-fix classifier too, which is what proves the
  fixture is genuinely a cross-flow failure and not a parse failure.

---

## 3. Demonstrated red before green, on its own

Per AC-12, and because a diagnostic cannot be established by reading it (R-2).

| mutation | result |
| --- | --- |
| `flowsIn` restored to iteration 1's `record.flow === undefined` in both clauses, everything else intact | **1 test red**, 37 green: `a flow the linter refuses kept its hint: expected 'draft → quorum run dangling <…' not to contain 'quorum run dangling'` |

The failure output is the finding rendered: the pre-fix board printed
`draft → quorum run dangling <id>` **and** no `could not read` line at all, so the same run
demonstrates both halves — the hint that should not be there and the name that should. The premise
assertion passed in that run, so the fixture was a cross-flow failure under both classifiers and the
only variable was `flowsIn`.

The four AC-16/AC-17 tests iteration 1 shipped are unchanged and still green, so the parse-failure
and per-flow-failure routes are still covered by their own rows rather than by this one.

---

## 4. What I deliberately did not do

- **The legend's label is unchanged.** `could not read` is now slightly loose — a flow refused for a
  dangling edge *was* read — but AC-16's own normative sentence is *"the board says which flows it
  could not read"*, the sentence beside the label names the class exactly (*"a flow that fails to
  load or lint"*), and four shipped assertions pin the bytes. Moving it would be a wording change
  the finding did not ask for. **Reported as a nit, not taken.**
- **`quorum run`'s all-or-nothing directory lint is untouched, and is the one thing this fix does
  not make true.** While any file in the directory is broken, `run.ts:151` refuses *every* flow, so
  even the clean flow's hint names a command that exits 1. AC-16's Test clause requires that hint to
  render, so the board keeps printing it. Stated here so the two lists are not read as a full
  prediction of what `quorum run` will do — they predict what `quorum lint` says about each file,
  which is what the legend claims and no more.
- **`lintFlowDirectory` is not changed.** Splitting per-flow from cross-flow problems on the record,
  or dropping `flow` when a cross-flow problem lands, would be a `core` API change with three other
  callers, and the finding is satisfiable in the caller that conflated the two.
- **Nothing from iteration 1 was revisited.** The linter, the schema comments, `diff.ts`, the
  registers, `step-id.test.ts` and the spec row are untouched; the review returned no finding
  against them and re-opening them on a revision round is the scope creep this role refuses.

---

## 5. Carried from iteration 1 and still the gate's

Unchanged and repeated so they are not lost between rounds:

1. **§3.1** — AC-5's *"the sixteen verbatim assertions pass unedited"* against AC-14, on one
   fixture. Ruled the minimal way; reversible in one clause.
2. **§3.2** — AC-15 names two `PRESENCE_CASES` rows; six were affected. Two moved as required, four
   kept their own subjects.
3. **§3.3** — seventeen diagnostics is eighteen, and *"the third that cannot"* open with a step id
   is four, both as a consequence of AC-14 being folded in at the gate.
4. **§5** — `packages/shared/src/flow.ts` carries one sentence citing `spike/src/lint.js`, false
   before this ticket and belonging to the citation sweep. **Reported, not fixed.**
5. **GO-1** — `docs/decisions/` still ends at **084** and no entry was landed for this ticket, which
   under GO-1's own wording is the gate ratifying OQ-4's *no entry owed*. The authority sits in the
   check's own comment per the Q-0108 precedent.
6. **GO-4** (both-rows forced verification after the merge) and **GO-5** (this ticket's plan bullet)
   are the gate's.

---

## 6. Verification

- **`pnpm turbo run test lint typecheck --force --continue` — 21/21 tasks, 0 cached.**
  `@quorum/core` 1343 passed | 2 skipped across 58 files, `@quorum/shared` 158, `@quorum/cli` **606
  across 25 files**, four scaffolds 1 each. **2111 passed, 2 skipped** — one more than iteration 1,
  which is this round's single new test.
- **`packages/cli/src/board.test.ts` — 38 tests**, including the new one; the file's other 37 are
  unchanged and green.
- **`pnpm sweep:git-identity` — exit 0**, reporting *"the workspace suite executed and green with no
  resolvable git identity"*.
- **`pnpm exec quorum lint` in this repository — six green ticks**, and **`pnpm exec quorum board`
  through the built binary prints all five hints and no `could not read` line**, which is the
  shipped corpus unaffected by the widened classifier, checked rather than assumed.
- `pnpm install --frozen-lockfile` and `pnpm turbo run build --force` were run before the suite, so
  what was tested is what `integrate` will run.

**One transient failure is reported rather than smoothed over.** The first full
`test lint typecheck --force --continue` of this round exited with `@quorum/core#test` red while
`@quorum/cli:test` passed 606 in the same run. It did **not** reproduce: `@quorum/core` alone,
`@quorum/core` under turbo, and three subsequent full forced sweeps all returned 0 failures at this
tip. **I cannot name the failing test** — the output was tailed and the turbo log was overwritten by
the next run — so this is a sighting with no subject, and it is deliberately not claimed as an
instance of Q-0102's cluster or of anything else. It cannot be this change: `packages/core` does not
read `board.ts`, and `@quorum/cli` was green in the same run.
