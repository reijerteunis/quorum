# Scenario review — Q-0033

*architecture-reviewer, qa-red gate. Reviewed: `qa/scenarios.md`, `qa/red-report.md`, `qa/red-integration.md`, and the tests they describe (`spike/test/q0033-surface.js` on `harness/Q-0033/tests`, 267 lines, 16 scenario groups). Checked against `requirements/merged.md`, `solution/tasks.yaml`, `contracts/Q-0033/*`, the frozen `contracts/Q-0006/*` at baseline `5d16e06`, and the code on `main` at `1a1c9cf`.*

**Verdict: approve.** Every acceptance criterion has at least one scenario, and the suite fails on assertions, not on compile errors. The observations in §4 are advisory and do not block development.

---

## 1. Coverage — every acceptance criterion has a scenario

| AC | Scenarios | Test group | Red today? |
| --- | --- | --- | --- |
| 1 shipped `review.yaml` | S1.1–S1.4 | `S1.1/S1.2/S1.4`, `S1.3/…` | ✗ `harness/flows/review.yaml must ship` |
| 2 shipped `code-reviewer.md` | S2.1–S2.5 | `S2.1-S2.5` | ✗ `harness/roles/code-reviewer.md must ship` |
| 3 only fields the engine has | S3.1–S3.4 | `S3.1`, `S3.2/S3.3`, `S1.3/…` | ✗ `review.yaml must ship` |
| 4 config declares the review keys | S4.1–S4.3, E6 | `S4.1-S4.3/E6` | ✗ `max_diff_bytes` absent from both configs |
| 5 `init` discovers the base branch | S5.1–S5.7, E5 | `S5.1-S5.7/E5` | ✗ `base_branch` stays `main` on a `master` repo |
| 6 cross-flow targets and return chain | S6.1–S6.10, E2 | `S6.2-S6.10`, `S1.3/…` | ✗ six named negative fixtures all lint clean today |
| 7 bounds and counter spelling | S7.1–S7.8 | `S7.1-S7.7`, `S1.3/…` | ✗ `Missing expected exception` (`max_iterations: 0`) |
| 8 single-vendor panel | S8.1–S8.5 | `S8.1-S8.4`, `S1.3/…` | ✗ no message naming the members and the shared adapter |
| 9 `run` preflights from disk | S9.1–S9.4, E1 | `S9.1-S9.4/E1` | ✗ `lint` exits 0 on the unresolvable-target fixture |
| 10 gate answers | S10.1–S10.7, E3, E4 | `S10.1-S10.7/E3/E4` | ✗ `--gate-answer` appears nowhere in `bin/harness.js` |
| 11 suite stays green | S11.1–S11.6 | `S11.1-S11.4`, `S11.5/S11.6` | ✗ (migration) / ✓ (frozen-contract guard) |
| 12 real-CLI evidence | S12.1 | `S12.1/E2` | ✓ no-op — manual by requirement |
| 13 docs agree | S13.1–S13.8 | `S13.1-S13.8` | ✗ `§5.5` still shows `{iter}` and pinned models |

No criterion is uncovered. AC12 is the only one without an executable assertion, which is what the requirement demands ("no automated test asserts it") and what `scenarios.md` tags `manual`; the test group that carries it says so in a comment rather than fabricating evidence. That is the right call.

The mapping is honest in both directions: every scenario id in `scenarios.md` (S1.1–S13.8, E1–E6) appears in a group label, and the group labels do not claim criteria the code does not touch — with the two narrow exceptions noted in §4.4.

## 2. The red phase fails on assertions, not on compile errors

`red-report.md` as saved is not sufficient evidence on its own: it begins mid-string, inside one assertion message that dumps most of `docs/02-sdlc-pipeline-spec.md` (`… 9593 more characters`), and the thirteen other failure diagnostics have been truncated away. What survives is the harness summary:

```
✗ 14 Q-0033 scenario group(s) failed
✗ q0033-surface.js exited 1
✗ 1 of 3 test file(s) failed
```

Those lines are themselves meaningful — the per-group counter is printed only after all sixteen groups have run, which is impossible if the module failed to load — but they do not show *why* each group failed. So I re-ran the file from `harness/Q-0033/tests` against `main`'s working tree. Result: 14 failures, 2 passes, first failing assertion per group:

