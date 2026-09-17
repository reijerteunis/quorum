# Q-0130 — implement, run 2, iteration 6

Revision round. **The single review finding was real**, was reproduced before it was fixed, and
erratum **E-7** — written at this gate — ruled how it must close: not another predicate patched in
place, but the premise's inputs **kept as independent last reports** with a **tri-state composition**
in which one conclusive lapse withdraws the offer whatever else is unknown. Both halves are built.
Six mutations hold them, each reverted after.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21
successful, 0 cached**. `pnpm exec quorum lint` 6/6. `@quorum/web` alone: 20 files, **414 tests**,
against round 5's 411.

---

## 1. The finding, and what it actually was

> The `holds` predicate treats either missing refresh result as sufficient to preserve the
> confirmation. … if the refreshed flow listing reports that the selected flow was removed or refused
> while the ticket read fails, `stage === null` keeps the stale confirmation actionable; likewise, a
> reported stage change is ignored when the flow read fails.

**Confirmed, both ways round.** The premise was two request states with `null` for *not loaded*, so
an unavailable read did not merely fail to report its own input — it **erased** it, and the
predicate then read that erasure as *cannot tell* and let it answer for the input that had just
reported:

| what the daemon said | what the screen concluded |
| --- | --- |
| the listing no longer holds `chore`; the ticket read did not answer | the offer still stands |
| the ticket is at a stage `chore` does not consume; the listing read was refused | the offer still stands |

Round 4's rule — *an unavailable read is not a premise that stopped holding* — is true and is not
the whole of it. E-7 completes it: it is *could not tell* **for its own input**, and may not stand in
for the other's answer.

**It is round 1's defect on a fourth surface and, measured, its cause is one layer up from where the
finding points.** §3 below is that measurement, and it is the part of this round worth reading
before the diff.

---

## 2. What changed

### `apps/web/src/ticket-page.tsx` — the premise, kept

Two states beside the two request states:

```ts
const [reportedStage, setReportedStage] = useState<StageReport | null>(null);
const [reportedFlows, setReportedFlows] = useState<readonly WireFlow[] | null>(null);
```

Each is written in `load`'s own continuation and **only where the answer carried the thing** —
`if (listed.kind === 'loaded')`, and after the ticket read's `if (answered.kind !== 'loaded') return`.
A refusal is the daemon answering the *request*: a `no-such-ticket` reports no stage, and nothing
answering at all reports nothing. That is `mission-control-screen.tsx`'s `readMetadata` one screen
over, and the same sentence it already carries.

`StageReport` carries the ticket its stage is about. `reportedFlows` carries no stamp, the flow
directory being the harness's rather than any ticket's — stated in place rather than left as an
asymmetry a reader has to account for.

Neither is cleared by `load`. **That is the whole of the repair for the second mixed case**: with the
listing preserved, a stage that has moved has the flow's own `consumes` to be judged against, and
without it there is nothing for the new report to be compared with.

The start **region** is untouched and still reads the two request states. AC-6 requires three
distinct unavailable sentences drawn from the listing's request, and AC-8 requires the stop control
drawn from the last report; the two criteria differ and so do the two screens, which round 5 §5(b)
already recorded. What is now one rule across both is the **confirmation**.

### `apps/web/src/ticket-page.tsx` — the rule, written down

```ts
export function offerStanding(flow: string, { stage, flows }: StartPremise): OfferStanding {
  if (flows === null) return 'unknown';
  const entry = flows.find((each) => each.name === flow);
  if (entry === undefined || !entry.runnable) return 'lapsed';
  if (stage === null) return 'unknown';
  return offerable(entry, stage) ? 'holds' : 'lapsed';
}
```

Three answers because the two that are not *holds* are not the same thing — containment's, push
lag's and a verified version's discipline a layer inside a browser. **The asymmetry is the rule
rather than an ordering**: a flow the listing no longer holds and one it reports refused are
offerable at **no** stage, so both are decided before the stage is consulted and an unreported stage
cannot mask either; `unknown` alone ends nothing. `offerable` stays the one predicate the control is
drawn from, and `!entry.runnable` is the half of it that needs no stage rather than a second
predicate beside it.

