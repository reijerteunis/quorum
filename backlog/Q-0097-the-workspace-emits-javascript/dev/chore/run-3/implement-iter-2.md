# Q-0097 — implement, run 3, iteration 2

*A revision round. Both findings in `review/chore/run-3/chore-iter-1.md` are majors against
`packages/cli/src/build.test.ts`, and both say the same thing about two different oracles: the check
could not see the subject it claimed to answer for. Neither is disputed and neither needed an
erratum. **One file changed — 341 insertions, 68 deletions** — and the working tree is otherwise byte
for byte the branch tip.*

---

## 1. The two findings, and what each one actually was

**Major 1 — `build.test.ts:330`, AC-8.** The write set was `filesUnder(<package>)` after the build
minus a snapshot of *path names* taken before it, computed **per emitting package**. Two consequences,
both correct as reported:

- a build that **overwrote a file that was already there** — a tracked source, a manifest, a
  configuration — has its path in the `before` set, so the difference subtracts it away; and
- anything written **outside the three emitting package directories** was never walked at all, so a
  file at the repository root, in `docs/`, in `spike/`, or in a package that emits nothing could not
  be reported however wrong it was.

**Major 2 — `build.test.ts:562`, AC-23.** The present/absent comparison was
`filesUnder(PACKAGE).filter(r => r.endsWith('.test.ts'))`. `tsc` emits `.js`, so **an emitted
`dist/x.test.js` could not appear on either side of that comparison** — which means it went on passing
with the `'**/dist/**'` exclusion deleted, and the "collected set is identical" claim was never
established. The sibling clause matched the *include* alone, and the include is only half of what
Vitest applies.

Both are the shape this ticket exists to close, arriving inside the ticket's own guards. Neither
contradicts a ground rule or decision 078, so GO-2's erratum route was not needed.

---

## 2. What changed, file by file

### `packages/cli/src/build.test.ts` — the only file touched

Nothing else in the repository moved. No production code exists in this ticket to move.

#### 2.1 The write-set oracle (Major 1)

**`UNAUDITED` — new, replacing the inline `['node_modules', '.turbo']` default.** The audit is now
*everything not on this list*, so each entry is a named claim with its reason in place:

| name | why it is excused |
| --- | --- |
| `node_modules` | an install, not a package artifact — and pruning during the walk is what keeps the audit affordable |
| `.turbo` | turbo's own cache metadata and per-task log; AC-8's own wording excuses it |
| `.git` | git's object store |
| `.harness`, `.quorum` | the harness's worktrees and run history — **written by any concurrent harness run**, so a verdict reading them would be a verdict about the machine (*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30). The pair Q-0072's closing finding names. |

The accepted limit is stated in the JSDoc rather than left to be found: a build writing *into* one of
those five is invisible here. Nothing does — each build script is
`rm -rf dist && tsc -p tsconfig.build.json` — and the alternative buys a flake rather than a guard.

**`inventory(root, prune)` — new.** `path → "size:mtimeMs:sha256"` for every file in the audited
region. Content and timestamp together make an overwrite as visible as a creation; rooting the walk at
the **workspace** rather than at each package is what puts an out-of-package write in scope. The one
write it cannot see — a rewrite identical in bytes *and* timestamp — is named as the residual.

**`writtenBetween` / `removedBetween` — new.** Created-or-overwritten, and disappeared.

**`filesUnder` — kept, now the walk both share**, with `UNAUDITED` as its default. `inventory` is
layered on it, so there is one walker and one exclusion list.

**The AC-8 test itself** now takes one `before` (after `removeEmit()`) and **one** `after` — read once
and shared, because two reads could disagree and a comparison whose halves are taken against different
states of the tree has no single subject. It then asserts, in order:

1. the build wrote *something* (the enumeration has a subject);
2. **nothing in the audited region was deleted** — a new clause, and the only one that can see what
   stopped existing, since a comparison of what *changed* cannot;
3. **every written path is under some emitting package's `dist/`** — the clause that covers writes
   outside a package root;
4. per package, direction 1 (nothing written falls outside `outputs`) and direction 2 (no declared
   pattern matches nothing), against package-relative paths sliced out of the workspace-relative set.

**Two new tests give the oracle its subject:**

- *"the write set is one a name-only, per-package snapshot could not have produced"* — a sandbox
  where three writes happen: a new file under the emit, an **overwrite** of an existing source, and a
  file **outside the package root**. The new fingerprint reports all three; the shape this replaced is
  then **run, not described**, over the same event, and reports exactly one. It fails in either
  direction — if the fingerprint stops covering content, and equally if the claim about the old shape
  turns out to be false.
- *"each name the audit prunes excuses a real file, so a sixth arrives with a subject"* — a fixture per
  entry, derived from the list as `frame.source.test.ts:294` already does for its own, plus the
  `toStrictEqual` identity pin (a count is not an identity, Q-0073). Each entry is additionally shown
  to *do work*: dropping it from the list makes its fixture visible.

