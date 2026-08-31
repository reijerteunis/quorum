---
id: Q-0085
title: An entry's date is the date it takes its place in the index
stage: draft
owner: ruud
repos: []
branch: harness/Q-0085/integration
priority: p3
created: 2026-09-01
iterations: {}
history: []
---
Opened 2026-09-01 at Q-0037's requirements gate, where OQ-1 was routed to a successor rather than
ruled in place. The body below is `requirements/merged.md`'s Appendix A transcribed rather than
referenced, so the obligation cannot expire — a requirement is written by an agent reading its own
ticket body, and it reads no predecessor's folder.

**The finding.** `docs/DECISIONS.md` is described in three places as *"append-only, newest last"*
and is simultaneously grouped under `## YYYY-MM-DD` headings that must match each entry's own
`# Title — date` first line. For an entry decided on one date and landed after entries decided
later, the two descriptions cannot both hold: the entry takes the next file number and the last
index row, and its own date then sits under a heading earlier than the row above it.

**It is already enforced, and that is the point.** `packages/shared/src/docs.test.ts` asserts both
halves — *"every entry file is listed once, in the order the folder holds them"* (`:100`) and *"the
dates never go backwards — the index is append-only, newest last"* (`:112`). Measured 2026-09-01
over 74 entries: 74 index rows, 74 files, index order identical to numeric order, dates
non-decreasing, no heading/title mismatch. So the rule is not missing; it is **unwritten**. An
author who tries to land a back-dated entry today gets a red suite and no sentence explaining why.

**What is owed is one ruling, in either direction.** Either **(a)** an entry carries the date it
takes its place in the index — the landing date — and an entry whose decision predates it says so in
its own body, which is what the test already forces and what costs nothing; or **(b)** the index's
*"newest last"* prose is amended to say *"newest last by listing order, which is not always by
decision date"*, and the date assertion in `docs.test.ts` is deleted, which trades a guard for a
sentence. **(a) is the recommendation**, because it is what shipped, because the deciding date is
information the entry's body can carry losslessly, and because the alternative removes the only
mechanical check that the index is append-only at all.

**The historical instance is closed and is not evidence either way.** *"Product-level schema
annotations select semantic validation"* was authored on the Q-0011 implement branch at `8a9ac0f` on
2026-08-23 and reached `main` through the Q-0034 merge on 2026-08-24, landing mid-file in what was
then one 1,675-line document. Since *"A decision is a file; this page is the index"* (2026-08-28)
there is no mid-file position to be wrong, the entry is
`docs/decisions/031-product-level-schema-annotations-select-semantic-validation.md`, and its date is
defensible on either reading. **Do not re-derive this from the original Q-0037 body**, which
describes a flat file that no longer exists, and which also asserted that `docs.test.ts` checks no
order — the claim this ticket exists because the merge disproved.

**Scope.** One `docs/decisions/NNN-*.md` entry plus its index line, written by the human; optionally
one sentence in `harness/rules.md` under *Documentation*, citing the entry by title and date. **No
code changes.** `docs.test.ts` is untouched under reading (a). Nothing in `spike/`, `packages/core`
or `contracts/` is involved.

**This ticket must not be attached to a flow whose implement step would then be blocked on an entry
no step on its route may write.** That is the precondition-external-to-the-document shape that has
exhausted eight loops in this repository. The whole deliverable here *is* the decision entry, so the
work is the human's directly and there is no route to route it through — which is why Q-0037 routed
it here instead of carrying it as a criterion.

Belongs to M2 in `docs/06-development-plan.md`.
