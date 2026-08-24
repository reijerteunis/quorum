# Q-0035 — implement report (iteration 3, revision round)

A review report from iteration 2 is present, so this was a revision round. The branch already
carried the full implementation of all twelve acceptance criteria plus iteration 1's fixes. I
changed nothing that iteration 2's review did not name, and I re-ran the whole suite after every
step.

Iteration 1's three findings were closed in the previous round and were not re-raised: the lint
traversal now reaches a `fan_out` template (`diffSites` in `spike/src/lint.js`), `shallowState()` is
three-valued so a failed probe cannot become a confident negative, and the DECISIONS entry's
branch-position argument was corrected and now carries rows 3–7 of its evidence table. I verified
each of those is still in place rather than assuming it.

---

## Finding 1 — `spike/src/engine.js:119`, the preflight never saw a `fan_out` template

**Confirmed, and it was the only code defect in this round.** The run-level preflight iterated
`members.filter((candidate) => candidate.input?.diff)`, which is the outer step only. `runFanOut`
copies `step.step` into a real step and `buildPrompt` reads its `input.diff` like any other, so a
template range escaped the preflight twice over:

- a **bad** template range failed only at step time — after the fan-out's own adapters had been
  billed, which is the exact class of loss AC-8 exists to prevent;
- a **good** one was re-materialised by every expanded task, so one range cost *n* git spawns and
  the members of a wave read evidence resolved at different moments — AC-11's
  once-per-distinct-range guarantee, broken.

### What I changed

`spike/src/engine.js` — added a `diffSitesOf(step)` helper beside the other diff machinery and
pointed the preflight loop at it:

```js
function diffSitesOf(step) {
  return [
    ...(step.input?.diff ? [{ site: step, perTask: false }] : []),
    ...(step.fan_out && step.step?.input?.diff
      ? [{ site: { id: `${step.id}.step`, input: { diff: step.step.input.diff } }, perTask: true }]
      : []),
  ];
}
```

Three decisions inside that are worth the reviewer's attention:

1. **The synthetic id is `${step.id}.step`,** which is exactly the label `lintFlow`'s `diffSites`
   already uses. A flow file that is wrong now reads the same whether lint or the engine reports it.
2. **`flattenSteps` still does not descend into the template,** and the comment says why: the
   template's id, role and adapter are placeholders, so the duplicate-id, `goto` and `cross_vendor`
   rules must keep not seeing it. Only the diff rules may.
3. **A template range naming a per-task variable is skipped, not guessed at.** `harness/{id}/{task.id}`
   has no single value at run start — it becomes one range per task only when `tasks.yaml` is
   expanded, and `ctx.vars` cannot resolve it in the preflight. Materialising a literal
   `harness/T-1/{task.id}` would reject a valid flow at run start. It is therefore left to step time
   under the same earliest-possible limit a deferred range carries, with its shape still checked for
   free by the AC-10 lint rule. The skip is gated on `perTask`, so **an outer step's unresolved
   range still fails at the preflight exactly as it always did** — I did not widen existing
   behaviour to get this.

### How it is proven

New scenario **E17** in `spike/test/q0035-empty-range.js`, from both sides:

- a `fan_out` template carrying an empty range fails with **zero** adapter invocations, and the
  message starts `build.step:` — the label lint uses;
- a valid template range is materialised **once**, counted rather than assumed. `materialiseDiff`
  appends a `diff truncated range=…` line to `runs.log` whenever it truncates, so a small
  `max_diff_bytes` turns each materialisation into one durable, countable record: one for the
  preflight, or one per task without the fix. The test asserts exactly one;
- and the one materialisation reached **both** members of the wave byte for byte, read from the
  `prompt.txt` each adapter was actually handed (new `adapterPrompts` helper, via the manifest's
  `occurrence_dir`). Counting alone is not enough — a count of one proves nothing if the evidence
  never arrived.

**I mutation-checked this.** With the template site disabled in `diffSitesOf`, E17 fails and every
other scenario still passes; restored, all 17 pass. The test has teeth.

