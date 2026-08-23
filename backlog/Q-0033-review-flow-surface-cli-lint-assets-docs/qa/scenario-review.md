# Scenario review — Q-0033, qa-red

*Reviewer: architecture-reviewer. Reviewing `qa/scenarios.md`, `spike/test/q0033-surface.js` and the `smoke.js` edits on `harness/Q-0033/tests`, against `qa/red-report.md`, `requirements/merged.md` (13 criteria), `solution/tasks.yaml` (five tasks), `solution/errata.md` (E-1…E-3), and the code on `main` at `ce26288`. Every claim below was checked against a file, not against a prior round's summary.*

**Verdict: revise.** One blocker, one major, four nits. Coverage is complete and the red phase is red for the right reason — the blocker is not about what the suite proves, it is about a single scenario that turns permanently red the moment development does its job correctly.

---

## 1. Coverage — every criterion has a scenario

| AC | Scenario(s) in the suite | Owning task | Status in the report |
| --- | --- | --- | --- |
| 1 | `S1.1/S1.2/S1.4` (:93), `S1.3` (:107) | `Q0033-assets` | ✗ assertion (`review.yaml must ship`) |
| 2 | `S2.1-S2.5` (:112) | `Q0033-assets` | ✗ assertion |
| 3 | `S3.1` (:130), `S3.2/S3.3` (:136), `S3.4` (folded into `S1.3`) | `Q0033-assets` | ✗ assertion |
| 4 | `S4.1-S4.3/E6` (:149) | `Q0033-config` | ✗ assertion |
| 5 | `S5.1-S5.7/E5` (:166) | `Q0033-cli` | ✗ assertion |
| 6 | `S6.2-S6.10` (:187), `S6.1` in `S1.3` | `Q0033-lint` | ✗ 6 of 8 fixtures (2 positive controls green) |
| 7 | `S7.1-S7.7` (:203), `S7.8` in `S8.2` | `Q0033-lint` | ✗ S7.4–S7.7 (S7.1–S7.3 already enforced) |
| 8 | `S8.1-S8.4` (:215), `S8.5` in `S1.3` | `Q0033-lint` | ✗ S8.1, S8.3 (S8.2, S8.4 green) |
| 9 | `S9.1-S9.4/E1` (:234) | `Q0033-cli` + `Q0033-lint` | ✗ assertion |
| 10 | `S10.1-S10.7/E3/E4` (:250) | `Q0033-cli` (+`assets` for S10.7) | ✗ 4 of 7 fixtures |
| 11 | `S11.1-S11.4` (:296), `S11.5` (:310), `S11.6` skip (:316); `S11.7`/`S11.8` in `smoke.js` | `Q0033-cli`; rest qa-red's own | ✗ assertion + 2 smoke assertions |
| 12 | `S12.1` skip (:379) | manual | SKIP — correct, criterion 12 forbids automating it |
| 13 | `S13.1`–`S13.8` (:320–371) | `Q0033-docs` | ✗ 6 assertions, `S13.8` green |

No criterion is uncovered. The two guards that must stay green — `S11.5` (frozen `contracts/Q-0006/` unchanged from `5d16e06`) and `S13.8` (README byte-unchanged) — are green, which is what they are for.

## 2. The red is red for the right reason

I looked specifically for the failure modes this ticket has already paid for twice.

- **No compile or import failures.** Both files run to completion and print their rosters. `import { lintFlow } from '../src/engine.js'` still resolves (`spike/src/engine.js:22`), so the extraction caution in the document has not yet been violated. `test/run.js` discovers `q0033-surface.js` and reports `2 of 3 test file(s) failed` — the third file passing is Q-0006's own suite.
- **Every failure carries a reason, per fixture.** `checkFixtures` (:22) prints `✓`/`✗` for each case and only then fails the group, and `smoke.js`'s `assert` now accumulates instead of `process.exit(1)` on the first failure. That is the change the document asked for and it demonstrably worked: nineteen groups reported, not one.
- **Each red traces to an owning task.** I checked the ones that could plausibly have no owner: `S11.1`'s `pkg.scripts.lint` exists already (`spike/package.json`), so it is not asking for a file nobody owns; `S10.1`'s expected log lines (`gate=human-locked answer=advance`, `gate=human answer=abort`) are written by `spike/src/engine.js:325` today, so the CLI supplying answers is all that is missing; `S3.2`/`E7` expect exit 0 on a regressed run, which `spike/bin/harness.js:184` already gives (`aborted ? 2 : 0`); `S9.1`'s `runs.log` assertion is sound because `Backlog.create` never writes one.
- **The two `smoke.js` failures are Q0033-cli's, and the arithmetic works out.** `--gate-answer retry` on `requirements` (`max_iterations: 1`) gives head-of-product three traversals, `gate=retry counter=requirements.head-of-product set=1`, persisted `2`, and `qa-final.unrelated: 2` unrefunded — matching the four preserved assertions. Today it dies at the first gate and sees two traversals, which is exactly the red reported.
- **The E-3 dispute is correctly implemented.** `S11.1`'s no-answer command and `E4`'s explicit-answer command are different invocations with opposite expectations, and one implementation satisfies both. I agree with E-3; there is no contradiction to re-litigate.

