> **Note on file surfaces used below.** Every line number, byte count and duration in this document
> was re-measured against the working tree at `179b236` on 2026-09-01 while merging, not transcribed
> from either candidate or from the ticket body. Where a measurement contradicts a candidate, the
> contradiction is stated with the command or the file that produced it — *"a measurement copied
> from a document is not a measurement"* (Q-0058).

# Q-0037 — Run-history review remainder: merged requirements

*Head of product, 2026-09-01. Merged from `candidate-claude.md` and `candidate-codex.md`; see §10
for what each contributed and where both were overruled.*

---

## 0. What the merge re-measured, and what it changed

Only the measurements that move a criterion are here. Both candidates re-measured well; these are
the points where they disagree with each other, with the ticket body, or with the tree.

**0.1 — `docs.test.ts` asserts order, twice, and that settles the verdict.** The ticket body says it
*"asserts nothing about order"*. It asserts both halves: `every entry file is listed once, in the
order the folder holds them` (`packages/shared/src/docs.test.ts:100`) and `the dates never go
backwards — the index is append-only, newest last` (`:112`, a `localeCompare` sort compared against
the listed order). So the contradiction the body raises is **already enforced closed** — a
back-dated entry cannot land, because it takes the last row and turns the date assertion red. What
is missing is not a guard but a sentence: nobody wrote down which date an entry carries, and a test
is currently the only thing that answers. That makes the DECISIONS question a **ratification with a
successor**, not a precondition. Candidate-codex's blocking gate action (*"Q-0037 may start
implementation only after the decision is present on its base branch"*) is **overruled**: no
criterion below depends on its outcome, and attaching a decision-entry precondition to a
remainder-clearing chore is the exact shape that has exhausted eight loops in this repository. See
§7 GA-1 and Appendix A.

**0.2 — Nit 2 is measured for the first time, and it is a ruling.** Both the body and the original
round-2 finding call the whole-manifest re-serialise *"quadratic in occurrence count … (unmeasured)"*.
Measured over all **71** run directories: the largest manifest anywhere is
`.quorum/runs/Q-0050-4/manifest.json` at **13,924 bytes over 18 occurrences**, whose own
`duration_ms` is **3,755,327**. Replaying that manifest's full `replaceManifest` cycle 18 times at
full size is ~3 ms — and that over-estimates, because the real writes grow from empty. Three
milliseconds against sixty-three minutes. Candidate-codex's AC-5, AC-6 and AC-7 (batched persistence
with an explicit durability boundary) are **overruled**: they are a behaviour change to the one
write path that must never lose a step a vendor has billed for, bought for a measured nothing, and
they would need charter §2 authority this ticket has no reason to spend.

**0.3 — Three nits are already documented in `core`, not one.** The body says this only of nit 1.

| Nit | `core`'s record | `spike`'s record |
| --- | --- | --- |
| 1 stage guard unreachable from the CLI | `run-history/writer.ts:235` — `Why: preserved as-is, see Q-0037 …` | `engine.js:379–384`, **nothing** |
| 2 whole-manifest re-serialise | `run-history/writer.ts:363–364` — `// Whole-list, and therefore quadratic in occurrence count.` / `// Why: preserved, see Q-0037 — reported rather than optimised in passing.` | `engine.js:468`, **nothing** |
| 3 stray `manifest.json.tmp` | `run-history/writer.test.ts:507` — a test named *"the temporary path is fixed, so a stray is consumed by the next replacement and never read"*, whose comment names Q-0037 | `engine.js:478–480`, **nothing** |

That test also **disposes of candidate-codex's AC-8/AC-9/AC-10**: it demonstrates that the next
replacement renames the stray away with **no pre-write unlink**, so an explicit `rm` adds a
filesystem call and no behaviour. The residual — a run that does *not* continue leaves one forever —
is not reachable by a pre-write unlink either, because there is no next write. Nit 3 is
documentation.

