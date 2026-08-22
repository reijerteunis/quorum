# Docs and decisions

- `docs/DECISIONS.md` is append-only. A decision entry has: title with date, **Decision**, **Alternatives considered**, **Why**. Reversing a decision is a new entry that names the old one.
- `docs/GLOSSARY.md` is the vocabulary. When you need a new term, add it there before using it in a second file. Do not introduce synonyms for existing terms.
- The numbered docs (01–06) are living documents; edit in place and bump the status line at the top with the date and what changed.
- When code and docs disagree, the docs are wrong until a DECISIONS.md entry says otherwise — fix the docs in the same PR.
- Milestone ends with a DECISIONS.md entry: what was learned, what changed.
- Write prose, not bullet walls, in the numbered docs; bullets are fine in rules and plans.
