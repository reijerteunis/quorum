---
id: Q-0107
title: The workspace stops depending on the spike
stage: draft
owner: ruud
repos: []
branch: harness/Q-0107/integration
priority: p2
created: 2026-09-05
iterations: {}
history: []
---
**Child B of the cutover, ruled at Q-0103's requirements gate 2026-09-05**, and the child where every
judgement lives. Order is **A → B → C**: **Q-0106** is A and runs first, **Q-0103** is C. One at a
time — Q-0039 is unfixed.

**Its criteria are AC-8 to AC-19 of
`backlog/Q-0103-the-cutover-delete-the-spike-retire-its-/requirements/merged.md`** — twelve, against a
ceiling of fifteen — numbered continuously across the three children. Read them there rather than from
a copy; §12 of that document says what a reader may not re-derive, and the register in AC-10 is
explicitly forbidden to trust any count stated in prose, including its own.

## Why B is separate from the deletion, which is the ruling that created it

> **You cannot demonstrate a re-aimed oracle red-before-green once its subject is deleted.**

Twenty-five files under `packages/**` depend on the spike. Every change to one is a retirement, a
re-aim, a transcription or a move, and **the only honest way to show a re-aim works is to run it
against the tree it used to read**. Do that in the change that deletes the tree and all twelve
criteria are verified by reading — which is *"A check is not established by reading it"* (2026-08-29),
the port's most expensive lesson, arriving at its own funeral. **So `spike/` stays for the whole of
this child**, and AC-11 requires every `re-aimed` site demonstrated red **then** green against the
live tree.

## The class that makes this child dangerous

Sixteen of the twenty-five read the spike from disk and fail **loudly** when it goes. **Nine fail
silently or not at all** — six subject-less import guards, `step-output.test.ts:61–63` which *requires*
production source to carry three `spike/src/...` citations, and two sites in a file no candidate gave
a criterion. A silent failure is green, so nothing surfaces it: that is what AC-12, AC-13, AC-14 and
AC-17 exist for, and it is why this child is reviewed by a second vendor rather than run by hand.
Decision 035's manual route is **rejected for B** and kept only as a fallback for C.

## Gate obligations

**GO-1 — the decision entry is landed and must be cited, not re-litigated.** *"A check outlives its
subject only if it can still fail"* (2026-09-05) rules all three dispositions: satisfied-by-the-absence
is deleted or re-aimed and shown red first; still-falsifiable-but-guarding-a-vanished-hazard is kept
only as a resurrection tripwire where the resurrection is real; a register entry is updated in the same
change. It also rules **transcription**: permitted only where the value is the product's own contract,
never where it was evidence about the deleted tree — there the site retires and names the sibling
assertion carrying the property. AC-10's `transcribed` verdict has no other authority.

**GO-2 — this child's `integrate` is the proof of Q-0106's commands**, per that ticket's GO-1, and
**Q-0103 must not launch until it is seen green**.

**GO-3 — if the gate wants B smaller, the seam is AC-12 + AC-13 + AC-19** — the silent class and its
production citations — which is a coherent ticket alone. Splitting anywhere else separates a re-aim
from the register row that disposes of it.

## Non-goals

- Deleting `spike/`, its CI jobs or the charter — **Q-0103's**, and only after this child is green.
- The commands, context files and roles — **Q-0106's**, and they land first.

Belongs to M2. Child B of **Q-0103**; runs after **Q-0106**, before **Q-0103**.
