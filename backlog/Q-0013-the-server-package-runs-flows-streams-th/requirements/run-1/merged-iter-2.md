# Q-0013 — The server package runs flows, streams their events and answers their gates

*Merged requirement, run 1, iteration 2, 2026-09-11. Verdict: **ready**. Surfaces: `packages/server`
(new), `packages/core/src/index.ts` (public API), `docs/04-architecture.md`, `harness/roles/`
(routing only, and the human's).*

---

## 0. Iteration 2 opened on an unchanged tree, and says so first

`git log` tip is `9f251a6 docs(backlog): open Q-0013` — the commit that created this ticket.
`docs/decisions/` ends at **090**. No role file names `packages/server`. Nothing iteration 1 asked
the gate for has arrived, and nothing could have.

**A retry on an unchanged tree cannot rule its own blocker** (Q-0090, Q-0096, Q-0105). This
iteration therefore did what Q-0105's second pass did — re-examined whether iteration 1's four
blockers were blockers at all — and applies that ticket's remedy where they are not: *cured by
**stating** the threshold rather than asking the gate for it, since a requirement that leaves a case
uncovered is precisely one `developer-generalist` must stop on — the remedy for the pattern rather
than another instance of it.*

**Three of the four do not survive measurement. The fourth is a gate obligation and always was.**
None of the reversals is on the merits of iteration 1's recommendations: every one of them is
carried unchanged into the criteria below, and what moved is where it sits.

| iteration 1 | iteration 2 | why |
| --- | --- | --- |
| **B-1** run identity, blocker | **ruled** (AC-3, AC-5) | the measurement in §1.2 makes option (a) the only one that covers the refusal cases; additive, no entry owed |
| **B-2** replay policy, blocker | **ruled** (AC-7) | the rule conflict it rests on is not real (§1.3); retention becomes a bounded construction parameter and the product default goes to the child that has a client |
| **B-3** override with reason, blocker | **routed** (GO-2) | two documents, not three (§1.4), and neither is this child's surface |
| **B-4** route and role grant, blocker | **gate obligation** (GO-1) | its mechanism is wrong (§1.5), and its answer changes no criterion below |

**No decision entry is owed by this ticket.** Iteration 1 owed three.

---

## 1. What was measured, and where it corrects the inputs and iteration 1

Every claim was re-run against the tree on 2026-09-11. Where an absence is reported the probe that
looked is named, per *"A probe that could not answer is not a negative"* (2026-09-10).

### 1.1 — The export gap is real, and the ticket body is wrong about one mechanism

`packages/core/src/index.ts` carries none of `AnswerGate`, `RunFlowOptions`, `Project`,
`TicketRecord`, `RunStatus`. It also **does not star-export `@quorum/shared`** — it re-exports
exactly one type from it, `CliVersionResult` — so the ticket body's *"`Event` and `RunTerminalEvent`
come from `@quorum/shared` through a star export"* is false of the mechanism:
`packages/cli/src/run.ts:31` imports them from `@quorum/shared` **directly**. The server declares
**two** workspace dependencies, not one.

`AnswerGate` (`engine/types.ts:75`) has no `ReturnType` trick: it is a parameter type, reachable
only as `Parameters<typeof runFlow>[0]['answerGate']`. `Project` has one, and four CLI sites already
carry it — `adapters.ts:49`, `board.ts:44`, `ticket.ts:59`, `run.ts:228` — which a command gets away
with because it holds a project for one statement and a host does not.

**It cannot disturb Q-0092's register.** The barrel's own docblock: *"A type export adds no runtime
key, so the surface `package.test.ts` counts is the value list above and nothing else."*

### 1.2 — Both pre-stream refusals are cases where `core` has no id to give

This is the measurement that settles B-1, and neither candidate nor iteration 1 had it.

- **The stage precondition throws above the run number.** `engine.ts:222` raises
  `ticket … is at stage "…", flow "…" consumes "…"`; `const runId = nextRunId(ticket)` is `:228`.
  A start refused on stage **never reaches a run number at all**.
- **The run number is read above the lock, deliberately, and it is not reserved.** The lock is
  `:246`, and the comment at `:235` states the rule in its own words: *"`nextRunId` reserves
  nothing, and a contender that is refused never uses the number it read."* So a contender the lock
  refuses has already computed **the holder's number**.

Both refusals happen on the first pull, before any event is emitted (§1.6), so the stream rejects
with no `terminal` event and therefore no `runId`. The consequence is stronger than iteration 1's
framing: **a design that waits for `core`'s id to name a run cannot name either of the two runs that
AC-4 and AC-5 exist for.** Option (b) — `core` reporting the id structurally at start — does not
remove the need for a handle, it adds a second thing beside it; option (c) — deriving it from
`nextRunId` — is refused by the code's own comment.

### 1.3 — B-2's rule conflict is not real: it is one principle read as two

Iteration 1 set `04-architecture.md` principle 3's *"an in-memory index rebuilt from disk on start"*
against `harness/rules.md`'s *"no hidden state in the daemon"* and concluded an event buffer "sits
exactly on that line". Measured, those are **the same principle**, and the permission is in the same
sentence as the prohibition:

> `harness/rules.md:59–60` — *"Files are the database. Anything persistent is a file in `backlog/`,
> `harness/` or `.quorum/`. The daemon holds no hidden state."*
>
> `04-architecture.md` principle 3 — *"**Files are the database.** … **The daemon keeps an in-memory
> index and rebuilds it from disk on start.** No SQLite in v1."*

The rule's subject is **persistence**: the daemon may not be a second authority for anything
durable. A buffer of events already delivered is an authority for nothing, survives no restart, and
is exactly the shape principle 3 permits — and principle 4, *"the daemon is stateless across
restarts"*, is satisfied by discarding it. This is Q-0090 E-1's precedent applied a second time: a
landed rule does not govern a case it was not scoped to, and stretching it to cover one is how a
question becomes a blocker it never was.

### 1.4 — B-3 is two documents, not three, and the third is a mockup brief

`docs/05-design-prompt.md:7` says what it is in its own second sentence: *"This is a design
validation mockup, not a real app"*, and its override line is at `:43`, under the heading
**"Interactions that must work in the mockup"** — *"override → reason input appears"*. A mockup
brief promising a prototype interaction is not a document promising a shipped contract.

Two real conflicts remain, and **neither is this child's surface**: `04-architecture.md:63`'s
`POST /runs/:id/gate (advance/retry/override with reason)`, which is the **transport's** (successor
A), and `06-development-plan.md`'s M3 gate-screen line, which is **Q-0016's**. Against them,
`gateAnswerEnvelopeSchema` (`events.ts:195`) is `.strict()` over `{gateId, answer}` with `answer` a
closed `['advance','retry','abort']`, and `askGate` `safeParse`s the returned value and raises
*"received an invalid answer"*.

