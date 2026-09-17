# Q-0015 — review round 4

*Cross-vendor review of `main...harness/Q-0015/integration`, 2026-09-17. Read against the branch rather than the patch: every claim below was checked in the file it is about, and in the code the criterion rests on.*

**verdict: revise** — one major, three nits. The major is a rendered sentence that is false about the trace beside it, on the ordinary Retry path this screen is built to offer.

---

## Findings

### M-1 (major) — a retry charges the tail the daemon is about to replay to the browser's discard counter, so the screen reports a loss that did not happen

**`apps/web/src/run-connection.ts:229`**

Round 3's M-1 was right that the accepted tail must be cleared on `retry()`, and clearing it is correct. What the fix added beside it is not:

```ts
browserDiscardedCount = (browserDiscardedCount ?? 0) + events.length;
events = [];
missedCount = null;
```

`connect()` — twelve lines above, at `:212–214` — clears all three, setting `browserDiscardedCount = null`. The comment introducing the retry block says *"Cleared exactly as `connect` above clears them, and for the same reason"*, and then does the opposite in the one line that distinguishes them.

**The events are not discarded.** `createBroadcast().subscribe()` (`packages/server/src/broadcast.ts:152`) takes `queue: [...retained]` at registration, so every new subscription replays up to `DEFAULT_RETENTION` (`packages/server/src/serve.ts:47` — 500) events, and reports anything it had evicted as `missed`, on its own field. A retry therefore gets the same events back.

**Failure scenario, concretely.** Connect to a run; accept 7 events; the socket drops (`interrupted` or `dropped`, which is exactly the state AC-8 offers Retry for); the reader clicks Retry. The replay delivers the same 7 events. The snapshot is now `{ events: 7, missedCount: null, browserDiscardedCount: 7 }`, and `LossRegion` (`apps/web/src/mission-control-status.tsx:103`) renders

> This browser discarded 7 earlier live events to keep the view bounded.

beside a trace that holds all 7. A second retry makes it 14, a third 21 — the counter grows with reconnections rather than with anything that was lost.

**Why this is a major and not a nit.** Both halves of the sentence are false. The events are present, and the stated cause — the 500-event bound — was never reached; `RUN_EVENT_RETENTION` is untouched at `:171`, which is the only place that cause applies. AC-10 requires the two counters to have *"different causes and different remedies"* and to be unconfusable, and the frozen contract's Retention-and-disclosure section says the same; this makes one of them report a cause it does not have, for events that are there. It is also ground rule 1 inverted: not a fabricated value, a fabricated **loss**. And it devalues the instrument that does report a reconnect gap honestly — the new subscription's own `missed`.

**Recommendation.** In `retry()`, set `browserDiscardedCount = null` alongside `missedCount = null`, so the code does what its own comment claims and what `connect()` does; the replay's `missed` count is what reports any real gap across the reconnect. `apps/web/src/run-connection.test.ts:143` currently pins the defect — `expect(…browserDiscardedCount, 'what the retry dropped was not disclosed').toBe(1)` — so it moves with the fix, to `toBeNull()`, and is worth a second clause driving a replay through the new socket and asserting the tail is restored rather than doubled, which is the property round 3's M-1 was actually about.

If instead the intent is to disclose *what a reconnect dropped*, that is a **third** loss with a third cause and needs a third counter and a third sentence. AC-10 and `contracts/Q-0015/mission-control.contract.md` both name exactly two, so that is an erratum at the gate rather than an implementation choice — and it would still have to say something true of a trace the daemon has just restored.

---

### N-1 (nit) — an orphaned JSDoc that is now false, and the dead import it keeps alive

**`apps/web/src/runs-screen.tsx:39`**

Round 3's N-6 moved `runsInFlight` to `daemon-client.ts:268`, correctly. Its doc block stayed behind. It now sits immediately above `RunsScreenProps` (`:47`) with no subject — so tooling attaches it to that interface — and it states:

> …this screen is the first to read a listing rather than one ticket or one run, so **there is no shared helper for it there yet**.

The import three lines earlier (`:23`) is `runsInFlight` from `daemon-client.js`. The comment is contradicted by the file it is in.

`DAEMON_ENDPOINTS` (`:24`) is now referenced only from inside that comment's `{@link}`, so the import is dead in code. **Nothing here will catch either**: `eslint.config.js` enables three rules and `no-unused-vars` is not among them, and `tsconfig.base.json` sets no `noUnusedLocals`. Delete the comment and the import together.

### N-2 (nit) — the route-register guard's own sentence is wider than what it checks

**`apps/web/test/routes.test.ts:146`**

`expect(app, \`the app does not select ${route.path} by the register's own constant\`).toContain(name)` reads the whole of `app.tsx` as a string. `app.tsx:22` imports all five names on one line, so the clause is satisfied for every row by the import alone — including for a row whose dispatch arm has been deleted, since this workspace flags no unused import (N-1). Its own comment claims the stronger property: *"every row claiming a screen is one `app.tsx` **selects** by the register's own constant"*, and `solution.md`'s Verification asked for exactly the mutation it cannot see — *"removing either new constant from `app.tsx` must make the guard red"*.

