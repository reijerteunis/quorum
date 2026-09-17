# Q-0129 — implement, run 3, iteration 3

*A revision round. `review/chore/run-3/chore-iter-2.md` returned `revise` with two majors; both are
real, both are fixed by one mechanism, and each fix was shown red before it was trusted green.*

**Verdict: `proceed`.** Four files, 130 insertions, 10 deletions. No criterion moved and no
document changed: what changed is where the exhaustion gate's evidence is read and what it is
allowed to be.

---

## 1. The two findings, and why they are one defect

Both majors are the same sentence from two sides: **a single mutable slot cannot say which step a
value belongs to**, so a gate that must describe *one step's refusal* reads a value that may belong
to another.

**Major 1** — `reachedBy(context)` at the author-declared gate takes a snapshot and nothing clears
the slot, so a later script, integrate or other non-verdict failure presents the earlier decision as
its own. Confirmed against the criteria rather than accepted on the report: **AC-5** says *"an
exhaustion gate carries the verdict of the step whose refusal reached it"* and **AC-6** says neither
layer substitutes *"a previous gate's"* value, with a *Test:* clause requiring a script failure and
an integrate failure each to present a question whose field is `undefined`. Three call sites reach
`handleFail` and only the agent step's carries a verdict, which AC-6 states in as many words.

**Major 2** — members of a `parallel:` group share one `RunContext`, and `handleFail` awaits
`recordOccurrenceEvent` before building its question, so a sibling finishing in that window decides
what the failing member's gate shows. Round 1 reported this as a residual and was right to; the
review is right that it is a defect against AC-5 rather than a note.

**Neither is reachable in a shipped flow today** — each of the six flows has exactly one `gate:`,
`chore.yaml`'s `integrate` declares no `on_fail`, and no `parallel:` member declares a verdict — and
that is not a reason to leave either. The criteria are about what an engine-presented gate may say,
and an author's flow is what makes them reachable.

## 2. What shipped

### `packages/core/src/engine/routing.ts` (+30 / −8)

`handleFail` now reads the slot **at its first line, before any await, and takes what it finds only
where that value names the step that is failing**:

```ts
const reached = context.reached?.stepId === String(step.id) ? context.reached : undefined;
```

Two properties, each closing one major, and **each covering the other's failure mode**:

- **The identity test** closes Major 1. A script or an integrate step declares no verdict, so the
  slot can never name it, and its question carries nothing — which is AC-6's *Test:* clause holding
  for a run that has already decided something, where before it held only for a run that never had.
- **The position — before the first await** closes Major 2. Nothing between `steps.ts`'s assignment
  and this line awaits, so the value read is this step's own.

The pairing is what makes the ordering safe rather than merely true today: if an `await` is ever
introduced in that stretch, the identity test fails and **the question carries nothing rather than a
sibling's decision**. That is the direction containment, push lag and verified version all answer
in — an unanswerable question is never rendered as an answer.

`reachedBy` now takes the value rather than the context, so the two sites hand their own reading to
one builder. Both still read `RoutingContext.reached`; what differs is which reading each is
entitled to, and `handleFail`'s new docblock says which.

### `packages/core/src/engine/types.ts` (+5) and `steps.ts` (+4)

Two docblocks that described the slot and would otherwise now promise more than the code does.
`RunContext.reached` gains the clause that **the two gate kinds are entitled to different readings
of it** — an author-declared gate takes the last decision the run recorded, an exhaustion gate takes
it only where it names the step that failed. `steps.ts` gains the constraint at the assignment:
nothing between it and the `handleFail` call below may await, and why the identity test is what
makes that safe.

### `packages/core/src/engine/gate-reached.test.ts` (+93)

Two tests, one per finding, both over real runs.

**AC-6 — `a step that declares no verdict is not handed the decision an answered gate carried`.**
The review's first major as a run: `review` decides, the author-declared gate carries that decision
and is answered `advance`, then a script step that decides nothing fails. It asserts the first
question carries `review` **and** that `'reached' in` the second is `false` — absent, not empty,
which is the distinction AC-6 is about.

**AC-5 — `a member that exhausts carries its own decision, not the sibling that landed in its
window`.** The interleaving is **staged, not described**, on Q-0127 round 4's precedent: the
sibling is held on a deferred that a spy on `recordEvent` releases when the exhaustion record is
written — inside the window — and then awaits a macrotask so the sibling's continuation runs to its
own assignment before `handleFail` resumes. The fixture then proves the window was staged before
asserting anything about it: `steps.ts` assigns the slot **before** it emits `done`, so a `done` for
the sibling ahead of the question *is* that assignment, observed. **It cannot pass vacuously** — the
sibling is held until the hook fires, so a hook that never fired leaves the group waiting rather
than reporting green with no window staged.

## 3. Shown red, three ways

