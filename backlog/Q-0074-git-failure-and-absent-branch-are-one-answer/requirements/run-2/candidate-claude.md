# Q-0074 — A failed git probe is read as a proven negative

*Requirements, run 2, 2026-09-10. Measured against `3525cfc`. Every count, line number and
classification below was re-derived at that commit; nothing is transcribed from the ticket body,
which asks in as many words not to trust its own table.*

---

## 0. What the measurement changed

The ticket instructs that the census is a task of the run rather than a number to inherit. It was
run. Six things moved, and four of them change the shape of the work.

**0.1 The census: 24 sites, of which 13 collapse and 11 do not.** The ticket body names **7**. The
six it does not name are §1's table rows 3, 8, 11, 12, 20 and 24, and two of them are more severe
than anything the body carries:

- **`containment`'s branch list (`git.ts:345`)** — `safe(...) ?? ''` yields an empty `Set`, so
  `stateOf` answers `{ state: 'indeterminate', reason: 'no branch' }` for **every ticket on the
  board**. `docs/GLOSSARY.md` defines `no branch` as *"the ticket naming a branch that does not
  exist, so git was never asked"*. One failed `for-each-ref` therefore makes `quorum board` assert,
  once per ticket, that git was never asked — when git was asked and failed. This is the only
  measured site that reaches an adopter's screen.
- **`commitAll`'s dirty probe (`fanout.ts:280`)** — `safe(...) ?? ''` yields an empty `dirty` list,
  so `backlog/` reads **clean**: the revert does not run, `onDiscard` does not fire, and
  `git add -A` two lines later commits the agent's edit onto the step branch. That is the exact
  incident `commitAll`'s own JSDoc records — *"Q-0011's architect rewrote a ticket's frontmatter on
  its branch, resetting `iterations` to `{}` and deleting three history entries with their costs;
  only a merge conflict caught it, which is luck rather than design."* The function written to stop
  that stops nothing when its first probe fails, and reports nothing.

**0.2 `mergeFailure` cannot print *"git reported no reason"* on a content conflict.** The body's
third bullet states the consequence and the consequence does not follow. `steps.ts:97–101` tests
`merge?.conflicts?.length` **first**, and `fanout.test.ts:395` pins `result.conflicts` as
`['f.txt']` on exactly that case — so a content conflict renders `conflicts: f.txt`. The empty
`error` is real and is pinned at `:406`; what is false is that anything reads it there. Every
consumer goes through `mergeFailure` (`composite.ts:104, 268, 269, 279, 288, 289`,
`steps.ts:219`), so the empty error is **masked whenever `conflicts` is non-empty** and bites only
compounded with site 316, where the conflict probe fails too. That lowers the defect's severity and
raises site 316's, which the body does not mention at all.

**0.3 The consumer count is 10, not eight.** `branchExists` has six call sites
(`composite.ts:96, 97, 246, 266`, `steps.ts:202, 212`) and `branchHead` four (`engine.ts:141, 271`,
`composite.ts:253`, and `lifecycle.ts:138` through the injected `readBranchHead`). Two of the ten
are not control flow at all — they **write a false sentence into a durable record**, which the body
does not name:

- `engine.ts:141` (`reportUndecided`) renders `${branch} does not exist` and appends
  `kept-at=none` to `runs.log`. An `undecided` run is by definition one nobody was watching, and
  `runs.log` is what is read afterwards.
- `composite.ts:253` writes `Evidence: \`<into>\` at (new)` into the integration notes.

Both are the push-lag rule broken in the other direction: not silence given a second meaning, but
an unanswerable question rendered as an answer.

**0.4 Decision 062 binds Q-0074 to the `fanout/` half, by name.** The body's split guidance offers
*"the entry and `core/git`'s two cases in one, `core/fanout`'s four pins in the other"*, either way
round. It cannot be either way round.
`docs/decisions/062-what-a-runs-event-stream-carries.md:94–97` reads: *"the four routed diagnostics
stay preserved: `branchExists`, `branchHead`, `commitAll` and `mergeInto` still cannot distinguish
'git failed' from 'the branch is not there', which is **Q-0074**"*. `composite.ts:17` says
*"Q-0074 owns it"* of the fan-out branch reads. Both in-tree pointers name the fan-out half, and a
landed entry is never edited — so a split that gave Q-0074 the `git/` half would leave 062 citing a
ticket that no longer covers what 062 names. **See OQ-3.**

