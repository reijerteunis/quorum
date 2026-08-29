# Q-0049 — `core/run-history`: the manifest, occurrences, roll-ups and the reader

*Merged requirement, head-of-product, 2026-08-28. Route: **chore** (`requirements → chore → human
gate`). Parent Q-0009; charter `harness/port-charter.md`, §6 row `Q-0049`; invariant register rows
3, 4, 15. Depends on Q-0041 and Q-0045, both `main:contained`. Depended on by Q-0050, which is
solutioned and blocked on this ticket.*

**Thirteen criteria.** Sibling port children Q-0044–Q-0048 landed at twelve and thirteen, one chore
run each, $29–38 each; this is the largest single-module port left and it is held to the same
envelope deliberately. Two consolidations were made against the candidates: the ban on formatting
money is a clause of the roll-up criterion rather than a criterion of its own, and `vendorTokenTotal`
is a clause of the reader criterion rather than of a money criterion. Nothing was struck.

**No decision entry is a precondition.** Stated first because the last two requirements runs each
exhausted a loop on a blocker no step in their flow could satisfy. Nothing here needs a
`docs/decisions/` entry written before implementation, and **no criterion names `backlog/`,
`.claude/rules/`, `docs/`, `contracts/` or `spike/`** — the surfaces a `chore.yaml` implementer
cannot write, must not write, or is forbidden to write. Where this document and
`harness/port-charter.md` §6 differ, the charter is right.

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
rebuilds its index from disk. Charter §7 names *"run history, both writer and reader"* among what is
exported from `core` and not implemented in the CLI. A port that leaves the reader in
`bin/harness.js` hands Q-0010 a package the server has to shell out to, and that is the boundary
this ticket exists to establish.

Three things make this more than a translation.

**The format is frozen and the code that writes it is not.** `contracts/Q-0011/run-manifest.schema.json`
is `additionalProperties: false` at all four levels — 13 top-level keys, 15 per occurrence, 6 per
usage object, 8 per roll-up row — and this ticket may not change one byte of it. Q-0035's closing
entry declined to add the diffed SHAs to the manifest for exactly this reason, having just spent an
evening on archaeology that field would have saved. Every structural temptation a rewrite offers — a
class instance instead of a plain object, a private field for bookkeeping, a `Map` for the roll-up —
is a temptation to violate it, and `JSON.stringify` will not warn.

**Three defects this code has already had are each one plausible simplification away from returning**,
and — the standing hazard of charter §2 — losing any of them turns neither suite red. The spike keeps
the old behaviour; the ported suite would be written from the tree that has the new one. Both green,
the product wrong.

**Q-0050 is waiting, and four more queue behind it.** Its solution errata say so in as many words:
*"Still blocking the next stage: Q-0049 is `draft` and `packages/core/src/run-history/` does not
exist."* Charter §5 clause 3 orders Q-0049 before Q-0050–Q-0053. That is also what constrains the
design: **the engine does not exist yet, so this module must be drivable, and testable, without
one.** The spike's run history cannot be, because it reads and mutates `ctx`.

---

## User stories

**`maintainer` — the solo maintainer.** *"When a run fails, that is exactly when I want to know what
it cost. I want every attempt on disk — including the ones that crashed — with the prompt that was
sent and the text that came back, byte for byte, and I want the per-vendor numbers never blended into
one figure that is fiction the moment Codex is in the mix."*

**`contributor` — the adapter contributor.** *"I want one module I can read to know what a run writes
and where, with no vendor name in it. If the answer is spread between an engine and a CLI, I cannot
check whether my adapter's usage reaches the roll-up."*

**`adopter` — the cold-clone adopter.** *"Run history is written into my repository. I want it
excluded from `git status` without being asked, I want a token I type at a command line to be unable
to read a file outside it, and I never want a run that started to simply stop existing."*

**Surfaces:** `packages/core` — the library and its Vitest suite, plus the two register entries in
`packages/core/src/turbo-inputs.test.ts` that keep a new out-of-package read visible to the cache.
**Not** the CLI (`quorum` is Q-0010, and `bin/harness.js` is frozen by charter §3 in any case),
**not** the engine (Q-0050–Q-0053), **not** `contracts/`, **not** `backlog/`, `harness/` or `docs/`.
No document in the repository disagrees with this port; verified below, so none is edited.

---

## Context the implementer should not re-derive

Every line was checked against the tree on 2026-08-28. Read once.

### What is already there

`packages/shared/src/constants.ts` shipped the run-history vocabulary in Q-0041, each constant
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

`packages/core/src/contracts/run-manifest.ts:5–10` is a constraint, not a resource. Its module header
says the recomputation *"is a check only because it is a SECOND implementation … Nothing here may
import from `../run-history/`, now or later."* The obligation runs both ways: **this module must not
import that file's roll-up either.** Two independent implementations that disagree are the whole
signal; one implementation compared against itself detects a hand-edited file and nothing else.
(Importing `validateArtifact` and `checkRunManifestSemantics` *in the tests* is exactly what AC-12
asks for and is not this ban.)

`packages/core/test/` holds the fixtures this ticket's tests need and must not duplicate: `repo()`,
`tempDir`, `write`, `git`, `commit`, `walk`, `installGitShim`, `withEnv`, and `coreSourceFiles()` /
`repoFile()` for source-level rules. `coreSourceFiles()` has been recursive since Q-0064 and keys
every entry by its path below `src` — `run-history/writer.ts`, never a bare filename.

`contracts/Q-0011/run-manifest.schema.json` is **already** a declared turbo input of
`@quorum/core#test` (`packages/core/turbo.json`), so validating this module's output against it costs
no configuration change — only the two register entries named in AC-13.

`ensureExcluded` resolves the exclude file through `git rev-parse --git-path info/exclude`, so it
already works in a linked worktree, where `.git` is a file and the exclude file belongs to the
primary repository. That is the repository shape Quorum itself runs in.

### The three frozen contracts, and what they bind

`contracts/Q-0011/run-history-writer.contract.md`, `runs-cli.contract.md` and
`mock-adapter-run-history.contract.md` are the specification this port preserves; the schema is its
structural half. Four clauses are worth lifting out because they are the ones a rewrite silently
breaks:

- *"Replace `manifest.json` synchronously … `writeFileSync` a complete same-directory temporary file,
  `fsyncSync` and `closeSync` it, then `renameSync` it over the manifest"* — the sequence, not merely
  the outcome.
- *"Input totals already include vendor-reported cache components; readers do not add them again."*
- *"Never calculate a cross-vendor monetary total"*, and *"if none reported a measure, the result is
  null"* — a wholly token-only vendor has `cost_usd: null`, never `0`.
- From the mock contract: *"Switch names and environment representation are never copied into
  run-history artifacts"*, and *"The engine receives only the resulting values, never an environment
  object or switch name."* That is what AC-3's sentinel test proves.

### The module, function by function

