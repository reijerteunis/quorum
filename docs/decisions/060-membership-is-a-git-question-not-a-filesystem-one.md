# Membership is a git question, not a filesystem one — 2026-08-28

**Decision:** `packages/core/src/turbo-inputs.test.ts` decides both of its classifying questions —
whether a quoted string literal is a repository path at all, and whether a collected path is a
directory — from one inventory, `git ls-files --cached --others --exclude-standard`, obtained once
and injectable. Neither decision reads the working filesystem. The four existence checks that
*refuse to run over a missing subject* (`typescriptFiles`, `filesBelow`, the installed `turbo`, and
the manifested-read assertion) are untouched and still throw: **existence used to classify was the
defect; existence used to refuse is the rule**, and confusing them would have deleted four guards
doing their job.

**Why that inventory and not `git ls-files`.** The guard exists to decide whether a path a suite
names is covered by a declaration, and a declaration can only cover what turbo hashes — so the
question is what turbo hashes, asked directly rather than inferred. Three probes, each adding one
file to `packages/shared/src` and reading the reported task hash:

| file added | git state | `@quorum/shared#test` hash |
| --- | --- | --- |
| — | — | `6a050a11faef7c37` |
| `zz-probe.txt` | untracked, **not** ignored | `f27ff86727de2f29` — **moved** |
| `zz-probe.log` | untracked, ignored by `*.log` | `6a050a11faef7c37` — unchanged |

Turbo hashes tracked **and** untracked-unignored files and ignores gitignored ones, so the tracked
set is a strict subset of it. A guard built on `ls-files` alone would drop a path turbo genuinely
hashes — a real read going invisible, which is the failure the guard exists to prevent,
reintroduced by its own fix. The merged requirement had fixed the tracked set in its §4 and
recommended `git ls-files` in OQ-1; `requirements/errata.md` E-1 supersedes both on this
measurement, decided before the implementer started rather than found in a review round.

**Alternatives considered.** (1) **Classify by the literal's role rather than by existence** — the
ticket's own first shape, and a rewrite: the census says existence is not merely classifying
directories, it is what tells a path from any other string containing a slash, dropping **270 of
307** distinct literals to do it (lint messages, `./adapters.js` import specifiers, `#!/bin/sh`,
argv fixtures, prose). Doing that without a syntax tree is the open-ended work Q-0072's E-1 already
refused to buy, and the parser that would make it tractable rewrites `pnpm-lock.yaml`, a declared
hashed input of the task under change, which CI installs frozen. (3) **Auto-register every product
path constant** — a supplement, not a fix: it closes two instances and leaves any future directory
literal to trip the guard on one machine and nowhere else. (4) **Have the suite create the two
directories before scanning** — cheapest, and it makes the answer depend on a fixture instead of
removing the dependence, while giving a test a side effect on the reader's working tree.

**Why: a guard that only the unguarded environment can trip.** `.harness/worktrees` and
`.quorum/runs` are directories Quorum creates and `.gitignore` excludes; `git ls-files` reports zero
tracked files under either. So the guard was **red** on a developer's checkout that had run a flow
and **green** in a fresh worktree and a fresh clone — and every gate this repository has runs in one
of the two green rows. When Q-0072 merged, its implement step, its `integrate` and CI all reported
green while `main` was red for every developer, and it surfaced only because someone re-ran the
forced suite on `main` after the merge instead of trusting `integrate`'s tick.

**This is Q-0071's shape inverted.** There the gates were blind because they replayed a cache; here
they were blind because they run on clean checkouts — the one condition under which the check cannot
fire. A green that only the unguarded environment could have contradicted is read as coverage.

**The mechanism was one function earlier than the ticket said**, and that is worth keeping because
it decides which line a fix must touch. The ticket attributed the defect to clause B seeing a
literal as a directory only when the directory exists (`statSync`, then at `:1303`). Creating the
same two paths as plain **files** reports the same six occurrences, losing only the
`(a directory, …)` clause — so the load-bearing check was `pathLiterals`'s `existsSync` collection
filter, and `statSync` only chose the message. A fix aimed at the directory test would have moved
the wording and left the dependence.

**The property is now asserted rather than hoped for.** The guard runs its own clause-B
classification over both suites' real sources against two inventories differing only in what an
untracked working tree can add, and requires the verdict *and* the reported occurrence list to
match. It is meaningful without those directories existing, so it fires in an `integrate` worktree
and on CI — the environments structurally blind to the class. Verified by hand on the merged result
in both rows, forced: 21/21 tasks with 0 cached and spike 12/12, identical with the two directories
present and absent.

**Cost accepted.** The guard now needs git, and fails loudly with a named error rather than
yielding an empty inventory — matching every corpus reader in both packages, and turbo, already a
hard requirement of this suite, derives its own hashes from the same source. A repository exported
without git can no longer run it. And the failure direction inverts: a literal naming a file the
author has created but not staged is now collected only if git does not ignore it, so a developer's
pre-`git add` run can classify differently from the gate — in the safe direction, because at the
gate and on CI the file is tracked, collected and must be declared.

**Two things this ticket found that outlive it.**

**A register entry can go dead in silence.** Nothing asserted that a `NOT_READ` key was still a path
the scan would collect, so a rule change could leave the register excusing nothing while reading as
coverage — this repository's own *"a check that skips its subject"* one level in. Under the
inventory, `node_modules/.bin/turbo` became uncollectable, which is exactly that case arriving on
the first day. A dead-entry check now names any key the classifier can no longer see, and both
`READ_BASES` citations that pointed at `NOT_READ` for it were reworded rather than left dangling.

**A count is not an identity.** The no-contraction guard was two `toBeGreaterThanOrEqual` floors, so
a replacement passed while a literal silently stopped being collected. The review nit that found it
was demonstrated rather than argued: swapping `harness/architecture.md` for `harness/harness.yaml`
in `role.test.ts` leaves 61 occurrences over 34 distinct literals — above both floors — so the old
assertion stayed green while a collected literal had gone. The baseline is now a register of
`file: literal` identities, checked one way so later additions still pass, with two assertions
pinning its own arithmetic so it cannot be trimmed to make itself pass.

**Found by:** re-running the forced suite on `main` after Q-0072's merge rather than trusting
`integrate`'s tick — the discipline that also produced this entry's own verification. The ticket's
three-environment table and its census were re-measured before the requirements run rather than
inherited, which corrected two of the ticket's own claims: the mechanism above, and that no CI run
had ever executed the defective revision, so the fresh-clone row is a measured proxy for CI's
checkout shape and not an observation of CI.
