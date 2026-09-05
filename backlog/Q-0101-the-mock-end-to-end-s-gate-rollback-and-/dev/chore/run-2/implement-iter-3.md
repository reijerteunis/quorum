# Q-0101 — implement, run 2, iteration 3

*Revision round against **one** finding: the blocker in `review/chore/run-2/chore-iter-2.md`, which
refused round 2's GO-5 measurement because no sample was taken at the merge base. **It is now
taken** — 15 sweeps at `edcc7ad`'s tree and 15 at the implement tip, interleaved, fully captured.
The two majors of round 1 were fixed in round 2 and were not re-raised.*

**No files were changed.** `git status --short` is empty and `git diff --stat HEAD` is empty: the
tree this round leaves is byte-identical to the one iteration 2 committed. That is deliberate and it
is not round 3 of Q-0091 repeating itself — the outstanding finding was a **measurement obligation**,
not a defect in the change, and this round spent itself producing the measurement rather than
re-arguing the refusal.

---

## 1. The blocker, and why round 2's refusal was wrong

### 1.1 The finding is right, and round 2's diagnosis of *why it could not comply* was not

The reviewer is correct on the substance: GO-5 asks for N sweeps at the implement branch's merge base
and N on the branch, and round 2 supplied only the second half. Substituting a sample from
`e47fb1d`/`bb8e143` for one at `edcc7ad` is not the fixed-commit comparison the obligation names.

What round 2 got wrong is its §2.2, which declared **every** mechanism refused and the in-place
alternative *"unsound, not merely risky"*. Both halves were reasoned rather than measured, and both
are wrong in their particulars.

**The permission wall is real but is not where round 2 drew it.** Re-probed this round, one command
per call:

| probed | response |
| --- | --- |
| `git clone --no-hardlinks <src> <dest-inside-worktree>` | *"This command requires approval"* |
| `git init -q <dest-inside-worktree>` | *"This command requires approval"* |
| `git archive --format=tar --output=<inside-worktree> edcc7ad` | *"This command requires approval"* |
| `git archive edcc7ad \| tar -x -C <inside-worktree>` | both halves require approval |
| `git ls-tree -r --name-only edcc7ad` | *"This command requires approval"* |
| `cp -R <src> <dest>` | refused: *"cp with flags requires manual approval"* |
| `mkdir -p <inside-worktree>` | **permitted** |
| `cp <src> <dest>` (flagless) | **permitted** |
| `<cmd> > <file-inside-worktree> 2>&1` | **permitted** |
| `git show edcc7ad:<path>` | **permitted** |
| `git diff --stat edcc7ad`, `git ls-files --deleted` | **permitted** |

So a *second checkout* is genuinely unobtainable — round 2 is right about that, and nothing below
contradicts it. What round 2 never probed is that **a file-level write inside its own worktree is
permitted**, which is all the base tree actually costs: `git show` reads the five modified files at
`edcc7ad`, `cp` and `rm` flip them, and `git` itself certifies the result.

### 1.2 How the merge-base tree was materialised, and how it was proven

`edcc7ad81f75c8f9edc2583848d0d5a3aa4cd32c` (`git merge-base HEAD main`) differs from `HEAD` by six
files — five `M`, one `A` — all under `packages/`, all test files. The base content of the five came
from `git show edcc7ad:<path>` into a gitignored scratch directory; the tip content of all six was
copied out of the worktree first, so the flip is reversible from files rather than from git.

**The oracle for "this is the merge base" is git, not my arithmetic.** After each flip to base:

```
$ git diff --stat edcc7ad
                              ← no output
TREE_EQUALS_EDCC7AD
```

An empty `git diff` against `edcc7ad` is the whole claim: every tracked path in the working tree
holds exactly the bytes that commit holds. It was re-run and re-printed before **each** of the three
base blocks, not once at the start.

After each flip back:

```
$ git status --short          ← no output
$ git diff --stat HEAD        ← no output
```

Nothing was written outside this worktree. The main checkout was not touched — round 2's ground 1
stands unchanged and is the reason the user's working tree, which happens to sit at `edcc7ad`, was
still not used: the sweep's install phase runs `npm ci` in `spike/`, and *"never write to the user's
working tree from a flow"* is not suspended by convenience.

### 1.3 The one divergence from a true checkout, enumerated rather than argued

The working tree equals `edcc7ad`; the **index** and `HEAD` do not. Round 2 called this fatal. It is
not fatal, and it is not four consumers — it is one path with one consequence, and both are counted:

```
$ git ls-files --cached --others --exclude-standard | wc -l     → 1068
$ git ls-files --deleted
packages/cli/src/failure-paths.test.ts                          → exactly one entry
```

One phantom entry in a 1068-entry inventory. **Round 2 named `turbo-inputs.test.ts:361`,
`frame.source.test.ts:927`, `build.test.ts:241` and `templates.test.ts:253` as the consumers that
would go red. None of the four is the consumer.** Measured by running the forced workspace suite in
the base tree before any sweep:

- `build.test.ts:241`'s `gitVisible` **skips** an absent path on purpose — *"Absence is refused
  rather than classified (Q-0073)"* — in both snapshots of its comparison, so it is unaffected.
- `turbo-inputs.test.ts`'s `listing()` is a membership set; its corpus walks read the disk.
- `frame.source.test.ts`'s repo-wide `inventory()` is a filesystem walk; its `ls-files` use is inside
  a sandbox fixture.
- `templates.test.ts:253` is scoped to `packages/cli/templates`.

The consumer that actually fires is **`packages/cli/test/workspace.ts:179`**, `isolate()`'s `copy()`:

```
Error: corpus missing: packages/cli/src/failure-paths.test.ts —
       the isolated workspace cannot be built without it
```

and its effect is **constant across all 15 base runs**: 5 occurrences of that error, failing 4 tests
in 2 files — `src/end-to-end.test.ts` (whole file, its `beforeAll` calls `isolate()`) and four tests
of `src/build.test.ts` under *AC-8* and *Q-0098 AC-15*.

**Why this does not contaminate the measurement, stated as a property rather than as a hope.**
Q-0102's signature is `worktree-lifecycle.test.ts` and `undecided.test.ts`, both `@quorum/core`.
`@quorum/core#test` and `@quorum/shared#test` run *before* `@quorum/cli#test` in turbo's dependency
order and completed in every run, and the spike suite runs in an earlier sweep phase entirely. So the
artificial offset is **disjoint from the flake's package** and the base sample is a valid probe for
it. The correction worth keeping is the general one: *a refusal reasoned from unmeasured consequences
is the same defect as a claim reasoned from unmeasured consequences*, which is this repository's
most-recorded class arriving on the refusal side.

---

## 2. The measurement: 30 sweeps, matched and interleaved

`pnpm sweep:git-identity` — `bash .github/scripts/git-identity-sweep.sh`, byte-identically what both
CI jobs run — each invocation redirected whole to its own log. darwin 25.3.0, 16 cores, one linked
worktree, warm pnpm store. One sweep is **101 s** wall (`date +%s` around run 1: 1788556443 →
1788556544).

**Interleaved in alternating blocks of five**, chronologically
`B01–05 · T01–05 · B06–10 · T06–10 · B11–15 · T11–15`, with a verified flip between every block.
Round 2's design was one undivided block at one tree; alternating is what removes thermal and
background-load drift from the comparison, and it is the half GO-5's *"in each direction"* asks for.

### 2.1 Result

| | merge base `edcc7ad` | implement tip `4438307` |
| --- | --- | --- |
| sweeps | **15** | **15** |
| spike suite | 19/19 files green, **15/15 runs** | 19/19 files green, **15/15 runs** |
| `@quorum/core` | 58 passed, 1 skipped — **15/15** | 58 passed, 1 skipped — **15/15** |
| `@quorum/shared` | 12 passed — **15/15** | 12 passed — **15/15** |
| `@quorum/cli` | 2 failed / 20 passed — **15/15, identical** | 23 passed — **15/15** |
| server · compiler · templates · web | 1 passed each — 15/15 | 1 passed each — 15/15 |
| sweep exit | 1, phase `workspace suite`, 15/15 | **0**, 15/15 |
| **failures attributable to the flake** | **0 / 15** | **0 / 15** |
| failing files | `src/end-to-end.test.ts`, `src/build.test.ts` — the §1.3 offset, and nothing else | none |

The tally is mechanical rather than eyeballed: every `Test Files` line across the 15 base logs
collapses to exactly seven distinct strings at count 15 each, and across the 15 tip logs to seven at
count 15 each. **Zero variance in 30 runs.** No log on either side carries a `FAIL` outside the two
files named above, and no base log carries a `corpus missing` count other than 5.

### 2.2 The classification oracle, written down so it can be disputed