| Symbol | Spike | What must survive |
| --- | --- | --- |
| `initialiseRunHistory` | `engine.js:325–376` | The order: persisted-stage guard → `mkdir` root recursive → `mkdir` run dir **non**-recursive → `steps/` → manifest object → `ensureExcluded` → fatal first write. Three refusal messages, byte-exact. |
| `occurrenceStart` (`WeakMap`) | `:385` | A side table, never a field. `terminalOccurrence` used to delete a stamped field just before its own write, so any *other* step's write persisted it and violated `additionalProperties: false`. |
| `allocateOccurrence` | `:387–403` | `++sequence`; `steps/NNN-<id>` with `/` and `:` → `-`; exactly 15 keys; pushed onto `manifest.steps`; added to the active set. |
| `terminalOccurrence` | `:405–427` | Returns silently if not active; `Object.assign(occurrence, fields, {status, duration_ms})` in that order; guarantees `output.txt`; recomputes the roll-up; replaces the manifest. |
| `persistArtifact` | `:429–433` | `writeFileSync(target, String(text))` — no normalisation of any kind; on failure warns naming the path and continues. |
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
| `sortRuns` | `:171–180` | `started_at` **descending**, then `run_id` **ascending** by plain string order — which is why `Q-0011-10` precedes `Q-0011-2`. Copies before sorting. |
| `isIncomplete` | `:182` | `status === 'running'` or `ended_at == null`. |
| `occurrenceSeq` | `:184–187` | `^steps/(\d+)-`; no match → `Number.MAX_SAFE_INTEGER`, so an unparseable entry sorts last. |
| `vendorTokenTotal` | `:197–200` | input + output over **reported** values; `null` when both are null; cache fields are **not** summands. |
| the confinement predicate | `:547–554` | Single segment, not `''`/`.`/`..`, both sides `realpath`'d, `dirname(realDir) === realRoot`, then `existsSync` + `isDirectory()`; the manifest is read from `realDir`. |

### Five claims re-measured before this document was written

A requirement is a durable record, and the last three ports each found an inherited claim that was
wrong. Each of these replaces a claim with the line that settles it; none changes what the ticket
asks for, so none needs an erratum.

**1. `trimIncompleteUtf8Suffix` is not run history.** The ticket body lists it among the writer's
functions and one candidate scoped it in. It has exactly one call site in the repository —
`engine.js:835`, inside `materialiseDiff`, trimming a truncated **diff** to a UTF-8 boundary — and
charter §6 gives `engine.js` diff preflight and materialisation to **Q-0051**. It is a non-goal here
(NG-2); OQ-1 asks for one line in Q-0051's body at this gate.

**2. "Whole failed runs are missing from `ticket.md`'s `history`" is not this ticket's surface, and
reads as already closed.** `engine.js:634` appends an outcome for **every** status, unconditionally,
and all three non-completion routes reach it: the initialisation catch (`:79`), the run catch
(`:167`) and the signal handler (`:60`). Q-0050's merged requirement verified the same lines
independently and recorded it as settled. The M1 figure the body quotes — $22.15 against $33.74 —
describes the tree before those routes existed. The owner is `finish()`, which is **Q-0050's**. What
no amount of code closes is `SIGKILL`, and the contract already names that: a `running` manifest is
reported, never repaired. **This is not an open question and a reviewer may not raise it as one.**

**3. The `realpath` half of the traversal guard has no test, in either suite.**
`spike/test/q0034-review-fixes.js:118–130` (B4) is the only test of the guard, and its five tokens —
`'../secret'`, `'.quorum/secret'`, an absolute path, `'..'` and `'.'` — are each rejected by the
*string* clauses alone (`token === path.basename(token)`, and the `''`/`.`/`..` exclusion). **A port
that drops `realPath` and compares `path.resolve` strings passes every test in both suites**, and
re-opens the hole Q-0011's round-2 panel found in round 1's own fix. This is Q-0071's lesson — *the
demonstration that a guard has a subject proves the guard fires, not that each of its clauses does* —
arriving on a security guard rather than on a cache fixture. AC-11 makes the symlink case a test for
the first time. **It is the highest-value line in this document.**

**4. The manifest's error `category` enum has eight values; `errorOf` produces three.** `auth`,
`transient`, `structured_output`, `adapter`, `script`, `integrate`, `interrupted` and `unknown` are
all legal. `errorOf` is the *adapter* classifier and returns only the first, second and fourth. The
other four are written by callers this ticket does not own, so the **type** must admit all eight
without a widening cast at the call site, while the **function** keeps producing exactly three.

**5. `usage.vendor` is required and `minLength: 1`.** `normaliseUsage(usage, fallbackVendor)` does
`usage.vendor ?? fallbackVendor`; if both are absent the key is `undefined`, `JSON.stringify` drops
it, and the manifest loses a required field. Preserved behaviour is that every caller supplies one.
The port makes that a type obligation rather than a convention: `fallbackVendor` is a required,
non-optional `string`.

### Three things found while reading, all preserved and reported

Each was established by reading the code. None is fixed here (charter §2); each goes in
`dev/implement-report.md` under AC-13.

1. **List mode and detail mode disagree about a symlinked run directory.** `readRunsDir` filters
   `d.isDirectory()` on a `Dirent` from `readdirSync(…, {withFileTypes: true})`, which uses `lstat`
   semantics — so a symlink pointing at a sibling run directory is skipped from the listing in
   silence, while detail mode accepts it (its real parent *is* the runs root) and renders the
   target's manifest under the alias. Neither is wrong; they are two answers to one question.
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

- **Q-0050** owns `runFlow`, `finish()`, `outcome()`, `recordEvent()`, the signal handlers, the event
  stream and `reviewRound` (`:753–759`, which sits immediately below `nextRunId` and is `ctx.vars`
  bookkeeping — named because adjacency is how a port takes a function nobody assigned it). Its
  merged requirement already names the four places it calls this module (`:59`, `:69`, `:164`,
  `:625–632`) and says it *"owns the lifecycle contract"* while implementing none of it. Its solution
  says the persistence capability *"adapts Q-0049's landed API"*, so **this ticket is free to design
  that API** and is not pre-empted by anything Q-0050 has written.
- **Q-0051** owns the diff preflight and materialisation, including `trimIncompleteUtf8Suffix`.
- **Q-0052** owns `runAgentStep`, `runScript`, `runGate`, and therefore `formatCost` (`:533–537`),
  which is step narration: it has one non-test call site, `engine.js:302`, rendering a step's
  completion line.
- **Q-0053** owns fan-out and integrate, and with them the rule that a fan-out parent allocates no
  occurrence. This module allocates only when asked; it has no path that allocates on its own.
- **Q-0010** owns `formatMoney`, `formatTokens`, `formatVendorSummary`, `statusLabel`,
  `runHeaderLine` and the four printers, which stay in `bin/harness.js` until then.

**The line that decides all of these: this module computes, and does not narrate.** `rollup`,
`normaliseUsage`, `countUsage`, `vendorTokenTotal`, `occurrenceSeq`, `isIncomplete` and
`manifestShapeError` are arithmetic and classification over persisted data, and come here. Everything
that produces a string for a human to read is rendering and stays where charter §7 puts rendering.
That rule is checkable (AC-1, AC-7) where "use your judgement about the boundary" is not.

