---
id: Q-0040
title: A gate can say undecided
stage: draft
owner: ruudvanengelenhoven
repos: []
branch: harness/Q-0040/integration
priority: p2
created: 2026-08-31
iterations: {}
history: []
---
Opened by hand 2026-08-31 at id `Q-0040`, which is where `docs/06-development-plan.md` has cited it
since 2026-08-24. Like [Q-0039] it had a plan entry and no folder; this body re-measures the claim
against the tree rather than transcribing the two lines that stood in for it.

**The defect, traced end to end today.** A gate that cannot be answered throws, and the throw is
processed as a failed *run* rather than as an undecided *gate* — so work the run had already proven
green is rolled back.

1. `spike/bin/harness.js:95` — explicit `--gate-answer`s exhausted and stdin is not a TTY:
   `throw new FlowError("gate (…) needs an answer and stdin closed without one …")`. The same
   throw at `:110` when stdin closes mid-question.
2. That propagates out of `runGate` into `runFlow`'s handler at `spike/src/engine.js:201–207`,
   which calls `finish(ctx, ticket.meta.stage, 'failed', …)`.
3. `finish()` reads one predicate — `finished = (status) => status === 'completed' || status ===
   'regressed'` — and `'failed'` is neither, so control reaches the `else` branch and
   `resetBranchTo(ctx.repoDir, ticket.meta.branch, ctx.branchHeadAtStart)` moves the ticket branch
   back to where the run found it.

**The rollback is correct behaviour being asked the wrong question.** It exists for a good reason,
recorded in its own comment: an exhausted or aborted run used to leave `integrate`'s merges behind,
so the next qa-red measured its red phase against a tree that already held the implementation and
reported 21 green and nothing red (Q-0033). Nothing is lost when the run genuinely failed, because
each task's work stays on its own branch. What is wrong is the classification: *"nobody was there to
answer"* is not *"the work is bad"*, and it is currently spelled the same way.

**It has cost real merges.** The plan records Q-0036 and Q-0035 losing theirs on consecutive nights.

**What "undecided" would mean, which is the actual work.** The name in the plan is a hint, not a
design, and the ticket owes a decision entry before a line of code — this touches the gate model,
which *"Human-gated by default, auto opt-in per gate"* (2026-08-06) and *"Non-auto exhaustion gates
require an explicit human or scripted answer"* (2026-08-23) both govern.

1. **A fourth terminal status, or a third member of `finished()`?** The cheapest shape is a status
   — `undecided` — that keeps the stage where it was, like a failure, but leaves the branch alone,
   like a success. That splits a predicate two other behaviours read, so it must be split
   deliberately: `finished()` currently drives the stage rule, the branch rollback **and**
   Q-0062's worktree cleanup, and those three answers are no longer the same once a fourth status
   exists. Q-0062's entry calls the single predicate a feature; this ticket is what tests that.
2. **Does an undecided run keep its worktrees?** Almost certainly yes — an unanswered gate is
   exactly the state someone is about to open — which means `undecided` groups with `failed` for
   cleanup and with `completed` for the branch. Stating that split is most of the design.
3. **Is it resumable, or only re-runnable?** Resumption is M3's Q-0019. If `undecided` is meant to
   be the state a resume picks up, the two tickets are one question and this one should say so
   rather than let M3 discover it.
4. **What does the CLI exit with?** Not 0, because nothing was decided; not the same code as a
   genuine failure, because a caller scripting the harness needs to tell them apart.
5. **Does it apply to an exhaustion gate?** *"Non-auto exhaustion gates require an explicit human or
   scripted answer"* forbids inventing a decision there. Undecided is the absence of a decision
   rather than an invented one, so it is probably compatible — but that entry is the one this would
   be read against, and it deserves the argument in writing.

**Explicitly not this ticket:** making a gate answerable from somewhere other than stdin, which is
M3's server and the `answerGate` callback Q-0050 already shipped in `core`.

**Scope.** Both trees together, like [Q-0039] and for the same reason. The decision entry is a gate
obligation no step on the chore route may write — the seventh, eighth and ninth appearances of that
pattern are all recorded in this backlog, so name it at the requirements gate and write it by hand
**before** the implement step runs. Belongs to M2, and its plan entry says it should land before M3.
