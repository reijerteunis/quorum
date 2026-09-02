# Q-0098 — implement report, run 2, iteration 1

`quorum` is a runnable binary. Nine criteria, all attempted, none cut — the §5 seam (AC-19/AC-20's
packed half) was **not** taken.

**Read this first:** four tests are red in this worktree and §9 explains why, with the measurement
that isolates the cause to one thing I am not permitted to do. Four erratum candidates are in §8;
an implement step cannot write `requirements/errata.md` (Q-0096 round 2's precedent, GO-2), so they
are reported here.

---

## 1. What §12 asked me to do first, and what it returned

All six steps, in order, before any code.

**1 — install and build.** Fresh worktree, no `node_modules` (`harness/rules.md`:
`commands.install` runs only in an `integrate` worktree). `pnpm install --frozen-lockfile` → 139
packages, 540 ms. `pnpm turbo run build` → 3 cache hits, `packages/cli/dist/` restored with 14 files.

**2 — AC-15's red, captured.** Resolving `bin.quorum` from the manifest and spawning it:

```
bin.quorum = ./bin/quorum.js
resolved   = …/packages/cli/bin/quorum.js
exists     = false
RED: status=1
Error: Cannot find module '…/packages/cli/bin/quorum.js'  { code: 'MODULE_NOT_FOUND' }
```

**This is not the `ENOENT` M-1 predicts.** `execFileSync(process.execPath, [target, 'help'])`
spawns `node` *successfully*; it is `node` that then fails to resolve the module, exiting 1.
`ENOENT` is what you get spawning the target **directly** as an executable, which is a different
invocation and the one AC-16's mode bit is about. Erratum candidate **A** (§8). The red is real
either way and this is it.

**3 — OQ-1 answered: `pnpm pack` rewrites `workspace:*` to `"0.0.0"`.**

```json
"dependencies": { "@quorum/core": "0.0.0", "@quorum/shared": "0.0.0" }
```

That is M-8's **first** branch. It is not the whole answer — see erratum candidate **C**.

**4 — OQ-2 answered by measurement, and it selects Mechanism A.** Status quo first, reproducing
M-9 exactly: root `node_modules/.bin` held six entries — `eslint`, `tsc`, `tsserver`, `turbo`,
`vite`, `vitest` — and no `quorum`; `packages/cli/node_modules` held `@quorum` only, with no `.bin`
at all. After declaring `@quorum/cli` as a root devDependency, `pnpm install` linked
`node_modules/.bin/quorum` and `pnpm exec quorum help` printed the help. **R-4's procedure therefore
selects Mechanism A**, and §5 records what B would have cost.

**5 — AC-26 settled before anything read it.** §3 below.

**6 — then code.**

---

## 2. The two unknowns AC-16 and AC-25 exist to price, measured

Both are mechanisms rather than promises, and the requirement is explicit that they be proven by
observation rather than by citing a compiler.

**`tsc` preserves a leading shebang.** Read out of the emitted file: `dist/quorum.js` line 1 is
`#!/usr/bin/env node`, byte for byte.

**`tsc` sets no mode bit.** The emitted file is `rw-r--r--` (644). So the build must set it, which
is why `packages/cli`'s `build` script gained `&& chmod +x dist/quorum.js`.

**M-5's open question — does a mode bit survive a turbo cache replay? It does.** Nobody had
measured this. Forced build → `mode=755`, `exec=true`. `removeEmit()` → absent. Replay →
`cache hit … FULL TURBO`, `mode=755`, `exec=true`, shebang intact, and `execFileSync(target)`
directly (no `node` prefix) printed the help. This is AC-25 satisfied by execution.

---

## 3. AC-26 — the choice, the constraint that decided it, and the rejected shape's cost

**Chosen: the emitted `dist/quorum.js`** (R-3's recommendation), a new `src/quorum.ts` carrying the
shebang and `await main(process.argv.slice(2)).catch(dieOnUnexpected)`.

**Constraint 1 — depth.** `path.join(here, '..')` from the binary's own file must resolve to the
package root, because `spike/bin/harness.js:321` resolves the shipped templates relative to it and
Q-0093's `init` inherits that. `dist/quorum.js` satisfies it; so would `bin/quorum.js`;
`dist/bin/quorum.js` does not and is refused. Asserted three ways, including the refused shape.

**Constraint 2 — the mode bit.** Emitted means the build sets it and AC-25's replay question is
live; it was measured and holds (§2). Tracked would have made it `100755` from the commit and AC-25
true by construction — the one respect in which the rejected shape is cheaper.

**Constraint 3 — which guards see it, and this is what decided it.** `frame.source.test.ts`'s
`packageFiles()` prunes `GENERATED = ['node_modules', '.turbo', 'dist']`. So:

- an **emitted** target is pruned from the credential and signal-handler scans and is covered
  instead through its source `src/quorum.ts`, which both scans do read;
- a **tracked** `bin/quorum.js` would be scanned by AC-12, whose third test requires the
  credential-matching set to be **exactly** `[GUARD_IN_PACKAGE]` — and, being `.js`, would be
  invisible to AC-8's `DOMAIN` scan, which filters `.ts`. It would also be the one file in this
  package that neither ESLint (`packages/**/*.ts`) nor `tsc` sees.

**The rejected shape's cost, stated plainly:** an unchecked `.js` launcher in a repository whose
five most recent decisions are all about checks that skip their subject.

The number and its consequence are written into `src/quorum.ts`'s own JSDoc, where Q-0093 will read
them, citing *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) by
title and date.

**One wording problem, erratum candidate B (§8):** AC-26 states the constraint as
*"`path.relative(PACKAGE, target)` has **exactly one** path segment"*. Taken literally that admits
only a target at the package root and refuses **both** shapes M-4's own table calls admissible. I
asserted the property both agree on and that Q-0093 actually depends on —
`path.resolve(path.dirname(target), '..') === PACKAGE` — rather than the segment count.

---

## 4. AC-19 — the pack contract, and what the fixture actually needed

**`files: ["dist"]` on all three manifests.** Measured after (this worktree, built):

| package | packs | contents |
| --- | --- | --- |
| `@quorum/cli` | **17** | 14 `dist/`, `package.json`, and the `bin` target among them |
| `@quorum/core` | **63** | `dist/` and `package.json` |
| `@quorum/shared` | **21** | `dist/` and `package.json` |

No test file, nothing under `src/`, nothing under `.turbo/`, in any of the three.

**Per E-1, I assert none of those numbers.** The test asserts the declared allow-list, the presence
of `package.json` and the emit, the presence of the `bin` target, and three **derived** rejection
rules (`/\.test\.[cm]?[jt]s$/`, a `src/` prefix, a `.turbo/` prefix) — never a count, a byte size or
the absence of build output. E-1 was confirmed a third time on the way: **this worktree packed 37
for `@quorum/cli` before the change** — 22 tracked + 1 turbo log + 14 `dist/` — a *third* number in
a *third* environment, neither §3's 40 nor E-1's fresh-clone 22. One turbo log rather than four,
because I had run only `build` here.

**AC-19(b) needed more than the three tarballs, and this is erratum candidate D.** Installing the
three together does fix the `@quorum/*` half — with a dead registry the error moved *past*
`@quorum/core` — but then failed on `ajv`. `@quorum/core` declares `ajv`, `ajv-formats` and `yaml`;
`@quorum/shared` declares `zod`. These are genuine public packages this ticket did not introduce,
and no dead registry can serve them. Three shapes were tried and two rejected:

- pre-seeding `node_modules` with the packages — npm re-resolves metadata regardless, still `ECONNREFUSED`;
- `pnpm add --offline` against the shared store — `ERR_PNPM_NO_OFFLINE_META`, because pnpm wants
  registry metadata for `@quorum/core@0.0.0` and does not dedupe from sibling tarballs;
- **adopted:** pack the third-party transitive closure (8 packages — `ajv`, `fast-deep-equal`,
  `fast-uri`, `json-schema-traverse`, `require-from-string`, `ajv-formats`, `yaml`, `zod`) from this
  workspace's own installed tree and install them beside the three. That is a **local mirror**,
  which is AC-20's *"equally explicit offline guarantee"*, and nothing under `@quorum` comes from it.

Result, with `npm_config_registry` at `http://127.0.0.1:1/`, retries 0 and the cache inside the
sandbox: install OK, `@quorum` = cli, core, shared, shim realpath inside the sandbox and **not**
inside the repository, `quorum help` printed. **AC-20's own instruction is honoured: this did not
pass by letting a registry answer**, and a companion test demonstrates the closed port really does
refuse `npm view quorum`.

**OQ-3, confirmed after `files` landed, with the divergence reported not resolved:** `pnpm pack` and
`npm pack` agree on the file list for all three packages — identical, every path. They **disagree on
the packed manifest**, which is erratum candidate C.

---

## 5. AC-18 — the mechanism, the measurement, and what the other would have cost

**Mechanism A adopted**, selected by the one-command measurement R-4 prescribes (§1 step 4).
`@quorum/cli` is a root devDependency; `pnpm install` links `node_modules/.bin/quorum`; the
contributor types `pnpm exec quorum help`. R-4's risk is discharged: `package.json` and
`pnpm-lock.yaml` moved together (`link:packages/cli`), and `pnpm install --frozen-lockfile`
re-run afterwards reports *"Already up to date"*.

**What Mechanism B would have cost:** nothing to write and one thing to lose — it collapses AC-18
into AC-15, leaving no assertion that the *installed* path resolves locally, which is choosing by
accident in the other direction.

**A measured side effect of A, reported rather than buried:** the root `node_modules/.bin` gained
`acorn` and `yaml` shims beside `quorum`, hoisted because the CLI's dependency tree is now a root
dependency. Neither shadows anything, and no script in the repository invokes either.

**One correction to how AC-20 is asserted here.** pnpm's `.bin/quorum` is a generated `sh` script,
not a symlink — so `realpathSync` on it answers about the script and says nothing about its target.
My first assertion failed for exactly that reason. The positive chain now goes through the package
link, which *is* a symlink: `node_modules/@quorum/cli` realpaths to `packages/cli`, the shim's text
is shown to name `@quorum/cli/<bin.quorum>`, and that file realpaths to the same path as
`binTarget()`.

---

## 6. Files changed

**New**

- **`packages/cli/src/quorum.ts`** — the binary. Shebang first, then JSDoc carrying the depth, its
  consequence for `path.join(here, '..')` and the decision citation Q-0093 will read; then
  `await main(process.argv.slice(2)).catch(dieOnUnexpected)`. Imports nothing from `node:*`, names
  no `DOMAIN` symbol and registers no signal handler, so it passes `frame.source.test.ts`'s scans
  as production source. Deliberately **not** re-exported from `index.ts`: it has a side effect at
  import time, and `frame.source.test.ts` imports the barrel.

**Modified**

- **`packages/cli/package.json`** — `bin.quorum` → `./dist/quorum.js`; `files: ["dist"]`; `build`
  gains `&& chmod +x dist/quorum.js`.
- **`packages/core/package.json`, `packages/shared/package.json`** — `files: ["dist"]` (R-2's
  three-tarball distribution set; M-7's finding that declaring it on the CLI alone leaves ~219 files
  of repository-only material in the set).
- **`package.json`, `pnpm-lock.yaml`** — `@quorum/cli` as a root devDependency (Mechanism A).
- **`packages/cli/src/build.test.ts`** — +470 lines: AC-15, AC-16, AC-17, AC-18, AC-19, AC-20,
  AC-25, AC-26. Also `createRequire` and a `HELP` import.
- **`packages/shared/src/docs.test.ts`** — +154 lines: AC-21, six tests.
- **`packages/shared/turbo.json`** — three new declared inputs (§7).
- **`packages/core/src/turbo-inputs.test.ts`** — a repair my own change made necessary (§7).
- **`docs/04-architecture.md`** — the shape paragraph separates the three claims; `packages/server`'s
  *"Serves the built `apps/web`"* scoped to M3; `packages/cli` records the binary and its depth;
  status line bumped. No second `` `dist/**` `` was introduced (M-14).
- **`docs/01-product-definition.md`** — the cold-clone test **annotated, not rewritten** (R-5).
- **`docs/06-development-plan.md`** — M2's done-when bullet corrected; status line bumped.
- **`harness/product-context.md`** — quality pillar 7, the one agents read at run time.
- **`docs/GLOSSARY.md`** — **Build task** and **Emitted artifact**, each saying what it is *not*.
- **`docs/README.md`** — term list and status line.

### Where the new tests live, and why not in a file of their own

**`build.test.ts`, per AC-15(c)'s named safe shape (ii).** Every new assertion spawns or packs the
**real** `packages/cli/dist`, and that file calls `removeEmit()` twice. `vitest.shared.js` sets no
`fileParallelism: false` and `test.sequential` does not serialise across files, so a separate file
would race it intermittently and the flake would read as a code defect (M-12, R-2). **No helper was
extracted and no third build mechanism was introduced** — `isolate`, `buildIn`, `runBuild` and
`removeEmit` are the ones that file already owns. Each new block calls `runBuild()` for itself
rather than inheriting one, so no verdict depends on test ordering.

---

## 7. The input guard — a hole my change opened, and the repair

AC-21's scan reads three files `packages/shared` had never opened: `docs/01-product-definition.md`,
`docs/README.md` and `harness/product-context.md`. All three are now declared in
`packages/shared/turbo.json`, or a cache hit would claim something it had not read (Q-0072).

**Then the guard did something worth recording.** `docs/01-product-definition.md` was a `NOT_READ`
key in `turbo-inputs.test.ts`, reason *"named nowhere but this file, as clause A's own fixture"* —
false the moment `docs.test.ts` began reading it. Worse: `undeclaredPaths` does
`if (literal in NOT_READ) continue` for **every task**, so clause B would have gone blind to whether
`@quorum/shared#test` declared it. The register would have been excusing a real read.

Removing the key alone breaks the guard's own accounting (`:1650` requires every literal in that
file to be manifested, walked or in `NOT_READ`), so the fixture moved with it: clause A now uses
`docs/05-design-prompt.md`, which clause B already demonstrates is present and covered by no
declaration. Net effect: **one path went from excused to genuinely checked**, and my declaration is
what makes it pass. `turbo-inputs.test.ts` passes 66/66.

