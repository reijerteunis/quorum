# Q-0062 review — iteration 3

blocker: docs/04-architecture.md:37 The architecture now cites *“A run removes the worktrees it made, and never the refs”* (2026-08-31), but the corresponding decision file and `docs/DECISIONS.md` index entry are absent. GO-1 explicitly requires the maintainer to record that decision before implementation, and the same nonexistent authority is cited at five other changed sites. Before approval, the maintainer must add the decision and its index entry together, using the cited title and date (or update all six citations consistently if those change).
