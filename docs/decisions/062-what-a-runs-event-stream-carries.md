# What a run's event stream carries, and how a gate answer travels back — 2026-08-28

**Decision:** `runFlow` becomes a **lazy, single-consumer `AsyncIterable<Event>`** backed by a
lossless FIFO. The first iterator pull starts execution; synchronous adapter callbacks enqueue
without back-pressure, preserving order within a step, and concurrently executing parallel members
have no promised global order. This is the one behaviour change the port authorises, and the five
engine and run-history tickets behind it code against the boundaries below.

**The gate answer travels out of band, through a callback.** `RunFlowOptions.answerGate(question)`
may settle outside the iterator pull stack and minutes after the question was emitted — M3's human
answers in a browser. Core emits a correlated gate event **before** invoking it, then validates the
returned opaque `gateId` and a closed `advance | retry | abort` answer. An unknown answer, a stale
or mismatched id, or a missing callback **fails the run naming the gate** rather than inventing a
decision. Automatic and dry short-circuits run *before* a question is allocated, so an
auto-advanced gate emits `info` and consumes no answer, and `human-locked` never auto-advances.
Every answered gate is logged before its answer is acted on.

**Cancellation is the caller's.** `RunFlowOptions.signal` is a caller-owned `AbortSignal`. **Core
installs no signal listener and never exits the process** — a library that traps SIGINT or calls
`process.exit` is unusable inside M3's daemon. Iterator `return()` cancels active work and awaits
interrupted-run persistence: an abandoning `for await` consumer cannot observe the terminal event it
caused, but counters, occurrences and the terminal log record are on disk before `return()`
resolves.

**Terminal state is an event, not a return value.** The shared union gains one `terminal` member
carrying a nested status-discriminated union, so the seven regression fields are either complete or
absent — never half-filled. Every normal terminal status is the stream's final event; a failed run
emits its terminal event and the *following* pull throws the existing `FlowError` with a non-empty
cause. There is exactly one `FlowError` in the workspace, re-exported from `lint.ts`.

**No event carries a timestamp, a sequence number or a run id.** Only the terminal event carries run
identity. The stream is ordered by construction, nothing persists it in v1, and run history already
timestamps every occurrence. Three fields on eight members with no consumer is a cost paid now and
removed never.

**The context is complete, and the dry view keeps its mechanism.** `RunFlowOptions` receives the
caller's already-loaded `Project` and `Backlog`; the engine never reloads configuration from disk,
because `config.adapterOverride` is set on the *loaded* config by the CLI and has never existed on
disk — and without it the mock-adapter regression suite cannot be driven at all. Dry execution
creates `Object.create(backlog)` and replaces `write`, `writeFile` and `log` with no-ops before the
view enters the context, so **the database is read-only by construction rather than by a guard at
each call site that someone can forget**.

**Alternatives considered.**

**The two-way async-generator protocol**, answering through the iterator's `next(value)`. Rejected
on a property of the language rather than on taste: a `for await` loop cannot pass a value to
`next`, so every plain consumer would silently receive nothing at every gate. The failure is silent,
which is the worst available shape.

**A mutable run handle** — async-iterable *and* carrying `answer` and cancellation on one object.
Genuinely close, and the natural home if a gate ever has to be answerable after the run's lifetime.
Rejected for now because it stops `runFlow(opts): AsyncIterable<Event>` being literally true, and
because `AbortSignal` already carries cancellation in a shape every Node consumer knows. Q-0040's
"undecided" gate is where this gets reopened.

**A generator return value for terminal state.** Rejected twice over: a return value survives
neither `for await` nor a socket, and M3's WebSocket consumer must learn status, stage, cost and run
id without parsing prose.

**Eager execution**, starting the run before the first pull. Rejected because abandonment then has
no signal — `return()` is what makes an abandoned run detectable, and that is what lets an
interrupted run still write its terminal record.

**A synthetic persistence object unrelated to `Backlog`.** Rejected: it would land a capability
Q-0052 must widen on its first day, since `writeFile` is called at six sites across Q-0052 and
Q-0053, and it would leave the contract naming two vocabularies for one thing.

**Why this shape, and what it cost to establish.** The stream is the port's only authorised
behaviour change, and getting it wrong is the most expensive mistake available here — five tickets
code against it before anything runs it. That is why Q-0050 alone took the full SDLC while its
thirteen siblings took the chore route.

The solutioning loop **exhausted twice** against `max_iterations: 2` and took five architecture
review rounds, $17.83 in billed Claude and roughly 15M codex tokens. It is worth recording that it
was not spinning: round 3 records round 2's three blockers closed, round 4 closes round 3's four,
round 5 closes round 4's three and re-verified the signature layer against the spike rather than
against the solution's own account of it. Blockers ran 3, 4, 3, 2. Two majors did recur — the
`unknown`-typed seam came back twice — and round 5 said so plainly. **The design half was affirmed
in every round from three onward and never reopened.** What kept failing was the layer where the
typed contract meets the preserved behaviour, and round 5 named the single cause: the contract had
been written from the *intended* API rather than checked against the spike's actual signatures.

The loop was ended by an erratum rather than a sixth round, on the reviewer's own recommendation to
the human at the gate — `backlog/Q-0050-…/solution/errata.md`, E-1 to E-4. That is the instrument
*"a review loop cannot decide when a guard is finished, and must be told"* (2026-08-28) describes,
used a second time within a week and for the first time on a design rather than a guard.

**Cost accepted.** `signalWindow`'s 1000 ms timer is preserved and pinned rather than removed, so a
library holds a libuv handle open for a second per gate; its stated purpose — giving a signal a
window to reach the finaliser — does not exist in a module that installs no signal handler, and
removing it means editing a fixture Q-0004 froze. The engine's context names a concrete `Backlog`
rather than a narrow capability, which is less injectable; that is what the spike does, and
narrowing it is a later ticket's argument with its own entry. And the four routed diagnostics stay
preserved: `branchExists`, `branchHead`, `commitAll` and `mergeInto` still cannot distinguish "git
failed" from "the branch is not there", which is **Q-0074** and matters most at
`engine.js:48` and `finish`'s rollback read, where a git failure makes the rollback skip itself.

**Found by:** `requirements/merged.md`'s pre-run action 2, which named this entry as owed *after*
solutioning decides and *before* implementation starts, and observed that no step on that route can
write it — requirements and review steps have no worktree, the architect writes only `solution/*`,
and an entry written by the development fan-out is written during implementation rather than
accepted before it. Round 3's review raised the same obligation independently. It is the
precondition-external-to-the-document shape that exhausted Q-0070's loop at $8.31 and Q-0069's at
roughly $12, named as a gate action rather than an acceptance criterion for exactly that reason.
