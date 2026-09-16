# Q-0015 — review verdict, round 1

*Panel: claude (10 findings) and codex (3). Every claim below was re-checked against the branch's own source — `git show harness/Q-0015/integration:<path>` — rather than against either report, including `packages/server/src/http.ts`, which is outside the diff and which decides one of them. Line numbers in this document are the ones that file carries on the branch.*

**Verdict: `revise`.** Ten findings — **4 major, 6 nits, no blockers** — plus one refutation and six observations.

---

## Deduplication

| Reported | Disposition |
| --- | --- |
| claude 1 · codex 1 — trace entries do not name their event type | **Merged → major 1.** Same defect, same file; codex anchors the render, claude the helper. Found independently by both vendors. |
| claude 2 — the gate link can never be re-read | **Survives → major 2.** Distinct from codex 2: that one is staleness *across* a handle change, this one is staleness *within* one. |
| codex 2 — a handle change renders the previous run under the new handle | **Survives → major 3**, verified and its severity qualified below. |
| claude 5 — the register's header still says three ticketless rail entries | **Survives → major 4.** Two sites; T04's own task text required this edit. |
| claude 3 — a Retry replays the daemon's buffer on top of what the browser holds | **Recorded as an observation**, not a finding. Real and user-reachable; cause is untouched code and the remedy is a ruling. See below. |
| claude 4 — the app-selection guard's catch-all fails open | **Downgraded → nit 4.** The verification clause permits *"extended or derived"*, and both named mutations fire. |
| claude 6–10 | **Survive as nits 1, 2, 3, 5, 6**, one citation corrected. |
| codex 3 — the architecture document fabricates runs-list recency | **Refuted.** Evidence below. |

---

## What holds

Checked rather than assumed, because the findings should be read in proportion to what did not go wrong:

- **`WRITE_RULES` is untouched.** `apps/web/test/source.test.ts` still carries `'/stop'` as `permitted: null`, `PUT`/`PATCH`/`DELETE` as `null`, the permitted set as exactly the two named modules, and all three anti-vacuity clauses. That is AC-14's central property and the thing R-6 predicted would be met by deletion. It was not.
- **`partitionTrace` is lossless and first-appearance ordered**, and `Map` insertion order is what carries the column order. `stepId` is a required `z.string()` on all five carrying kinds, so the membership test is safe rather than lucky.
- **The timeline's third disposition is real.** `buildStepTimeline` reads `runEnded` from a `terminal` anywhere in the tail, so a failed step — which emits no `done` — is never reported as running. That is §0.2's measurement honoured.
- **`connect()` resets `events`, `missedCount` and `browserDiscardedCount` synchronously** before opening, and the retention slice builds a new array, so a snapshot already handed out is never mutated. AC-9's immutability half is intact.
- **The gate link derives from `metadata.value.pendingGates`**, never from a streamed `gate` event — §0.7's ruling implemented as written, and the clause that serves the late joiner.

---

## Findings

### major 1 — a trace entry never names its event type, so `warn`, `info` and `gate` are one undifferentiated line

`apps/web/src/mission-control-trace.tsx:25` (`eventLine`), rendered at `:51` in the column and `:76` in the lane. **Found by both reviewers.**

AC-6's first clause is *"Each entry names its event type and renders only fields that event supplies."* The second half is implemented exactly; the first half is implemented nowhere. `eventLine` returns one string per event — `cmd`, `line`, `message`, `reason`, or the stage transition — and the `<li>` renders that string with identical markup and identical classes for every kind.

The run-activity lane is where it lands hardest, because §0.3 measured that most of what the engine says about itself lives there. A fan-out run emits `{type:'info', message:'wave 2: 4 tasks'}`, `{type:'warn', message:'merge conflict in …'}` and `{type:'gate', reason:'review returned revise'}` into it, and the screen draws three visually identical grey monospace lines. Nothing says the second is a warning or that the third is the run **asking a question** — which compounds major 2. In a column, a `done` and a line of vendor stdout are likewise the same thing on screen.

**Nothing is red for it**, and the reason is upstream rather than in the implementation: the frozen contract's *Trace and timeline* section (`contracts/Q-0015/mission-control.contract.md:29–41`) carries losslessness, ordering, latest-observed vendor and React-text rendering, and **does not carry the type clause at all**. The implementer coded against the contract and QA wrote against the contract, so the clause fell out of the change at the point it was frozen.

**Recommendation.** Render the discriminator beside each line in both regions — `event.type` is already in hand and deriving a label from it keeps ground rule 2 intact — and add the assertion AC-6 asked for: a fixture with one `info` and one `warn` whose rendered entries are asserted to differ. See observation 2 about where that assertion may be written.