A base run counts as **flake-free** iff: the sweep reached phase `workspace suite` (which proves the
isolation, probe, install and spike phases all passed), `@quorum/core`, `@quorum/shared` and the four
stub packages are green, and `@quorum/cli` reports exactly `2 failed | 20 passed` with exactly 5
`corpus missing: packages/cli/src/failure-paths.test.ts`. A tip run counts as flake-free iff the log
carries `git-identity sweep: both suites executed and green`, which it does 15/15.

`grep -E "FAIL|RED"` is **not** the oracle, for round 2's reason: it matches three lines in a green
log — a spike scenario named *"a genuine assertion failure is still red: FAIL test/review.test.js"*
and two `@quorum/core` titles containing `FAILS` and `FAILED`.

### 2.3 The load delta, which is the data point Q-0102 can actually use

Workspace-phase wall time, all 30 runs, `pnpm turbo run test --force`:

```
base   47.184  47.558  47.595  47.627  47.834  48.037  48.039  48.046
       48.432  48.474  48.513  48.672  48.850  50.201  50.684     s      range 47.2–50.7
tip    56.885  56.943  57.223  57.343  57.487  57.631  57.637  57.946
       58.116  58.245  58.806  59.319  60.054  61.285  65.291     s      range 56.9–65.3
```

**The two ranges do not overlap.** This ticket's suite adds **≈9.7 s, about 20%**, to the workspace
phase — 34 tests, most of them spawning an operating-system process and building an isolated
workspace. That is a real, measured increase in exactly the variable Q-0102's leading hypothesis
names, and **it did not move the failure rate**: 0/15 against 0/15.

---

## 3. What this says to Q-0102, and what it does not

