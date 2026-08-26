# Q-0064 — implement report

*Iteration 2 (revision round). The move, the comment pass and the Q-0061 fix landed in iteration 1; this round addresses the one review finding and changes nothing else.*

---

## Round 2 — the review finding

> **major:** `packages/core/test/corpus.ts:59` the completeness guard treats any immediate entry whose name ends in `.ts` as a source file without checking that it is a file. Consequently, `packages/core/src/corpus.test.ts:82` makes the guard fire by creating a directory named `engine.ts`, not by presenting a real non-test TypeScript file omitted from the corpus. This does not prove AC-5's required incomplete-coverage path and can produce false expectations from directory names. Inspect entries with `withFileTypes` and `isFile()`, then structure the helper/test so a genuine source file can be deliberately omitted and the guard is shown to catch it.

**Accepted in full.** The finding is correct on both halves, and the second half is the one that mattered: the old fixture could not have been fixed by tightening the predicate alone. With a correct collector and a correct guard reading the same tree, no genuine source file can ever be missing from the corpus — so the guard had nothing to fire on, and iteration 1 reached for a directory named `engine.ts` to make it fire at all. That is a guard proved against a contrivance, which is the same shape as the defect this ticket exists to prevent.

### What changed, and why it now proves the thing

**1. The guard inspects entry types.** `packages/core/test/corpus.ts` now has one predicate, used by both the collector and the guard:

```ts
/** A non-test `.ts` **file**. A directory so named is not source, and never stands in for one. */
const isSourceFile = (entry: fs.Dirent): boolean =>
  entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts');

/** Whether `dir` directly holds a source file, which is what obliges the corpus to cover it. */
const holdsSource = (dir: string): boolean => fs.readdirSync(dir, { withFileTypes: true }).some(isSourceFile);
```

The bare `fs.readdirSync(...).some(isSource)` at the old line 59 is gone, and with it the JSDoc paragraph that had rationalised it (*"That guard reads the tree by NAME … so a directory the collector cannot take a file from still counts as source"*). That paragraph was the tell: it existed only to license the contrived fixture.

**2. `coreSourceFiles()` gained a seam for *how* the tree is read.**

```ts
export type SourceCollector = (root: string) => [string, string][];

export function coreSourceFiles(root: string = CORE_SRC, collectSources: SourceCollector = collect): [string, string][]
```

`root` is unchanged and still defaults to `packages/core/src` (AC-5). The second parameter is what lets a genuine source file be omitted: the test hands the reader **the non-recursive collector this ticket replaced** and points it at a fixture holding a real `engine/engine.ts`. The collector drops the file; the guard must notice `engine/` is uncovered. That is the production failure reproduced, not simulated.

**3. Four tests replace the two contrived ones** in `src/corpus.test.ts`'s AC-5 block:

| Test | What it pins |
| --- | --- |
| `a real source file the corpus leaves out throws, naming the directory holding it` | the guard fires on a **genuine** omitted `engine/engine.ts` |
| `and the file it missed is one the whole-tree reader takes, so the omission was real` | the default reader returns `['engine/engine.ts', 'index.ts']` from the same fixture — so the omission was the reader's, not the fixture's |
| `the same narrowing is caught on this package's own src, not only on a fixture` | the narrowed reader against the **real** `packages/core/src` throws `corpus incomplete: packages/core/src/(backlog\|git)` |
| `a directory named like a source file is not source, and obliges the corpus to nothing` | the finding's second half — a directory called `engine.ts` produces no false expectation |

The third is the one worth having. It says the guard would have caught the actual defect on the actual tree, which no fixture can.

### Proved by mutation, not by assertion

A guard that cannot fire is this ticket's whole subject, so I did not take the new tests' word for it. Two mutations, each reverted immediately after:

| Mutation | Result |
| --- | --- |
| `isSourceFile` drops `entry.isFile()` — i.e. the reported defect, restored | **1 failed** — `a directory named like a source file …`, with `corpus incomplete: …/engine holds source the corpus does not cover` |
| the completeness loop short-circuited (`if (true) continue`) | **2 failed** — both omission tests: the fixture one and the real-`src` one |

