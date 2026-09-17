# Q-0015 — review verdict, round 3

*Panel: claude (2 majors, 5 nits, 2 observations) and codex (2 majors, 1 nit). Deduplicated and
adjudicated against the branch tip `harness/Q-0015/integration` = `b81415a`, not from either
report — the two reviewers contradicted each other about the contents of one file, and settling
that by reading the tree is what this step is for (Q-0107, Q-0120).*

**Verdict: `revise`.** Two majors, six nits, three observations. Both majors are claude's and both
are confirmed at the tree. **Both of codex's majors are refuted by measurement**, one of them
because it was written against a stale patch; its surviving half merges into a nit.

---

## What was adjudicated, and how

The panel disagreed about `contracts/Q-0015/mission-control.contract.md` — codex reporting it
specifies twelve parse needles against an implementation of six, claude reporting the branch
specifies six and that the patch supplied with the prompt is a commit behind. That is a factual
disagreement about one file, not a difference of judgement, so it was resolved by reading the
branch rather than by weighing the two reports.

Measured: the branch's contract is **88 lines** and line 38 reads *"**six** parse needles: bare
`cost=` and `verdict=`, and `role=` prefixed by a single quote, double quote, backtick or slash"*,
with its own provenance parenthetical at `:45` — *"(Twelve needles until review round 2's major
4;…)"*. `git diff --stat main...b81415a` is **23 files and 1,335 insertions**; the supplied patch
is 22 and 1,316. Claude's account is correct in every particular.

Each surviving finding below was then verified independently at the tree rather than relayed.

---

## Majors

### M-1 (major) — a Retry appends the daemon's replay onto the events the browser kept, so every retained event renders twice

**`apps/web/src/run-connection.ts:218`**, against **`:207–216`**. *(claude M-1. Confirmed.)*

`connect()` clears all three pieces of accepted state before opening:

```
212:      events = [];
213:      missedCount = null;
214:      browserDiscardedCount = null;
```

`retry()` (`:218–223`) calls `closeCurrentSocket()` and `open(runEventsUrl(page, handle))` and
clears **none** of them. On the other end a new socket is a new subscription —
`packages/server/src/serve.ts:162` calls `host.subscribe(handle)`, and
`packages/server/src/broadcast.ts:156` builds `const subscriber: Subscriber = { queue:
[...retained], released: false }`, its docblock at `:56` reading *"Registers a subscriber,
**replaying what is retained**"*. So the reconnected socket sends the whole retained buffer ahead
of the live tail and `:167`'s `events = [...events, result.frame.event]` appends every one of it to
what the browser already holds.

**Failure scenario.** A run emits 40 events; the socket closes `1006`, so the state is
`interrupted` — one of exactly three states in which Retry is offered (`interrupted`, `dropped`,
`protocol-error`), which are exactly the three in which the browser is holding accepted events. The
reader presses the only action offered. The daemon replays 40, `partitionTrace` is handed 80, and
**every column and the run-activity lane render every line twice**, non-adjacently. A second Retry
makes it 120. Past `RUN_EVENT_RETENTION` the eviction at `:168–172` fires and AC-10's browser
sentence reports *"this browser discarded N earlier live events to keep the view bounded"* for a
loss caused by duplication rather than volume — the exact confusion AC-10 and the contract's *"two
counters, two sentences, never confusable"* exist to prevent. `missedCount` survives too: `serve.ts`
sends a `missed` frame only when non-zero, so a zero-eviction replay leaves the previous
connection's count on screen describing a replay that did not happen.

**Scope, stated rather than assumed.** This is latent Q-0120 code, invisible until now because
nothing rendered the list. It is in scope because **AC-9 and T03 open this file**, T03's own
description says *"reset both loss counters **on retarget**"* — `connect()`, not `retry()` — and
`.claude/rules/engineering.md` requires a defect found in code you are already changing to be
reported. It is reported rather than carried because this ticket is what makes it visible, and
because the module's own docblock states both halves of the contradiction: *"reconnects only through
an explicit retry that **preserves accepted evidence**"* beside *"the daemon's `missed` envelope
exists precisely so a gap is reported rather than smoothed over"*. Preserving the browser's evidence
and accepting the daemon's replay cannot both hold without a resume cursor, and there is none.

