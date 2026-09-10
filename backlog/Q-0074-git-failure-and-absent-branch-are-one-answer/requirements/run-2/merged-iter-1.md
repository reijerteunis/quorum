# Q-0074 — A failed git probe is read as a proven negative

*Merged requirement, run 2, iteration 1. Measured against `3525cfc`. Every count, line number and
classification below was re-derived at that commit; nothing is transcribed from the ticket body,
which asks in as many words not to trust its own table, and nothing is taken from either candidate
without checking it against the tree.*

**Verdict: needs-input.** Four blockers, in §7. Three are structural rather than informational:
the decision entry is owed before a line of code and no step on this route may write one (B-1), the
rollback's behaviour on an unanswerable read is a product choice (B-2), and **the ticket does not
fit under fifteen criteria** (B-3). §4 is written to the recommended cut so that a gate answer of
*take the recommendation* leaves a runnable document; if the recommendation is not taken, this body
is re-pointed at the gate.

---

## 0. What the measurement changed

The ticket instructs that the census is a task of the run rather than a number to inherit. It was
run, and then re-run against the tree while merging. Six results change the shape of the work.

**0.1 The census is 24 sites — 16 in `git.ts`, 8 in `fanout.ts` — of which 13 collapse and 11 do
not.** The ticket body names seven. Two of the six unnamed sites are more severe than anything the
body carries, and both were verified by reading the consumer rather than the call:

- **`containment`'s branch list (`git.ts:345`)** — `safe(...) ?? ''` yields an empty `Set`, and
  `stateOf`'s first clause is `if (!branches.has(branch)) return { state: 'indeterminate', reason:
  'no branch' }`. So one failed `for-each-ref` makes `quorum board` answer `no branch` for **every
  ticket in the backlog**, and `docs/GLOSSARY.md` defines that state as *"the ticket naming a branch
  that does not exist, so git was never asked"*. Git was asked, and failed. This is the only measured
  site that reaches an adopter's screen, and the comment directly above it (Q-0070) argues at length
  that this state must not be confused with *no question was asked* — which is precisely what the
  line beneath it does when the probe fails.
- **`commitAll`'s dirty probe (`fanout.ts:280`)** — `safe(...) ?? ''` yields an empty `dirty` list,
  so `backlog/` reads **clean**: the revert does not run, `onDiscard` does not fire, and `git add
  -A` two lines later commits the agent's edit onto the step branch. That is the incident this
  function's own JSDoc records — an architect rewriting a ticket's frontmatter on its branch,
  resetting `iterations` and deleting three history entries with their costs, *"only a merge
  conflict caught it, which is luck rather than design"*. The function written to stop that stops
  nothing when its first probe fails, and reports nothing.

**0.2 `mergeFailure` cannot print *"git reported no reason"* on a content conflict.** The ticket
body's third bullet states a consequence that does not follow. `steps.ts:97–101` tests
`merge?.conflicts?.length` **first** and returns `conflicts: …`; `fanout.test.ts:395` pins
`result.conflicts` as `['f.txt']` on exactly that case. The empty `error` is real and pinned at
`:406`; what is false is that anything reads it there. Every consumer routes through `mergeFailure`
(`composite.ts:104, 268, 269, 279, 288, 289`; `steps.ts:219`), so the empty error is **masked
whenever `conflicts` is non-empty** and bites only when compounded with the conflict probe at
`fanout.ts:316` failing too. That lowers this defect's severity and raises site 316's, which the
body does not mention at all. **See OQ-5: measure reachability before writing AC-12's fixture.**

**0.3 The consumer count is ten, not eight, and two of the ten are not control flow.**
`branchExists` has six call sites (`composite.ts:96, 97, 246, 266`; `steps.ts:202, 212`) and
`branchHead` four (`engine.ts:141, 271`; `composite.ts:253`; `lifecycle.ts:138` through the injected
`readBranchHead`). Two **write a false sentence into a durable record**:

- `engine.ts:141` (`reportUndecided`) renders `${branch} does not exist` and appends
  `kept-at=none` to `runs.log`. An `undecided` run is by definition one nobody was watching, and
  `runs.log` is what is read afterwards.
- `composite.ts:253` writes `Evidence: \`<into>\` at (new)` into the integration notes.

Both are the push-lag rule broken in the other direction: not silence given a second meaning, but
an unanswerable question rendered as an answer.

**0.4 Decision 062 binds Q-0074 to the `fanout/` half, by name.** The ticket body offers the split
either way round. It cannot be either way round.
`docs/decisions/062-what-a-runs-event-stream-carries.md:94–97` reads: *"the four routed diagnostics
stay preserved: `branchExists`, `branchHead`, `commitAll` and `mergeInto` still cannot distinguish
'git failed' from 'the branch is not there', which is **Q-0074**"*. `composite.ts:17` says *"Q-0074
owns it"* of the fan-out branch reads. A landed entry is never edited, so an id that moved to the
`git/` half would leave 062 citing a ticket that no longer covers what 062 names. **This settles
which id keeps which half; it does not settle which half runs first, and those are different
questions — see B-3.**

**0.5 The rollback matrix already holds the two rows that go wrong, and reads them as correct.**
`lifecycle.test.ts:181–195` is a truth table over `[dry, status, start, current, expected]` whose own
title is *"rollback requires all four guards"*. Two of its eight rows are the defect:

```
[false, 'failed', null,       'bbbbbbbb', 0],   // start head unreadable → no rollback
[false, 'failed', 'aaaaaaaa', null,       0],   // current head unreadable → no rollback
```