Restored state: 136 passed, 0 failed.

### Files touched this round

| File | Change |
| --- | --- |
| `packages/core/test/corpus.ts` | `isSourceFile(entry: fs.Dirent)` with `isFile()`; `holdsSource()` reads with `withFileTypes`; `collect` becomes a named `SourceCollector` with an inner `descend`; `coreSourceFiles` takes `collectSources`; JSDoc rewritten (the name-reading rationale deleted, `@param`s added) |
| `packages/core/src/corpus.test.ts` | imports `type SourceCollector`; AC-5 block's two contrived tests replaced by the four above, plus a shared `fixture()` helper and the `nonRecursive` collector |

Nothing else in the tree changed. `git status` shows exactly these two files.

### One judgement call the reviewer should check

**AC-5 says "an optional root argument"; I added a second optional parameter.** That is beyond the criterion's letter, and I took it deliberately because the finding asked me to *"structure the helper/test so a genuine source file can be deliberately omitted"* — and with a correct guard and a correct collector reading the same tree, the root argument alone cannot produce that state. The alternatives I weighed:

- **Export the guard as a standalone `assertCoversTree(root, keys)` and test it directly.** Cleaner in isolation, but it proves the guard in a vacuum: nothing then shows that `coreSourceFiles`'s own path calls it, and the "omission" is a hand-written key list rather than a reader that narrowed.
- **Leave the guard unfireable and delete the test.** Refused outright — AC-5 requires the failure path be exercised, and *"a check that skips its subject must not report success"* applies to this guard as much as to the corpus it protects.

The seam is documented as existing for exactly this and nothing else. If the reviewer prefers the standalone-guard shape, it is a small change and I have no attachment to the current one.

---

## The whole ticket, for the squashed diff

The reviewer sees `integration...implement`, which carries both rounds. The rest of this report accounts for iteration 1's work, re-verified against the tree as it stands now.

### AC-1 — the file set

```
packages/core/src/backlog/backlog.source.test.ts
packages/core/src/backlog/backlog.test.ts
packages/core/src/backlog/backlog.ts
packages/core/src/backlog/project.test.ts
packages/core/src/backlog/project.ts
packages/core/src/corpus.test.ts
packages/core/src/git/git.source.test.ts
packages/core/src/git/git.test.ts
packages/core/src/git/git.ts
packages/core/src/index.test.ts
packages/core/src/index.ts
packages/core/src/shared-resolution.test.ts
```

Exactly AC-1's table. No empty folder for a module that does not exist. `packages/shared/src` gained and lost nothing.

### AC-2 — `index.ts` untouched

36 bytes, `git diff main -- packages/core/src/index.ts` is empty, and `packages/shared/src/index.test.ts:52` still reads the literal `packages/core/src/index.ts` **unedited** and passes. That pin is the proof the file did not move.

### AC-3 — no behaviour changed, shown rather than asserted

For each of the three sources, `git diff main -M40%` filtered to non-comment lines produces **no output at all**:

| File | Lines | Comment lines | Non-comment lines changed |
| --- | --- | --- | --- |
| `backlog/backlog.ts` | 236 → 211 | 111 → 86 | **none** |
| `backlog/project.ts` | 100 → 87 | 57 → 44 | **none** |
| `git/git.ts` | 273 → 248 | 119 → 94 | **none** |

No export added, no signature, return type or error contract changed. The only import specifiers that moved are the six relative depths AC-3 names (`../test/…` → `../../test/…`); `project.ts` → `./backlog.js` is unchanged, both files landing in `src/backlog/`.

### AC-4 / AC-6 — the corpus reader

