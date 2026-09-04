---
id: Q-0095
title: The mock end-to-end suite runs against the CLI binary
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0095/integration
priority: p1
created: 2026-09-01
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-04T10:55:48.984Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-04T11:00:19.624Z
    cost: 11.436
---
**M2's done-when, and the last child of Q-0010 — re-scoped at its requirements gate on 2026-09-04
from twenty-one criteria to eleven.** `spike/test/smoke.js` is the mock end-to-end through the
binary, and until its binary half runs against `packages/cli` the cutover cannot happen and neither
can retiring the spike's CI job.

**This ticket is §3.1 of `requirements/merged.md`: the spawn harness and the green chain.** The
failure, gate and rollback paths are **Q-0101**, created at the same gate. The seam is **by scenario
independence, not by command** — a per-command cut was refused, because `smoke.js`'s binary half does
not partition that way, which is the admitted weakness of Q-0010's whole seam.

**Its measured figures are corrected here, and the old pair described no commit that has ever
existed.** The body said *"781 lines and 151 assertions"*. Measured at HEAD: **780 lines, 158
`assert(` sites, of which 76 transfer.** `151` was true at `dad6254` (Q-0035) when the file was
**739** lines, so the pair combined two different moments and then added the systematic **+1 per
file** this cut has now recorded seven times. `06-development-plan.md` carried the same pair while
its own Q-0010 bullet said 780, contradicting itself three screens apart; both are corrected.

**It is `split`, not binary-only.** Q-0054's audit found it spawns the binary **and** imports from
`../src/` fifteen times through `await import()` — invisible to a scan for static
`from '../src/'` — and that count is confirmed at HEAD. Its library half is already carried by the
workspace suite; **only the binary half transfers.**

**The execution mechanism is the reason this could not be one ticket.**
`packages/core/src/adapters/mock.ts` keys its call counter `role:kind` at `:94` with **no reset
export**, and adding one is a charter §2 behaviour change. So the in-process `invoke()` model all six
command children used **cannot** carry the three convergent behaviours: every binary invocation must
be a separate operating-system process, against an artifact the suite builds in an isolated copy.
That harness is this ticket's, and Q-0101's scenarios ride on it.

**Two assertions were re-aimed on 2026-09-01 and one had been passing for the wrong reason.**
Q-0088 moved the requirements candidates under `requirements/run-{run}/`, and
`assert(!fs.existsSync('requirements/candidate-claude.md'))` — *"failed parallel sibling wrote
nothing"* — went green the moment the path moved, proving the writer had failed only by accident. It
searches recursively now (`smoke.js:148`, via `found()`), and `MOCK_FAIL_WRITE` at `:139` is the
mechanism that makes a red witness possible. **That assertion is Q-0101's**, and its translated form
must be shown **red against a deliberately broken binary** rather than observed green.

**AC-10 re-aims two register clauses at Q-0101.** `spike-parity.test.ts:1617` and `:1694` assert
`REGISTER['q0033-surface.js'].binaryHalf` `.toMatch(/Q-0095/)`; if this ticket closed carrying only
the chain half, they would name a **closed** ticket as owing work — the contradiction Q-0091's E-2
created `binaryCarriedBy` to make impossible, running the other way.

**When both halves are green the cutover is unblocked** — deleting `spike/`, retiring its CI job and
retiring `harness/port-charter.md`. That is Q-0010 §5's follow-up, it still has no ticket, and
Q-0101's GO-4 says it should be allocated at that ticket's close rather than remembered.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

`input.backlog` resolves against the running ticket's own folder, so nothing injects Q-0010's body
into this run. These five are the parent's §4 and are binding.

1. **The spike stays authoritative and green until cutover.** `spike/` is what develops Quorum
   today and every child of Q-0010 runs through it. A witness that has been edited is not one, so
   **do not modify `spike/src/`**. Q-0010's children are *not* in `harness/port-charter.md`'s
   `children:` list, so the branch-scope job reports them out of scope rather than failing them —
   the rule is this body's, not the guard's. If a change to `spike/src` is genuinely required, stop
   and say so; it takes §3's mirror-and-re-record path and is a decision, not a step.
2. **The spike's own tests are not deleted or edited to make room.** A child *adds* coverage under
   `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059's
   traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash and Q-0068's product name
   in the BYOS refusal are all open tickets that land in both trees; do not close one here.
4. **`packages/core` already holds the logic.** Every domain helper the spike CLI defines locally
   is in `core` — checked by name in Q-0010's body. If something appears to need porting, look for
   it in `core` first and say so if it is genuinely absent; the CLI is a presentation layer over an
   API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change.** It records, file by
   file, what the workspace suite carries of `spike/test/` and which half transfers at Q-0010. A
   child that translates a binary half without re-classifying its file leaves a register saying the
   work is still owed — and the file's own line totals are pinned, so they are **re-derived, not
   adjusted**.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, whose body carries the cut, the
order and the measurements this one does not repeat.