**0.5 The rollback matrix already holds the two rows that go wrong, and reads them as correct.**
`lifecycle.test.ts:182–192` is a truth table over `[dry, status, start, current, expected]`. Two of
its eight rows are the defect:

```
[false, 'failed', null,       'bbbbbbbb', 0],   // start head unreadable → no rollback
[false, 'failed', 'aaaaaaaa', null,       0],   // current head unreadable → no rollback
```

Under two values those rows are right: `null` means *the branch is not there*, and there is nothing
to roll back. Under three they are ambiguous, and the second one is the contamination — a `failed`
run whose current head could not be read keeps whatever `integrate` merged. **The guard is blind by
arity, not by oversight**, which is a better description than the body's *"the truthiness guard is
still there"* and is why the fix is a table widening rather than a new test.

**0.6 The answer is already written in-tree, three times, and needs no new vocabulary.**
`pushLag` (`git.ts:406–447`) discriminates at **every one** of its four `safe()` sites —
`if (x == null) return { state: 'indeterminate', reason: 'git failed' }` — and `containment:360`
does the same. `CONTAINMENT_REASONS` (`packages/shared/src/containment.ts:71`) already contains
`'git failed'`. So the `git/` half is not a design problem; it is code failing to reach a state its
own vocabulary declares. No glossary term is added by this ticket (**see AC-15**).

**0.7 Two body claims held.** `safe()` is still declared exactly twice, byte for byte, at
`fanout.ts:206–208` and `git.ts:19–21`, and nothing in `packages/*/src` carries a third. The four
pins are unmoved at `fanout.test.ts:249, 332, 352, 406`. `git.ts` holds 16 sites and `fanout.ts` 8,
totalling 24, as the body re-measured on the day of the run.

---

## 1. The census

Measured at `3525cfc` by reading each call site's consumer. The classification predicate is
mechanical and is the one the fix turns on: **does the call site distinguish `null` from a
legitimate value, or does it merge the two into one claim?**

`packages/core/src/git/git.ts` — 16 sites:

| # | line | in | what a failure becomes | verdict |
| --- | --- | --- | --- | --- |
| 1 | 71 | `repositoryAt` | `!= null` → `false`, returned as a **boolean**, so no caller can tell | **collapses** |
| 2 | 139 | `ensureWorktree` branch probe | branch read as absent → `worktree add -b` → git throws | collapses, **fails loudly** |
| 3 | 143 | `ensureWorktree` base probe | base ignored → **worktree cut from `HEAD`** | **collapses, silent** |
| 4 | 157 | `removeWorktree` `branch -D` | discarded | keeps — best-effort cleanup |
| 5 | 174 | `mergeBase` | `null`; the JSDoc says it deliberately does not tell them apart | keeps — documented |
| 6 | 197 | `currentBranch` | `null`, as does `''` | keeps — documented |
| 7 | 213 | `configuredUser` | `null` → caller writes `unknown` | keeps — documented (Q-0112) |
| 8 | 275 | `shortSha` | `null`, and its own JSDoc says this **doubles as the engine's endpoint existence test** | **collapses** |
| 9 | 298 | `emptyRangeEvidence` left tree | `sameTree: null` | keeps — discriminated |
| 10 | 299 | `emptyRangeEvidence` right tree | `sameTree: null` | keeps — discriminated |
| 11 | 342 | `containment` base probe | `!= null` → `false` → renders `missing ref` | **collapses** |
| 12 | 345 | `containment` branch list | `?? ''` → empty set → **every ticket renders `no branch`** | **collapses** |
| 13 | 360 | `containment` ahead | `== null` → `git failed` | keeps |
| 14 | 416 | `pushLag` remotes | `== null` → `git failed` | keeps |
| 15 | 426 | `pushLag` tracking | `== null` → `git failed` | keeps |
| 16 | 441 | `pushLag` ahead | `== null` → `git failed` | keeps |

`packages/core/src/fanout/fanout.ts` — 8 sites:

