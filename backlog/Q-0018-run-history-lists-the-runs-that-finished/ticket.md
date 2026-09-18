---
id: Q-0018
title: Run history lists the runs that finished, and drills into one
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0018/integration
priority: p2
created: 2026-09-18
iterations:
  chore.review: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-18T18:30:22.082Z
    cost: 14.638
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-18T20:28:34.500Z
    cost: 70.607
---
apps/web renders the /history screen: a table of finished runs, and a drill-down into one run's occurrences and the prompt and output each retained. GET /history declares no shape and has no consumer; nothing serves an occurrence's retained files.

Opened **2026-09-18** at the id `docs/06-development-plan.md` has named for it since M3 was written.
The plan line is one sentence — *"Q-0018 Run history + trace drill-down."* — and everything below
was measured against the tree at `61093d1` before the ticket existed, because this milestone's
record is that a body transcribed from a plan line is refuted by its own requirements run at full
price (Q-0015 three times, Q-0016 three, Q-0127 twice), while the one body written from a merged
requirement at a gate survived re-measurement intact (Q-0130, nine claims, nine holding).

## What is already there, measured 2026-09-18

**The daemon registers fifteen routes**, enumerated over `packages/server/src/*.ts` with the test
files excluded — because a scan that includes them reads `package.test.ts`'s fixture named `hostile`
as production, which is how Q-0017's body acquired a `GET /runs/:id/cost` that has never existed.
Two of the fifteen are history's, both from Q-0119: `GET /history` and `GET /history/:id`.

`apps/web` already declares the route and the placeholder that names this ticket —
`/history`, `screenExists: false`, *"Run history lists the runs that finished, and drills into one of
them."* — and the rail's **History** entry is one of five still `false`. So the shell, the rail, the
route register, the request-state vocabulary, the daemon client and the live connection are all in
place from Q-0014, Q-0017 and Q-0120. What is missing is the screen and, for half of it, the data.

## Three things do not exist, and they are not alike

**1. `GET /history` declares no shape and has no consumer.** A grep for `WireHistory` or
`HistoryList` across `packages/shared/src`, `packages/server/src` and `apps/web` returns nothing;
the route answers an inline object literal in `read.ts`. `daemon-client.ts` exports `fetchRunHistory`
— the **detail**, added for mission control's per-vendor cost split — and no listing fetch at all.
The only use of `DAEMON_ENDPOINTS.history` under `src/` is `historyDetailPath`.

*This corrects one sentence already in the tree, and it is recorded rather than fixed in passing.*
`packages/shared/src/wire.ts`'s `WireRunHistory` docblock says it *"closes the last route on this
transport that declared no shape"*. Measured, **two still declare none**: `GET /history` and
`GET /project`, both answering inline object literals. The sentence is true of what a browser reads
and false as written — a comment claiming what its code does not deliver, which is this
repository's most-recorded defect class. This ticket closes the `/history` half by building on it;
`/project`'s is somebody else's and is named here so the next reader does not take that docblock as
coverage.

**2. The listing carries five fields and the design brief's table asks for nine.** Today:
`id`, `ticket`, `flow`, `status`, `incomplete`. `docs/05-design-prompt.md` §8 asks for *"id, ticket,
flow, vendors used (badges), status, duration, cost, tokens"*. Four of those — vendors, duration,
cost, tokens — are in every run's manifest and in no listing row, so a table built on today's route
either drops four columns or issues one detail read per row, which is **170 reads** on this machine.

Measured rather than guessed: a listing widened with `started_at`, `ended_at`, `duration_ms`, the
whole `rollup` and an occurrence count is **62,679 B for 170 runs** against **16,050 B** today —
369 B per row against 94. Both are small, which is the answer Q-0127 reached about the ticket
listing and the shape to copy: **specify no cap, and say the measurement**, rather than disclose one.

