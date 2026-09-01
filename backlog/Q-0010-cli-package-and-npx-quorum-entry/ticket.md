---
id: Q-0010
title: CLI package and npx quorum entry
stage: draft
owner: ruud
repos: []
branch: harness/Q-0010/integration
priority: p1
created: 2026-09-01
iterations: {}
history: []
---
Created as a folder on 2026-09-01, at the id `docs/06-development-plan.md` has cited since
2026-08-21 and `plan-backlog.test.ts` has registered as deliberately uncreated since 2026-09-01.
**M2's last substantive item; the cutover queues behind it, and so does M3.** The parent, on
Q-0009's model: it owns the ground rules, the order and the cutover hand-off, and ports nothing
itself.

**Everything below was measured against the tree today, not inherited from the plan bullet.** The
bullet is one line from 2026-08-21 and this repository has now been wrong three times about what a
stale body contains — Q-0052's named a gate that was already ported, Q-0053's omitted a function
nobody would have found, Q-0040's called a fix cheap that the code cannot express.

## 1. What this actually is, and it is not a port

**Every domain helper the spike CLI defines locally already exists in `packages/core`.** Checked by
name, not by reading:

| `spike/bin/harness.js` defines | already in |
| --- | --- |
| `findProject`, `loadProject` | `core/src/backlog/project.ts` (Q-0043) |
| `manifestShapeError`, `readRunsDir`, `sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal` | `core/src/run-history/reader.ts` (Q-0049) |
| `lintDirectory` | `core/src/lint/lint.ts` (Q-0044) |
| `overrideAdapters` | `core/src/adapters/override.ts` (Q-0047) |
| `containment` | `core/src/git/git.ts` (Q-0042) |

Eleven of eleven. So **Q-0010 is not "port 565 lines"** — the logic landed during Q-0009 and the
spike CLI has been holding duplicates ever since. What is genuinely unbuilt is a **presentation
layer**: `die`, the colour helpers, `formatMoney`, `formatTokens`, `formatVendorSummary`,
`formatOccurrenceUsage`, `statusLabel`, `runHeaderLine`, `printRunsListHuman`, `runsListJSON`,
`printRunDetailHuman`, `runDetailJSON`, `printReport`, `currentBranch` — plus argv parsing, exit
codes, the interactive gate reader, a `bin` entry and the packaging that makes `npx quorum` work
from a clean clone. `packages/cli/src/index.ts` today is one line: `export const name = '@quorum/cli'`.

**This changes the expected cost.** Q-0009 was $657 across fourteen children because it moved
engine, adapters, fan-out, git, backlog, contracts and run history. Q-0010 moves formatting and
argv over an API that already exists. Anyone sizing it from Q-0009's number is sizing the wrong
thing — and anyone sizing it as trivial is forgetting §3.

## 2. The other half, which is the test suite and is not small

`packages/core/src/spike-parity.test.ts` records which `spike/test/` files carry a **binary half**,
and they transfer here rather than at Q-0054. Eight files, measured today:

| file | lines |
| --- | --- |
| `smoke.js` | 773 |
| `q0033-surface.js` | 446 |
| `q0011-run-history.js` | 284 |
| `q0011-runs-cli.js` | 221 |
| `q0036-board-containment.js` | 221 |
| `q0080-allocation.js` | 217 |
| `q0077-base-flag.js` | 195 |
| `q0034-review-fixes.js` | 158 |

**2,515 lines, and 50% of the spike suite by line.** `smoke.js` alone is the mock end-to-end through
the binary that M2's done-when names — 151 assertions — and it is `split` rather than binary-only,
because it also imports from `../src/` fifteen times through `await import()`. Its library half is
already carried; its binary half is this ticket's.

## 3. The cut — six children, agreed 2026-09-01 and created

| child | subject | commands | inherits |
| --- | --- | --- | --- |
| **Q-0090** | package skeleton: `bin`, argv, exit codes, `die`, colour, `npx quorum` from a clean clone | — | — |
| **Q-0091** | read-only commands | `board` 47, `lint` 6, `validate` 36, `adapters` 20 | 698 lines |
| **Q-0092** | `runs` and the run-history presentation layer | `runs` 72 | 505 lines |
| **Q-0093** | writing commands | `init` 23, `ticket` 13 | 217 lines |
| **Q-0094** | `run`, the gate reader and its flags | `run` 35 | 353 lines |
| **Q-0095** | the mock end-to-end against the binary — M2's done-when | all | 781 lines |

Command sizes are the `case` blocks in `spike/bin/harness.js`, measured today: **252 lines of the
569 are the eight commands**, and the rest is helpers and scaffolding — which is the same finding as
§1 from another angle. The inherited figures are `wc -l` over each child's `spike/test/` files.

**Q-0090 is a hard prerequisite for all five others**; Q-0091 to Q-0094 are independent of each
other and can run in any order or in parallel; Q-0095 is last because it exercises every command.
**Q-0039 (one run at a time per ticket) becomes a blocker if they are ever run concurrently** — it
is open, and two runs on one ticket already share a worktree and compute the same run id.

**The seam's weakness, stated rather than hidden:** the eight binary-half test files do **not**
partition cleanly by command. `smoke.js` touches every one, which is why it is its own child instead
of being split five ways, and it is the reason this cut is six rather than eight.

**Each child body repeats Q-0010's ground rules verbatim**, because `input.backlog` resolves against
the running ticket's own folder and nothing injects a parent's body into a child's run. That is the
same constraint that put Q-0009's ground rules in `harness/port-charter.md`; no second charter is
added here, because five rules fit in a child body and a charter would have to be retired later.

**Child c inherits a decision already made.** Q-0037's OQ-2 was ruled on 2026-09-01: an occurrence's
usage is not a roll-up row and is not rendered as one — four measures separately, nulls as `n/a`, no
`unpriced_steps` on a single step, summing left to the roll-up. A `packages/cli` that re-collapses
them reintroduces Q-0011's round-2 nit 5, and `q0034-review-fixes.js` B2 is the guard that catches
it.

## 4. Ground rules, inherited from the port and stated again

1. **The spike stays authoritative and green until cutover.** `spike/` is what develops Quorum
   today; every child of this ticket runs through it. A witness that has been edited is not one.
2. **`spike/src` is frozen for this ticket's children by the same rule Q-0009's children obeyed** —
   but they are *not* in `harness/port-charter.md`'s `children:` list, so the branch-scope job
   reports them out of scope rather than failing them. If a child must change `spike/src`, it takes
   §3's mirror-and-re-record path, in the shape Q-0037's erratum E-1 corrected it to.
3. **Behaviour is preserved.** Where the spike CLI has a defect this backlog already knows about —
   Q-0059's traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash, Q-0068's product
   name — the port preserves and reports it, and the fix is its own ticket in both trees.
4. **`npx quorum` from a clean clone is the acceptance test**, not a unit test. It is also M6's
   cold-clone path, so anything that makes it longer needs a reason.

## 5. What is NOT this ticket

The **cutover** — deleting `spike/`, retiring its CI job, retiring `harness/port-charter.md` — is
§10's follow-up. It runs *after* this ticket and has no folder yet; it should get one at this
ticket's close rather than being remembered. Q-0012's `qa-final.yaml` and `deploy.yaml` are
independent and blocked by Q-0056.

Belongs to M2 in `docs/06-development-plan.md`.
