# Q-0064 — `core/src` into folders, plus the flaky containment snapshot

*Requirement, 2026-08-26. Route: chore (`requirements → chore → human gate`). Runs before Q-0044.*

The layout decision is already taken: *"`core` is organised in folders named after the port's
children; `shared` stays flat"* (`docs/DECISIONS.md`, 2026-08-26). This document does not restate
it or re-argue it. It says what has to be true when the work is done, and it is written to be
buildable and checkable without asking the author anything.

## Problem

`packages/core/src` is eleven flat files and eleven of Q-0009's fourteen children are still to be
written. They will add roughly twenty more. Doing the move afterwards means re-pointing eleven
ticket bodies, eleven sets of colocated tests and eleven sets of import paths; doing it now costs
one move and makes every child's target path obvious from its own title.

The move is small. Landing it *correctly* is not, because two of its three failure modes are
silent:

- **The corpus reader is not recursive.** `coreSourceFiles()`
  (`packages/core/test/corpus.ts:22–28`) is `fs.readdirSync(dir)` with no descent. After the move
  it returns `index.ts` and nothing else. Its `if (!files.length) throw` guard does not fire,
  because one file remains. Four landed tests iterate that corpus to assert house rules over
  *every* core source — that no module declares a second stage list, that no module imports zod or
  `spike`, that `merge-base` appears in exactly one file — and all four would narrow to a
  one-file corpus while reporting green. That is *"a check that skips its subject must not report
  success"* (2026-08-25) arriving through a directory listing.
- **The comment pass and the move arrive as one diff.** The harness commits the implementer's
  worktree, so the reviewer sees `integration...implement` squashed. A move plus a comment pass
  plus one changed line of behaviour looks the same as a move plus a comment pass.

Beside them sits a flake that is already costing runs. `packages/core/src/git.test.ts:235` proves
that deriving containment writes nothing by snapshotting the directory before and after — and
`walk` (`packages/core/test/repo.ts:71–72`) is `fs.readdirSync(dir, { recursive: true })` with no
exclusion, so **`.git/**` is in the snapshot**. Anything git's own background maintenance writes in
that window fails the assertion; `.git/objects/maintenance.lock` is the observed one, twice on
2026-08-26, once on clean `main`. Q-0061 holds the evidence and is absorbed here because this
ticket already rewrites both helpers and already moves `git.test.ts`.

## User stories

**`maintainer`** — I am about to write eleven more port children. I want each one's target path to
follow from its own title (`core/lint` → `packages/core/src/lint/`), and I want the house-rule
tests that guard the whole package to still be looking at the whole package afterwards, not at one
file.

**`maintainer`** — When the core suite goes red I want that to mean something. A test that fails
on git's background maintenance and passes on a rerun teaches everyone to rerun, and a flaky test
behind Turbo's cache reports whatever it reported last.

**`contributor`** — I am adding a vendor adapter. I want to find the adapter code by looking for a
folder called `adapters/`, and I want the package's layout to match what `docs/04-architecture.md`
says it is.

`adopter` is not served by this ticket and is not harmed by it: no CLI surface, no first-run path
and no documentation a newcomer reads is touched.

## Surfaces

`packages/core` (source layout, the two test helpers under `packages/core/test/`, and the
colocated tests) and one path literal in `packages/shared`'s test suite. Plus one stale path
reference in `docs/06-development-plan.md`. Nothing in `harness/`, nothing in `backlog/`, nothing
under `spike/`, and no CLI, daemon or UI surface — none of them exist yet for this code.

## Baseline, measured 2026-08-26 on `main` at `c871ff9`

Every count below was taken from the working tree and is what the criteria compare against. The
comment figure is lines whose first non-space character begins `//`, `/*` or `*`, over total lines.