`holds` is now `offerStanding(flow.name, premise) !== 'lapsed'`. The hook's contract is unchanged —
E-7 says the mechanism is right and not to be rebuilt, and `RunAct.holds` still takes the premise and
answers a boolean.

### `apps/web/src/run-lifecycle.ts` — the docblock that produced the half-rule

`RunAct.holds` said *"Each screen says so in its own premise by answering `true` where it has no new
report"*. That sentence invites exactly what shipped: `true` because **something** is unreported. It
now says the rule for its own input alone, and states what that does not license.

### `docs/04-architecture.md` — one clause

**Quoted here in both forms, because the cut will not carry it** (§5(c)). §`apps/web` said:

> A read still out and a read that failed are not premises that stopped holding, which is
> *"connection state … is not run state"* one layer over.

It now reads:

> A read still out and a read that failed are not premises that stopped holding, which is
> *"connection state … is not run state"* one layer over — **and they are that for their own input
> alone**. Each input a premise is built from is kept as the daemon's last ANSWER about it rather
> than re-derived from the last request for it, so a listing reporting the chosen flow gone still
> ends the offer while the ticket read is failing, and a stage that has moved still does while the
> listing read is; and the predicate over them is asymmetric, one conclusive lapse ending an offer
> whatever the other input is while *could not tell* alone never does. **Never allowed to stand in
> for the other's answer**, which is containment's discipline — a state meaning *could not tell* that
> is never reported as either of the other two — at a site inside a browser.

**No pinned clause moves.** `packages/shared/src/docs.test.ts`'s two Q-0130 blocks assert the status
line, four superseded negatives and six positives; this is none of them, and the suite is green. It
is amended under the standing docs rule, as one clause in the paragraph AC-14 already requires.

### `apps/web/src/ticket-page.test.ts` — three clauses, at two levels

