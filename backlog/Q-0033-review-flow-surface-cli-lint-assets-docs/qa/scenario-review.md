*Architecture reviewer, round 2 run 6. Ticket Q-0033, stage `solutioned`. Reviewing `qa/scenarios.md` and `qa/red-report.md` against `requirements/merged.md`, `solution/tasks.yaml`, `solution/errata.md` (E-1, E-2), `contracts/Q-0033/*`, and the frozen `contracts/Q-0006/*` at baseline `5d16e06`. Traced against the actual branches and files, not against the documents alone.*

**Verdict: revise.**

---

## 1. What the gate asks, and where this round stands

Two questions decide this gate: does every acceptance criterion have at least one scenario, and does the red report show the suite failing on assertions rather than compile errors.

**Coverage passes, with one gap.** Twelve of thirteen criteria have executable scenarios; AC11 does not (§4). The three criteria with no runnable assertion — S3.5, S12.1, E2 — are each logged as `- SKIP` with a reason rather than an unqualified `✓`, which is exactly what the previous round asked for and what makes this report readable at all.

**No compile failures.** All three test files load and execute. `q0033-surface.js` imports `lintFlow` from `../src/engine.js`, which resolves on `main` as well as on the branch, so the file would still run against a clean base. Nothing here is red because it failed to parse.

**Red is not proven.** This is the blocker, and it is the same blocker as round 1.

---

## 2. Blocker — the suite is green on every new scenario, because it was measured against the implementation

`qa/red-report.md:81` opens the `q0033-surface.js` section. Counting what follows: **21 ✓, 3 SKIP, 0 ✗.** Not one new scenario is red. The only failing assertion in the entire report is in `smoke.js` (§3), and `qa/red-integration.md` records `npm test --prefix spike → exit 1 (expected fail) → OK` on the strength of it.

The cause is that `harness/Q-0033/integration` was never reset. It still carries the development merges from the aborted run 4:

```
$ git diff --name-status main harness/Q-0033/integration
A  contracts/Q-0033/cli-review-surface.contract.md
A  contracts/Q-0033/documentation-and-evidence.contract.md
A  contracts/Q-0033/review-surface-assets.contract.md
M  docs/02-sdlc-pipeline-spec.md      M  docs/06-development-plan.md
M  docs/DECISIONS.md                  M  docs/GLOSSARY.md
A  harness/flows/review.yaml          A  harness/roles/code-reviewer.md
M  harness/harness.yaml
M  spike/bin/harness.js               M  spike/src/engine.js
A  spike/src/lint.js
A  spike/templates/harness/flows/review.yaml
M  spike/templates/harness/harness.yaml
A  spike/templates/harness/roles/code-reviewer.md
A  spike/test/q0033-surface.js        M  spike/test/smoke.js
```

Everything above the two test files is implementation this ticket has not yet developed. On `main`: `harness/flows/review.yaml`, `harness/roles/code-reviewer.md`, `spike/src/lint.js` and both template copies **do not exist**; `harness/harness.yaml` has **no** `repo.max_diff_bytes`; and `--gate-answer` appears **nowhere** in `spike/bin/harness.js`. Against that base, S1.1 fails on a missing file, S2.1 fails on a missing file, S4.1 fails on a missing key, S9.x and S10.x fail on an unknown flag, S13.x fail on unwritten docs. Every one of them passes on the branch as measured, for the single reason that the code they test is already merged into it.

`qa/scenarios.md:5` names this precondition in its own preamble — *"`harness/Q-0033/integration` must be reset to `main` + `contracts/Q-0033/` before red is re-proven"* — and it was not done. Two consecutive rounds have now measured red against a branch containing the answer.

### The reset is bigger than last round diagnosed

Resetting the integration branch alone would **not** have worked, and this is the part worth carrying forward. `harness/Q-0033/tests` — the branch `prove-red` merges in — carries the identical sixteen implementation files:

```
$ git diff --name-only main harness/Q-0033/tests | grep -v '^spike/test/'
contracts/Q-0033/*.contract.md   docs/{02,06,DECISIONS,GLOSSARY}
harness/flows/review.yaml        harness/roles/code-reviewer.md
harness/harness.yaml             spike/bin/harness.js
spike/src/engine.js              spike/src/lint.js
spike/templates/harness/...
```

`harness/Q-0033/tests` was cut from the contaminated integration branch (`cbdcc9d`, `528c7f0`, `8cedc2b` are all merges of integration into tests). A clean integration branch would re-import the whole implementation the moment `prove-red` merged tests into it, and the report would come back green again.

