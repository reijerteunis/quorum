# Scenario review — Q-0033, round 4 (run 7, second `scenarios` pass)

*Architecture reviewer. Reviewed against `requirements/merged.md` (13 criteria), `qa/scenarios.md`, `qa/red-report.md`, `qa/red-integration.md`, `solution/tasks.yaml`, and the suite itself as merged into `harness/Q-0033/integration` (`spike/test/q0033-surface.js`, `spike/test/smoke.js`). Line numbers below refer to that branch, not to `main`.*

**Verdict: revise.** Coverage is complete and nothing fails to compile. The round is rejected on two defects, both of which live in files qa-red owns and can fix directly: the suite as written **can never go green**, and the report this gate is asked to judge is **missing more than half of its own output**.

---

## 1. What this round genuinely fixed

Stated first because three of these were blockers in earlier rounds and none of them should be re-litigated.

- **Branch provenance is clean, and I verified it rather than taking it on trust.** `git merge-base main harness/Q-0033/tests` → `c69cd99`; `git diff --name-only c69cd99 harness/Q-0033/tests` → exactly `contracts/Q-0033/cli-review-surface.contract.md`, `contracts/Q-0033/documentation-and-evidence.contract.md`, `contracts/Q-0033/review-surface-assets.contract.md`, `spike/test/q0033-surface.js`, `spike/test/smoke.js`. The integration branch shows the identical five paths from its own merge-base. Round 2 §2 and round 3 §4.3 are closed: this red was measured on a base carrying no implementation.
- **`smoke.js`'s `assert()` no longer kills the process on first failure** (`spike/test/smoke.js:18-21`, exit deferred to `:610-615`). The mechanism round 3 §3.3 demanded is in place.
- **S13.1 now traces the label's own connector run** (`q0033-surface.js:286-293`) and resolves the endpoints to `green → reviewed`, failing against the required `red → reviewed`. That is a precise, non-vacuous red on the one loop the criterion is about — the best assertion in this suite.
- **S8.1/S8.3's fixture is isolated as round 3 §4.2 asked**: the panel collapses to `codex` while the verdict step keeps the contract's `claude`, and the assertion carries the negative half (`!/written by its own vendor/i`, `q0033-surface.js:213`), so the pre-existing judge rule cannot satisfy it.
- **S11.5/S11.6 are split** (`:270-276`): the skip path is exercised deterministically against a fixed nonexistent SHA and reported on its own `skipped()` line, no longer contingent on this clone's depth or folded into a sibling's `✓`.
- **S6.4's ordering regex is tightened** to `/review[\s\S]*broken/is` with no OR-branch (`:183`), and **S6/S7 accumulate per fixture** through `checkFixtures` (`:21-28`) — visible in the report as six and four individually named failures rather than one.

No compile or import failure exists at file level: both files pass `node --check`, `lintFlow` is exported from `spike/src/engine.js:22`, and `yaml` is already a dependency.

---

## 2. Coverage — complete

Every acceptance criterion has at least one scenario, and every scenario has a group in the suite.

| AC | Scenario(s) | Group (`q0033-surface.js` unless noted) | Report |
| --- | --- | --- | --- |
| 1 | S1.1, S1.2, S1.3, S1.4 | `:86`, `:100` | ✗ (not visible — §3.2) |
| 2 | S2.1–S2.5 | `:105` | ✗ (not visible) |
| 3 | S3.1, S3.2, S3.3, S3.4; S3.5 = finding | `:100`, `:123`, `:129`, skip `:140` | ✗ (not visible) |
| 4 | S4.1–S4.3, E6 | `:142` | ✗ (not visible) |
| 5 | S5.1–S5.7, E5 | `:159` | ✗ (not visible) |
| 6 | S6.1–S6.10 | `:100`, `:180` | ✗ six named fixtures |
| 7 | S7.1–S7.8 | `:100`, `:196` | ✗ S7.4–S7.7 (S7.1–S7.3 correctly green today) |
| 8 | S8.1–S8.5 | `:100`, `:208` | ✗ one message |
| 9 | S9.1–S9.4, E1 | `:218` | ✗ one message |
| 10 | S10.1–S10.7, E3, E4 | `:234` | ✗ ENOENT (§4.1) |
| 11 | S11.1–S11.4; S11.5; S11.6 skip; S11.7, S11.8 in `smoke.js` | `:256`, `:270`, `:274`; `smoke.js:91-96`, `:197-216`, `:218-233` | S11.1 ✗; S11.5 ✓; S11.7/S11.8 **not visible** |
| 12 | S12.1 (manual) | skip `:337` | skip (not visible) |
| 13 | S13.1–S13.8 | `:280`–`:329` | ✗ ×5, S13.8 ✓ |

