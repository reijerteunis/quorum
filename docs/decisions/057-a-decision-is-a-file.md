# A decision is a file; this page is the index — 2026-08-28

**Decision:** `docs/DECISIONS.md` becomes an index. Each of its 56 entries is now its own file
under `docs/decisions/`, named `NNN-slug.md`, whose first line is that entry's own title and date
as an h1. The number orders the folder and carries no other meaning: **an entry is still cited by
its title and its date** — the form every citation in `docs/`, `harness/`, `backlog/` and the
source comments already uses — and not one citation changed. Adding a decision is a new file plus
one line at the bottom of the index. Editing a landed entry is still forbidden, and append-only is
now a property of the layout rather than a rule to remember, because a new decision touches no
existing file.

**Nothing was rewritten, and that is checkable rather than asserted.** Concatenating the 56 files
in index order and restoring the heading level reproduces the 1,675-line document byte for byte,
with one exception in the other direction: the old file was *missing* a blank line between
*"The erratum is closed"* and *"Q-0035 accepted"*, and the split supplies it. Every other byte of
every entry — including the ones that are wrong on purpose, like the interval
[043](043-the-erratum-is-closed-the-sentence-was-true.md) corrects and the cause
[040](040-erratum-m1s-closing-entry-on-q-0006s-empty-diff.md) retracts — is where it was.

**Alternatives considered:**

**(a) Leave it as one file.** It is only 177 KB and `grep` does not care. Rejected on the reader,
not the size: with 56 entries and no table of contents, the only way to find out whether a decision
exists was to read for it, and the file grows by roughly two and a half entries a day at the rate
of the last three weeks.

**(b) Group by date or by milestone — nine or six files instead of 56.** Fewer files, and every
citation would then resolve to a file holding several entries, so a link needs an anchor and an
anchor is derived from the title's punctuation. The titles here carry backticks, colons, em dashes
and quotation marks; anchor generation differs between renderers. One entry per file makes the link
the identity and needs no anchor at all.

**(c) Split, but keep each entry at `##` so a concatenation is byte-identical.** Tempting for
exactly the verification above, and refused: a document whose only heading is an h2 is wrong in
every renderer, and the verification is a one-time claim about a migration rather than a property
worth deforming 56 files to preserve. It was performed with the heading level restored, which
proves the same thing.

**Why: the file was being loaded in full by every agent, in every session, to be read by none of
them.** `CLAUDE.md:11` imports `@docs/DECISIONS.md`, so all 177,486 bytes entered the context of
every run in this repository — the requirements flows, the implementers, the reviewers, this
session. The index is 8,560 bytes, and it carries the one thing a citation needs: every title, with
its date, in order. An agent that recognises a title it must not contradict now opens one file
averaging 3 KB instead of receiving all 56 whether or not it needed one.

**Cost accepted, and it is the same sentence as the benefit.** An agent no longer has the full text
of every decision in front of it. That is the point, and it is a real loss: several of this
project's best findings came from an agent noticing a contradiction with an entry nobody had
pointed it at. What survives in context is the *titles*, which for this file is most of the signal
— they are written as claims (*"skipped is not passed"*, *"a check that skips its subject must not
report success"*), not as labels — but an entry whose title under-describes it is now easier to
miss. The mitigation is the one the titles already imply and not a mechanism.

**What it touched outside `docs/`.** Three guards read this document and each was pointed at the
folder rather than weakened: `packages/shared/src/docs.test.ts` (Q-0041 AC-4/AC-8, which now also
checks the index against the folder in both directions), `spike/test/q0033-surface.js` S13.6
(Q-0033 — `spike/test/` is outside the port freeze, which covers `spike/src/`), and
`packages/shared/turbo.json`, whose `test` inputs declared `../../docs/DECISIONS.md` and now
declare the folder beside it, with the walk registered in `packages/core/src/turbo-inputs.test.ts`
as *"A cache hit names what the task reads"* (2026-08-28) requires. S13.6 came out stronger by
accident: it used to take the first block matching its topic anywhere in the concatenated document,
and now requires exactly one file to match.

**Found by:** Ruud, 2026-08-28 — *"docs/DECISIONS.md became very big and should be split up"*.