## 3. Findings

### Blocker — `E8` cannot survive its own development stage

`spike/test/q0033-surface.js:382-388`:

```js
const mergeBase = git(repo, 'merge-base', 'main', 'HEAD');
const paths = git(repo, 'diff', '--name-only', mergeBase, 'HEAD').split('\n').filter(Boolean);
const allowed = /^(contracts\/Q-0033\/|spike\/test\/)/;
assert.deepEqual(paths.filter((file) => !allowed.test(file)), [], …);
```

This runs in every `integrate` step, because `harness/harness.yaml` sets `commands.test: npm test --prefix spike` and `test/run.js` discovers the file. It passes now, on a branch that holds only contracts and tests. It cannot pass after development: the same integration branch will then also carry `spike/bin/harness.js`, `spike/src/lint.js`, `harness/flows/review.yaml`, `spike/templates/harness/flows/review.yaml`, `harness/roles/code-reviewer.md`, both `harness.yaml` files and four documents — every one of them outside `allowed`. `development.yaml`'s `integrate` asserts `expect: pass`, so the loop fails on `E8` alone, scoped retries send the same five agents back, each correctly reports its own scenarios passing, and the budget burns. The only file that could fix it is `spike/test/q0033-surface.js`, which every task's description forbids.

This is the third appearance of the pattern that produced errata E-1 and E-2 and the DECISIONS entry of 2026-08-23. It has to be closed at this gate.

**The fix is qa-red's, and small.** Keep the provenance evidence — it is genuinely useful and the reasoning for moving it out of `qa/red-integration.md` is right — but make it an assertion about qa-red's *own* contribution rather than about the whole branch. Either assert positively (the expected `contracts/Q-0033/*` and `spike/test/*` paths are present in the diff) and print the rest as evidence via `console.log`, or scope the exclusion check to the red phase, e.g. emit a named `SKIP E8:` line when the diff contains production paths, since at that point development has landed and the check no longer describes anything. Printing the merge-base and the path list (:387) is worth keeping either way.

### Major — `S9.3` compares whole output, not the diagnostic

`spike/test/q0033-surface.js:239`: `assert.equal(diagnostic(lint), diagnostic(run))`, where `diagnostic` (:38) is the entire captured stdout+stderr with a leading `✗` stripped. But `harness lint` prints one `✓ <file>` line per valid flow (`spike/bin/harness.js:135-137`); on the S9.1 fixture that is four `✓` lines before the `✗ bad.yaml` block. A preflight that reports the error and stops — the obvious reading of criterion 9's "reports the identical error" — produces a strict subset and fails this assertion forever. The only way to satisfy it is to make `harness run` reprint the full per-file lint listing on every failed preflight, which no criterion, contract or scenario asks for.

Narrow the comparison to the diagnostic itself: compare the `✗` block for the offending flow (filename plus the `- …` problem lines) rather than the whole stream. Two notes for whoever implements it, since the two files are in scope for `Q0033-cli` and `Q0033-lint` respectively: `lintFlow` throws `flow <name> invalid:\n  - …` (`spike/src/engine.js:71`) and the CLI drops the **first** line of that message when printing (`:136`), so a new whole-directory rule must put its detail on lines 2+ or nothing reaches the output the S6 regexes match against.

### Nit — `E9`'s skip is justified by a claim that is false on the branch under test

`spike/test/q0033-surface.js:390-393` skips `E9` with "the current engine still writes `out.slice(-8000)`, while no Q-0033 task owns `testReport`". That was true of the tests branch's base (`c69cd99`) but not of the branch the suite ran on: `testReport` landed on `main` in `ce26288`, the integration branch merged it, and `qa/red-report.md` in this very folder carries the `## Every result line` roster and `… 13568 characters of output omitted from the middle …`. The document (E9) says the same thing. Coverage is not actually lost — `smoke.js` on `main` carries the five truncation assertions and the report shows them green — so this is a wrong note rather than a hole. Replace it with either the pin E9 asks for or a skip that says "already covered by `smoke.js`'s truncation assertions"; leaving an "OWNERSHIP FINDING" on the record invites the next round to act on it.

