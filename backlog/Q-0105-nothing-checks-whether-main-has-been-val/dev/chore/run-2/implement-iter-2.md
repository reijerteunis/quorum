# Q-0105 — implement report, run 2, iteration 2

*A revision round. Written against the tree at `6f1f3d2` plus this worktree's changes. Both majors
from `review/chore/run-2/chore-iter-1.md` are addressed in the code, and both are addressed at the
board as well as in `core`, because the review asked for the surface and it was right to.*

**Neither finding needed a new state or a new reason.** `missing ref` and `git failed` already
existed and were already rendered; what was wrong was which failures reached them. That is the
strongest thing to say about the round: the closed set AC-2 declared was complete, and the defect was
entirely in the selection.

---

## 1. Finding 1 — a probe that could not answer was returned as silence

> *`packages/core/src/git/git.ts:315` An initial `rev-parse` failure is returned as `null`, so
> `quorum board` silently suppresses a git failure even when it occurs inside a valid work tree.
> AC-3 requires failed probes to produce `indeterminate (git failed)` and reserves `null` for a
> confirmed non-work-tree.*

**Accepted in full.** The round-1 code opened with one combined
`rev-parse --is-inside-work-tree --is-shallow-repository` and a bare `catch { return null }`, so two
questions shared one failure mode and the answer to both was silence. For this fact silence is the
*success* output — §3's own asymmetry — so a suppressed failure is indistinguishable from a clean
answer, which is the shape of the incident the ticket was opened for arriving inside its own fix.
Its own test enshrined it: `FAILING_STEPS` carried `['rev-parse', null]` with a comment calling it
*"the one case that is deliberately not a reason."*

### What shipped

The remedy is the one the review prescribed — **separate work-tree detection from shallow-state
probing, and classify probe failures honestly**:

```
rev-parse --is-inside-work-tree   → insideWorkTree(): true | false | null
rev-parse --is-shallow-repository → shallowState(), the module's own probe, reused
```

`insideWorkTree` returns `false` where git **answered** that there is no work tree, and `null` where
the probe could not answer at all. The discriminator is git's exit code and nothing else, which is
`ancestry`'s rule one function along in the same file. `pushLag` then reads:

| `insideWorkTree` | result | why |
| --- | --- | --- |
| `true` | carry on | |
| `false` | `null` → the board renders as it always did | git said there is no repository here |
| `null` | `indeterminate (git failed)` → the board prints a cannot-say line | the instrument could not answer, and must say so |

Every step after the work-tree probe is now a reported failure, the shallow probe included: an
unanswered `shallowState` is `git failed` rather than being quietly taken for *not shallow*.

### The measurement the classification rests on

Probed on this machine, git 2.55.0, through a throwaway Vitest fixture (deleted; Node could not be
invoked directly in this environment):

| invocation | exit | output |
| --- | --- | --- |
| `rev-parse --is-inside-work-tree` outside any repository | **128** | `fatal: not a git repository (or any of the parent directories): .git` |
| `rev-parse --verify --quiet <missing ref>` | **1** | empty |
| `rev-parse --verify --quiet <present ref>` | 0 | the sha |

So 128 is git's own *"there is no repository here"*, and 1 is its own *"no such ref"* — both
documented behaviours of the flags being used, both locale-proof because they are numbers.
**git's stderr is not read**, deliberately: it is translated, and a locale must not decide a state.

### The residual limit, stated rather than hidden

git spends 128 on **every** fatal, so a repository it refuses to *open* — dubious ownership, an
unsupported `core.repositoryformatversion` — is read here as "no repository" and stays silent.
Telling those apart needs git's prose, which is the one thing that may not decide a state. It is
written into `insideWorkTree`'s JSDoc rather than left to be discovered, and it is the **same answer
`containment` gives the same directory**, so the board is consistent about it: no tokens, no legend.

### One consequence for the reviewer to judge rather than for me to decide

**A machine with no git on `PATH` now gets a cannot-say line where round 1 printed nothing.**
`execFileSync` throws with no status there, so `insideWorkTree` is `null` and the state is
`git failed`. I believe that is right — silence is this fact's success output, and *"a check that
skips its subject must not report success"* (2026-08-25) is exactly the rule §3's table encodes —
and `quorum board` still exits 0 (AC-11, tested). But it is a rendered-output change on a path no
criterion names, so it is reported here rather than absorbed. It does not touch AC-10: a
freshly-initialised project in a plain directory is git *answering*, and stays byte-identical
(asserted, and shown red under mutation E below).

---

## 2. Finding 2 — an upstream that is named and gone was reported as a broken git

> *`packages/core/src/git/git.ts:337` A configured upstream whose tracking ref no longer resolves
> makes `rev-list` fail and is reported as `git failed`. Section 3 and AC-3 require an unresolvable
> base or upstream to produce `indeterminate (missing ref)`.*

