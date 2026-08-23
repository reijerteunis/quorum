# Scenario review — Q-0033, qa-red (round 2)

*Reviewer: architecture-reviewer. Reviewing the revised `qa/scenarios.md`, `spike/test/q0033-surface.js` and the `smoke.js` edits on `harness/Q-0033/integration`, against `qa/red-report.md`, `qa/red-integration.md`, `requirements/merged.md` (13 criteria), `solution/tasks.yaml` (five tasks), `solution/errata.md` (E-1…E-3), the frozen `contracts/Q-0006/**` and `contracts/Q-0033/**`, and the code on `main` at `8bc60d0`. Line numbers are the branch's, not `main`'s. Every claim was checked against a file.*

**Verdict: revise.** One blocker, two majors, four nits. Coverage is complete, the red is red for the right reason, and round 1's blocker is half-closed: the E8 rewrite survives development and does not survive the merge.

---

## 1. Satisfiability first

The two questions the role asks before anything else — *can any task fix this?* and *will it still pass once the feature exists?* — are answered per failing group below. Ownership is now clean; the second question is where the blocker is.

| Failing group | Fix lies in | Owned by |
| --- | --- | --- |
| `S1.1/S1.2/S1.4`, `S1.3`, `S2.1-S2.5`, `S3.1`, `S3.2/S3.3` | `harness/flows/review.yaml`, `harness/roles/code-reviewer.md` + template copies | `Q0033-assets` (+`Q0033-cli` for the gate answer) |
| `S4.1-S4.3/E6` | both `harness.yaml` files | `Q0033-config` |
| `S5.1-S5.7/E5`, `S10.*`, `S11.1-S11.4`, two `smoke.js` assertions | `spike/bin/harness.js` | `Q0033-cli` |
| `S6.2-S6.10`, `S7.1-S7.7`, `S8.1-S8.4` | `spike/src/lint.js` + the lint portion of `engine.js` | `Q0033-lint` |
| `S9.1-S9.4/E1` | both of the above | `Q0033-cli` + `Q0033-lint` |
| `S13.1`–`S13.7` | `docs/02`, `docs/06`, `DECISIONS.md`, `GLOSSARY.md` | `Q0033-docs` |

I checked the four that could plausibly have had no owner, because that is what ended the last development loop:

- **`S10.1`'s log lines exist already.** `gate=${kind} answer=${answer}` is written by `spike/src/engine.js:330` and `gate=retry counter=… set=…` by `:339`. The CLI supplying the answers is the whole of what is missing, and no task needs to touch engine gate logging.
- **`S11.1`'s `pkg.scripts.lint` exists** (`spike/package.json`), so the group is not asking for a file nobody owns.
- **`S3.2`/`S3.3`/`S10.7`/`E7` run on the mock unchanged.** `schemaFor` gives the verdict step an enum, and `spike/src/adapters/mock.js` returns `opts[0]`/`opts[last]` with the findings shape under `MOCK_ALWAYS_PASS`/`MOCK_ALWAYS_FAIL`. E-3's reason for dropping `Q0033-mock` holds.
- **`S10.7`'s arithmetic is right.** Seeded `review: 3` with `max_iterations: 3`: the first `changes-requested` exhausts, `retry` persists `3` (errata E-1) and logs `gate=retry counter=review set=3`, and the cross-flow `goto` regresses and ends the run before any further increment — so `review: 3` is what the ticket holds, not `4`. The trailing `--gate-answer abort` is deliberately unconsumed, which is what `E7` then asserts is harmless.

## 2. Coverage — every criterion has a scenario

