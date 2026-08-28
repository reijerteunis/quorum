# Q-0073 — implementation report

*`developer-generalist` · chore · iteration 2 · one file changed, 112 insertions, 22 deletions*

Iteration 1's review (`review/chore-iter-1.md`) is an **approve** carrying two nits and no blocker,
so this round is those two findings and nothing else. The classifier, the inventory, the audit and
the ten Q-0073 tests are untouched. One file changed: `packages/core/src/turbo-inputs.test.ts`.

---

## 1. Finding 1 — the durable prose claimed CI reported green

> *nit: `turbo-inputs.test.ts:73` The durable guard prose says CI reported green, but the
> requirements explicitly correct that claim: CI never ran the relevant revision. Change this to say
> only implement and integrate reported green, with the fresh-clone result identified as the proxy
> for CI's checkout shape.*

Accepted without qualification. `merged.md` §1 and the ticket's correction 2 both say `main` was
ahead of `origin/main` and the newest CI run predates Q-0072's merge, and the fresh-clone row is
recorded as the measured proxy for CI's disk state rather than as an observation of CI. The prose
was asserting the one thing the requirement had gone out of its way to correct.

**The module header (`:66–76`)** now reads: the guard was red on a machine that had run a flow and
green in a fresh worktree, *"which is why implement and integrate both reported green over a `main`
that was red for every developer. **CI is named here as a checkout shape and not as an
observation:** no CI run executed the revision that carried the defect, and a fresh clone, which
holds neither directory, is the measured proxy for what CI would have seen."*

**And the second instance, which the finding did not cite.** The same claim appeared verbatim in the
comment on the clause-B subject test (`:1620–1626`): *"the list that stood on `main` while implement,
integrate and CI all reported green"*. Correcting only the cited line would have left the file
asserting the refuted claim and its correction in two places, so both moved. That comment now says
*"while implement and integrate both reported green (Q-0072); CI never ran that revision"*, and its
neighbouring phrase *"the two environments"* became *"the two checkout shapes"*, which is what an
integrate worktree and CI's clone have in common and is the only property the sentence needs.

I checked every other occurrence of "CI" in the file. Three remain and all are accurate: the
`pnpm-lock.yaml` frozen-install argument (`:98`), the `.github/workflows/ci.yml` manifest entry
(`:158`), and the two corrected comments.

## 2. Finding 2 — AC-5's floors let a removal be paid for by an addition

> *nit: `turbo-inputs.test.ts:1593` AC-5 requires the forced suite to detect any unintended
> reduction from the measured 60 per-file-distinct and 34 distinct literals, but
> `toBeGreaterThanOrEqual` allows removals whenever unrelated additions keep the totals at or above
> those floors. Pin the baseline set or otherwise compare identities so removing or replacing a
> collected literal is detected, while deliberately accounting for later additions.*

Accepted, and the finding is right in a way iteration 1's justification talked itself out of. Its
comment argued a floor was the right instrument *because additions must be allowed* — but "allow
additions" and "compare totals" are two different decisions, and only the first is required.
Comparing identities in one direction gives both: nothing may leave, anything may arrive.

### The hole, measured rather than argued

The demonstration is a **replacement**, because that is the shape the finding names — a removal that
an addition pays for, leaving both totals at their floors. In `packages/shared/src/role.test.ts`
(read by the guard as text; its own suite is not involved), `'harness/architecture.md'` was
temporarily changed to `'harness/harness.yaml'`. `harness/architecture.md` is collected there and
nowhere else; `harness/harness.yaml` is already collected in `project.test.ts`, so the occurrence
count is unchanged and the distinct count falls to the old floor:

| | scan after the replacement | old assertion | verdict |
| --- | --- | --- | --- |
| per-file-distinct occurrences | **61** | `>= 60` | passes |
| distinct literals | **34** | `>= 34` | passes |

Both measured, not derived — I ran the two old expressions over the modified tree and they reported
`pairs 61 distinct 34`. So the old test was **green over a tree where a collected literal had
silently gone**, which is this file's own recurring failure mode arriving inside the file. The new
test fails on the same tree and names it:

    AssertionError: these baseline occurrences are no longer collected: expected [ Array(1) ] to deeply equal []
    + [ "packages/shared/src/role.test.ts: harness/architecture.md" ]