**3. Nothing serves what an occurrence retained, and that is the drill-down.** `grep` for
`prompt.txt` or `output.txt` across `packages/server/src` returns nothing. `core`'s reader offers
`resolveRunDirectory` and `readRun` and no file read of any kind.

## The central measurement: the drill-down is not the event trace

The plan says *"trace drill-down"* and the brief's §8 ends *"Clicking opens the trace (reuse screen 5
in a 'completed' state)."* **Screen 5 cannot be reused for a run on disk**, for two independent
reasons, and neither is a matter of effort.

**Events are not persisted.** `grep events packages/core/src/run-history/writer.ts` returns nothing,
and `docs/GLOSSARY.md`'s **Event** term says *"Not persisted in v1 (see Run history, which is)"* in as
many words. Mission control's trace columns, its run-activity lane and its observed-only timeline are
every one of them derived from accepted events off a socket. **A finished run has no event stream to
render.**

**And the two identity schemes do not meet.** A handle is minted by a module-level counter inside one
`createRunHost` closure and is *"deliberately meaningless across a restart"*; a history id is
`<TICKET>-<n>` and names a directory. `.quorum/runs` holds **170** run directories and a freshly
started daemon holds **zero** handles, so the overlap — runs this daemon process itself drove — is
empty on every first page load and stays empty until somebody starts one.

What a finished run **does** have is the manifest's occurrence array and two files per occurrence. So
the drill-down is an occurrence list and its retained text, and a criterion written from the brief's
sentence would specify a screen with nothing to draw. The brief gets a recorded divergence, on
Q-0017's and Q-0129's precedent, rather than being followed.

## What the occurrences and their files measure

170 run directories, **0 unreadable**. 930 occurrences, max 55 in one run, median 4.

    manifest.json              max  38,606 B   median   3,599 B
    GET /history/:id today     max  55,311 B   median   4,528 B
    retained bytes/occurrence  max 355,744 B   median  99,679 B   p90 237,048 B
    retained bytes/run         max 3,514,617 B median 460,510 B

Retained files are **exactly two names**: `output.txt` (930 — one per occurrence) and `prompt.txt`
(846), an occurrence with no prompt being a script or an integrate step. Of **1,776** files, **8 are
empty, 0 are not well-formed UTF-8**, and **14 contain U+FFFD legitimately** — so the naive
*"does the decoded text hold a replacement character"* test would report fourteen real prompts as
binary on the day it shipped, which is what Q-0127 measured one directory over. Take the UTF-8
verdict with the decoder that will serve the bytes; that ticket found `iconv` and `TextDecoder`
disagreeing on a file that round-trips.

**The shape those numbers argue for is already built once.** `GET /tickets/:id/file` is the precedent
line for line: the relative path as a **query value** and never a segment, membership derived for
that request from the listing rather than from one the client fetched earlier, `core` confinement
underneath rather than instead, a whole-file fatal decode, and refusal codes that tell a path that
was never listed from a file that stopped being one between the listing and the read.

**It is also what keeps Q-0076 where it is.** That ticket — *nothing in run history has a cap, and
prompts are the largest thing in it* — is listed in the plan as mattering because *"M3 serves"* them,
and this is the ticket that does. A listing of `{name, bytes}` with one file fetched on demand means
the largest thing a reader ever receives is **355,744 B**; serving a run's text in one response makes
it **3,514,617 B** and makes Q-0076 this ticket's blocker. The design decides whether that ticket
stays p3.

## What a screen must render, and what this backlog cannot teach it

`completed` 141, `failed` 16, `regressed` 9, `aborted` 3, `interrupted` 1. **`undecided` and
`exhausted` have never occurred here** and both are members of `RunStatus`, so a screen whose status
rendering is derived from this corpus is missing two. **`incomplete` is 0 of 170** today — but the
route reports it and `docs/04-architecture.md` is explicit that a server must not tidy a `running`
manifest it meets on read, so no criterion may be written from this backlog's luck.

