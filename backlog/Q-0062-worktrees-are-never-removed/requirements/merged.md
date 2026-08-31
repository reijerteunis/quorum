# Q-0062 — Worktrees are never removed

*Merged requirement, head-of-product, 2026-08-31 · route **chore** · consumes `requirements`,
produces `reviewed` · surfaces: `spike/src`, `packages/core/src`, both test suites, `docs/`,
`harness/port-charter.md`.*

*Every measurement in this document was re-run against the working tree today. Nothing is inherited
from the ticket body, from either candidate, or from the 2026-08-26 count the ticket itself forbids
re-deriving — which is this repository's own rule, written after two of three inherited measurements
turned out wrong.*

---

## Problem

`removeWorktree(repoDir, branch, { deleteBranch })` exists in both trees, is exported, and is
tested — four tests at `packages/core/src/git/git.test.ts:526–550` cover removal, idempotence,
branch deletion and the refusal to delete a checked-out branch. **It has no caller in either tree.**
`grep -rn removeWorktree` across `spike`, `packages`, `harness`, `docs` and `.github` returns the two
definitions, its own unit tests, the export register, the pin that forbids it, and one line of
`docs/06-development-plan.md`. Nothing else.

A run creates worktrees and removes them at none:

| Site | Spike | `packages/core` |
| --- | --- | --- |
| an agent step with `worktree: true` | `engine.js:246` (`ensureWorktree`) | `engine/steps.ts` |
| the ticket / integration worktree | `fanout.js:223` `ticketWorktree`, called from `engine.js:1018`, `:1061`, `:1074` | `fanout/fanout.ts` `ticketWorktree`, called from `engine/composite.ts` |
| removal | `git.js:26` — **zero callers** | `git/git.ts:81` — **zero callers** |

**Measured today:**

```
$ git worktree list
…/quorum                                              0f1db18 [main]
…/.harness/worktrees/harness__Q-0058__implement       85467fd [harness/Q-0058/implement]
…/.harness/worktrees/harness__Q-0058__integration     dc22890 [harness/Q-0058/integration]

$ du -sh .harness/worktrees/*
139M  harness__Q-0058__implement
138M  harness__Q-0058__integration        # 277M, from one ticket that closed today

$ git branch -a | wc -l
5                                          # two of the five are Q-0058's, held checked out
```

Three consequences, in the order they cost something:

1. **277 MB per closed ticket, forever.** The qualifier earlier accounts carry — *"once `integrate`
   has installed there"* — is wrong: both directories carry ~125 M of `node_modules`, including the
   `implement` one, where `commands.install` never runs (`engine.js:1034` runs it only in an
   `integrate` worktree). The implementer builds it by hand, which is the cost Q-0049's run recorded
   paying and `harness/rules.md` now instructs every implementer to pay. Either route leaves the same
   quarter-gigabyte.
2. **A checked-out branch cannot be deleted.** `git branch -d harness/Q-0058/implement` refuses while
   a worktree holds it, so the branch outlives the ticket too. The older claim that this is *"how
   `git branch -a` reached the size it is now"* no longer reproduces — the list has been pruned by
   hand to five — and is **not** inherited here. The mechanism is intact; the accumulation evidence
   for it is not.
3. **State outliving the run that created it.** A run that does not complete resets the ticket branch
   (`engine.js:670–679`, `engine/lifecycle.ts:33–43`) and leaves the directory, so a worktree can
   hold a merge that no ref points at.

**The only thing that has ever removed a worktree in this repository is a person remembering to.**
The four directories the ticket recorded on 2026-08-26 are gone; nothing in either tree removed them.

### What this document adds to the ticket body

- **The freeze's SHA-anchored half is now live**, which the ticket's scope paragraph does not know.
  `harness/port-charter.md:264–266` reads `children: Q-0041 … Q-0054` and
  `freeze-sha: 7b6bc70421094ae31eb44257807f84b8f732a20a`. The SHA **is** an ancestor of `main` and
  `git diff --name-only 7b6bc70 main -- spike/src` returns **zero files**. The ticket is right that
  the *branch-scope* half does not bind Q-0062 — it is not among the fourteen children — but the
  freeze-SHA job goes red on `main` the moment a `spike/src` change lands unless §3's two-step answer
  is performed. **Q-0062 is the first ticket in this repository to walk that path.** See GO-2.
- **There are seven guards, not three.** Four more constrain the *shape* of the fix rather than
  forbidding it; none moves if the fix is placed correctly, and all fail if it is not. See R-6.
- **Four assertions in the spike suite break, and one breaks silently.** See R-7. The silent one is
  this repository's own recurring failure — a check that skips its subject and reports success —
  sitting inside the regression suite.

---

## User story

**Maintainer** — *"I ran one ticket through the flows today. My checkout is a quarter of a gigabyte
heavier than the code in it, and `git branch -d` refuses on a branch whose work is already contained
in `main`. I did not ask for either and nothing told me."* A run that finished should leave the
repository holding its refs and its history, not its scaffolding. A run that did **not** finish should
leave everything exactly where it is, because that directory is the thing I am about to open.

