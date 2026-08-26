> **Note (2026-08-26):** file paths and line numbers cited below were re-verified against `main` at `c871ff9` while judging. Where a candidate's figure and the tree disagreed, the tree won.

# Q-0064 — `core/src` into folders, plus the flaky containment snapshot

*Merged requirement, 2026-08-26. Route: chore (`requirements → chore → human gate`). Belongs to M2; runs **before Q-0044**.*

The layout decision is already taken and is normative: *"`core` is organised in folders named after the port's children; `shared` stays flat"* (`docs/DECISIONS.md`, 2026-08-26). This document does not restate it or re-argue it. It says what must be true when the work is done, in terms an implementer can satisfy and a reviewer can check without asking the author anything.

**This document is the whole specification.** The chore flow feeds the reviewer `requirements/merged.md`, `requirements/errata.md` and `dev/implement-report.md` — not `ticket.md`. Where this document and the ticket body differ, this document governs; one such difference is recorded under *Baseline* below.

## Problem

`packages/core/src` is eleven flat files, and eleven of Q-0009's fourteen children are still to be written. They will add roughly twenty more files. Moving afterwards means re-pointing eleven ticket bodies, eleven sets of colocated tests and eleven sets of import paths; moving now costs one move and makes every child's target path follow from its own title (`core/lint` → `packages/core/src/lint/`).

The move is small. Landing it *correctly* is not, because its principal failure mode reports success:

**`coreSourceFiles()` is not recursive.** `packages/core/test/corpus.ts:22–28` is `fs.readdirSync(dir)` with no descent. After the move it returns `index.ts` and nothing else, and its `if (!files.length) throw` guard does not fire, because one file remains. Four landed house-rule tests iterate that corpus to assert properties of *every* core source — no second stage list (`backlog.source.test.ts:36`), no zod import and no schema declaration (`:110`), no import from `spike` (`:50`), and `merge-base`/`--is-ancestor` in exactly one file (`git.source.test.ts:30`). All four would narrow to a one-file corpus while reporting green. That is *"a check that skips its subject must not report success"* (`docs/DECISIONS.md`, 2026-08-25) arriving through a directory listing.

Two smaller hazards sit beside it. The two by-filename lookups (`git.source.test.ts:15`, `backlog.source.test.ts:15`) break on a relative-path key — and they are the tests that would otherwise catch the first hazard, so they must be updated deliberately rather than by search-and-replace. And two cross-package path literals in `packages/shared` read `packages/core/src/…`: `project.test.ts:106` moves with its file, while `index.test.ts:52` byte-pins `packages/core/src/index.ts` and must not move at all.

**And a flake that is already costing runs.** `packages/core/src/git.test.ts:219–239` proves that deriving containment writes nothing by snapshotting the directory before and after. `walk` (`packages/core/test/repo.ts:71–72`) is `fs.readdirSync(dir, { recursive: true })` with no exclusion, so **`.git/**` is inside the snapshot**, and anything git's own background maintenance writes in that window fails the assertion — `.git/objects/maintenance.lock` is the observed one, twice on 2026-08-26, once on clean `main`. Q-0061 holds the evidence and is absorbed here because this ticket already moves `git.test.ts` and already rewrites `packages/core/test/corpus.ts`, and `walk` lives beside `coreSourceFiles` in `packages/core/test/repo.ts`.

## User stories

**`maintainer`** — I am about to write eleven more port children. I want each one's target path to follow from its own title, and I want the house-rule tests that guard the whole package to still be looking at the whole package afterwards, not at one file.

**`maintainer`** — When the core suite goes red I want that to mean something. A test that fails on git's background maintenance and passes on a rerun teaches everyone to rerun, and behind Turbo's cache it reports whatever it reported last.

**`contributor`** — I am adding a vendor adapter. I want to find the adapter code by looking for a folder called `adapters/`, and I want the package's layout to match what `docs/04-architecture.md` says it is.

`adopter` is neither served nor harmed: no CLI surface, no first-run path and no document a newcomer reads is touched.

## Surfaces

