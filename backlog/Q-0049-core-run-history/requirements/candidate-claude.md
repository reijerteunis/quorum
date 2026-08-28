# Q-0049 — `core/run-history`: the manifest, occurrences, roll-ups and the reader

*Requirement candidate, product-manager role, 2026-08-28. Route: **chore** (`requirements → chore →
human gate`). Parent Q-0009; charter `harness/port-charter.md`, §6 row `Q-0049`. Depends on Q-0041
and Q-0045, both verified `main:contained` today. Depended on by Q-0050, which is **solutioned and
blocked on this ticket**.*

Every citation below was read against the working tree, not inherited from a ticket body. Where this
document and `harness/port-charter.md` §6 differ, **the charter is right**. Four of the ticket body's
own claims did not survive being re-read and are corrected in "What the ticket says and what the tree
says"; none of the corrections needs an erratum, because each replaces a claim with the line that
settles it rather than changing what the ticket asks for.

**No decision entry is a precondition for this ticket.** Stated first because the last two
requirements runs each exhausted a loop on a blocker no step in their flow could satisfy. Nothing
here needs a `docs/decisions/` entry written before implementation, and no criterion names
`backlog/`, `.claude/rules/` or `docs/decisions/` — the three surfaces a `chore.yaml` implementer
cannot write.

---

## Problem

Run history is the only part of Quorum that answers *what did this cost, and what actually happened*
after the terminal has scrolled. In the spike it is not a module. It is roughly 195 lines threaded
through a 1,113-line `engine.js` — `initialiseRunHistory` (`:325–376`), the `WeakMap` and
`allocateOccurrence` (`:378–403`), `terminalOccurrence` (`:405–427`), `persistArtifact` (`:429–433`),
`replaceManifest` (`:435–450`), `normaliseUsage` (`:452–461`), `rollup` (`:463–475`), `errorOf` with
its `AUTH_REWRITTEN` pattern (`:477–494`), `countUsage` (`:523–530`), the finalisation block inside
`finish()` (`:625–632`) and `nextRunId` (`:744–752`) — plus its *reader*, which lives in the CLI:
`realPath` (`bin/harness.js:135`), `manifestShapeError` (`:142`), `readRunsDir` (`:151`), `sortRuns`
(`:171`), `isIncomplete` (`:182`), `occurrenceSeq` (`:184`), `vendorTokenTotal` (`:197`) and the
confinement predicate at `:547–554`.

Writer and reader are one subsystem with one persisted format between them, and **M3's server needs
both** — `docs/04-architecture.md:58` lists run history as a screen and `:34` says the daemon
rebuilds its index from disk. A port that leaves the reader in `bin/harness.js` hands Q-0010 a
package the server has to shell out to.

Three things make this more than a translation.

**The format is frozen and the code that writes it is not.** `contracts/Q-0011/run-manifest.schema.json`
is `additionalProperties: false` at all three levels — 13 top-level keys, 15 per occurrence, 8 per
roll-up row — and this ticket may not change one byte of it. Q-0035's closing entry declined to add
the diffed SHAs to the manifest for exactly this reason, having just spent an evening on archaeology
that field would have saved. Every structural temptation a rewrite offers — a class instance instead
of a plain object, a private field for bookkeeping, a `Map` for the roll-up — is a temptation to
violate it, and `JSON.stringify` will not warn.

**Three defects this code has already had are each one plausible simplification away from returning**,
and — the standing hazard of charter §2 — losing any of them turns neither suite red. The spike keeps
the old behaviour; the ported suite would be written from the tree that has the new one. Both green,
the product wrong.

**Q-0050 is waiting.** Its solution is written and its errata say so in as many words:
*"Still blocking the next stage: Q-0049 is `draft` and `packages/core/src/run-history/` does not
exist"* (`backlog/Q-0050-…/solution/errata.md:165`). Charter §5 clause 3 orders Q-0049 before
Q-0050–Q-0053, and clause 5 stops a child whose dependency is not contained. Five children queue
behind this one. That is also what constrains the design: **the engine does not exist yet, so this
module must be drivable, and testable, without one.** The spike's run history cannot be, because it
reads and mutates `ctx`.

---

## User stories

**`maintainer` — the solo maintainer.** *"When a run fails, that is exactly when I want to know what
it cost. I want every attempt on disk — including the ones that crashed — with the prompt that was
sent and the text that came back, and I want the per-vendor numbers never blended into one figure
that is fiction the moment Codex is in the mix."*

**`contributor` — the adapter contributor.** *"I want one module I can read to know what a run writes
and where. If the answer is spread between an engine and a CLI, I cannot check whether my adapter's
usage reaches the roll-up."*

**`adopter` — the cold-clone adopter.** *"Run history is written into my repository. I want it
excluded from `git status` without being asked, I want a token I type at a command line to be unable
to read a file outside it, and I never want a run that started to simply stop existing."*

**Surfaces:** `packages/core` — the library and its Vitest suite, plus the two register entries in
`packages/core/src/turbo-inputs.test.ts` that make a new out-of-package read visible to the cache.
**Not** the CLI (`quorum` is Q-0010, and `bin/harness.js` is frozen by charter §3 in any case),
**not** the engine (Q-0050–Q-0053), **not** `contracts/`, **not** `backlog/`, `harness/` or `docs/`.
No document in the repository disagrees with this port; verified below.

---

## Context the implementer should not re-derive

Read once. Every line was checked against the tree on 2026-08-28.

### What is already there

`packages/shared/src/constants.ts` shipped the run-history vocabulary in Q-0041, with each constant
carrying the citation of the spike line it replaces: `RUN_HISTORY_ROOT` (`:44`), `MANIFEST_FILE`
(`:47`), `PROMPT_FILE` (`:50`), `OUTPUT_FILE` (`:53`), `OCCURRENCE_DIR` (`:56`),
`OCCURRENCE_SEQUENCE_PAD` (`:59`), `runIdOf()` (`:65`), `occurrenceDirName()` (`:74`),
`RUNS_LOG_FILE` (`:120`) and `USAGE_MEASURES` (`:149`). **They exist for this ticket.** Nothing here
adds to `shared`.

`packages/core` already exports everything else this module needs: `FlowError`
(`src/lint/lint.ts:29`), `authError` (`src/adapters/adapters.ts:433`), `transientError` (`:317`),
`AdapterUsage` (`:44`), `ensureExcluded` (`src/git/git.ts:240`), `parseFrontmatter`
(`src/backlog/backlog.ts:62`), and `validateArtifact` / `checkRunManifestSemantics` in
`src/contracts/`. **This ticket adds no dependency to `packages/core/package.json`.**

`packages/core/src/contracts/run-manifest.ts:5–10` is a constraint, not a resource. Its module
header says the recomputation *"is a check only because it is a SECOND implementation … Nothing here
may import from `../run-history/`, now or later."* The obligation runs both ways: **this module must
not import `computeManifestRollup` either.** Two independent implementations that disagree are the
whole signal; one implementation compared against itself detects a hand-edited file and nothing else.

