# Human-gated by default, auto opt-in per gate — 2026-08-06
**Decision:** Runs pause at every gate by default: the user sees the verdict, candidate diffs and reasoning, then advances / re-runs / overrides (including picking against the judge). Individual gates can be set to `auto` in the flow file.
**Alternatives considered:** Autonomous by default with end-of-run review — faster, but one bad judge call compounds through later stages, and a silently-merged bad diff would poison first impressions of an open-source release.
**Why:** Trust in agentic tooling is earned per gate; the gate screen (human judging the judges over real diffs) is also the product's strongest surface.
