# Q-0015 — review verdict, round 2

*Panel: claude (11 findings, 4 observations) and codex (2 findings). Every claim below was
re-derived from `harness/Q-0015/integration` at tip **`a965076`** with `git show`, not taken from
either report — including the three files outside `apps/web` that decide the disagreement
(`packages/server/src/http.ts`, `packages/server/src/host.ts`, `packages/shared/src/events.ts`).
Line numbers are the ones each file carries on the branch.*

**Verdict: `revise`. Four majors survive, with nine nits and six observations.**

The two members overlap on nothing: claude's findings are all in `apps/web`, codex's two are both on
one line of `docs/04-architecture.md`. So this verdict is adjudication rather than deduplication, and
the one place the panel is wrong is worth reading first.

---

## 1. The one disagreement, settled by measurement

**Codex's major is refuted.** It says `docs/04-architecture.md:338`'s *"newest first"* clause is
false, reasoning that the screen preserves response order while `RunHost.runs()` returns `Map`
insertion order, so the listing is oldest-first. The first half of that is right and the second half
skips a step: the **route** sorts, not the host.

```
packages/server/src/http.ts:186  // The runs a client can join, newest first. **Order is specified
packages/server/src/http.ts:194  app.get('/runs', (c) => c.json({
packages/server/src/http.ts:195    runs: [...host.runs()]
packages/server/src/http.ts:196      .filter((view) => LISTED_BY_STATE[view.state])
packages/server/src/http.ts:197      .reverse()
```

`host.runs()` (`packages/server/src/host.ts:411`) is deliberately unordered projection; `.reverse()`
at `http.ts:197` is where recency is applied, and Q-0121's own entry records dropping it as a
red-by-mutation case. So a screen that re-sorts nothing renders newest-first, AC-2 is satisfied, and
the document's claim was true. **Refuted, not carried.**

Its underlying editorial point — that the sentence sat in the `apps/web` section and read as though
the *screen* derived recency — was answered on the branch by `a965076`, which attributes the order
to the daemon and cites AC-2 in place. That commit landed **between** the two panel members'
readings, which the gate should know when it decides what a round 3 would be reviewing.

**Codex's nit survives** and is carried below. Everything else here is claude's.

## 2. Round 1's ten items

Verified rather than accepted: round 1's four majors are closed in code — `EventLine` names
`event.type` (`mission-control-trace.tsx:52`), `MetadataRegion` offers *Check again* on a loaded read
(`mission-control-status.tsx:90`), `app.tsx:194` carries `key={handle}` with the `connectedHandle`
guard beside it, and both register headers say **two**. Nits 2, 3, 4a and 6 are closed. Nit 5's
subject **moved rather than closing** and is major 1 below; nits 1 and 4b are unchanged and are
carried as nits 5 and 6.

`WRITE_RULES` is untouched — `'/stop'` is still `permitted: null`, `PUT`/`PATCH`/`DELETE` still
`null`, the permitted set still exactly the two named modules, all three anti-vacuity clauses intact.
That is AC-14's central property and R-6's named hazard, and it has now held twice.

---

## 3. Findings

### major 1 — the fails-closed socket-factory scan is demonstrated by nothing; its fixture clause still runs the predicate it replaced

`apps/web/test/source.test.ts:202`

Round 1's nit 5 asked the scan to fail closed on a render whose `initialPath` is not a literal, and
the guard now does, at `:194`:

```js
return literal === undefined ? !text.includes('socketFactory') : literal.includes('/runs/');
```

The clause that proves the scan fires and discriminates did not move with it. `:202–204` computes its
expectation with the **old** predicate, inlined verbatim:

```js
.filter((props) => /initialPath:\s*['"`]\/runs\//.test(props) && !props.includes('socketFactory'))
```

**Failure scenario.** Replace `:194`'s fallback with `return false` — restoring exactly the
*not examined at all* hole nit 5 was filed for — and this file stays green: the corpus assertion at
`:197` is still `[]` (a pass, which establishes nothing about a branch), the render-count clause is
unchanged, and `:202` still returns `['fixture.ts']` because it never calls the code that changed.
Inverting the fallback to `text.includes('socketFactory')`, which would make the guard report every
correctly-injected render, is equally invisible. Every fixture at `:200–201` supplies a literal path,
so `literal === undefined` is never once evaluated by an assertion in this file.

*"A check is not established by reading it"* (2026-08-29), inside the repair for a finding about a
check that could not see its subject.

**Recommendation.** Lift the predicate into one named function called by both the corpus scan and the
fixture clause, so the two cannot drift again; then add the two fixture entries the new branch needs
— a render with a variable `initialPath` in a text that **does** contain `socketFactory` (not
reported) and one that does not (reported) — each shown red against the pre-fix predicate.

### major 2 — after a terminal event the screen renders the run's number and, beside it, the sentence saying the number is not available

`apps/web/src/mission-control-status.tsx:169`

`MISSION_CONTROL_DISCLOSURES` is mapped unconditionally, while `data-run-identity` (`:133–134`)
switches from the handle to `terminalRunId(snapshot.events)` as soon as a terminal event is in the
tail. The frozen contract says the opposite, in as many words:

```
contracts/Q-0015/mission-control.contract.md:61  The handle identifies a live run; a terminal-provided
                                                  run number replaces that explanation only after it exists.
