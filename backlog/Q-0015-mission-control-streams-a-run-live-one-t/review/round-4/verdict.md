# Q-0015 — review verdict, round 4

*Panel: `claude.md` and `codex.md`, both against `main...harness/Q-0015/integration`, 2026-09-17. Both majors below were re-verified in the branch before being carried, on Q-0051's rule that an approve is distrusted and Q-0107's that one pass is not evidence — and in this case because the two reports disagreed about the remedy, which a verdict step has to adjudicate rather than relay.*

**verdict: revise** — two majors, three nits, four observations.

The panel converged on one defect from two directions and independently reached the same line, which is the strongest signal this loop produces. Where they differed is the remedy, and checking the disputed citation turned it into a second finding rather than an argument.

---

## Majors

### M-1 — a retry charges the tail the daemon is about to replay to the browser's discard counter, so the screen reports a loss that did not happen

**`apps/web/src/run-connection.ts:229`** · *claude M-1 and codex major 1, the same defect at the same line, merged.*

```ts
browserDiscardedCount = (browserDiscardedCount ?? 0) + events.length;
events = [];
missedCount = null;
```

**Verified in the branch, and the module argues against itself in place.** `connect()` at `:207–216` clears all three, `browserDiscardedCount = null` among them. The comment introducing the retry block at `:222–228` says the three are *"Cleared exactly as `connect` above clears them, and for the same reason"* — and then supplies the reason that refutes the one line where it diverges: *"the daemon replays its retained tail to EVERY new subscription"*. That premise is correct and it is what makes the increment false. The events are not discarded; they come back.

**Failure scenario, as claude states it and as the code supports.** Accept 7 events; the socket drops — `interrupted` or `dropped`, which is exactly what AC-8 offers Retry for; the reader retries. The new subscription replays the same 7. The snapshot is `{ events: 7, missedCount: null, browserDiscardedCount: 7 }` and `mission-control-status.tsx` renders *"This browser discarded 7 earlier live events to keep the view bounded"* beside a trace holding all 7. A second retry makes it 14. The counter grows with reconnections rather than with anything lost.

**Both halves of the sentence are false.** The events are present, and the stated cause was never reached — `RUN_EVENT_RETENTION` is untouched at `:168–172`, which is the only place that cause applies. AC-10 requires the two counters to have different causes and different remedies and to be unconfusable; this gives one of them a third cause wearing the second's sentence. It is ground rule 1 inverted: not a fabricated value, a fabricated **loss**. And it devalues the instrument that *does* report a reconnect gap honestly — the new subscription's own `missed`, which is precisely what covers the real case, where the browser held events the daemon has since evicted.

**It also falsifies a clause this change itself added.** `docs/04-architecture.md:338` now says the two losses *"are two counters with two sentences and are never merged"*. Under this behaviour they are merged, by the counter rather than by the wording.

**Recommendation — claude's, and it is the one consistent with the module's own reasoning.** In `retry()`, set `browserDiscardedCount = null` beside `missedCount = null`, so the block does what its comment claims and what `connect()` does; the replay's `missed` reports any real gap across the reconnect. Clearing `events` stays: the dedupe argument at `:222–228` is measured and correct, the union carrying no identity to dedupe on.

Codex's alternative — a separately modelled and accurately worded retry-loss counter — is a **third** loss with a third cause. AC-10 and `contracts/Q-0015/mission-control.contract.md` both name exactly two, so that is an erratum at the gate rather than an implementation choice, and it would still have to say something true of a trace the daemon has just restored.

`apps/web/src/run-connection.test.ts:143` currently pins the defect — `expect(…browserDiscardedCount, 'what the retry dropped was not disclosed').toBe(1)` — so it moves with the fix, to `toBeNull()`, and is worth a second clause driving a replay through the new socket and asserting the tail is restored rather than doubled, which is the property round 3's M-1 was actually about. **That file is QA's surface, not an implementer's** — see observation 2.

### M-2 — the architecture document's retry guarantee is false of the shipped code, in the one numbered document this change edits

**`docs/04-architecture.md:340`** · *codex, raised inside its first major; promoted here, because it survives M-1's fix.*

