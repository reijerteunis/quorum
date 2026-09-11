# Q-0013 — The server package runs flows, streams their events and answers their gates

*Product-manager candidate, run 1, 2026-09-11. Surfaces: `packages/server` (new), `packages/core`
(public API), `docs/04-architecture.md`, `docs/GLOSSARY.md`, `harness/roles/` (routing only).*

---

## 0. What was measured, and where it contradicts the ticket body

The ticket body is unusually well-measured, and four things in it are still wrong or incomplete.
Each is stated with its evidence, because three of them change the work rather than annotate it.

**0.1 — The export gap is five names, not one.** The body names `AnswerGate` alone. Measured
against `packages/core/src/index.ts`, none of `AnswerGate`, `RunFlowOptions`, `Project`,
`TicketRecord` or `RunStatus` is on the barrel. **`packages/cli` already carries the workaround at
four sites**: `adapters.ts:49`, `board.ts:44`, `ticket.ts:59` and `run.ts:228` each spell the
project type `ReturnType<typeof loadProject>` because `Project` cannot be named. A CLI command
gets away with that because it holds a project for one statement. A server holds a project, a
ticket and a live run in a map for the lifetime of the process, and `AnswerGate` has no
`ReturnType` trick at all — it is a parameter type, reachable only as
`Parameters<typeof runFlow>[0]['answerGate']`.

**The gap is cheap to close and cannot disturb Q-0092's register.** The barrel's own docblock
states the rule: *"A type export adds no runtime key, so the surface `package.test.ts` counts is
the value list above and nothing else."* All five are type-only exports, so the twenty-nine value
symbols do not move and `frame.source.test.ts`'s `DOMAIN` register is untouched.

**0.2 — Two of the body's five open questions are already answered by a numbered document, and it
is not cited.** `docs/04-architecture.md:28` and `:62–63` say: *"Hono HTTP + WebSocket daemon"*,
*"Exposes `POST /runs` (start), `POST /runs/:id/gate` (advance/retry/override with reason),
`POST /runs/:id/stop`"*, and **"Single-user, localhost-only by default."** Under
`.claude/rules/docs-and-decisions.md` — *"When code and docs disagree, the docs are wrong until a
DECISIONS.md entry says otherwise"* — that document is the authority until an entry displaces it.
So OQ-3 (*what the server binds to*) is **settled for the default case**: localhost. What is
genuinely open is narrower and is kept below as OQ-2.

**0.3 — Three documents promise a gate action the shipped envelope cannot carry.** This is the
finding with the widest blast radius, and no account has it.

