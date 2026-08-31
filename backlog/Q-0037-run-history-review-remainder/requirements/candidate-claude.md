# Q-0037 — Run-history review remainder: requirements

*Product manager candidate, 2026-09-01. Written against both trees at `179b236`, not transcribed
from the ticket body. Where this document and the body disagree, the disagreement is stated with
the measurement that caused it.*

---

## 0. What re-measuring changed, before anything else

The ticket body was itself re-measured on 2026-09-01, and it is the best account of this ticket that
has existed. Eleven things still moved when the tree was read rather than the body. They are here
first because four of them change what the criteria say.

**0.1 — `docs.test.ts` does assert order. Twice.** The body says it *"fails if the index and the
folder disagree, and asserts nothing about order"*. `packages/shared/src/docs.test.ts` asserts both
halves of order:

- *"every entry file is listed once, **in the order the folder holds them**"* —
  `expect(listed().map((row) => row.file)).toEqual([...onDisk().keys()])`.
- *"**the dates never go backwards — the index is append-only, newest last**"* —
  `expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates)`.

Both are green today: 74 index rows, 74 files, index file order identical to numeric order, dates
non-decreasing, and no entry whose own `# Title — date` first line disagrees with the heading it is
listed under. So the contradiction the body raises is **already enforced closed**: an entry decided
on 2026-08-23 and landed after entries dated 2026-08-31 takes the highest number, is listed last,
and then turns the date assertion red — it cannot land at all. What is missing is not a guard. It is
that nobody wrote down which of the two dates an entry carries, and a test is currently the only
thing that answers. That downgrades the gate action from a design question to a ratification, and it
is why §7's GA-1 costs a paste rather than a decision. See §8 OQ-1 and Appendix A.

**0.2 — Nit 2 is measured, for the first time.** The body and the original round-2 finding both call
the whole-manifest re-serialise *"quadratic in occurrence count on a path every integrate step
runs (unmeasured)"*. Measured on this repository, over all 71 run directories: the **largest**
manifest anywhere is `.quorum/runs/Q-0050-4/manifest.json` at **13,924 bytes over 18 occurrences**.
Replaying that manifest's full `replaceManifest` cycle — `openSync`, `writeFileSync`, `fsyncSync`,
`closeSync`, `renameSync` — **18 times at full size** takes **3.3 ms**. That run's own
`duration_ms` is **3,755,327**. The measurement is an over-estimate, because the real writes grow
from empty to full rather than all being full-size. Three milliseconds against sixty-three minutes.
Nit 2 is a ruling, not a fix (AC-7).

**0.3 — Three nits are already documented in `core`, not one.** The body says this only of nit 1.
`packages/core` carries an authority line or a pin for all three of the preserved run-history nits:

| Nit | `core`'s record | `spike`'s record |
| --- | --- | --- |
| 1 stage guard unreachable from the CLI | `run-history/writer.ts:235` — `Why: preserved as-is, see Q-0037 …` | `engine.js:379–383`, **nothing** |
| 2 whole-manifest re-serialise | `run-history/writer.ts:363–364` — `// Whole-list, and therefore quadratic in occurrence count.` / `// Why: preserved, see Q-0037 — reported rather than optimised in passing.` | `engine.js:468`, **nothing** |
| 3 stray `manifest.json.tmp` | `run-history/writer.test.ts:507–521` — a test named *"the temporary path is fixed, so a stray is consumed by the next replacement and never read"*, whose comment names Q-0037 | `engine.js:478–480`, **nothing** |

So the documentation-alignment shape is three items wide. It is also the cheapest work in the
ticket and the highest-value per line: a reader of `spike/src/engine.js` today has no way to learn
that any of these three is a decided keep rather than an oversight, while a reader of
`packages/core` learns it in one line.

**0.4 — Nit 8's obvious fix contradicts a frozen contract, and the implementer cannot edit it.**
`contracts/Q-0011/runs-cli.contract.md:48–49` says: *"If the annotation is absent or unrecognised,
print an explicit notice that **run-manifest semantic checks** were skipped."* The current message is
literally compliant. `contracts/` is **not** in `developer-generalist`'s `paths`
(`harness/roles/developer-generalist.md:2`), so no step on this route may amend it. AC-12 therefore
specifies a wording that satisfies the contract's sentence *and* stops the notice reading as though a
run-manifest check had been expected, rather than leaving a revise round to discover the collision.
This is *"An erratum is the last repair, not the first"* (2026-08-30) applied one stage earlier: the
contradiction is provable now, so it is ruled now.

