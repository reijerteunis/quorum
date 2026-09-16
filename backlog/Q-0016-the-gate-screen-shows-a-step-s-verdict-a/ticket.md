---
id: Q-0016
title: The gate screen shows a step's verdict and takes the answer
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0016/integration
priority: p2
created: 2026-09-16
iterations:
  requirements.head-of-product: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-16T15:32:34.955Z
    cost: 16.373
---
A run parked at a gate is answered in the browser: the screen shows what the gate is asking, what the step it follows decided, and offers exactly the three answers a gate takes.

**M3**, `docs/06-development-plan.md`, where the bullet has read *"Q-0016 Gate screen with diffs
(git diff rendered; `diff2html` or similar)"* since the milestone was written, and where
`docs/05-design-prompt.md`'s screen 6 calls it the **second hero screen**. The id was allocated by
the plan rather than by the allocator, so the folder is created at it with `--id`.

## Measured against the tree, 2026-09-16, before the run

Every number below was taken from the tree today. None is transcribed from the plan, from the design
brief, or from a sibling ticket's entry.

**(a) The gate question carries no verdict, no findings and no diff.** `gateQuestionEventSchema`
(`packages/shared/src/events.ts:179`) is `.strict()` over exactly `type`, `gateId`, `kind`, `reason`,
`ticketDir` and an optional `retry` — six fields, and `reason` is a sentence the engine composes at
one of two sites: `routing.ts:82` for an author-declared gate (`step.reason ?? step.prompt ?? "<flow>:
approve to advance ticket to …"`), and `routing.ts:140–142` for an engine-presented one, which spells
the loop counter, its limit and what each of the three answers would do. So the brief's screen 6 names
**three payloads the wire does not carry**: a verdict card "with the blockers listed", a "side-by-side
diff summary (files changed, +/- lines, one expanded hunk)", and "the judge's full reasoning in a
collapsible".

**(b) The verdict artifact exists, and it is deliberately unreachable.** `steps.ts:339–340` writes
`{verdict, findings, summary}` as JSON to `.harness/run-{run}/{stepId}-verdict-iter-{iter}.json` inside
the ticket folder — **197 of them across 34 tickets** in this backlog today. `listTicketFiles`
(`packages/core/src/backlog/backlog.ts:375`) excludes every dot-segment path into a `{count, bytes}`
with no names, and `GET /tickets/:id/file` re-derives membership per request (`read.ts:322–326`), which
is what its own comment calls making `.harness/` *"unreadable as well as unnamed"*. **Q-0127's erratum
E-1 ruled that exclusion the same day this ticket was opened**, and ruled that no decision entry was
owed *for excluding it* precisely because the opposite answer would owe one — serving engine run state
from a backlog route makes `.harness/` part of what the backlog surface means. So the one artifact a
verdict card wants sits behind a ruling made hours ago, and reaching it is a decision rather than a
fetch.

**(c) The findings DO cross the wire — as prose, on exactly the path that leads to a gate.**
`steps.ts:364` emits a `warn` spelling `` `${stepId}: ${verdict} — ${findings.join(' | ')}` `` whenever
a declared verdict is not the vocabulary's first option, which is the failure that routes to
`handleFail` and from there to a gate. `steps.ts:353` emits a `done` whose free-text `message` opens
`verdict=<value>`. And `terminalOccurrence` (`steps.ts:355–359`) records `verdict` on the occurrence —
so `GET /history/:id` can answer the verdict **word** for a completed run, and carries no findings and
no summary, because the occurrence has no field for either. A screen that parsed either message for
machine meaning would be reading a human sentence as a contract; a screen that showed them verbatim
would be showing what the run actually said. **Those are two different answers and the difference is
not cosmetic.**

**(d) A reload can still find the gate, and the mechanism is worth stating because it is not
obvious.** `createBroadcast` evicts from the **head** (`broadcast.ts:123–125`) and `askGate` emits the
question and then parks on the answer channel (`routing.ts:14` onward), so for as long as a run is
waiting the gate question is the **newest** event on the stream and survives any eviction, whatever
`DEFAULT_RETENTION` is. That is what makes this screen buildable from a cold browser at all. What it
does **not** make buildable: `WireRun.pendingGates` (`wire.ts:116`) is a **count**, so `GET /runs/:id`
can say *a gate is waiting* and cannot say *which one or what it asks* — the replay is the only channel
carrying the question itself, and it is sufficient today by one property rather than by design.

**(e) This is the app's first write of any kind, and a shipped guard forbids it by name.** `FetchLike`
is `(path: string) => Promise<DaemonResponse>` (`apps/web/src/daemon-client.ts:48`) — a GET and nothing
else: no method, no body, no headers. And `apps/web/test/source.test.ts:184–201`, Q-0017's
AC-5/AC-10/AC-11/AC-13, asserts over every file under `apps/web/src` that none contains
`method: 'POST'`, `'PUT'`, `'PATCH'` or `'DELETE'` **and that none names the string `'/gate'` or
`'/stop'` at all**. Q-0016 is the ticket that has to move it.

**(f) Nothing navigates here.** `/runs/:handle/gate` is registered in `apps/web/src/routes.ts`, its row
names this ticket and its `screenExists` is `false`; the route above it, `/runs/:handle`, is Q-0015's
placeholder. So until mission control links to it, a gate screen is reachable by typing a URL.

