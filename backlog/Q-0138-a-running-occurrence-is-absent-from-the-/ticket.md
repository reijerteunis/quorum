---
id: Q-0138
title: A running occurrence is absent from the retained listing, not described
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0138/integration
priority: p2
created: 2026-09-19
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-19T14:54:44.851Z
    cost: 13.298
---
allocate pushes an occurrence with status running but does not persist, and replaceManifest runs only in terminal(), finalise() and once at run start — so a running occurrence reaches GET /history/:id/retained only when a different occurrence terminates. In a serial flow a step that is running is absent from the listing rather than carrying Q-0137 AC-8's sentence 2.

Opened **2026-09-19** at Q-0137's close, from what that ticket's **GO-5** measured by running the
product — not from a review, which five rounds did not find it. Opened as a ticket rather than left
in a closing entry because four obligations in this repository have expired that way (Q-0110's,
Q-0111's, Q-0112's, and Q-0100's inside a source comment); Q-0105 is the counter-example this
follows.

## What was measured, 2026-09-19

A mock run was started **through the daemon** (`POST /runs`, `adapters.mock.delayMs` 45000) against a
scratch ticket. While **two occurrence directories existed on disk with their `prompt.txt` already
written**, the manifest recorded `steps: 0` and `GET /history/:id/retained` answered
`{"occurrences": [], "warnings": []}`.

Read rather than inferred from that one observation: `allocate` (`packages/core/src/run-history/
writer.ts`) pushes the occurrence into `manifest.steps` with `status: 'running'` and **does not
persist**, and `replaceManifest()` is called in exactly three places — the end of `terminal()`, the
end of `finalise()`, and once at run start. `persist(occurrence, name, text)` does **not** call it.

**So a running occurrence reaches the listing only when a DIFFERENT occurrence terminates while it
is running** — the parallel-sibling case, which this repository's flows do have (`requirements`'
`pm-claude`/`pm-codex`, the review panels). In a **serial** flow a step that is running is absent
from the listing entirely.

## Why this is a ticket and not a fix

**Q-0137 AC-8 sentence 2** — *"No output, status `running` — this step has not finished"* — is
written for a state the listing cannot ordinarily show. It is not dead: the parallel case reaches
it. But the common path, a reader watching the step a run is on, renders **absence** rather than
that sentence, and absence is what this repository spends tickets removing (Q-0074, Q-0115, and
Q-0137's own round 3).

**The obvious fix is refused as obvious.** Reading the occurrence directory to find entries the
manifest does not record would make the route invent occurrences, against Q-0137's AC-1 and §4.3,
which make the listing manifest-derived and forbid `packages/server` from composing a path. Persisting
the manifest at `allocate` is a **write-path** change on the one file a run must never lose, and its
cost is Q-0037's measured quadratic roll-up (*"Whole-list, and therefore quadratic in occurrence
count"*) paid once more per occurrence. Neither is free and neither is this ticket's to assume.

**What it owes first is a measurement**: how often the parallel case already covers it, what an extra
`replaceManifest()` per allocation costs on the largest run here (`Q-0015-4`, 55 occurrences), and
whether the honest answer is instead that the screen says *this run has occurrences it cannot yet
name* — the **Connection state** discipline that no member is silence, applied to a listing.

## Not this ticket

1. **Q-0137's half is not reopened.** Both routes, the confinement, the identity comparison and the
   screen shipped and are `main:contained`.
2. **No cap, retention or eviction** — Q-0076 owns the write side, Q-0123 the daemon's records.
3. **The manifest's own shape is not changed**, and `readRun` stays *"a cast, never a check"*.
