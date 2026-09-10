# Contributing to Quorum

Thanks for looking. Two things are unusual about this repository and both are deliberate, so it is
worth two minutes before you open a pull request.

**Quorum develops itself.** Since August 2026 nearly every change here has been a ticket in
`backlog/` run through the flows in `harness/` — the same flows the product ships. That is the test
suite for the product as much as `pnpm test` is.

**The documents outrank the code.** If a numbered document in `docs/` and the code disagree, the
document is right until a decision entry says otherwise. Decisions are append-only and a landed one
is never edited.

## Before you start

- **Open an issue first** for anything beyond a typo. Quorum is pre-alpha and the plan moves; a
  ticket that duplicates something already scoped in
  [docs/06-development-plan.md](docs/06-development-plan.md) is wasted work.
- **Read [docs/GLOSSARY.md](docs/GLOSSARY.md).** It is short, and this repository uses its terms
  exactly — `containment` and `confinement` are different things, and neither is ever used for the
  other. A synonym in a pull request is a review comment.
- **Read [docs/DECISIONS.md](docs/DECISIONS.md)'s entry for whatever you are touching.** Most
  surprising code here is surprising on purpose, with an entry saying why.

## Getting set up

```bash
pnpm install
pnpm turbo run build
pnpm test          # the whole suite, forced — it defeats its own cache on purpose
pnpm lint
pnpm typecheck
pnpm exec quorum help
```

Node ≥ 22.13.0 and pnpm 10.x. You do not need an agent CLI logged in to work on Quorum itself; the
suite runs against a mock adapter.

## The rules that get enforced in review

These live in [`.claude/rules/`](.claude/rules/) — a copy derived from `harness/rules.md`, which is
canonical — and they are what a reviewer will hold you to.

**Every behaviour change ships with a test**, and the test must be able to fail. This is the single
most-cited rule here, because it is the one most often broken in ways that look fine: a guard whose
pattern matches nothing, an assertion satisfied by any input, a check whose subject was renamed out
from under it. Before you trust a new test, break the thing it guards and watch it go red.

**A test's verdict is a property of the commit** — never of the checkout it runs in or the account
it runs as. No test may depend on your git config, your OS user, or a directory that happens to
exist on your machine. `pnpm sweep:git-identity` runs the suite with no resolvable git identity, in
two checkout shapes, and CI runs it as two required jobs.

**Never add an API-key path.** Not in code, not in tests, not in a docs example. `check()` must
refuse when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set.

**Never write to the user's working tree from a flow.** Worktrees under `.harness/worktrees/`,
integration branch `harness/<id>/integration`, step branches beside it. Run history is the one thing
under `.quorum/`.

**Errors are explicit and never default silently.** Invalid structured output saves the raw text
next to the ticket and stops the run with a message naming the condition. A `core` error names the
*condition*; the *remedy* belongs to the surface, because M3's server will surface the same error to
somebody who may not have a shell.

**Comments are JSDoc on modules and exported symbols.** Where behaviour is deliberately
counterintuitive, one line naming the authority — `Why: preserved defect, see Q-0043 AC-7`. Do not
transcribe a decision entry or a ticket body into a source file; cite it.

**TypeScript strict.** No `any`. No `@ts-ignore` without a one-line reason on the same line. No
deprecated API in new code — `pnpm lint` enforces that one with type information.

## Commits and pull requests

Conventional commits, with the ticket id in the subject:

```
feat(core): bounded backward edges [Q-0009]
fix(cli): the refusal names the root it could not create [Q-0039]
docs(plan): Q-0067 shipped, and what its third review cost [Q-0067]
```

A pull request should say what changed, what proves it, and which decision entry governs it if one
does. A new dependency needs a one-line justification; if it changes architecture, it needs a
decision entry.

## Adding a decision entry

Write `docs/decisions/<next-number>-<slug>.md`, first line `# <Title> — <YYYY-MM-DD>`, then
**Decision**, **Alternatives considered**, **Why**. Add one line at the bottom of
`docs/DECISIONS.md`. `packages/shared/src/docs.test.ts` fails if the index and the folder disagree,
or if the dates go backwards.

**The date is the date the entry takes its place in the index**, not the date you made the choice —
where those differ, the body says so. Cite an entry by its title and date, never by its number or
file name.

## Adding a term to the glossary

Add it to `docs/GLOSSARY.md` **before** you use it in a second file, and add it to `CLAUDE.md`'s
term list in the same change — a check compares the two as ordered lists and will go red otherwise.
Do not introduce a synonym for a term that already exists.

## Working on an adapter

Read [docs/03-adapter-contract.md](docs/03-adapter-contract.md) first; it has a verified column
saying which flags and JSONL fields were actually observed rather than assumed. An adapter runs the
vendor's CLI on its own subscription login and maps its output into Quorum's one event format.
Nothing downstream of `packages/shared` knows which vendor produced an event.

A Gemini adapter is the standing "good first issue" — the contract is small and the two existing
adapters are the worked examples.

## Working on a flow

Flows are YAML in `harness/flows/`, mirrored byte-for-byte into
`packages/cli/templates/harness/flows/` — a test holds the two copies identical, so change both.
Run `quorum lint` after any edit, and `quorum run <flow> <ticket> --dry` to walk it without spending
anything.

[docs/02-sdlc-pipeline-spec.md](docs/02-sdlc-pipeline-spec.md) prints every shipped flow file
section by section, generated from the files themselves rather than transcribed.

## What is not open for a pull request

- **`backlog/`** is this repository's own ticket history. Do not edit somebody else's ticket.
- **A landed decision entry.** Reversing one is a *new* entry naming the old.
- **`docs/decisions/` renumbering.** The numbers order the folder and carry no other meaning.

## A note on scope

Quorum is deliberately narrow. It orchestrates agent CLIs and it does not rebuild a chat IDE; the
vendor CLIs keep owning interactive work. It is product-agnostic — nothing here may reference a
particular application. And it is local-first: multi-user, remote daemons and cloud sync are
explicitly out of v1.

If you are unsure whether something is in scope,
[docs/01-product-definition.md](docs/01-product-definition.md) has the locked v1 cut, and
[`.claude/rules/product-boundaries.md`](.claude/rules/product-boundaries.md) has the short version.
