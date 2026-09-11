---
id: Q-0119
title: The server serves the project, the backlog, the flow set and run history
stage: draft
owner: ruud
repos: []
branch: harness/Q-0119/integration
priority: p3
created: 2026-09-11
iterations: {}
history: []
---
Successor B of Q-0013, transcribed from that ticket's merged requirement Appendix B. The read-only REST surface: what project is open, what tickets exist, which flows are runnable, what previous runs did. Needs nothing added to core.

Opened **2026-09-11 at Q-0013's requirements gate** (its GO-5), transcribed **in full** from that
ticket's merged requirement rather than referenced — an obligation recorded only in a closed ticket's
entry expires, which this repository found three times in one week (Q-0110, Q-0111, Q-0112).

**Ordered after Q-0013**, which builds the run host every route below speaks to. Allocated at the
allocator's next id rather than at a planned one: M3's `Q-0014`–`Q-0019` are the screens, and taking
one would have collided with the web app shell.

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
