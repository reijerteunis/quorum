# Q-0129 — implement, run 3, iteration 5

*A `retry` round. There is no review report on this branch newer than iteration 4's; what changed is
that the gate ruled its two majors as **erratum E-7** and added two obligations of its own. This
round is those four things and nothing else.*

**Verdict: `proceed`.** Five files, 169 insertions, 30 deletions. No criterion moved and no document
changed.

---

## 1. What E-7 asked for, and what each part cost

| | ruling | what shipped |
| --- | --- | --- |
| **(a)** | consume where the engine *emits*, not where a question is built | one line moved in `routing.ts`, two regressions |
| **(b)** | register the parallel-reconciliation defect, do not build around it | one authority line, one register row, one re-derived count |
| **(c)** | the premise that keeps (b) latent must be an assertion, not a comment | three clauses in `flow.test.ts`, demonstrated two ways |
| **(d)** | round 4's in-flight fix is to be verified by mutation, not read | verified; it goes red |

---

## 2. (a) — a decision is spent by the gate that **presents** it

### 2.1 The finding, and why the reviewer's second remedy is the right one

`reachedBy(context.reached)` snapshotted the slot into a question and the composing site then cleared
it. But `askGate` returns **above** its `context.emit(request)` three times — for an `auto` gate, for
a non-locked gate under `--auto`, and for `--dry` — so a decision could be spent on a question nobody
was ever shown, and the next reader would be handed nothing.

Round 4 had put the clearing at both composing sites, having been told about one of them. That is the
shape E-7 names: *every call site remembers to clear at the right moment*, got wrong in three
different ways across three rounds. The remedy it ruled is one line at one site, and it converts the
rule into one no future call site can get wrong — **the engine spends what it presents.**

### 2.2 What shipped

**`packages/core/src/engine/routing.ts` (+27 / −22).** One line in `askGate`, immediately after
`context.emit(request)`:

```ts
if (request.reached !== undefined && context.reached === request.reached) context.reached = undefined;
```

Both clearing sites are gone — `runStep`'s gate branch now reads the slot and does not take it, and
`handleFail`'s clear is removed entirely. **The identity comparison stays and is not belt-and-braces
with the object test**: a `parallel:` sibling may have replaced the slot while an exhaustion gate
awaited its record, and a sibling's decision is not this gate's to spend. Comparing the *object* the
question took, rather than assuming, is what keeps that true.

`handleFail`'s read at its first line is unchanged and still load-bearing for the reason round 3
recorded — it is what refuses a slot naming another step.

**`packages/core/src/engine/types.ts` (+8 / −6).** `RunContext.reached`'s docblock: the rule is now
*carried to the first gate that **presents** it*, with the three auto-advancing shapes named and
`askGate` named as where it holds. Three docblocks in `routing.ts` moved with it, because a comment
that went on saying *each site clears what it was handed* would have been false the moment the line
moved.

### 2.3 The regressions E-7 said were owed (`gate-reached.test.ts`, +57)

Two, one per reachable early return. `--dry` has none to write: `runAgentStep` returns before any
verdict, so the slot is never populated under it, and the docblock says so rather than a test
asserting over nothing.

| | what it pins |
| --- | --- |
| `a gate that auto-advanced spends nothing, so the next reader is still shown the decision` | `review` decides, a `gate: auto` advances past without asking, and the `gate: human` after it carries `review`'s decision. |
| `and neither does one --auto advanced past, the human-locked gate after it still carrying it` | The same at the second early return, on the kind `--auto` may never pass: the `human` gate is advanced past unasked, the `human-locked` one carries the decision whole. |

**The anti-vacuity half is the step ordering, and that is deliberate.** Each asserts *one* question
for *two* gate steps, and that it is the **second** gate's — which a run that never reached the first
gate could not produce, the steps running in order. My first draft proved it by filtering the
engine's `gate: auto-advanced` info line instead, and **the AC-2(b) guard this ticket landed in round
1 refused it** (§5.1). The ordering argument is stronger anyway: it rests on the run's structure
rather than on a sentence.

---

## 3. (b) — registered, with its authority, and the register made me pay for it

`routing.ts`'s declaration-order reconciliation re-applies every member's decision once the group
settles, including one a member's own exhaustion gate has already presented. Registered rather than
closed, on the ruling's own terms: per-member evidence contradicts the slot's landed note, no
criterion asks for one, and a latent defect whose fix is a design question is a ticket rather than a
line smuggled into a revise round.

**The register refused it until it was entered, twice over**, which is the machinery working:

1. `q0050.source.test.ts`'s `classifyAuthority` **threw** on my first wording — *"Why: registered
   latent defect … names no authority this check recognises"*. The recognised spellings are three,
   and the one this is are `preserved <word>, see Q-NNNN`. So the line is
   `Why: preserved defect, see Q-0129 E-7(b)`, which is the idiom `diff.ts`'s Q-0078 registration
   already uses for exactly this — a latent defect routed to a ticket.
