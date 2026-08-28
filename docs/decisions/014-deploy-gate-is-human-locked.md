# Deploy gate is human-locked; script steps pulled into v1 — 2026-08-21
**Decision:** Gate type `human-locked` cannot be set to `auto`; the deploy template uses it. `type: script` steps (previously v1 roadmap) are required by qa-red, qa-final and deploy and move into v1 scope.
**Why:** A tool that can deploy autonomously on day one would poison trust; the SDLC cannot prove red/green without running a test command.
