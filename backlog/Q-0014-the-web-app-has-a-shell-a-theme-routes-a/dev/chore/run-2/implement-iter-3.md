# Q-0014 — implement, run 2, iteration 3

*Revision round. One review finding, confirmed and measured. Verdict: **proceed**. Four files moved,
five modified. 21/21 turbo tasks forced, 0 cached, 2,543 passed and 2 skipped.*

---

## 1. The finding, verified before it was acted on

> major: apps/web/src/package.test.ts:13 AC-5 says no file under `apps/web/src` may import a `node:`
> module, but this test imports `node:fs` (and several other new tests under `src` do likewise). The
> implementation narrows its guard to "shipping files," which is weaker than the criterion's
> explicit all-files boundary.

**Confirmed, and the count is four.** Measured over every file under `apps/web/src`:

| file | imports |
| --- | --- |
| `package.test.ts` | `node:fs`, `node:path`, `node:url` |
| `routes.test.ts` | `node:fs`, `node:path`, `node:url` |
| `source.test.ts` | `node:fs`, `node:path`, `node:url` |
| `lint-coverage.test.ts` | `node:fs`, `node:path`, `node:url` |
| `shell.test.ts` | react, react-dom/client, vitest — **none** |
| `index.test.ts` | vitest — **none** |

And the narrowing is exactly what hid them: `shippingFiles()` filtered `sourceFiles()` by
`!name.endsWith('.test.ts')`, so every file carrying the defect was outside the scan that forbids it.

**The counterfactual was measured rather than reasoned about**, because "the old check would have
missed this" is the claim a review finding turns on. A `node:fs` import was injected into
`apps/web/src/shell.test.ts` — a file the old corpus excluded and the new one includes — and the AC-5
scan run both ways against the identical tree:

- **new corpus:** `FAIL … AC-5 — no file under src reaches for something a browser does not have`,
  `AssertionError: shell.test.ts imports node:fs: expected true to be false`, 1 failed | 15 passed.
- **old corpus**, restored for one run with the shipped mutation still in place: **16 passed**,
  green over a `node:fs` import inside `apps/web/src`.

That is the reviewer's finding reproduced as a measurement. Both the mutation and the temporary
restoration were reverted; the tree carries neither.

## 2. Why the files moved rather than the scan widening in place

AC-5's subject is *every file under `apps/web/src`*, and a scan that reads the filesystem cannot be
one of them. Widening the corpus without moving anything would have made the scan report itself, and
the predictable repair for that is to narrow it again — which is how the first draft arrived at
"shipping files".

**The shape was already settled in this repository, one package down.**
`packages/shared/test/corpus.ts`'s header:

> It lives OUTSIDE `src/` deliberately. `src/` is declarations only and must stay safe to bundle for
> a browser, so the one module here that touches the filesystem sits beside it rather than in it.

That is the same sentence about the same hazard, written for the package whose schemas `apps/web`
would consume. This is that arrangement in the package whose `src/` is *literally* what a browser
gets. Each moved file's header cites it.

**Two test files stayed under `src`, and the reason is the criterion rather than convenience.**
`shell.test.ts` and `index.test.ts` import nothing a browser lacks — a document, React, vitest and
the app's own modules — so they satisfy AC-5 as written. The finding's remedy is *"move
Node-dependent tests outside `apps/web/src`"*; moving two that are not would have been a structural
change neither it nor any criterion asks for. `shell.test.ts` also belongs beside the components it
renders, and it is the file the new discrimination clause names — the corpus is asserted to contain
it, so the narrowing cannot come back.

## 3. What changed, file by file

### Moved, `apps/web/src/` → `apps/web/test/`

| file | what else changed in it |
| --- | --- |
| `source.test.ts` | **The fix.** `shippingFiles()` deleted; AC-5 scans `sourceFiles()`, every file under `src`. `SOURCE` and `PACKAGE` derive from the file's new location. Header rewritten to say why the file sits outside its own subject and **which scans still cover it**. |
| `package.test.ts` | Path comment corrected; header gains the placement reason; **AC-2's missing assertion added** (§4). |
| `routes.test.ts` | Imports `../src/router.js` and `../src/routes.js`; `SOURCE` resolves to `../src`; header gains the placement reason. |
| `lint-coverage.test.ts` | Path comment corrected (`REPO_ROOT` is still three levels up — `test/` and `src/` sit at the same depth, checked rather than assumed); header gains the placement reason. |

The AC-5 corpus is now **every file**, not every TypeScript file. That is AC-5's own wording, and it
is not cosmetic: `theme.css` carries `@import 'tailwindcss'`, which the scan reads and clears, so the
clause means something over a non-TypeScript file rather than merely tolerating one.

Two clauses were added so the corpus cannot silently narrow again — a register of identities rather
than a count, per *"A cache hit names what the task reads"* (2026-08-28):

```
expect(names, 'a test file under src is outside the corpus').toContain('shell.test.ts');
expect(names, 'a non-TypeScript file under src is outside the corpus').toContain('theme.css');
```

The first fails under the exact filter this round removed.

### Modified, in place

