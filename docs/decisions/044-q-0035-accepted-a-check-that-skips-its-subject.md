# Q-0035 accepted: a check that skips its subject must not report success — 2026-08-25

**Decision:** Q-0035 is accepted at `reviewed`. The reviewed change is on
`harness/Q-0035/integration` (`cf12197`), both suites verified green after the merge was
re-performed by hand, and the one finding that survived the cross-vendor review is carried to
**Q-0038** rather than spent on another loop. Two rules come out of the night and are general
enough to record here rather than inside Q-0038:

1. **Skipped is not passed.** A preflight, a `--dry` run or a lint that declines to examine something
   reports that it skipped it. `harness run chore Q-0035 --dry` printed a clean four-step preview
   for a range it had deliberately not looked at, and the real run then billed **$13.86** before
   discovering the range's left endpoint did not exist. Silence must never render as a green tick.
2. **A non-interactive run authorises the first N gates it meets, not the N gates you had in
   mind.** `--gate-answer` values are consumed in order by whichever gate arrives first, and an
   engine-presented exhaustion gate is a gate. Passing one answer intended for a flow's final gate
   is therefore also an offer to accept an exhausted loop. Pass exactly as many as you would
   authorise blind, and prefer too few: the run fails, which is recoverable, instead of advancing.

**Alternatives considered:** Spending another $8–16 on a fourth `implement` + `review` pass to
close the surviving major — rejected on Q-0034 AC-2's reasoning and on the evidence of the rounds
themselves, which went three majors, three majors, one major with no blocker in any of them; the
loop was already exhausted at `chore.review = 3` against a limit of 2, and a `retry` authorises
exactly one more traversal for a message-shape change. Fixing the implementer's two red scenarios
by hand between runs — cheapest route to a completed run, rejected because it puts the
orchestrator's hand inside the artifact under review and makes authorship unreadable. Advancing
the stage without re-performing the discarded merge — rejected outright: a ticket reading
`reviewed` over a branch holding nothing is the precise failure Q-0036 shipped its containment
column to expose.

**Why: a ticket about honest diagnostics was stopped twice by dishonest ones.** Q-0035 exists
because `materialiseDiff` reported a historical event it had not verified. Its own two runs failed
because a `--dry` run reported a check it had not performed, and then because a gate could not say
what it meant. The subject matter kept reappearing in the instrument.

The expensive half. `chore.yaml` reviews `harness/{id}/integration...harness/{id}/implement`, and
the run-level preflight defers a range whole when *either* endpoint is created by an earlier step
of the same flow — one `.some()` over both endpoints at `spike/src/engine.js:108`. The right endpoint
is step-created, so nothing checked the left one, which was a pre-existing-ref-class branch that
simply did not exist. `--dry` reported the range valid. The `implement` step ran for 23 minutes and
$13.86, and `review` then failed on the missing ref. Q-0035's own AC-8 promises zero adapter
invocations for pre-existing-ref ranges and AC-9 accepts earliest-possible for deferred ones; a
range holding one of each is covered by neither. A requirement that had thought harder about this
subject than any other in the repository still had a hole in exactly this shape.

The cheap half, found independently. Round 3's reviewer, reading the diff on the other vendor,
returned one major: a deferred range names its producing step only when the *deferred* endpoint is
the unresolved one, so when the other endpoint is missing the message omits who owed what. That is
the same asymmetry from the opposite side. Worth keeping: the $13.86 route found the **timing**
half and the free route found the **diagnosis** half, and neither found both. Q-0038 owns closing
them together.

**Three things found around the flow rather than in it.** The chore flow itself performed well —
three implement passes converging to one major, an `integrate` that synced base, merged, installed
and ran the real suite green.

- **The chore flow cannot run on a ticket's first pass.** `review` diffs against the integration
  branch; `integrate`, the only step that creates it, runs after. `backlog.js:64` writes the branch
  *name* into frontmatter and nothing ever creates the ref — `spike/src/engine.js:200` says as much
  in a comment written for a different flow's ordering. Q-0008 and Q-0036 passed only because the
  branch was made by hand first: the reflog has `harness/Q-0036/integration` "Created from main" at
  23:28:46 against a run starting 23:30:38. An undocumented manual prerequisite that reads as an
  operator error, and a statically checkable flow property `harness lint` could refuse.
- **`budget.per_run_usd` does not stop anything.** It is `10`; one step spent $13.86 and one run
  spent $22.27, neither interrupted. A cap that only describes is not a cap.
- **An unanswerable gate destroyed proven-green work for the second night running.** Run 3 reached
  `integrate: tests exit 0, expected pass`, then failed at the final gate for want of an answer,
  and `finish()` rolled `harness/Q-0035/integration` back from the merge it had just made
  (`d77b632`) to `a916d07` — forty seconds after the suite went green. The rollback is right in every other case and is what
  Q-0033 added it for. What is wrong is upstream: the engine cannot express *the human has not
  decided yet* as distinct from *the run failed*, so an absent decision is indistinguishable from a
  failure and is punished like one. M1's closing entry named this as something M3's daemon must not
  inherit; it has now cost two tickets their merge on two consecutive nights, in two different
  flows. It should be fixed before M3 rather than listed again.

**Cost.** $36.66 in billed Claude cost — $13.86 for the run that found the preflight hole, $22.27
for the run that did the work, $0.53 for the probe — plus roughly 44 million Codex tokens no
roll-up can price. The ticket's own roll-up reads $39.95 because it includes the requirements run.
