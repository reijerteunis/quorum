---
id: Q-0050
title: core/engine — the run loop, routing and the event stream
stage: solutioned
owner: ruud
repos: []
branch: harness/Q-0050/integration
priority: p1
created: 2026-08-25
iterations:
  solutioning.architecture-review: 3
  qa-red.scenario-review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-28T14:16:28.871Z
    cost: 16.053
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-28T14:58:50.894Z
    cost: 0
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-28T16:50:55.280Z
    cost: 0
  - stage: requirements
    run: 2
    flow: solutioning
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-28T17:07:40.526Z
    cost: 0
  - stage: solutioned
    run: 2
    flow: solutioning
    status: completed
    stage_before: requirements
    stage_after: solutioned
    at: 2026-08-28T19:17:08.421Z
    cost: 17.827
  - stage: solutioned
    run: 3
    flow: qa-red
    status: exhausted
    stage_before: solutioned
    stage_after: solutioned
    at: 2026-08-29T01:33:00.070Z
    cost: 0
  - stage: solutioned
    run: 3
    flow: qa-red
    status: exhausted
    stage_before: solutioned
    stage_after: solutioned
    at: 2026-08-29T08:09:56.941Z
    cost: 0
---
The spine of the port: `runFlow`, `runStep`, `handleFail`, `finish`, `outcome`, `recordEvent`,
`loadFlow`, `loadFlowByName`, `loadRole`, `interpolate`, `writesOf` — the run context every other
engine ticket writes into, plus counters, bounded backward edges, cross-flow regression, stage
transitions, `--dry` and `--auto`. Roughly 250 of `engine.js`'s 1,113 lines, and the ticket the other
three engine tickets depend on. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**It carries the one deliberate interface change in the whole port.** `04-architecture.md` specifies
`runFlow(opts): AsyncIterable<Event>` over the trace format in `shared`, where the spike's `runFlow`
takes a `ui` object and prints. That is design work, not translation: what the stream carries decides
what M3's WebSocket can show, what the gate screen can render and what run history could persist. It
is also where a port stops being safely mechanical, so it deserves the requirements flow's attention
more than any other ticket here. The `ui.gate` callback is the sharpest edge — a gate is a *question
back*, which an `AsyncIterable` of events does not naturally express.

**The safety properties this loop is responsible for.** M1's closing entry records that they held
under real failure and they are the product's actual claim: stages never advance on a failed run, the
user's working tree is never touched, bounded loops stop where they are told to, and counters survive
a crash. Enforced in `core`, not in the UI or by convention.

**Rules with money behind them.**

- **A dry run previews; it never mutates.** `harness run requirements Q-0034 --dry` advanced a ticket
  from `draft` to `requirements`, wrote a `runs.log` and appended a "completed" history entry without
  invoking a single agent — every *step* checked `ctx.dry`, the run's own bookkeeping did not. And
  `--dry` is the same run machinery rather than a separate path, which is why its preflight must be
  as honest as a real run's (Q-0051).
- **`retry` at an exhaustion gate authorises exactly one more traversal** — that loop's counter is
  set to `max_iterations`, no other counter is touched, and the grant is recorded in `runs.log`.
  Clearing every counter refunded a `qa` budget a ticket had already spent.
- **A non-interactive run authorises the first N gates it meets, not the N you had in mind.**
  `--gate-answer` values are consumed in order by whichever gate arrives first, and an engine-presented
  exhaustion gate is a gate (2026-08-25).
- **Cross-flow regression derives its target stage from the named flow's `consumes`**, rather than
  hard-coding a stage or running the target flow immediately (2026-08-23).
- **Every terminal outcome is written with its counters persisted** — completed, regressed, failed,
  interrupted. Ctrl-C at a gate once wrote no outcome and silently refunded the iteration budget, an
  undocumented route to unlimited retries.
- **Failures name their cause.** *"A failure that withholds the one thing the reader needs"* is one of
  M1's three recurring shapes: `exited 1:` with nothing after it, `could not sync base:` with no
  reason, an `IntegrationError` printing a raw stack while a `FlowError` printed a sentence.

**Two open tickets sit on this code**, and the port should be sequenced against them rather than
around them: Q-0039 (no lock on a ticket — two runs overlapped twice in one night) and Q-0040 (a gate
cannot say "undecided", so `finish()` rolls back proven-green work). Both are listed before M3 for the
same reason, and both change this file.

**Two conflations inherited from Q-0048, which this ticket's requirement must carry as a
criterion.** Found by Q-0048's requirements run (2026-08-27), verified by reading, preserved there
under its AC-12(3), and routed here at that gate because the decision they need is about the run
loop rather than about a helper's return type.

- **`branchExists` and `branchHead` cannot tell "no such branch" from "git failed".** Both wrap
  `safe()` (`spike/src/fanout.js:69`), which swallows every error, so an absent ref and a git that
  could not run produce the identical answer.