### major 2 — a gate opened while mission control is watching can never surface its link, and nothing re-reads

`apps/web/src/mission-control-screen.tsx:66`, with `apps/web/src/mission-control-status.tsx`'s `MetadataRegion`.

The read is correct and the channel is the ruled one. What is missing is any way to perform it a second time:

- `readMetadata` is called from one effect whose only mutable dependency is `handle` (`:66`); `request` and `clock` are stable in the browser.
- `MetadataRegion` renders its Retry only under `canRetryRequest(metadata)`, and `request-state.ts:97–108` returns `false` for both `in-flight` and `loaded`.

So on a `live` socket with `loaded` metadata the screen renders **zero** `<button>` elements — which `mission-control-status.test.ts`'s own one-button assertion pins from the other direction. The live sequence therefore fails in full: a reader opens a running run, `pendingGates` is 0 and no link is drawn; the run reaches a gate; the `gate` event arrives on the socket and is rendered as an unlabelled sentence (major 1); the daemon's `pendingGates` is now 1, the browser's copy is still 0, and the only exit is a page reload.

That is the ticket's own user story — *"and — when it stops to ask me something — a way to get to the question"* — failing in the scenario mission control exists for, and it is the loop back to Q-0016 that §0.8 names as one of the two shipped things this ticket makes reachable.

**Recommendation.** The mechanism exists one file away: `runs-screen.tsx` renders an unconditional Refresh beside its request region. Add the same explicit Refresh to the metadata region, or re-run `readMetadata` when an accepted event is a `gate`. Either keeps AC-12's ruled channel — the link still derives from `pendingGates` and never from the event — and is a handful of lines in dev-owned files. **Noted for the gate:** AC-12's letter is satisfied by what shipped; this is a defect against the user story and against the screen's purpose rather than against that criterion's text, so if the gate prefers, an erratum naming the live case is the honest alternative to a fix.

### major 3 — a handle change paints the previous run's trace, run number and gate link under the new handle

`apps/web/src/app.tsx:183`, with `apps/web/src/mission-control-screen.tsx:66`.

Verified in the source: on a handle-to-handle navigation `handle` changes during render while `snapshot` still holds the previous run's events — the controller is retargeted in a passive effect, which React runs after the commit paints. `MissionControlScreen` sits at the same tree position with no `key`, so its `metadata` state survives the change too and is reset only by that same post-commit effect.

For that one painted commit the screen renders, under handle B: A's trace columns, A's timeline, A's terminal `runId` in `data-run-identity` — so the header reads `Run 42` for a run whose handle is B — and, where A reported a pending gate, **an actionable link built by `gatePath(B)` on the strength of A's `pendingGates`**. That last one is a control the reader can click, offered because a different run was waiting.

**Severity, stated so the gate can weigh it rather than take the label:** it is one commit, self-correcting, read-only, and no rendered control navigates handle→handle today — it is reached by browser history or a typed URL. It is a real no-fabrication failure all the same, on the screen whose whole subject is *this* run, and the worst half is cheap to close.

**Recommendation.** `key={handle}` on `MissionControlScreen` resets the metadata half — the wrong gate link and the wrong flow/ticket line — with no contract change and no new state. The snapshot half needs the snapshot to say which handle it belongs to, which widens `RunConnectionSnapshot`, a shape the solution froze; if that is wanted, it is a gate ruling rather than an implementer's choice. Taking the cheap half and recording the rest would be a defensible answer.

### major 4 — the register's own header still claims three ticketless rail entries, and a test title still says three

`apps/web/src/routes.ts:13`, and `apps/web/src/shell.test.ts:175`.

The `/runs` row now carries `ticket: 'Q-0015'`, so the ticketless set is two. That count moved in `shell.test.ts:178`'s assertion (`toStrictEqual(['/projects', '/settings'])`), in `docs/04-architecture.md` (*"for the two rail entries with no ticket"*) and at `routes.ts:146` (*"The two rows carrying `ticket: null`"*) — and was left standing in the **module header of the register all three are derived from**, which still reads *"three rail entries have no ticket at all"*.

This is not a discretionary tidy: **T04's own task text required it** — *"update the nearby JSDoc from three ticket-null rows to two"* — and one of that file's two sentences was updated while the other was not. It is the fix-the-instance-not-the-class shape this repository records most often, and it survives because it changes no behaviour: a reader who opens `routes.ts` to learn the register's shape meets a false count in the file that defines it.