| File | Lines | Comment lines | % | Tests |
| --- | --- | --- | --- | --- |
| `src/backlog.ts` | 236 | 111 | 47 | — |
| `src/backlog.test.ts` | 483 | 38 | 7 | 37 |
| `src/backlog.source.test.ts` | 136 | 13 | 9 | 14 |
| `src/project.ts` | 100 | 57 | 57 | — |
| `src/project.test.ts` | 137 | 8 | 5 | 12 |
| `src/git.ts` | 273 | 119 | 43 | — |
| `src/git.test.ts` | 520 | 19 | 3 | 49 |
| `src/git.source.test.ts` | 111 | 15 | 13 | 9 |
| `src/index.ts` | 1 | 0 | 0 | — |
| `src/index.test.ts` | 7 | 0 | 0 | 1 |
| `src/shared-resolution.test.ts` | 24 | 10 | 41 | 1 |
| **`core` total** | | | | **123** |
| **`shared` total** | | | | **96** |

`packages/core/src` contains no subdirectory today. `packages/shared/src` is ten leaf modules and
is not touched.

Three pieces of configuration were checked and need **no change**, which is worth recording so
nobody spends a round on them: `vitest.shared.js` includes `src/**/*.test.ts` (recursive),
`eslint.config.js` globs `packages/**/*.ts` (recursive), and `packages/core/tsconfig.json` declares
no `include` list, so `tsc --noEmit` walks the whole package. The port freeze does not apply:
Q-0064 is not in the charter's `children` list and touches no `spike/` file.

## Acceptance criteria

**AC-1 — the file set under `packages/core/src` is exactly this, and nothing else.**

| Directory | Files |
| --- | --- |
| `src/backlog/` | `backlog.ts`, `backlog.test.ts`, `backlog.source.test.ts`, `project.ts`, `project.test.ts` |
| `src/git/` | `git.ts`, `git.test.ts`, `git.source.test.ts` |
| `src/` | `index.ts`, `index.test.ts`, `shared-resolution.test.ts`, `corpus.test.ts` |

`corpus.test.ts` is new and is the only new file this ticket adds; AC-4 says what it holds and why
it cannot live under `packages/core/test/`. No directory is created for a module that does not
exist yet — there is no empty `adapters/`, `contracts/`, `engine/`, `fanout/`, `lint/` or
`run-history/`. `packages/shared/src` gains and loses nothing.

**AC-2 — no product behaviour changes, and the diff proves it rather than asserting it.** For each
of `backlog.ts`, `project.ts` and `git.ts`, every line that is not a comment is byte-identical to
its pre-move content, except for import specifiers that had to change (none are expected: both
cross-module imports — `project.ts` → `./backlog.js` — stay within one folder). The exported
surface of each module is unchanged, which the landed `Object.keys(module).sort()` assertions in
`backlog.source.test.ts` and `git.source.test.ts` already pin. No export is added, no signature
changes, and no defect is fixed other than Q-0061's.

**AC-3 — `packages/core/src/index.ts` stays at `src/` root, byte-identical.** Its 36 bytes are
`export const name = '@quorum/core';\n`. The three landed pins on it — `git.source.test.ts:44`,
`backlog.source.test.ts:61` and `packages/shared/src/index.test.ts:52` — stay green **with their
path literals unedited**. That last one is the proof, because it is the pin furthest from this
change.

**AC-4 — `coreSourceFiles()` covers the whole tree, keys by `src`-relative path, and a second,
independent check would catch it if it ever stopped.** Three parts, all required:

1. The reader descends into subdirectories at any depth, returns `[relative path, text]` keyed
   from `packages/core/src` with `/` separators (`git/git.ts`, not `git.ts` and not
   `git\git.ts`), sorted, and still excludes `*.test.ts`. Its docstring already promises the
   relative path; today it returns a bare filename.
2. It keeps its "does not exist" and "no non-test source file" guards, and gains one more: for
   every immediate subdirectory of `src` that directly contains a non-test `.ts` file, the corpus
   must include at least one entry from that subdirectory, or the reader throws naming the
   directory it failed to cover. This derives its expectation from the tree, so it needs no
   maintenance as later children add folders.