**Both branches must be re-cut**, from `main` plus `contracts/Q-0033/` only, with `harness/Q-0033/tests` carrying exactly two files: `spike/test/q0033-surface.js` and the `spike/test/smoke.js` edits. Before re-proving, the check to run is:

```
git diff --name-only main harness/Q-0033/tests
# must list only: contracts/Q-0033/*, spike/test/q0033-surface.js, spike/test/smoke.js
```

Until that command returns that list, the red report says nothing about redness — it says the implementation is present.

---

## 3. Blocker — the one failing assertion is red for the wrong reason

`qa/red-report.md:111`:

```
✗ an interrupted run is recorded in runs.log
✗ smoke.js exited 1
```

This is `spike/test/smoke.js`'s interrupt-at-a-gate test, and it is **byte-identical between `main` and the branch** — this round changed only the retry-semantics block at `:193-212`. It spawns the run with `stdio: ['pipe', 'pipe', 'pipe']`, waits for it to block at the closing `gate: human`, sends `SIGINT`, and asserts an ` interrupted ` line reaches `runs.log`.

AC10 as implemented on the branch makes that impossible. `spike/bin/harness.js:77` now reads:

```js
if (!process.stdin.isTTY) throw new FlowError(`gate (${kind}) "${reason}" needs an answer and stdin closed without one — pass --gate-answer …`);
```

and it fires **before** `readline` is created. A pipe is not a TTY, so the run no longer waits — it throws the moment the gate is presented, records `failed`, and exits. `SIGINT` arrives at a process that is already gone, ` interrupted ` is never written, and the 20-second `waitFor` times out. The preceding assertion, `✓ the interrupt fixture reaches the gate`, confirms the run got that far and then did not stop.

So the sole evidence of red in this round is a pre-existing test broken by the ticket's own design, in a file no development task may touch. That is red for the wrong reason twice over: it proves nothing about the new scenarios, and it is precisely the shape that ended run 4 — a failure in `spike/test/**` that every task is forbidden to fix, which the DECISIONS entry of 2026-08-23 exists to catch *at this gate*.

---

## 4. Blocker — AC11 has no scenario for the third piped-stdin site

`qa/scenarios.md` enumerates two piped-stdin gate sites in `smoke.js`: S11.2 (`:82-85`, exhaustion) and S11.7 (`:185-220`, retry semantics). The interrupt test at roughly `:215-245` is a **third**, it is broken by the same AC10 rule, and no scenario covers it. `qa/scenarios.md:445`'s S11.1 asserts the opposite — *"the full suite passes end to end"* — which is now false by construction.

It is also not fixable the way the other two were. S11.2 and S11.7 were mechanical: stop piping, pass `--gate-answer`. This test's entire purpose is that **nobody answers** and the process is interrupted while waiting. Supplying an answer deletes the scenario.

Three ways out, and the choice is a judgement this document must make rather than leave to `write-tests`:

- **Restate the property, keep the invariant.** Q-0004's actual finding was that Ctrl-C at a gate "wrote no outcome and no counters, silently refunding the iteration budget". Under AC10 a non-TTY run that reaches an unanswered gate now *terminates by itself*, and the property worth pinning is unchanged: it records a terminal outcome and persists its counters instead of refunding them. Assert `failed`/`aborted` in `runs.log` plus the persisted `requirements.head-of-product` counter, and drop the `SIGINT` mechanism — which AC10 has made unreachable on a pipe. **This is my recommendation.** It costs one thing, and the document must say so out loud: SIGINT-at-a-gate stops being covered by the suite. The invariant still holds for a human at a real terminal; only the test for it goes.
- **Allocate a pty.** Preserves the exact coverage, needs `node-pty` (a new dependency, which AC11 forbids) or `script -q`, whose flags differ between BSD and GNU and so breaks portability. Reject.
- **Interrupt during a step instead of at a gate.** Keeps SIGINT covered, but mock steps complete in ~20ms, so the fixture would be a race. Reject unless a deliberate delay switch is added to `mock.js` — which is exactly the `Q0033-mock` scope S3.5 correctly argued should be dropped.

Whichever is chosen, `spike/test/**` is qa-red's own artifact: this is qa-red's edit to make in the next round, not a task's, and S11.1's wording must change with it.

---

## 5. Major — the per-scenario reporting rule is stated but not implemented

`qa/scenarios.md:14` restates the rule the previous review's §3.5 raised: *"Report per scenario, or accumulate failures within a group and print all of them — never let one failing assertion inside a `scenario()` group hide whether its siblings passed."*

The harness is unchanged:

```js
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
}
```

