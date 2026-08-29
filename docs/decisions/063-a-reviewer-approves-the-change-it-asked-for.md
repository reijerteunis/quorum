# A reviewer approves the change it asked for — 2026-08-29

**Decision**

When a review step's finding asks for something a landed decision forbids, the answer is an
**erratum in the ticket's `requirements/errata.md`, written as soon as the contradiction is
provable** — not another revise round, and not a gate answer at the end.

A bounded revise loop cannot enforce a constraint against itself. The reviewer that asked for a
change is the same reviewer that grades the change when it arrives, and it approves it, because it
is exactly what it asked for. Nothing inside the loop is positioned to notice that the round was
correct and the finding was wrong. **The erratum is the only thing that gives the reviewer a subject
it did not author**, and a loop without one converges on the finding rather than on the requirement.

Three clauses follow from that, and each is a rule rather than a preference:

1. **Write it during the loop, not at the exhaustion gate.** An erratum reaches only a step whose
   prompt is built after the file is on disk. Waiting until the gate spends a full implement round
   at the size of whatever the ticket is.
2. **Prove the contradiction against the source *and* against the runtime before writing.** A
   requirement's *Test:* sketch is the half most likely to have been written from intent rather than
   from the code, and it is prose, so it fails silently.
3. **Rule severity, not only substance.** `chore.yaml` cannot approve while a finding is unclassified,
   so an erratum that settles what is true and leaves a real finding unranked leaves the loop open.

An erratum still never widens scope, and charter §2's default is untouched: a defect found while
reading is reported, never fixed in passing.

**Alternatives considered**

*Let the loop exhaust and settle it at the gate.* The standing practice, and what the errata rule of
2026-08-25 describes. It is right when the blocker is a decision **no agent may take** — a missing
`docs/decisions/` entry, an unwritable surface. It is wrong here, because the contradiction was
provable from the tree the moment the first review landed, and every round spent proving it again is
paid at implement prices. Q-0049 round 1 cost $29.58; rounds 2 and 3, after the erratum, cost $5.52
and $5.79.

*Correct the requirement's text instead.* `requirements/merged.md` is the merged artifact of a run
that has completed and been approved at a human gate. Editing it retroactively destroys the record
of what was approved and leaves the implementer's report describing a document that no longer
exists. The errata file exists precisely so the requirement stays as it was written.

*Rely on the implementer to keep refusing.* It did refuse, correctly, in round 1 — the report's
*"Judgement calls a reviewer should weigh"* section named all three findings before the reviewer
raised them. The reviewer graded against the requirement's prose anyway, and round 2's implementer,
handed a review that outranked its predecessor's reasoning, complied. A refusal that a later round
can overturn is not a mechanism.

*Add a standing instruction to `chore.yaml`'s reviewer prompt.* Considered and rejected as too
broad: it would tell every reviewer on every ticket to discount findings that look like behaviour
changes, which is most of the useful ones. The constraint is per-ticket, so the instrument is
per-ticket.

**Why**

Q-0049 is the demonstration, end to end. Round 1's reviewer returned three majors, two of which
demanded behaviour the port must preserve: a named `FlowError` for a `.quorum/runs` that is a file,
and a warning for an `output.txt` that is a directory. Both came from the requirement's own *Test:*
sketches, which had been written from its intent rather than from the code. Neither is reachable —
AC-2's own numbered body binds `could not create` to the **run** directory while step 2 is a bare
`mkdirSync(historyRoot, {recursive: true})` (`spike/src/engine.js:342`), so a file there throws a raw
`EEXIST`; and `engine.js:421` guards the artifact guarantee with `existsSync`, which answers true for
a directory, so that case is silently skipped and no shipped path warns. Both were confirmed by
reading the source **and** by running `mkdirSync` over a file and `existsSync` over a directory.

Round 2 obeyed the review and changed both behaviours. **Round 2's reviewer then blocked its own two
requests, citing E-1 by name**, and round 3 reverted them and shipped. Without the erratum the
likeliest outcome is that round 2's reviewer approved what it had asked for, both suites stayed
green — the spike because it still had the old behaviour, the port because its tests were written
from the new one — and the port carried behaviour the product does not have. That is the exact
failure *"The port preserves behaviour; one exception is authorised and everything else stops the
child"* (2026-08-25) exists to prevent, and the review loop was structurally incapable of catching
it.

This is the review-step instance of a shape this project has now paid for twice elsewhere:
*"the demonstration that a guard has a subject proves the guard fires, not that each of its clauses
does"* (Q-0071), and Q-0072's merged, reviewed, integrate-green change that turned `main` red. In all
three the machinery reported green while being unable to see the thing it existed to see. A green
verdict names what was examined; a reviewer grading its own request examined nothing.

Amends, rather than reverses, *"A requirement may not name a surface its flow cannot write"*
(2026-08-25) and the errata practice it established: that entry asks whether a step **can** satisfy a
criterion, and this one asks whether the criterion is **true of the code** — a requirement can name a
perfectly writable surface and still describe a branch that does not exist.