3. `packages/core/src/corpus.test.ts` re-derives the expected set independently of the reader —
   its own recursive listing, written in the test file — and asserts the reader returns exactly
   that set, and that the set contains at least the four non-test sources that exist after this
   change. This is the check that would have caught hazard (1); the guard in (2) cannot be
   exercised from outside the reader, and a green tick from a guard that cannot fire is the thing
   this ticket exists to avoid. It lives under `src/` because Vitest collects `src/**/*.test.ts`
   and would never run it from `packages/core/test/`.

**AC-5 — the two by-filename lookups are updated deliberately, and match on the full relative
path.** `git.source.test.ts:15` (`name === 'git.ts'`) and `backlog.source.test.ts:15`
(`file === name`, called with `'backlog.ts'` and `'project.ts'`) match on the `src`-relative path
— `git/git.ts`, `backlog/backlog.ts`, `backlog/project.ts` — not on a basename, so two modules
with the same filename in different folders can never resolve to each other. Their
`corpus missing: packages/core/src/<…>` messages name the path that was actually looked for.

**AC-6 — the two cross-package path reads in `packages/shared` end in the state the decision entry
describes.** `packages/shared/src/project.test.ts:106` reads
`packages/core/src/backlog/project.ts` and is green. `packages/shared/src/index.test.ts:52` is
**unedited** and is green. `packages/shared`'s test count is still exactly 96.

**AC-7 — `walk` ignores git's transient lock files, and only those.** The exclusion is: an entry
whose path lies under a `.git/` directory **and** whose final segment ends `.lock`. It lives in
`walk` (`packages/core/test/repo.ts`) so every caller inherits it, with a one-line JSDoc note
naming Q-0061. A `.lock` file anywhere outside a `.git/` directory is still observed, because a
product that wrote one would be writing to the user's tree. The sibling assertions in the same
test — `for-each-ref` and the `ticket.md` byte comparison — are unchanged, and the writes-nothing
assertion itself is **not** loosened.

**AC-8 — the Q-0061 fix is proven in both directions.** In `git/git.test.ts`, beside the
containment test: one test creates `.git/objects/maintenance.lock` inside the before/after window
and shows the writes-nothing assertion still passing; one test writes a non-lock file under `.git/`
(for example `.git/quorum-cache`) inside the same window and shows the snapshot comparison still
detecting it. The second is the one that matters — it is what stops the fix from quietly becoming
"exclude `.git/**`", which would blind the assertion to exactly the cache-under-`.git` that
*"Containment is derived from git on each board invocation, never stored"* (2026-08-24) forbids and
that charter register row 9 binds every later child to.

**AC-9 — the comment pass follows `harness/rules.md` §Comments and loses no authority pointer.**
For `backlog.ts`, `project.ts` and `git.ts`:

- every exported symbol and every module carries a JSDoc block stating its contract;
- no prose transcribed from `docs/DECISIONS.md` or a ticket body survives — where the argument
  matters, one line names the authority (`Why: preserved defect, see Q-0043 AC-7`) and the reader
  follows the pointer;
- **every existing `Why:`-style pointer to a preserved defect or a deliberate oddity is retained.**
  An unexplained preserved defect is one the next child helpfully fixes;
- the comment-line count of each of the three files is strictly lower than its baseline in the
  table above, and the implement report states the before and after figures per file;
- the comment text the landed tests read survives, in particular `TICKET_ARTIFACT_DIR` at
  `git.ts:60` — which exists **only inside a JSDoc block** and is asserted by
  `git.source.test.ts` — and the `EXCLUDE_PATTERN` literal `'.harness/'` beside it, which is
  written into the user's `info/exclude` and is externally observable.

