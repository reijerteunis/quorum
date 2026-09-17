---
id: Q-0129
title: The gate screen shows the verdict that reached it, and the diff
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0129/integration
priority: p2
created: 2026-09-16
iterations:
  chore.implement: 0
  chore.review: 3
history:
  - stage: draft
    run: 1
    flow: requirements
    status: interrupted
    stage_before: draft
    stage_after: draft
    at: 2026-09-17T10:16:48.145Z
    cost: 7.391
  - stage: requirements
    run: 2
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-17T11:47:37.998Z
    cost: 21.035
  - stage: requirements
    run: 3
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-17T12:43:45.308Z
    cost: 0
  - stage: requirements
    run: 3
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-17T14:04:18.800Z
    cost: 0
---
**M3**, and the half split off from Q-0016 at its requirements gate on 2026-09-16. The body below is
§7 of `backlog/Q-0016-*/requirements/merged.md`, transcribed in full rather than referenced, because
three obligations found orphaned in one week had lived only inside a closed ticket's prose.

*(Opened at Q-0016's requirements gate, p2.)* Q-0016 ships the gate screen over channels that exist: the question, the
answers, the states. It renders **no verdict, no findings, no summary and no diff**, and its AC-13
makes that a checked property. This is the half that was split off, and the split was on measured
blockers rather than on size.

**(a) The verdict and its findings.** `steps.ts:339–340` writes `{verdict, findings, summary}` as
JSON to a path that is **a default a flow author may override** —
`String(declared.verdict_file ?? '<TICKET_ARTIFACT_DIR>/run-{run}/{stepId}-verdict-iter-{iter}.json')`
— inside the ticket folder. Measured 2026-09-16: **274 such files across 71 ticket folders**, not
the *"197 across 34"* Q-0016's own body reported, which was wrong in both halves when it was
written. `listTicketFiles` excludes them through `isHiddenPath` (`backlog.ts:329–334`), whose rule
is **a leading dot in the first segment and not the name `.harness`**, so a second hidden directory
is covered without anyone remembering; `GET /tickets/:id/file` re-derives membership per request, so
`.harness/` is unreadable as well as unnamed. **Q-0127's erratum E-1 ruled that exclusion and ruled
that no decision entry was owed *for excluding it* precisely because the opposite answer would owe
one** — serving engine run state from a backlog route makes `.harness/` part of what the backlog
surface means. So a route over that artifact is a decision entry before a line of code.

The three alternatives, each measured at Q-0016's gate:
*(i) verbatim prose from the stream.* The findings cross the wire as a `warn` whose message is
`` `${stepId}: ${verdict}${findings?.length ? ' — ' + findings.join(' | ') : ''}` `` — **conditional**,
so a `revise` carrying no findings emits no em-dash and no list, and the separator a parser would
key on is absent exactly when the list is. `warnEventSchema` is `.strict()` over `{type, message}`
with **no `stepId`**, so attributing it to a step means parsing a sentence. The `done` event does
carry `stepId` and its message opens `verdict=` **only where a verdict exists**.
*(ii) widen the event union* so a verdict crosses structurally, which is *"The event union is
derived from what the product emits"* (2026-08-25) and a `packages/shared` change.
*(iii) read it from run history.* **Struck at Q-0016's gate and not to be reconsidered without new
evidence:** `host.ts:294–306` sets `record.runId` only when the terminal event arrives — its comment
naming the terminal event as the only one carrying run identity and refusing to take a run number
out of a `gateId` — and history is keyed `<TICKET>-<n>`, so a run parked at a gate has `runId: null`
and its history id cannot be composed. Matching the newest `GET /history` row for the ticket is
inference, not identity.

**(b) The diff.** No route serves one; the transport's registered set is fourteen and none of them
does. `materialiseDiff` is `packages/core/src/engine/diff.ts`'s and is a prompt-building function
*inside* a run; the range is the flow's — `review.yaml` diffs `{base}...harness/{id}/integration` —
and the wire carries neither. A diff renderer would be this workspace's first: `diff2html`, `diff`
and `jsdiff` appear in no manifest. Whether the daemon derives the diff or `core` gains a function,
and whether the dependency is taken, are this ticket's to decide; a new dependency needs a one-line
justification and, if it changes architecture, an entry. `repo.max_diff_bytes` and **Q-0128** are the
neighbours: a diff served to a browser has the same truncation question a diff handed to a reviewer
has, and answering it twice in two places is how the two drift.

**What it must not do.** It may not widen the gate answer set — a decision entry of its own, and
`gateAnswerEnvelopeSchema` refuses a fourth today. It may not show a verdict where none exists:
measured at Q-0016's gate, **147 of 219 engine-recorded gate answers were at author-declared gates
that carry no verdict at all**, so the screen it extends must stay correct for the two-thirds case,
and `docs/04-architecture.md:317` forbids a placeholder showing a value nobody measured. And it may
not make `retry` the primary action, `05-design-prompt.md` screen 6 notwithstanding: at an
author-declared gate `retry` aborts the run (`routing.ts:79–96`).

**Start by re-measuring, and know how the census is counted.** `grep -c 'gate='` over
`backlog/*/runs.log` returns **254**, which is not the answer: it decomposes as 219 engine answers
(`gate=<kind> answer=<word>`, written at `routing.ts:48` alone), 34 retry-grant lines
(`gate=retry counter=…`), and one hand-written erratum note. Do not re-derive any figure above from
this body — they were true on 2026-09-16, and this repository's record is that a measurement copied
from a document is not a measurement, and that a correction travels one document further by being
copied (Q-0099).

---

*Verified at the gate that transcribed this, 2026-09-16, and it moved while being verified: the
decomposition above is exact as written, and `gate=` now matches **255** lines rather than 254 —
221 engine answers rather than 220 — because Q-0016's own requirements gate was answered between the
document being written and this check. Which is the paragraph above demonstrating itself.*

---

*Re-measured 2026-09-17, before the requirements run, as this body's own closing paragraph instructs.
**The structural claims hold and every count has moved.** `warnEventSchema` is still `.strict()` over
`{type, message}` with no `stepId`; `diff2html`, `diff` and `jsdiff` still appear in no manifest. The
figures, now: verdict artifacts **306 across 73 ticket folders** (was 274/71); engine-recorded gate
answers **235** (was 220), of which **157** are at author-declared gates (was 148). The movement is
this repository's own work between 2026-09-16 and today — Q-0016, Q-0015 and Q-0130 shipped, and
their gates are in that census. The zero that matters is unchanged: `retry` has still never been
chosen at an author-declared gate.*

*Sequencing ruled 2026-09-17: **Q-0129 runs before Q-0131**, which its own body requires be weighed
with this one. Both need one ruling — how a structured value the engine already holds reaches a
browser — and this ticket carries the harder instance: three fields rather than one, and an artifact
behind Q-0127 erratum E-1, which owes a decision entry. Settling it on the harder case and letting
Q-0131 apply it to `cost` is the cheaper order; deciding it twice is what the pairing instruction
exists to prevent.*
