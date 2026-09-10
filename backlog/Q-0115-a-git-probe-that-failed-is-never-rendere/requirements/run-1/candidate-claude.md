# Q-0115 — A git probe that failed is never rendered as an answer

*Merged requirement, run 1. Every count, line number and classification below was re-derived against
the working tree — not transcribed from the ticket body, which asks in as many words not to trust
any table, and not carried from Q-0074's merged requirement, whose §6.1 this body is a copy of.
Where §6.1 and the tree disagree, the tree is recorded. Two measurements were taken by running git
rather than by reading about it.*

**Verdict: ready.** Twelve criteria. Five gate obligations in §9, of which GO-2 is a ruling this
document needs and cannot take for itself.

---

## 0. What the measurement changed

Four findings change the shape of the work. Two of them are corrections to this ticket's own body,
and one is a defect inside the instrument the ticket exists to build.

### 0.1 AC-2 and AC-3 have nothing to inherit, and this ticket must land them

The body says, twice: *"It inherits AC-2's census register and AC-3 rather than landing them, per
§6.1."*

Measured: **no census register exists.** `grep -rn "SAFE_SITES\|census" packages/*/src packages/core/test`
returns one line, `turbo-inputs.test.ts:1857`, about an unrelated literal census. Nothing under
`packages/` enumerates `safe()` call sites, classifies them, or fails when one is added.

The sentence is a faithful transcription of §6.1 — and §6.1 was written **under the assumption that
the `fanout/` half ran first**. Q-0074's §4 says so in as many words: *"AC-2 and AC-3 are the shared
artifacts: they cover both modules and land **once**, with this ticket."* Its **GO-2** anticipated
the reversal and ruled it in advance:

> **GO-2 — OQ-3's recommendation is ruled at the gate.** If the `git/` half is run first instead,
> this body is re-pointed **at the gate**, so decision 062's citation still reads true and
> **AC-2/AC-3 travel with the half that runs**.

The gate ruled the `git/` half runs first. So GO-2 fires and the body's inheritance sentence is
superseded by the same document it was copied out of. Under the body as written, this ticket ships
with no register at all, Q-0074 lands one later over sites this ticket has already changed, and for
the whole interval the register's only purpose — *a new `safe()` site fails until somebody classifies
it* — is absent from the tree.

This is the requirement's single most consequential correction, and it is why there are twelve
criteria rather than the eight to ten §6.1 estimated: **nine are the git work, two arrive from GO-2,
and one is an obligation decision 088 created and assigned to nobody** (§0.4). The gate may rule
otherwise; GO-2 below says exactly what is struck if it does.

### 0.2 The census predicate has a blind spot, and it is inside the headline function

Q-0074's census enumerates **`safe()` call sites**. Measured in `git.ts`, that predicate finds 16 —
lines 71, 139, 143, 157, 174, 197, 213, 275, 298, 299, 342, 345, 360, 416, 426, 441, all unmoved
since that run.

It also **misses six hand-written `catch` blocks in the same file**, and one of them collapses:

| line | in | what it does with a caught git failure |
| --- | --- | --- |
| 93 | `workTreeProbe` | distinguishes — three answers, `'failed'` among them |
| 106 | `resolvesToCommit` | distinguishes — `false` only on git's own exit 1, `null` otherwise |
| 248 | `ancestry` | distinguishes — `git failed` on any exit that is not 1 |
| 266 | `shallowState` | distinguishes — `shallow: null` with the detail |
| **339** | **`containment`'s work-tree probe** | **collapses — `catch { return null; }`** |
| 457 | `ensureExcluded` | best-effort, and it warns |

So a census of *what a caught git failure becomes* covers **22 sites in `git.ts`, not 16**, and the
one the `safe(`-keyed predicate cannot see is in the function whose defect is this ticket's headline.

What `containment:339` does is the same defect `pushLag`'s **round-1 review already found and fixed**
on the sibling function, called on the same `quorum board` invocation. `git.test.ts:794–797` records
it in the code's own words:

> *"a probe that could not answer used to be returned as `null` and rendered as silence, which for a
> fact whose success output is silence is a clean bill of health nobody earned. `null` is now
> reachable only from git's own 'there is no repository here'."*

`containment` still returns `null` for both. `board.ts:204` reads `where?.stateOf(…)`, so `null`
makes `spot` undefined, and **every ticket on the board renders with no containment token at all** —
silently, and indistinguishably from a directory that is not a repository. `git.test.ts:143` pins
`containment(notARepo(), 'main')` as `null`, which is correct for absence and is the whole of the
coverage; the failure case has none.

**AC-2's predicate is therefore *a git invocation whose failure is caught*, never *a call to
`safe()`*.** A register keyed on the primitive is a register that cannot see the site that most
needs it, and a register that cannot see its subject is the shape this repository has shipped five
times (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108).

### 0.3 The git half's pin of its own defect is unlabelled, and a search for a citation finds nothing

Q-0074's §0.3 found that the four `fanout/` pins cite `Q-0048` and `Q-0053` rather than `Q-0074`, so
an implementer who searches for the ticket id finds one line in the package and concludes the pins
are not there — *a failed search read as proven absence*, this ticket's subject inside its own
instrument. Its AC-1 answers that by naming the **citation tokens** instead of the id.

**In the `git/` half that remedy does not reach, because there are no citation tokens.** Measured:

- `grep -n "Why:" packages/core/src/git/git.ts` returns **six** lines — 4, 122, 168, 188, 234, 459 —
  and **not one of them sits at 71, 143, 275, 342 or 345.** The five collapsing sites carry no
  authority line of any kind. Nothing in `git.ts` records that any of them is a preserved defect.