**Recommendation.** Rule it this round. The defensible answer is that `retry()` clears the same three
fields `connect()` does: the daemon's replay plus its `missed` count is a complete, self-describing
account, and the browser has nothing to splice it with. If the gate prefers to keep pre-retry
evidence, the duplication needs its own sentence and must not drive the browser-discard counter.
What it may not do is ship silent — no criterion or test currently fails on it.

### M-2 (major) — the terminal event's `status` and `error` reach no surface

**`apps/web/src/mission-control-trace.tsx:35`** — `case 'terminal': return
\`${event.stageBefore} → ${event.stageAfter}\``. *(claude M-2. Confirmed.)*

`runTerminalEventSchema` carries `status` — `completed | aborted | failed | interrupted | undecided
| regressed` — an optional `error`, and for `regressed` its counter, limit and remaining. `eventLine`
renders the two stage strings and drops all of it, and a grep across `apps/web/src` finds `status`
only as fixture data in tests: **no production file reads `event.status` or a terminal `error`**.
Nothing else carries it either — `connectionStateText` `'ended'` is `'The run has finished.'`
(`connection-state.ts:110`) for all six statuses; `mission-control-status.tsx` renders `WireRun.state`,
which is the **host's** `running | ended | refused` rather than the run's verdict; `data-run-identity`
takes only `runId` from that event; the timeline is built from `step`/`done`.

**Failure scenario.** A run dies `failed` with `error: "codex exited 1: You've hit your usage
limit"`. The lane renders `terminal  red → red` under *"The run has finished."* — byte-identical to
a `completed` run whose stage did not move — with the error on no surface. `undecided` is sharper
still: it means the run stopped at a gate nobody answered, the single thing a human watching this
screen most needs to see, and it renders exactly like a success.

This is round 2's major 3 one field over. That finding added `WireRun.state` and `refusal.condition`
to the header on the reasoning that the screen was *"admitting a gap with the daemon's words one
field away"*; `status` and `error` are the run's own words, already in `snapshot.events`, discarded
by the renderer. AC-11's discipline is to **name what cannot be shown** — this can be shown and is
not, and none of the five disclosures covers it.

**Recommendation.** Extend the `terminal` arm to name the status and, where present, the error,
verbatim and uninterpreted, as every other arm treats its payload. Nothing blocks it: AC-11's
no-fabrication assertion is scoped to `data-mission-control-header` and the lane is not that region.
If the gate rules the run's outcome out of this ticket, `MISSION_CONTROL_DISCLOSURES` owes a sixth
sentence saying so and naming where it lives — silence is the one answer that is wrong here.

---

## Refuted

Recorded with the measurement, not dropped quietly, because a reviewer who was right about the
subject and wrong about the tree deserves the distinction on the record.

### codex major 1 — *"the development plan still describes Q-0015 as requirements-only"* — **refused**

True of the file and **not a defect in this change**. `backlog/…/solution/errata.md` **SE-3** removed
`docs/06-development-plan.md` from T10 at the architecture gate, on three grounds this verdict
verified: (1) **Q-0094 erratum E-3(a) already ruled it**, recording that *"this page's bullets are
rewritten by hand at each plan pass"* and that enforcing the edit *"turned a harmless revert into a
review finding"*; (2) the Q-0015 bullet already exists and holds gate work — the three-way split,
Q-0130, Q-0131, the no-producer finding — that T10 would overwrite; (3) the facts a ticket entry
carries are **post-run**: cost, implement rounds, review findings and what was verified do not exist
while a development task runs. SE-3's own 2026-09-17 correction then landed the narrowing in
`solution.md` as well as `tasks.yaml`, because the fan-out feeds the implementer from `solution.md`.

So the finding asks a development-stage change to write a surface a landed ruling forbids it, which
is *"A requirement may not name a surface its flow cannot write"* (2026-08-25). `solution/errata.md`
is one of this review's own inputs and the report does not weigh it. The residual — that the bullet
must move at the close — is the operator's and is recorded as an observation below rather than as a
finding.

### codex major 2 — *"the frozen contract specifies a different source guard from the implemented one"* — **refuted at the tree**