**Cold-clone adopter** — *"I cloned it, ran one ticket to a merged branch in under thirty minutes,
and the checkout grew by 277 MB of `node_modules` I cannot find and was not told about."* There is no
command to learn here and no flag to discover; the first thirty minutes get shorter by an absence.

**Adapter contributor** — no story. The lifecycle is above the adapter layer and no adapter learns
anything from it.

---

## The rulings this requirement makes

**R-1 — the fix lands in `spike/src` and `packages/core/src` together, in one change.** The ticket
says Q-0062 *may* write `spike/src`; it must. Verified rather than assumed: **no file in this
repository imports `@quorum/core`** — every hit outside `packages/core` itself is a turbo task id in
a test fixture. `packages/core`'s engine is executed by nothing but its own suite, so a `core`-only
fix removes zero worktrees until the cutover, which sits behind Q-0010, which has no ticket. The
spike is what runs every flow here, including this one. Q-0057 is the closest precedent: a
`core`-only fix there would have protected **none** of the three tickets it existed to protect.

**R-2 — the rule is the exact complement of the rollback that is already there.** `finish()` in both
trees already asks one question, and both trees spell it as the same disjunct: on `completed` or
`regressed` it advances the stage and leaves the branch alone; on `aborted`, `failed` or
`interrupted` it rolls the ticket branch back to where it found it. Worktree removal reads that same
predicate the other way — **a run that finished removes the worktrees it obtained; a run that did not
leaves them, because a failed run's worktree is exactly the thing someone wants to open.** One
condition, two consequences, no new vocabulary, and the inspection story and the cleanup story cannot
disagree because there is only one test to disagree about.

**R-3 — directories are removed; refs are never deleted. This is where the candidates disagree, and
it is the ruling that decides the ticket's size.** Candidate-codex deletes registered branches under
`harness/<ticket-id>/` after a successful run when git proves them contained in the ticket branch;
candidate-claude never passes `deleteBranch`. I rule for **never**, on four grounds, the third of
which is decisive:

1. *Nobody asked for it.* The ticket's complaint about branches is that a checked-out branch
   **cannot be deleted**. Removing the worktree restores the maintainer's ability to delete it. An
   automatic deletion is an unrequested default, which `harness/roles/developer-generalist.md` tells
   the implementer to refuse in as many words.
2. *The two acts are not symmetric in reversibility.* `ensureWorktree` re-creates a removed directory
   from its branch; nothing re-creates a deleted branch by name without hunting a SHA out of the
   reflog.
3. **On a completed chore run, `harness/<id>/implement` is contained in `harness/<id>/integration` by
   construction** — `integrate` merged it. So candidate-codex's rule deletes, on *every single chore
   run*, precisely the branch this repository reads *after* the run ends: Q-0050's rounds 4 and 6
   diffed it by hand, Q-0077's `--base` flag exists so a contained ticket can still be reviewed,
   Q-0079's three hand-review rounds ran against branches whose runs had finished, and Q-0057
   deliberately ran `harness lint` **inside** a worktree to lint the changed file rather than
   `main`'s. A policy that is correct in the abstract and deletes the artifact the repository's own
   review practice depends on is the wrong policy.
4. *It keeps the half-cleaned state unrepresentable.* Candidate-codex's own criterion 8 asks that no
   state leave a branch deleted while its directory remains, or a directory removed while its branch
   is the only ref to the work. Under R-3 the first is impossible by construction and the second
   cannot arise, because the branch always survives. That invariant is candidate-codex's contribution
   and it is better served by candidate-claude's rule than by candidate-codex's.

**Register row 20 is therefore settled rather than closed.** `harness/port-charter.md:146` records
*"`finish()` does **not** roll back task branches — a known gap carried into M2"*, on the authority of
*"M1 closed"* (2026-08-24). The ticket is right that this and the worktree lifecycle are one question;
the answer is opposite for each half, and `spike/src/engine.js:670–674`'s own comment is why:

> *"Nothing is lost: each task's work stays on its own branch. See Q-0033."*

The ticket-branch rollback is considered safe **because** task branches survive it. So the gap stops
being carried and becomes decided behaviour: **refs are kept, deliberately.** That *strengthens* the
pin forbidding branch deletion rather than releasing it, which is why R-6 row 1 moves a comment and
not an assertion.

**R-4 — a worktree that is not clean is kept, and the run says which paths kept it.**
`removeWorktree` runs `git worktree remove --force`, which discards uncommitted and untracked
content. Every worktree an agent step used has been through `commitAll` (`git add -A`) and is clean;
both on disk today are. The one at risk is the integration worktree, where a maintainer makes hand
fixes. The guard costs one `git status --porcelain` per worktree, turns an irreversible `--force`
into a safe one, and reports when it fires. *"Never default silently"*, applied to a delete.

