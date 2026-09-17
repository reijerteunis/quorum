# Q-0129 — implement, run 3, iteration 4

*A revision round. `review/chore/run-3/chore-iter-3.md` returned `revise` with two majors. Both are
real, both are fixed, and each fix was shown red before it was trusted green. Four files, 186
insertions, 14 deletions. No criterion moved and no document changed.*

**Verdict: `proceed`.**

---

## 1. Major 1 — an author-declared gate never spent what it carried

**The finding.** `reachedBy(context.reached)` at `routing.ts` snapshotted the slot into the question
and left it in place, so a second author-declared gate reached with nothing decided since would
re-present the decision the reader had already answered at the first — AC-6's *neither layer
substitutes a previous gate's value*.

**The reviewer offered two remedies and asked that the selected rule be pinned.** One — a
requirements correction — is `backlog/`, which this role may not write. The other is one line here,
so this is not a `blocked`: I took it, and the whole of this section is the "selected rule" half of
what was asked for.

### 1.1 The rule, stated once

> **A decision is carried to the first gate that takes it and no further.**

Taking is what ends it. A **traversal** takes nothing and spends nothing, so a revise loop is
untouched. An **author-declared** gate takes the last decision the run recorded and spends it. An
**exhaustion** gate takes the decision of the step it names — the identity test — and spends that,
which is *only what it took*: a sibling's decision the identity test refused is not that gate's to
spend, so the slot is compared with what was carried rather than cleared blind.

### 1.2 Why both sites, when the review named one

The review named the author-declared gate. I applied it at both, and the reason is a reachable
shape rather than symmetry: `chore.yaml`'s review loop exhausts, the reader answers `advance` on the
reviewer's findings, `integrate` runs, and the run stops at the flow's own `gate: human`. Spending
only at the author-declared gate leaves that reader shown the same findings twice, the second time
under a heading naming them *what the step before this gate decided* — where the step before it is
`integrate`, which decided nothing. That is the finding I was asked to fix, still live in the one
shape a shipped flow actually reaches, so fixing the instance and not the class would have been this
repository's most-recorded failure committed inside the round that was told about it.

### 1.3 What it narrows, said out loud rather than left for a fourth round

AC-5's normative sentence is *"an author-declared gate carries the last one the run recorded"*. Under
this rule a **second** author-declared gate with nothing decided since carries nothing, which is that
sentence read as *the last one the run recorded and has not yet presented*.

- Both of AC-5's *Test:* fixtures are **single-gate** and both still pass, so the criterion's own
  instrument is satisfied unchanged (Q-0067 E-1: a *Test:* clause bounds the instrument).
- **No shipped flow discriminates the two readings.** Measured: `chore`, `development`, `qa-red`,
  `requirements`, `review` and `solutioning` declare **one `gate:` each**. So this is
  future-proofing, chosen deliberately, and it changes no run this repository will make today.
- **Decision 097 is untouched.** It requires the slot be *"read at both sites that build a gate
  question"*; both still read it. Clearing after reading is neither a second path to the value nor
  the removal of a read site — which is the clause that ruled out the review's *pass it through the
  failure path* alternative in round 3, and does not reach this one.
- The field's own name and the screen's own heading are the argument for it rather than against:
  `reached` is *the decision that reached this gate*, and a decision answered at the previous gate
  reached that one.

If the gate prefers evidence reusable across gates, it is an erratum and two lines — the two new
author-declared clauses in `gate-reached.test.ts` are exactly the pair that would move, which is what
makes the choice cheap to reverse rather than baked in.

### 1.4 What shipped

**`packages/core/src/engine/routing.ts` (+24 / −3).** The `step.gate` branch takes the slot and
clears it before composing the question; nothing awaits between the two and the `parallel:` branch
returns above, so the value cleared is the value carried. `handleFail` clears **after** the
`count <= limit` early return — past that point a question is certain — and only where the slot still
holds what this gate took. `reachedBy`'s docblock and `handleFail`'s gain the rule, in one paragraph
each, where a maintainer meets the code rather than in a test.