Coverage is not missing: deleting the `RUN_ROUTE` or `RUNS_PATH` arm turns `mission-control-screen.test.ts`'s first case red, because the placeholder's sentence comes back. So this is the claim overstating the check rather than a gap — which is still the class this repository records most. Anchor on the comparison, `expect(app).toContain(\`=== ${name}\`)`, and show it red by deleting an arm with the import left in place.

### N-3 (nit) — a shell test now renders a screen that fetches, with nothing injected

**`apps/web/src/shell.test.ts:193`**

`/runs/:handle` draws mission control now, so this render reaches `MissionControlScreen`'s metadata read with no `fetcher` prop — that is `browserFetch` (`apps/web/src/daemon-client.ts:85`), i.e. the environment's global `fetch`. The read resolves after `render`'s `act()` has flushed, so `setMetadata` lands outside it, and what the request *does* is whatever that global makes of a relative path. The comment six lines above this render records the same class for the socket — Q-0120 review round 1, M-5, *"a test doing different work depending on what else is running on the machine"*. Pass a `fetcher`, as `mission-control-screen.test.ts` does; one line.

---

## Observations

*Entries under `observation:` per "A finding is a claim about the change; anything else is an observation" (2026-09-11). None is a claim about this change and none carries a `file:line`.*

**observation:** R-4 predicted this review would be truncated. It was not. The diff arrived whole — 23 files, every file in `--stat` carrying a patch, no truncation notice and no omitted-file warning — so the findings above are over the complete change, and Q-0127's measurement repeats rather than Q-0017's. That is the second consecutive ticket where the prediction was refuted, which is worth Q-0128 knowing.

**observation:** AC-14 names two documents. Only `docs/04-architecture.md` moves on this branch; `docs/06-development-plan.md` does not, because `solution/errata.md` SE-3 rules that page the human's and T10 excludes it by name — a bullet there carries cost, rounds and findings that do not exist until the run has ended. Recorded so the gate does not read *"AC-14 met"* as covering both: the plan-page bullet is owed by hand at the close, and it is the half no test can hold.

**observation:** `docs/04-architecture.md`'s status line still opens `*Status: 2026-09-16 (Q-0016)` while this change edits the document on 2026-09-17; Q-0015's clause is appended in the body in date order. Q-0017 left the head the same way one ticket earlier, so this is a two-ticket drift rather than something this branch introduced, and nothing enforces it — `packages/shared/src/docs.test.ts` slices from `*Status:` and never reads the date it carries.

---

## Checked and sound

Recorded because a reviewer's silence over a subject is not the same as having examined it.

- **AC-5's conservation, against the real union.** `stepIdOf`'s `'stepId' in event` matches `packages/shared/src/events.ts` exactly: `stdoutEventSchema` and its siblings carry no `stepId` of their own and `eventSchema` extends one in for `spawn`/`stdout`/`retry`, while `info`, `warn`, `gate` and `terminal` carry no such field at all. The lane is the four, by construction rather than by a list someone maintains.
- **`eventLine`'s terminal arm.** `event.error === undefined` is right: `runTerminalCommonShape.error` is `z.string().optional()`, not nullable, so no `— null` can be rendered. The switch is exhaustive over the union, so a widened union fails at `tsc` here rather than rendering a kind as nothing.
- **AC-6's six needles, over the corpus rather than a fixture.** Swept every file under `apps/web/src` on the branch: the only hit on any of the three fields is `backlog-board.test.ts:530`'s `[role="progressbar"]`, and no needle matches it — the character before `role` there is `[`, and all four `role=` needles require a quote, backtick or slash. The narrowing SE-1 records is correct and the bare `cost=`/`verdict=` forms are genuinely forbidden.
- **Two documentation claims, verified against the code they describe.** `packages/server/src/http.ts:197` does `.reverse()`, so `04-architecture.md`'s new *"which it reverses so the last run started is first"* holds; `packages/server/src/serve.ts:47` is `DEFAULT_RETENTION = 500`, so AC-9's citation residual is a fact rather than an assumption.
- **AC-14's load-bearing half.** `WRITE_RULES` is untouched: the stop needle is still `permitted: null` under *"stopping a run became permitted"*, `PUT`/`PATCH`/`DELETE` still have no exemption, the permitted set is still exactly the two named modules, and all three anti-vacuity clauses read as before. The split at §5.6 was honoured rather than quietly undone.
- **The one-commit staleness round 1's M3 closed, at its other door.** Leaving the run routes disposes the controller *and* calls `setSnapshot(null)` (`app.tsx`), so returning to a handle already in `connectedHandle` renders the idle snapshot rather than the previous visit's trace. The guard is not defeated by revisiting the same run.
