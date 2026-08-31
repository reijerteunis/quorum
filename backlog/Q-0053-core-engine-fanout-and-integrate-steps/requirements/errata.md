# Errata — Q-0053

Corrections and rulings against `requirements/merged.md`, dated, written before implementation
where the charter requires it.

## E-1 — `mergeBase` captures git's stderr: one accepted charter §2 divergence — 2026-08-31

**Ruled: accepted, registered, reported.** This entry exists so the acceptance sits in the vehicle
the charter names. `merged.md`'s OQ-2 ruled it and its reasoning is adopted here unchanged; what it
lacked was a home. `harness/port-charter.md` §2:109–111 names exactly two:

> The route for a deliberate behaviour change is its own `docs/DECISIONS.md` entry **or a dated
> erratum in the child's folder**, written and accepted *before* it is implemented, never a silent
> improvement discovered in review.

A requirement is neither of those, so the ruling is restated as a dated erratum, before any
implement round begins. Nothing about the ruling changes.

### The divergence

`spike/src/engine.js:550–553`'s `safeMergeBase` calls `execFileSync` with **default stdio**, so a
failing `git merge-base` prints git's own `fatal:` line to the terminal. `packages/core`'s `git()`
pipes, and swallows it. §2 counts *"what a command prints"* as externally observable, so this is a
real divergence and not an internal-layout change.

### Why it is accepted rather than avoided

The alternative is a second stdio mode on `git()` for one caller, and it is refused on two
measurements rather than on taste. `git.ts`'s single argv-and-piped-stdio shape is a **Q-0042
criterion with its own guard** — `git.source.test.ts` pins `merge-base` to one file and
`Object.keys(gitModule)` to a fixed export list — so widening it edits a landed guard on a
neighbouring child's module. And a library that writes to a process stream is what **M3's daemon
cannot host**: the server has no terminal to print to, and the line would be lost or misrouted
rather than merely relocated.

The divergence's blast radius is stated rather than assumed: it touches **no artifact, no `runs.log`
line, no branch, no worktree and no stop point**, and it is reachable only through the evidence
loop's deliberately unfiltered list. What changes is that a `fatal:` line a developer used to see on
their terminal is now captured.

### Its obligations

Registered under **AC-14(6)** as a preserved-behaviour marker with an authority line naming this
erratum, counted in `q0050.source.test.ts`'s cross-file arithmetic, and **named in the implement
report** so a reviewer meets a citation rather than an undocumented divergence — the Q-0066 /
Q-0068 shape, and the omission that cost Q-0052 three rounds.

### What this erratum does not do

It does not authorise a second exception in the sense charter §2 reserves for `runFlow`'s
`AsyncIterable<Event>`. That clause names **one** unauthorised-by-default change that was
pre-authorised for Q-0050; this is the *ordinary* route §2 provides for any deliberate change, used
as written. Nor does it license anything else in this ticket: every other behaviour is preserved,
and a defect found while reading is reported rather than fixed.