- The one place the collapse **is** pinned is a live test with no label:
  `git.test.ts:406–408`, titled *"a ref that does not resolve is null, and so is a directory git
  cannot read"*, asserting `shortSha(repo(), 'no/such/ref')` and `shortSha(notARepo(), 'main')` are
  both `null` — the two answers asserted equal, in one test, with no `Why:` line and no ticket id.

So an implementer told to find the pins this change removes finds them by neither id nor token, and
the honest instruction is **file and line**. AC-1 is re-shaped accordingly. This is the same trap in
a second shape, and it is worth stating plainly: *in the `fanout/` half the pins point at the wrong
ticket; in the `git/` half they do not point at all.*

### 0.4 Decision 088 landed, answered OQ-4, and left one obligation with no owner

Verified: `docs/decisions/088-a-probe-that-could-not-answer-is-not-a-negative.md` exists and
`docs/DECISIONS.md` indexes it under 2026-09-10. **No second entry is owed** and this ticket writes
none.

It answers OQ-4 with a stated bound — the inspection *"may separate **absent** from **present but
unreadable or unparseable**, and nothing else"* — and it names `git.ts:345` and `git.ts:143` in its
own **Why** section, so the entry is itself a citation source for two of this ticket's sites.

It also creates an obligation and assigns it to nobody:

> *"that a measurement which failed to look is not a measurement that found nothing belongs in
> `harness/rules.md`, and if it earns more than a sentence it earns its own entry."*