### Nit — `S10.5` is neither asserted nor skipped

The document's own rule is that an unassertable scenario logs a skip on its own line, and it names three such cases. `S10.5` (interactive TTY: empty line rejected, unrecognised word re-prompts) is a fourth — it needs a real TTY — but the suite has no assertion and no `SKIP S10.5:` line (`:250-293`). AC10 stays covered by S10.1–S10.4, S10.6 and S10.7, and the behaviour exists today (`spike/bin/harness.js:80-85`); the gap is in the roster, not the coverage. Add the skip line.

### Nit — `E7` omits the precondition its own scenario mandates

`spike/test/q0033-surface.js:373-377` runs `harness run review` without first asserting `review.yaml` exists, which `S10.7` does correctly at `:277`. The result is the report's `✗ Error: ENOENT: no such file or directory, open '…/harness/flows/review.yaml'` — the raw crash the scenario note exists to prevent. One `assert.equal(fs.existsSync(shipped), true, 'review.yaml must ship before E7 can run')`.

### Nit — four `S6` fixtures dropped their scenario ids

`:191-194` label fixtures `dead end`, `ambiguity`, `cycle/repeated pair` and `self target` where the document's ids are S6.5, S6.6, S6.8/S6.10 and S6.9. `S6.2`, `S6.3`, `S6.4` and `S6.7` are labelled correctly. The roster is the artifact the next gate reads; a line that cannot be traced back to a scenario id costs the reader the same lookup every round.

## 4. What is right, and should survive the revision

Stated so the next round does not trade it away:

- Rebuilding AC9's and AC10's fixtures on `requirements.yaml` instead of `review.yaml` is the single best decision in this revision. Its bounded loop (`max_iterations: 1`), its `human-locked` exhaustion gate and its closing `gate: human` give "two gates in one run" for free, and its two-vendor same-role PM panel gives `S9.2`'s override-ordering test a pristine fixture that ships today. Round 4 lost both groups to an `ENOENT` before a single assertion ran; this round they fail on their assertions.
- `S10.1` asserting the ordered `runs.log` shape rather than an exit code — I checked each line against `finish()` and `runGate()` and all four exist with those spellings.
- `S8.1`/`S8.3`'s isolation (panel on `codex`, verdict forced to `claude`) plus the negative assertion on `written by its own vendor`, which is the pre-existing rule's exact wording at `spike/src/engine.js:48`. These fixtures cannot be satisfied by the old rule.
- `S5.5` reproduced as a detached HEAD with an explicit `assert.equal(git(…,'branch','--show-current'), '')` — it proves "git succeeded and named nothing", which is the distinction from `E5`, without the fragility of a mid-rebase fixture.
- `S2.5`'s negative control. I confirmed `diff -rq harness/roles spike/templates/harness/roles` is non-empty today (`developer-backend.md` differs, `developer-tooling.md` is repo-local) and that `diff -rq harness/flows spike/templates/harness/flows` **is** empty, so `S1.1`'s directory-parity assertion is satisfiable by adding `review.yaml` to both and nothing else.
- `S11.7`/`S11.8`'s rewrites of `smoke.js`. Trading the SIGINT-at-a-gate test for a test of what non-TTY behaviour actually guarantees is the right call, and the cost is stated out loud rather than hidden.

Two smaller deviations I checked and am not asking you to change: `S3.2` supplies `--gate-answer abort` where the document says `advance` (the answer is unconsumed either way, and `E7` covers `advance`), and `S9.4`'s multi-flow fixture asserts both diagnostics appear but not the single non-zero exit (not observably distinct from one invocation).

## 5. What must be true before this passes

1. `E8` rewritten so a green development integration branch does not fail it.
2. `S9.3` comparing the diagnostic rather than the whole stream.
3. `E9`'s skip reason corrected, `S10.5` skipped explicitly, `E7` given its precondition, the four `S6` fixture labels given their ids.

Nothing here requires a new scenario, a contract change, or a change to task ownership. Re-run `npm test --prefix spike` after the edits: the expected shape is the same nineteen failing groups, with `E8` green on the tests branch and structured so it stays green — or explicitly skipped — once the five tasks land.