```

**Failure scenario.** A run ends while the reader is watching. `data-run-identity` reads `Run 42`.
Four lines below it, disclosure 1 still reads *"The run's number is not on the wire until the run
ends; its handle identifies it meanwhile."* The screen shows the number and explains that it has
none, and the clause about the handle standing in for it is no longer what the screen is doing. On
the one screen whose stated discipline is ground rule 1, a disclosure outliving its subject is that
rule's mirror failure.

**Nothing is red for it, and the cause is the instrument rather than the implementation.** AC-11's
*Test:* clause asks for the five sentences on a live-run fixture and, separately, for the identity
region to show the handle before a `terminal` and the number after one — two clauses each satisfied
by a different fixture, with the contradiction between them unasserted. The status suite's disclosure
case uses the `live` state and its identity case uses `ended`; no case renders both regions on one
terminal-bearing snapshot.

**Recommendation.** Render disclosure 1 only while `terminalRunId(snapshot.events) === null` — the
value is already computed at `:126` and already consumed at `:134` — and assert on the existing
`ended` fixture that the list holds four sentences with disclosure 1 absent, keeping the
five-sentence assertion on the live fixture as the discriminator. If the gate prefers the sentence to
stay, the contract's *"replaces that explanation"* clause is what moves, and it moves by erratum
rather than by being read past.

### major 3 — the screen loads the daemon's own account of the run and discards `state` and `refusal`

`apps/web/src/mission-control-status.tsx:128`

`MissionControlScreen` performs `GET /runs/:handle` and hands the whole `WireRun` to
`MissionControlStatus`, which reads exactly three of its six fields — `pendingGates` at `:128`,
`flow` at `:138`, `ticketId` at `:139`. Confirmed by search: `metadata.value` is consumed nowhere
else under `apps/web/src`, and `WireRun.state` and `WireRun.refusal` are rendered nowhere on this
screen.

**Failure scenario, reachable today.** A run is running; the socket drops. The connection region
renders *"Fell behind the daemon's replay buffer and was disconnected."* — a true statement about
this browser's transport and not an answer to the question the screen exists for. `metadata.value.state`
is `running`, loaded, in memory, and rendered nowhere, so the reader cannot tell a run that is still
going from one that has finished. `interrupted` is the same case. `docs/GLOSSARY.md` draws this
distinction explicitly — *"It is not run state: connection state describes this browser's transport
and can change without changing the daemon run"* — and this screen renders only the transport half.

`refusal` is the same omission and is the one the wire's own JSDoc argues for
(`packages/shared/src/wire.ts:128–137`, added at Q-0016 because *"a surface admitting a gap where the
daemon's own words were one field away"*). Its reachability is honestly narrower: `GET /runs` excludes
refused rows and `POST /runs` discloses no handle for one, so a refused handle arrives here only by
being typed.

**Severity, stated so the gate can weigh it rather than take the label.** No criterion names either
field — AC-8 is about `ConnectionState`'s nine members and the metadata *request* states, not the run
state. This is a defect against §2's user story and against the field's own stated purpose rather
than against a criterion's letter, which is the shape round 1's major 2 had and which the gate
resolved by fixing. The remedy is one line in `Header` for `state` and a small block for `refusal`,
both in a dev-owned file.

### major 4 — the AC-6 parse guard was narrowed for all three fields when measurement justified one, and the form a parser would actually write escapes it

`apps/web/test/source.test.ts:60`

```js
const MESSAGE_PARSE_NEEDLES = ["'", '"', '`', '/'].flatMap((prefix) =>
  ['cost', 'role', 'verdict'].map((field) => `${prefix}${field}${'='}`));
