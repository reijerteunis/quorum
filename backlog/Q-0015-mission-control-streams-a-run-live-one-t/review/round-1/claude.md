# Q-0015 — code review, round 1

*Read-only review of `main...harness/Q-0015/integration`, against `requirements/merged.md` (run 1, iteration 2) and `solution/solution.md` (run 2). Every claim below was checked against the branch's own source — `git show harness/Q-0015/integration:<path>` — rather than against the patch text, including the event union in `packages/shared/src/events.ts` and the replay contract in `packages/server/src/broadcast.ts`.*

**Verdict: revise.** Ten findings — **5 major, 5 nits, no blockers.**

---

## What holds, stated first so the findings are read in proportion

Four of the things most likely to have gone wrong did not, and I verified each rather than taking the implement report's word for it:

- **AC-14's central property is met.** `apps/web/test/source.test.ts:220–262` is byte-for-byte the register Q-0016 shipped: `'/stop'` is still `permitted: null`, `PUT`/`PATCH`/`DELETE` still `null`, the permitted set still exactly `['daemon-client.ts', 'daemon-endpoints.ts']`, and all three anti-vacuity clauses read as they did. That is the property that says the §5.6 split was honoured rather than quietly undone, and it is intact.
- **`partitionTrace` is genuinely lossless and genuinely first-appearance ordered.** `Map` insertion order carries the column order, and `stepIdOf`'s `'stepId' in event` is safe rather than lucky: `packages/shared/src/events.ts` declares `stepId` as a required `z.string()` on all five carrying kinds, so there is no `{ stepId: undefined }` case that would key a column on `undefined`.
- **The three timeline dispositions are correct, including the one that matters.** `buildStepTimeline` reads `runEnded` from a `terminal` anywhere in the tail, so a failed step — which emits no `done` — is named *"The run ended without reporting an end for this step."* rather than reported as running for the rest of the session. That was the codex candidate's error and it was avoided.
- **The retention bound is exact and does not trade away immutability.** `run-connection.ts:163–168` slices to a new array and leaves a previously handed-out snapshot untouched; `connect()` resets both counters.

---

## Findings

### 1. `major` — a trace entry does not name its event type, so `warn`, `info` and `gate` are one undifferentiated sentence

`apps/web/src/mission-control-trace.tsx:25` (`eventLine`), rendered at `:53` and `:76`.

AC-6's first clause is *"Each entry names its event type and renders only fields that event supplies."* The second half is implemented; **the first half is not implemented at all**, and no test asserts it. `eventLine` returns exactly one string per event and the `<li>` renders that string alone, with identical markup and identical classes for every kind.

The consequence lands hardest in the run-activity lane, which is where §0.3 measured that most of what the engine says about itself lives. Concretely, a fan-out run emits into that lane:

```
{ type: 'info', message: 'wave 2: 4 tasks' }
{ type: 'warn', message: 'merge conflict in packages/core/src/engine/routing.ts' }
{ type: 'gate', gateId: 'Q-0015-2:1', kind: 'human', reason: 'review returned revise', ticketDir: '…' }
```

and mission control renders three visually identical grey monospace lines:

```
wave 2: 4 tasks
merge conflict in packages/core/src/engine/routing.ts
review returned revise
```

Nothing tells a reader that the second is a warning or that the third is the run **asking them a question**. In a column the same collapse applies to `spawn`, `stdout`, `step`, `done` and `retry`: a `done` message and a line of vendor stdout are the same thing on screen.

This also silently drops the one field a `gate` event exists for — a reader sees the reason and no indication that a decision is pending — which compounds finding 2.

**Recommendation.** Render the discriminator beside each line (`event.type`, or a short label derived from it), in the lane and in the column, and add the AC-6 clause that was never written: a fixture carrying one `info` and one `warn` whose rendered entries are asserted to differ. Deriving the label from `event.type` costs nothing and keeps the "never parse a message" ground rule intact.

---

### 2. `major` — a gate opened while mission control is watching can never surface its link, and there is no control to re-read

`apps/web/src/mission-control-screen.tsx:57–72` and `apps/web/src/mission-control-status.tsx:75–88`, `:118`.

