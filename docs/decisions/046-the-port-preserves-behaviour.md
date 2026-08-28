# The port preserves behaviour; one exception is authorised and everything else stops the child — 2026-08-25

**Decision:** Q-0009's fourteen children port `spike/` into `packages/core` and `packages/shared`
**preserving externally observable behaviour**, and the ported tests are the proof. Externally
observable means what a command prints and its exit code; what is written to `backlog/`,
`.quorum/` and `runs.log`, and in what format; which branches and worktrees exist and where; what
an adapter is invoked with; and when a run stops. Internal file layout, function names and module
boundaries are explicitly **not** preserved — the port is required to move several of them, because
`spike/bin/harness.js` holds domain logic that `docs/04-architecture.md` places in `core`.

**Exactly one behaviour change is authorised: `runFlow` becoming `AsyncIterable<Event>`, owned by
Q-0050.** Nothing else. A child that finds a defect, an inconsistency or an obvious improvement
while reading the spike **stops and reports it in its implementation summary**; it does not fix it
in passing. The route for a deliberate behaviour change is its own entry in this file, or a dated
erratum in the child's ticket folder naming the clause it supersedes — written and accepted
**before** it is implemented, never a silent improvement discovered in review. A child's reviewer
may treat an unregistered behaviour change as a blocker by citing this entry, without needing to
argue the merits of the change.

**The invariant register is the operative half of this policy.** Twenty-two behaviours are listed
in `harness/port-charter.md` §2 with the child that inherits each and the dated decision that
bought it. Each child names its rows among its own invariants. The register exists because "preserve
the behaviour the tests cover" is exactly wrong for the behaviours that matter here: the expensive
ones are the ones the tests under-specify. Register row 1 is the case in point — `check()` must
refuse on `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` **before** it probes the CLI, and
a rewrite that probes first and refuses second passes every test that checks only the refusal.
Row 20 is the other shape: `finish()` does not roll back task branches, that is a known gap carried
into M2, and the port carries it forward **unfixed**.

**Alternatives considered:**

**(a) "Preserve whatever the ported tests cover", with no register.** The cheapest policy to state
and the one a reviewer cannot use. It defines the specification as its own proof, so any behaviour
the suite under-tests is unprotected precisely where protection is worth paying for — and the
register lists twenty-two of those, several found only after a run had already been paid for.
Rejected on row 1: a suite that asserts the refusal happens says nothing about whether it happens
before the probe.

**(b) Let a child fix a defect it finds, and record it in the implementation report.** Tempting,
because a port is when someone finally reads every line and the defects are real. Rejected because
it breaks the port's only proof, and breaks it invisibly: the spike's suite stays green because the
spike still has the old behaviour, and the workspace suite stays green because it was ported from a
tree that had the new one. Both green, the product wrong, and nothing in CI can see the difference.
An implementation report is not a durable record and is not read again after the gate.

**(c) Allow behaviour changes wherever `docs/04-architecture.md` and the spike already disagree.**
Rejected as an unbounded licence — the documents disagree in more places than anyone has
enumerated, and each child would decide for itself which disagreement is a mandate. Where such a
gap is real, it is a stop-and-report, and the decision is taken once rather than fourteen times.

**Why:** the port is judged by tests ported by the same process that ports the code, and Q-0054 —
the only ticket that can prove any of the others — lands last. A subtle mis-port and a
correspondingly mis-ported test agree with each other. The independent witness is the untouched
spike suite, which is why the freeze (`harness/port-charter.md` §3, enforced by CI) and this policy
are the same mechanism seen from two sides: the freeze keeps the witness from being edited, and this
keeps the port from quietly disagreeing with it. A witness that has been edited is not one, and a
proof that was rewritten to match the thing it proves is not one either.

The cost accepted is that the port lands with known defects intact, and that a child which spots a
real bug must leave it and say so. That is the right trade at fourteen tickets across several
evenings: a fix costs one ticket later, and a silent divergence costs the confidence that `core`
does what the spike did — which is the entire claim M2 is making.

**Found by:** Q-0009's merged requirement, AC-2, which specifies this policy and the register behind
it. Written as an entry rather than only as charter prose because it outlives the ticket: every
child's reviewer needs to cite it, and `harness/port-charter.md` is retired at the cutover while
this is not.