The audit alternative has a home that was not named: `askGate` already ends
`appendLog(ticket, "run=N gate=KIND answer=ANSWER")` (`routing.ts:47`). Widening that line is a
`core` change and is Q-0016's to ask for.

### 1.5 — B-4's mechanism is wrong: `paths` is advisory and nothing enforces it

Iteration 1 wrote that *"no role the fan-out can resolve may write this ticket's only directory"*.
Measured, nothing prevents the write:

- **A role's `paths` is read by nothing.** `packages/shared/src/role.test.ts:50` pins it as
  *"documented as advisory, with the citation that makes it advisory"*, and
  `packages/core/src/engine/q0052.source.test.ts:95` guards it: *"a reader of `meta.paths` would
  turn advice into enforcement without anyone deciding to."* The allow-list reaches an agent only
  through the role's **prose**.
- **`.claude/settings.json` imposes no path restriction.** Its `allow` is
  `["Read", "Edit", "Write", …]` and its `deny` names `git push --force`, `rm -rf`, `.env*` and
  `**/auth.json` — no path rule.

And `harness/architecture.md:66–68`, which iteration 1 cited for the consequence, is about **task
ownership inside a solution document** (*"a file no task owns"*), a different subject from a role
path grant.

So what actually happens is softer and worse-shaped than a block: a conscientious implementer reads
*"your allowed paths: packages/core, packages/shared, harness, docs, backlog"* and **stops and
reports** — which is Q-0069's three refusal rounds and Q-0103's *"the implement step refused each of
them three times correctly"*. The remedy is unchanged and the urgency is real; its classification is
not. **B-4's answer changes no criterion below**, which is the test for a blocker in this role.

### 1.6 — The channel, confirmed, and the caller it was built for

`createEventChannel(start, finalise)` runs `start()` on the **first** `next()` (`channel.ts`), not
on construction. A second `[Symbol.asyncIterator]()` and a re-entrant `next()` each throw a named
`FlowError`. `complete` drains the queue before it settles — *"which is what lets a terminal event
be observed before the failure it reports is thrown"*. `return()`/`throw()` await `finalise` before
resolving.

`detachPending`'s JSDoc names this ticket's consumer without naming the ticket: *"Unreachable from
`for await` … reachable from `Promise.race([it.next(), shutdown])`, **which is the shape a daemon
uses**."* That path has never had a caller.

### 1.7 — Two more, confirmed and load-bearing

`engine.ts:194–219`'s JSDoc names this ticket from Q-0116, landed the day before: *"M3's server is
the first that will hold one across runs and answer a `GET` from it."* Nothing here re-litigates it.

`vitest.shared.js` declares `testTimeout: 20_000`, **chosen** by Q-0102 on 2026-09-11 against a
measured 3685 ms worst case, and `packages/server/vitest.config.js` already re-exports it. The
comment's own reasoning — *"the next expensive test would otherwise inherit the accidental default
again"* — makes a per-file override in this package a regression rather than a convenience (AC-14,
§9 risk 7).

### 1.8 — One inherited criterion asks for work already on disk

The codex candidate's AC-15 requires removing the `Q-0013` row from `plan-backlog.test.ts`'s
`UNCREATED` register. It went with the folder, and that suite's second direction would already be
red otherwise. A criterion the tree satisfies before an implementer starts is unfalsifiable rather
than small. **Struck.**

---

## 2. Problem

`packages/server/src/index.ts` is `export const name = '@quorum/server';` and its `package.json`
declares no dependencies at all. Everything M3 promises — mission control, the gate screen, run
history in a browser — is downstream of a process that does not exist.

There is one way to run a flow: `quorum run`, at a terminal, where the gate is a readline prompt and
the trace is ANSI on stdout. A run that reaches a gate holds a terminal hostage until somebody types
a word. Nothing persists the event stream, so a run nobody watched cannot be watched afterwards, two
people cannot watch the same run, and one person cannot watch it from two places.

What is missing is not the screens. It is the thing underneath them: something that starts a run,
consumes its **single-consumer** stream exactly once, fans it out to whoever is watching, and
carries an answer from somewhere else entirely back into the promise a run is parked on — without
re-implementing, weakening or negotiating with any of the four landed entries that govern those
mechanisms.

---

## 3. User stories

**`maintainer`** — *I start a run from outside my terminal, watch its trace while it works, and
answer its gate from somewhere else. If I look away and come back, the run is still going and I can
still answer it. If a run already holds the ticket, the thing that tried to start the second one
tells me so, naming the holder — not a log line I find afterwards.*