**Registered, not fixed:** the `NOT_READ` short-circuit is still global across tasks. Making it
per-task would be a behaviour change to a landed Q-0072/Q-0073 guard, which no criterion of this
ticket names.

---

## 8. Erratum candidates — findings I may not write down myself

`chore.yaml`'s implement step cannot write `requirements/errata.md` (Q-0096 round 2; GO-2). Each of
these states what was **run**, not what was reasoned.

**A — AC-15/M-1: the red is `MODULE_NOT_FOUND` with status 1, not `ENOENT`.** Measured (§1 step 2).
`execFileSync(process.execPath, [target])` spawns node successfully and node fails to resolve the
module. `ENOENT` arises from spawning the target directly as an executable. Changes nothing about
what AC-15 must achieve.

**B — AC-26's segment count contradicts M-4's admissibility table.** *"`path.relative(PACKAGE,
target)` has exactly one path segment"* admits only a package-root target and refuses both
`dist/quorum.js` and `bin/quorum.js`, which M-4 calls admissible. The load-bearing property is
`path.join(here, '..')` resolving to the package root, and that is what is asserted.

**C — M-8/OQ-1: both branches are real, one per packer, not alternatives.** `pnpm pack` rewrites
`workspace:*` → `"0.0.0"`. `npm pack` leaves the literal protocol, and npm then refuses it:
`EUNSUPPORTEDPROTOCOL Unsupported URL Type "workspace:": workspace:*`. This is also a **partial
answer to OQ-3**: the two packers agree on every file path and **disagree on the packed manifest**,
which is why the fixture packs `@quorum` with pnpm and the mirror with npm.

**D — AC-19(b) is not satisfiable by the three tarballs alone, for a reason M-8 does not reach.**
The blocker after the `@quorum/*` half is resolved is third-party: `ajv`, `ajv-formats`, `yaml`,
`zod` and four transitive dependencies. Resolved by a local mirror (§4); recorded because the
criterion's text implies the three tarballs are sufficient.

---

## 9. Test results — and the four that are red

Run forced, in this implement worktree, after `pnpm install --frozen-lockfile` and
`npm install --prefix spike`.

| | |
| --- | --- |
| `pnpm turbo run build test --force` | 10 tasks, **0 cached** |
| `@quorum/core` | 1285 passed, 2 skipped (57 files) |
| `@quorum/shared` | 150 passed (12 files) |
| compiler / server / templates / web | 1 each |
| **`@quorum/cli`** | **151 passed, 4 failed** (155) |
| `pnpm turbo run typecheck lint --force` | **14/14, 0 cached** |
| `npm test --prefix spike` | **19/19 files** |
| `node spike/bin/harness.js lint` | **6/6** |
| `pnpm sweep:git-identity` | *"environment discriminates"*, then red on the same four |

### The four, and the measurement that isolates the cause

```
AC-8  > audited whole in an isolated copy …
AC-8  > and that audit reports a build that writes into .git, .harness or .quorum …
AC-8  > and it reports an artifact hidden beside a turbo log …
Q-0098 AC-15 > the same chain runs in an isolated copy …
```

All four call `buildIn()`, and all four fail with `@quorum/cli#build … exited (1)`.

**Cause: `isolate()` copies `git ls-files` — tracked files only, which is its whole design — and
`packages/cli/src/quorum.ts` is untracked in my worktree.** So the copy has no `src/quorum.ts`, tsc
emits no `dist/quorum.js`, and `chmod +x dist/quorum.js` exits 1.

**Confirmed rather than asserted.** I built two isolated copies by the same recipe, differing in one
file:

```
tracked files only (what isolate() copies today):   FAILED: @quorum/cli#build exited (1)
tracked files + the untracked src/quorum.ts:        OK — built and ran: quorum — Quorum's command line.
```

Three of the four are **pre-existing tests my change turns red only while the file is unstaged**;
the fourth is mine. `git add` is not in `.claude/settings.json`'s allowlist, so I cannot stage it —
the Q-0038 shape, a harness permission refusing a command the work requires. **Once the harness
commits this worktree the file is tracked and all four pass**, which is the same property that makes
`integrate` and CI see them green. I am reporting them as red rather than describing them as
green, because a reviewer cannot tell an unstaged suite from a broken one.

### Mutations — the two most load-bearing guards shown to have subjects

- **Remove `chmod +x` from the build script** → **3 red**: AC-16's mode assertion, AC-16's
  direct-execution assertion, and **AC-25's replay** (*"the restored artifact lost its executable
  bit"*). Restored.
- **Remove `files` from `packages/cli/package.json`** → **1 red**: *"@quorum/cli declares no files
  field, so the checkout decides the tarball"*. Restored.
- AC-15's red is §1 step 2, captured against the tree as it stood.

---

## 10. Registered limits, repeated here because the criteria require it

**AC-17.** This proves the emit does not swallow a status. It proves **no command's code**, because
no command that can fail exists yet, and it does **not** prove the table's 130 — today that is
Node's default disposition, since `frame.source.test.ts:200` asserts nothing here registers a signal
handler. Both are Q-0091 to Q-0094's. No test-only command, environment variable, package export or
production branch was added to manufacture a status: the subject is the emitted `dist/fail.js`,
imported by absolute path from a plain `node` process, which works only because the emit is
self-contained JavaScript (M-2).

**AC-19, per 078(g).** `packages/cli`'s emitted JavaScript carries **no** runtime `@quorum/*`
specifier, so the packed fixture proves the easy case — a CLI whose binary needs nothing from its
declared dependencies at run time. It acquires its real subject at Q-0091's first value import.
This requirement chose to state the limit rather than sequence behind Q-0091, and I have not changed
that. The carried correction stands: `packages/cli/src/exit.test.ts:20` is a cross-package **value**
import of `runTerminalEventSchema`, so *"the only cross-package import"* holds of production source
only. Tests are not emitted, so no conclusion moves.

**Non-goal 12.** This ticket makes **no** source-map or emitted-stack-trace guarantee.

**Ground rule 5.** I added no file under `spike/test/`, so `spike-parity.test.ts`'s totals were
expected not to move — **and they did not**: 26/26, unchanged. Stated rather than skipped.

**GO-5 — the surface I cannot reach.** `CLAUDE.md:13` carries the term list identically to
`docs/README.md:28`, and it is **outside the implement role's write paths**. It needs
`build task, emitted artifact` appended, and that is the human's at the gate. Nothing mechanically
checks that the two agree. The root `README.md` is non-goal 11 and claims nothing today, so nothing
there needed correcting.

---

## 11. What I deliberately left alone

- **`spike/`** — untouched (ground rule 1). Nothing here needed it. I also declined to *read*
  `spike/bin/harness.js:1` to derive the shebang: that would make `@quorum/cli#test`'s verdict
  depend on `spike/`, which this package's turbo inputs do not declare, for a fixed string. The
  literal is asserted with the spike line named in the comment.
- **`docs/decisions/**`** — cited, never edited. The AC-21 scan exempts them by name and the
  exemption is asserted **load-bearing**: decision 008 is shown to carry an unqualified
  `npx quorum`, so the exemption really excuses something. 078(e)'s superseded figures are left
  standing (GO-6).
- **No command implemented** (non-goal 4). `COMMANDS`, `HELP` and `HANDLERS` gained nothing.
- **The unknown-command zero preserved** and now pinned across the process boundary (AC-17(c),
  non-goal 6, successor Q-0090 GA-4). Quietly returning 1 would be a behaviour change wearing a bug
  fix's clothes.
- **No bundling** (non-goal 7), **no `.npmignore`** (non-goal 10), **no signal handler**
  (non-goal 5).
- **`packages/core/src/backlog/backlog.ts:276`'s lint warning** — pre-existing, not a file I touched.

## 12. Two things a reviewer should look at hardest

1. **§7's guard repair.** I moved a fixture in a landed Q-0072/Q-0073 guard. It strengthens the
   check and my change is what made the old entry false, but it is the one place I edited a file I
   was not sent to change.
2. **AC-21's plan scoping.** `docs/06-development-plan.md` has twelve `npx quorum` mentions and five
   are unqualified — all of them **ticket titles and history** (*"Q-0010 CLI package; `npx quorum`
   entry"*), none telling a reader to type anything. The scan is therefore narrowed to that file's
   `**Done when**` bullets, which is what AC-21 means by *"development-plan bullet"* and where the
   corrected sentence lived. A companion test asserts the narrowing is a **strict subset**, still
   contains M2's done-when, and that the excluded region really does hold the record-style mentions
   — so it cannot silently become a filter that excuses the file. If a reviewer thinks the ticket
   entries should also be rewritten, that is a judgement call I made and flagged rather than hid.
