# Q-0107 — implement report, run 2 iteration 1

*Every criterion of `requirements/merged.md` is implemented. Verified forced: workspace **7/7 tasks,
0 cached, 2 039 tests**; spike **19/19**; `lint` + `typecheck` **14/14, 0 cached**; `harness lint`
**6/6**; `pnpm sweep:git-identity` green. 37 files changed, 2 added, 1 moved.*

---

## 0. What this round found that the requirement did not

**AC-11 paid for itself, and it paid on the criterion R-1 names.** AC-12 retires five line scans on
the ground that each folder's positive import allow-list is *"strictly stronger"*. I implemented
that, widened `importsOf` to also parse `require('…')` — the one shape §3.3's residual names — and
then demonstrated it red against the live tree by adding a real spike import to
`packages/core/src/lint/lint.ts`.

**The suite stayed green.** `importsOf` matched `from '…'` and `require('…')`; a bare
`import '../../../../spike/src/lint.js';` carries no `from`, so the allow-list never saw it. The
retired scan *did* — it read every `import`/`export`/`require(` **line** for the word. All five
folders had the same hole. A `retired` verdict whose named sibling does not assert the same
property is exactly the failure R-1 describes, and reading the two would never have shown it: the
allow-list looks stronger and was weaker on one shape.

Fixed in all five: `importsOf` now parses three shapes, each demonstrated to fire and to be refused.
The first demonstration attempt is also recorded because it failed AC-11's *evidence bar* rather
than the assertion — a `require(` of a path that does not resolve killed the module at import, so
the suite failed as a suite and established nothing. The demonstration that counts uses a specifier
that resolves.

**A second, smaller one.** `spike/test/smoke.js:476`'s role-table clause — *"the prose names its
allowed path"* — tested the whole file, so the `paths:` frontmatter line it had just parsed
satisfied it. Found by demonstrating AC-18's first direction red and getting one problem where two
were expected. The counterpart reads `parseFrontmatter(text).body`.

---

## 1. AC by AC

### AC-8 — the allocation fixture moves

`spike/test/q0080-allocation.json` → **`packages/core/src/backlog/q0080-allocation.json`**, beside
`backlog.test.ts`. Its `"about"` names one tree; `spike/test/q0080-allocation.js:24` reaches across
the boundary until Q-0103 (the direction that survives), and `packages/cli/src/ticket.ts:8`'s
citation moved with it.

*Test:* `backlog.test.ts` records what its two table-driven loops **actually visited** and compares
that against `BEFORE_THE_MOVE = { rows: 11, accepts: 3, rejects: 8, assertions: 33 }`, measured at
`d24fb8b` before the move. Two clauses, because a count is not an identity: the labels must be the
ones the table names, **and** there must be thirty-three of them. Demonstrated red by deleting one
row — `expected { rows: 10, … } to strictly equal { rows: 11, … }`.

`spike-parity.test.ts` moved with it (079(c)): the `NOT_A_SUITE` row is gone with the reason
recorded, `FILES` is 20 not 21, and the line totals were **re-derived rather than adjusted** —
`both` 2 739 → 2 741, total 5 428 → 5 430, share 55% either side. A new `(t) Q-0107` clause states
the delta and is the first of those seven that is *not* "unmoved".

### AC-9 — the three corpus helpers are gone

`spikeSource`, `spikeLintFlow`, `frontmatterRegexMatchesSpike` and `lintAccepts` are removed; all 39
call sites across seven files are dispositioned. `corpus.ts` keeps every other reader and its header
is rewritten around what replaced the witness role rather than trimmed. `frontmatterRegexMatchesProduct`
is the one addition, reading `packages/core/src/backlog/backlog.ts` as text.

### AC-10 / AC-29 — the registers

`packages/cli/src/spike-dependencies.test.ts`. It lives in `packages/cli` because that package is
the top of the dependency graph and already scans every workspace package.

- **`DISPOSITIONS`** — 35 rows, one sentence each, five permitted verdicts. Each row names
  **evidence**: a file that must exist and a marker it must contain. That is what stops a `retired`
  verdict being a claim nobody checked. Counts pinned: **retired 14, re-aimed 17, kept 2,
  transcribed 0, moved 2** — and the zero is asserted separately, because 079 permits transcription
  only where the value is this workspace's own contract and every literal here was evidence *about*
  the deleted tree.
