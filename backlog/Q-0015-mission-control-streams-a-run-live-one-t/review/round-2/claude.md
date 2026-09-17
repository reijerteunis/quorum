# Q-0015 — code review, round 2

*Panel member: claude. **Every claim below was re-derived from the branch's own source** — `git show harness/Q-0015/integration:<path>` at tip `a965076` — rather than from the supplied patch, including three files outside the diff that decide findings: `packages/shared/src/events.ts`, `packages/shared/src/wire.ts` and `apps/web/src/request-state.ts`. Line numbers are the ones each file carries on the branch. I read `review/round-1/verdict.md` before the code, so §2 reports which of its ten items closed and which did not; nothing already ruled or refuted there is re-raised as a finding.*

**Recommended verdict: `revise`. Eleven findings — 0 blockers, 4 majors, 7 nits — plus four observations.**

Two of the four majors are new defects in round 1's own fixes, which is the shape worth naming at the top: **major 1 is the fix for round 1's nit 5 arriving with no subject**, and **major 2 is a false sentence that only becomes false once the run number the screen now renders exists.** The other two are a field the screen loads and throws away, and a guard weakened further than its own measurement justifies.

---

## 1. What holds

Checked rather than assumed, because the findings should be read in proportion to what did not go wrong.

- **All four of round 1's majors are closed, in the code and not only in prose.** `EventLine` (`mission-control-trace.tsx:52-58`) renders `event.type` beside the payload in both regions; `MetadataRegion` (`mission-control-status.tsx:88-93`) offers a *Check again* control on a `loaded` read, so the live gate sequence has an exit; `App` carries both halves of major 3's remedy — `key={handle}` on the screen (`app.tsx:194`) and a `connectedHandle` guard (`app.tsx:117`, `:162`) that keeps the previous run's snapshot off the new handle's first commit; and `routes.ts:13` and `shell.test.ts:175` both say **two** ticketless entries.
- **`WRITE_RULES` is still untouched.** `'/stop'` is `permitted: null`, `PUT`/`PATCH`/`DELETE` are `null`, the permitted set is exactly `daemon-client.ts` and `daemon-endpoints.ts`, and all three anti-vacuity clauses read as they did. That is AC-14's central property and what R-6 predicted would be met by deletion; it was not, twice now.
- **The membership test in `partitionTrace` is safe rather than lucky**, and I verified it in the schema rather than inferring it: `eventSchema` (`packages/shared/src/events.ts:239-249`) extends `spawn`, `stdout` and `retry` with a **required** `stepId: z.string()`, and `info`, `warn`, `gate` and `terminal` carry no such key at all — so `'stepId' in event` is a total discriminator and the `null` branch can only be reached by those four kinds.
- **The retention is bounded and the immutability was not traded for it.** `run-connection.ts:163-168` spreads then slices, so per-event work is bounded by 500 rather than by the run's length, and a snapshot already handed out is never mutated; `connect` resets `events`, `missedCount` and `browserDiscardedCount` together (`:210-214`).
- **Round 1's major-3 fix was tested at the commit under dispute rather than after it.** `mission-control-screen.test.ts`'s third case observes the DOM from inside the fetcher the screen's own effect calls, and asserts `seen.length > 0` first. That is the harder of the two available shapes and it is the right one.
- **The gate link still derives from `metadata.value.pendingGates`** (`mission-control-status.tsx:145`) and never from a streamed `gate` event — §0.7's ruling, and the clause that serves the late joiner.

---

## 2. Round 1's ten items, dispositioned

