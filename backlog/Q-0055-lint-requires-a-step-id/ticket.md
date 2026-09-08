---
id: Q-0055
title: Lint requires a step id wherever the engine interpolates one
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0055/integration
priority: p2
created: 2026-08-25
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-08T04:35:21.517Z
    cost: 11.355
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

Found by Q-0041's fifth implement round, as the premise of the fix that round shipped. Recorded as a
stop-and-report under *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25), because closing it inside Q-0041 would have been
the exact failure that round existed to correct.

**The defect.** `lintFlow` requires an `id` on **no step kind**, and the engine needs one. A flow with
an id-less agent step lints clean and then creates a worktree branch literally named
`harness/<ticket>/undefined`.

- `spike/src/lint.js:59` gathers ids with `steps.filter((step) => step.id)` for the duplicate-id
  check, so an id-less step is simply absent from it, and no other rule in the function looks for one.
- `spike/src/engine.js:211` interpolates `harness/${ticket.meta.id}/${step.id}` for a worktree branch.
- `spike/src/engine.js:541` keys a loop counter `${ctx.flow.name}.${step.id}`.

Verified by running `lintFlow`, not by reading it — every kind is accepted without an id:

| step kind, no `id` | `lintFlow` |
| --- | --- |
| plain agent | `true` |
| script | `true` |
| integrate | `true` |
| fan-out | `true` |
| `parallel` member | `true` |
| gate | `true` |

**The gate step is genuinely id-less and must stay so.** `chore.yaml:58` ships one, and AC-3 of
Q-0041's requirement records that the schema does not require an id for it. So this is not "require
`id` everywhere" — it is "require it on the kinds the engine interpolates it into", which is every
kind that can carry `worktree: true` or `on_fail`. A gate has neither. The right shape is probably
two rules: an id is required on any step the engine may name a branch or a counter after, and a
`parallel` member is such a step.

**Why it is worth a ticket and not a nit.** It is the same class as the `steps`-less flow the same
report names — lint accepts, the engine falls over downstream with a message about neither — and it
is the class the whole flow-lint exists to prevent. A newcomer writing their first flow is exactly
who omits an id, and `harness/<their-ticket>/undefined` is a poor thirty-minute experience.

**Sequencing.** Q-0041's implementer suggests this belongs to **Q-0044** (`core/lint`). It cannot go
*into* Q-0044: that ticket ports the lint preserving behaviour, and this is a behaviour change. It
should land after Q-0044, against `packages/core`, so the fix is written once in the ported code
rather than twice. Until then `spike/src` is frozen (`harness/port-charter.md` §3). Belongs to M2 in
`docs/06-development-plan.md`.

**A neighbour found the same round now has its own ticket: Q-0057.** A later run's review silently
destroys an earlier run's, because `chore.yaml:34`'s `{iter}` is run-scoped while `review.yaml`'s
`{round}` is ticket-scoped. It hit this pair of tickets' own parent — run 3 overwrote two of run 2's
three reviews on Q-0041 — and it will hit the thirteen remaining children of Q-0009.

## After the cutover — corrected 2026-09-07

**Void: the *Sequencing* paragraph's freeze clause.** Q-0044 shipped, `spike/src` no longer exists
and `harness/port-charter.md` was deleted with it, so *"until then `spike/src` is frozen"* names
nothing. What survives of that paragraph is the part that was always the point: this is a behaviour
change and so could not go **into** Q-0044. It lands against `packages/core` alone.

**The three sites, re-measured.**

| the body says | it is now |
| --- | --- |
| `spike/src/lint.js:59` | `packages/core/src/lint/lint.ts:171` — `steps.filter((step) => loose(step).id)`, the same shape, so an id-less step is still simply absent from the duplicate-id check and no other rule looks for one |
| `spike/src/engine.js:211` | `packages/core/src/engine/steps.ts:200` — `ticketBranch(ticket.meta.id, stepId)`; fan-out task branches take the same shape at `composite.ts:193` |
| `spike/src/engine.js:541` | `packages/core/src/engine/routing.ts:110` — `` `${flow.name}.${step.id}` `` |

**The gate exception still holds and its line moved**: the id-less gate is `harness/flows/chore.yaml:59`.

**A second in-tree pointer exists that did not when this was written.** The diff preflight's member
loop, `packages/core/src/engine/diff.ts:465–467`, carries a comment naming this ticket by id —
*"A step with no `id` — which lint does not yet refuse; see Q-0055 — names its branch
`harness/<ticket>/undefined`, as the worktree step itself does"*. So the engine now records, in
place, that it is compensating for the missing lint rule, and it renders the absent id two ways on
purpose (`undefined` for the branch, `null` for the producer a diagnostic quotes). Both renderings
lose their reason once lint refuses the step, which is worth deciding rather than discovering.

**Void: the closing neighbour paragraph.** Q-0057 shipped 2026-08-30, and Q-0086, Q-0087 and Q-0088
then generalised the rule — a write path carries `{run}`, and one a bounded loop can re-enter also
carries `{iter}`. The neighbour is closed; it is left above as the record of where it was found.
