---
id: Q-0002
title: Run solutioning flow on a real repo
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0002/integration
priority: p1
created: 2026-08-22
iterations: {}
history: []
---
Second half of M0's end-to-end proof: take a ticket that already holds an approved requirement
and run `solutioning` on it with real Claude Code and Codex CLI, carrying it to `solutioned`.
This exercises three things the requirements run never touched — a worktree step that writes
contract files to a branch, a bounded backward edge driven by a verdict (Claude's
architecture-reviewer sending Codex's draft back with `revise`, twice at most), and an
`integrate` step merging the contracts branch into the ticket's integration branch. The
judgement to record is whether the revision round actually improves the draft or merely churns
it: the plan asks for that verdict in writing, because a loop that costs a few dollars per
traversal has to earn its place. The real prize is the contracts themselves — if the architect
emits interfaces, schemas and stubs concrete enough that tests can compile against them and fail
on assertions, M1's red-green mechanism is real; if it emits prose, M1 needs rethinking before
it starts. Belongs to M0 in docs/06-development-plan.md.
