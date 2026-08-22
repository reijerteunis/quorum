# Engineering rules

- TypeScript strict; no `any`, no `@ts-ignore` without a one-line reason on the same line.
- Prefer small, boring, proven libraries. A new dependency needs a one-line justification in the PR and, if it changes architecture, a DECISIONS.md entry.
- Every behaviour change ships with a test. Core logic is tested through the mock adapter end-to-end suite plus focused unit tests; adapters are tested by the local `adapters --probe` and its JSON report.
- Files are the database. Anything persistent is a file in `backlog/`, `harness/`, or `.quorum/`; no hidden state in the daemon.
- One trace/event format (`packages/shared`). Adapters map to it; nothing downstream knows which vendor produced an event.
- Errors are explicit: invalid structured output saves the raw text next to the ticket and stops the run with a clear message. Never default silently.
- Safety by construction: worktrees, integration branch, `human-locked` gate on deploy, budget caps — enforced in `core`, not in the UI or by convention.
- Conventional commits, ticket id in the subject (`feat(core): bounded backward edges [Q-0009]`).
- Keep the cold-clone test in mind: if a feature makes the first 30 minutes longer, it needs a reason.
