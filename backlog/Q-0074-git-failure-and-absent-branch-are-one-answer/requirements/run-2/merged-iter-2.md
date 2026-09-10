# Q-0074 — A failed git probe is read as a proven negative

*Merged requirement, run 2, iteration 2. Every count, line number and classification below was
re-derived against the working tree at this iteration — not transcribed from the ticket body, which
asks in as many words not to trust its own table, not taken from either candidate, and not carried
from iteration 1's merge. Where iteration 1 and the tree disagree, the tree is recorded.*

**Verdict: ready.** Fourteen criteria, scoped to the `fanout/` half. Five gate obligations in §10,
of which GO-1 is a hard precondition for the chore run. Iteration 1 returned `needs-input` on four
blockers; §12 records what moved and why, and nothing moved on the merits.

---

## 0. What the measurement changed

The ticket instructs that the census is a task of the run rather than a number to inherit. It was
run at iteration 1, and re-run against the tree at iteration 2. Eight results change the shape of
the work, and **two are new to this iteration**.

**0.1 The census is 24 sites — 16 in `git.ts`, 8 in `fanout.ts` — of which 13 collapse.** Verified
by enumerating both files. The ticket body names seven. Two of the unnamed sites are more severe
than anything it carries:

- **`containment`'s branch list (`git.ts:345`)** — `safe(...) ?? ''` yields an empty `Set`, and
  `stateOf`'s **first** clause is `if (!branches.has(branch)) return { state: 'indeterminate',
  reason: 'no branch' }`. So one failed `for-each-ref` makes `quorum board` answer `no branch` for
  **every ticket in the backlog**, and `docs/GLOSSARY.md` defines that state as *"the ticket naming
  a branch that does not exist, so git was never asked"*. Git was asked, and failed. The comment
  directly above that clause (Q-0070) argues at length that this state must not be confused with
  *no question was asked* — which is precisely what the line beneath it does when the probe fails.
  It is the only measured site that reaches an adopter's screen, and it is the **`git/` half's**.
- **`commitAll`'s dirty probe (`fanout.ts:280`)** — `safe(...) ?? ''` yields an empty `dirty` list,
  so `backlog/` reads **clean**: the revert does not run, `onDiscard` does not fire, and
  `git add -A` two lines later commits the agent's edit onto the step branch. That is the incident
  this function's own JSDoc records — an architect rewriting a ticket's frontmatter on its branch,
  resetting `iterations` and deleting three history entries with their costs, *"only a merge
  conflict caught it, which is luck rather than design"*. The function written to stop that stops
  nothing when its first probe fails, and reports nothing.

**0.2 NEW — `composite.ts:246` is the most severe consequence in either half, and no earlier
account states it.** The integrate step builds its merge list and then filters it:

```
246:  branches = branches.filter((branch) => branchExists(context.repoDir, branch));
…
285:  for (const branch of branches) { const merged = mergeInto(dir, branch); … }
```

A `branchExists` that **failed** removes a real branch from `branches`, so the merge loop never
sees it. Nothing is pushed to `conflicts`, no `✗` line reaches the integration notes, `testsOk`
stays `true`, and the step reports **`tests=ok` over a tree that is missing a task's work**. The
suite then passes because the failing task's code is absent rather than because it was fixed. Its
sibling at `:266` — `if (base && base !== into && branchExists(context.repoDir, base))` — skips the
base sync on a failed probe, reintroducing the Q-0004 defect the comment three lines above it
exists to prevent (*"a ticket open for more than a day otherwise integrates against the base it was
cut from, and work landed on the base meanwhile looks like the ticket reverting it"*).
`composite.ts:17` already names the class — *"the five branch-existence reads in this file cannot
tell an absent branch from a git that failed, and filter identically either way. Q-0074 owns it"* —
and the word **filter** is the one nobody followed through. This is AC-8, and it is the strongest
argument that the `fanout/` half is the one to run first.

**0.3 NEW — the four pins cite `Q-0048` and `Q-0053`, never `Q-0074`, and that is this ticket's own
defect class sitting inside its own instrument.** Measured:

| pin | its `Why:` line cites |
| --- | --- |
| `fanout.test.ts:250` | `Why: preserved defect, see Q-0048 AC-6` |
| `fanout.test.ts:333` | `Why: preserved defect, see Q-0048 AC-12 defect 4` |
| `fanout.test.ts:353` | `Why: preserved defect, see Q-0048 AC-12` |
| `fanout.test.ts:407` | `Why: preserved defect, see Q-0048 AC-12` |
| `composite.ts:17` | `Why: preserved defect, see Q-0053 AC-14(3)` — *and names Q-0074 as owner* |
| `composite.ts:20` | `Why: preserved defect, see Q-0053 AC-14(4)` |
| `engine.ts:268` | `Why: preserved defect, see Q-0050 AC-12` |
| `lifecycle.ts:137` | `Why: preserved defect, see Q-0050 AC-12` |

`grep -rn Q-0074 packages/core/src` returns **exactly one line**, `composite.ts:17`. An implementer
told to *"remove the `Why: preserved defect` line the fix must remove with it"* who greps for
`Q-0074` finds nothing in `fanout.test.ts`, `engine.ts` or `lifecycle.ts` and concludes the lines
are not there — **a failed search read as proven absence**, which is this ticket's subject, and the
identical move Q-0068's merge triage made three days before this run. AC-1 therefore names the
citation tokens explicitly rather than the ticket id.

**0.4 `mergeFailure` cannot print *"git reported no reason"* on a content conflict.** The ticket
body's third bullet states a consequence that does not follow. `steps.ts:98` is
`if (merge?.conflicts?.length) return \`conflicts: ${merge.conflicts.join(', ')}\`` — tested
**first** — and `fanout.test.ts:396` pins `result.conflicts` as `['f.txt']` on exactly that case.
The empty `error` is real and pinned at `:406`; what is false is that anything reads it there.
Every consumer routes through `mergeFailure`, so the empty error is **masked whenever `conflicts`
is non-empty** and bites only when compounded with the conflict probe at `fanout.ts:316` failing
too. That lowers this defect's severity and raises site 316's, which the body does not mention at
all. **See OQ-5: measure reachability before writing AC-12's fixture.**

**0.5 The consumer count is ten, not eight, and two of the ten write a false sentence into a
durable record.** `branchExists` has six call sites (`composite.ts:96, 97, 246, 266`;
`steps.ts:202, 212`) and `branchHead` four (`engine.ts:141, 271`; `composite.ts:253`;
`lifecycle.ts:138` through the injected `readBranchHead`, wired at `engine.ts:304`). The two that
are not control flow:

