# Q-0057 — implement report

*Iteration 1. No review report was present, so this is a first round, not a revision round. Branch
`harness/Q-0057/implement`. Written against the merged requirement of 2026-08-30 (`main` at
`23dfce1`), whose §6 sequencing — one change, both trees together — is what this branch does.*

---

## 1. What changed, file by file

Six files, plus one new test file. Every line traces to a criterion; nothing else was touched.

### `spike/src/engine.js` — AC-1 (the behaviour half)

Two edits in `runFlow`, both at the context construction.

1. `nextRunId(ticket)` is **hoisted to a `const runId` above the `ctx` object literal** and the
   literal now reads `runId,`. This is §8.3's correction: the call sat *inside the same literal* as
   `vars`, so `vars` could not reference it where it stood. The value is unchanged and every
   `ctx.runId` reader is unaffected.
2. `vars` gains one key: `run: runId`, between `iter` and `base`. Three comment lines name what it
   is (the number `runs.log` carries as `run=N` and `.quorum/runs/<id>-N/` is named after) and why
   `iter` cannot do the job, citing Q-0057 rather than transcribing it.

No other engine behaviour changed. `iter` still starts at 1 and still increments once per intra-flow
backward edge; `round`, `base` and `baseOverride` are untouched.

### `packages/core/src/engine/engine.ts` — AC-1 (the primitive half)

One key, `run: runId`, on the `vars` literal at line 137, with the same three-line comment. `runId`
was already a hoisted `const` here (line 134), so `core` needed no hoist. Per §8.5 this is
deliberately *not* the same fix written twice: `runAgentStep` returns `unavailableStep(step,
'Q-0052')`, so `core` cannot write a step artifact at all yet — see §7 below, where that obligation
is named for Q-0052.

### `packages/core/src/engine/types.ts` — AC-1 (the JSDoc AC-1 names)

`RunContext.vars`'s one-line JSDoc — *"`base` and `iter` among them"* — becomes a block naming `run`,
stating that it is `{@link RunContext.runId}` and why: a write path can be named after the run that
produced it rather than after a counter that restarts every run.

### `harness/flows/chore.yaml` and `spike/templates/harness/flows/chore.yaml` — AC-2

Two lines each, and the two files are **byte-identical afterwards** (`diff` exits 0, as it did
before).

| line | before | after |
| --- | --- | --- |
| 13 | `review/chore-iter-*.md` | `"review/chore/run-{run}/chore-iter-*.md"` |
| 34 | `"review/chore-iter-{iter}.md"` | `"review/chore/run-{run}/chore-iter-{iter}.md"` |

Line 13's entry is now **quoted** because a plain scalar in a YAML flow sequence may not contain `{`.
The other two entries of that list (`requirements/merged.md`, `requirements/errata.md`) are unchanged,
which is what keeps AC-3's second half true. No other step, flow or template file changed.

### `docs/02-sdlc-pipeline-spec.md` — AC-9

§5.8 gains one paragraph, *"A review artifact is named by the run that wrote it"*, immediately before
the existing prerequisite paragraph. It states the write path, the read path, the rule (*a revise
round reads its own run only*), what `{run}` is, why `{iter}` cannot name the path alone, that a
finding which must outlive its run belongs in `requirements/errata.md`, and that pre-Q-0057 flat
files keep their names and are read by nothing. The status line at the top is bumped with the date
and what changed. `docs/GLOSSARY.md` is untouched — "run" and "round" are both already in use and no
new term is introduced.

### `spike/test/q0057-run-scoped-reviews.js` (new) — AC-1, AC-3, AC-4, AC-5, AC-6

Four scenarios, auto-discovered by `spike/test/run.js` (`:16-18`), so no registration was needed.

**The flow under test is the shipped file.** `choreFlow()` reads `harness/flows/chore.yaml`, applies
three mutations and writes the result into the fixture's harness directory through `loadFlow`, which
lints it on the way in. The mutations are the ones the mock adapter needs and are named in the
source:

1. `implement.role` → `principal-architect`, the one role the mock writes a file for — without it the
   implement worktree commits nothing and `materialiseDiff` refuses the empty
   `integration...implement` range. This is `q0034-chore-preflight.js`'s own reason for the same
   choice.