Q-0074's §9 checklist claims that row (*"`harness/rules.md` gains at most one sentence"*), and
Q-0074 now runs second. An obligation carried by the ticket that runs later is one that waits, and
three obligations found orphaned in the week before this run (Q-0110's, Q-0111's, Q-0112's) is why
this document does not leave it. **AC-12 lands the sentence here**, and GO-2 is where the gate may
send it back.

Measured while checking whether it is writable: `harness` **is** in `developer-generalist`'s `paths:`
(`harness/roles/developer-generalist.md:2`), so an implement step may write `harness/rules.md`.
`.claude/rules/engineering.md` is the derived copy, outside those paths, and **nothing checks the two
against each other** — `grep -rln "claude/rules" packages/` returns four files and none compares
them. So the sync is the human's, by the Q-0069 AC-11(b) route, and it is GO-4.

### 0.5 git's exit code cannot make the distinction OQ-4 is about — measured, not read

`repositoryAt`'s JSDoc rests on `--resolve-git-dir` answering while a repository is unopenable. Run
against git **2.55.0**, the version this workspace is on:

| invocation | exit | stderr |
| --- | --- | --- |
| `git rev-parse --resolve-git-dir /nonexistent-xyz/.git` | **128** | `fatal: not a gitdir '…'` |
| `git rev-parse --resolve-git-dir CLAUDE.md` | **128** | `fatal: invalid gitfile format: CLAUDE.md` |
| `git rev-parse --resolve-git-dir .git` | 0 | — |

**Absent and malformed spend the same exit code and differ only in prose** — and prose is translated,
which `git.ts:66–68` already says may never decide a state. So the narrow filesystem inspection
decision 088 authorises is not a convenience chosen over a git-native alternative: **there is no git
answer that discriminates these two, and that is why the entry rules the way it does.** Measure it
again before writing the fixture rather than trusting this table; that is what this section is
demonstrating.

### 0.6 The answering shape is in the same file, and the landed cost pin survives it

`workTreeProbe` (`git.ts:91–97`) is exactly the discrimination `containment`'s probe owes, and its
JSDoc already states the property that makes it affordable: *"The second work-tree probe does not
raise that ceiling: it is reached only where git has already given up."*

This matters because `git.test.ts:315` pins the cost **exactly**: `expect(calls).toBe(3)`, not a
ceiling. A fix that adds a probe to `containment`'s happy path turns a landed guard red. A fix
shaped like `workTreeProbe` — one combined `rev-parse`, and a second question only after a fatal —
keeps three. §6.1's claim that this half is *nearly mechanical* holds, and this is the measurement
behind it.

### 0.7 `shortSha`'s collapse stops runs with a sentence that names the wrong subject

Two consumers, both in `packages/core/src/engine/diff.ts`, both non-test:

- **`:285`** — step time. `const sha = { left: shortSha(…), right: shortSha(…) }`, then
  `if (sha[side] != null) continue;` and `throw missingEndpointFailure(…)`.
- **`:457`** — the **run-level preflight**.
  `if (endpoint.class !== 'pre-existing' || shortSha(context.repoDir, endpoint.ref) != null) continue;`
  then the same throw.

`missingEndpointFailure` (`diff.ts:235–253`) composes one of three sentences, all of which assert
absence: `input.diff names missing ref "<ref>"`, `repo.base_branch in harness/harness.yaml names
missing ref "<base>"`, and `--base names missing ref "<ref>"`.

So a git that fails at run start **stops the run and blames the operator's configuration, the
`--base` flag they typed, or an earlier step, for a ref that may be perfectly present.** That
narrows the fix usefully: under decision 088 a caller whose next action is unverifiable **may**
stop (response 1), and stopping is right here. **What is wrong is the claim, not the stop** — so
AC-9 changes the sentence and the state and leaves the control flow alone.

### 0.8 What held

- The census's 24 sites are unmoved: 16 in `git.ts` at the lines above, 8 in `fanout.ts` at 224,
  239, 256, 280, 283, 284, 316, 317. `safe()` is declared byte-for-byte twice, `git.ts:19–21` and
  `fanout.ts:206–208`, and nowhere else under `packages/*/src`.
- `CONTAINMENT_REASONS` is `['missing ref', 'shallow clone', 'git failed', 'no branch']`, pinned at
  `git.source.test.ts:133`. **`git failed` is already a member**, so no vocabulary widens.
- `git.source.test.ts:40` pins twelve exports with `toEqual`; `:47–58` refuses the ten held before
  Q-0105; `:79–80` pins the barrel at `['configuredUser', 'containment', 'pushLag']`. `shortSha` is
  exported from the module and **not** on the barrel, so its shape is internal to `packages/core`.
- The instrument exists. `installGitShim` and `counting` (`packages/core/test/repo.ts:116`) are
  already aimed at `containment` at `git.test.ts:219` and at `pushLag` throughout
  `git.test.ts:790–845`. **Nothing new is built.**
- `board.ts:107` `ALWAYS_RENDERED`, `:117` `BRANCH_EXPECTED`, `:122` `token`, `:195` the
  `containment` call, `:204–208` the suppression and the legend arming, `:231` `pushLag`.
- `q0050.source.test.ts:227` registers `diff.ts`'s **ordered** authority-line sequence at five
  entries — a constraint on AC-9 (R-5).
- `backlog.source.test.ts:164` holds `REALPATH_SITES`, the register shape AC-3 copies, and its own
  comment names *"the shape Q-0074 is open on — one primitive declared twice, with nobody's
  attention on either copy."*

---

## 1. The census, re-derived

Predicate: **does the call site distinguish a caught git failure from a legitimate value, or does it
merge the two into one claim?** Disposition vocabulary is Q-0074's three names — *distinguish*,
*propagate*, *best-effort with a recorded reason* — because a two-way split hides the difference
between a site that already discriminates and one that deliberately swallows.

`packages/core/src/git/git.ts`, all 22 sites where a git failure is caught. Rows marked ● are this
ticket's.

| # | line | in | what a failure becomes | disposition |
| --- | --- | --- | --- | --- |
| 1 ● | 71 | `repositoryAt` | `!= null` → `false`, returned as a **boolean**, so `workTreeProbe` answers `'outside'` for a `.git` it could not read | **collapses** |
| 2 | 139 | `ensureWorktree` branch probe | branch read as absent → `worktree add -b` → git throws | collapses, **fails loudly** — NG-4 |
| 3 | 143 | `ensureWorktree` base probe | base ignored → **worktree cut from `HEAD`** | **collapses, silent** — NG-3, register only |
| 4 | 157 | `removeWorktree` `branch -D` | discarded | best-effort |
| 5 | 174 | `mergeBase` | `null`; its JSDoc says it deliberately does not tell them apart | documented |
| 6 | 197 | `currentBranch` | `null`, as does `''` | documented |
| 7 | 213 | `configuredUser` | `null` → caller writes `unknown` (Q-0112) | documented — the entry's worked example |
| 8 ● | 275 | `shortSha` | `null`, while both consumers read it as *the ref does not resolve* | **collapses** |
| 9 | 298 | `emptyRangeEvidence` left tree | `sameTree: null` | distinguishes |
| 10 | 299 | `emptyRangeEvidence` right tree | `sameTree: null` | distinguishes |
| 11 ● | 342 | `containment` base probe | `!= null` → `false` → renders `missing ref` | **collapses** |
| 12 ● | 345 | `containment` branch list | `?? ''` → empty set → **every ticket renders `no branch`** | **collapses** |
| 13 | 360 | `containment` ahead count | `== null` → `git failed` | distinguishes |
| 14 | 416 | `pushLag` remotes | `== null` → `git failed` | distinguishes |
| 15 | 426 | `pushLag` tracking | `== null` → `git failed` | distinguishes |
| 16 | 441 | `pushLag` ahead count | `== null` → `git failed` | distinguishes |
| 17 | 93 | `workTreeProbe` | `'failed'`, a third answer | distinguishes |
| 18 | 106 | `resolvesToCommit` | `null` on anything but git's own exit 1 | distinguishes |
| 19 | 248 | `ancestry` | `git failed` on any exit that is not 1 | distinguishes |
| 20 | 266 | `shallowState` | `{ shallow: null, detail }` | distinguishes |
| 21 ● | **339** | **`containment` work-tree probe** | `catch { return null; }` → **every ticket renders no token, silently** | **collapses — and no `safe()` census can see it** |
| 22 | 457 | `ensureExcluded` | `console.warn` naming the file and the message | best-effort, recorded |

**Six collapse in `git.ts`.** §6.1 named five; row 21 is the sixth and is new to this run. Rows 2, 3
and 8's neighbours are registered rather than repaired for the reasons in §5.

**No criterion below reads a total.** The census rotted once already — 23 on 2026-09-07, 24 on
2026-09-08 — and it has now rotted a second time in the other direction, by changing what counts as
a site. A register that asserts over a count is a register that a correct addition turns red.

---

## 2. Problem

**`adopter` — the first command tells them none of their work exists.** `quorum board` is among the
first commands a stranger runs. `containment`'s branch list (`git.ts:345`) yields an empty `Set` on
failure, and `stateOf`'s **first** clause is
`if (!branches.has(branch)) return { state: 'indeterminate', reason: 'no branch' }`. So **one failed
`for-each-ref` makes the board answer `no branch` for every ticket in the backlog** — a state
`docs/GLOSSARY.md` defines as *"the ticket naming a branch that does not exist, so git was never
asked."* Git was asked, and failed. The comment directly above that clause argues at length that
this state must not be confused with *no question was asked*; the line beneath it does exactly that.
The vocabulary for admitting it, `git failed`, already exists in the same file and the code cannot
reach it. *(CLI, `core`)*

**`adopter` — and when git is broken outright, the board says nothing at all.** `containment`'s own
work-tree probe (`git.ts:339`) returns `null` for a git that could not run, which is the same answer
it gives for a directory that is not a repository, so every row loses its token in silence. This is
the defect `pushLag` had until its round-1 review, left standing on the sibling fact of the same
invocation. *(CLI, `core`)*

**`adopter` — a `.git` git cannot read is reported as no repository at all.** `repositoryAt`
(`git.ts:70–72`) collapses to a boolean, so `workTreeProbe` answers `'outside'` where the gitfile is
malformed or unreadable, and `pushLag` then renders **nothing** — which for a fact whose success
output is silence is the clean bill of health nobody earned. That is Q-0109's subject, registered by
Q-0105's erratum E-1 as a residual rather than an unmet criterion. Measured, git spends exit 128 on
both cases and differs only in translated prose (§0.5), so the code cannot recover the distinction
from git and decision 088 rules that it need not try. *(CLI, `core`)*

**`maintainer` — a run stops and blames the wrong thing.** `shortSha` (`git.ts:275`) collapses while
both of its consumers read `null` as *the ref does not resolve*, and the run-level preflight
(`diff.ts:457`) then throws a sentence asserting that `repo.base_branch`, `--base` or an earlier
step named a ref that is not there. A maintainer reading *"names missing ref"* goes to
`harness/harness.yaml` to fix a value that was never wrong. *(`core`, CLI)*

**`contributor` — the comment teaches the opposite of the code.** `repositoryAt`'s JSDoc argues that
`--resolve-git-dir` is *"the only probe measured here that answers while the repository is
unopenable … which is precisely why it can discriminate between them and absence"*, and the next
line throws that discrimination away. A comment claiming a discrimination the code discards is how
this survived a cross-vendor review. *(`core`)*

**`contributor` — and the register that would have caught all of it does not exist yet.** Nothing
enumerates these sites, so the next `safe()` or `catch` added to `git.ts` is classified by nobody,
and the census is re-derived by hand every time somebody asks. *(`core`)*

**Why it stops being latent.** A run reaching this code has already spawned git several times, so
the probability is low today and the observer is a human at a terminal. The **board defect is not
latent now** — it needs one failed `for-each-ref` and it reaches an adopter's screen on the
cold-clone path. M3 removes the observer for the rest: a server hosts these functions and surfaces
their answers over HTTP.

---

## 3. User stories

- As an **`adopter`**, when a git probe behind `quorum board` fails, I want the board to say it
  could not answer rather than that my branches do not exist, so that a broken git looks like a
  broken git and not like lost work. *(CLI, `core`)*
- As an **`adopter`**, when the repository's `.git` is present but unreadable, I want the board to
  say so rather than render the silence it renders for a directory that is not a repository, so
  that silence keeps exactly one meaning. *(CLI, `core`)*
- As a **`maintainer`**, when a run stops because an endpoint could not be resolved, I want the
  message to distinguish *the ref is not there* from *git could not answer*, so that I fix the
  condition that actually exists instead of a configuration value that is already correct.
  *(`core`, CLI)*
- As a **`contributor`**, I want each caught git failure in `packages/core` to carry a recorded
  disposition and a reason, and a register that fails when a new one is added unclassified, so that
  the next author asks what their caller does with the answer instead of reaching for `safe()`.
  *(`core`)*
- As a **`contributor`**, I want a comment above a probe to describe what the function delivers
  rather than what the git invocation could have delivered, so that reading the module is not
  misleading. *(`core`)*

---

## 4. Acceptance criteria

**Twelve.** AC-1 to AC-9 and AC-11 are the `git/` work §6.1 estimated at eight to ten; **AC-2 and
AC-3 arrive from Q-0074's GO-2** (§0.1); **AC-12 is decision 088's own unassigned obligation**
(§0.4). GO-2 below is where the gate strikes the last three if it disagrees.

**AC-1 — the ruling is cited, never transcribed, and the pin is named by file and line.** Every
behaviour below traces to *"A probe that could not answer is not a negative"* (2026-09-10). No source
file restates its reasoning; a site that deliberately retains a collapsing read carries **one line**
naming the authority, per `.claude/rules/engineering.md`. **The pin this change rewrites is
`packages/core/src/git/git.test.ts:406–408` — named by file and line, because it carries no `Why:`
line and cites no ticket, and none of `git.ts`'s six `Why:` lines sits at any of the six collapsing
sites (§0.3).** A criterion, comment or report telling a reader to find these by a ticket id or a
citation token is instructing this ticket's own defect. *Test:* a source scan asserting no file under
`packages/core/src/git/` or `packages/core/src/engine/` contains a sentence of the entry's body; that
every site AC-2 classifies as retaining its collapse carries a one-line citation; **and the scan is
shown to have a subject — its needle must match something in the tree today**, which is Q-0111's
lesson, where the first needle matched nothing at all including itself.

**AC-2 — the census is an executable register, landed here, keyed on caught git failures.** A test
enumerates every site under `packages/core/src` where a git invocation's failure is caught — **both
`safe()` call sites and hand-written `catch` blocks**, because keying on `safe(` alone misses six
sites in `git.ts` and one of them collapses (§0.2) — and requires each to carry one of
`distinguish` | `propagate` | `best-effort` and a one-sentence reason. An unclassified site
**fails**. *Test:* adding a `safe()` call to either module fails by name; adding a bare
`catch { return null; }` fails by name; deleting a classified site fails; the disposition is
recomputed from each site's own text so a hand edit cannot contradict the tree. **No assertion reads
a total.** Shown red by mutation with **distinct signatures for the two halves of the predicate**,
so a register that has silently lost the `catch` half cannot pass on the `safe()` half — that is the
failure this criterion exists to prevent, demonstrated rather than described.

**AC-3 — `safe()` is declared twice and a third is a visible act.** Both declarations
(`git.ts:19–21`, `fanout.ts:206–208`) are registered by identity, each with the reason its module
keeps its own, in the `REALPATH_SITES` shape at `backlog.source.test.ts:164`. *Test:* a third
declaration anywhere under `packages/*/src` fails; the register is an identity map and not a count
(Q-0073); `constants.ts:98`'s unrelated `safeId` is shown **not** to satisfy it. Not unified into one
shared helper — NG-1.

**AC-4 — `containment` never answers `no branch` for a branch list it could not read.** Where
`git.ts:345`'s `for-each-ref` fails, `stateOf` answers `{ state: 'indeterminate', reason: 'git
failed' }` for every branch it is asked about, and never `no branch`, which the glossary defines as
*git was never asked*. *Test:* `installGitShim('case " $* " in *for-each-ref*) exit 3 ;; esac')` over
a repository holding a real branch; **demonstrated red first**, where today it answers `no branch`
for a branch that is on disk. The honest and the dishonest answers are asserted **unequal**, not
merely each asserted — a fixture that only checks the new value cannot tell a fix from a rename.

**AC-5 — `containment` never answers `missing ref` for a base probe that failed.** Where
`git.ts:342` fails, the answer is `git failed`, not `missing ref`. *Test:* the shim fails **only**
`rev-parse --verify --quiet refs/heads/<base>^{commit}` by matching the whole argv, in the
`FAILING_PROBES` shape at `git.test.ts:817–828` — breaking `rev-parse` wholesale stops at the
work-tree probe and gives this clause no subject, which is the trap that criterion's own comment
already names. **Independently red from AC-4**, because `stateOf` tests the branch list *first*: a
fixture that breaks both cannot show this clause fires at all (OQ-6).

**AC-6 — `containment` distinguishes *there is no work tree here* from *git could not answer*, and
`null` keeps exactly its present meaning.** `git.ts:338–339`'s bare catch is replaced by the
discrimination `workTreeProbe` already performs in the same file. `null` becomes reachable **only**
from git's own answer that there is no work tree, which is `pushLag`'s rule at a second site;
`git.test.ts:143`'s pin of `containment(notARepo(), 'main') === null` is **unchanged in verdict**.
*Test:* a repository git refuses to open (`core.repositoryformatversion 99`, the fixture at
`git.test.ts:697–700`) and a git that cannot run each produce an answer, not `null`; the plain
directory still produces `null`; **`git.test.ts:315`'s `expect(calls).toBe(3)` is unchanged**, the
second probe being reached only after git has already given up (§0.6). Demonstrated red against
today's code, where all three answer `null`.

**AC-7 — an absent `.git` and one that could not be read are told apart, within decision 088's
stated bound.** `repositoryAt` stops collapsing to a boolean, and where `--resolve-git-dir` fails a
**narrow filesystem inspection of `<repoDir>/.git`** separates *absent* from *present but unreadable
or unparseable* — and nothing else. `workTreeProbe` then answers `'failed'` for the second, so
`pushLag` reports `git failed` rather than the silence it renders today. *Test:* a `.git` that is a
file of garbage, and a `.git` directory git refuses, each reach `git failed`; a directory with no
`.git` at all is still `outside` and still silent; **the inspection is shown not to be a
general-purpose repository test** — it decides no ref's existence, no path's membership and no
repository's boundary (NG-7). The **dangling-link case is covered explicitly**: a `.git` symlink
whose target is absent must not read as absence, which is the shape that made Q-0059's `write`
create a file outside its ticket folder (OQ-5).

**AC-8 — `repositoryAt`'s comment says what the function delivers, and the guard has a subject.**
`git.ts:59–69`'s claim that `--resolve-git-dir` *"can discriminate between them and absence"* is
made true by AC-7, or corrected; the JSDoc's residual-limit paragraph at `:84–89` is re-stated
against what now holds, and it still says that a project root **below** a refused repository reads as
absence (NG-5). *Test:* the doc-versus-code agreement is asserted, **and the assertion is shown to
have a subject** — it must fail against today's text as well as against a mutated fix, which is
Q-0111's lesson and the reason `git.test.ts:406`'s title, `repositoryAt`'s JSDoc and this criterion
are all quoted rather than paraphrased.

**AC-9 — `shortSha` distinguishes, and no diagnostic names a missing ref it did not prove absent.**
`shortSha` tells *the ref does not resolve* from *the probe could not answer*, and both consumers in
`diff.ts` handle the third answer. Where the probe could not answer, the run **still stops** —
decision 088's response 1, a caller whose next action would be unverifiable — and the sentence names
the condition rather than asserting absence: not `input.diff names missing ref`, not
`repo.base_branch in harness/harness.yaml names missing ref`, and not `--base names missing ref`. The
message composes **no remedy** (NG-8). *Test:* the shim fails
`rev-parse --verify --quiet --short <ref>` at each consumer in turn — `diff.ts:285` and the run-level
preflight at `:457` **separately**, because one fix can close either and leave the other; the three
`missing ref` sentences are asserted **absent** from the failure; `git.test.ts:406–408` is
**rewritten in place**, its two assertions no longer claiming the same answer, and shown red first.

**AC-10 — the board renders the honest state, and no suppression rule is invented.** `board.ts:205`
suppresses `no branch` outside `BRANCH_EXPECTED`; nothing suppresses `git failed`, and nothing
gains a rule that does. So a repository whose `for-each-ref` fails renders
`<base>:indeterminate(git failed)` on **every** row including `draft` — where today those rows render
nothing — and `anyIndeterminate` arms the existing legend, which already names *"a failed git
command"*. That is this requirement's position, taken rather than asked (OQ-2): `no branch` is
suppressed because it is *expected* for most tickets, and `git failed` is never expected;
`containment` already renders it per row from `:360`. *Test:* a board over tickets at mixed stages
with the shim installed; every row carries the token, the legend prints once, **`quorum board` exits
0**, and no new legend, line, flag or command appears.

**AC-11 — no vocabulary widens, and no register is edited to fit.** `CONTAINMENT_REASONS`,
`PUSH_LAG_REASONS`, `ANCESTRY_REASONS`, `CONTAINMENT_STATES` and `PUSH_LAG_STATES` are unchanged by
identity; `docs/GLOSSARY.md` and `CLAUDE.md:13`'s term list are byte-identical before and after
(Q-0108's check). Any register that does move — `git.source.test.ts:40`'s exports, `:79` the barrel,
`q0050.source.test.ts:227`'s ordered `diff.ts` authority sequence — is moved by asserting its
previous value **`.not.toEqual`**, never by editing the literal and never with `toContain`, which is
the demonstration `git.source.test.ts:47–58` already writes for itself. *Test:* the closed sets by
identity; each moved register shown refusing its predecessor.

**AC-12 — the habit the entry ruled on is written down once, where the entry says it belongs.**
`harness/rules.md` gains **one sentence**: a search, grep or probe that failed to look is not a
measurement that found nothing, citing *"A probe that could not answer is not a negative"*
(2026-09-10) by title and date. No more than a sentence — the entry says a longer treatment earns its
own entry, and this ticket writes none. *Test:* the sentence is present, cites the entry by title and
date rather than by file name or number, and `harness/rules.md`'s existing rules are unchanged.
`.claude/rules/engineering.md` is the **derived copy** and is **not** named by this criterion —
outside the implementer's paths, the human's to sync (2026-08-27), and GO-4.

**Fixture rule, binding on every criterion above.** Tests use repositories and failure conditions the
test itself creates. A verdict may not depend on the enclosing checkout, the operator's git
configuration, translated git prose, or a filesystem permission the environment may not support —
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30).
Where a deterministic failure cannot be staged, the git invocation is shimmed to return the same
structured failure rather than the platform being made the oracle; any test needing a capability
**probes for it and reports a skip** naming what could not be staged, which is Q-0105's GO-3 repaired
by hand after its gate. Every shim fixture is built **before** the shim is installed —
`git.test.ts:790–793` records why: a fixture's own `git` runs under the mutation otherwise, which is
a broken fixture wearing a failed assertion's clothes.

---

## 5. Non-goals

- **NG-1 — the two `safe()` declarations are not unified.** `fanout.ts` keeps its own runner on a
  recorded argument (`:199–202`), and the same argument covers `safe()`. AC-3 registers the
  duplication; it does not remove it.
- **NG-2 — the fourteen non-collapsing sites are not changed.** §1 gives each its reason, with
  `configuredUser` (row 7) as decision 088's own worked example of the correct case.
- **NG-3 — `ensureWorktree`'s base probe (`git.ts:143`) is registered, not repaired.** Q-0038's
  closing entry already names it a non-goal with its evidence and its reasons: another module, it
  governs fan-out task bases too, and *throw, warn, or which callers* is unasked. It gains an AC-2
  row and nothing else, even though decision 088 names it.
- **NG-4 — `ensureWorktree`'s branch probe (`git.ts:139`) is not repaired.** It collapses and then
  **fails loudly**: `worktree add -b` throws on an existing branch, so no false claim survives the
  call. AC-2 row, nothing else.
- **NG-5 — Q-0109's third case stays closed as unclosable.** A project root *below* a repository git
  refuses. Do not reopen without new evidence; the reasoning is `git.ts:84–89` and it is preserved
  verbatim in AC-8's re-statement.
- **NG-6 — no `fanout/` site changes, and `exitStatus` is not exported for `fanout.ts`'s benefit.**
  That is Q-0074's OQ-6 and its AC-13, and doing it here moves `git.source.test.ts:40`'s export
  register for a consumer that does not exist yet.
- **NG-7 — no repository-membership question becomes a general filesystem question.** AC-7's
  inspection separates absent from present-but-unreadable and nothing else, per decision 088's stated
  bound. It may not decide whether a path is inside a repository, whether a ref exists, or whether a
  file is tracked.
- **NG-8 — no `core` error composes a remedy.** *"A `core` error names the condition; the remedy
  belongs to the surface"* (2026-09-07).
- **NG-9 — no new command, flag, output line, legend or exit code**, and no change to gate behaviour,
  flow YAML, adapter contract, event or trace format, ticket schema, or dependency set.
- **NG-10 — no retry orchestration, no automatic repair of a corrupt repository, no parsing of
  translated git prose, and no reimplementation of git's upward discovery walk.**
- **NG-11 — `mergeBase`, `currentBranch` and `configuredUser` keep their documented collapses.** Each
  states in its own JSDoc that it deliberately does not tell the two apart, and each is a caller whose
  question cannot tell them apart — the entry's rule applied, not waived.
- **NG-12 — Q-0116 is not folded in.** `--dry` mutating the caller's ticket shares a file with
  nothing here and a subject with nothing here; its body says so in as many words.
- **NG-13 — no second decision entry.** This ticket inherits 088 and writes none. The v1 exclusions
  hold by default.

---

## 6. Open questions

**None blocks this document.** One is a ruling the gate takes (GO-2), two are positions this
requirement **states** rather than asks, and three are measurements the implementer takes.

**OQ-1 (gate, owner: human — GO-1) — is the entry in the implement step's prompt?** The entry is
landed and indexed, verified this run, so no writing is owed. What **is** owed is the check Q-0097
lost two errata by not making: confirm decision 088 appears in the first implement step's prompt
rather than assuming it does. This is the obligation whose omission has cost real money three times
(Q-0062, Q-0070, Q-0101).

**OQ-2 (stated, not asked) — what the board looks like once `containment` is honest.** Position:
`git failed` renders on **every** row at every stage, and no suppression rule is invented (AC-10).
Grounds, measured rather than preferred: `board.ts:205` suppresses `no branch` because a ticket
naming a branch nothing created is the ordinary case, which `git failed` never is; `containment`
already renders `git failed` per row from `:360`, so a per-row rendering is the file's existing
behaviour rather than a new one; and the alternative — a repository-level legend on push lag's model —
would answer a per-ticket question with a repository-level fact, which is the confusion the two
functions exist separately to avoid. The gate may overrule; if it does, AC-10 moves and nothing else
does.

**OQ-3 (stated, not asked) — the run stops when `shortSha` cannot answer.** Position: it does, and
only the claim changes (AC-9). Decision 088 admits three caller responses and this caller's next
action — materialising a diff and reviewing against it — is unverifiable without the endpoint, which
is response 1. Making it continue would be a behaviour change nobody asked for on the engine's most
load-bearing preflight.

**OQ-4 (owner: implementer) — what TypeScript shape carries the third answer at each probe?** Not
mandated. Two worked shapes already sit in this file and were chosen per question rather than
uniformly: `WorkTreeProbe`'s named union (`git.ts:50–57`) and `resolvesToCommit`'s `boolean | null`
(`:104–107`). What is required is exhaustive caller handling and the behaviour above, not one shared
representation. `shortSha` is **not** on the barrel (`git.source.test.ts:79–80`), so its shape is
internal to `packages/core` and moves no public surface.

**OQ-5 (owner: implementer, measure before choosing) — what does AC-7's inspection actually call?**
`fs.existsSync` **follows symlinks and answers `false` for a dangling one**, which would reintroduce
the collapse at the one site that most looks like it has been fixed — the shape that made Q-0059's
`write` create a target outside its ticket folder, found by a reviewer rather than by its author.
`lstatSync` sees the link itself. Measure both against a `.git` that is a dangling symlink, a file of
garbage, a directory git refuses and an absent path, and record the four answers before writing the
fixture.

**OQ-6 (owner: implementer, measure before writing the fixture) — is AC-5's clause independently
reachable?** `stateOf` tests the branch list **first** (`git.ts:354`) and the base **second**
(`:355`), so a fixture that breaks `rev-parse` wholesale never reaches the base clause and a fixture
that breaks `for-each-ref` never needs it. The `FAILING_PROBES` pattern at `git.test.ts:817–828`
matches a whole argv for exactly this reason. Confirm the precedence by running it before asserting
it.

---

## 7. Risks

- **R-1 — the register can be written so that it cannot fail.** AC-2 is the durable value of this
  ticket and is exactly the shape that has failed five times here: a scan blind to a spelling (Q-0067
  rounds 1–2), a fail-open list (Q-0051, Q-0108), an assertion satisfied by its own subject (Q-0111),
  a count standing in for an identity (Q-0073, Q-0107). Keyed from source, fails on an unclassified
  addition, mutation-tested with distinct signatures, and no clause reads a total.
- **R-2 — the widened predicate is where AC-2 goes wrong.** A scan written for `safe(` cannot see
  `catch`, and one written for `catch` cannot see `safe(`. Both halves are demonstrated red
  independently; a register shown red only by its neighbour has not been established (Q-0107).
- **R-3 — a rewritten pin and a weakened pin look identical in a diff.** `git.test.ts:406–408`
  currently asserts that the two answers **are the same**; AC-9 makes it assert the opposite. A
  reviewer reading the diff without running it cannot tell the two apart, which is why every
  rewritten pin is demonstrated red against the unfixed code, and why no pin is closed by deleting,
  skipping, renaming away or weakening it.
- **R-4 — the spawn-cost pin is exact.** `git.test.ts:315` is `expect(calls).toBe(3)`, not a ceiling.
  A fix that adds a probe to `containment`'s happy path fails a landed guard rather than degrading
  quietly — which is the guard working, and is why AC-6 names `workTreeProbe`'s deferred-second-probe
  shape.
- **R-5 — `q0050.source.test.ts:227` registers `diff.ts`'s authority lines in order**, five entries.
  A `Why:` line added or removed by AC-9 moves it, and it must be moved by showing the previous
  sequence refused (AC-11).
- **R-6 — an approve on the first pass should be distrusted.** 108 of 145 review verdicts here
  returned `revise`. Four of this ticket's criteria are invisible unless run.
- **R-7 — `pnpm install` before the suite.** An implement step's worktree has no `node_modules`;
  `commands.install` runs only in an `integrate` worktree. An uninstalled suite and a red suite are
  indistinguishable to a reviewer.
- **R-8 — the run cannot prove its own fix, and this ticket's own board is the evidence.** `runFlow`
  receives `config` at run start, and `quorum board` run during the review reads the **pre-fix**
  `containment`. Verification is forced, on `main`, after the merge, in both environment rows
  (Q-0072's closing finding) — and this is the ticket whose subject is *a probe read as a proven
  negative*, so a local green is itself a probe (GO-5).
- **R-9 — the shim is the instrument and must not become the oracle.** `installGitShim` already
  exists and is already aimed at both functions, so nothing new is built; what is owed is that each
  shim-dependent test states its premise and reports a skip where the capability is absent.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, credential or `check()` path is touched, and no subscription-login refusal is weakened. |
| **Worktree safety** | Engaged and deliberately not repaired. `ensureWorktree`'s base probe (`git.ts:143`) is the one place a probe failure changes **where an agent writes**; registered under NG-3 with Q-0038's reasons. Nothing here writes to the user's working tree; every criterion above reads. |
| **Gate behaviour** | Unchanged. No gate, verdict vocabulary or exit code moves. `quorum board` still exits 0 under every new state (AC-10). |
| **File format and schema** | No format change. `ContainmentResult`, `PushLagResult` and `AncestryResult` and their closed sets are untouched, and `git failed` is already a member of the two that need it (AC-11). Nothing new is persisted; both facts stay derived-on-invocation and stored nowhere. |
| **Lint rules** | No flow-lint rule added; `quorum lint` unaffected; type-aware ESLint stays one rule. |
| **Cross-vendor rule** | Unchanged. The panel is what this ticket most depends on — Q-0059's three escapes were found one per round by the reviewer, not by the requirement. |
| **Cold-clone impact** | **Better, and this is the half that is on that path.** No new command, flag, dependency, prompt or output line; what changes is that a broken git stops telling a stranger their work does not exist. The board's failure output grows only where git has failed. |
| **Docs** | `docs/DECISIONS.md` and `docs/decisions/` are **unchanged** — 088 is landed and no second entry is owed (NG-13). `docs/GLOSSARY.md` gains nothing and `CLAUDE.md:13` is byte-identical (AC-11). `harness/rules.md` gains **one sentence** (AC-12); `.claude/rules/engineering.md` is its derived copy, unchecked by any test and the human's to sync (GO-4). No numbered document changes: `04-architecture.md`'s `core` principles already require this behaviour and are not contradicted. |
| **Product-agnostic** | Clean. No product name; fixtures use `T-`/`Q-` ids only. |
| **Errors are explicit** | The criterion this ticket is about. Six sites in `git.ts` default silently today; AC-4 to AC-9 remove that at four of them and AC-2 registers the rest with the reason each keeps its behaviour. |

---

## 9. Gate obligations

- **GO-1 — verify decision 088 is present in the first implement step's prompt.** It is landed and
  indexed; what is owed is the check, not the writing. Do not launch on the assumption.
- **GO-2 — rule the scope this document could not rule for itself.** The ticket body says it
  *inherits* AC-2 and AC-3; Q-0074's GO-2 says they *travel with the half that runs*, and no register
  exists in the tree (§0.1). **This document takes them.** If the gate sends them back to Q-0074
  instead, AC-2 and AC-3 are struck, the ticket is ten criteria, and **Q-0074's body must be
  re-pointed in the same act** so the register is not orphaned by both halves — which is the failure
  mode that made this a finding rather than a footnote. AC-12 is the same question one step smaller:
  keep it here, or leave it on Q-0074's §9 checklist row and accept that it waits.
- **GO-3 — nothing is deferred into prose.** If a criterion is dropped at this gate it is written
  into a ticket **at this gate**, from a body written out in full. Three obligations found orphaned in
  the week before Q-0074's run (Q-0110's, Q-0111's, Q-0112's) each lived only inside a closed ticket's
  prose or a source comment, and this ticket exists because that gate did the opposite.
- **GO-4 — the human syncs `.claude/rules/engineering.md` after AC-12 lands.** Outside the
  implementer's write paths, and **nothing checks the two files against each other**, so the drift is
  silent until somebody reads both. Q-0069's AC-11(b) is the precedent: three revise rounds refused
  it correctly and a human commit closed it.
- **GO-5 — verified in both environment rows, forced, on `main` after the merge; CI green on the
  merged commit.** This is the ticket whose subject is *a probe read as a proven negative*, and a
  local green is a probe. Q-0105's GO-3 is the precedent and it earned its existence: every local
  signal was green and CI was red on all three jobs.
- **GO-6 — the closing entry records that the census predicate had a blind spot and where.** That
  `safe()` was the wrong key, that the site it hid was `containment:339`, and that the site was
  already fixed on the sibling function of the same board invocation. It is the finding most likely
  to be repeated, because the next author will reach for the primitive's name too.

---

## 10. What this run measured, in one place

For a reader who wants the evidence without the argument. Every row was run or read against the
working tree this iteration.

| claim | how it was established |
| --- | --- |
| No census register exists | `grep -rn "SAFE_SITES\|census" packages/*/src packages/core/test` → one unrelated line |
| 16 `safe()` sites in `git.ts`, 8 in `fanout.ts` | `grep -n "safe(" ` on both files; lines listed in §1 |
| Six more caught-failure sites in `git.ts` | `grep -n "catch" packages/core/src/git/git.ts` → 20, 93, 106, 248, 266, 339, 457; line 20 is `safe()`'s own body |
| `containment:339` collapses | read: `catch { return null; }`, and `board.ts:204` renders nothing when `containment` answers `null` |
| No `Why:` line at any collapsing site | `grep -n "Why:" packages/core/src/git/git.ts` → 4, 122, 168, 188, 234, 459 |
| The unlabelled pin | `git.test.ts:406–408`, read in full |
| `git failed` is already vocabulary | `git.source.test.ts:133`, `CONTAINMENT_REASONS` |
| `shortSha` has exactly two consumers | `grep -rn "shortSha" packages/core/src packages/cli/src` minus tests → `diff.ts:285`, `:457` |
| The three sentences `missingEndpointFailure` composes | read at `diff.ts:235–253` |
| The board suppresses `no branch` only | `board.ts:117` `BRANCH_EXPECTED`, `:205` the ternary |
| git 2.55.0 spends 128 on absent *and* malformed | three `git rev-parse --resolve-git-dir` invocations, §0.5 |
| The cost pin is exact | `git.test.ts:315`, `expect(calls).toBe(3)` |
| `harness` is writable by the implement step | `harness/roles/developer-generalist.md:2` |
| Nothing compares `harness/rules.md` with its derived copy | `grep -rln "claude/rules" packages/` → four files, none a parity test |
| Decision 088 is landed and indexed | `docs/decisions/088-*.md` read in full; `docs/DECISIONS.md` under 2026-09-10 |