- **`EXCLUSIONS`** — keyed by `file: shape literal`, derived from the scan, eight entries, each
  naming what removes it. Both directions asserted: an unregistered site fails, and a registered
  site that has gone fails.

### AC-11 — red before green

Demonstrated against the live tree, mutation reverted (OQ-2), assertion named in every case:

| what | mutation | observed |
| --- | --- | --- |
| stages sibling | `stages.ts` `'qa-passed'`→`'qa-done'` | *the ten members are the ones the state machine documents* |
| constants siblings | `REPO_WORKTREE_ROOT` → `.harness/wt` | `expected '.harness/wt' to be '.harness/worktrees'` |
| verdict-path twin | `steps.ts` drops `{iter}` | *scoped to one traversal: expected … to contain '{iter}'* |
| events re-aim | `claude.ts` `cmd:`→`command:` | *those three shapes are still what the product emits* |
| frontmatter re-aim | `backlog.ts` regex `\r?\n` | *backlog.ts:69 no longer matches the copy in test/corpus.ts* |
| docs re-aim | `run-manifest.ts` drops `'undecided'` | *§3.3 and TERMINAL_STATUSES name the same seven words* |
| five line scans | real `import '…/spike/src/lint.js'` in `lint.ts` | *lint/lint.ts imports ../../../../spike/src/lint.js* |
| AC-30 guard | the same leak | *unregistered read … specifier + path, both shapes* |
| AC-13 | citation `:548`→`:540` | *the four-validator note must cite …adapters.ts:548* |
| AC-14 | one byte in the template `chore.yaml` | *chore.yaml: the two trees differ by 1 bytes or more* |
| AC-15 corpus | drop the `packages` row | *corpus is 1 files; the floor is 45* |
| AC-16 | add a phase to the sweep | *the script names exactly the registered phases, in order* |
| AC-17 | remove the retained input | *hashes every file its walk of 'spike/test' collects* — 20 files |
| AC-8 | delete a table row | *expected { rows: 10 … } to strictly equal { rows: 11 … }* |

AC-18's two directions and AC-30's three shapes are demonstrated **in committed tests** over
fixtures, so they run on every future suite rather than only here.

### AC-12 — the eight silent guards

| site | verdict |
| --- | --- |
| five `*.source.test.ts` line scans | `retired` — allow-list sibling, `importsOf` widened to three shapes |
| `backlog.source.test.ts:60` | `retired` — sibling is AC-30's guard, wider corpus and wider shape set |
| `contracts.source.test.ts:185` | `retired` — post-cutover it could only fail on the checkout's own directory name, which *"a test's verdict is a property of the commit"* forbids. The ajv-8 half stays. |
| `q0050.source.test.ts:109` | `retired` — `tsc --noEmit` refuses such an import first; sibling AC-30 |

### AC-13 — the FOUR-VALIDATIONS block

All **four** citations moved together (`:12, :14, :16, :19`), and the assertion now pins four rather
than three, requires each path to **exist**, requires each cited line to still be the declaration it
names, and requires the block to contain no path under that tree — scoped to the block, since the
file's other eight citations are the deferred sweep's. The needle is assembled so this file carries
none of its own.

### AC-14 — the parity chain becomes one link

`lint.test.ts`'s `SHIPPED` and `templates.test.ts`'s comparison both aim at
`packages/cli/templates/harness/flows`. The comparison is of the **byte-shared set** (the flows and
`code-reviewer.md`) rather than of two trees, because only that part has a counterpart here;
`filesUnder` answers `['']` for a file so one register holds both shapes, demonstrated red on
copies. `package.test.ts`'s register row and declared input moved with it, and
`harness/architecture.md:78` in the same change.

### AC-15 — the four `git-identity.test.ts` sites

Corpus row dropped; `spike/test must be in the corpus` replaced by an assertion naming every
top-level directory the corpus **does** reach, derived from the listing; the `:249` fixture aimed at
a real file; `CORPUS_FLOOR`'s derivation re-stated — the number did not move and its composition
did, which is the comment-promising-what-the-number-no-longer-means class.

