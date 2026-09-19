---
id: Q-0139
title: Manifest persistence is whole-list, and now runs twice per occurrence
stage: draft
owner: ruud
repos: []
branch: harness/Q-0139/integration
priority: p3
created: 2026-09-19
iterations: {}
history: []
---
Manifest persistence is whole-list and now happens twice per occurrence, so its cost is quadratic in
occurrence count and the constant doubled at Q-0138. Opened because Q-0138's GO-3 threshold was
crossed and that obligation requires a successor before it closes.

## What was measured, 2026-09-19 (Q-0138 implement iteration 1 §4, re-derived by the operator)

Same machine, same Node, 5 warm-ups discarded then 30 measured, manifest writes only:

| arm | replacements | bytes written | p50 | p95 |
| --- | ---: | ---: | ---: | ---: |
| before Q-0138 | 57 | 1,000,394 | 346 ms | ~390 ms |
| after Q-0138 | 112 | 1,955,529 | ~665 ms | ~735 ms |

**p95 rose ≈335–350 ms, or +88%** — past both halves of GO-3's threshold (100 ms **or** 10%), which
is why this exists. Per extra replacement **≈5.6 ms**, independently corroborated at 4.9 ms by the
operator's own measurement at the requirements gate.

**Against real wall clock it is nothing**: `Q-0015-4`, the largest run retained at 55 occurrences,
ran 41.5 minutes, so +0.35 s is **0.014%**. That is why this is p3 and not p2, and why Q-0138 was
right to ship without it.

## Why it is a ticket rather than a line

**The shape is quadratic and only the constant was measured.** `replaceManifest` serialises the
whole `manifest.steps` array, so cost grows with occurrence count *and* is paid per occurrence:
doubling the writes doubled a term that is already O(N²). 55 occurrences is today's maximum, not a
bound. At 200 occurrences the same arithmetic is roughly sixteen times the work, and nothing in the
product caps occurrence count.

**Every remedy is a design choice with its own risk**, which is what makes this a requirement rather
than a repair — and the file in question is the one a run must never lose:

1. **Skip the `fsync` on the allocate-time write only.** Cheapest, and it splits one file across two
   durability contracts — Q-0138 OQ-3 refused it on exactly that ground and said to measure first.
2. **Write incrementally** — append the occurrence rather than re-serialising the array. Fastest, and
   it gives up the atomic whole-file replacement that is the current design's guarantee.
3. **Journal, then compact.** Strongest, and it is a second on-disk format, which `readRun`'s
   *"a cast, never a check"* and `contracts/Q-0011/run-manifest.schema.json` both reach.
4. **Do nothing and cap.** Honest, and it owes a measurement of what occurrence count is actually
   reachable rather than a number chosen at a gate.

**Read Q-0037 first.** It measured the whole-manifest re-serialise at *"~3 ms against 63 minutes"*
and recorded it as **preserved rather than optimised**, refusing batched persistence because it is a
behaviour change to the one write path that must never lose a billed step. That refusal is the
argument this ticket has to answer, not one it may skip: what changed since is the constant, not the
reasoning.

## Not this ticket

1. **Q-0138 is not reopened.** The allocate-time write ships and stays; a running occurrence being
   named in the manifest is the behaviour, not the cost.
2. **No roll-up change.** `rollup()` skips `usage: null`, so an allocation adds no roll-up call and
   invocations stay at N+2. Q-0037's quadratic roll-up is a separate preserved defect.
3. **No cap, retention or eviction of run history.** Q-0076 owns the write side, Q-0123 the daemon's
   records.
4. **No schema or wire change.**

## Reopening / closing threshold

Close it with a measurement rather than a change if the reachable occurrence count is bounded low
enough that the quadratic term never matters. It is **p3** and stays p3 while the largest real run is
55 occurrences and the cost is 0.014% of it.
