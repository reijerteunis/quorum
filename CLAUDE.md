# Quorum

Open-source, local-first mission control for agentic software engineering: flows as versioned
files, multi-vendor CLI agents on subscription OAuth, backlog as files in git, a human gate
between every step. Launched via heyruud.com. Product-agnostic — nothing in this repo knows
about any specific SaaS product.

## Read first

- @docs/README.md — index; start with 01, 02, 04, 06
- @docs/DECISIONS.md — every decision and why; do not contradict one silently, add a new entry
- @docs/GLOSSARY.md — use exactly these terms (harness, flow, gate, adapter, ticket, stage, contract, role, backward edge, integrate, cross-vendor rule, BYOS)
- @docs/06-development-plan.md — current milestone and its tickets

## Rules (full text in .claude/rules/)

- @.claude/rules/engineering.md
- @.claude/rules/product-boundaries.md
- @.claude/rules/docs-and-decisions.md

## Working in this repo

- Stack: pnpm + Turborepo, TypeScript strict, Node ≥ 22, Vitest, ESLint. See docs/04-architecture.md for the package map.
- Until M2 lands, the runnable code is the spike in `spike/` (plain Node ESM). Do not extend the spike beyond M0/M1 needs; port it into `packages/core` instead.
- Every behaviour change ships with a test. The mock-adapter end-to-end test is the regression suite; keep it green.
- Never add an API-key path. Adapters run on the vendor CLI's own login. `check()` must refuse if `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set.
- Never write to the user's working tree from a flow. Worktrees under `.harness/worktrees/` (run history is the one thing under `.quorum/`), integration branch `harness/<id>/integration`, step branches beside it.
- Commits: conventional commits; reference the ticket (`Q-0012`) in the subject.
- From M2 onward Quorum develops itself: a change starts as a ticket in `backlog/` and goes through the flows in `harness/flows/`.

## Commands

- `pnpm test` — all tests · `pnpm lint` · `pnpm typecheck`
- Spike (M0/M1): `node spike/bin/harness.js <init|ticket|board|run|lint|adapters>`

## Slash commands and agents

- `/ticket` create a backlog ticket · `/decision` append a DECISIONS.md entry · `/milestone` show the current milestone's open tickets · `/review-docs` check docs for contradictions
- Agents in .claude/agents/: `docs-reviewer`, `adapter-engineer`, `flow-author`
