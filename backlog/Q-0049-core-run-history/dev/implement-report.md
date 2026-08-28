# Q-0049 — implement report

*Iteration 3. A revision round over `review/chore-iter-2.md`, which raised four majors.*

**The shape of this round in one paragraph.** Three of the four findings say that iteration 2
changed behaviour the requirement's errata had already ruled must be preserved, and they are right.
Iteration 1 ported the spike as it stands and reported two of its oddities; round 1's review raised
both as majors; `requirements/errata.md` **E-1** then settled both in charter §2's favour and closed
with a standing instruction — *"neither is a finding… a reviewer **may** block if the behaviour has
been changed to match the sketch"* — and **E-2** ruled the third a nit with a named resolution.
Iteration 2 implemented round 1's findings anyway, so round 2 blocked on exactly the clause E-1
reserved. This round puts all three back and keeps the one change E-2 does authorise. The fourth
finding is new, is not about preservation at all, and is correct.

Everything below is stated against the working tree, not against the previous report.

---

## The four review findings

### Finding 1 — `writer.ts:265`, the runs root's creation was wrapped in a translated refusal

**Accepted, reverted.** Iteration 2 wrapped `fs.mkdirSync(runsRoot, { recursive: true })` in a
`try`/`catch` that threw `run directory allocation refused: could not create .quorum/runs (…)`. That
is the branch AC-2's *Test:* sketch asks for and the one E-1 supersedes, because AC-2's **numbered
body** — which E-1 leaves normative — binds that sentence to **step 3**, the run directory. Step 2 is
bare in the spike (`spike/src/engine.js:342`, no `catch` of its own), so a file at `.quorum/runs`
fails there and what reaches the caller is a raw `Error` carrying `code: 'EEXIST'`.

The call is bare again. It now carries the line that stops this from being re-litigated a third time:

```
// Bare, and the run directory below is not: only the second failure is translated into a sentence,
// so a `.quorum/runs` that is a file stops the run with the raw errno rather than with one of the
// three refusals.
// Why: preserved behaviour, see Q-0049 requirements erratum E-1 — the criterion's own numbered
// body binds "could not create" to the run directory.
```

`initialiseRunHistory`'s `@throws` block is back to naming three refusals, with one added sentence
saying what the history root's own creation does instead — so a reader of the signature learns the
asymmetry without reading the body.

The test is back to asserting the raw errno, and asserts the negative that matters: the thrown value
is an `Error` and **not** a `FlowError`, so a later change to translate it fails here rather than
passing quietly. The genuine `could not create` branch is still reached by the read-only-runs-root
test above it, which is untouched.

### Finding 2 — `writer.ts:371`, `isExistingFile` replaced the ported `existsSync`

**Accepted, reverted.** Iteration 2 added an `isExistingFile` helper (`statSync(…).isFile()`) so that
a **directory** named `output.txt` would fail the guarantee, attempt the write, and warn. E-1
measured the spike on this exact line — `spike/src/engine.js:421` guards with
`if (!fs.existsSync(outputPath))`, and `existsSync` answers `true` for a directory — and ruled that
the case **writes nothing and warns nothing**. There is no path on which the spike warns here.

The helper is deleted and the guard is `fs.existsSync(outputPath)` again, with:

```
// `existsSync` answers true for a directory, so a directory wearing the name skips the
// guarantee in silence rather than warning.
// Why: preserved behaviour, see Q-0049 requirements erratum E-1.
```

The test asserts the silent skip again — no warning, and the occurrence still reaching the manifest
as `completed`. The reviewer's instruction to *"keep the removed-occurrence-directory test for the
reachable warning path"* is satisfied: that test is untouched and still asserts the warning names
`…/output.txt` while the failed-but-billed occurrence reaches disk with its `cost_usd: 0.5` intact.
Iteration 2's extra *"already a regular file"* test is removed — it existed only to cover the
`isFile()` branch, and the case it describes is already asserted by *"an existing output.txt is not
overwritten by the guarantee"* three tests above it.

### Finding 3 — `writer.ts:119`, `persist`'s parameter had been widened to `unknown`

