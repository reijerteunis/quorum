Implemented all fourteen acceptance criteria of `requirements/merged.md`. The browser starts a run from the ticket page and stops one from mission control; the start request's shape moved to `@quorum/shared`; the write register moved by one permission and gained a clause with a different subject; five shipped sentences that went false moved, each asserted negatively against the wording it replaces; and both documents say what shipped.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21 successful, 0 cached**. `pnpm exec quorum lint` 6/6. No new dependency, no new daemon route, no event-union change, no glossary term, no decision entry.

---

## 1. What changed, file by file

### `packages/shared/src/wire.ts` — AC-1

Gains `WIRE_START_FIELDS` (the five-name tuple in the route's own order), `WireStartRequest` and `wireStartRequestSchema` (`.strict()`, two required, three optional), in the `WIRE_RUN_STATES` / `WireRunState` / `wireRunStateSchema` arrangement the file already uses. The header gains a paragraph recording that this is the first shape here a browser **builds** rather than reads.

The schema deliberately does **not** take over `startRequestOf`'s non-emptiness predicate: `{flow: 'chore', ticket: '   '}` parses here and is refused `missing-field` by the route, which composes a sentence a client reads where `safeParse`'s message is not one of the four codes anything switches on. That split is stated in the docblock and pinned as a property, so a later "tightening" is a visible act.

### `packages/server/src/http.ts` — AC-1

`START_FIELDS` is `new Set<string>(WIRE_START_FIELDS)`. Nothing else moved: `startRequestOf`'s four refusal codes, every sentence it composes and the `unknown-field` remedy's ordered wording are untouched, and **`packages/server/src/http.test.ts` passes unedited** — which is what says this is a register move and not a behaviour change.

### `apps/web/src/daemon-endpoints.ts` — AC-2

`STOP_SEGMENT = '/stop'` written out (an exemption forgiving a string nobody wrote would forgive nothing) and `runStopPath(handle)` beside `runGatePath`, handle percent-encoded into one segment. **No sixth `DAEMON_ENDPOINTS` entry** — `/runs` is already forwarded and covers it, which is the ruling `runGatePath` records for `/gate`.

### `apps/web/src/daemon-client.ts` — AC-3, AC-4

`startRun` and `stopRun`, plus `startRunInFlight` / `runStopInFlight` beside their siblings, and `BROWSER_STOP_REASON`.

They are **two unlike functions, not one shape written twice**, and the requirement's M-1 is why: `POST /runs` answers `201` **with a body**, and the handle is minted inside the daemon and reaches a client there and nowhere else. So `startRun` parses that body through `wireRunSchema` and its `loaded` value is the `WireRun`; the ordering checks `!ok` → `refused`, then `status !== 201` → reported disagreement, then parse — so a `200` carrying a perfectly good run is **reported rather than accepted**, which a schema that accepts the body cannot see. `stopRun` is `answerGate`'s shape exactly: `204` recognised before `response.json()` is ever called.

`ACCEPTED = 204` is one constant for both status-only routes rather than a second literal; `STARTED = 201` is its own, with a docblock saying why the difference is load-bearing.

### `apps/web/src/run-lifecycle.ts` — new, AC-5, AC-9, AC-10

The vocabulary and the one discipline both acts are under: the two refusal registers, the confirmation and outcome sentences, `LOOK_AGAIN_LABEL`, and `useRunMutation`.

**One module rather than two copies beside the screens, and that is a deliberate call I am flagging for the gate.** The requirement describes the discipline twice (AC-9 binds both screens) and does not name a module. Two implementations of a confirm-and-one-in-flight guard are two places for Q-0016's review blocker to come back; one is provable once. The guard is a **ref**, because two activations in one turn both read state as it was before either of them; it is released by the act's own resolution and by nothing else; and a subject change clears rather than attributes.

### `apps/web/src/ticket-page.tsx` — AC-6, AC-7, AC-9, AC-10, AC-12

The start region: every flow whose `consumes` equals the ticket's stage, a dry-walk choice, a confirmation, an outcome. `FLOWS_UNREAD` and `NO_CONSUMING_FLOW` are **imported from `backlog-board.js`** rather than re-worded, as AC-6 specifies. `onNavigate` became a required prop (the board's precedent), and `app.tsx` passes `navigate`.

The body sent is `{flow, ticket, dry}` and the object literal is written at exactly one site with the reasons for the two absent fields beside it.

### `apps/web/src/mission-control-screen.tsx` — AC-8, AC-9, AC-10

`StopControl` and `StopOutcome`. **`StopControl` does not take the snapshot at all** — connection state is not a parameter of it — so *connection state does not decide this* is a property of the signature rather than of a branch nobody re-reads. Offered from `metadata.value.state === 'running'` and absent for `refused` and `ended`.

### Sentences that went false — AC-13

- `mission-control-text.ts`: `EMPTY_RUNS_TEXT`'s first clause moves; **its second survives verbatim** (`quorum run` is still a different process this daemon cannot see), asserted positively so a correction cannot delete what it was not about.
- `daemon-client.ts` header, `gate-screen.tsx` header, `shell.tsx`'s `RUN_FLOW_LABEL` docblock (now a ruling rather than a wait), and `test/source.test.ts`'s `WRITE_RULES` docblock.

### Documents — AC-14

`docs/04-architecture.md` §`apps/web`: all three superseded claims replaced, status line records Q-0130 and 2026-09-17. `docs/05-design-prompt.md`: screen 2's paragraph keeps `No "Run next flow ▸"` and gains where the control went and why not on a card; screen 5 gains a divergence paragraph for the stop button; a new status line.