> "…its controller owns at most one socket, closes it on replacement or departure, and **reconnects only through an explicit retry that preserves accepted evidence**."

**Checked on the branch: the sentence is there, unedited, one paragraph below the Q-0015 clause this change added at `:338`.** It is now false — `retry()` clears the accepted tail — and it stays false under M-1's recommended fix, which changes the counter and not the clearing. So this is a live defect rather than a restatement of M-1, and it is on **T10's own surface**: that task owns `docs/04-architecture.md` and edited the paragraph immediately above.

`.claude/rules/docs-and-decisions.md`: *"When code and docs disagree, the docs are wrong until a DECISIONS.md entry says otherwise — fix the docs in the same PR."* The document is what moves, on the module's measured reasoning: an explicit retry replaces the accepted tail with the daemon's replay, and what the daemon can no longer replay is what `missed` counts. A sentence promising more than the code does is the failure this page has recorded most often — its own status line says so twice.

If the gate instead wants the guarantee **held**, the doubled-trace problem the retry comment measures comes back and that is an erratum, not an implementation choice.

---

## Nits

### N-1 — an orphaned doc block that is now false, and the dead import it keeps alive

**`apps/web/src/runs-screen.tsx:38`** *(claude cited `:39`; the block is `:38–45`)* · **verified.**

Round 3's N-6 moved `runsInFlight` to `daemon-client.ts`, correctly. Its doc block stayed behind: it sits immediately above `RunsScreenProps` at `:47–48` with no subject, so tooling attaches it to that interface, and `:43` states *"there is no shared helper for it there yet"* while `:23` imports `runsInFlight` from `./daemon-client.js`. The comment is contradicted by the file it is in.

Counted on the branch: `DAEMON_ENDPOINTS` occurs exactly twice in this file — the import at `:24` and the `{@link}` at `:44` inside that comment. So deleting the comment orphans the import, and **nothing here will catch either**: `eslint.config.js` enables three rules and `no-unused-vars` is not among them, and `tsconfig.base.json` sets no `noUnusedLocals`. Delete both together.

### N-2 — the route-register guard's own sentence is wider than what it checks

**`apps/web/test/routes.test.ts:146`**

`expect(app, …).toContain(name)` reads the whole of `app.tsx` as a string, and `app.tsx:22` imports all five names on one line — so the clause is satisfied for every row by the import alone, including for a row whose dispatch arm has been deleted, since this workspace flags no unused import (N-1). Its own comment claims the stronger property, that every row claiming a screen is one `app.tsx` **selects** by the register's own constant, and `solution.md`'s Verification asks for exactly the mutation it cannot see: *"removing either new constant from `app.tsx` must make the guard red"*.

Claude measured that the coverage is not missing — deleting the `RUN_ROUTE` or `RUNS_PATH` arm turns `mission-control-screen.test.ts`'s first case red, the placeholder's sentence coming back — so this is the claim overstating the check rather than a gap, and it is carried at the severity the reviewer who measured it assigned. It is still the class this repository records most, and the solution's own Verification clause names it, which is the argument for anchoring on the comparison — `expect(app).toContain(\`=== ${name}\`)` — and showing it red by deleting an arm with the import left in place.

### N-3 — a shell test now renders a screen that fetches, with nothing injected

**`apps/web/src/shell.test.ts:193`**

`/runs/:handle` draws mission control now, so this render reaches `MissionControlScreen`'s metadata read with no `fetcher` prop — `browserFetch`, the environment's global `fetch`. The read resolves after `render`'s `act()` has flushed, so `setMetadata` lands outside it, and what the request *does* is whatever that global makes of a relative path. The comment six lines above records the same class for the socket, citing Q-0120 review round 1, M-5 — *"a test doing different work depending on what else is running on the machine"*. Pass a `fetcher`, as `mission-control-screen.test.ts` does; one line.

---

## Demoted rather than dropped

