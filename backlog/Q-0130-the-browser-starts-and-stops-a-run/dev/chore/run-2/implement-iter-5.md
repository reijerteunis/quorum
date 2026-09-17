# Q-0130 — implement, run 2, iteration 5

Revision round. **The single review finding was real**, and erratum E-6 — written at the second
exhaustion gate — ruled how it must be closed: not a fifth guard on a fifth surface, but **one
mechanism** where the confirmations already live. That is what this round builds. Four mutations
hold the fix and five more hold the register and the two halves of the mechanism; each was reverted.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21
successful, 0 cached**. `pnpm exec quorum lint` 6/6. `@quorum/web` alone: 20 files, **411 tests**,
against round 4's 408.

---

## 1. The finding, and why it is the fourth face of one thing

> The confirmation is rendered and remains actionable independently of the refreshed ticket and flow
> states. … rendering the flow as refused while retaining its live confirmation still offers it.

**Confirmed.** A reader chooses `chore`, presses Refresh, and is handed a listing where the linter
now refuses that file — or a ticket whose stage has moved, or a listing that no longer holds the
flow at all. After any of the three the control is gone and, until this round, the question beside
it was not: still on the screen, still answerable, still sending the start.

**It is round 1's defect on a third surface, and E-6 counted rather than impressed.** A confirmation
outliving a change of subject (round 1, `run-lifecycle.ts`), then one outliving the run's state
(round 1, `mission-control-screen.tsx`), then round 3's correction of that fix overshooting by
substituting a *request* state for a *run* state, then this. Each round closed the instance it was
handed and the next found the same defect on a sibling. Round 3's is the one that proves it is a
class: a per-instance fix had to re-derive *a request is not a report* on its own, and got it wrong
once.

**So what is fixed here is the class.** A confirmation now carries the premise it was offered under
and there is exactly one place it is withdrawn.

---

## 2. What changed

### `apps/web/src/run-lifecycle.ts` — the mechanism

**`RunAct<T, P>` gains a required `holds(premise: P): boolean`.** It is the premise the offer rests
on, asked again on every render. It takes the premise **as an argument rather than closing over
it**, which is what makes this a mechanism instead of a fourth guard: a predicate capturing the
screen's values when the act was asked about would answer with what was true then, which is the
question this exists to stop being asked. It also keeps `ask`'s dependency list at `[subject]`, so
the premise changing every render churns nothing.

**`useRunMutation<T, P>(subject, premise)` takes the premise and owns the withdrawal.** One
condition, one reason:

```ts
const movedOn = showing.current !== subject;
if (movedOn) showing.current = subject;
if (asked !== null && (movedOn || !asked.act.holds(premise))) setAsked(null);
```

Both halves are the same sentence — *the screen would not offer this now* — and round 2's two
properties are preserved rather than traded: it is done **in the render that ends the offer** (a
state cleared in an effect is one commit late, and that commit is one where an irreversible control
is live), and it **withdraws rather than hides**, so a later answer that would make the act
offerable again does not put back an offer nobody made twice.

One judgement is stated in place rather than left to be read into it: the premise is asked about
only where the subject did **not** move, **nothing behavioural rests on that order** — the two
halves are an OR — and no test holds it. What it buys is that an act composed for the ticket being
left is never asked a question about the premise of the one arrived at.

### `apps/web/src/mission-control-screen.tsx` — a premise instead of a guard

`lastReported` moved above the hook and is now passed as the premise; `holds` is
`daemonSaysRunning`, the same predicate the control is drawn from; and **the render-phase
`stop.cancel()` this screen carried since round 2 is gone**. The screen states what its offer rests
on and withdraws nothing. Round 3's correction is untouched and strengthened by being expressed
once: a refresh in flight and a read that never answered reach `holds` as the last report unchanged,
so neither withdraws anything.

### `apps/web/src/ticket-page.tsx` — the finding's own surface

`offerable(flow, stage)` is declared once — *consumes this stage and the linter did not refuse it* —
and is read **both** by the region that offers a flow and by the premise, so *offered* and *still
offered* cannot become two predicates that disagree about one listing. That is mission control's own
`daemonSaysRunning` arrangement, reused rather than re-derived.