| mutation | what went red |
| --- | --- |
| the shape the review found — read the slot where the question is built, no identity test | **both** new tests. The parallel one reproduces the finding literally: *"the question carried the sibling that landed in its window: expected `{ stepId: 'beta', …(3) }` to strictly equal `{ stepId: 'alpha', …(3) }`"* |
| identity test dropped, early read kept | **one**: *"a script step's failure was presented as the decision the reader had already answered"* |
| identity test kept, read moved after the await | **one**: *"the question carried the sibling that landed in its window: expected `undefined` to strictly equal `{ stepId: 'alpha', …}"* |

The third is the one worth reading twice. It shows the two halves are not belt-and-braces over one
hazard: **without the early read the member's own decision is lost, without the identity test a
sibling's is misattributed.** Each mutation was reverted and the suite re-run green.

## 4. Two remedies the review offered, and why neither was taken

Both findings are fixed; the mechanism is a third shape, and the reasons are measurements rather
than preference.

**"Consume/reset the pending evidence when a question is composed."** Clearing at the
author-declared gate contradicts **AC-5's own first clause** — *"an author-declared gate carries the
last one the run recorded"* — for a flow with a second author-declared gate after one verdict step.
The identity test gets the required behaviour at the site where AC-5's two clauses actually differ,
and leaves the clause that is not in dispute alone.

**"Pass the current step's evidence directly through its failure path."** This is the more robust
shape in isolation and I did not take it, because it stops `handleFail` reading the slot — and
**three landed statements say it reads it**: the decision entry *"A gate question carries the
decision that reached it"* (2026-09-17), whose Decision paragraph reads *"one run-scoped slot,
assigned at the single site where a verdict is validated and read at both sites that build a gate
question"*; `docs/04-architecture.md`'s status line, which repeats it; and AC-2. Contradicting a
landed entry silently is what `.claude/rules/docs-and-decisions.md` forbids, and a design exists
that satisfies the findings **and** the entry, so it is the one to take. The entry's *"Populate at
the `handleFail` site"* refusal is also honoured exactly: nothing is derived there, the value is
still produced at the one site where a verdict is validated, and the common gate — 154 of this
repository's 157 author-declared answers — still reads it from the slot.

So AC-2 is met literally as well as in purpose: one slot, one assignment site, read at both
question-composing sites, and **no second path to the value** — `gate-evidence.source.test.ts`'s
four needles are untouched and still green.

## 5. Reported and not fixed

- **Two steps sharing one id** would let the identity test attribute one's decision to the other's
  failure. Pathological — such a flow already collides on its `on_fail` counter, its worktree branch
  name and its occurrence directory — and keying on the id is what the flow uses to name a step.
  Stated rather than guarded.
- **Fan-out children are still outside AC-3's reconciliation**, which names `parallel` alone; round
  1 reported this and it is unchanged. Their *exhaustion* gates are now correct for the same reason
  a parallel member's is — each child reaches `handleFail` with the slot naming itself — while a
  later author-declared gate still carries whichever child finished last. `development.yaml`
  declares zero verdicts, which is the clause round 1 added to `flow.test.ts`.
- **A second author-declared gate after one verdict step** carries that verdict, per AC-5's first
  clause. AC-6's *"a previous gate's"* wording can be read as forbidding it; the two clauses cannot
  both hold, no shipped flow has two author-declared gates, and I implemented the one that is
  unambiguous rather than choosing silently. If the gate rules the other way it is one line at
  `runStep`'s gate branch.
- **`packages/core/src/backlog/backlog.ts:448`** — the unused `eslint-disable-next-line
  no-control-regex` round 1 reported. Pre-existing, outside this change.

## 6. Verification

- `pnpm install --frozen-lockfile` → already up to date.
- `pnpm turbo run test lint typecheck --force --continue` → **21 successful, 21 total, 0 cached**.
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → **green twice in two runs**.
- Three mutations, each red with a discriminating message, each reverted and re-verified.

**The counts reconcile, which is the check that this round touched only what it claims.** Per
package: `@quorum/core` **1,569** (+2 skipped), `@quorum/cli` 692, `@quorum/web` 425,
`@quorum/shared` 262, `@quorum/server` 215, `@quorum/compiler` 1, `@quorum/templates` 1 —
**3,165 passed, 2 skipped**. Round 2 measured 3,163 with core at 1,567; core moves by my two tests
and **every other package is unchanged**, including `@quorum/web` and `@quorum/server`, which is
what says a change to how an exhaustion gate reads one slot reached no surface.

## 7. Not done, and whose it is

**GO-5** — verification forced in *both* environment rows — is the operator's at the close; this run
was performed in one worktree and I am not reporting the second row. **GO-6** — the product run by
hand, with the step id, verdict and at least one finding the gate screen rendered transcribed into
`runs.log` — cannot be performed from here, and E-5 records why the distinction matters: Q-0016's
equivalent obligation was reported discharged when its by-hand half had not been performed.