`packages/core/src` (layout and colocated tests), `packages/core/test/` (the two helpers), one path literal in `packages/shared/src/project.test.ts`, and one stale path in `docs/06-development-plan.md`. Nothing in `harness/`, nothing in `backlog/`, nothing under `spike/`, and no CLI, daemon or UI surface — none exists for this code yet.

All of these are inside `developer-generalist`'s `paths` (`packages`, `docs`), which is checked here rather than assumed: *"A requirement may not name a surface its flow cannot write"* (2026-08-25). `backlog/` is deliberately absent from every criterion below — see OQ-1.

## Baseline, measured on `main` at `c871ff9`

Comment lines are those whose first non-whitespace characters are `//`, `/*` or `*`, over total lines. Test counts are per file.

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
| **`packages/core` total** | | | | **123** |
| **`packages/shared` total** | | | | **96** |

`packages/core/src` contains no subdirectory today. `packages/shared/src` is ten leaf modules and is not touched.

**Correction to the ticket body.** It asks for *"the same test count as before the move — 123 in `core`"* while also requiring new proof tests for the Q-0061 fix. Both cannot hold. The criterion that governs is AC-10: `core`'s count **rises** by the tests this ticket adds, no pre-existing test is removed, and a **drop** is the characteristic failure. `shared` stays at exactly 96.

**Three configuration facts, checked so nobody spends a round on them.** `vitest.shared.js` includes `src/**/*.test.ts`, which is recursive and does not collect `packages/core/test/`. `eslint.config.js:12` globs `packages/**/*.ts`, recursive. `packages/core/tsconfig.json` declares no `include`, so `tsc --noEmit` walks the whole package. **None needs changing.** The port freeze does not apply either: `harness/port-charter.md` §3 scopes it to the fourteen children, and Q-0064 is not one and touches no `spike/` file.

## Acceptance criteria

**AC-1 — the file set under `packages/core/src` is exactly this, and nothing else.**

| Directory | Files |
| --- | --- |
| `src/backlog/` | `backlog.ts`, `backlog.test.ts`, `backlog.source.test.ts`, `project.ts`, `project.test.ts` |
| `src/git/` | `git.ts`, `git.test.ts`, `git.source.test.ts` |
| `src/` | `index.ts`, `index.test.ts`, `shared-resolution.test.ts`, `corpus.test.ts` |

Every former flat path is gone. `corpus.test.ts` is new and is the only file this ticket adds; AC-6 says what it holds and why it cannot live under `packages/core/test/`. No directory is created for a module that does not exist yet — there is no empty `adapters/`, `contracts/`, `engine/`, `fanout/`, `lint/` or `run-history/`. `packages/shared/src` gains and loses nothing.

**AC-2 — `packages/core/src/index.ts` stays at `src/` root, byte-identical.** Its 36 bytes remain `export const name = '@quorum/core';\n`. The three landed pins on it — `git.source.test.ts:44`, `backlog.source.test.ts:61` and `packages/shared/src/index.test.ts:52` — stay green **with their path literals unedited**. The last is the proof, because it is the pin furthest from this change.

**AC-3 — no product behaviour changes, and the diff shows it rather than asserting it.** For each of `backlog.ts`, `project.ts` and `git.ts`, every line that is not a comment is byte-identical to its pre-move content. No export is added, no signature, return type or error contract changes, and no defect is fixed other than Q-0061's. The only import specifiers that change anywhere are the **relative depths in moved test files** — `../test/corpus.js` and `../test/repo.js` become `../../test/…` in `backlog.test.ts` (two), `backlog.source.test.ts`, `project.test.ts`, `git.test.ts` and `git.source.test.ts`. `project.ts` → `./backlog.js` is unchanged, because both files land in `src/backlog/`. The implement report carries a per-file table (lines and comment lines before/after, "no non-comment line changed") so the reviewer can check this in one pass instead of re-deriving it from a squashed diff.

**AC-4 — `coreSourceFiles()` covers the whole tree and keys by `src`-relative path.** It descends to any depth, returns `[relative path, text]` keyed from `packages/core/src` with `/` separators — `git/git.ts`, never `git.ts`, never `git\git.ts`, never an absolute path — sorted, still excluding `*.test.ts`. Its docstring already promises the relative path; today it returns a bare filename. After this change its keys are exactly:

`backlog/backlog.ts` · `backlog/project.ts` · `git/git.ts` · `index.ts`

**AC-5 — the reader fails closed on incomplete coverage, and the failure path is exercised.** It keeps its "does not exist" and "no non-test source file" guards and gains one more: for every immediate subdirectory of `src` that directly contains a non-test `.ts` file, the corpus must include at least one entry from that subdirectory, or the reader throws naming the directory it failed to cover. The rule derives its expectation from the tree, so it needs no maintenance as later children add folders — and a non-recursive read is exactly what it catches, since such a read covers zero of `backlog/` and `git/`. The helper takes an **optional root argument with its current behaviour as the default**, so a test can point the guard at a fixture and prove it throws; a guard that cannot fire is the thing this ticket exists to avoid.

**AC-6 — a second, independent check would catch it if the reader ever stopped covering the tree.** `packages/core/src/corpus.test.ts` re-derives the expected set with its own recursive listing, written in the test file rather than borrowed from the helper, and asserts the reader returns exactly that set and that the set contains at least the four keys named in AC-4. It lives under `src/` because Vitest collects `src/**/*.test.ts` and would never run it from `packages/core/test/`.

**AC-7 — the two by-filename lookups match on the full relative path.** `git.source.test.ts:15` (`name === 'git.ts'`) and `backlog.source.test.ts:15` (`file === name`, called with `'backlog.ts'` and `'project.ts'`) match `git/git.ts`, `backlog/backlog.ts` and `backlog/project.ts` — not a basename, so two same-named files in different folders can never resolve to each other. Their `corpus missing: packages/core/src/<…>` messages name the path actually looked for. The `merge-base` check at `git.source.test.ts:29–39`, which compares each corpus key against the one permitted file, is updated in the same way and still passes over the full corpus.

**AC-8 — `walk` ignores git's transient lock files, and only those, and both directions are proven.** The exclusion is: an entry whose path lies under a `.git/` directory **and** whose final path segment ends `.lock`. It lives in `walk` (`packages/core/test/repo.ts`) so every caller inherits it, with a one-line JSDoc note naming Q-0061. A `.lock` anywhere outside a `.git/` directory is still observed, because a product writing one would be writing to the user's tree. Two tests in `git/git.test.ts`, beside the containment test:

1. one creates `.git/objects/maintenance.lock` **between** the before and after snapshots and shows the writes-nothing assertion still passing — the test controls the timing and does not wait for git's maintenance to occur naturally;
2. one creates a **non-lock** file under `.git/` (for example `.git/quorum-cache`) in the same window and shows the snapshot comparison still detecting it.

The second is the one that matters: it stops the fix from quietly becoming "exclude `.git/**`", which would blind the assertion to exactly the cache-under-`.git` that *"Containment is derived from git on each board invocation, never stored"* (2026-08-24) forbids and that charter register row 9 binds every later child to. The containment assertion itself is **not** loosened; its siblings — `git for-each-ref` and the `ticket.md` byte comparison — are unchanged; and the four other `walk` call sites (`backlog.test.ts` ×3, `project.test.ts` ×1) stay green.

**AC-9 — the comment pass follows `harness/rules.md` §Comments and loses no authority pointer.** For `backlog.ts`, `project.ts` and `git.ts`:

- every module and exported symbol carries a JSDoc block stating its contract, and non-obvious interface fields and parameters keep theirs;
- prose transcribed from `docs/DECISIONS.md` or a ticket body does not survive, and neither does a comment restating the line below it — where the argument matters, one line names the authority (`Why: preserved defect, see Q-0043 AC-7`) and the reader follows the pointer;
- **every existing `Why:`-style pointer to a preserved defect or a deliberate oddity is retained**, and none of Q-0043's nine reported defects is fixed, reinterpreted or removed. An unexplained preserved defect is one the next child helpfully fixes;
- the comment-line count of each of the three files, measured as in the baseline table, is strictly lower than its figure there, and the implement report states before and after per file. Reducing the count by deleting a pointer fails the bullet above, so the two are checked together;
- the comment text landed tests read survives: `TICKET_ARTIFACT_DIR` at `git.ts:60`, which exists **only inside a JSDoc block** and is asserted by `git.source.test.ts:72`; the `EXCLUDE_PATTERN` literal `'.harness/'` beside it, which is written into the user's `info/exclude` and is externally observable; and the synonym scan at `git.source.test.ts:87–93` (`is merged into`, `is landed`, `is shipped`) which reads comments too.

