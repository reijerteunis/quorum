# Q-0096 — implement report, run 2, iteration 2

*Revision round. Scope unchanged: **AC-1 to AC-6 only** — the export surface. AC-7 to AC-14 are
Q-0097's, AC-15 to AC-21 are Q-0098's; nothing below touches either.*

**One major finding was returned. It is addressed in code rather than in prose, and the measurement
that addressed it found a second defect in the same assertion that the review did not name.**

---

## 1. The finding, and why I took neither of the two remedies offered

> **major** `packages/cli/src/package.test.ts:218` — AC-1 requires `@quorum/core` to resolve in a
> plain Node process outside the source directories, but this test requires `ERR_MODULE_NOT_FOUND`
> and therefore codifies the opposite result. […] Add the requirements erratum explicitly narrowing
> AC-1 to proving that Node selects `dist/index.js`, or sequence the emitted artifact into this
> change and assert a successful import; do not approve a failing runtime import as satisfying
> "resolves at runtime."

**The objection is correct.** An assertion whose passing condition is `ERR_MODULE_NOT_FOUND` is a
test that requires a failure, and offering it as proof that a package *resolves* is the shape the
reviewer says it is. I did not argue with it.

Both remedies it offers are closed to this step:

- **The erratum.** `requirements/errata.md` is a `backlog/` file, and `spike/src/engine.js:376`
  discards an agent's edits under `backlog/` with a warning — *"the engine owns ticket state, not the
  agent"*. Checked rather than assumed: every erratum in this repository's history was committed by
  the human, none by an implement step. GO-2 anticipates exactly this and it is the tenth appearance
  of a loop handed work no step in it can perform.
- **Sequencing the artifact in.** The emit is Q-0097's AC-7 to AC-14 in full — the `build` task, its
  `outputs`, and the three replay criteria. Building `dist/` here to make an import succeed is
  implementing a sibling ticket's central deliverable to satisfy one assertion, which is the scope
  creep this role is told to refuse.

**So I took a third route, which is better than either: I removed the conflict from the code.** The
test no longer asserts a failure. It asserts a **successful resolution** in a plain Node process,
landing on `dist/index.js` — which is, in the reviewer's own words, *"proving that Node selects
`dist/index.js`"*. What the reviewer proposed narrowing AC-1 **to** is now what the code **does**, so
the narrowing has no remaining subject.

The mechanism is `import.meta.resolve`, and the property that makes it the right instrument is
measured rather than assumed: **it answers from the manifest and does not require the target to
exist.** Against this tree, with no `packages/core/dist` anywhere:

```
import.meta.resolve('@quorum/core')
  → file:///…/packages/cli/node_modules/@quorum/core/dist/index.js
```

That is decision 078(b)'s request satisfied literally — *"a proof that a plain `node` process, which
knows no such condition, **gets** `dist/`"*. Resolution is where an export map is read; execution is
what needs the file, and the file is Q-0097's.

---

## 2. The second defect, which the review did not name: the old assertion's verdict came from the checkout

Measuring the replacement exposed something worse than the objection that prompted it.

`dist/` is gitignored (`.gitignore:4`). The old assertion ran `await import('@quorum/core')` and
required it to **fail**. So its verdict depended on whether the checkout happened to hold a
gitignored directory. Measured by planting `packages/core/dist/index.js` and running the assertion's
exact shape through the same helper:

| row | `packages/core/dist` | old `expect(result.code).toBe('ERR_MODULE_NOT_FOUND')` | new assertion |
| --- | --- | --- | --- |
| A — fresh clone, CI, the integrate worktree | absent | GREEN | GREEN |
| B — a working checkout that has ever run a build | **present** | **RED** (`result.code = "RESOLVED"`) | GREEN |

This is *"A test's verdict is a property of the commit, not of the checkout or the account"*
(2026-08-30) — the same class as Q-0072's instance, where a gitignored directory a working checkout
has and a fresh clone does not decided a verdict. R-4 named a build directory as a fourth
environment cell to watch and this is that cell arriving one ticket early, through an assertion
rather than through a guard.

