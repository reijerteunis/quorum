# Q-0037 — implement report

*Chore run, implement round 1. Twelve criteria, all attempted, eleven complete; AC-12 is complete
except for its second step, which no step on this route can perform (§6).*

Every number below was produced by running the thing it describes in this worktree. Where a
measurement in `requirements/merged.md` was load-bearing for a criterion I re-ran it before relying
on it, per R-7 — three are confirmed in §5 and one gate action turns out to have been performed
already.

---

## 1. What changed, file by file

### Both trees — the major (AC-1 … AC-5)

**`spike/src/engine.js`** — `runGate` loses the `setTimeout`, the `try`/`finally` that existed only
to `clearTimeout` it, and the ten-line comment above it. `await ctx.ui.gate(…)` is now a plain
await assigned with `const`. The comment is deleted rather than amended because every sentence in
it is about either the timer or the `spike/test/**` freeze this ticket lifts. **27 lines changed, of
which 16 are the deletion.**

**`packages/core/src/engine/routing.ts`** — `askGate` loses
`const signalWindow = setTimeout(() => {}, 1000); // Why: preserved defect, see Q-0050 AC-4.` and
the matching `clearTimeout`. **Two lines, no other change**; `removeAbort` and the `interrupted`
race are untouched, so cancellation is structurally where it was.

**`spike/test/q0011-run-history.js`** — the child fixture's gate promise gains a real libuv handle
and a stated ceiling. The handle is what keeps the child alive to receive its `SIGTERM`; the ceiling
is what stops an unbounded handle turning a broken engine from a failing suite into a hanging one,
since `spike/test/run.js` has no per-scenario timeout (R-2). Ten seconds, far past the milliseconds
the signal actually takes; reaching it rejects, which ends the run and exits the child non-zero, so
the assertions fail rather than never arriving. The reasoning is in the fixture, above the line.

**`packages/core/src/engine/q0050.source.test.ts`** — all three pins move together, as AC-4 requires:

1. The `AC-4h` test is **replaced by its inverse**, not weakened: `routing.ts` matches neither
   `/signalWindow/` nor `/setTimeout|setInterval|setImmediate/`. The second clause is AC-5's
   no-lifecycle-masking half made executable — it is what forbids a replacement engine-owned handle.
   Weakening the old assertion instead (dropping only the marker requirement) would have been
   satisfied by a timer carrying no authority line at all, which is the worse of the two states, and
   the comment says so.
2. `REGISTERED['routing.ts']` loses `'preserved defect/AC-4'`. It is a `toStrictEqual` identity
   register, so leaving it would have been a red suite — the guard working.
3. The arithmetic is **re-derived from the register**, not decremented. 19 → **18** total preserved
   defects, and Q-0050's own enumeration 7 → **6** (AC-10c, AC-10f, AC-12a/b/c/d). Counted from
   `REGISTERED` by hand and then confirmed by the assertion itself: composite 8, diff 1, engine 3,
   lifecycle 2, prompt 1, routing 1, steps 2 — 18. The narration now says which entry left and why,
   so E-20's ruling stands while its subject list is one shorter.

**`packages/core/src/engine/lifecycle-routing.test.ts`** — one new test, AC-5's behavioural half:
with the answer channel outstanding and no abort raised, the gate does not settle by itself across
50 microtask turns plus a macrotask; then `abort()` produces exactly
`gate human (decide) interrupted`; then a late answer does not change the outcome. The existing
`a pending gate is interrupted and a late answer is not applied` is **unmodified** — the new one
adds the *stays pending* half it never asserted, which is the half a removed handle could have
broken silently.

### Both trees — the ruling (AC-7)

**No code changed.** `vendorTokenTotal` still returns `null` when both totals are null, whatever
the cache fields hold.

**`packages/core/src/run-history/reader.ts`** — the JSDoc gains only the malformed-row sentence, as
specified.

