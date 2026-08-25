---
id: Q-0051
title: core/engine — diff preflight and materialisation
stage: draft
owner: ruud
repos: []
branch: harness/Q-0051/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
---
Ports the diff subsystem: the run-level preflight in `runFlow` (`spike/src/engine.js:95–130`),
`diffSitesOf`, `materialiseDiff` and `emptyRangeFailure` (785–894). About 120 lines, and the most
decision-dense of the four engine tickets — it is the whole subject of Q-0035, which cost $36.66 to
land. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**What it is for.** M1's deepest finding: Q-0006's review spent $5.02 of Claude cost plus an unpriced
Codex reviewer on a diff that did not exist. `materialiseDiff` embedded the emptiness without
noticing, and the flow would have advanced on the verdict. The panel produced eleven substantive
findings anyway by reading the working tree instead of the evidence handed to it, and three were
real — *"the reviewers were right; the mechanism that was supposed to make them right was broken"*,
and it stayed invisible precisely because the agents compensated. Any step whose input is technically
optional because the agent has repo access carries this hazard.

**The diagnostic reports evidence, not a story.** Q-0035's rule: name both endpoints and the short SHA
each resolved to, the containment check verbatim, and that check's outcome as one of `contained`,
`not contained` or `indeterminate` — through the single `ancestry()` primitive in Q-0042, never a
private `try { … } catch { return false }`. The old message asserted a historical event (*"is already
merged into"*) from a relation between two commits; a merge, a cherry-pick, a hand-applied patch and a
rebase all produce the same exit code. It happened to be right, which is why the entry closing it is
titled around the distinction. Each failure carries **at most one** remedy, and every remedy is one
the range guard would accept — the previous message ended by advising something the guard forty lines
above it refuses.

**The guard is not relaxed.** Both endpoints must be the configured base or a branch under
`harness/<ticket-id>/`. Settled by Q-0034; it is what stops a flow aiming a review at an unrelated
ref. Its static twin lives in `lintFlow` (Q-0044).

**The limit is stated rather than implied.** *"No adapter is billed before bad evidence is found"*
holds for ranges over refs that exist when the run starts, and cannot hold for a range whose endpoint
the run itself creates — `chore.yaml` reviews `integration...implement`, and the implement branch has
no emptiness to discover until its adapter has run and been paid for. That class gets
earliest-possible instead: the producing adapter may run, the consuming one may not.

**Sequencing against Q-0038, which owns the known hole.** The preflight defers a range whole when
*either* endpoint is step-created — one `.find()` over both endpoints at `engine.js:118`. On the night
Q-0035 was implemented the left endpoint was a pre-existing-ref-class branch that simply did not
exist, nothing checked it, `--dry` reported the range valid, and the run billed $13.86 before failing.
Q-0038 closes both halves — validate each endpoint on its own class, and name the producing step
whichever endpoint turns out bad. Land it on the spike first or port the fixed version; doing both
means porting a file while it is being changed underneath.

**And the rule the whole thing generalises to:** *skipped is not passed*. A preflight, a `--dry` run
or a lint that declines to examine something says so. Silence must never render as a green tick.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` diff preflight and materialisation
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0050 · **Depended on by:** Q-0052
- **Invariants inherited:** register rows 10, 11, 12 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