- `engine.ts:141` (`reportUndecided`) renders `${branch} does not exist` and appends
  `kept-at=none` to `runs.log`. An `undecided` run is by definition one nobody was watching, and
  `runs.log` is what is read afterwards.
- `composite.ts:253` writes `Evidence: \`<into>\` at (new)` into the integration notes.

Both are the push-lag rule broken in the other direction: not silence given a second meaning, but
an unanswerable question rendered as an answer.

**0.6 The rollback matrix already holds the two rows that go wrong, and reads them as correct.**
`lifecycle.test.ts:181` is a truth table titled *"rollback requires all four guards and never
touches a neighbouring task branch"*. Two of its eight rows are the defect:

```
[false, 'failed', null,       'bbbbbbbb', 0],   // start head unreadable → no rollback
[false, 'failed', 'aaaaaaaa', null,       0],   // current head unreadable → no rollback
```

Under two values those rows are right: `null` means *the branch is not there* and there is nothing
to roll back. Under three they are ambiguous, and the second is the contamination — a `failed` run
whose current head could not be read keeps whatever `integrate` merged. **The guard is blind by
arity, not by oversight**, which is a better description than *"the truthiness guard is still
there"*, and it is why the fix is a table widening rather than a new test.

**0.7 The answer is already written in-tree, and needs no new vocabulary.** `pushLag`
(`git.ts:406–447`) discriminates at **all four** of its own `safe()` sites and `containment:360`
does the same: `if (x == null) return { state: 'indeterminate', reason: 'git failed' }`.
`git.source.test.ts:133` pins `CONTAINMENT_REASONS` as `['missing ref', 'shallow clone', 'git
failed', 'no branch']`, so `'git failed'` is already a member. `git.ts` also already holds the
machinery the third answer needs, module-private: `errorProperty` accepting `'status'` (`:27`),
`exitStatus` (`:37`), `GIT_FATAL` (`:48`), and `WorkTreeProbe` as a three-answer type (`:50`).
**`fanout.ts` has none of it** — its own `errorProperty` (`:211`) accepts only
`'stderr' | 'message'`. So the `git/` half is code failing to reach a state its own vocabulary
declares, and the `fanout/` half needs one reader it does not have (OQ-6).

**0.8 The instrument already exists and needs no building.** `installGitShim` is
`packages/core/test/repo.ts:116` and is already used **at two of the four pin sites** —
`fanout.test.ts:253` (`case " $* " in *rev-parse*) exit 3`) and `:338`
(`case " $* " in *" checkout "*) exit 3`). Every criterion below is reachable with a fixture the
suite already builds. That converts R-3 from *build an instrument* into *state its premise*.

**0.9 What held.** `safe()` is declared exactly twice, byte for byte, at `fanout.ts:206–208` and
`git.ts:19–21`; nothing else under `packages/*/src` carries a third (`constants.ts:98`'s `safeId`
is an unrelated identifier). The four pins are unmoved at `fanout.test.ts:249, 332, 352, 406`. The
start-of-run read is `engine.ts:271` and the two rollback guards are `lifecycle.ts:136` and `:139`.
`docs/decisions/062-what-a-runs-event-stream-carries.md:96` cites **Q-0074** by name, and
`composite.ts:17` says *"Q-0074 owns it"*. `docs/decisions/` ends at 087, so the entry is 088.
`fanout.source.test.ts:45` pins the folder as exactly two files and `:48` as exactly twelve
exports; `git.source.test.ts:40` pins its exports with `toEqual` and `:52` refuses the historical
set with `.not.toEqual`.

---

## 1. The census

Measured by reading each call site's consumer. The classification predicate is mechanical and is
the one the fix turns on: **does the call site distinguish `null` from a legitimate value, or does
it merge the two into one claim?** The disposition vocabulary is three names rather than two —
*distinguish*, *propagate*, *best-effort with a recorded reason* — because a two-way
collapses/keeps split hides the difference between a site that already discriminates and one that
deliberately swallows.

`packages/core/src/git/git.ts` — 16 sites:

| # | line | in | what a failure becomes | disposition |
| --- | --- | --- | --- | --- |
| 1 | 71 | `repositoryAt` | `!= null` → `false`, returned as a **boolean**, so no caller can tell | **collapses** |
| 2 | 139 | `ensureWorktree` branch probe | branch read as absent → `worktree add -b` → git throws | collapses, **fails loudly** |
| 3 | 143 | `ensureWorktree` base probe | base ignored → **worktree cut from `HEAD`** | **collapses, silent** |
| 4 | 157 | `removeWorktree` `branch -D` | discarded | best-effort |
| 5 | 174 | `mergeBase` | `null`; its JSDoc says it deliberately does not tell them apart | documented |
| 6 | 197 | `currentBranch` | `null`, as does `''` | documented |
| 7 | 213 | `configuredUser` | `null` → caller writes `unknown` | documented (Q-0112) |
| 8 | 275 | `shortSha` | `null`, while its JSDoc says it **doubles as the engine's endpoint existence test** | **collapses** |
| 9 | 298 | `emptyRangeEvidence` left tree | `sameTree: null` | distinguishes |
| 10 | 299 | `emptyRangeEvidence` right tree | `sameTree: null` | distinguishes |
| 11 | 342 | `containment` base probe | `!= null` → `false` → renders `missing ref` | **collapses** |
| 12 | 345 | `containment` branch list | `?? ''` → empty set → **every ticket renders `no branch`** | **collapses** |
| 13 | 360 | `containment` ahead | `== null` → `git failed` | distinguishes |
| 14 | 416 | `pushLag` remotes | `== null` → `git failed` | distinguishes |
| 15 | 426 | `pushLag` tracking | `== null` → `git failed` | distinguishes |
| 16 | 441 | `pushLag` ahead | `== null` → `git failed` | distinguishes |

`packages/core/src/fanout/fanout.ts` — 8 sites:

| # | line | in | what a failure becomes | disposition |
| --- | --- | --- | --- | --- |
| 17 | 224 | `branchExists` | `Boolean(null)` → `false` | **collapses** — pin `:249` |
| 18 | 239 | `branchHead` | `null` | **collapses** — pin `:249` |
| 19 | 256 | `resetBranchTo` clean | discarded, after an unguarded hard reset that throws | best-effort — NG-4 |
| 20 | 280 | `commitAll` status probe | `?? ''` → `backlog/` reads **clean**: no revert, no `onDiscard` | **collapses** |
| 21 | 283 | `commitAll` checkout | ignored | **collapses** — pin `:332` |
| 22 | 284 | `commitAll` clean | ignored | **collapses** — pin `:332` |
| 23 | 316 | `mergeInto` conflict probe | `?? ''` → no conflicts | **collapses** |
| 24 | 317 | `mergeInto` `merge --abort` | ignored → **merge left in progress** against a JSDoc promising *"leave the worktree clean either way"* | **collapses** |

