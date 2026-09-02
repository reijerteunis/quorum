# Product context — Quorum

Read by the product managers and the head of product before any requirement is written or
judged. Quorum is the product being built in this repository; it is not a SaaS product and
has no customers paying per seat yet.

## What the product is

Quorum is open-source, local-first mission control for agentic software engineering. It
orchestrates several vendors' headless CLI coding agents (Claude Code, Codex CLI, later
Gemini CLI) through one adapter interface, always on the CLI's own subscription login and
never on an API key. Work is described as versioned files in the repository — flows in
`harness/`, tickets in `backlog/` — and a human sits at a gate between every step. It runs
as a local daemon plus browser UI, launched with one command. It is distributed free through
GitHub and announced via heyruud.com; it makes no money directly. Its two headline features
are multi-vendor judging (the writer of an artifact is never its reviewer) and one canonical
set of rules compiled into every vendor's dialect.

## Personas

| id | persona | who they are | what they care about |
| --- | --- | --- | --- |
| `maintainer` | Solo maintainer | One developer, or a lead on a small team, who already pays for two or more coding-agent subscriptions and runs several repositories. | Getting a ticket from intent to a reviewed, merged branch without babysitting; never having a bad diff land silently; knowing what a run cost. |
| `adopter` | Cold-clone adopter | A stranger who found the repo, has Claude and Codex subscriptions, and is trying it on their own repo for the first time. | Being productive within 30 minutes reading only the README; not being asked for an API key; trusting that nothing will touch their working tree. |
| `contributor` | Adapter contributor | An open-source contributor adding a vendor adapter or a flow template. | A documented adapter contract, a test suite that tells them they got it right, no vendor-specific leakage above the adapter layer. |

Name the persona in every user story. "The user" is not a persona.

## Surfaces

- **CLI** (`quorum`) — the only surface until M3, and the one the cold-clone test measures.
- **Local daemon + web UI** ("the Studio") — projects home, backlog board, mission control,
  gate screen, run history. From M3.
- **`harness/`** — flows, roles, rules and context files in the target repository. Files are
  the truth; the UI edits them and never holds state the files don't.
- **`backlog/`** — ticket folders in git. Replaces a ticketing tool.

A requirement must say which of these it touches.

## Domain vocabulary

Use exactly these words; `docs/GLOSSARY.md` is the authority: harness, flow, gate, adapter,
ticket, stage, contract, role, backward edge, fan-out step, integrate step, cross-vendor
rule, human-locked gate, BYOS.

Forbidden synonyms — agents invent these constantly:

- A **flow** is not a "pipeline", "workflow" or "graph".
- A **step** is not a "job", "task" or "node". A **task** is specifically an entry in
  `tasks.yaml` produced by solutioning.
- A **gate** is not an "approval", "checkpoint" or "review step".
- An **adapter** is not a "provider", "backend" or "integration".
- The **harness** is the concept and the folder; never call the product a harness, and never
  call the folder quorum.
- There is no "API key", "token" or "credential" anywhere in this product. The word is
  **subscription**.

## Quality pillars

Every requirement carries acceptance criteria for these where they apply:

1. **BYOS.** No code path, test, doc or example may accept an API key. `check()` refuses when
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set.
2. **Safety by construction.** A flow never writes to the user's working tree. Code-writing
   steps run in worktrees under `.harness/worktrees/` on branches beside
   `harness/<id>/integration`. Enforced in core, not in the UI and not by convention.
3. **Human-gated by default.** `auto` is opt-in per gate; `human-locked` (deploy) cannot be
   flipped. Exhausted loops always land on a human gate. Budget caps are not yet enforced.
4. **Files are the database.** Anything persistent is a file in `backlog/`, `harness/` or
   `.quorum/`. No hidden daemon state.
5. **Cross-vendor rule.** A reviewing or judging step must see at least one input written by
   a vendor other than its own; the flow linter enforces it.
6. **Product-agnostic.** Nothing in this repository knows about any specific SaaS product.
7. **The cold-clone test.** A stranger goes from installing Quorum to a multi-vendor-reviewed,
   human-approved merged branch in under 30 minutes reading only the README. A feature that
   lengthens the first 30 minutes needs a reason. **Two installation paths are claimed and one is
   refused:** the workspace-local path (`pnpm install`, `pnpm turbo run build`, `pnpm exec quorum`)
   and the locally packed path (the three emitting packages' tarballs installed together outside the
   repository) both work since Q-0098. **Registry-resolved `npx quorum` does not** — every package
   is `"private": true`, so it would fetch a stranger's package — and it is Q-0029's, in M6. Do not
   write a requirement, a test name or a success message that claims a cold machine can obtain
   Quorum from the public registry.
8. **Errors are explicit.** Invalid structured output saves the raw text beside the ticket and
   stops the run with a clear message. Never default silently.

## What a good requirement looks like here

Problem in the persona's words · a user story per persona · numbered, independently testable
acceptance criteria naming the surface · explicit non-goals · open questions with an owner
(one that would change a file format or the adapter contract is a blocker) · a cross-cutting
checklist (BYOS, worktree safety, gate behaviour, file format and its schema, lint rules,
cold-clone impact), even where the answer is "n/a".

Be sceptical of scope. Anything on the v1 exclusion list is a non-goal by default: multi-user,
remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter,
desktop shell.

## Current priorities

M0 — prove the two real CLI adapters on a real repository; the open question is whether
subscription-authed CLIs return structured output reliably enough to chain stages. M1 — prove
contracts → red tests → fan-out development → green. Everything else waits.
