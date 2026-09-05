# A check outlives its subject only if it can still fail — 2026-09-05

**Decision:** When a change deletes something a check was written about, the check is dispositioned
**in the same change**, and which disposition it gets is decided by one question: *can a commit still
turn it red for a reason somebody would act on?* Three classes follow, and they are not
interchangeable.

**(a) Satisfied by the absence — deleted or re-aimed, and shown red before it goes.** An expression
that the deletion itself makes true reports green over nothing. `(jobs['spike']?.steps ?? [])` is the
recorded instance: it reads as a check on the `spike` job and is satisfied by that job's removal,
because the empty list contains no `git config --global`. This is *"a check that skips its subject
must not report success"* (2026-08-25) arriving through a deletion rather than through a skip. A
guard in this class may not simply be left: it is re-aimed at a subject that still exists, or it is
deleted, and the change **demonstrates it red against the tree before the deletion** — because a
clause that was already vacuous and a clause that is correctly retired are indistinguishable in a
green run.

**(b) Still falsifiable, but guarding a hazard that no longer exists — kept only as a resurrection
tripwire, and only where the resurrection is real.** The six `expect(line.includes('spike')).toBe(false)`
clauses in `packages/core/src/**/*.source.test.ts` are this class. After the cutover a file *could*
still contain the string, so they can still fail — but the hazard they were written for, a live
cross-tree import while both trees existed, is gone. Keeping such a clause is a judgement, not a
default: it is kept where re-introducing the reference would be a real defect, and deleted where it
would merely be strange. What it may **not** do is remain while being described as the coverage it
used to be. **Class (b) is the one that looks like (a) and is not**, which is why the question is
about falsifiability rather than about whether the subject still exists.

**(c) A register that names the subject — the entry is updated, and the update is the record.**
`CI_JOBS` pins a job the cutover deletes, deliberately, so that *"updating one line here is how that
becomes a decision instead of a silence"*. A register is an inventory: removing an entry is the act
that records the choice, and a register that silently loses a row has destroyed the only evidence
that anyone chose.

**On transcription, which is the second half of the same question.** `spikeSource`'s JSDoc
(`packages/shared/test/corpus.ts:86`) refuses transcription while the spike exists, because the spike
is *"its only independent witness"* and a test should compare against the witness rather than against
a copy of it. That reasoning expires with the witness, and its expiry does not make transcription
free. **A literal may be transcribed only where the value is the product's own contract — what
`packages/**` must produce — and never where it was evidence about the deleted tree.** A transcribed
constant is a measurement frozen at a moment with nothing left to re-derive it from; where the thing
it measured is gone, the site **retires** and names the sibling assertion that carries the property
instead. Every transcription carries its provenance in place: what it was taken from, and on whose
authority.

**Alternatives considered.** *Delete every check whose subject goes, uniformly.* Simple, and it
throws away class (b) tripwires that a maintainer would genuinely want, plus the class (c) registers
whose whole value is that removing a row is visible. *Keep every check and let the suite thin itself
over time.* This is what happens by default and it is the failure being ruled: `(jobs['spike']?.steps
?? [])` survived a review, an `integrate` and CI while checking nothing. *Rule it per site at each
gate.* Already tried implicitly; it produced three neighbouring rulings and no rule, which is how the
same question reached a fourth ticket.

**Why.** The cutover deletes 55 files and 9,732 lines that 25 files under `packages/**` currently
read, and **nine of those fail silently or not at all** — the class nobody sees, because a check that
stops having a subject keeps reporting success. This repository has paid for that shape repeatedly
and always found it late: Q-0050's five assertions that could not fail, Q-0062's ref-deletion guard
blind to three spellings, Q-0088's negative check that started passing the moment a file moved,
Q-0101's own `smoke.js:267` counter reading `n >= 0`, and this session's first attempt at repairing
`fail.test.ts` AC-5, which swapped a machine-dependent assertion for an unfalsifiable one and was
caught only by someone trying to demonstrate it red.

The rule is one question rather than a taxonomy of subjects because the taxonomy is what keeps
failing: the six `includes('spike')` clauses and the `spike` job assertion look identical from the
outside — both mention a deleted tree — and belong to different classes. *Can it still fail for a
reason somebody would act on?* separates them, and it is answerable by mutation rather than by
reading, which is the only way this repository has ever established that a check works.