### AC-16 — `test-command.test.ts` and the sweep

`spikeSources()` and its two consumers retired; the sweep loses its `npm ci` and `spike suite`
phases and its header and final line say so. The phase list is now **derived on both sides** — the
script's `phase="…"` lines compared against a four-entry register, so an added, removed or renamed
phase all fail, where the hand-written literal failed in one direction only. `CI_JOBS`' `spike` row
and `WITHOUT_SPIKE` **stay** (`kept`). I removed a floor clause I had first written beside it: it
could not fail unless the register above it failed first, which is the Q-0050 shape.

### AC-17 — six of seven inputs

`shared` ×3, `core` ×2, `cli` ×1 removed with their comments; `packages/core/turbo.json`'s
`../../spike/test/**` **kept**, its comment naming `spike-parity.test.ts` as its sole reader and
Q-0103 as what removes both. `package.test.ts:187`'s copy moved. Every `turbo-inputs.test.ts`
register moved in the same change — R-4 fired thirteen times in both directions and each was a real
row: `MANIFEST`, `WALKS`, `NOT_READ`, `ROUTE_MODULES`, `INDIRECT_ROUTES`, `READ_BASES`,
`COLLECTED_BASELINE` (66 → 71 occurrences over 40 → 43 literals, arithmetic re-derived) and the
self-audit's directory list.

### AC-18 — the role table gains a `packages/**` checker

`packages/shared/src/role.test.ts` compares the third column against every role's `paths:`
frontmatter, the vendor against `adapter:`, and each granted directory against the role **body**.
Written as a function over its two inputs so both directions are demonstrated on fixtures, plus
separate demonstrations for the missing-row, empty-table and one-vendor clauses.
`harness/architecture.md:51` and `role.ts:30` re-pointed; `role.test.ts:57–61` is OQ-5's one
*no-sibling-exists* case and was **written** into `q0052.source.test.ts` over all of
`packages/core/src`.

### AC-19 — production source

`git diff --name-only HEAD -- 'packages/*/src/**'` lists **28 paths: 25 `*.test.ts` and exactly the
three files AC-19 admits** — `packages/cli/src/ticket.ts`, `packages/shared/src/role.ts`,
`packages/shared/src/step-output.ts` — plus `packages/shared/test/corpus.ts`. No behavioural
production change was made.

### AC-30 — the standing guard

Three shapes over the **tracked** `packages/` inventory (`git ls-files`, so the verdict is a
property of the commit). Shape 2 is a *whole-path* literal, optionally relative — a sentence
containing a path is not a read, which is what keeps the exclusion list finite and is §3.2(h)'s
narrowing made executable. JSDoc is outside the subject by name, with the sweep ticket cited.

**The guard needs no self-exclusion**, which is better than the alternative: `TREE` is assembled and
the register keys are not whole-path literals, so the file is scanned like any other and reports
nothing — asserted, together with a demonstration that appending one real read to its own text does
report it.

---

## 2. Reported and not fixed

1. **`composite.ts:94` and `:248` spell `context.config.repo?.base_branch ?? 'main'`** where
   `diff.ts` and `engine.ts` reach `DEFAULT_BASE_BRANCH`. The port converted some sites and not
   others. AC-19 admits three production files and this is not one; R-5 says a production change
   beyond those is a gate finding. **Pinned in both directions** in `q0050.source.test.ts`: a third
   bare literal fails, and closing the two that exist fails too, so a repair is a deliberate act.