| file | change |
| --- | --- |
| `apps/web/src/shell.test.ts` | Header records that it is one of two test files left under `src` and why it may be, and points at `test/source.test.ts` for the rule. Its `.test.ts` naming note now names where that rule is *asserted* rather than only stated. |
| `apps/web/src/theme.css` | Three references `src/source.test.ts` → `test/source.test.ts`. |
| `apps/web/src/routes.ts` | One reference `src/routes.test.ts` → `test/routes.test.ts`. |
| `docs/04-architecture.md` | One paragraph in §`apps/web`, and one clause in the status line (§5). |

**Nothing else moved.** `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`,
`vitest.config.js`, `index.html`, `pnpm-lock.yaml`, `eslint.config.js` and every file under
`packages/` are untouched this round — `git status` is eight paths plus the new directory.

## 4. AC-2's second assertion, which was owed and missing

AC-2's *Test:* clause asks for *"a second assertion [that] lists the test files `apps/web` holds and
asserts every one ends `.test.ts`, so the discovery guard and the turbo input that reads it keep
their subject."* Iteration 1 recorded that rule in `shell.test.ts`'s header and never asserted it.
**That is an unmet criterion rather than new scope**, and this round is where it stopped being
theoretical: the package now has test files in two directories, so "every test file" is a claim
about a walk rather than about a glance.

It lives in `test/package.test.ts`, which already walks the whole package. The collector is what
**Vitest's include** would run — `/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/`, transcribed from
`configDefaults.include` — and the assertion demands the `.test.ts` suffix that `testFilesIn` and
`packages/core/turbo.json`'s `../../apps/*/**/*.test.ts` both require. The gap between the two is the
whole subject, and a second clause pins that the collector really is wider, so the first cannot
degrade into *"every file ending `.test.ts` ends `.test.ts`"*.

**Demonstrated red rather than read.** A `test/zz-probe.test.tsx` was added and the suite run:

```
× every test file this package holds ends .test.ts
AssertionError: a test file is named so that testFilesIn and the apps turbo glob cannot see it:
  expected [ 'test/zz-probe.test.tsx' ] to strictly equal []
```

— while the probe itself **passed** under Vitest, which is the defect in one line: it ran, and
nothing but this clause saw it. Fixture deleted.

The clause also names one file in each directory (`src/shell.test.ts`, `test/source.test.ts`), so a
walk that reached only one half fails rather than reporting over it.

## 5. The documentation change

§`apps/web` gains one paragraph: `src/` is what a browser gets **as a checked property over every
file in it**, which is why the four repository-reading suites sit in `test/` beside it, with the
`packages/shared/test/corpus.ts` precedent named. The status line gains one clause in the shape
Q-0013's own entry used for the same situation — *"A fourth was added in the run-2 review round
rather than by the requirement"* — because a section describing the package without this is
describing the shape it had before the review.

AC-11's two anchors are unaffected and `docs.test.ts` is green (56 passed).

## 6. What this weakened, stated rather than left to be found

**Three scans no longer cover their own scanner.** While `source.test.ts` sat under `src`, the AC-5,
AC-9 and AC-10-colour scans covered it, which is why every needle in it is assembled. Now only the
network scan does — that one walks the whole package, `test/` included. So a hex literal or a mockup
project name written into `source.test.ts` itself is no longer reported.

This is forced rather than chosen: the corpus those three criteria name is `src`, and the scanner
cannot be in it. The needles stay assembled anyway, under one rule for the file rather than a
judgement per scan, and the comment that used to justify assembly by self-coverage now says what is
actually true. The alternative — a second scanner scanning the first — is a check nobody asked for.

## 7. The first test file outside `src/` in this workspace

Measured before the move: no `*.test.ts` anywhere under `packages/` or `apps/` lived outside a `src/`
directory. `packages/core/test/vitest-include.ts` and `packages/shared/test/corpus.ts` are helpers,
not collected.

So this round is the **first live use of the discovery guarantee Q-0054 landed**.
`vitest.shared.js`'s header says the include was widened to Vitest's default precisely because *"a
red test written to `packages/core/test/x.test.ts` … was collected by nothing at all"*, and until now
that property was exercised only by that guard's own fixtures. It was verified in both directions
rather than assumed: Vitest collects and runs all four moved files (6 files, 95 tests), and the
`testFilesIn` walk was replicated over `apps/web` and returns all six test files including the four
under `test/` — so `test-discovery.test.ts`'s *"every one of its test files collected"* assertion has
them as subjects rather than passing over them.

## 8. Verification