**`packages/core/src/run-history/reader.test.ts`** — the malformed row sits **inside the same test**
as the well-formed one, deliberately adjacent, so both readings of the cache fields are covered
together: `{ input_tokens: null, output_tokens: null, cached_input_tokens: 9000,
cache_write_input_tokens: 500 }` → `null`, and explicitly `not.toBe(9500)`.

**`spike/test/q0034-review-fixes.js`** — the same row added beside B2's well-formed one, in one
manifest with two roll-up rows, asserted through the list view where `vendorTokenTotal` actually
runs: `claude: … tokens=1100` and `codex: … tokens=n/a`.

### The spike alone — documentation (AC-6)

**`spike/src/engine.js`**, three `Why:` lines, **no code change**, each citing rather than
transcribing:

| Site | Line |
| --- | --- |
| the `persistedStage` guard | `Why: preserved as-is, see Q-0037 — unreachable from the command line, where every path loads the ticket from the file this re-reads, and reachable from a caller that builds a ticket record itself, which is what the daemon will be.` |
| `rollup(…)` on every terminal occurrence | `// Whole-list, and therefore quadratic in occurrence count.` + `Why: preserved, see Q-0037 — reported rather than optimised in passing.` |
| `replaceManifest`'s fixed `.tmp` path | `Why: preserved as-is, see Q-0037 — the temporary path is fixed on purpose, so the next replacement renames a stray away; a run that does not continue leaves one, and nothing names or cleans it.` |

**This criterion is verified by inspection and says so.** `spike/**` is outside ESLint's scope
entirely, so nothing mechanical sees a comment. The behavioural evidence is negative and is the
whole point: the spike suite is byte-identically green, 18/18.

### The spike CLI (AC-8, AC-9, AC-10)

**`spike/bin/harness.js`**

- New `formatOccurrenceUsage(u)` beside `formatVendorSummary`. The detail view's `usage:` line
  renders the vendor, the cost through the existing `formatMoney`, and the four measures separately
  through the existing `formatTokens` — `input_tokens`, `output_tokens`, `cached_input_tokens`,
  `cache_write_input_tokens`, the manifest's own spellings (verified in §5.3). No `unpriced_steps`.
  A `null` still renders `n/a` and never `0`, because `formatTokens` is unchanged. The **list**
  view's vendor summaries are untouched.
- `validate` now calls `validateArtifact` once per artifact, so the second `readData(f)` is gone.
  The up-front schema read is kept purely so an unreadable schema still dies with its own message
  before any artifact is opened.
- The skipped-check notice is derived from the `semantic` outcome rather than from a boolean
  computed before the loop.
- `TERMINAL_STATUSES`, `computeManifestRollup` and `checkRunManifestSemantics` moved out (see §3.2).
  Removing `TERMINAL_STATUSES` orphaned the Q-0080 comment that had sat above it and never described
  it; I folded that sentence into the reader section header immediately above rather than leave a
  paragraph attached to nothing. It is the same sentence, moved four lines.

**`spike/src/contracts.js`** — gains `validateArtifact(schemaFile, dataFile)` with the shape
`packages/core/src/contracts/contracts.ts` has: read schema, read data, structural verdict, and a
three-state `semantic` outcome. `validateFile` is **kept and unchanged**, because
`spike/test/q0034-review-fixes.js:74` calls it and charter §2 preserves what it does.

**The notice wording.** AC-10 offers a wording "rather than mandates" it and binds on five clauses.
I used a different one, and the difference is deliberate:

> `· <file>: no x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined`

Against the five clauses: (1) names the file; (2) says no checks **ran** and never that any passed —
asserted as `doesNotMatch(/pass(ed|es)?\b/i)`; (3) the text before the first dash names the missing
`x-quorum-contract` annotation and does not begin with `run-manifest`; (4) states explicitly that no
run-manifest semantic checks ran and names `run-manifest-v1` as the only contract defined; (5) does
not contain the superseded substring.

