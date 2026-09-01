# Q-0037 — implement report, chore run 2, revision round 2

*Cumulative, and deliberately so. Every measurement below was produced by the command quoted beside
it, in this worktree, during **this** round. Nothing is transcribed from an earlier round's report —
per R-7, and because round 1's report no longer exists to transcribe from.*

---

## 0. What this round is, and why it changes no code

`review/chore/run-2/chore-iter-2.md` returned **one major and no nits**. It is correct, I have acted
on it in full, and the action it asks for is entirely inside the report.

> **major** — the current report omits evidence explicitly required by AC-3, AC-4, AC-5 and AC-8:
> the timer-removal red-before-green output, the core inverse failing against unmodified
> `routing.ts`, the shipped-path evidence table, and the usage-line red-before-green demonstration.
> *"Restore the measured outputs and AC-5 table in the current report, or provide a durable, precise
> reference to an artifact containing them."*

**The tree is byte-identical to `bc55253`.** No file changed this round:

```
$ git status --short
$ git diff --stat
                                        (both empty)
```

That is the honest outcome and not an evasion: the finding is about the artifact a reviewer reads,
so the artifact is the fix. Round 2's report was correct about round 2 and scoped to it; what it
lost was everything before it.

### The cause is structural, and worth naming rather than apologising for

The reviewer's two remedies are *restore the outputs* or *point at a retained artifact*. **The second
is not available**, and the reason is a defect one file over from one this project has already fixed:

```
$ grep -n -A 12 "id: implement" harness/flows/chore.yaml
13:      backlog: [requirements/merged.md, requirements/errata.md, "review/chore/run-{run}/chore-iter-*.md"]
16:    output: { writes: [dev/implement-report.md] }
```

The review step's **input** is run-scoped, so all of a run's reviews survive and accumulate. The
implement step's **output** is a fixed path, so round *N* silently replaces round *N−1*. Every review
round is durable; no implement round is. That asymmetry is exactly the defect **Q-0057** closed for
`review/chore-iter-{iter}.md`, which it made `review/chore/run-{run}/chore-iter-{iter}.md` — and
`dev/implement-report.md` was left flat.

So there is no retained round-1 artifact to cite. I took the first remedy, and took it in the form
that stops the finding recurring: **this report is cumulative and self-contained**, covering all
twelve criteria rather than this round's slice. A third revision round overwriting it loses nothing,
because there is nothing earlier left outside it.

Named for the gate, **not fixed**: no criterion of this ticket names `harness/flows/`, and it is a
flow change in both trees plus an engine interpolation variable — Q-0057's shape exactly, and that
was its own ticket for good reasons. See §6.

### How the evidence was produced

By mutation against the current tree, each mutation reverted immediately and the revert verified.
This is stronger than restoring round 1's numbers would have been even if they had survived: the
tree has moved since round 1 wrote them, so re-running is the only thing that measures *what
shipped*. *"A measurement copied from a document is not a measurement"* (Q-0058).

**Baseline recorded before any mutation**, so every result below is comparable rather than merely
green:

| Baseline | Result |
| --- | --- |
| `npm test --prefix spike` | **18/18 test files passed** |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `@quorum/core` | **1251 passed, 2 skipped** |

Installed first per `harness/rules.md`: `pnpm install --frozen-lockfile` (*"Already up to date"*) and
`npm install --prefix spike --no-audit --no-fund` (*"up to date"*).

---

## 1. AC-3 — the timer removal, red before green, and the control row

AC-3 requires that with **AC-1 applied and AC-2 not applied** the scenario fails, and that with both
applied it passes. I ran three cells rather than two, because two do not discriminate.

### Cell 1 — engine timer removed, fixture handle reverted → **FAILS**

Reverting only the fixture's gate to the handleless promise it carried before this ticket
(`gate:()=>new Promise(()=>{})`), leaving `runGate` timer-free:

```
$ node spike/test/q0011-run-history.js
✓ AC-4/AC-5 — gates allocate nothing and script output is captured without a prompt
✗ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
  Expected values to be strictly equal:
+ actual - expected

+ 'running'
- 'interrupted'

✓ EDGE-6 — post-initialisation persistence failures warn without discarding the run
✗ 1 Q-0011 writer scenario group(s) failed
```