Under two values those rows are right: `null` means *the branch is not there* and there is nothing
to roll back. Under three they are ambiguous, and the second is the contamination — a `failed` run
whose current head could not be read keeps whatever `integrate` merged. **The guard is blind by
arity, not by oversight**, which is a better description than *"the truthiness guard is still
there"* and is why the fix is a table widening rather than a new test.

**0.6 The answer is already written in-tree, three times, and needs no new vocabulary.** `pushLag`
(`git.ts:406–447`) discriminates at **every one** of its four `safe()` sites, and `containment:360`
does the same: `if (x == null) return { state: 'indeterminate', reason: 'git failed' }`.
`CONTAINMENT_REASONS` (`packages/shared/src/containment.ts:71`) already contains `'git failed'`. So
the `git/` half is not a design problem; it is code failing to reach a state its own vocabulary
already declares. No glossary term is added by this ticket (AC-14).

**0.7 Three body claims held.** `safe()` is declared exactly twice, byte for byte, at
`fanout.ts:206–208` and `git.ts:19–21`, and nothing else under `packages/*/src` carries a third. The
four pins are unmoved at `fanout.test.ts:249, 332, 352, 406`, verbatim as the body quotes them. The
start-of-run read is `engine.ts:271` and the two rollback guards are `lifecycle.ts:136` and `:139`.

**0.8 The instrument already exists**, which was not established in either candidate.
`installGitShim` lives in `packages/core/test/repo.ts` and is already used **at two of the four pin
sites** — `fanout.test.ts:253` (`*rev-parse*) exit 3`) and `:338` (`*" checkout "*) exit 3`) — and
at five sites in `git.test.ts`. Every criterion below is reachable with a fixture the suite already
builds; nothing here needs a new mechanism. That converts R-3 from *build an instrument* to *state
its premise*.

---

## 1. The census

Measured at `3525cfc` by reading each call site's consumer. The classification predicate is
mechanical and is the one the fix turns on: **does the call site distinguish `null` from a
legitimate value, or does it merge the two into one claim?** The disposition vocabulary is three
names, not two — *distinguish*, *propagate*, *best-effort with a reason* — because "keeps" hides the
difference between a site that already discriminates and a site that deliberately swallows.

`packages/core/src/git/git.ts` — 16 sites:

| # | line | in | what a failure becomes | disposition |
| --- | --- | --- | --- | --- |
| 1 | 71 | `repositoryAt` | `!= null` → `false`, returned as a **boolean**, so no caller can tell | **collapses** |
| 2 | 139 | `ensureWorktree` branch probe | branch read as absent → `worktree add -b` → git throws | collapses, **fails loudly** |
| 3 | 143 | `ensureWorktree` base probe | base ignored → **worktree cut from `HEAD`** | **collapses, silent** |
| 4 | 157 | `removeWorktree` `branch -D` | discarded | best-effort |
| 5 | 174 | `mergeBase` | `null`; its JSDoc says it deliberately does not tell them apart | documented |
| 6 | 197 | `currentBranch` | `null`, as does `''` | documented |
| 7 | 213 | `configuredUser` | `null` → caller writes `unknown` | documented (Q-0112) |
| 8 | 275 | `shortSha` | `null`, and its own JSDoc says this **doubles as the engine's endpoint existence test** | **collapses** |
| 9 | 298 | `emptyRangeEvidence` left tree | `sameTree: null` | discriminates |
| 10 | 299 | `emptyRangeEvidence` right tree | `sameTree: null` | discriminates |
| 11 | 342 | `containment` base probe | `!= null` → `false` → renders `missing ref` | **collapses** |
| 12 | 345 | `containment` branch list | `?? ''` → empty set → **every ticket renders `no branch`** | **collapses** |
| 13 | 360 | `containment` ahead | `== null` → `git failed` | discriminates |
| 14 | 416 | `pushLag` remotes | `== null` → `git failed` | discriminates |
| 15 | 426 | `pushLag` tracking | `== null` → `git failed` | discriminates |
| 16 | 441 | `pushLag` ahead | `== null` → `git failed` | discriminates |

`packages/core/src/fanout/fanout.ts` — 8 sites:

| # | line | in | what a failure becomes | disposition |
| --- | --- | --- | --- | --- |
| 17 | 224 | `branchExists` | `Boolean(null)` → `false` | **collapses** — pin `:249` |
| 18 | 239 | `branchHead` | `null` | **collapses** — pin `:249` |
| 19 | 256 | `resetBranchTo` clean | discarded, after an unguarded hard reset that throws | best-effort — NG-4 |
| 20 | 280 | `commitAll` status probe | `?? ''` → `backlog/` reads **clean**: no revert, no `onDiscard` | **collapses** |
| 21 | 283 | `commitAll` checkout | ignored | **collapses** — pin `:332` |
| 22 | 284 | `commitAll` clean | ignored | **collapses** — pin `:332` |
| 23 | 316 | `mergeInto` conflict probe | `?? ''` → no conflicts | **collapses** |
| 24 | 317 | `mergeInto` `merge --abort` | ignored → **merge left in progress** against a JSDoc promising *"leave the worktree clean either way"* | **collapses** |

