# Q-0125 — implement report, run 2 iteration 1

*Written against tip `74cd70f`, with `docs/decisions/` ending at **093**, which is the entry erratum
E-1 rules landed. Verdict `proceed`.*

**GO-1 is discharged before anything else, and by measurement rather than assumption.** Erratum E-1
rules OQ-1 and records that *"A fifth package emits, and `resolved` is not a synonym for
`distributed`"* (2026-09-12) is on `main`; it is on this branch at `e99a887`, indexed in
`docs/DECISIONS.md` under `## 2026-09-12`, and I read it in full before writing a line. So the
implementer is **not** blocked on OQ-1 and `blocked` would be the wrong verdict. Nothing else in the
thirteen criteria needed a file outside `developer-generalist`'s paths or behaviour a landed entry
preserves.

---

## 1. What changed, file by file

### The deliverable

**`packages/server/package.json`** — AC-1, AC-2, AC-3. Gains the conditional `exports` map measured
verbatim from its two `tsc` siblings (`quorum-source` → `src/index.ts` for both `types` and
`default`, then `types` → `./dist/index.d.ts`, then `default` → `./dist/index.js`), publishing `"."`
alone with no subpath pattern; and `"build": "rm -rf dist && tsc -p tsconfig.build.json"`, which is
`@quorum/core`'s and `@quorum/shared`'s exactly and deliberately **not** `@quorum/cli`'s, whose
`&& chmod +x dist/quorum.js` serves a `bin` this package does not have. **No `files`, no `bin`,
`private: true` retained** — decision 093 clause 3, which promotes 092's by-name exemption for
`apps/web` into a rule for any package that emits and is not distributed.

**`packages/server/tsconfig.build.json`** — new, AC-2. `extends: "./tsconfig.json"`, exactly
`outDir`/`rootDir`/`declaration`/`noEmit`, `include: ["src/**/*.ts"]`,
`exclude: ["src/**/*.test.ts"]`, and neither `incremental` nor `composite`. `packages/server/tsconfig.json`
is untouched, so ESLint's `projectService` and `typecheck` keep the project they read.

**`packages/server/src/index.ts`** — AC-11. The transport docblock kept its arrangement and lost its
dead reason: it gave *"this package having no export surface"* as why the three wire shapes live in
`@quorum/shared`, which stopped being true the moment the package declared one. It now says a
browser may not import this package and that a moved type with no schema is the half-measure Q-0120
had to repair, citing 093 clause 5.

### Registers that went red and were re-aimed, never deleted

**`packages/core/src/test-discovery.test.ts`** — AC-4 and AC-13. The identity is five in sorted
order; three comments moved, of which **one was already false before this ticket touched it** (§3,
finding 4). `stubs` stays derived by subtraction and is now two. AC-13 lands here rather than in
`packages/cli` because `packages/core/turbo.json` already declares the root manifest and both
per-package manifest globs, so no new declaration is owed for reading every manifest in the
workspace.

**`packages/core/src/turbo-inputs.test.ts`** — AC-9(a). A fifth `NOT_READ` row for
`packages/server`, which the identity array above makes a collected literal; the `apps/web` row lost
its *"It is the one member of the register that is NOT distributed"* clause, which this ticket makes
false. A **sixth** row was owed and is not in the requirement — `apps/web/test/package.test.ts`,
named by the architecture document's corrected sentence and opened by nothing (§3, finding 6).

**`packages/server/src/package.test.ts`** — AC-1, AC-2(a), AC-3, AC-8(c), AC-11. The
*"it emits nothing"* block inverts two assertions and keeps seven, because `@quorum/core` and
`@quorum/shared` put `types` and `default` inside the map and declare no top-level `main` or
`types`. AC-3 is shown red **in both directions** (R-7): a before-fixture that still lacks the build
script and the map, and a packed-fixture carrying `files`, which must fail naming *distribution*.
The existing `import.meta.resolve` clause at AC-8(c) is unchanged and gained a comment saying that
being unchanged is the point.

**`packages/cli/src/build.test.ts`** — AC-2(b), AC-5, AC-6, AC-7, AC-8 and AC-12's source half.
`parseJsonc` was extracted from `parseTurboConfig` rather than copied, because
`tsconfig.build.json` is JSONC for the same reason a package `turbo.json` is. `buildConfigs()` globs
both workspace roots rather than naming packages. AC-6's clause derives the set the `:879` loop
actually **checks** and asserts the two it skips, so a later `continue` past a package with a map
fails rather than passing in silence.

**`packages/cli/turbo.json`** and **`packages/cli/src/package.test.ts`** — AC-9(b). Two declared
inputs and the matching `OUTSIDE`/`DECLARED` rows, with the measurement in the configuration's own
comment (§3, finding 3).

