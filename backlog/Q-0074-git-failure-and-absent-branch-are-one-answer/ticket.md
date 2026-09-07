---
id: Q-0074
title: The engine cannot tell git failed from an absent branch
stage: draft
owner: ruud
repos: []
branch: harness/Q-0074/integration
priority: p2
created: 2026-08-28
iterations: {}
history: []
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

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
