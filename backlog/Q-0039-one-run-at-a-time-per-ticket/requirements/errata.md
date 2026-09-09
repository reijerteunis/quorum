# Errata — Q-0039

Corrections to `requirements/merged.md` made after it landed. Each is ruled at a gate, which is the
only window an erratum has — *"the window for an erratum is a gate"* (Q-0094 E-3).

## E-1 — AC-5's ownership guarantee is narrowed to what a two-syscall release can deliver

**Ruled at the `implement` gate of chore run 2**, where round 2 returned `blocked` on review round
1's major 1 rather than spending a round on prose. That is Q-0083's mechanism working on its first
real refusal, and the refusal was correct.

**The finding is real and is not disputed.** `release()` reads the lock record, compares its token,
and then unlinks — three operations, not one. A replacement created between the comparison and the
unlink is deleted by the run that no longer owns it, which is concurrent execution reopened.

**Both remedies the finding names are foreclosed for an implement step.** A different lock
representation contradicts *"A run holds a lock on its ticket, and a stale one refuses rather than
being reclaimed"* (2026-09-09), whose Decision reads *"It is one file under `.quorum/`, created by
one exclusive syscall"*; and revising the approved contract is an erratum, which
`developer-generalist` may not write. The step said so and stopped, which is what a bound of zero is
for.

**AC-5 is narrowed rather than the code changed.** Its guarantee is now what the two syscalls
actually deliver, and the JSDoc round 2 wrote already states it:

- a replacement **already on disk when release begins** is seen and left alone — this is the
  human-clears-mid-run case AC-5's own *Test:* clause describes, and it is covered;
- a replacement **interleaved between the comparison and the unlink** is not, and is a documented
  bound rather than a claim.

**The residue is bounded, and the bound was measured rather than asserted.** A second run cannot
acquire while the file exists, so the window opens only if a human removes a legitimately held lock
*and* a successor acquires, both inside the gap between two adjacent syscalls. Human removal of a
held lock is already an intervention against the product's own refusal.

**The representation trade is routed to Q-0114 rather than left here.** A directory whose sentinel
is named by the token makes the common shape impossible by construction — a releasing run's `rmdir`
fails `ENOTEMPTY` against a successor's sentinel — and leaves a narrower window where the successor
has created the directory and not yet written its sentinel. Verified by reading the two designs
against each other at this gate, not taken from the report: it is **better and not race-free**, which
makes it a representation trade to be ruled with its own requirement rather than a fix to be applied
inside a review loop. Q-0114 is `draft`, unstarted, and already owns the lock's behaviour beyond the
happy path, so it takes this rather than a fourth ticket being opened — the Q-0066/Q-0068 precedent,
one surface and one gate.

**Not superseding decision 086 the same day it landed**, and the reason is stated rather than
implied: the entry is three hours old, nothing depends on it yet, and `mkdir` would satisfy its
"one exclusive syscall" clause — so a supersession is available and was considered. It is declined
because what it buys is a narrower race and not correctness, and deciding a representation under the
pressure of an open gate is how a ruling gets made for convenience rather than for the product.

## E-2 — Review round 1's major 2 is fixed, and is recorded here because it changes no criterion

An exclusive create that succeeded and then failed to write or close left an empty file behind: a
lock no run holds, which every later attempt reads as damaged rather than absent, leaving the ticket
unrunnable until somebody deleted it by hand. Round 2 takes the file back, best-effort, and the
refusal names the original failure rather than the cleanup's. No criterion moves; it is noted so a
reader of round 1's review does not go looking for an unclosed finding.
