# Q-0013 — The server package runs flows, streams their events and answers their gates

*Merged requirement, run 1, iteration 1, 2026-09-11. Verdict: **needs-input** — four blockers in §6,
and a size ruling in §3 that cuts this into three children. Surfaces: `packages/server` (new),
`packages/core/src/index.ts` (public API), `docs/04-architecture.md`, `harness/roles/` (routing only).*

---

## 0. What was measured, and where it corrects the inputs

Every claim below was re-run against the tree on 2026-09-11 and none is transcribed from the ticket
body, the development plan or a decision entry — *"a measurement copied from a document is not a
measurement"* (Q-0099). Where an absence is reported, the probe that looked is named, per *"A probe
that could not answer is not a negative"* (2026-09-10).

**0.1 — The export gap is five names, not one, and the ticket body is wrong about a sixth thing.**
`packages/core/src/index.ts` carries none of `AnswerGate`, `RunFlowOptions`, `Project`,
`TicketRecord`, `RunStatus`. **It also does not star-export `@quorum/shared`** — it re-exports
exactly one type from it, `CliVersionResult` — so the ticket body's *"`Event` and `RunTerminalEvent`
come from `@quorum/shared` through a star export"* is false of the mechanism: `packages/cli/src/run.ts:31`
imports them from `@quorum/shared` **directly**. The server therefore declares **two** workspace
dependencies, not one.

The workaround is already in the tree at four sites — `adapters.ts:49`, `board.ts:44`,
`ticket.ts:59`, `run.ts:228` each spell the project type `ReturnType<typeof loadProject>`. A command
holds a project for one statement; a daemon holds a project, a ticket and a live run in a map for
the lifetime of the process. `AnswerGate` has no `ReturnType` trick at all: it is a parameter type,
reachable only as `Parameters<typeof runFlow>[0]['answerGate']`.

**It cannot disturb Q-0092's register.** The barrel's own docblock states the rule — *"A type export
adds no runtime key, so the surface `package.test.ts` counts is the value list above and nothing
else."* All five are type-only, so the twenty-nine value symbols do not move.

**0.2 — Only the `terminal` event carries run identity, and this is the finding that reshapes the
ticket.** Measured in `packages/shared/src/events.ts`: `runTerminalCommonShape` declares
`runId: z.number()`, and **no other member of the union carries it**. The first thing a run emits is
`info` with the message text `run #N  flow=…  ticket=…` (`engine.ts:340`) — prose, not a field — and
`gateId` is `${runId}:${n}` (`engine.ts:329`), which is documented as *"opaque"* and which a
consumer must not parse. So a start response **cannot report core's run id** without parsing prose,
reading a second authority, or changing `core`. `docs/04-architecture.md:63` names three routes over
`/runs/:id`, and what that `:id` is has never been decided. **B-1.**

**0.3 — Three documents promise a gate action the shipped envelope refuses.**