| # | line | in | what a failure becomes | verdict |
| --- | --- | --- | --- | --- |
| 17 | 224 | `branchExists` | `Boolean(null)` → `false` | **collapses** — pin `:249` |
| 18 | 239 | `branchHead` | `null` | **collapses** — pin `:249` |
| 19 | 256 | `resetBranchTo` clean | discarded, after an unguarded hard reset that throws | keeps — see NG-4 |
| 20 | 280 | `commitAll` status probe | `?? ''` → `backlog/` reads **clean**: no revert, no `onDiscard` | **collapses** |
| 21 | 283 | `commitAll` checkout | ignored | **collapses** — pin `:332` |
| 22 | 284 | `commitAll` clean | ignored | **collapses** — pin `:332` |
| 23 | 316 | `mergeInto` conflict probe | `?? ''` → no conflicts | **collapses** |
| 24 | 317 | `mergeInto` `merge --abort` | ignored → **merge left in progress** against a JSDoc promising *"leave the worktree clean either way"* | **collapses** |

**13 collapse, 11 keep.** `configuredUser` (row 7) is the body's proposed worked example and the
census confirms it: *git could not run* and *git has no `user.name`* both honestly mean **nobody
said**, and the caller renders that as `unknown` under *"A ticket's owner is supplied, never
guessed"* (2026-09-08). It differs from `branchHead` in one respect that generalises — the two
inputs it merges are **indistinguishable to the caller's question**, where a branch that is absent
and a branch that could not be read lead to different actions.

That is the rule the census yields, and it belongs in the entry: **`safe()` is correct wherever the
caller's question cannot tell the two apart, and wrong wherever the caller acts differently on
them.** The primitive is not the defect; a caller that merges an unanswerable probe into a positive
claim is.

**The census must not be shipped as prose.** It rotted in one day: the merge triage counted 23 on
2026-09-07 and Q-0112 added `git.ts:213` on 2026-09-08. `backlog.source.test.ts:164–170` already
holds the instrument — a register of identities that fails on an unclassified addition, whose own
comment names *"the shape Q-0074 is open on — one primitive declared twice, with nobody's attention
on either copy"*. AC-2 lands this census in that shape.

---

## 2. Problem

**`maintainer`.** A run that fails is supposed to put the ticket branch back where it found it, so
the next stage measures its red phase against a tree that does not already hold the implementation.
It does that by reading the branch head twice — once at run start (`engine.ts:271`) and once at
rollback (`lifecycle.ts:138`). Both reads are `branchHead`, which answers `null` for *the branch is
not there* and `null` for *git could not answer*. A failure at either end makes the rollback skip
itself through a truthiness guard, keep `integrate`'s merge, and **say nothing at all** — no
warning, no `runs.log` line, no manifest field. The one contamination the lifecycle exists to
prevent arrives with no message.

**`adopter`.** `quorum board` is one of the first commands a stranger runs. If a single
`for-each-ref` fails, the board tells them that every ticket in the backlog names a branch that
does not exist — a sentence the glossary defines as *"git was never asked"* — rather than admitting
it could not answer. The vocabulary for admitting it (`git failed`) already exists and the code
cannot reach it.

**`contributor`.** `repositoryAt`'s JSDoc (`git.ts:59–68`) argues at length that
`--resolve-git-dir` is *"the only probe measured here that answers while the repository is
unopenable … which is precisely why it can discriminate between them and absence"*, and the next
line throws that discrimination away with `safe(...) != null`. A comment claiming a property the
code beneath it discards is how this survived a cross-vendor review, and it is what a contributor
reads to learn the module's contract.

**Why it stops being latent.** A run reaching this code has already spawned git several times, so
today the probability is low and the observer is a human at a terminal. M3 removes the observer: a
server hosts these functions, surfaces their answers over HTTP, and runs flows nobody is watching.
The board defect is not latent now.

---

## 3. User stories

- As a **`maintainer`**, when a run fails and git cannot be read, I want the run to tell me the
  ticket branch may still hold `integrate`'s merge, so that I do not measure the next stage against
  a contaminated tree believing nothing happened. *(CLI, `core`)*
- As a **`maintainer`**, when `commitAll` cannot read `backlog/`'s status, I want it to refuse
  rather than commit an agent's edit to a ticket's frontmatter, so that the engine keeps owning the
  backlog. *(`core`)*
- As an **`adopter`**, when a git probe behind `quorum board` fails, I want one honest
  `indeterminate(git failed)` rather than a per-ticket claim that git was never asked, so that the
  first command I run does not lie to me. *(CLI)*
- As a **`contributor`**, I want one written rule for what a caller does with *could not answer*,
  and a register that fails when a new `safe()` site is added without classifying it, so that the
  census does not have to be re-derived by hand every time somebody adds a git call. *(`core`,
  `harness/`)*

---

## 4. Acceptance criteria

