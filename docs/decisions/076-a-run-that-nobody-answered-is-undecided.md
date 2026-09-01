# A run nobody answered is undecided, and keeps the branch it proved — 2026-09-01

**Decision:** A run that reaches a gate for which **no answer channel exists** ends with a sixth
terminal status, `undecided`. It advances no stage, returns no worktrees, and — alone among the
non-advancing statuses — **does not restore the ticket branch**. Six points, each ruled rather than
implied:

1. **`undecided` is a run status, not a gate answer.** Gate answers stay exactly
   `advance | retry | abort`. Nothing is added to what a human or a script may say, so no decision is
   invented on anyone's behalf. The word describes what the *run* concluded about itself.
2. **Only "no answer was available" is undecided**, which is three of the ten gate-raising sites:
   `spike/bin/harness.js:96` (scripted answers exhausted, stdin not a TTY), `:110` (stdin closed
   mid-question), and `packages/core/src/engine/routing.ts:25` (no `answerGate` callback). The other
   five — a `--gate-answer` value that is not an allowed word, an empty or unparseable answer on a
   TTY, an invalid answer envelope, a stale `gateId` — are **operator errors**: somebody was there
   and got it wrong. They stay `failed` and keep every consequence a failure has, rollback included.
   The line is *was somebody there?*, not *did the run stop at a gate?*
3. **Classification is by error type, never by message text.** `GateUnansweredError extends
   FlowError` in both trees and the catch tests `instanceof`. `:96` and `:110` share the first eight
   words of their message, so a classifier keyed on prose would be a check that cannot see its own
   subject. **An abort keeps precedence**: `signal.aborted` is tested before the `instanceof`, so an
   abort arriving during an unanswered gate is `interrupted` — the abort is a decision and the
   missing answer is not.
4. **An undecided run completes its event stream rather than throwing.** Both trees currently
   `finish()` and re-throw; under this decision a `GateUnansweredError` finishes the run, emits its
   `terminal` event, and does not propagate, because nothing failed.
5. **`finished()` is replaced by three named predicates** — `advancesStage`, `returnsWorktrees`,
   `restoresBranch` — and the `if`/`else` that made worktree-return and branch-rollback mutually
   exclusive becomes two independent `if`s. `undecided` is the only status that takes neither arm,
   and under the old shape that combination was **unsayable**, which is why this is a structural
   change and not a new enum member.

   | status | advances the stage | returns worktrees | restores the branch |
   | --- | --- | --- | --- |
   | `completed` | yes | yes | no |
   | `regressed` | yes | yes | no |
   | `aborted` | no | no | yes |
   | `failed` | no | no | yes |
   | `interrupted` | no | no | yes |
   | `undecided` | no | no | **no** |

6. **`undecided` is terminal, not suspended, and the CLI exits 3.** The run is over; nothing is held
   open and nothing is resumable by this decision alone. The word is available to Q-0019 if M3's
   resume wants it, and taking it would be that ticket's decision, not this one's. Exit 3 because 0,
   1, 2 and 130 are all taken — 2 is `aborted`, so reusing it would lose exactly the distinction
   this decision exists to draw. `--auto` cannot produce `undecided`: it answers every gate it is
   allowed to, and a `human-locked` gate it may not answer has no channel, so it reaches the same
   three sites as any other unattended run and is undecided for the same reason.

`interrupted` **keeps** restoring the branch. It arrives at an arbitrary point — mid-step, mid-merge
— whereas an unanswered gate is reached at a quiescent point where the preceding step has completed
and persisted everything. Keeping the branch is safe there and is not safe for an interrupt.

**Alternatives considered:** **A third member of `finished()`.** Rejected on measurement: returning
worktrees and restoring the branch are the two arms of one `if`/`else`
(`spike/src/engine.js:748–750`, `packages/core/src/engine/lifecycle.ts:112`), so a status wanting
one arm's answer from each cannot be expressed however the predicate is widened. This is the case
that tests *"A run removes the worktrees it made, and never the refs"* (2026-08-31), whose entry
calls the single predicate a feature; the feature holds for the five statuses that existed and
breaks on the sixth. **Making `undecided` a gate answer** — rejected because it would invent a
decision at the gate, which *"Non-auto exhaustion gates require an explicit human or scripted
answer"* (2026-08-23) forbids; a run status asserts only that nobody spoke. **Classifying by message
text** — rejected as the defect class this repository keeps finding. **Exit code 2** — rejected by
census: it is already `aborted`. **Not restoring the branch for `failed` too** — rejected: an
operator error is an error, and the rollback exists because an exhausted run once left `integrate`'s
merges behind and the next qa-red measured its red phase against a tree already holding the
implementation.

**Why:** *"nobody was there to answer"* and *"the work is bad"* are currently spelled the same way,
and the spelling is destructive. A run that reaches its gate has already merged, tested and proven
whatever `integrate` proved; classifying that as a failure rolls the ticket branch back to where the
run found it. It has cost real merges — Q-0035 and Q-0036 lost theirs on consecutive nights — and
the loss is silent, because the run's own log says only that it failed. The rollback is correct
behaviour being asked the wrong question.

This is compatible with *"Human-gated by default, auto opt-in per gate"* (2026-08-06): a gate that
nobody answered still blocks, the stage still does not move, and no gate becomes automatic. What
changes is only what the run does with work it had already finished. Q-0040.
