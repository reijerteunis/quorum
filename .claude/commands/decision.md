Append a decision about: $ARGUMENTS

Write it as a new file `docs/decisions/<next-number>-<slug>.md`, taking the next number after the highest already there, then add one line at the bottom of the `docs/DECISIONS.md` index under its date: `- [<title>](decisions/<file>)`, adding the `## <YYYY-MM-DD>` heading if today has none.

The file's first line is exactly `# <title> — <YYYY-MM-DD>`, matching the index line and the date it is listed under — `packages/shared/src/docs.test.ts` fails if they disagree. Then **Decision:**, **Alternatives considered:**, **Why:**. Never edit an entry that has landed: if this reverses or refines an earlier one, name that one by its title and date. If it introduces a term, add it to docs/GLOSSARY.md in the same change. Show me the entry before writing it.
