# A requirement may not name a surface its flow cannot write — 2026-08-25

**Decision:** Routing a ticket to a flow is also a statement about which surfaces its acceptance
criteria may name, and that has to be checked when the routing is decided rather than discovered by
a loop. Three rules come out of Q-0009's chore run:

1. **`backlog/` is not a writable surface for any agent step, in any flow.** `commitAll`
   (`spike/src/fanout.js:80–93`) runs `git checkout -- backlog` and `git clean -qfd -- backlog`
   before every agent step commits, reverting tracked edits and deleting additions, and reports
   what it dropped. This is deliberate and stays: an agent that can edit `ticket.md` can advance
   its own stage, mark its own run complete and refund its own counters. A criterion whose surface
   is `backlog/` is therefore work for a human commit or for the engine, never for a step.
2. **A criterion naming an unwritable surface is settled by erratum or by hand, not by iteration.**
   The revise loop cannot close it, and every round is correct to refuse.
3. **Q-0009's own routing is amended.** *"The port takes the chore route, except the one child that
   has new behaviour"* (2026-08-25, earlier the same day) routed the charter itself to chore. That
   is wrong and this entry supersedes it for Q-0009 alone: the charter's three backlog-surface
   criteria were performed by human commit, and the charter now lives at `harness/port-charter.md`
   per `backlog/Q-0009-…/requirements/errata.md` E-1. **The fourteen children are unaffected** —
   their surface is `packages/`, which `developer-generalist` may write.

**Alternatives considered:** (a) Widen `developer-generalist`'s paths to include `backlog/` —
rejected outright, and it would not have worked anyway, since the revert is in `commitAll` rather
than in any path list; the role file is advice and this is enforcement. Making the enforcement
optional hands an agent the ticket state that decides whether its own work is finished. (b) Add a
step kind authorised to write ticket bodies from a schema — plausible eventually and rejected now:
a new step kind decided under time pressure to rescue one ticket is how flow semantics get worse.
(c) Raise `max_iterations` — the loop was not failing, it was reporting; more rounds buy more
correct refusals at $8–10 each.

**Why: the fifth appearance of one pattern, in a variant the existing rules do not cover.** M1's
closing entry named *"a loop spending its budget on work no agent in it can perform"* and listed
four instances — a hung test command, a base conflict at integrate, a base conflict before fan-out,
and tests whose only fix lay in a file no task owned. Two decisions of 2026-08-23 close it from
both sides: every file a red test requires must be owned by exactly one task (*can anyone fix
this?*), and a red test must still be green once the feature exists (*will the fix still hold?*).
Both are questions about files a task owns. This one is prior to ownership: **may anyone write
here at all?** No task can own `backlog/`, so the ownership rule has nothing to catch.

Q-0009's run 2 spent **$23.25** and 27.2M Codex tokens across three implement passes and three
`revise` verdicts establishing it. Every round was right. The implementer wrote the charter to
`harness/port-charter.md`, said in its report that `backlog/` was not writable for the step and
that three criteria named it anyway, and by round 3 had stopped restating its case and instead
transcribed into the charter the exact block each of the fourteen bodies needed — so that the
authorised commit would be transcription rather than authoring. The reviewer refused the
relocation three times as unauthorised, which is also right: an implementer that may relocate a
required artifact by explaining why can relocate anything. Two correct agents, no possible move.
The cheapest detection was free and an hour earlier: reading the criteria's surfaces against the
flow's writable set when the routing was decided.

**A note on how the blind spot propagated.** The requirement's own correction section says *"on the
recommended chore route, no **child** implementer is handed a contract forbidding its target
directory"* — true of the thirteen and silent about the parent. The routing entry written hours
later repeated the check in the same shape, verifying `developer-generalist` could write `packages`
and never asking about `backlog`. A correction inherited without re-deriving what it did **not**
say is the "review the fix round, not only the feature round" lesson from Q-0034, arriving through
a document rather than through code.

**What the hand-performed `integrate` found, and why it matters.** The run died before `integrate`,
so the work looked finished and was not. Performing that step by hand turned up two real defects in
the implement branch: `harness/architecture.md`'s frontend and data rows carried their caveats
*inside* the third column (*"`packages/database` — does not exist yet"*), which `spike/test/smoke.js`
parses as a comma-separated path list and compares to the role's `paths` frontmatter — two
assertions red; and `port-freeze-guard.sh` printed two spellings of its skip phrase while its own
test asserted one. Both are exactly what `integrate` is for. The generalisation is that **a run
that fails before `integrate` leaves work in the shape of finished work**, and the branch cannot be
trusted until that step is performed by something. It is the third night running that a chore
ticket's final proof had to be re-performed by hand, which is Q-0040's argument, not a new one.

**Cost.** $23.25 for run 2, on top of $8.32 for the requirements run — $31.58 on the ticket's
roll-up — plus 27.2M Codex tokens no roll-up can price. The $23.25 bought one erratum's worth of
knowledge and two defects the integrate step would have caught for nothing.
