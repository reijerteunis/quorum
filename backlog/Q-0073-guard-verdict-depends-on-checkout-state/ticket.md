---
id: Q-0073
title: The input guard's verdict depends on checkout state
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0073/integration
priority: p2
created: 2026-08-28
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-28T09:14:51.727Z
    cost: 5.997
  - stage: requirements
    run: 2
    flow: chore
    status: failed
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-28T09:50:30.056Z
    cost: 18.575
  - stage: reviewed
    run: 3
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-28T11:47:10.165Z
    cost: 7.349
---
Found at Q-0072's final gate, 2026-08-28, by re-running the forced suite on `main` after the merge
rather than trusting `integrate`'s tick. Q-0072 registered the two instances by hand and did not
fix the class; this ticket is the class.

**The defect.** `packages/core/src/turbo-inputs.test.ts`'s clause B refuses a directory-shaped path
literal that no audited walk covers — but it only *sees* a literal as a directory when the
directory **exists on disk** at the moment the suite runs. So the guard's verdict is a function of
what the checkout happens to contain, not of what the code says.

**What that produced.** `packages/shared/src/constants.ts` declares
`REPO_WORKTREE_ROOT = '.harness/worktrees'` and `RUN_HISTORY_ROOT = '.quorum/runs'`, and
`constants.test.ts` asserts on both values. Neither directory is tracked — `git ls-files` reports
**0 files** under either — so:

| where | both directories | guard |
| --- | --- | --- |
| a developer's checkout that has run a flow | exist | **red** |
| a fresh `integrate` worktree | absent | green |
| a fresh CI clone | absent | green |

Q-0072's implement step, its `integrate`, and CI were therefore all structurally incapable of
seeing it, and `main` was red for every developer while every gate reported green. **This is
Q-0071's shape inverted:** there the gates were blind because they replayed a cache; here they are
blind because they run on clean checkouts, which is the one condition under which the check cannot
fire. A guard that only the unguarded environment can trip is worse than no guard, because its
green is read as coverage.

**Not the same as a missing register entry.** Adding `.harness/worktrees` and `.quorum/runs` to
`NOT_READ` — which Q-0072 did, by hand, after its gate — closes those two and leaves the class
open: any future product constant naming a directory that happens to exist trips the guard on
somebody's machine and nowhere else. The register is the right home for a path *named but never
opened*; it is the wrong instrument for deciding *whether a literal is a directory at all*.

**Shapes, none decided.** (1) Decide directory-ness from the literal's role in the code rather than
from `fs.existsSync` — a literal reaching a read is a path, a literal reaching an assertion is
data — which is close to what clauses C1–C4 already do for reads and would make the whole file
consistent. (2) Resolve directory-ness against **git** rather than the filesystem, so untracked
state cannot change a verdict; check whether `git ls-files` is an acceptable dependency for a test
that must also run in a worktree. (3) Register every product path constant exported from
`packages/shared/src/constants.ts` automatically, so the two classes never drift — narrow, and it
does not stop a directory literal appearing anywhere else. (4) Make the suite create the two
directories before scanning, forcing every environment into the same state — cheapest, and it makes
the guard's answer depend on a fixture rather than removing the dependence.

**Verify before designing.** Re-run the three-environment table above rather than inheriting it,
and establish which literals in either suite are currently classified by existence rather than by
role — the count decides whether shape (1) is a small change or a rewrite. Do not re-derive it from
this body.

**A property worth asserting whatever shape wins:** the guard returns the same verdict on a clean
checkout and on one that has run flows. That is testable directly and is the thing that was missing.

Needs a `docs/DECISIONS.md` entry only if the chosen shape changes what the guard claims; a
consistency fix inside one file does not. Belongs to M2.

---

## Measured before the requirements run — 2026-08-28

Performed by hand at `b459b2c`, against the real guard rather than a reconstruction of it, because
the body above says to re-run the table rather than inherit it. Each command is named with the
question it answers. **Two of the body's claims did not survive: the CI row was an inference, and
the mechanism is one function earlier than stated.**

### The three-environment table, re-run

The variable under test is the two `NOT_READ` entries Q-0072 added by hand after its gate; removing
them restores the state the ticket is about. `packages/core` suite, `vitest run
src/turbo-inputs.test.ts`:

| environment | `.harness/worktrees`, `.quorum/runs` | guard |
| --- | --- | --- |
| this developer checkout, which has run flows | present (directories) | **red — 2 failed, 49 passed** |
| a fresh `git worktree` of `main`, `pnpm install --frozen-lockfile` | absent | green — 51 passed |
| a fresh `git clone --no-local` of `main`, same install | absent | green — 51 passed |

The table holds. With the entries restored and the directories present, the guard is green again
(51 passed), so the register does close the two instances.

### Causation, isolated in one environment

The table above varies environment as well as disk state. In the **same** probe worktree, at the
same commit, with the same file bytes, `mkdir -p .harness/worktrees .quorum/runs` — two empty
directories, nothing else — flips it:

    51 passed          →  2 failed, 49 passed

Six occurrences are reported, in four files: `constants.ts` and `constants.test.ts` in `shared`
(both literals), and `fanout.source.test.ts` and `git.source.test.ts` in `core` (`.harness/worktrees`
only). So the verdict is a function of disk state, demonstrated rather than argued.

### Correction 1 — the load-bearing check is collection, not directory classification

The body attributes the defect to clause B *"only seeing a literal as a directory when the directory
exists"* (`turbo-inputs.test.ts:1303`). That is the symptom. Creating the same two paths as **plain
files** rather than directories reports **the same six occurrences**, losing only the
`(a directory, and no audited walk covers it)` clause:

    "packages/shared/src/constants.ts: .harness/worktrees"