**Accepted, reverted to E-2's literal resolution.** E-2 is explicit: *"restore `String(text)` and keep
the parameter typed `string`… Do **not** widen the parameter type to `unknown` or `string | number`;
that would be the behaviour change this erratum exists to avoid, in the opposite direction."*
Iteration 2 restored the conversion and widened the type, which is half the instruction.

The signature is `persist(occurrence: Occurrence, name: string, text: string): void` again, and the
implementation keeps `fs.writeFileSync(target, String(text))`. Both halves are load-bearing and the
comment says which does what, because a conversion applied to an already-`string` parameter reads as
dead code to anyone who has not read E-2:

```
// `String` has no work left to do on a parameter the compiler has already refused a non-string
// for — the type is the guard, and the conversion is what was ported.
// Why: see Q-0049 requirements erratum E-2.
```

Iteration 2's *"a value that is not a string is written as String() renders it"* test is deleted. It
codified the widening as behaviour, and with the parameter back to `string` its two calls no longer
compile.

### Finding 4 — `writer.ts:127`, `finalise` accepted `'running'`

**Accepted, and it is a real defect rather than a preservation question.** AC-9 enumerates the domain
in its own sentence — *"`RunStatus` admits every terminal status the schema allows — `completed`,
`failed`, `aborted`, `regressed`, `exhausted`, `interrupted` — and `finalise` writes whichever it is
given"* — which is **six**, while `RunStatus` is seven. The parameter was the seven, so a caller
could produce `status: 'running'` beside a non-null `ended_at` and a non-null `duration_ms`: a
manifest the frozen schema accepts structurally, that Q-0045's semantic pass has no rule against, and
that contradicts the one sentence this subsystem exists to enforce. It is also precisely the state
AC-12 tests as the thing a `SIGKILL` leaves behind, so a reader cannot tell the two apart.

`finalise(status: Exclude<RunStatus, 'running'>, stageAfter: string | null)`. Three notes on the
shape:

- **`Exclude<…>` inline rather than a new exported `TerminalRunStatus`.** AC-1 asserts the **exact**
  export list of each of the three files, and `manifest.ts`'s is the eight types and the four pure
  functions. A ninth exported type would fail that criterion, so the narrowing is written where it is
  used and adds no surface.
- **Compile-time only.** No runtime path changes: `finalise` assigns whatever it is handed, exactly as
  before, and the spike — being JavaScript — has no parameter type for this to diverge from. Nothing
  in charter §2's preservation rule is touched.
- **Pinned, not merely written.** The AC-9 test now opens with a `@ts-expect-error` on
  `history.finalise('running', null)`. That assertion is load-bearing in both directions: an unused
  `@ts-expect-error` is itself a `tsc` error, so if the parameter is ever widened back the typecheck
  fails rather than the suite silently asserting nothing. The status array is typed
  `Exclude<RunStatus, 'running'>[]` and still walks all six.

**One thing I did not do, flagged rather than decided.** `terminal`'s `status` parameter is still the
full `RunStatus`. The finding names `finalise` and cites AC-9, which enumerates six statuses for the
run's end and for nothing else; `terminal` writes into `Occurrence.status`, a field the schema and
AC-4 both require to be `'running'` for a still-open occurrence, so the two are not the same
question. Narrowing it would be a design change no criterion asks for. If the reviewer reads the
asymmetry as an inconsistency, it is deliberate and this paragraph is where I say so.

---

## File by file, this round

**`packages/core/src/run-history/writer.ts`** — four changes, all above. Reverted: the runs-root
translation (deleted, plus its `@throws` clause), the `isExistingFile` helper (deleted entirely, 15
lines), `persist`'s `unknown` parameter (back to `string`). Changed: `finalise`'s parameter narrowed,
with the reason in its `@param`. Kept from iteration 2: `String(text)`, per E-2. Added: three `Why:`
lines citing E-1 and E-2. The file is otherwise byte-identical to iteration 1's, which is the
intended end state — E-1 and E-2 exist to say iteration 1 was right about all three.

**`packages/core/src/run-history/writer.test.ts`** — the runs-root-is-a-file test back to the raw
`EEXIST` assertion; the `output.txt`-is-a-directory test back to the silent skip; iteration 2's two
added tests (the regular-file variant and the non-string `persist` variant) removed; the AC-9 test
gains the `@ts-expect-error` pin and its status array retyped. Each restored comment now names E-1
explicitly, so the next reader finds the ruling from the test rather than from this report.