**13 collapse, 11 do not.** `configuredUser` (row 7) is the body's proposed worked example and the
census confirms it: *git could not run* and *git has no `user.name`* both honestly mean **nobody
said**, and the caller renders that as `unknown` under *"A ticket's owner is supplied, never
guessed"* (2026-09-08). It differs from `branchHead` in the one respect that generalises — **the two
inputs it merges are indistinguishable to the caller's question**, where a branch that is absent and
a branch that could not be read lead the caller to different actions.

That is the rule the census yields and it belongs in the entry: **`safe()` is correct wherever the
caller's question cannot tell the two apart, and wrong wherever the caller acts differently on them.
The primitive is not the defect; a caller that merges an unanswerable probe into a positive claim
is.**

**The census must not ship as prose, and no criterion may depend on its total.** It rotted in one
day: the merge triage counted 23 on 2026-09-07 and Q-0112 added `git.ts:213` on 2026-09-08.
`backlog.source.test.ts:164–170` already holds the instrument — a register of identities that fails
on an unclassified addition, whose own comment names *"the shape Q-0074 is open on — one primitive
declared twice, with nobody's attention on either copy"*. AC-2 lands the census in that shape, and
asserts over classifications rather than over a count.

---

## 2. Problem

**`maintainer`.** A run that fails is supposed to put the ticket branch back where it found it, so
the next stage measures its red phase against a tree that does not already hold the implementation.
It does that by reading the branch head twice — at run start (`engine.ts:271`) and at rollback
(`lifecycle.ts:138`). Both are `branchHead`, which answers `null` for *the branch is not there* and
`null` for *git could not answer*. A failure at either end makes the rollback skip itself through a
truthiness guard, keep `integrate`'s merge, and **say nothing at all** — no warning, no `runs.log`
line, no manifest field. The one contamination the lifecycle exists to prevent arrives with no
message.

**`adopter`.** `quorum board` is among the first commands a stranger runs. If a single
`for-each-ref` fails, the board tells them every ticket in the backlog names a branch that does not
exist — a sentence the glossary defines as *"git was never asked"* — rather than admitting it could
not answer. The vocabulary for admitting it (`git failed`) already exists and the code cannot reach
it.

**`contributor`.** `repositoryAt`'s JSDoc (`git.ts:59–68`) argues that `--resolve-git-dir` is *"the
only probe measured here that answers while the repository is unopenable … which is precisely why it
can discriminate between them and absence"*, and the next line throws that discrimination away with
`safe(...) != null`. A comment claiming a property the code beneath it discards is how this survived
a cross-vendor review, and it is what a contributor reads to learn the module's contract.

**Why it stops being latent.** A run reaching this code has already spawned git several times, so
today the probability is low and the observer is a human at a terminal. M3 removes the observer: a
server hosts these functions, surfaces their answers over HTTP, and runs flows nobody is watching.
The board defect is not latent now.

---

## 3. User stories

- As a **`maintainer`**, when a run fails and a branch head cannot be read, I want the run to tell
  me the ticket branch may still hold `integrate`'s merge, so that I do not measure the next stage
  against a contaminated tree believing nothing happened. *(CLI, `core`)*
- As a **`maintainer`**, when `commitAll` cannot read `backlog/`'s status, I want it to refuse
  rather than commit an agent's edit to a ticket's frontmatter, so that the engine keeps owning the
  backlog. *(`core`)*
- As an **`adopter`**, when a git probe fails, I want the diagnostic to name the repository, the ref
  and the git failure detail, and to say nothing that implies the ref is absent, so that I can
  recover without understanding Quorum's internals. *(CLI)*
- As a **`contributor`**, I want one written rule for what a caller does with *could not answer*,
  and a register that fails when a new `safe()` site is added without classifying it, so that the
  census is not re-derived by hand every time somebody adds a git call. *(`core`, `harness/`)*

---

## 4. Acceptance criteria

**Fourteen, scoped to the `fanout/` half B-3 recommends.** AC-2 and AC-3 are the shared artifacts:
they cover both modules, land **once, with whichever half runs first**, and the second half inherits
them and extends the register's dispositions to its own repairs. The `git/` half's criteria are
written out in full in §6.1 rather than referenced, because a deferred obligation dies unless it is
written into a successor's body.

**AC-1 — the ruling is cited, never transcribed.** Every behaviour below traces to the decision
entry B-1 lands. No source file restates its reasoning: each deliberate site carries **one line**
naming the authority, per `.claude/rules/engineering.md`. *Test:* a source scan asserting that no
file under `packages/core/src/{git,fanout,engine}/` contains a sentence of the entry's body, and
that every site AC-2 classifies as retaining `safe()` carries a one-line citation. *(This is the
rule Q-0067 round 2 and Q-0111 both broke, in an implementer's hand and in the operator's, inside
two days.)*

**AC-2 — the census is an executable register, not a table in a document.** A test enumerates every
`safe()` call site under `packages/core/src` by file and line, **keyed from the source**, and
requires each to carry one of three dispositions — `distinguish`, `propagate` or `best-effort` — and
a one-sentence reason. An unclassified site **fails**. *Test:* adding a 25th `safe()` call to either
module fails by name; deleting a classified site fails; the disposition is recomputed from each
site's own text so a hand edit cannot contradict the tree (`spike-parity.test.ts`'s rule). **No
assertion depends on the totals 23 or 24**, which is what makes the register survive the next
`git.ts` addition. Shown red by mutation with distinct signatures, not read.

**AC-3 — `safe()` is declared twice and a third is a visible act.** The two declarations are
registered by identity, each with the reason its module keeps its own, in the `REALPATH_SITES` shape
at `backlog.source.test.ts:164`. *Test:* a third declaration anywhere under `packages/*/src` fails;
the register is an identity map and not a count (Q-0073). Not unified into one shared helper — NG-1.

