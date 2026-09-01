---
id: Q-0095
title: The mock end-to-end suite runs against the CLI binary
stage: draft
owner: ruud
repos: []
branch: harness/Q-0095/integration
priority: p1
created: 2026-09-01
iterations: {}
history: []
---
**M2's done-when, and the last child of Q-0010.** `spike/test/smoke.js` is the mock end-to-end
through the binary — 781 lines and 151 assertions — and it is what the development plan means by
*"the mock end-to-end through the binary"*. Until it runs against `packages/cli`, the cutover cannot
happen and neither can retiring the spike's CI job.

**Runs last, and is its own child rather than being split across the five**, because it touches
every command: `init`, `ticket new`, `run` over several flows, `board`, `adapters`, `runs`,
`validate` and `lint`. That is the seam's admitted weakness — the eight binary-half files do **not**
partition cleanly by command, and `smoke.js` is why.

**It is `split`, not binary-only.** Q-0054's audit found it spawns the binary **and** imports from
`../src/` fifteen times through `await import()` — invisible to a scan for static
`from '../src/'`. Its library half is already carried by the workspace suite; **only the binary half
transfers here.** Do not re-derive that from any earlier account: three documents called it
binary-only before the audit corrected them.

**Two assertions in it were re-aimed on 2026-09-01 and one had been passing for the wrong reason.**
Q-0088 moved the requirements candidates under `requirements/run-{run}/`, and
`assert(!fs.existsSync('requirements/candidate-claude.md'))` — *"failed parallel sibling wrote
nothing"* — went green the moment the path moved, proving the writer had failed only by accident.
It searches recursively now. A translation that re-flattens either assertion re-opens that hole, so
**the translated form must be shown red against a deliberately broken binary**, not merely observed
green.

**When this child is green, the cutover is unblocked** — deleting `spike/`, retiring its CI job and
retiring `harness/port-charter.md`. That is Q-0010 §5's follow-up, it has no ticket, and it should
get one at this child's close rather than being remembered.

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
