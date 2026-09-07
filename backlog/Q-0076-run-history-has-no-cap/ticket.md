---
id: Q-0076
title: Nothing in run history has a cap, and prompts are the largest thing in it
stage: draft
owner: ruud
repos: []
branch: harness/Q-0074/integration
priority: p3
created: 2026-08-28
iterations: {}
history: []
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

Opened 2026-08-28 from Q-0070's OQ-5, whose body the merged requirement wrote out **in full** rather
than promising it, so the obligation could not expire with the ticket that raised it. This body is
that text; do not re-derive its numbers from Q-0070's headroom measurements, which measure a
different thing.

**What changed under it.** Q-0070 removed `runCommand`'s 1 MiB ceiling, and that ceiling was the
only thing bounding `output.txt` — incidentally, never by design. `persistArtifact`
(`spike/src/engine.js:429`) writes the string whole with no cap and always did. So this is not a
defect Q-0070 introduced; it is a bound Q-0070 removed, which had been doing work nobody had chosen.

**The measurement, taken at Q-0070's requirements gate against `.quorum/runs/` as it stood.** The
largest `output.txt` on disk is **71,318 bytes** (`Q-0072-2/steps/011-integrate`), and the five
largest cluster at 70–71 KB. The largest run-history file of *any* kind is a **242,181-byte review
`prompt.txt`** — 3.4× the largest output, and bounded by nothing either. Total `.quorum/runs` is
16 MB.

**The question, which is not the one it looks like.** Nothing in run history has a cap, and
`output.txt` is not the largest thing in it — prompts are, by 3.4×. `testReport`
(`engine.js:505–516`) already keeps 12,000 bytes of head and 12,000 of tail with a middle omission
marker, and is the shape to copy if a cap is wanted. So the question is whether run history is
**archival** — in which case everything stays whole and the cap belongs on the disk rather than on
any one string — or **diagnostic**, in which case the treatment belongs on prompts first and
`output.txt` second. The evidence above is the starting point.

Deciding it before writing anything matters here for the reason Q-0033 established: a cap chosen to
fix the wrong file is a behaviour change nobody can undo cheaply, because the discarded bytes are
gone from the record the product calls its database.

**Not in scope by inheritance:** `testReport`'s existing 24,000-byte treatment and
`ctx.lastIntegration`'s `slice(-3000)` were both explicitly out of Q-0070's scope and stay out of
this one unless the archival-or-diagnostic answer moves them.

Belongs to M2 in `docs/06-development-plan.md`.

## After the cutover — corrected 2026-09-07

**Void: the `persistArtifact` site.** The engine-side name is `persistArtifact`
(`packages/core/src/engine/types.ts:168`, wired at `engine.ts:234`) and the write itself is
`packages/core/src/run-history/writer.ts:369–381` — `fs.writeFileSync(target, String(text))`, still
with no cap, and Q-0049 split it into a `writer.ts` that is the only file in `packages/core`
permitted to write under `.quorum/`. The finding is unchanged: this is a bound Q-0070 removed, not a
defect it introduced.

**Re-measured 2026-09-07 against `.quorum/runs/` as it stands.** The body's instruction not to
re-derive its numbers from Q-0070's headroom measurements still binds — this is a re-derivation of
the ticket's *own* measurement, taken the same way, and every figure has moved:

| | at Q-0070's gate | 2026-09-07 |
| --- | --- | --- |
| total `.quorum/runs` | 16 MB | **62 MB** across 107 run directories |
| largest `output.txt` | 71,318 B | **171,480 B** (`Q-0050-3/steps/007-prove-red`) |
| largest file of any kind | 242,181 B review `prompt.txt` | **337,730 B** review `prompt.txt` (`Q-0103-2/steps/006-review`) |
| prompt-to-output ratio | 3.4× | **1.97×** |

**The headline moved and the question did not.** *"Prompts are the largest thing in it"* is still
true, and **the margin has nearly halved** because outputs grew faster than prompts — so the body's
3.4× is the wrong number to reason from, and a treatment aimed only at prompts now leaves a 171 KB
artifact untouched. The archival-or-diagnostic question is unchanged and is still what has to be
decided before anything is written.

**The shape to copy is where the body says**, with its site moved: `testReport` is
`packages/core/src/engine/suite-output.ts:58` and keeps `maxBytes = 24000` — 12,000 of head and
12,000 of tail with a middle omission marker.

**The inherited non-goals stand**: `testReport`'s existing treatment and `ctx.lastIntegration`'s
`slice(-3000)` stay out unless the archival-or-diagnostic answer moves them.