The fixtures' templates declare `branch: harness/{id}/{task.id}` and `base: harness/{id}/integration`
like the shipped `development.yaml`, because a template without them lands every task on
`harness/{id}/{step.id}` — which for the default template id contains a colon and is not a legal ref.
Without that the fixture would have failed on git plumbing rather than on the thing under test.

---

## Finding 2 — `spike/test/q0035-empty-range.js:355`, E10's AC-8 table

**Both halves confirmed.**

**The indeterminate case was genuinely absent.** E10's table covered AC-4.1, 4.2, 4.3 and a missing
ref, but not AC-4.4 — which is the one case the old `catch` rendered as 4.2 or 4.3, so a regression
reintroducing the confident negative would have passed every other row. Added, on a **genuinely
shallow clone** rather than a simulated one: `fixture()` gained a `{ shallow: true }` option that
builds an origin, clones it at `--depth 1`, and asserts `rev-parse --is-shallow-repository` is
`true` before proceeding. The ticket branch is a later commit holding the same tree as `main`, so
the range is empty, the ancestry check really exits 1, and the truncated history cannot disprove
ancestry.

**The malformed case was lint-only.** The unrelated-ref case already ran through the engine and
counted adapter occurrences; the two-dot malformed case was checked only through `lintFlow`. Both
now do both: lint refuses the flow before the run, and — if one is smuggled past lint — the run
fails at the guard with **zero** adapter invocations, asserted for each value.

I also tightened the table itself: every row now carries an `expect` regex, so each case asserts it
produced *its own* diagnosis rather than merely failing, and every row asserts the forbidden-synonym
list. A run that failed for the wrong reason used to pass this scenario.

---

## Finding 3 — `spike/test/q0035-empty-range.js:413`, deferred ranges

**Confirmed.** E11 covered only the deferred range that comes out empty and contained. AC-9 names
three outcomes. Two new scenarios:

**E15 — deferred and indeterminate.** A shallow fixture where the implement branch already exists
from an earlier round, one commit ahead of the ticket branch and holding the same tree. The
producing adapter runs, the consuming one does not, the full AC-1 evidence set is asserted through
`assertEvidence`, the outcome is `indeterminate (shallow clone)`, the step that owed the branch is
still named, and neither `→ contained` nor `→ not contained` appears. This was the one place a
confident negative could still have survived, since the deferred path is the only one E4 does not
reach.

**E16 — deferred and unresolvable**, in two shapes:

- **(a) the realistic one.** `chore.yaml` reviews `integration...implement`, and on a ticket's first
  pass the integration branch does not exist yet — its integrate step runs *after* the review. The
  range is still deferred on `implement`; the endpoint that fails is the other one. Producer billed,
  consumer not; the `review requires an integrated branch` phrase is preserved; the resolving
  endpoint's short SHA is present. It also asserts that **no step is blamed for the endpoint it did
  not owe** — crediting the deferring step there would be the same overstatement this ticket exists
  to remove, one field along.
- **(b) the owed endpoint itself missing,** which is the shape the reviewer asked for and which
  exercises the `deferred?.ref === ref` branch in `materialiseDiff`. See the caveat below — I want
  this one read with open eyes.

---

## Two things I am flagging rather than deciding

**1. E16(b) encodes a flow-authoring mistake, because that is the only route to the code path.**
I traced every way a deferred endpoint can be missing at step time. `ensureWorktree` creates its
branch unconditionally, and `runIntegrate` creates its `into` branch, so in the current engine a
step that the preflight records as a producer essentially always delivers. The one exception is a
step recorded as a producer that creates nothing under that name — and the honest instance is a
`fan_out` step declared `worktree: true`: the preflight remembers `harness/{id}/<step id>` from
`s.worktree`, while `runFanOut` creates task branches. E16(b) uses that. The producing adapter runs
and is billed, the consumer is not, and the message says `step "build" was expected to create
harness/{id}/build` — which is precisely AC-9's purpose clause working.

