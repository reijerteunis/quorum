# Q-0040 — errata to `requirements/merged.md` and to the decision entry

Written during the chore run rather than at its exhaustion gate, per *"An erratum is the last
repair, not the first"* (2026-08-30) and *"A refused finding is a gate, not another round"*
(2026-08-31): review round 1's second major was provable the moment it was raised, and a revise
round handed it would spend a budget on work no step on this route can perform.

---

## E-1 — round 1's major 2 is correct, and it is the human's to fix, not the implementer's

**The finding.** `docs/decisions/076-a-run-that-nobody-answered-is-undecided.md:46` says *"`--auto`
cannot produce `undecided`"* and then, **in the same sentence**, explains exactly how it does: *"a
`human-locked` gate it may not answer has no channel, so it reaches the same three sites as any
other unattended run and is undecided for the same reason."* The two halves contradict each other.

**Measured, the second half is right.** `spike/src/engine.js:617` and
`packages/core/src/engine/routing.ts:14` both read
`kind === 'auto' || (auto && kind !== 'human-locked')`, so `--auto` does **not** auto-advance a
`human-locked` gate. An unattended `--auto` run that reaches one therefore has no answer channel and
is `undecided` — which is what the requirement says, what the implementer built, and what its smoke
test asserts. The defect is one clause of the entry, and it is mine: the entry was written by hand
at the requirements gate on 2026-09-01 and this sentence was wrong when it landed.

**Why no implement round may fix it.** `harness/roles/developer-generalist.md:23` forbids every step
on the chore route from adding to `docs/decisions/` or its index, and
`.claude/rules/docs-and-decisions.md` forbids editing a landed entry at all — the repair is a **new
entry naming the old one**, which is doubly the human's. **Eleventh appearance in this backlog of a
loop handed work no agent in it can perform**, and the first where the work is a correction to the
very entry the loop was told to obey.

**The ruling.** Round 2 must **not** attempt major 2, and a round that declines it is declining
correctly. It is discharged by
`docs/decisions/077-erratum-auto-does-reach-an-unanswered-gate.md`, written by hand at this run's
gate. **The shipped behaviour is correct and must not be changed to match the wrong clause** — the
sentence moves, not the code. Any criterion, test or document that says `--auto` cannot produce
`undecided` is wrong for the same reason and moves with it.

**Round 1's major 1 is not covered by this erratum and stands as ordinary work.**
`contracts/Q-0011/run-manifest.schema.json:23` still rejects the `undecided` the engine now
persists, so `harness validate` refuses a manifest that valid new behaviour produced. AC-10 and
AC-11 name the five contract updates and the erratum they need, the occurrence enum at `:68` stays
as it is, and all of it is the implementer's.

---

## E-2 — the five frozen contracts AC-11 names, superseded clause by clause

Written by hand for the same reason as E-1: **`requirements/errata.md` is under `backlog/`, and
`commitAll` (`spike/src/fanout.js:81–94`) runs `git checkout -- backlog` and `git clean -qfd --
backlog` before every agent step commits.** An implementer that writes this file has the write
discarded and never learns why. AC-11 therefore names a surface its own flow cannot write, which is
what *"A requirement may not name a surface its flow cannot write"* (2026-08-25) forbids — review
round 2's first major is correct that the erratum is missing and wrong that the implementer should
add it.

**The distinction that finding exposes is worth keeping.** `contracts/` is **also** absent from
`harness/roles/developer-generalist.md`'s `paths:`, and the implementer wrote all five contract files
anyway — so a role's `paths:` list is *advisory prompt text*, while the `backlog/` revert is an
*enforced gate*. Only one of the two actually stops a write. A requirement that reasons about
writability from `paths:` alone will be wrong in both directions.

**What landed, verified against the diff rather than against AC-11's plan:**

| file | clause superseded | what it now says |
| --- | --- | --- |
| `contracts/Q-0011/run-manifest.schema.json` | the run-level `status` enum | gains `undecided` |
| `contracts/Q-0006/ticket-review-state.schema.json` | the history `status` enum | gains `undecided` **and `interrupted`** (ruling R-B): the engine has written `interrupted` since Q-0004 and this schema never allowed it, so the file was already contradicted before this ticket |
| `contracts/Q-0050/run-flow-api.contract.ts` | `RunStatus` and `NonRegressionRunOutcome['status']`, both closed unions | both gain `undecided`; **`finaliseActiveOccurrences` is deliberately not widened**, because an occurrence is never undecided — a gate allocates none |
| `contracts/Q-0050/lifecycle-routing.contract.md` | the terminal list, and `:24`'s branch-reset rule | the list gains `undecided`, and the reset rule gains an explicit *"`undecided` does not reset"* — the old clause stayed **literally true** and became incomplete as a specification, which is the failure mode worth naming: a reader consulting it to decide whether `undecided` resets would have inferred the answer from a list it is absent from |
| `contracts/Q-0050/run-events.contract.md` | the terminal-event union at `:45` | gains `undecided`; `:80`'s *"on failure, the next pull rejects"* is **not** amended, being already conditioned on failure |

Each file carries the supersession in place, citing this erratum and *"A run nobody answered is
undecided, and keeps the branch it proved"* (2026-09-01) — as corrected by *"Erratum: `--auto` does
reach an unanswered gate, and can end a run undecided"* (2026-09-01), which is E-1's subject and
which no clause of these five depends on.

**AC-11 is discharged by this entry.** A round that reports it still missing is reading a file
written after its prompt was built; a round that tries to write it is doing work the engine will
discard. Neither is a defect in the change under review.