The branch's contract is 88 lines and specifies **six** at `:38`, matching the guard `c89e865`
shipped, with `:45` recording the twelve-needle set as superseded by round 2's major 4. The
twelve-needle text codex cites is the **84-line patch supplied with the prompt**, one commit behind.
`solution/errata.md` SE-1's own 2026-09-17 correction closes the loop: *"Six needles rather than
twelve, and `contracts/Q-0015/mission-control.contract.md` moved with this entry rather than after
it."* There is no contract/implementation disagreement on the branch.

**Its second half is real and survives as N-1** — the test title. Codex found a true residual
through a false premise, which is worth stating precisely rather than dismissing the whole finding.

---

## Nits

### N-1 — the AC-6 guard's title says "twelve" two lines above an assertion of six
**`apps/web/test/source.test.ts:76`** — `test('the complete source corpus contains none of the
twelve parsing forms', …)` with `:77` `expect(MESSAGE_PARSE_NEEDLES).toHaveLength(6)`. *(claude N-1
+ codex major 2's residual.)* The sentence a reader and a failing-test report meet first names the
superseded set. Rename to six; the historical reference in the comment at `:84` is provenance and
should stay.

### N-2 — a route-register failure message reads `[object Object]`
**`apps/web/test/routes.test.ts:149`** — `` expect(app, `the app does not select ${route} by the
register's own constant`) ``. Round 1's N4 replaced the literal tuple loop with one over row
objects, so `route` is the row where it used to be the path. The line directly above already uses
`${route.path}` correctly. *(claude N-2.)*

### N-3 — three exported labels claim a check no test makes
**`apps/web/src/runs-screen.tsx:30`** (`RUNS_HEADING`, with `:33` and `:36`), whose JSDoc says they
exist *"so a test and the view cannot disagree about what this screen is"*. `runs-screen.test.ts`
imports `EMPTY_RUNS_TEXT`, `NO_TICKET_ID_TEXT` and `REQUEST_STATE_KINDS` and **none of the three**,
while `backlog-board.test.ts:18`, `gate-screen.test.ts:27` and `ticket-page.test.ts:24` each import
their screen's and assert over them. Assert them or drop the sentence. *(claude N-3.)*

### N-4 — architecture names a constant the browser does not use
**`docs/04-architecture.md:338`** — *"The browser keeps at most `DEFAULT_RETENTION`-many events"*,
while the implementation declares its own `RUN_EVENT_RETENTION = 500` and AC-9's stated residual is
that the two *"agree by **citation** and not by a shared symbol"*. The sentence implies an identity
the design deliberately does not have. Name `RUN_EVENT_RETENTION` and say it matches the daemon's
figure by citation. *(codex nit.)*

### N-5 — an unused type import in two new test files
**`apps/web/src/runs-screen.test.ts:2`** and **`apps/web/src/mission-control-status.test.ts:2`**
import `type ReactElement` and annotate nothing with it; `mission-control-trace.test.ts:11` does,
which is where the line was copied from. Verified: the identifier occurs exactly once in each of the
first two files and twice in the third. Neither gate catches it — `tsconfig.base.json` sets no
`noUnusedLocals` and `eslint.config.js` enables three rules, none of them `no-unused-vars`.
*(claude N-5.)*

### N-6 — `runsInFlight` sits in the component while every sibling lives beside its fetch
**`apps/web/src/runs-screen.tsx:46`**. `daemon-client.ts` holds `runInFlight`, `ticketsInFlight`,
`flowsInFlight`, `ticketInFlight`, `ticketFileInFlight` and `gateAnswerInFlight`, and this change
added `fetchRuns` to that module. Moving it there removes the five-line comment explaining the
exception and `runs-screen.tsx`'s only import of `DAEMON_ENDPOINTS`. **Discretionary**: the JSDoc at
`:38–45` states the reason for the placement in place, so this is the author's call rather than a
defect. Recorded because a nit held is reported. *(claude N-4.)*

---

## Observations

*Exempt from the verdict rule per* "A finding is a claim about the change; anything else is an
observation" *(2026-09-11). None is a claim about this change and none carries a `file:line`.*

**observation: the diff supplied with this round is one commit behind the branch, and reviewing it
as given produced a false major.** The patch is 22 files and 1,316 insertions; `main...b81415a` is
23 and 1,335. Two differences: the patch's frozen contract is the superseded 84-line twelve-needle
version, and `solution/errata.md` (15 lines) — which rules two of this round's four raised majors —
is absent from it entirely. Both of codex's majors trace to that patch. The cause is **not
truncation**, which this repository already has a warn and a ticket for (Q-0128); it is a diff
materialised before the commit that answered the previous round. Worth recording because the remedy
is different: a truncation warn would not have fired here, and nothing in front of either reviewer
said the patch was stale.

**observation: R-4 is refuted, measured.** 181,044 bytes against `repo.max_diff_bytes`'s 200,000
default, zero truncation notices, no file without a patch. The alphabetical tail R-4 named as what a
head-cut would hide — `apps/web/test/source.test.ts` and `apps/web/test/routes.test.ts` — was
present and read, and is where N-1 and N-2 were found. Second consecutive ticket to predict its own
truncation and be wrong about it, after Q-0127. GO-6 is answered in this direction.

**observation: the development-plan bullet is owed at the close and is the operator's.**
`docs/06-development-plan.md`'s Q-0015 entry still records the requirements run alone while
`docs/04-architecture.md` now describes the shipped screen, and closing that gap is a hand edit at
the plan pass rather than work this flow may perform (SE-3, Q-0094 E-3(a)). Recorded here so the
obligation does not expire with this verdict — the plan itself records seven directions of exactly
that drift.

---

## What was checked and holds

Recorded so a later reader knows what this round examined rather than passed over, and so a fourth
round does not re-derive it. Verified at the tree, not relayed from either report.

- **`WRITE_RULES` is unmoved**, which is AC-14's load-bearing half and R-6's named failure mode.
  Six needles, `'/stop'` still `permitted: null`, `PUT`/`PATCH`/`DELETE` still `null`, and all three
  anti-vacuity clauses intact. The split at §5.6 was honoured rather than quietly undone.
- **The AC-6 guard is correct as shipped**, whatever its title says: six needles, bare `cost=` and
  `verdict=` forbidden, `role=` narrowed to four delimiter forms, with both discriminating fixtures
  — the template parse rejected, `[role="progressbar"]` accepted — and the bare forms pinned at
  `:86–87`, which is what round 2's major 4 was about.
- **AC-4/AC-5** are sound: `partitionTrace` keys on exact `stepId` via `'stepId' in event`, and the
  union makes that safe — `info`, `warn`, `gate` and `terminal` declare no such field and every
  other member declares it required, so no event can reach a column under an `undefined` key.
- **`eventLine` is exhaustive over the union** and says so, so a widened union fails to compile here
  rather than rendering a kind as nothing. M-2 is a dropped *field*, not a dropped *kind*.
- **AC-9's citation is true**: `DEFAULT_RETENTION = 500` at `packages/server/src/serve.ts:47`, so
  the browser's bound is derived rather than invented. The eviction at `:168–172` allocates a new
  array, so an already-returned snapshot is genuinely unchanged — the immutability the comment at
  `:155–160` argues for is preserved, and that comment is the one T03 was asked to correct about
  Q-0121, which it did.
- **Round 1's M3 and round 2's M-2/M-4 are closed**: the `socket !== next` guard covers supersession,
  a natural close nulls `socket` and detaches at `:194–195`, and a refused frame ends its socket at
  `:145–147`. M-1 above is a different hole — state the *reconnect* does not reset — and is not a
  regression of any of them.
- **No XSS surface**: every event field renders as React text through `EventLine`.

---

## Recommendation to the gate

Two majors, so `revise`. Both are small and local: M-1 is three assignments in `retry()` or an
explicit disclosure; M-2 is one `case` arm or a sixth disclosure sentence. Neither needs an erratum,
a decision entry or a criterion change, and neither touches the write boundary.

**Two of the four majors this round raised were artefacts of a stale diff rather than of the code**,
which is the round's most transferable measurement: the reviewer that read the tree found two real
defects and the reviewer that read the patch found none that survived. If a fourth round runs, the
diff it is handed should be re-materialised from the tip first.
