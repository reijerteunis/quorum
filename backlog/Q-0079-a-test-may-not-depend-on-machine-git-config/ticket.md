---
id: Q-0079
title: A test may not depend on the machine's git configuration
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0079/integration
priority: p1
created: 2026-08-30
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-08-30T12:48:28.581Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-30T13:08:10.909Z
    cost: 9.135
---
Opened 2026-08-30 from the third instance of one class in three days. Created by hand rather than
through `harness ticket new`, which allocates `T-0001` — see *The allocator*, below, which is a
different defect and wants its own ticket.

## The class

**A test asserts over a property of the machine it runs on rather than of the repository, so it is
green everywhere it is looked at and red only where nobody is looking.** Three instances, each
found *after* merging, each having passed implement, review, `integrate`'s `tests=ok` and at least
one hand verification:

| | ticket | the machine property | found by |
| --- | --- | --- | --- |
| 1 | Q-0072 | `.harness/worktrees` and `.quorum/runs` **exist** on a working checkout, and in neither a fresh worktree nor a fresh clone | `main` went red after a green merge |
| 2 | Q-0073 | `fs.existsSync` used to *classify* a path, so the verdict was a function of what the checkout happened to contain | Q-0072's own fix |
| 3 | this one | `git merge --no-ff` needs a committer identity; macOS derives one from the OS user record, a Linux runner's is empty | CI, on the Q-0051 merge |

Instance 3 is the sharpest because the file **already knew the rule**: `diff.test.ts` passes
`-c user.email=q@a -c user.name=qa` on every `commit` and `commit-tree` and omitted it on all three
`merge` calls, while `packages/core/test/repo.ts` and `packages/core/src/fanout/fanout.ts:313` both
carry it on their merges. Nothing detected a file diverging from a pattern the repository follows
everywhere else. Fixed in `cf3b2e6`; **the fix is not this ticket, the guard is.**

## Why the existing guards do not cover it

`turbo-inputs.test.ts` is the closest thing and is aimed elsewhere: it asks *which files does this
task read*, so turbo's hash can declare them. This class is *which properties of the environment
does this test read*, which no hash can express. Q-0073 made one such property injectable — the
file inventory now comes from `git ls-files` rather than `fs.existsSync` — but it did so for one
guard, by hand, without a rule that would catch the next one.

**The three instances share a shape worth naming rather than a mechanism.** Instance 1 is the
existence of a directory, 2 is existence used as a classifier, 3 is git's identity resolution. A
guard aimed at any one of them would have missed the other two, which is the central difficulty and
the reason this needs a requirement rather than a patch.

## What the requirement has to decide

1. **Where the line is.** Every test reads *some* environment — a filesystem, a `git` binary, a
   temp dir. The rule cannot be "read nothing"; it has to name which properties may vary between a
   developer's machine and a fresh Linux clone, and which may not.
2. **Whether a source scan is the right instrument at all**, given the three instances have no
   common mechanism. A scan catches instance 3 cheaply — a commit-creating git subcommand
   (`commit`, `commit-tree`, `merge`, `cherry-pick`, `rebase`, `am`, `revert`, `tag -a`, `stash`)
   in a test must carry explicit identity flags — and would have caught it before the merge. It is
   much less obvious that a scan can express instances 1 and 2.
3. **Whether the real answer is CI-side rather than source-side**: a job that runs the suite under
   a deliberately hostile git configuration and an empty checkout. That catches all three by
   construction, and the next one too, at the cost of a matrix row. Weigh it against the scan
   honestly — the scan is cheap and partial, the job is complete and slower.
4. **What a deliberate violation looks like**, since Q-0073 established that existence used to
   *refuse* is correct while existence used to *classify* is the defect, and four guards that
   refuse were deliberately left alone.

**One measurement the requirement should make rather than inherit:** whether a local red is
reproducible at all. Two attempts on 2026-08-30 both failed to discriminate — an empty
`GIT_CONFIG_GLOBAL` leaves macOS deriving a name from the OS user record, so the *unfixed* file
passes; and setting `GIT_COMMITTER_NAME=` to empty overrides the `-c` flags, so the *fixed* file
fails. If no local repro discriminates, that is itself the argument for the CI-side answer in
decision 3, and it should be stated rather than assumed either way.

## Non-goals, stated so the implementer does not drift

- **Not the `cf3b2e6` fix.** `diff.test.ts`'s three `merge` calls are already correct. This ticket
  may not re-fix them, and may not treat their correctness as evidence the class is closed.
- **Not Q-0073's four refusing existence checks.** They are correct and pinned.
- **Not the allocator defect below.**

## The allocator, reported and not fixed

`harness ticket new` cannot allocate an id in this repository. `spike/src/backlog.js:51` reads
`parseInt(String(t.meta.id).replace(/^T-/, ''), 10)`, so every `Q-nnnn` id parses to `NaN`, the
filter drops all 51 of them, and line 52 returns `T-0001` — every time, since no `T-` ticket
persists to raise the maximum. Measured 2026-08-30 by running it, which is how this ticket came to
be written by hand. It is on the cold-clone path: `harness init` then `harness ticket new` is the
first thing a stranger does, and the second command silently produces an id that collides with the
one before it. Q-0074's body records the same surprise from the other side, believing the allocator
would have produced `Q-0077`. **It wants its own ticket and is named here only so the observation
does not expire.**
