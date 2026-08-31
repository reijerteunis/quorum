---
id: Q-0082
title: The preflight reports what it deferred, or the rule is amended
stage: draft
owner: ruudvanengelenhoven
repos: []
branch: harness/Q-0082/integration
priority: p3
created: 2026-08-30
iterations: {}
history: []
---
preflightDiffs defers a range whose endpoint an earlier step of the same flow creates, records it in deferredDiffs, and says nothing. Decide whether it emits one info per deferred range naming the range and its producing step, or whether the skipped-subject rule is amended to say a deferral is not a skip. The decision entry is the deliverable; under the second reading no code changes.

Opened 2026-08-31 as GO-1 of Q-0052's merged requirement, whose body is transcribed below rather
than referenced — a deferred obligation dies unless it is written into a successor's body, and
`requirements.yaml` reads the folder of the ticket it runs and not a sibling's. Belongs to M2 in
`docs/06-development-plan.md`. Inherited from Q-0051's OQ-1, which correctly ruled the fix outside
its own scope.

## The defect

`preflightDiffs` (`packages/core/src/engine/diff.ts`, `spike/src/engine.js`) defers a range whose
endpoint an earlier step of the same flow creates, records it in `deferredDiffs`, and **says
nothing**.

The only text describing a deferral today is `buildPrompt`'s dry-run placeholder, and Q-0052's
requirement measured that **it reaches nobody**: `runAgentStep` builds the prompt, then returns at
the `ctx.dry` short-circuit **above** `allocateOccurrence` and `persistArtifact`, so under `--dry`
the string is never persisted, never emitted and never shown; under a real run `materialiseDiff`
runs instead and the placeholder is never produced. Its whole observable effect is on a character
count in an `info` line that names no range.

## The rule it is measured against

*"Q-0035 accepted: a check that skips its subject must not report success"* (`docs/DECISIONS.md`,
2026-08-25), which `docs/GLOSSARY.md`'s **Preflight** entry states as reporting a declined
examination as *skipped*, and which Q-0051's merged requirement calls invariant 11. Register row 11
assigns it to Q-0051, which ruled the fix out of its own scope because an added event is new
behaviour under charter §2.

## What this ticket must decide first, and it is a decision entry rather than a line of code

Whether the preflight **emits one `info` per deferred range at run start** naming the range and its
producing step — `deferredDiffs` already holds both — or whether **the rule is amended** to say a
deferral is not a *skip*, on the grounds that the range is examined later rather than not at all.

The second reading is defensible and has never been written down. If it is right, the entry is the
deliverable and no code changes.

## If an event is added

It lands in `spike/src/engine.js` and `packages/core/src/engine/diff.ts` **together** — the
Q-0066 / Q-0068 / Q-0070 shape — or the port loses its independent witness. Its text must not claim
the range failed: a deferral is an ordering fact, not an error. The shape to copy is the empty-range
diagnostic's discipline — quote what is true, claim nothing about how the code got there.

The port freeze is recorded (`harness/port-charter.md`, `freeze-sha`), so a `spike/src` change also
re-records the SHA in the same commit, and §3's table of tickets that may legitimately edit
`spike/src` wants a row for this ticket.

## Do not re-derive the placeholder's reachability from an inherited account

Re-read `runAgentStep`'s first ten lines in order. **Two earlier accounts described the placeholder
as "the report"** — Q-0051's OQ-1, and Q-0052's own ticket body, which framed the question as
*whether* the placeholder discharges the rule rather than whether it is observed at all. Q-0052's
R-6 is the first account written from the code. Line numbers are deliberately omitted here:
`spike/src/engine.js` shifted twice in three days during Q-0038 and Q-0057, and Q-0051's body was
wrong about it three times.

- **Depends on:** nothing · **Blocks:** nothing
- **Non-goals:** the rest of the preflight; `materialiseDiff`; Q-0078's cache keying, which is a
  different defect in the same subsystem; anything about `--dry` beyond this one string.
