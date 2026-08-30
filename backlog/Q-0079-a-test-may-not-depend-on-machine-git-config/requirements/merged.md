# Q-0079 — A test's verdict is a property of the commit, not of the checkout or the account

*Requirements, merged, 2026-08-30. Iteration 2.*

*Verdict: **needs-input**, on **one** blocker, down from three. Iteration 1 asked the human to rule
on scope, on the decision entry, and on what the guard may claim. Two of those I have now ruled
myself and closed below — the split is made and its successor is drafted in full, and the sweep is
a post-merge alarm rather than a pre-merge gate. The survivor is the decision entry, which no step
of the chore flow may write. Everything else in this document is verified rather than argued.*

---

## What iteration 2 re-derived, and what it changed

Iteration 1's document says its own measurements *"must be re-measured by the implementer, not
inherited"*. That instruction binds this step too. Everything below was re-derived against the tree
at `296a73b`; the four rows were re-measured on this machine rather than read from iteration 1.

| claim | verdict |
| --- | --- |
| three `git merge` calls in `spike/test` carry no identity — `q0035-empty-range.js:74`, `:191`, `q0077-base-flag.js:52` | **confirmed**, all three are `git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH)` |
| every other commit-creating call in `spike/test` carries `-c user.email=… -c user.name=…` | **confirmed** across 17 sites in nine files |
| every commit-creating call in `packages/**` carries `-c` | **confirmed** — `test/repo.ts:32,37`; `fanout.ts:290,313`; `fanout.test.ts:414,427`; `diff.test.ts` ×8 |
| the only exemptions the tree uses | **confirmed and exact** — `merge --abort` ×3 (`fanout.ts:317`, `fanout.test.ts:415`, `spike/src/fanout.js:116`), lightweight `tag` ×2 (`git.test.ts:305`, `q0036-board-containment.js:212`) |
| CI's `spike` job supplies a global identity, and its comment justifying it is false | **confirmed** — the comment says *"the engine … commits worktrees with the ambient git identity"*, while `spike/src/fanout.js:92` and `:112` both carry `-c` and no other commit path exists in `spike/src`, `spike/bin` or `packages/cli/src` |
| `packages/core/turbo.json` declares `../../.github/workflows/ci.yml` but not `.github/scripts/**`, and `spike/src/**` but not `spike/test/**` | **confirmed** |
| `packages/core/src/test-command.test.ts` already asserts over `ci.yml` and `pnpm test` runs it | **confirmed**, 412 lines, Q-0065/Q-0071 block at the end |
| `turbo-inputs.test.ts` is the one comparable scan guard | **confirmed**, 2,139 lines |
| `harness/rules.md` §*Language and tests* exists at line 6; `docs/04-architecture.md` §*Testing strategy* at line 64 | **confirmed** |
| `spike/test/run.js` auto-discovers and excludes itself; 17 files, 16 tests | **confirmed** |
| the allocator is already opened as Q-0080 | **confirmed** — `backlog/Q-0080-ticket-new-cannot-allocate-an-id` |

**Four things changed a criterion, and one withdrew a finding of my own.**

**(1) The measurement is cheaper than either candidate thought, and I made it without creating
anything.** `git var GIT_COMMITTER_IDENT` resolves an identity and prints it; it needs no
repository, writes no object and leaves no temp directory. Measured here, on **git 2.55.0**,
darwin 25.3.0:

| row | environment | `git var GIT_COMMITTER_IDENT` |
| --- | --- | --- |
| A | ambient | `Ruud <info@ruud.tech>` |
| B | `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null` | `Ruud van Engelenhoven <ruudvanengelenhoven@Ruuds-MacBook-Pro.local>` — the OS user record, exactly the ticket's first failed attempt |
| D | B **and** `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.useConfigOnly GIT_CONFIG_VALUE_0=true` | **`Committer identity unknown`**, non-zero |
| D + `-c` | row D plus `-c user.email=q@a -c user.name=qa` | `qa <q@a>` |

Row D discriminates and row D with explicit flags passes, which is the whole mechanism, proved in
four commands that touch nothing. AC-4 names this as the probe form.

**(2) Row D has a hole neither candidate nor iteration 1 saw, and it is this ticket's own class
inside its own fix.** `user.useConfigOnly` forbids git from *inferring* an identity from the OS user
record; it does not forbid git from *reading a configured one*. Global and system config are
neutralised by the two `GIT_CONFIG_*` variables — **repository-local `.git/config` and
worktree-scoped config are not.** A checkout carrying `git config --local user.name` therefore
resolves an identity under row D and the sweep goes quietly permissive. This repository has none
(`git config --local --get user.name` exits 1, verified), so it is invisible here and would have
shipped; a contributor's clone may well have one, and then the local command reports green where CI
reports red. That is the shape iteration 1 caught for an exported `EMAIL` — the config-scope twin of
it, and the third time in this document that the fix has had to be defended against the defect it
fixes. AC-3 now refuses a local or worktree identity in the checkout under test, naming it and
never clearing it.