#### 2.2 The collection oracle (Major 2)

**`collection()` — new.** Reads **both** halves out of `vitest.shared.js` rather than retyping them or
taking them from Vitest's defaults — the reason `packages/core/test/vitest-include.ts` gives for the
include applies to the exclude unchanged: taking the defaults directly would leave every clause green
over a configuration whose exclusion had been deleted. That module cannot be imported here
(`@quorum/core` publishes `"."` and no subpath, Q-0096 AC-5), so the shape of its reader is mirrored
**including its refusals**: a declaration this reader cannot resolve stops the guard rather than
resolving to a default nobody wrote. Three throws — a missing `configDefaults` import, an unresolvable
include, an unresolvable exclude.

**`collects(relative, patterns)` — new.** Included **and not excluded**, which is the rule Vitest
itself applies.

**The four AC-23 tests:**

1. *the configuration is the one every package resolves, and the reader refuses a shape it cannot
   resolve* — replaces the raw `toMatch` on the exclude's source text with a derived
   `expect(collection().exclude).toContain('**/dist/**')`, so the value asserted is the value used.
2. *an emitted test file is collected without the exclusion and not with it* — **red first, over real
   files** in a sandbox carrying `src/a.test.ts`, `dist/x.test.js`, `dist/nested/y.test.js` and
   `dist/index.js`. Without the exclusion all three test files are collected; with it, one.
   It also **runs the replaced shape**: the `.test.ts` suffix filter returns the same single file under
   *both* configurations, which is what makes it blind rather than merely narrower.
3. *the build emits no file the include matches* — unchanged in substance, and deliberately still the
   **include alone**: this is the primary mechanism (`tsconfig.build.json` excludes `src/**/*.test.ts`),
   and applying the exclude would make it vacuous, `**/dist/**` answering for every path under the emit.
4. *the collected set is identical with the artifact present and absent, and the emit is on both sides
   of the question* — the finding's direct remedy. It walks **every** file the package carries (the
   emit is not pruned), applies include and exclude, and:
   - **plants a real `dist/x.test.js`** for the duration, because the real emit carries no file the
     include matches, so without one the equality would hold for the trivial reason;
   - asserts the **counterfactual on the real tree**: with `'**/dist/**'` removed, the planted file *is*
     collected;
   - asserts `built === unbuilt`;
   - asserts the equality is not the walk being blind — the **candidate** sets do differ, every path by
     which they differ is under the emit, and the planted file is among them.

The plant is written inside the gitignored emit, a directory this file legitimately writes; it is
removed in a `finally`, and the next build's `rm -rf dist` clears it even after a hard crash.

**Why not spawn Vitest and ask it what it collects** — the reviewer's first option. Two reasons, both
with precedent: it would make the check spawn the run it is running inside, which is the reason
`packages/core/src/test-command.test.ts:129–158` gives for its own fixture; and it could not be asked
the counterfactual at all, since clauses 2 and 4 turn on what the collection would be *with the
exclusion removed*. The reviewer's second option — "faithfully apply both configured includes and
excludes to all candidate files" — is what shipped.

**A departure from the literal wording of Major 1's remedy, stated rather than buried.** It asks to
"instrument or isolate the real build". Isolating it would move AC-8 off the real workspace, which the
merged requirement's R-4 and OQ-1 make load-bearing — with no build step in CI, the forced workspace
suite is the only thing that builds this repository's own packages on every push. Instrumenting
`tsc`'s syscalls is not portable. A before/after content fingerprint over the whole audited region is
the faithful proxy: it answers the same question — *what did this build write* — including both cases
the finding names, and §3 shows it doing so on a real build rather than in argument.

---

## 3. Demonstrated red before green

Six mutations, each run and each reverted. The tree afterwards is byte-identical to the branch tip
(`git status --porcelain` reports one modified file).

| # | mutation | result |
| --- | --- | --- |
| 1 | `@quorum/shared`'s build script also writes `stray.txt` and appends to `vitest.config.js` | AC-8 red: `expected [ 'packages/shared/stray.txt', 'packages/shared/vitest.config.js' ] to strictly equal []` — **the overwrite half** |
| 2 | same, but the stray goes to `../server/stray.txt` | AC-8 red: `[ 'packages/server/stray.txt', 'packages/shared/vitest.config.js' ]` — **the outside-every-emitting-package half**, which no per-package walk could have been pointed at |
| 3 | the build script deletes `vitest.config.js` | AC-8 red on the new clause: `the build removed files outside its own emit: expected [ 'packages/shared/vitest.config.js' ] to strictly equal []` |
| 4 | `'**/dist/**'` removed from `vitest.shared.js` | **three** AC-23 clauses red independently, the decisive one being `the emit changes what Vitest collects in this package: expected [ 'dist/x.test.js', …(10) ] to strictly equal [ 'src/argv.test.ts', …(9) ]` |
| 5 | the exclude written as a literal list instead of spreading `configDefaults.exclude` | the reader throws: `vitest.shared.js declares an exclude this reader cannot resolve — the emit exclusion is what AC-23 turns on` |
| 6 | `filesUnder`'s prune disabled | the `UNAUDITED` clause red naming all five: `the audit descended into a name it claims to prune` |