**AC-10 — both suites are green, and the count went up rather than down.** `pnpm turbo run test --force` and `npm test --prefix spike` pass; `pnpm lint` and `pnpm typecheck` pass. `packages/core` reports **123 plus the tests this ticket adds**, with the exact final number stated in the implement report and every pre-existing test still present under its original name; `packages/shared` reports exactly **96**. No test is deleted, renamed away, `.skip`-ed or `.todo`-ed, and no file under `spike/` is modified. `--force` is not optional: a cached Turbo run replays a pass it never executed, which is how Q-0061 stayed invisible for a run.

**AC-11 — the one stale path in the numbered docs is corrected, and `docs/DECISIONS.md` is not touched.** `docs/06-development-plan.md:144` names `packages/core/src/backlog.ts:133`; afterwards it names `packages/core/src/backlog/backlog.ts`, without a line number, because line numbers churn with every comment pass. `docs/04-architecture.md` already describes the folder layout and already records Q-0064 in its status line (committed in `7ff61a2`) — confirm it reads true and change nothing else. `DECISIONS.md` is append-only, its 2026-08-26 entry describes the pre-move state correctly, and the implementer writes no new entry.

## Non-goals

- **Any change to shipped behaviour.** This is a move, two test-helper fixes and a comment pass.
- **Any defect fixed other than Q-0061's**, which is a defect in a test helper rather than in the product. `harness/port-charter.md` §2 stands and Q-0043's nine reported defects stay reported. Q-0059, Q-0060 and Q-0062 name code this ticket moves and are **not** fixed here.
- **Adding an export, or changing an exported name, signature, return type or error contract.**
- **Folders for modules that do not exist yet.** `adapters/`, `contracts/`, `engine/`, `fanout/`, `lint/` and `run-history/` are created by the children that fill them.
- **`packages/shared`'s layout.** It stays flat; its pinned `index.ts` is why.
- **`packages/core/src/index.ts`'s bytes.**
- **Anything under `spike/`** (`harness/port-charter.md` §3).
- **Excluding all of `.git/**` from a snapshot, or weakening the containment no-write assertion in any other way.**
- **Re-pointing stale path references inside `backlog/`.** See OQ-1: that surface is not writable by any agent step, in any flow.
- **Tooling configuration.** Vitest, ESLint and tsconfig globs are already recursive; changing one would be an unrequested default. Changing `harness/harness.yaml`'s test command is likewise out — see OQ-2.
- **A new dependency**, and anything on the v1 exclusion list (multi-user, remote daemon, cloud sync, plugin marketplace, visual canvas, eval suites, Gemini adapter, desktop shell).

## Open questions

Neither blocks solutioning: neither changes a file format, a schema, an adapter contract or the shape of the work, and each has a recommendation the implementer or the gate can act on. The two questions the Codex candidate raised as blockers — the corpus plausibility rule and the lock-file predicate — are **settled** in AC-5 and AC-8 respectively and are recorded here as decided.