`packages/core/test/` holds the fixtures this ticket's tests need and must not duplicate: `repo()`,
`tempDir`, `write`, `git`, `commit`, `walk`, `installGitShim`, `withEnv`, and `coreSourceFiles()` /
`repoFile()` for source-level rules. `coreSourceFiles()` has been recursive since Q-0064 and keys
every entry by its path below `src` — `run-history/writer.ts`, never a bare filename.

`contracts/Q-0011/run-manifest.schema.json` is **already** a declared turbo input of
`@quorum/core#test` (`packages/core/turbo.json`), so validating this module's output against it costs
no configuration change — only the two register entries named in AC-14.

### The two frozen contracts, and what they bind

`contracts/Q-0011/run-history-writer.contract.md` and `runs-cli.contract.md` are the specification
this port preserves; the schema is its structural half. Three clauses are worth lifting out because
they are the ones a rewrite silently breaks:

- *"Replace `manifest.json` synchronously … `writeFileSync` a complete same-directory temporary file,
  `fsyncSync` and `closeSync` it, then `renameSync` it over the manifest"* — the sequence, not merely
  the outcome.
- *"Input totals already include vendor-reported cache components; readers do not add them again."*
- *"Never calculate a cross-vendor monetary total"*, and *"if none reported a measure, the result is
  null"* — a wholly token-only vendor has `cost_usd: null`, never `0`.

### The module, function by function

| Symbol | Spike | What must survive |
| --- | --- | --- |
| `initialiseRunHistory` | `engine.js:325–376` | The order: persisted-stage guard → `mkdir` root recursive → `mkdir` run dir **non**-recursive → `steps/` → manifest object → `ensureExcluded` → fatal first write. Three refusal messages, byte-exact. |
| `occurrenceStart` (`WeakMap`) | `:385` | A side table, never a field. `terminalOccurrence` used to delete a stamped field just before its own write, so any *other* step's write persisted it and violated `additionalProperties: false`. |
| `allocateOccurrence` | `:387–403` | `++sequence`; `steps/NNN-<id>` with `/` and `:` → `-`; exactly 15 keys; pushed onto `manifest.steps`; added to the active set. |
| `terminalOccurrence` | `:405–427` | Returns silently if not active; `Object.assign(occurrence, fields, {status, duration_ms})` in that order; guarantees `output.txt`; recomputes the roll-up; replaces the manifest. |
| `persistArtifact` | `:429–433` | `writeFileSync(target, String(text))`; on failure warns naming the path and continues. |
| `replaceManifest` | `:435–450` | `openSync`/`writeFileSync(fd)`/`fsyncSync`/`closeSync`/`renameSync`; `JSON.stringify(m, null, 2)` + `"\n"`; fd closed best-effort on error; `fatal` only at initialisation. |
| `normaliseUsage` | `:452–461` | `null` in → `null` out; `vendor ?? fallbackVendor`; five measures each `?? null`. |
| `rollup` | `:463–475` | Accumulator over **all** occurrences with usage, whatever their status; a measure nobody reported stays `null`; `unpriced_steps` counts `cost_usd == null`. |
| `errorOf` + `AUTH_REWRITTEN` | `:477–494` | Classification **delegated** to `authError`/`transientError`; the extra pattern recognises the contract layer's own rewritten wording. |
| `countUsage` | `:523–530` | Unpriced counted, not zeroed; tokens are input + output only. |
| `finish()`'s history block | `:625–632` | `status`, `ended_at`, `duration_ms` from the **same** `started` value as `started_at`, `stage.after`, roll-up, replace. |
| `nextRunId` | `:744–752` | `max(highest in ticket history, highest `run=(\d+)` in `runs.log`) + 1`. |
| `realPath` | `bin/harness.js:135` | `realpathSync`, `null` on failure. |
| `manifestShapeError` | `:142–149` | Four messages, byte-exact; `run_id`/`ticket_id`/`status` must be strings; `steps`/`rollup` must be arrays. |
| `readRunsDir` | `:151–169` | Missing root → empty; directory entries only; per-entry try/catch; `ENOENT` → `missing manifest.json`, else `malformed manifest.json (…)`. |
| `sortRuns` | `:171–180` | `started_at` **descending**, then `run_id` **ascending** by plain string order — which is why `Q-0011-10` precedes `Q-0011-2`. |
| `isIncomplete` | `:182` | `status === 'running' || ended_at == null`. |
| `occurrenceSeq` | `:184–187` | `^steps/(\d+)-`; no match → `Number.MAX_SAFE_INTEGER`, so an unparseable entry sorts last. |
| `vendorTokenTotal` | `:197–200` | input + output over **reported** values; `null` when both are null; cache fields are **not** summands. |
| the confinement predicate | `:547–554` | Single segment, not `''`/`.`/`..`, both sides `realpath`'d, `dirname(realDir) === realRoot`, then `existsSync` + `isDirectory()`; the manifest is read from `realDir`. |

### What the ticket says, and what the tree says

Four claims in the ticket body were re-measured before writing this, because a requirement is a
durable record and the last three ports each found an inherited claim that was wrong.

**1. `trimIncompleteUtf8Suffix` is not run history.** The ticket body lists it among the writer's
functions. It has exactly one call site in the repository — `engine.js:835`, inside
`materialiseDiff`, trimming a truncated **diff** to a UTF-8 boundary — and charter §6 gives
`engine.js` diff preflight and materialisation to **Q-0051**. The body itself says the register wins
where the two differ. It is a non-goal here (NG-2), and OQ-1 asks for one line in Q-0051's body at
this gate, because an obligation that exists only in this document is one both tickets can drop.

**2. "Whole failed runs are missing from `ticket.md`'s `history`" is not this ticket's surface, and
reads as already closed.** `engine.js:634` appends an outcome for **every** status, unconditionally,
and all three non-completion routes reach it: the initialisation catch (`:79`), the run catch
(`:167`) and the signal handler (`:60`). Q-0050's merged requirement verified the same lines
independently and recorded it as settled. The M1 figure the body quotes — $22.15 against $33.74 —
describes the tree before those routes existed. The owner is `finish()`, which is **Q-0050's**. What
no amount of code closes is `SIGKILL`, and the contract already names that: a `running` manifest is
reported, never repaired.

**3. The `realpath` half of the traversal guard has no test, in either suite.**
`spike/test/q0034-review-fixes.js:118–130` (B4) is the only test of the guard, and its five tokens —
`'../secret'`, `'.quorum/secret'`, an absolute path, `'..'` and `'.'` — are each rejected by the
*string* clauses alone (`token === path.basename(token)`, and the `''`/`.`/`..` exclusion). **A port
that drops `realPath` and compares `path.resolve` strings passes every test in both suites**, and
re-opens the hole Q-0011's round-2 panel found in round 1's own fix. This is Q-0071's lesson —
*the demonstration that a guard has a subject proves the guard fires, not that each of its clauses
does* — arriving on a security guard rather than on a cache fixture. AC-11 makes the symlink case a
test for the first time. It is the highest-value line in this document.