**`maintainer`** — *I stop a run I no longer want. It ends `interrupted`, keeps the worktrees it
obtained so I can go and look, and does not roll back a merge an `integrate` step had already proved
green.*

**`adopter`** — *Nothing asks me for a key, and nothing this package does reaches my working tree.*

**`contributor`** — *The server is a consumer of `@quorum/core`'s public API and nothing else. What
it may reach for is settled by the barrel, not by whoever types an import first.*

---

## 4. Size ruling: three children, unchanged from iteration 1

The cut is carried forward unaltered and is **not re-argued**; it was not disputed, and re-deciding
a settled ruling is how a second iteration becomes expensive.

Measured, the live half as one ticket — the export gap, the host, the bind, starting a run against a
lazy stream, the two pre-stream refusals, request validation, the fan-out, the late-joiner policy,
the WS message contract, terminal-and-close, the gate with its five refusal cases, stop, shutdown,
error mapping — is **eighteen** independently testable criteria. Q-0091 split at twenty-one and
Q-0096 at twenty-one, **both at their gate and both at cost**.

| | ticket | what it is | why here |
| --- | --- | --- | --- |
| 1 | **Q-0013 (this)** | the **run host**: the export gap, an in-process registry that starts a run against the lazy stream, owns its identity, fans one stream out to N subscribers, holds the gate registry and settles an answer out of band, stops one run, releases everything on shutdown | carries **every unretired risk** — lazy start, single-consumer fan-out, out-of-band answer, the abandonment path — and needs **no new external dependency**, so the dependency decision does not ride on the risky half |
| 2 | **successor A** | the **HTTP + WebSocket transport**: the three routes `04-architecture.md` already names, the WS envelope, request validation and status mapping, the loopback bind, the retention default, the protocol contract Q-0014 codes against | ordinary Hono work over a host whose behaviour is already proved, and where the **product** decisions live |
| 3 | **successor B** | the **read-only REST surface**: project, backlog, runnable flows, run history | needs **nothing** added to `core` — every symbol is already on the barrel — which is why it goes last rather than first |

*"Milestones are ordered by risk, not by screen"*, and the export gap belongs with whichever half
runs first, which is child 1.

**The codex candidate's alternative seam stays refused.** Keeping single-watcher streaming here and
deferring fan-out builds the exact defect §9 risk 2 names — a host that hands the iterable to a
per-connection handler is correct for one watcher and throws on the second — and the follow-up would
rewrite this child's centre. The fan-out is not an enhancement of single-watcher streaming; it is
what makes single-consumer safe.

Appendices A and B are the two successors' bodies **written out in full**, because an obligation
recorded only in a closed ticket's entry expires.

---

## 5. Acceptance criteria

Fourteen, numbered continuously so a criterion keeps its name if the cut moves. Each names its
surface. **Every *Test:* clause bounds the instrument and nothing more** — a reviewer may find the
instrument fails the job the clause gives it, and may not raise the job (Q-0067 erratum E-1).
Nothing here pins bytes except where it quotes `core`'s own sentence: a requirement describes what
must be conveyed (Q-0094 E-3).

### The package and the public API

**AC-1 — `@quorum/server` declares what it depends on, and nothing more.**
Surface: `packages/server/package.json`. It gains `@quorum/core` **and** `@quorum/shared` at
`workspace:*` — both, per §1.1 — and **no external dependency**, which is successor A's. No `build`
task and no emit: the local distribution set is three packages and this ticket does not make it
four.
*Test:* a `packages/server` test imports `runFlow` from `@quorum/core` and `eventSchema` from
`@quorum/shared` and both resolve under the `quorum-source` condition;
`packages/cli/src/build.test.ts`'s per-package emit register is unchanged.

**AC-2 — the barrel gains the names the host actually names, derived rather than hand-written.**
Surface: `packages/core/src/index.ts`. The names are type-only, so the value surface does not move
and stays at **twenty-nine**. Each addition carries the one-line rationale the barrel's own docblock
requires — *a name is added because a consumer needs it, not because its module exports it*, the
rule Q-0092 applied when it withheld `manifestShapeError` and Q-0093 when it withheld
`currentBranch`.

`AnswerGate` is required and undeniable. `Project` and `TicketRecord` are admitted on the same rule:
a host holds both in a registry field for the lifetime of the process, where the CLI's
`ReturnType<typeof loadProject>` workaround does not reach. `RunFlowOptions` is admitted if the host
names the shape it stores. **`RunStatus` is withheld with its reason** — `RunTerminalEvent` already
carries a typed `status` from `@quorum/shared`, so no host site needs `core`'s internal union — and
is admitted only if solutioning shows a site that needs it, by the same rule.
*Test:* every type the host's own source names from `@quorum/core` resolves from the barrel; no file
in `packages/server` contains `Parameters<typeof runFlow>` or `ReturnType<typeof loadProject>`; and
`packages/cli/src/package.test.ts`'s derived value-surface assertion is unchanged and still green.

### Identity and starting a run

**AC-3 — a run the host is driving is named by a handle the host mints, and `core` is not changed to
provide one.**
Surface: `packages/server`. Ruled here rather than asked, on §1.2. The handle is opaque, unique
within the process, and meaningless across a restart — which is honest, because Q-0019 has not
happened. `core`'s `runId` is **correlated** onto the handle when the terminal event arrives and
never before. The host **never** parses an `info` message's text for it, **never** parses a `gateId`
for the run id it currently embeds, and **never** calls anything that allocates a run number: two
authorities for run identity is what this criterion forbids.
*Test:* a completed mock-adapter run's handle carries `core`'s `runId` after the terminal event and
carries none before it; a scan of `packages/server` finds no read of an event's `message` text, no
parse of a `gateId`, and no reference to `nextRunId`.

