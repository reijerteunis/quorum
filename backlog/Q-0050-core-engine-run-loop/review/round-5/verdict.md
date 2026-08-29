# Verdict — Q-0050 round 5

*Panel: codex (1 major) and claude (4 majors, 4 nits) · read-only · 2026-08-29 · over
`addefa8..HEAD` — round 4's two fix commits and nothing else. Run out of band; the integration
branch is contained in `main`, so `review.yaml`'s range is empty (Q-0070's precedent).*

**changes-requested — nine findings, all upheld, all closed. No blocker.**

Every finding is a defect in round 4's own fixes. That is the fifth consecutive round of which
that is true.

## The round's subject, stated plainly

Three of the nine are the same defect at successive depths, and the sequence is the finding:

1. **Round 4** replaced AC-13d's length proxy with a sentence scan, because a proxy any short
   sentence passes is not a check.
2. **Codex, round 5** — that scan split on every newline, so soft-wrapped sentences were shredded.
   Measured: 195 corpus entries of which 7 were whole sentences; **65 of 72 real sentences
   invisible**. The scan written to close fake coverage was ~90% blind.
3. **Its fixture, first attempt** — I selected "a corpus sentence followed by a newline", which
   every whole *line* also satisfies, so the fixture passed against the builder it was written to
   rule out. Found only by running it against that builder instead of assuming.
4. **Claude, M2** — the widened marker regex closed E-20's *spelling* gap and left the **word
   order** one: `Why: behaviour preserved from spike/…` escaped it in two files, and `loaders.ts`
   was absent from the register entirely. E-20's own failure mode surviving the fix written to
   close it, one round later.

The register is now anchored on `Why:` — the one token every authority line must carry — and an
unclassifiable line **throws** rather than being skipped. Thirteen lines, seven of them
`preserved defect/`, which is E-20's ruled count.

**Claude undercounted by one.** It named two escaping markers; there are three —
`lifecycle.ts:97`'s `Why: deliberate addition, not preservation` carries no form of the word
`preserved` at all. Verified by listing every `Why:` line in the folder rather than by re-running
its regex.

## The most serious finding is M1, and it is a regression I introduced

Round 4's M3 was about how AC-4c's test was *constructed*. My fix deleted the **neighbouring**
test whole — `'no channel, stale correlation and invalid runtime answers fail by name'` — when
only one of its three assertions was the subject. That removed:

- **AC-4e** (`no answerGate` at all), which had no other coverage anywhere in `packages/core`;
- **AC-4d's pin**, which **E-19 cites by title** as the record of its ruled divergence from the
  spike's silent `{ abort: true }` fall-through.

A port regressing to the spike's behaviour — ending a run on a malformed socket message — would
have been green everywhere. All three assertions are restored, and the AC-4 row, which still
claimed 4a–4g coverage the same commit had falsified, is corrected.

## The rest

| # | Finding | Disposition |
| --- | --- | --- |
| M3 | the transcription scan read only the marker line, leaving six continuation lines unscanned, one already citing a decision by title | **upheld** — it now reads every line; `harness/rules.md` governs the whole file |
| M4 | `types.ts` promises "a step receives this object itself, never a copy" and nothing asserted it — the new test pinned the emit-time id, which was the passenger | **upheld** — pinned, and demonstrated red by restoring the spread |
| N1 | a comment cited a test the same commit deleted | upheld |
| N2 | two length assertions were strictly implied by the `toStrictEqual` above them | upheld — the cross-file defect count is kept, which is not implied |
| N3 | the second identity site was still at `{}`, where same-object and emptied are indistinguishable | upheld — one of the two sites had been fixed |
| N4 | "both already declared inputs" was false; `DECISIONS.md` was added in the same change | upheld — the claim that mattered (no new route) still holds |

## What five rounds say

14, 8, 11, 10, 9. The count is not falling and the *class* has not changed: a claim with no
executable check behind it, or a check that cannot see its own subject. Rounds 4 and 5 found four
assertions that could not fail — `not.toBe` satisfied by an interpolated id, an identity check at
`{}` twice, a fixture selector satisfied by any line.

The lesson is not "review more". It is that **reading a check does not establish that it works**;
only running it against the code it must reject does. Codex found three of these and I found none
of them unaided, which is the argument for the cross-vendor panel and against my own judgement of
my own tests.