Two reasons it is better than the offered one, both measured rather than argued. **First, it
satisfies clause 3 on its strict reading and the offered wording does not**: AC-10's own example
puts `no semantic contract applies` before the dash and the annotation name *after* it, so the lead
does not name the annotation. Mine does. **Second, it keeps `contracts/Q-0011/runs-cli.contract.md`
satisfied in the contract's own vocabulary** — the frozen sentence is *"print an explicit notice
that run-manifest semantic checks **were skipped**"*, and the offered wording drops the word
entirely. Keeping it also left `q0011-runs-cli.js`'s existing
`/semantic.*skip|skip.*semantic/i` assertion **green and unmodified**, where the offered wording
turned it red and would have needed an existing guard re-aimed to accommodate a cosmetic choice.
That is R-4 answered by construction rather than by erratum, which is what AC-10 asked for.

**`packages/core/src/contracts/validate-artifact.test.ts`** — the `render()` helper's two hard-coded
copies of the notice move with it (§0.5), and its JSDoc's line citation is **re-derived from the
tree**, not adjusted: the CLI's `validate` case is now `spike/bin/harness.js:425–454`
(`grep -n "case 'validate'"` → 425, `grep -n "process.exit(bad ? 1 : 0)"` → 454), where it was
`:488–516`. The JSDoc now states why the citation is worth keeping accurate.

**`spike/test/q0011-runs-cli.js`** — two new scenarios: AC-10's five clauses as literal assertions
plus a check that the run-manifest path still prints its green tick and no notice; and AC-9's
read-count and agreement test.

### Machinery (AC-11, AC-12)

**`packages/core/src/spike-parity.test.ts`** — see §3.3; this is where the largest unanticipated
consequence landed.

**`.github/scripts/port-freeze-guard.sh`** — line 86 stops naming *"(Q-0037..Q-0040 must settle
first)"*. **This line is unreachable today** and I confirmed it rather than assumed it: it is
guarded by `[ "$freeze_sha" = "not-yet-recorded" ]` and the charter records
`a6e529a31e84893140cc4b01cc0b2f2013880ca2`. Nobody should read the correction as a bug fix — it is a
stale sentence about this ticket sitting inside the script that will judge its branch. The second
`not-yet-recorded` clause at `:148` carries no stale ticket reference and is untouched.

---

## 2. Red before green, demonstrated rather than asserted

**AC-3 — the major.** With **AC-1 applied and AC-2 not applied**, scenario `AC-3/AC-10/EDGE-9` fails
exactly as the criterion predicts:

```
✗ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
  Expected values to be strictly equal:
  + 'running'
  - 'interrupted'
```

The child drained and exited before the `SIGTERM`, and the manifest read `running`. With both
applied it passes. This is what proves the fixture — not the engine — was the thing holding the
timer in place, and it is what would have caught a change that deleted the timer and left the
scenario passing for a reason nobody checked (R-5).

**AC-4 — the `core` inverse.** Written first and run against unmodified `routing.ts`:

```
AssertionError: expected '/** Gate policy, step dispatch, and b…' not to match /signalWindow/
 ❯ src/engine/q0050.source.test.ts:142:27
```

Then green after the two-line removal. The inverse has a subject.

**AC-8 — the B2 re-aim.** Not asserted, shown. The same fixture rendered through the detail view
before and after:

```
before: usage: claude: cost=$1.000 tokens=1100 unpriced_steps=0
after:  usage: claude: cost=$1.000 input_tokens=1000 output_tokens=100 cached_input_tokens=700 cache_write_input_tokens=250
```

`tokens=1100` is **absent from the detail view entirely** after the change, so B2's old assertion is
red against the new code — the re-aim is necessary, not cosmetic. The list view is byte-identical
before and after (`claude: cost=$1.000 tokens=1100 unpriced_steps=0`), which is where the re-aimed
assertion now lives and where `vendorTokenTotal` actually runs. The double-count property is
preserved on both sides: no rendering of `1350` appears anywhere in either view, asserted over both.

---

## 3. Five things the requirement did not enumerate