**4. Q-0037 is `stage: draft`.** The body offers "land it on the spike first or port the fixed
version — but not both". Neither has happened, so the choice is not available: this port takes the
**unfixed** code, which is also what charter §2 requires. The consequence is a sequencing question,
not an implementation one — OQ-5.

### Three things found while reading, all preserved and reported

Each was established by reading the code, not inferred from a comment. None is fixed here (charter
§2); each goes in `dev/implement-report.md` under AC-14.

1. **List mode and detail mode disagree about a symlinked run directory.** `readRunsDir` filters
   `d.isDirectory()` on a `Dirent` from `readdirSync(…, {withFileTypes: true})`, which uses `lstat`
   semantics — so a symlink pointing at a sibling run directory is skipped from the listing in
   silence, while detail mode accepts it (its real parent *is* the runs root) and renders the target's
   manifest under the alias. Neither is wrong; they are two answers to one question.
2. **`ctx.stats.cost` is a blended cross-vendor money total, and it is persisted.** The reader is
   scrupulous about never printing one, and `engine.js:634` and `:649` write exactly that number into
   `ticket.md`'s `history[].cost` and into `runs.log`. It predates Q-0011 and is not the roll-up the
   writer contract governs, so the contract's ban is not violated — but register row 3's *"never
   blended"* and this field have coexisted since M0 and nothing says so out loud. `countUsage` is
   ported unchanged; `finish()` is Q-0050's.
3. **The persisted-stage guard is unreachable from the CLI and reachable from `core`.** Q-0037 files
   it as an unreachable nit, correctly for the spike: `runFlow` refuses on a stage mismatch at `:38`
   and every CLI path loads the ticket from the file the guard re-reads. It is *not* unreachable for
   a caller that constructs a ticket record itself, which is M3's server. It is preserved as-is, and
   it is the reason this module imports `parseFrontmatter`.

### The boundary, stated so a reviewer need not derive it

- **Q-0050** owns `runFlow`, `finish()`, `outcome()`, `recordEvent()`, the signal handlers and the
  event stream. Its merged requirement already names the four places it calls this module (`:59`,
  `:69`, `:164`, `:625–632`) and says it *"owns the lifecycle contract"* while implementing none of
  it. Its solution says the persistence capability *"adapts Q-0049's landed API"*, so **this ticket
  is free to design that API** and is not pre-empted by anything Q-0050 has written.
- **Q-0051** owns the diff preflight and materialisation, including `trimIncompleteUtf8Suffix`.
- **Q-0052** owns `runAgentStep`, `runScript`, `runGate`, and therefore `formatCost` (`:533–537`),
  which is step narration: Q-0050's message oracle already owns the priced/unpriced text.
- **Q-0053** owns fan-out and integrate, and with them the rule that a fan-out parent allocates no
  occurrence. This module allocates only when asked; it has no path that allocates on its own.
- **`reviewRound` (`:753–759`) is nobody's here.** It sits immediately below `nextRunId`, reads the
  ticket's `review/` folder, and is `ctx.vars` bookkeeping — Q-0050's. Named because adjacency is how
  a port takes a function nobody assigned it.

**The line that decides all of these: this module computes, and does not narrate.** `rollup`,
`normaliseUsage`, `countUsage`, `vendorTokenTotal`, `occurrenceSeq`, `isIncomplete` and
`manifestShapeError` are arithmetic and classification over persisted data, and come here.
`formatCost`, `formatMoney`, `formatTokens`, `formatVendorSummary`, `statusLabel`, `runHeaderLine`
and the two printers are rendering, and stay where charter §7 puts rendering. That rule is checkable
(AC-12) where "use your judgement about the boundary" is not.

### Register rows 3, 4 and 15 — which clause is whose

- **Row 3** — *"Claude cost is money, Codex is tokens with cost `null`; no rate table ships; `null`
  renders `n/a`, never `$0.000`; a roll-up states how many steps were unpriced."* This ticket owns the
  **representation**: `cost_usd` stays `number | null` end to end, `unpriced_steps` is counted, no
  rate table and no money formatting exists in the module at all (AC-12). The *rendering* clause is
  satisfied by the CLI today and moves at Q-0010.
- **Row 4** — shared with Q-0047. Its Q-0047 clauses (failures on stdout; the vendor's own
  `input_tokens` excluding cache traffic) are landed. **This ticket's clause is "a failed step's cost
  is in the roll-up"** (AC-7). Note the direction of row 4's cache sentence: it describes the
  vendor's raw JSON, and `packages/core/src/adapters/claude.ts:68–75` folds both cache fields **into**
  `input_tokens` before it reaches a manifest. So a manifest's `input_tokens` already contains them,
  which is precisely why `vendorTokenTotal` must not add them again — the defect that overstated the
  M0 figures by roughly 35% and passed Q-0011's own suite because its fixture left both fields null.