Fifteen. **AC-1 to AC-13 are Q-0074's** under the split OQ-3 recommends; AC-14 and AC-15 bind both
halves and are written once here.

**AC-1 — the ruling is cited, never transcribed.**
Every behaviour below traces to the decision entry GO-1 lands. No source file restates its
reasoning: each deliberate site carries **one line** naming the authority, per
`.claude/rules/engineering.md`. *Test:* a source scan asserting that no file under
`packages/core/src/{git,fanout,engine}/` contains a sentence of the entry's body, and that each
site classified `keeps` in AC-2's register carries a one-line citation.
*(This is the rule Q-0067 round 2 and Q-0111 both broke, in this operator's own hand and in an
implementer's, inside two days.)*

**AC-2 — the census is an executable register, not a table in a document.**
A test enumerates every `safe()` call site in `packages/core/src` by file and line, keyed from the
source rather than hand-written, and requires each to carry a classification of `discriminates`,
`indistinguishable` or `best-effort` with a one-sentence reason. An unclassified site **fails**.
*Test:* the register holds 24 entries at `3525cfc`'s count; adding a 25th `safe()` call to either
module fails by name; deleting a classified site fails; the classification is recomputed from each
site's own text so a hand edit cannot contradict the tree (`spike-parity.test.ts`'s rule).
**Shown red by mutation, not read.**

**AC-3 — `safe()` is declared twice and a third is a visible act.**
The two declarations are registered by identity with the reason each module keeps its own, in the
`REALPATH_SITES` shape at `backlog.source.test.ts:164`. *Test:* a third declaration anywhere under
`packages/*/src` fails; the register is an identity map and not a count (Q-0073).
*Not unified into one shared helper* — see NG-1.

**AC-4 — `branchExists` distinguishes three answers.**
It answers *the branch is there*, *the branch is not there*, and *the probe could not answer*, the
third never collapsed into either other. *Test:* under `installGitShim` forcing `rev-parse` to exit
3, it returns the unanswerable answer; against a real absent branch it returns the negative; the
two are not equal. Pin `fanout.test.ts:249` is **rewritten** to assert the discrimination it
currently pins as absent.

**AC-5 — `branchHead` distinguishes three answers**, on the same shape, with pin `:249`'s second
assertion rewritten with it.

**AC-6 — all ten consumers answer for themselves, and each answer is recorded.**
Each of `composite.ts:96, 97, 246, 253, 266`, `steps.ts:202, 212`, `engine.ts:141, 271` and
`lifecycle.ts:138` is decided explicitly. No consumer may reach the unanswerable case and emit
nothing. *Test:* a register of the ten sites with the behaviour each takes; a scan asserting no
consumer tests the result for truthiness alone.

**AC-7 — the rollback does not skip itself silently.**
`lifecycle.test.ts:182`'s matrix gains rows for an unreadable start head and an unreadable current
head. Where either is unanswerable the run emits a `warn` and appends a `runs.log` line naming the
condition and the branch, whichever way GO-2 rules the reset itself.
**Silence keeps exactly its present meaning — *nothing needed rolling back* — and never acquires a
second one**, which is *"The board reports push lag, and never a CI conclusion"* (2026-09-06)
holding at a fourth subject. *Test:* the widened matrix; the new rows shown red against today's
code; the `rolled-back` token still absent from an undecided run's log (Q-0040 AC-5).

**AC-8 — `reportUndecided` never says a branch does not exist when it could not tell.**
`engine.ts:141`'s `where` clause and its `kept-at=` field each carry a third rendering. *Test:* the
shim forces the read to fail; neither the emitted warning nor the `runs.log` line contains
`does not exist` or `kept-at=none`.

**AC-9 — `commitAll` refuses rather than committing over an unread `backlog/`.**
Where the status probe (site 20) cannot answer, `commitAll` does not proceed to `git add -A`.
*Test:* the shim fails `status`; a ticket edit present in the worktree is **not** committed, and
the caller is told why. Demonstrated against today's code, where it is committed.

**AC-10 — a revert that failed is not reported as a discard.**
Where either half of the revert (sites 21, 22) fails, `onDiscard` does not claim a discard that did
not happen, and the failure reaches the caller. Pin `fanout.test.ts:332` is **rewritten**: it
currently asserts *"the discard is reported … over an edit that is still there"* and must assert
the opposite. *Test:* the shim fails `checkout`; the edit is still on disk **and** nothing claims
it was discarded.