| Round 1 | Status on this branch |
| --- | --- |
| major 1 — a trace entry never names its event type | **Closed.** `mission-control-trace.tsx:52-58`, with a test asserting both `info`/`warn` in the lane and `step`/`done` in a column over identical messages. |
| major 2 — the gate link can never be re-read | **Closed.** `mission-control-status.tsx:88-93`. |
| major 3 — a handle change paints the previous run | **Closed, both halves**, and by the cheap remedy plus the `connectedHandle` guard rather than by widening `RunConnectionSnapshot`. |
| major 4 — the register header still says three | **Closed** at both sites. |
| nit 1 — a sixth in-flight helper inside a screen | **Unchanged and unruled** → nit 5 below. |
| nit 2 — the `as number` cast in `LossRegion` | **Closed.** Destructured at `mission-control-status.tsx:107`, no cast. |
| nit 3 — the lexical clause checked one direction | **Closed.** Both directions, `mission-control-status.test.ts:38-42`. |
| nit 4a — the app-selection ternary's unguarded default | **Closed**, with an explicit `toBeDefined()` on an unmapped path → but see nit 3 below for what the fix cost the message. |
| nit 4b — the anti-hardcoding clause covers one of five paths | **Unchanged and unruled** → nit 5 below. |
| nit 5 — the socket-factory scan does not examine a variable path | **The subject moved rather than closing** → **major 1**. |
| nit 6 — the `/runs` `waitingFor` pinned only by length | **Closed.** `routes.test.ts:257` adds a positive needle. |

---

## 3. Findings

### major 1 — the fails-closed socket-factory scan is demonstrated by nothing: its fixture still runs the predicate it replaced

`apps/web/test/source.test.ts:184-204`.

Round 1's nit 5 asked for the scan to fail closed on a render whose `initialPath` is not a literal. It now does, at `:194`:

```js
return literal === undefined ? !text.includes('socketFactory') : literal.includes('/runs/');
```

**The clause that proves the scan fires and discriminates was not moved with it.** `:202-204` computes its expectation with the *old* predicate, inlined verbatim:

```js
.filter((props) => /initialPath:\s*['"`]\/runs\//.test(props) && !props.includes('socketFactory'))
```

So the guard runs one predicate and its demonstration runs another, and **the entire new branch is covered by no assertion**. `:197` expects `offenders` to be `[]` over the real corpus, which is a pass and therefore establishes nothing about a branch; and every fixture at `:200-201` supplies a literal `initialPath`, so `literal === undefined` is never once evaluated by an assertion in this file.

**Failure scenario, concrete.** Replace `:194`'s fallback with `return false` — restoring precisely the "not examined at all" hole nit 5 was filed for — and this file stays green: `offenders` is still `[]`, `:200`'s render count is still 1, and `:202-204` still returns `['fixture.ts']` because it never calls the code that changed. The same is true of inverting the fallback to `text.includes('socketFactory')`, which would make the guard report every correctly-injected render and nothing else. *"A check is not established by reading it"* (2026-08-29), inside the repair for a finding about a check that could not see its subject.

**Recommendation.** Lift the predicate into one named function and call it from both the corpus scan and the fixture clause, so the two cannot drift again. Then add the fixture the new branch needs: one file text whose render is `createElement(App, { initialPath: path })` **with** `socketFactory` somewhere in the text (not reported) and one **without** (reported), each shown red against the pre-fix predicate. That is two array entries and it is what makes round 1's nit actually closed.

### major 2 — after a terminal event the screen renders the run's number and, beside it, the sentence saying the number is not available

`apps/web/src/mission-control-status.tsx:169-171`, against `contracts/Q-0015/mission-control.contract.md:59-62`.

`MISSION_CONTROL_DISCLOSURES` is mapped unconditionally:

```jsx
<ul … data-mission-control-disclosures>
  {MISSION_CONTROL_DISCLOSURES.map((disclosure) => <li key={disclosure}>{disclosure}</li>)}