Twenty-one groups; the report's summary says nineteen failed; twelve failures are visible. The seven that are not are exactly the seven groups above the cut, and the two passes are the two frozen-input guards (S11.5, S13.8) — which is the correct outcome for both. So every criterion is red, and no criterion is uncovered.

---

## 3. Blockers

### 3.1 The suite contradicts itself: no implementation can make it green

`spike/test/smoke.js:91` and `q0033-surface.js:260` run the same command — `run requirements <id> --adapter mock --auto --gate-answer abort` under `MOCK_ALWAYS_FAIL` — and then assert opposite things about its output:

- `spike/test/smoke.js:95` — `assert(/stdin closed without one/.test(r.stdout + r.stderr), …)`
- `spike/test/q0033-surface.js:262` — `assert.doesNotMatch(output(exhausted), /stdin closed without one/i)`

Today the first passes and the second fails, because `--gate-answer` is an unrecognised flag and the gate falls through to the closed-stdin error at `spike/bin/harness.js:76`. The moment `Q0033-cli` ships and the flag is consumed, they swap: the gate is answered `abort`, the message never appears, and `smoke.js:95` goes red **permanently**. There is no third behaviour that satisfies both, including "`--auto` suppresses explicit answers" — that merely moves the failure back to `q0033-surface.js:262`.

This is not a subtle inference; it is visible in the round's own report, where S11.1's failure prints the full "stdin closed without one" line that `smoke.js:95` requires.

Both files are under `spike/test/**`, which every task in `tasks.yaml` is forbidden to touch. So this is precisely the shape that ended the last development loop and produced errata E-2 and the 2026-08-23 DECISIONS entry: a red the fan-out cannot close in any file it owns, indistinguishable from the ground to "the agents are failing". `qa/scenarios.md`'s own S11.2 already lists the four assertions this site should keep — `loop exhausted`, `human-locked`, non-zero exit, and never auto-advanced — and deliberately does **not** include the stdin one. `write-tests` updated the command on `smoke.js:91` and left the assertion below it. Delete `smoke.js:95` (and the sentence in its comment that justifies it); the property it protected now belongs to S10.4/S11.8, which test the *unanswered* gate.

### 3.2 The report is an 8 000-character tail, so most of this round's evidence does not exist

`qa/red-report.md` begins mid-word (`ssing`, line 4) because `spike/src/engine.js:599` writes `out.slice(-8000)`. What falls off the front:

- all seven head groups' failure messages (AC1–AC5) — I can prove from the summary arithmetic that they failed, but not *how*, which is the one question this gate is asked;
- the entirety of `smoke.js`, and with it **S11.7 and S11.8**. Round 3 §3.3 required S11.8's result to appear in every report from here on and said a round without it "must not be read as passing it". The mechanism was fixed; the evidence still is not there. `2 of 3 test file(s) failed` does not even establish that the second failure was `smoke.js` rather than `q0006-engine.js`;
- every `skipped()` line — S3.5, S11.6, S12.1, E2 — so the skip-reporting discipline of §1 is unverifiable too.