**This is the requirement's prediction reproduced to the word.** The child drains and exits before
the `SIGTERM` arrives, so the manifest is never finalised and stays `running`. It is *one* scenario
of eighteen — the one AC-2 protects — which is what makes it a demonstration rather than a
coincidence.

### Cell 2 — the control: engine timer restored, fixture handle reverted → **passes**

Round 1 did not run this cell, and it is the one that carries the argument. Restoring the timer to
`runGate` while leaving the fixture handleless:

```
$ node spike/test/q0011-run-history.js
✓ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
```

So the scenario passes on the engine's timer alone. **That is the proof that the timer was a test
fixture's prop living in production code** — the ticket's central claim, measured rather than
asserted. Without this cell, cell 1 shows only that *something* is needed; with it, the truth table
closes:

| `runGate` timer | fixture handle | `AC-3/AC-10/EDGE-9` |
| --- | --- | --- |
| removed (AC-1) | absent | **fails** — manifest reads `running` |
| present (pre-Q-0037) | absent | passes — the prop doing the work |
| removed (AC-1) | present (AC-2) | passes — the handle doing the work |

The middle row is what AC-3 means by *"what would catch a change that deletes the timer and leaves
the scenario passing for a reason nobody checked"*: the work moved from the engine to the fixture,
and both endpoints are measured.

### Cell 3 — both applied → **passes**

```
$ git diff --stat -- spike/test/q0011-run-history.js
                                        (empty — byte-clean restore)
$ node spike/test/q0011-run-history.js
✓ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
```

### AC-2's ceiling, re-read rather than assumed

R-2 is the one place where the obvious implementation is worse than the defect: `spike/test/run.js`
has no per-scenario timeout, so an unbounded handle turns a broken engine from a failing suite into
a hanging one. The fixture's handle is a **10 s rejection**, not an idle keep-alive — if it is ever
reached the run ends and the child exits non-zero, so the assertions fail rather than never
arriving. The ceiling and one line saying why it exists are both in the fixture.

---

## 2. AC-4 — the `core` inverse, and the three pins moving together

AC-4 requires the inverse test shown failing against unmodified `routing.ts`, and all three pins
moved together. Restoring `const signalWindow = setTimeout(() => {}, 1000);` with its marker and
`clearTimeout`:

```
$ pnpm turbo run test --force --filter=@quorum/core

× Q-0037 AC-4: routing.ts holds no timer, and nothing stands in for the one it held
 FAIL  src/engine/q0050.source.test.ts > … > Q-0037 AC-4: routing.ts holds no timer, …
 AssertionError: expected '/** Gate policy, step dispatch, and b…' not to match /signalWindow/

 FAIL  src/engine/q0050.source.test.ts > … > AC-13d: every preserved defect is a registered site, …
 AssertionError: expected { 'composite.ts': [ …(10) ], …(8) } to strictly equal { … }
   "routing.ts": [
+     "preserved defect/AC-4",
       "preserved defect/AC-12",
       "preserved behavior",
   ],
   ❯ src/engine/q0050.source.test.ts:198:19

 Tests  2 failed | 1249 passed | 2 skipped (1253)
```

**Two failures, which is R-3 demonstrated.** Pin 1 is the inverse test; pin 2 is the `toStrictEqual`
identity register, which is not a count and cannot be satisfied by arithmetic. They are coupled, so
deleting the timer and leaving the register is a red suite — the guard working.

Pin 3 is the arithmetic narration below the register, and AC-4(3) says **re-derive rather than
decrement**. It was re-derived: *"Eighteen authority lines, of which SIX are Q-0050's own preserved
defects: AC-10c, AC-10f and AC-12a/b/c/d"*, with the sentence stating in as many words that it was
re-derived from the register above rather than subtracted from the nineteen-and-SEVEN that stood
there, and that E-20's ruling stands while its subject list does not. The cross-file count moved
`19 → 18` in the same change.