**R-5 — a removal that fails cannot change a run's outcome.** `removeWorktree` wraps only the branch
delete in `safe()`; a failing `git worktree remove` **throws**. Thrown from inside `finish()` that
would corrupt the terminal record of a run that had otherwise completed — and `finish()` emits the
terminal event, so a throw mid-way could leave a run with a manifest, a history entry and no
terminal. Each removal is guarded individually; a failure is one `warn` and nothing else moves.
Candidate-codex's *"must not emit a second terminal outcome or reclassify the run as failed"* is the
sharper wording and is adopted.

**R-6 — the seven guards, and which of them move.** Changing a landed pin is a deliberate act a
reviewer will correctly block unless it is authorised here by name and line — the cost Q-0080's
requirement stated plainly against its own ticket body. Each row says what is authorised. All seven
were read today.

| # | Guard | What it forbids | Verdict |
| --- | --- | --- | --- |
| 1 | `packages/core/src/fanout/fanout.source.test.ts:209` | the literals `removeWorktree`, `for-each-ref`, `'-D'`, `'branch', '-d'` in **every** fan-out module, plus `fanout.ts` importing only `ensureWorktree` | **Assertions stand, unedited.** The fix touches no fan-out module and deletes no ref, so every clause stays true. Its **comment** says row 20 *"stays open"* and *"Q-0062 owns the worktree lifecycle"*; both become false. **Comment edit authorised — AC-10.** |
| 2 | `packages/core/src/engine/q0050.source.test.ts:133` (AC-9d) | any engine file matching `/(?:reset\|delete\|remove)TaskBranch/i`, derived from `production` | **Untouched, and not to be revised.** R-3 keeps task branches, so nothing named that is written. This is a naming constraint on the implementation, not a pin to move. Candidate-codex's criterion 15 revises it; **rejected** with R-3. |
| 3 | `packages/core/src/fanout/fanout.test.ts:27` | nothing; its comment cites the ticket's **four-worktree** count, false in landed source | **Comment corrected to today's measurement** — two worktrees, one ticket, 277 MB. **Not** reduced to a rule with no measurement behind it (candidate-codex 16): the comment's value is that it names a live defect a suite must not worsen. |
| 4 | `packages/core/src/engine/q0050.source.test.ts:82` | `production` is **exactly** `channel, composite, diff, engine, lifecycle, loaders, prompt, routing, steps, suite-output, types` | **Untouched — and it is why no new engine module may be added.** |
| 5 | `packages/core/src/fanout/fanout.source.test.ts:33`, `:38–41` | the fan-out folder is exactly `command.ts` + `fanout.ts`; `fanout.ts` exports exactly twelve names | **Untouched.** No new fan-out file or export. |
| 6 | `packages/core/src/fanout/fanout.source.test.ts:50` | `packages/core/src/index.ts` is byte-pinned | **Untouched.** The fix adds no public export. |
| 7 | `packages/core/src/git/git.source.test.ts:32` | the git module's export register, which already lists `removeWorktree` | **Untouched.** The primitive is ported, tested and correct. |

**R-7 — four assertions in the spike suite stop being true, and each is re-aimed at evidence that
survives the removal.** None is deleted; each proves the same property from a more durable source,
which is strictly better than what it does now. All four were read today.

| Site | What it asserts today | Why it breaks | Re-aim |
| --- | --- | --- | --- |
| `spike/test/smoke.js:59–60` | `git worktree list` includes `harness/T-0001/contracts` — *"architect ran in its own worktree/branch"* | the worktree is removed at that run's `finish()` | assert the **branch** exists and that the step's own `contracts: worktree … (harness/T-0001/contracts)` line was printed (`engine.js:247`) — which is what the sentence claims — and add the new assertion that the directory is gone |
| `spike/test/smoke.js:84` | `.harness/worktrees/harness__T-0001__integration/.installed` exists — *"integrate runs `commands.install` in the integration worktree before the tests"* | the marker lives **inside** the removed directory | move the fixture's marker out of the worktree while keeping its cwd as the evidence — e.g. `install: sh -c "pwd > ../../install-cwd"`, which lands in `.harness/` and whose **contents** then prove install ran *in the integration worktree* |
| `spike/test/smoke.js:377` | `if (fs.existsSync(wt))` guards the entire `commitAll` backlog-guard block on the contracts worktree | the worktree is gone, so the block **silently becomes a no-op and the suite still reports green** | the block creates the worktree it needs, or asserts existence before entering. **The highest-value line in the table**: left alone it is *"a check that skips its subject must not report success"* (2026-08-25) inside the regression suite |
| `spike/test/q0006-engine.js:222–228` | three assertions read `unicode.txt`, `HEAD`'s message and `HEAD:src/task-a.ts` **inside** `harness__T-0001__task-a` after a completed run | the fixture pre-creates the directory (`:213`), the run reuses it, and a reused worktree is registered (AC-3) | read the same three facts from the **branch** — `git show harness/T-0001/task-a:…` — which is where the work has to be for the flow to mean anything |