**AC-4 — a start does not report success until the run is actually under way.**
Surface: `packages/server`. `runFlow` is lazy (§1.6): the stage precondition and the run lock are
evaluated on the first pull, so the host begins consuming and waits for the run to be under way
before it answers its caller.
*Test:* two starts for one ticket, the second issued after the first has answered, produce **one**
started run and **one** refusal; the refusal carries `core`'s own sentence, which names the holding
run, flow, pid, host and start time.

**AC-5 — a refusal that reaches no `terminal` event is reported with the condition `core` gave, and
its handle claims no run number.**
Surface: `packages/server`, and one module that owns any remedy. The two are the stage precondition
(`engine.ts:222`) and the run lock (`:246`); neither is rewritten, paraphrased or classified by
message text. Per §1.2 neither has a run number to report — the first never reached one and the
second read the holder's — so a refused start's handle resolves to **no** `runId` rather than to a
plausible wrong one. *"A `core` error names the condition; the remedy belongs to the surface"*
(2026-09-07) was ruled **for this surface**, and `packages/cli/src/fail.ts`'s `dieNoProject` is the
shape: one site, taking the condition as a **string** so the module names no `core` symbol. A
server's remedy is not a shell imperative — the entry's own reasoning is that this surface serves
*"somebody who may not have a shell"*.
*Test:* a ticket whose stage the flow does not consume is refused, the sentence is byte-identical to
the `FlowError`'s and the handle reports no run number; a second run on a locked ticket is refused
the same way; `ProjectNotFoundError` reaches a caller as `core`'s sentence plus this surface's
remedy composed at one site; and `quorum init`'s imperative appears in no response this package
produces.

### The stream

**AC-6 — the host is the stream's one consumer, and subscribers are its own fan-out.**
Surface: `packages/server`. The host iterates **once** per run and distributes. Each event reaches
every subscriber registered when it is published, exactly once; per subscriber, delivery preserves
the order the host consumed in; a slow subscriber cannot make another miss, duplicate or reorder
events, and cannot block the one consumer. **No ordering claim `core` does not make** — parallel
members have no global ordering or interleaving promise.
*Test:* two simultaneous subscribers on one run each receive every event exactly once in consumption
order; a run containing a `parallel:` step is covered without asserting an order core does not
promise; and the run's stream was iterated exactly once.

**AC-7 — retention is a bounded construction parameter, and an incomplete replay is named rather
than silent.**
Surface: `packages/server`. Ruled here rather than asked, on §1.3: a transient buffer discarded on
close is not the persistent state `harness/rules.md:59–60` forbids, and principle 3 permits the
daemon an in-memory index in the same sentence. The bound is **a count of events**, because a byte
bound needs serialising and a time bound makes a fixture's verdict a function of the clock, which
*"A test's verdict is a property of the commit"* (2026-08-30) forbids and which Q-0105's M-6 refused
for that reason. A capacity of **zero is live-tail-only**, so both policies are reachable without
rebuilding the host and **which value the product ships is successor A's** — the child that has a
client able to arrive late. A late subscriber receives the retained events in consumption order and
then the live tail with no gap and no duplicate at the boundary; where eviction means the replay is
incomplete it is **told how many events it missed**, because silence that means two things is the
defect this repository has recorded most. That notice travels **beside** the stream and never inside
it: the event union is closed and `.strict()`, and widening it is a non-goal. One line in the host's
JSDoc names the authority for the scope reading; the reasoning is not transcribed there
(`.claude/rules/engineering.md`, and Q-0067 and Q-0111 both paid for transcribing).
*Test:* at a non-zero capacity a subscriber attached after events have been consumed receives them
then the live tail with no gap or duplicate; at capacity zero it receives the live tail only; where
eviction has occurred the subscriber is given the count it missed; and no value the host delivers as
a truncation notice parses as an `Event`.

**AC-8 — the terminal event is the last one, and a failure after it neither replaces nor joins it.**
Surface: `packages/server`. `channel.ts` drains before it settles, *"which is what lets a terminal
event be observed before the failure it reports is thrown"* — so the pull following a failed run's
terminal event **rejects**. The host records that failure and it does not replace, duplicate or
append to the terminal event; subscribers are released normally after it.
*Test:* a failing mock-adapter run delivers exactly one terminal event as its last event, its
subscribers are released normally, and the rejection that follows is recorded without a second
terminal event appearing anywhere.

### The gate

