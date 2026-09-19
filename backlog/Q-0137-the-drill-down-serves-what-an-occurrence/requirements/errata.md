# Errata — Q-0137

This file wins over `requirements/merged.md` **for the clauses it names and for nothing else**.
Written at the requirements gate on 2026-09-19, before the chore run, so the implement step meets a
decision rather than a question. Every entry is a **ratification or a widening**: none reverses a
criterion and none narrows scope.

**The implementer is NOT blocked on OQ-1.** E-1 answers it. Do not stop the run on it, do not ask
for a decision entry, and do not read `ticket.md`'s OQ-1 as live — E-1 supersedes it.

---

## E-1 — OQ-1 is ratified: a route may serve a file under `.quorum/`, and no decision entry is owed

**Supersedes:** `ticket.md`'s *"## Open first"* section, which marks **OQ-1 BLOCKING**, and ratifies
`merged.md` §8 in full.

**Replacement: the answer is yes.** Both routes may read a retained file under `.quorum/runs`. The
ruling lives in the listing function's own authority comment — one line naming the condition, per
`.claude/rules/engineering.md`, never a transcription of this reasoning — plus the sentence AC-14
puts in `docs/04-architecture.md`. **No `docs/decisions/` entry is written.**

**Named by name because the channel requires it.** The implement step reads this file and **not**
`ticket.md` (Q-0125 E-1). Without this entry the implementer meets a live BLOCKING question in the
body, and `blocked` is the verdict it would correctly return on round one — which is Q-0125's E-1
exactly and Q-0062's three wasted rounds before it.

**Why, re-verified at this gate rather than relayed.** §8's reasoning was checked against the tree
and holds at every step:

- **The gitignore fact does not discriminate, and checking it is what shows that.** Q-0127's E-1
  excluded `.harness/` on the reasoning that it is gitignored and git tracks none of it. `.quorum/`
  is `.gitignore` **line 2** and `.harness/` **line 3** — literally adjacent — and `git ls-files`
  returns **zero** under each. If that were the discriminator, `GET /history` and `GET /history/:id`
  would both be violations, and they have shipped since Q-0119, been widened by Q-0018 and are read
  by two screens.
- **What discriminates is that `.quorum/` is named as the database.**
  `.claude/rules/engineering.md:7` and `harness/rules.md:59` both say *"Anything persistent is a file
  in `backlog/`, `harness/`, or `.quorum/`"*.
- **Q-0127 forwarded this subject here by name.** `packages/shared/src/wire.ts:737` says a ticket's
  listing names no dot-path because *"naming the paths would make a backlog route a second
  run-history surface, **which is Q-0018's**"*. E-1 ruled run state unservable **from the backlog
  route**; its closing clause is about `.harness/`, a different tree, and does not reach here.
- **So the authority half was answered by shipped code and a landed rule, and what was open is
  payload** — settled by §4.2's design, which never serves more than one file: **355,744 B** at this
  store's worst, against the 1.46 MB single file `GET /tickets/:id/file` has served uncapped since
  Q-0127.

§8's six-site *does any landed sentence go false?* check was re-run and none does.

**What this erratum does not settle:** whether any other surface may serve `.harness/`. Q-0127 E-1's
own closing clause still stands, and a later ticket that wants to is owed its own entry.

---

## E-2 — AC-14 is widened by four sites, and the addition is not eligible for trimming either

**Supersedes:** AC-14's site list, which names `docs/04-architecture.md`'s route enumeration and
three property sentences, `apps/web/test/routes.test.ts`'s `EXCEPTION_REASONS`, `docs/GLOSSARY.md`'s
**Confinement** entry, and the `CLAUDE.md` / `docs/README.md` term lists.

**Replacement: AC-14 additionally moves the four sentences below**, each of which is **made false**
by this change rather than merely incomplete. AC-14's own *not eligible for trimming* status extends
to them, on its own stated reason — a document correction deferred to a successor is one that
expires (Q-0110, Q-0111 and Q-0112 each lived inside a closed ticket's prose, Q-0100's inside a
source comment).

1. **`docs/05-design-prompt.md:63`** — Q-0018's screen-8 divergence paragraph ends *"What an
   occurrence RETAINED — the prompt it was sent and the output it returned — is **Q-0137**'s, and
   **nothing on this screen opens a file**."* The final clause is false the day this ships.