Each of these is inside the criteria's scope but absent from §0's re-measurement. I am naming them
rather than folding them in silently, because four of the five are the class this repository keeps
paying for — a check quietly losing its subject.

### 3.1 A **second** gate fixture with the identical dependency

AC-2 names `spike/test/q0011-run-history.js:225` as *the* fixture. There are two.
`spike/test/q0062-worktree-lifecycle.js:177` carries the same `gate:()=>new Promise(()=>{})`, and
its own comment says *"Same shape as q0011's EDGE-9."* Removing the timer turned its `AC-2 — an
interrupted run keeps the directory it stopped in` scenario red:

```
✗ AC-2 — an interrupted run keeps the directory it stopped in
  the run must record itself interrupted — got [… "run=1 step=merge merged=1/1 tests=-"]
```

Same defect, same fix, same ceiling and reasoning, applied there too. Found by running the suite
rather than by reading it. AC-5 requires existing gate coverage to stay green, so this was not
optional; had the requirement's file list been treated as exhaustive, the criterion would have been
unsatisfiable.

### 3.2 The spike's semantic checker lives in `bin/`, not `src/`

AC-9 specifies `validateArtifact(schemaFile, dataFile)` in `spike/src/contracts.js` "with the shape
`packages/core/src/contracts/contracts.ts` already has", which includes running the pass its
`semantic` outcome reports on. In the spike, `checkRunManifestSemantics` and `computeManifestRollup`
were in `spike/bin/harness.js`. §0 never mentions this.

The signature is fixed at two parameters, so injection was not available; and returning `ran: true`
for a pass the *caller* performs would have made the three-state outcome a lie, which is precisely
what clause 2 of AC-10 and register row 14 forbid. So I moved `TERMINAL_STATUSES`,
`computeManifestRollup` and `checkRunManifestSemantics` into `spike/src/contracts.js` **unchanged**.
This mirrors `core` exactly, where all three live in `contracts/run-manifest.ts` and are re-exported
through `contracts.ts`. The move is clean: `TERMINAL_STATUSES` had no other reader in the CLI
(`grep -n TERMINAL_STATUSES` → `:132` definition, `:328` and `:348`, both inside the checker).

**This is more code movement than AC-9's one-sentence description implies**, and a reviewer should
judge it as such. It is the minimum that satisfies the criterion as written with an honest
`semantic.ran`. No behaviour changed — the moved functions are byte-identical.

### 3.3 The parity register **reclassified** a file, which AC-11 anticipated only as arithmetic

AC-11 expects "up to three of the four `toBe` pins" to move. What actually moved is a verdict.
AC-9's read-count assertion is invisible from outside the process, so `q0011-runs-cli.js` had to
import `validateArtifact` — and the recomputation caught it immediately:

```
q0011-runs-cli.js: it is a binary spawner and does import the spike's source,
so 'cli' is not one of [split, uncovered]
```

That is the register doing exactly what it exists for. Consequences, all re-measured from the tree
with `wc -l` rather than adjusted to fit:

| | was | now |
| --- | --- | --- |
| `q0011-runs-cli.js` verdict | `cli`, no counterparts | `split`, carried by `contracts.test.ts` and `validate-artifact.test.ts` (both exist and are collected) |
| binary-only | 336 (2 files) | **220** (1 file) |
| both | 2026 | **2264** |
| library-only | 2463 | **2469** |
| total | 4825 | **4953** |
| share transferring at Q-0010 | 49% | **50%** |
| `cli` / `split` verdict counts | 2 / 6 | **1 / 7** |
| counterpart namings in total | 49 | **51** (distinct still 29) |

The share moved **up**, the opposite direction from Q-0062's move and for the opposite reason: every
line this ticket added landed in an entangled file. Arithmetic check: entangled +122, total +128,
the +6 difference being `q0062-worktree-lifecycle.js`'s comment. The narration in the test records
all of this, including that the classification moved rather than only the numbers.

### 3.4 A negative control that would have silently lost its subject