**AC-10 — both suites are green, and the counts went up rather than down.** `pnpm turbo run test
--force` and `npm test --prefix spike` both pass; `pnpm lint` and `pnpm typecheck` pass.
`packages/core` reports **123 plus the tests this ticket adds**, with the exact final number stated
in the implement report and every pre-existing test still present under its original name;
`packages/shared` reports exactly **96**. No test is deleted, renamed away, `.skip`-ed or
`.todo`-ed. `--force` is not optional: a cached Turbo run replays a pass it never executed, which
is how Q-0061 stayed invisible for a run.

**AC-11 — the one stale path in the numbered docs is corrected, and DECISIONS.md is not touched.**
`docs/06-development-plan.md:144` names `packages/core/src/backlog.ts:133`; it names
`packages/core/src/backlog/backlog.ts` afterwards, without a line number, because line numbers
churn with every comment pass. `docs/04-architecture.md` already describes the folder layout and
its status line already records Q-0064 (committed in `7ff61a2`) — confirm it now reads true and
change nothing else. `docs/DECISIONS.md` is append-only and its 2026-08-26 entry describes the
pre-move state correctly; it is not edited, and no new entry is written by the implementer.

## Non-goals

- **Any change to shipped behaviour.** This is a move, two test-helper fixes and a comment pass.
- **Any defect fixed other than Q-0061's**, which is a defect in a test helper rather than in the
  product. `harness/port-charter.md` §2 stands and Q-0043's nine reported defects stay reported.
  Q-0059, Q-0060 and Q-0062 name code this ticket moves and are **not** fixed here.
- **Folders for modules that do not exist yet.** `adapters/`, `contracts/`, `engine/`, `fanout/`,
  `lint/` and `run-history/` are created by the children that fill them.
- **`packages/shared`'s layout.** It stays flat; its `index.ts` pin is why.
- **`packages/core/src/index.ts`'s bytes.**
- **Anything under `spike/`** (`harness/port-charter.md` §3).
- **Re-pointing stale path references inside `backlog/`.** See OQ-1 — that surface is not writable
  by any agent step, in any flow.
- **Tooling configuration.** Vitest, ESLint and tsconfig globs are already recursive; changing one
  would be an unrequested default.

## Open questions

None is a blocker: none changes a file format, a schema or the adapter contract, and each has a
recommended answer the implementer can proceed on.

| # | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| OQ-1 | Three **open** tickets name paths this move invalidates — Q-0059 (`packages/core/src/backlog.ts:133`), Q-0060 (`backlog.ts:82–83`), Q-0062 (`git.ts:84`) — and so do the frozen Q-0042/Q-0043 requirement and implement-report artifacts. `backlog/` is not an agent-writable surface: `commitAll` reverts and deletes agent writes there (*"A requirement may not name a surface its flow cannot write"*, 2026-08-25). Who re-points them? | Leave the frozen artifacts alone — they are dated records of what was true when written. Re-point the three open ticket bodies in the **human commit that lands this ticket**; it is three lines. Deliberately not an acceptance criterion, because a criterion naming `backlog/` cannot be closed by the implementer and every revise round would correctly refuse it. | Ruud, at the gate |
| OQ-2 | Should `coreSourceFiles()` take an optional root argument so AC-4's new guard can be pointed at a fixture and its throw path exercised? | Yes if it costs one parameter with an unchanged default; it makes the guard's failure demonstrable rather than assumed. AC-4(3) holds either way and is the check that actually catches the regression, so this is an improvement, not a dependency. | implementer, reported in the summary |
| OQ-3 | Does the lock-file exclusion belong in `walk` or at the one call site in `git.test.ts`? | In `walk`. Q-0061 says the next child that snapshots a directory containing a `.git` inherits this, and fixing the helper's callers is cheap now and gets steadily less so. | settled — AC-7 says `walk` |
| OQ-4 | Should the comment-line reduction be pinned by a test? | No. A ratio assertion goes red on the next legitimate edit to `backlog.ts` (Q-0059 and Q-0060 both open it), which makes it a test that fails for the wrong reason. The figures go in the implement report and the reviewer reads them beside the diff; the properties that *should* be permanent — JSDoc, pointers retained, pinned strings surviving — are already pinned by the source tests. | settled — AC-9 |