2. Then the **identity register** failed, because `routing.ts`'s row named one preserved defect and
   the file now carries two. Added, in order of appearance.

**The cross-file count moved 13 → 14 and is re-derived rather than incremented**, which that clause's
own narration demands: 6 in `composite.ts`, 2 each in `engine.ts`, `routing.ts` and `steps.ts`, 1
each in `diff.ts` and `prompt.ts`. Both the row and the count carry a sentence saying what was added
and why.

---

## 4. (c) — the premise is an assertion now, and its neighbour could not have made it

E-7 is right that the fact lived only as a comment. Round 1's `flow.test.ts` clause counts verdicts
**per flow**, and **a verdict moved from a top-level step into a parallel member of the same flow
leaves that total exactly where it was** — so the registered defect's premise was unchecked and the
day a flow gained such a member nothing would have gone red.

**`packages/shared/src/flow.test.ts` (+62).** Three clauses over one predicate:

- **the corpus has a subject** — every `parallel:` member by flow and name, as an identity:
  `requirements.yaml: [pm-claude, pm-codex]`, `review.yaml: [review-claude, review-codex]`, the other
  four empty. A corpus that lost its panels would satisfy the claim below over nothing; this refuses
  that.
- **the claim** — no member of any of them declares a verdict, failing as `<flow>: <member>`.
- **the rule fires** — the **same predicate**, over a flow `flowSchema` accepts that has one,
  answering `['panel.yaml: review-codex']`. The same predicate deliberately: a fixture checked by a
  second implementation demonstrates that implementation, which is the nit Q-0125's reviewer reported
  three times.

### The two demonstrations, and the second is the one that matters

Against the **live** `harness/flows/review.yaml`, mutated temporarily and byte-restored:

| mutation | what went red |
| --- | --- |
| a verdict **added** to `review-codex` | both clauses — mine naming `review.yaml: review-codex`, and the neighbour because the flow's total went 1 → 2 |
| a verdict **moved** from the `verdict` step into `review-codex` | **only mine.** The per-flow total is 1 either way, so the neighbouring clause stays green |

The second is what makes the new clause something other than a duplicate, and it is why the comment
above it states that in place rather than my asserting it here.

---

## 5. (d) — round 4's in-flight fix, verified rather than read

Mutated `gate-screen.tsx` so the decision region is not drawn while an answer is out
(`subject.kind === 'parked' && !busy`). The clause goes **red**:

> *the summary was cleared while the answer was still on its way: expected 'Gaterun-7 · chore · …' to
> contain 'two majors and a nit'*

So the rewrite genuinely observes the screen whose control it presses, and the defect the run-3 review
described — *deleting the evidence mid-answer would still pass* — is closed. Mutation reverted; the
file is byte-unchanged.

---

## 6. Three things this round measured

### 6.1 My own guard refused my own fixture, one round after I wrote it

The AC-2(b) scan forbids taking a machine value out of an event message and names the two sites that
may. My first anti-vacuity assertion filtered `gate: auto-advanced` out of the engine's info line —
and the guard collected it: *"gate-reached.test.ts: it parses a message for a value and no entry says
why it may"*. Round 1's note that the needle is keyed on **the act** rather than on a receiver's name
is what caught it; a heuristic keyed on a name would have let a test walk through.

I did not register an exception. The fixture was rewritten to rest on step ordering instead, which is
both stronger and leaves the guard's claim — *four refused routes, no exceptions beyond the two
`Error` sites* — exactly as wide as it was.

### 6.2 Nine mutations, each red with a discriminating message

