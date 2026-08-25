# Engineering rules — Quorum (canonical; compiled into CLAUDE.md / AGENTS.md from M5)

Until the compiler lands, `.claude/rules/` carries the same rules for Claude Code's own use.
When they disagree, this file wins and the other is the drift.

## Language and tests

- TypeScript strict. No `any`. No `@ts-ignore` without a one-line reason on the same line.
- Every behaviour change ships with a test. The mock-adapter end-to-end suite is the
  regression suite and stays green; adapters are covered by `adapters --probe` and its report.
- Prefer small, boring, proven libraries. A new dependency needs a one-line justification in
  the solution document, and a `docs/DECISIONS.md` entry if it changes architecture.
- Conventional commits with the ticket id in the subject: `feat(core): bounded backward
  edges [Q-0009]`.

## Architecture

- Files are the database. Anything persistent is a file in `backlog/`, `harness/` or
  `.quorum/`. The daemon holds no hidden state.
- One trace and event format lives in `packages/shared`. Adapters map onto it; nothing
  downstream may learn which vendor produced an event.
- Vendor-specific knowledge lives in the adapter and nowhere else.
- Safety is enforced in `core`, never in the UI and never by convention: worktrees, the
  integration branch, the human-locked deploy gate. Budget caps are specified in
  `harness.yaml` but nothing reads them yet.
- Errors are explicit. Invalid structured output is saved beside the ticket as raw text and
  the run stops with a clear message. Never default silently.

## Hard product constraints

- **Never add an API-key path**, including in tests, fixtures and documentation examples.
  Adapters run on the vendor CLI's own subscription login. `check()` refuses when
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set, and refuses *before* it
  probes the CLI, so a missing CLI cannot mask a key.
- **Never write to the user's working tree from a flow.** Worktrees live under
  `.harness/worktrees/` (`.quorum/` holds run history, not worktrees); the integration branch is
  `harness/<id>/integration` with step and task branches beside it.
- Quorum is product-agnostic. No reference to any specific SaaS product except as an example
  name in demo data.
- Flows are YAML files in the project. The UI edits files and never holds the truth.
- Human-gated by default; `auto` is opt-in per gate; `human-locked` cannot be overridden.
- Keep the cold-clone test in mind: a feature that lengthens a newcomer's first 30 minutes
  needs a reason.

## Documentation

- `docs/DECISIONS.md` is append-only: title with date, **Decision**, **Alternatives
  considered**, **Why**. Reversing a decision is a new entry naming the old one.
- `docs/GLOSSARY.md` is the vocabulary. Add a term there before using it in a second file;
  never introduce a synonym for an existing term.
- When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise —
  fix them in the same change.