**AC-4 — `branchExists` distinguishes three answers.** *the ref is there*, *the ref is not there*,
and *the probe could not answer*, the third never collapsed into either other. *Test:* under
`installGitShim('case " $* " in *rev-parse*) exit 3 ;; esac')` it returns the unanswerable answer;
against a real absent branch it returns the negative; the two are not equal. Pin
`fanout.test.ts:249` is **rewritten in place** to assert the discrimination it currently pins as
absent, and its `Why: preserved defect` line is removed with it.

**AC-5 — `branchHead` distinguishes three answers**, on the same shape, with pin `:249`'s second
assertion rewritten with it.

**AC-6 — all ten consumers answer for themselves, and no consumer tests for truthiness alone.**
`composite.ts:96, 97, 246, 253, 266`; `steps.ts:202, 212`; `engine.ts:141, 271`; `lifecycle.ts:138`.
No consumer may reach the unanswerable case and emit nothing. *Test:* a register of the ten sites
naming the behaviour each takes, keyed from source so an eleventh consumer fails until classified.

**AC-7 — the rollback does not skip itself silently, and both guards are covered.**
`lifecycle.test.ts:181`'s matrix gains rows for an unreadable start head and an unreadable current
head, **independently** — a fix that widens `branchHead`'s return type closes `:136` and leaves
`:139` testing `string | null` for truthiness. Where either read is unanswerable the run emits a
`warn` and appends a `runs.log` line naming the condition and the branch, whichever way B-2 rules
the reset itself. **Silence keeps exactly its present meaning — *nothing needed rolling back* — and
never acquires a second one**, which is *"The board reports push lag, and never a CI conclusion"*
(2026-09-06) holding at a fourth subject. *Test:* the widened matrix, both new rows shown red
against today's code; the `rolled-back` token still absent from an undecided run's log (Q-0040
AC-5); the existing eight rows unchanged in verdict.

**AC-8 — `reportUndecided` never says a branch does not exist when it could not tell.**
`engine.ts:141`'s `where` clause and its `kept-at=` field each gain a third rendering. *Test:* the
shim forces the read to fail; neither the emitted warning nor the `runs.log` line contains `does not
exist` or `kept-at=none`, and neither says or implies the branch is absent.

**AC-9 — `commitAll` refuses rather than committing over an unread `backlog/`.** Where the status
probe (site 20) cannot answer, `commitAll` does not proceed to `git add -A`, and the caller is told
with the available git detail. *Test:* the shim fails `status`; a ticket edit present in the
worktree is **not** committed. Demonstrated against today's code, where it is.

**AC-10 — a revert that failed is not reported as a discard.** Where either half of the revert
(sites 21, 22) fails, `onDiscard` does not claim a discard that did not happen and the failure
reaches the caller. *Test:* pin `fanout.test.ts:332` is **rewritten** — it currently asserts the
discard is reported over an edit that is still there and must assert the opposite; the shim fails
`checkout`; the edit is still on disk **and** nothing claims it was discarded.

**AC-11 — the first reported path keeps its first character.** `git()`'s module-level `.trim()`
(`fanout.ts:204`) strips the leading status column from line one of `status --porcelain`, and
`.slice(3)` at `:281` then eats a path character. *Test:* pin `fanout.test.ts:352` is rewritten from
`['acklog/T-0001/ticket.md', …]` to the complete ordered paths `backlog/T-0001/ticket.md` and
`backlog/T-0001/sneaked.md`, and goes red against today's code. **A different defect that shares a
home** — the fix is inside `commitAll`, never in `git()` — NG-3.

**AC-12 — `mergeInto` reports git's reason, and never an empty one.** The failure carries the useful
reason git emitted **whether git wrote it to stdout, stderr or both**, and `mergeFailure` does not
answer *"git reported no reason"* while either stream holds non-whitespace diagnostic text. Where
the conflict probe (site 23) cannot answer, that is not reported as *no conflicts*; where `merge
--abort` (site 24) fails, the JSDoc's *"leave the worktree clean either way"* is either made true or
corrected, and the caller is told. *Test:* pin `:406` rewritten against a real content conflict —
that test already proves `String(raw.stdout)` contains `CONFLICT`; a forced abort failure surfaces
rather than being swallowed; `mergeInto`'s JSDoc and its behaviour agree. **Reachability is measured
before the fixture is written — OQ-5.**

**AC-13 — the two source registers move rather than widen.** `fanout.source.test.ts:44` requires the
folder to be **exactly two files** and `:48` exactly twelve exports; `git.source.test.ts:36` pins
twelve exports and `:49` refuses the historical ten. If any moves it is moved with the historical
value shown **refused**, which is the demonstration `git.source.test.ts` already writes for itself.
*Test:* the previous value asserted `.not.toEqual`, never `toContain`. `fanout.ts` may import
`../git/git.js` — `fanout.source.test.ts:135`'s allow-list already permits it — so the exit-status
reader may be shared rather than copied (OQ-4).

**AC-14 — no vocabulary widens, and no rendering changes.** `CONTAINMENT_REASONS` already holds
`'git failed'`; no reason set grows, `docs/GLOSSARY.md` gains no term, and no CLI output line, flag
or command is added. *Test:* `containment` and `pushLag`'s reason sets unchanged by identity; the
glossary's term list and `CLAUDE.md:13` byte-identical before and after (Q-0108's check).