**0.4 — Nit 8's obvious fix collides with a frozen contract the implementer may not edit.**
`contracts/Q-0011/runs-cli.contract.md:47–48`: *"If the annotation is absent or unrecognised, print
an explicit notice that **run-manifest semantic checks** were skipped."* The current message is
literally compliant. `contracts` is **absent from `developer-generalist`'s `paths`**
(`harness/roles/developer-generalist.md:2` — `package.json, pnpm-workspace.yaml, turbo.json,
tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, spike, harness, docs`), so no step on
this route may amend it. **Candidate-codex's AC-16 is overruled**: `semantic checks skipped:
unrecognised contract annotation` drops the words the contract requires. AC-10 below specifies a
wording that satisfies the contract's sentence *and* stops the notice reading as a missing check —
*"An erratum is the last repair, not the first"* (2026-08-30) applied a stage earlier, because the
contradiction is provable now.

**0.5 — Nit 8 is not spike-only, which neither candidate found.**
`packages/core/src/contracts/validate-artifact.test.ts:150` and `:173` carry the notice **verbatim**,
inside a `render()` helper whose own JSDoc says it is *"transcribed from spike/bin/harness.js:488–516
and driven entirely by `validateArtifact`'s return value"*. It is self-contained, so changing the
spike leaves it **green and no longer a reproduction of the CLI** — a check reporting success over a
subject it has stopped matching, which is this repository's most-recorded defect class. AC-10 moves
it in the same change.

**0.6 — AC-8 breaks Q-0034's double-count guard, which neither candidate found.**
`printRunDetailHuman` (`spike/bin/harness.js:247`) prints the header and the per-step lines and
**never renders the roll-up**. So in `spike/test/q0034-review-fixes.js` B2, which invokes
`cli(root, ['runs','Q-0011-1'])`, the assertion `assert.match(out, /tokens=1100\b/)` (`:94`) matches
the **per-step** `usage:` line — the exact line nit 5 rewrites. Both candidates asserted that
existing vendor-summary coverage is untouched; for this file that is false. AC-8 therefore re-aims
B2 rather than breaking it, preserving the property it exists to prove — `cache_write_input_tokens`
is never added to a total that already contains it — which is *"re-aim the assertion at evidence
that survives the change"* (Q-0062).

**0.7 — Nit 5's field names come from the manifest, not from the vendor.**
`contracts/Q-0011/run-manifest.schema.json:36–39` and `:82–85`: `input_tokens`, `output_tokens`,
**`cached_input_tokens`**, **`cache_write_input_tokens`**. Candidate-codex's AC-12 names
`cache_read_input_tokens` and `cache_creation_input_tokens`, which are the vendor's spellings that
`spike/src/adapters/claude.js` folds *into* `input_tokens`. Candidate-claude's spellings are correct
and are what AC-8 uses.

**0.8 — Nit 5 is otherwise unconstrained.** The same contract's *"Every summary states
`unpriced_steps`"* (`:25`) sits inside the **List rows** paragraph, describing *"separately labelled
vendor summaries"*; the **Detail** paragraph (`:27–30`) requires *"adapter, model, status, start,
duration, verdict, usage, error, and the project-relative step-directory path"* and names no roll-up
field. `spike/test/q0011-runs-cli.js:36–37`'s two `unpriced_steps` assertions are both inside the
**list** scenario; the detail scenario (`:62–68`) asserts no usage-line shape. The per-step line can
change.

**0.9 — Removing the timer does not repair the `running` manifest.** An installed
`process.once('SIGTERM', …)` listener does not hold node's event loop open, so a caller whose gate
promise owns no handle drains and exits 0 today *after* one second and afterwards *immediately*. The
removal's real value is narrower and is all any criterion claims: **it takes a test-fixture prop out
of production code, where it makes a race look like a guarantee.** Candidate-claude states this;
candidate-codex's problem statement implies the timer causes the false success, which over-sells it.

**0.10 — The fixture citation is two lines off.** The ticket body cites
`spike/test/q0011-run-history.js:227`; `:227` is the `spawn`. The handleless gate is at **`:225`**,
inside the `source` template literal the **child** evaluates —
`const ui={info(){},warn(){},step(){},done(){},trace(){},gate:()=>new Promise(()=>{})};`. The handle
goes into the child's `ui`.

**0.11 — `spike/test/run.js` has no per-scenario timeout** (grep for `timeout`/`setTimeout` returns
nothing). An unbounded fixture handle therefore turns a broken engine from a failing suite into a
hanging one, which is worse than the defect. AC-2 requires a ceiling for this reason.

**0.12 — Freeze state, measured.** `harness/port-charter.md:272` records
`freeze-sha: a6e529a31e84893140cc4b01cc0b2f2013880ca2`; `git diff --name-only a6e529a..HEAD --
spike/src` is **empty**, so that half is green right now and this ticket turns it red by design.
`children:` is `Q-0041 … Q-0054` (`:271`), so Q-0037 is out of the branch-scope job's scope rather
than silently passing — Q-0038, Q-0057 and Q-0080 are the precedent. And
`.github/scripts/port-freeze-guard.sh:86` still prints *"(Q-0037..Q-0040 must settle first)"*, a
statement about **this ticket** inside the script that will judge its branch, unreachable today
because it is guarded by `[ "$freeze_sha" = "not-yet-recorded" ]`.

**0.13 — `harness/Q-0037/integration` does not exist.** `git branch --list 'harness/*'` returns only
Q-0058's and Q-0062's four branches. Since Q-0038 the chore run **refuses in the preflight** rather
than billing for a worktree silently cut from `HEAD`. §7 GA-2.

---

## 1. Problem

Two review rounds on Q-0011 produced findings that did not block the feature, and Q-0034's AC-2
routed them here rather than into another revise loop on a stale branch. Seven are still live. Since
they were written the port closed, so each now exists in **two** trees that must not drift, and
`packages/core` has already answered four of them on the way through.

Today, concretely:

- A one-second `setTimeout` sits in `runGate` in both trees. In the spike it carries a ten-line
  comment saying it exists for a test fixture and naming a `spike/test/**` freeze that no longer
  applies. In `core` it carries `// Why: preserved defect, see Q-0050 AC-4.` for a purpose `core`
  does not have — Q-0050's AC-5 removed signal handling from `core` entirely, so the thing it holds
  the loop open *for* is gone. Three tickets have looked at it and each correctly declined to remove
  it as a side effect of something else; the decline is recorded at
  `backlog/Q-0052-…/runs.log:17` (*"the signalWindow invitation is SPENT … Q-0037 still carries the
  underlying finding"*). Nobody has removed it as the point, and this is the ticket whose subject it
  is.
- A maintainer reading `spike/src/engine.js` cannot tell a decided keep from an oversight for three
  run-history behaviours, because the ruling was written into `packages/core` and never mirrored
  back (§0.3).
- `harness validate` on any schema that is not `run-manifest-v1` prints *"run-manifest semantic
  checks skipped"*, which reads as a missing check rather than an inapplicable one; and it reads the
  artifact off disk twice, a race `core` removed and the spike kept.
- `harness runs <id>` prints `unpriced_steps` on a single occurrence, where it can only be 0 or 1
  and means nothing, and collapses four measured token fields into one number on the line whose job
  is to show one step's usage.
- `vendorTokenTotal` prints `tokens=n/a` beside populated cache fields. That is either a defect or
  the honest answer, and no artifact says which.

None of it blocks anything. All of it is residue that becomes an argument at the next review, and
every day it sits there the two trees can drift further apart.

---

## 2. User stories

- **As the `maintainer`**, I want the gate timer gone from both trees with the fixture standing on
  its own bounded handle, so that nothing in production code exists only to keep a test alive and no
  future reviewer has to re-litigate whether it may be removed.
- **As the `maintainer`**, I want each preserved run-history behaviour to carry one line of
  authority in *both* trees, so that reading either one tells me it was decided rather than missed.
- **As the `contributor`**, I want `harness validate` on my own contract to tell me that no semantic
  contract applies to it, rather than that a run-manifest check was skipped, so that I do not go
  looking for an annotation I was never supposed to have.
- **As the `maintainer`**, I want `harness runs <id>`'s per-step line to show the four measures the
  occurrence actually reports and no invented roll-up field, so the number I read is the number that
  was billed.
- **As the `maintainer`**, I want `tokens=n/a` over a malformed roll-up row to be a recorded ruling
  with a test behind it, so a later reader does not "fix" it into a number that is not a token total.

---

## 3. Scope, in three shapes

The seven live items are three groups, not one list, and the criteria are grouped to match because
the evidence a reviewer needs differs per group.

| Shape | Items | Why they group |
| --- | --- | --- |
| **Both trees, one commit** | the major; nit 9's ruling; nit 8's `core` transcription | the same code exists in both. A fix in one leaves the port's independent witness disagreeing — the Q-0066 / Q-0068 / Q-0070 shape, and charter §3's procedure |
| **`spike/` alone** | nits 5, 7, and nit 8's CLI half | nit 5 has no counterpart (`packages/cli` is Q-0010's); nit 7 was answered by Q-0045 in `core`, so the spike is catching up |
| **Documentation alignment** | nits 1, 2, 3 | the code stays exactly as it is in both trees; the spike gains the authority line `core` already carries |

**Nits 4 and 6 are closed and out of scope.** Nit 6 (`authErrorCategory`'s unused `vendor`) was
deleted with round-2 major 11 before Q-0011 landed and is absent from both trees. Nit 4 dissolved
when the decisions became one file each; its surviving question is §8 OQ-1 and Appendix A, and it is
deliberately not a criterion.

---

## 4. Acceptance criteria

Twelve, each independently testable, each naming its surface and — where it changes behaviour — the
test that proves it, per `harness/rules.md`.

### The major — the gate timer

**AC-1 — `runGate` holds no timer in the spike.** *Surface: `spike/`.*
`spike/src/engine.js` `runGate` no longer creates a `setTimeout`, and the `try`/`finally` that
existed only to `clearTimeout` it goes with it — `await ctx.ui.gate(…)` becomes a plain await. The
ten-line comment above it is **deleted rather than amended**: every sentence in it is either about
the timer or about the `spike/test/**` freeze this ticket lifts. **Test:** no occurrence of
`signalWindow` remains in `spike/src/engine.js`; the spike suite is green.

**AC-2 — the fixture owns its own libuv handle, and the handle is bounded.** *Surface: `spike/`.*
The child source at `spike/test/q0011-run-history.js:225` gives its `gate` a promise that owns a
real handle for the life of the gate, so the child survives to receive the `SIGTERM` the scenario
sends at `:228`. **The handle is bounded**: it expires, or exits the child non-zero, within a
ceiling stated in the fixture. `spike/test/run.js` has no per-scenario timeout (§0.11), so an
unbounded handle turns a broken engine from a failing suite into a hanging one. **Test:** scenario
`AC-3/AC-10/EDGE-9` passes, and the ceiling is visible in the fixture with one line saying why it
exists.

**AC-3 — the removal is demonstrated red before green, in that order.** *Surface: `spike/`.*
The implement report shows, with real output, that with **AC-1 applied and AC-2 not applied**,
scenario `AC-3/AC-10/EDGE-9` **fails** — the child drains and exits before the `SIGTERM`, and the
manifest reads `running` rather than `interrupted` — and then that with both applied it passes. This
is what proves the fixture was the thing holding the timer in place, and it is what would catch a
change that deletes the timer and leaves the scenario passing for a reason nobody checked.
*(Measured in advance so the implementer knows what to expect: an installed `process.once('SIGTERM',
…)` listener does not hold node's event loop open — §0.9.)*

**AC-4 — `routing.ts` holds no timer, and all three `core` pins move together.** *Surface:
`packages/core`.*
`packages/core/src/engine/routing.ts` loses `const signalWindow = setTimeout(() => {}, 1000);`, its
`Why: preserved defect, see Q-0050 AC-4.` marker, and the matching `clearTimeout`. All three of the
following move in the same change or the suite is wrong:

1. `q0050.source.test.ts`'s `AC-4h: signalWindow and its authority are preserved together` test,
   which asserts both the marker regex and the literal `1000`. It is **deleted and replaced by its
   inverse** — `routing.ts` contains no `setTimeout` — not weakened.
2. `REGISTERED['routing.ts']` loses its `'preserved defect/AC-4'` entry. This is a `toStrictEqual`
   identity register, not a count, so leaving it is a red suite.
3. The arithmetic comment below the register, which enumerates *"Nineteen authority lines, of which
   SEVEN are Q-0050's own preserved defects (AC-4h, AC-10c, AC-10f, AC-12a/b/c/d)"* and then narrates
   Q-0051's, Q-0052's and Q-0053's additions. AC-4h leaves that enumeration. **Re-derive from the
   register rather than decrement the prose**: the narration is cumulative and already trails the
   map, so subtracting one from it produces a differently stale number — a true record made false,
   which nothing catches.

**Test:** the workspace suite is green, and the report shows the AC-4h inverse failing against
unmodified `routing.ts`.

**AC-5 — no shipped gate path changes, and nothing replaces the timer.** *Surfaces: `spike/`,
`packages/core`.*
Neither tree may substitute another engine-owned event-loop handle — no interval, no `ref`'d socket,
no keep-alive — for the removed timer; the fixture is the only thing that gains one. The implement
report carries this table filled in with evidence rather than assertion:

| Path | Where | Why the timer was never load-bearing |
| --- | --- | --- |
| `--gate-answer` | `spike/bin/harness.js:82–89` | the answer is shifted off a queue and returned; the promise resolves before the timer could matter |
| non-interactive, no answer | `spike/bin/harness.js:95–97` | throws on `!process.stdin.isTTY` **before** awaiting anything |
| TTY | `spike/bin/harness.js:98–119` | `readline.createInterface` owns its own handle for the life of the question |
| `core`, any caller | `routing.ts` | throws when `answerGate` is absent, and cancellation is the caller's `AbortSignal` — Q-0050's AC-5 removed signal handling from `core`, so the timer's stated purpose does not exist there |

Gate **semantics** are untouched: `auto` still short-circuits, `human-locked` still cannot be
flipped, the exhaustion gate still requires an explicit answer, and `retry` still sets exactly that
loop's counter. Invariant register row 17 is not in play. **Test:** existing gate coverage in both
suites green and unmodified, plus one `core` assertion that a pending gate stays pending until the
caller's `AbortSignal` aborts and then follows the existing cancellation contract — the proof that
removing the timer did not quietly move cancellation.

### The three preserved nits — documentation alignment

**AC-6 — each preserved run-history behaviour carries one line of authority in the spike.**
*Surface: `spike/`.* **No code changes.** `spike/src/engine.js` gains exactly three `Why:` lines,
each one line, each naming Q-0037, each saying what its `packages/core` counterpart says and
**citing rather than transcribing** (`harness/rules.md`: never restate a decision entry or a ticket
body in a source file):

| Site | What the line records | `core`'s counterpart |
| --- | --- | --- |
| the `persistedStage` guard (`engine.js:379–384`) | unreachable from the command line, where every path loads the ticket from the file this re-reads; reachable from a caller that builds a ticket record itself, which is what the daemon will be | `writer.ts:235` |
| `rollup(ctx.history.manifest.steps)` on every terminal occurrence (`engine.js:468`) | whole-list, and therefore quadratic in occurrence count; reported rather than optimised in passing | `writer.ts:363–364` |
| `replaceManifest`'s fixed `.tmp` path (`engine.js:478–480`) | the path is fixed on purpose, so the next replacement renames a stray away; a run that does not continue leaves one, and nothing cleans it | `writer.test.ts:507` |

**Test:** the three lines are present and the spike suite is green and byte-identical in behaviour.
This criterion is **verified by inspection and says so**, because there is nothing else to verify:
`spike/**` is outside ESLint's scope entirely, so no lint sees a comment.

### The ruling — nit 9

**AC-7 — `vendorTokenTotal` is ruled, not changed, in both trees.** *Surfaces: `spike/`,
`packages/core`.*
It keeps returning `null` when both `input_tokens` and `output_tokens` are null, whatever the cache
fields hold. The ruling and why it is one:

> The cache measures are a **breakdown and never summands** — `spike/src/adapters/claude.js` folds
> both `cache_creation_input_tokens` and `cache_read_input_tokens` into `input_tokens` before a
> manifest sees one, and `run-history-writer.contract.md` settles it verbatim: *"Input totals
> already include vendor-reported cache components; readers do not add them again."* A row whose
> totals are both null while its cache fields are populated is therefore a manifest **no adapter can
> produce**: it is malformed, and the semantic pass reports it, because the roll-up is recomputed
> from occurrence usage. `tokens=n/a` is the honest rendering of absent summands. Summing the cache
> fields instead would print a number that is not a token total, in the one place run history exists
> to report one — the same double-count `q0034-review-fixes.js` B2 exists to forbid, reached from
> the other side.

Nit 2 is ruled in the same shape on §0.2's measurement: ~3 ms of manifest rewriting against a
3,755,327 ms run, over the largest manifest that exists here. Optimising it trades a measured
nothing for a change to the one write path that must never lose a step a vendor has billed for.

**Test:** a new assertion in **both** suites over a roll-up row with `input_tokens: null,
output_tokens: null, cached_input_tokens: <n>, cache_write_input_tokens: <m>` asserting `n/a`, and
sitting **beside** `q0034-review-fixes.js` B2's existing well-formed row, so the two readings of the
cache fields are covered by adjacent rows rather than by one. The ruling goes in
`dev/implement-report.md` and in the plan entry at close; `packages/core/src/run-history/reader.ts`'s
JSDoc already carries the reasoning and gains only the malformed-row sentence.

### The spike CLI — nits 5, 7, 8

**AC-8 — the per-step usage line reports one occurrence's own measures, and Q-0034's guard survives
it.** *Surface: `spike/`.*
The detail view's `usage:` line stops calling `formatVendorSummary` with a synthesised
`unpriced_steps`. It renders the occurrence's own `usage`: the vendor, the cost through the existing
`formatMoney`, and the **four** measures separately — `input_tokens`, `output_tokens`,
`cached_input_tokens`, `cache_write_input_tokens` (§0.7) — each through the existing `formatTokens`,
so `null` still renders `n/a` and never `0`. No roll-up field appears. The list view's vendor
summaries are **unchanged**, because the frozen contract's *"Every summary states `unpriced_steps`"*
is about them (§0.8).
**`q0034-review-fixes.js` B2 is re-aimed, not broken** (§0.6): `printRunDetailHuman` renders no
roll-up, so its `tokens=1100` currently reads the very line this criterion rewrites. The re-aimed
scenario must still fail if `cache_write_input_tokens` is ever added into a total — asserting the
four measures at their own values and that no rendering of `1350` appears anywhere in the output —
so the double-count property is preserved rather than the assertion deleted.
**Test:** a detail-view assertion that the line names all four measures and that `unpriced_steps`
does **not** appear on it; `q0011-runs-cli.js:36–37`'s list assertions green and untouched; B2 shown
red against the pre-change fixture wording and green after, so the re-aim is demonstrated rather than
asserted.

**AC-9 — `harness validate` reads each artifact once, and the new entry point agrees with the old.**
*Surface: `spike/`.*
`spike/src/contracts.js` gains `validateArtifact(schemaFile, dataFile)` with the shape
`packages/core/src/contracts/contracts.ts` already has: read schema, read data, structural verdict,
and a `semantic` outcome of `{ contract, ran, reason }`. `bin/harness.js` calls it, so the second
`readData(f)` goes. **`validateFile` is kept and unchanged**, because
`spike/test/q0034-review-fixes.js:74` calls it and charter §2 preserves what it does. For every
artifact, `validateArtifact`'s structural half returns what `validateFile` returns — same `ok`, same
`errors`, same `schema` and `data` basenames — which is what stops this convergence from quietly
becoming a divergence. **Test:** a validate run over one artifact performs exactly one read of it
(counting spy or equivalent); an assertion comparing the two functions over both a valid and an
invalid fixture; existing validate coverage green.

**AC-10 — the skipped-check notice is honest and stays contract-compliant, in both trees.**
*Surfaces: `spike/`, `packages/core`.*
The notice is derived from the `semantic` outcome rather than from a boolean computed before the
loop, and it satisfies all five of:

1. it names the file;
2. it says no semantic checks **ran**, never that any passed — *"skipped is not passed"*
   (2026-08-25) and invariant register row 14;
3. it **leads with inapplicability**: the text before its first dash names the schema's missing
   `x-quorum-contract` annotation, and does not begin with `run-manifest`;
4. it still contains an explicit statement that no **run-manifest** semantic checks ran, naming
   `run-manifest-v1` as the only contract defined — which is what keeps
   `contracts/Q-0011/runs-cli.contract.md:47–48` satisfied without amending a file the implementer
   may not write (§0.4);
5. it does not contain the current substring `run-manifest semantic checks skipped (schema has no
   recognised x-quorum-contract annotation)`, which is the phrasing that reads as a missing check.

A wording satisfying all five, offered rather than mandated:
`· foo.json: no semantic contract applies — this schema carries no x-quorum-contract annotation, so no run-manifest semantic checks ran; run-manifest-v1 is the only contract defined`
**The `core` transcription moves with it** (§0.5): `validate-artifact.test.ts`'s `render()` helper
reproduces the CLI's four line shapes and hard-codes this string twice. It is updated in the same
commit, and its JSDoc's line citation is re-derived, so it keeps being a reproduction rather than
becoming a green test of a string nothing prints. **Test:** clauses 1, 3, 4 and 5 as literal
assertions over a non-run-manifest schema in the spike suite; the run-manifest path's notice and
green tick unchanged; the `core` render tests green against the new string and shown red against the
old.

### Machinery

**AC-11 — `spike-parity.test.ts`'s totals are re-derived, not adjusted.** *Surface:
`packages/core`.*
`q0011-run-history.js` and `q0034-review-fixes.js` are both `split` and both sit in the `both`
bucket; `q0011-runs-cli.js` is `cli`. So AC-2's, AC-7's and AC-8's edits move up to three of the four
`toBe` pins — currently `binary-only` **336**, `both` **2026**, `library-only` **2463**, `total`
**4825** — and each is **re-measured from the tree** rather than nudged. The rounded transfer share
(currently **49%**) is re-derived and stated in the report **even if it does not move**, which is a
fact to record rather than assume. If a new spike test file is added, it needs a `REGISTER` entry
with a verdict and named, collected counterparts or the register fails by design; the report says
which route was taken and why. **Test:** the workspace suite green, with every moved number named in
the report.

**AC-12 — both trees in one commit, the freeze SHA re-recorded in it, and the change verified in
both environment rows.** *Surfaces: `spike/`, `packages/core`, `harness/`, `.github/`.*
Charter §3's two-step procedure walked as a procedure:

1. every item with a counterpart lands in **both** trees in the **same** commit;
2. `harness/port-charter.md`'s `freeze-sha:` is re-recorded at that tip, in that commit.

Measured precondition: `a6e529a` is an ancestor of `HEAD` and no `spike/src` change has landed since,
so the half is green now and this ticket turns it red by design (§0.12). **No exemption trailer** —
the exemption path is for a child's branch and Q-0037 is not in `children:`, so the branch-scope job
reports out of scope rather than passing silently; Q-0038, Q-0057 and Q-0080 are the precedent. In
the same commit, `.github/scripts/port-freeze-guard.sh:86` stops naming *"Q-0037..Q-0040 must settle
first"*; the line is currently unreachable, guarded by `freeze-sha = not-yet-recorded`, and the
report says so, so nobody reads its correction as a bug fix.
Nothing here changes a persisted byte: the manifest file name, directory layout, JSON schema,
occurrence ordering and write-via-rename convention are untouched, and existing manifests stay
readable without migration. **Test:** `node .github/scripts/port-freeze-guard.test.mjs` green and
the guard run against the tip in all three halves; and both suites run **forced** in both
environment rows per Q-0072's closing finding — inside the integrate worktree, which has neither
`.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge —
`npm test --prefix spike` and `pnpm turbo run test --force` from a checkout installed with
`pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`.

---

## 5. Non-goals

Explicit, because each has been proposed at least once in this ticket's history.

- **NG-1 — making a handleless gate promise a stated guarantee.** A caller whose gate promise owns
  no handle still drains to exit 0 with a `running` manifest, immediately rather than after a
  second. That is the caller's contract and belongs with M3's daemon (§0.9).
- **NG-2 — optimising the manifest write.** Ruled in AC-7 on measurement. No incremental roll-up, no
  batching, no dropped `fsync`, and no new durability boundary around a completed batch.
- **NG-3 — cleaning or pre-unlinking a stray `manifest.json.tmp`.** Preserved and now documented
  (AC-6). The fixed path already consumes a stray on the next write (§0.3), and a run that does not
  continue is not reachable by any pre-write unlink. The reader reports the manifest it finds beside
  a stray and repairs nothing.
- **NG-4 — making the persisted-stage guard reachable, or removing it.** Preserved deliberately
  because the daemon is the caller that reaches it. Only the spike's missing comment is in scope.
- **NG-5 — any change to `packages/cli`.** It does not exist. Nit 5's shape is chosen here and
  Q-0010 inherits it; nothing is built for it now.
- **NG-6 — editing `contracts/`.** Frozen, and outside `developer-generalist`'s paths. AC-10's
  wording is designed to keep the contract satisfied rather than to amend it.
- **NG-7 — editing `docs/decisions/` or `docs/DECISIONS.md`.** The role forbids it in as many words;
  §7's GA-1 is the human's.
- **NG-8 — any manifest schema, field, format or ordering change**, and no inference or repair of
  malformed stored usage: no reader derives `input_tokens` from cache measures or rewrites a row.
- **NG-9 — touching `.claude/rules/`.** A derived copy, per *"`.claude/rules/` is a derived copy,
  not a surface a requirement may name"* (2026-08-27).
- **NG-10 — Q-0039, Q-0040, Q-0074, Q-0075, Q-0076, Q-0078**, and any finding closed by Q-0045 or
  before Q-0011 landed. None is touched.
- **NG-11 — a new dependency, daemon state, or any v1-excluded surface.**

---

## 6. Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a — no auth path, adapter or environment refusal is touched. No criterion introduces an API-key path in code, test, fixture or example. |
| **Worktree safety** | n/a — nothing writes to the user's working tree; run history stays under `.quorum/`. The implement step runs in `.harness/worktrees/` as always. |
| **Gate behaviour** | AC-1, AC-4 and AC-5 touch `runGate`/`askGate`. Semantics unchanged and evidenced per path: `auto` short-circuits, `human-locked` cannot be flipped, the exhaustion gate needs an explicit answer, `retry` sets exactly one counter. |
| **File format and schema** | Unchanged (AC-12). AC-7 changes no persisted byte. |
| **Lint rules** | TypeScript stays strict, no `any`, no new `@ts-ignore`, no deprecated API. `packages/**` is ESLint-covered; `spike/**` is outside it entirely, which is why AC-6 is verified by inspection and says so. |
| **Cold-clone impact** | Two CLI strings a newcomer could meet: AC-10's notice (shorter path to understanding) and AC-8's usage line (one line, more informative). No new dependency or setup step; the first 30 minutes do not lengthen. |
| **Product-agnostic** | No product name enters any file. |
| **Cross-vendor rule** | Satisfied by the chore flow as configured — `claude` implements, `codex` reviews. No flow or reviewing-step assignment changes. |

---

## 7. Gate actions — settle these before the implement step runs

Both are things **no step on this ticket's route can do**. They are stated here so the loop is never
handed one — the hazard that has exhausted eight loops in this repository, most recently Q-0062,
where the requirement named it in advance and the run was launched anyway.

**GA-1 — the DECISIONS date rule (ratification, not a decision).** §0.1 measured that
`docs.test.ts` already enforces one answer: an entry's date may not precede the previously listed
entry's, so a decision made earlier and landed later must carry the later date. Nothing is broken
and nothing is red; what is missing is that the rule lives only in a test. Two ways to close it,
both the human's: **(1)** write the entry now — Appendix A drafts it, so it costs a paste; or
**(2)** open the successor and close it there, with Appendix A as its body, written out in full so
the obligation cannot expire. **Recommendation: (2).** This is a remainder-clearing chore, and
**no acceptance criterion depends on GA-1's outcome** — deliberately, so the run is unaffected
whichever way it goes.

**GA-2 — `harness/Q-0037/integration` does not exist.** Measured: `git branch --list 'harness/*'`
returns only Q-0058's and Q-0062's branches (§0.13). `chore.yaml`'s `implement` step declares
`base: harness/{id}/integration` and its `review` step diffs against it, while only `integrate` —
which runs later — creates it. Since Q-0038 the run **refuses in the preflight** rather than billing
for a worktree silently cut from `HEAD`. **Create the branch before launching the chore run.**

---

## 8. Open questions

None blocks solutioning: none changes a file format, a schema or the adapter contract, and none is a
precondition any criterion reads.

**OQ-1 — which date does a decision entry carry, and who rules it?** *Owner: **Ruud**, at the
requirements gate.* Settled de facto by `docs.test.ts` and written down nowhere (§0.1). See GA-1.
**Recommendation: successor ticket, body in Appendix A.**

**OQ-2 — does AC-8's per-step shape bind `packages/cli`?** *Owner: **Ruud**, at the close.* Nit 5
has no counterpart today, so this ticket picks a shape Q-0010 will either inherit or re-decide.
**Recommendation: say at the close that it binds**, in this ticket's plan entry, so Q-0010 inherits
a decision rather than an accident.

**OQ-3 — should the spike keep `validateFile` at all after AC-9?** *Owner: the implementer, reported
not decided.* Its only remaining non-CLI caller is `spike/test/q0034-review-fixes.js:74`. Charter §2
keeps it; the question is whether Q-0010 carries it forward. **Recommendation: keep, report, do not
decide here.**

**OQ-4 — twelve criteria as one ticket, or two?** *Owner: **Ruud**, at the gate.* See R-6.
**Recommendation: one.**

---

## 9. Risks

**R-1 — this ticket turns the freeze-SHA job red by design.** Both halves are green today (§0.12).
AC-12 is the answer and it is a procedure, not a judgement. The failure mode to watch is landing the
spike half and the `core` half in *different* commits, which leaves the base red between them.

**R-2 — an unbounded fixture handle turns a failing suite into a hanging one.** `spike/test/run.js`
has no per-scenario timeout. AC-2 requires the ceiling for exactly this; it is the one place where
the obvious implementation is worse than the defect.

**R-3 — the three `q0050.source.test.ts` pins must move together.** Deleting the timer and leaving
the `REGISTERED` entry is a red suite, which is the guard working. Deleting both and leaving the
arithmetic comment is a **true record made false**, which nothing catches — and the comment is
already cumulative narration rather than a live total, so "decrement it" produces a differently wrong
number. AC-4(3) says re-derive.

**R-4 — AC-10 sits against a frozen contract's literal wording.** Handled by construction rather
than by erratum (§0.4, AC-10 clause 4), but a reviewer may still raise it and would not be wrong to.
If the reviewer refuses the reading, the correct move is an erratum ruling AC-10's clause 5 the thing
that moves — **not** another implement round. *"A refused finding is a gate, not another round"*
(2026-08-31).

**R-5 — AC-3's red phase is easy to skip and easy to fake.** The whole value of the major's fix is
that the fixture, not the engine, ends up holding the process open. A report showing only the green
run proves nothing about which change did the work.

**R-6 — twelve criteria against charter §9's roughly-ten sizing.** Five of them (AC-6, AC-7's
`core` half, AC-11, and parts of AC-5 and AC-12) are documentation, a re-derived number or an
evidence table, so the weight is nearer eight. **Recommendation: keep as one ticket.** Splitting
means walking §3's mirror-and-re-record twice, which is the most expensive per-commit act here, and
both halves touch `spike/src`. If it is split anyway the seam is **AC-1…AC-7** (the major, the
rulings, the documentation — both trees, one commit, one re-record) followed by **AC-8…AC-10** (the
spike CLI), with AC-11 and AC-12 repeated in each; the second ticket then needs its own re-record
because it touches `spike/src/contracts.js`, which is the argument against splitting.

**R-7 — the citations in this document are being copied forward.** Four inherited measurements were
wrong before this merge (§0.1, §0.5, §0.6, §0.10), two of them in a body re-measured the same day.
Nothing here should enter a durable record without being re-run — *"a measurement copied from a
document is not a measurement"* (Q-0058).

---

## 10. Provenance

**Candidate-claude is the base.** Its §0 re-measurement pass is the strongest artifact either
candidate produced, and its three central rulings all survived independent re-measurement: the
`docs.test.ts` order assertions (§0.1), the nit-2 timing measurement (§0.2), and the frozen-contract
collision behind nit 8 (§0.4). Its three-shape scope model, its per-path gate-evidence table
(AC-5), its "re-derive rather than decrement" instruction (AC-4), its parity-pin criterion (AC-11)
and its `--base`-era charter §3 reading (AC-12) are carried through largely intact, as is its
Appendix A, which is reproduced verbatim so the OQ-1 obligation cannot expire.

**Candidate-codex contributed five things the base lacked**, all folded in: the *no lifecycle
masking* clause forbidding a replacement engine-owned handle, which closes the loophole a
timer-deletion criterion otherwise leaves (AC-5); a `core`-side behavioural proof that a pending gate
stays pending until the caller's `AbortSignal` aborts, which is stronger than a source-text pin alone
(AC-5); the explicit red-before-green rule generalised to every changed behaviour (AC-3, AC-8,
AC-10); the run-history and CLI compatibility clauses — schema, layout, ordering, exit codes,
migration-free readability (AC-12, NG-8); and the named installation and forced-verification
commands (AC-12). Its risk register is the more systematic of the two and shaped R-1, R-3 and R-4.

**Where candidate-codex was overruled, with the measurement in each case.** Its AC-5/6/7 batched
persistence — a behaviour change to the manifest write path bought for ~3 ms against a 63-minute run
(§0.2). Its AC-8/9/10 stale-`.tmp` handling — no behaviour, since `writer.test.ts:507` proves the
fixed path already consumes a stray (§0.3). Its AC-16 notice wording — drops the words
`contracts/Q-0011/runs-cli.contract.md:47–48` requires, and `contracts/` is outside the
implementer's paths (§0.4). Its AC-12 field names — `cache_read_input_tokens` /
`cache_creation_input_tokens` are the vendor's spellings, not the manifest's (§0.7). And its
blocking DECISIONS precondition — enforced already, depended on by no criterion, and the shape that
has exhausted eight loops here (§0.1). At 25 criteria it was also roughly twice the size a ticket
should carry; a third of them restated compatibility guarantees that no criterion threatened.

**Two criteria come from neither candidate**, found while merging and both of the class this
repository keeps paying for — a check that stays green over a subject it no longer matches. AC-10's
`core` half: `validate-artifact.test.ts:150,173` transcribes the notice verbatim, so nit 8 is not
spike-only (§0.5). And AC-8's re-aim of `q0034-review-fixes.js` B2: `printRunDetailHuman` renders no
roll-up, so its `tokens=1100` reads the per-step line nit 5 rewrites, and Q-0034's double-count guard
breaks unless it is deliberately re-aimed (§0.6).

---

## Appendix A — successor body for OQ-1, written out in full

*Transcribed rather than referenced, so the obligation cannot expire if OQ-1 is routed to a
successor. If GA-1 option (1) is taken instead, the ruling below is the entry's substance.*

---

**Title: An entry's date is the date it takes its place in the index.**

**The finding.** `docs/DECISIONS.md` is described in three places as *"append-only, newest last"*
and is simultaneously grouped under `## YYYY-MM-DD` headings that must match each entry's own
`# Title — date` first line. For an entry decided on one date and landed after entries decided
later, the two descriptions cannot both hold: the entry takes the next file number and the last
index row, and its own date then sits under a heading earlier than the row above it.

**It is already enforced, and that is the point.** `packages/shared/src/docs.test.ts` asserts both
halves — *"every entry file is listed once, in the order the folder holds them"* and *"the dates
never go backwards — the index is append-only, newest last"*. Measured 2026-09-01 over 74 entries:
74 index rows, 74 files, index order identical to numeric order, dates non-decreasing, no
heading/title mismatch. So the rule is not missing; it is **unwritten**. An author who tries to land
a back-dated entry today gets a red suite and no sentence explaining why.

**What is owed is one ruling, in either direction.** Either (a) an entry carries the date it takes
its place in the index — the landing date — and an entry whose decision predates it says so in its
own body, which is what the test already forces and what costs nothing; or (b) the index's
*"newest last"* prose is amended to say *"newest last by listing order, which is not always by
decision date"*, and the date assertion in `docs.test.ts` is deleted, which trades a guard for a
sentence. **(a) is the recommendation**, because it is what shipped, because the deciding date is
information the entry's body can carry losslessly, and because the alternative removes the only
mechanical check that the index is append-only at all.

**The historical instance is closed and is not evidence either way.** *"Product-level schema
annotations select semantic validation"* was authored on the Q-0011 implement branch at `8a9ac0f` on
2026-08-23 and reached `main` through the Q-0034 merge on 2026-08-24, landing mid-file in what was
then one 1,675-line document. Since *"A decision is a file; this page is the index"* (2026-08-28)
there is no mid-file position to be wrong, the entry is
`docs/decisions/031-product-level-schema-annotations-select-semantic-validation.md`, and its date is
defensible on either reading. **Do not re-derive this from the original Q-0037 body**, which
describes a flat file that no longer exists.

**Scope, if it becomes a ticket.** One `docs/decisions/NNN-*.md` entry plus its index line, written
by the human; optionally one sentence in `harness/rules.md` under *Documentation*, citing the entry
by title and date. **No code changes.** `docs.test.ts` is untouched under reading (a). Nothing in
`spike/`, `packages/core` or `contracts/` is involved, and this must not be attached to a ticket
whose implement step would then be blocked on an entry no step on its route may write.