`StartPremise` is `{stage, flows}`, each **as last REPORTED**: `null` means the daemon has not
answered, not that there is no such stage or no such flow. `shownDetail` moved above the hook so the
premise can be computed from it; nothing else about it changed.

### `docs/04-architecture.md` — one clause

Quoted here because the review diff may not carry it (§5(b)). §`apps/web` said:

> **Both acts are confirmed, single, and at most one in flight**, under one guard in
> `src/run-lifecycle.ts` … which is Q-0016's review blocker written once instead of being available
> to come back twice.

It now continues:

> **And a confirmation stands only as long as the premise it was offered under does**: a screen
> hands that premise to the hook — the run the daemon last reported, the flows it last listed —
> declares it once as a predicate beside the act, and withdraws nothing itself. One mechanism rather
> than a guard per screen, because the guard-per-screen shape is what this ticket's review loop
> priced: the same class four times across three surfaces, each round closing the instance it was
> handed and the next finding it on a sibling. A read still out and a read that failed are not
> premises that stopped holding, which is *"connection state … is not run state"* one layer over.

**No pinned clause moves.** `packages/shared/src/docs.test.ts`'s two Q-0130 blocks assert the status
line, four superseded negatives and six positives; this is none of them, and the suite is green. It
is amended under the standing docs rule, as one clause in the paragraph AC-14 already requires to
say what this ticket did.

### `apps/web/test/source.test.ts` — the evidence E-6 asked for

> The evidence is that a **fourth** call site cannot be added without supplying a premise — the
> register shape AC-11 already uses.

`actSites` walks each module's top-level declarations — round 3's `declarations()`, so no way of
spelling a component can hide one — finds every call of the hook, and counts its **top-level
arguments**. The register:

```
mission-control-screen.tsx: MissionControlScreen supplies 2
ticket-page.tsx: TicketPage supplies 2
```

Beside the identity, the property stated over the set (*no site supplies anything other than a
subject and a premise*), because a hand-maintained register can be updated to the wrong number; the
hook's own declaration excluded **by name** with a clause proving it is declared once and where; and
the compiler's half, which this file cannot hold — `holds` is required, checked by refusing `holds?`
with an anti-vacuity clause beside it.

**What it does not cover is written into its docblock rather than left to be read into it.** Its
subject is a *confirmation*, so a screen that sends without asking first is invisible to it —
`gate-screen.tsx` is one. The clause that sees all three acts whatever screen issues them is the
writing register above it.

---

## 3. The mutations, each reverted after

| # | Mutation | Result |
|---|---|---|
| A | `holds` on the ticket page made vacuous — **the reviewer's finding restored** | **1 red** — *the confirmation outlived the offer: the linter now refuses that flow* |
| A(b) | A, with the stage-move staging run first | **1 red** — *…the ticket has moved to a stage that flow does not consume* |
| A(c) | A, with the absent-flow staging run first | **1 red** — *…that flow is no longer in the listing at all* |
| B | the mechanism **hides** rather than withdraws (`confirming` gated on `holds`) | **2 red**, one per screen — *a withdrawn confirmation was put back by a later read* / *…by a later listing* |
| C | the premise half dropped from the mechanism entirely | **2 red** — *the confirmation outlived the control that offered it* / *…outlived the offer* |
| D | the subject half dropped from the mechanism | **1 red** — *one ticket's confirmation was left standing under another ticket's id* |
| E | mission control's `holds` made vacuous | **1 red** — round 2's clause still has its subject under the new mechanism |
| F(a) | the premise's listing half drawn from the **request** state (`[]` while unread) | **1 red** — *a listing that could not be read withdrew a confirmation the daemon had said nothing about* |
| F(b) | the premise's stage half drawn from the request state | **1 red** — *a read that could not answer withdrew a confirmation…* — **only after §4(a)** |
| G | a real screen calling the hook with one argument | **1 red** — the register reports `MissionControlScreen supplies 1` by name |
| H | `holds` made optional | **1 red** — *the premise became optional, so an act can be offered without one* |
| I | an act composed with no premise at all | **typecheck red** — *Property 'holds' is missing … but required in type `RunAct<WireRun, StartPremise>`* |