### Register rows 3, 4 and 15 — which clause is whose

- **Row 3** — *"Claude cost is money, Codex is tokens with cost `null`; no rate table ships; `null`
  renders `n/a`, never `$0.000`; a roll-up states how many steps were unpriced."* This ticket owns
  the **representation**: `cost_usd` stays `number | null` end to end, `unpriced_steps` is counted,
  and no rate table and no money formatting exists in the module at all (AC-7). **The rendering
  clause is satisfied today by `bin/harness.js:204` and moves at Q-0010. A reviewer may not block on
  its absence from `core`** — charter §7 puts rendering in the CLI's residual scope, and putting it
  here would be the scope creep, not the omission.
- **Row 4** — shared with Q-0047. Its Q-0047 clauses (failures on stdout; the vendor's own
  `input_tokens` excluding cache traffic) are landed. **This ticket's clause is "a failed step's cost
  is in the roll-up"** (AC-7). Note the direction of row 4's cache sentence: it describes the
  vendor's raw JSON, and `packages/core/src/adapters/claude.ts:68–75` folds both cache fields **into**
  `input_tokens` before it reaches a manifest. So a manifest's `input_tokens` already contains them,
  which is precisely why `vendorTokenTotal` must not add them again — the defect that overstated the
  M0 figures by roughly 35% and passed Q-0011's own suite because its fixture left both fields null.
- **Row 15** — wholly this ticket's, and it is five clauses: atomic replacement (AC-6); gates and
  fan-out parents allocate no occurrence (AC-4 — this module's half is that it never allocates
  unasked); adapter occurrences retain exact `prompt.txt` and `output.txt` (AC-6); a `running`
  manifest is reported, not repaired (AC-9, AC-10); and the reader's traversal guard resolves
  `realpath` rather than testing strings (AC-11).

---

## Acceptance criteria

Every criterion is testable with Vitest over throwaway repositories built by
`packages/core/test/repo.ts`. No adapter, no vendor CLI, no network, no cost.

### AC-1 — The module lands as three files, adds no dependency, and narrates nothing

`packages/core/src/run-history/` gains exactly:

| File | Holds | Ported from |
| --- | --- | --- |
| `manifest.ts` | the types — `RunManifest`, `Occurrence`, `OccurrenceUsage`, `VendorRollup`, `RunStatus`, `OccurrenceKind`, `ErrorCategory`, `RunError` — and the pure functions `normaliseUsage`, `rollup`, `errorOf`, `countUsage` | `engine.js:452–494`, `:523–530` |
| `writer.ts` | `initialiseRunHistory`, `nextRunId`, and the `RunHistory` handle: `allocate`, `terminal`, `persist`, `finalise` | `engine.js:325–450`, `:625–632`, `:744–752` |
| `reader.ts` | `readRunsDir`, `sortRuns`, `manifestShapeError`, `occurrenceSeq`, `isIncomplete`, `vendorTokenTotal`, `resolveRunDirectory`, `TICKET_ID_PATTERN` | `bin/harness.js:130–200`, `:547–554` |

Three files rather than one, for a reason of the same kind as `fanout/command.ts`: it makes three
rules checkable that are otherwise only intentions — **`reader.ts` never writes** (AC-10),
**`writer.ts` is the only file in `packages/core` that writes under `.quorum/`**, and **`reader.ts`
does not import `./writer.js`**, so M3's server can read history without linking the code that
creates directories. `manifest.ts` exists to make the third possible.

No file in the folder contains `console.`, an ANSI escape, `process.exit`, a signal handler, or a
literal vendor name (`claude`, `codex`, `anthropic`, `openai`, `gemini`) in any case — vendor
identity reaches this module only as data, through `usage.vendor` and `errorOf`'s `adapterName`
parameter. `packages/core/package.json` gains no dependency. `packages/core/src/index.ts` is unchanged
byte for byte — it is pinned by `packages/shared/src/index.test.ts` and by three source tests. Every
exported symbol, interface field and non-obvious parameter carries JSDoc; no `any`; no `@ts-ignore`
without a same-line reason; no deprecated API (`@typescript-eslint/no-deprecated` is on).

*Test:* a `run-history.source.test.ts` in the style of `git/git.source.test.ts`, reading through
`coreSourceFiles()`, asserting the exact file list, the exact export list per file, the absence of
each forbidden token, that `reader.ts` does not import `./writer.js`, and
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
   *why* a collision happens is the part a paraphrase loses, and because `q0034-review-fixes.js` B3
   asserts the errno does not leak. Any other errno throws
   `run directory allocation refused: could not create <relative dir> (<message>)`.
4. `mkdirSync(<runDir>/steps)`.
5. Build the manifest object (AC-3), call `ensureExcluded(repoDir, '.quorum/')`, then write the
   manifest with the **fatal** path, which throws
   `could not initialise run history at <path>: <message>`.

`FlowError`, not a subclass and not a bare `Error`: `bin/harness.js` routes on `instanceof FlowError`
to print one sentence instead of a stack. The relative paths in these messages are POSIX-separated
regardless of platform.

**A refusal modifies nothing.** After an `EEXIST` refusal the existing run directory's `manifest.json`
is byte-identical, and no manifest exists after any of the other three. The refusal is thrown before
any `start` line is written — the third defect in the ticket body was a refusal that threw *after*
one, re-opening the "run that started and then stopped existing" gap; this module's contribution to
closing it is that it writes nothing before it refuses, and the caller's half is Q-0050's.

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
runs in and is already handled by `ensureExcluded`'s `--git-path` resolution; the test proves it end
to end here because that is where a caller could get it wrong.

