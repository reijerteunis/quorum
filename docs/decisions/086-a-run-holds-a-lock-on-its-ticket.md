# A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed — 2026-09-09

## Decision

A `quorum run` takes a lock before it does anything it must later undo, and gives it back in a
`finally` that covers every exit.

**Its subject is the ticket.** All three measured collisions are per-ticket — the run id
`nextRunId` computes from `runs.log`, the ticket branch `finish()` resets to `branchHeadAtStart`,
and the one worktree per branch — so the ticket is what a lock has to be about. Not the repository,
which would serialise unrelated work, and not the branch, which a fan-out multiplies.

**It is one file under `.quorum/`, created by one exclusive syscall.** `.quorum/` is where this
product already puts durable run state, which makes the lock inspectable with `ls` and clearable
with `rm` — and *"Files are the database"* is the rule that decides it, not preference. The
atomic-create idiom already ships here: `packages/core/src/run-history/writer.ts:258` refuses a run
directory that already exists by catching `EEXIST` from an exclusive create, and this is the same
primitive doing the same job one layer up.

**A second run refuses; it does not wait.** The refusal names the holder, and it is a `FlowError`
stating the condition, leaving the remedy to the surface — *"A `core` error names the condition;
the remedy belongs to the surface"* (2026-09-07).

**A lock whose holder is gone still refuses, and is never reclaimed automatically.** The recovery is
a human deleting a file the message names. The successor that asks whether this can be done safely
is opened as a ticket at the same gate rather than left in this entry.

**`--dry` neither takes a lock nor is refused by one.** It writes nothing and obtains no worktree,
so it has nothing to serialise; saying so is cheaper than leaving it implied.

## Alternatives considered

**A git ref as the lock.** Atomic across processes with no filesystem race, which is a genuine
advantage. Refused because a ref is invisible to the two commands a stuck operator will actually
reach for, and because the exclusive-create idiom already ships in this tree and has been exercised
by every run since Q-0049. A second mechanism for the same guarantee is a second thing to get wrong.

**Waiting rather than refusing.** Refused on *"Errors are explicit … never default silently"*. A CLI
that blocks on a holder it cannot name is worse than one that names it and stops, and the waiting
design has to answer *how long* — a question with no defensible answer at this size.

**Probing the holder and reclaiming a stale lock.** This is the substantive alternative and it was
argued rather than dismissed. Refused on four grounds:

1. **The premise is measured.** `packages/cli/src/run.ts:179–180` aborts an `AbortController`
   instead of exiting inside the signal handler, so SIGINT and SIGTERM both reach the engine's
   `finally`. A lock outlives its run only on SIGKILL, a hard crash or power loss.
2. **A pid probe is an open ticket's defect class.** Q-0074, *"A failed git probe is read as a
   proven negative"*, is open on exactly the shape *probe fails → read as absence*. Shipping one
   here adds an instance while the ticket to remove them is unstarted.
3. **It would be the first thing in this product to report an unanswerable question as an
   answerable one.** A recorded pid cannot distinguish *that process is gone* from *that pid belongs
   to something else now*. Containment, push lag and verified version each select from a closed set
   and each keep a state that means *could not tell*; a boolean liveness answer has no such state.
4. **Direction of travel.** Refuse-now and reclaim-later is additive. Reclaim-now cannot be
   un-shipped without a behaviour change.

**A repository-wide lock.** Refused: it serialises work that does not collide, and none of the three
measured collisions is repository-wide.

## Why

Nothing serialises runs today — searched again on 2026-09-09, there is no lock of any kind in
`packages/core/src`. Two invocations against one ticket collide on three shared resources, and it
has happened: M1's closing entry records two runs overlapping twice in one night, with one run's
rollback moving a branch another live run was holding.

The engine already knows. `writer.ts:257` guards the *symptom* — a run directory outliving its log
line — and its own comment disclaims what it does not prove: *"does not make the engine safe for
concurrent runs, which is Q-0039 and still open."* A guard that points at a ticket for its own cause
is a guard waiting for this entry.

Two later tickets widened the exposure with their reasons recorded. Q-0062 made `finish()` remove
the worktrees a finished run obtained, so a completing run now removes a directory a live run is
writing in — accepted on the grounds that Q-0039 owns it. Q-0057 found that two runs computing the
same run id write their reviews into the same directory, reproducing the overwrite defect that
ticket existed to fix, and deferred it here.

**The timing is the argument.** Both the M1 closing entry and Q-0034's say this lands before M3's
daemon makes concurrent and unattended runs ordinary. Today a collision needs two terminals and a
person in a hurry; with a server accepting HTTP it needs one impatient click. M2's substantive work
is done and M3 is next, so *before the daemon* is now rather than later.

**Why an entry at all**, since the design does not turn on it: it introduces a second kind of
durable file under `.quorum/` and a new circumstance in which `quorum run` refuses to run at all.
That is product policy rather than a repair, and it is the judgement *"A ticket's owner is supplied,
never guessed"* (2026-09-08) records getting wrong in the other direction — an entry judged
unnecessary for a change that turned out to be policy.