`spike/test/smoke.js:721–722` is deliberately **not** in this table: that worktree is built outside
any run, so no `finish()` ever sees it, which is also AC-3's negative case.

On the `core` side no existing test breaks. The worktree-existence assertions there are dry-run
negatives, which AC-7 keeps true, and one manifest assertion that records a path as a string and
never its existence.

**R-8 — the fix adds no module, no export and no configuration key.** R-6 rows 4–6 make this a
constraint rather than a preference, and it is the right shape anyway: the removal belongs on the
run's terminal path, where the status is known, and not inside a step kind. Placing it there is also
what keeps the `composite.test.ts`, `agent-step.test.ts` and `run-composition.test.ts` assertions
untouched — they drive `runFanOut`, `runIntegrate` and `runAgentStep` directly and never `finish()`.

---

## Acceptance criteria

Thirteen criteria. **"Both trees" means `spike/src/*` and `packages/core/src/*` in one change (R-1),
and every behavioural criterion below is proven by an automated test in each tree.**

**AC-1 — a run that finished removes the worktrees it obtained, and says so.** On terminal status
`completed` or `regressed`, and only then, `finish()` removes each registered worktree through the
existing `removeWorktree`, emits one `info` per removal naming the branch and the directory, and
appends one `runs.log` line in the shape of the existing rollback line
(`run=<n> removed-worktrees=<n> kept=<n>`). Removal is attempted before the terminal event is
emitted, and the terminal event is emitted exactly once. *Test:* drive a flow with a `worktree: true`
step and an `integrate` step to `completed`; both directories are absent from `.harness/worktrees/`
and from `git worktree list`, the two `info` lines are in the stream, the `runs.log` line is present,
and allocating the next run id still returns `n+1` — `nextRunId` reads the `start` line only
(verified today at `spike/src/engine.js:44` and the round-2 note at `:385–386`), so an added line
cannot move an id.

**AC-2 — a run that did not finish leaves everything.** On `failed`, `aborted` or `interrupted`, no
worktree is removed and no ref is touched; the existing ticket-branch rollback is unchanged. The
condition is the **same disjunct** the rollback already reads in each tree, so the two can never
disagree. *Test:* the same flow made to fail at its last step — both directories are still on disk,
`git worktree list` still reports them, and the ticket branch is restored exactly as today.

**AC-3 — only what this run obtained, and reuse counts.** The removal set is the branches for which
**this run** obtained a worktree, registered at the `ensureWorktree` / `ticketWorktree` call sites the
run reaches, in run-scoped in-memory state, keyed by branch so the repeated `ticketWorktree` calls
collapse to one entry and concurrent fan-out children cannot overwrite one another's bookkeeping. A
worktree the run **reused** is registered, because a run that reused it is the run that finished with
it. A worktree the run never touched is never removed, whoever created it, and nothing enumerates
`.harness/worktrees/` or the ref namespace. *Test:* a hand-created worktree for an unrelated branch
survives a `completed` run in the same repository; a pre-created worktree that the run then reuses is
removed. **The implementer re-derives the call-site list from the tree rather than from this document
or the ticket body** — Q-0051 and Q-0053 each found an inherited line map stale, twice naming
functions that no longer existed and once one that was never named at all.