### Count-bearing sentences

**`docs/04-architecture.md`** — AC-10, AC-11, AC-12 and the status line. Five sites move: the
**Shape** paragraph, §`packages/server`'s *"it emits nothing"* sentence, the frame-union paragraph's
impossibility claim, §`packages/server`'s *"four packages that emit"*, §`apps/web`'s export-surface
clause, and the cache-hit paragraph's list.

**`docs/GLOSSARY.md`** — AC-12. **Build task** goes to five; **Emitted artifact** gets the change
that is a *term* rather than a count: *resolved* is now defined by **what Node resolves through the
`default` condition** instead of by *"the three distribution packages"*, which 092 could write only
while the two partitions coincided.

**`packages/cli/tsconfig.build.json`**, **`packages/core/tsconfig.build.json`** — the two headers
that carry a count. `packages/shared`'s carries the argument and no number, which is why it is not in
the live register rather than exempted by name.

**`packages/cli/src/end-to-end.test.ts`**, **`packages/cli/src/step-id.test.ts`** — GO-3.
Re-measured rather than re-worded, with Q-0122's figures kept beside the new ones so the movement is
visible.

**`packages/shared/src/docs.test.ts`** — AC-10, AC-11 and AC-12's documentation half.

---

## 2. The criteria, and where each is checked

| | where | red demonstration |
| --- | --- | --- |
| AC-1 | `server/src/package.test.ts` | delete the `quorum-source` branch → *"the workspace source condition is not the first branch"* |
| AC-2 | `server/src/package.test.ts` (a), `cli/src/build.test.ts` (b) | `rootDir: "./src"` in one of four → *"packages/server/tsconfig.build.json's compilerOptions diverges from packages/cli's"* |
| AC-3 | `server/src/package.test.ts` | both directions, in-suite fixtures |
| AC-4 | `core/src/test-discovery.test.ts` | remove the build script → identity fails, **stub clause passes** (1 failed, 37 passed) |
| AC-5 | `cli/src/build.test.ts` | sentinel cleared; `exclude` removed in the copy → build **fails** (§3, finding 2) |
| AC-6 | `cli/src/build.test.ts` | `types` → `./dist/absent.d.ts` → *"@quorum/server promises types at ./dist/absent.d.ts and the build does not write it"* |
| AC-7 | `cli/src/build.test.ts` | rename one barrel export → *"expected `createGateRegistry` … received `createGateRegistryProbe`"* |
| AC-8 | `cli/src/build.test.ts`, `server/src/package.test.ts` | `"^build"` on the root `test` task → *"the test task depends on something other than its own kind"* |
| AC-9 | `core/src/turbo-inputs.test.ts` | drop the row → *"packages/server (a directory, and no audited walk covers it)"* |
| AC-10 | `shared/src/docs.test.ts` | reverting the sentence fails; the fixture proves the needle finds it |
| AC-11 | `shared/src/docs.test.ts` (two sections), `server/src/package.test.ts` (source) | three fixtures, one per refused sentence |
| AC-12 | `shared/src/docs.test.ts` (docs), `cli/src/build.test.ts` (source) | glossary left at four → fails LIVE; a historical sentence rewritten → fails HISTORICAL |
| AC-13 | `core/src/test-discovery.test.ts` | add the dependency to `packages/cli` → *"packages/cli/package.json names @quorum/server 1 times"* |

**Eleven mutations, each red with a discriminating message.** AC-4's is the one worth naming: it
fails the identity clause and **not** the stub clause, which is what the criterion asked for and what
proves the two discriminate different things.

---

## 3. What I measured that the requirement did not have

**1. AC-6's rationale is wrong by one, and the correction is in the tree rather than in prose.**
AC-6 says *"`@quorum/server` is the first package that assertion has covered beside the three
distribution packages"*. Measured, `build.test.ts:879`'s loop covered **two**: `@quorum/cli` declares
a `bin` and **no `exports` map at all**, so it has always taken the `continue`. Its emit is a file
something *executes*, which Q-0098 AC-15 and AC-16 assert directly, rather than a module something
imports. The assertion is `['@quorum/core', '@quorum/server', '@quorum/shared']` and the two skipped
members are asserted too, with the two different reasons they are skipped. I found this because the
assertion I wrote from the requirement's figure went red.