2. **`docs/05-design-prompt.md:5`** — the status line's *"What an occurrence retained is
   **Q-0137**'s"*, which the same edit must carry, with the status line's date and subject bumped as
   that document's own convention requires.
3. **`docs/04-architecture.md:15`** — *"What an occurrence RETAINED is **Q-0137**'s"*.
4. **`docs/04-architecture.md:464`** — *"What an occurrence RETAINED — its `prompt.txt` and its
   `output.txt` — is **Q-0137**'s"*.

**Why this was missed and why it is a widening rather than a finding against the document.** AC-14
names `docs/04-architecture.md` and so reaches 3 and 4 by the document but not by the clause;
`docs/05-design-prompt.md` is named nowhere in the requirement at all, and it is the brief **every**
screen ticket is built from. Q-0017 closed the last *"override with reason"* occurrence in that same
file after Q-0013 and Q-0118 had both recorded the obligation as *fully discharged* — having
corrected two documents and never looked at the third. This is that shape, caught before the run
rather than after it.

**`apps/web/src/routes.ts:257` and `history-screen.tsx`'s docblock are already AC-10's** and are not
restated here. `apps/web/src/history-screen.test.ts:305`'s comment — *"Nothing here opens a file,
which is Q-0137's subject"* — travels with the test it annotates and needs no criterion.

*Test:* AC-14's existing clause is extended — each of the four sentences is asserted **absent in its
false form** from the shipped document, by a guard that names the file, so restoring any one of them
turns it red. A grep for `Q-0137` across `docs/` and `apps/web/src/` leaves nothing claiming this
ticket is unbuilt.

---

## E-3 — GO-3 is discharged at this gate, and the contract note is already written

**Supersedes:** nothing. GO-3 asked whether a contract note is owed; this records that one was owed,
what it says, and that it is on disk before the run.

`contracts/Q-0011/run-history-writer.contract.md` carries *"Script and integrate occurrences have no
`prompt.txt` and **always receive `output.txt`**"*. That clause **binds as written and nothing in it
changes** — it is a statement about the writer, which this ticket does not touch. What it needed is a
**read-side** note, because Q-0137 is the first ticket ever to read these files back, and the clause
read carelessly says AC-8's third sentence is unreachable.

It is not. `terminal()`'s guarantee sits behind an `fs.existsSync` that **answers true for a
directory**, pinned as preserved behaviour by `writer.test.ts`'s *"and an `output.txt` that is a
directory is left alone, silently"*. So a **terminal** occurrence with no readable output is
reachable, and is a different state from a **running** one that has not answered yet.

**The note is appended to that contract and the implementer must not weaken AC-8 on the strength of
the clause above it.** The defect itself is not fixed (§6 non-goal 10). No decision entry is owed.

---

## E-4 — the store's figures moved again during this run, and no criterion may assert one

**Supersedes:** nothing. Recorded so a later reader does not treat `merged.md` §0.1's figures as a
target.

Measured across five passes during this ticket's own life: **1,791 → 1,794 → 1,796 → 1,797** files.
The last of those moved **while this erratum was being written** — the file count was 1,796 in the
paragraph as first drafted and 1,797 when it was verified minutes later, the new file being this
run's own `head-of-product` output. At this gate: **1,797 files across 173 runs and 941
occurrences**, `kind` counts **adapter 856, integrate 85, script 0**, and the U+FFFD count moved
**14 → 16** the same way.

**That is `merged.md` R-2 demonstrating itself inside the document written to record it**, which is
worth more than the figure: a reader of this store cannot assume it is still what it was one
paragraph ago, and this is the first surface in the product where that is ordinary rather than
staged.

**The three figures the payload decision rests on have now held across six passes**: largest
occurrence **355,744 B**, largest run **3,514,617 B**, largest single file **353,626 B**. §4.2 is
argued from those, and they are stable.

This is `merged.md` R-2 demonstrating itself rather than a correction to it. **AC-8's instruction
that the count of such occurrences is asserted nowhere binds, and extends to every figure in §0** —
a criterion may assert a *rule* and never a *count* drawn from `.quorum/runs`.
