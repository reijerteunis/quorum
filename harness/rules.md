# Engineering rules — Quorum (canonical; compiled into CLAUDE.md / AGENTS.md from M5)

Until the compiler lands, `.claude/rules/` carries the same rules for Claude Code's own use.
When they disagree, this file wins and the other is the drift.

## Language and tests

- TypeScript strict. No `any`. No `@ts-ignore` without a one-line reason on the same line.
- Every behaviour change ships with a test. The mock-adapter end-to-end suite is the
  regression suite and stays green; adapters are covered by `adapters --probe` and its report.
- **Your worktree has no dependencies until you install them.** `commands.install` in
  `harness.yaml` runs only in an `integrate` step's worktree (`spike/src/engine.js:1034`), so a
  step that writes code starts in a fresh checkout with no `node_modules` and no
  `spike/node_modules`. Run `pnpm install --frozen-lockfile` and `npm install --prefix spike
  --no-audit --no-fund` before either suite, and run both — `npm test --prefix spike` and
  `pnpm turbo run test --force`. Reporting a suite as unrun is honest and reporting it as green
  without installing is not, and a reviewer cannot tell an uninstalled suite from a red one.
- **No deprecated API.** A symbol a dependency marks `@deprecated` is not used in new code, and
  one found in code you are already changing is reported rather than migrated in passing — the
  migration is its own change, because it is workspace-wide and the replacement is a decision.
  `tsc --noEmit` does **not** error on `@deprecated`; it is an editor strikethrough, and it never
  detected one. Since Q-0069 `pnpm lint` does: `@typescript-eslint/no-deprecated` is on at error
  severity, with the type information it needs, and it is the only type-aware rule enabled.
  It covers exactly what ESLint covers — `packages/**/*.ts` and `apps/**/*.ts`, tests included.
  **`spike/` is outside ESLint's scope entirely and stays unlinted**, so the port's independent
  witness detects nothing: read the dependency's own typings before reaching for an unfamiliar
  method there, and prefer the constructor a library documents to the chained method it merely
  still accepts.
- Prefer small, boring, proven libraries. A new dependency needs a one-line justification in
  the solution document, and a `docs/DECISIONS.md` entry if it changes architecture.
- Conventional commits with the ticket id in the subject: `feat(core): bounded backward
  edges [Q-0009]`.

## Comments

- **JSDoc, not line comments.** A module, exported symbol, interface field or non-obvious
  parameter is documented with a `/** … */` block stating its contract. `//` is for a single
  short remark inside a body, not for prose.
- **Code that needs explaining is written wrong.** Fix the name, the shape or the size before
  reaching for a comment. A comment restating what the next line does is deleted.
- **The one thing code cannot carry is why it is deliberately strange.** Where behaviour is
  counterintuitive on purpose — a preserved defect, a workaround, an option that looks wrong and
  is load-bearing — add **one line** naming the authority: `Why: preserved defect, see Q-0043
  AC-7.` A reader who wants the argument follows the pointer.
- **Never restate `docs/DECISIONS.md` or a ticket body in a source file.** Those are the durable
  record; a copy in code goes stale silently and doubles the size of every file that carries it.
  Cite, do not transcribe.

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

- The decisions are append-only. Each is one file in `docs/decisions/`, named
  `NNN-slug.md`, opening `# <title> — <YYYY-MM-DD>` and carrying **Decision**,
  **Alternatives considered**, **Why**; `docs/DECISIONS.md` is the index and gains one line
  per entry. A landed entry is never edited — reversing one is a new entry naming the old.
  Cite an entry by its title and date, never by its file name or number.
- `docs/GLOSSARY.md` is the vocabulary. Add a term there before using it in a second file;
  never introduce a synonym for an existing term.
- When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise —
  fix them in the same change.
