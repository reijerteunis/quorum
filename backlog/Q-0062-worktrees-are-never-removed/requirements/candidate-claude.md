# Q-0062 — Worktrees are never removed

*Requirement candidate, product-manager (claude), 2026-08-31 · route **chore** · consumes
`requirements`, produces `reviewed` · surfaces: `spike/src`, `packages/core/src`, both test suites,
`docs/`. Every measurement below was taken today against the working tree; nothing is inherited from
the ticket body without being re-run, per its own instruction not to re-derive the 2026-08-26
count.*

---

## Problem

`removeWorktree` exists in both trees, is exported, and is tested — four tests in
`packages/core/src/git/git.test.ts:526–550` cover removal, idempotence, branch deletion and the
refusal to delete a checked-out branch. **It has no caller in either tree.** A run creates worktrees
at three sites and removes them at none:

| Site | Spike | `packages/core` |
| --- | --- | --- |
| an agent step with `worktree: true` | `engine.js:246` | `engine/steps.ts:203` |
| the ticket/integration worktree (`ticketWorktree`) | `fanout.js:223`, called from `engine.js:1018`, `:1061`, `:1074` | `fanout/fanout.ts:328`, called from `engine/composite.ts:86`, `:176`, `:222` |
| `removeWorktree` | `git.js:26` — **zero callers** | `git/git.ts:81` — **zero callers** |

**Measured today, 2026-08-31**, in this repository:

```
$ git worktree list
…/.harness/worktrees/harness__Q-0058__implement      85467fd [harness/Q-0058/implement]
…/.harness/worktrees/harness__Q-0058__integration    dc22890 [harness/Q-0058/integration]

$ du -sh .harness/worktrees/*
139M  harness__Q-0058__implement      # 125M node_modules + 4.0M spike/node_modules
138M  harness__Q-0058__integration    # 125M node_modules + 4.0M spike/node_modules
                                      # 277M total, from one closed ticket

$ git branch -a | wc -l
5                                     # two of the five are Q-0058's, held checked out
```

Both are **clean** — `git status --porcelain` returns nothing in either — because `commitAll` commits
each agent step's worktree and `node_modules/`, `.turbo/`, `.quorum/` and `.harness/` are all in
`.gitignore`. So nothing is holding them; nothing has been asked to let them go.

Three consequences, in the order they cost something:

1. **277 MB per closed ticket, forever.** The qualifier in earlier accounts — *"once `integrate` has
   installed there"* — is wrong: both directories carry 125M of `node_modules`, including the
   `implement` one, where `commands.install` never runs (`composite.ts:290`, `engine.js:1034` run it
   only in an `integrate` worktree). The implementer builds it by hand, which is the cost Q-0049's
   run recorded paying and `harness/rules.md` now instructs every implementer to pay.
2. **A checked-out branch cannot be deleted.** `git branch -d harness/Q-0058/implement` refuses
   while a worktree holds it, so the branch outlives the ticket too. The ticket body's older claim
   that this is *"how `git branch -a` reached the size it is now"* no longer reproduces — the list
   has since been pruned by hand to five — and is not inherited here. The mechanism is intact and
   the accumulation evidence for it is not.
