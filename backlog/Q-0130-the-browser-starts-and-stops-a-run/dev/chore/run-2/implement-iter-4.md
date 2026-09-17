# Q-0130 — implement, run 2, iteration 4

Revision round. **The single review finding was real**, was reproduced before it was fixed, and the
fix is shown red by four mutations. No criterion moved, no new criterion was invented, and the only
file changed outside `apps/web/src/mission-control-screen.tsx` and its suite is one sentence of
`docs/04-architecture.md` that this branch itself wrote and that this round makes imprecise.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21
successful, 0 cached**. `pnpm exec quorum lint` 6/6. `@quorum/web` alone: 20 files, **408 tests**,
against round 3's 406 — the two new cases.

---

## 1. The finding, and what it actually was

> `daemonSaysRunning(metadata)` becomes false as soon as `readMetadata()` replaces the last loaded
> run with `in-flight`, and also remains false if that read becomes unreachable or unparseable. …
> AC-8 explicitly bases availability on the daemon's **last reported** state; a request state is not
> a new run-state report.

**Confirmed, and it is one root cause with two faces.** `readMetadata` sets
`setMetadata(runInFlight(handle))` synchronously before it awaits, so the first commit of *any*
refresh has `metadata.kind === 'in-flight'`. Under the old predicate that commit both removed the
control and — because round 2 correctly made the withdrawal read the same predicate as the control —
**permanently withdrew a pending confirmation**. So the two halves round 2 joined together were
being moved together by something that is not an answer:

| what happened | what the screen concluded |
| --- | --- |
| a reader pressed *Check again* | the run is not running: control gone, confirmation withdrawn |
| the daemon could not be reached | the run is not running |
| the daemon answered a body this page cannot read | the run is not running |

The third column is a claim the daemon never made in any of the three rows. And the first row is the
worst of them, because it is reached by the reader asking for a **fresher** answer about the run:
the act of looking took away the one act there was to take.

**It is the asymmetry AC-8 already refuses for a socket, arriving through the other door.** That
criterion exists because `docs/GLOSSARY.md` says connection state *"is not run state"* — a transport
can drop without the run changing, so a screen that hides the control when its socket fails
withholds the act a reader wants precisely when they can no longer watch. A read in flight and a
read that never answered are the same shape one layer over: they are facts about **this browser's
request**, not about the run. The existing `AC-8 — and connection state does not decide it` clause
was true and was not enough, because it only ever exercised the union the guard was blind to.

---

## 2. What changed

**One idea, named.** `RequestState` answers *what became of the last request*. Nothing answered
*what the daemon last said about the run* — so the screen now holds that too, as its own state:

```ts
interface RunReport { readonly handle: string; readonly run: WireRun }
```

- `readMetadata`'s continuation sets it **only where `result.kind === 'loaded'`**, which is the
  whole of the fix: an answer that carried a run is a report about one, and nothing else is.
- `daemonSaysRunning` takes `WireRun | null` instead of `RequestState<WireRun>`. It is still
  declared once and still read by both the control and the withdrawal, so round 2's property — that
  *offered* and *still offered* cannot become two predicates — is preserved rather than traded away.
- `StopControl`'s prop moves from `metadata` to `reported`. **The structural property it was written
  for survives and is strengthened**: it took no snapshot before, so connection state could not
  reach it by signature; it now takes a `WireRun`, which only ever comes out of a daemon answer that
  carried one — so neither a socket *nor a request in flight* can reach the decision through it.

**The report carries the handle it is about, and that is not decoration.** A report is kept until a
later one replaces it, so without the handle it would outlive its subject: `app.tsx` keys this
screen by handle, so reaching the case needs the prop to move under one instance — but a read that
then failed at the new handle would leave the previous run's `running` standing **indefinitely**
rather than for one commit, which is strictly worse than the one-commit window `metadata` already
has and which that key already closes. `lastReported` is therefore
`reported.handle === handle ? reported.run : null`, which is `useRunMutation`'s own
`answered.subject === subject` arrangement for its reason. Mutation C below holds it red.

**The status region is untouched and still reads `metadata`.** That region is *about the read* — its
in-flight sentence, its failure sentences, its Retry and its *Check again* are all reports on the
request, and they must go on moving with it. The split is now explicit in the code: the region about
the request reads the request state, the control about the run reads the run.

---

## 3. The judgement inside the fix, stated rather than buried

**A `refused` read does not withdraw the control, and that is a reading of the finding rather than a
gap.** The finding says *"preserve the last successfully reported run state while reads are pending
**or fail**"* and *"withdraw the confirmation only when a daemon response actually **reports a
non-running run**"*. A 404 `no-such-run` is the daemon answering the **request**; it reports no run
at all. Three things make preserving it the safe direction:

1. A handle is *"deliberately meaningless across a restart"*, so `no-such-run` at a handle this
   daemon once minted is most often a daemon that restarted — not a run that stopped running.
2. The daemon stays the authority on the act itself. A stop sent to a run that is gone is answered
   `no-such-run`, and AC-5's register plus AC-10 render that refusal as what it is. Nothing is
   guessed at here.
3. It is the same asymmetry as the socket clause: withdrawing a reader's only act on the evidence of
   a request that failed is exactly what AC-8 refuses elsewhere.

The reasoning is in the code at the one site that decides it, in one comment beside
`if (result.kind === 'loaded')`, cited rather than transcribed.

**One sentence of `docs/04-architecture.md` moved, and it is quoted here because the review diff will
not carry it** (§6). §`apps/web` said:

> The stop is offered from the metadata read's own `state` and never from connection state, and a
> delivered cancellation is not a run that ended.

That sentence is now the *defect's* rule written down — "the metadata read's own `state`" is
precisely what the control is no longer drawn from. It reads:

> The stop is offered from the run the daemon last **reported** and never from connection state —
> and the last report is not the last request, a refresh in flight and a read that never answered
> being *no new report* rather than a report that the run is not running — and a delivered
> cancellation is not a run that ended.

**No pinned clause moves.** `packages/shared/src/docs.test.ts`'s two Q-0130 blocks assert the status
line, the four superseded negatives and six positives (`ticket page starts one`, `not on a board
card`, `never one`, `never `auto` and never `base``, `wireStartRequestSchema`, `one permission`);
this sentence is none of them, and the suite is green. It is amended under the standing docs rule —
code and a numbered doc disagreeing is the doc's problem in the same change — rather than as new
work: it is one clause in the paragraph AC-14 already requires to say what this ticket did.

---

## 4. The mutations, each reverted after

| # | Mutation | Result |
|---|---|---|
| A | the defect restored — `lastReported` derived from the request state (`metadata.kind === 'loaded' ? metadata.value : null`) | **1 red** — *a refresh in flight withdrew the control for a run the daemon last reported running: expected null not to be null* — the reviewer's finding word for word |
| A(b) | A, with half (a) of the new test removed so the failed-read half cannot be masked | **1 red** — *a read that came back unreachable withdrew the control for a run last reported running* |
| A(b′) | A, with the failure loop reduced to `['refused']`, then to `['unparseable']` | **1 red each** — *…came back refused…*, *…came back unparseable…* |
| B | the withdrawal split from the control again — control from the report, withdrawal from the request state | **1 red** — *a refresh in flight withdrew a confirmation the daemon had said nothing about* |
| C | the report no longer carries its handle (`reported?.run ?? null`) | **1 red** — *a report about the run that was left offered a stop on the run arrived at: expected \<button…\> to be null* |
| D | the withdrawal removed entirely | **1 red** — *the confirmation outlived the control that offered it* — round 2's clause still has its subject under the new predicate |

**A(b) and A(b′) are the ones worth reading.** Under mutation A the test stops at its first failing
clause, so the three failure cases were never exercised and would have been *"shown red by their
neighbour"* — Q-0107's distinction. Each was re-run in isolation and each fails on its own, with a
message naming which failure kind it was about. **B is what proves the confirmation clauses are not
riding on the control clauses**: it leaves the control correct and moves only the withdrawal, and
the confirmation assertion is what goes red. **D is the check on the fix rather than on the defect**
— changing the predicate did not quietly disarm round 2's withdrawal.

---

## 5. Findings in my own work this round

**(a) A test message of mine tripped a house rule, and the guard is what caught it.** I wrote *"the
`unreachable` read this clause stages never **landed**"*, and `apps/web/test/source.test.ts` refuses
`merged`, `landed` or `shipped` anywhere under `src/` — Q-0017's containment-synonym rule. The word
was about an HTTP read rather than about a branch, which is exactly the kind of near-miss a
whole-word ban exists to stop being argued about case by case, so the message was reworded rather
than the guard exempted. Full forced suite was red for it and green after. Recorded because it was
found by the machinery and not by me.

**(b) The `refused` staging needed a real refusal body, and my first version did not have one.** I
first staged that case as a bare `{ok: false, status: 404}` with no body, which `requestJson` turns
into a `refused` carrying the synthesised `http-404` code — the same *kind*, reached by the fallback
path rather than by the path a daemon refusal takes. It now answers the real
`{code: 'no-such-run', condition, remedy}` shape, so the clause exercises the case the reasoning in
§3 is actually about.

**(c) I nearly shipped the handle check with no test that could fail on it.** Nothing in the
existing suite moves the `handle` prop under one instance — `app.tsx`'s key means the app never
does — so the check would have been an unfalsifiable guard, which is the shape this repository
refuses. The second new test renders `MissionControlScreen` directly, twice, without a key, and
mutation C is what says it has a subject.