**Thirteen collapse, eleven do not.** `configuredUser` (row 7) is the body's proposed worked
example and the census confirms it: *git could not run* and *git has no `user.name`* both honestly
mean **nobody said**, and the caller renders that as `unknown` under *"A ticket's owner is
supplied, never guessed"* (2026-09-08). It differs from `branchHead` in the one respect that
generalises — **the two inputs it merges are indistinguishable to the caller's question**, where a
branch that is absent and a branch that could not be read lead the caller to different actions.

That is the rule the census yields and it belongs in the entry: **`safe()` is correct wherever the
caller's question cannot tell the two inputs apart, and wrong wherever the caller acts differently
on them. The primitive is not the defect; a caller that merges an unanswerable probe into a
positive claim is.**

**The census must not ship as prose, and no criterion may depend on its total.** It rotted in one
day: the merge triage counted 23 on 2026-09-07 and Q-0112 added `git.ts:213` on 2026-09-08.
`backlog.source.test.ts:164–170` already holds the instrument — a register of identities that fails
on an unclassified addition, whose own comment names *"the shape Q-0074 is open on — one primitive
declared twice, with nobody's attention on either copy"*. AC-2 lands the census in that shape and
asserts over classifications rather than over a count.

---

## 2. Problem

**`maintainer` — the run keeps a merge it was supposed to undo.** A run that fails puts the ticket
branch back where it found it, so the next stage measures its red phase against a tree that does
not already hold the implementation. It reads the branch head twice — at run start
(`engine.ts:271`) and at rollback (`lifecycle.ts:138`). Both are `branchHead`, which answers `null`
for *the branch is not there* and `null` for *git could not answer*. A failure at either end makes
the rollback skip itself through a truthiness guard, keep `integrate`'s merge, and **say nothing at
all** — no warning, no `runs.log` line, no manifest field.

**`maintainer` — `integrate` reports green over work it never merged.** `composite.ts:246` filters
the merge list through `branchExists`, so a failed probe silently removes a task branch. The suite
then runs against a tree missing that task's code and can pass *because* the work is absent. That
is the one green tick the fan-out exists to earn, awarded for the wrong reason, with no `✗` in the
integration notes to read afterwards.

**`maintainer` — the backlog stops being the engine's.** `commitAll` reverts an agent's edits under
`backlog/` before committing. Where its status probe cannot answer, the directory reads clean, the
revert is skipped and `git add -A` commits the edit. Its own JSDoc records the incident that
motivated the function, caught only by a merge conflict.