**AC-4 — no ref is ever deleted.** `removeWorktree` is called without `deleteBranch` at every call
site, in both trees, and no other ref-deleting command is introduced. Every removed worktree's branch
still resolves at the same commit after the run. A source pin in **each** tree asserts that no call
site passes `deleteBranch: true` and that no production file gains a branch-delete verb. *Test:*
after AC-1's run, `git branch --list 'harness/*'` still reports the step branch and the integration
branch at their pre-removal commits; and the pin fails when a call site is edited to pass
`deleteBranch: true`.

**AC-5 — a worktree that is not clean is kept, and the run names the paths that kept it.** Before
removing, the run reads `git status --porcelain` in the worktree. Non-empty output means the worktree
is kept and a `warn` names the branch, the directory and the paths. *Test:* write an untracked,
non-ignored file into the worktree before the terminal step — the directory survives, its branch
survives, and the warning names that path.

**AC-6 — a removal that fails does not change the run's outcome.** Each removal is individually
guarded. A failure emits one `warn` carrying the branch, the directory and git's first line of
stderr; cleanup continues for the remaining registered worktrees; and the run's status, its stage
transition, its manifest, its ticket history entry, its terminal event and its exit code are exactly
what they would have been. No second terminal event is emitted and the run is not reclassified.
*Test:* stub the remover to throw on the first of two worktrees — the second is still removed, the
terminal event and history entry are byte-identical to the control run, and the warning is in the
stream.

**AC-7 — a dry run removes nothing, because it obtains nothing.** The existing assertions that
`.harness/worktrees` does not exist after a dry run stay green **unedited**, and a dry run to
`completed` over a repository that already holds worktrees removes none of them and deletes no ref.
*Test:* create a worktree by hand, run `--dry` to a `completed` terminal, assert it survives with its
branch at the same commit.

**AC-8 — both trees, and core's verdict depends on neither this checkout nor this account.** Each
tree gains the lifecycle call sites and run-scoped registration for AC-1 to AC-7, with behavioural
tests in the tree where the behaviour lives. Core's tests build their own repositories and use git
itself as the witness; no test's verdict may depend on this repository's branches, its ignored
directories, its git identity or the machine's git configuration — *"A test's verdict is a property
of the commit, not of the checkout or the account"* (2026-08-30). *Test:* `pnpm sweep:git-identity`
is green, and the new tests pass in a bare checkout and in one carrying `.harness/worktrees` and
`.quorum/runs`.

**AC-9 — placement: no new module, no new export, no new configuration.** The engine folder is still
the eleven modules `q0050.source.test.ts:82` names; the fan-out folder is still two files with twelve
exports; `packages/core/src/index.ts` is byte-identical; no `harness.yaml` key, ticket frontmatter
field, run-manifest field, zod schema or flow file is added or changed. In `core` the removal is
reached from `lifecycle.ts` through a capability injected by `engine.ts`, in the shape `resetBranch`
and `readBranchHead` already use, so `lifecycle.ts` gains no git import. *Test:* R-6 rows 4–7 pass
unedited.

**AC-10 — exactly two comments move, and each says what replaced it.**
`fanout.source.test.ts:209`'s comment stops saying row 20 *"stays open"* and states what settled it,
citing the decision by title and date; **its assertions are unchanged**. `fanout.test.ts:27`'s
comment carries today's measurement instead of the four-worktree count. `harness/port-charter.md`
register row 20 records that the gap is settled rather than carried, and names the entry. *Test:*
both files' assertions still pass unedited, and no comment in either file names Q-0062 as an open
owner.

**AC-11 — the four spike assertions are re-aimed, and the silent one is made loud.** Each row of R-7
is delivered as written: the property each assertion proves is unchanged, and the evidence it reads
survives the worktree's removal. `smoke.js:377`'s `if (fs.existsSync(wt))` no longer lets the block
pass by not running. *Test:* revert the fix and each re-aimed assertion still passes — they assert
branch and output facts, not the removal — and make the `smoke.js:377` block's subject absent, at
which point `smoke.js` goes **red** instead of green.

**AC-12 — the durable record says what the lifecycle is, in the four places that currently do not.**
`docs/04-architecture.md` §6 and `docs/02-sdlc-pipeline-spec.md` state that a run removes the
worktrees it obtained when it finishes and keeps them when it does not, and that no ref is ever
deleted; `docs/06-development-plan.md`'s Q-0062 entry is rewritten to what shipped; and the change
**cites the decision entry of GO-1 by title and date** at the call site's authority line. No new
GLOSSARY headword — *worktree* is existing vocabulary and this adds a property to it, not a term.
Each numbered doc's status line is bumped with the date and what changed. *Test:*
`packages/shared/src/docs.test.ts` stays green and no numbered doc still implies a worktree is
permanent.

**AC-13 — each new guard is demonstrated red before it is trusted.** The implement report shows, for
AC-1, AC-2, AC-4, AC-5 and AC-11, the guard failing against the unchanged function and passing
against the new one — **by restoring the old file, not by describing it**. This is the discipline
Q-0058's gate used and the one Q-0071's round 3 shows is not optional: demonstrating that a guard has
a subject proves the guard fires, not that each of its clauses does.

### On size

Thirteen is at the top of the band and it is real rather than padded: AC-1 to AC-8 are the behaviour,
AC-9 to AC-11 are the guards the port deliberately landed in the way, and AC-12 to AC-13 are the
record. **There is no clean seam** — every criterion is forced by the same one-predicate behaviour
change, and splitting the trees apart would violate R-1 while splitting the guards from the behaviour
would ship a change its own suite rejects. The thing that *would* have blown this past the band is
branch deletion, which R-3 strikes: it is what took candidate-codex to twenty numbered items and
would have required revising two landed pins' assertions rather than two comments.

---

## Non-goals

- **A `harness worktrees` / `--prune` command.** No CLI surface is added — which means **this ticket
  removes none of the 277 MB on disk today**: Q-0058's run has finished and nothing will revisit it.
  Stated rather than implied, with its successor written out in full below.
- **Enumerating or pruning worktrees and refs left by earlier runs.** Cleanup is run-scoped
  registration only; nothing walks `.harness/worktrees/` or the ref namespace.
- **Repairing stale worktree registrations.** Q-0048's merged requirement routed both *"repairing
  stale git worktree registrations"* and *"calling `removeWorktree`"* here; only the second is
  delivered. `ensureWorktree` and `resetBranchTo` both choose their route from `fs.existsSync(dir)`
  alone (preserved defect, Q-0042 finding 5), so a hand-deleted directory still wedges its branch.
  Removing *through git* is what stops **new** stale registrations; repairing old ones is a different
  act on repository-wide state.
- **Deleting any branch, ever** — task, step, integration or ticket (R-3). Register row 20 is
  **decided**, not deferred.
- **Changing `removeWorktree` itself**, its signature, or its four unit tests. This ticket is call
  sites.
- **A `--keep-worktrees` flag or a `harness.yaml` policy key.** See OQ-1 and OQ-2.
- **Making the engine safe for concurrent runs** (Q-0039). See RK-1.
- **Cleaning `node_modules` separately from the worktree that contains it.**
- **The cutover**, Q-0010's scope, and anything on v1's exclusion list.

### The successor, written out in full so the obligation cannot expire

> **`harness worktrees` — list what past runs left, and prune it.** Opened from Q-0062, which fixes
> the lifecycle prospectively and by design removes nothing already on disk: at the time it shipped
> that was two directories and 277 MB from one closed ticket, plus whatever every earlier run left.
> The command has three separable jobs. **List** what is under `.harness/worktrees/`, with each one's
> branch, its size and its containment against the base — which `containment()` already answers and
> the board already renders. **Prune** the git registrations of directories that are gone, which is
> the repair Q-0048 routed to Q-0062 and Q-0062 declined, and which `ensureWorktree`'s and
> `resetBranchTo`'s `fs.existsSync`-only routing (preserved defect, Q-0042 finding 5) makes reachable
> by hand-deleting a directory. **Remove** worktrees whose branch is contained in the base, which is
> the only definition of *safe to remove* that does not require knowing which run created it. It must
> refuse a worktree that is not clean, on Q-0062's AC-5, and it must never delete a branch, on
> Q-0062's AC-4 and R-3 — a maintainer deleting a ref by hand is a different act from a command doing
> it on their behalf. Lands in the CLI, so it lands after or with Q-0010; it is a new command rather
> than a port, and Q-0010 is the port, so it needs its own ticket rather than being folded in. Both
> trees if it lands before the cutover.

---

## Open questions

| # | Question | Owner | Blocking? | Ruling |
| --- | --- | --- | --- | --- |
| OQ-1 | Should `harness run` gain `--keep-worktrees`? | maintainer, at the gate | No | **Decline.** The escape hatch already exists and is better aimed: a run that did not finish keeps everything, which is when inspection is wanted, and the human gate is a *step inside the run* — so every worktree is still on disk while the gate is open, which is exactly when Q-0057 ran `harness lint` inside one. A flag is one line and can be added later; an unrequested one is a default taken on someone else's behalf. |
| OQ-2 | Should the policy be a `harness.yaml` key? | maintainer | No | **Decline for now**, on Q-0080's precedent: a key fixes nothing until someone edits a file, so every existing backlog keeps the defect *unless configured*. It stays available as a later refinement over working behaviour. |
| OQ-3 | Should the **integration** worktree survive until its branch is merged? | maintainer | No | **No.** `finish()` runs after every step of the flow, so the maintainer's inspection window at the gate is untouched; the merge itself is done from the main checkout; and the post-merge verification this repository actually practises is *"forced on `main` after the merge"*. Keeping it would halve the saving and leave the branch checked out, so `git branch -d` would still refuse — half of what the ticket is about. What the maintainer keeps is the **branch** (R-3), which is what a post-hoc review reads. |
| OQ-4 | Does removal need to wait for Q-0039 (one run at a time per ticket)? | maintainer | No | **No**, but said out loud rather than by omission — see RK-1. |
| OQ-5 | Should a `regressed` run remove, like a `completed` one? | maintainer | No | **Yes.** It is the same disjunct `finish()` already uses for both the stage transition and the rollback, in both trees, and a regressed run *did* what it set out to do — it sent the ticket back deliberately. Splitting them would mean two conditions where the engine has one, and R-3 means the regressed ticket's next round loses nothing: every branch survives. |
| OQ-6 | Should containment gate the removal, as candidate-codex proposes? | head-of-product | No | **No** — struck by R-3. Once no ref is deleted, containment answers nothing: a removed directory is re-creatable from its branch whether or not it is contained, so the check would cost a git call per worktree on the terminal path and change no outcome. |

**No open question here is a blocker.** None changes a file format, a schema, the adapter contract or
the gate model. Two preconditions are real, and they are gate obligations rather than questions,
because no agent on the chore route can perform either.

---

## Gate obligations

**GO-1 — the decision entry is written by hand at the requirements gate, before the implement step
runs.** AC-12 requires the change to *cite* the entry; `harness/roles/developer-generalist.md` says
in as many words *"You do not add to `docs/decisions/` or its index; a decision is the human's to
record"* — verified today, along with the fact that `docs` **is** otherwise in that role's write
paths, so every other clause of AC-12 is writable by the implementer. This is the seventh appearance
of a loop handed work no agent on its route can perform; naming it here rather than smuggling it in
as a criterion is the Q-0069 AC-11(b) failure avoided rather than repeated, and it is why this
document names the entry instead of asserting it.

> Proposed title: **"A run removes the worktrees it made, and never the refs"**, carrying R-2, R-3
> and R-4, naming register row 20 (`harness/port-charter.md:146`) and *"M1 closed"* (2026-08-24) as
> what it settles, and recording the reversibility asymmetry and the post-hoc-review argument as the
> reason branch deletion was considered and refused.

**GO-2 — the freeze SHA is re-recorded when the merge lands, and only a human can do it.**
`harness/port-charter.md` §3's answer to a legitimate `spike/src` change on the base has two steps:
mirror into `packages/core` — which R-1 already requires — and **re-record `freeze-sha` at
`harness/port-charter.md:265`, in the same commit, at the tip that carries the mirrored change**. The
implement step cannot: the merge commit's SHA does not exist while it is running. Measured today:
`7b6bc70…` is an ancestor of `main` and `git diff --name-only 7b6bc70 main -- spike/src` returns zero
files, so the job is green **before** the merge; after it, and until the SHA is re-recorded, *"port
freeze (base unchanged since the freeze SHA)"* is red on `main` — which is the guard working, not a
defect. **Q-0062 is the first ticket to walk this path.** Record it at the gate, after merging, and
push both together.

---

## Risks

**RK-1 — a concurrent run on the same ticket.** Q-0039 is open, so two runs on one ticket already
share a run id and a worktree. With removal, run A finishing while run B is mid-step removes a
directory B is writing in, and `--force` discards whatever is uncommitted there. This makes an
existing collision slightly worse rather than creating one, and the exposure is bounded: `commitAll`
commits after every agent step, so the window is one step wide and the work is on a branch either
side of it — and under R-3 that branch is never deleted. Stated, not fixed; it is Q-0039's, and both
entries already say Q-0039 should land before M3 makes concurrent runs ordinary.

**RK-2 — a cold worktree reinstalls.** Removing the integration worktree means the next run's
`integrate` installs from scratch rather than over a warm `node_modules`. `commands.install` runs on
every `integrate` regardless, so the change is a cold install rather than a new one; Q-0065 measured
`integrate` at 25–30 s including two installs. Accepted: 277 MB per ticket against tens of seconds
per integrate, and the pnpm store makes the reinstall a link rather than a download.

**RK-3 — a permanently dirty worktree is never cleaned.** AC-5 keeps a worktree holding untracked
non-ignored content, so a repository whose install writes such a file accumulates exactly as before.
The mitigation is that it is *visible*: the run names the paths every time, so the answer is one
`.gitignore` line rather than a mystery. It is also why R-7 moves the smoke fixture's marker out of
the worktree — left where it is, that fixture's integration worktree would be permanently dirty and
the suite would silently never exercise removal on it.

**RK-4 — the run context's shape.** The registration set is a new field on the run context in both
trees. Q-0051 added three fields to the same object without incident, but a source-level assertion
over the context literal would fail; **check before assuming, and report rather than edit** if one
exists.

**RK-5 — the first use of §3's re-record path (GO-2).** If the SHA is recorded against the wrong
commit the guard fails closed and says so — it refuses a SHA that is not an ancestor of the base — so
the failure mode is a red job with a precise message, not a silent one.

**RK-6 — a reviewer blocks the comment edits.** Two landed pins' comments change (AC-10) and one
charter register row changes. All three are authorised in this document by name and line, which is
what Q-0080's requirement established as the way to spend that cost deliberately. A reviewer blocking
an **assertion** change is correct — none is authorised.

**RK-7 — an implementer reads R-3 as an invitation to tidy refs anyway.** The register row moving from
*"carried gap"* to *"decided"* could be misread as opening branch deletion. AC-4's source pin in each
tree is the guard against exactly that, and it is one of the five AC-13 demonstrates red.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no environment variable is read, no credential exists on this path. |
| **Worktree safety** | The subject. The invariant is strengthened, not weakened: a flow still never writes the user's working tree, and now also stops leaving directories in it. `.harness/` is in `.gitignore`, so nothing removed here was ever visible to `git status`. No worktree outside `.harness/worktrees/` is ever touched, no worktree the run did not obtain is ever touched, and no ref is ever deleted (AC-4). `.quorum/` remains run history and is not touched. |
| **Gate behaviour** | Unchanged. No gate is declared, moved or automated; no exhaustion gate is involved. Removal happens in `finish()`, after every step including the human gate — so a maintainer inspecting at the gate still has every worktree the run made, and a run that dies at a gate keeps them all (AC-2), which is the recorded crash-recovery workflow. |
| **File format and schema** | Nothing changes. No `harness.yaml` key (OQ-2 declines one), no ticket frontmatter field, no run-manifest field, no zod schema, no flow file. `runs.log` gains one line whose shape matches the existing rollback line; `nextRunId` reads the `start` line only, verified today, so it cannot move a run id (AC-1). |
| **Cross-vendor rule** | Unchanged; `chore.yaml` already declares `cross_vendor: required`. |
| **Lint rules** | TypeScript stays strict, no `any`, no unjustified `@ts-ignore`, no deprecated API. No flow file changes, so `lintFlow` has no new subject and `harness lint` is expected to report 6/6 unchanged. `spike/**` stays outside ESLint's scope. |
| **Product-agnostic** | No product name, no product-specific rule. |
| **Cold-clone impact** | Positive and passive. Nothing is added to the first thirty minutes — no command to learn, no flag to discover — and an adopter's first ticket stops leaving a second copy of the dependency tree in their checkout. |
| **Cost** | No adapter call is added or removed. RK-2 is the only cost and it is measured. |

---

## Provenance

**Candidate-claude supplied the spine and every ruling that survived.** R-1 (both trees, on the
measured absence of any `@quorum/core` importer), R-2 (the complement of the existing rollback
disjunct), R-3's *never delete a ref* and the `engine.js:670–674` comment that argues it, R-4 (the
cleanliness guard), R-6's discovery that there are **seven** guards rather than the three the ticket
names, R-7's four re-aimed spike assertions — including `smoke.js:377`, the silent-skip line, which
neither the ticket nor candidate-codex saw — R-8 (no new module), the `nextRunId` argument, the
`--dry` criterion, OQ-1 to OQ-5, GO-1, GO-2 and the successor body. Its structure is this document's
structure.

**Candidate-codex supplied four things that improved it**, each promoted into a criterion rather than
appended: the *half-cleaned state* invariant, which turns out to be an argument **for**
candidate-claude's rule rather than for its own (R-3 clause 4); the sharper terminal-path wording —
*"must not emit a second terminal outcome or reclassify the run as failed"* — now AC-6; the explicit
namespace and no-enumeration bound, now AC-3 and a non-goal; and the requirement that core's tests
use git as the witness and never depend on this repository's branches, ignored directories, identity
or machine configuration, now AC-8, which is Q-0079's rule applied *before* an implementer can break
it. Its risk list also named the concurrent-registration hazard that AC-3 now bounds.

**Where they disagreed, I picked candidate-claude and struck candidate-codex's branch deletion**
(its criteria 4, 8's deletion clause, 14 and 15), on R-3: on a completed chore run
`harness/<id>/implement` is contained in `harness/<id>/integration` by construction, so that rule
deletes on every run the exact branch Q-0050's rounds 4 and 6, Q-0077's `--base` flag, Q-0079's three
hand reviews and Q-0058's own review all read after their runs had ended. Removing a directory is
reversible from its branch; deleting the branch is not. That strike is also what returns the ticket
to thirteen criteria from twenty.

**Struck from candidate-codex as not independently testable criteria of this change:** its 18
(existing safety boundaries remain green), 19 (both suites pass after installing dependencies) and 20
(the cross-cutting checklist). The first is an invariant, the second a precondition every ticket
carries, the third a section — none is a criterion, and counting them made a seventeen-criterion
requirement present as twenty. The checklist appears above as a checklist.

**Struck from candidate-codex:** its 16, which would have replaced `fanout.test.ts:27`'s stale
four-worktree count with a rule carrying no measurement. AC-10 corrects the number instead, because
the comment's value is naming a live defect a suite must not worsen.

**Corrected in both:** the ticket body calls the port charter's `children:` list *"Q-0009's fifteen
tickets"*; it holds fourteen ids at `harness/port-charter.md:264`. The conclusion — that Q-0062 is not
among them and may write `spike/src` — is unaffected and was re-verified.

---

## Verified by reading or measuring today, not cited from a document

**Read:** `spike/src/git.js:26`; `spike/src/engine.js:240–262`, `:645–700`, `:1010–1080`;
`spike/src/fanout.js:100–110`, `:223`; `packages/core/src/git/git.ts:81`;
`packages/core/src/engine/lifecycle.ts` (whole), `engine.ts:190–270`;
`packages/core/src/engine/q0050.source.test.ts:70–150`;
`packages/core/src/fanout/fanout.source.test.ts:195–240`;
`packages/core/src/fanout/fanout.test.ts:15–45`; `packages/core/src/git/git.test.ts:526–550`;
`spike/test/smoke.js:50–95`, `:368–390`; `spike/test/q0006-engine.js:205–235`;
`harness/flows/chore.yaml` (whole) and the last steps of the other six flows;
`harness/roles/developer-generalist.md` (whole); `harness/port-charter.md:117`, `:146`, `:255–269`.

**Measured:** `git worktree list` (three entries, two of them Q-0058's); `du -sh` per worktree
(139 M + 138 M); `git branch -a` (five refs); `grep -rn removeWorktree` across `spike`, `packages`,
`harness`, `docs`, `.github`; `grep -rn '@quorum/core'` across `packages` and `apps` (no importer);
`git merge-base --is-ancestor 7b6bc70… main` (true);
`git diff --name-only 7b6bc70… main -- spike/src` (zero files); the id count of the charter's
`children:` line (fourteen); `nextRunId`'s read of the `start` line.