Mutation 4 is the finding closed. Under the shape it replaced, an emitted `.test.js` could not end in
`.test.ts`, so that comparison stayed green with the exclusion deleted; it now goes red and names the
file.

---

## 4. Verification

All forced, in this worktree, after `pnpm install --frozen-lockfile` ("Already up to date", 182 ms)
and `npm install --prefix spike` ("up to date").

- **`pnpm turbo run lint typecheck test --force`** — **21 of 21 tasks successful, 0 cached.**
- Workspace suites: `cli` 10 files / 130 tests, `core` 57 files passed + 1 skipped, `shared` 12 files,
  the four stubs 1 file each. `build.test.ts` alone is **23 tests**.
- **`npm test --prefix spike`** — **19 of 19 files passed.**
- **`node spike/bin/harness.js lint`** — 6 of 6 flows.
- **`pnpm sweep:git-identity`** — green: *"both suites executed and green with no resolvable git
  identity"*. My changes read no git configuration and create no commit.
- **Both environment rows** (Q-0072's closing finding, and this change makes it load-bearing because
  `UNAUDITED` names those two directories): `build.test.ts` green with `.harness/worktrees` and
  `.quorum/runs` **absent**, and green again with both created and populated, the fixtures then
  removed.
- **Ground rule 5** — `spike-parity.test.ts` re-run rather than skipped: 26 tests pass and the pinned
  totals are **unmoved** — `binary-only` 220, `both` 2739, `library-only` 2469, total **5428**, transfer
  share **55%**. Expected to be a no-op and asserted as one: this ticket adds no spike test file and
  moves no assertion between the halves.

---

## 5. Deliberately left alone

- **Everything else from iteration 1.** The review returned two majors and no other finding, so
  `build-fixture.test.ts`, `frame.source.test.ts`, `package.test.ts`, `test-discovery.test.ts`,
  `shared-resolution.test.ts`, `docs.test.ts`, the three `tsconfig.build.json` files, the manifests,
  `turbo.json`, `vitest.shared.js` and `docs/04-architecture.md` are untouched.
- **`vitest.shared.js`'s include.** Still Vitest's own default taken by reference. The fix is a
  widening of the *exclude*, never a narrowing of the include —
  `packages/core/src/test-discovery.test.ts` reads that declaration and refuses a narrowing, and a red
  phase writes TypeScript under `src/` or `test/`, never under a gitignored emit.
- **`packages/cli/turbo.json`'s `not.toContain('"outputs"')` guard** (merged requirement R-7) — the
  contract 078(c) states, left in place with its reasoning asserted rather than replaced.
- **`test-command.test.ts:406`'s "at least" message** and **`docs.test.ts:202`'s guard being keyed on
  `Q-0041`** — both registered non-goals of this ticket (ground rule 3, R-4, R-9). Both are still real
  and still one line each.
- **`spike/`** — untouched, ground rule 1. Nothing here needed it.
- **No new turbo input declaration.** The changed test reads no repository file `package.test.ts`'s
  `OUTSIDE` register does not already name; `vitest.shared.js` is registered there and is a root
  `globalDependencies` entry, so it is hashed for every task.

## 6. Reported and not fixed

- **`packages/core/src/backlog/backlog.ts:276`** — `pnpm lint` reports one warning, *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. Pre-existing, in a
  file this ticket does not touch, and a warning rather than an error, so the task exits 0 and CI is
  unaffected. Ground rule 3.

## 7. For the reviewer, and for the gate

- The audit's **accepted limit** is in the `UNAUDITED` JSDoc: a build writing into `node_modules`,
  `.git`, `.turbo`, `.harness` or `.quorum` is invisible to AC-8. Pruning the last two is what stops a
  concurrent harness run deciding this test's verdict, which is the trade being made.
- **A `dist/x.test.js` is planted in the real emit** for the duration of one test. It is inside a
  gitignored directory this file already writes, removed in a `finally`, and cleared by the next
  build's `rm -rf dist` regardless.
- **Measured cost:** one workspace inventory is 915–1,011 files and ~70 ms; the AC-8 test's forced
  build is ~2.5 s. `build.test.ts` runs in 5.2 s in total, well inside its 300 s timeouts, and it ran
  concurrently with `build-fixture.test.ts`'s own turbo invocations in every full-suite run above
  without interference.
- **Nothing here needs a decision entry.** No criterion was contradicted, no ruling of *"The emit
  serves the binary, and no test verdict moves behind it"* (2026-09-02) was touched, and no existing
  verdict moved behind the artifact — which clause 4 of AC-23 now proves on the real package rather
  than asserting.