The truncation itself is not qa-red's to fix — the engine's slice is nobody's file in this ticket, and `qa/red-integration.md` is likewise engine-written (`engine.js:599`, `notes.join('\n')`), which is why §4.5 below strikes an instruction aimed at it. What *is* qa-red's to fix is the size and shape of the output: today two failure messages alone spend roughly a third of the budget dumping a captured run transcript (S11.1) and the whole of §5.5's YAML block (S13.2). The fix is one function in `q0033-surface.js`: after the last group, print a compact roster — one line per scenario id in this document, `✓` / `✗` / `skip`, no payload — and have `run.js`'s children ordered so it lands last. Then the final 8 000 characters always carry a complete result set whatever precedes them, and the "never a truncated tail" requirement becomes satisfiable instead of aspirational. Trim the two payload dumps to a first line plus a byte count while you are there.

---

## 4. Majors

### 4.1 AC10 and E7 are red for a missing asset, not for gate answers

Both groups die on their first line with a raw `ENOENT … harness/flows/review.yaml` from `engine.js:15` (`q0033-surface.js:234`, `:331`), because `copyFlows()` copies a flows directory that does not yet contain `review.yaml`. The diagnostic a `Q0033-cli` agent reads therefore points at `engine.js` and at an asset it does not own, and the group will change failure mode — silently — the moment `Q0033-assets` lands, with no signal about whether the gate-answer behaviour was ever exercised. Two cheap fixes, either is fine: assert the precondition explicitly the way S3.2 already does (`assert(fs.existsSync(...), 'review.yaml must ship')`), and/or build the pure gate-answer fixtures on the `requirements` flow, which ships today, keeping `review.yaml` only for the scenarios that genuinely need it (S10.7's `counter: review`).

### 4.2 Per-scenario accumulation reached only two of the eight groups it binds

`scenario()` (`q0033-surface.js:17-20`) still catches one throw per group. `checkFixtures` fixes S6 and S7; **S5.1–S5.7/E5 (`:159`), S8.1–S8.4 (`:208`), S9.1–S9.4/E1 (`:218`) and S10.1–S10.7/E3/E4 (`:234`)** are still linear assert chains, and the report shows each of them reporting exactly one message. Concretely: S10 contains seven scenarios plus two edge cases and this round proved nothing about eight of them. Route those four groups through `checkFixtures` as well — the helper already exists, so this is mechanical.

### 4.3 The suite pins `lintFlow` to `spike/src/engine.js` while `Q0033-lint` is told to move it

`q0033-surface.js:10` imports `{ lintFlow } from '../src/engine.js'` and `smoke.js` does the same dynamically; `tasks.yaml`'s `Q0033-lint` is instructed to "move the flow rules out of the engine into their own module" (`spike/src/lint.js`). If that task removes the export, **both** test files fail at import and the entire round reads as a compile failure — the one outcome this gate exists to exclude. The task can fix it (it owns the lint portion of `engine.js`), but nothing tells it to. Say so explicitly in `qa/scenarios.md`: `spike/src/engine.js` must keep re-exporting `lintFlow` (and `FlowError`) after the extraction, because the red suite imports them from there.

### 4.4 S10.1 cannot distinguish ordered consumption from ignored answers

`q0033-surface.js:237-238` runs with `--gate-answer advance --gate-answer abort` and asserts only a non-zero exit and an unchanged stage. Both hold if the flags are parsed and thrown away and the run dies at the first gate — which is exactly today's behaviour. Encounter order *is* the contract for AC10 (the non-goals rule out naming gates), so it needs positive evidence: assert the ordered pair in `runs.log` — a gate line for the exhaustion gate answered `advance`, followed by an `aborted` terminal event — rather than an exit code two different worlds share.

### 4.5 The merge-base paste instruction targets a file nothing can write

`qa/scenarios.md:18-23` requires the merge-base commands to be pasted into `qa/red-integration.md` before `prove-red` runs. That file is generated by the engine at `prove-red` (`engine.js:599`) and overwrites anything an agent puts there — which is why this round's copy is a four-line checkmark list again, for the second time. The instruction is unownable in the same way the `smoke.js` migration scenario was, and it should not survive another round. Move the check where it can live: an assertion in `q0033-surface.js` that `git diff --name-only $(git merge-base main harness/Q-0033/tests) harness/Q-0033/tests` yields only the expected paths. Then base cleanliness is proven by the suite, in the report, every round, instead of by a paste nobody can make. (For this round it is not a blocker: I ran both commands myself and the base is clean — see §1.)

---

## 5. Nits

- **`q0033-surface.js:252-253`** — E3 proves `--adapter` stays last-wins by asserting the output does *not* match `/single.vendor.*mock/i`. That passes if `claude` won, if `mock` won, and if `--adapter` were ignored entirely. Assert something only the last-wins reading produces (the attempted adapter named in the trace, or the auth/`check()` failure `claude` gives in this fixture).
- **`q0033-surface.js:305`** — `\z` is not an anchor in JavaScript regular expressions; `(?=^##\s|\z)` reads as "or a literal `z`". The M1 block is bounded correctly today only because no lowercase `z` appears before the next heading — and `Q0033-docs` is about to add a bullet to that exact block. Use `(?=^##\s|$)` with the `m` flag handled deliberately, or slice on the heading index.
- **`q0033-surface.js:316`** — S13.6's first assertion is a bare `assert.ok(at >= 0)`, so the report shows "The expression evaluated to a falsy value" with no indication of which of the two required decisions is missing. Give it a message naming the topic.

---

## 6. Carried findings for the architect gate — still unresolved

Neither is a scenario-content defect, and both have now outlived several rounds of being written down. As the reviewer at this gate I am recording a recommendation rather than passing the question on again.

- **`solution/tasks.yaml:99` — strike the README clause.** `Q0033-docs` is instructed to "give the README the one new command"; `S13.8` (`q0033-surface.js:326-329`) asserts `git diff --quiet 5d16e06 -- README.md`, and the merged requirement puts the README rewrite in Q-0028/M6. A task told to do the one thing that fails a test is a guaranteed loop iteration. Remove the clause and drop `README.md` from the owned-file list — or keep it listed with "do not modify; Q-0028 owns it", which is a different and honest instruction.
- **`solution/tasks.yaml:71` — `Q0033-mock` has no red scenario, fourth round.** `contracts/Q-0006/mock-adapter-switches.contract.md` already guarantees the finding shape the task's deliverable describes, and S3.2/S3.3 prove both stage transitions with zero change to `spike/src/adapters/mock.js`. Dispatching it produces an agent that correctly reports "nothing to do" and a task that passes without proving anything. Drop it, or name the mock behaviour the shipped flow needs that S3.1–S3.4 do not already cover.

A third, smaller one stands as recorded in `qa/scenarios.md`: the same task description cites §5.3, while `AC13` and `S13.2` scope the no-pinned-model fix to §5.5 (`model: gpt-5` in fact occurs seven times across §5.1–§5.7). Narrow the description or widen the criterion; as it stands the instruction is unchecked either way.

---

## 7. What a passing round looks like

1. `spike/test/smoke.js:95` deleted (§3.1) — the single change that makes the suite satisfiable.
2. A compact end-of-run roster, one line per scenario id, printed last, and the two large payload dumps trimmed (§3.2), so the report's final 8 000 characters carry a result for every scenario including S11.7 and S11.8.
3. S5, S8, S9 and S10 routed through `checkFixtures` (§4.2).
4. AC10's and E7's fixtures given an explicit `review.yaml` precondition or moved onto the `requirements` flow (§4.1).
5. The `lintFlow` re-export requirement stated in `qa/scenarios.md` (§4.3).
6. S10.1 asserting ordered evidence from `runs.log` (§4.4); the merge-base check moved into the suite (§4.5).
7. `tasks.yaml` amended for the two carried findings before the fan-out is dispatched (§6).

Nothing here needs a new scenario or a new dependency, and none of it touches a file outside `spike/test/**` and this ticket's own solution artifacts.
