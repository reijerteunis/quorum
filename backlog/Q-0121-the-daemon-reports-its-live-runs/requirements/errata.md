# Q-0121 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at or after its gate and binding on the implementer
and the reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — AC-6's *Test:* clause names an instrument that cannot hold, and the prose is what moves — 2026-09-12

**Supersedes** AC-6's *"A POST or DELETE to either is not routed"* and its *Test:* clause's
*"`read.test.ts:45`'s existing method loop applied to the two paths"*.

**The amendment.** AC-6's normative half is *both routes are GETs, and reading moves nothing*, and
that half binds and is met. Its two illustrative halves do not bind as written:

- **`POST /runs` is routed, must stay routed, and asserting otherwise would break the product.**
  `read.test.ts:45`'s loop asserts `GET → 200`, `POST → 404`, `DELETE → 404`. Applied to `/runs`
  the POST row is false, because `POST /runs` is the start route Q-0118 shipped — and §4.8 of this
  same document makes changing it a non-goal in as many words: *"Changing `POST /runs`'s refusal
  table, statuses or classifier"*. **There is no implementation that satisfies both sentences**, so
  the criterion contradicts its own document rather than the code contradicting the criterion.
- **What binds instead**: neither new route is reachable by `DELETE` or `PUT`; the **lookup** path
  `/runs/:id` additionally refuses `POST`, which is where the loop's row is true; and `POST /runs`
  is asserted **still to be the start route**, by a refusal carrying a `code` — which an unrouted
  method could not produce. That last clause is *stronger* than the loop it replaces: the loop would
  have proved a method absent, and this proves the right method present and still doing its job, so
  a later change deleting the start route fails here rather than passing.

**Who found it, and how it was handled.** The implement step found it, declared `verdict=proceed`
(Q-0083's channel, correctly — nothing here needs a decision entry or a file outside its paths, and
one of the two readings is flatly impossible), implemented the satisfiable reading, pinned the
divergence in the test's own comment naming both clauses, and wrote in its report that *"a reviewer
should weigh whether an erratum is owed for AC-6's wording"*. The cross-vendor review returned
`approve` with no findings and did not weigh it. **So the erratum is written at the gate, which is
the only window one has** — *"the window for an erratum is a gate"* (Q-0094 E-3), not the gap between
a review returning and the next round beginning.

**Why the prose moves and the code does not.** *"A criterion's *Test:* clause bounds the
instrument — a reviewer may find the instrument fails the job that clause gives it, and may not
raise the job"* (Q-0067 E-1) is the rule for a clause that is merely narrow. This clause is
**impossible**, which is the other case: Q-0052 E-1's shape, where a criterion and the behaviour it
describes disagree and the gate rules which of the two is wrong. Here the criterion is, because the
document it belongs to forbids in §4.8 exactly what AC-6's illustration demands. Sixth instance in
this cut of *a criterion's prose read as a literal contract* (Q-0091 E-3; Q-0094 E-1, E-2, E-3(b);
Q-0067 E-1), and the first where the literal reading would have deleted a shipped route.

**What this does not amend.** AC-6's second test — a run parked at a gate, listed twice, with its
gates and its `watchers` unchanged afterwards — stands unaltered and is met. Its implementation took
the anti-vacuity step the criterion did not ask for: it attaches a real subscriber first so
`watchers` is **non-zero** before the reads, because asserting a count stays at zero is satisfied by
a counter that never moves at all.
