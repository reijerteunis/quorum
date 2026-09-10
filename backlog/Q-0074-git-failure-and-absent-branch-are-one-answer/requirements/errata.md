# Errata — Q-0074

Corrections to `requirements/merged.md` made after it landed. Written **before the chore run
starts**, which is the window Q-0039's and Q-0067's gate obligations used, and never mid-loop —
*"An erratum is the last repair, not the first"* (2026-08-30) and Q-0094 E-3's window rule.

## E-1 — AC-2 and AC-3 are struck: Q-0115 landed them

**Ruled at Q-0115's requirements gate on 2026-09-10 and shipped 2026-09-11.** Q-0074's own GO-2 said
the census register and the `safe()`-declaration guard *"travel with the half that runs"*, and the
`git/` half ran first. This document was written assuming they land here; they did not.

**What shipped instead of AC-2**, and it is stronger than AC-2 specified.
`packages/core/src/caught-failures.source.test.ts` is keyed on **a git invocation whose failure is
caught**, never on a call to `safe()` — because Q-0115's requirements run measured that the
`safe()`-keyed predicate this document and decision 088 both use is **blind to six hand-written
`catch` blocks in `git.ts`**, one of which collapses. So AC-2 as written here would have shipped a
register that could not see the worst site in its own subject.

**The register already carries this ticket's ten rows**, classified against today's code and
deliberately unrepaired — seven `collapses`, one `best-effort`, two `distinguish` — under a comment
reading *"`fanout/fanout.ts` is classified and **not repaired**: that half is Q-0074's, which keeps
the id"*.

**So the register changes role: it is a forcing function rather than a deliverable.** Every repair
AC-4 to AC-12 makes must move its row's `disposition` and `becomes` to match, and the guard goes red
until it does. That is better than the arrangement this document planned, and it is why the
strike costs the ticket nothing: **twelve criteria remain, all of them `fanout/`'s.**

**AC-1 is unaffected and slightly widened by implication.** Q-0115's NG-6 deliberately left the ten
fanout rows carrying no source citation, on the ground that writing one there would be *"that
ticket's own AC-1 performed badly, one ticket early"*. Landing those citations is this ticket's.

## E-2 — one line number moved, and the wrong one is blank

AC-11 names *"`fanout.ts:205`'s module-level `.trim()`"*. Measured 2026-09-11: `:205` is blank and
the `.trim()` is at **`:204`**, the tail of the module-private `git()` runner. `.slice(3)` at
`:281` is correct and unmoved, as are `fanout.test.ts`'s four pins (`:249`, `:332`, `:352`, `:406`),
`lifecycle.ts`'s two rollback guards (`:136`, `:139`) and `fanout.source.test.ts:45`. Re-derive
anyway; this document's own §1 census rotted in a day once already.

## What is NOT corrected, and is not owed one

**The §1 census's `git/` rows now describe repaired code.** Rows 1–16 were measured before Q-0115
and thirteen of the twenty-four collapsed; five of those `git/` collapses are now fixed. The table
is left standing as the measurement that produced decision 088, because it is history rather than
instruction — and because every criterion below it is scoped to `fanout/`, whose eight rows are
untouched. A reader wanting today's state reads the register, which is executable.
