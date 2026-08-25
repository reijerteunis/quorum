---
id: Q-0055
title: Lint requires a step id wherever the engine interpolates one
stage: draft
owner: ruud
repos: []
branch: harness/Q-0055/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
---
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