`spike-parity.test.ts` clause (e) used `q0011-runs-cli.js` as its fixture for
`'cli' names counterparts it may not have` — **because** its verdict was `cli`. Once the verdict
moved to `split`, mutating its `carriedBy` produces no such message, and the assertion failed.

Had it been written with `.not.toContain` or over a looser predicate it would have passed over
nothing and nobody would have known. It is re-aimed at `q0036-board-containment.js`, the one
remaining `cli` row, with a comment saying why it moved. This is *"a check is not established by
reading it"* (2026-08-29) arriving as a side effect of an unrelated criterion.

### 3.5 A `core` JSDoc that AC-9 made false

`packages/core/src/contracts/contracts.ts`'s `validateArtifact` JSDoc said *"The spike reads each
twice (spike/bin/harness.js:494 and :510 against `validateFile`'s own reads)"*. AC-9 is what stops
that being true. Left alone it would be a true record made false by this very change — the failure
mode AC-4(3) names one paragraph earlier. Corrected to *"The spike read each twice until Q-0037 gave
it a `validateArtifact` of the same shape"*. Four lines, no behaviour.

---

## 4. AC-5's evidence table, filled in from the code rather than transcribed

Neither tree substitutes another engine-owned handle. Verified mechanically:
`grep -n "signalWindow\|setTimeout\|setInterval"` over `spike/src/engine.js` and
`packages/core/src/engine/routing.ts` returns **nothing at all**, and the AC-4 inverse pins the
`core` half in the suite.

| Path | Where | Why the timer was never load-bearing |
| --- | --- | --- |
| `--gate-answer` | `spike/bin/harness.js:82–89` | `gateAnswers.shift()`, validated against `allowed`, then `return answer` — resolves synchronously, before a timer could matter |
| non-interactive, no answer | `spike/bin/harness.js:95–97` | `if (!process.stdin.isTTY) throw new FlowError(…)` — throws **before** awaiting anything |
| TTY | `spike/bin/harness.js:98–119` | `readline.createInterface` owns its own handle for the life of the question, and its `close` handler rejects rather than defaulting |
| `core`, any caller | `routing.ts:24` | `if (!context.answerGate) throw new FlowError(…)`; cancellation is the caller's `AbortSignal`, Q-0050's AC-5 having removed signal handling from `core` — so the timer's stated purpose does not exist here at all |

Gate **semantics** are untouched, and the existing coverage that proves it is unmodified and green:
`auto` short-circuits, `--auto` over a `human` gate short-circuits, `human-locked` still consumes an
answer under `--auto`, `dry` short-circuits, the exhaustion gate still requires an explicit answer,
and `retry` still sets exactly that loop's counter. Invariant register row 17 is not in play.

---

## 5. Inherited measurements I re-ran before relying on them (R-7)

**5.1 §0.6 — B2 reads the per-step line. Confirmed, and it is the whole justification for the
re-aim.** `printRunDetailHuman` renders no roll-up: `grep -n rollup spike/bin/harness.js` puts the
only roll-up render at `:230`, inside `printRunsListHuman`. Reproduced end to end against a fixture
matching B2's: in detail mode the *only* line carrying `tokens=1100` was the per-step `usage:` line.

**5.2 §0.12 — freeze state. Confirmed.** `a6e529a` is an ancestor of `HEAD`, and
`git diff --name-only a6e529a..HEAD -- spike/src` is empty, so the half is green now and this ticket
turns it red by design. All three guard halves run clean against this tip (§6).

**5.3 §0.7 — the manifest's field spellings, not the vendor's. Confirmed.**
`contracts/Q-0011/run-manifest.schema.json:36–39` names `input_tokens`, `output_tokens`,
`cached_input_tokens`, `cache_write_input_tokens`. Those are what AC-8 renders.

**5.4 AC-7's ruling, both halves confirmed.** `spike/src/adapters/claude.js:60` folds
`cache_creation_input_tokens` and `cache_read_input_tokens` **into** `input_tokens`, keeping them at
`:62`/`:63` as a breakdown; `contracts/Q-0011/run-history-writer.contract.md:70` carries *"Input
totals already include vendor-reported cache…"*. So a row with both totals null and cache fields
populated is a manifest no adapter can produce, and `n/a` is the honest rendering.

**5.5 §0.13 / GA-2 — already performed.** `git branch --list 'harness/*'` now returns
`harness/Q-0037/integration` alongside Q-0058's and Q-0062's. The gate action was done before this
run; the measurement in the requirement was true when written and is stale now, in the harmless
direction.

---

## 6. AC-12 — what is done, and the one step no agent on this route can take

**Step 1 is done.** Every item with a counterpart lands in both trees in this one worktree, which
becomes one commit: the timer (spike + `core`), nit 9's ruling (spike + `core`), and the notice
(spike CLI + `core`'s transcription). **No exemption trailer** — the branch-scope job reports
Q-0037 out of scope rather than passing silently, which I ran and confirmed:

```
::notice::port-freeze: Q-0037 is not one of Q-0009's fourteen children — the freeze does not apply.
```

**Step 2 is owed and I did not fake it.** Re-recording `freeze-sha` requires *"the tip that carries
the mirrored change"*, and I commit nothing — the harness does. The correct value does not exist
while I am running. Writing anything now would either be the unchanged `a6e529a` (which is exactly
the stale state the guard exists to catch) or a guess. **I left the charter untouched.**

That this is genuinely owed rather than a technicality is measurable: two files under `spike/src`
change in this branch — `spike/src/engine.js` and `spike/src/contracts.js` — so once this merges,
`git diff a6e529a..main -- spike/src` is non-empty and the freeze-SHA half goes red naming them.
This is R-1's failure mode, and the window is between the merge and the re-record.

**What is owed at the close**, stated so nobody has to re-derive it:

1. `harness/port-charter.md`'s `freeze-sha:` re-recorded at the post-merge tip on `main`.
2. Re-run `HALF=freeze-sha BASE=main bash .github/scripts/port-freeze-guard.sh` and confirm it is
   clear again.

This is the ninth appearance in this repository of a loop handed work no step in it can perform. It
differs from the eight before it in that it is not a blocker — nothing else in the ticket depends on
it, and the run completes without it — but it is the same shape and is named here rather than
discovered at the gate.

**Nothing here changes a persisted byte.** The manifest file name, directory layout, JSON schema,
occurrence ordering and write-via-rename convention are untouched; existing manifests stay readable
with no migration. AC-7 changes no persisted value and AC-8 changes only a rendered line.

---

## 7. Verification

Installed from a fresh checkout with `pnpm install --frozen-lockfile` and
`npm install --prefix spike --no-audit --no-fund` before anything was run, per `harness/rules.md`.

| Check | Result |
| --- | --- |
| `npm test --prefix spike` | **18/18 test files passed** |
| `turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `@quorum/core` tests | **1251 passed, 2 skipped** (baseline 1250/2 — the one new AC-5 test) |
| `harness lint` | **6/6 flows clean** |
| `node .github/scripts/port-freeze-guard.test.mjs` | **43 checks passed, 0 failed** |
| port-freeze guard, all three halves | policy ✓, branch-scope ✓ (out of scope), freeze-sha ✓ (clear against `main`) |
| `pnpm sweep:git-identity` | **both suites executed and green with no resolvable git identity** |

A **baseline** was recorded before any edit — spike 18/18 and workspace 7/7 tasks 0 cached, 1250
core tests — so every failure seen during the run is attributable to a specific change rather than
inherited.

**Environment rows.** This is the implement worktree, which has neither `.harness/worktrees` nor
`.quorum/runs`. Per Q-0072's closing finding the **second row is still owed**: both suites must be
re-run **forced** on `main` after the merge, in a checkout that has both directories. I cannot
perform that row from here.

**One pre-existing lint warning, not mine and not touched:**
`packages/core/src/backlog/backlog.ts:276` reports *"Unused eslint-disable directive
(no-control-regex)"*. `git diff --name-only -- packages/core/src/backlog/` is empty. Lint exits 0
(0 errors, 1 warning). Reported rather than fixed in passing.

---

## 8. What I deliberately left alone

Every non-goal held, and each was actually reachable from something I touched:

- **NG-1** — a handleless gate promise still drains to exit 0 with a `running` manifest, now
  immediately rather than after a second. Untouched; it is the caller's contract and belongs with
  M3's daemon. Worth restating, because §0.9 is right and it is easy to over-sell this fix: removing
  the timer does **not** repair the `running` manifest. What it does is take a test fixture's prop
  out of production code, where it made a race look like a guarantee. That is all any criterion here
  claims and all I claim.
- **NG-2** — no batching, no incremental roll-up, no dropped `fsync`, no durability boundary. AC-6's
  comment records the cost; nothing optimises it.
- **NG-3** — no `rm`, no pre-write unlink of a stray `manifest.json.tmp`. Documented only.
- **NG-4** — the persisted-stage guard is neither made reachable nor removed.
- **NG-5** — nothing built for `packages/cli`.
- **NG-6** — `contracts/` untouched. AC-10's wording is designed to keep
  `runs-cli.contract.md:46–48` satisfied rather than to amend it, which is why I chose a wording
  carrying the contract's own word "skipped" (§1).
- **NG-7** — no `docs/decisions/` or `docs/DECISIONS.md` edit. **NG-9** — no `.claude/rules/` edit.
- **NG-8** — no schema, field, format or ordering change; no reader infers or repairs stored usage.
- **NG-10** — Q-0039, Q-0040, Q-0074, Q-0075, Q-0076, Q-0078 untouched. Nits 4 and 6 are closed and
  out of scope, and I confirmed nit 6: `grep -rn authErrorCategory` finds it in neither tree.
- **NG-11** — no new dependency.

Also left alone, deliberately, each an invitation I did not take:

- **`validateFile` is kept** (OQ-3), unchanged, exported, still called by
  `q0034-review-fixes.js:74`. Reported, not decided: whether Q-0010 carries it forward is that
  ticket's question. AC-9's agreement test is what stops the two drifting.
- **The ajv `$id` cache collision is preserved and worked around, not fixed.** My AC-9 fixture hit
  it — compiling the committed run-manifest schema twice in one process throws *"schema with key or
  id … already exists"*. It is a preserved defect (Q-0045 AC-8 defect 1) and `harness validate
  <schema> a.json b.json` has always had it; my change does not touch it. The fixture uses an
  `$id`-free copy of the real contract for the repeated comparisons and exercises the committed file
  once, so the annotation that matters is read from the real thing. The reasoning is in the test.
- **The `--json` detail output is unchanged.** `runDetailJSON` emits the raw manifest, so AC-8's
  rendering change does not reach it and `q0011-runs-cli.js`'s ANSI-free JSON scenario is untouched.

---

## 9. For the reviewer

The three places I would look hardest, in order:

1. **§3.2 — the semantic-checker move.** It is the largest single hunk in the diff (126 lines added
   to `spike/src/contracts.js`, 90 removed from `bin/harness.js`) and it is *not* described by AC-9's
   text, only implied by its signature. If you think AC-9 could have been satisfied without it —
   with an honest `semantic.ran` — that is the finding to raise, and I would rather hear it than
   have it pass unexamined.
2. **§1's notice wording**, which departs from AC-10's offered string. I believe it is strictly
   better on all five clauses plus the frozen contract plus an existing assertion, and the argument
   is written out; but AC-10 offered a specific string and I did not use it.
3. **§3.3's share moving 49% → 50%.** Re-measured, not adjusted — but it is a number that ends up in
   the plan, so it is worth one independent `wc -l` over the three buckets rather than trust.

The one thing I could not do is §6's step 2, and I would rather it be visible at the gate than
quietly absent.