2. **`packages/core/src/backlog/backlog.ts:276` carries an unused `eslint-disable-next-line
   no-control-regex`** — one warning, `pnpm lint` still exits 0. Pre-existing (Q-0080's `8f31fb5`),
   file untouched here.
3. **`turbo-inputs.test.ts`'s self-audit collects a backticked path inside a comment as a path
   literal.** Discovered while writing comments there — a prose mention of `` `spike/src` `` in a
   `//` line was reported as an unaccounted literal. Worked around by naming those paths in prose;
   noted because the next person will hit it.

## 3. Departures from the requirement's own text

1. **`docs/04-architecture.md:148` said the sweep *"runs both suites"*.** AC-16 made that false, and
   §1's surface list does not name the numbered docs. I fixed the one sentence and bumped the status
   line, because `docs-and-decisions.md` requires a doc contradicting code to be fixed in the same
   change, and a document overstating an enforcer's reach is this ticket's own subject class.
   Flagged as a departure rather than folded in silently.
2. **AC-19's *Test* and AC-8's recommendation do not quite agree.** AC-8 recommends
   `packages/core/src/backlog/q0080-allocation.json`; AC-19's diff clause admits only `*.test.ts`
   paths, the three named files and `corpus.ts`. The new file is data, not source, and AC-8 is
   explicit, so I followed AC-8. Nothing turns on it; the criterion text is what wants a word.
3. **The spike suite is not installed by `commands.install` any more** (Child A), so I ran
   `npm install --prefix spike` by hand to execute it. `integrate` will not do this; CI's `spike`
   job does its own `npm ci`.

## 4. GO obligations

- **GO-1** — cited, not re-litigated. AC-10's five verdicts, the class-(b) `kept` rows and the
  refusal to transcribe are all decision 079 applied.
- **GO-2 / GO-3** — this child's `integrate` is the proof of Q-0106's commands, and it is the run's
  job rather than mine. Both commands were run by hand here: `pnpm install --frozen-lockfile` and
  `pnpm turbo run test --force --continue` → 7/7, 0 cached.
- **GO-4** — `spike/` is intact and tracked; the only write there is AC-8's move plus the two-line
  re-point of its reader.
- **GO-6** — AC-30's header cites **Q-0108** for the JSDoc sweep. **I cannot allocate it**: the
  backlog belongs to the harness and an implement step's writes there are discarded. `Q-0108` is
  free as of this branch and is the id `harness ticket new` would answer; if the gate allocates a
  different one, the header needs a one-line edit. Its body: 51 production files under
  `packages/*/src` cite a `spike/` path in JSDoc; `q0050.source.test.ts:67` classifies
  `Why: behaviour preserved from spike/…` clauses and **throws** on one it cannot classify, and
  `:191–203` pins eight such lines across eight files — a sweep that rewords them without moving
  that register turns the suite red.
- **R-2, restated because it is the easiest thing to get wrong at this gate:** the sweep is green
  after this change, and AC-16 removed roughly half of what it ran. **That is not evidence about
  Q-0102**, whose subject is this script red under load. Its failure rate is not re-measured here.

## 5. Files

**Moved** `spike/test/q0080-allocation.json` → `packages/core/src/backlog/`.
**Added** `packages/cli/src/spike-dependencies.test.ts`.

**`packages/shared`** — `test/corpus.ts` (three helpers out, one in, header rewritten);
`src/{stages,constants,events,project,ticket,role,docs,flow,step-output}.test.ts`;
`src/{role,step-output}.ts` (AC-19 citations); `turbo.json`.

**`packages/core`** — `src/lint/lint.test.ts` (the moved block, `SHIPPED`);
`src/{adapters,contracts,fanout,lint,run-history}/*.source.test.ts` (AC-12, `importsOf`);
`src/backlog/{backlog,backlog.source}.test.ts`; `src/engine/{q0050,q0052}.source.test.ts`;
`src/{git-identity,test-command,turbo-inputs,spike-parity}.test.ts`; `turbo.json`.

**`packages/cli`** — `src/{templates,package}.test.ts`; `src/ticket.ts`; `turbo.json`.

**Outside packages** — `.github/scripts/git-identity-sweep.sh`; `harness/architecture.md` (two
sentences); `docs/04-architecture.md` (one sentence + status line); `spike/test/q0080-allocation.js`
(two lines).

## 6. Deliberately left alone

`spike/` itself, `spike-parity.test.ts`, `harness/port-charter.md`, the CI jobs and the port-freeze
jobs (all Q-0103's); the 51 deferred JSDoc citations and the eight `Why: behaviour preserved from
spike/…` clauses the `REGISTERED` map pins; `docs/06-development-plan.md` (Q-0094 E-3(a) — the plan
is rewritten by hand at each pass); the `owner: process.env.USER` defect; Q-0059, Q-0060, Q-0066,
Q-0068, Q-0100, Q-0102, Q-0039.