**A(b) and A(c) are why the three stagings are three clauses rather than one.** Under mutation A the
test stops at its first failing clause, so the other two would have been *shown red by their
neighbour* — Q-0107's distinction. Each was re-run first in the loop and each fails on its own, with
a message naming which way eligibility was lost.

**B is what discriminates *withdrawn* from *hidden*** on both screens at once, which is what the
mechanism made possible: one mutation, two red clauses, where round 2 had to stage it per screen.

**I is the half this file cannot hold and the compiler can.** A fourth screen that supplies the
argument and composes an act without a predicate does not build.

---

## 4. Findings in my own work this round

**(a) My first counter-clause could not fail, and mutation is what caught it.** The half asserting
that a *ticket* read which failed withdraws nothing passed **under mutation F(b)** — because `load`
resets the flow listing at the same moment, so `premise.flows` was `null` and the listing half of
`holds` answered before the stage half could. The stage clause was shielded and unfalsifiable. It
has a subject now because the harness can fail the **ticket read alone**, which stages the real
window the two requests are not in step: they settle independently by design, so a listing that
answers while the ticket is still out is reachable rather than contrived. This is the class this
repository warns about first, found in the clause written to close a different instance of it.

**(b) The register would have collected the hook's own definition.** `useRunMutation<T, P>(` is a
declaration head, not a call, and the first version reported `run-lifecycle.ts: useRunMutation
supplies 2` as though the module called itself. Excluded **by name** rather than by a predicate that
could quietly widen, with a clause proving the exclusion has exactly one subject.

**(c) I tightened the register's claim after writing it.** The first docblock read as though it
covered every act this app performs on a run. It does not: it covers every act a reader is *asked
about*, and `gate-screen.tsx` sends without asking. Stated in place, with a pointer to the register
that does see all three.

---

## 5. Observations for the gate — no criterion covers these

**(a) E-6's "three existing call sites" is two in the tree, and the third is the mechanism.** There
are two `useRunMutation` call sites. The third surface E-6's own table names is `run-lifecycle.ts`,
which is now where the withdrawal lives rather than a call site — so the instruction is satisfied
and the phrase is worth correcting where it is cited. **`gate-screen.tsx` is a fourth surface and I
deliberately did not touch it**: it carries the same one-answer-in-flight guard but composes **no
confirmation** — it sends straight from the control that names the answer — so there is no pending
offer for a premise to attach to. Moving it onto this hook would mean inventing a premise for it,
which no finding asks for and which is a behaviour change to a shipped screen.

**(b) The two screens' *controls* still differ, and that is the criteria rather than an
inconsistency.** AC-8 offers the stop from the last **report**, so a refresh leaves the control
standing; AC-6 requires the start region to render three distinct unavailable states from the
listing's **request** state, so a refresh takes the controls away while it is out. What is now *one*
rule across both is the confirmation: neither screen withdraws one for a read in flight or a read
that failed. Round 2 §3(c) and round 4 §6(a) reported that asymmetry as a residual on the start
side; under E-6 it is ruled and the residual is closed — the confirmation survives the refresh and
is judged when the answer arrives.

**(c) R-1's truncation, measured.** The review range is **306,787 bytes** against
`repo.max_diff_bytes`'s 200,000, so the next reviewer sees **≈65%**, the worst ratio on this branch.
The cut falls in the same place round 4 measured — inside `docs/04-architecture.md`'s own patch,
whose changed lines are very long — so what gets no patch at all is the remainder of that file plus
the same six rounds 1, 3 and 4 each named: `docs/05-design-prompt.md`, `packages/server/src/http.ts`,
`packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`,
`packages/shared/src/wire.test.ts`, `packages/shared/src/wire.ts`. **None of those six has changed
since round 1**, so what is behind the cut is byte-identical to what three earlier reviewers recorded
inspecting directly from `harness/Q-0130/implement`. Every source change this round is under
`apps/web/`, at the head of the diff. The one new thing behind the cut is the doc clause, which §2
quotes in full in both forms for that reason.