---

## 2. Guards, and the mutations each was shown red by

`WRITE_RULES`: `'/stop'` → `daemon-endpoints.ts`; `writeOffenders(false)` is three rows; the permitted **module** set is still exactly two; the `toBeNull()` clause is **replaced by one naming the module, not deleted**. Beside it, AC-11's second clause: `writingFunctions(daemon-client.ts)` is exactly `['answerGate', 'startRun', 'stopRun']`, shown red against a fourth writer, against one name swapped for another, and shown not to collect a plain read.

Nine mutations run, each reverted:

| # | Mutation | Result |
|---|---|---|
| A | drop `sending.current` from `confirm` | 2 red — *two activations in one turn issued two starts / two stops* |
| B | `busy: false` | 2 red — *a start control stayed live while one was out* |
| C | delete the `onAccepted` call | 1 red — *the page did not open mission control for the run it started* |
| D | `onAccepted` for any outcome, value from `.value` | **green — see §4** |
| E | `onAccepted` on a refusal with a composed handle | 1 red — *a refused start navigated to a run that never started* |
| F | stop control driven from `snapshot.state` | 1 red — *a ended connection hid the control for a running run* |
| G | drop the `showing.current !== mine` guard | 1 red — *a start about one ticket navigated the screen showing another* |
| H | `START_FIELDS` back to a literal | 1 red — *http.ts writes a second list of the start fields* |
| I | offer only the first consuming flow | 3 red — *the routing choice was taken for the reader* |
| J | `'/stop'` permitted nowhere | 2 red — *a module outside the two named may write* |

---

## 3. Three findings in my own first drafts, recorded rather than quietly fixed

1. **Two assertions could not tell a claim from its denial.** I first forbade the phrase *has ended* in the delivered-stop outcome and *completed* in the `not-running` one. Both went red **on the correct text**, because those sentences carry those words in order to deny inferring them. No needle can separate the two without parsing prose as a contract. Replaced by an identity on the rendered sentence plus a positive property of it (*it defers the question to a read*), with the failure recorded in the test's own comment.

2. **`Promise.all` would have coupled the ticket to the flow listing.** My first `load()` awaited both, which means a flow listing that never answers leaves a reader looking at nothing at all rather than at the ticket they asked for. They settle independently now — and that forced a genuine improvement: the start region has **three** unavailable states rather than AC-6's two, because a listing still out is neither *no flow consumes this stage* nor *the flow list could not be read*, and reporting it as either would be an unanswered question rendered as an answer. **This is stronger than AC-6 asks for and a reviewer should weigh it.**

3. **My server-side needle conflated two different lists.** The first version forbade `'flow', 'ticket'` adjacent and went red on `startRequestOf`'s surviving required-fields predicate — a guard keyed on names rather than on the shape. The subject is *one bracketed list naming all five*, and the three lists that must survive are asserted not to trip it.

---

## 4. Observations for the gate — no criterion covers these

**(a) `onAccepted`'s failure mode is silent.** Mutation D — calling it for any settled outcome — passed, because for a refusal `outcome.value` is `undefined`, `run.handle` throws inside the detached `void (async () => …)()`, and the rejection is swallowed. Under the shipped code it is only ever called on `loaded`, so it cannot happen; but if a later edit widened that guard, the defect would be an unhandled rejection rather than a red test. Reported, not fixed: adding a catch there is defensive code no criterion asks for, and mutation E shows the criterion AC-10 *is* about does discriminate.

**(b) `LOOK_AGAIN_LABEL` moved out of `gate-screen.tsx`** into `run-lifecycle.ts`, with `gate-screen.tsx` importing and re-exporting it so every existing consumer is untouched. Three screens now offer that action for the same reason; the alternative was shipping a duplicate string constant free to drift. It is a change to a file I was sent to edit for AC-13, but it is not a change AC-13 asked for.

**(c) Two existing ticket-page assertions moved**, and a reviewer should check them rather than take them: *"mounting issues exactly three requests"* is now four, and *"a folder of fifty files still costs three"* is four. Both are re-stated as identities where possible, and what they measure is unchanged — a version that fetched what it listed would issue **52** against **4**, so the discriminator is still 48. The flow listing adds the same one on both sides.

**(d) A pre-existing lint warning is unrelated to this change.** `packages/core/src/backlog/backlog.ts:448` — *unused eslint-disable directive*. Last touched by Q-0127; `packages/core` is untouched here and `lint` exits 0 (0 errors, 1 warning).

**(e) GO-4's demonstration is the gate's and is not performed here.** An implement step runs in a worktree with no daemon and no browser. `runs.log` is the harness's to write, and this ticket's whole point is that the obligation is now performable — Q-0016's GO-6 was reported discharged when its by-hand half was not, which is why erratum E-4 phrases it as a transcript.

---

## 5. What I deliberately did not do

Every non-goal in §5 holds. No `--base` and no `--auto` control (the schema accepts both; the browser sends neither, checked). No free-text stop reason. **No start control on the board**, and its *"Nothing on this screen writes"* header is untouched and still true. The shell's *Run flow* control stays disabled; only its docblock moved, from a wait to a ruling. No new daemon route, no change to either POST contract, no change to the gate answer set, no dependency. `docs/decisions/` is untouched — GO-1 ruled no entry owed, and the one answer that would have owed one (OQ-4 answered yes) is ruled no by erratum E-2, so no criterion depended on one being written.