| document | what it says |
| --- | --- |
| `docs/04-architecture.md:63` | `POST /runs/:id/gate` (advance/retry/**override with reason**) |
| `docs/05-design-prompt.md:35` | *"Advance anyway" (override, requires a one-line reason)* |
| `docs/06-development-plan.md` M3 | *gate screen (… advance / take the other / re-run with edited instructions, **override with reason**)* |

Against the code: `gateAnswerEnvelopeSchema` (`packages/shared/src/events.ts:195`) is
`z.object({ gateId, answer }).strict()`, `gateAnswerSchema` is the closed enum
`['advance','retry','abort']`, and `askGate` (`packages/core/src/engine/routing.ts:41–47`)
`safeParse`s the returned value and raises *"received an invalid answer"* on anything else. A
strict schema rejects an unknown key, so **a reason field on the envelope fails the run**.
*"What a run's event stream carries"* (2026-08-28) is explicit: *"a closed `advance | retry |
abort` answer. An unknown answer, a stale or mismatched id, or a missing callback fails the run
naming the gate rather than inventing a decision."* A decision entry outranks a numbered document,
so **062 wins and three documents are wrong** — unless a new entry widens the envelope. Reading
the design prompt closely suggests the cheap resolution: the override *is* `advance`, and the
reason is an audit record rather than a fourth answer. Where that record is written is undecided,
and it is OQ-1 below.

**0.4 — `runFlow` is lazy, so the two refusals a `POST /runs` must report happen on the first
pull.** Measured in `packages/core/src/engine/engine.ts`: `runFlow` builds a channel and returns;
`createEventChannel(start, …)` calls `start()` **on the first `next()`**, and only then does
`run()` evaluate the stage precondition (`:222`) and take the run lock (`:246`). Both throw
`FlowError` **before any event is emitted**, so the stream rejects with no `terminal` event at all.

Two consequences, neither of them in any account:

- A `POST /runs` that calls `runFlow` and returns `201` has started nothing. The ticket is not
  locked, so **a second `POST /runs` for the same ticket also returns `201`**, and both fail later
  in a place no HTTP response is listening. *"A run holds a lock on its ticket"* (2026-09-09) says
  the server *"inherits that refusal rather than inventing a queue"* — it inherits it only if it
  pulls before it answers.
- `channel.ts`'s `detachPending` JSDoc already anticipates this consumer by name: *"Unreachable
  from `for await` … reachable from `Promise.race([it.next(), shutdown])`, **which is the shape a
  daemon uses**."* The abandonment path was built for this ticket and has never had a caller.

**0.5 — `packages/core/src/engine/engine.ts:194–219` names this ticket in production JSDoc.**
Q-0116 landed the day before: *"M3's server is the first that will hold one across runs and answer
a `GET` from it, which is why this is settled before that server exists rather than after it is
built against the defect."* Confirmed present. Nothing here re-litigates it.

**0.6 — `packages/server` is a stub with no dependencies, and it needs two workspace packages, not
one.** `@quorum/core` does **not** star-export `@quorum/shared` — it re-exports exactly one type
from it (`CliVersionResult`). `packages/cli/src/run.ts:31` imports `Event` and `RunTerminalEvent`
from `@quorum/shared` directly. So the server declares both.

---

## 1. Problem

`packages/server/src/index.ts` is `export const name = '@quorum/server';`. Everything M3 promises —
mission control, the gate screen, run history in a browser — is downstream of a process that does
not exist.

The `maintainer` has one way to run a flow: `quorum run`, at a terminal, where the gate is a
readline prompt and the trace is ANSI on stdout. That is the whole surface. A run that reaches a
gate holds a terminal hostage until somebody types a word; a run nobody is watching cannot be
watched later, because **nothing persists the event stream** (`docs/04-architecture.md`: *"There is
no persisted event stream in this version"*). Two people cannot look at the same run, and one
person cannot look at it from two places.

The `adopter` has no way to see what Quorum does without reading a terminal. The product's own
positioning is *mission control*, and mission control is the thing that does not exist.

What is missing is not the screens. It is the process underneath them: something that starts a run,
consumes its single-consumer stream once, fans it out to whoever is watching, and carries a gate
answer from an HTTP request back into the promise a run is parked on.

---

## 2. User stories

**`maintainer`** — *I start a run from a browser, watch its trace while it works, and answer its
gate from the same page. If I close the tab and open it again, the run is still going and I can
still answer it. If a run is already holding the ticket, I am told so by the request that tried to
start the second one, not by a log line I find later.*

**`maintainer`** — *I stop a run I no longer want. It ends `interrupted`, keeps the worktrees it
obtained so I can go and look, and does not roll back a merge an `integrate` step had already
proved green.*

**`adopter`** — *I run one command and get a local page showing what my agents are doing. Nothing
asks me for a key, and nothing is listening on an address my network can reach.*

**`contributor`** — *The server is a consumer of `@quorum/core`'s public API and nothing else. If I
need to know what it may reach for, I read the barrel, not the server's imports.*

---

## 3. Scope: split at the transport seam, and run this half first

**Recommendation: split into two children now, at the gate, rather than at a later one.**

The body's OQ-5 suspects the scope is past the fifteen-criterion ceiling. Measured against the
work: closing the export gap, standing up the process, deciding what it binds to, starting a run
against a lazy stream, fanning a single-consumer stream out to N watchers, deciding what a late
joiner sees, answering a gate over HTTP, stopping a run, shutting down cleanly, **and** a read-only
REST surface over the project, the backlog, the flow set and run history is roughly nineteen
criteria. Q-0091 split at twenty-one and Q-0096 at twenty-one, **both at their gate and both at
cost**. This repository has recorded recognising that before the money is spent as a virtue exactly
once (Q-0102, GO-1). This is the second opportunity.

**The seam is the one the ticket names, and it is clean because the two halves share no `core`
symbol.** The read-only half is `loadProject`, `Backlog.list`, `lintFlowDirectory`, `readRunsDir`,
`readRun`, `sortRuns`, `isIncomplete` — **all seven already on the barrel**, all synchronous, none
touching a run. The live half is `runFlow`, `loadFlowByName` and the five type exports §0.1 adds.

**This ticket keeps the live half**, for two reasons rather than one. It carries every unretired
risk — the single-consumer fan-out, the out-of-band answer, the lazy-start refusal — and
*"Milestones are ordered by risk, not by screen"* is this plan's own rule. And **the export gap
belongs with whichever half runs first**, which the body already says: the read-only half needs
nothing added to `core`, so putting it first would leave the gap open and the successor paying for
it anyway.

**Appendix A is the successor's body, written out in full**, because an obligation recorded only in
a closed ticket's entry expires — this plan records seven directions of that drift, and Q-0105 is
the counter-example that avoided it by opening its successors at its own close.

---

## 4. Acceptance criteria

Fourteen, numbered continuously so a criterion keeps its name if the cut moves. Each names its
surface. Every *Test:* clause bounds the instrument and nothing more — a reviewer may find the
instrument fails the job the clause gives it, and may not raise the job (Q-0067 erratum E-1).

### The package and the public API

**AC-1 — `@quorum/server` declares what it depends on, and resolves.**
Surface: `packages/server/package.json`. It gains `@quorum/core` and `@quorum/shared` at
`workspace:*` — **both**, per §0.6 — plus the HTTP and WebSocket runtime OQ-3 names. It declares no
`build` task and emits nothing: the local distribution set is three packages
(`@quorum/shared`, `@quorum/core`, `@quorum/cli`) and this ticket does not widen it.
*Test:* a test in `packages/server` imports `runFlow` from `@quorum/core` and `eventSchema` from
`@quorum/shared` and both resolve under the `quorum-source` condition.

**AC-2 — `@quorum/core` publishes the five types a server must name, and the value surface does not
move.**
Surface: `packages/core/src/index.ts`. `AnswerGate`, `RunFlowOptions`, `Project`, `TicketRecord`
and `RunStatus` are exported as types, each with the barrel's existing one-line-per-addition
rationale. No new value symbol is added, so the count stays at twenty-nine.
*Test:* a `packages/server` module annotates its own gate callback `AnswerGate` — named directly,
not as `Parameters<typeof runFlow>[0]['answerGate']` — and `packages/cli/src/package.test.ts`'s
derived value-surface assertion is unchanged and still green.

### The process

**AC-3 — the app is constructible without binding a port.**
Surface: `packages/server`. Building the request handler and starting a listener are two calls, so
every route below is exercised without a socket. A test that needed a real port to check a 404
would make the suite's verdict a property of what else is on the machine, which *"A test's verdict
is a property of the commit, not of the checkout or the account"* (2026-08-30) forbids.
*Test:* the route assertions in this ticket's suite bind no port; the one that does is AC-4's.

**AC-4 — it listens on the loopback interface and says so.**
Surface: `packages/server`. The default bind is `127.0.0.1`, per `docs/04-architecture.md:63`'s
*"Single-user, localhost-only by default"*. Whether any other bind is reachable at all is OQ-2 and
is **not** decided by an implementer.
*Test:* a started server accepts a request on `127.0.0.1` and the address it reports is the
loopback one.

### Starting a run

**AC-5 — `POST /runs` does not report success until the run has actually started.**
Surface: `packages/server`. `runFlow` is lazy (§0.4): the stage precondition and the run lock are
evaluated on the first pull. The request therefore begins consuming and waits for the run to be
under way before it answers.
*Test:* two `POST /runs` for one ticket, issued so that the second is sent after the first has
answered, produce one started run and one refusal. The refusal's body carries `core`'s own sentence
— *"run lock refused: ticket … is held by run #… "*.

**AC-6 — a run that refuses before it emits anything is reported by the request, with the condition
`core` gave.**
Surface: `packages/server`. The two refusals that reach no `terminal` event are the stage
precondition (`engine.ts:222`) and the run lock (`:246`). Neither is rewritten, paraphrased or
classified by message text.
*Test:* a ticket whose stage the flow does not consume is refused by `POST /runs`, and the sentence
the response carries is byte-identical to the `FlowError`'s.

**AC-7 — the server is the stream's one consumer, and watchers are its own fan-out.**
Surface: `packages/server`. `createEventChannel` throws a named `FlowError` on a second
`[Symbol.asyncIterator]()` and on a re-entrant `next()`. The server iterates once per run and
distributes; nothing else touches the iterable.
*Test:* two watchers attached to one run both receive the run's events, and the run's stream was
iterated exactly once.

**AC-8 — what a watcher that arrives mid-run receives is the behaviour OQ-1's entry rules, and it
is not invented here.**
Surface: `packages/server`. Nothing persists the event stream, so a replay cannot be rebuilt from
disk — which is why this is a decision rather than an implementation detail (see OQ-1).
*Test:* a watcher attached after the run has emitted events observes what the entry says it
observes, and the assertion cites the entry by title and date.

### The trace

**AC-9 — the WebSocket carries the event union as data, unaltered.**
Surface: `packages/server`. One event per message, JSON, validating against
`@quorum/shared`'s `eventSchema`. No ANSI, no rendering, no vendor branching — *"nothing downstream
knows which vendor produced an event"*, and `packages/cli/src/trace.ts` is the CLI's presentation
and stays there. `04-architecture.md:70` already states the rule this criterion is the other half
of: *"a lint record reaching a terminal, a browser and a WebSocket carries an escape byte in
exactly one of the three."*
*Test:* every message a mock-adapter run produces parses under `eventSchema`, and none contains an
escape byte.

### The gate

**AC-10 — `POST /runs/:id/gate` answers the gate that run is parked on, and the answer set is the
closed three.**
Surface: `packages/server`. The body carries a `gateId` and one of `advance | retry | abort`. The
server resolves the promise `answerGate` returned for that `gateId` and returns the envelope
`routing.ts:41–47` validates. An answer for a gate that is not pending, an unknown word, or a gate
already answered is refused by the **server**, before it reaches `core`, because reaching `core`
with a mismatched id renders *"received stale answer for …"* — which presents as an operator error
the operator did not make (Q-0094 AC-8).
*Test:* a mock-adapter run reaches a gate, `POST …/gate` with `advance` lets it continue, and a
second `POST` for the same `gateId` is refused without disturbing the run.

**AC-11 — a run the server started always has an answer channel.**
Surface: `packages/server`. `GateUnansweredCondition`'s third member, `no-answer-channel`, is
`core`'s and is **unreachable from `packages/cli`**, which always supplies an `answerGate`. A server
that started a run and then had no way to ask would reach it. Every run this server starts is
started with a channel, so the condition a server can reach is `stdin-closed`'s analogue — a
watcher going away — and that is not the same thing as nobody having been there.
*Test:* a run started by the server and taken to a gate with no watcher attached does not end
`undecided` on `no-answer-channel`.

### Stopping

**AC-12 — `POST /runs/:id/stop` cancels through the caller's `AbortSignal`, and the run ends
`interrupted`.**
Surface: `packages/server`. Cancellation is the caller's: *"Core installs no signal listener and
never exits the process — a library that traps SIGINT or calls `process.exit` is unusable inside
M3's daemon"* (2026-08-28). The server aborts the controller whose signal it handed `runFlow`, with
a **non-empty string reason**, because `interruptionNote` reads `signal.reason` only when it is one
and aborting with nothing silently substitutes the thrown message (`run.ts:176–180`).
*Test:* a stopped mock-adapter run records `interrupted`, keeps the worktrees it obtained (Q-0062),
and its `runs.log` note carries the reason string the server supplied.

**AC-13 — shutting the server down releases every live run through the abandonment path.**
Surface: `packages/server`. Iterator `return()` awaits interrupted-run persistence before it
resolves, so counters, occurrences and the terminal record are on disk before shutdown completes.
This is the first caller `channel.ts`'s `detachPending` has ever had (§0.4).
*Test:* a server shut down with a run in flight resolves only after that run's terminal record
exists on disk.

### Errors

**AC-14 — a `core` condition reaches the client unaltered, and any remedy is the server's.**
Surface: `packages/server`, and one module that owns it. *"A `core` error names the condition; the
remedy belongs to the surface"* (2026-09-07) was ruled **for this surface**:
`packages/cli/src/fail.ts`'s `dieNoProject` is the shape — one place, taking the condition as a
**string** so the module names no `core` symbol. A server's remedy is not a shell imperative: the
entry's own reasoning is that M3's server surfaces the same error *"to somebody who may not have a
shell"*.
*Test:* `ProjectNotFoundError` reaches a client as `core`'s sentence plus this surface's remedy,
composed at one site, and `quorum init`'s imperative appears in no server response.

---

## 5. Non-goals

Each is refused for a reason, not omitted.

1. **Resumable runs after a daemon restart** — Q-0019, named separately in M3's own list.
2. **Any screen** — Q-0014 onward. `apps/web` is a stub and stays one.
3. **`quorum open`** — it starts a daemon *and* a browser and belongs with the web app.
4. **The read-only REST surface** — projects, backlog, flow set, run history. Deferred to the
   successor by §3. **Appendix A is its body.**
5. **Serving `apps/web`'s build output** — that app has no `build` task and emits nothing, so there
   is nothing to serve; `04-architecture.md:63` already scopes this to M3 rather than to now.
6. **Authentication, and any bind beyond loopback** — OQ-2. Out until an entry says otherwise; the
   product's v1 exclusion list names *multi-user* and *remote daemon* explicitly.
7. **Persisting the event stream** — `04-architecture.md` states there is none in this version, and
   adding one is a file-format decision with its own ticket. AC-8 must be satisfiable without it.
8. **Widening the gate answer set, or adding a `reason` field to the envelope** — §0.3. The
   envelope is `.strict()` and decision 062 closed the set at three. If the override reason is to
   travel, that is OQ-1's entry and not an implementer's choice.
9. **A queue for a ticket that is already running** — the lock refuses and names the holder; *"it
   never waits, and it is never reclaimed."*
10. **Changing `runFlow`, the channel, or the gate mechanism.** Four landed entries govern them.
    The server consumes; it does not negotiate.
11. **Emitting a build artifact from `packages/server`** — the local distribution set is three
    packages and this ticket does not make it four.

---

## 6. Open questions

Ordered by whether they block. **OQ-1 and OQ-3 are blockers** under
`harness/product-context.md`'s rule: one that would change a file format or a shipped contract
blocks.

**OQ-1 (blocker; owner: human, at this gate) — what does a watcher that arrives mid-run receive,
and where does an override's reason go?**
Two halves of one entry, because both are about what the server may hold that disk does not.

*Half A.* Nothing persists the event stream, so a replay must come from memory — and
`04-architecture.md` principle 3 permits *"an in-memory index rebuilt from disk on start"*, while
`harness/rules.md` says *"no hidden state in the daemon."* An event buffer is state that cannot be
rebuilt from disk, so it sits exactly on that line. The candidates are: a late joiner sees the live
tail only; or the server holds a bounded per-run buffer and replays it; or the joiner is handed the
run's on-disk manifest as a snapshot and then the live tail. The third is the only one that needs
no new state, because `readRun` already exists.

*Half B.* Three documents promise *"override with reason"* (§0.3) and the envelope is strict. The
design prompt suggests the override is `advance` and the reason is an audit record. If so it is
written by the server — plausibly the `runs.log` line, beside the `run=N gate=… answer=…` that
`askGate` already appends — and **three documents need correcting** rather than the schema
widening. If not, a new entry must supersede a clause of *"What a run's event stream carries"*
(2026-08-28), which is a contract five tickets already code against.

**OQ-2 (owner: human, at this gate) — does "localhost-only by default" mean anything other than
localhost is reachable at all?**
`04-architecture.md:63` says *"by default"*, which implies a non-default. With no authentication,
any non-loopback bind puts a process that starts agent runs and writes to a git repository on a
network. Recommendation: **no configurable bind in this ticket** — the phrase is satisfied by
loopback and nothing else, and widening it later is additive where narrowing it is not. This is
recorded as a question rather than assumed because it has a security consequence and the ticket
body asks for it to be decided deliberately.

**OQ-3 (blocker; owner: human, at this gate) — which route does this ticket run, and is its
implementer allowed to write `packages/server`?**
Measured against `harness/roles/` and `harness/architecture.md`'s table, and this is the finding
that most needs answering before anything is spent:

| role | may write | grants `packages/server`? |
| --- | --- | --- |
| `developer-generalist` | `…, packages, apps, harness, docs, …` | **yes** (via `packages`) |
| `developer-backend` | `packages/core, packages/shared, harness, docs, backlog` | no |
| `developer-tooling` | `packages/core, packages/shared, packages/cli` | no |
| `developer-frontend` | `apps/*, packages/ui, packages/i18n` | no |

`development.yaml`'s fan-out resolves `role: "developer-{role}"` from `tasks.yaml`, and
`harness/architecture.md:33` states plainly that **`generalist` is not a fan-out role**. So:

- **Through the full pipeline, no role the fan-out can resolve may write this ticket's only
  directory.** `harness/architecture.md:66–68` names the consequence in advance — *"a file no task
  owns cannot be fixed by anyone, and the development loop will spend its whole iteration budget
  discovering that."* This is *"A requirement may not name a surface its flow cannot write"*
  (2026-08-25) arriving before the requirement rather than after it.
- **Through the chore route it works, and the role is told not to take it.**
  `developer-generalist`'s own prose: *"If the work turns out to change behaviour rather than
  machinery, say so: that ticket belongs in the full pipeline, not here."* Q-0013 is product
  behaviour.

The two answers: grant `packages/server` to a fan-out role — one line in **three** places, because
`packages/shared/src/role.test.ts` asserts the frontmatter, `harness/architecture.md`'s third
column and the role's prose all agree, and will catch a partial edit — and run the full pipeline;
or run it as a chore and record that the exception was taken deliberately. **M2's closing
measurement is the argument for the first**: the seven-stage SDLC was exercised by four tickets,
three of them M1's, and *"the flows M3's feature work will use have four tickets of evidence
between them, all from August."* M3 is the feature work. Either way the grant must exist **before**
the fan-out runs, which is why this is a gate obligation and not a criterion.

**OQ-4 (owner: human, at this gate) — Hono, `@hono/node-server` and a WebSocket library are new
dependencies. Confirmed?**
`docs/04-architecture.md:28` and `:62` have named Hono since 2026-08-22 and **nothing in
`pnpm-lock.yaml` matches `hono` or `ws` today** — it is a proposal that has never been executed.
`.claude/rules/engineering.md` wants a one-line justification per dependency and *"a DECISIONS.md
entry if it changes architecture."* Recommendation: **no entry owed** — the architecture document
already made this choice and an implementer executing a landed document is not changing the
architecture — with the one-line justification recorded per package. Raised because it is three
dependencies rather than the one the document's word *"Hono"* suggests: Hono itself is
runtime-agnostic and needs a Node adapter and a WebSocket transport beside it.

**OQ-5 (owner: head-of-product, at this gate) — is the §3 split accepted?**
If it is not, the criteria above are incomplete and Appendix A's must be folded in, taking the
ticket to roughly nineteen.

---

## 7. Gate obligations

Work no step on either route may perform, which is why it is listed separately from the criteria.
This repository has now recorded **sixteen** instances of a loop handed work no agent in it can
perform, and the one time it was caught in advance (Q-0102 GO-1) it saved a whole run.

- **GO-1** — OQ-1's decision entry lands **before** the implement step starts, and its presence is
  verified in that step's actual prompt rather than assumed. Q-0097 lost two errata by not making
  that check; Q-0115 made it and recorded the count.
- **GO-2** — OQ-3 is answered and, if the full pipeline is chosen, the role grant is committed
  first. A `harness/roles/` edit is the human's; a requirement may not name a surface its flow
  cannot write.
- **GO-3** — §0.3's three documents are corrected in the change that lands this ticket, or OQ-1's
  entry explains why they stand. A numbered document promising a capability the code refuses is the
  failure this repository records most.
- **GO-4** — the merge is verified forced in **both** environment rows — a checkout carrying
  `.harness/worktrees` and `.quorum/runs`, and one carrying neither — per Q-0072's closing finding,
  and CI is green on the merged commit per Q-0105's GO-3. A local green is not evidence: Q-0104 and
  Q-0105 were both broken on CI while every local signal was green.
- **GO-5** — `docs/04-architecture.md`'s `packages/server` section is rewritten to what shipped
  rather than left describing what was proposed in August, and `docs/GLOSSARY.md` gains a term only
  if this ticket introduces one. It probably does not: *run*, *gate*, *event*, *flow* and *run
  lock* all already exist and no synonym is introduced for any of them.

---

## 8. Risks

1. **The lazy-start trap (§0.4).** The obvious implementation — call `runFlow`, store the iterable,
   return `201` — is wrong in a way every test that starts one run will pass. It shows up only with
   two concurrent requests, which is the case the run lock exists for. AC-5 is written to make it
   visible; a criterion that merely said *"`POST /runs` starts a run"* would not.
2. **The fan-out is where a single-consumer stream is easiest to break.** `createEventChannel`
   throws on a second iteration, so the failure is loud — but only if something iterates twice.
   A server that hands the iterable to a per-socket handler will do exactly that on the second
   watcher, and the first watcher is the common test.
3. **A gate answer that never arrives holds a run open indefinitely.** `askGate` awaits
   `answerGate` with no timeout of its own, and that is correct: *"minutes after the question was
   emitted — M3's human answers in a browser."* The server must not invent a timeout, because a
   timeout that advances is inventing a decision and a timeout that aborts throws away work. The
   only honest lever is `POST /runs/:id/stop`.
4. **A criterion read as a byte contract.** Four errata across Q-0091, Q-0094 and Q-0067 were spent
   on this. Route shapes above are the document's own (`04-architecture.md:63`) and the sentences
   are `core`'s; nothing else here pins bytes, and a requirement describes what must be conveyed.
5. **Scope regrowth at implement time.** A server invites *"while I am here"* — a health endpoint,
   CORS, a request log, a config file. `developer-generalist`'s own rule covers it: *"an unrequested
   default is a decision taken on someone else's behalf."* AC-1's refusal to add a `build` task is
   the first place that will be tested.
6. **A test that needs a real port.** Q-0079's rule and AC-3 together: a port is a property of the
   machine. One criterion binds; thirteen do not.

---

## 9. Cross-cutting checklist

| pillar | this ticket |
| --- | --- |
| **BYOS** | No key path is added. The server starts runs through `runFlow`; `check()` already refuses when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set, and that refusal reaches an HTTP client through AC-14 rather than being re-implemented. No request body, header, query parameter, test fixture or example carries a key or a token. The word is **subscription**. |
| **Worktree safety** | Unchanged and inherited. The server writes nothing to the user's working tree; every write is `core`'s, inside a worktree under `.harness/worktrees/`. AC-12 preserves Q-0062's rule that an unfinished run keeps its worktrees. |
| **Gate behaviour** | Human-gated by default is untouched. The answer set stays exactly `advance | retry | abort` (§0.3). `human-locked` never auto-advances, and an exhaustion gate cannot be bypassed — the server passes no `auto` it was not asked for. |
| **Confinement / run lock** | Both are `core`'s and both are inherited rather than re-checked. A ticket id arriving in a request body reaches `Backlog` and is refused there if it escapes the root (Q-0059); a second run on one ticket is refused by the lock (Q-0039). AC-5 and AC-6 are about *reporting* those refusals, never about repeating them. |
| **File format and schema** | No new persisted file and no schema change. `gateAnswerEnvelopeSchema` and `eventSchema` are consumed unaltered; §0.3 is the one place that could have changed one, and OQ-1 is where it is decided. |
| **Lint rules** | `eslint.config.js` already covers `packages/**/*.ts`, so the new source is linted on arrival with no configuration change. `@typescript-eslint/no-deprecated` applies, which matters for a new HTTP dependency. |
| **Turbo inputs** | If this ticket's suite reads a file outside `packages/server`, that read is declared in a new `packages/server/turbo.json` beside `$TURBO_DEFAULT$`. `packages/core/src/turbo-inputs.test.ts` is what fails otherwise — four tickets have earned a registration on the way in, and it is the machinery working rather than an obstacle. |
| **Cold-clone impact** | **None in this ticket, and that is deliberate.** The README path is `quorum init` → `quorum run`, and nothing here changes it. `quorum open` is a non-goal precisely because it is the command that would lengthen a stranger's first 30 minutes. |
| **Product-agnostic** | No reference to any SaaS product. |

---

## Appendix A — successor ticket body, written out in full

*Transcribed here rather than referenced, so the obligation cannot expire in a closed ticket's
entry. Allocate through `quorum ticket new --id` so the plan and the backlog agree.*

---

### The server serves the project, the backlog, the flow set and run history

`packages/server` starts, stops and streams runs (Q-0013). What it cannot yet answer is every
question that does not involve a live run: what project is open, what tickets exist, which flows
are runnable, and what previous runs did.

**Everything it needs is already on `@quorum/core`'s barrel**, and that is why this is the second
half rather than the first — it is the half that needed nothing added. Verified 2026-09-11 against
`packages/core/src/index.ts`:

| question | symbol | note |
| --- | --- | --- |
| what project is open | `loadProject`, `findProject` | throws `ProjectNotFoundError`, which Q-0013 AC-14 already maps |
| what tickets exist | `Backlog.list()` | returns `TicketRecord[]`; `Backlog.read` **asserts rather than parses** (Q-0043 AC-4), so a damaged `ticket.md` reads as a ticket with no fields — **Q-0060**, and this surface is exactly the one that ticket names as the reason it matters |
| which flows are runnable | `lintFlowDirectory` | a flow the linter refuses is **named and not hidden**, per Q-0055 AC-16; `record.problems.length` is the classifier, not `record.flow !== undefined` |
| what previous runs did | `readRunsDir`, `sortRuns`, `isIncomplete`, `readRun` | `readRun` is the single-run read Q-0092 added so a detail request is not coupled to the health of siblings it did not ask about |
| what a run cost | `occurrenceSeq`, `vendorTokenTotal` | per-vendor; a blended number is refused by *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) |

**What it owes beyond routing them.** Three things, and none is a formatter moved from the CLI:

1. **Containment and push lag are derived per invocation and never stored** (2026-08-24,
   2026-09-06). A board over HTTP must compute them per request like `quorum board` does, or not
   report them. Caching either one makes it a stored fact, which both entries forbid.
2. **A run-history read may report a store warning and still return the listing.** That is
   `failSoftly`'s distinction in `packages/cli/src/fail.ts`, and the HTTP analogue — a `200` with
   warnings, or a `500` — is a decision.
3. **An incomplete `running` manifest is reported rather than repaired**
   (`docs/04-architecture.md`). A server must not tidy one on read.

**Non-goals.** Writing anything — no ticket creation, no stage change, no flow edit; `apps/web`
edits files through a later ticket and the UI never holds the truth. Authentication and any
non-loopback bind, which stay Q-0013 OQ-2's. Serving `apps/web`'s build output, which has nothing
to serve until that app has a `build` task.

**Blocked by** Q-0013, which creates the process, the transport and the error mapping this extends.
**Related:** Q-0060 — a damaged `ticket.md` reading as a ticket with no fields is latent at a
terminal and reachable over HTTP; this surface is the reason that ticket is triaged into M3.

---

## Provenance

Every claim in §0 was measured against the tree on 2026-09-11 and none was transcribed from the
ticket body, the development plan or a decision entry — *"a measurement copied from a document is
not a measurement"* (Q-0099). §0.1's four `ReturnType<typeof loadProject>` sites, §0.3's three
documents against `events.ts:195`, §0.4's laziness through `channel.ts:97–100` into
`engine.ts:222` and `:246`, and OQ-3's four role path lists against `harness/architecture.md`'s
table were each read rather than inferred. Where this document reports an absence — no `hono` or
`ws` in `pnpm-lock.yaml`, `AnswerGate` on no barrel — the probe that looked is named, per *"A probe
that could not answer is not a negative"* (2026-09-10).