3. **State outliving the run that created it.** A run that does not complete resets the ticket
   branch (`engine.js:650`'s rollback block, `engine/lifecycle.ts:33–43`) and leaves the directory,
   so the worktree can hold a merge that no ref points at any more.

**The only thing that has ever removed a worktree in this repository is a person remembering to.**
The four directories the ticket recorded on 2026-08-26 are gone; nothing in either tree removed
them.

### What this requirement adds to the ticket body

Three findings the body does not carry, each of which changes what an implementer must do:

- **The freeze's SHA-anchored half is now active**, and the body's scope paragraph is only half
  right. `harness/port-charter.md:265` reads `freeze-sha: 7b6bc70…`, recorded 2026-08-30, and
  `git diff 7b6bc70 main -- spike/src` is **empty today**. The body is right that the *branch-scope*
  half does not apply — Q-0062 is not in the `children:` list at `:264`, so that job reports out of
  scope. But the freeze-SHA job (`ci.yml`, `BASE: origin/main`) goes **red on `main`** the moment a
  `spike/src` change lands, unless §3's two-step answer is performed: mirror into `packages/core`,
  and re-record the SHA. **Q-0062 is the first ticket that will exercise that path.** See R-1 and
  GO-2.
- **There are seven guards, not three.** The body names three pins. Four more constrain the *shape*
  of the fix — the engine folder is pinned to exactly eleven modules, the fan-out folder to two files
  and twelve exports, `index.ts` is byte-pinned, and the git module's export list is a register.
  None of them moves if the fix is placed correctly; all of them fail if it is not. See R-7.
- **Four assertions in the spike suite break**, and one of them breaks *silently*. See R-8. The
  silent one is this repository's own recurring failure — a check that skips its subject and reports
  success — arriving in the regression suite.

---

## User stories

**Maintainer** (`maintainer`) — *"I ran two tickets through the flows last week. My repository is
1.4 GB heavier than the code in it, and `git branch -d` refuses on branches whose work is contained
in `main`. I did not ask for either and nothing told me."* A run that finished should leave the
repository holding its refs and its history, not its scaffolding.

**Cold-clone adopter** (`adopter`) — *"I cloned it, ran one ticket to a merged branch in under thirty
minutes, and the checkout grew by a quarter of a gigabyte of `node_modules` I cannot find and was
not told about."* The first ticket should not leave a second copy of the dependency tree behind, and
nothing about learning that should be in the first thirty minutes — there is no command to learn
here, only an absence.

**Adapter contributor** (`contributor`) — no story. The lifecycle is above the adapter layer and no
adapter learns anything from it.

---

## The rulings this requirement makes

**R-1 — the fix lands in `spike/src` and `packages/core/src` together, in one change.** The body
correctly says Q-0062 *may* write `spike/src`; it must. `packages/core`'s engine is executed by
nothing outside its own tests — `packages/cli/src` is Q-0008's scaffold and no file in the repository
imports `@quorum/core` — so a `core`-only fix removes zero worktrees until the cutover, which sits
behind Q-0010, which has no ticket. The spike is what runs every flow here, including this one. This
is the Q-0066 / Q-0068 / Q-0070 / Q-0080 shape, and Q-0057's precedent is the closest: a `core`-only
fix there would have protected **none** of the three tickets it existed to protect.

**R-2 — the rule is the exact complement of the rollback that is already there.** `finish()` in both
trees already asks one question: did this run do what it set out to do? On `completed` or
`regressed` it advances the stage and leaves the branch alone; on `aborted`, `failed` or
`interrupted` it rolls the ticket branch back to where it found it. Worktree removal is the same
predicate read the other way: **a run that finished removes the worktrees it materialised; a run
that did not leaves them, because a failed run's worktree is exactly the thing someone wants to
open.** One condition, two consequences, no new vocabulary — and it means the inspection story and
the cleanup story cannot disagree.

**R-3 — task branches are kept, and register row 20 is settled rather than closed.** The ticket says
this and the M1 item *"`finish()` does not roll back task branches"* are the same question and must
be decided together. They are, and the answer is opposite for each — which is only visible once you
read why the existing rollback is considered safe. `spike/src/engine.js`'s own comment above that
block says it:

> *"Nothing is lost: each task's work stays on its own branch. See Q-0033."*

**A task-branch rollback would delete the thing the ticket-branch rollback cites as the reason it is
safe.** So the decision is: **directories are removed, refs never are.** `deleteBranch` is never
passed. Row 20 stops being *"a known gap carried into M2"* and becomes decided behaviour, which
*strengthens* the pin that forbids branch deletion in the fan-out modules rather than releasing it.

**R-4 — a worktree that is not clean is kept, and the run says which paths kept it.**
`removeWorktree` runs `git worktree remove --force`, which discards uncommitted and untracked
content. Every worktree an agent step used has been through `commitAll` (`git add -A`) and is clean;
the two on disk today both are. The one at risk is the integration worktree, where a maintainer
makes hand fixes — the crash-recovery case. The guard costs one `git status --porcelain` per
worktree, turns an irreversible `--force` into a safe one, and when it fires it reports rather than
hides. This is *"never default silently"* applied to a delete.

**R-5 — a removal that fails cannot change a run's outcome.** `removeWorktree` wraps only the branch
delete in `safe()`; a failing `git worktree remove` **throws**. Thrown from inside `finish()` that
would corrupt the terminal record of a run that had otherwise completed. Each removal is guarded
individually and a failure is a `warn` naming the branch, the directory and git's first line of
stderr.

**R-6 — the fix adds no module, no export and no configuration key.** See R-7; the pins make this a
constraint rather than a preference, and it is the right shape anyway: the removal belongs on the
run's terminal path, where the status is known, and not inside a step kind. Placing it there is also
what keeps twenty-odd `composite.test.ts` and `agent-step.test.ts` assertions untouched — they drive
`runFanOut`, `runIntegrate` and `runAgentStep` directly, never `finish()`.

**R-7 — the seven guards, and which of them move.** Three are named in the ticket; four are not.
Changing a landed pin is a deliberate act a reviewer will correctly block unless it is authorised
here in as many words, so each row says explicitly what is authorised.

| # | Guard | What it forbids | Verdict |
| --- | --- | --- | --- |
| 1 | `packages/core/src/fanout/fanout.source.test.ts:209` | `removeWorktree`, `for-each-ref`, `'-D'`, `'branch', '-d'` in **every** fan-out module | **Assertions stand.** The fix touches no fan-out module. Its **comment** says row 20 *"stays open"* and *"Q-0062 owns the worktree lifecycle"*; both become false. **Comment edit authorised** — see AC-9. |
| 2 | `packages/core/src/engine/q0050.source.test.ts:133` (AC-9d) | any engine file matching `/(?:reset\|delete\|remove)TaskBranch/i`, derived from `production` | **Untouched.** R-3 keeps task branches, so nothing named that is written. This is a naming constraint on the implementation, not a pin to move. |
| 3 | `packages/core/src/fanout/fanout.test.ts:27` | nothing; its comment cites the ticket's **four-worktree** count, false in landed source | **Comment corrected** to today's measurement (two worktrees, one ticket, 277 MB). |
| 4 | `packages/core/src/engine/q0050.source.test.ts:82` | `production` must be **exactly** `channel, composite, diff, engine, lifecycle, loaders, prompt, routing, steps, suite-output, types` | **Untouched — and it is why no new engine module may be added.** Not named in the ticket. |
| 5 | `packages/core/src/fanout/fanout.source.test.ts:33`, `:38–41` | the fan-out folder is exactly `command.ts` + `fanout.ts`; `fanout.ts` exports exactly twelve names | **Untouched.** No new fan-out file or export. Not named in the ticket. |
| 6 | `packages/core/src/fanout/fanout.source.test.ts:50` | `packages/core/src/index.ts` is byte-pinned to one line | **Untouched.** The fix adds no public export. Not named in the ticket. |
| 7 | `packages/core/src/git/git.source.test.ts:32` | the git module's export register, which already contains `removeWorktree` | **Untouched.** The primitive is ported and needs no change. |

**R-8 — four assertions in the spike suite stop being true, and each is re-aimed at evidence that
survives the removal.** None of them is deleted; each proves the same property from a durable
source, which is strictly better than what it does now.

| Site | What it asserts today | Why it breaks | Re-aim |
| --- | --- | --- | --- |
| `spike/test/smoke.js:59–60` | `git worktree list` includes `harness/T-0001/contracts` after a completed solutioning run — *"architect ran in its own worktree/branch"* | the worktree is now removed at that run's `finish()` | assert the **branch** exists and the run's own `contracts: worktree …` info line was printed — which is what the sentence claims — and add the new assertion that the directory is gone |
| `spike/test/smoke.js:84` | `.harness/worktrees/harness__T-0001__integration/.installed` exists — *"integrate runs `commands.install` in the integration worktree before the tests"* | the marker lives **inside** the removed directory | move the fixture's marker out of the worktree while keeping its cwd as the evidence — `install: sh -c "pwd > ../../install-cwd"` lands it in `.harness/`, which `ensureWorktree` already excludes, and its **contents** then prove install ran *in the integration worktree* |
| `spike/test/smoke.js:377` | `if (fs.existsSync(wt))` guards the whole `commitAll` backlog-guard block on the contracts worktree | the worktree is gone, so the block **silently becomes a no-op** and the suite still reports green | the block creates the worktree it needs, or asserts existence before entering. **This is the highest-value line in the table**: left alone it is *"a check that skips its subject must not report success"* (2026-08-25) inside the regression suite |
| `spike/test/q0006-engine.js:212, :224–228` | three assertions read `unicode.txt`, `HEAD`'s message and `HEAD:src/task-a.ts` **inside** `harness__T-0001__task-a` after a completed run | the run materialised that worktree (the fixture pre-created the directory; the run used it) and now removes it | read the same three facts from the **branch** — `git show harness/T-0001/task-a:…` — which is where the work has to be for the flow to mean anything |

`spike/test/smoke.js:721–722` is **not** in this table and is deliberately left alone: that worktree
is built by `syncBaseIntoTicketBranch` outside any run, so no `finish()` ever sees it.

On the `core` side **no existing test breaks.** The only worktree-existence assertions there are
dry-run negatives (`run-composition.test.ts:290`, `composite.test.ts:600`, `:607`,
`agent-step.test.ts:100`), which stay true, and `agent-run.test.ts:306`, which asserts the manifest
records the worktree *path as a string* and never its existence.

---

## Acceptance criteria

Every criterion is written to be independently testable in **both** trees. "Both trees" means
`spike/src/*` and `packages/core/src/*` in one change (R-1).

**AC-1 — a run that finished removes the worktrees it materialised.** On a terminal status of
`completed` or `regressed`, `finish()` removes each worktree the run materialised during its own
execution, through `removeWorktree`, and the run's own output names each one. *Test:* drive a flow
with a `worktree: true` step and an `integrate` step to `completed`; both directories are gone from
`.harness/worktrees/` and from `git worktree list`.

**AC-2 — a run that did not finish leaves them.** On `aborted`, `failed` or `interrupted`, no
worktree is removed. The condition is the same disjunct the branch rollback already reads, so the
two can never disagree. *Test:* the same flow made to fail at its last step; both directories are
still on disk and `git worktree list` still reports them.

**AC-3 — `--dry` removes nothing, because it materialises nothing.** The existing assertions that
`.harness/worktrees` does not exist after a dry run (`run-composition.test.ts:290`,
`composite.test.ts:600`, `agent-step.test.ts:100`) stay green unedited, and a dry run over a
repository that *already* has worktrees removes none of them. *Test:* create a worktree by hand, run
`--dry` to completion, assert it survives byte for byte.

**AC-4 — only what this run materialised.** The set is the branches for which **this run** called
`ensureWorktree` or `ticketWorktree`, recorded at the call site and keyed by branch so the repeated
`ticketWorktree` calls collapse to one entry. A worktree the run never touched is never removed,
whoever created it. *Test:* a hand-created worktree for an unrelated branch survives a `completed`
run in the same repository.

**AC-5 — a worktree that is not clean is kept, and the run says why.** Before removing, the run reads
`git status --porcelain` in the worktree. Non-empty output means the worktree is kept and a `warn`
names the branch, the directory and the paths that kept it. `node_modules/`, `.turbo/`, `.quorum/`
and `.harness/` are in `.gitignore`, so an ordinary post-`integrate` worktree is clean — both on
disk today are. *Test:* write an untracked non-ignored file into the worktree before the terminal
step; the directory survives and the warning names that path.

**AC-6 — a removal that fails does not change the run's outcome.** Each removal is individually
guarded. A failure emits a `warn` carrying the branch, the directory and git's first line of stderr;
the run's status, its stage transition, its manifest and its exit code are exactly what they would
have been. *Test:* stub the remover to throw on the first of two worktrees; the second is still
removed, the terminal event and the ticket's history entry are unchanged, and the warning is in the
stream.

**AC-7 — no branch is ever deleted.** `removeWorktree` is called without `deleteBranch`, at every
call site, in both trees. The branches of every removed worktree still exist after the run. A source
pin in each tree asserts that no call site passes `deleteBranch: true`. *Test:* after AC-1's run,
`git branch --list 'harness/*'` still reports the step branch and the integration branch; and the
source pin fails when a call site is edited to pass it.

**AC-8 — placement: no new module, no new export, no new configuration.** The engine folder is still
the eleven modules `q0050.source.test.ts:82` names; the fan-out folder is still two files with
twelve exports; `packages/core/src/index.ts` is byte-identical; no `harness.yaml` key, ticket
frontmatter field, manifest field or zod schema is added or changed. In `core` the removal is reached
from `lifecycle.ts` through a capability injected by `engine.ts`, in the shape `resetBranch` and
`readBranchHead` already use, so `lifecycle.ts` gains no git import. *Test:* the four registers in
R-7 rows 4–7 pass unedited.

**AC-9 — exactly two comments move, and each says what replaced it.**
`fanout.source.test.ts:209`'s comment stops saying row 20 *"stays open"* and states what settled it,
citing the decision by title and date; its assertions are unchanged and its arithmetic is unchanged.
`fanout.test.ts:27`'s comment carries today's measurement instead of the four-worktree count.
`harness/port-charter.md`'s register row 20 records that the gap is settled rather than carried, and
names the entry. *Test:* both files' assertions still pass; neither comment names Q-0062 as an open
owner.

**AC-10 — the four spike assertions are re-aimed, and the silent one is made loud.** Each row of
R-8's table is delivered as written: the property each assertion proves is unchanged, and the
evidence it reads survives the worktree's removal. `smoke.js:377`'s `if (fs.existsSync(wt))` no
longer allows the block to pass by not running. *Test:* delete the fix and each re-aimed assertion
still passes (they assert branch and output facts, not the removal); make the block's subject absent
and `smoke.js` goes red instead of green.

**AC-11 — the removal is on the durable record, not only on the terminal.** Each removed worktree
produces one `info` in the run's stream naming the branch and the directory, and the run appends one
`runs.log` line in the shape of the existing rollback line
(`run=<n> removed-worktrees=<n> kept=<n>`). `nextRunId` reads the `start` line only, so an added line
cannot move a run id. *Test:* after AC-1's run, `runs.log` carries the line, and allocating the next
run id still returns `n+1`.

**AC-12 — each new guard is demonstrated red before it is trusted.** The implement report shows, for
AC-1, AC-2, AC-5 and AC-7, the guard failing against the unchanged function and passing against the
new one — by restoring the old file, not by describing it. This is the discipline Q-0058's gate used
and the one Q-0071's round 3 shows is not optional: a guard with a subject fires, which is not the
same as each of its clauses firing.

**AC-13 — the docs say what the lifecycle is, in the three places that currently do not.**
`docs/04-architecture.md` §6 (safety by construction) states that worktrees are removed by the run
that materialised them when it finishes and kept when it does not; `docs/02-sdlc-pipeline-spec.md`
states the same where it describes worktree-per-writing-step; `docs/06-development-plan.md`'s Q-0062
entry is rewritten to what shipped. No new GLOSSARY headword: *worktree* is existing vocabulary and
this adds a property to it, not a term. Each numbered doc's status line is bumped with the date and
what changed. *Test:* `packages/shared/src/docs.test.ts` stays green and no numbered doc still
implies a worktree is permanent.

**AC-14 — the decision entry exists before the code, and is cited by title and date.** The rule in
R-2, the ruling in R-3 and the guard in R-4 are one entry in `docs/decisions/`, indexed in
`docs/DECISIONS.md`. The criterion is that the change **names** the entry, not that the implement
step writes it — `developer-generalist` is forbidden to add one (`harness/roles/developer-generalist.md`),
so this is the Q-0070 AC-11 shape and its precondition is GO-1 below.

---

## Non-goals

- **A `harness worktrees` / `--prune` command.** No CLI surface is added. Which means **this ticket
  removes none of the 277 MB on disk today** — Q-0058's run has finished and nothing will revisit
  it. That limit is stated rather than implied, and its successor is written out in full below so
  the obligation cannot expire.
- **Repairing stale worktree registrations.** Q-0048's merged requirement routed both *"repairing
  stale git worktree registrations"* and *"calling `removeWorktree`"* here; only the second is
  delivered. `ensureWorktree` and `resetBranchTo` both choose their route from `fs.existsSync(dir)`
  alone (preserved defect, `fanout.ts:245`, Q-0042 finding 5), so a hand-deleted directory still
  wedges its branch. Removing through git is what stops *new* stale registrations; repairing old
  ones is a different act on repository-wide state and belongs with the command above.
- **Rolling back task branches** (register row 20). Decided, not deferred — R-3 rules it *keep*, and
  the entry in AC-14 records why.
- **Changing `removeWorktree` itself.** The primitive is ported, tested and correct; this ticket is
  call sites.
- **A `--keep-worktrees` flag or a `harness.yaml` policy key.** See OQ-1 and OQ-2.
- **Making the engine safe for concurrent runs** (Q-0039). See RK-1.
- **Anything on v1's exclusion list**, and the cutover.

### The successor, written out in full so it survives this ticket

> **`harness worktrees` — list what past runs left, and prune it.** Opened from Q-0062, which fixes
> the lifecycle prospectively and by design removes nothing already on disk: at the time it shipped
> that was two directories and 277 MB from one closed ticket, and every worktree from every earlier
> run. The command has three jobs and they are separable: **list** what is under
> `.harness/worktrees/`, with each one's branch, its size, and its containment against the base —
> which `containment()` in `git.js` / `git/git.ts` already answers and the board already renders;
> **prune** the git registrations of directories that are gone, which is the repair Q-0048 routed to
> Q-0062 and Q-0062 declined, and which `ensureWorktree`'s and `resetBranchTo`'s
> `fs.existsSync`-only routing (preserved defect, `fanout.ts:245`) makes reachable by hand-deleting a
> directory; and **remove** worktrees whose branch is contained in the base, which is the only
> definition of *safe to remove* that does not require knowing what run created it. It must refuse a
> worktree that is not clean, on Q-0062's rule, and it must never delete a branch, on Q-0062's. Lands
> in the CLI, so it lands after or with Q-0010; it is a new command rather than a port and Q-0010 is
> the port, so it needs its own ticket rather than being folded in. Both trees if it lands before the
> cutover.

---

## Open questions

| # | Question | Owner | Blocking? | Recommendation |
| --- | --- | --- | --- | --- |
| OQ-1 | Should `harness run` gain `--keep-worktrees`? | maintainer, at the gate | No | **Decline.** The escape hatch already exists and is better aimed: a run that failed keeps everything, which is when inspection is wanted, and the human gate is the *last step* — the worktree is still there while the gate is open, which is exactly when Q-0057 ran `harness lint` inside it. A flag is one line and can be added later; an unrequested one is a default taken on someone else's behalf, which `developer-generalist` is told to refuse. |
| OQ-2 | Should the policy be a `harness.yaml` key? | maintainer | No | **Decline for now**, on Q-0080's precedent: a key fixes nothing until someone edits a file, so every existing backlog keeps the defect *unless configured*. It stays available as a later refinement over working behaviour. It is also a file-format change, which would make this a blocker if adopted. |
| OQ-3 | Should the **integration** worktree specifically survive until its branch is merged? | maintainer | No | **No.** The gate is answered before `finish()` runs, so the maintainer's inspection window is untouched; the merge itself is done from the main checkout; and the post-merge verification this repository actually practises is explicitly *"forced on `main` after the merge"*. Keeping it would also halve the saving and leave the branch checked out, so `git branch -d` would still refuse — which is half of what the ticket is about. |
| OQ-4 | Does removal need to wait for Q-0039 (one run at a time per ticket)? | maintainer | No | **No**, but say so out loud rather than by omission — see RK-1. |
| OQ-5 | Should a `regressed` run remove, like a `completed` one? | maintainer | No | **Yes.** It is the same disjunct `finish()` already uses for the stage transition and the rollback, and a regressed run *did* what it set out to do — it sent the ticket back deliberately. Splitting them would mean two conditions where the engine has one. |

**No open question here is a blocker**: none changes a file format, a schema or the adapter contract.
Two preconditions are, and they are gate obligations rather than questions, because no agent on the
chore route can perform either.

---

## Gate obligations

**GO-1 — the decision entry is written by hand at the requirements gate.** AC-14's entry must exist
before the implement step runs, and `harness/roles/developer-generalist.md` forbids that step from
adding one (*"You do not add to `docs/decisions/` or its index"*). This is the seventh appearance of
a loop handed work no agent on its route can perform; naming it here rather than as a criterion is
the Q-0069 AC-11(b) failure avoided rather than repeated. Proposed title: **"A run removes the
worktrees it made, and keeps them when it did not finish"**, carrying R-2, R-3 and R-4, and naming
register row 20 and *"M1 closed"* (2026-08-24) as what it settles.

**GO-2 — the freeze SHA is re-recorded when the merge lands, and only a human can do it.**
`harness/port-charter.md` §3's answer to a legitimate `spike/src` change on the base has two steps:
mirror into `packages/core` — which R-1 already requires — and **re-record `freeze-sha` in the same
commit, at the tip that carries the mirrored change**. The implement step cannot: the merge commit's
SHA does not exist while it is running. So at the gate, after merging, record the merge commit's SHA
at `harness/port-charter.md:265` and push both together. Before the merge the job is clear
(`BASE: origin/main`, which has not moved); after it, and until the SHA is re-recorded, `port freeze
(base unchanged since the freeze SHA)` is red on `main` — which is the guard working, not a defect.
**Q-0062 is the first ticket to walk this path**; `git diff 7b6bc70 main -- spike/src` is empty
today.

---

## Risks

**RK-1 — a concurrent run on the same ticket.** Q-0039 is open, so two runs on one ticket already
share a run id and a worktree. With removal, run A finishing while run B is mid-step removes a
directory B is writing in, and `--force` discards whatever is uncommitted there. This makes an
existing collision slightly worse rather than creating one, and the mitigation is partly structural:
`commitAll` commits after every agent step, so the exposed window is one step wide and the work is on
a branch either side of it. Stated, not fixed; it is Q-0039's, and both entries already say Q-0039
should land before M3 makes concurrent runs ordinary.

**RK-2 — a cold worktree reinstalls.** Removing the integration worktree means the next run's
`integrate` installs from scratch instead of over a warm `node_modules`. `commands.install` runs on
every `integrate` regardless (`composite.ts:290`), so the change is a cold install rather than a new
one; Q-0065 measured `integrate` at 25–30 s including two installs. Accepted: 277 MB per ticket
against tens of seconds per integrate, and the pnpm store makes the reinstall a link rather than a
download.

**RK-3 — a permanently dirty worktree is never cleaned.** AC-5 keeps a worktree with untracked
non-ignored content, so a repository whose install writes such a file would accumulate exactly as
before. The mitigation is that it is *visible*: the run names the paths every time, so the answer is
one `.gitignore` line rather than a mystery. This is also why R-8 moves the smoke fixture's marker
out of the worktree — left where it is, the fixture's integration worktree would be permanently
dirty and the suite would silently never exercise removal on it.

**RK-4 — `RunContext`'s shape.** The set of materialised worktrees is a new field on the run context
in both trees. Q-0051 added three fields to the same object without incident, but a source-level
assertion over the context literal would fail; the implementer should check before assuming, and
report rather than edit if one exists.

**RK-5 — the first use of §3's re-record path.** GO-2 has never been performed. If the SHA is
recorded against the wrong commit the guard fails closed and says so — it refuses a SHA that is not
an ancestor of the base — so the failure mode is a red job with a precise message, not a silent one.

**RK-6 — a reviewer blocks the comment edits.** Two landed pins' comments change (AC-9). Both are
authorised in this document by name and line, which is what Q-0080's requirement established as the
way to spend that cost deliberately.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no environment variable is read, no credential of any kind exists on this path. |
| **Worktree safety** | The subject. Invariant 19 is strengthened, not weakened: a flow still never writes the user's working tree, and now also stops leaving directories in it. `.harness/` is in `.gitignore` and in `.git/info/exclude`, so nothing removed here was ever visible to `git status`. No worktree outside `.harness/worktrees/` is ever touched, and no branch is deleted (AC-7). |
| **Gate behaviour** | Unchanged. No gate is declared, moved or automated; no exhaustion gate is involved. Removal happens inside `finish()`, after the last gate has been answered — so a maintainer inspecting at the gate still has every worktree the run made. |
| **File format and schema** | Nothing changes. No `harness.yaml` key (OQ-2 declines one), no ticket frontmatter field, no run-manifest field, no zod schema, no flow file. `runs.log` gains one line whose shape matches the existing rollback line; `nextRunId` reads the `start` line only, so it cannot move a run id (AC-11). |
| **Lint rules** | None. No flow file changes, so `lintFlow` has no new subject and `harness lint` is expected to report 6/6 unchanged. |
| **Cold-clone impact** | Positive and passive. Nothing is added to the first thirty minutes — there is no command to learn and no flag to discover — and an adopter's first ticket stops leaving a second copy of the dependency tree in their checkout. |
| **Cost** | No adapter call is added or removed. RK-2 is the only cost and it is measured. |

---

## Verified by reading today, not cited from a document

`spike/src/git.js:1–30`; `packages/core/src/git/git.ts:60–90`; `spike/src/engine.js:230–262`,
`:640–690`, `:1010–1080`; `packages/core/src/engine/steps.ts:170–240`, `lifecycle.ts` (whole),
`engine.ts:180–260`, `composite.ts:60–310`, `types.ts:280–286`; `packages/core/src/fanout/fanout.ts:240–330`;
`packages/core/src/engine/q0050.source.test.ts:1–150`;
`packages/core/src/fanout/fanout.source.test.ts:1–60`, `:195–240`;
`packages/core/src/fanout/fanout.test.ts:15–40`; `packages/core/src/engine/run-composition.test.ts:275–300`;
`packages/core/src/engine/composite.test.ts:590–615`; `packages/core/src/engine/agent-run.test.ts:291–307`;
`spike/test/smoke.js:20–90`, `:368–388`, `:705–735`; `spike/test/q0006-engine.js:200–235`;
`spike/test/run.js:1–40`; `harness/port-charter.md` §3, §6 and the machine-readable block;
`.github/scripts/port-freeze-guard.sh` (whole); `.github/workflows/ci.yml` (whole);
`harness/flows/chore.yaml`; `harness/roles/developer-generalist.md`; `harness/harness.yaml`;
`.gitignore`; `docs/02-sdlc-pipeline-spec.md` §5.8; `docs/04-architecture.md` §6.

Measured, not read: `git worktree list`, `du -sh` per worktree and per `node_modules`,
`git status --porcelain` in both worktrees, `git branch -a`,
`git merge-base --is-ancestor 7b6bc70 main`, `git diff 7b6bc70 main -- spike/src`,
`grep -rn removeWorktree` across the repository, and the absence of any importer of `@quorum/core`.