- **`commitAll` wraps its `checkout` and `clean` in `safe()` too**, so a revert that *failed* still
  reports through `onDiscard` as though it had discarded — the engine warns that it dropped the
  agent's edits under `backlog/` when it may not have.

**Why it lands here rather than in Q-0048 or in a ticket of its own.** The engine is the only caller
of all three. What a caller should *do* with "git failed" — stop and name the work a human must do,
or carry on — is a question about `runFlow` and `handleFail`, and a ticket that could only widen
`branchExists`'s return to a three-valued state, with nothing reading the third value, would ship a
type change and no behaviour.

**The precedent that decides the shape is already in the same package.** *"Containment is derived
from git on each board invocation"* (2026-08-24) states the rule in as many words: the state is
selected from git's own exit codes and from nothing else, and exit 1 is *never* inferred from a
failure, a timeout or an absent binary — "conflating 'provably not' with 'could not answer'
manufactures exactly the confident falsehood this ticket removes". Q-0035 then removed an engine-side
`catch { return false }` that committed precisely this error, and put `ancestry()` in `core/git` as
the one primitive both callers reach. So `core` will ship a three-valued answer that forbids this
conflation, in the same package as two helpers that commit it. That is the argument, and it is also
the reason not to close it by reflex: `ancestry` has a caller that acts on the third value, and these
do not yet.

**What the requirement must state, at minimum.** For each site where the run loop consumes one of
these answers, what it does when git *fails* as distinct from when the branch is *absent* — even
where the answer is "exactly what it does today". An unstated answer is what lets the next reader
assume the question was considered.

**The charter binds this in both directions.** This ticket preserves behaviour like every other
child, so it may not close either conflation in passing; a reviewer may cite
*"The port preserves behaviour"* (2026-08-25) against a fix that arrives without authority. That
entry's own escape is the route if the fix is wanted: a dated decision entry, written and accepted
**before** it is implemented, never a silent improvement discovered in review. If Q-0050's
requirements or solutioning gate takes that route, the fix lands in `spike/src/fanout.js` and
`packages/core/src/fanout/` **together** once Q-0048 has landed — the Q-0066/Q-0068 shape — or the
port loses the independent witness the freeze exists to provide. Absent such an entry, this ticket
preserves and reports, and the item stays open.

**Two more from the same functions, added 2026-08-27 after Q-0048's implement round found them by
writing tests rather than by reading.** Both are preserved and pinned in Q-0048's suite; both land
here for the reason above — the engine is the only caller, and each fix is a decision about what a
caller does with a diagnostic rather than a change to a return type nobody reads.

- **`commitAll`'s first discarded path loses its first character.** `git()` trims the whole of
  `status --porcelain`, so a modified-but-unstaged entry (`" M path"`) has its leading space
  stripped **on line one only**, and the `.slice(3)` that removes the status columns then eats a
  character of the path. Measured: `['acklog/T-0001/ticket.md', 'backlog/T-0001/sneaked.md']` — the
  untracked entry (`"?? path"`, no leading space) and every later line are unaffected. It has
  survived because the list is a report to a human and never a path anything opens, and because
  `spike/test/smoke.js:400` asserts only `dropped.length >= 2`. It is the same `onDiscard` report as
  the failed-revert item above, so the two are one decision.
- **`mergeInto` returns `error: ''` on a content conflict.** The conflict case is the one where
  `conflicts` is populated and `error` is redundant; the case where `error` is the *only*
  information there is — a merge that fails with no conflicted paths — is exactly where it comes
  back empty. The fix is a choice between falling back on stdout, on `e.message`, or reporting the
  stream explicitly, which is a diagnostics decision of the same kind.

Q-0048's report records how the second was found, and it is worth keeping: the first draft of the
test asserted only `raw.endsWith(result.error)`, which passes vacuously over `''` and did pass.
Adding `expect(raw.length).toBeGreaterThan(0)` first is what turned a green tick into a finding —
*"a check that skips its subject must not report success"* (2026-08-25), arriving through a test
somebody had just written.

**Latent, and it stops being latent at M3.** A run that reaches this code has already spawned git
successfully several times, which is why nobody has been bitten. The daemon makes concurrent and
unattended runs ordinary, and a run nobody is watching is exactly where "git failed" rendering as
"the branch is not there" costs something.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **the full SDLC** (`requirements → solutioning → qa-red → development → review`) — the
one child routed differently, because the event stream is the port's single authorised behaviour
change and five later tickets code against its shape. Per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25); its solutioning
runs early, alongside Q-0041–Q-0048, not when its turn in the landing order arrives. Behaviour
is preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` run loop, routing, stage transitions, `runFlow` as event stream
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0041, Q-0049 · **Depended on by:** Q-0051
- **Invariants inherited:** register rows 5, 6, 16, 17, 19, 20, 21 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