---

## 6. Observations for the gate — no criterion covers these

**(a) The start side's analogue was re-checked and is deliberately unchanged, for a reason that is
about the criteria rather than about effort.** Round 2 §3(c) reported that a ticket-page Refresh
makes the start controls disappear while a pending confirmation stays on screen. Re-verified this
round: `ticket-page.tsx` has no withdrawal in render (`grep cancel()` returns nothing), so that
residual stands exactly as reported. **It is not the same case as the one just fixed.** AC-8 is
written on *the last reported run state*, which is why a request state may not decide it; **AC-6 is
written the other way** — it requires the start region to render three distinct unavailable states
*from the listing's request state*, including *"where the flow listing could not be read, it says
that instead and does not report an unread listing as no flow consumes this stage"*. A start region
that kept the last flow listing through a failed read would be rendering an answer the criterion
says it must not. So the two screens differ because the two criteria differ, and changing the start
side would be contradicting AC-6 rather than extending this fix. A reviewer should check that
reading rather than take it.

**(b) R-1's truncation prediction, measured, and where it now falls.** The cumulative branch diff is
**281,460 bytes** against `repo.max_diff_bytes`'s 200,000, so the next reviewer sees **≈71%**. The
cut now falls **inside `docs/04-architecture.md`'s own patch** (which begins at byte 165,615 — its
status line is one very long line), so what gets no patch is the remainder of that file plus the
same six that rounds 1 and 3 named: `docs/05-design-prompt.md`, `packages/server/src/http.ts`,
`packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`,
`packages/shared/src/wire.test.ts`, `packages/shared/src/wire.ts`. **None of those six changed this
round**, so what is behind the cut is byte-identical to what both earlier reviewers recorded
inspecting directly from `harness/Q-0130/implement`. **Both of this round's source changes are in
`apps/web/src/`, at the head of the diff and well in front of the cut.** The one thing behind it
that *is* new is the single doc sentence, which is why §3 quotes it in full in both its old and new
form rather than leaving it to a patch that will not arrive.

**(c) The pre-existing lint warning is unchanged and still not mine.**
`packages/core/src/backlog/backlog.ts:448`, an unused eslint-disable directive, last touched by
Q-0127. `packages/core` is untouched by this ticket; lint exits 0 with 0 errors and 1 warning.

---

## 7. File by file

- **`apps/web/src/mission-control-screen.tsx`** — `RunReport` added (module-private); a `reported`
  state beside `metadata`; `readMetadata`'s continuation records a report only for a `loaded`
  result; `lastReported` derived with the handle check; `daemonSaysRunning` re-typed to
  `WireRun | null`; `StopControl`'s `metadata` prop replaced by `reported`; the module docblock
  gains the paragraph distinguishing the last report from the last request, and the three comments
  that described the old rule now describe the shipped one. No change to `MissionControlStatus`'s
  props, to `useRunMutation`, or to anything the trace and timeline regions read.
- **`apps/web/src/mission-control-screen.test.ts`** — the `control()` helper's read policy becomes a
  three-member union with `holdReads()` and `failReads(as)` beside the existing `setRunState`, and
  `answerRead` stages the three failures the way `requestJson` tells them apart; two tests added —
  the four not-a-report cases, and the one-handle clause. 121 insertions.
- **`docs/04-architecture.md`** — one sentence of §`apps/web`, quoted both ways in §3.

`git status` reports exactly these three files.

## 8. What I deliberately left alone

Every criterion of `requirements/merged.md` as rounds 1 to 3 implemented it, and every non-goal in
§5. `apps/web/test/source.test.ts`'s `WRITE_RULES`, its three anti-vacuity clauses and round 3's
declaration-region rewrite — no finding named them and they stay green. `daemon-client.ts`,
`run-lifecycle.ts`, `ticket-page.tsx`, `packages/shared`, `packages/server`, and
`docs/05-design-prompt.md`. `docs/decisions/` is untouched: GO-1 ruled no entry owed, erratum E-2
ruled the one answer that would have owed one, and nothing this round reopens either — a screen
reading the daemon's last report instead of its last request state changes no boundary, adds no act,
and names no surface a decision governs.

**GO-4's demonstration is still the gate's.** An implement step runs in a worktree with no daemon
and no browser, and `runs.log` is the harness's to write. Erratum E-4 phrases that obligation as a
transcript precisely because Q-0016's GO-6 was reported discharged when its by-hand half had never
been performed; this step does not report it discharged. It is worth saying that this round's fix is
one the transcript would exercise directly: the demonstration stops a run from mission control, and
pressing *Check again* on the way there is exactly the sequence that used to take the control away.
