---
id: Q-0075
title: A passing command's stderr is discarded, so a green suite loses its warnings
stage: draft
owner: ruud
repos: []
branch: harness/Q-0075/integration
priority: p3
created: 2026-08-28
iterations: {}
history: []
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

Opened 2026-08-28 from Q-0070's OQ-6, whose successor body the merged requirement wrote out in full
so it would outlive the ticket that found it.

**The asymmetry.** `runCommand` returns stdout **only** on the success path, and stdout followed by
stderr on the failure path. So a suite that passes with warnings loses them: whatever it wrote to
stderr is thrown away precisely when nothing else is wrong. `packages/core/src/fanout/command.ts`
documents the asymmetry in `CommandResult`'s own JSDoc and **nothing tested it** until Q-0070's AC-2
did — `printf hello` writes no stderr, so the landed shape pin could not see it.

**Q-0070 preserved it deliberately, and that is not the same as endorsing it.** The port charter
preserves behaviour, and changing this inside a fix for the capture would have been scope creep
wearing a bug fix's clothes. What Q-0070 did instead was make it visible, written down and tested,
which it was not before. This ticket is where the choice actually gets made.

**Why it is not obvious.** Changing it means every *green* `integrate` run's `dev/integration.md`
and persisted `output.txt` gain turbo's and vitest's stderr, which is most of their output. So the
question is not *"is stderr useful"* — it plainly is — but **"is `out` the artifact a human reads or
the one a machine parses"**, and `testReport` (`spike/src/engine.js:505–516`) already answers that
differently for each. An answer that does not distinguish the two consumers will be wrong for one of
them.

**Landing constraint, inherited.** Any change lands in `spike/src/fanout.js` **and**
`packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068/Q-0070 shape — or the port loses
the independent witness the freeze exists to provide. Q-0070's AC-2 tests pin the current behaviour
in both trees (`stderr is discarded on the success path`), so they are the assertions this ticket
would deliberately change, in both trees, rather than discover.

Belongs to M2 in `docs/06-development-plan.md`.

## After the cutover — corrected 2026-09-07

**Void: the whole of *Landing constraint, inherited*.** There is one tree. Any change lands in
`packages/core/src/fanout/command.ts` alone, and Q-0070's AC-2 pin exists once rather than twice —
it is still the assertion this ticket would deliberately change rather than discover.

**The asymmetry, re-measured.** `command.ts:169` is the success path and returns
`{ code: 0, out: readCapture(outFile), timedOut: false }` — stdout only, the `stderr` capture file
written and then dropped. The failure path at `:165` returns `captured`, which is stdout followed by
stderr. `CommandResult`'s JSDoc still documents the split in one line at `:36`: *"stdout on success;
stdout followed by stderr on failure."*

**Both files still exist to be captured**, which sharpens the fix rather than changing it: Q-0070's
capture already opens a `stderr` descriptor at `command.ts:138` and writes to it on every run. So
the success path is discarding bytes it has already paid to collect — the change is which file is
read, not whether it is captured.

**`testReport` moved and moved usefully.** It is `packages/core/src/engine/suite-output.ts:58`, split
out of the engine by Q-0053 into a module of its own with `environmentFailure` beside it. The body's
central question — *is `out` the artifact a human reads or the one a machine parses* — is therefore
now asked across two files rather than two call sites in one, and `suite-output.ts` is the file whose
whole purpose is the human-readable answer. That is a better place to argue from than the body had.

**Everything else stands**: the consequence for a green `integrate` run's `dev/…/integration.md` and
persisted `output.txt`, and the requirement that an answer distinguish the two consumers.