**2. AC-5's predicted mutation signature is wrong, and what actually happens is a louder red.**
AC-5 says removing `exclude` *"must produce nine emitted test modules rather than none"*. Measured
against the real config, `tsc` exits **2** with `TS6059`: five of the nine test files import
`../test/fixture.js`, which sits outside `rootDir: "src"`, so the program is refused before anything
is emitted. The prediction is reasonable and general — AC-23's sandbox demonstrates an emitted
`*.test.js` over real files — and it is wrong of *this* package for a reason specific to it. The
counterfactual asserts what happens: the build fails and the failure names a `.test.ts`. **The
sharper half is recorded in place**: the failed run also wrote `test/fixture.js` and
`test/fixture.d.ts` **outside `dist/`**, which `outputs: ["dist/**"]` does not name — under-declaration,
the same family as the `*.tsbuildinfo` refusal. I removed both strays.

**3. AC-9(b) measured both ways, and the two answers differ.** Appending a line to
`packages/server/package.json` moved `@quorum/core#test` from `61a91e5467c83455` to
`073c0b8600adeb30` and `@quorum/cli#test` from `7de4164544dc0218` to `85c6a8537b2ac492` — so the
manifest reads are covered transitively through `packages/core/turbo.json`'s own glob and the root
`^test` edge, and declaring them here would be the same claim twice (Q-0121's measurement). Appending
a line to `packages/server/tsconfig.build.json` left `@quorum/cli#test` at **`7de4164544dc0218`,
unchanged** — a genuinely undeclared read, so a cached pass would have stood over a divergence AC-2(b)
exists to catch. Two inputs are declared for that and nothing else. The `apps/*` half matches nothing
today and is declared anyway, because the comparison globs both roots.

**4. A live count site outside AC-12's enumeration, already stale before this ticket.**
`build.test.ts:209` bounds the symlink-write blind spot with *"No shipped build script can reach it:
**all three** are `rm -rf dist && tsc -p tsconfig.build.json`"*. That became false at **Q-0122**, when
`apps/web` began emitting with a bundler — so a registered bound was resting on an enumeration that
had stopped describing the tree. Corrected to four `tsc` emitters plus Vite, with the staleness
recorded rather than quietly fixed.

**5. §0.1 Correction F is slightly off about the status line.** It says
`docs/04-architecture.md`'s **status line** carries *"four packages emit and three are packed"* as a
live claim. Grepped: it does not. That sentence is the **Shape** paragraph's (`:13`) and the
cache-hit paragraph's (`:294`); the status line carries only dated historical entries, all of which
stay. Both live sites moved; no status-line sentence was rewritten.

**6. AC-12's register had to be split in two, and the reason is a landed guard.**
`packages/shared/src/index.test.ts` forbids the workspace scope string appearing **anywhere** under
`packages/shared/src`, tests included, with the needle assembled at run time so the guard covers
itself. My first draft named packages in prose and in fixtures and went red. Independently,
`@quorum/shared#test` declares neither the per-package source glob nor the build-configuration glob,
so asserting a comment in `packages/cli` from `docs.test.ts` is a read `turbo-inputs.test.ts`
refuses. Both point the same way: **the documentation register lives in `packages/shared` and the
source register in `packages/cli`**, each where its subjects are hashed. Both assert LIVE and
HISTORICAL, so an omission and a blanket replacement fail differently (R-7) — demonstrated in both
directions.

**7. R-1 did not fire.** `declaration: true` has never run in this package and the requirement
predicted low risk without measuring it. It is clean: eleven `.js` and eleven `.d.ts`, no explicit
annotation needed, no `TS2742` or `TS4023`. `createApp`, `mountRead` and `mountStatic` annotating
`Hono` explicitly is what bought that, as §9 said it would. GO-4 is not reached.

**8. Two sentences fired their own guards by quoting the phrase they were removing.** Q-0111's
shape: the barrel docblock explaining that *"no export surface"* is a dead reason contained
*"no export surface"*, and the architecture document's correction quoted *"it has no `exports` map"*.
A criterion's *Test:* clause bounds the instrument, and AC-11 names both needles — so the prose moved
and the guards did not. Both now paraphrase the superseded reason, and anti-vacuity fixtures prove the
needles still find it where it is written.

**9. A regex that silently dropped a third of its subject.** `serverSurface()`'s first identifier
class was `[A-Za-z][A-Za-z0-9]*`, which cannot match the eleven `SCREAMING_SNAKE` entries in the
`SURFACE` register — 22 names against 33. The AC-7(c) identity reported it rather than passing over
it, which is the difference between a register and a count.

---

## 4. What I deliberately did not do

**No third clause reading `apps/web`'s manifest from `packages/server`.** My first draft asserted
that `apps/web` declares no dependency on the daemon. Decision 093 clause 5 records that the
protection is `apps/web/test/package.test.ts`, which holds its justification register against the
manifest in both directions and pins `dependencies` to exactly three names — so a second assertion is
one rule with two enforcers, and it would add an out-of-package read from the **one package
`turbo-inputs.test.ts` does not scan** (R-5), where nothing would report the missing declaration.
Removed, with the reasoning left in place so it is not re-added.

**No new guard in `apps/web`** (non-goal 7), **no consumer, no dependency edge, no fourth tarball**
(non-goals 1 and 2, enforced by AC-13), **no `^build` edge** (non-goal 3, asserted by AC-8), **no
change to the barrel's exports** (non-goal 4, pinned by AC-7(c)), **no daemon behaviour change**
(non-goal 5), **no subpath exports and no legacy `main`/`types`** (non-goal 6), and
**`packages/server/turbo.json` left alone** — this change adds no out-of-package read *from* that
package, so AC-9(b)'s condition for touching it is not met. `DISTRIBUTION` in `build.test.ts` is
unchanged at three, which is the whole of 092's split holding.

**No glossary term coined or retired**, so neither 22-term list moves and `CLAUDE.md` stays the
human's (Q-0103 erratum E-2). I did **not** add a guard asserting that: `docs.test.ts`'s Q-0108 block
already holds the two lists against each other as ordered sequences, and a second enforcer is the
drift this repository keeps finding.

---

## 5. Verification

**GO-2, bare environment row.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`
(checked with `git status --ignored`). Forced throughout:

- `pnpm turbo run build --force` → **5 successful, 0 cached, 2.62 s**
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**, all green
- `pnpm sweep:git-identity` → **7/7 tasks, 0 cached**, *"the workspace suite executed and green with
  no resolvable git identity"*
- `pnpm exec quorum lint` → **6/6**

The populated row on `main` after the merge is the gate's, per Q-0072's closing finding.

**GO-3, three measurements rather than one.**

| | before (four emitters) | after (five) |
| --- | --- | --- |
| forced whole-workspace build | 2.614 s (erratum E-1 at `be1b89f`); 2.951 s first cold run here | **2.62 / 2.6 / 2.579 / 2.582 s** |
| `end-to-end.test.ts`, budget 90 s | 5.6–5.7 s (Q-0122) | **5.83 / 6.00 s** |
| `step-id.test.ts`, budget 180 s | 3.3 s (Q-0122) | **3.49 / 3.53 s** |

**The build cost is not measurably higher, and the reason is structural rather than lucky**: the new
task serialises after `@quorum/core` and `@quorum/shared` through `dependsOn: ["^build"]`, nothing
depends on it, so it runs beside `@quorum/cli` and `@quorum/web` and lengthens no chain. Both
fixture budgets hold with the margin they had; both comments say in their own words that the
measurement rather than the margin is what says so, which is why they were re-run rather than
re-worded. R-3 is answered, not carried.

**AC-7 proven end to end.** A plain `node` process — no `--conditions`, no loader, no Vitest —
resolves `@quorum/server` to a URL ending `/dist/index.js`, imports the emitted module by absolute
`file://` URL, and hands back exactly the 33 runtime names the source barrel declares, derived from
that package's own `SURFACE` register. The link is synthesised in a temp directory and the test says
so in its own comment: nothing in this workspace declares a dependency on the package, so
`import.meta.resolve` would fail at the **link** stage, which is a prior failure to the one this
ticket is about. **It must not be read as proof that the name resolves from the workspace as it
stands** — it proves that once Q-0126 declares the edge, what the edge leads to exists and runs.

---

## 6. Open, and what the next ticket inherits

**R-2 stands and is accepted**: the emit ships imported by nothing. AC-7 is what makes that
acceptable rather than speculative — the consumer inherits a measured surface instead of discovering
one.

**R-8 is sharper after this change than the requirement states.** Q-0124's distribution question now
governs **two** packages, and the architecture document says so in both the Shape paragraph and
§`packages/server`: a packed `@quorum/cli` importing `@quorum/server` would be broken for the
`workspace:*` reason Q-0098's M-8 measured. Q-0126 must not add the runtime import without that
decision.

**R-5 is unchanged and is not this ticket's**: `turbo-inputs.test.ts` still does not scan
`packages/server`, so a later out-of-package read *from* that package is covered by nobody's guard.
This change adds none, so the residual is neither closed nor widened.

**R-6 is unchanged**: `packages/cli/turbo.json` does not declare the per-package manifest glob, so
`build.test.ts`'s manifest reads reach `@quorum/cli#test` only through `@quorum/core#test` and the
`^test` edge. Measured in §3 finding 3, stated in the configuration's own comment as transitive, and
not closed here.

**§7's seam was not needed.** Thirteen criteria landed in one round; no erratum is owed and none is
requested.