The existence check that decides whether a literal is seen at all is one function earlier:
`pathLiterals` at **`turbo-inputs.test.ts:348`**, `if (!fs.existsSync(path.join(repoRoot, value))) continue;`.
`statSync().isDirectory()` at :1303 only chooses which failure message is printed. This matters
because shapes (1) and (2) name different lines, and a fix aimed only at :1303 would move the
message and not the dependence.

### Correction 2 — CI has never run this code

The body's third row says a fresh CI clone is green. **No CI run has seen it.** `main` is **15
commits ahead of `origin/main`**, and the newest run on `main` is `33126632430` at `928f732`,
2026-08-27T23:32Z — before Q-0072's merge. The row was an inference from the mechanism, and it is
almost certainly right; it is recorded here as measured on a fresh clone, which is the same disk
state, and not as observed on CI. Q-0072's DECISIONS entry says "implement, integrate and CI all
reported green" — true of the first two, and of CI only in the sense that it never ran.

### The census the body asks for — which literals are classified by existence

Every quoted literal in both audited suites' sources that passes `pathLiterals`'s syntactic filters
(contains `/`, no leading `/` or `..`, no trailing `/`), compared against `git ls-files`:

| | occurrences | distinct |
| --- | --- | --- |
| candidates passing the syntactic filters | 461 | 307 |
| collected today, because they exist on this checkout | 67 | 37 |
| dropped today, because they do not | 394 | 270 |
| collected and classified as a directory | 16 | 10 |
| **on-disk state differs from git-tracked state** | **7** | **3** |

The three divergent literals are `.harness/worktrees`, `.quorum/runs` (both untracked directories,
6 occurrences) and `node_modules/.bin/turbo` (untracked file, 1 occurrence, already in `NOT_READ`
as the installed toolchain). Nothing else in either suite names a path whose existence depends on
what the checkout has done.

**This is the count that separates shape (1) from shape (2).** Existence is not only classifying
directories — it is what tells a path from any other string containing a slash, and it drops 270
distinct literals to do it: lint messages (`- flow needs consumes/produces`), import specifiers
(`./adapters.js`), shell fragments (`#!/bin/sh`), argv fixtures (`--add-dir /tmp/a dir`), and prose.
Shape (1) must decide role for all 307; shape (2) changes one line and moves exactly 3 literals,
leaving the other 34 collected as they are.

### One consequence of shapes (2) and (3) that nothing detects

There is no test asserting a `NOT_READ` entry is still reachable. Under shape (2)
`node_modules/.bin/turbo` becomes untracked-therefore-uncollected, so its entry goes dead silently
— a small instance of this repository's own *"a check that skips its subject"*. Whatever shape
wins, a dead-entry check belongs beside it.

### Baseline

`main` at `b459b2c` is green in this checkout: `npm test --prefix spike` 12/12, and
`pnpm turbo run test --force` 7/7 with **0 cached**, 27.5 s.

### A second measurement, taken after the requirements run started

The body's shape (2) says *"resolve directory-ness against **git** rather than the filesystem"* and
asks whether `git ls-files` is an acceptable dependency. Measured, the answer sharpens into a
different and better question — **what set does turbo actually hash?** — because that, not
existence, is what the guard is trying to decide. Three probes in a worktree, each reading
`turbo run test --filter @quorum/shared --dry=json`'s reported task hash:

| file added to `packages/shared/src` | git state | task hash |
| --- | --- | --- |
| — (baseline) | — | `6a050a11faef7c37` |
| `zz-probe.txt` | untracked, **not** ignored | `f27ff86727de2f29` — **moved** |
| `zz-probe.log` | untracked, ignored by `*.log` | `6a050a11faef7c37` — unchanged |

So turbo hashes tracked **and** untracked-but-unignored files, and ignores gitignored ones. The
hashable set is exactly `git ls-files --cached --others --exclude-standard` (503 entries here, 9 ms).
That matters twice:

- **`git ls-files` alone would be wrong.** Tracked-only would drop a path turbo genuinely hashes,
  which is a real read going invisible — the failure the guard exists to prevent, introduced by its
  fix.
- **All three divergent literals are gitignored** — `.gitignore` lists `.harness/`, `.quorum/` and
  `node_modules/` — so they are unhashable, no declaration could ever cover them, and they should
  never have been candidates. The defect restated: *the guard's question is whether a path is
  hashable, hashability is a git property, and the guard asks the filesystem.*

**One inventory replaces the existence test; an ignore-rule alone would not.** 270 of the 307
distinct literals neither exist nor are ignored, so a rule that only asked *is this ignored?* would
collect every branch name and lint message. The hashable set answers both halves at once: it holds
tracked files plus untracked unignored ones **that exist**, so `harness/Q-0042/implement` is absent
from it for the same reason `fs.existsSync` rejects it today, and `.harness/worktrees` is absent
because git ignores it. That is what lets AC-1's "one inventory, obtained in one place" be literally
one command.

**Measured directly, which is the property the body asks for.** Running the proposed predicate over
all 578 raw literal occurrences in three checkouts — this one with 25 worktrees and a run history, a
clean `git worktree`, and a fresh `git clone` — the decision vector hashes **`f374ec83492deb08` in
all three**, against a filesystem oracle that differs by 7 decisions between them. It changes
exactly 7 of 578 decisions versus today, and they are exactly the three known literals. (578 counts
raw occurrences; the table above counts 461, because `pathLiterals` dedupes per file. Both units
describe the same scan — a distinction the requirements run caught and is worth keeping straight.)

**Tracked-only and the hashable set agree on all 578 literals today**, so this changes no current
verdict. It changes what the guard *claims*, which is why it is settled by erratum before the chore
run rather than left to a review round. See `requirements/errata.md` E-1.