**(g) Fourteen routes, and none of them serves a diff.** Five in `http.ts`, seven in `read.ts`, the
WebSocket in `serve.ts`, the static fallback in `static.ts`. `materialiseDiff` is
`packages/core/src/engine/diff.ts`'s and is a prompt-building function *inside* a run; nothing exposes a
diff to a client, and the range a gate's diff would show is the flow's — `review.yaml` diffs
`{base}...harness/{id}/integration` — which the wire does not carry either. **A diff renderer would be
this workspace's first**: `diff2html`, `diff` and `jsdiff` appear in no manifest here.

## The seam, proposed rather than assumed

Two halves, and the measurements above are what separate them.

**The screen, over channels that exist.** The pending gate read from the replayed stream, the question
rendered — kind, reason, the step a `retry` would jump back to, the ticket — exactly three answers
posted to `POST /runs/:id/gate`, and what the run does next shown from the same stream. Every endpoint
this needs is shipped. What it costs is the app's first write channel and the guard re-aimed.

**The evidence, over channels that do not.** The verdict card's findings and summary, and the diff.
Both need a new payload, one of them needs a decision entry by Q-0127 E-1's own words, and the diff
additionally needs a range the wire does not carry and a dependency this workspace does not have.

**Recommended: split, with this ticket taking the first half** — on the precedent of Q-0013 (refused at
eighteen criteria and cut in three), Q-0014 (cut in two, Q-0120 taking the half with behaviour) and
Q-0017 (cut in two at exactly the seam between a screen over endpoints that exist and a screen needing
a route built for it). The gate rules; this is a recommendation and not a decision, and Q-0122's gate
is the precedent for refusing one.

## Ground rules

1. **Three answers, no fourth, and no reason field.** `gateAnswerSchema` is
   `z.enum(['advance','retry','abort'])` and `gateAnswerEnvelopeSchema` is `.strict()` over it, so
   `askGate` raises on anything else. Three documents promised "override with reason" and all three are
   corrected — `04-architecture.md` at Q-0013, this plan's M3 line at Q-0118, and the design brief at
   Q-0017, whose own status line names **this ticket** as the one that may widen the answer set *with a
   decision entry of its own*. Not widening it is the default, and widening it is not a screen decision.
2. **No placeholder shows a value nobody measured** (`docs/04-architecture.md:200`). A verdict card with
   no verdict available shows no verdict card — not a dash, not a skeleton, not a spinner where one
   would go. And no state of this screen is silence.
3. **Nothing is persisted in the browser.** The app holds a path and one live connection; a gate answer
   is not state to keep.
4. **The read-only guard is re-aimed, never deleted.** The board and the ticket page still may not
   write, and a guard removed is a boundary that stops existing for them too. Q-0116's inverted pin and
   Q-0055's flipped `PRESENCE_CASES` rows are the shape.
5. **Answering is the one mutation.** No run started, no run stopped, no stage moved, no lock taken.
6. **The engine and the answer set are not edited here.** A finding that says otherwise is a gate's, and
   `verdict=blocked` is the channel for saying so (Q-0083).

## Open questions

**OQ-1 (BLOCKING) — where the verdict comes from.** Four candidates, each with a different cost:
(i) show only what the stream carries, verbatim, and render no structured verdict at all; (ii) widen the
event union so a verdict crosses structurally, which is *"The event union is derived from what the
product emits"* (2026-08-25) and a `packages/shared` change; (iii) a new route serving the verdict
artifact, which reopens Q-0127 E-1 and owes a decision entry by that erratum's own words; (iv) read the
verdict word from `GET /history/:id`'s occurrence, which carries no findings and no summary. **Measure
before choosing** — in particular, measure what a real gate's `warn` and `done` messages actually say
against this repository's own run history, rather than reasoning from the format string.

**OQ-2 (BLOCKING) — is the diff in this ticket at all.** If it is: what range, given that the flow owns
it and the wire does not carry it; whether the daemon derives it or `core` gains a function; and whether
`diff2html` is a dependency this repository takes, which needs a one-line justification and, if it
changes architecture, an entry.

**OQ-3 — what a second answer looks like.** `gates.ts` deletes the pending gate and then settles it, so
"exactly one wins" is a property. A client whose POST succeeded but whose response was lost, retrying,
is answered `404 no-such-gate` for an answer that landed. Is that rendered as *already answered* or as a
failure? The two are different sentences and only one of them is true.

**OQ-4 — what the screen shows when the run is not parked.** `pendingGates: 0`, a run that has `ended`,
a handle the host never minted (404), and a daemon that is not running are four states; none may be
silence, and none may claim a gate that is not there.

**OQ-5 — whether `retry` is offered when the question does not carry one.** `retry` is optional on the
question and present only where the gate offers one: an engine-presented gate always carries it, an
author-declared gate does not. Offering three buttons where one cannot be answered would be a control
that does nothing.

**OQ-6 — whether `/runs/:handle/gate` survives as a route.** It is a URL for a transient state: the gate
it names is gone the moment it is answered, and a bookmark to it is a bookmark to a decision somebody
already took. Keeping it, folding it into `/runs/:handle`, or redirecting once answered are three
answers, and the route register is `routes.ts`'s to hold either way.

**OQ-7 — the route through the flows**, taken at the gate. Q-0120 walked the full seven-stage route and
is the only M3 ticket to have done so; Q-0017 and Q-0127 went `requirements` → `chore`. M2's closing
measurement — that the feature flows have four tickets of evidence between them, all from August — is
the argument for the full route, and the size of this ticket after OQ-1 and OQ-2 are ruled is the
argument against.

## Non-goals

Mission control (Q-0015) and the navigation that would reach this screen from it. Step chat (Q-0022).
Run history (Q-0018). Starting or stopping a run from the browser. Widening the gate answer set.
Listing or serving `.harness/` from the ticket routes. Any authentication: the daemon binds loopback
and has none, and this screen adds none.