</ul>
```

while `data-run-identity` (`:133-135`) switches from the handle to `terminalRunId(snapshot.events)` the moment a terminal event is in the tail. The frozen contract says what should happen instead, in as many words: *"The handle identifies a live run; a terminal-provided run number **replaces that explanation** only after it exists."*

**Failure scenario.** A run ends while the reader is watching. `data-run-identity` reads `Run 42`. Four lines below it, disclosure 1 still reads *"The run's number is not on the wire until the run ends; its handle identifies it meanwhile."* The screen is simultaneously showing the number and explaining that it has no number, and the second half of that sentence — that the handle identifies the run — is no longer what the screen is doing. On the one screen in this product whose stated discipline is ground rule 1, *no fabricated value, anywhere*, the mirror failure is a disclosure outliving its subject.

**Nothing is red for it, and the reason is the criterion's instrument rather than the implementation.** AC-11's *Test:* clause asks to *"assert the five sentences on a live-run fixture"* and separately that the identity region *"shows the handle before a `terminal` and the number after one"* — two clauses that are each satisfied, by two different fixtures, with the contradiction between them unasserted. `mission-control-status.test.ts`'s disclosure case uses `states[2]` (`live`) and its identity case uses `states[5]` (`ended`); no case renders both regions on one terminal-bearing snapshot.

**Recommendation.** Render disclosure 1 only while `terminalRunId(snapshot.events) === null` — the value is already computed in the same file at `:47` and already consumed at `:131`. Then assert, on the `ended` fixture that already exists, that `data-mission-control-disclosures` holds four sentences and that disclosure 1 is absent; and keep the five-sentence assertion on the live fixture, which is what discriminates the two. If the gate prefers the sentence to stay, then the contract's *"replaces that explanation"* clause is what moves, and it moves by erratum rather than by being read past.

### major 3 — the screen loads the daemon's own account of the run and discards `state` and `refusal`

`apps/web/src/mission-control-status.tsx:120-146` (`Header`), against `packages/shared/src/wire.ts:139-155`.

`MissionControlScreen` performs a `GET /runs/:handle` and hands the whole `WireRun` to `MissionControlStatus`, which reads exactly three of its six fields: `pendingGates` for the link, `flow` and `ticketId` for the header line. **`state` and `refusal` are never rendered anywhere on the screen.**

**Failure scenario, reachable today.** A run is running; the socket drops. `connection-state.ts:113-114` renders *"Fell behind the daemon's replay buffer and was disconnected."* — a true statement about this browser's transport and **not** an answer to the question the screen exists for. `metadata.value.state` is `running`, loaded, in memory, and rendered nowhere; the metadata region shows only `requestStateText`, which says *"Loaded from the daemon, as of …"*. So on the hero screen a reader who has just lost the socket cannot tell a run that is still going from one that has finished, while the answer is in the object the screen fetched. `interrupted` is the same case. The glossary makes the distinction explicitly — *"It is not **run state**: connection state describes this browser's transport and can change without changing the daemon run"* — and this screen renders only the half that is about the transport.

`refusal` is the same omission and is the sharper one on the record, though harder to reach: `wire.ts:128-137` says that field was added at Q-0016 precisely because *"a `refused` row said only that the start never happened … which is a surface admitting a gap where the daemon's own words were one field away."* Mission control is now a surface doing that. I state the reachability honestly: `GET /runs` excludes refused rows and `POST /runs` discloses no handle for one, so a refused handle arrives here only by being typed.

**Severity, stated so the gate can weigh it rather than take the label.** No acceptance criterion names either field — AC-8 is about `ConnectionState`'s nine members and AC-2's state rendering is the *landing's*. So this is a defect against the screen's purpose and against §2's user story (*"I want to see what it is doing"*) rather than against a criterion's text, which is the shape round 1's major 2 had and which the gate resolved by fixing. The remedy is one line in `Header` for `state` and a three-line block for `refusal`, both in a dev-owned file.

### major 4 — the AC-6 parse guard was weakened for all three fields when only one needed it, and the forms a parser would actually write escape it

`apps/web/test/source.test.ts:60-61`, frozen at `contracts/Q-0015/mission-control.contract.md:37-42` by `solution/errata.md`'s AC-6 ruling.

The erratum is right that bare `role=` cannot hold: it matches `apps/web/src/backlog-board.test.ts:530`'s `[role="progressbar"]`, a legitimate accessibility assertion. **Its conclusion is wider than its measurement, and the measurement is one command.** On this branch, under `apps/web/src`:

| bare needle | occurrences |
| --- | --- |
| `cost=` | **0** |
| `verdict=` | **0** |
| `role=` | 1 — `backlog-board.test.ts:530`, the selector |

So two of the three fields had no false positive to avoid and were narrowed anyway, and the contract's claim that the twelve needles *"preserve AC-6's prohibition"* is not true of them.

**Failure scenario.** The twelve needles are each of `cost=`, `role=`, `verdict=` prefixed by `'`, `"`, `` ` `` or `/`. None of these matches:

- `/\bcost=(\S+)/.exec(done.message)` — the character before `cost=` is `b`;
- `/^cost=/` — it is `^`;
- `message.split(' cost=')[1]` and `message.includes(" cost=")` — a space sits between the quote and the needle.

The last is not a contrived form: `formatCost` composes `cost=$0.123` **inside a larger message with a leading space** (`steps.ts:127-133`, `:353`), so `' cost='` is the likeliest literal anyone parsing it would type. A future ticket can therefore parse the cost out of a `done` message, breach ground rule 2, and pass this guard — which is the one check standing behind that rule, in the ticket that wrote the rule down.

**Recommendation.** Keep `cost=` and `verdict=` **bare** and apply the four-delimiter narrowing to `role=` alone (or, better, exempt `backlog-board.test.ts:530` by line and keep all three bare). The needle count moves from twelve to six, the existing two-direction fixture still demonstrates both halves — the template-literal `` `cost=$0.123` `` is still rejected and `[role="progressbar"]` still accepted — and the escape closes. The contract sentence at `:37-42` and the errata ruling move with it, which is a gate act rather than an implementer's; the requirement's own AC-6 *Test:* clause asked for the bare needles, so nothing is being raised beyond what that clause specified.

---

## Nits

**nit 1 — `apps/web/src/runs-screen.tsx:15` and `:30-36`: two claims with no subject, in one file.** The module JSDoc says `NO_TICKET_ID_TEXT` is imported *"so the ticket page's and this screen's wording cannot drift apart"* — measured, **nothing else in the app imports it** and that sentence occurs nowhere else in `apps/web`, `ticket-page.tsx` included, so there is no second site to drift from. And `RUNS_HEADING`, `REFRESH_LABEL` and `RETRY_LABEL` are exported with *"so a test and the view cannot disagree about what this screen is"*, while `runs-screen.test.ts` imports none of the three and finds the Refresh control by `view.querySelector('button')` — positional, and satisfied by whichever button renders first. Either import the labels in the test, or state the reason the exports actually have.

**nit 2 — `apps/web/src/mission-control-text.ts:21`: the cost disclosure is false of the aggregate.** It reads *"Per-vendor cost and token totals are unavailable as structured values; they occur only inside a human-readable message."* The first clause is exact. The second is not: `runTerminalEventSchema` (`packages/shared/src/events.ts:200-208`) carries `cost: z.number()` and `tokens: z.number()` as required structured fields, on the terminal event **this screen already reads** for `runId`. Nothing renders them and AC-6 forbids it, so no behaviour is wrong — but Q-0131 and Q-0129 will both read this sentence as a measurement of what the wire carries, and it under-reports it. Narrow the second clause to the per-vendor split.

**nit 3 — `apps/web/test/routes.test.ts:149`: the strengthened clause lost its message.** `` `the app does not select ${route} by the register's own constant` `` interpolates the *row object*, so the failure now reads *"the app does not select [object Object]…"*; the ternary chain it replaced interpolated the path string. Use `route.path`. (`NAMES` is also rebuilt on every iteration of the loop it sits inside — move it out.)

**nit 4 — `apps/web/src/runs-screen.test.ts:28`: AC-2's second half is unasserted.** Both the criterion (*"asserts no other row's ticket id appears on it"*) and `qa/run-3/scenarios-iter-2.md:126` require it; the shipped clause asserts the sentence on row 0 and `'Q-0015'` on row 1, and never that row 0 is free of row 1's id. One `expect(links[0]?.parentElement?.textContent).not.toContain('Q-0015')` closes it, and it is the half that catches a renderer leaking a sibling row's value.

**nit 5 — round 1's nit 1 and nit 4b are unchanged and no erratum rules them.** `runs-screen.tsx:46` still declares `runsInFlight` inside the screen, beside five siblings exported from `daemon-client.ts` — and `mission-control-screen.tsx` imports `runInFlight` from there, so the divergence is visible inside one ticket. `routes.test.ts:151` is still `.not.toMatch(/['"`]\/backlog/)`, covering one of the **five** registered screen paths in the ticket that added two more. Both are cheap; they are listed so the gate does not read them as closed.