**(3) The install commands were wrong, inherited from Codex and unexamined by me.** Iteration 1's
AC-6 specifies `npm install --prefix spike --no-audit --no-fund`. CI's existing `spike` job runs
`npm ci` with `working-directory: spike`, and `npm install` is not lockfile-frozen — Q-0038 measured
a non-frozen install moving `fast-uri` and producing a genuinely different tree. The sweep's own
premise is that dependency versions come from the lockfiles, so a sweep installing differently from
the jobs it is the strict twin of could differ in verdict *for a reason other than the environment*,
which is the one thing it exists to isolate. AC-6 now uses `pnpm install --frozen-lockfile` and
`npm ci`, matching the existing jobs exactly. (`harness/rules.md`'s `npm install --prefix spike
--no-audit --no-fund` is an instruction to an *agent in a fresh worktree*, which is a different
context and stays as it is; no criterion touches it.)

**(4) I withdraw my own iteration-1 finding about `port-freeze-guard.test.mjs`.** It is indeed run
by nothing, but not by oversight — its header says so and gives the reason: *"Deliberately not
wired into CI: it needs git and a writable temp directory, and the guard it tests already runs on
every push."* That is a considered precedent, not a defect, and iteration 1's OQ-5 (*"worth a
ticket"*) is withdrawn. The conclusion it fed survives on better reasoning: that file's
justification rests on its subject running in CI anyway, which is true of the sweep's **self-proof**
(AC-4 runs inside the sweep on every push) and false of the sweep's **static text assertions**,
which nothing would execute. So AC-10 still puts those in `packages/core/src/test-command.test.ts`
— for the reason that they need a runner, not for the reason that the precedent is bad.

**(5) The surface rule is satisfied, and iteration 1 never checked it.**
`harness/roles/developer-generalist.md`'s frontmatter `paths:` is `[package.json,
pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps,
spike, harness, docs]`. Every surface the twelve criteria name is writable by the role that will
implement them, so *"A requirement may not name a surface its flow cannot write"* (2026-08-25) is
met by measurement rather than by hope — which is the Q-0069 AC-11(b) failure checked for rather
than repeated. The one exception is the decision entry, and it is the blocker (OQ-1).

**One negative result worth having.** `init.defaultBranch` is the same family of machine property
as identity resolution, and it is unset globally on this machine, so it would have been a plausible
fourth instance. It is not: every fixture repository in both trees pins `git init -q -b <name>`
(17 sites), and the one bare `git init -q --bare` (`git.test.ts:146`) has no commits and asserts
`containment(...)` is null *because there is no work tree*, where the branch name cannot matter.
That axis is already closed, which narrows what the sweep is buying and is worth saying so nobody
buys it twice.

---

## Problem

Three times in three days a test has asserted over a property of the machine running it rather than
of the commit under test. Each passed implement, a review, `integrate`'s `tests=ok` and at least one
hand verification, and each was found only after merging. A green tick reads as *"this commit is
sound **here**"*, and the difference from *"this commit is sound"* is invisible at the moment a gate
is answered.

The three share a shape rather than a mechanism — instance 1 is the existence of a directory,
2 is existence used as a classifier, 3 is git's identity resolution — which is why a guard aimed at
any one would have missed the other two.

### The class is not closed; three live instances are on `main` today

The three sites confirmed in the audit above are the ancestors of the three `cf3b2e6` fixed:
`diff.test.ts` was ported from `q0035-empty-range.js`, and the port carried the defect forward while
leaving the original in place. The ticket's instruction not to read `diff.test.ts`'s correctness as
evidence the class is closed was right, and those three lines are the proof.

Iteration 1 reports the spike suite failing **8 scenarios in 2 files** under row D and the
`@quorum/core` suite clean. The three sites and the identity mechanism are confirmed here; the
counts are not, and no criterion rests on them — AC-2's claim is *the suite passes with no identity
available*, established by running it, not by citing this paragraph.

### There is no strict environment, which is why the instrument is a sweep and not a job

The ticket's decision 3 proposes *"a job under a hostile git configuration and an empty checkout"*
on the reasoning that it catches all three by construction. **It does not.** Instance 3 is strict on
a bare Linux checkout and permissive on a developer's machine; instance 1 is the exact inverse —
`.harness/worktrees` and `.quorum/runs` exist on a working checkout and in neither a fresh worktree
nor a fresh clone, so implement, `integrate` and CI all reported green while `main` was red. There,
the empty checkout was the **permissive** side.

| | identity present | identity absent |
| --- | --- | --- |
| **bare checkout** | CI `spike` job *today* — the most permissive of the four, where the three live sites have been hiding | CI `workspace` job today — strict for instance 3, and clean |
| **populated checkout** | a developer's machine — strict for instance 1, covered only by a human's discipline | **nothing covers this** |

So the property to assert is not *"the suite passes in the hostile environment"*. It is **the verdict
is the same in both environments** — which is what Q-0073 already did for one guard by making the
file inventory injectable and running clause B over two inventories
(`turbo-inputs.test.ts:1682–1687`). That code is the pattern; this ticket generalises it and supplies
the one instrument injection cannot reach, because git's identity resolution happens inside a child
process rather than in our own code.

A trap that follows from the table: after AC-5 deletes CI's `git config --global` step, the `spike`
job becomes *incidentally* hostile — a GitHub runner's passwd entry has an empty gecos name, so git
cannot construct an identity. That is a property of the runner image, not of the repository, so it
is exactly the thing this ticket forbids relying on. The sweep sets `user.useConfigOnly` explicitly
and proves it (AC-4); the `spike` job's incidental strictness is a bonus and is never the guard.

---

## The rule this ticket establishes

> **A test's verdict must be a function of the commit under test, not of the checkout it runs in or
> the account it runs as.**

Instances 1 and 2 are *the checkout*; instance 3 is *the account*. One sentence, and it is what the
ticket asked to be named — the shape rather than a mechanism.

**A test may read** — the tracked-and-unignored inventory (`git ls-files --cached --others
--exclude-standard`, per *"Membership is a git question, not a filesystem one"*, 2026-08-28); its
own package's files; `os.tmpdir()`; the `git` binary's presence and its own output; a repository it
built itself; a `PATH` shim it installed itself; dependency versions the lockfiles declare;
environment values it set itself (`packages/core/test/env.ts`'s `withEnv`).

**A test may not let its verdict depend on** — git's identity resolution, in **any** config scope
(system, global, local, worktree) or from the OS user record; any other value from a git config it
did not set (`init.defaultBranch`, `core.autocrlf`, `commit.gpgsign`, `merge.ff`, `pull.rebase`);
the existence of a gitignored directory that *use* creates (`.harness/worktrees`, `.quorum/runs`,
`node_modules`); the untracked or ignored contents of the working tree; files in the runner's home
directory; environment variables inherited from a login shell; the operating system's user name,
host name or locale; state left by an earlier test that is not an explicit shared fixture.

**Three uses of a machine property, and only one is the defect** — the ticket's decision 4, of which
Q-0073 already ruled half:

1. **As a fixture input** — building a temp repository, choosing a temp path, pinning `git init -b
   main`. Correct, unrestricted. A test needing both a present and an absent case constructs both.
2. **To refuse to run** — `packages/core/test/corpus.ts:17` and `:63` throwing `corpus missing: …`,
   `turbo-inputs.test.ts:377`/`:388` throwing `… proves nothing without it`, and the four checks
   Q-0073 deliberately left alone. Correct, and required by *"a check that skips its subject must
   not report success"* (2026-08-25). No criterion here may touch them.
3. **To decide a verdict** — the defect. Existence used to *classify*, an identity resolved from the
   account, a directory listing used as an oracle.

A deliberate violation is entered in a register with a per-entry reason, in the shape
`turbo-inputs.test.ts`'s `NOT_READ` established: *a list a reviewer must approve, not a pattern that
quietly excuses a class.*

---

## User stories

**`maintainer`** — As the maintainer, when I answer a gate I want one command that tells me whether
the commit is sound in the environments this project supports, rather than only in the one I am
sitting in, so that answering a gate is not an act of faith about my own `~/.gitconfig`.

**`maintainer`** — As the maintainer, I want a push to go red within one CI run when a test starts
depending on a machine property, naming the phase that failed and quoting the command's output,
rather than surfacing three tickets later as `Committer identity unknown` inside a fixture.

**`contributor`** — As a contributor whose Linux machine has no global git identity, I want
`pnpm test` and `npm test --prefix spike` to pass on a clean clone, so my first contribution is not
a red suite I did not cause and cannot diagnose.

**`adopter`** — As a cold-clone adopter, I want none of this to lengthen my first 30 minutes: the
sweep is CI's and an opt-in local command, never something I must understand to run `npx quorum`.

Surfaces touched: **`.github/`** (the workflow and one script), **`packages/core/src`** (static
assertions) and **`packages/core/turbo.json`**, **`spike/test`** (three lines), **`harness/rules.md`**,
**`docs/04-architecture.md`**, root `package.json`. All are inside `developer-generalist`'s declared
paths. The CLI, the daemon, every flow file, every schema and `spike/src` are untouched.

---

## Acceptance criteria

**AC-1 — The rule is written once, and no vocabulary is invented.**
`harness/rules.md` §*Language and tests* gains one bullet carrying the rule sentence, the two lists
and the three-uses distinction, citing by title and date the decision entry recorded at this
ticket's requirements gate (OQ-1). `docs/04-architecture.md` §*Testing strategy* gains one sentence
naming what the new CI cells claim and what they do not, in the register the Q-0071 and Q-0072
sentences beside it already use. **No `GLOSSARY.md` term is added** — the glossary is product
vocabulary and an engineering rule about tests is not; ruled here so an implementer does not add one
on the grounds that a new noun appeared. **No criterion names `.claude/rules/`**: it is a derived
copy (2026-08-27). If the gate advanced without an entry being recorded, the implementer does not
invent a citation: it writes the paragraph without one and **names the implied entry in its report**,
which is what `harness/roles/developer-generalist.md` instructs, and says so in the summary.
*Test:* the bullet is present and quotes the entry's title and date; `GLOSSARY.md` is unchanged in
the diff; `.claude/rules/` appears in no changed path.

**AC-2 — The three live sites carry an identity, and the audit is by execution.**
`spike/test/q0035-empty-range.js:74`, `:191` and `spike/test/q0077-base-flag.js:52` each pass
`-c user.email=q@a -c user.name=qa` before `merge`, matching the `commit()` helper each file already
defines (`q0035-empty-range.js:26`, `q0077-base-flag.js:31`). The claim is not *"a grep finds no
more"* but *"the suite passes with no identity available"*.
*Test:* `npm test --prefix spike` under the AC-3 environment reports **16 of 16** files passing
(`run.js` discovers 17 `.js` files and excludes itself), and the same command with the three lines
restored to their `HEAD~` form fails — demonstrated by restoring them, not asserted.

**AC-3 — The hostile environment is defined once, in one tracked file both CI and a developer
invoke, and it closes every config scope.**
One script under `.github/scripts/`, beside `port-freeze-guard.sh`, which: gives the run an empty
`HOME`; neutralises **global** config (`GIT_CONFIG_GLOBAL` at nothing) and **system** config
(`GIT_CONFIG_NOSYSTEM=1`, git's documented switch, or `GIT_CONFIG_SYSTEM` at nothing — AC-4's probe
is the oracle, so the spelling is not load-bearing); sets `user.useConfigOnly=true` through
`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0`; **unsets every inherited `GIT_AUTHOR_*`,
`GIT_COMMITTER_*` and `EMAIL`**; and **refuses to run if the checkout under test carries a
repository-local or worktree-scoped `user.name` or `user.email`**, exiting non-zero naming the scope
and the value's key — it never clears one and continues, on the same rule as AC-6(a).
A definition restated in `ci.yml` or in a `package.json` script is refused: the two would drift and a
developer could not then reproduce what CI claims.

The last two clauses are not padding, and each closes a measured hole. An exported `EMAIL` or
`GIT_AUTHOR_NAME` survives every `GIT_CONFIG_*` variable and would make the *local* invocation
permissive while CI stays strict. And `user.useConfigOnly` forbids **inference**, not
**configuration**: a `[user]` section in `.git/config` satisfies git under row D, so a contributor's
checkout can be permissive while this one — which has no local identity — is strict. Both are this
ticket's own class reappearing inside its own fix, which is the failure mode the whole document is
about.
*Test:* the variable names and the unset list appear in exactly one tracked file, asserted by AC-10;
the script is invoked in a checkout carrying a local `user.email` and exits non-zero naming it.

**AC-4 — The environment proves itself before it certifies anything.**
Before either suite runs, the script demonstrates that its own environment discriminates, in both
directions: with no explicit flags, identity resolution must **fail**; with explicit `-c
user.email=… -c user.name=…`, it must **succeed**. `git var GIT_AUTHOR_IDENT` and `git var
GIT_COMMITTER_IDENT` are the probe of record — they resolve an identity without a repository, a
temp directory or a commit object, and were measured that way for the rows above; a throwaway commit
is an acceptable alternative and buys nothing. If either direction comes out the other way, the
script exits non-zero naming which probe broke and runs no suite. The negative probe may **not** be
built from an empty `GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL`: an environment variable outranks a
`-c` flag, so that setup rejects *corrected* code too and would report the class as caught while
catching everything.

This is the highest-value criterion in the ticket. Every mechanism here rests on git 2.55's
treatment of `user.useConfigOnly` and on `GIT_CONFIG_COUNT` not outranking a `-c` flag. A git
upgrade, a runner image shipping a system identity, or an earlier step running `git config --global`
each turn the sweep permissive — and **a permissive sweep is green over everything**, which is this
repository's recurring failure in its purest form (*"skipped is not passed"*, 2026-08-25; *"a check
is not established by reading it"*, 2026-08-29). The environment is a check, so it must have a
subject.
*Test:* both probes asserted in both directions; the script is run with the negative probe
deliberately defeated (an identity injected through a scope the script does not clear) and must exit
non-zero naming it.

**AC-5 — CI's `spike` job stops supplying a global identity.**
The `git config --global` step is deleted and its comment replaced by one that is true: the engine's
own commits carry explicit `-c` flags (`spike/src/fanout.js:92`, `:112`), and no other commit path
exists in `spike/src`, `spike/bin` or `packages/cli/src`, so nothing in the suite needs an ambient
identity once AC-2 lands. The comment must also say that the job's resulting strictness is
**incidental** — a property of the runner image — and that the sweep, not this job, is the guard.
*Test:* `user.email` appears in `ci.yml` only inside the AC-6 jobs' invocation of the AC-3 script;
the `spike` job is green on the runner after AC-2 and red before it.

**AC-6 — CI covers the two cells that discriminate, each from its own fresh checkout, installing
exactly as the existing jobs do.**
Two jobs, sharing no checkout — the populated cell's whole premise is that pre-existing state
changes a verdict, so a shared checkout would make one cell depend on the other's leftovers:

- **(a) bare + hostile** — before installing anything, it asserts `.harness/worktrees` and
  `.quorum/runs` do **not** exist, and stops with an error naming the offending path if either does.
  It never deletes and continues.
- **(b) populated + hostile** — it creates `.harness/worktrees/` and `.quorum/runs/` (the two paths
  Q-0072 registered by hand in `NOT_READ`) and then runs the same suites. This is the cell nothing
  covers today and where instance 1 lived.

Both install with **`pnpm install --frozen-lockfile`** and **`npm ci`** (working directory `spike`) —
byte-identically what the existing `workspace` and `spike` jobs run — and then run both `npm test
--prefix spike` and `pnpm turbo run test --force`. The install commands are part of the criterion
and not incidental: a sweep that installs differently from the jobs it is the strict twin of can
differ in verdict for a reason other than the environment, which is the one variable it exists to
isolate, and `npm install` is not lockfile-frozen — Q-0038 measured a non-frozen install moving
`fast-uri` and producing a different tree.
The fourth cell — *bare checkout with an identity present* — is deliberately uncovered, and the
reason is written in the file rather than left to be inferred: a defect visible only there is one
where **having** an identity breaks a test, a rarer shape with no measured instance, and covering it
costs a further full run.
*Test:* cell (b) is red before AC-2 lands and green after; cell (a)'s absence assertion is exercised
by creating one of the two paths and observing the named error; the uncovered cell is named in the
workflow.

**AC-7 — The sweep fails loudly, and an unrun suite is never reported as passing.**
A failure in isolation setup, either probe, either install or either suite fails the check with a
message that distinguishes those five phases and includes the failing command's output. It never
retries under the runner's ambient home or git configuration. A suite that was skipped, filtered, or
whose install did not complete is reported as **unrun**, not as passing (*"skipped is not passed"*,
2026-08-25; *"A green tick names what it examined"*, 2026-08-27).
*Test:* each of the five phases is failed deliberately and the message names it; a run with the
spike install removed reports the spike suite as unrun rather than green.

**AC-8 — A maintainer runs the sweep with one command, and the ordinary loop is unchanged.**
Root `package.json` gains a script that invokes the AC-3 file, so what a maintainer runs at a gate is
byte-identically what CI runs. `lint`, `typecheck` and `test` in root `package.json`, and `npm test
--prefix spike`, are untouched and stay ambient and cached — a developer's inner loop does not get
slower, which is where a cache and a warm config earn their keep (*"The test command defeats its own
cache"*, 2026-08-27).
*Test:* the three existing root scripts are byte-identical in the diff; the new script's body is one
invocation of the AC-3 file and restates none of it.

**AC-9 — The measurement is recorded where the next person will look, including what does not
discriminate.**
The AC-3 script's header records the rows above: the row-D command; that `git var
GIT_COMMITTER_IDENT` is the non-mutating probe form; and *why* an empty `GIT_CONFIG_GLOBAL` alone
(macOS infers from the OS user record — `Ruud van Engelenhoven
<ruudvanengelenhoven@Ruuds-MacBook-Pro.local>`), an empty `GIT_COMMITTER_NAME` (it outranks `-c` and
rejects corrected code), and `user.useConfigOnly` alone (it forbids inference, not configuration —
which is also why a repository-local `[user]` defeats it) each fail to discriminate. It names the
git version and platform each row was measured on (**git 2.55.0, darwin**) and states that Linux is
the authoritative environment for instance 3. The ticket's own instruction — *"state it rather than
assume it either way"* — is satisfied by this record, not by a sentence in a report.
*Test:* the header names all three non-discriminating environments and the git version; a reader
reproducing row D from the header alone gets the documented result.

**AC-10 — The static assertions about the sweep live in a suite something runs, and the read is
declared.**
Assertions over the sweep's *text* (AC-3's single definition, AC-5's deletion, AC-6's named
uncovered cell) go in `packages/core/src/test-command.test.ts`, which already asserts over `ci.yml`
for Q-0065/Q-0071 and which `pnpm test` runs. They may **not** go beside
`.github/scripts/port-freeze-guard.test.mjs`: that file is executed by nothing and says so
deliberately, on the reasoning that *"the guard it tests already runs on every push"* — true of the
sweep's self-proof (AC-4, which runs inside the sweep) and false of its static text, which nothing
would execute. `packages/core/turbo.json` gains `../../.github/scripts/**` beside the
`../../.github/workflows/ci.yml` it already declares, because the suite now reads it and a hit must
name what the task reads (*"A cache hit names what the task reads"*, 2026-08-28);
`turbo-inputs.test.ts` stays green with no new `NOT_READ` entry.
*Test:* the assertions fail when the sweep script is edited to violate AC-3, AC-5 or AC-6;
`turbo-inputs.test.ts` passes; editing `.github/scripts/*` invalidates `@quorum/core#test` and
editing an unread file does not.

**AC-11 — Nothing about the product changes, and the pins hold.**
No flow, gate, role, adapter, manifest, contract or zod schema changes; no runtime dependency is
added; the mock-adapter end-to-end regression suite stays green; the *refusing* existence checks —
`corpus.ts:17`, `:63`, `turbo-inputs.test.ts:377`, `:388` — are untouched and still throw.
Temporary state created by the sweep is confined to the CI workspace or `os.tmpdir()` and never to a
user's working tree.
*Test:* the diff touches none of those surfaces; `q0034-review-fixes.js` and the four refusal checks
are unchanged in the diff and green.

**AC-12 — Verification is performed in both environment rows, forced.**
Per Q-0072's closing finding, both suites are run forced in the `integrate` worktree — which has
neither `.harness/worktrees` nor `.quorum/runs` — and again on `main` after the merge, where both
exist. A tick from one row is not evidence for the other, and on this ticket of all tickets it
cannot be.
*Test:* both rows recorded with task counts and `0 cached`, in the ticket's `dev/` artifact.

Twelve criteria, every surface inside the implementing role's declared paths. The scan that would
have caught instance 3 before the merge is **not** among them; see *The successor*.

---

## Non-goals

- **Not `cf3b2e6`.** `diff.test.ts`'s three `merge` calls are correct and are not touched, and their
  correctness is not evidence the class is closed — AC-2's three sites are the proof it is not.
- **Not the refusing existence checks.** Use (2) is correct and pinned; a criterion that deleted one
  would remove a guard doing its job.
- **Not a ban on `fs.existsSync`, on filesystem access, on temp directories, or on the `git`
  binary.** Whether an existence check is a defect depends on its use, per the three-uses list.
- **Not the source scan.** Deferred, with its body written out below.
- **Not a required-check policy.** This repository has no PR gate — see OQ-2.
- **Not `harness.yaml`'s `commands.test`, and not `harness/rules.md`'s install instruction.** The
  first is refused with reasoning in OQ-2; the second addresses an agent in a fresh worktree, a
  different context from the sweep, and stays as it is.
- **Not the allocator.** Already opened as **Q-0080**, verified present in `backlog/`, so the ticket
  body's *"wants its own ticket"* is satisfied and no criterion here may touch `backlog.js:51` or
  its ported twin.
- **Not `init.defaultBranch`.** The same family of machine property, audited here and already closed
  — 17 fixture repositories pin `git init -b`, and the one bare init cannot depend on the name.
- **Not a general environment-isolation framework.** Nothing containerises the suite or intercepts
  `execFileSync`.
- **Not the product's own commit identity.** Whether `fanout.ts:290` pinning `harness@local` is right
  for a user's repository is a product question — OQ-3.
- **Not Windows.** Windows beyond WSL is a v1 non-goal, so the sweep stays POSIX.
- **Not a runner for `port-freeze-guard.test.mjs`.** Its absence from CI is deliberate and documented
  in its own header; iteration 1's OQ-5 is withdrawn rather than carried.

---

## The successor, written out so the obligation cannot expire

**Q-008x — A commit-creating git subcommand in a test carries an explicit identity, or is
registered.** Opened from Q-0079's requirements gate, 2026-08-30. Runs **after** Q-0079.

*Why it is separate.* Q-0079's sweep is the oracle: complete over all three instance shapes, and
slow. A source scan is the tripwire: partial — it catches instance 3 and cannot express 1 or 2 — and
cheap enough to run inside the ordinary suite, which is the one place a hazard is visible at
`integrate`, before a merge. Both are wanted, and they are not one ticket. This repository has
measured what a scan guard costs: `turbo-inputs.test.ts` is **2,139 lines** (re-counted), took five
implement rounds and four majors on Q-0072, and then produced **Q-0073 — an instance of this very
class**, because the guard decided a verdict from `fs.existsSync`. Building the tripwire in the same
ticket as the oracle that would police it inverts the order; and a scan landed before AC-2 lands is
red on merge.

*Scope, drawn from Claude's AC-7–AC-10, constrained by Codex's AC-12, and sharpened by a measured
false-positive corpus:*

- A guard under `packages/core/src/` scans `packages/**/*.test.ts`, `packages/*/test/**` and
  `spike/test/*.js`, and fails when a git invocation names `commit`, `commit-tree`, `merge`,
  `cherry-pick`, `revert`, `rebase`, `am`, `stash` (push/save/create), `notes`, or `tag` with
  `-a`/`-s`/`-m`, without `-c user.email=…` **and** `-c user.name=…` on the same invocation.
- **It must anchor on the invocation, not on the token — measured, not predicted.** A substring
  match trips on `'merge-base'` (`q0036-board-containment.js:162`, `q0033-surface.js:431`,
  `git.test.ts:203`) and on `'5d16e06^{commit}'` (`q0033-surface.js:346`, `:350`, `:410`). An
  *exact-token* match still trips: `packages/core/src/engine/diff.test.ts:909` holds
  `{ id: 'merge', type: 'integrate', … }` and `:914` holds `step: 'merge'` — a bare `'merge'`
  literal that is a flow step id and not a git call at all. And assertion strings quoting
  `git merge-base --is-ancestor` appear in `smoke.js:661`, `q0035-empty-range.js:62`, `:547` and
  `git.test.ts:46`, `:62`, `:71`, `:94`. That corpus is the C1/C4 lesson from `turbo-inputs.test.ts`
  arriving before the guard is written rather than four rounds into it: the scan must resolve the
  call to the file's `git()` helper and read its argument list.
- `packages/*/test/**` is in the corpus deliberately: `packages/core/test/repo.ts:32,37` holds two
  commit sites and the comment that already states this rule in prose. A corpus of `*.test.ts` alone
  would miss the file that documents the rule it enforces.
- Exemptions, exactly what the tree uses today, each demonstrated firing by a fixture that would trip
  the guard without it (Q-0071: *demonstrating that a guard has a subject proves the guard fires, not
  that each clause does*): `merge --abort` (`fanout.ts:317`, `fanout.test.ts:415`,
  `spike/src/fanout.js:116`); a lightweight `tag` (`git.test.ts:305`,
  `q0036-board-containment.js:212`); `rebase`/`am` with `--abort`/`--continue`/`--skip`; `stash`
  `list`/`show`/`drop`/`pop`/`apply`/`clear`.
- It fails closed: it names its corpus and refuses an empty or implausibly small one rather than
  passing over nothing; every register entry is asserted to still be a site the scan would collect,
  so an entry that stops matching is reported rather than left excusing nothing (Q-0073's finding,
  where `node_modules/.bin/turbo` became uncollectable on day one).
- Its doc comment states its own limit — **it sees literals only**. A subcommand in a variable, or
  reached through a helper with a computed argument, is invisible to it, which is why the scan is the
  tripwire and Q-0079's sweep is the oracle.
- Codex's constraint carries: if the check is structural rather than textual it must handle command
  wrappers and argument arrays and must not treat comments or unrelated strings as violations.
- `packages/core/turbo.json` gains `../../spike/test/**` — it declares `../../spike/src/**` today and
  not the test tree (verified) — with the accepted cost stated in the declaration's comment: sixteen
  spike test files then invalidate `@quorum/core#test`.
- **It may not be treated as coverage for instances 1 and 2**, and `harness/rules.md`'s paragraph
  from Q-0079 AC-1 says so.

Roughly nine criteria. If the human rules against the scan entirely at Q-0079's gate, this successor
is not opened and Q-0079 stands unchanged — the property that made the split safe.

---

## Open questions

**OQ-1 — the decision entry (BLOCKING, owner: human, at the requirements gate).**
This ticket establishes a repository-wide rule and rules on three design questions, so it owes a
`docs/decisions/` entry, and **no step of the chore flow may write it**:
`harness/roles/developer-generalist.md` says *"You do not add to `docs/decisions/` or its index; a
decision is the human's to record, so if your work implies one, name it in your summary."* AC-1 cites
the entry; an implementer that reaches it with no entry recorded must stop or write an uncited
paragraph, and either outcome costs a chore round. This is the precondition-external-to-the-document
shape that exhausted Q-0070's loop at a limit of 1 and was settled the same way — at the requirements
gate, by the human, before the run. Proposed title: ***"A test's verdict is a property of the commit,
not of the checkout or the account"* (2026-08-30)**. It must record: the rule sentence; the four-cell
table and the finding that no single environment is strict; the three-uses distinction, which extends
Q-0073's refuse/classify ruling with the fixture-input case Q-0073 never had to name; that
`user.useConfigOnly` closes inference and not configuration, so every config scope must be closed
explicitly; and the oracle-before-tripwire ordering that made the split (OQ-2) safe.

**OQ-2 — what the sweep is allowed to claim. *Ruled, non-blocking; reversible at the gate.***
Iteration 1 raised this as blocking and I am closing it. `main` advances by hand-made local merge
commits (`git log --merges`: `merge: Q-0057 …`, `merge: Q-0051 …`) and `main` is two commits ahead
of `origin/main`, so although `ci.yml` declares `on: pull_request`, no pull request is opened and CI
in practice runs after the merge. The sweep is therefore a **post-merge alarm that closes the loop
within one push**, plus AC-8's one command the maintainer runs at the gate — where AC-12's two-row
verification already sends them. No criterion claims to be a pre-merge gate, and Codex's AC-1 and its
branch-protection OQ are struck as untestable here. The alternative — putting the hostile environment
into `harness.yaml`'s `commands.test` so `integrate` carries it — is **refused**: it would make an
unrelated ticket's gate red for a hazard its author cannot see in their own diff, it adds a second
reason that command differs from `package.json`'s (reversing part of *"The test command defeats its
own cache"*, 2026-08-27), and it would run the engine's own git operations under a configuration no
user's machine has. The successor's scan buys most of the pre-merge benefit at none of that cost,
because it runs inside the ordinary suite. Reversible at the gate; nothing waits on it.

**OQ-3 — the scope split. *Ruled, non-blocking; reversible at the gate.*** Iteration 1 raised this as
blocking and I am closing it too: the split is made, this document is the twelve-criterion oracle
half, and the successor above is drafted in full so its obligation cannot expire — the mechanism
Q-0070 used for Q-0075 and Q-0076. What the human is being asked to accept is a recommendation, not a
prerequisite; if they want the scan in this ticket, the answer at the gate re-opens AC-7–AC-10 from
the successor body and this document is oversized again by its own sizing rule (2026-08-22).

**OQ-4 — should the engine ever commit with an ambient identity?** `fanout.ts:290`/`:313` pin
`harness@local`, so a user's harness commits are not attributable to them. That may be right (the
harness made the commit) or wrong (a merged branch reads as a robot's). Out of scope; named so the
observation does not expire. Non-blocking.

**OQ-5 — does the populated cell need `node_modules` present or absent as a third axis?** Probably
not: both installs run in every cell. Named because `harness/rules.md` already records that an
agent's worktree has no dependencies until it installs them, which is the same class of surprise.
Non-blocking.

*(Iteration 1's OQ-5, a runner for `port-freeze-guard.test.mjs`, is withdrawn — see* What iteration 2
re-derived *, item 4.)*

---

## Risks

**R-1 — the hostile environment silently stops being hostile.** The largest risk and the reason AC-4
exists. A git upgrade, a runner image with a system identity, a `git config --global` in an earlier
step, or a config scope the script does not close each turn the sweep permissive, and a permissive
sweep is green over everything. AC-4's self-proof is the mitigation and must not be traded away for
brevity. The repository-local scope is the instance of this already found and closed in AC-3.

**R-2 — the incidental strictness of the `spike` job is mistaken for the guard.** After AC-5 it is
hostile because a GitHub runner's gecos is empty, which is a machine property. AC-5's comment says so;
a future runner image change would restore the permissive cell silently.

**R-3 — removing the spike job's identity breaks a path the census did not reach.** The only commit
path in `spike/src`, `spike/bin` and `packages/cli/src` is `fanout.js:92`/`:112`, both with `-c`
(re-verified). If something else commits, the job goes red loudly, in CI, which is the correct
outcome and not a regression.

**R-4 — the sweep's cost.** Two jobs × two suites, roughly doubling a push's test wall-clock. Judged
worth it: CI is this project's only automated verdict, and three instances in three days is the
measured failure rate it is bought against. The duration before and after is recorded in the
implement report.

**R-5 — the sweep is read as covering more than it does.** It covers two of four cells and no cell
before a merge. AC-1's paragraph and AC-6's comment state the boundary where the next person reads it,
per *"A green tick names what it examined"* (2026-08-27).

**R-6 — the port freeze.** Q-0079 is not among the charter's fourteen children
(`harness/port-charter.md:242` lists Q-0041–Q-0054), so the freeze does not bind it — the Q-0038 and
Q-0057 precedent — and it touches `spike/test`, not `spike/src`, in any case. The branch-scope job
will report it out of scope rather than passing silently.

---

## Cross-cutting checklist

- **BYOS** — n/a. No key, token or credential path; the sweep sets git config variables and clears
  identity variables only.
- **Worktree safety** — the sweep creates `.harness/worktrees/` and `.quorum/runs/` **in the CI
  checkout** (AC-6b), never in a user's working tree, and no flow writes them. AC-12's
  `integrate`-worktree row is required precisely because that worktree is what the gate reads from.
- **Surface writability** — verified rather than assumed: every path the criteria name is inside
  `developer-generalist`'s declared `paths:`. The one exception is `docs/decisions/`, which is why
  OQ-1 is the blocker and not a criterion.
- **Gate behaviour** — unchanged. No flow file, loop bound, `on_exhausted` or gate kind is touched.
  OQ-1 is a precondition answered *at* the gate, not a change to how gates work.
- **File format and schema** — none. No ticket, flow, role, manifest or contract schema changes; no
  zod schema is added or altered.
- **Cross-vendor rule** — n/a; no flow or adapter behaviour changes.
- **Lint rules** — none added. The successor's guard is a Vitest suite rather than an ESLint rule: it
  must read `spike/test/*.js`, and `spike/**` is outside ESLint's scope entirely (Q-0069), so a lint
  rule could not see two thirds of its subject.
- **Cold-clone impact** — neutral to positive. `pnpm test` and `npm test --prefix spike` are
  unchanged, the new command is opt-in and named in no README step, and no adopter is asked to
  configure a global git identity. A contributor on a Linux machine with no identity is strictly
  better off after AC-2.
- **Product-agnostic** — yes. Nothing names a SaaS product.
- **Vocabulary** — "job" and "cell" refer to GitHub Actions, never to a flow **step**; "sweep" is used
  for the CI environment run and no glossary term is added (AC-1).

---

## Provenance

**Claude's candidate is the base.** Three of its contributions are load-bearing and neither
paraphrased nor averaged: the **rows A–E measurement**, which disproves the ticket's own belief that
no local reproduction discriminates and explains both of its failed attempts; the **four-cell table**
and the finding that *no single environment is strict*, which refutes the ticket's decision 3 as
stated and is the analytical centre of this document; and the **three-uses distinction**, which
extends Q-0073's refuse/classify ruling with the fixture-input case Q-0073 never had to name. Its
AC-1, AC-2, AC-3, AC-4, AC-6 and AC-12 survive as AC-2, AC-3, AC-4, AC-5, AC-8 and AC-12.

**Codex contributed four corrections that Claude's document needs**, each merged rather than noted:
the **empty `HOME` and the unset list** for `GIT_AUTHOR_*`/`GIT_COMMITTER_*`/`EMAIL`, which close a
hole Claude's row D leaves open on a developer's machine; the **prohibition on empty
`GIT_COMMITTER_NAME`** in the probe, which is the row-E trap turned into a criterion; the **refusal to
share a checkout between cells**, right for a reason Claude's single job misses; and its **phase-
distinguishing failure with no ambient retry** and *an unrun suite is not a pass*, which become AC-7.
Its `## Environment boundary` lists are folded into the two lists above, where they add inherited
shell variables and prior-test state. Its **AC-1 and its branch-protection open question are struck**
as untestable in a repository with no PR gate.

**Where they disagreed, I picked.** *Scan vs sweep:* Codex refuses the scan as primary and is right
that it cannot express instances 1 and 2; Claude ships both and is right that the scan is the only
instrument that fires before a merge. Both are kept, in two tickets, oracle first — neither
candidate's answer. *Where the self-test lives:* Claude's `port-freeze-guard.test.mjs` sibling is
struck, on corrected reasoning (see below). *Install commands:* Codex's are struck in favour of the
ones CI's existing jobs run.

**What iteration 2 added or corrected over iteration 1**, all from re-derivation against the tree:
`git var GIT_COMMITTER_IDENT` as a non-mutating probe and the four rows re-measured with it on git
2.55.0; the **repository-local and worktree config scopes**, which defeat row D and which nobody had
closed; the **install-command mismatch**, where iteration 1 inherited a non-frozen `npm install`
while CI runs `npm ci`; the withdrawal of iteration 1's `port-freeze-guard.test.mjs` finding, whose
absence from CI is deliberate and documented — the conclusion survives on better reasoning; the
**verification that every named surface is inside the implementing role's declared paths**, which
iteration 1 never checked; the **`init.defaultBranch` audit**, a negative result that closes the
class's other obvious axis; and the **measured false-positive corpus** for the successor's scan,
including `{ id: 'merge' }` at `diff.test.ts:909`, which defeats even an exact-token match and forces
the scan to anchor on the invocation. Iteration 1's three blockers are down to one: OQ-2 and OQ-3 are
ruled here and reversible at the gate; OQ-1 is the human's.
