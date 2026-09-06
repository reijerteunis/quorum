# Q-0107 — implement report, run 2 iteration 3

*Revision round. Two findings from `review/chore/run-2/chore-iter-2.md` — one blocker, one major —
both addressed. **One file changed**, `packages/cli/src/spike-dependencies.test.ts`, +164/−37; the
guard goes from 22 tests to 25. Verified forced: **21/21 turbo tasks, 0 cached** (lint, typecheck,
test); `@quorum/shared` 143, `@quorum/core` 1336 passed + 2 skipped, `@quorum/cli` 570; spike
**19/19**; `harness lint` **6/6**; `pnpm sweep:git-identity` green. `spike/` intact at **54 tracked
files** (55 less AC-8's move) — GO-4.*

---

## 0. The two findings, and the shape of the answer

| | finding | answer |
| --- | --- | --- |
| **major** `:139` | `corpus()` takes `--others --exclude-standard` against its own "tracked inventory" contract, so an untracked file makes the verdict a property of the checkout | **accepted and fixed in full**, red-before-green |
| **blocker** `:152` | the derived key set is spike *files*, not pre-change *sites*; broad claims overlap, so a dropped row stays green. Derive a site inventory and compare one-to-one, **or return the conflict to the gate** | **substance accepted**, one clause refuted on measurement, the closeable half closed, **the residue returned to the gate** — §3 |

Nothing else in the change was disputed by either review round, and nothing else moved.

---

## 1. The major: `corpus()` scanned files that are not in the commit

**Accepted without qualification.** The JSDoc said *"the inventory is `git ls-files`, so an untracked
scratch file is not a dependency and a checkout that has built or run something does not change the
verdict"*, and the call three lines below it took `--others --exclude-standard`, which is exactly the
flag pair that includes untracked-unignored files. A comment promising what the code beneath it does
not do — this ticket's own subject, in this ticket's own guard.

**Reproduced before it was fixed**, because a finding accepted from reading is a finding nobody
checked. An untracked `packages/core/src/scratch-untracked-probe.ts` containing one `spike/src/lint.js`
literal:

```
FAIL  every site the scan reaches is a registered exclusion carrying its reason
AssertionError: an unregistered read of the tree that is going away: expected [ Array(1) ] to strictly equal []
+   "packages/core/src/scratch-untracked-probe.ts: path spike/src/lint.js",
```

**The fix, and why `--cached` alone is the right git question rather than the convenient one.**
`corpus()` and `treeFiles()` now share `trackedUnder(directory)`, one spelling, `--cached` only. The
reasoning is in place at the helper: *"Membership is a git question, not a filesystem one"*
(2026-08-28) is **scoped to `turbo-inputs.test.ts` and argues from what turbo hashes**, where an
untracked-unignored file genuinely counts — and **Q-0090's erratum E-1 already ruled that this entry's
reasoning does not travel** to a scan asking a different question (there, *is a credential present*).
This scan asks *does the commit contain a read of the tree that is going away*, and an untracked file
is not in the commit. Iteration 2 had reached the same answer for `treeFiles()` and left `corpus()`
inconsistent with it; the two now agree, and the paragraph that described the divergence as
deliberate is gone rather than left standing as a false explanation.

**Green after the fix with the same probe still on disk**, then the probe deleted — so the
demonstration is that the *flag* changed the verdict, not that the file went away.

**One clause gained a subject in the same change.** The test named *"the scan has a corpus, and it is
the tracked one"* asserted the first half and never the second. It now compares the scanned list
against an independent `trackedUnder('packages')`. That clause fires **exactly** when the two
spellings differ — an untracked matching file — which is the whole of the difference between them, so
it is complete rather than conditional.

---

## 2. The blocker, measured before it was answered

### 2.1 One clause of the finding does not hold, and it is stated once

> *"deleting an individual `DISPOSITIONS` row remains green whenever another row claims the same subject"*

Measured, by deleting the `stages.test.ts` row (subject `src/backlog.js`, which three other rows also
claim). **Red, in two tests:**

```
AssertionError: expected { retired: 13, … } to strictly equal { retired: 14, … }
Error: the register no longer holds the row this demonstration is built from
```

### 2.2 The substance holds, and here is the measurement that shows it

Deleting the row **and decrementing the digit beside it** — two edits, one of them a single character
— was **green in 22 of 22 tests**. Repeated on a second row (`events.test.ts`, the six ui methods) to
be sure the first result was not an artefact of the demonstration fixture: also green.

So the reviewer is right about what matters: the register's protection against losing a row was one
hand-written count, and subject coverage adds nothing to it, because `subject` claims **overlap by
design** — four rows name `src/backlog.js` because four sites read it.

### 2.3 Why a derived site inventory cannot be built here — three routes, each measured

The reviewer's remedy was *"derive an independent inventory of dependency sites and compare it
one-to-one"*. Three ways to do that were built or measured, and each fails for a different reason.

**(a) Scan the pre-change tree at test time.** Works in this worktree. `git ls-tree`+`git show` over
`d24fb8b`'s `packages/**` finds **42 distinct site keys in 22 files** with the guard's three shapes,
and **67 keys across 28 files** once the three retired helper names are supplied as a fourth shape —
because `spikeSource('src/engine.js')` takes a **tree-relative** argument and contains no occurrence
of the tree's name at all, so the 39 helper calls are invisible to any literal scan. It needs
`git show` against a commit this branch is merged from, and **CI's `workspace` job checks out at
depth 1** (`ci.yml:25`, no `fetch-depth`) while **both sweep jobs use `fetch-depth: 0`** (`:153`,
`:179`). One commit would pass in two jobs and fail in a third, and a contributor's `--depth 1` clone
would fail where a full clone passed. That is *"A test's verdict is a property of the commit, not of
the checkout or the account"* (2026-08-30).

**(b) Pin that scan's output as a constant and compare it against `DISPOSITIONS`.** This is the route
iteration 2 dismissed on the wrong ground (*"a hand-written list one layer removed"*). The real
objection is sharper and is this ticket's own authority: **both operands would live in this file**, so
the comparison can only fail when somebody edits the check. That is precisely class (a) of *"A check
outlives its subject only if it can still fail"* (2026-09-05) — the class this ticket spends twelve
criteria retiring — installed inside the guard written to retire it. It is refused on the entry GO-1
made blocking, not on cost.

**(c) Derive membership from prose — the test files that still discuss the tree.** Measured: **83
test-side files** mention it, against the **24** this register names on that side. The other 59 carry
JSDoc citing behaviour that genuinely came from the spike and stays true after the deletion, and
AC-19 forbids touching them. That is §3.2(h)'s unsatisfiability, one corpus over.

**So the completeness of the disposed half is *visible* rather than *checkable*** — 079(c)'s standard,
not 079(b)'s. That is a limit, and §3 returns it to the gate rather than presenting it as an answer.

### 2.4 What was closed: `ROWS`, an identity rather than a count

Q-0073's finding is the precedent and it is exactly on point: ***a count is not an identity*** — there
the no-contraction guard was two floors that passed while a collected literal was swapped out, and it
became *"a register of `file: literal` identities with its own arithmetic pinned"*.

`ROWS` is the same shape: 35 entries, each `<verdict> <files joined>`, **generated from the file's own
text rather than transcribed** (a transcription of a register is what this repository keeps catching).
The per-verdict counts are now computed **off `ROWS`** and `ROWS.length` is tied to
`DISPOSITIONS.length`, so the two cannot drift.

**What it buys over the digit, demonstrated in a committed test rather than asserted:**

| | a count | `ROWS` |
| --- | --- | --- |
| (a) a row removed | sees it | sees it, **and names it** |
| (b) one row swapped for another over different files | blind | sees it |

The failure message for the mutation of §2.2 now reads:

```
FAIL  no row leaves this register without somebody removing it by name
AssertionError: a row was added or removed: expected [ …(34) ] to strictly equal [ …(35) ]
-   "retired packages/shared/src/events.test.ts",
```

Three tests red, and the diff names the row that went. Restored → 25/25 green.

**Stated plainly in place, because a register that oversells itself is this ticket's subject:** the
`ROWS` comparison is *not* a check that can fail on its own. Its JSDoc says so, and the test's own
comment says so.

### 2.5 What was un-claimed

The reviewer's instruction was *"…instead of substituting subject-file coverage"*. Three edits stop
the substitution:

- **The header's second paragraph** claimed *"the membership of both is derived from a scan, so a site
  nobody thought of is a red test rather than a silence."* It now scopes that to AC-30's exclusions —
  a site **still there** — and a new paragraph states outright that a site this ticket *removed* is a
  different question this file does not answer by derivation, naming the review round that said so.
- **`treeFiles()`'s JSDoc** now says what the key set is (the set of *subjects*) and, in as many
  words, what it is not (the set of *sites*), with the overlap that makes the distinction necessary.
- **A new test demonstrates the limit instead of describing it** — Q-0054's device, where the
  defective expression was shown *passing* over a fixture rather than called defective in prose. It
  drops a row, shows `unaccounted` still empty, and shows `ROWS` catching what coverage did not.

---

## 3. Returned to the gate, as the finding instructs

> *"…if that cannot be done under the current requirements, return the conflict to the gate instead of
> substituting subject-file coverage."*

**It cannot, for §2.3's three measured reasons.** The question for the gate is narrow:

**Is a register whose contraction is *visible* (079(c)) but not *checkable* (079(b)) sufficient for
AC-10's *"A site with no verdict fails"*, given that no derived form of that check exists which does
not either depend on clone depth or install a check that cannot fail?**

Three answers are available and none is the implementer's to take:

1. **Accept as shipped.** AC-10's sentence is read as binding the sites that *exist* — which the live
   scan and `EXCLUSIONS` do enforce by derivation — with the disposed half protected by `ROWS`.
2. **Amend AC-10 or AC-29 at the gate** to say the disposed half is a visible register rather than a
   derived one, so a later reader does not re-open this on the criterion's literal wording.
3. **Rule that route (b) is acceptable** — a committed baseline of the 67 pre-change site keys,
   compared one-to-one. It is buildable and I have the generated data; I did not build it because it
   contradicts decision 079 inside the guard that enforces 079, and reversing that is a ruling rather
   than an implementation choice.

**Recommendation: (2).** It costs nothing, and it is the only one of the three that stops the next
reader spending a round on the same ground — which is what R-7 predicts and what this ticket has now
done twice.

*Per GO-5 no erratum is written here: the window is a gate, not the gap between a review returning and
the next round starting (Q-0094 E-3, Q-0097's two lost errata).*

---

## 4. Files

- **`packages/cli/src/spike-dependencies.test.ts`** — the only file changed.
  - `trackedUnder()` extracted, `--cached` only, shared by `corpus()` and `treeFiles()`; both JSDocs
    rewritten, the "deliberate divergence" paragraph removed as false.
  - `ROWS` and `identity()`; the class-count test split into an identity assertion, an arithmetic
    assertion counted off `ROWS`, and a discrimination test for both halves of Q-0073's finding.
  - Three new tests (22 → 25): the tracked-inventory clause, the coverage limit demonstrated, the
    identity register's discrimination.
  - Header paragraphs 2, 3 and 5 rewritten; `treeFiles()`'s key-set paragraph rewritten.

## 5. Deliberately unchanged

The 35 verdicts, their sentences, subjects, files and evidence markers; `EXCLUSIONS`, `NEVER_NAMED`,
`LEFT_THE_TREE`; `sitesIn`'s three shapes and their discrimination tests; and everything iterations 1
and 2 landed for AC-8 to AC-19 and AC-30 — no review round has raised a finding against any of it.
`spike/` is intact and tracked; the only write there remains AC-8's move (GO-4).

## 6. One of my own numbers was wrong, and was caught before it landed

The header paragraph I wrote for route (c) said the register names **25** files. Measured off the
register's own text: **31**, of which **24** are test-side (the other seven being two `turbo.json`s
plus `cli/turbo.json`, the sweep script, `harness/architecture.md`, `ticket.ts` and `role.ts`).
Corrected to *"83 of them, against the 24 this register names on that side of its 31"* before the
change was verified. Recorded rather than quietly fixed, because a figure written into a guard's
header is a durable record and this ticket exists because of figures that were not re-measured.

## 7. Still open, unchanged from iterations 1 and 2

1. `composite.ts:94` and `:248`'s bare `'main'` literals — pinned in both directions; a gate finding
   under R-5 rather than a repair.
2. `backlog.ts:276`'s unused `eslint-disable-next-line no-control-regex` — pre-existing, one warning,
   `pnpm lint` exits 0 (7/7 tasks).
3. `turbo-inputs.test.ts`'s self-audit collects a backticked path inside a comment.
4. **AC-17 departure**, unchanged and restated because it is easy to lose: this ticket **adds**
   `../../spike/**` to `packages/cli/turbo.json`, because `treeFiles()` lists that tree and the task's
   hash must move when its file set does. Registered in `package.test.ts`'s `OUTSIDE` and `DECLARED`;
   AC-17's "sole reader" claim is scoped within `packages/core` and is untouched.
5. **GO-6** — AC-30's header cites **Q-0108** for the deferred JSDoc sweep. I cannot allocate an id;
   the backlog belongs to the harness. A different id costs a one-line edit.
6. **R-2** — the sweep is green after this change and AC-16 removed roughly half of what it ran.
   **That is not evidence about Q-0102**, whose subject is that script red under load. Its failure
   rate is not re-measured here, and recording a green sweep as closing it would be the fourth
   instance of a measurement copied into a durable record.