Two DOM tests, one per mixed sequence, **separate tests rather than halves of one** so that under the
defect neither is red only because its neighbour stopped the run (Q-0107's distinction). One clause
over `offerStanding` directly, which is where its two `unknown` answers have a subject.

`flowRow` is now derived from a typed `flowValue`, so the body a daemon answers and the value a
premise is built from cannot describe two shapes.

---

## 3. The measurement this round produced, which is not what the finding says

**Mutation A — the flagged line restored verbatim, on top of the new premise — is GREEN.** All 414
tests pass.

```ts
holds: ({ stage, flows: listed }) => stage === null || listed === null
  || listed.some((each) => each.name === flow.name && offerable(each, stage)),
```

The masking clause only misfires while those nulls are **reachable**, and keeping each input as a
last report removes them: with a pending offer on the screen, both have been reported by
construction. So **the defect was in the premise and not in the predicate**, and the predicate
rewrite is not what makes the two mixed cases pass.

That is worth the gate's attention rather than being buried, for two reasons.

**It changes what each half is evidence for.** The two protect against **opposite errors**, and the
mutations separate them cleanly: dropping retention (B) turns the *under*-withdrawing case red while
the asymmetric predicate keeps round 5's counter-clause green; making the composition symmetric (C)
or dropping the listing's own half (D) turns the *rule* red while the DOM stays green, because
retention keeps the nulls away from it.

**And it is why the predicate was still rewritten.** Left as it was, the line the review flagged
would sit unchanged in the file, correct only because of a property of another part of the component
— which is the shape the defect was written in. The rewrite is what stops the rule resting on that.
It is held by the clause over `offerStanding` rather than by the DOM, and I am reporting that rather
than presenting six red DOM tests.

---

## 4. The mutations, each reverted after

| # | Mutation | Result |
|---|---|---|
| A | the flagged predicate restored, premise kept | **green — §3** |
| B | retention dropped, premise back to the two request states | **1 red** — *a ticket that reported a stage the flow does not consume left its confirmation standing because the listing read failed* |
| A+B | both together — **exactly the code round 5 shipped** | **2 red**, one per test — *…because the ticket read failed* / *…because the listing read failed* |
| C | the composition made symmetric (`flows === null \|\| stage === null` first) | **1 red** — *an unreported stage masked a listing that no longer holds the flow: expected 'unknown' to be 'lapsed'* |
| D | the listing's `runnable` half dropped from its own decision | **1 red** — *an unreported stage masked a listing that reports the flow refused* |
| E | an unreported stage read as a lapse — round 3's mistake, one screen over | **1 red** — *an unreported stage was read as a stage the flow does not consume* |
| F | a refresh clears both reports — retention weakened rather than dropped | **1 red** — the under-withdrawing case only; round 5's counter-clause **stays green**, the asymmetric predicate catching what retention no longer does |

**A+B is the reviewer's finding reproduced**, and it is the one that says the two new tests have a
subject: both are red, each with its own message, against the tree as it stood.

**C and D are why the asymmetry is two clauses rather than one.** Under C the test stops at its first
failing assertion, so the refused-flow case would have been *shown red by its neighbour*; D fires on
it alone.

**F is the check on the fix rather than on the defect.** It shows the two halves are not one measure
written twice: with retention weakened, the predicate still refuses to read an unavailable read as an
answer, and only the case that genuinely needs a retained listing fails.

---

## 5. Findings in my own work, and cases I did not close

**(a) My first plan was the predicate alone, and it could not have worked.** Reading E-7's *"what
changes is the predicate inside it"* literally gives a composition that closes the first mixed case
and cannot close the second: with the listing unreported there is no `consumes` for a new stage to be
judged against, so the honest answer is *could not tell* and the offer stands. It is the review's
other named remedy — *preserve the last reported stage and flow listing independently* — that makes
that case decidable, and mutation B is the measurement. Recorded because the literal reading of the
erratum is the one a next reader will reach first.

**(b) The `StartPremise` docblock was already claiming what this round makes true.** It said *"the
stage and the flows, as last REPORTED"* above a component that derived both from the request states.
A JSDoc promising what the code beneath it does not do is the fourth thing this repository's
architecture context tells a reviewer to be suspicious of, and it was mine, written in round 5.

**(c) The stage report's stamp is held red by nothing, and the case is unreachable rather than
uncovered.** `useRunMutation` evaluates `movedOn` before `holds` and short-circuits, so a report
about the ticket being left is never asked a question about the one arrived at. I kept the stamp
anyway — without it the safety is a chain of reasoning about when another component renders its
start region, and mission control's `RunReport.handle` carries one for a case that *is* reachable —
but no test fails if it is removed, and a reviewer should weigh it knowing that rather than
discovering it. Round 2 §3(a)'s precedent.

**(d) `offerStanding`'s two `unknown` branches cannot be reached through this screen**, both inputs
being reported by construction while an offer stands. They are exercised by the clause over the
function and are stated as such in its own docblock, rather than left to read as DOM-covered.

---

## 6. Observations for the gate — no criterion covers these

**(a) The start and stop screens' *controls* still differ, and that is still the criteria.** AC-8
offers the stop from the last report; AC-6 requires the start region's three unavailable sentences
from the listing's request state. What is one rule across both remains the confirmation. Unchanged
from round 5 §5(b), re-verified rather than assumed.

**(b) `gate-screen.tsx` is untouched**, for round 5 §5(a)'s reason: it sends straight from the
control that names the answer and composes no confirmation, so there is no pending offer for a
premise to attach to.

**(c) R-1's truncation, measured, and it is the worst on this branch.** The review range
(`harness/Q-0130/integration...implement`) is **322,340 bytes** against `repo.max_diff_bytes`'s
configured 200,000, so the next reviewer sees **≈62%**. The cut falls **inside
`apps/web/test/source.test.ts`** — one file earlier than round 4 measured — so what gets no patch at
all is that file's tail plus **seven**: `docs/04-architecture.md` **whole**, `docs/05-design-prompt.md`,
`packages/server/src/http.ts`, `packages/server/src/package.test.ts`,
`packages/shared/src/docs.test.ts`, `packages/shared/src/wire.test.ts`, `packages/shared/src/wire.ts`.
Six of those have not changed since round 1 and three earlier reviewers recorded inspecting them
directly from the branch. **The seventh is new behind the cut and this round changes it**, which is
why §2 quotes its one sentence in both forms. Every source change this round is at byte 72,967
(`run-lifecycle.ts`), 96,164 (`ticket-page.test.ts`) and 142,627 (`ticket-page.tsx`), well in front
of it.

**(d) The pre-existing lint warning is unchanged and still not mine.**
`packages/core/src/backlog/backlog.ts:448`, an unused eslint-disable directive, last touched by
Q-0127. Lint exits 0 with 0 errors and 1 warning; `packages/core` is untouched by this ticket.

**(e) The transient environment warning returned**, as round 5 recorded: `could not add .quorum/ to
/tmp/q0042-repo-*/.git/info/exclude: no space left on device` from `@quorum/core`'s git fixtures,
with every task passing. The volume has **269 GiB** free, so it is transient rather than a full disk.

**(f) GO-4's demonstration is still the gate's.** An implement step runs in a worktree with no daemon
and no browser, and `runs.log` is the harness's to write. Erratum E-4 phrases that obligation as a
transcript precisely because Q-0016's GO-6 was reported discharged when its by-hand half had never
been performed; this step does not report it discharged. It is worth saying that this round's fix is
on the path the transcript walks: a reader choosing a flow and pressing Refresh on the way to
confirming it is the sequence where a stale offer could survive.

---

## 7. File by file

- **`apps/web/src/ticket-page.tsx`** — `StageReport` added (module-private); `OfferStanding` and
  `offerStanding` added and exported; `reportedStage` and `reportedFlows` states; `load`'s two
  continuations record a report only for a `loaded` result, the flows one restructured to an early
  return so the recording sits under the generation guard; `premise` derived from the two reports
  with the stage's stamp; `holds` reduced to one call. `StartPremise`'s docblock rewritten to what
  its two `null`s now mean and to the two things that fix the defect. No change to `RunStart`, to
  `offerable`, to what the body sends, or to any rendered sentence.
- **`apps/web/src/ticket-page.test.ts`** — `flowValue` added and `flowRow` derived from it; three
  tests — the two mixed refresh sequences and the rule's three answers, with both asymmetry clauses
  and all three *could not tell* clauses. 105 insertions.
- **`apps/web/src/run-lifecycle.ts`** — `RunAct.holds`'s docblock: the half-rule completed, and what
  it does not license, naming round 5's finding as what the half-rule produced. No code change.
- **`docs/04-architecture.md`** — one sentence of §`apps/web`, quoted both ways in §2.

`git status` reports exactly these four files.

## 8. What I deliberately left alone

Every criterion of `requirements/merged.md` as rounds 1 to 5 implemented it, and every non-goal in
§5. `useRunMutation` itself — E-7 says the mechanism is right and is not to be rebuilt, and nothing
here changes its contract, its withdrawal condition or its guard. `mission-control-screen.tsx`: its
premise has one input already kept as a last report, and `daemonSaysRunning(null)` answering `false`
is right where it is read, since a stop cannot be offered for a run this screen has never heard of —
changing it would decouple *offered* from *still offered*, which is the property rounds 3 and 4
established. `apps/web/test/source.test.ts`'s `WRITE_RULES`, its three anti-vacuity clauses, round
3's declaration-region rewrite and round 5's act-site register, none of which any finding names and
all of which stay green — the register's subject is the argument count, and both call sites still
supply two. `daemon-client.ts`, `daemon-endpoints.ts`, `gate-screen.tsx`, `packages/shared`,
`packages/server` and `docs/05-design-prompt.md`, unchanged since round 1.

`docs/decisions/` is untouched: GO-1 ruled no entry owed and erratum E-2 ruled the one answer that
would have owed one, and nothing here reopens either — a premise whose inputs are kept separately,
and a predicate that will not let one stand in for another, change no boundary, add no act, and name
no surface a decision governs.