**0.5 — Nit 5 is unconstrained, which the body could not have known.** The same contract's *"Every
summary states `unpriced_steps`"* (`:25`) sits inside the **List rows** paragraph, describing
*"separately labelled vendor summaries"*. The **Detail** paragraph (`:27–30`) requires *"adapter,
model, status, start, duration, verdict, usage, error, and the project-relative step-directory
path"* — and names no roll-up field. `spike/test/q0011-runs-cli.js`'s two `unpriced_steps`
assertions (`:36–37`) are both inside the **list** scenario; the detail scenario (`:62–68`) asserts
no usage-line shape at all. The per-step line can change freely.

**0.6 — Nits 7 and 8 close together, and converge the trees rather than diverging them.**
`core`'s `validateArtifact` (`packages/core/src/contracts/contracts.ts:150–163`) already reads each
file once *and* returns a `SemanticOutcome` a caller can phrase generically. Porting that shape into
`spike/src/contracts.js` and calling it from `bin/harness.js` closes both nits in one change, keeps
`validateFile` for its other caller (`spike/test/q0034-review-fixes.js:74`), and makes the two trees
say the same thing — which is exactly step 1 of charter §3's mirror-and-re-record procedure.

**0.7 — Removing the timer does not fix the outcome the round-2 finding names.** Measured on
node v24.15.0: `process.once('SIGTERM', …)` **does not hold the event loop open** — a process with a
signal listener installed and a forever-pending, handleless promise exits **0, immediately**. So
today the timer buys exactly one second before the drain, and after the fix the drain is immediate.
The manifest still reads `running` in both cases. What the removal actually achieves is narrower and
must be stated as such: **it takes a test-fixture prop out of production code, where it makes a race
look like a guarantee.** No criterion below claims the removal repairs the `running` manifest.

**0.8 — The fixture citation is two lines off.** The body cites
`spike/test/q0011-run-history.js:227`. `:227` is the `spawn`. The handleless gate promise is at
**`:225`**, inside the `source` template literal that the child process evaluates —
`const ui={info(){},warn(){},step(){},done(){},trace(){},gate:()=>new Promise(()=>{})};`. The
handle has to go into the **child's** ui, not the test's.

**0.9 — `spike-parity.test.ts` pins move.** `q0011-run-history.js` is classified `both`
(`packages/core/src/spike-parity.test.ts:122`, and named in the `both` identity list at `:1037`).
Its line count feeds two `toBe` pins — `linesOf(named('both'))` is **2026** and `total` is **4825**
(`:1061`, `:1063`) — plus the rounded 49% transfer share at `:1065`. Editing the fixture moves two
of those numbers. Adding a *new* spike test file additionally requires a `REGISTER` entry with a
verdict and named counterparts, or the register fails by design.

**0.10 — `.github/scripts/port-freeze-guard.sh:86` still names this ticket as a live precondition.**
It prints *"Recording a SHA in %s is what gives that half something to verify (**Q-0037..Q-0040 must
settle first**)"*. Charter §3 abandoned that precondition on 2026-09-01 and the SHA has been recorded
since 2026-08-30. The line is unreachable today — it is guarded by `[ "$freeze_sha" =
"not-yet-recorded" ]` — so this is stale text rather than a defect, but it is stale text about
*this ticket* inside the enforcement script that will judge this ticket's branch.

**0.11 — The freeze state, measured rather than assumed.** `a6e529a31e84893140cc4b01cc0b2f2013880ca2`
is an ancestor of `HEAD`, and `git diff --name-only a6e529a..HEAD -- spike/src` is **empty**. The
freeze-SHA half is green right now, and this ticket turns it red **by design** the moment it touches
`spike/src/engine.js`. §3's answer is a procedure, not a choice: mirror, then re-record in the same
commit (AC-13).

---

## 1. Problem

Two review rounds on Q-0011 produced findings that did not block the feature, and Q-0034's AC-2
routed them here rather than into another revise loop on a stale branch. Seven of them are still
live. Since they were written, the port closed, so every one of them now exists in **two** trees that
must not be allowed to drift, and `packages/core` has already answered four of them on its way
through.

The `maintainer` is the persona who pays for this. Concretely, today:

- A one-second `setTimeout` sits in the middle of `runGate` in both trees, in the spike carrying a
  ten-line comment that says it exists for a test fixture and names a freeze that no longer applies,
  and in `core` carrying a `Why:` line for a purpose `core` does not have — Q-0050's AC-5 removed
  signal handling from `core` entirely, so the thing the timer holds the loop open *for* is gone.
  Three separate tickets have looked at it and each correctly declined to remove it as a side effect
  of something else. Nobody has removed it as the point.
- A maintainer reading `spike/src/engine.js` cannot tell a decided keep from an oversight for three
  run-history behaviours, because the ruling was written into `packages/core` and never mirrored
  back.
- `harness validate` on any schema that is not `run-manifest-v1` prints *"run-manifest semantic
  checks skipped"*, which reads as a missing check rather than an inapplicable one; and it reads the
  artifact off disk twice, a race `core` removed and the spike kept.
- `harness runs <id>` prints a roll-up field, `unpriced_steps`, on a single occurrence, where it can
  only ever be 0 or 1 and means nothing; and it collapses four measured token fields into one
  number on the line whose whole job is to show one step's usage.
- `vendorTokenTotal` prints `tokens=n/a` beside populated cache fields. That is either a defect or
  the honest answer, and no artifact says which.

None of this blocks anything. All of it is the kind of residue that turns into an argument at the
next review, and every day it sits there is a day the two trees can drift further apart.

---

## 2. User stories

- **As the `maintainer`**, I want the gate timer gone from both trees with the fixture standing on
  its own handle, so that nothing in production code exists only to keep a test alive and no future
  reviewer has to re-litigate whether it may be removed.
- **As the `maintainer`**, I want each preserved run-history behaviour to carry one line of
  authority in *both* trees, so that reading either one tells me it was decided rather than missed.
- **As the `contributor`**, I want `harness validate` on my own contract to tell me that no
  product-level semantic pass applies to it, rather than telling me a run-manifest check was
  skipped, so that I do not go looking for an annotation I was never supposed to have.
- **As the `maintainer`**, I want `harness runs <id>`'s per-step line to show the four measures the
  occurrence actually reports and no invented roll-up field, so the number I read is the number that
  was billed.
- **As the `maintainer`**, I want `tokens=n/a` over a malformed roll-up row to be a recorded ruling
  with a test behind it, so that a later reader does not "fix" it into a number that is not a token
  total.

---

## 3. Scope, in three shapes

The seven live items are not one list. They are three, and the criteria are grouped to match,
because the evidence a reviewer needs is different for each.

