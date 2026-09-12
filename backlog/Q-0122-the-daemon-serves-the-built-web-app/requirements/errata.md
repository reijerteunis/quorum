# Q-0122 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at or after its gate and binding on the implementer
and the reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — OQ-1 is refused: one ticket, and Appendix A's nine are promoted — 2026-09-12

**Supersedes** OQ-1's recommendation of two tickets, §4's header *"Eleven, under the recommended
split"*, GO-3's first half, and Appendix A's own framing as a *successor*. `merged.md` is otherwise
unamended.

**The amendment.** Q-0122 is **one ticket of twenty criteria**: §4's eleven, and Appendix A's nine
promoted to **AC-12 to AC-20** in the order that appendix numbers them. Appendix A stops being a
successor's body and becomes the normative text of those nine; its *Measured* paragraph, its
*Non-goals* and its *Open questions for its gate* bind here, the last of them answered below.
**Appendix B is unaffected and is still a successor** (GO-3's second half), opened at this gate.

**Why, stated plainly rather than as a preference.** The recommendation was sound and the seam was
measured; what decided against it is that the two halves have **one subject** — the daemon serving
the app — and splitting them ships an artifact nothing serves and leaves `04-architecture.md:190`,
`:233` and `apps/web/vite.config.ts`'s header all still pointing at an unfinished ticket. Against
that: twenty is past the fifteen this role uses and past the eighteen Q-0013 was refused at, and
**the ticket is accepted as oversized deliberately**, which is a different thing from nobody
noticing. The cost is named rather than hidden — see E-1's *Accepted risk* below — and the
mitigations are the two already in the document: every criterion is independently testable, and GO-5
requires mutation rather than a bare approve.

**Accepted risk.** Q-0013 at eighteen, Q-0091 and Q-0096 at twenty-one were each refused or split *at
a gate and at cost*, so the precedent says a ticket this size either splits or spends the difference
in review rounds. If the review loop exhausts on the serve half specifically, **the remedy is a
second erratum splitting it at that gate, not a fourth implement round** — Q-0091 and Q-0101 priced
rounds spent on unrulable blockers at $14.28 and $31.16, and the seam is already measured and written
out, so the split stays available at the cost of one allocation for as long as this ticket runs.

**Appendix A's confinement criterion carries the extra weight, and it is why the size is tolerable at
all.** Criterion (6) — no path outside the bundle root is served, traversal in every encoding, dot
segments, repeated separators, and a symlink resolved with `realpathSync` and compared component by
component, with a **dangling** symlink named in advance as Q-0059's round-2 blocker — is the first
surface in this product that turns a URL into a file read, from a process with no authentication of
any kind. That criterion is not eligible for the trimming a reviewer might otherwise propose to
bring the count down: **if anything is deferred under pressure, it is not this one.**

**One of Appendix A's open questions is answered here rather than left for a second gate.** *Is a
decision entry owed for the static route?* **No.** Hono is `04-architecture.md`'s own choice
(2026-08-22), *"serves the built `apps/web`"* is that document's own sentence, and 092 —
*"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12) — already
rules the vocabulary half. Adding a route a landed document names is a document edit, which is
Q-0121's GO-1 precedent at a second site. **`packages/server` gaining its first `node:fs` read is
recorded and owes no entry either**: it is a read confined to a declared root under **Confinement**,
which is `docs/GLOSSARY.md`'s existing term and needs no new one.

**Two of Appendix A's open questions stay open and are solutioning's**, not a gate's: OQ-6's cache
policy — where a long-lived cache on `index.html` would be 078's replayed-artifact hazard arriving a
third time, in the browser — and whether answering `index.html` for an unrecognised navigation is a
silent default. The document's own answer to the second is offered and not imposed: it is not,
because the shell's Not found view names the path and rule (3) keeps a non-navigation refusal
explicit.

## E-2 — AC-7's precondition is satisfied; the entry is 092 — 2026-09-12

**Supersedes** nothing; it discharges GO-1 and records what AC-7 must now cite.

The entry is *"A fourth package emits, and what it emits is served rather than shipped"*
(2026-09-12), `docs/decisions/092-a-fourth-package-emits-and-what-it-emits-is-served.md`, landed at
this gate **before** the implement step. It rules all six clauses §3 drafted, and takes §3(2)'s
recommendation: **the term widens and no third kind is coined.** So AC-7 is satisfiable, and what it
requires is that `docs/GLOSSARY.md`'s **Emitted artifact** cite that entry **by title and date** —
never by file name or number, per `.claude/rules/docs-and-decisions.md`.

**Two clauses of the glossary move, and the entry names both**: *"the JavaScript and declaration
files"* no longer describes what a build task writes, and *"which is also the **local distribution
set**"* is now false in one direction — four packages emit and three are distributed. The two shapes
the entry names, **resolved** and **served**, are the vocabulary the amended term carries.

**GO-2 is discharged as not owed.** No term is coined, so neither 22-term list moves — measured at
the gate: `CLAUDE.md:13` and `docs/README.md` carry the same 22 of the glossary's 36, and
**Confinement**, **Run lock** and **Connection state** are in neither, so the lists are a curated
subset rather than a mirror. Widening an existing entry is not adding one.