2. `integrate.run_tests` deleted — the fixture repository has no suite. The merge still runs.
3. `review.on_fail.max_iterations` set to 1 in R3 only, to get AC-5's exact two-then-one review shape.

Everything the ticket is about — the write path, the input glob, `cross_vendor`, the diff range, the
gates — is the shipped file's own text. **This is a deliberate departure from
`q0034-chore-preflight.js`, which inlines a chore-shaped flow.** Inlining here would leave all four
scenarios green after a revert of the two changed lines, which is the one thing they exist to catch;
AC-5's *"shown failing against `HEAD`'s flow file"* only has a subject if the test reads that file.
Adapters are not mutated: the flow keeps `claude`/`codex` and the run passes
`config.adapterOverride = 'mock'`, so `cross_vendor: required` is linted against the declared vendors
exactly as it is in production.

| | scenario | what it pins |
| --- | --- | --- |
| R1 | AC-1 | On a ticket whose `runs.log` already ends at `run=2`, a step declaring `writes: ["x/run-{run}.md", "x/run-{run}-iter-{iter}.md"]` and taking one backward edge produces **exactly** `run-3.md`, `run-3-iter-1.md`, `run-3-iter-2.md` — so `{run}` is `nextRunId`'s answer and does not move when `{iter}` does — and every `runs.log` line the run wrote says `run=3`. |
| R2 | AC-3, AC-6 | Two runs on one ticket. The review files are exactly `run-1/chore-iter-1.md` and `run-2/chore-iter-{1,2,3}.md`: numbering restarts at 1 inside each run's own directory and increments once per backward edge within a run. Run 2's **second** implement prompt contains `## Input: …/review/chore/run-2/chore-iter-1.md`, contains no `review/chore/run-1/` path and no flat `review/chore-iter-` path, and still contains `requirements/errata.md`. |
| R3 | AC-5 | *The regression.* Four independent assertions in the order AC-5 lists them, except that byte-identity is asserted **first** so that a defective flow file fails on the overwrite rather than on the layout. Run 1's two files are byte-identical after run 2 finished; three review files across two run directories; run 1's second implement step was fed run 1's first review (the loop still converges); run 2's implement prompt contains no run-1 path and no `## Input:` under `review/` at all. |
| R4 | AC-4 | Both starting states. **(a)** an earlier run's directory is present: run 2's first implement receives no review. **(b)** legacy-only: a ticket carrying just `review/chore-iter-1.md` and `-2.md` starts a new run successfully, reads neither, writes `review/chore/run-1/chore-iter-1.md`, and both legacy files are byte-identical afterwards — AC-7's mechanism, demonstrated rather than asserted about the repository. |

R2 produces four review files rather than AC-5's three because it runs the shipped
`max_iterations: 2`; AC-5's three-file shape is R3's, which sets the bound to 1. Assertions are made
on the prompt text recorded in run history (`.quorum/runs/<id>-<n>/steps/NNN-implement/prompt.txt`) —
the bytes an adapter was actually handed — not on `readFiles`'s return value, which AC-4 asks for
explicitly. `promptsOf` throws on a missing `prompt.txt` rather than shrinking its list: an assertion
reading `prompts[0]` of an empty array tests the string `"undefined"` and passes over anything.

### `packages/core/src/engine/engine.test.ts` — AC-1 (core half)

One case, placed beside the existing AC-6 case that already observes `context.vars.iter` through a
`routing.runStep` spy across a backward edge and already names Q-0057. It seeds the fixture ticket's
`runs.log` to `run=2` (so a hard-coded `1`, or a value tracking the iteration counter, cannot pass),
then asserts `seen` is `[[3, 1], [3, 2], [3, 2]]` and that the terminal event carries `runId: 3` —
tying `vars.run` to the id the rest of the record is keyed by rather than to some stable number.

---

## 2. Shown red before it was trusted — twice

### (a) Against `HEAD`'s flow file, engine change in place — AC-5's requirement

Both copies of `chore.yaml` were reverted to their `HEAD` text and the new test run unchanged.
**3 of 4 scenarios fail**, quoted verbatim:

