# Verdict — Q-0050 round 4

*Panel: codex (1 major) and claude (5 majors, 4 nits) · read-only · 2026-08-29 · over
`8355940..addefa8` — round 3's fix commit plus the coverage audit. Run **out of band**: the
integration branch is contained in `main`, so `review.yaml`'s `{base}...harness/{id}/integration`
range is empty and the flow cannot review a merged ticket. Q-0070's precedent.*

**changes-requested — ten findings, all upheld, all closed. No blocker.**

Codex is the reviewer that carries the cross-vendor property: every line under review was written
by Claude. `solution/errata.md` E-1–E-19 was supplied in the prompt as binding, which the flow
cannot do — `review.yaml` names no errata input (E-9).

## Codex — 1 major, upheld in full and it was the sharpest of the round

**The 120-character length proxy for AC-13d's "reproduces no sentence" is passed by any short
copied sentence.** Upheld. After round 3 I substituted a length check for the scan and *labelled*
it a proxy, treating the label as sufficient. It is not: a label describes a gap, it does not close
one. Replaced with the scan the criterion asked for.

**My stated reason for not implementing it was false.** I had written that a real scan needed a new
route through Q-0072's input guard. `docs/DECISIONS.md` and `backlog/*/ticket.md` are **already
declared inputs** of `@quorum/core#test`. I asserted a constraint instead of checking one, inside
the commit whose purpose was auditing unchecked claims.

**Chasing codex's count mismatch found the larger defect.** The register matched `Why: preserved
**defect**` only, so three markers were invisible to it — `engine.ts:35` (`preserved design`),
`engine.ts:218` (`preserved behaviour`), `routing.ts:126` (`preserved behavior`), two of the three
spelling the same word differently. A register built two rounds earlier *to replace a weak count*
read as complete beside three sites it could never see. E-20 rules the count; the register now
covers all ten markers by kind and authority.

## Claude — 5 majors, 4 nits, all upheld

| # | Finding | Disposition |
| --- | --- | --- |
| M1 | `types.ts` still justifies `nextGateId` by the per-step copy round 3 deleted | **upheld** — and round 3's verdict had explicitly asked for the opposite sentence; that half never landed |
| M2 | `scenarios.md:313` still says the terminal event carries the raw cost | **upheld** — E-18's own defect reproduced one section below the row I corrected, in the commit whose purpose was the row-by-row pass |
| M3 | AC-4c's new test never constructs clause (i), and its discrimination cannot fail | **upheld** — two fresh contexts made it the stale case twice; `not.toBe` was satisfied by the interpolated id alone |
| M4 | AC-6d's recorded justification names the wrong log line | **upheld** — the `exhausted` line IS written before `askGate`; the real obstacle is that `handleFail` has no caller in `core` until Q-0052 |
| M5 | step-id enrichment moved from bind time to emit time, unpinned | **upheld** — a real semantic change riding along with M-1's remedy, with AC-2b struck by E-8 so nothing covered it |
| N1 | the two new authority comments are prose where `harness/rules.md` allows one line | upheld |
| N2 | `channel.ts`'s header is now false — `detachPending` settles an in-flight pull before `finalise` | upheld |
| N3 | the `String()` coercion obligation lives only in a JSDoc | upheld — E-11's *"a comment is not a route"*, now **E-21** |
| N4 | `engine.test.ts`'s identity pin cannot distinguish unchanged from emptied at `{}` | upheld |

Claude also reported one defect **live at HEAD and outside the reviewed range**: `scenarios.md:90`
carried the new substring scan *and* the superseded proxy sentence spliced together, because a
string replacement matched a fragment of the older text. Fixed.

## What this round says about the ticket

Four rounds, 43 findings. Every round found defects in the previous round's fixes, and this one is
no exception: seven of its ten are mine from rounds 3 and 4, including two vacuous assertions
(M3's `not.toBe`, N4's `{}`) of exactly the kind earlier rounds taught me to look for.

**Two new checks were demonstrated red before being trusted** — the transcription scan by pasting
`DECISIONS.md`'s own *"Every decision and why, append-only, newest last."* onto an authority line,
and M5's pin by restoring bind-time semantics. A third, M3's replacement, is discriminating by
construction: the two errors now differ in which id each names, not merely in being different.

**The hand route's weakness is stated rather than hidden.** I judged findings on code I wrote.
Codex's major is the evidence that this matters — it caught a self-labelled proxy I had talked
myself into accepting, and a constraint I had asserted without checking.
