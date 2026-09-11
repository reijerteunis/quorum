---
id: Q-0117
title: An implement step that finished has no way to report an unmet gate obligation
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0117/integration
priority: p1
created: 2026-09-10
iterations: {}
history: []
---
chore.yaml's implement declares proceed|blocked, and the contract permits only nit findings alongside proceed. A step that has completed its work but must report that a HUMAN gate obligation is unmet has no valid verdict: blocked is false, and proceed forces a real finding to be misclassified as a nit. It cost $49.75 on Q-0115, where the engine refused an output whose seven findings were all correct.

Opened **2026-09-11 at Q-0115's close**, from a failure that cost **$49.75** and produced nothing —
the run died with its work complete on disk and unreported.

## What happened

`chore.yaml`'s `implement` step declares `verdict: proceed|blocked` (Q-0083). The contract layer
additionally requires that **`proceed` carries only nit findings** — the mirror of *"A nit does not
contradict an approval"* (2026-08-28), which ruled the same thing for `review`'s `approve`.

Q-0115's implement step finished all twelve criteria, verified them, and then reported seven
findings. Five were substantive and every one was correct — including one where **it caught a defect
in its own test before a reviewer could**, and one that re-measured a gate obligation and found it
unmet. The engine refused the output:

```
✗ implement: structured output invalid (proceed permits only nit findings, got "GO-5 is NOT
  discharged and must not be read as green: …")
```

## Why neither verdict fits

- **`blocked` is false.** The step was not blocked. It did the work, and the work merged.
- **`proceed` is true and unsayable.** Saying it requires either dropping the observation or
  calling it a nit, and it was neither. GO-5 is a **human's** obligation — verify in both
  environment rows and on CI — which no implement step can discharge and which this one had
  measured to be unmet.

So the honest report has no encoding, and the two ways out are *stay silent* or *misclassify*. That
is the shape **Q-0083** was built to remove for a different case: an implementer that has proved a
criterion wrong had only prose until `blocked` existed. This is the same gap one step over, for an
implementer that has proved a *gate obligation* unmet.

## What has to be decided

1. **Does a third verdict exist, or does the finding vocabulary widen?** A `proceed-with-findings`
   is one shape; a severity that is neither `nit` nor blocking is another; a separate
   `observations` field that is not a finding at all is a third and may be the cheapest, since it
   changes no verdict semantics and no gate routing.
2. **Where does it land** — the flow's `output.verdict`, the step-output schema in
   `packages/shared`, or the contract layer that enforces the nit rule?
3. **Does it reach `review`'s `approve` too?** The two rules are the same rule, so a reviewer with a
   non-blocking observation has the same problem, and answering only one half leaves the other.

## Constraints

**It edits `chore.yaml` and/or the schema the running flow loads**, so a chore run fixing it cannot
benefit from its own fix — Q-0057's position exactly, and Q-0086's and Q-0089's. Expect it to be
implemented by hand for that reason and say so at its gate rather than discovering it mid-run.

**It touches a frozen contract's clause.** The nit rule is stated in `runs-cli.contract.md` and in
the shipped flow files; Q-0073's erratum E-4 is the precedent for superseding one clause of a frozen
contract rather than editing it.

**Not in scope:** whether `proceed` should route anywhere other than `review`, which is Q-0083's and
is settled; and the exhaustion-gate vocabulary, which stays exactly `advance`, `retry`, `abort`.

## Second instance, the same day — raised p2 → p1

**Q-0074's chore run died the same way, hours after this ticket was opened from Q-0115's.** Six
findings, four of them nits, and **two honest reports of unmet HUMAN obligations**:

- the Q-0102 timeout flake, correctly measured and correctly **not** attributed to that change;
- *"GO-4 is not discharged and cannot be from here"* — literally true, since GO-4 requires
  verification on `main` after a merge and CI green on the merged commit, neither of which a
  worktree can do.

**$61.73**, against Q-0115's $49.75: **$111.48 in one day**, for two runs whose work was complete on
disk and correct. Raised to p1 on that, rather than on the argument — the cost is measured and the
recurrence interval is hours.

**The second instance sharpens what the fix must cover.** Q-0115's finding was about a gate
obligation being *unmet*; Q-0074's second one is about an obligation being **structurally
undischargeable from where the step stands**. A step cannot verify `main` after a merge that has not
happened. So the vocabulary needs to distinguish *I found this and it is not mine to fix* from *I
could not do this because nobody at this position can* — and the second is not a finding about the
change at all, which is the argument for `observations` being a separate field rather than a third
verdict or a fourth severity.

**And it is self-reinforcing while Q-0102 is open.** Every run whose implement step is honest about
the intermittent suite hits this refusal, so the two tickets compound: a flake that an honest agent
must report, and a contract that refuses the report.
