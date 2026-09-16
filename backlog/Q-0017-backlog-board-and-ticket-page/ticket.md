---
id: Q-0017
title: Backlog board and ticket page
stage: draft
owner: ruud
repos: []
branch: harness/Q-0017/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
apps/web renders the backlog as one column per stage and a ticket's folder as tabs. GET /tickets serves the board's data today; nothing serves a ticket's folder, and WireTicket carries neither the iteration counters nor the per-vendor cost the design brief's card asks for.

Opened **2026-09-16** as M3's first screen ticket, at the id `docs/06-development-plan.md` has named
for it since M3 was written. The plan line was one sentence — *"Backlog board + ticket page (folder
rendered as tabs)"* — and everything below was measured against the tree before the ticket existed,
because this session's record is that a body transcribed from a plan line gets corrected by its own
requirements run at full price.

## What is already there, measured 2026-09-16

**The board's data is served and the ticket page's is not.** The daemon registers thirteen routes —
`/project`, `/tickets`, `/flows`, `/history`, `/history/:id`, `/runs`, `/runs/:id`, `/runs/:id/cost`,
`/runs/:id/events`, the three `POST`s and the static `GET /*`. **There is no `GET /tickets/:id`**, and
`grep` for a folder read in `packages/server/src/read.ts` returns nothing.

`apps/web` already declares both routes and both placeholders, naming this ticket:

    /backlog            'The board renders the backlog as one column per stage.'
    /backlog/:ticketId  "…renders a ticket's folder as tabs, with its run log down the side."

So the shell, the rail entry, the route register and the live connection are all in place from
Q-0014 and Q-0120; what is missing is the screens and, for one of them, the data.

## The two halves are not alike, and the gate should decide whether they are one ticket

**The board half is buildable against what exists.** `GET /tickets` serves `WireTicket` —
`id`, `title`, `stage`, `owner`, `branch`, `containment` — which is one column per stage with a card
carrying an id, a title and an owner, and containment already derived per request.

**The ticket page half has no endpoint at all.** *"Folder rendered as tabs"* needs a ticket's
artifacts — `requirements/`, `solution/`, `qa/`, `dev/`, `review/` and `runs.log`. `core` can already
read them: `Backlog.readFiles(ticket, pattern)` exists and `Backlog` is on the barrel, and Q-0059
confined it to the ticket's own folder, so the primitive is there and the **route** is not. That is
the same shape Q-0014 hit when it found `packages/server` unimportable, and that gate split the
ticket in two.

## Two gaps between the design brief and the wire, both measured

**1. The card the brief asks for needs two fields `WireTicket` does not carry.**
`docs/05-design-prompt.md:27` specifies each card as *"id, title, owner, iteration counters (review
1/3), cost to date per vendor, and a 'Run next flow ▸' button enabled only when a flow consumes that
stage"*. Measured, `WireTicket` carries **neither `iterations` nor cost**. `TicketRecord.meta` holds
`iterations` and `history`, so the first is a widening rather than a computation; per-vendor cost is
a roll-up over run history, which `GET /runs/:id/cost` already answers **per run** and nothing
answers per ticket. The *"Run next flow"* button additionally needs the stage→flow mapping, which
`GET /flows` serves and nothing joins.

Whether the card is scoped to what the wire carries, or the wire is widened to what the card needs,
is this ticket's first real decision — and **a card that renders a fabricated cost is refused before
preference enters**, `04-architecture.md:200` forbidding a placeholder that shows a fabricated
project, run, ticket or cost.

**2. `docs/05-design-prompt.md` still promises the override this product refuses, at three sites.**
`:11` (*"advances, re-runs, or overrides"*), `:35` (*"secondary 'Advance anyway' (override, requires
a one-line reason)"*) and `:43` (*"override → reason input appears"*). The schema is
`gateAnswerSchema = z.enum(['advance', 'retry', 'abort'])` and `gateAnswerEnvelopeSchema` is
`.strict()` over it; `askGate` raises on anything else.

**This is the third document to carry that claim and the first still uncorrected.** Q-0013's gate
found it in `04-architecture.md:63` and in the development plan's own M3 line, and Q-0118 corrected
the second — *"GO-2 is fully discharged"*, said of two documents while a third was never looked at.
**The design prompt is the document every screen ticket is built from**, so a brief promising a
control the engine refuses is one each of Q-0015 to Q-0018 inherits.

It is **not this ticket's to implement** — the gate screen is Q-0016's — but the correction is cheap,
is owed by the same discharge that missed it, and is recorded here rather than left for the fourth
ticket to rediscover.

## What it must decide

1. **One ticket or two.** The board is buildable today; the ticket page needs a route. Q-0014's
   precedent is that its gate split at exactly this seam, and Q-0122's is that refusing the split
   costs the difference in review rounds.
2. **The card's contents against the wire's**, per gap 1 — scope the card, or widen `WireTicket`, and
   in either case no fabricated value.
3. **What a ticket page renders when a folder is unreadable**, which is the daemon's first read of
   arbitrary ticket content over HTTP. Q-0060 is open and unfixed: a damaged or CRLF `ticket.md`
   parses as a ticket with **no fields** and no error, under the module this product calls its
   database. A page that renders that as an empty ticket would be the silent default
   `.claude/rules/engineering.md` forbids.

## Non-goals

Mission control (Q-0015), the gate screen and its diffs (Q-0016), run history drill-down (Q-0018),
resumable runs (Q-0019), and **fixing Q-0060** — whose defect this may surface and must not paper
over.
