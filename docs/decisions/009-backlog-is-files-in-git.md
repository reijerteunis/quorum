# Backlog is files in git, no ticketing tool — 2026-08-21
**Decision:** A ticket is a folder (`backlog/T-0012-…/`) with `ticket.md` frontmatter holding `stage`, `owner`, iteration counters and history; every stage writes its artifacts as files into that folder. Two layouts: `in-repo` (default) and `central` (one backlog repo referencing many target repos). The Studio's backlog board is a view over these files.
**Alternatives considered:** Jira/Linear via MCP (external dependency, un-diffable, breaks cold-clone test); SQLite in the Studio daemon (not shareable or reviewable, not versioned with the code).
**Why:** Handoff between humans owning different stages needs only the stage field; everything is diffable, auditable and works offline; multi-repo comes free via the central layout.