`role.test.ts` was restored; `git status` shows one modified file.

### What replaced it

**`COLLECTED_BASELINE`** — a new register beside `AFTER_A_FLOW`, holding all **61** `file: literal`
occurrences the classifier collects from the two audited suites, sorted, with a doc block stating
why it is identities and not totals. Sixty of them are AC-5's measured baseline: 67 per-file-distinct
occurrences over 37 distinct literals, less the three literals the census names and the seven
occurrences they carried (67 − 7 = 60, 37 − 3 = 34). It is a register in the same sense as
`NOT_READ`, `WALKS` and `READ_BASES` — a list a reviewer approves — which is why it lives with them
rather than inline in the test.

**The test, now `the collected set has not contracted, occurrence by occurrence`**, has three
clauses plus the directory list:

1. **Nothing has left.** `COLLECTED_BASELINE.filter(entry => !collected.has(entry))` must be empty,
   and the message names every entry that has gone. Membership is checked in one direction only, so
   an occurrence the register does not hold is an addition — which clause B above already judges on
   its merits, and which no criterion forbids. That is the finding's *"deliberately accounting for
   later additions"*, made structural rather than numeric.
2. **The register has not been trimmed to make clause 1 pass.** `length` is `61` and the distinct
   literal count is `35`, asserted over the register itself. Without this, deleting an entry is a
   silent way to satisfy the test — the same move the old floors permitted, one level in.
3. **The directory list**, extended from eight to nine (below).

Per Q-0071 — *demonstrating that a guard has a subject proves the guard fires, not that each of its
clauses does* — each clause was demonstrated firing **in isolation**, not just the test as a whole:

| forced condition | which clause fires | message |
| --- | --- | --- |
| a collected literal replaced in `role.test.ts` | 1 alone | names `packages/shared/src/role.test.ts: harness/architecture.md` |
| one register entry deleted, its literal still collected elsewhere | 2's length alone | `expected 60 to be 61` |
| one unique-literal entry replaced by a duplicate of another | 2's distinct count alone | `expected 34 to be 35` |

Before the scratch harness was removed I also asserted the register **byte-exact** against the live
scan (`[...COLLECTED_BASELINE].sort()` deep-equal to the sorted collected list) — it passes, so the
61 entries are the scan and not a transcription of it. That equality is deliberately not kept: it
would fail on the first legitimate addition, which is what the finding says to permit.

### One difference from AC-5's stated numbers, named as AC-5 requires

The tree collects **61 occurrences over 35 distinct literals**, not 60 and 34. The single addition
is `packages/shared/test/corpus.ts: docs/decisions`, and it is not mine: it arrived on the
integration branch in `0ed342f`, the split of `docs/DECISIONS.md` into a file per entry, which
landed while this ticket was in flight. Measured, not assumed — I ran the classifier over both
suites' sources as they stood at the iteration-1 implement commit `2483270`, under that commit's own
inventory, and diffed:

    now    61 pairs / 35 distinct
    before 60 pairs / 34 distinct
    added  packages/shared/test/corpus.ts: docs/decisions
    gone   (none)

So AC-5's arithmetic closes exactly at the commit it was written against, and the one difference is
an addition covered by a `WALKS` entry the same commit added (`docs/decisions`, `decisionFiles()`).
The directory list in clause 3 gains `docs/decisions` for the same reason — nine literals are now
classified as directories, and the comment's *"a checkout that had run a flow made it ten"* becomes
*"eleven"*.

The same commit explains a discrepancy in iteration 1's report worth correcting here, since this
report is read beside the diff: it said the file went 51 → 61 tests. The guard now reports **62**.
`test.each(WALKS)` expands to one test per walk, so the decisions-split walk added one; the ten
Q-0073 tests are unchanged and I added none.

---

## 3. Verification (AC-10), re-run forced in both environment rows

Re-run after this round's edits rather than carried over from iteration 1. This git worktree, `.git`
a file — the shape `integrate` runs in.