- **Row 15** — wholly this ticket's, and it is five clauses: atomic replacement; gates and fan-out
  parents allocate no occurrence (this module's half: it never allocates unasked); adapter occurrences
  retain exact `prompt.txt` and `output.txt`; a `running` manifest is reported, not repaired; and the
  reader's traversal guard resolves `realpath` rather than testing strings.

---

## Acceptance criteria

Every criterion is testable with Vitest over throwaway repositories built by
`packages/core/test/repo.ts`. No adapter, no vendor CLI, no network, no cost.

### AC-1 — The module lands as three files in `run-history/`, adds no dependency, and prints nothing

`packages/core/src/run-history/` gains exactly:

| File | Holds | Ported from |
| --- | --- | --- |
| `manifest.ts` | the types — `RunManifest`, `Occurrence`, `OccurrenceUsage`, `VendorRollup`, `RunStatus`, `OccurrenceKind`, `ErrorCategory`, `RunError` — and the pure functions `normaliseUsage`, `rollup`, `errorOf`, `countUsage` | `engine.js:452–494`, `:523–530` |
| `writer.ts` | `initialiseRunHistory`, `nextRunId`, and the `RunHistory` handle: `allocate`, `terminal`, `persist`, `finalise` | `engine.js:325–450`, `:625–632`, `:744–752` |
| `reader.ts` | `readRunsDir`, `sortRuns`, `manifestShapeError`, `occurrenceSeq`, `isIncomplete`, `vendorTokenTotal`, `resolveRunDirectory`, `TICKET_ID_PATTERN` | `bin/harness.js:130–200`, `:547–554` |

Three files rather than one, for a reason of the same kind as `fanout/command.ts`: it makes two rules
checkable that are otherwise only intentions — **`reader.ts` never writes** (AC-10) and **`writer.ts`
is the only file in `packages/core` that writes under `.quorum/`** (AC-2). `manifest.ts` exists so
that `reader.ts` does not import `writer.ts`, and therefore so that M3's server can read history
without linking the code that creates directories.

`packages/core/package.json` gains no dependency. No file writes to stdout or stderr or contains an
ANSI escape. `packages/core/src/index.ts` is unchanged byte for byte — it is pinned by
`packages/shared/src/index.test.ts` and by three source tests. Every exported symbol, interface field
and non-obvious parameter carries JSDoc; no `any`; no `@ts-ignore` without a same-line reason.

*Test:* a `run-history.source.test.ts` in the style of `git/git.source.test.ts`, reading through
`coreSourceFiles()`, asserting the exact file list, the exact export list per file, the absence of
`console.` and `\x1b[`, that `reader.ts` does not import `./writer.js`, and
`repoFile('packages/core/src/index.ts')` verbatim.

### AC-2 — Initialisation is exclusive, ordered, and refuses by name

`initialiseRunHistory(start, host)` performs, in this order:

1. If `<repo>/.quorum/runs` exists, read `<ticketDir>/ticket.md` through `parseFrontmatter` and, when
   its `stage` differs from the caller's, throw `FlowError` with exactly
   `run directory allocation refused: ticket stage conflicts with persisted run history (<persisted> != <given>)`.
2. `mkdirSync(runsRoot, {recursive: true})`.
3. `mkdirSync(runDir, {recursive: false})`. On `EEXIST`, throw `FlowError` with the full existing
   sentence, beginning `run directory allocation refused: <relative dir> already exists. Run ids are
   allocated from runs.log, …` — asserted as string equality, because the argument it makes about
   *why* a collision happens is the part a paraphrase loses. Any other errno throws
   `run directory allocation refused: could not create <relative dir> (<message>)`.
4. `mkdirSync(<runDir>/steps)`.
5. Build the manifest object (AC-3), call `ensureExcluded(repoDir, '.quorum/')`, then write the
   manifest with the **fatal** path, which throws
   `could not initialise run history at <path>: <message>`.

`FlowError`, not a subclass and not a bare `Error`: `bin/harness.js` routes on `instanceof FlowError`
to print one sentence instead of a stack, and `q0034-review-fixes.js` B3 asserts exactly that.
The relative paths in these messages are POSIX-separated regardless of platform.

**A refusal modifies nothing.** After an `EEXIST` refusal the existing run directory's `manifest.json`
is byte-identical, and no manifest exists after any of the other three.

*Test:* each refusal over a prepared fixture, asserting the message by equality and the `FlowError`
type; the byte comparison on the `EEXIST` path; a `.quorum/runs` that is a *file*, asserting the
"could not create" branch; the stage guard fired by a `ticket.md` that disagrees with the caller.

### AC-3 — The initial manifest is the frozen shape, holds only relative paths, and excludes itself

The object written first has exactly the 13 top-level keys in the schema's order, with
`status: 'running'`, `ended_at: null`, `duration_ms: null`, `stage.after: null`, `steps: []` and
`rollup: []`. `run_id` comes from `runIdOf(ticketId, run)` and the directory from `RUN_HISTORY_ROOT`;
`MANIFEST_FILE`, `PROMPT_FILE`, `OUTPUT_FILE`, `OCCURRENCE_DIR` and `occurrenceDirName` are imported
rather than re-spelled, so the literals `'manifest.json'`, `'prompt.txt'`, `'output.txt'`, `'steps/'`
and `padStart(3` appear nowhere in the module. `'.quorum'` appears **exactly once**, as
`ensureExcluded`'s pattern argument, which has no constant in `shared` and does not acquire one here.

**`ticket_path`, `flow_file` and an occurrence's `worktree` are relativised by the writer**, from the
absolute paths its caller hands it, rather than by each caller remembering. The writer contract's
*"Persist only project-relative paths. Never persist an environment object"* is then a property of one
function instead of a rule four call sites must not forget — the same reasoning `readOnlyBacklog`
records at `engine.js:26–28`. `worktree` is `null` when the working directory is the repository root.
Output is unchanged; only where the `path.relative` call lives changes, which charter §2 explicitly
does not preserve.

`.git/info/exclude` gains `.quorum/` — including in a **linked worktree**, where `.git` is a file and
the exclude file belongs to the primary repository. That case is the repository shape Quorum itself
runs in and is already covered by `ensureExcluded`; the test proves it end to end here because that is
where a caller could get it wrong.

*Test:* the key list and its order against the schema; `path.isAbsolute` false for every persisted
path; the exclude line present in both a plain repository and a linked worktree, with
`git status --porcelain` unchanged in the latter; a run whose environment carries a sentinel value,
asserting neither the name nor the value appears anywhere under the run directory.

### AC-4 — An occurrence has exactly fifteen keys, and its start time is not one of them

`allocate(step, kind, fields)` increments the sequence, builds
`occurrenceDirName(seq, step.id)`, creates that directory, and returns a **plain object** with
exactly `step_id`, `occurrence_dir`, `kind`, `role`, `adapter`, `model`, `branch`, `worktree`,
`started_at`, `duration_ms` (`null`), `attempts` (`0`), `status` (`'running'`), `verdict` (`null`),
`error` (`null`), `usage` (`null`). It is pushed onto `manifest.steps` and added to the active set.

**The monotonic start time lives in a module-level `WeakMap`, never on the occurrence.** Not a class
field, not a TypeScript `private` (which serialises), not a symbol-keyed property. The whole `steps`
array is re-serialised on every terminal occurrence, so a bookkeeping field on a *still-running*
occurrence reaches `manifest.json` and violates `additionalProperties: false`; it hid because the old
code deleted the field just before its own write, so only a sibling's write or a kill in that window
persisted it — the latter permanently.

Sequence continues past 999 without truncation (`steps/1000-…`), and `/` and `:` in a step id become
`-`, so `dev:T1` stays one path segment.

*Test:* the sorted key list equals the fifteen, so a sixteenth fails; a thousand script occurrences
asserting `steps/1000-` and a thousand distinct directories; ids containing `/` and `:`; the
mid-run snapshot of AC-6 asserting no key outside the fifteen ever appears on disk.

### AC-5 — Termination is idempotent, guarantees `output.txt`, and re-derives the roll-up

`terminal(occurrence, status, fields)`:

- returns silently when the occurrence is not in the active set — which is what makes the run catch
  and the signal handler safe to call over the same set the step path already finalised;
- assigns `fields` first and `{status, duration_ms}` second, so a caller cannot override either, and
  `duration_ms` is `Math.max(0, Date.now() - <WeakMap start>)`, or `0` when the start is missing;
- removes it from the active set;
- **writes an empty `output.txt` if none exists**, inside its own try/catch that warns and continues.
  This is the one funnel every outcome passes through, which is why the guarantee lives here rather
  than in each writer — every previous writer sat behind something that could throw first;
- recomputes `manifest.rollup` from `manifest.steps` in full and replaces the manifest.

The recomputation is whole-list and therefore quadratic in occurrence count. Preserved, and named in
the implement report as Q-0037's open nit rather than optimised in passing.

`fields` is typed `Partial<Occurrence>`, so the schema's closed key set is enforced by the compiler
rather than by review — the ticket body's *"unrepresentable in the types rather than merely
observed"*, applied where it costs nothing.

*Test:* a second `terminal` call on a finished occurrence changing nothing; `fields` carrying a
status being overridden; an occurrence whose `output.txt` path is a directory, asserting the warning
names the path and that the occurrence still reaches the manifest; the roll-up present after each
terminal call.

### AC-6 — The manifest is replaced atomically, and a persistence failure never discards billed work

`replaceManifest` is `openSync(tmp,'w')` → `writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n')`
→ `fsyncSync` → `closeSync` → `renameSync(tmp, target)`, with the descriptor closed best-effort if any
step throws. The temporary file is in the same directory, named `<manifest>.tmp`. Two-space
indentation and the trailing newline are asserted on the bytes.

Failure after initialisation warns `could not persist run history at <path>: <message>` and continues;
the in-memory snapshot stays authoritative for a later attempt. Only initialisation's write is fatal.

**The warning channel is an injected callback on the host object, not `console.warn`.** Q-0042 chose
`console.warn` for `ensureExcluded` with a `Why:` line saying the channel is Q-0050's to decide; that
was right for a one-line utility with no host, and is wrong here, where the module already takes a
host and where Q-0050's solution has a `warn` event to route it to. The CLI passes `console.warn`; the
test passes a collector, which is how EDGE-6's *"the warning must name the failed persistence path"*
becomes an assertion rather than a stub of a global.

*Test:* the byte shape of a written manifest; an unwritable run directory asserting three warnings
and a run whose in-memory manifest still holds every occurrence; a `.tmp` file left by a simulated
crash between write and rename, asserting the reader reports the manifest it finds and repairs
nothing (the nit Q-0037 holds — nothing names or cleans a stray `.tmp`, preserved).

### AC-7 — The roll-up is per vendor, never invents money, and includes what failed

`rollup(steps)` groups occurrences with non-null usage by the exact `usage.vendor` string, in first
appearance order, and for each vendor sets `step_count` (occurrences included), `unpriced_steps`
(those with `cost_usd == null`), and each of `USAGE_MEASURES` summed **over reported values only** —
so a measure no occurrence reported is `null`, and a genuinely reported `0` stays `0`. Occurrences
with `usage: null` — scripts, integrate steps, and an adapter call that reported nothing — create no
row at all.

Three properties, each its own assertion:

- **A `failed` occurrence carrying usage is in the roll-up.** Status is never consulted. One crashed
  review once hid $4.54 of a $10.25 run, and failure is when the number matters most.
- **A wholly token-only vendor's row has `cost_usd: null` and `unpriced_steps === step_count`**, and
  the module produces no cross-vendor total anywhere.
- **`rollup` is an accumulator and stays one.** `run-history/` does not import from
  `../contracts/run-manifest.js`, asserted at source level in both directions.

*Test:* a synthesised run with a priced vendor, a token-only vendor, a failed-but-billed occurrence
and a usage-null occurrence, asserting the rows field by field; a reported `0` distinguished from
`null`; the source-level independence check.

### AC-8 — Usage normalisation and error classification are preserved, and classification is delegated

`normaliseUsage(usage, fallbackVendor)` returns `null` for a falsy input and otherwise
`{vendor: usage.vendor ?? fallbackVendor}` plus the five measures each `?? null`. It invents no
measure and drops none.

`errorOf(error, adapterName)` returns `{category, message}` where `message` is
`String(error.message ?? error)` or `'adapter failed'` when empty, and `category` is `auth` when
either `AUTH_REWRITTEN` matches **or** `authError(adapterName, message)` is non-null, else `transient`
when `transientError(message)` is non-null, else `adapter`.

**Classification is imported from `../adapters/adapters.js` and is not re-implemented.** The comment
at `engine.js:483–488` records what happened the last time it was: three separate drifts, of which
`\b5\d\d\b` calling any message containing a three-digit number "transient" — a token count sufficed —
is the one to remember. `AUTH_REWRITTEN` survives because the contract layer has already rewritten a
vendor's auth noise into wording its own patterns no longer match.

*Test:* a null usage; a usage with no vendor taking the fallback; each of the three categories,
including one message that only `AUTH_REWRITTEN` recognises and one that only `authError` does; a
source-level assertion that no vendor error string is spelled in this module.

### AC-9 — A run that started is a run that ended: `nextRunId` and `finalise`

`nextRunId(ticket)` is `max(highest `run` in `ticket.meta.history`, highest `run=(\d+)` anywhere in
`<ticketDir>/runs.log`) + 1`, reading `RUNS_LOG_FILE`. Both sources, because history gains an entry
only on completion and regression — deriving from it alone hands a failed run's number to the next one
and the audit trail cannot tell them apart.

`finalise(status, stageAfter)` sets `status`, `ended_at`, `duration_ms` and `stage.after`, recomputes
the roll-up and replaces the manifest — for **every** terminal status, `completed`, `failed`,
`aborted`, `regressed` and `interrupted` alike. `exhausted` is legal in the schema and is never
written by this module: the engine records exhaustion as a ticket-history event and continues to a
gate, after which the run ends with its actual outcome.

**`duration_ms` is derived from the same `Date` that produced `started_at`.** Two separate clock reads
would differ by a millisecond and fail Q-0045's semantic pass, which requires
`duration_ms === Date.parse(ended_at) - Date.parse(started_at)` exactly. The `Math.max(0, …)` clamp is
preserved, and a backwards clock therefore surfaces as a semantic-pass failure rather than as a
negative number — which is the right outcome and is stated so nobody "fixes" it.

*Test:* `nextRunId` over four fixtures — no log and no history, history only, log only, and a log
whose highest id exceeds history's; `finalise` for each of the five statuses asserting the four
fields; the duration identity asserted by running Q-0045's `checkRunManifestSemantics` over the
result.

### AC-10 — The reader's exact answers, and it writes nothing

`readRunsDir(runsRoot)` returns `{runs, warnings}`: a missing root gives two empty arrays; only
directory entries are considered; each manifest is parsed inside its own try/catch, so one bad
sibling cannot take the listing down. `manifestShapeError` returns one of four strings, byte-exact,
or `null` — parsing is not validity, and full conformance stays `harness validate`'s job.
A read failure warns `missing manifest.json` when `code === 'ENOENT'` and
`malformed manifest.json (<message>)` otherwise.

`sortRuns` is `started_at` descending, then `run_id` ascending by plain string comparison — so with
equal timestamps `Q-0011-10` precedes `Q-0011-2`, which is deliberate and is what the CLI fixture
asserts. `isIncomplete` is `status === 'running' || ended_at == null`. `occurrenceSeq` parses
`^steps/(\d+)-` and returns `Number.MAX_SAFE_INTEGER` when it cannot, so an unparseable entry sorts
last rather than first.

**`reader.ts` contains no `writeFile`, `mkdir`, `rename`, `rm`, `unlink`, `appendFile` or `open`, in
any `Sync` or promise form.** *"It never repairs or infers persisted state"* is the reader contract's
first paragraph; this is what makes it a property of the file instead of a sentence in it.

*Test:* fixtures for each of the four shape errors, the two read failures, an empty root, a valid
sibling surviving a malformed one; the ordering over equal and unequal timestamps; `occurrenceSeq`
over `steps/001-a`, `steps/1000-a` and `notsteps`; a `walk()` snapshot of a fixture root before and
after every reader function has run, asserted identical; the source-level write-API assertion.

### AC-11 — The confinement guard resolves `realpath`, and the symlink case is tested for the first time

`resolveRunDirectory(runsRoot, token)` returns the resolved directory when **all** of these hold, and
`null` otherwise: `token === path.basename(token)`; `token` is not `''`, `'.'` or `'..'`;
`realPath(runsRoot)` is non-null; `realPath(path.resolve(path.resolve(runsRoot), token))` is non-null;
`path.dirname(realDir) === realRoot`; and `realDir` exists and is a directory. The caller reads the
manifest from the returned path.

**Lexical confinement is necessary and not sufficient**, and this is the criterion that says so with a
test rather than with a comment: `path.resolve` does no filesystem work and `statSync` follows links,
so a single-segment symlink inside `.quorum/runs/` satisfies every string clause. The existing test
(`q0034-review-fixes.js` B4) exercises five tokens that the string clauses alone already reject, so
today **a port that deletes `realPath` is green in both suites**.

*Test:* the five lexical tokens preserved, plus three that have never been tested — a single-segment
symlink inside the runs root pointing at a directory **outside** it, which must be refused; the same
symlink pointing at a **sibling run directory**, which is accepted and resolves to the sibling
(preserved behaviour, asserted so a later change is deliberate); and a runs root that is itself
reached through a symlink, which must still accept its own genuine children. `TICKET_ID_PATTERN`
(`^[A-Z]+-[0-9]{4}$`) is exported and pinned, including that it is anchored and case-sensitive —
`q-0011` and `Q-11` are not ticket ids.

### AC-12 — No money is formatted here, and cache tokens are never counted twice

No function in `run-history/` returns a formatted currency or token string. The module contains no
`toFixed`, no `'$'`, no `'n/a'` and no `'cost='`. That is the type-level form of *"roll-ups never
invent money"*: a `$0.000` cannot originate in this module because no code path in it produces a
money string at all.

`vendorTokenTotal(row)` sums `input_tokens` and `output_tokens` over reported values and returns
`null` only when **both** are null. `cached_input_tokens` and `cache_write_input_tokens` are a
breakdown on the row and are never summands — the adapter has already folded both into `input_tokens`
(`adapters/claude.ts:68–75`), and adding them back overstated the M0 figures by roughly 35% in the one
number Q-0011 exists to report. The Q-0011 fixture missed it because it left both fields null; this
one does not.

*Test:* the source-level absence of the four tokens; `vendorTokenTotal` over a row with populated
cache fields asserting `input + output` and explicitly **not** the cache-inclusive sum; a row with
both totals null returning `null`; a row with one null returning the other.

### AC-13 — The writer's own output passes the frozen schema and Q-0045's independent semantic pass

A synthesised run — two adapter occurrences on different vendors (one priced, one token-only), one
script occurrence, one integrate occurrence, one failed-but-billed adapter occurrence, a backward-edge
repeat of one step id, and a `finalise('completed')` — is validated with `validateArtifact` against
`contracts/Q-0011/run-manifest.schema.json` and then with `checkRunManifestSemantics`, both from
`packages/core/src/contracts/`. Both must report clean.

This is what Q-0045 was made a dependency for. The semantic pass recomputes the roll-up by
group-then-sum where the writer accumulates, so the two disagreeing is the signal; it also checks the
duration identity of AC-9, the occurrence-directory uniqueness of AC-4, and the
adapter-versus-script nullability that AC-4's field defaults produce. A green tick here means the
writer agrees with an implementation that was written from the contract and not from it.

*Test:* the run above; the same run finalised as `failed` and as `interrupted`; a mid-run snapshot
(`status: 'running'`, `ended_at: null`) also validated, which is the state the schema and the pass
must both accept.

### AC-14 — House rules hold, the freeze holds, the cache can see the new reads, and the defects are reported

- **The turbo input registers gain this module's reads.** `packages/core/src/turbo-inputs.test.ts`
  carries a path→reader map (`:165`) and a `file: literal` identity register (`COLLECTED_BASELINE`,
  `:1530`); both gain the run-history test files that read
  `contracts/Q-0011/run-manifest.schema.json` and any other repository path. `packages/core/turbo.json`
  needs no new entry — that schema is already declared — but a read of any path it does not declare
  is a configuration change and the guard is what fails. This is the AC-9 interaction Q-0070 met and
  Q-0073 tightened; it is a criterion, not a footnote.
- **The freeze holds.** `git diff --name-only main...HEAD` contains no `spike/` path. CI's
  `port freeze (branch scope)` job covers `harness/Q-0049/*` and is the enforcement; this assertion is
  the implementer's early warning.
- **The preserved defects and the boundaries are reported, not fixed.** `dev/implement-report.md`
  lists, under a *"noticed while reading, reported and not acted on"* heading: the three findings in
  "Context" above; Q-0037's whole list as it touches this module (the unreachable-from-the-CLI stage
  guard, the quadratic re-serialisation, the unclean `.tmp`, the per-step `usage:` line reusing a
  roll-up formatter, `vendorTokenTotal`'s null-with-populated-cache case); and the two functions this
  ticket deliberately leaves for their owners — `trimIncompleteUtf8Suffix` (Q-0051) and `formatCost`
  (Q-0052). **A reviewer may not treat any of them as a blocker** (charter §2); a reviewer *may* block
  if one has been fixed.
- Workspace-wide `pnpm lint`, `pnpm typecheck` and `pnpm test` are green, verified **forced**
  (`pnpm turbo run <task> --force`), because a cached pass can replay a verdict it never executed
  (Q-0065), and re-verified on the merge result rather than taken from `integrate`'s tick (Q-0072's
  closing finding: a change can be green in a worktree and red on `main`).