**Codex's second major — `docs/06-development-plan.md:3777`, the Q-0015 entry not advanced — is not a finding against this change.** It is real that the bullet still records only the requirements gate. It is not a defect an implementer could have avoided: `solution.md`'s task **T10** excludes that page by name — *"Do not touch … `docs/06-development-plan.md` — that page's ticket entries are rewritten by hand at each plan pass and carry facts (cost, rounds, findings) that do not exist until a run has ended. See `solution/errata.md` SE-3"* — and no task in the fan-out owns it under any role. That is *"A requirement may not name a surface its flow cannot write"* (2026-08-25), and the substance holds independently of SE-3's authority: the bullet's facts — cost, rounds, findings — do not exist while the run is still running, so a step writing it would be fabricating them, which ground rule 1 forbids at a different site.

It is carried below as observation 1, per *"A finding is a claim about the change; anything else is an observation"* (2026-09-11). **The gate must not read *"AC-14 met"* as covering both documents**: the `04-architecture.md` half is met and on the branch; the plan-page half is owed by hand at the close and is the half no test can hold.

---

## Observations

*Per the 2026-09-11 entry. None is a claim about this change and none carries a `file:line`.*

**observation:** AC-14's `docs/06-development-plan.md` half is owed by hand at the close. Codex reported it as a major; it is an obligation that is the human's, excluded from the flow by SE-3 and T10, and carrying facts that do not exist until the run ends.

**observation:** the remedies for M-1's pinning assertion, N-2 and N-3 all land in files **no development task may write**. `solution.md`'s *File ownership and QA boundary* gives `apps/web/**/*.test.ts` to `qa-red` and forbids QA from touching production or documentation. So a revise round can fix `run-connection.ts:229` and `docs/04-architecture.md:340`, and `run-connection.test.ts:143`'s `toBe(1)` will then go red with no task able to move it. This is Q-0120's structural finding repeating — *a review verdict can name a surface the development flow may not write* — and it is the gate's to rule as an erratum or a hand repair rather than the loop's to discover on the next round.

**observation:** R-4 predicted this review would be truncated and was refuted. The diff arrived whole — 23 files, every file in `--stat` carrying a patch, no truncation notice and no omitted-file warning — so every finding above is over the complete change. That is the **second consecutive ticket** where the prediction was refuted, after Q-0127's 191,552 B against the 200,000 cap, which is worth Q-0128 knowing: the two truncation-free tickets are the two whose diffs stayed under the cap, not two where anything changed about the cap.

**observation:** `docs/04-architecture.md`'s status line still opens `*Status: 2026-09-16 (Q-0016)` while its body carries dated clauses for both Q-0017 and this ticket, the Q-0015 clause being appended in date order as that document's convention requires. The head has been stale since one ticket **before** this branch opened, so it is inherited rather than introduced, and nothing enforces it — `packages/shared/src/docs.test.ts` slices from `*Status:` and never reads the date it carries. Recorded rather than filed as a nit for that reason; a reader who wants the head accurate should fix it at the close, and the two-ticket drift is the argument that the check is cheap.

---

## Checked and sound

Recorded because a verdict's silence over a subject is not the same as having examined it.

- **The two reports are one defect at one line, not two.** Both reach `run-connection.ts:229` from different starting points — claude from the retry block's own comment, codex from the rendered sentence in `mission-control-text.ts:30` — which is the panel spanning vendors doing what it is for.
- **The disputed citation was checked rather than adjudicated from the reports.** `docs/04-architecture.md:340` is present on the branch and says what codex quoted, which is what turned a supporting argument into M-2.
- **N-1 was counted rather than taken on trust**: `DAEMON_ENDPOINTS` occurs exactly twice in `runs-screen.tsx`, and one of the two is inside the comment that would be deleted.
- **Appendix B's first entry is discharged on the branch.** `run-connection.ts:162–166` carries the correction to the stale Q-0121 forecast, written as a correction rather than a silent edit. No finding is owed for it.
- **Claude's *Checked and sound* section was not re-derived and is not restated as verified here.** AC-5's conservation, `eventLine`'s terminal arm, AC-6's six needles and `WRITE_RULES` being untouched are that reviewer's measurements; nothing in the two reports contradicts them, and a second pass over them is not what this step is for.