**`packages/core/src/turbo-inputs.test.ts`** — both register entries iteration 2 moved are back where
they were: `writer.ts`'s read base is `outputPath` again (`isExistingFile`'s `target` no longer
exists), and `writer.test.ts`'s `outputPath` entry is removed, because the only read API pointed at
it was iteration 2's `fs.statSync(outputPath)`. Both directions matter — the guard fails on an
unregistered base **and** on a stale one (`AC-7 clause C4`, *"the register holds no entry for a base
that has gone"*), so leaving it would have been a red suite, not a tidy-up. `COLLECTED_BASELINE`, the
`MANIFEST` entry and the `ESCAPING_LITERALS` entries from iteration 1 are unchanged; this round adds
and removes no repository read.

**`packages/core/src/run-history/run-history.source.test.ts`** — one word. The comment above
`expect(fields.length).toBe(56)` read *"Forty-three across eight interfaces"* and then enumerated
eleven interfaces summing to fifty-six. It is now *"Fifty-six across eleven interfaces"*. Not part of
any finding: it is a factual contradiction inside a comment this ticket itself wrote, in the sentence
whose whole job is to make the walk's coverage checkable by a reader. I would rather report a
one-word correction than leave a number that disagrees with the list beside it.

---

## Noticed while reading, reported and not acted on

Per AC-13 and charter §2. **A reviewer may not treat any of these as a blocker; a reviewer may block
if one has been fixed.** Unchanged from iteration 1 except where marked.

### The three findings the requirement carried

1. **List mode and detail mode disagree about a symlinked run directory.** `readRunsDir` filters
   `d.isDirectory()` on a `Dirent` from `readdirSync(…, {withFileTypes: true})`, which is `lstat`
   semantics, so a symlink pointing at a sibling run directory is skipped from the listing in
   silence; `resolveRunDirectory` accepts it, because its real parent *is* the real runs root, and
   renders the target's manifest under the alias. Neither is wrong; they are two answers to one
   question. Pinned in both directions by `reader.test.ts`, and named on a one-line `Why:` in
   `reader.ts`, so a later change to either is deliberate.
2. **`ctx.stats.cost` is a blended cross-vendor money total, and it is persisted** into `ticket.md`'s
   `history[].cost` and into `runs.log` (`engine.js:634`, `:649`). It predates Q-0011 and is not the
   roll-up the writer contract governs, so the contract's ban is not violated — but register row 3's
   *"never blended"* and this field have coexisted since M0. `countUsage` is ported with its
   arithmetic unchanged; the summing and the writing are `finish()`'s, which is Q-0050's.
3. **The persisted-stage guard is unreachable from the CLI and reachable from `core`.** Q-0037 files
   it as an unreachable nit, correctly for the spike. It is not unreachable for a caller that
   constructs a ticket record itself, which is M3's server. Preserved as-is, tested, and the reason
   this module imports `parseFrontmatter`.

### The two E-1 preserved oddities, now cited in the source

Added to this list in this round, because after two rounds of being reported and re-fixed they belong
in the durable register rather than only in a review reply:

4. **A `.quorum/runs` that is not a directory stops the run with a raw `EEXIST`,** not with one of the
   three named refusals — the history root's creation is bare and only the run directory's failure is
   translated. Preserved (E-1); asserted, including the negative that it is not a `FlowError`.
5. **A directory named `output.txt` skips the guarantee silently.** `existsSync` does not distinguish
   one, so nothing is written and nothing is warned, and the occurrence still reaches the manifest.
   Preserved (E-1); asserted. The reachable warning path — a removed occurrence directory — is tested
   beside it.

### Q-0037's list, as it touches this module

- **The unreachable-from-the-CLI stage guard** — finding 3 above.
- **The quadratic re-serialisation.** `terminal` recomputes `manifest.rollup` from the whole `steps`
  array and re-serialises all of it on every terminal occurrence. Preserved, and named on a `Why:`
  line rather than optimised in passing.
- **The unclean `.tmp`.** Nothing names or cleans a stray `manifest.json.tmp`. A run that continues
  removes it as a side effect of its next replacement; a run that stops leaves it for good, and the
  reader reports the manifest beside it and repairs nothing (NG-9). Both halves are tested.
- **The per-step `usage:` line reusing a roll-up formatter.** `bin/harness.js:230` renders a step's
  usage through `formatVendorSummary` with a synthesised `unpriced_steps`. Rendering, so it stays in
  the CLI until Q-0010; nothing about it moved here.
- **`vendorTokenTotal`'s null-with-populated-cache case.** A row whose `input_tokens` and
  `output_tokens` are both null but whose cache fields are populated answers `null`. Preserved — and
  it is the right answer, because the cache measures are a breakdown of a total that was not
  reported. Covered explicitly rather than left to inference.

### Three functions deliberately left to their owners

- **`trimIncompleteUtf8Suffix`** (`engine.js:895`) — its only call site is `materialiseDiff`
  (`:835`), so it is diff machinery. **Q-0051's** (NG-2).
- **`formatCost`** (`engine.js:533`) — its only non-test call site is the step completion line at
  `:302`, so it is narration rather than arithmetic. **Q-0052's** (NG-2).
- **`reviewRound`** (`engine.js:753–759`) — `ctx.vars` bookkeeping sitting immediately below
  `nextRunId`. **Q-0050's**, named because adjacency is how a port takes a function nobody assigned
  it.

**Correction to the previous two reports on OQ-1.** Both said the fallback was still needed because
*"neither Q-0051's nor Q-0052's ticket body names its function"*. That was already false when it was
written: the human commit `f6f0830`, *"the two functions Q-0049 declines get owners, and Q-0037 gets
its ruling"*, landed **before** iteration 1 and transcribed both, and it found something the
requirement had not — Q-0051's body states its range as `engine.js:785–894`, and
`trimIncompleteUtf8Suffix` begins at `:895`, so a port trusting the stated range would have taken
everything except that function. **OQ-1 is closed**, and this report is no longer anyone's fallback
for it.

---

## What I deliberately did not do

- **No edit under `spike/`, `contracts/`, `docs/`, `backlog/` or `.claude/`.** The freeze holds:
  `git diff --name-only main...HEAD` is the same eight files as before, all under `packages/core`.
  This round touches four of them.
- **No fix to any item in the reported list**, including the two E-1 items now added to it. Fixing
  one is what round 2 blocked on, twice over.
- **No narrowing of `terminal`'s status parameter**, and no new exported type for the terminal
  statuses — both explained above, under finding 4.
- **No new file, export, dependency or `packages/shared` symbol.** `packages/core/src/index.ts` is
  still byte-identical to Q-0041's pin, the folder is still the three files, and
  `packages/core/package.json` still declares exactly `@quorum/shared`, `ajv`, `ajv-formats`, `yaml`.
- **No change to `contracts/Q-0011/`** (NG-3), no rate table or money formatting (NG-8, AC-7), no
  repair of persisted state (NG-9), and no documentation edit (NG-10).

---

## Verification

Run in this worktree, forced, after the last edit:

| Command | Result |
| --- | --- |
| `pnpm turbo run lint --force` | 7 successful, **0 cached** |
| `pnpm turbo run typecheck --force` | 7 successful, **0 cached** |
| `pnpm turbo run test --force` | 7 successful, **0 cached** — core **837 passed**, 2 skipped |
| `npm test --prefix spike` | **13/13 test files passed** |

The two skipped tests are `adapters/real-cli.probe.test.ts`, which is
`describe.skipIf(!process.env.QUORUM_REAL_CLI)` and reports *skipped* rather than *passed* by design
(*"a check that skips its subject must not report success"*, 2026-08-25). Nothing this ticket wrote
skips.

The typecheck run is the one that proves finding 4 landed: an unused `@ts-expect-error` is a `tsc`
error, so a green typecheck is the assertion that `finalise('running', …)` genuinely does not
compile.

**Still owed at the gate, and not mine to do here:** AC-13's last clause asks for the same three
tasks re-verified **on the merge result** rather than taken from `integrate`'s tick (Q-0072's closing
finding — a change can be green in a worktree and red on `main`), and the pre-run checklist's warning
that an unanswered final gate rolls proven-green work back (Q-0040) still applies.