The gate link is derived from the metadata read (`showGateLink = metadata.kind === 'loaded' && metadata.value.pendingGates > 0`), which is the right channel — §0.7's reasoning about the late joiner is correct and I am not asking for it to be reversed. What is missing is any way to perform that read a second time:

- `readMetadata` is called from one `useEffect` whose only dependency that can change is `handle` (`:66–72`).
- `MetadataRegion` renders a Retry **only** when `canRetryRequest(metadata)` is true, which `request-state.ts:104–113` makes false for `loaded`.

So the live case fails in full:

1. A reader opens `/runs/<handle>` on a running run. The metadata read lands `loaded` with `pendingGates: 0`; no link.
2. The run reaches a gate. The `gate` event arrives on the socket and is rendered in the run-activity lane as an unlabelled sentence (finding 1).
3. `pendingGates` on the daemon is now 1, the browser's copy is still 0, and **there is no button anywhere on the screen** — I confirmed this against the shipped tree: with a `live` connection and `loaded` metadata, `MissionControlStatus` renders zero `<button>` elements, which the status test at `:31` pins from the other direction.

The only exit is a browser page reload. That defeats the ticket's own user story — *"and — when it stops to ask me something — a way to get to the question"* — in exactly the scenario mission control exists for.

**Recommendation.** The mechanism already exists one file away: `runs-screen.tsx:159–166` renders an unconditional Refresh beside its request region. Add the same explicit Refresh to `MetadataRegion`, or re-run `readMetadata` when an accepted event is a `gate`. Either keeps the ruled channel (`pendingGates`, not the streamed event) and is a handful of lines. A test fixture in which the socket delivers a `gate` event after mount asserts the link becomes reachable.

---

### 3. `major` — an explicit Retry replays the daemon's retained buffer on top of events the browser still holds, so the rendered trace doubles

`apps/web/src/run-connection.ts:218–223` (`retry`), against `:207–216` (`connect`).

`connect()` clears `events`, `missedCount` and `browserDiscardedCount`. `retry()` clears nothing — it closes the socket and reopens the same URL. On the daemon side, `packages/server/src/broadcast.ts:56` documents `subscribe()` as *"Registers a subscriber, **replaying what is retained**"*, and `:44` as *"The retained events in consumption order, then the live tail"*. A retry is a new subscription, so the browser receives the retained prefix again and appends it to what it already accepted.

Concretely: a run emits 300 events, the socket drops at event 300 (`interrupted`), the reader presses the Retry the connection region offers. The daemon replays all 300; the browser's tail is now 600 entries. `partitionTrace` conserves faithfully, so each column renders every one of its lines twice and `lane.length + Σ column.length` is 600 for a 300-event run.

This behaviour is pre-existing in `run-connection.ts` — its own module header at `:11–14` acknowledges that reconnection *"either duplicates events or hides a missed prefix"* and makes retry a user act on that basis. **What is new is that it is now rendered.** Until this ticket the only consumers were `.at(-1)` and `.length` in the top bar; mission control draws the list. AC-10 requires the screen to name its two losses and *"never [describe] a retained tail as the run's complete history"* — a doubled tail is a third distortion of the same kind, arriving in the same screen, and nothing names it.

`.claude/rules/engineering.md` says a defect found in code you are already changing is reported rather than migrated in passing, and this change opens that exact function. It was not reported — neither as a finding nor through the `observation:` channel Q-0117 added for precisely this shape.

**Recommendation.** Report it at the gate with a ruling rather than fixing it inside this ticket, since the choice is a behaviour change: either `retry()` resets `events` (losing evidence the module header deliberately preserves) or the screen discloses that a retried connection may repeat what it already showed. My reading is that resetting is right — the daemon replays, so nothing is lost by clearing — but that is a gate's call, not an implementer's. At minimum it belongs in the implement report as an `observation:`.

---

### 4. `major` — the "derived" app-selection guard has a catch-all that fails open for the next screen route

`apps/web/test/routes.test.ts:139–142`.

```js
for (const route of SCREEN_ROUTES.filter((entry) => entry.screenExists)) {
  const name = route.path === BOARD_PATH ? 'BOARD_PATH' : … : route.path === RUNS_PATH ? 'RUNS_PATH' : 'RUN_ROUTE';
  expect(app, …).toContain(name);
}
```