**`adopter` — the first command lies.** `quorum board` is among the first commands a stranger runs.
One failed `for-each-ref` tells them every ticket names a branch that does not exist — a state the
glossary defines as *"git was never asked"* — rather than admitting it could not answer. The
vocabulary for admitting it (`git failed`) already exists and the code cannot reach it. *(The
`git/` half's, §6.1.)*

**`contributor` — the comments teach the opposite of the code.** `repositoryAt`'s JSDoc argues that
`--resolve-git-dir` is *"the only probe measured here that answers while the repository is
unopenable … which is precisely why it can discriminate between them and absence"*, and the next
line throws that discrimination away. Meanwhile the four pins that record this ticket's defects
cite `Q-0048` and `Q-0053`, so a search for `Q-0074` finds one line in the whole of
`packages/core/src` — and a reader who searches and stops has committed the ticket's own defect.

**Why it stops being latent.** A run reaching this code has already spawned git several times, so
today the probability is low and the observer is a human at a terminal. M3 removes the observer: a
server hosts these functions, surfaces their answers over HTTP, and runs flows nobody is watching.
The board defect is not latent now.

---

## 3. User stories

- As a **`maintainer`**, when a run fails and a branch head cannot be read, I want the run to tell
  me the ticket branch may still hold `integrate`'s merge, so that I do not measure the next stage
  against a contaminated tree believing nothing happened. *(CLI, `core`)*
- As a **`maintainer`**, when a branch probe fails during `integrate`, I want the step to stop or
  say so rather than quietly merging a shorter list, so that a green suite is evidence about the
  work and not about its absence. *(`core`)*
- As a **`maintainer`**, when `commitAll` cannot read `backlog/`'s status, I want it to refuse
  rather than commit an agent's edit to a ticket's frontmatter, so that the engine keeps owning the
  backlog. *(`core`)*
- As an **`adopter`**, when a git probe fails, I want the diagnostic to name the repository, the
  ref and git's own failure detail, and to say nothing that implies the ref is absent, so that I
  can recover without understanding Quorum's internals. *(CLI)*
- As a **`contributor`**, I want one written rule for what a caller does with *could not answer*,
  and a register that fails when a new `safe()` site is added without classifying it, so that the
  census is not re-derived by hand every time somebody adds a git call. *(`core`, `harness/`)*

---

## 4. Acceptance criteria

**Fourteen, scoped to the `fanout/` half.** AC-2 and AC-3 are the shared artifacts: they cover both
modules and land **once**, with this ticket. The `git/` half's criteria are written out in full in
§6.1 rather than referenced, because a deferred obligation dies unless it is written into a
successor's body.

**AC-1 — the ruling is cited, never transcribed, and the citation tokens are named rather than
inferred.** Every behaviour below traces to the decision entry GO-1 lands. No source file restates
its reasoning: each site that deliberately retains `safe()` carries **one line** naming the
authority, per `.claude/rules/engineering.md`. **The authority lines this ticket removes cite
`Q-0048 AC-6`, `Q-0048 AC-12` (three of them), `Q-0053 AC-14(3)`, `Q-0053 AC-14(4)` and
`Q-0050 AC-12` — not `Q-0074`**, which appears exactly once in `packages/core/src`, at
`composite.ts:17`. A criterion, comment or report that tells a reader to find these lines by their
ticket id is instructing the ticket's own defect. *Test:* a source scan asserting that no file
under `packages/core/src/{git,fanout,engine}/` contains a sentence of the entry's body; that every
site AC-2 classifies as retaining `safe()` carries a one-line citation; and that the
preserved-defect lines this change removes are identified by their **quoted citation token**, with
the scan shown to have a subject — its needle must match something today, which is Q-0111's lesson,
where the first needle matched nothing at all including itself.

**AC-2 — the census is an executable register, not a table in a document.** A test enumerates every
`safe()` call site under `packages/core/src` **keyed from the source**, and requires each to carry
one of three dispositions — `distinguish`, `propagate` or `best-effort` — and a one-sentence
reason. An unclassified site **fails**. *Test:* adding a 25th `safe()` call to either module fails
by name; deleting a classified site fails; the disposition is recomputed from each site's own text
so a hand edit cannot contradict the tree. **No assertion reads a total**, which is what makes the
register survive the next `git.ts` addition — 23 on 2026-09-07, 24 on 2026-09-08. Shown red by
mutation with distinct signatures, not read.

**AC-3 — `safe()` is declared twice and a third is a visible act.** The two declarations are
registered by identity, each with the reason its module keeps its own, in the `REALPATH_SITES`
shape at `backlog.source.test.ts:164`. *Test:* a third declaration anywhere under `packages/*/src`
fails; the register is an identity map and not a count (Q-0073); `constants.ts:98`'s unrelated
`safeId` is shown not to satisfy it. Not unified into one shared helper — NG-1.

**AC-4 — `branchExists` and `branchHead` each distinguish three answers.** *the ref is there*, *the
ref is not there*, and *the probe could not answer*, the third never collapsed into either other.
*Test:* pin `fanout.test.ts:249` — *"a git that FAILS returns the same negative as an absent
branch — preserved, not endorsed"* — is **rewritten in place**, both of its assertions, to assert
the discrimination it currently pins as absent; its `Why: preserved defect, see Q-0048 AC-6` line
goes with it. Under `installGitShim('case " $* " in *rev-parse*) exit 3 ;; esac')` each returns the
unanswerable answer; against a real absent branch each returns the negative; the two are not equal.

**AC-5 — all ten consumers answer for themselves, and none tests the result for truthiness alone.**
`composite.ts:96, 97, 246, 253, 266`; `steps.ts:202, 212`; `engine.ts:141, 271`; `lifecycle.ts:138`
(injected at `engine.ts:304`). No consumer may reach the unanswerable case and emit nothing.
*Test:* a register of the ten sites naming the behaviour each takes, keyed from source so an
eleventh consumer fails until classified.

**AC-6 — the rollback does not skip itself silently, and both guards are covered independently.**
`lifecycle.test.ts:181`'s eight-row matrix gains rows for an unreadable start head and an
unreadable current head **separately** — a fix that widens `branchHead`'s return type closes `:136`
and leaves `:139` testing `string | null` for truthiness. **Where either read is unanswerable the
run does not reset, emits a `warn`, and appends a `runs.log` line naming the condition and the
branch**, which is this requirement's stated position on OQ-2 rather than a question left for an
implementer: the run has already failed, so there is nothing left to stop, and what is available is
to keep the branch and say it may hold `integrate`'s merge. Resetting is impossible for the
start-head case — there is no sha to reset **to** — and unverifiable for the current-head case.
**Silence keeps exactly its present meaning — *nothing needed rolling back* — and never acquires a
second one**, which is *"The board reports push lag, and never a CI conclusion"* (2026-09-06)
holding at a fourth subject. *Test:* the widened matrix, both new rows shown red against today's
code; the existing eight rows unchanged in verdict, including Q-0040's `undecided` row; the
`rolled-back` token still absent from an undecided run's log.

**AC-7 — `reportUndecided` never says a branch does not exist when it could not tell.**
`engine.ts:141`'s `where` clause (`${branch} does not exist`) and its `kept-at=none` field each
gain a third rendering. *Test:* the shim forces the read to fail; neither the emitted warning nor
the `runs.log` line contains `does not exist` or `kept-at=none`, and neither says or implies the
branch is absent. `rollback=none` and the absence of `rolled-back` are unchanged (Q-0040 AC-5).

**AC-8 — `integrate` never silently drops a branch it was asked to merge, and never silently skips
the base sync.** Where `branchExists` cannot answer at `composite.ts:246`, the branch is not
removed from the merge list as though absent; where it cannot answer at `:266`, the base sync is
not skipped as though the base were absent. In both cases the step says so — in the integration
notes it writes and in the event it emits — and the run does not report `tests=ok` over a list it
silently shortened. *Test:* the shim fails `rev-parse` for one declared branch; today the merge
loop runs over a shorter list, the notes carry no `✗` and the step reports success — demonstrated
red first. `composite.ts:17`'s authority line moves or goes with the fix.

**AC-9 — `commitAll` refuses rather than committing over an unread `backlog/`.** Where the status
probe (`fanout.ts:280`) cannot answer, `commitAll` does not proceed to `git add -A`, and the caller
is told with git's own failure detail. *Test:* the shim fails `status`; a ticket edit present in
the worktree is **not** committed. Demonstrated against today's code, where it is. The refusal is
reachable **only** where the probe could not answer and never where `backlog/` is legitimately
clean — the two are one character apart in today's `?? ''` (R-6).

**AC-10 — a revert that failed is not reported as a discard.** Where either half of the revert
(`fanout.ts:283`, `:284`) fails, `onDiscard` does not claim a discard that did not happen and the
failure reaches the caller. *Test:* pin `fanout.test.ts:332` is **rewritten** — it currently
asserts the edit is committed anyway (`expect(files, 'and the edit is committed anyway')`) and must
assert the opposite; its `Why: preserved defect, see Q-0048 AC-12 defect 4` line goes with it. The
shim fails `checkout`; the edit is still on disk **and** nothing claims it was discarded.

**AC-11 — the first reported path keeps its first character.** `fanout.ts:205`'s module-level
`.trim()` strips the leading status column from line one of `status --porcelain`, and `.slice(3)`
at `:281` then eats a path character — the mechanism the pin's own comment already states. *Test:*
pin `fanout.test.ts:352` is rewritten from `['acklog/T-0001/ticket.md', …]` to the complete ordered
paths `backlog/T-0001/ticket.md` and `backlog/T-0001/sneaked.md`, and goes red against today's
code. **A different defect that shares a home** — the fix is inside `commitAll`, never in the
module's `git()` runner (NG-3).

**AC-12 — `mergeInto` reports git's reason, and never an empty one.** The failure carries the
useful reason git emitted **whether git wrote it to stdout, stderr or both**, and `mergeFailure`
does not answer *"git reported no reason"* while either stream holds non-whitespace diagnostic
text. Where the conflict probe (`fanout.ts:316`) cannot answer, that is not reported as *no
conflicts*; where `merge --abort` (`:317`) fails, the JSDoc's *"leave the worktree clean either
way"* is either made true or corrected, and the caller is told. *Test:* pin `fanout.test.ts:406` is
rewritten against a real content conflict — that test already proves `String(raw.stdout)` contains
`CONFLICT`; a forced abort failure surfaces rather than being swallowed; `mergeInto`'s JSDoc and
its behaviour agree. **Reachability of the `git reported no reason` string is measured before the
fixture is written — OQ-5.**

**AC-13 — the two source registers move rather than widen.** `fanout.source.test.ts:45` requires
the folder to be **exactly two files** and `:48` exactly twelve exports; `git.source.test.ts:40`
pins its exports with `toEqual` and `:52` refuses the historical set. If any moves it is moved with
the historical value shown **refused**, which is the demonstration `git.source.test.ts` already
writes for itself. *Test:* the previous value asserted `.not.toEqual`, never `toContain`.
`fanout.ts` may import `../git/git.js` — `fanout.source.test.ts:135`'s allow-list already permits
it — so the exit-status reader may be shared rather than copied (OQ-6).

**AC-14 — no vocabulary widens, and no rendering changes.** `CONTAINMENT_REASONS` already holds
`'git failed'` (`git.source.test.ts:133`); no reason set grows, `docs/GLOSSARY.md` gains no term,
and no CLI output line, flag or command is added. *Test:* `containment` and `pushLag`'s reason sets
unchanged by identity; the glossary's term list and `CLAUDE.md:13` byte-identical before and after
(Q-0108's check).

**Fixture rule, binding on every criterion above.** Tests use repositories and failure conditions
the test itself creates. A verdict may not depend on the enclosing checkout, the operator's git
configuration, translated git prose, or a filesystem permission the environment may not support —
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30).
Where a deterministic failure cannot be staged, **the git invocation is injected or stubbed to
return the same structured failure** rather than the platform being made the oracle; and any test
needing a capability **probes for it and reports a skip** naming what could not be staged, which is
Q-0105's GO-3 repaired by hand after its gate.

---

## 5. Non-goals

- **NG-1 — the two `safe()` declarations are not unified into one shared helper.** `fanout.ts`
  keeps its own `git` runner on a recorded argument (`:199–202`: *"a port that exported it to save
  four lines would widen that module's surface for this one's convenience"*), and the same argument
  covers `safe()`. AC-3 registers the duplication; it does not remove it.
- **NG-2 — the eleven non-collapsing sites are not changed.** Turning every `safe()` into a
  tri-state is a change nobody asked for; §1 gives each its reason, with `configuredUser` as the
  worked example.
- **NG-3 — the path-truncation fix does not become a change to `fanout.ts`'s `git()` runner.**
  AC-11 is not a `safe()` defect: it is the runner's `.trim()` at `:205`. Changing it would move
  the output of every one of that runner's callers and is refused here.
- **NG-4 — `resetBranchTo`'s stale-registration defect stays.** Site 19's neighbour — the route
  chosen from `fs.existsSync` alone, so a hand-deleted worktree directory wedges the branch — is
  `Why: preserved defect, see Q-0048 AC-12 defect 2`, Q-0042 finding 5, and is not this ticket's.
- **NG-5 — `ensureWorktree`'s base fallback is registered, not repaired.** Site 3 cuts a worktree
  from `HEAD` when the declared base does not resolve. Q-0038's closing entry already names this a
  non-goal with its evidence — *"the implementer was not stopped by the missing ref; it was handed
  a worktree from somewhere else and paid to work in it"* — and its reasons: another module, it
  governs fan-out task bases too, and *throw, warn, or which callers* is unasked. It gains an AC-2
  register row and nothing else.
- **NG-6 — `composite.ts`'s neighbouring preserved defects stay.** `Q-0053 AC-14(5)` (the evidence
  loop reads the declared list) and `Q-0053 AC-8` (the base-conflict exit leaves its occurrence
  open) are adjacent to AC-8's site and are not closed by it.
- **NG-7 — the two `--dry` mutations are struck from this ticket.** §6.2.
- **NG-8 — Q-0109's third case stays closed as unclosable.** A project root *below* a repository
  git refuses. Do not reopen without new evidence; the reasoning is in `git.ts:81–87`.
- **NG-9 — no repository-membership question becomes a general filesystem-existence question.** Any
  narrow inspection needed to tell a malformed `.git` from an absent one is the `git/` half's and
  must be authorised by the entry (OQ-4).
- **NG-10 — no retry orchestration, no automatic repair of a corrupt repository, no automatic
  conflict resolution, and no automatic rollback fallback when a head is unknown.**
- **NG-11 — no error message composes a remedy.** *"A `core` error names the condition; the remedy
  belongs to the surface"* (2026-09-07).
- **NG-12 — nothing else moves:** no flow YAML, adapter contract, event or trace format, gate
  behaviour, ticket frontmatter schema, exit code, new dependency, or API-key path. The v1
  exclusions hold by default.

---

## 6. Struck and routed — the two successors, written out in full

### 6.1 The `git/` half — a git probe that failed is never rendered as an answer

> **Five collapsing sites, and the only one in the census that reaches an adopter's screen.**
> `containment`'s branch list (`git.ts:345`) yields an empty `Set` on failure, and `stateOf`'s
> **first** clause is `if (!branches.has(branch)) return { state: 'indeterminate', reason: 'no
> branch' }` — so one failed `for-each-ref` makes `quorum board` answer `no branch` for **every
> ticket in the backlog**, a state `docs/GLOSSARY.md` defines as *"git was never asked"*. Its base
> probe (`:342`) renders `missing ref` on a failure. `repositoryAt` (`:71`) collapses to a
> **boolean**, so `workTreeProbe` answers `'outside'` where the `.git` gitfile is malformed or
> unreadable and the board renders nothing — Q-0109's subject, registered by Q-0105's erratum E-1
> as a residual rather than an unmet criterion (that ticket's AC-3 binds on *none of them reaches
> `pushed`*). `shortSha` (`:275`) collapses while its own JSDoc says it doubles as the engine's
> endpoint existence test. `ensureWorktree`'s base probe (`:143`) is registered and not repaired.
>
> **The vocabulary already exists and the machinery is in the same file.** `CONTAINMENT_REASONS`
> contains `'git failed'` (pinned at `git.source.test.ts:133`), `pushLag` (`:406–447`)
> discriminates at all four of its own sites in exactly the shape this owes, and `errorProperty`
> accepting `'status'` (`:27`), `exitStatus` (`:37`), `GIT_FATAL` (`:48`) and `WorkTreeProbe`
> (`:50`) are all already module-private. That is why this half is nearly mechanical.
>
> **`repositoryAt`'s JSDoc is part of the repair.** `git.ts:66` claims `--resolve-git-dir` *"can
> discriminate between them and absence"*, which is true of the git invocation and false of what
> `safe()` does with its failure. A criterion must say so — a comment claiming a discrimination the
> code discards is how this survived a cross-vendor review — and the guard proving doc and code
> agree must be **shown to have a subject**, which is Q-0111's lesson.
>
> **Its own blocking question, which Q-0074's gate should answer in the same entry if it can.** May
> a narrow filesystem inspection of the project root's `.git` distinguish a malformed or unreadable
> gitfile from an absent one, or must that distinction come from an injected or structured git
> operation alone? It collides with *"Membership is a git question, not a filesystem one"*
> (2026-08-28). **Q-0090's E-1 is the precedent for ruling exactly that kind of scope question, and
> it ruled the entry did not govern** the case in front of it — that entry argues from what turbo
> hashes, which has no analogue in *is this `.git` readable*. Measure before choosing.
>
> **It owes no second decision entry**, inheriting Q-0074's, and it inherits AC-2's register and
> AC-3 rather than landing them. **It must not reopen** Q-0109's third case (a project root below a
> repository git refuses), and it must not parse translated git prose or reimplement git's upward
> discovery walk. Roughly eight to ten criteria.