**And it is not merely fragile — it is a guaranteed breakage of a sibling.** The polarity here is the
mild one today: every gate reports green because none of them has a `dist/`. The moment Q-0097 lands
the build task, `dist/` exists wherever the suite runs, and the old assertion is red **everywhere**,
including CI. Iteration 1's own comment conceded half of this — *"It becomes `RESOLVED` at Q-0097 and
this assertion is that ticket's to replace"* — which is a test knowingly written to fail for the next
ticket. The new one needs no replacing: it reads the map, and the map does not move when the file
appears. Verified, not predicted — row B above is green on the shipped form.

---

## 3. Shown red, not read

Each was demonstrated through the real suite and then restored; `packages/core/package.json` is
restored byte-identically (`git diff` on it is empty).

| what | how it was made to fail | what it reported |
| --- | --- | --- |
| the tail assertion | pointed the **default** condition at `./src/index.ts` | `resolved to …/packages/core/src/index.ts: expected false to be true` |
| the resolution assertion | removed the `exports` map entirely | `resolution failed: Cannot find package '…/@quorum/core/index.js'` — Node's legacy fall-through, named in the failure message exactly as the comment claims |
| the old assertion's checkout-dependence | planted a gitignored `packages/core/dist/index.js` | old form flipped to `RESOLVED` → red; new form green |

Two assertions and three failure modes, each mode failing one of the two. That is why no negative
assertion is written beside them — see §5.

---

## 4. A defect I introduced and the measurement caught

Widening the helper to report the resolved value, I first wrote `value: String(v ?? '')`. **A module
namespace object has a null prototype, so `String()` on one throws a codeless `TypeError`** — which
the helper's own `catch` would then report as `code: ""`. AC-5's negative asserts
`ERR_PACKAGE_PATH_NOT_EXPORTED` on a deep import; had that import ever started *succeeding*, the
helper would have reported `""` rather than `RESOLVED`, and the assertion would have gone red for the
wrong reason while the real regression — a wildcard subpath becoming importable — was never named.

It surfaced because the probe printed `OLD result.code = ""` where `"RESOLVED"` was expected, which
did not match the story I was telling. `typeof v === 'string' ? v : ''` fixes it: resolution yields a
string, an import yields a namespace, and neither can throw on the way into JSON. The suite passed
17/17 before and after, so **no test would have caught this** — it was caught by disbelieving a
number. The reasoning is in the helper's comment.

---

## 5. Two assertions removed for being unfalsifiable

My first draft of the replacement carried three assertions. Reviewing the diff before finishing, two
of them could not fail once the third held:

- `expect(result.value).not.toContain('/src/')` — a path ending `/dist/index.js` contains `/src/`
  only if it is `…/src/dist/index.js`.
- `expect(result.value).not.toMatch(/@quorum\/core\/index\.js$/)` — a string ending `/dist/index.js`
  **cannot** end `@quorum/core/index.js`. Strictly dead.

Both were removed rather than shipped. An assertion that cannot fail is the defect this repository
has recorded most often — Q-0050's rounds 4 to 6 produced five of them, and Q-0079's round 3 found
one guarding the clause it existed to guard. Shipping two of them into a ticket whose review is
watching this exact file would have been the pattern repeating inside the round that was fixing it.
What each was reaching for is stated in the comment instead, with the failure mode that actually
covers it.

---

## 6. File by file

| file | change |
| --- | --- |
| `packages/cli/src/package.test.ts` | `inPlainNode` reports the evaluated expression's value as well as its outcome, with the null-prototype reasoning of §4; AC-1's plain-Node test becomes a positive resolution proof. **The only file changed this iteration.** |

Nothing else moved. `packages/core/package.json`, `packages/core/src/index.ts`, `tsconfig.base.json`,
`vitest.shared.js`, the eight byte-pin replacements and every register updated in iteration 1 are
untouched — the finding was about one assertion, and the rest of the round is not re-opened.

---

## 7. Is an erratum still owed?

**Not for the code to be honest, and I want to be precise rather than convenient about why.**

AC-1's *Test:* sketch asks to *"additionally **import** from a Node process outside the source
directories, without a repository-relative path and without a Vitest alias, so the claim is about
package metadata rather than about the bundler."* Four of its five clauses are satisfied literally —
spawned Node, bare specifier, no Vitest, and the claim resting on package metadata alone, which
`import.meta.resolve` satisfies more exactly than an import does. The fifth word, *import*, is
discharged by decision 078(b)'s *"gets `dist/`"*, a ruling that post-dates the requirement and binds
this ticket through AC-0.

