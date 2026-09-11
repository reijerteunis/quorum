---
id: Q-0074
title: A failed git probe is read as a proven negative
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0074/integration
priority: p2
created: 2026-08-28
iterations:
  requirements.head-of-product: 1
history:
  - stage: draft
    run: 1
    flow: requirements
    status: failed
    stage_before: draft
    stage_after: draft
    at: 2026-09-10T19:12:42.011Z
    cost: 11.528
  - stage: requirements
    run: 2
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-10T19:46:43.689Z
    cost: 12.289
  - stage: requirements
    run: 3
    flow: chore
    status: failed
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-10T23:48:26.384Z
    cost: 61.734
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.
>
> **Q-0109 was absorbed into this ticket on 2026-09-07** and is `abandoned`; its body stays in
> place as the evidence. The two were one defect in one duplicated primitive — see
> *"Absorbed: Q-0109"* at the end. This ticket keeps the id because *"What a run's event stream
> carries"* (2026-08-28) cites **Q-0074** by name, and a landed entry is never edited.

Opened 2026-08-28 from Q-0050's OQ-4, whose successor body the merged requirement wrote out in full
so the obligation could not expire — *a deferred obligation dies unless it is written into a
successor's body; an implement report is not a durable record and is not read again after the gate*.
Created by hand at id Q-0074 rather than through `harness ticket new`, which would have allocated
Q-0077: the id is already cited by name in `docs/decisions/062-what-a-runs-event-stream-carries.md`,
in `backlog/Q-0050-…/requirements/merged.md` OQ-4 and in that ticket's `solution/errata.md`.

## The defect

`branchExists` and `branchHead` both wrap `fanout.ts`'s `safe()`, which swallows every error, so an
absent ref and a git that could not run give the **identical** answer at all eight sites Q-0050's
requirement enumerates. Three more of the same shape travel with it:

- `commitAll` wraps its checkout and clean the same way, so a revert that **failed** still reports
  through its discard callback as though it had discarded.
- `commitAll`'s first reported path loses its first character when the file is modified-but-unstaged
  — `['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']`, measured.
- `mergeInto` returns an empty error on a content conflict, so `mergeFailure` prints *"git reported
  no reason"* in the one case where the reason is the only information there is.

All four are pinned in `packages/core/src/fanout/fanout.test.ts`, each carrying a
`Why: preserved defect` line the fix must remove with it. **Verified when this ticket was written**,
because a line number in an inherited body is exactly the kind of claim that rots:

| pin | the test as it reads today |
| --- | --- |
| `:248` | *a git that FAILS returns the same negative as an absent branch — preserved, not endorsed* |
| `:331` | *a revert that FAILED still reports as though it had discarded — preserved, not endorsed* |
| `:351` | *the FIRST reported name loses its first character when the file is only modified* |
| `:405` | *a content conflict reports an EMPTY error, because git wrote its reason to stdout* |

## Why it is more than cosmetic

**The two sites that matter are the start-of-run branch head (`engine.js:48`) and `finish`'s
rollback read (`:641`)** — both confirmed present as described. A git that fails at either makes the
rollback **skip itself through its own truthiness guard**, so a failed run silently keeps whatever
`integrate` merged. That is the contamination register row 19 exists to prevent, arriving with no
message at all.

Also carried, and part of this ticket: the two mutations `--dry` does not guard — the in-memory
ticket is still advanced, and the run's counters alias the ticket's `iterations` object. Both stop
being latent when M3 holds a ticket across runs.

## The decision this ticket owes

**Not** whether to widen a return type. The question is **what a caller does with "could not
answer"**: stop and name the work a human must do, or carry on and say so. That is the same
three-valued discipline *"Containment is derived from git on each board invocation, never stored"*
(2026-08-24) settled for the board — *exit 1 is never inferred from a failure, a timeout or an
absent binary* — and *"An absent branch is an answer"* (2026-08-28) extended one step further. `core`
will otherwise ship that primitive in the same package as helpers that contradict it.

## Constraints

**The fix lands in `spike/src/fanout.js` and `packages/core/src/fanout/` together** — the
Q-0066/Q-0068 shape — or the port loses the independent witness the freeze exists to provide.
`spike/src/**` is frozen for Q-0009's fourteen children, so this needs either a human commit
carrying a freeze-exemption trailer or a ticket scoped outside that set. Q-0074 is not one of the
fourteen, so `port-freeze-guard.sh` exits 0 saying the branch is out of its scope; confirm that in
the report so no reviewer spends a round on it.

Each of the four pinned tests must be **rewritten, not deleted** — the pin says the defect is
preserved, and the fix is what removes the pin.

## Why it is latent, and when it stops being