*Test:* the key list and its order against the schema; `path.isAbsolute` false for every persisted
path; the exclude line present in both a plain repository and a linked worktree, with
`git status --porcelain` unchanged in the latter; a run whose environment carries a sentinel value
(`MOCK_`-prefixed, per the mock contract's *"switch names and environment representation are never
copied into run-history artifacts"*), asserting neither the name nor the value appears anywhere under
the run directory.

### AC-4 — An occurrence has exactly fifteen keys, and its start time is not one of them

`allocate(step, kind, fields)` increments the sequence, builds `occurrenceDirName(seq, step.id)`,
creates that directory, and returns a **plain object** with exactly `step_id`, `occurrence_dir`,
`kind`, `role`, `adapter`, `model`, `branch`, `worktree`, `started_at`, `duration_ms` (`null`),
`attempts` (`0`), `status` (`'running'`), `verdict` (`null`), `error` (`null`), `usage` (`null`). It
is pushed onto `manifest.steps` and added to the active set. `kind` is `'adapter' | 'script' |
'integrate'` and nothing else; **the module allocates only when asked**, which is this module's half
of row 15's "gates and fan-out parents allocate no occurrence".

**The monotonic start time lives in a module-level `WeakMap`, never on the occurrence.** Not a class
field, not a TypeScript `private` (which serialises), not a symbol-keyed property. The whole `steps`
array is re-serialised on every terminal occurrence, so a bookkeeping field on a *still-running*
occurrence reaches `manifest.json` and violates `additionalProperties: false`; it hid because the old
code deleted the field just before its own write, so only a sibling's write or a kill in that window
persisted it — the latter permanently.

Sequence continues past 999 without truncation (`steps/1000-…`), and `/` and `:` in a step id become
`-`, so `dev:T1` stays one path segment.

*Test:* the sorted key list equals the fifteen, so a sixteenth fails; a thousand script occurrences
asserting `steps/1000-` and a thousand distinct directories; ids containing `/` and `:`; a mid-run
snapshot of `manifest.json` while two occurrences are still open, asserting no key outside the fifteen
appears on disk.

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
names the path and that the occurrence still reaches the manifest; the roll-up present and correct
after each terminal call.

### AC-6 — The manifest is replaced atomically, artifacts are written byte-exact, and a persistence failure never discards billed work

`replaceManifest` is `openSync(tmp,'w')` → `writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n')`
→ `fsyncSync` → `closeSync` → `renameSync(tmp, target)`, with the descriptor closed best-effort if any
step throws. The temporary file is in the same directory, named `<manifest>.tmp`. Two-space
indentation and the trailing newline are asserted on the bytes. No successful path writes the manifest
in place.

`persist(occurrence, name, text)` writes **exactly the bytes it is given** — `String(text)`, and then
nothing: no newline normalisation, no trimming, no truncation, no JSON re-serialisation, no encoding
change. That is register row 15's *"adapter occurrences retain exact `prompt.txt` and `output.txt`"*,
and it is stated as a criterion because it is the clause a helpful rewrite breaks without noticing.
*Which* text is persisted — the final output, or the raw invalid structured output when validation
fails — is the caller's decision and is Q-0052's; this module's obligation is that whatever it is
arrives unmodified.

Failure after initialisation warns `could not persist run history at <path>: <message>` and continues;
the in-memory snapshot stays authoritative for a later attempt, and **a persistence failure never
replaces or clears the occurrence's recorded `error` or `usage`** — a vendor that has billed for a
step must not lose that step because a disk write failed. Only initialisation's write is fatal.

**The warning channel is an injected `warn` callback on the host object, not `console.warn`.** This is
the faithful port and not a divergence: the spike already injects it, as `ctx.ui.warn`. The CLI passes
its own printer, so what a command prints is unchanged; a test passes a collector, which is how *"the
warning must name the failed persistence path"* becomes an assertion rather than a stub of a global.
`ensureExcluded` keeps its own `console.warn` — that channel is Q-0042's `Why:` line and Q-0050's to
decide, and changing it is not this ticket's.

*Test:* the byte shape of a written manifest; a `persist` round-trip over text with CRLF, a trailing
newline, no trailing newline, a lone `\r`, multi-byte UTF-8 and 1 MiB of content, asserting byte
equality in every case; an unwritable run directory asserting the warnings and a run whose in-memory
manifest still holds every occurrence with its usage and error intact; a `.tmp` file left by a
simulated crash between write and rename, asserting the reader reports the manifest it finds and
repairs nothing (the nit Q-0037 holds — nothing names or cleans a stray `.tmp`, preserved).

### AC-7 — The roll-up is per vendor, includes what failed, and never invents money

`rollup(steps)` groups occurrences with non-null usage by the exact `usage.vendor` string, in first
appearance order, and for each vendor sets `step_count` (occurrences included), `unpriced_steps`
(those with `cost_usd == null`), and each of `USAGE_MEASURES` summed **over reported values only** —
so a measure no occurrence reported is `null`, and a genuinely reported `0` stays `0`. Occurrences
with `usage: null` — scripts, integrate steps, and an adapter call that reported nothing — create no
row at all.

Four properties, each its own assertion:

- **A `failed` occurrence carrying usage is in the roll-up.** Status is never consulted. One crashed
  review once hid $4.54 of a $10.25 run, and failure is when the number matters most. The mock
  contract's `MOCK_FAIL_WRITE` is the billed-failure fixture this mirrors.
- **A wholly token-only vendor's row has `cost_usd: null` and `unpriced_steps === step_count`**, and
  the module produces no cross-vendor total anywhere.
- **No money string can originate in this module.** `run-history/` contains no `toFixed`, no `'$'`,
  no `'n/a'`, no `'cost='` and no rate table. That is the structural form of *"roll-ups never invent
  money"*: a `$0.000` cannot come from here because no code path produces a money string at all. Row
  3's rendering clause is the CLI's until Q-0010 and its absence here is correct.
- **`rollup` is an accumulator and stays one.** `run-history/` does not import from
  `../contracts/run-manifest.js`, asserted at source level in both directions — the two
  implementations disagreeing is the whole signal AC-12 depends on.

*Test:* a synthesised run with a priced vendor, a token-only vendor, a failed-but-billed occurrence
and a usage-null occurrence, asserting the rows field by field; a reported `0` distinguished from
`null`; the source-level absence of the four money tokens; the source-level independence check.

### AC-8 — Usage normalisation and error classification are preserved, delegated, and fully representable

`normaliseUsage(usage, fallbackVendor)` returns `null` for a falsy input and otherwise
`{vendor: usage.vendor ?? fallbackVendor}` plus the five measures each `?? null`. It invents no
measure and drops none. **`fallbackVendor` is a required, non-optional `string`** — the schema makes
`vendor` required with `minLength: 1`, and an absent fallback would silently drop a required key
through `JSON.stringify`.

`errorOf(error, adapterName)` returns `{category, message}` where `message` is
`String(error.message ?? error)` or `'adapter failed'` when empty, and `category` is `auth` when
either `AUTH_REWRITTEN` matches **or** `authError(adapterName, message)` is non-null, else `transient`
when `transientError(message)` is non-null, else `adapter`. **Classification is imported from
`../adapters/adapters.js` and is not re-implemented.** The comment at `engine.js:483–488` records what
happened the last time it was: three separate drifts, of which `\b5\d\d\b` calling any message
containing a three-digit number "transient" — a token count sufficed — is the one to remember.
`AUTH_REWRITTEN` survives because the contract layer has already rewritten a vendor's auth noise into
wording its own patterns no longer match.

**`ErrorCategory` admits all eight values the frozen schema allows** — `auth`, `transient`,
`structured_output`, `adapter`, `script`, `integrate`, `interrupted`, `unknown` — so Q-0052 and
Q-0053 can record a script, integrate, structured-output or interrupted error without a widening cast
and without extending the schema. `errorOf` itself produces exactly three; the other five are
constructed by callers this ticket does not own.

*Test:* a null usage; a usage with no vendor taking the fallback; each of the three `errorOf`
categories, including one message that only `AUTH_REWRITTEN` recognises and one that only `authError`
does; an empty message becoming `'adapter failed'`; a type-level assertion that an occurrence carrying
each of the eight categories compiles and validates; the source-level assertion from AC-1 that no
vendor name is spelled in this module.

### AC-9 — A run that started is a run that ended: `nextRunId` and `finalise`

`nextRunId(ticket)` is the greater of the highest `run` in `ticket.meta.history` and the highest
`run=(\d+)` anywhere in `<ticketDir>/runs.log`, plus one, reading `RUNS_LOG_FILE`. Both sources,
because history gains an entry only on completion and regression — deriving from it alone hands a
failed run's number to the next one and the audit trail cannot tell them apart. Missing file and empty
history give run 1.

`finalise(status, stageAfter)` sets `status`, `ended_at`, `duration_ms` and `stage.after`, recomputes
the roll-up and replaces the manifest. **`RunStatus` admits every terminal status the schema allows —
`completed`, `failed`, `aborted`, `regressed`, `exhausted`, `interrupted` — and `finalise` writes
whichever it is given.** Preserved behaviour is that the engine never passes `exhausted` here: it
records exhaustion as a ticket-history event and continues to a gate, after which the run ends with
its actual outcome. That is a note about the caller, not a restriction on this API; wiring every
run-loop exit to it is Q-0050's.

**`duration_ms` is derived from the same `Date` that produced `started_at`.** Two separate clock reads
would differ by a millisecond and fail Q-0045's semantic pass, which requires
`duration_ms === Date.parse(ended_at) - Date.parse(started_at)` exactly. The `Math.max(0, …)` clamp is
preserved, and a backwards clock therefore surfaces as a semantic-pass failure rather than as a
negative number — which is the right outcome and is stated so nobody "fixes" it.

*Test:* `nextRunId` over four fixtures — no log and no history, history only, log only, and a log
whose highest id exceeds history's; `finalise` for each of the six statuses asserting the four fields;
the duration identity asserted by running `checkRunManifestSemantics` over the result.

### AC-10 — The reader's exact answers, its token arithmetic, and it writes nothing

`readRunsDir(runsRoot)` returns `{runs, warnings}`: a missing root gives two empty arrays and no
warning; only directory entries are considered; each manifest is parsed inside its own try/catch, so
one bad sibling cannot take the listing down. `manifestShapeError` returns one of four strings,
byte-exact, or `null` — parsing is not validity, and full conformance stays `harness validate`'s job.
A read failure warns `missing manifest.json` when `code === 'ENOENT'` and
`malformed manifest.json (<message>)` otherwise, naming the run directory.

`sortRuns` is `started_at` descending, then `run_id` ascending by plain string comparison — so with
equal timestamps `Q-0011-10` precedes `Q-0011-2`, which is deliberate and is what the CLI fixture
asserts — and it **returns a new array without mutating its input or the parsed manifests**.
`isIncomplete` is true when `status` is `'running'` or `ended_at` is null, and an incomplete run is
reported as it stands: never repaired, deleted or terminalised. `occurrenceSeq` parses `^steps/(\d+)-`
and returns `Number.MAX_SAFE_INTEGER` when it cannot, so an unparseable entry sorts last rather than
first.

`vendorTokenTotal(row)` sums `input_tokens` and `output_tokens` over reported values and returns
`null` only when **both** are null. `cached_input_tokens` and `cache_write_input_tokens` are a
breakdown on the row and are **never summands** — the adapter has already folded both into
`input_tokens` (`adapters/claude.ts:68–75`), and adding them back overstated the M0 figures by roughly
35% in the one number Q-0011 exists to report. The Q-0011 fixture missed it because it left both
fields null; this one does not.

**`reader.ts` contains no `writeFile`, `mkdir`, `rename`, `rm`, `unlink`, `appendFile`, `copyFile`,
`truncate` or `open`, in any `Sync` or promise form.** *"It never repairs or infers persisted state"*
is the reader contract's first paragraph; this is what makes it a property of the file instead of a
sentence in it, and it is what lets M3's server import the reader without importing the ability to
write.

*Test:* fixtures for each of the four shape errors, the two read failures, an empty root, a missing
root, a valid sibling surviving a malformed one; the ordering over equal and unequal timestamps plus
an input-not-mutated assertion; `occurrenceSeq` over `steps/001-a`, `steps/1000-a` and `notsteps`;
`vendorTokenTotal` over a row with populated cache fields asserting `input + output` and explicitly
**not** the cache-inclusive sum, a row with both totals null returning `null`, and a row with one null
returning the other; a `walk()` snapshot of a fixture root before and after every reader function has
run, asserted identical; the source-level write-API assertion.

### AC-11 — The confinement guard resolves `realpath`, and the symlink case is tested for the first time

`resolveRunDirectory(runsRoot, token)` returns the resolved directory when **all** of these hold, and
`null` otherwise: `token === path.basename(token)`; `token` is not `''`, `'.'` or `'..'`;
`realPath(runsRoot)` is non-null; `realPath(path.resolve(path.resolve(runsRoot), token))` is non-null;
`path.dirname(realDir) === realRoot`; and `realDir` exists and is a directory. The caller reads the
manifest from the returned path, never from the lexical one.

**Lexical confinement is necessary and not sufficient**, and this is the criterion that says so with a
test rather than with a comment: `path.resolve` does no filesystem work and `statSync` follows links,
so a single-segment symlink inside `.quorum/runs/` satisfies every string clause. The existing test
(`q0034-review-fixes.js` B4) exercises five tokens that the string clauses alone already reject, so
today **a port that deletes `realPath` is green in both suites**.

*Test:* the five lexical tokens preserved, plus three that have never been tested anywhere — a
single-segment symlink inside the runs root pointing at a directory **outside** it, which must be
refused and must disclose nothing from the target manifest; the same symlink pointing at a **sibling
run directory**, which is accepted and resolves to the sibling (preserved behaviour, asserted so a
later change is deliberate); and a runs root that is itself reached through a symlink, which must
still accept its own genuine children. `TICKET_ID_PATTERN` (`^[A-Z]+-[0-9]{4}$`) is exported and
pinned, including that it is anchored and case-sensitive — `q-0011` and `Q-11` are not ticket ids.

### AC-12 — The writer's own output passes the frozen schema and Q-0045's independent semantic pass

A synthesised run — two adapter occurrences on different vendors (one priced, one token-only), one
script occurrence, one integrate occurrence, one failed-but-billed adapter occurrence, a backward-edge
repeat of one step id, and a `finalise('completed')` — is validated with `validateArtifact` against
`contracts/Q-0011/run-manifest.schema.json` and then with `checkRunManifestSemantics`, both from
`packages/core/src/contracts/`. Both must report clean.

This is what Q-0045 was made a dependency for. The semantic pass recomputes the roll-up by
group-then-sum where the writer accumulates, so the two disagreeing is the signal; it also checks the
duration identity of AC-9, the occurrence-directory uniqueness of AC-4, and the adapter-versus-script
nullability that AC-4's field defaults produce. A green tick here means the writer agrees with an
implementation that was written from the contract and not from it — which is why AC-7 forbids the two
importing each other.

*Test:* the run above; the same run finalised as `failed` and as `interrupted`; a mid-run snapshot
(`status: 'running'`, `ended_at: null`) also validated, which is the state the schema and the pass
must both accept and is the state a `SIGKILL` leaves behind.

### AC-13 — House rules hold, the freeze holds, the cache can see the new reads, and the defects are reported

- **The turbo input registers gain this module's reads.** `packages/core/src/turbo-inputs.test.ts`
  carries a path→reader map (`:165`) and a `file: literal` identity register (`COLLECTED_BASELINE`,
  `:1530`); both gain the run-history test files that read
  `contracts/Q-0011/run-manifest.schema.json` and any other repository path. `packages/core/turbo.json`
  needs no new entry — that schema is already declared — but a read of any path it does not declare
  is a configuration change and the guard is what fails. Since Q-0073 the guard resolves paths through
  `git ls-files`, so a new read must be a tracked or untracked-unignored file, and an aliased
  filesystem call is a shape its scan cannot follow. This is a criterion, not a footnote.
- **The freeze holds.** `git diff --name-only main...HEAD` contains no `spike/`, `contracts/`,
  `docs/`, `backlog/` or `.claude/` path. CI's `port freeze (branch scope)` job covers
  `harness/Q-0049/*` and is the enforcement; this assertion is the implementer's early warning.
- **The preserved defects and the boundaries are reported, not fixed**, in `dev/implement-report.md`
  under a *"noticed while reading, reported and not acted on"* heading: the three findings in
  "Context" above; Q-0037's list as it touches this module (the unreachable-from-the-CLI stage guard,
  the quadratic re-serialisation, the unclean `.tmp`, the per-step `usage:` line reusing a roll-up
  formatter, `vendorTokenTotal`'s null-with-populated-cache case); and the three functions this ticket
  deliberately leaves for their owners — `trimIncompleteUtf8Suffix` (Q-0051), `formatCost` (Q-0052)
  and `reviewRound` (Q-0050). **A reviewer may not treat any of them as a blocker** (charter §2); a
  reviewer *may* block if one has been fixed.
- Workspace-wide `pnpm lint`, `pnpm typecheck` and `pnpm test` are green, verified **forced**
  (`pnpm turbo run <task> --force`), because a cached pass can replay a verdict it never executed
  (Q-0065, Q-0071), and re-verified on the merge result rather than taken from `integrate`'s tick
  (Q-0072's closing finding: a change can be green in a worktree and red on `main`). The spike suite
  (`npm test --prefix spike`) is run unchanged and green, as the port's independent witness.

---

## Rulings made at this gate

Five questions the candidates left open are settled here, so no loop spends money on them.

1. **Q-0037 (`stage: draft`).** The ticket body's *"land it on the spike first or port the fixed
   version — but not both"* offers a choice that does not exist: neither has happened. **This port
   takes the unfixed code**, which is what charter §2 requires anyway, and preserves every Q-0037 item
   as a reported defect under AC-13. Q-0037's own re-targeting — at both trees, the Q-0066/Q-0068
   shape, since its subject will then exist in two places — is Q-0037's business and is recorded in
   OQ-2. **Not blocking.**
2. **Failed runs and `ticket.md` history.** Already closed at `engine.js:634`, which appends
   unconditionally for every status. The surface is `finish()`, which is Q-0050's. **This ticket does
   not touch `ticket.md` and this is not an open question.**
3. **The warn channel is an injected `warn` callback on the host.** Not a divergence from a landed
   precedent: the spike already injects it as `ctx.ui.warn`, so a callback is the *faithful* port and
   `console.warn` would be the change. What a command prints is unchanged because the CLI passes its
   own printer.
4. **`vendorTokenTotal` is lifted.** It is arithmetic over persisted data, not rendering, so charter
   §7 puts it in `core`; §6's column is a list of the functions that must move, not a maximum; and it
   carries the 35% overstatement lesson, which M3's server would otherwise re-derive and get wrong the
   same way.
5. **No money formatting enters `core`.** `formatCost` is step narration (`engine.js:302`) and is
   Q-0052's; `formatMoney`, `formatTokens` and `formatVendorSummary` are CLI rendering and are
   Q-0010's. Register row 3's *rendering* clause is satisfied today by `bin/harness.js` and its
   absence from this module is correct, not an omission.

---

## Before the first run — four actions, all by hand

1. **Create `harness/Q-0049/integration` from `main`.** Verified absent today. `chore.yaml`'s `review`
   step diffs `harness/{id}/integration...harness/{id}/implement`, and only `integrate` — which runs
   later — creates the left endpoint. Forgetting it fails the run *after* the implementer has been
   paid; that is how Q-0035 lost $13.86. The highest-value line here.
2. **Expect the review loop to exhaust, and answer its gate.** `chore.yaml`'s `on_fail` bound is 2,
   and the two most recent comparable children (Q-0044, Q-0048) each reached the exhaustion gate
   **twice** in one chore run. `advance` continues the flow to the next step; only `abort` ends the run
   and rolls back. Pass no more `--gate-answer` values than you would authorise blind — they are
   consumed in order by whichever gate arrives first.
3. **One run per ticket at a time** (Q-0039 is open and nothing enforces it), and expect an unanswered
   final gate to fail the run and roll the ticket branch back (Q-0040) — answer it, or accept that
   proven-green work is discarded and the merge is re-performed by hand.
4. **Charter §5 clause 5 is satisfied:** `harness/Q-0041/integration` and `harness/Q-0045/integration`
   are both `main:contained`, as are Q-0042, Q-0043, Q-0044, Q-0046, Q-0047 and Q-0048.

---

## Non-goals

- **NG-1 — The engine.** `runFlow`, `finish()`, `outcome()`, `recordEvent()`, `reviewRound`, the
  signal handlers, the read-only backlog view and the event stream are Q-0050's. This module registers
  no signal handler and calls no `process.exit`; AC-1 asserts it. Wiring every terminal run-loop exit
  to `finalise` is Q-0050's integration, not this ticket's.
- **NG-2 — `trimIncompleteUtf8Suffix`** (Q-0051) and **`formatCost`** (Q-0052). Both look like run
  history and are not; see OQ-1.
- **NG-3 — Any change to `contracts/Q-0011/`.** The schema and all three `.md` contracts are frozen.
  No new field, status, error category, diffed SHA or event data. A persisted-format change belongs to
  a ticket that opens those files legitimately.
- **NG-4 — Fixing anything in AC-13's reported list**, including any Q-0037 item, and including the
  blended `ticket.md` cost of finding 2.
- **NG-5 — Rendering.** No printer, no colour, no money or token formatting, no `--json` shape, no
  exit code, no argument handling. `bin/harness.js` keeps every one of those until Q-0010; charter §3
  forbids touching it in any case.
- **NG-6 — A zod schema for the manifest, and any new `packages/shared` export.** The manifest already
  has an executable contract; a zod mirror is a second spelling that can drift, and *"Zod describes
  structure and types; the flow lint keeps the semantics"* (2026-08-25) forbids a schema adding a rule.
  Following Q-0045's OQ-7 — a constant with one consumer does not belong in the package everything
  imports — `TERMINAL_STATUSES` stays where it is and is not centralised.
- **NG-7 — Persisting the event stream**, the cutover, the `quorum` binary (Q-0010), another child's
  module, any edit under `spike/`  (charter §3), and everything on v1's exclusion list (multi-user,
  remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter,
  desktop shell).
- **NG-8 — A rate table, or any inferred price.** No price is ever computed for usage whose
  `cost_usd` is null.
- **NG-9 — Repairing persisted state.** No incomplete manifest is completed, deleted or
  terminalised; no stray `.tmp` is cleaned; no missing field is defaulted.
- **NG-10 — Documentation.** `docs/04-architecture.md:14`, `:16`, `:44` already name `run-history/`
  and `:73–80` describes the subsystem accurately. Verified: no document in the repository disagrees
  with this port, so none is edited.

---

## Open questions

**None blocks solutioning.** Both candidates' blockers were resolved above against the tree.

**OQ-1 — Who records that `trimIncompleteUtf8Suffix` is Q-0051's and `formatCost` is Q-0052's?**
· Owner: **Ruud, at the requirements gate.** · Not blocking Q-0049; blocking nothing until Q-0051
starts. Q-0049's body names the first among the writer's functions and neither successor's body names
either, so an obligation that lives only in this document dies with the run that read it — the failure
mode Q-0070's requirement wrote a whole successor body to avoid. **Recommendation: one human commit
adding one line to each ticket**, since `backlog/` is not a surface the chore flow can write:
*Q-0051's body* — "Also owns `trimIncompleteUtf8Suffix` (`engine.js:895`), whose only call site is
`materialiseDiff` (`:835`); Q-0049's body lists it among run history's functions and Q-0049's merged
requirement declines it as NG-2." *Q-0052's body* — "Also owns `formatCost` (`engine.js:533`), whose
only non-test call site is the step completion line at `:302`; declined by Q-0049 as NG-2 because it
is narration, not arithmetic." The fallback, if that is not done, is AC-13's implement report — weaker,
because a report is read once.

**OQ-2 — What happens to Q-0037 now?** · Owner: **Ruud**, any time before the freeze SHA is recorded.
· Not blocking: this port takes the unfixed code either way. Charter §3's table says Q-0037 must land
in the spike before the freeze SHA is recorded or be re-targeted at `core`; the SHA is still
`not-yet-recorded` (`harness/port-charter.md:243`), so both remain open. **Recommendation: re-target
Q-0037 at both trees, the Q-0066/Q-0068 shape** — after this ticket its subject exists in two places
and a fix in one leaves the port's independent witness disagreeing.

**OQ-3 — Three files, or two?** · Owner: implementer. · Not blocking. **Recommendation: three**, per
AC-1, so that *"the reader writes nothing"* and *"the reader does not import the writer"* are checkable
rules rather than intentions. The alternative, one `run-history.ts` mirroring `git.ts`, expresses the
same rule as "`writeFileSync` appears only below this line", which a second use inside the file would
pass.

**OQ-4 — May this ticket's tests spawn the real `git`?** · Owner: implementer. · Not blocking.
**Recommendation: yes**, exactly as `git/git.test.ts` and `fanout/fanout.test.ts` already do through
`test/repo.ts`, and with the same rule: **no test may assert the containment, branch state or run
history of *this* repository**, which would be red until the next landing and green forever after.
Temporary worktrees and directories are removed in `afterAll` — Q-0062 records worktrees nothing
prunes, and a test suite must not make an open ticket worse. Symlink fixtures for AC-11 are created
under `os.tmpdir()` and removed with them.

---

## Risks

**A quiet fix leaves both suites green over a wrong product**, and this module offers more temptation
than most. Four things in AC-13's list read as tidy-ups: an unreachable guard, a quadratic
re-serialisation, an uncleaned `.tmp`, and a `WeakMap` that any TypeScript author's instinct says
should be a field. The fourth is the dangerous one, because making it a field is not merely a style
change — it puts a sixteenth key into a document the schema closes, and only on a *still-running*
occurrence, which is the case no completed-run fixture examines.

**The `realpath` clause can be deleted without a single test noticing.** Stated twice on purpose. It
is the only clause of the confinement guard with no coverage anywhere, it was found in a fix rather
than in the feature, and *"review the fix round, not only the feature round"* is the lesson Q-0011
recorded beside it.

**Null cost read as zero understates a failed run's spend and presents unknown money as free.** The
distinction has to survive normalisation, aggregation and the type signature; an accumulator that
initialises to `0` instead of `null` breaks it silently and passes every fixture whose vendor reports
a price.

**A failed occurrence is dropped if aggregation filters on status rather than on the presence of
usage.** That is the exact shape of the M0 defect — a filter that looks obviously right.

**The engine's absence changes what "port the tests with the module" can mean.**
`q0011-run-history.js` is 273 lines and drives `runFlow` for every one of them, so it cannot move
here; `q0011-runs-cli.js` is 116 lines driving `bin/harness.js` and stays on the spike until Q-0010 by
charter §5's own decision. The risk is an implementer concluding that the tests are therefore
Q-0054's and leaving `integrate` to examine nothing this run produced — the exact shape charter §1
forbids. The mitigation is that every criterion above is expressed against the module's own API, and
AC-12 gives the writer an oracle that is a second implementation rather than a transcription of
itself.

**Cost.** Measured from `runs.log` terminal lines, not estimated: the seven single-run chore children
are Q-0042 $16.87, Q-0043 $25.14, Q-0044 $37.54, Q-0045 $29.79, Q-0046 $29.34, Q-0047 $38.49 and
Q-0048 $37.02 — **mean $30.60**, inside charter §9's $40 threshold — with Q-0041 at $66.87 over three
runs as the known outlier. *(A naive count of terminal lines reports four runs for Q-0044 and Q-0048
and is wrong: the extra lines are `exhausted` events with `cost=0` from the review loop, logged in the
same shape.)* Thirteen criteria over ~195 ported lines plus ~70 lifted from the CLI puts this at the
upper end of that range; it is the largest single-module port left.

**Q-0050 is blocked on this ticket, and four more queue behind it.** A child that loops here delays
five. Charter §9's third rule is the one to watch: more than three chore runs means the child was cut
wrong, not that it needs a fourth.

---

## Size judgement

**One ticket, thirteen criteria — not two.** The obvious seam is writer versus reader, and it was
considered and rejected. They share one persisted format and one set of types; splitting them creates
a second ticket that unblocks nothing new (Q-0050 needs the writer, M3 needs the reader, and neither
arrives sooner), costs another requirements run and another chore run for roughly five criteria, and
risks the two halves disagreeing about the very type definitions the frozen schema closes. Charter §7
names *"run history, both writer and reader"* as one export boundary.

The count was brought from the candidates' fourteen and twenty-two to thirteen by consolidation
rather than by striking: the ban on formatting money joined the roll-up criterion it is a property of,
and `vendorTokenTotal` joined the reader criterion it belongs to. Sibling port children Q-0044–Q-0048
carry twelve and thirteen criteria and each reached `reviewed` in one chore run; this ticket is held
to the same envelope on purpose.

---

## Provenance

**Structure and the majority of the content come from `candidate-claude.md`**, which is the stronger
document: the function-by-function table, the boundary map across Q-0050–Q-0053, the three-file
layout and the rules it makes checkable, the byte-exact refusal messages, the `WeakMap`-not-a-field
hazard, the turbo-register criterion, the pre-run checklist, and the measured cost figures. Four of
its five re-measurements of the ticket body were verified independently here and hold. Its finding
that **the `realpath` clause of the confinement guard has no test in either suite** was re-verified
against `q0034-review-fixes.js:118–130` — all five of B4's tokens are rejected by the lexical clauses
alone — and is AC-11, the highest-value criterion in this document.

**`candidate-codex.md` contributed four things claude's criteria did not carry**, each verified before
inclusion:

- **Artifact byte-exactness** — *"no newline normalization, truncation, JSON reserialization, or other
  text rewriting"* (its AC-7). This is register row 15's third clause, and neither candidate's
  criteria asserted it; claude mentioned it only in prose. It is now half of AC-6, with a round-trip
  test over six text shapes.
- **The full error-category enum.** The frozen schema admits eight categories and `errorOf` produces
  three; without codex's AC-13 the ported type would have been the three, and Q-0052 and Q-0053 would
  have had to widen it. Verified in the schema and now in AC-8.
- **The non-empty `usage.vendor` requirement** (its AC-10), which makes `fallbackVendor` a required
  non-optional parameter rather than a convention — verified against the schema's `minLength: 1`.
- **Two smaller clauses**: a persistence failure must not replace the recorded execution error
  (AC-6), and sorting must not mutate the parsed manifest (AC-10). Plus the framing that coupling the
  reader to CLI rendering would force M3's daemon to depend on CLI code, which is now the stated reason
  for the three-file split.

**Two of codex's positions were rejected**, both on evidence. Its AC-1 and AC-7 scope in
`trimIncompleteUtf8Suffix`, whose only call site is `materialiseDiff` (`engine.js:835`) — charter §6
gives that to Q-0051. Its AC-12 requires `core` to format money to three decimals and render `n/a`;
charter §7 puts rendering in the CLI's residual scope, `formatCost` is step narration owned by Q-0052,
and `formatMoney`/`formatVendorSummary` are Q-0010's. Register row 3's rendering clause is satisfied
today by `bin/harness.js:204` and its absence from `core` is correct. Codex's twenty-two criteria were
also over-decomposed for one chore run; the substance survives, redistributed.

**Both candidates raised the same two blockers, and both are resolved here rather than deferred.**
Codex's OQ-1 (which Q-0037 version is the source) and OQ-2 (is the failed-run `ticket.md` gap in
scope) are answered by two facts neither candidate could change: Q-0037 is `stage: draft`, so the
"port the fixed version" option does not exist and §2 requires the unfixed code; and `engine.js:634`
appends ticket history unconditionally for every status, so the gap the ticket body describes was
closed in a tree later than the M1 figure it quotes. Codex's OQ-4 and claude's OQ-3 (the warn channel)
are answered by the spike itself — `ctx.ui.warn` is already an injected host callback, so injection is
the faithful port and not a divergence. Claude's OQ-4 (`vendorTokenTotal`) is ruled at this gate in
favour of lifting it.