| # | mutation | what went red |
| --- | --- | --- |
| 1 | clear at the composing site, not at the emit (round 4's shape) | **3** — *"a gate nobody was shown spent the decision the next reader needed"*, *"the gate `--auto` cannot pass carried nothing"*, *"the decision answered at the exhaustion gate was presented a second time"* |
| 2 | the registration's `Why:` line removed | the identity register, naming `routing.ts`'s missing row |
| 3 | a verdict added to a shipped flow's parallel member | 2, including *"expected [ 'review.yaml: review-codex' ] to strictly equal []"* |
| 4 | a verdict **moved** into a parallel member | **1 — mine alone**, the neighbour green |
| 5 | the decision hidden while an answer is in flight | AC-11, by name |

Mutation 1 was run twice — before and after the fixtures were rewritten in §6.1 — because changing an
assertion's shape can take away its subject, and this is a ticket that has been finding exactly that
all week. It discriminates in both shapes.

### 6.3 A clause with no test, reported rather than papered over

The identity comparison in the new consumption line (`context.reached === request.reached`) has **no
test**, and I measured that rather than assuming it: mutating it to clear unconditionally leaves the
whole engine suite green.

**It is untestable without touching the defect E-7(b) just registered**, which is why it is reported
and not built. The only way the slot differs from the question's object at the emit is a `parallel:`
sibling landing during an exhaustion gate's record — the registered shape — and in that shape the
declaration-order reconciliation re-applies both members' decisions when the group settles, so a
later gate carries the same value either way. The guard is correct and cheap; what it protects is a
shape whose fix is Q-0129's successor's, and a test for it would be asserting behaviour inside a
defect this round was told not to close.

---

## 7. Considered and not done, with the reason

**A structural clause pinning that one site emits a gate question.** E-7(a)'s argument rests on
`routing.ts` holding a single `context.emit(request)`, and I verified that by measurement — `askGate`
has exactly two callers, both in that file, and no other file in `packages/core/src` or
`packages/server/src` emits a gate question or calls it. I did not turn that into a guard: no
criterion asks for one, `gate-evidence.source.test.ts`'s stated subject is *four refused derivation
routes* and a fifth needle about where a decision is spent would widen what that file claims.

**What I did instead** was stop the JSDoc asserting the invariant. It said *this function holds the
file's only `context.emit(request)`* — a claim about the file that nothing checks. It now says why
**this** site is the right one (emitting is the act that means a reader was shown something, and the
three returns above it are gates nobody was shown), which is true of the ten lines beneath it. If the
gate wants the invariant pinned, it is one clause and this paragraph is where to overrule.

---

## 8. Reported and not fixed

- **§6.3's untested identity comparison**, above.
- **A `parallel:` member's spent decision restored by reconciliation** — E-7(b), now registered in
  the source with its authority and its premise asserted. Unchanged.
- **Fan-out children remain outside AC-3's reconciliation**, which names `parallel` alone. Their
  exhaustion gates are correct for the identity test's reason. `development.yaml` — the one flow with
  a fan-out — declares zero verdicts anywhere, which round 1's neighbouring clause pins, so the new
  clause is not widened to cover a case that clause already closes.
- **Two steps sharing one id** would let the identity test attribute one's decision to the other's
  failure. Pathological and unchanged from round 3: such a flow already collides on its `on_fail`
  counter, its worktree branch name and its occurrence directory.
- **`packages/core/src/backlog/backlog.ts:448`** — the unused `eslint-disable-next-line
  no-control-regex` rounds 1, 3 and 4 reported. Pre-existing, outside this change.

---

## 9. Verification

- `pnpm install --frozen-lockfile` → already up to date.
- `pnpm turbo run test lint typecheck --force --continue` → **21 successful, 21 total, 0 cached**.
- `pnpm exec quorum lint` → **6/6**.
- `pnpm sweep:git-identity` → **6 green in 7 runs**. See below.
- Nine mutations, each red with a discriminating message, each reverted and re-verified.

**The counts reconcile, which is the check that this round touched only what it claims.** Per
package: `@quorum/core` **1,575** (+2 skipped), `@quorum/cli` 692, `@quorum/web` 425,
`@quorum/shared` **265**, `@quorum/server` 215, `@quorum/compiler` 1, `@quorum/templates` 1 —
**3,174 passed, 2 skipped**. Round 4 measured 3,169 with core at 1,573 and shared at 262: core moves
by my two regressions, shared by my three clauses, and **every other package is unchanged** —
`@quorum/web` included, which is what says (d) was verified by mutation and reverted rather than
edited.

**The sweep, stated as a rate with its gap admitted.** One failure in seven runs, in phase
*workspace suite*. **I did not capture which test failed**: each invocation is a fresh two-minute run,
the failing one was read with `tail` alone, and six subsequent runs — including two with a grep that
would have named a failure — were green. So I am recording the rate and not attributing it. Round 1
measured the same shape at 1 in 3 and identified `packages/core/src/adapters/exec.test.ts`'s EPIPE
write/exit race, in a file and a subsystem this change does not touch; rounds 3 and 4 each recorded
two green runs. It is **Q-0102's** subject, and characterising it from an uncaptured failure would be
the thing that ticket's own reopening discipline forbids.

---

## 10. Not done, and whose it is

**GO-5** — verification forced in *both* environment rows — is the operator's at the close; this run
was performed in one worktree and I am not reporting the second row. **GO-6** — the product run by
hand, with the step id, the verdict and at least one finding the gate screen rendered transcribed
into `runs.log` — cannot be performed from here. Both are named in review iteration 4's own second
observation, and E-5 records why the distinction matters: Q-0016's equivalent obligation was reported
discharged when its by-hand half had not been performed, and Q-0015's gate is what found that.