A run reaching this code has already spawned git several times, so a git that cannot run is
improbable *today*. It stops being latent at M3, where a run nobody is watching is exactly where
*"git failed"* rendering as *"the branch is not there"* costs something — and where the rollback
skipping itself is unattended rather than observed.

## Not in scope

Q-0050's four routed diagnostics were **preserved deliberately**, at that ticket's gate, with the
default applied and recorded: a fix needs a decision entry accepted first, a freeze exemption, and a
change in two trees, and doing it inside the child already carrying the port's only interface change
would have divided its reviewer. That reasoning is why this is a ticket and not a patch.

## After the cutover — corrected 2026-09-07

**Void: the first paragraph of *Constraints*.** There is no `spike/src/fanout.js`, no freeze, no
`port-freeze-guard.sh` and no exemption trailer to carry. The fix lands in
`packages/core/src/fanout/` alone. The second paragraph stands unchanged and is the one that
matters: **each of the four pinned tests is rewritten, not deleted.**

**Void by implication: the last sentence of *Not in scope*.** It gives *"a freeze exemption, and a
change in two trees"* as two of the three reasons Q-0050 deferred this. Only the first reason — a
decision entry accepted first — survives, and it survives intact.

**The four pins, re-measured.** Each is one line later than the body records:

| pin | the test as it reads today |
| --- | --- |
| `fanout.test.ts:249` | *a git that FAILS returns the same negative as an absent branch — preserved, not endorsed* |
| `fanout.test.ts:332` | *a revert that FAILED still reports as though it had discarded — preserved, not endorsed* |
| `fanout.test.ts:352` | *the FIRST reported name loses its first character when the file is only modified* |
| `fanout.test.ts:406` | *a content conflict reports an EMPTY error, because git wrote its reason to stdout* |

**The two sites that matter, re-measured.** The start-of-run branch head is `engine.ts:252`
(`branchHeadAtStart = branchHead(repoDir, ticket.meta.branch)`), and the rollback read is
`lifecycle.ts:136` — `if (restoresBranch(status) && context.branchHeadAtStart)`. **The truthiness
guard the body names is still there**, now as the second half of that conjunction, so a git that
failed at `engine.ts:252` still makes the rollback skip itself silently. Q-0062 split the predicate
into `restoresBranch`, which changed which statuses roll back and not this.

**The decision this ticket owes now has a precedent in the same package, which it did not when the
body was written.** Q-0105 shipped exactly the three-valued discipline this ticket asks for, under
*"The board reports push lag, and never a CI conclusion"* (2026-09-06): `git.ts`'s `WorkTreeProbe` is
`'inside' | 'outside' | 'failed'` with *"a probe that could not answer is a different thing from
either of git's own and is never collapsed into one of them"* written into its JSDoc, and
`resolvesToCommit` returns `boolean | null` so *"a broken git is never reported as an absent ref"*.
That is this ticket's question answered for one subsystem. Read it before choosing rather than
re-deriving the shape.

**Q-0109 is the same class, in that same new code**, and was opened 2026-09-07 from Q-0105's erratum
E-1: `repositoryAt` collapses every failure of `rev-parse --resolve-git-dir` to `false`, so a
malformed gitfile reads as proven absence. The two tickets share a decision and could sensibly share
a requirements run.

## Absorbed 2026-09-07: Q-0109, which is this defect in the other copy of one function

**Why the two merged, measured rather than argued.** They are not adjacent classes. `safe()` —

    const safe = <T>(fn: () => T): T | null => {
      try { return fn(); } catch { return null; }
    };

— is declared **exactly twice in the workspace, byte for byte**: `packages/core/src/fanout/fanout.ts:206–208`,
which is this ticket's subject, and `packages/core/src/git/git.ts:19–21`, which was Q-0109's. Same
name, same signature, same body, two modules, and nothing else in `packages/*/src` carries a third
copy. Neither ticket knew this; both were written as though they were about a function each.

**So the real subject is one primitive with 23 call sites**, and the two ticket bodies between them
name five:

| module | `safe()` call sites | named by a ticket |
| --- | --- | --- |
| `git/git.ts` | 15 | 1 — `repositoryAt` (`:71`), Q-0109's |
| `fanout/fanout.ts` | 8 | 4 — `branchExists` (`:224`), `branchHead` (`:239`), `commitAll` (`:283–284`), `mergeInto` (`:316–317`) |

**The first task is therefore a census, not a widening.** Most of the other eighteen are almost
certainly right as they are: `git.ts:157`'s `branch -D` and `fanout.ts:317`'s `merge --abort` are
best-effort cleanups where a failure genuinely is nothing to say, and turning every `safe()` into a
tri-state would be a change nobody asked for. What has to be decided per site is the question this
ticket already owes — **what does a caller do with "could not answer"** — and the census is what
turns that into a list rather than a principle.