```
✓ R1 — AC-1: {run} is the id the run was allocated, and it does not move when {iter} does
✗ R2 — AC-3/AC-6: a revise round is fed its own run's reviews, numbered from 1 inside that run
  Expected values to be strictly deep-equal:
  [
+   'review/chore-iter-1.md',
+   'review/chore-iter-2.md',
+   'review/chore-iter-3.md'
-   'review/chore/run-1/chore-iter-1.md',
-   'review/chore/run-2/chore-iter-1.md',
-   'review/chore/run-2/chore-iter-2.md',
-   'review/chore/run-2/chore-iter-3.md'
  ]

✗ R3 — AC-5: two runs never overwrite, and the loop still converges
  run 2 overwrote run 1's review/chore-iter-1.md
+ '# code-reviewer output (mock, call 9)\n' +
- '# code-reviewer output (mock, call 7)\n' +
    '\n' +
+   'Prompt was 2418 chars and mentioned 3 inputs.\n' +
-   'Prompt was 2312 chars and mentioned 3 inputs.\n' +

✗ R4 — AC-4: the first implement of a run is fed no review, whatever is on disk
  The expression evaluated to a falsy value:
  assert.ok(fs.existsSync(path.join(withEarlierRun.ticket.dir, 'review/chore/run-1/chore-iter-1.md')))

✗ 3 scenario(s) failed
```

R3's message is the defect in one line, with the bytes: run 1's review is gone and run 2's is in its
place. R2's listing is the mixture — run 1 wrote one file, run 2 wrote three over the top, and what
survives says nothing about which run produced it. R1 correctly still passes: it exercises the engine
variable and reads no flow file, which is the two halves being separable.

### (b) With the flow change in place and the engine variable removed — AC-2's stated hazard

AC-2 warns that a flow shipping `{run}` before AC-1 would create a literal `{run}` directory, because
`interpolate` leaves an unknown placeholder untouched. Removing `run: runId` from
`spike/src/engine.js` and re-running fails **all four** scenarios:

```
✗ R1 — {run} must be 3 — nextRunId's answer — at every iteration, and nothing else may appear
  [
+   'run-{run}-iter-1.md',
+   'run-{run}-iter-2.md',
+   'run-{run}.md'
-   'run-3-iter-1.md',  -'run-3-iter-2.md',  -'run-3.md'
  ]
✗ R2 — [ 'review/chore/run-{run}/chore-iter-1.md', …-2, …-3 ]
✗ R3 — run 2 overwrote run 1's review/chore/run-{run}/chore-iter-1.md
✗ R4 — …
✗ 4 scenario(s) failed
```

The overwrite returns under the literal directory name, which is the point: the two halves are one
change and the suite says so. The same removal fails the core case with `undefined` where `3` is
expected. Both files were restored and both suites re-run green afterwards.

---

## 3. Verification

Run in the implement worktree, which is `harness/rules.md`'s "no dependencies until you install them"
case: `npm install --prefix spike --no-audit --no-fund` then `pnpm install --frozen-lockfile` first.

