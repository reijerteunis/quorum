---
id: Q-0115
title: A git probe that failed is never rendered as an answer
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0115/integration
priority: p2
created: 2026-09-10
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-10T20:31:38.075Z
    cost: 9.362
---
Five collapsing safe() sites in packages/core/src/git/git.ts, including the one that makes quorum board answer 'no branch' for every ticket in the backlog when a single for-each-ref fails. Q-0074's git/ half, split at its requirements gate.

Opened **2026-09-10 at Q-0074's requirements gate** (its GO-3), from §6.1 of that ticket's merged
requirement, transcribed in full rather than referenced. Written as a ticket at the gate because
three obligations found orphaned in the week before that run — Q-0110's, Q-0111's and Q-0112's —
each lived only inside a closed ticket's prose or a source comment.

**Its decision entry already exists**: *"A probe that could not answer is not a negative"*
(2026-09-10), landed at that same gate. This ticket owes no second one.

**It runs FIRST, ahead of Q-0074 itself, and that was the gate's choice.** Q-0074 keeps the
`fanout/` half because *"What a run's event stream carries"* (2026-08-28) cites **Q-0074** by name
against `branchExists`, `branchHead`, `commitAll` and `mergeInto`, and `composite.ts:17` says
*"Q-0074 owns it"* — a landed entry is never edited, so the id stays with the half it names. Which
half runs first is a separate question, and this one won it on two measurements: it holds the only
site in the census that reaches an adopter's screen, and it is nearly mechanical because the
vocabulary and the machinery are already in the file.

**It inherits AC-2's census register and AC-3 rather than landing them**, per §6.1. The census is
**24 call sites, not 23** — it rotted in a day, Q-0112 having added `git.ts:213` on 2026-09-08, the
day after the merge triage counted them. Re-derive it; do not trust any table.

**OQ-4 is answered and this ticket is unblocked.** A narrow filesystem inspection *may* separate an
absent `.git` from an unreadable or malformed one, and *"Membership is a git question, not a
filesystem one"* (2026-08-28) does not govern — see the 2026-09-10 entry, which states the bound:
absent versus present-but-unparseable, and nothing else.

## Transcribed from Q-0074 §6.1

### 6.1 The `git/` half — a git probe that failed is never rendered as an answer

**Five collapsing sites, and the only one in the census that reaches an adopter's screen.**
`containment`'s branch list (`git.ts:345`) yields an empty `Set` on failure, and `stateOf`'s
**first** clause is `if (!branches.has(branch)) return { state: 'indeterminate', reason: 'no
branch' }` — so one failed `for-each-ref` makes `quorum board` answer `no branch` for **every
ticket in the backlog**, a state `docs/GLOSSARY.md` defines as *"git was never asked"*. Its base
probe (`:342`) renders `missing ref` on a failure. `repositoryAt` (`:71`) collapses to a
**boolean**, so `workTreeProbe` answers `'outside'` where the `.git` gitfile is malformed or
unreadable and the board renders nothing — Q-0109's subject, registered by Q-0105's erratum E-1
as a residual rather than an unmet criterion (that ticket's AC-3 binds on *none of them reaches
`pushed`*). `shortSha` (`:275`) collapses while its own JSDoc says it doubles as the engine's
endpoint existence test. `ensureWorktree`'s base probe (`:143`) is registered and not repaired.

**The vocabulary already exists and the machinery is in the same file.** `CONTAINMENT_REASONS`
contains `'git failed'` (pinned at `git.source.test.ts:133`), `pushLag` (`:406–447`)
discriminates at all four of its own sites in exactly the shape this owes, and `errorProperty`
accepting `'status'` (`:27`), `exitStatus` (`:37`), `GIT_FATAL` (`:48`) and `WorkTreeProbe`
(`:50`) are all already module-private. That is why this half is nearly mechanical.

**`repositoryAt`'s JSDoc is part of the repair.** `git.ts:66` claims `--resolve-git-dir` *"can
discriminate between them and absence"*, which is true of the git invocation and false of what
`safe()` does with its failure. A criterion must say so — a comment claiming a discrimination the
code discards is how this survived a cross-vendor review — and the guard proving doc and code
agree must be **shown to have a subject**, which is Q-0111's lesson.

**Its own blocking question, which Q-0074's gate should answer in the same entry if it can.** May
a narrow filesystem inspection of the project root's `.git` distinguish a malformed or unreadable
gitfile from an absent one, or must that distinction come from an injected or structured git
operation alone? It collides with *"Membership is a git question, not a filesystem one"*
(2026-08-28). **Q-0090's E-1 is the precedent for ruling exactly that kind of scope question, and
it ruled the entry did not govern** the case in front of it — that entry argues from what turbo
hashes, which has no analogue in *is this `.git` readable*. Measure before choosing.

**It owes no second decision entry**, inheriting Q-0074's, and it inherits AC-2's register and
AC-3 rather than landing them. **It must not reopen** Q-0109's third case (a project root below a
repository git refuses), and it must not parse translated git prose or reimplement git's upward
discovery walk. Roughly eight to ten criteria.

## Ruled at the requirements gate, 2026-09-10

**GO-2 — this ticket takes AC-2 and AC-3.** The body's *"inherits"* was written before the register
existed; §0.1 measured that **nothing exists in the tree to inherit**, Q-0074 not having run its
chore, and Q-0074's own GO-2 says the register travels with the half that runs. This is that half.
Twelve criteria, inside the ceiling. AC-12 stays here too.

**Decision 088 owes no erratum, and the reason is worth stating because the finding is real.** Its
census enumerates `safe()` call sites and that key is **blind to six hand-written `catch` blocks in
`git.ts`, one of which collapses** — `containment`'s work-tree probe at `:339`, `catch { return
null; }`, which makes `board.ts:204`'s `where?.stateOf(…)` undefined so **every row renders with no
containment token at all**, indistinguishably from a directory that is not a repository. That is a
second board-wide collapse in the same function, more severe than two of the four the entry singles
out, and structurally invisible to the census that produced it.

Nothing 088 *states* is false: it says twenty-four call sites of one primitive, thirteen of which
collapse, and both numbers are exactly right for the predicate it names. What was too narrow is the
predicate, not the ruling — and the ruling is the part an entry is for. So the repair is where a
reader will actually meet it: **AC-2's register is keyed on *a git invocation whose failure is
caught*, never on a call to `safe()`**, and GO-6 puts the blind spot in the closing entry.

**It is the fail-open shape this repository has now shipped six times** (Q-0051, Q-0067, Q-0073,
Q-0107, Q-0108, and here) — a guard keyed on a name rather than on the behaviour it is about. The
next author will reach for the primitive's name too, which is why GO-6 names the site rather than
the class.

**Already fixed on the sibling fact of the same board invocation.** `pushLag`'s round-1 review caught
exactly this and `git.test.ts:794–797` records it in the code's own words: *"a probe that could not
answer used to be returned as `null` and rendered as silence, which for a fact whose success output
is silence is a clean bill of health nobody earned."* `containment` still answers `null` for both.