**The answer's shape is already written, twice, in the file Q-0109 was opened against.** Q-0105
needed exactly this discrimination for push lag and did **not** reach for `safe()`: `workTreeProbe`
(`git.ts:91–97`) returns `'inside' | 'outside' | 'failed'` and `resolvesToCommit` (`git.ts:104–105`)
returns `boolean | null`, each with its own `try`/`catch` that reads git's exit status instead of
discarding it. Both landed under *"The board reports push lag, and never a CI conclusion"*
(2026-09-06). So the decision this ticket owes has a worked precedent in the same package, written
by the ticket that raised the second half.

**Q-0109's own subject, carried forward verbatim in substance.** `workTreeProbe` asks `repositoryAt`
after a git fatal, and `repositoryAt` (`git.ts:70–72`) is a `safe()` call compared against `null` —
so a **malformed gitfile** at `repoDir/.git` and an **unreadable `.git`** both come back as absence,
`workTreeProbe` answers `'outside'`, and the board renders nothing. That gives silence a second
meaning the 2026-09-06 entry did not give it, whose rule is that silence means only that git
answered. **It is a residual and not an unmet criterion** — Q-0105's AC-3 binds on *none of them
reaches `pushed`*, which is why erratum E-1 registered it rather than failing the ticket.

**Two things Q-0109 settled that this ticket inherits and must not re-open.**

1. **E-1's third case is closed as unclosable.** A project root *below* a repository git refuses
   cannot be caught without either git's translated prose, which may never decide a state, or a
   reimplementation of git's upward discovery walk, whose verdict would then depend on where a
   fixture happens to sit — refused by *"A test's verdict is a property of the commit, not of the
   checkout or the account"* (2026-08-30). Do not reopen it without new evidence.
2. **The obvious instrument for the remaining two collides with a landed entry.** A filesystem
   existence check at `repoDir/.git` runs into *"Membership is a git question, not a filesystem one"*
   (2026-08-28). Whether that collision is real, or whether that entry is scoped to
   `turbo-inputs.test.ts` and its argument about what turbo hashes has no analogue here, is part of
   the work. **Q-0090's E-1 is the precedent for ruling exactly that kind of scope question**, and it
   ruled the entry did **not** govern the case in front of it. Measure before choosing.

**The `git/` half has no pin and no in-tree pointer, which is the half that gets lost.** This
ticket's four `fanout/` cases are each pinned by a test carrying a `Why: preserved defect` line
(`fanout.test.ts:249, 332, 352, 406`) and named in `composite.ts:17`. Q-0109's two have neither —
`repositoryAt`'s JSDoc at `git.ts:59–68` actually claims the opposite, that `--resolve-git-dir` *"can
discriminate between them and absence"*, which is true of the git invocation and false of what
`safe()` does with its failure. **That sentence is part of the repair**, and a criterion should say
so, because a comment claiming a discrimination the code discards is how this one survived a
cross-vendor review.

**Sizing, and the split seam if it is needed — written now rather than discovered at a gate.** This
ticket already carries four pins, two `--dry` mutations and a decision entry; adding the census and
the `git/` half plausibly puts it past the fifteen-criteria ceiling that forced splits at Q-0091 and
Q-0096, both of them at cost. **If it splits, the seam is the module, and the decision entry stays
with whichever half runs first**: the entry and `core/git`'s two cases in one, `core/fanout`'s four
pins in the other. It is one ticket because one ruling governs both, not because the code is one
change.

**Q-0082 cites this ticket in place of Q-0109** as of the same day, so no pointer is left dangling.

## Re-measured 2026-09-10, before the run — and the census rotted in one day

**The count is 24, not 23, and the twenty-fourth is the point.** `git.ts` holds **16** `safe()` call
sites and `fanout.ts` **8**. The new one is `git.ts:213`,
`safe(() => git(['config', 'user.name'], dir))?.trim()` inside `configuredUser` — **added by Q-0112
on 2026-09-08, the day after the merge triage counted them.** A census written into a body is a
measurement that starts rotting immediately, which is the argument for §*"the first task is a census"*
being a **task of the run** rather than a number to inherit. Re-derive it; do not trust this table
either.

`safe()` is still declared **exactly twice, byte for byte** — `fanout.ts:206` and `git.ts:19` — and
the four `fanout.test.ts` pins are still at **249, 332, 352, 406**, unmoved.

**`configuredUser` is a good first census row, because it is probably correct.** A git that cannot
be run and a git with no `user.name` configured both honestly mean *nobody said*, and the caller
already renders that as the sentinel `unknown` under *"A ticket's owner is supplied, never guessed"*
(2026-09-08). If the census cannot articulate why that site keeps `safe()` while `branchHead` may
not, the census has not done its job.