**Fixture rule, binding on every criterion above.** Tests use repositories and failure conditions the
test itself creates. A verdict may not depend on the enclosing checkout, the operator's git
configuration, translated git prose, or a filesystem permission the environment may not support —
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30).
Where an unreadable-file fixture cannot be made deterministic on the current platform, **the git
invocation is injected or stubbed to return the same structured failure** rather than the platform
being made the oracle; and any test that needs a capability **probes for it and reports a skip**
naming what could not be staged, which is Q-0105's GO-3 repaired by hand after its gate.

---

## 5. Non-goals

- **NG-1 — the two `safe()` declarations are not unified into one shared helper.** `fanout.ts` keeps
  its own `git` runner on a recorded argument (`:199–202`: *"a port that exported it to save four
  lines would widen that module's surface for this one's convenience"*), and the same argument covers
  `safe()`. AC-3 registers the duplication; it does not remove it.
- **NG-2 — the eleven non-collapsing sites are not changed.** Turning every `safe()` into a tri-state
  is a change nobody asked for; §1 gives each its reason, with `configuredUser` as the worked example.
- **NG-3 — the path-truncation fix does not become a `git()` change.** AC-11 is not a `safe()` defect:
  it is the module-level runner's `.trim()`. Changing it would move all of that runner's callers'
  output and is refused here.
- **NG-4 — `resetBranchTo`'s stale-registration defect stays.** Site 19's neighbour — the route chosen
  from `fs.existsSync` alone, so a hand-deleted worktree directory wedges the branch — is
  `Why: preserved defect, see Q-0048 AC-12`, Q-0042 finding 5, and is not this ticket's.
- **NG-5 — `ensureWorktree`'s base fallback is registered, not repaired.** Site 3 cuts a worktree from
  `HEAD` when the declared base does not resolve. Q-0038's closing entry already names this a non-goal
  with its evidence — *"the implementer was not stopped by the missing ref; it was handed a worktree
  from somewhere else and paid to work in it"* — and its reasons: another module, it governs fan-out
  task bases too, and *throw, warn, or which callers* is unasked. It gains an AC-2 register row.
- **NG-6 — the two `--dry` mutations are struck from this ticket.** §6.2.
- **NG-7 — Q-0109's third case stays closed as unclosable.** A project root *below* a repository git
  refuses. Do not reopen without new evidence; the reasoning is in `git.ts:81–87`.
- **NG-8 — no repository-membership question becomes a general filesystem-existence question.** Any
  narrow inspection needed to tell a malformed `.git` from an absent one must be authorised by the
  entry (B-4) and belongs to the `git/` half regardless.
- **NG-9 — no retry orchestration, no automatic repair of a corrupt repository, no automatic conflict
  resolution, and no automatic rollback fallback when a head is unknown.**
- **NG-10 — no error message composes a remedy.** *"A `core` error names the condition; the remedy
  belongs to the surface"* (2026-09-07).
- **NG-11 — nothing else moves:** no flow YAML, adapter contract, event or trace format, gate
  behaviour, ticket frontmatter schema, exit code, new dependency, or API-key path. v1 exclusions
  hold by default.

---

## 6. Struck and routed — the two successors, written out in full

### 6.1 The `git/` half — a git probe that failed is never rendered as an answer

> **Five collapsing sites, and the only one in the census that reaches an adopter's screen.**
> `containment`'s branch list (`git.ts:345`) yields an empty `Set` on failure, so `stateOf` answers
> `no branch` for **every ticket on the board** — a state `docs/GLOSSARY.md` defines as *"git was
> never asked"*. Its base probe (`:342`) renders `missing ref` on a failure. `repositoryAt` (`:71`)
> collapses to a **boolean**, so `workTreeProbe` answers `'outside'` where the `.git` gitfile is
> malformed or unreadable and the board renders nothing — Q-0109's subject, registered by Q-0105's
> erratum E-1 as a residual rather than an unmet criterion (AC-3 there binds on *none of them
> reaches `pushed`*). `shortSha` (`:275`) collapses while its own JSDoc says it doubles as the
> engine's endpoint existence test. `ensureWorktree`'s base probe (`:143`) is registered and not
> repaired (NG-5 above).
> **The vocabulary already exists and the machinery is ten lines away**: `CONTAINMENT_REASONS`
> contains `'git failed'`, and `pushLag` (`:406–447`) discriminates at all four of its own sites in
> exactly the shape this owes. That is why this half is nearly mechanical.
> **`repositoryAt`'s JSDoc is part of the repair.** `git.ts:66` claims `--resolve-git-dir` *"can
> discriminate between them and absence"*, which is true of the git invocation and false of what
> `safe()` does with its failure. A criterion must say so — a comment claiming a discrimination the
> code discards is how this survived a cross-vendor review — and the guard proving doc and code agree
> must be **shown to have a subject**, which is Q-0111's lesson: its first needle matched nothing at
> all, including itself.
> **It owes no second decision entry**, inheriting Q-0074's; what it does owe is B-4's ruling, which
> must be settled in that same entry because it governs this half's design.
> **It must not reopen** Q-0109's third case (a project root below a repository git refuses), and it
> must not parse translated git prose or reimplement git's upward discovery walk.
> Roughly eight to ten criteria. It inherits AC-2's register and AC-3 if Q-0074 runs first, and lands
> them if it runs first itself.

### 6.2 `--dry` mutates the caller's ticket, and the counters are an alias

The ticket body carries two mutations `--dry` does not guard. Measured, they are **in-memory only**
and **pinned as deliberate**: `engine.ts:194` substitutes `readOnlyBacklog(backlog)` under dry so
nothing reaches disk, `lifecycle.ts:118` carries `Why: preserved defect, see Q-0050 AC-10`, and
`lifecycle.test.ts:228` pins the arrangement by name. **A criterion that breaks a landed preserved-
defect pin is a ruling, not a criterion** — which is why the Codex candidate's AC-12 is struck rather
than merged. They have nothing to do with `safe()`, with git, or with an unanswerable probe.

> **`--dry` mutates the caller's ticket, and the counters are an alias.** `finish()` sets
> `ticket.meta.iterations = context.counters` and advances `ticket.meta.stage` before its
> `if (!context.dry)` guard (`lifecycle.ts:118–122`), and `recordEvent` does the same at `:191`.
> `types.ts:215` documents the counters as *"the same object as `ticket.meta.iterations` — an alias,
> not a copy"*. Nothing reaches disk: `engine.ts:194` swaps in `readOnlyBacklog(backlog)` under dry,
> and `lifecycle.test.ts:228` pins that arrangement deliberately. **So this is bounded today to a
> caller that reuses the ticket object in-process, and there is exactly one such caller planned:
> M3's server**, which will hold a ticket across runs and answer `GET` requests from an object a
> `--dry` walk has just advanced. What it owes is not a fix but a decision about ownership: does
> `runFlow` receive a ticket it may mutate, or a copy it may not? The second is the cheap answer and
> it changes `lifecycle.test.ts:228`'s pin, which is why it wants a ruling rather than a patch.
> Its tests must retain references to the original ticket and iteration objects and assert them
> deeply unchanged after both a successful and a failed dry run — comparing serialised output after
> the run cannot see an alias. Strictly before Q-0013. Do not fold it into a git-probe ticket: the
> two share a file and nothing else.

---

## 7. Open questions

**B-1 (blocker, owner: human, at the gate) — the decision entry lands before a line of code.**
The ruling is *what does a caller do with "could not answer"*, and **no step on the chore route may
write a decision entry** (`harness/roles/developer-generalist.md:23`). This is the pattern that
exhausted Q-0070's loop at $8.31 and burned Q-0062's first three implement rounds — the eighth
appearance there, where the requirement had named the hazard in advance and was ignored. Next free
number is **088**. Do not launch until the entry is in `docs/decisions/` **and** `docs/DECISIONS.md`,
and verify it is present in the first implement step's prompt rather than assuming it, which is the
check Q-0097 lost two errata by not making.

The entry must state: (a) absence may be reported only where the operation produced evidence of
absence, and a failed or incomplete probe is represented separately and never inferred as a negative;
(b) the three accepted caller responses — stop with actionable work, continue with an explicit
uncertainty, retain best-effort suppression with a recorded reason; (c) the rule §1 yields, that
`safe()` is correct wherever the caller's question cannot tell the two inputs apart and wrong
wherever the caller acts differently on them; (d) B-2's answer; (e) B-4's answer.

**B-2 (blocker, owner: human, in the entry) — what does the rollback do when it cannot read a head?**
Three answers, and an implement step may take none of them:

- *(a) Reset anyway.* Impossible for the start-head case — there is no sha to reset **to**. For the
  current-head case it means resetting a branch whose position could not be verified.
- *(b) Do not reset; warn and record.* The run has already failed, so there is nothing left to stop;
  what is available is to keep the branch and say it may hold `integrate`'s merge.
- *(c) Today's behaviour: skip silently.* What the ticket exists to remove.

**Recommended: (b)**, on the asymmetry this repository has ruled twice — *the instrument may warn and
may never reassure*. It also preserves silence's present meaning, which is what AC-7 turns on. Stated
as a recommendation rather than decided: it changes what a failing run does with a branch.

**B-3 (blocker, owner: human, at the gate) — the split, and the distinction between which id owns
what and which half runs first.** Thirteen collapsing sites, ten consumers, four pins, two source
registers and an entry across two modules do not fit under fifteen criteria. Q-0091 and Q-0096 both
split at their gates, both at cost, and both bodies said afterwards the seam should have been drawn
first.

**Recommended: three tickets, seam at the module.**
1. **Q-0074 keeps the `fanout/` half** — §4's fourteen criteria. Not a preference: decision 062 cites
   Q-0074 against `branchExists`, `branchHead`, `commitAll` and `mergeInto` **by name**, and
   `composite.ts:17` says *"Q-0074 owns it"*. A landed entry is never edited.
2. **A successor takes the `git/` half** — §6.1, eight to ten criteria.
3. **A successor takes `--dry`/`TicketRecord` ownership** — §6.2, strictly before Q-0013.

**Which id owns which half and which half runs first are different questions, and separating them
dissolves the tension.** The `git/` half holds the only site that reaches an adopter's screen and is
nearly mechanical — the vocabulary exists, `pushLag` is the worked shape ten lines away — so there is
a good case for **running it first in time** while the ids stay as decision 062 requires. The entry
lands at this gate either way, so it is available to whichever runs first, and AC-2/AC-3 land with
that one.

**B-4 (blocker, owner: human, in the entry) — may a narrow filesystem inspection of the project
root's `.git` distinguish a malformed or unreadable gitfile from an absent one, or must that
distinction come from an injected or structured git operation alone?** It collides with *"Membership
is a git question, not a filesystem one"* (2026-08-28). **Q-0090's E-1 is the precedent for ruling
exactly that kind of scope question, and it ruled the entry did not govern** the case in front of it —
that entry argues from what turbo hashes, which has no analogue in *is this `.git` readable*. It
governs the `git/` half's design, so it must be settled in the same entry rather than left to the
successor's gate. Measure before choosing.

**OQ-5 (owner: implementer, measure before writing the fixture) — when is *"git reported no reason"*
actually reachable?** §0.2 establishes it is **not** reachable on a content conflict. It appears
reachable only where the conflict probe (site 23) also fails, or through `mergeFailure(null)`, whose
signature admits `null` and for which no caller was found. A criterion whose fixture cannot reach its
own case is the defect this repository keeps finding.

**OQ-6 (owner: implementer, measure before choosing) — where does the exit-status reader live?**
Reading git's exit status is what makes the third answer possible, and `git.ts` already has it
module-private: `errorProperty` accepting `'status'` (`:27`), `exitStatus` (`:37`), `GIT_FATAL`
(`:48`), `failureDetail` (`:115`). **`fanout.ts` has none of it** — its `errorProperty` (`:211`)
accepts only `'stderr' | 'message'`. Three options: a third copy in `fanout.ts` (refused — the shape
AC-3 exists to forbid), export from `git.ts` (permitted; `fanout.source.test.ts:135`'s allow-list
already contains `'../git/git.js'`, but it moves `git.source.test.ts`'s twelve-export register), or
into `@quorum/shared` (also allow-listed, but `shared` is declarations and constants and an error
reader is behaviour). **Recommended: export from `git.ts` and move the register per AC-13** — the one
option that adds no copy and no new home.

**OQ-7 (owner: implementer) — what TypeScript shape represents the third answer at each probe?** A
named union, `boolean | null`, a result object, or separate functions. This requirement does **not**
mandate one shared representation; it requires exhaustive caller handling and the behaviour above.
`workTreeProbe` (`'inside' | 'outside' | 'failed'`) and `resolvesToCommit` (`boolean | null`) are two
worked shapes in the same package, chosen per question rather than uniformly.

**OQ-8 (owner: human, one sentence in the entry) — is the ruling about a `catch` block or about a
habit?** The ticket body argues the second with evidence: *a failed probe read as a proven negative*
was committed twice by the operator in the three days before this run — Q-0068's merge triage grepped
for `Q-0066`, found nothing and read absence into it while an authority line had sat above the code
since 2026-08-26 under a different citation; and Q-0039's erratum E-1 narrowed a guarantee at two of
its three sites. Neither is a `safe()` call. **Recommended: one sentence, and no more** — a decision
entry rules on code, and a habit is what `harness/rules.md` is for. If it earns more than a sentence
it is a second entry.

---

## 8. Risks

- **R-1 — the fix widens one guard and leaves its twin.** `lifecycle.ts:136` and `:139` read a head at
  each end; widening `branchHead`'s return type closes the first and leaves the second testing
  `string | null` for truthiness. AC-7's matrix is what catches it; both rows shown red before green.
- **R-2 — a broad mechanical replacement turns best-effort cleanups into new fatal paths.** Making
  `merge --abort` or `branch -D` failures fatal would make a failed run *harder* to recover from. The
  per-site census (AC-2) is the control, and NG-2 is its boundary.
- **R-3 — an approve on the first pass should be distrusted.** 108 of 145 review verdicts here
  returned `revise`. Three of the four pins are rewrites of tests that currently assert the
  **opposite** of what they will assert, so a reviewer reading the diff without running it cannot tell
  a rewritten pin from a weakened one. Every rewritten pin is demonstrated red against the unfixed
  code, and no pin is closed by deleting, skipping, renaming away or weakening it (AC-4, AC-10, AC-11,
  AC-12).
- **R-4 — the register can be written so that it cannot fail.** AC-2 is the whole durable value of this
  ticket and is exactly the shape that has failed five times here: a scan blind to a spelling (Q-0067
  rounds 1–2), a fail-open list (Q-0051, Q-0108), an assertion satisfied by its own subject (Q-0111), a
  count standing in for an identity (Q-0073, Q-0107). Keyed from source, fails on an unclassified
  addition, mutation-tested with distinct signatures, and **no clause reads a total**.
- **R-5 — both source registers are `toEqual` over sorted key lists** (`git.source.test.ts:36`,
  `fanout.source.test.ts:48`). Exporting anything new fails them, which is the machinery working;
  AC-13 requires the move be demonstrated against the refused historical value rather than edited to fit.
- **R-6 — AC-9 changes `commitAll` on a path no test covers today**, and `commitAll` is on every
  code-writing step's exit. The refusal must be reachable **only** where the probe could not answer and
  never where `backlog/` is legitimately clean — the two are one character apart in today's `?? ''`.
- **R-7 — `pnpm install` before the suite.** An implement step's worktree has no `node_modules`;
  `commands.install` runs only in an `integrate` worktree. An uninstalled suite and a red suite are
  indistinguishable to a reviewer.
- **R-8 — the run cannot fully prove its own fix.** `runFlow` receives `config` at run start, so
  `integrate` exercises the **old** `commitAll` and `mergeInto`. Verification is forced, on `main`,
  after the merge, in both environment rows (Q-0072's closing finding).

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no credential, no `check()` path is touched, and no subscription-login refusal is weakened. |
| **Worktree safety** | Engaged. Site 3 (`ensureWorktree` base probe) is the one place a probe failure changes **where an agent writes**; registered under NG-5, not repaired. Nothing here writes to the user's working tree; `resetBranchTo` and `commitAll` operate inside `.harness/worktrees/`. |
| **Gate behaviour** | Unchanged. No gate, verdict vocabulary or exit code moves. `undecided`'s `runs.log` line gains a third rendering of `kept-at=` (AC-8) and keeps `rollback=none` and the absence of the `rolled-back` token (Q-0040 AC-5). |
| **File format and schema** | No format change. `PushLagResult`, `ContainmentResult`, `AncestryResult` and their closed sets are untouched, and `'git failed'` is already a member of two of them (AC-14). `TicketRecord` is unchanged — §6.2. |
| **Lint rules** | No flow-lint rule added; `quorum lint` unaffected; type-aware ESLint stays one rule. |
| **Cross-vendor rule** | Unchanged. |
| **Cold-clone impact** | **Improves it.** The board is on the first-30-minutes path and site 12 makes it misreport every ticket. No new command, flag, dependency, prompt or output line. |
| **Docs** | `docs/DECISIONS.md` gains one index line and `docs/decisions/088-*.md` the entry. No numbered doc changes: `04-architecture.md`'s `core` principles already require this and are not contradicted. `docs/GLOSSARY.md` gains nothing (AC-14). `harness/rules.md` gains at most one sentence if OQ-8 rules the habit worth stating, and `.claude/rules/` is its **derived copy** — the human's to sync, never a surface a criterion may name (2026-08-27). |
| **Product-agnostic** | Clean. No product name; fixtures use `T-0001`/`Q-` only. |
| **Errors are explicit** | The criterion this ticket is about. Thirteen sites default silently today; AC-4 to AC-12 remove that at the seven this half owns, and AC-2 registers the rest. |

---

## 10. Gate obligations

- **GO-1** — B-1's decision entry is written and indexed **before** the chore run starts, answering
  B-2, B-4 and OQ-8. Verify it is present in the first implement step's prompt rather than assuming it.
- **GO-2** — B-3's split is ruled at the gate. If the recommendation is not taken, this body is
  re-pointed **at the gate**, so decision 062's citation still reads true.
- **GO-3** — the two successors (§6.1, §6.2) are **opened as tickets at this gate**, from the bodies
  above, not left in a closing entry. Three obligations found orphaned in the week before this run
  (Q-0110's, Q-0111's, Q-0112's) each lived only inside a closed ticket's prose or a source comment.
- **GO-4** — verified in both environment rows, forced, on `main` after the merge; CI green on the
  merged commit. This is the ticket whose subject is *a probe read as a proven negative*, and a local
  green is a probe.
- **GO-5** — the closing entry records what the census found, including that the body's own
  re-measurement was right about 24 and did not name the two sites that matter most.

---

## 11. Provenance

**From the Claude candidate**, which is the base document: the census with per-site dispositions and
the two unnamed severe sites (`git.ts:345`, `fanout.ts:280`); the refutation of the body's
`mergeFailure` claim (§0.2); the ten-consumer enumeration including the two that write a false
sentence into a durable record (§0.3); the decision-062 binding that settles which id keeps which half
(§0.4); the finding that `lifecycle.test.ts`'s matrix already holds the two rows and reads them as
correct (§0.5); the observation that the answer is written in-tree three times and needs no new
vocabulary (§0.6); the struck `--dry` routing with a successor body; and most of §8.

**From the Codex candidate**: the three-name disposition vocabulary — *distinguish*, *propagate*,
*best-effort with a reason* — which is better than a two-way collapses/keeps split because it
separates a site that already discriminates from one that deliberately swallows; the rule that **no
criterion may depend on a historical site count**, which is the anti-rot property the census needs and
which the base candidate's AC-2 violated by asserting 24; the fixture rule that where a deterministic
failure cannot be staged the git invocation is **injected** rather than the platform made the oracle;
the diagnostic wording obligation that a message must not *say or imply* the ref is absent (AC-8);
that the census be generated from the implementation commit rather than copied; B-4 as a blocking
question in its own right rather than a footnote; NG-9's exclusion of retry orchestration and
automatic repair; and the framing that a search finding no evidence is not evidence of absence when
the search itself may have failed.

**Struck from the Codex candidate**, with reasons: its AC-12 (`--dry` must not mutate the in-memory
ticket) asks an implementer to break a landed preserved-defect pin — `lifecycle.ts:118` carries
`Why: preserved defect, see Q-0050 AC-10` and `lifecycle.test.ts:228` pins the arrangement by name —
which is a ruling, not a criterion, and is a different subject (`TicketRecord` ownership); routed to
§6.2. Its OQ-3 (should the census be enforced by a test, or live only in the solution report) is
**answered rather than carried**: the ticket's own evidence is that the census rotted in one day, so
it is executable (AC-2). Its scope covered both modules in one ticket, which §0.1's measured 13
collapsing sites put past the ceiling — hence B-3.

**Neither candidate had**: the verification that `installGitShim` already exists in
`packages/core/test/repo.ts` and is already used at two of the four pin sites (§0.8), which converts
the instrument risk from *build one* into *state its premise*; the reading of `git()`'s `.trim()` at
`fanout.ts:204` as the mechanism behind AC-11, which is what makes NG-3 a measurement rather than a
preference; and the separation of *which id owns which half* from *which half runs first* (B-3), which
is what lets decision 062's citation stay true while the board-visible half goes first.
