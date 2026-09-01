---
id: Q-0092
title: CLI runs command and the run-history presentation layer
stage: draft
owner: ruud
repos: []
branch: harness/Q-0092/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
**The largest single command — `spike/bin/harness.js:462–533`, 72 lines — and the whole formatting
layer under it.** `runs` lists run history and opens one run in detail, in human and `--json` form.

**Everything it reads is already in `core`.** `manifestShapeError`, `readRunsDir`, `sortRuns`,
`isIncomplete`, `occurrenceSeq` and `vendorTokenTotal` are all in
`packages/core/src/run-history/reader.ts`, lifted there by Q-0049, and `reader.ts` never writes. So
this child ports **presentation only**: `formatMoney`, `formatTokens`, `formatVendorSummary`,
`formatOccurrenceUsage`, `statusLabel`, `runHeaderLine`, `printRunsListHuman`, `runsListJSON`,
`printRunDetailHuman`, `runDetailJSON`.

**It inherits a decision, and the decision is the reason this is its own child.** Q-0037's OQ-2 was
ruled on 2026-09-01: **an occurrence's usage is not a roll-up row and is not rendered as one.** The
four measures print separately, each through `formatTokens` so a null reads `n/a` and never `0`;
no `unpriced_steps` on a single occurrence, where it can only be 0 or 1 and says nothing the status
does not; summing stays the roll-up's job, where the cache pair is a breakdown and never a summand.
A `packages/cli` that re-collapses the two reintroduces Q-0011's round-2 nit 5, and
`spike/test/q0034-review-fixes.js` B2's `tokens=1100` assertion is the guard that catches it —
**it reads the per-step line, because `printRunDetailHuman` never renders the roll-up.**

**Inherits 505 lines** — `q0011-runs-cli.js` (221) and `q0011-run-history.js` (284). Note that
`q0011-runs-cli.js` was reclassified from binary-only to `split` by Q-0037, because the spike gained
a `validateArtifact` the file asserts over directly; its library half is already carried.

**Preserved defects, reported and not fixed here:** the list/detail disagreement over a symlinked
run directory, and `vendorTokenTotal` returning `null` when both totals are null while the cache
fields are populated — Q-0037 ruled the latter a *ruling* rather than a fix, reachable only from a
malformed manifest.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

`input.backlog` resolves against the running ticket's own folder, so nothing injects Q-0010's body
into this run. These five are the parent's §4 and are binding.

1. **The spike stays authoritative and green until cutover.** `spike/` is what develops Quorum
   today and every child of Q-0010 runs through it. A witness that has been edited is not one, so
   **do not modify `spike/src/`**. Q-0010's children are *not* in `harness/port-charter.md`'s
   `children:` list, so the branch-scope job reports them out of scope rather than failing them —
   the rule is this body's, not the guard's. If a change to `spike/src` is genuinely required, stop
   and say so; it takes §3's mirror-and-re-record path and is a decision, not a step.
2. **The spike's own tests are not deleted or edited to make room.** A child *adds* coverage under
   `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059's
   traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash and Q-0068's product name
   in the BYOS refusal are all open tickets that land in both trees; do not close one here.
4. **`packages/core` already holds the logic.** Every domain helper the spike CLI defines locally
   is in `core` — checked by name in Q-0010's body. If something appears to need porting, look for
   it in `core` first and say so if it is genuinely absent; the CLI is a presentation layer over an
   API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change.** It records, file by
   file, what the workspace suite carries of `spike/test/` and which half transfers at Q-0010. A
   child that translates a binary half without re-classifying its file leaves a register saying the
   work is still owed — and the file's own line totals are pinned, so they are **re-derived, not
   adjusted**.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, whose body carries the cut, the
order and the measurements this one does not repeat.
