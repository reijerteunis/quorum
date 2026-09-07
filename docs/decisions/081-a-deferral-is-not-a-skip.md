# A deferral is not a skip, and the preflight says nothing about one — 2026-09-07

**Decision:** the run-level diff preflight goes on emitting **nothing** when it defers a range, and
*"Q-0035 accepted: a check that skips its subject must not report success"* (2026-08-25) is **not
amended**, because it does not reach this case. Q-0082 offered those two as its alternatives; the
answer is neither, and no code changes.

**A deferral is not a decline to examine.** The rule governs a check that could have examined its
subject and did not. `docs/GLOSSARY.md`'s **Preflight** entry already states the preflight's
guarantee as *per endpoint, not per range* — every endpoint that is **due** is resolved at run start,
and it *"never resolves an endpoint that is not due, and never reports one as having failed to
resolve."* An endpoint an earlier step of the same flow has yet to create is not a subject the
preflight passed over; it is a subject that does not exist yet. So this entry ratifies what the
glossary already says rather than changing anything, which is the Q-0085 shape.

**The measurement that decides the second half.** A deferral is not the rare case anyone assumed. A
range is deferred whenever an earlier group of the flow creates one of its endpoints, and
`packages/core/src/engine/diff.ts` classifies it that way **even when the ref already exists at run
start** — its own words, because *"bytes captured before its producer ran are that step's PREVIOUS
output."* `harness/flows/chore.yaml:32` diffs
`harness/{id}/integration...harness/{id}/implement` while `implement` at `:6` is the step that
creates the right endpoint, and that line has read so since the flow was created (Q-0008, `3b8eb1e`,
the only commit to touch it). **So the chore flow's review range is deferred on every run the engine
was capable of deferring on — 45 of the 50 `flow=chore start` lines this backlog records.** The other
five are 2026-08-24's, which predate the deferred-range handling Q-0035 landed on 2026-08-25
(`dad6254`). Not one of the 45 was wrong to say nothing.

An `info` per deferred range would therefore print, on every run, that the ordinary thing is about to
happen. That is the reassurance *"The board reports push lag, and never a CI conclusion"*
(2026-09-06) refused in its own domain, and the asymmetry it named holds here for the same reason:
**the instrument may warn and may never reassure.** This entry extends that from a board fact to a
preflight one.

**What is emitted is what is actionable, at the moment it is actionable**, and `diff.ts` already
distinguishes the two ways a deferred range can go wrong, and within the first of them it
distinguishes **which** step owed **which** ref. Where an **endpoint does not resolve**, the
missing-endpoint diagnosis branches on whether a producer owns the ref that failed: the failing
endpoint's own producer is named as ``step "${producer.step}" was expected to create
${producer.ref}``, while a producer of the *other* endpoint explains the deferral without being made
to owe the failure — ``the range was deferred waiting for step "${producer.step}" to create
${producer.ref}``. The code's own comment states the rule: such a producer *"is never phrased as
owing the ref that failed, because no step owed that one"* (Q-0038). And where
the range **resolves but spans nothing**, `emptyRangeFailure` takes a deferral-aware remedy in the
two branches where containment is answered — ``check that step "${deferred.step}" committed its work
to ${deferred.ref}``, in place of the *"review it before it becomes contained"* advice a pre-existing
range gets. Its own comment gives the reason: for a range this run deferred, the endpoint *"never
became contained — it started that way, because that step committed nothing."* Where containment is
**indeterminate** the remedy is the generic *"re-run the check above and fix whatever stopped git
answering"*, which is right — with git declining to answer, the deferral is not the fact standing
between the reader and a diagnosis — and the producing step is still named in the body above it. So the deferral is not merely remembered; it changes what the
reader is told, in both failure paths, at the moment either can be acted on. Silence at run start
costs nothing because nothing is withheld.

**Alternatives considered.** *Emit one `info` per deferred range at run start, naming the range and
its producing step* — `deferredDiffs` holds both, so it is cheap; rejected on the measurement above,
because it is a line on every run for the commonest outcome, and because the same information
already reaches the reader in the only case where it changes anything. *Amend the skipped-subject
rule to say a deferral is not a skip* — rejected as unnecessary rather than wrong: the rule is about
declining to examine, the glossary already scopes the preflight's guarantee per endpoint, and
amending a landed entry to say something it never claimed would weaken a rule that is doing its job
elsewhere.

**Why.** Q-0051's OQ-1 and Q-0052's ticket body both framed this as *whether the `--dry` placeholder
discharges the reporting rule*, and Q-0052's R-6 measured that the placeholder **reaches nobody**:
`runAgentStep` returns at the dry short-circuit above `allocateOccurrence` and `persistArtifact`, so
it is never persisted, emitted or shown, and under a real run `materialiseDiff` means it is never
produced. A string in a discarded buffer is not a report and this entry does not treat it as one.
What that leaves is a narrower question than the two the ticket posed, and the narrower question has
a measured answer.

**Not decided here.** Whether `--dry` should name the ranges it would defer. `--dry`'s output is a
reporting surface whose whole purpose is to say what each step would do, and today it says
`dry run — prompt N chars` (`packages/core/src/engine/steps.ts:234`), a number in which a deferral is
invisible. That is a change to what a command prints, with its own subject and its own test, and it
is a ticket rather than a clause of this one. It is stated here so it is a live question rather than
an obligation buried in a closed ticket's entry.