**nit 6 — `apps/web/src/shell.test.ts:192-197`: the run-route renders inject no `fetcher`, and the guard has no clause for one.** Eight renders of `App` at `/runs/run%20one` in that file pass `socketFactory` and `pageUrl` and nothing else, so `MissionControlScreen` falls back to `browserFetch` (`daemon-client.ts:85`, a bare `fetch(path)`). Today that is harmless and deterministic — I checked it rather than assuming: Node's `fetch` rejects a relative path with *"Failed to parse URL from /runs/run%20one"*, so the screen lands on `unreachable` and no connection is made. What makes it worth a line is the comment four lines above the first of those renders, which records Q-0120 round 1's M-5 for the **socket** half in this repository's own words — *"a test doing different work depending on what else is running on the machine"* — and the fact that `source.test.ts`'s guard enforces `socketFactory` on a run-route render and has no counterpart for `fetcher`. This ticket is what made `/runs/:handle` a *fetching* route, so the symmetric hazard now exists and is held off only by an accident of the ambient `fetch`. One prop on each render, and one clause beside the existing one.

**nit 7 — two dead type imports, and nothing in the toolchain sees them.** `mission-control-status.test.ts:2` and `runs-screen.test.ts:2` both import `type ReactElement` and neither uses it (`mission-control-trace.test.ts:2` does). `tsconfig.base.json` sets no `noUnusedLocals` and `eslint.config.js` enables exactly three rules, none of them `no-unused-vars`, so this ships silently either way — which is why it is a nit and not a broken gate.

---

## Observations

*True and worth recording, and not claims about this change — per "A finding is a claim about the change; anything else is an observation" (2026-09-11). None contradicts the recommendation above.*

**observation:** round 1's first observation is still open and still not a finding. `retry()` in `run-connection.ts` closes and reopens without clearing `events` while `broadcast.ts` documents `subscribe()` as replaying what is retained, so a Retry appends the daemon's retained prefix on top of what the browser holds and the rendered trace doubles. It is untouched Q-0120 behaviour; what this ticket changed is that the list is now drawn and the screen renders the Retry that reaches it. The remedy is a behaviour ruling — clearing is right only if the daemon can still replay everything the browser held — so it belongs at the gate, and it survived a full round without one. **The retention bound this ticket added makes it slightly worse**, because the eviction counter is not reset by `retry()`, only by `connect()`.

**observation:** `contracts/Q-0015/mission-control.contract.md`'s *Trace and timeline* section (`:29-46`) **still carries no "names its event type" clause**, though the code and a test now implement it. Round 1's third observation identified that section as the site that made major 1 invisible to both the implementer and QA; the code moved and the frozen contract did not, so the next reader of the contract inherits the same gap. The contract is not a dev-owned file, which is why this is an observation.

**observation:** AC-14's demonstration clause — the hand `POST /runs` that produced the run, its observed event count and its peak concurrent-column count — is still not verifiable from the branch, and both AC-9's stated rationale and Appendix A(b)'s revisit depend on that count being recorded. Q-0016's own entry records this exact obligation being reported as discharged when the by-hand half had not been performed. The request should be transcribed rather than the result paraphrased.

**observation:** `docs/06-development-plan.md`'s Q-0015 bullet still reads `requirements`, which AC-14 names as moving. `solution/errata.md` SE-3 and task T10 rule that page the human's and forbid the implementer touching it. The deferral is deliberate and correctly recorded; it is named only so AC-14 is not read as fully discharged by the diff.

---

## What I could not check, and one measurement for GO-6

I did not execute the suite, `pnpm lint` or `pnpm typecheck`; this is a read-only review and those verdicts belong to `integrate` in both environment rows. Majors 2, 3 and 4 and major 1's failure scenario were established by reading the shipped paths end to end against the branch — **none of them is a test that fails today**, which is the point of all four: major 1 is a check with no subject, major 2 is a contradiction no fixture renders at once, major 3 is behaviour no criterion's letter reaches, and major 4 is a guard weaker than its own stated claim.

**On R-4: I was handed no truncation notice and I did not rely on the patch in any case** — every file I cite was read from `harness/Q-0015/integration` directly, including the three outside the diff that decide majors 3 and 4 and nit 2. So this report covers the whole change, and GO-6 should still record the measured byte figure, because the absence of a notice in one reviewer's prompt is not a measurement of the cap.