---

## Before the first run — four actions, all by hand

1. **Create `harness/Q-0049/integration` from `main`.** Verified absent today. `chore.yaml`'s
   `review` step diffs `harness/{id}/integration...harness/{id}/implement`, and only `integrate` —
   which runs later — creates the left endpoint. Forgetting it fails the run *after* the implementer
   has been paid; that is how Q-0035 lost $13.86. The highest-value line here.
2. **Expect the review loop to exhaust, and answer its gate.** `chore.yaml`'s `on_fail` bound is 2,
   and the two most recent comparable children (Q-0044, Q-0048) each reached the exhaustion gate
   **twice** in one chore run. `advance` continues the flow; only `abort` ends the run and rolls back.
   Pass no more `--gate-answer` values than you would authorise blind — they are consumed in order by
   whichever gate arrives first.
3. **One run per ticket at a time** (Q-0039 is open and nothing enforces it), and expect an
   unanswered final gate to fail the run and roll the ticket branch back (Q-0040) — answer it, or
   accept that proven-green work is discarded and the merge is re-performed by hand.
4. **Charter §5 clause 5 is satisfied:** `harness/Q-0041/integration` and `harness/Q-0045/integration`
   are both `main:contained`, verified with `git merge-base --is-ancestor`, as are Q-0042, Q-0043,
   Q-0044, Q-0046, Q-0047 and Q-0048.