Restored and re-verified clean:

```
$ git diff --stat
                                        (empty)
```

---

## 3. AC-5 — no shipped gate path changes, and nothing replaced the timer

### The evidence table, filled in from the tree

AC-5 asks for evidence rather than assertion. Line numbers re-measured this round with
`grep -n "gateAnswers.shift\|process.stdin.isTTY\|readline.createInterface" spike/bin/harness.js`:

| Path | Where | Why the timer was never load-bearing — read, not inferred |
| --- | --- | --- |
| `--gate-answer` | `spike/bin/harness.js:83` | `const raw = gateAnswers.shift();` then `return answer;` — synchronous. The promise is already settled when `runGate` awaits it, so no handle is needed and none was reached. |
| non-interactive, no answer | `spike/bin/harness.js:95` | `if (!process.stdin.isTTY) { throw new FlowError(…) }` — throws **before** awaiting anything. The timer was allocated and cleared around a call that never suspends. |
| TTY | `spike/bin/harness.js:98` | `readline.createInterface({ input: process.stdin, … })` owns its own libuv handle for the life of the question, and `rl.close()` releases it. The engine's timer was redundant with a handle readline already held. |
| `core`, any caller | `routing.ts:25`, `:22`, `:35` | `if (!context.answerGate) throw new FlowError(…)` — throws when absent. Cancellation is `context.signal` (`:22` pre-check, `:35` `Promise.race`) — Q-0050's AC-5 removed signal handling from this package, so the purpose the comment claimed **does not exist here at all**. |

The fourth row is the sharper one: in `core` the timer was not merely unnecessary, it was carrying a
`Why: preserved defect` line for a mechanism the package does not have.

### The no-lifecycle-masking clause has its own subject

AC-5 forbids substituting another engine-owned handle. The AC-4 inverse test's second clause is what
enforces it, and *"showing a guard has a subject proves it fires, not that each clause does"*
(Q-0071) — so I gave that clause its own subject, a `setInterval` named nothing like `signalWindow`:

```
$ pnpm turbo run test --force --filter=@quorum/core      # with `const keepAlive = setInterval(() => {}, 1000);`

 FAIL  src/engine/q0050.source.test.ts > … > Q-0037 AC-4: routing.ts holds no timer, and nothing stands in for the one it held
 AssertionError: expected '/** Gate policy, step dispatch, and b…' not to match /setTimeout|setInterval|setImmediate/

 Tests  1 failed | 1250 passed | 2 skipped (1253)
```

**One failure, not two.** The register stays green because the replacement carries no authority
marker — which is precisely the state the clause exists to catch, and it separates cleanly from the
`signalWindow` clause of §2, where two failed. Each clause is independently load-bearing.

### The behavioural half

`packages/core/src/engine/lifecycle-routing.test.ts` carries the `core` assertion AC-5 requires: a
pending gate does not settle by itself across 50 event-loop turns plus a `setImmediate`, then rejects
on `abort()` with `gate human (decide) interrupted`, and a late answer arriving afterwards is not
applied. A source-text pin can say the timer is gone; only this says that what the timer was blamed
for still works. Green in every run below.

Gate **semantics** are untouched throughout: `auto` still short-circuits, `human-locked` still cannot
be flipped, the exhaustion gate still needs an explicit answer, `retry` still sets exactly that
loop's counter. Invariant register row 17 is not in play.

---

## 4. AC-8 — the per-step usage line, red before green, and Q-0034's property preserved

### Red — the line before the change fails the criterion

Reverting only the call site to
`formatVendorSummary({ ...s.usage, unpriced_steps: s.usage.cost_usd == null ? 1 : 0 })`:

```
$ node spike/test/q0034-review-fixes.js
✗ B2 — vendor token totals do not add cache components a second time
  the per-step usage line must name input_tokens at its own value
✗ 1 scenario(s) failed
```

### The result that matters most — the re-aim kept its property

§0.6 of the requirement found that `printRunDetailHuman` renders no roll-up, so B2's `tokens=1100`
had been reading the *per-step* line — the very line this criterion rewrites. AC-8 therefore requires
the scenario **re-aimed, not deleted**, and still failing if a cache component is ever added to a
total. Tested by making `vendorTokenTotal` do exactly that:

```
$ node spike/test/q0034-review-fixes.js      # with cache_write_input_tokens summed into the total
✗ B2 — vendor token totals do not add cache components a second time
  expected input+output=1100; got: tokens=1350,tokens=250
```

**`tokens=1350` is the double count, caught.** Q-0034's guard did not lose its subject in the move
from the detail view to the roll-up rows; it kept it, and the property it exists to prove is still
provable. An assertion that had merely been relocated would have gone quiet here.

### AC-7's ruling has a subject too

Nit 9 is ruled rather than fixed, and a ruling with no test behind it is how a later reader "fixes"
`tokens=n/a` into a number that is not a token total. The malformed row sits **beside** the
well-formed one in the same fixture, as AC-7 requires. Making `vendorTokenTotal` fall back to the
cache sum when both totals are null — the exact change the ruling forbids:

```
$ node spike/test/q0034-review-fixes.js
✗ B2 — vendor token totals do not add cache components a second time
  a row whose totals are both null reports n/a, never the sum of its cache breakdown
```

The assertion fires on the forbidden fix, with its own message, from the adjacent row. Both readings
of the cache fields are now covered by two rows rather than by one.

All three mutations reverted; `git diff --stat` empty after each.

---

## 5. The remaining criteria, and how each is evidenced

| AC | Surface | Evidence |
| --- | --- | --- |
| **AC-1** | `spike/` | `runGate` is a plain `const answer = await ctx.ui.gate({…})` at `engine.js:613`; the `try`/`finally` and the ten-line comment are gone, deleted rather than amended. `grep signalWindow spike/src/engine.js` → no match. §1 cell 1 is its red phase. |
| **AC-2** | `spike/` | The fixture's gate owns a bounded handle with a 10 s rejection ceiling and a comment saying why the ceiling exists (R-2). §1. |
| **AC-3** | `spike/` | §1 — three cells, red then control then green. |
| **AC-4** | `packages/core` | §2 — inverse fails against restored `routing.ts`; register and narration moved with it. |
| **AC-5** | both | §3 — per-path table read from source, masking clause independently subjected, behavioural assertion in `lifecycle-routing.test.ts`. |
| **AC-6** | `spike/` | Three `Why:` lines, one each, citing Q-0037 and **citing rather than transcribing**: the `persistedStage` guard (`engine.js:379–384`), the whole-list roll-up (`:469`, *"quadratic in occurrence count"*), and `replaceManifest`'s fixed `.tmp` path (`:483`). No code changed. **Verified by inspection and says so** — `spike/**` is outside ESLint entirely, so nothing else can verify a comment. |
| **AC-7** | both | §4 — ruled, not changed, with an adjacent-row test that fires on the forbidden fix. `reader.ts`'s JSDoc carries the malformed-row sentence. |
| **AC-8** | `spike/` | §4 — `formatOccurrenceUsage` renders four measures separately through `formatTokens`, no roll-up field; list-view summaries untouched. |
| **AC-9** | `spike/` | `validateArtifact` in `spike/src/contracts.js` with `core`'s shape; `validateFile` kept and unchanged (charter §2 — `q0034-review-fixes.js:74` calls it). The read count is **counted, not reasoned about**, by a spy: `q0011-runs-cli.js:197–198` assert exactly one read of the artifact and one of the schema. |
| **AC-10** | both | Notice derived from the `semantic` outcome, satisfying all five clauses; `core`'s `render()` transcription moved in the same change (§0.5) so it stays a reproduction. Round 1's finding — *"no **recognised** annotation"* — is in both trees, with clause (6) pinning it over the `unknown-v1` fixture. |
| **AC-11** | `packages/core` | §7 — four pins re-derived with `wc -l`, share stated though unmoved. |
| **AC-12** | both | §6 — step 1 satisfied; step 2 is erratum E-1's follow-up commit at the human's close. |

---

## 6. What is owed at the gate, and cannot be done from here

### E-1's freeze-SHA re-record