- `S1.1/S1.2/S1.4` — `harness/flows/review.yaml must ship`
- `S1.3/S3.4/S6.1/S7.8/S8.2/S8.5` — no `✓ review.yaml` in `harness lint` output
- `S2.1-S2.5` — `harness/roles/code-reviewer.md must ship`
- `S3.1` — `review.yaml must ship`
- `S3.2/S3.3` — `review.yaml must be copied`
- `S4.1-S4.3/E6` — `Expected values to be strictly equal` (`max_diff_bytes`)
- `S5.1-S5.7/E5` — `Expected values to be strictly equal` (`base_branch` on a `master` repo)
- `S6.2-S6.10` — the `missing` fixture lints clean
- `S7.1-S7.7` — `Missing expected exception`
- `S8.1-S8.4` — no `/member-0.*member-1.*claude/` in the message
- `S9.1-S9.4/E1` — `Expected "actual" to be strictly unequal to: 0`
- `S10.1-S10.7/E3/E4` — no `/gate-answer/` in `bin/harness.js`
- `S11.1-S11.4` — `smoke.js` does not yet pass `--gate-answer abort`
- `S13.1-S13.8` — `§5.5` lacks `{base}...harness/{id}/integration`

Every one is an `assert` on a missing artifact or missing behaviour. No `SyntaxError`, no unresolved import, no `TypeError` from a mis-shaped fixture. `lintFlow` is exported (`spike/src/engine.js:22`) so the file loads; the two other suites (`smoke.js`, `q0006-engine.js`) stay green, so nothing regressed. `red-integration.md` confirms the same shape from the engine's side: base synced, tests branch merged, `install` run in the worktree, `npm test` exit 1 against `expect: fail`.

The two passing groups are non-falsifiable by design and correctly so: `S11.5/S11.6` is a frozen-input guard that must pass, and `S12.1/E2` is the manual-criterion placeholder. Red is therefore 14 of 14 implementable groups.

## 3. What I checked that holds up

Four things could have made this red unsatisfiable — a test that cannot go green without changing the engine, which every task in `tasks.yaml` forbids. None of them bite:

- **Exit codes.** `S10.1` expects `2` on abort and `S3.2` expects `0` on regression. `bin/harness.js:184` is `process.exit(r.status === 'aborted' ? 2 : 0)`. Both match; no engine change implied.
- **Unit fixtures against the frozen contract.** `S7`/`S8` build flows from `contracts/Q-0006/review-flow.contract.yaml` and index `steps[0].parallel` and the `verdict` step. Both exist with that shape, and `lintFlow` returns `true` on success (`engine.js:73`), which `S8.4`'s `assert.equal(lintFlow(mixed), true)` relies on. The three-member fixture duplicates an `output.writes` path; no lint rule forbids that today, so it will not trip the wrong rule.
- **The `§5.5` slice.** `S13.2`'s `doesNotMatch` assertions run against a 1400-character slice that anchors on the real heading at `docs/02-sdlc-pipeline-spec.md:293` and stops at the next `#`. It contains `model: opus` today, so the assertion is genuinely red and correctly scoped rather than accidentally matching a table of contents.
- **The frozen-contract guard.** `S11.5` diffs `contracts/Q-0006/` against baseline `5d16e06` and passes. That is the right anchor.

One premise in the requirement is already stale, in the development team's favour: the empty-answer default AC10 says this ticket removes was removed by Q-0011 (`bin/harness.js:72–83`, with the reasoning in the comment there). `S10.5` and half of `S10.4` are therefore properties of `main` today; the new work is `--gate-answer` accumulation (`bin/harness.js:25` is last-wins) and the `smoke.js` migration, both of which are red. Nothing to change in the scenarios — the assertions still hold — but development should not go looking for a defaulting bug that is no longer there.

## 4. Non-blocking observations

Advisory. None of these justifies another qa-red round; fold what is cheap into development and leave the rest for the review stage.

**4.1 The saved red report loses thirteen of fourteen diagnostics.** `assert.match(spec, re)` over a 30 KB document prints the whole document, and whatever captured `red-report.md` kept only the tail. The consequence is that the artifact of record for this ticket's red phase cannot be used to check red-for-the-right-reason — I had to re-run the suite to review it. The cheapest fix is in the test, not the capture: assert against a slice, or supply the third `message` argument to `assert.match` so the failure prints a sentence instead of the file.