### 6.2 `--dry` mutates the caller's ticket, and the counters are an alias

The ticket body carries two mutations `--dry` does not guard. Measured, they are **in-memory only**
and **pinned as deliberate**: `engine.ts:194` substitutes `readOnlyBacklog(backlog)` under dry so
nothing reaches disk, `lifecycle.ts:118` carries `Why: preserved defect, see Q-0050 AC-10`, and
`lifecycle.test.ts:228` pins the arrangement by name. **A criterion that breaks a landed
preserved-defect pin is a ruling, not a criterion** — which is why the Codex candidate's AC-12 is
struck rather than merged. They have nothing to do with `safe()`, with git, or with an unanswerable
probe.

> **`--dry` mutates the caller's ticket, and the counters are an alias.** `finish()` sets
> `ticket.meta.iterations = context.counters` and advances `ticket.meta.stage` before its
> `if (!context.dry)` guard (`lifecycle.ts:118–122`), and `recordEvent` does the same at `:191`.
> `types.ts:215` documents the counters as *"the same object as `ticket.meta.iterations` — an
> alias, not a copy"*. Nothing reaches disk: `engine.ts:194` swaps in `readOnlyBacklog(backlog)`
> under dry, and `lifecycle.test.ts:228` pins that arrangement deliberately. **So this is bounded
> today to a caller that reuses the ticket object in-process, and there is exactly one such caller
> planned: M3's server**, which will hold a ticket across runs and answer `GET` requests from an
> object a `--dry` walk has just advanced. What it owes is not a fix but a decision about
> ownership: does `runFlow` receive a ticket it may mutate, or a copy it may not? The second is the
> cheap answer and it changes `lifecycle.test.ts:228`'s pin, which is why it wants a ruling rather
> than a patch. Its tests must retain references to the original ticket and iteration objects and
> assert them deeply unchanged after both a successful and a failed dry run — comparing serialised
> output after the run cannot see an alias. Strictly before Q-0013. Do not fold it into a git-probe
> ticket: the two share a file and nothing else.