**`packages/core/src/engine/types.ts` (+7).** `RunContext.reached`'s docblock gains the clause and
the distinction it turns on: this is a slot a question **spends**, not a register of the run's last
verdict, and the two read identically for every flow this repository ships.

### 1.5 The regressions (`gate-reached.test.ts`, +123)

Three, and the second is why it is a set rather than one assertion.

| | what it pins |
| --- | --- |
| `a second author-declared gate reached with nothing decided since carries nothing` | The rule. Two author-declared gates with a verdict-less step between; the first carries `review`, the second carries none. `handleFail`'s identity test cannot reach this — that function never runs — so what empties the second question is the first having spent it. |
| `a second author-declared gate reached AFTER a further decision carries that one` | **The anti-vacuity half.** A mechanism that simply never carried anything to a second gate passes the clause above and fails this. What a question spends is the decision, never the next gate's ability to carry one. |
| `a decision answered at an exhaustion gate is not presented again at the gate after it` | The `chore`-reachable shape of §1.2, end to end: exhaustion gate carries the reviewer's findings, `advance`, then the flow's own gate carries none. |

Each names its own precondition before asserting anything — both questions were reached, in the
expected order — so none can pass over a run that never got there.

---

## 2. Major 2 — the in-flight clause inspected a screen that never had a decision

**The finding is exactly right and the test was wrong in two ways, not one.** The evidence was
rendered into `parked.container` by a second `screen()` call while the control was clicked in
`container`, whose only read answered the plain fixture — so every post-click assertion inspected a
screen that had never had a decision on it. And `controls(container).every(…)` was true of **zero
controls**: `afterAnswering`'s POST resolves `204` and its follow-up read never arrives, so the run
was no longer loaded and the screen drew no controls at all.

**A third thing, which is why the rewrite is not just a re-aim: the fixture was not staging the
moment the criterion is about.** AC-11's clause is *"Submitting an answer does not clear the evidence
**while that answer is in flight**"*. A POST that resolves immediately is asking what the screen says
once the daemon has replied — a different claim, and one two neighbouring clauses already make
(`:442` and `:470`).

**What shipped (`apps/web/src/gate-screen.test.ts`, +46 / −11).** One fetcher, one mount: the read
answers a run parked on a question carrying `reached`, and the POST **never settles**. After the
click it asserts, against that same container, that the summary and the reported entry are still
rendered; that an answer really did go out (so the clause has a subject); that there is at least one
control (so `every` is not true of nothing) and that all of them are disabled; and that the screen
claims neither that the ticket advanced nor that the daemon took the answer — neither is established
while the request is on its way.

**Nothing was lost by moving it.** `ANSWERED_PREFIX` at the accepted moment is asserted at `:447` and
`:470`, and *claims nothing beyond what it sent* has its own test at `:442`. `afterAnswering` keeps
its two other call sites and its shape is unchanged.

---

## 3. What mutating the fix found, and did not paper over

**`handleFail`'s identity test lost its subject.** Reverting it left all 18 tests green, because the
one test that had exercised it — `a step that declares no verdict is not handed the decision an
answered gate carried` — now passes for the other reason too: the gate in that fixture spends the
decision before the script ever fails.

That is a guard this ticket landed two rounds ago going quiet, which is the class the panel has been
finding here all week, so it is closed rather than reported. Consumption does **not** cover the shape
where a verdict step is followed *directly* by a failing non-verdict step with no gate between — the
slot still holds a decision naming somebody else, and only the identity test empties it. **No test
covered that shape**, so I added it: `a step that declares no verdict is not handed the decision of
the step before it`. Reverting the identity test now turns exactly that one red, with a
discriminating message, while the fixture with a gate in between stays green — which is the
demonstration that the two guards are not belt-and-braces over one hazard.

---

## 4. Mutations — five, each red with a discriminating message

Every one reverted and the suite re-run green.

