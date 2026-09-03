---
id: Q-0093
title: "CLI writing commands: init and ticket"
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0093/integration
priority: p2
created: 2026-09-01
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-03T23:04:54.126Z
    cost: 13.696
---
**The two commands that create files** — `init` (`spike/bin/harness.js:317–339`, 23 lines) and
`ticket new` (`:340–352`, 13 lines). Small in the CLI and load-bearing out of proportion to their
size, because they are the first thing a stranger runs.

**`init`** scaffolds `harness/` and `backlog/` from `spike/templates/harness/`, and prints the next
command. Its templates are the shipped flows, which Q-0086, Q-0087 and Q-0088 changed on
2026-09-01 — every artifact a run can rewrite is now named by `{run}`, plus `{iter}` where a bounded
loop can re-enter the step, and four flat paths remain as **pointers** beside a scoped copy. A
`packages/cli` that ships a stale copy of those templates would hand every adopter the defect three
tickets just closed, so the templates are read rather than duplicated.

**`ticket new`** allocates within the prefix the backlog already uses — Q-0080's fix, and the
behaviour is exact: `PROJ-0041` allocates `PROJ-0042` with no configuration, an empty backlog
allocates `T-0001`, a backlog the allocator cannot read **refuses and names what it found** rather
than guessing, and `--id` goes through the same checks. `create()` refuses a taken id or an occupied
folder instead of overwriting one.

**Inherits 217 lines** — `q0080-allocation.js`, whose nine scenarios are the allocation table.

**One measured defect it must preserve and report, not fix:** `create()` defaults `owner` to
`process.env.USER`. Five tickets in this backlog carried the OS user against fifty-four `ruud` and
were normalised by hand on 2026-08-31; it reproduced on the very next invocation, and then **on all
six of Q-0010's children at once** — the act of creating this ticket produced a seventh, eighth and
ninth instance, normalised again by hand. That is the strongest evidence available that the default
is wrong rather than merely untidy: it has now been corrected three times and re-appeared every
time, because nothing about the correction reaches the code. Whether the product should default an
owner at all — and if so to what, given that `process.env.USER` is the one thing guaranteed *not*
to identify the person a ticket belongs to on a shared or CI machine — is the question this child
raises and does not answer.

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