| # | Question | Answer | Owner |
| --- | --- | --- | --- |
| OQ-1 | Two **open** tickets name paths this move invalidates — Q-0059 (`packages/core/src/backlog.ts:133`) and Q-0062 (`packages/core/src/git.ts:84`) — and so do the frozen Q-0042/Q-0043 requirement and implement-report artifacts. `backlog/` is not agent-writable: `commitAll` reverts and deletes agent writes there. Who re-points them? | Leave the frozen artifacts alone — they are dated records of what was true when written. Re-point the two open ticket bodies in the **human commit that lands this ticket**; it is two lines. Deliberately not an acceptance criterion, because a criterion naming `backlog/` cannot be closed by the implementer and every revise round would correctly refuse it (*"A requirement may not name a surface its flow cannot write"*, 2026-08-25). | Ruud, at the gate |
| OQ-2 | Chore's `integrate` runs `harness/harness.yaml`'s `commands.test` — `npm test --prefix spike && pnpm turbo run test`, **without `--force`** — so a green `integrate` does not by itself prove AC-10's counts. Should the command gain `--force`? | Not here. It is a configuration change affecting every ticket's `integrate` step, which is precisely the unrequested default a chore must not take. The implementer runs `--force` itself and states the counts in the report (AC-10), and the human re-runs `--force` at the gate. Worth its own ticket. | Ruud, as a follow-up |
| OQ-3 | What exact rule makes `coreSourceFiles()` fail on an incomplete corpus? | Settled — AC-5: derived per-subdirectory coverage, throwing and naming the uncovered directory, with an optional root parameter so the throw is exercised. A hard-coded floor was rejected: it needs maintenance as children land and would not catch a later narrowing. The concrete key list lives in the test (AC-4, AC-6), where a later child updates it, not in the helper. | settled |
| OQ-4 | What filename predicate defines a git transient lock file? | Settled — AC-8: under a `.git/` directory **and** final segment ends `.lock`. Narrower than `.git/**`, broader than the one observed path, and the negative test in AC-8(2) pins the boundary. | settled |
| OQ-5 | Should the comment-line reduction be pinned by a test? | No. A ratio assertion goes red on the next legitimate edit to `backlog.ts` — Q-0059 and Q-0060 both open it — which makes it a test that fails for the wrong reason. The figures go in the implement report and the reviewer reads them beside the diff; the properties that *should* be permanent (JSDoc, pointers retained, pinned strings surviving) are already pinned by the source tests. | settled — AC-9 |

## Risks

**The chore flow cannot run on this ticket's first pass, and it fails *after* paying the implementer.** `harness/Q-0064/integration` does not exist. `chore.yaml`'s `review` step diffs `harness/{id}/integration...harness/{id}/implement`, and `integrate` — the only step that creates the left endpoint — runs after it. This is the known gap recorded with Q-0035, where the same shape cost $13.86 for a 23-minute implement step whose review then failed on a missing ref. **Create the branch from `main` before starting the run.**

**Hazard AC-4/AC-5 fails green.** A shallow reader leaves four landed tests looking at one file while the suite passes. AC-10's count check is the tripwire — a *drop* in `core`'s count is this ticket's characteristic failure, not a tidy-up — and AC-6 is the permanent guard.

**Turbo replays a pass it never executed.** Q-0061's evidence includes a `pnpm turbo run test` reporting `Cached: 7 cached`, 7/7 successful, while the flake was live; it only appeared under `--force`. Every verification run uses `--force`, and OQ-2 records that `integrate` does not.

**The comment pass collides with tests that read comment text.** `TICKET_ARTIFACT_DIR` lives only in a JSDoc block, and the synonym scan reads comments too. The failure is loud, which is the good case, but it costs a revise round at roughly $8–10.

**Move and edit arrive as one diff.** The harness commits the implementer's worktree, so the reviewer sees `integration...implement` squashed: a move plus a comment pass plus one changed line of behaviour looks the same as a move plus a comment pass. AC-3 is stated as a property of the diff for that reason, and its per-file table is what makes the claim checkable in one pass.

**A second run mixes its reviews with the first run's.** Q-0057: `chore.yaml:34`'s `{iter}` is run-scoped, so run 2 overwrites run 1's review files and the glob at `chore.yaml:13` feeds the mixture back to the implementer. Nothing this ticket can fix; worth knowing if it needs a second run.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no auth path, no environment variable read, no API-key path introduced in code, tests, fixtures or docs. |
| **Worktree safety** | Indirectly load-bearing. `git.ts`'s `EXCLUDE_PATTERN = '.harness/'` is written into the user's `info/exclude` and must survive the comment pass byte for byte (AC-9); the JSDoc explaining why it is not `TICKET_ARTIFACT_DIR` is what stops a later child from "simplifying" it. No flow writes to a working tree as a result of this change. |
| **Gate behaviour** | n/a — no gate, flow file or engine code is touched. The run ends at chore's human gate as normal. |
| **Files and schemas** | n/a — no zod schema, no persisted format, no `ticket.md`, `manifest.json` or `runs.log` shape. `packages/shared` gains and loses nothing but one path literal in a test. |
| **Lint and cross-vendor rules** | n/a for the flow linter. ESLint needs no configuration change; `pnpm lint` is part of AC-10. |
| **Cold-clone impact** | None. No CLI command, README path or first-run step exists for this code yet. |
| **Product-agnostic** | n/a — no product name appears anywhere in scope. |
| **Explicit errors** | AC-5's guard fails loudly and names the directory it could not cover, rather than accepting incomplete coverage silently. |