| Shape | Items | Why they group |
| --- | --- | --- |
| **Both trees, one commit** | the major; nit 9's ruling | `spike/src` and `packages/core` hold the same code. A fix in one leaves the port's independent witness disagreeing — the Q-0066 / Q-0068 / Q-0070 shape, and charter §3's procedure |
| **`spike/` alone** | nits 5, 7, 8 | nit 5 has no counterpart (`packages/cli` is Q-0010's); nits 7 and 8 were already answered by Q-0045 in `core`, so the spike is the one catching up |
| **Documentation alignment** | nits 1, 2, 3 | the code stays exactly as it is in both trees; the spike gains the authority line `core` already carries |

**Nits 4 and 6 are closed and are not in scope.** Nit 6 (`authErrorCategory`'s unused `vendor`) was
deleted with round-2 major 11 before Q-0011 landed and is absent from both trees. Nit 4 dissolved
when the decisions became one file each; its surviving question is §8 OQ-1 and Appendix A, and it is
deliberately not a criterion.

---

## 4. Acceptance criteria

Each is independently testable. Where a criterion changes behaviour, it names the test that proves
it, per `harness/rules.md`. The surface is named in each.

### The major — the gate timer

**AC-1 — `runGate` holds no timer in the spike.** *Surface: `spike/`.*
`spike/src/engine.js` `runGate` no longer creates a `setTimeout`, and the `try`/`finally` that
existed only to `clearTimeout` it goes with it — the `await ctx.ui.gate(…)` is a plain await. The
ten-line comment at `:604–613` is deleted rather than amended: every sentence in it is either about
the timer or about the `spike/test/**` freeze that this ticket lifts. **Test:**
`grep -c 'signalWindow' spike/src/engine.js` is 0; the spike suite is green.

**AC-2 — the fixture owns its own libuv handle, and the handle is bounded.** *Surface: `spike/`.*
The child source at `spike/test/q0011-run-history.js:225` gives its `gate` a promise that holds a
real handle for the life of the gate, so the child survives long enough to receive the `SIGTERM` the
scenario sends at `:228`. **The handle is bounded** — it must expire, or exit the child non-zero,
within a stated ceiling. `spike/test/run.js` has **no per-scenario timeout**, so an unbounded handle
turns a broken engine from a failing suite into a hanging one, which is a worse outcome than the
defect. **Test:** scenario `AC-3/AC-10/EDGE-9` passes, and the ceiling is visible in the fixture.

**AC-3 — the removal is demonstrated red before green, in that order.** *Surface: `spike/`.*
The implement report shows, with real output, that with **AC-1 applied and AC-2 not applied**,
scenario `AC-3/AC-10/EDGE-9` **fails** — the child drains and exits before the `SIGTERM`, and the
manifest reads `running` rather than `interrupted`. Then that with both applied it passes. This is
the criterion that proves the fixture was the thing holding the timer in place, and it is the one
that would catch a change that merely deletes the timer and leaves the scenario passing for a reason
nobody checked. *(Measured in advance and stated so the implementer knows what to expect: an
installed `process.once('SIGTERM', …)` listener does not hold node's event loop open — node
v24.15.0 exits 0 immediately.)*

**AC-4 — `routing.ts` holds no timer, and all three `core` pins move together.** *Surface:
`packages/core`.*
`packages/core/src/engine/routing.ts` loses `const signalWindow = setTimeout(() => {}, 1000);`
(`:27`), its `Why: preserved defect, see Q-0050 AC-4.` marker, and the `clearTimeout` at `:48`. All
three of the following move in the same change or the suite is wrong:

1. `q0050.source.test.ts:128–131` — the `AC-4h: signalWindow and its authority are preserved
   together` test, which asserts both the marker regex and the literal `1000`. It is **deleted**,
   not weakened, and replaced by its inverse: `routing.ts` contains no `setTimeout`.
2. `q0050.source.test.ts:176` — `REGISTERED['routing.ts']` loses its `'preserved defect/AC-4'`
   entry. This is a `toStrictEqual` identity register (`:185`), not a count, so leaving it is a red
   suite.
3. The arithmetic comment below the register (`:186` onward), which enumerates *"SEVEN … Q-0050's
   own preserved defects (AC-4h, AC-10c, AC-10f, AC-12a/b/c/d)"*. AC-4h leaves the enumeration.
   **Re-derive rather than decrement**: the register today holds 35 classified lines across nine
   files while the comment's cumulative narration reaches 31, so the comment is already narration
   rather than a live total, and subtracting one from a stale number produces a differently stale
   one. *(Counted by hand from the literal `REGISTERED` map; the implementer re-derives from the
   test's own output.)*

**Test:** the workspace suite is green, and the report shows the AC-4h inverse failing against
unmodified `routing.ts`.

**AC-5 — no shipped gate path changes, evidenced per path.** *Surfaces: `spike/`,
`packages/core`.*
The implement report carries this table, filled in with evidence rather than assertion:

| Path | Where | Why the timer was never load-bearing |
| --- | --- | --- |
| `--gate-answer` | `spike/bin/harness.js:82–89` | the answer is shifted off a queue and returned; the promise resolves before the timer could matter |
| non-interactive, no answer | `spike/bin/harness.js:95–97` | throws on `!process.stdin.isTTY` **before** awaiting anything |
| TTY | `spike/bin/harness.js:98–119` | `readline.createInterface` owns its own handle for the life of the question |
| `core`, any caller | `routing.ts:24` | throws when `answerGate` is absent, and cancellation is the caller's `AbortSignal` — Q-0050 AC-5 removed signal handling from `core`, so the timer's stated purpose does not exist there at all |

Gate **semantics** are untouched: `auto` still short-circuits, `human-locked` still cannot be
flipped, the exhaustion gate still requires an explicit answer, and `retry` still sets exactly that
loop's counter. Invariant register row 17 is not in play. **Test:** the existing gate coverage in
both suites is green and unmodified.

### The three preserved nits — documentation alignment

**AC-6 — each preserved run-history behaviour carries one line of authority in the spike.**
*Surface: `spike/`.* **No code changes.** `spike/src/engine.js` gains exactly three `Why:` lines,
each one line, each naming Q-0037, each saying the same thing its `packages/core` counterpart says
and **citing rather than transcribing** (`harness/rules.md` — *"Never restate `docs/DECISIONS.md` or
a ticket body in a source file"*):

| Site | What the line records | `core`'s counterpart |
| --- | --- | --- |
| `engine.js:379` (the `persistedStage` guard) | unreachable from the command line, where every path loads the ticket from the file this re-reads; reachable from a caller that builds a ticket record itself, which is what the daemon will be | `writer.ts:235` |
| `engine.js:468` (`rollup(ctx.history.manifest.steps)` on every terminal occurrence) | whole-list, and therefore quadratic in occurrence count; reported rather than optimised in passing | `writer.ts:363–364` |
| `engine.js:478–480` (`replaceManifest`'s fixed `.tmp` path) | the path is fixed on purpose, so the next replacement renames a stray away; a run that does not continue leaves one, and nothing cleans it | `writer.test.ts:507–521` |

**Test:** the three lines are present; the spike suite is green and byte-identical in behaviour.
This criterion may be verified by inspection and says so, because there is nothing else to verify —
`spike/**` is outside ESLint's scope entirely (`harness/rules.md`), so no lint sees a comment.

### The ruling — nit 9

**AC-7 — `vendorTokenTotal` is ruled, not changed, in both trees.** *Surfaces: `spike/`,
`packages/core`.*
`vendorTokenTotal` keeps returning `null` when both `input_tokens` and `output_tokens` are null,
whatever the cache fields hold. The ruling, and the reason it is a ruling:

> The cache measures are a **breakdown and never summands** — `spike/src/adapters/claude.js:60`
> folds both `cache_creation_input_tokens` and `cache_read_input_tokens` into `input_tokens` before
> a manifest ever sees one. A row whose totals are both null while its cache fields are populated is
> therefore a manifest **no adapter can produce**: it is malformed, and `harness validate`'s semantic
> pass already reports it, because the roll-up is recomputed from occurrence usage. `tokens=n/a` is
> the honest rendering of absent summands. Summing the cache fields instead would print a number
> that is not a token total, in the one place run history exists to report one — the same
> double-count invariant register row 3 and `spike/test/q0034-review-fixes.js:94–95` exist to
> forbid, reached from the other side.

Nit 2 is ruled in the same shape, on §0.2's measurement: **3.3 ms of manifest rewriting against a
3,755,327 ms run**, over the largest manifest that exists in this repository. Optimising it would
trade a measured nothing for a change to the one write path that must never lose a step a vendor has
billed for.

**Test:** a new assertion in **both** suites over a roll-up row with `input_tokens: null,
output_tokens: null, cached_input_tokens: <n>, cache_write_input_tokens: <m>`, asserting `n/a`, and
sitting **beside** the existing `q0034-review-fixes.js:94–95` pair so the two readings of the cache
fields are covered by adjacent rows rather than by one. The ruling itself goes in the ticket's
`dev/implement-report.md` and in the plan entry at close; the JSDoc on
`packages/core/src/run-history/reader.ts` already carries the reasoning and needs only the
malformed-row sentence.

### The spike CLI — nits 5, 7, 8

**AC-8 — the per-step usage line reports one occurrence's own measures.** *Surface: `spike/`
(`bin/harness.js:258`).*
The detail view's `usage:` line stops calling `formatVendorSummary` with a synthesised
`unpriced_steps`. It renders the occurrence's own `usage` object: the vendor, the cost through the
existing `formatMoney`, and the **four** token measures separately —
`input_tokens`, `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens` — each through
the existing `formatTokens`, so `null` still renders `n/a` and never `0`. No roll-up field appears.
The list view's vendor summaries are **unchanged**, because the frozen contract's *"Every summary
states `unpriced_steps`"* is about them (§0.5).
**Test:** a detail-view assertion that the line names all four measures and that
`unpriced_steps` does **not** appear on it; `spike/test/q0011-runs-cli.js:36–37`'s list assertions
stay green and untouched.

**AC-9 — `harness validate` reads each artifact once.** *Surface: `spike/`.*
`spike/src/contracts.js` gains `validateArtifact(schemaFile, dataFile)` with the shape
`packages/core/src/contracts/contracts.ts:150–163` already has: read schema, read data, structural
verdict, and a `semantic` outcome of `{ contract, ran, reason }`. `bin/harness.js` calls it, so the
second `readData(f)` at `:522` goes. **`validateFile` is kept and unchanged**, because
`spike/test/q0034-review-fixes.js:74` calls it and because charter §2 preserves what it does.
**Test:** an assertion that a validate run over one artifact performs exactly one read of it — a
counting spy or an equivalent — plus the existing validate coverage green.

**AC-10 — `validateFile` and `validateArtifact` agree.** *Surface: `spike/`.*
For every artifact, `validateArtifact`'s structural half returns what `validateFile` returns: same
`ok`, same `errors`, same `schema` and `data` basenames. This is the criterion that stops the
convergence in AC-9 from quietly becoming a divergence. **Test:** an assertion comparing the two
over both a valid and an invalid fixture.

**AC-11 — the skipped-check notice is honest about a schema it does not apply to.** *Surface:
`spike/` (`bin/harness.js:519`).*
The notice is derived from the `semantic` outcome rather than from a boolean computed at `:511`, and
it satisfies all four of:

1. it names the file;
2. it says no product-level semantic checks **ran**, never that any passed — *"skipped is not
   passed"* (2026-08-25) and invariant register row 14;
3. it names `run-manifest-v1` as the only defined contract and `x-quorum-contract` as the mechanism,
   which is what keeps `contracts/Q-0011/runs-cli.contract.md:48–49` satisfied (§0.4);
4. it does **not** contain the substring `run-manifest semantic checks skipped`, which is the exact
   phrasing that reads as a missing check.

A wording that satisfies all four, offered rather than mandated:
`· foo.json: no product-level semantic checks ran — this schema carries no x-quorum-contract annotation, and run-manifest-v1 is the only one defined`
**Test:** assertions for clauses 1, 3 and 4 as literal string checks over a non-run-manifest schema;
the run-manifest path's notice and green tick unchanged.

### Machinery

**AC-12 — `spike-parity.test.ts`'s totals are re-derived, not adjusted.** *Surface:
`packages/core`.*
`q0011-run-history.js` is in the `both` bucket, so AC-2's edit moves `linesOf(named('both'))`
(currently **2026**) and `total` (currently **4825**) at `q0050`-style `toBe` pins
`spike-parity.test.ts:1061` and `:1063`. Both are re-measured from the tree, and the rounded transfer
share at `:1065` is re-derived and stated even if it does not move — it is currently 49% and small
edits do not cross a boundary, which is a fact to record rather than assume. **If a new spike test
file is added**, it needs a `REGISTER` entry with a verdict and named, collected counterparts, or the
register fails by design; the report says which route was taken and why. **Test:** the workspace
suite green, with the moved numbers named in the report.

**AC-13 — both trees in one commit, and the freeze SHA re-recorded in it.** *Surfaces: `spike/`,
`packages/core`, `harness/`, `.github/`.*
Charter §3's two-step procedure, walked as a procedure:

1. every item with a counterpart lands in **both** trees in the **same** commit;
2. `harness/port-charter.md`'s `freeze-sha:` is re-recorded at that tip, in that commit.

Measured precondition: `a6e529a` is an ancestor of `HEAD` and no `spike/src` change has landed since,
so the half is green now and this ticket turns it red by design. **No exemption trailer** — the
exemption path is for a child's branch and Q-0037 is not in `children:` (Q-0041–Q-0054), so the
branch-scope job reports out of scope rather than passing silently; Q-0038, Q-0057 and Q-0080 are the
precedent. In the same commit, `.github/scripts/port-freeze-guard.sh:86` stops naming *"Q-0037..Q-0040
must settle first"* — that precondition was abandoned in §3 on 2026-09-01 and the sentence is a
statement about this ticket inside the script that judges it. The line is currently unreachable
(guarded by `freeze-sha = not-yet-recorded`) and the report says so, so nobody reads its correction
as a bug fix. **Test:** `node .github/scripts/port-freeze-guard.test.mjs` green, and the guard run
against the tip in all three halves.

---

## 5. Non-goals

Explicit, because each has been proposed at least once in this ticket's history.

- **NG-1 — making a handleless gate promise a stated guarantee.** A caller whose gate promise owns
  no handle still drains to exit 0 with a `running` manifest, immediately rather than after a
  second. That is the caller's contract to fix and belongs with M3's daemon, not here (§0.7).
- **NG-2 — optimising the manifest write.** Ruled in AC-7 on measurement. No incremental roll-up, no
  batching, no dropping the `fsync`.
- **NG-3 — cleaning stray `manifest.json.tmp` files.** Preserved and now documented (AC-6). The reader
  reports the manifest it finds beside a stray and repairs nothing, which
  `packages/core/src/run-history/writer.test.ts:507–521` pins by name.
- **NG-4 — making the persisted-stage guard reachable, or removing it.** It is preserved deliberately
  because the daemon is the caller that reaches it (`writer.ts:235`). Only the spike's missing
  comment is in scope.
- **NG-5 — any change to `packages/cli`.** It does not exist. Nit 5's shape is chosen here and Q-0010
  inherits it; nothing is built for it now.
- **NG-6 — editing `contracts/`.** Frozen, and outside `developer-generalist`'s paths. AC-11's wording
  is designed to keep the contract satisfied rather than to amend it.
- **NG-7 — editing `docs/decisions/` or `docs/DECISIONS.md`.** The role forbids it in as many words,
  and §7's GA-1 is the human's.
- **NG-8 — any manifest schema, field or format change.** `contracts/Q-0011/run-manifest.schema.json`
  is untouched. AC-7 changes no persisted byte.
- **NG-9 — touching `.claude/rules/`.** A derived copy, per *"`.claude/rules/` is a derived copy, not
  a surface a requirement may name"* (2026-08-27).
- **NG-10 — Q-0039, Q-0040, Q-0074, Q-0075, Q-0076, Q-0078.** Neighbouring run-history and engine
  tickets. None is touched.

---

## 6. Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a — no auth path, no adapter, no environment variable is touched. No criterion introduces an API-key path in code, test, fixture or example. |
| **Worktree safety** | n/a — nothing writes to the user's working tree. The implement step runs in `.harness/worktrees/` as always. |
| **Gate behaviour** | AC-1 and AC-4 touch `runGate`/`askGate`. Semantics are unchanged and AC-5 evidences it per path: `auto` short-circuits, `human-locked` cannot be flipped, the exhaustion gate needs an explicit answer, `retry` sets exactly one counter. |
| **File format and schema** | Unchanged. AC-7 explicitly changes no persisted field; the manifest schema is untouched. |
| **Lint rules** | `packages/**` is ESLint-covered and the `no-deprecated` rule is the only type-aware one; nothing here introduces a deprecated API. `spike/**` is outside ESLint entirely, which is why AC-6 is verified by inspection and says so. |
| **Cold-clone impact** | Two CLI strings a newcomer could meet: AC-11's notice (shorter path to understanding, since it no longer implies a missing check) and AC-8's usage line (one line, more informative). Neither lengthens the first 30 minutes. |
| **Product-agnostic** | No product name enters any file. |
| **Cross-vendor rule** | Satisfied by the chore flow as configured — `claude` implements, `codex` reviews. |

---

## 7. Gate actions — settle these before the implement step runs

Both are things **no step on this ticket's route can do**. This is the eighth-appearance hazard named
in the ticket body, and both are stated here so the loop is never handed one.

**GA-1 — the DECISIONS date rule (ratification, not a decision).** §0.1 measured that
`docs.test.ts` already enforces one answer: an entry's date may not precede the previously listed
entry's, so a decision made earlier and landed later must carry the later date. Nothing is broken and
nothing is red. What is missing is that the rule lives only in a test. Two ways to close it, both the
human's:

1. **Write the entry now.** It is two sentences and Appendix A drafts them, so it costs a paste.
2. **Open the successor** and close it there. Appendix A is its body, written out in full so the
   obligation cannot expire.

**Recommendation: (2).** This ticket is a remainder-clearing chore; adding a rules ruling with an
external precondition to it is precisely the shape that has cost eight loops in this repository, and
the thing is not broken. **No acceptance criterion above depends on GA-1's outcome**, deliberately —
whichever way it goes, the run is unaffected.

**GA-2 — `harness/Q-0037/integration` does not exist.** Measured: `git branch --list
'harness/Q-0037/*'` returns nothing; only Q-0058's and Q-0062's branches are present. `chore.yaml`'s
`implement` step declares `base: harness/{id}/integration` and its `review` step diffs
`harness/{id}/integration...harness/{id}/implement`, while only `integrate` — which runs later —
creates that branch (`docs/GLOSSARY.md`, `02-sdlc-pipeline-spec.md` §5.8). Since Q-0038 the run
**refuses in the preflight** rather than billing for a worktree silently cut from `HEAD`, which is
charter §8's checklist item becoming load-bearing. **Create the branch before launching the chore
run.**

---

## 8. Open questions

None is a blocker: none changes a file format, a schema or the adapter contract.

**OQ-1 — which date does a decision entry carry, and who rules it?** *Owner: **Ruud**, at the
requirements gate.* Settled de facto by `docs.test.ts` and written down nowhere (§0.1). See GA-1 and
Appendix A. **Recommendation: successor, body in Appendix A.**

**OQ-2 — does AC-8's per-step shape bind `packages/cli`?** *Owner: **Ruud**, at the close.* Nit 5 has
no counterpart today, so this ticket picks a shape that Q-0010 will either inherit or re-decide.
**Recommendation: say at the close that it binds**, in this ticket's plan entry, so Q-0010 inherits a
decision rather than an accident. The alternative — leaving it open — means the same argument twice.

**OQ-3 — should the spike keep `validateFile` at all after AC-9?** *Owner: the implementer, reported
not decided.* Its only remaining caller is `spike/test/q0034-review-fixes.js:74`. Charter §2 keeps
it; the question is whether Q-0010 should carry it forward. **Recommendation: keep, report, do not
decide here.**

**OQ-4 — is thirteen criteria one ticket or two?** *Owner: **Ruud**, at the gate.* See R-6.

---

## 9. Risks

**R-1 — this ticket turns the freeze-SHA job red by design.** Both halves are green today (§0.11).
AC-13 is the answer and it is a procedure, not a judgement. The failure mode to watch is landing the
spike half and the `core` half in *different* commits, which leaves the base red between them.

**R-2 — an unbounded fixture handle turns a failing suite into a hanging one.** `spike/test/run.js`
has no per-scenario timeout. AC-2 requires the ceiling for this reason; it is the one place where the
obvious implementation is worse than the defect.

**R-3 — the three `q0050.source.test.ts` pins must move together.** Deleting the timer and leaving
the `REGISTERED` entry is a red suite, which is the guard working. Deleting both and leaving the
arithmetic comment is a **true record made false**, which nothing catches — and §0.9 found that
comment is *already* narration rather than a live total, so "decrement it" produces a differently
wrong number. AC-4(3) says re-derive.

**R-4 — AC-11 sits against a frozen contract's literal wording.** Handled by construction rather than
by erratum (§0.4), but a reviewer may still raise it. The reviewer is not wrong to; the answer is in
this document and in AC-11's clause 3, and if the reviewer refuses the reading, the correct move is
an erratum ruling AC-11's clause 4 the thing that moves — **not** another implement round. *"A refused
finding is a gate, not another round"* (2026-08-31).

**R-5 — AC-3's red phase is easy to skip and easy to fake.** The whole value of the major's fix is
that the fixture, not the engine, ends up holding the process open. A report that shows only the
green run proves nothing about which of the two changes did the work.

**R-6 — thirteen criteria against charter §9's roughly-ten sizing.** Eight of them are one-line
assertions or documentation, so the weight is nearer eight. **Recommendation: keep as one ticket.**
Splitting means walking §3's mirror-and-re-record procedure twice, and re-recording the freeze SHA is
the most expensive per-commit act in the ticket. If it is split anyway, the seam is
`AC-1..AC-7` (both trees, one commit, one re-record) against `AC-8..AC-11` (spike CLI only) — and
the second half then needs its own re-record because it touches `spike/src/contracts.js`, which is
the argument against splitting.

**R-7 — the ticket body's citations are being copied forward.** Two were wrong before this run
(§0.1, §0.8) and both had been re-measured on 2026-09-01. Nothing in this document should be
transcribed into a durable record without re-running it — *"a measurement copied from a document is
not a measurement"* (Q-0058).

---

## Appendix A — successor body for OQ-1, written out in full

*Transcribed rather than referenced, so the obligation cannot expire if OQ-1 is routed to a
successor. If GA-1 option (1) is taken instead, the ruling below is the entry's substance.*

---

**Title: An entry's date is the date it takes its place in the index.**

**The finding.** `docs/DECISIONS.md` is described in three places as *"append-only, newest last"* and
is simultaneously grouped under `## YYYY-MM-DD` headings that must match each entry's own
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
by title and date. **No code changes.** `docs.test.ts` is not touched under reading (a). Nothing in
`spike/`, `packages/core` or `contracts/` is involved, and this must not be attached to a ticket
whose implement step would then be blocked on an entry no step on its route may write.
