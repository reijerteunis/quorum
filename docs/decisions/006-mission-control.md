# Mission control, not cockpit — 2026-08-06
**Decision:** The Studio owns the flow; the vendor CLIs keep owning free-form interactive hacking. Steps are either batch (watch streamed traces) or interactive (step-scoped chat: grill interviews, gate conversations, agent clarifying questions). Intervention = stop step / edit instructions / re-run in its worktree, plus one-click "open this worktree in your editor/terminal". The Studio does not rebuild the CLIs' interactive sessions.
**Alternatives considered:** Daily-driver chat IDE replacing the terminals — rejected: forever chasing three vendors' interactive feature sets, duplicating what CLIs do best.
**Why:** Development *starts* in the Studio (grill, architecture, dispatch); hand-hacking stays in the tools built for it.