The second site is the same claim wearing a test's name: `shell.test.ts:175` is titled *"the register has three ticketless screens, so the clause above discriminates"* over an assertion listing two, so the test now says one thing and checks another.

**Recommendation.** Correct both to two in the same change. See observation 2 for the second site's ownership.

---

## Nits

**nit 1 — `apps/web/src/runs-screen.tsx:46`.** A sixth in-flight helper is declared inside a screen rather than beside its five siblings. `daemon-client.ts` already exports `ticketsInFlight`, `flowsInFlight`, `ticketInFlight`, `ticketFileInFlight`, `runInFlight` and `gateAnswerInFlight`, and `mission-control-screen.tsx` imports `runInFlight` from there — so the divergence is visible inside one ticket. The JSDoc is candid about it, which is why this is a nit; it is still a second place a request's in-flight state is composed. Move it to `daemon-client.ts` as `runsInFlight`.

**nit 2 — `apps/web/src/mission-control-status.tsx:97`.** `const daemon = snapshot.missedCount !== null && snapshot.missedCount > 0` hoists the predicate out of the use site, so the render needs `snapshot.missedCount as number` to compile. The cast is correct today and would stay silent if the predicate were later edited — `daemonMissedText(null as unknown as number)` renders *"The daemon omitted null earlier events…"*, which is the fabricated-value class AC-11 forbids, delivered by a cast rather than by a branch. `const missed = snapshot.missedCount; … missed !== null && missed > 0 ? …` narrows without one.

**nit 3 — `apps/web/src/mission-control-status.test.ts:35`.** The lexical-distinction clause checks one direction only: `[...words(daemonMissedText(7))].some((word) => !words(browserDiscardedText(7)).has(word))`. The frozen contract says *"each contains at least one word absent from the other"*, so an edit making the browser sentence a strict subset of the daemon one — losing the `browser`/`discarded`/`bounded` vocabulary AC-10 rests on — passes. Assert both directions.