**AC-9 — the gate registry settles exactly one answer per pending gate and refuses everything else
before `core` sees it.**
Surface: `packages/server`. An answer is one of the closed three, correlated by the **opaque**
`gateId`. Under concurrent answers for one gate exactly one wins. An unknown run, an unknown gate, a
gate that is not pending, one already answered, one belonging to another run, and a word outside the
three are each refused **by the host**, leaving the waiting gate untouched — because reaching `core`
with a mismatched id renders *"received stale answer for …"*, which presents as an operator error
the operator did not make. The host supplies **no default answer** and **invents no timeout**:
`askGate` has none by design (*"minutes after the question was emitted — M3's human answers in a
browser"*), a timeout that advances invents a decision and one that aborts throws work away. The
only honest lever is AC-11.
*Test:* a mock-adapter run reaches a gate; `advance` lets it continue; a second answer for the same
`gateId`, an answer for a foreign gate, an unknown gate and an unknown word are each refused without
disturbing the run; two simultaneous valid answers produce exactly one settlement.

**AC-10 — a run the host started always has an answer channel.**
Surface: `packages/server`. `GateUnansweredCondition`'s `no-answer-channel` is unreachable from
`packages/cli`, which always supplies an `answerGate`; a host that started a run and then had no way
to ask would reach it. A subscriber going away is **not** nobody having been there.
*Test:* a run started by the host and taken to a gate with no subscriber attached does not end
`undecided` on `no-answer-channel`.

### Stopping and shutdown

**AC-11 — stopping one run cancels through the caller's `AbortSignal`, and the run ends
`interrupted`.**
Surface: `packages/server`. Cancellation is the caller's: *"Core installs no signal listener and
never exits the process — a library that traps SIGINT or calls `process.exit` is unusable inside
M3's daemon"* (2026-08-28). The host aborts the controller whose signal it handed `runFlow`, with a
**non-empty string reason**, because `interruptionNote` reads `signal.reason` only when it is one
and aborting with nothing silently substitutes the thrown message (`run.ts:176–180`).
*Test:* a stopped mock-adapter run records `interrupted`, keeps the worktrees it obtained (Q-0062),
and its `runs.log` note carries the reason string the host supplied.

**AC-12 — shutdown releases every live run through the abandonment path, and the host installs
nothing.**
Surface: `packages/server`. Iterator `return()` awaits interrupted-run persistence before it
resolves, so counters, occurrences and the terminal record are on disk before shutdown completes.
This is the first caller `detachPending` has ever had (§1.6). The host installs **no** process
signal handler, never calls `process.exit`, and opens **no** socket — it is a library, and the
process is successor A's.
*Test:* a host shut down with a run in flight resolves only after that run's terminal record exists
on disk; loading the package adds no process listener, counted before and after, which is the shape
`frame.source.test.ts`'s AC-4(d) block already uses; and no test in `packages/server` opens a
listening socket.

### Safety and the suite

**AC-13 — safety is inherited, never re-implemented, and no key path is added.**
Surface: `packages/server`. Worktree containment, backlog confinement (Q-0059), the run lock
(Q-0039), the stage transition, dry-run immutability (Q-0116) and the cross-vendor rule are `core`'s
and are not repeated here. `auto` is never passed unless the caller asked for it, so a
`human-locked` gate and an exhaustion gate stay unbypassable. A `dry` run passes through unchanged:
measured, it takes no lock and `askGate` auto-advances with an `info` event without calling
`answerGate` at all, so a dry walk never reaches the gate registry. No path, fixture, header,
request field, example or environment setup carries an API key; the word is **subscription**.
*Test:* a ticket token that escapes the backlog root is refused by `core` through this host rather
than by a second check here; a run driven with no `auto` reaches its declared gate; a `dry` run
completes without the gate registry being consulted; and a scan of this package finds no occurrence
of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` outside a refusal it inherits.

**AC-14 — this package's verdict is a property of the commit.**
Surface: `packages/server`. Its suite drives real runs and therefore real `git` subprocesses, which
is the most expensive and most machine-sensitive shape in the corpus. Every fixture creates the
repository it uses; nothing reads the machine's git identity, an existing `.harness/worktrees` or
`.quorum/runs`, or a public registry — *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30). The package declares **no per-file `testTimeout`
override**: `vitest.shared.js`'s chosen 20 s governs, and the comment beside it says why a local
override is how the accidental default arrived (§1.7, Q-0102).
*Test:* the suite passes under `pnpm sweep:git-identity` in both environment rows; no file in
`packages/server` sets `testTimeout` or re-declares a Vitest config beyond re-exporting the shared
one.

---

## 6. Non-goals

Each is refused for a reason, not omitted.

1. **The HTTP and WebSocket transport** — successor A (§4, Appendix A). No Hono, no node adapter, no
   `ws`, no route, no status code and no bind in this child.
2. **The read-only REST surface** — successor B (§4, Appendix B).
3. **Resumable runs after a daemon restart** — Q-0019, named separately in M3's own list. AC-3's
   handle is deliberately meaningless across a restart for that reason.
4. **Any screen** — Q-0014 onward. `apps/web` is a stub and stays one.
5. **`quorum open`** — it starts a daemon *and* a browser and belongs with the web app.
6. **Serving `apps/web`'s build output** — that app has no `build` task and emits nothing.
7. **Persisting the event stream** — `04-architecture.md` states there is none in this version, and
   adding one is a file-format decision with its own ticket. AC-7 is satisfiable without it.
8. **Widening the gate answer set, or adding a `reason` to the envelope** — §1.4. The envelope is
   `.strict()` and decision 062 closed the set at three. If an override reason is to travel, that is
   Q-0016's entry to ask for and no implementer's choice.
9. **Widening the event union** — AC-7's truncation notice travels beside the stream precisely so
   this stays true.
10. **A queue for a ticket that is already running, or reclaiming a stale lock** — the lock refuses
    and names the holder; *"it never waits, and it is never reclaimed."* Detection is Q-0114's.
11. **Changing `runFlow`, the channel, the event union, the gate mechanism, lock policy or
    cancellation ownership.** Four landed entries govern them. The host consumes; it does not
    negotiate. The one permitted `core` change is AC-2's type exports.
12. **Emitting a build artifact from `packages/server`** — the local distribution set is three
    packages.
13. **Authentication, multi-user, remote access** — the product's v1 exclusion list names
    *multi-user* and *remote daemon* explicitly, and the bind is successor A's.

---

## 7. Open questions

**None blocks solutioning.** All four of iteration 1's blockers are ruled in §1 or routed below, and
the reasoning for each reclassification is in the table at §0.

**OQ-1 (non-blocking; successor A) — the retention default.** AC-7 makes capacity a construction
parameter and proves both ends. Which value the product ships is the transport's, because the
transport is what creates a late joiner.

**OQ-2 (non-blocking; successor A) — what the process binds to.** `04-architecture.md:63` says
*"Single-user, localhost-only by default"*, which settles the default and leaves *"by default"*
dangling. Recommendation: **no configurable bind** — with no authentication, any non-loopback bind
puts a process that starts agent runs and writes to a git repository on a network, and widening
later is additive where narrowing is not.

**OQ-3 (non-blocking; successor A) — Hono, a Node adapter and a WebSocket library.** `grep` finds
neither `hono` nor `ws` in `pnpm-lock.yaml`: `04-architecture.md:28` and `:62` have named Hono since
2026-08-22 and it is a landed proposal never executed, and it is three dependencies rather than one.
Recommendation: **no decision entry owed** — an implementer executing a landed document is not
changing the architecture — with the one-line justification `.claude/rules/engineering.md` requires
recorded per package, and `@typescript-eslint/no-deprecated` applying to all three on arrival.

**OQ-4 (non-blocking; Q-0016) — does "override with reason" survive, and where does the reason go?**
§1.4. The cheap resolution is that the override **is** `advance` and the reason is an audit record,
plausibly widening the `run=N gate=… answer=…` line `askGate` already appends — which is a `core`
change and needs its own entry. The alternative supersedes a clause of *"What a run's event stream
carries"* (2026-08-28), a contract five tickets already code against. It is the gate screen's
question; the host takes the closed three either way.

---

## 8. Gate obligations

Work no step on either route may perform. This repository has recorded **sixteen** instances of a
loop handed work no agent in it can perform; the one time it was caught in advance (Q-0102 GO-1) it
saved a whole run.

- **GO-1 — the route and the role grant, before the flow is launched.** §1.5: a role's `paths` is
  advisory and `.claude/settings.json` restricts no path, so a fan-out implementer *can* write
  `packages/server` and, reading its own prose, will refuse to — which is Q-0069's and Q-0103's
  rounds burnt on correct refusals. Either grant `packages/server` to a fan-out role and run the
  full pipeline, or run it as a chore and record that the exception was taken deliberately.
  **Recommendation: the full pipeline, with the grant to `developer-backend`** — the host is
  engine-adjacent library code and `developer-tooling` is explicitly told engine internals are
  another role's — and a grant to `developer-tooling` as well if a two-vendor fan-out is wanted,
  which `harness/architecture.md` prefers over a single-role one. **M2's closing measurement argues
  for it**: the seven-stage SDLC was exercised by four tickets, three of them M1's, and M3 is the
  feature work those flows exist for. The grant is **three places per role** — the role's
  frontmatter, its prose, and `harness/architecture.md`'s table — and
  `packages/shared/src/role.test.ts` catches a partial edit. It is the human's either way.
- **GO-2 — §1.4's two documents.** `04-architecture.md:63`'s
  *"(advance/retry/override with reason)"* and `06-development-plan.md`'s M3 gate-screen line
  promise what `gateAnswerEnvelopeSchema` refuses. Neither is this ticket's surface, so the
  correction is routed rather than required here — but a numbered document promising a capability
  the code refuses is the failure this repository records most, and leaving both to Q-0016 is how
  one of them expires.
- **GO-3 — `docs/04-architecture.md`'s `packages/server` section is rewritten to what shipped**
  rather than left describing what was proposed in August, including AC-3's handle so successor A
  and Q-0014 inherit an answer rather than re-deciding one. `docs/GLOSSARY.md` gains a term only if
  this ticket introduces one; it probably does not — *run*, *gate*, *event*, *flow* and *run lock*
  all exist, and no synonym is introduced for any of them.
- **GO-4 — the merge is verified forced in both environment rows** — a checkout carrying
  `.harness/worktrees` and `.quorum/runs`, and one carrying neither — per Q-0072's closing finding,
  and **CI is green on the merged commit** per Q-0105's GO-3. A local green is not evidence:
  Q-0104 and Q-0105 were both broken on CI while every local signal was green.
- **GO-5 — successors A and B are allocated at this ticket's close**, from Appendices A and B,
  through `quorum ticket new --id` so the plan and the backlog agree. Q-0105 is the precedent; seven
  recorded directions of drift are the argument.

**No decision entry is owed before the implement step starts.** That is a change from iteration 1,
which owed three, and it is worth stating rather than leaving to be noticed: AC-3's handle is
additive and contradicts nothing; AC-7's scope reading is of a rule file whose own sibling clause
permits it, which Q-0108's precedent puts in the code's authority comment rather than in an entry;
and OQ-4's entry, if one is ever owed, is Q-0016's.

---

## 9. Risks

1. **The lazy-start trap (§1.2, §1.6).** The obvious implementation — call `runFlow`, store the
   iterable, report success — is wrong in a way **every test that starts one run will pass**. It
   shows up only with two concurrent starts, which is the case the run lock exists for. AC-4 is
   written to make it visible; a criterion saying *"a start starts a run"* would not.
2. **The fan-out is where a single-consumer stream is easiest to break.** `createEventChannel`
   throws on a second iteration, so the failure is loud — but only if something iterates twice, and
   a host that hands the iterable to a per-subscriber handler does exactly that on the **second**
   subscriber. The first subscriber is the common test. This is also why §4 refuses the
   single-watcher-first seam.
3. **Identity invented twice.** AC-3's handle is safe only while nothing else names a run. A helper
   that reads `run #N` out of the first `info` message is one line, looks harmless, and creates the
   second authority the criterion exists to forbid — and it would be *wrong* for the two refusal
   cases, where no such message is ever emitted.
4. **Backpressure.** A slow subscriber must not block the one consumer or make another lose an
   event. Whatever bound is chosen needs a measurable limit and an explicit outcome for the slow
   subscriber, not an unbounded queue per subscriber.
5. **Races with one owner.** Subscriber registration during a replay, two answers for one gate,
   shutdown while a gate is pending, and a rejection on the pull after a terminal event each produce
   a gap or a double settlement unless one component owns every state transition.
6. **Scope regrowth at implement time.** A host invites *"while I am here"* — a health check, a
   config object, a logger, a route. `developer-generalist`'s own rule covers it: *"an unrequested
   default is a decision taken on someone else's behalf."* AC-1's refusal of an external dependency
   and AC-12's refusal of a socket are the first places that will be tested.
7. **Q-0102 is live and this package is the worst possible new tenant.** That ticket is reopened at
   p1 on the measurement that added suites consume the headroom on the slowest test in the corpus,
   and this suite drives real runs with real `git` spawns. AC-14 forbids a local `testTimeout`
   override, which is the tempting local fix and the one the shared config's comment names as how
   the accidental default arrived.
8. **A criterion read as a byte contract.** Four errata across Q-0091, Q-0094 and Q-0067 were spent
   on this. The sentences here are `core`'s; nothing else pins bytes.
9. **Error drift from the CLI.** Two surfaces translating the same conditions can diverge. AC-5
   keeps the condition `core`'s and the remedy at one site, and the CLI's `fail.ts` is the shape
   rather than the source.

---

## 10. Cross-cutting checklist

| pillar | this ticket |
| --- | --- |
| **BYOS** | No key path is added. `check()` already refuses when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set, and that refusal reaches a caller through AC-5 rather than being re-implemented. AC-13 asserts it. The word is **subscription**. |
| **Worktree safety** | Unchanged and inherited. This package writes nothing to the user's working tree; every write is `core`'s, inside a worktree under `.harness/worktrees/`. AC-11 preserves Q-0062's rule that an unfinished run keeps its worktrees. |
| **Gate behaviour** | Human-gated by default is untouched. The answer set stays exactly `advance \| retry \| abort`. `human-locked` never auto-advances and an exhaustion gate cannot be bypassed — the host passes no `auto` it was not asked for (AC-13). |
| **Confinement / run lock** | Both are `core`'s and inherited rather than re-checked. A ticket id from a request body reaches `Backlog` and is refused there if it escapes the root (Q-0059); a second run on one ticket is refused by the lock (Q-0039). AC-4 and AC-5 are about **reporting** those refusals, never repeating them. |
| **Files are the database** | AC-7's buffer is transient coordination state, discarded on close, an authority for nothing, and permitted by the same principle that forbids hidden state (§1.3). Principle 4's *"stateless across restarts"* is satisfied by AC-3's handle being meaningless across one. |
| **File format and schema** | No new persisted file and no schema change. `gateAnswerEnvelopeSchema` and `eventSchema` are consumed unaltered, and AC-7's notice is deliberately not an `Event`. |
| **Lint rules** | `eslint.config.js` already covers `packages/**/*.ts`, so the new source is linted on arrival with no configuration change. |
| **Turbo inputs** | If this child's suite reads a file outside `packages/server`, that read is declared in a new `packages/server/turbo.json` beside `$TURBO_DEFAULT$`. `turbo-inputs.test.ts` is what fails otherwise — four tickets have earned a registration on the way in, and it is the machinery working rather than an obstacle. |
| **Cold-clone impact** | **None, and deliberately.** The README path is `quorum init` → `quorum run`; nothing here changes it, and `quorum open` is a non-goal precisely because it is the command that would lengthen a stranger's first 30 minutes. AC-1's refusal of an external dependency keeps install size where it is. |
| **Product-agnostic** | No reference to any SaaS product; no adapter-specific or vendor-specific behaviour anywhere in this package. |

---

## 11. Provenance

**The Claude candidate supplied the foundation**: the export-gap measurement and its four
`ReturnType<typeof loadProject>` sites, the transport seam and the argument for running the risky
half first, the lazy-start finding, the `detachPending` observation, the *"a criterion's Test clause
bounds the instrument"* discipline, and Appendix B's body.

**The codex candidate supplied the sharper contracts**, and four survive largely intact because they
are better than their counterparts: exactly-once fan-out with explicit slow-subscriber isolation
(AC-6), terminal-then-close with a thrown post-terminal pull that must not join the terminal event
(AC-8) — the sharpest single criterion in either document, drawn from `channel.ts`'s own
drain-before-settle guarantee — the gate refusal cases and the answer race (AC-9), and shutdown that
awaits interrupted-run persistence before it resolves (AC-12). Its instinct that `gateId` is opaque
and must not be parsed is carried into AC-3. Three of its clauses are refused with reasons: its
`PUT /runs/{runId}/gates/{gateId}` contradicts `04-architecture.md:63`; its AC-15 asks for work
already on disk (§1.8); and its seam builds the defect §9 risk 2 names.

**Iteration 1 supplied the size ruling, which is carried unchanged and not re-argued**, and the four
questions this iteration re-examined. Its own corrections are recorded rather than quietly applied,
because how a claim got into a document is the point (Q-0099): **B-2's rule conflict is one
principle read as two** (§1.3); **B-3's three documents are two, the third saying in its own second
sentence that it is a mockup** (§1.4); and **B-4's mechanism is wrong — `paths` is advisory, read by
nothing, guarded against a production reader, and `.claude/settings.json` restricts no path**
(§1.5). None of the three reversals is on the merits: every recommendation iteration 1 made is
carried into the criteria, and what moved is where it sits — which is the Q-0105 shape exactly.

**This document's own measurement is §1.2**, and it is what turns B-1 from a question into a ruling:
the stage precondition throws *above* `nextRunId`, and `nextRunId` is read above the lock with a
comment saying a refused contender never uses the number it read. So **both** pre-stream refusals
are cases where `core` has no run id to give, and the option iteration 1 called the cheap one is the
only one that can name the two runs AC-4 and AC-5 exist for.

**A second is AC-2's shape.** Both candidates and iteration 1 hand-wrote a five-name list.
`RunStatus` is not among the names a host needs — `RunTerminalEvent` already carries a typed status
from `@quorum/shared` — so the criterion derives the list from the host's own source instead, which
is the lesson Q-0051's fail-open array, Q-0093's per-package register and Q-0108's classifier each
paid for separately.

---

## Appendix A — successor A's body, written out in full

*Transcribed rather than referenced, so the obligation cannot expire in a closed ticket's entry.
Allocate through `quorum ticket new --id` at this ticket's close (GO-5).*

### The daemon speaks HTTP and WebSocket

Q-0013 built the run host: an in-process registry that starts a run, owns its identity, fans one
single-consumer stream out to N subscribers, settles a gate answer out of band, stops a run and
releases everything on shutdown. What it has no way to do is be reached from a browser.

**What this child adds**: the Hono app, its Node adapter and a WebSocket transport — three
dependencies, none in the lockfile today, each owing the one-line justification
`.claude/rules/engineering.md` requires and **no decision entry**, because `docs/04-architecture.md`
chose Hono on 2026-08-22 and executing a landed document is not changing the architecture (Q-0013
OQ-3).

**The routes are the document's, not an implementer's**: `POST /runs` (start),
`POST /runs/:id/gate`, `POST /runs/:id/stop` — `04-architecture.md:63`, which is the authority until
an entry displaces it. **What `:id` names is Q-0013 AC-3's handle**, inherited rather than
re-decided, and `04-architecture.md` is where that is written down.

**What it owes beyond routing to the host.** Request validation with a stable shape — unknown field,
malformed JSON, wrong type, missing ticket, missing flow — each answered with a code, a
human-readable message and a remedy, and **starting nothing**. A status mapping in which a lock
refusal is distinguishable from a bad request and from a missing ticket, over a host that already
reports both refusals with `core`'s own condition. The WebSocket path and its message envelope: one
event per message, JSON, parsing under `@quorum/shared`'s `eventSchema`, with no ANSI, no rendering
and no vendor branching — `04-architecture.md:70` already states the rule this is the other half of:
*"a lint record reaching a terminal, a browser and a WebSocket carries an escape byte in exactly one
of the three."* **The retention default** (Q-0013 OQ-1), which this child decides because it is the
child that creates a late joiner, and a way for a client to be told it missed events that does not
put a non-`Event` value on the event channel. The loopback bind, per Q-0013 OQ-2: `127.0.0.1` and no
configurable alternative, because with no authentication a non-loopback bind puts a process that
starts agent runs and writes to a git repository on a network. A per-subscriber backpressure bound
with a measurable limit and an explicit outcome. And `04-architecture.md`'s `packages/server`
section rewritten to what shipped, because Q-0014 codes against it.

**Non-goals.** Everything Q-0013 made a non-goal, unchanged, plus: the read-only REST surface
(successor B), serving `apps/web`'s build output (nothing to serve until that app emits), and
authentication.

**Blocked by** Q-0013, which creates the host, the identity and the error mapping this exposes.
**Blocks** Q-0014, which is the first client of the wire shape.

---

## Appendix B — successor B's body, written out in full

*From the Claude candidate's Appendix A, measurements re-verified 2026-09-11.*

### The server serves the project, the backlog, the flow set and run history

`packages/server` starts, stops and streams runs, and speaks HTTP. What it cannot answer is every
question that does not involve a live run: what project is open, what tickets exist, which flows are
runnable, and what previous runs did.

**Everything it needs is already on `@quorum/core`'s barrel**, which is why this is the last child
rather than the first — it is the half that needs nothing added:

| question | symbol | note |
| --- | --- | --- |
| what project is open | `loadProject`, `findProject` | throws `ProjectNotFoundError`, which Q-0013 AC-5 already maps |
| what tickets exist | `Backlog.list()` | `Backlog.read` **asserts rather than parses** (Q-0043 AC-4), so a damaged `ticket.md` reads as a ticket with no fields — **Q-0060**, and this surface is exactly the one that ticket names as the reason it matters |
| which flows are runnable | `lintFlowDirectory` | a flow the linter refuses is **named and not hidden**, per Q-0055 AC-16; `record.problems.length` is the classifier, not `record.flow !== undefined` |
| what previous runs did | `readRunsDir`, `sortRuns`, `isIncomplete`, `readRun` | `readRun` is the single-run read Q-0092 added so a detail request is not coupled to the health of siblings it did not ask about |
| what a run cost | `occurrenceSeq`, `vendorTokenTotal` | per vendor; a blended number is refused by *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) |
| where the code is | `containment`, `pushLag` | derived per invocation and **never stored** |

**What it owes beyond routing them.** Three things, none of them a formatter moved from the CLI:
containment and push lag are derived **per invocation and never stored** (2026-08-24, 2026-09-06),
so a board over HTTP computes them per request or does not report them — caching either makes it a
stored fact, which both entries forbid. A run-history read may report a store warning and still
return the listing, which is `failSoftly`'s distinction in `packages/cli/src/fail.ts`, and its HTTP
analogue is a decision. And an incomplete `running` manifest is **reported rather than repaired**
(`docs/04-architecture.md`): a server must not tidy one on read.

**Non-goals.** Writing anything — no ticket creation, no stage change, no flow edit; the UI edits
files through a later ticket and never holds the truth. Authentication and any non-loopback bind.
Serving `apps/web`'s build output.

**Blocked by** successor A, which creates the transport and the error mapping this extends.
**Related:** Q-0060 — a damaged `ticket.md` reading as a ticket with no fields is latent at a
terminal and reachable over HTTP; this surface is the reason that ticket is triaged into M3.