| AC | Scenario(s) in the suite | Owning task | Status in the report |
| --- | --- | --- | --- |
| 1 | `S1.1/S1.2/S1.4` (:100), `S1.3` (:114) | `Q0033-assets` | ✗ assertion (`review.yaml must ship`) |
| 2 | `S2.1-S2.5` (:119) | `Q0033-assets` | ✗ assertion |
| 3 | `S3.1` (:137), `S3.2/S3.3` (:143), `S3.4` folded into `S1.3` | `Q0033-assets` | ✗ assertion |
| 4 | `S4.1-S4.3/E6` (:156) | `Q0033-config` | ✗ assertion |
| 5 | `S5.1-S5.7/E5` (:173) | `Q0033-cli` | ✗ assertion |
| 6 | `S6.2-S6.10` (:194), `S6.1` in `S1.3` | `Q0033-lint` | ✗ 6 of 8 fixtures (2 positive controls green) |
| 7 | `S7.1-S7.7` (:210), `S7.8` in `S8.2` | `Q0033-lint` | ✗ S7.4–S7.7 (S7.1–S7.3 already enforced) |
| 8 | `S8.1-S8.4` (:222), `S8.5` in `S1.3` | `Q0033-lint` | ✗ S8.1, S8.3 (S8.2, S8.4 green) |
| 9 | `S9.1-S9.4/E1` (:241) | `Q0033-cli` + `Q0033-lint` | ✗ assertion |
| 10 | `S10.1-S10.7/E3/E4` (:257), `S10.5` skip (:295) | `Q0033-cli` (+`assets` for S10.7) | ✗ 4 of 7 fixtures |
| 11 | `S11.1-S11.4` (:297), `S11.5` (:318); `S11.7`/`S11.8` realised as the `smoke.js` edits | `Q0033-cli`; rest qa-red's own | ✗ assertion + 2 smoke assertions |
| 12 | `S12.1` skip (:389) | manual | SKIP — correct, criterion 12 forbids automating it |
| 13 | `S13.1`–`S13.8` (:328–379) | `Q0033-docs` | ✗ 6 assertions, `S13.8` green |

No criterion is uncovered. `S11.5` and `S13.8` are the two guards that must stay green and are green.

## 3. The red is red for the right reason

- **No compile or import failure.** Both files run to completion and print their rosters; `test/run.js` reports `2 of 3 test file(s) failed`, the third being Q-0006's own suite, which passes. `import { lintFlow } from '../src/engine.js'` (`q0033-surface.js:10`) still resolves against `engine.js:22` — see the second major for why that is luck rather than a guarantee.
- **Every failure carries its own reason.** `checkFixtures` (:23) reports per fixture before failing the group, and `smoke.js`'s `assert` accumulates rather than exiting on the first failure (`:17-21`), which is why nineteen groups and two smoke assertions are legible in one run instead of one.
- **The two `smoke.js` failures are `Q0033-cli`'s.** `--gate-answer retry` on `requirements` (`max_iterations: 1`) is currently an unknown flag, so the run dies at the first gate with two traversals and no `gate=retry` line — exactly `saw 2, expected 3` and the missing `set=1`. Once the flag lands, three traversals, `set=1`, persisted `2` and the unrefunded `qa-final.unrelated: 2` all follow from the engine already on `main`.
- **`prove-red` did not mistake a broken environment for red.** `install exit 0`, `tests exit 1`, and the environment-failure detector did not fire; `qa/red-integration.md` records base `main` and the tests branch at `65f0cdb`.

## 4. Round 1's findings are closed, except half of the blocker

`S9.3` now compares only the offending flow's `✗ <file>` block and its `- ` lines (`flowDiagnostic`, :38) — which matches what `spike/bin/harness.js:135` actually prints, so it is satisfiable by a preflight that reports and stops. `E9`'s skip now names the `smoke.js` coverage that exists on `main`. `S10.5` has its skip line. `E7` has the `review.yaml` precondition. The four `S6` fixtures carry their ids again. All correct, and all verified against the files.

## 5. Findings

### Blocker — `E8` is still phase-bound; the rewrite only moved the phase

`spike/test/q0033-surface.js:392-401`:

```js
const e8MergeBase = git(repo, 'merge-base', 'main', 'HEAD');
const e8Paths = git(repo, 'diff', '--name-only', e8MergeBase, 'HEAD').split('\n').filter(Boolean);
const e8ProductionPaths = e8Paths.filter((f) => !/^(contracts\/Q-0033\/|spike\/test\/)/.test(f));
if (e8ProductionPaths.length) skipped('E8', …); else await scenario('E8', …assert.ok(e8Paths.includes(…))…);
```

