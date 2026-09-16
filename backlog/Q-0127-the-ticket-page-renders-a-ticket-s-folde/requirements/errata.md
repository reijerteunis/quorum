# Errata — Q-0127

This file wins over `requirements/merged.md` **for the clauses it names and for nothing else**.
Written at the requirements gate on 2026-09-16, before the chore run, so the implement step meets a
decision rather than a question. Every entry below is a **ratification**: none changes a criterion's
substance, and none widens scope.

**The implementer is NOT blocked on GO-1, GO-2 or GO-3.** All three are answered here. Do not stop
the run on any of them, and do not ask for a decision entry — E-1 rules that none is owed.

---

## E-1 — GO-1 is ratified: `.harness/` is excluded, and no decision entry is owed

**Supersedes:** §6 GO-1 (`merged.md:442`), which carries the question to the gate.

**Replacement:** the listing function **excludes `.harness/`**, and **no `docs/decisions/` entry is
written for it**. The ruling lives in the listing function's own JSDoc — one line naming the
condition, per `.claude/rules/engineering.md`, never a transcription of this reasoning — plus one
sentence in `docs/04-architecture.md`.

**Why the requirement was right to carry it and why it is closed here.** `.harness/` is gitignored
(`.gitignore:3`) and git tracks **none** of the 267 files across the 69 folders that hold it, so it
is not in the database; excluding it is *"files are the database"* (`.claude/rules/engineering.md`)
applied rather than contradicted. Nothing here reverses a landed entry and no glossary term moves.
**The answer that would have owed an entry is the opposite one** — serving engine run state from a
backlog route makes `.harness/` part of what the backlog surface *means*, which is a product
statement. That answer is not taken.

**What this erratum does not settle:** whether any *other* surface may serve `.harness/`. Nothing
here reaches that, and a later ticket that wants to is owed its own entry.

---

## E-2 — GO-2 is ratified: no term is coined, and `manifest` is refused

**Supersedes:** §6 GO-2 (`merged.md:454`).

**Replacement:** **coin nothing, and edit no glossary.** The detail response carries a `files` array
of `{rel, bytes}` and is named for what it carries. **The word `manifest` may not be used for it**,
in code, in a type name, in a JSDoc or in a test name.

**Why.** `docs/GLOSSARY.md` already uses *manifest* for a run's manifest under **Run history**, and
**Occurrence** is defined as *"one entry in a run manifest's record"*. Reusing it for a ticket-folder
listing introduces a homograph for a live term, which `.claude/rules/docs-and-decisions.md` forbids
in as many words — *"Do not introduce synonyms for existing terms"*, and a homograph is worse than a
synonym because both readings survive. Ratified explicitly so an implementer does not reach for the
obvious word and have a reviewer take it out three rounds later.

**What this erratum does not settle:** nothing about the run manifest itself.

---

## E-3 — GO-3 is ratified: the binary instrument is a whole-file fatal decode

**Supersedes:** §6 GO-3 (`merged.md:463`).

**Replacement:** the binary check is a **whole-file fatal decode** of the bytes that were read —
Node's `TextDecoder('utf-8', { fatal: true })` — and **not** a byte-length round-trip against a
`stat` size. AC-2's second `core` function is therefore **required**, not convenient.

**Why, and it is a mechanical reason rather than a measured failure.** Over all 1,269 files under
`backlog/` the two instruments agree exactly — both flag `backlog/.DS_Store` and nothing else — so
the proxy has no observed miss and is not being refused for being wrong. What separates them is that
the proxy needs a byte count from *the same read*, and `readFiles` returns text only, so the count
would come from a second `stat`: **the verdict would be a function of two moments**, which is how a
file that merely changed between them gets reported as binary. A fatal decode answers from one
moment and carries no residual. Same discipline as *"A test's verdict is a property of the commit,
not of the checkout or the account"* (2026-08-30), applied to a response rather than to a test.

**Two traps named so they are not rediscovered.** A test of the form *"does the decoded text contain
U+FFFD"* is **refused**: three files under `backlog/` legitimately contain that character
(`Q-0006/qa/scenario-review.md`, `Q-0101/requirements/merged.md`,
`Q-0101/requirements/run-1/merged-iter-1.md`), so it would report three hand-written markdown files
as binary on the day it shipped. And a UTF-8 verdict must be taken **with the decoder that will serve
the bytes**: `iconv -f UTF-8 -t UTF-8` rejects at least one `.harness/` JSON that `TextDecoder`
accepts and that round-trips byte-for-byte, so a shell tool is not an oracle for this.

**What this erratum does not settle:** what the route does *with* a file it judges binary beyond
AC-6's stated behaviour.

---

## E-4 — the ticket body's "absent versus empty" premise is void

**Supersedes:** the ticket body's clause that *"`readFiles` answers `[]` for a legitimately absent
directory, so absent and empty are already distinguishable and must stay so."*

**Replacement:** they are **not** distinguishable — `walk()` returns `[]` for an absent directory and
`[]` for an existing empty one — and the distinction is **not needed**, because there are **zero**
empty directories under `backlog/` and git cannot track one. §0.3's ruling stands: the response
carries `files` and **no** `directories` array, and an existing empty directory produces no tab.

**Why this is an erratum rather than a §0.3 the implementer can simply read.** The false premise is
in the **ticket body**, which the implement step does not read — but a reviewer may, and a finding
built on it would be unanswerable by the implementer. Recorded so the contradiction is closed from
both sides. The operator wrote that clause; it was wrong in both halves.

**What this erratum does not settle:** nothing about Q-0060, which owns a damaged `ticket.md`.