**337 roll-up rows, of which 167 report no price — 49.6%.** A cost column therefore renders `n/a` and
never `$0.00` for half its vendor rows, which is `formatCost`'s rule and the one Q-0135 landed for
mission control's header; and **no figure is summed across vendors**, which *"Codex cost is reported
as tokens, never priced locally"* (2026-08-22) refuses. Exactly two vendor strings appear in the
whole corpus, `claude` and `codex`, so a rendering that branched on either name would pass here and
fail on an adopter's machine — Q-0135's GO-5 demonstrated its header under two vendor names this
product has never seen, for that reason.

## The seam, if the gate wants one

Measured against this milestone's own record — Q-0013 refused at eighteen criteria and split in
three, Q-0091 and Q-0096 split at twenty-one, Q-0122 accepted twenty and paid three implement
rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked` — this is
plainly more than one ticket's worth, and the seam is the one Q-0017 was cut on:

- **The listing half is buildable against a route that exists.** A shared shape, a widening that is a
  projection of a manifest the route already reads, a client fetch, and the table. It owes no
  decision entry under any ruling: the route, the reader and the rendering primitives are all there.
- **The drill-down half needs a route built for it**, with a confinement surface, a payload decision
  and a ruling to ask for (below). It also cannot start first in any useful sense: a drill-down is
  reached from the listing, and the listing is what tells a reader which run ids exist.

Recommended, not decided. The gate rules it.

## Open questions

**OQ-1 (blocking, if the drill-down is in scope).** **May a route serve a file under `.quorum/`?**
`GET /history` has served manifests from there since Q-0119 and `docs/04-architecture.md` names run
history as something the server reads, so the precedent exists for the *directory*. What has not been
ruled is the **file**: Q-0127's erratum E-1 excluded `.harness/` from a ticket's listing precisely
because it is gitignored engine run state, and ruled that no entry was owed *for excluding it* because
the opposite answer would owe one. Whether that reasoning reaches `.quorum/runs` — a different surface
answering a different question — or stops at the backlog route it was written for, is the ruling.
Q-0090's erratum E-1 is the precedent for ruling exactly that kind of scope question, and it ruled the
cited entry **did not** govern. Measure before choosing.

**OQ-2.** Does the listing widen, or does the table drop four columns? §2 above measures the widening
at 369 B a row and the alternative at 170 reads. State the answer; do not leave it to an implementer.

**OQ-3.** What does the screen do with a run this daemon **is** driving? `GET /history` reports
`incomplete` and `GET /runs` reports live handles, and one run can be in both — Q-0121 measured that
a run in flight already lists as incomplete in history, and called that *"a true report rather than a
gap to paper over"*. Whether the history screen links such a row to mission control, where the live
trace actually is, is a design question with a measured fact under it.

**OQ-4.** Is the empty state this repository will never see worth a criterion? `.quorum/` is
gitignored, so **an adopter's fresh clone has zero runs** and the first thing they see on this screen
is the empty one — which `docs/04-architecture.md` forbids being a blank panel or a spinner.

**OQ-5.** What does the drill-down show for an occurrence whose `output.txt` is one of the **8 empty
files**, and for one of the **84 occurrences with no `prompt.txt`**? Both are ordinary — a script step
retains no prompt — and both are a sentence rather than a blank.

## Non-goals

1. **Mission control is not touched.** It is a live surface over a socket and this is a surface over
   a directory; the brief's *"reuse screen 5"* is refuted above, not deferred.
2. **Nothing new is persisted, and no event gains a field.** Everything this screen renders is already
   on disk.
3. **Q-0076's cap is not built here.** It is measured above and the design is chosen so that ticket
   stays where it is; if the design chosen makes it a blocker, that is a gate finding rather than
   scope this ticket absorbs.
4. **`GET /project`'s missing shape is reported and not fixed** — a different route, and naming it in
   a criterion would be widening this ticket to close a sentence in a docblock.
5. **No run is repaired, tidied or deleted.** A `running` manifest is reported as it stands.