---

## 7. Open questions

**None blocks this document.** Four of iteration 1's blockers are reclassified in §12; what remains
is one hard gate precondition (GO-1), two positions this requirement **states** rather than asks,
and four measurements the implementer takes.

**OQ-1 (gate precondition, owner: human — GO-1) — the decision entry lands before a line of code.**
Not a question about this document, which is complete without it, but a precondition for the
**chore run**: no step on that route may write a decision entry
(`harness/roles/developer-generalist.md:23`). This is the pattern that exhausted Q-0070's loop at
$8.31 and burned three of Q-0062's five implement rounds — where the requirement named the hazard
in advance and the run was launched anyway. `docs/decisions/` ends at **087**, so the entry is
**088**. Do not launch until it is in `docs/decisions/` **and** `docs/DECISIONS.md`, and verify it
is present in the first implement step's prompt rather than assuming it, which is the check Q-0097
lost two errata by not making.

The entry states: (a) absence may be reported only where the operation produced evidence of
absence, and a failed or incomplete probe is represented separately and never inferred as a
negative; (b) the three accepted caller responses — stop with actionable work, continue with an
explicit uncertainty, retain best-effort suppression with a recorded reason; (c) the rule §1 yields,
that `safe()` is correct wherever the caller's question cannot tell its two inputs apart and wrong
wherever the caller acts differently on them; (d) AC-6's rollback behaviour, ratified or overruled;
(e) OQ-4's answer, if the gate chooses to unblock the successor here; (f) OQ-6's sentence.

**OQ-2 (stated, not asked) — what the rollback does when it cannot read a head.** **This
requirement takes position (b): do not reset, warn, and record.** Written into AC-6 as a criterion
rather than carried as a question, because a requirement that leaves a case uncovered is precisely
one `developer-generalist` must stop on — Q-0105's cure for this shape. (a) *reset anyway* is
impossible for the start-head case, there being no sha to reset **to**, and unverifiable for the
current-head case; (c) *today's silent skip* is what the ticket exists to remove. The ground is the
asymmetry this repository has ruled twice — *the instrument may warn and may never reassure* — and
it preserves silence's present meaning, which AC-6 turns on. The gate may overrule; if it does,
AC-6 moves and nothing else does.

**OQ-3 (stated, not asked) — the split.** **The ticket body authorised it in advance** — *"If it
splits, the seam is the module, and the decision entry stays with whichever half runs first"* — so
the seam is not a discovery to be made at a gate. **Decision 062:96 cites Q-0074 by name against
`branchExists`, `branchHead`, `commitAll` and `mergeInto`, and `composite.ts:17` says "Q-0074 owns
it"**; a landed entry is never edited, so the id keeps the `fanout/` half whatever runs first.
This requirement additionally recommends the `fanout/` half **run first in time**, on severity
measured rather than preferred: §0.2's `integrate` defect awards a green tick over a tree missing a
task's work, and §0.1's `commitAll` defect commits an agent's frontmatter edit — both worse than a
board rendering a wrong-but-visible token, and both invisible after the fact. **The entry lands at
this gate regardless**, so whichever half runs first has it; that is a small refinement of the
body's *"stays with whichever half runs first"* and contradicts nothing. If the gate prefers the
board-visible half first, GO-2 re-points this body there and AC-2/AC-3 travel with it.

**OQ-4 (owner: human, the successor's blocker — not this ticket's) — may a narrow filesystem
inspection of the project root's `.git` distinguish a malformed gitfile from an absent one?** It
governs `repositoryAt` and `workTreeProbe`, both in `git.ts`, and reaches nothing in the `fanout/`
half. Routed to §6.1 in full. **Recommended but not required: answer it in the same entry**, so the
successor arrives at its own gate unblocked; it is efficient rather than necessary, and leaving it
to that gate costs one ruling rather than one run.

