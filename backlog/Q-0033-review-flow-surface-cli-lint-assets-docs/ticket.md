---
id: Q-0033
title: Review flow surface — CLI, lint, config, shipped assets and docs
stage: solutioned
owner: ruud
repos: []
branch: harness/Q-0033/integration
priority: p2
created: 2026-08-22
depends_on: Q-0006
iterations:
  solutioning.architecture-review: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-22T22:21:48.757Z
    cost: 4.485
  - stage: solutioned
    run: 2
    flow: solutioning
    status: completed
    stage_before: requirements
    stage_after: solutioned
    at: 2026-08-22T22:50:12.672Z
    cost: 6.232
---
The second half of the review flow, split out of Q-0006 on 2026-08-22 because thirty acceptance
criteria in one ticket hit the iteration bound at every stage. Q-0006 builds the engine — round
numbering, diff materialisation, the derived cross-flow regression, counters, retry and
exhaustion semantics, rework sync, audit and failure containment. This ticket builds everything a
human or a flow file touches: the shipped `review.yaml` and the `code-reviewer` role with their
byte-identical template copies, the `repo.base_branch` and `repo.max_diff_bytes` config keys and
the `harness init` that writes them, the lint rules that reject an unbounded loop or an
unresolvable cross-flow target or a single-vendor panel, an explicit non-interactive gate answer
so a run can never default silently, and the documentation that has to agree with all of it.

Nothing here needs to be designed from scratch. Q-0006's `requirements/merged.md`,
`solution/solution.md` and the seven contracts under `contracts/Q-0006/` already describe both
halves and are consumed unchanged; the two task descriptions this ticket inherits are preserved
in `backlog/Q-0006-.../solution/tasks-before-split.yaml`. Its requirements and solutioning runs
should therefore be short and mostly confirmatory — and if they are not, that is itself worth
knowing, because it would mean the shared design is less settled than it looks.

The ordering matters: this ticket depends on Q-0006. Its lint work and its CLI work both touch
behaviour the engine half defines, and the two tasks were serialised for exactly that reason
before the split. Belongs to M1 in docs/06-development-plan.md.
