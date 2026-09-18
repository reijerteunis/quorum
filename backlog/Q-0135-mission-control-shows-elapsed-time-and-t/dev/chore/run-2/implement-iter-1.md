# Q-0135 — implement report, run 2, iteration 1

*Round 1. No review report was present, so this is a first implement round rather than a revision.*

All ten criteria are implemented. **Verified forced in this worktree**: `pnpm install
--frozen-lockfile` then `pnpm turbo run test lint typecheck --force --continue` → **21 of 21 tasks
successful, 0 cached**, and `pnpm exec quorum lint` → 6/6. The web suite went from 478 tests to 508.

---

## 1. What changed, file by file

### `packages/shared/src/wire.ts` — AC-8, AC-9

* **`WireRun` gains `readonly dry: boolean`**, required rather than optional, with
  `wireRunSchema` gaining `dry: z.boolean()`. The docblock records why it is not optional: an
  omitted field reads as *nothing was said*, and `false` is the value that composes a history id.
* **`WireVendorRollup`, `WireRunHistoryManifest`, `WireRunHistory` and `wireRunHistorySchema`
  added** — the subset of `GET /history/:id` this screen reads. **Loose at all three levels**
  (`z.looseObject`, the constructor this workspace uses since Q-0069), on *"Unknown keys are refused
  where Quorum owns the key set, and preserved where it does not"* (2026-08-25): this is a
  projection of a document `core` writes and may widen, and `readRun` calls the parsed manifest
  *"a cast, never a check"*.
* `steps` is **deliberately absent** from the shape, and the docblock says so: it is the occurrence
  array, carried twice by the route and read by nothing that reads this shape.
* `status` is a plain string and **not an enum**, on `WireTicket`'s own rule.

### `packages/server/src/host.ts`, `packages/server/src/wire.ts` — AC-8

* `RunRecord` gains a `readonly dry`; `RunView` gains `readonly dry`; `viewOf` projects it;
  `wireRunOf` carries it.
* **`mint` now takes the whole `StartRequest` rather than the flow name**, so `dry` is settled at
  the moment the handle exists. That matters for the refused path: `start`'s closed branch mints a
  record too, and a caller asking what the host knows about that handle is owed the same answer.
* `wireRunOf`'s docblock records that this is the one field on that row about the **request** rather
  than about the run, and that Q-0121 GO-3's naming rule permits the name because it narrows no
  `RunView` field.

### `apps/web/src/daemon-endpoints.ts`, `apps/web/src/daemon-client.ts` — AC-10

* `historyDetailPath(id)`, beside `ticketDetailPath` and `runDetailPath`. It writes **no path
  literal of its own** — `DAEMON_ENDPOINTS.history` already exists and the dev server already
  forwards it — so `test/routes.test.ts` is owed no exception row, which I verified against that
  register.
* `fetchRunHistory` and `runHistoryInFlight`. The docblock records that this is keyed by a
  **different token** from `fetchRun`: a handle names a run this daemon is driving, a history id
  names a directory, and a daemon that restarted has lost every handle and no history.

### `apps/web/src/mission-control-measures.ts` — **new**, AC-10/AC-12/AC-13/AC-16

A pure module with no DOM and no `fetch`, on `mission-control-model.ts`'s arrangement, so every rule
is asserted by value against a supplied instant.

* `runHistoryId` / `historyIdOf` — the composition and its three gates.
* `measuredView` — either the history this screen measures from, or which of four reasons it has
  none. **The gate order is the point**: `dry` is asked before the two address gates, so a walk that
  has both components is still refused.
* `elapsedMs` (clamped at zero, `null` where either instant is unreadable), `formatElapsed`
  (`MM:SS` / `H:MM:SS`, zero-padded, **hours unbounded and no day rollover**), `elapsedView`.
* `connectionReportsEnded` — the second authority, taken from the stream because the manifest read
  is a snapshot.
* `formatCost` at **three decimals**, `COST_DECIMALS`, and `vendorCostRows` — order preserved,
  nothing filtered on status, no branch on a vendor name, no sum.

### `apps/web/src/mission-control-text.ts` — AC-16, AC-17

* **Disclosures [1] and [2] rewritten and the array still five.** Each now names the READ that has
  not supplied its value rather than the wire fact that used to be true. The docblock records this
  as a removed premise on the first disclosure's own pattern.
