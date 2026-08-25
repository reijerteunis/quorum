# Quorum docs

*Status: index, 2026-08-25. Created because `README.md` and `CLAUDE.md` had pointed here for
some time and nothing was at the address.*

Read **01, 02, 04, 06** first — in that order. They are the product, the pipeline, the code map
and the plan. The other three are reference you consult rather than read.

## The numbered documents

| | | |
| --- | --- | --- |
| **01** | [Product definition](01-product-definition.md) | What Quorum is, who it is for, and the locked v1 cut. Start here. |
| **02** | [SDLC pipeline spec](02-sdlc-pipeline-spec.md) | The stages, the state machine, and every shipped flow file section by section — including `chore` (§5.8). |
| **03** | [Adapter contract](03-adapter-contract.md) | What an adapter must implement, per-vendor flags and JSONL fields, with a verified column. Read when writing or fixing an adapter. |
| **04** | [Architecture](04-architecture.md) | The package map and the safety properties `core` is responsible for. |
| **05** | [Design prompt](05-design-prompt.md) | The UI brief for the screens M3–M4 build. |
| **06** | [Development plan](06-development-plan.md) | Milestones M0–M6, their definitions of done, and the current ticket list. **The current milestone lives here.** |

## The two that outrank the rest

- **[DECISIONS.md](DECISIONS.md)** — every decision and why, append-only, newest last. If code and
  a numbered doc disagree, the doc is wrong until an entry here says otherwise. Never contradict an
  entry silently: add a new one, or amend the old one naming the new.
- **[GLOSSARY.md](GLOSSARY.md)** — the vocabulary. Use exactly these terms (harness, flow, gate,
  adapter, ticket, stage, containment, contract, role, backward edge, integrate, cross-vendor rule,
  panel, chore flow, occurrence, preflight, dry run, BYOS). A new term goes here before it is used in a second file, and synonyms
  for existing terms are not introduced.

## Conventions

The numbered docs are living documents: edit in place and bump the status line at the top with the
date and what changed. DECISIONS.md is append-only. Rules live in `.claude/rules/` and are
summarised in `CLAUDE.md`; the canonical per-project context an agent reads at run time is in
`harness/`.