---

## Non-goals

- **NG-1 — The engine.** `runFlow`, `finish()`, `outcome()`, `recordEvent()`, the signal handlers,
  the read-only backlog view and the event stream are Q-0050's. This module registers no signal
  handler and calls no `process.exit`; a source assertion says so, mirroring Q-0050's own criterion.
- **NG-2 — `trimIncompleteUtf8Suffix`** (Q-0051) and **`formatCost`** (Q-0052). Both look like run
  history and are not; see OQ-1.
- **NG-3 — Any change to `contracts/Q-0011/**`.** The schema and both `.md` contracts are frozen. A
  persisted-format change belongs to a ticket that opens those files legitimately.
- **NG-4 — Fixing anything in AC-14's reported list**, including any Q-0037 item, and including the
  blended `ticket.md` cost of finding 2.
- **NG-5 — Rendering.** No printer, no colour, no `--json` shape, no exit code. `bin/harness.js`
  keeps every one of those until Q-0010; charter §3 forbids touching it in any case.
- **NG-6 — A zod schema for the manifest, and any new `packages/shared` export.** The manifest already
  has an executable contract; a zod mirror is a second spelling that can drift, and *"Zod describes
  structure and types; the flow lint keeps the semantics"* (2026-08-25) forbids a schema adding a
  rule. Following Q-0045's OQ-7 — a constant with one consumer does not belong in the package
  everything imports — `TERMINAL_STATUSES` stays where it is and is not centralised.