**AC-11 — the first reported path keeps its first character.**
`git()`'s module-level `.trim()` strips the leading status column from line one of
`status --porcelain`, and `.slice(3)` then eats a path character. *Test:* pin
`fanout.test.ts:352` is rewritten from `['acklog/T-0001/ticket.md', …]` to the true paths, and goes
red against today's code. **A different defect that shares a home** — see NG-3.

**AC-12 — `mergeInto` reports git's reason, and never an empty one.**
`errorProperty` gains `'stdout'`; git writes `CONFLICT (content): …` there, which
`fanout.test.ts:406` **already proves** by asserting `String(raw.stdout)` contains `CONFLICT`.
Where the conflict probe (site 23) cannot answer, that is not reported as *no conflicts*; where
`merge --abort` (site 24) fails, the JSDoc's *"leave the worktree clean either way"* is either made
true or corrected, and the caller is told. *Test:* pin `:406` rewritten; a forced abort failure
surfaces rather than being swallowed; `mergeInto`'s JSDoc and its behaviour agree.

**AC-13 — the two source registers move rather than widen.**
`fanout.source.test.ts:44` requires the folder to be **exactly two files**, and `:48` exactly
twelve exports. If either moves it is moved with the historical value shown refused, which is the
demonstration `git.source.test.ts:47` already writes for itself. *Test:* the new register's
previous value is asserted `.not.toEqual`, never `toContain`.
*`fanout.ts` may import `../git/git.js`* — `:135`'s allow-list already permits it — so the
exit-status reader may be shared rather than copied. **See OQ-4.**

**AC-14 — `repositoryAt`'s JSDoc stops claiming what its body discards.** *(binds the `git/` half)*
`git.ts:66`'s *"which is precisely why it can discriminate between them and absence"* is either
made true by the code or corrected. *Test:* a guard asserting the sentence and the return type
agree, anchored so that it fails if either moves — **and shown to have a subject**, which is
Q-0111's lesson: its first needle matched nothing at all, including itself.

