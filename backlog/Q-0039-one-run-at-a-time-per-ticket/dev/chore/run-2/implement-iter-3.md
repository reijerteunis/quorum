# Q-0039 — implement report (run 2, iteration 3)

*A revision round on one major from `review/chore/run-2/chore-iter-2.md`. Fixed. No production code
changed. Verdict: `proceed`.*

---

## 1. The finding, and why it was right

> **major: docs/GLOSSARY.md:119** The glossary says release occurs "only while" the file carries this
> run's token and therefore a successor's lock is left alone, but E-1 explicitly acknowledges that a
> successor claiming between the token check and `unlinkSync` can still have its lock deleted.

Correct, and it is the one place the narrowing had not reached. Round 2 bounded the guarantee in
`RunLock.release`'s JSDoc and E-1 bounded it in the criterion; the canonical vocabulary went on
stating the unqualified form. That is the failure this repository records most often — a document
promising what the code beneath it does not deliver — and here it was the document a reader is sent
to for the definition.

**28 insertions across 2 files, one of them a test.** Nothing under `packages/core` or
`packages/cli` moved.

---

## 2. File by file

### `docs/GLOSSARY.md` (+8 / −3) — the bound, stated where the term is defined

The **Run lock** entry's release sentence was:

> given back in a `finally` covering every exit, and only while the file still carries the token the
> run wrote, so a lock a human cleared and a successor took **is left alone**.

It now reads *is left where it is*, and the bound follows immediately, in the shape the JSDoc
already uses — the broad statement, then what two syscalls can actually deliver:

> **That check and the removal are two syscalls, and the guarantee is bounded by that**: a
> replacement already on disk when release begins survives, and one written between the check and
> the removal does not — no compare-and-delete for a file at a fixed path can be uninterleaved, so
> the remainder is a stated bound rather than a race this wording covers over, and closing it means
> a different representation, which is Q-0114's (Q-0039 erratum E-1).

Three things about the wording, each deliberate:

1. **It says which replacement survives and which does not**, which is what the finding asked for in
   as many words, rather than a general disclaimer that a reader cannot act on.
2. **It names where the residual is owned.** E-1 ruled the representation trade to Q-0114 rather
   than opening a fourth ticket; a vocabulary entry that states a bound and not who owns closing it
   is how a bound becomes folklore.
3. **Every phrase AC-13's shipped assertions pin is untouched** — the file, the subject, the single
   exclusive create, the `finally` covering every exit, the refusal, the never-reclaimed clause, the
   `--dry` clause, the four "what it is not" clauses and the decision citation. This amends a
   sentence; it does not rewrite the entry.

**Two lines are re-wrapped and carry no change of meaning**, because inserting the bound left a
short line mid-paragraph. `git diff --word-diff=plain docs/GLOSSARY.md` shows the substantive change
is exactly the added sentence plus *alone* → *where it is*; that is the cheapest way to read this
diff.

**No term was added**, so M-11's ruling — the glossary only, not the two vocabulary lists — is
untouched and no branch-sequencing question arises. The glossary has no status line, and
`04-architecture.md`, whose status line already records Q-0039 and 2026-09-09, is not edited this
round.

### `packages/shared/src/docs.test.ts` (+20) — one guard, in the describe that already owns AC-13

A third test in the existing `Q-0039 AC-13` block, asserting the two halves of the bound separately
and then refusing the wording it replaces, which is the `withoutIt` idiom the block's second test
already uses. It reads `docs/GLOSSARY.md` through the `flowed` helper that is already there, so no
register moved and no new read base was earned.

**Why a test for a sentence, stated so it can be attacked.** The unqualified claim survived an
implement round, a review round and a merge-ready branch because nothing could see it. AC-13's
existing assertions pin the clauses of this entry one at a time for that reason, and the clause this
round adds is the one a future edit is most likely to "simplify" back into a clean-sounding
guarantee. It is four assertions inside a describe that already exists, not a new file.

---

## 3. Shown red before green

Two mutations, each reverted, each with its own signature — Q-0071's point that showing a guard
fires is not showing that each of its clauses does.

