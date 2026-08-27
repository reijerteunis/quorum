# Errata — Q-0048 requirements

Amendments to `requirements/merged.md`, agreed after the requirements gate. Both `chore.yaml`'s
`implement` and its `review` step list `requirements/errata.md` among their inputs; where this file
and the requirement disagree, this file wins **for the clauses it names and no others**. Each entry
is dated and names the clause it supersedes. Nothing here may widen scope — an erratum resolves a
contradiction, it does not add requirements.

## E-1 — 2026-08-27 — AC-13's `spike/` freeze check is evidence, not an assertion

**Supersedes:** the sixth bullet of **AC-13** in `requirements/merged.md:246`, so far as it requires
a persisted assertion that *"`git diff --name-only main...HEAD` contains no `spike/` path"*.

**Replacement:** the fact is **evidence**, performed and recorded in `dev/implement-report.md` with
the three commands and their output, exactly as the implementer did in its section B. It is **not**
written into the Vitest suite. Every other word of AC-13 stands, including the source-test
assertions that no `spike/` path is *imported* from `packages/core`, and including the sentence
already in the criterion naming CI's `port freeze (branch scope)` job as **the enforcement**.

**Why the requirement was wrong.** It contradicts its own settled open question three sections
later. `requirements/merged.md:288` decides, in bold, that **"no test may assert the containment or
branch state of *this* repository, which would be red until the next landing and green forever
after."** A `git diff --name-only main...HEAD` assertion is precisely that: it reads the branch the
suite is running from. Both clauses were written into one document and only one of them can be
obeyed.

The general rule behind :288 is *"A red test is a permanent acceptance test; phase-bound facts are
evidence"* (`docs/DECISIONS.md`, 2026-08-23), whose test is *will this still pass when the feature
is done?* Here the answer is worse than no: after this branch merges, `main...HEAD` is empty and the
assertion passes **vacuously**, which is the failure mode `docs/DECISIONS.md`'s *"a check that skips
its subject must not report success"* (2026-08-25) exists to refuse. A check that is red on the
wrong branches and green over nothing on the right ones protects the freeze on no branch at all.

And it is not hypothetical on the other side either. `docs/06-development-plan.md` schedules
**Q-0038, Q-0040, Q-0066 and Q-0068** with `spike/src` in scope, and Q-0066 and Q-0068 are required
to land in both trees *together*. A permanent assertion that no branch may contain a `spike/` path
turns four planned tickets' CI red by construction — including the two whose whole point is that a
fix must appear in `spike` and `packages/core` at once, which is the mechanism the freeze exists to
protect.

**Why the enforcement is unaffected.** The freeze is enforced by `.github/scripts/port-freeze-guard.sh`
through CI's `port freeze (branch scope)` job, which knows which branches are port children and
which are not — the discrimination a Vitest assertion cannot make. AC-13's own text already says so:
*"CI's `port freeze (branch scope)` job covers `harness/Q-0048/*` and is the enforcement; this
assertion is the implementer's own early warning."* An early warning performed by hand and
transcribed is still an early warning; nothing about the guarantee changes.

**What this erratum does not settle.** It says nothing about AC-13's other five bullets, which stand
as written and are assertions. It does not authorise removing or weakening any source test, and it
does not touch the freeze policy in `harness/port-charter.md` §3.

## E-2 — 2026-08-27 — the gate obligation on the preserved defects is a human commit, and it is discharged outside this loop

**Supersedes:** nothing in `requirements/merged.md`. It records where an obligation the requirement
places on the ticket is performed, because the review loop cannot perform it and each round spends
$8–11 discovering that again.

**The obligation.** The requirement's open-questions section states that *"the four defects listed in
AC-12(3) must land in a named ticket body before this ticket closes — an implement report is not a
durable record and is not read again after the gate."* Round 1's review raised the same point as a
major, correctly.

**Why no implement round can close it.** Its surface is `backlog/`, and `backlog/` is not a writable
surface for any agent step in any flow: `commitAll` (`spike/src/fanout.js:80–93`) runs
`git checkout -- backlog` and `git clean -qfd -- backlog` before every agent step commits, reverting
tracked edits and deleting additions. That guard is deliberate and stays — an agent that can edit a
ticket body can advance its own stage. See *"A requirement may not name a surface its flow cannot
write"* (`docs/DECISIONS.md`, 2026-08-25), which cost $23.25 to establish on Q-0009.

**Where it is discharged.** By human commits outside the flow, against the ticket bodies named
below. As of this erratum:

| Defect | Home | Commit |
| --- | --- | --- |
| 2 — `runCommand` inherits `execSync`'s 1 MiB `maxBuffer` | **Q-0065** | `80bc290` |
| 3 — `branchExists`/`branchHead` cannot tell "no such branch" from "git failed" | **Q-0050** | `80bc290` |
| 4 — `commitAll` reports a discard when the revert itself failed | **Q-0050** | `80bc290` |
| 5 — `commitAll`'s first discarded path loses its first character | **Q-0050** | this erratum's commit |
| 6 — `mergeInto` returns `error: ''` on a content conflict | **Q-0050** | this erratum's commit |
| 1 — `loadTasks` throws a raw `TypeError` on an empty `tasks.yaml` | **Q-0060** | `8f42c76` |

Defects 5 and 6 are new, found by the implementer while writing tests rather than by reading, and
both are in the functions register row 3's caller already owns — the implementer proposed Q-0050 for
each and the reasoning holds: same module, same caller, and the fix in both cases is a decision
about what a caller does with a diagnostic rather than a change to a return type nobody reads.

**Defect 1's row, decided after the review loop closed.** When this erratum was written the row
was open, and it says so below in the words the implementer correctly transcribed. It was taken at
the chore gate on 2026-08-27 in favour of **Q-0060** (`8f42c76`), on the grounds that the two are one
question asked of two parsers from opposite sides: Q-0060's defect fails *open* — a damaged file
reads as a valid object with no fields — and this one fails *closed but illegibly*, stopping the run
with a Node stack trace instead of the name of the file that is wrong. Answering them separately
would give the product two accidents rather than one policy.

`dev/implement-report.md` predates that decision and states the row as open. That is not a
contradiction to reconcile: the report is accurate as of the round that wrote it, and this table is
the current record. **The gate obligation is now discharged in full — all six defects have named
ticket bodies.**

**What this erratum did not settle when it was written.** The above. Nothing else changed.

**What the implementer must still do, and what it cannot.** Round 1's second major has two halves,
and only one of them is the implementer's. The **recording** half — a named ticket body per defect —
is a `backlog/` write and is closed above by human commit; no round can perform it and no round
should be asked to. The **reporting** half is the implementer's and is still open: rewrite
`dev/implement-report.md` so each preserved defect names its destination from the table, and says
plainly that defect 1 has none.

That half *is* performable, and the distinction is mechanical rather than a favour. A step's
`output.writes` files are persisted by the engine through `backlog.writeFile` into the ticket folder
in the **main working tree** (`spike/src/engine.js:283`), before `commitAll` ever runs in the
worktree — so the report is written by the engine from the agent's own output, and is never subject
to the revert. It is the ticket **bodies** in `backlog/` that the agent cannot touch, not its own
report.

**For the reviewer.** A finding that the ticket bodies have not been updated is correct in substance
and is closed here; it must not be raised against the implementer again. A finding that the report
does not name the destinations remains a legitimate finding.