**Accepted in full, and measured before it was believed.** With `refs/remotes/backup/trunk` deleted
while `branch.trunk.remote` and `.merge` stay:

| invocation | result |
| --- | --- |
| `for-each-ref --format=%(upstream) %(upstream:short)` | `refs/remotes/backup/trunk backup/trunk` — **still named** |
| `for-each-ref --format=%(upstream:track)` | `[gone]` |
| `rev-parse --verify --quiet refs/remotes/backup/trunk^{commit}` | exit **1** |
| `rev-list --count refs/remotes/backup/trunk..refs/heads/trunk` | exit **128**, `fatal: ambiguous argument … unknown revision` |

`%(upstream)` is computed from configuration, so the state is *named and unresolvable* rather than
`no upstream` — which is why the round-1 code walked straight past its own `no upstream` branch into
a fatal count. The upstream ref is now verified before the count, and an unresolvable one is
`missing ref`.

The same shape was applied to the **base** ref, which had it in weaker form: it used
`safe(...) == null`, so a *broken git* on that probe was also reported as an absent ref — finding 2's
defect one line up, and uncovered. Both now go through `resolvesToCommit`, which is `false` only on
git's own exit 1 and `null` on anything else.

**Ordering:** the ref checks come before the shallow check, because a ref that does not exist cannot
be counted at all while a shallow clone only makes a count untrustworthy. The more specific answer
wins, which is the order the rest of the function already used.

---

## 3. What changed, file by file

**`packages/core/src/git/git.ts`** — two module-private helpers (`insideWorkTree`,
`resolvesToCommit`) and the `GIT_FATAL` constant, each with the JSDoc its non-obvious rule needs;
`pushLag`'s probe sequence as above. **No export moved**, so `git.source.test.ts`'s eleven-name pin
and the barrel's two-name pin are untouched — AC-12's registers 1 to 3 do not move in this round.
`containment`'s spawn-budget sentence (AC-12 register 4) moves again: **`pushLag` is at most 7
spawns, so the board's whole budget is 2n + 10**, where round 1 measured 5 and 2n + 8.

**`packages/shared/src/push-lag.ts`** — two reasons' documentation, which described causes that have
moved. `missing ref` now says *either* ref, and says why containment's reason of the same name is
narrower. `git failed` now says *from the work-tree probe onward*, and names the one failure of that
probe which is an answer rather than a failure. **No state, no reason and no type changed** — the
vocabulary needed nothing, which is worth recording as evidence for AC-2's shape.

**`packages/core/src/git/git.test.ts`** — `FAILING_STEPS`' `rev-parse` row inverted to `git failed`,
with the comment saying it is round 1's finding rather than a preference; a new `FAILING_PROBES`
table breaking each of the three individual `rev-parse` probes by **whole argv** (`case "$*"`), which
is what gives the steps behind the outermost probe a subject at all; a fixture with a deleted
tracking ref asserting `missing ref`; and the spawn budget pinned at **exactly 7** rather than
bounded, so a probe added or removed moves the number the JSDoc states instead of hiding under a
ceiling. The gone-ref fixture asserts its own topology first — that `%(upstream)` still names the
ref — because if the configuration had gone with the ref the fixture would be `no upstream` and would
prove nothing.

**`packages/cli/src/board.test.ts`** — the two board-level regression tests the review asked for, and
`breakHistoryBetween`, a fixture that removes one intermediate commit's loose object so that **both
endpoints still resolve and only the walk between them fails**. It asserts that both endpoints
resolve, so the test cannot silently drift into asserting the neighbouring state. No shim: the claim
is what the *board* does with a failed probe, and a shimmed `git` would be proving it about a process
the test invented.

**`docs/GLOSSARY.md`** — the `missing ref` and `git failed` glosses in the **Push lag** entry, for the
same reason as `push-lag.ts`: they named causes that have moved. Nothing else in the entry changes,
no numbered document changes, and no status line moves, because no numbered document describes the
reason set.

---

## 4. Every changed and new assertion, demonstrated red by mutation

AC-14 requires it and this round is the argument for it: the defect being fixed *was* a test asserting
the wrong answer with a comment explaining why it was right. Each mutation was applied, run, and
reverted; messages are quoted verbatim.