* Eight new exports: three labels/attributions, the three no-read sentences, the ended-unmeasured
  sentence, the unreadable-start sentence, the empty-roll-up sentence, the in-flight caveat, and the
  two per-row helpers.

### `apps/web/src/mission-control-status.tsx` — AC-12, AC-13, AC-14, AC-16, AC-17

* A **new sibling region**, `data-mission-control-measures`, holding `ElapsedRegion`, `CostRegion`
  and `MeasuredAbsenceRegion`. The docblock records why it is a sibling and not in
  `data-mission-control-header`: a cost figure, an `n/a` and a clamped `00:00` all trip that
  region's shipped assertion, and weakening it would be the Q-0014 AC-5 narrowing.
* The tick is `setInterval` at `ELAPSED_TICK_MS`, gated on the figure being live, with the clock
  held in a ref so an inline `now` prop cannot make the interval tear down and rebuild each render.
* **The disclosure filter became a register**: a `supplied` array in the disclosures' own order, one
  row per sentence, with the two that stay unconditional saying why. Q-0131's one-off `!== [0]`
  could not carry three conditional sentences.
* Props gained `reported`, `history`, `now` and `onRetryHistory`. `reported` and not `metadata` is
  deliberate and documented — a refresh replaces the request state the instant it starts, which is
  the class Q-0130's review loop priced four times.

### `apps/web/src/mission-control-screen.tsx` — AC-10

* `readHistory(run)` with its own generation counter, on the gate screen's two-read arrangement, and
  the three gates in it.
* **The history read hangs off the metadata read's continuation**, not off an effect keyed on the
  composed id. That is what makes the count exactly AC-10's: an effect would not fire on a refresh
  that answered with the same id, and one keyed on a refresh counter would fire before the metadata
  it is meant to follow.
* `historyFor` is compared in the render body rather than cleared in an effect, which is the
  arrangement every other keyed value on this screen uses.
* The unmount cleanup bumps both counters.

### `apps/web/src/routes.ts` — AC-17

The mission-control row said the header's run number, elapsed time and per-vendor cost were
*Q-0131's*. That ticket shipped the run number alone and split the other two here, so it was a
register entry promising work under the wrong id. It now describes the values as present and names
Q-0135.

### `docs/04-architecture.md`

§`apps/web` said *"Two of the four values … are still not on this wire and the screen says so rather
than showing them"*, which goes false. Rewritten with the new clauses, and the status line carries a
Q-0135 paragraph. `packages/shared/src/docs.test.ts` gained a clause in the shape the two beside it
use — negatives asserted beside positives, each negative shown to have a subject over a fixture of
the superseded wording.

---

## 2. Tests added

| Where | Covers |
| --- | --- |
| `packages/shared/src/wire.test.ts` | AC-8 (required, refuses omission and a string), AC-9 (loose at three levels, element guards, negative counts, nullable cost, unfamiliar status, nullable token totals) |
| `packages/server/src/read.test.ts` | AC-9 over **the route's own bytes**, on `listRuns`'s idiom, against run directories that suite builds |
| `packages/server/src/http.test.ts` | AC-8 on the start, the lookup and the listing; the projection; a refused start; key-set identity |
| `apps/web/src/mission-control-measures.test.ts` (new) | AC-12 formatting and stopping, AC-13 rows, AC-10/AC-16 gates — all by value against a supplied clock |
| `apps/web/src/mission-control-status.test.ts` | AC-12 live advance / freeze / timer cleanup, AC-13 rendering, AC-14 region separation, AC-16 the four absences and the six sentences, AC-17 the disclosures |
| `apps/web/src/mission-control-screen.test.ts` | AC-10 read counts, the id's composition, and the three gates |
| `apps/web/test/source.test.ts` | AC-11 the narrowed timer clause, AC-12 the clock clause, AC-13 the blended-total clause, AC-15 the count register, AC-17 the sentence and *ticker* clauses |
| `apps/web/test/routes.test.ts` | AC-17's register sentence |
| `packages/shared/src/docs.test.ts` | the architecture section |

### The fixture that R-6 asks for

`screenFor` in `mission-control-screen.test.ts` answers a **valid history for any history path**, so
every no-read clause is asserted against a daemon that would have answered. A fixture where the id
resolves to nothing passes whether or not the gate exists, which is the check-with-no-subject failure
this repository records most.