- **NG-7 — Persisting the event stream**, the cutover, the `quorum` binary (Q-0010), another child's
  module, any edit under `spike/**` (charter §3), and everything on v1's exclusion list.
- **NG-8 — Documentation.** `docs/04-architecture.md:14`, `:16`, `:44` already name `run-history/`
  and `:73–80` describes the subsystem accurately. Verified: no document in the repository disagrees
  with this port, so none is edited.

---

## Open questions

**OQ-1 — Who records that `trimIncompleteUtf8Suffix` is Q-0051's and `formatCost` is Q-0052's?**
· Owner: **Ruud, at the requirements gate.** Q-0049's body names the first among the writer's
functions and neither successor's body names either. An obligation that lives only in this document
dies with the run that read it — the failure mode Q-0070's requirement wrote a whole successor body
to avoid. **Recommendation: one line in each of Q-0051's and Q-0052's `ticket.md` at this gate**, a
human commit, since `backlog/` is not a surface the chore flow can write. The fallback, if that is not
done, is that both are named in `dev/implement-report.md` under AC-14 — weaker, because a report is
read once.

**OQ-2 — Three files, or two?** · Owner: implementer unless the gate says otherwise.
**Recommendation: three** — `manifest.ts`, `writer.ts`, `reader.ts` — so that *"the reader writes
nothing"* and *"the reader does not import the writer"* are checkable rules rather than intentions,
and so M3's server can import the reader without linking directory-creating code. The alternative,
one `run-history.ts` mirroring `git.ts`, expresses the same rule as "`writeFileSync` appears only
below this line", which a second use inside the file would pass.

**OQ-3 — Is the warning channel an injected callback or `console.warn`?** · Owner: **Ruud, at the
requirements gate**, because it is a small divergence from a landed precedent. **Recommendation: an
injected callback**, required and without a default. Q-0042 chose `console.warn` for `ensureExcluded`
and left a `Why:` line saying the channel is Q-0050's to decide; that was right for a free function
with no host, and this module already takes one. Q-0050's solution has a `warn` event to route it to,
and the contract requires the warning to *name the path*, which a callback lets a test assert without
stubbing a global.

**OQ-4 — Does `vendorTokenTotal` come with the reader?** · Owner: **Ruud, at the requirements gate.**
Charter §6 names five reader functions plus the guard and does not name it. **Recommendation: yes,
lift it.** It is arithmetic over persisted data, not rendering, so charter §7 puts it in `core`; §6's
column is a list rather than a maximum; and it carries the 35% overstatement lesson, which the server
would otherwise re-derive and get wrong the same way. If the gate says no, AC-12's second half moves
to Q-0010 and the register keeps its five.

**OQ-5 — What happens to Q-0037 now?** · Owner: **Ruud, at the requirements gate.** Q-0037 is `draft`,
so the ticket body's "port the fixed version" is not available and this port takes the unfixed code —
which charter §2 requires anyway. Charter §3's table says Q-0037 must land in the spike before the
freeze SHA is recorded, or be re-targeted at `core`; the SHA is still `not-yet-recorded`
(`harness/port-charter.md:243`), so both remain open. **Recommendation: re-target Q-0037 at both
trees, the Q-0066/Q-0068 shape** — its subject now exists in two places and a fix in one leaves the
port's independent witness disagreeing. Not blocking: nothing here changes whichever way it goes.

**OQ-6 — May this ticket's tests spawn the real `git`?** · Owner: implementer.
**Recommendation: yes**, exactly as `git/git.test.ts` and `fanout/fanout.test.ts` already do through
`test/repo.ts`, and with the same rule: **no test may assert the containment, branch state or run
history of *this* repository**, which would be red until the next landing and green forever after.
Temporary worktrees and directories are removed in `afterAll` — Q-0062 records worktrees nothing
prunes, and a test suite must not make an open ticket worse.

---

## Risks

**A quiet fix leaves both suites green over a wrong product**, and this module offers more temptation
than most. Four things in AC-14's list read as tidy-ups: an unreachable guard, a quadratic
re-serialisation, an uncleaned `.tmp`, and a `WeakMap` that any TypeScript author's instinct says
should be a field. The fourth is the dangerous one, because making it a field is not merely a style
change — it puts a sixteenth key into a document the schema closes.

**The `realpath` clause can be deleted without a single test noticing.** Stated twice on purpose. It
is the only clause of the confinement guard with no coverage anywhere, it was found in a fix rather
than in the feature, and *"review the fix round, not only the feature round"* is the lesson Q-0011
recorded beside it.

**The engine's absence changes what "port the tests with the module" can mean.** `q0011-run-history.js`
is 273 lines and drives `runFlow` for every one of them, so it cannot move here; `q0011-runs-cli.js`
drives `bin/harness.js` and stays on the spike until Q-0010 by charter §5's own decision. The risk is
an implementer concluding that the tests are therefore Q-0054's and leaving `integrate` to examine
nothing this run produced — the exact shape charter §1 forbids. The mitigation is that every criterion
above is expressed against the module's own API, and AC-13 gives the writer an oracle that is a
second implementation rather than a transcription of itself.

