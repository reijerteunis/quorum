---
id: Q-0137
title: The drill-down serves what an occurrence retained
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0137/integration
priority: p2
created: 2026-09-18
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-19T06:55:57.797Z
    cost: 21.93
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-19T08:45:39.624Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-19T11:48:42.509Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-19T14:08:06.539Z
    cost: 150.525
---
A finished run's history screen names each occurrence and can open none of them. The prompt each adapter step was sent and the output it returned are on disk and nothing in packages/server reads one. The confinement threat is that the path comes out of the manifest, which nothing on the read path validates.

Opened **2026-09-18** at **Q-0018's requirements gate**, from that run's Appendix A, which was
written as a body rather than as a paragraph so the obligation is a ticket rather than a sentence in
a closed ticket's prose. Three obligations in this repository have expired that way (Q-0110's,
Q-0111's, Q-0112's) and one inside a source comment (Q-0100's). The id was allocated by
`quorum ticket new` rather than assumed. Q-0018 erratum E-1 rules the seam; E-2 opens this.

**It runs after Q-0018 and cannot run before it.** A file is reached from an occurrence, an
occurrence from a run, and a run from the listing Q-0018 builds — and Q-0018's AC-12 leaves an
occurrence timeline for this ticket to plug into, so the work here is *each occurrence names its
retained files, and one opens* rather than building the occurrence rendering behind a blocking
ruling.

## What is there, measured 2026-09-18 at Q-0018's gate

`apps/web`'s history screen names each occurrence of a finished run and can open none of them. The
prompt each adapter step was sent and the output it returned are on disk — **1,779 files,
115,557,259 bytes across 171 runs** — and nothing in `packages/server` reads one: `grep` for
`prompt.txt` or `output.txt` across that package returns nothing. `core`'s reader offers
`resolveRunDirectory` and `readRun` and no file read of any kind.

## The confinement threat is not where a reader will look for it

Q-0127's file route takes an untrusted `?path=` **from a client** and derives membership per request.
Here the client supplies an occurrence *identity* and **the path comes out of the manifest**, which
`readRun`'s own JSDoc calls *"a cast, never a check"*: `manifestShapeError` proves only that
`run_id`, `ticket_id` and `status` are strings and that `steps` and `rollup` are arrays, and **no
occurrence field is validated anywhere on the read path** — verified at the gate. The only code
inspecting `occurrence_dir` is `contracts/run-manifest.ts`, which is `harness validate`'s semantic
pass and checks for **duplicates** rather than traversal. **No test in either package stages a
traversing `occurrence_dir`.** A manifest carrying `occurrence_dir: "../../../etc"` is a live path a
joining server would follow.

That is the difference from Q-0127 worth stating in one line: **there the untrusted value arrived
over HTTP, and here it arrives from a file this product wrote and does not re-check.** A guard
modelled on Q-0127's without reading this paragraph would confine the wrong value.

## A new `core` function is required rather than preferred

`resolveRunDirectory` is deliberately **not** on `@quorum/core`'s barrel — verified: `index.ts:124`
exports `isIncomplete`, `occurrenceSeq`, `readRun`, `readRunsDir`, `sortRuns` and `vendorTokenTotal`,
and not it — because publishing a path-returning function *"whose only correct use is to be opened
immediately"* leaves a caller free to resolve lexically and read anyway. *Ruled rather than offered;
see Q-0092's `merged.md` OQ-1.* So the server may not compose the path, and the pair Q-0127 built is
the shape: **a listing function that names and measures an occurrence's files without opening one,
and a byte reader that confines and reads exactly one.**

## The file-name set is open by construction

`writer.ts`'s `persist(occurrence, name, text)` takes the name as a **parameter**. Two names have
ever been written — `output.txt` 931, `prompt.txt` 848 — and a drill-down hard-coding them would be a
register free to drift from the writer. **List the directory.**

## What the files measure

Retained bytes per occurrence: max **355,744**, median 99,652, p90 236,872. Per run: max
**3,514,617**, median 459,758. Largest single file 353,626 B
(`Q-0129-3/steps/009-review/prompt.txt`). Of 1,779 files, **8 are empty, 0 are not well-formed
UTF-8, and 14 contain U+FFFD legitimately** — so the naive *does the decoded text hold a replacement
character* test would report fourteen real prompts as binary on the day it shipped. **Take the UTF-8
verdict with the decoder that will serve the bytes**: Q-0127 found `iconv` and `TextDecoder`
disagreeing on a file that round-trips byte for byte.

**Those numbers decide the payload, and it is this ticket's first decision rather than an
implementation detail.** A listing of `{name, bytes}` with one file fetched on demand means the
largest thing a reader ever receives is **355,744 B**. Serving a run's text in one response makes it
**3,514,617 B** and **makes Q-0076 this ticket's blocker** rather than leaving it at p3.

## Two occurrence cases are ordinary and neither is a blank

All **84** occurrences with no `prompt.txt` are `integrate` steps (77 completed, 7 failed) — this
product has produced no `script` occurrence ever — so *this step was not an adapter call* is a true
sentence rather than a guess.

And an occurrence with no `output.txt` is a step that has **not finished**, not one that is damaged:
`writer.ts` guarantees an empty `output.txt` at terminalisation. *Appendix A measured exactly one
such occurrence and that one was Q-0018's own `head-of-product`, mid-flight as the document was
written; it has since terminated, so the count is **zero** today. The rule is what matters and it is
unaffected — re-measure the count rather than inheriting either figure (Q-0018 erratum E-4).*

## Criteria sketch

**AC-B1** a `core` listing function over one occurrence, confining against the manifest's own
`occurrence_dir` and **shown red against a traversing fixture** — the case no test in either package
stages today. **AC-B2** a `core` byte reader: whole file, one read, one verdict. **AC-B3**
`GET /history/:id/file` taking the occurrence identity and the file name as **query values**, with
membership derived for that request rather than from a listing the client fetched earlier. **AC-B4**
refusal codes telling a name that was never listed from a file that stopped being one between the
listing and the read. **AC-B5** the two ordinary cases above, each a sentence. **AC-B6** the UTF-8
refusal under its own code, taken with the serving decoder. **AC-B7** the screen, plugging into
Q-0018's occurrence timeline. **AC-B8** the architecture document's route enumeration.

## Open first

**OQ-1, carried from Q-0018's `merged.md` and blocking here.** May a route serve a *file* under
`.quorum/`? The framing that matters was found in shipped source rather than reasoned:
`packages/shared/src/wire.ts:526` says a ticket's listing names no dot-path because *"naming the
paths would make a backlog route a second run-history surface, **which is Q-0018's**"*. So Q-0127
did **not** rule that engine run state may not be served — it ruled it may not be served **from the
backlog route**, and forwarded this subject here by name. The ruling owed is therefore narrower:
does that forwarding survive the difference between an empty `.harness/` inside a ticket folder and
115,557,259 B under `.quorum/runs`? **A payload question wearing an authority question's clothes.**
Measure before choosing; Q-0090's erratum E-1 is the precedent for ruling a scope question of
exactly this shape, and it ruled the cited entry **did not** govern.

## Re-measured at launch, 2026-09-18

Every figure above was re-derived before this ticket's requirements run, per Q-0018 erratum E-4's
own instruction. **The three the payload decision rests on did not move**: largest occurrence
**355,744 B**, largest run **3,514,617 B**, largest single file **353,626 B**
(`Q-0129-3/steps/009-review/prompt.txt`) — so §*What the files measure* stands as the argument it
makes. The store grew by Q-0018's own runs: **172** runs, **938** occurrences, **1,791** files,
**116,567,139 B**, median per occurrence 99,716 and p90 237,843, median per run 460,510. Occurrences
with no `prompt.txt` are **85** and **every one is still an `integrate` step** (78 completed, 7
failed), so §*Two occurrence cases* holds with its count moved by one. Occurrences with no
`output.txt` are **zero**, which is what that section predicted. **8** files are empty, **0** are not
well-formed UTF-8 under `TextDecoder('utf-8', {fatal: true})`, and **14** contain U+FFFD
legitimately — so the naive replacement-character test would still report fourteen real prompts as
binary. **No `occurrence_dir` on disk traverses**; the threat is what a manifest *may* carry, not
what one does.

**One citation was wrong and is corrected here rather than inherited.** OQ-1's framing sentence is
at `packages/shared/src/wire.ts:737`, not `:526` — Q-0018's own edits to that file moved it. The
sentence is unchanged and says what OQ-1 quotes.

**And one measurement OQ-1 should start from, which the body above does not have.** The transport
has served `.quorum/runs` state since Q-0119: `GET /history` and `GET /history/:id` both answer from
it, and Q-0018 widened the second. So *may a route serve `.quorum/`* is not open — it is answered by
six days of shipped code. What is open is narrower than the body states: whether a **file's bytes**
differ in kind from a **manifest's fields**, both being read from the same gitignored tree. Measure
that difference before choosing; do not re-derive the authority question the routes already settle.

## Non-goals

1. **Q-0018's half is not re-opened.** The listing, the table, the widened wire shapes and the
   occurrence timeline are shipped; this adds files to them.
2. **No event is persisted and no event gains a field.** The drill-down is an occurrence's retained
   text, never a trace — a finished run has no event stream, which Q-0018 §0.5 establishes.
3. **No cap, retention policy or eviction is built here.** Q-0076 owns any cap; the design above is
   chosen so its premise does not move, and if the design taken crosses that boundary it is a gate
   finding for that ticket rather than scope this one absorbs.
4. **No manifest is repaired**, including one whose `occurrence_dir` is refused — a refusal names the
   condition and changes nothing on disk.
