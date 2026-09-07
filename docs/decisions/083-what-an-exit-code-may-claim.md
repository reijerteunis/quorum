# What an exit code may claim, and the three zeros it was asked about — 2026-09-08

**Decision:** an exit code reports **what became of the command**, and `SUCCESS` is reserved for a
command that did what it was asked. Q-0110 inherited three zeros from Q-0090's gate obligation GA-4
and asked which of the five codes each should take. **Two of the three are correct as they stand and
are ratified rather than repaired; one is wrong and changes.** No sixth code is invented — the
`ExitCode` union is closed at 0, 1, 2, 3, 130, and this entry does not widen it.

**(a) An unknown or absent command exits `ERROR`, and `help` goes on exiting `SUCCESS`.** This is
the one that changes. `SUCCESS`'s own definition is *"The command did what it was asked"*: a name
this binary does not dispatch was not done, and a bare invocation asked for nothing. Both print the
help, both then exit 1, and the line between them and `quorum help` is **help on purpose is success;
help by accident is not**. The concrete failure is Q-0090's own, in its words — *"a shell script
cannot tell 'did the thing' from 'did not understand you'"* — and a typo in a pipeline is the case
that costs something, because it passes silently today.

**(b) `regressed` goes on exiting `SUCCESS`, ruled rather than fallen-through.** Q-0090 registered
this as a defect because nobody had decided it: `spike/bin/harness.js:557` named only `aborted` and
`undecided`, so `regressed` reached a fallthrough. It was right that no one had chosen and wrong
that the value was wrong.

**An exit code here reports a run's disposition, not its verdict.** `regressed` is what a cross-flow
backward edge produces (`engine.ts:336`): the flow ran to a terminal state, the ticket's stage moved
to the target flow's `consumes`, and the branch it proved was kept. `core` already sides it with
`completed` in **every** question it asks of a terminal status. `lifecycle.ts` carries three
predicates where one named `finished` used to be — its own comment says so — and `regressed` answers
each of them the way `completed` does: `advancesStage` (`:22`) and `returnsWorktrees` (`:30`) both
read `completed || regressed`, and `restoresBranch` (`:40`) is `aborted || failed || interrupted`,
so a regressed run is not rolled back. `02-sdlc-pipeline-spec.md` says the same from the other side
— *"only `completed` and `regressed` move the stage"*. A CLI that exited non-zero for one of the two stage-moving statuses would put the exit
table out of step with the engine's own model of what a finished run is, in a file whose stated
purpose is that *"the meanings are owned here rather than re-decided by each command"*.

The cost is stated rather than hidden: a caller cannot tell an approved review from a regressed one
by the exit code, and must read the terminal event, which carries the status by name. That is what
the event stream is for, and a review returning `revise` is the flow working rather than failing —
teaching a reader that a normal outcome prints a failure is how an oracle stops being read at all.

**(c) `quorum adapters` goes on exiting `SUCCESS` with nothing installed; `--probe` exits `ERROR`
when a login is not usable.** One command, two contracts, because it answers two questions — the
shape `git diff` and `git diff --exit-code` already have.

The product says which is which, in the command's own output: without `--probe` it prints
*"presence only — logins NOT verified; run `quorum adapters --probe` before a real run"*. A command
that disclaims being the gate is a **report**, and this CLI's reports — `board`, `runs` — exit 0
over an empty backlog and an empty run store alike. `--probe` is the **check**, and this CLI's
checks — `lint`, `validate` — exit 1 when the answer is no. *"check() proves presence; only
`adapters --probe` proves login"* (2026-08-22) drew that line before either command existed; this
entry gives it an exit code.

So the zero Q-0099 preserved at AC-8(c) was the *presence* path and is correct. What was never
decided is the probe's, and a probe that reports an unusable login while exiting 0 is the failure
that decision exists to prevent — two green ticks followed by a vendor stack trace, one command
earlier.

**Alternatives considered.** *`regressed` → `ERROR`* — the reading Q-0110's body assumed, and the
one a pipeline argument supports: `quorum run review X && quorum run qa-final X` would chain past a
regression. Rejected because the second command refuses on its stage precondition anyway, so the
damage is contained, and because `failed` already holds 1 — collapsing the two would tell a caller
that a run which broke and a run which did its job are the same thing. *A sixth code for
"finished, verdict negative"* — rejected: `ExitCode` is closed deliberately so a sixth cannot be
written by accident, and widening it for one status trades a real guarantee for a distinction the
terminal event already carries. *Bare `adapters` → `ERROR` with nothing installed* — rejected on the
command's own disclaimer, and because it would make the only machine-readable inventory of what is
installed unusable from a script that has to tolerate a missing vendor.

**Why.** GA-4 said *"open the successor for the exit table's two zeros"* and no ticket was ever
created; Q-0110 was opened 2026-09-07 when a triage found it, and it is one zero wider than GA-4
named because Q-0099 routed a third to it from a source comment. Deciding the three together is the
point — each was preserved by a different ticket for a different reason, and none of those tickets
was in a position to say what 0 means. This entry says it once so the next command inherits an
answer rather than a fallthrough.