I think that is defensible: the diagnostic's job is to make such a mistake legible, and an untested
error branch is where defects live. But it is a fixture built on a flow nobody would ship, and if
you would rather the suite not encode one, the alternative is to drop E16(b) and accept that the
`deferred?.ref === ref` clause stays uncovered. That is your call, not mine.

**2. A preflight gap I found and did not fix.** A step that diffs a fan-out **task** branch —
`{base}...harness/{id}/<task id>` — is classified as pre-existing, because `remember` records only
`s.worktree` steps and `integrate` targets, and the preflight cannot enumerate task ids without
loading `tasks.yaml`. Such a flow would fail at run start with a missing ref even though the fan-out
would have created the branch. This is the "preflight overreach" the requirement's risk list names,
in a place the requirement does not cover: no shipped flow does it, no acceptance criterion mentions
it, and closing it means teaching the preflight to read `tasks.yaml` — which may not exist yet at
run start. **Reporting rather than choosing.** It belongs in a follow-up ticket if you want it.

---

## Files changed this round

| File | Change |
| --- | --- |
| `spike/src/engine.js` | Added `diffSitesOf`; the preflight now visits a `fan_out` step's `step:` template, skipping only a range whose per-task variable cannot resolve at run start. No other behaviour touched. |
| `spike/test/q0035-empty-range.js` | `fixture()` gained a `{ shallow }` option and `run()` a repo-config override; added `adapterPrompts` and `seedTasks` helpers; E10 gained the AC-4.4 indeterminate row, per-row diagnosis assertions and adapter-boundary counting for malformed and unrelated ranges; new E15, E16, E17. |
| `docs/02-sdlc-pipeline-spec.md` | §5.5 gained one paragraph on how a `fan_out` template's range is judged and the per-task exception, so the prose matches the code; status line updated. |

`seedTasks` writes both `tasks.yaml` and the role its tasks name, deliberately: without them a
regression that skipped the preflight would die in `loadTasks` and the zero-invocation assertions
would pass for the wrong reason.

## What I deliberately left alone

- **The range guard.** Non-goal, settled by Q-0034. Unchanged.
- **`containment()` and every `q0036-board-containment.js` scenario.** AC-3 requires them to pass
  unmodified; they do, untouched. The shared `ancestry()` primitive is unchanged this round.
- **The empty-range message, `emptyRangeFailure`, `materialiseDiff`'s guard and missing-ref
  messages, and the AC-10 lint rule.** Iteration 2 raised nothing against them.
- **The DECISIONS entry (AC-12).** Iteration 1's finding against it was closed last round and not
  re-raised; an append-only entry should not be churned without a finding.
- **`--dry` handling, truncation, `max_diff_bytes`, the UTF-8 trim.** Untouched; E8 and E12 still
  pass unmodified.
- **`runs.log` and the run manifest.** OQ-2 defers adding diffed SHAs; `run-manifest.schema.json`
  stays frozen. E17 reads the *existing* truncation line and the *existing* `occurrence_dir`, adding
  no field to any persisted format.
- **`docs/DECISIONS.md` as a decision.** Nothing here implies a new one. The two items above are
  observations for the human, not decisions I took.

## Verification

`npm test` in `spike/`: **all 11 test files pass**, 17 Q-0035 scenarios green, and the
mock-adapter end-to-end regression suite and `q0036-board-containment.js` unchanged and green. The
shipped flows in `harness/flows/` and `spike/templates/harness/flows/` are asserted to pass
`validateFlowDirectory` unchanged by E9 and E14, and the smoke test's "lint passes on shipped flows"
check is green. Nothing outside the three files above is modified, and I committed nothing.

The requirement's own risk note still stands and is worth repeating at the gate: **this ticket's
chore run does not exercise the change** — `harness run` executes the engine from the invoking
checkout while this work sits in a worktree, so the review step's diff is materialised by the old
`materialiseDiff`. The tests are the proof; the run is not.
