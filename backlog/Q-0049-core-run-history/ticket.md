---
id: Q-0049
title: core/run-history — the manifest, occurrences and roll-ups
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0049/integration
priority: p2
created: 2026-08-25
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-28T20:53:54.518Z
    cost: 11.446
---
Lifts run history out of `spike/src/engine.js` into its own module in `packages/core`. In the spike
it is roughly 200 lines interleaved with the run loop — `initialiseRunHistory`, `allocateOccurrence`,
`terminalOccurrence`, `persistArtifact`, `replaceManifest`, `normaliseUsage`, `rollup`, `errorOf`,
`countUsage`, `formatCost`, `nextRunId`, `trimIncompleteUtf8Suffix` — and it also owns the *reader*
that currently lives in the CLI: `readRunsDir`, `sortRuns`, `manifestShapeError`, `occurrenceSeq`,
`isIncomplete` and the `realpath` traversal guard at `spike/bin/harness.js:135–246`. Writer and
reader are one subsystem and M3's server needs both. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**The format is frozen.** `contracts/Q-0011/run-manifest.schema.json` governs it, and the
frozen-contract rule means this ticket may not change it — a persisted format belongs to a ticket
that opens those files legitimately. That is not a formality: Q-0035's closing entry explicitly
declined to add the diffed SHAs to the manifest for this reason, even though it would have saved an
evening of archaeology. The semantic checks that ride on the format are Q-0045's.

**What the manifest is for, in one sentence each.** Lifecycle: a run that started must be a run that
ended, in every terminal state — completed, regressed, failed, interrupted. Occurrences: one entry
per adapter call, script or integrate step, carrying its own usage, errors and retained files;
adapter occurrences keep their exact `prompt.txt` and final or raw-invalid `output.txt`; gates and
fan-out parents allocate none. Roll-up: per *vendor*, never blended.

**Three defects this code has already had, which the port must not reintroduce.**

1. **A failed step's cost was dropped from the roll-up entirely** — one crashed review hid $4.54 of
   a $10.25 run. Failure is exactly when you most want to know what you spent. Fixed in M0.
2. **Whole failed runs are missing from `ticket.md`'s `history`.** Q-0006's roll-up reads $22.15
   against $33.74 in `runs.log`, because four runs that failed or were interrupted never reached the
   history. M1's closing entry records this as still open, and *"any UI reading `history` inherits
   the same gap"* — which now means M3.
3. **A collision refusal that threw after the `start` line was written, with a catch that rethrew
   without calling `finish()`** — re-opening, in new code, the "run that started and then stopped
   existing" gap Q-0004 closed for interrupts. Found by Q-0011's round-2 panel, in round 1's own
   fix. The lesson recorded with it is worth carrying into this port: *review the fix round, not only
   the feature round*.

**The path guard is not lexical.** `path.resolve` does no filesystem work and `statSync` follows
links, so a single-segment symlink inside `.quorum/runs/` passes every string test and still reads a
manifest anywhere on disk. Q-0011's round-2 panel found this in round 1's fix; `realpath` is the
answer and it must survive the port.

**Roll-ups never invent money.** A null cost displays as `n/a` beside its token count, never rounded
to `$0.000`, and a total states how many of its steps had no price (2026-08-22). No rate table ships
with the product. The port is a good moment to make that unrepresentable in the types rather than
merely observed.

**Sequencing.** Q-0037 holds one major and eight nits against this code from Q-0011's reviews. Land
it on the spike first or port the fixed version — but not both, or the port and the fix will collide.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** run history in `engine.js` — manifest, occurrences, roll-ups
- **Lifts from `spike/bin/harness.js`:** the reader: `manifestShapeError` (:142), `readRunsDir` (:151), `sortRuns` (:171), `occurrenceSeq` (:184), `isIncomplete`, the `realpath` traversal guard (:135–246)
- **Depends on:** Q-0041, Q-0045 · **Depended on by:** Q-0050
- **Invariants inherited:** register rows 3, 4, 15 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
