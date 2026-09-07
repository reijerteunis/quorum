---
id: Q-0109
title: A failed work-tree probe is still read as proven absence in two cases
stage: abandoned
owner: ruud
repos: []
branch: harness/Q-0109/integration
priority: p3
created: 2026-09-07
iterations: {}
history: []
---
> **Absorbed into Q-0074 on 2026-09-07, and `abandoned` rather than closed.** Not withdrawn: the
> defect is real, unfixed, and now carried by that ticket. The two were the same primitive —
> `safe()` is declared byte-for-byte twice, `git/git.ts:19–21` and `fanout/fanout.ts:206–208`, and
> both tickets were asking what a caller does with its `null`. Q-0074 keeps the id because
> *"What a run's event stream carries"* (2026-08-28) cites it by name and a landed entry is never
> edited. This body stays in place as the evidence, the Q-0061 shape.

Q-0105's erratum E-1 registered this residual rather than closing it. workTreeProbe asks repositoryAt after a git fatal, and repositoryAt collapses every failure of rev-parse --resolve-git-dir to false — so a malformed gitfile at repoDir/.git and an unreadable .git both read as absence and render nothing. That gives silence a second meaning it was not given, against decision 080's rule that silence means only that git answered. AC-3 is met, its binding clause being none of them reaches pushed, which is why E-1 ruled it a residual and not an unmet criterion. The third case E-1 named — a project root below a repository git refuses — is CLOSED as unclosable and must not be reopened without new evidence: the alternatives are git's translated prose, which may never decide a state, or a reimplementation of git's upward discovery walk, whose verdict would depend on where a fixture sits. What needs a decision is the remaining two, because the obvious instrument is a filesystem existence check at repoDir/.git and that collides with 'Membership is a git question, not a filesystem one' (2026-08-28). Whether the collision is real or whether that entry is scoped to turbo-inputs is the question; measure before choosing.