| mutation | what went red |
| --- | --- |
| the superseded sentence restored verbatim (*"is left alone."*, bound removed) | the new test alone: *"it does not say the check and the removal are two operations"* |
| only the which-replacement half deleted, *"two syscalls"* kept | the new test alone: *"it does not say which replacement survives and which is not protected"* |

**The first row is the finding reproduced.** It is the exact text this round replaced, and the
sibling test — *"the glossary defines the term, its subject, its lifetime and its decision"* —
**stays green** under it, which is what says the new clauses are what catch the false claim rather
than a neighbour catching it for them. That is Q-0107's distinction: a guard shown red by its
neighbour has not been established.

The in-test `superseded` constant asserts the same thing statically: the old sentence still satisfies
the lifetime clause of the test above and neither clause of this one.

---

## 4. What I checked and deliberately did not change

**Decision entry 086 does not carry the claim, so nothing is owed and nothing is contradicted.** Its
Decision says a run *"gives it back in a `finally` that covers every exit"* and nowhere states the
ownership guarantee. Read in full before writing a line, because if it had carried it I could not
have fixed it — a landed entry is never edited — and this would have been a blocker rather than a
round. It is not.

**`docs/04-architecture.md` carries it in neither of its two sites, and both were read.** Principle 6
says *"gives it back in a `finally` that covers every exit; a second run refuses and names the holder
rather than waiting"*; §Run history on disk says *"removed by the `finally` that covers every way out
of that run"*. Neither mentions the token comparison, so neither over-promises and neither is
touched. A grep for *"left alone"* across `docs/` and `packages/` returns the glossary line and
nothing else in this ticket's subject.

**`RunLock.release`'s JSDoc is unchanged.** Round 2 wrote the bound there and the reviewer did not
dispute it; the glossary now says the same thing in the same order, and duplicating more of it would
be transcription.

**No behaviour changed, and no criterion moved.** AC-5 stands as E-1 narrowed it, the code under it
is byte-identical to what round 2 shipped, and AC-13's normative half — the glossary defines the term
and the four things it is not — was met before this round and is met after it.

**Reported again, not repaired**, both unchanged from the last two rounds:

- `packages/core/src/backlog/backlog.ts:330` — *"Unused eslint-disable directive (no problems were
  reported from 'no-control-regex')"*. Not in my diff, `pnpm lint` exits 0 with 0 errors.
- `initialiseRunHistory`'s own exclusive create has the same create-then-write shape as the claim and
  the same class of leftover. No finding names it, it predates this ticket, and widening into it is
  the scope creep the role forbids.

**AC-12's two guards.** `run-history.source.test.ts:259` and `:320` are absent from this diff
entirely; nothing this round added an export, a type or a `.quorum` literal.

---

## 5. Verification

- `pnpm turbo run lint typecheck test --force --continue` — **21/21 tasks, 0 cached.** core 1444
  passed (2 skipped, pre-existing), cli 621, shared **167** (166 before this round's one test), and
  the five scaffolds.
- `pnpm sweep:git-identity` — **green**, the workspace suite executed with no resolvable git
  identity, run from this linked worktree.
- The two mutations in §3, each reverted.
- `git status --porcelain` is the two files above and nothing else.

**Not done, stated rather than implied.** No build was run: this round changes one paragraph of a
document and one test file, neither of which reaches the emit, and `typecheck` covers the test. The
built-binary evidence for this ticket is round 1's, unchanged. GO-3's both-row verification and
GO-4's CI check remain the human's at the merge, as the requirement says.

---

## 6. For the gate

- **The blocker from iteration 2 is closed by E-1**, which the human ruled at that gate: AC-5's
  guarantee is what two syscalls deliver, the representation trade is Q-0114's, and this round
  carried that ruling into the one document that had not heard it.
- **No decision entry is owed by this round.** The glossary now agrees with decision 086 rather than
  extending it: 086 never claimed the ownership guarantee, so narrowing the vocabulary contradicts
  nothing and adds no policy.
- **The branch is complete and green as it stands.**