**(d) The pre-existing lint warning is unchanged and still not mine.**
`packages/core/src/backlog/backlog.ts:448`, an unused eslint-disable directive, last touched by
Q-0127. Lint exits 0 with 0 errors and 1 warning.

**(e) One transient environment warning, recorded because a reviewer will see it.** The forced run
printed `warning: could not add .quorum/ to /tmp/q0042-repo-*/.git/info/exclude: no space left on
device` from `@quorum/core`'s git fixtures while every task passed. The volume has 269 GiB free, so
it is transient rather than a full disk; `packages/core` is untouched here.

**(f) GO-4's demonstration is still the gate's.** An implement step runs in a worktree with no
daemon and no browser, and `runs.log` is the harness's to write. Erratum E-4 phrases that obligation
as a transcript precisely because Q-0016's GO-6 was reported discharged when its by-hand half had
never been performed; this step does not report it discharged. It is worth saying that this round's
fix is one the transcript exercises directly: a reader choosing a flow and pressing Refresh on the
way to confirming it is exactly the sequence that used to leave an answerable question for a flow
the page would no longer offer.

---

## 6. File by file

- **`apps/web/src/run-lifecycle.ts`** — `RunAct<T, P>` with its required `holds`; `Pending<T, P>`;
  `RunMutation<T, P>`; `useRunMutation<T, P>(subject, premise)` with the one withdrawal condition.
  The module docblock gains the paragraph on what a confirmation carries and why it is one mechanism
  rather than a guard per screen; `ask`'s parameter type moved with the interface. No change to
  `confirming`, `outcome`, `busy`, `cancel` or `confirm`.
- **`apps/web/src/mission-control-screen.tsx`** — `lastReported` computed above the hook and passed
  as the premise; `holds: (reportedNow) => daemonSaysRunning(reportedNow)`; the render-phase
  `stop.cancel()` deleted; `StopControl`'s `mutation` type; two docblock paragraphs.
- **`apps/web/src/ticket-page.tsx`** — `offerable` and `StartPremise` added; `shownDetail` moved
  above the hook with `premise` derived from it; `holds` on the start act; `RunStart` draws its
  control through `offerable` and its `mutation` type moved; two docblock paragraphs.
- **`apps/web/src/ticket-page.test.ts`** — `startDaemon` gains `setFlows`, `setStage` and
  `setReads(how, only?)`, the last narrowable to the ticket read for the reason in §4(a); two tests
  added — the three ways eligibility is lost, with the withdrawn-not-hidden half, and the
  read-still-out / read-that-failed counter-clause in both its listing and ticket halves.
- **`apps/web/test/source.test.ts`** — `OFFERS_AN_ACT`, `CALLS_THE_HOOK`, `argumentCount`,
  `actSites`, `offerSites` and one test carrying the identity register, the universal property, the
  exclusion's subject, the required-member clause and four fixtures.
- **`docs/04-architecture.md`** — one sentence of §`apps/web`, quoted both ways in §2.

`git status` reports exactly these six files.

## 7. What I deliberately left alone

Every criterion of `requirements/merged.md` as rounds 1 to 4 implemented it, and every non-goal in
§5. `daemon-client.ts`, `daemon-endpoints.ts`, `packages/shared`, `packages/server` and
`docs/05-design-prompt.md` — no finding names them and none changed since round 1.
`apps/web/test/source.test.ts`'s `WRITE_RULES`, its three anti-vacuity clauses and round 3's
declaration-region rewrite, all of which stay green and which the new register **reuses** rather
than duplicates. `gate-screen.tsx`, for the reason in §5(a). `docs/decisions/` is untouched: GO-1
ruled no entry owed and erratum E-2 ruled the one answer that would have owed one, and nothing here
reopens either — a confirmation that carries what it was offered under changes no boundary, adds no
act, and names no surface a decision governs.
