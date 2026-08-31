# Review — Q-0062

blocker: docs/04-architecture.md:37 The worktree lifecycle cites *“A run removes the worktrees it made, and never the refs”* (2026-08-31), but that decision entry and its `docs/DECISIONS.md` index row are absent. GO-1 explicitly requires a human to record the decision before implementation, and AC-12 requires these authority lines to cite the resulting entry. Have the maintainer add and index the decision under the cited title (or update all citations if the recorded title differs) before approval.