```

`solution/errata.md`'s AC-6 ruling is right that a bare `role=` cannot hold — it matches
`apps/web/src/backlog-board.test.ts:530`'s `[role="progressbar"]`, a legitimate accessibility
assertion. **Its conclusion is wider than its measurement.** Measured on this branch under
`apps/web/src`:

| bare needle | occurrences |
| --- | --- |
| `cost=` | **0** |
| `verdict=` | **0** |
| `role=` | 1 — `backlog-board.test.ts:530`, the selector |

Two of the three fields had no false positive to avoid and were narrowed anyway.

**Failure scenario.** None of the twelve needles matches `/\bcost=(\S+)/.exec(done.message)` (the
character before `cost=` is `b`), `/^cost=/`, `message.split(' cost=')[1]`, or
`message.includes(" cost=")`. The last is not contrived: `formatCost` composes `cost=$0.123`
**inside a larger message with a leading space** (`packages/core/src/engine/steps.ts:127–133`,
`:353`), so `' cost='` is the likeliest literal anyone parsing it would write. A later ticket can
therefore parse cost out of a `done` message, breach ground rule 2, and pass the one check standing
behind that rule — in the ticket that wrote the rule down.

This is not a reviewer raising the job its *Test:* clause set: AC-6's own clause specifies the **bare**
needles (*"none contains `cost=`, `role=` or `verdict=` as a literal"*), and the erratum narrowed
them.

**Recommendation.** Keep `cost=` and `verdict=` bare and apply the four-delimiter narrowing to `role=`
alone — or exempt `backlog-board.test.ts:530` by line and keep all three bare. Six needles instead of
twelve; the existing two-direction fixture still demonstrates both halves, since the template-literal
form is still rejected and `[role="progressbar"]` still accepted. **The contract clause at
`contracts/Q-0015/mission-control.contract.md:37–42` and the errata ruling move with it, which is a
gate act rather than an implementer's** — see observation 2.

---

## 4. Nits

**nit 1 — `apps/web/src/runs-screen.tsx:15`: two claims with no subject, in one file.** The module
JSDoc says `NO_TICKET_ID_TEXT` is imported *"so the ticket page's and this screen's wording cannot
drift apart"*; measured, its only importers are `mission-control-text.ts` (the definition),
`runs-screen.tsx` and `runs-screen.test.ts` — `ticket-page.tsx` does not use it, so there is no
second site to drift from. And `RUNS_HEADING`, `REFRESH_LABEL` and `RETRY_LABEL` are exported at
`:30–36` *"so a test and the view cannot disagree about what this screen is"*, while
`runs-screen.test.ts` imports none of the three and finds the Refresh control by
`view.querySelector('button')` (`:21`) — positional, satisfied by whichever button renders first.
Either import the labels in the test, or state the reason the exports actually have.

**nit 2 — `apps/web/src/mission-control-text.ts:21`: the cost disclosure under-reports the wire.**
It reads *"Per-vendor cost and token totals are unavailable as structured values; they occur only
inside a human-readable message."* The per-vendor split is genuinely absent and the first clause is
exact; the second reads as a claim about cost and tokens in general, and
`runTerminalCommonShape` (`packages/shared/src/events.ts:205–206`) carries `cost: z.number()` and
`tokens: z.number()` as **required** fields on the terminal event this screen already reads for
`runId`. Nothing renders them and AC-6 forbids it, so no behaviour is wrong — but Q-0131 and Q-0129
will both read this sentence as a measurement of what the wire carries. Narrow the second clause to
the per-vendor split.

**nit 3 — `apps/web/test/routes.test.ts:149`: the strengthened clause lost its message.**
`` `the app does not select ${route} by the register's own constant` `` interpolates the **row
object**, so a failure now reads *"the app does not select [object Object]…"*; the ternary chain it
replaced interpolated the path. Use `route.path`. (`NAMES` at `:143–146` is also rebuilt on every
iteration of the loop it sits inside — move it out.)

**nit 4 — `apps/web/src/runs-screen.test.ts:28`: AC-2's second half is unasserted.** Both the
criterion (*"asserts no other row's ticket id appears on it"*) and the QA scenarios require it; the
shipped clause asserts `NO_TICKET_ID_TEXT` on row 0 and `'Q-0015'` on row 1 and never that row 0 is
free of row 1's id. One `expect(links[0]?.parentElement?.textContent).not.toContain('Q-0015')` closes
it, and it is the half that catches a renderer leaking a sibling row's value.

**nit 5 — `apps/web/src/runs-screen.tsx:46`: a sixth in-flight helper inside a screen.** `runsInFlight`
is declared locally beside five siblings exported from `daemon-client.ts`, and
`mission-control-screen.tsx:26` imports `runInFlight` from there — so the divergence is visible
inside one ticket. Round 1's nit 1, unchanged and unruled.

