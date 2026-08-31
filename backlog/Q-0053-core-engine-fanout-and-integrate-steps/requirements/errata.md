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

## E-2 — AC-12 does not govern the base-conflict exit; AC-8 does — 2026-08-31

**Ruled: the implementer's refusal of run 2's review major 1 is correct. The occurrence is left
open on the base-conflict path, deliberately, and that is preserved behaviour.**

Written during the loop, as soon as the contradiction was provable, per *"A reviewer approves the
change it asked for"* (2026-08-29) and *"A refused finding is a gate, not another round"*
(2026-08-31). It gives the next review round an authority to read rather than an argument to have.

### What was measured

`spike/src/engine.js` allocates the integrate occurrence at `runIntegrate`'s first statement. Its
base-conflict path then writes `notes` to every `writesOf(step)` path, appends the
`base-conflict` line to `runs.log`, and **throws** — with no `persistArtifact` and no
`terminalOccurrence`. So the finalised manifest keeps that integrate step at `running` with no
`output.txt` beside it. The port reproduces this exactly.

### Why AC-12 does not reach it

**AC-12 names its own scope in its first line: `engine.js:1155–1179`.** The base-conflict exit is
`engine.js:1099–1120`. They do not overlap.

The confusion is one word used for two exits. AC-12's *"`failed` with `error.category: 'integrate'`
… on conflicts"* means `conflicts.length` — the **source-branch** merge failures collected after the
base sync, in the loop that populates `conflicts`. The **base** conflict is an earlier, different
stop, and AC-8 is the criterion written for it: it enumerates that path's behaviour in order —
notes to every write path, then the `runs.log` line, then the `FlowError` — and stops there.
AC-8 also says why the exit is shaped that way: *"No backward edge, no `handleFail`, no iteration
consumed."*

### What this erratum does not do

It does not rule the underlying behaviour good. An integrate step left at `running` with no
artifact is a real defect and a reader of the manifest is entitled to be surprised by it; it is
registered as a preserved defect with an authority line, and it is reported at the gate. It is
simply not this ticket's to repair, per charter §2 — *"a child that finds a defect … stops and
reports it, it does not fix it in passing"*.

Nor does it touch run 2's review **major 2**, which was correct, uncontested and fixed: the
`writesOf` entry is now coerced once into `writePath` and that one string serves both the
interpolation and the `report` routing.