Run in this implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`.

- `pnpm install --frozen-lockfile` → *"Lockfile is up to date, resolution step is skipped"*, exit 0.
- `pnpm turbo run lint typecheck test --force --continue` → **21 successful, 21 total, 0 cached.**
- `@quorum/web` **6 files / 95 tests** (93 before, +2 from AC-2's clauses); `@quorum/core` 61 passed
  / 1 skipped / 1,511 tests; `@quorum/cli` 25 / 628; `@quorum/shared` 12 / 180; `@quorum/server`
  8 / 127; `@quorum/compiler` 1 / 1; `@quorum/templates` 1 / 1. **2,543 passed, 2 skipped.**
- `pnpm turbo run build --force` → 3/3, 0 cached.
- `pnpm exec quorum lint` → **6/6 flows**.
- `pnpm sweep:git-identity` → *"environment discriminates (negative and positive probes both as
  expected)"* and *"the workspace suite executed and green with no resolvable git identity"*, 7/7
  forced, 0 cached.
- `pnpm lint` → 7/7 tasks, clean apart from the **same single pre-existing warning** in
  `packages/core` that iterations 1 and 2 both reported (`Unused eslint-disable directive`,
  `no-control-regex`). Not mine and not touched.

**Guards that could have moved, checked rather than assumed.**
`packages/core/src/test-discovery.test.ts` and `src/turbo-inputs.test.ts` run together: **99 passed**.
So the emitting register is still the three distribution packages, `apps/web`'s `scripts.build` is
still undefined, `apps/web/vitest.config.js` is byte-identical, and **the move earns `apps/web` no
`turbo.json` and no new `turbo-inputs` registration** — the relative specifiers the moved files now
carry (`../src/router.js`) are not repository paths the inventory holds, and every repository file
they read is what it was before: `eslint.config.js`, still a root `globalDependency`.

The second environment row — forced on `main` after the merge — is `integrate`'s and the gate's, per
Q-0072's closing finding.

## 9. What I deliberately left alone

- **`shell.test.ts` and `index.test.ts` under `src`** — §2. Neither imports a Node capability, so
  neither is what the finding names or what AC-5 forbids.
- **`apps/web/vitest.config.js`** — byte-pinned by `test-discovery.test.ts:176`. The `test/`
  directory is collected by Vitest's own default include, which that configuration re-exports
  unchanged; no narrowing and no widening was needed and none was made.
- **`vitest.shared.js`, `tsconfig.base.json`, `turbo.json`, any package's `turbo.json`** — non-goal
  12, and measured as unnecessary.
- **`testFilesIn`** — non-goal 10, R-3 — still `packages/core`'s surface. Bounded by the naming rule,
  which is now *asserted* rather than only stated.
- **`pnpm-lock.yaml`, `package.json`, `engines`** — untouched this round. The jsdom pin iteration 2
  landed is unchanged.
- **Everything iterations 1 and 2 left alone**, unchanged: the build task and the glossary ruling
  (non-goal 3, Q-0122), the live connection (non-goal 2, Q-0120), `GET /runs` (non-goal 4, Q-0121),
  the three wire shapes, authentication and the bind (non-goal 5), "override with reason" (non-goal
  6), sub-1024px responsiveness (non-goal 9), `docs/06-development-plan.md` (non-goal 11), and
  `CLAUDE.md` / `docs/GLOSSARY.md` / `docs/decisions/` / CI (non-goal 12).
- **The mutation instruments** — the `node:fs` injection, the restored old corpus and the
  `.test.tsx` probe — all deleted after use, as iteration 1's AC-4 fixture and iteration 2's three
  were.

## 10. Observations

*Not claims about this change — recorded so the gate rules them rather than discovering them.*

**observation: iteration 2's four observations are all still live and unruled**, and none is affected
by this round. In short, so the gate does not have to re-open that report: nothing stops jsdom 30
returning, and the guard that would catch it earns `apps/web` its first `turbo.json` (R-7), which is
why I did not write it; the workspace's declared `engines.node >= 22.13.0` is not honoured at Node
23.x by eighteen pre-existing packages including root `eslint` and `vitest`; R-1's `node_modules`
figure could not be re-taken in a worktree contaminated by that round's repeated `--force` installs,
and the clean-store timed install GO-4 asks for is still owed at the gate, both routes to taking it
having been refused by this environment; and `pnpm-lock.yaml` remains outside my role's `paths:`,
treated as the mechanical consequence of a `package.json` change on an eight-commit precedent. **This
round touched none of them** — no manifest, no lockfile, no install.

**observation: the three-scan self-coverage loss in §6 is a real if small reduction, and the
alternative is a guard nobody has asked for.** A colour literal or a mockup project name written into
`test/source.test.ts` is now caught by nothing. I did not add a second scanner over `test/`, because
what AC-9 and AC-10 are about is what a browser renders, and no criterion reaches the directory
beside it. If the gate wants that closed, the cheap form is to give the AC-9 and AC-10 scans the
package-wide corpus the network scan already uses — one line each — but that is a widening of two
criteria's stated subjects rather than a repair, and Q-0067 erratum E-1 is the standing rule that an
instrument's job is bounded by its *Test:* clause.

**observation: `apps/web` is now the only package in the workspace whose tests live in two
directories, and nothing states the rule that decides which.** The rule I applied is "a test that
reads the filesystem or the manifest goes in `test/`; a test that needs only a document stays in
`src/`", and it is written in four file headers and in `04-architecture.md`. It is not enforced: a
future filesystem-reading test added under `src/` is caught by AC-5 the moment it imports `node:fs`,
which is the case that matters, but one that reached the filesystem some other way would not be. I
judged a structural guard beyond both the finding and the criterion. Worth a sentence in the closing
entry so the next person adding a test to this package meets the rule rather than rediscovering it.