**nit 6 — `apps/web/test/routes.test.ts:151`: the anti-hardcoding clause covers one of five screen
paths.** `.not.toMatch(/['"`]\/backlog/)` is unchanged in the ticket that added two more registered
screen routes. Round 1's nit 4b, unchanged and unruled.

**nit 7 — `apps/web/src/shell.test.ts:193`: the run-route renders inject no `fetcher`, and the guard
has no clause for one.** Eight renders of `App` at `/runs/run%20one` in that file pass `socketFactory`
and `pageUrl` and nothing else, so `MissionControlScreen` falls back to `browserFetch`. Today that is
deterministic — Node's `fetch` rejects a relative path — so the screen lands `unreachable` and nothing
leaves the machine. What makes it worth a line is that the comment four lines above the first of
those renders records Q-0120 M-5 for the **socket** half in this repository's own words, and
`source.test.ts`'s guard enforces `socketFactory` on a run-route render with no counterpart for
`fetcher`. This ticket is what made `/runs/:handle` a fetching route. One prop on each render, and one
clause beside the existing one.

**nit 8 — `apps/web/src/runs-screen.test.ts:2`: two dead type imports.** `type ReactElement` is
imported and unused here and in `mission-control-status.test.ts:2` (`mission-control-trace.test.ts`
uses it). `tsconfig.base.json` sets no `noUnusedLocals` and `eslint.config.js` enables three rules,
none of them `no-unused-vars`, so this ships silently either way.

**nit 9 — `docs/04-architecture.md:338`: the paragraph names the wrong retention constant.** It says
the browser keeps at most `DEFAULT_RETENTION`-many events; the browser declares and uses
`RUN_EVENT_RETENTION` (`apps/web/src/run-connection.ts:28`), and `DEFAULT_RETENTION` is the
daemon-side constant `apps/web` deliberately does not import. Naming it here obscures the accepted
residual AC-9 records — that the two 500s agree **by citation and not through a shared symbol**.
Write `RUN_EVENT_RETENTION`, or *"500 events, matching the daemon's default retention"*. *(Codex's
nit, confirmed.)*

---

## 5. Observations

*True and worth recording, and not claims about this change — per "A finding is a claim about the
change; anything else is an observation" (2026-09-11). None contradicts the verdict above.*

**observation:** `retry()` closes and reopens without clearing `events`, while the daemon's
`subscribe()` replays what it retains — so a Retry appends the retained prefix on top of what the
browser holds and the rendered trace doubles. It is untouched Q-0120 behaviour, deliberate there
(*"reconnects only through an explicit retry that preserves accepted evidence"*); what this ticket
changed is that the list is now drawn and the screen renders the Retry that reaches it. The remedy is
a behaviour ruling — clearing is right only if the daemon can still replay everything the browser
held — so it belongs at a gate, and it has now survived two full rounds without one.

**observation:** majors 1 and 4 both live in `apps/web/test/source.test.ts`, which the solution's own
file-ownership boundary assigns to qa-red and forbids every development task from editing, and major
4's remedy additionally reopens a frozen contract clause and the AC-6 erratum — a gate act. This is
Q-0120's structural finding, that a review verdict can name a surface the development flow may not
write, and it has already fired once on this branch: the commit before the tip is titled *"fix(web):
the two majors the fan-out could not be compelled to fix"*. The gate should decide the channel before
another round is spent trying to route them through one.

**observation:** the frozen contract's *Trace and timeline* section still carries no
*"names its event type"* clause, though round 1's major 1 was fixed in the code and is now held by a
test. The code moved and the contract did not, so the next reader of the contract inherits the gap
that made that defect invisible to both the implementer and QA. The contract is not a dev-owned file.

**observation:** AC-14's demonstration clause — the hand `POST /runs` that produced the run, its
observed event count and its peak concurrent-column count — is still not verifiable from the branch,
and both AC-9's stated rationale and the successor's revisit depend on that count being recorded.
Q-0016's entry records this exact obligation being reported as discharged when the by-hand half had
not been performed; the request should be transcribed rather than the result paraphrased.

**observation:** the Q-0015 bullet in `docs/06-development-plan.md` still reads `requirements`, which
AC-14 names as moving. `solution/errata.md` SE-3 and task T10 rule that page the human's and forbid
the implementer touching it, so the deferral is correct — it is named only so AC-14 is not read as
fully discharged by the diff.

**observation:** GO-6 still owes the measured truncation figure. Neither panel member reported a
truncation notice this round, and claude states it read every cited file from the branch rather than
from the patch — but the absence of a notice in one reviewer's prompt is not a measurement of the
cap, and Q-0128 is the open ticket. Record the byte figure and the files that received no patch
either way.

---

## 6. What was checked, and what was not

Majors 2, 3 and 4 and major 1's mutation argument were established by reading the shipped paths end
to end against the branch; **none of them is a test that fails today**, which is the point of all
four — major 1 is a check with no subject, major 2 is a contradiction no fixture renders at once,
major 3 is behaviour no criterion's letter reaches, and major 4 is a guard weaker than its own stated
claim. The needle counts in major 4 and the `.reverse()` that refutes codex's major were verified by
execution over the branch.

Neither the suite, `pnpm lint` nor `pnpm typecheck` was run: this is a read-only review and those
verdicts belong to `integrate` in both environment rows.