**AC-15 — no glossary term is added, and no rendered vocabulary widens.**
`CONTAINMENT_REASONS` already holds `'git failed'`; the board's rendered set does not grow, and
`docs/GLOSSARY.md` gains no term. *Test:* `containment` and `pushLag`'s reason sets are unchanged
by identity; the glossary's term list and `CLAUDE.md:13` are byte-identical before and after
(Q-0108's check).

---

## 5. Non-goals

- **NG-1 — the two `safe()` declarations are not unified into one shared helper.** `fanout.ts`
  keeps its own `git` runner on a recorded argument (`fanout.ts:199–202`: *"a port that exported it
  to save four lines would widen that module's surface for this one's convenience"*), and the same
  argument covers `safe()`. AC-3 registers the duplication; it does not remove it.
- **NG-2 — the eleven `keeps` sites are not changed.** Turning every `safe()` into a tri-state is a
  change nobody asked for, and §1 gives each of the eleven its reason. `configuredUser` is the
  worked example.
- **NG-3 — the `commitAll` path-truncation fix does not become a `git()` change.** AC-11 is not a
  `safe()` defect at all: it is the module-level runner's `.trim()`. It is in scope because the pin
  must be rewritten anyway and the fix is one line **inside `commitAll`**. Changing `git()`'s trim
  would move every one of its 24 callers' output and is refused here.
- **NG-4 — `resetBranchTo`'s stale-registration defect stays.** Site 19's neighbouring defect —
  the route chosen from `fs.existsSync` alone, so a hand-deleted worktree directory wedges the
  branch — is `Why: preserved defect, see Q-0048 AC-12`, Q-0042 finding 5, and is not this ticket's.
- **NG-5 — `ensureWorktree`'s base fallback is registered, not repaired.** Site 3 cuts a worktree
  from `HEAD` when the declared base does not resolve. Q-0038's closing entry already names this as
  a non-goal with its evidence — *"the implementer was not stopped by the missing ref; it was handed
  a worktree from somewhere else and paid to work in it"* — and states its reasons: another module,
  it governs fan-out task bases too, and *throw, warn, or which callers* is unasked. It gains an
  AC-2 register row and nothing else.
- **NG-6 — the two `--dry` mutations are struck from this ticket.** See §6.
- **NG-7 — Q-0109's third case stays closed as unclosable.** A project root *below* a repository
  git refuses. Do not reopen without new evidence; the reasoning is in `git.ts:81–87` and in the
  ticket body, and both cite *"A test's verdict is a property of the commit"* (2026-08-30).
- **NG-8 — no CLI rendering changes.** The ten `fanout/` consumers are all engine-internal and emit
  events. The board's rendering table is unchanged; only which state the derivation reaches moves.
- **NG-9 — no error message composes a remedy.** *"A `core` error names the condition; the remedy
  belongs to the surface"* (2026-09-07). Nothing added here tells a user what to type.
- **NG-10 — v1 exclusions**, all by default: multi-user, remote daemon, cloud sync, plugin
  marketplace, visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## 6. Struck and routed: the two `--dry` mutations

The body carries two mutations `--dry` does not guard — the in-memory ticket advances, and the run's
counters alias `ticket.meta.iterations`. Measured, they are **in-memory only**: `engine.ts:194`
substitutes `readOnlyBacklog(backlog)` under dry, so nothing reaches disk. They are also **pinned as
deliberate** at `lifecycle.test.ts:228` (*"dry preserves in-memory mutations while the prototype
view absorbs writes"*) and carry their own authority line at `lifecycle.ts:118`
(`Why: preserved defect, see Q-0050 AC-10`).

They have nothing to do with `safe()`, with git, or with an unanswerable probe. They are about
**who owns a `TicketRecord` across a run**, which is a different question with a different answer
and its own landed pin. Carrying them here buys two criteria of unrelated work inside a ticket
already at fifteen.

**The successor's body, written out in full so the obligation does not expire** — which is this
repository's own rule, and the failure it recorded three times in the week before this run
(Q-0110's, Q-0111's and Q-0112's obligations each lived only inside a closed ticket's prose or a
source comment):

> **`--dry` mutates the caller's ticket, and the counters are an alias.**
> `finish()` sets `ticket.meta.iterations = context.counters` and advances `ticket.meta.stage`
> before its `if (!context.dry)` guard (`lifecycle.ts:118–122`), and `recordEvent` does the same at
> `:191`. `types.ts:215` documents the counters as *"the same object as `ticket.meta.iterations` —
> an alias, not a copy"*. Nothing reaches disk: `engine.ts:194` swaps in `readOnlyBacklog(backlog)`
> under dry, and `lifecycle.test.ts:228` pins that arrangement deliberately. **So this is bounded
> today to a caller that reuses the ticket object in-process, and there is exactly one such caller
> planned: M3's server**, which will hold a ticket across runs and answer `GET` requests from the
> object a `--dry` walk has just advanced. What it owes is not a fix but a decision about ownership:
> does `runFlow` receive a ticket it may mutate, or a copy it may not? The second is the cheap
> answer and it changes `lifecycle.test.ts:228`'s pin, which is why it wants a ruling rather than a
> patch. Strictly before Q-0013. Do not fold it into a git-probe ticket: the two share a file and
> nothing else.

---

## 7. Open questions

**OQ-1 (blocker, owner: human, at the gate) — the decision entry must land before a line of code.**
The ruling is *what does a caller do with "could not answer"*, and no step on the chore route may
write a decision entry (`harness/roles/developer-generalist.md:23`). This is the pattern that
exhausted Q-0070's loop at $8.31 and burned Q-0062's first three implement rounds — the eighth
appearance there, and the requirement had named the hazard in advance and was ignored. **Do not
launch the chore run until the entry is in `docs/decisions/` and `docs/DECISIONS.md`.**

**OQ-2 (blocker, owner: human, in the entry) — what does the rollback do when it cannot read a
head?** Three answers, and an implement step may take none of them:

- *(a) Reset anyway.* Impossible for the start-head case — there is no sha to reset **to**. For the
  current-head case it means resetting a branch whose position you could not verify.
- *(b) Do not reset; warn and record.* The run has already failed, so there is nothing left to
  stop; what is available is to keep the branch and say the branch may hold `integrate`'s merge.
- *(c) Today's behaviour: skip silently.* What the ticket exists to remove.

**Recommended: (b)**, on the asymmetry this repository has already ruled twice — *the instrument
may warn and may never reassure* (`push-lag.ts:15–23`). It also preserves silence's present
meaning, which is what AC-7 turns on. Stated as a recommendation rather than decided: it is a
change to what a failing run does with a branch, and that is the human's.

**OQ-3 (blocker, owner: human, at the gate) — the split, and which half keeps the id.**
Thirteen collapsing sites, ten consumers, four pins, two source registers and an entry do not fit
under fifteen criteria. Q-0091 and Q-0096 both split at their gates, both at cost, and both bodies
said afterwards that the seam should have been drawn first.

**Recommended: split by module, `fanout/` first as Q-0074, `git/` to a successor.** The reason is
§0.4 and is measured rather than preferred: decision 062 cites Q-0074 against `branchExists`,
`branchHead`, `commitAll` and `mergeInto` by name, and `composite.ts:17` says *"Q-0074 owns it"* of
the fan-out reads. A landed entry is never edited, so the id must stay with what 062 names. The
entry, AC-2's register and AC-3 land here and the successor inherits them; AC-14 and AC-15 travel
with the `git/` half.

**The counter-argument, stated because it is real:** the `git/` half holds the only site that
reaches an adopter's screen (row 12), and it is nearly mechanical — the vocabulary exists, the
machinery exists, and `pushLag` is the worked shape ten lines away. If the operator prefers the
board-visible half first, the entry moves with it, and this ticket's body must be re-pointed at the
gate so 062's citation still reads true.

**OQ-4 (owner: implementer, measure before choosing) — where does the exit-status reader live?**
Reading git's exit status is what makes the third answer possible, and `git.ts` already has it
module-private: `errorProperty` accepting `'status'` (`:27`), `exitStatus` (`:37`), `GIT_FATAL`
(`:48`), `failureDetail` (`:115`). **`fanout.ts` has none of it** — its `errorProperty` (`:211`)
accepts only `'stderr' | 'message'`. Three options: a third copy in `fanout.ts` (refused, it is the
shape AC-3 exists to forbid), export from `git.ts` (permitted — `fanout.source.test.ts:135`'s
allow-list already contains `'../git/git.js'` — but it moves `git.source.test.ts:32`'s
twelve-export register), or into `@quorum/shared` (also on the allow-list; but `shared` is
declarations and constants, and an error reader is behaviour). **Recommended: export from `git.ts`
and move the register per AC-13**, which is the one option that adds no copy and no new home.

**OQ-5 (owner: implementer) — when is *"git reported no reason"* actually reachable?**
§0.2 establishes it is **not** reachable on a content conflict. It appears reachable only where the
conflict probe (site 23) also fails, or through `mergeFailure(null)`, whose signature admits
`null` and for which no caller was found. Measure it before writing AC-12's fixture: a criterion
whose fixture cannot reach its own case is the defect this repository keeps finding, and
`fanout.test.ts:406`'s current pin asserts the empty error rather than the sentence.

**OQ-6 (owner: human, one sentence in the entry) — is the ruling about a `catch` block or about a
habit?** The ticket body argues the second and offers evidence: *a failed probe read as a proven
negative* was committed twice by the operator in the three days before this run — Q-0068's merge
triage grepped for `Q-0066`, found nothing, and read absence into it while an authority line had
sat above the code since 2026-08-26 under a different citation; and Q-0039's erratum E-1 narrowed a
guarantee at two of its three sites. Neither is a `safe()` call. **Recommended: one sentence, and no
more** — a decision entry rules on code, and a habit is what `harness/rules.md` is for. If it earns
more than a sentence it is a second entry.

---

## 8. Risks

- **R-1 — the fix widens one guard and leaves its twin.** `lifecycle.ts` reads a head at `:136` and
  again at `:138`, and a change to `branchHead`'s return type alone closes the first and leaves the
  second testing `string | null` for truthiness. AC-7's matrix is what catches it; both rows must
  be shown red before green.
- **R-2 — an approve on the first pass should be distrusted.** 108 of 145 review verdicts in this
  repository returned `revise`. Three of the four pins are rewrites of tests that currently assert
  the *opposite* of what they will assert, so a reviewer reading the diff without running it cannot
  tell a rewritten pin from a weakened one. **Every rewritten pin is demonstrated red against the
  unfixed code**, per AC-2, AC-9, AC-10 and AC-11.
- **R-3 — the shim is the only instrument, and it must not become the oracle.** `installGitShim`
  (`test/repo.js`) puts a script on `PATH` that fails selected subcommands. It is a fixture the test
  builds itself, which *"A test's verdict is a property of the commit, not of the checkout or the
  account"* (2026-08-30) permits — but a test that needs a capability must **probe for it and report
  a skip** rather than assume it, which is Q-0105's GO-3 repaired by hand after its gate. Any new
  shim-dependent test states its premise.
- **R-4 — the register can be written so that it cannot fail.** AC-2's classification is the whole
  value of this ticket and it is exactly the shape that has failed five times here: a scan blind to
  a spelling (Q-0067 rounds 1–2), a fail-open list (Q-0051, Q-0108), an assertion satisfied by its
  own subject (Q-0111), a count standing in for an identity (Q-0073, Q-0107). It must be **keyed
  from the source**, must fail on an unclassified addition, and must be shown red by mutation with
  distinct signatures.
- **R-5 — `git.ts` has two source registers and both are `toEqual` on sorted key lists.**
  `git.source.test.ts:32` and `:73`. Exporting anything new from that module fails both, which is
  the machinery working; AC-13 requires the move be demonstrated against the refused historical
  value rather than edited to fit.
- **R-6 — AC-9 changes what `commitAll` does on a path no test covers today**, and `commitAll` is
  on every code-writing step's exit. A refusal that is too eager stops runs that would have
  succeeded. The refusal must be reachable **only** where the probe could not answer, never where
  `backlog/` is legitimately clean — the two are one character apart in today's code (`?? ''`).
- **R-7 — `pnpm install` before the suite.** An implement step's worktree has no `node_modules`;
  `commands.install` runs only in an `integrate` worktree (`harness/rules.md`). An uninstalled
  suite and a red suite are indistinguishable to a reviewer.
- **R-8 — the run cannot fully prove its own fix.** `runFlow` receives `config` at run start, and
  this ticket changes code the running engine has already loaded. The `integrate` step exercises
  the *old* `commitAll` and `mergeInto`. Verification is forced, on `main`, after the merge, in
  both environment rows (Q-0072's closing finding).

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no credential, no `check()` path is touched. |
| **Worktree safety** | Engaged. Site 3 (`ensureWorktree` base probe) is the one place a probe failure changes **where an agent writes**; registered under NG-5, not repaired. Nothing here writes to the user's working tree; `resetBranchTo` and `commitAll` operate inside `.harness/worktrees/`. |
| **Gate behaviour** | Unchanged. No gate, no verdict vocabulary and no exit code moves. `undecided`'s `runs.log` line gains a third rendering of `kept-at=` (AC-8) and keeps `rollback=none` and the absence of the `rolled-back` token (Q-0040 AC-5). |
| **File format and schema** | No format change. `PushLagResult`, `ContainmentResult`, `AncestryResult` and their three closed sets are untouched, and `'git failed'` is already a member of two of them (AC-15). `TicketRecord` is unchanged — see §6. |
| **Lint rules** | No flow-lint rule added. `harness lint` is unaffected. Type-aware ESLint stays one rule. |
| **Cold-clone impact** | **Improves it.** The board is on the first-30-minutes path and row 12 makes it misreport every ticket. Nothing here lengthens that path; no new command, flag, prompt or output line. |
| **Docs** | `docs/DECISIONS.md` gains one index line and `docs/decisions/088-*.md` the entry (next free number: 087 is `m2-closed`). No numbered doc changes: `04-architecture.md`'s `core` principles already require this and are not contradicted. `docs/GLOSSARY.md` gains nothing (AC-15). `harness/rules.md` gains at most one sentence if OQ-6 rules the habit worth stating, and `.claude/rules/` is its **derived copy** — the human's to sync, never a surface a criterion may name (2026-08-27). |
| **Product-agnostic** | Clean. No product name, no example beyond `T-0001`/`Q-` fixtures. |
| **Errors are explicit** | This is the criterion the ticket is about. Thirteen sites default silently today; AC-4 to AC-12 remove that at the eight this half owns, and AC-2 registers the rest. |

---

## 10. Gate obligations

- **GO-1** — the decision entry is written and indexed **before** the chore run starts (OQ-1, OQ-2,
  OQ-6). Verify it is present in the first implement step's prompt rather than assuming it, which
  is the check Q-0097 lost two errata by not making.
- **GO-2** — OQ-3's split is ruled at the gate and this body re-pointed if the recommendation is not
  taken, so decision 062's citation still reads true.
- **GO-3** — the successor for §6's `--dry` mutations is **opened as a ticket at this gate**, from
  the body above, not left in a closing entry.
- **GO-4** — verified in both environment rows, forced, on `main` after the merge; CI green on the
  merged commit. This is the ticket whose subject is *a probe read as a proven negative*, and a
  local green is a probe.
- **GO-5** — this ticket's closing entry records what the census found, including that the body's
  own re-measurement was right about 24 and wrong about which sites matter.