Keys are `backlog/backlog.ts`, `backlog/project.ts`, `git/git.ts`, `index.ts` — sorted, `/`-separated, never a basename, never absolute. `src/corpus.test.ts` re-derives the set with its own recursive listing, sharing no code with the reader, and asserts equality plus those four keys. It lives under `src/` because Vitest collects `src/**/*.test.ts`.

### AC-5 — see round 2 above.

### AC-7 — lookups match the full relative path

`git.source.test.ts` matches `'git/git.ts'`; `backlog.source.test.ts` matches `'backlog/backlog.ts'` and `'backlog/project.ts'`. Both carry a JSDoc line saying why a basename would be wrong. The `merge-base` scan at `git.source.test.ts` compares corpus keys the same way and still runs over the whole corpus.

### AC-8 — `walk` ignores git's lock files, and only those

`isGitLock` in `packages/core/test/repo.ts`: under a `.git/` directory **and** final segment ends `.lock`. Two tests in `git/git.test.ts` write inside the snapshot window themselves rather than waiting for git:

1. `.git/objects/maintenance.lock` appears between snapshots — the writes-nothing assertion still passes;
2. `.git/quorum-cache` **and** a `derived.lock` in the working tree appear — both are still seen, so the fix did not become "exclude `.git/**`".

The containment assertion is not loosened; its `for-each-ref` and `ticket.md` siblings are unchanged; the four other `walk` call sites are green.

### AC-9 — the comment pass

Comment lines fell in all three files (111→86, 57→44, 119→94) with no `Why:` pointer deleted and no reported defect fixed or reinterpreted. The three strings landed tests read all survive: `TICKET_ARTIFACT_DIR` still exists only inside a JSDoc block (`git/git.ts:53`), `EXCLUDE_PATTERN = '.harness/'` is byte-identical, and the `is merged into` / `is landed` / `is shipped` synonym scan passes.

### AC-10 — both suites green, count up

| | Before | After |
| --- | --- | --- |
| `@quorum/core` | 123 | **136** |
| `@quorum/shared` | 96 | **96** |

Breakdown: `git/git.test.ts` 49 → 51 (AC-8's two), `src/corpus.test.ts` 0 → 11 (new). Every pre-existing test is present under its original name; nothing skipped, renamed away or `.todo`-ed. `pnpm turbo run test --force` reports `Cached: 0 cached, 7 total` — no replay. `npm test --prefix spike` passes 12 files, and `git diff --stat main...HEAD -- spike` is empty. `pnpm lint` and `pnpm typecheck` pass.

### AC-11 — the stale doc path

`docs/06-development-plan.md:144` now reads `packages/core/src/backlog/backlog.ts`, without a line number. `docs/04-architecture.md` already described the layout and already recorded Q-0064 in its status line — confirmed true, unchanged. `docs/DECISIONS.md` not touched.

---

## Deliberately left alone

- **`backlog/`.** Not writable by an agent step in any flow; `commitAll` reverts it. OQ-1's re-pointing of Q-0059's and Q-0062's bodies, and Q-0061's closure as absorbed, belong to the human commit that lands this ticket.
- **Q-0059, Q-0060, Q-0062.** All three name code this ticket moves. None fixed.
- **Q-0043's nine reported defects**, and every preserved defect in the charter register.
- **`spike/`** (§3), **`packages/shared`'s flat layout**, **`packages/core/src/index.ts`'s bytes**.
- **Tooling configuration.** Vitest's `src/**/*.test.ts`, ESLint's `packages/**/*.ts` and `core`'s `tsconfig.json` are already recursive and needed nothing.
- **`harness/harness.yaml`'s test command.** OQ-2: adding `--force` is a default affecting every ticket's `integrate`, and is Q-0065's.

## Notes for the gate

- **`integrate` cannot itself prove AC-10's counts** — `commands.test` runs without `--force`, so a cached replay can report a pass it did not execute. The counts above come from `--force` runs; re-run with `--force` at the gate.
- The `SourceCollector` parameter is the one place I exceeded a criterion's letter. It is called out above rather than buried, and it is a two-line revert if the reviewer disagrees.
