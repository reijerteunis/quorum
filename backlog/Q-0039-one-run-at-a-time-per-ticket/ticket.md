---
id: Q-0039
title: One run at a time per ticket
stage: draft
owner: ruud
repos: []
branch: harness/Q-0039/integration
priority: p2
created: 2026-08-31
iterations: {}
history: []
---
Opened by hand 2026-08-31 at id `Q-0039`, which is where `docs/06-development-plan.md` has cited
it since 2026-08-24. It had a plan entry and no folder for a week — the plan-vs-backlog drift that
page names for Q-0074, one direction over — so this body transcribes what the plan, the M1 closing
entry and four later tickets already established, re-measured against the tree today rather than
inherited.

**The defect.** Nothing serialises runs. `grep -rn "lockfile\|acquireLock\|\.lock\b" spike/src
packages/core/src` returns **no lock of any kind** in either tree — every hit is a test fixture or a
pnpm lockfile. Two `harness run` invocations against one ticket proceed in parallel, and they
collide on three shared resources:

| Resource | How they collide |
| --- | --- |
| the run id | `nextRunId` (`spike/src/engine.js:776`, `packages/core/src/run-history/writer.ts:188`) is `max(run= in runs.log, history) + 1`, read at run start. Two runs starting before either writes its `start` line compute the same `n` and write into the same `.quorum/runs/<id>-N/` |
| the ticket branch | `finish()` captures `ctx.branchHeadAtStart` at run start and, on any status that is not `completed` or `regressed`, calls `resetBranchTo(…, ctx.branchHeadAtStart)`. Run A's rollback therefore moves a branch run B is actively holding, back to where **A** found it |
| the worktree | one directory per branch, so both runs work in the same checkout |

**It happened, twice in one night.** M1's closing entry records two runs overlapping and one run's
rollback moving a branch another live run was holding. That is the origin of the ticket.

**The engine knows, and says so in a comment.** `spike/src/engine.js:383–390` refuses to allocate a
run directory that already exists, and its own message is careful to disclaim more than it proves:

> *"this guard does not make the engine safe for concurrent runs, which remains an open M1 item"*

So there is a guard on the **symptom** — a directory outliving its log line — and none on the cause.

**Q-0062 made one collision worse, deliberately and with its reasons recorded** (RK-1 of its merged
requirement, 2026-08-31). `finish()` now removes the worktrees a finished run obtained, so run A
completing while run B is mid-step removes the directory B is writing in, and `git worktree remove
--force` discards whatever is uncommitted there. The exposure is bounded rather than open —
`commitAll` commits after every agent step, so the window is one step wide, and under Q-0062's
no-ref-deletion rule the branch always survives — but it is a real widening of an existing
collision, accepted on the grounds that this ticket owns it.

**Q-0057 found the third one and deferred it here** (OQ-4): two concurrent runs computing the same
`nextRunId` write their reviews into the same `review/chore/run-{run}/` directory, reproducing the
overwrite defect that ticket existed to fix.

**Why it matters now rather than later.** Both the M1 entry and Q-0034's say this should land before
M3's daemon makes concurrent and unattended runs ordinary. Today a collision needs two terminals and
a person in a hurry; with a server accepting HTTP it needs one impatient click.

**Open design questions, none of them settled here.**

1. **What is the lock's subject** — the ticket, the ticket branch, or the repository? The three
   collisions above are all per-ticket, which argues for the ticket; a fan-out that cuts worktrees
   for sibling task branches may argue wider.
2. **Where does it live** — a file under `.quorum/`, which is where this project puts durable state
   and which makes the lock inspectable and hand-clearable, or a git ref, which is atomic across
   processes without a filesystem race?
3. **What does a second run do** — refuse with the holder's run id and start time, or wait? Refusing
   is the honest default for a CLI and matches *"errors are explicit; never default silently"*.
4. **How is a stale lock released** after a crash, and how does that not become its own
   `EEXIST`-shaped defect where the recovery path is what people actually hit? A pid is not enough
   on its own; a pid plus a start time plus a liveness check is the usual shape.
5. **Does `--dry` take one?** A dry run writes nothing and obtains no worktree, so probably not —
   but it does read the ticket, and saying so is cheaper than leaving it implied.

**Scope.** Both trees together, the Q-0066 / Q-0068 / Q-0070 shape: the spike is what runs every
flow in this repository until the cutover, so a `core`-only fix protects nothing today. Not blocked
by the port — Q-0062 was not in the charter's `children:` list and neither is this. Belongs to M2 in
`docs/06-development-plan.md`, and its plan entry says it should land before M3.
