---
id: Q-0068
title: The BYOS refusal calls the product "Harness"
stage: draft
owner: ruud
repos: []
branch: harness/Q-0068/integration
priority: p3
created: 2026-08-27
iterations: {}
history: []
---
Reported by Q-0046's implement report and again by Q-0047's merged requirement (Q-4), both of which
correctly refused to fix it in passing. The two BYOS refusal messages call the product **"Harness"**,
which `.claude/rules/product-boundaries.md` forbids in as many words: *"'Harness' is the concept and
the folder (`harness/`); 'Quorum' is the product. Never call the product a harness, never call the
folder quorum."* `docs/GLOSSARY.md` says the same, and dates the rename to 2026-08-22.

**Every site, verified 2026-08-27.** The string is `… is set — unset it; Harness runs on subscription
OAuth only`.

| Site | What it is |
| --- | --- |
| `spike/src/adapters/claude.js:12` | the `ANTHROPIC_API_KEY` refusal |
| `spike/src/adapters/codex.js:21` | the `CODEX_API_KEY`/`OPENAI_API_KEY` refusal |
| `spike/test/smoke.js:464` | qa-red's frozen fixture, which pins the string |
| `packages/core/src/adapters/adapters.test.ts:314` | Q-0046's pin of the same string in `core` |
| *(Q-0047's ported `claude.ts` and `codex.ts`)* | byte-identical by AC-3, landing before this ticket |

One further occurrence is prose rather than product-facing text and is in scope only as a tidy-up:
`spike/test/q0011-run-history.js:78`, a comment reading *"the repository shape Harness itself uses"*.

**Why it was preserved rather than fixed.** The message text is what a command prints, which
`harness/port-charter.md` §2 lists as externally observable — so preserving it needed no authority
and changing it needs an erratum or a decision entry first. More sharply: fixing it in `packages/core`
alone would leave the spike saying one thing and `core` another until the cutover, which is exactly
the silent divergence the freeze exists to make visible. *"The port preserves behaviour"*
(`docs/DECISIONS.md`, 2026-08-25) is explicit that a child which spots a real defect leaves it and
says so, and both children did.

**Both trees, together, like Q-0066.** The fix lands in `spike/src/adapters/**` **and**
`packages/core/src/adapters/**` in one change, or the port loses its independent witness. Two pinned
tests go red on purpose and are updated rather than deleted — `spike/test/smoke.js:464` is qa-red's
frozen artifact, and `spike/src` is frozen for Q-0009's fifteen children, but Q-0068 is not among
them, so the spike route is open the same way it was for Q-0063, Q-0065 and Q-0066.

**The one thing to decide: what the sentence says instead.** Three candidates, none obviously right:

1. **"Quorum runs on subscription OAuth only"** — the literal rename, shortest diff.
2. **"Quorum runs on your own subscription only"** — closer to the glossary's BYOS wording
   (*"bring your own subscriptions"*), and says what the adopter has to do rather than naming a
   protocol they may not recognise.
3. **Name the remedy, not the product** — an adopter who hits this has a key in their environment
   because every other tool wants one; the useful half of the sentence is *unset it*, and Q-0047's
   `adopter` user story asks for exactly that: *"I want to be told that, in that sentence, whether or
   not the CLI is installed."*

This is a cold-clone-path message — it is one of the first things a stranger with an API key in their
shell will see — so it is worth spending a sentence on rather than sed-ing the word.

**Non-goals.** The refusal's *ordering* and its coverage, which are Q-0047's AC-3 (per Q-0046's
erratum E-1) and must stay green through this change; `authError`'s messages; any other product-name
audit across docs or prose, which is `/review-docs`' job, not a ticket's; and the `quorum` binary
itself (Q-0010). Belongs to M2 in `docs/06-development-plan.md`.
