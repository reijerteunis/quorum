---
id: Q-0109
title: A failed work-tree probe is still read as proven absence in two cases
stage: draft
owner: ruud
repos: []
branch: harness/Q-0109/integration
priority: p3
created: 2026-09-07
iterations: {}
history: []
---
Q-0105's erratum E-1 registered this residual rather than closing it. workTreeProbe asks repositoryAt after a git fatal, and repositoryAt collapses every failure of rev-parse --resolve-git-dir to false — so a malformed gitfile at repoDir/.git and an unreadable .git both read as absence and render nothing. That gives silence a second meaning it was not given, against decision 080's rule that silence means only that git answered. AC-3 is met, its binding clause being none of them reaches pushed, which is why E-1 ruled it a residual and not an unmet criterion. The third case E-1 named — a project root below a repository git refuses — is CLOSED as unclosable and must not be reopened without new evidence: the alternatives are git's translated prose, which may never decide a state, or a reimplementation of git's upward discovery walk, whose verdict would depend on where a fixture sits. What needs a decision is the remaining two, because the obvious instrument is a filesystem existence check at repoDir/.git and that collides with 'Membership is a git question, not a filesystem one' (2026-08-28). Whether the collision is real or whether that entry is scoped to turbo-inputs is the question; measure before choosing.