**Added by the head of product at this gate:** the third frozen contract
(`mock-adapter-run-history.contract.md`), which neither candidate cited and which supplies AC-3's
sentinel rule and AC-7's billed-failure fixture; the `ErrorCategory` and `RunStatus` completeness
requirements; the required `fallbackVendor` typing; the explicit statement that register row 3's
rendering clause is not this module's, so a reviewer cannot block on it; the two consolidations that
brought the count to thirteen; and the five rulings above.

**Read against the working tree on 2026-08-28:** `spike/src/engine.js` `:320–500`, `:615–665`,
`:740–765`; `spike/bin/harness.js` `:110–270` and `:540–575`; `contracts/Q-0011/run-manifest.schema.json`
in full including all six `$defs`; `run-history-writer.contract.md`, `runs-cli.contract.md` and
`mock-adapter-run-history.contract.md`; `spike/test/q0034-review-fixes.js:108–134`;
`harness/port-charter.md` §§2, 3, 6, 7, 8, 9, 10 and the twenty-two-row invariant register;
`packages/shared/src/constants.ts:44–155`; `packages/core/src/contracts/run-manifest.ts:1–20`;
`packages/core/src/git/git.ts:228–254`; `packages/core/src/adapters/adapters.ts:317`, `:433`;
`packages/core/src/backlog/backlog.ts:62`; `packages/core/turbo.json`;
`backlog/Q-0037-run-history-review-remainder/ticket.md`; the merged requirements of Q-0044–Q-0048 for
criterion-count calibration; `packages/core/src` folder listing; `git branch` for
`harness/Q-004*/integration`.

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
*Membership is a git question, not a filesystem one* (2026-08-28) · *A nit does not contradict an
approval* (2026-08-28).

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | No code path, test, fixture or example accepts an API key. The module reads no environment variable, and AC-3 asserts that no environment name or value reaches an artifact — the writer and mock contracts' own clause, tested with a sentinel. |
| **Worktree safety** | The module writes only under `<repo>/.quorum/runs/<run-id>/` and appends one line to `.git/info/exclude`. AC-3 and AC-10 prove it by snapshot: `git status --porcelain` unchanged, including in a linked worktree, and the reader writes nothing at all. Register row 19's `.quorum/` clause. |
| **Gate behaviour** | n/a — the module presents no gate and reads none. Gates allocate no occurrence, which this module satisfies by never allocating unasked; the caller's half is Q-0052's. The chore flow's own final gate must be answered by a human or `finish()` rolls back a proven-green merge (Q-0040). |
| **File format and schema** | `contracts/Q-0011/` is frozen and untouched; AC-12 validates this module's output against the schema *and* against Q-0045's independent semantic pass. No new persisted format, no `shared` export, no zod schema (NG-6). |
| **Lint rules** | No flow-lint rule changes; `lintFlow` is Q-0044's and is not touched. ESLint (including the one type-aware rule, `@typescript-eslint/no-deprecated`) and `tsc --noEmit` strict pass workspace-wide, verified forced. |
| **Cold-clone impact** | Neutral to positive. No command changes and nothing is added to a first run's path; `ensureExcluded` is what keeps an adopter's first `git status` clean, and AC-11 is what keeps a mistyped token from reading a file outside the runs root. |
| **Product-agnostic** | No SaaS product is named, and AC-1 asserts no vendor name appears in the module at all. The BYOS refusal's *"Harness"* wording (Q-0068) lives in the adapters and does not appear here. |
| **Freeze** | Nothing under `spike/`, `contracts/`, `docs/`, `backlog/` or `.claude/` is touched. `q0011-run-history.js` and `q0011-runs-cli.js` are transcribed where their properties apply to this module's API, never moved. CI's `port freeze (branch scope)` job covers `harness/Q-0049/*`. |
| **Cache honesty** | AC-13 keeps `turbo-inputs.test.ts`'s two registers accurate, so a hit on `@quorum/core#test` continues to mean *nothing this task reads has changed* (Q-0072), and the gate's own verification is forced (Q-0065, Q-0071) and re-run on the merge result (Q-0072's closing finding). |
