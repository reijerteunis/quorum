# Erratum: `--auto` does reach an unanswered gate, and can end a run undecided — 2026-09-01

**Decision:** One clause of *"A run nobody answered is undecided, and keeps the branch it proved"*
(2026-09-01) is wrong and is corrected here. That entry's point 6 says *"`--auto` cannot produce
`undecided`"*. **It can, and the rest of the same sentence says so.** The full clause reads:

> `--auto` cannot produce `undecided`: it answers every gate it is allowed to, and a `human-locked`
> gate it may not answer has no channel, so it reaches the same three sites as any other unattended
> run and is undecided for the same reason.

The reasoning after the colon is correct and the assertion before it is not. **The corrected clause
is: `--auto` *can* produce `undecided`**, and does so at exactly one kind of gate — a `human-locked`
one, which `--auto` is forbidden to answer. Everything else in that entry stands, including the
three-of-ten site classification, the three-way status table, the return-rather-than-throw ruling
and the exit code.

**Alternatives considered:** **Editing the sentence in place** — refused: `.claude/rules/docs-and-decisions.md`
makes a landed entry immutable and says a reversal is a new entry naming the old one, and by the
time this was found an implementer had already built against that entry and a reviewer had already
cited it, which is precisely the reliance the rule protects. **Changing the code to match the wrong
clause** — refused, and it is the more dangerous option, because it is the one a loop told to satisfy
a criterion would reach for: making `--auto` auto-advance a `human-locked` gate would break *"Human-gated
by default, auto opt-in per gate"* (2026-08-06), whose whole content is that `human-locked` can never
be automated. **Leaving it and letting the ticket's own errata carry it** — refused: an obligation
recorded only in a closed ticket's folder expires, and this entry is the durable record a later
reader of point 6 will meet.

**Why:** the measurement is one line in each tree. `spike/src/engine.js:617` and
`packages/core/src/engine/routing.ts:14` both read
`kind === 'auto' || (auto && kind !== 'human-locked')`, so `--auto` advances every gate except a
`human-locked` one; an unattended run that reaches one has no answer channel, which is the third of
the three undecided sites. So `--auto` is not an exception to the previous entry — it is an ordinary
instance of it, and saying otherwise made the entry contradict both the code it governs and its own
next clause.

Found by Q-0040's chore review, round 1, major 2 — a cross-vendor reviewer reading the decision entry
against the diff it was told to judge and catching that the authority was wrong rather than the
change. The entry it corrects was written by hand at Q-0040's requirements gate ninety minutes
earlier; a sentence being fresh is not evidence that it is right. Q-0040.