| | `pnpm turbo run lint typecheck test --force` | `npm test --prefix spike` |
| --- | --- | --- |
| **(a) `.harness/worktrees` and `.quorum/runs` present** | `21 successful, 0 cached`, 28.1 s — core 722 passed / 2 skipped (31 files, 1 skipped), shared 102 passed, five scaffolds 1 each | all 12 test files passed |
| **(b) both absent** — the `integrate`/CI shape | `21 successful, 0 cached`, 29.3 s — identical counts | all 12 test files passed |

Identical in both rows, which is the ticket's property. The guard file alone: **62 passed** in both.
The two directories were created by hand for row (a) and removed afterwards; both are gitignored, so
neither run left anything in the checkout — `git status --untracked-files=all` shows one modified
file and nothing else. `lint` and `typecheck` are inside the forced run above, so Q-0069's
type-aware rule is green over the new code.

**The fresh-clone row of AC-9 is still a derivation, unchanged from iteration 1 and labelled the
same way.** `git clone` cannot write outside this session's allowed directories and the change is
uncommitted, so a clone would test `HEAD` rather than this branch. Nothing this round touched the
classifier, so iteration 1's argument stands: a fresh clone has no untracked-unignored files, its
`--cached --others --exclude-standard` equals its tracked set, and the two were measured to classify
all 578 literal occurrences identically. If the reviewer wants it observed rather than derived, the
run is `pnpm turbo run test --force` on a clone of the integration branch.

---

## 4. Deliberately left alone

- **Everything iteration 1 shipped that the review did not fault**: the `Inventory` interface,
  `inventoryOf`, `listing`, `repositoryInventory`, the two classifying decisions, the four surviving
  loud refusals, the audit on `INVENTORY`, the `NOT_READ` and `INDIRECT_ROUTES` removals, and the ten
  Q-0073 tests. An approval is not an invitation to keep editing.
- **The AC-3 reading recorded in §4 of iteration 1's report.** It was flagged as a departure from the
  criterion's letter and the reviewer did not raise it; I have not revisited it, and the remedy it
  names — an erratum, not another round — is still the right one if a later reviewer disagrees.
- **Clauses C1–C4 and their registers**, the guard's coverage, `constants.ts` and
  `constants.test.ts`, E-1's residual limits 1 and 5, the walk-side residual, shapes (1), (3) and
  (4), and Q-0072's successors A and B.
- **`turbo.json`, both package configurations, `.github/workflows/ci.yml`, `package.json`,
  `harness/harness.yaml`, `.github/`, `harness/`, `backlog/`, `docs/`** — untouched. No documentation
  surface is named by §3 of the requirement and none needed correcting: `docs/04-architecture.md:68`
  still describes the guard accurately.

## 5. The decision this implies (AC-11) — named, not written, and unchanged

Nothing this round moved what the guard claims, so iteration 1's obligation stands exactly as it
was: the claim about a literal went from *"it names something on disk"* to *"it names something git
will hand turbo"*, and AC-11 makes the `docs/DECISIONS.md` entry a **human commit at or before the
gate**. `harness/roles/developer-generalist.md:23` forbids me to append to that file, so naming it is
the whole of my obligation. Suggested title and substance, repeated so it is not lost between rounds:

> **A guard asks git what is hashable, never the filesystem — 2026-08-28.** Membership in
> `turbo-inputs.test.ts`'s subject set is decided from `git ls-files --cached --others
> --exclude-standard`. `--others` is deliberate and the tracked set alone would be wrong: turbo
> hashes untracked-unignored files (measured). The alternative — deciding path-ness from the
> literal's role in the code — was refused by the census: existence answers *is this a path?* for
> 307 distinct literals and drops 270 of them, and re-deriving that without a syntax tree is the
> dataflow analysis Q-0072's E-1 already declined to buy. Existence used to classify is the defect;
> existence used to refuse to run over a missing subject is the rule.

## 6. Housekeeping

Four scratch tests were added to the guard during §1 and §2 — a corpus dump, a
2483270 comparison, the old floors, and the byte-exactness check — and all four were **removed**.
Their output went to `/tmp`, never into the repository. `packages/shared/src/role.test.ts` was
modified for the demonstration and restored to its committed bytes. The only change on this branch
is `packages/core/src/turbo-inputs.test.ts`.