**The rollback carries TWO truthiness guards, not one, and the body names only the first.**
`packages/core/src/engine/lifecycle.ts`:

```
136:    if (restoresBranch(status) && context.branchHeadAtStart) {
137:      // Why: preserved defect, see Q-0050 AC-12.
138:      const current = context.readBranchHead(context.repoDir, ticket.meta.branch);
139:      if (current && current !== context.branchHeadAtStart) {
```

`:136` guards the head read at run start and `:139` guards the head read at rollback time. **Both
operands come from `safe()`-wrapped reads**, so a git that fails at *either* end makes a failed run
silently keep whatever `integrate` merged — the contamination the body describes, reachable by two
routes rather than one. A fix that widens only `branchHead`'s return type closes `:136` and leaves
`:139` reading a `string | null` it still tests for truthiness.

**One line number moved:** the start-of-run read is `engine.ts:271` (was 252), shifted by Q-0039's
run lock. `repositoryAt`'s contradicting JSDoc is `git.ts:66` — *"which is precisely why it can
discriminate between them and absence"* — against the `safe(...) != null` at `:71` that discards
exactly that discrimination.

**The class is not latent in practice, and there is fresh evidence.** *"A failed probe read as a
proven negative"* was committed twice by the operator in the three days before this run: once in
Q-0068's merge triage, which grepped for `Q-0066`, found nothing, and concluded no authority line
existed while one had sat above the code since 2026-08-26 under a different citation; and once in
Q-0039's erratum E-1, which narrowed a guarantee at two of its three sites. Neither is a `safe()`
call. **That is the argument that the ruling this ticket owes is about a habit of reasoning and not
only about a `catch` block**, and it is worth one sentence in the entry.

## Ruled at the requirements gate, 2026-09-10

**The ticket split in three, and Q-0074 keeps the `fanout/` half.** Not by preference: *"What a
run's event stream carries"* (2026-08-28) cites **Q-0074** by name against `branchExists`,
`branchHead`, `commitAll` and `mergeInto`, and `composite.ts:17` says *"Q-0074 owns it"*. A landed
entry is never edited, so the id stays with the half it names. `requirements/merged.md` §4's
fourteen criteria are this ticket's.

**The `git/` half runs FIRST, as Q-0115.** *Which half runs first* is a separate question from
*which id owns which half*, and the gate ruled it on two measurements: `git.ts:345` is the only site
in the census that reaches an adopter's screen — one failed `for-each-ref` and `quorum board`
answers `no branch` for **every ticket in the backlog** — and the half is nearly mechanical, because
`CONTAINMENT_REASONS` already holds `'git failed'`, `pushLag` already discriminates at all four of
its own sites, and `errorProperty`, `exitStatus`, `GIT_FATAL` and `WorkTreeProbe` are already
module-private. **AC-2's census register and AC-3 travel with Q-0115**, per §6.1; this ticket
inherits them back when it runs.

**GO-1 is discharged: `docs/decisions/088-a-probe-that-could-not-answer-is-not-a-negative.md`**
landed at this gate, before any code. It rules all six clauses OQ-1 lists, including **OQ-4** —
a narrow filesystem inspection *may* separate an absent `.git` from an unreadable or malformed one,
and *"Membership is a git question, not a filesystem one"* (2026-08-28) does **not** govern, on
Q-0090 E-1's precedent; the bound is stated in the entry. **OQ-2 is ratified as the requirement
stated it**: a rollback that cannot read a head does not reset, warns, and records. **OQ-8 got its
one sentence and no more.**

**GO-3 is discharged: Q-0115 and Q-0116 exist**, with §6.1 and §6.2 transcribed into their bodies in
full rather than referenced.

**What the census found that no earlier account had.** Twenty-four sites, thirteen collapsing, and
four of them named by no ticket, comment or test before this run: `git.ts:143` (a failed base probe
cuts the worktree from `HEAD`), `git.ts:345` (the board-wide `no branch`), `fanout.ts:280` (a failed
status probe reads `backlog/` as clean, so no revert runs and `onDiscard` never fires) and
`fanout.ts:317` (a failed `merge --abort` leaves a merge in progress, against a JSDoc promising
*"leave the worktree clean either way"*). **The rollback has two routes, not one** —
`lifecycle.ts:136` and `:139`, both reading `safe()`-wrapped values.

**And the trap was set inside this ticket's own instrument:** the four pins recording its defects
cite **`Q-0048`**, not `Q-0074`, and a search for `Q-0074` returns one line in the whole package.
GO-5 requires the closing entry say so.
