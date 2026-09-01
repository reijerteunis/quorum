# Docs and decisions

- The decisions are append-only. Each is one file in `docs/decisions/`, named `NNN-slug.md`, opening `# <title> — <YYYY-MM-DD>` and carrying **Decision**, **Alternatives considered**, **Why**; `docs/DECISIONS.md` is the index and gains one line per entry. A landed entry is never edited — reversing one is a new entry that names the old one. Cite an entry by its title and date, never by its file name or number.
- **An entry's date is the date it takes its place in the index**, not the date the choice was made; where the two differ the body says when it was decided. `packages/shared/src/docs.test.ts` enforces it — the index's dates never go backwards — so a back-dated entry turns the suite red. See *"An entry's date is the date it takes its place in the index"* (2026-09-01).
- `docs/GLOSSARY.md` is the vocabulary. When you need a new term, add it there before using it in a second file. Do not introduce synonyms for existing terms.
- The numbered docs (01–06) are living documents; edit in place and bump the status line at the top with the date and what changed.
- When code and docs disagree, the docs are wrong until a DECISIONS.md entry says otherwise — fix the docs in the same PR.
- Milestone ends with a DECISIONS.md entry: what was learned, what changed.
- Write prose, not bullet walls, in the numbered docs; bullets are fine in rules and plans.
