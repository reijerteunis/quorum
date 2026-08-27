# Engineering rules

- TypeScript strict; no `any`, no `@ts-ignore` without a one-line reason on the same line.
- No deprecated API in new code; one found in code you are already changing is reported, not migrated in passing — the migration is its own change. `tsc --noEmit` does not error on `@deprecated`; it is an editor strikethrough. Since Q-0069 `pnpm lint` does: `@typescript-eslint/no-deprecated` is on at error severity, with the type information it needs, and it is the only type-aware rule enabled. It covers exactly what ESLint covers — `packages/**/*.ts` and `apps/**/*.ts`, tests included. `spike/**` is outside ESLint's scope entirely and stays unlinted, so nothing detects one there.
- Prefer small, boring, proven libraries. A new dependency needs a one-line justification in the PR and, if it changes architecture, a DECISIONS.md entry.
- Every behaviour change ships with a test. Core logic is tested through the mock adapter end-to-end suite plus focused unit tests; adapters are tested by the local `adapters --probe` and its JSON report.
- Files are the database. Anything persistent is a file in `backlog/`, `harness/`, or `.quorum/`; no hidden state in the daemon.
- One trace/event format (`packages/shared`). Adapters map to it; nothing downstream knows which vendor produced an event.
- Errors are explicit: invalid structured output saves the raw text next to the ticket and stops the run with a clear message. Never default silently.
- Safety by construction: worktrees, integration branch, `human-locked` gate on deploy — enforced in `core`, not in the UI or by convention. Budget caps are specified but not yet enforced; do not rely on one stopping a run.
- Conventional commits, ticket id in the subject (`feat(core): bounded backward edges [Q-0009]`).
- Comments are JSDoc (`/** … */`) on modules, exported symbols and non-obvious fields; `//` only for a short remark inside a body. Code that needs explaining is written wrong — fix the name or the shape first. Where behaviour is deliberately counterintuitive, one line naming the authority (`Why: preserved defect, see Q-0043 AC-7`); never transcribe DECISIONS.md or a ticket body into a source file.
- Keep the cold-clone test in mind: if a feature makes the first 30 minutes longer, it needs a reason.
