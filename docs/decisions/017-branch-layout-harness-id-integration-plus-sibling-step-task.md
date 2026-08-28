# Branch layout: `harness/<id>/integration` plus sibling step/task branches — 2026-08-21
**Decision:** Per ticket, the integration branch is `harness/<id>/integration`; contracts, tests and each task get sibling branches (`harness/<id>/contracts`, `…/tests`, `…/<task.id>`). Worktrees live under `.harness/worktrees/` (git-excluded). Fan-out waves merge into the integration branch between waves; task worktrees sync to it before a retry.
**Why:** Git refs are files in directories, so `harness/<id>` cannot exist alongside `harness/<id>/x`. Found by the smoke test, 2026-08-21.