| document | what it says |
| --- | --- |
| `docs/04-architecture.md:63` | `POST /runs/:id/gate` (advance/retry/**override with reason**) |
| `docs/05-design-prompt.md:35` | *"Advance anyway" (override, requires a one-line reason)* |
| `docs/06-development-plan.md` M3 | gate screen (… advance / take the other / **override with reason**) |

Against the code: `gateAnswerEnvelopeSchema` (`events.ts:195`) is `z.object({ gateId, answer }).strict()`,
`gateAnswerSchema` is the closed enum `['advance','retry','abort']`, and `askGate`
(`routing.ts:41–47`) `safeParse`s the returned value and raises *"received an invalid answer"*.
A strict schema rejects an unknown key, so a `reason` on the envelope fails the run. A decision entry
outranks a numbered document, so **062 wins and three documents are wrong** unless a new entry widens
the envelope. **B-3.**

**0.4 — `runFlow` is lazy, so the two refusals a start must report happen on the first pull.**
`createEventChannel(start, …)` runs `start()` on the first `next()` (`channel.ts:96–99`), and only
then does `run()` evaluate the stage precondition (`engine.ts:221`) and take the run lock (`:246`).
Both throw `FlowError` **before any event is emitted**, so the stream rejects with no `terminal`
event at all. A host that calls `runFlow`, stores the iterable and reports success has started
nothing — the ticket is not locked, so a second start for the same ticket also succeeds, and both
fail later where no caller is listening. *"A run holds a lock on its ticket"* (2026-09-09) is
inherited **only if the host pulls before it answers**.

`channel.ts`'s `detachPending` already names this consumer: *"Unreachable from `for await` …
reachable from `Promise.race([it.next(), shutdown])`, **which is the shape a daemon uses**."* That
path has never had a caller.

**0.5 — `engine.ts:194–219` names this ticket in production JSDoc**, from Q-0116, landed the day
before: *"M3's server is the first that will hold one across runs and answer a `GET` from it."*
Confirmed present; nothing here re-litigates it.

**0.6 — No `hono` and no `ws` in `pnpm-lock.yaml`.** `grep -c` returns 0 for both.
`docs/04-architecture.md:28` and `:62` have named Hono since 2026-08-22 — it is a landed proposal
that has never been executed, and it is three dependencies rather than one: Hono is
runtime-agnostic and needs a Node adapter and a WebSocket transport beside it.

**0.7 — No role the development fan-out can resolve may write `packages/server`.**

| role | `paths:` | grants `packages/server`? |
| --- | --- | --- |
| `developer-generalist` | `…, packages, apps, harness, docs, …` | **yes**, via `packages` |
| `developer-backend` | `packages/core, packages/shared, harness, docs, backlog` | no |
| `developer-tooling` | `packages/core, packages/shared, packages/cli` | no |
| `developer-frontend` | `apps/*, packages/ui, packages/i18n` | no |

`development.yaml:9` resolves `role: "developer-{role}"` from `tasks.yaml`, and
`harness/architecture.md:33` states that **`generalist` is not a fan-out role** — `chore.yaml`'s
`implement` runs it alone. So the full pipeline cannot write this ticket's only directory, and the
chore route can but is told by its own role prose not to take behaviour work. **B-4.**

**0.8 — One inherited criterion asks for work already on disk.** The codex candidate's AC-15 requires
removing the `Q-0013` row from `plan-backlog.test.ts`'s `UNCREATED` register. That register runs
`Q-0012`, `Q-0014`…`Q-0019` — the row went with the folder, and the suite's own second direction
(*"the register names only uncreated bullets"*) would already be red if it had not. A criterion over
it would be satisfied by the tree before an implementer started, which is an unfalsifiable criterion
rather than a small one. Struck.

**0.9 — One inherited route contradicts a numbered document.** The codex candidate's AC-10 specifies
`PUT /runs/{runId}/gates/{gateId}`; `docs/04-architecture.md:63` specifies `POST /runs/:id/gate`.
Under *"When code and docs disagree, the docs are wrong until a DECISIONS.md entry says otherwise"*,
the document is the authority and the route shapes are **not an implementer's choice**. The verb and
path stay the document's; the *gate correlation* travels in the body, which is what this repository's
own `gateId` already is.

---

## 1. Problem

`packages/server/src/index.ts` is `export const name = '@quorum/server';` and its `package.json`
declares no dependencies at all. Everything M3 promises — mission control, the gate screen, run
history in a browser — is downstream of a process that does not exist.

There is one way to run a flow: `quorum run`, at a terminal, where the gate is a readline prompt and
the trace is ANSI on stdout. A run that reaches a gate holds a terminal hostage until somebody types
a word. Nothing persists the event stream (`docs/04-architecture.md`), so a run nobody watched
cannot be watched afterwards, two people cannot watch the same run, and one person cannot watch it
from two places.

What is missing is not the screens. It is the thing underneath them: something that starts a run,
consumes its **single-consumer** stream exactly once, fans it out to whoever is watching, and carries
an answer from somewhere else entirely back into the promise a run is parked on — without
re-implementing, weakening or negotiating with any of the four landed entries that govern those
mechanisms.

---

## 2. User stories

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

## 3. Size ruling: three children, and this one is the run host

**Not approved at the size either candidate proposes.** Measured against the work, the live half
alone — the export gap, the process, the bind, starting a run against a lazy stream, reporting the
two pre-stream refusals, request validation, fanning a single-consumer stream out to N watchers, the
late-joiner policy, the WS message contract, terminal-and-close, answering a gate over HTTP with its
five refusal cases, stopping a run, shutting down, and error mapping — is **eighteen independently
testable criteria**. Q-0091 split at twenty-one and Q-0096 at twenty-one, **both at their gate and
both at cost**. This repository has recorded catching that before the money was spent exactly once
(Q-0102 GO-1).

**The seam is the transport, and the risk argument decides which side runs first.** Three children:

| | ticket | what it is | why here |
| --- | --- | --- | --- |
| 1 | **Q-0013 (this)** | the **run host**: the export gap, an in-process registry that starts a run against the lazy stream, owns its identity, fans one stream out to N subscribers, holds the gate registry and settles an answer out of band, stops one run, and releases everything on shutdown | carries **every unretired risk** — lazy start, single-consumer fan-out, out-of-band answer, the abandonment path — and needs **no new external dependency**, so the dependency decision does not ride on the risky half |
| 2 | **successor A** | the **HTTP + WebSocket transport**: the three routes `04-architecture.md` already names, the WS message envelope, request validation and status mapping, the loopback bind, and the protocol contract Q-0014 codes against | ordinary Hono work over a host whose behaviour is already proved; it is where the **product** decisions (wire shapes, bind, dependencies) live, and it is what Q-0014 depends on |
| 3 | **successor B** | the **read-only REST surface**: project, backlog, runnable flows, run history | needs **nothing added to `core`** — every symbol is already on the barrel — which is why it goes last rather than first |

*"Milestones are ordered by risk, not by screen"* is this plan's own rule, and **the export gap
belongs with whichever half runs first**, which is child 1.

**The codex candidate's alternative seam is refused with a reason.** It proposes keeping
single-watcher streaming here and deferring multi-watcher fan-out and replay. That builds the exact
defect §8 risk 2 names — a host that hands the iterable to a per-connection handler is correct for
one watcher and throws `FlowError` on the second — and the follow-up would rewrite the first child's
centre. The fan-out is not an enhancement of single-watcher streaming; it is the thing that makes
single-consumer safe.

**Appendices A and B are the two successors' bodies, written out in full**, because an obligation
recorded only in a closed ticket's entry expires — this plan records seven directions of that drift,
and Q-0105 is the counter-example that avoided it by opening its successors at its own close.

---

## 4. Acceptance criteria

Thirteen, numbered continuously so a criterion keeps its name if the cut moves. Each names its
surface. **Every *Test:* clause bounds the instrument and nothing more** — a reviewer may find the
instrument fails the job the clause gives it, and may not raise the job (Q-0067 erratum E-1). Nothing
here pins bytes: a requirement describes what must be conveyed, and only a fixture, a frozen
contract's own file, or a criterion quoting bytes pins bytes (Q-0094 E-3).

### The package and the public API

**AC-1 — `@quorum/server` declares what it depends on, and resolves.**
Surface: `packages/server/package.json`. It gains `@quorum/core` **and** `@quorum/shared` at
`workspace:*` — both, per §0.1 — and **no external dependency**, which is child 2's. It declares no
`build` task and emits nothing: the local distribution set is three packages and this ticket does not
make it four.
*Test:* a `packages/server` test imports `runFlow` from `@quorum/core` and `eventSchema` from
`@quorum/shared` and both resolve under the `quorum-source` condition; `packages/cli/src/build.test.ts`'s
per-package emit register is unchanged.

**AC-2 — `@quorum/core` publishes the five types a host must name, and the value surface does not
move.**
Surface: `packages/core/src/index.ts`. `AnswerGate`, `RunFlowOptions`, `Project`, `TicketRecord` and
`RunStatus` are exported as **types**, each with the one-line-per-addition rationale the barrel's own
docblock requires — a name is added because a consumer needs it, not because its module exports it.
*Test:* a `packages/server` module annotates its own gate callback `AnswerGate`, named directly and
not as `Parameters<typeof runFlow>[0]['answerGate']`, and `packages/cli/src/package.test.ts`'s
derived value-surface assertion is unchanged and still green at twenty-nine.

### Starting a run

**AC-3 — starting a run is a function call, and no test in this child binds a port or depends on the
machine.**
Surface: `packages/server`. The host is constructed and driven in process. Every fixture creates the
repository it uses; nothing reads the machine's git identity, an existing `.harness/worktrees` or
`.quorum/runs`, or a public registry — *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30).
*Test:* the suite passes under `pnpm sweep:git-identity`, and no test in `packages/server` opens a
listening socket.

**AC-4 — a start does not report success until the run is actually under way.**
Surface: `packages/server`. `runFlow` is lazy (§0.4): the stage precondition and the run lock are
evaluated on the first pull, so the host begins consuming and waits for the run to be under way
before it answers its caller.
*Test:* two starts for one ticket, the second issued after the first has answered, produce **one**
started run and **one** refusal; the refusal carries `core`'s own sentence, which names the holding
run, flow, pid, host and start time.

**AC-5 — a refusal that reaches no `terminal` event is reported with the condition `core` gave.**
Surface: `packages/server`, and one module that owns any remedy. The two are the stage precondition
(`engine.ts:221`) and the run lock (`:246`); neither is rewritten, paraphrased or classified by
message text. *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07)
was ruled **for this surface**, and `packages/cli/src/fail.ts`'s `dieNoProject` is the shape — one
site, taking the condition as a **string** so the module names no `core` symbol. A server's remedy is
not a shell imperative: the entry's own reasoning is that this surface serves *"somebody who may not
have a shell"*.
*Test:* a ticket whose stage the flow does not consume is refused, the sentence is byte-identical to
the `FlowError`'s, `ProjectNotFoundError` reaches a caller as `core`'s sentence plus this surface's
remedy composed at one site, and `quorum init`'s imperative appears in no response this package
produces.

**AC-6 — every run the host starts carries the identity B-1's ruling gives it, and that identity is
what a later `/runs/:id` means.**
Surface: `packages/server`. Only the `terminal` event carries `runId`; the first `info` carries it as
prose and `gateId` embeds it while being documented opaque (§0.2). Whatever the ruling chooses, the
host never parses an event's message text and never allocates a run number itself — two authorities
for run identity is the failure this criterion exists to forbid.
*Test:* the identity a start returns satisfies the entry, the assertion cites it by title and date,
and a scan of this package finds no read of an `info` message's text and no call that allocates a run
number.

### The stream

**AC-7 — the host is the stream's one consumer, and subscribers are its own fan-out.**
Surface: `packages/server`. `createEventChannel` throws a named `FlowError` on a second
`[Symbol.asyncIterator]()` and on a re-entrant `next()`; the host iterates **once** per run and
distributes. Each event is delivered exactly once to every subscriber registered when it is
published; per subscriber, delivery preserves the order the host consumed in; a slow subscriber
cannot make another miss, duplicate or reorder events. No ordering claim is made that `core` does not
make — parallel members have no global ordering promise.
*Test:* two simultaneous subscribers on one run each receive every event exactly once in consumption
order, a run containing a `parallel:` step is covered without asserting an order core does not
promise, and the run's stream was iterated exactly once.

**AC-8 — a subscriber that arrives mid-run receives what B-2's ruling says, and whatever state that
needs is bounded and named.**
Surface: `packages/server`. Nothing persists the event stream, so a replay can only come from memory,
and `harness/rules.md`'s *"no hidden state in the daemon"* is the constraint it sits against (see
B-2). Whatever is chosen, a late subscriber is never handed a silently truncated stream: if a replay
is unavailable it is **told so**, because silence that means two things is the defect this repository
has recorded most.
*Test:* a subscriber attached after events have been consumed observes what the entry says it
observes, with no gap and no duplicate at the replay-to-live boundary, and the assertion cites the
entry by title and date.

**AC-9 — the terminal event is the last one, and a failure after it neither replaces nor joins it.**
Surface: `packages/server`. `channel.ts` drains the queue before it settles, *"which is what lets a
terminal event be observed before the failure it reports is thrown"* — so the pull following a failed
run's terminal event **rejects**. That failure is recorded by the host and does not replace,
duplicate or append to the terminal event; subscribers are released normally after it.
*Test:* a failing mock-adapter run delivers exactly one terminal event as its last event, its
subscribers close normally, and the rejection that follows is recorded without a second terminal
event appearing anywhere.

### The gate

**AC-10 — the gate registry settles exactly one answer per pending gate, and refuses everything else
before `core` sees it.**
Surface: `packages/server`. An answer is one of the closed three, correlated by the **opaque**
`gateId`, which is never parsed for the run id or sequence it currently embeds. Under concurrent
answers for one gate exactly one wins and the rest are refused. An unknown run, an unknown or
not-pending or already-answered gate, a gate belonging to another run, and a word outside the three
are all refused **by the host**, leaving the waiting gate untouched — because reaching `core` with a
mismatched id renders *"received stale answer for …"*, which presents as an operator error the
operator did not make. The host supplies **no default answer** and **invents no timeout**: `askGate`
has none by design (*"minutes after the question was emitted — M3's human answers in a browser"*), a
timeout that advances invents a decision and one that aborts throws work away. The only honest lever
is AC-12.
*Test:* a mock-adapter run reaches a gate; `advance` lets it continue; a second answer for the same
`gateId`, an answer for a foreign gate, an unknown gate and an unknown word are each refused without
disturbing the run; two simultaneous valid answers produce exactly one settlement.

**AC-11 — a run the host started always has an answer channel.**
Surface: `packages/server`. `GateUnansweredCondition`'s `no-answer-channel` is unreachable from
`packages/cli`, which always supplies an `answerGate`; a host that started a run and then had no way
to ask would reach it. A subscriber going away is **not** nobody having been there.
*Test:* a run started by the host and taken to a gate with no subscriber attached does not end
`undecided` on `no-answer-channel`.

### Stopping and shutdown

**AC-12 — stopping one run cancels through the caller's `AbortSignal`, and the run ends
`interrupted`.**
Surface: `packages/server`. Cancellation is the caller's: *"Core installs no signal listener and
never exits the process — a library that traps SIGINT or calls `process.exit` is unusable inside M3's
daemon"* (2026-08-28). The host aborts the controller whose signal it handed `runFlow`, with a
**non-empty string reason**, because `interruptionNote` reads `signal.reason` only when it is one and
aborting with nothing silently substitutes the thrown message (`run.ts:176–180`).
*Test:* a stopped mock-adapter run records `interrupted`, keeps the worktrees it obtained (Q-0062),
and its `runs.log` note carries the reason string the host supplied.

**AC-13 — shutting the host down releases every live run through the abandonment path, and installs
nothing.**
Surface: `packages/server`. Iterator `return()` awaits interrupted-run persistence before it
resolves, so counters, occurrences and the terminal record are on disk before shutdown completes.
This is the first caller `channel.ts`'s `detachPending` has ever had (§0.4). The host installs **no**
process signal handler and never calls `process.exit`.
*Test:* a host shut down with a run in flight resolves only after that run's terminal record exists
on disk; loading the package adds no process listener, counted before and after, which is the shape
`frame.source.test.ts`'s AC-4(d) block already uses.

### Safety

**AC-14 — safety is inherited, never re-implemented, and no key path is added.**
Surface: `packages/server`. Worktree containment, backlog confinement (Q-0059), the run lock
(Q-0039), the stage transition, dry-run immutability (Q-0116) and the cross-vendor rule are `core`'s
and are not repeated here. `auto` is never passed unless the caller asked for it, so a `human-locked`
gate and an exhaustion gate stay unbypassable. No path, fixture, header, request field, example or
environment setup carries an API key; the word is **subscription**.
*Test:* a ticket token that escapes the backlog root is refused by `core` through this host rather
than by a second check here; a run driven with no `auto` reaches its declared gate; and a scan of
this package finds no occurrence of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` outside
a refusal it inherits.

---

## 5. Non-goals

Each is refused for a reason, not omitted.

1. **The HTTP and WebSocket transport** — successor A (§3, Appendix A). No Hono, no node adapter, no
   `ws`, no route, no status code and no bind in this child.
2. **The read-only REST surface** — successor B (§3, Appendix B).
3. **Resumable runs after a daemon restart** — Q-0019, named separately in M3's own list.
4. **Any screen** — Q-0014 onward. `apps/web` is a stub and stays one.
5. **`quorum open`** — it starts a daemon *and* a browser and belongs with the web app.
6. **Serving `apps/web`'s build output** — that app has no `build` task and emits nothing, so there
   is nothing to serve; `04-architecture.md:63` already scopes this to M3 rather than to now.
7. **Persisting the event stream** — `04-architecture.md` states there is none in this version, and
   adding one is a file-format decision with its own ticket. AC-8 must be satisfiable without it.
8. **Widening the gate answer set, or adding a `reason` to the envelope** — §0.3. The envelope is
   `.strict()` and decision 062 closed the set at three. If an override reason is to travel, that is
   B-3's entry and not an implementer's choice.
9. **A queue for a ticket that is already running, or reclaiming a stale lock** — the lock refuses and
   names the holder; *"it never waits, and it is never reclaimed."* Detection is Q-0114's.
10. **Changing `runFlow`, the channel, the event union, the gate mechanism, lock policy or
    cancellation ownership.** Four landed entries govern them. The host consumes; it does not
    negotiate. The one permitted `core` change is AC-2's five type exports, and B-1 may add one more
    — which is precisely why B-1 is a blocker rather than an implementer's call.
11. **Emitting a build artifact from `packages/server`** — the local distribution set is three
    packages.
12. **Authentication, multi-user, remote access** — the product's v1 exclusion list names *multi-user*
    and *remote daemon* explicitly, and the bind is successor A's.

---

## 6. Open questions

**B-1 to B-4 block solutioning.** Under `harness/product-context.md`'s rule, a question that would
change a file format, a shipped contract, or what a flow may write is a blocker rather than a
footnote.

**B-1 (blocker; owner: human, at this gate) — what identifies a run before its terminal event?**
Measured (§0.2): only `terminal` carries `runId`; the first `info` carries it as prose; `gateId`
embeds it and is documented opaque. `docs/04-architecture.md:63` routes over `/runs/:id` and has
never said what that is. Three candidates, and they are not equivalent:
*(a)* the host mints its own opaque handle, correlates core's `runId` when the terminal event
arrives, and `04-architecture.md`'s `:id` is documented as the handle — **no `core` change**, and the
handle is meaningless across a restart, which is honest because Q-0019 has not happened;
*(b)* `core` reports the run id structurally at start — a new member of the union, or `runFlow`
returning `{ runId, stream }` — which **supersedes a clause of decision 062** and needs its own entry;
*(c)* the host derives it from `nextRunId`, which is **refused here and should not be reconsidered**:
it creates a second authority for run identity, and a contender refused by the lock would hand a
caller a number another run is using.
Recommendation: *(a)*. It is additive, it needs no entry, and *(b)* stays available later without
anything shipped under *(a)* having to be un-shipped.

**B-2 (blocker; owner: human, at this gate) — what does a subscriber that arrives mid-run receive,
and what may the host hold to give it?**
Nothing persists the event stream, so a replay comes from memory. `04-architecture.md` principle 3
permits *"an in-memory index rebuilt from disk on start"*; `harness/rules.md` says *"no hidden state
in the daemon."* An event buffer is state that **cannot** be rebuilt from disk, so it sits exactly on
that line. Candidates: the live tail only; a bounded per-run buffer with a stated count, byte or time
limit and an explicit answer when replay is no longer available; or the run's on-disk manifest as a
snapshot followed by the live tail — the only option needing no new state, because `readRun` already
exists, though a manifest is not the event stream and a mid-run one is deliberately `running` and
incomplete. **Unbounded-until-shutdown is refused as an implicit default**: it is a memory leak
proportional to trace verbosity, and both candidates independently flagged it.

**B-3 (blocker; owner: human, at this gate) — does "override with reason" survive, and where does
the reason go?**
§0.3: three documents promise it and `askGate` refuses it. The cheap resolution the design prompt
itself suggests is that the override **is** `advance` and the reason is an audit record — plausibly a
`runs.log` line beside the `run=N gate=… answer=…` that `askGate` already appends — in which case
**three documents are corrected** and no schema moves. The alternative supersedes a clause of *"What
a run's event stream carries"* (2026-08-28), a contract five tickets already code against. It blocks
here rather than at the gate screen because the host owns the answer that reaches `answerGate`, and
Q-0016 will code against whatever is decided.

**B-4 (blocker; owner: human, before launch) — which route runs this, and is its implementer allowed
to write `packages/server`?**
§0.7. Through the full pipeline, **no role the fan-out can resolve may write this ticket's only
directory** — `harness/architecture.md:66–68` names the consequence in advance: *"a file no task owns
cannot be fixed by anyone, and the development loop will spend its whole iteration budget discovering
that."* That is *"A requirement may not name a surface its flow cannot write"* (2026-08-25) arriving
**before** the requirement rather than after it. The two answers: grant `packages/server` to a
fan-out role — one line in **three** places, because `packages/shared/src/role.test.ts` asserts the
frontmatter, `harness/architecture.md`'s third column and the role's own prose all agree — and run
the full pipeline; or run it as a chore and record that the exception was taken deliberately. **M2's
closing measurement argues for the first**: the seven-stage SDLC was exercised by four tickets, three
of them M1's, and M3 is the feature work those flows exist for. Either way the grant must exist
**before** the fan-out runs.

**OQ-5 (non-blocking; successor A) — what the process binds to.** `docs/04-architecture.md:63` says
*"Single-user, localhost-only by default"*, which settles the default and leaves *"by default"*
dangling. Recommendation: **no configurable bind** — with no authentication, any non-loopback bind
puts a process that starts agent runs and writes to a git repository on a network, and widening later
is additive where narrowing is not.

**OQ-6 (non-blocking; successor A) — Hono, a Node adapter and a WebSocket library.** None is in the
lockfile (§0.6). Recommendation: **no decision entry owed** — `04-architecture.md` chose Hono in
August and an implementer executing a landed document is not changing the architecture — with the
one-line justification `.claude/rules/engineering.md` requires recorded per package, and
`@typescript-eslint/no-deprecated` applying to all three on arrival.

**OQ-7 (non-blocking; successor A) — is the wire shape the stable M3 contract?** The three route
shapes are already `04-architecture.md`'s and are not an implementer's choice (§0.9). The WS path and
message envelope are new, and Q-0014 will code against them, so they are recorded in
`04-architecture.md` in the change that lands them rather than discovered by the first client.

---

## 7. Gate obligations

Work no step on either route may perform. This repository has recorded **sixteen** instances of a
loop handed work no agent in it can perform; the one time it was caught in advance (Q-0102 GO-1) it
saved a whole run.

- **GO-1** — B-1's, B-2's and B-3's rulings land **before** the implement step starts, and their
  presence is verified in that step's actual prompt rather than assumed. Q-0097 lost two errata by not
  making that check; Q-0115 made it and recorded the count.
- **GO-2** — B-4 is answered and, if the full pipeline is chosen, the role grant is committed first,
  in all three places.
- **GO-3** — §0.3's three documents are corrected in the change that lands B-3's ruling, or that
  ruling explains why they stand. A numbered document promising a capability the code refuses is the
  failure this repository records most.
- **GO-4** — the merge is verified forced in **both** environment rows — a checkout carrying
  `.harness/worktrees` and `.quorum/runs`, and one carrying neither — per Q-0072's closing finding,
  and **CI is green on the merged commit** per Q-0105's GO-3. A local green is not evidence: Q-0104
  and Q-0105 were both broken on CI while every local signal was green.
- **GO-5** — `docs/04-architecture.md`'s `packages/server` section is rewritten to what shipped rather
  than left describing what was proposed in August, and `docs/GLOSSARY.md` gains a term only if this
  ticket introduces one. It probably does not: *run*, *gate*, *event*, *flow* and *run lock* all exist
  already, and no synonym is introduced for any of them.
- **GO-6** — successors A and B are allocated at this ticket's close, from Appendices A and B, through
  `quorum ticket new --id` so the plan and the backlog agree. Q-0105 is the precedent; seven recorded
  directions of drift are the argument.

---

## 8. Risks

1. **The lazy-start trap (§0.4).** The obvious implementation — call `runFlow`, store the iterable,
   report success — is wrong in a way **every test that starts one run will pass**. It shows up only
   with two concurrent starts, which is the case the run lock exists for. AC-4 is written to make it
   visible; a criterion saying *"a start starts a run"* would not.
2. **The fan-out is where a single-consumer stream is easiest to break.** `createEventChannel` throws
   on a second iteration, so the failure is loud — but only if something iterates twice, and a host
   that hands the iterable to a per-subscriber handler does exactly that on the **second** subscriber.
   The first subscriber is the common test. This is also why §3 refuses the single-watcher-first seam.
3. **Backpressure.** A slow subscriber must not block the one consumer or make another subscriber
   lose an event. Whatever bound is chosen needs a measurable limit and an explicit outcome for the
   slow subscriber, not an unbounded queue per subscriber.
4. **Races with one owner.** Subscriber registration during a replay, two answers for one gate,
   shutdown while a gate is pending, and a rejection on the pull after a terminal event each produce a
   gap or a double settlement unless one component owns every state transition.
5. **Scope regrowth at implement time.** A server invites *"while I am here"* — a health route, CORS,
   a request log, a config file. `developer-generalist`'s own rule covers it: *"an unrequested default
   is a decision taken on someone else's behalf."* AC-1's refusal to add a `build` task or an external
   dependency is the first place that will be tested.
6. **A criterion read as a byte contract.** Four errata across Q-0091, Q-0094 and Q-0067 were spent on
   this. The sentences here are `core`'s and the route shapes are the document's; nothing else pins
   bytes.
7. **Error drift from the CLI.** Two surfaces translating the same conditions can diverge. AC-5 keeps
   the condition `core`'s and the remedy at one site, and the CLI's `fail.ts` is the shape rather than
   the source.

---

## 9. Cross-cutting checklist

| pillar | this ticket |
| --- | --- |
| **BYOS** | No key path is added. `check()` already refuses when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set, and that refusal reaches a caller through AC-5 rather than being re-implemented. AC-14 asserts it. The word is **subscription**. |
| **Worktree safety** | Unchanged and inherited. This package writes nothing to the user's working tree; every write is `core`'s, inside a worktree under `.harness/worktrees/`. AC-12 preserves Q-0062's rule that an unfinished run keeps its worktrees. |
| **Gate behaviour** | Human-gated by default is untouched. The answer set stays exactly `advance \| retry \| abort` (§0.3). `human-locked` never auto-advances and an exhaustion gate cannot be bypassed — the host passes no `auto` it was not asked for (AC-14). |
| **Confinement / run lock** | Both are `core`'s and inherited rather than re-checked. A ticket id from a request body reaches `Backlog` and is refused there if it escapes the root (Q-0059); a second run on one ticket is refused by the lock (Q-0039). AC-4 and AC-5 are about **reporting** those refusals, never repeating them. |
| **File format and schema** | No new persisted file. `gateAnswerEnvelopeSchema` and `eventSchema` are consumed unaltered; §0.3 is the one place that could have changed one, and B-3 is where it is decided. |
| **Lint rules** | `eslint.config.js` already covers `packages/**/*.ts`, so the new source is linted on arrival with no configuration change. |
| **Turbo inputs** | If this child's suite reads a file outside `packages/server`, that read is declared in a new `packages/server/turbo.json` beside `$TURBO_DEFAULT$`. `turbo-inputs.test.ts` is what fails otherwise — four tickets have earned a registration on the way in, and it is the machinery working rather than an obstacle. |
| **Cold-clone impact** | **None, and deliberately.** The README path is `quorum init` → `quorum run`; nothing here changes it, and `quorum open` is a non-goal precisely because it is the command that would lengthen a stranger's first 30 minutes. AC-1's refusal of an external dependency keeps install size where it is. |
| **Product-agnostic** | No reference to any SaaS product; no adapter-specific or vendor-specific behaviour anywhere in this package. |

---

## 10. Provenance

**The Claude candidate supplied the foundation**: §0's measurements (every one re-verified here), the
transport seam and the argument for running the risky half first, the lazy-start finding and its two
consequences, the `detachPending` observation, the role-grant table, the *"a criterion's Test clause
bounds the instrument"* discipline, and Appendix B's body.

**The codex candidate supplied the sharper contracts**, and four of its criteria survive largely
intact because they are better than their counterparts: exactly-once fan-out with explicit
slow-subscriber isolation (AC-7), terminal-then-close with a thrown post-terminal pull that must not
join the terminal event (AC-9) — the sharpest single criterion in either document, drawn from
`channel.ts`'s own drain-before-settle guarantee — the five gate refusal cases and the answer race
(AC-10), and shutdown that awaits interrupted-run persistence before it resolves (AC-13). Its risk
register and its instinct that `gateId` is opaque and must not be parsed are also carried.

**Three inherited clauses are refused with reasons.** Its `PUT /runs/{runId}/gates/{gateId}`
contradicts a numbered document (§0.9). Its AC-15 clause about the `UNCREATED` register asks for work
already on disk (§0.8). And its seam — single-watcher now, fan-out later — is refused in §3 because it
builds the defect risk 2 names.

**Both candidates missed the same thing, and it is now B-1**: neither asked what `/runs/:id` names.
The measurement that only `terminal` carries `runId`, that the first `info` carries it as prose, and
that `gateId` embeds it while being documented opaque is this document's own, and it is why the
verdict is `needs-input` on a design question rather than only on size.

**Both candidates also independently reached the replay blocker** from different directions — one
from *"no hidden state in the daemon"*, the other from unbounded memory — which is the strongest
evidence either produced that B-2 is real rather than fussy.

---

## Appendix A — successor A's body, written out in full

*Transcribed rather than referenced, so the obligation cannot expire in a closed ticket's entry.
Allocate through `quorum ticket new --id` at this ticket's close (GO-6).*

### The daemon speaks HTTP and WebSocket

Q-0013 built the run host: an in-process registry that starts a run, owns its identity, fans one
single-consumer stream out to N subscribers, settles a gate answer out of band, stops a run and
releases everything on shutdown. What it has no way to do is be reached from a browser.

**What this child adds**: the Hono app, its Node adapter and a WebSocket transport — three
dependencies, none in the lockfile today, each owing the one-line justification
`.claude/rules/engineering.md` requires and **no decision entry**, because `docs/04-architecture.md`
chose Hono on 2026-08-22 and executing a landed document is not changing the architecture (Q-0013
OQ-6).

**The routes are the document's, not an implementer's**: `POST /runs` (start),
`POST /runs/:id/gate`, `POST /runs/:id/stop` — `04-architecture.md:63`, which is the authority until
an entry displaces it. What `:id` means is Q-0013 B-1's ruling and is inherited rather than
re-decided.

**What it owes beyond routing to the host.** Request validation with a stable shape — unknown field,
malformed JSON, wrong type, missing ticket, missing flow — each answered with a code, a
human-readable message and a remedy, and **starting nothing**. A status mapping in which a lock
refusal is distinguishable from a bad request and from a missing ticket. The WebSocket path and its
message envelope: one event per message, JSON, parsing under `@quorum/shared`'s `eventSchema`, with
no ANSI, no rendering and no vendor branching — `04-architecture.md:70` already states the rule this
is the other half of: *"a lint record reaching a terminal, a browser and a WebSocket carries an
escape byte in exactly one of the three."* The loopback bind, per Q-0013 OQ-5: `127.0.0.1` and no
configurable alternative, because with no authentication a non-loopback bind puts a process that
starts agent runs and writes to a git repository on a network. A per-subscriber backpressure bound
with a measurable limit and an explicit outcome, so a slow socket cannot block the one consumer. And
`04-architecture.md`'s `packages/server` section rewritten to what shipped, including the WS path and
envelope, because Q-0014 codes against them.

**Non-goals.** Everything Q-0013 made a non-goal, unchanged, plus: the read-only REST surface
(successor B), serving `apps/web`'s build output (nothing to serve until that app emits), and
authentication.

**Blocked by** Q-0013, which creates the host, the identity and the error mapping this exposes.
**Blocks** Q-0014, which is the first client of the wire shape.

---

## Appendix B — successor B's body, written out in full

*From the Claude candidate's Appendix A, carried forward with its measurements re-verified 2026-09-11.*

### The server serves the project, the backlog, the flow set and run history

`packages/server` starts, stops and streams runs. What it cannot answer is every question that does
not involve a live run: what project is open, what tickets exist, which flows are runnable, and what
previous runs did.

**Everything it needs is already on `@quorum/core`'s barrel**, which is why this is the last child
rather than the first — it is the half that needs nothing added:

| question | symbol | note |
| --- | --- | --- |
| what project is open | `loadProject`, `findProject` | throws `ProjectNotFoundError`, which Q-0013 AC-5 already maps |
| what tickets exist | `Backlog.list()` | `Backlog.read` **asserts rather than parses** (Q-0043 AC-4), so a damaged `ticket.md` reads as a ticket with no fields — **Q-0060**, and this surface is exactly the one that ticket names as the reason it matters |
| which flows are runnable | `lintFlowDirectory` | a flow the linter refuses is **named and not hidden**, per Q-0055 AC-16; `record.problems.length` is the classifier, not `record.flow !== undefined` |
| what previous runs did | `readRunsDir`, `sortRuns`, `isIncomplete`, `readRun` | `readRun` is the single-run read Q-0092 added so a detail request is not coupled to the health of siblings it did not ask about |
| what a run cost | `occurrenceSeq`, `vendorTokenTotal` | per vendor; a blended number is refused by *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) |

**What it owes beyond routing them.** Three things, none of them a formatter moved from the CLI:
containment and push lag are derived **per invocation and never stored** (2026-08-24, 2026-09-06), so
a board over HTTP computes them per request or does not report them — caching either makes it a
stored fact, which both entries forbid. A run-history read may report a store warning and still
return the listing, which is `failSoftly`'s distinction in `packages/cli/src/fail.ts`, and its HTTP
analogue is a decision. And an incomplete `running` manifest is **reported rather than repaired**
(`docs/04-architecture.md`): a server must not tidy one on read.

**Non-goals.** Writing anything — no ticket creation, no stage change, no flow edit; the UI edits
files through a later ticket and never holds the truth. Authentication and any non-loopback bind.
Serving `apps/web`'s build output.

**Blocked by** successor A, which creates the transport and the error mapping this extends.
**Related:** Q-0060 — a damaged `ticket.md` reading as a ticket with no fields is latent at a terminal
and reachable over HTTP; this surface is the reason that ticket is triaged into M3.
