---
id: Q-0118
title: The daemon speaks HTTP and WebSocket
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0118/integration
priority: p2
created: 2026-09-11
iterations: {}
history: []
---
Successor A of Q-0013, transcribed from that ticket's merged requirement Appendix A. The three routes 04-architecture.md names, the WS envelope, request validation and status mapping, the loopback bind, the retention default, and the protocol contract the web app codes against.

Opened **2026-09-11 at Q-0013's requirements gate** (its GO-5), transcribed **in full** from that
ticket's merged requirement rather than referenced — an obligation recorded only in a closed ticket's
entry expires, which this repository found three times in one week (Q-0110, Q-0111, Q-0112).

**Ordered after Q-0013**, which builds the run host every route below speaks to. Allocated at the
allocator's next id rather than at a planned one: M3's `Q-0014`–`Q-0019` are the screens, and taking
one would have collided with the web app shell.

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
