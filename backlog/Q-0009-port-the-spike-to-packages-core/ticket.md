---
id: Q-0009
title: Port the spike to packages/core
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0009/integration
priority: p1
created: 2026-08-25
iterations:
  requirements.head-of-product: 1
  chore.review: 3
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-25T01:03:50.603Z
    cost: 8.323
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-25T16:35:36.130Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: failed
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-25T16:35:36.139Z
    cost: 23.254
---
The runnable Quorum is still `spike/` — 2,261 lines of plain Node ESM across seven modules, plus a
616-line CLI and 3,142 lines of tests, on two dependencies and a hand-rolled runner. Q-0008 built
the workspace it is meant to move into: `packages/{core,shared,cli,server,compiler,templates}` and
`apps/web` exist, strict TypeScript, Vitest, ESLint and a two-job CI. They are empty on purpose.
This ticket is the port that fills `core` and `shared`, and it is deliberately **not implemented as
one ticket** — it is cut into fourteen, one per module, listed below. Q-0009 itself owns the ground
rules and the order; it ports nothing, and it does not own the cutover. Belongs to M2 in
`docs/06-development-plan.md`, which already anticipates this shape: *"one ticket per module is
fine"*.

## Why it is cut this far

The plan's line permits per-module tickets; two DECISIONS entries make them mandatory. *"Ticket size
is the dominant cost driver"* (2026-08-22) puts the ceiling at roughly ten independently testable
criteria and records what happens above it: Q-0006 shipped thirty, hit its iteration bound at every
stage, and cost about $24 to reach `solutioned` without a line implemented. *"Tasks are small; the
fan-out is the unit of parallelism, not of scope"* (2026-08-23) adds the other half — coarse tasks
share files, so the fan-out serialises and a single failure sends every task back round.

`spike/src/engine.js` is 1,113 lines and would be six or seven tickets' worth of criteria on its
own, so it is cut four ways along the seams that already exist inside it: the run loop, the diff
preflight, the step kinds, and fan-out/integrate. `adapters/` is cut two ways, at the line between
the contract layer (which every contributor adapter inherits) and the two vendor implementations.
Everything else is one module, one ticket.

## The rule the whole port hangs on: the spike stays authoritative and green

`spike/` is not dead code being replaced — **it is the harness Quorum is currently developed with**,
and every one of these fifteen tickets runs through it. CI's second job (`.github/workflows/ci.yml`,
`spike (regression suite)`) must stay green from the first commit of the port to the last. No ticket
in this set may edit `spike/src/**` to make a port easier, and none may delete it. The port is built
*beside* the machinery, which is the only reason the 2026-08-23 decision *"do not drive
harness-machinery work through the harness"* does not bite here: the engine under test is not the
engine running the flow. The moment that stops being true, this ticket set has a problem worth
stopping for.

Deleting `spike/` and pointing CI at the workspace is the cutover. It belongs to **a follow-up
ticket, proposed Q-0055** — not to Q-0009 as this body originally claimed, and not to any child.
It runs only once Q-0010 (the `quorum` binary) and Q-0054 (the suite) both report `main:contained`,
and it is drafted as `CO-1`–`CO-4` in `requirements/merged.md` and carried by
`harness/port-charter.md` §10.

## Two findings that change what "port" means here

**1. The module boundary in the spike is not the boundary to reproduce.** The CLI holds domain
logic that `04-architecture.md` places in `core`, and the most direct evidence is that
`loadProject()` — named in that document as part of core's public API — is implemented at
`spike/bin/harness.js:54`. It is not alone: the run-history reader (`readRunsDir`, `sortRuns`,
`manifestShapeError`, `occurrenceSeq` and the `realpath` traversal guard, harness.js:135–246), the
`run-manifest-v1` semantic pass and its roll-up recomputation (harness.js:270–360), `lintDirectory`
(374) and `overrideAdapters` (612) are all in the binary today. M3's server needs every one of them,
and Q-0010's job is to wrap core, not to keep custody of it. Each child ticket below names the CLI
code it lifts. A port that faithfully reproduces `bin/harness.js` would hand Q-0010 a package that
cannot be reused, which is the opposite of what M2 is for.

**2. The public API is a real interface change, not a transliteration.** `04-architecture.md`
specifies `runFlow(opts): AsyncIterable<Event>` and one trace format in `shared` that every adapter
maps onto. The spike's `runFlow` takes a `ui` object and prints. Turning a print loop into an event
stream is design work — it decides what M3's WebSocket carries and what run history could persist —
and it is the single largest risk in the port. Q-0050 owns it; every other ticket consumes whatever
it decides.

## What the requirements flow settled — all three, 2026-08-25

Three questions were raised here and deliberately left open for the requirements flow. All three
are now answered; the answers are recorded where the ticket body cannot drift from them, and this
section is kept for the reasoning rather than as an open list.

- **Which flow does a port take?** → *"The port takes the chore route, except the one child that
  has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Thirteen take chore; **Q-0050 alone**
  takes the full SDLC, because the event stream is the one child with behaviour a test can fail on
  before it exists.