The final arm is an unguarded default. The solution's own verification clause asked for a guard *"extended or **derived from every register row** with `screenExists: true`"*; this is a hand-written mapping wearing a derivation's shape, and the test's title — *"app selects every one by its registered constant"* — claims the stronger property.

The two mutations the requirement named do fire (deleting `RUNS_PATH` or `RUN_ROUTE` from `app.tsx` turns it red), so it is not vacuous today. It fails open at the one moment it should bite. When Q-0022 adds `/runs/:handle/steps/:stepId` with `screenExists: true`:

1. The identity assertion at `:132` fails, so the implementer updates that list — the visible act.
2. The ternary is not updated, because nothing made them.
3. The new row falls through to `'RUN_ROUTE'`, `app.tsx` already contains that string, and the loop **passes** for a screen `app.tsx` may never select at all.

That is the fail-open register shape this repository has recorded repeatedly (`q0050.source.test.ts`'s third hard-coded list, Q-0051).

**Recommendation.** Carry the constant's name on the register row itself, or derive it — e.g. a `Record<string, string>` from path to constant name with an explicit `throw` on a path it does not hold, so a seventh row fails by name rather than borrowing a sixth's evidence. Then show the new arm red by adding a fixture row.

**Secondary, same file, `:143–144`:** the anti-hardcoding clause is still `.not.toMatch(/['"`]\/backlog/)`. In the ticket that added two `/runs` routes to `app.tsx`, that clause covers one of five registered screen paths — `app.tsx` could name `'/runs'` literally and the guard would say nothing.

---

### 5. `major` — the register's own header still claims three ticketless rail entries; the same count moved in two other files and not here

`apps/web/src/routes.ts:13` — *"three rail entries have no ticket at all"*.

The `/runs` row now carries `ticket: 'Q-0015'`, so the ticketless set is two: `/projects` and `/settings`. The change moved that count in `apps/web/src/shell.test.ts:180` (`toStrictEqual(['/projects', '/settings'])`) and in `docs/04-architecture.md` (*"for the two rail entries with no ticket"*), and left the third site — **the module header of the register both of the others are derived from** — reading three.

This is the fix-the-instance-not-the-class shape the development plan records most often (Q-0039 round 2: the glossary still carrying a guarantee removed from two other sites; Q-0112's three consecutive rounds). It changes no behaviour, and that is why it survives: a reader who opens `routes.ts` to learn the register's shape meets a false count in the file that defines it.

**Second site, same claim:** `apps/web/src/shell.test.ts:175` — the test is titled *"the register has three ticketless screens, so the clause above discriminates"* over an assertion listing two. The assertion moved and the sentence naming its purpose did not, so the test now says one thing and checks another.

**Recommendation.** Correct both to two, in the same change.

---

### 6. `nit` — a sixth in-flight helper is declared inside a screen rather than beside its five siblings

`apps/web/src/runs-screen.tsx:46`.

`daemon-client.ts:267–289` already holds `ticketsInFlight`, `flowsInFlight`, `ticketInFlight`, `ticketFileInFlight`, `runInFlight` and `gateAnswerInFlight` — six exported constructors for exactly this state, in the module the package calls *"where every request in the app is made"*. `runsInFlight` is a seventh, declared locally, and `mission-control-screen.tsx:53` correctly imports `runInFlight` from the shared module two files away, so the divergence is visible within the same ticket.

The JSDoc is candid about it (*"there is no shared helper for it there yet"*), which is why this is a nit rather than a major. It is still a second place a request's in-flight state is composed.

**Recommendation.** Move it to `daemon-client.ts` as `runsInFlight`, matching its five siblings' `<T>()` signature.

---

### 7. `nit` — `as number` casts where a narrowing would do

`apps/web/src/mission-control-status.tsx:97–98`.

```js
const daemon = snapshot.missedCount !== null && snapshot.missedCount > 0;
…
{daemon ? <p>{daemonMissedText(snapshot.missedCount as number)}</p> : null}
```

The predicate is hoisted into a `const`, so TypeScript cannot narrow at the use site and the cast papers over it. The cast is correct today and would stay silent if the predicate were later edited — `daemonMissedText(null as unknown as number)` renders *"The daemon omitted null earlier events from this replay."*, which is the fabricated-value class AC-11 exists to forbid, delivered by a cast rather than by a branch.

**Recommendation.** `const missed = snapshot.missedCount; … {missed !== null && missed > 0 ? <p>{daemonMissedText(missed)}</p> : null}` — no cast, and the compiler enforces the invariant the cast asserts.

---

### 8. `nit` — the loss sentences' lexical-distinction clause is one-directional

`apps/web/src/mission-control-status.test.ts:35`.

The contract (`contracts/Q-0015/mission-control.contract.md`, Retention and disclosure) says *"each contains at least one word absent from the other"*. The assertion checks only that the daemon sentence has a word the browser sentence lacks. A future edit that made the browser sentence a strict subset of the daemon one — losing the distinguishing `browser`/`discarded`/`bounded` vocabulary AC-10 rests on — would pass.

**Recommendation.** Assert both directions.

---

### 9. `nit` — the socket-factory guard can no longer see this package's newest run-route renders

`apps/web/test/source.test.ts:318–324` against `apps/web/src/mission-control-screen.test.ts`.

That guard keys on `/initialPath:\s*['"`]\/runs\//` — an inline string literal. The new `app(path)` helper passes `initialPath: path`, a variable, so none of the four run-route renders in the new file is examined at all. They all do supply a `socketFactory`, so nothing is broken; the guard has simply stopped covering the package's newest instances of the thing it was written to prevent (Q-0120 M-5: a suite whose verdict depends on whether something is listening on port 3000).

**Recommendation.** Widen the offender scan to renders whose `initialPath` is not a literal, reporting them unless a `socketFactory` is present — which keeps the guard fail-closed for the helper shape the package has now adopted.

---

### 10. `nit` — `/runs`'s replacement `waitingFor` is pinned by length rather than by content

`apps/web/test/routes.test.ts:242–246`.

The solution's verification says the replacement sentence should be *"asserted directly rather than constrained by the stale `/listing/` wording"*. What shipped is `expect(waitingFor.length).toBeGreaterThan(60)` plus a trailing-period check. That is the same instrument the gate and ticket rows already use, so it is consistent, and it does keep an emptied field from passing — but it asserts nothing about *this* sentence, so any 61-character sentence satisfies it, including one describing a screen that no longer exists.

**Recommendation.** Keep the length floor as the anti-emptying clause and add one positive needle from the shipped sentence (`mission control`, say), the way the gate row's `.toContain('Q-0129')` does two tests up.

---

## Observations

*Not findings — true things that are not claims about the change, reported under the `observation:` channel Q-0117 added.*

**`observation:`** `docs/06-development-plan.md`'s Q-0015 bullet still reads `requirements`, which AC-14 names as moving. `solution/errata.md` SE-3 and task T10 rule that page the human's and forbid the implementer touching it, on the ground that it carries costs, round counts and findings that do not exist until a run has ended. The deferral is deliberate and correctly recorded; it is named here only so the gate does not read AC-14 as fully discharged by the diff.

**`observation:`** AC-14's demonstration clause — the hand `POST /runs` that produced the run, its observed event count and its peak concurrent-column count — is not verifiable from the branch. It is the first per-run event-count measurement this repository would hold, AC-9's stated rationale depends on it, and Appendix A(b) is written to revisit the bound with it. It should appear in the closing record with the request transcribed, not paraphrased. Q-0016's own entry records this exact obligation being reported as discharged when the by-hand half had not been performed.

**`observation:`** The five new `.test.ts` files under `apps/web/src` are written with multiple statements per physical line, several lines exceeding 400 characters (`mission-control-screen.test.ts`'s `app()` helper is one such line, as is every `test(…)` body in that file). They are correct and they run, and the repository has no line-length rule I can cite. It is worth saying once that a reviewer cannot read a 400-character line for defects at the same rate as a formatted one, and that these are the files a later ticket will have to re-aim.

---

## What I could not check

I did not execute the suite, `pnpm lint` or `pnpm typecheck` — this is a read-only review and the verdicts belong to `integrate` in both environment rows. Findings 1, 2 and 3 are behavioural and were established by reading the shipped code paths end to end; none of them is a test that fails today, which is precisely the point of 1 (an unmet criterion with no test) and of 2 and 3 (behaviour no criterion reaches).