## Risks

**The chore flow cannot run on this ticket's first pass, and it fails *after* paying the
implementer.** `harness/Q-0064/integration` does not exist — I checked. `chore.yaml`'s `review`
step diffs `harness/{id}/integration...harness/{id}/implement`, and `integrate`, the only step that
creates the left endpoint, runs after it. This is the known gap recorded with Q-0035, where the
same shape cost $13.86 for a 23-minute implement step whose review then failed on a missing ref.
**Create the branch from `main` before starting the run.**

**Hazard (1) fails green.** If the corpus reader is left shallow, four landed tests narrow to one
file and the suite still passes. The count check in AC-10 is the tripwire — a *drop* in `core`'s
count is this ticket's characteristic failure, not a tidy-up — and AC-4(3) is the permanent guard.

**Turbo replays a pass it never executed.** Q-0061's evidence includes a `pnpm turbo run test` that
reported `Cached: 7 cached` and 7/7 successful while the flake was live; the failure only appeared
under `--force`. Every verification run in AC-10 uses `--force`.

**The comment pass collides with tests that read comment text.** `TICKET_ARTIFACT_DIR` lives only
in a JSDoc block, and the synonym scan in `git.source.test.ts` (`is merged into`, `is landed`,
`is shipped`) reads comments too. The failure is loud, which is the good case, but it costs a
revise round at roughly $8–10.

**Move and edit arrive as one diff.** The reviewer sees `integration...implement` squashed, so a
behaviour change hidden inside a "move" is not visually distinct from the move. AC-2 is stated as a
property of the diff for exactly this reason, and the implement report should carry a per-file
table (lines before/after, comment lines before/after, "no non-comment line changed") so the
reviewer can check the claim in one pass instead of re-deriving it.

**A second run mixes its reviews with the first run's.** Q-0057: `chore.yaml:34`'s `{iter}` is
run-scoped, so run 2 overwrites run 1's review files and the glob at `chore.yaml:13` feeds the
mixture back to the implementer. Nothing this ticket can fix; worth knowing if it needs a second
run.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no auth path, no environment variable read. No API key appears in any file this ticket touches, and none is introduced. |
| **Worktree safety** | Indirectly load-bearing. `git.ts`'s `EXCLUDE_PATTERN = '.harness/'` is written into the user's `info/exclude` and must survive the comment pass byte for byte (AC-9); the JSDoc explaining why it is not `TICKET_ARTIFACT_DIR` is what stops a later child from "simplifying" it. No flow writes to a working tree as a result of this change. |
| **Gate behaviour** | n/a — no gate, no flow file and no engine code is touched. The ticket's own run ends at chore's human gate as normal. |
| **File format and schema** | n/a — no zod schema, no persisted format, no `ticket.md`, `manifest.json` or `runs.log` shape. `packages/shared` gains and loses nothing. |
| **Lint rules** | n/a for the flow linter. ESLint needs no configuration change (`packages/**/*.ts` is recursive) and `pnpm lint` is part of AC-10. |
| **Cold-clone impact** | None. No CLI command, README path or first-run step exists for this code yet; the newcomer's first 30 minutes are unchanged. |
| **Product-agnostic** | n/a — no product name appears anywhere in scope. |

## How it is verified

```
git branch harness/Q-0064/integration main          # before the run — see Risks
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm turbo run test --force                          # core ≥ 123 (+ new), shared exactly 96
npm test --prefix spike                              # the independent witness, unchanged
find packages/core/src -type f | sort                # AC-1's file set, exactly
git diff --stat main...harness/Q-0064/implement      # AC-2: no non-comment line in the three sources
```

The reviewer's first two questions should be: *did the corpus reader get bigger or smaller?* and
*does the `.git/` exclusion still let a non-lock file through?* Both are answered by tests this
ticket adds, and both are the shape of failure that reports success.