**nit 4 — `apps/web/test/routes.test.ts:139`.** The app-selection loop maps each `screenExists` row to a constant name through a ternary chain whose final arm is an unguarded default (`… : 'RUN_ROUTE'`). When a sixth row is added with `screenExists: true`, the identity assertion at `:131` fails and is updated — the visible act — while nothing forces the ternary, so the new row falls through to `'RUN_ROUTE'`, `app.tsx` already contains that string, and the loop passes for a screen `app.tsx` may never select. **Downgraded from the reported major**, because the solution's verification clause reads *"extended **or** derived from every register row"* and both named mutations do fire today: requiring derivation is raising the job that clause gave the instrument. Worth closing anyway — carry the constant's name on the register row, or map path → name with an explicit `throw` on a path the map does not hold. *Same file, `:143`:* the anti-hardcoding clause is still `.not.toMatch(/['"`]\/backlog/)`, so in the ticket that added two `/runs` routes to `app.tsx` it covers one of five registered screen paths.

**nit 5 — `apps/web/test/source.test.ts:180`** *(the reported citation was `:318`; the guard is at `:180`)*. The socket-factory guard keys offenders on `/initialPath:\s*['"`]\/runs\//` — an inline literal. The new `mission-control-screen.test.ts` renders through an `app(path)` helper passing `initialPath: path`, a variable, so none of its four run-route renders is examined. All of them do supply a `socketFactory`, so nothing is broken; the guard has simply stopped covering the package's newest instances of the thing it exists to prevent — a suite whose verdict depends on whether anything is listening on port 3000. Widen the scan to renders whose `initialPath` is not a literal and report them unless a factory is present.

**nit 6 — `apps/web/test/routes.test.ts:242`.** The `/runs` replacement `waitingFor` is pinned by `length > 60` twice and a trailing period, plus the negatives one test up. That keeps an emptied field from passing and asserts nothing about *this* sentence, so any 61-character sentence satisfies it — including one describing a screen that no longer exists. Keep the floor as the anti-emptying clause and add one positive needle from the shipped text, as the gate row's `.toContain('Q-0129')` does.

---

## Refuted

**codex 3 — *"the architecture documentation fabricates runs-list recency"* (`docs/04-architecture.md`).** The finding says the daemon *"deliberately preserves daemon response order without sorting"* and that calling it newest-first turns an unmeasured ordering into a guarantee. Measured in the daemon's own source, which is outside this diff and is where the answer lives:

- `packages/server/src/http.ts:186` — *"The runs a client can join, **newest first**. **Order is specified because it is the only recency…**"*
- `packages/server/src/http.ts:197` — `.reverse()` on the host enumeration.
- `packages/server/src/host.ts:409` — *"A reader wanting recency reverses it; reversing here would make the method's own name a lie"*, which is why the reversal is the route's and not the host's.
- Q-0121's own record pins it: *"dropping `.reverse()` fails AC-3"*.

So newest-first **is** the daemon's specified contract, and the architecture sentence describes it rather than deriving it. AC-2's rule is that *the browser* must not re-sort, and it does not: `runs-screen.tsx` renders in response order and its header says why. The finding conflates the browser's prohibition with a description of the producer's contract. No change is owed.

---

## Observations

*True and worth recording, and not claims about this change — per "A finding is a claim about the change; anything else is an observation" (2026-09-11). None of them contradicts the verdict.*

**observation:** `retry()` (`run-connection.ts`) closes and reopens the socket without clearing `events`, while `broadcast.ts` documents `subscribe()` as *"replaying what is retained"* — so a Retry appends the daemon's retained prefix on top of what the browser already holds and the rendered trace doubles. This is untouched Q-0120 behaviour whose module header argues the trade deliberately, and until this ticket the only consumers were `.at(-1)` and `.length`; what is new is that the list is now drawn, and that the screen renders the Retry that reaches it. It is not filed as a finding because the remedy is a choice no implement step may make: clearing on retry is right *if* the daemon can still replay everything the browser held, and loses the head otherwise, which is a behaviour ruling. **It belongs at the gate**, and the implement report should have carried it — engineering.md asks for a defect found in code you are already changing to be reported, and Q-0117's `observation:` tag is the channel that now exists for exactly that.

**observation:** Five of the ten surviving items sit in files the development fan-out may not write. The solution's own boundary says *"Development tasks must not modify `apps/web/src/**/*.test.ts`, `apps/web/test/**/*.test.ts`"* and `qa-red` consumes `solutioned`, so it cannot be re-entered from `green`. That reaches nit 3, nit 4, nit 5, nit 6 and the second site of major 4 — and, more consequentially, **major 1's missing assertion**, whose production half is dev-owned and whose test half is not. This is Q-0120's recorded structural finding arriving a second time on the same surface: *a review verdict can name a surface the development flow may not write*. The gate has to route it — an erratum widening the round's write paths, or the hand repair Q-0120 recorded — rather than a revise round discovering it.

**observation:** The frozen contract at `contracts/Q-0015/mission-control.contract.md:29–41` does not carry AC-6's *"names its event type"* clause. The gap originates in solutioning rather than in implementation, which is why it survived both the implementer and QA; whatever else is decided about major 1, the contract is the site that made it invisible.

**observation:** `docs/06-development-plan.md`'s Q-0015 bullet still reads `requirements`, which AC-14 names as moving. `solution/errata.md` SE-3 and task T10 rule that page the human's and forbid the implementer touching it, because it carries costs, round counts and findings that do not exist until a run has ended. The deferral is deliberate and correctly recorded; it is named only so the gate does not read AC-14 as fully discharged by the diff.

**observation:** AC-14's demonstration clause — the hand `POST /runs` that produced the run, its observed event count and its peak concurrent-column count — is not verifiable from the branch, and AC-9's stated rationale and Appendix A(b)'s revisit both depend on it. It would be this repository's first per-run event count. Q-0016's own entry records that exact obligation being reported as discharged when the by-hand half had not been performed, so it is worth transcribing the request rather than paraphrasing the result.

**observation:** The five new `.test.ts` files under `apps/web/src` are written with several statements per physical line; `mission-control-screen.test.ts`'s `app()` helper is one line of roughly 700 characters. They are correct and they run, and this repository has no line-length rule to cite. It is recorded once because a reviewer cannot read a 700-character line at the rate it can read a formatted one, and because a later ticket will have to re-aim these files.

---

## What I could not check

I did not execute the suite, `pnpm lint` or `pnpm typecheck`; this is a read-only review and those verdicts belong to `integrate` in both environment rows. Majors 1, 2 and 3 are behavioural and were established by reading the shipped paths end to end — none of them is a test that fails today, which is the point of major 1 (a criterion clause with no test), of major 2 (behaviour no criterion's letter reaches) and of major 3 (a transient no criterion anticipated).

**Neither review reported a truncated diff**, and R-4 predicted one. Both reports discuss files at both ends of `git diff`'s path ordering — `apps/web/src/app.tsx` through `docs/04-architecture.md` — and neither carries the `observation:` that Q-0016's reviewers used to disclose compensating for a cut, so on the evidence available the panel saw the whole change. GO-6 should record the measured byte figure either way.
