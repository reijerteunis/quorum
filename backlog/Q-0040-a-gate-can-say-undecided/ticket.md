---
id: Q-0040
title: A gate can say undecided
stage: draft
owner: ruud
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

---

## Re-measured against the tree on 2026-09-01, before this ticket's requirements run

*The body above was written on 2026-08-31. `spike/src/engine.js` has changed twice since — Q-0037
removed `runGate`'s timer, Q-0089 scoped the verdict path — so every line citation was re-derived.
**Where this section disagrees with the numbered list above, this section is what was measured.**
One of the three corrections changes what the fix has to do.*

**C-1 — the first throw is at `spike/bin/harness.js:96`, not `:95`.** The second, at `:110`, is
right. Both messages are unchanged.

**C-2 — there are two `finish(…, 'failed')` sites, and only one of them is this ticket's.**
`spike/src/engine.js:207` is the step-loop catch and is where a gate throw lands, as the body says.
`spike/src/engine.js:104` is the **setup** catch — it runs before any step, for an
`initialiseRunHistory` failure or the AC-1 collision refusal, and no gate exists yet when it fires.
It is named here so that a fix does not change it by symmetry and a reviewer does not report its
absence as an omission.

**C-3 — `finished()` is read twice, not three times, and the two behaviours this ticket wants to
separate are the two arms of one conditional.** This is the correction that matters. The body's
point 1 calls a third member of `finished()` "the cheapest shape" and point 2 hopes `undecided`
can group "with `failed` for cleanup and with `completed` for the branch". Measured, that
combination **cannot be expressed at all** in the current code:

```js
finish(): if (finished(status)) ticket.meta.stage = stage;          // engine.js:727 — the stage rule
         if (finished(status)) returnObtainedWorktrees(ctx);        // engine.js:748 — arm one
         else if (ctx.branchHeadAtStart) { … resetBranchTo(…) }     //           :750 — arm two
```

Returning the worktrees and rolling the branch back are `if`/`else` — mutually exclusive by
construction. `finished` gives worktrees-returned **and** no rollback; not-`finished` gives rollback
**and** worktrees kept. "Keep the worktrees *and* leave the branch alone" is a third combination the
shape has no way to say, so **the work is splitting that conditional into two independent decisions,
and adding a status is the small part.** `packages/core/src/engine/lifecycle.ts:101` and `:112`
carry the same two reads and the same if/else, so both trees move together.

That also sharpens open question 2 rather than answering it: the question is no longer *"which group
does `undecided` join?"* but *"are these two questions at all?"* — and the evidence says they are,
because a gate nobody answered wants one arm's answer from each. Q-0062's entry calls the single
predicate a feature; this is the case that tests it, and the body was right that it would be.

**Unchanged and re-confirmed:** the `finished` definition is `spike/src/engine.js:665`
(`completed || regressed`), `resetBranchTo` fires at `:753`, `removeWorktree` at `:710`, and the
rollback's own warning still says *"a run that did not complete leaves the ticket branch as it found
it"* — the sentence this ticket makes false for one status.

---

**Explicitly not this ticket:** making a gate answerable from somewhere other than stdin, which is
M3's server and the `answerGate` callback Q-0050 already shipped in `core`.

**Scope.** Both trees together, like [Q-0039] and for the same reason. The decision entry is a gate
obligation no step on the chore route may write — the seventh, eighth and ninth appearances of that
pattern are all recorded in this backlog, so name it at the requirements gate and write it by hand
**before** the implement step runs. Belongs to M2, and its plan entry says it should land before M3.