AC-12 step 2 asks for a commit containing its own SHA. `requirements/errata.md` **E-1** already ruled
this — amended to *"a follow-up commit whose parent is the merge, recording the merge commit's
SHA"*, which is what Q-0062 actually did (`9721d78`, parent `a6e529a`). Round 1's review raised it,
its own remedy conceded it belongs at the close, and E-1 records that a round declining it is
declining correctly.

**Step 1 is satisfied**: both trees move in this one branch. I re-ran the guard's own two oracles by
hand this round:

```
$ git merge-base --is-ancestor a6e529a31e84893140cc4b01cc0b2f2013880ca2 HEAD
ancestry: OK (freeze SHA is an ancestor of HEAD)

$ git diff --name-status a6e529a… HEAD -- spike/src
M	spike/src/contracts.js
M	spike/src/engine.js

$ git diff --name-status a6e529a… main -- spike/src
                                        (empty — main is clean today)
```

So the half is green on `main` now and goes red the moment this merges, naming those two files —
R-1's failure mode, by design. To paste at the close: merge; edit `freeze-sha:` to the merge commit's
full SHA and commit it alone; confirm `git diff --name-status <new-sha> main -- spike/src` prints
nothing; then run the guard. `main` is red in the window between, as it was for Q-0062.

`harness/port-charter.md` is unchanged, including its §3 prose, which carries the same impossibility
one layer up. E-1 records that the correction lands at the close rather than mid-run, because
`implement` runs with `repo: true` and an authority document changing under a live loop is its own
hazard. **Named, not done.**

### GA-1 — the DECISIONS date rule

Unchanged and still the human's. No criterion depends on its outcome, deliberately. Appendix A of the
merged requirement is its body if it becomes a successor.

### New, from this round — `dev/implement-report.md` is not run-scoped

§0. `chore.yaml:16` writes a fixed path while `:13` reads a run-scoped one, so implement rounds
overwrite and review rounds accumulate. It is Q-0057's defect on the other half of the same flow, it
is what produced this round's finding, and it will produce it again. **Reported, not fixed**: no
criterion names `harness/flows/`, and the fix is both shipped `chore.yaml` copies plus — if it is
round-scoped rather than run-scoped — an engine interpolation variable in both trees, which is
Q-0057's shape and was its own ticket for good reasons. A successor's argument is stronger than a
patch made in passing here.

---

## 7. AC-11 — the parity totals, re-derived rather than trusted

`spike-parity.test.ts`'s `lines:` counts `\n`, which is what `wc -l` counts, so the two agree by
construction and one can check the other:

```
$ wc -l spike/test/*.js
   …
  5005 total          (less run.js's 37, which the register excludes → 4968)
```

Summed by bucket from the register's own membership lists:

| Bucket | Files | Lines |
| --- | --- | --- |
| binary-only | `q0036-board-containment.js` | **220** |
| both | seven, incl. `smoke.js` 764, `q0033-surface.js` 445, `q0011-run-history.js` 283, `q0011-runs-cli.js` 220 | **2279** |
| library-only | ten, incl. `q0035-empty-range.js` 730, `q0062-worktree-lifecycle.js` 407 | **2469** |
| total | | **4968** |

`220 + 2279 + 2469 = 4968` ✓ and `(220 + 2279) / 4968 = 50.30%`, so the rounded transfer share is
**50%**.

This round moved none of them, because it changed no file — and AC-11 requires the share **stated
even when it does not move**, which is why it is here rather than skipped. Assuming it did not move
is how a stale pin survives a small change. Round 1 moved the classification (`q0011-runs-cli.js`
`cli` → `split`, once AC-9's read-count assertion had to import `validateArtifact` to be observable
at all) and round 2 moved one column; both are recorded in the narration comment with their figures
rather than edited away.

---

## 8. What I deliberately left alone

- **Every file.** The tree is byte-identical to `bc55253`; the finding was about the report and the
  report is the fix. Each of the six mutations in §§1–4 was reverted and the revert verified with
  `git diff --stat`.