**4.2 `S13.1` cannot fail.** The assertion is `assert.match(spec, /review[\s\S]*red|changes.requested[\s\S]*development/is)`. The first alternative matches `docs/02-sdlc-pipeline-spec.md` as it stands today — I confirmed it returns `true` on `main`. The state diagram in `§3.4` still draws review rejection back to `green`, and this assertion will not notice when it is fixed or if it is not. The scenario is right; the assertion needs to look at the `§3.4` block the way `S13.2` looks at `§5.5`.

**4.3 The README guard cannot fail either.** `S13.8` runs `git diff --name-only HEAD -- README.md`, which compares the working tree to `HEAD`. On a branch where the task has committed its work — which is how every fan-out task ends — that is empty whether or not `README.md` changed. `S11.5` two groups above shows the correct pattern: diff against the baseline commit `5d16e06`.

**4.4 Two scenarios are claimed by a group label but not exercised.** `S5.5` (a HEAD Git cannot name) and `E5` (the discovery subprocess itself failing, as opposed to reporting no branch) appear in the `S5.1-S5.7/E5` label, but the body covers S5.1, S5.2, S5.3, S5.4, S5.6 and S5.7 and substitutes a comment — "the same observable fallback contract" — for the two failure paths. That is a reasonable engineering judgement, but the label overstates it. Either exercise them (`GIT_DIR` pointed at a non-repo is enough to make the subprocess fail for real) or narrow the label.

**4.5 `S4.2`/`S4.3` are pinned as source greps, not behaviour.** The group asserts `/base_branch\s*\?\?\s*['"]main['"]/` and `/max_diff_bytes\s*\?\?\s*200000/` against the text of `spike/src/engine.js`. Both already match `main` (`engine.js:82`, `:447`, `:454`), so they prove nothing about resolution and would break on a refactor that changed the spelling while keeping the behaviour. The scenario asks for a config *without* the keys to resolve to `main`/`200000`; the honest version of that is a fixture project whose `harness.yaml` omits `repo:` entirely, run through `harness run --dry` or `lint`. The comment in the test acknowledges the compromise, so this is a known trade rather than an oversight.

**4.6 Two assertions are weaker than their scenarios.** `S9.1` demands "zero `adapter.run` calls" and the test proves only that `runs.log` was never created — a strictly weaker claim, though a passing one is hard to imagine without the other. `S9.3` demands the *same diagnostic text* from `lint` and from `run`, and the test asserts only that both outputs contain `missing`. Comparing the two captured strings for equality costs one line and is what the criterion actually says.

**4.7 `S3.2` silently contracts that unconsumed gate answers are not an error.** It passes `--gate-answer abort` on a run that regresses without reaching a gate. Nothing in the requirement says what happens to a leftover answer; this test decides, by construction, that it is ignored. That is a defensible default — the alternative would make encounter-order answers brittle — but it is a design decision arriving through a fixture rather than through the criteria. Worth one sentence in whatever docs describe the flag.

**4.8 The `unloadable` fixture depends on message ordering.** `S6.4` matches `/review.*broken.*load|broken.*invalid/is` against the whole `harness lint` output. `broken.yaml` sorts before `review.yaml` in `readdir`, so the per-file lint lines alone will not satisfy the first alternative; the match will come from the whole-directory diagnostic naming the source flow before the target. That is exactly what criterion 6 requires, so the fixture is fine — but development should know the ordering is load-bearing and not reorder the diagnostic to lead with the target.

## 5. Scope

No scenario requires a change under `spike/src/engine.js`'s runtime or `spike/src/adapters/**`, which the ticket's non-goals reserve for Q-0006. Every red assertion resolves to `harness/`, `spike/templates/harness/`, `spike/bin/harness.js`, `lintFlow` (which criteria 6–8 explicitly open), `spike/test/smoke.js`, or `docs/`. `contracts/Q-0006/` is read-only in the tests and guarded by `S11.5`. `spike/package.json` already carries both `test` and `lint` scripts, so `S11.1` needs no packaging work.