**Cost.** Measured from `runs.log` terminal lines today, not estimated: the seven single-run chore
children are Q-0042 $16.87, Q-0043 $25.14, Q-0044 $37.54, Q-0045 $29.79, Q-0046 $29.34, Q-0047 $38.49
and Q-0048 $37.02 — **mean $30.60**, inside charter §9's $40 threshold — with Q-0041 at $66.87 over
three runs as the known outlier; eight-child mean $35.13. *(A naive count of terminal lines reports
four runs for Q-0044 and Q-0048 and is wrong: the extra lines are `exhausted` events with `cost=0`
from the review loop, logged in the same shape. Every child so far has taken exactly one requirements
run and one chore run, Q-0041 excepted. Charter §9's third threshold — more than three chore runs —
has not been approached.)* Fourteen criteria over ~195 ported lines plus ~70 lifted from the CLI puts
this at the upper end of that range; it is the largest single-module port left.

**Q-0050 is blocked on this ticket, and four more queue behind it.** A child that loops here delays
five. Charter §9's third rule is the one to watch: more than three chore runs means the child was cut
wrong, not that it needs a fourth.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | No code path, test, fixture or example in this change accepts an API key. The module never reads an environment variable, and AC-3 asserts that no environment name or value reaches an artifact — the writer contract's own clause, tested with a sentinel. |
| **Worktree safety** | The module writes only under `<repo>/.quorum/runs/<run-id>/` and appends one line to `.git/info/exclude`. AC-3 and AC-10 prove it by snapshot: `git status --porcelain` unchanged, including in a linked worktree, and the reader writes nothing at all. Register row 19's `.quorum/` clause. |
| **Gate behaviour** | n/a — the module presents no gate and reads none. Gates allocate no occurrence, which this module satisfies by never allocating unasked; the caller's half is Q-0052's. The chore flow's own final gate must be answered by a human or `finish()` rolls back a proven-green merge (Q-0040). |
| **File format and schema** | `contracts/Q-0011/run-manifest.schema.json` is frozen and untouched; AC-13 validates this module's output against it *and* against Q-0045's independent semantic pass. No new persisted format, no `shared` export, no zod schema (NG-6). |
| **Lint rules** | No flow-lint rule changes; `lintFlow` is Q-0044's and is not touched. ESLint (including the one type-aware rule, `@typescript-eslint/no-deprecated`) and `tsc --noEmit` strict pass workspace-wide, verified forced. |
| **Cold-clone impact** | Neutral to positive. No command changes and nothing is added to a first run's path; `ensureExcluded` is what keeps an adopter's first `git status` clean, and AC-11 is what keeps a mistyped token from reading a file outside the runs root. |
| **Product-agnostic** | No SaaS product is named. The BYOS refusal's *"Harness"* wording (Q-0068) lives in the adapters and does not appear in this module. |
| **Freeze** | Nothing under `spike/` is touched. `q0011-run-history.js` and `q0011-runs-cli.js` are transcribed where their properties apply to this module's API, never moved. CI's `port freeze (branch scope)` job covers `harness/Q-0049/*`. |
| **Cache honesty** | AC-14 keeps `turbo-inputs.test.ts`'s two registers accurate, so a hit on `@quorum/core#test` continues to mean *nothing this task reads has changed* (Q-0072), and the gate's own verification is forced (Q-0065, Q-0071) and re-run on the merge result (Q-0072's closing finding). |

---

## Provenance

**Read against the working tree on 2026-08-28:** `spike/src/engine.js` `:1–200`, `:200–330`,
`:325–500`, `:500–560`, `:593–670`, `:725–765`, `:785–905`; `spike/bin/harness.js` `:110–264` and
`:520–615`; `contracts/Q-0011/run-manifest.schema.json`, `run-history-writer.contract.md` and
`runs-cli.contract.md` in full; `spike/test/q0011-run-history.js` and `q0011-runs-cli.js` in full,
and `q0034-review-fixes.js:40–134`; `harness/port-charter.md` §§1–11 including register rows 3, 4, 15,
19 and 20; `harness/flows/chore.yaml`; `harness/roles/developer-generalist.md`;
`packages/shared/src/constants.ts` in full; `packages/core/src/contracts/run-manifest.ts` in full;
`packages/core/src/git/git.ts:228–254`; `packages/core/src/adapters/adapters.ts:27–170`,
`:317`, `:433`; `packages/core/src/adapters/claude.ts:54–75`; `packages/core/src/lint/lint.ts:29`;
`packages/core/src/backlog/backlog.ts:62–205`; `packages/core/test/corpus.ts` and `repo.ts`;
`packages/core/src/git/git.source.test.ts`; `packages/core/turbo.json`;
`packages/core/src/turbo-inputs.test.ts:150–180` and `:1528–1575`;
`backlog/Q-0050-core-engine-run-loop/requirements/merged.md` and `solution/solution.md`,
`solution/errata.md:150–180`; `backlog/Q-0037-run-history-review-remainder/ticket.md`;
`backlog/Q-0048-core-fanout/requirements/candidate-claude.md` for house structure;
`docs/04-architecture.md:60–82`.

**Measured rather than cited:** `trimIncompleteUtf8Suffix` has exactly one call site in the
repository, `engine.js:835`; `formatCost` has one non-test call site, `engine.js:302`; the eight port
children's billed cost, from `runs.log` terminal lines — $66.87 / $16.87 / $25.14 / $37.54 / $29.79 /
$29.34 / $38.49 / $37.02, one requirements run and one chore run each except Q-0041's two chore runs,
with Q-0044's and Q-0048's extra terminal lines confirmed to be `exhausted` events at `cost=0` rather
than additional runs; `harness/Q-0041…Q-0048/integration` are all contained in `main` and
`harness/Q-0049/integration` does not exist; `packages/core/src` holds six module folders and neither
`engine/` nor `run-history/`; no test in the repository enumerates that folder list, so adding one
breaks nothing; `contracts/Q-0011/run-manifest.schema.json` is already a declared turbo input of
`@quorum/core#test`.

**Decisions this document leans on, by title and date:** *The port takes the chore route, except the
one child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is
authorised and everything else stops the child* (2026-08-25) · *Codex cost is reported as tokens,
never priced locally* (2026-08-22) · *M0 closed: the adapters work, but nothing about them was where
the risk was* (2026-08-22) · *Q-0034 closed: an unlanded branch's cost is not its merge conflict*
(2026-08-24) · *Product-level schema annotations select semantic validation* (2026-08-23) ·
*Step-output validation is Quorum's contract with its own agents* (2026-08-22) · *Q-0035 accepted: a
check that skips its subject must not report success* (2026-08-25) · *A requirement may not name a
surface its flow cannot write* (2026-08-25) · *Zod describes structure and types; the flow lint keeps
the semantics* (2026-08-25) · *`core` is organised in folders named after the port's children*
(2026-08-26) · *A cache hit names what the task reads, not what its package contains* (2026-08-28) ·
*Membership is a git question, not a filesystem one* (2026-08-28) · *A command's output is captured
whole, or the run stops* (2026-08-28) · *A nit does not contradict an approval* (2026-08-28).