The revision fixed the development case: once the five tasks land, the diff carries production paths and the named skip fires. It does not survive the step after that. **On `main` once Q-0033 merges**, `git merge-base main HEAD` is `HEAD`, so the diff is empty; `e8Paths` is `[]`, `e8ProductionPaths` is therefore also `[]`, the skip does **not** fire, and `assert.ok([].includes('contracts/Q-0033/cli-review-surface.contract.md'))` throws. `npm test --prefix spike` is then red on `main` permanently — which means the next ticket's `integrate --expect pass` can never reach green, and its `prove-red` is red for a reason that has nothing to do with its own tests. No task on any future ticket owns `spike/test/q0033-surface.js`.

Two smaller edges of the same code, worth fixing in the same stroke: the `git` calls at `:392-393` are at module top level and outside `scenario()`, so in a checkout without a local `main` ref — a shallow CI checkout, a detached-HEAD PR build — the file dies before a single scenario runs, and the failure has the shape of a compile error rather than an assertion.

**The remedy is the one the standing decision names**, and it is smaller than the current code: delete the assertion and keep `:395`'s `console.log` of the merge-base and path list as evidence, copying it into `qa/red-integration.md` where phase-bound facts belong. The provenance record survives; nothing in the suite depends on which branch it is running from. This is the third round in which this shape has been found, and the earlier two each cost a full loop.

### Major — the frozen-input guards fail where their own contract says they must skip

`spike/test/q0033-surface.js:318` and `:376` both open with `git(repo, 'cat-file', '-e', '5d16e06^{commit}')` **inside** `scenario()`, so an unreachable baseline is caught by the scenario wrapper and recorded as `✗`, not as a skip. Both `contracts/Q-0033/review-surface-assets.contract.md` ("If `5d16e06` is unreachable in a shallow clone, the guard skips and prints a reason naming the unavailable baseline") and `qa/scenarios.md` S11.5 ("reports `SKIP: 5d16e06 unreachable in this clone` rather than failing, since an unavailable baseline is not evidence of drift") require the opposite. Today `5d16e06` is reachable, so both are green and the gap is invisible — which is precisely how this class of defect survives a gate.

Worse, `:322-324` gives the roster a `SKIP S11.6: baseline 0000…0033 unavailable` line produced by a `try`/`catch` around a **fabricated** SHA that no guard consults. It reads as proof that the fallback works; it exercises none of the guard code. Wrap the two real guards in the try/catch the contract describes and delete the decoy, or reuse S11.6's id for its documented purpose.

### Major — the suite pins `lintFlow` to `engine.js` while `Q0033-lint` is told to move it out

`spike/test/q0033-surface.js:10` statically imports `lintFlow` from `../src/engine.js`, and `smoke.js` does the same for `lintFlow`/`FlowError`. `solution/tasks.yaml` instructs `Q0033-lint` to "own `spike/src/lint.js` (new) … Move the flow rules out of the engine into their own module", and neither `contracts/Q-0006/review-lint.contract.md` nor `contracts/Q-0033/cli-review-surface.contract.md` says `engine.js` must keep exporting `lintFlow`. An agent that reads the task literally and moves the export is within its instructions — and both test files then die at link time, before any assertion, with an error whose text (`does not provide an export named`) the environment-failure detector does not recognise. `integrate` reads it as an ordinary red, the scoped retry sends the same agents back, and no development task may edit the tests to reveal why.

One sentence in `solution/errata.md` — `spike/src/engine.js` continues to re-export `lintFlow` and `FlowError` for the suites that import them — closes it before it costs a round. Stating it in the erratum rather than in the test is the right side to fix, because the constraint is on the implementation, not on the scenario.

### Nit — the roster and the suite have drifted apart again

