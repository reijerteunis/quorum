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