## How it is verified

```
git branch harness/Q-0064/integration main          # before the run — see Risks
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm turbo run test --force                          # core > 123, shared exactly 96
npm test --prefix spike                              # the independent witness, unmodified
find packages/core/src -type f | sort                # AC-1's file set, exactly
git diff --stat main...harness/Q-0064/implement      # AC-3: no non-comment line in the three sources
```

The reviewer's first two questions should be: *did the corpus reader get bigger or smaller?* and *does the `.git/` exclusion still let a non-lock file through?* Both are answered by tests this ticket adds, and both are the shape of failure that reports success.

## Provenance

Two candidates, both accurate on the facts I re-checked against the tree. Neither was adopted whole.

**From the Claude candidate** — the shape of the document and most of its judgement: the measured baseline table (its line, comment and test figures all reproduce exactly), the framing of the corpus reader as the one failure that reports success, the three-part treatment of `coreSourceFiles()` behind AC-4/5/6, the `.git/`-plus-`.lock` predicate in AC-8, the comment-pass criterion including the specific pinned strings (`TICKET_ARTIFACT_DIR`, `'.harness/'`, the synonym scan), the stale-doc criterion AC-11, the configuration facts recorded so nobody re-derives them, the "who re-points `backlog/`" question routed to the gate rather than to the implementer, and the risk that the chore flow cannot run on a first pass.

**From the Codex candidate** — four things it got sharper, all now criteria: the explicit expected key list (AC-4), which is more checkable than a derived rule alone; the requirement that the new guard's **failure path be exercised** by a test (AC-5), which the Claude candidate had left as an optional improvement — an unexercised guard is exactly this ticket's subject; the requirement that the lock-file test **control the timing** and create the file between snapshots rather than wait for git (AC-8(1)); and the explicit "not a bare filename, not an absolute path" normalisation (AC-4).

**Where they disagreed, and what I picked.** On test counts, the Codex candidate's AC-19 demanded *exactly* 123 in `core` while its own AC-13 and AC-15 required new tests — self-contradictory, and it inherited the same contradiction from the ticket body. The Claude candidate's ">123, exact number reported, nothing removed" is right and is AC-10, with the ticket-body correction stated in *Baseline* so the reviewer is not left to discover it. On Q-0061's ticket body, the Codex candidate's AC-16 asked the implementer to edit a file under `backlog/`, which `commitAll` reverts before every agent step commits — the precise deadlock recorded on 2026-08-25; it is excluded from the criteria and folded into OQ-1. On the two questions the Codex candidate declared **blocking**, I disagree: both are answerable from the requirement itself without changing the design, and both are answered in AC-5 and AC-8. A blocker is an open question that would change the architecture, not one the requirement can simply decide.

**Added by this merge, from reading the tree.** AC-3's naming of the six relative-import depth changes in moved test files (`../test/…` → `../../test/…`) — neither candidate stated them, and an unexplained import change in a "pure move" diff is a revise round waiting to happen. AC-7's extension to `git.source.test.ts:29–39`, the `merge-base` scan, which also compares a corpus key. AC-8's note that `walk` has four other call sites across `backlog.test.ts` and `project.test.ts`, one of which (`project.test.ts:130`) is a second writes-nothing assertion. The surface check against `developer-generalist`'s declared `paths`. And OQ-2, the `--force` gap in `harness.yaml`'s configured test command, which means chore's `integrate` cannot itself prove AC-10.

**On size.** The Codex candidate carried 23 numbered criteria, several of which were process statements (its AC-22, routing and ordering) or a table of no-change assertions (AC-23) rather than independently testable outcomes. Merged and de-duplicated, the real work is eleven criteria — within the ten-to-fifteen band, and the ticket is approved at that size rather than split.