| # | mutation | red | message |
| --- | --- | --- | --- |
| **A** | a failed work-tree probe falls back to `false` — **round 1's shipped behaviour** | core: `breaking git rev-parse is answered honestly` | *breaking git rev-parse did not produce the honest answer: expected null to strictly equal { state: 'indeterminate', …(1) }* |
| **B** | an unanswered shallow probe is taken for *not shallow* and the run carries on | core: `a probe that fails … (the shallow probe)` | *breaking `git rev-parse --is-shallow-repository` did not produce the honest answer: expected { state: 'unpushed', ahead: 2, …(1) } to strictly equal { state: 'indeterminate', …(1) }* |
| **C** | the upstream ref is not probed at all — **round 1's shipped behaviour** | core ×3 + cli ×1 | *expected { state: 'unpushed', … } to strictly equal { state: 'indeterminate', … }*; *expected 6 to be 7*; and at the board *expected '· push lag = the board cannot say whe…' to match /cannot say whether main has been push…/* |
| **D** | a failed `rev-list` falls through to `pushed` | cli: the new `git failed` board test | *a git command failed and the board said nothing at all: expected null not to be null* |
| **E** | **the inverse**: every work-tree probe failure is `git failed`, including git's own fatal | core: `outside a work tree …` + cli: `AC-11 — every outcome still exits 0` | *expected { state: 'indeterminate', …(1) } to be null*; *a directory that is not a work tree has no fact to report: expected '· push lag = the board cannot say whe…' to be null* |
| **F** | the base ref check reverted to `safe(...) == null` | core: `a probe that fails … (the base ref check)` | *breaking `git rev-parse --verify --quiet refs/heads/trunk^{commit}` did not produce the honest answer* |

**Mutation E is the one worth reading twice.** A and E are opposite errors, and both are red — which
is what proves the exit-code classification is load-bearing at both ends rather than a `null` branch
that is now unreachable. Without E the fix could have been "report everything", which would print a
cannot-say line in every non-git directory and break AC-10's cold-clone claim.

**Mutation C is the round's own guard against a fix that is not a fix**: it turns the spawn-count pin
red at 6, so the JSDoc sentence and the code cannot drift apart in either direction.

---

## 5. Verification

- **`pnpm turbo run build test lint typecheck --force --continue` → 24/24 tasks, 0 cached.**
  `@quorum/core` **1309 passed / 2 skipped** (1305 before this round), `@quorum/cli` **578** (576),
  `@quorum/shared` 147, the four scaffolds 1 each. Lint **0 errors**; the one warning is the
  pre-existing `packages/core/src/backlog/backlog.ts:276` unused-directive that round 1 reported, in
  a file this round does not touch. Typecheck clean. `pnpm install --frozen-lockfile` first:
  *Already up to date*.
- **Through the real emitted binary.** `pnpm exec quorum board` renders the whole board and exits 0,
  printing **no push-lag line** — and that silence was checked rather than trusted: measured
  independently, `git rev-list --count refs/remotes/origin/main..refs/heads/main` is **0** with
  `main`'s upstream `refs/remotes/origin/main`, and `pushLag` on this repository returns
  `{"state":"pushed"}`, read through a throwaway test that was then deleted. So the silence is the
  `pushed` branch and not a swallowed failure — which is exactly the distinction this round exists
  to make.
- **`pnpm sweep:git-identity` — green twice consecutively**, including its own *"environment
  discriminates (negative and positive probes both as expected)"*. Round 1 reported 3 red in 13 under
  concurrent load, in `codex.test.ts`, a file neither round touches; I saw none, and two runs is not
  a rate — Q-0102's GO-1 owns that measurement.
- **`git status` — 5 modified, 0 new, no strays.** The two throwaway probe files written during this
  round were deleted; nothing committed.

---

## 6. Deliberately left alone

- **`containment` still uses the combined probe and still answers `null` for any failure.** Neither
  finding is about it, its `null` is per-row rather than repository-level, and changing the error
  behaviour of a landed, shipped fact on a ticket that does not name it is the scope creep the role
  text forbids. The asymmetry is now explicit in `insideWorkTree`'s JSDoc, so a later reader meets a
  reason rather than an inconsistency. If a reviewer wants it, it is a ticket.
- **The board's rendering.** `pushLagLegend` is untouched: both findings are about which state is
  selected, not about how one is printed, and every state already had a row.
- **The vocabulary.** No state, reason or type added, and `PUSH_LAG_REASONS` is unchanged.
- **The exact-count spawn pin** was chosen over widening the bound to 7 and leaving the JSDoc vague.
- **`spike/`** does not exist and is not referenced. **`backlog/`** — nothing written.
  **`docs/decisions/`** — nothing added; decision 080 is cited in the code, never transcribed.
- Q-0104's and Q-0102's subjects, and the numbered documents' status lines (no numbered document
  changed this round).

---

## 7. Still owed, unchanged by this round

**GO-2** — `CLAUDE.md:13`'s term list gains `push lag`. Outside this role's write paths, ruled the
human's by Q-0103's E-2, and nothing in `packages/` reads that list, so an omission is silent.

**GO-3** — push the merge and watch CI go green before this ticket closes. It is the one obligation a
local verification cannot discharge, and this round changes nothing about that: a fix for *"nothing
notices that `main` was never validated"* landing on an unpushed `main` is the defect closing its own
ticket.

**Nothing in the requirement or the review was ambiguous enough to stop on.** Both findings named the
criterion they read the code against, both readings were correct, and the remedy each prescribed is
the one implemented.
