# Errata — Q-0101

Corrections and rulings on `requirements/merged.md`, written at a gate. **The window for an erratum
is a gate** — one landed between a review returning and the next implement starting reaches neither
(Q-0094 E-3(a), and Q-0097 E-1, which narrowed a criterion to fit an implementation not yet
attempted). Nothing here is written pre-emptively against a finding nobody has made.

## E-1 — OQ-3 is ruled: AC-13 stands as written, assertion included. 2026-09-04, requirements gate.

**Ruling: keep both.** The register row's prose (AC-10) and the suite's own header sentence (AC-13)
both record which counterpart carries which claims, and AC-13 keeps its assertion.

**Why.** The document offered three readings and recommended this one; the gate adopts it rather
than the cheaper halves. The two instruments have different readers: `spike-parity.test.ts` is read
by someone auditing what the port still owes, and the suite header is read by someone editing the
suite. A statement that exists only in the register is one the implementer of the *next* change does
not meet. This is not the duplication this repository keeps finding — that defect is *a second
description of a property already checked*, which is what §0.2 narrows AC-1 to AC-3 to avoid, and
which is a claim about assertions rather than about prose.

**What this changes: nothing.** AC-13 is satisfied as written in §4. It is recorded here because
OQ-3 named the gate as its owner, and an open question left visibly unanswered is one a review round
may spend itself re-opening — the shape Q-0091's rounds 2 and 3 cost $14.28 and one round that
changed no files at all.

## E-2 — GO-5 is discharged by the operator at this gate, and no further implement round may spend itself on it. 2026-09-05, exhaustion gate of chore run 2.

**Ruling: GO-5 is satisfied. Round 4 must not re-attempt it.** Cite this erratum and move on.

**Why no implement step could have discharged it.** GO-5 asks for matched sweep samples at the
merge base *and* on the implement branch. An implement step has exactly one worktree, checked out
at its own branch, and no second checkout to compare against. Round 3 tried to synthesise one by
removing its own newly indexed file from the working tree while `HEAD` and the index stayed at the
implement tip — a hybrid tree that is neither ref — so `@quorum/cli` failed structurally in every
"base" run. **Review round 3 was right to refuse that sample**, and right again that the remedy is
*"a genuine checkout whose working tree, index and `HEAD` all represent `edcc7ad`, obtained through
the gate/human environment"*. That is this erratum.

Rounds 2 and 3 cost **$24.41** and round 3 changed no files at all, both spent on a blocker no step
on this route can clear. GO-3 named this hazard in advance and it happened anyway — the twelfth
appearance of a loop handed work no agent in it can perform, and the second on this ticket's own
route after Q-0091's identical $14.28.

**The measurement, performed at this gate.** Five matched pairs, interleaved so environmental drift
falls on both arms equally, each arm a separate `git clone` in the bare shape with
`.harness/worktrees` and `.quorum/runs` asserted absent before every run:

| arm | ref | runs | result | wall time |
| --- | --- | --- | --- | --- |
| merge base | `edcc7ad` | 5 | **all exit 0**, 0 failed files, 0 failed tests | 108–112 s |
| implement tip | `4438307` | 5 | **all exit 0**, 0 failed files, 0 failed tests | 109–116 s |

**The direction GO-5 exists to detect is absent: this ticket does not move Q-0102's failure rate.**
Both arms are zero, and the implement arm is not measurably slower — 109–116 s against 108–112 s —
which is the number §7 R-1 wanted, since that risk was that an additional process-spawning,
workspace-building suite in `packages/cli` would worsen the flake it is a suspect in. It does not,
on this instrument.

**Context that is not part of GO-5 but bears on it.** Earlier the same session the sweep was run 25
further times with no failure: 11 in the working checkout at `e47fb1d`, one under 48 CPU burners on
16 cores (1.5x slower, still green), one against a concurrent second forced suite, 7 in a bare clone
at `e47fb1d`, and **5 in a bare clone at `bb8e143` — the commit Q-0102 names red — which exonerates
the commit**. Recorded in that ticket's body at `3cf345c`.

**Limits, stated rather than implied.** Thirty-five green sweeps bound a rate; they do not explain
Q-0102's first-hand sighting, and they do not make it false. The instrument is one machine, 16
cores, darwin, warm pnpm store, against CI's two-core `ubuntu-latest`. **GO-5 asked for a data point
in each direction and forbade fixing Q-0102 here; both halves are honoured.** Nothing in this
erratum closes that ticket.

**What does not change.** Every acceptance criterion stands exactly as written in §4. This erratum
rules a *gate obligation*, not a criterion, and it moves no assertion.
