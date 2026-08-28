# A nit does not contradict an approval — 2026-08-28

**Decision:** The approving verdict — the first value of a step's `verdict` vocabulary — may carry
findings, and may carry **only** findings prefixed `nit: `. A `blocker:`, a `major:` or a finding
with no severity at all is still refused against it, by name and quoting the offender; every other
verdict still requires at least one finding. Both shipped review flows, both shipped templates and
`docs/02-sdlc-pipeline-spec.md` now say so in one sentence instead of two contradictory ones, and
the rule lands in `spike/src/adapters/index.js` and `packages/core/src/adapters/adapters.ts`
together, with `backlog/Q-0006-…/solution/errata.md` E-4 naming the two frozen clauses it
supersedes.

**Amends:** *"Step-output validation is Quorum's contract with its own agents"* (2026-08-22), whose
reasoning is unchanged and whose example was doing more work than it looked. That entry argues that
*"accepting `verdict: "approve"` alongside a list of blockers is not tolerance, it is a routing bug:
the engine advances a ticket on a verdict its own findings contradict."* Every word of that is still
true. What was implemented was `findings.length` — any finding at all — and the gap between "a list
of blockers" and "any finding" is exactly one severity wide.

**Alternatives considered:** (a) **Delete "nits alone approve" and keep the empty-findings rule**,
so reviewers put nits in the summary. Free, touches no frozen artifact, and rejected: it resolves
the contradiction by making a nit unstructured, which on a review surface is where a nit goes to be
forgotten — and the two nits this incident produced were both worth keeping. (b) **Leave the engine
and fix only the instructions** — the same thing with extra steps. (c) **Widen `schemaFor`'s
severity pattern to every verdict step**, so `chore.yaml`'s findings are validated the way
`review.yaml`'s are. Refused deliberately: tightening validation is what just cost a run, and it
would break `requirements.yaml` and `qa-red.yaml`, whose findings are plain prose. E-4 records the
residual gap rather than closing it.

**Why: two sentences in the same paragraph told the reviewer to do opposite things, and the engine
enforced one of them.** `harness/flows/review.yaml:36–38` and `harness/flows/chore.yaml:43–44` each
said *"Approve only when no blocker or major survives; nits alone approve"* and, beside it,
*"Findings must be empty on approve."* A reviewer holding two nits is instructed to approve, and
instructed that approving means reporting nothing. There is no output satisfying both.

Q-0073's chore run settled which half was real. The codex reviewer returned `approve` with two nits,
obeying the first sentence exactly. `checkAgainstSchema` refused it, the run **failed**, and the
$18.57 implement step it had just approved was left with no `integrate` and no gate. The two nits
survived only as raw text in `.harness/`, and both were correct: one named a sentence in durable
guard prose asserting CI had reported green when the ticket's own requirement had established CI
never ran; the other, that an AC-5 no-contraction assertion used a `toBeGreaterThanOrEqual` floor
where the criterion asked for identity, so removing a collected literal passes if an unrelated one
is added.

**The generalisation, which is why this is an entry and not a patch.** *A verdict must not
contradict its own findings* is the right rule and was implemented as *a pass must have no
findings*, which is a different and stricter rule. The severities exist precisely to say which
findings contradict a verdict — `FINDING_SEVERITIES` has said `blocker | major | nit` since
Q-0041 — and the coupling never consulted them. **A vocabulary the enforcement does not read is
decoration**, and the failure mode is the one this repository keeps recording: not a wrong answer,
but a check whose subject is narrower than the sentence describing it.

**The cost of the old rule was invisible on the other flow, which is the part worth remembering.**
`review.yaml` carries the identical contradiction and has never failed on it, because its reviewers
resolved it the other way and dropped their nits. So the same defect showed up as a dead run on one
flow and as silently discarded findings on the other, and only the loud one was ever going to be
found. Nobody can say how many nits `review.yaml` has swallowed; the number is not recoverable.

**Cost accepted:** the approving verdict is now a weaker signal — `approve` no longer implies an
empty findings list, so anything reading a verdict alone must also read the findings to know whether
anything was said. That is the honest shape: the reviewer did have something to say. And a chore
reviewer may still write a `nit:` with no `file:line` and be accepted, because the item pattern is
applied only where `changes-requested` is in the vocabulary — recorded in E-4 rather than fixed
here.

**Found by:** Q-0073's chore run 2, 2026-08-28, which died on it three minutes after the review
returned. The diagnosis was wrong twice before it was right: first that `chore.yaml` was missing a
sentence `review.yaml` had — both carry both — and then that the rule lived only in the engine,
when it is written into two frozen Q-0006 contracts and pinned by landed acceptance tests in both
trees. Reading the files rather than the greps corrected both.
