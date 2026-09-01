# An entry's date is the date it takes its place in the index — 2026-09-01

**Decision:** A decision entry carries the date it **takes its place in the index**, not the date
the choice was made. Where the two differ, the entry's body says when it was decided, in its own
words; the heading and the `# Title — date` line record the landing. `docs/DECISIONS.md` therefore
stays literally *"append-only, newest last"* in both of its senses at once — listing order and date
order — and the index's date headings never go backwards.

This ratifies what `packages/shared/src/docs.test.ts` has enforced since it was written: *"every
entry file is listed once, in the order the folder holds them"* and *"the dates never go
backwards — the index is append-only, newest last"*. Measured 2026-09-01 over 74 entries: 74 index
rows, 74 files, index order identical to numeric order, dates non-decreasing, no heading/title
mismatch. Nothing changes in code, in the index, or in any entry.

**Alternatives considered:** **An entry carries its deciding date, and the index's "newest last"
prose is amended** to say *"newest last by listing order, which is not always by decision date"*,
deleting the date assertion in `docs.test.ts` — rejected because it trades the only mechanical
check that the index is append-only for a sentence, and because the information it protects is not
lost under the decision above: an entry's body can say when it was decided, losslessly, while a
test cannot recover an ordering nobody enforces. **Reordering the index by decision date and
renumbering the folder** — rejected outright: numbers order the folder and carry no other meaning
(*"A decision is a file; this page is the index"*, 2026-08-28), citations are by title and date,
and renumbering would break every `decisions/NNN-…` link in the repository to fix a problem that a
sentence in a body already solves. **Leaving it unwritten** — rejected because that is the state
this entry exists to end: an author who tries to land a back-dated entry today gets a red suite and
no sentence explaining why, which is a rule enforced by a test and stated nowhere.

**Why:** `docs/DECISIONS.md` is described in three places as append-only and newest last, and is
also grouped under `## YYYY-MM-DD` headings that must match each entry's own first line. For an
entry decided on one date and landed after entries decided later, the two descriptions cannot both
hold — the entry takes the next number and the last row, and its date then sits under a heading
earlier than the row above it. One of the two readings had to win, and the one that already shipped
is the one that costs nothing to keep.

The instance that raised it is closed and is not evidence either way. *"Product-level schema
annotations select semantic validation"* was authored on Q-0011's implement branch at `8a9ac0f` on
2026-08-23 and reached `main` through the Q-0034 merge on 2026-08-24, landing mid-file in what was
then one 1,675-line document. Since the entry above there is no mid-file position to be wrong, and
its date is defensible on either reading; it is not amended.

Raised as a nit by Q-0011's round-2 review on 2026-08-24, carried by Q-0037, and split out as
Q-0085 at that ticket's requirements gate on 2026-09-01 — because a decision entry is the human's
to write, so a ticket whose whole deliverable is one has no step on any route that could satisfy
it. Recorded here rather than as a criterion for exactly that reason.
