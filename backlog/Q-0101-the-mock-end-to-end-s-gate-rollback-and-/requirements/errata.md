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
