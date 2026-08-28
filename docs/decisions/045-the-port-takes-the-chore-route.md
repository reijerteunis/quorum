# The port takes the chore route, except the one child that has new behaviour — 2026-08-25

**Decision:** Q-0009's fourteen children split on one question — *can a red phase exist?* — and the
answer differs for exactly one of them.

**Thirteen take the chore flow** (`requirements → chore → human gate`): Q-0041, Q-0042, Q-0043,
Q-0044, Q-0045, Q-0046, Q-0047, Q-0048, Q-0049, Q-0051, Q-0052, Q-0053 and Q-0054. **Q-0050 alone
takes the full SDLC** (`requirements → solutioning → qa-red → development → review`), because the
event stream is the port's one authorised behaviour change and five later tickets code against its
shape. Q-0009 itself — the charter, whose criteria are all documents and configuration — takes
chore.

Three consequences are part of this decision rather than left to the children to discover:

1. **Q-0050's solutioning runs early, in parallel with Q-0041–Q-0048** — not when Q-0050's turn in
   the landing order arrives. Run order and landing order are different things, and OQ-2 requires
   the answer channel settled *while* the independent children run, since Q-0049 and Q-0051–Q-0053
   serialise behind it.
2. **Every child ports its module's unit-level tests with the module.** Q-0054 keeps the end-to-end
   regression suite — `smoke.js` and the CLI-driven files whose translation cannot be split per
   module — and no more.
3. **Q-0050 is the only child that may be routed differently, and the only one that needs a role
   table.** The chore flow runs `developer-generalist`, which already carries `packages` in its
   `paths`; `development.yaml` fans out to `developer-{role}`, and `harness/architecture.md`'s role
   table grants no role `packages/core` or `packages/shared`. AC-4 is a coherence fix for thirteen
   children and a blocker for one.

**Alternatives considered:**

**(a) All fourteen on the full SDLC.** Solutioning would emit contracts restating `spike`'s existing
behaviour plus `04-architecture.md`'s public API — a contract nothing can violate, which the
2026-08-22 executable-contracts entry exists to refuse — and `qa-red` would write a suite that
already exists in `spike/test/`, transcribed to Vitest. Q-0054 owns that transcription, so the route
would manufacture a second owner for one file set and a second answer for every frozen fixture. The
measured cost of guessing wrong here is on the record: Q-0033 spent roughly $41 across six qa-red
attempts without ever producing a usable red, on subject matter thinner than this.

**(b) All fourteen on chore, Q-0050 included.** Cheapest, tidiest, and rejected. `runFlow` becoming
`AsyncIterable<Event>` is the single behaviour change the port authorises; OQ-2's answer channel —
bidirectional generator, callback in `opts`, or out-of-band `answerGate(runId, answer)` — changes
what M3's WebSocket can do, how a run resumes after a daemon restart, and where Q-0040's "undecided"
gate lives. Handing that to one implementer in a worktree and reviewing it afterwards is how a
design nobody agreed to becomes five tickets' foundation.

**(c) A third flow — `port.yaml`.** Rejected: nothing has been learned that the two shipped routes
cannot express, and the chore entry it would amend is one day old. A flow file is cheap to write and
expensive to have been wrong about.

**(d) Q-0050's design as an out-of-band architect document rather than a solutioning run.**
Considered seriously, since OQ-2 asks only that it be *written* and settled early, and (1) above
already removes the scheduling objection to solutioning. Rejected because the flow buys three things
a document in `docs/` does not: a gate, a cross-vendor review, and contracts the five dependent
tickets can be checked against by `harness validate` rather than by reading.

**Why: the shape stops being third as soon as the question is asked per child.** Q-0009's
requirement is right that neither shipped route fits *the port* — the chore flow's rationale is
false here, and `qa-red` has nothing to write. But the chore decision's actual criterion was never
ticket size or how much configuration is involved. It is whether a red phase can exist, and that is
a property of each child, not of the set.

For thirteen the answer is no — though not for the chore entry's original reason. Its words were
*"a scaffold has no behaviour a test could fail on before it exists"*, and that is plainly false for
a ported module, which has behaviour and 3,142 lines describing it. What is true instead is the
mirror image: **the failing test already exists.** `spike/test/` is the red phase, written and paid
for months ago. Asking `automation-qa` to write it again in Vitest is transcription wearing a red
phase's clothes, and it would collide head-on with the 2026-08-23 ownership rule — two tickets
owning one file set, discovered in a development loop that cannot close.

For Q-0050 the answer is yes, and it is the only child where it is. The event stream does not exist
in `spike` — `runFlow` takes a `ui` object and prints — so there is no test to port, a test can be
written that fails now and passes later, and contracts have something to constrain that is not a
restatement of code already written. That is the mechanism working as designed, on the one input in
this ticket set that suits it.

**What makes the chore route honest here: `integrate` must examine what the child wrote.** The
configured test command is `npm test --prefix spike && pnpm turbo run test`. If a child ported a
module and left every test to Q-0054, chore's `integrate` would run both suites, pass, and report
green having examined nothing the run produced — precisely the failure recorded the same day as
*"skipped is not passed"*, arriving through a route that looks like proof. Hence consequence (2)
above. The spike half of that command is doing separate work and is worth naming: it is the freeze,
executed. A port that reaches into `spike/src/**` to make itself easier fails the step that is
supposed to bless it.

**Cost accepted.**

- **Fourteen first runs need `harness/<id>/integration` created by hand first.** The chore flow
  cannot run on a ticket's first pass — `review` diffs against a branch only `integrate` creates.
  At one ticket that is a footnote; at fourteen it is an operator procedure, and it is one forgotten
  branch away from a run that fails *after* paying its implementer, which is exactly how Q-0035 lost
  $13.86.
- **Thirteen runs produce no contracts,** so nothing downstream validates their output. The chore
  entry accepted this once for a scaffold whose shape the build asserts; here it is accepted thirteen
  times, and what asserts a port's shape instead is the tests each child brings plus Q-0054 at the
  end. If Q-0054 finds the thirteen disagree with each other, this entry is where to come back.
- **Roughly $350–550** across the children, from measured chore tickets at $26.81 and $36.66. The
  checkpoint after the first three reach `reviewed` (AC-11) is where that estimate becomes a number,
  and it is also where this routing gets its first real test.

**Found by:** Q-0009's requirements flow — run 1, `head-of-product` verdict `ready`, $8.32 — which
raised it as OQ-1, recommended this split, and correctly refused to treat it as a precondition for
its own charter. Decided at that flow's gate. Satisfies AC-1; the fourteen child bodies cite this
entry by title and date as part of the charter.