---

## 3. Mutations run, rather than a green suite read

| Mutation | What went red |
| --- | --- |
| `runHistoryId` drops the `dry` gate | *a dry walk composed a history id*; *a dry walk read run history: expected ['/history/Q-0015-4'] to strictly equal []* |
| `elapsedView` subtracts `ended_at − started_at` instead of reading `duration_ms`, and drops `endedOnStream` | 5 tests: *the browser subtracted two instants instead: expected '00:10' to be '00:07'* (twice), *a terminal event did not stop the figure* (twice), *the tick survived the run ending* |
| `wireRunOf` drops `dry` | **does not compile** — `TS2741: Property 'dry' is missing … but required in type 'WireRun'` |
| the elapsed disclosure retires unconditionally | 3 tests, including *the elapsed disclosure was retired with no elapsed figure beside it* |
| the AC-11 narrowing, asserted in-test | `scheduling` is `['mission-control-status.tsx']`, so the **pre-narrowing clause refuses the shipped tick** — the narrowing is proven necessary rather than merely safe |

---

## 4. What I deliberately left alone

* **`repo.max_diff_bytes`, `argv.ts`, `packages/core`** — no criterion names them and nothing in this
  diff touches `packages/core`.
* **The `[data-mission-control-header]` assertion** (AC-14) is byte-identical to what it was, and is
  additionally shown still to have a subject.
* **`RequestState`** stays closed at five; AC-16's clause cites `request-state.test.ts`'s existing
  identity assertion rather than restating a register.
* **`MISSION_CONTROL_DISCLOSURES` still has five entries.** Two were rewritten and are rendered
  conditionally; none was deleted.
* **`billedCostUsd`'s two decimals** on the board and the ticket page (non-goal 10).
* **No new daemon route, no polling, no event-union change, no second start time, no cap on the
  history payload, no blended total anywhere.**

---

## 5. Residuals and judgement calls, stated rather than left to be found

1. **A seventh absent case exists that AC-16 does not enumerate.** The schema takes `started_at` as
   a non-empty string, per AC-9's words, and `readRun` casts rather than checks — so a hand-edited
   manifest can carry a start that is not an instant. `elapsedView` answers `unreadable-start` and
   the screen names it in prose, rather than rendering `NaN`. I did not strengthen the schema to a
   parseability refinement, because AC-9 specifies *non-empty string* and that would have been wider
   than the criterion.
2. **`unpriced_steps` is disclosed wherever it is non-zero**, which is AC-13's literal wording, so a
   fully unpriced row carries two complementary sentences. Flagged as a nit.
3. **Two data attributes and one docblock were re-spelled** because shipped guards collect them:
   `data-vendor-row` rather than `data-vendor-cost`, and `GET /history/:id` rather than the bare
   path. Both recorded in place with their reason.
4. **Two source clauses strip comments before scanning**, with the residual written at the helper.
   Without it the blended-total clause reports the module whose docblock refuses those two fields —
   the Q-0111 shape, a guard failing on its own explanation.
5. **AC-17's sentence clause is scoped to the three mission-control render modules**, with the
   measurement that decided the scope recorded in place. Flagged as a nit.
6. **GO-4 and GO-5 are the gate's.** Neither can be discharged from an implement step: one needs the
   review prompt this round produces, the other a browser and a running daemon. Both are untouched.
7. `pnpm turbo run lint` reports **one pre-existing warning** in `packages/core`, which this diff
   does not touch. Reported, not fixed.

---

## 6. Verification, in full

```
pnpm install --frozen-lockfile        → Already up to date
pnpm turbo run test lint typecheck --force --continue
                                      → Tasks: 21 successful, 21 total   Cached: 0 cached, 21 total
   @quorum/shared   279 passed        @quorum/web      508 passed
   @quorum/core    1598 passed (2 skipped)             @quorum/server   242 passed
   @quorum/cli      692 passed        @quorum/compiler / @quorum/templates  1 each
pnpm exec quorum lint                 → 6/6
```

No decision entry is owed, at any of the four sites §7 of the requirement names, and the rulings are
recorded in the code's own authority comments on Q-0108's precedent. No criterion named a surface
this flow cannot write: `contracts/` is outside this role's roots and the note there was written by
hand at the gate, which I verified is already committed (`ccbcc2b`).