- **Is the port allowed to change behaviour?** → *"The port preserves behaviour; one exception is
  authorised and everything else stops the child"* (`docs/DECISIONS.md`, 2026-08-25), with the
  invariant register at `harness/port-charter.md` §2.
- **Where do the zod schemas live?** → `packages/shared`, and `core` imports them.
  `docs/04-architecture.md` was the authority and `docs/06-development-plan.md` was corrected to
  agree. Charter §4 states the dependency direction.

The reasoning that produced them, as it stood before the gate:

- **Which flow does a port take?** Not obvious in either direction. The chore flow (2026-08-24)
  exists for work where a red phase cannot exist, and its rationale — *"a scaffold has no behaviour
  a test could fail on before it exists"* — plainly does not apply: a ported module has behaviour,
  and it has 3,142 lines of tests describing it. But the full SDLC's qa-red has nothing to write
  either, because the failing suite **already exists** in `spike/test/`. That is a third shape the
  seven-stage state machine has never seen, and it is worth naming before fourteen tickets are
  routed through the wrong one. Whatever is decided applies to all fourteen.
- **Is the port allowed to change behaviour?** The default answer is no — behaviour-preserving,
  with the ported tests as the proof — and the exception is the event stream above. Each child
  ticket names the invariants that must survive it; several of them are DECISIONS entries that were
  paid for in real money and would be cheap to lose in a rewrite.
- **Where do the zod schemas live?** `04-architecture.md` says `shared` (*"types, schemas (zod),
  event/trace format, constants"*), while the plan's Q-0009 line reads as though core carries them.
  Q-0041 assumes `shared` and core imports; if that is wrong it is wrong once, at the bottom of the
  dependency graph, which is why it is the first ticket.

## The fourteen, in dependency order

Ids start at Q-0041 because `docs/06-development-plan.md` reserves Q-0039 (one run at a time per
ticket) and Q-0040 (a gate can say "undecided"), neither of which has a folder yet.

| | Ticket | Ports |
| --- | --- | --- |
| 1 | Q-0041 | `packages/shared` — zod schemas, the trace/event format, constants |
| 2 | Q-0042 | `core/git` — worktrees, ancestry, containment, shallow state |
| 3 | Q-0043 | `core/backlog` — tickets, frontmatter, stages, `loadProject` |
| 4 | Q-0044 | `core/lint` — flow lint and whole-directory validation |
| 5 | Q-0045 | `core/contracts` — ajv validation and the `run-manifest-v1` semantic pass |
| 6 | Q-0046 | `core/adapters` — the contract layer and the mock adapter |
| 7 | Q-0047 | `core/adapters` — claude and codex |
| 8 | Q-0048 | `core/fanout` — tasks, waves, worktrees, branches |
| 9 | Q-0049 | `core/run-history` — manifest, occurrences, roll-ups, the reader |
| 10 | Q-0050 | `core/engine` — the run loop, routing, stage transitions, the event stream |
| 11 | Q-0051 | `core/engine` — diff preflight and materialisation |
| 12 | Q-0052 | `core/engine` — agent, gate and script steps |
| 13 | Q-0053 | `core/engine` — fan-out and integrate steps |
| 14 | Q-0054 | The regression suite on Vitest, and CI gating the port |

Q-0041 through Q-0048 have no dependency on each other beyond `shared` and can run in any order or
in parallel. Q-0049 through Q-0053 are the engine and want the order above, because each consumes
the run context the one before it defines. Q-0054 is last, and it is the only ticket that can prove
any of the others.

## The cost, stated because it is about to be paid fifteen times

A chore ticket in this repository has cost $26.81 (Q-0036, four runs) and $36.66 (Q-0035, three
runs) in billed Claude cost, plus Codex tokens no roll-up can price. Fourteen children at that rate
is roughly **$350–550** and several evenings. That is the price of the sizing decision, and the
alternative is documented rather than hypothetical: Q-0006 at thirty criteria never converged at any
price. Worth knowing before starting, and worth revisiting after the first three children land with
a measured number rather than this estimate.

## Four known hazards in the machinery these tickets will run on

All four are open tickets or recorded findings, and all four bite harder when fifteen runs are
queued rather than one:

- **The chore flow cannot run on a ticket's first pass** — `review` diffs against
  `harness/<id>/integration` and only `integrate`, which runs later, creates it. Q-0008 and Q-0036
  worked because the branch was made by hand minutes before. Recorded in Q-0038; if these tickets
  take the chore route, the branch must exist before each first run.
- **`budget.per_run_usd` stops nothing.** It is 10; Q-0035's runs spent $13.86 in one step and
  $22.27 in one run, uninterrupted. Recorded in Q-0038 and in the amendment to the bounded-loops
  decision.
- **A non-interactive gate cannot say "undecided"** (Q-0040), and `finish()` rolls back proven-green
  work when a run fails at one. It has cost two tickets their merge on consecutive nights.
- **There is no lock on a ticket** (Q-0039). Two runs overlapped twice in one night during M1.