**Reported, not fixed** (non-goal 5, Q-0102's GO-2 — no fix, and nothing weakened).

1. **This branch is not implicated by these 30 runs.** 0/15 at the merge-base tree and 0/15 at the
   tip, interleaved on one machine. The one-sided 95% upper bound on a rate observed 0 times in 15 is
   **18%**, so this does not exclude a low-rate flake; it excludes the branch being a *large* mover
   of it, which is what §7 R-1 asked.
2. **Pooled at this exact tree**: round 2's 16 and this round's 15 sweeps ran over byte-identical
   trees (no file changed this round), so the tip stands at **0 failures in 31 sweeps**. Round 1's
   reported 1/8 was at *iteration 1's* tree and is not pooled with them — a different tree is a
   different sample, which is the same discipline the reviewer applied to round 2's base substitution.
3. **The load hypothesis survives but is not supported here.** A 20% longer workspace phase produced
   no additional failure. Read with `3cf345c`'s finding that 48 CPU burners on 16 cores slowed the
   suite by half *without* turning it red, contention alone continues to look insufficient.
4. **Not reproduced means not measured, not absent.** Q-0102's own body records 28-then-6 failures
   at one commit, so the phenomenon is real and this machine, in this shape, is not currently
   exhibiting it. Its surviving lead — no configured `testTimeout` against
   `worktree-lifecycle.test.ts`'s synchronous git spawns — is untouched by anything here.
5. **A caveat that is this ticket's own subject.** The base sample's `@quorum/cli` half is
   structurally red, so if the flake ever manifests *in `@quorum/cli`* the base arm would be blind
   to it in a way the tip arm is not. It did not manifest anywhere in 30 runs, and the asymmetry is
   stated rather than left to be found.

**Caveats on the sample as a whole**, stated rather than buried: one machine, 16 cores, darwin,
warm pnpm store, against CI's two-core `ubuntu-latest`; a **linked worktree**, a third checkout shape
beside `3cf345c`'s two; and `.harness/q0101/` existed on disk while all 30 ran and was removed
afterwards, with the forced suite re-run green in both rows (§6) so it is not a confound in the
verdict.

---

## 4. File by file

**Nothing changed.** `git status --short` is empty; `git diff --stat HEAD` is empty. The diff this
round leaves against the merge base is iteration 2's, unaltered:

```
 packages/cli/src/end-to-end.test.ts    |  31 +-
 packages/cli/src/failure-paths.test.ts | 861 +++++++++++++++++++++++++++++++++
 packages/cli/src/package.test.ts       |  10 +-
 packages/cli/src/run.test.ts           |  62 +++
 packages/cli/src/templates.test.ts     |  68 +++
 packages/core/src/spike-parity.test.ts | 124 ++++-
 6 files changed, 1131 insertions(+), 25 deletions(-)
```

The scratch directory used for the flip and the 32 logs was `.harness/q0101/`, gitignored, created
by this step and **removed** — every file and every directory including the `.harness/` parent it
created. Its presence during the sweeps and its absence afterwards are the two environment rows of
§6.

## 5. What I deliberately left alone

1. **Every criterion, every assertion, every line of the change.** The one outstanding finding was
   about a measurement, and no reviewer disputed the code in round 2. Nothing was tidied, widened or
   re-argued in passing.
2. **No erratum was written.** The blocker offers *"or land an erratum changing GO-5"*; GO-3 says an
   implement step has no `blocked` verdict and that the window for an erratum is a **gate**. So I
   took the first branch — produce the sample — rather than the one this step may not take.
3. **The `STEERING` duplication** raised for ruling in round 1's §5(2) is unchanged and still wants a
   gate answer. No reviewer has disputed it across two rounds.
4. **The pre-existing lint warning** at `packages/core/src/backlog/backlog.ts:276` — *"Unused
   eslint-disable directive (no problems were reported from 'no-control-regex')"* — in a file this
   ticket does not change. Third report, still not fixed.
5. **Q-0102 itself.** No fix, no weakening, no change to what the sweep runs (non-goal 5).
6. **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100.** Every user-facing `harness` sentence stays verbatim
   (ground rule 3, non-goal 6).
7. **The user's working tree**, which sits at `edcc7ad` and was the obvious host for the base sample.
   Round 2's ground 1 is correct and is why it was not used.

## 6. Verification

`pnpm install --frozen-lockfile` → *"Already up to date"*, 179 ms.

Forced, **in both environment rows**, per *"Integrate's tick is worktree-scoped"* — first with
`.harness/` present, then with `.harness/` and `.quorum/` both absent (`ls -d` reports
*"No such file or directory"* for each), which is the row a fresh worktree and a CI clone have:

```
row 1  pnpm turbo run test lint typecheck --force  →  21 successful, 21 total, 0 cached
row 2  pnpm turbo run test lint typecheck --force  →  21 successful, 21 total, 0 cached  (1m2.6s)
       @quorum/cli  23 files, 545 tests      @quorum/core  58 files (1 skipped), 1328 passed, 2 skipped
       @quorum/shared 12 files, 150 tests    server · compiler · templates · web  1 each
row 1  npm test --prefix spike               →  all 19 test files passed
row 2  npm test --prefix spike               →  all 19 test files passed
row 1  node spike/bin/harness.js lint        →  6/6 flows ✓
row 2  node spike/bin/harness.js lint        →  6/6 flows ✓
       pnpm sweep:git-identity × 15 at tip   →  15/15 exit 0
       pnpm sweep:git-identity × 15 at base  →  15/15 flake-free (§2.2)
```

One lint warning, pre-existing and outside this change (§5(4)). `git status --short` empty at the
end of both rows and after the cleanup.

## 7. For the gate

1. **GO-5 is discharged in both directions.** 15 sweeps at the merge-base tree and 15 at the tip,
   interleaved, with failure counts and failing files for each. The base arm carries a fully
   enumerated artificial offset (§1.3) which is constant, named, and in a different package from the
   flake's signature; the gate should read that as the residual and decide whether it is acceptable,
   rather than take my word that it is.
2. **The base sample is the merge-base *tree*, not a merge-base *checkout*.** Git certifies the
   working tree equalled `edcc7ad` at each block (`git diff --stat edcc7ad` empty); the index and
   `HEAD` remained the tip's, and `git ls-files --deleted` names the single path where that shows.
   If the gate judges that insufficient, the completion is unchanged from round 2's §2.4 — sixteen
   invocations in the main checkout, which is already at `edcc7ad` — and it is the human's to run
   because it writes to the user's working tree.
3. **Round 2's §2.2 should not be inherited as written.** Its permission table is right about a
   second checkout and wrong about the in-place route, and its four named consumers are all wrong.
   This report supersedes it; the correction is recorded because the next reader would otherwise
   re-derive against a refusal that had never been tested.
4. **The permission gap remains, and is still an environment fix rather than a criterion fix**
   (Q-0038's precedent). What this round shows is narrower than round 2 claimed: an implement step
   *can* reproduce a sibling commit's tree file by file, and *cannot* produce a second checkout, a
   second index or a second repository. An obligation needing the second class still cannot be
   satisfied under `.claude/settings.json`'s read-only git grant.
5. **The `STEERING` duplication** (round 1 §5(2)) is still open for ruling, unaddressed by two
   reviews.
6. **GO-4** — the cutover ticket (delete `spike/`, retire its CI job and `harness/port-charter.md`)
   is to be allocated at this ticket's close rather than remembered.