| § | check | result |
| --- | --- | --- |
| 12.1 | `node spike/bin/harness.js lint` | exit 0 — all six flows ✓, `chore.yaml` among them |
| 12.1 | `node spike/bin/harness.js lint --project spike/templates` | exit 0 — all six template flows ✓ |
| 12.2 | `diff harness/flows/chore.yaml spike/templates/harness/flows/chore.yaml` | exit 0, no output |
| 12.3 | `grep -rn '{run}' harness/flows spike/templates/harness/flows` **before** | no hits (measured on the unchanged tree) |
| 12.3 | the same **after** | exactly four hits — `chore.yaml:13` and `:34` in each of the two files, and nothing else |
| 12.4 | `npm test --prefix spike` | **16/16 test files passed**, including the new `q0057-run-scoped-reviews.js` (4 scenarios) and the unchanged `q0034-chore-preflight.js` |
| 12.5 | `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks successful, 0 cached** |
| 12.5 | test totals | core 42 files passed / 1 skipped, **956 passed / 2 skipped**; shared 11 files; cli, web, templates, compiler, server 1 file each |

AC-8 needed no new test: `spike/test/q0035-empty-range.js:288-292` already asserts
`validateFlowDirectory` over **both** `harness/flows` and `spike/templates/harness/flows`, and it is
green in the run above. The rule AC-8 names is the convergence check, and it passes for the reason
AC-8 gives — `globMatch` escapes `{` and `}` and expands `*` to `[^/]*`, so
`review/chore/run-{run}/chore-iter-*.md` still matches `review/chore/run-{run}/chore-iter-{iter}.md`.
The cross-vendor rule is unaffected: the review step still judges `dev/implement-report.md`, written
by the other adapter.

**Both environment rows, per Q-0072's closing finding.** Everything above was run twice: once with
`.harness/worktrees` and `.quorum/runs` **absent**, which is this worktree's natural state and the
shape a fresh CI clone has, and once with both **present** (created, suites re-run forced, removed).
Identical results in both rows — 21/21 tasks 0 cached, spike 16/16. The second row Q-0072 names — on
`main` after the merge — is still owed at the gate and is not something this branch can perform.

---

## 4. What I deliberately left alone

- **Everything under `backlog/`** (AC-7). The 56 flat `review/chore-iter-N.md` files across 21
  folders and Q-0073's `review/chore-run2-iter-1.md` are untouched: not moved, renamed, rewritten or
  deleted, and no new glob reads them. `git status` shows no `backlog/` path. R4(b) pins the
  mechanism on a fixture instead.
- **`reviewRound` and `review.yaml`**, in both trees. Its contract — *a round is a directory with a
  verdict* — is not touched, generalised or taught about chore artifacts. The new `review/chore/`
  directory does not match `^round-(\d+)$`, so `reviewRound` cannot see it.
- **`q0034-chore-preflight.js`'s inline chore-shaped flow**, which still writes
  `review/chore-iter-{iter}.md`. It is a test fixture, not a shipped flow; its subject is the
  preflight, and AC-2 restricts the change to flow and template files.
- **`.harness/<step>-verdict.json`** (`engine.js:313`), still overwritten every iteration and every
  run. Gitignored scratch, and OQ-5's non-goal.
- **No fallback.** No code path writes the legacy flat name, and none silently omits a review; the
  existing explicit artifact-write error path is unchanged.
- **`turbo.json` in either package.** `spike` is not a turbo workspace member, and the new spike test
  adds no read from `packages/**`; the only files under `packages/` that changed are already inside
  their own package. Checked rather than assumed: nothing in `packages/*/src` reads `spike/test/**` —
  the seven hits are comment citations.
- **`harness/port-charter.md`.** See §7(c): the row is named, not written.

---

## 5. Two things worth knowing before reading the diff

**This run's own review will still land at the flat path.** `runFlow` loaded
`harness/flows/chore.yaml` from the main checkout at run start, not from this worktree, so the review
step that judges this branch writes `review/chore-iter-1.md`. The fix takes effect from the next chore
run on any ticket. It follows that **this ticket is not protected from its own defect**: if this run
exhausts and is re-run, its reviews are still at risk, and the mitigation is the one Q-0073 used —
commit the review before starting the next run. That is inherent to fixing a flow with the flow, not
something the change can avoid.

**The three children this protects are Q-0052, Q-0053 and Q-0054**, each of which runs this flow and
each of which loses a review today if it exhausts and is re-run.

---

## 6. Acceptance criteria

| AC | where | evidence |
| --- | --- | --- |
| AC-1 `{run}` in both trees, stable across a backward edge | `spike/src/engine.js` (hoist + key), `engine.ts:137`, `types.ts` JSDoc | R1 (spike, mock run, `runs.log` seeded to `run=2` → `x/run-3.md`); core case in `engine.test.ts` → `[[3,1],[3,2],[3,2]]` and `runId: 3`. Both shown failing with the key removed |
| AC-2 the artifact is run-scoped in both copies | both `chore.yaml` | `diff` exit 0; grep before = nothing, after = exactly the two files; no other flow or template changed |
| AC-3 a revise round sees this run's reviews and the standing errata | `chore.yaml:13` | R2: run 2's second implement prompt has `run-2/chore-iter-1.md`, no `run-1/`, no flat path, and `requirements/errata.md` |
| AC-4 the first implement of a run is fed no review | `readFiles`'s `existsSync(dir)` early return | R4(a) earlier run directory present; R4(b) legacy-only ticket runs cleanly, reads nothing, writes into the new layout |
| AC-5 two runs never overwrite; the loop converges | the regression | R3's four assertions; **shown red first**, failure text quoted in §2(a) |
| AC-6 iteration numbering unchanged within a run | no engine change to `iter` | R2's exact four-file listing: `run-1/-1`, `run-2/-1,-2,-3` |
| AC-7 legacy artifacts untouched | nothing written under `backlog/` | `git status`; R4(b) asserts the legacy bytes after a full run |
| AC-8 `harness lint` accepts both directories | — | CLI exit 0 over `harness/flows` and over `spike/templates` (via `--project`); `q0035-empty-range.js` asserts the same and is green |
| AC-9 the documentation says what the flow does | `docs/02-sdlc-pipeline-spec.md` §5.8 + status line | the diff |
| AC-10 the three obligations named | §7 below | — |

---

## 7. AC-10 — the three obligations this ticket cannot discharge itself

**(a) A decision entry is owed, and I did not write it.** The chore role forbids `docs/decisions/`
and its index; a decision is the human's to record. The requirement's proposed title is *"A review
artifact is named by the run that wrote it"*, and what it has to record is: the artifact of record
lives in git while `.quorum/` is gitignored, so an overwritten review survives nowhere a second
maintainer can reach; the path is the only place the engine can stamp run identity, because
`spike/src/engine.js:308-310` writes the agent's document verbatim and adds no header; and a revise
round reads its own run only, with `requirements/errata.md` as the channel for a finding that must
outlive its run. Per risk 1, a reviewer raising the missing entry as a finding is an erratum, not a
revise round.

**(b) Q-0052 inherits an obligation.** When it ports the agent step's write loop into `core`, it must
interpolate the write path with `vars.run` available and must not reintroduce a ticket-scoped path
named by a run-scoped counter. `core`'s `vars.run` exists as of this branch and its JSDoc says what
it is for; `runAgentStep` still returns `unavailableStep(step, 'Q-0052')`, so nothing in `core` reads
it yet. This needs writing into **Q-0052's ticket body** at the gate — `backlog/` is outside this
role's write paths and the engine discards agent edits under it.

**(c) `harness/port-charter.md` §3 wants a Q-0057 row.** This branch changes `spike/src/engine.js`
while `:243` still reads `freeze-sha: not-yet-recorded`, and §3's table of tickets that legitimately
edit `spike/src` before the SHA can be recorded lists five — Q-0037, Q-0038, Q-0039, Q-0040, Q-0063 —
not six. The freeze itself does not bind this ticket (§6, §8.2: it is a property of the fourteen
`children` at `:242`, and Q-0057 is not among them, so the branch-scope guard reports it out of
scope), but the SHA cannot be recorded later without archaeology unless the row exists. `harness/`
**is** inside this role's write paths, so this omission is deliberate and not a refusal: risk 2 and
AC-10 place the charter with the human as a governance file. It is a one-line table row.

---

## 8. Open questions, as the requirement left them

- **OQ-1** (only the current run's reviews) is implemented as specified, with its accepted cost
  intact: a finding left *only* in an earlier run's review is no longer injected automatically, and
  `requirements/errata.md` — still an input on every run, pinned by R2 — is the prescribed remedy.
- **OQ-2** (`review/chore/run-{run}/…`) is implemented as decided. The gate can still overturn it; it
  is one string in two files today and expensive after the first run writes into it.
- **OQ-3** (run identity inside the document body), **OQ-4** (two concurrent runs share a `nextRunId`
  and would share a directory — Q-0039), **OQ-5** (`.harness/<step>-verdict.json`) are untouched and
  still owned as the requirement assigns them.

Nothing in the requirement was ambiguous or contradictory in a way that needed a decision it does not
authorise, and nothing in it went unimplemented.