**OQ-5 (owner: implementer, measure before writing the fixture) — when is *"git reported no
reason"* actually reachable?** §0.4 establishes it is **not** reachable on a content conflict:
`steps.ts:98` returns `conflicts: …` first and `fanout.test.ts:396` pins them as `['f.txt']`. It
appears reachable only where the conflict probe (site 23) also fails, or through
`mergeFailure(null)`, whose signature admits `null` and for which no caller was found. A criterion
whose fixture cannot reach its own case is the defect this repository keeps finding.

**OQ-6 (owner: implementer, measure before choosing) — where does the exit-status reader live?**
Reading git's exit status is what makes the third answer possible. `git.ts` already has it
module-private (`errorProperty` with `'status'` at `:27`, `exitStatus` at `:37`, `GIT_FATAL` at
`:48`); **`fanout.ts` has none of it**, its own `errorProperty` (`:211`) accepting only
`'stderr' | 'message'`. Three options: a third copy in `fanout.ts` (refused — the shape AC-3 exists
to forbid), export from `git.ts` (permitted; `fanout.source.test.ts:135`'s allow-list already
contains `'../git/git.js'`, but it moves `git.source.test.ts:40`'s export register), or into
`@quorum/shared` (also allow-listed, but `shared` is declarations and constants and an error reader
is behaviour). **Recommended: export from `git.ts` and move the register per AC-13** — the one
option that adds no copy and no new home.

**OQ-7 (owner: implementer) — what TypeScript shape represents the third answer at each probe?** A
named union, `boolean | null`, a result object, or separate functions. This requirement does
**not** mandate one shared representation; it requires exhaustive caller handling and the behaviour
above. `workTreeProbe` (`'inside' | 'outside' | 'failed'`) and `resolvesToCommit` (`boolean | null`)
are two worked shapes in the same package, chosen per question rather than uniformly.

**OQ-8 (owner: human, one sentence in the entry) — is the ruling about a `catch` block or about a
habit?** The ticket body argues the second with evidence, and this run adds a third instance:
Q-0068's merge triage grepped for `Q-0066`, found nothing and read absence into it while an
authority line had sat above the code since 2026-08-26 under a different citation; Q-0039's erratum
E-1 narrowed a guarantee at two of its three sites; and **§0.3 finds the same trap set inside this
ticket's own instrument**, where the four pins cite `Q-0048` and a search for `Q-0074` returns one
line in the whole package. None is a `safe()` call. **Recommended: one sentence, and no more** — a
decision entry rules on code, and a habit is what `harness/rules.md` is for. If it earns more than
a sentence it is a second entry.

---

## 8. Risks

- **R-1 — the fix widens one guard and leaves its twin.** `lifecycle.ts:136` and `:139` read a head
  at each end; widening `branchHead`'s return type closes the first and leaves the second testing
  `string | null` for truthiness. AC-6's matrix is what catches it; both rows shown red before green.
- **R-2 — a broad mechanical replacement turns best-effort cleanups into new fatal paths.** Making
  `merge --abort` or `branch -D` failures fatal would make a failed run *harder* to recover from.
  The per-site census (AC-2) is the control and NG-2 is its boundary.
- **R-3 — the shim is the instrument and must not become the oracle.** `installGitShim`
  (`packages/core/test/repo.ts:116`) already exists and is already used at two of the four pin
  sites, so nothing new is built; what is owed is that each new shim-dependent test **states its
  premise** and reports a skip where the capability is absent (the fixture rule in §4).
- **R-4 — an approve on the first pass should be distrusted.** 108 of 145 review verdicts here
  returned `revise`. Four of the pins are rewrites of tests that currently assert the **opposite**
  of what they will assert — `fanout.test.ts:332` literally reads *"and the edit is committed
  anyway"* — so a reviewer reading the diff without running it cannot tell a rewritten pin from a
  weakened one. Every rewritten pin is demonstrated red against the unfixed code, and no pin is
  closed by deleting, skipping, renaming away or weakening it.
- **R-5 — the register can be written so that it cannot fail.** AC-2 is the durable value of this
  ticket and is exactly the shape that has failed five times here: a scan blind to a spelling
  (Q-0067 rounds 1–2), a fail-open list (Q-0051, Q-0108), an assertion satisfied by its own subject
  (Q-0111), a count standing in for an identity (Q-0073, Q-0107). Keyed from source, fails on an
  unclassified addition, mutation-tested with distinct signatures, and **no clause reads a total**.
- **R-6 — AC-9 changes `commitAll` on a path no test covers today**, and `commitAll` is on every
  code-writing step's exit. The refusal must be reachable **only** where the probe could not answer
  and never where `backlog/` is legitimately clean — the two are one character apart in `?? ''`.
- **R-7 — AC-8 sits beside two other preserved defects in the same function** (`Q-0053 AC-14(5)`,
  `Q-0053 AC-8`). NG-6 keeps them; an implementer that closes one in passing has changed a landed
  pin without an erratum.
- **R-8 — `pnpm install` before the suite.** An implement step's worktree has no `node_modules`;
  `commands.install` runs only in an `integrate` worktree. An uninstalled suite and a red suite are
  indistinguishable to a reviewer.
- **R-9 — the run cannot fully prove its own fix.** `runFlow` receives `config` at run start, so
  `integrate` exercises the **old** `commitAll`, `mergeInto` and branch filter. Verification is
  forced, on `main`, after the merge, in both environment rows (Q-0072's closing finding).

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, credential or `check()` path is touched, and no subscription-login refusal is weakened. |
| **Worktree safety** | Engaged. `ensureWorktree`'s base probe is the one place a probe failure changes **where an agent writes**; registered under NG-5, not repaired, and in the `git/` half regardless. Nothing here writes to the user's working tree; `resetBranchTo` and `commitAll` operate inside `.harness/worktrees/`. |
| **Gate behaviour** | Unchanged. No gate, verdict vocabulary or exit code moves. `undecided`'s `runs.log` line gains a third rendering of `kept-at=` (AC-7) and keeps `rollback=none` and the absence of the `rolled-back` token (Q-0040 AC-5). |
| **File format and schema** | No format change. `PushLagResult`, `ContainmentResult`, `AncestryResult` and their closed sets are untouched, and `'git failed'` is already a member of two of them (AC-14). `TicketRecord` is unchanged — §6.2. |
| **Lint rules** | No flow-lint rule added; `quorum lint` unaffected; type-aware ESLint stays one rule. |
| **Cross-vendor rule** | Unchanged. |
| **Cold-clone impact** | Neutral-to-better. No new command, flag, dependency, prompt or output line. The board defect that is *on* the first-30-minutes path is the `git/` half's (§6.1). |
| **Docs** | `docs/DECISIONS.md` gains one index line and `docs/decisions/088-*.md` the entry. No numbered doc changes: `04-architecture.md`'s `core` principles already require this and are not contradicted. `docs/GLOSSARY.md` gains nothing (AC-14). `harness/rules.md` gains at most one sentence if OQ-8 rules the habit worth stating, and `.claude/rules/` is its **derived copy** — the human's to sync, never a surface a criterion may name (2026-08-27). |
| **Product-agnostic** | Clean. No product name; fixtures use `T-0001`/`Q-` only. |
| **Errors are explicit** | The criterion this ticket is about. Thirteen sites default silently today; AC-4 to AC-12 remove that at the eight this half owns, and AC-2 registers the rest. |

---

## 10. Gate obligations

- **GO-1 — the decision entry (088) is written and indexed *before* the chore run starts**,
  answering OQ-2, OQ-8 and, if the gate chooses, OQ-4. **Verify it is present in the first implement
  step's prompt** rather than assuming it. This is the one obligation whose omission has cost real
  money three times (Q-0062, Q-0070, Q-0101).
- **GO-2 — OQ-3's recommendation is ruled at the gate.** If the `git/` half is run first instead,
  this body is re-pointed **at the gate**, so decision 062's citation still reads true and AC-2/AC-3
  travel with the half that runs.
- **GO-3 — both successors (§6.1, §6.2) are opened as tickets *at this gate*, from the bodies
  above**, not left in a closing entry. Three obligations found orphaned in the week before this run
  (Q-0110's, Q-0111's, Q-0112's) each lived only inside a closed ticket's prose or a source comment.
- **GO-4 — verified in both environment rows, forced, on `main` after the merge; CI green on the
  merged commit.** This is the ticket whose subject is *a probe read as a proven negative*, and a
  local green is a probe.
- **GO-5 — the closing entry records what the census found**, including that the body's own
  re-measurement was right about 24 and named neither of the two sites that matter most, and that
  the pins recording this ticket's defects cite `Q-0048` rather than `Q-0074`.

---

## 11. Provenance

**From the Claude candidate**, which is the base document: the census with per-site dispositions and
the two unnamed severe sites (`git.ts:345`, `fanout.ts:280`); the refutation of the body's
`mergeFailure` claim; the ten-consumer enumeration including the two that write a false sentence
into a durable record; the decision-062 binding that settles which id keeps which half; the finding
that `lifecycle.test.ts`'s matrix already holds the two rows and reads them as correct; the
observation that the answer is written in-tree and needs no new vocabulary; the struck `--dry`
routing with a successor body; and most of §8.

**From the Codex candidate**: the three-name disposition vocabulary — *distinguish*, *propagate*,
*best-effort with a reason* — which is better than a two-way split because it separates a site that
already discriminates from one that deliberately swallows; the rule that **no criterion may depend
on a historical site count**, which is the anti-rot property the census needs and which the base
candidate's AC-2 violated by asserting 24; the fixture rule that where a deterministic failure
cannot be staged the git invocation is **injected** rather than the platform made the oracle; the
diagnostic obligation that a message must not *say or imply* the ref is absent (AC-7); that the
census be generated from the implementation commit rather than copied; the filesystem-inspection
question raised in its own right rather than as a footnote; NG-10's exclusion of retry orchestration
and automatic repair; and the framing that a search finding no evidence is not evidence of absence
when the search itself may have failed — which §0.3 then found instantiated inside this ticket.

**Struck from the Codex candidate**, with reasons: its AC-12 (`--dry` must not mutate the in-memory
ticket) asks an implementer to break a landed preserved-defect pin — `lifecycle.ts:118` carries
`Why: preserved defect, see Q-0050 AC-10` and `lifecycle.test.ts:228` pins the arrangement by name —
which is a ruling, not a criterion, and is a different subject; routed to §6.2. Its question about
whether the census should be enforced by a test is **answered rather than carried**: the ticket's own
evidence is that the census rotted in one day, so it is executable (AC-2). Its scope covered both
modules in one ticket, which §1's thirteen collapsing sites put past the ceiling.

**From neither candidate, and new at iteration 2**: `composite.ts:246`'s branch filter, where a
failed probe silently shortens `integrate`'s merge list and the step still reports `tests=ok`
(§0.2, AC-8) — the most severe consequence measured in either half; and the finding that the four
pins cite `Q-0048`/`Q-0053` while `Q-0074` appears exactly once in `packages/core/src` (§0.3,
AC-1), which is this ticket's own defect class waiting inside its own instrument. Also from neither:
the verification that `installGitShim` already exists and is already used at two pin sites (§0.8),
which converts the instrument risk from *build one* into *state its premise*; the reading of
`fanout.ts:205`'s `.trim()` as AC-11's mechanism, already documented in the pin's own comment, which
makes NG-3 a measurement rather than a preference; and the separation of *which id owns which half*
from *which half runs first* (OQ-3), which lets decision 062's citation stay true whichever way the
gate sequences the work.

---

## 12. What iteration 2 changed, and what it did not

Iteration 1 returned `needs-input` on four blockers against an unchanged tree. Iteration 2 re-derived
every measured claim against the tree, found two new results (§0.2, §0.3), and **reclassified all
four without reversing any of them on the merits** — the Q-0105 shape, where the second pass carried
iteration 1's recommendations unchanged and moved only where they sit.

- **B-1 → GO-1.** The decision entry is a precondition for the **chore run**, not an open question in
  the document. Carrying it as both a blocker and a gate obligation is what made a complete document
  read as a blocked one, which is Q-0105's iteration-2 finding in its own words.
- **B-2 → AC-6, stated.** The rollback's behaviour is written as a criterion with its reasoning,
  rather than asked of the gate. A requirement that leaves a case uncovered is precisely one
  `developer-generalist` must stop on — so stating it is the remedy for the pattern rather than
  another instance of it. The gate may overrule; one criterion moves if it does.
- **B-3 → OQ-3, stated.** The seam was authorised in the ticket body in advance and fixed to the
  module; decision 062 and `composite.ts:17` fix the id. The document is already the `fanout/` half
  at fourteen criteria, both successors are written out in full, and GO-3 opens them. Nothing is
  silently trimmed. What remains is a sequencing preference that changes no criterion, only where
  AC-2 and AC-3 land — handled by GO-2.
- **B-4 → OQ-4, out of scope.** It governs `repositoryAt` and `workTreeProbe`, both in `git.ts`, and
  reaches nothing in this half. Recommended for the same entry as an efficiency, required of the
  successor's gate at worst.

**Returning `needs-input` a second time on four human-owned questions against an unchanged tree
would itself be the pattern this repository has recorded sixteen times — a loop handed work no agent
in it can perform.** Q-0102 was the first ticket to recognise that before the money was spent; this
is the second.