| # | mutation | what went red |
| --- | --- | --- |
| 1 | the author-declared gate reads the slot again instead of taking it | 1: *"the second gate re-presented the decision answered at the first: expected true to be false"* — **the review's Major 1, reproduced literally** |
| 2 | the exhaustion gate's clear removed | 1: *"the decision answered at the exhaustion gate was presented a second time"* |
| 3 | `handleFail`'s identity test removed | 1: *"a script step's failure was presented as the decision the step before it made"* — the subject restored in §3 |
| 4 | the screen drops `ReachedRegion` while an answer is out | 1: *"the summary was cleared while the answer was still on its way"* — **the mutation the review said would have passed** |
| 5 | the controls drawn live while busy | 4, the rewritten clause among them: *"the controls stayed live while an answer was out"* — where before it was true of nothing |

---

## 5. What I deliberately left alone

- **The documents.** Nothing in them is false. `docs/04-architecture.md`'s status line says the slot
  is *"assigned where a verdict is validated and read at both sites that build a question"*, and both
  halves hold exactly. The rule this round selected lives where a maintainer meets it — the slot's
  own docblock and both gate sites — and is pinned by four tests. A status line rewritten at each
  review round stops being a record of what changed.
- **`contracts/Q-0050/run-events.contract.md`.** Still outside this role's paths, and the note the
  gate wrote by hand at E-6 is untouched, including its wording.
- **The `**220**` / `**148**` figures** in the design-brief test. §5.10 makes refreshing them a
  non-goal: they are dated to Q-0016's gate, and a dated measurement is not drift.
- **Rounds 1 to 3's twelve criteria.** Re-run, not re-litigated.
- **`afterAnswering`'s shape**, and the two clauses that use it.

---

## 6. Reported and not fixed

- **A `parallel:` member that presents its own exhaustion gate has its decision re-applied** by the
  group's declaration-order reconciliation once `allSettled` returns, so a later gate could carry a
  decision already spent. Three unreachable conditions stacked — **no `parallel:` member in any
  shipped flow declares a verdict at all**, which is why AC-3(c)'s fixture is synthetic by the
  requirement's own admission — and closing it means widening `AgentStepExtra` with a second callback
  for a sub-case of that fixture, which AC-2's *one slot* and this role's no-speculative-abstraction
  rule both argue against. Stated rather than left to be found.
- **Two steps sharing one id** would let the identity test attribute one's decision to the other's
  failure. Unchanged from round 3, and pathological: such a flow already collides on its `on_fail`
  counter, its worktree branch name and its occurrence directory.
- **Fan-out children remain outside AC-3's reconciliation**, which names `parallel` alone. Their
  exhaustion gates are correct for the identity test's reason; `development.yaml` declares zero
  verdicts, which is the clause round 1 pinned in `flow.test.ts`.
- **`packages/core/src/backlog/backlog.ts:448`** — the unused `eslint-disable-next-line
  no-control-regex` rounds 1 and 3 reported. Pre-existing, outside this change.

---

## 7. Verification

- `pnpm install --frozen-lockfile` → already up to date.
- `pnpm turbo run test lint typecheck --force --continue` → **21 successful, 21 total, 0 cached**.
- `pnpm exec quorum lint` → **6/6**.
- `pnpm sweep:git-identity` → **green twice in two runs**.
- Five mutations, each red with a discriminating message, each reverted and re-verified.

**The counts reconcile, which is the check that this round touched only what it claims.** Per
package: `@quorum/core` **1,573** (+2 skipped), `@quorum/cli` 692, `@quorum/web` 425,
`@quorum/shared` 262, `@quorum/server` 215, `@quorum/compiler` 1, `@quorum/templates` 1 —
**3,169 passed, 2 skipped**. Round 3 measured 3,165 with core at 1,569; core moves by my **four** new
tests and **every other package is unchanged** — `@quorum/web` included, because the in-flight clause
was rewritten rather than joined. So a change to how a gate spends one slot reached no surface and
added no web behaviour.

---

## 8. Not done, and whose it is

**GO-5** — verification forced in *both* environment rows — is the operator's at the close; this run
was performed in one worktree and I am not reporting the second row. **GO-6** — the product run by
hand, with the step id, verdict and at least one finding the gate screen rendered transcribed into
`runs.log` — cannot be performed from here. Both are named in the review's own second observation,
and E-5 records why the distinction matters: Q-0016's equivalent obligation was reported discharged
when its by-hand half had not been performed, and Q-0015's gate is what found that.