One `try`/`catch` per group; the first throw abandons the rest. **21 groups carry roughly 60 scenario IDs.** `S6.2-S6.10` runs seven negative fixtures in a loop behind one label. `S10.1-S10.7/E3/E4` drives eight independent CLI invocations behind one. `S5.1-S5.7/E5` covers eight. When the branch is finally clean and these go red — as most of them should — the report will print one line per group naming one message, and no reader will be able to tell whether the other six fixtures in that group were red for the right reason or never ran.

That matters more in the next round than it did in this one. This round's report is unreadable because everything passed; next round's will be unreadable because everything fails and each group reports a single arbitrary first failure. Collect failures inside the group and print them all, or split the groups.

---

## 6. Nit — S13.1's arrow check is brittle in a way that will read as a docs bug

`S13.1` asserts on column arithmetic over ASCII box-drawing: it finds the `review fail` label line, computes `stages.indexOf('red')`, and requires some line to carry `▲` or `│` at that exact character offset. It is a genuine improvement on the previous single-line regex, and it does close the gap the last review named. But it will fail on a diagram that is correct and merely re-spaced by a character, and the failure message — `review failure arrow must terminate at red` — will point the reader at the arrow rather than at the whitespace. Worth a tolerance of ±1 column, or an assertion that the arrow's column falls between the `red` and `green` labels rather than exactly on `red`.

---

## 7. What is right, and should survive the next round

Not much of the substance needs redoing, and it is worth being explicit about that so the next round does not re-litigate settled work.

- **S3.5 is handled correctly.** Rewriting the `Q0033-mock` scenario as a finding rather than fabricating an assertion against `mock.js`'s current source is the right call, and the recommendation to drop `Q0033-mock` from `tasks.yaml` still stands — S3.2 and S3.3 prove both stage transitions with no change to the file.
- **The three unassertable items log as `- SKIP`.** S3.5, S12.1 and E2 print a reason instead of a checkmark. That was the previous review's §4 and it is fixed.
- **S11.7 is a real find.** The retry-semantics rewrite at `smoke.js:193-212` is correct: `--gate-answer retry` for the first gate, no answer for the second, `spawnSync` with a timeout, and all four original assertions preserved. Against a clean `main` it is genuinely red — `--gate-answer` does not exist there, so the flag is ignored, the gate errors on closed stdin, and `traversals` is 2 rather than 3.
- **S9.3's exact-equality diagnostic** (`assert.equal(diagnostic(lint), diagnostic(run))` after stripping ANSI and the leading `✗`) is the right strengthening of "both contain `missing`".
- **S7's non-verdict fixture** — the `plain` flow with an ordinary step's `on_fail` — closes the scope-narrowing the previous review flagged in §5.
- **S13.8 and S11.5 both anchor to `5d16e06`** rather than `HEAD`, with an explicit skip when the baseline is unreachable.

---

## 8. Coverage map as verified

| AC | Scenarios | Executable | Status |
|---|---|---|---|
| 1 | S1.1–S1.4 | yes | covered |
| 2 | S2.1–S2.5 | yes | covered |
| 3 | S3.1–S3.4 (+S3.5 finding) | yes | covered |
| 4 | S4.1–S4.3 | yes | covered |
| 5 | S5.1–S5.7 | yes | covered |
| 6 | S6.1–S6.10 | yes | covered |
| 7 | S7.1–S7.8 | yes | covered |
| 8 | S8.1–S8.5 | yes | covered |
| 9 | S9.1–S9.4 | yes | covered |
| 10 | S10.1–S10.7 | yes | covered |
| 11 | S11.1–S11.7 | partial | **gap — §4** |
| 12 | S12.1 | manual by design | covered |
| 13 | S13.1–S13.8 | yes | covered |

No criterion is unscenarioed outright; AC11's set is incomplete.

---

## 9. What the next round must do

1. **Re-cut both branches.** `harness/Q-0033/tests` from `main` + `contracts/Q-0033/`, carrying only `spike/test/q0033-surface.js` and the `spike/test/smoke.js` edits; `harness/Q-0033/integration` likewise. Verify with `git diff --name-only main harness/Q-0033/tests` before running `prove-red`, and paste that output into `qa/red-integration.md` as evidence — the report should prove its own base is clean rather than asking a reader to trust it.
2. **Resolve the interrupt test** per §4, and amend S11.1 to match. State in the scenarios document which of the three options was taken and what coverage it costs.
3. **Make the group harness accumulate**, so the next report — which will be almost entirely red — says which scenarios are red and why.
4. Optionally, loosen S13.1's column arithmetic.

Nothing in §7 needs re-deriving. The scenario content is sound; the round fails on the branch it was measured against and on one uncovered site in a file only qa-red may touch.