The requirement's own words are that sketches are *"the implementer's starting point, not a frozen
contract"*. So what remains is a sketch verb superseded by a later ruling, not a contradiction — and
an erratum recording that nothing changed would be, on this repository's own standard, the last
repair applied first.

**The reviewer's substantive demand is met without one**: no failing import is offered as proof of
resolution. If the human nonetheless wants the supersession on the record, the sentence is drafted so
it costs nothing to land — supplied rather than requested, on Q-0062 round 3's precedent:

> **E-1.** AC-1's *Test:* sketch says *"additionally import from a Node process"*. Decision 078(b),
> written after it, asks for *"a proof that a plain `node` process, which knows no such condition,
> gets `dist/`"*. The ruling governs: what is proven is that Node's resolver, reading the export map
> and knowing no `quorum-source` condition, selects `./dist/index.js`. Executing that artifact is
> Q-0097's, and an assertion requiring the import to *fail* is refused — its verdict would depend on
> whether the checkout holds a gitignored `dist/`.

---

## 8. Verification

Run in this worktree after `pnpm install --frozen-lockfile` and
`npm install --prefix spike --no-audit --no-fund`.

```
pnpm turbo run test lint typecheck --force   21/21 tasks, 0 cached
  @quorum/shared   142 passed
  @quorum/core   1,281 passed, 2 skipped
  @quorum/cli      100 passed   (package.test.ts 17/17)
  server / web / compiler / templates   1 each
  lint  0 errors, 1 pre-existing warning     typecheck  clean
npm test --prefix spike                      19/19 test files
node spike/bin/harness.js lint               6/6 flows
pnpm sweep:git-identity                      both suites green with no resolvable git identity
```

**Every count is identical to iteration 1's** — 142 / 1,281+2 / 100. That is the expected result and
worth stating rather than glossing: this round replaced assertions inside one existing `test()` block
and added no new one, so a moved count would have meant I had done something I did not intend.

**Both environment rows were exercised for the changed assertion specifically**, which is the row
pair R-4 asks for and which iteration 1 could only promise at the merge: `package.test.ts` is 17/17
with `packages/core/dist` absent **and** with a planted `packages/core/dist/index.js` present. The
planted file was removed and `git status` is one modified file. The whole-suite verification above is
the fresh-clone row — this worktree has neither `.harness/worktrees` nor `.quorum/runs` — and the
working-checkout row for the full suite is still owed at the merge, per Q-0072's closing finding.

**R-3 still applies and is unchanged from iteration 1**: the merge is red in an existing checkout
until `pnpm install` runs, and because `tsconfig.base.json` and `vitest.shared.js` moved in this
branch, a stale editor TypeScript server reports `TS2307` on `@quorum/core` until it restarts. It
looks like a code defect and is not.

---

## 9. Deliberately left alone

Iteration 1's list stands unchanged and is not re-litigated here. Restated so nothing is closed by
silence:

1. **`packages/shared/package.json`'s `exports`** — still `./src/index.ts` for both conditions, and
   **still load-bearing for Q-0097**. Re-measured this round:
   `import.meta.resolve('@quorum/shared')` from a plain Node process returns
   `…/packages/shared/src/index.ts`. Twenty-one production files in `packages/core` import it, so the
   `dist/index.js` Q-0097 emits will carry `import … from '@quorum/shared'` and die under Node unless
   that manifest gets the same conditional map. No criterion of this half names it.
2. **`shared-resolution.test.ts`'s header** — AC-14, Q-0097's. Still true after this change.
3. **`test-discovery.test.ts:59` and `package.test.ts:76`'s hand-written `['lint','typecheck','test']`** —
   AC-13, Q-0097's. Still correct today because no fourth task exists.
4. **The `@quorum/shared` and AC-5 assertions in this file** — untouched, and AC-5's negative was
   **checked** rather than assumed against the new helper: `ERR_PACKAGE_PATH_NOT_EXPORTED` in both
   checkout rows, so a deep import's refusal does not depend on whether `dist/` exists either.
5. **The pre-existing lint warning** at `packages/core/src/backlog/backlog.ts:276` — reported not
   fixed, ground rule 3. Not in my diff.
6. **`spike/`** — untouched, `src` and `test` both. Ground rules 1 and 2. No freeze re-record owed.
7. **`docs/`** — nothing in this round falsifies a documented claim. AC-21 is Q-0098's.
8. **`backlog/`** — no ticket file written. §1 and §7 are why.