`:154` skips `S3.5` and `:390` skips `E2`; neither id exists in `qa/scenarios.md`. `:324` reuses `S11.6`, which the document defines as "SKIP: covered by AC12 (manual)". `:381`'s `E7` asserts that unconsumed `--gate-answer` values are ignored after a gate-free regression — a real and useful assertion, but the document's `E7` is only the `review.yaml`-exists precondition. The document is what this gate approves and what the next reader diffs against; four ids that mean different things in the two files is the same lookup cost every round.

### Nit — two fixtures assert wording the contracts do not pin

`:200`'s cycle fixture requires the literal word *cycle* (`/source.*a.*cycle/is`) while `:202`'s self-target fixture requires dead-end wording for a case that is also a repeated pair. `review-lint.contract.md` calls a repeated pair "a cycle" in its own prose, so this is defensible — but it obliges `Q0033-lint` to guess a token rather than satisfy a stated requirement, and a wrong guess costs a development round to discover. Widen to `/cycle|repeat|already visited/` or put the word in the erratum.

### Nit — `S13.1` judges a document by column arithmetic over ASCII art

`:328` requires a line matching `/review fail/i`, a stage line, and a `└─…─┘` run on that line or an adjacent one, whose two endpoints fall inside computed column bands for `red` and `reviewed`. It is a fair reading of the criterion and the current `§3.4` diagram supports it — but a correct diagram drawn in any other style (arrowhead above the label, `┴` junctions, a rewritten block) fails, and `contracts/Q-0033/documentation-and-evidence.contract.md` asks only that the docs "route rejection to the derived target stage". Consider also accepting an explicit textual statement of the edge, so a correct document cannot fail on connector glyphs.

### Nit — `smoke.js` drops the SIGINT-at-a-gate regression without recording it

`spike/test/smoke.js:218-231` replaces the interrupt fixture with a non-TTY unanswered-gate fixture. The reasoning in the comment is right — once AC10 lands, a pipe can never wait at a gate, so the old mechanism is unreachable — and the replacement re-asserts all three properties that mattered (terminal outcome in `runs.log`, stage unchanged, counter not refunded). But finding 4 of the DECISIONS entry of 2026-08-22 ("Red for the right reason is an engine property") loses its named regression, and nothing outside a code comment says so. One line in `qa/red-integration.md` keeps the next reader from rediscovering it as drift.

## 6. What is right, and should survive the revision

- The ownership audit. Every one of the nineteen failing groups and both smoke failures maps to a task that owns the file, which is the property the last two development loops lacked.
- `checkFixtures` and the accumulating `smoke.js` `assert`. One run now reports every failure instead of the first, which is what made this review checkable at all.
- `S9.3` scoped to the offending flow's diagnostic block, and `S9.2`'s pristine-versus-overridden pair — the ordering bug in criterion 9 is genuinely tested in both directions.
- `S8.2`/`S8.4`/`S6.2`/`S6.7`/`S10.3`/`S10.6`/`E3` as green positive controls. A suite where every line is red proves less than one that shows which rules must *not* fire.
- The `S2.5` negative control on the roles directories, which stops a future round from writing the whole-directory parity rule that would be false.
- E-3's declined finding. `smoke.js`'s no-answer command and `E4`'s explicit-answer command are different invocations with opposite expectations, and one implementation satisfies both. Nothing to re-litigate.

## 7. What must be true before this passes

1. `E8` no longer asserts anything about the branch it runs from; the merge-base and path list survive as `console.log` evidence and in `qa/red-integration.md`. The `git` calls that produce them cannot crash the file when `main` is not a local ref.
2. `S11.5` and `S13.8` skip — with a reason naming the baseline — when `5d16e06` is unreachable, as their contract and the document both require. The fabricated-SHA `S11.6` decoy goes, or takes its documented meaning back.
3. An erratum records that `spike/src/engine.js` keeps re-exporting `lintFlow` and `FlowError`, so `Q0033-lint`'s extraction cannot silently kill both suites.
4. `qa/scenarios.md` and the suite agree on `S3.5`, `E2`, `S11.6` and `E7`.
5. The cycle fixture accepts any diagnostic that names the repeated pair, or the required word is written into the erratum.
6. `S13.1` accepts a correct diagram that does not use the current connector glyphs, or the docs contract states the convention.