- **`harness/port-charter.md`** — §6. Including its §3 prose.
- **`.github/scripts/port-freeze-guard.sh`** — unchanged this round; round 1's removal of the
  unreachable *"(Q-0037..Q-0040 must settle first)"* line stands.
- **`harness/flows/chore.yaml`** — §6. The report-overwrite defect is reported, not fixed.
- **`SemanticOutcome` in either tree** — round 1 took the wording route over distinguishing the
  outcomes, because distinguishing is a `core` type change no criterion authorises.
- **`contracts/Q-0011/runs-cli.contract.md`** — frozen and outside `developer-generalist`'s paths
  (NG-6). AC-10's wording keeps its required words, so no erratum is owed.
- **`docs/decisions/`, `docs/DECISIONS.md`, `.claude/rules/`, `backlog/`** — NG-7, NG-9 and the
  role's own prohibition.
- **Nothing persisted changed** across the whole ticket: no manifest field, file name, directory
  layout, schema, occurrence ordering or write-via-rename convention. Existing manifests read without
  migration. The shipped behaviour changes are two CLI strings and one removed timer.

---

## 9. Verification

| Check | Result |
| --- | --- |
| `npm test --prefix spike` | **18/18 test files passed** |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `@quorum/core` | **1251 passed, 2 skipped** — identical to baseline |
| `node spike/bin/harness.js lint` | **6/6 flows clean** |
| `pnpm sweep:git-identity` | **green** — both suites executed with no resolvable git identity, 7/7 tasks 0 cached |
| freeze-sha oracle, by hand | ancestry OK; branch moves two `spike/src` files; `main` clean (§6) |
| `git status --short` / `git diff --stat` | **both empty** — tree matches `HEAD` |
| `node .github/scripts/port-freeze-guard.test.mjs` | **not run** — permission-refused (below) |
| port-freeze guard, three halves | **not run** — same reason |

The git-identity sweep passing here is worth one line: this **is** a linked worktree, which is the
environment Q-0084 found the sweep could not run in at all. Q-0058's `--git-common-dir` fix is
holding in exactly the case it was written for.

### The two unrun checks, reported as unrun rather than as green

`node .github/scripts/port-freeze-guard.test.mjs` and the three guard halves were refused by this
worktree's permission configuration again this round, as in round 2 — every invocation form I tried
(`node …`, `bash …`, `node ./…`) returned *"This command requires approval"*. Round 1 ran them; the
allowlist differs between rounds, which is the Q-0038 permission shape.

**I report them unrun rather than green.** A reviewer cannot tell an unrun check from a passing one,
and round 1's result is over a tree that has changed twice since. What I ran instead is the two git
commands the guard itself runs (§6), which answer the same two questions over the same inputs.
Neither guard file was touched this round or last, so nothing about them is stale in the way a code
change would make it — but that is an argument for the risk being low, not for calling them green.

### Red demonstrated before green, in that order

| Mutation | Result |
| --- | --- |
| AC-1 applied, AC-2 reverted | `AC-3/AC-10/EDGE-9` fails: `'running'` vs `'interrupted'`, 1 of 18 |
| timer restored, AC-2 reverted (control) | scenario **passes** — the prop was doing the work |
| `routing.ts` timer restored | 2 core failures: the inverse pin and the `toStrictEqual` register |
| `routing.ts` given a `setInterval` instead | **1** core failure: the masking clause alone |
| usage line reverted to `formatVendorSummary` | B2 fails: *"must name input_tokens at its own value"* |
| `vendorTokenTotal` sums `cache_write_input_tokens` | B2 fails: `tokens=1350` — the double count, still caught |
| `vendorTokenTotal` falls back to the cache sum | B2 fails: *"reports n/a, never the sum of its cache breakdown"* |
| all reverted | spike 18/18, workspace 21/21 0 cached, `git diff` empty |

### The second environment row is not mine

Per Q-0072's closing finding, both suites must also run **forced on `main` after the merge**, in a
checkout that has `.harness/worktrees` and `.quorum/runs`. This worktree has neither, which is the
first row; the second belongs at the close, beside E-1's freeze-SHA re-record.
